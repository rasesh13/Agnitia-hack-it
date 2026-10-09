import React, { useState, useEffect, useCallback } from 'react';
import { SystemAlert, AlertSeverity } from '../types';
import { AlertItem } from '../components/AlertItem';
import { MetricCard } from '../components/MetricCard';
import { useWebSocket } from '../context/WebSocketContext';
import {
  Bell,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Filter,
  Search,
  Radio,
  Sun,
} from 'lucide-react';

const INITIAL_DEMO_ALERTS: SystemAlert[] = [
  {
    id: 'alt-forecast-01',
    severity: 'warning',
    title: 'High Solar Generation Window — Curtailment Risk',
    description: 'LightGBM 24h forecast predicts solar generation reaching 188.0 kW (exceeding daytime campus base load of 145 kW). Curtailment risk without active BESS storage.',
    source: 'Agnitia ML Forecast Engine',
    metric_name: 'forecast_solar_peak_kw',
    current_value: 188.0,
    threshold_value: 160.0,
    created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    is_acknowledged: false,
  },
  {
    id: 'alt-forecast-02',
    severity: 'warning',
    title: 'Rapid Wind Ramp-Down Alert',
    description: 'Multi-horizon aerodynamic forecast detects >30% hourly drop from 43.6 kW to 9.5 kW at T+6h. Storage buffer discharge required to prevent deficit.',
    source: 'Agnitia ML Forecast Engine',
    metric_name: 'forecast_wind_ramp_rate',
    current_value: -34.2,
    threshold_value: -30.0,
    created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    is_acknowledged: false,
  },
  {
    id: 'alt-001',
    severity: 'warning',
    title: 'High Peak Demand Approaching Contract Demand Limit',
    description: 'Campus active demand at 178.4 kW is within 85% of utility sanctioned contract capacity (200 kW).',
    source: 'Peak Shaving Engine',
    metric_name: 'total_campus_demand_kw',
    current_value: 178.4,
    threshold_value: 170.0,
    created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    is_acknowledged: false,
  },
  {
    id: 'alt-002',
    severity: 'critical',
    title: 'BESS State of Charge Below Emergency Reserve Floor',
    description: 'Battery SoC has reached 18.2%, below the minimum configured reserve floor (20.0%). Automatic discharge locked.',
    source: 'BESS Protection Controller',
    metric_name: 'bess_01.soc_percent',
    current_value: 18.2,
    threshold_value: 20.0,
    created_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    is_acknowledged: false,
  },
  {
    id: 'alt-003',
    severity: 'info',
    title: 'Virtual Net Metering Allocation Optimization Completed',
    description: 'Hourly VNM ratio redistributed 142.5 kWh surplus solar generation to Academic Block A and Library.',
    source: 'VNM Dispatcher',
    created_at: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
    is_acknowledged: true,
    acknowledged_at: new Date(Date.now() - 80 * 60 * 1000).toISOString(),
    acknowledged_by: 'system_auto',
  },
];

export const Alerts: React.FC = () => {
  const { activeAlerts: wsAlerts } = useWebSocket();
  const [alerts, setAlerts] = useState<SystemAlert[]>(INITIAL_DEMO_ALERTS);
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'acknowledged'>('all');
  const [sourceCategory, setSourceCategory] = useState<'all' | 'forecast' | 'hardware'>('all');
  const [severityFilter, setSeverityFilter] = useState<'all' | AlertSeverity>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAcknowledging, setIsAcknowledging] = useState<Record<string, boolean>>({});

  // Fetch forecast alerts from the live backend
  useEffect(() => {
    fetch('/api/v1/forecast/48h?region_id=central_india_mp_indore')
      .then((r) => r.json())
      .then((data) => {
        if (data?.alerts && data.alerts.length > 0) {
          setAlerts((prev) => {
            const updated = [...prev];
            for (const fAlert of data.alerts) {
              const existingIdx = updated.findIndex((a) => a.id === fAlert.id);
              const mappedAlert: SystemAlert = {
                id: fAlert.id,
                severity: fAlert.severity as AlertSeverity,
                title: fAlert.title,
                description: `${fAlert.message} Recommended Action: ${fAlert.recommended_action}`,
                source: 'Agnitia ML Forecast Engine',
                metric_name: fAlert.target === 'solar' ? 'forecast_solar_kw' : 'forecast_wind_kw',
                current_value: 185.0,
                created_at: fAlert.timestamp || new Date().toISOString(),
                is_acknowledged: false,
              };
              if (existingIdx === -1) {
                updated.unshift(mappedAlert);
              }
            }
            return updated;
          });
        }
      })
      .catch(() => {
        // Fallback to initial alerts
      });
  }, []);

  // Append any real-time alerts received over WebSocket
  useEffect(() => {
    if (wsAlerts && wsAlerts.length > 0) {
      setAlerts((prev) => {
        const updated = [...prev];
        for (const wsAlert of wsAlerts) {
          if (!updated.some((a) => a.id === wsAlert.id)) {
            updated.unshift({
              id: wsAlert.id,
              severity: wsAlert.severity,
              title: wsAlert.message,
              description: `Live threshold alert for ${wsAlert.metric_name || 'monitored metric'}.`,
              source: 'Live WebSocket Stream',
              metric_name: wsAlert.metric_name,
              created_at: wsAlert.timestamp,
              is_acknowledged: false,
            });
          }
        }
        return updated;
      });
    }
  }, [wsAlerts]);

  const handleAcknowledge = useCallback((alertId: string) => {
    setIsAcknowledging((prev) => ({ ...prev, [alertId]: true }));
    setTimeout(() => {
      setAlerts((prev) =>
        prev.map((a) =>
          a.id === alertId
            ? {
                ...a,
                is_acknowledged: true,
                acknowledged_at: new Date().toISOString(),
                acknowledged_by: 'operator@surya.local',
              }
            : a
        )
      );
      setIsAcknowledging((prev) => ({ ...prev, [alertId]: false }));
    }, 400);
  }, []);

  const activeAlerts = alerts.filter((a) => !a.is_acknowledged);
  const acknowledgedAlerts = alerts.filter((a) => a.is_acknowledged);
  const criticalCount = activeAlerts.filter((a) => a.severity === 'critical').length;
  const warningCount = activeAlerts.filter((a) => a.severity === 'warning').length;
  const forecastCount = activeAlerts.filter((a) => a.source.includes('Forecast')).length;

  const filteredAlerts = alerts.filter((a) => {
    if (activeTab === 'active' && a.is_acknowledged) return false;
    if (activeTab === 'acknowledged' && !a.is_acknowledged) return false;
    if (severityFilter !== 'all' && a.severity !== severityFilter) return false;
    if (sourceCategory === 'forecast' && !a.source.includes('Forecast')) return false;
    if (sourceCategory === 'hardware' && a.source.includes('Forecast')) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        a.title.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.source.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-rose-500/10 px-2.5 py-0.5 text-xs font-semibold text-rose-400 border border-rose-500/20">
              Operations Center
            </span>
            <span className="text-xs text-slate-400 font-mono">Live Faults & 48h Generation Alerts</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white">System Alerts & Fault Engine</h1>
          <p className="mt-1 text-xs text-slate-400">
            Real-time threshold breaches, telemetry staleness alarms, and 48-hour forward-looking high surplus / low generation warnings.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400">
            <Radio className="h-3.5 w-3.5 animate-pulse" />
            <span>Telemetry Guard Live</span>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Active Critical Alerts"
          value={criticalCount}
          subtitle="Immediate Operator Action Required"
          icon={AlertCircle}
          iconColor={criticalCount > 0 ? 'text-rose-400' : 'text-slate-400'}
          iconBg={criticalCount > 0 ? 'bg-rose-500/10 border-rose-500/20' : 'bg-slate-800/80 border-slate-700'}
        />

        <MetricCard
          title="Active Warnings"
          value={warningCount}
          subtitle="Monitored Threshold Breaches"
          icon={AlertTriangle}
          iconColor={warningCount > 0 ? 'text-amber-400' : 'text-slate-400'}
          iconBg={warningCount > 0 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-slate-800/80 border-slate-700'}
        />

        <MetricCard
          title="Generation Forecast Alerts"
          value={forecastCount}
          subtitle="Surplus & Ramp-Down Risks"
          icon={Sun}
          iconColor="text-sky-400"
          iconBg="bg-sky-500/10 border-sky-500/20"
        />

        <MetricCard
          title="Total Alarms Tracked"
          value={alerts.length}
          subtitle="Hardware & Forecast Events"
          icon={Bell}
          iconColor="text-purple-400"
          iconBg="bg-purple-500/10 border-purple-500/20"
        />
      </div>

      {/* Filters & Actions Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Status Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl bg-slate-950/60 p-1 border border-slate-800">
            <button
              onClick={() => setActiveTab('all')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                activeTab === 'all'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All ({alerts.length})
            </button>
            <button
              onClick={() => setActiveTab('active')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                activeTab === 'active'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Active ({activeAlerts.length})
            </button>
            <button
              onClick={() => setActiveTab('acknowledged')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                activeTab === 'acknowledged'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Acknowledged ({acknowledgedAlerts.length})
            </button>
          </div>

          {/* Source Category Filter */}
          <div className="flex items-center gap-1 rounded-xl bg-slate-950/60 p-1 border border-slate-800 text-xs">
            <button
              onClick={() => setSourceCategory('all')}
              className={`rounded-lg px-2.5 py-1 transition-all ${
                sourceCategory === 'all'
                  ? 'bg-slate-800 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All Types
            </button>
            <button
              onClick={() => setSourceCategory('forecast')}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1 transition-all ${
                sourceCategory === 'forecast'
                  ? 'bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sun className="h-3 w-3 text-amber-400" />
              <span>Generation Forecast Alerts ({forecastCount})</span>
            </button>
            <button
              onClick={() => setSourceCategory('hardware')}
              className={`rounded-lg px-2.5 py-1 transition-all ${
                sourceCategory === 'hardware'
                  ? 'bg-slate-800 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Hardware / Grid Alarms
            </button>
          </div>
        </div>

        {/* Severity & Search Filters */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search alarms, assets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-950/80 pl-9 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 sm:w-48"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-slate-500" />
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value as any)}
              className="rounded-xl border border-slate-800 bg-slate-950/80 px-2.5 py-1.5 text-xs text-slate-300 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical Only</option>
              <option value="warning">Warnings Only</option>
              <option value="info">Info Notices</option>
            </select>
          </div>
        </div>
      </div>

      {/* Alerts List */}
      <div className="space-y-3">
        {filteredAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/40 p-12 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-400 mb-3" />
            <div className="text-base font-bold text-white">No Matching Operational Alarms</div>
            <p className="mt-1 text-xs text-slate-400 max-w-sm">
              All microgrid assets, utility tie interconnections, and 48-hour generation forecast boundaries are within safe operational tolerances.
            </p>
          </div>
        ) : (
          filteredAlerts.map((alert) => (
            <AlertItem
              key={alert.id}
              alert={alert}
              onAcknowledge={handleAcknowledge}
              isAcknowledging={isAcknowledging[alert.id]}
            />
          ))
        )}
      </div>
    </div>
  );
};
