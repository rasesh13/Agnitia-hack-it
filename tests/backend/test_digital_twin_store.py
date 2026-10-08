from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from backend.db.repositories.twin_repo import TwinRepository
from backend.models.base import Base
from backend.models.digital_twin import Asset, AssetType, Site
from backend.models.telemetry import (
    AssetTelemetrySnapshot,
    CanonicalMeasurement,
    EnergySnapshot,
    TelemetryQuality,
)
from backend.services.digital_twin_store import DigitalTwinStore


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

    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as session:
        yield session

    await engine.dispose()


@pytest.fixture
async def seeded_site_and_assets(async_db_session: AsyncSession):
    site = Site(
        id=1,
        name="SURYA Renewable Campus",
        timezone="Asia/Kolkata",
        jurisdiction="India",
        currency="INR",
    )
    async_db_session.add(site)

    assets = [
        Asset(
            id="solar-01",
            name="Rooftop Solar Array",
            asset_type=AssetType.SOLAR,
            site_id=1,
            rated_capacity_kw=100.0,
        ),
        Asset(
            id="wind-01",
            name="Campus Wind Turbine",
            asset_type=AssetType.WIND,
            site_id=1,
            rated_capacity_kw=50.0,
        ),
        Asset(
            id="batt-01",
            name="BESS Battery Unit",
            asset_type=AssetType.BATTERY,
            site_id=1,
            rated_capacity_kw=60.0,
        ),
        Asset(
            id="bldg-01",
            name="Academic Block A",
            asset_type=AssetType.BUILDING,
            site_id=1,
            rated_capacity_kw=80.0,
        ),
        Asset(
            id="grid-01",
            name="Main Grid Incomer",
            asset_type=AssetType.GRID,
            site_id=1,
            rated_capacity_kw=200.0,
        ),
    ]
    async_db_session.add_all(assets)
    await async_db_session.commit()
    return site


@pytest.mark.asyncio
async def test_update_from_snapshot_and_aggregates(
    async_db_session: AsyncSession, seeded_site_and_assets
):
    repo = TwinRepository(async_db_session)
    store = DigitalTwinStore(repo)
    now = datetime(2026, 10, 8, 14, 0, 0, tzinfo=timezone.utc)

    # Snapshot with:
    # Solar generating 40 kW
    # Wind generating 15 kW
    # Building consuming 30 kW
    # Battery discharging 10 kW (SoC 75%)
    # Grid importing 5 kW
    snapshot = EnergySnapshot(
        site_id=1,
        snapshot_id="snap-001",
        captured_at=now,
        adapter_id="rest_primary",
        assets={
            "solar-01": AssetTelemetrySnapshot(
                asset_id="solar-01",
                asset_type=AssetType.SOLAR,
                observed_at=now - timedelta(seconds=2),
                status="online",
                quality=TelemetryQuality.GOOD,
                measurements={
                    "active_power_kw": CanonicalMeasurement(
                        metric_name="active_power_kw",
                        value=40.0,
                        unit="kW",
                        observed_at=now - timedelta(seconds=2),
                    ),
                    "energy_kwh": CanonicalMeasurement(
                        metric_name="energy_kwh",
                        value=1200.0,
                        unit="kWh",
                        observed_at=now - timedelta(seconds=2),
                    ),
                },
            ),
            "wind-01": AssetTelemetrySnapshot(
                asset_id="wind-01",
                asset_type=AssetType.WIND,
                observed_at=now - timedelta(seconds=2),
                status="online",
                quality=TelemetryQuality.GOOD,
                measurements={
                    "active_power_kw": CanonicalMeasurement(
                        metric_name="active_power_kw",
                        value=15.0,
                        unit="kW",
                        observed_at=now - timedelta(seconds=2),
                    ),
                    "wind_speed_ms": CanonicalMeasurement(
                        metric_name="wind_speed_ms",
                        value=8.5,
                        unit="m/s",
                        observed_at=now - timedelta(seconds=2),
                    ),
                },
            ),
            "bldg-01": AssetTelemetrySnapshot(
                asset_id="bldg-01",
                asset_type=AssetType.BUILDING,
                observed_at=now - timedelta(seconds=2),
                status="online",
                quality=TelemetryQuality.GOOD,
                measurements={
                    "active_power_kw": CanonicalMeasurement(
                        metric_name="active_power_kw",
                        value=30.0,
                        unit="kW",
                        observed_at=now - timedelta(seconds=2),
                    )
                },
            ),
            "batt-01": AssetTelemetrySnapshot(
                asset_id="batt-01",
                asset_type=AssetType.BATTERY,
                observed_at=now - timedelta(seconds=2),
                status="online",
                quality=TelemetryQuality.GOOD,
                measurements={
                    "active_power_kw": CanonicalMeasurement(
                        metric_name="active_power_kw",
                        value=10.0,  # discharging 10 kW
                        unit="kW",
                        observed_at=now - timedelta(seconds=2),
                    ),
                    "battery_soc": CanonicalMeasurement(
                        metric_name="battery_soc",
                        value=75.0,
                        unit="%",
                        observed_at=now - timedelta(seconds=2),
                    ),
                },
            ),
            "grid-01": AssetTelemetrySnapshot(
                asset_id="grid-01",
                asset_type=AssetType.GRID,
                observed_at=now - timedelta(seconds=2),
                status="online",
                quality=TelemetryQuality.GOOD,
                measurements={
                    "active_power_kw": CanonicalMeasurement(
                        metric_name="active_power_kw",
                        value=5.0,  # importing 5 kW
                        unit="kW",
                        observed_at=now - timedelta(seconds=2),
                    )
                },
            ),
        },
    )

    agg = await store.update_from_snapshot(snapshot, record_telemetry=True)

    assert agg.site_id == 1
    assert agg.total_solar_kw == pytest.approx(40.0)
    assert agg.total_wind_kw == pytest.approx(15.0)
    assert agg.total_generation_kw == pytest.approx(55.0)
    assert agg.total_building_demand_kw == pytest.approx(30.0)
    assert agg.total_battery_discharge_kw == pytest.approx(10.0)
    assert agg.total_battery_charge_kw == pytest.approx(0.0)
    assert agg.net_battery_kw == pytest.approx(10.0)
    assert agg.grid_import_kw == pytest.approx(5.0)
    assert agg.net_grid_flow_kw == pytest.approx(5.0)
    assert agg.average_battery_soc_percent == pytest.approx(75.0)
    assert agg.online_assets_count == 5
    assert agg.offline_assets_count == 0
    assert agg.overall_quality == TelemetryQuality.GOOD

    # Verify states persisted in DB
    solar_state = await repo.get_asset_state("solar-01")
    assert solar_state is not None
    assert solar_state.active_power_kw == pytest.approx(40.0)
    assert solar_state.energy_kwh == pytest.approx(1200.0)
    assert solar_state.operational_status == "online"

    # Verify telemetry series in DB
    series = await repo.get_telemetry_series(
        asset_id="solar-01",
        metric_name="active_power_kw",
        start_time=now - timedelta(minutes=5),
        end_time=now + timedelta(minutes=5),
    )
    assert len(series) == 1
    assert series[0].value == pytest.approx(40.0)


@pytest.mark.asyncio
async def test_quality_and_degraded_assets(
    async_db_session: AsyncSession, seeded_site_and_assets
):
    repo = TwinRepository(async_db_session)
    store = DigitalTwinStore(repo)
    now = datetime(2026, 10, 8, 14, 0, 0, tzinfo=timezone.utc)

    snapshot = EnergySnapshot(
        site_id=1,
        snapshot_id="snap-002",
        captured_at=now,
        adapter_id="rest_primary",
        assets={
            "solar-01": AssetTelemetrySnapshot(
                asset_id="solar-01",
                asset_type=AssetType.SOLAR,
                observed_at=now - timedelta(seconds=2),
                status="online",
                quality=TelemetryQuality.GOOD,
                measurements={
                    "active_power_kw": CanonicalMeasurement(
                        metric_name="active_power_kw",
                        value=50.0,
                        unit="kW",
                        observed_at=now - timedelta(seconds=2),
                    )
                },
            ),
            "wind-01": AssetTelemetrySnapshot(
                asset_id="wind-01",
                asset_type=AssetType.WIND,
                observed_at=now - timedelta(seconds=45),
                status="stale",
                quality=TelemetryQuality.STALE,
                measurements={
                    "active_power_kw": CanonicalMeasurement(
                        metric_name="active_power_kw",
                        value=10.0,
                        unit="kW",
                        observed_at=now - timedelta(seconds=45),
                        quality=TelemetryQuality.STALE,
                    )
                },
            ),
            "batt-01": AssetTelemetrySnapshot(
                asset_id="batt-01",
                asset_type=AssetType.BATTERY,
                observed_at=None,
                status="offline",
                quality=TelemetryQuality.MISSING,
                measurements={},
            ),
        },
    )

    agg = await store.update_from_snapshot(snapshot, record_telemetry=False)
    assert agg.online_assets_count == 1
    assert agg.stale_assets_count == 1
    assert agg.offline_assets_count == 1
    assert agg.overall_quality == TelemetryQuality.SUSPECT


@pytest.mark.asyncio
async def test_get_live_twin(async_db_session: AsyncSession, seeded_site_and_assets):
    repo = TwinRepository(async_db_session)
    store = DigitalTwinStore(repo)
    now = datetime(2026, 10, 8, 14, 0, 0, tzinfo=timezone.utc)

    snapshot = EnergySnapshot(
        site_id=1,
        snapshot_id="snap-003",
        captured_at=now,
        adapter_id="rest_primary",
        assets={
            "solar-01": AssetTelemetrySnapshot(
                asset_id="solar-01",
                asset_type=AssetType.SOLAR,
                observed_at=now,
                status="online",
                quality=TelemetryQuality.GOOD,
                measurements={
                    "active_power_kw": CanonicalMeasurement(
                        metric_name="active_power_kw",
                        value=35.0,
                        unit="kW",
                        observed_at=now,
                    )
                },
            )
        },
    )

    await store.update_from_snapshot(snapshot, record_telemetry=True)
    twin_data = await store.get_live_twin(1)

    assert "site" in twin_data
    assert twin_data["site"]["name"] == "SURYA Renewable Campus"
    assert "aggregate" in twin_data
    assert "assets" in twin_data
    assert len(twin_data["assets"]) >= 1
