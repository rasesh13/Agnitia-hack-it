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
} from 'lucide-react';

const INITIAL_DEMO_ALERTS: SystemAlert[] = [
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
  const [severityFilter, setSeverityFilter] = useState<'all' | AlertSeverity>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAcknowledging, setIsAcknowledging] = useState<Record<string, boolean>>({});

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

  const filteredAlerts = alerts.filter((a) => {
    if (activeTab === 'active' && a.is_acknowledged) return false;
    if (activeTab === 'acknowledged' && !a.is_acknowledged) return false;
    if (severityFilter !== 'all' && a.severity !== severityFilter) return false;
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
          <h1 className="text-2xl font-bold tracking-tight text-white">System Alerts & Fault Engine</h1>
          <p className="mt-1 text-xs text-slate-400">
            Real-time threshold breach notifications, telemetry staleness alarms, and audit acknowledgements
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
          title="Acknowledged"
          value={acknowledgedAlerts.length}
          subtitle="Resolved / Dismissed Today"
          icon={CheckCircle2}
          iconColor="text-emerald-400"
          iconBg="bg-emerald-500/10 border-emerald-500/20"
        />

        <MetricCard
          title="Total Alarms Tracked"
          value={alerts.length}
          subtitle="Historical & In-Flight"
          icon={Bell}
          iconColor="text-purple-400"
          iconBg="bg-purple-500/10 border-purple-500/20"
        />
      </div>

      {/* Filters & Actions Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Status Tabs */}
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
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Active ({activeAlerts.length})
          </button>
          <button
            onClick={() => setActiveTab('acknowledged')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              activeTab === 'acknowledged'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Acknowledged ({acknowledgedAlerts.length})
          </button>
        </div>

        {/* Severity Selector & Search */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Filter className="h-3.5 w-3.5" />
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value as 'all' | AlertSeverity)}
              className="rounded-xl border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-xs font-medium text-slate-200 focus:border-emerald-500 focus:outline-none"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical Only</option>
              <option value="warning">Warning Only</option>
              <option value="info">Info Only</option>
            </select>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search alerts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-48 rounded-xl border border-slate-700 bg-slate-950/60 pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Alerts List */}
      <div className="space-y-3">
        {filteredAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-slate-800 bg-slate-900/40 py-12 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-500/60" />
            <h3 className="mt-3 text-base font-bold text-white">All Clear — No Matching Alerts</h3>
            <p className="mt-1 text-xs text-slate-400 max-w-sm">
              All monitored telemetry thresholds, data freshness heartbeat guards, and grid constraints are within nominal limits.
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
