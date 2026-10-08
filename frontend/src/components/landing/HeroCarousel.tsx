import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ChevronLeft, ChevronRight, ArrowUpRight, Sparkles } from 'lucide-react';
import { HERO_SLIDES, HeroSlide } from '@/data/heroSlides';
import { cn } from '@/lib/utils';

export interface HeroCarouselProps {
  className?: string;
  onBookDemo?: () => void;
  onWatchDispatch?: () => void;
  currentIndex?: number;
  onSlideChange?: (index: number) => void;
}

const AUTO_ADVANCE_DURATION = 6000; // 6 seconds

export const HeroCarousel: React.FC<HeroCarouselProps> = ({
  className,
  onBookDemo,
  onWatchDispatch,
  currentIndex: externalIndex,
  onSlideChange,
}) => {
  const [internalIndex, setInternalIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const shouldReduceMotion = useReducedMotion();
  const touchStartXRef = useRef<number | null>(null);
  const touchEndXRef = useRef<number | null>(null);

  const totalSlides = HERO_SLIDES.length;
  const currentIndex = externalIndex !== undefined ? externalIndex : internalIndex;
  const currentSlide: HeroSlide = HERO_SLIDES[currentIndex];

  const updateSlide = useCallback(
    (newIndex: number) => {
      setInternalIndex(newIndex);
      onSlideChange?.(newIndex);
      setProgress(0);
    },
    [onSlideChange]
  );

  const goToNext = useCallback(() => {
    updateSlide((currentIndex + 1) % totalSlides);
  }, [currentIndex, totalSlides, updateSlide]);

  const goToPrev = useCallback(() => {
    updateSlide((currentIndex - 1 + totalSlides) % totalSlides);
  }, [currentIndex, totalSlides, updateSlide]);

  const goToSlide = useCallback(
    (index: number) => {
      updateSlide(index);
    },
    [updateSlide]
  );

  // Timer & Progress Animation Loop
  useEffect(() => {
    if (isPaused) return;

    const intervalTime = 50; // update progress every 50ms
    const step = (intervalTime / AUTO_ADVANCE_DURATION) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev + step >= 100) {
          goToNext();
          return 0;
        }
        return prev + step;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [isPaused, goToNext]);

  // Keyboard navigation support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Avoid intercepting input fields
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      if (e.key === 'ArrowRight') {
        goToNext();
      } else if (e.key === 'ArrowLeft') {
        goToPrev();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToNext, goToPrev]);

  // Touch Swipe Handling
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartXRef.current || !touchEndXRef.current) return;
    const distance = touchStartXRef.current - touchEndXRef.current;
    const minSwipeDistance = 50;

    if (distance > minSwipeDistance) {
      goToNext();
    } else if (distance < -minSwipeDistance) {
      goToPrev();
    }
    touchStartXRef.current = null;
    touchEndXRef.current = null;
  };

  return (
    <div
      className={cn('relative w-full select-none flex flex-col justify-between', className)}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      tabIndex={0}
      role="region"
      aria-roledescription="carousel"
      aria-label="SURYA Key Capabilities Highlights"
    >
      {/* Slide Content with AnimatePresence */}
      <div className="relative min-h-[380px] sm:min-h-[340px] lg:min-h-[360px] flex flex-col justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide.id}
            initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: shouldReduceMotion ? 0 : -14 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col items-start"
          >
            {/* Eyebrow badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1 text-xs font-semibold tracking-wider text-amber-300 backdrop-blur-md shadow-sm">
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
              <span>{currentSlide.eyebrow}</span>
            </div>

            {/* Main Headline */}
            <h1 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white max-w-2xl leading-[1.16]">
              {currentSlide.headlinePrefix}
              <span className="bg-gradient-to-r from-amber-300 via-amber-400 to-orange-400 bg-clip-text text-transparent">
                {currentSlide.accentWord}
              </span>
              {currentSlide.headlineSuffix}
            </h1>

            {/* Subtext */}
            <p className="mt-3.5 text-sm sm:text-base text-slate-200/90 max-w-xl leading-relaxed font-normal">
              {currentSlide.subtext}
            </p>

            {/* Key Stat & Feature Chips */}
            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              {/* Primary Stat Chip */}
              <div className="flex items-center gap-2 rounded-full border border-white/20 bg-slate-950/60 px-3.5 py-1.5 backdrop-blur-md shadow-lg">
                <span className="text-base sm:text-lg font-bold font-mono text-amber-300">
                  {currentSlide.statValue}
                </span>
                <span className="text-xs font-medium text-slate-200">
                  {currentSlide.statLabel}
                </span>
              </div>

              {/* Secondary Stat Chip if available */}
              {currentSlide.secondaryStat && (
                <div className="hidden sm:flex items-center gap-2 rounded-full border border-emerald-500/30 bg-slate-950/60 px-3.5 py-1.5 backdrop-blur-md">
                  <span className="text-xs font-bold font-mono text-emerald-400">
                    {currentSlide.secondaryStat.value}
                  </span>
                  <span className="text-xs text-slate-300">
                    {currentSlide.secondaryStat.label}
                  </span>
                </div>
              )}
            </div>

            {/* Action Buttons (CTAs) */}
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button
                onClick={onBookDemo}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-6 py-2.5 text-sm font-semibold text-white border border-amber-400/50 shadow-[0_0_20px_rgba(245,158,11,0.2)] hover:shadow-[0_0_25px_rgba(245,158,11,0.4)] hover:border-amber-400 hover:scale-[1.02] transition-all focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                <span>Book a Demo</span>
                <ArrowUpRight className="h-4 w-4 text-amber-400" />
              </button>

              <button
                onClick={onWatchDispatch}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-md hover:bg-white/20 transition-all focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                <Sparkles className="h-4 w-4 text-teal-300" />
                <span>Watch Live Dispatch</span>
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Carousel Controls Bar */}
      <div className="mt-8 sm:mt-10 flex items-center justify-between border-t border-white/10 pt-4">
        {/* Left: Slim Progress Indicators */}
        <div className="flex items-center gap-2">
          {HERO_SLIDES.map((slide, idx) => {
            const isActive = idx === currentIndex;
            const isCompleted = idx < currentIndex;
            return (
              <button
                key={slide.id}
                onClick={() => goToSlide(idx)}
                aria-label={`Go to slide ${idx + 1}: ${slide.statLabel}`}
                className="group relative h-2.5 w-12 sm:w-16 rounded-full overflow-hidden bg-white/15 transition-all hover:bg-white/25 focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                <div
                  className="absolute inset-y-0 left-0 bg-amber-400 transition-all"
                  style={{
                    width: isCompleted ? '100%' : isActive ? `${progress}%` : '0%',
                    transition: isActive ? 'width 50ms linear' : 'none',
                  }}
                />
              </button>
            );
          })}
        </div>

        {/* Right: Slide Counter & Prev/Next Glass Arrow Buttons */}
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="text-xs font-mono font-medium tracking-wider text-slate-300">
            <span className="text-amber-400 font-bold">{currentSlide.slideNumber}</span>
            <span className="text-slate-500 mx-1">/</span>
            <span className="text-slate-400">0{totalSlides}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={goToPrev}
              aria-label="Previous slide"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white backdrop-blur-md transition-all hover:bg-white/20 hover:border-amber-400/40 hover:text-amber-300 focus-visible:ring-2 focus-visible:ring-amber-400 active:scale-95"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <button
              onClick={goToNext}
              aria-label="Next slide"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white backdrop-blur-md transition-all hover:bg-white/20 hover:border-amber-400/40 hover:text-amber-300 focus-visible:ring-2 focus-visible:ring-amber-400 active:scale-95"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
