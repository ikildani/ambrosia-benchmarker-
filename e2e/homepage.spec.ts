import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test('should load and display hero section', async ({ page }) => {
    await page.goto('/');

    // Hero heading visible
    await expect(page.locator('h1')).toBeVisible();

    // CTA button visible
    const ctaLink = page.getByRole('link', { name: /get full analysis|try.*calculator|start/i });
    await expect(ctaLink.first()).toBeVisible();
  });

  test('should navigate to calculator from CTA', async ({ page }) => {
    await page.goto('/');

    // Click first calculator CTA
    const ctaLink = page.getByRole('link', { name: /get full analysis|try.*calculator/i });
    await ctaLink.first().click();

    // Should navigate to calculator page
    await expect(page).toHaveURL(/\/calculator/);
  });

  test('should have correct meta title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/ambrosia|biopharma|deal/i);
  });

  test('should have skip to content link', async ({ page }) => {
    await page.goto('/');
    const skipLink = page.getByRole('link', { name: /skip to/i });
    await expect(skipLink).toBeAttached();
  });
});

test.describe('Homepage - Live Demo', () => {
  test('should show live demo section with dropdowns', async ({ page }) => {
    await page.goto('/');

    // Scroll to demo section
    const demoSection = page.locator('#live-demo, section:has-text("Live Demo")').first();
    if (await demoSection.isVisible()) {
      // Should have phase, modality, indication selects
      const selects = page.locator('select');
      expect(await selects.count()).toBeGreaterThanOrEqual(3);
    }
  });
});
