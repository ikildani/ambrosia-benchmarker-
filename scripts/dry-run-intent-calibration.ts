/**
 * Dry-run the intent calibration that would fire Wednesday 3am UTC.
 * Executes calibrateIntentWeights() against production Supabase with the
 * cleaned corpus to verify it doesn't throw, and prints the resulting
 * weights + accuracy estimate so we know the Wednesday cron will succeed.
 *
 * Does NOT write to the intent_calibration_results table — that's the
 * cron's job. This is read-only (internal computation only).
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
  console.log('Dry-running calibrateIntentWeights() against production...');
  const t0 = Date.now();
  const result = await calibrateIntentWeights(supabase);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  console.log(`\nCompleted in ${elapsed}s.\n`);
  console.log(`Sample size:       ${result.sampleSize}`);
  console.log(`Positive samples:  ${result.positiveSamples}`);
  console.log(`Negative samples:  ${result.negativeSamples}`);
  console.log(`Accuracy estimate: ${(result.accuracyEstimate * 100).toFixed(1)}%`);
  console.log(`Calibrated at:     ${result.calibratedAt}`);
  console.log('\nCalibrated weights:');
  for (const [factor, weight] of Object.entries(result.weights)) {
    console.log(`  ${factor.padEnd(20)} ${(weight as number).toFixed(4)}`);
  }
  console.log('\nFactor correlations with positive outcome:');
  for (const [factor, corr] of Object.entries(result.factorCorrelations)) {
    console.log(`  ${factor.padEnd(20)} r=${(corr as number).toFixed(3)}`);
  }
}

main().catch((err) => {
  console.error('FAILED:', err);
  process.exit(1);
});
