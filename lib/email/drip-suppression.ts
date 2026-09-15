/**
 * Drip suppression for lifecycle email crons.
 *
 * user_profiles.drip_suppressed_until (migration 108) marks accounts that are
 * receiving a founder-led personal sequence. While it is in the future, the
 * automated crons must not touch the user: no onboarding drip, no
 * calculation-triggered conversion email, no smart trial extension, no
 * post-trial drip or comeback promo.
 *
 * Usage inside a cron's user_profiles query:
 *
 *   .or(dripSuppressionFilter(now))
 *
 * The filter passes users whose column is NULL or already in the past.
 */

export const DRIP_SUPPRESSION_COLUMN = 'drip_suppressed_until' as const;

/** PostgREST `or` filter string: column is null, or column < now. */
export function dripSuppressionFilter(now: Date = new Date()): string {
  return `${DRIP_SUPPRESSION_COLUMN}.is.null,${DRIP_SUPPRESSION_COLUMN}.lt.${now.toISOString()}`;
}

/** In-memory guard for rows already fetched; mirrors dripSuppressionFilter. */
export function isDripSuppressed(
  row: { drip_suppressed_until?: string | null },
  now: Date = new Date(),
): boolean {
  const until = row.drip_suppressed_until;
  if (!until) return false;
  const ts = new Date(until).getTime();
  return Number.isFinite(ts) && ts > now.getTime();
}
