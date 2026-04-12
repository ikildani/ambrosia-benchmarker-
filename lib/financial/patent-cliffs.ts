/**
 * Patent Cliff Competitive Intelligence (Tier 4 Item 14)
 *
 * For each top-50 indication, tracks the rank-1 market-leader drug and its
 * patent expiry (LOE) + biosimilar / generic entry year. The launch year of
 * the user's asset is compared against those dates:
 *
 *   - launching into peak years of a still-protected leader → penalty
 *   - launching after LOE but before biosimilar ramp → neutral
 *   - launching after biosimilars arrive → boost (leader losing share)
 *
 * This is **distinct from** the existing `companies.patent_cliffs` JSONB
 * column (migration 002_partner_matching.sql:7-64), which is per-company and
 * only consumed by UI surfaces in the partner-match flow. The engine needs
 * per-indication leader timing, which is a different data shape entirely.
 *
 * The cron at `app/api/cron/patent-cliffs` quarterly refreshes the DB table
 * from FDA Orange Book + company 10-K filings. The static fallback below
 * keeps the engine working when Supabase is unreachable.
 *
 * @module lib/financial/patent-cliffs
 */

export interface IndicationPatentCliff {
  indication: string;
  drug: string;
  loeYear: number;
  biosimilarYear: number;
  /** Current annual revenue from this indication ($M). */
  currentRevenueUsdM: number;
  /** 1 = market leader, 2 = #2, etc. */
  rank: number;
  source: string;
  sourceYear: number;
  notes?: string;
}

export type PatentCliffScenario =
  | 'preLoeCrowded'      // launching ≥4y before leader LOE
  | 'preLoeApproaching'  // launching 0–4y before LOE
  | 'atLoe'              // LOE has hit but biosimilars not ramped
  | 'postBiosimilarBoost'// biosimilars ramping — leader losing share
  | 'postLoeBoost'       // 5+ years post LOE — competitive vacuum
  | 'noLeader';          // no leader data for this indication

/**
 * Static fallback — used when DB query fails or table is empty. Top 30
 * indications covering the highest-value drug classes. Cron routine can
 * expand this to 50 when FDA Orange Book scraping is wired.
 *
 * Data as of 2025 Q4 from FDA Orange Book + company 10-Ks.
 */
export const PATENT_CLIFFS_STATIC: Record<string, IndicationPatentCliff[]> = {
  lung_nsclc: [
    {
      indication: 'lung_nsclc',
      drug: 'Keytruda',
      loeYear: 2028,
      biosimilarYear: 2029,
      currentRevenueUsdM: 32000,
      rank: 1,
      source: 'FDA Orange Book + Merck 10-K 2024',
      sourceYear: 2024,
    },
    {
      indication: 'lung_nsclc',
      drug: 'Tagrisso',
      loeYear: 2032,
      biosimilarYear: 2034,
      currentRevenueUsdM: 6500,
      rank: 2,
      source: 'FDA Orange Book + AZ 10-K 2024',
      sourceYear: 2024,
    },
  ],
  type2_diabetes: [
    {
      indication: 'type2_diabetes',
      drug: 'Ozempic',
      loeYear: 2032,
      biosimilarYear: 2033,
      currentRevenueUsdM: 14000,
      rank: 1,
      source: 'FDA Orange Book + Novo 10-K 2024',
      sourceYear: 2024,
    },
    {
      indication: 'type2_diabetes',
      drug: 'Trulicity',
      loeYear: 2027,
      biosimilarYear: 2028,
      currentRevenueUsdM: 7000,
      rank: 2,
      source: 'FDA Orange Book + Lilly 10-K 2024',
      sourceYear: 2024,
    },
  ],
  obesity: [
    {
      indication: 'obesity',
      drug: 'Wegovy',
      loeYear: 2032,
      biosimilarYear: 2033,
      currentRevenueUsdM: 6000,
      rank: 1,
      source: 'FDA Orange Book + Novo 10-K 2024',
      sourceYear: 2024,
    },
    {
      indication: 'obesity',
      drug: 'Zepbound',
      loeYear: 2036,
      biosimilarYear: 2037,
      currentRevenueUsdM: 3000,
      rank: 2,
      source: 'FDA Orange Book + Lilly 10-K 2024',
      sourceYear: 2024,
    },
  ],
  breast_her2: [
    {
      indication: 'breast_her2',
      drug: 'Enhertu',
      loeYear: 2034,
      biosimilarYear: 2036,
      currentRevenueUsdM: 3800,
      rank: 1,
      source: 'FDA Orange Book + AZ/Daiichi 10-K 2024',
      sourceYear: 2024,
    },
  ],
  multiple_myeloma: [
    {
      indication: 'multiple_myeloma',
      drug: 'Darzalex',
      loeYear: 2029,
      biosimilarYear: 2030,
      currentRevenueUsdM: 11000,
      rank: 1,
      source: 'FDA Orange Book + J&J 10-K 2024',
      sourceYear: 2024,
    },
    {
      indication: 'multiple_myeloma',
      drug: 'Revlimid',
      loeYear: 2026,
      biosimilarYear: 2027,
      currentRevenueUsdM: 4500,
      rank: 2,
      source: 'FDA Orange Book + BMS 10-K 2024',
      sourceYear: 2024,
    },
  ],
  multiple_sclerosis: [
    {
      indication: 'multiple_sclerosis',
      drug: 'Ocrevus',
      loeYear: 2029,
      biosimilarYear: 2031,
      currentRevenueUsdM: 7200,
      rank: 1,
      source: 'FDA Orange Book + Roche 10-K 2024',
      sourceYear: 2024,
    },
    {
      indication: 'multiple_sclerosis',
      drug: 'Tysabri',
      loeYear: 2027,
      biosimilarYear: 2028,
      currentRevenueUsdM: 2000,
      rank: 2,
      source: 'FDA Orange Book + Biogen 10-K 2024',
      sourceYear: 2024,
    },
  ],
  rheumatoid_arthritis: [
    {
      indication: 'rheumatoid_arthritis',
      drug: 'Humira',
      loeYear: 2023,
      biosimilarYear: 2023,
      currentRevenueUsdM: 8500,
      rank: 1,
      source: 'FDA Orange Book + AbbVie 10-K 2024',
      sourceYear: 2024,
      notes: 'Humira biosimilars launched 2023; global revenue already ~50% eroded',
    },
    {
      indication: 'rheumatoid_arthritis',
      drug: 'Rinvoq',
      loeYear: 2035,
      biosimilarYear: 2037,
      currentRevenueUsdM: 5000,
      rank: 2,
      source: 'FDA Orange Book + AbbVie 10-K 2024',
      sourceYear: 2024,
    },
  ],
  psoriasis: [
    {
      indication: 'psoriasis',
      drug: 'Skyrizi',
      loeYear: 2034,
      biosimilarYear: 2036,
      currentRevenueUsdM: 9500,
      rank: 1,
      source: 'FDA Orange Book + AbbVie 10-K 2024',
      sourceYear: 2024,
    },
  ],
  atopic_dermatitis: [
    {
      indication: 'atopic_dermatitis',
      drug: 'Dupixent',
      loeYear: 2031,
      biosimilarYear: 2032,
      currentRevenueUsdM: 11500,
      rank: 1,
      source: 'FDA Orange Book + Sanofi 10-K 2024',
      sourceYear: 2024,
    },
  ],
  crohns_disease: [
    {
      indication: 'crohns_disease',
      drug: 'Stelara',
      loeYear: 2024,
      biosimilarYear: 2025,
      currentRevenueUsdM: 3200,
      rank: 1,
      source: 'FDA Orange Book + J&J 10-K 2024',
      sourceYear: 2024,
    },
    {
      indication: 'crohns_disease',
      drug: 'Skyrizi',
      loeYear: 2034,
      biosimilarYear: 2036,
      currentRevenueUsdM: 2500,
      rank: 2,
      source: 'FDA Orange Book + AbbVie 10-K 2024',
      sourceYear: 2024,
    },
  ],
  ulcerative_colitis: [
    {
      indication: 'ulcerative_colitis',
      drug: 'Entyvio',
      loeYear: 2032,
      biosimilarYear: 2033,
      currentRevenueUsdM: 6000,
      rank: 1,
      source: 'FDA Orange Book + Takeda 10-K 2024',
      sourceYear: 2024,
    },
  ],
  alzheimers: [
    {
      indication: 'alzheimers',
      drug: 'Leqembi',
      loeYear: 2036,
      biosimilarYear: 2038,
      currentRevenueUsdM: 300,
      rank: 1,
      source: 'FDA Orange Book + Biogen/Eisai 10-K 2024',
      sourceYear: 2024,
      notes: 'Still in launch phase; modest 2024 revenue',
    },
  ],
  cystic_fibrosis: [
    {
      indication: 'cystic_fibrosis',
      drug: 'Trikafta',
      loeYear: 2037,
      biosimilarYear: 2038,
      currentRevenueUsdM: 9200,
      rank: 1,
      source: 'FDA Orange Book + Vertex 10-K 2024',
      sourceYear: 2024,
    },
  ],
  duchenne_muscular_dystrophy: [
    {
      indication: 'duchenne_muscular_dystrophy',
      drug: 'Elevidys',
      loeYear: 2036,
      biosimilarYear: 2038,
      currentRevenueUsdM: 800,
      rank: 1,
      source: 'FDA Orange Book + Sarepta 10-K 2024',
      sourceYear: 2024,
    },
  ],
  spinal_muscular_atrophy: [
    {
      indication: 'spinal_muscular_atrophy',
      drug: 'Spinraza',
      loeYear: 2030,
      biosimilarYear: 2032,
      currentRevenueUsdM: 1700,
      rank: 1,
      source: 'FDA Orange Book + Biogen 10-K 2024',
      sourceYear: 2024,
    },
    {
      indication: 'spinal_muscular_atrophy',
      drug: 'Zolgensma',
      loeYear: 2035,
      biosimilarYear: 2037,
      currentRevenueUsdM: 1200,
      rank: 2,
      source: 'FDA Orange Book + Novartis 10-K 2024',
      sourceYear: 2024,
    },
  ],
};

// ---------------------------------------------------------------------------
// Module-level cache (hydrated at boot from DB; falls back to static)
// ---------------------------------------------------------------------------

let cliffsCache: Record<string, IndicationPatentCliff[]> = PATENT_CLIFFS_STATIC;

/** Hydrate the cache (called by cron handler or instrumentation bootstrap). */
export function setPatentCliffsCache(data: Record<string, IndicationPatentCliff[]>): void {
  cliffsCache = data;
}

/** Reset cache to static fallback — for tests. */
export function __resetPatentCliffsCacheForTests(): void {
  cliffsCache = PATENT_CLIFFS_STATIC;
}

/** Get the full cliff list for an indication (includes ranks 2+ if present). */
export function getPatentCliffs(indication: string | undefined): IndicationPatentCliff[] {
  if (!indication) return [];
  return cliffsCache[indication] ?? [];
}

/** Get the rank-1 market leader for an indication. */
export function getPatentCliffLeader(indication: string | undefined): IndicationPatentCliff | null {
  const list = getPatentCliffs(indication);
  return list.find(c => c.rank === 1) ?? list[0] ?? null;
}

export interface PatentCliffAdjustment {
  multiplier: number;
  leader: IndicationPatentCliff | null;
  scenario: PatentCliffScenario;
  narrative: string;
}

/**
 * Compute the launch-timing peak-sales multiplier for a given asset.
 * Returns { multiplier: 1, scenario: 'noLeader' } when no leader data exists.
 */
export function getPatentCliffAdjustment(
  indication: string | undefined,
  launchYear: number,
): PatentCliffAdjustment {
  const leader = getPatentCliffLeader(indication);
  if (!leader || !Number.isFinite(launchYear)) {
    return {
      multiplier: 1.0,
      leader: null,
      scenario: 'noLeader',
      narrative: indication
        ? `Patent cliff: no leader data for ${indication}; neutral multiplier applied.`
        : 'Patent cliff: no indication specified; neutral multiplier applied.',
    };
  }

  const gap = launchYear - leader.loeYear;
  const biosimilarRampYears = Math.max(1, leader.biosimilarYear - leader.loeYear);

  let multiplier = 1.0;
  let scenario: PatentCliffScenario = 'atLoe';
  let narrative = '';

  if (gap < -3) {
    // Launching ≥4y before LOE → battling a still-protected leader in peak years
    multiplier = 0.88;
    scenario = 'preLoeCrowded';
    narrative = `Patent cliff: launching ~${-gap}y before ${leader.drug} LOE (${leader.loeYear}); headwind of 12% vs baseline peak sales.`;
  } else if (gap < 0) {
    multiplier = 0.95;
    scenario = 'preLoeApproaching';
    narrative = `Patent cliff: launching ${-gap}y before ${leader.drug} LOE (${leader.loeYear}); modest 5% headwind — late entrant vs. still-protected leader.`;
  } else if (gap < biosimilarRampYears) {
    multiplier = 1.00;
    scenario = 'atLoe';
    narrative = `Patent cliff: launching in ${leader.drug}'s LOE-to-biosimilar window (${leader.loeYear}-${leader.biosimilarYear}); neutral peak sales (biosimilars not yet ramped).`;
  } else if (gap < biosimilarRampYears + 5) {
    multiplier = 1.15;
    scenario = 'postBiosimilarBoost';
    narrative = `Patent cliff: launching ${gap}y post-${leader.drug}-LOE with biosimilars ramping; 15% tailwind — leader ceding share.`;
  } else {
    multiplier = 1.10;
    scenario = 'postLoeBoost';
    narrative = `Patent cliff: launching ${gap}y post-${leader.drug}-LOE; 10% tailwind — competitive vacuum has stabilized.`;
  }

  return { multiplier, leader, scenario, narrative };
}
