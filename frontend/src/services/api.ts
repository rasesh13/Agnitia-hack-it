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
    return request<SiteRead>(`/api/v1/twin/site?site_id=${siteId}`);
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
