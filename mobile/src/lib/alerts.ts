import type { AlertItem, AppSettings, Snapshot } from './types';

/*
 * On-device alert engine. The SURYA backend streams telemetry and optimizer cycles but
 * does not raise alerts itself, so the app evaluates rules against every snapshot.
 * Each rule has a stable key; an alert opens when its condition starts and resolves
 * when it clears, so a persisting condition notifies once, not on every refresh.
 */

export type Condition = Omit<AlertItem, 'raisedAt' | 'resolvedAt' | 'acknowledgedAt'>;

const fmt = (value: number, digits = 0) => value.toLocaleString('en-IN', { maximumFractionDigits: digits });

export function evaluate(snapshot: Snapshot, settings: AppSettings): Condition[] {
  const conditions: Condition[] = [];
  const { aggregate, assets } = snapshot.twin;

  const soc = aggregate.average_battery_soc_percent;
  if (soc !== null && soc < settings.batteryCriticalSoc) {
    conditions.push({
      key: 'battery-soc',
      severity: 'critical',
      category: 'battery',
      title: 'Battery critically low',
      body: `Fleet state of charge is ${fmt(soc, 1)}%, below the ${settings.batteryCriticalSoc}% critical floor. Discharge is being limited to protect the reserve.`,
    });
  } else if (soc !== null && soc < settings.batteryLowSoc) {
    conditions.push({
      key: 'battery-soc',
      severity: 'warning',
      category: 'battery',
      title: 'Battery running low',
      body: `Fleet state of charge is ${fmt(soc, 1)}% (warning below ${settings.batteryLowSoc}%).`,
    });
  }

  if (aggregate.grid_import_kw > settings.gridImportKw) {
    conditions.push({
      key: 'grid-import',
      severity: 'warning',
      category: 'grid',
      title: 'High grid import',
      body: `Importing ${fmt(aggregate.grid_import_kw)} kW from the MPPKVVCL feeder, above the ${fmt(settings.gridImportKw)} kW limit.`,
    });
  }

  if (aggregate.data_freshness_age_seconds > settings.staleSeconds) {
    const minutes = Math.round(aggregate.data_freshness_age_seconds / 60);
    conditions.push({
      key: 'telemetry-stale',
      severity: 'warning',
      category: 'telemetry',
      title: 'Telemetry is stale',
      body: `No fresh readings for ${minutes >= 1 ? `${minutes} min` : `${Math.round(aggregate.data_freshness_age_seconds)} s`}. Live values may be out of date.`,
    });
  }

  for (const asset of assets) {
    const status = asset.operational_status?.toLowerCase();
    if (status === 'offline' || status === 'fault' || status === 'tripped') {
      conditions.push({
        key: `asset-${asset.asset_id}`,
        severity: 'critical',
        category: 'asset',
        title: `${asset.name} is ${status}`,
        body: `${asset.name} (${asset.asset_id}) stopped reporting as online.`,
      });
    } else if (status === 'degraded' || asset.telemetry_quality === 'bad') {
      conditions.push({
        key: `asset-${asset.asset_id}`,
        severity: 'warning',
        category: 'asset',
        title: `${asset.name} degraded`,
        body: `Status ${status}, telemetry quality ${asset.telemetry_quality}.`,
      });
    }
    if (asset.asset_type === 'battery' && (asset.temperature_celsius ?? 0) > settings.batteryTempC) {
      conditions.push({
        key: `temp-${asset.asset_id}`,
        severity: 'critical',
        category: 'battery',
        title: 'Battery over temperature',
        body: `${asset.name} is at ${fmt(asset.temperature_celsius ?? 0, 1)} °C (limit ${settings.batteryTempC} °C).`,
      });
    }
  }

  const cycleStatus = snapshot.cycle?.status?.toLowerCase();
  if (cycleStatus === 'failed') {
    conditions.push({
      key: 'optimizer-cycle',
      severity: 'critical',
      category: 'optimizer',
      title: 'Optimizer cycle failed',
      body: snapshot.cycle?.reason || 'The last decision cycle failed. Dispatch is holding its previous setpoints.',
    });
  } else if (cycleStatus === 'degraded') {
    const unhealthy = Object.entries(snapshot.cycle?.health_summary ?? {})
      .filter(([, value]) => value !== 'healthy')
      .map(([name]) => name.replace(/_/g, ' '));
    conditions.push({
      key: 'optimizer-cycle',
      severity: 'warning',
      category: 'optimizer',
      title: 'Optimizer running degraded',
      body: `Decision cycles complete with degraded inputs${unhealthy.length ? ` (${unhealthy.join(', ')})` : ''}.`,
    });
  }

  if (snapshot.policy?.emergency_stop_active) {
    conditions.push({
      key: 'emergency-stop',
      severity: 'critical',
      category: 'safety',
      title: 'Emergency stop engaged',
      body: 'Automated dispatch is frozen until an administrator releases the emergency stop.',
    });
  }

  return conditions;
}

export interface MergeResult {
  alerts: AlertItem[];
  opened: AlertItem[];
  resolved: AlertItem[];
}

const HISTORY_LIMIT = 150;

/** Opens new alerts, refreshes ongoing ones and resolves those whose condition cleared. */
export function merge(previous: AlertItem[], conditions: Condition[], now = Date.now()): MergeResult {
  const activeByKey = new Map(previous.filter((alert) => alert.resolvedAt === null).map((alert) => [alert.key, alert]));
  const seen = new Set<string>();
  const opened: AlertItem[] = [];
  const resolved: AlertItem[] = [];
  let alerts = previous.slice();

  for (const condition of conditions) {
    seen.add(condition.key);
    const current = activeByKey.get(condition.key);
    if (!current) {
      const item: AlertItem = { ...condition, raisedAt: now, resolvedAt: null, acknowledgedAt: null };
      opened.push(item);
      alerts.unshift(item);
    } else if (current.severity !== condition.severity) {
      // Escalation or de-escalation reopens the alert so a critical change still notifies.
      const updated: AlertItem = { ...current, resolvedAt: now };
      const item: AlertItem = { ...condition, raisedAt: now, resolvedAt: null, acknowledgedAt: null };
      alerts = [item, ...alerts.map((alert) => (alert === current ? updated : alert))];
      opened.push(item);
    } else {
      alerts = alerts.map((alert) => (alert === current ? { ...alert, ...condition } : alert));
    }
  }

  alerts = alerts.map((alert) => {
    if (alert.resolvedAt === null && !seen.has(alert.key)) {
      const done = { ...alert, resolvedAt: now };
      resolved.push(done);
      return done;
    }
    return alert;
  });

  return { alerts: alerts.slice(0, HISTORY_LIMIT), opened, resolved };
}

/** Raised while the server is unreachable; other alerts stay as they were. */
export function openConnectionAlert(previous: AlertItem[], message: string, now = Date.now()): MergeResult {
  if (previous.some((alert) => alert.key === 'connection' && alert.resolvedAt === null)) {
    return { alerts: previous, opened: [], resolved: [] };
  }
  const item: AlertItem = { ...connectionAlert(message), raisedAt: now, resolvedAt: null, acknowledgedAt: null };
  return { alerts: [item, ...previous].slice(0, HISTORY_LIMIT), opened: [item], resolved: [] };
}

const connectionAlert = (message: string): Condition => ({
  key: 'connection',
  severity: 'warning',
  category: 'connection',
  title: 'Lost connection to SURYA',
  body: message,
});
