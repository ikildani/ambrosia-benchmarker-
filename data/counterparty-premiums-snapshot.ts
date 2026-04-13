/**
 * Snapshot of `counterparty_premiums` table for sync use in the backtest.
 *
 * Source: pulled from production Supabase 2026-04-13 via:
 *   SELECT company_name, premium_multiplier, sample_size, confidence
 *   FROM counterparty_premiums ORDER BY sample_size DESC;
 *
 * Refreshed quarterly when the cron at app/api/cron/counterparty-calibration
 * recomputes premiums from disclosed deals. Manual refresh via:
 *   set -a && source .env.local && set +a && \
 *   npx tsx scripts/snapshot-counterparty-premiums.ts
 */

export interface CounterpartyPremiumSnapshot {
  companyName: string;
  premiumMultiplier: number;
  sampleSize: number;
  confidence: 'high' | 'medium' | 'low';
}

export const COUNTERPARTY_PREMIUMS_SNAPSHOT: CounterpartyPremiumSnapshot[] = [
  { companyName: 'Sanofi', premiumMultiplier: 1.079, sampleSize: 58, confidence: 'high' },
  { companyName: 'AbbVie', premiumMultiplier: 1.365, sampleSize: 51, confidence: 'high' },
  { companyName: 'AstraZeneca', premiumMultiplier: 1.047, sampleSize: 47, confidence: 'high' },
  { companyName: 'Roche', premiumMultiplier: 1.363, sampleSize: 40, confidence: 'high' },
  { companyName: 'Merck', premiumMultiplier: 0.958, sampleSize: 40, confidence: 'high' },
  { companyName: 'Novartis', premiumMultiplier: 1.345, sampleSize: 38, confidence: 'high' },
  { companyName: 'Gilead Sciences', premiumMultiplier: 1.421, sampleSize: 34, confidence: 'high' },
  { companyName: 'Biogen', premiumMultiplier: 1.274, sampleSize: 30, confidence: 'high' },
  { companyName: 'Bristol-Myers Squibb', premiumMultiplier: 1.279, sampleSize: 30, confidence: 'high' },
  { companyName: 'Johnson & Johnson', premiumMultiplier: 1.048, sampleSize: 28, confidence: 'high' },
  { companyName: 'Eli Lilly', premiumMultiplier: 1.090, sampleSize: 26, confidence: 'high' },
  { companyName: 'Regeneron', premiumMultiplier: 0.850, sampleSize: 25, confidence: 'high' },
  { companyName: 'Amgen', premiumMultiplier: 1.038, sampleSize: 23, confidence: 'high' },
  { companyName: 'Pfizer', premiumMultiplier: 1.043, sampleSize: 23, confidence: 'high' },
  { companyName: 'Bayer', premiumMultiplier: 1.344, sampleSize: 20, confidence: 'high' },
  { companyName: 'Takeda', premiumMultiplier: 0.895, sampleSize: 19, confidence: 'high' },
  { companyName: 'Novo Nordisk', premiumMultiplier: 0.700, sampleSize: 18, confidence: 'high' },
  { companyName: 'Moderna', premiumMultiplier: 0.792, sampleSize: 17, confidence: 'high' },
  { companyName: 'Eli Lilly and Co.', premiumMultiplier: 1.428, sampleSize: 16, confidence: 'high' },
  { companyName: 'GSK', premiumMultiplier: 1.035, sampleSize: 15, confidence: 'high' },
  { companyName: 'Vertex', premiumMultiplier: 1.191, sampleSize: 15, confidence: 'high' },
  { companyName: 'Boehringer Ingelheim', premiumMultiplier: 1.147, sampleSize: 13, confidence: 'high' },
  { companyName: 'Vertex Pharmaceuticals', premiumMultiplier: 0.854, sampleSize: 6, confidence: 'medium' },
  { companyName: 'Astellas Pharma', premiumMultiplier: 1.500, sampleSize: 6, confidence: 'medium' },
  { companyName: 'Sun Pharma', premiumMultiplier: 0.785, sampleSize: 6, confidence: 'medium' },
  { companyName: 'Janssen (J&J)', premiumMultiplier: 1.500, sampleSize: 5, confidence: 'medium' },
  { companyName: 'Neurocrine Biosciences', premiumMultiplier: 1.319, sampleSize: 4, confidence: 'low' },
  { companyName: 'Sarepta Therapeutics', premiumMultiplier: 0.879, sampleSize: 4, confidence: 'low' },
  { companyName: 'Alexion Pharmaceuticals', premiumMultiplier: 0.845, sampleSize: 3, confidence: 'low' },
  { companyName: 'Organon', premiumMultiplier: 1.490, sampleSize: 3, confidence: 'low' },
  { companyName: 'Viatris', premiumMultiplier: 0.700, sampleSize: 3, confidence: 'low' },
  { companyName: 'BioMarin', premiumMultiplier: 1.319, sampleSize: 3, confidence: 'low' },
  { companyName: 'Seagen', premiumMultiplier: 1.479, sampleSize: 3, confidence: 'low' },
  { companyName: 'Alnylam Pharmaceuticals', premiumMultiplier: 1.500, sampleSize: 3, confidence: 'low' },
  { companyName: 'Incyte', premiumMultiplier: 0.700, sampleSize: 3, confidence: 'low' },
  { companyName: 'Madrigal Pharmaceuticals, Inc.', premiumMultiplier: 1.384, sampleSize: 3, confidence: 'low' },
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
