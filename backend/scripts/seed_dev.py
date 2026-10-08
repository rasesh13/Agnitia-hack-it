import asyncio
from datetime import datetime, timezone

from backend.db.database import get_async_engine, get_session_maker
from backend.db.repositories.twin_repo import TwinRepository
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
from backend.services.decision_manager import DecisionManager
from backend.services.digital_twin_store import DigitalTwinStore


async def seed_development_data():
    """Seeds the development SQLite database with campus microgrid assets, users, and telemetry."""
    print("=== Initializing Clean Database Schema ===")
    engine = get_async_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    session_maker = get_session_maker()
    now = datetime.now(timezone.utc)

    async with session_maker() as session:
        # 1. Users
        print("Creating default users (admin, operator, viewer)...")
        users = [
            User(
                email="admin@surya-energy.com",
                password_hash=hash_password("AdminSecret123!"),
                role=UserRole.ADMIN,
                is_active=True,
            ),
            User(
                email="operator@surya-energy.com",
                password_hash=hash_password("OperatorSecret123!"),
                role=UserRole.OPERATOR,
                is_active=True,
            ),
            User(
                email="viewer@surya-energy.com",
                password_hash=hash_password("ViewerSecret123!"),
                role=UserRole.VIEWER,
                is_active=True,
            ),
        ]
        session.add_all(users)

        # 2. Site
        print("Creating Campus Site entity...")
        site = Site(
            id=1,
            name="SURYA Main Academic Campus",
            timezone="Asia/Kolkata",
            jurisdiction="India-CEA",
            currency="INR",
            config_version=1,
        )
        session.add(site)

        # 3. Energy Assets
        print("Registering digital twin microgrid assets...")
        assets = [
            Asset(
                id="solar_pv_01",
                name="Main Campus Solar PV Array 1",
                asset_type=AssetType.SOLAR,
                site_id=1,
                rated_capacity_kw=100.0,
                is_active=True,
            ),
            Asset(
                id="solar_pv_02",
                name="Engineering Block Rooftop Solar",
                asset_type=AssetType.SOLAR,
                site_id=1,
                rated_capacity_kw=75.0,
                is_active=True,
            ),
            Asset(
                id="wind_wt_01",
                name="Campus Wind Turbine 1",
                asset_type=AssetType.WIND,
                site_id=1,
                rated_capacity_kw=25.0,
                is_active=True,
            ),
            Asset(
                id="bess_01",
                name="Campus Lithium-Ion BESS (Pack 1)",
                asset_type=AssetType.BATTERY,
                site_id=1,
                rated_capacity_kw=100.0,
                is_active=True,
            ),
            Asset(
                id="bldg_academic_a",
                name="Academic Block A",
                asset_type=AssetType.BUILDING,
                site_id=1,
                rated_capacity_kw=120.0,
                is_active=True,
            ),
            Asset(
                id="bldg_library",
                name="Central Library",
                asset_type=AssetType.BUILDING,
                site_id=1,
                rated_capacity_kw=60.0,
                is_active=True,
            ),
            Asset(
                id="bldg_server_room",
                name="Data Center & Server Room",
                asset_type=AssetType.BUILDING,
                site_id=1,
                rated_capacity_kw=40.0,
                is_active=True,
            ),
            Asset(
                id="grid_pcc_01",
                name="Point of Common Coupling (PCC)",
                asset_type=AssetType.GRID,
                site_id=1,
                rated_capacity_kw=250.0,
                is_active=True,
            ),
        ]
        session.add_all(assets)

        # 4. Configurations
        print("Setting asset configurations, VNM sharing rules, and alert thresholds...")
        bess_cfg = BatteryConfig(
            asset_id="bess_01",
            min_soc=10.0,
            max_soc=95.0,
            reserve_floor=20.0,
            max_charge_power_kw=50.0,
            max_discharge_power_kw=50.0,
            round_trip_efficiency=0.92,
            health_floor=70.0,
            updated_at=now,
        )
        bldg_cfgs = [
            BuildingConfig(
                asset_id="bldg_academic_a",
                building_name="Academic Block A",
                criticality_tier=CriticalityTier.ESSENTIAL,
                peak_load_kw=120.0,
                updated_at=now,
            ),
            BuildingConfig(
                asset_id="bldg_library",
                building_name="Central Library",
                criticality_tier=CriticalityTier.NON_CRITICAL,
                peak_load_kw=60.0,
                updated_at=now,
            ),
            BuildingConfig(
                asset_id="bldg_server_room",
                building_name="Data Center & Server Room",
                criticality_tier=CriticalityTier.CRITICAL,
                peak_load_kw=40.0,
                updated_at=now,
            ),
        ]
        vnm_rules = [
            VNMSharingRule(
                building_asset_id="bldg_academic_a",
                sharing_ratio=0.50,
                rule_version=1,
                jurisdiction="India-CEA",
                effective_from=now,
                updated_at=now,
            ),
            VNMSharingRule(
                building_asset_id="bldg_library",
                sharing_ratio=0.30,
                rule_version=1,
                jurisdiction="India-CEA",
                effective_from=now,
                updated_at=now,
            ),
            VNMSharingRule(
                building_asset_id="bldg_server_room",
                sharing_ratio=0.20,
                rule_version=1,
                jurisdiction="India-CEA",
                effective_from=now,
                updated_at=now,
            ),
        ]
        thresholds = [
            AlertThreshold(
                metric_name="total_campus_demand_kw",
                threshold_value=180.0,
                unit="kW",
                severity=AlertSeverity.WARNING,
                is_active=True,
                updated_at=now,
            ),
            AlertThreshold(
                metric_name="bess_01.soc_percent",
                threshold_value=20.0,
                unit="%",
                severity=AlertSeverity.CRITICAL,
                is_active=True,
                updated_at=now,
            ),
            AlertThreshold(
                metric_name="inverter_temperature_celsius",
                threshold_value=65.0,
                unit="°C",
                severity=AlertSeverity.WARNING,
                is_active=True,
                updated_at=now,
            ),
        ]
        session.add(bess_cfg)
        session.add_all(bldg_cfgs)
        session.add_all(vnm_rules)
        session.add_all(thresholds)
        await session.commit()

        # 5. Ingest Initial Real-Time Telemetry Snapshot
        print("Ingesting initial authentic telemetry snapshot into Digital Twin Store...")
        repo = TwinRepository(session)
        store = DigitalTwinStore(repo)

        initial_snapshot = EnergySnapshot(
            site_id=1,
            snapshot_id="snap-init-001",
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
                            value=82.4,
                            unit="kW",
                            observed_at=now,
                            quality=TelemetryQuality.GOOD,
                        ),
                        "temperature_celsius": CanonicalMeasurement(
                            metric_name="temperature_celsius",
                            value=34.2,
                            unit="°C",
                            observed_at=now,
                            quality=TelemetryQuality.GOOD,
                        ),
                    },
                ),
                "solar_pv_02": AssetTelemetrySnapshot(
                    asset_id="solar_pv_02",
                    asset_type=AssetType.SOLAR,
                    observed_at=now,
                    status="online",
                    quality=TelemetryQuality.GOOD,
                    measurements={
                        "active_power_kw": CanonicalMeasurement(
                            metric_name="active_power_kw",
                            value=61.8,
                            unit="kW",
                            observed_at=now,
                            quality=TelemetryQuality.GOOD,
                        ),
                        "temperature_celsius": CanonicalMeasurement(
                            metric_name="temperature_celsius",
                            value=33.8,
                            unit="°C",
                            observed_at=now,
                            quality=TelemetryQuality.GOOD,
                        ),
                    },
                ),
                "wind_wt_01": AssetTelemetrySnapshot(
                    asset_id="wind_wt_01",
                    asset_type=AssetType.WIND,
                    observed_at=now,
                    status="online",
                    quality=TelemetryQuality.GOOD,
                    measurements={
                        "active_power_kw": CanonicalMeasurement(
                            metric_name="active_power_kw",
                            value=14.5,
                            unit="kW",
                            observed_at=now,
                            quality=TelemetryQuality.GOOD,
                        ),
                        "wind_speed_ms": CanonicalMeasurement(
                            metric_name="wind_speed_ms",
                            value=6.2,
                            unit="m/s",
                            observed_at=now,
                            quality=TelemetryQuality.GOOD,
                        ),
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
                            value=68.5,
                            unit="%",
                            observed_at=now,
                            quality=TelemetryQuality.GOOD,
                        ),
                        "active_power_kw": CanonicalMeasurement(
                            metric_name="active_power_kw",
                            value=-25.0,  # Charging with solar surplus
                            unit="kW",
                            observed_at=now,
                            quality=TelemetryQuality.GOOD,
                        ),
                        "temperature_celsius": CanonicalMeasurement(
                            metric_name="temperature_celsius",
                            value=28.4,
                            unit="°C",
                            observed_at=now,
                            quality=TelemetryQuality.GOOD,
                        ),
                        "health_percent": CanonicalMeasurement(
                            metric_name="health_percent",
                            value=98.5,
                            unit="%",
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
                            value=68.0,
                            unit="kW",
                            observed_at=now,
                            quality=TelemetryQuality.GOOD,
                        )
                    },
                ),
                "bldg_library": AssetTelemetrySnapshot(
                    asset_id="bldg_library",
                    asset_type=AssetType.BUILDING,
                    observed_at=now,
                    status="online",
                    quality=TelemetryQuality.GOOD,
                    measurements={
                        "active_power_kw": CanonicalMeasurement(
                            metric_name="active_power_kw",
                            value=38.5,
                            unit="kW",
                            observed_at=now,
                            quality=TelemetryQuality.GOOD,
                        )
                    },
                ),
                "bldg_server_room": AssetTelemetrySnapshot(
                    asset_id="bldg_server_room",
                    asset_type=AssetType.BUILDING,
                    observed_at=now,
                    status="online",
                    quality=TelemetryQuality.GOOD,
                    measurements={
                        "active_power_kw": CanonicalMeasurement(
                            metric_name="active_power_kw",
                            value=26.2,
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
                            value=-26.0,  # Net export of surplus clean power
                            unit="kW",
                            observed_at=now,
                            quality=TelemetryQuality.GOOD,
                        ),
                        "voltage_v": CanonicalMeasurement(
                            metric_name="voltage_v",
                            value=415.2,
                            unit="V",
                            observed_at=now,
                            quality=TelemetryQuality.GOOD,
                        ),
                        "frequency_hz": CanonicalMeasurement(
                            metric_name="frequency_hz",
                            value=50.01,
                            unit="Hz",
                            observed_at=now,
                            quality=TelemetryQuality.GOOD,
                        ),
                    },
                ),
            },
        )
        await store.update_from_snapshot(initial_snapshot, record_telemetry=True)
        await session.commit()

        # 6. Run Initial Optimization Cycle
        print("Executing baseline optimization decision cycle...")
        manager = DecisionManager(session)
        cycle = await manager.run_decision_cycle(site_id=1, snapshot=initial_snapshot)
        print(f"Initial cycle {cycle.cycle_id} completed with {len(cycle.decisions)} decisions!")

    engine = get_async_engine()
    await engine.dispose()
    print("=== Development Database Seeding Complete! ===")


if __name__ == "__main__":
    asyncio.run(seed_development_data())
