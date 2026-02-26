import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { checkRateLimit, getIdentifier, getRateLimitHeaders, RATE_LIMIT_CONFIGS } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Rate limiting
  const identifier = getIdentifier(request);
  const rateLimitResult = await checkRateLimit(identifier, 'deals-debug', RATE_LIMIT_CONFIGS.default);

  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: getRateLimitHeaders(rateLimitResult) }
    );
  }

  try {
    const supabase = createServiceClient();

    // Test 1: Simple count
    const { count: totalCount } = await supabase
      .from('deals')
      .select('*', { count: 'exact', head: true });

    // Test 2: Query like main API
    const { data: deals, count: queryCount, error: queryError } = await supabase
      .from('deals')
      .select(`
        id,
        licensor_name,
        licensee_name,
        asset_name,
        modality,
        indication_category,
        phase_at_signing,
        announced_date
      `, { count: 'exact' })
      .order('announced_date', { ascending: false, nullsFirst: false })
      .range(0, 19);

    // Test 3: Get filter options
    const { data: modalities } = await supabase
      .from('deals')
      .select('modality')
      .not('modality', 'is', null)
      .limit(100);

    return NextResponse.json({
      totalCount,
      queryCount,
      queryError: queryError?.message || null,
      dealsReturned: deals?.length || 0,
      sampleDeal: deals?.[0] || null,
      modalityCount: modalities?.length || 0,
      sampleModalities: [...new Set((modalities || []).map(d => d.modality))].slice(0, 5)
    });
  } catch (err) {
    console.error('Deals debug error:', err);
    return NextResponse.json({ error: 'Debug query failed' }, { status: 500 });
  }
}

