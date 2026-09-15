/**
 * Deal quality filter — the one place that decides which rows of `deals`
 * are fit to show a user.
 *
 * Background (audit 2026-09-14): the April 2026 fabrication cleanup deleted
 * the 766 rows it had meant to flag, so `is_synthetic=true` matched nothing
 * and every reader that relied on it as its fake filter was showing 164
 * rejected and 856 flagged rows on public pages. The comparable-deals engine
 * already excluded those statuses; the therapeutic-area pages, company pages,
 * partner matching, the public API and the weekly digest did not.
 *
 * Two tiers:
 *   applyDealQualityFilter(q)                      — "tracked": not synthetic,
 *     canonical (or pre-dedupe NULL), and not flagged/rejected by the verifier.
 *   applyDealQualityFilter(q, { verifiedOnly })    — "verified": human- or
 *     verifier-confirmed rows, which by the Aug 2026 trigger always carry a
 *     citation (source_url, press_release_url or source_filing_id).
 *
 * Use the first for browsing and counting, the second when a number is going
 * to be quoted to a client or published as "verified".
 */

/** Minimal structural type: anything with chainable eq/or (PostgrestFilterBuilder). */
export interface DealQualityQuery<T> {
  eq(column: string, value: unknown): T;
  or(filters: string): T;
}

export interface DealQualityOptions {
  /** Only rows with verified=true (each carries a citation). */
  verifiedOnly?: boolean;
}

/** Verifier statuses that disqualify a row from any user-facing surface. */
export const DEAL_EXCLUDED_STATUSES = ['rejected', 'flagged'] as const;

/** PostgREST `or` expression that keeps canonical rows (NULL = pre-dedupe, kept). */
export const DEAL_CANONICAL_OR = 'is_canonical.is.null,is_canonical.eq.true';

/** PostgREST `or` expression that keeps rows the verifier has not disqualified. */
export const DEAL_STATUS_OR = `verification_status.is.null,verification_status.not.in.(${DEAL_EXCLUDED_STATUSES.map(s => `"${s}"`).join(',')})`;

/**
 * Apply the canonical quality filter to a Supabase query builder and return it.
 * Safe to call on a builder that already has other filters; PostgREST ANDs
 * every `or` group.
 */
export function applyDealQualityFilter<T>(
  query: T,
  options: DealQualityOptions = {},
): T {
  // PostgrestFilterBuilder methods return `this`, so the builder type is
  // preserved; the structural cast keeps TypeScript from expanding Supabase's
  // deeply generic builder types (TS2589) at every call site.
  const q = query as unknown as DealQualityQuery<unknown>;
  let out = q.eq('is_synthetic', false) as DealQualityQuery<unknown>;
  out = out.or(DEAL_CANONICAL_OR) as DealQualityQuery<unknown>;
  out = (options.verifiedOnly ? out.eq('verified', true) : out.or(DEAL_STATUS_OR)) as DealQualityQuery<unknown>;
  return out as unknown as T;
}

/**
 * Same rule as a SQL predicate, for raw queries and migrations.
 * Keep in sync with applyDealQualityFilter.
 */
export const DEAL_QUALITY_SQL_PREDICATE =
  "COALESCE(is_synthetic, false) = false AND COALESCE(is_canonical, true) = true AND COALESCE(verification_status, '') NOT IN ('rejected', 'flagged')";

export const DEAL_VERIFIED_SQL_PREDICATE =
  'COALESCE(is_synthetic, false) = false AND COALESCE(is_canonical, true) = true AND COALESCE(verified, false) = true';
