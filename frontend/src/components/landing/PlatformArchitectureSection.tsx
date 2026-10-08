import React from 'react';
import {
  Cpu,
  SunMedium,
  BatteryCharging,
  Layers,
  ShieldCheck,
} from 'lucide-react';

export const PlatformArchitectureSection: React.FC = () => {
  const pillars = [
    {
      icon: SunMedium,
      title: 'Satellite AI Nowcasting',
      badge: 'GHI / DNI Forecast',
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10 border-amber-500/30',
      description:
        'Continuous ingestion of INSAT-3DR satellite data and local micro-inverter metrics to predict irradiance drops 4 hours in advance with 94.8% accuracy.',
      points: ['Cloud vector tracking', 'Bifacial albedo estimation', 'Automated dust soiling detection'],
    },
    {
      icon: BatteryCharging,
      title: 'Closed-Loop BESS Dispatch',
      badge: '5-Min MPC Solver',
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10 border-emerald-500/30',
      description:
        'Model Predictive Control (MPC) schedules charge and discharge cycles to maximize ToD tariff arbitrage while keeping battery degradation below 1.2% per year.',
      points: ['Degradation-aware C-rate throttling', 'Sub-second peak shaving', 'Thermal safety monitoring'],
    },
    {
      icon: Layers,
      title: 'Dynamic VNM Allocation',
      badge: 'Dynamic VNM Engine',
      color: 'text-teal-400',
      bgColor: 'bg-teal-500/10 border-teal-500/30',
      description:
        'Virtual Net Metering dynamically routes solar and wind yields across academic, laboratory, and residential meters on campus without physical rewiring.',
      points: ['Hostel & Research priority weighting', 'Automated billing settlement', 'Zero export penalty prevention'],
    },
    {
      icon: ShieldCheck,
      title: 'Deterministic Guardrails',
      badge: 'Safety-Critical SLA',
      color: 'text-sky-400',
      bgColor: 'bg-sky-500/10 border-sky-500/30',
      description:
        'Every AI decision passes through a formal verification layer that enforces voltage, frequency, reverse-power, and emergency reserve hard constraints.',
      points: ['Hardware-in-the-loop validation', 'Instant islanding on grid drop', 'Cryptographic decision ledger'],
    },
  ];

  return (
    <section id="platform" className="relative w-full bg-slate-950 py-24 px-4 sm:px-6 lg:px-8 border-t border-white/5">
      <div className="relative mx-auto max-w-7xl">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-widest text-amber-300">
            <Cpu className="h-3.5 w-3.5 text-amber-400" />
            <span>Architecture & Engine</span>
          </div>

          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl">
            Engineered for Industrial{' '}
            <span className="text-amber-400">Reliability & Precision</span>
          </h2>

          <p className="mt-4 text-base sm:text-lg text-slate-300 leading-relaxed">
            SURYA replaces rigid static solar inverters with an autonomous, real-time Virtual Power Plant operating at utility-grade standards.
          </p>
        </div>

        {/* 4 Pillars Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          {pillars.map((pillar, idx) => {
            const Icon = pillar.icon;
            return (
              <div
                key={idx}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/40 p-6 sm:p-8 backdrop-blur-xl transition-all duration-300 hover:border-amber-400/40 hover:bg-slate-900/70 shadow-xl shadow-black/40"
              >
                {/* Accent Top Border */}
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-400/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                <div className="flex items-center justify-between">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${pillar.bgColor} ${pillar.color}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-mono font-medium text-slate-300">
                    {pillar.badge}
                  </span>
                </div>

                <h3 className="mt-6 text-xl font-bold text-white tracking-tight group-hover:text-amber-300 transition-colors">
                  {pillar.title}
                </h3>

                <p className="mt-2 text-sm leading-relaxed text-slate-300 font-normal">
                  {pillar.description}
                </p>

                <div className="mt-6 pt-4 border-t border-white/10 space-y-2">
                  {pillar.points.map((point, pIdx) => (
                    <div key={pIdx} className="flex items-center gap-2 text-xs text-slate-400">
                      <div className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                      <span>{point}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
