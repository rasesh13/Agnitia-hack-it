import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CloudSun,
  SunMedium,
  Wind,
  Droplets,
  Cpu,
  Building2,
  ShieldCheck,
  Sparkles,
  ChevronRight,
  Scale,
  CheckCircle2,
  Activity,
} from 'lucide-react';
import { DispatchData } from './DispatchCard';

export interface ContextualSlideWidgetProps {
  currentSlideIndex: number;
  liveDispatchData?: DispatchData | null;
  onOpenReasoning?: () => void;
}

export const ContextualSlideWidget: React.FC<ContextualSlideWidgetProps> = ({
  currentSlideIndex,
  liveDispatchData,
  onOpenReasoning,
}) => {
  return (
    <div className="relative w-full max-w-lg">
      <AnimatePresence mode="wait">
        {/* ============================================================ */}
        {/* SLIDE 0: Weather Nowcasting HUD */}
        {/* ============================================================ */}
        {currentSlideIndex === 0 && (
          <motion.div
            key="widget-weather"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.98 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="rounded-2xl border border-white/15 bg-slate-950/40 p-5 backdrop-blur-xl shadow-2xl shadow-black/60 transition-all hover:border-amber-400/40 hover:bg-slate-950/55"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <CloudSun className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-white">
                    Live Micro-Climate Nowcasting
                  </div>
                  <div className="text-[10px] text-slate-300 font-mono">
                    Rajasthan DTE • Academic Site 01
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-medium text-emerald-400">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                <span className="font-mono">LIVE 1s</span>
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="mt-3.5 grid grid-cols-4 gap-2 text-slate-200">
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5 text-center">
                <div className="flex items-center justify-center gap-1 text-[10px] text-slate-300">
                  <SunMedium className="h-3 w-3 text-amber-400" />
                  <span>Ambient</span>
                </div>
                <div className="mt-1 text-sm font-bold text-white font-mono">33.8°C</div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5 text-center">
                <div className="flex items-center justify-center gap-1 text-[10px] text-slate-300">
                  <CloudSun className="h-3 w-3 text-teal-400" />
                  <span>Cloud</span>
                </div>
                <div className="mt-1 text-sm font-bold text-white font-mono">12%</div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5 text-center">
                <div className="flex items-center justify-center gap-1 text-[10px] text-slate-300">
                  <Wind className="h-3 w-3 text-sky-400" />
                  <span>Wind</span>
                </div>
                <div className="mt-1 text-sm font-bold text-white font-mono">18.4 km/h</div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5 text-center">
                <div className="flex items-center justify-center gap-1 text-[10px] text-slate-300">
                  <Droplets className="h-3 w-3 text-teal-400" />
                  <span>Humidity</span>
                </div>
                <div className="mt-1 text-sm font-bold text-teal-300 font-mono">34%</div>
              </div>
            </div>

            {/* Forecast callout */}
            <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-2.5 text-xs text-slate-200 flex items-start gap-2">
              <Activity className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
              <span>
                <b>Solar AI Nowcast:</b> High irradiance (940 W/m²) detected. BESS ramp-up pre-charge initiated to store 1.2 MWh surplus.
              </span>
            </div>
          </motion.div>
        )}

        {/* ============================================================ */}
        {/* SLIDE 1: Campus Buildings Digital Twin HUD */}
        {/* ============================================================ */}
        {currentSlideIndex === 1 && (
          <motion.div
            key="widget-resilience"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.98 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="rounded-2xl border border-white/15 bg-slate-950/40 p-5 backdrop-blur-xl shadow-2xl shadow-black/60 transition-all hover:border-emerald-400/40 hover:bg-slate-950/55"
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <Building2 className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-white">
                    Campus Digital Twin Telemetry
                  </div>
                  <div className="text-[10px] text-slate-300 font-mono">
                    4 Critical Zones Connected
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-medium text-emerald-400">
                <ShieldCheck className="h-3 w-3" />
                <span>100% Uptime SLA</span>
              </div>
            </div>

            {/* Building Load Items */}
            <div className="mt-3 space-y-2 text-xs">
              <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.03] p-2 px-3">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  <span className="font-medium text-white">Academic Complex</span>
                </div>
                <div className="font-mono text-emerald-300 font-semibold">124 kW • 100% Solar</div>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.03] p-2 px-3">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-amber-400" />
                  <span className="font-medium text-white">Computing & Server Labs</span>
                </div>
                <div className="font-mono text-amber-300 font-semibold">86 kW • Tier-1 Priority</div>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.03] p-2 px-3">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-teal-400" />
                  <span className="font-medium text-white">Hostel Residences</span>
                </div>
                <div className="font-mono text-teal-300 font-semibold">142 kW • VNM Allocated</div>
              </div>
            </div>

            <div className="mt-3 text-[11px] text-slate-300 flex items-center justify-between pt-2 border-t border-white/10">
              <span>Islanding Protection: <b className="text-emerald-400 font-mono">ARMED</b></span>
              <span className="text-slate-400">Dynamic VNM Priority 1</span>
            </div>
          </motion.div>
        )}

        {/* ============================================================ */}
        {/* SLIDE 2: Live Dispatch & Explainable AI HUD */}
        {/* ============================================================ */}
        {currentSlideIndex === 2 && (
          <motion.div
            key="widget-dispatch"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.98 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="rounded-2xl border border-white/15 bg-slate-950/40 p-5 backdrop-blur-xl shadow-2xl shadow-black/60 transition-all hover:border-amber-400/40 hover:bg-slate-950/55"
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <Cpu className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-white">
                      LIVE VPP Dispatch
                    </span>
                    <span className="rounded bg-amber-400/10 px-1.5 py-0.2 text-[9px] font-bold text-amber-400 border border-amber-400/20">
                      AI Auto
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-300 font-mono">
                    {liveDispatchData?.cycleTimestamp || 'Cycle #8492 • Live 5m sync'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                <ShieldCheck className="h-3 w-3" />
                <span>99.2% conf</span>
              </div>
            </div>

            {/* Decision Policy Box */}
            <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-slate-200">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-400">
                <Sparkles className="h-3 w-3 text-amber-400" />
                <span>Real-Time Rationale</span>
              </div>
              <p className="mt-1 text-xs text-slate-200 leading-relaxed">
                {liveDispatchData?.reasoning ||
                  'Dispatching +120 kW into BESS to lock 88% SoC before evening peak tariff window.'}
              </p>
            </div>

            {/* Metrics */}
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-xl border border-white/5 bg-white/[0.03] p-2">
                <div className="text-[10px] text-slate-400">Yield</div>
                <div className="mt-0.5 font-bold font-mono text-emerald-400">385 kW</div>
              </div>
              <div className="rounded-xl border border-white/5 bg-white/[0.03] p-2">
                <div className="text-[10px] text-slate-400">BESS SoC</div>
                <div className="mt-0.5 font-bold font-mono text-amber-300">78.4%</div>
              </div>
              <div className="rounded-xl border border-white/5 bg-white/[0.03] p-2">
                <div className="text-[10px] text-slate-400">Grid Net</div>
                <div className="mt-0.5 font-bold font-mono text-teal-300">Export</div>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-3 flex items-center justify-between pt-2 border-t border-white/10">
              <span className="text-xs font-mono text-slate-300">
                Savings: <b className="text-emerald-400 font-semibold">₹12,450/d</b>
              </span>
              <button
                onClick={onOpenReasoning}
                className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-500 hover:text-slate-950 transition-all"
              >
                <span>View Full Reasoning</span>
                <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          </motion.div>
        )}

        {/* ============================================================ */}
        {/* SLIDE 3: Autonomous Microgrid & Ledger HUD                   */}
        {/* ============================================================ */}
        {currentSlideIndex === 3 && (
          <motion.div
            key="widget-autonomy"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.98 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="rounded-2xl border border-white/15 bg-slate-950/40 p-5 backdrop-blur-xl shadow-2xl shadow-black/60 transition-all hover:border-teal-400/40 hover:bg-slate-950/55"
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30">
                  <Scale className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-white">
                    Campus Microgrid Autonomy
                  </div>
                  <div className="text-[10px] text-slate-300 font-mono">
                    Virtual Net Metering Ledger
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 rounded-full border border-teal-500/30 bg-teal-500/15 px-2.5 py-0.5 text-[10px] font-medium text-teal-300">
                <CheckCircle2 className="h-3 w-3" />
                <span>Synchronized</span>
              </div>
            </div>

            <div className="mt-3 space-y-2 text-xs">
              <div className="rounded-xl border border-white/5 bg-white/[0.03] p-2.5">
                <div className="flex justify-between text-slate-300 font-medium">
                  <span>15-Minute Settlement Interval</span>
                  <span className="text-amber-300 font-mono font-bold">Active Sync</span>
                </div>
                <div className="mt-1 text-[11px] text-slate-400">
                  Automated energy banking sync with DISCOM SCADA interfaces.
                </div>
              </div>

              <div className="rounded-xl border border-white/5 bg-white/[0.03] p-2.5">
                <div className="flex justify-between text-slate-300 font-medium">
                  <span>Carbon Credit Verification</span>
                  <span className="text-emerald-300 font-mono font-bold">480 MT / yr</span>
                </div>
                <div className="mt-1 text-[11px] text-slate-400">
                  Cryptographically verified clean energy generation audit trail.
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between pt-2 border-t border-white/10 text-xs text-slate-400">
              <span>DISCOM: JVVNL / AVVNL / JdVVNL</span>
              <span className="text-emerald-400 font-medium">Telemetry Connected</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
