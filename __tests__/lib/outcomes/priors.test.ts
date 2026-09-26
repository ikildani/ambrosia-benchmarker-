/**
 * Outcome-informed priors: observation mapping, the k-anonymity / 50% cap
 * guards through computePhaseBaselines, deal_ids never carrying outcome_ ids,
 * the buyer-premium blend maths (peer median, recency weight, clamp), the
 * no-write-when-unchanged rule, and the nightly runner against a stubbed
 * Supabase. No database.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  MIN_OBSERVATIONS_PER_BUYER,
  blendBuyerPremiums,
  isBlendedRow,
  loadClientObservations,
  observationPhase,
  observationsToDealRows,
  refreshOutcomePriors,
  resolveBuyerId,
  type ClientObservation,
  type PremiumRow,
} from '@/lib/outcomes/priors';
import { computePhaseBaselines, isObservationId } from '@/lib/ingestion/benchmark-calibration';
import { recencyWeight } from '@/lib/financial/calibration';
import type { DealRow as PremiumDealRow } from '@/lib/financial/counterparty-premiums';
import type { CompanyAlias } from '@/lib/outcomes/types';

const NOW = new Date('2026-09-26T02:00:00Z');
const M = 1_000_000;
const LILLY = 'c0ffee00-0000-4000-8000-000000000001';
const ROCHE = 'c0ffee00-0000-4000-8000-000000000002';

const COMPANIES: CompanyAlias[] = [
  { id: LILLY, name: 'Eli Lilly', name_variations: ['Eli Lilly and Company', 'Lilly'] },
  { id: ROCHE, name: 'Roche', name_variations: ['F. Hoffmann-La Roche', 'Genentech'] },
];

function obs(id: string, over: Partial<ClientObservation> = {}): ClientObservation {
  return {
    outcomeId: id,
    predictionId: `p-${id}`,
    therapeuticArea: 'oncology',
    phase: 'phase_2',
    modality: 'antibody',
    licensorName: 'Acme Therapeutics',
    assetName: 'ACM-101',
    indication: 'lung_nsclc',
    upfrontM: 80,
    totalM: 1500,
    royaltyLow: 8,
    royaltyHigh: 14,
    licenseeName: 'Eli Lilly and Company',
    licenseeId: null,
    signedDate: '2026-06-15',
    dealType: 'license',
    resolvedAt: '2026-06-20T10:00:00Z',
    ...over,
  };
}

/** Five public oncology phase_2 deals from other buyers → peer median $1,000M. */
function publicDeals(): PremiumDealRow[] {
  return [800, 900, 1000, 1100, 1200].map((v, i) => ({
    id: `pub-${i}`,
    licensee_id: `other-${i}`,
    licensee_name: `Other ${i}`,
    indication_category: 'lung_nsclc',
    phase_at_signing: 'phase_2',
    total_deal_value_usd: v * M,
    upfront_usd: 50 * M,
    therapeutic_area: 'oncology',
  }));
}

function premiumRow(over: Partial<PremiumRow> = {}): PremiumRow {
  return {
    id: 'pr-1',
    company_id: LILLY,
    company_name: 'Eli Lilly',
    premium_multiplier: 1.2,
    sample_size: 10,
    confidence: 'high',
    by_therapeutic_area: { oncology: { premium: 1.25, n: 6 } },
    by_phase: { phase_2: { premium: 1.1, n: 5 } },
    calculation_notes: 'Trimmed mean of 10 disclosed deal premiums vs. peer medians.',
    as_of_date: '2026-07-01',
    ...over,
  };
}

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

// ─── mapping ───────────────────────────────────────────────────────────────

describe('observationsToDealRows', () => {
  it('maps $M to USD, engine phase to the deals spelling, and tags the id with outcome_', () => {
    const [row] = observationsToDealRows([obs('o1', { phase: 'Phase 2', signedDate: '2026-06-15' })]);
    expect(row.id).toBe('outcome_o1');
    expect(isObservationId(row.id)).toBe(true);
    expect(row.upfront_usd).toBe(80 * M);
    expect(row.total_deal_value_usd).toBe(1500 * M);
    expect(row.royalty_low_pct).toBe(8);
    expect(row.royalty_high_pct).toBe(14);
    expect(row.phase_at_signing).toBe('phase_2');
    expect(row.therapeutic_area).toBe('oncology');
    expect(row.modality).toBe('antibody');
    expect(row.announced_date).toBe('2026-06-15');
    expect(row).toMatchObject({ verification_status: 'verified', confidence_score: 90, is_synthetic: false, is_canonical: true, indication_category: null });
  });

  it('falls back to the resolved date, nulls unknown phases, and drops observations with no terms', () => {
    const rows = observationsToDealRows([
      obs('o1', { signedDate: null, phase: 'first-in-human', upfrontM: null }),
      obs('o2', { upfrontM: null, totalM: null, royaltyLow: null, royaltyHigh: null }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].announced_date).toBe('2026-06-20');
    expect(rows[0].phase_at_signing).toBeNull();
    expect(rows[0].upfront_usd).toBeNull();
    expect(observationPhase('phase_2')).toBe('phase_2');
    expect(observationPhase('Phase II')).toBe('phase_2');
    expect(observationPhase(null)).toBeNull();
  });
});

describe('observations inside computePhaseBaselines', () => {
  const publicCell = (n: number) => Array.from({ length: n }, (_, i) => ({
    id: `pub-${i}`, upfront_usd: (100 + i * 10) * M, total_deal_value_usd: (1000 + i * 100) * M,
    royalty_low_pct: 8, royalty_high_pct: 14, phase_at_signing: 'phase_2', therapeutic_area: 'oncology', modality: 'antibody',
  }));

  it('k-anonymity: a cell under 5 public deals ignores client observations entirely', () => {
    const out = computePhaseBaselines(publicCell(4), { extraObservations: observationsToDealRows([obs('a'), obs('b'), obs('c')]) });
    expect(out.results).toHaveLength(0);
    expect(out.observationsUsed).toBe(0);
  });

  it('caps client rows at 50% of the cell and never writes outcome_ ids', () => {
    const many = observationsToDealRows(Array.from({ length: 8 }, (_, i) => obs(`o${i}`, { signedDate: `2026-01-0${i + 1}` })));
    const out = computePhaseBaselines(publicCell(5), { extraObservations: many });
    expect(out.results).toHaveLength(1);
    expect(out.results[0].sample_size).toBe(10);
    expect(out.observationsUsed).toBe(5);
    expect(out.results[0].deal_ids).toEqual(['pub-0', 'pub-1', 'pub-2', 'pub-3', 'pub-4']);
    expect(out.results[0].deal_ids.some(isObservationId)).toBe(false);
    expect(out.notes[0]).toMatch(/5 client observations blended with 5 public deals \(3 dropped by the 50% cap\)/);
  });
});

// ─── buyer resolution ──────────────────────────────────────────────────────

describe('resolveBuyerId', () => {
  it('prefers the stored id, else resolves the name through aliases', () => {
    expect(resolveBuyerId({ licenseeName: 'whoever', licenseeId: ROCHE }, COMPANIES)).toBe(ROCHE);
    expect(resolveBuyerId({ licenseeName: 'Eli Lilly and Company', licenseeId: null }, COMPANIES)).toBe(LILLY);
    expect(resolveBuyerId({ licenseeName: 'Genentech, Inc.', licenseeId: null }, COMPANIES)).toBe(ROCHE);
    expect(resolveBuyerId({ licenseeName: 'Unknown Pharma', licenseeId: null }, COMPANIES)).toBeNull();
    expect(resolveBuyerId({ licenseeName: null, licenseeId: null }, COMPANIES)).toBeNull();
  });
});

// ─── blend ─────────────────────────────────────────────────────────────────

describe('blendBuyerPremiums', () => {
  it('blends recency-weighted premiums vs the public peer median into the base row and clamps', () => {
    // premiums 1.5 (2026, w = 1) and 0.9 (2024, w = 0.5^(2/2.5)); base 1.2 × n = 10
    const observations = [obs('o1', { totalM: 1500, signedDate: '2026-06-15' }), obs('o2', { totalM: 900, signedDate: '2024-03-01' })];
    const out = blendBuyerPremiums([premiumRow()], observations, COMPANIES, NOW, publicDeals());
    expect(out.rows).toHaveLength(1);
    const w2 = recencyWeight(2024, 2026);
    expect(w2).toBeCloseTo(Math.pow(0.5, 2 / 2.5), 10);
    const expected = (10 * 1.2 + 1 * 1.5 + w2 * 0.9) / (10 + 1 + w2);
    const row = out.rows[0];
    expect(row.premium_multiplier).toBeCloseTo(Math.round(expected * 1000) / 1000, 6);
    expect(row.sample_size).toBe(12);
    expect(row.confidence).toBe('high');
    expect(row.company_id).toBe(LILLY);
    expect(row.company_name).toBe('Eli Lilly');
    expect(row.as_of_date).toBe('2026-09-26');
    expect(row.calculation_notes).toContain('blended 2 client outcomes on 2026-09-26');
    expect(isBlendedRow(row)).toBe(true);
    // slices are carried from the base row, not recomputed
    expect(row.by_therapeutic_area).toEqual({ oncology: { premium: 1.25, n: 6 } });
    expect(row.by_phase).toEqual({ phase_2: { premium: 1.1, n: 5 } });
    expect(out.buyersTouched).toBe(1);
    expect(out.observationsUsed).toBe(2);
  });

  it('clamps to [0.7, 1.5] and recomputes confidence from n + k', () => {
    const base = premiumRow({ premium_multiplier: 1.0, sample_size: 3, confidence: 'low' });
    const hot = [obs('o1', { totalM: 4500 }), obs('o2', { totalM: 4500 })]; // premium 4.5 each (≤ 5 → kept)
    const up = blendBuyerPremiums([base], hot, COMPANIES, NOW, publicDeals());
    expect(up.rows[0].premium_multiplier).toBe(1.5);
    expect(up.rows[0].sample_size).toBe(5);
    expect(up.rows[0].confidence).toBe('medium');
    const cold = [obs('o1', { totalM: 100 }), obs('o2', { totalM: 100 })]; // premium 0.1 each
    const down = blendBuyerPremiums([base], cold, COMPANIES, NOW, publicDeals());
    expect(down.rows[0].premium_multiplier).toBe(0.7);
  });

  it('never divides by our ask: the premium is signed total ÷ peer median', () => {
    // one observation at exactly the peer median → premium 1.0 regardless of any ask
    const observations = [obs('o1', { totalM: 1000 }), obs('o2', { totalM: 1000 })];
    const out = blendBuyerPremiums([premiumRow({ premium_multiplier: 1.0, sample_size: 0 })], observations, COMPANIES, NOW, publicDeals());
    expect(out.rows[0].premium_multiplier).toBe(1);
  });

  it('skips buyers with fewer than two observations, without a base row, or without peers', () => {
    const one = blendBuyerPremiums([premiumRow()], [obs('o1')], COMPANIES, NOW, publicDeals());
    expect(one.rows).toHaveLength(0);
    expect(one.notes[0]).toContain(`need ${MIN_OBSERVATIONS_PER_BUYER}`);

    const noBase = blendBuyerPremiums([], [obs('o1'), obs('o2')], COMPANIES, NOW, publicDeals());
    expect(noBase.rows).toHaveLength(0);
    expect(noBase.notes[0]).toContain('no counterparty_premiums base row');

    const noPeers = blendBuyerPremiums([premiumRow()], [obs('o1'), obs('o2')], COMPANIES, NOW, []);
    expect(noPeers.rows).toHaveLength(0);
    expect(noPeers.notes[0]).toContain('had a peer median');

    // an unresolvable buyer is counted, not blended
    const unknown = blendBuyerPremiums([premiumRow()], [obs('o1', { licenseeName: 'Nobody' }), obs('o2', { licenseeName: 'Nobody' })], COMPANIES, NOW, publicDeals());
    expect(unknown.rows).toHaveLength(0);
    expect(unknown.notes).toEqual(['2 observations without a resolvable buyer']);
  });

  it('is idempotent: the blended row is re-derived from the un-blended base, and an unchanged result writes nothing', () => {
    const observations = [obs('o1', { totalM: 1500 }), obs('o2', { totalM: 900, signedDate: '2024-03-01' })];
    const first = blendBuyerPremiums([premiumRow()], observations, COMPANIES, NOW, publicDeals());
    const written: PremiumRow = { id: 'pr-2', ...first.rows[0] };
    // 02:20 run, same observations: base is still the 07-01 row, result identical → no row
    const again = blendBuyerPremiums([premiumRow(), written], observations, COMPANIES, NOW, publicDeals());
    expect(again.rows).toHaveLength(0);
    expect(again.buyersTouched).toBe(0);
    expect(again.notes[0]).toContain('unchanged');
    // a third observation arrives: re-blended from the base (n = 10, not 12), a new row
    const more = blendBuyerPremiums([premiumRow(), written], [...observations, obs('o3', { totalM: 1200 })], COMPANIES, NOW, publicDeals());
    expect(more.rows).toHaveLength(1);
    expect(more.rows[0].sample_size).toBe(13);
    expect(more.rows[0].calculation_notes).toContain('base 2026-07-01 1.200 × n=10');
  });
});

// ─── loader + runner against a stubbed database ────────────────────────────

interface Tables {
  outcomes: Array<Record<string, unknown>>;
  companies: Array<Record<string, unknown>>;
  counterparty_premiums: Array<Record<string, unknown>>;
  deals: Array<Record<string, unknown>>;
  outcome_prior_runs: Array<Record<string, unknown>>;
}

function makeStub(tables: Tables, opts: { failTable?: string } = {}) {
  const writes: Array<{ table: string; op: string; payload: unknown }> = [];
  const stub = {
    from(table: keyof Tables) {
      if (opts.failTable === table) throw new Error(`${table} unavailable`);
      let rows = [...(tables[table] ?? [])];
      const chain: Record<string, unknown> = {};
      const self = () => chain;
      chain.select = self;
      chain.order = self;
      chain.limit = self;
      chain.or = self;
      chain.gte = self;
      chain.eq = (col: string, v: unknown) => { rows = rows.filter((r) => r[col] === v); return chain; };
      chain.is = (col: string, v: unknown) => { rows = rows.filter((r) => (v === null ? r[col] == null : r[col] === v)); return chain; };
      chain.in = (col: string, vs: unknown[]) => { rows = rows.filter((r) => vs.includes(r[col])); return chain; };
      chain.not = (col: string, op: string, v: unknown) => {
        if (op === 'is' && v === null) rows = rows.filter((r) => r[col] != null);
        return chain;
      };
      chain.upsert = (payload: unknown) => { writes.push({ table, op: 'upsert', payload }); return { then: (res: (v: unknown) => unknown) => Promise.resolve({ error: null }).then(res) }; };
      chain.insert = (payload: unknown) => { writes.push({ table, op: 'insert', payload }); return { then: (res: (v: unknown) => unknown) => Promise.resolve({ error: null }).then(res) }; };
      chain.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(res, rej);
      return chain;
    },
    writes,
  };
  return stub as unknown as SupabaseClient & { writes: typeof writes };
}

const prediction = { id: 'p1', therapeutic_area: 'oncology', phase: 'phase_2', modality: 'antibody', licensor_name: 'Acme', asset_name: 'ACM-101', indication: 'lung_nsclc' };
const outcomeRow = (id: string, over: Record<string, unknown> = {}) => ({
  id, prediction_id: `p-${id}`, matched_by: 'client', status: 'accepted', deal_id: null,
  upfront_m: '80', total_m: '1500', royalty_low: 8, royalty_high: 14, licensee_name: 'Eli Lilly and Company', licensee_id: null,
  signed_date: '2026-06-15', deal_type: 'license', resolved_at: '2026-06-20T10:00:00Z', prediction: { ...prediction, id: `p-${id}` }, ...over,
});

describe('loadClientObservations', () => {
  it('reads accepted client outcomes without a deal, joined to the prediction, and drops predictions that also have a deal-linked outcome', async () => {
    const db = makeStub({
      outcomes: [
        outcomeRow('o1'),
        outcomeRow('o2', { deal_id: 'd-9' }),                                   // linked → already in deals
        outcomeRow('o3', { matched_by: 'auto' }),                                // not a client report
        outcomeRow('o4', { status: 'rejected' }),                                // superseded
        outcomeRow('o5'),
        { ...outcomeRow('o6', { deal_id: 'd-6', matched_by: 'auto' }), prediction_id: 'p-o5' }, // o5's prediction also has a deal
      ],
      companies: [], counterparty_premiums: [], deals: [], outcome_prior_runs: [],
    });
    const list = await loadClientObservations(db);
    expect(list.map((o) => o.outcomeId)).toEqual(['o1']);
    expect(list[0]).toMatchObject({ predictionId: 'p-o1', therapeuticArea: 'oncology', phase: 'phase_2', upfrontM: 80, totalM: 1500, licenseeName: 'Eli Lilly and Company', signedDate: '2026-06-15' });
  });
});

describe('refreshOutcomePriors', () => {
  const tables = (): Tables => ({
    outcomes: [outcomeRow('o1'), outcomeRow('o2', { total_m: '900', signed_date: '2024-03-01' })],
    companies: COMPANIES as unknown as Array<Record<string, unknown>>,
    counterparty_premiums: [premiumRow() as unknown as Record<string, unknown>],
    deals: publicDeals().map((d) => ({ ...d, is_synthetic: false })),
    outcome_prior_runs: [],
  });

  it('blends, upserts the changed premium rows and records the run', async () => {
    const db = makeStub(tables());
    const report = await refreshOutcomePriors(db, { now: NOW });
    expect(report.errors).toEqual([]);
    expect(report).toMatchObject({ observations: 2, buyersTouched: 1, cellsTouched: 0, dryRun: false });
    const upsert = db.writes.find((w) => w.table === 'counterparty_premiums' && w.op === 'upsert')!;
    const rows = upsert.payload as PremiumRow[];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ company_id: LILLY, sample_size: 12, as_of_date: '2026-09-26' });
    const audit = db.writes.find((w) => w.table === 'outcome_prior_runs')!;
    expect(audit.payload).toMatchObject({ observations_used: 2, buyers_touched: 1, cells_touched: 0, ran_at: NOW.toISOString() });
    expect((audit.payload as { notes: string }).notes).toContain('Eli Lilly: 1.200 →');
  });

  it('dry run computes but writes nothing; no observations → nothing', async () => {
    const db = makeStub(tables());
    const report = await refreshOutcomePriors(db, { now: NOW, dryRun: true });
    expect(report.buyersTouched).toBe(1);
    expect(db.writes).toHaveLength(0);

    const empty = makeStub({ ...tables(), outcomes: [] });
    const none = await refreshOutcomePriors(empty, { now: NOW });
    expect(none).toMatchObject({ observations: 0, buyersTouched: 0, errors: [] });
    expect(empty.writes).toHaveLength(0);
  });

  it('writes nothing when the blended row is already current, and never throws', async () => {
    const db = makeStub(tables());
    await refreshOutcomePriors(db, { now: NOW });
    const written = (db.writes[0].payload as PremiumRow[])[0];
    const second = makeStub({ ...tables(), counterparty_premiums: [premiumRow() as unknown as Record<string, unknown>, { id: 'pr-2', ...written } as unknown as Record<string, unknown>] });
    const report = await refreshOutcomePriors(second, { now: NOW });
    expect(report.buyersTouched).toBe(0);
    expect(second.writes).toHaveLength(0);

    const broken = makeStub(tables(), { failTable: 'deals' });
    const r = await refreshOutcomePriors(broken, { now: NOW });
    expect(r.errors).toEqual(['deals unavailable']);
    expect(broken.writes).toHaveLength(0);
  });
});
