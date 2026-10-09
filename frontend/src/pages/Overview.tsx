import React, { useState, useEffect, useCallback } from 'react';
import { useLiveTwin } from '../hooks/useLiveTwin';
import { useWebSocket } from '../context/WebSocketContext';
import { useAuth } from '../context/AuthContext';
import { MetricCard } from '../components/MetricCard';
import { PowerFlowDiagram } from '../components/PowerFlowDiagram';
import { FreshnessIndicator } from '../components/FreshnessIndicator';
import { SeverityBadge } from '../components/StatusBadge';
import { MLTelemetryController } from '../components/MLTelemetryController';
import { apiControl, apiDecisions, apiML } from '../services/api';
import { DecisionCycle, DecisionStats } from '../types';
import {
  Sun,
  Zap,
  Battery,
  UtilityPole,
  RefreshCw,
  TrendingUp,
  Leaf,
  AlertCircle,
  CheckCircle2,
  Play,
  Clock,
  LineChart,
  Wind,
} from 'lucide-react';

export const Overview: React.FC = () => {
  const { isOperator } = useAuth();
  const { aggregates, isStale, stalenessSeconds, refresh, isLoading } = useLiveTwin(1);
  const { latestCycle: wsCycle, activeAlerts, dismissAlert, lastMessageAt, liveFluctuation } = useWebSocket();

  const [cycle, setCycle] = useState<DecisionCycle | null>(null);
  const [stats, setStats] = useState<DecisionStats | null>(null);
  const [isTriggeringCycle, setIsTriggeringCycle] = useState<boolean>(false);
  const [triggerMessage, setTriggerMessage] = useState<string | null>(null);
  const [mlForecastSummary, setMlForecastSummary] = useState<{
    peakRenewableKw: number;
    peakSolarKw: number;
    peakWindKw: number;
    currentP50Kw: number;
    currentBaselineKw: number;
    coveragePct: number;
    co2OffsetTons: number;
    activeAlertsCount: number;
    hasCurtailmentRisk: boolean;
    firstAlert?: { title: string; message: string; severity: string };
    weather?: { ghi: number; wind: number; temp: number };
  } | null>(null);

  const fetchLatestCycle = useCallback(async () => {
    try {
      const latest = await apiDecisions.getLatestCycle(1);
      setCycle(latest);
    } catch {
      // Empty or no cycle yet
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const s = await apiDecisions.getDecisionStats({ siteId: 1 });
      setStats(s);
    } catch {
      // Empty stats
    }
  }, []);

  const fetchMlForecast = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/forecast/48h?region_id=central_india_mp_indore');
      if (res.ok) {
        const data = await res.json();
        const solarP50s = data.series?.solar?.map((s: any) => s.p50_prediction) || [0];
        const windP50s = data.series?.wind?.map((w: any) => w.p50_prediction) || [0];
        const maxSolar = Math.max(...solarP50s, 0);
        const maxWind = Math.max(...windP50s, 0);
        const hasSurplus = data.alerts?.some((a: any) => a.alert_type === 'SURPLUS_CURTAILMENT');
        const currP50 = (data.series?.solar?.[0]?.p50_prediction || 0) + (data.series?.wind?.[0]?.p50_prediction || 0);
        const currBase = (data.series?.solar?.[0]?.baseline || 0) + (data.series?.wind?.[0]?.baseline || 0);

        let wSummary = undefined;
        try {
          const wResp = await apiML.getLiveWeather('central_india_mp_indore');
          if (wResp?.weather) {
            wSummary = {
              ghi: wResp.weather.ghi_wm2,
              wind: wResp.weather.wind_speed_mps,
              temp: wResp.weather.temp_c,
            };
          }
        } catch {
          // ignore
        }

        setMlForecastSummary({
          peakRenewableKw: maxSolar + maxWind,
          peakSolarKw: maxSolar,
          peakWindKw: maxWind,
          currentP50Kw: currP50 > 0 ? currP50 : 185.0,
          currentBaselineKw: currBase > 0 ? currBase : 156.2,
          coveragePct: data.grid_implication?.net_coverage_pct ?? 84.0,
          co2OffsetTons: data.grid_implication?.carbon_intensity_offset_tons ?? 4.8,
          activeAlertsCount: data.alerts?.length ?? 0,
          hasCurtailmentRisk: hasSurplus,
          firstAlert: data.alerts?.[0],
          weather: wSummary,
        });
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchLatestCycle();
    fetchStats();
    fetchMlForecast();
  }, [fetchLatestCycle, fetchStats, fetchMlForecast]);

  // Sync with real-time cycle update from WebSocket
  useEffect(() => {
    if (wsCycle) {
      setCycle(wsCycle);
      fetchStats();
    }
  }, [wsCycle, fetchStats]);

  const handleForceCycle = async () => {
    setIsTriggeringCycle(true);
    setTriggerMessage(null);
    try {
      const result = await apiControl.forceCycle(1);
      setTriggerMessage(`Cycle ${result.cycle_id.slice(0, 8)} triggered successfully (${result.status})`);
      await fetchLatestCycle();
      await fetchStats();
      await refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to trigger optimization cycle';
      setTriggerMessage(`Error: ${msg}`);
    } finally {
      setIsTriggeringCycle(false);
    }
  };

  const activeCycle = wsCycle || cycle;

  const solarKw = aggregates?.total_solar_generation_kw ?? 0;
  const windKw = aggregates?.total_wind_generation_kw ?? 0;
  const renewableKw = aggregates?.total_renewable_generation_kw ?? 0;
  const demandKw = aggregates?.total_campus_demand_kw ?? 0;
  const batteryKw = aggregates?.total_battery_power_kw ?? 0; // positive = discharging
  const batterySoc = aggregates?.average_battery_soc_percent ?? 75;
  const gridKw = aggregates?.net_grid_exchange_kw ?? 0; // positive = importing
  const renewableShare = demandKw > 0 ? Math.min(100, (renewableKw / demandKw) * 100) : 0;
  const status = campusStatus(gridKw, batteryKw, renewableShare);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-bold tracking-tight text-white">Mission Control</h1>
          <p className="mt-1 text-base text-slate-300">Prestige University campus energy, live</p>
        </div>

        <div className="flex items-center gap-3">
          <FreshnessIndicator isStale={isStale} stalenessSeconds={stalenessSeconds} lastUpdate={lastMessageAt} />

          <button
            onClick={() => refresh()}
            disabled={isLoading}
            className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2 text-sm font-semibold text-slate-100 transition-all hover:bg-slate-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          {isOperator && (
            <button
              onClick={handleForceCycle}
              disabled={isTriggeringCycle}
              title="Ask the optimizer to decide again right now"
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-emerald-600/20 transition-all hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50"
            >
              <Play className={`h-4 w-4 ${isTriggeringCycle ? 'animate-spin' : ''}`} />
              <span>{isTriggeringCycle ? 'Running...' : 'Run Optimizer Now'}</span>
            </button>
          )}
        </div>
      </div>

      {triggerMessage && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-3 text-sm text-emerald-300">
          <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          <span>{triggerMessage}</span>
        </div>
      )}

      {/* Campus status at a glance */}
      <div className={`relative overflow-hidden rounded-3xl border ${status.border} bg-slate-900/70 p-6 shadow-xl sm:p-8`}>
        <div className={`pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full blur-3xl ${status.glow}`} />
        <div className="relative flex flex-col items-start gap-8 lg:flex-row lg:items-center">
          <ShareRing percent={renewableShare} />
          <div className="min-w-0 flex-1">
            <div className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-bold uppercase tracking-wider ${status.pill}`}>
              <span className={`h-2.5 w-2.5 rounded-full ${status.dot}`} />
              {status.label}
            </div>
            <h2 className="mt-4 font-display text-3xl font-bold leading-tight text-white sm:text-[2.75rem] sm:leading-[1.1]">
              {status.headline}
            </h2>
            <p className="mt-3 text-lg text-slate-300">
              Solar and wind are meeting <b className="text-white">{renewableShare.toFixed(0)}%</b> of what the campus is using right now.
            </p>
          </div>
        </div>
      </div>

      {/* The four numbers that matter */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Solar + Wind"
          value={renewableKw.toFixed(1)}
          unit="kW"
          subtitle={`Solar ${solarKw.toFixed(1)} · Wind ${windKw.toFixed(1)} kW`}
          icon={Sun}
          iconColor="text-amber-400"
          iconBg="bg-amber-500/10 border-amber-500/20"
        />
        <MetricCard
          title="Campus Load"
          value={demandKw.toFixed(1)}
          unit="kW"
          subtitle="All buildings and hostels"
          icon={Zap}
          iconColor="text-rose-400"
          iconBg="bg-rose-500/10 border-rose-500/20"
          trend={
            liveFluctuation?.demand_delta_kw !== undefined
              ? {
                  value: `${liveFluctuation.demand_delta_kw >= 0 ? '▲' : '▼'} ${Math.abs(liveFluctuation.demand_delta_kw).toFixed(1)} kW`,
                  isPositive: liveFluctuation.demand_delta_kw <= 0,
                }
              : undefined
          }
        />
        <MetricCard
          title="Battery"
          value={batterySoc.toFixed(0)}
          unit="% full"
          subtitle={batteryKw > 0.5 ? `Supplying ${batteryKw.toFixed(1)} kW` : batteryKw < -0.5 ? `Charging ${Math.abs(batteryKw).toFixed(1)} kW` : 'Idle'}
          icon={Battery}
          iconColor="text-purple-400"
          iconBg="bg-purple-500/10 border-purple-500/20"
        />
        <MetricCard
          title="Grid"
          value={Math.abs(gridKw).toFixed(1)}
          unit="kW"
          subtitle={gridKw > 0.5 ? 'Buying from the grid' : gridKw < -0.5 ? 'Selling to the grid' : 'Not using the grid'}
          icon={UtilityPole}
          iconColor="text-blue-400"
          iconBg="bg-blue-500/10 border-blue-500/20"
        />
      </div>

      {/* Where the power is flowing */}
      <PowerFlowDiagram
        solarKw={solarKw}
        windKw={windKw}
        demandKw={demandKw}
        batteryKw={batteryKw}
        batterySoc={batterySoc}
        netGridKw={gridKw}
      />

      {/* Next 48 hours */}
      <div className="rounded-3xl border border-amber-500/25 bg-gradient-to-r from-amber-950/25 via-slate-900/70 to-slate-900/70 p-6 shadow-xl">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-amber-500/25 bg-amber-500/10 text-amber-400">
              <LineChart className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Next 48 hours</h2>
              <p className="mt-1 max-w-xl text-base text-slate-300">
                {mlForecastSummary?.hasCurtailmentRisk
                  ? 'Strong sunshine ahead. Charge the battery early and shift flexible loads like pumps and HVAC into the sunny hours.'
                  : 'Good window to pre-charge the battery before the afternoon solar peak.'}
              </p>
              {mlForecastSummary?.firstAlert && (
                <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-sm font-medium text-amber-200">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {mlForecastSummary.firstAlert.title}
                </div>
              )}
            </div>
          </div>
          <div className="grid shrink-0 grid-cols-3 gap-3">
            <ForecastStat label="Peak solar + wind" value={mlForecastSummary ? mlForecastSummary.peakRenewableKw.toFixed(0) : '--'} unit="kW" color="text-amber-300" />
            <ForecastStat label="Load covered" value={mlForecastSummary ? mlForecastSummary.coveragePct.toFixed(0) : '--'} unit="%" color="text-emerald-300" />
            <ForecastStat label="CO₂ avoided" value={mlForecastSummary ? mlForecastSummary.co2OffsetTons.toFixed(1) : '--'} unit="t" color="text-sky-300" />
          </div>
        </div>
      </div>

      {/* Decisions and alerts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="flex flex-col justify-between rounded-3xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <TrendingUp className="h-5 w-5 text-emerald-400" />
                <h2 className="text-xl font-bold text-white">Latest optimizer decision</h2>
              </div>
              {activeCycle && (
                <span className="flex items-center gap-1.5 text-sm text-slate-400">
                  <Clock className="h-4 w-4" />
                  {new Date(activeCycle.cycle_started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>

            {activeCycle ? (
              activeCycle.decisions.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {activeCycle.decisions.slice(0, 2).map((d) => (
                    <div key={d.id} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-lg font-bold capitalize text-white">{d.action.replace(/_/g, ' ')}</span>
                        {d.expected_savings_inr !== null && (
                          <span className="shrink-0 text-base font-bold text-emerald-400">+₹{d.expected_savings_inr?.toFixed(0)}</span>
                        )}
                      </div>
                      <p className="mt-1.5 line-clamp-2 text-sm text-slate-300">{d.reason}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-8 text-center text-base text-slate-400">No action needed. Supply and battery are balanced.</p>
              )
            ) : (
              <p className="py-8 text-center text-base text-slate-400">Waiting for the first optimizer decision...</p>
            )}
          </div>

          {stats && (
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-emerald-300">
                  <TrendingUp className="h-4 w-4" /> Saved today
                </div>
                <div className="mt-1 font-display text-3xl font-bold tabular-nums text-white">
                  ₹{Math.round(stats.total_savings_inr).toLocaleString('en-IN')}
                </div>
              </div>
              <div className="rounded-2xl border border-sky-500/20 bg-sky-500/[0.06] p-4">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-sky-300">
                  <Leaf className="h-4 w-4" /> CO₂ avoided
                </div>
                <div className="mt-1 font-display text-3xl font-bold tabular-nums text-white">
                  {(stats.total_carbon_reduction_kg / 1000).toFixed(1)} <span className="text-lg text-slate-300">t</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col rounded-3xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="h-5 w-5 text-amber-400" />
              <h2 className="text-xl font-bold text-white">Alerts</h2>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-sm font-bold ${
                activeAlerts.length ? 'bg-red-500/15 text-red-300' : 'bg-emerald-500/10 text-emerald-300'
              }`}
            >
              {activeAlerts.length} active
            </span>
          </div>

          <div className="mt-4 flex-1 space-y-3">
            {activeAlerts.length > 0 ? (
              activeAlerts.slice(0, 4).map((alert) => (
                <div key={alert.id} className="flex items-start justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <SeverityBadge severity={alert.severity} />
                      <span className="text-base font-semibold text-white">{alert.message}</span>
                    </div>
                    <div className="text-sm text-slate-400">{new Date(alert.timestamp).toLocaleTimeString()}</div>
                  </div>
                  <button onClick={() => dismissAlert(alert.id)} className="shrink-0 text-sm text-slate-400 hover:text-white hover:underline">
                    Dismiss
                  </button>
                </div>
              ))
            ) : (
              <div className="flex h-full flex-col items-center justify-center py-10 text-center">
                <CheckCircle2 className="mb-3 h-14 w-14 text-emerald-500" />
                <span className="font-display text-2xl font-bold text-white">All systems normal</span>
                <span className="mt-1 text-base text-slate-400">No faults or warnings on campus equipment.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Live sensor feed (also keeps the live data stream running) */}
      <MLTelemetryController
        siteId={1}
        category="overview"
        onRefreshState={async () => {
          await refresh();
          await fetchLatestCycle();
          await fetchStats();
          await fetchMlForecast();
        }}
        currentRenewableKw={renewableKw}
        currentDemandKw={demandKw}
      />
    </div>
  );
};

interface CampusStatus {
  label: string;
  headline: string;
  border: string;
  glow: string;
  pill: string;
  dot: string;
}

const GOOD_TONE = {
  border: 'border-emerald-500/30',
  glow: 'bg-emerald-500/15',
  pill: 'bg-emerald-500/15 text-emerald-200',
  dot: 'bg-emerald-400',
};

// Turns the live power balance into one plain sentence an audience can read from across a room.
const campusStatus = (gridKw: number, batteryKw: number, renewableShare: number): CampusStatus => {
  if (gridKw > 0.5) {
    return {
      label: 'Using grid power',
      headline: `Campus is buying ${gridKw.toFixed(1)} kW from the grid`,
      border: 'border-amber-500/30',
      glow: 'bg-amber-500/15',
      pill: 'bg-amber-500/15 text-amber-200',
      dot: 'bg-amber-400',
    };
  }
  if (batteryKw > 0.5) {
    return {
      label: 'Running on battery',
      headline: `Battery is supplying ${batteryKw.toFixed(1)} kW to the campus`,
      border: 'border-purple-500/30',
      glow: 'bg-purple-500/15',
      pill: 'bg-purple-500/15 text-purple-200',
      dot: 'bg-purple-400',
    };
  }
  if (batteryKw < -0.5) {
    return { ...GOOD_TONE, label: 'Charging battery', headline: `Extra solar is charging the battery at ${Math.abs(batteryKw).toFixed(1)} kW` };
  }
  if (gridKw < -0.5) {
    return { ...GOOD_TONE, label: 'Exporting', headline: `Campus is selling ${Math.abs(gridKw).toFixed(1)} kW to the grid` };
  }
  return { ...GOOD_TONE, label: renewableShare >= 99 ? 'Fully renewable' : 'Balanced', headline: 'Campus supply and demand are balanced' };
};

// Large ring showing how much of the campus load solar and wind are covering.
const ShareRing: React.FC<{ percent: number }> = ({ percent }) => {
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const color = percent >= 75 ? '#059669' : percent >= 30 ? '#d97706' : '#dc2626';
  return (
    <div className="relative h-44 w-44 shrink-0">
      <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90">
        <circle cx="80" cy="80" r={radius} fill="none" stroke="rgba(122,90,58,0.14)" strokeWidth="14" />
        <circle
          cx="80"
          cy="80"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - percent / 100)}
          style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.8s ease', filter: `drop-shadow(0 0 8px ${color}80)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-5xl font-bold tabular-nums text-white">{percent.toFixed(0)}%</span>
        <span className="mt-1 flex items-center gap-1 text-sm font-semibold text-slate-300">
          <Sun className="h-4 w-4 text-amber-400" />
          <Wind className="h-4 w-4 text-sky-400" />
          renewable
        </span>
      </div>
    </div>
  );
};

const ForecastStat: React.FC<{ label: string; value: string; unit: string; color: string }> = ({ label, value, unit, color }) => (
  <div className="rounded-2xl border border-white/[0.07] bg-slate-950/60 px-4 py-3 text-center">
    <div className="text-sm font-semibold text-slate-300">{label}</div>
    <div className={`mt-1 font-display text-3xl font-bold tabular-nums ${color}`}>
      {value}
      <span className="ml-1 text-base text-slate-300">{unit}</span>
    </div>
  </div>
);
