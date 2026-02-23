import datetime
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import names
import words
from flask import Flask
from models import Discount, DiscountType, DiscountUsage, Influencer, db

DB_USERNAME = os.environ['POSTGRES_USER']
DB_PASSWORD = os.environ['POSTGRES_PASSWORD']
DB_HOST = os.environ['POSTGRES_HOST']


def create_app():
    """Create a Flask application"""
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = (
        f'postgresql://{DB_USERNAME}:{DB_PASSWORD}@{DB_HOST}/{DB_USERNAME}'
    )
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    db.init_app(app)
    initialize_database(app, db)
    return app


def initialize_database(app, db):
    """Drop and restore database in a consistent state"""
    with app.app_context():
        # INTENTIONAL: drop_all ensures a clean, reproducible demo state on every restart.
        db.drop_all()
        db.create_all()

        influencer_discounts = []
        for _ in range(100):
            influencer = Influencer(names.get_full_name())
            discount_type = DiscountType(words.get_random(),
                                         'price * %f' % random.random(),
                                         influencer)
            discount_name = words.get_random(random.randint(2, 4))
            discount = Discount(discount_name,
                                words.get_random().upper(),
                                random.randrange(1, 100) * random.random(),
                                discount_type,
                                referral_source=influencer.name)
            db.session.add(discount)
            influencer_discounts.append(discount)

        first_discount_type = DiscountType('Save with Sherry',
                                           'price * .8',
                                           Influencer('Sherry'))
        second_discount_type = DiscountType('Sunday Savings',
                                            'price * .9',
                                            None)
        third_discount_type = DiscountType('Monday Funday',
                                           'price * .95',
                                           None)
        first_discount = Discount('Black Friday',
                                  'BFRIDAY',
                                  5.1,
                                  first_discount_type)

        second_discount = Discount('SWEET SUNDAY',
                                   'OFF',
                                   300.1,
                                   second_discount_type)
        third_discount = Discount('Monday Funday',
                                  'PARTY',
                                  542.1,
                                  third_discount_type)
        db.session.add(first_discount)
        db.session.add(second_discount)
        db.session.add(third_discount)

        # Tiered discount codes matching Spree promotions
        bronze_type = DiscountType('Bronze Tier', 'price * .90', None)
        silver_type = DiscountType('Silver Tier', 'price * .80', None)
        gold_type = DiscountType('Gold Tier', 'price * .70', None)
        freeship_type = DiscountType('Free Shipping', 'shipping * 0', None)

        db.session.add(Discount('Bronze 10% Off', 'BRONZE10', 10, bronze_type, tier='bronze'))
        db.session.add(Discount('Silver 20% Off', 'SILVER20', 20, silver_type, tier='silver'))
        db.session.add(Discount('Gold 30% Off', 'GOLD30', 30, gold_type, tier='gold'))
        db.session.add(Discount('Free Shipping', 'FREESHIP', 0, freeship_type, tier='free_shipping'))

        # Flash sale discounts
        now = datetime.datetime.utcnow()
        flash_type = DiscountType('Flash Sale', 'price * .80', None)
        db.session.add(Discount(
            'Flash 20% Off', 'FLASH20', 20, flash_type, tier='flash',
            start_time=now - datetime.timedelta(hours=1),
            end_time=now + datetime.timedelta(hours=2),
        ))
        expired_flash_type = DiscountType('Expired Flash Sale', 'price * .90', None)
        db.session.add(Discount(
            'Flash 10% Off', 'FLASH10', 10, expired_flash_type, tier='flash',
            start_time=now - datetime.timedelta(hours=48),
            end_time=now - datetime.timedelta(hours=24),
        ))

        db.session.commit()

        # Seed DiscountUsage rows for DBM-meaningful JOIN query volume
        for _ in range(500):
            usage = DiscountUsage(
                discount_id=random.choice(influencer_discounts).id,
                order_number='ORD-' + str(random.randint(100000, 999999))
            )
            db.session.add(usage)
        db.session.commit()
