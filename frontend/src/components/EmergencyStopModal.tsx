import React, { useState } from 'react';
import { ShieldAlert, ShieldCheck, X, AlertTriangle } from 'lucide-react';

interface EmergencyStopModalProps {
  isOpen: boolean;
  isEmergencyStopActive: boolean;
  onConfirm: (active: boolean, reason: string) => Promise<void>;
  onClose: () => void;
  isLoading?: boolean;
}

export const EmergencyStopModal: React.FC<EmergencyStopModalProps> = ({
  isOpen,
  isEmergencyStopActive,
  onConfirm,
  onClose,
  isLoading = false,
}) => {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const targetAction = !isEmergencyStopActive; // true if we want to engage, false if we want to disengage

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Please provide a mandatory operational reason for the audit log.');
      return;
    }
    setError(null);
    try {
      await onConfirm(targetAction, reason.trim());
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Action failed';
      setError(msg);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div
              className={`rounded-2xl p-2.5 ${
                targetAction
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              }`}
            >
              {targetAction ? <ShieldAlert className="h-6 w-6" /> : <ShieldCheck className="h-6 w-6" />}
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">
                {targetAction ? 'Engage Emergency Stop' : 'Resume Automated Operation'}
              </h3>
              <p className="text-xs text-slate-400">
                {targetAction
                  ? 'Critical Safety Interlock Confirmation'
                  : 'Return to Closed-Loop Optimization'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Warning Body */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div
            className={`rounded-2xl border p-4 text-xs ${
              targetAction
                ? 'border-rose-500/40 bg-rose-500/10 text-rose-200'
                : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
            }`}
          >
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">
                  {targetAction
                    ? 'Immediate Execution Interlock Notice:'
                    : 'System Restoration Notice:'}
                </p>
                <p className="text-[11px] opacity-90">
                  {targetAction
                    ? 'Engaging Emergency Stop will immediately halt all automated BESS discharge commands, freeze inverter setpoints, switch the optimizer to Advisory-Only mode, and record a high-priority system audit event.'
                    : 'Resuming automation will re-enable closed-loop inverter commands and dispatch scheduled decision cycles according to active control policy weights.'}
                </p>
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Operational Justification (Mandatory for Audit Trail)
            </label>
            <textarea
              rows={3}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                targetAction
                  ? 'e.g. Utility grid voltage excursion, substation physical maintenance, or emergency load isolation.'
                  : 'e.g. Maintenance complete, grid voltage normalized, resumed normal peak-shaving operations.'
              }
              className="w-full rounded-xl border border-slate-700 bg-slate-950/80 p-3 text-xs text-slate-200 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isLoading}
              className={`flex items-center gap-2 rounded-xl px-5 py-2 text-xs font-bold text-white shadow-lg transition-all active:scale-95 disabled:opacity-50 ${
                targetAction
                  ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/30'
                  : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'
              }`}
            >
              {targetAction ? (
                <>
                  <ShieldAlert className="h-4 w-4" />
                  <span>{isLoading ? 'Engaging...' : 'CONFIRM EMERGENCY STOP'}</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" />
                  <span>{isLoading ? 'Resuming...' : 'RESUME AUTOMATION'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
