import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';
import { runBenchmarkCalibration } from '@/lib/ingestion/benchmark-calibration';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // Auth: require ADMIN_API_KEY Bearer token (timing-safe comparison)
  const authHeader = request.headers.get('authorization');
  const adminKey = process.env.ADMIN_API_KEY;

  if (!adminKey) {
    console.error('ADMIN_API_KEY environment variable is not set');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const token = authHeader?.replace('Bearer ', '') || '';

  const isValidLength = token.length === adminKey.length;
  const tokenToCompare = isValidLength ? token : adminKey;

  const isValid = isValidLength && timingSafeEqual(
    Buffer.from(tokenToCompare),
    Buffer.from(adminKey)
  );

  if (!isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const dryRun = searchParams.get('dryRun') === 'true';

    const supabase = createServiceClient();

    console.log(`Starting admin benchmark calibration (dryRun=${dryRun})...`);
    const result = await runBenchmarkCalibration(supabase, { dryRun });

    console.log(
      `Admin benchmark calibration complete: ${result.phaseBaselinesUpdated} baselines, ` +
      `${result.modalityMultipliersUpdated} multipliers, ${result.errors.length} errors`
    );

    return NextResponse.json({
      success: true,
      dryRun,
      ...result,
    });
  } catch (error) {
    console.error('Admin benchmark calibration error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
