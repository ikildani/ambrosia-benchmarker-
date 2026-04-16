/**
 * Bootstrap the intent_calibration_results table.
 *
 * The Wednesday 3am UTC cron runs calibrateIntentWeights() and stores
 * results. Until that first cron fires, the table is empty and R70's
 * getCalibratedIntentWeights() falls back to hardcoded W.
 *
 * This script runs the calibration + insert NOW so the feedback loop
 * is live immediately instead of waiting for the next Wednesday.
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { calibrateIntentWeights } from '@/lib/services/pharma-intent-calibration';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing SUPABASE credentials in .env.local');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function main() {
  console.log('Running calibrateIntentWeights() and writing result...');
  const result = await calibrateIntentWeights(supabase);
  console.log(
    `  sample ${result.sampleSize} (${result.positiveSamples}+ / ${result.negativeSamples}-), accuracy ${(result.accuracyEstimate * 100).toFixed(1)}%`,
  );

  const { error } = await supabase.from('intent_calibration_results').insert({
    calibrated_weights: result.weights,
    sample_size: result.sampleSize,
    positive_samples: result.positiveSamples,
    negative_samples: result.negativeSamples,
    factor_correlations: result.factorCorrelations,
    accuracy_estimate: result.accuracyEstimate,
    notes: `Bootstrap R70 at ${result.calibratedAt}. Cleaned corpus post-R51/R53.`,
  });

  if (error) {
    console.error('Insert failed:', error.message);
    process.exit(1);
  }
  console.log('Inserted calibration row. Feedback loop is now live.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
