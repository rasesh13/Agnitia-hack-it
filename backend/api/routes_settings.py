from typing import Annotated, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import require_admin, require_viewer_or_above
from backend.api.routes_health import get_global_scheduler
from backend.config import get_settings
from backend.db.database import get_db
from backend.models.config import (
    AlertSeverity,
    AlertThreshold,
    AuditEvent,
    BatteryConfig,
    BuildingConfig,
    CriticalityTier,
    VNMSharingRule,
)
from backend.models.schemas import (
    AlertThresholdRead,
    AlertThresholdUpdate,
    BatteryConfigRead,
    BatteryConfigUpdate,
    BuildingConfigRead,
    BuildingConfigUpdate,
    ControlPolicyRead,
    ControlPolicyUpdate,
    VNMSharingRuleCreate,
    VNMSharingRuleRead,
    VNMSharingRuleUpdate,
)
from backend.models.user import User

router = APIRouter(prefix="/api/v1/settings", tags=["System Settings & Policy"])


# ==============================================================================
# Alert Thresholds
# ==============================================================================


@router.get(
    "/alert-thresholds",
    response_model=List[AlertThresholdRead],
    summary="List operational alert thresholds",
)
async def list_alert_thresholds(
    session: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_viewer_or_above)],
) -> List[AlertThresholdRead]:
    """Lists all configured metric alert thresholds."""
    query = select(AlertThreshold).order_by(AlertThreshold.id)
    result = await session.execute(query)
    thresholds = result.scalars().all()
    return [AlertThresholdRead.model_validate(t) for t in thresholds]


@router.get(
    "/alert-thresholds/{threshold_id}",
    response_model=AlertThresholdRead,
    summary="Get single alert threshold",
)
async def get_alert_threshold(
    threshold_id: int,
    session: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_viewer_or_above)],
) -> AlertThresholdRead:
    """Retrieves single alert threshold by ID."""
    query = select(AlertThreshold).where(AlertThreshold.id == threshold_id)
    result = await session.execute(query)
    threshold = result.scalar_one_or_none()
    if threshold is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "THRESHOLD_NOT_FOUND",
                "message": f"Alert threshold with ID {threshold_id} was not found",
            },
        )
    return AlertThresholdRead.model_validate(threshold)


@router.put(
    "/alert-thresholds/{threshold_id}",
    response_model=AlertThresholdRead,
    summary="Update alert threshold (Admin only)",
)
async def update_alert_threshold(
    threshold_id: int,
    payload: AlertThresholdUpdate,
    session: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_admin)],
) -> AlertThresholdRead:
    """Updates metric alert threshold and records an immutable audit event."""
    query = select(AlertThreshold).where(AlertThreshold.id == threshold_id)
    result = await session.execute(query)
    threshold = result.scalar_one_or_none()
    if threshold is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "THRESHOLD_NOT_FOUND",
                "message": f"Alert threshold with ID {threshold_id} was not found",
            },
        )

    old_values = {
        "threshold_value": threshold.threshold_value,
        "severity": threshold.severity.value,
        "is_active": threshold.is_active,
    }

    if payload.threshold_value is not None:
        threshold.threshold_value = payload.threshold_value
    if payload.severity is not None:
        threshold.severity = AlertSeverity(payload.severity)
    if payload.is_active is not None:
        threshold.is_active = payload.is_active

    threshold.updated_by_user_id = current_user.id

    audit = AuditEvent(
        event_type="SETTINGS_UPDATE",
        user_id=current_user.id,
        actor=current_user.email,
        action="UPDATE_ALERT_THRESHOLD",
        resource_type="AlertThreshold",
        resource_id=str(threshold_id),
        details={"old": old_values, "new": payload.model_dump(exclude_unset=True)},
    )
    session.add(audit)
    await session.commit()
    await session.refresh(threshold)
    return AlertThresholdRead.model_validate(threshold)


# ==============================================================================
# Building Criticality Tiers
# ==============================================================================


@router.get(
    "/building-tiers",
    response_model=List[BuildingConfigRead],
    summary="List building criticality configurations",
)
async def list_building_tiers(
    session: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_viewer_or_above)],
) -> List[BuildingConfigRead]:
    """Lists building criticality tiers and flexible load parameters."""
    query = select(BuildingConfig).order_by(BuildingConfig.id)
    result = await session.execute(query)
    configs = result.scalars().all()
    return [BuildingConfigRead.model_validate(c) for c in configs]


@router.get(
    "/building-tiers/{building_id}",
    response_model=BuildingConfigRead,
    summary="Get building configuration",
)
async def get_building_tier(
    building_id: str,
    session: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_viewer_or_above)],
) -> BuildingConfigRead:
    """Retrieves building configuration by integer ID or asset_id."""
    query = select(BuildingConfig).where(
        or_(
            BuildingConfig.asset_id == building_id,
            BuildingConfig.id == (int(building_id) if building_id.isdigit() else -1),
        )
    )
    result = await session.execute(query)
    cfg = result.scalar_one_or_none()
    if cfg is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "BUILDING_CONFIG_NOT_FOUND",
                "message": f"Building configuration for '{building_id}' was not found",
            },
        )
    return BuildingConfigRead.model_validate(cfg)


@router.put(
    "/building-tiers/{building_id}",
    response_model=BuildingConfigRead,
    summary="Update building configuration (Admin only)",
)
async def update_building_tier(
    building_id: str,
    payload: BuildingConfigUpdate,
    session: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_admin)],
) -> BuildingConfigRead:
    """Updates building criticality tier and records an audit event."""
    query = select(BuildingConfig).where(
        or_(
            BuildingConfig.asset_id == building_id,
            BuildingConfig.id == (int(building_id) if building_id.isdigit() else -1),
        )
    )
    result = await session.execute(query)
    cfg = result.scalar_one_or_none()
    if cfg is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "BUILDING_CONFIG_NOT_FOUND",
                "message": f"Building configuration for '{building_id}' was not found",
            },
        )

    old_values = {
        "criticality_tier": cfg.criticality_tier.value,
        "flexible_load_policy": cfg.flexible_load_policy,
        "peak_load_kw": cfg.peak_load_kw,
    }

    if payload.criticality_tier is not None:
        cfg.criticality_tier = CriticalityTier(payload.criticality_tier)
    if payload.flexible_load_policy is not None:
        cfg.flexible_load_policy = payload.flexible_load_policy
    if payload.peak_load_kw is not None:
        cfg.peak_load_kw = payload.peak_load_kw

    audit = AuditEvent(
        event_type="SETTINGS_UPDATE",
        user_id=current_user.id,
        actor=current_user.email,
        action="UPDATE_BUILDING_CONFIG",
        resource_type="BuildingConfig",
        resource_id=cfg.asset_id,
        details={"old": old_values, "new": payload.model_dump(exclude_unset=True)},
    )
    session.add(audit)
    await session.commit()
    await session.refresh(cfg)
    return BuildingConfigRead.model_validate(cfg)


# ==============================================================================
# VNM Sharing Rules
# ==============================================================================


@router.get(
    "/vnm-sharing-rules",
    response_model=List[VNMSharingRuleRead],
    summary="List VNM sharing rules",
)
async def list_vnm_rules(
    session: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_viewer_or_above)],
) -> List[VNMSharingRuleRead]:
    """Lists configured Virtual Net Metering allocation ratios."""
    query = select(VNMSharingRule).order_by(VNMSharingRule.id)
    result = await session.execute(query)
    rules = result.scalars().all()
    return [VNMSharingRuleRead.model_validate(r) for r in rules]


@router.get(
    "/vnm-sharing-rules/{rule_id}",
    response_model=VNMSharingRuleRead,
    summary="Get single VNM sharing rule",
)
async def get_vnm_rule(
    rule_id: int,
    session: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_viewer_or_above)],
) -> VNMSharingRuleRead:
    """Retrieves single VNM sharing rule."""
    query = select(VNMSharingRule).where(VNMSharingRule.id == rule_id)
    result = await session.execute(query)
    rule = result.scalar_one_or_none()
    if rule is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "VNM_RULE_NOT_FOUND",
                "message": f"VNM sharing rule {rule_id} was not found",
            },
        )
    return VNMSharingRuleRead.model_validate(rule)


@router.post(
    "/vnm-sharing-rules",
    response_model=VNMSharingRuleRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create new VNM sharing rule (Admin only)",
)
async def create_vnm_rule(
    payload: VNMSharingRuleCreate,
    session: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_admin)],
) -> VNMSharingRuleRead:
    """Creates a new VNM sharing rule with ratio validation and audit event."""
    rule = VNMSharingRule(
        building_asset_id=payload.building_asset_id,
        sharing_ratio=payload.sharing_ratio,
        jurisdiction=payload.jurisdiction,
        updated_by_user_id=current_user.id,
    )
    session.add(rule)
    await session.flush()

    audit = AuditEvent(
        event_type="SETTINGS_UPDATE",
        user_id=current_user.id,
        actor=current_user.email,
        action="CREATE_VNM_RULE",
        resource_type="VNMSharingRule",
        resource_id=str(rule.id),
        details=payload.model_dump(),
    )
    session.add(audit)
    await session.commit()
    await session.refresh(rule)
    return VNMSharingRuleRead.model_validate(rule)


@router.put(
    "/vnm-sharing-rules/{rule_id}",
    response_model=VNMSharingRuleRead,
    summary="Update VNM sharing rule (Admin only)",
)
async def update_vnm_rule(
    rule_id: int,
    payload: VNMSharingRuleUpdate,
    session: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_admin)],
) -> VNMSharingRuleRead:
    """Updates VNM sharing rule ratio with audit logging."""
    query = select(VNMSharingRule).where(VNMSharingRule.id == rule_id)
    result = await session.execute(query)
    rule = result.scalar_one_or_none()
    if rule is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "VNM_RULE_NOT_FOUND",
                "message": f"VNM sharing rule {rule_id} was not found",
            },
        )

    old_values = {
        "sharing_ratio": rule.sharing_ratio,
        "effective_until": (
            rule.effective_until.isoformat() if rule.effective_until else None
        ),
    }

    if payload.sharing_ratio is not None:
        rule.sharing_ratio = payload.sharing_ratio
        rule.rule_version += 1
    if payload.effective_until is not None:
        rule.effective_until = payload.effective_until

    rule.updated_by_user_id = current_user.id

    audit = AuditEvent(
        event_type="SETTINGS_UPDATE",
        user_id=current_user.id,
        actor=current_user.email,
        action="UPDATE_VNM_RULE",
        resource_type="VNMSharingRule",
        resource_id=str(rule.id),
        details={"old": old_values, "new": payload.model_dump(exclude_unset=True)},
    )
    session.add(audit)
    await session.commit()
    await session.refresh(rule)
    return VNMSharingRuleRead.model_validate(rule)


# ==============================================================================
# Asset Boundaries & Battery Limits
# ==============================================================================


@router.get(
    "/assets",
    response_model=List[BatteryConfigRead],
    summary="List battery asset operational boundaries",
)
async def list_battery_configs(
    session: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_viewer_or_above)],
) -> List[BatteryConfigRead]:
    """Lists battery storage operational constraints."""
    query = select(BatteryConfig).order_by(BatteryConfig.id)
    result = await session.execute(query)
    configs = result.scalars().all()
    return [BatteryConfigRead.model_validate(c) for c in configs]


@router.get(
    "/assets/{asset_id}",
    response_model=BatteryConfigRead,
    summary="Get battery asset configuration",
)
async def get_battery_config(
    asset_id: str,
    session: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_viewer_or_above)],
) -> BatteryConfigRead:
    """Retrieves operational constraints for a specific battery asset."""
    query = select(BatteryConfig).where(
        or_(
            BatteryConfig.asset_id == asset_id,
            BatteryConfig.id == (int(asset_id) if asset_id.isdigit() else -1),
        )
    )
    result = await session.execute(query)
    cfg = result.scalar_one_or_none()
    if cfg is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "BATTERY_CONFIG_NOT_FOUND",
                "message": f"Battery configuration for asset '{asset_id}' was not found",
            },
        )
    return BatteryConfigRead.model_validate(cfg)


@router.put(
    "/assets/{asset_id}/battery",
    response_model=BatteryConfigRead,
    summary="Update battery operational boundaries (Admin only)",
)
async def update_battery_config(
    asset_id: str,
    payload: BatteryConfigUpdate,
    session: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_admin)],
) -> BatteryConfigRead:
    """Updates battery operational bounds with audit logging."""
    query = select(BatteryConfig).where(
        or_(
            BatteryConfig.asset_id == asset_id,
            BatteryConfig.id == (int(asset_id) if asset_id.isdigit() else -1),
        )
    )
    result = await session.execute(query)
    cfg = result.scalar_one_or_none()
    if cfg is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "BATTERY_CONFIG_NOT_FOUND",
                "message": f"Battery configuration for asset '{asset_id}' was not found",
            },
        )

    old_values = {
        "min_soc": cfg.min_soc,
        "max_soc": cfg.max_soc,
        "reserve_floor": cfg.reserve_floor,
        "max_charge_power_kw": cfg.max_charge_power_kw,
        "max_discharge_power_kw": cfg.max_discharge_power_kw,
        "health_floor": cfg.health_floor,
        "round_trip_efficiency": cfg.round_trip_efficiency,
    }

    if payload.min_soc is not None:
        cfg.min_soc = payload.min_soc
    if payload.max_soc is not None:
        cfg.max_soc = payload.max_soc
    if payload.reserve_floor is not None:
        cfg.reserve_floor = payload.reserve_floor
    if payload.max_charge_power_kw is not None:
        cfg.max_charge_power_kw = payload.max_charge_power_kw
    if payload.max_discharge_power_kw is not None:
        cfg.max_discharge_power_kw = payload.max_discharge_power_kw
    if payload.round_trip_efficiency is not None:
        cfg.round_trip_efficiency = payload.round_trip_efficiency
    if payload.health_floor is not None:
        cfg.health_floor = payload.health_floor

    audit = AuditEvent(
        event_type="SETTINGS_UPDATE",
        user_id=current_user.id,
        actor=current_user.email,
        action="UPDATE_BATTERY_CONFIG",
        resource_type="BatteryConfig",
        resource_id=cfg.asset_id,
        details={"old": old_values, "new": payload.model_dump(exclude_unset=True)},
    )
    session.add(audit)
    await session.commit()
    await session.refresh(cfg)
    return BatteryConfigRead.model_validate(cfg)


# ==============================================================================
# Control Policy & Mode
# ==============================================================================


@router.get(
    "/control-policy",
    response_model=ControlPolicyRead,
    summary="Get automated control policy and parameters",
)
async def get_control_policy(
    current_user: Annotated[User, Depends(require_viewer_or_above)],
) -> ControlPolicyRead:
    """Retrieves current closed loop status, emergency stop, and scoring weights."""
    settings = get_settings()
    scheduler = get_global_scheduler()

    closed_loop = scheduler.closed_loop_enabled if scheduler else False
    emergency_stop = scheduler.emergency_stop_active if scheduler else False

    return ControlPolicyRead(
        closed_loop_enabled=closed_loop,
        emergency_stop_active=emergency_stop,
        cost_weight=settings.COST_WEIGHT,
        carbon_weight=settings.CARBON_WEIGHT,
        decision_cycle_seconds=settings.DECISION_CYCLE_SECONDS,
    )


@router.put(
    "/control-policy",
    response_model=ControlPolicyRead,
    summary="Update automated control policy (Admin only)",
)
async def update_control_policy(
    payload: ControlPolicyUpdate,
    session: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_admin)],
) -> ControlPolicyRead:
    """Updates closed-loop automated control toggle and scoring weights with audit trail."""
    settings = get_settings()
    scheduler = get_global_scheduler()

    old_values = {
        "closed_loop_enabled": scheduler.closed_loop_enabled if scheduler else False,
        "emergency_stop_active": scheduler.emergency_stop_active if scheduler else False,
        "cost_weight": settings.COST_WEIGHT,
        "carbon_weight": settings.CARBON_WEIGHT,
    }

    if payload.closed_loop_enabled is not None and scheduler:
        scheduler.set_closed_loop(payload.closed_loop_enabled)
    if payload.emergency_stop_active is not None and scheduler:
        scheduler.set_emergency_stop(payload.emergency_stop_active)
    if payload.cost_weight is not None:
        settings.COST_WEIGHT = payload.cost_weight
    if payload.carbon_weight is not None:
        settings.CARBON_WEIGHT = payload.carbon_weight

    audit = AuditEvent(
        event_type="SETTINGS_UPDATE",
        user_id=current_user.id,
        actor=current_user.email,
        action="UPDATE_CONTROL_POLICY",
        resource_type="ControlPolicy",
        resource_id="global",
        details={"old": old_values, "new": payload.model_dump(exclude_unset=True)},
    )
    session.add(audit)
    await session.commit()

    return await get_control_policy(current_user=current_user)
