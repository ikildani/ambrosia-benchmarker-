import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';
import { runWeeklyIngestion } from '@/lib/ingestion/clinical-trials';

export const maxDuration = 300; // 5 minutes max
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

  const isValid = isValidLength && timingSafeEqual(
    Buffer.from(tokenToCompare),
    Buffer.from(expectedToken)
  );

  if (!isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createServiceClient();

    const result = await runWeeklyIngestion(supabase, { batchSize: 30 });

    return NextResponse.json({
      success: true,
      companies: result.companies,
      trials: result.trials,
      batch_info: result.batch_info,
      errors: result.errors.length,
      error_details: result.errors.slice(0, 10),
    });
  } catch (error) {
    console.error('Clinical trials update error:', error);
    return NextResponse.json({ error: 'Clinical trials update failed' }, { status: 500 });
  }
}
