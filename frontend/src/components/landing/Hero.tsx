import React, { useRef, useState, useEffect } from 'react';
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from 'framer-motion';
import { ChevronDown, Sun, Wind, CheckCircle2 } from 'lucide-react';
import { HeroCarousel } from './HeroCarousel';
import { ContextualSlideWidget } from './ContextualSlideWidget';
import { DispatchData } from './DispatchCard';
import { cn } from '@/lib/utils';

export interface HeroProps {
  className?: string;
  onBookDemo?: () => void;
  onWatchDispatch?: () => void;
  onOpenReasoning?: () => void;
  onScrollToExplore?: () => void;
  liveDispatchData?: DispatchData | null;
}

export const Hero: React.FC<HeroProps> = ({
  className,
  onBookDemo,
  onWatchDispatch,
  onOpenReasoning,
  onScrollToExplore,
  liveDispatchData,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const [currentSlideIndex, setCurrentSlideIndex] = useState<number>(0);
  const [isFullyRevealed, setIsFullyRevealed] = useState<boolean>(false);
  const [displayProgress, setDisplayProgress] = useState<number>(0);

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
      const rounded = Math.round(latest);
      setDisplayProgress(rounded);
      if (latest >= 98.5) {
        setIsFullyRevealed(true);
      } else {
        setIsFullyRevealed(false);
      }
    });
    return unsubscribe;
  }, [smoothProgress]);

  // SCROLL-JACKED TRANSITION:
  // Intercept scroll at the top of the page.
  // The page CANNOT scroll down until the after-image is 100% full.
  useEffect(() => {
    // If the user loaded/refreshed already scrolled down the page, set to 100 immediately
    if (typeof window !== 'undefined' && window.scrollY > 50) {
      targetProgress.set(100);
      setIsFullyRevealed(true);
    }

    const handleWheel = (e: WheelEvent) => {
      const atTop = window.scrollY <= 5;
      const currentProg = targetProgress.get();

      // If at top of the page and scrolling DOWN:
      if (atTop && e.deltaY > 0) {
        // If the campus after image is NOT yet fully covering the background:
        if (currentProg < 100) {
          // BLOCK page scroll down!
          e.preventDefault();
          // Step progress forward by ~15-20% per notch
          const delta = Math.min(30, Math.max(12, Math.abs(e.deltaY) * 0.16));
          const next = Math.min(100, currentProg + delta);
          targetProgress.set(next);
          return;
        }
        // If currentProg >= 100, do NOT preventDefault -> page scrolls down normally!
      }

      // If at the very top and user scrolls UP:
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
        // Swiping up (trying to scroll down)
        if (deltaY > 8 && currentProg < 100) {
          if (e.cancelable) e.preventDefault();
          const step = Math.min(25, Math.abs(deltaY) * 0.28);
          targetProgress.set(Math.min(100, currentProg + step));
          touchStartY = touchY;
        }
        // Swiping down (trying to scroll up at top)
        else if (deltaY < -8 && currentProg > 0 && window.scrollY <= 2) {
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
      // If not yet full, animate to 100% full
      targetProgress.set(100);
    } else {
      // If 100% full, scroll down to the next section
      if (onScrollToExplore) {
        onScrollToExplore();
      } else {
        const nextSection = document.getElementById('comparison') || document.getElementById('platform');
        if (nextSection) {
          nextSection.scrollIntoView({ behavior: 'smooth' });
        }
      }
    }
  };

  return (
    <section
      id="hero"
      ref={containerRef}
      className={cn(
        'relative min-h-screen w-full overflow-hidden bg-slate-950 flex flex-col justify-between pt-20 pb-8 sm:pb-10 select-none',
        className
      )}
    >
      {/* ============================================================ */}
      {/* 1. SCROLL-DRIVEN RIGHT-TO-LEFT SWEEP BACKGROUND LAYERS       */}
      {/* ============================================================ */}
      <div className="absolute inset-0 z-0 pointer-events-none select-none">
        {/* Layer 1: Baseline Conventional Campus (Base) */}
        <img
          src="/campus_before.png"
          alt="Baseline Conventional Campus"
          className="absolute inset-0 h-full w-full object-cover object-center filter brightness-[0.92] contrast-[1.04]"
          loading="eager"
          // @ts-expect-error fetchpriority
          fetchpriority="high"
        />

        {/* Layer 2: SURYA Clean Energy Campus (Solar Panels & Windmills) */}
        {/* Seamless right-to-left sweep without any visible divider beam */}
        <motion.div
          className="absolute inset-0 h-full w-full overflow-hidden"
          style={{
            clipPath: shouldReduceMotion ? 'inset(0 0 0 0%)' : sweepClip,
            WebkitClipPath: shouldReduceMotion ? 'inset(0 0 0 0%)' : sweepClip,
          }}
        >
          <img
            src="/campus_after.png"
            alt="SURYA Hybrid VPP Campus with Solar Panels and Wind Turbines"
            className="absolute inset-0 h-full w-full object-cover object-center filter brightness-[0.92] contrast-[1.06]"
            loading="eager"
            // @ts-expect-error fetchpriority
            fetchpriority="high"
          />
        </motion.div>

        {/* Ambient lighting scrims for crystal clear text readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/85 via-slate-950/40 to-transparent pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-slate-950/50 pointer-events-none" />
        <div className="absolute -top-32 right-1/4 h-[500px] w-[500px] rounded-full bg-amber-500/10 blur-[140px] pointer-events-none" />

        {/* Dynamic Campus State Badges */}
        <div className="absolute bottom-6 left-6 sm:left-8 z-20 pointer-events-none">
          <motion.div
            style={{ opacity: beforeBadgeOpacity }}
            className="flex items-center gap-2 rounded-full border border-white/20 bg-slate-950/80 px-4 py-1.5 text-xs font-semibold tracking-wide text-white backdrop-blur-md shadow-2xl"
          >
            <span className="h-2 w-2 rounded-full bg-slate-400" />
            <span>Baseline Campus · Conventional</span>
          </motion.div>
        </div>

        <div className="absolute bottom-6 right-6 sm:right-8 z-20 pointer-events-none">
          <motion.div
            style={{ opacity: afterBadgeOpacity }}
            className="flex items-center gap-2 rounded-full border border-amber-500/50 bg-slate-950/85 px-4 py-1.5 text-xs font-bold tracking-wide text-amber-300 backdrop-blur-md shadow-2xl shadow-amber-500/20"
          >
            <Sun className="h-3.5 w-3.5 text-amber-400 animate-spin" style={{ animationDuration: '10s' }} />
            <Wind className="h-3.5 w-3.5 text-teal-400 animate-bounce" style={{ animationDuration: '3s' }} />
            <span>SURYA Hybrid VPP · Solar & Wind Active</span>
          </motion.div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 2. FOREGROUND HERO CONTENT (ALWAYS 100% VISIBLE & SHARP)    */}
      {/* ============================================================ */}
      <div className="relative z-10 mx-auto my-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-3 pointer-events-none">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left Column: Airy Translucent Carousel */}
          <div className="lg:col-span-7 flex flex-col justify-center pointer-events-auto">
            <div className="rounded-3xl bg-gradient-to-r from-slate-950/85 via-slate-950/55 to-slate-950/20 p-4 sm:p-6 backdrop-blur-[4px] border border-white/10 shadow-2xl">
              <HeroCarousel
                currentIndex={currentSlideIndex}
                onSlideChange={(index) => setCurrentSlideIndex(index)}
                onBookDemo={onBookDemo}
                onWatchDispatch={onWatchDispatch}
              />
            </div>
          </div>

          {/* Right Column: Dynamic Slide-Synchronized Contextual HUD Widget */}
          <div className="lg:col-span-5 flex flex-col gap-4 justify-center items-end w-full max-w-lg ml-auto pointer-events-auto">
            {/* Synchronized Contextual HUD Widget (changes dynamically per slide!) */}
            <ContextualSlideWidget
              currentSlideIndex={currentSlideIndex}
              liveDispatchData={liveDispatchData}
              onOpenReasoning={onOpenReasoning}
            />
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 3. BOTTOM SCROLL STATUS & EXPLORE INDICATOR                 */}
      {/* ============================================================ */}
      <div className="relative z-10 mx-auto flex flex-col items-center justify-center pointer-events-auto">
        <button
          onClick={handleScrollClick}
          className="group flex flex-col items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-slate-400 transition-colors hover:text-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-full px-5 py-2"
          aria-label="Scroll down through transformation"
        >
          {/* Dynamic indicator text */}
          <div className="relative h-4 w-80 text-center">
            {!isFullyRevealed ? (
              <span className="text-[11px] text-white/90 group-hover:text-amber-300 font-mono tracking-wider flex items-center justify-center gap-1.5">
                <span>Scroll to drag transform campus ({displayProgress}%)</span>
                <span className="text-amber-400">▶</span>
              </span>
            ) : (
              <span className="text-[11px] text-amber-300 font-mono font-bold tracking-wider flex items-center justify-center gap-1.5 animate-pulse">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span>Campus 100% Full · Scroll down to explore ↓</span>
              </span>
            )}
          </div>

          <motion.div
            animate={{
              y: shouldReduceMotion ? 0 : [0, 5, 0],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full border backdrop-blur-md shadow-lg transition-colors",
              isFullyRevealed
                ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-300"
                : "border-amber-500/30 bg-slate-950/80 text-amber-400 group-hover:border-amber-400 group-hover:bg-amber-500/20"
            )}
          >
            <ChevronDown className="h-4 w-4" />
          </motion.div>
        </button>
      </div>

      {/* Bottom seamless dissolve into next section */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent z-[5]" />
    </section>
  );
};
