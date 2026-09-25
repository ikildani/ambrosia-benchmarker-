/**
 * scoreMatch weights and gates, plus computeOutcomeMetrics.
 */

import {
  AUTO_RESOLVE_THRESHOLD,
  IDENTITY_SCORES,
  MATCH_WEIGHTS,
  REVIEW_QUEUE_THRESHOLD,
  buyerHit,
  computeOutcomeMetrics,
  dealToActuals,
  normalizeCompanyName,
  phaseDistance,
  scoreMatch,
} from '@/lib/outcomes/matcher';
import type { CompanyAlias, DealCandidateRow, PredictionForMatch } from '@/lib/outcomes/types';

const prediction = (over: Partial<PredictionForMatch> = {}): PredictionForMatch => ({
  id: 'p1',
  company_id: null,
  asset_id: null,
  licensor_name: 'Acme Therapeutics',
  asset_name: null,
  indication: 'Alzheimer\'s disease',
  therapeutic_area: 'neurology',
  phase: 'phase_2',
  resolve_after: '2026-10-25T00:00:00.000Z',
  upfront_low: 40, upfront_mid: 60, upfront_high: 90,
  total_low: 400, total_mid: 600, total_high: 900,
  predicted_buyers: ['Eli Lilly', 'Biogen'],
  predicted_window_start: '2027-01-01',
  predicted_window_end: '2027-06-30',
  ...over,
});

const deal = (over: Partial<DealCandidateRow> = {}): DealCandidateRow => ({
  id: 'd1',
  licensor_name: 'Acme Therapeutics, Inc.',
  licensor_id: null,
  licensee_name: 'Eli Lilly and Company',
  licensee_id: null,
  asset_name: 'ACM-101',
  announced_date: '2027-02-10',
  phase_at_signing: 'phase_2',
  deal_type: 'license',
  indication_category: 'neurology',
  indication_specific: 'Alzheimer\'s disease',
  therapeutic_area: 'neurology',
  modality: 'small_molecule',
  territory: 'global',
  upfront_usd: 75_000_000,
  total_deal_value_usd: 1_100_000_000,
  royalty_low_pct: 8,
  royalty_high_pct: 12,
  created_at: '2027-02-11T00:00:00Z',
  ...over,
});

const FULL = MATCH_WEIGHTS.identity + MATCH_WEIGHTS.indication + MATCH_WEIGHTS.phaseExact + MATCH_WEIGHTS.resolveAfterGate;

describe('scoreMatch — weights', () => {
  it('weights sum to 1.0 and thresholds are 0.8 / 0.5', () => {
    expect(FULL).toBeCloseTo(1.0, 6);
    expect(AUTO_RESOLVE_THRESHOLD).toBe(0.8);
    expect(REVIEW_QUEUE_THRESHOLD).toBe(0.5);
  });

  it('exact licensor (legal suffix stripped) + indication + phase + after gate = 1.0', () => {
    const m = scoreMatch(prediction(), deal());
    expect(m.score).toBeCloseTo(1.0, 4);
    expect(m.evidence.identity).toBe('name');
    expect(m.evidence.indication).toBe('indication');
    expect(m.evidence.phaseSteps).toBe(0);
    expect(m.evidence.afterResolveAfter).toBe(true);
  });

  it('company_id match counts as full identity even when names differ', () => {
    const m = scoreMatch(prediction({ company_id: 'c1', licensor_name: 'Something Else' }), deal({ licensor_id: 'c1' }));
    expect(m.evidence.identity).toBe('company_id');
    expect(m.score).toBeCloseTo(1.0, 4);
  });

  it('name variants resolve through companies.name_variations', () => {
    const companies: CompanyAlias[] = [{ id: 'c9', name: 'Acme Therapeutics', name_variations: ['ACME Thera', 'Acme Tx'] }];
    const m = scoreMatch(prediction({ licensor_name: 'Acme Tx' }), deal({ licensor_name: 'ACME Thera' }), companies);
    expect(m.evidence.identity).toBe('alias');
    expect(m.score).toBeCloseTo(1.0, 4);
  });

  it('fuzzy name (descriptor dropped) scores 0.7 × 0.45', () => {
    const m = scoreMatch(prediction({ licensor_name: 'Acme Pharma' }), deal({ licensor_name: 'Acme Therapeutics' }));
    expect(m.evidence.identity).toBe('fuzzy');
    expect(m.evidence.identityScore).toBeCloseTo(IDENTITY_SCORES.fuzzy * MATCH_WEIGHTS.identity, 4);
    expect(m.score).toBeCloseTo(0.315 + 0.25 + 0.15 + 0.15, 4);
    expect(m.score).toBeGreaterThanOrEqual(AUTO_RESOLVE_THRESHOLD);
  });

  it('asset-name-only identity scores 0.85 × 0.45', () => {
    const m = scoreMatch(prediction({ licensor_name: 'Unrelated Holdings', asset_name: 'ACM-101' }), deal());
    expect(m.evidence.identity).toBe('asset');
    expect(m.evidence.identityScore).toBeCloseTo(IDENTITY_SCORES.asset * MATCH_WEIGHTS.identity, 4);
  });

  it('no identity at all is a hard gate (score 0)', () => {
    const m = scoreMatch(prediction({ licensor_name: 'Zeta Biologics' }), deal());
    expect(m.evidence.identity).toBe('none');
    expect(m.score).toBe(0);
  });

  it('TA-only fallback scores 0.10 instead of 0.25', () => {
    const m = scoreMatch(prediction({ indication: 'Parkinson\'s disease' }), deal());
    expect(m.evidence.indication).toBe('ta');
    expect(m.evidence.indicationScore).toBe(MATCH_WEIGHTS.taOnly);
    expect(m.score).toBeCloseTo(0.45 + 0.10 + 0.15 + 0.15, 4);
  });

  it('phase one step away scores 0.10; two steps is a hard gate', () => {
    const one = scoreMatch(prediction({ phase: 'phase_2' }), deal({ phase_at_signing: 'phase_3' }));
    expect(one.evidence.phaseSteps).toBe(1);
    expect(one.evidence.phaseScore).toBe(MATCH_WEIGHTS.phaseOneStep);
    expect(one.score).toBeCloseTo(0.45 + 0.25 + 0.10 + 0.15, 4);

    const two = scoreMatch(prediction({ phase: 'phase_1' }), deal({ phase_at_signing: 'phase_3' }));
    expect(two.evidence.phaseSteps).toBe(2);
    expect(two.score).toBe(0);
  });

  it('unknown phase on either side scores 0.05 and passes the gate', () => {
    const m = scoreMatch(prediction({ phase: null }), deal());
    expect(m.evidence.phaseSteps).toBeNull();
    expect(m.evidence.phaseScore).toBe(MATCH_WEIGHTS.phaseUnknown);
    expect(m.score).toBeCloseTo(0.45 + 0.25 + 0.05 + 0.15, 4);
  });

  it('a deal announced before resolve_after is a hard gate (score 0)', () => {
    const m = scoreMatch(prediction({ resolve_after: '2027-03-01T00:00:00Z' }), deal({ announced_date: '2027-02-10' }));
    expect(m.evidence.afterResolveAfter).toBe(false);
    expect(m.score).toBe(0);
  });

  it('a deal announced on the resolve_after day passes (date vs timestamptz)', () => {
    const m = scoreMatch(prediction({ resolve_after: '2027-02-10T15:30:00Z' }), deal({ announced_date: '2027-02-10' }));
    expect(m.evidence.afterResolveAfter).toBe(true);
    expect(m.score).toBeGreaterThan(0);
  });

  it('review-queue example: fuzzy name + TA only + one step lands in 0.5–0.8', () => {
    const m = scoreMatch(
      prediction({ licensor_name: 'Acme Pharma', indication: 'Parkinson\'s disease', phase: 'phase_1' }),
      deal({ licensor_name: 'Acme Therapeutics', phase_at_signing: 'phase_2' }),
    );
    expect(m.score).toBeCloseTo(0.315 + 0.10 + 0.10 + 0.15, 4);
    expect(m.score).toBeGreaterThanOrEqual(REVIEW_QUEUE_THRESHOLD);
    expect(m.score).toBeLessThan(AUTO_RESOLVE_THRESHOLD);
  });
});

describe('helpers', () => {
  it('normalizeCompanyName strips punctuation and legal suffixes', () => {
    expect(normalizeCompanyName('Pfizer Inc.')).toBe('pfizer');
    expect(normalizeCompanyName('Johnson & Johnson')).toBe('johnson and johnson');
    expect(normalizeCompanyName('The Acme Group, Ltd')).toBe('acme');
  });

  it('phaseDistance uses the engine phase order', () => {
    expect(phaseDistance('Phase 1', 'phase_2')).toBe(1);
    expect(phaseDistance('preclinical', 'approved')).toBe(4);
    expect(phaseDistance('unknown', 'phase_2')).toBeNull();
  });

  it('dealToActuals converts USD to $M', () => {
    const a = dealToActuals(deal());
    expect(a.upfront_m).toBe(75);
    expect(a.total_m).toBe(1100);
    expect(a.signed_date).toBe('2027-02-10');
  });
});

describe('computeOutcomeMetrics', () => {
  it('APE uses the mid, within-band uses low–high, buyer/window hits resolve', () => {
    const m = computeOutcomeMetrics(prediction(), dealToActuals(deal()));
    expect(m.abs_pct_error_upfront).toBeCloseTo(Math.abs(75 - 60) / 75, 4);
    expect(m.abs_pct_error_total).toBeCloseTo(Math.abs(1100 - 600) / 1100, 4);
    expect(m.within_band_upfront).toBe(true);     // 75 ∈ [40, 90]
    expect(m.within_band_total).toBe(false);      // 1100 ∉ [400, 900]
    expect(m.buyer_hit).toBe(true);               // "Eli Lilly and Company" ~ "Eli Lilly"
    expect(m.window_hit).toBe(true);              // 2027-02-10 ∈ [2027-01-01, 2027-06-30]
    expect(m.value_captured_m).toBeNull();        // no first offer reported
  });

  it('falls back to (low+high)/2 when mid is missing, null when nothing predicted', () => {
    const m = computeOutcomeMetrics(prediction({ upfront_mid: null }), dealToActuals(deal()));
    expect(m.abs_pct_error_upfront).toBeCloseTo(Math.abs(75 - 65) / 75, 4);
    const none = computeOutcomeMetrics(prediction({ upfront_low: null, upfront_mid: null, upfront_high: null }), dealToActuals(deal()));
    expect(none.abs_pct_error_upfront).toBeNull();
    expect(none.within_band_upfront).toBeNull();
  });

  it('buyer_hit is null without predicted buyers, false when the licensee is not among them', () => {
    expect(computeOutcomeMetrics(prediction({ predicted_buyers: [] }), dealToActuals(deal())).buyer_hit).toBeNull();
    expect(computeOutcomeMetrics(prediction(), dealToActuals(deal({ licensee_name: 'Novartis' }))).buyer_hit).toBe(false);
    expect(buyerHit('Biogen Inc', null, ['Biogen'])).toBe(true);
  });

  it('window_hit is null without a window, false outside it', () => {
    expect(computeOutcomeMetrics(prediction({ predicted_window_start: null, predicted_window_end: null }), dealToActuals(deal())).window_hit).toBeNull();
    expect(computeOutcomeMetrics(prediction(), dealToActuals(deal({ announced_date: '2027-09-01' }))).window_hit).toBe(false);
  });

  it('value captured = signed total − first offer total; upfront pair as fallback', () => {
    const a = { ...dealToActuals(deal()), first_offer_total_m: 800 };
    expect(computeOutcomeMetrics(prediction(), a).value_captured_m).toBe(300);
    const b = { ...dealToActuals(deal({ total_deal_value_usd: null })), first_offer_upfront_m: 50 };
    expect(computeOutcomeMetrics(prediction(), b).value_captured_m).toBe(25);
  });
});
