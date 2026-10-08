from datetime import datetime, timedelta, timezone

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from backend.db.database import get_db
from backend.main import app
from backend.models.base import Base
from backend.models.config import BuildingConfig, CriticalityTier
from backend.models.digital_twin import Asset, AssetType, Site
from backend.models.telemetry import (
    AssetCurrentState,
    TelemetryPoint,
    TelemetryQuality,
)
from backend.models.user import User, UserRole
from backend.services.auth_crypto import create_access_token, hash_password


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
        # Create test user
        user = User(
            id=1,
            email="operator@surya-energy.com",
            password_hash=hash_password("OperatorSecret123!"),
            role=UserRole.OPERATOR,
            is_active=True,
            token_version=1,
        )
        session.add(user)

        # Create site
        site = Site(
            id=1,
            name="SURYA Campus Beta",
            timezone="Asia/Kolkata",
            jurisdiction="India",
            currency="INR",
            config_version=1,
        )
        session.add(site)

        # Create assets
        assets = [
            Asset(
                id="solar-01",
                name="Rooftop Solar Array",
                asset_type=AssetType.SOLAR,
                site_id=1,
                rated_capacity_kw=100.0,
            ),
            Asset(
                id="bldg-01",
                name="Academic Block A",
                asset_type=AssetType.BUILDING,
                site_id=1,
                rated_capacity_kw=80.0,
            ),
            Asset(
                id="batt-01",
                name="BESS Unit 1",
                asset_type=AssetType.BATTERY,
                site_id=1,
                rated_capacity_kw=60.0,
            ),
        ]
        session.add_all(assets)

        # Create building config
        bldg_cfg = BuildingConfig(
            asset_id="bldg-01",
            building_name="Academic Block A",
            criticality_tier=CriticalityTier.ESSENTIAL,
            peak_load_kw=80.0,
            flexible_load_policy="shiftable",
        )
        session.add(bldg_cfg)

        # Create asset current states
        states = [
            AssetCurrentState(
                asset_id="solar-01",
                operational_status="online",
                active_power_kw=45.0,
                energy_kwh=150.0,
                telemetry_quality=TelemetryQuality.GOOD,
                observed_at=now - timedelta(seconds=5),
                received_at=now,
            ),
            AssetCurrentState(
                asset_id="bldg-01",
                operational_status="online",
                active_power_kw=25.0,
                energy_kwh=80.0,
                telemetry_quality=TelemetryQuality.GOOD,
                observed_at=now - timedelta(seconds=5),
                received_at=now,
            ),
            AssetCurrentState(
                asset_id="batt-01",
                operational_status="online",
                active_power_kw=-10.0,  # Charging 10 kW
                soc_percent=80.0,
                health_percent=98.0,
                telemetry_quality=TelemetryQuality.GOOD,
                observed_at=now - timedelta(seconds=5),
                received_at=now,
            ),
        ]
        session.add_all(states)

        # Create telemetry historical points
        points = [
            TelemetryPoint(
                asset_id="solar-01",
                metric_name="active_power_kw",
                value=42.0,
                unit="kW",
                quality=TelemetryQuality.GOOD,
                observed_at=now - timedelta(minutes=10),
                received_at=now - timedelta(minutes=10),
                source_adapter="rest_primary",
            ),
            TelemetryPoint(
                asset_id="solar-01",
                metric_name="active_power_kw",
                value=45.0,
                unit="kW",
                quality=TelemetryQuality.GOOD,
                observed_at=now - timedelta(seconds=5),
                received_at=now,
                source_adapter="rest_primary",
            ),
        ]
        session.add_all(points)
        await session.commit()

    token = create_access_token(
        user_id=1,
        email="operator@surya-energy.com",
        role="operator",
        token_version=1,
    )
    return {"token": token, "headers": {"Authorization": f"Bearer {token}"}}


@pytest.fixture
def client_with_db(test_db):
    async def override_get_db():
        async with test_db() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    client = AsyncClient(transport=transport, base_url="http://test")
    yield client
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_get_site_twin(client_with_db: AsyncClient, seed_data):
    headers = seed_data["headers"]
    resp = await client_with_db.get("/api/v1/twin/site?site_id=1", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == 1
    assert data["name"] == "SURYA Campus Beta"
    assert data["total_assets"] == 3


@pytest.mark.asyncio
async def test_get_buildings_twin(client_with_db: AsyncClient, seed_data):
    headers = seed_data["headers"]
    resp = await client_with_db.get("/api/v1/twin/buildings?site_id=1", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["asset_id"] == "bldg-01"
    assert data[0]["criticality_tier"] == "essential"
    assert data[0]["current_power_kw"] == pytest.approx(25.0)
    assert data[0]["age_seconds"] is not None


@pytest.mark.asyncio
async def test_get_assets_twin_filtered(client_with_db: AsyncClient, seed_data):
    headers = seed_data["headers"]

    # All assets
    resp = await client_with_db.get("/api/v1/twin/assets?site_id=1", headers=headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 3

    # Filtered by solar
    resp_solar = await client_with_db.get(
        "/api/v1/twin/assets?site_id=1&asset_type=solar", headers=headers
    )
    assert resp_solar.status_code == 200
    data = resp_solar.json()
    assert len(data) == 1
    assert data[0]["asset_type"] == "solar"
    assert data[0]["active_power_kw"] == pytest.approx(45.0)


@pytest.mark.asyncio
async def test_get_live_twin(client_with_db: AsyncClient, seed_data):
    headers = seed_data["headers"]
    resp = await client_with_db.get("/api/v1/twin/live?site_id=1", headers=headers)
    assert resp.status_code == 200
    data = resp.json()

    assert "site" in data
    assert "aggregate" in data
    assert "assets" in data

    agg = data["aggregate"]
    assert agg["total_solar_kw"] == pytest.approx(45.0)
    assert agg["total_building_demand_kw"] == pytest.approx(25.0)
    assert agg["total_battery_charge_kw"] == pytest.approx(10.0)
    assert agg["average_battery_soc_percent"] == pytest.approx(80.0)
    assert agg["online_assets_count"] == 3


@pytest.mark.asyncio
async def test_get_telemetry_series(client_with_db: AsyncClient, seed_data):
    headers = seed_data["headers"]
    resp = await client_with_db.get(
        "/api/v1/telemetry/series?asset_id=solar-01&metric_name=active_power_kw",
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["asset_id"] == "solar-01"
    assert data["metric_name"] == "active_power_kw"
    assert data["count"] == 2
    assert len(data["points"]) == 2
    assert data["points"][0]["value"] == pytest.approx(42.0)
    assert data["points"][1]["value"] == pytest.approx(45.0)
