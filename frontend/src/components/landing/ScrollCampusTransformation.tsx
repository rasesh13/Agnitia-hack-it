import { motion } from 'framer-motion';
import { Sun, Wind, Battery, Leaf, Sparkles, CheckCircle2 } from 'lucide-react';

export function CampusTransformationSection() {

  return (
    <section
      id="comparison"
      className="relative w-full bg-slate-950 py-24 px-4 sm:px-6 lg:px-8 overflow-hidden"
    >
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[800px] rounded-full bg-amber-500/10 blur-[160px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 h-[400px] w-[500px] rounded-full bg-teal-500/10 blur-[140px] pointer-events-none" />

      <div className="relative mx-auto max-w-7xl">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 rounded-full border border-teal-500/30 bg-teal-500/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-widest text-teal-300 backdrop-blur-md">
            <Sparkles className="h-3.5 w-3.5 text-teal-400 animate-pulse" />
            <span>Fully Deployed Hybrid VPP Microgrid</span>
          </div>

          <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl">
            Autonomous Digital Twin of{' '}
            <span className="bg-gradient-to-r from-amber-300 via-amber-400 to-orange-400 bg-clip-text text-transparent">
              Rajasthan DTE Campus
            </span>
          </h2>

          <p className="mt-4 text-base sm:text-lg text-slate-300 leading-relaxed font-normal">
            SURYA integrates distributed rooftop solar arrays, vertical-axis wind turbines, and smart BESS storage across university buildings into a unified, zero-carbon virtual power plant.
          </p>
        </div>

        {/* The Clean Energy Campus Showcase Viewer */}
        <div className="relative overflow-hidden rounded-3xl border border-white/15 bg-slate-900/60 p-2 sm:p-4 shadow-2xl backdrop-blur-xl">
          <div className="relative aspect-16/10 w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-950">
            {/* Fully Deployed Clean Energy Campus Image */}
            <img
              src="/campus_after.png"
              alt="SURYA Hybrid Renewable Energy Microgrid with Solar PV & Wind Turbines"
              className="absolute inset-0 h-full w-full object-cover object-center filter brightness-[0.95] contrast-[1.04]"
              loading="lazy"
            />

            {/* Sheer top and bottom gradients */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-slate-950/40 pointer-events-none" />

            {/* Floating Live State Badge */}
            <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20 pointer-events-none">
              <div className="flex items-center gap-2 rounded-full border border-amber-500/50 bg-slate-950/90 px-3.5 py-1.5 text-xs font-bold text-amber-300 backdrop-blur-md shadow-xl shadow-amber-500/20">
                <Sparkles className="h-3.5 w-3.5 text-amber-400 animate-pulse" />
                <span>SURYA Hybrid VPP Active (+510 kW Clean Power)</span>
              </div>
            </div>

            {/* Interactive Callout Markers over Solar & Wind */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="absolute inset-0 z-20 pointer-events-none hidden md:block"
            >
              {/* Solar Array Callout */}
              <div className="absolute top-[28%] left-[22%] -translate-x-1/2">
                <div className="flex items-center gap-2 rounded-xl border border-amber-500/60 bg-slate-950/90 px-3 py-1.5 text-xs font-bold text-amber-300 backdrop-blur-xl shadow-2xl shadow-black/50">
                  <Sun className="h-3.5 w-3.5 text-amber-400 animate-spin" style={{ animationDuration: '12s' }} />
                  <span>450 kWp Rooftop Solar Arrays</span>
                </div>
              </div>

              {/* Wind Turbine Callout */}
              <div className="absolute top-[20%] right-[24%] translate-x-1/2">
                <div className="flex items-center gap-2 rounded-xl border border-teal-500/60 bg-slate-950/90 px-3 py-1.5 text-xs font-bold text-teal-300 backdrop-blur-xl shadow-2xl shadow-black/50">
                  <Wind className="h-3.5 w-3.5 text-teal-400 animate-bounce" style={{ animationDuration: '3s' }} />
                  <span>60 kW Helical Wind Turbines</span>
                </div>
              </div>

              {/* BESS Storage Callout */}
              <div className="absolute bottom-[20%] left-[30%]">
                <div className="flex items-center gap-2 rounded-xl border border-emerald-500/60 bg-slate-950/90 px-3 py-1.5 text-xs font-bold text-emerald-300 backdrop-blur-xl shadow-2xl shadow-black/50">
                  <Battery className="h-3.5 w-3.5 text-emerald-400" />
                  <span>1.2 MWh Smart BESS Storage</span>
                </div>
              </div>
            </motion.div>

            {/* Bottom Status Bar */}
            <div className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-6 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/80 px-3 py-1 text-xs text-slate-300 backdrop-blur-md">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span>Automatic 5-Minute AI Dispatch Loop Active</span>
              </div>
              <div className="text-xs font-mono text-slate-400 bg-slate-950/80 px-3 py-1 rounded-full border border-white/10 backdrop-blur-md">
                Rajasthan DTE Multi-Building Virtual Power Plant
              </div>
            </div>
          </div>
        </div>

        {/* Transformation Metrics Showcase */}
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-md transition-all hover:border-amber-400/30 hover:bg-white/[0.06]">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Sun className="h-5 w-5" />
            </div>
            <div className="mt-4 text-2xl font-black text-white font-mono">+450 kWp</div>
            <div className="text-xs font-semibold uppercase tracking-wider text-amber-400 mt-1">
              Rooftop Solar PV
            </div>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed">
              High-efficiency monocrystalline solar canopy and stepped rooftop arrays.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-md transition-all hover:border-teal-400/30 hover:bg-white/[0.06]">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30">
              <Wind className="h-5 w-5" />
            </div>
            <div className="mt-4 text-2xl font-black text-white font-mono">+60 kW</div>
            <div className="text-xs font-semibold uppercase tracking-wider text-teal-400 mt-1">
              Vertical-Axis Wind
            </div>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed">
              Quiet rooftop helical turbines harvesting evening gusts and thermal drafts.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-md transition-all hover:border-emerald-400/30 hover:bg-white/[0.06]">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Battery className="h-5 w-5" />
            </div>
            <div className="mt-4 text-2xl font-black text-white font-mono">1.2 MWh</div>
            <div className="text-xs font-semibold uppercase tracking-wider text-emerald-400 mt-1">
              Smart LFP Storage
            </div>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed">
              Grid-forming battery system with sub-second islanding and peak shaving.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-md transition-all hover:border-amber-400/30 hover:bg-white/[0.06]">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Leaf className="h-5 w-5" />
            </div>
            <div className="mt-4 text-2xl font-black text-white font-mono">480 MT</div>
            <div className="text-xs font-semibold uppercase tracking-wider text-amber-400 mt-1">
              Annual CO₂ Abatement
            </div>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed">
              Verifiable carbon offset credits certified under Rajasthan clean energy norms.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export default CampusTransformationSection;
