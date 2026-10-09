import React, { useState } from 'react';
import { DecisionLog, DecisionType } from '../types';
import {
  Zap,
  Battery,
  Building2,
  TrendingUp,
  Leaf,
  ChevronDown,
  ChevronUp,
  Cpu,
  Clock,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

interface DecisionCardProps {
  decision: DecisionLog;
  onViewAlternatives?: (cycleId: string) => void;
}

export const DecisionCard: React.FC<DecisionCardProps> = ({ decision, onViewAlternatives }) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  const getTypeBadge = (type: DecisionType) => {
    const styles: Record<DecisionType, { bg: string; text: string; icon: React.ReactNode }> = {
      dispatch: {
        bg: 'bg-emerald-500/10 border-emerald-500/30',
        text: 'text-emerald-400',
        icon: <Zap className="h-3.5 w-3.5" />,
      },
      battery: {
        bg: 'bg-purple-500/10 border-purple-500/30',
        text: 'text-purple-400',
        icon: <Battery className="h-3.5 w-3.5" />,
      },
      vnm_allocation: {
        bg: 'bg-cyan-500/10 border-cyan-500/30',
        text: 'text-cyan-400',
        icon: <Building2 className="h-3.5 w-3.5" />,
      },
      load_shift: {
        bg: 'bg-amber-500/10 border-amber-500/30',
        text: 'text-amber-400',
        icon: <TrendingUp className="h-3.5 w-3.5" />,
      },
      reliability: {
        bg: 'bg-rose-500/10 border-rose-500/30',
        text: 'text-rose-400',
        icon: <AlertCircle className="h-3.5 w-3.5" />,
      },
    };

    const current = styles[type] || styles.dispatch;

    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${current.bg} ${current.text}`}
      >
        {current.icon}
        {type.replace('_', ' ')}
      </span>
    );
  };

  const formattedAction = decision.action.replace(/_/g, ' ');

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg backdrop-blur-sm transition-all hover:border-slate-700">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-3">
          {getTypeBadge(decision.decision_type)}
          <h3 className="text-sm font-bold text-white capitalize">{formattedAction}</h3>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1 font-mono">
            <Clock className="h-3.5 w-3.5 text-slate-500" />
            {new Date(decision.created_at).toLocaleTimeString()}
          </span>
          <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-slate-300">
            Confidence: {(decision.confidence * 100).toFixed(0)}%
          </span>
        </div>
      </div>

      {/* Main Rationale Paragraph */}
      <div className="mt-3">
        <p className="text-xs text-slate-300 leading-relaxed font-sans">
          {(decision.reason || '').replace(/[?]1/g, '₹')}
        </p>
      </div>

      {/* Impact & Allocation Metrics */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 text-xs">
        {decision.target_asset_id && (
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-2.5">
            <div className="text-[10px] uppercase font-bold text-slate-500">Target Asset</div>
            <div className="text-xs font-mono font-bold text-slate-200 mt-0.5 truncate">
              {decision.target_asset_id}
            </div>
          </div>
        )}

        {decision.setpoint_kw !== null && decision.setpoint_kw !== undefined && (
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-2.5">
            <div className="text-[10px] uppercase font-bold text-slate-500">Target Setpoint</div>
            <div className="text-xs font-bold text-white mt-0.5">{decision.setpoint_kw.toFixed(1)} kW</div>
          </div>
        )}

        {decision.expected_savings_inr !== null && decision.expected_savings_inr !== undefined && (
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-2.5">
            <div className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-emerald-400" />
              <span>Projected Savings</span>
            </div>
            <div className="text-xs font-bold text-emerald-400 mt-0.5">
              +INR {decision.expected_savings_inr.toFixed(2)}
            </div>
          </div>
        )}

        {decision.carbon_impact_kg !== null && decision.carbon_impact_kg !== undefined && (
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-2.5">
            <div className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
              <Leaf className="h-3 w-3 text-blue-400" />
              <span>Carbon Delta</span>
            </div>
            <div className="text-xs font-bold text-blue-400 mt-0.5">
              {decision.carbon_impact_kg.toFixed(2)} kg
            </div>
          </div>
        )}
      </div>

      {/* Expandable Section Toggle */}
      <div className="mt-3 flex items-center justify-between border-t border-slate-800/60 pt-2 text-xs">
        <div className="flex items-center gap-2">
          {onViewAlternatives && (
            <button
              onClick={() => onViewAlternatives(decision.cycle_id)}
              className="flex items-center gap-1 text-[11px] font-semibold text-purple-400 hover:text-purple-300 hover:underline"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              <span>View Candidate Alternatives</span>
            </button>
          )}
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-slate-200"
        >
          <span>{isExpanded ? 'Hide Details' : 'Show Commands & Audit'}</span>
          {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Expanded Audit Details */}
      {isExpanded && (
        <div className="mt-3 space-y-3 rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-xs font-mono">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-400">
            <div>Decision ID: <span className="text-slate-200">{decision.id}</span></div>
            <div>Cycle ID: <span className="text-slate-200">{decision.cycle_id}</span></div>
            <div>Actor: <span className="text-slate-200">{decision.actor}</span></div>
            <div>Allocated kWh: <span className="text-slate-200">{decision.allocated_kwh ?? 'N/A'}</span></div>
          </div>

          {/* Control Commands Issued */}
          {decision.commands && decision.commands.length > 0 && (
            <div className="border-t border-slate-800 pt-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                Dispatched Control Commands ({decision.commands.length})
              </div>
              <div className="space-y-2">
                {decision.commands.map((cmd) => (
                  <div
                    key={cmd.id}
                    className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/60 p-2.5 text-[11px]"
                  >
                    <div className="flex items-center gap-2">
                      <Cpu className="h-3.5 w-3.5 text-slate-500" />
                      <span className="font-bold text-white">{cmd.action}</span>
                      <span className="text-slate-400">to {cmd.target_asset_id}</span>
                      <span className="text-emerald-400">({cmd.requested_setpoint} {cmd.unit})</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] uppercase font-bold text-emerald-300">
                        {cmd.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
