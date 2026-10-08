import hashlib
import time
import uuid
from datetime import timedelta
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.repositories.decision_repo import DecisionRepository
from backend.db.repositories.twin_repo import TwinRepository
from backend.models.base import utc_now
from backend.models.config import BatteryConfig, BuildingConfig, VNMSharingRule
from backend.models.decision_log import (
    CommandStatus,
    ControlCommand,
    DecisionAlternative,
    DecisionCycleStatus,
    DecisionLog,
)
from backend.models.telemetry import (
    AssetCurrentState,
    EnergySnapshot,
    TelemetryQuality,
)
from backend.services.battery_scheduler import (
    BatteryAction,
    BatteryDispatchPlan,
    BatteryScheduler,
)
from backend.services.digital_twin_store import DigitalTwinStore
from backend.services.dispatch_optimizer import (
    DispatchOptimizer,
    ScoredDispatchResult,
)
from backend.services.forecast_engine import CampusForecast, ForecastEngine
from backend.services.load_advisor import CampusLoadShiftPlan, LoadAdvisor
from backend.services.reliability_guard import (
    ReliabilityAssessment,
    ReliabilityGuard,
)
from backend.services.vnm_optimizer import (
    VNMAllocationResult,
    VNMOptimizer,
    VNMStrategy,
)


class DecisionCycleResult(BaseModel):
    """
    Execution summary of an end-to-end optimization cycle.
    Conforms to SURYA spec Section 10.
    """

    model_config = ConfigDict(extra="forbid", arbitrary_types_allowed=True)

    cycle_id: str = Field(..., description="Unique cycle execution identifier")
    site_id: int = Field(..., description="Target site identifier")
    status: DecisionCycleStatus = Field(..., description="Final cycle lifecycle status")
    duration_ms: float = Field(..., ge=0.0, description="Cycle execution elapsed time in ms")
    decisions: List[DecisionLog] = Field(
        default_factory=list, description="Selected immutable decision records"
    )
    alternatives: List[DecisionAlternative] = Field(
        default_factory=list, description="Considered rejected alternatives"
    )
    commands: List[ControlCommand] = Field(
        default_factory=list, description="Generated control commands (if closed-loop enabled)"
    )
    reliability_assessment: ReliabilityAssessment = Field(
        ..., description="Physical reliability assessment"
    )
    forecast: Optional[CampusForecast] = Field(
        None, description="Multi-interval campus forecast"
    )
    dispatch_result: Optional[ScoredDispatchResult] = Field(
        None, description="Optimal candidate dispatch result"
    )
    battery_plans: List[BatteryDispatchPlan] = Field(
        default_factory=list, description="Validated battery dispatch plans"
    )
    vnm_result: Optional[VNMAllocationResult] = Field(
        None, description="Virtual Net Metering allocation result"
    )
    load_shift_plan: Optional[CampusLoadShiftPlan] = Field(
        None, description="Flexible load shift recommendations"
    )
    reason: Optional[str] = Field(None, description="Cycle status or failure rationale")
    health_summary: Dict[str, Any] = Field(
        default_factory=dict, description="Module health summary"
    )


class DecisionManager:
    """
    Orchestrator for the SURYA Decision Engine Lifecycle.
    Executes the 18-step sequential decision pipeline conforming to SURYA spec Section 10.
    """

    def __init__(
        self,
        session: AsyncSession,
        twin_repo: Optional[TwinRepository] = None,
        decision_repo: Optional[DecisionRepository] = None,
        digital_twin_store: Optional[DigitalTwinStore] = None,
        forecast_engine: Optional[ForecastEngine] = None,
        reliability_guard: Optional[ReliabilityGuard] = None,
        dispatch_optimizer: Optional[DispatchOptimizer] = None,
        battery_scheduler: Optional[BatteryScheduler] = None,
        vnm_optimizer: Optional[VNMOptimizer] = None,
        load_advisor: Optional[LoadAdvisor] = None,
    ) -> None:
        self.session = session
        self.twin_repo = twin_repo or TwinRepository(session)
        self.decision_repo = decision_repo or DecisionRepository(session)
        self.twin_store = digital_twin_store or DigitalTwinStore(self.twin_repo)
        self.forecast_engine = forecast_engine or ForecastEngine()
        self.reliability_guard = reliability_guard or ReliabilityGuard()
        self.dispatch_optimizer = dispatch_optimizer or DispatchOptimizer()
        self.battery_scheduler = battery_scheduler or BatteryScheduler()
        self.vnm_optimizer = vnm_optimizer or VNMOptimizer()
        self.load_advisor = load_advisor or LoadAdvisor()

    def _compute_input_hash(self, site_id: int, snapshot: Optional[EnergySnapshot]) -> str:
        snap_ts = snapshot.captured_at.isoformat() if snapshot else "none"
        raw_str = f"{site_id}:{snap_ts}:{time.time()}"
        return hashlib.sha256(raw_str.encode("utf-8")).hexdigest()

    async def run_decision_cycle(
        self,
        site_id: int,
        snapshot: Optional[EnergySnapshot] = None,
        closed_loop_enabled: bool = False,
        emergency_stop_active: bool = False,
        w_cost: float = 0.6,
        w_carbon: float = 0.4,
        import_tariff_inr: float = 9.50,
        export_tariff_inr: float = 3.50,
        vnm_strategy: VNMStrategy = VNMStrategy.PROPORTIONAL,
        building_configs: Optional[List[BuildingConfig]] = None,
        battery_configs: Optional[Dict[str, BatteryConfig]] = None,
        vnm_rules: Optional[List[VNMSharingRule]] = None,
    ) -> DecisionCycleResult:
        """
        Executes a complete optimization and decision cycle.
        """
        start_time = time.perf_counter()
        cycle_id = str(uuid.uuid4())
        now = utc_now()
        input_hash = self._compute_input_hash(site_id, snapshot)

        # 1. Initialize cycle in STARTED state
        await self.decision_repo.create_cycle(
            cycle_id=cycle_id,
            site_id=site_id,
            input_snapshot_hash=input_hash,
            started_at=now,
        )

        health: Dict[str, Any] = {
            "adapter": "healthy" if snapshot else "stale",
            "database": "healthy",
            "forecast": "healthy",
            "reliability_guard": "healthy",
            "dispatch_optimizer": "healthy",
        }

        # 2. Emergency Stop Check
        if emergency_stop_active:
            duration_ms = round((time.perf_counter() - start_time) * 1000.0, 2)
            reason = "Automated control blocked due to active Emergency Stop"
            await self.decision_repo.update_cycle(
                cycle_id=cycle_id,
                status=DecisionCycleStatus.BLOCKED,
                duration_ms=duration_ms,
                reason=reason,
                health_summary=health,
            )
            # Default empty reliability assessment
            rel_assessment = ReliabilityAssessment(
                is_secure=False,
                is_emergency=True,
                shortfall_kw=0.0,
                reserve_margin_kw=0.0,
                critical_load_covered=True,
                essential_load_covered=True,
                reason=reason,
            )
            return DecisionCycleResult(
                cycle_id=cycle_id,
                site_id=site_id,
                status=DecisionCycleStatus.BLOCKED,
                duration_ms=duration_ms,
                reliability_assessment=rel_assessment,
                reason=reason,
                health_summary=health,
            )

        # 3. Process snapshot into digital twin store or fetch states
        raw_states = await self.twin_repo.get_all_asset_states()
        asset_states: Dict[str, AssetCurrentState] = {s.asset_id: s for s in raw_states}

        if snapshot:
            campus_aggregate = await self.twin_store.update_from_snapshot(snapshot)
            raw_states = await self.twin_repo.get_all_asset_states()
            asset_states = {s.asset_id: s for s in raw_states}
        else:
            campus_aggregate = self.twin_store.compute_campus_aggregates(
                site_id=site_id,
                asset_states=raw_states,
                captured_at=now,
            )

        b_configs = building_configs or []
        batt_configs = battery_configs or {}
        rules = vnm_rules or []

        # 5. Forecast generation
        forecast = self.forecast_engine.generate_campus_forecast(
            site_id=site_id,
            current_aggregate=campus_aggregate,
            horizon_hours=4,
            interval_minutes=15,
            now=now,
        )

        # 6. Reliability Assessment
        rel_assessment = self.reliability_guard.assess_campus_reliability(
            campus_aggregate=campus_aggregate,
            buildings=b_configs,
            asset_states=asset_states,
            battery_configs=batt_configs,
            grid_available=True,
        )

        decisions: List[DecisionLog] = []
        alternatives: List[DecisionAlternative] = []
        commands: List[ControlCommand] = []

        # If emergency: produce emergency shedding decision
        if rel_assessment.is_emergency:
            emerg_decisions = self.reliability_guard.generate_emergency_decisions(
                site_id=site_id,
                cycle_id=cycle_id,
                assessment=rel_assessment,
                created_at=now,
            )
            decisions.extend(emerg_decisions)

        # 7. Candidate Dispatch Optimization
        battery_discharge_cap = rel_assessment.battery_usable_discharge_kw
        battery_charge_cap = sum(c.max_charge_power_kw for c in batt_configs.values())

        dispatch_res = self.dispatch_optimizer.optimize_dispatch(
            site_id=site_id,
            campus_demand_kw=campus_aggregate.total_building_demand_kw,
            available_solar_kw=campus_aggregate.total_solar_kw,
            available_wind_kw=campus_aggregate.total_wind_kw,
            battery_discharge_cap_kw=battery_discharge_cap,
            battery_charge_cap_kw=battery_charge_cap,
            w_cost=w_cost,
            w_carbon=w_carbon,
            import_tariff_inr=import_tariff_inr,
            export_tariff_inr=export_tariff_inr,
        )

        disp_dec, disp_alts = self.dispatch_optimizer.generate_decision_and_alternatives(
            result=dispatch_res,
            cycle_id=cycle_id,
            created_at=now,
        )
        decisions.append(disp_dec)
        alternatives.extend(disp_alts)

        # 8. Battery Scheduling
        battery_plans: List[BatteryDispatchPlan] = []
        for asset_id, cfg in batt_configs.items():
            state = asset_states.get(asset_id)
            if not state:
                continue

            # Determine dispatch power based on dispatch strategy
            batt_power = dispatch_res.selected_strategy.battery_power_kw
            action = (
                BatteryAction.DISCHARGE if batt_power > 0
                else BatteryAction.CHARGE if batt_power < 0
                else BatteryAction.HOLD
            )
            req_p = abs(batt_power)

            plan = self.battery_scheduler.evaluate_dispatch(
                state=state,
                config=cfg,
                capacity_kwh=cfg.max_discharge_power_kw * 2.0,  # 2-hour capacity default
                requested_action=action,
                requested_power_kw=req_p,
                duration_minutes=15,
                is_emergency=rel_assessment.is_emergency,
            )
            battery_plans.append(plan)

            batt_dec = self.battery_scheduler.generate_decision_record(
                plan=plan,
                cycle_id=cycle_id,
                site_id=site_id,
                created_at=now,
            )
            decisions.append(batt_dec)

            # Generate Control Command if closed-loop enabled
            if closed_loop_enabled and plan.action != BatteryAction.HOLD:
                cmd_id = str(uuid.uuid4())
                idempotency_key = f"{cycle_id}:batt:{asset_id}:{now.isoformat()}"
                cmd = ControlCommand(
                    id=cmd_id,
                    idempotency_key=idempotency_key,
                    decision_id=batt_dec.id,
                    target_asset_id=asset_id,
                    action=f"set_power_{plan.action.value}",
                    requested_setpoint=plan.approved_power_kw,
                    unit="kW",
                    status=CommandStatus.PENDING,
                    valid_from=now,
                    valid_until=now + timedelta(minutes=15),
                    reason=plan.reason,
                    originating_actor="system:decision_manager",
                )
                commands.append(cmd)

        # 9. VNM Credit Allocation
        vnm_res: Optional[VNMAllocationResult] = None
        if rules and b_configs:
            building_demands = {
                b.asset_id: (
                    asset_states[b.asset_id].active_power_kw
                    if b.asset_id in asset_states and asset_states[b.asset_id].active_power_kw
                    else b.peak_load_kw * 0.5
                )
                for b in b_configs
            }
            avail_kwh = campus_aggregate.total_generation_kw * (15 / 60.0)
            vnm_res = self.vnm_optimizer.optimize_allocation(
                available_generation_kwh=avail_kwh,
                buildings=b_configs,
                demands_kw=building_demands,
                rules=rules,
                strategy=vnm_strategy,
                duration_minutes=15,
                tariff_inr_per_kwh=import_tariff_inr,
            )
            vnm_decs = self.vnm_optimizer.generate_decision_records(
                result=vnm_res,
                cycle_id=cycle_id,
                site_id=site_id,
                created_at=now,
            )
            decisions.extend(vnm_decs)

        # 10. Load Shifting Advisory
        load_plan: Optional[CampusLoadShiftPlan] = None
        if b_configs:
            load_plan = self.load_advisor.generate_recommendations(
                site_id=site_id,
                buildings=b_configs,
                asset_states=asset_states,
                forecast_intervals=forecast.intervals,
                peak_tariff_inr_per_kwh=import_tariff_inr,
                solar_surplus_tariff_inr_per_kwh=export_tariff_inr,
            )
            load_decs = self.load_advisor.generate_decision_records(
                plan=load_plan,
                cycle_id=cycle_id,
                created_at=now,
            )
            decisions.extend(load_decs)

        # 11. Persist decisions, alternatives, and commands immutably
        await self.decision_repo.save_decisions(decisions)
        await self.decision_repo.save_alternatives(alternatives)
        if commands:
            await self.decision_repo.save_commands(commands)

        # 12. Finalize lifecycle status
        is_degraded = (
            forecast.is_degraded
            or campus_aggregate.overall_quality != TelemetryQuality.GOOD
            or campus_aggregate.stale_assets_count > 0
        )
        final_status = (
            DecisionCycleStatus.DEGRADED if is_degraded
            else DecisionCycleStatus.COMPLETED
        )

        duration_ms = round((time.perf_counter() - start_time) * 1000.0, 2)
        summary_reason = (
            "Decision cycle completed with degraded forecast/telemetry data"
            if is_degraded
            else "Decision cycle completed successfully within operational bounds"
        )

        await self.decision_repo.update_cycle(
            cycle_id=cycle_id,
            status=final_status,
            duration_ms=duration_ms,
            reason=summary_reason,
            health_summary=health,
        )

        return DecisionCycleResult(
            cycle_id=cycle_id,
            site_id=site_id,
            status=final_status,
            duration_ms=duration_ms,
            decisions=decisions,
            alternatives=alternatives,
            commands=commands,
            reliability_assessment=rel_assessment,
            forecast=forecast,
            dispatch_result=dispatch_res,
            battery_plans=battery_plans,
            vnm_result=vnm_res,
            load_shift_plan=load_plan,
            reason=summary_reason,
            health_summary=health,
        )
