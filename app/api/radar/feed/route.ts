import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { resolveUserTier } from '@/lib/auth/tier-check';
import {
  RADAR_TA_OPTIONS,
  RADAR_MODALITY_OPTIONS,
  RADAR_PHASE_OPTIONS,
  RADAR_PARTNERSHIP_OPTIONS,
  RADAR_REGION_OPTIONS,
  RADAR_COUNTRY_OPTIONS,
  isRadarValue,
  type VocabOption,
} from '@/lib/radar/vocab';
import { sanitizeSearchTerm } from '@/app/api/radar/_lib/radar-api';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 30;

/**
 * Returns the param when it is a known vocabulary value, null when absent,
 * and throws a 400-able marker when it is set but not in the vocabulary.
 * Filters are only ever built from whitelisted values — never raw input.
 */
function vocabParam(
  searchParams: URLSearchParams,
  key: string,
  list: VocabOption[],
): { value: string | null; invalid: boolean } {
  const raw = searchParams.get(key);
  if (!raw) return { value: null, invalid: false };
  return isRadarValue(list, raw) ? { value: raw, invalid: false } : { value: null, invalid: true };
}

export async function GET(request: NextRequest) {
  // Asset Radar is a Pro feature: the feed exposes the full scored asset
  // universe, so anonymous and free-tier callers are rejected up front.
  const auth = await resolveUserTier();
  if (!auth.hasProAccess) {
    return NextResponse.json({ error: 'Pro access required' }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));

  const ta = vocabParam(searchParams, 'ta', RADAR_TA_OPTIONS);
  const modality = vocabParam(searchParams, 'modality', RADAR_MODALITY_OPTIONS);
  const phase = vocabParam(searchParams, 'phase', RADAR_PHASE_OPTIONS);
  const partnership = vocabParam(searchParams, 'partnership', RADAR_PARTNERSHIP_OPTIONS);
  const country = vocabParam(searchParams, 'country', RADAR_COUNTRY_OPTIONS);
  const region = vocabParam(searchParams, 'region', RADAR_REGION_OPTIONS);

  const checks: [string, { invalid: boolean }][] = [
    ['ta', ta], ['modality', modality], ['phase', phase],
    ['partnership', partnership], ['country', country], ['region', region],
  ];
  const invalid = checks.find(([, p]) => p.invalid);
  if (invalid) {
    return NextResponse.json({ error: `Invalid ${invalid[0]} value` }, { status: 400 });
  }

  const sort = searchParams.get('sort') || 'licensing_intent';
  // Free text is embedded in a PostgREST `.or()` expression below, so strip
  // the characters that would let a caller alter the filter structure.
  const search = sanitizeSearchTerm(searchParams.get('q'));

  const supabase = createServiceClient();

  let query = supabase
    .from('clinical_assets')
    .select('id, company_id, company_name, asset_name, modality, therapeutic_area, indication_category, indication_specific, phase, trial_status, trial_count, enrollment_total, partnership_status, partner_company_name, licensing_intent_score, competitive_heat, deal_readiness_score, confidence_score, originator_country, originator_region, first_posted_date, last_update_date, nct_ids, territory_rights_available', { count: 'exact' });

  if (ta.value) query = query.eq('therapeutic_area', ta.value);
  if (modality.value) query = query.eq('modality', modality.value);
  if (phase.value) query = query.eq('phase', phase.value);
  if (partnership.value) query = query.eq('partnership_status', partnership.value);
  if (country.value) query = query.eq('originator_country', country.value);
  if (region.value) query = query.eq('originator_region', region.value);
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
