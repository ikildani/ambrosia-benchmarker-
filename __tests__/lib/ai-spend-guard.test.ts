const rpc = jest.fn();
jest.mock('@supabase/supabase-js', () => ({ createClient: () => ({ rpc }) }));

import { __resetSpendGuardCache, backlogBlocked, backlogPlan, groupOf, guardedFetch, laneFor, overCap, spendCaps, usageCostUsd } from '@/lib/ai/spend-guard';

const lean = {} as unknown as NodeJS.ProcessEnv;
const full = { AI_BUDGET_MODE: 'full' } as unknown as NodeJS.ProcessEnv;

describe('AI spend guard', () => {
  beforeEach(() => {
    __resetSpendGuardCache();
    rpc.mockReset();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://db';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'k';
  });

  it('puts the product, Search & Evaluation, new-deal and bulk work in separate lanes', () => {
    expect(laneFor('deal-memo')).toBe('interactive');
    expect(laneFor('radar-search')).toBe('search');
    expect(laneFor('radar-narrative')).toBe('search');
    expect(laneFor('sec-edgar')).toBe('core');
    expect(laneFor('asset-classify')).toBe('bulk');
    expect(laneFor('something-new')).toBe('bulk');
  });

  it('has low lean caps, higher full caps, and honours env overrides', () => {
    expect(spendCaps(lean)).toEqual({ background: 6, bulk: 2, interactive: 5, search: 1, coreReserve: 2, exchange: 1.5 });
    expect(spendCaps(full).background).toBe(150);
    expect(spendCaps({ AI_DAILY_CAP_USD: '20', AI_BULK_SHARE: '0.25' } as unknown as NodeJS.ProcessEnv)).toEqual({ background: 20, bulk: 5, interactive: 5, search: 1, coreReserve: 2, exchange: 1.5 });
    expect(spendCaps({ AI_CORE_RESERVE_USD: '3', AI_EXCHANGE_DAILY_USD: '1' } as unknown as NodeJS.ProcessEnv)).toMatchObject({ coreReserve: 3, exchange: 1 });
    expect(spendCaps({ AI_DAILY_CAP_USD: '1' } as unknown as NodeJS.ProcessEnv)).toMatchObject({ coreReserve: 1, exchange: 1 });
  });

  it('stops bulk before core, and never lets background spend touch the interactive pool', () => {
    const caps = { background: 12, bulk: 6, interactive: 5, search: 1, coreReserve: 0, exchange: 12 };
    const t = { interactive: 0, search: 0, core: 3, bulk: 6 };
    expect(overCap('bulk', t, caps)).toMatch(/^bulk/);
    expect(overCap('core', t, caps)).toBeNull();
    expect(overCap('core', { ...t, core: 6 }, caps)).toMatch(/^background/);
    expect(overCap('interactive', { interactive: 1, search: 99, core: 99, bulk: 99 }, caps)).toBeNull();
    expect(overCap('interactive', { interactive: 5, search: 0, core: 0, bulk: 0 }, caps)).toMatch(/^interactive/);
    expect(overCap('search', { interactive: 0, search: 1, core: 0, bulk: 0 }, caps)).toMatch(/^search/);
  });

  it('labels every ingestion source and groups them for the reserve and the exchange cap', () => {
    for (const s of ['edgar-realtime', 'hkex', 'hkex-backfill', 'asx', 'dart', 'cninfo', 'tdnet', 'mfn', 'primary-verify', 're-extract-pending']) expect(laneFor(s)).toBe('core');
    expect(laneFor('edgar-fts-backfill')).toBe('bulk');
    expect(laneFor('wire-archive')).toBe('bulk');
    expect(groupOf('edgar-realtime')).toBe('reserved');
    expect(groupOf('press-releases')).toBe('reserved');
    expect(groupOf('flag-fixer')).toBe('reserved');
    expect(groupOf('hkex-backfill')).toBe('exchange');
    expect(groupOf('cninfo:batch')).toBe('exchange');
    expect(groupOf('asset-classify')).toBeNull();
  });

  describe('reserved slice for EDGAR, newswires and verification (lean $6, $2 reserved, exchanges $1.50)', () => {
    const caps = spendCaps({} as unknown as NodeJS.ProcessEnv);
    const lanes = (core: number, bulk: number) => ({ interactive: 0, search: 0, core, bulk });

    it('stops exchange and bulk sources $2 short of the cap while EDGAR/newswires have not spent', () => {
      // Exchanges $1.50 + bulk $2.00 + other core $0.50 = $4.00 = cap - reserve.
      const groups = { reserved: 0, exchange: 1.4 };
      expect(overCap('core', lanes(2, 2), caps, { source: 'hkex', groups })).toMatch(/held for EDGAR/);
      expect(overCap('bulk', lanes(2.1, 1.9), caps, { source: 'asset-classify', groups })).toMatch(/held for EDGAR/);
      expect(overCap('core', lanes(2, 2), caps, { source: 'edgar-realtime', groups })).toBeNull();
      expect(overCap('core', lanes(2, 2), caps, { source: 'press-releases', groups })).toBeNull();
      expect(overCap('core', lanes(2, 2), caps, { source: 'primary-verify', groups })).toBeNull();
    });

    it('releases the reserve as the reserved sources spend it, and never lets total background pass the cap', () => {
      expect(overCap('core', lanes(3, 2), caps, { source: 'cninfo', groups: { reserved: 1, exchange: 0.5 } })).toMatch(/held/); // $5 >= $6 - $1
      expect(overCap('core', lanes(3, 2), caps, { source: 'cninfo', groups: { reserved: 2, exchange: 0.5 } })).toBeNull();
      expect(overCap('core', lanes(4, 2), caps, { source: 'edgar-realtime', groups: { reserved: 2, exchange: 0.5 } })).toMatch(/^background \$6.00 of \$6.00$/);
    });

    it('caps the exchange scanners together', () => {
      expect(overCap('core', lanes(1.5, 0), caps, { source: 'dart', groups: { reserved: 0, exchange: 1.5 } })).toMatch(/^exchanges/);
      expect(overCap('core', lanes(1.5, 0), caps, { source: 'sec-edgar', groups: { reserved: 0, exchange: 1.5 } })).toBeNull();
    });

    it('falls back to the lane caps when the per-source ledger cannot be read', () => {
      expect(overCap('core', lanes(3.9, 2), caps, { source: 'hkex', groups: null })).toBeNull();
      expect(overCap('core', lanes(3.9, 2), caps)).toBeNull();
    });
  });

  it('prices dated model ids by family and unknown models at the Opus rate', () => {
    expect(usageCostUsd('claude-haiku-4-5-20251001', { input_tokens: 1_000_000 })).toBeCloseTo(1);
    expect(usageCostUsd('claude-sonnet-5', { input_tokens: 1_000_000, output_tokens: 100_000 })).toBeCloseTo(3);
    expect(usageCostUsd('mystery', { output_tokens: 1_000_000 })).toBeCloseTo(25);
    expect(usageCostUsd('claude-opus-4-6', { output_tokens: 1_000_000 }, 0.5)).toBeCloseTo(12.5);
  });

  it('records usage after a successful call', async () => {
    rpc.mockResolvedValueOnce({ data: [], error: null }).mockResolvedValue({ data: null, error: null });
    const inner = jest.fn().mockResolvedValue(new Response(JSON.stringify({ model: 'claude-sonnet-5', usage: { input_tokens: 1000, output_tokens: 100 } }), { status: 200, headers: { 'content-type': 'application/json' } }));
    const res = await guardedFetch('sec-edgar', inner)('https://api.anthropic.com/v1/messages', { method: 'POST', body: JSON.stringify({ model: 'claude-sonnet-5' }) });
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenLastCalledWith('ai_spend_record', expect.objectContaining({ p_lane: 'core', p_source: 'sec-edgar', p_calls: 1, p_input: 1000, p_output: 100, p_usd: 0.003 }));
  });

  it('refuses with a non-retryable 429 once the lane is over its cap, without calling the API', async () => {
    rpc.mockResolvedValueOnce({ data: [{ lane: 'bulk', usd: 7 }], error: null }).mockResolvedValue({ data: null, error: null });
    const inner = jest.fn();
    const res = await guardedFetch('completeness-audit', inner)('https://api.anthropic.com/v1/messages', { method: 'POST', body: '{"model":"claude-sonnet-5"}' });
    expect(inner).not.toHaveBeenCalled();
    expect(res.status).toBe(429);
    expect(res.headers.get('x-should-retry')).toBe('false');
    expect(rpc).toHaveBeenLastCalledWith('ai_spend_record', expect.objectContaining({ p_blocked: 1, p_usd: 0 }));
  });

  it('fails open when the ledger cannot be read', async () => {
    rpc.mockRejectedValueOnce(new Error('down')).mockResolvedValue({ data: null, error: null });
    const inner = jest.fn().mockResolvedValue(new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }));
    await guardedFetch('asset-classify', inner)('https://api.anthropic.com/v1/messages', { method: 'POST', body: '{}' });
    expect(inner).toHaveBeenCalled();
  });

  it('draws on the backlog allowance per source until its share, the total or the daily pace is spent', () => {
    const plan = backlogPlan({} as unknown as NodeJS.ProcessEnv);
    expect(plan.totalUsd).toBe(115);
    expect(backlogBlocked('company-family', {}, 0, plan)).toBeNull();
    expect(backlogBlocked('company-family', { 'company-family': 10 }, 0, plan)).toMatch(/share/);
    expect(backlogBlocked('hkex-pipeline', {}, 0, plan)).toBeNull();
    expect(backlogBlocked('asset-classify', {}, 0, plan)).toBeNull();
    expect(backlogBlocked('sec-edgar', {}, 0, plan)).toMatch(/not a backlog source/);
    expect(backlogBlocked('asset-classify', { 'asset-classify': 40 }, 0, plan)).toMatch(/share/);
    expect(backlogBlocked('pipeline-pages', { 'asset-classify': 40, 'pipeline-pages': 34, 'preclinical-pipeline': 16, 'hkex-pipeline': 15, 'company-family': 10 }, 0, plan)).toMatch(/^backlog \$115/);
    expect(backlogBlocked('pipeline-pages', {}, 15, plan)).toMatch(/today/);
    expect(backlogPlan({ AI_BACKLOG_TOTAL_USD: '0' } as unknown as NodeJS.ProcessEnv).totalUsd).toBe(0);
    expect(backlogPlan({ AI_BACKLOG_COMPANY_FAMILY_USD: '0' } as unknown as NodeJS.ProcessEnv).sources['company-family']).toBeUndefined();
  });

  it('charges a backlog source to the backlog lane while it has allowance', async () => {
    rpc.mockImplementation(async (fn: string) => {
      if (fn === 'ai_spend_today') return { data: [{ lane: 'bulk', usd: 99 }], error: null };
      if (fn === 'ai_spend_backlog') return { data: [{ source: 'asset-classify', usd: 1 }], error: null };
      return { data: null, error: null };
    });
    const inner = jest.fn().mockResolvedValue(new Response(JSON.stringify({ model: 'claude-sonnet-5', usage: { input_tokens: 1000, output_tokens: 100 } }), { status: 200, headers: { 'content-type': 'application/json' } }));
    const res = await guardedFetch('asset-classify', inner)('https://api.anthropic.com/v1/messages', { method: 'POST', body: '{"model":"claude-sonnet-5"}' });
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenLastCalledWith('ai_spend_record', expect.objectContaining({ p_lane: 'backlog', p_source: 'asset-classify' }));
    rpc.mockReset();
  });

  it('passes non-message requests straight through', async () => {
    const inner = jest.fn().mockResolvedValue(new Response('{}'));
    await guardedFetch('asset-classify', inner)('https://api.anthropic.com/v1/messages/batches/abc', { method: 'GET' });
    expect(inner).toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
});
