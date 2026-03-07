import { analyzeCompetitiveLandscape } from '@/lib/services/pipeline-intelligence';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Creates a mock Supabase client that stubs the query chain:
 *   supabase.from('company_trials').select(...).in(...).or(...).limit(100)
 *
 * The final `.limit()` call resolves to `{ data, error }`.
 */
function createMockSupabase(
  response: { data: unknown[] | null; error: unknown | null } = { data: [], error: null },
) {
  const limit = jest.fn().mockResolvedValue(response);
  const or = jest.fn().mockReturnValue({ limit });
  const inFn = jest.fn().mockReturnValue({ or });
  const select = jest.fn().mockReturnValue({ in: inFn });
  const from = jest.fn().mockReturnValue({ select });

  return { client: { from } as unknown as SupabaseClient, mocks: { from, select, in: inFn, or, limit } };
}

describe('analyzeCompetitiveLandscape', () => {
  // ── 1. Returns valid landscape for curated indication with empty trial data ──
  it('returns a valid CompetitiveLandscape for lung_nsclc with empty trial data', async () => {
    const { client } = createMockSupabase({ data: [], error: null });
    const result = await analyzeCompetitiveLandscape(client, 'lung_nsclc', 'oncology');

    expect(result).toMatchObject({
      indication: 'lung_nsclc',
      totalCompetingAssets: expect.any(Number),
      byPhase: expect.any(Object),
      keyCompetitors: expect.any(Array),
      competitiveDensityScore: expect.any(Number),
      firstMoverAdvantage: expect.any(Boolean),
      marketShareErosionEstimate: expect.any(Number),
      narrative: expect.any(String),
    });
    expect(result.totalCompetingAssets).toBeGreaterThan(0);
  });

  // ── 2. Returns curated key competitors for known indication ──
  it('returns curated key competitors for lung_nsclc', async () => {
    const { client } = createMockSupabase({ data: [], error: null });
    const result = await analyzeCompetitiveLandscape(client, 'lung_nsclc', 'oncology');

    expect(result.keyCompetitors.length).toBeGreaterThanOrEqual(2);
    const names = result.keyCompetitors.map(c => c.assetName);
    expect(names).toContain('Keytruda');
    expect(names).toContain('Tagrisso');
  });

  // ── 3. Density score is high (>60) for very_high density indication ──
  it('produces a density score above 60 for lung_nsclc (very_high density)', async () => {
    const { client } = createMockSupabase({ data: [], error: null });
    const result = await analyzeCompetitiveLandscape(client, 'lung_nsclc', 'oncology');

    // curated density very_high maps to 85; with <3 trials it decreases by 15 → 70
    expect(result.competitiveDensityScore).toBeGreaterThan(60);
  });

  // ── 4. Density score is moderate for moderate density indication (sle_lupus) ──
  it('produces a moderate density score for sle_lupus', async () => {
    const { client } = createMockSupabase({ data: [], error: null });
    const result = await analyzeCompetitiveLandscape(client, 'sle_lupus', 'immunology');

    // curated density moderate maps to 50; with <3 trials → 35
    expect(result.competitiveDensityScore).toBeGreaterThanOrEqual(20);
    expect(result.competitiveDensityScore).toBeLessThanOrEqual(60);
  });

  // ── 5. firstMoverAdvantage is false for high-density indications ──
  it('returns firstMoverAdvantage=false for lung_nsclc', async () => {
    const { client } = createMockSupabase({ data: [], error: null });
    const result = await analyzeCompetitiveLandscape(client, 'lung_nsclc', 'oncology');

    // densityScore >= 70 → firstMoverAdvantage = false (threshold is <40)
    expect(result.firstMoverAdvantage).toBe(false);
  });

  // ── 6. firstMoverAdvantage is true for low-density indications ──
  it('returns firstMoverAdvantage=true for an unknown low-density indication', async () => {
    // No curated data → densityScore defaults to 50, then -15 for <3 trials = 35 → <40 → true
    const { client } = createMockSupabase({ data: [], error: null });
    const result = await analyzeCompetitiveLandscape(client, 'some_rare_orphan', 'rare_disease');

    expect(result.firstMoverAdvantage).toBe(true);
  });

  // ── 7. marketShareErosionEstimate is higher for high-density indications ──
  it('returns higher erosion for very_high density than moderate density', async () => {
    const { client: clientHigh } = createMockSupabase({ data: [], error: null });
    const { client: clientMod } = createMockSupabase({ data: [], error: null });

    const resultHigh = await analyzeCompetitiveLandscape(clientHigh, 'lung_nsclc', 'oncology');
    const resultMod = await analyzeCompetitiveLandscape(clientMod, 'sle_lupus', 'immunology');

    expect(resultHigh.marketShareErosionEstimate).toBeGreaterThan(resultMod.marketShareErosionEstimate);
    // very_high → 0.45, moderate → 0.15
    expect(resultHigh.marketShareErosionEstimate).toBeCloseTo(0.45, 1);
    expect(resultMod.marketShareErosionEstimate).toBeCloseTo(0.15, 1);
  });

  // ── 8. Handles supabase query failure gracefully ──
  it('returns curated data when supabase query throws', async () => {
    const limit = jest.fn().mockRejectedValue(new Error('connection refused'));
    const or = jest.fn().mockReturnValue({ limit });
    const inFn = jest.fn().mockReturnValue({ or });
    const select = jest.fn().mockReturnValue({ in: inFn });
    const from = jest.fn().mockReturnValue({ select });
    const client = { from } as unknown as SupabaseClient;

    const result = await analyzeCompetitiveLandscape(client, 'lung_nsclc', 'oncology');

    // Should still return curated competitors without throwing
    expect(result.indication).toBe('lung_nsclc');
    expect(result.keyCompetitors.length).toBeGreaterThanOrEqual(2);
    expect(result.narrative).toBeTruthy();
  });

  // ── 9. Returns fallback for unknown indication ──
  it('returns a fallback landscape for an unknown indication with no curated data', async () => {
    const { client } = createMockSupabase({ data: [], error: null });
    const result = await analyzeCompetitiveLandscape(client, 'totally_unknown_xyz', 'oncology');

    expect(result.indication).toBe('totally_unknown_xyz');
    expect(result.keyCompetitors).toEqual([]);
    expect(result.competitiveDensityScore).toBeLessThanOrEqual(50);
    expect(result.narrative).toBeTruthy();
  });

  // ── 10. narrative is populated for all cases ──
  it('populates narrative for both curated and uncurated indications', async () => {
    const { client: client1 } = createMockSupabase({ data: [], error: null });
    const { client: client2 } = createMockSupabase({ data: [], error: null });

    const curated = await analyzeCompetitiveLandscape(client1, 'alzheimers', 'neurology');
    const uncurated = await analyzeCompetitiveLandscape(client2, 'unknown_indication', 'oncology');

    expect(curated.narrative.length).toBeGreaterThan(20);
    expect(uncurated.narrative.length).toBeGreaterThan(20);
    // Curated should use the marketDynamics string
    expect(curated.narrative.toLowerCase()).toContain('amyloid');
    // Uncurated should use the generated fallback template
    expect(uncurated.narrative).toMatch(/active clinical trials/i);
  });
});
