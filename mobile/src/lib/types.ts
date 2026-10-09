export type Role = 'admin' | 'operator' | 'viewer';

export interface User {
  id: number;
  email: string;
  role: Role;
}

export interface Session {
  serverUrl: string;
  token: string;
  user: User;
  demo: boolean;
  signedInAt: number;
}

export type AssetType = 'solar' | 'wind' | 'battery' | 'building' | 'grid_interconnection' | 'meter' | 'substation' | string;

export interface AssetState {
  asset_id: string;
  name: string;
  asset_type: AssetType;
  rated_capacity_kw: number;
  operational_status: string;
  telemetry_quality: string;
  active_power_kw: number | null;
  soc_percent: number | null;
  health_percent: number | null;
  temperature_celsius: number | null;
  wind_speed_ms: number | null;
  voltage_v: number | null;
  frequency_hz: number | null;
  age_seconds: number | null;
}

export interface Aggregate {
  captured_at: string;
  total_solar_kw: number;
  total_wind_kw: number;
  total_generation_kw: number;
  total_building_demand_kw: number;
  net_battery_kw: number;
  grid_import_kw: number;
  grid_export_kw: number;
  net_grid_flow_kw: number;
  average_battery_soc_percent: number | null;
  online_assets_count: number;
  stale_assets_count: number;
  degraded_assets_count: number;
  offline_assets_count: number;
  overall_quality: string;
  data_freshness_age_seconds: number;
}

export interface LiveTwin {
  site: { id: number; name: string; jurisdiction?: string; total_assets?: number };
  aggregate: Aggregate;
  assets: AssetState[];
}

export interface Decision {
  id: string;
  cycle_id: string;
  decision_type: string;
  action: string;
  reason: string;
  confidence: number;
  expected_savings_inr: number | null;
  carbon_impact_kg: number | null;
  setpoint_kw?: number | null;
  created_at: string;
}

export interface CycleSummary {
  id: string;
  status: string;
  cycle_started_at: string;
  duration_ms: number | null;
  health_summary?: Record<string, string>;
  reason?: string;
}

export interface DecisionStats {
  total_decisions: number;
  total_savings_inr: number;
  total_carbon_reduction_kg: number;
}

export interface ControlPolicy {
  closed_loop_enabled: boolean;
  emergency_stop_active: boolean;
  cost_weight: number;
  carbon_weight: number;
  decision_cycle_seconds: number;
}

/** Everything one refresh brings back. */
export interface Snapshot {
  twin: LiveTwin;
  cycle: CycleSummary | null;
  stats: DecisionStats | null;
  policy: ControlPolicy | null;
  fetchedAt: number;
}

export type Severity = 'critical' | 'warning' | 'info';

export interface AlertItem {
  key: string;
  severity: Severity;
  title: string;
  body: string;
  category: 'battery' | 'grid' | 'telemetry' | 'asset' | 'optimizer' | 'safety' | 'connection';
  raisedAt: number;
  resolvedAt: number | null;
  acknowledgedAt: number | null;
}

export interface AppSettings {
  notifications: boolean;
  notifyWarnings: boolean;
  notifyResolved: boolean;
  batteryLowSoc: number;
  batteryCriticalSoc: number;
  gridImportKw: number;
  staleSeconds: number;
  batteryTempC: number;
  refreshSeconds: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  notifications: true,
  notifyWarnings: true,
  notifyResolved: false,
  // Defaults mirror the backend's ALERT_* environment thresholds.
  batteryLowSoc: 25,
  batteryCriticalSoc: 15,
  gridImportKw: 450,
  staleSeconds: 120,
  batteryTempC: 45,
  refreshSeconds: 10,
};
