import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
} from 'react';
import { cn } from '@/lib/utils';
import { motion, useReducedMotion } from 'framer-motion';

interface ImageComparisonContextType {
  sliderPosition: number;
  setSliderPosition: (pos: number) => void;
  isHovering: boolean;
  isDragging: boolean;
  enableHover: boolean;
}

const ImageComparisonContext = createContext<ImageComparisonContextType | null>(null);

function useImageComparison() {
  const context = useContext(ImageComparisonContext);
  if (!context) {
    throw new Error('ImageComparison compound components must be used within <ImageComparison>');
  }
  return context;
}

export interface ImageComparisonProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  defaultValue?: number;
  enableHover?: boolean;
  className?: string;
}

export function ImageComparison({
  children,
  defaultValue = 50,
  enableHover = false,
  className,
  ...props
}: ImageComparisonProps) {
  const [sliderPosition, setSliderPosition] = useState<number>(defaultValue);
  const [isHovering, setIsHovering] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const calculatePosition = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(percentage);
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(true);
    calculatePosition(e.clientX);
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [calculatePosition]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (enableHover || isDragging) {
      calculatePosition(e.clientX);
    }
  }, [enableHover, isDragging, calculatePosition]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  }, []);

  const handleMouseEnter = useCallback(() => {
    setIsHovering(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovering(false);
    setIsDragging(false);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setSliderPosition((prev) => Math.max(0, prev - 5));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setSliderPosition((prev) => Math.min(100, prev + 5));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setSliderPosition(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setSliderPosition(100);
    }
  }, []);

  return (
    <ImageComparisonContext.Provider
      value={{
        sliderPosition,
        setSliderPosition,
        isHovering,
        isDragging,
        enableHover,
      }}
    >
      <div
        ref={containerRef}
        role="slider"
        aria-label="Before and After Image Comparison"
        aria-valuenow={Math.round(sliderPosition)}
        aria-valuemin={0}
        aria-valuemax={100}
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onKeyDown={handleKeyDown}
        className={cn(
          'relative select-none overflow-hidden touch-none cursor-ew-resize outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950',
          className
        )}
        {...props}
      >
        {children}
      </div>
    </ImageComparisonContext.Provider>
  );
}

export interface ImageComparisonImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  position: 'left' | 'right';
  className?: string;
  alt: string;
}

export function ImageComparisonImage({
  src,
  alt,
  position,
  className,
  ...props
}: ImageComparisonImageProps) {
  const { sliderPosition } = useImageComparison();

  if (position === 'left') {
    return (
      <div
        className="absolute inset-0 h-full w-full overflow-hidden pointer-events-none"
        style={{
          clipPath: `polygon(0 0, ${sliderPosition}% 0, ${sliderPosition}% 100%, 0 100%)`,
        }}
      >
        <img
          src={src}
          alt={alt}
          className={cn('absolute inset-0 h-full w-full object-cover object-center', className)}
          loading="lazy"
          {...props}
        />
      </div>
    );
  }

  return (
    <div
      className="absolute inset-0 h-full w-full overflow-hidden pointer-events-none"
      style={{
        clipPath: `polygon(${sliderPosition}% 0, 100% 0, 100% 100%, ${sliderPosition}% 100%)`,
      }}
    >
      <img
        src={src}
        alt={alt}
        className={cn('absolute inset-0 h-full w-full object-cover object-center', className)}
        loading="lazy"
        {...props}
      />
    </div>
  );
}

export interface ImageComparisonSliderProps {
  className?: string;
}

export function ImageComparisonSlider({ className }: ImageComparisonSliderProps) {
  const { sliderPosition, isDragging, isHovering } = useImageComparison();
  const shouldReduceMotion = useReducedMotion();

  return (
    <div
      className="absolute top-0 bottom-0 pointer-events-none"
      style={{
        left: `${sliderPosition}%`,
        transform: 'translateX(-50%)',
      }}
    >
      {/* Vertical divider line */}
      <div
        className={cn(
          'h-full w-0.5 shadow-[0_0_12px_rgba(245,158,11,0.6)] transition-colors duration-150',
          isDragging || isHovering ? 'bg-amber-400' : 'bg-white/90',
          className
        )}
      />

      {/* Center Draggable / Hover handle */}
      <motion.div
        animate={{
          scale: isDragging ? 1.15 : isHovering ? 1.08 : 1,
        }}
        transition={{
          duration: shouldReduceMotion ? 0 : 0.15,
        }}
        className={cn(
          'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full border border-white/40 bg-slate-900/90 text-amber-400 shadow-2xl backdrop-blur-md transition-shadow',
          isDragging || isHovering
            ? 'ring-4 ring-amber-400/30 border-amber-400 shadow-amber-500/30'
            : 'shadow-black/60'
        )}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
        >
          <polyline points="15 18 9 12 15 6" />
          <polyline points="9 18 3 12 9 6" />
          <polyline points="9 6 15 12 9 18" />
          <polyline points="15 6 21 12 15 18" />
        </svg>
      </motion.div>
    </div>
  );
}
