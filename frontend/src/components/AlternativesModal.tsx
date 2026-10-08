import React from 'react';
import { DecisionAlternative } from '../types';
import { X, CheckCircle2, XCircle, Sliders, TrendingUp, Leaf } from 'lucide-react';

interface AlternativesModalProps {
  alternatives: DecisionAlternative[];
  cycleId: string;
  onClose: () => void;
}

export const AlternativesModal: React.FC<AlternativesModalProps> = ({
  alternatives,
  cycleId,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <Sliders className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Evaluated Candidate Strategies</h2>
              <p className="text-xs text-slate-400 font-mono">
                Cycle ID: {cycleId} • {alternatives.length} Candidates Scored
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Alternatives List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {alternatives.length > 0 ? (
            alternatives.map((alt) => (
              <div
                key={alt.id}
                className={`rounded-2xl border p-4.5 transition-all ${
                  alt.is_selected
                    ? 'border-emerald-500/40 bg-emerald-950/20 shadow-md shadow-emerald-500/10'
                    : 'border-slate-800 bg-slate-950/60'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    {alt.is_selected ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="h-5 w-5 text-slate-500 flex-shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-white">{alt.strategy_description}</h3>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            alt.is_selected
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {alt.is_selected ? 'Selected Candidate' : 'Rejected'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        Candidate ID: {alt.candidate_id}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Score</div>
                    <div className="text-base font-bold text-white mt-0.5">{alt.score.toFixed(2)}</div>
                  </div>
                </div>

                {/* Score Breakdown Pills */}
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <div className="flex items-center gap-1 rounded-lg bg-slate-800/80 px-2.5 py-1 text-slate-300 border border-slate-700/60">
                    <TrendingUp className="h-3 w-3 text-emerald-400" />
                    <span>Cost Score: <b>{alt.cost_component.toFixed(2)}</b></span>
                  </div>
                  <div className="flex items-center gap-1 rounded-lg bg-slate-800/80 px-2.5 py-1 text-slate-300 border border-slate-700/60">
                    <Leaf className="h-3 w-3 text-blue-400" />
                    <span>Carbon Score: <b>{alt.carbon_component.toFixed(2)}</b></span>
                  </div>
                </div>

                {/* Rejection Rationale */}
                {!alt.is_selected && alt.rejected_reason && (
                  <div className="mt-3 rounded-xl border border-slate-800 bg-slate-900/80 p-2.5 text-xs text-slate-300">
                    <span className="font-semibold text-slate-400">Rejection Rationale: </span>
                    <span>{alt.rejected_reason}</span>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="py-12 text-center text-xs text-slate-500">
              No alternative candidates recorded for this decision cycle.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-800 px-6 py-3 bg-slate-950/60 text-xs text-slate-400">
          <span>Objective function balances Economic Yield (w=0.7) & Carbon Intensity (w=0.3)</span>
          <button
            onClick={onClose}
            className="rounded-lg bg-slate-800 px-4 py-1.5 font-semibold text-slate-200 hover:bg-slate-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
