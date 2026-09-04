import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { resolveUserTier } from '@/lib/auth/tier-check';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await resolveUserTier();
  if (!auth.hasProAccess) {
    return NextResponse.json({ error: 'Pro access required' }, { status: 403 });
  }

  const { id } = await params;

  if (!id || id.length < 10) {
    return NextResponse.json({ error: 'Invalid asset ID' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: asset, error } = await supabase
    .from('clinical_assets')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !asset) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  }

  // Fetch linked deals
  const dealIds: string[] = asset.deal_ids || [];
  let linkedDeals: Record<string, unknown>[] = [];
  if (dealIds.length > 0) {
    const { data: deals } = await supabase
      .from('deals')
      .select('id, licensor_name, licensee_name, asset_name, therapeutic_area, modality, phase_at_deal, upfront_m, total_deal_value_m, royalty_rate, territory, announcement_date, deal_status')
      .in('id', dealIds.slice(0, 10));
    linkedDeals = deals || [];
  }

  // Fetch comparable deals (same TA + modality + similar phase)
  let comparableDeals: Record<string, unknown>[] = [];
  if (asset.therapeutic_area && asset.modality) {
    const { data: comps } = await supabase
      .from('deals')
      .select('id, licensor_name, licensee_name, asset_name, therapeutic_area, modality, phase_at_deal, upfront_m, total_deal_value_m, royalty_rate, territory, announcement_date')
      .eq('therapeutic_area', asset.therapeutic_area)
      .eq('modality', asset.modality)
      .eq('is_synthetic', false)
      .order('announcement_date', { ascending: false })
      .limit(15);
    comparableDeals = comps || [];
  }

  // Fetch trial details
  let trials: Record<string, unknown>[] = [];
  const nctIds: string[] = asset.nct_ids || [];
  if (nctIds.length > 0) {
    const { data: trialData } = await supabase
      .from('company_trials')
      .select('nct_id, trial_title, phase, status, enrollment_count, start_date, primary_completion_date, conditions, collaborator_names, is_collaboration')
      .in('nct_id', nctIds.slice(0, 20));
    trials = trialData || [];
  }

  // Fetch deal thesis if available
  const { data: thesis } = await supabase
    .from('radar_deal_theses')
    .select('*')
    .eq('asset_id', id)
    .single();

  return NextResponse.json({
    asset,
    linkedDeals,
    comparableDeals,
    trials,
    thesis: thesis || null,
  });
}
