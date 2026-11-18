import { computeScorecard, renderScorecardMarkdown, scoreBetween, SCORECARD_METRICS, SCORECARD_WEIGHTS } from '@/lib/radar/qa/scorecard';

// Production measures, Nov 17 2026 (radar_qa_scorecard_stats dry run).
const NOV17 = {
  universe_programs: 140733,
  feed_programs: 37967,
  feed_companies: 9555,
  top500_originator_share: 0.88,
  top1k_duplicates: 26,
  feed_drug_resolved_share: 0.785,
  audit_owner_n: 0,
  audit_availability_n: 0,
  backtest_roc_auc: 0.8236,
  backtest_precision_at_100: 0,
  backtest_base_rate: 0.01336,
  backtest_lift_top_decile: 5.071,
  forward_n: 0,
  forward_top_decile_share: null,
  deals_12m: 350,
  deals_12m_linked: 71,
  feed_classified_share: 0.906,
  feed_ta_share: 0.863,
  signal_companies: 724,
  hours_since_classify_ok: 0.01,
  failed_runs_48h: 1,
  top500_sourced_share: 1,
  top500_partnership_checked_share: 1,
};

describe('scoreBetween', () => {
  it('interpolates and clamps when higher is better', () => {
    expect(scoreBetween(0.6, 0.6, 0.98)).toBe(0);
    expect(scoreBetween(0.98, 0.6, 0.98)).toBe(100);
    expect(scoreBetween(0.79, 0.6, 0.98)).toBe(50);
    expect(scoreBetween(2, 0.6, 0.98)).toBe(100);
    expect(scoreBetween(0, 0.6, 0.98)).toBe(0);
  });

  it('works when lower is better', () => {
    expect(scoreBetween(50, 50, 5)).toBe(0);
    expect(scoreBetween(5, 50, 5)).toBe(100);
    expect(scoreBetween(27.5, 50, 5)).toBe(50);
    expect(scoreBetween(0, 50, 5)).toBe(100);
  });
});

describe('computeScorecard', () => {
  it('weights sum to 1 and every dimension has metrics', () => {
    expect(Object.values(SCORECARD_WEIGHTS).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    for (const d of Object.keys(SCORECARD_WEIGHTS)) {
      expect(SCORECARD_METRICS.some(m => m.dimension === d)).toBe(true);
    }
  });

  it('scores unmeasured metrics 0 and flags them', () => {
    const r = computeScorecard(NOV17);
    const audit = r.metrics.find(m => m.key === 'audit_owner')!;
    expect(audit.unmeasured).toBe(true);
    expect(audit.score).toBe(0);
    const fwd = r.metrics.find(m => m.key === 'forward_top_decile')!;
    expect(fwd.unmeasured).toBe(true);
  });

  it('does not let a small audit sample count', () => {
    const r = computeScorecard({ ...NOV17, audit_owner_n: 10, audit_owner_share: 1 });
    expect(r.metrics.find(m => m.key === 'audit_owner')!.unmeasured).toBe(true);
    const ok = computeScorecard({ ...NOV17, audit_owner_n: 60, audit_owner_share: 0.98 });
    expect(ok.metrics.find(m => m.key === 'audit_owner')!.score).toBe(100);
  });

  it('reproduces the Nov 17 baseline well below world-class', () => {
    const r = computeScorecard(NOV17);
    expect(r.overall).toBeGreaterThan(30);
    expect(r.overall).toBeLessThan(70);
    expect(r.metrics.find(m => m.key === 'deal_recall_12m')!.score).toBeLessThan(5);
    expect(r.metrics.find(m => m.key === 'backtest_lift_at_100')!.score).toBe(0);
  });

  it('a world-class engine scores 100', () => {
    const r = computeScorecard({
      universe_programs: 210000, feed_companies: 1000, signal_companies: 700,
      top500_originator_share: 0.99, top1k_duplicates: 2, feed_drug_resolved_share: 0.92,
      audit_owner_n: 200, audit_owner_share: 0.99, audit_availability_n: 200, audit_availability_share: 0.97,
      backtest_roc_auc: 0.93, backtest_precision_at_100: 0.2, backtest_base_rate: 0.01, backtest_lift_top_decile: 9,
      forward_n: 40, forward_top_decile_share: 0.7, deals_12m: 400, deals_12m_linked: 390,
      feed_classified_share: 0.99, feed_ta_share: 0.99, hours_since_classify_ok: 2, failed_runs_48h: 0,
      top500_sourced_share: 1, top500_partnership_checked_share: 1,
    });
    expect(r.overall).toBe(100);
  });

  it('renders a markdown table', () => {
    const md = renderScorecardMarkdown(computeScorecard(NOV17));
    expect(md).toMatch(/Search & Evaluation scorecard: \d+(\.\d)?\/100/);
    expect(md).toContain('(unmeasured)');
  });
});
