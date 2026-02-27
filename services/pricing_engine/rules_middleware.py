import asyncio
import os
import random

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

_ERROR_RATE = float(os.getenv('PRICING_RULES_FETCH_FAILURE_RATE', '0.0'))
_DELAY_MS = int(os.getenv('PRICING_RULES_DB_LATENCY_MS', '0'))
_INCIDENT_MODE = os.getenv('PRICING_ENGINE_DEGRADED', 'false').lower() == 'true'


def register_middleware(app: FastAPI) -> None:
    """Applies pricing rules fetch latency and availability settings from environment config."""

    @app.middleware("http")
    async def rules_middleware(request: Request, call_next):
        if request.url.path == "/health":
            return await call_next(request)

        delay = random.randint(0, 2000) if _INCIDENT_MODE else _DELAY_MS
        error_rate = random.random() if _INCIDENT_MODE else _ERROR_RATE

        if delay > 0:
            await asyncio.sleep(delay / 1000.0)

        if random.random() < error_rate:
            return JSONResponse(
                status_code=503,
                content={
                    "detail": "Pricing rules service degraded: rule evaluation currently unavailable."
                },
            )

        return await call_next(request)
