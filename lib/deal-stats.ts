/**
 * Live deal-corpus statistics for public copy (counts, coverage), read from the
 * database and cached for 15 minutes. Server-side only.
 *
 * Why (Sep 25 2026): the site's headline count was a build-time constant that a
 * cron rewrote through the GitHub API. The token behind that cron died on Sep 16,
 * so the site said "1,400+" while the table held 1,900+ real rows. Server pages
 * now read this; LIVE_DEAL_COUNT stays only as the fallback and for client
 * components that cannot query.
 *
 * The count definition matches /api/cron/daily-stats and /api/deals/stats:
 * real rows (is_synthetic = false), therapeutic_area not 'other' and not an
 * internal rotation label ('_mega_deals' etc.).
 */
import { unstable_cache } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/server';
import { LIVE_DEAL_COUNT, formatDealCount } from '@/lib/config/constants';

export interface LiveDealStats {
  totalDeals: number;
  /** Rounded-down display form, e.g. "1,900+". */
  totalDealsDisplay: string;
  verifiedDeals: number;
  citedDeals: number;
  therapeuticAreas: number;
  sourceTypes: number;
  licensorCountries: number;
  earliestYear: number;
  latestYear: number;
  /** ISO timestamp of the newest row, i.e. when the corpus last grew. */
  lastAddedAt: string | null;
  /** True when the numbers came from the fallback constant, not the database. */
  fallback: boolean;
}

const FALLBACK: LiveDealStats = {
  totalDeals: LIVE_DEAL_COUNT,
  totalDealsDisplay: formatDealCount(LIVE_DEAL_COUNT),
  verifiedDeals: 0,
  citedDeals: 0,
  therapeuticAreas: 12,
  sourceTypes: 10,
  licensorCountries: 20,
  earliestYear: 2017,
  latestYear: new Date().getUTCFullYear(),
  lastAddedAt: null,
  fallback: true,
};

async function queryLiveDealStats(): Promise<LiveDealStats> {
  const supabase = createServiceClient();
  const real = supabase.from('deals').select('*', { count: 'exact', head: true }).eq('is_synthetic', false);
  const [total, verified, cited, tas, sources, countries, years, newest] = await Promise.all([
    supabase.from('deals').select('*', { count: 'exact', head: true }).eq('is_synthetic', false).not('therapeutic_area', 'eq', 'other').not('therapeutic_area', 'like', '\\__%'),
    supabase.from('deals').select('*', { count: 'exact', head: true }).eq('is_synthetic', false).eq('verification_status', 'verified'),
    supabase.from('deals').select('*', { count: 'exact', head: true }).eq('is_synthetic', false).or('source_url.not.is.null,press_release_url.not.is.null,source_filing_id.not.is.null'),
    supabase.rpc('count_distinct_deal_column', { p_column: 'therapeutic_area' }).then(r => r, () => ({ data: null, error: { message: 'rpc missing' } })),
    supabase.rpc('count_distinct_deal_column', { p_column: 'source_type' }).then(r => r, () => ({ data: null, error: { message: 'rpc missing' } })),
    supabase.rpc('count_distinct_deal_column', { p_column: 'licensor_country' }).then(r => r, () => ({ data: null, error: { message: 'rpc missing' } })),
    supabase.from('deals').select('announced_date').eq('is_synthetic', false).gte('announced_date', '2010-01-01').order('announced_date', { ascending: true }).limit(1).maybeSingle(),
    supabase.from('deals').select('created_at').eq('is_synthetic', false).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  void real;
  if (total.error || total.count == null) throw new Error(total.error?.message ?? 'count failed');
  const now = new Date().getUTCFullYear();
  const earliest = years.data?.announced_date ? Number(String(years.data.announced_date).slice(0, 4)) : 2017;
  return {
    totalDeals: total.count,
    totalDealsDisplay: formatDealCount(total.count),
    verifiedDeals: verified.count ?? 0,
    citedDeals: cited.count ?? 0,
    therapeuticAreas: typeof tas.data === 'number' && tas.data > 0 ? tas.data : FALLBACK.therapeuticAreas,
    sourceTypes: typeof sources.data === 'number' && sources.data > 0 ? sources.data : FALLBACK.sourceTypes,
    licensorCountries: typeof countries.data === 'number' && countries.data > 0 ? countries.data : FALLBACK.licensorCountries,
    earliestYear: Number.isFinite(earliest) && earliest >= 2000 ? earliest : 2017,
    latestYear: now,
    lastAddedAt: newest.data?.created_at ?? null,
    fallback: false,
  };
}

const cached = unstable_cache(queryLiveDealStats, ['live-deal-stats-v1'], { revalidate: 900, tags: ['deal-stats'] });

/** Cached 15 minutes; never throws — falls back to the compile-time constant. */
export async function getLiveDealStats(): Promise<LiveDealStats> {
  try {
    return await cached();
  } catch (e) {
    console.error('[deal-stats] live query failed, using fallback:', e);
    return FALLBACK;
  }
}
