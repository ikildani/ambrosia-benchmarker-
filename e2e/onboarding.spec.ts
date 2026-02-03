import { test, expect } from '@playwright/test';

test.describe('Guided Onboarding Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear onboarding state before each test
    await page.goto('/calculator');
    await page.evaluate(() => {
      localStorage.removeItem('deal_calculator_onboarding');
    });
  });

  test('should show onboarding modal for first-time users', async ({ page }) => {
    await page.reload();

    // Wait for the onboarding modal to appear (500ms delay + render time)
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 3000 });

    // Verify welcome step content (use h2 selector to avoid matching sr-only h1)
    await expect(modal.locator('h2', { hasText: 'Get deal terms in 60 seconds' })).toBeVisible();
    await expect(modal.getByRole('button', { name: /show me how it works/i })).toBeVisible();
    await expect(modal.getByRole('button', { name: /skip tutorial/i })).toBeVisible();
  });

  test('should complete full onboarding flow', async ({ page }) => {
    await page.reload();

    // Step 1: Welcome
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 3000 });
    await expect(modal.locator('h2', { hasText: 'Get deal terms in 60 seconds' })).toBeVisible();

    // Click "Show me how it works"
    await modal.getByRole('button', { name: /show me how it works/i }).click();

    // Step 2: Big Three
    await expect(modal.getByText('Step 1 of 3', { exact: true })).toBeVisible();
    await expect(modal.locator('h3', { hasText: /these 3 inputs drive 70% of deal value/i })).toBeVisible();
    await expect(modal.getByText('The Big Three')).toBeVisible();

    // Verify spotlight highlight is applied to Asset Details section
    const spotlightElement = page.locator('.onboarding-spotlight');
    await expect(spotlightElement).toBeVisible();

    // Click Next
    await modal.getByRole('button', { name: /next/i }).click();

    // Step 3: Value Modifiers
    await expect(modal.getByText('Step 2 of 3', { exact: true })).toBeVisible();
    await expect(modal.locator('h3', { hasText: /these inputs adjust your baseline/i })).toBeVisible();
    await expect(modal.getByText('Value Modifiers')).toBeVisible();
    await expect(modal.getByText('Competitive Position').first()).toBeVisible();

    // Click Next
    await modal.getByRole('button', { name: /next/i }).click();

    // Step 4: Ready
    await expect(modal.getByText('Step 3 of 3', { exact: true })).toBeVisible();
    await expect(modal.locator('h3', { hasText: /you're ready to calculate/i })).toBeVisible();
    await expect(modal.getByText('Quick tips:')).toBeVisible();

    // Click "Start calculating"
    await modal.getByRole('button', { name: /start calculating/i }).click();

    // Modal should be closed
    await expect(modal).not.toBeVisible();

    // Verify onboarding state is saved
    const onboardingState = await page.evaluate(() => {
      return localStorage.getItem('deal_calculator_onboarding');
    });
    expect(onboardingState).toBeTruthy();
    const state = JSON.parse(onboardingState!);
    expect(state.completed).toBe(true);
    expect(state.skipped).toBe(false);
  });

  test('should allow skipping onboarding', async ({ page }) => {
    await page.reload();

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 3000 });

    // Click "Skip tutorial"
    await page.getByRole('button', { name: /skip tutorial/i }).click();

    // Modal should be closed
    await expect(modal).not.toBeVisible();

    // Verify skip state is saved
    const onboardingState = await page.evaluate(() => {
      return localStorage.getItem('deal_calculator_onboarding');
    });
    expect(onboardingState).toBeTruthy();
    const state = JSON.parse(onboardingState!);
    expect(state.completed).toBe(false);
    expect(state.skipped).toBe(true);
  });

  test('should not show onboarding for returning users', async ({ page }) => {
    // Mark onboarding as completed
    await page.evaluate(() => {
      localStorage.setItem('deal_calculator_onboarding', JSON.stringify({
        completed: true,
        skipped: false,
        completedAt: new Date().toISOString(),
        version: 1
      }));
    });

    await page.reload();

    // Wait a bit to ensure modal would have appeared if it was going to
    await page.waitForTimeout(1000);

    // Modal should not be visible
    const modal = page.locator('[role="dialog"][aria-labelledby="onboarding-title"]');
    await expect(modal).not.toBeVisible();
  });

  test('should navigate back through steps', async ({ page }) => {
    await page.reload();

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 3000 });

    // Go to Step 2
    await modal.getByRole('button', { name: /show me how it works/i }).click();
    await expect(modal.getByText('Step 1 of 3', { exact: true })).toBeVisible();

    // Go to Step 3
    await modal.getByRole('button', { name: /next/i }).click();
    await expect(modal.getByText('Step 2 of 3', { exact: true })).toBeVisible();

    // Go back to Step 2
    await modal.getByRole('button', { name: /back/i }).click();
    await expect(modal.getByText('Step 1 of 3', { exact: true })).toBeVisible();

    // Go back to Welcome
    await modal.getByRole('button', { name: /back/i }).click();
    await expect(modal.locator('h2', { hasText: 'Get deal terms in 60 seconds' })).toBeVisible();
  });

  test('should close modal on Escape key', async ({ page }) => {
    await page.reload();

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 3000 });

    // Press Escape
    await page.keyboard.press('Escape');

    // Modal should be closed
    await expect(modal).not.toBeVisible();

    // Verify skip state is saved (Escape = skip)
    const onboardingState = await page.evaluate(() => {
      return localStorage.getItem('deal_calculator_onboarding');
    });
    expect(onboardingState).toBeTruthy();
    const state = JSON.parse(onboardingState!);
    expect(state.skipped).toBe(true);
  });

  test('should close modal on backdrop click', async ({ page }) => {
    await page.reload();

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 3000 });

    // Click on backdrop (outside the modal)
    await page.locator('.fixed.inset-0').first().click({ position: { x: 10, y: 10 } });

    // Modal should be closed
    await expect(modal).not.toBeVisible();
  });

  test('should be accessible', async ({ page }) => {
    await page.reload();

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 3000 });

    // Check ARIA attributes
    await expect(modal).toHaveAttribute('aria-modal', 'true');
    await expect(modal).toHaveAttribute('aria-labelledby', 'onboarding-title');

    // Check close button has aria-label
    const closeButton = page.getByRole('button', { name: /close tutorial/i });
    await expect(closeButton).toBeVisible();

    // Check focus is trapped in modal (tab should cycle within modal)
    await page.keyboard.press('Tab');
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();

    // Verify focused element is within the modal
    const isWithinModal = await focusedElement.evaluate((el) => {
      return el.closest('[role="dialog"]') !== null;
    });
    expect(isWithinModal).toBe(true);
  });
});

test.describe('Onboarding on Mobile', () => {
  test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE

  test('should display as bottom sheet on mobile', async ({ page }) => {
    await page.goto('/calculator');
    await page.evaluate(() => {
      localStorage.removeItem('deal_calculator_onboarding');
    });
    await page.reload();

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 3000 });

    // Check that modal has bottom sheet styling (rounded top corners)
    await expect(modal).toHaveClass(/rounded-t-3xl/);
  });

  test('should have touch-friendly button sizes', async ({ page }) => {
    await page.goto('/calculator');
    await page.evaluate(() => {
      localStorage.removeItem('deal_calculator_onboarding');
    });
    await page.reload();

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 3000 });

    // Check CTA button is at least 44px tall (WCAG touch target)
    const ctaButton = page.getByRole('button', { name: /show me how it works/i });
    const box = await ctaButton.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
  });
});
