import React, { useId } from 'react';

export interface SuryaMarkProps {
  size?: number;
  className?: string;
  title?: string;
}

/*
 * SURYA brand mark: a chakra sun with twelve rays and an energy bolt, rising over an
 * emerald horizon and a solar panel field, on a night-sky tile.
 * Mirrors public/surya-mark.svg (used as the favicon).
 */
export const SuryaMark: React.FC<SuryaMarkProps> = ({ size = 38, className = '', title }) => {
  const rawId = useId().replace(/:/g, '');
  const ids = {
    tile: `surya-tile-${rawId}`,
    halo: `surya-halo-${rawId}`,
    ray: `surya-ray-${rawId}`,
    disc: `surya-disc-${rawId}`,
    earth: `surya-earth-${rawId}`,
    tileClip: `surya-clip-${rawId}`,
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={!title || undefined}
      aria-label={title}
    >
      <defs>
        <linearGradient id={ids.tile} x1="6" y1="2" x2="42" y2="46" gradientUnits="userSpaceOnUse">
          <stop stopColor="#12302A"/>
          <stop offset="0.55" stopColor="#0A1A1C"/>
          <stop offset="1" stopColor="#050A12"/>
        </linearGradient>
        <radialGradient id={ids.halo} cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(24 22) scale(19)">
          <stop stopColor="#FBBF24" stopOpacity="0.35"/>
          <stop offset="1" stopColor="#FBBF24" stopOpacity="0"/>
        </radialGradient>
        <linearGradient id={ids.ray} x1="24" y1="5" x2="24" y2="37" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FDE68A"/>
          <stop offset="1" stopColor="#F59E0B"/>
        </linearGradient>
        <radialGradient id={ids.disc} cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(21.5 19.5) scale(10.5)">
          <stop stopColor="#FFF3B0"/>
          <stop offset="0.45" stopColor="#FCD34D"/>
          <stop offset="1" stopColor="#F97316"/>
        </radialGradient>
        <linearGradient id={ids.earth} x1="6" y1="33" x2="42" y2="33" gradientUnits="userSpaceOnUse">
          <stop stopColor="#059669"/>
          <stop offset="0.55" stopColor="#10B981"/>
          <stop offset="1" stopColor="#A3E635"/>
        </linearGradient>
        <clipPath id={ids.tileClip}>
          <rect x="1" y="1" width="46" height="46" rx="12"/>
        </clipPath>
      </defs>
      
      {/* Tile */}
      <rect x="1" y="1" width="46" height="46" rx="12" fill={`url(#${ids.tile})`}/>
      <g clipPath={`url(#${ids.tileClip})`}>
        <circle cx="24" cy="22" r="19" fill={`url(#${ids.halo})`}/>
      
        {/* Twelve chakra rays, long and short alternating */}
        <g fill={`url(#${ids.ray})`}>
          <rect x="22.9" y="5.6" width="2.2" height="5.4" rx="1.1"/>
          <rect x="22.9" y="5.6" width="2.2" height="4" rx="1.1" transform="rotate(30 24 22)"/>
          <rect x="22.9" y="5.6" width="2.2" height="5.4" rx="1.1" transform="rotate(60 24 22)"/>
          <rect x="22.9" y="5.6" width="2.2" height="4" rx="1.1" transform="rotate(90 24 22)"/>
          <rect x="22.9" y="5.6" width="2.2" height="5.4" rx="1.1" transform="rotate(120 24 22)"/>
          <rect x="22.9" y="5.6" width="2.2" height="4" rx="1.1" transform="rotate(150 24 22)"/>
          <rect x="22.9" y="5.6" width="2.2" height="5.4" rx="1.1" transform="rotate(180 24 22)"/>
          <rect x="22.9" y="5.6" width="2.2" height="4" rx="1.1" transform="rotate(210 24 22)"/>
          <rect x="22.9" y="5.6" width="2.2" height="5.4" rx="1.1" transform="rotate(240 24 22)"/>
          <rect x="22.9" y="5.6" width="2.2" height="4" rx="1.1" transform="rotate(270 24 22)"/>
          <rect x="22.9" y="5.6" width="2.2" height="5.4" rx="1.1" transform="rotate(300 24 22)"/>
          <rect x="22.9" y="5.6" width="2.2" height="4" rx="1.1" transform="rotate(330 24 22)"/>
        </g>
      
        {/* Sun disc with an energy bolt cut through it */}
        <circle cx="24" cy="22" r="8.6" fill={`url(#${ids.disc})`}/>
        <path d="M25.6 15.6L20.4 23.1H23.7L22.4 28.4L27.7 20.7H24.3L25.6 15.6Z" fill="#0B1D1B"/>
      
        {/* Emerald horizon: the green microgrid the sun rises over */}
        <path d="M3 32.5C11.5 28.4 18.6 27.6 25.4 28.6C32.8 29.7 38.8 32.3 45 31.2V47H3V32.5Z" fill="#050A12"/>
        <path d="M3 33.2C11.5 29.1 18.6 28.3 25.4 29.3C32.8 30.4 38.8 33 45 31.9" stroke={`url(#${ids.earth})`} strokeWidth="3" strokeLinecap="round"/>
        {/* Solar panel field in perspective */}
        <g stroke="#10B981" strokeOpacity="0.5" strokeWidth="0.9" strokeLinecap="round">
          <path d="M13.5 36H34.5M11 40H37M8.5 44H39.5"/>
          <path d="M13.5 36L8.5 44M18.75 36L16.25 44M24 36V44M29.25 36L31.75 44M34.5 36L39.5 44"/>
        </g>
      </g>
      
      {/* Fine rim */}
      <rect x="1.5" y="1.5" width="45" height="45" rx="11.5" stroke="#FBBF24" strokeOpacity="0.28"/>
    </svg>
  );
};
