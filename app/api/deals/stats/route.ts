import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createServiceClient();

    // Use RPC or efficient grouping instead of fetching all rows
    const { data, error } = await supabase
      .from('deals')
      .select('therapeutic_area', { count: 'exact', head: false })
      .not('therapeutic_area', 'in', '("other","_option_deals","_codev_deals","_china_deals")')
      .limit(1);

    // Fallback: count per TA with individual queries (still better than fetching all rows)
    const tas = ['oncology', 'neurology', 'immunology', 'rareDisease', 'cardiovascular', 'metabolic', 'infectiousDisease', 'ophthalmology', 'dermatology', 'womensHealth', 'gastroenterology', 'hematology'];

    const counts = await Promise.all(
      tas.map(async (ta) => {
        const { count } = await supabase
          .from('deals')
          .select('id', { count: 'exact', head: true })
          .eq('therapeutic_area', ta)
          .eq('is_synthetic', false);  // R66: exclude flagged fakes
        return { ta, count: count || 0 };
      })
    );

    const byTA: Record<string, number> = {};
    let total = 0;
    for (const { ta, count } of counts) {
      byTA[ta] = count;
      total += count;
    }

    return NextResponse.json({ total, byTA }, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
    });
  } catch {
    return NextResponse.json({ total: 0, byTA: {} }, { status: 500 });
  }
}
