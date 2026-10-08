import React, { useState, useRef, useEffect, useCallback } from 'react';

/**
 * ImageCompareSlider Component
 * 
 * A high-performance, accessible before/after image comparison slider
 * built with pure React + Tailwind CSS without any external dependencies.
 * 
 * @param {Object} props
 * @param {string} props.beforeSrc - Path or URL to the "before" image (left)
 * @param {string} props.afterSrc - Path or URL to the "after" image (right)
 * @param {string} [props.beforeLabel="Before"] - Text label for the before badge
 * @param {string} [props.afterLabel="After"] - Text label for the after badge
 * @param {number} [props.initialPosition=50] - Initial split percentage [0-100]
 * @param {string} [props.aspectRatio="aspect-[4/3]"] - Tailwind aspect ratio class
 * @param {string} [props.className=""] - Additional container classes
 * @param {string} [props.beforeAlt="Before comparison image"] - Alt text for before image
 * @param {string} [props.afterAlt="After comparison image"] - Alt text for after image
 * @param {function} [props.onPositionChange] - Optional callback fired with current percentage
 */
export function ImageCompareSlider({
  beforeSrc,
  afterSrc,
  beforeLabel = 'Before',
  afterLabel = 'After',
  initialPosition = 50,
  aspectRatio = 'aspect-[4/3]',
  className = '',
  beforeAlt = 'Before image',
  afterAlt = 'After image',
  onPositionChange,
}) {
  const [position, setPosition] = useState(() =>
    Math.min(100, Math.max(0, initialPosition))
  );
  const [isDragging, setIsDragging] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const containerRef = useRef(null);
  const handleRef = useRef(null);
  const rafIdRef = useRef(null);
  const isInteractedRef = useRef(false);
  const introAnimRafRef = useRef(null);

  // Helper to clamp value strictly between 0 and 100
  const clamp = (val) => Math.min(100, Math.max(0, val));

  // Throttled update using requestAnimationFrame to ensure smooth 60fps+ dragging
  const updatePosition = useCallback(
    (newPos) => {
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

  // Computes percentage position from a clientX coordinate
  const computePositionFromClientX = useCallback((clientX) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = (x / rect.width) * 100;
    return clamp(percentage);
  }, []);

  // Stops intro animation if user clicks, touches, or uses keyboard
  const stopIntroAnimation = useCallback(() => {
    isInteractedRef.current = true;
    if (introAnimRafRef.current !== null) {
      cancelAnimationFrame(introAnimRafRef.current);
      introAnimRafRef.current = null;
    }
  }, []);

  // Intro animation: Runs once when scrolled into view (50% -> 35% -> 65% -> 50%)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Skip animation if user prefers reduced motion
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && !isInteractedRef.current) {
          observer.disconnect();

          const duration = 1800; // 1.8s
          const startTime = performance.now();

          const animate = (currentTime) => {
            if (isInteractedRef.current) return;

            const elapsed = currentTime - startTime;
            const progress = Math.min(1, elapsed / duration);

            // Sine oscillation: 50 -> 35 -> 65 -> 50
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

  // Pointer event handlers for cross-platform unified touch + mouse support
  const handlePointerDown = (e) => {
    stopIntroAnimation();
    setIsDragging(true);

    const targetPos = computePositionFromClientX(e.clientX);
    if (targetPos !== undefined) {
      updatePosition(targetPos);
    }

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // safe fallback
    }
  };

  const handlePointerMove = (e) => {
    if (!isDragging) return;
    const targetPos = computePositionFromClientX(e.clientX);
    if (targetPos !== undefined) {
      updatePosition(targetPos);
    }
  };

  const handlePointerUp = (e) => {
    setIsDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // safe fallback
    }
  };

  // Accessible keyboard controls
  const handleKeyDown = (e) => {
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

  // Clean up any pending RAF on unmount
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
      {/* Base Layer: "Before" Image (Left Side) */}
      <img
        src={beforeSrc}
        alt={beforeAlt}
        draggable={false}
        loading="eager"
        fetchpriority="high"
        className="absolute inset-0 h-full w-full object-cover select-none pointer-events-none"
        width={1600}
        height={1200}
      />

      {/* Top Layer: "After" Image (Right Side revealed with clip-path) */}
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
          fetchpriority="high"
          className="absolute inset-0 h-full w-full object-cover select-none pointer-events-none"
          width={1600}
          height={1200}
        />
      </div>

      {/* Divider Line */}
      <div
        className="absolute top-0 bottom-0 pointer-events-none z-20"
        style={{
          left: `${position}%`,
          transform: 'translateX(-50%)',
        }}
      >
        <div className="h-full w-[2px] bg-white shadow-[0_0_10px_rgba(0,0,0,0.6)]" />
      </div>

      {/* Circular Draggable Handle */}
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
        className={`absolute z-30 flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-full bg-white text-slate-900 shadow-[0_4px_20px_rgba(0,0,0,0.45)] border-2 border-white cursor-ew-resize transition-transform duration-150 outline-none ${
          isDragging
            ? 'scale-110 ring-4 ring-amber-400/50 shadow-amber-500/30'
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
        {/* Chevron Icons */}
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
          <polyline points="9 18 3 12 9 6" />
        </svg>
      </div>

      {/* Before Pill Label */}
      <div className="absolute bottom-3.5 left-3.5 z-10 pointer-events-none">
        <span className="inline-flex items-center rounded-full border border-white/20 bg-slate-950/70 px-3 py-1 text-[11px] font-semibold tracking-wide text-white backdrop-blur-md shadow-lg">
          {beforeLabel}
        </span>
      </div>

      {/* After Pill Label */}
      <div className="absolute bottom-3.5 right-3.5 z-10 pointer-events-none">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-slate-950/75 px-3 py-1 text-[11px] font-semibold tracking-wide text-amber-300 backdrop-blur-md shadow-lg">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
          {afterLabel}
        </span>
      </div>
    </div>
  );
}

export default ImageCompareSlider;
