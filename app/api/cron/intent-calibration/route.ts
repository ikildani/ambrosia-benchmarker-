import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { calibrateIntentWeights } from '@/lib/services/pharma-intent-calibration';
import { timingSafeEqual } from 'crypto';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Security: Require cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error('CRON_SECRET environment variable is not set');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const expectedToken = `Bearer ${cronSecret}`;
  const providedToken = authHeader || '';

  const isValidLength = providedToken.length === expectedToken.length;
  const tokenToCompare = isValidLength ? providedToken : expectedToken;

  const isValid =
    isValidLength &&
    timingSafeEqual(Buffer.from(tokenToCompare), Buffer.from(expectedToken));

  if (!isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createServiceClient();
    console.log('[IntentCalibration] Starting weight calibration from historical deals...');

    const result = await calibrateIntentWeights(supabase);

    console.log('[IntentCalibration] Calibration complete:', {
      sampleSize: result.sampleSize,
      positiveSamples: result.positiveSamples,
      negativeSamples: result.negativeSamples,
      accuracyEstimate: result.accuracyEstimate,
      weights: result.weights,
    });

    // Store results in the calibration table
    const { error: insertError } = await supabase
      .from('intent_calibration_results')
      .insert({
        calibrated_weights: result.weights,
        sample_size: result.sampleSize,
        positive_samples: result.positiveSamples,
        negative_samples: result.negativeSamples,
        factor_correlations: result.factorCorrelations,
        accuracy_estimate: result.accuracyEstimate,
        notes: `Calibrated at ${result.calibratedAt}. Accuracy: ${(result.accuracyEstimate * 100).toFixed(1)}%`,
      });

    if (insertError) {
      console.error('[IntentCalibration] Failed to store results:', insertError.message);
      // Still return success — calibration worked, storage failed
      return NextResponse.json({
        success: true,
        stored: false,
        error: insertError.message,
        result,
      });
    }

    console.log('[IntentCalibration] Results stored in intent_calibration_results table');

    return NextResponse.json({
      success: true,
      stored: true,
      result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[IntentCalibration] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
