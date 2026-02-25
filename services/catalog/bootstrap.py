import logging
import os
import sys

import json_log_formatter
from ddtrace import config

config.env = os.environ.get("DD_ENV", "development")
config.service = os.environ.get("DD_SERVICE", "store-catalog")
config.version = os.environ.get("DD_VERSION", "1.0.0")

# JSON structured logging — enables trace correlation via DD_LOGS_INJECTION=true
_handler = logging.StreamHandler(sys.stdout)
_handler.setFormatter(json_log_formatter.VerboseJSONFormatter())
logging.basicConfig(handlers=[_handler], level=logging.INFO, force=True)
