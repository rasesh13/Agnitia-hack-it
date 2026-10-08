import React, { useState } from 'react';
import { Navbar } from '@/components/landing/Navbar';
import { Hero } from '@/components/landing/Hero';
import { CampusTransformationSection } from '@/components/landing/ImageComparisonHover';
import { PlatformArchitectureSection } from '@/components/landing/PlatformArchitectureSection';
import { LiveTelemetryPreviewSection } from '@/components/landing/LiveTelemetryPreviewSection';
import { ImpactSection } from '@/components/landing/ImpactSection';
import { Footer } from '@/components/landing/Footer';
import { ReasoningModal } from '@/components/landing/ReasoningModal';
import { DemoBookingModal } from '@/components/landing/DemoBookingModal';
import { DispatchData } from '@/components/landing/DispatchCard';

export interface LandingPageProps {
  onLaunchConsole?: () => void;
  onLogin?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onLaunchConsole, onLogin }) => {
  const [activeSection, setActiveSection] = useState<string>('platform');
  const [isReasoningModalOpen, setIsReasoningModalOpen] = useState(false);
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);

  const liveDispatchSample: DispatchData = {
    action: 'BESS PRE-CHARGE & VNM OPTIMIZE',
    targetAsset: 'LFP-BESS-01 (1.2 MWh)',
    setpointKw: 120,
    reasoning:
      'Solar forecast projects 22% cloud attenuation at 14:15. Dispatching +120 kW into BESS to lock 88% SoC before evening Time-of-Day peak tariff window.',
    confidenceScore: 99.2,
    batterySoc: 78.4,
    totalGenerationKw: 384.6,
    gridExchangeKw: -42.0,
    expectedSavingsInr: 12450,
    cycleTimestamp: 'Cycle #8492 • Live 5m sync',
  };

  const handleNavigateSection = (sectionId: string) => {
    setActiveSection(sectionId);
    if (sectionId === 'live-demo' && onLaunchConsole) {
      const el = document.getElementById(sectionId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
      return;
    }
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-amber-400 selection:text-slate-950 overflow-x-clip font-sans">
      {/* Sticky Glass Navbar */}
      <Navbar
        activeSection={activeSection}
        onNavigateSection={handleNavigateSection}
        onBookDemo={() => setIsDemoModalOpen(true)}
        onWatchDispatch={() => {
          if (onLaunchConsole) {
            onLaunchConsole();
          } else {
            setIsReasoningModalOpen(true);
          }
        }}
      />

      {/* Hero Scene with Carousel, WeatherChip, DispatchCard */}
      <Hero
        liveDispatchData={liveDispatchSample}
        onBookDemo={() => setIsDemoModalOpen(true)}
        onWatchDispatch={() => {
          if (onLaunchConsole) {
            onLaunchConsole();
          } else {
            setIsReasoningModalOpen(true);
          }
        }}
        onOpenReasoning={() => setIsReasoningModalOpen(true)}
        onScrollToExplore={() => handleNavigateSection('comparison')}
      />

      {/* Campus Before & After Image Comparison Section */}
      <CampusTransformationSection />

      {/* Platform Architecture & 4 Engineering Pillars */}
      <PlatformArchitectureSection />

      {/* Live Digital Twin Telemetry Feed */}
      <LiveTelemetryPreviewSection onLaunchConsole={onLaunchConsole || onLogin} />

      {/* Economic & Climate Impact Metrics */}
      <ImpactSection />

      {/* Footer */}
      <Footer />

      {/* Modals */}
      <ReasoningModal
        isOpen={isReasoningModalOpen}
        onClose={() => setIsReasoningModalOpen(false)}
        data={liveDispatchSample}
      />

      <DemoBookingModal
        isOpen={isDemoModalOpen}
        onClose={() => setIsDemoModalOpen(false)}
      />
    </div>
  );
};
