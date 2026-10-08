import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Cpu,
  Sparkles,
  ShieldCheck,
  TrendingDown,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { DispatchData } from './DispatchCard';

export interface ReasoningModalProps {
  isOpen: boolean;
  onClose: () => void;
  data?: DispatchData | null;
}

export const ReasoningModal: React.FC<ReasoningModalProps> = ({
  isOpen,
  onClose,
  data,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: 'spring', damping: 25, stiffness: 260 }}
          className="relative w-full max-w-2xl rounded-2xl border border-white/20 bg-slate-900/95 p-6 shadow-2xl backdrop-blur-2xl text-slate-100 z-10 my-8"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reasoning-modal-title"
        >
          {/* Header */}
          <div className="flex items-start justify-between pb-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500/20 to-emerald-500/20 text-amber-400 border border-amber-500/30">
                <Cpu className="h-5 w-5" />
              </div>
              <div>
                <h3
                  id="reasoning-modal-title"
                  className="text-lg font-bold text-white tracking-tight flex items-center gap-2"
                >
                  <span>AI Dispatch Optimization Reasoning</span>
                  <span className="rounded-md bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold text-amber-400 border border-amber-400/20">
                    Cycle #8492
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  Real-time Explainable Decision Engine • WebSocket Telemetry
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
              aria-label="Close dialog"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Reasoning Narrative */}
          <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-300">
              <Sparkles className="h-4 w-4 text-amber-400" />
              <span>Executive Optimization Rationale</span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-slate-200">
              {data?.reasoning ||
                'Solar forecast projects 22% cloud attenuation at 14:15. Dispatching +120 kW into BESS to lock 88% SoC before evening Time-of-Day peak tariff window. Academic blocks A & B prioritized under VNM Rule 4.'}
            </p>
          </div>

          {/* Decision Breakdown Metrics */}
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <span>Confidence</span>
              </div>
              <div className="mt-1 text-lg font-bold text-white font-mono">
                {data?.confidenceScore || 99.2}%
              </div>
              <div className="text-[10px] text-emerald-400">Deterministic Safety Pass</div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <TrendingDown className="h-4 w-4 text-amber-400" />
                <span>Est. Savings</span>
              </div>
              <div className="mt-1 text-lg font-bold text-amber-300 font-mono">
                ₹{(data?.expectedSavingsInr || 12450).toLocaleString('en-IN')}
              </div>
              <div className="text-[10px] text-slate-400">Peak Arbitrage Delta</div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 col-span-2 sm:col-span-1">
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Clock className="h-4 w-4 text-teal-400" />
                <span>Execution Horizon</span>
              </div>
              <div className="mt-1 text-lg font-bold text-teal-300 font-mono">300s (5m)</div>
              <div className="text-[10px] text-slate-400">Closed-Loop Auto Dispatch</div>
            </div>
          </div>

          {/* Multi-Objective Optimization Matrix */}
          <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Multi-Objective Weights & Guardrails
            </h4>
            <div className="mt-3 space-y-2.5 text-xs">
              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>ToD Tariff Minimization (Cost Weight)</span>
                  <span className="font-mono text-amber-400 font-semibold">65%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full bg-amber-400 rounded-full" style={{ width: '65%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Carbon Reduction & Clean Self-Consumption</span>
                  <span className="font-mono text-emerald-400 font-semibold">35%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full bg-emerald-400 rounded-full" style={{ width: '35%' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Audit & Verification Footer */}
          <div className="mt-5 flex items-center justify-between pt-4 border-t border-white/10 text-xs text-slate-400">
            <div className="flex items-center gap-1.5 text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              <span>Automated AI Dispatch Guardrails Verified</span>
            </div>
            <button
              onClick={onClose}
              className="rounded-full bg-slate-800 hover:bg-slate-700 px-4 py-1.5 text-xs font-semibold text-white transition-colors"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
