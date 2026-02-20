from sqlalchemy.orm import Session

from models import LineItem, Order


def recalculate_order(order: Order, db: Session) -> None:
    """Recalculate cart totals (item_count, subtotal, total) from line items."""
    items = db.query(LineItem).filter(LineItem.order_id == order.id).all()
    order.item_count = sum(li.quantity for li in items)
    order.subtotal = round(sum(float(li.price) * li.quantity for li in items), 2)
    order.total = max(
        0,
        round(
            float(order.subtotal) - float(order.discount_amount) + float(order.ship_total),
            2,
        ),
    )


def order_to_dict(order: Order) -> dict:
    """Serialize an Order to a response dict with rounded monetary values."""
    return {
        "id": str(order.id),
        "token": str(order.token),
        "state": order.state,
        "email": order.email,
        "currency": order.currency,
        "item_count": order.item_count,
        "subtotal": round(float(order.subtotal), 2),
        "discount_amount": round(float(order.discount_amount), 2),
        "discount_code": order.discount_code,
        "ship_total": round(float(order.ship_total), 2),
        "total": round(float(order.total), 2),
        "line_items": [
            {
                "id": li.id,
                "product_id": li.product_id,
                "variant_id": li.variant_id,
                "quantity": li.quantity,
                "price": round(float(li.price), 2),
                "name": li.name,
                "slug": li.slug,
                "image_url": li.image_url,
            }
            for li in order.line_items
        ],
    }
