import './styles.css';
import './i18n.js'; // applies a saved/requested language before the animations are built
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { createRobotScene } from './robot.js';

gsap.registerPlugin(ScrollTrigger);

const root = document.documentElement;
const reducedMotion = root.classList.contains('rm');
const dirSign = () => (root.dir === 'rtl' ? -1 : 1);

/* ---------- 3D robot ---------- */
let robot = null;
const canvas = document.getElementById('robot-canvas');
try {
  robot = createRobotScene(canvas);
} catch (err) {
  // No WebGL: show the product photo instead.
  canvas.hidden = true;
  document.querySelector('.robot-fallback').hidden = false;
}

window.__aitech = { robot };

if (robot) {
  if (!reducedMotion) setTimeout(() => robot.wave(), 900);
  // Pinning re-parents the stage, which can queue a stale "not intersecting"
  // entry ahead of the current one, so always act on the latest entry.
  new IntersectionObserver((entries) => {
    if (entries[entries.length - 1].isIntersecting) robot.resume();
    else robot.pause();
  }).observe(document.querySelector('.hero-stage'));
}

/* ---------- Hero scroll choreography ---------- */
if (!reducedMotion) {
  const proxy = { p: 0 };
  let waved = false;

  const tl = gsap.timeline({
    defaults: { ease: 'power2.out' },
    scrollTrigger: {
      trigger: '.hero',
      start: 'top top',
      end: '+=260%',
      pin: '.hero-stage',
      scrub: 0.8,
      invalidateOnRefresh: true,
      onUpdate(self) {
        if (self.progress > 0.93 && !waved) { waved = true; robot?.wave(); }
        if (self.progress < 0.8) waved = false;
      },
    },
  });

  tl.to(proxy, { p: 1, duration: 10, ease: 'none', onUpdate: () => robot?.setProgress(proxy.p) }, 0)
    .to('.hero-progress span', { scaleX: 1, duration: 10, ease: 'none' }, 0)
    .to('.hero-intro', { autoAlpha: 0, y: -30, duration: 1.2 }, 0)
    .to('.scroll-cue', { autoAlpha: 0, duration: 0.6 }, 0)
    .to('.hero-word', { scale: 1.18, opacity: 0.5, duration: 10, ease: 'none' }, 0)

    // Phase 1: headline from the start side, supporting copy from the end side.
    .fromTo('.phase-1 .side-start', { x: () => -160 * dirSign(), autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 1.6 }, 0.8)
    .fromTo('.phase-1 .side-end', { x: () => 160 * dirSign(), autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 1.6 }, 1.0)
    .to('.phase-1 .side-start', { x: () => -90 * dirSign(), autoAlpha: 0, duration: 1.2, ease: 'power2.in' }, 4.3)
    .to('.phase-1 .side-end', { x: () => 90 * dirSign(), autoAlpha: 0, duration: 1.2, ease: 'power2.in' }, 4.3)

    // Phase 2: stats and call to action.
    .fromTo('.phase-2 .side-start', { x: () => -160 * dirSign(), autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 1.6 }, 5.7)
    .fromTo('.phase-2 .side-end', { x: () => 160 * dirSign(), autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 1.6 }, 5.9)
    .fromTo('.phase-2 .stat', { y: 24 }, { y: 0, stagger: 0.2, duration: 1.2 }, 5.9)
    .to({}, { duration: 1.5 }); // hold the final frame before unpinning

}

/* ---------- Section reveals ---------- */
if (!reducedMotion) {
  const from = (el) => {
    const kind = el.dataset.reveal;
    if (kind === 'start') return { x: -60 * dirSign(), y: 0 };
    if (kind === 'end') return { x: 60 * dirSign(), y: 0 };
    return { x: 0, y: 40 };
  };
  document.querySelectorAll('[data-reveal]').forEach((el) => gsap.set(el, from(el)));
  ScrollTrigger.batch('[data-reveal]', {
    start: 'top 88%',
    once: true,
    onEnter: (els) => gsap.to(els, { autoAlpha: 1, x: 0, y: 0, duration: 1, ease: 'power3.out', stagger: 0.08 }),
  });
}

document.addEventListener('langchange', () => ScrollTrigger.refresh());

/* ---------- Solutions tabs ---------- */
const tabs = [...document.querySelectorAll('.tabs [role="tab"]')];
function selectTab(tab) {
  tabs.forEach((t) => {
    const on = t === tab;
    t.setAttribute('aria-selected', on);
    t.tabIndex = on ? 0 : -1;
  });
  document.querySelectorAll('.tab-panel').forEach((p) => p.classList.toggle('active', p.dataset.panel === tab.dataset.tab));
}
tabs.forEach((t, i) => {
  t.tabIndex = i === 0 ? 0 : -1;
  t.addEventListener('click', () => selectTab(t));
  t.addEventListener('keydown', (e) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (!step) return;
    const next = tabs[(i + step * dirSign() + tabs.length) % tabs.length];
    next.focus();
    selectTab(next);
  });
});

/* ---------- Products marquee (duplicate for a seamless loop) ---------- */
const track = document.querySelector('.marquee-track');
if (track && !reducedMotion) {
  [...track.children].forEach((c) => {
    const clone = c.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    track.appendChild(clone);
  });
}

/* ---------- Mobile menu ---------- */
const menuBtn = document.getElementById('menu-btn');
const links = document.getElementById('nav-links');
menuBtn?.addEventListener('click', () => {
  const open = menuBtn.getAttribute('aria-expanded') !== 'true';
  menuBtn.setAttribute('aria-expanded', open);
  links.classList.toggle('open', open);
});
links?.addEventListener('click', (e) => {
  if (e.target.closest('a')) {
    menuBtn.setAttribute('aria-expanded', 'false');
    links.classList.remove('open');
  }
});
