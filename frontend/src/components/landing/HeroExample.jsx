import React from 'react';
import { ImageCompareSlider } from '../core/ImageCompareSlider';
import { ArrowUpRight, Sparkles, Sun, ShieldCheck } from 'lucide-react';

/**
 * Hero Example Component
 * 
 * Demonstrates a responsive, two-column hero layout with the ImageCompareSlider
 * on the right and high-contrast typography/CTAs on the left.
 */
export function HeroExample({ onBookDemo, onWatchDispatch }) {
  return (
    <section className="relative min-h-screen w-full bg-slate-950 text-white flex items-center justify-center px-4 sm:px-6 lg:px-8 py-24 overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[700px] rounded-full bg-amber-500/10 blur-[140px] pointer-events-none" />

      <div className="relative z-10 mx-auto max-w-7xl w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          {/* Left Column: Headline, Subtext, Badges & CTAs */}
          <div className="lg:col-span-6 flex flex-col items-start space-y-6">
            {/* Eyebrow badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-widest text-amber-300 backdrop-blur-md">
              <Sun className="h-3.5 w-3.5 text-amber-400" />
              <span>RAJASTHAN DTE · HYBRID VPP</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.1]">
              Charged before the{' '}
              <span className="text-amber-400 underline decoration-amber-400/40 underline-offset-8">
                clouds
              </span>{' '}
              rolled in.
            </h1>

            {/* Subtext */}
            <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-xl">
              AI-driven hybrid solar, wind, and battery virtual power plant for Rajasthan Higher Education. Pre-charges battery storage 4 hours ahead of weather changes and optimizes building loads in real time.
            </p>

            {/* Stat Chips */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 backdrop-blur-md">
                <span className="text-xl font-bold font-mono text-amber-400">84%</span>
                <span className="text-xs font-medium text-slate-200">Solar Self-Consumption</span>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 backdrop-blur-md">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <span className="text-xs font-medium text-emerald-300">Zero-Carbon Ready</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                onClick={onBookDemo}
                className="flex items-center gap-2 rounded-full bg-slate-900 border border-amber-400/40 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-amber-500/10 hover:bg-slate-800 hover:border-amber-400 transition-all hover:scale-[1.02]"
              >
                <span>Book a Demo</span>
                <ArrowUpRight className="h-4 w-4 text-amber-400" />
              </button>

              <button
                onClick={onWatchDispatch}
                className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur-md hover:bg-white/20 transition-all"
              >
                <Sparkles className="h-4 w-4 text-teal-300" />
                <span>Watch Live Dispatch</span>
              </button>
            </div>
          </div>

          {/* Right Column: Interactive ImageCompareSlider */}
          <div className="lg:col-span-6 w-full flex flex-col items-center">
            <div className="w-full max-w-2xl">
              <ImageCompareSlider
                beforeSrc="/campus_before.png"
                afterSrc="/campus_after.png"
                beforeLabel="Baseline Campus"
                afterLabel="SURYA Hybrid VPP"
                initialPosition={50}
                aspectRatio="aspect-[16/10]"
                className="w-full"
              />
              <p className="mt-3 text-center text-xs text-slate-400">
                Drag the slider or use Arrow keys to compare campus baseline with SURYA AI renewables
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default HeroExample;
