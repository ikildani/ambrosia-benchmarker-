import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { validateApiKey } from '@/lib/api-v1-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const apiKey = await validateApiKey(request);
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Invalid or exhausted API key', docs: 'https://solidus.ambrosiaventures.co/docs/api' },
      { status: 401 }
    );
  }

  const params = request.nextUrl.searchParams;
  const therapeuticArea = params.get('therapeutic_area');
  const modality = params.get('modality');
  const phase = params.get('phase');
  const minValue = params.get('min_value');
  const limit = Math.min(parseInt(params.get('limit') || '25'), 100);
  const offset = parseInt(params.get('offset') || '0');

  const supabase = createServiceClient();

  let query = supabase
    .from('deals')
    // Column names must match the deals schema (phase_at_signing, upfront_usd,
    // is_synthetic). The previous names did not exist and every call 500'd.
    .select('id, licensor_name, licensee_name, therapeutic_area, indication_category, indication_specific, modality, phase_at_signing, total_deal_value_usd, upfront_usd, milestones_total_usd, royalty_low_pct, royalty_high_pct, announced_date, deal_type, territory, source_url, confidence_score, verification_status', { count: 'exact' })
    .eq('is_synthetic', false)
    .or('is_canonical.is.null,is_canonical.eq.true')
    .order('announced_date', { ascending: false })
    .range(offset, offset + limit - 1);

  if (therapeuticArea) query = query.eq('therapeutic_area', therapeuticArea);
  if (modality) query = query.eq('modality', modality);
  // Accept both calculator-style ("phase2") and schema-style ("phase_2") phase keys.
  if (phase) query = query.eq('phase_at_signing', phase.replace(/^phase(\d)/, 'phase_$1'));
  if (minValue) query = query.gte('total_deal_value_usd', parseInt(minValue) * 1_000_000);

  const { data: deals, count, error } = await query;

  if (error) {
    return NextResponse.json({ error: 'Query failed' }, { status: 500 });
  }

  return NextResponse.json({
    deals: deals || [],
    total: count || 0,
    limit,
    offset,
    quota: {
      used: apiKey.monthlyUsage,
      limit: apiKey.monthlyQuota,
    },
  });
}
