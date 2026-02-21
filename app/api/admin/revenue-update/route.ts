import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { runXBRLRevenueUpdate } from '@/lib/ingestion/sec-xbrl';
import { runProductRevenueExtraction } from '@/lib/ingestion/sec-revenue-extraction';

export const maxDuration = 300; // 5 minutes max
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/revenue-update
 *
 * Admin endpoint for on-demand revenue updates.
 * Query params:
 *   ?tier=1  — XBRL annual revenue only
 *   ?tier=2  — Claude product extraction only
 *   (no param) — both tiers
 *
 * Auth: Bearer $ADMIN_API_KEY
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const adminApiKey = process.env.ADMIN_API_KEY;

  if (!adminApiKey) {
    return NextResponse.json({ error: 'ADMIN_API_KEY not configured' }, { status: 500 });
  }

  if (!authHeader || authHeader !== `Bearer ${adminApiKey}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const supabase = createServiceClient();
    const tier = request.nextUrl.searchParams.get('tier');

    const results: Record<string, unknown> = {};

    // Tier 1: XBRL annual revenue
    if (!tier || tier === '1') {
      console.log('[admin/revenue] Running Tier 1: XBRL revenue update...');
      const xbrlResult = await runXBRLRevenueUpdate(supabase);
      results.tier1_xbrl = {
        processed: xbrlResult.processed,
        updated: xbrlResult.updated,
        skipped_anomalies: xbrlResult.skipped_anomalies,
        errors: xbrlResult.errors.slice(0, 20),
      };
      console.log(`[admin/revenue] Tier 1 complete: ${xbrlResult.updated} updated`);
    }

    // Tier 2: Claude product-level extraction
    if (!tier || tier === '2') {
      console.log('[admin/revenue] Running Tier 2: Product revenue extraction...');
      const productResult = await runProductRevenueExtraction(supabase);
      results.tier2_product = {
        companies_processed: productResult.companies_processed,
        products_extracted: productResult.products_extracted,
        patent_cliffs_updated: productResult.patent_cliffs_updated,
        errors: productResult.errors.slice(0, 20),
      };
      console.log(`[admin/revenue] Tier 2 complete: ${productResult.products_extracted} products`);
    }

    return NextResponse.json({
      success: true,
      tier: tier || 'both',
      ...results,
    });
  } catch (error) {
    console.error('[admin/revenue] Error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
