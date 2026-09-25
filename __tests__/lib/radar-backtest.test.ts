/**
 * Unit tests for the scoring v3 backtest harness: labels, feature as_of
 * cutoffs, the logistic model, calibration, metrics, and the pure training
 * pipeline. No Supabase.
 */

import {
  buildLabelEvents, labelSnapshot, monthlySnapshotDates, addMonths, keepNegativeAsset, licensorMatches,
  type LabelAsset, type LabelDeal,
} from '@/lib/radar/backtest/labels';
import {
  buildFeatureVector, emptyFeatureBundle, FEATURE_NAMES, FEATURE_SPECS, SIGN_CONSTRAINTS, vectorToRow, phaseAtAsOf,
  type FeatureAsset, type FeatureBundle,
} from '@/lib/radar/backtest/features';
import {
  trainLogistic, scoreFromFeatures, buildModelParams, fitPlatt, fitIsotonic, applyCalibration, sigmoid, predictBatch, logitBatch,
  type ModelParams,
} from '@/lib/radar/backtest/model';
import {
  rocAuc, prAuc, precisionAtK, liftTopDecile, brier, calibrationBins, computeMetrics, factorImportance, toBacktestSummary,
} from '@/lib/radar/backtest/metrics';
import { trainAndEvaluate, type LoadedSnapshot, rebuildDecision } from '@/lib/radar/backtest/run';

// ── Fixtures ─────────────────────────────────────────────────────────────

const ASSET: LabelAsset = {
  id: 'a1', company_id: 'c1', company_name: 'Acme Therapeutics, Inc.', company_name_variations: ['Acme Tx'],
  asset_name: 'ACM-101', asset_aliases: ['acmezumab'],
};
const OTHER_ASSET: LabelAsset = { id: 'a2', company_id: 'c2', company_name: 'Rival Bio', asset_name: 'RV-9' };

function deal(over: Partial<LabelDeal> = {}): LabelDeal {
  return {
    id: 'd1', licensor_id: 'c1', licensor_name: 'Acme Therapeutics', asset_name: 'ACM-101', deal_type: 'license',
    announced_date: '2023-06-15', verification_status: 'verified', is_synthetic: false, is_canonical: true, ...over,
  };
}

function featureAsset(over: Partial<FeatureAsset> = {}): FeatureAsset {
  return {
    id: 'a1', company_id: 'c1', company_name: 'Acme Therapeutics', asset_name: 'ACM-101', phase: 'phase_3',
    therapeutic_area: 'oncology', indication_category: 'solid_tumor', modality: 'antibody', partnership_status: 'unpartnered',
    territory_rights_available: ['global'], nct_ids: ['NCT001', 'NCT002'], first_posted_date: '2020-01-10',
    regulatory_designations: ['fast_track'], originator_region: 'europe', owner_type: 'industry', ...over,
  };
}

function bundle(over: Partial<FeatureBundle> = {}): FeatureBundle {
  const b = emptyFeatureBundle(featureAsset());
  b.companyTrials = [
    { nct_id: 'NCT001', company_id: 'c1', company_name: 'Acme Therapeutics', phase: 'phase_1', status: 'completed', first_posted_date: '2020-01-10', primary_completion_date: '2021-06-01' },
    { nct_id: 'NCT002', company_id: 'c1', company_name: 'Acme Therapeutics', phase: 'phase_2', status: 'recruiting', first_posted_date: '2022-03-01', primary_completion_date: '2023-09-01' },
    { nct_id: 'NCT003', company_id: 'c1', company_name: 'Acme Therapeutics', phase: 'phase_3', status: 'recruiting', first_posted_date: '2024-02-01', primary_completion_date: '2026-01-01' },
  ];
  b.asset.nct_ids = ['NCT001', 'NCT002', 'NCT003'];
  return Object.assign(b, over);
}

// ── Labels ───────────────────────────────────────────────────────────────

describe('labels — positive / negative construction', () => {
  test('a canonical license by the owning company on the asset is a label event', () => {
    const events = buildLabelEvents([ASSET, OTHER_ASSET], [deal()]);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ asset_id: 'a1', deal_id: 'd1', match_kind: 'exact', licensor_match: 'id' });
  });

  test('licensor resolves by suffix-insensitive name and by name_variations when licensor_id is missing', () => {
    expect(licensorMatches(ASSET, { licensor_id: null, licensor_name: 'Acme Therapeutics Inc' })).toBe('name');
    expect(licensorMatches(ASSET, { licensor_id: null, licensor_name: 'Acme Tx' })).toBe('name');
    expect(licensorMatches(ASSET, { licensor_id: null, licensor_name: 'Acme Foods' })).toBeNull();
    const events = buildLabelEvents([ASSET], [deal({ licensor_id: null, licensor_name: 'Acme Tx', asset_name: 'acmezumab (ACM-101)' })]);
    expect(events).toHaveLength(1);
    expect(events[0].licensor_match).toBe('name');
  });

  test('another company licensing a similarly named asset is not a label', () => {
    expect(buildLabelEvents([ASSET], [deal({ licensor_id: 'c9', licensor_name: 'Zeta Pharma' })])).toHaveLength(0);
  });

  test('deal type, rejection, synthetic and non-canonical flags exclude a deal', () => {
    expect(buildLabelEvents([ASSET], [deal({ deal_type: 'collaboration' })])).toHaveLength(0);
    expect(buildLabelEvents([ASSET], [deal({ verification_status: 'rejected' })])).toHaveLength(0);
    expect(buildLabelEvents([ASSET], [deal({ is_synthetic: true })])).toHaveLength(0);
    expect(buildLabelEvents([ASSET], [deal({ is_canonical: false })])).toHaveLength(0);
    expect(buildLabelEvents([ASSET], [deal({ deal_type: 'acquisition' })])).toHaveLength(1);
  });

  test('asset name must match: a different code by the same company is not a label', () => {
    expect(buildLabelEvents([ASSET], [deal({ asset_name: 'ACM-202' })])).toHaveLength(0);
  });

  test('labelSnapshot: window is (as_of, as_of + 12 months]', () => {
    const events = buildLabelEvents([ASSET], [deal({ announced_date: '2023-06-15' })]);
    const horizon = '2026-09-01';
    expect(labelSnapshot(events, '2022-06-01', horizon)).toMatchObject({ label: 0, unpartnered_at_asof: true });
    expect(labelSnapshot(events, '2022-07-01', horizon)).toMatchObject({ label: 1, deal_id: 'd1', unpartnered_at_asof: true });
    expect(labelSnapshot(events, '2023-06-01', horizon)).toMatchObject({ label: 1 });
    // deal on/before as_of → asset was already partnered; never a training row
    expect(labelSnapshot(events, '2023-06-15', horizon)).toMatchObject({ label: 0, unpartnered_at_asof: false });
    expect(labelSnapshot(events, '2024-01-01', horizon)).toMatchObject({ label: 0, unpartnered_at_asof: false });
  });

  test('labelSnapshot: windows past the label horizon are unobservable, not negative', () => {
    const lab = labelSnapshot([], '2025-09-01', '2026-03-01');
    expect(lab.observable).toBe(false);
    expect(labelSnapshot([], '2025-03-01', '2026-03-01').observable).toBe(true);
  });

  test('monthly snapshot calendar and month arithmetic', () => {
    const months = monthlySnapshotDates('2022-01', '2025-09');
    expect(months).toHaveLength(45);
    expect(months[0]).toBe('2022-01-01');
    expect(months[44]).toBe('2025-09-01');
    expect(addMonths('2024-01-31', 1)).toBe('2024-03-02'); // JS Date overflow is acceptable for first-of-month as_of values
    expect(addMonths('2024-06-01', 12)).toBe('2025-06-01');
  });

  test('negative subsampling is deterministic and roughly at the requested rate', () => {
    const ids = Array.from({ length: 5000 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`);
    const kept = ids.filter(id => keepNegativeAsset(id, 0.1));
    expect(kept.length).toBeGreaterThan(350);
    expect(kept.length).toBeLessThan(650);
    expect(ids.filter(id => keepNegativeAsset(id, 0.1))).toEqual(kept);
    expect(keepNegativeAsset(ids[0], 1)).toBe(true);
    expect(keepNegativeAsset(ids[0], 0)).toBe(false);
  });
});

// ── Features ─────────────────────────────────────────────────────────────

describe('features — as_of cutoffs (leakage controls)', () => {
  test('the spec is consistent and versioned', () => {
    expect(FEATURE_NAMES.length).toBe(FEATURE_SPECS.length);
    expect(SIGN_CONSTRAINTS.length).toBe(FEATURE_NAMES.length);
    expect(new Set(FEATURE_NAMES).size).toBe(FEATURE_NAMES.length);
    for (const s of FEATURE_SPECS) {
      expect(s.sources.length).toBeGreaterThan(0);
      expect(s.description.length).toBeGreaterThan(20);
    }
  });

  test('phase at as_of is reconstructed from trials posted by then, never from today\'s phase', () => {
    const b = bundle();
    expect(phaseAtAsOf(b.companyTrials, new Date('2021-01-01'))).toBe('phase_1');
    expect(phaseAtAsOf(b.companyTrials, new Date('2022-06-01'))).toBe('phase_2');
    expect(phaseAtAsOf(b.companyTrials, new Date('2024-06-01'))).toBe('phase_3');
    expect(phaseAtAsOf(b.companyTrials, new Date('2019-06-01'))).toBeNull();
    const v = buildFeatureVector(b, new Date('2022-06-01T00:00:00Z'));
    expect(v.phase_at_asof).toBe('phase_2');
    expect(v.values.phase_prior).toBe(1);
    expect(v.values.trial_count_at_asof).toBe(2);
  });

  test('an asset with no trial posted by as_of is ineligible', () => {
    const b = bundle();
    b.asset.first_posted_date = '2020-01-10';
    expect(buildFeatureVector(b, new Date('2019-12-01T00:00:00Z')).eligible).toBe(false);
    expect(buildFeatureVector(b, new Date('2020-02-01T00:00:00Z')).eligible).toBe(true);
  });

  test('financials: a period filed after as_of is invisible even if the period ended before it', () => {
    const b = bundle({
      financials: [
        { fiscal_period_end: '2023-12-31', filed_at: '2024-03-15', runway_months: 6, going_concern: true, atm_or_shelf_filed: true, source_url: 'https://sec/10k' },
        { fiscal_period_end: '2023-09-30', filed_at: '2023-11-10', runway_months: 20, going_concern: false, atm_or_shelf_filed: false, source_url: 'https://sec/10q' },
      ],
    });
    const before = buildFeatureVector(b, new Date('2024-02-01T00:00:00Z'));
    // Sep-30 filing is the latest visible; runway aged forward by ~4 months
    expect(before.values.runway_months).toBeLessThan(20);
    expect(before.values.runway_months).toBeGreaterThan(14);
    expect(before.values.runway_under_12).toBe(0);
    expect(before.values.atm_or_shelf_filed).toBe(0);
    expect(before.evidence.runway_months?.[0].source_url).toBe('https://sec/10q');

    const after = buildFeatureVector(b, new Date('2024-04-01T00:00:00Z'));
    expect(after.values.runway_under_12).toBe(1);
    expect(after.values.atm_or_shelf_filed).toBe(1);
    expect(after.evidence.runway_months?.[0].source_url).toBe('https://sec/10k');
  });

  test('going concern prefers the verbatim intent signal over the financials proxy', () => {
    const b = bundle({
      financials: [{ fiscal_period_end: '2023-12-31', filed_at: '2024-03-15', going_concern: true, runway_months: 10 }],
      intentSignals: [],
    });
    // Intent table readable, no signal → proxy is overridden to 0
    expect(buildFeatureVector(b, new Date('2024-06-01T00:00:00Z')).values.going_concern).toBe(0);
    b.intentSignals = [{ signal_type: 'going_concern_language', polarity: 'bullish', quote: 'substantial doubt about our ability to continue as a going concern', source_url: 'https://sec/q', observed_at: '2024-05-10', confidence: 0.9 }];
    const v = buildFeatureVector(b, new Date('2024-06-01T00:00:00Z'));
    expect(v.values.going_concern).toBe(1);
    expect(v.evidence.going_concern?.[0].source).toBe('company_intent_signals');
    expect(v.evidence.going_concern?.[0].source_url).toBe('https://sec/q');
    // Intent table unavailable → proxy is used
    b.sourceErrors.company_intent_signals = 'relation does not exist';
    expect(buildFeatureVector(b, new Date('2024-06-01T00:00:00Z')).values.going_concern).toBe(1);
    expect(buildFeatureVector(b, new Date('2024-06-01T00:00:00Z')).values.intent_bullish).toBeNull();
  });

  test('intent signals decay with a 6-month half-life and ignore anything after as_of', () => {
    const b = bundle({
      intentSignals: [
        { signal_type: 'seeking_partner', polarity: 'bullish', observed_at: '2024-01-01', confidence: 1 },
        { signal_type: 'seeking_partner', polarity: 'bullish', observed_at: '2024-09-01', confidence: 1 }, // future
        { signal_type: 'retaining_rights', polarity: 'bearish', observed_at: '2023-12-01', confidence: 0.5 },
      ],
    });
    const v = buildFeatureVector(b, new Date('2024-07-01T00:00:00Z'));
    expect(v.values.intent_bullish).toBeCloseTo(0.5, 1); // six months old → half weight
    expect(v.values.intent_bearish).toBeGreaterThan(0.2);
    expect(v.values.intent_bearish).toBeLessThan(0.3);
    const later = buildFeatureVector(b, new Date('2024-10-01T00:00:00Z'));
    expect(later.values.intent_bullish).toBeGreaterThan(v.values.intent_bullish as number);
  });

  test('press releases: financing recency, licensing count and category hires respect as_of', () => {
    const b = bundle({
      press: [
        { id: 'p1', headline: 'Acme closes $50M financing', published_at: '2023-01-15T12:00:00Z', source_url: 'https://pr/1', categories: ['financing'] },
        { id: 'p2', headline: 'Acme appoints Chief Business Officer', published_at: '2023-11-01T12:00:00Z', source_url: 'https://pr/2', categories: ['executive_hire'] },
        { id: 'p3', headline: 'Acme enters exclusive license agreement', published_at: '2024-02-01T12:00:00Z', source_url: 'https://pr/3', categories: ['licensing'] },
        { id: 'p4', headline: 'Acme raises $80M', published_at: '2024-05-01T12:00:00Z', source_url: 'https://pr/4', categories: ['financing'] },
      ],
    });
    const v = buildFeatureVector(b, new Date('2024-03-01T00:00:00Z'));
    expect(v.values.months_since_last_raise).toBeCloseTo(13.5, 0);
    expect(v.values.press_licensing_12m).toBe(1);
    expect(v.values.bd_hire_12m).toBe(1);
    expect(v.evidence.months_since_last_raise?.[0].source_url).toBe('https://pr/1');
    const after = buildFeatureVector(b, new Date('2024-06-01T00:00:00Z'));
    expect(after.values.months_since_last_raise).toBeLessThan(2);
  });

  test('patent velocity uses filing_date <= as_of and is null with no filings', () => {
    const b = bundle({ patents: [
      { patent_id: 'US1', filing_date: '2024-01-10' }, { patent_id: 'US2', filing_date: '2024-03-10' },
      { patent_id: 'US3', filing_date: '2022-06-01' }, { patent_id: 'US4', filing_date: '2025-01-01' },
    ] });
    const v = buildFeatureVector(b, new Date('2024-06-01T00:00:00Z'));
    // recent 2 (12m), prior 1 (13-36m) → (2+1)/(0.5+1) = 2
    expect(v.values.patent_velocity).toBeCloseTo(2, 2);
    expect(buildFeatureVector(bundle(), new Date('2024-06-01T00:00:00Z')).values.patent_velocity).toBeNull();
  });

  test('competitor terminations count other sponsors in the same indication and modality within 12 months', () => {
    const b = bundle({ competitorTerminations: [
      { nct_id: 'NCT900', company_id: 'c2', company_name: 'Rival', phase: 'phase_2', status: 'terminated', modality: 'antibody', completion_date: '2024-02-01', why_stopped: 'futility' },
      { nct_id: 'NCT901', company_id: 'c3', company_name: 'Other', phase: 'phase_2', status: 'withdrawn', modality: 'small_molecule', completion_date: '2024-02-01' },
      { nct_id: 'NCT902', company_id: 'c1', company_name: 'Acme Therapeutics', phase: 'phase_2', status: 'terminated', modality: 'antibody', completion_date: '2024-02-01' },
      { nct_id: 'NCT903', company_id: 'c4', company_name: 'Late', phase: 'phase_2', status: 'terminated', modality: 'antibody', completion_date: '2024-08-01' },
    ] });
    const v = buildFeatureVector(b, new Date('2024-06-01T00:00:00Z'));
    expect(v.values.competitor_terminations_12m).toBe(1);
    expect(v.evidence.competitor_terminations_12m?.[0].text).toContain('futility');
  });

  test('catalyst proximity: nearest upcoming primary completion, readout window flag, observed_date gate', () => {
    const b = bundle({ catalysts: [
      { asset_id: 'a1', catalyst_type: 'readout_announced', expected_date: '2024-08-15', observed_date: '2024-07-01', source_url: 'https://cat/1' }, // not yet observable at 2024-06
    ] });
    const v = buildFeatureVector(b, new Date('2024-06-01T00:00:00Z'));
    // NCT003 primary completion 2026-01-01 is 19 months out → not in readout window
    expect(v.values.months_to_primary_completion).toBeCloseTo(19, 0);
    expect(v.values.readout_window).toBe(0);
    const later = buildFeatureVector(b, new Date('2024-07-15T00:00:00Z'));
    expect(later.values.months_to_primary_completion).toBeCloseTo(1, 0);
    expect(later.values.readout_window).toBe(1);
    expect(later.evidence.readout_window?.[0].source_url).toBe('https://cat/1');
  });

  test('portfolio position uses siblings that existed at as_of', () => {
    const b = bundle({ siblings: [
      { id: 'a1', phase: 'phase_3', therapeutic_area: 'oncology', first_posted_date: '2020-01-10' },
      { id: 'sib1', phase: 'phase_4', therapeutic_area: 'neurology', first_posted_date: '2018-01-01' },
      { id: 'sib2', phase: 'phase_2', therapeutic_area: 'neurology', first_posted_date: '2021-01-01' },
      { id: 'sib3', phase: 'phase_3', therapeutic_area: 'neurology', first_posted_date: '2025-01-01' }, // does not exist yet
    ] });
    const v = buildFeatureVector(b, new Date('2024-06-01T00:00:00Z'));
    expect(v.values.pipeline_rank).toBe(2);
    expect(v.values.pipeline_same_phase_n).toBe(0);
    expect(v.values.ta_matches_company_focus).toBe(0); // neurology is the modal TA among siblings
  });

  test('a failed source yields null features (not zero) and lowers completeness', () => {
    const b = bundle();
    b.sourceErrors.company_financials = 'relation "company_financials" does not exist';
    b.sourceErrors.company_patents = 'timeout';
    const v = buildFeatureVector(b, new Date('2024-06-01T00:00:00Z'));
    expect(v.values.runway_months).toBeNull();
    expect(v.values.patent_velocity).toBeNull();
    expect(v.sources_failed).toEqual(['company_financials', 'company_patents']);
    expect(v.completeness).toBeLessThan(1);
    expect(v.values.availability).toBe(1);
    expect(v.values.region_europe).toBe(1);
    expect(v.values.owner_industry).toBe(1);
    expect(vectorToRow(v)).toHaveLength(FEATURE_NAMES.length);
  });

  test('deal history counts licensor deals in the prior 36 months only', () => {
    const b = bundle({ companyDeals: [
      { id: 'x1', announced_date: '2022-01-01', deal_type: 'license' },
      { id: 'x2', announced_date: '2020-01-01', deal_type: 'license' },
      { id: 'x3', announced_date: '2024-09-01', deal_type: 'license' },
    ] });
    expect(buildFeatureVector(b, new Date('2024-06-01T00:00:00Z')).values.company_deals_36m).toBe(1);
  });
});

// ── Model ────────────────────────────────────────────────────────────────

function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Synthetic separable data: y = 1 when 2·x0 − x1 + noise > threshold. */
function synthetic(n: number, seed = 7, positiveRate = 0.05): { X: (number | null)[][]; y: number[] } {
  const rnd = mulberry32(seed);
  const X: (number | null)[][] = [];
  const zs: number[] = [];
  for (let i = 0; i < n; i++) {
    const x0 = rnd() * 4;              // "pressure" (+)
    const x1 = rnd() * 4;              // "retaining" (−)
    const x2 = rnd();                  // noise (free)
    X.push([x0, x1, x2, rnd() > 0.9 ? null : rnd() * 2]);
    zs.push(2 * x0 - 1.5 * x1 + (rnd() - 0.5));
  }
  const sorted = [...zs].sort((a, b) => b - a);
  const threshold = sorted[Math.floor(n * positiveRate)];
  const y = zs.map(z => (z > threshold ? 1 : 0));
  return { X, y };
}

const SYN_NAMES = ['pressure', 'retaining', 'noise', 'sparse'];
const SYN_SIGNS: (1 | -1 | 0)[] = [1, -1, 0, 0];

describe('model — constrained logistic regression', () => {
  test('reaches AUC > 0.9 on a separable synthetic set with a 5 % positive rate', () => {
    const { X, y } = synthetic(3000);
    const fit = trainLogistic(X, y, { l2: 0.01, classWeightPos: 'balanced', signConstraints: SYN_SIGNS });
    const params = buildModelParams({
      version: 'test', featureVersion: 'syn', featureNames: SYN_NAMES, signConstraints: SYN_SIGNS, fit,
      calibration: { type: 'none' }, samplingRate: 1, l2: 0.01,
      trainWindow: { from: 'a', to: 'b' }, testWindow: { from: 'c', to: 'd' }, nTrain: X.length, positivesTrain: y.filter(v => v === 1).length,
    });
    const { X: Xt, y: yt } = synthetic(2000, 99);
    const preds = predictBatch(Xt, params);
    expect(rocAuc(preds, yt)).toBeGreaterThan(0.9);
    expect(fit.weights[0]).toBeGreaterThan(0);
    expect(fit.weights[1]).toBeLessThan(0);
    expect(fit.classWeightPos).toBeGreaterThan(5);
  });

  test('sign constraints are enforced even when the data disagrees', () => {
    const { X, y } = synthetic(1500);
    // Force the wrong sign on "pressure": the coefficient must be clamped at 0, not negative.
    const fit = trainLogistic(X, y, { signConstraints: [-1, -1, 0, 0] });
    expect(fit.weights[0]).toBe(0);
    expect(fit.weights[1]).toBeLessThan(0);
  });

  test('contributions sum to the logit (with the intercept) and nulls are imputed at zero contribution', () => {
    const { X, y } = synthetic(800);
    const fit = trainLogistic(X, y, { signConstraints: SYN_SIGNS });
    const params: ModelParams = buildModelParams({
      version: 'test', featureVersion: 'syn', featureNames: SYN_NAMES, signConstraints: SYN_SIGNS, fit,
      calibration: { type: 'none' }, samplingRate: 0.03, l2: 0.01,
      trainWindow: { from: 'a', to: 'b' }, testWindow: { from: 'c', to: 'd' }, nTrain: 800, positivesTrain: 40,
    });
    const out = scoreFromFeatures({ pressure: 3.2, retaining: 0.4, noise: 0.5, sparse: null }, params);
    const sum = out.contributions.reduce((s, c) => s + c.contribution, 0);
    expect(sum + out.intercept).toBeCloseTo(out.logit, 10);
    expect(out.intercept).toBeCloseTo(fit.bias + Math.log(0.03), 10);
    expect(out.raw_probability).toBeCloseTo(sigmoid(out.logit), 12);
    const sparse = out.contributions.find(c => c.feature === 'sparse')!;
    expect(sparse.imputed).toBe(true);
    expect(sparse.contribution).toBe(0);
    expect(out.completeness).toBeCloseTo(0.75, 10);
    expect(out.probability).toBeGreaterThanOrEqual(0);
    expect(out.probability).toBeLessThanOrEqual(1);
  });

  test('the negative-sampling prior correction lowers probabilities by exactly ln(rate) in logit space', () => {
    const { X, y } = synthetic(600);
    const fit = trainLogistic(X, y, { signConstraints: SYN_SIGNS });
    const mk = (rate: number) => buildModelParams({
      version: 'v', featureVersion: 'syn', featureNames: SYN_NAMES, signConstraints: SYN_SIGNS, fit, calibration: { type: 'none' },
      samplingRate: rate, l2: 0.01, trainWindow: { from: 'a', to: 'b' }, testWindow: { from: 'c', to: 'd' }, nTrain: 600, positivesTrain: 30,
    });
    const z1 = logitBatch([[1, 1, 0.5, 1]], mk(1))[0];
    const z2 = logitBatch([[1, 1, 0.5, 1]], mk(0.1))[0];
    expect(z1 - z2).toBeCloseTo(Math.log(10), 10);
  });
});

describe('model — calibration', () => {
  test('Platt scaling is monotone and has a positive slope', () => {
    const rnd = mulberry32(3);
    const logits = Array.from({ length: 2000 }, () => (rnd() - 0.5) * 8);
    const y = logits.map(z => (rnd() < sigmoid(0.6 * z - 1) ? 1 : 0));
    const cal = fitPlatt(logits, y);
    expect(cal.type).toBe('platt');
    if (cal.type !== 'platt') return;
    expect(cal.a).toBeGreaterThan(0);
    const xs = [-4, -2, -1, 0, 1, 2, 4];
    const ps = xs.map(z => applyCalibration(cal, z, sigmoid(z)));
    for (let i = 1; i < ps.length; i++) expect(ps[i]).toBeGreaterThan(ps[i - 1]);
    // Roughly recovers the generating curve at the centre
    expect(applyCalibration(cal, 0, 0.5)).toBeGreaterThan(0.2);
    expect(applyCalibration(cal, 0, 0.5)).toBeLessThan(0.35);
  });

  test('isotonic calibration is non-decreasing and respects sample weights', () => {
    const rnd = mulberry32(11);
    const probs = Array.from({ length: 3000 }, () => rnd());
    const y = probs.map(p => (rnd() < p * p ? 1 : 0)); // model is over-confident: true rate = p²
    const cal = fitIsotonic(probs, y);
    expect(cal.type).toBe('isotonic');
    if (cal.type !== 'isotonic') return;
    for (let i = 1; i < cal.y.length; i++) expect(cal.y[i]).toBeGreaterThanOrEqual(cal.y[i - 1]);
    const grid = [0.05, 0.2, 0.4, 0.6, 0.8, 0.95];
    const out = grid.map(p => applyCalibration(cal, Math.log(p / (1 - p)), p));
    for (let i = 1; i < out.length; i++) expect(out[i]).toBeGreaterThanOrEqual(out[i - 1]);
    expect(out[2]).toBeLessThan(0.3); // 0.4 → about 0.16
    expect(out[5]).toBeGreaterThan(0.8);

    // Weighting negatives 10× should pull every knot down
    const w = y.map(v => (v === 1 ? 1 : 10));
    const calW = fitIsotonic(probs, y, w);
    if (calW.type !== 'isotonic') throw new Error('expected isotonic');
    expect(applyCalibration(calW, 0, 0.6)).toBeLessThan(applyCalibration(cal, 0, 0.6));
  });

  test('degenerate inputs fall back to no calibration', () => {
    expect(fitPlatt([0.1, 0.2], [1, 1]).type).toBe('none');
    expect(fitIsotonic([], []).type).toBe('none');
    expect(applyCalibration({ type: 'none' }, 0, 0.42)).toBe(0.42);
  });
});

// ── Metrics ──────────────────────────────────────────────────────────────

describe('metrics — known vectors', () => {
  const scores = [0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0.05];
  const labels = [1, 1, 0, 1, 0, 0, 0, 0, 0, 0];

  test('ROC-AUC, PR-AUC and precision@k on a hand-checkable ranking', () => {
    // pairs: 3 pos × 7 neg = 21; losses: pos@0.6 loses to neg@0.7 → 1 → AUC 20/21
    expect(rocAuc(scores, labels)).toBeCloseTo(20 / 21, 10);
    expect(rocAuc([1, 1, 1, 1], [1, 0, 1, 0])).toBe(0.5);
    expect(rocAuc([0.2, 0.9], [1, 0])).toBe(0);
    // AP = mean of precision at each positive: 1/1, 2/2, 3/4 → 0.9167
    expect(prAuc(scores, labels)).toBeCloseTo((1 + 1 + 0.75) / 3, 10);
    expect(precisionAtK(scores, labels, 2)).toBe(1);
    expect(precisionAtK(scores, labels, 4)).toBe(0.75);
    expect(precisionAtK(scores, labels, 50)).toBeCloseTo(0.3, 10); // k capped at n
  });

  test('lift, Brier and calibration bins', () => {
    // top decile of 10 = 1 row (a positive) → precision 1 / base 0.3
    expect(liftTopDecile(scores, labels)).toBeCloseTo(1 / 0.3, 10);
    expect(brier([1, 0, 0.5], [1, 0, 1])).toBeCloseTo(0.25 / 3, 10);
    const bins = calibrationBins([0.05, 0.15, 0.15, 0.95], [0, 1, 0, 1], 10);
    expect(bins).toHaveLength(10);
    expect(bins[0]).toMatchObject({ n: 1, observed: 0 });
    expect(bins[1]).toMatchObject({ n: 2, observed: 0.5 });
    expect(bins[1].predicted).toBeCloseTo(0.15, 10);
    expect(bins[9]).toMatchObject({ n: 1, observed: 1 });
  });

  test('weights undo negative subsampling: a 10× negative weight equals replicating negatives 10×', () => {
    const s = [0.9, 0.8, 0.3, 0.2];
    const l = [1, 0, 1, 0];
    const w = l.map(v => (v === 1 ? 1 : 10));
    const sRep: number[] = [];
    const lRep: number[] = [];
    s.forEach((v, i) => { const k = l[i] === 1 ? 1 : 10; for (let j = 0; j < k; j++) { sRep.push(v); lRep.push(l[i]); } });
    expect(rocAuc(s, l, w)).toBeCloseTo(rocAuc(sRep, lRep), 10);
    expect(prAuc(s, l, w)).toBeCloseTo(prAuc(sRep, lRep), 10);
    expect(brier(s, l, w)).toBeCloseTo(brier(sRep, lRep), 10);
    expect(precisionAtK(s, l, 11, w)).toBeCloseTo(precisionAtK(sRep, lRep, 11), 10);
    expect(liftTopDecile(s, l, w)).toBeCloseTo(liftTopDecile(sRep, lRep), 10);
    expect(calibrationBins(s, l, 10, w)[8].observed).toBeCloseTo(calibrationBins(sRep, lRep, 10)[8].observed, 10);
  });

  test('computeMetrics flags low power and toBacktestSummary keeps the flag in the notes', () => {
    const m = computeMetrics(scores, labels);
    expect(m.positives).toBe(3);
    expect(m.low_power).toBe(true);
    expect(m.brier_baseline).toBeCloseTo(0.21, 10);
    const summary = toBacktestSummary({
      modelVersion: 'v3.test', runAt: new Date('2026-09-15T00:00:00Z'),
      trainWindow: { from: '2022-01-01', to: '2024-06-01' }, testWindow: { from: '2025-01-01', to: '2025-09-01' },
      nTrain: 100, metrics: m, importance: factorImportance(['a', 'b'], [[0.5, -0.25], [0.5, 0.25]]), notes: ['x'],
    });
    expect(summary.low_power).toBe(true);
    expect(summary.notes).toContain('low_power');
    expect(summary.positives_test).toBe(3);
    expect(summary.calibration_bins).toHaveLength(10);
    expect(summary.factor_importance[0]).toEqual({ factor: 'a', importance: 0.6667 });
  });

  test('factor importance is normalised and sorted', () => {
    const imp = factorImportance(['a', 'b', 'c'], [[1, 2, 0], [1, -2, 0]]);
    expect(imp.map(i => i.factor)).toEqual(['b', 'a', 'c']);
    expect(imp.reduce((s, i) => s + i.importance, 0)).toBeCloseTo(1, 10);
  });
});

// ── End-to-end pure training ──────────────────────────────────────────────

describe('trainAndEvaluate — temporal split on synthetic snapshots', () => {
  test('trains on ≤ 2024-06, calibrates on the next six months, tests on 2025, and reports honestly', () => {
    const rnd = mulberry32(21);
    const months = monthlySnapshotDates('2022-01', '2025-09');
    const rows: LoadedSnapshot[] = [];
    const d = FEATURE_NAMES.length;
    const idxRunway = FEATURE_NAMES.indexOf('runway_under_12');
    const idxBearish = FEATURE_NAMES.indexOf('intent_bearish');
    for (let a = 0; a < 120; a++) {
      const positiveAsset = a < 20;
      for (const asOf of months) {
        const row: (number | null)[] = Array.from({ length: d }, () => (rnd() > 0.85 ? null : rnd()));
        const pressure = positiveAsset ? (rnd() > 0.3 ? 1 : 0) : (rnd() > 0.8 ? 1 : 0);
        row[idxRunway] = pressure;
        row[idxBearish] = positiveAsset ? rnd() * 0.3 : rnd();
        const label: 0 | 1 = positiveAsset && pressure === 1 && rnd() > 0.4 ? 1 : 0;
        rows.push({ asset_id: `asset-${a}`, as_of: asOf, row, label, weight: positiveAsset ? 1 : 1 / 0.03 });
      }
    }
    const out = trainAndEvaluate(rows, 'v3.test', new Date('2026-09-15T00:00:00Z'));
    expect(out.params.version).toBe('v3.test');
    expect(out.params.feature_names).toEqual([...FEATURE_NAMES]);
    expect(out.params.train_window.to <= '2024-06-01').toBe(true);
    expect(out.params.test_window.from >= '2025-01-01').toBe(true);
    expect(out.summary.n_train).toBe(rows.filter(r => r.as_of <= '2024-06-01').length);
    expect(out.summary.n_test).toBe(rows.filter(r => r.as_of >= '2025-01-01').length);
    expect(out.summary.roc_auc).toBeGreaterThan(0.6);
    expect(out.summary.calibration_bins).toHaveLength(10);
    expect(out.summary.factor_importance.length).toBe(d);
    expect(out.testPredictions.length).toBe(out.summary.n_test);
    // Sign constraints carried into the fitted model
    FEATURE_NAMES.forEach((name, j) => {
      const sign = SIGN_CONSTRAINTS[j];
      if (sign === 1) expect(out.params.weights[j]).toBeGreaterThanOrEqual(0);
      if (sign === -1) expect(out.params.weights[j]).toBeLessThanOrEqual(0);
      void name;
    });
    expect(out.notes.join(' ')).toMatch(/calibration/);
  });
});

describe('rebuildDecision (auto-retrain when sources get denser or the model ages)', () => {
  const base = { financials: 1000, intent: 300, patents: 0, labels: 90, press: 10000 };
  const now = new Date('2026-10-01T00:00:00Z');

  test('no baseline yet: never rebuilds (the next run stamps one)', () => {
    expect(rebuildDecision({ countsNow: base, countsThen: null, trainedAt: null, now })).toEqual({ rebuild: false, reason: null });
  });

  test('a month-old model rebuilds regardless of counts', () => {
    const r = rebuildDecision({ countsNow: base, countsThen: base, trainedAt: '2026-08-30T00:00:00Z', now });
    expect(r.rebuild).toBe(true);
    expect(r.reason).toMatch(/days old/);
  });

  test('25% growth in any source rebuilds; less does not', () => {
    const fresh = '2026-09-25T00:00:00Z';
    expect(rebuildDecision({ countsNow: { ...base, financials: 1240 }, countsThen: base, trainedAt: fresh, now }).rebuild).toBe(false);
    const r = rebuildDecision({ countsNow: { ...base, financials: 1250 }, countsThen: base, trainedAt: fresh, now });
    expect(r).toEqual({ rebuild: true, reason: 'financials rows 1000 → 1250' });
  });

  test('a source going from empty to material (100 rows) rebuilds; a handful of rows does not', () => {
    const fresh = '2026-09-25T00:00:00Z';
    expect(rebuildDecision({ countsNow: { ...base, patents: 40 }, countsThen: base, trainedAt: fresh, now }).rebuild).toBe(false);
    expect(rebuildDecision({ countsNow: { ...base, patents: 100 }, countsThen: base, trainedAt: fresh, now }).rebuild).toBe(true);
  });
});
