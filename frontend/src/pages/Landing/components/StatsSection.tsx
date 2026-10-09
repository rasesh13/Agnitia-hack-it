import React from 'react';
import { Award, BatteryCharging, Share2, Leaf } from 'lucide-react';

export const StatsSection: React.FC = () => {
  return (
    <section id="stats-section" className="section-fade-in relative py-28 px-4 sm:px-6 lg:px-8 bg-slate-950 overflow-hidden">
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-16">
          <div className="gsap-reveal inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-semibold text-emerald-400 mb-4">
            <span>Rigorous Engineering Proof</span>
          </div>
          <h2 data-anim="split-heading" className="gsap-reveal text-3xl sm:text-5xl font-extrabold tracking-tight text-white font-display">
            Verified Production Metrics
          </h2>
          <p className="gsap-reveal mt-4 text-base sm:text-lg text-slate-300 max-w-2xl mx-auto font-sans">
            Every specification is enforced in production code with continuous test suites and hardware constraints.
          </p>
        </div>

        {/* 4 Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Stat 1: 115 Passing Tests */}
          <div data-anim="card" className="gsap-reveal stat-card rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-md hover:border-emerald-500/40 transition-colors">
            <div className="flex items-center justify-between mb-4">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                <Award className="h-5 w-5" />
              </div>
              <span className="text-xs font-mono text-emerald-400 uppercase tracking-wider font-semibold">
                Pytest Suite
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span
                data-anim="metric-val"
                data-target="115"
                data-decimals="0"
                className="stat-counter text-4xl sm:text-5xl font-extrabold font-display text-white tracking-tight"
              >
                0
              </span>
              <span className="text-2xl font-bold font-display text-emerald-400">/ 115</span>
            </div>
            <div className="mt-3 text-sm font-semibold text-slate-200">
              Passing Test Suite
            </div>
            <p className="mt-1 text-xs text-slate-400 leading-relaxed font-sans">
              100% pass rate across unit, concurrency, WebSocket, and optimizer solver suites.
            </p>
          </div>

          {/* Stat 2: ≤0.5C BESS limit */}
          <div data-anim="card" className="gsap-reveal stat-card rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-md hover:border-amber-500/40 transition-colors">
            <div className="flex items-center justify-between mb-4">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400">
                <BatteryCharging className="h-5 w-5" />
              </div>
              <span className="text-xs font-mono text-amber-400 uppercase tracking-wider font-semibold">
                Safety Guard
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl sm:text-3xl font-extrabold font-display text-amber-400">≤</span>
              <span
                data-anim="metric-val"
                data-target="0.5"
                data-decimals="1"
                className="stat-counter text-4xl sm:text-5xl font-extrabold font-display text-white tracking-tight"
              >
                0.0
              </span>
              <span className="text-2xl font-bold font-display text-amber-400">C</span>
            </div>
            <div className="mt-3 text-sm font-semibold text-slate-200">
              BESS Charge/Discharge Floor
            </div>
            <p className="mt-1 text-xs text-slate-400 leading-relaxed font-sans">
              LFP thermal degradation guard preventing battery health wear and cycling abuse.
            </p>
          </div>

          {/* Stat 3: 100% VNM Solar Allocation */}
          <div data-anim="card" className="gsap-reveal stat-card rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-md hover:border-blue-500/40 transition-colors">
            <div className="flex items-center justify-between mb-4">
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                <Share2 className="h-5 w-5" />
              </div>
              <span className="text-xs font-mono text-blue-400 uppercase tracking-wider font-semibold">
                Sharing Matrix
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span
                data-anim="metric-val"
                data-target="100"
                data-decimals="0"
                className="stat-counter text-4xl sm:text-5xl font-extrabold font-display text-white tracking-tight"
              >
                0
              </span>
              <span className="text-2xl font-bold font-display text-blue-400">%</span>
            </div>
            <div className="mt-3 text-sm font-semibold text-slate-200">
              VNM Solar Allocation
            </div>
            <p className="mt-1 text-xs text-slate-400 leading-relaxed font-sans">
              Conservation of energy enforced: ∑ sharing ratio = 1.000 across all 4 campus facilities.
            </p>
          </div>

          {/* Stat 4: 0.82 kg CO2e/kWh */}
          <div data-anim="card" className="gsap-reveal stat-card rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-md hover:border-emerald-500/40 transition-colors">
            <div className="flex items-center justify-between mb-4">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                <Leaf className="h-5 w-5" />
              </div>
              <span className="text-xs font-mono text-emerald-400 uppercase tracking-wider font-semibold">
                CEA Standard
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span
                data-anim="metric-val"
                data-target="0.82"
                data-decimals="2"
                className="stat-counter text-4xl sm:text-5xl font-extrabold font-display text-white tracking-tight"
              >
                0.00
              </span>
              <span className="text-xs sm:text-sm font-bold font-display text-emerald-400 ml-1">
                kg CO₂e/kWh
              </span>
            </div>
            <div className="mt-3 text-sm font-semibold text-slate-200">
              Regional Grid Carbon Baseline
            </div>
            <p className="mt-1 text-xs text-slate-400 leading-relaxed font-sans">
              Central Electricity Authority baseline benchmark for scalarized carbon dispatch equations.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
