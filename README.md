# AITECHOM homepage

Homepage for AITECHOM (Artificial Intelligence Technology, Oman): a light, glassmorphism UI with a 3D NAO-style humanoid robot that turns as you scroll while the hero copy slides in from both sides. English and Arabic (RTL).

Content and imagery come from the current aitech.om site. This repository does not deploy anywhere and does not touch the live site.

## Commands

```bash
npm ci            # install
npm run dev       # local dev server with hot reload
npm run build     # production build into dist/
npm run preview   # serve dist/ on http://localhost:4173
npm test          # build + Playwright end-to-end tests (desktop + mobile)
```

First test run only: `npx playwright install chromium`.

`dist/` is a plain static site (relative paths) that can be hosted anywhere.

## Stack

- [Vite](https://vite.dev) for dev server and bundling
- [Three.js](https://threejs.org) for the procedural robot (`src/robot.js`, no model files)
- [GSAP ScrollTrigger](https://gsap.com/docs/v3/Plugins/ScrollTrigger/) for the pinned hero choreography and reveals

## Structure

| Path | What it is |
| --- | --- |
| `index.html` | Page markup; English copy lives here |
| `src/main.js` | Entry: robot setup, scroll choreography, reveals, tabs, marquee, mobile menu |
| `src/robot.js` | Procedural Three.js humanoid with idle, look-at, wave and blink animation |
| `src/i18n.js` | EN/AR switcher (Arabic copy is a draft translation to be reviewed); `?lang=ar` supported |
| `src/styles.css` | Design tokens (palette at the top), glass components, layout, responsive and RTL rules |
| `assets/img/` | Logo and product/project photos from aitech.om (WebP) |
| `tests/` | Playwright end-to-end tests run against the production build |

## Tests

They check: no console/page errors and every asset resolving; the WebGL robot rendering and animating; the scroll choreography (robot turns, copy enters from both sides in two phases, pin releases); rendering pausing off-screen; the EN/AR switch (RTL, full translation coverage, saved choice, `?lang=ar`); solutions tabs (mouse and keyboard); the 16-product marquee; no horizontal overflow in either language; the mobile menu; reduced-motion layout; and the no-WebGL fallback. CI runs build + tests on every pull request.

## Theming

Colours are CSS custom properties at the top of `src/styles.css`. The robot reads `--robot-shell`, `--robot-joint`, `--robot-accent` and `--robot-glow`.
