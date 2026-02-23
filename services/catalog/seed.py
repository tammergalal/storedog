import json
import logging
import os

from sqlalchemy.orm import Session

from models import Image, Page, Product, ProductTaxon, Taxon, Variant

logger = logging.getLogger(__name__)

SEED_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "seed_data")


def _load_json(filename: str):
    path = os.path.join(SEED_DIR, filename)
    try:
        with open(path) as f:
            return json.load(f)
    except FileNotFoundError:
        raise FileNotFoundError(f"Seed data file not found: {path}") from None
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON in seed file {path}: {e}") from e


def _seed_taxons(db: Session, taxons_data: list, parent_id: int | None = None):
    for t in taxons_data:
        taxon = Taxon(
            name=t["name"],
            permalink=t["permalink"],
            pretty_name=t.get("pretty_name"),
            taxonomy=t.get("taxonomy", "categories"),
            position=t.get("position", 0),
            parent_id=parent_id,
        )
        db.add(taxon)
        db.flush()
        if "children" in t:
            _seed_taxons(db, t["children"], parent_id=taxon.id)


def seed_database(db: Session):
    if db.query(Product).first():
        logger.info("Database already seeded, skipping")
        return

    logger.info("Seeding catalog database...")

    try:
        # Seed taxons
        taxons_data = _load_json("taxons.json")
        _seed_taxons(db, taxons_data)
        db.flush()

        # Build permalink -> taxon lookup
        all_taxons = db.query(Taxon).all()
        taxon_map = {t.permalink: t for t in all_taxons}

        # Seed products
        products_data = _load_json("products.json")
        for p in products_data:
            product = Product(
                slug=p["slug"],
                name=p["name"],
                description=p.get("description"),
                price=p["price"],
                currency=p.get("currency", "USD"),
                available=p.get("available", True),
            )
            db.add(product)
            db.flush()

            for v in p.get("variants", []):
                variant = Variant(
                    product_id=product.id,
                    sku=v["sku"],
                    price=v["price"],
                    options_text=v.get("options_text"),
                    in_stock=v.get("in_stock", True),
                    weight=v.get("weight"),
                    image_url=v.get("image_url"),
                )
                db.add(variant)

            for img in p.get("images", []):
                image = Image(
                    product_id=product.id,
                    url=img["url"],
                    alt=img.get("alt"),
                    position=img.get("position", 0),
                )
                db.add(image)

            for taxon_permalink in p.get("taxons", []):
                taxon = taxon_map.get(taxon_permalink)
                if taxon is None:
                    logger.warning(
                        "Unknown taxon permalink %r for product %r — skipping",
                        taxon_permalink,
                        p["slug"],
                    )
                    continue
                pt = ProductTaxon(product_id=product.id, taxon_id=taxon.id)
                db.add(pt)

        # Seed pages
        pages_data = _load_json("pages.json")
        for pg in pages_data:
            page = Page(
                slug=pg["slug"],
                title=pg["title"],
                content=pg.get("content"),
            )
            db.add(page)

        db.commit()
        logger.info("Catalog database seeded successfully")
    except Exception:
        db.rollback()
        logger.error("Seeding failed and was rolled back", exc_info=True)
        raise
