import React, { useState } from 'react';
import { Sparkles, ExternalLink, X } from 'lucide-react';

interface AssetDetail {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  categoryColor: string;
  image: string;
  summary: string;
  specs: { label: string; value: string }[];
  accentColor: string;
}

export const AssetShowcaseSection: React.FC = () => {
  const [selectedAsset, setSelectedAsset] = useState<AssetDetail | null>(null);

  const assets: AssetDetail[] = [
    {
      id: 'rooftop-hybrid',
      title: 'Stepped Rooftop Solar & Helical Wind',
      subtitle: '450 kWp Monocrystalline PV + 60 kW Clean Wind Turbines',
      category: 'RENEWABLE GENERATION',
      categoryColor: 'border-amber-500/40 text-amber-300 bg-amber-500/10',
      image: '/landing/wind_solar_rooftop.jpg',
      summary:
        'Engineered directly onto the stepped brick terraces and academic rooftops of Prestige University Indore. Monocrystalline solar modules paired with silent, zero-vibration vertical-axis helical wind turbines for dual-harvest yield.',
      specs: [
        { label: 'Rooftop Solar Peak', value: '450 kWp' },
        { label: 'Helical Wind Turbines', value: '60 kW (4 Units)' },
        { label: 'Harvest Profile', value: 'Diurnal + Night Winds' },
        { label: 'Mounting Structural', value: 'Zero-Penetration Ballast' },
      ],
      accentColor: 'from-amber-500/20 to-orange-500/10',
    },
    {
      id: 'bess-facility',
      title: '1.2 MWh Containerized BESS Storage',
      subtitle: 'LFP Battery Energy Storage with Active Liquid Cooling',
      category: 'STORAGE & PEAK SHIFTING',
      categoryColor: 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10',
      image: '/landing/bess_storage.jpg',
      summary:
        'Industrial-grade lithium iron phosphate (LFP) containerized battery system. Regulated by strict ≤0.5C charge/discharge limits and hard 15%-95% State-of-Charge bounds to prevent thermal wear and ensure 15+ year operational lifespan.',
      specs: [
        { label: 'Total Capacity', value: '1.2 MWh (1200 kWh)' },
        { label: 'C-Rate Safety Limit', value: '≤ 0.5C (125 kW Max)' },
        { label: 'Operating SoC Bounds', value: '15% Floor · 95% Cap' },
        { label: 'Thermal Protection', value: 'Closed-Loop Glycol Liquid Cooling' },
      ],
      accentColor: 'from-emerald-500/20 to-teal-500/10',
    },
    {
      id: 'digital-twin-umoc',
      title: 'Cyber-Physical Digital Twin Command Center',
      subtitle: 'Real-Time Telemetry & Pareto Cost/Carbon Dispatch',
      category: 'AUTONOMOUS OPERATIONS',
      categoryColor: 'border-cyan-500/40 text-cyan-300 bg-cyan-500/10',
      image: '/landing/digital_twin_scada.jpg',
      summary:
        'Live operations dashboard modeling all 5 campus building load tiers, sub-metered inverters, and the Point of Common Coupling (PCC) utility grid interconnection. Solves scalarized objective functions every 5 minutes.',
      specs: [
        { label: 'Dispatch Cadence', value: '5-Minute Execution Loop' },
        { label: 'Regional Carbon Factor', value: '0.82 kg CO₂e/kWh' },
        { label: 'Communication Protocol', value: 'Sub-Second WebSocket Feed' },
        { label: 'Explainability Audit', value: 'Plain-Language Rationale' },
      ],
      accentColor: 'from-cyan-500/20 to-blue-500/10',
    },
    {
      id: 'solar-canopy-ev',
      title: 'Bifacial Solar Canopies & EV Charging',
      subtitle: '100% Virtual Net Metering Across Campus Transit',
      category: 'CAMPUS MOBILITY & VNM',
      categoryColor: 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10',
      image: '/landing/solar_canopy.jpg',
      summary:
        'Elevated dual-axis parking canopies that generate solar electricity while providing shade and high-speed charging for student electric scooters and university electric shuttles, all balanced under a 100% VNM allocation matrix.',
      specs: [
        { label: 'Module Technology', value: 'Bifacial Glass-Glass PV' },
        { label: 'VNM Allocation Ratio', value: '100.0% Campus Sharing' },
        { label: 'Fleet Charger Ports', value: '24 EV / Scooter Stations' },
        { label: 'Shading Avoidance', value: 'Optimized East-West Tilt' },
      ],
      accentColor: 'from-emerald-500/20 to-amber-500/10',
    },
  ];

  return (
    <section id="assets-showcase" className="relative bg-slate-950 py-24 sm:py-32 overflow-hidden">
      {/* Dynamic Ambient Background Glows */}
      <div className="absolute top-1/3 left-1/4 h-[500px] w-[500px] rounded-full bg-amber-500/10 blur-[180px] pointer-events-none" />
      <div className="absolute bottom-1/3 right-1/4 h-[500px] w-[500px] rounded-full bg-emerald-500/10 blur-[180px] pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 sm:mb-20">
          <div className="gsap-reveal inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-4 py-1.5 text-xs font-bold text-amber-300 mb-4 backdrop-blur-md shadow-lg shadow-amber-500/10">
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            <span>AUTHENTIC HARDWARE DEPLOYMENT</span>
          </div>

          <h2 data-anim="split-heading" className="gsap-reveal font-display text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Physical Campus Infrastructure In Action
          </h2>

          <p className="gsap-reveal mt-4 text-base sm:text-lg text-slate-300 font-sans leading-relaxed">
            SURYA is not an abstract theory or synthetic simulation. Every asset shown below is physically
            modeled and telemetry-monitored across the Prestige University Indore clean energy microgrid.
          </p>
        </div>

        {/* 2x2 Showcase Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10">
          {assets.map((asset) => (
            <div
              key={asset.id}
              data-anim="card"
              className="gsap-reveal group relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/40 backdrop-blur-md transition-all duration-500 hover:border-slate-700 hover:shadow-2xl hover:shadow-amber-500/10 flex flex-col justify-between"
            >
              {/* Image Preview Container with Zoom Effect */}
              <div data-anim="card-img-wrap" className="relative h-64 sm:h-80 w-full overflow-hidden bg-slate-950">
                <img
                  data-anim="card-img"
                  src={asset.image}
                  alt={asset.title}
                  className="h-full w-full object-cover object-center transition-transform duration-700 group-hover:scale-105 filter brightness-[0.92] contrast-[1.05]"
                  loading="lazy"
                />

                {/* Gradient Scrims for text contrast */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent" />

                {/* Floating Category Pill */}
                <div className="absolute top-4 left-4 z-10">
                  <span
                    className={`inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full border backdrop-blur-md ${asset.categoryColor}`}
                  >
                    <span>{asset.category}</span>
                  </span>
                </div>

                {/* Inspect Button Icon */}
                <button
                  onClick={() => setSelectedAsset(asset)}
                  className="absolute top-4 right-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-slate-950/70 text-slate-300 backdrop-blur-md transition-all duration-300 hover:border-amber-400 hover:text-amber-300 hover:scale-110 active:scale-95"
                  aria-label={`Inspect ${asset.title}`}
                >
                  <ExternalLink className="h-4 w-4" />
                </button>

                {/* Bottom title inside image */}
                <div className="absolute bottom-4 left-4 right-4 z-10">
                  <h3 className="font-display text-xl sm:text-2xl font-bold text-white tracking-tight drop-shadow-md">
                    {asset.title}
                  </h3>
                  <p className="text-xs sm:text-sm font-medium text-amber-300/90 font-mono mt-0.5">
                    {asset.subtitle}
                  </p>
                </div>
              </div>

              {/* Card Body & Specs */}
              <div className="p-6 sm:p-8 flex-1 flex flex-col justify-between space-y-6">
                <p className="text-sm text-slate-300 leading-relaxed font-sans">
                  {asset.summary}
                </p>

                {/* 2x2 Technical Specifications Grid */}
                <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-800/80">
                  {asset.specs.map((spec, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-3 flex flex-col justify-center"
                    >
                      <span className="text-[10px] uppercase font-semibold text-slate-400 font-sans">
                        {spec.label}
                      </span>
                      <span className="text-xs sm:text-sm font-bold text-slate-100 font-mono mt-0.5">
                        {spec.value}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Action Trigger */}
                <button
                  onClick={() => setSelectedAsset(asset)}
                  className="inline-flex items-center justify-center gap-2 w-full rounded-xl border border-slate-800 bg-slate-900/60 py-2.5 text-xs font-bold text-slate-200 hover:border-amber-500/40 hover:text-amber-300 hover:bg-slate-900 transition-all font-sans"
                >
                  <span>Inspect Hardware Details</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Detail Inspection Modal */}
      {selectedAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeSlideUp">
          <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl border border-amber-500/40 bg-slate-900 p-6 sm:p-8 shadow-2xl">
            {/* Close Button */}
            <button
              onClick={() => setSelectedAsset(null)}
              className="absolute top-6 right-6 flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 bg-slate-950 text-slate-300 hover:text-white hover:border-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Modal Image */}
            <div className="relative h-64 sm:h-96 w-full rounded-2xl overflow-hidden mb-6 border border-slate-800">
              <img
                src={selectedAsset.image}
                alt={selectedAsset.title}
                className="h-full w-full object-cover object-center"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-4">
                <span
                  className={`inline-block text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full border backdrop-blur-md mb-2 ${selectedAsset.categoryColor}`}
                >
                  {selectedAsset.category}
                </span>
                <h3 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
                  {selectedAsset.title}
                </h3>
              </div>
            </div>

            {/* Modal Body */}
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-sans mb-6">
              {selectedAsset.summary}
            </p>

            {/* Specifications Matrix */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {selectedAsset.specs.map((spec, idx) => (
                <div key={idx} className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
                  <div className="text-xs font-semibold text-slate-400 uppercase font-sans">
                    {spec.label}
                  </div>
                  <div className="text-base font-bold text-amber-300 font-mono mt-1">
                    {spec.value}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 pt-4 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedAsset(null)}
                className="px-6 py-2.5 rounded-full border border-slate-700 bg-slate-800 text-xs font-semibold text-white hover:bg-slate-700 transition-colors"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
