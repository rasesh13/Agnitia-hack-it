import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from backend.models.base import Base
from backend.models.decision_log import (
    CommandStatus,
    ControlCommand,
    DecisionAlternative,
    DecisionCycle,
    DecisionCycleStatus,
    DecisionLog,
    DecisionType,
)
from backend.models.digital_twin import Asset, AssetType, Site
from backend.models.telemetry import AssetCurrentState, TelemetryPoint, TelemetryQuality


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
async def test_telemetry_points_and_current_state(session: AsyncSession):
    """Verify telemetry point historical records and asset current state persistence."""
    site = Site(name="Campus South")
    session.add(site)
    await session.commit()

    solar = Asset(
        id="solar_bldg1_01",
        name="Building 1 Solar",
        asset_type=AssetType.SOLAR,
        site_id=site.id,
    )
    session.add(solar)
    await session.commit()

    now = datetime.now(timezone.utc)

    # Add historical telemetry point
    point = TelemetryPoint(
        asset_id=solar.id,
        metric_name="active_power_kw",
        value=85.5,
        unit="kW",
        quality=TelemetryQuality.GOOD,
        observed_at=now,
        received_at=now,
        source_adapter="rest",
    )
    session.add(point)

    # Upsert latest twin current state
    current_state = AssetCurrentState(
        asset_id=solar.id,
        operational_status="online",
        active_power_kw=85.5,
        telemetry_quality=TelemetryQuality.GOOD,
        observed_at=now,
        received_at=now,
    )
    session.add(current_state)
    await session.commit()

    # Query telemetry point
    stmt_tp = select(TelemetryPoint).where(TelemetryPoint.asset_id == solar.id)
    res_tp = await session.execute(stmt_tp)
    points = res_tp.scalars().all()
    assert len(points) == 1
    assert points[0].value == 85.5
    assert points[0].quality == TelemetryQuality.GOOD

    # Query current state
    stmt_cs = select(AssetCurrentState).where(AssetCurrentState.asset_id == solar.id)
    res_cs = await session.execute(stmt_cs)
    state = res_cs.scalar_one()
    assert state.operational_status == "online"
    assert state.active_power_kw == 85.5


@pytest.mark.asyncio
async def test_decision_cycles_and_audit_logs(session: AsyncSession):
    """Verify decision cycle creation, selected decision logs, and alternatives."""
    site = Site(name="Campus North")
    session.add(site)
    await session.commit()

    batt = Asset(
        id="battery_main_01",
        name="Main Campus BESS",
        asset_type=AssetType.BATTERY,
        site_id=site.id,
    )
    session.add(batt)
    await session.commit()

    cycle_id = str(uuid.uuid4())
    cycle = DecisionCycle(
        id=cycle_id,
        site_id=site.id,
        status=DecisionCycleStatus.COMPLETED,
        input_snapshot_hash="a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0",
        duration_ms=45.2,
        health_summary={"adapter_healthy": True, "stale_assets_count": 0},
    )
    session.add(cycle)

    # Selected decision
    decision = DecisionLog(
        id=str(uuid.uuid4()),
        cycle_id=cycle_id,
        site_id=site.id,
        target_asset_id=batt.id,
        decision_type=DecisionType.BATTERY,
        action="discharge",
        setpoint_kw=120.0,
        actor="system:optimizer",
        reason="Discharge to meet peak evening demand avoiding expensive grid tariff",
        confidence=0.98,
        expected_savings_inr=1020.0,
        carbon_impact_kg=-85.9,
    )

    # Considered alternative
    alternative = DecisionAlternative(
        cycle_id=cycle_id,
        candidate_id="cand_grid_import_full",
        strategy_description="Import 120kW directly from grid during peak hours",
        score=0.88,
        cost_component=0.85,
        carbon_component=0.92,
        is_selected=False,
        rejected_reason="Higher financial cost and carbon footprint than battery dispatch",
    )

    session.add_all([decision, alternative])
    await session.commit()

    # Query cycle with decisions and alternatives
    stmt = select(DecisionCycle).where(DecisionCycle.id == cycle_id)
    res = await session.execute(stmt)
    found_cycle = res.scalar_one()

    assert found_cycle.status == DecisionCycleStatus.COMPLETED
    assert len(found_cycle.decisions) == 1
    assert found_cycle.decisions[0].action == "discharge"
    assert found_cycle.decisions[0].expected_savings_inr == 1020.0
    assert len(found_cycle.alternatives) == 1
    assert found_cycle.alternatives[0].rejected_reason is not None


@pytest.mark.asyncio
async def test_control_command_tracking(session: AsyncSession):
    """Verify control command creation, validity window, and status."""
    site = Site(name="Campus East")
    session.add(site)
    await session.commit()

    batt = Asset(
        id="batt_east_01",
        name="East Battery",
        asset_type=AssetType.BATTERY,
        site_id=site.id,
    )
    session.add(batt)
    await session.commit()

    now = datetime.now(timezone.utc)
    cmd = ControlCommand(
        idempotency_key=f"cmd_batt_discharge_{uuid.uuid4().hex[:12]}",
        target_asset_id=batt.id,
        action="discharge",
        requested_setpoint=100.0,
        unit="kW",
        status=CommandStatus.ACCEPTED,
        valid_from=now,
        valid_until=now + timedelta(seconds=60),
        reason="Peak shaving dispatch command",
        originating_actor="system:optimizer",
        adapter_response={"status": "accepted", "acknowledged_at": now.isoformat()},
    )
    session.add(cmd)
    await session.commit()
    await session.refresh(cmd)

    assert cmd.status == CommandStatus.ACCEPTED
    assert cmd.target_asset_id == "batt_east_01"
    assert cmd.adapter_response["status"] == "accepted"
