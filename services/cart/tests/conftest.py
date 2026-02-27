import sys
import pytest

# The cart service targets Python 3.11 (see services/cart/Dockerfile).
# Tests in this directory require Python 3.10+ for the X | None union syntax
# used in schemas.py. When running locally on Python < 3.10, tests are skipped
# with a clear message. Run them inside Docker for full coverage:
#   docker compose run --rm store-cart python -m pytest tests/
if sys.version_info < (3, 10):
    collect_ignore_glob = ["test_add_item_pricing.py"]

    def pytest_configure(config):
        config.addinivalue_line(
            "markers",
            "requires_python310: mark test as requiring Python 3.10+",
        )
