import os
import random
import time

from flask import Flask, jsonify

_ERROR_RATE = float(os.getenv('AD_TARGETING_FAILURE_RATE', '0.0'))
_DELAY_MS = int(os.getenv('AD_TARGETING_LATENCY_MS', '0'))
_INCIDENT_MODE = os.getenv('AD_ENGINE_INCIDENT_MODE', 'false').lower() == 'true'


def register_middleware(app: Flask) -> None:
    """Applies ad targeting latency and availability settings from environment config."""

    @app.before_request
    def targeting_middleware():
        delay = random.randint(0, 2000) if _INCIDENT_MODE else _DELAY_MS
        error_rate = random.random() if _INCIDENT_MODE else _ERROR_RATE
        if delay > 0:
            time.sleep(delay / 1000.0)
        if random.random() < error_rate:
            return jsonify({"error": "Ad serving temporarily unavailable"}), 503
