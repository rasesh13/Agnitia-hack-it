import React from 'react';
import { Award, BatteryCharging, Share2, Leaf } from 'lucide-react';

export const StatsSection: React.FC = () => {
  return (
    <section id="stats-section" className="section-fade-in relative py-28 px-4 sm:px-6 lg:px-8 bg-heritage-page overflow-hidden">
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-16">
          <div className="gsap-reveal heritage-badge mb-4">
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
          <div data-anim="card" className="gsap-reveal stat-card heritage-main-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="heritage-inner-card !p-0 h-10 w-10 flex items-center justify-center text-heritage-accent">
                <Award className="h-5 w-5" />
              </div>
              <span className="heritage-badge !text-[10px] !py-0.5 !px-2">
                Pytest Suite
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span
                data-anim="metric-val"
                data-target="115"
                data-decimals="0"
                className="stat-counter heritage-stat-num"
              >
                0
              </span>
              <span className="text-2xl font-bold font-display text-heritage-accent">/ 115</span>
            </div>
            <div className="mt-3 text-sm font-semibold text-heritage-text-primary">
              Passing Test Suite
            </div>
            <p className="heritage-stat-caption mt-1 font-sans">
              100% pass rate across unit, concurrency, WebSocket, and optimizer solver suites.
            </p>
          </div>

          {/* Stat 2: ≤0.5C BESS limit */}
          <div data-anim="card" className="gsap-reveal stat-card heritage-main-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="heritage-inner-card !p-0 h-10 w-10 flex items-center justify-center text-heritage-accent">
                <BatteryCharging className="h-5 w-5" />
              </div>
              <span className="heritage-badge !text-[10px] !py-0.5 !px-2">
                Safety Guard
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl sm:text-3xl font-extrabold font-display text-heritage-accent">≤</span>
              <span
                data-anim="metric-val"
                data-target="0.5"
                data-decimals="1"
                className="stat-counter heritage-stat-num"
              >
                0.0
              </span>
              <span className="text-2xl font-bold font-display text-heritage-accent">C</span>
            </div>
            <div className="mt-3 text-sm font-semibold text-heritage-text-primary">
              BESS Charge/Discharge Floor
            </div>
            <p className="heritage-stat-caption mt-1 font-sans">
              LFP thermal degradation guard preventing battery health wear and cycling abuse.
            </p>
          </div>

          {/* Stat 3: 100% VNM Solar Allocation */}
          <div data-anim="card" className="gsap-reveal stat-card heritage-main-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="heritage-inner-card !p-0 h-10 w-10 flex items-center justify-center text-heritage-accent">
                <Share2 className="h-5 w-5" />
              </div>
              <span className="heritage-badge !text-[10px] !py-0.5 !px-2">
                Sharing Matrix
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span
                data-anim="metric-val"
                data-target="100"
                data-decimals="0"
                className="stat-counter heritage-stat-num"
              >
                0
              </span>
              <span className="text-2xl font-bold font-display text-heritage-accent">%</span>
            </div>
            <div className="mt-3 text-sm font-semibold text-heritage-text-primary">
              VNM Solar Allocation
            </div>
            <p className="heritage-stat-caption mt-1 font-sans">
              Conservation of energy enforced: ∑ sharing ratio = 1.000 across all 4 campus facilities.
            </p>
          </div>

          {/* Stat 4: 0.82 kg CO2e/kWh */}
          <div data-anim="card" className="gsap-reveal stat-card heritage-main-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="heritage-inner-card !p-0 h-10 w-10 flex items-center justify-center text-heritage-accent">
                <Leaf className="h-5 w-5" />
              </div>
              <span className="heritage-badge !text-[10px] !py-0.5 !px-2">
                CEA Standard
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span
                data-anim="metric-val"
                data-target="0.82"
                data-decimals="2"
                className="stat-counter heritage-stat-num"
              >
                0.00
              </span>
              <span className="text-xs sm:text-sm font-bold font-display text-heritage-accent ml-1">
                kg CO₂e/kWh
              </span>
            </div>
            <div className="mt-3 text-sm font-semibold text-heritage-text-primary">
              Regional Grid Carbon Baseline
            </div>
            <p className="heritage-stat-caption mt-1 font-sans">
              Central Electricity Authority baseline benchmark for scalarized carbon dispatch equations.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
