import 'server-only';
import { unstable_cache } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/server';
import { runVerifiedCohortBacktest, type VerifiedCohortReport } from '@/lib/financial/backtest/verified-cohort';

/**
 * Live figures for /methodology and /api/methodology/stats.
 *
 * Every count is defined in lib/financial/methodology-copy.ts (DATA_LEVELS) and
 * computed here with the same filters the public surfaces use, so the page
 * cannot claim a number the product does not enforce. Cached for one hour.
 */

export interface MethodologyCounts {
  /** Canonical, not synthetic, not flagged or rejected. */
  tracked: number;
  /** Tracked rows with a citation. */
  sourced: number;
  /** Verified rows with a citation (canonical, not synthetic). */
  verifiedCited: number;
  /** Rows quarantined as fabricated or rejected in review. */
  quarantined: number;
  /** Distinct licensors + licensees among tracked rows. */
  companies: number;
  /** Earliest and latest announced_date among tracked rows. */
  firstYear: number | null;
  lastYear: number | null;
}

export interface MethodologyStats {
  measuredAt: string;
  counts: MethodologyCounts;
  accuracy: VerifiedCohortReport;
}

const TRACKED = "and(or(is_synthetic.is.null,is_synthetic.eq.false),or(is_canonical.is.null,is_canonical.eq.true),or(verification_status.is.null,verification_status.not.in.(\"flagged\",\"rejected\")))";
const HAS_CITATION = 'or(source_url.not.is.null,press_release_url.not.is.null,source_filing_id.not.is.null)';

async function computeStats(): Promise<MethodologyStats> {
  const supabase = createServiceClient();

  const count = async (filter: string) => {
    const { count, error } = await supabase
      .from('deals')
      .select('id', { count: 'exact', head: true })
      .or(filter);
    if (error) throw new Error(`methodology count failed: ${error.message}`);
    return count ?? 0;
  };

  const [tracked, sourced, verifiedCited, quarantined] = await Promise.all([
    count(TRACKED),
    count(`and(${TRACKED},${HAS_CITATION})`),
    count(`and(verified.eq.true,${TRACKED},${HAS_CITATION})`),
    count('or(is_synthetic.eq.true,verification_status.eq.rejected)'),
  ]);

  // Companies and date span come from one lightweight select over tracked rows.
  const { data: span } = await supabase
    .from('deals')
    .select('licensor_name, licensee_name, announced_date')
    .or(TRACKED)
    .limit(5000);
  const names = new Set<string>();
  let firstYear: number | null = null;
  let lastYear: number | null = null;
  for (const r of span ?? []) {
    if (r.licensor_name) names.add(r.licensor_name.trim().toLowerCase());
    if (r.licensee_name) names.add(r.licensee_name.trim().toLowerCase());
    const y = r.announced_date ? new Date(r.announced_date).getFullYear() : NaN;
    if (Number.isFinite(y)) {
      firstYear = firstYear === null ? y : Math.min(firstYear, y);
      lastYear = lastYear === null ? y : Math.max(lastYear, y);
    }
  }

  const accuracy = await runVerifiedCohortBacktest(supabase);

  return {
    measuredAt: new Date().toISOString(),
    counts: { tracked, sourced, verifiedCited, quarantined, companies: names.size, firstYear, lastYear },
    accuracy,
  };
}

export const getMethodologyStats = unstable_cache(computeStats, ['methodology-stats-v1'], {
  revalidate: 3600,
  tags: ['methodology-stats'],
});
