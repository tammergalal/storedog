from sqlalchemy import (
    CheckConstraint,
    Column,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    DateTime,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from database import Base


class Order(Base):
    __tablename__ = "orders"
    __table_args__ = (
        UniqueConstraint("token", name="uq_orders_token"),
        Index("ix_orders_state", "state"),
        CheckConstraint("total >= 0", name="ck_orders_total_positive"),
        {"schema": "cart"},
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    token = Column(UUID(as_uuid=True), nullable=False, server_default=text("gen_random_uuid()"))
    # H14: add server_default so DB-level inserts also get sane defaults
    state = Column(String(50), default="cart", server_default="cart")
    email = Column(String(255))
    subtotal = Column(Numeric(10, 2), default=0, server_default=text("0"))
    discount_amount = Column(Numeric(10, 2), default=0, server_default=text("0"))
    discount_code = Column(String(64))
    ship_total = Column(Numeric(10, 2), default=0, server_default=text("0"))
    total = Column(Numeric(10, 2), default=0, server_default=text("0"))
    currency = Column(String(3), default="USD", server_default="USD")
    item_count = Column(Integer, default=0, server_default=text("0"))
    ship_address = Column(JSONB)
    bill_address = Column(JSONB)
    payment_method_id = Column(Integer)
    created_at = Column(DateTime, server_default=func.now())
    completed_at = Column(DateTime, nullable=True)

    line_items = relationship("LineItem", back_populates="order", cascade="all, delete-orphan")


class LineItem(Base):
    __tablename__ = "line_items"
    __table_args__ = (
        Index("ix_line_items_order_id", "order_id"),
        CheckConstraint("quantity > 0", name="ck_line_items_quantity_positive"),
        CheckConstraint("price >= 0", name="ck_line_items_price_positive"),
        # C2: unique constraint prevents duplicate line items on concurrent add_item
        UniqueConstraint("order_id", "variant_id", name="uq_line_items_order_variant"),
        {"schema": "cart"},
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(Integer, ForeignKey("cart.orders.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(Integer, nullable=False)
    variant_id = Column(Integer, nullable=False)
    quantity = Column(Integer, nullable=False, default=1)
    price = Column(Numeric(10, 2), nullable=False)
    name = Column(String(255), nullable=False)
    slug = Column(String(255))
    image_url = Column(String(500))

    order = relationship("Order", back_populates="line_items")
