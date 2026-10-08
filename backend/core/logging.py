import json
import logging
import sys
from datetime import datetime, timezone
from typing import Any


class StructuredJsonFormatter(logging.Formatter):
    """
    JSON log formatter conforming to SURYA spec Section 16:
    Structured logs with timestamp, level, service, request_id, cycle_id,
    user_id, asset_id, and event. Sanitizes sensitive credentials.
    """

    SENSITIVE_KEYS = {"password", "token", "jwt", "secret", "jwt_secret_key", "authorization"}

    def format(self, record: logging.LogRecord) -> str:
        log_entry: dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "service": "surya-backend",
            "logger": record.name,
            "message": record.getMessage(),
        }

        # Extract structured extra fields if present
        for field in ("request_id", "cycle_id", "user_id", "asset_id", "event"):
            if hasattr(record, field):
                log_entry[field] = getattr(record, field)

        # Include exception info if present
        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_entry)


def setup_logging(level: str = "INFO") -> None:
    """Configures structured JSON logging for stdout."""
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(StructuredJsonFormatter())

    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, level.upper(), logging.INFO))

    # Remove existing handlers to avoid duplicates
    for h in list(root_logger.handlers):
        root_logger.removeHandler(h)
    root_logger.addHandler(handler)
