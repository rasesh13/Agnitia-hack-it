import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Zap,
  BatteryCharging,
  Sparkles,
  ShieldCheck,
  Cpu,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DispatchData {
  action: string;
  targetAsset: string;
  setpointKw: number;
  reasoning: string;
  confidenceScore: number;
  batterySoc: number;
  totalGenerationKw: number;
  gridExchangeKw: number;
  expectedSavingsInr: number;
  cycleTimestamp: string;
}

export interface DispatchCardProps {
  className?: string;
  data?: DispatchData | null;
  isLoading?: boolean;
  onOpenReasoning?: () => void;
}

const DEFAULT_DISPATCH: DispatchData = {
  action: 'BESS PRE-CHARGE & VNM OPTIMIZE',
  targetAsset: 'LFP-BESS-01 (1.2 MWh)',
  setpointKw: 120,
  reasoning:
    'Solar forecast projects 22% cloud attenuation at 14:15. Dispatching +120 kW into BESS to lock 88% SoC before evening Time-of-Day peak tariff window.',
  confidenceScore: 99.2,
  batterySoc: 78.4,
  totalGenerationKw: 384.6,
  gridExchangeKw: -42.0, // Exporting
  expectedSavingsInr: 12450,
  cycleTimestamp: 'Cycle #8492 • 12s ago',
};

export const DispatchCard: React.FC<DispatchCardProps> = ({
  className,
  data = DEFAULT_DISPATCH,
  isLoading = false,
  onOpenReasoning,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const currentData = data || DEFAULT_DISPATCH;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{
        opacity: 1,
        y: shouldReduceMotion ? 0 : [0, -8, 0],
      }}
      transition={{
        opacity: { duration: 0.7, delay: 0.15, ease: 'easeOut' },
        y: {
          duration: 6,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 0.5,
        },
      }}
      className={cn(
        'relative overflow-hidden rounded-2xl border border-white/15 bg-slate-900/70 p-5 shadow-2xl shadow-black/50 backdrop-blur-md transition-all hover:border-amber-400/50 hover:bg-slate-900/85',
        className
      )}
    >
      {/* Top Gradient Highlight */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-amber-500/20 via-amber-400 to-emerald-400/30" />

      {/* Skeleton Loading State */}
      {isLoading ? (
        <div className="space-y-4 animate-pulse">
          <div className="flex items-center justify-between">
            <div className="h-5 w-32 rounded-md bg-slate-800" />
            <div className="h-5 w-20 rounded-full bg-slate-800" />
          </div>
          <div className="h-14 rounded-xl bg-slate-800/60" />
          <div className="grid grid-cols-3 gap-2">
            <div className="h-12 rounded-xl bg-slate-800/40" />
            <div className="h-12 rounded-xl bg-slate-800/40" />
            <div className="h-12 rounded-xl bg-slate-800/40" />
          </div>
          <div className="h-9 rounded-full bg-slate-800" />
        </div>
      ) : (
        <>
          {/* Card Header */}
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500/20 to-emerald-500/20 border border-amber-400/30 text-amber-400">
                <Cpu className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-white">
                    LIVE VPP Dispatch
                  </span>
                  <span className="inline-flex items-center rounded-md bg-amber-400/10 px-1.5 py-0.5 text-[9px] font-semibold text-amber-400 border border-amber-400/20">
                    AI Auto
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 font-mono">
                  {currentData.cycleTimestamp}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
              <ShieldCheck className="h-3 w-3" />
              <span>{currentData.confidenceScore}% conf</span>
            </div>
          </div>

          {/* AI Reasoning Box */}
          <div className="mt-3.5 rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-transparent p-3">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-amber-400">
              <Sparkles className="h-3 w-3 text-amber-400 animate-pulse" />
              <span>Dispatch Decision Policy</span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-200 font-normal line-clamp-3">
              {currentData.reasoning}
            </p>
          </div>

          {/* Real-time Telemetry Metrics Grid */}
          <div className="mt-3 grid grid-cols-3 gap-2">
            {/* Generation */}
            <div className="rounded-xl border border-white/5 bg-white/[0.03] p-2.5">
              <span className="text-[10px] text-slate-400 block font-medium">Yield</span>
              <div className="mt-0.5 flex items-baseline gap-0.5">
                <span className="text-sm font-bold text-emerald-400 font-mono">
                  {currentData.totalGenerationKw.toFixed(0)}
                </span>
                <span className="text-[10px] text-slate-400 font-sans">kW</span>
              </div>
            </div>

            {/* Battery SoC */}
            <div className="rounded-xl border border-white/5 bg-white/[0.03] p-2.5">
              <div className="flex items-center gap-1 text-[10px] text-slate-400">
                <BatteryCharging className="h-3 w-3 text-amber-400" />
                <span>BESS SoC</span>
              </div>
              <div className="mt-0.5 flex items-baseline gap-0.5">
                <span className="text-sm font-bold text-white font-mono">
                  {currentData.batterySoc.toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Grid Exchange */}
            <div className="rounded-xl border border-white/5 bg-white/[0.03] p-2.5">
              <div className="flex items-center gap-1 text-[10px] text-slate-400">
                <Zap className="h-3 w-3 text-teal-400" />
                <span>Net Grid</span>
              </div>
              <div className="mt-0.5 flex items-baseline gap-0.5">
                <span className="text-sm font-bold text-teal-300 font-mono">
                  {currentData.gridExchangeKw < 0 ? 'Export' : 'Import'}
                </span>
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="mt-3.5 pt-2 flex items-center justify-between border-t border-white/10">
            <div className="text-[11px] text-slate-300 font-mono">
              Savings: <span className="font-semibold text-emerald-400">₹{currentData.expectedSavingsInr.toLocaleString('en-IN')}/d</span>
            </div>

            <button
              onClick={onOpenReasoning}
              className="group flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-md transition-all hover:bg-amber-500 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-amber-400"
              aria-label="View Full AI Reasoning Trail"
            >
              <span>View Reasoning</span>
              <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </>
      )}
    </motion.div>
  );
};
