/**
 * Snapshot of counterparty premiums recomputed against the Supabase deals
 * table after migrations 051 + 053 flagged 845 fabricated + soft-fake rows.
 *
 * Source: R64 (2026-04-14) fresh query against cleaned production data.
 *   WITH peer_median AS (
 *     SELECT phase_at_signing, percentile_cont(0.5) WITHIN GROUP (...)
 *     FROM deals WHERE is_synthetic=false AND upfront_usd > 0
 *                AND announced_date >= '2020-01-01'
 *     GROUP BY phase_at_signing)
 *   SELECT licensee_name, COUNT(*), median(upfront/peer_median)
 *   FROM deals JOIN peer_median USING (phase_at_signing)
 *   WHERE is_synthetic=false GROUP BY licensee_name HAVING n>=3;
 *
 * This is 1,868 real deals vs the R49-era 2,697 raw rows (pre-cleanup).
 * The resulting premiums reflect 2020-2026 licensing activity with
 * fabricated data excluded.
 *
 * Key shifts vs prior snapshot (highlighted):
 *   AstraZeneca   1.047 → 1.312  (aggressive 2024-26 M&A: Gracell, ImmunoGen)
 *   Biogen        1.274 → 1.331  (Reata, Sage partnerships)
 *   GSK           1.035 → 1.320  (post-Affinivax, Spero, Bellus)
 *   Amgen         1.038 → 1.234  (ChemoCentryx, Horizon, Teneobio)
 *   Novo Nordisk  0.700 → 1.407  (Catalent, Embark, Inversago premiums)
 *   Novartis      1.345 → 1.289  (steady)
 *   Gilead        1.421 → 1.127  (softened post-Immunomedics digestion)
 *   Merck         0.958 → 0.893  (toughest buyer — Prometheus/Harpoon)
 *
 * Filters applied when curating:
 *   - Premiums < 0.15 excluded (structural mismatch — e.g., Zai Lab's
 *     0.011 reflects reverse licensing out of China, not a premium)
 *   - Premiums > 3.0 excluded (small-n outliers — J&J n=5 at 4.6 is the
 *     aliased rows; Sarepta n=3 at 15.7 is one Duchenne mega-deal)
 *   - Only buyers with n >= 3 after cleanup are kept
 *
 * Refreshed quarterly. Next refresh should use the same R64 query against
 * current Supabase state.
 */

export interface CounterpartyPremiumSnapshot {
  companyName: string;
  premiumMultiplier: number;
  sampleSize: number;
  confidence: 'high' | 'medium' | 'low';
}

export const COUNTERPARTY_PREMIUMS_SNAPSHOT: CounterpartyPremiumSnapshot[] = [
  // R64 refresh (2026-04-14) — recomputed against 1,868-deal cleaned corpus
  { companyName: 'AbbVie', premiumMultiplier: 1.000, sampleSize: 85, confidence: 'high' },
  { companyName: 'Sanofi', premiumMultiplier: 1.015, sampleSize: 69, confidence: 'high' },
  { companyName: 'Pfizer', premiumMultiplier: 1.060, sampleSize: 65, confidence: 'high' },
  { companyName: 'Novartis', premiumMultiplier: 1.289, sampleSize: 64, confidence: 'high' },
  { companyName: 'Merck', premiumMultiplier: 0.893, sampleSize: 60, confidence: 'high' },
  { companyName: 'Roche', premiumMultiplier: 0.930, sampleSize: 60, confidence: 'high' },
  { companyName: 'AstraZeneca', premiumMultiplier: 1.312, sampleSize: 56, confidence: 'high' },
  { companyName: 'Bristol-Myers Squibb', premiumMultiplier: 1.046, sampleSize: 53, confidence: 'high' },
  { companyName: 'Eli Lilly', premiumMultiplier: 1.061, sampleSize: 51, confidence: 'high' },
  { companyName: 'Gilead Sciences', premiumMultiplier: 1.127, sampleSize: 46, confidence: 'high' },
  { companyName: 'Biogen', premiumMultiplier: 1.331, sampleSize: 45, confidence: 'high' },
  { companyName: 'Johnson & Johnson', premiumMultiplier: 1.086, sampleSize: 42, confidence: 'high' },
  { companyName: 'Moderna', premiumMultiplier: 1.018, sampleSize: 41, confidence: 'high' },
  { companyName: 'Takeda', premiumMultiplier: 0.888, sampleSize: 41, confidence: 'high' },
  { companyName: 'GSK', premiumMultiplier: 1.320, sampleSize: 40, confidence: 'high' },
  { companyName: 'Amgen', premiumMultiplier: 1.234, sampleSize: 38, confidence: 'high' },
  { companyName: 'Boehringer Ingelheim', premiumMultiplier: 1.086, sampleSize: 35, confidence: 'high' },
  { companyName: 'Vertex', premiumMultiplier: 0.879, sampleSize: 34, confidence: 'high' },
  { companyName: 'Bayer', premiumMultiplier: 0.938, sampleSize: 33, confidence: 'high' },
  { companyName: 'Regeneron', premiumMultiplier: 0.803, sampleSize: 33, confidence: 'high' },
  { companyName: 'Novo Nordisk', premiumMultiplier: 1.407, sampleSize: 18, confidence: 'high' },
  // Medium confidence (n=5-9)
  { companyName: 'Astellas Pharma', premiumMultiplier: 0.669, sampleSize: 9, confidence: 'medium' },
  { companyName: 'Vertex Pharmaceuticals', premiumMultiplier: 0.700, sampleSize: 7, confidence: 'medium' },
  { companyName: 'Gilead', premiumMultiplier: 1.022, sampleSize: 6, confidence: 'medium' },
  { companyName: 'Seagen', premiumMultiplier: 0.589, sampleSize: 5, confidence: 'medium' },
  { companyName: 'Genentech', premiumMultiplier: 0.283, sampleSize: 5, confidence: 'medium' },
  { companyName: 'Astellas', premiumMultiplier: 0.700, sampleSize: 5, confidence: 'medium' },
  // Low confidence (n=3-4)
  { companyName: 'Neurocrine Biosciences', premiumMultiplier: 2.009, sampleSize: 4, confidence: 'low' },
  { companyName: 'Incyte', premiumMultiplier: 1.237, sampleSize: 4, confidence: 'low' },
  { companyName: 'BioNTech', premiumMultiplier: 0.776, sampleSize: 4, confidence: 'low' },
  { companyName: 'Shionogi', premiumMultiplier: 0.372, sampleSize: 3, confidence: 'low' },
];

/**
 * Common name aliases — collapses formatting variants that the upstream deal
 * corpus uses inconsistently (e.g., "Eli Lilly" vs "Eli Lilly and Co." vs
 * "Lilly"). When two snapshot rows exist for the same company, prefer the
 * one with the larger sample size (the more authoritative signal).
 *
 * Aliases all resolve to the canonical name we use as the snapshot key.
 */
const NAME_ALIASES: Record<string, string> = {
  // Lilly variants
  'eli lilly and co.': 'Eli Lilly',
  'lilly': 'Eli Lilly',
  'eli lilly & co': 'Eli Lilly',
  // J&J variants
  'janssen': 'Johnson & Johnson',
  'janssen (j&j)': 'Johnson & Johnson',
  'janssen pharmaceutical': 'Johnson & Johnson',
  'janssen pharmaceuticals': 'Johnson & Johnson',
  'j&j': 'Johnson & Johnson',
  'jnj': 'Johnson & Johnson',
  // BMS variants
  'bms': 'Bristol-Myers Squibb',
  'bristol-myers': 'Bristol-Myers Squibb',
  'bristol myers squibb': 'Bristol-Myers Squibb',
  // Vertex variants
  'vertex pharmaceuticals': 'Vertex',
  // Gilead variants
  'gilead': 'Gilead Sciences',
  // GSK variants
  'glaxosmithkline': 'GSK',
  // Madrigal variants
  'madrigal pharmaceuticals': 'Madrigal Pharmaceuticals, Inc.',
  'madrigal': 'Madrigal Pharmaceuticals, Inc.',
};

/**
 * Resolve a buyer name to a canonical snapshot key. Returns the trimmed
 * lower-cased input when no alias matches (lookup will then miss → premium
 * defaults to 1.0× upstream).
 */
export function resolveCounterpartyName(rawLicensee: string | null | undefined): string | null {
  if (!rawLicensee) return null;
  const trimmed = rawLicensee.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  return NAME_ALIASES[lower] ?? trimmed;
}

/**
 * Look up the premium multiplier for a buyer, with name normalization.
 * Returns null when the buyer has fewer than the threshold of disclosed deals
 * (calling code should treat null as "use 1.0× — no actionable premium").
 */
const PREMIUM_INDEX = new Map<string, CounterpartyPremiumSnapshot>();
for (const p of COUNTERPARTY_PREMIUMS_SNAPSHOT) {
  const key = (NAME_ALIASES[p.companyName.toLowerCase()] ?? p.companyName).toLowerCase();
  // When two aliased rows resolve to the same canonical key, prefer the row
  // with the larger sample (more authoritative signal).
  const existing = PREMIUM_INDEX.get(key);
  if (!existing || p.sampleSize > existing.sampleSize) {
    PREMIUM_INDEX.set(key, p);
  }
}

export function getCounterpartyPremiumMultiplier(
  rawLicensee: string | null | undefined,
  options: { minSampleSize?: number } = {},
): number | null {
  const minN = options.minSampleSize ?? 3;
  const canonical = resolveCounterpartyName(rawLicensee);
  if (!canonical) return null;
  const row = PREMIUM_INDEX.get(canonical.toLowerCase());
  if (!row || row.sampleSize < minN) return null;
  return row.premiumMultiplier;
}
