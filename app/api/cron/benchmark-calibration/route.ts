import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';
import { runBenchmarkCalibration } from '@/lib/ingestion/benchmark-calibration';
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

    const result = await runBenchmarkCalibration(supabase);

    // Intelligence tracking
    try {
      await runCronIntelligence(supabase, 'benchmark-calibration', {
        processed: 1,
        inserted: 0,
      });
    } catch {}

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Benchmark calibration cron error:', error);
    return NextResponse.json({ error: 'Benchmark calibration failed' }, { status: 500 });
  }
}
