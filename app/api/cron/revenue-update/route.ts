import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';
import { runXBRLRevenueUpdate } from '@/lib/ingestion/sec-xbrl';
import { runProductRevenueExtraction } from '@/lib/ingestion/sec-revenue-extraction';
import { captureApiError } from '@/lib/sentry-api';

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
    const xbrlResult = await runXBRLRevenueUpdate(supabase);

    // Tier 2: Product-level revenue extraction for top 20
    const productResult = await runProductRevenueExtraction(supabase, { topCompanies: 20 });

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
    captureApiError(error, 'cron-revenue-update');
    return NextResponse.json({ error: 'Revenue update failed' }, { status: 500 });
  }
}
