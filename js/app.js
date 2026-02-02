gsap.registerPlugin(ScrollTrigger);

// Initialize Lenis
const lenis = new Lenis({
  duration: 0.9,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  direction: 'vertical',
  gestureDirection: 'vertical',
  smooth: true,
  mouseMultiplier: 1,
  smoothTouch: false,
  touchMultiplier: 1,
  infinite: false,
});
window.lenis = lenis;
window.lenisDefaults = {
  duration: lenis.options && typeof lenis.options.duration === "number" ? lenis.options.duration : 0.9,
  easing: lenis.options && typeof lenis.options.easing === "function" ? lenis.options.easing : (t) => t,
};

// Sync ScrollRestoration (set in HTML head, but ensuring here too)
if (history.scrollRestoration) {
  history.scrollRestoration = 'manual';
}

// Update ScrollTrigger on Lenis scroll
lenis.on('scroll', ScrollTrigger.update);

// GSAP Ticker for Lenis
gsap.ticker.add((time) => {
  lenis.raf(time * 1000);
});

// Reset Ticker lag smoothing
gsap.ticker.lagSmoothing(0);

function initScroll() {
  // Final force reset on load
  ScrollTrigger.clearScrollMemory();
  window.scrollTo(0, 0);
  lenis.scrollTo(0, { immediate: true });

  const container = document.querySelector(".scroll-container");
  const wrapper = document.querySelector(".horizontal-wrapper");

  if (!wrapper || !container) return;


  // Header Visibility - Appear ONLY after vertical scrolling starts
  ScrollTrigger.create({
    trigger: ".vertical-hub",
    start: "top 70%", // Appear once vertical scroll is well underway
    onEnter: () => {
      document.querySelector(".site-header").classList.add("is-visible");
    },
    onLeaveBack: () => {
      document.querySelector(".site-header").classList.remove("is-visible");
    },
    markers: false
  });

  // Initialize Canvas City
  requestAnimationFrame(() => {
    if (window.initCityCanvas) {
      initCityCanvas(".city-map-layer");

      // Now animate the signal path with the horizontal timeline
      // NOTE: animateSignalPath creates its own timeline/ScrollTrigger now
      if (window.animateSignalPath) {
        animateSignalPath();
      }
    } else {
      console.error("City Canvas script not loaded");
    }
  });

  console.log("Horizontal Scroll and City Canvas Initialization Pushed to Next Frame");

  initFAQ();
}

function initFAQ() {
  const faqItems = document.querySelectorAll(".faq-item");
  faqItems.forEach(item => {
    const question = item.querySelector(".faq-question");
    question.addEventListener("click", () => {
      // Toggle current
      item.classList.toggle("active");

      // Close others (optional, for accordion effect)
      faqItems.forEach(otherItem => {
        if (otherItem !== item) {
          otherItem.classList.remove("active");
        }
      });

      // Refresh ScrollTrigger as content height might change
      ScrollTrigger.refresh();
    });
  });
}

/* --- MOVED CITY GENERATOR TO js/city-canvas.js --- */

window.addEventListener("load", initScroll);
