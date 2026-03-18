import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 3600; // Cache for 1 hour

export async function GET() {
  try {
    const supabase = createServiceClient();

    const { data } = await supabase
      .from('deals')
      .select('therapeutic_area')
      .not('therapeutic_area', 'in', '("other","_option_deals","_codev_deals","_china_deals")');

    const byTA: Record<string, number> = {};
    let total = 0;

    for (const row of data || []) {
      const ta = row.therapeutic_area;
      if (ta) {
        byTA[ta] = (byTA[ta] || 0) + 1;
        total++;
      }
    }

    return NextResponse.json({ total, byTA }, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
    });
  } catch {
    return NextResponse.json({ total: 0, byTA: {} }, { status: 500 });
  }
}
