// ==============================================================================
// SURYA Frontend Canonical TypeScript Types
// Strictly matched against backend Pydantic models & SQLAlchemy schemas
// ==============================================================================

export type UserRole = 'admin' | 'operator' | 'viewer';

export interface UserReadResponse {
  id: number;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: UserReadResponse;
}

export interface APIErrorDetail {
  code: string;
  message: string;
  request_id?: string;
  details?: Record<string, unknown>;
}

export interface APIErrorResponse {
  error: APIErrorDetail;
}

// ==============================================================================
// Digital Twin & Telemetry Types
// ==============================================================================

export type AssetType =
  | 'solar'
  | 'wind'
  | 'battery'
  | 'building'
  | 'grid_interconnection'
  | 'substation'
  | 'meter';

export type TelemetryQuality = 'good' | 'suspect' | 'stale' | 'missing' | 'invalid';

export interface AssetCurrentState {
  asset_id: string;
  operational_status: string;
  active_power_kw: number;
  reactive_power_kvar?: number | null;
  voltage_v?: number | null;
  frequency_hz?: number | null;
  soc_percent?: number | null;
  temperature_celsius?: number | null;
  wind_speed_ms?: number | null;
  health_percent?: number | null;
  telemetry_quality: TelemetryQuality;
  raw_payload?: Record<string, unknown> | null;
  observed_at: string;
  received_at: string;
}

export interface AssetRead {
  id: string;
  name: string;
  asset_type: AssetType;
  site_id: number;
  rated_capacity_kw: number;
  is_active: boolean;
  state?: AssetCurrentState | null;
  building_config?: BuildingConfig | null;
  battery_config?: BatteryConfig | null;
}

export interface SiteRead {
  id: number;
  name: string;
  timezone: string;
  jurisdiction: string;
  currency: string;
  config_version: number;
  total_assets: number;
  assets: AssetRead[];
  aggregates?: {
    total_solar_generation_kw: number;
    total_wind_generation_kw: number;
    total_renewable_generation_kw: number;
    total_campus_demand_kw: number;
    total_battery_power_kw: number;
    net_grid_exchange_kw: number;
    average_battery_soc_percent: number;
    data_freshness_status: string;
  };
}

export interface CanonicalMeasurement {
  metric_name: string;
  value: number;
  unit: string;
  observed_at: string;
  quality?: TelemetryQuality;
  raw_status?: string | null;
}

export interface TelemetryPoint {
  id: number;
  asset_id: string;
  metric_name: string;
  value: number;
  unit: string;
  quality: TelemetryQuality;
  observed_at: string;
  received_at: string;
  source_adapter?: string | null;
}

// ==============================================================================
// Decisions, Alternatives, & Control Commands
// ==============================================================================

export type DecisionType =
  | 'dispatch'
  | 'battery'
  | 'vnm_allocation'
  | 'load_shift'
  | 'reliability';

export type DecisionCycleStatus = 'started' | 'completed' | 'degraded' | 'blocked' | 'failed';

export type CommandStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'timeout'
  | 'failed'
  | 'executed';

export interface ControlCommand {
  id: string;
  idempotency_key: string;
  decision_id?: string | null;
  target_asset_id: string;
  action: string;
  requested_setpoint: number;
  unit: string;
  status: CommandStatus;
  valid_from: string;
  valid_until: string;
  reason: string;
  originating_actor: string;
  adapter_response?: Record<string, unknown> | null;
  created_at: string;
}

export interface DecisionLog {
  id: string;
  cycle_id: string;
  site_id: number;
  target_asset_id?: string | null;
  decision_type: DecisionType;
  action: string;
  setpoint_kw?: number | null;
  allocated_kwh?: number | null;
  allocated_value_inr?: number | null;
  actor: string;
  reason: string;
  confidence: number;
  expected_savings_inr?: number | null;
  carbon_impact_kg?: number | null;
  context_data?: Record<string, unknown> | null;
  created_at: string;
  commands: ControlCommand[];
}

export interface DecisionAlternative {
  id: number;
  cycle_id: string;
  candidate_id: string;
  strategy_description: string;
  score: number;
  cost_component: number;
  carbon_component: number;
  is_selected: boolean;
  rejected_reason?: string | null;
  created_at: string;
}

export interface DecisionCycle {
  id: string;
  site_id: number;
  status: DecisionCycleStatus;
  input_snapshot_hash: string;
  cycle_started_at: string;
  cycle_completed_at?: string | null;
  duration_ms?: number | null;
  health_summary?: Record<string, unknown> | null;
  reason?: string | null;
  decisions: DecisionLog[];
  alternatives: DecisionAlternative[];
}

export interface DecisionStats {
  site_id: number;
  total_decisions: number;
  total_savings_inr: number;
  total_carbon_reduction_kg: number;
  by_type: Record<
    string,
    {
      count: number;
      total_kwh: number;
      total_savings_inr: number;
      total_carbon_kg: number;
    }
  >;
}

// ==============================================================================
// Configuration & Settings Types
// ==============================================================================

export type CriticalityTier = 'critical' | 'essential' | 'non_critical';

export type AlertSeverity = 'critical' | 'warning' | 'info';

export interface SystemAlert {
  id: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  source: string;
  metric_name?: string;
  current_value?: number;
  threshold_value?: number;
  created_at: string;
  is_acknowledged: boolean;
  acknowledged_at?: string | null;
  acknowledged_by?: string | null;
}

export interface AlertThreshold {
  id: number;
  metric_name: string;
  threshold_value: number;
  unit: string;
  severity: AlertSeverity;
  is_active: boolean;
  updated_by_user_id?: number | null;
  updated_at: string;
}

export interface BuildingConfig {
  id: number;
  asset_id: string;
  building_name: string;
  criticality_tier: CriticalityTier;
  flexible_load_policy?: string | null;
  peak_load_kw: number;
  operational_metadata?: Record<string, unknown> | null;
  updated_at: string;
}

export interface VNMSharingRule {
  id: number;
  building_asset_id: string;
  sharing_ratio: number;
  rule_version: number;
  jurisdiction: string;
  effective_from: string;
  effective_until?: string | null;
  updated_by_user_id?: number | null;
  updated_at: string;
}

export interface BatteryConfig {
  id: number;
  asset_id: string;
  min_soc: number;
  max_soc: number;
  reserve_floor: number;
  max_charge_power_kw: number;
  max_discharge_power_kw: number;
  round_trip_efficiency: number;
  health_floor: number;
  updated_at: string;
}

export interface ControlPolicy {
  closed_loop_enabled: boolean;
  emergency_stop_active: boolean;
  cost_weight: number;
  carbon_weight: number;
  decision_cycle_seconds: number;
}

export interface AuditEvent {
  id: number;
  event_type: string;
  user_id?: number | null;
  actor: string;
  action: string;
  resource_type: string;
  resource_id?: string | null;
  details?: Record<string, unknown> | null;
  created_at: string;
}

// ==============================================================================
// WebSocket & Envelope Types
// ==============================================================================

export type WebSocketEventType = 'twin_update' | 'full_cycle' | 'alert' | 'health' | 'error';

export interface WebSocketEnvelope<T = unknown> {
  version: number;
  type: WebSocketEventType;
  message_id: string;
  sent_at: string;
  request_id?: string | null;
  data: T;
}

// ==============================================================================
// Reporting & Export Types
// ==============================================================================

export interface ExportStats {
  site_id: number;
  period_start?: string | null;
  period_end?: string | null;
  timezone: string;
  currency: string;
  units: Record<string, string>;
  tariffs: {
    grid_import_inr_per_kwh: number;
    grid_export_inr_per_kwh: number;
    carbon_emission_factor_kg_per_kwh: number;
  };
  metrics: {
    total_decisions: number;
    total_energy_allocated_kwh: number;
    total_cost_savings_inr: number;
    total_carbon_reduction_kg: number;
    by_type: Record<
      string,
      {
        count: number;
        allocated_kwh: number;
        savings_inr: number;
        carbon_reduction_kg: number;
      }
    >;
  };
  data_quality_disclosure: {
    telemetry_completeness_pct: number;
    good_quality_points: number;
    stale_or_uncertain_points: number;
    notes: string[];
  };
}

export interface HealthStatus {
  status: string;
  service?: string;
  timestamp: string;
  components?: {
    database: string;
    environment: string;
    scheduler_enabled: boolean;
  };
  scheduler?: {
    is_running: boolean;
    is_locked: boolean;
    closed_loop_enabled: boolean;
    emergency_stop_active: boolean;
    decision_cycle_seconds: number;
    last_cycle_started_at?: string | null;
    last_cycle_completed_at?: string | null;
    last_cycle_status?: string | null;
    last_cycle_duration_ms?: number | null;
    last_cycle_id?: string | null;
    consecutive_failures: number;
    total_cycles_executed: number;
    total_cycles_failed: number;
    last_error?: string | null;
    next_cycle_in_seconds?: number | null;
  };
}
