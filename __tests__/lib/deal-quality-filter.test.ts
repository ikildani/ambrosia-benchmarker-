/**
 * lib/deals/quality-filter — the single rule for which deal rows may be shown.
 *
 * Audit 2026-09-14: is_synthetic=true matched zero rows after the April
 * cleanup deleted the flagged fakes, so readers that filtered only on it were
 * exposing 164 rejected and 856 flagged rows. Every public reader now goes
 * through applyDealQualityFilter.
 */
import {
  applyDealQualityFilter,
  DEAL_CANONICAL_OR,
  DEAL_STATUS_OR,
  DEAL_EXCLUDED_STATUSES,
  DEAL_QUALITY_SQL_PREDICATE,
  DEAL_VERIFIED_SQL_PREDICATE,
} from '@/lib/deals/quality-filter';

/** Recording query builder: every chained call is logged and returns the builder. */
function recorder() {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const b = {
    eq: (...args: unknown[]) => { calls.push({ method: 'eq', args }); return b; },
    or: (...args: unknown[]) => { calls.push({ method: 'or', args }); return b; },
    calls,
  };
  return b;
}

describe('applyDealQualityFilter', () => {
  it('tracked tier: excludes synthetic, non-canonical, flagged and rejected', () => {
    const q = recorder();
    const out = applyDealQualityFilter(q);
    expect(out).toBe(q);
    expect(q.calls).toEqual([
      { method: 'eq', args: ['is_synthetic', false] },
      { method: 'or', args: [DEAL_CANONICAL_OR] },
      { method: 'or', args: [DEAL_STATUS_OR] },
    ]);
  });

  it('verified tier: requires verified=true instead of the status exclusion', () => {
    const q = recorder();
    applyDealQualityFilter(q, { verifiedOnly: true });
    expect(q.calls).toEqual([
      { method: 'eq', args: ['is_synthetic', false] },
      { method: 'or', args: [DEAL_CANONICAL_OR] },
      { method: 'eq', args: ['verified', true] },
    ]);
  });

  it('keeps pre-dedupe NULL canonical rows and NULL statuses', () => {
    expect(DEAL_CANONICAL_OR).toContain('is_canonical.is.null');
    expect(DEAL_STATUS_OR).toContain('verification_status.is.null');
  });

  it('excludes exactly the verifier statuses that disqualify a row', () => {
    expect([...DEAL_EXCLUDED_STATUSES].sort()).toEqual(['flagged', 'rejected']);
    for (const s of DEAL_EXCLUDED_STATUSES) expect(DEAL_STATUS_OR).toContain(`"${s}"`);
  });

  it('SQL predicates mirror the builder rule', () => {
    expect(DEAL_QUALITY_SQL_PREDICATE).toMatch(/is_synthetic[\s\S]*is_canonical[\s\S]*verification_status/);
    expect(DEAL_QUALITY_SQL_PREDICATE).toContain("'rejected', 'flagged'");
    expect(DEAL_VERIFIED_SQL_PREDICATE).toContain('verified, false) = true');
  });
});
