import { buildScoredCall, callStatus, summariseOutcome, EXPIRY_GRACE_DAYS } from '@/lib/brief/scored-call';
import { renderScoredCallPage } from '@/lib/report/pages/scoredCall';
import type { BriefIntelligence } from '@/lib/brief/types';
import type { PredictionRow, OutcomeRow } from '@/lib/outcomes/types';
import type { PDFReportData, ReportMeta } from '@/lib/report/types';

const brief = {
  bridge: {
    ask: { upfrontM: 75, totalM: 900 },
    floor: { upfrontM: 45, totalM: 600 },
    walkAway: { upfrontM: 36 },
  },
  decision: { recommendationLabel: 'Run a process now', walkAwayUpfrontM: 36 },
  buyerMap: { process: { lead: ['Eli Lilly', 'Biogen'], tension: ['Eisai'], hold: [], rationale: '' } },
  landscape: { catalysts: { recommendedWindow: { start: '2027-03', end: '2027-09', rationale: '' } } },
  coverage: { accuracy: { metric: 'Median error on resolved briefs (total value)', value: '±22%', n: 14, note: '9 of 14 within band.' } },
} as unknown as BriefIntelligence;

describe('buildScoredCall', () => {
  it('reads the ask, floor, walk-away, buyers and window from the brief without recomputing', () => {
    const call = buildScoredCall(brief, { deliveredAt: '2026-09-26T00:00:00Z' })!;
    expect(call.ask).toEqual({ upfrontM: 75, totalM: 900 });
    expect(call.floor).toEqual({ upfrontM: 45, totalM: 600 });
    expect(call.walkAwayUpfrontM).toBe(36);
    expect(call.buyers).toEqual({ lead: ['Eli Lilly', 'Biogen'], tension: ['Eisai'] });
    expect(call.window).toEqual({ start: '2027-03-01', end: '2027-09-28' });
    expect(call.expiresOn).toBe('2028-03-26');
    expect(call.followups).toEqual([{ day: 45, date: '2026-11-10' }, { day: 120, date: '2027-01-24' }]);
    expect(call.accuracy?.n).toBe(14);
    expect(call.scoredBy).toHaveLength(3);
  });

  it('returns null without a bridge', () => {
    expect(buildScoredCall({} as BriefIntelligence)).toBeNull();
  });
});

describe('callStatus', () => {
  const prediction = { id: 'p1', status: 'open', predicted_window_end: '2027-09-28' } as unknown as PredictionRow;

  it('is open with days left inside the window', () => {
    const s = callStatus(prediction, null, new Date('2027-09-01T00:00:00Z'));
    expect(s.state).toBe('open');
    expect(s.note).toMatch(/27 days left/);
  });

  it('explains expiry after the window closes', () => {
    const s = callStatus(prediction, null, new Date('2027-10-10T00:00:00Z'));
    expect(s.note).toMatch(new RegExp(`${EXPIRY_GRACE_DAYS} days after the window`));
  });

  it('is resolved with value captured from a client report', () => {
    const outcome = {
      status: 'accepted', matched_by: 'client', licensee_name: 'Biogen', signed_date: '2027-06-01',
      upfront_m: 80, total_m: 950, first_offer_upfront_m: 50, first_offer_total_m: 700, our_ask_upfront_m: 75, our_ask_total_m: 900,
      value_captured_m: 250, within_band_upfront: true, buyer_hit: true, window_hit: true,
    } as unknown as OutcomeRow;
    const s = callStatus(prediction, outcome);
    expect(s.state).toBe('resolved');
    if (s.state === 'resolved') {
      expect(s.outcome.valueCapturedM).toBe(250);
      expect(s.outcome.buyerHit).toBe(true);
      expect(s.note).toMatch(/from your report/);
    }
  });

  it('computes value captured when the ledger has not', () => {
    const o = summariseOutcome({ total_m: 900, first_offer_total_m: 650, matched_by: 'auto', status: 'accepted' } as unknown as OutcomeRow);
    expect(o.valueCapturedM).toBe(250);
  });
});

describe('renderScoredCallPage', () => {
  const meta: ReportMeta = { currentPage: 4, pageCount: 31, reportId: 'AMB-TEST' } as ReportMeta;

  it('prints the registered call and the scoring rules', () => {
    const html = renderScoredCallPage({ brief } as unknown as PDFReportData, meta);
    expect(html).toContain('This call is scored');
    expect(html).toContain('Eli Lilly');
    expect(html).toContain('Day 45');
    expect(html).toContain('Track record in this area');
    expect(html).toContain('14 resolved briefs');
  });

  it('renders an empty state rather than dropping the page when there is no bridge', () => {
    const html = renderScoredCallPage({ brief: {} } as unknown as PDFReportData, meta);
    expect(html).toContain('No call to score');
  });
});
