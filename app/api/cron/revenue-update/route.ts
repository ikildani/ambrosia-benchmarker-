import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';
import { runXBRLRevenueUpdate } from '@/lib/ingestion/sec-xbrl';
import { runProductRevenueExtraction } from '@/lib/ingestion/sec-revenue-extraction';

export const maxDuration = 300; // 5 minutes max
export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/revenue-update
 *
 * Quarterly cron job that updates company revenue data:
 * - Tier 1: XBRL CompanyFacts annual revenue for all tracked companies
 * - Tier 2: Claude-powered product-level revenue extraction for top 20 companies
 *
 * Auth: Bearer $CRON_SECRET (timing-safe comparison)
 */
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

    // Tier 1: XBRL annual revenue for all companies
    console.log('[revenue-cron] Tier 1: XBRL revenue update...');
    const xbrlResult = await runXBRLRevenueUpdate(supabase);
    console.log(
      `[revenue-cron] Tier 1 complete: ${xbrlResult.updated} updated, ${xbrlResult.skipped_anomalies} anomalies`
    );

    // Tier 2: Product-level revenue extraction for top 20
    console.log('[revenue-cron] Tier 2: Product revenue extraction (top 20)...');
    const productResult = await runProductRevenueExtraction(supabase, { topCompanies: 20 });
    console.log(
      `[revenue-cron] Tier 2 complete: ${productResult.products_extracted} products from ${productResult.companies_processed} companies`
    );

    return NextResponse.json({
      success: true,
      tier1_xbrl: {
        processed: xbrlResult.processed,
        updated: xbrlResult.updated,
        skipped_anomalies: xbrlResult.skipped_anomalies,
        errors: xbrlResult.errors.length,
      },
      tier2_product: {
        companies_processed: productResult.companies_processed,
        products_extracted: productResult.products_extracted,
        patent_cliffs_updated: productResult.patent_cliffs_updated,
        errors: productResult.errors.length,
      },
    });
  } catch (error) {
    console.error('[revenue-cron] Error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
