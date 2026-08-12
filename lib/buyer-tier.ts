// Buyer tier classification for comparable deal filtering
// Classifies licensee companies by size/type for comp set segmentation

export type BuyerTier = 'large_pharma' | 'mid_pharma' | 'specialty' | 'generic' | 'biotech';

export const BUYER_TIER_LABELS: Record<BuyerTier, string> = {
  large_pharma: 'Large Pharma',
  mid_pharma: 'Mid-Cap Pharma',
  specialty: 'Specialty',
  generic: 'Generic',
  biotech: 'Biotech',
};

export const BUYER_TIER_COLORS: Record<BuyerTier, string> = {
  large_pharma: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  mid_pharma: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
  specialty: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  generic: 'bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-300',
  biotech: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
};

// ═══════════════════════════════════════════════════════════════════════
// COMPANY → TIER LOOKUP
// ═══════════════════════════════════════════════════════════════════════

const COMPANY_TIER: Record<string, BuyerTier> = {
  // ── Large Pharma (top 25 by revenue) ──────────────────────────────
  'pfizer': 'large_pharma',
  'novartis': 'large_pharma',
  'roche': 'large_pharma',
  'johnson & johnson': 'large_pharma',
  'merck': 'large_pharma',
  'merck & co': 'large_pharma',
  'abbvie': 'large_pharma',
  'eli lilly': 'large_pharma',
  'sanofi': 'large_pharma',
  'astrazeneca': 'large_pharma',
  'gsk': 'large_pharma',
  'glaxosmithkline': 'large_pharma',
  'bristol-myers squibb': 'large_pharma',
  'bms': 'large_pharma',
  'amgen': 'large_pharma',
  'gilead': 'large_pharma',
  'gilead sciences': 'large_pharma',
  'bayer': 'large_pharma',
  'novo nordisk': 'large_pharma',
  'takeda': 'large_pharma',
  'boehringer ingelheim': 'large_pharma',
  'regeneron': 'large_pharma',
  'vertex': 'large_pharma',
  'vertex pharmaceuticals': 'large_pharma',
  'biogen': 'large_pharma',
  'daiichi sankyo': 'large_pharma',
  'astellas': 'large_pharma',
  'astellas pharma': 'large_pharma',
  'otsuka': 'large_pharma',
  'otsuka pharmaceutical': 'large_pharma',
  'eisai': 'large_pharma',
  'chugai': 'large_pharma',
  'chugai pharmaceutical': 'large_pharma',

  // ── Mid-Cap Pharma ────────────────────────────────────────────────
  'lupin': 'mid_pharma',
  'sun pharma': 'mid_pharma',
  'sun pharmaceutical': 'mid_pharma',
  'cipla': 'mid_pharma',
  "dr. reddy's": 'mid_pharma',
  "dr. reddy's laboratories": 'mid_pharma',
  'teva': 'mid_pharma',
  'teva pharmaceutical': 'mid_pharma',
  'viatris': 'mid_pharma',
  'jazz pharmaceuticals': 'mid_pharma',
  'jazz': 'mid_pharma',
  'ipsen': 'mid_pharma',
  'lundbeck': 'mid_pharma',
  'ucb': 'mid_pharma',
  'almirall': 'mid_pharma',
  'recordati': 'mid_pharma',
  'bausch health': 'mid_pharma',
  'bausch': 'mid_pharma',
  'endo': 'mid_pharma',
  'endo international': 'mid_pharma',
  'perrigo': 'mid_pharma',
  'amneal': 'mid_pharma',
  'amneal pharmaceuticals': 'mid_pharma',
  'organon': 'mid_pharma',
  'alkem': 'mid_pharma',
  'alkem laboratories': 'mid_pharma',
  'taro': 'mid_pharma',
  'taro pharmaceutical': 'mid_pharma',
  'torrent': 'mid_pharma',
  'torrent pharmaceuticals': 'mid_pharma',
  'zydus': 'mid_pharma',
  'zydus lifesciences': 'mid_pharma',
  'merck kgaa': 'mid_pharma',
  'incyte': 'mid_pharma',
  'sobi': 'mid_pharma',
  'swedish orphan biovitrum': 'mid_pharma',

  // ── Specialty ─────────────────────────────────────────────────────
  'eagle pharmaceuticals': 'specialty',
  'assertio': 'specialty',
  'assertio therapeutics': 'specialty',
  'xeris': 'specialty',
  'xeris pharmaceuticals': 'specialty',
  'paratek': 'specialty',
  'paratek pharmaceuticals': 'specialty',
  'supernus': 'specialty',
  'supernus pharmaceuticals': 'specialty',
  'intra-cellular': 'specialty',
  'intra-cellular therapies': 'specialty',
  'prestige brands': 'specialty',
  'prestige consumer healthcare': 'specialty',
  'pacira': 'specialty',
  'pacira biosciences': 'specialty',
  'collegium': 'specialty',
  'collegium pharmaceutical': 'specialty',
  'harmony biosciences': 'specialty',
  'axsome': 'specialty',
  'axsome therapeutics': 'specialty',
  'acadia': 'specialty',
  'acadia pharmaceuticals': 'specialty',
  'sage therapeutics': 'specialty',
  'sage': 'specialty',
  'neurocrine': 'specialty',
  'neurocrine biosciences': 'specialty',
  'mochida pharmaceutical': 'specialty',
  'purdue pharma': 'specialty',
  'amphastar': 'specialty',
  'amphastar pharmaceuticals': 'specialty',
  'antares pharma': 'specialty',
  'antares': 'specialty',
  'acrotech': 'specialty',
  'acrotech biopharma': 'specialty',
  'kashiv': 'specialty',
  'kashiv biosciences': 'specialty',
  'nestle health science': 'specialty',
  'zealand pharma': 'specialty',
  'zealand': 'specialty',

  // ── Generic ───────────────────────────────────────────────────────
  'sandoz': 'generic',
  'hikma': 'generic',
  'hikma pharmaceuticals': 'generic',
  'fresenius kabi': 'generic',
  'fresenius': 'generic',
  'apotex': 'generic',
  'strides': 'generic',
  'strides pharma': 'generic',
  'natco': 'generic',
  'natco pharma': 'generic',
  'glenmark': 'generic',
  'glenmark pharmaceuticals': 'generic',
  'aurobindo': 'generic',
  'aurobindo pharma': 'generic',
  'hetero': 'generic',
  'hetero labs': 'generic',
  'piramal': 'generic',
  'piramal pharma': 'generic',
  'alvotech': 'generic',
};

// ═══════════════════════════════════════════════════════════════════════
// ALIAS RESOLUTION
// ═══════════════════════════════════════════════════════════════════════

const COMPANY_ALIASES: Record<string, string> = {
  'bms': 'bristol-myers squibb',
  'j&j': 'johnson & johnson',
  'jnj': 'johnson & johnson',
  'janssen': 'johnson & johnson',
  'lilly': 'eli lilly',
  'msd': 'merck',
  'celgene': 'bristol-myers squibb', // acquired by BMS
  'celgene/bms': 'bristol-myers squibb',
  'allergan': 'abbvie', // acquired by AbbVie
  'alexion': 'astrazeneca', // acquired by AZ
  'global blood therapeutics': 'pfizer', // acquired by Pfizer
  'nestlé health science': 'nestle health science',
};

// ═══════════════════════════════════════════════════════════════════════
// CLASSIFIER
// ═══════════════════════════════════════════════════════════════════════

/**
 * Classify a company into a buyer tier based on name matching.
 *
 * 1. Normalize (lowercase, trim)
 * 2. Exact match in COMPANY_TIER
 * 3. Alias resolution → exact match
 * 4. Partial match (company name contains or is contained by a known key)
 * 5. Default to 'biotech'
 */
export function classifyBuyerTier(companyName: string): BuyerTier {
  if (!companyName) return 'biotech';

  const normalized = companyName.toLowerCase().trim();

  // 1. Exact match
  if (COMPANY_TIER[normalized]) {
    return COMPANY_TIER[normalized];
  }

  // 2. Alias resolution
  if (COMPANY_ALIASES[normalized]) {
    const resolved = COMPANY_ALIASES[normalized];
    if (COMPANY_TIER[resolved]) {
      return COMPANY_TIER[resolved];
    }
  }

  // 3. Partial match — check if normalized name contains a known key or vice versa
  //    Longer keys first to prefer more specific matches (e.g., "Bristol-Myers Squibb" over "Bristol")
  const sortedKeys = Object.keys(COMPANY_TIER).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return COMPANY_TIER[key];
    }
  }

  // 4. Alias partial match
  const sortedAliases = Object.keys(COMPANY_ALIASES).sort((a, b) => b.length - a.length);
  for (const alias of sortedAliases) {
    if (normalized.includes(alias) || alias.includes(normalized)) {
      const resolved = COMPANY_ALIASES[alias];
      if (COMPANY_TIER[resolved]) {
        return COMPANY_TIER[resolved];
      }
    }
  }

  // 5. Default
  return 'biotech';
}
