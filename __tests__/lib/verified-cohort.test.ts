import {
  mapDealType,
  mapPhase,
  phaseBucket,
  rowsToExtendedDeals,
  buildVerifiedCohortReport,
  VERIFIED_COHORT_FILTER,
  type VerifiedDealRow,
} from '@/lib/financial/backtest/verified-cohort';

function row(over: Partial<VerifiedDealRow> = {}): VerifiedDealRow {
  return {
    id: 'r1',
    licensor_name: 'Alpha Bio',
    licensee_name: 'Big Pharma',
    asset_name: 'ALP-1234',
    modality: 'smallMolecule',
    phase_at_signing: 'phase_2',
    indication_category: 'lung',
    indication_specific: 'lung_nsclc',
    territory: 'global',
    therapeutic_area: 'oncology',
    deal_type: 'license',
    upfront_usd: 150_000_000,
    total_deal_value_usd: 1_200_000_000,
    announced_date: '2025-03-01',
    source_url: 'https://example.com/pr',
    press_release_url: null,
    source_filing_id: null,
    ...over,
  };
}

describe('mapDealType / mapPhase', () => {
  it('normalises database labels to engine keys', () => {
    expect(mapDealType('license')).toBe('licensing');
    expect(mapDealType('co_development')).toBe('codevelopment');
    expect(mapDealType('acquisition')).toBe('acquisition');
    expect(mapPhase('phase_1')).toBe('phase1');
    expect(mapPhase('phase_2_3')).toBe('phase2_3');
    expect(mapPhase('nda_filed')).toBe('nda_filed');
  });

  it('refuses rows the engine cannot model instead of guessing', () => {
    expect(mapDealType('other')).toBeNull();
    expect(mapDealType(null)).toBeNull();
    expect(mapPhase('unknown')).toBeNull();
    expect(mapPhase(null)).toBeNull();
  });
});

describe('phaseBucket', () => {
  it('splits early / mid / late', () => {
    expect(phaseBucket('preclinical')).toBe('early');
    expect(phaseBucket('phase1_2')).toBe('early');
    expect(phaseBucket('phase2')).toBe('mid');
    expect(phaseBucket('phase3')).toBe('late');
    expect(phaseBucket('approved')).toBe('late');
  });
});

describe('rowsToExtendedDeals', () => {
  it('converts USD to $M and keeps the citation as the source', () => {
    const [d] = rowsToExtendedDeals([row()]);
    expect(d.upfront).toBe(150);
    expect(d.totalDealValue).toBe(1200);
    expect(d.year).toBe(2025);
    expect(d.dealType).toBe('licensing');
    expect(d.phase).toBe('phase2');
    expect(d.source).toBe('https://example.com/pr');
    expect(d.verified).toBe(true);
  });

  it('drops rows with no modelled phase, deal type, upfront or total', () => {
    const out = rowsToExtendedDeals([
      row({ id: 'a', phase_at_signing: 'unknown' }),
      row({ id: 'b', deal_type: 'other' }),
      row({ id: 'c', upfront_usd: null }),
      row({ id: 'd', total_deal_value_usd: 0 }),
      row({ id: 'e' }),
    ]);
    expect(out.map(d => d.id)).toEqual(['db_e']);
  });
});

describe('buildVerifiedCohortReport', () => {
  it('scores a cohort with plain unweighted bands and reports eligible vs scored', () => {
    const deals = rowsToExtendedDeals([
      row({ id: '1', phase_at_signing: 'phase_2' }),
      row({ id: '2', phase_at_signing: 'phase_3', upfront_usd: 400_000_000, total_deal_value_usd: 2_000_000_000 }),
      row({ id: '3', phase_at_signing: 'phase_1', upfront_usd: 60_000_000, total_deal_value_usd: 800_000_000 }),
      row({ id: '4', phase_at_signing: 'preclinical', upfront_usd: 10_000_000, total_deal_value_usd: 300_000_000 }), // under the $20M floor: not scored
    ]);
    const r = buildVerifiedCohortReport(deals, 9, new Date('2026-09-15T00:00:00Z'));
    expect(r.cohort).toBe('verified_cited');
    expect(r.eligible).toBe(9);
    expect(r.scored).toBe(3);
    expect(r.all.n).toBe(3);
    expect(r.all.upfront.n).toBe(3);
    expect(r.all.upfront.within35).toBeGreaterThanOrEqual(0);
    expect(r.all.upfront.within35).toBeLessThanOrEqual(1);
    expect(r.all.upfront.within50).toBeGreaterThanOrEqual(r.all.upfront.within35);
    expect(r.byPhaseBucket.early.n + r.byPhaseBucket.mid.n + r.byPhaseBucket.late.n).toBe(3);
    expect(r.coreScope.n).toBe(2); // phase2 + phase3 licensing
    expect(r.worst.length).toBeLessThanOrEqual(5);
    expect(Number.isFinite(r.all.upfront.medianAbsErrorPct)).toBe(true);
    expect(r.runAt).toBe('2026-09-15T00:00:00.000Z');
  });

  it('returns zeroed bands, not NaN, for an empty cohort', () => {
    const r = buildVerifiedCohortReport([], 0);
    expect(r.scored).toBe(0);
    expect(r.all.upfront.within35).toBe(0);
    expect(Number.isNaN(r.all.totalDeal.medianAbsErrorPct)).toBe(false);
  });
});

describe('VERIFIED_COHORT_FILTER', () => {
  it('is a single PostgREST and-group (chained .or() calls replace each other)', () => {
    expect(VERIFIED_COHORT_FILTER.startsWith('and(')).toBe(true);
    expect(VERIFIED_COHORT_FILTER).toContain('is_canonical');
    expect(VERIFIED_COHORT_FILTER).toContain('source_filing_id.not.is.null');
  });
});
