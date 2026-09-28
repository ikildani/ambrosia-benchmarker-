/**
 * Acquirer view helpers: read-time exclusions, one-per-asset dedupe, gap
 * grouping and the leaderboard grouped by company id.
 */

import { buildLeaderboard, dedupeOpportunities, gapTypeLabel, groupByGap, opportunityEligible } from '@/lib/radar/acquirer-view';

const asset = (over: Partial<{ phase: string | null; ownership_status: string | null; partnership_status: string | null }> = {}) => ({
  phase: 'phase_2',
  ownership_status: 'originator',
  partnership_status: 'unpartnered',
  ...over,
});

describe('opportunityEligible', () => {
  it('keeps an unpartnered originator program in Phase 1-3', () => {
    expect(opportunityEligible(asset())).toBe(true);
    expect(opportunityEligible(asset({ phase: 'phase_1', partnership_status: 'partially_partnered' }))).toBe(true);
  });
  it('drops Phase 4 / approved (the feed default exclusion)', () => {
    expect(opportunityEligible(asset({ phase: 'phase_4' }))).toBe(false);
  });
  it('drops comparator and marketed-elsewhere ownership', () => {
    expect(opportunityEligible(asset({ ownership_status: 'comparator_or_background' }))).toBe(false);
    expect(opportunityEligible(asset({ ownership_status: 'marketed_other' }))).toBe(false);
    expect(opportunityEligible(asset({ ownership_status: 'unknown' }))).toBe(true);
  });
  it('drops fully partnered programs and missing assets', () => {
    expect(opportunityEligible(asset({ partnership_status: 'partnered' }))).toBe(false);
    expect(opportunityEligible(null)).toBe(false);
  });
});

describe('dedupeOpportunities', () => {
  it('keeps the best-scored row per asset, ordered by score', () => {
    const rows = [
      { id: 'a1', asset_id: 'A', opportunity_score: 40 },
      { id: 'a2', asset_id: 'A', opportunity_score: 65 },
      { id: 'b1', asset_id: 'B', opportunity_score: 50 },
    ];
    expect(dedupeOpportunities(rows).map(r => r.id)).toEqual(['a2', 'b1']);
  });
});

describe('groupByGap', () => {
  it('groups by gap type, largest first, null gap as other', () => {
    const rows = [
      { gap_type: 'therapeutic_gap', opportunity_score: 10 },
      { gap_type: 'patent_cliff_replacement', opportunity_score: 90 },
      { gap_type: 'therapeutic_gap', opportunity_score: 70 },
      { gap_type: null, opportunity_score: 5 },
    ];
    const groups = groupByGap(rows);
    expect(groups.map(g => [g.gap_type, g.count])).toEqual([['therapeutic_gap', 2], ['patent_cliff_replacement', 1], ['other', 1]]);
    expect(groups[0].opportunities.map(o => o.opportunity_score)).toEqual([70, 10]);
    expect(groups[0].label).toBe('Therapeutic area gap');
    expect(gapTypeLabel('some_new_gap')).toBe('Some new gap');
  });
});

describe('buildLeaderboard', () => {
  it('groups by company id and picks the most frequent spelling', () => {
    const rows = [
      { acquirer_company_id: 'gsk', acquirer_name: 'GSK', opportunity_score: 40 },
      { acquirer_company_id: 'gsk', acquirer_name: 'Glaxo Group Limited (GSK)', opportunity_score: 60 },
      { acquirer_company_id: 'gsk', acquirer_name: 'GSK', opportunity_score: 50 },
      { acquirer_company_id: 'pfe', acquirer_name: 'Pfizer', opportunity_score: 70 },
      { acquirer_company_id: '', acquirer_name: 'orphan', opportunity_score: 99 },
    ];
    const board = buildLeaderboard(rows, 10);
    expect(board).toEqual([
      { company_id: 'gsk', name: 'GSK', opportunities: 3, avg_score: 50 },
      { company_id: 'pfe', name: 'Pfizer', opportunities: 1, avg_score: 70 },
    ]);
    expect(buildLeaderboard(rows, 1)).toHaveLength(1);
  });
});
