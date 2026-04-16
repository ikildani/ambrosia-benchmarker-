/**
 * End-to-end verification that the R70 feedback loop is live:
 *   1. getCalibratedIntentWeights() reads the latest calibration row
 *   2. Confidence gates pass (accuracy/sample/age)
 *   3. 9-factor → 10-factor mapping produces weights summing to 1.0
 *   4. Returned source is 'calibrated', not 'hardcoded_baseline'
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { getCalibratedIntentWeights } from '@/lib/services/pharma-intent';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function main() {
  const r = await getCalibratedIntentWeights(supabase);
  console.log('source:', r.source);
  if (r.fallbackReason) console.log('fallbackReason:', r.fallbackReason);
  if (r.calibratedAt) console.log('calibratedAt:', r.calibratedAt);
  if (r.accuracyEstimate) console.log('accuracyEstimate:', (r.accuracyEstimate * 100).toFixed(1) + '%');
  if (r.sampleSize) console.log('sampleSize:', r.sampleSize);

  const total = Object.values(r.weights).reduce((a, b) => a + b, 0);
  console.log('\nWeights (sum =', total.toFixed(4) + '):');
  for (const [k, v] of Object.entries(r.weights)) {
    console.log(`  ${k.padEnd(20)} ${(v as number).toFixed(4)}`);
  }

  if (r.source !== 'calibrated') {
    console.error('\n❌ Feedback loop not live — source is not "calibrated".');
    process.exit(1);
  }
  if (Math.abs(total - 1.0) > 0.001) {
    console.error('\n❌ Weights do not sum to 1.0.');
    process.exit(1);
  }
  console.log('\n✓ Feedback loop verified: live calls will use calibrated weights.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
