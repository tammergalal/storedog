import bootstrap  # noqa: F401 — must be first for dd-trace

import logging
from contextlib import asynccontextmanager

from ddtrace import tracer
from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session, selectinload

from database import Base, SessionLocal, engine, ensure_schema, get_db
from models import Page, Product, ProductTaxon, Taxon
from schemas import (
    ImageSchema,
    PageSchema,
    PaginationMeta,
    PriceSchema,
    ProductListResponse,
    ProductSchema,
    TaxonSchema,
    TaxonTreeSchema,
    VariantSchema,
)
from seed import seed_database

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        ensure_schema()
        Base.metadata.create_all(bind=engine)
    except Exception:
        logger.critical("Failed to initialize database schema — aborting startup", exc_info=True)
        raise
    db = SessionLocal()
    try:
        seed_database(db)
    except Exception:
        logger.critical("Failed to seed database — aborting startup", exc_info=True)
        raise
    finally:
        db.close()
    yield


app = FastAPI(
    title="Store Catalog",
    version="1.0.0",
    description="Read-only product catalog service",
    lifespan=lifespan,
)


def _product_to_schema(p: Product) -> ProductSchema:
    return ProductSchema(
        id=p.id,
        slug=p.slug,
        name=p.name,
        description=p.description,
        price=PriceSchema(value=float(p.price), currency=p.currency),
        images=[ImageSchema.model_validate(img) for img in p.images],
        variants=[VariantSchema.model_validate(v) for v in p.variants],
        taxons=[
            TaxonSchema(id=pt.taxon.id, name=pt.taxon.name, permalink=pt.taxon.permalink)
            for pt in p.product_taxons
        ],
        available=p.available,
    )


@app.get("/health")
def health(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {"service": "store-catalog", "status": "ok"}
    except Exception:
        return JSONResponse({"service": "store-catalog", "status": "degraded"}, status_code=503)


@app.get("/products", response_model=ProductListResponse)
def list_products(
    per_page: int = Query(20, ge=1, le=100),
    page: int = Query(1, ge=1),
    taxon: str | None = None,
    q: str | None = None,
    db: Session = Depends(get_db),
):
    span = tracer.current_span()

    query = db.query(Product).options(
        selectinload(Product.variants),
        selectinload(Product.images),
        selectinload(Product.product_taxons).selectinload(ProductTaxon.taxon),
    )

    if taxon:
        if span:
            span.set_tag("catalog.filter.taxon", taxon)
        taxon_filter = db.query(Taxon).filter(Taxon.permalink == taxon).first()
        if taxon_filter:
            query = query.join(Product.product_taxons).filter(
                ProductTaxon.taxon_id == taxon_filter.id
            ).distinct()

    if q:
        query = query.filter(Product.name.ilike(f"%{q}%"))

    total = query.count()
    products = query.offset((page - 1) * per_page).limit(per_page).all()
    total_pages = (total + per_page - 1) // per_page

    if span:
        span.set_tag("catalog.result.count", len(products))

    return ProductListResponse(
        products=[_product_to_schema(p) for p in products],
        meta=PaginationMeta(count=total, pages=total_pages),
    )


@app.get("/products/{slug}", response_model=ProductSchema)
def get_product(slug: str, db: Session = Depends(get_db)):
    product = db.query(Product).options(
        selectinload(Product.variants),
        selectinload(Product.images),
        selectinload(Product.product_taxons).selectinload(ProductTaxon.taxon),
    ).filter(Product.slug == slug).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return _product_to_schema(product)


def _build_taxon_tree(taxon: Taxon) -> TaxonTreeSchema:
    return TaxonTreeSchema(
        id=taxon.id,
        name=taxon.name,
        permalink=taxon.permalink,
        pretty_name=taxon.pretty_name,
        children=[_build_taxon_tree(c) for c in taxon.children],
    )


@app.get("/taxons", response_model=list[TaxonTreeSchema])
def list_taxons(db: Session = Depends(get_db)):
    roots = db.query(Taxon).options(
        selectinload(Taxon.children).selectinload(Taxon.children)
    ).filter(Taxon.parent_id.is_(None)).order_by(Taxon.position).all()
    return [_build_taxon_tree(t) for t in roots]


@app.get("/taxons/by-permalink/{permalink:path}", response_model=TaxonTreeSchema)
def get_taxon_by_permalink(permalink: str, db: Session = Depends(get_db)):
    taxon = db.query(Taxon).filter(Taxon.permalink == permalink).first()
    if not taxon:
        raise HTTPException(status_code=404, detail="Taxon not found")
    return _build_taxon_tree(taxon)


@app.get("/taxons/{taxon_id}", response_model=TaxonTreeSchema)
def get_taxon(taxon_id: int, db: Session = Depends(get_db)):
    taxon = db.query(Taxon).filter(Taxon.id == taxon_id).first()
    if not taxon:
        raise HTTPException(status_code=404, detail="Taxon not found")
    return _build_taxon_tree(taxon)


@app.get("/cms_pages", response_model=list[PageSchema])
def list_pages(db: Session = Depends(get_db)):
    pages = db.query(Page).all()
    return [PageSchema.model_validate(p) for p in pages]


@app.get("/cms_pages/{slug}", response_model=PageSchema)
def get_page(slug: str, db: Session = Depends(get_db)):
    page = db.query(Page).filter(Page.slug == slug).first()
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    return PageSchema.model_validate(page)
