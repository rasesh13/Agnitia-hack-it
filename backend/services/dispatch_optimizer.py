from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from backend.models.base import utc_now
from backend.models.decision_log import (
    DecisionAlternative,
    DecisionLog,
    DecisionType,
)
from backend.services.carbon_optimizer import CarbonEvaluation, CarbonOptimizer
from backend.services.cost_optimizer import CostEvaluation, CostOptimizer


class CandidateStrategy(BaseModel):
    """
    Evaluated dispatch alternative for multi-energy campus balancing.
    Conforms to SURYA spec Section 11.1 and Section 11.3.
    """

    model_config = ConfigDict(extra="forbid")

    candidate_id: str = Field(..., description="Unique strategy candidate ID")
    strategy_name: str = Field(..., description="Short name of candidate strategy")
    description: str = Field(..., description="Operational strategy description")
    solar_power_kw: float = Field(..., ge=0.0, description="Dispatched solar generation in kW")
    wind_power_kw: float = Field(..., ge=0.0, description="Dispatched wind generation in kW")
    battery_power_kw: float = Field(
        0.0, description="Battery power: positive=discharge, negative=charge"
    )
    grid_import_kw: float = Field(0.0, ge=0.0, description="Grid import power in kW")
    grid_export_kw: float = Field(0.0, ge=0.0, description="Grid export power in kW")
    curtailed_solar_kw: float = Field(
        0.0, ge=0.0, description="Curtailed solar power in kW"
    )
    served_demand_kw: float = Field(..., ge=0.0, description="Total campus load served in kW")
    reliability_margin_kw: float = Field(
        0.0, description="Available spinning and battery reserve margin in kW"
    )
    cost_eval: CostEvaluation = Field(..., description="Financial cost evaluation")
    carbon_eval: CarbonEvaluation = Field(..., description="Carbon emission evaluation")
    normalized_cost: float = Field(
        0.0, ge=0.0, le=1.0, description="Normalized cost score [0..1]"
    )
    normalized_carbon: float = Field(
        0.0, ge=0.0, le=1.0, description="Normalized carbon score [0..1]"
    )
    weighted_score: float = Field(
        0.0, ge=0.0, le=1.0, description="Final weighted optimization score"
    )
    is_feasible: bool = Field(True, description="True if satisfies physical constraints")
    rejection_reason: Optional[str] = Field(
        None, description="Reason if candidate was rejected"
    )


class ScoredDispatchResult(BaseModel):
    """
    Final optimization selection result with alternatives and score breakdown.
    """

    model_config = ConfigDict(extra="forbid")

    selected_strategy: CandidateStrategy = Field(
        ..., description="Winning optimal dispatch candidate"
    )
    alternatives: List[CandidateStrategy] = Field(
        default_factory=list, description="Considered alternative strategies"
    )
    w_cost: float = Field(..., ge=0.0, le=1.0, description="Cost weight factor")
    w_carbon: float = Field(..., ge=0.0, le=1.0, description="Carbon weight factor")
    site_id: int = Field(..., description="Site identifier")
    evaluated_at: datetime = Field(
        default_factory=utc_now, description="Evaluation timestamp"
    )


class DispatchOptimizer:
    """
    Multi-objective Dispatch & Candidate Scoring Optimizer.
    Evaluates candidate strategies across cost and carbon dimensions using the formula:
    score(c) = w_cost * norm_cost(c) + w_carbon * norm_carbon(c)
    with deterministic tie-breakers: reliability margin -> carbon -> cost -> candidate ID.
    Conforms to SURYA spec Section 11.1, 11.3, 11.7.
    """

    def __init__(
        self,
        cost_optimizer: Optional[CostOptimizer] = None,
        carbon_optimizer: Optional[CarbonOptimizer] = None,
    ) -> None:
        self.cost_opt = cost_optimizer or CostOptimizer()
        self.carbon_opt = carbon_optimizer or CarbonOptimizer()

    def generate_candidates(
        self,
        campus_demand_kw: float,
        available_solar_kw: float,
        available_wind_kw: float,
        battery_discharge_cap_kw: float,
        battery_charge_cap_kw: float,
        max_grid_import_kw: float = 1000.0,
        max_grid_export_kw: float = 500.0,
        import_tariff_inr: float = 9.50,
        export_tariff_inr: float = 3.50,
        grid_emission_factor_kg_per_kwh: float = 0.82,
        duration_minutes: int = 15,
    ) -> List[CandidateStrategy]:
        """
        Generates distinct dispatch candidate strategies.
        """
        candidates: List[CandidateStrategy] = []
        tot_renewables = available_solar_kw + available_wind_kw
        hours = duration_minutes / 60.0

        # Helper to construct candidate
        def make_candidate(
            cand_id: str,
            name: str,
            desc: str,
            batt_power: float,  # positive = discharge, negative = charge
            curtail_solar: float = 0.0,
        ) -> CandidateStrategy:
            active_solar = max(0.0, available_solar_kw - curtail_solar)
            active_renew = active_solar + available_wind_kw

            # Power balance: demand + battery_charge =
            # renewables + battery_discharge + grid_import - grid_export
            # Net generation after battery:
            if batt_power >= 0.0:  # discharging
                internal_supply = active_renew + batt_power
                if internal_supply >= campus_demand_kw:
                    g_import = 0.0
                    g_export = min(max_grid_export_kw, internal_supply - campus_demand_kw)
                else:
                    g_import = min(max_grid_import_kw, campus_demand_kw - internal_supply)
                    g_export = 0.0
            else:  # charging (batt_power is negative)
                charge_req = abs(batt_power)
                if active_renew >= campus_demand_kw + charge_req:
                    g_import = 0.0
                    g_export = min(
                        max_grid_export_kw, active_renew - (campus_demand_kw + charge_req)
                    )
                elif active_renew >= campus_demand_kw:
                    # Partial charge from solar, rest from grid if needed
                    solar_left = active_renew - campus_demand_kw
                    g_import = max(0.0, charge_req - solar_left)
                    g_export = 0.0
                else:
                    g_import = min(
                        max_grid_import_kw, (campus_demand_kw + charge_req) - active_renew
                    )
                    g_export = 0.0

            imp_kwh = g_import * hours
            exp_kwh = g_export * hours
            batt_kwh = abs(batt_power) * hours
            renew_used_kwh = min(active_renew, campus_demand_kw) * hours

            cost_ev = self.cost_opt.evaluate_cost(
                grid_import_kwh=imp_kwh,
                grid_export_kwh=exp_kwh,
                battery_throughput_kwh=batt_kwh,
                import_tariff_inr=import_tariff_inr,
                export_tariff_inr=export_tariff_inr,
            )
            carb_ev = self.carbon_opt.evaluate_carbon(
                grid_import_kwh=imp_kwh,
                renewable_used_kwh=renew_used_kwh,
                grid_emission_factor_kg_per_kwh=grid_emission_factor_kg_per_kwh,
            )

            # Reliability margin: available remaining battery + grid capacity
            avail_batt_rem = (
                max(0.0, battery_discharge_cap_kw - batt_power)
                if batt_power >= 0
                else battery_discharge_cap_kw
            )
            avail_grid_rem = max(0.0, max_grid_import_kw - g_import)
            margin = round(avail_batt_rem + avail_grid_rem, 2)

            return CandidateStrategy(
                candidate_id=cand_id,
                strategy_name=name,
                description=desc,
                solar_power_kw=round(active_solar, 2),
                wind_power_kw=round(available_wind_kw, 2),
                battery_power_kw=round(batt_power, 2),
                grid_import_kw=round(g_import, 2),
                grid_export_kw=round(g_export, 2),
                curtailed_solar_kw=round(curtail_solar, 2),
                served_demand_kw=round(campus_demand_kw, 2),
                reliability_margin_kw=margin,
                cost_eval=cost_ev,
                carbon_eval=carb_ev,
            )

        # 1. Self Consumption Strategy
        if tot_renewables >= campus_demand_kw:
            surplus = tot_renewables - campus_demand_kw
            chg = min(battery_charge_cap_kw, surplus)
            candidates.append(
                make_candidate(
                    "cand-01-self-cons",
                    "Self Consumption",
                    "Serve demand from renewables; store excess in battery; export residue",
                    batt_power=-chg,
                )
            )
        else:
            deficit = campus_demand_kw - tot_renewables
            dis = min(battery_discharge_cap_kw, deficit)
            candidates.append(
                make_candidate(
                    "cand-01-self-cons",
                    "Self Consumption",
                    "Serve demand from renewables; discharge battery to cover deficit",
                    batt_power=dis,
                )
            )

        # 2. Cost Minimized Strategy
        dis_cost = min(
            battery_discharge_cap_kw,
            max(0.0, campus_demand_kw - tot_renewables)
        )
        candidates.append(
            make_candidate(
                "cand-02-cost-min",
                "Cost Minimization",
                "Maximize battery discharge during peak tariff to avoid grid imports",
                batt_power=dis_cost,
            )
        )

        # 3. Carbon Minimized Strategy
        dis_carb = min(
            battery_discharge_cap_kw,
            max(0.0, campus_demand_kw - tot_renewables)
        )
        candidates.append(
            make_candidate(
                "cand-03-carbon-min",
                "Carbon Minimization",
                "Minimize grid carbon emissions by substituting with battery and clean renewables",
                batt_power=dis_carb,
            )
        )

        # 4. Conservative Reserve Strategy
        candidates.append(
            make_candidate(
                "cand-04-conservative-res",
                "Conservative Reserve",
                "Hold battery idle to preserve emergency reserve floor",
                batt_power=0.0,
            )
        )

        # 5. Grid Export Support Strategy
        if tot_renewables > 0.0:
            candidates.append(
                make_candidate(
                    "cand-05-grid-export",
                    "Grid Export Support",
                    "Export maximum surplus to grid to capture feed-in revenue",
                    batt_power=0.0,
                )
            )

        return candidates

    def score_and_rank_candidates(
        self,
        candidates: List[CandidateStrategy],
        w_cost: float = 0.6,
        w_carbon: float = 0.4,
    ) -> List[CandidateStrategy]:
        """
        Applies min-max normalization and scores candidates using the weighted objective:
        score(c) = w_cost * norm_cost(c) + w_carbon * norm_carbon(c)
        Applies deterministic tie-breakers: reliability margin -> carbon -> cost -> candidate ID.
        """
        if not candidates:
            return []

        feasible = [c for c in candidates if c.is_feasible]
        if not feasible:
            return candidates

        costs = [c.cost_eval.net_cost_inr for c in feasible]
        carbons = [c.carbon_eval.net_carbon_kg for c in feasible]

        min_cost, max_cost = min(costs), max(costs)
        min_carb, max_carb = min(carbons), max(carbons)

        cost_range = max_cost - min_cost
        carb_range = max_carb - min_carb

        scored: List[CandidateStrategy] = []
        for c in candidates:
            if not c.is_feasible:
                c.weighted_score = 1.0
                scored.append(c)
                continue

            n_cost = (
                (c.cost_eval.net_cost_inr - min_cost) / cost_range
                if cost_range > 0.001
                else 0.0
            )
            n_carb = (
                (c.carbon_eval.net_carbon_kg - min_carb) / carb_range
                if carb_range > 0.001
                else 0.0
            )

            w_score = (w_cost * n_cost) + (w_carbon * n_carb)

            c.normalized_cost = round(max(0.0, min(1.0, n_cost)), 4)
            c.normalized_carbon = round(max(0.0, min(1.0, n_carb)), 4)
            c.weighted_score = round(max(0.0, min(1.0, w_score)), 4)
            scored.append(c)

        # Deterministic sorting:
        # 1. Feasibility (feasible first)
        # 2. weighted_score (ascending, lower is better)
        # 3. reliability_margin_kw (descending, higher is better)
        # 4. net_carbon_kg (ascending, lower is better)
        # 5. net_cost_inr (ascending, lower is better)
        # 6. candidate_id (alphabetical)
        scored.sort(
            key=lambda c: (
                0 if c.is_feasible else 1,
                c.weighted_score,
                -c.reliability_margin_kw,
                c.carbon_eval.net_carbon_kg,
                c.cost_eval.net_cost_inr,
                c.candidate_id,
            )
        )

        return scored

    def optimize_dispatch(
        self,
        site_id: int,
        campus_demand_kw: float,
        available_solar_kw: float,
        available_wind_kw: float,
        battery_discharge_cap_kw: float,
        battery_charge_cap_kw: float,
        w_cost: float = 0.6,
        w_carbon: float = 0.4,
        import_tariff_inr: float = 9.50,
        export_tariff_inr: float = 3.50,
        grid_emission_factor_kg_per_kwh: float = 0.82,
        duration_minutes: int = 15,
    ) -> ScoredDispatchResult:
        """
        Generates, scores, and selects optimal dispatch strategy for the decision cycle.
        """
        candidates = self.generate_candidates(
            campus_demand_kw=campus_demand_kw,
            available_solar_kw=available_solar_kw,
            available_wind_kw=available_wind_kw,
            battery_discharge_cap_kw=battery_discharge_cap_kw,
            battery_charge_cap_kw=battery_charge_cap_kw,
            import_tariff_inr=import_tariff_inr,
            export_tariff_inr=export_tariff_inr,
            grid_emission_factor_kg_per_kwh=grid_emission_factor_kg_per_kwh,
            duration_minutes=duration_minutes,
        )

        ranked = self.score_and_rank_candidates(
            candidates=candidates,
            w_cost=w_cost,
            w_carbon=w_carbon,
        )

        selected = ranked[0]
        alternatives = ranked[1:]

        return ScoredDispatchResult(
            selected_strategy=selected,
            alternatives=alternatives,
            w_cost=w_cost,
            w_carbon=w_carbon,
            site_id=site_id,
            evaluated_at=utc_now(),
        )

    def generate_decision_and_alternatives(
        self,
        result: ScoredDispatchResult,
        cycle_id: str,
        actor: str = "system:dispatch_optimizer",
        created_at: Optional[datetime] = None,
    ) -> tuple[DecisionLog, List[DecisionAlternative]]:
        """
        Constructs DecisionLog for the winning strategy and DecisionAlternative records
        for rejected alternatives.
        """
        sel = result.selected_strategy
        now = created_at or utc_now()

        context = {
            "strategy_name": sel.strategy_name,
            "solar_power_kw": sel.solar_power_kw,
            "wind_power_kw": sel.wind_power_kw,
            "battery_power_kw": sel.battery_power_kw,
            "grid_import_kw": sel.grid_import_kw,
            "grid_export_kw": sel.grid_export_kw,
            "reliability_margin_kw": sel.reliability_margin_kw,
            "weighted_score": sel.weighted_score,
            "normalized_cost": sel.normalized_cost,
            "normalized_carbon": sel.normalized_carbon,
            "net_cost_inr": sel.cost_eval.net_cost_inr,
            "net_carbon_kg": sel.carbon_eval.net_carbon_kg,
            "w_cost": result.w_cost,
            "w_carbon": result.w_carbon,
        }

        reason = (
            f"Selected {sel.strategy_name} with optimal weighted score {sel.weighted_score:.4f} "
            f"(Cost: ₹{sel.cost_eval.net_cost_inr:.2f}, "
            f"Carbon: {sel.carbon_eval.net_carbon_kg:.2f} kgCO2e, "
            f"Reserve Margin: {sel.reliability_margin_kw:.1f} kW)"
        )

        decision = DecisionLog(
            cycle_id=cycle_id,
            site_id=result.site_id,
            decision_type=DecisionType.DISPATCH,
            action=sel.strategy_name.lower().replace(" ", "_"),
            setpoint_kw=sel.solar_power_kw + sel.wind_power_kw,
            allocated_kwh=sel.served_demand_kw * (15 / 60.0),
            allocated_value_inr=sel.cost_eval.net_cost_inr,
            actor=actor,
            reason=reason,
            confidence=1.0,
            expected_savings_inr=sel.cost_eval.export_credit_inr,
            carbon_impact_kg=sel.carbon_eval.avoided_carbon_kg,
            context_data=context,
            created_at=now,
        )

        alternatives: List[DecisionAlternative] = []
        for alt in result.alternatives:
            alt_reason = (
                alt.rejection_reason
                or f"Score {alt.weighted_score:.4f} > winning {sel.weighted_score:.4f}"
            )
            alternatives.append(
                DecisionAlternative(
                    cycle_id=cycle_id,
                    candidate_id=alt.candidate_id,
                    strategy_description=alt.description or alt.strategy_name,
                    score=alt.weighted_score,
                    cost_component=alt.cost_eval.net_cost_inr,
                    carbon_component=alt.carbon_eval.net_carbon_kg,
                    is_selected=False,
                    rejected_reason=alt_reason,
                    created_at=now,
                )
            )

        return decision, alternatives
