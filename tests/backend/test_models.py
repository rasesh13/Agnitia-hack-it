from datetime import datetime, timezone

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from backend.models.base import Base
from backend.models.config import (
    AlertSeverity,
    AlertThreshold,
    AuditEvent,
    BatteryConfig,
    BuildingConfig,
    CriticalityTier,
    VNMSharingRule,
)
from backend.models.digital_twin import Asset, AssetType, Site
from backend.models.user import User, UserRole


@pytest.fixture
async def session():
    """Provides an isolated AsyncSession with all models initialized."""
    engine = create_async_engine(
        "sqlite+aiosqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_maker = async_sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    async with session_maker() as s:
        yield s

    await engine.dispose()


@pytest.mark.asyncio
async def test_site_and_asset_hierarchy(session: AsyncSession):
    """Verify site creation, asset hierarchy, and child relationships."""
    site = Site(
        name="IISc Campus Microgrid",
        timezone="Asia/Kolkata",
        jurisdiction="IN-KA",
        currency="INR",
    )
    session.add(site)
    await session.commit()
    await session.refresh(site)

    assert site.id is not None
    assert site.name == "IISc Campus Microgrid"

    # Create building asset
    bldg = Asset(
        id="bldg_eng_01",
        name="Engineering Block",
        asset_type=AssetType.BUILDING,
        site_id=site.id,
    )
    session.add(bldg)
    await session.commit()

    # Create child solar asset
    solar = Asset(
        id="solar_eng_rooftop_01",
        name="Engineering Rooftop Solar PV",
        asset_type=AssetType.SOLAR,
        site_id=site.id,
        parent_asset_id=bldg.id,
        rated_capacity_kw=150.0,
    )
    session.add(solar)
    await session.commit()
    await session.refresh(solar)

    assert solar.parent_asset_id == "bldg_eng_01"
    assert solar.rated_capacity_kw == 150.0

    # Query site assets
    stmt = select(Asset).where(Asset.site_id == site.id)
    result = await session.execute(stmt)
    assets = result.scalars().all()
    assert len(assets) == 2


@pytest.mark.asyncio
async def test_building_and_battery_configs(session: AsyncSession):
    """Verify BuildingConfig and BatteryConfig persistence with operational parameters."""
    site = Site(name="Test Campus")
    session.add(site)
    await session.commit()

    bldg_asset = Asset(
        id="bldg_admin_01",
        name="Administration Building",
        asset_type=AssetType.BUILDING,
        site_id=site.id,
    )
    batt_asset = Asset(
        id="batt_bess_01",
        name="Central BESS",
        asset_type=AssetType.BATTERY,
        site_id=site.id,
        rated_capacity_kw=500.0,
    )
    session.add_all([bldg_asset, batt_asset])
    await session.commit()

    bldg_cfg = BuildingConfig(
        asset_id=bldg_asset.id,
        building_name="Administration Building",
        criticality_tier=CriticalityTier.CRITICAL,
        flexible_load_policy="protected",
        peak_load_kw=120.0,
        operational_metadata={"hvac_zones": 4, "backup_generator": True},
    )
    batt_cfg = BatteryConfig(
        asset_id=batt_asset.id,
        min_soc=15.0,
        max_soc=90.0,
        reserve_floor=25.0,
        max_charge_power_kw=250.0,
        max_discharge_power_kw=250.0,
        round_trip_efficiency=0.94,
        health_floor=75.0,
    )
    session.add_all([bldg_cfg, batt_cfg])
    await session.commit()

    # Verify building config query
    stmt_bldg = select(BuildingConfig).where(BuildingConfig.asset_id == bldg_asset.id)
    res_bldg = await session.execute(stmt_bldg)
    found_bldg = res_bldg.scalar_one()
    assert found_bldg.criticality_tier == CriticalityTier.CRITICAL
    assert found_bldg.operational_metadata["hvac_zones"] == 4

    # Verify battery config query
    stmt_batt = select(BatteryConfig).where(BatteryConfig.asset_id == batt_asset.id)
    res_batt = await session.execute(stmt_batt)
    found_batt = res_batt.scalar_one()
    assert found_batt.reserve_floor == 25.0
    assert found_batt.round_trip_efficiency == 0.94


@pytest.mark.asyncio
async def test_alert_threshold_and_vnm_rules(session: AsyncSession):
    """Verify AlertThreshold, VNMSharingRule, and AuditEvent models."""
    site = Site(name="Green Campus")
    user = User(email="admin@green-energy.com", role=UserRole.ADMIN)
    session.add_all([site, user])
    await session.commit()

    bldg_asset = Asset(
        id="bldg_lib_01",
        name="Library Building",
        asset_type=AssetType.BUILDING,
        site_id=site.id,
    )
    session.add(bldg_asset)
    await session.commit()

    threshold = AlertThreshold(
        metric_name="battery_soc_low",
        threshold_value=20.0,
        unit="%",
        severity=AlertSeverity.CRITICAL,
        updated_by_user_id=user.id,
    )
    vnm_rule = VNMSharingRule(
        building_asset_id=bldg_asset.id,
        sharing_ratio=0.40,
        rule_version=1,
        jurisdiction="IN-KA",
        effective_from=datetime.now(timezone.utc),
        updated_by_user_id=user.id,
    )
    audit = AuditEvent(
        event_type="CONFIG_UPDATE",
        user_id=user.id,
        actor=f"user:{user.id}",
        action="UPDATE_VNM_RULE",
        resource_type="vnm_sharing_rules",
        resource_id=str(bldg_asset.id),
        details={"ratio": 0.40},
    )
    session.add_all([threshold, vnm_rule, audit])
    await session.commit()

    # Query audit events
    stmt_audit = select(AuditEvent).where(AuditEvent.event_type == "CONFIG_UPDATE")
    res_audit = await session.execute(stmt_audit)
    audits = res_audit.scalars().all()
    assert len(audits) == 1
    assert audits[0].actor == f"user:{user.id}"
    assert audits[0].details["ratio"] == 0.40
