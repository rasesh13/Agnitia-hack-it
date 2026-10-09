import React, { useState } from 'react';
import {
  Database,
  Cpu,
  Zap,
  FileCheck2,
  ArrowRight,
  Sparkles,
  Activity,
  CheckCircle2,
  TrendingDown,
  Shield,
  FileSpreadsheet,
} from 'lucide-react';

export const PipelineSection: React.FC = () => {
  const [activeStep, setActiveStep] = useState<number>(0);

  const steps = [
    {
      num: '01',
      title: 'Ingest',
      icon: Database,
      badge: 'Hardware Telemetry',
      badgeColor: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300',
      image: '/landing/wind_solar_rooftop.jpg',
      headline: 'Sub-Second Physical Telemetry',
      description:
        'Continuous streaming from 450 kWp rooftop solar, 60 kW helical wind, and 1.2 MWh BESS via dedicated Modbus/CAN adapter boundaries with strict staleness monitoring.',
      hud: {
        tag: 'MODBUS STREAM ACTIVE',
        metric1: { label: 'Solar Irradiance', val: '842 W/m²' },
        metric2: { label: 'Wind Velocity', val: '6.2 m/s' },
        status: 'Quality: FRESH (< 400ms)',
      },
      specs: ['Adapter boundary isolation', 'Zero synthetic curve generators', 'Automated staleness flags'],
    },
    {
      num: '02',
      title: 'Optimize',
      icon: Cpu,
      badge: 'Scalarized Multi-Objective',
      badgeColor: 'border-purple-500/40 bg-purple-500/10 text-purple-300',
      image: '/landing/digital_twin_scada.jpg',
      headline: 'Pareto Cost & Carbon Solver',
      description:
        'Continuous scalarized optimization (w_cost + w_carbon = 1.0) evaluating Time-of-Day (TOD) tariffs and CEA standard regional carbon baselines (0.82 kg CO₂e/kWh).',
      hud: {
        tag: 'PARETO FRONTIER SOLVED',
        metric1: { label: 'Tariff State', val: 'TOD Peak Window' },
        metric2: { label: 'Carbon Factor', val: '0.82 kg/kWh' },
        status: 'Optimal Point: Cost 0.7 / Carbon 0.3',
      },
      specs: ['5-minute decision windows', 'Dynamic TOD arbitrage', 'Rejected alternatives logged'],
    },
    {
      num: '03',
      title: 'Dispatch',
      icon: Zap,
      badge: 'Degradation Guarded',
      badgeColor: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
      image: '/landing/bess_storage.jpg',
      headline: 'Closed-Loop Setpoint Execution',
      description:
        'Autonomous inverter execution across campus assets adhering to strict electrochemical bounds (≤0.5C C-rate, SoC reserve floor) and 100% VNM solar allocation.',
      hud: {
        tag: 'INVERTER SETPOINT APPLIED',
        metric1: { label: 'Active Setpoint', val: '+120 kW (Charge)' },
        metric2: { label: 'C-Rate Limit', val: '0.10C (≤ 0.50C max)' },
        status: 'VNM Allocation: 100.0% Enforced',
      },
      specs: ['Hardware safety interlock', '15%-95% hard SoC bounds', 'Zero-leakage VNM matrix'],
    },
    {
      num: '04',
      title: 'Audit',
      icon: FileCheck2,
      badge: 'Explainable Justification',
      badgeColor: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
      image: '/landing/solar_canopy.jpg',
      headline: 'Verifiable Decision Trail',
      description:
        'Every dispatch includes plain-language operator justifications, mathematical formulas, and rejected alternative traces, backed by tamper-evident emergency logs and ESG exports.',
      hud: {
        tag: 'DECISION #8492 VERIFIED',
        metric1: { label: 'Audit Trail', val: 'SHA-256 Sealed' },
        metric2: { label: 'Compliance Report', val: 'RFC 4180 CSV / PDF' },
        status: 'Operator Rationale: Logged',
      },
      specs: ['Plain-language operator log', 'Emergency freeze interlock', 'Executive ReportLab PDFs'],
    },
  ];

  return (
    <section id="pipeline-section" className="relative py-24 sm:py-32 px-4 sm:px-6 lg:px-8 bg-slate-950 overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[900px] rounded-full bg-amber-500/10 blur-[180px] pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 sm:mb-20">
          <div className="gsap-reveal inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-4 py-1.5 text-xs font-bold text-amber-300 mb-4 backdrop-blur-md shadow-lg shadow-amber-500/10">
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            <span>PRODUCTION WORKFLOW ARCHITECTURE</span>
          </div>

          <h2 data-anim="split-heading" className="gsap-reveal font-display text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
            The Closed-Loop Pipeline
          </h2>

          <p className="gsap-reveal mt-4 text-base sm:text-lg text-slate-300 font-sans leading-relaxed">
            From raw hardware telemetry to audited setpoint execution in real time. Every step is verifiable,
            governed by physical bounds, and recorded in immutable logs.
          </p>
        </div>

        {/* 4 Steps Interactive Pipeline Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            const isHovered = activeStep === idx;

            return (
              <div
                key={step.num}
                data-anim="card"
                onMouseEnter={() => setActiveStep(idx)}
                className={`gsap-reveal group relative flex flex-col justify-between rounded-3xl border transition-all duration-500 overflow-hidden backdrop-blur-xl ${
                  isHovered
                    ? 'border-amber-400/60 bg-slate-900/90 shadow-2xl shadow-amber-500/10 -translate-y-1.5'
                    : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
                }`}
              >
                {/* Visual Top Preview: High-Resolution Photographic Backdrop + HUD Telemetry Overlay */}
                <div data-anim="card-img-wrap" className="relative h-48 w-full overflow-hidden bg-slate-950">
                  <img
                    data-anim="card-img"
                    src={step.image}
                    alt={step.title}
                    className="h-full w-full object-cover object-center filter brightness-[0.75] contrast-[1.1] transition-transform duration-700 group-hover:scale-105"
                    loading="lazy"
                  />

                  {/* Gradient Scrim */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />

                  {/* Top Header inside image */}
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10">
                    <span className="font-display font-black text-2xl text-white/90 drop-shadow-md">
                      {step.num}
                    </span>
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/20 bg-slate-950/80 text-amber-400 backdrop-blur-md shadow-lg">
                      <Icon className="h-4 w-4" />
                    </div>
                  </div>

                  {/* Live HUD Mini Overlay inside Image */}
                  <div className="absolute bottom-2.5 left-2.5 right-2.5 z-10 rounded-xl border border-white/10 bg-slate-950/85 p-2.5 backdrop-blur-md">
                    <div className="flex items-center justify-between text-[10px] font-mono font-bold text-amber-300">
                      <span className="flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        {step.hud.tag}
                      </span>
                    </div>

                    <div className="mt-1.5 grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-300">
                      <div>
                        <span className="text-slate-400 block text-[9px]">{step.hud.metric1.label}</span>
                        <span className="font-bold text-white">{step.hud.metric1.val}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9px]">{step.hud.metric2.label}</span>
                        <span className="font-bold text-amber-300">{step.hud.metric2.val}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    {/* Badge */}
                    <div className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border mb-2.5 backdrop-blur-md ${step.badgeColor}`}>
                      {step.badge}
                    </div>

                    {/* Step Title */}
                    <h3 className="font-display text-xl font-bold text-white tracking-tight flex items-center gap-2">
                      <span>{step.title}</span>
                    </h3>

                    {/* Technical Headline */}
                    <div className="text-xs font-semibold text-amber-300/90 font-mono mt-0.5">
                      {step.headline}
                    </div>

                    {/* Description */}
                    <p className="mt-2.5 text-xs text-slate-400 leading-relaxed font-sans">
                      {step.description}
                    </p>
                  </div>

                  {/* Micro Specs List */}
                  <div className="pt-3 border-t border-slate-800/80 space-y-1.5">
                    {step.specs.map((item, sIdx) => (
                      <div key={sIdx} className="flex items-center gap-1.5 text-[11px] text-slate-300 font-sans">
                        <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>

                  {/* Status Indicator */}
                  <div className="pt-2 text-[10px] font-mono text-emerald-400/90 flex items-center gap-1.5">
                    <Activity className="h-3 w-3" />
                    <span>{step.hud.status}</span>
                  </div>
                </div>

                {/* Connecting arrow for desktop view */}
                {idx < steps.length - 1 && (
                  <div className="hidden lg:flex absolute -right-3.5 top-1/2 -translate-y-1/2 z-20 h-7 w-7 items-center justify-center rounded-full border border-slate-800 bg-slate-950 text-slate-400 shadow-md">
                    <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Global Pipeline Telemetry Bar */}
        <div className="mt-12 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5 backdrop-blur-md flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Shield className="h-4 w-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-white font-display">
                Continuous Hardware-in-the-Loop Validation
              </div>
              <div className="text-[11px] text-slate-400 font-sans">
                Zero simulation policy · All telemetry validated against physical Modbus registers
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6 text-xs font-mono text-slate-300">
            <span className="flex items-center gap-1.5">
              <TrendingDown className="h-3.5 w-3.5 text-emerald-400" />
              <span>Cost Arbitrage Active</span>
            </span>
            <span className="flex items-center gap-1.5">
              <FileSpreadsheet className="h-3.5 w-3.5 text-amber-400" />
              <span>RFC 4180 Format</span>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
