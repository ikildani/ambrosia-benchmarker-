/**
 * Internal-link targets for therapeutic areas.
 *
 * Generated blog content used to link to `/benchmarks?ta=<key>`. Those URLs
 * canonicalise to `/benchmarks`, so Google logged every one of them as
 * "Alternate page with proper canonical tag" and wasted crawl budget on
 * them. Every TA has a real, indexable landing page at
 * `/therapeutic-areas/<key>` — link there instead.
 */

/** Route keys served by app/therapeutic-areas/[ta]/page.tsx (TA_CONFIG). */
export const TA_ROUTE_KEYS = [
  'oncology',
  'neurology',
  'immunology',
  'cardiovascular',
  'metabolic',
  'rareDisease',
  'infectiousDisease',
  'ophthalmology',
  'dermatology',
  'womensHealth',
  'gastroenterology',
  'hematology',
] as const;

export type TaRouteKey = (typeof TA_ROUTE_KEYS)[number];

const TA_ROUTE_SET: ReadonlySet<string> = new Set(TA_ROUTE_KEYS);

export function isTaRouteKey(value: string | null | undefined): value is TaRouteKey {
  return !!value && TA_ROUTE_SET.has(value);
}

/**
 * Best indexable internal link for a therapeutic-area key.
 * Unknown or pseudo keys (`_mega_deals`, `other`, …) fall back to the
 * benchmarks index rather than producing a query-string URL.
 */
export function taBenchmarkHref(ta: string | null | undefined): string {
  return isTaRouteKey(ta) ? `/therapeutic-areas/${ta}` : '/benchmarks';
}

const QUERY_LINK_RE = /\/benchmarks\?ta=([A-Za-z0-9_-]+)/g;

/**
 * Rewrite any `/benchmarks?ta=<key>` links inside stored HTML/Markdown to
 * their canonical page. Used by the one-off backfill script and safe to run
 * repeatedly (idempotent).
 */
export function rewriteTaQueryLinks(content: string): { content: string; replaced: number } {
  let replaced = 0;
  const out = content.replace(QUERY_LINK_RE, (_m, key: string) => {
    replaced += 1;
    return taBenchmarkHref(key);
  });
  return { content: out, replaced };
}
