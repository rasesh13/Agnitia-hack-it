import { demoBackend } from './demo';
import type { ControlPolicy, CycleSummary, Decision, DecisionStats, LiveTwin, Session, Snapshot, User } from './types';

const SITE_ID = 1;
// Long enough for a sleeping Render free instance to wake up (~50 s).
const TIMEOUT_MS = 60000;

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export const normaliseServerUrl = (raw: string) => {
  let url = raw.trim().replace(/\/+$/, '');
  if (url && !/^https?:\/\//i.test(url)) url = `http://${url}`;
  return url;
};

const messageFrom = (body: unknown, fallback: string) => {
  const detail = (body as { detail?: unknown })?.detail;
  if (typeof detail === 'string') return detail;
  if (detail && typeof detail === 'object' && 'message' in detail) return String((detail as { message: string }).message);
  if (Array.isArray(detail) && detail[0]?.msg) return String(detail[0].msg);
  return fallback;
};

async function request<T>(serverUrl: string, path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${serverUrl}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
      },
    });
    const text = await response.text();
    const body = text ? JSON.parse(text) : null;
    if (!response.ok) throw new ApiError(messageFrom(body, `Request failed (${response.status})`), response.status);
    return body as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if ((error as Error).name === 'AbortError') throw new ApiError('The server took too long to respond.', 0);
    throw new ApiError('Cannot reach the SURYA server. Check the address and your internet connection.', 0);
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  async health(serverUrl: string) {
    return request<{ status: string; service?: string }>(serverUrl, '/health');
  },

  async login(serverUrl: string, email: string, password: string) {
    return request<{ access_token: string; user: User }>(serverUrl, '/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  /** One refresh: live twin plus optimizer and policy context (the extras are best-effort). */
  async snapshot(session: Session): Promise<Snapshot> {
    if (session.demo) return demoBackend.snapshot();
    const opts = { token: session.token };
    const twin = await request<LiveTwin>(session.serverUrl, `/api/v1/twin/live?site_id=${SITE_ID}`, opts);
    const [cycle, stats, policy] = await Promise.all([
      request<CycleSummary>(session.serverUrl, `/api/v1/decisions/latest?site_id=${SITE_ID}`, opts).catch(() => null),
      request<DecisionStats>(session.serverUrl, `/api/v1/decisions/stats?site_id=${SITE_ID}`, opts).catch(() => null),
      request<ControlPolicy>(session.serverUrl, `/api/v1/settings/control-policy?site_id=${SITE_ID}`, opts).catch(() => null),
    ]);
    return { twin, cycle, stats, policy, fetchedAt: Date.now() };
  },

  async decisions(session: Session, limit = 30) {
    if (session.demo) return demoBackend.decisions(limit);
    return request<Decision[]>(session.serverUrl, `/api/v1/decisions?site_id=${SITE_ID}&limit=${limit}`, { token: session.token });
  },

  async forceCycle(session: Session) {
    if (session.demo) return demoBackend.forceCycle();
    return request<{ cycle_id: string; status: string; decisions_count: number; duration_ms: number | null }>(
      session.serverUrl,
      '/api/v1/control/force-cycle',
      { method: 'POST', token: session.token, body: JSON.stringify({ site_id: SITE_ID }) },
    );
  },

  async emergencyStop(session: Session, active: boolean, reason: string) {
    if (session.demo) return demoBackend.emergencyStop(active);
    return request<{ emergency_stop_active: boolean; message?: string }>(session.serverUrl, '/api/v1/control/emergency-stop', {
      method: 'POST',
      token: session.token,
      body: JSON.stringify({ active, reason }),
    });
  },
};
