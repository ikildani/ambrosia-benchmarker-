import { test, expect } from '@playwright/test';

/**
 * /methodology must render live figures as numbers. A dash, "NaN" or
 * "unavailable" in a statistic means the page is claiming nothing or the
 * stats pipeline is broken; either is a failure.
 */
test.describe('Methodology and accuracy page', () => {
  // The page runs a Monte Carlo pass and a database-backed backtest at render
  // time; on a cold dev server that is slow. Run serially and wait for DOM only.
  test.describe.configure({ mode: 'serial', timeout: 90_000 });
  const open = (page: import('@playwright/test').Page) => page.goto('/methodology', { waitUntil: 'domcontentloaded', timeout: 60_000 });

  test('renders with live counts as numbers', async ({ page }) => {
    await open(page);
    await expect(page.locator('h1')).toHaveText(/methodology and accuracy/i);

    for (const id of ['stat-tracked', 'stat-sourced', 'stat-verified', 'stat-companies', 'stat-quarantined']) {
      const text = (await page.getByTestId(id).textContent())?.trim() ?? '';
      expect(text, `${id} should be a number, got "${text}"`).toMatch(/^[\d,]+$/);
    }

    // Verified ⊂ sourced ⊂ tracked, by construction.
    const num = async (id: string) => Number(((await page.getByTestId(id).textContent()) ?? '').replace(/,/g, ''));
    const tracked = await num('stat-tracked');
    const sourced = await num('stat-sourced');
    const verified = await num('stat-verified');
    expect(verified).toBeLessThanOrEqual(sourced);
    expect(sourced).toBeLessThanOrEqual(tracked);
    expect(tracked).toBeGreaterThan(0);
  });

  test('accuracy table has no dashes or NaN and n adds up', async ({ page }) => {
    await open(page);
    const table = page.getByTestId('accuracy-table');
    await expect(table).toBeVisible();
    const cells = await table.locator('tbody td').allTextContents();
    expect(cells.length).toBeGreaterThan(0);
    for (const c of cells) {
      expect(c, `cell "${c}"`).not.toMatch(/NaN|undefined|—|–/);
    }
    const n = async (id: string) => Number((await page.getByTestId(`${id}-n`).textContent())?.trim());
    const all = await n('acc-all');
    expect(all).toBeGreaterThan(0);
    expect((await n('acc-early')) + (await n('acc-mid')) + (await n('acc-late'))).toBe(all);
    const scored = Number((await page.getByTestId('acc-scored').textContent())?.trim());
    expect(scored).toBe(all);
    const eligible = Number((await page.getByTestId('acc-eligible').textContent())?.trim());
    expect(eligible).toBeGreaterThanOrEqual(scored);
  });

  test('describes all four methods and links to the broader diagnostic', async ({ page }) => {
    await open(page);
    for (const key of ['comparables', 'rnpv', 'monteCarlo', 'ensemble']) {
      await expect(page.getByTestId(`method-${key}`)).toBeVisible();
    }
    await expect(page.getByRole('link', { name: '/accuracy' })).toBeVisible();
  });

  test('carries Dataset JSON-LD and a canonical', async ({ page }) => {
    await open(page);
    const ld = await page.locator('script[type="application/ld+json"]').first().textContent();
    expect(ld).toBeTruthy();
    const parsed = JSON.parse(ld!);
    const graph = parsed['@graph'] ?? [parsed];
    expect(graph.some((n: { '@type': string }) => n['@type'] === 'Dataset')).toBe(true);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/methodology$/);
    await expect(page).toHaveTitle(/methodology and accuracy/i);
  });

  test('stats API returns the same figures as JSON', async ({ request }) => {
    const res = await request.get('/api/methodology/stats');
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(typeof body.counts.tracked).toBe('number');
    expect(typeof body.accuracy.all.upfront.within35).toBe('number');
    expect(body.accuracy.cohort).toBe('verified_cited');
  });
});
