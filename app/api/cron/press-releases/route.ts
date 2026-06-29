import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';
import { runPressReleaseIngestion } from '@/lib/ingestion/press-releases';
import { logCronRun, reclassifyOtherDeals } from '@/lib/cron-utils';
import { notifyHighValueDeal } from '@/lib/slack/notify';
import { runCronIntelligence } from '@/lib/cron-intelligence';

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

    const result = await runPressReleaseIngestion(supabase, anthropicApiKey, {
      maxArticlesPerSource: 15,
      timeBudgetMs: 250_000, // 250s safe margin for 300s Vercel limit
    });

    const durationMs = Date.now() - startTime;

    // Post-processing: reclassify 'other' deals and log
    if (result.deals_inserted > 0) {
      await reclassifyOtherDeals(supabase);

      // Alert on high-value deals ($500M+)
      const { data: newBigDeals } = await supabase
        .from('deals')
        .select('licensee_name, licensor_name, asset_name, total_deal_value_usd, deal_type, therapeutic_area, announced_date')
        .gte('created_at', new Date(startTime).toISOString())
        .gte('total_deal_value_usd', 500000000)
        .order('total_deal_value_usd', { ascending: false });

      if (newBigDeals && newBigDeals.length > 0) {
        for (const deal of newBigDeals) {
          await notifyHighValueDeal({
            licensee: deal.licensee_name,
            licensor: deal.licensor_name,
            asset: deal.asset_name || 'Undisclosed',
            totalValue: deal.total_deal_value_usd,
            dealType: deal.deal_type,
            therapeuticArea: deal.therapeutic_area,
            announcedDate: deal.announced_date,
          }).catch(err => console.error('[Press Releases] Slack alert error:', err));
        }
      }
    }

    await logCronRun(supabase, 'press_releases_cron', {
      fetched: result.articles_found,
      processed: result.potential_deals,
      inserted: result.deals_inserted,
      errors: result.errors,
    });

    // Diagnostic log: if we processed many items but inserted none, log skip reasons
    if (result.deals_inserted === 0 && result.potential_deals > 10) {
      const skipBreakdown = {
        totalArticlesFound: result.articles_found,
        potentialDeals: result.potential_deals,
        dealsExtracted: result.deals_extracted,
        dealsInserted: result.deals_inserted,
        errorCount: result.errors.length,
        topErrors: result.errors.slice(0, 5),
        likelyCause: result.deals_extracted === 0
          ? 'extraction_failure: Claude failed to extract deals from articles'
          : result.deals_extracted > 0 && result.deals_inserted === 0
            ? 'dedup_or_validation: deals extracted but rejected by validation or duplicate check'
            : 'unknown',
      };
      console.log(
        `[press-releases] Processed ${result.potential_deals} but inserted 0. Breakdown:`,
        JSON.stringify(skipBreakdown, null, 2)
      );
    }

    // Run cron intelligence
    const healthReport = await runCronIntelligence(supabase, 'press_releases_cron', {
      processed: result.potential_deals,
      inserted: result.deals_inserted,
      skipped: result.potential_deals - result.deals_inserted - result.errors.length,
      errors: result.errors.length,
    });

    return NextResponse.json({
      success: true,
      durationMs,
      sources_checked: result.sources_checked,
      articles_found: result.articles_found,
      potential_deals: result.potential_deals,
      deals_extracted: result.deals_extracted,
      deals_inserted: result.deals_inserted,
      errors: result.errors.length,
      error_details: result.errors.slice(0, 10),
      health: healthReport.status,
      recommendation: healthReport.recommendation,
    });
  } catch (error) {
    console.error('Daily press release ingestion error:', error);
    return NextResponse.json(
      { error: 'Press release ingestion failed', details: String(error) },
      { status: 500 }
    );
  }
}
