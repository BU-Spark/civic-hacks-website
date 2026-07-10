
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

// Custom Cursor Logic
const cursor = document.querySelector('.custom-cursor');
const interactables = document.querySelectorAll('a, button, .track-card, .prize-plate');

document.addEventListener('mousemove', (e) => {
    gsap.to(cursor, {
        x: e.clientX,
        y: e.clientY,
        duration: 0.1,
        ease: "power2.out"
    });
});

interactables.forEach(el => {
    el.addEventListener('mouseenter', () => cursor.classList.add('active'));
    el.addEventListener('mouseleave', () => cursor.classList.remove('active'));
});

// Navigation Logic (HUD)
const hudLinks = document.querySelectorAll('.hud-link, .hud-sublink');
const hudNav = document.querySelector('.hud-nav');
const hudLinksContainer = document.querySelector('.hud-links');
const sysDot = document.querySelector('.status-dot');

// Scroll Indicators Logic
function initScrollIndicators(container, upArrow, downArrow) {
    if (!container || !upArrow || !downArrow) return;

    function update() {
        const scrollTop = container.scrollTop;
        const scrollHeight = container.scrollHeight;
        const clientHeight = container.clientHeight;

        // Tolerance for rounding issues
        const atTop = scrollTop <= 1;
        const atBottom = scrollTop + clientHeight >= scrollHeight - 1;
        const canScroll = scrollHeight > clientHeight + 1;

        if (canScroll) {
            upArrow.classList.toggle('visible', !atTop);
            downArrow.classList.toggle('visible', !atBottom);
        } else {
            upArrow.classList.remove('visible');
            downArrow.classList.remove('visible');
        }
    }

    container.addEventListener('scroll', update);
    window.addEventListener('resize', update);

    // Initial check and periodic check for dynamic content changes
    update();
    setTimeout(update, 100);
    setInterval(update, 1000); // Fail-safe for layout shifts
}

// Initialize HUD Indicators
const hudUp = hudNav?.querySelector('.scroll-indicator.up');
const hudDown = hudNav?.querySelector('.scroll-indicator.down');
initScrollIndicators(hudLinksContainer, hudUp, hudDown);

// Glitch Effect on Hover
hudLinks.forEach(link => {
    link.addEventListener('mouseover', () => {
        const originalText = link.getAttribute('data-text') || link.innerText;
        if (!link.getAttribute('data-text')) {
            link.setAttribute('data-text', originalText);
        }

        if (link.glitchInterval) clearInterval(link.glitchInterval);

        let iterations = 0;
        link.glitchInterval = setInterval(() => {
            link.innerText = originalText.split('')
                .map((letter, index) => {
                    if (index < iterations) {
                        return originalText[index];
                    }
                    return 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)];
                })
                .join('');

            if (iterations >= originalText.length) {
                clearInterval(link.glitchInterval);
                link.innerText = originalText;
            }

            iterations += 1 / 3;
        }, 30);
    });
});

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

// Anchor Link Smooth Scroll with Lenis
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const targetId = this.getAttribute('href');
        if (targetId === '#') return; // Ignore empty anchors

        const targetElement = document.querySelector(targetId);
        if (targetElement) {
            lenis.scrollTo(targetElement, {
                offset: 0,
                duration: 1.5,
                easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t))
            });
        }
    });
});

const staggerSections = ['.faq-grid', '.schedule-timeline', '.archive-list', '.sponsors-grid', '.bounty-grid'];


staggerSections.forEach(selector => {
    if (document.querySelector(selector)) {
        gsap.fromTo(document.querySelector(selector).children,
            { y: 30, opacity: 0 },
            {
                scrollTrigger: {
                    trigger: selector,
                    start: "top 85%", // Trigger slightly earlier
                    toggleActions: "play none none none" // Play once and stay
                },
                y: 0,
                opacity: 1,
                duration: 0.8,
                stagger: 0.1,
                ease: "power2.out",
                overwrite: 'auto'
            });
    }
});

// Specific animation for tracks (nested in columns)
if (document.querySelector('.tracks-grid')) {
    gsap.fromTo(document.querySelectorAll('.track-card'),
        { y: 30, opacity: 0 },
        {
            scrollTrigger: {
                trigger: '.tracks-grid',
                start: "top 85%",
                toggleActions: "play none none none"
            },
            y: 0,
            opacity: 1,
            duration: 0.8,
            stagger: 0.1,
            ease: "power2.out",
            overwrite: 'auto'
        });
}

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

// One-Way Sync Logic for Tracks
function syncTracksLayout() {
    // Only run on desktop where columns exist
    if (window.innerWidth <= 900) {
        const healthcareCard = document.querySelector('.tracks-col-right .track-card:nth-child(2)');
        if (healthcareCard) healthcareCard.style.marginTop = '0px';
        return;
    }

    const civicTech = document.querySelector('.tracks-col-left > .track-card:nth-child(2)');
    const education = document.querySelector('.tracks-col-right > .track-card:nth-child(1)');
    const healthcare = document.querySelector('.tracks-col-right > .track-card:nth-child(2)');

    if (!civicTech || !education || !healthcare) return;

    // Get positions
    const civicRect = civicTech.getBoundingClientRect();
    const eduRect = education.getBoundingClientRect();

    // We need relative positions within the flow, but getBoundingClientRect Works if we compare relative to viewport
    // Goal: Healthcare Top >= Civic Tech Top
    // Healthcare Natural Top = Education Bottom + Gap
    // If Civic Tech Top > Education Bottom + Gap, we need margin.

    // Gap is 2rem = 32px (approx, but let's measure or assume)
    const gap = 32;

    const civicTop = civicRect.top;
    const eduBottom = eduRect.bottom;
    const naturalHealthcareTop = eduBottom + gap;

    if (civicTop > naturalHealthcareTop) {
        const requiredMargin = civicTop - naturalHealthcareTop;
        healthcare.style.marginTop = `${requiredMargin}px`;
    } else {
        healthcare.style.marginTop = '0px';
    }
}

// Observe size changes to trigger sync
const tracksResizeObserver = new ResizeObserver(entries => {
    // Debounce perfectly not needed since it's just a calc
    requestAnimationFrame(syncTracksLayout);
});

trackCards.forEach(card => {
    tracksResizeObserver.observe(card);
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-expanded', 'false');

    const btn = card.querySelector('.track-expand-btn');
    const details = card.querySelector('.track-details');

    const toggleTrackCard = () => {
        const isActive = card.classList.contains('active');

        if (isActive) {
            // Collapse
            card.classList.remove('active');
            card.setAttribute('aria-expanded', 'false');
            gsap.to(details, {
                height: 0,
                opacity: 0,
                duration: 0.4,
                ease: "power2.inOut",
                onUpdate: syncTracksLayout // Sync during animation
            });
            btn.innerText = 'LEARN_MORE +';
        } else {
            // Expand
            card.classList.add('active');
            card.setAttribute('aria-expanded', 'true');
            gsap.to(details, {
                height: "auto",
                opacity: 1,
                duration: 0.4,
                ease: "power2.inOut",
                onUpdate: syncTracksLayout // Sync during animation
            });
            btn.innerText = 'CLOSE -';
        }
    };

    card.addEventListener('click', toggleTrackCard);
    card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            toggleTrackCard();
        }
    });
});

// Initial sync
window.addEventListener('load', syncTracksLayout);
window.addEventListener('resize', syncTracksLayout);

// FAQ Terminal Logic
const termFilterBtns = document.querySelectorAll('.term-filter-btn');
const termItems = document.querySelectorAll('.faq-item');

if (termFilterBtns.length > 0) {
    termFilterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Active state
            termFilterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const category = btn.getAttribute('data-category');

            // Filter
            termItems.forEach(item => {
                if (category === 'all' || item.getAttribute('data-category') === category) {
                    item.style.display = 'block';
                } else {
                    item.style.display = 'none';
                }
            });

            ScrollTrigger.refresh();
        });
    });
}
// Hackathon Image Carousel Randomization
const hackathonImages = [
    "DSC04129.jpg", "DSC04158.jpg", "DSC04184.jpg", "DSC04267.jpg", "DSC04329.jpg",
    "DSC04485.jpg", "DSC04507.jpg", "DSC04526.jpg", "DSC04531.jpg", "DSC04537.jpg",
    "DSC04558.jpg", "DSC04562.jpg", "DSC04564.jpg", "DSC04568.jpg", "DSC04570.jpg",
    "DSC04576.jpg", "DSC04584.jpg", "DSC04591.jpg", "DSC04593.jpg", "DSC04613.jpg",
    "DSC04664.jpg", "DSC04701.jpg", "DSC04747.jpg", "DSC04760.jpg", "DSC04766.jpg",
    "DSC04794.jpg", "DSC04797.jpg", "DSC05170.jpg", "DSC05189.jpg", "DSC05195.jpg",
    "DSC05196.jpg", "DSC05234.jpg", "DSC05236.jpg", "DSC05248.jpg", "DSC05256.jpg",
    "DSC05274.jpg", "DSC05301.jpg", "DSC05307.jpg", "DSC05315.jpg", "DSC05320.jpg",
    "DSC05332.jpg", "DSC05349.jpg", "DSC05354.jpg"
];

function populateCarousel() {
    // Fisher-Yates Shuffle
    const shuffled = [...hackathonImages];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Select first 10 unique images
    const selectedImages = shuffled.slice(0, 10);

    // Target containers
    const marquee1 = document.getElementById('marquee-1');
    const marquee2 = document.getElementById('marquee-2');

    if (marquee1 && marquee2) {
        const htmlContent = selectedImages.map(img =>
            `<div class="gallery-item"><img src="img/hackathon/${img}" alt="Hackathon Photo" loading="eager"></div>`
        ).join('');

        marquee1.innerHTML = htmlContent;
        marquee2.innerHTML = htmlContent;
    }
}

// Run on load
window.addEventListener('load', () => {
    populateCarousel();
    initMobileCarouselScroll();
});

// Hybrid Mobile Carousel: auto-scroll + swipeable
function initMobileCarouselScroll() {
    const wrapper = document.querySelector('.marquee-wrapper');
    if (!wrapper) return;

    let scrollSpeed = 0.4;       // px per frame
    let isPaused = false;
    let resumeTimer = null;

    function autoScroll() {
        // Only scroll when there's actually scrollable overflow (i.e. mobile layout)
        // This makes it self-adapting: no-op on desktop, active on mobile
        if (!isPaused && wrapper.scrollWidth > wrapper.clientWidth) {
            wrapper.scrollLeft += scrollSpeed;

            // Loop: when we hit the end, jump back to start
            if (wrapper.scrollLeft >= wrapper.scrollWidth - wrapper.clientWidth - 1) {
                wrapper.scrollLeft = 0;
            }
        }
        requestAnimationFrame(autoScroll);
    }

    // Pause on touch
    wrapper.addEventListener('touchstart', () => {
        isPaused = true;
        wrapper.classList.add('is-swiping');
        if (resumeTimer) clearTimeout(resumeTimer);
    }, { passive: true });

    // Resume 2s after touch ends
    wrapper.addEventListener('touchend', () => {
        if (resumeTimer) clearTimeout(resumeTimer);
        resumeTimer = setTimeout(() => {
            wrapper.classList.remove('is-swiping');
            isPaused = false;
        }, 2000);
    }, { passive: true });

    // Start the loop
    requestAnimationFrame(autoScroll);
}

/* --- MOBILE NAVIGATION LOGIC --- */
const mobileToggle = document.querySelector('.mobile-nav-toggle');
const mobileOverlay = document.querySelector('.mobile-menu-overlay');
const mobileLinks = document.querySelectorAll('.mobile-link, .mobile-sublink');

// Mobile Dropdown Toggle
const mobileDropdownTrigger = document.querySelector('.mobile-nav-dropdown .dropdown-trigger');
const mobileNavDropdown = document.querySelector('.mobile-nav-dropdown');

if (mobileDropdownTrigger && mobileNavDropdown) {
    mobileDropdownTrigger.addEventListener('click', (e) => {
        e.preventDefault();
        mobileNavDropdown.classList.toggle('active');
    });
}

// Glitch text-decode effect for mobile links
function glitchDecode(element) {
    const originalText = element.getAttribute('data-text');
    if (!originalText) return;
    let iterations = 0;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ_!@#$%^&*<>[]{}';
    const interval = setInterval(() => {
        element.innerText = originalText.split('')
            .map((letter, index) => {
                if (index < iterations) return originalText[index];
                return chars[Math.floor(Math.random() * chars.length)];
            })
            .join('');
        if (iterations >= originalText.length) clearInterval(interval);
        iterations += 1 / 2;
    }, 35);
}

// Initialize Mobile Indicators
const mobileUp = mobileOverlay.querySelector('.scroll-indicator.up');
const mobileDown = mobileOverlay.querySelector('.scroll-indicator.down');
initScrollIndicators(mobileOverlay, mobileUp, mobileDown);

mobileToggle.addEventListener('click', () => {
    const isOpening = !mobileOverlay.classList.contains('active');
    mobileToggle.classList.toggle('active');
    mobileOverlay.classList.toggle('active');

    // Run glitch decode on each link when opening
    if (isOpening) {
        mobileLinks.forEach((link, i) => {
            setTimeout(() => glitchDecode(link), 100 + i * 70);
        });
    }

    // Lock scroll when menu is open
    if (document.body.style.overflow === 'hidden') {
        document.body.style.overflow = '';
    } else {
        document.body.style.overflow = 'hidden';
    }
});

// Close menu when a link is clicked (but not dropdown triggers)
mobileLinks.forEach(link => {
    link.addEventListener('click', () => {
        if (link.classList.contains('dropdown-trigger')) return;
        mobileToggle.classList.remove('active');
        mobileOverlay.classList.remove('active');
        document.body.style.overflow = '';
    });
});

// Close menu when CTA is clicked
const mobileCta = mobileOverlay.querySelector('.mobile-menu-cta a');
if (mobileCta) {
    mobileCta.addEventListener('click', () => {
        mobileToggle.classList.remove('active');
        mobileOverlay.classList.remove('active');
        document.body.style.overflow = '';
    });
}

// Floating CTA — show only after scrolling past the hero
const floatingCta = document.getElementById('floating-cta');
if (floatingCta) {
    ScrollTrigger.create({
        trigger: '.hero-massive',
        start: 'bottom 80%',
        onEnter: () => floatingCta.classList.add('visible'),
        onLeaveBack: () => floatingCta.classList.remove('visible'),
    });
}

// FAQ Accordion Animation
const faqDetails = document.querySelectorAll('.faq-item details');

faqDetails.forEach(detail => {
    const summary = detail.querySelector('summary');
    const content = detail.querySelector('.console-response') || detail.querySelector('.faq-answer');

    if (!summary || !content) return;

    summary.addEventListener('click', (e) => {
        e.preventDefault();

        if (detail.hasAttribute('open')) {
            // Closing
            gsap.to(content, {
                height: 0,
                opacity: 0,
                paddingTop: 0,
                paddingBottom: 0,
                marginTop: 0,
                marginBottom: 0,
                duration: 0.3,
                ease: "power2.in",
                onComplete: () => {
                    detail.removeAttribute('open');
                    gsap.set(content, { clearProps: 'all' });
                }
            });
        } else {
            // Opening
            detail.setAttribute('open', '');

            // Animate FROM 0 to current (already rendered) natural state
            gsap.from(content, {
                height: 0,
                opacity: 0,
                paddingTop: 0,
                paddingBottom: 0,
                marginTop: 0,
                marginBottom: 0,
                duration: 0.3,
                ease: "power2.out",
                // clearProps not needed for 'from' as it reverts to natural style at end naturally?
                // Actually 'from' leaves inline styles unless clearProps is used or we rely on it ending at natural.
                // Safest to clearProps at end to remove inline overrides.
                onComplete: () => {
                    gsap.set(content, { clearProps: 'all' });
                }
            });
        }
    });
});

// Schedule Tab Switching Logic
const scheduleTabs = document.querySelectorAll('.tab-btn');
const scheduleDays = document.querySelectorAll('.schedule-day');

if (scheduleTabs.length > 0) {
    scheduleTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all tabs
            scheduleTabs.forEach(t => t.classList.remove('active'));
            // Add active class to clicked tab
            tab.classList.add('active');

            const targetId = tab.getAttribute('data-target');

            // Hide all days
            scheduleDays.forEach(day => {
                day.classList.remove('active');
                day.style.display = 'none';
                day.style.opacity = '0';
            });

            // Show target day with animation
            const targetDay = document.getElementById(targetId);
            if (targetDay) {
                targetDay.style.display = 'block';
                // Small delay to allow display block to take effect before opacity transition
                setTimeout(() => {
                    targetDay.classList.add('active');
                    targetDay.style.opacity = '1';

                    // Refresh ScrollTrigger since content height changed
                    ScrollTrigger.refresh();
                }, 50);
            }
        });
    });
}


// --- Schedule: Dynamic Active Event Highlighter ---
function updateTimeIndicator() {
    // Real 2027 event days are not published yet, so no agenda row should appear live.
    document.querySelectorAll('.active-now').forEach(el => el.classList.remove('active-now'));
}

// Run on load and every minute
window.addEventListener('load', updateTimeIndicator);
setInterval(updateTimeIndicator, 60000);


// =========================================
// PRIZE HYBRID LOGIC
// =========================================
const hybridNavItems = document.querySelectorAll('.hybrid-nav-item');
const hybridGroups = document.querySelectorAll('.hybrid-category-group');

// Category Switching
if (hybridNavItems.length > 0) {
    hybridNavItems.forEach(item => {
        item.setAttribute('role', 'button');
        item.setAttribute('tabindex', '0');

        const activateHybridGroup = () => {
            // Deactivate all
            hybridNavItems.forEach(nav => nav.classList.remove('active'));
            hybridGroups.forEach(group => group.classList.remove('active'));

            // Activate clicked
            item.classList.add('active');
            const targetId = item.getAttribute('data-cat');
            const targetGroup = document.getElementById(targetId);
            if (targetGroup) {
                targetGroup.classList.add('active');
            }
        };

        item.addEventListener('click', activateHybridGroup);
        item.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                activateHybridGroup();
            }
        });
    });
}

// Collapsible Rows Logic
const archiveRows = document.querySelectorAll('.archive-row');
if (archiveRows.length > 0) {
    archiveRows.forEach(row => {
        const summary = row.querySelector('.row-summary');
        if (summary) {
            summary.setAttribute('role', 'button');
            summary.setAttribute('tabindex', '0');
            summary.setAttribute('aria-expanded', row.classList.contains('active') ? 'true' : 'false');

            const toggleArchiveRow = () => {
                // Toggle current
                row.classList.toggle('active');
                summary.setAttribute('aria-expanded', row.classList.contains('active') ? 'true' : 'false');
            };

            summary.addEventListener('click', toggleArchiveRow);
            summary.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    toggleArchiveRow();
                }
            });
        }
    });
}
