import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { clampInt } from '@/lib/api-validation';

export const dynamic = 'force-dynamic';

const VALID_SORT_FIELDS = ['deals_last_12mo', 'active_trials_count', 'last_deal_date', 'name'] as const;
const VALID_TYPES = ['large_pharma', 'mid_pharma', 'large_biotech', 'mid_biotech'] as const;

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');
    const top = searchParams.get('top');
    const typeFilter = searchParams.get('type');
    const modalityFilter = searchParams.get('modality');
    const sortBy = searchParams.get('sort') || 'deals_last_12mo';
    const page = clampInt(searchParams.get('page'), 1, 100, 1);
    const limit = clampInt(searchParams.get('limit'), 1, 50, 24);
    const offset = (page - 1) * limit;

    const selectFields = 'id, name, company_type, hq_country, modalities_active, deals_last_12mo, active_trials_count, acquisition_appetite, last_deal_date, last_deal_modality, data_quality_score';

    // Validate sort
    const safeSortBy = (VALID_SORT_FIELDS as readonly string[]).includes(sortBy) ? sortBy : 'deals_last_12mo';

    // Build base query for listing (top mode or search mode)
    if (top || !q || q.length < 2) {
      let query = supabase
        .from('companies')
        .select(selectFields, { count: 'exact' });

      // Apply type filter
      if (typeFilter && (VALID_TYPES as readonly string[]).includes(typeFilter)) {
        query = query.eq('company_type', typeFilter);
      }

      // Apply modality filter — companies with this modality in their active list
      if (modalityFilter) {
        query = query.contains('modalities_active', [modalityFilter]);
      }

      // Apply search filter if in search mode
      if (q && q.length >= 2) {
        query = query.ilike('name', `%${q}%`);
      }

      // Sort
      if (safeSortBy === 'name') {
        query = query.order('name', { ascending: true });
      } else if (safeSortBy === 'last_deal_date') {
        query = query.order('last_deal_date', { ascending: false, nullsFirst: false });
      } else if (safeSortBy === 'active_trials_count') {
        query = query.order('active_trials_count', { ascending: false, nullsFirst: false });
      } else {
        query = query.order('deals_last_12mo', { ascending: false, nullsFirst: false });
      }

      // Pagination
      query = query.range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        console.error('Companies list error:', error);
        return NextResponse.json({ error: 'Search failed' }, { status: 500 });
      }

      // Fetch aggregate stats (only on first page, unfiltered)
      let stats = null;
      if (page === 1 && !typeFilter && !modalityFilter && !q) {
        const { data: all } = await supabase
          .from('companies')
          .select('company_type');

        if (all) {
          const counts: Record<string, number> = {};
          for (const c of all) {
            const t = c.company_type || 'other';
            counts[t] = (counts[t] || 0) + 1;
          }
          stats = {
            total_companies: all.length,
            type_breakdown: Object.entries(counts)
              .map(([type, count]) => ({ type, count }))
              .sort((a, b) => b.count - a.count),
          };
        }
      }

      return NextResponse.json({
        companies: data || [],
        total: count || 0,
        page,
        limit,
        stats,
      });
    }

    // Search mode with short query
    const { data, error, count } = await supabase
      .from('companies')
      .select(selectFields, { count: 'exact' })
      .ilike('name', `%${q}%`)
      .order(safeSortBy as any, { ascending: safeSortBy === 'name', nullsFirst: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Company search error:', error);
      return NextResponse.json({ error: 'Search failed' }, { status: 500 });
    }

    return NextResponse.json({
      companies: data || [],
      total: count || 0,
      page,
      limit,
    });
  } catch (error) {
    console.error('Company search API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
