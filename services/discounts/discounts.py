import datetime
import os
import random
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import redis as redis_lib
from ddtrace import patch, tracer
from flask import jsonify
from flask import request as flask_request
from flask_cors import CORS

from bootstrap import create_app
from chaos import register_chaos_middleware
from logging_utils import setup_logger
from sqlalchemy import text
from models import Discount, DiscountType, Influencer, db
import words

patch(logging=True)

logger = setup_logger('store-discounts')

# get the BROKEN_DISCOUNTS environment variable, if it exists
BROKEN_DISCOUNTS = os.getenv("BROKEN_DISCOUNTS")

app = create_app()
CORS(app)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

register_chaos_middleware(app)

# NOTE: This cache is not thread-safe under multi-threaded Flask workers.
# For production use, replace with Redis-based caching.
_flash_cache = {'data': None, 'expires': 0}

_redis_host = os.getenv('REDIS_HOST', 'redis')
_redis_port = int(os.getenv('REDIS_PORT', '6379'))
_redis_client = redis_lib.Redis(
    host=_redis_host,
    port=_redis_port,
    socket_connect_timeout=1,
    socket_timeout=1
)


def check_rate_limit(client_ip: str) -> tuple:
    """Returns (is_limited, retry_after_seconds). Fails open on Redis errors."""
    try:
        key = f'discount:ratelimit:{client_ip}'
        count = _redis_client.incr(key)
        if count == 1:
            _redis_client.expire(key, 60)
        if count > 5:
            ttl = _redis_client.ttl(key)
            return True, max(ttl, 1)
    except Exception:
        logger.warning('Redis unavailable for rate limiting — failing open')
    return False, 0


@app.route('/')
def hello():
    return jsonify({'Hello from Discounts!': 'world'})


@app.route('/health')
def health():
    try:
        db.session.execute(text('SELECT 1'))
        db_connected = True
    except Exception:
        db_connected = False
    return jsonify({
        'service': os.getenv('DD_SERVICE', 'store-discounts'),
        'version': os.getenv('DD_VERSION', '1.0.0'),
        'dd_trace_enabled': True,
        'db_connected': db_connected,
    })


@app.route('/discount', methods=['GET', 'POST'])
def status():
    if flask_request.method == 'GET':

        try:
            discounts = Discount.query.all()
            logger.info(f"Discounts available: {len(discounts)}")

            influencer_count = sum(
                1 for d in discounts if d.discount_type.influencer
            )
            logger.info(
                f"Total of {influencer_count} influencer specific discounts as of this request")

            return jsonify([b.serialize() for b in discounts])

        except Exception:
            logger.error("An error occurred while getting discounts.")
            return jsonify({'error': 'Internal Server Error'}), 500

    elif flask_request.method == 'POST':

        try:
            # create a new discount with random name and value
            discounts_count = db.session.query(Discount).count()
            new_discount_type = DiscountType('Random Savings',
                                             'price * .9',
                                             None)
            new_discount = Discount('Discount ' + str(discounts_count + 1),
                                    words.get_random(random.randint(2, 4)),
                                    random.randint(10, 500),
                                    new_discount_type)
            logger.info(f"Adding discount {new_discount}")
            db.session.add(new_discount)
            db.session.commit()
            discounts = Discount.query.all()

            return jsonify([b.serialize() for b in discounts])

        except Exception:
            logger.error("An error occurred while creating a new discount.")
            return jsonify({'error': 'Internal Server Error'}), 500

    else:
        return jsonify({'error': 'Invalid request method'}), 405


@app.route("/discount-code", methods=["GET"])
def getDiscount():
    try:
        # Get the discount code from the query string
        discount_code = flask_request.args.get("discount_code")
        logger.info(f"Discount code: {discount_code}")
        discount = Discount.query.filter_by(code=discount_code).first()

        # Broken discounts feature flag is ENABLED, randomly error out
        if BROKEN_DISCOUNTS == "ENABLED" and random.choice([True, False]):
            raise Exception("Discount service error")

        if discount:
            response = discount.serialize()
            response.update({"status": 1})

            if discount.tier:
                response['tier'] = discount.tier
                response['discount_value'] = discount.value
                response['discount_type_label'] = 'shipping' if discount.tier == 'free_shipping' else 'percent'

            span = tracer.current_span()
            if span and discount.tier:
                span.set_tag('discount.tier', discount.tier)
                span.set_tag('discount.value', discount.value)

            return jsonify(response)

        # Rate-limit on invalid codes only (not valid lookups)
        client_ip = flask_request.environ.get(
            'HTTP_X_FORWARDED_FOR', flask_request.remote_addr or 'unknown'
        ).split(',')[0].strip()
        is_limited, retry_after = check_rate_limit(client_ip)
        if is_limited:
            logger.warning('Rate limit exceeded', extra={
                'discount_code': discount_code, 'client_ip': client_ip
            })
            resp = jsonify({'error': 'Too many requests', 'retry_after': retry_after})
            resp.status_code = 429
            resp.headers['Retry-After'] = str(retry_after)
            return resp

        return jsonify({"error": "Discount not found", "status": 0}), 404

    except Exception as e:
        logger.error("Unexpected error in getDiscount", exc_info=True)
        return jsonify({'error': 'Internal Server Error'}), 500


@app.route('/referral', methods=['GET'])
def get_referral():
    ref = flask_request.args.get('ref', '')
    try:
        discounts = Discount.query.join(DiscountType).join(Influencer).filter(
            Influencer.name.ilike(f'%{ref}%')
        ).all()
        logger.info(f"Referral lookup for '{ref}': {len(discounts)} matches")
        return jsonify([d.serialize() for d in discounts])
    except Exception:
        logger.error("An error occurred during referral lookup.", exc_info=True)
        return jsonify({'error': 'Internal Server Error'}), 500


@app.route('/flash-sale', methods=['GET'])
def flash_sale():
    now_ts = time.time()
    if _flash_cache['data'] is not None and now_ts < _flash_cache['expires']:
        return jsonify(_flash_cache['data'])

    try:
        now = datetime.datetime.utcnow()
        sale = Discount.query.filter(
            Discount.start_time <= now,
            Discount.end_time >= now,
        ).first()

        if sale:
            result = sale.serialize()
            result['active'] = True
        else:
            result = {'active': False}

        _flash_cache['data'] = result
        _flash_cache['expires'] = now_ts + 60
        return jsonify(result)
    except Exception:
        logger.error("An error occurred while checking flash sales.", exc_info=True)
        return jsonify({'error': 'Internal Server Error'}), 500
