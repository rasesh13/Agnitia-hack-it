import React from 'react';
import { Sun, Wind, BatteryCharging, Building2, ArrowRight } from 'lucide-react';

export const JourneySection: React.FC = () => {
  return (
    <section id="journey-section" className="section-fade-in relative py-28 px-4 sm:px-6 lg:px-8 bg-slate-950 overflow-hidden">
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-20">
          <div className="gsap-reveal inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1 text-xs font-semibold text-amber-300 mb-4">
            <span>Power Dispatch Journey</span>
          </div>
          <h2 data-anim="split-heading" className="gsap-reveal text-3xl sm:text-5xl font-extrabold tracking-tight text-white font-display">
            From Photon to Classroom
          </h2>
          <p className="gsap-reveal mt-4 text-base sm:text-lg text-slate-300 max-w-2xl mx-auto font-sans">
            How clean energy flows seamlessly across the campus microgrid from harvest to consumption.
          </p>
        </div>

        {/* 3 Step Journey */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {/* Desktop Scrubbed Animated SVG Connector Cable */}
          <div className="hidden md:block absolute top-[45%] left-[10%] right-[10%] h-8 -translate-y-1/2 pointer-events-none z-0">
            <svg className="w-full h-full overflow-visible" fill="none" viewBox="0 0 1000 30" preserveAspectRatio="none">
              <path
                d="M 0 15 Q 250 30, 500 15 T 1000 15"
                stroke="#d97706"
                strokeWidth="2"
                strokeOpacity="0.2"
              />
              <path
                data-anim="svg-line"
                d="M 0 15 Q 250 30, 500 15 T 1000 15"
                stroke="#f59e0b"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>

          {/* Node 1: Generation */}
          <div data-anim="card" className="gsap-reveal relative z-10 rounded-2xl border border-slate-800 bg-slate-900/60 p-8 backdrop-blur-md hover:border-amber-500/40 transition-all duration-300 group">
            <div className="flex items-center justify-between mb-6">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-400">
                Phase 1 • Harvest
              </span>
              <div className="flex items-center gap-2">
                <Sun className="h-5 w-5 text-amber-400 animate-spin-slow" />
                <Wind className="h-5 w-5 text-emerald-400" />
              </div>
            </div>

            <h3 className="text-2xl font-bold text-white font-display mb-3">
              Renewable Generation
            </h3>

            <p className="text-sm text-slate-400 leading-relaxed font-sans mb-6">
              High-efficiency stepped rooftop Solar PV arrays and helical wind turbines harvest intermittent renewable power, streaming authentic sub-second telemetry into SURYA's twin.
            </p>

            <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-3 text-xs text-slate-300 space-y-1.5 font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">Solar Array:</span>
                <span className="text-amber-400 font-semibold">384 kWp Peak</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Wind Telemetry:</span>
                <span className="text-emerald-400 font-semibold">Live Helical Turbines</span>
              </div>
            </div>

            {/* Connecting Arrow for desktop */}
            <div className="hidden md:block absolute -right-4 top-1/2 -translate-y-1/2 z-10 text-slate-600 group-hover:text-amber-400 transition-colors">
              <ArrowRight className="h-6 w-6" />
            </div>
          </div>

          {/* Node 2: Storage Buffer */}
          <div data-anim="card" className="gsap-reveal relative z-10 rounded-2xl border border-slate-800 bg-slate-900/60 p-8 backdrop-blur-md hover:border-amber-500/40 transition-all duration-300 group">
            <div className="flex items-center justify-between mb-6">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-400">
                Phase 2 • Buffer
              </span>
              <BatteryCharging className="h-6 w-6 text-amber-400" />
            </div>

            <h3 className="text-2xl font-bold text-white font-display mb-3">
              1.2 MWh LFP Storage
            </h3>

            <p className="text-sm text-slate-400 leading-relaxed font-sans mb-6">
              Battery Energy Storage absorbs mid-day solar surplus and executes automated pre-charging routines ahead of high Time-of-Day grid tariff windows, preserving cell life.
            </p>

            <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-3 text-xs text-slate-300 space-y-1.5 font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">Capacity:</span>
                <span className="text-white font-semibold">1,200 kWh (LFP)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Degradation:</span>
                <span className="text-amber-400 font-semibold">≤0.5C Protected</span>
              </div>
            </div>

            {/* Connecting Arrow for desktop */}
            <div className="hidden md:block absolute -right-4 top-1/2 -translate-y-1/2 z-10 text-slate-600 group-hover:text-amber-400 transition-colors">
              <ArrowRight className="h-6 w-6" />
            </div>
          </div>

          {/* Node 3: Campus Loads */}
          <div data-anim="card" className="gsap-reveal relative z-10 rounded-2xl border border-slate-800 bg-slate-900/60 p-8 backdrop-blur-md hover:border-emerald-500/40 transition-all duration-300 group">
            <div className="flex items-center justify-between mb-6">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400">
                Phase 3 • Dispatch
              </span>
              <Building2 className="h-6 w-6 text-emerald-400" />
            </div>

            <h3 className="text-2xl font-bold text-white font-display mb-3">
              Campus Facilities
            </h3>

            <p className="text-sm text-slate-400 leading-relaxed font-sans mb-6">
              Virtual Net Metering distributes clean kWh across Administrative, Science, Engineering, and Hostel blocks according to configured regulatory sharing ratios.
            </p>

            <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-3 text-xs text-slate-300 space-y-1.5 font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">Allocation:</span>
                <span className="text-emerald-400 font-semibold">100.0% VNM Solved</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Grid PCC:</span>
                <span className="text-white font-semibold">Bi-Directional Net</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
