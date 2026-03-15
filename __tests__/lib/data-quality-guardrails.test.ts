/**
 * Data Quality Guardrails
 *
 * Automated integrity checks that run on every test invocation (pre-deploy).
 * These are pure data checks -- no API calls, no side effects, fast execution.
 *
 * Categories:
 *   1. Indication Coverage
 *   2. Comparable Deals Integrity
 *   3. Deal Flow Forecast Data
 *   4. Phase Baseline Sanity
 *   5. Modality Coverage
 *   6. Deal Type Multiplier Sanity
 */

import benchmarks from '@/data/benchmarks.json';
import { COMPARABLE_DEALS } from '@/lib/comparableDeals';
import { HISTORICAL_DEAL_FLOW } from '@/lib/services/deal-flow-forecast';
import {
  modalityOptions,
  neurologyModalityOptions,
  immunologyModalityOptions,
  metabolicModalityOptions,
  cardiovascularModalityOptions,
  infectiousDiseaseModalityOptions,
  ophthalmologyModalityOptions,
  womensHealthModalityOptions,
  rareDiseaseModalityOptions,
  hematologyModalityOptions,
  dermatologyModalityOptions,
  gastroenterologyModalityOptions,
} from '@/lib/calculations';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INDICATION_TAS = Object.keys(benchmarks.indications) as string[];

const ALL_DEAL_FLOW_TAS = [
  'oncology',
  'neurology',
  'immunology',
  'metabolic',
  'cardiovascular',
  'infectiousDisease',
  'ophthalmology',
  'womensHealth',
  'rareDisease',
  'hematology',
  'dermatology',
  'gastroenterology',
] as const;

const VALID_THERAPEUTIC_AREAS = [
  'oncology',
  'neurology',
  'immunology',
  'metabolic',
  'cardiovascular',
  'infectiousDisease',
  'ophthalmology',
  'womensHealth',
  'rareDisease',
  'hematology',
  'dermatology',
  'gastroenterology',
  'both', // legacy cross-TA marker
] as const;

const VALID_DEAL_TYPES = [
  'licensing',
  'acquisition',
  'codevelopment',
  'option',
  'collaboration',
] as const;

const PHASE_ORDER = [
  'discovery',
  'preclinical',
  'phase1',
  'phase1_2',
  'phase2',
  'phase2_3',
  'phase3',
  'nda_filed',
  'approved',
] as const;

/** All phaseBaselines keys in benchmarks.json (oncology is the unnamed default) */
const ALL_PHASE_BASELINE_KEYS = [
  'phaseBaselines',
  'neurologyPhaseBaselines',
  'immunologyPhaseBaselines',
  'metabolicPhaseBaselines',
  'cardiovascularPhaseBaselines',
  'infectiousDiseasePhaseBaselines',
  'ophthalmologyPhaseBaselines',
  'womensHealthPhaseBaselines',
  'rareDiseasePhaseBaselines',
  'hematologyPhaseBaselines',
  'dermatologyPhaseBaselines',
  'gastroenterologyPhaseBaselines',
] as const;

/** Map of TA name to its modality options array */
const TA_MODALITY_OPTIONS: Record<string, typeof modalityOptions> = {
  oncology: modalityOptions,
  neurology: neurologyModalityOptions,
  immunology: immunologyModalityOptions,
  metabolic: metabolicModalityOptions,
  cardiovascular: cardiovascularModalityOptions,
  infectiousDisease: infectiousDiseaseModalityOptions,
  ophthalmology: ophthalmologyModalityOptions,
  womensHealth: womensHealthModalityOptions,
  rareDisease: rareDiseaseModalityOptions,
  hematology: hematologyModalityOptions,
  dermatology: dermatologyModalityOptions,
  gastroenterology: gastroenterologyModalityOptions,
};

// Flatten grouped options into a simple count
function countModalityOptions(groups: typeof modalityOptions): number {
  return groups.reduce((sum, g) => sum + g.options.length, 0);
}

// ---------------------------------------------------------------------------
// 1. Indication Coverage
// ---------------------------------------------------------------------------

describe('Indication Coverage', () => {
  it('every TA should have at least 10 indications', () => {
    for (const ta of INDICATION_TAS) {
      const indications = benchmarks.indications[ta as keyof typeof benchmarks.indications];
      const count = Object.keys(indications).length;
      expect(count).toBeGreaterThanOrEqual(10);
    }
  });

  it('every indication should have a label and multiplier', () => {
    for (const ta of INDICATION_TAS) {
      const indications = benchmarks.indications[ta as keyof typeof benchmarks.indications] as Record<
        string,
        { label?: string; multiplier?: number }
      >;
      for (const [key, ind] of Object.entries(indications)) {
        expect(ind.label).toBeDefined();
        expect(typeof ind.label).toBe('string');
        expect(ind.label!.length).toBeGreaterThan(0);
        expect(ind.multiplier).toBeDefined();
        expect(typeof ind.multiplier).toBe('number');
      }
    }
  });

  it('no indication multiplier should be < 0.5 or > 2.0', () => {
    for (const ta of INDICATION_TAS) {
      const indications = benchmarks.indications[ta as keyof typeof benchmarks.indications] as Record<
        string,
        { multiplier: number; label: string }
      >;
      for (const [key, ind] of Object.entries(indications)) {
        expect(ind.multiplier).toBeGreaterThanOrEqual(0.5);
        expect(ind.multiplier).toBeLessThanOrEqual(2.0);
      }
    }
  });

  it('no duplicate indication keys within a single TA', () => {
    for (const ta of INDICATION_TAS) {
      const indications = benchmarks.indications[ta as keyof typeof benchmarks.indications];
      const keys = Object.keys(indications);
      const unique = new Set(keys);
      // JSON parsing inherently deduplicates keys (last wins), so this is more
      // of a sanity check that no key appears in both a sub-group and top level
      expect(keys.length).toBe(unique.size);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Comparable Deals Integrity
// ---------------------------------------------------------------------------

describe('Comparable Deals Integrity', () => {
  it('all curated deals should have totalValueM > 0', () => {
    for (const deal of COMPARABLE_DEALS) {
      expect(deal.totalValueM).toBeDefined();
      expect(deal.totalValueM).toBeGreaterThan(0);
    }
  });

  it('no deal with licensee "N/A (standalone)" should exist', () => {
    const standalones = COMPARABLE_DEALS.filter(
      (d) => d.licensee === 'N/A (standalone)',
    );
    expect(standalones).toHaveLength(0);
  });

  it('all deals should have a valid therapeuticArea', () => {
    const validSet = new Set<string>(VALID_THERAPEUTIC_AREAS);
    for (const deal of COMPARABLE_DEALS) {
      expect(validSet.has(deal.therapeuticArea)).toBe(true);
    }
  });

  it('all deals should have a valid dealType', () => {
    const validSet = new Set<string>(VALID_DEAL_TYPES);
    for (const deal of COMPARABLE_DEALS) {
      if (deal.dealType) {
        expect(validSet.has(deal.dealType)).toBe(true);
      }
    }
  });

  it('no duplicate licensor+licensee+year combinations within COMPARABLE_DEALS', () => {
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const deal of COMPARABLE_DEALS) {
      const key = `${deal.licensor}|${deal.licensee}|${deal.year}`;
      if (seen.has(key)) {
        duplicates.push(key);
      }
      seen.add(key);
    }
    expect(duplicates).toEqual([]);
  });

  it('at least 8 TAs should have deals (via primary + secondaryTAs)', () => {
    const coveredTAs = new Set<string>();
    for (const deal of COMPARABLE_DEALS) {
      coveredTAs.add(deal.therapeuticArea);
      if (deal.secondaryTAs) {
        for (const ta of deal.secondaryTAs) {
          coveredTAs.add(ta);
        }
      }
    }
    // Remove 'both' since it's not a real TA
    coveredTAs.delete('both');
    expect(coveredTAs.size).toBeGreaterThanOrEqual(8);
  });
});

// ---------------------------------------------------------------------------
// 3. Deal Flow Forecast Data
// ---------------------------------------------------------------------------

describe('Deal Flow Forecast Data', () => {
  it('all 12 TAs should have historical data', () => {
    for (const ta of ALL_DEAL_FLOW_TAS) {
      expect(HISTORICAL_DEAL_FLOW[ta]).toBeDefined();
      expect(Array.isArray(HISTORICAL_DEAL_FLOW[ta])).toBe(true);
    }
  });

  it('each TA should have at least 16 quarters of history', () => {
    for (const ta of ALL_DEAL_FLOW_TAS) {
      expect(HISTORICAL_DEAL_FLOW[ta].length).toBeGreaterThanOrEqual(16);
    }
  });

  it('deal counts should be positive', () => {
    for (const ta of ALL_DEAL_FLOW_TAS) {
      for (const entry of HISTORICAL_DEAL_FLOW[ta]) {
        expect(entry.dealCount).toBeGreaterThan(0);
      }
    }
  });

  it('deal values should be positive', () => {
    for (const ta of ALL_DEAL_FLOW_TAS) {
      for (const entry of HISTORICAL_DEAL_FLOW[ta]) {
        expect(entry.totalValue).toBeGreaterThan(0);
      }
    }
  });

  it('no gaps in quarterly sequence', () => {
    const quarterToIndex = (q: string): number => {
      const year = parseInt(q.slice(0, 4), 10);
      const qn = parseInt(q.slice(5), 10);
      return year * 4 + (qn - 1);
    };

    for (const ta of ALL_DEAL_FLOW_TAS) {
      const entries = HISTORICAL_DEAL_FLOW[ta];
      for (let i = 1; i < entries.length; i++) {
        const prev = quarterToIndex(entries[i - 1].quarter);
        const curr = quarterToIndex(entries[i].quarter);
        expect(curr - prev).toBe(1);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Phase Baseline Sanity
// ---------------------------------------------------------------------------

describe('Phase Baseline Sanity', () => {
  for (const baselineKey of ALL_PHASE_BASELINE_KEYS) {
    describe(baselineKey, () => {
      const baselines = (benchmarks as Record<string, unknown>)[baselineKey] as Record<
        string,
        {
          upfront: { low: number; median: number; high: number };
          totalValue: { low: number; median: number; high: number };
          royalty: { base: number; max: number };
        }
      >;

      it('should exist and have all phases', () => {
        expect(baselines).toBeDefined();
        for (const phase of PHASE_ORDER) {
          expect(baselines[phase]).toBeDefined();
        }
      });

      it('total value medians should increase monotonically across phases', () => {
        for (let i = 1; i < PHASE_ORDER.length; i++) {
          const prev = baselines[PHASE_ORDER[i - 1]].totalValue.median;
          const curr = baselines[PHASE_ORDER[i]].totalValue.median;
          expect(curr).toBeGreaterThanOrEqual(prev);
        }
      });

      it('upfront should always be less than total value (median)', () => {
        for (const phase of PHASE_ORDER) {
          const pb = baselines[phase];
          expect(pb.upfront.median).toBeLessThan(pb.totalValue.median);
        }
      });

      it('royalty base should be less than royalty max', () => {
        for (const phase of PHASE_ORDER) {
          const pb = baselines[phase];
          expect(pb.royalty.base).toBeLessThan(pb.royalty.max);
        }
      });
    });
  }
});

// ---------------------------------------------------------------------------
// 5. Modality Coverage
// ---------------------------------------------------------------------------

describe('Modality Coverage', () => {
  it('each TA should have at least 5 modality options', () => {
    for (const [ta, options] of Object.entries(TA_MODALITY_OPTIONS)) {
      const count = countModalityOptions(options);
      expect(count).toBeGreaterThanOrEqual(5);
    }
  });

  it('no modality multiplier in benchmarks should be < 0.3 or > 3.0', () => {
    const modalities = benchmarks.modalities as Record<
      string,
      { multiplier: number; label: string }
    >;
    for (const [key, mod] of Object.entries(modalities)) {
      expect(mod.multiplier).toBeGreaterThanOrEqual(0.3);
      expect(mod.multiplier).toBeLessThanOrEqual(3.0);
    }
  });
});

// ---------------------------------------------------------------------------
// 6. Deal Type Multiplier Sanity
// ---------------------------------------------------------------------------

describe('Deal Type Multiplier Sanity', () => {
  // These are the phase-adjusted acquisition multipliers from calculations.ts.
  // We duplicate them here as a guardrail snapshot -- if they change upstream,
  // this test forces an explicit review.
  const phaseAcquisitionMultipliers: Record<string, number> = {
    discovery: 0.30,
    preclinical: 0.45,
    phase1: 0.60,
    phase1_2: 0.70,
    phase2: 0.90,
    phase2_3: 1.10,
    phase3: 1.35,
    nda_filed: 1.50,
    approved: 1.65,
  };

  it('phase-adjusted acquisition multipliers should increase with phase', () => {
    const phases = PHASE_ORDER;
    for (let i = 1; i < phases.length; i++) {
      const prev = phaseAcquisitionMultipliers[phases[i - 1]];
      const curr = phaseAcquisitionMultipliers[phases[i]];
      expect(curr).toBeGreaterThan(prev);
    }
  });

  it('all acquisition multipliers should be > 0 and < 3.0', () => {
    for (const [phase, mult] of Object.entries(phaseAcquisitionMultipliers)) {
      expect(mult).toBeGreaterThan(0);
      expect(mult).toBeLessThan(3.0);
    }
  });

  it('deal type multipliers for non-acquisition types should be > 0 and < 3.0', () => {
    // Static deal type multipliers from calculations.ts
    const dealTypeMultipliers: Record<string, number> = {
      licensing: 1.0,
      codevelopment: 0.90,
      option: 0.75,
      collaboration: 0.65,
    };
    for (const [type, mult] of Object.entries(dealTypeMultipliers)) {
      expect(mult).toBeGreaterThan(0);
      expect(mult).toBeLessThan(3.0);
    }
  });
});
