import { test, expect } from '@playwright/test';

/**
 * Search & Evaluation smoke, signed out. Runs against a build where the
 * module is on (NEXT_PUBLIC_RADAR_ENABLED=true, or development with the flag
 * unset). Signed-in flows (feed → brief → watch → watchlist → export) need a
 * Pro session and run manually before the flag flip; see
 * docs/asset-radar-gap-register.md.
 */

test.describe('Search & Evaluation (signed out)', () => {
  test('public landing page renders with its FAQ schema', async ({ page }) => {
    const res = await page.goto('/search-and-evaluation');
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1')).toContainText(/Search & Evaluation/i);
    await expect(page).toHaveTitle(/Search & Evaluation/i);
    const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(ld.some(t => t.includes('FAQPage'))).toBe(true);
    expect(ld.some(t => t.includes('SoftwareApplication'))).toBe(true);
  });

  test('feed shows the upgrade gate, not live rows', async ({ page }) => {
    const res = await page.goto('/radar');
    expect([200, 404]).toContain(res?.status());
    if (res?.status() === 404) test.skip(true, 'module is off in this build');
    await expect(page.locator('h1')).toContainText('Search & Evaluation');
    await expect(page.getByText('Pro and Portfolio')).toBeVisible();
    await expect(page.locator('table tbody tr').first()).toContainText('Example asset');
  });

  test('watchlist, alerts and methodology ask to sign in', async ({ page }) => {
    for (const path of ['/radar/watchlist', '/radar/alerts']) {
      const res = await page.goto(path);
      if (res?.status() === 404) test.skip(true, 'module is off in this build');
      await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
      await expect(page.getByRole('navigation', { name: /sections/i })).toBeVisible();
    }
    const res = await page.goto('/radar/methodology');
    if (res?.status() === 404) test.skip(true, 'module is off in this build');
    await expect(page.locator('h1')).toBeVisible();
  });

  test('acquirer view and mandate pages are gated', async ({ page }) => {
    const res = await page.goto('/radar/acquirers');
    if (res?.status() === 404) test.skip(true, 'module is off in this build');
    await expect(page.getByText('Pro and Portfolio')).toBeVisible();
    const bad = await page.goto('/radar/mandates/not-a-uuid');
    expect(bad?.status()).toBe(404);
  });

  test('Radar APIs reject anonymous callers', async ({ request }) => {
    for (const path of ['/api/radar/feed', '/api/radar/facets', '/api/radar/watchlist', '/api/radar/alerts', '/api/radar/acquirer-view?top=5', '/api/radar/views']) {
      const res = await request.get(path);
      expect([401, 403], path).toContain(res.status());
    }
    const patch = await request.patch('/api/radar/mandates/0b8f6a3e-1111-4222-8333-444455556666/matches', { data: { all: true, is_read: true } });
    expect([401, 403]).toContain(patch.status());
  });

  test('brief and feed are not indexable', async ({ page }) => {
    const res = await page.goto('/radar');
    if (res?.status() === 404) test.skip(true, 'module is off in this build');
    const robots = await page.locator('meta[name="robots"]').getAttribute('content');
    expect(robots ?? '').toMatch(/noindex/);
  });
});
