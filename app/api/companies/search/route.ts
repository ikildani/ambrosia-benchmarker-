import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');
    const top = searchParams.get('top');

    // Top companies mode: return highest deal-volume companies
    if (top) {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name, company_type, modalities_active, deals_last_12mo')
        .order('deals_last_12mo', { ascending: false, nullsFirst: false })
        .limit(18);

      if (error) {
        console.error('Top companies error:', error);
        return NextResponse.json({ error: 'Search failed' }, { status: 500 });
      }

      return NextResponse.json({ companies: data || [] });
    }

    // Search mode
    if (!q || q.length < 2) {
      return NextResponse.json({ companies: [] });
    }

    const { data, error } = await supabase
      .from('companies')
      .select('id, name, company_type, modalities_active, deals_last_12mo')
      .ilike('name', `%${q}%`)
      .order('deals_last_12mo', { ascending: false, nullsFirst: false })
      .limit(20);

    if (error) {
      console.error('Company search error:', error);
      return NextResponse.json({ error: 'Search failed' }, { status: 500 });
    }

    return NextResponse.json({ companies: data || [] });
  } catch (error) {
    console.error('Company search API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
