/* --- CANVAS CITY GENERATOR v2 --- */
/* Proper Architecture: Full-span streets, constrained buildings */

const DEBUG_CITY = false;

let ctx;
let canvas;
let blocks = [];    // {x, y, w, h, kind, tint, parkTrees, parkPaths} - City blocks (leaf nodes of BSP)
let buildings = []; // {x, y, w, h, depth} - Buildings within blocks
let streetH = [];   // {y, xStart, xEnd} - Horizontal street center lines
let streetV = [];   // {x, yStart, yEnd} - Vertical street center lines

let cityMapEl;
let scrollContainerEl;
let wrapperEl;

let isMapInView = true;
let renderRafId = 0;

// Higher-res bake + devicePixelRatio scaling (with caps to keep memory reasonable).
const DPR_CAP = 2;
const BASE_BAKE_SCALE = 0.86;
const MAX_BAKE_CANVAS_AREA_PX = 14_000_000; // ~56MB @ 4 bytes/px

// "Zoom-out": show more of the world in a single viewport.
// (100vw viewport displays this many "vw" units of the city world.)
const VIEWPORT_WORLD_W = 136;
const PARK_CHANCE = 0.075;
const CROSSWALK_CHANCE = 0.55;

// Camera State
let currentCameraX = 0; // Viewport left edge (in vw)
let targetCameraX = 0;  // Desired viewport left edge (in vw)

const MAP_W = 400; // vw
const MAP_H = 100; // vh
const STREET_GAP = 2; // vw/vh gap between blocks

// Visual Config
const CONFIG = {
    streetColor: "#8c768f",       // Muted Mauve (Matches CSS)
    blockColor: "#4a3f4c",        // Darker Mauve Base
    blockStroke: "rgba(0,0,0,0.16)",
    parkFill: "#32463c",
    parkEdge: "rgba(222,255,79,0.22)",
    parkTree: "rgba(222,255,79,0.22)",
    parkPath: "rgba(255,255,255,0.10)",
    sidewalkFill: "rgba(255,255,255,0.10)",
    sidewalkEdge: "rgba(0,0,0,0.14)",
    sidewalkJoint: "rgba(0,0,0,0.16)",
    crosswalkStripe: "rgba(255,255,255,0.28)",
    crosswalkShadow: "rgba(0,0,0,0.14)",
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

function clampNum(v, min, max) {
    return Math.min(max, Math.max(min, v));
}

function getDpr() {
    const dpr = (typeof window !== "undefined" && window.devicePixelRatio) ? window.devicePixelRatio : 1;
    return clampNum(dpr || 1, 1, DPR_CAP);
}

function computeBakeScale() {
    if (!canvas) return BASE_BAKE_SCALE;
    const baseUx = canvas.width / 100;
    const baseUy = canvas.height / MAP_H;
    if (!Number.isFinite(baseUx) || !Number.isFinite(baseUy) || baseUx <= 0 || baseUy <= 0) return BASE_BAKE_SCALE;

    let scale = BASE_BAKE_SCALE;
    const w = MAP_W * baseUx * scale;
    const h = MAP_H * baseUy * scale;
    const area = w * h;

    if (area > MAX_BAKE_CANVAS_AREA_PX) {
        scale *= Math.sqrt(MAX_BAKE_CANVAS_AREA_PX / area);
    }

    return clampNum(scale, 0.45, 1);
}

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

    ctx = canvas.getContext("2d", { alpha: false });

    new ResizeObserver(() => resize()).observe(container);
    resize();

    attachScrollListener();
    setupVisibilityObserver(scrollContainerEl || container);
    startRendering();
}

let scrollListenerAttached = false;
let visibilityObserver;

function startRendering() {
    requestRender();
}

function stopRendering() {
    if (renderRafId) {
        cancelAnimationFrame(renderRafId);
        renderRafId = 0;
    }
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
    const dpr = getDpr();

    // Canvas is now 1 VIEWPORT wide, not the whole map (but DPR-correct).
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));

    if (ctx) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.imageSmoothingEnabled = true;
    }

    if (blocks.length === 0) {
        generateCity();
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
    const isPark = w > 10 && h > 10 && Math.random() < PARK_CHANCE;

    if (isPark) {
        const padX = Math.max(1.2, w * 0.12);
        const padY = Math.max(1.2, h * 0.12);
        const area = w * h;

        const treeCount = clampNum(Math.round(area / 18), 8, 44);
        const parkTrees = Array.from({ length: treeCount }, () => ({
            x: x + padX + Math.random() * Math.max(0.1, w - padX * 2),
            y: y + padY + Math.random() * Math.max(0.1, h - padY * 2),
            r: 0.12 + Math.random() * 0.16
        }));

        const parkPaths = [];
        const pathCount = clampNum(Math.round(area / 80), 1, 3);
        for (let i = 0; i < pathCount; i++) {
            parkPaths.push({
                a: { x: x + padX, y: y + padY + Math.random() * Math.max(0.1, h - padY * 2) },
                b: { x: x + w - padX, y: y + padY + Math.random() * Math.max(0.1, h - padY * 2) },
            });
        }

        blocks.push({ x, y, w, h, kind: "park", tint: CONFIG.parkFill, parkTrees, parkPaths });
        return;
    }

    blocks.push({ x, y, w, h, kind: "block", tint });

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
let bakedPixelsPerVw = 0;
let bakedViewportPx = 0;

function drawCrosswalks(ctxB, ux, uy) {
    const roadWpxX = STREET_GAP * ux;
    const roadWpxY = STREET_GAP * uy;

    const base = (ux + uy) * 0.5;
    const bandPx = Math.max(10, Math.round(base * 0.95));
    const stripePx = Math.max(2, Math.round(bandPx * 0.18));
    const gapPx = Math.max(2, Math.round(stripePx * 0.9));
    const count = Math.max(3, Math.min(8, Math.floor((bandPx + gapPx) / (stripePx + gapPx))));
    const bandW = count * stripePx + (count - 1) * gapPx;

    const drawAcrossHorizontalRoad = (cx, cy) => {
        const h = Math.max(4, Math.round(roadWpxY * 0.96));
        const y0 = (cy - h / 2) | 0;
        const xStart = (cx - bandW / 2) | 0;

        for (let i = 0; i < count; i++) {
            const x = xStart + i * (stripePx + gapPx);
            ctxB.fillRect(x, y0, stripePx, h);
        }
    };

    const drawAcrossVerticalRoad = (cx, cy) => {
        const w = Math.max(4, Math.round(roadWpxX * 0.96));
        const x0 = (cx - w / 2) | 0;
        const yStart = (cy - bandW / 2) | 0;

        for (let i = 0; i < count; i++) {
            const y = yStart + i * (stripePx + gapPx);
            ctxB.fillRect(x0, y, w, stripePx);
        }
    };

    ctxB.save();

    // Crosswalks at intersections (sampled to avoid visual overload).
    for (let i = 0; i < streetH.length; i++) {
        const h = streetH[i];
        for (let j = 0; j < streetV.length; j++) {
            const v = streetV[j];
            if (v.x < h.xStart || v.x > h.xEnd) continue;
            if (h.y < v.yStart || h.y > v.yEnd) continue;
            if (Math.random() > CROSSWALK_CHANCE) continue;

            const cx = v.x * ux;
            const cy = h.y * uy;
            const inset = Math.max(2, Math.round(stripePx * 0.6));
            const offX = roadWpxX * 0.5 + bandW * 0.5 + inset;
            const offY = roadWpxY * 0.5 + bandW * 0.5 + inset;
            const bandHalfWorldX = (bandW * 0.5) / ux;
            const bandHalfWorldY = (bandW * 0.5) / uy;
            const offXWorld = offX / ux;
            const offYWorld = offY / uy;

            const canHLeft =
                (v.x - offXWorld - bandHalfWorldX) >= h.xStart &&
                (v.x - offXWorld + bandHalfWorldX) <= h.xEnd;
            const canHRight =
                (v.x + offXWorld - bandHalfWorldX) >= h.xStart &&
                (v.x + offXWorld + bandHalfWorldX) <= h.xEnd;
            const canVTop =
                (h.y - offYWorld - bandHalfWorldY) >= v.yStart &&
                (h.y - offYWorld + bandHalfWorldY) <= v.yEnd;
            const canVBottom =
                (h.y + offYWorld - bandHalfWorldY) >= v.yStart &&
                (h.y + offYWorld + bandHalfWorldY) <= v.yEnd;

            ctxB.fillStyle = CONFIG.crosswalkShadow;
            if (canHLeft) drawAcrossHorizontalRoad(cx - offX + 0.75, cy + 0.75);
            if (canHRight) drawAcrossHorizontalRoad(cx + offX + 0.75, cy + 0.75);
            if (canVTop) drawAcrossVerticalRoad(cx + 0.75, cy - offY + 0.75);
            if (canVBottom) drawAcrossVerticalRoad(cx + 0.75, cy + offY + 0.75);

            ctxB.fillStyle = CONFIG.crosswalkStripe;
            if (canHLeft) drawAcrossHorizontalRoad(cx - offX, cy);
            if (canHRight) drawAcrossHorizontalRoad(cx + offX, cy);
            if (canVTop) drawAcrossVerticalRoad(cx, cy - offY);
            if (canVBottom) drawAcrossVerticalRoad(cx, cy + offY);
        }
    }

    ctxB.restore();
}

function drawSidewalk(ctxB, x, y, w, h, ux, uy, radiusPx, widthPx) {
    const x0 = x * ux;
    const y0 = y * uy;
    const w0 = w * ux;
    const h0 = h * uy;

    ctxB.save();

    // Wide stroke: inner half is covered by the block fill, leaving a curb/sidewalk outside.
    ctxB.strokeStyle = CONFIG.sidewalkFill;
    ctxB.lineWidth = widthPx * 2;
    ctxB.beginPath();
    ctxB.roundRect(x0, y0, w0, h0, radiusPx);
    ctxB.stroke();

    // Curb edge
    ctxB.strokeStyle = CONFIG.sidewalkEdge;
    ctxB.lineWidth = Math.max(1, Math.round(widthPx * 0.9));
    ctxB.beginPath();
    ctxB.roundRect(x0, y0, w0, h0, radiusPx);
    ctxB.stroke();

    // Sidewalk slab joints (sectioned edges).
    const jointSpacing = Math.max(16, Math.round(((ux + uy) * 0.5) * 0.95));
    const jointPad = Math.max(2, Math.round(widthPx * 0.7));
    const xMin = x0 + radiusPx + jointPad;
    const xMax = x0 + w0 - radiusPx - jointPad;
    const yMin = y0 + radiusPx + jointPad;
    const yMax = y0 + h0 - radiusPx - jointPad;

    ctxB.strokeStyle = CONFIG.sidewalkJoint;
    ctxB.lineWidth = 1;
    ctxB.lineCap = "round";

    const offsetX = Math.random() * jointSpacing * 0.5;
    const offsetY = Math.random() * jointSpacing * 0.5;

    // Top edge joints
    for (let xj = xMin + offsetX; xj < xMax; xj += jointSpacing) {
        const xk = xj | 0;
        ctxB.beginPath();
        ctxB.moveTo(xk, (y0 - widthPx) | 0);
        ctxB.lineTo(xk, (y0 + 1) | 0);
        ctxB.stroke();
    }

    // Bottom edge joints
    for (let xj = xMin + offsetX; xj < xMax; xj += jointSpacing) {
        const xk = xj | 0;
        ctxB.beginPath();
        ctxB.moveTo(xk, (y0 + h0 - 1) | 0);
        ctxB.lineTo(xk, (y0 + h0 + widthPx) | 0);
        ctxB.stroke();
    }

    // Left edge joints
    for (let yj = yMin + offsetY; yj < yMax; yj += jointSpacing) {
        const yk = yj | 0;
        ctxB.beginPath();
        ctxB.moveTo((x0 - widthPx) | 0, yk);
        ctxB.lineTo((x0 + 1) | 0, yk);
        ctxB.stroke();
    }

    // Right edge joints
    for (let yj = yMin + offsetY; yj < yMax; yj += jointSpacing) {
        const yk = yj | 0;
        ctxB.beginPath();
        ctxB.moveTo((x0 + w0 - 1) | 0, yk);
        ctxB.lineTo((x0 + w0 + widthPx) | 0, yk);
        ctxB.stroke();
    }

    ctxB.restore();
}

function drawParkDetails(ctxB, b, ux, uy, radiusPx) {
    const x = b.x * ux;
    const y = b.y * uy;
    const w = b.w * ux;
    const h = b.h * uy;

    ctxB.save();

    // Clip to the park pad (so details don't leak onto streets).
    ctxB.beginPath();
    ctxB.roundRect(x, y, w, h, radiusPx);
    ctxB.clip();

    // Paths
    if (b.parkPaths && b.parkPaths.length > 0) {
        ctxB.strokeStyle = CONFIG.parkPath;
        ctxB.lineWidth = Math.max(1, Math.round(((ux + uy) * 0.5) * 0.03));
        ctxB.setLineDash([Math.max(8, Math.round(ux * 0.7)), Math.max(8, Math.round(ux * 0.55))]);
        ctxB.lineCap = "round";
        b.parkPaths.forEach((p) => {
            ctxB.beginPath();
            ctxB.moveTo(p.a.x * ux, p.a.y * uy);
            ctxB.lineTo(p.b.x * ux, p.b.y * uy);
            ctxB.stroke();
        });
        ctxB.setLineDash([]);
    }

    // Trees
    if (b.parkTrees && b.parkTrees.length > 0) {
        const rBase = (ux + uy) * 0.5;
        ctxB.fillStyle = CONFIG.parkTree;
        b.parkTrees.forEach((t) => {
            const px = t.x * ux;
            const py = t.y * uy;
            const r = Math.max(1, Math.round(t.r * rBase));
            ctxB.beginPath();
            ctxB.arc(px, py, r, 0, Math.PI * 2);
            ctxB.fill();
        });
    }

    // Soft edge highlight (inside the clip).
    ctxB.beginPath();
    ctxB.roundRect(x, y, w, h, radiusPx);
    ctxB.strokeStyle = CONFIG.parkEdge;
    ctxB.lineWidth = Math.max(1, Math.round(((ux + uy) * 0.5) * 0.035));
    ctxB.stroke();

    ctxB.restore();
}

function bakeCity() {
    if (!offscreenCanvas) {
        offscreenCanvas = document.createElement("canvas");
        offscreenCtx = offscreenCanvas.getContext("2d", { alpha: false });
    }

    const t0 = (DEBUG_CITY && typeof performance !== "undefined" && performance.now) ? performance.now() : 0;

    // Bake at map resolution (pixels per vw/vh)
    const bakeScale = computeBakeScale();
    const ux = (canvas.width / 100) * bakeScale;
    const uy = (canvas.height / MAP_H) * bakeScale;

    offscreenCanvas.width = Math.ceil(MAP_W * ux);
    offscreenCanvas.height = Math.ceil(MAP_H * uy);
    bakedPixelsPerVw = offscreenCanvas.width / MAP_W;
    bakedViewportPx = Math.round(VIEWPORT_WORLD_W * bakedPixelsPerVw);

    const ctxB = offscreenCtx;
    ctxB.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
    ctxB.imageSmoothingEnabled = true;

    // 1. Draw Streets
    const streetGrad = ctxB.createLinearGradient(0, 0, 0, offscreenCanvas.height);
    streetGrad.addColorStop(0, CONFIG.streetColor);
    streetGrad.addColorStop(1, "#735d76"); // Darker mauve depth
    ctxB.fillStyle = streetGrad;
    ctxB.fillRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);

    // Street markings (crosswalks)
    drawCrosswalks(ctxB, ux, uy);

    // 2. Draw Block Pads
    const radius = CONFIG.blockRadius * ux;
    const sidewalkW = Math.max(1, Math.round(((ux + uy) * 0.5) * 0.12));
    blocks.forEach(b => {
        drawSidewalk(ctxB, b.x, b.y, b.w, b.h, ux, uy, radius, sidewalkW);

        ctxB.fillStyle = b.tint || CONFIG.blockColor;
        ctxB.beginPath();
        ctxB.roundRect(b.x * ux, b.y * uy, b.w * ux, b.h * uy, radius);
        ctxB.fill();

        // Block edge for crispness.
        ctxB.strokeStyle = CONFIG.blockStroke;
        ctxB.lineWidth = Math.max(1, Math.round(radius * 0.18));
        ctxB.stroke();

        if (b.kind === "park") {
            drawParkDetails(ctxB, b, ux, uy, radius);
        }
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
        if (b.windows && b.windows.length > 0 && b.w > 3.2 && b.h > 3.2) {
            // NOTE: windows belong on the *walls*, not the roof.
            // We map precomputed (w.x,w.y) from footprint-space to wall-space.
            const wallH = roofOffset;
            if (wallH > 6) {
                const wallX = bx;
                const wallY = ry + bh; // top edge of the front wall
                const wallW = bw;

                const winW = Math.max(1, Math.round(wallW * 0.085));
                const winH = Math.max(1, Math.round(wallH * 0.2));

                const clamp01 = (n) => Math.max(0, Math.min(1, n));

                // Batch draws to reduce state churn.
                ctxB.fillStyle = "rgba(0,0,0,0.12)";
                b.windows.forEach(w => {
                    if (w.lit) return;
                    const u = clamp01(w.x / (b.w || 1));
                    const v = clamp01(w.y / (b.h || 1));
                    const wx = (wallX + u * (wallW - winW)) | 0;
                    const wy = (wallY + v * (wallH - winH)) | 0;
                    ctxB.fillRect(wx, wy, winW, winH);
                });

                ctxB.fillStyle = b.tint.window || "#ffd700";
                b.windows.forEach(w => {
                    if (!w.lit) return;
                    const u = clamp01(w.x / (b.w || 1));
                    const v = clamp01(w.y / (b.h || 1));
                    const wx = (wallX + u * (wallW - winW)) | 0;
                    const wy = (wallY + v * (wallH - winH)) | 0;
                    ctxB.fillRect(wx, wy, winW, winH);
                });
            }
        }
    });

    if (DEBUG_CITY) {
        const dt = t0 ? Math.round(performance.now() - t0) : 0;
        console.log(`[PERF] City bake: ${offscreenCanvas.width}x${offscreenCanvas.height} in ${dt}ms (scale=${bakeScale.toFixed(2)} dpr=${getDpr()} viewportWorldW=${VIEWPORT_WORLD_W})`);
    }
}

/* --- HORIZONTAL SCROLL / CAMERA --- */

// Kept as `animateSignalPath` for compatibility with `js/app.js`.
function animateSignalPath() {
    const wrapper = wrapperEl || document.querySelector(".horizontal-wrapper");
    const container = scrollContainerEl || document.querySelector(".scroll-container");
    const mapEl = cityMapEl || document.getElementById("cityMap");

    if (!wrapper || !container) return;

    const panels = Array.from(wrapper.querySelectorAll(".panel"));
    const slideCount = Math.max(1, panels.length);

    const prefersReducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const viewportWidthVW = VIEWPORT_WORLD_W;

    const navRoot = container.querySelector(".hscroll-ui");
    const navProgress = navRoot ? navRoot.querySelector(".hscroll-progress") : null;
    const prevBtn = navRoot ? navRoot.querySelector(".hscroll-prev") : null;
    const nextBtn = navRoot ? navRoot.querySelector(".hscroll-next") : null;

    const ST_ID = "city-horizontal-sections";
    const existing = ScrollTrigger.getById(ST_ID);
    if (existing) existing.kill(true);

    wrapper.style.transformOrigin = "center center";

    let activeIndex = 0;
    let isAnimatingSlide = false;
    let sectionScrollPx = 0;
    let st;

    const computeSectionScroll = () => {
        const vh = window.innerHeight || 800;
        return Math.max(560, Math.min(1200, Math.round(vh * 0.9)));
    };

    const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

    const wrapperXForIndex = (index) => -(container.clientWidth * index);

    const setWrapperIndex = (index) => {
        gsap.set(wrapper, {
            x: wrapperXForIndex(index),
            force3D: true
        });
    };

    const tweenWrapperIndex = (index) => {
        return gsap.to(wrapper, {
            x: wrapperXForIndex(index),
            duration: prefersReducedMotion ? 0 : 1.3,
            ease: prefersReducedMotion ? "none" : "power3.inOut",
            force3D: true,
            overwrite: true
        });
    };

    const buildNav = () => {
        if (!navProgress) return;
        navProgress.textContent = "";

        panels.forEach((panel, i) => {
            const label =
                (panel && panel.getAttribute("data-nav")) ||
                (panel && panel.querySelector("h1,h2") && panel.querySelector("h1,h2").textContent.trim()) ||
                `Section ${i + 1}`;

            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "hscroll-segment";
            btn.dataset.index = String(i);
            btn.dataset.label = label;
            btn.setAttribute("role", "tab");
            btn.setAttribute("aria-label", label);
            btn.setAttribute("aria-selected", i === 0 ? "true" : "false");
            btn.setAttribute("title", label);
            btn.style.setProperty("--fill", i === 0 ? "0" : "0");

            const fill = document.createElement("span");
            fill.className = "hscroll-fill";
            fill.setAttribute("aria-hidden", "true");
            btn.appendChild(fill);

            navProgress.appendChild(btn);
        });
    };

    const updateNav = (localProgress) => {
        if (!navRoot) return;

        const segs = navProgress ? Array.from(navProgress.querySelectorAll(".hscroll-segment")) : [];
        segs.forEach((seg) => {
            const idx = Number(seg.dataset.index);
            const fill = idx < activeIndex ? 1 : idx === activeIndex ? localProgress : 0;
            seg.style.setProperty("--fill", String(fill));
            seg.classList.toggle("is-active", idx === activeIndex);
            seg.setAttribute("aria-selected", idx === activeIndex ? "true" : "false");
        });

        if (prevBtn) prevBtn.disabled = activeIndex === 0;
        if (nextBtn) nextBtn.disabled = activeIndex === slideCount - 1;
    };

    const scrollToIndexStart = (index, { immediate = true } = {}) => {
        if (!st) return;
        const targetY = st.start + index * sectionScrollPx;

        if (window.lenis && typeof window.lenis.scrollTo === "function") {
            window.lenis.scrollTo(targetY, { immediate });
            return;
        }
        window.scrollTo(0, targetY);
    };

    const goToIndex = (index, { reason = "nav" } = {}) => {
        const nextIndex = clamp(index, 0, slideCount - 1);
        if (nextIndex === activeIndex) return;
        if (!st) return;

        isAnimatingSlide = true;

        activeIndex = nextIndex;
        updateNav(0);

        // Hard align the scroll position to the section start so wheel/trackpad over-scroll
        // doesn't carry over into the next section (matches arrow behavior).
        scrollToIndexStart(activeIndex, { immediate: true });

        // Freeze Lenis momentum during the transition if available.
        if (window.lenis && typeof window.lenis.stop === "function") {
            window.lenis.stop();
        }

        tweenWrapperIndex(activeIndex).eventCallback("onComplete", () => {
            isAnimatingSlide = false;
            if (window.lenis && typeof window.lenis.start === "function") {
                window.lenis.start();
            }
        });
    };

    // Build / wire navigation UI (no-op if markup isn't present)
    buildNav();
    updateNav(0);

    if (prevBtn) prevBtn.onclick = () => goToIndex(activeIndex - 1, { reason: "nav" });
    if (nextBtn) nextBtn.onclick = () => goToIndex(activeIndex + 1, { reason: "nav" });
    if (navProgress) {
        navProgress.onclick = (e) => {
            const btn = e.target && e.target.closest ? e.target.closest(".hscroll-segment") : null;
            if (!btn) return;
            const idx = Number(btn.dataset.index);
            if (Number.isFinite(idx)) goToIndex(idx, { reason: "nav" });
        };
    }

    sectionScrollPx = computeSectionScroll();
    setWrapperIndex(activeIndex);

    // 1) Pin the container for N "sections" of scroll, 2) Use the scroll only to fill
    // the progress segment, 3) Snap sections via our own smooth wrapper tween.
    st = ScrollTrigger.create({
        id: ST_ID,
        trigger: container,
        pin: true,
        anticipatePin: 1,
        start: "top top",
        end: () => "+=" + (computeSectionScroll() * slideCount),
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
        onRefresh: (self) => {
            sectionScrollPx = computeSectionScroll();

            const rel = self.scroll() - self.start;
            const idx = clamp(Math.floor(rel / sectionScrollPx), 0, slideCount - 1);
            activeIndex = idx;
            setWrapperIndex(activeIndex);

            const localProgress = clamp((rel - activeIndex * sectionScrollPx) / sectionScrollPx, 0, 1);
            updateNav(localProgress);
        },
        onUpdate: (self) => {
            const rel = self.scroll() - self.start;
            const startForActive = activeIndex * sectionScrollPx;
            const localProgress = clamp((rel - startForActive) / sectionScrollPx, 0, 1);

            updateNav(localProgress);

            // Camera mapping: smooth continuous travel across the city while sections fill.
            const overallProgress = clamp((activeIndex + localProgress) / slideCount, 0, 1);
            const cameraX = overallProgress * (MAP_W - viewportWidthVW);
            targetCameraX = clamp(cameraX, 0, MAP_W - viewportWidthVW);

            // Map fade-out approaching the vertical hub.
            if (overallProgress > 0.95) {
                const fade = 1 - (overallProgress - 0.95) * 20; // 1 -> 0
                if (mapEl) mapEl.style.opacity = Math.max(0, fade);
            } else {
                if (mapEl) mapEl.style.opacity = "1";
            }

            if (isMapInView) requestRender();

            if (isAnimatingSlide) return;

            // Section boundaries: when a segment fills/empties, run the same slide tween
            // you'd get from clicking the arrow buttons.
            if (rel >= (activeIndex + 1) * sectionScrollPx && activeIndex < slideCount - 1) {
                goToIndex(activeIndex + 1, { reason: "scroll" });
                return;
            }
            if (rel < activeIndex * sectionScrollPx && activeIndex > 0) {
                goToIndex(activeIndex - 1, { reason: "scroll" });
            }
        }
    });

    console.log("Sectioned horizontal scroll initialized");
}



window.animateSignalPath = animateSignalPath;

/* --- RENDERING --- */

function requestRender() {
    if (!ctx || !canvas) return;
    if (!isMapInView) return;
    if (renderRafId) return;
    renderRafId = requestAnimationFrame(() => {
        renderRafId = 0;
        render();
    });
}

function render() {
    if (!ctx || !canvas) return;
    if (!isMapInView) {
        stopRendering();
        return;
    }

    currentCameraX = targetCameraX;

    const W = canvas.width;
    const H = canvas.height;

    // 1. Draw Baked City (single call)
    if (offscreenCanvas) {
        const sw = bakedViewportPx;
        const maxSx = Math.max(0, offscreenCanvas.width - sw);
        const sx = clampNum(Math.round(currentCameraX * bakedPixelsPerVw), 0, maxSx);
        ctx.drawImage(offscreenCanvas, sx, 0, sw, offscreenCanvas.height, 0, 0, W, H);
    } else {
        // Fallback if not baked
        const streetGrad = ctx.createLinearGradient(0, 0, W, H);
        streetGrad.addColorStop(0, CONFIG.streetColor);
        streetGrad.addColorStop(1, "#cbb6c7");
        ctx.fillStyle = streetGrad;
        ctx.fillRect(0, 0, W, H);
    }
}

window.initCityCanvas = initCityCanvas;
