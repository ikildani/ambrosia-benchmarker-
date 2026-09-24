/**
 * Brief v3 — buyer map builder, charts and pages. No database: buildBuyerMap
 * is exercised against a tiny chainable supabase stub.
 */

import {
  buildBuyerMap,
  computeUrgency,
  transactsAtPhase,
  normalisePhase,
  phaseRank,
  normaliseStructure,
  parsePatentCliffs,
  splitProcess,
  buildWhyNow,
  buildHowToEngage,
} from '@/lib/brief/buyer-map';
import { computeBuyerValuations } from '@/lib/brief/buyer-valuations';
import { renderBuyerQuadrant } from '@/lib/report/svg-charts/quadrant';
import { renderLoeCalendar } from '@/lib/report/svg-charts/loeCalendar';
import { renderBuyerMapPage } from '@/lib/report/pages/buyerMap';
import { renderBuyerBehaviourPage } from '@/lib/report/pages/buyerBehaviour';
import type { AssetProfile, BuyerCandidate, BuyerMap } from '@/lib/brief/types';
import type { PDFReportData, ReportMeta, PartnerForPDF } from '@/lib/report/types';
import type { DealWaterfall, RNPVResult } from '@/lib/financial/types';

// ─── Fixtures ───────────────────────────────────────────────────────────────

const META: ReportMeta = { reportId: 'AMB-TEST', generatedAt: '2026-09-24', version: '3', pageCount: 28, currentPage: 15, tocEntries: [] };

const ASSET: AssetProfile = {
  assetName: 'AX-101', company: 'Axia', modality: 'smallMolecule', phase: 'preclinical', indication: 'alzheimers',
  therapeuticArea: 'neurology', territory: 'global', targetDealType: 'license',
};

function candidate(over: Partial<BuyerCandidate> = {}): BuyerCandidate {
  return {
    companyId: 'c1', name: 'Eli Lilly', companyType: 'large_pharma', hqRegion: 'north_america', hqCountry: 'US',
    fit: 82, urgency: 61, intentScore: 70, intentTier: 'high', preferredDealType: 'license',
    dealsLast12mo: 8, dealsLast24mo: 14, lastDealDate: '2026-06-01',
    phasePreference: { min: 'preclinical', max: 'phase_3' }, transactsAtPhase: 'yes',
    totalRevenueUsd: 34e9, revenueAtRisk: { y2025: null, y2026: 2e9, y2027: 1e9 },
    patentCliffs: [{ drug: 'Trulicity', expiryYear: 2027, revenueUsd: 4e9 }, { drug: 'Taltz', expiryYear: 2030, revenueUsd: 3e9 }],
    hiringBd: false, acquisitionAppetite: 'aggressive',
    priorDeals: [{ parties: 'Verge Genomics → Eli Lilly', year: 2024, phase: 'preclinical', structure: 'collaboration', upfrontM: 25, totalM: 700, indication: 'ALS', sameTA: true, sourceUrl: 'https://www.fiercebiotech.com/x' }],
    counterpartyPremium: { multiplier: 1.31, n: 52, confidence: 'high' },
    impliedUpfront: { low: 20, median: 35, high: 55 }, impliedTotal: { low: 300, median: 520, high: 800 },
    whyNow: 'Trulicity loses exclusivity in 2027.', howToEngage: 'Go straight to a license.',
    ...over,
  };
}

function buyerMap(over: Partial<BuyerMap> = {}): BuyerMap {
  const cands = [
    candidate(),
    candidate({ companyId: 'c2', name: 'AbbVie <Immunology>', fit: 74, urgency: 40, transactsAtPhase: 'unknown', priorDeals: [], patentCliffs: [] }),
    candidate({ companyId: 'c3', name: 'Roche', fit: 60, urgency: 30, transactsAtPhase: 'no', priorDeals: [] }),
  ];
  return {
    source: { source: 'Solidus deal database and company profiles', n: 12, asOf: '2026-09-24', note: '3 buyers profiled' },
    candidates: cands,
    excluded: [{ name: 'Roche', reason: '4 disclosed deals since 2021, none at preclinical or earlier' }],
    process: { lead: ['Eli Lilly', 'AbbVie <Immunology>'], tension: [], hold: [], rationale: 'Open with Eli Lilly and AbbVie.' },
    ...over,
  };
}

// ─── Pure helpers ───────────────────────────────────────────────────────────

describe('phase normalisation', () => {
  it('maps deals keys, calc keys and combined phases', () => {
    expect(normalisePhase('phase_1')).toBe('phase_1');
    expect(normalisePhase('phase1')).toBe('phase_1');
    expect(normalisePhase('Phase 2')).toBe('phase_2');
    expect(normalisePhase('phase_2_3')).toBe('phase_2');
    expect(normalisePhase('phase1/2')).toBe('phase_1');
    expect(normalisePhase('Preclinical')).toBe('preclinical');
    expect(normalisePhase('NDA')).toBe('approved');
    expect(normalisePhase('unknown')).toBe('unknown');
    expect(normalisePhase(null)).toBe('unknown');
  });
  it('orders discovery < preclinical < phase_1 < phase_2 < phase_3 < approved', () => {
    const ranks = ['discovery', 'preclinical', 'phase1', 'phase_2', 'phase3', 'approved'].map(phaseRank);
    expect(ranks).toEqual([0, 1, 2, 3, 4, 5]);
    expect(phaseRank('unknown')).toBeNull();
  });
  it('normalises structures', () => {
    expect(normaliseStructure('license')).toBe('license');
    expect(normaliseStructure('M&A')).toBe('acquisition');
    expect(normaliseStructure('co-development')).toBe('co_development');
    expect(normaliseStructure(null)).toBe('other');
  });
});

describe('computeUrgency', () => {
  it('scores the documented weights', () => {
    // 25% of revenue at risk → full 40; 6 deals → 25; intent 100 → 25; hiring → 10.
    expect(computeUrgency({ revenueAtRiskUsd: 2.5e9, totalRevenueUsd: 10e9, dealsLast12mo: 6, intentScore: 100, hiringBd: true })).toBe(100);
    expect(computeUrgency({ revenueAtRiskUsd: null, totalRevenueUsd: null, dealsLast12mo: 0, intentScore: 0, hiringBd: false })).toBe(0);
    // Half of each component.
    expect(computeUrgency({ revenueAtRiskUsd: 1.25e9, totalRevenueUsd: 10e9, dealsLast12mo: 3, intentScore: 50, hiringBd: false })).toBe(45);
  });
  it('falls back to an absolute scale without a revenue denominator', () => {
    expect(computeUrgency({ revenueAtRiskUsd: 5e9, totalRevenueUsd: null, dealsLast12mo: 0, intentScore: null, hiringBd: null })).toBe(40);
    expect(computeUrgency({ revenueAtRiskUsd: 2.5e9, totalRevenueUsd: null, dealsLast12mo: 0, intentScore: null, hiringBd: null })).toBe(20);
  });
  it('clamps to 0–100', () => {
    expect(computeUrgency({ revenueAtRiskUsd: 9e12, totalRevenueUsd: 1, dealsLast12mo: 900, intentScore: 500, hiringBd: true })).toBe(100);
  });
});

describe('transactsAtPhase', () => {
  it('is yes when any prior deal is at or below the asset phase (calc-style keys accepted)', () => {
    expect(transactsAtPhase('phase_2', ['phase3', 'phase1'])).toBe('yes');
    expect(transactsAtPhase('preclinical', ['discovery'])).toBe('yes');
    expect(transactsAtPhase('phase2', ['phase_2'])).toBe('yes');
  });
  it('is yes when a valid stated minimum is at or below the asset phase', () => {
    expect(transactsAtPhase('phase_1', [], 'preclinical', 'phase_3')).toBe('yes');
    expect(transactsAtPhase('phase_1', ['phase_3'], 'phase1', 'approved')).toBe('yes');
  });
  it('is no when the valid stated minimum is above the asset phase and no prior deal is at or below', () => {
    expect(transactsAtPhase('preclinical', ['phase_2', 'phase_3'], 'phase_2', 'approved')).toBe('no');
    expect(transactsAtPhase('preclinical', [], 'phase_1', 'phase_3')).toBe('no');
  });
  it('ignores the alphabetical "approved / unknown" artefact and falls back to deals', () => {
    expect(transactsAtPhase('preclinical', ['phase_2'], 'approved', 'unknown')).toBe('unknown');
    expect(transactsAtPhase('preclinical', ['phase_2', 'phase_3', 'approved'], 'approved', 'unknown')).toBe('no');
    expect(transactsAtPhase('preclinical', ['preclinical'], 'approved', 'unknown')).toBe('yes');
  });
  it('is unknown without evidence', () => {
    expect(transactsAtPhase('phase_2', [])).toBe('unknown');
    expect(transactsAtPhase('unknown', ['phase_1'])).toBe('unknown');
    expect(transactsAtPhase('phase_2', ['unknown', 'unknown'])).toBe('unknown');
  });
});

describe('parsePatentCliffs', () => {
  it('reads the production shape', () => {
    const out = parsePatentCliffs([{ drug_name: 'Enhertu', indication: 'Oncology', expiry_year: 2035, revenue_usd: 6e9 }]);
    expect(out).toEqual([{ drug: 'Enhertu', expiryYear: 2035, revenueUsd: 6e9 }]);
  });
  it('tolerates alternative keys, strings and json text, and sorts by year', () => {
    const out = parsePatentCliffs(JSON.stringify([
      { drug: 'B', loe_year: '2031', revenue: 2e9 },
      { name: 'A', year: 2028, revenue_usd_m: 500 },
      { product: 'C', expiry: 2029 },
      { drug: '', expiry_year: 2030 },
      { drug: 'Bad', expiry_year: 'soon' },
      null, 'x',
    ]));
    expect(out.map(c => c.drug)).toEqual(['A', 'C', 'B']);
    expect(out[0].revenueUsd).toBe(5e8);
    expect(out[1].revenueUsd).toBeNull();
    expect(out[2].revenueUsd).toBe(2e9);
  });
  it('returns [] for garbage', () => {
    expect(parsePatentCliffs(null)).toEqual([]);
    expect(parsePatentCliffs('not json')).toEqual([]);
    expect(parsePatentCliffs({ drug: 'x' })).toEqual([]);
  });
});

describe('splitProcess', () => {
  const mk = (name: string, fit: number, urgency: number, t: BuyerCandidate['transactsAtPhase'] = 'yes') => ({ name, fit, urgency, transactsAtPhase: t });
  it('leads with the top 3 by fit×0.5 + urgency×0.5 among non-excluded, then 2–3 tension, rest hold', () => {
    const p = splitProcess([
      mk('A', 90, 90), mk('B', 80, 80), mk('C', 70, 70), mk('D', 60, 60), mk('E', 50, 50), mk('F', 40, 40), mk('G', 30, 30), mk('X', 99, 99, 'no'),
    ], 'preclinical');
    expect(p.lead).toEqual(['A', 'B', 'C']);
    expect(p.tension).toEqual(['D', 'E', 'F']);
    expect(p.hold).toEqual(['G']);
    expect(p.rationale).toContain('A, B and C');
    expect(p.rationale).toContain('signed at preclinical');
  });
  it('ranks by the combined score, not by fit alone', () => {
    const p = splitProcess([mk('LowFitHot', 40, 100), mk('HighFitCold', 90, 10), mk('Mid', 60, 60), mk('Z', 10, 10)], 'phase_2');
    expect(p.lead).toEqual(['LowFitHot', 'Mid', 'HighFitCold']);
    expect(p.tension).toEqual(['Z']);
  });
  it('handles an empty eligible list honestly', () => {
    const p = splitProcess([mk('X', 90, 90, 'no')], 'preclinical');
    expect(p.lead).toEqual([]);
    expect(p.rationale).toMatch(/No candidate/);
  });
});

describe('sentence builders', () => {
  it('whyNow prefers a named cliff with year and revenue', () => {
    const s = buildWhyNow({ ...candidate(), patentCliffs: [{ drug: 'Trulicity', expiryYear: 2027, revenueUsd: 4e9 }] }, 2026, 'neurology');
    expect(s).toContain('Trulicity');
    expect(s).toContain('2027');
    expect(s).toContain('$4.0B');
    expect(s).not.toMatch(/leverage|synerg|AI\b/);
  });
  it('whyNow falls back to revenue at risk, then a recent deal, then cadence', () => {
    expect(buildWhyNow({ ...candidate(), patentCliffs: [] }, 2026, 'neurology')).toContain('$3.0B of revenue is at risk');
    expect(buildWhyNow({ ...candidate(), patentCliffs: [], revenueAtRisk: { y2025: null, y2026: null, y2027: null } }, 2026, 'neurology')).toContain('Verge Genomics in 2024');
    expect(buildWhyNow({ ...candidate(), patentCliffs: [], revenueAtRisk: { y2025: null, y2026: null, y2027: null }, priorDeals: [] }, 2026, 'neurology')).toContain('8 deals');
  });
  it('howToEngage uses the preferred structure and the stage evidence', () => {
    const c = candidate({ preferredDealType: 'option', priorDeals: [] , transactsAtPhase: 'no' });
    const s = buildHowToEngage(c, 'preclinical', 'neurology', 2026);
    expect(s).toMatch(/^Option-to-license first; they have not signed at preclinical/);
    expect(s).toContain('aggressive');
    const paid = buildHowToEngage(candidate(), 'preclinical', 'neurology', 2026);
    expect(paid).toContain('paid upfront at preclinical or earlier once, most recently in 2024');
  });
});

// ─── buildBuyerMap with a chainable stub ────────────────────────────────────

type Row = Record<string, unknown>;
function stubSupabase(tables: Record<string, Row[]>) {
  const calls: Array<{ table: string; ops: string[] }> = [];
  const from = (table: string) => {
    const rec = { table, ops: [] as string[] };
    calls.push(rec);
    const q: Record<string, unknown> = {};
    const chain = (op: string) => (...args: unknown[]) => { rec.ops.push(`${op}(${args.map(a => JSON.stringify(a)).join(',')})`); return q; };
    for (const op of ['select', 'in', 'or', 'eq', 'is', 'not', 'ilike', 'order', 'limit']) q[op] = chain(op);
    q.then = (resolve: (v: { data: Row[]; error: null }) => unknown) => Promise.resolve({ data: tables[table] ?? [], error: null }).then(resolve);
    return q;
  };
  return { client: { from } as unknown as Parameters<typeof buildBuyerMap>[0], calls };
}

const COMPANIES: Row[] = [
  { id: 'lilly', name: 'Eli Lilly', name_variations: ['Eli Lilly and Company', 'Lilly'], company_type: 'large_pharma', hq_region: 'north_america', hq_country: 'US', phase_preference_min: 'approved', phase_preference_max: 'unknown', deals_last_12mo: 9, deals_last_24mo: 20, last_deal_date: '2026-08-01', total_annual_revenue: 34e9, revenue_at_risk_2025: 0, revenue_at_risk_2026: 0, revenue_at_risk_2027: 0, patent_cliffs: [{ drug_name: 'Trulicity', indication: 'T2D', expiry_year: 2027, revenue_usd: 4e9 }], hiring_bd_roles: false, acquisition_appetite: 'aggressive', data_quality_score: 80 },
  { id: 'roche', name: 'Roche', name_variations: ['Genentech', 'F. Hoffmann-La Roche'], company_type: 'large_pharma', hq_region: 'europe', hq_country: 'CH', phase_preference_min: 'phase_2', phase_preference_max: 'approved', deals_last_12mo: 4, deals_last_24mo: 9, last_deal_date: '2026-05-01', total_annual_revenue: null, revenue_at_risk_2025: null, revenue_at_risk_2026: null, revenue_at_risk_2027: null, patent_cliffs: [], hiring_bd_roles: false, acquisition_appetite: 'moderate', data_quality_score: 60 },
];
const DEALS: Row[] = [
  { id: 'd1', licensor_name: 'Verge Genomics', licensee_name: 'Eli Lilly', asset_name: null, announced_date: '2024-03-01', phase_at_signing: 'preclinical', deal_type: 'collaboration', upfront_usd: 25e6, total_deal_value_usd: 700e6, therapeutic_area: 'neurology', indication_category: 'cns', indication_specific: 'ALS', source_url: 'https://www.fiercebiotech.com/a', verified: true },
  { id: 'd2', licensor_name: 'Morphic', licensee_name: 'Eli Lilly and Company', asset_name: null, announced_date: '2024-07-01', phase_at_signing: 'phase_2', deal_type: 'acquisition', upfront_usd: 3.2e9, total_deal_value_usd: 3.2e9, therapeutic_area: 'immunology', indication_category: 'ibd', indication_specific: null, source_url: 'https://example.com/b', verified: false },
  { id: 'd3', licensor_name: 'Alector', licensee_name: 'Genentech', asset_name: null, announced_date: '2023-01-01', phase_at_signing: 'phase_2', deal_type: 'license', upfront_usd: 60e6, total_deal_value_usd: 2e9, therapeutic_area: 'neurology', indication_category: 'cns', indication_specific: 'ftd', source_url: null, verified: true },
  { id: 'd4', licensor_name: 'Zealand', licensee_name: 'Roche', asset_name: null, announced_date: '2025-03-01', phase_at_signing: 'phase_2', deal_type: 'license', upfront_usd: 1.65e9, total_deal_value_usd: 5.3e9, therapeutic_area: 'metabolic', indication_category: 'obesity', indication_specific: null, source_url: 'https://roche.com/c', verified: true },
  { id: 'd5', licensor_name: 'Someone', licensee_name: 'Roche', asset_name: null, announced_date: '2022-01-01', phase_at_signing: 'phase_3', deal_type: 'license', upfront_usd: null, total_deal_value_usd: null, therapeutic_area: 'oncology', indication_category: 'solid_tumor', indication_specific: null, source_url: null, verified: false },
];
const PREMIUMS: Row[] = [
  { company_id: 'lilly', company_name: 'Eli Lilly', premium_multiplier: 1.306, sample_size: 52, confidence: 'high', as_of_date: '2026-07-01' },
];

const PARTNERS: PartnerForPDF[] = [
  { company_name: 'Eli Lilly', match_score: 84, match_reasons: [], deals_last_12mo: 9, hq_country: 'US', pharma_intent: { intentScore: 72, intentTier: 'high', timing: 'near_term', confidence: 0.8, preferredDealType: 'license', factors: [{ name: 'patent_cliff', score: 60, weight: 0.2 }] } },
  { company_name: 'Roche', match_score: 71, match_reasons: [], deals_last_12mo: 4, hq_country: 'CH', pharma_intent: { intentScore: 40, intentTier: 'moderate', timing: 'medium_term', confidence: 0.6 } },
  { company_name: 'Unknown Biotech', match_score: 55, match_reasons: [], deals_last_12mo: 0, hq_country: null },
];

describe('buildBuyerMap (stubbed supabase)', () => {
  it('profiles each partner, matches prior deals across name variations, and never writes', async () => {
    const { client, calls } = stubSupabase({ companies: COMPANIES, deals: DEALS, counterparty_premiums: PREMIUMS });
    const map = await buildBuyerMap(client, ASSET, PARTNERS, { asOf: '2026-09-24' });

    expect(calls.every(c => c.ops.every(op => !/insert|update|upsert|delete/.test(op)))).toBe(true);
    expect(calls.map(c => c.table)).toEqual(expect.arrayContaining(['companies', 'deals', 'counterparty_premiums']));

    const lilly = map.candidates.find(c => c.name === 'Eli Lilly')!;
    expect(lilly.companyId).toBe('lilly');
    expect(lilly.transactsAtPhase).toBe('yes');                // preclinical deal (d1)
    expect(lilly.priorDeals.length).toBe(2);                   // d1 + d2 via "Eli Lilly and Company"
    expect(lilly.priorDeals[0].sameTA).toBe(true);             // same-TA first
    expect(lilly.priorDeals[0].upfrontM).toBe(25);
    expect(lilly.patentCliffs).toEqual([{ drug: 'Trulicity', expiryYear: 2027, revenueUsd: 4e9 }]);
    expect(lilly.revenueAtRisk.y2027).toBe(4e9);               // column is 0 → cliffs fallback
    expect(lilly.counterpartyPremium).toEqual({ multiplier: 1.306, n: 52, confidence: 'high' });
    expect(lilly.urgency).toBeGreaterThan(0);
    expect(lilly.whyNow).toContain('Trulicity');
    expect(lilly.howToEngage).toMatch(/^Go straight to a license/);

    const roche = map.candidates.find(c => c.name === 'Roche')!;
    expect(roche.priorDeals.length).toBe(3);                   // Genentech alias picked up
    expect(roche.transactsAtPhase).toBe('no');                 // valid stated min phase_2 > preclinical, no deal at/below
    expect(map.excluded.map(e => e.name)).toEqual(['Roche']);
    expect(map.excluded[0].reason).toContain('Phase 2');

    const unk = map.candidates.find(c => c.name === 'Unknown Biotech')!;
    expect(unk.companyId).toBeNull();
    expect(unk.transactsAtPhase).toBe('unknown');
    expect(unk.priorDeals).toEqual([]);

    expect(map.process.lead).toEqual(['Eli Lilly', 'Unknown Biotech']);
    expect(map.process.lead).not.toContain('Roche');
    expect(map.source.n).toBe(5);
    expect(map.source.note).toContain('60% verified');
    expect(map.candidates[map.candidates.length - 1].name).toBe('Roche'); // excluded ranks last
  });

  it('attaches implied ranges from valuations and returns an honest empty map with no partners', async () => {
    const { client } = stubSupabase({ companies: COMPANIES, deals: DEALS, counterparty_premiums: [] });
    const valuations = [{ buyer: { companyId: 'lilly', companyName: 'Eli Lilly' }, buyerUpfront: { low: 10, median: 30, high: 50 }, buyerSpecificDealValue: { low: 200, median: 400, high: 600 } }] as unknown as NonNullable<Parameters<typeof buildBuyerMap>[3]>['valuations'];
    const map = await buildBuyerMap(client, ASSET, PARTNERS.slice(0, 1), { asOf: '2026-09-24', valuations });
    expect(map.candidates[0].impliedUpfront).toEqual({ low: 10, median: 30, high: 50 });
    expect(map.candidates[0].impliedTotal?.median).toBe(400);

    const empty = await buildBuyerMap(client, ASSET, [], { asOf: '2026-09-24' });
    expect(empty.candidates).toEqual([]);
    expect(empty.source.n).toBe(0);
  });
});

// ─── computeBuyerValuations ─────────────────────────────────────────────────

describe('computeBuyerValuations', () => {
  const waterfall = {
    steps: [], upfrontPayment: { low: 10, median: 20, high: 30 }, developmentMilestones: { low: 0, median: 0, high: 0 },
    commercialMilestones: { low: 0, median: 0, high: 0 }, royaltyRate: { low: 5, median: 8, high: 12 }, totalDealValue: { low: 100, median: 200, high: 300 }, narrative: '',
  } as unknown as DealWaterfall;
  const rnpv = { riskAdjustedNPV: 250, unadjustedNPV: 900, cumulativePoS: 0.2, phaseTransitions: [], cashFlows: [], peakSalesYear: 2035, yearsToMarket: 8, impliedDealValue: { upfront: { low: 10, median: 20, high: 30 }, totalDeal: { low: 100, median: 200, high: 300 } }, discountRate: 0.12, terminalValue: 0, modelAssumptions: [] } as unknown as RNPVResult;

  it('prices the top 6 by match score and applies a counterparty premium when supplied', () => {
    const partners: PartnerForPDF[] = Array.from({ length: 8 }, (_, i) => ({ company_name: `Buyer ${i}`, match_score: 90 - i * 5, match_reasons: [], deals_last_12mo: i, hq_country: null }));
    const out = computeBuyerValuations(partners, waterfall, rnpv);
    expect(out.length).toBe(6);
    expect(out.map(v => v.buyer.companyName)).toEqual(['Buyer 0', 'Buyer 1', 'Buyer 2', 'Buyer 3', 'Buyer 4', 'Buyer 5']);
    expect(out[0].genericDealValue.median).toBe(200);
    expect(out[0].buyerSpecificDealValue.median).toBeGreaterThanOrEqual(out[0].genericDealValue.median * 0.5);

    const withPremium = computeBuyerValuations(partners.slice(0, 1), waterfall, rnpv, new Map([['buyer 0', { multiplier: 1.3, n: 40, confidence: 'high' }]]));
    expect(withPremium[0].counterpartyAdjustment?.contribution).toBeCloseTo(0.3, 5);
    expect(withPremium[0].buyerSpecificDealValue.median).toBeGreaterThan(out[0].buyerSpecificDealValue.median);
  });
  it('returns [] for missing inputs', () => {
    expect(computeBuyerValuations([], waterfall, rnpv)).toEqual([]);
    expect(computeBuyerValuations([{ company_name: '', match_score: 90, match_reasons: [], deals_last_12mo: 0, hq_country: null }], waterfall, rnpv)).toEqual([]);
  });
});

// ─── Charts ─────────────────────────────────────────────────────────────────

describe('svg charts', () => {
  it('quadrant plots every candidate, escapes names, and stays within 560px', () => {
    const svg = renderBuyerQuadrant(buyerMap().candidates, 900, 300);
    expect(svg).toMatch(/<svg width="560" height="300"/);
    expect((svg.match(/<circle/g) || []).length).toBeGreaterThanOrEqual(3 + 3); // bubbles + legend
    expect(svg).toContain('AbbVie &lt;Immunology&gt;');
    expect(svg).not.toContain('<Immunology>');
    for (const q of ['LEAD', 'TENSION', 'EDUCATE', 'HOLD']) expect(svg).toContain(q);
    expect(svg).toContain('STRATEGIC FIT');
    expect(svg).toContain('URGENCY');
    expect(svg).toContain(`stroke="#f43f5e"`); // rose outline for 'no'
  });
  it('quadrant labels do not stack on identical coordinates', () => {
    const same = [1, 2, 3, 4].map(i => candidate({ name: `Buyer ${i}`, fit: 50, urgency: 50 }));
    const svg = renderBuyerQuadrant(same);
    const ys = [...svg.matchAll(/<text x="([\d.]+)" y="([\d.]+)" text-anchor="(start|end|middle)" font-size="7.5"/g)].map(m => `${m[1]}|${m[2]}`);
    expect(new Set(ys).size).toBe(ys.length);
  });
  it('loe calendar renders one row per buyer (max 8), markers per cliff and an empty-row message', () => {
    const cands = [candidate(), candidate({ name: 'No Cliff Co', patentCliffs: [], revenueAtRisk: { y2025: null, y2026: null, y2027: null } })];
    const svg = renderLoeCalendar(cands, 2026, 2034);
    expect(svg).toMatch(/<svg width="560"/);
    expect(svg).toContain('Trulicity');
    expect(svg).toContain('Taltz');
    expect(svg).toContain('no disclosed cliffs');
    expect(svg).toContain('$3.0B'); // revenue at risk 2026–27 for Lilly
    const many = Array.from({ length: 12 }, (_, i) => candidate({ name: `B${i}` }));
    expect((renderLoeCalendar(many, 2026, 2034).match(/font-weight="600" fill="#1a1e42"/g) || []).length).toBe(8);
  });
});

// ─── Pages ──────────────────────────────────────────────────────────────────

const pdf = (map: BuyerMap | null): PDFReportData => ({ brief: { asOf: '2026-09-24', asset: ASSET, buyerMap: map } } as unknown as PDFReportData);

describe('renderBuyerMapPage', () => {
  it('renders a report page with the section title, table, quadrant, calendar and source lines', () => {
    const html = renderBuyerMapPage(pdf(buyerMap()), META);
    expect(html).toContain('class="report-page"');
    expect(html).toContain('Deal Intelligence Brief');
    expect(html).toContain('15 / 28');
    expect(html).toContain('Buyer map');
    expect(html).toContain('Who has the fit, the urgency, and the habit of transacting at this stage?');
    expect((html.match(/Source: /g) || []).length).toBe(3);
    expect((html.match(/<svg /g) || []).length).toBe(2);
    expect(html).toContain('AbbVie &lt;Immunology&gt;');
    expect(html).not.toContain('<Immunology>');
    expect(html).toContain('$35M'); // implied upfront
    expect(html).toContain('Transacts at Preclinical');
    expect(html).not.toMatch(/Deal Valuation Report|illustrative|sample\b/i);
  });
  it('caps the capacity table at 10 rows', () => {
    const many = buyerMap({ candidates: Array.from({ length: 14 }, (_, i) => candidate({ name: `Buyer ${i}` })) });
    const html = renderBuyerMapPage(pdf(many), META);
    expect((html.match(/<tr>\s*<td/g) || []).length).toBe(10);
  });
  it('shows an empty state when the buyer map is null', () => {
    const html = renderBuyerMapPage(pdf(null), META);
    expect(html).toContain('class="report-page"');
    expect(html).toContain('Buyer map');
    expect(html).toContain('No buyer map for this asset');
    expect(html).not.toContain('<svg');
  });
});

describe('renderBuyerBehaviourPage', () => {
  it('renders cards for the top 6, the excluded list and the process block', () => {
    const many = buyerMap({ candidates: Array.from({ length: 9 }, (_, i) => candidate({ name: `Buyer ${i}` })) });
    const html = renderBuyerBehaviourPage(pdf(many), META);
    expect(html).toContain('class="report-page"');
    expect(html).toContain('Buyer stage behaviour');
    expect(html).toContain('What has each buyer actually paid for assets at this stage, and how do we sequence the approach?');
    expect((html.match(/Why now\./g) || []).length).toBe(6);
    expect(html).toContain('Not on the list');
    expect(html).toContain('none at preclinical or earlier');
    expect(html).toContain('Process');
    expect(html).toContain('Open with Eli Lilly and AbbVie.');
    expect(html).toContain('fiercebiotech.com');
    expect(html).toContain('Source: ');
    expect(html).not.toMatch(/Deal Valuation Report|illustrative|\bAI\b/);
  });
  it('escapes names and says so when nobody is excluded', () => {
    const html = renderBuyerBehaviourPage(pdf(buyerMap({ excluded: [] })), META);
    expect(html).toContain('AbbVie &lt;Immunology&gt;');
    expect(html).toContain('nobody is excluded on stage');
  });
  it('shows an empty state when the buyer map is null', () => {
    const html = renderBuyerBehaviourPage(pdf(null), META);
    expect(html).toContain('No buyer behaviour to report');
    expect(html).toContain('Buyer stage behaviour');
  });
});
