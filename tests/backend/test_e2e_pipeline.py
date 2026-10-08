from datetime import datetime, timezone

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from backend.db.database import get_db
from backend.db.repositories.twin_repo import TwinRepository
from backend.main import app
from backend.models.base import Base
from backend.models.config import (
    AlertSeverity,
    AlertThreshold,
    BatteryConfig,
    BuildingConfig,
    CriticalityTier,
    VNMSharingRule,
)
from backend.models.digital_twin import Asset, AssetType, Site
from backend.models.telemetry import (
    AssetTelemetrySnapshot,
    CanonicalMeasurement,
    EnergySnapshot,
    TelemetryQuality,
)
from backend.models.user import User, UserRole
from backend.services.auth_crypto import hash_password
from backend.services.digital_twin_store import DigitalTwinStore


@pytest.fixture
async def e2e_db():
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
async def e2e_client(e2e_db):
    async def override_get_db():
        async with e2e_db() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
    app.dependency_overrides.clear()


@pytest.fixture
async def e2e_seed(e2e_db):
    now = datetime(2026, 10, 8, 12, 0, 0, tzinfo=timezone.utc)
    async with e2e_db() as session:
        admin = User(
            id=1,
            email="admin@campus-energy.in",
            password_hash=hash_password("SuperSecretAdmin123!"),
            role=UserRole.ADMIN,
            is_active=True,
        )
        operator = User(
            id=2,
            email="operator@campus-energy.in",
            password_hash=hash_password("OperatorSecret123!"),
            role=UserRole.OPERATOR,
            is_active=True,
        )
        session.add_all([admin, operator])

        site = Site(
            id=1,
            name="Main Academic Campus",
            timezone="Asia/Kolkata",
            jurisdiction="India-CEA",
            currency="INR",
            config_version=1,
        )
        session.add(site)

        solar = Asset(
            id="solar_pv_01",
            name="Rooftop Solar Array 1",
            asset_type=AssetType.SOLAR,
            site_id=1,
            rated_capacity_kw=100.0,
            is_active=True,
        )
        battery = Asset(
            id="bess_01",
            name="Lithium BESS Pack 1",
            asset_type=AssetType.BATTERY,
            site_id=1,
            rated_capacity_kw=50.0,
            is_active=True,
        )
        building = Asset(
            id="bldg_academic_a",
            name="Academic Block A",
            asset_type=AssetType.BUILDING,
            site_id=1,
            rated_capacity_kw=80.0,
            is_active=True,
        )
        grid_meter = Asset(
            id="grid_pcc_01",
            name="PCC Main Grid Infeed",
            asset_type=AssetType.GRID,
            site_id=1,
            rated_capacity_kw=200.0,
            is_active=True,
        )
        session.add_all([solar, battery, building, grid_meter])

        bess_cfg = BatteryConfig(
            id=1,
            asset_id="bess_01",
            min_soc=10.0,
            max_soc=95.0,
            reserve_floor=20.0,
            max_charge_power_kw=25.0,
            max_discharge_power_kw=25.0,
            round_trip_efficiency=0.92,
            health_floor=70.0,
            updated_at=now,
        )
        bldg_cfg = BuildingConfig(
            id=1,
            asset_id="bldg_academic_a",
            building_name="Academic Block A",
            criticality_tier=CriticalityTier.ESSENTIAL,
            peak_load_kw=60.0,
            updated_at=now,
        )
        vnm_rule = VNMSharingRule(
            id=1,
            building_asset_id="bldg_academic_a",
            sharing_ratio=1.0,
            rule_version=1,
            jurisdiction="India-CEA",
            effective_from=now,
            updated_at=now,
        )
        thresh = AlertThreshold(
            id=1,
            metric_name="total_campus_demand_kw",
            threshold_value=150.0,
            unit="kW",
            severity=AlertSeverity.WARNING,
            is_active=True,
            updated_at=now,
        )
        session.add_all([bess_cfg, bldg_cfg, vnm_rule, thresh])
        await session.commit()


@pytest.mark.asyncio
async def test_full_pipeline_e2e(e2e_client, e2e_seed, e2e_db):
    """Full End-to-End integration test across the entire SURYA platform."""
    # 1. User Authentication: Login as Admin
    login_res = await e2e_client.post(
        "/api/v1/auth/login",
        json={"email": "admin@campus-energy.in", "password": "SuperSecretAdmin123!"},
    )
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Ingest Hardware Telemetry for Digital Twin via Store
    now = datetime.now(timezone.utc)
    async with e2e_db() as session:
        repo = TwinRepository(session)
        store = DigitalTwinStore(repo)
        snapshot = EnergySnapshot(
            site_id=1,
            snapshot_id="snap-e2e-001",
            adapter_id="adapter_modbus_rtu",
            captured_at=now,
            assets={
                "solar_pv_01": AssetTelemetrySnapshot(
                    asset_id="solar_pv_01",
                    asset_type=AssetType.SOLAR,
                    observed_at=now,
                    status="online",
                    quality=TelemetryQuality.GOOD,
                    measurements={
                        "active_power_kw": CanonicalMeasurement(
                            metric_name="active_power_kw",
                            value=78.5,
                            unit="kW",
                            observed_at=now,
                            quality=TelemetryQuality.GOOD,
                        )
                    },
                ),
                "bess_01": AssetTelemetrySnapshot(
                    asset_id="bess_01",
                    asset_type=AssetType.BATTERY,
                    observed_at=now,
                    status="online",
                    quality=TelemetryQuality.GOOD,
                    measurements={
                        "soc_percent": CanonicalMeasurement(
                            metric_name="soc_percent",
                            value=65.0,
                            unit="%",
                            observed_at=now,
                            quality=TelemetryQuality.GOOD,
                        ),
                        "active_power_kw": CanonicalMeasurement(
                            metric_name="active_power_kw",
                            value=0.0,
                            unit="kW",
                            observed_at=now,
                            quality=TelemetryQuality.GOOD,
                        ),
                    },
                ),
                "bldg_academic_a": AssetTelemetrySnapshot(
                    asset_id="bldg_academic_a",
                    asset_type=AssetType.BUILDING,
                    observed_at=now,
                    status="online",
                    quality=TelemetryQuality.GOOD,
                    measurements={
                        "active_power_kw": CanonicalMeasurement(
                            metric_name="active_power_kw",
                            value=55.0,
                            unit="kW",
                            observed_at=now,
                            quality=TelemetryQuality.GOOD,
                        )
                    },
                ),
                "grid_pcc_01": AssetTelemetrySnapshot(
                    asset_id="grid_pcc_01",
                    asset_type=AssetType.GRID,
                    observed_at=now,
                    status="online",
                    quality=TelemetryQuality.GOOD,
                    measurements={
                        "active_power_kw": CanonicalMeasurement(
                            metric_name="active_power_kw",
                            value=-23.5,
                            unit="kW",
                            observed_at=now,
                            quality=TelemetryQuality.GOOD,
                        )
                    },
                ),
            },
        )
        await store.update_from_snapshot(snapshot, record_telemetry=True)
        await session.commit()

    # 3. Query Digital Twin Site Aggregate State
    live_res = await e2e_client.get("/api/v1/twin/live?site_id=1", headers=headers)
    assert live_res.status_code == 200
    live_data = live_res.json()
    assert live_data["site"]["total_assets"] == 4
    agg = live_data["aggregate"]
    assert agg["total_solar_kw"] == 78.5
    assert agg["total_building_demand_kw"] == 55.0

    # 4. Trigger Optimization Cycle
    cycle_res = await e2e_client.post(
        "/api/v1/control/force-cycle",
        json={"site_id": 1},
        headers=headers,
    )
    assert cycle_res.status_code == 200
    cycle_data = cycle_res.json()
    assert cycle_data["status"] in ("completed", "degraded")
    assert cycle_data["decisions_count"] >= 1

    # 5. Query Decision Timeline and Statistics
    decisions_res = await e2e_client.get("/api/v1/decisions?site_id=1", headers=headers)
    assert decisions_res.status_code == 200
    decisions_list = decisions_res.json()
    assert len(decisions_list) >= 1
    first_dec = decisions_list[0]
    assert "reason" in first_dec
    assert first_dec["confidence"] > 0

    stats_res = await e2e_client.get("/api/v1/decisions/stats?site_id=1", headers=headers)
    assert stats_res.status_code == 200
    stats_data = stats_res.json()
    assert stats_data["total_decisions"] >= 1

    # 6. Acknowledge Control Command
    if first_dec.get("commands"):
        cmd = first_dec["commands"][0]
        ack_res = await e2e_client.post(
            f"/api/v1/control/commands/{cmd['id']}/acknowledge",
            json={"status": "executed", "reason": "Hardware inverter setpoint confirmed."},
            headers=headers,
        )
        assert ack_res.status_code == 200
        assert ack_res.json()["status"] == "executed"

    # 7. Update Control Policy & Emergency Stop Interlock
    estop_res = await e2e_client.post(
        "/api/v1/control/emergency-stop",
        json={"active": True, "reason": "E2E safety interlock verification."},
        headers=headers,
    )
    assert estop_res.status_code == 200
    assert estop_res.json()["emergency_stop_active"] is True

    # Clear Emergency Stop
    clear_estop_res = await e2e_client.post(
        "/api/v1/control/emergency-stop",
        json={"active": False, "reason": "Resuming normal testing operations."},
        headers=headers,
    )
    assert clear_estop_res.status_code == 200
    assert clear_estop_res.json()["emergency_stop_active"] is False

    # 8. Query Export Reporting & Generate CSV/PDF
    export_stats_res = await e2e_client.get("/api/v1/export/stats?site_id=1", headers=headers)
    assert export_stats_res.status_code == 200
    export_stats = export_stats_res.json()
    assert export_stats["currency"] == "INR"
    assert export_stats["data_quality_disclosure"]["telemetry_completeness_pct"] > 0

    csv_res = await e2e_client.get("/api/v1/export/csv?site_id=1", headers=headers)
    assert csv_res.status_code == 200
    assert "text/csv" in csv_res.headers["content-type"]
    assert "decision_id" in csv_res.text

    pdf_res = await e2e_client.get("/api/v1/export/pdf?site_id=1", headers=headers)
    assert pdf_res.status_code == 200
    assert "application/pdf" in pdf_res.headers["content-type"]
    assert len(pdf_res.content) > 100

    # 9. Verify System Diagnostics and Health Checks
    live_res = await e2e_client.get("/health")
    assert live_res.status_code == 200
    assert live_res.json()["status"] in ("ok", "healthy")

    ready_res = await e2e_client.get("/health/ready")
    assert ready_res.status_code == 200
    assert ready_res.json()["status"] == "ready"

    sched_res = await e2e_client.get("/health/scheduler")
    assert sched_res.status_code == 200
    assert sched_res.json()["status"] in ("online", "idle", "running", "uninitialized", "stopped")
