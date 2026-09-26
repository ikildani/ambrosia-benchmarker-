/**
 * Deal Intelligence Brief v3 — regional deal strategy (pure).
 *
 * Maps free-text `deals.territory` strings onto RegionKey buckets, computes
 * per-region upfront / total quartiles, and writes a deterministic
 * keep-global vs carve-out recommendation.
 */

import type { AssetProfile, CompRow, RegionKey, RegionalStrategy } from './types';
import { quartiles } from './comp-set';

export const REGION_LABELS: Record<RegionKey, string> = {
  global: 'Global',
  us: 'United States',
  ex_us: 'Ex-US',
  europe: 'Europe',
  japan: 'Japan',
  greater_china: 'Greater China',
  ex_china: 'Ex-China',
  asia_pacific: 'Asia-Pacific',
  other: 'Other / regional',
};

const REGION_ORDER: RegionKey[] = ['global', 'us', 'ex_us', 'europe', 'japan', 'greater_china', 'ex_china', 'asia_pacific', 'other'];

/**
 * Tolerant territory → RegionKey mapper. Handles the enum keys seen in prod
 * (global, ex_us, ex_china, china, europe, japan, us_only, us, asia_pacific,
 * regional, other) plus free text ("Greater China", "ex-Greater China",
 * "global ex-Greater China", "global excluding Japan", "South Korea", …).
 * Unknown text maps to `other`.
 */
export function mapTerritory(territory: string | null | undefined): RegionKey {
  if (!territory) return 'other';
  const t = territory.toLowerCase().trim();
  if (!t) return 'other';
  const k = t.replace(/[^a-z0-9]+/g, '_');

  // Exclusions first: "ex_us", "ex-greater china", "global ex-china", "worldwide excluding china".
  const excludes = /(^|[^a-z])(ex|excl|excluding|outside|except)[^a-z]?/;
  if (excludes.test(t)) {
    if (/china/.test(t)) return 'ex_china';
    if (/(^|[^a-z])(us|usa|u\.s\.|united_states|north_america)($|[^a-z])/.test(k) || /(ex[-_ ]?us|ex[-_ ]?north america)/.test(t)) return 'ex_us';
    return 'other'; // e.g. "global excluding Japan" — no matching key
  }

  if (k === 'global' || k === 'worldwide' || k === 'ww' || k === 'world') return 'global';
  if (k === 'us' || k === 'usa' || k === 'us_only' || k === 'united_states' || k === 'us_eu' || k === 'north_america') return 'us';
  if (k === 'europe' || k === 'eu' || k === 'emea' || k === 'eu_only' || /^europe/.test(k)) return 'europe';
  if (k === 'japan' || k === 'japan_only' || /^japan/.test(k)) return 'japan';
  if (k === 'china' || k === 'china_only' || k === 'greater_china' || /china|hong_kong|macau|taiwan/.test(k)) return 'greater_china';
  if (k === 'asia_pacific' || k === 'apac' || k === 'asia' || /korea|asia|apac|australia|singapore/.test(k)) return 'asia_pacific';
  return 'other';
}

function fmtMoney(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—';
  if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(1)}B`;
  return `$${v.toFixed(0)}M`;
}

export function buildRegionalStrategy(rows: CompRow[], asset: AssetProfile, asOf: string): RegionalStrategy {
  const groups = new Map<RegionKey, CompRow[]>();
  rows.forEach((r) => {
    const key = mapTerritory(r.territory);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  });

  const globalRows = groups.get('global') ?? [];
  const globalUpfront = quartiles(globalRows.map((r) => r.upfrontM));

  const out: RegionalStrategy['rows'] = REGION_ORDER
    .filter((key) => (groups.get(key)?.length ?? 0) > 0)
    .map((key) => {
      const rs = groups.get(key)!;
      const upfront = quartiles(rs.map((r) => r.upfrontM));
      const total = quartiles(rs.map((r) => r.totalM));
      const ex = [...rs].sort((a, b) => b.relevance - a.relevance || (b.year ?? 0) - (a.year ?? 0))[0];
      const upfrontVsGlobal = key !== 'global' && upfront && globalUpfront && globalUpfront.p50 > 0
        ? upfront.p50 / globalUpfront.p50
        : key === 'global' && upfront ? 1 : null;
      return {
        region: key,
        label: REGION_LABELS[key],
        n: rs.length,
        upfront,
        total,
        upfrontVsGlobal,
        exampleDeal: ex ? { parties: `${ex.licensor} → ${ex.licensee}`, year: ex.year, upfrontM: ex.upfrontM } : null,
      };
    });

  // Recommendation: a region is "priced" when n ≥ 3 and its median upfront ≥ 35% of the global median.
  const priced = out
    .filter((r) => r.region !== 'global' && r.region !== 'other' && r.n >= 3 && r.upfrontVsGlobal != null && r.upfrontVsGlobal >= 0.35)
    .sort((a, b) => (b.upfrontVsGlobal ?? 0) - (a.upfrontVsGlobal ?? 0));

  const assetRegion = mapTerritory(asset.territory);
  const assetScope = assetRegion === 'global' ? 'a global deal' : `${REGION_LABELS[assetRegion]} rights`;

  let recommendation: string;
  if (priced.length > 0) {
    const best = priced[0];
    const pct = Math.round((best.upfrontVsGlobal ?? 0) * 100);
    recommendation = `A ${best.label} carve-out is priced in the data: ${best.n} deals with a median upfront of ${fmtMoney(best.upfront?.p50)} (${pct}% of the global median). Consider running ${best.label} rights as a separate track alongside ${assetScope}, and only concede them inside a global deal if the global upfront rises by at least that amount.`;
  } else {
    recommendation = `Regional data is thin: no region other than global has three or more deals with a median upfront at 35% or more of the global median. Keep ${assetScope} as the base case unless a regional buyer is on the list, in which case price the carve-out against the global median rather than the regional rows.`;
  }

  const globalN = globalRows.length;
  const regionalN = rows.length - globalN;
  return {
    source: {
      source: 'Solidus deal database',
      n: rows.length,
      asOf,
      note: `${globalN} global, ${regionalN} regional; territory mapped from deal filings`,
    },
    rows: out,
    recommendation,
  };
}
