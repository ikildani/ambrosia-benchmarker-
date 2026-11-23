/**
 * getBenchmarksSync — calibrated modality multipliers are kept per therapeutic area,
 * floored at MODALITY_MULTIPLIER_FLOOR (the phase baselines already carry each area's
 * modality mix) and never capped. resolveModalityMultiplier never borrows another area's row.
 */

const rows = [
  { calibration_type: 'modality_multiplier', therapeutic_area: 'oncology', phase: null, modality: 'smallMolecule', multiplier: 0.3, sample_size: 43 },
  { calibration_type: 'modality_multiplier', therapeutic_area: 'oncology', phase: null, modality: 'bispecific', multiplier: 2.45, sample_size: 21 },
  { calibration_type: 'modality_multiplier', therapeutic_area: 'oncology', phase: null, modality: 'mab', multiplier: 0.78, sample_size: 29 },
  // Other areas' rows must not leak into oncology (Nov 23 2026: oncology vaccines priced with this 2.16).
  { calibration_type: 'modality_multiplier', therapeutic_area: 'infectiousDisease', phase: null, modality: 'therapeuticVaccine', multiplier: 2.16, sample_size: 11 },
  { calibration_type: 'modality_multiplier', therapeutic_area: 'dermatology', phase: null, modality: 'mab', multiplier: 3, sample_size: 6 },
];

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({ select: () => ({ eq: async () => ({ data: rows, error: null }) }) }),
  }),
}));

import { MODALITY_MULTIPLIER_FLOOR, ensureBenchmarksLoaded, getBenchmarksSync, resolveModalityMultiplier, staticBenchmarks } from '@/lib/benchmarks';

describe('calibrated modality multipliers', () => {
  beforeAll(async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test';
    jest.spyOn(console, 'log').mockImplementation(() => {});
    await ensureBenchmarksLoaded();
  });
  afterAll(() => jest.restoreAllMocks());

  it('floors a multiplier below the floor', () => {
    expect(resolveModalityMultiplier(getBenchmarksSync(), 'oncology', 'smallMolecule').multiplier).toBe(MODALITY_MULTIPLIER_FLOOR);
  });

  it('keeps multipliers above the floor as calibrated, with no cap', () => {
    const b = getBenchmarksSync();
    expect(resolveModalityMultiplier(b, 'oncology', 'mab').multiplier).toBe(0.78);
    expect(resolveModalityMultiplier(b, 'oncology', 'bispecific').multiplier).toBe(2.45);
  });

  it("uses each area's own row: dermatology's antibody multiplier stays in dermatology", () => {
    const b = getBenchmarksSync();
    expect(resolveModalityMultiplier(b, 'dermatology', 'mab').multiplier).toBe(3);
    expect(resolveModalityMultiplier(b, 'oncology', 'mab').multiplier).toBe(0.78);
  });

  it("never borrows another area's calibration; falls back to the per-area override, then static", () => {
    const b = getBenchmarksSync();
    const onc = resolveModalityMultiplier(b, 'oncology', 'therapeuticVaccine');
    expect(onc.source).toBe('area');
    expect(onc.multiplier).toBe(staticBenchmarks.modalityByTA!.oncology.therapeuticVaccine.multiplier);
    expect(resolveModalityMultiplier(b, 'infectiousDisease', 'therapeuticVaccine').multiplier).toBe(2.16);
    const neuro = resolveModalityMultiplier(b, 'neurology', 'mab');
    expect(neuro.source).toBe('static');
    expect(neuro.multiplier).toBe(staticBenchmarks.modalities.mab.multiplier);
  });

  it('leaves the TA-neutral modality map static', () => {
    expect(getBenchmarksSync().modalities.mab.multiplier).toBe(staticBenchmarks.modalities.mab.multiplier);
  });
});
