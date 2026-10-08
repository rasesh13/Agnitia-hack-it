from typing import List, Optional, Union

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    SURYA Central Configuration and Validation conforming to Section 7 of spec.md.
    Loads settings from environment variables and validates bounds, physical invariants,
    and production-mode security requirements.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=True,
    )

    # Server Configuration
    ENVIRONMENT: str = Field(
        "development",
        description="Runtime environment: development, test, staging, production",
    )
    BACKEND_HOST: str = Field("0.0.0.0", description="Backend host address")
    BACKEND_PORT: int = Field(8000, description="Backend listening port")

    # CORS Configuration
    CORS_ORIGINS: Union[List[str], str] = Field(
        default=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
        description="Allowed CORS origin list or comma-separated string",
    )

    # Authentication & Security
    JWT_SECRET_KEY: str = Field(
        "dev_secret_key_change_in_production_min_32_chars_long",
        description="HMAC secret key for JWT signing",
    )
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(
        120, gt=0, description="JWT token validity in minutes"
    )
    GOOGLE_CLIENT_ID: Optional[str] = Field(None, description="Optional Google OAuth Client ID")

    # Database
    DATABASE_URL: str = Field(
        "sqlite+aiosqlite:///./surya_dev.db",
        description="Async database connection string",
    )

    # Telemetry Configuration
    TELEMETRY_POLL_INTERVAL_SECONDS: int = Field(
        5, gt=0, description="Adapter polling cadence in seconds"
    )
    TELEMETRY_STALE_AFTER_SECONDS: int = Field(
        30, gt=0, description="Seconds before measurement is marked stale"
    )
    TELEMETRY_FAILURE_AFTER_SECONDS: int = Field(
        60, gt=0, description="Seconds before asset is marked unavailable"
    )

    # Decision Scheduler
    DECISION_CYCLE_SECONDS: int = Field(
        10, gt=0, description="Optimization loop cycle duration in seconds"
    )
    SCHEDULER_ENABLED: bool = Field(
        True, description="Master toggle for background optimization cycle"
    )

    # Optimization Objective Weights
    COST_WEIGHT: float = Field(
        0.6, ge=0.0, le=1.0, description="Weight of normalized cost in objective"
    )
    CARBON_WEIGHT: float = Field(
        0.4, ge=0.0, le=1.0, description="Weight of normalized carbon in objective"
    )
    GRID_EMISSION_FACTOR_KG_PER_KWH: float = Field(
        0.716, gt=0.0, description="Grid emission factor (kg CO2e / kWh)"
    )

    # Alert Thresholds
    ALERT_LOW_BATTERY_SOC: float = Field(
        25.0, ge=0.0, le=100.0, description="Low battery warning SoC percent"
    )
    ALERT_CRITICAL_BATTERY_SOC: float = Field(
        15.0, ge=0.0, le=100.0, description="Critical battery alert SoC percent"
    )
    ALERT_HIGH_GRID_IMPORT_KW: float = Field(
        450.0, gt=0.0, description="High grid import threshold in kW"
    )
    ALERT_RESERVE_FLOOR_PERCENT: float = Field(
        20.0, ge=0.0, le=100.0, description="Emergency reserve floor SoC %"
    )
    ALERT_DATA_STALENESS_SECONDS: int = Field(
        30, gt=0, description="Telemetry staleness alert threshold"
    )

    # Battery Operational Constraints
    BATTERY_MIN_SOC: float = Field(
        10.0, ge=0.0, le=100.0, description="Minimum allowable battery SoC %"
    )
    BATTERY_MAX_SOC: float = Field(
        95.0, ge=0.0, le=100.0, description="Maximum allowable battery SoC %"
    )
    BATTERY_MAX_CHARGE_RATE_KW: float = Field(
        200.0, gt=0.0, description="Max battery charge rate in kW"
    )
    BATTERY_MAX_DISCHARGE_RATE_KW: float = Field(
        200.0, gt=0.0, description="Max battery discharge rate in kW"
    )
    BATTERY_HEALTH_FLOOR: float = Field(
        70.0, ge=0.0, le=100.0, description="Minimum battery state-of-health %"
    )

    # Grid & Site Configuration
    GRID_IMPORT_TARIFF_PER_KWH: float = Field(
        8.50, ge=0.0, description="Tariff for grid energy import (INR/kWh)"
    )
    GRID_EXPORT_TARIFF_PER_KWH: float = Field(
        3.50, ge=0.0, description="Credit for grid energy export (INR/kWh)"
    )
    CURRENCY: str = Field("INR", description="Financial currency code")
    SITE_TIMEZONE: str = Field("Asia/Kolkata", description="Operational site timezone")

    # Adapter Layer Configuration
    ADAPTER_TYPE: str = Field(
        "rest", description="Active adapter: rest, modbus, mqtt, in_memory_stub"
    )
    ADAPTER_HOST: str = Field("localhost", description="Adapter endpoint hostname or IP")
    ADAPTER_PORT: int = Field(8080, gt=0, le=65535, description="Adapter port")
    ADAPTER_POLL_TIMEOUT_SECONDS: int = Field(
        5, gt=0, description="Read timeout for adapter snapshot"
    )
    CLOSED_LOOP_CONTROL_ENABLED: bool = Field(
        False, description="Whether automated command writes are enabled"
    )

    # Data Retention
    TELEMETRY_RETENTION_DAYS: int = Field(
        90, gt=0, description="Retention duration for interval telemetry"
    )
    DECISION_AUDIT_RETENTION_DAYS: int = Field(
        365, gt=0, description="Retention duration for decision audit trail"
    )

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    def _validate_objective_weights(self) -> None:
        weight_sum = self.COST_WEIGHT + self.CARBON_WEIGHT
        if abs(weight_sum - 1.0) > 1e-4:
            msg = (
                f"COST_WEIGHT ({self.COST_WEIGHT}) + CARBON_WEIGHT ({self.CARBON_WEIGHT}) "
                f"must sum to 1.0, got {weight_sum:.4f}"
            )
            raise ValueError(msg)

    def _validate_thresholds(self) -> None:
        if self.ALERT_CRITICAL_BATTERY_SOC >= self.ALERT_LOW_BATTERY_SOC:
            msg = (
                f"ALERT_CRITICAL_BATTERY_SOC ({self.ALERT_CRITICAL_BATTERY_SOC}) must be "
                f"strictly less than ALERT_LOW_BATTERY_SOC ({self.ALERT_LOW_BATTERY_SOC})"
            )
            raise ValueError(msg)

        if self.BATTERY_MIN_SOC >= self.BATTERY_MAX_SOC:
            msg = (
                f"BATTERY_MIN_SOC ({self.BATTERY_MIN_SOC}) must be strictly less than "
                f"BATTERY_MAX_SOC ({self.BATTERY_MAX_SOC})"
            )
            raise ValueError(msg)

        if self.ALERT_RESERVE_FLOOR_PERCENT < self.BATTERY_MIN_SOC:
            msg = (
                f"ALERT_RESERVE_FLOOR_PERCENT ({self.ALERT_RESERVE_FLOOR_PERCENT}) cannot be "
                f"lower than BATTERY_MIN_SOC ({self.BATTERY_MIN_SOC})"
            )
            raise ValueError(msg)

    def _validate_telemetry_intervals(self) -> None:
        if self.TELEMETRY_STALE_AFTER_SECONDS <= self.TELEMETRY_POLL_INTERVAL_SECONDS:
            msg = (
                f"TELEMETRY_STALE_AFTER_SECONDS ({self.TELEMETRY_STALE_AFTER_SECONDS}) must be "
                f"greater than TELEMETRY_POLL_INTERVAL_SECONDS "
                f"({self.TELEMETRY_POLL_INTERVAL_SECONDS})"
            )
            raise ValueError(msg)

        if self.TELEMETRY_FAILURE_AFTER_SECONDS <= self.TELEMETRY_STALE_AFTER_SECONDS:
            msg = (
                f"TELEMETRY_FAILURE_AFTER_SECONDS ({self.TELEMETRY_FAILURE_AFTER_SECONDS}) must be "
                f"greater than TELEMETRY_STALE_AFTER_SECONDS "
                f"({self.TELEMETRY_STALE_AFTER_SECONDS})"
            )
            raise ValueError(msg)

    def _validate_production_rules(self) -> None:
        if self.ENVIRONMENT != "production":
            return

        if any(origin == "*" for origin in self.CORS_ORIGINS) or not self.CORS_ORIGINS:
            msg = (
                "In production, CORS_ORIGINS must contain explicit domain origins "
                "and cannot use wildcard '*'"
            )
            raise ValueError(msg)

        insecure_defaults = {
            "dev_secret_key_change_in_production_min_32_chars_long",
            "secret",
            "changeme",
            "password",
            "jwtsecret",
        }
        if len(self.JWT_SECRET_KEY) < 32 or self.JWT_SECRET_KEY in insecure_defaults:
            msg = (
                "In production, JWT_SECRET_KEY must be a secure random string of "
                "at least 32 characters"
            )
            raise ValueError(msg)

        if self.ADAPTER_TYPE in {"in_memory_stub", "stub", "mock", "test"}:
            msg = f"Adapter type '{self.ADAPTER_TYPE}' is test-only and forbidden in production"
            raise ValueError(msg)

    @model_validator(mode="after")
    def validate_configuration(self) -> "Settings":
        self._validate_objective_weights()
        self._validate_thresholds()
        self._validate_telemetry_intervals()
        self._validate_production_rules()
        return self


# Lazy global settings singleton
_settings: Optional[Settings] = None


def get_settings() -> Settings:
    """Returns the cached global application settings instance."""
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings
