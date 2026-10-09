import React from 'react';
import { ArrowUp } from 'lucide-react';
import { SuryaMark } from '@/components/SuryaMark';

export const Footer: React.FC = () => {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="relative w-full bg-slate-950 border-t border-white/10 text-slate-400 text-xs">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-8 border-b border-white/10">
          {/* Col 1: Brand */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2.5">
              <SuryaMark size={34} className="shrink-0" />
              <span className="text-base font-bold text-white tracking-tight">SURYA VPP</span>
              <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold text-amber-400 border border-amber-500/20">
                Govt of Rajasthan DTE
              </span>
            </div>
            <p className="text-xs text-slate-400 max-w-md leading-relaxed">
              Smart Unified Renewable Yield Automation — An AI-driven hybrid solar, wind, and battery virtual power plant management platform for state technical campuses and industrial microgrids.
            </p>
          </div>

          {/* Col 2: Navigation Links */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 mb-3">
              Platform
            </h4>
            <ul className="space-y-2">
              <li>
                <a href="#hero" className="hover:text-amber-400 transition-colors">
                  Overview & Dispatch
                </a>
              </li>
              <li>
                <a href="#comparison" className="hover:text-amber-400 transition-colors">
                  Campus Transformation
                </a>
              </li>
              <li>
                <a href="#platform" className="hover:text-amber-400 transition-colors">
                  MPC Optimizer Architecture
                </a>
              </li>
              <li>
                <a href="#live-demo" className="hover:text-amber-400 transition-colors">
                  Live Digital Twin
                </a>
              </li>
            </ul>
          </div>

          {/* Col 3: Resources */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 mb-3">
              Resources
            </h4>
            <ul className="space-y-2">
              <li>
                <a href="#platform" className="hover:text-amber-400 transition-colors">
                  Platform Architecture
                </a>
              </li>
              <li>
                <a href="#live-demo" className="hover:text-amber-400 transition-colors">
                  Technical Specifications
                </a>
              </li>
              <li>
                <a href="#impact" className="hover:text-amber-400 transition-colors">
                  Carbon Offset Metrics
                </a>
              </li>
              <li>
                <span className="text-emerald-400 font-medium">SLDC Telemetry Active</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-[11px] text-slate-400 text-center sm:text-left">
            © {new Date().getFullYear()} Directorate of Technical Education (DTE), Government of Rajasthan. All rights reserved.
          </p>

          <button
            onClick={scrollToTop}
            className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-slate-300 hover:bg-white/10 hover:text-white transition-all"
            aria-label="Back to top"
          >
            <span>Back to top</span>
            <ArrowUp className="h-3.5 w-3.5 text-amber-400" />
          </button>
        </div>
      </div>
    </footer>
  );
};
