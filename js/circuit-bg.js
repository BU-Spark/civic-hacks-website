/**
 * CivicHacks 2027 - Background Circuit Animation
 * A highly performant, responsive canvas-based background animation that renders
 * subtle circuit traces and glowing signal pulses.
 * Features:
 * - High-DPI support (retina display resolution)
 * - Energy conservation (auto-pauses via Page Visibility API when tab is hidden)
 * - Procedural grid-aligned path generation
 * - Performance-optimized glow rendering using layered strokes (no expensive shadowBlur)
 */

(function () {
  const canvas = document.getElementById('circuit-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let width = 0;
  let height = 0;
  let dpr = 1;
  let animationFrameId = null;
  let isVisible = true;

  // Configuration
  const GRID_SIZE = 80; // Distance between grid points in px
  const MAX_PATHS = 65; // Maximum simultaneous circuit paths
  const PULSE_TRAIL_LENGTH = 400; // Length of glowing signal pulse trail in px
  const TRACE_OPACITY = 0.04; // Opacity of the inactive copper traces
  const NODE_OPACITY = 0.08; // Opacity of terminal nodes

  // Color options: Signature green of the site
  const COLORS = [
    { r: 0, g: 255, b: 102 }     // Signature Green (#00ff66)
  ];

  let paths = [];
  let pulses = [];
  let ripples = [];

  // Helper: Get coordinate point at a specific distance along a path
  function getPointAtDistance(path, d) {
    if (d <= 0) return { x: path.points[0].x, y: path.points[0].y };
    if (d >= path.totalLength) return { x: path.points[path.points.length - 1].x, y: path.points[path.points.length - 1].y };

    for (let i = 0; i < path.segments.length; i++) {
      const seg = path.segments[i];
      if (d >= seg.startD && d <= seg.endD) {
        const t = (d - seg.startD) / seg.length;
        return {
          x: seg.startX + t * (seg.endX - seg.startX),
          y: seg.startY + t * (seg.endY - seg.startY)
        };
      }
    }
    return { x: path.points[path.points.length - 1].x, y: path.points[path.points.length - 1].y };
  }

  // Helper: Get subsegment points from distance d1 to d2 along a path
  function getSubpath(path, d1, d2) {
    const points = [];
    points.push(getPointAtDistance(path, d1));

    for (let i = 0; i < path.segments.length; i++) {
      const seg = path.segments[i];
      if (seg.endD > d1 && seg.endD < d2 && i < path.segments.length - 1) {
        points.push({ x: seg.endX, y: seg.endY });
      }
    }

    points.push(getPointAtDistance(path, d2));
    return points;
  }

  // Generate a procedural, grid-aligned PCB trace
  function generatePath() {
    const cols = Math.floor(width / GRID_SIZE);
    const rows = Math.floor(height / GRID_SIZE);

    if (cols < 3 || rows < 3) return null;

    // Pick a starting grid intersection (avoid the extreme edges)
    let col = Math.floor(Math.random() * (cols - 2)) + 1;
    let row = Math.floor(Math.random() * (rows - 2)) + 1;

    let x = col * GRID_SIZE;
    let y = row * GRID_SIZE;

    const points = [{ x, y }];
    const padding = 20;

    // Directives: horizontal/vertical directions
    const straightDirs = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 }
    ];

    let currentDir = straightDirs[Math.floor(Math.random() * straightDirs.length)];

    // Segment 1: Go straight for a bit
    const cells1 = Math.floor(Math.random() * 6) + 4; // 4-9 cells
    x += currentDir.x * cells1 * GRID_SIZE;
    y += currentDir.y * cells1 * GRID_SIZE;
    x = Math.max(padding, Math.min(width - padding, x));
    y = Math.max(padding, Math.min(height - padding, y));
    points.push({ x, y });

    // Segment 2: Make a 45-degree diagonal turn
    let diagDir;
    if (currentDir.y === 0) {
      // Was going horizontal, turn diagonal (e.g. if going right, new x is right, y is up or down)
      diagDir = { x: currentDir.x, y: Math.random() > 0.5 ? 1 : -1 };
    } else {
      // Was going vertical, turn diagonal
      diagDir = { x: Math.random() > 0.5 ? 1 : -1, y: currentDir.y };
    }

    const cells2 = Math.floor(Math.random() * 3) + 3; // 3-5 diagonal cells
    x += diagDir.x * cells2 * GRID_SIZE;
    y += diagDir.y * cells2 * GRID_SIZE;
    x = Math.max(padding, Math.min(width - padding, x));
    y = Math.max(padding, Math.min(height - padding, y));
    points.push({ x, y });

    // Segment 3: Turn back straight
    let finalDir;
    if (diagDir.x !== 0 && diagDir.y !== 0) {
      // Go either horizontal or vertical matching the diagonal direction
      finalDir = Math.random() > 0.5 ? { x: diagDir.x, y: 0 } : { x: 0, y: diagDir.y };
    } else {
      finalDir = currentDir;
    }

    const cells3 = Math.floor(Math.random() * 5) + 4; // 4-8 cells
    x += finalDir.x * cells3 * GRID_SIZE;
    y += finalDir.y * cells3 * GRID_SIZE;
    x = Math.max(padding, Math.min(width - padding, x));
    y = Math.max(padding, Math.min(height - padding, y));
    points.push({ x, y });

    // Remove any duplicate consecutive points caused by clamping
    const cleanPoints = [points[0]];
    for (let i = 1; i < points.length; i++) {
      const pA = cleanPoints[cleanPoints.length - 1];
      const pB = points[i];
      if (Math.abs(pA.x - pB.x) > 1 || Math.abs(pA.y - pB.y) > 1) {
        cleanPoints.push(pB);
      }
    }

    if (cleanPoints.length < 2) return null;

    // Build segments structure
    const segments = [];
    let totalLength = 0;

    for (let i = 0; i < cleanPoints.length - 1; i++) {
      const startX = cleanPoints[i].x;
      const startY = cleanPoints[i].y;
      const endX = cleanPoints[i + 1].x;
      const endY = cleanPoints[i + 1].y;
      const dx = endX - startX;
      const dy = endY - startY;
      const length = Math.sqrt(dx * dx + dy * dy);

      segments.push({
        startX,
        startY,
        endX,
        endY,
        length,
        startD: totalLength,
        endD: totalLength + length
      });

      totalLength += length;
    }

    // Select a random color profile for this path
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];

    return {
      points: cleanPoints,
      segments,
      totalLength,
      color
    };
  }

  // Manage paths and spawn active signal pulses
  function updatePathsAndPulses() {
    // Fill up paths if we have fewer than MAX_PATHS
    while (paths.length < MAX_PATHS) {
      const newPath = generatePath();
      if (newPath) {
        paths.push(newPath);

        // Spawn a pulse on this path
        pulses.push({
          pathIndex: paths.length - 1,
          progress: 0, // distance along path
          speed: Math.random() * 0.7 + 0.4, // 0.4px - 1.1px per frame
          opacity: 0, // start transparent for fade-in
          maxOpacity: Math.random() * 0.4 + 0.6, // max opacity between 0.6 and 1.0
          state: 'fade-in' // 'fade-in', 'active', 'fade-out'
        });
      } else {
        break; // Guard against small viewport infinite loops
      }
    }

    // Update pulses
    for (let i = pulses.length - 1; i >= 0; i--) {
      const pulse = pulses[i];
      const path = paths[pulse.pathIndex];

      if (!path) {
        pulses.splice(i, 1);
        continue;
      }

      pulse.progress += pulse.speed;

      // Handle opacity state transitions
      const distFromEnd = path.totalLength - pulse.progress;
      if (pulse.progress < 40) {
        // Fade in at start
        pulse.opacity = (pulse.progress / 40) * pulse.maxOpacity;
      } else if (distFromEnd < 40) {
        // Fade out at end
        pulse.opacity = (distFromEnd / 40) * pulse.maxOpacity;
      } else {
        pulse.opacity = pulse.maxOpacity;
      }

      // Ensure opacity doesn't overflow bounds
      pulse.opacity = Math.max(0, Math.min(pulse.maxOpacity, pulse.opacity));

      // Check if pulse completed its journey
      if (pulse.progress >= path.totalLength) {
        // Spawn terminal node ripple effect
        const endNode = path.points[path.points.length - 1];
        ripples.push({
          x: endNode.x,
          y: endNode.y,
          radius: 3,
          maxRadius: Math.random() * 10 + 10, // 10px - 20px ripple
          opacity: pulse.maxOpacity * 0.6,
          color: path.color
        });

        // Remove pulse and corresponding path
        pulses.splice(i, 1);
        
        // Remove the path. Since path indices are tied, we need to clean up paths array.
        // It's easiest to remove this path and decrement pathIndex of other pulses that refer to paths higher up.
        const removedIndex = pulse.pathIndex;
        paths.splice(removedIndex, 1);
        for (let j = 0; j < pulses.length; j++) {
          if (pulses[j].pathIndex > removedIndex) {
            pulses[j].pathIndex--;
          }
        }
      }
    }

    // Update ripples
    for (let i = ripples.length - 1; i >= 0; i--) {
      const rip = ripples[i];
      rip.radius += 0.35;
      rip.opacity -= 0.015;

      if (rip.opacity <= 0) {
        ripples.splice(i, 1);
      }
    }
  }

  // Draw background details, traces, and glowing pulses
  function draw() {
    ctx.clearRect(0, 0, width, height);

    // 1. Draw subtle background grid dots (tech motif)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.01)'; // Extremely faint white grid dots
    for (let x = GRID_SIZE; x < width; x += GRID_SIZE) {
      for (let y = GRID_SIZE; y < height; y += GRID_SIZE) {
        ctx.beginPath();
        ctx.arc(x, y, 0.75, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 2. Draw static copper circuit traces (underneath pulses)
    ctx.lineWidth = 1.0;
    paths.forEach(path => {
      ctx.strokeStyle = `rgba(${path.color.r}, ${path.color.g}, ${path.color.b}, ${TRACE_OPACITY})`;
      ctx.beginPath();
      ctx.moveTo(path.points[0].x, path.points[0].y);
      for (let i = 1; i < path.points.length; i++) {
        ctx.lineTo(path.points[i].x, path.points[i].y);
      }
      ctx.stroke();

      // Draw hollow circular terminal node
      const endNode = path.points[path.points.length - 1];
      ctx.fillStyle = '#050505'; // Cover underlying traces
      ctx.strokeStyle = `rgba(${path.color.r}, ${path.color.g}, ${path.color.b}, ${NODE_OPACITY})`;
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.arc(endNode.x, endNode.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });

    // 3. Draw active glowing signal pulses (layered lines for performant glow)
    pulses.forEach(pulse => {
      const path = paths[pulse.pathIndex];
      if (!path) return;

      const headD = pulse.progress;
      const tailD = Math.max(0, headD - PULSE_TRAIL_LENGTH);

      // Get list of points describing the subsegment of the path currently illuminated
      const subpath = getSubpath(path, tailD, headD);
      if (subpath.length < 2) return;

      const { r, g, b } = path.color;

      // Layer 1: Wide, highly transparent glow
      ctx.lineWidth = 5.0;
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${pulse.opacity * 0.12})`;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(subpath[0].x, subpath[0].y);
      for (let i = 1; i < subpath.length; i++) {
        ctx.lineTo(subpath[i].x, subpath[i].y);
      }
      ctx.stroke();

      // Layer 2: Medium glow
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${pulse.opacity * 0.35})`;
      ctx.beginPath();
      ctx.moveTo(subpath[0].x, subpath[0].y);
      for (let i = 1; i < subpath.length; i++) {
        ctx.lineTo(subpath[i].x, subpath[i].y);
      }
      ctx.stroke();

      // Layer 3: Solid bright core
      ctx.lineWidth = 1.0;
      const coreR = Math.round(200 + r * 0.215);
      const coreG = Math.round(200 + g * 0.215);
      const coreB = Math.round(200 + b * 0.215);
      ctx.strokeStyle = `rgba(${coreR}, ${coreG}, ${coreB}, ${pulse.opacity * 0.85})`;
      ctx.beginPath();
      ctx.moveTo(subpath[0].x, subpath[0].y);
      for (let i = 1; i < subpath.length; i++) {
        ctx.lineTo(subpath[i].x, subpath[i].y);
      }
      ctx.stroke();

      // Draw solid pulse head circle
      const headPt = subpath[subpath.length - 1];
      ctx.fillStyle = `rgba(${coreR}, ${coreG}, ${coreB}, ${pulse.opacity * 0.95})`;
      ctx.beginPath();
      ctx.arc(headPt.x, headPt.y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    });

    // 4. Draw node ripples
    ripples.forEach(rip => {
      ctx.lineWidth = 1.0;
      ctx.strokeStyle = `rgba(${rip.color.r}, ${rip.color.g}, ${rip.color.b}, ${rip.opacity})`;
      ctx.beginPath();
      ctx.arc(rip.x, rip.y, rip.radius, 0, Math.PI * 2);
      ctx.stroke();
    });
  }

  // Primary animation loop
  function loop() {
    if (!isVisible) return;
    updatePathsAndPulses();
    draw();
    animationFrameId = requestAnimationFrame(loop);
  }

  // Handle resizing with correct pixel ratio
  function handleResize() {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = window.devicePixelRatio || 1;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Clear paths to trigger regeneration of layout correct for the new screen size
    paths = [];
    pulses = [];
    ripples = [];

    // Redraw if paused to prevent flickering/blank screen
    if (!isVisible) {
      draw();
    }
  }

  // Setup Event Listeners
  window.addEventListener('resize', handleResize);

  // Monitor visibility state to preserve user resources (CPU/Battery)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      isVisible = false;
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
    } else {
      isVisible = true;
      // Prevent double loops
      if (!animationFrameId) {
        // Soft reset paths when coming back to prevent jumping pulses
        paths = [];
        pulses = [];
        ripples = [];
        animationFrameId = requestAnimationFrame(loop);
      }
    }
  });

  // Initialization
  handleResize();
  animationFrameId = requestAnimationFrame(loop);

  // Smoothly fade in canvas opacity on load
  canvas.style.opacity = '0';
  requestAnimationFrame(() => {
    canvas.style.opacity = '0.35';
  });
})();
