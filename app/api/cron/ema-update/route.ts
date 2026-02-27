import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';
import { runEMAIngestion } from '@/lib/ingestion/ema-medicines';
import { captureApiError } from '@/lib/sentry-api';

export const maxDuration = 120;
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

    console.log('Starting EMA medicines update...');
    const result = await runEMAIngestion(supabase);

    console.log(`EMA update complete. Processed: ${result.processed}, Inserted: ${result.inserted}, Enriched: ${result.enriched}, Errors: ${result.errors.length}`);

    return NextResponse.json({
      success: true,
      processed: result.processed,
      inserted: result.inserted,
      enriched: result.enriched,
      errors: result.errors.length,
      error_details: result.errors.slice(0, 10),
    });
  } catch (error) {
    captureApiError(error, 'cron/ema-update');
    return NextResponse.json({ error: 'EMA update failed' }, { status: 500 });
  }
}
