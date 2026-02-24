import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { runBenchmarkCalibration } from '@/lib/ingestion/benchmark-calibration';
import { verifyAdminAuth } from '@/lib/admin-auth';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // Admin auth: timing-safe Bearer token or authenticated admin email
  const authError = await verifyAdminAuth(request);
  if (authError) return authError;

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
