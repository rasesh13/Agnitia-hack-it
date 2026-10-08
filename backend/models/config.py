from datetime import datetime
from enum import Enum
from typing import Any, Optional

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.models.base import Base, TimestampMixin, utc_now


class CriticalityTier(str, Enum):
    """Building operational criticality tier for reliability protection."""

    CRITICAL = "critical"
    ESSENTIAL = "essential"
    NON_CRITICAL = "non_critical"


class AlertSeverity(str, Enum):
    """Severity levels for campus operational alerts."""

    CRITICAL = "critical"
    WARNING = "warning"
    INFO = "info"


class BuildingConfig(Base, TimestampMixin):
    """
    Configuration parameters and criticality classification for campus buildings.
    """

    __tablename__ = "building_configs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    asset_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("assets.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    building_name: Mapped[str] = mapped_column(String(100), nullable=False)
    criticality_tier: Mapped[CriticalityTier] = mapped_column(
        SQLEnum(CriticalityTier, name="criticality_tier", native_enum=False),
        default=CriticalityTier.ESSENTIAL,
        nullable=False,
    )
    flexible_load_policy: Mapped[Optional[str]] = mapped_column(
        String(50), default="protected", nullable=True
    )
    peak_load_kw: Mapped[float] = mapped_column(Float, default=100.0, nullable=False)
    operational_metadata: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)

    # Relationships
    asset: Mapped["Asset"] = relationship("Asset", foreign_keys=[asset_id])  # noqa: F821


class BatteryConfig(Base, TimestampMixin):
    """
    Physical operating boundaries, reserve floor, and health limits for battery storage.
    """

    __tablename__ = "battery_configs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    asset_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("assets.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    min_soc: Mapped[float] = mapped_column(Float, default=10.0, nullable=False)
    max_soc: Mapped[float] = mapped_column(Float, default=95.0, nullable=False)
    reserve_floor: Mapped[float] = mapped_column(Float, default=20.0, nullable=False)
    max_charge_power_kw: Mapped[float] = mapped_column(Float, default=200.0, nullable=False)
    max_discharge_power_kw: Mapped[float] = mapped_column(Float, default=200.0, nullable=False)
    round_trip_efficiency: Mapped[float] = mapped_column(Float, default=0.92, nullable=False)
    health_floor: Mapped[float] = mapped_column(Float, default=70.0, nullable=False)

    # Relationships
    asset: Mapped["Asset"] = relationship("Asset", foreign_keys=[asset_id])  # noqa: F821


class AlertThreshold(Base, TimestampMixin):
    """
    Configurable operational threshold triggering alarms and operator notifications.
    """

    __tablename__ = "alert_thresholds"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    metric_name: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    threshold_value: Mapped[float] = mapped_column(Float, nullable=False)
    unit: Mapped[str] = mapped_column(String(20), nullable=False)
    severity: Mapped[AlertSeverity] = mapped_column(
        SQLEnum(AlertSeverity, name="alert_severity", native_enum=False),
        default=AlertSeverity.WARNING,
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    updated_by_user_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )


class VNMSharingRule(Base, TimestampMixin):
    """
    Virtual Net Metering sharing ratio configuration between buildings.
    """

    __tablename__ = "vnm_sharing_rules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    building_asset_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("assets.id", ondelete="CASCADE"), nullable=False
    )
    sharing_ratio: Mapped[float] = mapped_column(Float, nullable=False)
    rule_version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    jurisdiction: Mapped[str] = mapped_column(String(50), default="IN-KA", nullable=False)
    effective_from: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )
    effective_until: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    updated_by_user_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )


class AuditEvent(Base):
    """
    Immutable audit record for configuration changes and privileged actions.
    Conforms to append-only contract in spec Section 12 & Section 16.
    """

    __tablename__ = "audit_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    event_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    user_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    actor: Mapped[str] = mapped_column(String(100), nullable=False)
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    resource_type: Mapped[str] = mapped_column(String(50), nullable=False)
    resource_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    details: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )

    def __repr__(self) -> str:
        return f"<AuditEvent id={self.id} type='{self.event_type}' actor='{self.actor}'>"
