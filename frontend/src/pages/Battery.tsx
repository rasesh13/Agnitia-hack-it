import React from 'react';
import { useLiveTwin } from '../hooks/useLiveTwin';
import { MetricCard } from '../components/MetricCard';
import { BatteryGauge } from '../components/BatteryGauge';
import { QualityBadge, OperationalStatusBadge } from '../components/StatusBadge';
import { FreshnessIndicator } from '../components/FreshnessIndicator';
import {
  BatteryCharging,
  Zap,
  ShieldCheck,
  RefreshCw,
  Thermometer,
  Cpu,
  Layers,
} from 'lucide-react';
import { MLTelemetryController } from '../components/MLTelemetryController';

export const Battery: React.FC = () => {
  const { assets, aggregates, isStale, stalenessSeconds, refresh, isLoading } = useLiveTwin(1);

  const batteryAssets = assets.filter((a) => a.asset_type === 'battery');
  const totalBatteryCapacity = batteryAssets.reduce((acc, a) => acc + a.rated_capacity_kw, 0);

  // Compute fleet average SoC
  const fleetSoc =
    batteryAssets.length > 0
      ? batteryAssets.reduce((acc, a) => acc + (a.state?.soc_percent ?? 50), 0) /
        batteryAssets.length
      : 50;

  const fleetPower = aggregates.total_battery_power_kw; // positive = discharging, negative = charging

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Battery Energy Storage (BESS)</h1>
          <p className="mt-1 text-xs text-slate-400">
            Prestige University, Indore • 500 kWh / 250 kW Campus BESS storage, SoC reserve floor, and automated peak dispatch
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

      {/* Battery Aggregate KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Fleet State of Charge"
          value={fleetSoc.toFixed(1)}
          unit="%"
          subtitle={`Reserve Floor: 20% Min`}
          icon={BatteryCharging}
          iconColor="text-purple-400"
          iconBg="bg-purple-500/10 border-purple-500/20"
        />

        <MetricCard
          title="Net Battery Power"
          value={Math.abs(fleetPower).toFixed(1)}
          unit="kW"
          subtitle={fleetPower < 0 ? 'Charging (Absorbing Power)' : fleetPower > 0 ? 'Discharging (Supplying Load)' : 'Standby'}
          icon={Zap}
          iconColor={fleetPower < 0 ? 'text-emerald-400' : fleetPower > 0 ? 'text-amber-400' : 'text-slate-400'}
          iconBg="bg-slate-800/80 border-slate-700"
        />

        <MetricCard
          title="Installed Storage"
          value={totalBatteryCapacity.toFixed(0)}
          unit="kWh"
          subtitle={`${batteryAssets.length} Storage Packs Online`}
          icon={Layers}
          iconColor="text-blue-400"
          iconBg="bg-blue-500/10 border-blue-500/20"
        />

        <MetricCard
          title="Degradation Guard"
          value="Active"
          subtitle="Max DoD 80% • C-Rate ≤ 0.5C"
          icon={ShieldCheck}
          iconColor="text-emerald-400"
          iconBg="bg-emerald-500/10 border-emerald-500/20"
        />
      </div>

      {/* ML Model Live Telemetry & Zero Baseline Controller */}
      <MLTelemetryController
        siteId={1}
        category="battery"
        onRefreshState={refresh}
        currentRenewableKw={aggregates.total_renewable_generation_kw}
        currentDemandKw={aggregates.total_campus_demand_kw}
      />

      {/* Individual Battery Units */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-purple-400" />
            <h2 className="text-base font-bold text-white">Storage Pack Telemetry & Gauges</h2>
          </div>
          <span className="text-xs text-slate-400">{batteryAssets.length} Packs Configured</span>
        </div>

        {batteryAssets.length === 0 ? (
          <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-8 text-center text-slate-400">
            No dedicated BESS assets configured for this site.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {batteryAssets.map((asset) => {
              const state = asset.state;
              const soc = state?.soc_percent ?? 50;
              const power = state?.active_power_kw ?? 0;
              const temp = state?.temperature_celsius ?? 28.5;

              return (
                <div
                  key={asset.id}
                  className="flex flex-col gap-4 rounded-3xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl backdrop-blur-md"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-base font-bold text-white">{asset.name}</h3>
                      <div className="text-xs font-mono text-slate-500 mt-0.5">{asset.id}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <OperationalStatusBadge status={state?.operational_status || 'online'} />
                      <QualityBadge quality={state?.telemetry_quality || 'good'} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                    <BatteryGauge
                      socPercent={soc}
                      powerKw={power}
                      reserveFloor={20}
                      minSoc={10}
                      maxSoc={95}
                      healthPercent={98}
                      temperatureCelsius={temp}
                    />

                    <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-xs">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <span className="text-slate-400">Rated Energy</span>
                        <span className="font-mono font-bold text-slate-200">{asset.rated_capacity_kw} kWh</span>
                      </div>
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <span className="text-slate-400">Max Discharge Rate</span>
                        <span className="font-mono font-bold text-slate-200">{(asset.rated_capacity_kw * 0.5).toFixed(1)} kW (0.5C)</span>
                      </div>
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <span className="text-slate-400">Max Charge Rate</span>
                        <span className="font-mono font-bold text-slate-200">{(asset.rated_capacity_kw * 0.5).toFixed(1)} kW (0.5C)</span>
                      </div>
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <span className="text-slate-400">ML Dispatch Setpoint</span>
                        <span className="rounded bg-purple-500/10 px-2 py-0.5 font-mono text-[10px] font-bold text-purple-300 border border-purple-500/20">
                          {power < -0.1 ? `Charging (${Math.abs(power).toFixed(1)} kW)` : power > 0.1 ? `Discharging (${power.toFixed(1)} kW)` : 'Float / Reserve'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <span className="text-slate-400">Round-trip Efficiency</span>
                        <span className="font-mono font-bold text-emerald-400">92.5%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Thermal Status</span>
                        <span className="flex items-center gap-1 font-mono font-bold text-emerald-400">
                          <Thermometer className="h-3 w-3" />
                          Normal ({temp.toFixed(1)}°C)
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
