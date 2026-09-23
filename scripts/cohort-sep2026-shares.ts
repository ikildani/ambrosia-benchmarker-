#!/usr/bin/env npx tsx
/**
 * Sep 2026 trial-cohort campaign: build the Tier 1 deliverables.
 *
 * For each top prospect, run the same engine the calculator runs, with the
 * exact program they benchmarked, and publish it as a /share link owned by
 * Issa's account. The share page renders the comp-based deal terms the
 * recipient already saw in the app. The rNPV-centric /brief page is not used:
 * on these programs the financial model logs invariant violations and its
 * implied upfront diverges from the comp-based range by an order of
 * magnitude, which is not something to put in front of a buyer.
 *
 * Dry run prints the headline numbers so they can be quoted in the emails.
 * --apply inserts the rows and prints the URLs.
 *
 * Usage:
 *   npx tsx scripts/cohort-sep2026-shares.ts            # dry run
 *   npx tsx scripts/cohort-sep2026-shares.ts --apply
 */

import { createClient } from '@supabase/supabase-js';
import { nanoid } from 'nanoid';
import { calculateDealTerms, type CalculationInput } from '@/lib/calculations';
import { ensureBenchmarksLoaded } from '@/lib/benchmarks';
import { buildShareProvenance } from '@/lib/financial/calculation-version';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const APPLY = process.argv.includes('--apply');
const BASE_URL = 'https://solidus.ambrosiaventures.co';
const OWNER_EMAIL = 'ikildani@ambrosiaventures.co';
const EXPIRES_DAYS = 90;

/** Calculator form defaults (components/calculator/useCalculatorState.ts). */
const BASE: Omit<CalculationInput, 'therapeuticArea' | 'phase' | 'dealType' | 'modality' | 'indication' | 'territory'> = {
  biomarker: 'unselected',
  lineOfTherapy: '2L',
  treatmentApproach: 'symptomatic',
  combinationPotential: 'some',
  competitivePosition: 'racing',
  dataQuality: 'promising',
  regulatoryDesignations: { breakthrough: false, fastTrack: false, orphan: false, prime: false },
} as never;

/** TA-specific defaults the form adds (buildCalculationInput). */
const TA_EXTRAS: Record<string, Record<string, unknown>> = {
  neurology: { bbbPenetration: 'unproven', diseaseProgression: 'moderateProgressive', biomarkerValidation: 'noBiomarker' },
  metabolic: {
    mechanismDifferentiation: 'incretinBased',
    weightLossEfficacy: 'competitiveEfficacy',
    routeOfAdministration: 'injectable',
    comorbidityBreadth: 'obesityPrimary',
    metabolicTreatmentApproach: 'chronicWeightMgmt',
  },
  womensHealth: { whTargetPopulation: 'reproductiveAge', whUnmetNeed: 'inadequateOptions', whRegulatory: 'standardPathway' },
};

interface Program {
  key: string;
  recipients: string[];
  input: Pick<CalculationInput, 'therapeuticArea' | 'phase' | 'dealType' | 'modality' | 'indication' | 'territory'> & {
    customAssumptions?: Record<string, unknown>;
  };
}

/** Exact programs each prospect benchmarked (calculations table, Sep 2026). */
const PROGRAMS: Program[] = [
  {
    key: 'huisheng-gastric-adc-codev',
    recipients: ['ellis.yuan@huishengvc.com', 'jason.zhang@huishengvc.com'],
    input: { therapeuticArea: 'oncology', phase: 'phase1', dealType: 'codevelopment', modality: 'adc', indication: 'gastric', territory: 'global' },
  },
  {
    key: 'isomorphic-pancreatic-ph2-acq',
    recipients: ['jstrafford@isomorphiclabs.com'],
    input: {
      therapeuticArea: 'oncology', phase: 'phase2', dealType: 'acquisition', modality: 'smallMolecule', indication: 'pancreatic', territory: 'global',
      customAssumptions: { peakSalesOverride: { low: 1000, median: 3000, high: 5000 } },
    },
  },
  {
    key: 'biper-gastric-ph2-license',
    recipients: ['mehdi.chelbi@biper-tx.com'],
    input: { therapeuticArea: 'oncology', phase: 'phase2', dealType: 'licensing', modality: 'smallMolecule', indication: 'gastric', territory: 'global' },
  },
  {
    key: 'eumederis-mash-ph3-glp1',
    recipients: ['jnestor@eumederis.com'],
    input: { therapeuticArea: 'metabolic', phase: 'phase3', dealType: 'licensing', modality: 'glp1Agonist', indication: 'nashMash', territory: 'global' },
  },
  {
    key: 'apogee-endometriosis-preclin',
    recipients: ['bhogg@apogeepharma.ca', 'kviswanadham@apogeepharma.ca'],
    input: { therapeuticArea: 'womensHealth', phase: 'preclinical', dealType: 'licensing', modality: 'smallMolecule', indication: 'endometriosis', territory: 'us_only' },
  },
  {
    key: 'annulus-schizophrenia-preclin',
    recipients: ['chirag@annulustx.com'],
    input: { therapeuticArea: 'neurology', phase: 'preclinical', dealType: 'licensing', modality: 'smallMolecule', indication: 'schizophrenia', territory: 'global' },
  },
];

const fm = (m: number | undefined | null) =>
  m == null || !Number.isFinite(m) ? '-' : m >= 1000 ? `$${(m / 1000).toFixed(2)}B` : `$${Math.round(m)}M`;

function buildInput(p: Program): CalculationInput {
  return {
    ...BASE,
    ...(TA_EXTRAS[p.input.therapeuticArea] || {}),
    ...p.input,
  } as CalculationInput;
}

async function main() {
  console.log(APPLY ? 'MODE: APPLY (inserting share rows)' : 'MODE: dry run (numbers only)');

  const { data: owner, error: ownerErr } = await supabase
    .from('user_profiles')
    .select('id, email, tier')
    .eq('email', OWNER_EMAIL)
    .single();
  if (ownerErr || !owner) throw new Error(`owner lookup failed: ${ownerErr?.message}`);
  console.log(`owner: ${owner.email} (${owner.tier})`);

  await ensureBenchmarksLoaded();

  for (const p of PROGRAMS) {
    const input = buildInput(p);
    const result = calculateDealTerms(input);
    const results = result as unknown as Record<string, unknown>;

    const t = result.terms as unknown as {
      upfront: { low: number; median: number; high: number };
      totalDealValue: { low: number; median: number; high: number };
      devMilestones?: { median: number };
      regMilestones?: { median: number };
      commMilestones?: { median: number };
    };
    console.log(`\n## ${p.key}  -> ${p.recipients.join(', ')}`);
    console.log(`   ${result.labels.phase} | ${result.labels.modality} | ${result.labels.indication} | ${input.dealType} | ${input.territory}`);
    console.log(`   upfront ${fm(t.upfront.median)} (${fm(t.upfront.low)}-${fm(t.upfront.high)}) | total ${fm(t.totalDealValue.median)} (${fm(t.totalDealValue.low)}-${fm(t.totalDealValue.high)})`);
    console.log(`   milestones dev ${fm(t.devMilestones?.median)} / reg ${fm(t.regMilestones?.median)} / comm ${fm(t.commMilestones?.median)} | royalty ${JSON.stringify(result.tieredRoyalties).slice(0, 160)}`);
    if (result.warnings?.length) console.log(`   warnings: ${result.warnings.map(w => (w as { message?: string }).message || JSON.stringify(w)).join(' | ')}`);

    if (!APPLY) continue;

    const shareToken = nanoid(12);
    const expiresAt = new Date(Date.now() + EXPIRES_DAYS * 86400000).toISOString();
    const inputsRecord = input as unknown as Record<string, unknown>;
    const row = {
      share_token: shareToken,
      user_id: owner.id,
      email: owner.email,
      inputs: inputsRecord,
      results,
      labels: result.labels,
      is_public: true,
      expires_at: expiresAt,
    };
    let { error } = await supabase
      .from('shared_calculations')
      .insert({ ...row, provenance: buildShareProvenance(inputsRecord, results) });
    if (error && (error.code === 'PGRST204' || (error.message ?? '').includes("'provenance' column"))) {
      ({ error } = await supabase.from('shared_calculations').insert(row));
    }
    if (error) {
      console.error(`   INSERT FAILED: ${error.message}`);
      continue;
    }
    console.log(`   URL: ${BASE_URL}/share/${shareToken}   (expires ${expiresAt.slice(0, 10)})`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
