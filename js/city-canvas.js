/* --- CANVAS CITY GENERATOR v2 --- */
/* Proper Architecture: Full-span streets, constrained buildings */

let ctx;
let canvas;
let blocks = [];    // {x, y, w, h} - City blocks (leaf nodes of BSP)
let buildings = []; // {x, y, w, h, depth} - Buildings within blocks
let streetH = [];   // {y, xStart, xEnd} - Horizontal street center lines
let streetV = [];   // {x, yStart, yEnd} - Vertical street center lines
let signalPathData = []; // [DEBUG] Stored path points for testing <!-- id: debug_points -->


const MAP_W = 400; // vw
const MAP_H = 100; // vh
const STREET_GAP = 2; // vw/vh gap between blocks

// Visual Config
const CONFIG = {
    streetColor: "#e0e0e0",       // Concrete gray
    blockColor: "#ffffff",         // White sidewalk
    buildingStroke: "rgba(0,0,0,0.5)",
    // Building fills will be generated with variation
    roofFill: "rgba(250,250,250,0.95)",  // More opaque roofs
    shadowFill: "rgba(0,0,0,0.06)",
    maxBuildingDepth: 1.2,           // Reduced for subtler effect
    blockRadius: 0.4,
};

function initCityCanvas(containerSelector) {
    const container = document.querySelector(containerSelector);
    if (!container) return;

    container.innerHTML = "";

    // Canvas
    canvas = document.createElement("canvas");
    canvas.id = "cityCanvas";
    Object.assign(canvas.style, {
        position: "absolute", top: "0", left: "0", width: "100%", height: "100%"
    });
    container.appendChild(canvas);

    // SVG for Signal (Overlay)
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.classList.add("signal-path-svg");
    svg.id = "signalSVG";
    svg.setAttribute("preserveAspectRatio", "none");
    const path = document.createElementNS(svgNS, "path");
    path.id = "signalLine";
    svg.appendChild(path);

    // [DEBUG] Signal Head Marker <!-- id: debug_head_svg -->
    const head = document.createElementNS(svgNS, "circle");
    head.id = "signalHead";
    head.setAttribute("r", "1.5");
    head.setAttribute("fill", "#00ffcc"); // Neon cyan head
    head.style.filter = "drop-shadow(0 0 5px #00ffcc)";
    head.style.opacity = "0";
    svg.appendChild(head);

    container.appendChild(svg);

    ctx = canvas.getContext("2d");

    new ResizeObserver(() => resize()).observe(container);
    resize();

    gsap.ticker.add(render);
}

function resize() {
    if (!canvas) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    const svg = document.getElementById("signalSVG");
    if (svg) svg.setAttribute("viewBox", `0 0 ${MAP_W} ${MAP_H}`);

    if (blocks.length === 0) {
        generateCity();
        generateSignalPath();
    }
}

/* --- CITY GENERATION --- */

function generateCity() {
    blocks = [];
    buildings = [];
    streetH = [];
    streetV = [];

    // GUARANTEED MAIN STREET: Split map at center first
    const mainStreetY = MAP_H / 2;
    const mainStreetGap = STREET_GAP;

    // Record the main street (full width)
    streetH.push({ y: mainStreetY, xStart: 0, xEnd: MAP_W });

    // BSP the TOP half (above main street)
    bspSplit(0, 0, MAP_W, mainStreetY - mainStreetGap / 2);

    // BSP the BOTTOM half (below main street)
    bspSplit(0, mainStreetY + mainStreetGap / 2, MAP_W, MAP_H - mainStreetY - mainStreetGap / 2);

    // Sort buildings by Y for painter's algorithm
    buildings.sort((a, b) => a.y - b.y);
}

function bspSplit(x, y, w, h) {
    const MIN_BLOCK_W = 5;  // Smaller for zoom-out
    const MIN_BLOCK_H = 6;

    // Termination: Create a block
    if (w < MIN_BLOCK_W * 2 || h < MIN_BLOCK_H * 2) {
        createBlock(x, y, w, h);
        return;
    }

    // Random chance to stop early for variety
    if (w < 20 && h < 20 && Math.random() > 0.7) {
        createBlock(x, y, w, h);
        return;
    }

    // Decide split direction
    let splitVertical = w > h;
    if (Math.abs(w - h) < 5) splitVertical = Math.random() > 0.5;

    if (splitVertical) {
        // Vertical Split
        const minSplit = MIN_BLOCK_W;
        const maxSplit = w - MIN_BLOCK_W - STREET_GAP;
        if (maxSplit <= minSplit) { createBlock(x, y, w, h); return; }

        const splitAt = minSplit + Math.random() * (maxSplit - minSplit);

        // Record street line with slight overlap at ends to ensure connectivity <!-- id: fix_connectivity_v -->
        streetV.push({
            x: x + splitAt + STREET_GAP / 2,
            yStart: y - STREET_GAP,
            yEnd: y + h + STREET_GAP
        });

        // Recurse
        bspSplit(x, y, splitAt, h);
        bspSplit(x + splitAt + STREET_GAP, y, w - splitAt - STREET_GAP, h);

    } else {
        // Horizontal Split
        const minSplit = MIN_BLOCK_H;
        const maxSplit = h - MIN_BLOCK_H - STREET_GAP;
        if (maxSplit <= minSplit) { createBlock(x, y, w, h); return; }

        const splitAt = minSplit + Math.random() * (maxSplit - minSplit);

        // Record street line with slight overlap at ends to ensure connectivity <!-- id: fix_connectivity_h -->
        streetH.push({
            y: y + splitAt + STREET_GAP / 2,
            xStart: x - STREET_GAP,
            xEnd: x + w + STREET_GAP
        });

        // Recurse
        bspSplit(x, y, w, splitAt);
        bspSplit(x, y + splitAt + STREET_GAP, w, h - splitAt - STREET_GAP);
    }
}

function createBlock(x, y, w, h) {
    blocks.push({ x, y, w, h });

    // Place buildings INSIDE this block
    // Reduced padding for more density
    const EDGE_PADDING = 1.5;
    const SIDE_PADDING = 0.4;

    const innerX = x + SIDE_PADDING;
    const innerY = y + EDGE_PADDING;
    const innerW = w - SIDE_PADDING * 2;
    const innerH = h - EDGE_PADDING * 2;

    if (innerW < 1.5 || innerH < 2) return;

    // Denser grid of buildings
    const cols = Math.max(1, Math.floor(innerW / 3)); // Smaller cells
    const rows = Math.max(1, Math.floor(innerH / 3.5));
    const cellW = innerW / cols;
    const cellH = innerH / rows;

    for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
            if (Math.random() > 0.2) { // 80% fill for more density
                const gap = 0.5; // Increased gap

                // Size variation: random shrinkage
                const shrinkW = Math.random() * 0.8; // 0 to 0.8 vw smaller
                const shrinkH = Math.random() * 0.8;

                const bx = innerX + c * cellW + gap + shrinkW / 2;
                const by = innerY + r * cellH + gap + shrinkH / 2;
                const bw = Math.max(1.5, cellW - gap * 2 - shrinkW);
                const bh = Math.max(2, cellH - gap * 2 - shrinkH);

                // Random depth, capped
                let depth = 0.2 + Math.random() * (CONFIG.maxBuildingDepth - 0.2);
                // Bigger buildings = taller
                if (bw * bh > 12) depth = Math.min(CONFIG.maxBuildingDepth, depth * 1.3);

                buildings.push({ x: bx, y: by, w: bw, h: bh, depth });
            }
        }
    }
}

/* --- SIGNAL PATH --- */

/**
 * REDESIGN: Winding Lookahead Walker
 * Uses waypoints and vertical bias to create organic, non-linear paths.
 */
function generateSignalPath() {
    const intersections = [];

    // 1. Pre-indexing all intersections between H and V streets
    streetH.forEach(h => {
        streetV.forEach(v => {
            if (v.x >= h.xStart - 0.1 && v.x <= h.xEnd + 0.1 &&
                h.y >= v.yStart - 0.1 && h.y <= v.yEnd + 0.1) {
                intersections.push({ x: v.x, y: h.y, hStreet: h, vStreet: v });
            }
        });
    });

    // 2. Setup Waypoints (Zone-based Target Y)
    const zoneCount = 4;
    const zoneTargets = [];
    for (let i = 0; i < zoneCount; i++) {
        // Prefer targets away from the center (20-40 or 60-80 range)
        const side = Math.random() > 0.5 ? 1 : -1;
        const targetY = (MAP_H / 2) + side * (15 + Math.random() * 25);
        zoneTargets.push(targetY);
    }

    let cx = 0;
    let cy = MAP_H / 2;
    let currentH = streetH.find(h => Math.abs(h.y - cy) < 0.1);
    let hRunDistance = 0; // Track how long we've been on this X-run

    let pathPoints = [{ x: 0, y: cy }];
    let safety = 0;

    // 3. Walk through intersections with lookahead and bias
    while (cx < MAP_W && safety++ < 150) {
        const zoneIdx = Math.min(zoneCount - 1, Math.floor((cx / MAP_W) * zoneCount));
        const targetY = zoneTargets[zoneIdx];

        // Find intersections ahead on current street
        const candidates = intersections
            .filter(idx => idx.hStreet === currentH && idx.x > cx + 3)
            .sort((a, b) => a.x - b.x);

        if (candidates.length === 0) break;

        let chosenIdx = null;
        let chosenNextH = null;

        // Pressure to turn after 50vw of straight line
        const turnWeight = 0.2 + (hRunDistance / 50);

        for (let idx of candidates) {
            // Find reachable H-streets
            const reachableH = streetH.filter(h =>
                h !== currentH &&
                h.xStart <= idx.x + 0.1 && h.xEnd >= idx.x - 0.1 &&
                h.y >= idx.vStreet.yStart - 0.1 && h.y <= idx.vStreet.yEnd + 0.1 &&
                h.xEnd > idx.x + 30 // Still needs significant forward progress
            );

            if (reachableH.length === 0) continue;

            // Score this turn based on targetY proximity
            const turnCandidates = reachableH.map(h => ({
                h,
                distToTarget: Math.abs(h.y - targetY),
                isMovingTowards: Math.abs(h.y - targetY) < Math.abs(cy - targetY)
            }));

            // Pick the best one for this intersection (closest to target)
            turnCandidates.sort((a, b) => a.distToTarget - b.distToTarget);
            const bestChoice = turnCandidates[0];

            // Turn probability
            const randomFactor = Math.random();
            const turnThreshold = bestChoice.isMovingTowards ? (0.4 - turnWeight) : (0.7 - turnWeight);

            if (randomFactor > Math.max(0.1, turnThreshold)) {
                chosenIdx = idx;
                chosenNextH = bestChoice.h;
                break;
            }
        }

        if (chosenIdx) {
            pathPoints.push({ x: chosenIdx.x, y: cy });
            pathPoints.push({ x: chosenIdx.x, y: chosenNextH.y });
            hRunDistance = 0; // Reset run distance
            cx = chosenIdx.x;
            cy = chosenNextH.y;
            currentH = chosenNextH;
        } else {
            // Keep going on this street
            const moveAmt = Math.min(20, currentH.xEnd - cx);
            if (moveAmt <= 2 && candidates.length > 0) {
                // Force a turn if we are at the edge of this street segment
                const fallback = candidates[0];
                const anyH = streetH.filter(h =>
                    h !== currentH &&
                    h.xStart <= fallback.x + 0.1 && h.xEnd >= fallback.x - 0.1 &&
                    h.y >= fallback.vStreet.yStart - 0.1 && h.y <= fallback.vStreet.yEnd + 0.1
                );
                if (anyH.length > 0) {
                    const nextH = anyH[Math.floor(Math.random() * anyH.length)];
                    pathPoints.push({ x: fallback.x, y: cy });
                    pathPoints.push({ x: fallback.x, y: nextH.y });
                    cx = fallback.x;
                    cy = nextH.y;
                    currentH = nextH;
                    hRunDistance = 0;
                } else {
                    cx = currentH.xEnd;
                    pathPoints.push({ x: cx, y: cy });
                    break;
                }
            } else {
                cx += Math.max(1, moveAmt);
                hRunDistance += Math.max(1, moveAmt);
                pathPoints.push({ x: cx, y: cy });
            }
        }
    }

    // 4. Final cleanup: Ensure path reaches MAP_W
    if (pathPoints[pathPoints.length - 1].x < MAP_W) {
        pathPoints.push({ x: MAP_W, y: pathPoints[pathPoints.length - 1].y });
    }

    // Build SVG path
    if (pathPoints.length < 2) return;
    signalPathData = pathPoints; // [DEBUG] Store for external access <!-- id: debug_store -->

    let d = `M ${pathPoints[0].x},${pathPoints[0].y}`;
    for (let i = 1; i < pathPoints.length; i++) {
        d += ` L ${pathPoints[i].x},${pathPoints[i].y}`;
    }

    // [DEBUG] Render Checkpoints <!-- id: debug_render_checkpoints -->
    renderCheckpoints(pathPoints);

    // [DEBUG] Run Collision Test <!-- id: debug_collision_test_call -->
    verifyPathCollisions(pathPoints);

    const path = document.getElementById("signalLine");
    if (path) {
        path.setAttribute("d", d);

        // Set initial state: fully hidden using a massive dash array to prevent repetition
        const safeLength = 100000;
        path.style.strokeDasharray = safeLength;
        path.style.strokeDashoffset = safeLength;
    }
}

// Exposed function to be called by app.js after horizontalTimeline is ready
// [DEBUG] Update Signal Tracker and Checkpoints <!-- id: debug_animation_logic -->
function animateSignalPath(horizontalTimeline) {
    const path = document.getElementById("signalLine");
    const head = document.getElementById("signalHead");
    if (!path) {
        console.warn("Signal path not found");
        return;
    }

    // Use the same massive length to avoid repetition segments
    const safeLength = 100000;
    const pathTotalLength = path.getTotalLength();

    // UPDATE: Add to the existing horizontal timeline for perfect sync
    horizontalTimeline.to(path, {
        strokeDashoffset: 0,
        ease: "none",
        onUpdate: function () {
            // [DEBUG] Track signal tip position <!-- id: debug_head_update -->
            if (head) {
                const progress = 1 - (parseFloat(path.style.strokeDashoffset) / safeLength);
                const currentLen = progress * pathTotalLength;
                const point = path.getPointAtLength(Math.max(0, currentLen));

                head.setAttribute("cx", point.x);
                head.setAttribute("cy", point.y);
                head.style.opacity = progress > 0 ? "1" : "0";

                // Set head color to neon lime
                head.setAttribute("fill", "#deff4f");
                head.style.filter = "drop-shadow(0 0 5px #deff4f)";

                // [DEBUG] Checkpoint reaching detection <!-- id: debug_checkpoint_detection -->
                checkCheckpoints(point, currentLen);
            }
        }
    }, 0); // Start at time 0 of the timeline to span the whole duration

    console.log("Signal animation synced with main timeline");
}

/* --- [DEBUG] TESTING UTILITIES --- <!-- id: debug_utilities_block --> */

function renderCheckpoints(points) {
    const svg = document.getElementById("signalSVG");
    if (!svg) return;

    // Remove old checkpoints
    svg.querySelectorAll(".debug-checkpoint").forEach(c => c.remove());

    points.forEach((p, i) => {
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.classList.add("debug-checkpoint");
        circle.dataset.index = i;
        circle.setAttribute("cx", p.x);
        circle.setAttribute("cy", p.y);
        circle.setAttribute("r", "1");
        circle.setAttribute("fill", "rgba(255, 0, 0, 0.4)"); // Red for unreached
        circle.setAttribute("stroke", "white");
        circle.setAttribute("stroke-width", "0.2");
        svg.appendChild(circle);
    });
}

function checkCheckpoints(headPoint, currentLength) {
    const checkpoints = document.querySelectorAll(".debug-checkpoint");
    checkpoints.forEach(c => {
        const index = parseInt(c.dataset.index);
        const point = signalPathData[index];
        if (!point) return;

        // Simple distance check or "index reached" check
        // If we are past the point's general proximity, mark it
        const dx = headPoint.x - point.x;
        const dy = headPoint.y - point.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Increased threshold to 5 units for more reliable detection
        if (dist < 5 && c.getAttribute("fill") !== "#00ffcc") {
            c.setAttribute("fill", "#00ffcc");
            c.setAttribute("r", "1.5");
            console.log(`[SIGNAL DEBUG] Reached Checkpoint ${index} at (${point.x.toFixed(1)}, ${point.y.toFixed(1)})`);
        }
    });
}

// [DEBUG] Collision Verification Test (Segment-Sampling) <!-- id: debug_collision_logic_v2 -->
function verifyPathCollisions(points) {
    if (blocks.length === 0) return;

    let totalCollisions = 0;
    const samplesPerSegment = 10;

    for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];
        let segmentFailed = false;

        // Sample points along the segment
        for (let s = 0; s <= samplesPerSegment; s++) {
            const t = s / samplesPerSegment;
            const sx = p1.x + (p2.x - p1.x) * t;
            const sy = p1.y + (p2.y - p1.y) * t;

            const block = blocks.find(b =>
                sx >= b.x && sx <= b.x + b.w &&
                sy >= b.y && sy <= b.y + b.h
            );

            if (block) {
                segmentFailed = true;
                break;
            }
        }

        if (segmentFailed) {
            totalCollisions++;
            // Mark BOTH checkpoints of the failing segment black
            const dots = document.querySelectorAll(".debug-checkpoint");
            if (dots[i]) dots[i].setAttribute("fill", "black");
            if (dots[i + 1]) dots[i + 1].setAttribute("fill", "black");

            console.error(`[SIGNAL DEBUG] COLLISION IN SEGMENT ${i}-${i + 1}: Segment crosses Block!`);
        }
    }

    if (totalCollisions === 0) {
        console.log("%c[SIGNAL DEBUG] PATH VERIFIED: 0 collisions detected (Segment Sampling).", "color: #00ffcc; font-weight: bold;");
    } else {
        console.warn(`[SIGNAL DEBUG] PATH FAILED: ${totalCollisions} segment collisions detected.`);
    }
}

window.animateSignalPath = animateSignalPath;

/* --- RENDERING --- */

function render() {
    if (!ctx || !canvas) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const ux = W / MAP_W; // Unit X (pixels per vw)
    const uy = H / MAP_H; // Unit Y (pixels per vh)

    // Dynamic shadow angle based on scroll
    const scroll = window.scrollY || 0;
    const sunAngle = (scroll / 4000) + 0.4;
    const shadowDx = Math.cos(sunAngle) * 1.5;
    const shadowDy = Math.sin(sunAngle) * 1.5;

    // 1. Draw Street Background (entire canvas)
    ctx.fillStyle = CONFIG.streetColor;
    ctx.fillRect(0, 0, W, H);

    // 2. Draw Block Pads (Sidewalks) with rounded corners
    ctx.fillStyle = CONFIG.blockColor;
    const radius = CONFIG.blockRadius * ux; // Convert to pixels
    blocks.forEach(b => {
        const bx = b.x * ux;
        const by = b.y * uy;
        const bw = b.w * ux;
        const bh = b.h * uy;

        ctx.beginPath();
        ctx.roundRect(bx, by, bw, bh, radius);
        ctx.fill();
    });

    // 3. Draw ALL Shadows First (so they go under all buildings)
    ctx.fillStyle = CONFIG.shadowFill;
    buildings.forEach(b => {
        const bx = b.x * ux;
        const by = b.y * uy;
        const bw = b.w * ux;
        const bh = b.h * uy;
        const sd = b.depth * 15; // Shadow distance multiplier

        ctx.beginPath();
        ctx.moveTo(bx, by + bh);
        ctx.lineTo(bx + bw, by + bh);
        ctx.lineTo(bx + bw + shadowDx * sd, by + bh + shadowDy * sd);
        ctx.lineTo(bx + shadowDx * sd, by + bh + shadowDy * sd);
        ctx.closePath();
        ctx.fill();
    });

    // 4. Draw Buildings (sorted by Y)
    ctx.lineWidth = 1;
    ctx.lineJoin = "miter";

    buildings.forEach(b => {
        const bx = b.x * ux;
        const by = b.y * uy;
        const bw = b.w * ux;
        const bh = b.h * uy;

        // SIMPLIFIED PERSPECTIVE: Always project UP, magnitude varies by distance from center
        const horizonY = MAP_H / 2;
        const distFromCenter = Math.abs(b.y + b.h / 2 - horizonY) / horizonY; // 0 at center, 1 at edges

        // All roofs project UPWARD, but more at edges, less at center
        const roofOffset = b.depth * uy * 2 * (0.3 + distFromCenter * 0.7);
        const rx = bx;
        const ry = by - roofOffset; // Always negative = always above

        // VARIED BUILDING COLOR: light grays with slight variation
        const grayVal = 240 + Math.floor(Math.random() * 15); // 240-255
        const wallColor = `rgb(${grayVal}, ${grayVal}, ${grayVal})`;

        ctx.strokeStyle = CONFIG.buildingStroke;
        ctx.fillStyle = wallColor;

        // Left face
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(rx, ry);
        ctx.lineTo(rx, ry + bh);
        ctx.lineTo(bx, by + bh);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Front face (bottom)
        ctx.beginPath();
        ctx.moveTo(bx, by + bh);
        ctx.lineTo(rx, ry + bh);
        ctx.lineTo(rx + bw, ry + bh);
        ctx.lineTo(bx + bw, by + bh);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Roof (top)
        ctx.fillStyle = CONFIG.roofFill;
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx + bw, ry);
        ctx.lineTo(rx + bw, ry + bh);
        ctx.lineTo(rx, ry + bh);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    });
}

window.initCityCanvas = initCityCanvas;
