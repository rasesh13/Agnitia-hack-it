import {
  AlertThreshold,
  BatteryConfig,
  BuildingConfig,
  ControlCommand,
  ControlPolicy,
  DecisionCycle,
  DecisionLog,
  DecisionStats,
  ExportStats,
  HealthStatus,
  SiteRead,
  TelemetryPoint,
  TokenResponse,
  UserReadResponse,
  VNMSharingRule,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export class ApiError extends Error {
  code: string;
  status: number;
  details?: Record<string, unknown>;

  constructor(
    message: string,
    code: string = 'API_ERROR',
    status: number = 500,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function getStoredToken(): string | null {
  return localStorage.getItem('surya_token');
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    // If session invalidated/expired, clear storage
    if (!endpoint.includes('/auth/login') && !endpoint.includes('/auth/signup')) {
      localStorage.removeItem('surya_token');
      localStorage.removeItem('surya_user');
      window.dispatchEvent(new Event('surya-auth-expired'));
    }
  }

  if (!response.ok) {
    let errorDetail = {
      code: `HTTP_${response.status}`,
      message: response.statusText || 'An unexpected error occurred',
      details: undefined,
    };
    try {
      const errData = await response.json();
      if (errData.detail) {
        if (typeof errData.detail === 'string') {
          errorDetail.message = errData.detail;
        } else if (typeof errData.detail === 'object') {
          errorDetail = { ...errorDetail, ...errData.detail };
        }
      } else if (errData.error) {
        errorDetail = { ...errorDetail, ...errData.error };
      }
    } catch {
      // Non-JSON error body fallback
    }

    throw new ApiError(errorDetail.message, errorDetail.code, response.status, errorDetail.details);
  }

  // Check if 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

// ==============================================================================
// Authentication API
// ==============================================================================

export const apiAuth = {
  login: async (email: string, password: string): Promise<TokenResponse> => {
    return request<TokenResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  signup: async (email: string, password: string): Promise<TokenResponse> => {
    return request<TokenResponse>('/api/v1/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  googleAuth: async (idToken: string): Promise<TokenResponse> => {
    return request<TokenResponse>('/api/v1/auth/google', {
      method: 'POST',
      body: JSON.stringify({ id_token: idToken }),
    });
  },

  getMe: async (): Promise<UserReadResponse> => {
    return request<UserReadResponse>('/api/v1/auth/me');
  },
};

// ==============================================================================
// Digital Twin API
// ==============================================================================

export const apiTwin = {
  getSiteTwin: async (siteId: number = 1): Promise<SiteRead> => {
    const live = await request<{
      site: {
        id: number;
        name: string;
        timezone: string;
        jurisdiction: string;
        currency: string;
        config_version: number;
        total_assets: number;
      };
      aggregate: {
        total_solar_kw: number;
        total_wind_kw: number;
        total_generation_kw: number;
        total_building_demand_kw: number;
        total_battery_charge_kw: number;
        total_battery_discharge_kw: number;
        net_battery_kw: number;
        grid_import_kw: number;
        grid_export_kw: number;
        net_grid_flow_kw: number;
        average_battery_soc_percent: number | null;
        overall_quality: string;
      };
      assets: Array<{
        asset_id: string;
        name: string;
        asset_type: string;
        site_id: number;
        rated_capacity_kw: number | null;
        operational_status: string;
        telemetry_quality: string;
        active_power_kw: number | null;
        energy_kwh: number | null;
        soc_percent: number | null;
        health_percent: number | null;
        temperature_celsius: number | null;
        wind_speed_ms: number | null;
        voltage_v: number | null;
        frequency_hz: number | null;
        observed_at: string | null;
        received_at: string;
      }>;
    }>(`/api/v1/twin/live?site_id=${siteId}`);

    return {
      id: live.site.id,
      name: live.site.name,
      timezone: live.site.timezone,
      jurisdiction: live.site.jurisdiction,
      currency: live.site.currency,
      config_version: live.site.config_version,
      total_assets: live.site.total_assets,
      assets: (live.assets || []).map((a) => {
        const isBldg = a.asset_type === 'building';
        return {
          id: a.asset_id,
          name: a.name,
          asset_type: a.asset_type as any,
          site_id: a.site_id,
          rated_capacity_kw: a.rated_capacity_kw || 0,
          is_active: a.operational_status === 'online',
          building_config: isBldg
            ? {
                id: 1,
                asset_id: a.asset_id,
                building_name: a.name,
                criticality_tier: a.asset_id.includes('admin')
                  ? 'critical'
                  : a.asset_id.includes('eng')
                  ? 'essential'
                  : 'non_critical',
                peak_load_kw: a.rated_capacity_kw || 100,
                flexible_load_policy: a.asset_id.includes('hostel') ? 'shiftable' : 'protected',
                updated_at: new Date().toISOString(),
              }
            : null,
          battery_config:
            a.asset_type === 'battery'
              ? {
                  id: 1,
                  asset_id: a.asset_id,
                  min_soc: 15.0,
                  max_soc: 95.0,
                  reserve_floor: 20.0,
                  max_charge_power_kw: 125.0,
                  max_discharge_power_kw: 125.0,
                  round_trip_efficiency: 0.92,
                  health_floor: 75.0,
                  updated_at: new Date().toISOString(),
                }
              : null,
          state: {
            asset_id: a.asset_id,
            operational_status: a.operational_status,
            active_power_kw: a.active_power_kw ?? 0,
            soc_percent: a.soc_percent,
            health_percent: a.health_percent,
            temperature_celsius: a.temperature_celsius,
            wind_speed_ms: a.wind_speed_ms,
            voltage_v: a.voltage_v,
            frequency_hz: a.frequency_hz,
            telemetry_quality: a.telemetry_quality as any,
            observed_at: a.observed_at || new Date().toISOString(),
            received_at: a.received_at,
          },
        };
      }),
      aggregates: {
        total_solar_generation_kw: live.aggregate.total_solar_kw,
        total_wind_generation_kw: live.aggregate.total_wind_kw,
        total_renewable_generation_kw: live.aggregate.total_generation_kw,
        total_campus_demand_kw: live.aggregate.total_building_demand_kw,
        total_battery_power_kw: live.aggregate.net_battery_kw,
        net_grid_exchange_kw: live.aggregate.net_grid_flow_kw,
        average_battery_soc_percent: live.aggregate.average_battery_soc_percent ?? 50,
        data_freshness_status: live.aggregate.overall_quality,
      },
    };
  },

  getAssetTelemetry: async (
    assetId: string,
    metricName?: string,
    fromDt?: string,
    toDt?: string,
    limit: number = 100
  ): Promise<TelemetryPoint[]> => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (metricName) params.append('metric_name', metricName);
    if (fromDt) params.append('from_dt', fromDt);
    if (toDt) params.append('to_dt', toDt);
    return request<TelemetryPoint[]>(`/api/v1/twin/assets/${assetId}/telemetry?${params.toString()}`);
  },

  ingestTelemetry: async (
    payload: Record<string, unknown>
  ): Promise<{ status: string; accepted_points: number }> => {
    return request<{ status: string; accepted_points: number }>('/api/v1/twin/telemetry/ingest', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};

// ==============================================================================
// Decisions & Optimization API
// ==============================================================================

export const apiDecisions = {
  listDecisions: async (params: {
    siteId?: number;
    limit?: number;
    offset?: number;
    decisionType?: string;
    fromDt?: string;
    toDt?: string;
  } = {}): Promise<DecisionLog[]> => {
    const query = new URLSearchParams({
      site_id: String(params.siteId ?? 1),
      limit: String(params.limit ?? 50),
      offset: String(params.offset ?? 0),
    });
    if (params.decisionType) query.append('decision_type', params.decisionType);
    if (params.fromDt) query.append('from_dt', params.fromDt);
    if (params.toDt) query.append('to_dt', params.toDt);
    return request<DecisionLog[]>(`/api/v1/decisions?${query.toString()}`);
  },

  getLatestCycle: async (siteId: number = 1): Promise<DecisionCycle> => {
    return request<DecisionCycle>(`/api/v1/decisions/latest?site_id=${siteId}`);
  },

  getDecisionStats: async (params: {
    siteId?: number;
    fromDt?: string;
    toDt?: string;
  } = {}): Promise<DecisionStats> => {
    const query = new URLSearchParams({ site_id: String(params.siteId ?? 1) });
    if (params.fromDt) query.append('from_dt', params.fromDt);
    if (params.toDt) query.append('to_dt', params.toDt);
    return request<DecisionStats>(`/api/v1/decisions/stats?${query.toString()}`);
  },

  getDecision: async (decisionId: string): Promise<DecisionLog> => {
    return request<DecisionLog>(`/api/v1/decisions/${decisionId}`);
  },
};

// ==============================================================================
// System Settings API
// ==============================================================================

export const apiSettings = {
  getAlertThresholds: async (): Promise<AlertThreshold[]> => {
    return request<AlertThreshold[]>('/api/v1/settings/alert-thresholds');
  },

  getAlertThreshold: async (thresholdId: number): Promise<AlertThreshold> => {
    return request<AlertThreshold>(`/api/v1/settings/alert-thresholds/${thresholdId}`);
  },

  updateAlertThreshold: async (thresholdId: number, data: Partial<AlertThreshold>): Promise<AlertThreshold> => {
    return request<AlertThreshold>(`/api/v1/settings/alert-thresholds/${thresholdId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  getBuildingTiers: async (): Promise<BuildingConfig[]> => {
    return request<BuildingConfig[]>('/api/v1/settings/building-tiers');
  },

  getBuildingTier: async (buildingId: string): Promise<BuildingConfig> => {
    return request<BuildingConfig>(`/api/v1/settings/building-tiers/${buildingId}`);
  },

  updateBuildingTier: async (buildingId: string, data: Partial<BuildingConfig>): Promise<BuildingConfig> => {
    return request<BuildingConfig>(`/api/v1/settings/building-tiers/${buildingId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  getVnmRules: async (): Promise<VNMSharingRule[]> => {
    return request<VNMSharingRule[]>('/api/v1/settings/vnm-sharing-rules');
  },

  createVnmRule: async (data: { building_asset_id: string; sharing_ratio: number; jurisdiction?: string }): Promise<VNMSharingRule> => {
    return request<VNMSharingRule>('/api/v1/settings/vnm-sharing-rules', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateVnmRule: async (ruleId: number, data: Partial<VNMSharingRule>): Promise<VNMSharingRule> => {
    return request<VNMSharingRule>(`/api/v1/settings/vnm-sharing-rules/${ruleId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  getBatteryConfigs: async (): Promise<BatteryConfig[]> => {
    return request<BatteryConfig[]>('/api/v1/settings/assets');
  },

  getBatteryConfig: async (assetId: string): Promise<BatteryConfig> => {
    return request<BatteryConfig>(`/api/v1/settings/assets/${assetId}`);
  },

  updateBatteryConfig: async (assetId: string, data: Partial<BatteryConfig>): Promise<BatteryConfig> => {
    return request<BatteryConfig>(`/api/v1/settings/assets/${assetId}/battery`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  getControlPolicy: async (): Promise<ControlPolicy> => {
    return request<ControlPolicy>('/api/v1/settings/control-policy');
  },

  updateControlPolicy: async (data: Partial<ControlPolicy>): Promise<ControlPolicy> => {
    return request<ControlPolicy>('/api/v1/settings/control-policy', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
};

// ==============================================================================
// Control & Execution API
// ==============================================================================

export const apiControl = {
  forceCycle: async (siteId: number = 1): Promise<{
    cycle_id: string;
    site_id: number;
    status: string;
    duration_ms?: number;
    decisions_count: number;
    commands_count: number;
  }> => {
    return request('/api/v1/control/force-cycle', {
      method: 'POST',
      body: JSON.stringify({ site_id: siteId }),
    });
  },

  acknowledgeCommand: async (
    commandId: string,
    data: { status: string; adapter_response?: Record<string, unknown>; reason?: string }
  ): Promise<ControlCommand> => {
    return request<ControlCommand>(`/api/v1/control/commands/${commandId}/acknowledge`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  setEmergencyStop: async (active: boolean, reason: string): Promise<{
    emergency_stop_active: boolean;
    message: string;
    timestamp: string;
  }> => {
    return request('/api/v1/control/emergency-stop', {
      method: 'POST',
      body: JSON.stringify({ active, reason }),
    });
  },
};

// ==============================================================================
// Reporting & Export API
// ==============================================================================

export const apiExport = {
  getExportStats: async (params: { siteId?: number; fromDt?: string; toDt?: string } = {}): Promise<ExportStats> => {
    const query = new URLSearchParams({ site_id: String(params.siteId ?? 1) });
    if (params.fromDt) query.append('from_dt', params.fromDt);
    if (params.toDt) query.append('to_dt', params.toDt);
    return request<ExportStats>(`/api/v1/export/stats?${query.toString()}`);
  },

  getCsvDownloadUrl: (siteId: number = 1, fromDt?: string, toDt?: string): string => {
    const token = getStoredToken();
    const query = new URLSearchParams({ site_id: String(siteId) });
    if (fromDt) query.append('from_dt', fromDt);
    if (toDt) query.append('to_dt', toDt);
    if (token) query.append('token', token);
    return `${API_BASE_URL}/api/v1/export/csv?${query.toString()}`;
  },

  getPdfDownloadUrl: (siteId: number = 1, fromDt?: string, toDt?: string): string => {
    const token = getStoredToken();
    const query = new URLSearchParams({ site_id: String(siteId) });
    if (fromDt) query.append('from_dt', fromDt);
    if (toDt) query.append('to_dt', toDt);
    if (token) query.append('token', token);
    return `${API_BASE_URL}/api/v1/export/pdf?${query.toString()}`;
  },
};

// ==============================================================================
// Health Diagnostics API
// ==============================================================================

export const apiHealth = {
  getLiveness: async (): Promise<{ status: string; service: string; timestamp: string }> => {
    return request('/health');
  },

  getReadiness: async (): Promise<HealthStatus> => {
    return request('/health/ready');
  },

  getSchedulerHealth: async (): Promise<HealthStatus> => {
    return request('/health/scheduler');
  },
};

// ==============================================================================
// ML Microgrid Sync & Prediction API
// ==============================================================================

export interface MLComparisonData {
  region_id: string;
  site_name: string;
  timestamp: string;
  comparison_matrix: {
    zero_baseline: {
      label: string;
      solar_kw: number;
      wind_kw: number;
      generation_kw: number;
      demand_kw: number;
      battery_kw: number;
      grid_kw: number;
      carbon_offset_kg_hr: number;
      self_sufficiency_pct: number;
    };
    physics_baseline: {
      label: string;
      solar_kw: number;
      wind_kw: number;
      generation_kw: number;
    };
    ml_prediction: {
      label: string;
      solar_kw: number;
      wind_kw: number;
      generation_kw: number;
      demand_kw: number;
      battery_kw: number;
      grid_kw: number;
      carbon_offset_kg_hr: number;
      self_sufficiency_pct: number;
    };
  };
  assets: Array<{
    asset_id: string;
    name: string;
    asset_type: string;
    rated_capacity_kw: number;
    zero_state_kw: number;
    current_live_kw: number;
    ml_predicted_kw: number;
    delta_from_zero_kw: number;
  }>;
  weather_inputs: Record<string, number>;
  model_metadata: {
    algorithms: string[];
    quantiles: string[];
    features_count: number;
    regional_grid_factor: number;
  };
}

export interface MLFluctuationData {
  status: string;
  mode: string;
  fluctuation: {
    step: number;
    solar_kw: number;
    solar_delta_kw: number;
    wind_kw: number;
    wind_delta_kw: number;
    generation_kw: number;
    generation_delta_kw: number;
    demand_kw: number;
    demand_delta_kw: number;
    battery_kw: number;
    grid_kw: number;
    voltage_v: number;
    frequency_hz: number;
    event_description: string;
    p10_solar?: number;
    p50_solar?: number;
    p90_solar?: number;
    p10_wind?: number;
    p50_wind?: number;
    p90_wind?: number;
    p10_demand?: number;
    p50_demand?: number;
    p90_demand?: number;
    weather?: {
      temp_c: number;
      ghi_wm2: number;
      wind_speed_mps: number;
      cloud_pct: number;
      source: string;
      location?: string;
      is_live?: boolean;
    };
    physics_baseline?: {
      solar_kw: number;
      wind_kw: number;
      total_kw: number;
    };
  };
  aggregates: {
    total_solar_generation_kw: number;
    total_wind_generation_kw: number;
    total_renewable_generation_kw: number;
    total_campus_demand_kw: number;
    total_battery_power_kw: number;
    net_grid_exchange_kw: number;
    average_battery_soc_percent: number;
    data_freshness_status: string;
  };
  timestamp: string;
}

export const apiML = {
  resetToZero: async (siteId: number = 1): Promise<any> => {
    return request(`/api/v1/twin/reset-to-zero?site_id=${siteId}`, {
      method: 'POST',
    });
  },

  applyPrediction: async (options?: {
    siteId?: number;
    regionId?: string;
    simulateDaylightPeak?: boolean;
    weather?: {
      ghi_wm2?: number;
      wind_speed_mps?: number;
      temp_c?: number;
      cloud_pct?: number;
    };
  }): Promise<any> => {
    const siteId = options?.siteId ?? 1;
    const regionId = options?.regionId ?? 'central_india_mp_indore';
    const simulateDaylightPeak = options?.simulateDaylightPeak ?? false;

    return request(
      `/api/v1/twin/apply-ml-prediction?site_id=${siteId}&region_id=${encodeURIComponent(
        regionId
      )}&simulate_daylight_peak=${simulateDaylightPeak}`,
      {
        method: 'POST',
        body: options?.weather ? JSON.stringify(options.weather) : undefined,
      }
    );
  },

  getComparison: async (siteId: number = 1, regionId: string = 'central_india_mp_indore'): Promise<MLComparisonData> => {
    return request(`/api/v1/twin/ml-comparison?site_id=${siteId}&region_id=${encodeURIComponent(regionId)}`);
  },

  stepFluctuation: async (siteId: number = 1, regionId: string = 'central_india_mp_indore'): Promise<MLFluctuationData> => {
    return request<MLFluctuationData>(
      `/api/v1/twin/fluctuate-step?site_id=${siteId}&region_id=${encodeURIComponent(regionId)}`,
      { method: 'POST' }
    );
  },

  startFluctuationStream: async (siteId: number = 1, intervalSeconds: number = 2.5, regionId: string = 'central_india_mp_indore'): Promise<any> => {
    return request(
      `/api/v1/twin/fluctuate-stream/start?site_id=${siteId}&interval_seconds=${intervalSeconds}&region_id=${encodeURIComponent(regionId)}`,
      { method: 'POST' }
    );
  },

  stopFluctuationStream: async (): Promise<any> => {
    return request('/api/v1/twin/fluctuate-stream/stop', { method: 'POST' });
  },

  getFluctuationStatus: async (): Promise<{
    is_streaming: boolean;
    step_count: number;
    last_state: Record<string, number>;
    last_event_description: string;
  }> => {
    return request('/api/v1/twin/fluctuate-stream/status');
  },

  getLiveWeather: async (regionId: string = 'central_india_mp_indore'): Promise<{
    region_id: string;
    weather: {
      temp_c: number;
      relative_humidity_2m: number;
      ghi_wm2: number;
      dni_wm2: number;
      dhi_wm2: number;
      wind_speed_mps: number;
      wind_direction_10m: number;
      cloud_pct: number;
      source: string;
      fetched_at: string;
      is_live_api: boolean;
    };
    physics_baseline: {
      solar_physics_kw: number;
      wind_physics_kw: number;
      total_generation_kw: number;
    };
    streaming_status: {
      is_streaming: boolean;
      step_count: number;
    };
  }> => {
    return request(`/api/v1/forecast/weather-live?region_id=${encodeURIComponent(regionId)}`);
  },
};

