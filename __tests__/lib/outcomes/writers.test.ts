/**
 * Writers: dedupe, the calculator row, the brief prediction from a v3
 * BriefIntelligence fixture, and the Radar writer flag. Supabase is a tiny
 * chainable stub — no database.
 */

import type { BriefIntelligence } from '@/lib/brief/types';
import {
  BRIEF_MODEL_VERSION,
  buildBriefPrediction,
  buildCalculatorPrediction,
  calculatorFingerprint,
  recordBriefPrediction,
  recordCalculatorPrediction,
  recordRadarPredictions,
} from '@/lib/outcomes/writers';
import type { SupabaseClient } from '@supabase/supabase-js';

// ─── chainable stub ────────────────────────────────────────────────────────

interface Call { table: string; op: string; payload?: unknown }

function makeStub(responses: { selectRows?: unknown[]; insertId?: string; insertError?: string | null } = {}) {
  const calls: Call[] = [];
  const stub = {
    from(table: string) {
      const chain: Record<string, unknown> = {};
      const self = () => chain;
      const result = { data: responses.selectRows ?? [], error: null };
      for (const m of ['select', 'eq', 'is', 'gte', 'gt', 'in', 'order', 'limit']) chain[m] = jest.fn(self);
      chain.insert = jest.fn((payload: unknown) => { calls.push({ table, op: 'insert', payload }); return chain; });
      chain.single = jest.fn(() => Promise.resolve(responses.insertError ? { data: null, error: { message: responses.insertError } } : { data: { id: responses.insertId ?? 'new-id' }, error: null }));
      chain.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(result).then(res, rej);
      calls.push({ table, op: 'from' });
      return chain;
    },
    calls,
  };
  return stub as unknown as SupabaseClient & { calls: Call[] };
}

const NOW = new Date('2026-09-25T12:00:00Z');

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

// ─── calculator ────────────────────────────────────────────────────────────

const calcInput = {
  userId: 'u1',
  calculationId: 'calc-1',
  fingerprint: null,
  therapeuticArea: 'oncology',
  modality: 'antibody',
  phase: 'Phase 2',
  indication: 'NSCLC',
  dealType: 'license',
  territory: 'global',
  licensorName: 'Acme Therapeutics',
  outputs: { upfront_low: 30, upfront_mid: 50, upfront_high: 80, total_deal_value_low: 300, total_deal_value_high: 900, royalty_low: 8, royalty_high: 14 },
};

describe('calculator writer', () => {
  it('builds a $M row with a normalized phase, derived total mid and a stable fingerprint', () => {
    const row = buildCalculatorPrediction(calcInput, NOW)!;
    expect(row.source).toBe('calculator');
    expect(row.phase).toBe('phase_2');
    expect(row.upfront_mid).toBe(50);
    expect(row.total_mid).toBe(600);
    expect(row.licensor_name).toBe('Acme Therapeutics');
    expect(row.resolve_after).toBe('2026-10-25T12:00:00.000Z');
    expect(row.fingerprint).toBe(calculatorFingerprint(calcInput));
    expect(calculatorFingerprint({ ...calcInput, fingerprint: ' fp-abc ' })).toBe('fp-abc');
  });

  it('inserts when nothing recent matches', async () => {
    const db = makeStub({ selectRows: [] });
    const res = await recordCalculatorPrediction(db, calcInput, NOW);
    expect(res).toEqual({ ok: true, id: 'new-id' });
    const inserts = db.calls.filter((c) => c.op === 'insert');
    expect(inserts).toHaveLength(1);
    expect((inserts[0].payload as { user_id: string }).user_id).toBe('u1');
  });

  it('dedupes on (user, fingerprint) inside 24 h', async () => {
    const db = makeStub({ selectRows: [{ id: 'existing' }] });
    const res = await recordCalculatorPrediction(db, calcInput, NOW);
    expect(res).toEqual({ ok: false, reason: 'deduped' });
    expect(db.calls.filter((c) => c.op === 'insert')).toHaveLength(0);
  });

  it('skips anonymous users and empty outputs without touching the database', async () => {
    const db = makeStub();
    expect(await recordCalculatorPrediction(db, { ...calcInput, userId: null }, NOW)).toEqual({ ok: false, reason: 'no_user' });
    expect(await recordCalculatorPrediction(db, { ...calcInput, outputs: null }, NOW)).toEqual({ ok: false, reason: 'no_terms' });
    expect(db.calls).toHaveLength(0);
  });

  it('never throws when the insert fails', async () => {
    const db = makeStub({ insertError: 'boom' });
    const res = await recordCalculatorPrediction(db, calcInput, NOW);
    expect(res.ok).toBe(false);
    expect(res.ok === false && res.reason).toBe('error');
  });
});

// ─── brief ─────────────────────────────────────────────────────────────────

const briefFixture: BriefIntelligence = {
  asOf: '2026-09-25',
  asset: {
    assetName: 'ACM-101',
    company: 'Acme Therapeutics',
    modality: 'small_molecule',
    phase: 'phase_2',
    indication: "Alzheimer's disease",
    therapeuticArea: 'neurology',
    territory: 'global',
    targetDealType: 'license',
  },
  bridge: {
    asOf: '2026-09-25',
    bars: [
      { key: 'comps_upfront', label: 'Comps (upfront)', basis: 'upfront', low: 20, mid: 55, high: 120, n: 14 },
      { key: 'comps_total', label: 'Comps (total)', basis: 'total', low: 300, mid: 700, high: 1500, n: 14 },
      { key: 'rnpv', label: 'rNPV', basis: 'rnpv', low: 400, mid: 650, high: 900 },
    ],
    ask: { totalM: 900, upfrontM: 75 },
    floor: { totalM: 600, upfrontM: 45 },
    walkAway: { upfrontM: 35 },
    reconciliation: 'x',
    askBasis: { total: 'comps', upfront: 'comps' },
    policy: 'ask = max(engine mid, comps ex-outlier median)',
    rnpvInformative: true,
    rnpvNote: null,
  },
  buyerMap: {
    source: { source: 'Solidus', n: 8, asOf: '2026-09-25' },
    candidates: [],
    excluded: [],
    process: { lead: ['Eli Lilly', 'Biogen'], tension: ['Eisai', 'Biogen'], hold: ['Roche'], rationale: 'x' },
    mix: { large: 3, mid: 1, unknown: 0, regions: ['north_america', 'europe'] },
  },
  landscape: {
    pipeline: null,
    funnel: null,
    catalysts: {
      source: { source: 'ClinicalTrials.gov via Solidus', n: 3, asOf: '2026-09-25' },
      windowMonths: 24,
      events: [],
      recommendedWindow: { start: '2027-03', end: '2027-09', rationale: 'after the Phase 2 readout' },
    },
  },
  decision: {
    asOf: '2026-09-25',
    headline: 'x',
    recommendation: 'partner_now',
    recommendationLabel: 'Partner now',
    rationale: [],
    counterparties: [],
    ask: { totalM: 900, upfrontM: 75, royaltyPct: { low: 8, median: 10, high: 14 } },
    floor: { totalM: 600, upfrontM: 45 },
    walkAwayUpfrontM: 35,
    levers: [],
    wouldChangeView: [],
    timeline: [],
    confidence: 'medium',
    confidenceBasis: 'x',
  },
};

describe('brief writer', () => {
  it('maps bridge ask/floor, bar highs, buyers (lead + tension, deduped) and the catalyst window', () => {
    const row = buildBriefPrediction(briefFixture, { requestId: 'req-1', userId: 'u1' }, NOW)!;
    expect(row.source).toBe('brief');
    expect(row.source_id).toBe('req-1');
    expect(row.licensor_name).toBe('Acme Therapeutics');
    expect(row.asset_name).toBe('ACM-101');
    expect(row.phase).toBe('phase_2');
    expect(row.upfront_low).toBe(45);
    expect(row.upfront_mid).toBe(75);
    expect(row.upfront_high).toBe(120);            // widest upfront bar
    expect(row.total_low).toBe(600);
    expect(row.total_mid).toBe(900);
    expect(row.total_high).toBe(1500);             // widest total bar (rnpv basis ignored)
    expect(row.royalty_low).toBe(8);
    expect(row.royalty_high).toBe(14);
    expect(row.predicted_buyers).toEqual(['Eli Lilly', 'Biogen', 'Eisai']);
    expect(row.predicted_window_start).toBe('2027-03-01');
    expect(row.predicted_window_end).toBe('2027-09-28');
    expect(row.model_version).toBe(BRIEF_MODEL_VERSION);
    expect(row.fingerprint).toBe('brief:req-1');
    expect(row.priors_as_of).toBeNull();
  });

  it('records the priors snapshot in priors_as_of and keeps model_version fixed at brief-v3.1', () => {
    expect(BRIEF_MODEL_VERSION).toBe('brief-v3.1');
    const row = buildBriefPrediction(briefFixture, { requestId: 'req-1', userId: 'u1', priorsAsOf: '2026-09-22|2026-09-26' }, NOW)!;
    expect(row.priors_as_of).toBe('2026-09-22|2026-09-26');
    expect(row.model_version).toBe('brief-v3.1');
    // the snapshot never leaks into model_version, and blanks are stored as null
    expect(buildBriefPrediction(briefFixture, { requestId: 'req-1', userId: 'u1', priorsAsOf: '  ' }, NOW)!.priors_as_of).toBeNull();
    expect(buildBriefPrediction(briefFixture, { requestId: 'req-1', userId: 'u1', modelVersion: 'brief-vX' }, NOW)!.model_version).toBe('brief-vX');
  });

  it('high never drops below the ask, and defaults to ask × 1.2 without bars', () => {
    const noBars: BriefIntelligence = { ...briefFixture, bridge: { ...briefFixture.bridge!, bars: [] } };
    const row = buildBriefPrediction(noBars, { requestId: 'r', userId: null }, NOW)!;
    expect(row.upfront_high).toBeCloseTo(90, 6);
    expect(row.total_high).toBeCloseTo(1080, 6);
  });

  it('returns null without a bridge and records nothing', async () => {
    const db = makeStub();
    const res = await recordBriefPrediction(db, { ...briefFixture, bridge: null }, { requestId: 'r', userId: null }, NOW);
    expect(res).toEqual({ ok: false, reason: 'no_terms' });
    expect(db.calls).toHaveLength(0);
  });

  it('inserts once, then dedupes on the request id', async () => {
    const first = makeStub({ selectRows: [] });
    expect(await recordBriefPrediction(first, briefFixture, { requestId: 'req-1', userId: 'u1' }, NOW)).toEqual({ ok: true, id: 'new-id' });
    const again = makeStub({ selectRows: [{ id: 'p-existing' }] });
    expect(await recordBriefPrediction(again, briefFixture, { requestId: 'req-1', userId: 'u1' }, NOW)).toEqual({ ok: false, reason: 'deduped' });
    expect(again.calls.filter((c) => c.op === 'insert')).toHaveLength(0);
  });
});

// ─── radar ─────────────────────────────────────────────────────────────────

describe('radar writer', () => {
  it('is a no-op unless OUTCOMES_RADAR_WRITER=true or forced', async () => {
    const prev = process.env.OUTCOMES_RADAR_WRITER;
    delete process.env.OUTCOMES_RADAR_WRITER;
    const db = makeStub();
    const report = await recordRadarPredictions(db, { now: NOW });
    expect(report.enabled).toBe(false);
    expect(db.calls).toHaveLength(0);
    if (prev !== undefined) process.env.OUTCOMES_RADAR_WRITER = prev;
  });
});
