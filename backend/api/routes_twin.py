from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.api.deps import get_current_user
from backend.db.database import get_db
from backend.db.repositories.twin_repo import TwinRepository
from backend.models.base import utc_now
from backend.models.config import BuildingConfig
from backend.models.digital_twin import Asset, AssetType
from backend.models.telemetry import TelemetryPoint
from backend.models.user import User
from backend.services.digital_twin_store import CampusAggregate, DigitalTwinStore

router = APIRouter(prefix="/api/v1", tags=["digital-twin"])


# ==============================================================================
# API Request / Response Schemas
# ==============================================================================


class SiteResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: int = Field(..., description="Unique Site ID")
    name: str = Field(..., description="Campus site name")
    timezone: str = Field(..., description="Site timezone string")
    jurisdiction: str = Field(..., description="Tariff / regulatory jurisdiction")
    currency: str = Field(..., description="Local currency code, e.g. INR")
    config_version: int = Field(..., description="Site configuration version")
    total_assets: int = Field(0, description="Total active asset count")


class BuildingTwinResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    asset_id: str = Field(..., description="Building asset ID")
    name: str = Field(..., description="Building name")
    criticality_tier: str = Field(..., description="Criticality classification")
    peak_load_kw: float = Field(..., description="Design peak load in kW")
    flexible_load_policy: Optional[str] = Field(None, description="Load shifting policy")
    current_power_kw: Optional[float] = Field(
        None, description="Latest measured power demand in kW"
    )
    operational_status: str = Field(
        ..., description="Operating status: online, degraded, stale, offline"
    )
    telemetry_quality: str = Field(..., description="Telemetry data quality")
    observed_at: Optional[datetime] = Field(None, description="Source measurement timestamp")
    received_at: Optional[datetime] = Field(None, description="Server receipt timestamp")
    age_seconds: Optional[float] = Field(None, description="Data freshness age in seconds")


class AssetTwinResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    asset_id: str = Field(..., description="Asset identifier")
    name: str = Field(..., description="Asset display name")
    asset_type: str = Field(..., description="Asset classification")
    site_id: int = Field(..., description="Site ID")
    rated_capacity_kw: Optional[float] = Field(None, description="Rated capacity in kW")
    operational_status: str = Field(..., description="Operating status")
    telemetry_quality: str = Field(..., description="Telemetry quality")
    active_power_kw: Optional[float] = Field(None, description="Active power in kW")
    energy_kwh: Optional[float] = Field(None, description="Energy in kWh")
    soc_percent: Optional[float] = Field(None, description="Battery SoC percentage")
    health_percent: Optional[float] = Field(None, description="Battery SoH percentage")
    temperature_celsius: Optional[float] = Field(None, description="Temperature in Celsius")
    wind_speed_ms: Optional[float] = Field(None, description="Wind speed in m/s")
    voltage_v: Optional[float] = Field(None, description="Voltage in Volts")
    frequency_hz: Optional[float] = Field(None, description="Frequency in Hz")
    observed_at: Optional[datetime] = Field(None, description="Observation timestamp")
    received_at: Optional[datetime] = Field(None, description="Receipt timestamp")
    age_seconds: Optional[float] = Field(None, description="Data age in seconds")
    raw_metrics: Optional[Dict[str, Any]] = Field(None, description="Raw metric dictionary")


class LiveTwinResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    site: SiteResponse = Field(..., description="Site metadata")
    aggregate: CampusAggregate = Field(..., description="Campus aggregate metrics")
    assets: List[AssetTwinResponse] = Field(..., description="List of asset states")


class TelemetrySeriesPoint(BaseModel):
    model_config = ConfigDict(extra="forbid")

    observed_at: datetime = Field(..., description="Observation timestamp")
    value: Optional[float] = Field(None, description="Measured numerical value")
    unit: str = Field(..., description="Canonical unit")
    quality: str = Field(..., description="Data quality classification")
    source_adapter: str = Field(..., description="Adapter source")


class TelemetrySeriesResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    asset_id: str = Field(..., description="Asset identifier")
    metric_name: str = Field(..., description="Metric name")
    count: int = Field(..., description="Number of points returned")
    points: List[TelemetrySeriesPoint] = Field(..., description="Historical telemetry series")


# ==============================================================================
# Helper Functions
# ==============================================================================


def _compute_age_seconds(obs_dt: Optional[datetime], now_dt: datetime) -> Optional[float]:
    if obs_dt is None:
        return None
    obs_utc = obs_dt if obs_dt.tzinfo else obs_dt.replace(tzinfo=timezone.utc)
    return max(0.0, round((now_dt - obs_utc).total_seconds(), 1))


# ==============================================================================
# Route Endpoints
# ==============================================================================


@router.get("/twin/site", response_model=SiteResponse)
async def get_site_twin(
    site_id: int = Query(1, description="Site ID to query"),
    session: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    """Retrieves digital twin site details and active asset count."""
    repo = TwinRepository(session)
    site = await repo.get_site(site_id)
    if not site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "SITE_NOT_FOUND", "message": f"Site {site_id} not found"},
        )

    assets = await repo.get_site_assets(site_id)
    return SiteResponse(
        id=site.id,
        name=site.name,
        timezone=site.timezone,
        jurisdiction=site.jurisdiction,
        currency=site.currency,
        config_version=site.config_version,
        total_assets=len(assets),
    )


@router.get("/twin/buildings", response_model=List[BuildingTwinResponse])
async def get_buildings_twin(
    site_id: int = Query(1, description="Site ID to query"),
    session: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    """Retrieves all buildings with criticality tiers, active load, and freshness."""
    now_dt = utc_now()
    repo = TwinRepository(session)

    stmt = (
        select(BuildingConfig)
        .join(Asset, BuildingConfig.asset_id == Asset.id)
        .where(Asset.site_id == site_id)
        .options(selectinload(BuildingConfig.asset))
    )
    result = await session.execute(stmt)
    configs = list(result.scalars().all())

    responses: List[BuildingTwinResponse] = []
    for cfg in configs:
        state = await repo.get_asset_state(cfg.asset_id)
        age = _compute_age_seconds(state.observed_at, now_dt) if state else None

        responses.append(
            BuildingTwinResponse(
                asset_id=cfg.asset_id,
                name=cfg.building_name,
                criticality_tier=cfg.criticality_tier.value,
                peak_load_kw=cfg.peak_load_kw,
                flexible_load_policy=cfg.flexible_load_policy,
                current_power_kw=state.active_power_kw if state else None,
                operational_status=state.operational_status if state else "offline",
                telemetry_quality=state.telemetry_quality.value if state else "missing",
                observed_at=state.observed_at if state else None,
                received_at=state.received_at if state else None,
                age_seconds=age,
            )
        )
    return responses


@router.get("/twin/assets", response_model=List[AssetTwinResponse])
async def get_assets_twin(
    site_id: int = Query(1, description="Site ID to query"),
    asset_type: Optional[AssetType] = Query(None, description="Optional asset type filter"),
    status_filter: Optional[str] = Query(
        None, alias="status", description="Optional status filter"
    ),
    session: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    """Retrieves digital twin assets with current operating state and freshness."""
    now_dt = utc_now()
    repo = TwinRepository(session)
    assets = await repo.get_site_assets(site_id)

    responses: List[AssetTwinResponse] = []
    for asset in assets:
        if asset_type is not None and asset.asset_type != asset_type:
            continue

        state = await repo.get_asset_state(asset.id)
        op_status = state.operational_status if state else "offline"
        if status_filter is not None and op_status != status_filter:
            continue

        age = _compute_age_seconds(state.observed_at, now_dt) if state else None

        responses.append(
            AssetTwinResponse(
                asset_id=asset.id,
                name=asset.name,
                asset_type=asset.asset_type.value,
                site_id=asset.site_id,
                rated_capacity_kw=asset.rated_capacity_kw,
                operational_status=op_status,
                telemetry_quality=state.telemetry_quality.value if state else "missing",
                active_power_kw=state.active_power_kw if state else None,
                energy_kwh=state.energy_kwh if state else None,
                soc_percent=state.soc_percent if state else None,
                health_percent=state.health_percent if state else None,
                temperature_celsius=state.temperature_celsius if state else None,
                wind_speed_ms=state.wind_speed_ms if state else None,
                voltage_v=state.voltage_v if state else None,
                frequency_hz=state.frequency_hz if state else None,
                observed_at=state.observed_at if state else None,
                received_at=state.received_at if state else None,
                age_seconds=age,
                raw_metrics=state.raw_metrics if state else None,
            )
        )
    return responses


@router.get("/twin/live", response_model=LiveTwinResponse)
async def get_live_twin_view(
    site_id: int = Query(1, description="Site ID to query"),
    session: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    """Retrieves complete campus digital twin including aggregates and live asset states."""
    repo = TwinRepository(session)
    store = DigitalTwinStore(repo)
    now_dt = utc_now()

    site = await repo.get_site(site_id)
    if not site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "SITE_NOT_FOUND", "message": f"Site {site_id} not found"},
        )

    assets = await repo.get_site_assets(site_id)
    asset_states = await repo.get_all_asset_states(site_id)
    state_map = {s.asset_id: s for s in asset_states}

    campus_agg = store.compute_campus_aggregates(site_id, asset_states)

    asset_responses: List[AssetTwinResponse] = []
    for asset in assets:
        state = state_map.get(asset.id)
        age = _compute_age_seconds(state.observed_at, now_dt) if state else None
        asset_responses.append(
            AssetTwinResponse(
                asset_id=asset.id,
                name=asset.name,
                asset_type=asset.asset_type.value,
                site_id=asset.site_id,
                rated_capacity_kw=asset.rated_capacity_kw,
                operational_status=state.operational_status if state else "offline",
                telemetry_quality=state.telemetry_quality.value if state else "missing",
                active_power_kw=state.active_power_kw if state else None,
                energy_kwh=state.energy_kwh if state else None,
                soc_percent=state.soc_percent if state else None,
                health_percent=state.health_percent if state else None,
                temperature_celsius=state.temperature_celsius if state else None,
                wind_speed_ms=state.wind_speed_ms if state else None,
                voltage_v=state.voltage_v if state else None,
                frequency_hz=state.frequency_hz if state else None,
                observed_at=state.observed_at if state else None,
                received_at=state.received_at if state else None,
                age_seconds=age,
                raw_metrics=state.raw_metrics if state else None,
            )
        )

    site_resp = SiteResponse(
        id=site.id,
        name=site.name,
        timezone=site.timezone,
        jurisdiction=site.jurisdiction,
        currency=site.currency,
        config_version=site.config_version,
        total_assets=len(assets),
    )

    return LiveTwinResponse(
        site=site_resp,
        aggregate=campus_agg,
        assets=asset_responses,
    )


@router.get("/telemetry/series", response_model=TelemetrySeriesResponse)
async def get_telemetry_series(
    asset_id: str = Query(..., description="Asset identifier"),
    metric_name: str = Query(..., description="Metric name to query"),
    start_time: Optional[datetime] = Query(None, description="Start range (ISO format)"),
    end_time: Optional[datetime] = Query(None, description="End range (ISO format)"),
    limit: int = Query(1000, ge=1, le=5000, description="Max data points to return"),
    session: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    """Retrieves historical interval telemetry points for an asset."""
    now_dt = utc_now()
    end_dt = end_time or now_dt
    start_dt = start_time or (end_dt - timedelta(hours=24))

    stmt = (
        select(TelemetryPoint)
        .where(
            TelemetryPoint.asset_id == asset_id,
            TelemetryPoint.metric_name == metric_name,
            TelemetryPoint.observed_at >= start_dt,
            TelemetryPoint.observed_at <= end_dt,
        )
        .order_by(TelemetryPoint.observed_at.asc())
        .limit(limit)
    )
    result = await session.execute(stmt)
    records = list(result.scalars().all())

    points = [
        TelemetrySeriesPoint(
            observed_at=r.observed_at,
            value=r.value,
            unit=r.unit,
            quality=r.quality.value,
            source_adapter=r.source_adapter,
        )
        for r in records
    ]

    return TelemetrySeriesResponse(
        asset_id=asset_id,
        metric_name=metric_name,
        count=len(points),
        points=points,
    )
