import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';
import { runNIHReporterIngestion } from '@/lib/ingestion/nih-reporter';
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
    const currentYear = new Date().getFullYear();

    let nihResult = { projects_found: 0, projects_inserted: 0, total_funding_usd: 0, errors: [] as string[] };
    try {
      nihResult = await runNIHReporterIngestion(supabase, {
        fiscalYears: [currentYear, currentYear - 1],
        maxPerSearch: 50,
      });
    } catch (error) {
      console.error('NIH RePORTER ingestion error:', error);
    }

    // Intelligence tracking
    try {
      await runCronIntelligence(supabase, 'funding-update', {
        processed: nihResult.projects_found,
        inserted: nihResult.projects_inserted,
      });
    } catch {}

    return NextResponse.json({
      success: true,
      nih: {
        found: nihResult.projects_found,
        inserted: nihResult.projects_inserted,
        total_funding_usd: nihResult.total_funding_usd,
        errors: nihResult.errors.length,
      },
    });
  } catch (error) {
    console.error('Funding update error:', error);
    return NextResponse.json({ error: 'Funding update failed' }, { status: 500 });
  }
}
