import React, { useState, useRef, useEffect, useCallback } from 'react';

export interface ImageCompareSliderProps {
  beforeSrc: string;
  afterSrc: string;
  beforeLabel?: string;
  afterLabel?: string;
  initialPosition?: number;
  aspectRatio?: string;
  className?: string;
  beforeAlt?: string;
  afterAlt?: string;
  onPositionChange?: (position: number) => void;
}

/**
 * ImageCompareSlider
 * 
 * A high-performance, fully accessible before/after image comparison slider
 * built with pure React + Tailwind CSS and zero external slider libraries.
 * 
 * Features:
 * - Pointer Events (mouse, touch, stylus) with setPointerCapture
 * - requestAnimationFrame throttled updates for 120fps fluid dragging
 * - clip-path: inset(0 0 0 X%) reveal without image resizing or layout shift
 * - Accessible keyboard navigation (Arrow keys step 2%, Home/End)
 * - IntersectionObserver intro animation (50% -> 35% -> 65% -> 50%)
 * - Respects prefers-reduced-motion
 * - touch-action: pan-y preserves vertical mobile scrolling
 */
export const ImageCompareSlider: React.FC<ImageCompareSliderProps> = ({
  beforeSrc,
  afterSrc,
  beforeLabel = 'Before',
  afterLabel = 'After',
  initialPosition = 50,
  aspectRatio = 'aspect-[4/3]',
  className = '',
  beforeAlt = 'Before comparison image',
  afterAlt = 'After comparison image',
  onPositionChange,
}) => {
  const [position, setPosition] = useState<number>(Math.min(100, Math.max(0, initialPosition)));
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isFocused, setIsFocused] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const rafIdRef = useRef<number | null>(null);
  const isInteractedRef = useRef<boolean>(false);
  const introAnimRafRef = useRef<number | null>(null);

  // Safely clamp position to [0, 100]
  const clamp = (val: number) => Math.min(100, Math.max(0, val));

  // Update slider position with requestAnimationFrame to prevent layout thrashing
  const updatePosition = useCallback(
    (newPos: number) => {
      const clamped = clamp(newPos);
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
      rafIdRef.current = requestAnimationFrame(() => {
        setPosition(clamped);
        onPositionChange?.(clamped);
      });
    },
    [onPositionChange]
  );

  // Compute percentage from clientX coordinate
  const computePositionFromClientX = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = (x / rect.width) * 100;
    return clamp(percentage);
  }, []);

  // Stop intro animation upon any user interaction
  const stopIntroAnimation = useCallback(() => {
    isInteractedRef.current = true;
    if (introAnimRafRef.current !== null) {
      cancelAnimationFrame(introAnimRafRef.current);
      introAnimRafRef.current = null;
    }
  }, []);

  // Intro Animation on first scroll into view
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Check for prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && !isInteractedRef.current) {
          observer.disconnect();

          const duration = 1800; // 1.8 seconds total
          const startTime = performance.now();

          const animate = (currentTime: number) => {
            if (isInteractedRef.current) return;

            const elapsed = currentTime - startTime;
            const progress = Math.min(1, elapsed / duration);

            // Multi-phase sine wave oscillation: 50% -> 35% -> 65% -> 50%
            // sin(progress * 2 * PI) gives a full cycle [0 -> 1 -> 0 -> -1 -> 0]
            const easeProgress = Math.sin(progress * Math.PI);
            const delta = Math.sin(progress * Math.PI * 2) * 15 * easeProgress;
            const currentPosition = 50 - delta;

            setPosition(currentPosition);

            if (progress < 1) {
              introAnimRafRef.current = requestAnimationFrame(animate);
            } else {
              setPosition(50);
              introAnimRafRef.current = null;
            }
          };

          introAnimRafRef.current = requestAnimationFrame(animate);
        }
      },
      { threshold: 0.35 }
    );

    observer.observe(container);

    return () => {
      observer.disconnect();
      if (introAnimRafRef.current !== null) {
        cancelAnimationFrame(introAnimRafRef.current);
      }
    };
  }, []);

  // Pointer event handlers (Mouse, Touch, Pen)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    stopIntroAnimation();
    setIsDragging(true);

    const targetPos = computePositionFromClientX(e.clientX);
    if (targetPos !== undefined) {
      updatePosition(targetPos);
    }

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const targetPos = computePositionFromClientX(e.clientX);
    if (targetPos !== undefined) {
      updatePosition(targetPos);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  // Keyboard controls
  const handleKeyDown = (e: React.KeyboardEvent) => {
    stopIntroAnimation();
    let newPos = position;

    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        e.preventDefault();
        newPos = clamp(position - 2);
        break;
      case 'ArrowRight':
      case 'ArrowUp':
        e.preventDefault();
        newPos = clamp(position + 2);
        break;
      case 'PageDown':
        e.preventDefault();
        newPos = clamp(position - 10);
        break;
      case 'PageUp':
        e.preventDefault();
        newPos = clamp(position + 10);
        break;
      case 'Home':
        e.preventDefault();
        newPos = 0;
        break;
      case 'End':
        e.preventDefault();
        newPos = 100;
        break;
      default:
        return;
    }

    updatePosition(newPos);
  };

  // Cleanup pending RAF on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={`relative select-none overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/20 cursor-ew-resize touch-pan-y ${aspectRatio} ${className}`}
      style={{ touchAction: 'pan-y' }}
      aria-label="Before and after image comparison slider"
    >
      {/* 1. Base Layer: "Before" Image (Left Side) */}
      <img
        src={beforeSrc}
        alt={beforeAlt}
        draggable={false}
        loading="eager"
        // @ts-expect-error fetchpriority attribute
        fetchpriority="high"
        className="absolute inset-0 h-full w-full object-cover select-none pointer-events-none"
        width={1600}
        height={1200}
      />

      {/* 2. Top Layer: "After" Image (Right Side revealed by clip-path) */}
      <div
        className="absolute inset-0 h-full w-full overflow-hidden pointer-events-none select-none"
        style={{
          clipPath: `inset(0 0 0 ${position}%)`,
          WebkitClipPath: `inset(0 0 0 ${position}%)`,
        }}
      >
        <img
          src={afterSrc}
          alt={afterAlt}
          draggable={false}
          loading="eager"
          // @ts-expect-error fetchpriority attribute
          fetchpriority="high"
          className="absolute inset-0 h-full w-full object-cover select-none pointer-events-none"
          width={1600}
          height={1200}
        />
      </div>

      {/* 3. Vertical Divider Line */}
      <div
        className="absolute top-0 bottom-0 pointer-events-none z-20"
        style={{
          left: `${position}%`,
          transform: 'translateX(-50%)',
        }}
      >
        <div className="h-full w-[2px] bg-white shadow-[0_0_10px_rgba(0,0,0,0.6)]" />
      </div>

      {/* 4. Draggable Center Circular Handle */}
      <div
        ref={handleRef}
        role="slider"
        tabIndex={0}
        aria-label="Comparison slider position"
        aria-valuenow={Math.round(position)}
        aria-valuemin={0}
        aria-valuemax={100}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className={`absolute z-30 flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-white text-slate-900 border-[3.5px] border-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.6),0_4px_20px_rgba(0,0,0,0.5)] cursor-ew-resize transition-transform duration-150 outline-none ${
          isDragging
            ? 'scale-110 ring-4 ring-amber-400/50'
            : isFocused
            ? 'scale-105 ring-4 ring-amber-400 ring-offset-2 ring-offset-slate-900'
            : 'hover:scale-105'
        }`}
        style={{
          left: `${position}%`,
          top: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      >
        {/* Left & Right Chevron Icons */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4 text-slate-800"
          aria-hidden="true"
        >
          <polyline points="15 18 9 12 15 6" />
          <polyline points="9 6 15 12 9 18" />
        </svg>
      </div>

      {/* 5. Bottom Badges: "Baseline Campus" (Left) and "● SURYA Hybrid VPP" (Right) */}
      <div className="absolute bottom-4 left-4 z-10 pointer-events-none">
        <span className="inline-flex items-center rounded-full border border-white/20 bg-slate-950/85 px-4 py-1.5 text-xs font-bold tracking-wide text-white backdrop-blur-md shadow-xl">
          {beforeLabel}
        </span>
      </div>

      <div className="absolute bottom-4 right-4 z-10 pointer-events-none">
        <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-slate-950/85 px-4 py-1.5 text-xs font-bold tracking-wide text-amber-300 backdrop-blur-md shadow-xl">
          <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse shadow-[0_0_8px_rgba(251,191,36,0.9)]" />
          {afterLabel}
        </span>
      </div>
    </div>
  );
};

export default ImageCompareSlider;
