import { buildFlagResolutionSlack, describeOutcome } from '@/lib/ingestion/flag-resolution-report';
import { outcomeContext, MAX_FIX_ATTEMPTS } from '@/lib/ingestion/flag-fixer';
import type { FixOutcome } from '@/lib/ingestion/flag-fixer';

const ctx = { label: 'Acme Bio → Bigco (AB-101)', flaggedBecause: 'upfront differs from the release ($20M vs $50M)' };

describe('flag resolution report', () => {
  it('states what was done for every outcome and never asks for a review', () => {
    const outcomes: FixOutcome[] = [
      { ...ctx, kind: 'fixed', dealId: 'a1', url: 'https://www.businesswire.com/news/home/x', diff: ['upfront_usd: 20000000 -> 50000000'] },
      { ...ctx, kind: 'duplicate', dealId: 'a2', keeperId: '5f402423-bd2f-4a1c-b241-9320bb9f57bf', url: null },
      { ...ctx, kind: 'rejected', dealId: 'a3', reason: 'no primary document after 3 attempts' },
      { ...ctx, kind: 'unresolved', dealId: 'a4', reason: 'no primary source found', attempt: 1, retryOn: '2026-10-02' },
    ];
    const r = buildFlagResolutionSlack({ outcomes, queued: [{ label: 'X → Y', reason: 'date mismatch' }], errors: [] });
    const all = JSON.stringify(r);
    expect(all).not.toMatch(/for review|please review|needs review|manual/i);
    for (const o of outcomes) expect(describeOutcome(o)).toContain('_Resolved:_');
    expect(all).toContain('Corrected 1');
    expect(all).toContain('Duplicates retired 1');
    expect(all).toContain('Rejected 1');
    expect(all).toContain('rejected automatically if still unsourced');
  });
  it('returns nothing when no deal was flagged', () => {
    expect(buildFlagResolutionSlack({ outcomes: [], queued: [], errors: [] })).toBeNull();
  });
  it('keeps messages within Slack block limits', () => {
    const many: FixOutcome[] = Array.from({ length: 120 }, (_, i) => ({ ...ctx, kind: 'fixed', dealId: `d${i}`, url: 'https://www.sec.gov/x', diff: ['announced_date: a -> b'] }));
    const r = buildFlagResolutionSlack({ outcomes: many, queued: [], errors: [] })!;
    expect(r.attachments[0].blocks.length).toBeLessThanOrEqual(48);
  });
  it('reads the flag reason from the last note, not from fixer stamps', () => {
    const c = outcomeContext({ licensor_name: 'Acme', licensee_name: 'Bigco', asset_name: null,
      verification_notes: 'older note | The release gives $50M upfront, the DB has $20M [2026-09-29 flag-and-fix: attempt 1 of 3, no primary source]' });
    expect(c.flaggedBecause).toContain('$50M upfront');
    expect(c.label).toBe('Acme → Bigco');
  });
  it('rejects after three attempts', () => {
    expect(MAX_FIX_ATTEMPTS).toBe(3);
  });
});
