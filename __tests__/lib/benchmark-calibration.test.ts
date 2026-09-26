/**
 * computePhaseBaselines — the pure core of the weekly benchmark calibration:
 * the n ≥ 5 guard, the deals → benchmarks.json phase-key mapping, the
 * sanity-ratio confidence, and the client-observation guards (k-anonymity,
 * the 50% cap, observation ids never in deal_ids). No database.
 */

import {
  OBSERVATION_ID_PREFIX,
  computePhaseBaselines,
  isObservationId,
  type DealRow,
} from '@/lib/ingestion/benchmark-calibration';

const M = 1_000_000;

function deal(id: string, over: Partial<DealRow> = {}): DealRow {
  return {
    id,
    upfront_usd: 100 * M,
    total_deal_value_usd: 1000 * M,
    royalty_low_pct: 8,
    royalty_high_pct: 14,
    phase_at_signing: 'phase_2',
    therapeutic_area: 'oncology',
    modality: 'antibody',
    ...over,
  };
}

function publicCell(n: number, over: Partial<DealRow> = {}): DealRow[] {
  return Array.from({ length: n }, (_, i) => deal(`pub-${i}`, { upfront_usd: (100 + i * 10) * M, total_deal_value_usd: (1000 + i * 100) * M, ...over }));
}

function observation(i: number, over: Partial<DealRow> = {}): DealRow {
  return deal(`${OBSERVATION_ID_PREFIX}${i}`, { upfront_usd: 500 * M, total_deal_value_usd: 5000 * M, announced_date: `2026-0${(i % 8) + 1}-01`, ...over });
}

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('computePhaseBaselines — public deals', () => {
  it('skips cells under the sample floor and writes p25 / p50 / p75 for the rest', () => {
    const out = computePhaseBaselines([...publicCell(5), ...publicCell(4, { therapeutic_area: 'neurology' }).map((d, i) => ({ ...d, id: `neu-${i}` }))]);
    expect(out.skippedLowN).toBe(1);
    expect(out.results).toHaveLength(1);
    const r = out.results[0];
    expect(r).toMatchObject({ calibration_type: 'phase_baseline', therapeutic_area: 'oncology', phase: 'phase2', modality: null, sample_size: 5 });
    expect(r.upfront_low).toBe(110);
    expect(r.upfront_median).toBe(120);
    expect(r.upfront_high).toBe(130);
    expect(r.total_value_median).toBe(1200);
    expect(r.royalty_base).toBe(8);
    expect(r.royalty_max).toBe(14);
    expect(r.deal_ids).toEqual(['pub-0', 'pub-1', 'pub-2', 'pub-3', 'pub-4']);
    expect(out.observationsUsed).toBe(0);
    expect(out.cellsWithObservations).toBe(0);
  });

  it('maps deals phases to benchmark keys and drops unmapped phases', () => {
    const rows = [
      ...publicCell(5, { phase_at_signing: 'phase_1' }),
      ...publicCell(5, { phase_at_signing: 'discovery' }).map((d, i) => ({ ...d, id: `disc-${i}` })),
      ...publicCell(5, { phase_at_signing: 'phase_1_2' }).map((d, i) => ({ ...d, id: `p12-${i}` })),
      ...publicCell(5, { phase_at_signing: null }).map((d, i) => ({ ...d, id: `none-${i}` })),
      ...publicCell(5, { therapeutic_area: null }).map((d, i) => ({ ...d, id: `nota-${i}` })),
    ];
    const out = computePhaseBaselines(rows);
    expect(out.results.map(r => `${r.therapeutic_area}|${r.phase}`).sort()).toEqual(['oncology|phase1', 'oncology|preclinical']);
    expect(out.skippedLowN).toBe(0);
  });

  it('flags a cell whose median diverges > 3× from the static baseline (confidence 50, still written)', () => {
    // oncology phase2 static: upfront median $120M, total $1,300M
    const fine = computePhaseBaselines(publicCell(5));
    expect(fine.results[0].confidence_score).toBe(85);
    const wild = computePhaseBaselines(publicCell(5, { upfront_usd: 1000 * M }));
    expect(wild.results[0].confidence_score).toBe(50);
    expect(wild.results).toHaveLength(1);
    const lowTotal = computePhaseBaselines(publicCell(5, { total_deal_value_usd: 100 * M }));
    expect(lowTotal.results[0].confidence_score).toBe(50);
  });

  it('normalises decimal royalties to percentages', () => {
    const out = computePhaseBaselines(publicCell(5, { royalty_low_pct: 0.08, royalty_high_pct: 0.15 }));
    expect(out.results[0].royalty_base).toBe(8);
    expect(out.results[0].royalty_max).toBe(15);
  });
});

describe('computePhaseBaselines — client observations', () => {
  it('needs ≥ minSampleSize public deals before any observation counts (k-anonymity)', () => {
    const out = computePhaseBaselines(publicCell(4), { extraObservations: [observation(1), observation(2), observation(3)] });
    expect(out.results).toHaveLength(0);
    expect(out.skippedLowN).toBe(1);
    expect(out.observationsUsed).toBe(0);
  });

  it('blends observations into the cell, counts them in sample_size, and never writes their ids', () => {
    const out = computePhaseBaselines(publicCell(5), { extraObservations: [observation(1), observation(2)] });
    expect(out.results).toHaveLength(1);
    const r = out.results[0];
    expect(r.sample_size).toBe(7);
    expect(r.deal_ids).toEqual(['pub-0', 'pub-1', 'pub-2', 'pub-3', 'pub-4']);
    expect(r.deal_ids.some(isObservationId)).toBe(false);
    // two $500M upfronts lift the p75 above the public-only 130
    expect(r.upfront_high).toBeGreaterThan(130);
    expect(out.observationsUsed).toBe(2);
    expect(out.cellsWithObservations).toBe(1);
    expect(out.notes).toEqual(['oncology|phase2: 2 client observations blended with 5 public deals']);
  });

  it('caps observations at 50% of the cell, keeping the newest', () => {
    const obs = [1, 2, 3, 4, 5, 6, 7].map(i => observation(i, { announced_date: `2026-01-0${i}`, upfront_usd: (200 + i) * M }));
    const out = computePhaseBaselines(publicCell(5), { extraObservations: obs });
    const r = out.results[0];
    expect(r.sample_size).toBe(10);                    // 5 public + 5 observations (≤ 50%)
    expect(out.observationsUsed).toBe(5);
    expect(out.notes[0]).toContain('(2 dropped by the 50% cap)');
    // the kept five are the newest (Jan 3–7, upfronts 203–207): p50 of
    // [100,110,120,130,140,203,204,205,206,207] = (140 + 203) / 2; with the oldest kept it would be 170.5
    expect(r.upfront_median).toBe(171.5);
    expect(r.deal_ids).toHaveLength(5);
    expect(r.deal_ids.some(isObservationId)).toBe(false);
  });

  it('treats an outcome_ id as an observation wherever it arrives, and honours a custom share', () => {
    const rows = [...publicCell(5), observation(9)];
    const out = computePhaseBaselines(rows, { maxObservationShare: 0 });
    expect(out.results[0].sample_size).toBe(5);
    expect(out.observationsUsed).toBe(0);
    const out2 = computePhaseBaselines(rows);
    expect(out2.results[0].sample_size).toBe(6);
    expect(out2.results[0].deal_ids).not.toContain('outcome_9');
  });

  it('observations never rescue a cell of their own (a cell with no public deals is not created)', () => {
    const out = computePhaseBaselines([], { extraObservations: [1, 2, 3, 4, 5, 6].map(i => observation(i)) });
    expect(out.results).toHaveLength(0);
    expect(out.observationsUsed).toBe(0);
  });
});
