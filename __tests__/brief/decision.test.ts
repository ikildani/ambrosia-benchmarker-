/**
 * Decision layer tests: valuation bridge, inflection path, decision summary,
 * diligence checklist, objection fallback, and the five page renderers.
 */

import { buildValuationBridge, roundSensible, WALK_AWAY_SHARE_OF_FLOOR } from '@/lib/brief/valuation-bridge';
import { buildInflectionPath, recommendedOptionKey, PHASE_STEP_UP, RAISE_BUFFER_PCT, OPTION_VALUE_HURDLE } from '@/lib/brief/inflection';
import { buildDecisionSummary } from '@/lib/brief/decision';
import { buildDiligenceChecklist } from '@/lib/brief/diligence-checklist';
import { generatePositioningObjections, buildFallbackObjections, FALLBACK_MODEL } from '@/lib/ai/objection-generator';
import { renderFootballField } from '@/lib/report/svg-charts/footballField';
import { renderDecisionTree } from '@/lib/report/svg-charts/decisionTree';
import { renderDecisionPage } from '@/lib/report/pages/decisionPage';
import { renderValuationBridgePage } from '@/lib/report/pages/valuationBridge';
import { renderInflectionPathPage } from '@/lib/report/pages/inflectionPath';
import { renderPositioningObjectionsPage } from '@/lib/report/pages/positioningObjections';
import { renderDiligenceReadinessPage } from '@/lib/report/pages/diligenceReadiness';
import type { CalculationResult, CalculationInput } from '@/lib/calculations';
import type { RNPVResult, MonteCarloResult, ScenarioResult } from '@/lib/financial/types';
import type { BuyerSpecificValuation } from '@/lib/financial/buyer-specific-valuation';
import type { PDFReportData, ReportMeta } from '@/lib/report/types';
import type { AssetProfile, BuyerMap, BuyerCandidate, CompSet, CompRow, BriefIntelligence } from '@/lib/brief/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const AS_OF = '2026-09-23';

function r3(low: number, median: number, high: number) { return { low, median, high }; }

const result = {
  terms: {
    upfront: r3(40, 60, 90),
    devMilestones: r3(100, 150, 200),
    regMilestones: r3(100, 150, 200),
    commMilestones: r3(100, 140, 200),
    totalDealValue: r3(340, 500, 690),
  },
  tieredRoyalties: { base: { low: 8, high: 12 }, midTier: { low: 10, high: 14 }, highTier: { low: 12, high: 16 } },
  dealRecommendation: { upfrontPercent: 12, milestonePercent: 88, rationale: 'x' },
  negotiationInsight: '',
  modifiers: [],
  labels: { phase: 'Phase 2', modality: 'Small Molecule', indication: 'NSCLC' },
  dealTypeLabels: {},
  drillDown: {},
  phase: 'phase2',
} as unknown as CalculationResult;

const inputs = {
  therapeuticArea: 'oncology',
  phase: 'phase2',
  modality: 'smallMolecule',
  indication: 'nsclc',
  territory: 'global',
} as unknown as CalculationInput;

const rnpv = {
  riskAdjustedNPV: 420,
  unadjustedNPV: 1500,
  cumulativePoS: 0.19,
  phaseTransitions: [
    { phase: 'Phase 2 -> Phase 3', probability: 0.32, cumulativeProb: 0.32, yearsToComplete: 2.5, costEstimate: 70 },
    { phase: 'Phase 3 -> Approval', probability: 0.58, cumulativeProb: 0.19, yearsToComplete: 3.2, costEstimate: 200 },
  ],
  cashFlows: [],
  peakSalesYear: 2034,
  yearsToMarket: 6,
  impliedDealValue: { upfront: r3(40, 60, 90), totalDeal: r3(340, 500, 690) },
} as unknown as RNPVResult;

const monteCarlo = {
  iterations: 5000,
  percentiles: { p5: 120, p10: 180, p25: 300, p50: 410, p75: 560, p90: 720, p95: 850 },
  mean: 430, stdDev: 200, histogram: [],
  confidenceInterval95: { low: 100, high: 900 },
  confidenceInterval80: { low: 180, high: 720 },
  probabilityOfPositiveNPV: 0.9,
} as unknown as MonteCarloResult;

const scenarios = [
  { scenario: { id: 'a', name: 'CRL', category: 'regulatory' }, baseRNPV: 420, adjustedRNPV: 300, impactDelta: -120, impactPercent: -28, adjustedDealValue: r3(250, 380, 520), narrative: '' },
  { scenario: { id: 'b', name: 'Fast track', category: 'regulatory' }, baseRNPV: 420, adjustedRNPV: 500, impactDelta: 80, impactPercent: 19, adjustedDealValue: r3(400, 580, 800), narrative: '' },
] as unknown as ScenarioResult[];

const buyerValuations = [
  { buyer: { companyName: 'Roche' }, buyerSpecificDealValue: r3(450, 620, 800), buyerUpfront: r3(50, 75, 100) },
  { buyer: { companyName: 'Merck' }, buyerSpecificDealValue: r3(400, 560, 760), buyerUpfront: r3(45, 68, 95) },
] as unknown as BuyerSpecificValuation[];

function compRow(i: number, sameIndication = true): CompRow {
  return {
    id: `c${i}`, licensor: `L${i}`, licensee: `B${i}`, asset: null, announcedDate: '2025-01-01', year: 2025,
    phase: 'phase_2', structure: 'license', modality: 'small molecule', indication: 'NSCLC', territory: 'global',
    upfrontM: 50 + i, totalM: 480 + i * 10, milestonesM: 400, royaltyLowPct: 8, royaltyHighPct: 12, equityM: null,
    verified: true, sourceType: 'press', sourceUrl: null, relevance: 80, reasons: [], outlier: false, sameIndication,
  };
}

function makeCompSet(n = 14, sameIndication = true): CompSet {
  const rows = Array.from({ length: n }, (_, i) => compRow(i, sameIndication));
  const stats = { n, upfront: { p25: 45, p50: 55, p75: 70 }, total: { p25: 380, p50: 520, p75: 640 }, royaltyMid: { p25: 8, p50: 10, p75: 12 } };
  return {
    source: { source: 'Solidus deal database', n, asOf: AS_OF },
    rows,
    stats: { all: stats, exOutliers: stats },
    byPhase: [], byStructure: [], headlineDriverIds: rows.slice(0, 3).map(r => r.id),
  };
}

function candidate(name: string, urgency: number, transacts: BuyerCandidate['transactsAtPhase'] = 'yes'): BuyerCandidate {
  return {
    companyId: null, name, companyType: 'large_pharma', hqRegion: 'North America', hqCountry: 'US',
    fit: 80, urgency, intentScore: 70, intentTier: 'high', preferredDealType: 'license',
    dealsLast12mo: 4, dealsLast24mo: 7, lastDealDate: '2026-05-01', phasePreference: { min: 'phase_1', max: 'phase_3' },
    transactsAtPhase: transacts, totalRevenueUsd: null, revenueAtRisk: { y2025: null, y2026: null, y2027: null },
    patentCliffs: [], hiringBd: true, acquisitionAppetite: null, priorDeals: [], counterpartyPremium: null,
    impliedUpfront: null, impliedTotal: null, whyNow: `${name} loses exclusivity on its lead franchise in 2028.`, howToEngage: 'BD head',
  };
}

function makeBuyerMap(leadUrgency = [75, 70]): BuyerMap {
  const cands = [candidate('Roche', leadUrgency[0]), candidate('Merck', leadUrgency[1]), candidate('Pfizer', 40, 'unknown'), candidate('Novartis', 30, 'no')];
  return {
    source: { source: 'Solidus', n: cands.length, asOf: AS_OF },
    candidates: cands,
    excluded: [{ name: 'AbbVie', reason: 'does not transact at Phase 2 in this area' }],
    process: { lead: ['Roche', 'Merck'], tension: ['Pfizer'], hold: ['Novartis'], rationale: 'Two leads with LOE pressure.' },
  };
}

const asset: AssetProfile = {
  assetName: 'AMB-101', company: 'Ambrosia Test Bio', mechanism: 'KRAS G12C inhibitor', target: 'KRAS',
  modality: 'smallMolecule', phase: 'phase2', indication: 'NSCLC', therapeuticArea: 'oncology', territory: 'global',
  targetDealType: 'license', differentiationNotes: 'Brain-penetrant.', dataPackageStage: 'Phase 2a readout',
};

function meta(): ReportMeta {
  return { reportId: 'AMB-TEST-1', generatedAt: AS_OF, version: '3', pageCount: 30, currentPage: 3, tocEntries: [] };
}

function pdfData(brief: Partial<BriefIntelligence> | undefined): PDFReportData {
  return {
    result, inputs, sensitivityData: {} as never, riskScore: 50, comparableDeals: [],
    brief: brief ? { asOf: AS_OF, asset, ...brief } : undefined,
  } as unknown as PDFReportData;
}

// ---------------------------------------------------------------------------
// Valuation bridge
// ---------------------------------------------------------------------------

describe('buildValuationBridge', () => {
  it('builds every bar when every input is present, on separate bases', () => {
    const b = buildValuationBridge({ result, rnpv, monteCarlo, scenarios, buyerValuations, compSet: makeCompSet(), asOf: AS_OF });
    const keys = b.bars.map(x => x.key);
    expect(keys).toEqual(['comps_total', 'comps_upfront', 'rnpv', 'monte_carlo', 'scenarios', 'buyer_implied', 'headline']);
    expect(b.bars.find(x => x.key === 'comps_upfront')!.basis).toBe('upfront');
    expect(b.bars.filter(x => x.basis === 'upfront').map(x => x.key)).toEqual(['comps_upfront']);
    expect(b.bars.find(x => x.key === 'comps_total')!.basis).toBe('total');
    expect(b.bars.find(x => x.key === 'headline')!.basis).toBe('total');
    expect(b.bars.find(x => x.key === 'rnpv')!.basis).toBe('rnpv');
    // rNPV uses MC p10/p90 when present
    const rb = b.bars.find(x => x.key === 'rnpv')!;
    expect(rb.low).toBe(180); expect(rb.mid).toBe(420); expect(rb.high).toBe(720);
    // scenarios: min low → max high, mid = headline median
    const sb = b.bars.find(x => x.key === 'scenarios')!;
    expect(sb.low).toBe(250); expect(sb.high).toBe(800); expect(sb.mid).toBe(500);
    // buyer implied: min low, max high, median of medians
    const bb = b.bars.find(x => x.key === 'buyer_implied')!;
    expect(bb.low).toBe(400); expect(bb.high).toBe(800); expect(bb.mid).toBe(590); expect(bb.n).toBe(2);
  });

  it('ask is the headline; floor is max(headline low, comps p25); walk-away is 80% of the floor when no defensive threshold', () => {
    const b = buildValuationBridge({ result, compSet: makeCompSet(), asOf: AS_OF });
    expect(b.ask).toEqual({ totalM: 500, upfrontM: 60 });
    expect(b.floor.totalM).toBe(380);   // comps p25 380 > headline low 340
    expect(b.floor.upfrontM).toBe(45);  // comps p25 45 > headline low 40
    expect(b.walkAway.upfrontM).toBe(roundSensible(45 * WALK_AWAY_SHARE_OF_FLOOR));
  });

  it('uses the defensive walk-away when it is below the floor, and degrades without optional inputs', () => {
    const b = buildValuationBridge({ result, asOf: AS_OF, defensive: { walkAwayThreshold: 30, defensiveFloor: 50, worstCase: {} as never, bestCase: {} as never, narrative: '' } });
    expect(b.bars.map(x => x.key)).toEqual(['headline']);
    expect(b.floor).toEqual({ totalM: 340, upfrontM: 40 });
    expect(b.walkAway.upfrontM).toBe(30);
    expect(b.reconciliation).toContain('No comparable set');
  });

  it('rNPV bar falls back to ±25% without Monte Carlo and reconciliation names the spread', () => {
    const b = buildValuationBridge({ result, rnpv, compSet: makeCompSet(), asOf: AS_OF });
    const rb = b.bars.find(x => x.key === 'rnpv')!;
    expect(rb.low).toBeCloseTo(315); expect(rb.high).toBeCloseTo(525);
    expect(b.reconciliation).toMatch(/4% above the headline ask/);
    expect(b.reconciliation.split('. ').length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// Inflection path
// ---------------------------------------------------------------------------

describe('buildInflectionPath', () => {
  it('computes expected upfront, dilution and step-ups from engine transitions', () => {
    const p = buildInflectionPath({ inputs, result, rnpv, asOf: AS_OF })!;
    expect(p).not.toBeNull();
    expect(p.options.map(o => o.key)).toEqual(['deal_now', 'next_phase', 'phase_after']);
    const now = p.options[0]; const next = p.options[1]; const after = p.options[2];
    expect(now.expectedUpfrontM).toBe(60); expect(now.dilution).toBe(0);
    expect(next.label).toBe('Partner after Phase 2');
    expect(next.costM).toBe(70); expect(next.months).toBe(30); expect(next.pReach).toBe(0.32);
    expect(next.upfrontIfReached.median).toBeCloseTo(60 * PHASE_STEP_UP.phase2);
    expect(next.expectedUpfrontM).toBeCloseTo(0.32 * 60 * PHASE_STEP_UP.phase2 - 70, 1);
    const raise = 70 * (1 + RAISE_BUFFER_PCT);
    expect(next.dilution).toBeCloseTo(raise / (420 + raise));
    expect(after.label).toBe('Partner after Phase 3');
    expect(after.costM).toBe(270); expect(after.pReach).toBeCloseTo(0.32 * 0.58);
    expect(p.financing!.preMoneyM).toBe(420);
    expect(p.financing!.retainedValueIfLicenseM).toBeCloseTo(60 + 0.45 * 440, 1);
    expect(recommendedOptionKey(p.options)).toBe('deal_now');
    expect(p.recommendation).toMatch(/^Partner now/);
  });

  it('recommends the deferred option only when it clears the hurdle', () => {
    const richRnpv = { ...rnpv, phaseTransitions: [{ ...rnpv.phaseTransitions[0], probability: 0.9, costEstimate: 5 }, rnpv.phaseTransitions[1]] } as RNPVResult;
    const p = buildInflectionPath({ inputs, result, rnpv: richRnpv, asOf: AS_OF })!;
    const next = p.options[1];
    expect(next.expectedUpfrontM).toBeGreaterThan(60 * (1 + OPTION_VALUE_HURDLE));
    expect(recommendedOptionKey(p.options)).toBe('next_phase');
    expect(p.recommendation).toMatch(/^Partner after Phase 2/);

    // Just under the hurdle → deal now
    const opts = p.options.map(o => ({ ...o }));
    opts[1].expectedUpfrontM = 60 * 1.1; opts[2].expectedUpfrontM = 10;
    expect(recommendedOptionKey(opts)).toBe('deal_now');
  });

  it('falls back to calibration tables without rNPV and returns null when approved', () => {
    const p = buildInflectionPath({ inputs, result, asOf: AS_OF })!;
    expect(p.options.length).toBe(3);
    expect(p.options[1].costM).toBeGreaterThan(0);
    expect(p.financing!.basis).toMatch(/headline/);
    expect(buildInflectionPath({ inputs: { ...inputs, phase: 'approved' } as CalculationInput, result, asOf: AS_OF })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Decision summary
// ---------------------------------------------------------------------------

describe('buildDecisionSummary', () => {
  const bridge = buildValuationBridge({ result, rnpv, monteCarlo, compSet: makeCompSet(), asOf: AS_OF });

  it('maps deal_now to partner_now and copies ask/floor/walk-away from the bridge', () => {
    const infl = buildInflectionPath({ inputs, result, rnpv, asOf: AS_OF });
    const d = buildDecisionSummary({ asset, bridge, inflection: infl, buyerMap: makeBuyerMap(), compSet: makeCompSet(), result, asOf: AS_OF, catalystWindow: { start: '2026-11-01', end: '2027-03-01', rationale: 'ahead of two competitor readouts.' } });
    expect(d.recommendation).toBe('partner_now');
    expect(d.ask.totalM).toBe(bridge.ask.totalM); expect(d.ask.upfrontM).toBe(bridge.ask.upfrontM);
    expect(d.floor).toEqual(bridge.floor); expect(d.walkAwayUpfrontM).toBe(bridge.walkAway.upfrontM);
    expect(d.ask.royaltyPct).toEqual({ low: 8, median: 10, high: 12 });
    expect(d.headline).toContain('Roche');
    expect(d.rationale.length).toBeGreaterThanOrEqual(3); expect(d.rationale.length).toBeLessThanOrEqual(5);
    d.rationale.forEach(r => expect(r).toMatch(/\d/));
    expect(d.counterparties.map(c => c.role)).toEqual(['lead', 'lead', 'tension', 'hold']);
    expect(d.levers.length).toBe(3); expect(d.wouldChangeView.length).toBe(3); expect(d.timeline.length).toBe(6);
    expect(d.confidence).toBe('high');
  });

  it('maps next_phase to run_process_in_parallel with two ready leads, else partner_after_next_readout; no buyers → hold', () => {
    const richRnpv = { ...rnpv, phaseTransitions: [{ ...rnpv.phaseTransitions[0], probability: 0.9, costEstimate: 5 }, rnpv.phaseTransitions[1]] } as RNPVResult;
    const infl = buildInflectionPath({ inputs, result, rnpv: richRnpv, asOf: AS_OF });
    expect(buildDecisionSummary({ asset, bridge, inflection: infl, buyerMap: makeBuyerMap([75, 70]), result, asOf: AS_OF }).recommendation).toBe('run_process_in_parallel');
    expect(buildDecisionSummary({ asset, bridge, inflection: infl, buyerMap: makeBuyerMap([75, 40]), result, asOf: AS_OF }).recommendation).toBe('partner_after_next_readout');
    const empty: BuyerMap = { ...makeBuyerMap(), candidates: [], process: { lead: [], tension: [], hold: [], rationale: '' } };
    expect(buildDecisionSummary({ asset, bridge, inflection: infl, buyerMap: empty, result, asOf: AS_OF }).recommendation).toBe('hold');
    expect(buildDecisionSummary({ asset, bridge, inflection: infl, result, asOf: AS_OF }).recommendation).toBe('hold');
  });

  it('confidence follows same-indication comp count and is capped by the memo', () => {
    const d1 = buildDecisionSummary({ asset, bridge, compSet: makeCompSet(8), buyerMap: makeBuyerMap(), result, asOf: AS_OF });
    expect(d1.confidence).toBe('medium');
    const d2 = buildDecisionSummary({ asset, bridge, compSet: makeCompSet(8, false), buyerMap: makeBuyerMap(), result, asOf: AS_OF });
    expect(d2.confidence).toBe('low');
    const d3 = buildDecisionSummary({ asset, bridge, compSet: makeCompSet(14), buyerMap: makeBuyerMap(), result, asOf: AS_OF, memo: { confidence_level: 'low' } as never });
    expect(d3.confidence).toBe('low'); expect(d3.confidenceBasis).toContain('strategic analysis confidence low');
  });
});

// ---------------------------------------------------------------------------
// Diligence checklist
// ---------------------------------------------------------------------------

describe('buildDiligenceChecklist', () => {
  it('selects by phase and modality family, flags expected items, derives gaps', () => {
    const c = buildDiligenceChecklist(asset, { ready: ['batch records'], gaps: ['freedom-to-operate'] });
    expect(c.phase).toBe('phase_2'); expect(c.modality).toBe('small_molecule');
    const areas = Array.from(new Set(c.items.map(i => i.area)));
    expect(areas.length).toBe(7);
    areas.forEach(a => {
      const n = c.items.filter(i => i.area === a).length;
      expect(n).toBeGreaterThanOrEqual(4); expect(n).toBeLessThanOrEqual(7);
    });
    expect(c.items.some(i => /Route of synthesis/.test(i.item))).toBe(true);
    expect(c.items.some(i => /Cell line history/.test(i.item))).toBe(false);
    expect(c.items.find(i => /Batch records/.test(i.item))!.status).toBe('ready');
    const fto = c.items.find(i => /Freedom-to-operate/.test(i.item))!;
    expect(fto.status).toBe('gap'); expect(fto.expectedAtPhase).toBe(true);
    expect(c.gaps).toEqual([fto.item]);
    expect(c.items.find(i => /Phase 3 protocol/.test(i.item))!.expectedAtPhase).toBe(false);
  });

  it('without explicit gaps, proposes up to 5 "Confirm …" items from the expected unknowns; cell therapy picks the cell/gene items', () => {
    const c = buildDiligenceChecklist({ ...asset, phase: 'preclinical', modality: 'cellTherapy' });
    expect(c.modality).toBe('cell_gene');
    expect(c.items.some(i => /Vector or cell manufacturing/.test(i.item))).toBe(true);
    expect(c.gaps.length).toBe(5);
    c.gaps.forEach(g => expect(g).toMatch(/^Confirm /));
  });
});

// ---------------------------------------------------------------------------
// Objection generator fallback
// ---------------------------------------------------------------------------

describe('generatePositioningObjections', () => {
  const bridge = buildValuationBridge({ result, rnpv, compSet: makeCompSet(), asOf: AS_OF });
  const decision = buildDecisionSummary({ asset, bridge, buyerMap: makeBuyerMap(), compSet: makeCompSet(), result, asOf: AS_OF });

  it('returns the deterministic fallback when the API fails twice', async () => {
    const original = global.fetch;
    const fetchMock = jest.fn().mockRejectedValue(new Error('network down'));
    global.fetch = fetchMock as unknown as typeof fetch;
    process.env.ANTHROPIC_API_KEY = 'test-key';
    try {
      const out = await generatePositioningObjections({ asset, decision, compSummary: '14 comps, median $520M', buyerSummary: 'Roche lead' });
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(out.model).toBe(FALLBACK_MODEL);
      expect(out.positioning.length).toBe(2);
      expect(out.objections.length).toBe(5);
      out.objections.forEach(o => { expect(o.objection.length).toBeGreaterThan(10); expect(o.answer.length).toBeGreaterThan(10); expect(o.evidenceToPrepare.length).toBeGreaterThan(10); });
      expect(out.positioning[1]).toContain('$500M');
      expect(JSON.stringify(out)).not.toMatch(/\bAI\b|illustrative|sample|leverage|synerg/i);
    } finally {
      global.fetch = original;
      delete process.env.ANTHROPIC_API_KEY;
    }
  });

  it('fallback is built without the network', () => {
    const fb = buildFallbackObjections({ asset, decision, compSummary: '', buyerSummary: '' });
    expect(fb.objections.map(o => o.objection)).toEqual(expect.arrayContaining([expect.stringMatching(/Why now/)]));
  });
});

// ---------------------------------------------------------------------------
// Charts
// ---------------------------------------------------------------------------

describe('charts', () => {
  it('football field draws one row per bar, the ask line, and stays within width', () => {
    const b = buildValuationBridge({ result, rnpv, monteCarlo, compSet: makeCompSet(), asOf: AS_OF });
    const svg = renderFootballField(b.bars.filter(x => x.basis !== 'upfront'), b.ask.totalM, 560, { title: 'Total' });
    expect(svg).toContain('<svg'); expect(svg).toContain('width="560"');
    expect(svg).toContain('>Ask<');
    expect((svg.match(/<rect /g) || []).length).toBeGreaterThanOrEqual(4);
    expect(svg).toContain('n=14');
    expect(renderFootballField([], 10)).toContain('No valuation bars');
  });

  it('decision tree draws three leaves and marks the recommended branch', () => {
    const p = buildInflectionPath({ inputs, result, rnpv, asOf: AS_OF })!;
    const svg = renderDecisionTree(p, 560, 230);
    expect(svg).toContain('Today');
    expect((svg.match(/RECOMMENDED/g) || []).length).toBe(3); // one tspan per leaf, text only on the recommended one
    expect(svg).toContain('Partner after Phase 2');
  });
});

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

describe('pages', () => {
  const compSet = makeCompSet();
  const bridge = buildValuationBridge({ result, rnpv, monteCarlo, scenarios, buyerValuations, compSet, asOf: AS_OF });
  const inflection = buildInflectionPath({ inputs, result, rnpv, asOf: AS_OF });
  const decision = buildDecisionSummary({ asset, bridge, inflection, buyerMap: makeBuyerMap(), compSet, result, asOf: AS_OF });
  const diligence = buildDiligenceChecklist(asset, { gaps: ['stability data'] });
  const positioning = buildFallbackObjections({ asset, decision, compSummary: '', buyerSummary: '' });

  it('decision page renders the recommendation, the ask, and the pending review note', () => {
    const html = renderDecisionPage(pdfData({ decision }), meta());
    expect(html).toContain('report-page');
    expect(html).toContain('The decision');
    expect(html).toContain('Deal Intelligence Brief');
    expect(html).toContain('Partner now');
    expect(html).toContain('$500M');
    expect(html).toContain('Managing Partner review pending');
    expect(html).not.toMatch(/\bAI\b|illustrative|sample/);
  });

  it('decision page prints the opinion when present, and the empty state without a decision', () => {
    const html = renderDecisionPage(pdfData({ decision, mpOpinion: { text: 'I would take this to Roche first.', reviewer: 'Issa Kildani, Managing Partner', reviewedAt: AS_OF } }), meta());
    expect(html).toContain('I would take this to Roche first.');
    expect(html).toContain('Issa Kildani, Managing Partner');
    expect(html).not.toContain('review pending');
    const empty = renderDecisionPage(pdfData({}), meta());
    expect(empty).toContain('Decision not yet built');
  });

  it('valuation bridge page renders two football fields, the source line, and an empty state', () => {
    const html = renderValuationBridgePage(pdfData({ bridge }), meta());
    expect(html).toContain('Valuation bridge');
    expect((html.match(/<svg /g) || []).length).toBe(2);
    expect(html).toContain('Source:');
    expect(html).toContain('Reconciliation');
    expect(renderValuationBridgePage(pdfData({}), meta())).toContain('Valuation bridge not available');
  });

  it('inflection page renders the tree, the table, the financing card, and an empty state', () => {
    const html = renderInflectionPathPage(pdfData({ inflection }), meta());
    expect(html).toContain('Path to next inflection');
    expect(html).toContain('<svg');
    expect(html).toContain('Financing alternative');
    expect(html).toContain('Source:');
    expect(renderInflectionPathPage(pdfData({ inflection: null }), meta())).toContain('Inflection path not available');
  });

  it('positioning page labels the block Strategic analysis and never prints the model', () => {
    const html = renderPositioningObjectionsPage(pdfData({ positioning: { ...positioning, model: 'claude-opus-4-6' } }), meta());
    expect(html).toContain('Positioning and objections');
    expect(html).toContain('Strategic analysis');
    expect(html).not.toContain('claude');
    expect(html).not.toMatch(/\bAI\b/);
    expect((html.match(/<tr>/g) || []).length).toBe(6);
    expect(renderPositioningObjectionsPage(pdfData({}), meta())).toContain('Positioning not yet written');
  });

  it('diligence page renders status chips, the gap callout, and an empty state', () => {
    const html = renderDiligenceReadinessPage(pdfData({ diligence }), meta());
    expect(html).toContain('Diligence readiness');
    expect(html).toContain('Close before outreach');
    expect(html).toContain('Gap');
    expect(html).toContain('Stability data');
    expect(renderDiligenceReadinessPage(pdfData({}), meta())).toContain('Checklist not available');
  });
});
