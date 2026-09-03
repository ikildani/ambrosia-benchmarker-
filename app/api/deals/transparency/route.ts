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

export const dynamic = 'force-dynamic';

const PHASE_ORDER: Record<string, number> = {
  discovery: 0, preclinical: 1, phase_1: 2, phase_1_2: 2.5,
  phase_2: 3, phase_2_3: 3.5, phase_3: 4, nda_filed: 5, approved: 6,
};

function adjacentPhases(phase: string): string[] {
  const rank = PHASE_ORDER[phase] ?? 3;
  return Object.entries(PHASE_ORDER)
    .filter(([, r]) => Math.abs(r - rank) <= 1.5)
    .map(([p]) => p);
}

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
}

function computeStats(values: number[]): { min: number; p25: number; median: number; p75: number; max: number } | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  return {
    min: sorted[0],
    p25: sorted[Math.floor(n * 0.25)] ?? sorted[0],
    median: n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)],
    p75: sorted[Math.floor(n * 0.75)] ?? sorted[n - 1],
    max: sorted[n - 1],
  };
}

export async function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams;
  const ta = params.get('ta');
  const phase = params.get('phase');
  const modality = params.get('modality');
  const dealType = params.get('dealType');
  const territory = params.get('territory');

  if (!ta) {
    return NextResponse.json({ error: 'ta parameter required' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const userTier = await resolveUserTier(request, supabase);
  const hasPro = userTier === 'pro' || userTier === 'portfolio' || userTier === 'report';

  // Build the query — start with exact TA match
  const phases = phase ? adjacentPhases(phase) : [];

  // Fetch all deals for this TA (indexed query)
  const { data: allDeals, error } = await supabase
    .from('deals')
    .select('id, licensor_name, licensee_name, asset_name, announced_date, phase_at_signing, modality, deal_type, territory, therapeutic_area, upfront_usd, milestones_total_usd, milestones_development_usd, milestones_regulatory_usd, milestones_commercial_usd, total_deal_value_usd, royalty_low_pct, royalty_high_pct, source_url, source_type, confidence_score, indication_specific, indication_category, raw_text_excerpt')
    .eq('is_synthetic', false)
    .eq('therapeutic_area', ta)
    .not('therapeutic_area', 'eq', 'other')
    .order('announced_date', { ascending: false });

  if (error || !allDeals) {
    return NextResponse.json({ error: 'Failed to query deals' }, { status: 500 });
  }

  // Score each deal by match quality
  const scored: (TransparencyDeal & { score: number })[] = allDeals.map(d => {
    let matchCount = 1; // TA already matches
    if (phase && d.phase_at_signing === phase) matchCount++;
    if (modality && d.modality === modality) matchCount++;
    if (dealType && d.deal_type === dealType) matchCount++;

    // Adjacent phase bonus (partial credit)
    const isAdjacentPhase = phase && d.phase_at_signing && phases.includes(d.phase_at_signing) && d.phase_at_signing !== phase;

    const match_quality: 'exact' | 'strong' | 'partial' =
      matchCount >= 3 ? 'exact' : matchCount >= 2 ? 'strong' : 'partial';

    // Recency weight — last 3 years get a boost
    const year = d.announced_date ? parseInt(d.announced_date.substring(0, 4)) : 2020;
    const currentYear = new Date().getFullYear();
    const recencyBonus = Math.max(0, 1 - (currentYear - year) * 0.08);

    // Territory: global always relevant, regional only if matches
    const territoryMatch = !territory || !d.territory || d.territory === 'global' || d.territory === territory;

    const score = matchCount * 30 + (isAdjacentPhase ? 10 : 0) + recencyBonus * 10 + (territoryMatch ? 5 : 0);

    return { ...d, match_quality, score };
  });

  // Sort by score descending, then by announced_date descending
  scored.sort((a, b) => b.score - a.score || (b.announced_date || '').localeCompare(a.announced_date || ''));

  // If too few exact/strong matches, include partial
  const strongMatches = scored.filter(d => d.match_quality !== 'partial');
  const dealPool = strongMatches.length >= 5 ? scored : scored;

  // Compute stats from all deals with financial data
  const upfrontValues = dealPool.filter(d => d.upfront_usd != null && d.upfront_usd > 0).map(d => d.upfront_usd! / 1_000_000);
  const totalValues = dealPool.filter(d => d.total_deal_value_usd != null && d.total_deal_value_usd > 0).map(d => d.total_deal_value_usd! / 1_000_000);
  const royaltyValues = dealPool.filter(d => d.royalty_low_pct != null).map(d => d.royalty_low_pct! * 100);

  const stats = {
    upfront: computeStats(upfrontValues),
    totalValue: computeStats(totalValues),
    royalty: computeStats(royaltyValues),
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
    stats,
    confidence,
    quarterlyTrend,
    deals,
    methodology: 'Estimates are derived from weighted median benchmarks calibrated against all matching deals. The comparable transactions below are the individual data points. Deals are scored by therapeutic area, development phase, modality, and recency.',
  });
}
