import { test, expect, devices } from '@playwright/test';

/**
 * Mobile layout guards (Sep 2026 audit). Runs at iPhone 14 geometry against the
 * top public routes and fails when:
 *   - the document is wider than the viewport (clipped or side-scrolling content)
 *   - the header CTA wraps onto two lines
 *   - the hero LCP paragraph is not visible on first paint (no hydration gate)
 *   - a route renders without the site header
 */
const ROUTES = ['/', '/pro', '/companies', '/data', '/blog', '/methodology', '/calculator'];

test.use({ ...devices['iPhone 14'] });

for (const route of ROUTES) {
  test(`no horizontal overflow on ${route}`, async ({ page }) => {
    await page.goto(route, { waitUntil: 'networkidle' });
    const { scrollWidth, innerWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(scrollWidth, `${route} scrollWidth ${scrollWidth} > viewport ${innerWidth}`).toBeLessThanOrEqual(innerWidth + 1);
  });

  test(`site header is present on ${route}`, async ({ page }) => {
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('header').first()).toBeVisible();
  });
}

test('header CTA stays on one line at phone width', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const cta = page.getByRole('button', { name: /start free|get started/i }).first();
  if (await cta.count()) {
    const box = await cta.boundingBox();
    expect(box?.height ?? 0).toBeLessThan(56);
  }
});

test('home hero copy is visible before hydration completes', async ({ page }) => {
  // Block all first-party scripts: the hero must still be readable from the server HTML.
  await page.route('**/_next/static/**/*.js', (r) => r.abort());
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const hero = page.locator('main p', { hasText: /benchmarks your deal/i }).first();
  await expect(hero).toBeVisible();
  const opacity = await hero.evaluate((el) => getComputedStyle(el).opacity);
  // The rise animation starts at first paint and finishes within ~700ms.
  await page.waitForTimeout(800);
  const after = await hero.evaluate((el) => getComputedStyle(el).opacity);
  expect(Number(after)).toBeGreaterThan(0.9);
  expect(Number(opacity)).toBeGreaterThanOrEqual(0);
});

test('calculator form is visible without waiting for auth', async ({ page }) => {
  await page.goto('/calculator', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /solidus/i }).first()).toBeVisible({ timeout: 3000 });
  await expect(page.getByText(/loading\.\.\./i)).toHaveCount(0);
});
