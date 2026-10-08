from datetime import datetime
from enum import Enum
from typing import Any, Dict, Optional

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import (
    JSON,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
)
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.models.base import Base, TimestampMixin, utc_now
from backend.models.digital_twin import AssetType


class TelemetryQuality(str, Enum):
    """Telemetry measurement quality classification defined in SURYA spec Section 8.2."""

    GOOD = "good"
    SUSPECT = "suspect"
    STALE = "stale"
    MISSING = "missing"
    INVALID = "invalid"


# ==============================================================================
# Pydantic Canonical Schemas for Ingestion & Live Exchange
# ==============================================================================


class CanonicalMeasurement(BaseModel):
    """
    Standardized physical measurement representation conforming to spec Section 8.2.
    """

    model_config = ConfigDict(extra="forbid")

    metric_name: str = Field(..., description="Canonical metric identifier")
    value: Optional[float] = Field(None, description="Measured numerical value")
    unit: str = Field(..., description="Standardized engineering unit")
    quality: TelemetryQuality = Field(
        TelemetryQuality.GOOD, description="Evaluated quality flag"
    )
    observed_at: datetime = Field(..., description="Source measurement timestamp")
    received_at: datetime = Field(default_factory=utc_now, description="Server receipt timestamp")
    source_adapter: str = Field("rest", description="Originating adapter identifier")
    diagnostic_code: Optional[str] = Field(None, description="Diagnostic error or status code")


class AssetTelemetrySnapshot(BaseModel):
    """
    Unified telemetry packet for a single physical energy asset.
    """

    model_config = ConfigDict(extra="forbid")

    asset_id: str = Field(..., description="Unique asset identifier")
    asset_type: AssetType = Field(..., description="Energy asset classification")
    observed_at: Optional[datetime] = Field(None, description="Latest observation timestamp")
    received_at: datetime = Field(default_factory=utc_now, description="Server receipt timestamp")
    status: str = Field(
        "offline", description="Operational status: online, degraded, stale, offline"
    )
    quality: TelemetryQuality = Field(TelemetryQuality.MISSING, description="Overall asset quality")
    measurements: Dict[str, CanonicalMeasurement] = Field(
        default_factory=dict, description="Map of metric_name to canonical measurement"
    )


class EnergySnapshot(BaseModel):
    """
    Immutable campus-wide energy telemetry snapshot captured across all assets.
    """

    model_config = ConfigDict(extra="forbid")

    site_id: int = Field(..., description="Site identifier")
    snapshot_id: str = Field(..., description="Unique UUID for this telemetry snapshot")
    captured_at: datetime = Field(default_factory=utc_now, description="Server capture timestamp")
    adapter_id: str = Field(..., description="Identifier of the adapter supplying snapshot")
    assets: Dict[str, AssetTelemetrySnapshot] = Field(
        default_factory=dict, description="Map of asset_id to AssetTelemetrySnapshot"
    )


class AdapterHealth(BaseModel):
    """
    Diagnostic health report for connected hardware adapters.
    """

    model_config = ConfigDict(extra="forbid")

    adapter_id: str = Field(..., description="Adapter identifier")
    adapter_type: str = Field(..., description="Protocol type: rest, modbus, mqtt")
    is_healthy: bool = Field(..., description="True if adapter is responding normally")
    latency_ms: float = Field(0.0, ge=0.0, description="Read round-trip latency in milliseconds")
    last_successful_read: Optional[datetime] = Field(
        None, description="Last successful read timestamp"
    )
    consecutive_failures: int = Field(0, ge=0, description="Count of sequential failed reads")
    status_message: str = Field("Operational", description="Human-readable health summary")


# ==============================================================================
# SQLAlchemy Models for Persistence
# ==============================================================================


class TelemetryPoint(Base):
    """
    Normalized interval telemetry measurement.
    Persisted for audit, reporting, and historical trend analysis.
    """

    __tablename__ = "telemetry_points"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    asset_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("assets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    metric_name: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    value: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    unit: Mapped[str] = mapped_column(String(20), nullable=False)
    quality: Mapped[TelemetryQuality] = mapped_column(
        SQLEnum(TelemetryQuality, name="telemetry_quality", native_enum=False),
        default=TelemetryQuality.GOOD,
        nullable=False,
    )
    observed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False, index=True
    )
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )
    source_adapter: Mapped[str] = mapped_column(String(100), default="rest", nullable=False)
    diagnostic_code: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # Relationships
    asset: Mapped["Asset"] = relationship("Asset", foreign_keys=[asset_id])  # noqa: F821

    __table_args__ = (
        Index("ix_telemetry_asset_metric_observed", "asset_id", "metric_name", "observed_at"),
    )

    def __repr__(self) -> str:
        return (
            f"<TelemetryPoint asset='{self.asset_id}' metric='{self.metric_name}' "
            f"value={self.value} {self.unit} quality='{self.quality.value}'>"
        )


class AssetCurrentState(Base, TimestampMixin):
    """
    Latest authoritative state for fast digital twin reads.
    Updated on every telemetry poll / decision cycle.
    """

    __tablename__ = "asset_current_state"

    asset_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("assets.id", ondelete="CASCADE"), primary_key=True
    )
    operational_status: Mapped[str] = mapped_column(
        String(30), default="offline", nullable=False
    )
    active_power_kw: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    energy_kwh: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    soc_percent: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    health_percent: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    temperature_celsius: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    wind_speed_ms: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    voltage_v: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    frequency_hz: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    telemetry_quality: Mapped[TelemetryQuality] = mapped_column(
        SQLEnum(TelemetryQuality, name="telemetry_quality", native_enum=False),
        default=TelemetryQuality.MISSING,
        nullable=False,
    )
    observed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )
    raw_metrics: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)

    # Relationships
    asset: Mapped["Asset"] = relationship("Asset", foreign_keys=[asset_id])  # noqa: F821

    def __repr__(self) -> str:
        return (
            f"<AssetCurrentState asset='{self.asset_id}' status='{self.operational_status}' "
            f"power={self.active_power_kw}kW soc={self.soc_percent}%>"
        )
