/**
 * Post-delivery brief alerts: the watch set derived from a stored brief, the
 * pure selection rules (each kind, dedupe keys, month-precision dates, merged
 * company ids, comps already in the set, opted-out requests), the digest
 * email, the opt-out token, and the runner against a stubbed Supabase with
 * an injected sender (first run sends, second run sends nothing).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  BRIEF_ALERTS_CURSOR_SOURCE,
  buildBriefAlertEmail,
  buildBriefWatch,
  briefAlertLinks,
  catalystDateMs,
  catalystKey,
  runBriefAlerts,
  selectBriefAlerts,
  type BriefAlertDealRow,
  type BriefAlertInputs,
  type BriefAlertIntentRow,
  type BriefAlertItem,
  type BriefAlertRequestRow,
  type BriefAlertSender,
} from '@/lib/brief/alerts';
import { signBriefAlertToken, verifyBriefAlertToken } from '@/lib/brief/alert-token';
import { FOLLOWUP_FROM, FOLLOWUP_REPLY_TO } from '@/lib/outcomes/followups';
import type { AssetProfile, BriefIntelligence, BuyerCandidate, BuyerMap, CatalystEvent, CompRow, CompSet } from '@/lib/brief/types';

// ─── fixtures (shape follows __tests__/brief/decision.test.ts) ──────────────

const NOW = new Date('2026-09-26T13:00:00Z');
const AS_OF = '2026-09-01';
const DELIVERED_AT = '2026-09-01T15:00:00Z';
const R1 = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const R2 = '1a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const ROCHE_ID = 'aaaa0000-0000-4000-8000-000000000001';
const MERCK_OLD_ID = 'aaaa0000-0000-4000-8000-000000000002';
const MERCK_ID = 'aaaa0000-0000-4000-8000-000000000003';
const OTHER_ID = 'aaaa0000-0000-4000-8000-000000000009';
const COMP_IDS = ['c0c0c0c0-0000-4000-8000-000000000000', 'c0c0c0c0-0000-4000-8000-000000000001', 'c0c0c0c0-0000-4000-8000-000000000002'];
const D = (n: number) => `d0d0d0d0-0000-4000-8000-00000000000${n}`;
const S = (n: number) => `50505050-0000-4000-8000-00000000000${n}`;

const asset: AssetProfile = {
  assetName: 'AMB-101', company: 'Ambrosia Test Bio', mechanism: 'KRAS G12C inhibitor', target: 'KRAS',
  modality: 'smallMolecule', phase: 'phase2', indication: 'lung_nsclc', indicationLabel: 'Lung Cancer (NSCLC)',
  therapeuticArea: 'oncology', territory: 'global', targetDealType: 'license',
};

function compRow(id: string): CompRow {
  return {
    id, licensor: 'L', licensee: 'B', asset: null, announcedDate: '2025-01-01', year: 2025, phase: 'phase_2', structure: 'license',
    modality: 'small molecule', indication: 'NSCLC', territory: 'global', upfrontM: 50, totalM: 500, milestonesM: 400,
    royaltyLowPct: 8, royaltyHighPct: 12, equityM: null, verified: true, sourceType: 'press', sourceUrl: null, relevance: 80,
    reasons: [], outlier: false, sameIndication: true,
  };
}

function makeCompSet(): CompSet {
  const rows = COMP_IDS.map(compRow);
  const stats = { n: rows.length, upfront: { p25: 45, p50: 55, p75: 70 }, total: { p25: 380, p50: 520, p75: 640 }, royaltyMid: { p25: 8, p50: 10, p75: 12 } };
  return { source: { source: 'Solidus deal database', n: rows.length, asOf: AS_OF }, rows, stats: { all: stats, exOutliers: stats }, byPhase: [], byStructure: [], headlineDriverIds: [rows[0].id] };
}

function candidate(name: string, companyId: string | null): BuyerCandidate {
  return {
    companyId, name, companyType: 'large_pharma', sizeBucket: 'large_pharma', hqRegion: 'North America', hqCountry: 'US',
    fit: 80, urgency: 70, intentScore: 70, intentTier: 'high', preferredDealType: 'license', dealsLast12mo: 4, dealsLast24mo: 7,
    lastDealDate: '2026-05-01', phasePreference: { min: 'phase_1', max: 'phase_3' }, transactsAtPhase: 'yes', totalRevenueUsd: null,
    revenueAtRisk: { y2025: null, y2026: null, y2027: null }, patentCliffs: [], hiringBd: true, acquisitionAppetite: null, priorDeals: [],
    counterpartyPremium: null, impliedUpfront: null, impliedTotal: null, whyNow: 'LOE 2028.', howToEngage: 'BD head',
  };
}

function makeBuyerMap(): BuyerMap {
  const cands = [candidate('Roche', ROCHE_ID), candidate('Merck', MERCK_OLD_ID), candidate('Pfizer', null), candidate('Novartis', null)];
  return {
    source: { source: 'Solidus', n: cands.length, asOf: AS_OF },
    candidates: cands,
    excluded: [],
    process: { lead: ['Roche', 'Merck'], tension: ['Pfizer'], hold: ['Novartis'], rationale: 'Two leads with LOE pressure.' },
    mix: { large: 4, mid: 0, unknown: 0, regions: ['north_america'] },
  };
}

const ev = (over: Partial<CatalystEvent>): CatalystEvent => ({
  date: '2027-01-01', kind: 'readout', title: 'Readout', sponsor: 'Sponsor', phase: 'phase_3', nctId: null,
  impact: 'Sets the bar for KRAS G12C in second line.', direction: 'mixed', isBuyerCandidate: false, ...over,
});

const EVENTS: CatalystEvent[] = [
  ev({ nctId: 'NCT00000100', title: 'Roche KRAS readout', sponsor: 'Roche', date: '2026-10-01', direction: 'up', isBuyerCandidate: true }),  // 5 d → t7
  ev({ nctId: 'NCT00000200', title: 'Amgen Phase 3 topline', sponsor: 'Amgen', date: '2026-10' }),                                          // month precision → Oct 15 → t30
  ev({ nctId: 'NCT00000300', title: 'Mirati confirmatory', sponsor: 'Mirati', date: '2026-09-20', direction: 'down' }),                     // 6 d past → passed
  ev({ nctId: null, kind: 'loe', title: 'Sotorasib composition-of-matter LOE', sponsor: 'Amgen', date: '2027-06' }),                          // far out → nothing
  ev({ nctId: 'NCT00000400', title: 'Lilly interim', sponsor: 'Lilly', date: '2026-09-24' }),                                                // 2 d past → only if observed
  ev({ nctId: 'NCT00000500', title: 'Old readout', sponsor: 'X', date: '2026-08-15' }),                                                       // before delivery → never
];

function makeBrief(over: Partial<BriefIntelligence> = {}): BriefIntelligence {
  return {
    asOf: AS_OF,
    asset,
    compSet: makeCompSet(),
    buyerMap: makeBuyerMap(),
    landscape: {
      pipeline: null,
      catalysts: { source: { source: 'ClinicalTrials.gov via Solidus', n: EVENTS.length, asOf: AS_OF }, windowMonths: 24, events: EVENTS, recommendedWindow: { start: '2026-10', end: '2027-03', rationale: 'Ahead of the Roche readout.' } },
      funnel: null,
    },
    bridge: {
      asOf: AS_OF, bars: [], ask: { totalM: 620, upfrontM: 45 }, floor: { totalM: 400, upfrontM: 30 }, walkAway: { upfrontM: 20 },
      askBasis: { total: 'headline', upfront: 'headline' }, policy: '', rnpvInformative: true, rnpvNote: null, reconciliation: '',
    },
    ...over,
  };
}

const request = (over: Partial<BriefAlertRequestRow> = {}): BriefAlertRequestRow => ({
  id: R1, name: 'Dana Lee', email: 'cfo@example.com', asset_name: 'AMB-101', indication: 'NSCLC', phase: 'Phase 2',
  brief_token: 'tok1234567890abcd', delivered_at: DELIVERED_AT, status: 'delivered', alerts_opt_out_at: null, brief_json: makeBrief(), ...over,
});

const deal = (over: Partial<BriefAlertDealRow> & { id: string }): BriefAlertDealRow => ({
  licensor_name: 'Some Biotech', licensor_id: null, licensee_name: null, licensee_id: null, asset_name: null, announced_date: '2026-09-20',
  phase_at_signing: 'phase_2', deal_type: 'license', indication_category: 'Oncology', indication_specific: null, therapeutic_area: 'oncology',
  modality: 'small molecule', territory: 'global', upfront_usd: 60_000_000, total_deal_value_usd: 700_000_000, royalty_low_pct: null, royalty_high_pct: null,
  created_at: '2026-09-22T10:00:00Z', target: null, mechanism_of_action: null, ...over,
});

const DEALS: BriefAlertDealRow[] = [
  deal({ id: D(1), licensee_name: 'Roche', licensee_id: ROCHE_ID, indication_specific: 'Non-small cell lung cancer', asset_name: 'RG-1' }),      // buyer_deal, lead, same indication
  deal({ id: D(2), licensee_name: 'MSD', licensee_id: MERCK_ID, indication_specific: 'Melanoma', created_at: '2026-09-23T10:00:00Z' }),          // buyer_deal via merged id
  deal({ id: D(3), licensee_name: 'Pfizer Inc.', licensee_id: null, indication_specific: 'Breast cancer' }),                                    // buyer_deal via name
  deal({ id: D(4), licensee_name: 'Amgen', indication_specific: 'Non-small cell lung cancer' }),                                                // new_comp, same indication
  deal({ id: D(5), licensee_name: 'Lilly', indication_specific: 'Colorectal cancer', target: 'KRAS G12C' }),                                     // new_comp, same mechanism
  deal({ id: D(6), licensee_name: 'AbbVie', indication_specific: 'Breast cancer' }),                                                             // same TA only → nothing
  deal({ id: COMP_IDS[0], licensee_name: 'Amgen', indication_specific: 'NSCLC' }),                                                              // already in the comp set → nothing
];

const SIGNALS: BriefAlertIntentRow[] = [
  { id: S(1), company_id: ROCHE_ID, signal_type: 'seeking_partner', polarity: 'bullish', quote: 'We are actively looking to in-license in lung.', source_url: 'https://x/1', observed_at: '2026-09-21', confidence: 80, fetched_at: '2026-09-22T00:00:00Z' },
  { id: S(2), company_id: MERCK_ID, signal_type: 'bd_hire', polarity: 'bullish', quote: 'Hiring a head of oncology BD.', source_url: 'https://x/2', observed_at: '2026-09-21', confidence: 70, fetched_at: '2026-09-22T00:00:00Z' },
  { id: S(3), company_id: ROCHE_ID, signal_type: 'restructuring', polarity: 'bearish', quote: 'Cutting early oncology.', source_url: 'https://x/3', observed_at: '2026-09-21', confidence: 90, fetched_at: '2026-09-22T00:00:00Z' },
  { id: S(4), company_id: ROCHE_ID, signal_type: 'seeking_partner', polarity: 'bullish', quote: 'Maybe.', source_url: 'https://x/4', observed_at: '2026-09-21', confidence: 40, fetched_at: '2026-09-22T00:00:00Z' },
  { id: S(5), company_id: OTHER_ID, signal_type: 'seeking_partner', polarity: 'bullish', quote: 'Not watched.', source_url: 'https://x/5', observed_at: '2026-09-21', confidence: 95, fetched_at: '2026-09-22T00:00:00Z' },
];

const COMPANIES = [
  { id: ROCHE_ID, name: 'Roche', name_variations: ['F. Hoffmann-La Roche', 'Genentech'] },
  { id: MERCK_ID, name: 'Merck & Co.', name_variations: ['MSD', 'Merck Sharp & Dohme'] },
  { id: OTHER_ID, name: 'Other Pharma', name_variations: null },
];

function inputs(over: Partial<BriefAlertInputs> = {}): BriefAlertInputs {
  return {
    requests: [request()], deals: DEALS, intentSignals: SIGNALS, trials: [], catalysts: [], companies: COMPANIES,
    mergedInto: { [MERCK_OLD_ID]: MERCK_ID }, ...over,
  };
}

const keys = (items: BriefAlertItem[]) => items.map((i) => i.dedupeKey).sort();

beforeEach(() => {
  process.env.OUTCOME_TOKEN_SECRET = 'brief-alerts-test-secret';
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  delete process.env.OUTCOME_TOKEN_SECRET;
  jest.restoreAllMocks();
});

// ─── watch set ─────────────────────────────────────────────────────────────

describe('buildBriefWatch', () => {
  it('derives asset, catalysts, window, lead/tension buyers with company ids, comp ids and the ask', () => {
    const w = buildBriefWatch(makeBrief());
    expect(w.asset).toBe(asset);
    expect(w.catalysts).toHaveLength(EVENTS.length);
    expect(w.window).toEqual({ start: '2026-10', end: '2027-03', rationale: 'Ahead of the Roche readout.' });
    expect(w.buyers).toEqual([
      { name: 'Roche', companyId: ROCHE_ID, role: 'lead' },
      { name: 'Merck', companyId: MERCK_OLD_ID, role: 'lead' },
      { name: 'Pfizer', companyId: null, role: 'tension' },
    ]);
    expect(w.compIds).toEqual(COMP_IDS);
    expect(w.ask).toEqual({ totalM: 620, upfrontM: 45 });
  });

  it('falls back to the decision counterparties and ask when there is no buyer map or bridge', () => {
    const w = buildBriefWatch(makeBrief({
      buyerMap: null, bridge: null, landscape: null, compSet: null,
      decision: {
        asOf: AS_OF, headline: '', recommendation: 'partner_now', recommendationLabel: '', rationale: [],
        counterparties: [{ name: 'Roche', role: 'lead', why: '' }, { name: 'Novartis', role: 'hold', why: '' }, { name: 'Pfizer', role: 'tension', why: '' }],
        ask: { totalM: 600, upfrontM: 40, royaltyPct: null }, floor: { totalM: 400, upfrontM: 30 }, walkAwayUpfrontM: 20,
        levers: [], wouldChangeView: [], timeline: [], confidence: 'medium', confidenceBasis: '',
      },
    }));
    expect(w.buyers).toEqual([{ name: 'Roche', companyId: null, role: 'lead' }, { name: 'Pfizer', companyId: null, role: 'tension' }]);
    expect(w.ask).toEqual({ totalM: 600, upfrontM: 40 });
    expect(w.catalysts).toEqual([]);
    expect(w.compIds).toEqual([]);
    expect(w.window).toBeNull();
  });
});

describe('catalyst dates and keys', () => {
  it('reads month precision as the 15th and full dates as given', () => {
    expect(new Date(catalystDateMs('2026-10')!).toISOString()).toBe('2026-10-15T00:00:00.000Z');
    expect(new Date(catalystDateMs('2026-10-01')!).toISOString()).toBe('2026-10-01T00:00:00.000Z');
    expect(catalystDateMs('')).toBeNull();
    expect(catalystDateMs('soon')).toBeNull();
  });
  it('keys by NCT id, else a stable hash', () => {
    expect(catalystKey(ev({ nctId: 'nct00000100' }))).toBe('NCT00000100');
    const a = catalystKey(ev({ nctId: null, kind: 'loe', title: 'LOE', date: '2027-06' }));
    expect(a).toMatch(/^[0-9a-f]{10}$/);
    expect(catalystKey(ev({ nctId: null, kind: 'loe', title: 'LOE', date: '2027-06' }))).toBe(a);
    expect(catalystKey(ev({ nctId: null, kind: 'loe', title: 'LOE', date: '2027-07' }))).not.toBe(a);
  });
});

// ─── selection ─────────────────────────────────────────────────────────────

describe('selectBriefAlerts', () => {
  it('fires each kind with stable dedupe keys', () => {
    const s = selectBriefAlerts(inputs(), NOW);
    expect(s.watched).toBe(1);
    expect(keys(s.items)).toEqual([
      `buyer_deal:${R1}:${D(1)}`,
      `buyer_deal:${R1}:${D(2)}`,
      `buyer_deal:${R1}:${D(3)}`,
      `buyer_intent:${R1}:${S(1)}`,
      `buyer_intent:${R1}:${S(2)}`,
      `catalyst:${R1}:NCT00000100:t7`,
      `catalyst:${R1}:NCT00000200:t30`,
      `catalyst:${R1}:NCT00000300:passed`,
      `new_comp:${R1}:${D(4)}`,
      `new_comp:${R1}:${D(5)}`,
    ].sort());
    const byKey = new Map(s.items.map((i) => [i.dedupeKey, i]));
    expect(byKey.get(`catalyst:${R1}:NCT00000100:t7`)).toMatchObject({ kind: 'catalyst_approaching', subjectKey: 'NCT00000100', email: 'cfo@example.com', token: 'tok1234567890abcd', payload: { stage: 't7', daysUntil: 5, isBuyerCandidate: true } });
    expect(byKey.get(`catalyst:${R1}:NCT00000200:t30`)!.payload).toMatchObject({ stage: 't30', date: '2026-10-15', datePrecision: 'month', briefDate: '2026-10', dateMoved: false });
    expect(byKey.get(`catalyst:${R1}:NCT00000100:t7`)!.payload).toMatchObject({ datePrecision: 'day' });
    expect(byKey.get(`catalyst:${R1}:NCT00000300:passed`)).toMatchObject({ kind: 'catalyst_passed', payload: { stage: 'passed', observedDate: null, daysSince: 6 } });
    expect(byKey.get(`buyer_deal:${R1}:${D(1)}`)).toMatchObject({ kind: 'buyer_deal', subjectKey: D(1), payload: { buyer: 'Roche', role: 'lead', sameIndication: true, upfrontM: 60, totalM: 700 } });
    expect(byKey.get(`buyer_deal:${R1}:${D(2)}`)!.payload).toMatchObject({ buyer: 'Merck', role: 'lead', licensee: 'MSD' });
    expect(byKey.get(`buyer_deal:${R1}:${D(3)}`)!.payload).toMatchObject({ buyer: 'Pfizer', role: 'tension' });
    expect(byKey.get(`buyer_intent:${R1}:${S(1)}`)).toMatchObject({ kind: 'buyer_intent', subjectKey: S(1), payload: { buyer: 'Roche', signalType: 'seeking_partner', confidence: 80 } });
    expect(byKey.get(`buyer_intent:${R1}:${S(2)}`)!.payload).toMatchObject({ buyer: 'Merck' });
    expect(byKey.get(`new_comp:${R1}:${D(4)}`)!.payload).toMatchObject({ sameIndication: true, sameMechanism: false, licensee: 'Amgen' });
    expect(byKey.get(`new_comp:${R1}:${D(5)}`)!.payload).toMatchObject({ sameIndication: false, sameMechanism: true, licensee: 'Lilly' });
  });

  it('a lead-buyer deal in the indication is reported once (buyer_deal), not also as a new comp', () => {
    const s = selectBriefAlerts(inputs(), NOW);
    expect(s.items.filter((i) => i.subjectKey === D(1)).map((i) => i.kind)).toEqual(['buyer_deal']);
  });

  it('ignores same-TA-only deals, deals already in the comp set, bearish / low-confidence / unwatched signals', () => {
    const s = selectBriefAlerts(inputs(), NOW);
    const subjects = new Set(s.items.map((i) => i.subjectKey));
    expect(subjects.has(D(6))).toBe(false);
    expect(subjects.has(COMP_IDS[0])).toBe(false);
    expect(subjects.has(S(3))).toBe(false);
    expect(subjects.has(S(4))).toBe(false);
    expect(subjects.has(S(5))).toBe(false);
  });

  it('matches a merged buyer id only through the merge map', () => {
    const noMerge = selectBriefAlerts(inputs({ mergedInto: {} }), NOW);
    expect(keys(noMerge.items)).not.toContain(`buyer_deal:${R1}:${D(2)}`);
    expect(keys(noMerge.items)).not.toContain(`buyer_intent:${R1}:${S(2)}`);
    // a deal on the old id still hits when the map folds it into the canonical id
    const oldIdDeal = deal({ id: D(7), licensee_name: 'Unknown Co', licensee_id: MERCK_OLD_ID });
    const viaOld = selectBriefAlerts(inputs({ deals: [oldIdDeal] }), NOW);
    expect(keys(viaOld.items)).toContain(`buyer_deal:${R1}:${D(7)}`);
  });

  it('catalyst rules: no alert inside the 3-day grace unless observed; a live trial date overrides the brief date; nothing before delivery', () => {
    const base = selectBriefAlerts(inputs(), NOW);
    expect(keys(base.items).some((k) => k.includes('NCT00000400'))).toBe(false);
    expect(keys(base.items).some((k) => k.includes('NCT00000500'))).toBe(false);

    const observed = selectBriefAlerts(inputs({ catalysts: [{ nct_id: 'NCT00000400', catalyst_type: 'readout_announced', expected_date: '2026-09-24', observed_date: '2026-09-25', source_url: 'https://x/pr' }] }), NOW);
    const passed = observed.items.find((i) => i.dedupeKey === `catalyst:${R1}:NCT00000400:passed`)!;
    expect(passed.payload).toMatchObject({ observedDate: '2026-09-25', observedType: 'readout_announced', observedSourceUrl: 'https://x/pr' });

    // the registry moved the Oct 1 readout to next spring: no t7, and the payload says the date moved
    const moved = selectBriefAlerts(inputs({ trials: [{ nct_id: 'NCT00000100', primary_completion_date: '2027-04-01', status: 'recruiting' }] }), NOW);
    expect(keys(moved.items).some((k) => k.includes('NCT00000100'))).toBe(false);
    const nearer = selectBriefAlerts(inputs({ trials: [{ nct_id: 'NCT00000200', primary_completion_date: '2026-09-30', status: 'active_not_recruiting' }] }), NOW);
    const t7 = nearer.items.find((i) => i.dedupeKey === `catalyst:${R1}:NCT00000200:t7`)!;
    expect(t7.payload).toMatchObject({ date: '2026-09-30', datePrecision: 'day', briefDate: '2026-10', dateMoved: true });
  });

  it('a catalyst with no NCT id and a month-precision date is keyed by hash and treated as the 15th', () => {
    const loe = ev({ nctId: null, kind: 'loe', title: 'Key LOE', date: '2026-10' });
    const brief = makeBrief({ landscape: { pipeline: null, funnel: null, catalysts: { source: { source: 'x', n: 1, asOf: AS_OF }, windowMonths: 24, events: [loe], recommendedWindow: null } } });
    const s = selectBriefAlerts(inputs({ requests: [request({ brief_json: brief })], deals: [], intentSignals: [] }), NOW);
    expect(s.items).toHaveLength(1);
    expect(s.items[0].dedupeKey).toBe(`catalyst:${R1}:${catalystKey(loe)}:t30`);
    expect(s.items[0].payload).toMatchObject({ date: '2026-10-15', daysUntil: 19 });
  });

  it('skips opted-out, undelivered, email-less and brief-less requests', () => {
    const s = selectBriefAlerts(inputs({
      requests: [
        request({ alerts_opt_out_at: '2026-09-10T00:00:00Z' }),
        request({ id: R2, status: 'generating' }),
        request({ id: R2, email: '  ' }),
        request({ id: R2, brief_json: null }),
      ],
    }), NOW);
    expect(s.items).toHaveLength(0);
    expect(s.watched).toBe(0);
    expect(s.skipped).toEqual({ opted_out: 1, not_delivered: 1, no_email: 1, no_brief: 1 });
  });

  it('keys items per request so two owners of similar briefs each get their own ledger rows', () => {
    const s = selectBriefAlerts(inputs({ requests: [request(), request({ id: R2, email: 'ceo@example.com' })], deals: [DEALS[0]], intentSignals: [] }), NOW);
    expect(keys(s.items)).toContain(`buyer_deal:${R1}:${D(1)}`);
    expect(keys(s.items)).toContain(`buyer_deal:${R2}:${D(1)}`);
    expect(s.items.find((i) => i.requestId === R2)!.email).toBe('ceo@example.com');
  });
});

// ─── email ─────────────────────────────────────────────────────────────────

describe('buildBriefAlertEmail', () => {
  const links = { dataRoomUrl: 'https://solidus.ambrosiaventures.co/brief/r/tok1234567890abcd', optOutUrl: 'https://solidus.ambrosiaventures.co/api/brief/alerts/opt-out?token=abc.def' };

  it('subject names the asset and the count; body has one paragraph per item, the data room and the opt-out link', () => {
    const items = selectBriefAlerts(inputs(), NOW).items;
    const e = buildBriefAlertEmail(request(), items, links);
    expect(e.subject).toBe('AMB-101 — 10 updates on your Deal Intelligence Brief');
    expect(e.html).toContain('Hi Dana,');
    expect(e.html).toContain('10 things moved on the brief for AMB-101 since we delivered it on September 1, 2026.');
    expect(e.html).toContain('<strong>Catalyst within a week: Roche KRAS readout.</strong> Roche, a buyer on your map, is expected to reach this on October 1, 2026.');
    expect(e.html).toContain('<strong>Catalyst within 30 days: Amgen Phase 3 topline.</strong> Amgen is expected to reach this in October 2026.');
    expect(e.html).toContain('<strong>Catalyst passed: Mirati confirmatory.</strong> The expected date (September 20, 2026) is behind us');
    expect(e.html).toContain('<strong>Roche signed a new deal.</strong>');
    expect(e.html).toContain('$60M upfront, $700M total');
    expect(e.html).toContain('<strong>Roche signalled partnering intent.</strong>');
    expect(e.html).toContain('&quot;We are actively looking to in-license in lung.&quot;');
    expect(e.html).toContain('<strong>New comparable: Some Biotech / Amgen.</strong>');
    expect(e.html).toContain('$45M upfront');                                   // the brief's ask, referenced from the new-comp paragraph
    expect(e.html).toContain('Recommended go-to-market window: October 2026 to March 2027.');
    expect(e.html.split(links.dataRoomUrl)).toHaveLength(3);                    // href + visible text
    expect(e.html).toContain(`<a href="${links.optOutUrl}"`);
    expect(e.html).toContain('Stop these updates');
    expect(e.html).toMatch(/Issa Kildani<br>/);
    expect(e.html).not.toMatch(/unsubscribe|trial|upgrade/i);
  });

  it('singular subject, no data room, escaped names', () => {
    const [one] = selectBriefAlerts(inputs({ deals: [DEALS[3]], intentSignals: [], requests: [request({ name: '<b>X</b>', brief_token: null, brief_json: makeBrief({ landscape: null }) })] }), NOW).items;
    const e = buildBriefAlertEmail(request({ name: '<b>X</b>', brief_token: null }), [one], { ...links, dataRoomUrl: null });
    expect(e.subject).toBe('AMB-101 — 1 update on your Deal Intelligence Brief');
    expect(e.html).toContain('Hi &lt;b&gt;X&lt;/b&gt;,');
    expect(e.html).toContain('One thing moved');
    expect(e.html).not.toContain('/brief/r/');
    expect(e.html).toContain('Stop these updates');
  });

  it('falls back to indication + phase when the brief and row carry no asset name', () => {
    const r = request({ asset_name: null, brief_json: makeBrief({ asset: { ...asset, assetName: null } }) });
    const e = buildBriefAlertEmail(r, selectBriefAlerts(inputs({ requests: [r], deals: [DEALS[3]], intentSignals: [] }), NOW).items, links);
    expect(e.subject).toMatch(/^Lung Cancer \(NSCLC\), Phase 2 — \d+ updates? on your Deal Intelligence Brief$/);
  });
});

describe('opt-out token and links', () => {
  it('signs and verifies a request token; rejects tampering and expiry', () => {
    const t = signBriefAlertToken({ requestId: R1 }, { now: NOW });
    expect(verifyBriefAlertToken(t, { now: NOW })).toEqual({ ok: true, payload: { requestId: R1, exp: expect.any(Number) } });
    expect(verifyBriefAlertToken(`${t}x`, { now: NOW })).toEqual({ ok: false, reason: 'signature' });
    expect(verifyBriefAlertToken(t, { now: new Date(NOW.getTime() + 181 * 86_400_000) })).toEqual({ ok: false, reason: 'expired' });
    expect(verifyBriefAlertToken('nope', { now: NOW })).toEqual({ ok: false, reason: 'malformed' });
    expect(verifyBriefAlertToken(t, { now: NOW, secret: 'other' })).toEqual({ ok: false, reason: 'signature' });
  });

  it('briefAlertLinks builds the data-room and a signed opt-out url', () => {
    const l = briefAlertLinks(request(), 'https://solidus.ambrosiaventures.co/', NOW);
    expect(l.dataRoomUrl).toBe('https://solidus.ambrosiaventures.co/brief/r/tok1234567890abcd');
    expect(l.optOutUrl.startsWith('https://solidus.ambrosiaventures.co/api/brief/alerts/opt-out?token=')).toBe(true);
    const token = decodeURIComponent(l.optOutUrl.split('token=')[1]);
    expect(verifyBriefAlertToken(token, { now: NOW })).toMatchObject({ ok: true, payload: { requestId: R1 } });
    expect(briefAlertLinks(request({ brief_token: null }), 'https://x', NOW).dataRoomUrl).toBeNull();
  });
});

// ─── runner with a stubbed database ────────────────────────────────────────

type Row = Record<string, unknown>;
interface Tables {
  benchmark_requests: Row[];
  deals: Row[];
  companies: Row[];
  company_intent_signals: Row[];
  company_trials: Row[];
  asset_catalysts: Row[];
  brief_alerts: Row[];
  radar_sync_cursors: Row[];
}

/**
 * Minimal PostgREST stand-in: eq / in / is filters, range slicing,
 * maybeSingle, upsert with ignoreDuplicates on the named conflict column,
 * update through the recorded filters. Everything else is a no-op.
 */
function makeStub(tables: Tables, opts: { upsertError?: string } = {}) {
  const upserts: Array<{ table: string; rows: Row[] }> = [];
  const updates: Array<{ table: string; payload: Row; filters: Array<{ op: string; args: unknown[] }> }> = [];
  let seq = 0;
  const stub = {
    from(table: keyof Tables) {
      const filters: Array<{ op: string; args: unknown[] }> = [];
      let pendingUpdate: Row | null = null;
      let pendingUpsert: { rows: Row[]; onConflict: string; ignoreDuplicates: boolean } | null = null;
      let range: [number, number] | null = null;
      let single = false;
      const chain: Record<string, unknown> = {};
      const apply = (rows: Row[]) => rows.filter((r) => filters.every((f) => {
        if (f.op === 'eq') return r[f.args[0] as string] === f.args[1];
        if (f.op === 'in') return (f.args[1] as unknown[]).includes(r[f.args[0] as string]);
        if (f.op === 'is') return (r[f.args[0] as string] ?? null) === f.args[1];
        return true;
      }));
      for (const m of ['select', 'eq', 'gte', 'lte', 'gt', 'in', 'is', 'not', 'or', 'order', 'limit']) {
        chain[m] = (...args: unknown[]) => { filters.push({ op: m, args }); return chain; };
      }
      chain.range = (from: number, to: number) => { range = [from, to]; return chain; };
      chain.maybeSingle = () => { single = true; return chain; };
      chain.update = (payload: Row) => { pendingUpdate = payload; return chain; };
      chain.upsert = (rows: Row | Row[], o: { onConflict: string; ignoreDuplicates?: boolean }) => {
        pendingUpsert = { rows: Array.isArray(rows) ? rows : [rows], onConflict: o.onConflict, ignoreDuplicates: !!o.ignoreDuplicates };
        return chain;
      };
      chain.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => {
        let out: { data: unknown; error: { message: string } | null };
        if (pendingUpsert) {
          upserts.push({ table, rows: pendingUpsert.rows });
          if (opts.upsertError && table === 'brief_alerts') {
            out = { data: null, error: { message: opts.upsertError } };
          } else {
            const created: Row[] = [];
            for (const row of pendingUpsert.rows) {
              const key = pendingUpsert.onConflict;
              const existing = tables[table].find((r) => r[key] === row[key]);
              if (existing) {
                if (!pendingUpsert.ignoreDuplicates) Object.assign(existing, row);
                continue;
              }
              const stored = { id: `led0${(++seq).toString().padStart(4, '0')}-0000-4000-8000-000000000000`, ...row };
              tables[table].push(stored);
              created.push(stored);
            }
            out = { data: created, error: null };
          }
        } else if (pendingUpdate) {
          const hit = apply(tables[table]);
          for (const r of hit) Object.assign(r, pendingUpdate);
          updates.push({ table, payload: pendingUpdate, filters });
          out = { data: hit, error: null };
        } else {
          let rows = apply(tables[table]);
          if (range) rows = rows.slice(range[0], range[1] + 1);
          out = { data: single ? rows[0] ?? null : rows, error: null };
        }
        return Promise.resolve(out).then(res, rej);
      };
      return chain;
    },
    upserts,
    updates,
  };
  return stub as unknown as SupabaseClient & { upserts: typeof upserts; updates: typeof updates };
}

function tables(over: Partial<Tables> = {}): Tables {
  return {
    benchmark_requests: [request() as unknown as Row],
    // the loader's quality filter is applied by the stub's eq, so rows carry the column it reads
    deals: DEALS.map((d) => ({ ...d, is_synthetic: false })) as unknown as Row[],
    companies: [
      { ...COMPANIES[0], merged_into: null },
      { id: MERCK_OLD_ID, name: 'Merck (old)', name_variations: null, merged_into: MERCK_ID },
      { ...COMPANIES[1], merged_into: null },
      { ...COMPANIES[2], merged_into: null },
    ],
    company_intent_signals: SIGNALS as unknown as Row[],
    company_trials: [],
    asset_catalysts: [],
    brief_alerts: [],
    radar_sync_cursors: [],
    ...over,
  };
}

describe('runBriefAlerts', () => {
  it('first run claims every item, sends one digest per request from Issa, marks rows sent and advances the cursor; second run sends nothing', async () => {
    const t = tables({ benchmark_requests: [request(), request({ id: R2, email: 'ceo@example.com', name: 'Sam' })] as unknown as Row[] });
    const db = makeStub(t);
    const send = jest.fn<ReturnType<BriefAlertSender>, Parameters<BriefAlertSender>>(async () => ({ success: true }));

    const report = await runBriefAlerts(db, { now: NOW, baseUrl: 'https://solidus.ambrosiaventures.co', send });
    expect(report.errors).toEqual([]);
    expect(report).toMatchObject({ requests: 2, watched: 2, items: 20, claimed: 20, duplicates: 0, sent: 2, failed: 0, timedOut: false, dryRun: false });
    expect(report.cursorFrom).toBe(new Date(NOW.getTime() - 7 * 86_400_000).toISOString());
    expect(report.cursorTo).toBe('2026-09-23T10:00:00Z'); // max deals.created_at / signals.fetched_at seen
    expect(send).toHaveBeenCalledTimes(2);
    const first = send.mock.calls[0][0];
    expect(first).toMatchObject({ to: 'cfo@example.com', from: FOLLOWUP_FROM, replyTo: FOLLOWUP_REPLY_TO, subject: 'AMB-101 — 10 updates on your Deal Intelligence Brief' });
    expect(first.html).toContain('/brief/r/tok1234567890abcd');
    expect(first.html).toContain('/api/brief/alerts/opt-out?token=');
    expect(send.mock.calls[1][0].to).toBe('ceo@example.com');

    // ledger: 20 rows, all sent, with the request, kind, email and payload
    expect(t.brief_alerts).toHaveLength(20);
    expect(t.brief_alerts.every((r) => r.delivery_status === 'sent' && r.sent_at === NOW.toISOString())).toBe(true);
    const claimed = db.upserts.filter((u) => u.table === 'brief_alerts');
    expect(claimed).toHaveLength(2);
    expect(claimed[0].rows[0]).toMatchObject({ request_id: R1, email: 'cfo@example.com', delivery_status: 'queued' });
    expect(claimed[0].rows.map((r) => r.dedupe_key).sort()).toEqual(keys(selectBriefAlerts(inputs(), NOW).items));
    // cursor row written once, with the max timestamp seen
    const cursor = t.radar_sync_cursors.find((r) => r.source === BRIEF_ALERTS_CURSOR_SOURCE)!;
    expect(cursor).toMatchObject({ cursor: '2026-09-23T10:00:00Z', runs: 1 });

    // second run: every dedupe key already exists → nothing sent, no new rows
    const again = await runBriefAlerts(db, { now: NOW, send });
    expect(again.errors).toEqual([]);
    expect(again).toMatchObject({ items: 20, claimed: 0, duplicates: 20, sent: 0 });
    expect(send).toHaveBeenCalledTimes(2);
    expect(t.brief_alerts).toHaveLength(20);
  });

  it('a new item on a later run is sent alone', async () => {
    const t = tables();
    const db = makeStub(t);
    const send = jest.fn(async () => ({ success: true }));
    await runBriefAlerts(db, { now: NOW, send });
    expect(send).toHaveBeenCalledTimes(1);
    t.deals.push({ ...deal({ id: D(8), licensee_name: 'Roche', licensee_id: ROCHE_ID, indication_specific: 'Melanoma', asset_name: 'NEW-1', created_at: '2026-09-25T00:00:00Z' }), is_synthetic: false } as unknown as Row);
    const r = await runBriefAlerts(db, { now: NOW, send });
    expect(r).toMatchObject({ claimed: 1, duplicates: 10, sent: 1 });
    expect(send).toHaveBeenCalledTimes(2);
    const html = (send.mock.calls[1] as unknown as [{ subject: string; html: string }])[0];
    expect(html.subject).toBe('AMB-101 — 1 update on your Deal Intelligence Brief');
    expect(html.html).toContain('NEW-1');
    expect(html.html).not.toContain('Mirati confirmatory');
  });

  it('a failed send marks the rows failed, reports the error and does not advance the cursor', async () => {
    const t = tables();
    const db = makeStub(t);
    const send = jest.fn(async () => ({ success: false, error: 'sendgrid down' }));
    const r = await runBriefAlerts(db, { now: NOW, send });
    expect(r).toMatchObject({ claimed: 10, sent: 0, failed: 1 });
    expect(r.errors).toEqual([`send request ${R1}: sendgrid down`]);
    expect(t.brief_alerts.every((row) => row.delivery_status === 'failed' && row.sent_at === null)).toBe(true);
    expect(t.radar_sync_cursors).toHaveLength(0);
    expect(r.cursorTo).toBe(r.cursorFrom);
  });

  it('dry run selects but sends and writes nothing', async () => {
    const t = tables();
    const db = makeStub(t);
    const send = jest.fn(async () => ({ success: true }));
    const r = await runBriefAlerts(db, { now: NOW, send, dryRun: true });
    expect(r).toMatchObject({ items: 10, claimed: 0, sent: 0, dryRun: true });
    expect(send).not.toHaveBeenCalled();
    expect(db.upserts).toHaveLength(0);
    expect(t.brief_alerts).toHaveLength(0);
  });

  it('respects maxSends and a past deadline, and never advances the cursor on a partial run', async () => {
    const t = tables({ benchmark_requests: [request(), request({ id: R2, email: 'ceo@example.com' })] as unknown as Row[] });
    const db = makeStub(t);
    const send = jest.fn(async () => ({ success: true }));
    const capped = await runBriefAlerts(db, { now: NOW, send, maxSends: 1 });
    expect(capped.sent).toBe(1);
    expect(t.radar_sync_cursors).toHaveLength(0); // the unsent request's deal-based items must still be visible next run
    expect(capped.cursorTo).toBe(capped.cursorFrom);
    const rest = await runBriefAlerts(db, { now: NOW, send, maxSends: 1 });
    expect(rest.sent).toBe(1);
    expect(t.radar_sync_cursors).toHaveLength(1); // now complete → the cursor moves
    const late = await runBriefAlerts(makeStub(tables()), { now: NOW, send, deadline: Date.now() - 1 });
    expect(late).toMatchObject({ sent: 0, timedOut: true });
  });

  it('a claim error is reported and nothing is sent for that request', async () => {
    const db = makeStub(tables(), { upsertError: 'relation "brief_alerts" does not exist' });
    const send = jest.fn(async () => ({ success: true }));
    const r = await runBriefAlerts(db, { now: NOW, send });
    expect(r.errors).toEqual([`claim request ${R1}: relation "brief_alerts" does not exist`]);
    expect(send).not.toHaveBeenCalled();
  });

  it('never throws: a failing query is reported', async () => {
    const db = { from: () => { throw new Error('connection refused'); } } as unknown as SupabaseClient;
    const r = await runBriefAlerts(db, { now: NOW, send: jest.fn(async () => ({ success: true })) });
    expect(r.errors).toEqual(['connection refused']);
    expect(r.sent).toBe(0);
  });
});
