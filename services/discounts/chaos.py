import os
import random
import time

from flask import Flask, jsonify

_ERROR_RATE = float(os.getenv('SERVICE_ERROR_RATE', '0.0'))
_DELAY_MS = int(os.getenv('SERVICE_DELAY_MS', '0'))
_CHAOS_MODE = os.getenv('SERVICE_CHAOS_MODE', 'false').lower() == 'true'


def register_chaos_middleware(app: Flask) -> None:
    """Register a before_request hook that injects latency and errors."""

    @app.before_request
    def chaos_middleware():
        delay = random.randint(0, 2000) if _CHAOS_MODE else _DELAY_MS
        error_rate = random.random() if _CHAOS_MODE else _ERROR_RATE
        if delay > 0:
            time.sleep(delay / 1000.0)
        if random.random() < error_rate:
            return jsonify({"error": "chaos injection"}), 500
