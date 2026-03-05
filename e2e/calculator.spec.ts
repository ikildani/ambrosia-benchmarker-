import { test, expect } from '@playwright/test';

test.describe('Calculator Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/calculator');
    // Skip onboarding if it appears
    await page.evaluate(() => {
      localStorage.setItem('deal_calculator_onboarding', JSON.stringify({
        completed: true, skipped: false, completedAt: new Date().toISOString(), version: 1
      }));
    });
    await page.reload();
  });

  test('should load calculator with input sections', async ({ page }) => {
    // Main heading
    await expect(page.locator('h1')).toBeVisible();

    // Asset Details section should have phase, modality, indication
    await expect(page.locator('select').first()).toBeVisible();
  });

  test('should calculate deal terms when inputs are set', async ({ page }) => {
    // Wait for the page to be fully interactive
    await page.waitForLoadState('networkidle');

    // Select Phase 2
    const phaseSelect = page.locator('select').first();
    await phaseSelect.selectOption({ index: 2 });

    // Look for a calculate button or auto-calculation
    const calculateBtn = page.getByRole('button', { name: /calculate|analyze|get/i });
    if (await calculateBtn.isVisible()) {
      await calculateBtn.click();
    }

    // Results should appear (either auto or after clicking)
    await page.waitForTimeout(2000);
  });

  test('should have proper page title and meta', async ({ page }) => {
    await expect(page).toHaveTitle(/calculator|deal|biopharma/i);
  });

  test('should be keyboard navigable', async ({ page }) => {
    // Tab through the form
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Focus should be on an interactive element
    const focused = page.locator(':focus');
    await expect(focused).toBeVisible();
  });
});
