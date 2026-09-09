/**
 * Unit tests for the pure scoring layer in lib/radar/signal-detection.ts
 * (scoring v2). No Supabase — detectors and the aggregator run on
 * hand-built evidence bundles.
 */

import {
  FACTOR_WEIGHTS,
  PHASE_PRIOR,
  SIGNAL_TYPES,
  availabilityFactor,
  computeCompositeScore,
  computeTrend,
  detectFactors,
  emptyEvidence,
  escapeLikePattern,
  phasePrior,
  scoreAssetPure,
  type AssetForScoring,
  type EvidenceBundle,
  type SignalFactor,
} from '@/lib/radar/signal-detection';

const NOW = new Date('2026-09-08T08:00:00Z');

function baseAsset(overrides: Partial<AssetForScoring> = {}): AssetForScoring {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    company_id: null,
    company_name: 'Acme Therapeutics',
    asset_name: 'ACM-101',
    modality: 'small_molecule',
    therapeutic_area: 'oncology',
    indication_category: 'solid_tumor',
    indication_specific: null,
    phase: 'phase2',
    trial_status: null,
    partnership_status: 'unpartnered',
    nct_ids: [],
    trial_count: 0,
    confidence_score: 60,
    licensing_intent_score: 0,
    regulatory_designations: [],
    territory_rights_available: [],
    ...overrides,
  };
}

function fullFactors(score = 100, confidence = 100): SignalFactor[] {
  return SIGNAL_TYPES.map(type => ({
    type,
    score,
    confidence,
    direction: 'bullish' as const,
    evidence: 'synthetic',
  }));
}

/** A bundle where every detector finds strong evidence. */
function fullyEvidencedBundle(asset: AssetForScoring): EvidenceBundle {
  const ev = emptyEvidence(asset.company_name, NOW);
  const day = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();
  ev.company.companyFound = true;
  ev.company.company = {
    ...ev.company.company,
    company_type: 'mid_biotech',
    deals_last_12mo: 0,
    deals_last_24mo: 0,
    actively_acquiring: false,
    acquisition_appetite: 'inactive',
    hiring_bd_roles: true,
    strategic_priorities: ['Seeking partner for out-licensing of lead program'],
    data_quality_score: 80,
    revenue_at_risk_2025: 6000,
    revenue_at_risk_2026: 0,
    revenue_at_risk_2027: 0,
  };
  ev.company.pressReleases = [
    { id: 'pr1', headline: `${asset.asset_name} met primary endpoint in pivotal study; late-breaking oral presentation at ASCO`, body_text: 'seeking partner for global rights available', published_at: day(10), source_url: 'https://x/1' },
    { id: 'pr2', headline: `${asset.asset_name} receives breakthrough therapy designation; oral presentation at ESMO`, body_text: 'exploring strategic alternatives, out-licensing, regional partner', published_at: day(20), source_url: 'https://x/2' },
    { id: 'pr3', headline: 'Company appoints Chief Business Officer to lead business development and licensing', body_text: 'strategic review, restructuring, workforce reduction', published_at: day(30), source_url: 'https://x/3' },
    { id: 'pr4', headline: 'Company announces strategic partnerships and corporate development hire', body_text: '', published_at: day(40), source_url: 'https://x/4' },
    { id: 'pr5', headline: 'Company head of partnerships joins; licensing discussions', body_text: '', published_at: day(50), source_url: 'https://x/5' },
  ];
  ev.company.patents = Array.from({ length: 10 }, (_, i) => ({
    id: `pat${i}`, title: `Compositions of ${asset.asset_name} for cancer`, published_date: day(15 + i).slice(0, 10), source_url: null, therapeutic_area: 'oncology',
  }));
  ev.indication = {
    failedAssets: [
      { id: 'fa1', company_name: 'Rival A', asset_name: 'RV-1', modality: 'small_molecule' },
      { id: 'fa2', company_name: 'Rival B', asset_name: 'RV-2', modality: 'antibody' },
    ],
    failedTrials: [{ id: 'ft1', company_name: 'Rival C' }],
    terminatedDeals: [{ id: 'd1', licensor_name: 'Rival D' }],
    errors: {},
  };
  ev.asset.publications = Array.from({ length: 6 }, (_, i) => ({
    id: `pub${i}`, title: `${asset.asset_name} in solid tumors`, published_date: day(10 + i * 5).slice(0, 10), source_url: null, therapeutic_area: 'oncology', journal: i === 0 ? 'NEJM' : 'J Clin Onc',
  }));
  return ev;
}

describe('radar scoring v2 — weights and priors', () => {
  test('factor weights sum to 1.0', () => {
    const total = Object.values(FACTOR_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1.0, 10);
    expect(Object.keys(FACTOR_WEIGHTS).sort()).toEqual([...SIGNAL_TYPES].sort());
  });

  test('phase prior peaks at Phase 2, with Phase 1 / Phase 3 below and approved lowest', () => {
    expect(phasePrior('phase2')).toBe(1.0);
    expect(PHASE_PRIOR.phase2_phase3).toBe(1.0);
    expect(phasePrior('phase3')).toBeLessThan(phasePrior('phase2'));
    expect(phasePrior('phase1')).toBeLessThan(phasePrior('phase2'));
    expect(phasePrior('approved')).toBeLessThan(phasePrior('phase1'));
    expect(phasePrior('approved')).toBeLessThan(phasePrior('phase3'));
    expect(phasePrior(null)).toBe(0.85);
    expect(phasePrior('Phase 2')).toBe(1.0);
  });

  test('availability factor by partnership status', () => {
    expect(availabilityFactor('unpartnered')).toBe(1.0);
    expect(availabilityFactor('partnered')).toBe(0.1);
    expect(availabilityFactor('partially_partnered')).toBe(0.5);
    expect(availabilityFactor('partially_partnered', ['US'])).toBeCloseTo(0.45);
    expect(availabilityFactor('partially_partnered', ['Europe', 'Japan'])).toBeCloseTo(0.37);
    expect(availabilityFactor('partially_partnered', ['Global'])).toBe(1.0);
    expect(availabilityFactor('partially_partnered', ['Narnia'])).toBe(0.5);
    expect(availabilityFactor(null)).toBe(0.85);
  });
});

describe('radar scoring v2 — aggregator (pure)', () => {
  test('fully evidenced unpartnered Phase 2 asset scores >= 90 and confidence 100', () => {
    const c = computeCompositeScore(fullFactors(), { phase: 'phase2', partnership_status: 'unpartnered' });
    expect(c.score).toBeGreaterThanOrEqual(90);
    expect(c.score).toBe(100);
    expect(c.confidence).toBe(100);
    expect(c.phaseMultiplier).toBe(1.0);
    expect(c.availabilityFactor).toBe(1.0);
  });

  test('the same asset partnered scores <= 10', () => {
    const c = computeCompositeScore(fullFactors(), { phase: 'phase2', partnership_status: 'partnered' });
    expect(c.score).toBeLessThanOrEqual(10);
    expect(c.confidence).toBe(100); // confidence is about evidence, not availability
  });

  test('zero-evidence factors score 0 with confidence 0', () => {
    const c = computeCompositeScore(fullFactors(0, 0), { phase: 'phase2', partnership_status: 'unpartnered' });
    expect(c.score).toBe(0);
    expect(c.confidence).toBe(0);
  });

  test('confidence is not multiplied into the score', () => {
    const low = computeCompositeScore(fullFactors(100, 10), { phase: 'phase2', partnership_status: 'unpartnered' });
    expect(low.score).toBe(100);
    expect(low.confidence).toBe(10);
  });

  test('rounds once at the end (no per-factor truncation)', () => {
    // 9 factors at 3.4 each: v1 rounded per step; v2 sums then rounds once → 3
    const c = computeCompositeScore(fullFactors(3.4, 50), { phase: 'phase2', partnership_status: 'unpartnered' });
    expect(c.rawWeighted).toBeCloseTo(3.4, 6);
    expect(c.score).toBe(3);
  });

  test('missing factors contribute nothing', () => {
    const c = computeCompositeScore([], { phase: 'phase2', partnership_status: 'unpartnered' });
    expect(c.score).toBe(0);
    expect(c.confidence).toBe(0);
  });
});

describe('radar scoring v2 — detectors end to end (no Supabase)', () => {
  test('fully evidenced Phase 2 unpartnered asset scores >= 80 through the detectors', () => {
    // Per-factor increment tables (unchanged from v1) cap some detectors below
    // 100 even with maximal evidence: cash_runway 90, competitor_failure 85,
    // management_commentary 75, conference/patent/publication 70. Weighted,
    // that is a practical ceiling of ~86 through the detectors; the aggregator
    // itself reaches 100 (tested above).
    const asset = baseAsset({ trial_status: 'active', trial_count: 6, regulatory_designations: ['breakthrough_therapy'] });
    const result = scoreAssetPure(asset, fullyEvidencedBundle(asset));
    for (const f of result.factors) {
      expect(f.score).toBeGreaterThanOrEqual(70);
      expect(f.confidence).toBeGreaterThan(0);
      expect(f.evidenceKey).not.toBe('none');
    }
    expect(result.licensingIntentScore).toBeGreaterThanOrEqual(80);
    expect(result.scoreConfidence).toBeGreaterThan(50);
    expect(result.factors).toHaveLength(9);
    expect(result.composite.phaseMultiplier).toBe(1.0);
  });

  test('same asset partnered scores <= 10', () => {
    const asset = baseAsset({ trial_status: 'active', trial_count: 6, regulatory_designations: ['breakthrough_therapy'], partnership_status: 'partnered' });
    const result = scoreAssetPure(asset, fullyEvidencedBundle(asset));
    expect(result.licensingIntentScore).toBeLessThanOrEqual(10);
    expect(result.composite.availabilityFactor).toBe(0.1);
  });

  test('zero-evidence asset scores 0 with confidence 0 and nine persisted-shape factors', () => {
    const asset = baseAsset();
    const result = scoreAssetPure(asset, emptyEvidence(asset.company_name, NOW));
    expect(result.licensingIntentScore).toBe(0);
    expect(result.scoreConfidence).toBe(0);
    expect(result.factors).toHaveLength(9);
    for (const f of result.factors) {
      expect(f.score).toBe(0);
      expect(f.confidence).toBe(0);
      expect(f.evidenceKey).toBe('none');
      expect(f.evidence).toMatch(/No evidence found|cannot assess/);
    }
  });

  test('a failed source zeroes confidence for its factors and flags the error', () => {
    const asset = baseAsset();
    const ev = emptyEvidence(asset.company_name, NOW);
    ev.company.errors.press_releases = 'timeout';
    const factors = detectFactors(asset, ev);
    const usesPR = factors.filter(f => f.sourcesChecked?.includes('press_releases'));
    expect(usesPR.length).toBeGreaterThanOrEqual(5);
    for (const f of usesPR) {
      expect(f.error).toContain('press_releases: timeout');
      expect(f.confidence).toBe(0);
    }
    expect(factors.find(f => f.type === 'competitor_failure')?.error).toBeUndefined();
  });

  test('evidence keys are stable for the same evidence set regardless of text', () => {
    const asset = baseAsset({ trial_status: 'active', trial_count: 6 });
    const a = detectFactors(asset, fullyEvidencedBundle(asset));
    const b = detectFactors(asset, fullyEvidencedBundle(asset));
    expect(a.map(f => f.evidenceKey)).toEqual(b.map(f => f.evidenceKey));
  });
});

describe('radar scoring v2 — trend from snapshots', () => {
  const d = (daysAgo: number) => new Date(NOW.getTime() - daysAgo * 86_400_000).toISOString().slice(0, 10);

  test('no prior snapshots → stable, delta 0', () => {
    expect(computeTrend(60, [], NOW)).toEqual({ trend: 'stable', scoreDelta: 0, delta7d: null, delta30d: null });
  });

  test('7-day surge', () => {
    const t = computeTrend(60, [{ snapshot_date: d(7), licensing_intent_score: 40 }], NOW);
    expect(t.trend).toBe('surging');
    expect(t.delta7d).toBe(20);
    expect(t.delta30d).toBeNull();
  });

  test('30-day cooling when no 7-day snapshot', () => {
    const t = computeTrend(40, [{ snapshot_date: d(31), licensing_intent_score: '52' }], NOW);
    expect(t.trend).toBe('cooling');
    expect(t.scoreDelta).toBe(-12);
  });

  test('snapshots outside both horizons are ignored', () => {
    const t = computeTrend(90, [{ snapshot_date: d(2), licensing_intent_score: 10 }, { snapshot_date: d(80), licensing_intent_score: 10 }], NOW);
    expect(t.trend).toBe('stable');
  });
});

describe('radar scoring v2 — PostgREST pattern escaping', () => {
  test('escapes LIKE metacharacters and maps * to _', () => {
    expect(escapeLikePattern('AB_101 (50%) *')).toBe('AB\\_101 (50\\%) _');
    expect(escapeLikePattern("O'Neil, Inc.")).toBe("O'Neil, Inc.");
    expect(escapeLikePattern('a\\b')).toBe('a\\\\b');
  });
});
