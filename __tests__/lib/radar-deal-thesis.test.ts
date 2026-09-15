/**
 * lib/radar/deal-thesis.ts — full-pool thesis generation.
 *
 * The comps engine (findEnrichedComparableDeals), the calculator
 * (calculateDealTerms) and partner-matching (findPartnerMatches) are mocked;
 * Supabase is a thenable builder that serves the queue RPC, the royalty
 * lookup, the thesis upsert and the run log.
 */

import fs from 'fs';
import path from 'path';

jest.mock('@/lib/comparableDeals.server', () => ({
  findEnrichedComparableDeals: jest.fn(),
}));
jest.mock('@/lib/calculations', () => ({
  calculateDealTerms: jest.fn(),
}));
jest.mock('@/lib/services/partner-matching', () => ({
  findPartnerMatches: jest.fn(),
}));

import { findEnrichedComparableDeals } from '@/lib/comparableDeals.server';
import { calculateDealTerms } from '@/lib/calculations';
import { findPartnerMatches } from '@/lib/services/partner-matching';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  MIN_COMPS_FOR_TERMS,
  MAX_ACQUIRERS,
  buildThesisRow,
  compCacheKey,
  companyNameKey,
  computeCalculatorHeadline,
  dedupeRows,
  fetchThesisQueue,
  generateDealTheses,
  generateThesis,
  isExcludedAcquirer,
  matchCalculatorIndication,
  rankAcquirersFromComps,
  rankAcquirersFromMatches,
  termsBasisFor,
  toCalculatorInput,
  upsertThesisRows,
  type ComparableSet,
  type DealComp,
  type QueuedAsset,
} from '@/lib/radar/deal-thesis';

const mockedComps = findEnrichedComparableDeals as jest.MockedFunction<typeof findEnrichedComparableDeals>;
const mockedCalc = calculateDealTerms as jest.MockedFunction<typeof calculateDealTerms>;
const mockedPartners = findPartnerMatches as jest.MockedFunction<typeof findPartnerMatches>;

// ═══════════════════════════════════════════════════════════════════════
// FIXTURES
// ═══════════════════════════════════════════════════════════════════════

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ACME_ID = uuid(1);
const BIGPHARMA_ID = uuid(2);

function asset(overrides: Partial<QueuedAsset> = {}): QueuedAsset {
  return {
    id: uuid(100),
    company_id: ACME_ID,
    company_name: 'Acme Therapeutics, Inc.',
    asset_name: 'ACM-101',
    therapeutic_area: 'oncology',
    modality: 'small_molecule',
    phase: 'phase_2',
    indication_category: 'solid_tumor',
    indication_specific: 'Non-Small Cell Lung Cancer',
    indications_all: ['Non-Small Cell Lung Cancer'],
    regulatory_designations: [],
    partnership_status: 'unpartnered',
    partner_company_id: null,
    partner_company_name: null,
    confidence_score: 60,
    thesis_generated_at: null,
    queue_reason: 'never',
    ...overrides,
  };
}

function enrichedDeal(n: number, overrides: Record<string, unknown> = {}) {
  return {
    id: uuid(1000 + n),
    parties: `Licensor ${n} / Licensee ${n}`,
    licensor: `Licensor ${n}`,
    licensee: `Licensee ${n}`,
    totalValue: '$500M',
    upfront: '$50M',
    upfrontM: 40 + n * 10,
    totalValueM: 400 + n * 100,
    year: 2026 - (n % 3),
    phase: 'phase_2',
    modality: 'small_molecule',
    indication: 'NSCLC',
    therapeuticArea: 'oncology',
    dealType: 'license',
    territory: 'global',
    buyerTier: null,
    licensorCountry: null,
    licenseeCountry: null,
    crossBorder: false,
    dealCorridor: null,
    confidenceScore: 80,
    verificationStatus: n % 2 === 0 ? 'verified' : null,
    sourceUrl: null,
    sourceType: null,
    provenanceTier: null,
    matchScore: 0.8,
    matchBreakdown: { ta: true, phase: true, adjacentPhase: false, modality: true, indication: true, dealType: true, recency: 1 },
    relevanceReasons: ['Same therapeutic area', 'Same phase'],
    ...overrides,
  };
}

function compsResult(n: number, relaxation: 'none' | 'modality_only' | 'ta_only' = 'none') {
  const deals = Array.from({ length: n }, (_, i) => enrichedDeal(i + 1));
  return {
    deals,
    benchmarkRange: { upfront: { p25: 0, median: 0, p75: 0 }, totalValue: { p25: 0, median: 0, p75: 0 }, n, nUpfront: n, nTotal: n },
    relaxation,
    excludedApprovedMA: 0,
  };
}

function dealComp(n: number, overrides: Partial<DealComp> = {}): DealComp {
  return {
    id: uuid(2000 + n),
    licensor_name: `Licensor ${n}`,
    licensee_name: `Licensee ${n}`,
    asset_name: null,
    therapeutic_area: 'oncology',
    modality: 'small_molecule',
    phase_at_signing: 'phase_2',
    upfront_m: 40 + n * 10,
    total_deal_value_m: 400 + n * 100,
    royalty_pct: 10 + n,
    royalty_low_pct: 8 + n,
    royalty_high_pct: 12 + n,
    milestones_m: 300,
    territory: 'global',
    announced_date: '2026-01-01',
    year: 2026 - (n % 3),
    deal_type: 'license',
    verification_status: n % 2 === 0 ? 'verified' : null,
    match_score: 0.8,
    relevance_reasons: [],
    ...overrides,
  };
}

function partnerMatch(n: number, overrides: Record<string, unknown> = {}) {
  return {
    company_id: uuid(3000 + n),
    company_name: `Pharma ${n}`,
    company_type: 'large_pharma',
    ticker: null,
    hq_country: 'USA',
    match_score: 90 - n,
    match_reasons: [{ category: 'modality', reason: `Active in small molecules ${n}`, strength: 'strong' }],
    score_breakdown: { modality: 0, indication: 0, phase: 0, activity: 0, strategic: 0, territory: 0, quality: 0, dealType: 0, total: 0 },
    modalities_active: [], modalities_primary: [], indications_active: [], indications_specific: [],
    deals_last_12mo: 2, deals_last_24mo: 4,
    last_deal_date: null, last_deal_modality: null, last_deal_indication: null,
    active_trials_count: 0,
    avg_upfront_usd: 60_000_000, median_upfront_usd: 50_000_000,
    phase_preference_min: null, phase_preference_max: null,
    acquisition_appetite: null, strategic_priorities: [], data_quality_score: 80,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// SUPABASE MOCK — thenable builder
// ═══════════════════════════════════════════════════════════════════════

interface Call { method: string; args: unknown[] }
interface Ctx { table?: string; rpc?: string; rpcParams?: Record<string, unknown>; op?: string; payload?: unknown; calls: Call[] }

interface MockOptions {
  queue?: QueuedAsset[];
  rpcMissing?: boolean;
  legacyAssets?: Record<string, unknown>[];
  existingTheses?: { asset_id: string; generated_at: string }[];
  extras?: Record<string, unknown>[];
  backlog?: number | null;
  /** Return this error on the first N upserts. */
  upsertErrors?: { code?: string; message: string }[];
}

function createMockSupabase(opts: MockOptions = {}) {
  const upserts: Record<string, unknown>[][] = [];
  const logs: Record<string, unknown>[] = [];
  const contexts: Ctx[] = [];
  const upsertErrors = [...(opts.upsertErrors ?? [])];

  const rangeOf = (ctx: Ctx): [number, number] | null => {
    const r = ctx.calls.find(c => c.method === 'range');
    return r ? [r.args[0] as number, r.args[1] as number] : null;
  };
  const inOf = (ctx: Ctx, col: string): unknown[] | null => {
    const c = ctx.calls.find(x => x.method === 'in' && x.args[0] === col);
    return c ? (c.args[1] as unknown[]) : null;
  };

  const resolve = async (ctx: Ctx): Promise<{ data: unknown; error: { code?: string; message: string } | null }> => {
    if (ctx.rpc === 'radar_thesis_queue') {
      if (opts.rpcMissing) return { data: null, error: { code: 'PGRST202', message: 'Could not find the function public.radar_thesis_queue' } };
      const [from, to] = rangeOf(ctx) ?? [0, 999];
      const limit = (ctx.rpcParams?.p_limit as number) ?? 3000;
      const ids = ctx.rpcParams?.p_asset_ids as string[] | null;
      let q = opts.queue ?? [];
      if (ids) q = q.filter(a => ids.includes(a.id));
      return { data: q.slice(0, limit).slice(from, to + 1), error: null };
    }
    if (ctx.rpc === 'radar_thesis_queue_count') {
      if (opts.backlog === null) return { data: null, error: { message: 'missing' } };
      return { data: [{ eligible: 10, never_generated: opts.backlog ?? 0, stale: 0, changed: 0, remaining: opts.backlog ?? 0 }], error: null };
    }
    if (ctx.table === 'clinical_assets') {
      const [from, to] = rangeOf(ctx) ?? [0, 999];
      return { data: (opts.legacyAssets ?? []).slice(from, to + 1), error: null };
    }
    if (ctx.table === 'deals') {
      const ids = inOf(ctx, 'id') ?? [];
      return { data: (opts.extras ?? []).filter(e => ids.includes(e.id)), error: null };
    }
    if (ctx.table === 'radar_deal_theses' && ctx.op === 'upsert') {
      const err = upsertErrors.shift();
      if (err) return { data: null, error: err };
      upserts.push(ctx.payload as Record<string, unknown>[]);
      return { data: null, error: null };
    }
    if (ctx.table === 'radar_deal_theses') {
      const ids = inOf(ctx, 'asset_id') ?? [];
      return { data: (opts.existingTheses ?? []).filter(t => ids.includes(t.asset_id)), error: null };
    }
    if (ctx.table === 'data_ingestion_log') {
      logs.push(ctx.payload as Record<string, unknown>);
      return { data: null, error: null };
    }
    return { data: [], error: null };
  };

  const builder = (ctx: Ctx) => {
    contexts.push(ctx);
    const b: Record<string, unknown> = {};
    for (const m of ['select', 'in', 'gte', 'order', 'eq', 'range', 'not', 'or', 'limit', 'maybeSingle', 'single']) {
      b[m] = (...args: unknown[]) => { ctx.calls.push({ method: m, args }); return b; };
    }
    b.upsert = (payload: unknown, ...args: unknown[]) => { ctx.op = 'upsert'; ctx.payload = payload; ctx.calls.push({ method: 'upsert', args }); return b; };
    b.insert = (payload: unknown) => { ctx.op = 'insert'; ctx.payload = payload; return b; };
    b.then = (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) => resolve(ctx).then(onF, onR);
    return b;
  };

  const client = {
    from: jest.fn((table: string) => builder({ table, calls: [] })),
    rpc: jest.fn((name: string, params: Record<string, unknown>) => builder({ rpc: name, rpcParams: params, calls: [] })),
  };
  return { client: client as unknown as SupabaseClient, upserts, logs, contexts };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedComps.mockImplementation(async () => compsResult(8));
  mockedCalc.mockImplementation(() => ({ terms: { upfront: { low: 60, median: 120, high: 250 }, totalDealValue: { low: 700, median: 1300, high: 2500 } } } as unknown as ReturnType<typeof calculateDealTerms>));
  mockedPartners.mockImplementation(async () => ({ total_matches: 0, matches: [], query_params: {} as never, generated_at: '' }));
});

// ═══════════════════════════════════════════════════════════════════════
// QUEUE ELIGIBILITY
// ═══════════════════════════════════════════════════════════════════════

describe('queue eligibility', () => {
  const migration = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/116_radar_theses_full_pool.sql'), 'utf8');

  it('migration 116 encodes the eligibility contract in the view', () => {
    expect(migration).toMatch(/c\.owner_type = 'industry'/);
    expect(migration).toMatch(/lead_sponsor_class, ''\)\) = 'INDUSTRY'/);
    expect(migration).toMatch(/partnership_status IN \('unpartnered', 'partially_partnered'\)/);
    expect(migration).toMatch(/confidence_score, 0\) >= 20/);
    expect(migration).toMatch(/'early_phase_1', 'phase_1', 'phase_1_2', 'phase_2', 'phase_2_3', 'phase_3'/);
    expect(migration).toMatch(/a\.phase IN \('phase_4', 'phase4'\) AND a\.partnership_status = 'unpartnered'/);
    // backlog oldest-first, then stale, then changed (gated by min age)
    expect(migration).toMatch(/t\.generated_at ASC NULLS FIRST/);
    expect(migration).toMatch(/e\.updated_at > t\.generated_at/);
    expect(migration).toMatch(/p_min_age_days/);
    // honesty-contract columns
    for (const col of ['verified_comp_count', 'terms_basis', 'calculator_upfront_mid', 'calculator_total_mid', 'profile_key', 'acquirer_method']) {
      expect(migration).toContain(col);
    }
  });

  it('calls the queue RPC with limit / refresh / min-age / ids and pages with .range()', async () => {
    const queue = Array.from({ length: 1500 }, (_, i) => asset({ id: uuid(100 + i) }));
    const { client, contexts } = createMockSupabase({ queue });
    const res = await fetchThesisQueue(client, { limit: 1500, refreshDays: 45, minAgeDays: 3, assetIds: undefined });
    expect(res.source).toBe('rpc');
    expect(res.assets).toHaveLength(1500);
    const rpcCalls = contexts.filter(c => c.rpc === 'radar_thesis_queue');
    expect(rpcCalls).toHaveLength(2);
    expect(rpcCalls[0].rpcParams).toEqual({ p_limit: 1500, p_refresh_days: 45, p_min_age_days: 3, p_asset_ids: null });
    expect(rpcCalls[0].calls.find(c => c.method === 'range')?.args).toEqual([0, 999]);
    expect(rpcCalls[1].calls.find(c => c.method === 'range')?.args).toEqual([1000, 1499]);
  });

  it('forces specific assets through p_asset_ids', async () => {
    const queue = [asset({ id: uuid(100) }), asset({ id: uuid(101) })];
    const { client, contexts } = createMockSupabase({ queue });
    const res = await fetchThesisQueue(client, { limit: 10, refreshDays: 30, minAgeDays: 7, assetIds: [uuid(101)] });
    expect(res.assets.map(a => a.id)).toEqual([uuid(101)]);
    expect(contexts.find(c => c.rpc === 'radar_thesis_queue')?.rpcParams?.p_asset_ids).toEqual([uuid(101)]);
  });

  it('legacy fallback (RPC missing) applies the phase_4-only-if-unpartnered rule and classifies refreshed rows', async () => {
    const legacyAssets = [
      { ...asset({ id: uuid(100) }) },
      { ...asset({ id: uuid(101), phase: 'phase_4', partnership_status: 'partially_partnered' }) }, // excluded
      { ...asset({ id: uuid(102), phase: 'phase_4', partnership_status: 'unpartnered' }) },          // kept
    ];
    const { client, contexts } = createMockSupabase({
      rpcMissing: true,
      legacyAssets,
      existingTheses: [{ asset_id: uuid(102), generated_at: '2026-01-01T00:00:00Z' }],
    });
    const res = await fetchThesisQueue(client, { limit: 100, refreshDays: 30, minAgeDays: 7 });
    expect(res.source).toBe('legacy_select');
    expect(res.assets.map(a => a.id)).toEqual([uuid(100), uuid(102)]);
    expect(res.assets[0].queue_reason).toBe('never');
    expect(res.assets[1].queue_reason).toBe('stale');
    expect(res.assets[1].thesis_generated_at).toBe('2026-01-01T00:00:00Z');
    const legacy = contexts.find(c => c.table === 'clinical_assets')!;
    expect(legacy.calls.find(c => c.method === 'in' && c.args[0] === 'partnership_status')?.args[1]).toEqual(['unpartnered', 'partially_partnered']);
    expect(legacy.calls.find(c => c.method === 'gte')?.args).toEqual(['confidence_score', 20]);
    expect(legacy.calls.find(c => c.method === 'range')).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// PROFILE CACHING
// ═══════════════════════════════════════════════════════════════════════

describe('profile caching', () => {
  it('calls the comps engine once per distinct profile and the calculator once per profile', async () => {
    const queue = [
      asset({ id: uuid(100) }),
      asset({ id: uuid(101), asset_name: 'ACM-102' }),
      asset({ id: uuid(102), asset_name: 'ACM-103', modality: 'Small Molecule' }), // same profile via modalityKey
      asset({ id: uuid(103), asset_name: 'ACM-201', phase: 'phase_3' }),           // different profile
    ];
    const { client, upserts } = createMockSupabase({ queue, backlog: 0 });
    const res = await generateDealTheses(client, { limit: 10 });

    expect(mockedComps).toHaveBeenCalledTimes(2);
    expect(mockedCalc).toHaveBeenCalledTimes(2);
    expect(res.profilesCached).toBe(2);
    expect(res.assetsProcessed).toBe(4);
    expect(res.generated).toBe(4);
    expect(res.refreshed).toBe(0);
    expect(res.timedOut).toBe(false);
    const rows = upserts.flat();
    expect(new Set(rows.map(r => r.profile_key)).size).toBe(2);
    expect(rows[0].profile_key).toBe(compCacheKey(queue[0]));
  });

  it('the comps engine receives the shared-path inputs (TA / modality / indication / DB phase / licensing)', async () => {
    const { client } = createMockSupabase({ queue: [asset({ phase: 'phase1_phase2' })], backlog: 0 });
    await generateDealTheses(client, { limit: 10 });
    expect(mockedComps).toHaveBeenCalledWith(
      { therapeuticArea: 'oncology', modality: 'small_molecule', indication: 'Non-Small Cell Lung Cancer', phase: 'phase_1_2', dealType: 'licensing' },
      expect.any(Number),
    );
  });

  it('counts refreshed vs generated from the queue row and reports the backlog', async () => {
    const queue = [
      asset({ id: uuid(100), thesis_generated_at: '2026-07-01T00:00:00Z', queue_reason: 'stale' }),
      asset({ id: uuid(101) }),
    ];
    const { client } = createMockSupabase({ queue, backlog: 1234 });
    const res = await generateDealTheses(client, { limit: 10 });
    expect(res.generated).toBe(1);
    expect(res.refreshed).toBe(1);
    expect(res.remainingBacklog).toBe(1234);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// INSUFFICIENT COMPS
// ═══════════════════════════════════════════════════════════════════════

describe('insufficient comps', () => {
  it('writes a marker row with no numbers, all ids used, and terms_basis = insufficient', async () => {
    mockedComps.mockImplementation(async () => compsResult(3, 'ta_only'));
    const { client, upserts } = createMockSupabase({ queue: [asset()], backlog: 0 });
    const res = await generateDealTheses(client, { limit: 10 });

    expect(res.insufficientComps).toBe(1);
    expect(res.thesesWithTerms).toBe(0);
    const row = upserts.flat()[0];
    expect(row.insufficient_comps).toBe(true);
    expect(row.terms_basis).toBe('insufficient');
    expect(row.comp_relaxation).toBe('ta_only');
    expect(row.comp_count).toBe(3);
    expect(row.comp_deal_ids).toEqual([uuid(1001), uuid(1002), uuid(1003)]);
    expect(row.verified_comp_count).toBe(1);
    expect(row.thesis_confidence).toBe(0);
    for (const col of [
      'predicted_upfront_low', 'predicted_upfront_mid', 'predicted_upfront_high',
      'predicted_total_low', 'predicted_total_mid', 'predicted_total_high',
      'predicted_royalty_low', 'predicted_royalty_mid', 'predicted_royalty_high',
    ]) {
      expect(row[col]).toBeNull();
    }
    // The calculator headline is still recorded so the UI can show "model says X, comps insufficient".
    expect(row.calculator_upfront_mid).toBe(120);
    expect(row.calculator_total_mid).toBe(1300);
  });

  it('generateThesis: a pool at the floor predicts terms; one below does not', () => {
    const a = asset();
    const below: ComparableSet = { comps: Array.from({ length: MIN_COMPS_FOR_TERMS - 1 }, (_, i) => dealComp(i)), relaxation: 'none', excludedApprovedMA: 0 };
    const at: ComparableSet = { comps: Array.from({ length: MIN_COMPS_FOR_TERMS }, (_, i) => dealComp(i)), relaxation: 'none', excludedApprovedMA: 0 };
    const t1 = generateThesis(a, below);
    expect(t1.insufficientComps).toBe(true);
    expect(t1.predictedUpfrontMid).toBeNull();
    expect(t1.compDealIds).toHaveLength(MIN_COMPS_FOR_TERMS - 1);
    const t2 = generateThesis(a, at);
    expect(t2.insufficientComps).toBe(false);
    expect(t2.predictedUpfrontMid).not.toBeNull();
    expect(t2.predictedTotalMid).not.toBeNull();
    expect(t2.predictedRoyaltyMid).not.toBeNull();
    expect(t2.thesisConfidence).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TERMS BASIS
// ═══════════════════════════════════════════════════════════════════════

describe('terms_basis mapping', () => {
  it('maps the relaxation rung; insufficient overrides', () => {
    expect(termsBasisFor('none', false)).toBe('phase_matched');
    expect(termsBasisFor('modality_only', false)).toBe('ta_modality');
    expect(termsBasisFor('ta_only', false)).toBe('ta_only');
    expect(termsBasisFor('none', true)).toBe('insufficient');
    expect(termsBasisFor('ta_only', true)).toBe('insufficient');
  });

  it('flows through generateThesis with the relaxation penalty on confidence', () => {
    const a = asset();
    const comps = Array.from({ length: 8 }, (_, i) => dealComp(i));
    const strict = generateThesis(a, { comps, relaxation: 'none', excludedApprovedMA: 0 });
    const widened = generateThesis(a, { comps, relaxation: 'ta_only', excludedApprovedMA: 0 });
    expect(strict.termsBasis).toBe('phase_matched');
    expect(widened.termsBasis).toBe('ta_only');
    expect(widened.thesisConfidence).toBe(strict.thesisConfidence - 20);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// LIKELY ACQUIRERS
// ═══════════════════════════════════════════════════════════════════════

describe('likely acquirers', () => {
  const a = asset({ partner_company_id: BIGPHARMA_ID, partner_company_name: 'BigPharma AG' });

  it('excludes the asset owner and existing partner by id or normalized name', () => {
    expect(isExcludedAcquirer({ name: 'ACME THERAPEUTICS' }, a)).toBe(true);
    expect(isExcludedAcquirer({ name: 'Acme Therapeutics Ltd.' }, a)).toBe(true);
    expect(isExcludedAcquirer({ name: 'Other Co', companyId: ACME_ID }, a)).toBe(true);
    expect(isExcludedAcquirer({ name: 'Other Co', companyId: BIGPHARMA_ID }, a)).toBe(true);
    expect(isExcludedAcquirer({ name: 'bigpharma' }, a)).toBe(true);
    expect(isExcludedAcquirer({ name: 'Novartis AG' }, a)).toBe(false);
    expect(companyNameKey('The Acme Therapeutics, Inc.')).toBe('acme therapeutics');
  });

  it('partner-matching ranking: exclusion applied, capped at 8, reason per entry', () => {
    const matches = [
      partnerMatch(0, { company_id: ACME_ID, company_name: 'Acme Therapeutics' }),
      partnerMatch(1, { company_name: 'BigPharma AG' }),
      ...Array.from({ length: 10 }, (_, i) => partnerMatch(i + 2)),
    ];
    const ranked = rankAcquirersFromMatches(matches as never, a);
    expect(ranked).toHaveLength(MAX_ACQUIRERS);
    expect(ranked.map(r => r.name)).not.toContain('Acme Therapeutics');
    expect(ranked.map(r => r.name)).not.toContain('BigPharma AG');
    expect(ranked[0]).toMatchObject({ name: 'Pharma 2', dealCount: 4, avgUpfront: 50, matchScore: 88 });
    expect(ranked[0].reason).toContain('Active in small molecules 2');
    for (const r of ranked) expect(typeof r.reason).toBe('string');
  });

  it('licensee-frequency fallback: excludes own company/partner and ranks by count', () => {
    const comps = [
      dealComp(0, { licensee_name: 'Acme Therapeutics Inc' }),
      dealComp(1, { licensee_name: 'BigPharma AG' }),
      dealComp(2, { licensee_name: 'Roche' }),
      dealComp(3, { licensee_name: 'Roche' }),
      dealComp(4, { licensee_name: 'Merck' }),
      dealComp(5, { licensee_name: 'Unknown' }),
    ];
    const ranked = rankAcquirersFromComps(comps, a);
    expect(ranked.map(r => r.name)).toEqual(['Roche', 'Merck']);
    expect(ranked[0].dealCount).toBe(2);
    expect(ranked[0].reason).toMatch(/2 comparable deals as licensee/);
  });

  it('generateThesis records acquirer_method and falls back when partner-matching has nothing', () => {
    const comps = Array.from({ length: 6 }, (_, i) => dealComp(i));
    const withMatches = generateThesis(a, { comps, relaxation: 'none', excludedApprovedMA: 0 }, { partnerMatches: [partnerMatch(5)] as never });
    expect(withMatches.acquirerMethod).toBe('partner_matching');
    expect(withMatches.likelyAcquirers[0].name).toBe('Pharma 5');
    const fallback = generateThesis(a, { comps, relaxation: 'none', excludedApprovedMA: 0 }, { partnerMatches: [] });
    expect(fallback.acquirerMethod).toBe('licensee_frequency');
    const none = generateThesis(a, { comps: [], relaxation: 'none', excludedApprovedMA: 0 });
    expect(none.acquirerMethod).toBe('none');
    expect(none.likelyAcquirers).toEqual([]);
  });

  it('run: partner-matching is called once per coarse acquirer profile and its output is excluded per asset', async () => {
    mockedPartners.mockImplementation(async () => ({
      total_matches: 2,
      matches: [partnerMatch(0, { company_id: ACME_ID, company_name: 'Acme Therapeutics' }), partnerMatch(1)] as never,
      query_params: {} as never,
      generated_at: '',
    }));
    const queue = [
      asset({ id: uuid(100) }),
      asset({ id: uuid(101), indication_specific: 'Small Cell Lung Cancer' }), // same coarse profile (category)
      // Pharma 1 is its own company and Acme is its existing partner → every match is excluded
      asset({ id: uuid(102), company_id: uuid(3001), company_name: 'Pharma 1', partner_company_id: ACME_ID, partner_company_name: 'Acme Therapeutics' }),
    ];
    const { client, upserts } = createMockSupabase({ queue, backlog: 0 });
    const res = await generateDealTheses(client, { limit: 10 });
    expect(mockedPartners).toHaveBeenCalledTimes(1);
    expect(mockedPartners.mock.calls[0][1]).toMatchObject({ modality: 'small_molecule', development_phase: 'phase_2', indication_category: 'solid_tumor', therapeutic_area: 'oncology', dealType: 'licensing' });
    expect(res.acquirerProfilesCached).toBe(1);
    const rows = upserts.flat();
    const r0 = rows.find(r => r.asset_id === uuid(100))!;
    expect(r0.acquirer_method).toBe('partner_matching');
    expect((r0.likely_acquirers as { name: string }[]).map(x => x.name)).toEqual(['Pharma 1']);
    const r2 = rows.find(r => r.asset_id === uuid(102))!;
    // own company + partner excluded → falls back to licensee frequency from the pool
    expect(r2.acquirer_method).toBe('licensee_frequency');
    const names2 = (r2.likely_acquirers as { name: string }[]).map(x => x.name);
    expect(names2).not.toContain('Pharma 1');
    expect(names2).not.toContain('Acme Therapeutics');
    expect(names2.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// CALCULATOR HEADLINE
// ═══════════════════════════════════════════════════════════════════════

describe('calculator headline', () => {
  it('maps a Radar profile onto the calculator vocabulary', () => {
    const { input, inputs } = toCalculatorInput(asset());
    expect(input).toMatchObject({ therapeuticArea: 'oncology', phase: 'phase2', modality: 'smallMolecule', indication: 'lung_nsclc', dealType: 'licensing', territory: 'global' });
    expect(inputs).toMatchObject({ indication_matched: true });
  });

  it('maps TA-dependent modalities, phases and designations', () => {
    expect(toCalculatorInput(asset({ therapeutic_area: 'rare_disease', modality: 'gene_therapy', phase: 'early_phase_1', indication_specific: 'Duchenne muscular dystrophy', regulatory_designations: ['Orphan Drug', 'Fast Track'] })).input)
      .toMatchObject({ therapeuticArea: 'rareDisease', modality: 'geneTherapyRare', phase: 'phase1', indication: 'duchenneMD', regulatoryDesignations: { orphan: true, fastTrack: true, breakthrough: false, prime: false } });
    expect(toCalculatorInput(asset({ therapeutic_area: 'hematology', modality: 'car_t', phase: 'phase_1_2', indication_specific: 'Acute myeloid leukemia' })).input)
      .toMatchObject({ modality: 'carT_heme', phase: 'phase1_2', indication: 'aml' });
    expect(toCalculatorInput(asset({ therapeutic_area: 'infectious_disease', modality: 'vaccine', phase: 'phase_3', indication_specific: 'RSV' })).input)
      .toMatchObject({ therapeuticArea: 'infectiousDisease', modality: 'vaccinePreventive', phase: 'phase3', indication: 'rsv' });
  });

  it('short ids never match as substrings (ALL vs "small cell")', () => {
    const m = matchCalculatorIndication('oncology', ['Small Cell Lung Cancer']);
    expect(m?.id).toBe('lung_sclc');
  });

  it('unmatched indication falls back to the TA-neutral id and records indication_matched=false', () => {
    const { input, inputs } = toCalculatorInput(asset({ indication_specific: 'Zebrafish syndrome', indication_category: 'solid_tumor', indications_all: [] }));
    expect(input?.indication).toBeTruthy();
    expect(inputs).toMatchObject({ indication_matched: false });
  });

  it('skips honestly when the profile cannot be mapped', () => {
    expect(toCalculatorInput(asset({ therapeutic_area: 'respiratory' })).inputs).toEqual({ skipped: 'ta_unsupported', detail: 'respiratory' });
    expect(toCalculatorInput(asset({ therapeutic_area: null })).inputs).toEqual({ skipped: 'ta_missing' });
    expect(toCalculatorInput(asset({ modality: null })).inputs).toEqual({ skipped: 'modality_missing' });
    expect(toCalculatorInput(asset({ modality: 'other' })).inputs).toEqual({ skipped: 'modality_unmapped', detail: 'other' });
    expect(toCalculatorInput(asset({ phase: 'not_applicable' })).inputs).toEqual({ skipped: 'phase_unmapped', detail: 'not_applicable' });
  });

  it('engine failure yields null numbers, never throws', () => {
    mockedCalc.mockImplementation(() => { throw new Error('boom'); });
    const h = computeCalculatorHeadline(asset());
    expect(h.upfrontMid).toBeNull();
    expect(h.totalMid).toBeNull();
    expect(h.inputs).toMatchObject({ skipped: 'engine_error', detail: 'boom' });
  });

  it('rows carry calculator_upfront_mid / total_mid and the inputs used', async () => {
    const { client, upserts } = createMockSupabase({ queue: [asset(), asset({ id: uuid(101), therapeutic_area: 'respiratory' })], backlog: 0 });
    await generateDealTheses(client, { limit: 10 });
    const rows = upserts.flat();
    const onc = rows.find(r => r.asset_id === uuid(100))!;
    expect(onc.calculator_upfront_mid).toBe(120);
    expect(onc.calculator_total_mid).toBe(1300);
    expect(onc.calculator_inputs).toMatchObject({ therapeuticArea: 'oncology', indication: 'lung_nsclc' });
    const resp = rows.find(r => r.asset_id === uuid(101))!;
    expect(resp.calculator_upfront_mid).toBeNull();
    expect(resp.calculator_inputs).toEqual({ skipped: 'ta_unsupported', detail: 'respiratory' });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// UPSERT: KEY-UNIFORM, DEDUPED, BATCHED, GRACEFUL
// ═══════════════════════════════════════════════════════════════════════

describe('upsert rows', () => {
  it('every row in a batch has the identical key set, including null-valued columns', async () => {
    mockedComps.mockImplementation(async (inputs) => (inputs.therapeuticArea === 'oncology' ? compsResult(8) : compsResult(2)));
    const queue = [
      asset({ id: uuid(100) }),
      asset({ id: uuid(101), therapeutic_area: 'respiratory', modality: null }),      // no calculator, insufficient comps
      asset({ id: uuid(102), therapeutic_area: 'neurology', indication_specific: null }),
    ];
    const { client, upserts, contexts } = createMockSupabase({ queue, backlog: 0 });
    await generateDealTheses(client, { limit: 10 });
    expect(upserts).toHaveLength(1);
    const rows = upserts[0];
    expect(rows).toHaveLength(3);
    const keySets = rows.map(r => Object.keys(r).sort().join(','));
    expect(new Set(keySets).size).toBe(1);
    expect(keySets[0]).toBe(Object.keys(buildThesisRow(generateThesis(asset(), { comps: [], relaxation: 'none', excludedApprovedMA: 0 }), '')).sort().join(','));
    const up = contexts.find(c => c.table === 'radar_deal_theses' && c.op === 'upsert')!;
    expect(up.calls.find(c => c.method === 'upsert')?.args[0]).toEqual({ onConflict: 'asset_id' });
  });

  it('dedupes on asset_id so ON CONFLICT never sees a key twice', () => {
    const rows = dedupeRows([{ asset_id: 'a', v: 1 }, { asset_id: 'b', v: 1 }, { asset_id: 'a', v: 2 }]);
    expect(rows).toEqual([{ asset_id: 'a', v: 2 }, { asset_id: 'b', v: 1 }]);
  });

  it('batches in chunks of 500', async () => {
    const queue = Array.from({ length: 1100 }, (_, i) => asset({ id: uuid(100 + i) }));
    const { client, upserts } = createMockSupabase({ queue, backlog: 0 });
    const res = await generateDealTheses(client, { limit: 2000 });
    expect(res.assetsProcessed).toBe(1100);
    expect(upserts.map(b => b.length)).toEqual([500, 500, 100]);
    expect(mockedComps).toHaveBeenCalledTimes(1);
  });

  it('strips migration-116 columns and retries when the schema is behind', async () => {
    const { client, upserts } = createMockSupabase({
      queue: [asset()],
      backlog: 0,
      upsertErrors: [{ code: 'PGRST204', message: "Could not find the 'terms_basis' column of 'radar_deal_theses' in the schema cache" }],
    });
    const res = await generateDealTheses(client, { limit: 10 });
    expect(res.errors).toEqual([]);
    expect(res.assetsProcessed).toBe(1);
    const row = upserts[0][0];
    expect(row).not.toHaveProperty('terms_basis');
    expect(row).not.toHaveProperty('profile_key');
    expect(row).toHaveProperty('comp_relaxation');
  });

  it('surfaces a non-schema upsert error instead of retrying forever', async () => {
    const state = { tier: 0 as const };
    const { client } = createMockSupabase({ upsertErrors: [{ message: 'permission denied' }] });
    const res = await upsertThesisRows(client, [{ asset_id: 'x' }], state);
    expect(res.error?.message).toBe('permission denied');
    expect(res.written).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// RUN LOG + TIME BOX
// ═══════════════════════════════════════════════════════════════════════

describe('run log', () => {
  it('writes data_ingestion_log source deal_thesis with the required counters', async () => {
    mockedComps.mockImplementation(async (inputs) => (inputs.therapeuticArea === 'oncology' ? compsResult(8) : compsResult(1)));
    const queue = [
      asset({ id: uuid(100), thesis_generated_at: '2026-07-01T00:00:00Z', queue_reason: 'stale' }),
      asset({ id: uuid(101), therapeutic_area: 'neurology' }),
    ];
    const { client, logs } = createMockSupabase({ queue, backlog: 42 });
    const res = await generateDealTheses(client, { limit: 10, refreshDays: 21, minAgeDays: 2, runType: 'manual' });
    expect(res.logWritten).toBe(true);
    expect(logs).toHaveLength(1);
    const log = logs[0];
    expect(log.source).toBe('deal_thesis');
    expect(log.status).toBe('completed');
    expect(log.run_type).toBe('manual');
    expect(log.records_fetched).toBe(2);
    expect(log.records_inserted).toBe(1);
    expect(log.records_updated).toBe(1);
    expect(log.records_skipped).toBe(1);
    expect(log.parameters).toMatchObject({
      generated: 1,
      refreshed: 1,
      insufficient: 1,
      profiles_cached: 2,
      remaining_backlog: 42,
      refresh_days: 21,
      min_age_days: 2,
      queue_source: 'rpc',
    });
    expect(typeof (log.parameters as Record<string, unknown>).duration).toBe('number');
    expect(typeof (log.parameters as Record<string, unknown>).duration_seconds).toBe('number');
  });

  it('empty queue logs a completed run with note and zero counts', async () => {
    const { client, logs } = createMockSupabase({ queue: [], backlog: 0 });
    const res = await generateDealTheses(client);
    expect(res.assetsQueued).toBe(0);
    expect(res.assetsProcessed).toBe(0);
    expect(logs[0].status).toBe('completed');
    expect((logs[0].parameters as Record<string, unknown>).note).toBe('queue empty');
  });

  it('time box: stops before writing when the budget is exhausted and marks the run partial', async () => {
    const { client, logs, upserts } = createMockSupabase({ queue: [asset(), asset({ id: uuid(101) })], backlog: 2 });
    const res = await generateDealTheses(client, { limit: 10, maxRuntimeMs: -1 });
    expect(res.timedOut).toBe(true);
    expect(res.assetsProcessed).toBe(0);
    expect(upserts).toHaveLength(0);
    expect(logs[0].status).toBe('partial');
    expect((logs[0].parameters as Record<string, unknown>).timed_out).toBe(true);
  });

  it('backlog count unavailable → remaining_backlog null, run still logged', async () => {
    const { client, logs } = createMockSupabase({ queue: [asset()], backlog: null });
    const res = await generateDealTheses(client, { limit: 10 });
    expect(res.remainingBacklog).toBeNull();
    expect((logs[0].parameters as Record<string, unknown>).remaining_backlog).toBeNull();
  });
});
