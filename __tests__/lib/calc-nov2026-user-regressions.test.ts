/**
 * Regressions from real Solidus runs (Oct 28 – Nov 6 2026), priced on the production calibration overlay:
 *  1. Peptide prostate acquisition: Phase 2 upfront came out below Phase 1 and Phase 1/2.
 *  2. GBM therapeutic vaccine, Phase 1: $175–239M upfront (oncology priced with infectious disease's 2.16 vaccine multiplier).
 *  3. Phase 2 NSCLC small molecule, Greater China: $1–3M upfront (territory 0.12, then a second cut from peak sales).
 */

const pb = (phase: string, low: number, median: number, high: number, tv: number, n: number) => ({
  calibration_type: 'phase_baseline', therapeutic_area: 'oncology', phase, modality: null,
  upfront_low: low, upfront_median: median, upfront_high: high,
  total_value_low: tv / 3, total_value_median: tv, total_value_high: tv * 2,
  royalty_base: null, royalty_max: null, multiplier: null, sample_size: n, calibrated_at: '2026-11-17',
});
const mm = (ta: string, modality: string, multiplier: number, n: number) => ({
  calibration_type: 'modality_multiplier', therapeutic_area: ta, phase: null, modality, multiplier, sample_size: n,
});
// Active production rows on Nov 23 2026 (subset).
const rows = [
  pb('preclinical', 2.3, 10.4, 30, 526, 94),
  pb('phase1', 23.5, 60, 105, 827.5, 53),
  pb('phase2', 10, 35, 170, 323, 42),
  pb('phase3', 22, 97.5, 250, 584.8, 34),
  mm('oncology', 'peptide', 0.3, 5),
  mm('other', 'peptide', 1.98, 5),
  mm('oncology', 'smallMolecule', 0.71, 47),
  mm('ophthalmology', 'smallMolecule', 0.64, 8),
  mm('infectiousDisease', 'therapeuticVaccine', 2.16, 11),
];

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({ select: () => ({ eq: async () => ({ data: rows, error: null }) }) }),
  }),
}));

import { ensureBenchmarksLoaded } from '@/lib/benchmarks';
import { calculateDealTerms, type CalculationInput } from '@/lib/calculations';

const base = {
  biomarker: 'unselected', lineOfTherapy: '2L', therapeuticArea: 'oncology', treatmentApproach: 'symptomatic',
  regulatoryDesignations: { prime: false, orphan: false, fastTrack: false, breakthrough: false },
} as const;
const run = (i: Record<string, unknown>) => calculateDealTerms({ ...base, ...i } as unknown as CalculationInput);
const mod = (r: ReturnType<typeof calculateDealTerms>, name: RegExp) => r.modifiers.find((m) => name.test(m.name));

describe('Nov 2026 user-run regressions', () => {
  beforeAll(async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test';
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    await ensureBenchmarksLoaded();
  });
  afterAll(() => jest.restoreAllMocks());

  it('1. acquisition upfront and total value rise with phase for the same peptide program', () => {
    const arnaud = (phase: string) => run({
      phase, dealType: 'acquisition', modality: 'peptide', territory: 'global', indication: 'prostate', dataQuality: 'promising',
      peakSalesOverrideM: 200, competitivePosition: 'crowded', combinationPotential: 'standalone',
    });
    const ladder = ['phase1', 'phase1_2', 'phase2', 'phase3'].map(arnaud);
    for (let i = 1; i < ladder.length; i++) {
      expect(ladder[i].terms.upfront.median).toBeGreaterThanOrEqual(ladder[i - 1].terms.upfront.median);
      expect(ladder[i].terms.totalDealValue.median).toBeGreaterThanOrEqual(ladder[i - 1].terms.totalDealValue.median);
    }
    // Oncology's own peptide multiplier (floored), not "other" area's 1.98.
    expect(mod(ladder[0], /peptide/i)?.multiplier).toBe(0.6);
  });

  it("2. an oncology vaccine is not priced with infectious disease's vaccine multiplier", () => {
    const r = run({
      phase: 'phase1', dealType: 'licensing', modality: 'therapeuticVaccine', territory: 'global', indication: 'gbm',
      dataQuality: 'promising', competitivePosition: 'racing', combinationPotential: 'some',
    });
    expect(mod(r, /vaccine/i)?.multiplier).toBeLessThan(1);
    // Disclosed Phase 1 cancer-vaccine upfronts: $1.6–27.5M; the oncology Phase 1 calibrated high is $105M.
    expect(r.terms.upfront.median).toBeLessThan(60);
  });

  it('3. a China-only Phase 2 license is priced in the range China licenses have paid', () => {
    const kan = (extra: Record<string, unknown>) => run({
      phase: 'phase2', dealType: 'licensing', modality: 'smallMolecule', territory: 'china', indication: 'lung_nsclc',
      dataQuality: 'promising', competitivePosition: 'racing', combinationPotential: 'some', ...extra,
    });
    // Zai Lab / Blueprint (Phase 1, China): $25M; Betta / C4 (preclinical, China): $10M.
    expect(kan({}).terms.upfront.median).toBeGreaterThanOrEqual(10);
    expect(mod(kan({}), /small molecule/i)?.multiplier).toBe(0.71);
  });

  it("3b. a China peak-sales entry is compared with a China default, not the worldwide one", () => {
    const r = run({
      phase: 'phase2', dealType: 'licensing', modality: 'smallMolecule', territory: 'china', indication: 'lung_nsclc',
      dataQuality: 'promising', competitivePosition: 'racing', combinationPotential: 'some', peakSalesOverrideM: 100,
    });
    const peak = mod(r, /peak sales/i);
    expect(peak).toBeDefined();
    // $100M against a ~$360M China default (12% of worldwide), not against $3.0B.
    expect(peak!.multiplier).toBeGreaterThan(0.5);
    expect(peak!.context).not.toMatch(/\$3\.0B/);
  });
});
