/**
 * Unit tests for the asset classification pass:
 *   lib/radar/classify-prompt.ts  (vocab-only prompt, zod gate, JSON schema)
 *   lib/radar/classify.ts         (write policy, skips, queue order, cost cap, retries, validation)
 * No network: the Anthropic client and Supabase are stubbed.
 */

import type Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import { RADAR_MODALITY_OPTIONS, RADAR_TA_OPTIONS } from '@/lib/radar/vocab';
import { inferIndicationFromConditions } from '@/lib/ingestion/clinical-trials';
import {
  ClassificationItemSchema,
  INDICATION_CATEGORIES,
  MODALITIES,
  TARGET_CLASSES,
  THERAPEUTIC_AREAS,
  buildOutputJsonSchema,
  buildSystemPrompt,
  buildUserMessage,
  type ClassificationInput,
  type ClassificationItem,
} from '@/lib/radar/classify-prompt';
import {
  CONFIDENCE_OVERWRITE_MIN,
  CONFIDENCE_WRITE_MIN,
  RequestBudget,
  RequestCapError,
  buildRequestParams,
  classifyAssetsBatch,
  classifyBatchWithModel,
  estimateCostUsd,
  fetchClassificationQueue,
  groupBySignature,
  planAssetPatch,
  planDrugMasterPatch,
  preClassify,
  supportsTemperature,
  validateClassificationSample,
  type AssetPatch,
  type ClassifierClient,
  type QueuedAsset,
} from '@/lib/radar/classify';

// ═══════════════════════════════════════════════════════════════════════
// FIXTURES
// ═══════════════════════════════════════════════════════════════════════

const NOW_ISO = '2026-09-15T12:00:00.000Z';
const NOW_MS = Date.parse(NOW_ISO);

function asset(overrides: Partial<QueuedAsset> = {}): QueuedAsset {
  return {
    id: 'a1',
    company_id: 'c1',
    company_name: 'Acme Therapeutics',
    asset_name: 'ACM-101',
    asset_aliases: ['acmelizumab'],
    indications_all: ['nsclc'],
    nct_ids: ['NCT00000001', 'NCT00000002'],
    lead_nct_id: 'NCT00000001',
    therapeutic_area: null,
    modality: null,
    indication_category: null,
    indication_specific: null,
    target: null,
    mechanism: null,
    target_class: null,
    moa_short: null,
    data_sources: ['clinicaltrials'],
    classification_status: 'unclassified',
    classification_evidence: {},
    drug_master_id: null,
    drug_resolution_status: 'unresolved',
    owner_type: 'industry',
    ...overrides,
  };
}

function item(overrides: Partial<ClassificationItem> = {}): ClassificationItem {
  return {
    asset_id: 'a1',
    therapeutic_area: 'oncology',
    indication_category: 'solid_tumor',
    indication_specific: 'non-small cell lung cancer',
    modality: 'antibody',
    target: 'PD-1',
    target_class: 'antigen',
    moa_short: 'PD-1 blocking antibody',
    confidence: 80,
    evidence: 'brief_summary',
    rationale: 'summary states anti-PD-1 antibody',
    ...overrides,
  };
}

function input(id: string, name = 'ACM-101'): ClassificationInput {
  return {
    asset_id: id,
    asset_name: name,
    aliases: [],
    company_name: 'Acme Therapeutics',
    indications_all: [],
    current: { therapeutic_area: null, modality: null, indication_category: null, indication_specific: null },
    drug_master: null,
    trials: [{ nct_id: 'NCT00000001', title: 'A study', conditions: ['NSCLC'], brief_summary: 'An anti-PD-1 antibody.' }],
    interventions: [],
  };
}

function message(results: unknown[], usage: Partial<Anthropic.Usage> = {}, stop: Anthropic.StopReason = 'end_turn'): Anthropic.Message {
  return {
    id: 'msg_1',
    type: 'message',
    role: 'assistant',
    model: 'claude-sonnet-5',
    content: [{ type: 'text', text: JSON.stringify({ results }), citations: null }],
    stop_reason: stop,
    stop_sequence: null,
    usage: {
      input_tokens: 500,
      output_tokens: 200,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 1200,
      server_tool_use: null,
      service_tier: null,
      ...usage,
    } as Anthropic.Usage,
  } as Anthropic.Message;
}

function stubClient(responses: Array<Anthropic.Message | Error>): ClassifierClient & { create: jest.Mock } {
  const create = jest.fn(async () => {
    const next = responses.shift();
    if (!next) throw new Error('stub client: no more responses');
    if (next instanceof Error) throw next;
    return next;
  });
  return { create, messages: { create } };
}

interface Call { method: string; args: unknown[] }
interface Op { table: string; calls: Call[] }
type Handler = (table: string, calls: Call[]) => { data?: unknown; error?: { message: string } | null; count?: number | null };

/** Chainable thenable Supabase stub; every query is recorded in `ops`. */
function stubSupabase(handler: Handler): { client: SupabaseClient; ops: Op[] } {
  const ops: Op[] = [];
  const methods = ['select', 'eq', 'neq', 'is', 'lt', 'gt', 'in', 'not', 'order', 'limit', 'range', 'upsert', 'insert', 'update', 'maybeSingle'];
  const from = (table: string) => {
    const calls: Call[] = [];
    ops.push({ table, calls });
    const builder: Record<string, unknown> = {};
    for (const m of methods) {
      builder[m] = (...args: unknown[]) => {
        calls.push({ method: m, args });
        return builder;
      };
    }
    builder.then = (resolve: (v: unknown) => void, reject: (e: unknown) => void) => {
      let out: unknown;
      try {
        out = { data: null, error: null, count: null, ...handler(table, calls) };
      } catch (err) {
        return Promise.reject(err).then(resolve, reject);
      }
      return Promise.resolve(out).then(resolve, reject);
    };
    return builder;
  };
  return { client: { from } as unknown as SupabaseClient, ops };
}

const has = (calls: Call[], method: string, ...args: unknown[]) =>
  calls.some(c => c.method === method && args.every((a, i) => JSON.stringify(c.args[i]) === JSON.stringify(a)));

// ═══════════════════════════════════════════════════════════════════════
// PROMPT AND VOCABULARY
// ═══════════════════════════════════════════════════════════════════════

describe('classify-prompt: vocabularies', () => {
  it('therapeutic areas and modalities are exactly the Radar vocab', () => {
    expect(THERAPEUTIC_AREAS).toEqual(RADAR_TA_OPTIONS.map(o => o.value));
    expect(MODALITIES).toEqual(RADAR_MODALITY_OPTIONS.map(o => o.value));
  });

  it('indication categories cover every category inferIndicationFromConditions emits', () => {
    const probes: Record<string, string[]> = {
      solid_tumor: ['Non-Small Cell Lung Cancer'],
      hematological: ['Multiple Myeloma'],
      cns: ['Alzheimer Disease'],
      autoimmune: ['Rheumatoid Arthritis'],
      dermatology: ['Acne Vulgaris'],
      rare_disease: ['Duchenne Muscular Dystrophy'],
      infectious: ['HIV Infections'],
      vaccine: ['Immunogenicity'],
      cardiovascular: ['Heart Failure'],
      metabolic: ['Type 2 Diabetes'],
      ophthalmology: ['Glaucoma'],
      respiratory: ['COPD'],
      renal: ['Chronic Kidney Disease'],
      gastroenterology: ['Irritable Bowel Syndrome'],
      hematology: ['Iron Deficiency Anemia'],
    };
    for (const [expected, conditions] of Object.entries(probes)) {
      const { category } = inferIndicationFromConditions(conditions);
      expect(category).toBe(expected);
      expect(INDICATION_CATEGORIES).toContain(category);
    }
  });

  it('system prompt lists every allowed value and no stale spellings', () => {
    const prompt = buildSystemPrompt();
    for (const v of [...THERAPEUTIC_AREAS, ...MODALITIES, ...INDICATION_CATEGORIES, ...TARGET_CLASSES]) {
      expect(prompt).toContain(v);
    }
    for (const stale of ['monoclonal_antibody', 'radiopharmaceutical', 'infectious_diseases', 'Phase 2']) {
      expect(prompt).not.toContain(stale);
    }
    expect(prompt).toMatch(/never change or output the development phase/i);
    expect(prompt).not.toMatch(/\d{4}-\d{2}-\d{2}/); // no dates: the prompt must be byte-stable for caching
  });

  it('system prompt is the same bytes on every call and above the 1,024-token cache minimum', () => {
    const a = buildSystemPrompt();
    const b = buildSystemPrompt();
    expect(a).toBe(b);
    expect(a.length / 4).toBeGreaterThan(1024); // ~4 chars per token
  });

  it('JSON schema enums match the zod enums', () => {
    const schema = buildOutputJsonSchema() as { properties: { results: { items: { properties: Record<string, { enum?: unknown[] }>; required: string[] } } } };
    const props = schema.properties.results.items.properties;
    expect(props.therapeutic_area.enum).toEqual([...THERAPEUTIC_AREAS, null]);
    expect(props.modality.enum).toEqual([...MODALITIES, null]);
    expect(props.indication_category.enum).toEqual([...INDICATION_CATEGORIES, null]);
    expect(props.target_class.enum).toEqual([...TARGET_CLASSES, null]);
    expect(schema.properties.results.items.required).toEqual(Object.keys(props));
  });

  it('user message is deterministic and clips long text', () => {
    const long = input('a1');
    long.trials[0].brief_summary = 'x'.repeat(5000);
    const m1 = buildUserMessage([long]);
    const m2 = buildUserMessage([long]);
    expect(m1).toBe(m2);
    expect(m1.length).toBeLessThan(2000);
    expect(m1).toContain('"asset_id":"a1"');
  });
});

describe('classify-prompt: zod gate', () => {
  it('accepts a valid item and normalizes empty strings to null', () => {
    const parsed = ClassificationItemSchema.parse({ ...item(), indication_specific: '  ', target: '' });
    expect(parsed.indication_specific).toBeNull();
    expect(parsed.target).toBeNull();
  });

  it('rejects out-of-vocabulary values', () => {
    expect(ClassificationItemSchema.safeParse(item({ therapeutic_area: 'cardiology' as never })).success).toBe(false);
    expect(ClassificationItemSchema.safeParse(item({ modality: 'monoclonal_antibody' as never })).success).toBe(false);
    expect(ClassificationItemSchema.safeParse(item({ indication_category: 'oncology' as never })).success).toBe(false);
    expect(ClassificationItemSchema.safeParse(item({ target_class: 'receptor' as never })).success).toBe(false);
    expect(ClassificationItemSchema.safeParse(item({ evidence: 'guess' as never })).success).toBe(false);
  });

  it('rejects confidence outside 0-100 and over-long text', () => {
    expect(ClassificationItemSchema.safeParse(item({ confidence: 101 })).success).toBe(false);
    expect(ClassificationItemSchema.safeParse(item({ confidence: 70.5 })).success).toBe(false);
    expect(ClassificationItemSchema.safeParse(item({ moa_short: 'x'.repeat(81) })).success).toBe(false);
    expect(ClassificationItemSchema.safeParse(item({ indication_specific: 'x'.repeat(61) })).success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// REQUEST SHAPE
// ═══════════════════════════════════════════════════════════════════════

describe('request params', () => {
  it('uses structured output, a cached system prompt, and temperature only where supported', () => {
    const sonnet = buildRequestParams('claude-sonnet-5', [input('a1')]);
    expect(sonnet.output_config?.format?.type).toBe('json_schema');
    expect(Array.isArray(sonnet.system) && sonnet.system[0].cache_control).toEqual({ type: 'ephemeral' });
    expect(sonnet.temperature).toBeUndefined();
    expect(sonnet.thinking).toEqual({ type: 'disabled' });

    const opus = buildRequestParams('claude-opus-4-6', [input('a1')]);
    expect(opus.temperature).toBe(0);
    expect(supportsTemperature('claude-sonnet-5')).toBe(false);
    expect(supportsTemperature('claude-opus-5')).toBe(false);
    expect(supportsTemperature('claude-opus-4-6')).toBe(true);
  });

  it('estimates cost at list price with cache discounts', () => {
    expect(estimateCostUsd('claude-sonnet-5', { input: 1_000_000, output: 1_000_000, cacheWrite: 0, cacheRead: 0 })).toBe(12);
    expect(estimateCostUsd('claude-sonnet-5', { input: 0, output: 0, cacheWrite: 1_000_000, cacheRead: 0 })).toBe(2.5);
    expect(estimateCostUsd('claude-sonnet-5', { input: 0, output: 0, cacheWrite: 0, cacheRead: 1_000_000 })).toBe(0.2);
    expect(estimateCostUsd('claude-opus-4-6', { input: 1_000_000, output: 0, cacheWrite: 0, cacheRead: 0 })).toBe(5);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// PRE-CLASSIFY (non-drug skip)
// ═══════════════════════════════════════════════════════════════════════

describe('preClassify', () => {
  it('skips placebo, comparator and generic-class names', () => {
    expect(preClassify({ asset_name: 'Placebo' })).toBe('placebo_or_generic');
    expect(preClassify({ asset_name: 'Standard of care' })).toBe('placebo_or_generic');
    expect(preClassify({ asset_name: 'Chemotherapy' })).toBe('placebo_or_generic');
  });

  it('skips procedures, devices and behavioural interventions', () => {
    expect(preClassify({ asset_name: 'Sham procedure' })).toBe('non_drug');
    expect(preClassify({ asset_name: 'Educational program' })).toBe('non_drug');
    expect(preClassify({ asset_name: 'Laparoscopic cholecystectomy' })).toBe('non_drug');
  });

  it('keeps drugs, code names and INNs', () => {
    expect(preClassify({ asset_name: 'Pembrolizumab' })).toBeNull();
    expect(preClassify({ asset_name: 'ABC-123' })).toBeNull();
    expect(preClassify({ asset_name: 'MK-3475 (pembrolizumab)' })).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// WRITE POLICY
// ═══════════════════════════════════════════════════════════════════════

describe('planAssetPatch: write policy', () => {
  it('confidence below 60 parks the suggestion and touches no data column', () => {
    const p = planAssetPatch(asset(), item({ confidence: CONFIDENCE_WRITE_MIN - 1 }), 'claude-sonnet-5', NOW_ISO);
    expect(p.classification_status).toBe('needs_review');
    expect(p.classification_evidence.reason).toBe('low_confidence');
    expect(p.classification_evidence.suggestion).toMatchObject({ therapeutic_area: 'oncology' });
    for (const col of ['therapeutic_area', 'modality', 'indication_category', 'indication_specific', 'target', 'target_class', 'mechanism', 'moa_short']) {
      expect(p).not.toHaveProperty(col);
    }
    expect(p.classification_confidence).toBe(59);
    expect(p.classification_model).toBe('claude-sonnet-5');
  });

  it('fills NULL columns at 60-84 and writes target fields', () => {
    const p = planAssetPatch(asset(), item({ confidence: 70 }), 'claude-sonnet-5', NOW_ISO);
    expect(p.classification_status).toBe('classified');
    expect(p.therapeutic_area).toBe('oncology');
    expect(p.modality).toBe('antibody');
    expect(p.indication_category).toBe('solid_tumor');
    expect(p.indication_specific).toBe('non-small cell lung cancer');
    expect(p.target).toBe('PD-1');
    expect(p.target_class).toBe('antigen');
    expect(p.moa_short).toBe('PD-1 blocking antibody');
    expect(p.mechanism).toBe('PD-1 blocking antibody');
    expect(p.classification_evidence.fields.therapeutic_area).toMatchObject({ action: 'filled', prior: null, source: 'model' });
    expect(p.classification_evidence.nct_ids).toEqual(['NCT00000001', 'NCT00000002']);
  });

  it('keeps an existing heuristic value below 85 and records the disagreement', () => {
    const a = asset({ therapeutic_area: 'immunology', modality: 'small_molecule' });
    const p = planAssetPatch(a, item({ confidence: 84 }), 'claude-sonnet-5', NOW_ISO);
    expect(p).not.toHaveProperty('therapeutic_area');
    expect(p).not.toHaveProperty('modality');
    expect(p.classification_evidence.fields.therapeutic_area).toMatchObject({ action: 'kept', prior: 'immunology', value: 'oncology' });
    expect(p.target).toBe('PD-1'); // target fields still written at >= 60
  });

  it('overwrites a heuristic value at >= 85 with the prior recorded', () => {
    const a = asset({ therapeutic_area: 'immunology', modality: 'small_molecule' });
    const p = planAssetPatch(a, item({ confidence: CONFIDENCE_OVERWRITE_MIN }), 'claude-sonnet-5', NOW_ISO);
    expect(p.therapeutic_area).toBe('oncology');
    expect(p.modality).toBe('antibody');
    expect(p.classification_evidence.fields.modality).toMatchObject({ action: 'overwritten', prior: 'small_molecule' });
  });

  it('confirms an agreeing value without rewriting it', () => {
    const a = asset({ therapeutic_area: 'oncology' });
    const p = planAssetPatch(a, item({ confidence: 95 }), 'claude-sonnet-5', NOW_ISO);
    expect(p).not.toHaveProperty('therapeutic_area');
    expect(p.classification_evidence.fields.therapeutic_area.action).toBe('confirmed');
  });

  it('never overwrites a manually curated row', () => {
    const a = asset({ therapeutic_area: 'immunology', target: 'IL-17A', data_sources: ['clinicaltrials', 'manual'] });
    const p = planAssetPatch(a, item({ confidence: 99 }), 'claude-sonnet-5', NOW_ISO);
    expect(p).not.toHaveProperty('therapeutic_area');
    expect(p).not.toHaveProperty('target');
    expect(p.classification_evidence.fields.target.action).toBe('kept');
  });

  it('treats modality "other" and a generic indication_specific as empty', () => {
    const a = asset({ modality: 'other', indication_category: 'solid_tumor', indication_specific: 'solid_tumor' });
    const p = planAssetPatch(a, item({ confidence: 65 }), 'claude-sonnet-5', NOW_ISO);
    expect(p.modality).toBe('antibody');
    expect(p.indication_specific).toBe('non-small cell lung cancer');
  });

  it('does not write null proposals and records target_class unknown', () => {
    const p = planAssetPatch(asset(), item({ confidence: 70, therapeutic_area: null, target: null, target_class: null, moa_short: null }), 'claude-sonnet-5', NOW_ISO);
    expect(p).not.toHaveProperty('therapeutic_area');
    expect(p).not.toHaveProperty('target');
    expect(p).not.toHaveProperty('moa_short');
    expect(p.target_class).toBe('unknown');
  });

  it('prefers a trusted drug_master modality and target over the model', () => {
    const dm = { preferred_name: 'acmelizumab', modality: 'antibody', target: 'HER2', mechanism: 'HER2 antagonist', confidence: 80 };
    const p = planAssetPatch(asset(), item({ confidence: 70, modality: 'small_molecule', target: 'PD-1' }), 'claude-sonnet-5', NOW_ISO, dm);
    expect(p.modality).toBe('antibody');
    expect(p.target).toBe('HER2');
    expect(p.classification_evidence.fields.modality.source).toBe('drug_master');
    expect(p.classification_evidence.fields.target.source).toBe('drug_master');
  });
});

describe('planDrugMasterPatch', () => {
  const dm = { preferred_name: 'acmelizumab', modality: 'antibody', target: 'HER2', mechanism: 'HER2 antagonist', confidence: 85 };

  it('reuses the node without a model call when TA is already known', () => {
    const p = planDrugMasterPatch(asset({ therapeutic_area: 'oncology' }), dm, NOW_ISO);
    expect(p?.classification_model).toBe('drug_master');
    expect(p?.classification_status).toBe('classified');
    expect(p?.modality).toBe('antibody');
    expect(p?.target).toBe('HER2');
    expect(p).not.toHaveProperty('target_class');
    expect(p?.classification_confidence).toBe(85);
  });

  it('defers to the model when the TA is missing or the node is weak', () => {
    expect(planDrugMasterPatch(asset(), dm, NOW_ISO)).toBeNull();
    expect(planDrugMasterPatch(asset({ therapeutic_area: 'oncology' }), { ...dm, confidence: 69 }, NOW_ISO)).toBeNull();
    expect(planDrugMasterPatch(asset({ therapeutic_area: 'oncology' }), { ...dm, target: null }, NOW_ISO)).toBeNull();
  });
});

describe('groupBySignature', () => {
  it('splits rows with different key sets and chunks at 100', () => {
    const base: AssetPatch = {
      id: 'x', company_name: 'A', asset_name: 'B', classification_status: 'classified', classified_at: NOW_ISO,
      classification_confidence: 70, classification_model: 'm', updated_at: NOW_ISO,
      classification_evidence: { version: 'v', model: 'm', decided_by: 'asset_name', rationale: null, nct_ids: [], fields: {} },
    };
    const rows: AssetPatch[] = [];
    for (let i = 0; i < 150; i++) rows.push({ ...base, id: `a${i}`, therapeutic_area: 'oncology' });
    rows.push({ ...base, id: 'b', modality: 'antibody' });
    const groups = groupBySignature(rows);
    expect(groups.map(g => g.length).sort((x, y) => y - x)).toEqual([100, 50, 1]);
    for (const g of groups) {
      const sig = Object.keys(g[0]).sort().join(',');
      expect(g.every(r => Object.keys(r).sort().join(',') === sig)).toBe(true);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// QUEUE ORDERING
// ═══════════════════════════════════════════════════════════════════════

describe('fetchClassificationQueue', () => {
  const row = (id: string, owner: string | null) => ({ ...asset({ id, company_id: owner ? 'c' : null }), companies: owner ? { owner_type: owner } : null });

  const handler: Handler = (table, calls) => {
    if (table !== 'clinical_assets') return {};
    const limit = (calls.find(c => c.method === 'limit')?.args[0] as number | undefined) ?? 1000;
    const page = (rows: unknown[]) => ({ data: rows.slice(0, limit) });
    if (has(calls, 'eq', 'companies.owner_type', 'industry')) return page([row('ind1', 'industry'), row('ind2', 'industry')]);
    if (has(calls, 'neq', 'companies.owner_type', 'industry')) return page([row('acad1', 'academic'), row('hosp1', 'hospital')]);
    if (has(calls, 'is', 'company_id', null)) return page([row('orphan1', null)]);
    if (has(calls, 'eq', 'classification_status', 'needs_review')) return page([row('review1', 'industry')]);
    return { data: [] };
  };

  it('returns industry first, then other owners, then orphans, then stale needs_review', async () => {
    const { client, ops } = stubSupabase(handler);
    const queue = await fetchClassificationQueue(client, 10, undefined, () => NOW_MS);
    expect(queue.map(a => a.id)).toEqual(['ind1', 'ind2', 'acad1', 'hosp1', 'orphan1', 'review1']);
    expect(queue[0].owner_type).toBe('industry');
    expect(queue[2].owner_type).toBe('academic');
    expect(queue[4].owner_type).toBeNull();

    const industryQuery = ops[0].calls;
    expect(String(industryQuery[0].args[0])).toContain('companies!clinical_assets_company_id_fkey!inner(owner_type)');
    expect(has(industryQuery, 'order', 'updated_at', { ascending: true })).toBe(true);
    expect(has(industryQuery, 'limit', 10)).toBe(true);
    // the needs_review query only takes rows older than 30 days
    const review = ops[3].calls;
    expect(has(review, 'lt', 'classified_at', '2026-08-16T12:00:00.000Z')).toBe(true);
  });

  it('stops issuing queries once the limit is reached', async () => {
    const { client, ops } = stubSupabase(handler);
    const queue = await fetchClassificationQueue(client, 3, undefined, () => NOW_MS);
    expect(queue.map(a => a.id)).toEqual(['ind1', 'ind2', 'acad1']);
    expect(ops.length).toBe(2);
    expect(has(ops[1].calls, 'limit', 1)).toBe(true);
  });

  it('honours onlyStatuses', async () => {
    const { client, ops } = stubSupabase(handler);
    const queue = await fetchClassificationQueue(client, 10, ['needs_review'], () => NOW_MS);
    expect(queue.map(a => a.id)).toEqual(['review1']);
    expect(ops.length).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// MODEL CALL: RETRIES AND CAP
// ═══════════════════════════════════════════════════════════════════════

describe('classifyBatchWithModel', () => {
  it('retries on 429/529 with backoff and counts every attempt against the cap', async () => {
    const overloaded = Object.assign(new Error('Overloaded'), { status: 529 });
    const client = stubClient([overloaded, message([item()])]);
    const budget = new RequestBudget(10);
    const sleep = jest.fn(async () => {});
    const out = await classifyBatchWithModel(client, 'claude-sonnet-5', [input('a1')], budget, sleep);
    expect(out.items.get('a1')?.target).toBe('PD-1');
    expect(client.create).toHaveBeenCalledTimes(2);
    expect(budget.requests).toBe(2);
    expect(budget.retries).toBe(1);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it('does not retry a 400', async () => {
    const bad = Object.assign(new Error('invalid request'), { status: 400 });
    const client = stubClient([bad]);
    const sleep = jest.fn(async () => {});
    await expect(classifyBatchWithModel(client, 'claude-sonnet-5', [input('a1')], new RequestBudget(10), sleep)).rejects.toThrow('invalid request');
    expect(client.create).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('throws RequestCapError before spending beyond the cap', async () => {
    const client = stubClient([message([item()])]);
    const budget = new RequestBudget(0);
    await expect(classifyBatchWithModel(client, 'claude-sonnet-5', [input('a1')], budget)).rejects.toBeInstanceOf(RequestCapError);
    expect(client.create).not.toHaveBeenCalled();
  });

  it('routes out-of-vocab items to invalid instead of dropping the batch', async () => {
    const client = stubClient([message([item(), { ...item({ asset_id: 'a2' }), modality: 'monoclonal_antibody' }])]);
    const out = await classifyBatchWithModel(client, 'claude-sonnet-5', [input('a1'), input('a2')], new RequestBudget(5));
    expect(out.items.has('a1')).toBe(true);
    expect(out.items.has('a2')).toBe(false);
    expect(out.invalid.get('a2')?.issues).toContain('modality');
  });

  it('treats a truncated response as a batch failure', async () => {
    const client = stubClient([message([item()], {}, 'max_tokens')]);
    await expect(classifyBatchWithModel(client, 'claude-sonnet-5', [input('a1')], new RequestBudget(5))).rejects.toThrow(/max_tokens/);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// END TO END (stubbed I/O)
// ═══════════════════════════════════════════════════════════════════════

function e2eHandler(queue: QueuedAsset[]): Handler {
  return (table, calls) => {
    if (table === 'clinical_assets') {
      if (has(calls, 'upsert')) return { error: null };
      if (has(calls, 'eq', 'companies.owner_type', 'industry')) {
        const limit = calls.find(c => c.method === 'limit')?.args[0] as number;
        return { data: queue.slice(0, limit).map(a => ({ ...a, companies: { owner_type: 'industry' } })) };
      }
      return { data: [] };
    }
    if (table === 'company_trials') {
      return { data: [{ nct_id: 'NCT00000001', trial_title: 'A study', conditions: ['NSCLC'], brief_summary: 'Anti-PD-1 antibody study.' }] };
    }
    if (table === 'trial_interventions') {
      return { data: [{ nct_id: 'NCT00000001', name: 'ACM-101', name_normalized: 'acm101', other_names: [], description: 'Humanized anti-PD-1 IgG4', arm_role: 'experimental' }] };
    }
    if (table === 'drug_master') return { data: [] };
    if (table === 'data_ingestion_log') return { error: null };
    return {};
  };
}

describe('classifyAssetsBatch', () => {
  it('skips non-drugs without a model call, classifies the rest, and logs tokens and cost', async () => {
    const queue = [asset({ id: 'a1' }), asset({ id: 'p1', asset_name: 'Placebo' }), asset({ id: 'a2', asset_name: 'ACM-202', asset_aliases: [] })];
    const { client: supabase, ops } = stubSupabase(e2eHandler(queue));
    const client = stubClient([message([item({ asset_id: 'a1' }), item({ asset_id: 'a2', confidence: 40 })])]);

    const result = await classifyAssetsBatch(supabase, { client, limit: 10, batchSize: 20, now: () => NOW_MS, sleep: async () => {} });

    expect(result.fetched).toBe(3);
    expect(result.skipped).toBe(1);
    expect(result.classified).toBe(1);
    expect(result.needsReview).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.processed).toBe(3);
    expect(result.requests).toBe(1);
    expect(result.tokens).toEqual({ input: 500, output: 200, cacheWrite: 0, cacheRead: 1200 });
    expect(result.estimatedCostUsd).toBeCloseTo(500 * 2 / 1e6 + 1200 * 0.2 / 1e6 + 200 * 10 / 1e6, 4);
    expect(result.cacheHitRate).toBeCloseTo(70.6, 1);
    expect(result.logged).toBe(true);

    // the model only saw the two drugs
    const sent = client.create.mock.calls[0][0] as Anthropic.MessageCreateParamsNonStreaming;
    const userText = (sent.messages[0].content as string);
    expect(userText).toContain('"asset_id":"a1"');
    expect(userText).toContain('"asset_id":"a2"');
    expect(userText).not.toContain('"asset_id":"p1"');
    expect(userText).toContain('Humanized anti-PD-1 IgG4'); // intervention description matched by name key

    // upserts: skip patch first, then the model patches (two signatures: classified vs needs_review)
    const upserts = ops.filter(o => o.table === 'clinical_assets' && has(o.calls, 'upsert'));
    const rows = upserts.flatMap(o => (o.calls.find(c => c.method === 'upsert')!.args[0] as AssetPatch[]));
    expect(rows.map(r => [r.id, r.classification_status])).toEqual(expect.arrayContaining([['p1', 'skipped'], ['a1', 'classified'], ['a2', 'needs_review']]));
    expect(rows.find(r => r.id === 'a1')?.therapeutic_area).toBe('oncology');
    expect(rows.find(r => r.id === 'a2')).not.toHaveProperty('therapeutic_area');
    for (const o of upserts) expect(o.calls.find(c => c.method === 'upsert')!.args[1]).toEqual({ onConflict: 'id' });

    // run log
    const log = ops.find(o => o.table === 'data_ingestion_log')!;
    const inserted = log.calls.find(c => c.method === 'insert')!.args[0] as Record<string, unknown>;
    expect(inserted.source).toBe('asset_universe');
    expect(inserted.status).toBe('completed');
    expect(inserted.parameters).toMatchObject({
      stage: 'classify',
      model: 'claude-sonnet-5',
      counts: { classified: 1, needs_review: 1, skipped: 1, failed: 0, from_drug_master: 0 },
      tokens: { input: 500, output: 200, cacheRead: 1200, cacheWrite: 0 },
    });
  });

  it('stops at the request cap and leaves the remainder for the next run', async () => {
    const queue = [asset({ id: 'a1' }), asset({ id: 'a2', asset_name: 'ACM-202' }), asset({ id: 'a3', asset_name: 'ACM-303' })];
    const { client: supabase } = stubSupabase(e2eHandler(queue));
    const client = stubClient([message([item({ asset_id: 'a1' })]), message([item({ asset_id: 'a2' })]), message([item({ asset_id: 'a3' })])]);

    const result = await classifyAssetsBatch(supabase, { client, limit: 10, batchSize: 1, concurrency: 1, maxRequests: 1, now: () => NOW_MS });

    expect(client.create).toHaveBeenCalledTimes(1);
    expect(result.requestCapHit).toBe(true);
    expect(result.classified).toBe(1);
    expect(result.processed).toBe(1);
    expect(result.errors.some(e => /request cap/.test(e))).toBe(true);
    expect(result.logged).toBe(true);
  });

  it('marks the run partial and retries next time when a batch fails after retries', async () => {
    const queue = [asset({ id: 'a1' })];
    const { client: supabase, ops } = stubSupabase(e2eHandler(queue));
    const err = () => Object.assign(new Error('rate limited'), { status: 429 });
    const client = stubClient([err(), err(), err()]);

    const result = await classifyAssetsBatch(supabase, { client, limit: 10, now: () => NOW_MS, sleep: async () => {} });

    expect(result.failed).toBe(1);
    expect(result.classified).toBe(0);
    expect(result.retries).toBe(2);
    expect(ops.filter(o => o.table === 'clinical_assets' && has(o.calls, 'upsert')).length).toBe(0);
    const log = ops.find(o => o.table === 'data_ingestion_log')!;
    expect((log.calls[0].args[0] as { status: string }).status).toBe('partial');
  });

  it('dry run plans without writing', async () => {
    const queue = [asset({ id: 'a1' })];
    const { client: supabase, ops } = stubSupabase(e2eHandler(queue));
    const client = stubClient([message([item({ asset_id: 'a1' })])]);
    const result = await classifyAssetsBatch(supabase, { client, limit: 10, dryRun: true, now: () => NOW_MS });
    expect(result.dryRun).toBe(true);
    expect(result.samplePatches?.[0]).toMatchObject({ id: 'a1', therapeutic_area: 'oncology' });
    expect(ops.filter(o => o.table === 'clinical_assets' && has(o.calls, 'upsert')).length).toBe(0);
    expect(result.classified).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// SAMPLE VALIDATION
// ═══════════════════════════════════════════════════════════════════════

describe('validateClassificationSample', () => {
  it('reports per-field agreement against the bulk model and writes nothing', async () => {
    const classified = (id: string, modality: string) => ({
      ...asset({
        id, therapeutic_area: 'oncology', modality, target: 'PD-1', target_class: 'antigen', indication_category: 'solid_tumor',
        classification_status: 'classified', classification_confidence: 80, classification_model: 'claude-sonnet-5',
        classification_evidence: { fields: { therapeutic_area: { value: 'oncology' }, modality: { value: modality }, target: { value: 'PD-1' } } },
      }),
      companies: { owner_type: 'industry' },
    });
    const handler: Handler = (table, calls) => {
      if (table === 'clinical_assets') {
        if (has(calls, 'upsert')) throw new Error('validation must not write');
        const sel = calls.find(c => c.method === 'select');
        if (sel && (sel.args[1] as { head?: boolean })?.head) return { count: 2 };
        return { data: [classified('a1', 'antibody'), classified('a2', 'small_molecule')] };
      }
      if (table === 'company_trials') return { data: [] };
      if (table === 'trial_interventions') return { data: [] };
      if (table === 'data_ingestion_log') return { error: null };
      return {};
    };
    const { client: supabase, ops } = stubSupabase(handler);
    const client = stubClient([
      message([item({ asset_id: 'a1', modality: 'antibody', target: 'pd1' }), item({ asset_id: 'a2', modality: 'antibody', confidence: 55 })]),
    ]);

    const report = await validateClassificationSample(supabase, { client, sample: 2, offset: 0, now: () => NOW_MS });

    expect(report.validator_model).toBe('claude-opus-4-6');
    expect(report.sampled).toBe(2);
    expect(report.compared).toBe(2);
    expect(report.fields.therapeutic_area.agreement_pct).toBe(100);
    expect(report.fields.modality.agreement_pct).toBe(50);
    expect(report.fields.target.agreement_pct).toBe(100); // 'pd1' vs 'PD-1' compared by normalized key
    expect(report.confidence.validator_below_60_where_bulk_wrote).toBe(1);
    expect(report.disagreements).toEqual([expect.objectContaining({ asset_id: 'a2', field: 'modality', bulk: 'small_molecule', validator: 'antibody' })]);
    expect(report.bulk_models).toEqual({ 'claude-sonnet-5': 2 });
    expect(report.logged).toBe(true);

    const sent = client.create.mock.calls[0][0] as Anthropic.MessageCreateParamsNonStreaming;
    expect(sent.model).toBe('claude-opus-4-6');
    expect(sent.temperature).toBe(0);
    const log = ops.find(o => o.table === 'data_ingestion_log')!;
    expect((log.calls[0].args[0] as { parameters: { stage: string } }).parameters.stage).toBe('classify_validate');
  });
});
