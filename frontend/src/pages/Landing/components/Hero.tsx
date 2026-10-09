import React, { useRef, useState, useEffect } from 'react';
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  Sun,
  Wind,
  Battery,
  ShieldCheck,
  ChevronDown,
  Sparkles,
  Zap,
  Activity,
  CheckCircle2,
} from 'lucide-react';

export interface HeroProps {
  onLaunchConsole?: () => void;
  onLogin?: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onLaunchConsole, onLogin }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const [isFullyRevealed, setIsFullyRevealed] = useState<boolean>(false);

  // MotionValue for target progress (0 to 100)
  const targetProgress = useMotionValue(0);

  // Spring animation for buttery-smooth 60/120fps motion
  const smoothProgress = useSpring(targetProgress, {
    stiffness: 160,
    damping: 24,
    mass: 0.6,
  });

  // Track progress and update state
  useEffect(() => {
    const unsubscribe = smoothProgress.on('change', (latest) => {
      if (latest >= 98.5) {
        setIsFullyRevealed(true);
      } else {
        setIsFullyRevealed(false);
      }
    });
    return unsubscribe;
  }, [smoothProgress]);

  // SCROLL-JACKED TRANSITION (final4 locked mechanism):
  // Intercept scroll at the top of the page.
  // The page CANNOT scroll down past the hero until campus_after.png is 100% fully covering the background.
  useEffect(() => {
    if (typeof window !== 'undefined' && window.scrollY > 50) {
      targetProgress.set(100);
      setIsFullyRevealed(true);
    }

    const handleWheel = (e: WheelEvent) => {
      const atTop = window.scrollY <= 5;
      const currentProg = targetProgress.get();

      // If at top of the page and scrolling DOWN:
      if (atTop && e.deltaY > 0) {
        if (currentProg < 100) {
          e.preventDefault();
          const delta = Math.min(30, Math.max(12, Math.abs(e.deltaY) * 0.16));
          const next = Math.min(100, currentProg + delta);
          targetProgress.set(next);
          return;
        }
      }

      // If at top and scrolling UP:
      if (atTop && e.deltaY < 0 && window.scrollY <= 2) {
        if (currentProg > 0) {
          e.preventDefault();
          const delta = Math.min(30, Math.max(12, Math.abs(e.deltaY) * 0.16));
          const next = Math.max(0, currentProg - delta);
          targetProgress.set(next);
          return;
        }
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [targetProgress]);

  // Touch swipe support for mobile/touchpads
  useEffect(() => {
    let touchStartY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        touchStartY = e.touches[0].clientY;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 0) return;
      const touchY = e.touches[0].clientY;
      const deltaY = touchStartY - touchY;
      const atTop = window.scrollY <= 5;
      const currentProg = targetProgress.get();

      if (atTop) {
        if (deltaY > 8 && currentProg < 100) {
          if (e.cancelable) e.preventDefault();
          const step = Math.min(25, Math.abs(deltaY) * 0.28);
          targetProgress.set(Math.min(100, currentProg + step));
          touchStartY = touchY;
        } else if (deltaY < -8 && currentProg > 0 && window.scrollY <= 2) {
          if (e.cancelable) e.preventDefault();
          const step = Math.min(25, Math.abs(deltaY) * 0.28);
          targetProgress.set(Math.max(0, currentProg - step));
          touchStartY = touchY;
        }
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
    };
  }, [targetProgress]);

  // Keyboard navigation support (ArrowDown / PageDown / Space)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const atTop = window.scrollY <= 5;
      const currentProg = targetProgress.get();

      if (atTop && ['ArrowDown', 'PageDown', ' '].includes(e.key) && currentProg < 100) {
        e.preventDefault();
        targetProgress.set(Math.min(100, currentProg + 25));
      } else if (atTop && ['ArrowUp', 'PageUp'].includes(e.key) && currentProg > 0 && window.scrollY <= 2) {
        e.preventDefault();
        targetProgress.set(Math.max(0, currentProg - 25));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [targetProgress]);

  // Derived transforms:
  // sweepPercent: 100 (at progress 0) -> 0 (at progress 100)
  const sweepPercent = useTransform(smoothProgress, [0, 100], [100, 0]);
  const sweepClip = useTransform(sweepPercent, (v) => `inset(0 0 0 ${Math.max(0, Math.min(100, v))}%)`);

  // Badges opacity
  const beforeBadgeOpacity = useTransform(smoothProgress, [60, 95], [1, 0]);
  const afterBadgeOpacity = useTransform(smoothProgress, [5, 40], [0.3, 1]);

  const handleScrollClick = () => {
    if (targetProgress.get() < 98) {
      targetProgress.set(100);
    } else {
      const el = document.getElementById('assets-showcase') || document.getElementById('principle-section');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <section
      id="hero"
      ref={containerRef}
      className="relative min-h-screen w-full overflow-hidden bg-slate-950 flex flex-col justify-between pt-4 pb-6 select-none"
    >
      {/* ============================================================ */}
      {/* 1. SCROLL-LOCKED RIGHT-TO-LEFT BACKGROUND WIPE               */}
      {/* ============================================================ */}
      <div data-anim="hero-bg" className="absolute inset-0 z-0 pointer-events-none select-none">
        {/* Layer 1: Baseline Conventional Campus Image */}
        <img
          src="/campus_before.png"
          alt="Prestige University Baseline Campus"
          className="absolute inset-0 h-full w-full object-cover object-center filter brightness-[0.92] contrast-[1.04]"
          loading="eager"
        />

        {/* Layer 2: Clean Energy Transformed Campus (Solar Panels & Turbines) */}
        {/* Clean right-to-left wipe driven by scroll progress */}
        <motion.div
          className="absolute inset-0 h-full w-full overflow-hidden"
          style={{
            clipPath: shouldReduceMotion ? 'inset(0 0 0 0%)' : sweepClip,
            WebkitClipPath: shouldReduceMotion ? 'inset(0 0 0 0%)' : sweepClip,
          }}
        >
          <img
            src="/campus_after.png"
            alt="SURYA Clean Energy Microgrid at Prestige University Indore"
            className="absolute inset-0 h-full w-full object-cover object-center filter brightness-[0.94] contrast-[1.06]"
            loading="eager"
          />
        </motion.div>

        {/* Ambient Lighting Gradients for High Readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/60 to-slate-950/30 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-slate-950/70 pointer-events-none" />
        <div className="absolute top-1/4 right-1/4 h-[500px] w-[500px] rounded-full bg-amber-500/15 blur-[160px] pointer-events-none" />

        {/* Campus State Badges */}
        <div className="absolute bottom-6 left-6 z-20 pointer-events-none hidden sm:block">
          <motion.div
            style={{ opacity: beforeBadgeOpacity }}
            className="flex items-center gap-2 rounded-full border border-white/20 bg-slate-950/80 px-4 py-1.5 text-xs font-semibold tracking-wide text-white backdrop-blur-md shadow-2xl"
          >
            <span className="h-2 w-2 rounded-full bg-slate-400" />
            <span>Prestige University · Baseline (Conventional Grid Only)</span>
          </motion.div>
        </div>

        <div className="absolute bottom-6 right-6 z-20 pointer-events-none hidden sm:block">
          <motion.div
            style={{ opacity: afterBadgeOpacity }}
            className="flex items-center gap-2 rounded-full border border-amber-500/50 bg-slate-950/85 px-4 py-1.5 text-xs font-bold tracking-wide text-amber-300 backdrop-blur-md shadow-2xl shadow-amber-500/20"
          >
            <Sun className="h-3.5 w-3.5 text-amber-400 animate-spin" style={{ animationDuration: '10s' }} />
            <Wind className="h-3.5 w-3.5 text-teal-400 animate-bounce" style={{ animationDuration: '3s' }} />
            <span>SURYA Hybrid Microgrid · 450 kW Solar + 60 kW Wind Active</span>
          </motion.div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 2. TOP GLASS NAVIGATION                                      */}
      {/* ============================================================ */}
      <header className="relative z-30 pt-3 px-4 sm:px-8 max-w-7xl mx-auto w-full flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-tr from-amber-500 via-amber-400 to-emerald-500 p-0.5 shadow-lg shadow-amber-500/20">
            <div className="flex h-full w-full items-center justify-center rounded-full bg-slate-950">
              <Sun className="h-5 w-5 text-amber-400" />
            </div>
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight text-white font-display">SURYA</span>
            <span className="ml-2 hidden text-[11px] font-semibold uppercase tracking-wider text-emerald-400 sm:inline-block">
              Clean Energy Microgrid
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          {onLogin && (
            <button
              onClick={onLogin}
              className="text-xs font-semibold text-slate-300 hover:text-white px-3 py-1.5 transition-colors"
            >
              Sign In
            </button>
          )}
          <button
            onClick={onLaunchConsole}
            className="glass-nav-hero flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-amber-300 hover:text-amber-200 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-amber-950/40"
          >
            <span>Operations Console</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {/* ============================================================ */}
      {/* 3. FOREGROUND HERO CONTENT (HERO COPY + DISPATCH HUD)       */}
      {/* ============================================================ */}
      <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 w-full flex-1 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left Column: Headline and Positioning */}
          <div data-anim="hero-text" className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-3.5 py-1 text-xs font-bold text-amber-300 backdrop-blur-md shadow-lg shadow-amber-500/10">
              <Sparkles className="h-3.5 w-3.5 text-amber-400 animate-pulse" />
              <span>PRESTIGE UNIVERSITY INDORE · MICROGRID AUTOMATION</span>
            </div>

            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.1]">
              Autonomous{' '}
              <span className="bg-gradient-to-r from-amber-300 via-amber-400 to-emerald-400 bg-clip-text text-transparent">
                Clean Energy Microgrid
              </span>{' '}
              Intelligence
            </h1>

            <p className="text-sm sm:text-base text-slate-300 max-w-2xl font-sans leading-relaxed">
              Real-time closed-loop scalarized dispatch of <strong className="text-amber-300 font-semibold">450 kWp stepped rooftop solar</strong>,{' '}
              <strong className="text-teal-300 font-semibold">60 kW helical wind turbines</strong>, and{' '}
              <strong className="text-emerald-300 font-semibold">1.2 MWh BESS storage</strong>. Zero synthetic simulators. Authentic hardware telemetry with sub-second resilience.
            </p>

            {/* Live Telemetry Chips */}
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-slate-900/80 px-3 py-1.5 text-xs backdrop-blur-md">
                <Sun className="h-4 w-4 text-amber-400" />
                <span className="text-slate-300 font-medium">Solar Irradiance:</span>
                <span className="font-mono font-bold text-amber-300">842 W/m²</span>
              </div>

              <div className="flex items-center gap-2 rounded-xl border border-teal-500/30 bg-slate-900/80 px-3 py-1.5 text-xs backdrop-blur-md">
                <Wind className="h-4 w-4 text-teal-400" />
                <span className="text-slate-300 font-medium">Wind Speed:</span>
                <span className="font-mono font-bold text-teal-300">6.2 m/s</span>
              </div>

              <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-slate-900/80 px-3 py-1.5 text-xs backdrop-blur-md">
                <Battery className="h-4 w-4 text-emerald-400" />
                <span className="text-slate-300 font-medium">BESS SoC:</span>
                <span className="font-mono font-bold text-emerald-300">78.4% (≤0.5C)</span>
              </div>
            </div>

            {/* CTAs */}
            <div className="pt-2 flex flex-wrap items-center gap-4">
              <button
                onClick={onLaunchConsole}
                className="group inline-flex items-center gap-3 rounded-full border border-amber-500/50 bg-gradient-to-r from-amber-500 via-amber-600 to-emerald-600 px-8 py-3.5 text-sm font-bold text-white shadow-xl shadow-amber-950/60 backdrop-blur-md transition-all duration-300 hover:border-amber-300 hover:scale-105 active:scale-95"
              >
                <span className="font-display tracking-wide">Open Operations Dashboard</span>
                <ArrowRight className="h-4 w-4 text-amber-200 transition-transform group-hover:translate-x-1" />
              </button>

              <button
                onClick={handleScrollClick}
                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-slate-900/70 px-6 py-3.5 text-sm font-semibold text-slate-200 hover:border-white/40 hover:text-white transition-all backdrop-blur-md"
              >
                <Activity className="h-4 w-4 text-emerald-400" />
                <span>Explore Campus Assets</span>
              </button>
            </div>
          </div>

          {/* Right Column: Live Autonomous Dispatch HUD Card */}
          <div className="lg:col-span-5 w-full max-w-md lg:ml-auto">
            <div data-anim="hero-card" className="relative overflow-hidden rounded-3xl border border-amber-500/40 bg-slate-950/85 p-6 backdrop-blur-xl shadow-2xl shadow-black/80">
              {/* Radial Glow */}
              <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-amber-500/20 blur-3xl pointer-events-none" />

              {/* Card Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                  <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider">
                    Autonomous Dispatch
                  </span>
                </div>
                <span className="text-[11px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                  Cycle #8492 · 5m Sync
                </span>
              </div>

              {/* Action Title */}
              <div className="mt-4">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-400">
                  Target Optimization Action
                </div>
                <div className="text-lg font-bold font-display text-white mt-1 flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-400" />
                  <span>BESS PRE-CHARGE & VNM OPTIMIZE</span>
                </div>
                <p className="mt-2 text-xs text-slate-300 leading-relaxed font-sans bg-slate-900/60 p-3 rounded-xl border border-slate-800/60">
                  Solar forecast projects 22% cloud attenuation at 14:15. Dispatching <strong className="text-amber-300 font-semibold">+120 kW</strong> into BESS to lock 88% SoC before evening Time-of-Day peak tariff window.
                </p>
              </div>

              {/* Live Metric Gauges */}
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
                  <span className="text-[10px] font-medium uppercase text-slate-400">Target Asset</span>
                  <div className="text-xs font-bold text-slate-200 mt-0.5">LFP-BESS-01 (1.2 MWh)</div>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
                  <span className="text-[10px] font-medium uppercase text-slate-400">Confidence Score</span>
                  <div className="text-xs font-bold text-emerald-400 mt-0.5 font-mono">99.2% Optimal</div>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
                  <span className="text-[10px] font-medium uppercase text-slate-400">Total Generation</span>
                  <div className="text-xs font-bold text-amber-300 mt-0.5 font-mono">384.6 kW Clean</div>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
                  <span className="text-[10px] font-medium uppercase text-slate-400">Expected Savings</span>
                  <div className="text-xs font-bold text-emerald-400 mt-0.5 font-mono">+₹12,450 / cycle</div>
                </div>
              </div>

              {/* Battery SoC Progress Bar */}
              <div className="mt-4 pt-3 border-t border-slate-800/80">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-slate-400">Battery SoC Level</span>
                  <span className="font-mono font-bold text-emerald-400">78.4% (Max Rate: 0.5C)</span>
                </div>
                <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-amber-400 rounded-full transition-all duration-500"
                    style={{ width: '78.4%' }}
                  />
                </div>
              </div>

              {/* Bottom Assurance */}
              <div className="mt-4 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Degradation Guard Active</span>
                </span>
                <span className="text-emerald-400 font-semibold">Grid: -42.0 kW (Neutral)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 4. BOTTOM SCROLL INDICATOR                                   */}
      {/* ============================================================ */}
      <div className="relative z-20 pb-2 flex flex-col items-center justify-center pointer-events-auto">
        <button
          data-anim="scroll-indicator"
          onClick={handleScrollClick}
          className="group flex flex-col items-center gap-1 text-xs font-semibold uppercase tracking-widest text-slate-400 hover:text-amber-300 transition-colors"
        >
          <span className="text-[11px] font-mono tracking-wider flex items-center gap-1.5 text-amber-300">
            {!isFullyRevealed ? (
              <>
                <span>Scroll to transform campus microgrid</span>
                <span className="text-amber-400">▶</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-emerald-300">Microgrid 100% Full · Scroll down to explore ↓</span>
              </>
            )}
          </span>

          <motion.div
            animate={{
              y: shouldReduceMotion ? 0 : [0, 4, 0],
            }}
            transition={{
              duration: 1.8,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className="flex h-6 w-6 items-center justify-center rounded-full border border-amber-500/40 bg-slate-950/80 text-amber-400"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </motion.div>
        </button>
      </div>

      {/* Bottom dissolve gradient */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-slate-950 via-slate-950/70 to-transparent z-[5]" />
    </section>
  );
};
