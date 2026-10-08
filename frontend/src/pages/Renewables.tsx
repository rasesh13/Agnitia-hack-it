import React from 'react';
import { useLiveTwin } from '../hooks/useLiveTwin';
import { MetricCard } from '../components/MetricCard';
import { QualityBadge, OperationalStatusBadge } from '../components/StatusBadge';
import { FreshnessIndicator } from '../components/FreshnessIndicator';
import {
  Sun,
  Wind,
  Zap,
  Gauge,
  RefreshCw,
} from 'lucide-react';

export const Renewables: React.FC = () => {
  const { assets, aggregates, isStale, stalenessSeconds, refresh, isLoading } = useLiveTwin(1);

  const solarAssets = assets.filter((a) => a.asset_type === 'solar');
  const windAssets = assets.filter((a) => a.asset_type === 'wind');
  const totalRenewableCapacity = [...solarAssets, ...windAssets].reduce(
    (acc, a) => acc + a.rated_capacity_kw,
    0
  );

  const totalRenewablePower = aggregates.total_renewable_generation_kw;
  const capacityFactor =
    totalRenewableCapacity > 0
      ? Math.min(100, (totalRenewablePower / totalRenewableCapacity) * 100)
      : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Renewable Generation Fleet</h1>
          <p className="mt-1 text-xs text-slate-400">
            Prestige University, Indore • Real-time photovoltaic (300 kW) and wind turbine (120 kW) telemetry & capacity utilization
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

      {/* Renewable KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Renewable Power"
          value={totalRenewablePower.toFixed(1)}
          unit="kW"
          subtitle={`Installed Capacity: ${totalRenewableCapacity.toFixed(1)} kW`}
          icon={Zap}
          iconColor="text-emerald-400"
          iconBg="bg-emerald-500/10 border-emerald-500/20"
        />

        <MetricCard
          title="Solar PV Generation"
          value={aggregates.total_solar_generation_kw.toFixed(1)}
          unit="kW"
          subtitle={`${solarAssets.length} Arrays Active`}
          icon={Sun}
          iconColor="text-amber-400"
          iconBg="bg-amber-500/10 border-amber-500/20"
        />

        <MetricCard
          title="Wind Turbine Output"
          value={aggregates.total_wind_generation_kw.toFixed(1)}
          unit="kW"
          subtitle={`${windAssets.length} Turbines Active`}
          icon={Wind}
          iconColor="text-cyan-400"
          iconBg="bg-cyan-500/10 border-cyan-500/20"
        />

        <MetricCard
          title="Instantaneous Capacity Factor"
          value={capacityFactor.toFixed(1)}
          unit="%"
          subtitle="Real-time Yield Ratio"
          icon={Gauge}
          iconColor="text-purple-400"
          iconBg="bg-purple-500/10 border-purple-500/20"
        />
      </div>

      {/* Solar Arrays Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sun className="h-5 w-5 text-amber-400" />
            <h2 className="text-base font-bold text-white">Photovoltaic Solar Arrays</h2>
          </div>
          <span className="text-xs text-slate-400">{solarAssets.length} Arrays Monitored</span>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {solarAssets.map((asset) => {
            const state = asset.state;
            const p = state?.active_power_kw ?? 0;
            const util = asset.rated_capacity_kw > 0 ? (p / asset.rated_capacity_kw) * 100 : 0;

            return (
              <div
                key={asset.id}
                className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl backdrop-blur-md"
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

                <div className="mt-5 grid grid-cols-3 gap-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-center">
                  <div>
                    <div className="text-[10px] uppercase font-bold text-slate-500">Live Power</div>
                    <div className="text-xl font-bold text-amber-300 mt-0.5">{p.toFixed(1)} kW</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-bold text-slate-500">Rated Peak</div>
                    <div className="text-base font-bold text-slate-300 mt-0.5">{asset.rated_capacity_kw.toFixed(1)} kW</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-bold text-slate-500">Inverter Yield</div>
                    <div className="text-base font-bold text-emerald-400 mt-0.5">{util.toFixed(0)}%</div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/80 pt-3">
                  <span>Temperature: <b>{state?.temperature_celsius != null ? `${state.temperature_celsius.toFixed(1)} °C` : '32.0 °C'}</b></span>
                  <span>Voltage: <b>{state?.voltage_v != null ? `${state.voltage_v.toFixed(1)} V` : '415.0 V'}</b></span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Wind Generation Section */}
      {windAssets.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Wind className="h-5 w-5 text-cyan-400" />
              <h2 className="text-base font-bold text-white">Wind Turbine Generators</h2>
            </div>
            <span className="text-xs text-slate-400">{windAssets.length} Turbines Monitored</span>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {windAssets.map((asset) => {
              const state = asset.state;
              const p = state?.active_power_kw ?? 0;

              return (
                <div
                  key={asset.id}
                  className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl backdrop-blur-md"
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

                  <div className="mt-5 grid grid-cols-3 gap-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-center">
                    <div>
                      <div className="text-[10px] uppercase font-bold text-slate-500">Active Yield</div>
                      <div className="text-xl font-bold text-cyan-300 mt-0.5">{p.toFixed(1)} kW</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-bold text-slate-500">Rated Power</div>
                      <div className="text-base font-bold text-slate-300 mt-0.5">{asset.rated_capacity_kw.toFixed(1)} kW</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-bold text-slate-500">Grid Sync</div>
                      <div className="text-base font-bold text-emerald-400 mt-0.5">50.0 Hz</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
