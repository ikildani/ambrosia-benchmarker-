import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';
import { runBenchmarkCalibration, type DealRow } from '@/lib/ingestion/benchmark-calibration';
import { loadClientObservations, observationsToDealRows } from '@/lib/outcomes/priors';
import { runCronIntelligence } from '@/lib/cron-intelligence';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Security: Require cron secret (timing-safe comparison)
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

  const isValid = isValidLength && timingSafeEqual(
    Buffer.from(tokenToCompare),
    Buffer.from(expectedToken)
  );

  if (!isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createServiceClient();

    // Outcome priors: client-reported signed terms (no deal row) join the
    // phase-baseline grouping under the k-anonymity guards in
    // computePhaseBaselines. A failure here never blocks the calibration.
    let extraObservations: DealRow[] = [];
    let observationsError: string | null = null;
    try {
      extraObservations = observationsToDealRows(await loadClientObservations(supabase));
    } catch (e) {
      observationsError = e instanceof Error ? e.message : String(e);
      console.warn('[Outcomes] benchmark-calibration: observations unavailable:', observationsError);
    }

    const result = await runBenchmarkCalibration(supabase, { extraObservations });
    if (observationsError) result.errors.push(`client observations unavailable: ${observationsError}`);

    // Intelligence tracking
    try {
      await runCronIntelligence(supabase, 'benchmark-calibration', {
        processed: 1,
        inserted: 0,
      });
    } catch {}

    return NextResponse.json({
      success: true,
      observationsOffered: extraObservations.length,
      ...result,
    });
  } catch (error) {
    console.error('Benchmark calibration cron error:', error);
    return NextResponse.json({ error: 'Benchmark calibration failed' }, { status: 500 });
  }
}
