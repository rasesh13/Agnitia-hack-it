import json
import logging

import pytest
from pydantic import ValidationError

from backend.config import Settings
from backend.core.logging import StructuredJsonFormatter


def test_default_development_settings():
    """Verify default settings initialize cleanly in development mode."""
    settings = Settings()
    assert settings.ENVIRONMENT == "development"
    assert settings.COST_WEIGHT + settings.CARBON_WEIGHT == pytest.approx(1.0)
    assert settings.ALERT_CRITICAL_BATTERY_SOC < settings.ALERT_LOW_BATTERY_SOC
    assert settings.BATTERY_MIN_SOC < settings.BATTERY_MAX_SOC
    assert settings.ALERT_RESERVE_FLOOR_PERCENT >= settings.BATTERY_MIN_SOC


def test_cors_origins_parsing_from_string():
    """Verify comma-separated CORS origins string parses into a list."""
    settings = Settings(CORS_ORIGINS="http://example.com, https://app.example.com")
    assert settings.CORS_ORIGINS == ["http://example.com", "https://app.example.com"]


def test_invalid_optimization_weights():
    """Verify settings reject weights that do not sum to 1.0."""
    with pytest.raises(ValidationError) as exc_info:
        Settings(COST_WEIGHT=0.7, CARBON_WEIGHT=0.5)
    assert "must sum to 1.0" in str(exc_info.value)


def test_invalid_battery_soc_threshold_ordering():
    """Verify critical battery SoC must be strictly below low battery SoC."""
    with pytest.raises(ValidationError) as exc_info:
        Settings(ALERT_CRITICAL_BATTERY_SOC=30.0, ALERT_LOW_BATTERY_SOC=20.0)
    assert "ALERT_CRITICAL_BATTERY_SOC" in str(exc_info.value)


def test_invalid_battery_min_max_soc():
    """Verify battery min SoC must be strictly below max SoC."""
    with pytest.raises(ValidationError) as exc_info:
        Settings(BATTERY_MIN_SOC=90.0, BATTERY_MAX_SOC=80.0)
    assert "BATTERY_MIN_SOC" in str(exc_info.value)


def test_invalid_reserve_floor_below_min_soc():
    """Verify reserve floor cannot be below minimum battery SoC."""
    with pytest.raises(ValidationError) as exc_info:
        Settings(BATTERY_MIN_SOC=25.0, ALERT_RESERVE_FLOOR_PERCENT=15.0)
    assert "ALERT_RESERVE_FLOOR_PERCENT" in str(exc_info.value)


def test_invalid_telemetry_interval_ordering():
    """Verify staleness and failure timeout ordering."""
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            TELEMETRY_POLL_INTERVAL_SECONDS=10,
            TELEMETRY_STALE_AFTER_SECONDS=5,
        )
    assert "TELEMETRY_STALE_AFTER_SECONDS" in str(exc_info.value)

    with pytest.raises(ValidationError) as exc_info:
        Settings(
            TELEMETRY_STALE_AFTER_SECONDS=30,
            TELEMETRY_FAILURE_AFTER_SECONDS=20,
        )
    assert "TELEMETRY_FAILURE_AFTER_SECONDS" in str(exc_info.value)


def test_production_mode_rejects_wildcard_cors():
    """Production mode must forbid wildcard CORS."""
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            ENVIRONMENT="production",
            CORS_ORIGINS=["*"],
            JWT_SECRET_KEY="a_very_strong_random_secret_key_exceeding_32_characters",
            ADAPTER_TYPE="rest",
        )
    assert "wildcard '*'" in str(exc_info.value)


def test_production_mode_rejects_weak_jwt_secret():
    """Production mode must reject default or short JWT secrets."""
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            ENVIRONMENT="production",
            CORS_ORIGINS=["https://dashboard.example.com"],
            JWT_SECRET_KEY="short_key",
            ADAPTER_TYPE="rest",
        )
    assert "JWT_SECRET_KEY must be a secure random string" in str(exc_info.value)

    with pytest.raises(ValidationError) as exc_info:
        Settings(
            ENVIRONMENT="production",
            CORS_ORIGINS=["https://dashboard.example.com"],
            JWT_SECRET_KEY="dev_secret_key_change_in_production_min_32_chars_long",
            ADAPTER_TYPE="rest",
        )
    assert "JWT_SECRET_KEY must be a secure random string" in str(exc_info.value)


def test_production_mode_rejects_test_adapter():
    """Production mode must forbid test/stub adapters."""
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            ENVIRONMENT="production",
            CORS_ORIGINS=["https://dashboard.example.com"],
            JWT_SECRET_KEY="a_very_strong_random_secret_key_exceeding_32_characters",
            ADAPTER_TYPE="in_memory_stub",
        )
    assert "is test-only and forbidden in production" in str(exc_info.value)


def test_valid_production_settings():
    """Valid production settings pass validation successfully."""
    settings = Settings(
        ENVIRONMENT="production",
        CORS_ORIGINS=["https://ops.surya-energy.com"],
        JWT_SECRET_KEY="a_very_strong_random_production_secret_key_32_chars_plus",
        ADAPTER_TYPE="rest",
    )
    assert settings.ENVIRONMENT == "production"
    assert settings.CORS_ORIGINS == ["https://ops.surya-energy.com"]


def test_structured_logging_formatter():
    """Verify structured logging formatter outputs valid JSON with expected fields."""
    formatter = StructuredJsonFormatter()
    record = logging.LogRecord(
        name="surya.test",
        level=logging.INFO,
        pathname=__file__,
        lineno=10,
        msg="Optimization cycle initiated",
        args=(),
        exc_info=None,
    )
    record.request_id = "req-12345"
    record.cycle_id = "cycle-99"

    formatted = formatter.format(record)
    parsed = json.loads(formatted)

    assert parsed["level"] == "INFO"
    assert parsed["service"] == "surya-backend"
    assert parsed["message"] == "Optimization cycle initiated"
    assert parsed["request_id"] == "req-12345"
    assert parsed["cycle_id"] == "cycle-99"
    assert "timestamp" in parsed
