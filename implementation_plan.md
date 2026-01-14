# IMPLEMENATION PLAN - Civic Hacks 2026 Experience

## Vision
A "scroll-jacked" storytelling experience that takes the user on a journey through the "Civic Signal"—a line of light connecting the community to technology.
- **Desktop:** Horizontal scroll through an isometric "Aerial City" grid.
- **Mobile:** Vertical scroll with a dynamic "snaking" line navigating content blocks.
- **Ending:** Both experiences land at "The Hub" (Vertical section for Agenda/Sponsors).

## Phase 1: Foundation & Structure
- [ ] **Setup GSAP**: Add GSAP and ScrollTrigger via CDN to `index.html`.
- [ ] **Layout Refactor**: 
    - Wrap storytelling content in a `.horizontal-outer` wrapper.
    - Create the `.vertical-hub` section for logistics.
- [ ] **CSS Core**:
    - Update `style.css` to handle horizontal overflow.
    - specific styles for the `pin-wrap` functionality.

## Phase 2: The Aerial Grid (Visuals)
- [ ] **SVG Blocks**: Create reusable SVG components for "Buildings" and "Streets".
## Algorithm Update: Recursive Subdivision (Silicon Chip Style)
To achieve the "Silicon Chip" / "Macro-Block" look where streets aren't global:
1.  **BSP (Binary Space Partitioning):**
    - Start with the full 400vw x 100vh canvas.
    - Recursively split regions either Horizontally or Vertically.
    - **Randomness:** Some splits create "Major Arteries" (wide), deep recursion creates "Alleys" (narrow).
    - **Termination:** Stop splitting when a region is small (e.g., < 8vw). These become "Blocks".
2.  **Visuals:**
    - Render a `map-block-base` for each leaf node (Block).
    - Populate each block with buildings (using the existing `createOrganicBlock` logic).
3.  **Pathfinding (The Signal):**
    - As we split, we record the "Street Segments" (the gaps between children).
    - Connect these segments into a searchable Graph.
    - The Signal moves from one segment to an intersecting segment.
    - **Constraint:** Keep signal loop simple; finding a long path in a BSP tree might be complex, so we might force a few "Global Arteries" to ensure connectivity.

## Phase 3: The Mechanics (Animation)
- [ ] **ScrollTrigger Implementation**:
    - Connect the horizontal scroll to the mouse wheel.
    - Animate the "Signal Line" drawing itself as the user scrolls (`stroke-dashoffset` trick).
- [ ] **Parallax**: Make the "Buildings" move slower than the "Text" to create 3D depth.

## Phase 4: Content & Polish
- [ ] **Populate Sections**:
    - **Slide 1 (Hero)**: Intro.
    - **Slide 2 (The Why)**: Problem/Solution.
    - **Slide 3 (The Tracks)**: Interactive track details.
    - **Slide 4 (Transition)**: Arrival at BU CCDS.
- [ ] **Mobile Responsiveness**: Implement the "Snake" layout for screens < 768px.
- [ ] **High-Fidelity UI**: Add the "Glitch" effects and neon glows.
