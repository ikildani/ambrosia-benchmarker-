/**
 * Brief v3 — comparable set, regional strategy, term-sheet precedent.
 * Pure-function tests on small fixtures; no database access.
 */

import {
  percentile, quartiles, outlierThreshold, normalizePhase, normalizeStructure, normalizeModality,
  isSameIndication, isSameTA, scoreRow, buildCompSetFromRows, selectClauseRows, type RawDealRow,
} from '@/lib/brief/comp-set';
import { mapTerritory, buildRegionalStrategy } from '@/lib/brief/regional';
import { buildTermSheetPrecedent, type DealRowForClauses } from '@/lib/brief/term-sheet';
import { renderCompScatterPage } from '@/lib/report/pages/compScatter';
import { renderCompAppendixPages, countCompAppendixPages, sourceHost } from '@/lib/report/pages/compAppendix';
import { renderRegionalStrategyPage } from '@/lib/report/pages/regionalStrategy';
import { renderTermSheetPrecedentPage } from '@/lib/report/pages/termSheetPrecedent';
import { renderCompScatter } from '@/lib/report/svg-charts/scatter';
import { renderDistributionStrips } from '@/lib/report/svg-charts/distributionStrip';
import { renderGroupedBars } from '@/lib/report/svg-charts/groupedBars';
import type { AssetProfile, CompRow } from '@/lib/brief/types';
import type { PDFReportData, ReportMeta } from '@/lib/report/types';

// ─── Fixtures ──────────────────────────────────────────────────────────────

const asset: AssetProfile = {
  assetName: 'AMB-101',
  modality: 'smallMolecule',
  phase: 'preclinical',
  indication: 'alzheimers',
  therapeuticArea: 'neurology',
  territory: 'global',
  targetDealType: 'licensing',
};

function raw(over: Partial<RawDealRow> & { id: string }): RawDealRow {
  return {
    licensor_name: 'Licensor Co', licensee_name: 'Big Pharma', asset_name: 'X-1', announced_date: '2025-03-01',
    phase_at_signing: 'preclinical', deal_type: 'license', modality: 'small_molecule', indication_category: 'cns',
    indication_specific: "Alzheimer's disease", therapeutic_area: 'neurology', territory: 'global',
    upfront_usd: 50e6, total_deal_value_usd: 500e6, milestones_total_usd: 450e6, royalty_low_pct: 5, royalty_high_pct: 10,
    equity_investment_usd: null, verified: true, source_type: 'press_release', source_url: 'https://www.sec.gov/x', press_release_url: null,
    includes_co_development: false, includes_co_promotion: null, sublicense_rights: null, rights_retained: null,
    opt_in_rights: null, opt_in_stage: null, research_funding_usd: null, profit_share_pct: null, cost_share_ratio: null,
    option_exercise_fee: null, term_years: null,
    ...over,
  };
}

const RAW: RawDealRow[] = [
  raw({ id: 'a', upfront_usd: 10e6, total_deal_value_usd: 200e6 }),
  raw({ id: 'b', upfront_usd: 30e6, total_deal_value_usd: 400e6, territory: 'ex_us', verified: false }),
  raw({ id: 'c', upfront_usd: 50e6, total_deal_value_usd: 600e6, phase_at_signing: 'phase_1', territory: 'Greater China' }),
  raw({ id: 'd', upfront_usd: 70e6, total_deal_value_usd: 800e6, indication_specific: 'epilepsy', indication_category: 'epilepsy', territory: 'japan' }),
  raw({ id: 'e', upfront_usd: 90e6, total_deal_value_usd: 1000e6, indication_specific: 'narcolepsy', therapeutic_area: '_mega_deals', indication_category: 'sleep_disorders', territory: 'europe' }),
  raw({ id: 'f', upfront_usd: 6000e6, total_deal_value_usd: 9000e6, deal_type: 'acquisition', phase_at_signing: 'phase_2', source_url: null }),
  raw({ id: 'onc', therapeutic_area: 'oncology', indication_category: 'solid_tumor', indication_specific: 'NSCLC' }),
  raw({ id: 'noterms', upfront_usd: null, total_deal_value_usd: null }),
];

function meta(): ReportMeta {
  return { reportId: 'AMB-TEST', generatedAt: '2026-09-23', version: '3.0', pageCount: 40, currentPage: 8, tocEntries: [] };
}

function reportData(brief: Partial<NonNullable<PDFReportData['brief']>> | null): PDFReportData {
  const base = {
    result: {
      terms: { upfront: { low: 20, median: 40, high: 60 }, totalDealValue: { low: 300, median: 500, high: 700 } },
      tieredRoyalties: { base: { low: 6, high: 8 } },
    },
    brief: brief ? { asOf: '2026-09-23', asset, ...brief } : undefined,
  };
  return base as unknown as PDFReportData;
}

const pageCount = (html: string) => (html.match(/<div class="report-page">/g) || []).length;

// ─── Percentiles & outliers ────────────────────────────────────────────────

describe('percentile helpers', () => {
  it('interpolates linearly', () => {
    expect(percentile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(percentile([5, 1, 3], 0.5)).toBe(3);
    expect(percentile([], 0.5)).toBeNull();
  });
  it('returns null quartiles for n < 3 and ignores nulls', () => {
    expect(quartiles([1, 2])).toBeNull();
    expect(quartiles([null, 1, 2, 3])).toEqual({ p25: 1.5, p50: 2, p75: 2.5 });
  });
  it('flags totals above p75 + 1.5·IQR', () => {
    const fence = outlierThreshold([200, 400, 600, 800, 1000, 9000]);
    expect(fence).toBeGreaterThan(1000);
    expect(9000 > fence).toBe(true);
    expect(outlierThreshold([1, 2, 3])).toBe(Infinity);
  });
});

// ─── Normalisers & scoring ─────────────────────────────────────────────────

describe('normalisers', () => {
  it('maps phase keys from both worlds', () => {
    expect(normalizePhase('phase1')).toBe('phase_1');
    expect(normalizePhase('phase_2')).toBe('phase_2');
    expect(normalizePhase('Phase 3')).toBe('phase_3');
    expect(normalizePhase(null)).toBe('unknown');
  });
  it('maps structures and modalities', () => {
    expect(normalizeStructure('licensing')).toBe('license');
    expect(normalizeStructure('co_development')).toBe('co_development');
    expect(normalizeModality('smallMolecule')).toBe(normalizeModality('small_molecule'));
    expect(normalizeModality('antibody')).toBe('mab');
    expect(normalizeModality('adc_her2')).toBe('adc');
  });
  it('matches indication and TA tolerantly', () => {
    expect(isSameIndication({ indication_category: 'cns', indication_specific: "Alzheimer's disease" }, 'alzheimers')).toBe(true);
    expect(isSameIndication({ indication_category: 'epilepsy', indication_specific: 'epilepsy' }, 'alzheimers')).toBe(false);
    expect(isSameTA({ therapeutic_area: '_mega_deals', indication_category: 'sleep_disorders', indication_specific: 'narcolepsy' }, 'neurology')).toBe(true);
    expect(isSameTA({ therapeutic_area: 'oncology', indication_category: 'solid_tumor', indication_specific: 'NSCLC' }, 'neurology')).toBe(false);
  });
  it('scores 0–100 with the documented weights', () => {
    const full = scoreRow(RAW[0], asset);
    expect(full.relevance).toBe(100);
    expect(full.reasons).toEqual(expect.arrayContaining(['Same phase', 'Same indication', 'Same modality', 'Same therapeutic area', 'Same territory', 'Recent']));
    const partial = scoreRow(RAW[3], asset); // epilepsy, japan
    expect(partial.relevance).toBe(100 - 20 - 5);
  });
});

// ─── Comp set ──────────────────────────────────────────────────────────────

describe('buildCompSetFromRows', () => {
  const set = buildCompSetFromRows(RAW, asset, { asOf: '2026-09-23' });

  it('applies TA/indication filter and the economics requirement', () => {
    const ids = set.rows.map((r) => r.id);
    expect(ids).not.toContain('onc');
    expect(ids).not.toContain('noterms');
    expect(set.rows).toHaveLength(6);
  });
  it('puts same-indication rows first and converts USD to $M', () => {
    expect(set.rows.slice(0, 4).every((r) => r.sameIndication)).toBe(true);
    expect(set.rows.find((r) => r.id === 'a')?.upfrontM).toBe(10);
    expect(set.rows.find((r) => r.id === 'a')?.totalM).toBe(200);
  });
  it('flags the $9B acquisition as an outlier and excludes it from drivers and ex-outlier stats', () => {
    expect(set.rows.find((r) => r.id === 'f')?.outlier).toBe(true);
    expect(set.headlineDriverIds).not.toContain('f');
    expect(set.stats.exOutliers.n).toBe(5);
    expect(set.stats.all.total?.p50).toBe(700);
    expect(set.stats.exOutliers.total?.p50).toBe(600);
  });
  it('buckets by phase and structure', () => {
    expect(set.byPhase.map((b) => b.phase)).toEqual(['preclinical', 'phase_1', 'phase_2']);
    expect(set.byStructure.map((b) => b.structure)).toEqual(['license', 'acquisition']);
  });
  it('writes the verified share into the source note and a caveat under 8 same-indication rows', () => {
    expect(set.source.note).toContain('verified 5 of 6');
    expect(set.caveat).toMatch(/Only 4 same-indication comps/);
  });
  it('respects maxRows', () => {
    expect(buildCompSetFromRows(RAW, asset, { maxRows: 2 }).rows).toHaveLength(2);
  });
  it('selects clause rows without the economics requirement', () => {
    const clauseRows = selectClauseRows(RAW, asset);
    expect(clauseRows.map((r) => r.id)).toContain('noterms');
    expect(clauseRows.map((r) => r.id)).not.toContain('onc');
  });
});

// ─── Regional ──────────────────────────────────────────────────────────────

describe('mapTerritory', () => {
  it.each([
    ['global', 'global'], ['ex_us', 'ex_us'], ['ex_china', 'ex_china'], ['china', 'greater_china'], ['europe', 'europe'],
    ['japan', 'japan'], ['us_only', 'us'], ['us', 'us'], ['asia_pacific', 'asia_pacific'], ['regional', 'other'], ['other', 'other'],
    ['Greater China', 'greater_china'], ['ex-Greater China', 'ex_china'], ['global ex-Greater China', 'ex_china'], ['Japan', 'japan'],
    ['global excluding Japan', 'other'], ['South Korea', 'asia_pacific'], ['120 high-incidence resource-limited countries', 'other'],
    [null, 'other'], ['', 'other'],
  ])('%s → %s', (input, expected) => {
    expect(mapTerritory(input as string | null)).toBe(expected);
  });
});

describe('buildRegionalStrategy', () => {
  const set = buildCompSetFromRows(RAW, asset, { asOf: '2026-09-23' });

  it('computes per-region rows with global first and vs-global ratios', () => {
    const reg = buildRegionalStrategy(set.rows, asset, '2026-09-23');
    expect(reg.rows[0].region).toBe('global');
    expect(reg.rows[0].n).toBe(2);
    const exUs = reg.rows.find((r) => r.region === 'ex_us');
    expect(exUs?.n).toBe(1);
    expect(exUs?.upfront).toBeNull(); // n < 3
    expect(reg.source.n).toBe(6);
  });
  it('recommends keeping global when regional data is thin', () => {
    const reg = buildRegionalStrategy(set.rows, asset, '2026-09-23');
    expect(reg.recommendation).toMatch(/Regional data is thin/);
  });
  it('recommends a carve-out when a region has n ≥ 3 at ≥ 35% of global', () => {
    // Global median upfront = 50; Greater China median = 22 (44% of global) with n = 3.
    const rows: CompRow[] = [
      ...[40, 50, 60].map((u, i) => ({ ...set.rows[0], id: `g${i}`, territory: 'global', upfrontM: u })),
      ...[1, 2, 3].map((i) => ({ ...set.rows[0], id: `cn${i}`, territory: 'Greater China', upfrontM: 20 + i })),
    ];
    const reg = buildRegionalStrategy(rows, asset, '2026-09-23');
    expect(reg.recommendation).toMatch(/Greater China carve-out is priced/);
  });
});

// ─── Term sheet ────────────────────────────────────────────────────────────

describe('buildTermSheetPrecedent', () => {
  const clauseRows: DealRowForClauses[] = [
    { phase_at_signing: 'preclinical', deal_type: 'license', includes_co_development: true, includes_co_promotion: null, sublicense_rights: null, rights_retained: 'Greater China rights', opt_in_rights: null, opt_in_stage: null, equity_investment_usd: 10e6, research_funding_usd: null, profit_share_pct: null, cost_share_ratio: null, option_exercise_fee: null, term_years: 10, royalty_low_pct: 5, royalty_high_pct: 10, verified: true },
    { phase_at_signing: 'preclinical', deal_type: 'license', includes_co_development: false, includes_co_promotion: true, sublicense_rights: 'none', rights_retained: null, opt_in_rights: 'option to develop a third product', opt_in_stage: null, equity_investment_usd: null, research_funding_usd: 5e6, profit_share_pct: 50, cost_share_ratio: '50/50', option_exercise_fee: null, term_years: 12, royalty_low_pct: 8, royalty_high_pct: 12, verified: false },
    { phase_at_signing: 'phase_2', deal_type: 'option', includes_co_development: true, includes_co_promotion: null, sublicense_rights: true, rights_retained: null, opt_in_rights: null, opt_in_stage: 'end of Phase 2', equity_investment_usd: null, research_funding_usd: null, profit_share_pct: null, cost_share_ratio: null, option_exercise_fee: null, term_years: 15, royalty_low_pct: 3, royalty_high_pct: null, verified: true },
    { phase_at_signing: 'phase_2', deal_type: 'license', includes_co_development: null, includes_co_promotion: null, sublicense_rights: null, rights_retained: null, opt_in_rights: null, opt_in_stage: null, equity_investment_usd: null, research_funding_usd: null, profit_share_pct: null, cost_share_ratio: null, option_exercise_fee: null, term_years: null, royalty_low_pct: null, royalty_high_pct: null, verified: null },
  ];
  const ts = buildTermSheetPrecedent(clauseRows, asset, '2026-09-23');
  const byKey = Object.fromEntries(ts.clauses.map((c) => [c.key, c]));

  it('counts clause frequencies overall and at the asset phase', () => {
    expect(byKey.co_development.share).toBe(0.5);
    expect(byKey.co_development.sharePhase).toBe(0.5);
    expect(byKey.co_development.nPhase).toBe(2);
    expect(byKey.sublicense.share).toBe(0.25); // 'none' is not present; true is
    expect(byKey.opt_in.share).toBe(0.5);
    expect(byKey.option_fee.share).toBe(0);
    expect(byKey.term_length.share).toBe(0.75);
  });
  it('has 11 clauses each with one-sentence guidance', () => {
    expect(ts.clauses).toHaveLength(11);
    ts.clauses.forEach((c) => expect(c.guidance.length).toBeGreaterThan(20));
  });
  it('computes royalty tiers and term years', () => {
    expect(ts.royaltyTiers.n).toBe(3);
    expect(ts.royaltyTiers.low?.p50).toBe(5);
    expect(ts.royaltyTiers.high).toBeNull(); // only 2 highs
    expect(ts.termYears).toEqual({ p25: 11, p50: 12, p75: 13.5, n: 3 });
    expect(ts.source.note).toContain('verified 2 of 4');
  });
  it('returns nulls at zero rows', () => {
    const empty = buildTermSheetPrecedent([], asset, '2026-09-23');
    expect(empty.source.n).toBe(0);
    expect(empty.termYears).toBeNull();
    expect(empty.clauses[0].sharePhase).toBeNull();
  });
});

// ─── Charts ────────────────────────────────────────────────────────────────

describe('svg charts', () => {
  const set = buildCompSetFromRows(RAW, asset, { asOf: '2026-09-23' });
  it('scatter renders ≤ 560 wide with the ask diamond, legend and unique ids', () => {
    const a = renderCompScatter(set.rows, { upfrontM: 40, totalM: 500, label: 'Your ask' });
    const b = renderCompScatter(set.rows, { upfrontM: 40, totalM: 500, label: 'Your ask' });
    expect(a).toMatch(/<svg width="560"/);
    expect(a).toContain('Your ask');
    expect(a).toContain('stroke-dasharray="2,2"'); // hollow outlier
    expect(a).toContain('log scale');
    expect(a.match(/id="([^"]+)-clip"/)?.[1]).not.toBe(b.match(/id="([^"]+)-clip"/)?.[1]);
  });
  it('distribution strips print — for null stats and n at right', () => {
    const svg = renderDistributionStrips([{ label: 'Phase 1', stats: null, n: 1 }, { label: 'Phase 2', stats: { p25: 10, p50: 20, p75: 30 }, n: 4 }], 15, 300, '$M');
    expect(svg).toContain('>—<');
    expect(svg).toContain('n=4');
    expect(svg).toContain('polygon');
  });
  it('grouped bars handle null values', () => {
    const svg = renderGroupedBars([{ label: 'Global', values: [{ label: 'Upfront', value: 50 }, { label: 'Total', value: null }] }], 400, 160);
    expect(svg).toContain('$50M');
    expect(svg).toContain('>—<');
  });
});

// ─── Pages ─────────────────────────────────────────────────────────────────

describe('page renderers', () => {
  const set = buildCompSetFromRows(RAW, asset, { asOf: '2026-09-23' });
  const regional = buildRegionalStrategy(set.rows, asset, '2026-09-23');
  const termSheet = buildTermSheetPrecedent(selectClauseRows(RAW, asset), asset, '2026-09-23');
  const data = reportData({ compSet: set, regional, termSheet, bridge: { asOf: '2026-09-23', bars: [], ask: { totalM: 450, upfrontM: 35 }, floor: { totalM: 300, upfrontM: 20 }, walkAway: { upfrontM: 15 }, reconciliation: '' } });

  it('comp scatter page: one report-page, section title, source line, KPIs, drivers', () => {
    const html = renderCompScatterPage(data, meta());
    expect(pageCount(html)).toBe(1);
    expect(html).toContain('Comparable set');
    expect(html).toContain('Source: Solidus deal database');
    expect(html).toContain('verified 5 of 6');
    expect(html).toContain('Drivers of the headline');
    expect(html).toContain('Deal Intelligence Brief');
    expect(html).not.toMatch(/illustrative|sample|\bAI\b/);
  });
  it('comp scatter page: empty state when compSet is missing or thin', () => {
    expect(renderCompScatterPage(reportData(null), meta())).toContain('Comparable set not available');
    const thin = buildCompSetFromRows(RAW.slice(0, 2), asset, { asOf: '2026-09-23' });
    expect(renderCompScatterPage(reportData({ compSet: thin }), meta())).toContain('fewer than the three needed');
  });
  it('appendix: 16 rows per page, outlier superscript, source host, page numbers increment', () => {
    const many: RawDealRow[] = Array.from({ length: 45 }, (_, i) => raw({ id: `r${i}`, upfront_usd: (i + 1) * 1e6, total_deal_value_usd: (i + 1) * 10e6 }));
    const big = buildCompSetFromRows(many, asset, { maxRows: 45, asOf: '2026-09-23' });
    const d = reportData({ compSet: big });
    expect(countCompAppendixPages(d)).toBe(3);
    const pages = renderCompAppendixPages(d, meta());
    expect(pages).toHaveLength(3);
    pages.forEach((p) => expect(pageCount(p)).toBe(1));
    expect(pages[0]).toContain('8 / 40');
    expect(pages[2]).toContain('10 / 40');
    expect(pages[2]).toContain('Outlier.');
    expect(pages[0]).toContain('sec.gov');
    const withOutlier = renderCompAppendixPages(data, meta());
    expect(withOutlier[0]).toContain('†');
    expect(withOutlier[0]).toContain('undisclosed');
    expect(countCompAppendixPages(reportData(null))).toBe(1);
    expect(renderCompAppendixPages(reportData(null), meta())[0]).toContain('No comparable deals to list');
  });
  it('sourceHost strips www and tolerates junk', () => {
    expect(sourceHost('https://www.sec.gov/Archives/x')).toBe('sec.gov');
    expect(sourceHost('not a url')).toBe('undisclosed');
    expect(sourceHost(null)).toBe('undisclosed');
  });
  it('regional page renders bars, table, recommendation and thin-data note', () => {
    const html = renderRegionalStrategyPage(data, meta());
    expect(pageCount(html)).toBe(1);
    expect(html).toContain('Regional deal strategy');
    expect(html).toContain('Recommendation');
    expect(html).toContain('Thin data');
    expect(html).toContain('Source: Solidus deal database');
    expect(renderRegionalStrategyPage(reportData(null), meta())).toContain('Regional split not available');
  });
  it('term-sheet page renders clause table, royalty strip and option-fee note', () => {
    const html = renderTermSheetPrecedentPage(data, meta());
    expect(pageCount(html)).toBe(1);
    expect(html).toContain('Term-sheet precedent map');
    expect(html).toContain('Option exercise fee');
    expect(html).toContain('undisclosed across the set');
    expect(html).toContain('Source: Solidus deal database');
    expect(renderTermSheetPrecedentPage(reportData(null), meta())).toContain('Clause precedent not available');
  });
});
