import React, { useState, useEffect } from 'react';
import {
  LayoutGrid,
  Building2,
  Activity,
  Sparkles,
  ArrowUpRight,
  Play,
  Menu,
  X,
  LucideIcon,
} from 'lucide-react';
import { SuryaMark } from '@/components/SuryaMark';
import { cn } from '@/lib/utils';

export interface NavLinkItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

const NAV_LINKS: NavLinkItem[] = [
  { id: 'platform', label: 'Platform', icon: LayoutGrid },
  { id: 'comparison', label: 'Transformation', icon: Building2 },
  { id: 'live-demo', label: 'Live Demo', icon: Activity },
  { id: 'impact', label: 'Impact', icon: Sparkles },
];

export interface NavbarProps {
  activeSection?: string;
  onNavigateSection?: (sectionId: string) => void;
  onBookDemo?: () => void;
  onWatchDispatch?: () => void;
  onLogin?: () => void;
  onSignup?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeSection = 'platform',
  onNavigateSection,
  onBookDemo,
  onWatchDispatch,
  onLogin,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile dropdown on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  const handleNavClick = (sectionId: string) => {
    setMobileMenuOpen(false);
    if (onNavigateSection) {
      onNavigateSection(sectionId);
    } else {
      const el = document.getElementById(sectionId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  const handleBrandClick = () => {
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 pt-3 sm:pt-4 px-3 sm:px-6 lg:px-8 pointer-events-none">
      <div className="relative w-full max-w-[1420px] 2xl:max-w-[1520px] mx-auto pointer-events-auto">
        {/* Floating Glass Navbar Capsule - Roomier with True Center Alignment */}
        <div className="glass-nav-hero flex items-center justify-between gap-4 px-5 sm:px-8 py-3 sm:py-3.5 animate-[fadeSlideUp_0.6s_ease-out_both]">
          {/* Left: Brand Identity (flex-1 for balanced centering) */}
          <div className="flex-1 flex items-center justify-start min-w-0">
            <button
              onClick={handleBrandClick}
              className="group flex items-center gap-3 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-full"
              aria-label="SURYA Home"
            >
              <SuryaMark
                size={40}
                className="shrink-0 drop-shadow-[0_0_12px_rgba(217,119,6,0.35)] transition-transform duration-300 group-hover:scale-105"
              />
              <div className="flex flex-col text-left">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-white text-lg sm:text-xl tracking-tight drop-shadow-md whitespace-nowrap">
                    SURYA
                  </span>
                  <span className="rounded-md border border-amber-500/35 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                    Govt DTE
                  </span>
                </div>
                <span className="hidden sm:inline-block text-[11px] font-medium tracking-wide text-white/60 line-clamp-1">
                  Smart Unified Renewable Yield Automation
                </span>
              </div>
            </button>
          </div>

          {/* Center: Nav Links - Perfectly Dead-Centered */}
          <div className="hidden lg:flex items-center justify-center gap-1.5 xl:gap-2.5 shrink-0">
            {NAV_LINKS.map(({ id, label, icon: Icon }) => {
              const isActive = activeSection === id;
              return (
                <button
                  key={id}
                  onClick={() => handleNavClick(id)}
                  className={cn(
                    'flex items-center gap-2 px-3.5 xl:px-4 py-2 rounded-full text-xs xl:text-sm font-semibold uppercase tracking-[0.1em] transition-all duration-300 outline-none focus-visible:ring-2 focus-visible:ring-amber-400 whitespace-nowrap',
                    isActive
                      ? 'text-white bg-white/10 shadow-sm'
                      : 'text-white/85 hover:text-amber-200 hover:bg-white/10'
                  )}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon size={15} className="text-amber-300/90 shrink-0" />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          {/* Right: Action Buttons (flex-1 for balanced centering) */}
          <div className="flex-1 flex items-center justify-end gap-2.5 sm:gap-3 shrink-0">
            {onLogin && (
              <button
                onClick={onLogin}
                className="hidden xl:inline-flex px-3.5 py-2 rounded-full text-xs sm:text-sm font-semibold text-white/70 hover:text-white hover:bg-white/10 transition-all focus-visible:ring-2 focus-visible:ring-amber-400"
                aria-label="Sign in"
              >
                Sign in
              </button>
            )}

            <button
              onClick={onWatchDispatch}
              className="hidden md:inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 py-2.5 text-xs sm:text-sm font-semibold text-white/90 backdrop-blur-md transition-all duration-200 hover:bg-white/15 hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400 whitespace-nowrap"
              aria-label="Watch Live VPP Dispatch"
            >
              <Play className="h-3.5 w-3.5 text-teal-400 fill-teal-400/20 group-hover:scale-110 transition-transform" />
              <span>Watch Live Dispatch</span>
            </button>

            <button
              onClick={onBookDemo}
              className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs sm:text-sm font-bold text-white transition-all duration-300 hover:scale-[1.03] active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-amber-400 shadow-lg whitespace-nowrap"
              style={{
                background: 'linear-gradient(135deg, #b45309, #f59e0b)',
                boxShadow: '0 6px 20px rgba(217, 119, 6, 0.35)',
              }}
              aria-label="Book a Demonstration"
            >
              <span>Book a Demo</span>
              <ArrowUpRight className="h-3.5 w-3.5 text-white" />
            </button>

            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label="Toggle navigation menu"
              aria-expanded={mobileMenuOpen}
              className="lg:hidden p-2 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Panel */}
        {mobileMenuOpen && (
          <div className="glass-nav-panel absolute left-0 right-0 top-full z-40 mt-2 p-3">
            {/* Nav Links */}
            <div className="flex flex-col gap-1">
              {NAV_LINKS.map(({ id, label, icon: Icon }) => {
                const isActive = activeSection === id;
                return (
                  <button
                    key={id}
                    onClick={() => handleNavClick(id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold uppercase tracking-[0.1em] transition-all duration-200 text-left',
                      isActive
                        ? 'text-white bg-white/10'
                        : 'text-white/85 hover:text-amber-200 hover:bg-white/10'
                    )}
                  >
                    <Icon size={16} className="text-amber-300/90 shrink-0" />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>

            {/* Action Buttons */}
            <div className="mt-3 pt-3 border-t border-white/10 flex flex-col gap-2">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onWatchDispatch?.();
                }}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 py-3 text-sm font-semibold text-white backdrop-blur-md hover:bg-white/15 transition-all"
              >
                <Play className="h-4 w-4 text-teal-300 fill-teal-300/20" />
                <span>Watch Live Dispatch</span>
              </button>

              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onBookDemo?.();
                }}
                className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  background: 'linear-gradient(135deg, #b45309, #f59e0b)',
                  boxShadow: '0 6px 20px rgba(217, 119, 6, 0.35)',
                }}
              >
                <span>Book a Demo</span>
                <ArrowUpRight className="h-4 w-4 text-white" />
              </button>

              {onLogin && (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onLogin();
                  }}
                  className="w-full flex items-center justify-center py-2 text-xs font-semibold text-white/70 hover:text-white transition-all"
                >
                  Sign in
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};
