from pydantic import BaseModel


class PriceSchema(BaseModel):
    value: float
    currency: str = "USD"


class PaginationMeta(BaseModel):
    count: int
    pages: int


class VariantSchema(BaseModel):
    id: int
    sku: str
    price: float
    options_text: str | None = None
    in_stock: bool
    image_url: str | None = None

    model_config = {"from_attributes": True}


class ImageSchema(BaseModel):
    url: str
    alt: str | None = None

    model_config = {"from_attributes": True}


class TaxonSchema(BaseModel):
    id: int
    name: str
    permalink: str

    model_config = {"from_attributes": True}


class ProductSchema(BaseModel):
    id: int
    slug: str
    name: str
    description: str | None = None
    price: PriceSchema
    images: list[ImageSchema]
    variants: list[VariantSchema]
    taxons: list[TaxonSchema]
    available: bool

    model_config = {"from_attributes": True}


class ProductListResponse(BaseModel):
    products: list[ProductSchema]
    meta: PaginationMeta


class TaxonTreeSchema(BaseModel):
    id: int
    name: str
    permalink: str
    pretty_name: str | None = None
    children: list["TaxonTreeSchema"] = []

    model_config = {"from_attributes": True}


class PageSchema(BaseModel):
    id: int
    slug: str
    title: str
    content: str | None = None

    model_config = {"from_attributes": True}
