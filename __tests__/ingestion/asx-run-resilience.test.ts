/**
 * One ASX code whose request aborts must not fail the run (six 'failed' runs Nov 9-22 2026 counted
 * against the scorecard's failed_runs_48h).
 */
jest.mock('@/lib/fetch-with-timeout', () => ({ fetchWithTimeout: jest.fn() }));
jest.mock('@/lib/ingestion/sec-edgar', () => ({ extractDealFromFiling: jest.fn(), findOrCreateCompany: jest.fn(), deriveTherapeuticArea: jest.fn() }));
jest.mock('@/lib/ingestion/insert-deal', () => ({ insertCitedDeal: jest.fn() }));
jest.mock('@/lib/ingestion/company-geography', () => ({ classifyAndEnrichDeal: jest.fn() }));

import { fetchWithTimeout } from '@/lib/fetch-with-timeout';
import { runAsxIngestion } from '@/lib/ingestion/exchanges/asx';
import type { SupabaseClient } from '@supabase/supabase-js';

describe('runAsxIngestion', () => {
  it('records an aborted code as an error and keeps scanning the others', async () => {
    const abort = Object.assign(new Error('This operation was aborted'), { name: 'AbortError' });
    (fetchWithTimeout as jest.Mock)
      .mockRejectedValueOnce(abort)
      .mockResolvedValue(new Response(JSON.stringify({ data: { displayName: 'B Ltd', items: [] } }), { status: 200 }));

    const r = await runAsxIngestion({} as SupabaseClient, { anthropicApiKey: 'test', codes: ['AAA', 'BBB'], dryRun: true, deep: false, timeBudgetMs: 60_000 });

    expect(r.codesScanned).toBe(1);
    expect(r.errors).toEqual([expect.stringMatching(/^ASX AAA: .*aborted/)]);
  });
});
