from datetime import datetime, timezone

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from backend.db.repositories.decision_repo import DecisionRepository
from backend.models.base import Base
from backend.models.config import (
    BatteryConfig,
    BuildingConfig,
    CriticalityTier,
    VNMSharingRule,
)
from backend.models.decision_log import (
    DecisionCycleStatus,
)
from backend.models.digital_twin import Asset, AssetType, Site
from backend.models.telemetry import (
    AssetTelemetrySnapshot,
    CanonicalMeasurement,
    EnergySnapshot,
    TelemetryQuality,
)
from backend.services.decision_manager import DecisionManager


@pytest.fixture
async def async_db_session():
    """Provides an isolated in-memory SQLite database session."""
    engine = create_async_engine(
        "sqlite+aiosqlite://",
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_maker = async_sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    async with session_maker() as session:
        yield session

    await engine.dispose()


@pytest.fixture
async def seeded_site_and_assets(async_db_session: AsyncSession):
    # Create Site
    site = Site(
        id=1,
        name="Surya Main Campus",
        timezone="Asia/Kolkata",
        jurisdiction="IN-KA",
        currency="INR",
        config_version=1,
    )
    async_db_session.add(site)

    # Create Assets: Solar, Battery, 2 Buildings
    assets = [
        Asset(
            id="solar-01",
            site_id=1,
            name="Rooftop Solar Array",
            asset_type=AssetType.SOLAR,
            rated_capacity_kw=200.0,
            is_active=True,
        ),
        Asset(
            id="batt-01",
            site_id=1,
            name="Main BESS Battery",
            asset_type=AssetType.BATTERY,
            rated_capacity_kw=100.0,
            is_active=True,
        ),
        Asset(
            id="bldg-01",
            site_id=1,
            name="Science Block",
            asset_type=AssetType.BUILDING,
            rated_capacity_kw=100.0,
            is_active=True,
        ),
        Asset(
            id="bldg-02",
            site_id=1,
            name="Hostel Block",
            asset_type=AssetType.BUILDING,
            rated_capacity_kw=80.0,
            is_active=True,
        ),
    ]
    async_db_session.add_all(assets)

    # Building Configs
    b_configs = [
        BuildingConfig(
            asset_id="bldg-01",
            building_name="Science Block",
            criticality_tier=CriticalityTier.CRITICAL,
            flexible_load_policy="protected",
            peak_load_kw=100.0,
        ),
        BuildingConfig(
            asset_id="bldg-02",
            building_name="Hostel Block",
            criticality_tier=CriticalityTier.NON_CRITICAL,
            flexible_load_policy="flexible",
            peak_load_kw=80.0,
        ),
    ]
    async_db_session.add_all(b_configs)

    # Battery Config
    batt_cfg = BatteryConfig(
        asset_id="batt-01",
        min_soc=10.0,
        max_soc=95.0,
        reserve_floor=25.0,
        max_charge_power_kw=100.0,
        max_discharge_power_kw=100.0,
        round_trip_efficiency=0.92,
        health_floor=70.0,
    )
    async_db_session.add(batt_cfg)

    # VNM Rules
    vnm_rules = [
        VNMSharingRule(
            building_asset_id="bldg-01",
            sharing_ratio=0.6,
            rule_version=1,
            jurisdiction="IN-KA",
        ),
        VNMSharingRule(
            building_asset_id="bldg-02",
            sharing_ratio=0.4,
            rule_version=1,
            jurisdiction="IN-KA",
        ),
    ]
    async_db_session.add_all(vnm_rules)
    await async_db_session.commit()

    return {
        "site": site,
        "assets": assets,
        "building_configs": b_configs,
        "battery_configs": {"batt-01": batt_cfg},
        "vnm_rules": vnm_rules,
    }


@pytest.mark.asyncio
async def test_decision_cycle_normal_execution(
    async_db_session: AsyncSession, seeded_site_and_assets: dict
):
    now = datetime(2026, 6, 21, 12, 0, 0, tzinfo=timezone.utc)
    snapshot = EnergySnapshot(
        site_id=1,
        snapshot_id="snap-test-01",
        captured_at=now,
        adapter_id="rest_primary",
        assets={
            "solar-01": AssetTelemetrySnapshot(
                asset_id="solar-01",
                asset_type=AssetType.SOLAR,
                status="online",
                quality=TelemetryQuality.GOOD,
                observed_at=now,
                measurements={
                    "active_power_kw": CanonicalMeasurement(
                        metric_name="active_power_kw",
                        value=150.0,
                        unit="kW",
                        observed_at=now,
                    )
                },
            ),
            "batt-01": AssetTelemetrySnapshot(
                asset_id="batt-01",
                asset_type=AssetType.BATTERY,
                status="online",
                quality=TelemetryQuality.GOOD,
                observed_at=now,
                measurements={
                    "soc_percent": CanonicalMeasurement(
                        metric_name="soc_percent",
                        value=70.0,
                        unit="%",
                        observed_at=now,
                    ),
                    "active_power_kw": CanonicalMeasurement(
                        metric_name="active_power_kw",
                        value=0.0,
                        unit="kW",
                        observed_at=now,
                    ),
                },
            ),
            "bldg-01": AssetTelemetrySnapshot(
                asset_id="bldg-01",
                asset_type=AssetType.BUILDING,
                status="online",
                quality=TelemetryQuality.GOOD,
                observed_at=now,
                measurements={
                    "active_power_kw": CanonicalMeasurement(
                        metric_name="active_power_kw",
                        value=60.0,
                        unit="kW",
                        observed_at=now,
                    )
                },
            ),
            "bldg-02": AssetTelemetrySnapshot(
                asset_id="bldg-02",
                asset_type=AssetType.BUILDING,
                status="online",
                quality=TelemetryQuality.GOOD,
                observed_at=now,
                measurements={
                    "active_power_kw": CanonicalMeasurement(
                        metric_name="active_power_kw",
                        value=40.0,
                        unit="kW",
                        observed_at=now,
                    )
                },
            ),
        },
    )

    manager = DecisionManager(session=async_db_session)
    result = await manager.run_decision_cycle(
        site_id=1,
        snapshot=snapshot,
        closed_loop_enabled=True,
        building_configs=seeded_site_and_assets["building_configs"],
        battery_configs=seeded_site_and_assets["battery_configs"],
        vnm_rules=seeded_site_and_assets["vnm_rules"],
    )

    assert result.status in (DecisionCycleStatus.COMPLETED, DecisionCycleStatus.DEGRADED)
    assert result.duration_ms > 0.0
    assert len(result.decisions) >= 3  # dispatch, battery, vnm
    assert len(result.alternatives) > 0

    # Verify immutable persistence in database
    dec_repo = DecisionRepository(async_db_session)
    cycle = await dec_repo.get_cycle(result.cycle_id)
    assert cycle is not None
    assert cycle.status == result.status
    assert len(cycle.decisions) == len(result.decisions)
    assert len(cycle.alternatives) == len(result.alternatives)


@pytest.mark.asyncio
async def test_decision_cycle_emergency_stop_blocked(
    async_db_session: AsyncSession, seeded_site_and_assets: dict
):
    manager = DecisionManager(session=async_db_session)
    result = await manager.run_decision_cycle(
        site_id=1,
        emergency_stop_active=True,
    )

    assert result.status == DecisionCycleStatus.BLOCKED
    assert "Emergency Stop" in result.reason
    assert len(result.commands) == 0

    dec_repo = DecisionRepository(async_db_session)
    cycle = await dec_repo.get_cycle(result.cycle_id)
    assert cycle.status == DecisionCycleStatus.BLOCKED


@pytest.mark.asyncio
async def test_decision_repo_queries_and_stats(
    async_db_session: AsyncSession, seeded_site_and_assets: dict
):
    now = datetime(2026, 6, 21, 12, 0, 0, tzinfo=timezone.utc)
    snapshot = EnergySnapshot(
        site_id=1,
        snapshot_id="snap-test-02",
        captured_at=now,
        adapter_id="rest_primary",
        assets={
            "solar-01": AssetTelemetrySnapshot(
                asset_id="solar-01",
                asset_type=AssetType.SOLAR,
                status="online",
                quality=TelemetryQuality.GOOD,
                observed_at=now,
                measurements={
                    "active_power_kw": CanonicalMeasurement(
                        metric_name="active_power_kw",
                        value=120.0,
                        unit="kW",
                        observed_at=now,
                    )
                },
            ),
        },
    )

    manager = DecisionManager(session=async_db_session)
    result = await manager.run_decision_cycle(
        site_id=1,
        snapshot=snapshot,
        building_configs=seeded_site_and_assets["building_configs"],
        battery_configs=seeded_site_and_assets["battery_configs"],
        vnm_rules=seeded_site_and_assets["vnm_rules"],
    )

    dec_repo = DecisionRepository(async_db_session)
    # Query latest cycle
    latest = await dec_repo.get_latest_cycle(site_id=1)
    assert latest is not None
    assert latest.id == result.cycle_id

    # Query decisions list
    decs = await dec_repo.get_decisions(site_id=1, limit=10)
    assert len(decs) > 0

    # Query stats
    stats = await dec_repo.get_decision_stats(site_id=1)
    assert stats["site_id"] == 1
    assert stats["total_decisions"] > 0
    assert "by_type" in stats
