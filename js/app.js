gsap.registerPlugin(ScrollTrigger);

function initScroll() {
  const container = document.querySelector(".scroll-container");
  const wrapper = document.querySelector(".horizontal-wrapper");

  if (!wrapper || !container) return;

  // Horizontal Scroll Timeline
  const horizontalTimeline = gsap.timeline({
    scrollTrigger: {
      trigger: container,
      pin: true,
      scrub: 1,
      end: () => "+=" + wrapper.offsetWidth,
      invalidateOnRefresh: true,
      anticipatePin: 1
    }
  });

  horizontalTimeline.to(wrapper, {
    x: () => -(wrapper.scrollWidth - document.documentElement.clientWidth) + "px",
    ease: "none"
  });

  // Header Visibility
  ScrollTrigger.create({
    trigger: ".vertical-hub",
    start: "top 80%",
    onEnter: () => document.querySelector(".site-header").classList.add("is-visible"),
    onLeaveBack: () => document.querySelector(".site-header").classList.remove("is-visible"),
    markers: false
  });

  // Initialize Canvas City
  requestAnimationFrame(() => {
    if (window.initCityCanvas) {
      initCityCanvas(".city-map-layer");

      // Now animate the signal path with the horizontal timeline
      if (window.animateSignalPath) {
        animateSignalPath(horizontalTimeline);
      }
    } else {
      console.error("City Canvas script not loaded");
    }
  });

  console.log("BSP City (Canvas) Initialized");
}

/* --- MOVED CITY GENERATOR TO js/city-canvas.js --- */

window.addEventListener("load", initScroll);
