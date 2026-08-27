import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { checkRateLimit, getIdentifier, getRateLimitHeaders, RATE_LIMIT_CONFIGS } from '@/lib/rate-limit';
import { aggregateDealsByQuarter, computeMomentumSignals, type MomentumSignal } from '@/lib/services/trend-aggregation';
import { computeLicensingWindow, type LicensingWindowResult } from '@/lib/services/licensing-window';

export const dynamic = 'force-dynamic';

interface DealToWatchCompany {
  id: string;
  name: string;
  companyType: string | null;
  intentScore: number;
  intentTier: string;
  dealsLast12mo: number;
  lastDealDate: string | null;
  acquisitionAppetite: string | null;
  activelyAcquiring: boolean;
  modalitiesActive: string[];
  indicationsActive: string[];
  licensingWindow: LicensingWindowResult;
  signals: string[];
}

interface AlertFeedItem {
  id: string;
  headline: string;
  date: string;
  ta: string | null;
  modality: string | null;
  licensor: string;
  licensee: string;
  upfrontM: number | null;
  totalValueM: number | null;
}

export async function GET(request: NextRequest) {
  const identifier = getIdentifier(request);
  const rateLimitResult = await checkRateLimit(identifier, 'signals', RATE_LIMIT_CONFIGS.calculations);

  if (!rateLimitResult.success) {
    return NextResponse.json(
      { success: false, error: 'Too many requests' },
      { status: 429, headers: getRateLimitHeaders(rateLimitResult) }
    );
  }

  try {
    const supabase = createServiceClient();
    const searchParams = request.nextUrl.searchParams;
    const section = searchParams.get('section') || 'all';
    const ta = searchParams.get('ta') || undefined;

    let userTier = 'free';
    let userId: string | null = null;
    try {
      const { createServerClient } = await import('@/lib/supabase/server');
      const authClient = await createServerClient();
      const { data: { user } } = await authClient.auth.getUser();
      if (user?.id) {
        userId = user.id;
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('tier')
          .eq('id', user.id)
          .single();
        userTier = profile?.tier || 'free';
        if (userTier === 'free' && user.email) {
          const { isProEmailClient } = await import('@/lib/config/authorized-emails.client');
          if (isProEmailClient(user.email)) userTier = 'pro';
        }
      }
    } catch {
      // No auth
    }

    const hasPro = userTier === 'pro' || userTier === 'portfolio';

    const result: {
      dealsToWatch?: DealToWatchCompany[];
      momentum?: MomentumSignal[];
      alertFeed?: AlertFeedItem[];
    } = {};

    if (section === 'all' || section === 'deals_to_watch') {
      result.dealsToWatch = await getDealsToWatch(supabase, ta, hasPro);
    }

    if (section === 'all' || section === 'momentum') {
      const quarters = await aggregateDealsByQuarter(supabase, { ta });
      const momentum = computeMomentumSignals(quarters);
      result.momentum = hasPro ? momentum : momentum.slice(0, 2);
    }

    if (section === 'all' || section === 'alert_feed') {
      result.alertFeed = await getAlertFeed(supabase, userId, ta, hasPro);
    }

    return NextResponse.json(
      {
        success: true,
        ...result,
        tier: userTier,
        meta: { timestamp: new Date().toISOString() },
      },
      {
        headers: {
          'Cache-Control': 'private, s-maxage=900, stale-while-revalidate=1800',
          ...getRateLimitHeaders(rateLimitResult),
        },
      }
    );
  } catch (err) {
    console.error('[signals] Error:', err);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}

async function getDealsToWatch(
  supabase: ReturnType<typeof createServiceClient>,
  targetTA: string | undefined,
  hasPro: boolean,
): Promise<DealToWatchCompany[]> {
  let query = supabase
    .from('companies')
    .select('id, name, company_type, deals_last_12mo, deals_last_24mo, last_deal_date, actively_acquiring, acquisition_appetite, modalities_active, indications_active, patent_cliffs, strategic_priorities, avg_upfront_usd')
    .or('actively_acquiring.eq.true,deals_last_12mo.gte.2,acquisition_appetite.in.(aggressive,moderate)')
    .order('deals_last_12mo', { ascending: false })
    .limit(30);

  if (targetTA) {
    query = query.contains('indications_active', [targetTA]);
  }

  const { data: companies, error } = await query;
  if (error || !companies) return [];

  const scored: DealToWatchCompany[] = companies.map(c => {
    let score = 0;
    const signals: string[] = [];

    const dealsRecent = c.deals_last_12mo || 0;
    score += Math.min(dealsRecent * 10, 30);
    if (dealsRecent >= 3) signals.push(`${dealsRecent} deals in last 12 months`);

    if (c.actively_acquiring) {
      score += 20;
      signals.push('Actively acquiring');
    }

    if (c.acquisition_appetite === 'aggressive') {
      score += 15;
      signals.push('Aggressive acquisition appetite');
    } else if (c.acquisition_appetite === 'moderate') {
      score += 8;
    }

    if (c.company_type === 'large_pharma') {
      score += 10;
    } else if (c.company_type === 'mid_pharma') {
      score += 5;
    }

    if (c.last_deal_date) {
      const monthsAgo = Math.round((Date.now() - new Date(c.last_deal_date).getTime()) / (30 * 24 * 60 * 60 * 1000));
      if (monthsAgo <= 3) {
        score += 10;
        signals.push(`Last deal ${monthsAgo}mo ago`);
      } else if (monthsAgo <= 6) {
        score += 5;
        signals.push(`Last deal ${monthsAgo}mo ago`);
      }
    }

    const intentScore = Math.min(score, 100);
    const intentTier = intentScore >= 80 ? 'very_high' : intentScore >= 60 ? 'high' : intentScore >= 40 ? 'moderate' : 'low';

    const window = computeLicensingWindow(
      {
        intentScore,
        lastDealDate: c.last_deal_date,
        activelyAcquiring: c.actively_acquiring || false,
        acquisitionAppetite: c.acquisition_appetite,
        indicationsActive: c.indications_active || [],
      },
      undefined,
      targetTA,
    );

    if (window.status === 'active') {
      score += 15;
      signals.push(`Active licensing window — ${window.patentCliffDrug} LOE ${window.patentCliffYear}`);
    } else if (window.status === 'closing') {
      score += 5;
    }

    return {
      id: c.id,
      name: c.name,
      companyType: c.company_type,
      intentScore: Math.min(score, 100),
      intentTier,
      dealsLast12mo: dealsRecent,
      lastDealDate: c.last_deal_date,
      acquisitionAppetite: c.acquisition_appetite,
      activelyAcquiring: c.actively_acquiring || false,
      modalitiesActive: c.modalities_active || [],
      indicationsActive: c.indications_active || [],
      licensingWindow: window,
      signals,
    };
  });

  scored.sort((a, b) => b.intentScore - a.intentScore);
  const top = scored.slice(0, 10);

  if (!hasPro) {
    return top.slice(0, 2).map(c => ({
      ...c,
      signals: c.signals.slice(0, 1),
    }));
  }

  return top;
}

async function getAlertFeed(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string | null,
  targetTA: string | undefined,
  hasPro: boolean,
): Promise<AlertFeedItem[]> {
  let userTAs: string[] = [];

  if (userId && !targetTA) {
    const { data: calcs } = await supabase
      .from('calculations')
      .select('therapeutic_area')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (calcs) {
      const taSet = new Set(calcs.map((c: { therapeutic_area: string | null }) => c.therapeutic_area).filter(Boolean));
      userTAs = Array.from(taSet) as string[];
    }
  }

  const filterTAs = targetTA ? [targetTA] : userTAs.length > 0 ? userTAs : [];

  let query = supabase
    .from('deals')
    .select('id, licensor_name, licensee_name, asset_name, upfront_usd, total_deal_value_usd, announced_date, therapeutic_area, modality')
    .eq('is_synthetic', false)
    .order('announced_date', { ascending: false })
    .limit(20);

  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  query = query.gte('announced_date', fourteenDaysAgo);

  if (filterTAs.length > 0) {
    query = query.in('therapeutic_area', filterTAs);
  }

  const { data: deals, error } = await query;
  if (error || !deals) return [];

  const items: AlertFeedItem[] = deals.map(d => ({
    id: d.id,
    headline: `${d.licensor_name} → ${d.licensee_name}${d.asset_name ? ` (${d.asset_name})` : ''}`,
    date: d.announced_date || '',
    ta: d.therapeutic_area,
    modality: d.modality,
    licensor: d.licensor_name,
    licensee: d.licensee_name,
    upfrontM: d.upfront_usd ? Math.round(d.upfront_usd / 1_000_000) : null,
    totalValueM: d.total_deal_value_usd ? Math.round(d.total_deal_value_usd / 1_000_000) : null,
  }));

  if (!hasPro) {
    return items.slice(0, 3).map(item => ({
      ...item,
      upfrontM: null,
      totalValueM: null,
    }));
  }

  return items;
}
