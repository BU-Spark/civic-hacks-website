/* CivicHacks City Worker — tile baker (OffscreenCanvas + ImageBitmap) */
"use strict";

let CONFIG = null;

let genId = 0;
let citySeed = "";
let MAP_W = 400;
let MAP_H = 100;
let TILE_WORLD_W = 50;
let TILE_BUILD_MARGIN = 14;

let cityCenter = { x: 0, y: 0 };
let cityFeatures = null;
let districtPads = [];
let roads = [];
let downtownBuildings = [];

let tileCount = 0;
let tileBins = null; // { pads: Array<Array<Pad>>, roads: Array<Array<RoadSeg>> }
let buildingCache = new Map(); // `${tileIndex}|${quality}` -> Array<Building>

/* --- RNG --- */

function fnv1a32(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}

function mulberry32(seed) {
    let t = seed >>> 0;
    return function () {
        t += 0x6D2B79F5;
        let x = t;
        x = Math.imul(x ^ (x >>> 15), x | 1);
        x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
        return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
}

function createRng(seed) {
    const seedU32 = (typeof seed === "number" && Number.isFinite(seed)) ? (seed >>> 0) : fnv1a32(String(seed ?? ""));
    const rand = mulberry32(seedU32);
    return {
        seed: seedU32,
        float: () => rand(),
        range: (min, max) => min + rand() * (max - min),
        int: (min, max) => Math.floor(min + rand() * (max - min + 1)),
        chance: (p = 0.5) => rand() < p,
        pick: (arr) => arr[(rand() * arr.length) | 0],
        sign: () => (rand() < 0.5 ? -1 : 1),
    };
}

/* --- Geometry + helpers --- */

function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function lerpPt(a, b, t) {
    return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
}

function sub(a, b) {
    return { x: a.x - b.x, y: a.y - b.y };
}

function add(a, b) {
    return { x: a.x + b.x, y: a.y + b.y };
}

function scale(v, s) {
    return { x: v.x * s, y: v.y * s };
}

function dot(a, b) {
    return a.x * b.x + a.y * b.y;
}

function len(v) {
    return Math.hypot(v.x, v.y);
}

function norm(v) {
    const l = len(v) || 1;
    return { x: v.x / l, y: v.y / l };
}

function perp(v) {
    return { x: -v.y, y: v.x };
}

function boundsFromPoints(points) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < points.length; i++) {
        const p = points[i];
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
    }
    return { minX, minY, maxX, maxY };
}

function boundsOverlap(a, b, pad = 0) {
    return !(a.maxX + pad < b.minX || a.minX - pad > b.maxX || a.maxY + pad < b.minY || a.minY - pad > b.maxY);
}

function pointInPoly(point, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i].x, yi = poly[i].y;
        const xj = poly[j].x, yj = poly[j].y;
        const intersect = ((yi > point.y) !== (yj > point.y)) &&
            (point.x < (xj - xi) * (point.y - yi) / ((yj - yi) || 1e-9) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

function distPointToSegment(p, a, b) {
    const ab = sub(b, a);
    const ap = sub(p, a);
    const ab2 = dot(ab, ab) || 1;
    const t = clamp(dot(ap, ab) / ab2, 0, 1);
    const q = { x: a.x + ab.x * t, y: a.y + ab.y * t };
    return Math.hypot(p.x - q.x, p.y - q.y);
}

function distPointToPolyline(p, pts) {
    let best = Infinity;
    for (let i = 0; i < pts.length - 1; i++) {
        best = Math.min(best, distPointToSegment(p, pts[i], pts[i + 1]));
    }
    return best;
}

function isInRiver(features, p) {
    if (!features || !features.river) return false;
    const d = distPointToPolyline(p, features.river.centerline);
    return d <= features.river.width * 0.5;
}

function isInParks(features, p) {
    if (!features || !features.parks || features.parks.length === 0) return false;
    return features.parks.some(park => pointInPoly(p, park.poly));
}

function isInCorridors(features, p) {
    if (!features || !features.corridors || features.corridors.length === 0) return false;
    return features.corridors.some(c => pointInPoly(p, c.poly));
}

function isNoBuild(features, p) {
    return isInParks(features, p) || isInCorridors(features, p) || isInRiver(features, p);
}

function orientedRect(cx, cy, w, h, angle) {
    const hx = w / 2;
    const hy = h / 2;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    return [
        { x: cx + (-hx) * c - (-hy) * s, y: cy + (-hx) * s + (-hy) * c },
        { x: cx + (hx) * c - (-hy) * s, y: cy + (hx) * s + (-hy) * c },
        { x: cx + (hx) * c - (hy) * s, y: cy + (hx) * s + (hy) * c },
        { x: cx + (-hx) * c - (hy) * s, y: cy + (-hx) * s + (hy) * c },
    ];
}

/* --- Tile bins --- */

function buildTileBins() {
    tileCount = Math.ceil(MAP_W / TILE_WORLD_W);
    const padBins = Array.from({ length: tileCount }, () => []);
    const roadBins = Array.from({ length: tileCount }, () => []);

    const clampTile = (t) => Math.max(0, Math.min(tileCount - 1, t));
    const tileForX = (x) => clampTile(Math.floor(x / TILE_WORLD_W));

    for (let i = 0; i < districtPads.length; i++) {
        const pad = districtPads[i];
        const start = tileForX(pad.bounds.minX);
        const end = tileForX(pad.bounds.maxX);
        for (let t = start; t <= end; t++) padBins[t].push(pad);
    }

    for (let i = 0; i < roads.length; i++) {
        const r = roads[i];
        const minX = Math.min(r.a.x, r.b.x) - (r.width || 0);
        const maxX = Math.max(r.a.x, r.b.x) + (r.width || 0);
        const start = tileForX(minX);
        const end = tileForX(maxX);
        for (let t = start; t <= end; t++) roadBins[t].push(r);
    }

    tileBins = { pads: padBins, roads: roadBins };
    buildingCache = new Map();
}

/* --- Buildings (tile-local) --- */

function makeRoofDetails(detailRng, w, h, quality) {
    if (quality <= 0) return { clutter: [], windows: [] };

    const clutter = [];
    if (w > 3 && h > 3 && detailRng.chance(0.5)) {
        const count = detailRng.int(1, w * h > 55 ? 3 : 2);
        for (let i = 0; i < count; i++) {
            const cw = detailRng.range(0.45, 1.55);
            const ch = detailRng.range(0.45, 1.55);
            const padX = Math.max(0.35, w * 0.12);
            const padY = Math.max(0.35, h * 0.12);
            const x = detailRng.range(-w / 2 + padX, w / 2 - padX - cw);
            const y = detailRng.range(-h / 2 + padY, h / 2 - padY - ch);
            clutter.push({ x, y, w: cw, h: ch });
        }
    }

    const windows = [];
    if (detailRng.chance(0.62) && w > 5) {
        const stepX = detailRng.range(1.8, 2.5);
        const stepY = detailRng.range(1.8, 2.5);
        for (let x = -w / 2 + 0.6; x < w / 2 - 0.8; x += stepX) {
            for (let y = -h / 2 + 0.6; y < h / 2 - 0.8; y += stepY) {
                windows.push({ x, y, lit: detailRng.chance(0.58) });
            }
        }
    }

    return { clutter, windows };
}

function roadSegKey(seg) {
    const ax = seg.a.x.toFixed(2);
    const ay = seg.a.y.toFixed(2);
    const bx = seg.b.x.toFixed(2);
    const by = seg.b.y.toFixed(2);
    return `${seg.kind}|${ax},${ay}|${bx},${by}`;
}

function pickBuildingTint(tintRng, kind, distToCenter = Infinity) {
    const neutrals = CONFIG.buildingTintsNeutral || CONFIG.buildingTints || [];
    const accents = CONFIG.buildingTintsAccent || [];
    const baseAccent =
        kind === "arterial" ? 0.10 :
            kind === "secondary" ? 0.07 :
                kind === "local" ? 0.04 :
                    0.03;
    const accentChance = distToCenter < 40 ? baseAccent * 0.6 : baseAccent;
    const useAccent = accents.length > 0 && tintRng.chance(accentChance);
    const pool = useAccent ? accents : neutrals;
    return tintRng.pick(pool.length > 0 ? pool : (CONFIG.buildingTints || neutrals));
}

function generateBuildingsForRoadSegment(seg, quality, features) {
    const out = [];
    const q = quality >= 1 ? 1 : 0;

    const a = seg.a;
    const b = seg.b;
    const d = sub(b, a);
    const l = len(d);
    if (l < 4.5) return out;

    const segSeed = `${citySeed}|bld|${roadSegKey(seg)}`;
    const segRng = createRng(segSeed);

    const dir = norm(d);
    const n = perp(dir);
    const angle = Math.atan2(dir.y, dir.x);

    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const distToCenter = Math.hypot(mid.x - cityCenter.x, mid.y - cityCenter.y);
    const downtownBoost = clamp(1.28 - distToCenter / 70, 0.62, 1.28);
    const densityK = clamp(1.05 - distToCenter / 150, 0.35, 1.05);

    const kind = seg.kind;

    // Clean-map bias: fewer, smaller footprints with more air.
    let endClear = 4.2;
    let unitWRange = [1.8, 2.9];
    let depthRange = [2.4, 4.0];
    let gapRange = [0.9, 1.6];
    let setbackRange = [0.7, 1.4];
    let sideChance = 0.52;
    let skipChance = 0.25;

    if (kind === "arterial") {
        endClear = 8.5;
        unitWRange = [3.8, 7.5];
        depthRange = [3.0, 5.8];
        gapRange = [1.3, 2.2];
        setbackRange = [1.5, 2.6];
        sideChance = 0.78;
        skipChance = 0.22;
    } else if (kind === "secondary") {
        endClear = 6.2;
        unitWRange = [2.6, 5.0];
        depthRange = [2.8, 5.0];
        gapRange = [1.1, 2.0];
        setbackRange = [1.1, 2.0];
        sideChance = 0.68;
        skipChance = 0.24;
    } else if (kind === "alley") {
        endClear = 3.0;
        unitWRange = [1.4, 2.4];
        depthRange = [2.0, 3.4];
        gapRange = [0.8, 1.4];
        setbackRange = [0.55, 1.0];
        sideChance = 0.45;
        skipChance = 0.28;
    }

    const sides = [];
    const sChance = sideChance * densityK * (q ? 1 : 0.82);
    if (segRng.chance(sChance)) sides.push(1);
    if (segRng.chance(sChance * 0.72)) sides.push(-1);
    if (sides.length === 0) return out;

    const scaleF = q ? 1 : 1.35;
    const unitW = segRng.range(unitWRange[0], unitWRange[1]) * scaleF;
    const baseGap = segRng.range(gapRange[0], gapRange[1]) * (q ? 1 : 1.65) * (1.05 + (1 - densityK) * 0.55);
    const usable = Math.max(0, l - endClear * 2);
    const step = unitW + baseGap;
    const maxCount = q ? 16 : 10;
    const count = Math.min(maxCount, Math.floor(usable / Math.max(1.25, step)));
    if (count <= 0) return out;

    for (const side of sides) {
        let i = 0;
        while (i < count) {
            const bRng = createRng(`${segSeed}|${side}|${i}`);

            if (!q && bRng.chance(0.35)) { i += 1; continue; }
            const densitySkip = clamp(skipChance + (1 - densityK) * 0.28, 0.02, 0.85);
            if (bRng.chance(densitySkip * (q ? 1 : 1.1))) { i += 1; continue; }

            let span = 1;
            if (q && kind === "local" && bRng.chance(0.18)) span = bRng.int(2, 3);
            if (q && kind === "secondary" && bRng.chance(0.12)) span = 2;
            if (span > count - i) span = 1;

            const t = clamp((endClear + (i + span * 0.5 + bRng.range(-0.12, 0.12)) * (usable / count)) / l, 0.03, 0.97);
            const p = lerpPt(a, b, t);

            const w = Math.max(1.35, unitW * span * (0.78 + bRng.float() * 0.5));
            const h = bRng.range(depthRange[0], depthRange[1]) * (q ? (0.9 + bRng.float() * 0.3) : (1.05 + bRng.float() * 0.25));
            const setback = bRng.range(setbackRange[0], setbackRange[1]) * (q ? 1 : 1.15);

            const normalJitter = (bRng.float() - 0.5) * (q ? 0.55 : 0.35);
            const center = add(p, scale(n, side * (seg.width / 2 + h / 2 + setback + normalJitter)));

            if (isNoBuild(features, center)) { i += span; continue; }

            const poly = orientedRect(center.x, center.y, w, h, angle);
            if (poly.some(v => isNoBuild(features, v))) { i += span; continue; }

            const bounds = boundsFromPoints(poly);
            const tint = pickBuildingTint(bRng, kind, distToCenter);

            const u = bRng.float();
            let depth =
                kind === "arterial"
                    ? (u < 0.45 ? bRng.range(1.0, 1.7) : u < 0.9 ? bRng.range(1.5, 2.35) : bRng.range(2.0, CONFIG.maxBuildingDepth))
                    : kind === "secondary"
                        ? (u < 0.72 ? bRng.range(0.45, 1.2) : u < 0.95 ? bRng.range(1.0, 1.85) : bRng.range(1.5, 2.4))
                        : (u < 0.85 ? bRng.range(0.25, 0.9) : u < 0.98 ? bRng.range(0.7, 1.45) : bRng.range(1.1, 2.0));
            depth *= downtownBoost * (q ? 1 : 0.55);
            depth = clamp(depth, 0.18, CONFIG.maxBuildingDepth);

            let tiers = 0;
            if (q && depth > 1.35 && kind !== "alley" && bRng.chance(0.45)) {
                tiers = bRng.chance(0.6) ? 1 : 2;
            }

            const details = makeRoofDetails(bRng, w, h, q ? 1 : 0);

            out.push({
                cx: center.x,
                cy: center.y,
                w,
                h,
                angle,
                depth,
                tint,
                tiers,
                kind: kind === "local" ? "rowhouse" : (kind === "arterial" ? "mixed" : "mid"),
                poly,
                bounds,
                clutter: details.clutter,
                windows: details.windows
            });

            i += span;
        }
    }

    return out;
}

function getTileBuildings(tileIndex, quality) {
    const q = quality >= 1 ? 1 : 0;
    const key = `${tileIndex}|${q}`;
    const cached = buildingCache.get(key);
    if (cached) return cached;
    if (!tileBins) buildTileBins();

    const tileStartX = tileIndex * TILE_WORLD_W;
    const tileBounds = { minX: tileStartX, maxX: tileStartX + TILE_WORLD_W, minY: 0, maxY: MAP_H };
    const scanBounds = { minX: tileBounds.minX - TILE_BUILD_MARGIN, maxX: tileBounds.maxX + TILE_BUILD_MARGIN, minY: -TILE_BUILD_MARGIN, maxY: MAP_H + TILE_BUILD_MARGIN };

    const segs = [];
    for (let t = Math.max(0, tileIndex - 1); t <= Math.min(tileCount - 1, tileIndex + 1); t++) {
        const bin = tileBins.roads[t] || [];
        for (let i = 0; i < bin.length; i++) {
            const r = bin[i];
            if (!q && (r.kind === "local" || r.kind === "alley")) continue;
            const minX = Math.min(r.a.x, r.b.x) - (r.width || 0);
            const maxX = Math.max(r.a.x, r.b.x) + (r.width || 0);
            const minY = Math.min(r.a.y, r.b.y) - (r.width || 0);
            const maxY = Math.max(r.a.y, r.b.y) + (r.width || 0);
            if (!boundsOverlap({ minX, maxX, minY, maxY }, scanBounds, 0)) continue;
            segs.push(r);
        }
    }

    const seen = new Set();
    const buildings = [];

    for (let i = 0; i < segs.length; i++) {
        const seg = segs[i];
        const k = roadSegKey(seg);
        if (seen.has(k)) continue;
        seen.add(k);

        const segBuildings = generateBuildingsForRoadSegment(seg, q, cityFeatures);
        for (let j = 0; j < segBuildings.length; j++) {
            const b = segBuildings[j];
            if (!boundsOverlap(b.bounds, tileBounds, 0.1)) continue;
            buildings.push(b);
        }
    }

    for (let i = 0; i < downtownBuildings.length; i++) {
        const b = downtownBuildings[i];
        if (!boundsOverlap(b.bounds, tileBounds, 0.1)) continue;
        if (!q) {
            buildings.push({
                ...b,
                tiers: 0,
                clutter: [],
                windows: []
            });
        } else {
            buildings.push(b);
        }
    }

    // De-conflict: keep the map legible by avoiding heavy overlaps.
    const cap = q ? 160 : 90;
    const cellSize = 10;
    const grid = new Map(); // cellKey -> Array<Building>
    const placed = [];
    const bPrio = (b) => {
        if (b.kind === "downtown") return 4;
        if (b.kind === "mixed") return 3;
        if (b.kind === "mid") return 2;
        if (b.kind === "rowhouse") return 1;
        return 0;
    };

    const candidates = buildings.slice().sort((a, b) => {
        const pa = bPrio(a);
        const pb = bPrio(b);
        if (pa !== pb) return pb - pa;
        const aa = (a.w || 0) * (a.h || 0);
        const ab = (b.w || 0) * (b.h || 0);
        if (aa !== ab) return ab - aa;
        if (a.bounds.minX !== b.bounds.minX) return a.bounds.minX - b.bounds.minX;
        if (a.bounds.minY !== b.bounds.minY) return a.bounds.minY - b.bounds.minY;
        return (a.angle || 0) - (b.angle || 0);
    });

    const cellKey = (cx, cy) => `${cx},${cy}`;
    const cellsFor = (bounds) => {
        const x0 = Math.floor(bounds.minX / cellSize);
        const x1 = Math.floor(bounds.maxX / cellSize);
        const y0 = Math.floor(bounds.minY / cellSize);
        const y1 = Math.floor(bounds.maxY / cellSize);
        return { x0, x1, y0, y1 };
    };

    for (let i = 0; i < candidates.length; i++) {
        if (placed.length >= cap) break;
        const b = candidates[i];
        const { x0, x1, y0, y1 } = cellsFor(b.bounds);
        let hit = false;
        for (let cx = x0; cx <= x1 && !hit; cx++) {
            for (let cy = y0; cy <= y1 && !hit; cy++) {
                const bucket = grid.get(cellKey(cx, cy));
                if (!bucket) continue;
                for (let k = 0; k < bucket.length; k++) {
                    if (boundsOverlap(b.bounds, bucket[k].bounds, 0.35)) { hit = true; break; }
                }
            }
        }
        if (hit) continue;

        placed.push(b);
        for (let cx = x0; cx <= x1; cx++) {
            for (let cy = y0; cy <= y1; cy++) {
                const k = cellKey(cx, cy);
                if (!grid.has(k)) grid.set(k, []);
                grid.get(k).push(b);
            }
        }
    }

    placed.sort((a, b) => a.bounds.maxY - b.bounds.maxY);
    buildingCache.set(key, placed);
    return placed;
}

/* --- Tile bake --- */

async function bakeTile({ tileIndex, quality, ux, uy, width, height }) {
    const canvas = new OffscreenCanvas(width, height);
    const ctxB = canvas.getContext("2d", { alpha: false });
    if (!ctxB) return null;

    ctxB.imageSmoothingEnabled = true;
    ctxB.imageSmoothingQuality = "high";

    const q = quality >= 1 ? 1 : 0;
    const tileStartX = tileIndex * TILE_WORLD_W;
    const unit = (ux + uy) / 2;

    // 1. Land background (clean-map: flat base)
    ctxB.fillStyle = "#7f6c84";
    ctxB.fillRect(0, 0, width, height);

    ctxB.save();
    ctxB.translate(-(tileStartX * ux), 0);

    const drawPoly = (polyPx) => {
        if (!polyPx || polyPx.length < 3) return;
        ctxB.moveTo(polyPx[0].x, polyPx[0].y);
        for (let i = 1; i < polyPx.length; i++) ctxB.lineTo(polyPx[i].x, polyPx[i].y);
        ctxB.closePath();
    };

    // (polyCentroid/pxBounds unused in clean-map mode)

    // 2. Corridors
    if (cityFeatures && cityFeatures.corridors && cityFeatures.corridors.length > 0) {
        for (let i = 0; i < cityFeatures.corridors.length; i++) {
            const c = cityFeatures.corridors[i];
            if (!boundsOverlap(c.bounds, { minX: tileStartX, maxX: tileStartX + TILE_WORLD_W, minY: 0, maxY: MAP_H })) continue;
            ctxB.fillStyle = CONFIG.corridorFill;
            ctxB.beginPath();
            drawPoly(c.poly.map(p => ({ x: p.x * ux, y: p.y * uy })));
            ctxB.fill();

            ctxB.save();
            ctxB.globalAlpha = 0.12;
            ctxB.strokeStyle = "rgba(0,0,0,0.35)";
            ctxB.lineWidth = 1;
            const y0 = c.bounds.minY * uy;
            const y1 = c.bounds.maxY * uy;
            for (let x = (tileStartX - 20) * ux; x < (tileStartX + TILE_WORLD_W + 40) * ux; x += 22) {
                ctxB.beginPath();
                ctxB.moveTo(x, y0);
                ctxB.lineTo(x + 40, y1);
                ctxB.stroke();
            }
            ctxB.restore();
        }
    }

    // 3. District pads
    const tilePads = (tileBins && tileBins.pads && tileBins.pads[tileIndex]) ? tileBins.pads[tileIndex] : [];
    if (tilePads.length > 0) {
        ctxB.save();
        ctxB.globalAlpha = 0.72;
        for (let i = 0; i < tilePads.length; i++) {
            const pad = tilePads[i];
            ctxB.fillStyle = pad.tint || CONFIG.blockColor;
            ctxB.beginPath();
            drawPoly(pad.poly.map(p => ({ x: p.x * ux, y: p.y * uy })));
            ctxB.fill();
        }
        ctxB.restore();
    }

    // 4. Parks
    if (cityFeatures && cityFeatures.parks && cityFeatures.parks.length > 0) {
        for (let i = 0; i < cityFeatures.parks.length; i++) {
            const park = cityFeatures.parks[i];
            if (!boundsOverlap(park.bounds, { minX: tileStartX, maxX: tileStartX + TILE_WORLD_W, minY: 0, maxY: MAP_H })) continue;
            ctxB.fillStyle = CONFIG.parkFill;
            ctxB.beginPath();
            drawPoly(park.poly.map(p => ({ x: p.x * ux, y: p.y * uy })));
            ctxB.fill();

            ctxB.strokeStyle = "rgba(255,255,255,0.10)";
            ctxB.lineWidth = 1;
            ctxB.stroke();
        }
    }

    // 5. River
    if (cityFeatures && cityFeatures.river && cityFeatures.river.centerline && cityFeatures.river.centerline.length > 1) {
        ctxB.lineCap = "round";
        ctxB.lineJoin = "round";
        ctxB.beginPath();
        const pts = cityFeatures.river.centerline;
        ctxB.moveTo(pts[0].x * ux, pts[0].y * uy);
        for (let i = 1; i < pts.length; i++) ctxB.lineTo(pts[i].x * ux, pts[i].y * uy);
        ctxB.strokeStyle = CONFIG.waterFill;
        ctxB.lineWidth = cityFeatures.river.width * unit;
        ctxB.stroke();

        ctxB.strokeStyle = CONFIG.waterHighlight;
        ctxB.lineWidth = Math.max(2, cityFeatures.river.width * unit * 0.22);
        ctxB.stroke();
    }

    // 6. Buildings (clean map: flat fills + crisp strokes)
    const tileBuildings = getTileBuildings(tileIndex, q);
    const strokeW = Math.max(0.85, unit * 0.08);
    ctxB.lineWidth = strokeW;
    ctxB.lineJoin = "round";
    ctxB.strokeStyle = "rgba(0,0,0,0.22)";

    for (let i = 0; i < tileBuildings.length; i++) {
        const b = tileBuildings[i];
        const poly = b.poly || orientedRect(b.cx, b.cy, b.w, b.h, b.angle || 0);
        const basePx = poly.map(p => ({ x: p.x * ux, y: p.y * uy }));
        ctxB.fillStyle = b.tint.roof;
        ctxB.beginPath();
        drawPoly(basePx);
        ctxB.fill();
        ctxB.stroke();
    }

    // 7. Roads on top (clean-map: draw polylines, not per-segment capsules)
    const tileRoads = (tileBins && tileBins.roads && tileBins.roads[tileIndex]) ? tileBins.roads[tileIndex] : [];
    if (tileRoads.length > 0) {
        ctxB.lineCap = "butt";
        ctxB.lineJoin = "round";

        const drawRoadKind = (kind, color, widthMul, alpha = 1) => {
            const segs = tileRoads.filter(r => r.kind === kind);
            if (segs.length === 0) return;
            segs.sort((a, b) => {
                const ap = (a.polyId ?? -1);
                const bp = (b.polyId ?? -1);
                if (ap !== bp) return ap - bp;
                return (a.seq ?? 0) - (b.seq ?? 0);
            });

            ctxB.beginPath();
            let lastPoly = null;
            let lastB = null;
            for (let i = 0; i < segs.length; i++) {
                const r = segs[i];
                const pid = r.polyId ?? null;
                const canContinue = pid === lastPoly && lastB && Math.abs(r.a.x - lastB.x) < 1e-3 && Math.abs(r.a.y - lastB.y) < 1e-3;
                if (!canContinue) ctxB.moveTo(r.a.x * ux, r.a.y * uy);
                ctxB.lineTo(r.b.x * ux, r.b.y * uy);
                lastPoly = pid;
                lastB = r.b;
            }

            ctxB.save();
            ctxB.globalAlpha = alpha;
            ctxB.strokeStyle = color;
            const w = (segs[0].width || 1) * unit * widthMul;
            ctxB.lineWidth = Math.max(0.85, w);
            ctxB.stroke();
            ctxB.restore();
        };

        const casing = "rgba(0,0,0,0.17)";
        drawRoadKind("arterial", casing, 1.18, 0.9);
        drawRoadKind("secondary", casing, 1.12, 0.72);
        drawRoadKind("arterial", CONFIG.streetColor, 1.0, 1);
        drawRoadKind("secondary", CONFIG.streetColor, 0.98, 0.9);
        drawRoadKind("local", "rgba(183,161,187,0.80)", 0.78, 1);
        drawRoadKind("alley", "rgba(183,161,187,0.55)", 0.62, 1);
    }

    ctxB.restore();

    if (typeof canvas.transferToImageBitmap === "function") {
        return canvas.transferToImageBitmap();
    }
    if (typeof createImageBitmap === "function") {
        return await createImageBitmap(canvas);
    }
    return null;
}

/* --- Worker messaging --- */

self.onmessage = async (event) => {
    const msg = event.data;
    if (!msg || typeof msg !== "object") return;

    try {
        if (msg.type === "init") {
            genId = Number.isFinite(msg.genId) ? msg.genId : (genId + 1);
            citySeed = String(msg.seed ?? "");
            MAP_W = Number.isFinite(msg.mapW) ? msg.mapW : MAP_W;
            MAP_H = Number.isFinite(msg.mapH) ? msg.mapH : MAP_H;
            TILE_WORLD_W = Number.isFinite(msg.tileWorldW) ? msg.tileWorldW : TILE_WORLD_W;
            TILE_BUILD_MARGIN = Number.isFinite(msg.tileBuildMargin) ? msg.tileBuildMargin : TILE_BUILD_MARGIN;

            CONFIG = msg.config || CONFIG;
            if (!CONFIG) throw new Error("Missing CONFIG");

            cityCenter = msg.cityCenter || cityCenter;
            cityFeatures = msg.cityFeatures || null;
            districtPads = Array.isArray(msg.districtPads) ? msg.districtPads : [];
            roads = Array.isArray(msg.roads) ? msg.roads : [];
            downtownBuildings = Array.isArray(msg.downtownBuildings) ? msg.downtownBuildings : [];

            buildTileBins();
            self.postMessage({ type: "ready", genId });
            return;
        }

        if (msg.type === "bake") {
            if ((Number.isFinite(msg.genId) ? msg.genId : genId) !== genId) return;
            if (!CONFIG || !tileBins) return;

            const tileIndex = msg.tileIndex | 0;
            const quality = msg.quality >= 1 ? 1 : 0;
            const ux = Number(msg.ux);
            const uy = Number(msg.uy);
            const width = msg.width | 0;
            const height = msg.height | 0;
            if (!Number.isFinite(ux) || !Number.isFinite(uy) || width <= 0 || height <= 0) return;
            if (tileIndex < 0 || tileIndex >= tileCount) return;

            const bitmap = await bakeTile({ tileIndex, quality, ux, uy, width, height });
            if (!bitmap) return;
            self.postMessage({ type: "baked", genId, tileIndex, quality, bitmap }, [bitmap]);
        }
    } catch (err) {
        self.postMessage({ type: "error", genId, message: String(err && err.message ? err.message : err) });
    }
};
