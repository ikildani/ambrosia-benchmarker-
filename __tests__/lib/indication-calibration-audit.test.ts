/**
 * Indication Calibration Audit
 *
 * Validates coverage, correctness, and completeness of the three-tier
 * indication calibration system:
 *   - Tier 1: Hand-curated PoS modifiers (~50 indications)
 *   - Tier 3: Auto-calibrated from category/TA heuristics (~512 indications)
 *   - Uncalibrated: Falls through to raw TA defaults
 *
 * This test is diagnostic, not gatekeeping. It logs detailed findings and
 * uses generous assertions so CI stays green while surfacing coverage gaps.
 */

import {
  INDICATION_POS_MODIFIERS,
  getIndicationPoSModifier,
  CALIBRATED_INDICATION_COUNT,
} from '@/lib/financial/indication-pos-modifiers';

import {
  INDICATION_CATALOG,
  ALL_CATALOG_SLUGS,
  TIER3_CATALOG_SIZE,
  TIER3_TA_COUNTS,
  getTier3CalibratedIndication,
  classifyIndication,
  summarizeCategoryDistribution,
  type TherapeuticAreaKey,
} from '@/lib/financial/indication-tier3-calibration';

import { POS_BY_THERAPEUTIC_AREA } from '@/lib/financial/pos-tables';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TIER1_SLUGS = new Set(Object.keys(INDICATION_POS_MODIFIERS));

function isTier1(slug: string): boolean {
  return TIER1_SLUGS.has(slug);
}

function isTier3Only(slug: string): boolean {
  return !isTier1(slug) && ALL_CATALOG_SLUGS.has(slug);
}

const ALL_TAS: TherapeuticAreaKey[] = [
  'oncology', 'neurology', 'immunology', 'metabolic', 'cardiovascular',
  'infectiousDisease', 'ophthalmology', 'womensHealth', 'rareDisease',
  'hematology', 'dermatology', 'gastroenterology',
];

// ---------------------------------------------------------------------------
// (a) Coverage Audit
// ---------------------------------------------------------------------------
describe('Indication Calibration Coverage Audit', () => {
  it('should report Tier 1 vs Tier 3 vs uncalibrated breakdown', () => {
    let tier1Count = 0;
    let tier3OnlyCount = 0;
    let uncalibratedCount = 0;
    const uncalibrated: string[] = [];

    for (const slug of ALL_CATALOG_SLUGS) {
      if (isTier1(slug)) {
        tier1Count++;
      } else {
        // Tier 3 returns a record for every catalog slug, so anything in
        // the catalog that is not Tier 1 is Tier 3 by construction.
        const tier3 = getTier3CalibratedIndication(slug);
        if (tier3) {
          tier3OnlyCount++;
        } else {
          uncalibratedCount++;
          uncalibrated.push(slug);
        }
      }
    }

    const total = tier1Count + tier3OnlyCount + uncalibratedCount;

    console.log('\n=== INDICATION CALIBRATION COVERAGE ===');
    console.log(`Total catalog size:     ${TIER3_CATALOG_SIZE}`);
    console.log(`Tier 1 (hand-curated):  ${tier1Count}`);
    console.log(`Tier 3 (auto-derived):  ${tier3OnlyCount}`);
    console.log(`Uncalibrated (raw TA):  ${uncalibratedCount}`);
    console.log(`Sum check:              ${total}`);
    if (uncalibrated.length > 0) {
      console.log(`Uncalibrated slugs:     ${uncalibrated.join(', ')}`);
    }

    // Diagnostic: at least 40 Tier 1 indications exist
    expect(tier1Count).toBeGreaterThanOrEqual(40);
    // Total should match catalog size
    expect(total).toBe(TIER3_CATALOG_SIZE);
    // The exported count constant should match the actual Tier 1 record count
    expect(CALIBRATED_INDICATION_COUNT).toBe(TIER1_SLUGS.size);
  });

  it('should report per-TA distribution', () => {
    const dist = summarizeCategoryDistribution();

    console.log('\n=== PER-TA CATEGORY DISTRIBUTION ===');
    for (const ta of ALL_TAS) {
      const taTotal = TIER3_TA_COUNTS[ta];
      const categories = dist[ta];
      const parts = Object.entries(categories)
        .filter(([, n]) => n > 0)
        .map(([cat, n]) => `${cat}:${n}`)
        .join(', ');
      console.log(`  ${ta.padEnd(20)} ${String(taTotal).padStart(3)} indications  [${parts}]`);
    }

    // Every TA should have at least 1 indication
    for (const ta of ALL_TAS) {
      expect(TIER3_TA_COUNTS[ta]).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// (b) High-Impact Indication Check
// ---------------------------------------------------------------------------
describe('High-Impact Indication Tier 1 Coverage', () => {
  const HIGH_IMPACT_INDICATIONS: { slug: string; ta: string; reason: string }[] = [
    { slug: 'alzheimers', ta: 'neurology', reason: 'Notoriously high failure rate -- needs hand-curated modifier' },
    { slug: 'lung_nsclc', ta: 'oncology', reason: 'Most competitive solid tumor -- needs precise calibration' },
    { slug: 'breast_her2', ta: 'oncology', reason: 'Best-validated oncology target -- calibration matters for benchmark accuracy' },
    { slug: 'obesity', ta: 'metabolic', reason: 'GLP-1 gold rush -- recent data dramatically shifts PoS upward' },
    { slug: 'myeloma', ta: 'hematology', reason: 'Many approved therapies -- crowded competitive dynamics' },
    { slug: 'rheumatoidArthritis', ta: 'immunology', reason: 'Crowded field with well-understood biology' },
    { slug: 'spinalMuscularAtrophy', ta: 'rareDisease', reason: 'Gene therapy benchmark -- regulatory precedent shifts PoS' },
    { slug: 'atopicDermatitis', ta: 'dermatology', reason: 'IL-13/IL-4 competitive dynamics require precision' },
  ];

  for (const { slug, ta, reason } of HIGH_IMPACT_INDICATIONS) {
    it(`${slug} (${ta}) should have Tier 1 hand-curated modifier`, () => {
      const hasTier1 = isTier1(slug);
      const modifier = INDICATION_POS_MODIFIERS[slug];

      if (hasTier1) {
        console.log(
          `  [OK] ${slug}: Tier 1, ` +
          `P2->P3 modifier=${modifier.phase2ToPhase3}, ` +
          `source="${modifier.source}"`,
        );
        // Verify it has meaningful deviation from 1.0
        const hasDeviation =
          modifier.phase1ToPhase2 !== 1.0 ||
          modifier.phase2ToPhase3 !== 1.0 ||
          modifier.phase3ToApproval !== 1.0;
        expect(hasDeviation).toBe(true);
      } else {
        console.warn(
          `  [WARN] ${slug}: NO Tier 1 modifier! Reason it should have one: ${reason}`,
        );
      }

      // This assertion verifies the slug is in Tier 1
      expect(hasTier1).toBe(true);
    });
  }

  it('should verify Alzheimer\'s Phase 2->3 modifier is significantly below 1.0', () => {
    const ad = INDICATION_POS_MODIFIERS['alzheimers'];
    expect(ad).toBeDefined();
    // AD Phase 2->3 should be well below 1.0 (historically ~45% of TA base)
    expect(ad.phase2ToPhase3).toBeLessThan(0.60);
    console.log(
      `  Alzheimer's P2->P3 modifier: ${ad.phase2ToPhase3} ` +
      `(applied to neuro base ${POS_BY_THERAPEUTIC_AREA['neurology'].phase2ToPhase3} ` +
      `= effective ${(POS_BY_THERAPEUTIC_AREA['neurology'].phase2ToPhase3 * ad.phase2ToPhase3).toFixed(3)})`,
    );
  });

  it('should verify obesity Phase 2->3 modifier is above 1.0 (GLP-1 success)', () => {
    const ob = INDICATION_POS_MODIFIERS['obesity'];
    expect(ob).toBeDefined();
    // GLP-1 era means obesity PoS is above TA average
    expect(ob.phase2ToPhase3).toBeGreaterThan(1.0);
    console.log(
      `  Obesity P2->P3 modifier: ${ob.phase2ToPhase3} ` +
      `(applied to metabolic base ${POS_BY_THERAPEUTIC_AREA['metabolic'].phase2ToPhase3} ` +
      `= effective ${(POS_BY_THERAPEUTIC_AREA['metabolic'].phase2ToPhase3 * ob.phase2ToPhase3).toFixed(3)})`,
    );
  });
});

// ---------------------------------------------------------------------------
// (c) Tier 3 Calibration Bounds Check
// ---------------------------------------------------------------------------
describe('Tier 3 Calibration Bounds Check', () => {
  it('all Tier 3 PoS modifiers should be within [0.5, 2.0] guardrail', () => {
    const transitions = [
      'preclinicalToPhase1',
      'phase1ToPhase2',
      'phase2ToPhase3',
      'phase3ToApproval',
    ] as const;

    let violations = 0;
    const violationDetails: string[] = [];

    for (const slug of ALL_CATALOG_SLUGS) {
      if (isTier1(slug)) continue; // Tier 1 has its own hand-curated values

      const tier3 = getTier3CalibratedIndication(slug);
      if (!tier3) continue;

      for (const t of transitions) {
        const val = tier3.posModifier[t];
        if (val === undefined) continue;
        if (val < 0.5 || val > 2.0) {
          violations++;
          violationDetails.push(`${slug}.${t} = ${val} (out of [0.5, 2.0])`);
        }
      }
    }

    if (violationDetails.length > 0) {
      console.warn('\n=== TIER 3 GUARDRAIL VIOLATIONS ===');
      for (const v of violationDetails) {
        console.warn(`  [VIOLATION] ${v}`);
      }
    } else {
      console.log('\n  [OK] All Tier 3 modifiers within [0.5, 2.0] guardrail');
    }

    expect(violations).toBe(0);
  });

  it('should log a sample of Tier 3 modifier values across categories', () => {
    const sampleSlugs = [
      'gbm',                // aggressive_oncology
      'neuroblastoma',      // pediatric_rare
      'achondroplasia',     // orphan (rare disease TA)
      'coronaryArteryDisease', // very_common
      'cll',                // common_chronic
    ];

    console.log('\n=== TIER 3 SAMPLE VALUES ===');
    for (const slug of sampleSlugs) {
      if (isTier1(slug)) {
        console.log(`  ${slug}: Tier 1 (skipped)`);
        continue;
      }
      const rec = getTier3CalibratedIndication(slug);
      if (!rec) {
        console.log(`  ${slug}: not in catalog`);
        continue;
      }
      console.log(
        `  ${slug}: category=${rec.category}, ` +
        `P1->P2=${rec.posModifier.phase1ToPhase2}, ` +
        `P2->P3=${rec.posModifier.phase2ToPhase3}, ` +
        `P3->Appr=${rec.posModifier.phase3ToApproval}, ` +
        `TAM=$${rec.marketCap.globalTAM_M}M`,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// (d) TA Coverage Completeness
// ---------------------------------------------------------------------------
describe('TA Coverage Completeness', () => {
  for (const ta of ALL_TAS) {
    it(`${ta} should have at least 5 indications in the catalog`, () => {
      const count = INDICATION_CATALOG[ta].length;
      console.log(`  ${ta}: ${count} indications`);
      expect(count).toBeGreaterThanOrEqual(5);
    });
  }

  it('every TA in POS_BY_THERAPEUTIC_AREA should have a matching INDICATION_CATALOG entry', () => {
    const posKeys = Object.keys(POS_BY_THERAPEUTIC_AREA);
    const catalogKeys = Object.keys(INDICATION_CATALOG);

    for (const ta of posKeys) {
      const inCatalog = catalogKeys.includes(ta);
      if (!inCatalog) {
        console.warn(`  [WARN] TA "${ta}" is in POS_BY_THERAPEUTIC_AREA but not in INDICATION_CATALOG`);
      }
      expect(inCatalog).toBe(true);
    }
  });

  it('total catalog should be approximately 562 indications', () => {
    // The catalog may grow over time; check it is in a reasonable range
    console.log(`  Total unique catalog slugs: ${TIER3_CATALOG_SIZE}`);
    expect(TIER3_CATALOG_SIZE).toBeGreaterThanOrEqual(500);
    expect(TIER3_CATALOG_SIZE).toBeLessThanOrEqual(700);
  });
});

// ---------------------------------------------------------------------------
// (e) Orphan Indication Detection
// ---------------------------------------------------------------------------
describe('Orphan Indication Detection (No Tier 1 OR Tier 3)', () => {
  it('should flag indications with no calibration at any tier', () => {
    const orphans: { slug: string; ta: string }[] = [];

    for (const [ta, slugs] of Object.entries(INDICATION_CATALOG) as Array<[TherapeuticAreaKey, readonly string[]]>) {
      for (const slug of slugs) {
        // Check if the indication has ANY calibration
        const modifier = getIndicationPoSModifier(slug);
        if (!modifier) {
          orphans.push({ slug, ta });
        }
      }
    }

    console.log(`\n=== ORPHAN INDICATION DETECTION ===`);
    console.log(`Total catalog: ${TIER3_CATALOG_SIZE}`);
    console.log(`Orphans (no Tier 1 or Tier 3): ${orphans.length}`);

    if (orphans.length > 0) {
      console.warn('Orphaned indications fall through to raw TA defaults:');
      for (const { slug, ta } of orphans) {
        console.warn(`  [ORPHAN] ${slug} (${ta})`);
      }
    } else {
      console.log('  [OK] No orphans -- every catalog indication has Tier 1 or Tier 3 calibration');
    }

    // Diagnostic assertion: orphan count should be very low (ideally 0).
    // The Tier 3 system is designed to cover all catalog slugs, so any
    // orphan indicates a bug in getTier3CalibratedIndication.
    expect(orphans.length).toBeLessThanOrEqual(5);
  });

  it('getIndicationPoSModifier should return a modifier for every catalog slug', () => {
    // This verifies the Tier 1 -> Tier 3 fallback chain works end-to-end
    let misses = 0;
    for (const slug of ALL_CATALOG_SLUGS) {
      const mod = getIndicationPoSModifier(slug);
      if (!mod) misses++;
    }
    console.log(`  Modifier coverage: ${TIER3_CATALOG_SIZE - misses}/${TIER3_CATALOG_SIZE}`);
    expect(misses).toBe(0);
  });

  it('getIndicationPoSModifier should return null for unknown slugs', () => {
    expect(getIndicationPoSModifier('nonexistent_slug_xyz')).toBeNull();
    expect(getIndicationPoSModifier(null)).toBeNull();
    expect(getIndicationPoSModifier(undefined)).toBeNull();
    expect(getIndicationPoSModifier('')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Cross-check: Tier 1 entries all reference valid TAs
// ---------------------------------------------------------------------------
describe('Tier 1 Data Integrity', () => {
  it('all Tier 1 entries should reference a valid TA in POS_BY_THERAPEUTIC_AREA', () => {
    const validTAs = new Set(Object.keys(POS_BY_THERAPEUTIC_AREA));
    const invalidEntries: string[] = [];

    for (const [slug, mod] of Object.entries(INDICATION_POS_MODIFIERS)) {
      if (!validTAs.has(mod.ta)) {
        invalidEntries.push(`${slug} -> ta="${mod.ta}" (not in POS_BY_THERAPEUTIC_AREA)`);
      }
    }

    if (invalidEntries.length > 0) {
      console.warn('\n=== INVALID TA REFERENCES IN TIER 1 ===');
      for (const e of invalidEntries) {
        console.warn(`  [ERROR] ${e}`);
      }
    }

    expect(invalidEntries.length).toBe(0);
  });

  it('all Tier 1 modifiers should have sourceYear >= 2024', () => {
    for (const [slug, mod] of Object.entries(INDICATION_POS_MODIFIERS)) {
      expect(mod.sourceYear).toBeGreaterThanOrEqual(2024);
    }
  });

  it('Tier 1 phase2ToPhase3 modifiers should not be exactly 1.0 for high-failure indications', () => {
    // These indications have well-documented deviations from TA average
    const shouldDeviate = ['alzheimers', 'pancreatic', 'als', 'huntingtons', 'nashMash'];
    for (const slug of shouldDeviate) {
      const mod = INDICATION_POS_MODIFIERS[slug];
      if (mod) {
        expect(mod.phase2ToPhase3).not.toBe(1.0);
        console.log(`  ${slug}: P2->P3 modifier = ${mod.phase2ToPhase3} (deviates from 1.0 as expected)`);
      }
    }
  });
});
