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
