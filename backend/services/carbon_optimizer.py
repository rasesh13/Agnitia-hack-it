from pydantic import BaseModel, ConfigDict, Field


class CarbonEvaluation(BaseModel):
    """
    Greenhouse gas emission impact for a candidate dispatch strategy.
    Conforms to SURYA spec Section 11.7.
    """

    model_config = ConfigDict(extra="forbid")

    grid_import_kwh: float = Field(0.0, ge=0.0, description="Grid import energy in kWh")
    renewable_used_kwh: float = Field(
        0.0, ge=0.0, description="Renewable energy utilized onsite in kWh"
    )
    grid_emission_factor_kg_per_kwh: float = Field(
        ..., ge=0.0, description="Grid carbon emission intensity in kgCO2e/kWh"
    )
    gross_carbon_kg: float = Field(
        0.0, ge=0.0, description="Direct emissions from grid electricity in kgCO2e"
    )
    avoided_carbon_kg: float = Field(
        0.0, ge=0.0, description="Emissions displaced by renewable self-consumption in kgCO2e"
    )
    net_carbon_kg: float = Field(
        0.0, description="Net operational emissions in kgCO2e"
    )
    attribution_method: str = Field(
        "location_based_marginal", description="Carbon accounting standard/method"
    )


class CarbonOptimizer:
    """
    Evaluates operational greenhouse gas emissions and clean energy offsets.
    Conforms to SURYA spec Section 11.7.
    """

    def evaluate_carbon(
        self,
        grid_import_kwh: float,
        renewable_used_kwh: float,
        grid_emission_factor_kg_per_kwh: float = 0.82,
        attribution_method: str = "location_based_marginal",
    ) -> CarbonEvaluation:
        """
        Computes gross emissions, clean power avoided emissions, and net carbon footprint.
        """
        import_kwh = max(0.0, grid_import_kwh)
        renew_kwh = max(0.0, renewable_used_kwh)

        gross_carbon = round(import_kwh * grid_emission_factor_kg_per_kwh, 2)
        avoided_carbon = round(renew_kwh * grid_emission_factor_kg_per_kwh, 2)
        net_carbon = gross_carbon  # Direct operational emissions

        return CarbonEvaluation(
            grid_import_kwh=round(import_kwh, 2),
            renewable_used_kwh=round(renew_kwh, 2),
            grid_emission_factor_kg_per_kwh=grid_emission_factor_kg_per_kwh,
            gross_carbon_kg=gross_carbon,
            avoided_carbon_kg=avoided_carbon,
            net_carbon_kg=net_carbon,
            attribution_method=attribution_method,
        )
