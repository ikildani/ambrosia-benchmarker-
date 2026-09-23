import { classifyCreditErrors, shouldAlert, buildCreditAlert } from '@/lib/ingestion/credit-sentinel';

const pplx = '["Mega-deal sweep error: Error: Perplexity API error: 401 {\\"error\\":{\\"message\\":\\"You exceeded your current quota, add credits\\",\\"type\\":\\"insufficient_quota\\"}}"]';
const anth = '["Merck filing: Error: 400 {\\"type\\":\\"error\\",\\"error\\":{\\"type\\":\\"invalid_request_error\\",\\"message\\":\\"Your credit balance is too low to access the Anthropic API.\\"}}"]';

describe('classifyCreditErrors', () => {
  it('groups failing runs by vendor and tracks sources and time span', () => {
    const rows = [
      { source: 'perplexity_discovery', started_at: '2026-09-23T04:00:48Z', errors: JSON.parse(pplx) },
      { source: 'deal_verification', started_at: '2026-09-23T06:00:04Z', errors: ['Perplexity 401 for Actelion/Johnson & Johnson'] },
      { source: 'sec_10k_ingest', started_at: '2026-09-23T05:00:00Z', errors: JSON.parse(anth) },
      { source: 'edgar_realtime', started_at: '2026-09-23T05:30:00Z', errors: ['Skipped hit without resolvable URL'] },
    ];
    const out = classifyCreditErrors(rows);
    expect(out.map(o => o.vendor)).toEqual(['anthropic', 'perplexity']);
    const p = out.find(o => o.vendor === 'perplexity')!;
    expect(p.failingRuns).toBe(2);
    expect(p.sources).toEqual(['perplexity_discovery', 'deal_verification']);
    expect(p.firstSeen).toBe('2026-09-23T04:00:48Z');
    expect(p.lastSeen).toBe('2026-09-23T06:00:04Z');
  });

  it('ignores unrelated errors', () => {
    expect(classifyCreditErrors([{ source: 'openfda', started_at: '2026-09-23T03:00:00Z', errors: ['null value in column licensee_name'] }])).toEqual([]);
  });
});

describe('shouldAlert', () => {
  const now = new Date('2026-09-23T12:00:00Z');
  it('alerts when never alerted', () => expect(shouldAlert({}, 'perplexity', now)).toBe(true));
  it('suppresses inside the cooldown', () => expect(shouldAlert({ perplexity: '2026-09-23T08:00:00Z' }, 'perplexity', now)).toBe(false));
  it('re-alerts after the cooldown', () => expect(shouldAlert({ perplexity: '2026-09-23T05:00:00Z' }, 'perplexity', now)).toBe(true));
});

describe('buildCreditAlert', () => {
  it('names the vendor, the top-up link and the inflow context', () => {
    const msg = buildCreditAlert([{ vendor: 'perplexity', failingRuns: 12, sources: ['perplexity_discovery'], firstSeen: '2026-09-22T12:00:49Z', lastSeen: '2026-09-23T08:00:48Z' }], { lastDealInsert: '2026-09-06T04:03:39Z', pendingVerification: 55 });
    expect(msg.text).toContain('Perplexity');
    const json = JSON.stringify(msg.blocks);
    expect(json).toContain('perplexity.ai/settings/api');
    expect(json).toContain('12 failing runs');
    expect(json).toContain('pending verification: 55');
  });
});
