/**
 * Score archive writers: row validation, the confidential rule (inputs kept
 * only as a hash), chunked inserts that never throw, and the per-product
 * entry builders (Radar, brief, MCP). Supabase is a tiny stub — the SQL side
 * (append-only triggers, hashing, sealing) is covered by
 * scripts/score-archive/verify-migration.sh against a real Postgres.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

jest.mock('next/server', () => ({ after: jest.fn((fn: () => unknown) => { void fn(); }) }));
jest.mock('@/lib/supabase/server', () => ({ createServiceClient: jest.fn() }));

import {
  archiveScores,
  buildArchiveRow,
  hashInputs,
  sealScoreArchive,
  sha256Hex,
  stableStringify,
  type ScoreArchiveEntry,
} from '@/lib/score-archive';
import { archiveAfterResponse } from '@/lib/score-archive/after-response';
import { createServiceClient } from '@/lib/supabase/server';
import { mcpArchiveEntry } from '@/lib/score-archive/mcp';
import { briefArchiveEntry } from '@/lib/score-archive/brief';
import { radarArchiveEntry, type AssetForScoring, type ScoringResult } from '@/lib/radar/signal-detection';
import type { BriefIntelligence } from '@/lib/brief/types';

function stub(opts: { insertError?: string; throwOnInsert?: boolean; rpcData?: unknown; rpcError?: string } = {}) {
  const inserts: unknown[][] = [];
  const client = {
    from: jest.fn(() => ({
      insert: jest.fn(async (rows: unknown[]) => {
        if (opts.throwOnInsert) throw new Error('network down');
        inserts.push(rows);
        return { error: opts.insertError ? { message: opts.insertError } : null };
      }),
    })),
    rpc: jest.fn(async () => ({ data: opts.rpcData ?? [], error: opts.rpcError ? { message: opts.rpcError } : null })),
  };
  return { client: client as unknown as SupabaseClient, inserts, raw: client };
}

const base: ScoreArchiveEntry = {
  product: 'solidus',
  scoreType: 'radar.licensing_intent',
  modelVersion: 'radar-v3',
  origin: 'platform',
  entityType: 'asset',
  entityId: 'a1',
  entityLabel: 'Acme — AC-101',
  inputs: { b: 2, a: 1 },
  output: { score: 72 },
};

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('stableStringify / hashInputs', () => {
  it('sorts keys at every level and drops undefined', () => {
    expect(stableStringify({ b: 1, a: { d: undefined, c: [3, { z: 1, y: 2 }] } })).toBe('{"a":{"c":[3,{"y":2,"z":1}]},"b":1}');
  });
  it('hashes equal inputs equally regardless of key order', () => {
    expect(hashInputs({ x: 1, y: 2 })).toBe(hashInputs({ y: 2, x: 1 }));
    expect(hashInputs({ x: 1 })).not.toBe(hashInputs({ x: 2 }));
    expect(hashInputs({ x: 1 })).toBe(sha256Hex('{"x":1}'));
  });
  it('writes non-finite numbers as null', () => {
    expect(stableStringify({ a: NaN, b: Infinity })).toBe('{"a":null,"b":null}');
  });
});

describe('buildArchiveRow', () => {
  it('keeps public inputs and leaves the hash to the database', () => {
    const r = buildArchiveRow(base);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.row.inputs).toEqual({ a: 1, b: 2 });
    expect(r.row.inputs_sha256).toBeNull();
    expect(r.row.entity_label).toBe('Acme — AC-101');
    expect(r.row.industry).toBe('life_sciences');
  });

  it('drops confidential inputs and the entity label, keeping only the hash', () => {
    const r = buildArchiveRow({ ...base, confidential: true, inputs: { asset: 'Secret-1', peak: 900 } });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.row.inputs).toBeNull();
    expect(r.row.inputs_sha256).toBe(hashInputs({ asset: 'Secret-1', peak: 900 }));
    expect(r.row.entity_label).toBeNull();
    expect(JSON.stringify(r.row)).not.toContain('Secret-1');
  });

  it('accepts a caller-supplied inputs hash and rejects a malformed one', () => {
    const good = 'a'.repeat(64);
    const r = buildArchiveRow({ ...base, inputs: undefined, inputsSha256: good.toUpperCase() });
    expect(r.ok && r.row.inputs_sha256).toBe(good);
    expect(buildArchiveRow({ ...base, inputs: undefined, inputsSha256: 'xyz' }).ok).toBe(false);
  });

  it.each([
    [{ product: 'nope' }, 'product'],
    [{ origin: 'robot' }, 'origin'],
    [{ entityType: 'planet' }, 'entity type'],
    [{ scoreType: 'Has Spaces' }, 'score type'],
    [{ modelVersion: '  ' }, 'model version'],
    [{ output: null }, 'output'],
    [{ industry: 'Life Sciences' }, 'industry'],
    [{ horizonEnd: '2027/01/01' }, 'horizonEnd'],
  ])('rejects %j', (patch, msg) => {
    const r = buildArchiveRow({ ...base, ...(patch as Partial<ScoreArchiveEntry>) });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain(msg);
  });

  it('refuses rows over the size cap rather than truncating them', () => {
    const r = buildArchiveRow({ ...base, output: { blob: 'x'.repeat(70_000) } });
    expect(r.ok).toBe(false);
  });
});

describe('archiveScores', () => {
  it('inserts valid rows in chunks of 500 and counts invalid ones', async () => {
    const s = stub();
    const entries = [...Array.from({ length: 1001 }, () => base), { ...base, product: 'bad' as never }];
    const res = await archiveScores(s.client, entries);
    expect(res.inserted).toBe(1001);
    expect(res.rejected).toBe(1);
    expect(s.inserts.map((c) => c.length)).toEqual([500, 500, 1]);
    expect(s.raw.from).toHaveBeenCalledWith('score_archive');
  });

  it('never throws on a database error or a thrown client', async () => {
    await expect(archiveScores(stub({ insertError: 'permission denied' }).client, [base])).resolves.toMatchObject({ inserted: 0, rejected: 1, errors: ['permission denied'] });
    await expect(archiveScores(stub({ throwOnInsert: true }).client, [base])).resolves.toMatchObject({ inserted: 0, rejected: 1, errors: ['network down'] });
  });
});

describe('archiveAfterResponse', () => {
  it('builds entries lazily after the response and swallows builder errors', async () => {
    const s = stub();
    (createServiceClient as jest.Mock).mockReturnValue(s.client);
    archiveAfterResponse(() => [base]);
    archiveAfterResponse(() => { throw new Error('bad builder'); });
    await new Promise((r) => setImmediate(r));
    expect(s.inserts).toHaveLength(1);
  });
});

describe('sealScoreArchive', () => {
  it('returns the sealed days from the RPC', async () => {
    const s = stub({ rpcData: [{ day: '2026-09-26', row_count: 3, chain_sha256: 'f'.repeat(64) }] });
    const res = await sealScoreArchive(s.client);
    expect(s.raw.rpc).toHaveBeenCalledWith('seal_score_archive_days');
    expect(res.sealed).toHaveLength(1);
  });
  it('reports an RPC error without throwing', async () => {
    await expect(sealScoreArchive(stub({ rpcError: 'function missing' }).client)).resolves.toEqual({ sealed: [], error: 'function missing' });
  });
});

describe('radarArchiveEntry', () => {
  const asset = {
    id: 'asset-1', company_id: 'co-1', company_name: 'Acme Bio', asset_name: 'AC-101',
    modality: 'smallMolecule', therapeutic_area: 'oncology', indication_category: 'solid tumors',
    indication_specific: 'NSCLC', phase: 'phase_2', trial_status: null, partnership_status: 'unpartnered',
    nct_ids: [], trial_count: 2, confidence_score: 0.8, licensing_intent_score: 70,
  } as AssetForScoring;
  const result = {
    assetId: 'asset-1', licensingIntentScore: 81, scoreConfidence: 0.7, competitiveHeat: 40, dealReadinessScore: 60,
    factors: [], composite: {} as never, trend: 'rising', scoreDelta: 4, scoreDelta7d: null, scoreDelta30d: null,
    signalsInserted: 0, modelVersion: 'radar-v3.2', probability: 0.31, logit: -0.8, topDrivers: [], interval: null,
    contributions: [],
  } as ScoringResult;

  it('records the score, the model version and a 12-month horizon', () => {
    const e = radarArchiveEntry(asset, result, new Date('2026-09-27T03:00:00Z'));
    expect(e).toMatchObject({ scoreType: 'radar.licensing_intent', modelVersion: 'radar-v3.2', entityId: 'asset-1', horizonEnd: '2027-09-27', indication: 'NSCLC' });
    expect((e.output as { licensing_intent_score: number }).licensing_intent_score).toBe(81);
    expect(buildArchiveRow(e).ok).toBe(true);
  });
});

describe('briefArchiveEntry', () => {
  const brief = {
    asOf: '2026-09-27',
    asset: { assetName: 'Secret-7', company: 'StealthCo', modality: 'mab', phase: 'phase_2', indication: 'lung_nsclc', therapeuticArea: 'oncology', territory: 'global', targetDealType: 'license' },
    decision: {
      asOf: '2026-09-27', headline: 'StealthCo should partner Secret-7 now', recommendation: 'partner_now', recommendationLabel: 'Partner now',
      rationale: ['Secret-7 is differentiated'], counterparties: [], ask: { totalM: 900, upfrontM: 120, royaltyPct: null },
      floor: { totalM: 600, upfrontM: 80 }, walkAwayUpfrontM: 70, levers: [], wouldChangeView: [], timeline: [], confidence: 'medium', confidenceBasis: 'x',
    },
    buyerMap: {
      source: {} as never, excluded: [], mix: { large: 1, mid: 0, unknown: 0, regions: [] },
      process: { lead: ['BigPharma'], tension: ['OtherPharma'], hold: [], rationale: 'Secret-7 fits BigPharma' },
      candidates: [{ companyId: 'c9', name: 'BigPharma', fit: 88, urgency: 70, intentScore: 64 }],
    },
  } as unknown as BriefIntelligence;

  it('keeps the numbers and public buyers, never the client asset or prose', () => {
    const e = briefArchiveEntry(brief, { requestId: 'req-1', predictionId: 'p-1', modelVersion: 'brief-v3.1', priorsAsOf: '2026-09-20|2026-07-01' });
    expect(e).not.toBeNull();
    const built = buildArchiveRow(e!);
    expect(built.ok).toBe(true);
    const text = JSON.stringify(built.ok ? built.row : null);
    expect(text).not.toContain('Secret-7');
    expect(text).not.toContain('StealthCo');
    expect(text).toContain('BigPharma');
    expect(text).toContain('"walk_away_upfront_m":70');
  });

  it('returns null when the brief carries no call', () => {
    expect(briefArchiveEntry({ ...brief, decision: null, bridge: null }, { requestId: 'r', predictionId: null, modelVersion: 'v', priorsAsOf: null })).toBeNull();
  });
});

describe('mcpArchiveEntry', () => {
  const ok = { content: [{ type: 'text', text: '{"upfront":120}' }] };

  it('archives scoring tools with hashed caller inputs', () => {
    const e = mcpArchiveEntry('calculate_deal_terms', { therapeuticArea: 'oncology', phase: 'phase2', peakSalesMedian: 900 }, ok);
    expect(e).toMatchObject({ scoreType: 'mcp.calculate_deal_terms', origin: 'api', confidential: true, therapeuticArea: 'oncology' });
    const built = buildArchiveRow(e!);
    expect(built.ok && built.row.inputs).toBeNull();
    expect(built.ok && (built.row.output as { text: string }).text).toBe('{"upfront":120}');
  });

  it('skips lookups, errors and empty responses', () => {
    expect(mcpArchiveEntry('get_comparable_deals', {}, ok)).toBeNull();
    expect(mcpArchiveEntry('calculate_deal_terms', {}, { ...ok, isError: true })).toBeNull();
    expect(mcpArchiveEntry('calculate_deal_terms', {}, { content: [] })).toBeNull();
  });

  it('keeps only the hash and a head for very large responses', () => {
    const big = { content: [{ type: 'text', text: 'y'.repeat(60_000) }] };
    const out = mcpArchiveEntry('run_rnpv_model', {}, big)!.output as { truncated: boolean; text_sha256: string; head: string };
    expect(out.truncated).toBe(true);
    expect(out.text_sha256).toBe(sha256Hex('y'.repeat(60_000)));
    expect(out.head).toHaveLength(4000);
  });
});
