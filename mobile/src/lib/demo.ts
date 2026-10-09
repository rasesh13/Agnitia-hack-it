import type { AssetState, Decision, LiveTwin, Snapshot } from './types';

/*
 * Offline demo backend: a believable Prestige University microgrid that follows the
 * time of day (solar peaks at noon, evening load peak drains the battery). Used only
 * when the user chooses "Explore demo"; every demo screen is labelled as such.
 */

let emergencyStop = false;
let cycles = 0;

const hourNow = () => {
  const now = new Date();
  return now.getHours() + now.getMinutes() / 60;
};

const jitter = (seed: number, amount: number) => Math.sin(Date.now() / 7000 + seed) * amount;

function microgrid() {
  const hour = hourNow();
  const sun = Math.max(0, Math.sin(((hour - 6) / 13) * Math.PI));
  const solar = Math.max(0, 300 * sun * (0.92 + jitter(1, 0.05)));
  const wind = Math.max(0, 22 + jitter(2, 9) + (hour > 17 || hour < 7 ? 14 : 0));
  const academic = 60 + 75 * Math.max(0, Math.sin(((hour - 7) / 12) * Math.PI));
  const hostels = 45 + 40 * Math.max(0, Math.sin(((hour - 16) / 9) * Math.PI));
  const admin = 30 + 20 * Math.max(0, Math.sin(((hour - 8) / 10) * Math.PI));
  const load = academic + hostels + admin + jitter(3, 4);
  // Battery charges through the day and drains through the evening peak.
  const soc = Math.min(95, Math.max(12, 30 + 55 * Math.max(0, Math.sin(((hour - 8) / 12) * Math.PI)) - (hour > 19 ? (hour - 19) * 4 : 0)));
  const surplus = solar + wind - load;
  const battery = emergencyStop ? 0 : Math.max(-120, Math.min(120, surplus * 0.8));
  const grid = load - solar - wind + battery;
  return { solar, wind, academic, hostels, admin, load, soc, battery, grid };
}

const asset = (partial: Partial<AssetState> & Pick<AssetState, 'asset_id' | 'name' | 'asset_type' | 'rated_capacity_kw'>): AssetState => ({
  operational_status: 'online',
  telemetry_quality: 'good',
  active_power_kw: 0,
  soc_percent: null,
  health_percent: null,
  temperature_celsius: null,
  wind_speed_ms: null,
  voltage_v: 415,
  frequency_hz: 50.01,
  age_seconds: 4,
  ...partial,
});

function twin(): LiveTwin {
  const g = microgrid();
  const round = (value: number) => Math.round(value * 10) / 10;
  const assets: AssetState[] = [
    asset({ asset_id: 'solar-pv-01', name: 'Academic Block A Rooftop Solar PV', asset_type: 'solar', rated_capacity_kw: 180, active_power_kw: round(g.solar * 0.6), temperature_celsius: round(34 + g.solar / 40) }),
    asset({ asset_id: 'solar-pv-02', name: 'Engineering Block B Rooftop Solar PV', asset_type: 'solar', rated_capacity_kw: 120, active_power_kw: round(g.solar * 0.4), temperature_celsius: round(33 + g.solar / 45) }),
    asset({ asset_id: 'wind-wt-01', name: 'Campus Perimeter Micro-Wind Turbine Array', asset_type: 'wind', rated_capacity_kw: 120, active_power_kw: round(g.wind), wind_speed_ms: round(3 + g.wind / 9) }),
    asset({ asset_id: 'bess-unit-01', name: 'Main Substation BESS Unit 1 (250 kWh)', asset_type: 'battery', rated_capacity_kw: 125, active_power_kw: round(-g.battery / 2), soc_percent: round(g.soc + 0.4), health_percent: 96.8, temperature_celsius: 26.4 }),
    asset({ asset_id: 'bess-unit-02', name: 'Auxiliary Substation BESS Unit 2 (250 kWh)', asset_type: 'battery', rated_capacity_kw: 125, active_power_kw: round(-g.battery / 2), soc_percent: round(g.soc - 0.4), health_percent: 95.9, temperature_celsius: 26.2 }),
    asset({ asset_id: 'bldg-eng', name: 'Faculty of Engineering & Technology', asset_type: 'building', rated_capacity_kw: 140, active_power_kw: round(g.academic) }),
    asset({ asset_id: 'bldg-admin', name: 'Central Administration & Computing Centre', asset_type: 'building', rated_capacity_kw: 75, active_power_kw: round(g.admin) }),
    asset({ asset_id: 'bldg-hostel', name: 'Student Hostels & Residential Complex', asset_type: 'building', rated_capacity_kw: 110, active_power_kw: round(g.hostels) }),
    asset({ asset_id: 'grid-mppkvvcl-01', name: 'MPPKVVCL 11kV Grid Interconnection Feeder', asset_type: 'grid_interconnection', rated_capacity_kw: 350, active_power_kw: round(g.grid) }),
  ];
  return {
    site: { id: 1, name: 'Prestige University, Indore (Malwa Microgrid)', jurisdiction: 'Madhya Pradesh, India', total_assets: assets.length },
    aggregate: {
      captured_at: new Date().toISOString(),
      total_solar_kw: round(g.solar),
      total_wind_kw: round(g.wind),
      total_generation_kw: round(g.solar + g.wind),
      total_building_demand_kw: round(g.load),
      net_battery_kw: round(-g.battery),
      grid_import_kw: round(Math.max(0, g.grid)),
      grid_export_kw: round(Math.max(0, -g.grid)),
      net_grid_flow_kw: round(g.grid),
      average_battery_soc_percent: round(g.soc),
      online_assets_count: assets.length,
      stale_assets_count: 0,
      degraded_assets_count: 0,
      offline_assets_count: 0,
      overall_quality: 'good',
      data_freshness_age_seconds: 4,
    },
    assets,
  };
}

function decision(index: number): Decision {
  const g = microgrid();
  const evening = hourNow() > 17;
  const created = new Date(Date.now() - index * 10_000);
  const action = evening ? 'peak_shaving' : g.solar > g.load ? 'self_consumption' : 'grid_assist';
  const labels: Record<string, string> = {
    peak_shaving: 'Discharge BESS to shave the evening tariff peak',
    self_consumption: 'Route surplus solar into BESS for self consumption',
    grid_assist: 'Blend grid import with renewables at the standard tariff',
  };
  return {
    id: `demo-${created.getTime()}`,
    cycle_id: `demo-cycle-${created.getTime()}`,
    decision_type: index % 7 === 3 ? 'battery' : 'dispatch',
    action,
    reason: `${labels[action]}. Weighted cost/carbon score chosen over 3 alternatives.`,
    confidence: 0.92,
    expected_savings_inr: Math.round((60 + (index % 5) * 9) * 100) / 100,
    carbon_impact_kg: Math.round((18 + (index % 4) * 3.5) * 10) / 10,
    setpoint_kw: Math.round(g.solar + g.wind),
    created_at: created.toISOString(),
  };
}

export const demoBackend = {
  snapshot(): Snapshot {
    cycles += 1;
    return {
      twin: twin(),
      cycle: { id: `demo-cycle-${cycles}`, status: 'completed', cycle_started_at: new Date().toISOString(), duration_ms: 21, health_summary: { adapter: 'healthy', database: 'healthy', forecast: 'healthy' } },
      stats: { total_decisions: 412 + cycles, total_savings_inr: 34_210 + cycles * 81.7, total_carbon_reduction_kg: 11_980 + cycles * 28.7 },
      policy: { closed_loop_enabled: false, emergency_stop_active: emergencyStop, cost_weight: 0.6, carbon_weight: 0.4, decision_cycle_seconds: 10 },
      fetchedAt: Date.now(),
    };
  },
  decisions: (limit: number) => Array.from({ length: limit }, (_, index) => decision(index)),
  forceCycle: () => ({ cycle_id: `demo-cycle-${++cycles}`, status: 'completed', decisions_count: 1, duration_ms: 23 }),
  emergencyStop(active: boolean) {
    emergencyStop = active;
    return { emergency_stop_active: active, message: `Emergency stop ${active ? 'engaged' : 'released'} (demo)` };
  },
};
