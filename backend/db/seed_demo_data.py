"""Prestige University, Indore Microgrid Database Seeder.
Initializes and seeds:
  - Admin & Operator User accounts
  - Campus Site (Prestige University, Indore - Malwa Microgrid)
  - 8 Connected Assets (300 kW Solar PV, 120 kW Wind Turbines, 500 kWh BESS, Academic Blocks, MPPKVVCL 11kV Grid)
  - Building Criticality Configurations & Battery Boundaries
  - Live Initial Telemetry & States calibrated to Agnitia ML Model (Central India - Indore)
  - Initial Optimization Decision Cycles & Alternatives
"""
import asyncio
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.database import get_async_engine, get_session_maker, init_db
from backend.models.base import utc_now
from backend.models.config import (
    BatteryConfig,
    BuildingConfig,
    CriticalityTier,
    VNMSharingRule,
)
from backend.models.digital_twin import Asset, AssetType, Site
from backend.models.telemetry import (
    AssetCurrentState,
    TelemetryPoint,
    TelemetryQuality,
)
from backend.models.user import User, UserRole
from backend.services.agnitia_ml_forecaster import ml_forecaster
from backend.services.auth_crypto import hash_password
from backend.services.decision_manager import DecisionManager

logger = logging.getLogger("surya.seed")


async def seed_prestige_microgrid(session: AsyncSession) -> None:
    now = utc_now()

    # 1. Seed or Verify Users
    stmt = select(User).where(User.email == "operator@surya.local")
    existing_user = (await session.execute(stmt)).scalar_one_or_none()
    if not existing_user:
        admin_user = User(
            id=1,
            email="operator@surya.local",
            password_hash=hash_password("SuryaAdmin2026!"),
            role=UserRole.ADMIN,
            is_active=True,
            token_version=1,
        )
        session.add(admin_user)
        logger.info("Created admin user: operator@surya.local")

    stmt_edu = select(User).where(User.email == "admin@prestige.edu.in")
    existing_edu = (await session.execute(stmt_edu)).scalar_one_or_none()
    if not existing_edu:
        edu_user = User(
            id=2,
            email="admin@prestige.edu.in",
            password_hash=hash_password("SuryaAdmin2026!"),
            role=UserRole.ADMIN,
            is_active=True,
            token_version=1,
        )
        session.add(edu_user)

    # 2. Seed or Update Site 1
    stmt_site = select(Site).where(Site.id == 1)
    site = (await session.execute(stmt_site)).scalar_one_or_none()
    if not site:
        site = Site(
            id=1,
            name="Prestige University, Indore (Malwa Microgrid)",
            timezone="Asia/Kolkata",
            jurisdiction="Madhya Pradesh, India",
            currency="INR",
            config_version=1,
        )
        session.add(site)
        await session.flush()
    else:
        site.name = "Prestige University, Indore (Malwa Microgrid)"
        site.timezone = "Asia/Kolkata"
        site.jurisdiction = "Madhya Pradesh, India"
        site.currency = "INR"

    # 3. Seed Assets
    # Total Solar: 300 kW, Total Wind: 120 kW (matches Indore ML model)
    assets_def = [
        # Solar PV Arrays
        {
            "id": "solar-pv-01",
            "name": "Academic Block A Rooftop Solar PV",
            "asset_type": AssetType.SOLAR,
            "rated_capacity_kw": 180.0,
        },
        {
            "id": "solar-pv-02",
            "name": "Engineering Block B Rooftop Solar PV",
            "asset_type": AssetType.SOLAR,
            "rated_capacity_kw": 120.0,
        },
        # Wind Turbines
        {
            "id": "wind-wt-01",
            "name": "Campus Perimeter Micro-Wind Turbine Array",
            "asset_type": AssetType.WIND,
            "rated_capacity_kw": 120.0,
        },
        # BESS (500 kWh / 250 kW total)
        {
            "id": "bess-unit-01",
            "name": "Main Substation BESS Unit 1 (250 kWh)",
            "asset_type": AssetType.BATTERY,
            "rated_capacity_kw": 125.0,
        },
        {
            "id": "bess-unit-02",
            "name": "Auxiliary Substation BESS Unit 2 (250 kWh)",
            "asset_type": AssetType.BATTERY,
            "rated_capacity_kw": 125.0,
        },
        # Campus Buildings
        {
            "id": "bldg-eng",
            "name": "Faculty of Engineering & Technology",
            "asset_type": AssetType.BUILDING,
            "rated_capacity_kw": 110.0,
        },
        {
            "id": "bldg-admin",
            "name": "Central Administration & Computing Centre",
            "asset_type": AssetType.BUILDING,
            "rated_capacity_kw": 75.0,
        },
        {
            "id": "bldg-hostel",
            "name": "Student Hostels & Residential Complex",
            "asset_type": AssetType.BUILDING,
            "rated_capacity_kw": 65.0,
        },
        # Grid Interconnection
        {
            "id": "grid-mppkvvcl-01",
            "name": "MPPKVVCL 11kV Grid Interconnection Feeder",
            "asset_type": AssetType.GRID,
            "rated_capacity_kw": 350.0,
        },
    ]

    for a_data in assets_def:
        stmt_a = select(Asset).where(Asset.id == a_data["id"])
        asset_obj = (await session.execute(stmt_a)).scalar_one_or_none()
        if not asset_obj:
            asset_obj = Asset(
                id=a_data["id"],
                name=a_data["name"],
                asset_type=a_data["asset_type"],
                site_id=1,
                rated_capacity_kw=a_data["rated_capacity_kw"],
                is_active=True,
            )
            session.add(asset_obj)
        else:
            asset_obj.name = a_data["name"]
            asset_obj.rated_capacity_kw = a_data["rated_capacity_kw"]
            asset_obj.is_active = True

    await session.flush()

    # 4. Seed Building Configs
    building_configs_def = [
        {
            "asset_id": "bldg-eng",
            "building_name": "Faculty of Engineering & Technology",
            "criticality_tier": CriticalityTier.ESSENTIAL,
            "peak_load_kw": 110.0,
            "flexible_load_policy": "shiftable_hvac",
        },
        {
            "asset_id": "bldg-admin",
            "building_name": "Central Administration & Computing Centre",
            "criticality_tier": CriticalityTier.CRITICAL,
            "peak_load_kw": 75.0,
            "flexible_load_policy": "uninterruptible",
        },
        {
            "asset_id": "bldg-hostel",
            "building_name": "Student Hostels & Residential Complex",
            "criticality_tier": CriticalityTier.NON_CRITICAL,
            "peak_load_kw": 65.0,
            "flexible_load_policy": "shiftable_water_heating",
        },
    ]

    for b_data in building_configs_def:
        stmt_b = select(BuildingConfig).where(BuildingConfig.asset_id == b_data["asset_id"])
        b_obj = (await session.execute(stmt_b)).scalar_one_or_none()
        if not b_obj:
            b_obj = BuildingConfig(
                asset_id=b_data["asset_id"],
                building_name=b_data["building_name"],
                criticality_tier=b_data["criticality_tier"],
                peak_load_kw=b_data["peak_load_kw"],
                flexible_load_policy=b_data["flexible_load_policy"],
            )
            session.add(b_obj)

    # 5. Seed Battery Configs
    for b_id in ["bess-unit-01", "bess-unit-02"]:
        stmt_bc = select(BatteryConfig).where(BatteryConfig.asset_id == b_id)
        bc_obj = (await session.execute(stmt_bc)).scalar_one_or_none()
        if not bc_obj:
            bc_obj = BatteryConfig(
                asset_id=b_id,
                min_soc=15.0,
                max_soc=95.0,
                reserve_floor=20.0,
                max_charge_power_kw=125.0,
                max_discharge_power_kw=125.0,
                round_trip_efficiency=0.92,
                health_floor=75.0,
            )
            session.add(bc_obj)

    # 6. Seed VNM Sharing Rules
    vnm_def = [
        ("bldg-eng", 0.50),
        ("bldg-admin", 0.30),
        ("bldg-hostel", 0.20),
    ]
    for b_id, ratio in vnm_def:
        stmt_v = select(VNMSharingRule).where(VNMSharingRule.building_asset_id == b_id)
        v_obj = (await session.execute(stmt_v)).scalar_one_or_none()
        if not v_obj:
            v_obj = VNMSharingRule(
                building_asset_id=b_id,
                sharing_ratio=ratio,
                rule_version=1,
                jurisdiction="Madhya Pradesh (MPPKVVCL)",
                effective_from=now,
            )
            session.add(v_obj)

    await session.flush()

    # 7. Seed Initial Live States driven directly by ML Forecaster (Central India - Indore)
    ml_forecast = ml_forecaster.forecast_48h(region_id="central_india_mp_indore", start_dt=now)
    # Current hour prediction (index 0)
    # If solar hour is evening, use daytime representative peak for live demo telemetry if needed
    hour = now.hour
    is_daylight = 6 <= hour <= 18
    p50_solar = ml_forecast.series["solar"][0].p50_prediction
    if not is_daylight and p50_solar == 0.0:
        # For lively initial demonstration if started at night, show afternoon snapshot
        demo_solar_total = 215.4
    else:
        demo_solar_total = p50_solar

    demo_wind_total = max(18.0, ml_forecast.series["wind"][0].p50_prediction)
    demo_demand_total = max(140.0, ml_forecast.series["demand"][0].p50_prediction)

    # Distribute generation to arrays
    solar_01_power = round(demo_solar_total * (180.0 / 300.0), 1)
    solar_02_power = round(demo_solar_total * (120.0 / 300.0), 1)
    wind_01_power = round(demo_wind_total, 1)

    # Distribute load to buildings
    eng_load = round(demo_demand_total * 0.48, 1)
    admin_load = round(demo_demand_total * 0.30, 1)
    hostel_load = round(demo_demand_total * 0.22, 1)

    tot_gen = demo_solar_total + demo_wind_total
    tot_load = eng_load + admin_load + hostel_load
    net_surplus = tot_gen - tot_load

    # Battery absorption/discharge
    if net_surplus > 0:
        # Excess renewable charges battery
        batt_power = -min(100.0, net_surplus)  # negative = charging
        grid_exchange = round(net_surplus + batt_power, 1)  # positive = export
        grid_exchange_signed = -grid_exchange  # negative = export in net_grid_exchange
    else:
        deficit = abs(net_surplus)
        batt_power = min(80.0, deficit)  # positive = discharging
        grid_exchange_signed = round(deficit - batt_power, 1)  # positive = import

    states_def = [
        {
            "asset_id": "solar-pv-01",
            "operational_status": "online",
            "active_power_kw": solar_01_power,
            "energy_kwh": 640.5,
            "temperature_celsius": 38.2,
            "voltage_v": 415.2,
            "frequency_hz": 50.01,
            "telemetry_quality": TelemetryQuality.GOOD,
        },
        {
            "asset_id": "solar-pv-02",
            "operational_status": "online",
            "active_power_kw": solar_02_power,
            "energy_kwh": 420.0,
            "temperature_celsius": 37.8,
            "voltage_v": 414.8,
            "frequency_hz": 50.01,
            "telemetry_quality": TelemetryQuality.GOOD,
        },
        {
            "asset_id": "wind-wt-01",
            "operational_status": "online",
            "active_power_kw": wind_01_power,
            "energy_kwh": 310.2,
            "wind_speed_ms": 6.8,
            "temperature_celsius": 29.5,
            "voltage_v": 415.0,
            "frequency_hz": 50.00,
            "telemetry_quality": TelemetryQuality.GOOD,
        },
        {
            "asset_id": "bess-unit-01",
            "operational_status": "online",
            "active_power_kw": round(batt_power / 2.0, 1),
            "energy_kwh": 185.0,
            "soc_percent": 74.5,
            "health_percent": 96.8,
            "temperature_celsius": 26.4,
            "voltage_v": 402.1,
            "frequency_hz": 50.01,
            "telemetry_quality": TelemetryQuality.GOOD,
        },
        {
            "asset_id": "bess-unit-02",
            "operational_status": "online",
            "active_power_kw": round(batt_power / 2.0, 1),
            "energy_kwh": 182.5,
            "soc_percent": 73.8,
            "health_percent": 97.2,
            "temperature_celsius": 26.2,
            "voltage_v": 401.8,
            "frequency_hz": 50.01,
            "telemetry_quality": TelemetryQuality.GOOD,
        },
        {
            "asset_id": "bldg-eng",
            "operational_status": "online",
            "active_power_kw": eng_load,
            "energy_kwh": 512.4,
            "voltage_v": 414.9,
            "frequency_hz": 50.00,
            "telemetry_quality": TelemetryQuality.GOOD,
        },
        {
            "asset_id": "bldg-admin",
            "operational_status": "online",
            "active_power_kw": admin_load,
            "energy_kwh": 348.1,
            "voltage_v": 415.1,
            "frequency_hz": 50.01,
            "telemetry_quality": TelemetryQuality.GOOD,
        },
        {
            "asset_id": "bldg-hostel",
            "operational_status": "online",
            "active_power_kw": hostel_load,
            "energy_kwh": 264.8,
            "voltage_v": 414.6,
            "frequency_hz": 50.00,
            "telemetry_quality": TelemetryQuality.GOOD,
        },
        {
            "asset_id": "grid-mppkvvcl-01",
            "operational_status": "online",
            "active_power_kw": abs(grid_exchange_signed),
            "energy_kwh": 1420.0,
            "voltage_v": 11020.0,
            "frequency_hz": 50.01,
            "telemetry_quality": TelemetryQuality.GOOD,
        },
    ]

    for s_item in states_def:
        stmt_st = select(AssetCurrentState).where(AssetCurrentState.asset_id == s_item["asset_id"])
        state_obj = (await session.execute(stmt_st)).scalar_one_or_none()
        if not state_obj:
            state_obj = AssetCurrentState(
                asset_id=s_item["asset_id"],
                operational_status=s_item["operational_status"],
                active_power_kw=s_item["active_power_kw"],
                energy_kwh=s_item.get("energy_kwh"),
                soc_percent=s_item.get("soc_percent"),
                health_percent=s_item.get("health_percent"),
                temperature_celsius=s_item.get("temperature_celsius"),
                wind_speed_ms=s_item.get("wind_speed_ms"),
                voltage_v=s_item.get("voltage_v"),
                frequency_hz=s_item.get("frequency_hz"),
                telemetry_quality=s_item["telemetry_quality"],
                observed_at=now - timedelta(seconds=2),
                received_at=now,
            )
            session.add(state_obj)
        else:
            state_obj.operational_status = s_item["operational_status"]
            state_obj.active_power_kw = s_item["active_power_kw"]
            state_obj.soc_percent = s_item.get("soc_percent")
            state_obj.health_percent = s_item.get("health_percent")
            state_obj.temperature_celsius = s_item.get("temperature_celsius")
            state_obj.wind_speed_ms = s_item.get("wind_speed_ms")
            state_obj.voltage_v = s_item.get("voltage_v")
            state_obj.observed_at = now
            state_obj.received_at = now

    # Also add some historical telemetry points so Trend / Series APIs have immediate depth
    for h_idx in range(6):
        hist_dt = now - timedelta(minutes=(6 - h_idx) * 15)
        session.add(
            TelemetryPoint(
                asset_id="solar-pv-01",
                metric_name="active_power_kw",
                value=round(solar_01_power * (0.85 + 0.05 * h_idx), 1),
                unit="kW",
                quality=TelemetryQuality.GOOD,
                observed_at=hist_dt,
                received_at=hist_dt,
            )
        )
        session.add(
            TelemetryPoint(
                asset_id="wind-wt-01",
                metric_name="active_power_kw",
                value=round(wind_01_power * (0.90 + 0.03 * h_idx), 1),
                unit="kW",
                quality=TelemetryQuality.GOOD,
                observed_at=hist_dt,
                received_at=hist_dt,
            )
        )

    await session.commit()
    logger.info("Successfully seeded Prestige University, Indore Microgrid assets & states.")

    # 8. Run an Initial Decision Cycle to populate the Optimizer & Audit Trail
    try:
        manager = DecisionManager(session=session)
        cycle_result = await manager.run_decision_cycle(site_id=1)
        await session.commit()
        logger.info("Initial decision cycle executed: %s (%s)", cycle_result.cycle_id, cycle_result.status.value)
    except Exception as e:
        logger.warning("Initial decision cycle run note: %s", e)


async def main():
    await init_db()
    session_factory = get_session_maker()
    async with session_factory() as session:
        await seed_prestige_microgrid(session)
    print("Database seeding completed successfully.")


if __name__ == "__main__":
    asyncio.run(main())
