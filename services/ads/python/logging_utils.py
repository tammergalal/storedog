import logging
import re
import sys

import json_log_formatter


class NoEscape(logging.Filter):
    """Strip ANSI escape sequences from log records."""

    def __init__(self):
        self.regex = re.compile(r'(\x9B|\x1B\[)[0-?]*[ -\/]*[@-~]')

    def strip_esc(self, s):
        try:  # string-like
            return self.regex.sub('', s)
        except Exception:  # non-string-like
            return s

    def filter(self, record):
        record.msg = self.strip_esc(record.msg)
        if isinstance(record.args, tuple):
            record.args = tuple(map(self.strip_esc, record.args))
        return 1


def setup_logger(name: str) -> logging.Logger:
    """Create and return a JSON logger with ANSI escape filtering."""
    formatter = json_log_formatter.VerboseJSONFormatter()
    json_handler = logging.StreamHandler(sys.stdout)
    json_handler.setFormatter(formatter)
    logger = logging.getLogger(name)
    logger.addHandler(json_handler)
    logger.setLevel(logging.DEBUG)
    logger.addFilter(NoEscape())
    return logger
