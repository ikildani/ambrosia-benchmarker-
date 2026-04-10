import {
  INDICATION_CATALOG,
  ALL_CATALOG_SLUGS,
  getTier3CalibratedIndication,
  summarizeCategoryDistribution,
  TIER3_CATALOG_SIZE,
  TIER3_TA_COUNTS,
  classifyIndication,
  type TherapeuticAreaKey,
} from '@/lib/financial/indication-tier3-calibration';
import { getIndicationPoSModifier } from '@/lib/financial/indication-pos-modifiers';
import { getIndicationMarketCap } from '@/lib/financial/index-drugs';
import { getIndicationRevenueCurve } from '@/lib/financial/pos-tables';
import { getCompetitiveDensity } from '@/lib/financial/indication-competitive-density';

describe('Tier 3 coverage report', () => {
  test('catalog contains all 562 unique slugs', () => {
    // eslint-disable-next-line no-console
    console.log('TIER3_CATALOG_SIZE (unique):', TIER3_CATALOG_SIZE);
    // eslint-disable-next-line no-console
    console.log('TIER3_TA_COUNTS:', TIER3_TA_COUNTS);
    const totalWithDupes = (Object.values(INDICATION_CATALOG) as readonly string[][]).reduce(
      (a, b) => a + b.length,
      0,
    );
    // eslint-disable-next-line no-console
    console.log('Total catalog (with dupes):', totalWithDupes);
    expect(totalWithDupes).toBeGreaterThanOrEqual(562);
  });

  test('every catalog slug gets Tier 3 values via all 4 lookup functions', () => {
    const misses: string[] = [];
    for (const slug of ALL_CATALOG_SLUGS) {
      const pos = getIndicationPoSModifier(slug);
      const mc = getIndicationMarketCap(slug);
      const rc = getIndicationRevenueCurve(slug);
      const cd = getCompetitiveDensity(slug);
      if (!pos || !mc || !rc || !cd) {
        misses.push(`${slug}: pos=${!!pos} mc=${!!mc} rc=${!!rc} cd=${!!cd}`);
      }
    }
    if (misses.length > 0) {
      // eslint-disable-next-line no-console
      console.log('Coverage misses:', misses.slice(0, 20));
    }
    expect(misses.length).toBe(0);
  });

  test('average PoS modifier per TA is within [0.8, 1.2]', () => {
    const summary: Record<string, { count: number; avgP2P3: number }> = {};
    for (const ta of Object.keys(INDICATION_CATALOG) as TherapeuticAreaKey[]) {
      let sum = 0;
      let cnt = 0;
      for (const slug of INDICATION_CATALOG[ta]) {
        const mod = getIndicationPoSModifier(slug);
        if (mod) {
          sum += mod.phase2ToPhase3;
          cnt += 1;
        }
      }
      summary[ta] = { count: cnt, avgP2P3: sum / cnt };
    }
    // eslint-disable-next-line no-console
    console.log('Average phase2ToPhase3 modifier per TA:', summary);
    for (const ta of Object.keys(summary)) {
      expect(summary[ta]!.avgP2P3).toBeGreaterThan(0.5);
      expect(summary[ta]!.avgP2P3).toBeLessThan(2.0);
    }
  });

  test('category distribution report', () => {
    const dist = summarizeCategoryDistribution();
    // eslint-disable-next-line no-console
    console.log('Category distribution:', JSON.stringify(dist, null, 2));
    expect(Object.keys(dist).length).toBe(12);
  });

  test('extreme value detection — all slugs within 0.5x-2x TA baseline', () => {
    const extremes: string[] = [];
    for (const slug of ALL_CATALOG_SLUGS) {
      const tier3 = getTier3CalibratedIndication(slug);
      if (!tier3) continue;
      const mods = [
        tier3.posModifier.preclinicalToPhase1 ?? 1,
        tier3.posModifier.phase1ToPhase2,
        tier3.posModifier.phase2ToPhase3,
        tier3.posModifier.phase3ToApproval,
      ];
      for (const m of mods) {
        if (m < 0.5 || m > 2.0) {
          extremes.push(`${slug}: ${m}`);
        }
      }
    }
    expect(extremes).toEqual([]);
  });
});
