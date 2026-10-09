import React, { useRef } from 'react';
import '@fontsource-variable/outfit';
import './landing.css';
import './landing-motion.css';
import { useLandingMotion } from './useLandingMotion';

import { Hero } from './components/Hero';
import { AssetShowcaseSection } from './components/AssetShowcaseSection';
import { PrincipleSection } from './components/PrincipleSection';
import { PipelineSection } from './components/PipelineSection';
import { StatsSection } from './components/StatsSection';
import { JourneySection } from './components/JourneySection';
import { FeaturesSection } from './components/FeaturesSection';
import { TrustSection } from './components/TrustSection';
import { FooterSection } from './components/FooterSection';

export interface LandingPageProps {
  onLaunchConsole?: () => void;
  onLogin?: () => void;
  onSignup?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onLaunchConsole,
  onLogin,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Retrofit scroll motion hook scoping all [data-anim] markers and Lenis lifecycle
  useLandingMotion(containerRef);


  return (
    <div
      ref={containerRef}
      className="landing-root min-h-screen bg-slate-950 text-slate-100 selection:bg-amber-400 selection:text-slate-950 overflow-x-hidden font-sans"
    >
      {/* 1. Scroll-Locked Campus Microgrid Wipe Hero */}
      <Hero onLaunchConsole={onLaunchConsole} onLogin={onLogin} />

      {/* 2. Physical Campus Infrastructure Showcase (Real High-Res Imagery) */}
      <AssetShowcaseSection />

      {/* 3. Zero Simulation Policy Principle */}
      <PrincipleSection />

      {/* 4. Engineering Pipeline: Ingest -> Optimize -> Dispatch -> Audit */}
      <PipelineSection />

      {/* 5. Verified Production Metrics & Count-Up Stats */}
      <StatsSection />

      {/* 6. Campus Energy Journey: Generation -> Storage -> Loads */}
      <JourneySection />

      {/* 7. Feature Cards: Digital Twin, Optimizer, VNM, BESS Guard */}
      <FeaturesSection />

      {/* 8. Operational Trust & Audit Integrity */}
      <TrustSection />

      {/* 9. Final CTA & Technical Footer */}
      <FooterSection onLaunchConsole={onLaunchConsole} onLogin={onLogin} />
    </div>
  );
};
