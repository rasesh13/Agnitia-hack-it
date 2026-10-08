import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from 'framer-motion';
import { Sun, Zap, Menu, X, ArrowUpRight, Play, BarChart3, Building2, Radio } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface NavLinkItem {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
}

export const NAV_LINKS: NavLinkItem[] = [
  { id: 'platform', label: 'Platform', icon: Zap },
  { id: 'comparison', label: 'Transformation', icon: Building2 },
  { id: 'live-demo', label: 'Live Demo', icon: Radio },
  { id: 'impact', label: 'Impact', icon: BarChart3 },
];

export interface NavbarProps {
  activeSection?: string;
  onNavigateSection?: (sectionId: string) => void;
  onBookDemo?: () => void;
  onWatchDispatch?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeSection = 'platform',
  onNavigateSection,
  onBookDemo,
  onWatchDispatch,
}) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);

  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, 'change', (latest) => {
    const diff = latest - lastScrollY;

    // Detect scrolled state (>40px)
    if (latest > 40) {
      setIsScrolled(true);
    } else {
      setIsScrolled(false);
    }

    // Hide on scroll down, show on scroll up
    if (latest > 120 && diff > 8) {
      setIsVisible(false);
    } else if (diff < -6 || latest <= 120) {
      setIsVisible(true);
    }

    setLastScrollY(latest);
  });

  // Close mobile drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
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

  return (
    <>
      <motion.header
        initial={{ y: 0 }}
        animate={{
          y: isVisible ? 0 : -100,
        }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className={cn(
          'fixed top-0 left-0 right-0 z-50 transition-colors duration-300',
          isScrolled
            ? 'border-b border-white/10 bg-black/40 backdrop-blur-xl shadow-lg shadow-black/20'
            : 'border-b border-transparent bg-transparent'
        )}
      >
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Left: Logo & Wordmark */}
          <button
            onClick={() => handleNavClick('hero')}
            className="group flex items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-xl p-1"
            aria-label="SURYA Home"
          >
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 to-emerald-500 p-0.5 shadow-md shadow-amber-500/20 group-hover:shadow-amber-500/40 transition-shadow">
              <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-slate-950">
                <Sun className="h-5 w-5 text-amber-400 group-hover:rotate-45 transition-transform duration-300" />
              </div>
            </div>

            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-xl font-black tracking-tight text-white">
                  SURYA
                </span>
                <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-300">
                  Govt DTE
                </span>
              </div>
              <span className="hidden sm:inline-block text-[10px] font-medium tracking-wide text-white/60 line-clamp-1">
                Smart Unified Renewable Yield Automation
              </span>
            </div>
          </button>

          {/* Center Navigation Links (Desktop) */}
          <nav
            className="hidden md:flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.06] p-1.5 backdrop-blur-md"
            aria-label="Primary Navigation"
          >
            {NAV_LINKS.map((link) => {
              const isActive = activeSection === link.id;
              return (
                <button
                  key={link.id}
                  onClick={() => handleNavClick(link.id)}
                  className={cn(
                    'relative px-4 py-2 text-xs font-semibold tracking-wide transition-colors rounded-full outline-none focus-visible:ring-2 focus-visible:ring-amber-400',
                    isActive ? 'text-white' : 'text-white/70 hover:text-white'
                  )}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {link.label}
                  {isActive && (
                    <motion.div
                      layoutId="navbar-active-tab"
                      className="absolute inset-x-2 -bottom-1 h-0.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.8)]"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Action Buttons (Desktop) */}
          <div className="hidden lg:flex items-center gap-3">
            <button
              onClick={onWatchDispatch}
              className="group flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-xs font-semibold text-white/90 backdrop-blur-md transition-all hover:bg-white/15 hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
              aria-label="Watch Live VPP Dispatch"
            >
              <Play className="h-3.5 w-3.5 text-teal-400 fill-teal-400/20 group-hover:scale-110 transition-transform" />
              <span>Watch Live Dispatch</span>
            </button>

            <button
              onClick={onBookDemo}
              className="flex items-center gap-2 rounded-full bg-slate-950 border border-amber-500/40 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-amber-500/10 transition-all hover:border-amber-400 hover:shadow-amber-500/30 hover:bg-slate-900 focus-visible:ring-2 focus-visible:ring-amber-400 active:scale-95"
              aria-label="Book a Demonstration"
            >
              <span>Book a Demo</span>
              <ArrowUpRight className="h-3.5 w-3.5 text-amber-400" />
            </button>
          </div>

          {/* Mobile Hamburger Button */}
          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={onBookDemo}
              className="rounded-full bg-slate-950 border border-amber-500/40 px-3 py-1.5 text-xs font-semibold text-white hover:border-amber-400"
              aria-label="Book Demo Quick"
            >
              Book Demo
            </button>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white backdrop-blur-md focus-visible:ring-2 focus-visible:ring-amber-400"
              aria-label={mobileMenuOpen ? 'Close Menu' : 'Open Navigation Menu'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </motion.header>

      {/* Full-Height Slide-in Mobile Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 z-40 bg-black/70 backdrop-blur-md md:hidden"
            />

            {/* Slide Drawer */}
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="fixed top-0 right-0 bottom-0 z-50 w-4/5 max-w-sm border-l border-white/15 bg-slate-950/95 p-6 shadow-2xl backdrop-blur-2xl md:hidden flex flex-col justify-between"
              role="dialog"
              aria-modal="true"
              aria-label="Mobile Navigation Menu"
            >
              <div>
                <div className="flex items-center justify-between pb-6 border-b border-white/10">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      <Sun className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-bold text-white tracking-tight">SURYA</div>
                      <div className="text-[10px] text-amber-400 font-mono">Govt DTE VPP</div>
                    </div>
                  </div>
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:text-white"
                    aria-label="Close menu"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Mobile Links List */}
                <nav className="mt-6 flex flex-col gap-2">
                  {NAV_LINKS.map((link) => {
                    const Icon = link.icon || Zap;
                    const isActive = activeSection === link.id;
                    return (
                      <button
                        key={link.id}
                        onClick={() => handleNavClick(link.id)}
                        className={cn(
                          'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all text-left',
                          isActive
                            ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                            : 'text-slate-300 hover:bg-white/5 hover:text-white'
                        )}
                      >
                        <Icon className="h-4 w-4 text-amber-400/80" />
                        <span>{link.label}</span>
                      </button>
                    );
                  })}
                </nav>
              </div>

              {/* Drawer Footer Actions */}
              <div className="space-y-3 pt-6 border-t border-white/10">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onBookDemo?.();
                  }}
                  className="w-full flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-amber-500/20"
                >
                  <span>Book a Demo</span>
                  <ArrowUpRight className="h-4 w-4" />
                </button>

                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onWatchDispatch?.();
                  }}
                  className="w-full flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 py-3 text-sm font-semibold text-white backdrop-blur-md"
                >
                  <Play className="h-4 w-4 text-teal-300" />
                  <span>Watch Live Dispatch</span>
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
