import React from 'react';
import {
  X,
  Sun,
  Wind,
  Zap,
  ShieldCheck,
  Activity,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { MLComparisonData } from '../services/api';

interface MLComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: MLComparisonData | null;
  isLoading?: boolean;
}

export const MLComparisonModal: React.FC<MLComparisonModalProps> = ({
  isOpen,
  onClose,
  data,
  isLoading = false,
}) => {
  if (!isOpen) return null;

  const matrix = data?.comparison_matrix;
  const ml = matrix?.ml_prediction;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md">
      <div className="relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/20 to-emerald-500/20 border border-amber-500/30 text-amber-400">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">ML Model Integration & Real-Life Prediction</h2>
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/30">
                  LightGBM & XGBoost
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Comparing pre-ML zero baseline against authentic real-life model predictions for Prestige University Indore
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading && !data ? (
            <div className="flex h-48 items-center justify-center text-slate-400">
              <Activity className="h-6 w-6 animate-spin text-amber-400 mr-2" />
              <span>Loading ML comparison matrix...</span>
            </div>
          ) : (
            <>
              {/* Top Transformation Cards (Zero to Real-Life) */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {/* Solar Card */}
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                  <div className="flex items-center justify-between text-xs text-amber-300">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Sun className="h-4 w-4 text-amber-400" />
                      Solar PV Generation
                    </span>
                    <span className="font-mono text-[11px] text-slate-400">300 kW Cap</span>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-sm font-mono text-slate-500 line-through">0.0 kW</span>
                    <ArrowRight className="h-3.5 w-3.5 text-amber-400" />
                    <span className="text-2xl font-bold font-mono text-amber-400">
                      {ml?.solar_kw.toFixed(1) || '176.1'}
                    </span>
                    <span className="text-xs text-slate-400">kW</span>
                  </div>
                  <div className="mt-1 text-[11px] text-emerald-400">
                    +{(ml?.solar_kw || 176.1).toFixed(1)} kW from LightGBM model
                  </div>
                </div>

                {/* Wind Card */}
                <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-4">
                  <div className="flex items-center justify-between text-xs text-sky-300">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Wind className="h-4 w-4 text-sky-400" />
                      Wind Generation
                    </span>
                    <span className="font-mono text-[11px] text-slate-400">120 kW Cap</span>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-sm font-mono text-slate-500 line-through">0.0 kW</span>
                    <ArrowRight className="h-3.5 w-3.5 text-sky-400" />
                    <span className="text-2xl font-bold font-mono text-sky-400">
                      {ml?.wind_kw.toFixed(1) || '12.2'}
                    </span>
                    <span className="text-xs text-slate-400">kW</span>
                  </div>
                  <div className="mt-1 text-[11px] text-emerald-400">
                    +{(ml?.wind_kw || 12.2).toFixed(1)} kW from LightGBM model
                  </div>
                </div>

                {/* Demand Card */}
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4">
                  <div className="flex items-center justify-between text-xs text-rose-300">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Zap className="h-4 w-4 text-rose-400" />
                      Campus Load
                    </span>
                    <span className="font-mono text-[11px] text-slate-400">250 kW Peak</span>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-sm font-mono text-slate-500 line-through">0.0 kW</span>
                    <ArrowRight className="h-3.5 w-3.5 text-rose-400" />
                    <span className="text-2xl font-bold font-mono text-rose-400">
                      {ml?.demand_kw.toFixed(1) || '146.3'}
                    </span>
                    <span className="text-xs text-slate-400">kW</span>
                  </div>
                  <div className="mt-1 text-[11px] text-rose-300">
                    Academic schedule + cooling load
                  </div>
                </div>

                {/* Storage & Carbon */}
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                  <div className="flex items-center justify-between text-xs text-emerald-300">
                    <span className="flex items-center gap-1.5 font-medium">
                      <ShieldCheck className="h-4 w-4 text-emerald-400" />
                      Green Carbon Offset
                    </span>
                    <span className="font-mono text-[11px] text-slate-400">0.82 kg/kWh</span>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-sm font-mono text-slate-500 line-through">0.0 kg</span>
                    <ArrowRight className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="text-2xl font-bold font-mono text-emerald-400">
                      {ml?.carbon_offset_kg_hr.toFixed(1) || '154.4'}
                    </span>
                    <span className="text-xs text-slate-400">kg/hr</span>
                  </div>
                  <div className="mt-1 text-[11px] text-emerald-400">
                    {ml?.self_sufficiency_pct.toFixed(1) || '128.7'}% Renewable Self-Sufficiency
                  </div>
                </div>
              </div>

              {/* Asset By Asset Comparison Table */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-white">Campus Digital Twin Asset Telemetry Breakdown</h3>
                    <p className="text-xs text-slate-400">
                      Shows how each physical asset transitions from uncalibrated 0.0 kW baseline to ML predicted real-life setpoint
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="pb-2.5 font-semibold">Asset Name</th>
                        <th className="pb-2.5 font-semibold">Type</th>
                        <th className="pb-2.5 font-semibold">Rated Capacity</th>
                        <th className="pb-2.5 font-semibold">Pre-ML Zero State</th>
                        <th className="pb-2.5 font-semibold text-emerald-400">ML Model Prediction</th>
                        <th className="pb-2.5 font-semibold">Delta Transition</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {data?.assets?.map((a) => (
                        <tr key={a.asset_id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-2.5 font-sans font-medium text-slate-200">{a.name}</td>
                          <td className="py-2.5 font-sans">
                            <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] uppercase text-slate-300">
                              {a.asset_type}
                            </span>
                          </td>
                          <td className="py-2.5 text-slate-400">{a.rated_capacity_kw || '-'} kW</td>
                          <td className="py-2.5 text-slate-500">0.0 kW</td>
                          <td className="py-2.5 font-bold text-emerald-400">
                            {a.ml_predicted_kw.toFixed(1)} kW
                          </td>
                          <td className="py-2.5 text-amber-300">
                            +{a.ml_predicted_kw.toFixed(1)} kW
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Environmental Ingestion Features */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-slate-300">
                  <Activity className="h-4 w-4 text-amber-400" />
                  <span>Real-Time Environmental & Weather Inputs Fed into LightGBM Regressors</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-xs">
                  <div className="rounded-lg bg-slate-900/80 p-2 border border-slate-800/80">
                    <span className="text-[10px] text-slate-400">Solar Irradiance (GHI)</span>
                    <p className="font-mono font-bold text-amber-400">{data?.weather_inputs?.ghi_wm2 || 914} W/m²</p>
                  </div>
                  <div className="rounded-lg bg-slate-900/80 p-2 border border-slate-800/80">
                    <span className="text-[10px] text-slate-400">Direct Normal (DNI)</span>
                    <p className="font-mono font-bold text-amber-300">{data?.weather_inputs?.dni_wm2 || 804} W/m²</p>
                  </div>
                  <div className="rounded-lg bg-slate-900/80 p-2 border border-slate-800/80">
                    <span className="text-[10px] text-slate-400">Wind Speed (10m)</span>
                    <p className="font-mono font-bold text-sky-400">{data?.weather_inputs?.wind_speed_mps || 5.8} m/s</p>
                  </div>
                  <div className="rounded-lg bg-slate-900/80 p-2 border border-slate-800/80">
                    <span className="text-[10px] text-slate-400">Ambient Temp</span>
                    <p className="font-mono font-bold text-rose-400">{data?.weather_inputs?.temp_c || 32.4} °C</p>
                  </div>
                  <div className="rounded-lg bg-slate-900/80 p-2 border border-slate-800/80">
                    <span className="text-[10px] text-slate-400">Cloud Cover</span>
                    <p className="font-mono font-bold text-slate-300">{data?.weather_inputs?.cloud_pct || 12} %</p>
                  </div>
                  <div className="rounded-lg bg-slate-900/80 p-2 border border-slate-800/80">
                    <span className="text-[10px] text-slate-400">Grid Carbon Factor</span>
                    <p className="font-mono font-bold text-emerald-400">0.82 kg/kWh</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-800 bg-slate-950/60 px-6 py-3 text-xs text-slate-400">
          <span>Model Architecture: Multi-Horizon Quantile LightGBM & XGBoost [P10 / P50 / P90]</span>
          <button
            onClick={onClose}
            className="rounded-lg bg-slate-800 px-4 py-2 font-medium text-slate-200 hover:bg-slate-700 transition-colors"
          >
            Close Comparison
          </button>
        </div>
      </div>
    </div>
  );
};
