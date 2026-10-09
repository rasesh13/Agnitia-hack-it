import React from 'react';
import { Sun, Wind, BatteryCharging, Building2 } from 'lucide-react';

export const JourneySection: React.FC = () => {
  return (
    <section id="journey-section" className="section-fade-in relative py-28 px-4 sm:px-6 lg:px-8 bg-heritage-page overflow-hidden">
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-20">
          <div className="gsap-reveal heritage-badge mb-4">
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
          {/* Node 1: Generation */}
          <div data-anim="card" className="gsap-reveal relative z-10 heritage-main-card p-8 group flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-6">
                <span className="heritage-badge !text-[10px] !py-0.5 !px-2">
                  Phase 1 • Harvest
                </span>
                <div className="flex items-center gap-2">
                  <Sun className="h-5 w-5 text-heritage-accent animate-spin-slow" />
                  <Wind className="h-5 w-5 text-heritage-accent" />
                </div>
              </div>

              <h3 className="heritage-heading text-2xl font-bold mb-3">
                Renewable Generation
              </h3>

              <p className="heritage-body text-sm mb-6">
                High-efficiency stepped rooftop Solar PV arrays and helical wind turbines harvest intermittent renewable power, streaming authentic sub-second telemetry into SURYA's twin.
              </p>
            </div>

            <div className="heritage-inner-card p-3 text-xs space-y-1.5 font-mono">
              <div className="flex justify-between">
                <span className="text-heritage-text-secondary">Solar Array:</span>
                <span className="text-heritage-accent font-semibold">384 kWp Peak</span>
              </div>
              <div className="flex justify-between">
                <span className="text-heritage-text-secondary">Wind Telemetry:</span>
                <span className="text-heritage-accent font-semibold">Live Helical Turbines</span>
              </div>
            </div>
          </div>

          {/* Node 2: Storage Buffer */}
          <div data-anim="card" className="gsap-reveal relative z-10 heritage-main-card p-8 group flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-6">
                <span className="heritage-badge !text-[10px] !py-0.5 !px-2">
                  Phase 2 • Buffer
                </span>
                <BatteryCharging className="h-6 w-6 text-heritage-accent" />
              </div>

              <h3 className="heritage-heading text-2xl font-bold mb-3">
                1.2 MWh LFP Storage
              </h3>

              <p className="heritage-body text-sm mb-6">
                Battery Energy Storage absorbs mid-day solar surplus and executes automated pre-charging routines ahead of high Time-of-Day grid tariff windows, preserving cell life.
              </p>
            </div>

            <div className="heritage-inner-card p-3 text-xs space-y-1.5 font-mono">
              <div className="flex justify-between">
                <span className="text-heritage-text-secondary">Capacity:</span>
                <span className="text-heritage-text-primary font-semibold">1,200 kWh (LFP)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-heritage-text-secondary">Degradation:</span>
                <span className="text-heritage-accent font-semibold">≤0.5C Protected</span>
              </div>
            </div>
          </div>

          {/* Node 3: Campus Loads */}
          <div data-anim="card" className="gsap-reveal relative z-10 heritage-main-card p-8 group flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-6">
                <span className="heritage-badge !text-[10px] !py-0.5 !px-2">
                  Phase 3 • Dispatch
                </span>
                <Building2 className="h-6 w-6 text-heritage-accent" />
              </div>

              <h3 className="heritage-heading text-2xl font-bold mb-3">
                Campus Facilities
              </h3>

              <p className="heritage-body text-sm mb-6">
                Virtual Net Metering distributes clean kWh across Administrative, Science, Engineering, and Hostel blocks according to configured regulatory sharing ratios.
              </p>
            </div>

            <div className="heritage-inner-card p-3 text-xs space-y-1.5 font-mono">
              <div className="flex justify-between">
                <span className="text-heritage-text-secondary">Allocation:</span>
                <span className="text-heritage-accent font-semibold">100.0% VNM Solved</span>
              </div>
              <div className="flex justify-between">
                <span className="text-heritage-text-secondary">Grid PCC:</span>
                <span className="text-heritage-text-primary font-semibold">Bi-Directional Net</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
