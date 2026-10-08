from datetime import datetime, timezone

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from backend.api.routes_health import set_global_scheduler
from backend.db.database import get_db
from backend.main import app
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
from backend.models.user import User, UserRole
from backend.services.auth_crypto import create_access_token, hash_password
from backend.services.scheduler import DecisionScheduler


@pytest.fixture
async def test_db():
    engine = create_async_engine(
        "sqlite+aiosqlite://",
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    yield async_session
    await engine.dispose()


@pytest.fixture
async def seed_data(test_db):
    now = datetime(2026, 10, 8, 14, 0, 0, tzinfo=timezone.utc)
    async with test_db() as session:
        # Users
        admin_user = User(
            id=1,
            email="admin@surya-energy.com",
            password_hash=hash_password("AdminSecret123!"),
            role=UserRole.ADMIN,
            is_active=True,
            token_version=1,
        )
        operator_user = User(
            id=2,
            email="operator@surya-energy.com",
            password_hash=hash_password("OperatorSecret123!"),
            role=UserRole.OPERATOR,
            is_active=True,
            token_version=1,
        )
        viewer_user = User(
            id=3,
            email="viewer@surya-energy.com",
            password_hash=hash_password("ViewerSecret123!"),
            role=UserRole.VIEWER,
            is_active=True,
            token_version=1,
        )
        session.add_all([admin_user, operator_user, viewer_user])

        # Site
        site = Site(
            id=1,
            name="SURYA Main Campus",
            timezone="Asia/Kolkata",
            jurisdiction="India",
            currency="INR",
            config_version=1,
        )
        session.add(site)

        # Assets
        solar = Asset(
            id="solar-01",
            name="Main Solar Array",
            asset_type=AssetType.SOLAR,
            site_id=1,
            rated_capacity_kw=150.0,
        )
        batt = Asset(
            id="batt-01",
            name="Campus BESS Unit",
            asset_type=AssetType.BATTERY,
            site_id=1,
            rated_capacity_kw=100.0,
        )
        bldg = Asset(
            id="bldg-01",
            name="Admin Block",
            asset_type=AssetType.BUILDING,
            site_id=1,
            rated_capacity_kw=75.0,
        )
        session.add_all([solar, batt, bldg])

        # Configs
        bldg_cfg = BuildingConfig(
            id=1,
            asset_id="bldg-01",
            building_name="Admin Block",
            criticality_tier=CriticalityTier.CRITICAL,
            peak_load_kw=75.0,
            flexible_load_policy="protected",
        )
        batt_cfg = BatteryConfig(
            id=1,
            asset_id="batt-01",
            min_soc=10.0,
            max_soc=95.0,
            reserve_floor=20.0,
            max_charge_power_kw=100.0,
            max_discharge_power_kw=100.0,
            round_trip_efficiency=0.92,
            health_floor=70.0,
        )
        threshold = AlertThreshold(
            id=1,
            metric_name="battery_soc_low",
            threshold_value=15.0,
            unit="percent",
            severity=AlertSeverity.WARNING,
            is_active=True,
        )
        vnm_rule = VNMSharingRule(
            id=1,
            building_asset_id="bldg-01",
            sharing_ratio=0.5,
            rule_version=1,
            jurisdiction="IN-KA",
        )
        session.add_all([bldg_cfg, batt_cfg, threshold, vnm_rule])

        # Decision Cycle & Decision Log
        cycle = DecisionCycle(
            id="cycle-test-01",
            site_id=1,
            status=DecisionCycleStatus.COMPLETED,
            input_snapshot_hash="hash-12345",
            cycle_started_at=now,
            cycle_completed_at=now,
            duration_ms=45.2,
        )
        session.add(cycle)

        dec = DecisionLog(
            id="dec-test-01",
            cycle_id="cycle-test-01",
            site_id=1,
            target_asset_id="batt-01",
            decision_type=DecisionType.BATTERY,
            action="CHARGE_FROM_SOLAR",
            setpoint_kw=40.0,
            allocated_kwh=10.0,
            allocated_value_inr=85.0,
            actor="system:optimizer",
            reason="Absorb solar surplus during peak daylight",
            confidence=0.98,
            expected_savings_inr=85.0,
            carbon_impact_kg=-7.2,
            created_at=now,
        )
        alt = DecisionAlternative(
            cycle_id="cycle-test-01",
            candidate_id="alt-grid-export",
            strategy_description="Export surplus solar power to grid",
            score=42.5,
            cost_component=35.0,
            carbon_component=7.5,
            is_selected=False,
            rejected_reason="Battery charging yields higher peak-shaving value",
            created_at=now,
        )
        cmd = ControlCommand(
            id="cmd-test-01",
            idempotency_key="idemp-key-01",
            decision_id="dec-test-01",
            target_asset_id="batt-01",
            action="CHARGE",
            requested_setpoint=40.0,
            unit="kW",
            status=CommandStatus.PENDING,
            valid_from=now,
            valid_until=now,
            reason="Charge battery from solar surplus",
            originating_actor="system:optimizer",
        )
        session.add_all([dec, alt, cmd])
        await session.commit()


@pytest.fixture
def auth_headers():
    admin_tok = create_access_token(user_id=1, email="admin@surya-energy.com", role=UserRole.ADMIN)
    operator_tok = create_access_token(
        user_id=2, email="operator@surya-energy.com", role=UserRole.OPERATOR
    )
    viewer_tok = create_access_token(
        user_id=3, email="viewer@surya-energy.com", role=UserRole.VIEWER
    )

    return {
        "admin": {"Authorization": f"Bearer {admin_tok}"},
        "operator": {"Authorization": f"Bearer {operator_tok}"},
        "viewer": {"Authorization": f"Bearer {viewer_tok}"},
    }


@pytest.fixture
def override_db(test_db):
    async def _get_db_override():
        async with test_db() as session:
            yield session

    app.dependency_overrides[get_db] = _get_db_override
    yield
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_health_routes(test_db, override_db):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Liveness probe
        res = await client.get("/health")
        assert res.status_code == 200
        assert res.json()["status"] == "ok"

        # Readiness probe
        res_ready = await client.get("/health/ready")
        assert res_ready.status_code == 200
        assert res_ready.json()["status"] == "ready"
        assert res_ready.json()["components"]["database"] == "healthy"

        # Scheduler probe without scheduler
        set_global_scheduler(None)
        res_sched = await client.get("/health/scheduler")
        assert res_sched.status_code == 200
        assert res_sched.json()["status"] == "idle"


@pytest.mark.asyncio
async def test_decision_routes(test_db, seed_data, auth_headers, override_db):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. List decisions with viewer token
        res = await client.get("/api/v1/decisions", headers=auth_headers["viewer"])
        assert res.status_code == 200
        data = res.json()
        assert len(data) >= 1
        assert data[0]["id"] == "dec-test-01"
        assert data[0]["decision_type"] == "battery"
        assert len(data[0]["commands"]) == 1

        # 2. Get latest cycle
        res_latest = await client.get("/api/v1/decisions/latest", headers=auth_headers["viewer"])
        assert res_latest.status_code == 200
        cycle_data = res_latest.json()
        assert cycle_data["id"] == "cycle-test-01"
        assert len(cycle_data["decisions"]) == 1
        assert len(cycle_data["alternatives"]) == 1
        assert cycle_data["alternatives"][0]["candidate_id"] == "alt-grid-export"

        # 3. Decision statistics
        res_stats = await client.get("/api/v1/decisions/stats", headers=auth_headers["viewer"])
        assert res_stats.status_code == 200
        stats = res_stats.json()
        assert stats["total_decisions"] == 1
        assert stats["total_savings_inr"] == 85.0
        assert "battery" in stats["by_type"]

        # 4. Get specific decision
        res_dec = await client.get(
            "/api/v1/decisions/dec-test-01", headers=auth_headers["viewer"]
        )
        assert res_dec.status_code == 200
        assert res_dec.json()["id"] == "dec-test-01"

        # 5. Non-existent decision returns 404
        res_not_found = await client.get(
            "/api/v1/decisions/non-existent", headers=auth_headers["viewer"]
        )
        assert res_not_found.status_code == 404


@pytest.mark.asyncio
async def test_settings_routes_permissions_and_updates(
    test_db, seed_data, auth_headers, override_db
):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Alert thresholds GET (viewer allowed)
        res = await client.get(
            "/api/v1/settings/alert-thresholds", headers=auth_headers["viewer"]
        )
        assert res.status_code == 200
        assert len(res.json()) >= 1

        # 2. Alert threshold PUT with viewer token (Forbidden)
        res_put_viewer = await client.put(
            "/api/v1/settings/alert-thresholds/1",
            json={"threshold_value": 25.0},
            headers=auth_headers["viewer"],
        )
        assert res_put_viewer.status_code == 403

        # 3. Alert threshold PUT with admin token (Success)
        res_put_admin = await client.put(
            "/api/v1/settings/alert-thresholds/1",
            json={"threshold_value": 22.5, "severity": "critical"},
            headers=auth_headers["admin"],
        )
        assert res_put_admin.status_code == 200
        assert res_put_admin.json()["threshold_value"] == 22.5
        assert res_put_admin.json()["severity"] == "critical"

        # 4. Building tiers PUT with admin token
        res_bldg = await client.put(
            "/api/v1/settings/building-tiers/bldg-01",
            json={"criticality_tier": "essential", "peak_load_kw": 90.0},
            headers=auth_headers["admin"],
        )
        assert res_bldg.status_code == 200
        assert res_bldg.json()["criticality_tier"] == "essential"
        assert res_bldg.json()["peak_load_kw"] == 90.0

        # 5. VNM rules POST and PUT with admin token
        res_vnm_post = await client.post(
            "/api/v1/settings/vnm-sharing-rules",
            json={"building_asset_id": "bldg-01", "sharing_ratio": 0.35},
            headers=auth_headers["admin"],
        )
        assert res_vnm_post.status_code == 201
        created_rule_id = res_vnm_post.json()["id"]

        res_vnm_put = await client.put(
            f"/api/v1/settings/vnm-sharing-rules/{created_rule_id}",
            json={"sharing_ratio": 0.45},
            headers=auth_headers["admin"],
        )
        assert res_vnm_put.status_code == 200
        assert res_vnm_put.json()["sharing_ratio"] == 0.45

        # 6. Battery config PUT with admin token
        res_batt = await client.put(
            "/api/v1/settings/assets/batt-01/battery",
            json={"min_soc": 12.0, "reserve_floor": 25.0},
            headers=auth_headers["admin"],
        )
        assert res_batt.status_code == 200
        assert res_batt.json()["min_soc"] == 12.0
        assert res_batt.json()["reserve_floor"] == 25.0

        # 7. Control policy GET and PUT
        res_policy = await client.get(
            "/api/v1/settings/control-policy", headers=auth_headers["viewer"]
        )
        assert res_policy.status_code == 200

        res_policy_put = await client.put(
            "/api/v1/settings/control-policy",
            json={"cost_weight": 0.8, "carbon_weight": 0.2},
            headers=auth_headers["admin"],
        )
        assert res_policy_put.status_code == 200
        assert res_policy_put.json()["cost_weight"] == 0.8

    # Verify audit events were written in database
    async with test_db() as session:
        from sqlalchemy import select

        audits = (await session.execute(select(AuditEvent))).scalars().all()
        assert len(audits) >= 4


@pytest.mark.asyncio
async def test_control_routes(test_db, seed_data, auth_headers, override_db):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Force cycle with viewer token (Forbidden)
        res_force_viewer = await client.post(
            "/api/v1/control/force-cycle",
            json={"site_id": 1},
            headers=auth_headers["viewer"],
        )
        assert res_force_viewer.status_code == 403

        # 2. Force cycle with operator token (Success)
        res_force_op = await client.post(
            "/api/v1/control/force-cycle",
            json={"site_id": 1},
            headers=auth_headers["operator"],
        )
        assert res_force_op.status_code == 200
        assert "cycle_id" in res_force_op.json()

        # 3. Command acknowledge with operator token
        res_ack = await client.post(
            "/api/v1/control/commands/cmd-test-01/acknowledge",
            json={"status": "executed", "reason": "Hardware relay confirmed closed"},
            headers=auth_headers["operator"],
        )
        assert res_ack.status_code == 200
        assert res_ack.json()["status"] == "executed"

        # 4. Emergency stop with operator token (Forbidden - Admin only)
        res_es_op = await client.post(
            "/api/v1/control/emergency-stop",
            json={"active": True, "reason": "Grid instability detected"},
            headers=auth_headers["operator"],
        )
        assert res_es_op.status_code == 403

        # 5. Emergency stop with admin token (Success)
        scheduler = DecisionScheduler(session_factory=test_db)
        set_global_scheduler(scheduler)

        res_es_admin = await client.post(
            "/api/v1/control/emergency-stop",
            json={"active": True, "reason": "Emergency battery isolation requested"},
            headers=auth_headers["admin"],
        )
        assert res_es_admin.status_code == 200
        assert res_es_admin.json()["emergency_stop_active"] is True
        assert scheduler.emergency_stop_active is True

        # Clean up scheduler registration
        set_global_scheduler(None)
