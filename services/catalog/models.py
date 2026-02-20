from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import relationship

from database import Base


class Product(Base):
    __tablename__ = "products"
    __table_args__ = (
        UniqueConstraint("slug", name="uq_products_slug"),
        {"schema": "catalog"},
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    slug = Column(String(255), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    price = Column(Numeric(10, 2), nullable=False)
    currency = Column(String(3), default="USD")
    available = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())

    variants = relationship("Variant", back_populates="product", cascade="all, delete-orphan")
    images = relationship("Image", back_populates="product", cascade="all, delete-orphan")
    product_taxons = relationship("ProductTaxon", back_populates="product", cascade="all, delete-orphan")


class Variant(Base):
    __tablename__ = "variants"
    __table_args__ = (
        UniqueConstraint("sku", name="uq_variants_sku"),
        CheckConstraint("price >= 0", name="ck_variants_price_positive"),
        Index("ix_variants_product_id", "product_id"),
        {"schema": "catalog"},
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    product_id = Column(Integer, ForeignKey("catalog.products.id"), nullable=False)
    sku = Column(String(100), nullable=False)
    price = Column(Numeric(10, 2), nullable=False)
    options_text = Column(String(255))
    in_stock = Column(Boolean, default=True)
    weight = Column(Numeric(8, 2))
    image_url = Column(String(500))

    product = relationship("Product", back_populates="variants")


class Taxon(Base):
    __tablename__ = "taxons"
    __table_args__ = (
        UniqueConstraint("permalink", name="uq_taxons_permalink"),
        {"schema": "catalog"},
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    permalink = Column(String(255), nullable=False)
    pretty_name = Column(String(255))
    parent_id = Column(Integer, ForeignKey("catalog.taxons.id"), nullable=True)
    taxonomy = Column(String(100), default="categories")
    position = Column(Integer, default=0)

    children = relationship("Taxon", back_populates="parent")
    parent = relationship("Taxon", back_populates="children", remote_side=[id])
    product_taxons = relationship("ProductTaxon", back_populates="taxon")


class ProductTaxon(Base):
    __tablename__ = "product_taxons"
    __table_args__ = (
        Index("ix_product_taxons_taxon_id", "taxon_id"),
        {"schema": "catalog"},
    )

    product_id = Column(Integer, ForeignKey("catalog.products.id"), primary_key=True)
    taxon_id = Column(Integer, ForeignKey("catalog.taxons.id"), primary_key=True)

    product = relationship("Product", back_populates="product_taxons")
    taxon = relationship("Taxon", back_populates="product_taxons")


class Image(Base):
    __tablename__ = "images"
    __table_args__ = (
        Index("ix_images_product_id", "product_id"),
        {"schema": "catalog"},
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    product_id = Column(Integer, ForeignKey("catalog.products.id"), nullable=False)
    url = Column(String(500), nullable=False)
    alt = Column(String(255))
    position = Column(Integer, default=0)

    product = relationship("Product", back_populates="images")


class Page(Base):
    __tablename__ = "pages"
    __table_args__ = (
        UniqueConstraint("slug", name="uq_pages_slug"),
        {"schema": "catalog"},
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    slug = Column(String(255), nullable=False)
    title = Column(String(255), nullable=False)
    content = Column(Text)
