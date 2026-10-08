export interface HeroSlide {
  id: string;
  slideNumber: string;
  eyebrow: string;
  headlinePrefix: string;
  accentWord: string;
  headlineSuffix: string;
  subtext: string;
  statValue: string;
  statLabel: string;
  badge: string;
  secondaryStat?: {
    value: string;
    label: string;
  };
  highlightFeatures: string[];
}

export const HERO_SLIDES: HeroSlide[] = [
  {
    id: 'weather-precharge',
    slideNumber: '01',
    eyebrow: 'RAJASTHAN DTE · AI HYBRID VPP',
    headlinePrefix: 'Autonomous clean power, ',
    accentWord: 'forecasted hours ahead',
    headlineSuffix: '.',
    subtext:
      "SURYA's neural nowcasting predicts satellite solar irradiance and wind drafts 4 hours in advance—automatically buffering battery storage before peak demand surges.",
    statValue: '84.6%',
    statLabel: 'Solar Self-Consumption',
    badge: 'Satellite & Sensor Nowcasting',
    secondaryStat: {
      value: '+450 kW',
      label: 'Peak Clean Generation',
    },
    highlightFeatures: [
      'Nowcasting GHI & DNI irradiance',
      'Intelligent BESS ramp-up buffer',
      'Sub-second grid stability safeguard',
    ],
  },
  {
    id: 'critical-resilience',
    slideNumber: '02',
    eyebrow: 'CAMPUS DIGITAL TWIN · ZERO BLACKOUTS',
    headlinePrefix: 'Mission-critical campus loads, ',
    accentWord: 'always powered',
    headlineSuffix: '.',
    subtext:
      'Dynamic Virtual Net Metering (VNM) autonomously protects computing labs, research servers, and student residences with sub-second microgrid islanding.',
    statValue: '100%',
    statLabel: 'Critical Facility Uptime',
    badge: 'Autonomous Microgrid SLA',
    secondaryStat: {
      value: '4 Zones',
      label: 'Real-Time VNM Routing',
    },
    highlightFeatures: [
      'Tiered load shedding hierarchy',
      'Automated microgrid islanding',
      'Hostel & Server Lab priority reserve',
    ],
  },
  {
    id: 'explainable-ai',
    slideNumber: '03',
    eyebrow: 'EXPLAINABLE DISPATCH · 5-MIN CYCLES',
    headlinePrefix: 'Every dispatch decision, ',
    accentWord: 'auditable in plain English',
    headlineSuffix: '.',
    subtext:
      'Closed-loop AI dispatches energy storage and grid feeds every 5 minutes over WebSocket, generating transparent reasoning trails and peak tariff savings.',
    statValue: '₹12,450',
    statLabel: 'Avg Daily Tariff Savings',
    badge: 'Explainable MPC Dispatch',
    secondaryStat: {
      value: '99.2%',
      label: 'Optimizer Confidence',
    },
    highlightFeatures: [
      'Deterministic safety guardrails',
      'Human-auditable reasoning trail',
      'ToD tariff peak arbitrage',
    ],
  },
  {
    id: 'zero-carbon-autonomy',
    slideNumber: '04',
    eyebrow: 'CAMPUS ENERGY INDEPENDENCE · ZERO-CARBON',
    headlinePrefix: 'Engineered for complete ',
    accentWord: 'autonomous clean power',
    headlineSuffix: '.',
    subtext:
      'Smart energy orchestration dynamically balances solar, wind, and battery storage with automated zero-export protection and real-time load balancing.',
    statValue: '99.9%',
    statLabel: 'Uptime Reliability',
    badge: 'Smart Grid Ready',
    secondaryStat: {
      value: 'Sub-Sec',
      label: 'Response Time',
    },
    highlightFeatures: [
      'Automated energy banking ledger',
      'Sub-second grid sync',
      'Real-time carbon offset accounting',
    ],
  },
];
