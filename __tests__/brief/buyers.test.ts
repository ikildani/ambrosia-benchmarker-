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
  groupLicensees,
  sizeBucketOf,
  regionOf,
  selectMix,
  mixOf,
  CANDIDATE_TARGET,
  MIN_MID,
  MIN_LARGE,
  type PartnerInput,
} from '@/lib/brief/buyer-map';
import { computeBuyerValuations } from '@/lib/brief/buyer-valuations';
import { renderBuyerQuadrant } from '@/lib/report/svg-charts/quadrant';
import { renderLoeCalendar } from '@/lib/report/svg-charts/loeCalendar';
import { renderBuyerMapPage, renderBuyerMixStrip } from '@/lib/report/pages/buyerMap';
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
    companyId: 'c1', name: 'Eli Lilly', companyType: 'large_pharma', sizeBucket: 'large_pharma', hqRegion: 'north_america', hqCountry: 'US',
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
    mix: { large: 3, mid: 0, unknown: 0, regions: ['north_america'] },
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
    // Three later-stage deals are too thin to exclude a buyer; five are not.
    expect(transactsAtPhase('preclinical', ['phase_2', 'phase_3', 'approved'], 'approved', 'unknown')).toBe('unknown');
    expect(transactsAtPhase('preclinical', ['phase_2', 'phase_3', 'approved', 'phase_3', 'phase_2'], 'approved', 'unknown')).toBe('no');
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
  it('ranks by the combined score among buyers that clear the fit gate; urgency alone does not make a lead', () => {
    const p = splitProcess([mk('LowFitHot', 40, 100), mk('HighFitCold', 90, 10), mk('Mid', 60, 60), mk('Z', 10, 10)], 'phase_2');
    // Gate (fit >= 60): Mid, HighFitCold clear it and lead by score; LowFitHot follows despite the higher combined score.
    expect(p.lead).toEqual(['Mid', 'HighFitCold', 'LowFitHot']);
    expect(p.tension).toEqual(['Z']);
    expect(p.rationale).toMatch(/fit of 60 or more/);
  });
  it('drops the fit gate when fewer than two buyers clear it, and a recent same-indication deal counts as clearing it', () => {
    const p = splitProcess([mk('LowFitHot', 40, 100), mk('B', 30, 80), mk('C', 20, 70)], 'phase_2');
    expect(p.lead).toEqual(['LowFitHot', 'B', 'C']);
    expect(p.rationale).toMatch(/no candidate clears the fit gate/);
    const q = splitProcess([
      { ...mk('LowFitHot', 40, 100), recentIndicationDeal: { parties: 'X → LowFitHot', year: 2026 } },
      mk('HighFitCold', 90, 10), mk('Mid', 60, 60), mk('Z', 10, 10),
    ], 'phase_2');
    expect(q.lead).toEqual(['LowFitHot', 'Mid', 'HighFitCold']); // 70 + 10 bonus beats Mid's 60
  });
  it('handles an empty eligible list honestly', () => {
    const p = splitProcess([mk('X', 90, 90, 'no')], 'preclinical');
    expect(p.lead).toEqual([]);
    expect(p.rationale).toMatch(/No candidate/);
  });
  const sized = (name: string, score: number, sizeBucket: BuyerCandidate['sizeBucket'], t: BuyerCandidate['transactsAtPhase'] = 'yes') => ({ name, fit: score, urgency: score, transactsAtPhase: t, sizeBucket });
  it('promotes a mid-sized buyer within 10 points of the third lead when all three leads are large', () => {
    const p = splitProcess([
      sized('BigA', 90, 'large_pharma'), sized('BigB', 85, 'large_pharma'), sized('BigC', 80, 'large_biotech'),
      sized('MidD', 72, 'mid_biotech'), sized('BigE', 70, 'large_pharma'), sized('MidF', 60, 'specialty'),
    ], 'preclinical');
    expect(p.lead).toEqual(['BigA', 'BigB', 'MidD']);
    expect(p.tension[0]).toBe('BigC');                       // demoted large goes to the front of tension
    expect(p.tension).toEqual(['BigC', 'BigE', 'MidF']);
    expect(p.rationale).toContain('MidD takes the third lead slot ahead of BigC');
    expect(p.rationale).toContain('mid-sized buyers move faster at this stage');
    expect(p.rationale).toContain('8 points apart');
  });
  it('does not promote when the gap exceeds 10 points, when a lead is already mid-sized, or when the mid candidate is excluded on stage', () => {
    const far = splitProcess([sized('BigA', 90, 'large_pharma'), sized('BigB', 85, 'large_pharma'), sized('BigC', 80, 'large_pharma'), sized('MidD', 69, 'mid_pharma')], 'phase_2');
    expect(far.lead).toEqual(['BigA', 'BigB', 'BigC']);
    expect(far.rationale).not.toContain('move faster');
    const already = splitProcess([sized('BigA', 90, 'large_pharma'), sized('MidB', 85, 'mid_pharma'), sized('BigC', 80, 'large_pharma'), sized('MidD', 79, 'mid_biotech')], 'phase_2');
    expect(already.lead).toEqual(['BigA', 'MidB', 'BigC']);
    const excluded = splitProcess([sized('BigA', 90, 'large_pharma'), sized('BigB', 85, 'large_pharma'), sized('BigC', 80, 'large_pharma'), sized('MidD', 79, 'mid_biotech', 'no')], 'phase_2');
    expect(excluded.lead).toEqual(['BigA', 'BigB', 'BigC']);
    // Candidates without a bucket (legacy callers) never trigger a promotion.
    const legacy = splitProcess([mk('A', 90, 90), mk('B', 80, 80), mk('C', 70, 70), mk('D', 65, 65)], 'phase_2');
    expect(legacy.lead).toEqual(['A', 'B', 'C']);
  });
});

// ─── Size bucket, region and the mix rule ───────────────────────────────────

describe('sizeBucketOf / regionOf', () => {
  it('uses company_type when it is one of the five buckets', () => {
    expect(sizeBucketOf('large_pharma', 5e8)).toBe('large_pharma');
    expect(sizeBucketOf('mid_biotech', 50e9)).toBe('mid_biotech');
    expect(sizeBucketOf('Specialty', null)).toBe('specialty');
    expect(sizeBucketOf('large-biotech', null)).toBe('large_biotech');
  });
  it('infers from revenue when the type is missing: >= $10B large_pharma, $1–10B mid_pharma, < $1B mid_biotech', () => {
    expect(sizeBucketOf(null, 34e9)).toBe('large_pharma');
    expect(sizeBucketOf(null, 10e9)).toBe('large_pharma');
    expect(sizeBucketOf(undefined, 4.4e9)).toBe('mid_pharma');
    expect(sizeBucketOf('', 1e9)).toBe('mid_pharma');
    expect(sizeBucketOf(null, 8e8)).toBe('mid_biotech');
    expect(sizeBucketOf('conglomerate', 8e8)).toBe('mid_biotech');
  });
  it('is unknown without type or revenue', () => {
    expect(sizeBucketOf(null, null)).toBe('unknown');
    expect(sizeBucketOf(null, 0)).toBe('unknown');
    expect(sizeBucketOf('other', undefined)).toBe('unknown');
  });
  it('maps hq_region first, then country codes and names', () => {
    expect(regionOf('europe', 'US')).toBe('europe');
    expect(regionOf('south_korea', null)).toBe('china_apac');
    expect(regionOf('latin_america', null)).toBe('other');
    expect(regionOf(null, 'US')).toBe('north_america');
    expect(regionOf(null, 'United States')).toBe('north_america');
    expect(regionOf(null, 'Switzerland')).toBe('europe');
    expect(regionOf(null, 'GB')).toBe('europe');
    expect(regionOf(null, 'UK')).toBe('europe');
    expect(regionOf(null, 'Japan')).toBe('japan');
    expect(regionOf(null, 'JP')).toBe('japan');
    expect(regionOf(null, 'China')).toBe('china_apac');
    expect(regionOf(null, 'South Korea')).toBe('china_apac');
    expect(regionOf(null, 'Israel')).toBe('other');
    expect(regionOf(null, null)).toBe('unknown');
    expect(regionOf('', '')).toBe('unknown');
  });
});

describe('selectMix', () => {
  type B = BuyerCandidate['sizeBucket'];
  const mkc = (name: string, score: number, sizeBucket: B, country: string | null = 'US', t: BuyerCandidate['transactsAtPhase'] = 'yes') =>
    ({ name, fit: score, urgency: score, transactsAtPhase: t, sizeBucket, hqRegion: null, hqCountry: country });

  it('fills at least 4 mid-sized and 4 large when available, the rest by score, and ranks by score', () => {
    const pool = [
      ...Array.from({ length: 12 }, (_, i) => mkc(`Big${i}`, 90 - i, 'large_pharma')),       // 90..79
      mkc('MidA', 60, 'mid_pharma'), mkc('MidB', 58, 'mid_biotech'), mkc('MidC', 55, 'specialty'), mkc('MidD', 50, 'mid_biotech'), mkc('MidE', 45, 'mid_biotech'),
    ];
    const { selected, mix } = selectMix(pool);
    expect(selected.length).toBe(CANDIDATE_TARGET);
    expect(mix.mid).toBe(MIN_MID);
    expect(mix.large).toBe(8);
    expect(mix.unknown).toBe(0);
    expect(selected.slice(0, 8).map(c => c.name)).toEqual(['Big0', 'Big1', 'Big2', 'Big3', 'Big4', 'Big5', 'Big6', 'Big7']);
    expect(selected.slice(8).map(c => c.name)).toEqual(['MidA', 'MidB', 'MidC', 'MidD']);
    expect(mix.regions).toEqual(['north_america']);
  });
  it('falls back gracefully when no mid-sized candidate exists or when the pool is short', () => {
    const allBig = Array.from({ length: 15 }, (_, i) => mkc(`Big${i}`, 90 - i, i % 2 ? 'large_pharma' : 'large_biotech'));
    const a = selectMix(allBig);
    expect(a.selected.length).toBe(12);
    expect(a.mix).toEqual({ large: 12, mid: 0, unknown: 0, regions: ['north_america'] });
    const short = selectMix([mkc('A', 80, 'large_pharma'), mkc('B', 70, 'unknown', null)]);
    expect(short.selected.map(c => c.name)).toEqual(['A', 'B']);
    expect(short.mix).toEqual({ large: 1, mid: 0, unknown: 1, regions: ['north_america'] });
    expect(selectMix([]).selected).toEqual([]);
  });
  it('reserves the mid quota for buyers that may transact at the phase and uses stage-excluded buyers only to fill empty slots, last', () => {
    const pool = [
      mkc('Big0', 90, 'large_pharma'), mkc('Big1', 88, 'large_pharma'),
      mkc('MidNo', 85, 'mid_pharma', 'US', 'no'), mkc('MidYes', 40, 'mid_biotech'),
      mkc('BigNo', 95, 'large_pharma', 'US', 'no'),
    ];
    const { selected, mix } = selectMix(pool, 4);
    expect(selected.map(c => c.name)).toEqual(['Big0', 'Big1', 'MidYes', 'BigNo']);
    expect(mix.mid).toBe(1);
    const { selected: s3 } = selectMix(pool, 3);
    expect(s3.map(c => c.name)).toEqual(['Big0', 'Big1', 'MidYes']);
  });
  it('prefers an unrepresented region within 5 points, but never beyond', () => {
    const pool = [
      mkc('US1', 90, 'large_pharma', 'US'), mkc('US2', 89, 'large_pharma', 'US'), mkc('US3', 88, 'large_pharma', 'US'),
      mkc('CH', 85, 'large_pharma', 'Switzerland'),   // within 5 of US3 → taken before US3? no: US1 first; CH within 5 of US2 → wins slot 2
      mkc('JP', 70, 'large_pharma', 'Japan'),         // 18 below → stays in score order
      mkc('US4', 84, 'large_pharma', 'US'),
    ];
    const { selected, mix } = selectMix(pool, 3);
    expect(selected.map(c => c.name)).toEqual(['US1', 'US2', 'CH']);
    expect(mix.regions).toEqual(['north_america', 'europe']);
    const wide = selectMix([mkc('US1', 90, 'large_pharma', 'US'), mkc('US2', 89, 'large_pharma', 'US'), mkc('JP', 80, 'large_pharma', 'Japan')], 2);
    expect(wide.selected.map(c => c.name)).toEqual(['US1', 'US2']);
  });
  it('mixOf summarises an existing list', () => {
    expect(mixOf([mkc('A', 1, 'mid_pharma', 'Japan'), mkc('B', 1, 'large_biotech', 'CN'), mkc('C', 1, 'unknown', null)])).toEqual({ large: 1, mid: 1, unknown: 1, regions: ['japan', 'china_apac'] });
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
    for (const op of ['select', 'in', 'or', 'eq', 'is', 'not', 'ilike', 'order', 'limit', 'range']) q[op] = chain(op);
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

    // No partners and no TA/indication → nothing to supplement from → honest empty map.
    const empty = await buildBuyerMap(client, { ...ASSET, therapeuticArea: '', indication: '' }, [], { asOf: '2026-09-24' });
    expect(empty.candidates).toEqual([]);
    expect(empty.source.n).toBe(0);
    // No partners but a TA → the deal-history supplement still produces candidates.
    const fromHistoryOnly = await buildBuyerMap(client, ASSET, [], { asOf: '2026-09-24' });
    expect(fromHistoryOnly.candidates.length).toBeGreaterThan(0);
    expect(fromHistoryOnly.candidates.every(c => c.source === 'deal_history')).toBe(true);
  });
});


// ─── Deal-history supplement ────────────────────────────────────────────────

const AD = (id: string, licensee: string, date: string, extra: Partial<Row> = {}): Row => ({
  id, licensor_name: `Licensor ${id}`, licensee_name: licensee, asset_name: null, announced_date: date, phase_at_signing: 'phase_1', deal_type: 'license',
  upfront_usd: 50e6, total_deal_value_usd: 900e6, therapeutic_area: 'neurology', indication_category: 'cns', indication_specific: 'alzheimers', source_url: 'https://www.biospace.com/x', verified: true, ...extra,
});
const SUPPLEMENT_DEALS: Row[] = [
  ...DEALS,
  AD('s1', 'Biogen Inc.', '2025-05-01'),                 // variant of Biogen → collapses
  AD('s2', 'Biogen', '2024-02-01'),
  AD('s3', 'Eli Lilly and Company', '2025-01-01'),       // variant of an existing partner → not added
  AD('s4', 'AbbVie', '2025-06-01', { indication_specific: 'parkinsons' }),   // same TA only → fit 55
  AD('s5', 'Novartis', '2023-03-01'),
  AD('s6', 'Takeda', '2024-09-01'),
  AD('s7', 'Sanofi', '2022-01-01'),
  AD('s8', 'Merck', '2025-08-01'),
  AD('s10', 'Bristol Myers Squibb', '2024-11-01'),
  AD('s12', 'Bayer', '2020-01-01', { therapeutic_area: 'oncology', indication_category: 'solid_tumor', indication_specific: 'lung' }), // not TA → ignored
];
const SUPPLEMENT_COMPANIES: Row[] = [
  ...COMPANIES,
  { id: 'biogen', name: 'Biogen', name_variations: ['Biogen Inc.', 'Biogen Idec'], company_type: 'large_biotech', hq_region: 'north_america', hq_country: 'US', phase_preference_min: null, phase_preference_max: null, deals_last_12mo: 9, deals_last_24mo: 12, last_deal_date: '2026-06-01', total_annual_revenue: 2e9, revenue_at_risk_2025: null, revenue_at_risk_2026: null, revenue_at_risk_2027: null, patent_cliffs: [{ drug_name: 'Tysabri', expiry_year: 2027, revenue_usd: 1.5e9 }], hiring_bd_roles: true, acquisition_appetite: 'aggressive', data_quality_score: 70 },
];

describe('groupLicensees', () => {
  it('collapses spellings through name_variations and ranks same-indication ×3 + same-TA, recency tie-break', () => {
    const rows = [
      { licensee_name: 'Biogen Inc.', announced_date: '2025-05-01', sameIndication: true },
      { licensee_name: 'Biogen', announced_date: '2024-02-01', sameIndication: true },
      { licensee_name: 'AbbVie', announced_date: '2025-06-01', sameIndication: false },
      { licensee_name: 'abbvie', announced_date: '2025-07-01', sameIndication: false },
      { licensee_name: 'Merck', announced_date: '2025-08-01', sameIndication: false },
      { licensee_name: 'Novartis', announced_date: '2023-01-01', sameIndication: false },
    ];
    const g = groupLicensees(rows, [{ id: 'biogen', name: 'Biogen', name_variations: ['Biogen Inc.'] }]);
    expect(g.map(x => x.name)).toEqual(['Biogen', 'AbbVie', 'Merck', 'Novartis']);
    expect(g[0]).toMatchObject({ companyId: 'biogen', sameIndication: 2, sameTA: 0, score: 6 });
    expect(g[1]).toMatchObject({ companyId: null, sameTA: 2, score: 2 });
  });
});

describe('buildBuyerMap deal-history supplement', () => {
  it('fills from TA deal history, dedupes variants of existing partners, tags the source and buckets every candidate', async () => {
    const { client, calls } = stubSupabase({ companies: SUPPLEMENT_COMPANIES, deals: SUPPLEMENT_DEALS, counterparty_premiums: PREMIUMS });
    const map = await buildBuyerMap(client, ASSET, PARTNERS, { asOf: '2026-09-24' });

    expect(map.candidates.length).toBe(10);                  // 3 partners + 7 licensees < target of 12
    expect(map.candidates.find(c => c.name === 'Eli Lilly')!.sizeBucket).toBe('large_pharma');
    expect(map.candidates.find(c => c.name === 'Biogen')!.sizeBucket).toBe('large_biotech');
    expect(map.candidates.find(c => c.name === 'Unknown Biotech')!.sizeBucket).toBe('unknown');
    expect(map.mix.large).toBe(3);
    expect(map.mix.unknown).toBe(7);
    expect(map.mix.regions).toEqual(expect.arrayContaining(['north_america', 'europe']));
    expect(map.source.note).toContain('10 buyers selected from 10 profiled');
    const names = map.candidates.map(c => c.name);
    expect(new Set(names.map(n => n.toLowerCase())).size).toBe(10);
    expect(names).not.toContain('Eli Lilly and Company');
    expect(names).not.toContain('Biogen Inc.');
    expect(names).not.toContain('Bayer');
    expect(names).toContain('Biogen');

    const fromMatch = map.candidates.filter(c => c.source === 'partner_match');
    const fromHistory = map.candidates.filter(c => c.source === 'deal_history');
    expect(fromMatch.map(c => c.name).sort()).toEqual(['Eli Lilly', 'Roche', 'Unknown Biotech']);
    expect(fromHistory.length).toBe(7);
    for (const c of fromHistory) {
      expect(c.intentScore).toBeNull();
      expect([55, 70]).toContain(c.fit);
      expect(c.whyNow).toMatch(/^Signed .+ in \d{4} at \$\d+M upfront/);
    }
    const biogen = fromHistory.find(c => c.name === 'Biogen')!;
    expect(biogen.companyId).toBe('biogen');
    expect(biogen.fit).toBe(70);                      // same-indication deals
    expect(biogen.priorDeals.length).toBe(2);        // both spellings matched
    expect(biogen.patentCliffs[0].drug).toBe('Tysabri');
    expect(biogen.urgency).toBeGreaterThan(0);
    expect(fromHistory.find(c => c.name === 'AbbVie')!.fit).toBe(55);   // same TA only
    expect(fromHistory.map(c => c.name).sort()).toEqual(['AbbVie', 'Biogen', 'Bristol Myers Squibb', 'Merck', 'Novartis', 'Sanofi', 'Takeda']);

    // Lilly picked up the extra deal via its variation without being duplicated.
    const lilly = map.candidates.find(c => c.name === 'Eli Lilly')!;
    expect(lilly.priorDeals.length).toBe(3);
    expect(map.source.note).toContain('7 added from deal history');

    // The supplement paged the deals table with the quality filter and never wrote.
    const dealCalls = calls.filter(c => c.table === 'deals');
    expect(dealCalls.length).toBeGreaterThanOrEqual(2);
    expect(dealCalls[0].ops.some(op => op.startsWith('range('))).toBe(true);
    expect(dealCalls[0].ops).toEqual(expect.arrayContaining([expect.stringContaining('"is_canonical","is",false'), expect.stringContaining('verification_status')]));
    expect(calls.every(c => c.ops.every(op => !/insert|update|upsert|delete/.test(op)))).toBe(true);
  });

  it('always runs the supplement and applies the mix rule to the pooled list', async () => {
    const { client, calls } = stubSupabase({ companies: SUPPLEMENT_COMPANIES, deals: SUPPLEMENT_DEALS, counterparty_premiums: [] });
    // 14 large partners outrank every mid-sized name; the rule still seats 4 mid-sized buyers.
    const many: PartnerInput[] = [
      ...Array.from({ length: 14 }, (_, i) => ({ company_name: `Partner ${i}`, match_score: 95 - i, match_reasons: [], deals_last_12mo: 1, hq_country: 'US', company_type: 'large_pharma' })),
      ...['Acadia', 'Supernus', 'Alkermes', 'Jazz', 'Harmony'].map((n, i) => ({ company_name: n, match_score: 40 - i, match_reasons: [], deals_last_12mo: 0, hq_country: i === 0 ? 'Ireland' : 'US', company_type: i === 4 ? 'specialty' : 'mid_biotech' })),
    ];
    const map = await buildBuyerMap(client, ASSET, many, { asOf: '2026-09-24' });
    expect(map.candidates.length).toBe(CANDIDATE_TARGET);
    expect(map.mix.mid).toBe(MIN_MID);
    expect(map.mix.large).toBeGreaterThanOrEqual(MIN_LARGE);
    expect(map.candidates.filter(c => c.sizeBucket === 'mid_biotech' || c.sizeBucket === 'specialty').map(c => c.name)).toEqual(['Acadia', 'Supernus', 'Alkermes', 'Jazz']);
    expect(map.candidates.some(c => c.source === 'deal_history')).toBe(true);   // Biogen etc. entered the pool
    expect(map.mix.regions).toEqual(expect.arrayContaining(['north_america', 'europe']));
    expect(calls.filter(c => c.table === 'deals').length).toBeGreaterThanOrEqual(2);
    // Stage exclusions come from the whole pool: Roche (min phase_2) is named even though it did not make the list.
    expect(map.excluded.map(e => e.name)).toContain('Roche');
    expect(map.candidates.map(c => c.name)).not.toContain('Roche');
  });

  it('lets a promoted mid-sized buyer into the lead group', async () => {
    const { client } = stubSupabase({ companies: SUPPLEMENT_COMPANIES, deals: DEALS, counterparty_premiums: [] });
    const partners: PartnerInput[] = [
      { company_name: 'Big A', match_score: 90, match_reasons: [], deals_last_12mo: 0, hq_country: 'US', company_type: 'large_pharma' },
      { company_name: 'Big B', match_score: 88, match_reasons: [], deals_last_12mo: 0, hq_country: 'US', company_type: 'large_pharma' },
      { company_name: 'Big C', match_score: 86, match_reasons: [], deals_last_12mo: 0, hq_country: 'US', company_type: 'large_biotech' },
      { company_name: 'Mid D', match_score: 80, match_reasons: [], deals_last_12mo: 0, hq_country: 'US', company_type: 'mid_biotech' },
    ];
    const map = await buildBuyerMap(client, { ...ASSET, therapeuticArea: 'dermatology', indication: 'psoriasis' }, partners, { asOf: '2026-09-24' });
    expect(map.process.lead).toEqual(['Big A', 'Big B', 'Mid D']);
    expect(map.process.tension[0]).toBe('Big C');
    expect(map.process.rationale).toContain('mid-sized buyers move faster at this stage');
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
  it('uses the phase / TA slice (n ≥ 5) for the asset context, else the company-wide multiplier', () => {
    const partners: PartnerForPDF[] = [{ company_name: 'Buyer 0', match_score: 90, match_reasons: [], deals_last_12mo: 3, hq_country: null }];
    const entry = {
      multiplier: 1.3, n: 40, confidence: 'high', companyId: 'b0',
      byTherapeuticArea: { oncology: { premium: 1.1, n: 12 }, neurology: { premium: 0.9, n: 3 } },
      byPhase: { phase_2: { premium: 0.8, n: 7 }, phase_3: { premium: 1.4, n: 2 } },
    };
    const premiums = new Map([['buyer 0', entry]]);
    // phase slice wins when reliable
    const p2 = computeBuyerValuations(partners, waterfall, rnpv, premiums, 6, { therapeuticArea: 'oncology', phase: 'Phase 2' });
    // n = 7 → medium confidence → the engine applies the −0.2 premium at half weight
    expect(p2[0].counterpartyAdjustment?.contribution).toBeCloseTo(-0.1, 5);
    expect(p2[0].counterpartyAdjustment?.confidence).toBe('medium');
    expect(p2[0].counterpartyAdjustment?.source).toBe('phase_specific');
    // thin phase slice → TA slice
    const p3 = computeBuyerValuations(partners, waterfall, rnpv, premiums, 6, { therapeuticArea: 'oncology', phase: 'phase_3' });
    expect(p3[0].counterpartyAdjustment?.contribution).toBeCloseTo(0.1, 5);
    expect(p3[0].counterpartyAdjustment?.source).toBe('ta_specific');
    // thin TA slice and no phase slice → company-wide
    const cw = computeBuyerValuations(partners, waterfall, rnpv, premiums, 6, { therapeuticArea: 'neurology', phase: 'preclinical' });
    expect(cw[0].counterpartyAdjustment?.contribution).toBeCloseTo(0.3, 5);
    expect(cw[0].counterpartyAdjustment?.source).toBe('company_wide');
    // no context → unchanged behaviour
    const none = computeBuyerValuations(partners, waterfall, rnpv, premiums);
    expect(none[0].counterpartyAdjustment?.contribution).toBeCloseTo(0.3, 5);
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
    expect(html).toContain('Buyer mix');
    expect(html).toContain('3 large');
    expect(html).toContain('0 mid-sized');
    expect(html).toContain('Regions: N America');
    expect(html).toContain('No mid-sized buyer with a disclosed deal');
    expect(html).toContain('<th style="padding: 4px 5px; text-align: center; font-size: 6.5px; line-height: 1.2; vertical-align: bottom;">Size</th>');
    expect(html).toMatch(/id="bq-/);
    expect(html).toMatch(/id="loe-/);
    expect(html).toContain('AbbVie &lt;Immunology&gt;');
    expect(html).not.toContain('<Immunology>');
    expect(html).toContain('$35M'); // implied upfront
    expect(html).toContain('At Preclinical');
    expect(html).not.toMatch(/Deal Valuation Report|illustrative|sample\b/i);
  });
  it('caps the capacity table at 12 rows and prints the size bucket per row', () => {
    const many = buyerMap({ candidates: Array.from({ length: 14 }, (_, i) => candidate({ name: `Buyer ${i}`, sizeBucket: i % 3 === 0 ? 'mid_biotech' : i % 3 === 1 ? 'large_pharma' : 'unknown' })) });
    const html = renderBuyerMapPage(pdf(many), META);
    expect((html.match(/<tr>\s*<td/g) || []).length).toBe(12);
    expect((html.match(/>Mid<\/span>/g) || []).length).toBe(4);
    expect((html.match(/>Large<\/span>/g) || []).length).toBe(4);
  });
  it('mix strip: counts, regions and a rationale for each composition; falls back when the map carries no mix', () => {
    const both = renderBuyerMixStrip({ large: 6, mid: 4, unknown: 2, regions: ['north_america', 'europe', 'japan'] }, 'Preclinical');
    expect(both).toContain('6 large');
    expect(both).toContain('4 mid-sized');
    expect(both).toContain('2 size undisclosed');
    expect(both).toContain('Regions: N America, Europe, Japan');
    expect(both).toContain('Large pharma sets the price ceiling');
    const midOnly = renderBuyerMixStrip({ large: 0, mid: 5, unknown: 0, regions: [] }, 'Phase 1');
    expect(midOnly).toContain('Only mid-sized buyers reached the list');
    expect(midOnly).toContain('HQ region not disclosed');
    expect(midOnly).not.toContain('size undisclosed');
    const legacy = { ...buyerMap(), mix: undefined } as unknown as BuyerMap;
    const html = renderBuyerMapPage(pdf(legacy), META);
    expect(html).toContain('3 large');
    expect(html).not.toMatch(/illustrative|sample\b|\bAI\b/);
  });
  it('shows an empty state when the buyer map is null', () => {
    const html = renderBuyerMapPage(pdf(null), META);
    expect(html).toContain('class="report-page"');
    expect(html).toContain('Buyer map');
    expect(html).toContain('No buyer map for this asset');
    expect(html).not.toMatch(/id="(bq|loe)-/);
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
    expect(html).toContain('Large pharma · large-cap');
    expect(html).not.toMatch(/Deal Valuation Report|illustrative|\bAI\b/);
  });
  it('shows the size bucket next to the type on each card', () => {
    const map = buyerMap({ candidates: [
      candidate({ name: 'Mid Co', companyType: 'mid_biotech', sizeBucket: 'mid_biotech' }),
      candidate({ name: 'Rev Co', companyType: null, sizeBucket: 'mid_pharma' }),
      candidate({ name: 'Blank Co', companyType: null, sizeBucket: 'unknown' }),
    ] });
    const html = renderBuyerBehaviourPage(pdf(map), META);
    expect(html).toContain('Mid biotech · mid-sized');
    expect(html).toContain('Mid-sized (by revenue)');
    expect(html).toContain('Size undisclosed');
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
