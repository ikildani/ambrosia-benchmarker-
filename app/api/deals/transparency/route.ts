/**
 * Deal Transparency API
 *
 * Returns the actual deals from the database that match a user's calculation
 * inputs — with full financial terms. This is the "show me the data" endpoint
 * that lets Pro users drill into the raw transactions behind their estimates.
 *
 * Free users: count + statistical summary only (no individual deals)
 * Pro/Portfolio: up to 50 deals with full terms + source URLs
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  scoreCompMatch,
  selectWithRelaxation,
  shouldExcludeForStage,
  computeCompStats,
  type CompRelaxation,
} from '@/lib/comparable-scoring';

export const dynamic = 'force-dynamic';

async function resolveUserTier(request: NextRequest, supabase: ReturnType<typeof createServiceClient>): Promise<string> {
  // Cookie auth
  try {
    const { createServerClient } = await import('@/lib/supabase/server');
    const authClient = await createServerClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (user?.id) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('tier')
        .eq('id', user.id)
        .single();
      const tier = profile?.tier || 'free';
      if (tier !== 'free') return tier;
      if (user.email) {
        const { isProEmailClient } = await import('@/lib/config/authorized-emails.client');
        if (isProEmailClient(user.email)) return 'pro';
      }
    }
  } catch {}

  // Email fallback
  const emailParam = new URL(request.url).searchParams.get('email');
  if (emailParam) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('tier')
      .eq('email', emailParam.toLowerCase().trim())
      .maybeSingle();
    if (profile?.tier === 'pro' || profile?.tier === 'report' || profile?.tier === 'portfolio') {
      return profile.tier;
    }
  }

  return 'free';
}

interface TransparencyDeal {
  id: string;
  licensor_name: string | null;
  licensee_name: string | null;
  asset_name: string | null;
  announced_date: string | null;
  phase_at_signing: string | null;
  modality: string | null;
  deal_type: string | null;
  territory: string | null;
  therapeutic_area: string | null;
  upfront_usd: number | null;
  milestones_total_usd: number | null;
  total_deal_value_usd: number | null;
  royalty_low_pct: number | null;
  royalty_high_pct: number | null;
  source_url: string | null;
  source_type: string | null;
  confidence_score: number | null;
  match_quality: 'exact' | 'strong' | 'partial';
  url_status?: string | null;
  /** 0–1 composite match score (shared weight table). */
  match_score?: number;
  /** True when this deal is approved-stage M&A included only via the explicit toggle. */
  approved_stage_ma?: boolean;
}

export async function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams;
  const ta = params.get('ta');
  const phase = params.get('phase');
  const modality = params.get('modality');
  const dealType = params.get('dealType');
  const territory = params.get('territory');
  const indication = params.get('indication');
  // Task 2: approved-stage acquisitions/mergers are excluded from pre-approval
  // comp pools unless the user explicitly opts in via the DealTransparency toggle.
  const includeApprovedMA = params.get('includeApprovedMA') === 'true' || params.get('includeApprovedMA') === '1';

  if (!ta) {
    return NextResponse.json({ error: 'ta parameter required' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const userTier = await resolveUserTier(request, supabase);
  const hasPro = userTier === 'pro' || userTier === 'portfolio' || userTier === 'report';

  // Fetch all deals for this TA (indexed query)
  const { data: allDeals, error } = await supabase
    .from('deals')
    .select('id, licensor_name, licensee_name, asset_name, announced_date, phase_at_signing, modality, deal_type, territory, therapeutic_area, upfront_usd, milestones_total_usd, milestones_development_usd, milestones_regulatory_usd, milestones_commercial_usd, total_deal_value_usd, royalty_low_pct, royalty_high_pct, source_url, source_type, confidence_score, indication_specific, indication_category, raw_text_excerpt, url_status')
    .eq('is_synthetic', false)
    .or('is_canonical.is.null,is_canonical.eq.true')
    .or('verification_status.is.null,verification_status.not.in.("rejected","flagged")')
    .eq('therapeutic_area', ta)
    .not('therapeutic_area', 'eq', 'other')
    .order('announced_date', { ascending: false });

  if (error || !allDeals) {
    return NextResponse.json({ error: 'Failed to query deals' }, { status: 500 });
  }

  const currentYear = new Date().getFullYear();

  // Stage/structure sanity filter
  let excludedApprovedMA = 0;
  const stageFiltered = allDeals.filter(d => {
    const isMA = shouldExcludeForStage(phase, d.phase_at_signing, d.deal_type);
    if (isMA) excludedApprovedMA++;
    return includeApprovedMA || !isMA;
  });

  // Score each deal with the shared weight table (TA 3 · phase 4 · adjacent 2 ·
  // modality 3 · indication 3 · deal type 2 · recency 2).
  const scoredAll = stageFiltered.map(d => {
    const year = d.announced_date ? parseInt(d.announced_date.substring(0, 4)) : 2020;
    const { score, normalized, breakdown } = scoreCompMatch(
      { therapeuticArea: ta, phase, modality, indication, dealType },
      { therapeuticArea: d.therapeutic_area, phase: d.phase_at_signing, modalities: [d.modality], indications: [d.indication_category, d.indication_specific], dealType: d.deal_type, year },
      { currentYear },
    );

    const match_quality: 'exact' | 'strong' | 'partial' =
      breakdown.ta && breakdown.phase && breakdown.modality ? 'exact'
        : breakdown.ta && (breakdown.phase || breakdown.adjacentPhase || breakdown.modality || breakdown.indication) ? 'strong'
          : 'partial';

    // Territory: global always relevant, regional only if matches (small tiebreak)
    const territoryMatch = !territory || !d.territory || d.territory === 'global' || d.territory === territory;

    const approved_stage_ma = shouldExcludeForStage(phase, d.phase_at_signing, d.deal_type);

    return {
      ...d,
      match_quality,
      match_score: normalized,
      approved_stage_ma,
      score: score + (territoryMatch ? 0.25 : 0),
      breakdown,
    } as TransparencyDeal & { score: number; breakdown: ReturnType<typeof scoreCompMatch>['breakdown'] };
  });

  // Pass threshold: TA + one of {same phase, adjacent phase, indication}.
  // Relax progressively when the strict pool is thin (< 5).
  const { items: pooled, relaxation } = selectWithRelaxation(scoredAll, d => d.breakdown);
  if (relaxation !== 'none') {
    console.info(`[deals/transparency] relaxation=${relaxation} ta=${ta} phase=${phase ?? '?'} modality=${modality ?? '?'} strictPool<5`);
  }

  // Sort by score descending, then by announced_date descending
  const scored = pooled
    .map(({ breakdown, ...d }) => d)
    .sort((a, b) => b.score - a.score || (b.announced_date || '').localeCompare(a.announced_date || ''));
  const dealPool = scored;

  // Compute stats from pool deals with disclosed financial data. Each stat
  // carries its own n so the UI can say "n = X in pool · Y with disclosed upfront".
  const upfrontValues = dealPool.filter(d => d.upfront_usd != null && d.upfront_usd > 0).map(d => d.upfront_usd! / 1_000_000);
  const totalValues = dealPool.filter(d => d.total_deal_value_usd != null && d.total_deal_value_usd > 0).map(d => d.total_deal_value_usd! / 1_000_000);
  const royaltyValues = dealPool.filter(d => d.royalty_low_pct != null).map(d => d.royalty_low_pct!);

  const stats = {
    upfront: computeCompStats(upfrontValues),
    totalValue: computeCompStats(totalValues),
    royalty: computeCompStats(royaltyValues),
  };

  const totalCount = scored.length;
  const exactCount = scored.filter(d => d.match_quality === 'exact').length;
  const strongCount = scored.filter(d => d.match_quality === 'strong').length;
  const withTermsCount = scored.filter(d => d.upfront_usd != null || d.total_deal_value_usd != null).length;

  // Feature 2: Methodology confidence aggregates
  const confidenceScores = scored.filter(d => d.confidence_score != null).map(d => d.confidence_score!);
  const medianConfidence = confidenceScores.length > 0
    ? confidenceScores.sort((a, b) => a - b)[Math.floor(confidenceScores.length / 2)]
    : null;
  const verifiedCount = scored.filter(d => d.confidence_score != null && d.confidence_score >= 85).length;
  const bySource: Record<string, number> = {};
  scored.forEach(d => {
    const src = d.source_type || 'unknown';
    bySource[src] = (bySource[src] || 0) + 1;
  });
  const dates = scored.filter(d => d.announced_date).map(d => d.announced_date!).sort();
  const newestDeal = dates.length > 0 ? dates[dates.length - 1] : null;
  const oldestDeal = dates.length > 0 ? dates[0] : null;
  const coverageLevel = exactCount >= 20 ? 'strong' : exactCount >= 10 ? 'moderate' : 'limited';

  // Feature 5: Quarterly trend for matching segment
  const quarterlyMap = new Map<string, { upfronts: number[]; count: number }>();
  const threeYearsAgo = new Date().getFullYear() - 3;
  scored.forEach(d => {
    if (!d.announced_date) return;
    const year = parseInt(d.announced_date.substring(0, 4));
    if (year < threeYearsAgo) return;
    const month = parseInt(d.announced_date.substring(5, 7));
    const q = `Q${Math.ceil(month / 3)}`;
    const key = `${q} ${year}`;
    if (!quarterlyMap.has(key)) quarterlyMap.set(key, { upfronts: [], count: 0 });
    const entry = quarterlyMap.get(key)!;
    entry.count++;
    if (d.upfront_usd != null && d.upfront_usd > 0) entry.upfronts.push(d.upfront_usd / 1_000_000);
  });
  const quarterlyTrend = Array.from(quarterlyMap.entries())
    .map(([label, data]) => {
      const sorted = data.upfronts.sort((a, b) => a - b);
      return {
        label,
        quarter: label.split(' ')[0],
        year: parseInt(label.split(' ')[1]),
        medianUpfront: sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : null,
        dealCount: data.count,
      };
    })
    .sort((a, b) => a.year - b.year || a.quarter.localeCompare(b.quarter));

  const confidence = { medianConfidence, verifiedCount, bySource, newestDeal, oldestDeal, coverageLevel };

  // Free users: stats only, no deals
  if (!hasPro) {
    return NextResponse.json({
      success: true,
      tier: 'free',
      totalCount,
      exactCount,
      strongCount,
      withTermsCount,
      poolCount: dealPool.length,
      relaxation: relaxation as CompRelaxation,
      excludedApprovedMA,
      includeApprovedMA,
      stats,
      confidence,
      quarterlyTrend,
      deals: [],
      methodology: 'Estimates are derived from weighted median benchmarks across all matching deals in the database. Start a Pro trial to see individual transactions.',
    });
  }

  // Pro users: full deal list (top 50) with extra fields for detail modal
  const deals = dealPool.slice(0, 50).map(({ score, ...d }) => d);

  return NextResponse.json({
    success: true,
    tier: userTier,
    totalCount,
    exactCount,
    strongCount,
    withTermsCount,
    poolCount: dealPool.length,
    relaxation: relaxation as CompRelaxation,
    excludedApprovedMA,
    includeApprovedMA,
    stats,
    confidence,
    quarterlyTrend,
    deals,
    methodology: 'Estimates are derived from weighted median benchmarks calibrated against all matching deals. The comparable transactions below are the individual data points. Deals are scored by therapeutic area (3), development phase (4, adjacent 2), modality (3), indication (3), deal type (2), and recency (2); a deal must match TA plus phase or indication to enter the pool.',
  });
}
