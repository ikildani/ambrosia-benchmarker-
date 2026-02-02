import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
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
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Unknown error'
    }, { status: 500 });
  }
}

