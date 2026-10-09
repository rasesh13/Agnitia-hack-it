import React, { useState, useEffect, useCallback } from 'react';
import { apiDecisions } from '../services/api';
import { DecisionAlternative, DecisionLog, DecisionStats } from '../types';
import { DecisionCard } from '../components/DecisionCard';
import { AlternativesModal } from '../components/AlternativesModal';
import {
  Zap,
  TrendingUp,
  Leaf,
  Filter,
  RefreshCw,
  Sliders,
  Layers,
  Loader2,
  ChevronDown,
} from 'lucide-react';

const PAGE_SIZE = 10;

export const Optimizer: React.FC = () => {
  const [decisions, setDecisions] = useState<DecisionLog[]>([]);
  const [stats, setStats] = useState<DecisionStats | null>(null);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  const [modalAlternatives, setModalAlternatives] = useState<DecisionAlternative[]>([]);
  const [visibleCount, setVisibleCount] = useState<number>(PAGE_SIZE);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [decisionList, statsData] = await Promise.all([
        apiDecisions.listDecisions({
          siteId: 1,
          limit: 100,
          decisionType: selectedType !== 'all' ? selectedType : undefined,
        }),
        apiDecisions.getDecisionStats({ siteId: 1 }),
      ]);
      setDecisions(decisionList);
      setStats(statsData);
    } catch {
      // Ignore initial load error
    } finally {
      setIsLoading(false);
    }
  }, [selectedType]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Start from the newest page whenever the filter changes.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [selectedType]);

  const handleOpenAlternatives = async (cycleId: string) => {
    setSelectedCycleId(cycleId);
    try {
      const cycle = await apiDecisions.getLatestCycle(1);
      if (cycle && cycle.alternatives) {
        setModalAlternatives(cycle.alternatives);
      }
    } catch {
      setModalAlternatives([]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Optimizer & Decision Audit Timeline</h1>
          <p className="mt-1 text-xs text-slate-400">
            Explainable energy routing, battery scheduling, and virtual net metering allocation rationales
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={isLoading}
          className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-1.5 text-xs font-semibold text-slate-200 transition-all hover:bg-slate-700 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh History</span>
        </button>
      </div>

      {/* Aggregate Impact Banner */}
      {stats && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex items-center gap-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Optimization Actions</div>
              <div className="text-2xl font-bold text-white mt-0.5">{stats.total_decisions} Decisions</div>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Cumulative Savings</div>
              <div className="text-2xl font-bold text-emerald-400 mt-0.5">INR {stats.total_savings_inr.toFixed(2)}</div>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <Leaf className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">CO₂ Avoided</div>
              <div className="text-2xl font-bold text-blue-400 mt-0.5">{stats.total_carbon_reduction_kg.toFixed(2)} kg</div>
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <Filter className="h-4 w-4 text-slate-400 mr-1" />
          {[
            { id: 'all', label: 'All Decisions' },
            { id: 'dispatch', label: 'Dispatch' },
            { id: 'battery', label: 'Battery BESS' },
            { id: 'vnm_allocation', label: 'VNM Allocation' },
            { id: 'load_shift', label: 'Load Shift' },
            { id: 'reliability', label: 'Reliability' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedType(tab.id)}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                selectedType === tab.id
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Sliders className="h-3.5 w-3.5" />
          <span>Weights: Cost (70%) • Carbon (30%)</span>
        </div>
      </div>

      {/* Decisions Stream */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400 text-xs gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
          <span>Loading decision audit trail...</span>
        </div>
      ) : decisions.length > 0 ? (
        <div className="space-y-4">
          {decisions.slice(0, visibleCount).map((dec) => (
            <DecisionCard
              key={dec.id}
              decision={dec}
              onViewAlternatives={handleOpenAlternatives}
            />
          ))}
          <div className="flex flex-col items-center gap-2 pt-2">
            <span className="text-[11px] text-slate-500">
              Showing {Math.min(visibleCount, decisions.length)} of {decisions.length} decisions
            </span>
            {visibleCount < decisions.length && (
              <button
                onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
                className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2 text-xs font-semibold text-slate-200 transition-all hover:bg-slate-700"
              >
                <ChevronDown className="h-3.5 w-3.5" />
                Show {Math.min(PAGE_SIZE, decisions.length - visibleCount)} more
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 rounded-3xl border border-slate-800 bg-slate-900/40 text-center text-xs text-slate-400">
          <Zap className="h-8 w-8 text-slate-600 mb-2" />
          <span className="font-semibold text-slate-300">No decisions recorded yet</span>
          <span className="text-slate-500 mt-0.5">
            Decisions will appear here automatically when the 30-second background cycle runs.
          </span>
        </div>
      )}

      {/* Alternatives Modal */}
      {selectedCycleId && (
        <AlternativesModal
          cycleId={selectedCycleId}
          alternatives={modalAlternatives}
          onClose={() => setSelectedCycleId(null)}
        />
      )}
    </div>
  );
};
