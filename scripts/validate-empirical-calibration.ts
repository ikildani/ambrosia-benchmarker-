/**
 * R67 Empirical Multiplier — Automated Composition Validator
 *
 * Runs the empirical multiplier across a representative sweep of deal
 * configurations and validates:
 *   1. HARD invariants — multiplier bounds, cap enforcement, composition
 *      math. CI fails on violation (true regressions only).
 *   2. SOFT distribution shape — median, P90, cohort counts. Warns on
 *      drift but doesn't block CI.
 *
 * This script is LIGHTWEIGHT by design. Hit-rate validation against
 * closed deals (Seagen, Karuna, etc.) happens in
 * `lib/financial/backtest/` which runs the full rNPV engine. The
 * composition validator here catches broken math (the R42+R61 stacking
 * bug). It does NOT attempt to replace the backtest harness.
 *
 * USAGE
 *   npm run validate:empirical              # summary
 *   npm run validate:empirical:verbose      # per-deal detail
 */

import {
  computeEmpiricalMultiplier,
  HARD_CAP,
  ADDITIVE_CAP,
  FLOOR,
} from '../lib/financial/empirical-multiplier';
import { CALIBRATION_DEALS } from '../lib/financial/calibration';
import type { RNPVInput } from '../lib/financial/types';

const args = process.argv.slice(2);
const verbose = args.includes('--verbose');
const taFilter = (() => {
  const i = args.indexOf('--ta');
  return i >= 0 ? args[i + 1]?.toLowerCase() : null;
})();

// ─── Hard guardrails (fail CI) ─────────────────────────────────────────
const HARD_MAX_MULTIPLIER = HARD_CAP;          // 8.0 — from module
const HARD_MIN_MULTIPLIER = FLOOR;              // 0.25 — from module
const HARD_EXPECTED_TIER1_MIN = 0.10;           // ≥10% of sweep should tier-1
const HARD_EXPECTED_TIER1_MAX = 0.80;           // ≤80% (if >80%, tier detection is broken)

// ─── Soft guardrails (warn, don't block CI) ────────────────────────────
const SOFT_MEDIAN_MIN = 1.20;   // median multiplier should be > 1.2× (non-neutral engine)
const SOFT_MEDIAN_MAX = 4.00;   // median > 4.0× signals aggressive calibration

function buildInput(deal: typeof CALIBRATION_DEALS[number], dealType: 'licensing' | 'acquisition' = 'acquisition'): RNPVInput {
  return {
    therapeuticArea: deal.therapeuticArea as RNPVInput['therapeuticArea'],
    phase: deal.phase as RNPVInput['phase'],
    modality: deal.modality as RNPVInput['modality'],
    indication: deal.indication as RNPVInput['indication'],
    territory: deal.territory as RNPVInput['territory'],
    dealType,
    biomarkerStatus: deal.biomarkerSelected ? 'selected' : 'unselected',
    competitivePosition: (deal.competitivePosition || 'racing') as RNPVInput['competitivePosition'],
    dataQuality: 'strongPhase2',
    lineOfTherapy: '1L',
    combinationPotential: 'some',
    regulatoryDesignations: {
      breakthrough: deal.designations?.includes('breakthrough') ?? false,
      fastTrack: deal.designations?.includes('fastTrack') ?? false,
      orphan: deal.designations?.includes('orphan') ?? false,
      prime: false,
    },
    discountRate: 0.12,
    peakSalesEstimate: {
      low: (deal.estimatedPeakSales || 1000) * 0.5,
      median: deal.estimatedPeakSales || 1000,
      high: (deal.estimatedPeakSales || 1000) * 1.5,
    },
  } as RNPVInput;
}

function run() {
  const deals = taFilter
    ? CALIBRATION_DEALS.filter(d => d.therapeuticArea.toLowerCase().includes(taFilter))
    : CALIBRATION_DEALS;

  // Run each deal under BOTH licensing and acquisition posture to exercise
  // the full TA × phase × dealType surface.
  const rows: { id: string; licensor: string; licensee: string; ta: string; phase: string; modality: string; dealType: string; mult: number; tier: 1 | 2; reason: string[] }[] = [];
  for (const deal of deals) {
    for (const dealType of ['acquisition', 'licensing'] as const) {
      const b = computeEmpiricalMultiplier(buildInput(deal, dealType), { includeBreakdown: true });
      rows.push({
        id: deal.id,
        licensor: deal.licensor,
        licensee: deal.licensee,
        ta: deal.therapeuticArea,
        phase: deal.phase,
        modality: deal.modality,
        dealType,
        mult: b.multiplier,
        tier: b.tier,
        reason: b.reason,
      });
    }
  }

  // ─── Aggregate ──────────────────────────────────────────────────────
  const mults = rows.map(r => r.mult).sort((a, b) => a - b);
  const n = mults.length;
  const min = mults[0];
  const max = mults[n - 1];
  const median = mults[Math.floor(n / 2)];
  const p90 = mults[Math.floor(n * 0.9)];
  const tier1Count = rows.filter(r => r.tier === 1).length;
  const tier1Pct = tier1Count / n;

  // ─── Report ─────────────────────────────────────────────────────────
  console.log('\n═══ R67 Empirical Multiplier — Composition Validator ═══');
  console.log(`Configurations tested: ${n}${taFilter ? ` (TA filter: "${taFilter}")` : ''}`);
  console.log(`Multiplier distribution:`);
  console.log(`  min = ${min.toFixed(2)}`);
  console.log(`  median = ${median.toFixed(2)}`);
  console.log(`  p90 = ${p90.toFixed(2)}`);
  console.log(`  max = ${max.toFixed(2)}`);
  console.log(`Hard cap = ${HARD_CAP}  ·  Additive cap = ${ADDITIVE_CAP}  ·  Floor = ${FLOOR}`);
  console.log(`Tier-1 share: ${(tier1Pct * 100).toFixed(1)}% (${tier1Count}/${n})`);

  if (verbose) {
    console.log('\n─── Per-configuration (top 20 multipliers) ───');
    console.log('deal'.padEnd(10), 'ta'.padEnd(18), 'phase'.padEnd(10), 'dealType'.padEnd(13), 'mod'.padEnd(20), 'mult'.padStart(5), 'tier'.padStart(5));
    rows.sort((a, b) => b.mult - a.mult).slice(0, 20).forEach(r => {
      console.log(
        r.id.padEnd(10),
        r.ta.padEnd(18),
        r.phase.padEnd(10),
        r.dealType.padEnd(13),
        r.modality.padEnd(20),
        r.mult.toFixed(2).padStart(5),
        `T${r.tier}`.padStart(5),
      );
    });
  }

  // ─── Guardrails ─────────────────────────────────────────────────────
  const hardFails: string[] = [];
  const softWarnings: string[] = [];

  // HARD: multiplier bounds
  if (max > HARD_MAX_MULTIPLIER) {
    hardFails.push(`Max multiplier ${max.toFixed(2)} > HARD_CAP ${HARD_MAX_MULTIPLIER} — composition cap broken`);
  }
  if (min < HARD_MIN_MULTIPLIER) {
    hardFails.push(`Min multiplier ${min.toFixed(2)} < FLOOR ${HARD_MIN_MULTIPLIER} — floor broken`);
  }
  // HARD: tier-1 detection sanity
  if (tier1Pct < HARD_EXPECTED_TIER1_MIN) {
    hardFails.push(`Tier-1 share ${(tier1Pct * 100).toFixed(1)}% < ${HARD_EXPECTED_TIER1_MIN * 100}% — tier detection broken (over-filtering Tier-1)`);
  }
  if (tier1Pct > HARD_EXPECTED_TIER1_MAX) {
    hardFails.push(`Tier-1 share ${(tier1Pct * 100).toFixed(1)}% > ${HARD_EXPECTED_TIER1_MAX * 100}% — tier detection broken (under-filtering Tier-1)`);
  }
  // HARD: licensing should be < acquisition at same tier FOR PRE-LAUNCH PHASES.
  // Approved-phase licensing can exceed acquisition (orphan exclusivity /
  // territorial rollout premiums like Alexion Soliris, Keytruda regional).
  const PRE_LAUNCH = ['discovery', 'preclinical', 'phase1', 'phase1_2', 'phase2', 'phase2_3', 'phase3'];
  const pairedCheck: string[] = [];
  for (const deal of deals) {
    if (!PRE_LAUNCH.includes(deal.phase)) continue;
    const lic = rows.find(r => r.id === deal.id && r.dealType === 'licensing')!;
    const acq = rows.find(r => r.id === deal.id && r.dealType === 'acquisition')!;
    if (lic.mult >= acq.mult + 0.001) {
      pairedCheck.push(`  ${deal.id}: licensing ${lic.mult.toFixed(2)} ≥ acquisition ${acq.mult.toFixed(2)} (phase=${deal.phase})`);
    }
  }
  if (pairedCheck.length > 0) {
    hardFails.push(`Pre-launch licensing-never-exceeds-acquisition invariant violated for ${pairedCheck.length} deal(s):`);
    hardFails.push(...pairedCheck.slice(0, 5));
  }

  // SOFT: distribution shape
  if (median < SOFT_MEDIAN_MIN) {
    softWarnings.push(`Median multiplier ${median.toFixed(2)} < ${SOFT_MEDIAN_MIN} — calibration conservative (next round may need uplift)`);
  }
  if (median > SOFT_MEDIAN_MAX) {
    softWarnings.push(`Median multiplier ${median.toFixed(2)} > ${SOFT_MEDIAN_MAX} — calibration aggressive (next round may need dampener)`);
  }

  if (softWarnings.length > 0) {
    console.log('\n⚠ CALIBRATION DRIFT WARNINGS:');
    softWarnings.forEach(w => console.log('  ' + w));
  }

  if (hardFails.length > 0) {
    console.log('\n🚨 HARD COMPOSITION FAILURES:');
    hardFails.forEach(f => console.log('  ' + f));
    console.log();
    process.exit(1);
  }

  console.log('\n✓ All composition invariants hold.\n');
  process.exit(0);
}

run();
