const rpc = jest.fn();
jest.mock('@supabase/supabase-js', () => ({ createClient: () => ({ rpc }) }));

import { __resetSpendGuardCache, guardedFetch, laneFor, overCap, spendCaps, usageCostUsd } from '@/lib/ai/spend-guard';

const lean = {} as unknown as NodeJS.ProcessEnv;
const full = { AI_BUDGET_MODE: 'full' } as unknown as NodeJS.ProcessEnv;

describe('AI spend guard', () => {
  beforeEach(() => {
    __resetSpendGuardCache();
    rpc.mockReset();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://db';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'k';
  });

  it('puts user-facing, new-deal and bulk work in separate lanes', () => {
    expect(laneFor('radar-search')).toBe('interactive');
    expect(laneFor('sec-edgar')).toBe('core');
    expect(laneFor('asset-classify')).toBe('bulk');
    expect(laneFor('something-new')).toBe('bulk');
  });

  it('has low lean caps, higher full caps, and honours env overrides', () => {
    expect(spendCaps(lean)).toEqual({ background: 12, bulk: 6, interactive: 5 });
    expect(spendCaps(full).background).toBe(150);
    expect(spendCaps({ AI_DAILY_CAP_USD: '20', AI_BULK_SHARE: '0.25' } as unknown as NodeJS.ProcessEnv)).toEqual({ background: 20, bulk: 5, interactive: 5 });
  });

  it('stops bulk before core, and never lets background spend touch the interactive pool', () => {
    const caps = { background: 12, bulk: 6, interactive: 5 };
    const t = { interactive: 0, core: 3, bulk: 6 };
    expect(overCap('bulk', t, caps)).toMatch(/^bulk/);
    expect(overCap('core', t, caps)).toBeNull();
    expect(overCap('core', { ...t, core: 6 }, caps)).toMatch(/^background/);
    expect(overCap('interactive', { interactive: 1, core: 99, bulk: 99 }, caps)).toBeNull();
    expect(overCap('interactive', { interactive: 5, core: 0, bulk: 0 }, caps)).toMatch(/^interactive/);
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
    const res = await guardedFetch('asset-classify', inner)('https://api.anthropic.com/v1/messages', { method: 'POST', body: '{"model":"claude-sonnet-5"}' });
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

  it('passes non-message requests straight through', async () => {
    const inner = jest.fn().mockResolvedValue(new Response('{}'));
    await guardedFetch('asset-classify', inner)('https://api.anthropic.com/v1/messages/batches/abc', { method: 'GET' });
    expect(inner).toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
});
