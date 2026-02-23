import os

from ddtrace import config

config.env = os.environ.get("DD_ENV", "development")
config.service = os.environ.get("DD_SERVICE", "store-catalog")
config.version = os.environ.get("DD_VERSION", "1.0.0")
