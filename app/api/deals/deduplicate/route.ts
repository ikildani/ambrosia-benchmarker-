/**
 * API Route: Fuzzy Deduplication via Embeddings
 *
 * Uses pgvector cosine similarity to find deal pairs that are likely
 * the same deal described differently. Flags or merges duplicates.
 *
 * POST /api/deals/deduplicate?threshold=0.95&dryRun=true
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { verifyAdminAuth } from '@/lib/admin-auth';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const authError = await verifyAdminAuth(request);
  if (authError) return authError;

  const supabase = createServiceClient();
  const url = new URL(request.url);
  const threshold = parseFloat(url.searchParams.get('threshold') || '0.93');
  const dryRun = url.searchParams.get('dryRun') !== 'false';

  // Find deals with embeddings
  const { data: deals } = await supabase
    .from('deals')
    .select('id, licensor_name, licensee_name, asset_name, announced_date, therapeutic_area, upfront_usd, total_deal_value_usd, confidence_score, embedding')
    .not('embedding', 'is', null)
    .not('therapeutic_area', 'in', '("other","_option_deals","_codev_deals","_china_deals")')
    .order('confidence_score', { ascending: false })
    .limit(500);

  if (!deals || deals.length < 2) {
    return NextResponse.json({ success: true, duplicates: [], message: 'Not enough embedded deals' });
  }

  // For each deal, find its nearest neighbor using SQL
  const duplicatePairs: Array<{
    deal1: { id: string; parties: string; asset: string; date: string; value: number | null };
    deal2: { id: string; parties: string; asset: string; date: string; value: number | null };
    similarity: number;
    action: string;
  }> = [];

  // Use a simpler approach: query for similar deals per deal using RPC
  for (const deal of deals.slice(0, 100)) { // Check first 100 deals
    if (!deal.embedding) continue;

    const { data: similar } = await supabase.rpc('match_deals', {
      query_embedding: deal.embedding,
      match_count: 5,
      match_threshold: threshold,
    });

    if (!similar) continue;

    for (const match of similar) {
      if (match.id === deal.id) continue; // Skip self-match
      if (duplicatePairs.some(p => (p.deal1.id === match.id && p.deal2.id === deal.id))) continue; // Skip reverse pairs

      // Additional validation: same TA, similar year
      const dealYear = new Date(deal.announced_date).getFullYear();
      const matchYear = match.announced_date ? new Date(match.announced_date).getFullYear() : 0;
      if (match.therapeutic_area !== deal.therapeutic_area) continue;
      if (Math.abs(dealYear - matchYear) > 2) continue;

      duplicatePairs.push({
        deal1: {
          id: deal.id,
          parties: `${deal.licensor_name} / ${deal.licensee_name}`,
          asset: deal.asset_name || 'N/A',
          date: deal.announced_date,
          value: deal.total_deal_value_usd,
        },
        deal2: {
          id: match.id,
          parties: `${match.licensor_name} / ${match.licensee_name}`,
          asset: match.asset_name || 'N/A',
          date: match.announced_date,
          value: match.total_deal_value_usd,
        },
        similarity: match.similarity,
        action: dryRun ? 'would_remove_lower_confidence' : 'removed',
      });

      // If not dry run, delete the lower-confidence duplicate
      if (!dryRun) {
        const keepId = (deal.confidence_score || 0) >= (match.confidence_score || 0) ? deal.id : match.id;
        const removeId = keepId === deal.id ? match.id : deal.id;
        await supabase.from('deals').delete().eq('id', removeId);
      }
    }
  }

  return NextResponse.json({
    success: true,
    dryRun,
    threshold,
    dealsChecked: Math.min(deals.length, 100),
    duplicatesFound: duplicatePairs.length,
    duplicates: duplicatePairs.slice(0, 50), // Return first 50 for review
  });
}
