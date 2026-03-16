import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';
import { runPressReleaseIngestion } from '@/lib/ingestion/press-releases';
import { logCronRun, reclassifyOtherDeals } from '@/lib/cron-utils';

export const maxDuration = 300; // 5 minutes max
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Security: Require cron secret (same pattern as deals-update)
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
    const startTime = Date.now();
    const supabase = createServiceClient();
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

    if (!anthropicApiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
    }

    console.log('Starting daily press release ingestion...');

    const result = await runPressReleaseIngestion(supabase, anthropicApiKey, {
      maxArticlesPerSource: 15,
      timeBudgetMs: 250_000, // 250s safe margin for 300s Vercel limit
    });

    const durationMs = Date.now() - startTime;

    // Post-processing: reclassify 'other' deals and log
    if (result.deals_inserted > 0) {
      const reclassified = await reclassifyOtherDeals(supabase);
      if (reclassified > 0) console.log(`Reclassified ${reclassified} 'other' deals`);
    }

    await logCronRun(supabase, 'press_releases_cron', {
      fetched: result.articles_found,
      processed: result.potential_deals,
      inserted: result.deals_inserted,
      errors: result.errors,
    });

    console.log(`Press release ingestion complete in ${(durationMs / 1000).toFixed(1)}s: ${result.deals_inserted} deals inserted from ${result.sources_checked} sources`);

    return NextResponse.json({
      success: true,
      durationMs,
      sources_checked: result.sources_checked,
      articles_found: result.articles_found,
      potential_deals: result.potential_deals,
      deals_extracted: result.deals_extracted,
      deals_inserted: result.deals_inserted,
      errors: result.errors.length,
      error_details: result.errors.slice(0, 10), // First 10 errors for debugging
    });
  } catch (error) {
    console.error('Daily press release ingestion error:', error);
    return NextResponse.json(
      { error: 'Press release ingestion failed', details: String(error) },
      { status: 500 }
    );
  }
}
