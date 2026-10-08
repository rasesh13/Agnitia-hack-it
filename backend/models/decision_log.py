import uuid
from datetime import datetime
from enum import Enum
from typing import Any, List, Optional

from sqlalchemy import (
    JSON,
    Boolean,
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


class DecisionCycleStatus(str, Enum):
    """Lifecycle status for a decision cycle defined in SURYA spec Section 10."""

    STARTED = "started"
    COMPLETED = "completed"
    DEGRADED = "degraded"
    BLOCKED = "blocked"
    FAILED = "failed"


class DecisionType(str, Enum):
    """Categories of optimization decisions produced during a cycle."""

    DISPATCH = "dispatch"
    BATTERY = "battery"
    VNM_ALLOCATION = "vnm_allocation"
    LOAD_SHIFT = "load_shift"
    RELIABILITY = "reliability"


class CommandStatus(str, Enum):
    """Execution status of an issued control command defined in spec Section 8.4."""

    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    TIMEOUT = "timeout"
    FAILED = "failed"
    EXECUTED = "executed"


class DecisionCycle(Base):
    """
    Record representing a discrete optimization cycle execution with timing and health.
    """

    __tablename__ = "decision_cycles"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    site_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("sites.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[DecisionCycleStatus] = mapped_column(
        SQLEnum(DecisionCycleStatus, name="decision_cycle_status", native_enum=False),
        default=DecisionCycleStatus.STARTED,
        nullable=False,
    )
    input_snapshot_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    cycle_started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False, index=True
    )
    cycle_completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    duration_ms: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    health_summary: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)
    reason: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Relationships with selectin loading for async compatibility
    decisions: Mapped[List["DecisionLog"]] = relationship(
        "DecisionLog",
        back_populates="cycle",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    alternatives: Mapped[List["DecisionAlternative"]] = relationship(
        "DecisionAlternative",
        back_populates="cycle",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<DecisionCycle id='{self.id}' status='{self.status.value}'>"


class DecisionLog(Base):
    """
    Immutable selected decision record.
    Conforms to append-only audit trail in spec Section 10 & Section 12.
    """

    __tablename__ = "decision_logs"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    cycle_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("decision_cycles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    site_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("sites.id", ondelete="CASCADE"), nullable=False
    )
    target_asset_id: Mapped[Optional[str]] = mapped_column(
        String(64), ForeignKey("assets.id", ondelete="SET NULL"), nullable=True, index=True
    )
    decision_type: Mapped[DecisionType] = mapped_column(
        SQLEnum(DecisionType, name="decision_type", native_enum=False),
        nullable=False,
        index=True,
    )
    action: Mapped[str] = mapped_column(String(50), nullable=False)
    setpoint_kw: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    allocated_kwh: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    allocated_value_inr: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    actor: Mapped[str] = mapped_column(String(100), default="system:optimizer", nullable=False)
    reason: Mapped[str] = mapped_column(String(255), nullable=False)
    confidence: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    expected_savings_inr: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    carbon_impact_kg: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    context_data: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False, index=True
    )

    # Relationships
    cycle: Mapped["DecisionCycle"] = relationship("DecisionCycle", back_populates="decisions")
    commands: Mapped[List["ControlCommand"]] = relationship(
        "ControlCommand", back_populates="decision", lazy="selectin"
    )

    def __repr__(self) -> str:
        return (
            f"<DecisionLog id='{self.id}' type='{self.decision_type.value}' "
            f"action='{self.action}'>"
        )


class DecisionAlternative(Base):
    """
    Rejected optimization candidate strategy recorded for explainability and audit.
    """

    __tablename__ = "decision_alternatives"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    cycle_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("decision_cycles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    candidate_id: Mapped[str] = mapped_column(String(64), nullable=False)
    strategy_description: Mapped[str] = mapped_column(String(255), nullable=False)
    score: Mapped[float] = mapped_column(Float, nullable=False)
    cost_component: Mapped[float] = mapped_column(Float, nullable=False)
    carbon_component: Mapped[float] = mapped_column(Float, nullable=False)
    is_selected: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    rejected_reason: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )

    # Relationships
    cycle: Mapped["DecisionCycle"] = relationship("DecisionCycle", back_populates="alternatives")


class ControlCommand(Base, TimestampMixin):
    """
    Explicit, auditable, idempotency-keyed control command sent to energy adapters.
    """

    __tablename__ = "control_commands"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    idempotency_key: Mapped[str] = mapped_column(
        String(64), unique=True, index=True, nullable=False
    )
    decision_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("decision_logs.id", ondelete="SET NULL"), nullable=True, index=True
    )
    target_asset_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("assets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    action: Mapped[str] = mapped_column(String(50), nullable=False)
    requested_setpoint: Mapped[float] = mapped_column(Float, nullable=False)
    unit: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[CommandStatus] = mapped_column(
        SQLEnum(CommandStatus, name="command_status", native_enum=False),
        default=CommandStatus.PENDING,
        nullable=False,
    )
    valid_from: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    valid_until: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    reason: Mapped[str] = mapped_column(String(255), nullable=False)
    originating_actor: Mapped[str] = mapped_column(String(100), nullable=False)
    adapter_response: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)

    # Relationships
    decision: Mapped[Optional["DecisionLog"]] = relationship(
        "DecisionLog", back_populates="commands"
    )

    __table_args__ = (
        Index("ix_control_commands_asset_status", "target_asset_id", "status"),
    )

    def __repr__(self) -> str:
        return (
            f"<ControlCommand id='{self.id}' asset='{self.target_asset_id}' "
            f"action='{self.action}' status='{self.status.value}'>"
        )
