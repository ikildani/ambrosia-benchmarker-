/**
 * Asset Radar — Acquirer Perspective View
 *
 * GET /api/radar/acquirer-view?company=Pfizer
 *   "I am Pfizer — show me every asset I should license."
 *   Returns: portfolio gaps, recommended assets per gap, deal opportunities.
 *
 * GET /api/radar/acquirer-view?top=20
 *   Top acquirers by number of proposed deal opportunities.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const companyName = request.nextUrl.searchParams.get('company');
  const top = parseInt(request.nextUrl.searchParams.get('top') || '0', 10);

  const supabase = createServiceClient();

  // ── Single acquirer view ───────────────────────────
  if (companyName) {
    // Get company profile
    const { data: company } = await supabase
      .from('companies')
      .select('id, name, company_type, modalities_active, modalities_primary, indications_active, deals_last_12mo, deals_last_24mo, acquisition_appetite, revenue_at_risk_2026, revenue_at_risk_2027, patent_cliffs, strategic_priorities, active_trials_count')
      .ilike('name', `%${companyName}%`)
      .limit(1)
      .single();

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Get all proposed opportunities for this acquirer
    const { data: opportunities } = await supabase
      .from('radar_deal_opportunities')
      .select('*, asset_id')
      .eq('acquirer_company_id', company.id)
      .neq('status', 'dismissed')
      .order('opportunity_score', { ascending: false })
      .limit(50);

    // Group by gap type
    const byGap: Record<string, typeof opportunities> = {};
    if (opportunities) {
      for (const opp of opportunities) {
        const gap = opp.gap_type || 'other';
        if (!byGap[gap]) byGap[gap] = [];
        byGap[gap]!.push(opp);
      }
    }

    // Compute portfolio summary
    const totalRevAtRisk = (company.revenue_at_risk_2026 || 0) + (company.revenue_at_risk_2027 || 0);
    const revAtRiskB = totalRevAtRisk > 0 ? (totalRevAtRisk / 1_000_000_000).toFixed(1) : '0';

    return NextResponse.json({
      acquirer: {
        ...company,
        revenue_at_risk_total: totalRevAtRisk,
        revenue_at_risk_display: `$${revAtRiskB}B`,
      },
      opportunities: opportunities || [],
      by_gap_type: byGap,
      total_opportunities: opportunities?.length || 0,
      summary: {
        gap_types: Object.keys(byGap).length,
        top_opportunity: opportunities?.[0] || null,
        avg_score: opportunities && opportunities.length > 0
          ? Math.round(opportunities.reduce((s, o) => s + Number(o.opportunity_score), 0) / opportunities.length)
          : 0,
      },
    });
  }

  // ── Top acquirers leaderboard ──────────────────────
  if (top > 0) {
    const { data: acquirers } = await supabase
      .from('radar_deal_opportunities')
      .select('acquirer_company_id, acquirer_name')
      .neq('status', 'dismissed')
      .limit(500);

    if (!acquirers || acquirers.length === 0) {
      return NextResponse.json({ acquirers: [], total: 0 });
    }

    // Count opportunities per acquirer
    const counts = new Map<string, { name: string; count: number; companyId: string }>();
    for (const a of acquirers) {
      const existing = counts.get(a.acquirer_name) || { name: a.acquirer_name, count: 0, companyId: a.acquirer_company_id };
      existing.count++;
      counts.set(a.acquirer_name, existing);
    }

    const sorted = Array.from(counts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, Math.min(top, 50));

    return NextResponse.json({
      acquirers: sorted,
      total: sorted.length,
    });
  }

  return NextResponse.json({
    error: 'Provide company or top parameter',
    usage: {
      single_acquirer: '/api/radar/acquirer-view?company=Pfizer',
      leaderboard: '/api/radar/acquirer-view?top=20',
    },
  }, { status: 400 });
}
