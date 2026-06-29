import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';
import { runPatentIngestion } from '@/lib/ingestion/patents';
import { runCronIntelligence } from '@/lib/cron-intelligence';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
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

    let patentResult = { patents_found: 0, patents_inserted: 0, errors: [] as string[] };
    try {
      patentResult = await runPatentIngestion(supabase, {
        daysBack: 30,
        maxPerAssignee: 25,
      });
    } catch (error) {
      console.error('Patent ingestion error:', error);
    }

    // Intelligence tracking
    try {
      await runCronIntelligence(supabase, 'patents-update', {
        processed: patentResult.patents_found,
        inserted: patentResult.patents_inserted,
      });
    } catch {}

    return NextResponse.json({
      success: true,
      patents: {
        found: patentResult.patents_found,
        inserted: patentResult.patents_inserted,
        errors: patentResult.errors.length,
      },
    });
  } catch (error) {
    console.error('Patent update error:', error);
    return NextResponse.json({ error: 'Patent update failed' }, { status: 500 });
  }
}
