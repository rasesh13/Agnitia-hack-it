import React from 'react';
import { useLiveTwin } from '../hooks/useLiveTwin';
import { MetricCard } from '../components/MetricCard';
import { FreshnessIndicator } from '../components/FreshnessIndicator';
import {
  Globe,
  Zap,
  TrendingDown,
  TrendingUp,
  RefreshCw,
  Clock,
  Leaf,
  ShieldCheck,
} from 'lucide-react';
import { MLTelemetryController } from '../components/MLTelemetryController';

export const Grid: React.FC = () => {
  const { aggregates, isStale, stalenessSeconds, refresh, isLoading } = useLiveTwin(1);

  const gridPower = aggregates.net_grid_exchange_kw;
  const isExporting = gridPower < 0;
  const isImporting = gridPower > 0;

  // Determine current tariff period based on local hour
  const currentHour = new Date().getHours();
  let tariffType = 'Standard';
  let importRate = 8.5;
  if (currentHour >= 18 && currentHour < 22) {
    tariffType = 'Peak TOD';
    importRate = 12.0;
  } else if (currentHour >= 22 || currentHour < 6) {
    tariffType = 'Off-Peak TOD';
    importRate = 6.0;
  }

  const exportRate = 3.5;
  const carbonIntensity = 0.82; // kg CO2/kWh (CEA standard baseline)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Grid Interconnection & MPPKVVCL Tariffs</h1>
          <p className="mt-1 text-xs text-slate-400">
            Prestige University, Indore • MPPKVVCL 11kV Grid Interconnection, Time-of-Day (TOD) tariffs & MP carbon accounting
          </p>
        </div>

        <div className="flex items-center gap-3">
          <FreshnessIndicator isStale={isStale} stalenessSeconds={stalenessSeconds} />
          <button
            onClick={() => refresh()}
            disabled={isLoading}
            className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-1.5 text-xs font-semibold text-slate-200 transition-all hover:bg-slate-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ML Model Live Telemetry & Zero Baseline Controller */}
      <MLTelemetryController
        siteId={1}
        onRefreshState={refresh}
        currentRenewableKw={aggregates.total_renewable_generation_kw}
        currentDemandKw={aggregates.total_campus_demand_kw}
      />

      {/* Grid KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Grid Exchange Power"
          value={Math.abs(gridPower).toFixed(1)}
          unit="kW"
          subtitle={
            isExporting
              ? 'Exporting Clean Energy to Grid'
              : isImporting
              ? 'Importing from Main Utility'
              : 'Zero Net Grid Exchange'
          }
          icon={Zap}
          iconColor={isExporting ? 'text-emerald-400' : isImporting ? 'text-amber-400' : 'text-slate-400'}
          iconBg={
            isExporting
              ? 'bg-emerald-500/10 border-emerald-500/20'
              : 'bg-amber-500/10 border-amber-500/20'
          }
        />

        <MetricCard
          title="Active Tariff (TOD)"
          value={`₹${importRate.toFixed(2)}`}
          unit="/ kWh"
          subtitle={`Current Band: ${tariffType}`}
          icon={TrendingDown}
          iconColor="text-blue-400"
          iconBg="bg-blue-500/10 border-blue-500/20"
        />

        <MetricCard
          title="Grid Carbon Baseline"
          value={carbonIntensity.toFixed(2)}
          unit="kg CO₂/kWh"
          subtitle="CEA Regional Grid Average"
          icon={Leaf}
          iconColor="text-emerald-400"
          iconBg="bg-emerald-500/10 border-emerald-500/20"
        />

        <MetricCard
          title="Export Feed-in Tariff"
          value={`₹${exportRate.toFixed(2)}`}
          unit="/ kWh"
          subtitle="Net-metering Credit Value"
          icon={TrendingUp}
          iconColor="text-purple-400"
          iconBg="bg-purple-500/10 border-purple-500/20"
        />
      </div>

      {/* Main Grid Info Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Point of Common Coupling (PCC) Status */}
        <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl backdrop-blur-md">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Globe className="h-5 w-5 text-blue-400" />
            <h2 className="text-base font-bold text-white">Point of Common Coupling (PCC)</h2>
          </div>

          <div className="mt-5 space-y-4 text-xs">
            <div className="flex items-center justify-between rounded-xl bg-slate-950/60 p-3.5 border border-slate-800">
              <span className="text-slate-400">Interconnect Voltage</span>
              <span className="font-mono font-bold text-slate-200">11.0 kV / 415 V Stepped</span>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-slate-950/60 p-3.5 border border-slate-800">
              <span className="text-slate-400">Grid Frequency</span>
              <span className="font-mono font-bold text-emerald-400">50.02 Hz (Stable)</span>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-slate-950/60 p-3.5 border border-slate-800">
              <span className="text-slate-400">Power Factor (PF)</span>
              <span className="font-mono font-bold text-emerald-400">0.99 Lagging</span>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-slate-950/60 p-3.5 border border-slate-800">
              <span className="text-slate-400">ML Microgrid Self-Sufficiency</span>
              <span className="font-mono font-bold text-cyan-400">
                {aggregates.total_campus_demand_kw > 0
                  ? `${Math.min(100, (aggregates.total_renewable_generation_kw / aggregates.total_campus_demand_kw) * 100).toFixed(1)}%`
                  : '100%'}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-slate-950/60 p-3.5 border border-slate-800">
              <span className="text-slate-400">Real-Time Grid Exchange</span>
              <span className={`font-mono font-bold ${gridPower < -0.1 ? 'text-emerald-400' : gridPower > 0.1 ? 'text-amber-400' : 'text-slate-300'}`}>
                {gridPower < -0.1 ? `Exporting ${Math.abs(gridPower).toFixed(1)} kW` : gridPower > 0.1 ? `Importing ${gridPower.toFixed(1)} kW` : '0.0 kW (Islanded Balance)'}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-slate-950/60 p-3.5 border border-slate-800">
              <span className="text-slate-400">Net Metering Mode</span>
              <span className="flex items-center gap-1 font-semibold text-purple-300">
                <ShieldCheck className="h-3.5 w-3.5 text-purple-400" />
                Virtual Net Metering (VNM) Enabled
              </span>
            </div>
          </div>
        </div>

        {/* Time-of-Day Tariff Schedule */}
        <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl backdrop-blur-md">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Clock className="h-5 w-5 text-amber-400" />
            <h2 className="text-base font-bold text-white">Time-of-Day (TOD) Tariff Bands</h2>
          </div>

          <div className="mt-5 space-y-3">
            <div
              className={`flex items-center justify-between rounded-xl p-3 border transition-all ${
                tariffType === 'Off-Peak TOD'
                  ? 'border-emerald-500/40 bg-emerald-500/10'
                  : 'border-slate-800 bg-slate-950/40'
              }`}
            >
              <div>
                <div className="text-xs font-bold text-slate-200">Off-Peak Night Band</div>
                <div className="text-[11px] text-slate-400">22:00 – 06:00 • Ideal for Battery Storage Charging</div>
              </div>
              <span className="font-mono text-xs font-bold text-emerald-400">₹6.00 / kWh</span>
            </div>

            <div
              className={`flex items-center justify-between rounded-xl p-3 border transition-all ${
                tariffType === 'Standard'
                  ? 'border-blue-500/40 bg-blue-500/10'
                  : 'border-slate-800 bg-slate-950/40'
              }`}
            >
              <div>
                <div className="text-xs font-bold text-slate-200">Normal Daytime Band</div>
                <div className="text-[11px] text-slate-400">06:00 – 18:00 • High Solar Generation Match</div>
              </div>
              <span className="font-mono text-xs font-bold text-blue-400">₹8.50 / kWh</span>
            </div>

            <div
              className={`flex items-center justify-between rounded-xl p-3 border transition-all ${
                tariffType === 'Peak TOD'
                  ? 'border-amber-500/40 bg-amber-500/10'
                  : 'border-slate-800 bg-slate-950/40'
              }`}
            >
              <div>
                <div className="text-xs font-bold text-slate-200">Peak Evening Band</div>
                <div className="text-[11px] text-slate-400">18:00 – 22:00 • Maximum Grid Cost & Battery Discharge</div>
              </div>
              <span className="font-mono text-xs font-bold text-amber-400">₹12.00 / kWh</span>
            </div>

            <div className="flex items-center justify-between rounded-xl p-3 border border-slate-800 bg-slate-950/40">
              <div>
                <div className="text-xs font-bold text-slate-200">Feed-In Export Credit</div>
                <div className="text-[11px] text-slate-400">All intervals • Surplus Renewable Export</div>
              </div>
              <span className="font-mono text-xs font-bold text-purple-400">₹3.50 / kWh</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
