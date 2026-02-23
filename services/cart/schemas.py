from pydantic import BaseModel, Field


class LineItemSchema(BaseModel):
    id: int
    product_id: int
    variant_id: int
    quantity: int
    price: float
    name: str
    slug: str | None = None
    image_url: str | None

    model_config = {"from_attributes": True}


class CartSchema(BaseModel):
    id: str
    token: str
    state: str
    email: str | None
    currency: str
    item_count: int
    subtotal: float
    discount_amount: float
    discount_code: str | None
    ship_total: float
    total: float
    line_items: list[LineItemSchema]

    model_config = {"from_attributes": True}


class AddItemRequest(BaseModel):
    variant_id: int
    # H5: quantity must be >= 1; prevents adding zero or negative items
    quantity: int = Field(default=1, ge=1)


class SetQuantityRequest(BaseModel):
    line_item_id: int
    # H5: quantity >= 0; sending 0 removes the line item
    quantity: int = Field(ge=0)


class ApplyCouponRequest(BaseModel):
    coupon_code: str


class CheckoutUpdateRequest(BaseModel):
    email: str | None = None
    ship_address: dict | None = None
    bill_address: dict | None = None
    payment_method_id: int | None = None
    shipment_id: int | None = None
