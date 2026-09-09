import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { resolveUserTier } from '@/lib/auth/tier-check';
import { fetchComparableDeals, MIN_COMPS_FOR_TERMS, type DealComp } from '@/lib/radar/deal-thesis';

export const dynamic = 'force-dynamic';

/** Row shape the AssetDetailModal DealTable reads ($M, not raw USD). */
function toDealRow(d: {
  id: string;
  licensor_name: string | null;
  licensee_name: string | null;
  asset_name: string | null;
  therapeutic_area: string | null;
  modality: string | null;
  phase_at_signing: string | null;
  upfront_usd: number | string | null;
  total_deal_value_usd: number | string | null;
  royalty_low_pct: number | string | null;
  royalty_high_pct: number | string | null;
  milestones_total_usd: number | string | null;
  territory: string | null;
  announced_date: string | null;
  deal_status?: string | null;
}): Record<string, unknown> {
  const toM = (v: number | string | null) => (v != null && Number(v) > 0 ? Math.round(Number(v) / 1_000_000) : null);
  return {
    id: d.id,
    licensor_name: d.licensor_name,
    licensee_name: d.licensee_name,
    asset_name: d.asset_name,
    therapeutic_area: d.therapeutic_area,
    modality: d.modality,
    phase_at_signing: d.phase_at_signing,
    upfront_m: toM(d.upfront_usd),
    total_deal_value_m: toM(d.total_deal_value_usd),
    milestones_m: toM(d.milestones_total_usd),
    royalty_low_pct: d.royalty_low_pct != null ? Number(d.royalty_low_pct) : null,
    royalty_high_pct: d.royalty_high_pct != null ? Number(d.royalty_high_pct) : null,
    territory: d.territory,
    announced_date: d.announced_date,
    // Legacy key kept for the DealTable's date column.
    announcement_date: d.announced_date,
    deal_status: d.deal_status ?? null,
  };
}

function compToRow(c: DealComp): Record<string, unknown> {
  return {
    id: c.id,
    licensor_name: c.licensor_name,
    licensee_name: c.licensee_name,
    asset_name: c.asset_name,
    therapeutic_area: c.therapeutic_area,
    modality: c.modality,
    phase_at_signing: c.phase_at_signing,
    upfront_m: c.upfront_m,
    total_deal_value_m: c.total_deal_value_m,
    milestones_m: c.milestones_m,
    royalty_low_pct: c.royalty_low_pct,
    royalty_high_pct: c.royalty_high_pct,
    territory: c.territory,
    announced_date: c.announced_date,
    announcement_date: c.announced_date,
    year: c.year,
    deal_type: c.deal_type,
    verification_status: c.verification_status,
    match_score: c.match_score,
    relevance_reasons: c.relevance_reasons,
  };
}

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

  // Fetch linked deals (real deals columns; USD → $M for the UI)
  const dealIds: string[] = asset.deal_ids || [];
  let linkedDeals: Record<string, unknown>[] = [];
  if (dealIds.length > 0) {
    const { data: deals, error: linkedError } = await supabase
      .from('deals')
      .select('id, licensor_name, licensee_name, asset_name, therapeutic_area, modality, phase_at_signing, upfront_usd, total_deal_value_usd, milestones_total_usd, royalty_low_pct, royalty_high_pct, territory, announced_date, deal_status')
      .in('id', dealIds.slice(0, 10));
    if (linkedError) console.warn(`[radar/assets] linked deals lookup failed: ${linkedError.message}`);
    linkedDeals = (deals || []).map(toDealRow);
  }

  // Comparable deals via the shared calculator path (same filters, scorer and
  // relaxation ladder as /api/deals/comparable), so Radar and the calculator
  // agree on the comp set for this asset.
  let comparableDeals: Record<string, unknown>[] = [];
  let comparables: { n: number; relaxation: string; insufficient_comps: boolean; min_comps: number; excluded_approved_ma: number } = {
    n: 0, relaxation: 'none', insufficient_comps: true, min_comps: MIN_COMPS_FOR_TERMS, excluded_approved_ma: 0,
  };
  try {
    const set = await fetchComparableDeals(supabase, asset, 15);
    comparableDeals = set.comps.map(compToRow);
    comparables = {
      n: set.comps.length,
      relaxation: set.relaxation,
      insufficient_comps: set.comps.length < MIN_COMPS_FOR_TERMS,
      min_comps: MIN_COMPS_FOR_TERMS,
      excluded_approved_ma: set.excludedApprovedMA,
    };
  } catch (err) {
    console.warn(`[radar/assets] comparable lookup failed: ${err instanceof Error ? err.message : String(err)}`);
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
    .maybeSingle();

  return NextResponse.json({
    asset,
    linkedDeals,
    comparableDeals,
    comparables,
    trials,
    thesis: thesis || null,
  });
}
