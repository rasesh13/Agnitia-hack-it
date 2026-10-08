from datetime import datetime
from enum import Enum
from typing import Any, Optional

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


class TelemetryQuality(str, Enum):
    """Telemetry measurement quality classification defined in SURYA spec Section 8.2."""

    GOOD = "good"
    SUSPECT = "suspect"
    STALE = "stale"
    MISSING = "missing"
    INVALID = "invalid"


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
