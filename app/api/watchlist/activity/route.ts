import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // SECURITY: Require authenticated session — never trust user_id from query
    const [user, authError] = await requireAuth(request);
    if (authError) return authError;

    const supabase = createServiceClient();

    // Verify Pro tier using authenticated user
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('tier')
      .eq('id', user.id)
      .single();

    if (profile?.tier !== 'pro') {
      return NextResponse.json({ error: 'Pro subscription required' }, { status: 403 });
    }

    // Fetch watchlist items for authenticated user only
    const { data: items } = await supabase
      .from('watchlist_items')
      .select('item_type, item_value, company_id')
      .eq('user_id', user.id);

    if (!items || items.length === 0) {
      return NextResponse.json({ activity: [] });
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Build activity from deals matching watchlist
    const modalityWatches = items.filter(i => i.item_type === 'modality').map(i => i.item_value);
    const companyWatches = items.filter(i => i.item_type === 'company').map(i => i.company_id).filter(Boolean);
    const indicationWatches = items.filter(i => i.item_type === 'indication').map(i => i.item_value);

    const activity: Array<{
      type: string;
      date: string;
      title: string;
      detail: string;
      match_type: string;
      match_value: string;
    }> = [];

    // Deals matching modality watches
    if (modalityWatches.length > 0) {
      const { data: modalityDeals } = await supabase
        .from('deals')
        .select('id, licensor_name, licensee_name, modality, upfront_usd, announced_date, asset_name')
        .in('modality', modalityWatches)
        .eq('is_synthetic', false)  // R68
        .gte('announced_date', thirtyDaysAgo)
        .order('announced_date', { ascending: false })
        .limit(20);

      for (const deal of modalityDeals || []) {
        activity.push({
          type: 'deal',
          date: deal.announced_date,
          title: `${deal.licensor_name} → ${deal.licensee_name}`,
          detail: deal.asset_name || deal.modality,
          match_type: 'modality',
          match_value: deal.modality,
        });
      }
    }

    // Deals matching company watches
    if (companyWatches.length > 0) {
      const { data: companyDeals } = await supabase
        .from('deals')
        .select('id, licensor_name, licensee_name, licensee_id, licensor_id, modality, upfront_usd, announced_date, asset_name')
        .or(`licensee_id.in.(${companyWatches.join(',')}),licensor_id.in.(${companyWatches.join(',')})`)
        .eq('is_synthetic', false)  // R68
        .gte('announced_date', thirtyDaysAgo)
        .order('announced_date', { ascending: false })
        .limit(20);

      for (const deal of companyDeals || []) {
        activity.push({
          type: 'deal',
          date: deal.announced_date,
          title: `${deal.licensor_name} → ${deal.licensee_name}`,
          detail: deal.asset_name || deal.modality,
          match_type: 'company',
          match_value: deal.licensee_name,
        });
      }
    }

    // Deals matching indication watches
    if (indicationWatches.length > 0) {
      const { data: indicationDeals } = await supabase
        .from('deals')
        .select('id, licensor_name, licensee_name, indication_category, indication_specific, modality, announced_date, asset_name')
        .or(`indication_category.in.(${indicationWatches.join(',')}),indication_specific.in.(${indicationWatches.join(',')})`)
        .eq('is_synthetic', false)  // R68
        .gte('announced_date', thirtyDaysAgo)
        .order('announced_date', { ascending: false })
        .limit(20);

      for (const deal of indicationDeals || []) {
        activity.push({
          type: 'deal',
          date: deal.announced_date,
          title: `${deal.licensor_name} → ${deal.licensee_name}`,
          detail: deal.asset_name || deal.indication_category,
          match_type: 'indication',
          match_value: deal.indication_category,
        });
      }
    }

    // Trial updates matching company watches
    if (companyWatches.length > 0) {
      const { data: trials } = await supabase
        .from('company_trials')
        .select('company_name, trial_title, status, phase, last_update_posted, nct_id')
        .in('company_id', companyWatches)
        .gte('last_update_posted', thirtyDaysAgo)
        .order('last_update_posted', { ascending: false })
        .limit(20);

      for (const trial of trials || []) {
        activity.push({
          type: 'trial',
          date: trial.last_update_posted,
          title: `${trial.company_name} trial update`,
          detail: `${trial.trial_title || trial.nct_id} — ${trial.status}`,
          match_type: 'company',
          match_value: trial.company_name,
        });
      }
    }

    // Sort all activity by date descending, deduplicate
    const seen = new Set<string>();
    const dedupedActivity = activity
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .filter(a => {
        const key = `${a.type}-${a.title}-${a.date}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 50);

    return NextResponse.json({ activity: dedupedActivity });
  } catch (error) {
    console.error('Watchlist activity error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
