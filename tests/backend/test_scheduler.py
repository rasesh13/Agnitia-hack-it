import asyncio
from datetime import datetime, timezone

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from backend.config import Settings
from backend.models.base import Base
from backend.models.config import BatteryConfig
from backend.models.decision_log import DecisionCycleStatus
from backend.models.digital_twin import Asset, AssetType, Site
from backend.models.telemetry import (
    AssetTelemetrySnapshot,
    CanonicalMeasurement,
    EnergySnapshot,
    TelemetryQuality,
)
from backend.services.scheduler import DecisionScheduler


@pytest.fixture
async def async_session_factory():
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

    # Seed initial test site and assets
    async with session_maker() as session:
        async with session.begin():
            site = Site(
                id=1,
                name="Surya Main Campus",
                timezone="Asia/Kolkata",
                jurisdiction="IN-KA",
                currency="INR",
                config_version=1,
            )
            session.add(site)

            assets = [
                Asset(
                    id="solar-01",
                    site_id=1,
                    name="Solar Array",
                    asset_type=AssetType.SOLAR,
                    rated_capacity_kw=100.0,
                    is_active=True,
                ),
                Asset(
                    id="batt-01",
                    site_id=1,
                    name="Battery",
                    asset_type=AssetType.BATTERY,
                    rated_capacity_kw=100.0,
                    is_active=True,
                ),
            ]
            session.add_all(assets)

            batt_cfg = BatteryConfig(
                asset_id="batt-01",
                min_soc=10.0,
                max_soc=95.0,
                reserve_floor=25.0,
                max_charge_power_kw=50.0,
                max_discharge_power_kw=50.0,
            )
            session.add(batt_cfg)

    yield session_maker
    await engine.dispose()


@pytest.fixture
def mock_snapshot() -> EnergySnapshot:
    now = datetime(2026, 6, 21, 12, 0, 0, tzinfo=timezone.utc)
    return EnergySnapshot(
        site_id=1,
        snapshot_id="snap-sched-01",
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
                        value=80.0,
                        unit="kW",
                        observed_at=now,
                    )
                },
            ),
        },
    )


@pytest.mark.asyncio
async def test_scheduler_execute_cycle_success(
    async_session_factory, mock_snapshot: EnergySnapshot
):
    scheduler = DecisionScheduler(
        session_factory=async_session_factory,
        snapshot_provider=lambda: mock_snapshot,
    )

    result = await scheduler.execute_cycle(site_id=1)
    assert result is not None
    assert result.status in (DecisionCycleStatus.COMPLETED, DecisionCycleStatus.DEGRADED)
    assert scheduler.total_cycles_executed == 1
    assert scheduler.consecutive_failures == 0
    assert scheduler.last_cycle_status == result.status


@pytest.mark.asyncio
async def test_scheduler_concurrency_lock_prevents_overlap(
    async_session_factory, mock_snapshot: EnergySnapshot
):
    scheduler = DecisionScheduler(
        session_factory=async_session_factory,
        snapshot_provider=lambda: mock_snapshot,
    )

    # Manually hold the internal lock
    async with scheduler._lock:
        assert scheduler.is_locked is True
        # Attempt to trigger cycle concurrently -> must skip and return None
        result = await scheduler.execute_cycle(site_id=1)
        assert result is None

    assert scheduler.is_locked is False


@pytest.mark.asyncio
async def test_scheduler_emergency_stop_toggle(
    async_session_factory, mock_snapshot: EnergySnapshot
):
    scheduler = DecisionScheduler(
        session_factory=async_session_factory,
        snapshot_provider=lambda: mock_snapshot,
    )

    scheduler.set_emergency_stop(True)
    assert scheduler.emergency_stop_active is True

    result = await scheduler.execute_cycle(site_id=1)
    assert result is not None
    assert result.status == DecisionCycleStatus.BLOCKED
    assert len(result.commands) == 0


@pytest.mark.asyncio
async def test_scheduler_closed_loop_toggle(
    async_session_factory, mock_snapshot: EnergySnapshot
):
    scheduler = DecisionScheduler(
        session_factory=async_session_factory,
        snapshot_provider=lambda: mock_snapshot,
    )

    scheduler.set_closed_loop(True)
    assert scheduler.closed_loop_enabled is True

    batt_configs = {
        "batt-01": BatteryConfig(
            asset_id="batt-01",
            min_soc=10.0,
            max_soc=95.0,
            reserve_floor=25.0,
            max_charge_power_kw=50.0,
            max_discharge_power_kw=50.0,
        )
    }

    result = await scheduler.execute_cycle(
        site_id=1,
        battery_configs=batt_configs,
    )
    assert result is not None


@pytest.mark.asyncio
async def test_scheduler_background_start_and_stop(
    async_session_factory, mock_snapshot: EnergySnapshot
):
    settings = Settings(
        DECISION_CYCLE_SECONDS=1,
        JWT_SECRET_KEY="test_key_min_32_characters_long_for_test",
    )
    scheduler = DecisionScheduler(
        session_factory=async_session_factory,
        settings=settings,
        snapshot_provider=lambda: mock_snapshot,
    )

    scheduler.start()
    assert scheduler.is_running is True

    # Allow loop to execute at least once
    await asyncio.sleep(1.2)

    await scheduler.stop()
    assert scheduler.is_running is False
    assert scheduler.total_cycles_executed >= 1


@pytest.mark.asyncio
async def test_scheduler_health_diagnostics(
    async_session_factory, mock_snapshot: EnergySnapshot
):
    scheduler = DecisionScheduler(
        session_factory=async_session_factory,
        snapshot_provider=lambda: mock_snapshot,
    )
    await scheduler.execute_cycle(site_id=1)

    health = scheduler.get_health_status()
    assert "is_running" in health
    assert "is_locked" in health
    assert "last_cycle_status" in health
    assert health["total_cycles_executed"] == 1
    assert health["consecutive_failures"] == 0
