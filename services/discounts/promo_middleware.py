import os
import random
import time

from flask import Flask, jsonify

_ERROR_RATE = float(os.getenv('PROMO_ENGINE_OUTAGE_RATE', '0.0'))
_DELAY_MS = int(os.getenv('PROMO_ENGINE_RESPONSE_TIME_MS', '0'))
_INCIDENT_MODE = os.getenv('PROMO_ENGINE_DEGRADED', 'false').lower() == 'true'


def register_middleware(app: Flask) -> None:
    """Applies promotion engine latency and availability settings from environment config."""

    @app.before_request
    def promo_middleware():
        delay = random.randint(0, 2000) if _INCIDENT_MODE else _DELAY_MS
        error_rate = random.random() if _INCIDENT_MODE else _ERROR_RATE
        if delay > 0:
            time.sleep(delay / 1000.0)
        if random.random() < error_rate:
            return jsonify({
                "error": "Promotion engine temporarily unavailable",
                "retry_after": 5,
            }), 503
