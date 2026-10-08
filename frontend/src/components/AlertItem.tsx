import React from 'react';
import { SystemAlert } from '../types';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  Clock,
  Check,
} from 'lucide-react';

interface AlertItemProps {
  alert: SystemAlert;
  onAcknowledge?: (id: string) => void;
  isAcknowledging?: boolean;
}

export const AlertItem: React.FC<AlertItemProps> = ({
  alert,
  onAcknowledge,
  isAcknowledging = false,
}) => {
  const getSeverityConfig = () => {
    switch (alert.severity) {
      case 'critical':
        return {
          border: 'border-rose-500/40 bg-rose-500/10',
          text: 'text-rose-400',
          badge: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
          icon: AlertCircle,
        };
      case 'warning':
        return {
          border: 'border-amber-500/40 bg-amber-500/10',
          text: 'text-amber-400',
          badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
          icon: AlertTriangle,
        };
      case 'info':
      default:
        return {
          border: 'border-blue-500/40 bg-blue-500/10',
          text: 'text-blue-400',
          badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
          icon: Info,
        };
    }
  };

  const config = getSeverityConfig();
  const Icon = config.icon;

  const formattedDate = new Date(alert.created_at).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div
      className={`flex flex-col gap-3 rounded-2xl border p-4 transition-all duration-200 ${
        alert.is_acknowledged
          ? 'border-slate-800 bg-slate-900/40 opacity-75'
          : `${config.border} shadow-lg shadow-black/20`
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 rounded-xl p-2 ${config.badge}`}>
            <Icon className={`h-4 w-4 ${config.text}`} />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-sm font-bold text-white">{alert.title}</h4>
              <span
                className={`rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${config.badge}`}
              >
                {alert.severity}
              </span>
              <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-slate-400">
                {alert.source}
              </span>
            </div>

            <p className="mt-1 text-xs text-slate-300">{alert.description}</p>

            {(alert.metric_name || alert.current_value !== undefined) && (
              <div className="mt-2 flex flex-wrap items-center gap-4 text-xs font-mono text-slate-400">
                {alert.metric_name && (
                  <span>
                    Metric: <strong className="text-slate-200">{alert.metric_name}</strong>
                  </span>
                )}
                {alert.current_value !== undefined && (
                  <span>
                    Observed: <strong className="text-amber-400">{alert.current_value}</strong>
                  </span>
                )}
                {alert.threshold_value !== undefined && (
                  <span>
                    Threshold: <strong className="text-slate-300">{alert.threshold_value}</strong>
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Action Button */}
        <div>
          {alert.is_acknowledged ? (
            <span className="flex items-center gap-1 rounded-lg bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="h-3 w-3" />
              Acknowledged
            </span>
          ) : (
            onAcknowledge && (
              <button
                onClick={() => onAcknowledge(alert.id)}
                disabled={isAcknowledging}
                className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 transition-all hover:bg-emerald-600 hover:text-white hover:border-emerald-500 disabled:opacity-50 shadow-sm"
              >
                <Check className="h-3.5 w-3.5" />
                <span>{isAcknowledging ? 'Saving...' : 'Acknowledge'}</span>
              </button>
            )
          )}
        </div>
      </div>

      {/* Timestamp footer */}
      <div className="flex items-center justify-between border-t border-slate-800/80 pt-2 text-[11px] text-slate-500">
        <div className="flex items-center gap-1.5">
          <Clock className="h-3 w-3" />
          <span>{formattedDate} IST</span>
        </div>
        {alert.is_acknowledged && alert.acknowledged_by && (
          <span>By: {alert.acknowledged_by}</span>
        )}
      </div>
    </div>
  );
};
