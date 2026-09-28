// @ts-check
import { test, expect } from '@playwright/test';

const isMobile = (testInfo) => testInfo.project.name === 'mobile';

/** Collect console errors, page errors and failed same-origin requests. */
function trackErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  // "Failed to load resource" carries no URL; local failures are caught by URL below,
  // and third-party ones (Google Fonts) must not fail the build.
  page.on('console', (m) => { if (m.type() === 'error' && !/^Failed to load resource/.test(m.text())) errors.push(`console: ${m.text()}`); });
  page.on('requestfailed', (r) => { if (r.url().startsWith('http://localhost')) errors.push(`requestfailed: ${r.url()}`); });
  page.on('response', (r) => { if (r.url().startsWith('http://localhost') && r.status() >= 400) errors.push(`${r.status()}: ${r.url()}`); });
  return errors;
}

/** Scroll in small instant steps so ScrollTrigger sees every position, then let the scrub settle. */
async function scrollToY(page, y, settle = 2000) {
  await page.evaluate(async (target) => {
    const start = window.scrollY;
    for (let i = 1; i <= 12; i++) {
      window.scrollTo({ top: start + ((target - start) * i) / 12, behavior: 'instant' });
      await new Promise((r) => setTimeout(r, 30));
    }
  }, y);
  await page.waitForTimeout(settle);
}

/**
 * Scroll a section to the top of the viewport. Used instead of scrollIntoViewIfNeeded,
 * which waits for the element to be "stable" and can stall while GSAP is animating it.
 */
async function scrollToSection(page, selector, settle) {
  const y = await page.locator(selector).evaluate((el) => Math.round(el.getBoundingClientRect().top + window.scrollY));
  await scrollToY(page, y, settle);
}

/** Scroll to a fraction of the pinned hero's scroll distance (end: '+=260%'). */
const scrollHero = (page, fraction) =>
  page.evaluate(() => window.innerHeight).then((h) => scrollToY(page, Math.round(fraction * 2.6 * h)));

const opacity = (locator) => locator.evaluate((el) => Number(getComputedStyle(el).opacity));
/** Poll until the scrubbed timeline settles (software WebGL can make frames slow). */
const expectOpacity = (locator, cmp, value) =>
  expect.poll(() => opacity(locator), { timeout: 10_000 })[cmp](value);
const robotDebug = (page) => page.evaluate(() => window.__aitech?.robot?.debug());

test('loads with no errors and every local asset resolves', async ({ page, request }) => {
  const errors = trackErrors(page);
  await page.goto('/', { waitUntil: 'load' });
  await expect(page).toHaveTitle(/AITECHOM/);
  await expect(page.locator('h1')).toHaveText('We find and develop innovative solutions');

  const srcs = await page.$$eval('img', (imgs) => [...new Set(imgs.map((i) => i.getAttribute('src')))]);
  expect(srcs.length).toBeGreaterThan(20);
  for (const src of srcs) {
    const res = await request.get(src);
    expect(res.status(), src).toBe(200);
  }
  const hrefs = await page.$$eval('link[rel="icon"], link[rel="stylesheet"]:not([href^="http"]), script[src]', (els) =>
    els.map((e) => e.getAttribute('href') || e.getAttribute('src')));
  for (const href of hrefs) expect((await request.get(href)).status(), href).toBe(200);

  await page.waitForTimeout(1500);
  expect(errors).toEqual([]);
});

test('in-page navigation links all have a target section', async ({ page }) => {
  await page.goto('/');
  const targets = await page.$$eval('a[href^="#"]', (as) => as.map((a) => a.getAttribute('href')).filter((h) => h.length > 1));
  expect(targets.length).toBeGreaterThan(5);
  for (const id of new Set(targets)) await expect(page.locator(id)).toHaveCount(1);
  expect(await page.locator('a[href="mailto:info@aitech.om"]').count()).toBeGreaterThan(0);
  expect(await page.locator('a[href="tel:+96899701619"]').count()).toBeGreaterThan(0);
});

test('3D robot renders with WebGL and keeps animating', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#robot-canvas')).toBeVisible();
  await expect(page.locator('.robot-fallback')).toBeHidden();

  await page.waitForTimeout(1000);
  const a = await robotDebug(page);
  expect(a, 'robot scene should exist').toBeTruthy();
  expect(a.triangles).toBeGreaterThan(5000);
  await expect.poll(async () => (await robotDebug(page)).frames, { timeout: 10_000 }).toBeGreaterThan(a.frames);
  expect(Math.abs((await robotDebug(page)).rotationY)).toBeLessThan(0.05); // facing the visitor before scrolling
});

test('scrolling the hero turns the robot and brings copy in from both sides', async ({ page }, testInfo) => {
  test.slow(); // walks through every scroll phase; software WebGL on CI runners is slow
  await page.goto('/');
  await page.waitForTimeout(800);

  const p1Start = page.locator('.phase-1 .side-start');
  const p1End = page.locator('.phase-1 .side-end');
  const p2Start = page.locator('.phase-2 .side-start');
  const p2End = page.locator('.phase-2 .side-end');

  // Top: intro visible, both copy phases hidden.
  await expect(page.locator('.hero-intro')).toBeVisible();
  await expectOpacity(p1Start, 'toBe', 0);
  await expectOpacity(p2Start, 'toBe', 0);
  const canvasTop = await page.locator('#robot-canvas').screenshot();

  // Phase 1.
  await scrollHero(page, 0.3);
  await expectOpacity(p1Start, 'toBeGreaterThan', 0.95);
  await expectOpacity(p1End, 'toBeGreaterThan', 0.95);
  await expect(page.locator('.hero-stage')).toBeInViewport(); // pinned, not scrolled away
  await expect.poll(async () => (await robotDebug(page)).rotationY, { timeout: 10_000 }).toBeGreaterThan(1);
  const canvasTurned = await page.locator('#robot-canvas').screenshot();
  expect(canvasTurned.equals(canvasTop)).toBe(false);

  if (!isMobile(testInfo)) {
    // Desktop: headline on the left, supporting copy on the right, robot between them.
    const vw = page.viewportSize().width;
    const left = await p1Start.boundingBox();
    const right = await p1End.boundingBox();
    expect(left.x + left.width).toBeLessThan(vw / 2);
    expect(right.x).toBeGreaterThan(vw / 2);
  }

  // Phase 2 replaces phase 1.
  await scrollHero(page, 0.78);
  await expectOpacity(p1Start, 'toBeLessThan', 0.05);
  await expectOpacity(p2Start, 'toBeGreaterThan', 0.95);
  await expectOpacity(p2End, 'toBeGreaterThan', 0.95);
  await expect(page.getByRole('link', { name: 'Explore solutions' })).toBeInViewport();

  // End of the pin: full turn, facing the visitor again.
  await scrollHero(page, 1.0);
  await expect.poll(async () => (await robotDebug(page)).progress, { timeout: 10_000 }).toBeCloseTo(1, 2);
  await expect.poll(async () => (await robotDebug(page)).rotationY, { timeout: 10_000 }).toBeCloseTo(Math.PI * 2, 1);

  // After the pin the page continues into the About section.
  await scrollToSection(page, '#about');
  await page.waitForTimeout(1500);
  await expect(page.locator('#about h2')).toBeInViewport();
  await expectOpacity(page.locator('#about [data-reveal]').first(), 'toBeGreaterThan', 0.95);
});

test('robot rendering pauses once the hero is off screen', async ({ page }) => {
  await page.goto('/');
  await scrollToSection(page, '#contact');
  await page.waitForTimeout(1500);
  const a = await robotDebug(page);
  await page.waitForTimeout(800);
  const b = await robotDebug(page);
  expect(a.running).toBe(false);
  expect(b.frames).toBe(a.frames);
});

test('language switch flips to Arabic RTL and back', async ({ page }) => {
  await page.goto('/');
  const btn = page.locator('#lang-btn');
  await expect(btn).toHaveText('عربي');

  await btn.click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await expect(page.locator('h1')).toHaveText('نبتكر ونطوّر حلولًا مبتكرة');
  await expect(page.locator('[data-i18n="nav.cta"]')).toHaveText('اطلب عرضًا تجريبيًا');
  await expect(btn).toHaveText('EN');

  // Every translatable node has an Arabic string (none left in English by mistake).
  const untranslated = await page.$$eval('[data-i18n]', (els) =>
    els.filter((e) => !/[؀-ۿ]/.test(e.textContent) && !/^[\d\s©.—-]*$/.test(e.textContent))
      .map((e) => e.dataset.i18n));
  expect(untranslated).toEqual([]);

  // Preference survives a reload.
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

  await page.locator('#lang-btn').click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.locator('h1')).toHaveText('We find and develop innovative solutions');
});

test('?lang=ar opens the Arabic version directly and the hero still works', async ({ page }) => {
  await page.goto('/?lang=ar');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await scrollHero(page, 0.3);
  await expectOpacity(page.locator('.phase-1 .side-start'), 'toBeGreaterThan', 0.95);
  await expect.poll(async () => (await robotDebug(page)).rotationY, { timeout: 10_000 }).toBeGreaterThan(1);
});

test('solutions tabs switch panels by click and keyboard', async ({ page }) => {
  await page.goto('/');
  await scrollToSection(page, '#solutions');
  await page.waitForTimeout(1200);

  const health = page.locator('[data-panel="health"]');
  const edu = page.locator('[data-panel="edu"]');
  await expect(health).toBeVisible();
  await expect(edu).toBeHidden();

  await page.getByRole('tab', { name: 'Education' }).click();
  await expect(edu).toBeVisible();
  await expect(health).toBeHidden();
  await expect(page.getByRole('tab', { name: 'Education' })).toHaveAttribute('aria-selected', 'true');
  await expect(edu.getByText('NAO', { exact: true })).toBeVisible();

  await page.keyboard.press('ArrowRight');
  await expect(page.locator('[data-panel="retail"]')).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Retail & hospitality' })).toBeFocused();
});

test('products marquee lists all 16 products', async ({ page }) => {
  await page.goto('/');
  const names = await page.$$eval('.marquee-track .product:not([aria-hidden]) figcaption', (els) => els.map((e) => e.textContent.trim()));
  expect(names).toHaveLength(16);
  expect(names).toEqual(expect.arrayContaining(['NAO', 'Pepper', 'temi', 'UVD Robot', 'Ned2', 'SwiftBot']));
});

test('no horizontal overflow in English or Arabic', async ({ page }) => {
  for (const url of ['/', '/?lang=ar']) {
    await page.goto(url);
    await page.waitForTimeout(800);
    for (const sel of ['#about', '#services', '#solutions', '#products', '#projects', '#events', '#contact']) {
      await scrollToSection(page, sel, 300); // only needs the reveals to fire
    }
    await page.waitForTimeout(1200);
    const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    expect(sw, url).toBeLessThanOrEqual(cw);
  }
});

test('mobile menu opens, navigates and closes', async ({ page }, testInfo) => {
  test.skip(!isMobile(testInfo), 'mobile only');
  await page.goto('/');
  const menu = page.locator('#menu-btn');
  const links = page.locator('#nav-links');
  await expect(menu).toBeVisible();
  await expect(links).not.toHaveClass(/open/);

  await menu.click();
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  await expect(links).toHaveClass(/open/);
  await links.getByRole('link', { name: 'Contact' }).click();
  await expect(links).not.toHaveClass(/open/);
  await page.waitForTimeout(1500);
  await expect(page.locator('#contact h2')).toBeInViewport();
});

test('reduced motion shows a static hero with all copy visible', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveClass(/rm/);
  await expect(page.locator('.pin-spacer')).toHaveCount(0);
  await expect(page.locator('.phase-1 .side-start')).toBeVisible();
  await expect(page.locator('.phase-2 .stats')).toBeVisible();
  await expect(page.locator('#services [data-reveal]').first()).toBeVisible();
});

test('falls back to a product photo when WebGL is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
      if (/webgl/.test(type)) return null;
      return orig.call(this, type, ...rest);
    };
  });
  const errors = trackErrors(page);
  await page.goto('/');
  await expect(page.locator('.robot-fallback')).toBeVisible();
  await expect(page.locator('#robot-canvas')).toBeHidden();
  await scrollHero(page, 0.3);
  await expectOpacity(page.locator('.phase-1 .side-start'), 'toBeGreaterThan', 0.95);
  expect(errors.filter((e) => e.startsWith('pageerror'))).toEqual([]);
});
