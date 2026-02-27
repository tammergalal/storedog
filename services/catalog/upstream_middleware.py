import asyncio
import os
import random

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

_ERROR_RATE = float(os.getenv('CATALOG_DB_FAILOVER_RATE', '0.0'))
_DELAY_MS = int(os.getenv('CATALOG_IMAGE_CDN_LATENCY_MS', '0'))
_INCIDENT_MODE = os.getenv('CATALOG_INCIDENT_MODE', 'false').lower() == 'true'


def register_middleware(app: FastAPI) -> None:
    """Applies upstream latency and availability settings from environment config."""

    @app.middleware("http")
    async def upstream_middleware(request: Request, call_next):
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
                    "detail": "Upstream dependency unavailable: product data service is experiencing elevated error rates."
                },
            )

        return await call_next(request)
