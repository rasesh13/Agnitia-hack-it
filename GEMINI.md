# Project Rules & Invariable Specifications (final4)

## Landing Page Hero Transition & Scroll Mechanism (DO NOT CHANGE)
The current hero background transition and scroll mechanism are finalized as **final4** and must NOT be altered or replaced:

1. **Scroll-Locked Transition Mechanism**:
   - While at the top of the landing page (`window.scrollY <= 5`), user scroll input (mouse wheel, touch swipe, arrow keys) is intercepted (`e.preventDefault()`).
   - The page MUST NOT scroll down past the hero until the clean energy campus image (`campus_after.png`) has 100% fully covered the background.
   - Scrolling down smoothly increments progress from 0% to 100%, driving the right-to-left clip path wipe (`clipPath: inset(0 0 0 ${100 - progress}%)`).
   - Only once progress reaches 100% does standard page scrolling unlock, allowing natural scrolling down into subsequent sections.

2. **Transition Images**:
   - Baseline image (`frontend/public/campus_before.png`): The conventional college campus building without solar panels or wind turbines.
   - Transformed image (`frontend/public/campus_after.png`): The 1-to-1 pixel-aligned version of the exact same college building featuring stepped terrace solar panel arrays, parking lot solar canopies, and rooftop helical wind turbines.
   - Do NOT replace these images with generic landscape, nature, or hillside photos.

3. **Visual Cleanliness**:
   - No vertical laser divider lines or floating progress percentage pills in the Hero transition. The wipe must remain pure and seamless across the images.
   - No references to "Compliance", "RERC", or "Amendment Act" across the site.


## Landing Page Rules & Cinematic Motion System Lock
- **Theme Lock (Non-Negotiable)**:
  - Colors, border-radii, shadows, and glassmorphism styles MUST come strictly from existing theme tokens and Tailwind classes (`slate-*`, `brand-*`, `amber-*`, `emerald-*`, `.glass-nav-hero`, `.glass-nav-panel`). No arbitrary new hex codes or foreign design palettes.
  - Global CSS rules, `body`, and `:root` fonts remain untouched. Outfit (`fontFamily.display`) is used exclusively for display/headings, imported locally in the landing entry.
  - All landing-specific styles remain scoped under `.landing-root` in `frontend/src/pages/Landing/`.
- **Motion & Scroll Stack**:
  - Lenis smooth scrolling is active exclusively while the Landing view is mounted, destroyed immediately upon unmount so the operations dashboard and auth screens retain unhindered native scrolling.
  - Lenis and GSAP ScrollTrigger must remain strictly synchronized via `gsap.ticker`.
  - Transform-only parallax scrubbing on hero layers; below 768px and under `prefers-reduced-motion`, parallax and scrub are disabled in favor of static opacity reveals.
- **Data & Copy Integrity**:
  - Strictly real platform facts and technical specifications sourced directly from `README.md`. No fictitious quotes, testimonials, or simulated data claims.

## Landing Motion Rules (Retrofit Lock)
- **Library Separation (Strict)**: Framer-motion exclusively retains the scroll-locked Hero campus wipe clipPath and badge opacity crossfades. GSAP + ScrollTrigger exclusively governs parallax scrubbing, section reveals, image scrub, SVG line draw, metric count-ups, and hover glows. Never animate the same property on the same element with both libraries.
- **Marker Targeting**: Motion targets only explicit `[data-anim]` attributes; styling, layout, copy, and typography remain untouched.
- **Lifecycle Cleanliness**: Lenis instance and GSAP ScrollTrigger tickers must be cleanly instantiated on landing mount and completely destroyed upon unmount to preserve native dashboard scrolling.
- **Accessibility & Responsive**: Parallax, scrub, and Lenis are disabled below 768px and under `prefers-reduced-motion` in favor of accessible static reveals.
