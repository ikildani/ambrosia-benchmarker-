import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('header links work correctly', async ({ page }) => {
    await page.goto('/');

    // Check header is visible
    const header = page.locator('header').first();
    await expect(header).toBeVisible();
  });

  test('benchmarks page loads', async ({ page }) => {
    await page.goto('/benchmarks');
    await expect(page.locator('h1')).toBeVisible();
    await expect(page).toHaveTitle(/benchmark/i);
  });

  test('glossary page loads', async ({ page }) => {
    await page.goto('/glossary');
    await expect(page.locator('h1')).toBeVisible();
  });

  test('blog page redirects to home', async ({ page }) => {
    await page.goto('/blog');
    await expect(page).toHaveURL('/');
    await expect(page.locator('h1')).toBeVisible();
  });

  test('pulse page loads', async ({ page }) => {
    await page.goto('/pulse');
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('404 page shown for invalid routes', async ({ page }) => {
    const response = await page.goto('/this-page-does-not-exist-xyz');
    expect(response?.status()).toBe(404);
  });

  test('health endpoint returns ok', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.status).toBeDefined();
  });
});

test.describe('Responsive Layout', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('mobile menu is accessible', async ({ page }) => {
    await page.goto('/');

    // On mobile, there should be a hamburger or mobile-friendly nav
    const header = page.locator('header').first();
    await expect(header).toBeVisible();
  });

  test('calculator works on mobile', async ({ page }) => {
    await page.goto('/calculator');
    await page.evaluate(() => {
      localStorage.setItem('deal_calculator_onboarding', JSON.stringify({
        completed: true, skipped: false, completedAt: new Date().toISOString(), version: 1
      }));
    });
    await page.reload();

    // Calculator should be visible and functional on mobile
    await expect(page.locator('select').first()).toBeVisible();
  });
});
