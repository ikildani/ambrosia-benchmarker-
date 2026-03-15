/**
 * API Route: Ingest Extended Comparable Deals into DB
 * Maps deals from data/comparable-deals-extended.ts → deals table
 * POST /api/deals/ingest-extended
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { verifyAdminAuth } from '@/lib/admin-auth';
import { EXTENDED_COMPARABLE_DEALS } from '@/data/comparable-deals-extended';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

// Parse royalty range string → numeric low/high
function parseRoyaltyRange(range?: string): { low: number | null; high: number | null } {
  if (!range) return { low: null, high: null };
  const s = range.toLowerCase();

  const rangeMap: Record<string, [number, number]> = {
    'low-single': [1, 4],
    'mid-single': [4, 6],
    'high-single': [7, 9],
    'low-double': [10, 14],
    'mid-double': [15, 19],
    'high-double': [20, 25],
    'low-teen': [10, 13],
    'mid-teen': [14, 16],
    'high-teen': [17, 19],
  };

  let low: number | null = null;
  let high: number | null = null;

  for (const [key, [lo, hi]] of Object.entries(rangeMap)) {
    if (s.includes(key)) {
      if (low === null || lo < low) low = lo;
      if (high === null || hi > high) high = hi;
    }
  }

  // Try to extract explicit percentages like "5%-15%"
  const pctMatch = s.match(/(\d+(?:\.\d+)?)\s*%?\s*(?:to|-)\s*(\d+(?:\.\d+)?)\s*%/);
  if (pctMatch) {
    low = parseFloat(pctMatch[1]);
    high = parseFloat(pctMatch[2]);
  }

  return { low, high };
}

// Normalize phase format
function normalizePhase(phase: string): string {
  const map: Record<string, string> = {
    'phase1': 'phase_1',
    'phase2': 'phase_2',
    'phase3': 'phase_3',
    'phase1_2': 'phase_1',
    'phase2_3': 'phase_2',
    'preclinical': 'preclinical',
    'approved': 'approved',
    'discovery': 'discovery',
  };
  return map[phase] || phase;
}

// Normalize deal type
function normalizeDealType(dt: string): string {
  const map: Record<string, string> = {
    'licensing': 'license',
    'codevelopment': 'co_development',
    'collaboration': 'collaboration',
    'acquisition': 'acquisition',
    'option': 'option',
  };
  return map[dt] || dt;
}

export async function POST(request: NextRequest) {
  const authError = await verifyAdminAuth(request);
  if (authError) return authError;

  const supabase = createServiceClient();

  const results = {
    total: EXTENDED_COMPARABLE_DEALS.length,
    inserted: 0,
    skipped: 0,
    errors: [] as string[],
    byTA: {} as Record<string, number>,
  };

  // Batch insert in groups of 50
  const BATCH_SIZE = 50;
  for (let i = 0; i < EXTENDED_COMPARABLE_DEALS.length; i += BATCH_SIZE) {
    const batch = EXTENDED_COMPARABLE_DEALS.slice(i, i + BATCH_SIZE);

    const rows = batch.map(deal => {
      const royalty = parseRoyaltyRange(deal.royaltyRange);
      const announcedDate = `${deal.year}-07-01`;
      const ta = deal.therapeuticArea;

      return {
        licensor_name: deal.licensor,
        licensee_name: deal.licensee,
        asset_name: deal.indication_specific || deal.indication_category,
        asset_description: deal.headline,
        modality: deal.modality,
        indication_category: deal.indication_category,
        indication_specific: deal.indication_specific,
        phase_at_signing: normalizePhase(deal.phase),
        territory: deal.territory || 'global',
        deal_type: normalizeDealType(deal.dealType),
        upfront_usd: deal.upfront ? deal.upfront * 1_000_000 : null,
        milestones_total_usd: deal.milestones ? deal.milestones * 1_000_000 : null,
        total_deal_value_usd: deal.totalDealValue ? deal.totalDealValue * 1_000_000 : null,
        royalty_low_pct: royalty.low,
        royalty_high_pct: royalty.high,
        announced_date: announcedDate,
        source_type: 'manual',
        terms_disclosed: deal.upfront > 0 || (deal.milestones ?? 0) > 0,
        confidence_score: 90,
        verified: true,
        therapeutic_area: ta,
        extraction_notes: deal.keyTerms || null,
        extraction_model: 'manual_curation',
      };
    });

    const { data, error } = await supabase
      .from('deals')
      .upsert(rows, {
        onConflict: 'licensor_name,licensee_name,asset_name,announced_date',
        ignoreDuplicates: true,
      })
      .select('therapeutic_area');

    if (error) {
      results.errors.push(`Batch ${Math.floor(i / BATCH_SIZE)}: ${error.message}`);
    } else if (data) {
      results.inserted += data.length;
      for (const row of data) {
        const ta = row.therapeutic_area || 'unknown';
        results.byTA[ta] = (results.byTA[ta] || 0) + 1;
      }
    }
  }

  results.skipped = results.total - results.inserted - results.errors.length;

  // Log ingestion
  await supabase.from('data_ingestion_log').insert({
    source: 'extended_comparable_deals',
    run_type: 'manual',
    parameters: { total_deals: results.total },
    records_fetched: results.total,
    records_processed: results.total,
    records_inserted: results.inserted,
    records_failed: results.errors.length,
    errors: results.errors.slice(0, 50),
    status: 'completed',
    completed_at: new Date().toISOString(),
  });

  return NextResponse.json({ success: true, ...results });
}
