import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { resolveUserTier } from '@/lib/auth/tier-check';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 30;

export async function GET(request: NextRequest) {
  const auth = await resolveUserTier();
  if (!auth.hasProAccess) {
    return NextResponse.json({ error: 'Pro access required' }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const ta = searchParams.get('ta');
  const modality = searchParams.get('modality');
  const phase = searchParams.get('phase');
  const partnership = searchParams.get('partnership');
  const country = searchParams.get('country');
  const sort = searchParams.get('sort') || 'licensing_intent';
  const search = searchParams.get('q');

  const supabase = createServiceClient();

  let query = supabase
    .from('clinical_assets')
    .select('id, company_id, company_name, asset_name, modality, therapeutic_area, indication_category, indication_specific, phase, trial_status, trial_count, enrollment_total, partnership_status, partner_company_name, licensing_intent_score, competitive_heat, deal_readiness_score, confidence_score, originator_country, originator_region, first_posted_date, last_update_date, nct_ids, territory_rights_available', { count: 'exact' });

  if (ta) query = query.eq('therapeutic_area', ta);
  if (modality) query = query.eq('modality', modality);
  if (phase) query = query.eq('phase', phase);
  if (partnership) query = query.eq('partnership_status', partnership);
  if (country) query = query.eq('originator_country', country);
  if (search) {
    query = query.or(`asset_name.ilike.%${search}%,company_name.ilike.%${search}%`);
  }

  // Sorting
  switch (sort) {
    case 'licensing_intent':
      query = query.order('licensing_intent_score', { ascending: false, nullsFirst: false });
      break;
    case 'deal_readiness':
      query = query.order('deal_readiness_score', { ascending: false, nullsFirst: false });
      break;
    case 'competitive_heat':
      query = query.order('competitive_heat', { ascending: false, nullsFirst: false });
      break;
    case 'confidence':
      query = query.order('confidence_score', { ascending: false, nullsFirst: false });
      break;
    case 'newest':
      query = query.order('last_update_date', { ascending: false, nullsFirst: false });
      break;
    case 'phase_desc':
      query = query.order('phase', { ascending: false });
      break;
    default:
      query = query.order('licensing_intent_score', { ascending: false, nullsFirst: false });
  }

  // Secondary sort for stability
  query = query.order('confidence_score', { ascending: false });

  const offset = (page - 1) * PAGE_SIZE;
  query = query.range(offset, offset + PAGE_SIZE - 1);

  const { data: assets, count, error } = await query;

  if (error) {
    console.error('[radar/feed] Query error:', error.message);
    return NextResponse.json({ error: 'Failed to fetch assets' }, { status: 500 });
  }

  return NextResponse.json({
    assets: assets || [],
    total: count || 0,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.ceil((count || 0) / PAGE_SIZE),
  });
}
