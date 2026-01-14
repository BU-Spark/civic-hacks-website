gsap.registerPlugin(ScrollTrigger);

function initScroll() {
  const container = document.querySelector(".scroll-container");
  const wrapper = document.querySelector(".horizontal-wrapper");

  if (!wrapper || !container) return;

  const horizontalTween = gsap.to(wrapper, {
    x: () => -(wrapper.scrollWidth - document.documentElement.clientWidth) + "px",
    ease: "none",
    id: "horizontalTween",
    scrollTrigger: {
      trigger: container,
      pin: true,
      scrub: 1,
      end: () => "+=" + wrapper.offsetWidth,
      invalidateOnRefresh: true,
      anticipatePin: 1
    }
  });

  ScrollTrigger.create({
    trigger: ".vertical-hub",
    start: "top 80%",
    onEnter: () => document.querySelector(".site-header").classList.add("is-visible"),
    onLeaveBack: () => document.querySelector(".site-header").classList.remove("is-visible"),
    markers: false
  });

  requestAnimationFrame(() => {
    createCityGrid(".city-map-layer");
  });

  console.log("BSP City Initialized");
}

/* --- BSP CITY GENERATOR (Silicon Chip Style) --- */

// Store global navigation graph for the signal
let navGraph = {
  hLines: [], // {y, xStart, xEnd}
  vLines: []  // {x, yStart, yEnd}
};

function createCityGrid(containerSelector) {
  const container = document.querySelector(containerSelector);
  if (!container) return;

  container.innerHTML = '<svg class="signal-path-svg" id="signalSVG" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none"><path id="signalLine" d="" /></svg>';

  // Canvas
  const MAP_W = 400; // vw
  const MAP_H = 100; // vh

  // Reset Nav Graph
  navGraph = { hLines: [], vLines: [] };

  // Add Bounds to Graph (So signal can travel edges)
  navGraph.hLines.push({ y: 10, xStart: 0, xEnd: MAP_W });
  navGraph.hLines.push({ y: 90, xStart: 0, xEnd: MAP_W });

  // Start Recursion
  // Full Height 100vh
  recursiveSplit(container, 0, 0, MAP_W, 100);

  // Generate Path
  generateBSPSignalPath(container, MAP_W);

  // Parallax
  const buildings = gsap.utils.toArray(".map-building");
  buildings.forEach(building => {
    const depth = parseFloat(building.getAttribute("data-depth")) || 0;
    gsap.to(building, {
      x: depth * 150,
      ease: "none",
      scrollTrigger: {
        trigger: ".scroll-container",
        start: "left left",
        end: "right right",
        scrub: 1,
        containerAnimation: gsap.getById("horizontalTween")
      }
    });
  });
}

// Override recursiveSplit with corrected math to be safe
function recursiveSplit(container, x, y, w, h) {
  // High Res / Zoomed Out Settings
  const MIN_W = 4; // Much smaller split threshold
  const MIN_H = 6;

  // Termination Check: Stop if too small to split further
  // But allow quite deep recursion for density
  if (w < MIN_W * 2 || h < MIN_H * 2 || (w < 12 && Math.random() > 0.8)) {
    createLeafBlock(container, x, y, w, h);
    return;
  }

  const streetGap = 1.5; // Tighter streets for "Chip" look
  let splitVert = w > h;
  if (w / h < 1.2 && w / h > 0.8) splitVert = Math.random() > 0.5; // Square-ish? Random.

  if (splitVert) {
    // V-Split
    const safeW = w - (MIN_W * 2);
    if (safeW < 0) { createLeafBlock(container, x, y, w, h); return; }

    // Bias towards center for better distribution
    const splitVal = MIN_W + (Math.random() * safeW);

    // Add Nav Line (Center of gap)
    navGraph.vLines.push({ x: x + splitVal + (streetGap / 2), yStart: y, yEnd: y + h });

    recursiveSplit(container, x, y, splitVal, h);
    recursiveSplit(container, x + splitVal + streetGap, y, w - splitVal - streetGap, h);

  } else {
    // H-Split
    const safeH = h - (MIN_H * 2);
    if (safeH < 0) { createLeafBlock(container, x, y, w, h); return; }

    const splitVal = MIN_H + (Math.random() * safeH);

    navGraph.hLines.push({ y: y + splitVal + (streetGap / 2), xStart: x, xEnd: x + w });

    recursiveSplit(container, x, y, w, splitVal);
    recursiveSplit(container, x, y + splitVal + streetGap, w, h - splitVal - streetGap);
  }
}

function createLeafBlock(container, x, y, w, h) {
  // 1. Base (The Silicon Chip "Pad")
  // Only draw base if it's large enough to be visible
  if (w < 2 || h < 2) return;

  const base = document.createElement("div");
  base.classList.add("map-block-base");
  base.style.left = `${x}vw`;
  base.style.top = `${y}vh`;
  base.style.width = `${w}vw`;
  base.style.height = `${h}vh`;
  container.appendChild(base);

  // 2. Multiple Buildings Generator
  // We will subdivide THIS block into a mini-grid or random placement

  const PADDING = 0.3;
  const usableW = w - (PADDING * 2);
  const usableH = h - (PADDING * 2);
  const startX = x + PADDING;
  const startY = y + PADDING;

  // Density Check
  // If block is very small, 1 building
  if (usableW < 4 || usableH < 4) {
    createSingleBuilding(container, startX, startY, usableW, usableH);
    return;
  }

  // If block is large, try to put 2-4 buildings
  // Simple technique: Slice it once or twice
  const cols = Math.floor(usableW / 3); // Fit 3vw buildings
  const rows = Math.floor(usableH / 4); // Fit 4vh buildings

  // Random Scatter or Grid? Grid is cleaner for "Chip" look
  const cellW = usableW / Math.max(1, cols);
  const cellH = usableH / Math.max(1, rows);

  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      // 80% chance to have a building here
      if (Math.random() > 0.2) {
        // Gap between inner buildings
        const gap = 0.2;
        const bX = startX + (c * cellW) + gap;
        const bY = startY + (r * cellH) + gap;
        const bW = cellW - (gap * 2);
        const bH = cellH - (gap * 2);

        createSingleBuilding(container, bX, bY, bW, bH);
      }
    }
  }
}

function createSingleBuilding(container, x, y, w, h) {
  const building = document.createElement("div");
  building.classList.add("map-building");

  // Depth / Style logic
  const z = Math.random();
  const area = w * h;
  const isHigh = area > 20 || z > 0.85; // Heavier

  if (isHigh) {
    building.classList.add("building-high");
    building.setAttribute("data-depth", "0.6");
  } else if (z > 0.5) {
    building.classList.add("building-mid");
    building.setAttribute("data-depth", "0.3");
  } else {
    building.classList.add("building-low");
    building.setAttribute("data-depth", "0.1");
  }

  building.style.left = `${x}vw`;
  building.style.top = `${y}vh`;
  building.style.width = `${w}vw`;
  building.style.height = `${h}vh`;

  container.appendChild(building);
}

function generateBSPSignalPath(container, mapW) {
  // Walker using NavGraph
  // Start Middle-ish
  let cx = 0;
  let cy = 50;

  // Snap to closest H-Line
  let startLine = navGraph.hLines.find(l => Math.abs(l.y - 50) < 20);
  if (startLine) cy = startLine.y;

  let dString = `M 0,${cy} `;
  let totalDist = 0;

  while (cx < mapW) {
    // 1. Move Horizontal
    // Find next intersection (V-Line that crosses our current Y)
    // Filter V-Lines that are ahead of us (x > cx) AND span our Y
    const candidates = navGraph.vLines.filter(v => v.x > cx && v.yStart <= cy && v.yEnd >= cy);

    // Sort by X pos
    candidates.sort((a, b) => a.x - b.x);

    // Pick one to "Aim" for (not necessarily the first, to skip some streets)
    // But in BSP, skipping a wall means walking through a block? 
    // Wait: BSP streets are "Cuts". Navigating ONLY on cuts guarantees no clipping.
    // If we skip an intersection, we are still on the H-line... 
    // ...BUT does the H-Line extend that far?
    // BSP H-Lines have xStart/xEnd. We must stay within that segment.

    // Check current H-Line capability
    // Actually, finding the EXACT H-line segment we are on is safer.
    const currentHLine = navGraph.hLines.find(h => Math.abs(h.y - cy) < 0.1 && h.xStart <= cx + 0.1 && h.xEnd > cx);

    let targetX = mapW;
    if (currentHLine) targetX = currentHLine.xEnd;

    // If there are V-Lines before the end of this segment, we can turn at them.
    const validTurnPoints = candidates.filter(v => v.x < targetX);

    let nextX = targetX;

    // Decide to turn?
    if (validTurnPoints.length > 0 && Math.random() > 0.3) {
      const turnV = validTurnPoints[Math.floor(Math.random() * validTurnPoints.length)];
      nextX = turnV.x;

      // Draw to Turn
      dString += `L ${nextX},${cy} `;
      cx = nextX;

      // Perform Turn (Vertical Move)
      // We are now at intersection (cx, cy). We are on line 'turnV'.
      // Choose new Y along 'turnV'.
      const minY = Math.max(10, turnV.yStart);
      const maxY = Math.min(90, turnV.yEnd);

      const distinctY = maxY - minY;
      // Move random amount but stay on line
      // Try to find an intersecting H-Line to target?
      // For simplicity, just pick a random point on valid segment for now 
      // (This works visually, even if it dead-ends, line just stops or turns back)

      const safeY = minY + Math.random() * distinctY;

      // Actually, better to snap to another H-Line crossing this V-line
      const crossHLines = navGraph.hLines.filter(h => h.xStart <= cx && h.xEnd >= cx && Math.abs(h.y - cy) > 5);
      if (crossHLines.length > 0) {
        const destH = crossHLines[Math.floor(Math.random() * crossHLines.length)];
        // clamp destination
        if (destH.y >= minY && destH.y <= maxY) {
          dString += `L ${cx},${destH.y} `;
          cy = destH.y;
        }
      }

    } else {
      // Just walk to end of segment
      dString += `L ${nextX},${cy} `;
      cx = nextX;

      // If we hit end of segment (targetX), we might be dead-ended if no V-line there.
      // BSP ensures segments usually end at a perpendicular cut.
      // So at nextX, there SHOULD be a V-line (unless it's map edge).
      if (cx >= mapW) break; // Done

      // If we are at a T-junction (Head forced turn)
      // Find connecting V-line at cx
      const connector = navGraph.vLines.find(v => Math.abs(v.x - cx) < 0.1 && v.yStart <= cy && v.yEnd >= cy);
      if (connector) {
        // forced turn or find new path?
        // ... simplified for robustness: just break if stuck, but typically we find a way.
      }
    }
  }

  const svg = document.getElementById("signalSVG");
  const path = document.getElementById("signalLine");
  if (svg && path) {
    svg.setAttribute("viewBox", `0 0 ${mapW} 100`);
    path.setAttribute("d", dString);
    gsap.fromTo(path, { strokeDasharray: 8000, strokeDashoffset: 8000 },
      {
        strokeDashoffset: 0, ease: "none",
        scrollTrigger: { trigger: ".scroll-container", start: "left left", end: "right right", scrub: 1, containerAnimation: gsap.getById("horizontalTween") }
      });
  }
}

window.addEventListener("load", initScroll);
