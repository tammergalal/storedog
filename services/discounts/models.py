from flask_sqlalchemy import SQLAlchemy
import datetime

db = SQLAlchemy()

class Influencer(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(128))
    discount_types = db.relationship("DiscountType", backref="influencer", lazy=True)
    
    def __init__(self, name):
        self.name = name

    def serialize(self):
        return {
            'id': self.id,
            'name': self.name,
            'discounts': len(self.discount_types)
        }

class DiscountType(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(128))
    influencer_id = db.Column(db.Integer, db.ForeignKey('influencer.id'), nullable=True)
    discount_query = db.Column(db.String(128))
    discounts = db.relationship('Discount', backref='discount_type', lazy=True)

    def __init__(self, name, discount_query, influencer):
        self.name = name
        self.discount_query = discount_query
        self.influencer = influencer

    def serialize(self):
        return {
            'id': self.id,
            'name': self.name,
            'discount_query': self.discount_query
        }
    

class Discount(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(128))
    code = db.Column(db.String(64), index=True)
    value = db.Column(db.Integer)
    discount_type_id = db.Column(db.Integer, db.ForeignKey('discount_type.id'), nullable=False)
    tier = db.Column(db.String(32), nullable=True)
    referral_source = db.Column(db.String(128), nullable=True)
    start_time = db.Column(db.DateTime, nullable=True)
    end_time = db.Column(db.DateTime, nullable=True)

    def __init__(self, name, code, value, discount_type, tier=None, referral_source=None, start_time=None, end_time=None):
        self.name = name
        self.code = code
        self.value = value
        self.discount_type = discount_type
        self.tier = tier
        self.referral_source = referral_source
        self.start_time = start_time
        self.end_time = end_time

    def serialize(self):
        return {
            'id': self.id,
            'name': self.name,
            'code': self.code,
            'value': self.value,
            'tier': self.tier,
            'referral_source': self.referral_source,
            'discount_type': self.discount_type.serialize(),
            'start_time': self.start_time.isoformat() if self.start_time else None,
            'end_time': self.end_time.isoformat() if self.end_time else None,
        }


class DiscountUsage(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    discount_id = db.Column(db.Integer, db.ForeignKey('discount.id'), nullable=False)
    order_number = db.Column(db.String(64))
    used_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
