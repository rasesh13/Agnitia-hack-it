import React, { useState, useEffect } from 'react';
import { VNMSharingRule } from '../types';
import { CheckCircle2, AlertTriangle, Scale, Save, Sparkles } from 'lucide-react';

interface VNMConfigFormProps {
  initialRules: VNMSharingRule[];
  onSave: (updatedRules: VNMSharingRule[]) => Promise<void>;
  isSaving?: boolean;
}

export const VNMConfigForm: React.FC<VNMConfigFormProps> = ({
  initialRules,
  onSave,
  isSaving = false,
}) => {
  const [rules, setRules] = useState<VNMSharingRule[]>(initialRules);
  const [feedback, setFeedback] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    setRules(initialRules);
  }, [initialRules]);

  const handleRatioChange = (id: number, newRatioPct: number) => {
    const ratio = Math.max(0, Math.min(100, newRatioPct)) / 100;
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, sharing_ratio: ratio } : r))
    );
  };

  const totalRatio = rules.reduce((acc, r) => acc + r.sharing_ratio, 0);
  const totalPercent = totalRatio * 100;
  const isBalanced = Math.abs(totalRatio - 1.0) <= 0.001;

  const handleAutoBalance = () => {
    if (rules.length === 0) return;
    const currentSum = rules.reduce((acc, r) => acc + (r.sharing_ratio || 1), 0);
    const normalized = rules.map((r) => ({
      ...r,
      sharing_ratio: (r.sharing_ratio || 1) / currentSum,
    }));
    setRules(normalized);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isBalanced) {
      setFeedback({
        success: false,
        message: `Sharing ratios must sum exactly to 100.0%. Current sum: ${totalPercent.toFixed(1)}%.`,
      });
      return;
    }

    try {
      await onSave(rules);
      setFeedback({
        success: true,
        message: 'Virtual Net Metering sharing rules saved and validated successfully!',
      });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save VNM rules';
      setFeedback({
        success: false,
        message: msg,
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Allocation Summary Card */}
      <div
        className={`flex flex-col gap-3 rounded-2xl border p-4 transition-all sm:flex-row sm:items-center sm:justify-between ${
          isBalanced
            ? 'border-emerald-500/40 bg-emerald-500/10'
            : 'border-amber-500/40 bg-amber-500/10'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`rounded-xl p-2 ${
              isBalanced
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'bg-amber-500/20 text-amber-400'
            }`}
          >
            <Scale className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">VNM Distribution Integrity</h4>
            <p className="text-xs text-slate-300">
              Regulatory mandate: Aggregated solar generation must sum to 100.0% allocation.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[10px] uppercase font-bold text-slate-400">Total Sum</div>
            <div
              className={`font-mono text-lg font-bold ${
                isBalanced ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {totalPercent.toFixed(1)}%
            </div>
          </div>

          <button
            type="button"
            onClick={handleAutoBalance}
            className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/90 px-3 py-1.5 text-xs font-semibold text-slate-200 transition-all hover:bg-slate-700 shadow-sm"
          >
            <Sparkles className="h-3.5 w-3.5 text-purple-400" />
            <span>Auto-Balance</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`flex items-start gap-2.5 rounded-xl border p-3 text-xs ${
            feedback.success
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
              : 'border-rose-500/40 bg-rose-500/10 text-rose-300'
          }`}
        >
          {feedback.success ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Buildings Matrix */}
      <div className="space-y-3">
        {rules.map((rule) => {
          const pct = Math.round(rule.sharing_ratio * 1000) / 10;
          return (
            <div
              key={rule.id}
              className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="text-sm font-bold text-slate-200 capitalize">
                  {rule.building_asset_id.replace('_', ' ')}
                </div>
                <div className="text-xs font-mono text-slate-500 mt-0.5">
                  ID: {rule.building_asset_id} • Version {rule.rule_version}
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={pct}
                    onChange={(e) => handleRatioChange(rule.id, parseFloat(e.target.value))}
                    className="h-2 w-32 cursor-pointer appearance-none rounded-lg bg-slate-800 accent-emerald-500"
                  />
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={pct}
                      onChange={(e) => handleRatioChange(rule.id, parseFloat(e.target.value) || 0)}
                      className="w-16 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-right font-mono text-xs font-bold text-slate-200 focus:border-emerald-500 focus:outline-none"
                    />
                    <span className="text-xs text-slate-400">%</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Save Button */}
      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={isSaving || !isBalanced}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-2.5 text-xs font-bold text-slate-950 shadow-md shadow-emerald-500/20 transition-all hover:from-emerald-400 hover:to-teal-400 active:scale-95 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          <span>{isSaving ? 'Saving Rules...' : 'Save VNM Sharing Rules'}</span>
        </button>
      </div>
    </form>
  );
};
