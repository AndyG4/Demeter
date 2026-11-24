import { prefersReducedMotion } from "./utils/motion.js";

export function initAnimations() {
  if (!window.gsap || prefersReducedMotion()) {
    return;
  }
  const { gsap } = window;
  if (window.ScrollTrigger) {
    gsap.registerPlugin(window.ScrollTrigger);
  }

  const timeline = gsap.timeline({ defaults: { ease: "power3.out" } });
  timeline
    .from(".site-header", { y: -14, opacity: 0, duration: 0.45 })
    .from(".hero__eyebrow", { y: 10, opacity: 0, duration: 0.5 }, "-=0.2")
    .from(".js-hero-line", { yPercent: 112, duration: 0.9, stagger: 0.08 }, "-=0.25")
    .from(".hero__lead", { y: 14, opacity: 0, duration: 0.6 }, "-=0.55")
    .from(".hero__actions", { y: 12, opacity: 0, duration: 0.55 }, "-=0.45")
    .from(".hero__card", { y: 22, opacity: 0, duration: 0.75 }, "-=0.6")
    .from(".hero__meta", { opacity: 0, duration: 0.5 }, "-=0.45");

  if (window.ScrollTrigger) {
    for (const element of gsap.utils.toArray(".reveal")) {
      gsap.from(element, {
        y: 26,
        opacity: 0,
        duration: 0.75,
        ease: "power3.out",
        scrollTrigger: {
          trigger: element,
          start: "top 84%",
          once: true,
        },
      });
    }
  }
}

export function animateResults(container) {
  if (!window.gsap || prefersReducedMotion()) return;
  const cards = container.querySelectorAll(".result-card");
  if (!cards.length) return;
  window.gsap.from(cards, {
    y: 8,
    opacity: 0,
    duration: 0.3,
    stagger: 0.03,
    ease: "power2.out",
  });
}

export function refreshScrollTriggers() {
  if (window.ScrollTrigger) {
    window.ScrollTrigger.refresh();
  }
}
