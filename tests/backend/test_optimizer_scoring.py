import pytest

from backend.models.decision_log import DecisionType
from backend.services.carbon_optimizer import CarbonOptimizer
from backend.services.cost_optimizer import CostOptimizer
from backend.services.dispatch_optimizer import (
    CandidateStrategy,
    DispatchOptimizer,
)


@pytest.fixture
def cost_optimizer() -> CostOptimizer:
    return CostOptimizer()


@pytest.fixture
def carbon_optimizer() -> CarbonOptimizer:
    return CarbonOptimizer()


@pytest.fixture
def dispatch_optimizer() -> DispatchOptimizer:
    return DispatchOptimizer()


def test_cost_optimizer_basic(cost_optimizer: CostOptimizer):
    # 100 kWh import @ 10.0 INR/kWh, 50 kWh export @ 4.0 INR/kWh,
    # 20 kWh battery throughput @ 1.0 INR/kWh
    eval_res = cost_optimizer.evaluate_cost(
        grid_import_kwh=100.0,
        grid_export_kwh=50.0,
        battery_throughput_kwh=20.0,
        import_tariff_inr=10.0,
        export_tariff_inr=4.0,
        battery_degradation_cost_per_kwh=1.0,
    )

    assert eval_res.import_cost_inr == 1000.0
    assert eval_res.export_credit_inr == 200.0
    assert eval_res.battery_degradation_cost_inr == 20.0
    assert eval_res.demand_charge_inr == 0.0
    # Net cost = 1000 + 20 - 200 = 820.0
    assert eval_res.net_cost_inr == 820.0
    assert eval_res.currency == "INR"


def test_cost_optimizer_demand_charge(cost_optimizer: CostOptimizer):
    # Peak demand 600 kW vs 500 kW threshold -> 100 kW excess * 250 INR/kW = 25,000 INR
    eval_res = cost_optimizer.evaluate_cost(
        grid_import_kwh=50.0,
        grid_export_kwh=0.0,
        import_tariff_inr=10.0,
        peak_demand_kw=600.0,
        demand_charge_threshold_kw=500.0,
        demand_penalty_rate_inr_per_kw=250.0,
    )
    assert eval_res.import_cost_inr == 500.0
    assert eval_res.demand_charge_inr == 25000.0
    assert eval_res.net_cost_inr == 25500.0


def test_carbon_optimizer(carbon_optimizer: CarbonOptimizer):
    # 100 kWh import, 200 kWh renewable used, factor 0.80 kg/kWh
    eval_res = carbon_optimizer.evaluate_carbon(
        grid_import_kwh=100.0,
        renewable_used_kwh=200.0,
        grid_emission_factor_kg_per_kwh=0.80,
    )
    assert eval_res.gross_carbon_kg == 80.0
    assert eval_res.avoided_carbon_kg == 160.0
    assert eval_res.net_carbon_kg == 80.0
    assert eval_res.attribution_method == "location_based_marginal"


def test_dispatch_candidate_generation(dispatch_optimizer: DispatchOptimizer):
    candidates = dispatch_optimizer.generate_candidates(
        campus_demand_kw=200.0,
        available_solar_kw=150.0,
        available_wind_kw=50.0,
        battery_discharge_cap_kw=100.0,
        battery_charge_cap_kw=100.0,
    )
    assert len(candidates) >= 4
    names = [c.strategy_name for c in candidates]
    assert "Self Consumption" in names
    assert "Cost Minimization" in names
    assert "Carbon Minimization" in names
    assert "Conservative Reserve" in names


def test_score_and_rank_candidates_normalization(dispatch_optimizer: DispatchOptimizer):
    # Synthetic candidates to test min-max normalization
    c1 = CandidateStrategy(
        candidate_id="cand-A",
        strategy_name="Strategy A",
        description="High cost, low carbon",
        solar_power_kw=100.0,
        wind_power_kw=0.0,
        battery_power_kw=0.0,
        grid_import_kw=0.0,
        grid_export_kw=0.0,
        curtailed_solar_kw=0.0,
        served_demand_kw=100.0,
        reliability_margin_kw=50.0,
        cost_eval=dispatch_optimizer.cost_opt.evaluate_cost(100.0, 0.0, import_tariff_inr=10.0),
        carbon_eval=dispatch_optimizer.carbon_opt.evaluate_carbon(0.0, 100.0),
    )
    c2 = CandidateStrategy(
        candidate_id="cand-B",
        strategy_name="Strategy B",
        description="Low cost, high carbon",
        solar_power_kw=0.0,
        wind_power_kw=0.0,
        battery_power_kw=0.0,
        grid_import_kw=100.0,
        grid_export_kw=0.0,
        curtailed_solar_kw=0.0,
        served_demand_kw=100.0,
        reliability_margin_kw=50.0,
        cost_eval=dispatch_optimizer.cost_opt.evaluate_cost(0.0, 100.0, export_tariff_inr=5.0),
        carbon_eval=dispatch_optimizer.carbon_opt.evaluate_carbon(100.0, 0.0),
    )

    # c1 cost is 1000 (max), carbon is 0 (min) -> norm_cost = 1.0, norm_carbon = 0.0
    # c2 cost is -500 (min), carbon is 82 (max) -> norm_cost = 0.0, norm_carbon = 1.0
    # With w_cost=0.7, w_carbon=0.3:
    # score(c1) = 0.7 * 1.0 + 0.3 * 0.0 = 0.70
    # score(c2) = 0.7 * 0.0 + 0.3 * 1.0 = 0.30 -> c2 wins!
    ranked = dispatch_optimizer.score_and_rank_candidates(
        candidates=[c1, c2],
        w_cost=0.7,
        w_carbon=0.3,
    )
    assert ranked[0].candidate_id == "cand-B"
    assert ranked[0].weighted_score == 0.30
    assert ranked[1].candidate_id == "cand-A"
    assert ranked[1].weighted_score == 0.70


def test_deterministic_tie_breakers(dispatch_optimizer: DispatchOptimizer):
    # Create two candidates with identical cost and carbon (so identical score)
    # but different reliability margins
    c1 = CandidateStrategy(
        candidate_id="cand-Z",
        strategy_name="Strategy Z",
        description="Lower margin",
        solar_power_kw=100.0,
        wind_power_kw=0.0,
        battery_power_kw=0.0,
        grid_import_kw=50.0,
        grid_export_kw=0.0,
        curtailed_solar_kw=0.0,
        served_demand_kw=100.0,
        reliability_margin_kw=30.0,  # Lower margin
        cost_eval=dispatch_optimizer.cost_opt.evaluate_cost(50.0, 0.0),
        carbon_eval=dispatch_optimizer.carbon_opt.evaluate_carbon(50.0, 50.0),
    )
    c2 = CandidateStrategy(
        candidate_id="cand-A",
        strategy_name="Strategy A",
        description="Higher margin",
        solar_power_kw=100.0,
        wind_power_kw=0.0,
        battery_power_kw=0.0,
        grid_import_kw=50.0,
        grid_export_kw=0.0,
        curtailed_solar_kw=0.0,
        served_demand_kw=100.0,
        reliability_margin_kw=80.0,  # Higher margin
        cost_eval=dispatch_optimizer.cost_opt.evaluate_cost(50.0, 0.0),
        carbon_eval=dispatch_optimizer.carbon_opt.evaluate_carbon(50.0, 50.0),
    )

    ranked = dispatch_optimizer.score_and_rank_candidates(
        candidates=[c1, c2],
        w_cost=0.5,
        w_carbon=0.5,
    )
    # Higher reliability margin wins tie-breaker
    assert ranked[0].candidate_id == "cand-A"
    assert ranked[0].reliability_margin_kw == 80.0


def test_optimize_dispatch_full_workflow(dispatch_optimizer: DispatchOptimizer):
    result = dispatch_optimizer.optimize_dispatch(
        site_id=1,
        campus_demand_kw=180.0,
        available_solar_kw=120.0,
        available_wind_kw=30.0,
        battery_discharge_cap_kw=80.0,
        battery_charge_cap_kw=80.0,
        w_cost=0.6,
        w_carbon=0.4,
    )

    assert result.site_id == 1
    assert result.selected_strategy is not None
    assert len(result.alternatives) > 0

    decision, alternatives = dispatch_optimizer.generate_decision_and_alternatives(
        result=result,
        cycle_id="cycle-disp-1",
    )

    assert decision.cycle_id == "cycle-disp-1"
    assert decision.decision_type == DecisionType.DISPATCH
    assert decision.setpoint_kw >= 0.0
    assert "strategy_name" in decision.context_data
    assert "weighted_score" in decision.context_data
    assert len(alternatives) == len(result.alternatives)
    for alt in alternatives:
        assert alt.cycle_id == "cycle-disp-1"
        assert alt.rejected_reason is not None
        assert alt.candidate_id is not None
        assert alt.score >= 0.0
