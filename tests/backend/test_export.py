from datetime import datetime, timezone

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from backend.db.database import get_db
from backend.main import app
from backend.models.base import Base
from backend.models.decision_log import (
    CommandStatus,
    ControlCommand,
    DecisionCycle,
    DecisionCycleStatus,
    DecisionLog,
    DecisionType,
)
from backend.models.digital_twin import Asset, AssetType, Site
from backend.models.telemetry import TelemetryPoint, TelemetryQuality
from backend.models.user import User, UserRole
from backend.services.auth_crypto import create_access_token, hash_password
from backend.services.export_service import ExportService


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
        # Create user
        viewer = User(
            id=1,
            email="viewer@surya-energy.com",
            password_hash=hash_password("ViewerPass123!"),
            role=UserRole.VIEWER,
            is_active=True,
            token_version=1,
        )
        session.add(viewer)

        # Create site
        site = Site(
            id=1,
            name="Green Valley Campus",
            timezone="Asia/Kolkata",
            jurisdiction="India",
            currency="INR",
            config_version=1,
        )
        session.add(site)

        # Create assets
        solar = Asset(
            id="solar-01",
            name="Rooftop Solar Array",
            asset_type=AssetType.SOLAR,
            site_id=1,
            rated_capacity_kw=100.0,
        )
        batt = Asset(
            id="batt-01",
            name="BESS Unit 1",
            asset_type=AssetType.BATTERY,
            site_id=1,
            rated_capacity_kw=50.0,
        )
        session.add_all([solar, batt])

        # Create decision cycle
        cycle = DecisionCycle(
            id="cycle-export-01",
            site_id=1,
            status=DecisionCycleStatus.COMPLETED,
            input_snapshot_hash="hash-abc",
            cycle_started_at=now,
            cycle_completed_at=now,
            duration_ms=38.4,
        )
        session.add(cycle)

        # Create decision logs
        dec1 = DecisionLog(
            id="dec-exp-01",
            cycle_id="cycle-export-01",
            site_id=1,
            target_asset_id="batt-01",
            decision_type=DecisionType.BATTERY,
            action="CHARGE_FROM_SOLAR",
            setpoint_kw=35.0,
            allocated_kwh=8.75,
            allocated_value_inr=74.38,
            actor="system:optimizer",
            reason="Absorb solar surplus during peak irradiance",
            confidence=0.99,
            expected_savings_inr=74.38,
            carbon_impact_kg=-6.12,
            created_at=now,
        )
        dec2 = DecisionLog(
            id="dec-exp-02",
            cycle_id="cycle-export-01",
            site_id=1,
            target_asset_id="solar-01",
            decision_type=DecisionType.DISPATCH,
            action="DIRECT_CONSUMPTION",
            setpoint_kw=45.0,
            allocated_kwh=11.25,
            allocated_value_inr=95.62,
            actor="system:optimizer",
            reason="Serve campus daytime baseload directly from solar",
            confidence=1.0,
            expected_savings_inr=95.62,
            carbon_impact_kg=-7.88,
            created_at=now,
        )
        cmd1 = ControlCommand(
            id="cmd-exp-01",
            idempotency_key="idemp-exp-01",
            decision_id="dec-exp-01",
            target_asset_id="batt-01",
            action="CHARGE",
            requested_setpoint=35.0,
            unit="kW",
            status=CommandStatus.EXECUTED,
            valid_from=now,
            valid_until=now,
            reason="Charge battery from solar",
            originating_actor="system:optimizer",
        )
        session.add_all([dec1, dec2, cmd1])

        # Create telemetry points with varying qualities
        points = [
            TelemetryPoint(
                asset_id="solar-01",
                metric_name="active_power_kw",
                value=50.0,
                unit="kW",
                quality=TelemetryQuality.GOOD,
                observed_at=now,
                received_at=now,
                source_adapter="modbus_solar",
            ),
            TelemetryPoint(
                asset_id="batt-01",
                metric_name="active_power_kw",
                value=-35.0,
                unit="kW",
                quality=TelemetryQuality.GOOD,
                observed_at=now,
                received_at=now,
                source_adapter="modbus_batt",
            ),
            TelemetryPoint(
                asset_id="solar-01",
                metric_name="temperature_celsius",
                value=42.0,
                unit="C",
                quality=TelemetryQuality.SUSPECT,
                observed_at=now,
                received_at=now,
                source_adapter="modbus_solar",
            ),
        ]
        session.add_all(points)
        await session.commit()


@pytest.fixture
def auth_header():
    token = create_access_token(user_id=1, email="viewer@surya-energy.com", role=UserRole.VIEWER)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def override_db(test_db):
    async def _get_db_override():
        async with test_db() as session:
            yield session

    app.dependency_overrides[get_db] = _get_db_override
    yield
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_export_service_direct(test_db, seed_data):
    async with test_db() as session:
        service = ExportService(session)

        # 1. Stats calculation
        stats = await service.get_export_stats(site_id=1)
        assert stats["site_id"] == 1
        assert stats["currency"] == "INR"
        assert stats["metrics"]["total_decisions"] == 2
        assert stats["metrics"]["total_cost_savings_inr"] == 170.0
        assert stats["metrics"]["total_energy_allocated_kwh"] == 20.0
        assert "battery" in stats["metrics"]["by_type"]
        assert "dispatch" in stats["metrics"]["by_type"]
        assert stats["data_quality_disclosure"]["good_quality_points"] == 2
        assert stats["data_quality_disclosure"]["stale_or_uncertain_points"] == 1
        assert stats["data_quality_disclosure"]["telemetry_completeness_pct"] == 66.7

        # 2. CSV Report generation
        csv_text = await service.generate_csv_report(site_id=1)
        assert "# SURYA Operations Platform" in csv_text
        assert "# Currency: INR" in csv_text
        assert "decision_id,cycle_id,timestamp_utc" in csv_text
        assert "dec-exp-01" in csv_text
        assert "dec-exp-02" in csv_text
        assert "CHARGE_FROM_SOLAR" in csv_text

        # 3. PDF Report generation
        pdf_bytes = await service.generate_pdf_report(site_id=1)
        assert isinstance(pdf_bytes, bytes)
        assert len(pdf_bytes) > 500
        assert pdf_bytes.startswith(b"%PDF")


@pytest.mark.asyncio
async def test_export_api_endpoints(test_db, seed_data, auth_header, override_db):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Unauthorized request returns 401
        res_unauth = await client.get("/api/v1/export/stats?site_id=1")
        assert res_unauth.status_code == 401

        # 2. Stats endpoint returns 200 with typed schema
        res_stats = await client.get("/api/v1/export/stats?site_id=1", headers=auth_header)
        assert res_stats.status_code == 200
        stats_body = res_stats.json()
        assert stats_body["site_id"] == 1
        assert stats_body["metrics"]["total_decisions"] == 2
        assert stats_body["tariffs"]["grid_import_inr_per_kwh"] == 8.50

        # 3. CSV export endpoint returns 200 and text/csv attachment
        res_csv = await client.get("/api/v1/export/csv?site_id=1", headers=auth_header)
        assert res_csv.status_code == 200
        assert "text/csv" in res_csv.headers["content-type"]
        assert "attachment; filename=" in res_csv.headers["content-disposition"]
        assert "surya_report_site_1_" in res_csv.headers["content-disposition"]
        assert "dec-exp-01" in res_csv.text

        # 4. PDF export endpoint returns 200 and application/pdf attachment
        res_pdf = await client.get("/api/v1/export/pdf?site_id=1", headers=auth_header)
        assert res_pdf.status_code == 200
        assert "application/pdf" in res_pdf.headers["content-type"]
        assert "attachment; filename=" in res_pdf.headers["content-disposition"]
        assert res_pdf.content.startswith(b"%PDF")
        assert len(res_pdf.content) > 500
