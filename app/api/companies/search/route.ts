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
    const typeFilter = searchParams.get('type');
    const modalityFilter = searchParams.get('modality');
    const sortBy = searchParams.get('sort') || 'deals_last_12mo';
    const page = clampInt(searchParams.get('page'), 1, 100, 1);
    const limit = clampInt(searchParams.get('limit'), 1, 50, 24);
    const offset = (page - 1) * limit;

    const selectFields = 'id, name, company_type, hq_country, modalities_active, deals_last_12mo, active_trials_count, acquisition_appetite, last_deal_date, last_deal_modality, data_quality_score';

    // Validate sort
    const safeSortBy = (VALID_SORT_FIELDS as readonly string[]).includes(sortBy) ? sortBy : 'deals_last_12mo';

    // Build query — unified path for all modes (search, top, filtered)
    let query = supabase
      .from('companies')
      .select(selectFields, { count: 'exact' });

    // Apply name search
    if (q && q.length >= 2) {
      query = query.ilike('name', `%${q}%`);
    }

    // Apply type filter
    if (typeFilter && (VALID_TYPES as readonly string[]).includes(typeFilter)) {
      query = query.eq('company_type', typeFilter);
    }

    // Apply modality filter — companies with this modality in their active list
    if (modalityFilter) {
      query = query.contains('modalities_active', [modalityFilter]);
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
    // Uses the total count from the main query + a lightweight type-only query
    let stats = null;
    if (page === 1 && !typeFilter && !modalityFilter && !q) {
      // Get type breakdown using per-type counts instead of fetching all rows
      const typeBreakdown: { type: string; count: number }[] = [];
      const validTypes = [...VALID_TYPES, null] as const;

      const typeCounts = await Promise.all(
        validTypes.map(async (t) => {
          const query = supabase.from('companies').select('id', { count: 'exact', head: true });
          if (t) {
            query.eq('company_type', t);
          } else {
            query.is('company_type', null);
          }
          const { count: typeCount } = await query;
          return { type: t || 'other', count: typeCount || 0 };
        })
      );

      const totalCompanies = typeCounts.reduce((sum, tc) => sum + tc.count, 0);
      stats = {
        total_companies: totalCompanies,
        type_breakdown: typeCounts.filter(tc => tc.count > 0).sort((a, b) => b.count - a.count),
      };
    }

    // Clamp any future last_deal_date to today (defense in depth)
    const today = new Date().toISOString().slice(0, 10);
    const companies = (data || []).map(c => ({
      ...c,
      last_deal_date: c.last_deal_date && c.last_deal_date > today ? today : c.last_deal_date,
    }));

    return NextResponse.json({
      companies,
      total: count || 0,
      page,
      limit,
      stats,
    });
  } catch (error) {
    console.error('Company search API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
