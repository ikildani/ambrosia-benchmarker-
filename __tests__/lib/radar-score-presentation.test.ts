import { intervalFromBins, topDrivers, wilsonInterval } from '@/lib/radar/score-presentation';
import type { ScoreFactorContribution } from '@/lib/radar/types';

function c(factor: string, points: number, over: Partial<ScoreFactorContribution> = {}): ScoreFactorContribution {
  return { factor, weight: 1, score: 0, points, confidence: 100, evidence_text: null, evidence_url: null, evidence_date: null, sources_checked: [], ...over };
}

describe('topDrivers', () => {
  it('ranks by absolute points, drops the intercept and zero rows, keeps sign and evidence', () => {
    const rows = [
      c('intercept', -3.5),
      c('runway_under_12', 1.2, { evidence_text: 'Runway 9 months per 10-Q', evidence_url: 'https://sec.gov/x', evidence_date: '2026-08-01' }),
      c('asset_age_months', -0.7),
      c('owner_industry', 0.4),
      c('patent_velocity', 0),
      c('intent_bullish', 2.1, { evidence_text: 'x'.repeat(500) }),
    ];
    const top = topDrivers(rows);
    expect(top.map(d => d.factor)).toEqual(['intent_bullish', 'runway_under_12', 'asset_age_months']);
    expect(top[1]).toEqual({ factor: 'runway_under_12', points: 1.2, evidence: 'Runway 9 months per 10-Q', url: 'https://sec.gov/x', date: '2026-08-01' });
    expect(top[0].evidence).toHaveLength(240);
    expect(top[2].points).toBe(-0.7);
  });

  it('returns an empty list for an empty or intercept-only decomposition', () => {
    expect(topDrivers([])).toEqual([]);
    expect(topDrivers([c('intercept', -2)])).toEqual([]);
  });
});

describe('wilsonInterval', () => {
  it('brackets the observed rate and stays inside [0, 1]', () => {
    const { lo, hi } = wilsonInterval(5, 100);
    expect(lo).toBeGreaterThan(0.02);
    expect(lo).toBeLessThan(0.05);
    expect(hi).toBeGreaterThan(0.05);
    expect(hi).toBeLessThan(0.09);
    expect(wilsonInterval(0, 50).lo).toBeCloseTo(0, 6);
    expect(wilsonInterval(50, 50).hi).toBeCloseTo(1, 6);
  });
});

describe('intervalFromBins', () => {
  const bins = [
    { bin: '0.0-0.1', predicted: 0.02, observed: 0.01, n: 5000 },
    { bin: '0.1-0.2', predicted: 0.14, observed: 0.12, n: 200 },
    { bin: '0.2-0.3', predicted: 0.24, observed: 0.3, n: 10 },
    { bin: '0.9-1.0', predicted: 0.95, observed: 1, n: 40 },
  ];

  it('finds the bin, converts the observed rate to successes and reports an 80% interval', () => {
    const iv = intervalFromBins(0.15, bins);
    expect(iv).not.toBeNull();
    expect(iv!.bin).toBe('0.1-0.2');
    expect(iv!.n).toBe(200);
    expect(iv!.lo).toBeGreaterThan(0.09);
    expect(iv!.hi).toBeLessThan(0.16);
  });

  it('the top bin is closed at 1.0', () => {
    expect(intervalFromBins(1, bins)?.bin).toBe('0.9-1.0');
  });

  it('is null for thin bins, no bins, or no probability', () => {
    expect(intervalFromBins(0.25, bins)).toBeNull();
    expect(intervalFromBins(0.5, bins)).toBeNull();
    expect(intervalFromBins(0.15, [])).toBeNull();
    expect(intervalFromBins(null, bins)).toBeNull();
  });
});
