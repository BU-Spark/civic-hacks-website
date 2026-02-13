
// Initialize Lenis for smooth scrolling
const lenis = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    direction: 'vertical',
    gestureDirection: 'vertical',
    smooth: true,
    mouseMultiplier: 1,
    smoothTouch: false,
    touchMultiplier: 2,
});

function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
}

requestAnimationFrame(raf);

// Integrate GSAP ScrollTrigger with Lenis
gsap.registerPlugin(ScrollTrigger);

// Connect GSAP ScrollTrigger to Lenis
lenis.on('scroll', ScrollTrigger.update);

gsap.ticker.add((time) => {
    lenis.raf(time * 1000);
});

gsap.ticker.lagSmoothing(0);

// Basic test animation
console.log("Animations initialized");

// Navigation Logic (HUD)
const hudLinks = document.querySelectorAll('.hud-link');
const hudNav = document.querySelector('.hud-nav');
const sysDot = document.querySelector('.status-dot');

// Glitch Effect on Hover
hudLinks.forEach(link => {
    link.addEventListener('mouseover', () => {
        const originalText = link.getAttribute('data-text');
        let iterations = 0;
        const interval = setInterval(() => {
            link.innerText = link.innerText.split('')
                .map((letter, index) => {
                    if (index < iterations) {
                        return originalText[index];
                    }
                    return 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)];
                })
                .join('');

            if (iterations >= originalText.length) {
                clearInterval(interval);
            }

            iterations += 1 / 3;
        }, 30);
    });
});

// Scroll Indicator Logic
const hudLinksContainer = document.querySelector('.hud-links');
const indicator = document.querySelector('.hud-scroll-indicator');

function updateIndicator() {
    if (!hudLinksContainer || !indicator) return;

    // Check if scroll is needed
    const isOverflowing = hudLinksContainer.scrollHeight > hudLinksContainer.clientHeight;
    const isAtBottom = Math.abs(hudLinksContainer.scrollHeight - hudLinksContainer.clientHeight - hudLinksContainer.scrollTop) < 5;

    if (isOverflowing && !isAtBottom) {
        indicator.style.opacity = '1';
    } else {
        indicator.style.opacity = '0';
    }
}

if (hudLinksContainer) {
    hudLinksContainer.addEventListener('scroll', updateIndicator);
    // Initial check and check on resize
    window.addEventListener('resize', updateIndicator);
    // Give it a moment to render
    setTimeout(updateIndicator, 500);
}

// Parallax for Circuit Blocks
gsap.to('.cb-1', {
    scrollTrigger: {
        trigger: 'body',
        start: 'top top',
        end: 'bottom bottom',
        scrub: 1
    },
    y: 100,
    rotation: 10
});

gsap.to('.cb-2', {
    scrollTrigger: {
        trigger: 'body',
        start: 'top top',
        end: 'bottom bottom',
        scrub: 1.5
    },
    y: -150,
    rotation: -5
});

// Hero Title Stagger
// Hero Logo Animation
gsap.from('.hero-logo', {
    duration: 1.5,
    y: 100,
    opacity: 0,
    ease: "power4.out",
    delay: 0.5
});

gsap.from('.hero-year', {
    duration: 1.5,
    y: -50,
    opacity: 0,
    ease: "power4.out",
    delay: 0.7
});

// Animations for Sections
gsap.utils.toArray('.reveal-text').forEach(element => {
    gsap.fromTo(element,
        { y: 50, opacity: 0 },
        {
            scrollTrigger: {
                trigger: element,
                start: "top 85%",
                toggleActions: "play none none reverse"
            },
            y: 0,
            opacity: 1,
            duration: 1,
            ease: "power3.out"
        }
    );
});

const staggerSections = ['.tracks-grid', '.faq-grid', '.schedule-timeline', '.prizes-grid', '.sponsors-grid', '.bounty-grid'];

// Prize Filtering
const filterBtns = document.querySelectorAll('.filter-btn');
const bountyCards = document.querySelectorAll('.bounty-card');

if (filterBtns.length > 0) {
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Active state
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const filter = btn.getAttribute('data-filter');

            // Filter Items
            bountyCards.forEach(card => {
                if (filter === 'all' || card.getAttribute('data-category') === filter) {
                    gsap.to(card, { autoAlpha: 1, display: 'flex', duration: 0.3 });
                } else {
                    gsap.to(card, { autoAlpha: 0, display: 'none', duration: 0.3 });
                }
            });

            // Re-animate layout if needed
            ScrollTrigger.refresh();
        });
    });
}

staggerSections.forEach(selector => {
    if (document.querySelector(selector)) {
        gsap.from(document.querySelector(selector).children, {
            scrollTrigger: {
                trigger: selector,
                start: "top 80%",
            },
            y: 30,
            opacity: 0,
            duration: 0.8,
            stagger: 0.1,
            ease: "power2.out"
        });
    }
});

// Mission Photo Stack Interaction
const stackCards = document.querySelectorAll('.stack-card');
if (stackCards.length > 0) {
    gsap.from(stackCards, {
        scrollTrigger: {
            trigger: '.photo-stack',
            start: "top 80%",
            scrub: 1
        },
        rotate: 0,
        x: 0,
        y: 50,
        stagger: 0.05,
        duration: 1
    });
}

// Tracks Expansion Logic
const trackCards = document.querySelectorAll('.track-card');

trackCards.forEach(card => {
    const btn = card.querySelector('.track-expand-btn');
    const details = card.querySelector('.track-details');

    card.addEventListener('click', () => {
        const isActive = card.classList.contains('active');

        // Optional: Close others (accordian style) - decided against for now to allow comparing tracks
        // trackCards.forEach(c => {
        //     if (c !== card && c.classList.contains('active')) {
        //         c.classList.remove('active');
        //         gsap.to(c.querySelector('.track-details'), { height: 0, opacity: 0, duration: 0.3 });
        //         c.querySelector('.track-expand-btn').innerText = 'LEARN_MORE +';
        //     }
        // });

        if (isActive) {
            // Collapse
            card.classList.remove('active');
            gsap.to(details, {
                height: 0,
                opacity: 0,
                duration: 0.4,
                ease: "power2.inOut"
            });
            btn.innerText = 'LEARN_MORE +';
        } else {
            // Expand
            card.classList.add('active');
            gsap.to(details, {
                height: "auto",
                opacity: 1,
                duration: 0.4,
                ease: "power2.inOut"
            });
            btn.innerText = 'CLOSE -';
        }
    });
});

// Reveal Cards Animation (Sponsors)
if (document.querySelectorAll('.reveal-card').length > 0) {
    gsap.utils.toArray('.reveal-card').forEach(element => {
        ScrollTrigger.create({
            trigger: element,
            start: "top 85%",
            onEnter: () => element.classList.add('visible'),
            // Optional: remove visible class when scrolling back up
            // onLeaveBack: () => element.classList.remove('visible') 
        });
    });
}

// FAQ Filtering Logic
const faqFilterBtns = document.querySelectorAll('.faq-filter-btn');
const faqItems = document.querySelectorAll('.faq-item');

if (faqFilterBtns.length > 0) {
    faqFilterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Active state
            faqFilterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const category = btn.getAttribute('data-category');

            // Filter Items with Animation
            faqItems.forEach(item => {
                if (category === 'all' || item.getAttribute('data-category') === category) {
                    gsap.to(item, { 
                        display: 'block', 
                        opacity: 1, 
                        y: 0,
                        duration: 0.3,
                        onStart: () => {
                             item.style.display = 'block';
                        }
                    });
                } else {
                    gsap.to(item, { 
                        opacity: 0, 
                        y: 10,
                        duration: 0.2, 
                        onComplete: () => {
                            item.style.display = 'none';
                        } 
                    });
                }
            });
            
            // Refresh scroll trigger matches if needed
            ScrollTrigger.refresh();
        });
    });
}
