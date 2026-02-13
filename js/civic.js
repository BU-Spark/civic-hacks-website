const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
document.documentElement.classList.toggle("reduced-motion", prefersReducedMotion);

const gsap = window.gsap;
const ScrollTrigger = window.ScrollTrigger;
const Lenis = window.Lenis;

const hasGSAP = Boolean(gsap);
const hasScrollTrigger = Boolean(gsap && ScrollTrigger);

if (hasScrollTrigger) {
  gsap.registerPlugin(ScrollTrigger);
}

let lenis = null;
if (!prefersReducedMotion && Lenis) {
  lenis = new Lenis({
    duration: 1.1,
    smoothWheel: true,
    wheelMultiplier: 0.95,
    touchMultiplier: 1.15,
    easing: (t) => 1 - Math.pow(1 - t, 4),
  });

  if (hasGSAP) {
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  } else {
    const raf = (time) => {
      lenis.raf(time);
      window.requestAnimationFrame(raf);
    };
    window.requestAnimationFrame(raf);
  }

  lenis.on("scroll", () => {
    if (hasScrollTrigger) ScrollTrigger.update();
  });
}

function scrollToTarget(target) {
  if (!target) return;
  const headerOffset = 88;

  if (lenis?.scrollTo) {
    lenis.scrollTo(target, { offset: -headerOffset, duration: 1.05 });
    return;
  }

  try {
    target.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "start" });
  } catch {
    target.scrollIntoView();
  }
}

function isSamePageHashLink(anchor) {
  if (!anchor) return false;
  const href = anchor.getAttribute("href") ?? "";
  if (!href.startsWith("#")) return false;
  if (href === "#") return false;
  return true;
}

document.addEventListener("click", (e) => {
  const anchor = e.target?.closest?.("a");
  if (!anchor) return;
  if (!isSamePageHashLink(anchor)) return;

  const id = anchor.getAttribute("href").slice(1);
  const target = document.getElementById(id);
  if (!target) return;

  e.preventDefault();
  scrollToTarget(target);
});

// Nav overlay
const nav = document.getElementById("nav");
const navToggle = document.querySelector(".nav-toggle");
const navCloseEls = nav ? [...nav.querySelectorAll("[data-nav-close]")] : [];
const navLinks = nav ? [...nav.querySelectorAll(".nav-link, .chip-link")] : [];
const panel = nav?.querySelector(".nav-overlay__panel");
const scrim = nav?.querySelector(".nav-overlay__scrim");

let lastActive = null;
let navOpen = false;
let navTl = null;
let returnFocusOnClose = true;

function getFocusableWithin(el) {
  if (!el) return [];
  return [
    ...el.querySelectorAll(
      "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
    ),
  ].filter((node) => node && !node.hasAttribute("disabled") && node.getAttribute("aria-hidden") !== "true");
}

function setNavState(open) {
  navOpen = open;
  if (!nav || !navToggle) return;

  nav.setAttribute("aria-hidden", open ? "false" : "true");
  navToggle.setAttribute("aria-expanded", open ? "true" : "false");
  document.documentElement.classList.toggle("nav-open", open);
  document.body.classList.toggle("nav-open", open);

  if (lenis && typeof lenis.stop === "function" && typeof lenis.start === "function") {
    open ? lenis.stop() : lenis.start();
  }
}

function openNav() {
  if (!nav || !navToggle) return;
  if (navOpen) return;

  lastActive = document.activeElement;
  setNavState(true);

  if (navTl) {
    navTl.play(0);
  }

  const focusables = getFocusableWithin(nav);
  focusables[0]?.focus?.();
}

function closeNav({ returnFocus = true } = {}) {
  if (!nav || !navToggle) return;
  if (!navOpen) return;

  if (navTl) {
    returnFocusOnClose = returnFocus;
    navTl.reverse();
  } else {
    setNavState(false);
    if (returnFocus) lastActive?.focus?.();
  }
}

function onKeyDown(e) {
  if (!navOpen) return;
  if (e.key === "Escape") {
    e.preventDefault();
    closeNav();
    return;
  }

  if (e.key !== "Tab") return;
  const focusables = getFocusableWithin(nav);
  if (!focusables.length) return;

  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const isShift = e.shiftKey;

  if (!isShift && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  } else if (isShift && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  }
}

if (nav && navToggle) {
  navToggle.addEventListener("click", () => (navOpen ? closeNav() : openNav()));
  navCloseEls.forEach((el) => el.addEventListener("click", () => closeNav()));
  navLinks.forEach((el) =>
    el.addEventListener("click", () => {
      if (!navOpen) return;
      closeNav({ returnFocus: false });
    }),
  );
  document.addEventListener("keydown", onKeyDown);

  if (hasGSAP && panel && scrim) {
    const items = nav.querySelectorAll(".nav-link, .chip-link, .nav-overlay__title, .nav-overlay__subtitle");
    navTl = gsap
      .timeline({
        paused: true,
        defaults: { duration: 0.6, ease: "power4.out" },
        onReverseComplete: () => {
          setNavState(false);
          if (returnFocusOnClose) lastActive?.focus?.();
          returnFocusOnClose = true;
        },
      })
      .fromTo(scrim, { opacity: 0 }, { opacity: 1, duration: 0.35 }, 0)
      .fromTo(panel, { y: 26, scale: 0.985 }, { y: 0, scale: 1, duration: 0.7 }, 0)
      .fromTo(items, { y: 10, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.04, duration: 0.55 }, 0.12);
  }
}

// Circuit-map cursor (nav overlay)
function setupNavCursor() {
  if (!nav || !hasGSAP) return;
  const cursor = nav.querySelector(".circuit-map__cursor");
  const nodes = [...nav.querySelectorAll(".circuit-map__node")];
  if (!cursor || !nodes.length) return;

  const nodeByKey = new Map(nodes.map((n) => [n.getAttribute("data-node"), n]));

  const moveCursorToKey = (key) => {
    const node = nodeByKey.get(key);
    if (!node) return;

    const cx = node.getAttribute("cx");
    const cy = node.getAttribute("cy");

    gsap.to(cursor, {
      duration: 0.55,
      ease: "power3.out",
      attr: { cx, cy },
      overwrite: true,
    });
  };

  nav.querySelectorAll("[data-nav-link]").forEach((link) => {
    const key = link.getAttribute("data-nav-link");
    link.addEventListener("mouseenter", () => moveCursorToKey(key));
    link.addEventListener("focus", () => moveCursorToKey(key));
  });

  return { moveCursorToKey };
}

const navCursor = setupNavCursor();

// Apply modal (Netlify form) — only present on index.html
const applyModal = document.getElementById("apply-modal");
const applyOpeners = [...document.querySelectorAll("[data-apply-open]")];
const applyCloseEls = applyModal ? [...applyModal.querySelectorAll("[data-apply-close]")] : [];
const applyPanel = applyModal?.querySelector(".apply-modal__panel");
const applyScrim = applyModal?.querySelector(".apply-modal__scrim");
const roleSelect = applyModal?.querySelector("select[name='role']");

let applyOpen = false;
let applyTl = null;
let lastApplyActive = null;
let returnFocusApply = true;

function setApplyState(open) {
  applyOpen = open;
  if (!applyModal) return;

  applyModal.setAttribute("aria-hidden", open ? "false" : "true");
  document.documentElement.classList.toggle("apply-open", open);
  document.body.classList.toggle("apply-open", open);

  if (lenis && typeof lenis.stop === "function" && typeof lenis.start === "function") {
    open ? lenis.stop() : lenis.start();
  }
}

function openApply(role) {
  if (!applyModal) return;
  if (applyOpen) return;
  if (navOpen) closeNav({ returnFocus: false });

  lastApplyActive = document.activeElement;
  setApplyState(true);

  if (roleSelect && role) roleSelect.value = role;
  if (applyTl) applyTl.play(0);

  const focusables = getFocusableWithin(applyModal);
  focusables[0]?.focus?.();
}

function closeApply({ returnFocus = true } = {}) {
  if (!applyModal) return;
  if (!applyOpen) return;

  if (applyTl) {
    returnFocusApply = returnFocus;
    applyTl.reverse();
  } else {
    setApplyState(false);
    if (returnFocus) lastApplyActive?.focus?.();
  }
}

function onApplyKeyDown(e) {
  if (!applyOpen) return;

  if (e.key === "Escape") {
    e.preventDefault();
    closeApply();
    return;
  }

  if (e.key !== "Tab") return;
  const focusables = getFocusableWithin(applyModal);
  if (!focusables.length) return;

  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const isShift = e.shiftKey;

  if (!isShift && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  } else if (isShift && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  }
}

if (applyModal) {
  applyOpeners.forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault?.();
      openApply(el.getAttribute("data-apply-open"));
    });
  });
  applyCloseEls.forEach((el) => el.addEventListener("click", () => closeApply()));
  document.addEventListener("keydown", onApplyKeyDown);

  if (hasGSAP && applyPanel && applyScrim) {
    const items = applyModal.querySelectorAll(
      ".apply-modal__title, .apply-modal__subtitle, .field, .apply-form__actions",
    );
    applyTl = gsap
      .timeline({
        paused: true,
        defaults: { duration: 0.6, ease: "power4.out" },
        onReverseComplete: () => {
          setApplyState(false);
          if (returnFocusApply) lastApplyActive?.focus?.();
          returnFocusApply = true;
        },
      })
      .fromTo(applyScrim, { opacity: 0 }, { opacity: 1, duration: 0.35 }, 0)
      .fromTo(applyPanel, { y: 26, scale: 0.985 }, { y: 0, scale: 1, duration: 0.7 }, 0)
      .fromTo(items, { y: 10, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.03, duration: 0.55 }, 0.12);
  }
}

// Scroll spy: highlight nav + follow cursor with sections
function setupScrollSpy() {
  if (!nav) return;

  const ids = ["mission", "tracks", "programming", "sponsors", "prizes", "join"];
  const sections = ids.map((id) => document.getElementById(id)).filter(Boolean);
  if (!sections.length) return;

  const linkById = new Map(
    [...nav.querySelectorAll("[data-nav-link]")].map((el) => [el.getAttribute("data-nav-link"), el]),
  );

  const setActive = (id) => {
    for (const [key, el] of linkById) el.classList.toggle("is-active", key === id);
    navCursor?.moveCursorToKey?.(id);
  };

  const observer = new IntersectionObserver(
    (entries) => {
      const topMost = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!topMost) return;
      setActive(topMost.target.id);
    },
    { rootMargin: "-35% 0px -55% 0px", threshold: [0.2, 0.35, 0.5] },
  );

  sections.forEach((s) => observer.observe(s));
}

setupScrollSpy();

// Magnetic hover micro-interaction
function setupMagnetic() {
  if (!hasGSAP) return;
  const els = [...document.querySelectorAll("[data-magnetic]")];
  if (!els.length) return;

  els.forEach((el) => {
    const strength = 0.28;
    const xTo = gsap.quickTo(el, "x", { duration: 0.35, ease: "power3.out" });
    const yTo = gsap.quickTo(el, "y", { duration: 0.35, ease: "power3.out" });

    const onMove = (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - (r.left + r.width / 2)) * strength;
      const y = (e.clientY - (r.top + r.height / 2)) * strength;
      xTo(x);
      yTo(y);
    };

    const onLeave = () => {
      xTo(0);
      yTo(0);
    };

    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
  });
}

setupMagnetic();

// Page-load + scroll animations
function setupMotion() {
  if (!hasScrollTrigger || prefersReducedMotion) return;

  gsap.fromTo(
    ".hero__line--a",
    { yPercent: 18, opacity: 0 },
    { yPercent: 0, opacity: 1, duration: 0.8, ease: "power4.out", delay: 0.05 },
  );
  gsap.fromTo(
    ".hero__line--b",
    { yPercent: 18, opacity: 0 },
    { yPercent: 0, opacity: 1, duration: 0.85, ease: "power4.out", delay: 0.12 },
  );
  gsap.fromTo(
    ".hero__year",
    { yPercent: 30, opacity: 0, rotate: -2 },
    { yPercent: 0, opacity: 1, rotate: 0, duration: 0.75, ease: "power4.out", delay: 0.18 },
  );

  gsap.utils.toArray("[data-reveal]").forEach((el) => {
    gsap.fromTo(
      el,
      { y: 18, opacity: 0, filter: "blur(6px)" },
      {
        y: 0,
        opacity: 1,
        filter: "blur(0px)",
        duration: 0.9,
        ease: "power3.out",
        scrollTrigger: { trigger: el, start: "top 86%", once: true },
      },
    );
  });

  // Background parallax
  const grid = document.querySelector(".bg__grid");
  const circuit = document.querySelector(".bg__circuit");
  if (grid) {
    gsap.to(grid, {
      y: -40,
      scrollTrigger: { trigger: document.body, start: "top top", end: "bottom bottom", scrub: 0.6 },
    });
  }
  if (circuit) {
    gsap.to(circuit, {
      y: -60,
      scrollTrigger: { trigger: document.body, start: "top top", end: "bottom bottom", scrub: 0.6 },
    });
  }

  // Marquee reactive skew (speed → attitude)
  const marqueeTrack = document.querySelector(".marquee__track");
  if (marqueeTrack) {
    const proxy = { skew: 0 };
    const skewSetter = gsap.quickSetter(marqueeTrack, "skewX", "deg");
    const clamp = gsap.utils.clamp(-12, 12);

    ScrollTrigger.create({
      onUpdate: (self) => {
        const v = self.getVelocity();
        const skew = clamp(v / -300);
        if (Math.abs(skew) > Math.abs(proxy.skew)) {
          proxy.skew = skew;
          gsap.to(proxy, {
            skew: 0,
            duration: 0.9,
            ease: "power3.out",
            overwrite: true,
            onUpdate: () => skewSetter(proxy.skew),
          });
        }
      },
    });
  }

  // Tracks: pinned horizontal scroll on desktop
  const tracks = document.getElementById("tracks");
  const rail = tracks?.querySelector?.(".tracks-rail");
  if (tracks && rail) {
    ScrollTrigger.matchMedia({
      "(min-width: 821px)": () => {
        const cards = gsap.utils.toArray(tracks.querySelectorAll(".track-card"));
        const tween = gsap.to(rail, {
          x: () => -(rail.scrollWidth - window.innerWidth),
          ease: "none",
          scrollTrigger: {
            trigger: tracks,
            start: "top top",
            end: () => `+=${rail.scrollWidth}`,
            pin: true,
            scrub: 1,
            invalidateOnRefresh: true,
            anticipatePin: 1,
          },
        });

        cards.forEach((card, i) => {
          gsap.fromTo(
            card,
            { y: 24, rotate: i % 2 ? 2 : -2, opacity: 0.65 },
            {
              y: 0,
              rotate: 0,
              opacity: 1,
              duration: 0.6,
              ease: "power3.out",
              scrollTrigger: {
                trigger: card,
                containerAnimation: tween,
                start: "left 80%",
                end: "right 45%",
                scrub: true,
              },
            },
          );
        });
      },
    });
  }
}

setupMotion();

// If we load with a hash, align after the first frame (Lenis-ready)
if (window.location.hash) {
  const id = window.location.hash.slice(1);
  const el = document.getElementById(id);
  if (el) {
    window.requestAnimationFrame(() => scrollToTarget(el));
  }
}
