import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { resolveUserTier } from '@/lib/auth/tier-check';

export const dynamic = 'force-dynamic';
export const revalidate = 1800;

export async function GET() {
  const auth = await resolveUserTier();
  if (!auth.hasProAccess) {
    return NextResponse.json({ error: 'Pro access required' }, { status: 403 });
  }

  const supabase = createServiceClient();

  const [
    { count: totalAssets },
    { count: unpartnered },
    { count: activeTrials },
    { data: taBreakdown },
    { data: phaseBreakdown },
    { data: modalityBreakdown },
    { data: topScoringAssets },
  ] = await Promise.all([
    supabase.from('clinical_assets').select('id', { count: 'exact', head: true }),
    supabase.from('clinical_assets').select('id', { count: 'exact', head: true })
      .in('partnership_status', ['unpartnered', 'partially_partnered']),
    supabase.from('clinical_assets').select('id', { count: 'exact', head: true })
      .eq('trial_status', 'active'),
    supabase.rpc('radar_ta_breakdown').then(r => r),
    supabase.rpc('radar_phase_breakdown').then(r => r),
    supabase.rpc('radar_modality_breakdown').then(r => r),
    supabase.from('clinical_assets')
      .select('id, company_name, asset_name, therapeutic_area, modality, phase, licensing_intent_score, deal_readiness_score, competitive_heat')
      .in('partnership_status', ['unpartnered', 'partially_partnered'])
      .order('licensing_intent_score', { ascending: false, nullsFirst: false })
      .limit(10),
  ]);

  return NextResponse.json({
    totalAssets: totalAssets || 0,
    unpartnered: unpartnered || 0,
    activeTrials: activeTrials || 0,
    taBreakdown: taBreakdown || [],
    phaseBreakdown: phaseBreakdown || [],
    modalityBreakdown: modalityBreakdown || [],
    topScoringAssets: topScoringAssets || [],
  });
}
