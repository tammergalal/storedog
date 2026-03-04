import os
import random

from ddtrace import patch, tracer
from flask import jsonify, send_from_directory
from flask import request as flask_request
from flask_cors import CORS

from sqlalchemy import text
from bootstrap import create_app
from targeting_middleware import register_middleware
from logging_utils import setup_logger
from models import Advertisement, db

patch(logging=True)

logger = setup_logger('store-ads')

app = create_app()
CORS(app)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

register_middleware(app)


@app.route('/health')
def health():
    try:
        db.session.execute(text('SELECT 1'))
        db_connected = True
    except Exception:
        db_connected = False
    return jsonify({
        'service': os.getenv('DD_SERVICE', 'store-ads'),
        'version': os.getenv('DD_VERSION', '1.0.0'),
        'dd_trace_enabled': True,
        'db_connected': db_connected,
    })


@tracer.wrap()
@app.route('/')
def hello():
    logger.info("home url for ads called")
    return jsonify({'Hello from Advertisements!': 'world'})


@tracer.wrap()
@app.route('/banners/<path:banner>')
def banner_image(banner):
    logger.info(f"attempting to grab banner at {banner}")
    return send_from_directory('ads', banner)


@tracer.wrap()
@app.route('/weighted-banners/<float:weight>')
def weighted_image(weight):
    logger.info(f"attempting to grab banner weight of less than {weight}")
    advertisements = Advertisement.query.all()
    for ad in advertisements:
        if ad.weight < weight:
            return jsonify(ad.serialize())
    return jsonify({'error': 'No advertisement found for weight'}), 404


@tracer.wrap()
@app.route('/ads', methods=['GET', 'POST'])
def status():
    if flask_request.method == 'GET':

        # determine if should throw error and save to variable
        throw_error = False
        if 'X-Throw-Error' in flask_request.headers and flask_request.headers['X-Throw-Error'] == 'true':
            throw_error = True

        # fetch error rate from header if present (0 - 1)
        error_rate = 1
        if 'X-Error-Rate' in flask_request.headers:
            error_rate = float(flask_request.headers['X-Error-Rate'])

        if throw_error and random.random() < error_rate:
            try:
                raise ValueError('something went wrong')
            except ValueError:
                logger.error('Request failed', exc_info=True)

            return jsonify({'error': 'Internal Server Error'}), 500

        else:

            try:
                advertisements = Advertisement.query.all()
                logger.info(
                    f"Total advertisements available: {len(advertisements)}")
                return jsonify([b.serialize() for b in advertisements])

            except Exception:
                logger.error("An error occurred while getting ad.")
                return jsonify({'error': 'Internal Server Error'}), 500

    elif flask_request.method == 'POST':

        try:
            # create a new advertisement with random name and value
            advertisements_count = db.session.query(Advertisement).count()
            new_advertisement = Advertisement('Advertisement ' + str(advertisements_count + 1),
                                              '/',
                                              random.randint(10, 500))
            logger.info(f"Adding advertisement {new_advertisement}")
            db.session.add(new_advertisement)
            db.session.commit()
            advertisements = Advertisement.query.all()

            return jsonify([b.serialize() for b in advertisements])

        except Exception:
            logger.error("An error occurred while creating a new ad.")
            return jsonify({'error': 'Internal Server Error'}), 500

    else:
        return jsonify({'error': 'Invalid request method'}), 405
