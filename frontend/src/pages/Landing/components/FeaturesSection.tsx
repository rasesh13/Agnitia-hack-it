import React from 'react';
import { Cpu, Sliders, Share2, BatteryCharging, CheckCircle2 } from 'lucide-react';

export const FeaturesSection: React.FC = () => {
  const features = [
    {
      id: 'digital-twin',
      icon: Cpu,
      tag: 'SITE HIERARCHY',
      tagColor: 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10',
      title: 'Real-Time Campus Digital Twin',
      description:
        'Full site hierarchy modeling Solar PV arrays, Wind turbines, BESS storage, Building load tiers, and Point of Common Coupling (PCC) utility grid interconnections.',
      specs: [
        'Solar PV & Wind Inverters',
        'Sub-metered Building Tiers',
        'PCC Utility Interconnection',
        'Physical Adapter Ingestion',
      ],
      metric: 'Sub-second sync',
    },
    {
      id: 'optimizer',
      icon: Sliders,
      tag: 'PARETO SCALARIZATION',
      tagColor: 'border-amber-500/30 text-amber-400 bg-amber-500/10',
      title: 'Multi-Objective Optimization Engine',
      description:
        'Real-time scalarized cost vs. carbon optimization (w_cost + w_carbon = 1.0), evaluating Time-of-Day (TOD) tariffs and CEA standard regional carbon baselines (0.82 kg CO₂e/kWh).',
      specs: [
        'Dynamic TOD Tariff Arbitrage',
        'CEA Carbon Factor Baseline',
        '5-Minute Decision Windows',
        'Objective Weight Balancing',
      ],
      metric: '0.82 kg CO₂e/kWh Baseline',
    },
    {
      id: 'vnm',
      icon: Share2,
      tag: 'ALLOCATION MATRIX',
      tagColor: 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10',
      title: 'Virtual Net Metering (VNM)',
      description:
        'Regulatory-compliant sharing ratio matrix ensuring 100.0% solar allocation across campus buildings with verifiable generation credits and load balancing.',
      specs: [
        '100.0% Campus Solar Allocation',
        'Building Ratio Calibration',
        'Zero Allocation Leakage',
        'Transparent Energy Accounting',
      ],
      metric: '100% Allocation Enforced',
    },
    {
      id: 'bess-guard',
      icon: BatteryCharging,
      tag: 'ASSET PRESERVATION',
      tagColor: 'border-amber-500/30 text-amber-400 bg-amber-500/10',
      title: 'BESS Degradation Guard',
      description:
        'Hard State-of-Charge (SoC) safety bounds, reserve floor protection, and strict C-rate limiting (≤ 0.5C) to maximize electrochemical cycle life and thermal integrity.',
      specs: [
        '≤0.5C Charge/Discharge Cap',
        'Hard SoC Operating Window',
        'Emergency Reserve Floor',
        'Thermal Degradation Damping',
      ],
      metric: '≤ 0.5C Rate Limit',
    },
  ];

  return (
    <section id="features-section" className="relative bg-heritage-page py-24 sm:py-32 overflow-hidden">
      <div className="section-divider section-divider-top" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16 sm:mb-20">
          <div className="gsap-reveal heritage-badge mb-4 backdrop-blur-md">
            <span>CORE ARCHITECTURE</span>
          </div>
          <h2 data-anim="split-heading" className="gsap-reveal font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white">
            Engineered For Microgrid Stability
          </h2>
          <p className="gsap-reveal mt-4 text-base sm:text-lg text-slate-400 font-sans">
            SURYA integrates digital twin modeling, Pareto-optimal dispatch algorithms, and battery protection
            mechanisms to govern multi-building renewable assets.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          {features.map((feat) => {
            const Icon = feat.icon;
            return (
              <div
                key={feat.id}
                data-anim="feature-card"
                className="gsap-reveal heritage-main-card p-6 sm:p-8 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <div className="heritage-inner-card !p-0 flex h-12 w-12 items-center justify-center text-heritage-accent">
                      <Icon className="h-6 w-6" />
                    </div>
                    <span className="heritage-badge">
                      {feat.tag}
                    </span>
                  </div>

                  <h3 className="heritage-heading text-xl sm:text-2xl font-bold tracking-tight">
                    {feat.title}
                  </h3>
                  <p className="heritage-body mt-3 text-sm leading-relaxed">
                    {feat.description}
                  </p>

                  <div className="mt-6 pt-6 border-t heritage-divider space-y-2.5">
                    {feat.specs.map((spec, i) => (
                      <div key={i} className="flex items-center gap-2.5 text-xs text-heritage-text-secondary">
                        <CheckCircle2 className="h-4 w-4 text-heritage-accent shrink-0" />
                        <span>{spec}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t heritage-divider flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-wider font-semibold text-heritage-text-secondary">
                    Target Metric
                  </span>
                  <span className="heritage-chip font-bold text-heritage-accent font-mono">
                    {feat.metric}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="section-divider section-divider-bottom" />
    </section>
  );
};
