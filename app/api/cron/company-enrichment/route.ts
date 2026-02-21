import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';
import { runCompanyEnrichment } from '@/lib/ingestion/company-enrichment';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  // Security: Require cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error('CRON_SECRET environment variable is not set');
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
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

    console.log('Starting company enrichment cron...');
    const result = await runCompanyEnrichment(supabase);

    console.log(
      `Company enrichment cron complete: ${result.companies_processed} processed, ${result.stats_updated} stats updated, ${result.appetite_updated} appetite updated, ${result.errors.length} errors`
    );

    return NextResponse.json({
      success: true,
      companies_processed: result.companies_processed,
      stats_updated: result.stats_updated,
      appetite_updated: result.appetite_updated,
      errors: result.errors.length,
      error_details: result.errors.length > 0 ? result.errors.slice(0, 20) : undefined,
    });
  } catch (error) {
    console.error('Company enrichment cron error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
