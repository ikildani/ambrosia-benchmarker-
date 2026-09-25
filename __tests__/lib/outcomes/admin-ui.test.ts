/**
 * @jest-environment jsdom
 *
 * Admin outcome ledger view helpers (lib/outcomes/admin-view) and the public
 * methodology "Resolved outcomes" block: queue row formatting, evidence
 * rendering, ledger rows, and the n ≥ 10 gating, with a render test of the
 * section on an empty and a populated summary.
 */

import { createElement } from 'react';
import { render, screen } from '@testing-library/react';
import {
  accuracyGate,
  belowThresholdCopy,
  dateOnly,
  evidenceItems,
  formatBand,
  formatLedgerRow,
  formatQueueRow,
  formatScore,
  moneyM,
  sourceHost,
  type LedgerRow,
  type QueueRow,
} from '@/lib/outcomes/admin-view';
import { MIN_N, summariseAccuracy, type AccuracyWindowSummary } from '@/lib/outcomes/statements';
import type { AccuracyRollupRow, MatchEvidence, PredictionSource, RollupWindow } from '@/lib/outcomes/types';
import { ResolvedOutcomesSection } from '@/components/methodology/ResolvedOutcomesSection';

// ─── fixtures ──────────────────────────────────────────────────────────────

const evidence: MatchEvidence = {
  identity: 'alias',
  identityScore: 1,
  indication: 'ta',
  indicationScore: 0.4,
  phaseSteps: 1,
  phaseScore: 0.667,
  afterResolveAfter: true,
  gateScore: 1,
  assetNameMatch: true,
  predictionLicensor: 'Acme Therapeutics',
  dealLicensor: 'Acme Tx Inc.',
};

const queueRow = (over: Partial<QueueRow> = {}): QueueRow => ({
  id: 'o-1',
  prediction_id: 'p-1',
  deal_id: 'd-1',
  match_confidence: 0.68,
  match_evidence: { ...evidence },
  upfront_m: 40,
  total_m: 520,
  licensee_name: 'BigPharma',
  signed_date: '2026-08-14',
  deal_type: 'licensing',
  abs_pct_error_upfront: 0.1429,
  abs_pct_error_total: 0.04,
  within_band_upfront: true,
  within_band_total: false,
  buyer_hit: false,
  window_hit: null,
  created_at: '2026-09-01T00:00:00Z',
  predictions: {
    id: 'p-1',
    source: 'brief',
    source_id: 'br-9',
    user_id: 'u-1',
    licensor_name: 'Acme Therapeutics',
    asset_name: 'ACM-101',
    indication: 'NSCLC',
    therapeutic_area: 'oncology',
    phase: 'phase2',
    upfront_low: 20,
    upfront_mid: 35,
    upfront_high: 60,
    total_low: 300,
    total_mid: 500,
    total_high: 800,
    predicted_buyers: ['Roche', 'AstraZeneca'],
    predicted_window_start: '2026-06-01',
    predicted_window_end: '2027-06-01',
    created_at: '2026-04-02T10:00:00Z',
  },
  deals: {
    id: 'd-1',
    licensor_name: 'Acme Tx Inc.',
    licensee_name: 'BigPharma',
    asset_name: 'ACM-101',
    announced_date: '2026-08-14',
    phase_at_signing: 'phase3',
    indication_specific: 'Non-small cell lung cancer',
    indication_category: 'oncology',
    therapeutic_area: 'oncology',
    upfront_usd: 40_000_000,
    total_deal_value_usd: 520_000_000,
    source_url: 'https://www.sec.gov/Archives/edgar/data/1/0001-8k.htm',
  },
  ...over,
});

const ledgerRow = (over: Partial<LedgerRow> = {}): LedgerRow => ({
  id: 'o-2',
  prediction_id: 'p-2',
  deal_id: 'd-2',
  matched_by: 'auto',
  match_confidence: 0.91,
  upfront_m: 50,
  total_m: 1000,
  licensee_name: 'Roche',
  signed_date: '2026-07-01',
  abs_pct_error_upfront: 0.25,
  abs_pct_error_total: 0.1,
  within_band_upfront: true,
  within_band_total: true,
  buyer_hit: true,
  window_hit: true,
  value_captured_m: null,
  first_offer_upfront_m: null,
  first_offer_total_m: null,
  our_ask_upfront_m: null,
  our_ask_total_m: null,
  resolved_at: '2026-07-02T03:00:00Z',
  reviewed_by: 'resolver',
  notes: null,
  predictions: {
    id: 'p-2',
    source: 'calculator',
    licensor_name: 'Beta Bio',
    asset_name: null,
    indication: 'psoriasis',
    therapeutic_area: 'immunology',
    phase: 'phase2',
    upfront_low: 30,
    upfront_mid: 40,
    upfront_high: 55,
    total_low: 700,
    total_mid: 900,
    total_high: 1200,
    predicted_buyers: ['Roche'],
  },
  deals: { id: 'd-2', licensor_name: 'Beta Bio', licensee_name: 'Roche', announced_date: '2026-07-01', source_url: 'http://example.org/pr' },
  ...over,
});

const cell = (source: PredictionSource | null, window: RollupWindow, n: number, over: Partial<AccuracyRollupRow> = {}): AccuracyRollupRow => ({
  key: `${source ?? '*'}|*|*|*|${window}`,
  source,
  therapeutic_area: null,
  phase: null,
  model_version: null,
  window,
  n,
  n_expired: 0,
  median_ape_upfront: 0.18,
  median_ape_total: 0.2345,
  within_band_rate_upfront: 0.7,
  within_band_rate_total: 0.684,
  buyer_hit_rate: 0.5,
  window_hit_rate: 0.8,
  value_captured_total_m: 0,
  computed_at: '2026-09-25T02:00:00Z',
  ...over,
});

const windowSummary = (n: number, over: Partial<AccuracyWindowSummary> = {}): AccuracyWindowSummary => ({
  window: 'all',
  n,
  nExpired: 0,
  medianErrorUpfront: n >= MIN_N ? '±18%' : null,
  medianErrorTotal: n >= MIN_N ? '±23%' : null,
  withinBandUpfront: n >= MIN_N ? '70%' : null,
  withinBandTotal: n >= MIN_N ? '68%' : null,
  buyerHitRate: n >= MIN_N ? '50%' : null,
  windowHitRate: n >= MIN_N ? '80%' : null,
  valueCapturedM: 0,
  meaningful: n >= MIN_N,
  ...over,
});

// ─── primitives ────────────────────────────────────────────────────────────

describe('admin-view primitives', () => {
  it('moneyM uses the canonical $M formatter and dashes unknowns', () => {
    expect(moneyM(35)).toBe('$35M');
    expect(moneyM(1500)).toBe('$1.5B');
    expect(moneyM(0.25)).toBe('$250K');
    expect(moneyM(null)).toBe('—');
    expect(moneyM(Number.NaN)).toBe('—');
  });

  it('formatBand prints low–high with the mid, or the best available bound', () => {
    expect(formatBand(20, 35, 60)).toBe('$20M–$60M (mid $35M)');
    expect(formatBand(20, null, 60)).toBe('$20M–$60M');
    expect(formatBand(null, 35, null)).toBe('$35M');
    expect(formatBand(20, null, null)).toBe('≥ $20M');
    expect(formatBand(null, null, 60)).toBe('≤ $60M');
    expect(formatBand(null, null, null)).toBe('—');
  });

  it('dateOnly and sourceHost tolerate bad input', () => {
    expect(dateOnly('2026-08-14T12:00:00Z')).toBe('2026-08-14');
    expect(dateOnly('2026-08-14')).toBe('2026-08-14');
    expect(dateOnly(null)).toBe('—');
    expect(dateOnly('not a date')).toBe('—');
    expect(sourceHost('https://www.sec.gov/Archives/x')).toBe('sec.gov');
    expect(sourceHost('http://example.org/pr')).toBe('example.org');
    expect(sourceHost('nope')).toBeNull();
    expect(sourceHost(null)).toBeNull();
  });

  it('formatScore tones the review band', () => {
    expect(formatScore(0.85)).toEqual({ text: '0.85', tone: 'high' });
    expect(formatScore(0.68)).toEqual({ text: '0.68', tone: 'mid' });
    expect(formatScore(0.52)).toEqual({ text: '0.52', tone: 'low' });
    expect(formatScore(null)).toEqual({ text: '—', tone: 'low' });
  });
});

// ─── evidence ──────────────────────────────────────────────────────────────

describe('evidenceItems', () => {
  it('renders every scored component with its weight, plus asset evidence', () => {
    const items = evidenceItems({ ...evidence });
    expect(items.map((i) => i.label)).toEqual(['Licensor', 'Indication', 'Phase', 'Timing', 'Asset']);
    expect(items[0].value).toBe('known name variation (Acme Therapeutics → Acme Tx Inc.)');
    expect(items[0].weight).toBe('1.00 × 0.45');
    expect(items[0].ok).toBe(true);
    expect(items[1].value).toBe('same therapeutic area');
    expect(items[1].weight).toBe('0.40 × 0.10');
    expect(items[2].value).toBe('one phase step apart');
    expect(items[2].weight).toBe('0.67 × 0.10');
    expect(items[3].value).toBe('announced after the resolve-after date');
    expect(items[4].weight).toBe('');
  });

  it('marks failed components and omits asset evidence when absent', () => {
    const items = evidenceItems({ ...evidence, identity: 'none', identityScore: 0, indication: 'none', indicationScore: 0, phaseSteps: null, phaseScore: 0.333, afterResolveAfter: false, gateScore: 0, assetNameMatch: false, predictionLicensor: null, dealLicensor: null });
    expect(items.map((i) => i.label)).toEqual(['Licensor', 'Indication', 'Phase', 'Timing']);
    expect(items[0]).toMatchObject({ value: 'no licensor match', ok: false });
    expect(items[1]).toMatchObject({ value: 'no indication overlap', ok: false });
    expect(items[2]).toMatchObject({ value: 'phase unknown on one side', ok: null, weight: '0.33 × 0.05' });
    expect(items[3]).toMatchObject({ value: 'announced before the resolve-after date', ok: false });
  });

  it('returns nothing for empty or foreign evidence', () => {
    expect(evidenceItems(null)).toEqual([]);
    expect(evidenceItems({})).toEqual([]);
    expect(evidenceItems({ reported_by: 'client' })).toEqual([]);
  });
});

// ─── review queue ──────────────────────────────────────────────────────────

describe('formatQueueRow', () => {
  it('shapes prediction, candidate deal, score and metrics', () => {
    const v = formatQueueRow(queueRow());
    expect(v.id).toBe('o-1');
    expect(v.score).toEqual({ text: '0.68', tone: 'mid' });
    expect(v.prediction).toMatchObject({
      source: 'brief',
      sourceLabel: 'Brief',
      licensor: 'Acme Therapeutics',
      asset: 'ACM-101',
      indication: 'NSCLC',
      phase: 'phase2',
      upfrontBand: '$20M–$60M (mid $35M)',
      totalBand: '$300M–$800M (mid $500M)',
      buyers: ['Roche', 'AstraZeneca'],
      window: '2026-06-01 → 2027-06-01',
      createdAt: '2026-04-02',
    });
    expect(v.deal).toMatchObject({
      parties: 'Acme Tx Inc. → BigPharma',
      date: '2026-08-14',
      phase: 'phase3',
      indication: 'Non-small cell lung cancer',
      dealType: 'licensing',
      upfront: '$40M',
      total: '$520M',
      sourceHost: 'sec.gov',
    });
    expect(v.metrics).toEqual({ apeUpfront: '±14%', apeTotal: '±4%', withinBandUpfront: 'yes', withinBandTotal: 'no', buyerHit: 'no' });
    expect(v.evidence).toHaveLength(5);
  });

  it('falls back to the deal USD terms and tolerates missing embeds', () => {
    const v = formatQueueRow(queueRow({ upfront_m: null, total_m: null }));
    expect(v.deal.upfront).toBe('$40M');
    expect(v.deal.total).toBe('$520M');

    const bare = formatQueueRow(queueRow({ predictions: null, deals: null, match_evidence: null, licensee_name: null, upfront_m: null, total_m: null }));
    expect(bare.prediction.sourceLabel).toBe('—');
    expect(bare.prediction.upfrontBand).toBe('—');
    expect(bare.prediction.window).toBeNull();
    expect(bare.deal.parties).toBe('? → ?');
    expect(bare.deal.upfront).toBe('—');
    expect(bare.deal.sourceHost).toBeNull();
    expect(bare.evidence).toEqual([]);
  });
});

// ─── resolved ledger ───────────────────────────────────────────────────────

describe('formatLedgerRow', () => {
  it('prints predicted vs actual with APE, band, buyer and matched_by', () => {
    const v = formatLedgerRow(ledgerRow());
    expect(v).toMatchObject({
      resolvedAt: '2026-07-02',
      sourceLabel: 'Calculator',
      matchedBy: 'auto',
      matchedByLabel: 'Resolver',
      confidence: '0.91',
      licensor: 'Beta Bio',
      licensee: 'Roche',
      signedDate: '2026-07-01',
      predictedUpfront: '$30M–$55M (mid $40M)',
      actualUpfront: '$50M',
      predictedTotal: '$700M–$1.2B (mid $900M)',
      actualTotal: '$1.0B',
      apeUpfront: '±25%',
      apeTotal: '±10%',
      withinBandUpfront: 'yes',
      buyerHit: 'yes',
      windowHit: 'yes',
      sourceHost: 'example.org',
      client: null,
    });
  });

  it('adds first offer, our ask and value captured on client-reported rows', () => {
    const v = formatLedgerRow(ledgerRow({
      matched_by: 'client', match_confidence: null, deal_id: null, deals: null, reviewed_by: 'ikildani@ambrosiaventures.co', notes: 'Signed 12 Aug',
      first_offer_upfront_m: 25, first_offer_total_m: 600, our_ask_upfront_m: 60, our_ask_total_m: 1100, value_captured_m: 25,
    }));
    expect(v.matchedByLabel).toBe('Client-reported');
    expect(v.confidence).toBe('—');
    expect(v.client).toEqual({ firstOfferUpfront: '$25M', firstOfferTotal: '$600M', ourAskUpfront: '$60M', ourAskTotal: '$1.1B', valueCaptured: '$25M' });
    expect(v.sourceUrl).toBeNull();
    expect(v.notes).toBe('Signed 12 Aug');
  });
});

// ─── accuracy gating ───────────────────────────────────────────────────────

describe('accuracyGate', () => {
  it('prints counts only below MIN_N', () => {
    const c = accuracyGate(windowSummary(4, { nExpired: 2 }), MIN_N);
    expect(c.meaningful).toBe(false);
    expect(c.n).toBe('4');
    expect(c.expired).toBe('2 expired');
    expect(c.copy).toBe('4 resolved so far; figures publish at 10');
    expect(c.medianErrorUpfront).toBe('—');
    expect(c.buyerHitRate).toBe('—');
    expect(belowThresholdCopy(0, 10)).toBe('0 resolved so far; figures publish at 10');
  });

  it('prints the rates at or above MIN_N and never trusts a stale meaningful flag', () => {
    const c = accuracyGate(windowSummary(12, { valueCapturedM: 37.5 }), MIN_N);
    expect(c.meaningful).toBe(true);
    expect(c.copy).toBeNull();
    expect(c.expired).toBeNull();
    expect(c).toMatchObject({ medianErrorUpfront: '±18%', medianErrorTotal: '±23%', withinBandUpfront: '70%', withinBandTotal: '68%', buyerHitRate: '50%', windowHitRate: '80%', valueCaptured: '$38M' });

    const stale = accuracyGate(windowSummary(12, { meaningful: false }), MIN_N);
    expect(stale.meaningful).toBe(false);
    expect(stale.copy).toBe('12 resolved so far; figures publish at 10');

    const short = accuracyGate(windowSummary(12), 20);
    expect(short.meaningful).toBe(false);
    expect(short.copy).toBe('12 resolved so far; figures publish at 20');
  });
});

// ─── methodology section render ────────────────────────────────────────────

describe('ResolvedOutcomesSection', () => {
  it('renders the empty state when nothing has resolved', () => {
    const { container } = render(createElement(ResolvedOutcomesSection, { summary: { computedAt: null, minN: MIN_N, sources: [] } }));
    expect(screen.getByText('Resolved outcomes (live ledger)')).toBeTruthy();
    expect(container.textContent).toContain('No predictions have resolved yet');
    expect(container.textContent).toContain(`reaches ${MIN_N} resolved outcomes`);
    expect(container.querySelector('table')).toBeNull();
    expect(container.textContent).not.toContain('Ledger last rolled up');
  });

  it('prints rates for meaningful cells and the publish-at copy for the rest', () => {
    const summary = summariseAccuracy([
      cell(null, 'all', 15, { value_captured_total_m: 12 }),
      cell(null, '365d', 15),
      cell('calculator', 'all', 12, { median_ape_upfront: 0.18 }),
      cell('brief', 'all', 3, { median_ape_total: 0.05 }),
      cell('brief', '90d', 1),
    ]);
    const { container } = render(createElement(ResolvedOutcomesSection, { summary }));
    const text = container.textContent ?? '';

    expect(container.querySelector('table')).not.toBeNull();
    expect(text).toContain('All predictions');
    expect(text).toContain('Calculator ranges');
    expect(text).toContain('Deal briefs');
    expect(text).toContain('Last 12 months');
    expect(text).toContain('±18%');
    expect(text).toContain('68%');
    expect(text).toContain('3 resolved so far; figures publish at 10');
    expect(text).toContain('1 resolved so far; figures publish at 10');
    // The brief cell's sub-threshold median error must not leak into the page.
    expect(text).not.toContain('±5%');
    expect(text).toContain('Ledger last rolled up 2026-09-25');

    const rows = container.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(5);
    const briefRow = Array.from(rows).find((r) => r.textContent?.includes('3 resolved so far'));
    expect(briefRow?.querySelector('td[colspan="6"]')).not.toBeNull();
  });
});
