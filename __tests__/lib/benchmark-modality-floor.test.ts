/**
 * getBenchmarksSync — calibrated modality multipliers are floored at
 * MODALITY_MULTIPLIER_FLOOR (the phase baselines already carry each area's
 * modality mix) and never capped.
 */

const rows = [
  { calibration_type: 'modality_multiplier', therapeutic_area: 'oncology', phase: null, modality: 'smallMolecule', multiplier: 0.3, sample_size: 43 },
  { calibration_type: 'modality_multiplier', therapeutic_area: 'oncology', phase: null, modality: 'bispecific', multiplier: 2.45, sample_size: 21 },
  { calibration_type: 'modality_multiplier', therapeutic_area: 'oncology', phase: null, modality: 'mab', multiplier: 0.78, sample_size: 29 },
];

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({ select: () => ({ eq: async () => ({ data: rows, error: null }) }) }),
  }),
}));

import { MODALITY_MULTIPLIER_FLOOR, ensureBenchmarksLoaded, getBenchmarksSync } from '@/lib/benchmarks';

describe('calibrated modality multipliers', () => {
  beforeAll(async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test';
    jest.spyOn(console, 'log').mockImplementation(() => {});
    await ensureBenchmarksLoaded();
  });
  afterAll(() => jest.restoreAllMocks());

  it('floors a multiplier below the floor', () => {
    expect(getBenchmarksSync().modalities.smallMolecule.multiplier).toBe(MODALITY_MULTIPLIER_FLOOR);
  });

  it('keeps multipliers above the floor as calibrated, with no cap', () => {
    const m = getBenchmarksSync().modalities;
    expect(m.mab.multiplier).toBe(0.78);
    expect(m.bispecific.multiplier).toBe(2.45);
  });
});
