/* --- CANVAS CITY GENERATOR v2 --- */
/* Proper Architecture: Full-span streets, constrained buildings */

const DEBUG_CITY = false;

let ctx;
let canvas;
let blocks = [];    // {x, y, w, h} - City blocks (leaf nodes of BSP)
let buildings = []; // {x, y, w, h, depth} - Buildings within blocks
let streetH = [];   // {y, xStart, xEnd} - Horizontal street center lines
let streetV = [];   // {x, yStart, yEnd} - Vertical street center lines
let signalPathData = []; // [DEBUG] Stored path points for testing <!-- id: debug_points -->

let cityMapEl;
let scrollContainerEl;
let wrapperEl;
let svgEl;
let pathEl;
let headEl;

let isMapInView = true;
let renderTickerAdded = false;
let idleFrames = 0;
let lastScrollY = 0;

const IDLE_FRAME_LIMIT = 8;
const BAKE_SCALE = 0.75;

// Camera State
let currentCameraX = 0; // The smoothed camera position (in vw)
let targetCameraX = 0;  // The actual position of the signal head (in vw)
let currentMapScale = 1.0; // Dynamic zoom (1.0 = normal, 0.9 = zoomed out)
let targetMapScale = 1.0;
const CAM_LERP = 0.22;  // Smoother camera response
const SCALE_LERP = 0.12; // Faster zoom transition


const MAP_W = 400; // vw
const MAP_H = 100; // vh
const STREET_GAP = 2; // vw/vh gap between blocks

// Visual Config
const CONFIG = {
    streetColor: "#8c768f",       // Muted Mauve (Matches CSS)
    blockColor: "#4a3f4c",        // Darker Mauve Base
    buildingStroke: "rgba(0,0,0,0.2)",
    roofFill: "rgba(255,255,255,1)",
    shadowFill: "rgba(0,0,0,0.18)",
    maxBuildingDepth: 2.5,
    blockRadius: 0.8,
    // Muted Purple & Chartreuse Palette
    buildingTints: [
        { roof: "#6b5b6e", wall: "#7d6d80", window: "#c8d96f" }, // Dusty Purple
        { roof: "#8a9a5b", wall: "#9cae6d", window: "#e8f5a8" }, // Muted Chartreuse
        { roof: "#5d4e60", wall: "#6f6073", window: "#dae87f" }, // Deep Plum
        { roof: "#a4b86d", wall: "#b6ca7f", window: "#fff9c4" }, // Soft Lime
        { roof: "#7a6b7d", wall: "#8c7d8f", window: "#d4e157" }, // Lavender Grey
        { roof: "#8b9e5f", wall: "#9db071", window: "#f4ff81" }, // Pale Olive
        { roof: "#6d5d70", wall: "#7f6f82", window: "#cddc39" }, // Mauve Stone
        { roof: "#9aad6e", wall: "#acbf80", window: "#e6ee9c" }, // Sage Green
    ],
    // Darker Block variations (Mauve-Grey tones)
    blockTints: [
        "#4a3f4c",
        "#413643",
        "#544757",
        "#3d333f",
        "#4d4150",
    ]
};

function initCityCanvas(containerSelector) {
    const container = document.querySelector(containerSelector);
    if (!container) return;

    cityMapEl = container;
    scrollContainerEl = document.querySelector(".scroll-container");
    wrapperEl = document.querySelector(".horizontal-wrapper");

    // Canvas
    canvas = document.createElement("canvas");
    canvas.id = "cityCanvas";
    Object.assign(canvas.style, {
        position: "absolute", top: "0", left: "0", width: "100%", height: "100%"
    });
    container.appendChild(canvas);

    // SVG for Signal (Already in HTML now, just get references)
    svgEl = document.getElementById("signalSVG");
    pathEl = document.getElementById("signalLine");
    headEl = document.getElementById("signalHead");

    if (svgEl && !headEl) {
        // Create head if not in HTML
        const svgNS = "http://www.w3.org/2000/svg";
        const newHead = document.createElementNS(svgNS, "circle");
        newHead.id = "signalHead";
        newHead.setAttribute("r", "1.5");
        newHead.setAttribute("fill", "#00ffcc");
        newHead.style.filter = "drop-shadow(0 0 5px #00ffcc)";
        newHead.style.opacity = "0";
        svgEl.appendChild(newHead);
        headEl = newHead;
    }

    ctx = canvas.getContext("2d");

    new ResizeObserver(() => resize()).observe(container);
    resize();

    attachScrollListener();
    setupVisibilityObserver(scrollContainerEl || container);
    startRendering();
}

let scrollListenerAttached = false;
let visibilityObserver;

function startRendering() {
    idleFrames = 0;
    lastScrollY = window.scrollY || 0;
    render();
}

function stopRendering() {
    renderTickerAdded = false;
}

function attachScrollListener() {
    if (scrollListenerAttached) return;
    scrollListenerAttached = true;
    window.addEventListener("scroll", () => {
        if (isMapInView) startRendering();
    }, { passive: true });
}

function setupVisibilityObserver(target) {
    if (!target) {
        isMapInView = true;
        startRendering();
        return;
    }

    if (!("IntersectionObserver" in window)) {
        isMapInView = true;
        startRendering();
        return;
    }

    if (visibilityObserver) visibilityObserver.disconnect();
    visibilityObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            isMapInView = entry.isIntersecting && entry.intersectionRatio > 0;
            if (isMapInView) {
                startRendering();
            } else {
                stopRendering();
            }
        });
    }, { threshold: 0.1 });
    visibilityObserver.observe(target);
}

function resize() {
    if (!canvas) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    // Canvas is now 1 VIEWPORT wide, not the whole map
    canvas.width = rect.width;
    canvas.height = rect.height;

    const svg = svgEl || document.getElementById("signalSVG");
    // The SVG viewport is the FIXED screen, but we will move its viewBox
    if (svg) svg.setAttribute("viewBox", `0 0 100 ${MAP_H}`);

    if (blocks.length === 0) {
        generateCity();
        generateSignalPath();
    }
    bakeCity();

    startRendering();
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
    const tint = CONFIG.blockTints[Math.floor(Math.random() * CONFIG.blockTints.length)];
    blocks.push({ x, y, w, h, tint });

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

    const occupied = Array.from({ length: cols }, () => Array(rows).fill(false));

    for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
            if (occupied[c][r]) continue;

            if (Math.random() > 0.2) {
                const gap = 0.5; // Increased gap

                // Size variation: random shrinkage
                const shrinkW = Math.random() * 0.8; // 0 to 0.8 vw smaller
                const shrinkH = Math.random() * 0.8;

                const bx = innerX + c * cellW + gap + shrinkW / 2;
                const by = innerY + r * cellH + gap + shrinkH / 2;
                let bw = Math.max(1.5, cellW - gap * 2 - shrinkW);
                let bh = Math.max(2, cellH - gap * 2 - shrinkH);

                // Random depth, capped
                let depth = 0.2 + Math.random() * (CONFIG.maxBuildingDepth - 0.2);

                // Bigger buildings = taller
                const area = bw * bh;
                if (area > 12) depth = Math.min(CONFIG.maxBuildingDepth, depth * 1.5);
                if (area < 5) depth = depth * 0.6; // Small sheds stay low

                // CHANCE FOR COMPOUND SHAPE (Extend right)
                let compoundType = "rect";
                if (Math.random() > 0.6 && c < cols - 1 && !occupied[c + 1][r]) {
                    bw += cellW;
                    occupied[c + 1][r] = true;
                }

                const tint = CONFIG.buildingTints[Math.floor(Math.random() * CONFIG.buildingTints.length)];

                // Pre-generate stable roof clutter and windows
                const clutter = [];
                if (bw > 3 && bh > 3 && Math.random() > 0.4) {
                    const count = 1 + Math.floor(Math.random() * 2);
                    for (let i = 0; i < count; i++) {
                        clutter.push({
                            w: 0.5 + Math.random() * 1.5,
                            h: 0.5 + Math.random() * 1.5,
                            xOffset: 0.5 + Math.random() * (bw - 2),
                            yOffset: 0.5 + Math.random() * (bh - 2)
                        });
                    }
                }

                // NEW: Pre-calculate windows for performance
                let windowData = [];
                const hasWindows = Math.random() > 0.3;
                if (hasWindows && bw > 1.5) {
                    const winW = 0.8; // vw
                    const winH = 1.2; // vh
                    const pad = 0.3;
                    for (let wx = pad; wx < bw - pad; wx += winW * 2.5) {
                        for (let wy = pad; wy < bh - pad; wy += winH * 2.5) {
                            windowData.push({
                                x: wx,
                                y: wy,
                                lit: Math.random() > 0.4
                            });
                        }
                    }
                }

                buildings.push({
                    x: bx, y: by, w: bw, h: bh, depth,
                    tint,
                    compoundType,
                    hasSetback: Math.random() > 0.7 && depth > 1.0,
                    windows: windowData,
                    clutter
                });
            }
            occupied[c][r] = true;
        }
    }
}

/* --- OPTIMIZATION: BAKE STATIC GROUND --- */
let offscreenCanvas;
let offscreenCtx;

function bakeCity() {
    if (!offscreenCanvas) {
        offscreenCanvas = document.createElement("canvas");
        offscreenCtx = offscreenCanvas.getContext("2d", { alpha: false });
    }

    // Bake at map resolution (pixels per vw/vh)
    const ux = (canvas.width / 100) * BAKE_SCALE;
    const uy = (canvas.height / MAP_H) * BAKE_SCALE;

    offscreenCanvas.width = Math.ceil(MAP_W * ux);
    offscreenCanvas.height = Math.ceil(MAP_H * uy);

    const ctxB = offscreenCtx;
    ctxB.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);

    // 1. Draw Streets
    const streetGrad = ctxB.createLinearGradient(0, 0, 0, offscreenCanvas.height);
    streetGrad.addColorStop(0, CONFIG.streetColor);
    streetGrad.addColorStop(1, "#735d76"); // Darker mauve depth
    ctxB.fillStyle = streetGrad;
    ctxB.fillRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);

    // 2. Draw Block Pads
    const radius = CONFIG.blockRadius * ux;
    blocks.forEach(b => {
        ctxB.fillStyle = b.tint || CONFIG.blockColor;
        ctxB.beginPath();
        ctxB.roundRect(b.x * ux, b.y * uy, b.w * ux, b.h * uy, radius);
        ctxB.fill();
    });

    // 3. Draw Shadows + Buildings (static bake)
    const sunAngle = 0.6;
    const shadowDx = Math.cos(sunAngle) * 1.5;
    const shadowDy = Math.sin(sunAngle) * 1.5;

    ctxB.fillStyle = CONFIG.shadowFill;
    ctxB.beginPath();
    buildings.forEach(b => {
        const bx = (b.x * ux) | 0;
        const by = (b.y * uy) | 0;
        const bw = (b.w * ux) | 0;
        const bh = (b.h * uy) | 0;
        const sd = b.depth * 15;

        ctxB.moveTo(bx, by + bh);
        ctxB.lineTo(bx + bw, by + bh);
        ctxB.lineTo(bx + bw + shadowDx * sd, by + bh + shadowDy * sd);
        ctxB.lineTo(bx + shadowDx * sd, by + bh + shadowDy * sd);
        ctxB.closePath();
    });
    ctxB.fill();

    ctxB.lineWidth = 1;
    ctxB.lineJoin = "round";
    ctxB.strokeStyle = CONFIG.buildingStroke;

    buildings.forEach(b => {
        const bx = (b.x * ux) | 0;
        const by = (b.y * uy) | 0;
        const bw = (b.w * ux) | 0;
        const bh = (b.h * uy) | 0;

        const horizonY = MAP_H / 2;
        const distFromCenter = Math.abs(b.y + b.h / 2 - horizonY) / horizonY;
        const lightX = -shadowDx;
        const lightY = -shadowDy;

        const roofOffset = (b.depth * uy * 2 * (0.3 + distFromCenter * 0.7)) | 0;
        const rx = bx;
        const ry = by - roofOffset;

        // Left Wall
        const leftWallDot = -1 * lightX;
        const leftRef = 0.8 + (leftWallDot + 1) * 0.1;
        ctxB.fillStyle = b.tint.wall;
        ctxB.beginPath();
        ctxB.moveTo(bx, by);
        ctxB.lineTo(rx, ry);
        ctxB.lineTo(rx, ry + bh);
        ctxB.lineTo(bx, by + bh);
        ctxB.closePath();
        ctxB.fill();
        ctxB.fillStyle = `rgba(0,0,0,${(1 - leftRef) * 2})`;
        ctxB.fill();
        ctxB.stroke();

        // Front Wall
        const frontWallDot = 1 * lightY;
        const frontRef = 0.8 + (frontWallDot + 1) * 0.1;
        ctxB.fillStyle = b.tint.wall;
        ctxB.beginPath();
        ctxB.moveTo(bx, by + bh);
        ctxB.lineTo(rx, ry + bh);
        ctxB.lineTo(rx + bw, ry + bh);
        ctxB.lineTo(bx + bw, by + bh);
        ctxB.closePath();
        ctxB.fill();
        ctxB.fillStyle = `rgba(0,0,0,${(1 - frontRef) * 2})`;
        ctxB.fill();
        ctxB.stroke();

        // Roof
        const roofGrad = ctxB.createLinearGradient(rx, ry, rx + bw, ry + bh);
        roofGrad.addColorStop(0, b.tint.roof);
        roofGrad.addColorStop(1, b.tint.wall);
        ctxB.fillStyle = roofGrad;
        ctxB.fillRect(rx | 0, ry | 0, bw | 0, bh | 0);
        ctxB.strokeRect(rx | 0, ry | 0, bw | 0, bh | 0);

        // Roof Clutter
        if (b.clutter && b.clutter.length > 0) {
            ctxB.fillStyle = "rgba(0,0,0,0.05)";
            b.clutter.forEach(c => {
                const cx = (rx + c.xOffset * ux) | 0;
                const cy = (ry + c.yOffset * uy) | 0;
                const cw = (c.w * ux) | 0;
                const ch = (c.h * uy) | 0;
                ctxB.fillRect(cx, cy, cw, ch);
                ctxB.strokeRect(cx, cy, cw, ch);
            });
        }

        // Setback
        if (b.hasSetback) {
            const sw = (bw * 0.6) | 0;
            const sh = (bh * 0.6) | 0;
            const sx = (rx + (bw - sw) / 2) | 0;
            const sy = (ry + (bh - sh) / 2) | 0;
            const sd = (roofOffset * 0.4) | 0;

            ctxB.fillStyle = b.tint.roof;
            ctxB.fillRect(sx, sy - sd, sw, sh);
            ctxB.strokeRect(sx, sy - sd, sw, sh);
        }

        // Windows
        if (b.windows && b.windows.length > 0 && bw > 7 * ux) {
            const winW = (0.8 * ux) | 0;
            const winH = (1.2 * uy) | 0;

            b.windows.forEach(w => {
                const wx = (rx + w.x * ux) | 0;
                const wy = (ry + w.y * uy) | 0;

                if (w.lit) {
                    ctxB.fillStyle = b.tint.window || "#ffd700";
                    ctxB.fillRect(wx, wy, winW, winH);
                } else {
                    ctxB.fillStyle = "rgba(0,0,0,0.08)";
                    ctxB.fillRect(wx, wy, winW, winH);
                }
            });
        }
    });

    if (DEBUG_CITY) {
        console.log(`[PERF] City Baked: ${offscreenCanvas.width}x${offscreenCanvas.height}`);
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



    const path = pathEl || document.getElementById("signalLine");
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
/**
 * REFACTORED: Fixed-Distance Scroll Controller
 * Decouples signal speed from geometry. The journey is exactly (MAP_W * 15)px long.
 */
function animateSignalPath() {
    const path = pathEl || document.getElementById("signalLine");
    const head = headEl || document.getElementById("signalHead");
    const wrapper = wrapperEl || document.querySelector(".horizontal-wrapper");
    const container = scrollContainerEl || document.querySelector(".scroll-container");
    const mapEl = cityMapEl || document.getElementById("cityMap");

    if (!path || !wrapper || !container) return;

    const pathTotalLength = path.getTotalLength();
    const viewportWidthVW = 100;
    const scrollDistance = MAP_W * 10;
    const maxWrapperShift = () => -(wrapper.scrollWidth - container.clientWidth);

    wrapper.style.transformOrigin = "center center";
    if (head) {
        head.setAttribute("fill", "#deff4f");
        head.style.filter = "drop-shadow(0 0 5px #deff4f)";
    }

    // 1. Setup the master timeline with ScrollTrigger
    const tl = gsap.timeline({
        scrollTrigger: {
            trigger: container,
            pin: true,
            scrub: 0.6, // smoother scrub to reduce jank
            start: "top top",
            end: () => "+=" + scrollDistance, // Slower horizontal travel
            invalidateOnRefresh: true,
            onEnter: startRendering,
            onEnterBack: startRendering,
            onLeave: stopRendering,
            onLeaveBack: stopRendering,
            onToggle: (self) => {
                if (!window.lenis || !window.lenis.options) return;
                if (!window.lenisDefaults) return;
                if (self.isActive) {
                    window.lenis.options.duration = 0;
                    window.lenis.options.easing = (t) => t;
                } else {
                    window.lenis.options.duration = window.lenisDefaults.duration;
                    window.lenis.options.easing = window.lenisDefaults.easing;
                }
            },
            // Removed snap property to disable "snapping into frame"
            onUpdate: (self) => {
                const scrollProgress = self.progress; // 0 to 1 based on FIXED scroll distance

                // --- REVERTED TO LINEAR SCROLL ---
                // Removed "Dwell & Rush" mapping (getCarouselProgress)
                // Removed Dynamic Zoom (targetMapScale)

                // Constant scale
                targetMapScale = 1.0;

                // Update path position based on LINEAR progress
                const currentLen = scrollProgress * pathTotalLength;
                const point = path.getPointAtLength(currentLen);

                if (head) {
                    head.setAttribute("cx", point.x);
                    head.setAttribute("cy", point.y);
                    head.style.opacity = scrollProgress > 0.001 ? "1" : "0";
                }

                // 3. CAMERA MAPPING - PURE LINEAR based on scroll progress
                const cameraX = scrollProgress * (MAP_W - viewportWidthVW);

                // Clamp camera bounds
                targetCameraX = Math.max(0, Math.min(MAP_W - viewportWidthVW, cameraX));

                // 4. MAP FADE-OUT (Entrance to Hub)
                if (scrollProgress > 0.95) {
                    const fade = 1 - (scrollProgress - 0.95) * 20; // 1 to 0
                    if (mapEl) mapEl.style.opacity = Math.max(0, fade);
                } else {
                    if (mapEl) mapEl.style.opacity = "1";
                }

                if (isMapInView) render();
            }
        }
    });

    // 2. Animate the path and wrapper with GSAP (avoid manual DOM transforms)
    tl.to(path, {
        strokeDashoffset: 0,
        ease: "none"
    }, 0);
    tl.to(wrapper, {
        x: maxWrapperShift,
        ease: "none",
        force3D: true
    }, 0);
    console.log("Linear Camera + Path-Following Signal initialized");
}



window.animateSignalPath = animateSignalPath;

/* --- RENDERING --- */

function render() {
    if (!ctx || !canvas) return;
    if (!isMapInView) {
        stopRendering();
        return;
    }

    // 0. Update Camera & Scale (locked to scroll progress)
    currentCameraX = targetCameraX;
    currentMapScale = targetMapScale;

    // Sync SVG viewBox with Camera & Scale
    const svg = svgEl || document.getElementById("signalSVG");
    if (svg) {
        const vw = 100 / currentMapScale;
        const vh = MAP_H / currentMapScale;
        const ox = currentCameraX - (vw - 100) / 2;
        const oy = -(vh - MAP_H) / 2;
        svg.setAttribute("viewBox", `${ox} ${oy} ${vw} ${vh}`);
    }

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    ctx.save();
    // Center and Scale the context
    ctx.translate(W / 2, H / 2);
    ctx.scale(currentMapScale, currentMapScale);
    ctx.translate(-W / 2, -H / 2);

    // 1. Draw Baked City (single call)
    if (offscreenCanvas) {
        const bakedUx = offscreenCanvas.width / MAP_W;
        const sx = currentCameraX * bakedUx;
        const sw = 100 * bakedUx;
        ctx.drawImage(offscreenCanvas, sx, 0, sw, offscreenCanvas.height, 0, 0, W, H);
    } else {
        // Fallback if not baked
        const streetGrad = ctx.createLinearGradient(0, 0, W, H);
        streetGrad.addColorStop(0, CONFIG.streetColor);
        streetGrad.addColorStop(1, "#cbb6c7");
        ctx.fillStyle = streetGrad;
        ctx.fillRect(0, 0, W, H);
    }

    ctx.restore();
}

window.initCityCanvas = initCityCanvas;
