from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from pydantic import BaseModel, ConfigDict, Field

from backend.db.repositories.twin_repo import TwinRepository
from backend.models.base import utc_now
from backend.models.digital_twin import AssetType
from backend.models.telemetry import (
    AssetCurrentState,
    EnergySnapshot,
    TelemetryPoint,
    TelemetryQuality,
)


class CampusAggregate(BaseModel):
    """
    Campus-wide real-time energy aggregation metrics conforming to SURYA spec Section 9.
    """

    model_config = ConfigDict(extra="forbid")

    site_id: int = Field(..., description="Site identifier")
    captured_at: datetime = Field(default_factory=utc_now, description="Snapshot timestamp")
    total_solar_kw: float = Field(0.0, description="Total active solar generation in kW")
    total_wind_kw: float = Field(0.0, description="Total active wind generation in kW")
    total_generation_kw: float = Field(0.0, description="Total renewable generation in kW")
    total_building_demand_kw: float = Field(0.0, description="Total active campus load in kW")
    total_battery_charge_kw: float = Field(
        0.0, ge=0.0, description="Aggregate battery charging power in kW"
    )
    total_battery_discharge_kw: float = Field(
        0.0, ge=0.0, description="Aggregate battery discharging power in kW"
    )
    net_battery_kw: float = Field(
        0.0, description="Net battery power: positive=discharging, negative=charging"
    )
    grid_import_kw: float = Field(0.0, ge=0.0, description="Grid import power in kW")
    grid_export_kw: float = Field(0.0, ge=0.0, description="Grid export power in kW")
    net_grid_flow_kw: float = Field(
        0.0, description="Net grid exchange: positive=importing, negative=exporting"
    )
    average_battery_soc_percent: Optional[float] = Field(
        None, description="Capacity-weighted or mean battery SoC percentage"
    )
    online_assets_count: int = Field(0, ge=0, description="Count of operational online assets")
    stale_assets_count: int = Field(0, ge=0, description="Count of assets with stale telemetry")
    degraded_assets_count: int = Field(0, ge=0, description="Count of degraded assets")
    offline_assets_count: int = Field(0, ge=0, description="Count of unavailable/offline assets")
    overall_quality: TelemetryQuality = Field(
        TelemetryQuality.GOOD, description="Overall campus telemetry quality"
    )
    data_freshness_age_seconds: float = Field(
        0.0, ge=0.0, description="Maximum telemetry age in seconds among reporting assets"
    )


class DigitalTwinStore:
    """
    Digital Twin management service responsible for ingesting live snapshots,
    persisting states and interval series, and calculating real-time campus aggregates.
    """

    def __init__(self, repo: TwinRepository):
        self.repo = repo

    def _extract_metric_val(
        self, measurements: Dict[str, Any], *metric_names: str
    ) -> Optional[float]:
        for name in metric_names:
            if name in measurements and measurements[name].value is not None:
                return measurements[name].value
        return None

    def _convert_snapshot_to_current_state(
        self, asset_id: str, asset_snap: Any, now_dt: datetime
    ) -> AssetCurrentState:
        m = asset_snap.measurements
        active_power = self._extract_metric_val(m, "active_power_kw", "power_kw", "generation_kw")
        energy = self._extract_metric_val(m, "energy_kwh", "total_energy_kwh")
        soc = self._extract_metric_val(m, "battery_soc", "soc_percent", "soc")
        health = self._extract_metric_val(m, "health_percent", "battery_health", "soh")
        temp = self._extract_metric_val(m, "temperature_celsius", "temperature", "temp_c")
        wind_speed = self._extract_metric_val(m, "wind_speed_ms", "wind_speed")
        voltage = self._extract_metric_val(m, "voltage_v", "voltage")
        freq = self._extract_metric_val(m, "frequency_hz", "frequency")

        raw_metrics_dict = {
            k: {
                "value": v.value,
                "unit": v.unit,
                "quality": v.quality.value,
                "observed_at": v.observed_at.isoformat() if v.observed_at else None,
            }
            for k, v in m.items()
        }

        return AssetCurrentState(
            asset_id=asset_id,
            operational_status=asset_snap.status,
            active_power_kw=active_power,
            energy_kwh=energy,
            soc_percent=soc,
            health_percent=health,
            temperature_celsius=temp,
            wind_speed_ms=wind_speed,
            voltage_v=voltage,
            frequency_hz=freq,
            telemetry_quality=asset_snap.quality,
            observed_at=asset_snap.observed_at,
            received_at=now_dt,
            raw_metrics=raw_metrics_dict,
        )

    async def update_from_snapshot(
        self,
        snapshot: EnergySnapshot,
        record_telemetry: bool = True,
    ) -> CampusAggregate:
        """
        Ingests EnergySnapshot, persists digital twin states & telemetry points,
        and computes campus aggregates.
        """
        now_dt = utc_now()
        current_states: List[AssetCurrentState] = []
        telemetry_points: List[TelemetryPoint] = []

        for asset_id, asset_snap in snapshot.assets.items():
            state = self._convert_snapshot_to_current_state(asset_id, asset_snap, now_dt)
            current_states.append(state)

            if record_telemetry:
                for metric_name, meas in asset_snap.measurements.items():
                    if meas.value is not None:
                        telemetry_points.append(
                            TelemetryPoint(
                                asset_id=asset_id,
                                metric_name=metric_name,
                                value=meas.value,
                                unit=meas.unit,
                                quality=meas.quality,
                                observed_at=meas.observed_at or now_dt,
                                received_at=now_dt,
                                source_adapter=meas.source_adapter,
                                diagnostic_code=meas.diagnostic_code,
                            )
                        )

        await self.repo.bulk_upsert_asset_states(current_states)
        if record_telemetry and telemetry_points:
            await self.repo.add_telemetry_points(telemetry_points)

        return self.compute_campus_aggregates(
            site_id=snapshot.site_id,
            asset_states=current_states,
            assets_meta=snapshot.assets,
            captured_at=snapshot.captured_at,
        )

    def _resolve_asset_type(
        self, state: AssetCurrentState, assets_meta: Optional[Dict[str, Any]]
    ) -> Optional[AssetType]:
        if assets_meta and state.asset_id in assets_meta:
            return assets_meta[state.asset_id].asset_type
        if state.asset:
            return state.asset.asset_type
        return None

    def _accumulate_generation_load(
        self,
        asset_type: Optional[AssetType],
        power: float,
        acc: Dict[str, float],
    ) -> None:
        if asset_type == AssetType.SOLAR:
            acc["solar"] += max(0.0, power)
        elif asset_type == AssetType.WIND:
            acc["wind"] += max(0.0, power)
        elif asset_type in (AssetType.BUILDING, AssetType.LOAD):
            acc["demand"] += max(0.0, power)

    def _accumulate_storage_grid(
        self,
        asset_type: Optional[AssetType],
        power: float,
        state: AssetCurrentState,
        acc: Dict[str, float],
        soc_list: List[float],
    ) -> None:
        if asset_type == AssetType.BATTERY:
            if power > 0:
                acc["batt_discharge"] += power
            elif power < 0:
                acc["batt_charge"] += abs(power)
            if state.soc_percent is not None and 0.0 <= state.soc_percent <= 100.0:
                soc_list.append(state.soc_percent)
        elif asset_type in (AssetType.GRID, AssetType.METER):
            if power > 0:
                acc["grid_import"] += power
            elif power < 0:
                acc["grid_export"] += abs(power)

    def _calculate_status_counts(
        self, asset_states: List[AssetCurrentState], now_dt: datetime
    ) -> Tuple[Dict[str, int], float]:
        counts = {"online": 0, "stale": 0, "degraded": 0, "offline": 0}
        max_age = 0.0

        for state in asset_states:
            status = state.operational_status
            if status in counts:
                counts[status] += 1
            else:
                counts["offline"] += 1

            if state.observed_at:
                obs_utc = (
                    state.observed_at
                    if state.observed_at.tzinfo
                    else state.observed_at.replace(tzinfo=timezone.utc)
                )
                age = max(0.0, (now_dt - obs_utc).total_seconds())
                if age > max_age:
                    max_age = age

        return counts, max_age

    def compute_campus_aggregates(
        self,
        site_id: int,
        asset_states: List[AssetCurrentState],
        assets_meta: Optional[Dict[str, Any]] = None,
        captured_at: Optional[datetime] = None,
    ) -> CampusAggregate:
        """Calculates campus totals and metrics from current active asset states."""
        now_dt = captured_at or utc_now()
        if now_dt.tzinfo is None:
            now_dt = now_dt.replace(tzinfo=timezone.utc)

        acc = {
            "solar": 0.0,
            "wind": 0.0,
            "demand": 0.0,
            "batt_charge": 0.0,
            "batt_discharge": 0.0,
            "grid_import": 0.0,
            "grid_export": 0.0,
        }
        soc_list: List[float] = []

        for state in asset_states:
            if state.telemetry_quality in (TelemetryQuality.GOOD, TelemetryQuality.SUSPECT):
                atype = self._resolve_asset_type(state, assets_meta)
                power = state.active_power_kw if state.active_power_kw is not None else 0.0
                self._accumulate_generation_load(atype, power, acc)
                self._accumulate_storage_grid(atype, power, state, acc, soc_list)

        counts, max_age = self._calculate_status_counts(asset_states, now_dt)

        total_gen = acc["solar"] + acc["wind"]
        net_batt = acc["batt_discharge"] - acc["batt_charge"]
        net_grid = acc["grid_import"] - acc["grid_export"]
        avg_soc = sum(soc_list) / len(soc_list) if soc_list else None

        if counts["offline"] > 0 and counts["online"] == 0:
            overall_q = TelemetryQuality.MISSING
        elif counts["stale"] > 0 or counts["degraded"] > 0:
            overall_q = TelemetryQuality.SUSPECT
        else:
            overall_q = TelemetryQuality.GOOD

        return CampusAggregate(
            site_id=site_id,
            captured_at=now_dt,
            total_solar_kw=round(acc["solar"], 3),
            total_wind_kw=round(acc["wind"], 3),
            total_generation_kw=round(total_gen, 3),
            total_building_demand_kw=round(acc["demand"], 3),
            total_battery_charge_kw=round(acc["batt_charge"], 3),
            total_battery_discharge_kw=round(acc["batt_discharge"], 3),
            net_battery_kw=round(net_batt, 3),
            grid_import_kw=round(acc["grid_import"], 3),
            grid_export_kw=round(acc["grid_export"], 3),
            net_grid_flow_kw=round(net_grid, 3),
            average_battery_soc_percent=round(avg_soc, 1) if avg_soc is not None else None,
            online_assets_count=counts["online"],
            stale_assets_count=counts["stale"],
            degraded_assets_count=counts["degraded"],
            offline_assets_count=counts["offline"],
            overall_quality=overall_q,
            data_freshness_age_seconds=round(max_age, 1),
        )

    async def get_live_twin(self, site_id: int) -> Dict[str, Any]:
        """Retrieves full digital twin representation for frontend consumption."""
        site = await self.repo.get_site(site_id)
        asset_states = await self.repo.get_all_asset_states(site_id)
        campus_agg = self.compute_campus_aggregates(site_id, asset_states)

        return {
            "site": {
                "id": site.id if site else site_id,
                "name": site.name if site else f"Site-{site_id}",
                "timezone": site.timezone if site else "Asia/Kolkata",
                "jurisdiction": site.jurisdiction if site else "India",
                "currency": site.currency if site else "INR",
            },
            "aggregate": campus_agg.model_dump(),
            "assets": [
                {
                    "asset_id": state.asset_id,
                    "asset_type": state.asset.asset_type.value if state.asset else "unknown",
                    "name": state.asset.name if state.asset else state.asset_id,
                    "status": state.operational_status,
                    "quality": state.telemetry_quality.value,
                    "active_power_kw": state.active_power_kw,
                    "energy_kwh": state.energy_kwh,
                    "soc_percent": state.soc_percent,
                    "health_percent": state.health_percent,
                    "temperature_celsius": state.temperature_celsius,
                    "voltage_v": state.voltage_v,
                    "frequency_hz": state.frequency_hz,
                    "observed_at": state.observed_at.isoformat() if state.observed_at else None,
                    "received_at": state.received_at.isoformat(),
                    "raw_metrics": state.raw_metrics,
                }
                for state in asset_states
            ],
        }
