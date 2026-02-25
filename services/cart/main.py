import bootstrap  # noqa: F401 — must be first for dd-trace

import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone

import httpx
from ddtrace import tracer
from ddtrace.propagation.http import HTTPPropagator
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from cart_utils import order_to_dict, recalculate_order
from database import Base, engine, ensure_schema, get_db
from models import LineItem, Order
from promotions import apply_coupon
from schemas import (
    AddItemRequest,
    ApplyCouponRequest,
    CartSchema,
    CheckoutUpdateRequest,
    SetQuantityRequest,
)

CATALOG_URL = os.environ.get("CATALOG_URL", "http://localhost:8000")


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_schema()
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="Store Cart", lifespan=lifespan)


def _get_order(token: str, db: Session) -> Order:
    order = db.query(Order).filter(Order.token == token).first()
    if not order:
        raise HTTPException(status_code=404, detail="Cart not found")
    return order


def _require_token(x_spree_order_token: str | None) -> str:
    if not x_spree_order_token:
        raise HTTPException(status_code=401, detail="Missing X-Spree-Order-Token")
    return x_spree_order_token


# --- Health ---


@app.get("/health")
def health(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {"service": "store-cart", "status": "ok"}
    except Exception:
        return JSONResponse(
            status_code=503,
            content={"service": "store-cart", "status": "degraded"},
        )


# --- Cart ---


@app.post("/cart")
def create_cart(db: Session = Depends(get_db)):
    order = Order()
    db.add(order)
    db.commit()
    db.refresh(order)
    return order_to_dict(order)


@app.get("/cart", response_model=CartSchema)
def get_cart(
    x_spree_order_token: str | None = Header(None),
    db: Session = Depends(get_db),
):
    token = _require_token(x_spree_order_token)
    order = _get_order(token, db)
    return order_to_dict(order)


@app.delete("/cart")
def delete_cart(
    x_spree_order_token: str | None = Header(None),
    db: Session = Depends(get_db),
):
    token = _require_token(x_spree_order_token)
    order = _get_order(token, db)
    db.delete(order)
    db.commit()
    return {"message": "Cart deleted"}


@app.patch("/cart/empty", response_model=CartSchema)
def empty_cart(
    x_spree_order_token: str | None = Header(None),
    db: Session = Depends(get_db),
):
    token = _require_token(x_spree_order_token)
    order = _get_order(token, db)
    db.query(LineItem).filter(LineItem.order_id == order.id).delete()
    order.item_count = 0
    order.subtotal = 0
    order.discount_amount = 0
    order.discount_code = None  # H3: clear discount code when emptying cart
    order.total = float(order.ship_total)
    db.commit()
    db.refresh(order)
    return order_to_dict(order)


@app.post("/cart/add_item", response_model=CartSchema)
async def add_item(
    body: AddItemRequest,
    x_spree_order_token: str | None = Header(None),
    db: Session = Depends(get_db),
):
    token = _require_token(x_spree_order_token)
    order = _get_order(token, db)

    # H2: inject Datadog trace context for distributed tracing
    prop_headers: dict = {}
    ctx = tracer.current_trace_context()
    if ctx:
        HTTPPropagator.inject(ctx, prop_headers)

    # H1: fetch all products to find the variant.
    # TODO: replace with a direct GET /variants/{id} endpoint once catalog supports it.
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{CATALOG_URL}/products",
                params={"per_page": 100},
                headers=prop_headers,
                timeout=5.0,
            )
        if resp.status_code != 200:
            raise HTTPException(status_code=503, detail="Catalog service unavailable")
        data = resp.json()
    except httpx.RequestError:
        raise HTTPException(status_code=503, detail="Catalog service unavailable")

    # Find the variant across all products
    variant_data = None
    product_data = None
    for p in data["products"]:
        for v in p["variants"]:
            if v["id"] == body.variant_id:
                variant_data = v
                product_data = p
                break
        if variant_data:
            break

    if not variant_data:
        raise HTTPException(
            status_code=404,
            detail=(
                f"Variant {body.variant_id} not found in catalog "
                f"(searched {len(data['products'])} products)"
            ),
        )

    # C2: use SELECT FOR UPDATE to prevent race conditions on concurrent add_item
    existing = db.query(LineItem).filter(
        LineItem.order_id == order.id,
        LineItem.variant_id == body.variant_id,
    ).with_for_update().first()

    if existing:
        existing.quantity += body.quantity
    else:
        name = product_data["name"]
        if variant_data.get("options_text"):
            name += f" ({variant_data['options_text']})"

        image_url = variant_data.get("image_url")
        if not image_url and product_data.get("images"):
            image_url = product_data["images"][0].get("url")

        li = LineItem(
            order_id=order.id,
            product_id=product_data["id"],
            variant_id=body.variant_id,
            quantity=body.quantity,
            price=variant_data["price"],
            name=name,
            slug=product_data.get("slug"),
            image_url=image_url,
        )
        db.add(li)
        db.flush()  # C3: flush so the new row is visible to recalculate_order

    recalculate_order(order, db)
    db.commit()
    db.refresh(order)

    span = tracer.current_span()
    if span:
        span.set_tag("cart.variant_id", body.variant_id)
        span.set_tag("cart.product.name", product_data.get("name", ""))
        span.set_tag("cart.item.price", float(variant_data.get("price", 0)))
        span.set_tag("cart.total", float(order.total))
        span.set_tag("cart.item_count", order.item_count)

    return order_to_dict(order)


@app.delete("/cart/remove_line_item/{line_item_id}", response_model=CartSchema)
def remove_line_item(
    line_item_id: int,
    x_spree_order_token: str | None = Header(None),
    db: Session = Depends(get_db),
):
    token = _require_token(x_spree_order_token)
    order = _get_order(token, db)
    li = db.query(LineItem).filter(
        LineItem.id == line_item_id,
        LineItem.order_id == order.id,
    ).first()
    if not li:
        raise HTTPException(status_code=404, detail="Line item not found")
    db.delete(li)
    db.flush()  # ensure deleted item is excluded from recalculate query
    recalculate_order(order, db)
    db.commit()
    db.refresh(order)
    return order_to_dict(order)


@app.patch("/cart/set_quantity", response_model=CartSchema)
def set_quantity(
    body: SetQuantityRequest,
    x_spree_order_token: str | None = Header(None),
    db: Session = Depends(get_db),
):
    token = _require_token(x_spree_order_token)
    order = _get_order(token, db)
    li = db.query(LineItem).filter(
        LineItem.id == body.line_item_id,
        LineItem.order_id == order.id,
    ).first()
    if not li:
        raise HTTPException(status_code=404, detail="Line item not found")
    if body.quantity <= 0:
        db.delete(li)
    else:
        li.quantity = body.quantity
    db.flush()  # ensure delete/update is visible to recalculate query
    recalculate_order(order, db)
    db.commit()
    db.refresh(order)
    return order_to_dict(order)


@app.patch("/cart/apply_coupon_code", response_model=CartSchema)
async def apply_coupon_code(
    body: ApplyCouponRequest,
    x_spree_order_token: str | None = Header(None),
    db: Session = Depends(get_db),
):
    token = _require_token(x_spree_order_token)
    order = _get_order(token, db)
    span = tracer.current_span()
    if span:
        span.set_tag("discount.code", body.coupon_code)
    order = await apply_coupon(order, body.coupon_code, db)
    if span:
        span.set_tag("cart.discount_amount", float(order.discount_amount))
        span.set_tag("cart.total", float(order.total))
    return order_to_dict(order)


# --- Checkout ---


@app.get("/checkout/payment_methods")
def payment_methods():
    return {"payment_methods": [{"id": 1, "name": "Credit Card"}]}


@app.get("/checkout/shipping_rates")
def shipping_rates(x_spree_order_token: str | None = Header(None)):
    return {"shipping_rates": [{"id": 1, "name": "Standard Shipping", "cost": 0.00}]}


STATE_MACHINE = {
    "cart": "address",
    "address": "delivery",
    "delivery": "payment",
    "payment": "complete",
}


@app.patch("/checkout", response_model=CartSchema)
def update_checkout(
    body: CheckoutUpdateRequest,
    x_spree_order_token: str | None = Header(None),
    db: Session = Depends(get_db),
):
    token = _require_token(x_spree_order_token)
    order = _get_order(token, db)

    if body.email is not None:
        order.email = body.email
    if body.ship_address is not None:
        order.ship_address = body.ship_address
    if body.bill_address is not None:
        order.bill_address = body.bill_address
    if body.payment_method_id is not None:
        order.payment_method_id = body.payment_method_id

    # H4: validate required fields before advancing state
    if order.state == "cart" and not order.email:
        raise HTTPException(422, "Email required to advance to address state")
    if order.state == "address" and not order.ship_address:
        raise HTTPException(422, "Shipping address required to advance to delivery state")
    if order.state == "delivery" and not order.payment_method_id:
        raise HTTPException(422, "Payment method required to advance to payment state")

    # Advance state
    if order.state in STATE_MACHINE:
        order.state = STATE_MACHINE[order.state]

    db.commit()
    db.refresh(order)
    return order_to_dict(order)


@app.patch("/checkout/complete", response_model=CartSchema)
def checkout_complete(
    x_spree_order_token: str | None = Header(None),
    db: Session = Depends(get_db),
):
    token = _require_token(x_spree_order_token)
    order = _get_order(token, db)

    # C1: guard — only orders in "payment" state can be completed
    if order.state != "payment":
        raise HTTPException(
            status_code=422,
            detail="Order must be in 'payment' state to complete checkout",
        )

    order.state = "complete"
    order.completed_at = datetime.now(timezone.utc)  # H10: utcnow() is deprecated
    db.commit()
    db.refresh(order)

    # Datadog span tags
    span = tracer.current_span()
    if span:
        span.set_tag("order.id", str(order.id))
        span.set_tag("cart.total", float(order.total))
        span.set_tag("cart.item_count", order.item_count)

    return order_to_dict(order)
