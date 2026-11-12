/**
 * Deal-terms accuracy guard: the rNPV engine against every disclosed deal in the
 * backtest corpus (lib/financial/backtest/deal-backtest.ts, the same run as
 * scripts/run-deal-backtest.ts).
 *
 * The floors sit about two points under the scores on November 12 2026, so CI
 * fails when a calibration change makes deal pricing measurably worse. They are
 * a regression floor, not a quality target. Scores on November 12 2026:
 *   full corpus (447 deals): 27.2% within ±35%, 39.2% within ±50%, median signed error -19.4%
 *   core scope   (90 deals): 24.4% within ±35%, 32.2% within ±50%
 * When a change genuinely improves accuracy, rerun the script, commit the new
 * baseline-errors.json and raise these floors with it.
 */
import { runDealBacktest } from '@/lib/financial/backtest/deal-backtest';

const report = runDealBacktest();

describe('Deal-terms accuracy guard (full backtest corpus)', () => {
  it('runs on the full corpus', () => {
    // A shrinking corpus would make the floors meaningless.
    expect(report.fullScope.totalDeals).toBeGreaterThanOrEqual(400);
    expect(report.coreScope.totalDeals).toBeGreaterThanOrEqual(80);
  });

  it('keeps full-corpus hit rates at or above the floor', () => {
    expect(report.fullScope.hitRate35).toBeGreaterThanOrEqual(0.25);
    expect(report.fullScope.hitRate50).toBeGreaterThanOrEqual(0.37);
  });

  it('keeps core-scope hit rates at or above the floor', () => {
    expect(report.coreScope.hitRate35).toBeGreaterThanOrEqual(0.22);
    expect(report.coreScope.hitRate50).toBeGreaterThanOrEqual(0.30);
  });

  it('keeps the median bias within bounds', () => {
    // Today the engine prices deals about 19% low on median. A swing past either
    // bound means a systematic shift, even if hit rates hold.
    expect(report.fullScope.medianSignedErrorPct).toBeGreaterThan(-0.3);
    expect(report.fullScope.medianSignedErrorPct).toBeLessThan(0.1);
  });
});
