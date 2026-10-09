import React from 'react';
import { Shield, AlertCircle, HardDrive, CheckCircle2 } from 'lucide-react';

export const PrincipleSection: React.FC = () => {
  return (
    <section className="section-fade-in relative py-28 px-4 sm:px-6 lg:px-8 bg-heritage-page overflow-hidden">
      <div className="max-w-5xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-16">
          <div className="gsap-reveal heritage-badge mb-4">
            <Shield className="h-3.5 w-3.5" />
            <span>Foundational Engineering Mandate</span>
          </div>
          <h2 data-anim="split-heading" className="gsap-reveal text-3xl sm:text-5xl font-extrabold tracking-tight text-white font-display">
            Zero Simulation Policy
          </h2>
          <p className="gsap-reveal mt-4 text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Real physical hardware telemetry only. Zero synthetic curves. Zero synthetic sine-wave generators.
          </p>
        </div>

        {/* Principle Manifesto Box */}
        <div data-anim="zero-sim-panel" className="gsap-reveal relative heritage-main-card p-8 sm:p-12 shadow-2xl">
          <div className="flex flex-col lg:flex-row gap-8 items-start">
            <div className="flex-1 space-y-6">
              <div className="flex items-center gap-3 text-heritage-accent">
                <AlertCircle className="h-6 w-6 flex-shrink-0" />
                <h3 className="heritage-heading text-xl sm:text-2xl font-bold">
                  Hardware Integrity over Synthetic Vanity
                </h3>
              </div>
              <p className="heritage-body text-sm sm:text-base leading-relaxed">
                SURYA contains <strong className="text-heritage-text-primary font-semibold">zero synthetic curve generators or fake data simulators</strong>. In production, every watt, voltage reading, and battery state is ingested directly from authentic physical hardware meters and inverters via strict adapter boundaries.
              </p>
              <p className="heritage-body text-sm leading-relaxed">
                If an IoT telemetry stream experiences network degradation or hardware lag, the platform displays explicit staleness indicators and freezes setpoints rather than fabricating artificial numbers.
              </p>
            </div>

            {/* Checklist of Real Hardware Safeguards */}
            <div className="heritage-inner-card w-full lg:w-80 space-y-4">
              <div className="text-xs font-bold uppercase tracking-wider text-heritage-accent">
                Architectural Proof Points
              </div>
              <ul className="space-y-3 text-xs sm:text-sm text-heritage-text-secondary">
                <li data-anim="bullet" className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-heritage-accent flex-shrink-0" />
                  <span>Modbus & SunSpec hardware adapters</span>
                </li>
                <li data-anim="bullet" className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-heritage-accent flex-shrink-0" />
                  <span>Explicit staleness & latency thresholds</span>
                </li>
                <li data-anim="bullet" className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-heritage-accent flex-shrink-0" />
                  <span>Mathematical rejected-alternative traces</span>
                </li>
                <li data-anim="bullet" className="flex items-center gap-2.5">
                  <HardDrive className="h-4 w-4 text-heritage-accent flex-shrink-0" />
                  <span>Tamper-evident audit justifications</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
