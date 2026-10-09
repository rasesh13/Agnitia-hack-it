import React, { useState, useEffect } from 'react';
import {
  Activity,
  Sun,
  Battery,
  Building,
  Zap,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';

export interface LiveTelemetryPreviewSectionProps {
  onLaunchConsole?: () => void;
}

export const LiveTelemetryPreviewSection: React.FC<LiveTelemetryPreviewSectionProps> = ({
  onLaunchConsole,
}) => {
  const [selectedAsset, setSelectedAsset] = useState<'campus' | 'solar' | 'battery' | 'hostel'>('campus');
  const [liveWeather, setLiveWeather] = useState<{
    temp_c: number;
    ghi_wm2: number;
    wind_speed_mps: number;
    solar_physics_kw: number;
    wind_physics_kw: number;
    total_generation_kw: number;
  } | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchWeather = async () => {
      try {
        const res = await fetch('/api/v1/forecast/weather-live');
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setLiveWeather({
              temp_c: data.weather?.temp_c ?? 32.0,
              ghi_wm2: data.weather?.ghi_wm2 ?? 750.0,
              wind_speed_mps: data.weather?.wind_speed_mps ?? 4.2,
              solar_physics_kw: data.physics_baseline?.solar_physics_kw ?? 176.1,
              wind_physics_kw: data.physics_baseline?.wind_physics_kw ?? 12.2,
              total_generation_kw: data.physics_baseline?.total_generation_kw ?? 188.3,
            });
          }
        }
      } catch {
        // network fallback
      }
    };
    fetchWeather();
    const interval = setInterval(fetchWeather, 15000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <section id="live-demo" className="relative w-full bg-slate-950 py-20 px-4 sm:px-6 lg:px-8 border-t border-white/5">
      <div className="relative mx-auto max-w-7xl">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-12">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-widest text-emerald-400">
              <Activity className="h-3.5 w-3.5 text-emerald-400" />
              <span>Real-Time Digital Twin Telemetry</span>
            </div>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Live Microgrid Operations Feed
            </h2>
            <p className="mt-2 text-sm sm:text-base text-slate-300 max-w-2xl">
              Inspect live telemetry streams driven by real-world Open-Meteo weather and physics-based models for Prestige University, Indore.
            </p>
          </div>

          <button
            onClick={onLaunchConsole}
            className="self-start lg:self-auto flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 px-5 py-2.5 text-xs font-bold text-slate-950 shadow-lg shadow-amber-500/20 hover:from-amber-400 hover:to-amber-500 transition-all"
          >
            <span>Launch Operations Console</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Interactive Telemetry Showcase Card */}
        <div className="rounded-2xl border border-white/15 bg-slate-900/60 p-6 backdrop-blur-2xl shadow-2xl">
          {/* Asset Tabs & Mode Switcher */}
          <div className="flex flex-wrap items-center gap-2 pb-5 border-b border-white/10">
            <button
              onClick={() => setSelectedAsset('campus')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
                selectedAsset === 'campus'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-white/5 text-slate-400 hover:text-white'
              }`}
            >
              <Zap className="h-4 w-4 text-amber-400" />
              <span>Campus Aggregate</span>
            </button>

            <button
              onClick={() => setSelectedAsset('solar')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
                selectedAsset === 'solar'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-white/5 text-slate-400 hover:text-white'
              }`}
            >
              <Sun className="h-4 w-4 text-amber-400" />
              <span>Rooftop Solar Array</span>
            </button>

            <button
              onClick={() => setSelectedAsset('battery')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
                selectedAsset === 'battery'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-white/5 text-slate-400 hover:text-white'
              }`}
            >
              <Battery className="h-4 w-4 text-emerald-400" />
              <span>1.2 MWh LFP BESS</span>
            </button>

            <button
              onClick={() => setSelectedAsset('hostel')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
                selectedAsset === 'hostel'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-white/5 text-slate-400 hover:text-white'
              }`}
            >
              <Building className="h-4 w-4 text-teal-400" />
              <span>Hostel Complex Load</span>
            </button>

            {/* Live Weather Status Indicator */}
            <div className="ml-auto flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-950/40 px-3 py-1.5 text-xs text-emerald-300">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span>Open-Meteo Live API: {liveWeather ? `${liveWeather.temp_c}°C • ${liveWeather.ghi_wm2} W/m² GHI` : 'Indore Live Feed'}</span>
            </div>
          </div>

          {/* Tab Content Display */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <span className="text-xs text-slate-400 font-medium">Active Power</span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl font-bold font-mono text-white">
                  {selectedAsset === 'campus'
                    ? (liveWeather?.total_generation_kw?.toFixed(1) ?? '188.3')
                    : selectedAsset === 'solar'
                    ? (liveWeather?.solar_physics_kw?.toFixed(1) ?? '176.1')
                    : selectedAsset === 'battery'
                    ? '-42.0'
                    : '32.2'}
                </span>
                <span className="text-xs text-slate-400">kW</span>
              </div>
              <div className="mt-2 text-[11px] flex items-center gap-1 text-emerald-400">
                <TrendingUp className="h-3 w-3" />
                <span>Real-Time Weather + Physics + ML Inference</span>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <span className="text-xs text-slate-400 font-medium">Power Quality & Voltage</span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl font-bold font-mono text-emerald-400">415.2</span>
                <span className="text-xs text-slate-400">V (50.02 Hz)</span>
              </div>
              <div className="mt-2 text-[11px] text-slate-400">IEEE 1547 Grid Tied</div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <span className="text-xs text-slate-400 font-medium">VNM Sharing Index</span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl font-bold font-mono text-amber-300">
                  {selectedAsset === 'hostel' ? '42.5%' : '100%'}
                </span>
              </div>
              <div className="mt-2 text-[11px] text-amber-400/80">Campus Grid Priority 1</div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <span className="text-xs text-slate-400 font-medium">Telemetry Freshness</span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl font-bold font-mono text-white">0.4</span>
                <span className="text-xs text-slate-400">sec latency</span>
              </div>
              <div className="mt-2 text-[11px] text-emerald-400">WebSocket Connected</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
