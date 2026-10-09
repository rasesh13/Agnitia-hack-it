import React from 'react';
import { ArrowRight, Sun, Shield, Terminal, BookOpen, ExternalLink } from 'lucide-react';

interface FooterSectionProps {
  onLaunchConsole?: () => void;
  onLogin?: () => void;
}

export const FooterSection: React.FC<FooterSectionProps> = ({
  onLaunchConsole,
  onLogin,
}) => {
  return (
    <footer id="footer-section" className="relative bg-slate-950 pt-20 pb-12 overflow-hidden">
      <div className="section-divider section-divider-top" />

      {/* Final CTA Banner */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-20">
        <div className="gsap-reveal relative overflow-hidden rounded-3xl border border-amber-500/30 bg-gradient-to-b from-slate-900/80 via-slate-950/90 to-slate-950 p-8 sm:p-12 lg:p-16 text-center backdrop-blur-xl shadow-2xl shadow-black/80">
          {/* Subtle Ambient Radial Light */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/10 blur-[100px] pointer-events-none rounded-full" />

          <div className="relative z-10 max-w-3xl mx-auto space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs font-semibold text-amber-300">
              <Shield className="h-3.5 w-3.5" />
              <span>PRODUCTION-READY MICROGRID CONTROL</span>
            </div>

            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white">
              Operate Campus Energy With Mathematical Precision
            </h2>

            <p className="text-sm sm:text-base text-slate-300 font-sans leading-relaxed">
              Transition from manual setpoint adjustments to autonomous closed-loop optimization.
              Monitor live BESS state, enforce zero-leakage virtual net metering, and protect battery lifecycle.
            </p>

            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={onLaunchConsole}
                className="group inline-flex items-center gap-3 rounded-full border border-amber-500/50 bg-gradient-to-r from-amber-500/30 via-amber-600/30 to-emerald-500/30 px-8 py-3.5 text-sm font-bold text-white shadow-xl shadow-amber-950/60 backdrop-blur-md transition-all duration-300 hover:border-amber-400 hover:scale-105 active:scale-95"
              >
                <span className="font-display tracking-wide">Open Operations Dashboard</span>
                <ArrowRight className="h-4 w-4 text-amber-400 transition-transform group-hover:translate-x-1" />
              </button>

              {onLogin && (
                <button
                  onClick={onLogin}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/60 px-6 py-3.5 text-sm font-medium text-slate-300 hover:border-slate-700 hover:text-white transition-all"
                >
                  <span>Operator Login</span>
                </button>
              )}
            </div>

            <div className="pt-4 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400 font-mono">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                115 Tests Passing
              </span>
              <span>•</span>
              <span>≤0.5C BESS Guard</span>
              <span>•</span>
              <span>100% VNM Allocation</span>
              <span>•</span>
              <span>0.82 kg CO₂e/kWh Baseline</span>
            </div>
          </div>
        </div>
      </div>

      {/* Technical Footer Links & Stack Information */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-slate-900 pt-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* Brand Column */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-tr from-amber-500 to-emerald-500 p-0.5">
                <div className="flex h-full w-full items-center justify-center rounded-full bg-slate-950">
                  <Sun className="h-4 w-4 text-amber-400" />
                </div>
              </div>
              <span className="text-lg font-bold tracking-tight text-white font-display">SURYA</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed font-sans max-w-md">
              Smart Unified Renewable Yield Automation. Production-grade microgrid energy management
              engineered for multi-building commercial, academic, and industrial campuses. Zero simulation policy.
            </p>
            <div className="text-[11px] text-slate-400 font-mono">
              Stack: FastAPI • SQLAlchemy 2.0 • PostgreSQL 16 • React 18 • Vite • Docker
            </div>
          </div>

          {/* Quickstart Column */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-display mb-3 flex items-center gap-1.5">
              <Terminal className="h-3.5 w-3.5 text-amber-400" />
              Quickstart
            </h4>
            <ul className="space-y-2 text-xs text-slate-400 font-mono">
              <li>docker compose up -d</li>
              <li>port 80: Web Console</li>
              <li>port 8000: FastAPI Engine</li>
              <li>port 80/health: Health Probe</li>
            </ul>
          </div>

          {/* Architecture & Docs Column */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-display mb-3 flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5 text-emerald-400" />
              Specifications
            </h4>
            <ul className="space-y-2 text-xs text-slate-400 font-sans">
              <li className="flex items-center gap-1.5 hover:text-slate-200 transition-colors">
                <ExternalLink className="h-3 w-3 text-slate-400" />
                <span>docs/ARCHITECTURE.md</span>
              </li>
              <li className="flex items-center gap-1.5 hover:text-slate-200 transition-colors">
                <ExternalLink className="h-3 w-3 text-slate-400" />
                <span>docs/OPERATIONS.md</span>
              </li>
              <li className="flex items-center gap-1.5 hover:text-slate-200 transition-colors">
                <ExternalLink className="h-3 w-3 text-slate-400" />
                <span>docs/API.md</span>
              </li>
              <li className="flex items-center gap-1.5 hover:text-slate-200 transition-colors">
                <ExternalLink className="h-3 w-3 text-slate-400" />
                <span>spec.md</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Legal & Attribution */}
        <div className="pt-8 border-t border-slate-900/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400 font-sans">
          <p>© 2026 SURYA Platform. Developed for Agnitia Hackathon 2026.</p>
          <p className="font-mono text-[11px] text-slate-400">
            Zero Simulation Policy • Real Telemetry Only
          </p>
        </div>
      </div>
    </footer>
  );
};
