import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

export interface UseLandingMotionReturn {
  scrollTo: (target: string | HTMLElement) => void;
}

export function useLandingMotion(
  rootRef: React.RefObject<HTMLDivElement | null>
): UseLandingMotionReturn {
  const lenisRef = useRef<Lenis | null>(null);

  // Initialize and synchronize Lenis lifecycle exclusively on Landing mount
  useEffect(() => {
    // Check reduced motion preference or mobile screen
    const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isMobile = window.innerWidth < 768;

    if (isReducedMotion || isMobile) {
      // Keep standard native scroll on mobile or reduced-motion
      return;
    }

    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 1.2,
    });

    lenisRef.current = lenis;

    lenis.on('scroll', ScrollTrigger.update);

    const tickerCallback = (time: number) => {
      lenis.raf(time * 1000);
    };

    gsap.ticker.add(tickerCallback);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(tickerCallback);
      lenis.destroy();
      lenisRef.current = null;
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, []);

  // GSAP animations with matchMedia scoping
  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root) return;

      const mm = gsap.matchMedia();

      // ==============================================================
      // 1. DESKTOP & MOTION-ENABLED (PARALLAX + SCRUB + REVEALS)
      // ==============================================================
      mm.add('(min-width: 768px) and (prefers-reduced-motion: no-preference)', () => {
        // Hero Background Parallax Scrub
        const heroBg = root.querySelector<HTMLElement>('[data-anim="hero-bg"]');
        if (heroBg) {
          gsap.fromTo(
            heroBg,
            { yPercent: 0, scale: 1.08 },
            {
              yPercent: 15,
              scale: 1,
              ease: 'none',
              scrollTrigger: {
                trigger: '#hero',
                start: 'top top',
                end: 'bottom top',
                scrub: true,
              },
            }
          );
        }

        // Hero Left Copy Parallax Scrub
        const heroText = root.querySelector<HTMLElement>('[data-anim="hero-text"]');
        if (heroText) {
          gsap.to(heroText, {
            y: -80,
            opacity: 0.15,
            ease: 'none',
            scrollTrigger: {
              trigger: '#hero',
              start: 'top top',
              end: 'bottom top',
              scrub: true,
            },
          });
        }

        // Hero Right Dispatch Card Parallax Scrub
        const heroCard = root.querySelector<HTMLElement>('[data-anim="hero-card"]');
        if (heroCard) {
          gsap.to(heroCard, {
            y: -40,
            ease: 'none',
            scrollTrigger: {
              trigger: '#hero',
              start: 'top top',
              end: 'bottom top',
              scrub: true,
            },
          });
        }

        // Card Image Parallax Scrub (scale 1.15, y ±8%)
        const cardImgs = root.querySelectorAll<HTMLElement>('[data-anim="card-img"]');
        cardImgs.forEach((img) => {
          gsap.fromTo(
            img,
            { scale: 1.15, yPercent: -8 },
            {
              yPercent: 8,
              ease: 'none',
              scrollTrigger: {
                trigger: img.closest('[data-anim="card"]') || img,
                start: 'top bottom',
                end: 'bottom top',
                scrub: true,
              },
            }
          );
        });

        // Photon -> Classroom SVG Connector Scrub Line
        const svgLine = root.querySelector<SVGPathElement>('[data-anim="svg-line"]');
        if (svgLine) {
          const length = svgLine.getTotalLength ? svgLine.getTotalLength() : 600;
          gsap.set(svgLine, {
            strokeDasharray: length,
            strokeDashoffset: length,
          });

          gsap.to(svgLine, {
            strokeDashoffset: 0,
            ease: 'none',
            scrollTrigger: {
              trigger: '#journey-section',
              start: 'top 75%',
              end: 'bottom 85%',
              scrub: 0.8,
            },
          });
        }
      });

      // ==============================================================
      // 2. UNIVERSAL REVEALS (ALL DEVICES & A11Y SAFE)
      // ==============================================================

      // Split Headings Reveal (word-by-word)
      const splitHeadings = root.querySelectorAll<HTMLElement>('[data-anim="split-heading"]');
      splitHeadings.forEach((heading) => {
        if (!heading.dataset.splitApplied) {
          heading.dataset.splitApplied = 'true';
          const originalText = heading.innerText.trim();
          const words = originalText.split(/\s+/);
          heading.innerHTML = words
            .map(
              (w) =>
                `<span class="word-wrap"><span class="word-inner">${w}</span></span>`
            )
            .join(' ');
        }

        const innerWords = heading.querySelectorAll<HTMLElement>('.word-inner');
        gsap.fromTo(
          innerWords,
          { y: 30, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.6,
            stagger: 0.05,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: heading,
              start: 'top 85%',
              once: true,
            },
          }
        );
      });

      // Cards Reveal (y 40→0 + opacity, 0.8s, power3.out, stagger 0.1)
      const cardContainers = [
        '#assets-showcase',
        '#pipeline-section',
        '#stats-section',
        '#journey-section',
        '#features-section',
        '#trust-section',
      ];

      cardContainers.forEach((containerId) => {
        const container = root.querySelector<HTMLElement>(containerId);
        if (!container) return;

        const cards = container.querySelectorAll<HTMLElement>('[data-anim="card"]');
        if (cards.length > 0) {
          gsap.fromTo(
            cards,
            { y: 40, opacity: 0 },
            {
              y: 0,
              opacity: 1,
              duration: 0.8,
              stagger: 0.1,
              ease: 'power3.out',
              scrollTrigger: {
                trigger: container,
                start: 'top 85%',
                once: true,
              },
            }
          );
        }
      });

      // Zero Simulation Safeguard Bullets Stagger
      const bullets = root.querySelectorAll<HTMLElement>('[data-anim="bullet"]');
      if (bullets.length > 0) {
        gsap.fromTo(
          bullets,
          { y: 20, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.5,
            stagger: 0.1,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: '[data-anim="zero-sim-panel"]',
              start: 'top 82%',
              once: true,
            },
          }
        );
      }

      // Metrics Count-Up (animate number node only, once, final value preserved)
      const metricNodes = root.querySelectorAll<HTMLElement>('[data-anim="metric-val"]');
      if (metricNodes.length > 0) {
        ScrollTrigger.create({
          trigger: '#stats-section',
          start: 'top 85%',
          once: true,
          onEnter: () => {
            metricNodes.forEach((node) => {
              const target = parseFloat(node.getAttribute('data-target') || '0');
              const decimals = parseInt(node.getAttribute('data-decimals') || '0', 10);
              const state = { val: 0 };

              gsap.to(state, {
                val: target,
                duration: 1.8,
                ease: 'power2.out',
                onUpdate: () => {
                  node.textContent = state.val.toFixed(decimals);
                },
                onComplete: () => {
                  // Ensure final rendered text matches exact specification
                  node.textContent = target.toFixed(decimals);
                },
              });
            });
          },
        });
      }

      // Feature Cards Cursor-Follow Glow (CSS vars --mx, --my)
      const featureCards = root.querySelectorAll<HTMLElement>('[data-anim="feature-card"]');
      featureCards.forEach((card) => {
        const handleMouseMove = (e: MouseEvent) => {
          const rect = card.getBoundingClientRect();
          card.style.setProperty('--mx', `${e.clientX - rect.left}px`);
          card.style.setProperty('--my', `${e.clientY - rect.top}px`);
        };

        card.addEventListener('mousemove', handleMouseMove);
      });
    },
    { scope: rootRef }
  );

  const scrollTo = (target: string | HTMLElement) => {
    if (lenisRef.current) {
      lenisRef.current.scrollTo(target, { offset: -40 });
    } else {
      const el = typeof target === 'string' ? document.querySelector(target) : target;
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return { scrollTo };
}
