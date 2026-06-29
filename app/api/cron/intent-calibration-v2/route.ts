// Pharma Intent Calibration V2 — Cron + Manual Trigger Endpoint
// Runs the improved backtest (temporal holdout, logistic regression, 10
// production factors, time-decay + interactions) and stores results.
//
// Auth: Requires Bearer CRON_SECRET like other cron endpoints.

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { runBacktestV2 } from '@/lib/services/pharma-intent-backtest-v2';
import { timingSafeEqual } from 'crypto';
import { runCronIntelligence } from '@/lib/cron-intelligence';

export const maxDuration = 300; // 5 minutes — backtest can take a while
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
    const startTime = Date.now();
    const result = await runBacktestV2(supabase);
    const elapsedMs = Date.now() - startTime;

    // Store results in v2 table (falls back gracefully if table doesn't exist yet)
    const { error: insertError } = await supabase
      .from('intent_calibration_v2_results')
      .insert({
        calibrated_at: result.calibratedAt,
        config: result.config,
        data_stats: result.dataStats,
        sample_stats: result.sampleStats,
        metrics: result.metrics,
        feature_importance: result.featureImportance,
        calibrated_production_weights: result.calibratedProductionWeights,
        weight_shift: result.weightShift,
        elapsed_ms: elapsedMs,
      });

    // Intelligence tracking
    try {
      await runCronIntelligence(supabase, 'intent-calibration-v2', {
        processed: 1,
        inserted: 0,
      });
    } catch {}

    return NextResponse.json({
      success: true,
      stored: !insertError,
      storageError: insertError?.message,
      elapsedMs,
      result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[IntentCalibrationV2] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
