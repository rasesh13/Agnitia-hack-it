from pydantic import BaseModel, ConfigDict, Field


class CostEvaluation(BaseModel):
    """
    Detailed monetary cost breakdown for a candidate dispatch strategy.
    Conforms to SURYA spec Section 11.7.
    """

    model_config = ConfigDict(extra="forbid")

    grid_import_kwh: float = Field(0.0, ge=0.0, description="Grid import energy in kWh")
    grid_export_kwh: float = Field(0.0, ge=0.0, description="Grid export energy in kWh")
    battery_throughput_kwh: float = Field(
        0.0, ge=0.0, description="Battery charged or discharged energy in kWh"
    )
    import_cost_inr: float = Field(
        0.0, ge=0.0, description="Total expense for grid import in INR"
    )
    export_credit_inr: float = Field(
        0.0, ge=0.0, description="Total revenue/credit for grid export in INR"
    )
    battery_degradation_cost_inr: float = Field(
        0.0, ge=0.0, description="Amortized battery wear cost in INR"
    )
    demand_charge_inr: float = Field(
        0.0, ge=0.0, description="Peak demand penalty/charge in INR"
    )
    net_cost_inr: float = Field(
        0.0, description="Net operational cost in INR (import + battery + demand - export)"
    )
    currency: str = Field("INR", description="Applied currency")
    import_tariff_inr_per_kwh: float = Field(
        ..., description="Applied import tariff in INR/kWh"
    )
    export_tariff_inr_per_kwh: float = Field(
        ..., description="Applied export feed-in tariff in INR/kWh"
    )


class CostOptimizer:
    """
    Evaluates financial costs and revenues for campus dispatch strategies.
    Conforms to SURYA spec Section 11.7.
    """

    def evaluate_cost(
        self,
        grid_import_kwh: float,
        grid_export_kwh: float,
        battery_throughput_kwh: float = 0.0,
        import_tariff_inr: float = 9.50,
        export_tariff_inr: float = 3.50,
        battery_degradation_cost_per_kwh: float = 0.80,
        peak_demand_kw: float = 0.0,
        demand_charge_threshold_kw: float = 500.0,
        demand_penalty_rate_inr_per_kw: float = 250.0,
    ) -> CostEvaluation:
        """
        Computes granular cost evaluation for an interval energy volume.
        """
        import_cost = round(max(0.0, grid_import_kwh) * import_tariff_inr, 2)
        export_credit = round(max(0.0, grid_export_kwh) * export_tariff_inr, 2)
        battery_wear = round(
            max(0.0, battery_throughput_kwh) * battery_degradation_cost_per_kwh, 2
        )

        demand_charge = 0.0
        if peak_demand_kw > demand_charge_threshold_kw:
            excess_kw = peak_demand_kw - demand_charge_threshold_kw
            demand_charge = round(excess_kw * demand_penalty_rate_inr_per_kw, 2)

        net_cost = round(import_cost + battery_wear + demand_charge - export_credit, 2)

        return CostEvaluation(
            grid_import_kwh=round(max(0.0, grid_import_kwh), 2),
            grid_export_kwh=round(max(0.0, grid_export_kwh), 2),
            battery_throughput_kwh=round(max(0.0, battery_throughput_kwh), 2),
            import_cost_inr=import_cost,
            export_credit_inr=export_credit,
            battery_degradation_cost_inr=battery_wear,
            demand_charge_inr=demand_charge,
            net_cost_inr=net_cost,
            currency="INR",
            import_tariff_inr_per_kwh=import_tariff_inr,
            export_tariff_inr_per_kwh=export_tariff_inr,
        )
