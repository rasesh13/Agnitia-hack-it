from datetime import datetime
from typing import Any, Generic, Optional, TypeVar

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from backend.models.user import UserRole

T = TypeVar("T")


class APIErrorDetail(BaseModel):
    """Detailed error object conforming to SURYA REST contract."""

    model_config = ConfigDict(extra="forbid")

    code: str = Field(
        ...,
        description="Machine-readable error code (e.g. VALIDATION_ERROR, AUTH_EXPIRED)",
    )
    message: str = Field(..., description="Human-readable explanation of the error")
    request_id: Optional[str] = Field(
        None, description="Correlation ID for tracing the request"
    )
    details: Optional[dict[str, Any]] = Field(
        None, description="Additional context or validation failure map"
    )


class APIErrorResponse(BaseModel):
    """Root error response container."""

    model_config = ConfigDict(extra="forbid")

    error: APIErrorDetail


class StandardResponse(BaseModel, Generic[T]):
    """Standard generic API response."""

    model_config = ConfigDict(extra="forbid")

    data: T
    request_id: Optional[str] = None


# ==============================================================================
# Authentication Request & Response Schemas
# ==============================================================================


class UserSignupRequest(BaseModel):
    """Signup request schema."""

    model_config = ConfigDict(extra="forbid")

    email: EmailStr = Field(..., description="User email address")
    password: str = Field(
        ..., min_length=8, max_length=128, description="User password (min 8 chars)"
    )


class UserLoginRequest(BaseModel):
    """Login request schema."""

    model_config = ConfigDict(extra="forbid")

    email: EmailStr = Field(..., description="User email address")
    password: str = Field(..., description="User password")


class GoogleAuthRequest(BaseModel):
    """Google OAuth ID token verification request."""

    model_config = ConfigDict(extra="forbid")

    id_token: str = Field(..., description="Google OAuth ID Token JWT")


class UserReadResponse(BaseModel):
    """Safe user profile response representation."""

    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: int
    email: str
    role: UserRole
    is_active: bool
    created_at: datetime


class TokenResponse(BaseModel):
    """JWT bearer token response."""

    model_config = ConfigDict(extra="forbid")

    access_token: str = Field(..., description="JWT access token")
    token_type: str = Field("bearer", description="Token type")
    expires_in: int = Field(..., description="Token validity in seconds")
    user: UserReadResponse


class TokenPayload(BaseModel):
    """Decoded JWT claims payload."""

    model_config = ConfigDict(extra="forbid")

    sub: str = Field(..., description="User ID subject")
    email: str = Field(..., description="User email")
    role: UserRole = Field(..., description="User role")
    token_version: int = Field(1, description="Token revocation version")
    iat: int = Field(..., description="Issued at epoch timestamp")
    exp: int = Field(..., description="Expiration epoch timestamp")


# ==============================================================================
# Decision & Control Schemas
# ==============================================================================


class ControlCommandRead(BaseModel):
    """Control command read schema."""

    model_config = ConfigDict(from_attributes=True, extra="ignore")

    id: str
    idempotency_key: str
    decision_id: Optional[str] = None
    target_asset_id: str
    action: str
    requested_setpoint: float
    unit: str
    status: str
    valid_from: datetime
    valid_until: datetime
    reason: str
    originating_actor: str
    adapter_response: Optional[dict[str, Any]] = None
    created_at: datetime


class DecisionLogRead(BaseModel):
    """Decision log read schema."""

    model_config = ConfigDict(from_attributes=True, extra="ignore")

    id: str
    cycle_id: str
    site_id: int
    target_asset_id: Optional[str] = None
    decision_type: str
    action: str
    setpoint_kw: Optional[float] = None
    allocated_kwh: Optional[float] = None
    allocated_value_inr: Optional[float] = None
    actor: str
    reason: str
    confidence: float
    expected_savings_inr: Optional[float] = None
    carbon_impact_kg: Optional[float] = None
    context_data: Optional[dict[str, Any]] = None
    created_at: datetime
    commands: list[ControlCommandRead] = []


class DecisionAlternativeRead(BaseModel):
    """Decision alternative read schema."""

    model_config = ConfigDict(from_attributes=True, extra="ignore")

    id: int
    cycle_id: str
    candidate_id: str
    strategy_description: str
    score: float
    cost_component: float
    carbon_component: float
    is_selected: bool
    rejected_reason: Optional[str] = None
    created_at: datetime


class DecisionCycleRead(BaseModel):
    """Decision cycle read schema."""

    model_config = ConfigDict(from_attributes=True, extra="ignore")

    id: str
    site_id: int
    status: str
    input_snapshot_hash: str
    cycle_started_at: datetime
    cycle_completed_at: Optional[datetime] = None
    duration_ms: Optional[float] = None
    health_summary: Optional[dict[str, Any]] = None
    reason: Optional[str] = None
    decisions: list[DecisionLogRead] = []
    alternatives: list[DecisionAlternativeRead] = []


class DecisionStatsResponse(BaseModel):
    """Aggregated decision statistics."""

    model_config = ConfigDict(extra="ignore")

    site_id: int
    total_decisions: int
    total_savings_inr: float
    total_carbon_reduction_kg: float
    by_type: dict[str, Any]


# ==============================================================================
# Settings & Configuration Schemas
# ==============================================================================


class AlertThresholdRead(BaseModel):
    """Alert threshold schema."""

    model_config = ConfigDict(from_attributes=True, extra="ignore")

    id: int
    metric_name: str
    threshold_value: float
    unit: str
    severity: str
    is_active: bool
    updated_by_user_id: Optional[int] = None
    updated_at: datetime


class AlertThresholdUpdate(BaseModel):
    """Alert threshold update schema."""

    model_config = ConfigDict(extra="forbid")

    threshold_value: Optional[float] = None
    severity: Optional[str] = None
    is_active: Optional[bool] = None


class BuildingConfigRead(BaseModel):
    """Building config schema."""

    model_config = ConfigDict(from_attributes=True, extra="ignore")

    id: int
    asset_id: str
    building_name: str
    criticality_tier: str
    flexible_load_policy: Optional[str] = None
    peak_load_kw: float
    operational_metadata: Optional[dict[str, Any]] = None
    updated_at: datetime


class BuildingConfigUpdate(BaseModel):
    """Building config update schema."""

    model_config = ConfigDict(extra="forbid")

    criticality_tier: Optional[str] = None
    flexible_load_policy: Optional[str] = None
    peak_load_kw: Optional[float] = None


class VNMSharingRuleRead(BaseModel):
    """VNM sharing rule schema."""

    model_config = ConfigDict(from_attributes=True, extra="ignore")

    id: int
    building_asset_id: str
    sharing_ratio: float
    rule_version: int
    jurisdiction: str
    effective_from: datetime
    effective_until: Optional[datetime] = None
    updated_by_user_id: Optional[int] = None
    updated_at: datetime


class VNMSharingRuleCreate(BaseModel):
    """VNM sharing rule create schema."""

    model_config = ConfigDict(extra="forbid")

    building_asset_id: str
    sharing_ratio: float = Field(..., ge=0.0, le=1.0)
    jurisdiction: str = "IN-KA"


class VNMSharingRuleUpdate(BaseModel):
    """VNM sharing rule update schema."""

    model_config = ConfigDict(extra="forbid")

    sharing_ratio: Optional[float] = Field(None, ge=0.0, le=1.0)
    effective_until: Optional[datetime] = None


class BatteryConfigRead(BaseModel):
    """Battery config schema."""

    model_config = ConfigDict(from_attributes=True, extra="ignore")

    id: int
    asset_id: str
    min_soc: float
    max_soc: float
    reserve_floor: float
    max_charge_power_kw: float
    max_discharge_power_kw: float
    round_trip_efficiency: float
    health_floor: float
    updated_at: datetime


class BatteryConfigUpdate(BaseModel):
    """Battery config update schema."""

    model_config = ConfigDict(extra="forbid")

    min_soc: Optional[float] = None
    max_soc: Optional[float] = None
    reserve_floor: Optional[float] = None
    max_charge_power_kw: Optional[float] = None
    max_discharge_power_kw: Optional[float] = None
    round_trip_efficiency: Optional[float] = None
    health_floor: Optional[float] = None


class ControlPolicyRead(BaseModel):
    """Control policy status schema."""

    model_config = ConfigDict(extra="ignore")

    closed_loop_enabled: bool
    emergency_stop_active: bool
    cost_weight: float
    carbon_weight: float
    decision_cycle_seconds: int


class ControlPolicyUpdate(BaseModel):
    """Control policy update schema."""

    model_config = ConfigDict(extra="forbid")

    closed_loop_enabled: Optional[bool] = None
    emergency_stop_active: Optional[bool] = None
    cost_weight: Optional[float] = None
    carbon_weight: Optional[float] = None
    decision_cycle_seconds: Optional[int] = Field(None, ge=10, le=3600)


class ForceCycleRequest(BaseModel):
    """Force cycle trigger request."""

    model_config = ConfigDict(extra="forbid")

    site_id: int = 1


class ForceCycleResponse(BaseModel):
    """Force cycle trigger response."""

    model_config = ConfigDict(extra="ignore")

    cycle_id: str
    site_id: int
    status: str
    duration_ms: Optional[float] = None
    decisions_count: int = 0
    commands_count: int = 0


class CommandAcknowledgeRequest(BaseModel):
    """Control command acknowledge request."""

    model_config = ConfigDict(extra="forbid")

    status: str = "executed"
    adapter_response: Optional[dict[str, Any]] = None
    reason: Optional[str] = None


class EmergencyStopRequest(BaseModel):
    """Emergency stop toggle request."""

    model_config = ConfigDict(extra="forbid")

    active: bool
    reason: str = Field(..., min_length=3, max_length=255)


class EmergencyStopResponse(BaseModel):
    """Emergency stop response."""

    model_config = ConfigDict(extra="ignore")

    emergency_stop_active: bool
    message: str
    timestamp: datetime


# ==============================================================================
# Export & Reporting Schemas
# ==============================================================================


class ExportStatsResponse(BaseModel):
    """Comprehensive executive export statistics conforming to spec Section 11."""

    model_config = ConfigDict(extra="ignore")

    site_id: int
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None
    timezone: str = "Asia/Kolkata"
    currency: str = "INR"
    units: dict[str, str] = Field(
        default_factory=lambda: {
            "power": "kW",
            "energy": "kWh",
            "cost": "INR",
            "carbon": "kg CO2e",
        }
    )
    tariffs: dict[str, float] = Field(
        default_factory=lambda: {
            "grid_import_inr_per_kwh": 8.50,
            "grid_export_inr_per_kwh": 3.50,
            "carbon_emission_factor_kg_per_kwh": 0.82,
        }
    )
    metrics: dict[str, Any]
    data_quality_disclosure: dict[str, Any]


