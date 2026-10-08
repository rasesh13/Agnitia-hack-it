import React, { useEffect, useState } from 'react';
import {
  Sun,
  Wind,
  AlertTriangle,
  ShieldCheck,
  Zap,
  Activity,
  Layers,
  BarChart3,
  RefreshCw,
} from 'lucide-react';

interface MetricDetail {
  MAE: number;
  RMSE: number;
  MAPE: number;
  R2: number;
}

interface HorizonPoint {
  timestamp: string;
  target: string;
  actual?: number;
  baseline: number;
  p10_lower: number;
  p50_prediction: number;
  p90_upper: number;
  unit: string;
}

interface GenerationAlert {
  id: string;
  timestamp: string;
  target: string;
  severity: 'info' | 'warning' | 'critical';
  alert_type: string;
  title: string;
  message: string;
  recommended_action: string;
}

interface RegionInfo {
  id: string;
  name: string;
  grid_emission_factor: number;
}

interface ForecastPayload {
  site_name: string;
  region_id: string;
  generated_at: string;
  horizon_hours: number;
  models_compared: string[];
  metrics: Record<string, any>;
  series: {
    solar: HorizonPoint[];
    wind: HorizonPoint[];
    demand: HorizonPoint[];
  };
  alerts: GenerationAlert[];
  available_regions: RegionInfo[];
  grid_implication: {
    avg_generation: number;
    avg_demand: number;
    unit: string;
    net_coverage_pct: number;
    carbon_intensity_offset_tons: number;
  };
}

export const Forecast: React.FC = () => {
  const [data, setData] = useState<ForecastPayload | null>(null);
  const [selectedRegion] = useState<string>('central_india_mp_indore');
  const [selectedTarget, setSelectedTarget] = useState<'solar' | 'wind' | 'demand'>('solar');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchForecast = async (regionId: string = selectedRegion) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/forecast/48h?region_id=${encodeURIComponent(regionId)}`);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch ML forecast');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchForecast(selectedRegion);
  }, [selectedRegion]);

  if (error && !data) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-center text-red-300">
        <p className="font-semibold">Failed to load forecast data</p>
        <p className="mt-1 text-xs opacity-80">{error}</p>
        <button
          onClick={() => fetchForecast(selectedRegion)}
          className="mt-4 rounded-xl border border-red-500/40 bg-red-500/20 px-4 py-2 text-xs font-semibold text-white hover:bg-red-500/30"
        >
          Try Again
        </button>
      </div>
    );
  }

  const series = data?.series[selectedTarget] || [];
  const unit = series[0]?.unit || 'MW';

  // Metrics extraction for current target
  let metrics: { baseline_metrics?: MetricDetail; ml_metrics?: MetricDetail; coverage_pct?: number } | undefined;
  if (data?.region_id === 'all_india_grid') {
    metrics =
      selectedTarget === 'solar'
        ? data?.metrics?.solar_mw
        : selectedTarget === 'wind'
        ? data?.metrics?.wind_mw
        : data?.metrics?.demand_mw;
  } else {
    metrics = data?.metrics?.[selectedTarget];
  }

  // Max value for chart scaling
  const maxVal = Math.max(...series.map((p) => Math.max(p.p90_upper, p.baseline, p.actual || 0)), 1);

  return (
    <div className="space-y-6">
      {/* Header & Regional Selector */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-400 border border-amber-500/20">
              Agnitia AI Forecasting Engine
            </span>
            <span className="text-xs text-slate-400 font-mono">48-Hour Lookahead</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white">
            {data?.site_name || 'Renewable Generation & Load Forecasting'}
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Physics clear-sky & aerodynamic baselines compared with LightGBM & XGBoost Quantile Regressors (P10/P50/P90).
          </p>
        </div>

        {/* Active Campus Badge & Refresh */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-950/40 px-3.5 py-1.5 text-xs text-emerald-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold">Prestige University, Indore (Malwa Microgrid)</span>
            <span className="text-[10px] text-emerald-400/70 border-l border-emerald-500/30 pl-2 font-mono">0.82 kg CO₂/kWh</span>
          </div>

          <button
            onClick={() => fetchForecast('central_india_mp_indore')}
            className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2 text-xs font-semibold text-slate-200 transition-all hover:bg-slate-700"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Target Selector Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        {[
          { id: 'solar', label: 'Solar Photovoltaic', icon: Sun, color: 'text-amber-400' },
          { id: 'wind', label: 'Wind Generation', icon: Wind, color: 'text-sky-400' },
          { id: 'demand', label: 'Campus/Grid Demand', icon: Zap, color: 'text-emerald-400' },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = selectedTarget === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSelectedTarget(tab.id as any)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Icon className={`h-4 w-4 ${tab.color}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Accuracy Benchmark Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur-md">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>ML Model MAE</span>
            <BarChart3 className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white font-mono">
            {metrics?.ml_metrics?.MAE.toLocaleString()} <span className="text-xs text-slate-400">{unit}</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
            <span>Baseline MAE:</span>
            <span className="font-mono text-slate-300">{metrics?.baseline_metrics?.MAE.toLocaleString()} {unit}</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur-md">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Root Mean Sq Error (RMSE)</span>
            <Activity className="h-4 w-4 text-sky-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white font-mono">
            {metrics?.ml_metrics?.RMSE.toLocaleString()} <span className="text-xs text-slate-400">{unit}</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
            <span>R² Goodness of Fit:</span>
            <span className="font-mono text-emerald-400">{metrics?.ml_metrics?.R2}</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur-md">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Uncertainty Coverage</span>
            <Layers className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-300 font-mono">
            {metrics?.coverage_pct}%
          </div>
          <div className="mt-1 text-xs text-slate-400">
            Empirical confidence band [P10–P90]
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur-md">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>48h Renewable Offset</span>
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-400 font-mono">
            {data?.grid_implication.carbon_intensity_offset_tons.toLocaleString()} <span className="text-xs">tCO₂</span>
          </div>
          <div className="mt-1 text-xs text-slate-400">
            Net load coverage: {data?.grid_implication.net_coverage_pct}%
          </div>
        </div>
      </div>

      {/* Uncertainty Band Chart (SVG Rendering) */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 backdrop-blur-md">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-white">
              Hourly Actual vs. Predicted Generation with Uncertainty Bounds (48 Hours)
            </h3>
            <p className="text-xs text-slate-400">
              Shaded band denotes 80% confidence interval [P10 lower to P90 upper].
            </p>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              <span className="text-slate-300">ML Forecast (P50)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-slate-500" />
              <span className="text-slate-400">Physics Baseline</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-4 rounded bg-amber-500/20 border border-amber-500/40" />
              <span className="text-slate-400">[P10 - P90] Band</span>
            </div>
          </div>
        </div>

        {/* Visual Chart */}
        <div className="relative h-64 w-full pt-4">
          <svg className="h-full w-full overflow-visible" preserveAspectRatio="none" viewBox={`0 0 ${series.length} 100`}>
            {/* Grid Lines */}
            {[25, 50, 75].map((y) => (
              <line key={y} x1="0" y1={y} x2={series.length} y2={y} stroke="rgba(255,255,255,0.05)" strokeDasharray="2" />
            ))}

            {/* Uncertainty Area (P10 to P90) */}
            {series.length > 1 && (
              <polygon
                points={
                  series
                    .map((p, i) => `${i},${100 - (p.p90_upper / maxVal) * 100}`)
                    .join(' ') +
                  ' ' +
                  series
                    .slice()
                    .reverse()
                    .map((p, i) => `${series.length - 1 - i},${100 - (p.p10_lower / maxVal) * 100}`)
                    .join(' ')
                }
                fill="rgba(245, 158, 11, 0.12)"
              />
            )}

            {/* Baseline Path */}
            {series.length > 1 && (
              <polyline
                fill="none"
                stroke="rgba(148, 163, 184, 0.5)"
                strokeWidth="1.2"
                strokeDasharray="2 2"
                points={series.map((p, i) => `${i},${100 - (p.baseline / maxVal) * 100}`).join(' ')}
              />
            )}

            {/* ML P50 Path */}
            {series.length > 1 && (
              <polyline
                fill="none"
                stroke="#f59e0b"
                strokeWidth="2.2"
                points={series.map((p, i) => `${i},${100 - (p.p50_prediction / maxVal) * 100}`).join(' ')}
              />
            )}
          </svg>
        </div>

        {/* X-axis Timeline */}
        <div className="mt-2 flex justify-between text-[10px] text-slate-500 font-mono">
          <span>{series[0]?.timestamp.slice(11, 16) || 'T+0'}</span>
          <span>{series[12]?.timestamp.slice(11, 16) || 'T+12h'}</span>
          <span>{series[24]?.timestamp.slice(11, 16) || 'T+24h'}</span>
          <span>{series[36]?.timestamp.slice(11, 16) || 'T+36h'}</span>
          <span>{series[series.length - 1]?.timestamp.slice(11, 16) || 'T+48h'}</span>
        </div>
      </div>

      {/* Automated Generation Alerts */}
      {data?.alerts && data.alerts.length > 0 && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 backdrop-blur-md">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
            <h4 className="text-sm font-semibold text-white">Automated Generation & Ramp Alerts</h4>
          </div>
          <div className="space-y-2">
            {data.alerts.map((alert) => (
              <div key={alert.id} className="flex flex-col sm:flex-row sm:items-center justify-between rounded-xl bg-slate-900/80 p-3 border border-slate-800 text-xs gap-2">
                <div>
                  <span className="font-semibold text-amber-300">{alert.title}</span>
                  <p className="text-slate-400 mt-0.5">{alert.message}</p>
                </div>
                <div className="shrink-0 text-slate-300 font-mono bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700">
                  Action: {alert.recommended_action}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
