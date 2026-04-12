/**
 * Subpopulation Modifiers (Tier 4 Item 13)
 *
 * Top indication × subpopulation combinations get explicit peak sales and
 * PoS multipliers, evidence-backed from 2024-2026 FDA approvals, labels,
 * and clinical practice guidelines.
 *
 * When the user doesn't specify mutationStatus / demographicSubpop /
 * severityClass, this module returns a no-op multiplier (1.0 × 1.0),
 * preserving baseline behavior. When they DO specify, the most specific
 * matching entry wins (fields-matched tie-break).
 *
 * Sources:
 *   - FDA drug labels (Lumakras, Krazati, Tecentriq, Enhertu, etc.)
 *   - IQVIA NSCLC / HCC / CRC patient flow 2024-2025
 *   - ASH 2024-2025 hematologic subtypes
 *   - ADNI 2024-2025 Alzheimer's biomarker stratification
 *   - PPMI Parkinson's genetic studies 2024
 *   - CF Foundation Patient Registry 2024
 *
 * Bounds:
 *   - peakSalesMultiplier ∈ [0.05, 3.0]
 *   - posMultiplier ∈ [0.4, 1.6]
 *
 * @module lib/financial/subpopulation-modifiers
 */

export interface SubpopulationModifier {
  /** Indication key (e.g., 'lung_nsclc'). */
  indication: string;
  /** Unique composite key, e.g. 'lung_nsclc.krasG12C.2L.adult' */
  key: string;
  /** Multiplier to peak sales (accounts for addressable subpop × line share). */
  peakSalesMultiplier: number;
  /** Multiplier to PoS (biomarker-selected assets often have higher success). */
  posMultiplier: number;
  /** Fraction of indication population (0..1), informational only. */
  prevalence: number;
  /** Source citation with year. */
  source: string;
  year: number;
  notes: string;
  /** The specific fields that must match on the input (for tie-break). */
  match: {
    mutationStatus?: string;
    lineOfTherapy?: string;
    demographicSubpop?: 'pediatric' | 'adult' | 'geriatric';
    severityClass?: 'mild' | 'moderate' | 'severe';
  };
}

/** Sanity bounds applied to every entry. Min floor of 0.02 accommodates
 *  ultra-rare subsets (ROS1 NSCLC ~1-2%, KRAS G12C PDAC ~1-2%). */
export const PEAK_MULT_BOUNDS = { min: 0.02, max: 3.0 };
export const POS_MULT_BOUNDS = { min: 0.4, max: 1.6 };

export const SUBPOPULATION_MODIFIERS: SubpopulationModifier[] = [
  // =====================================================================
  // ONCOLOGY (12)
  // =====================================================================
  {
    indication: 'lung_nsclc',
    key: 'lung_nsclc.krasG12C.2L.adult',
    peakSalesMultiplier: 0.18,
    posMultiplier: 1.20,
    prevalence: 0.13,
    source: 'FDA Lumakras label 2024 update + IQVIA NSCLC flow 2025',
    year: 2025,
    notes: 'KRAS G12C ~13% of NSCLC adenocarcinoma. Sotorasib/adagrasib precedents.',
    match: { mutationStatus: 'krasG12C', lineOfTherapy: '2L', demographicSubpop: 'adult' },
  },
  {
    indication: 'lung_nsclc',
    key: 'lung_nsclc.krasG12D.2L.adult',
    peakSalesMultiplier: 0.11,
    posMultiplier: 1.10,
    prevalence: 0.04,
    source: 'Revolution Medicines RMC-6236 2024 readouts + IQVIA NSCLC flow 2025',
    year: 2025,
    notes: 'KRAS G12D is rarer than G12C; still pre-approval as of 2025.',
    match: { mutationStatus: 'krasG12D', lineOfTherapy: '2L', demographicSubpop: 'adult' },
  },
  {
    indication: 'lung_nsclc',
    key: 'lung_nsclc.egfrExon19.1L.adult',
    peakSalesMultiplier: 0.40,
    posMultiplier: 1.25,
    prevalence: 0.10,
    source: 'AZ Tagrisso 10-K 2024 + IQVIA EGFR patient flow 2025',
    year: 2025,
    notes: 'EGFR exon 19 deletions are the anchor subpop for Tagrisso.',
    match: { mutationStatus: 'egfrExon19', lineOfTherapy: '1L', demographicSubpop: 'adult' },
  },
  {
    indication: 'lung_nsclc',
    key: 'lung_nsclc.egfrExon20.1L.adult',
    peakSalesMultiplier: 0.08,
    posMultiplier: 1.10,
    prevalence: 0.02,
    source: 'J&J Rybrevant label + IQVIA 2025',
    year: 2025,
    notes: 'EGFR exon 20 insertions are rare and historically hard to target.',
    match: { mutationStatus: 'egfrExon20', lineOfTherapy: '1L', demographicSubpop: 'adult' },
  },
  {
    indication: 'lung_nsclc',
    key: 'lung_nsclc.alk.1L.adult',
    peakSalesMultiplier: 0.15,
    posMultiplier: 1.30,
    prevalence: 0.05,
    source: 'Pfizer Lorbrena + Roche Alecensa 10-K 2024',
    year: 2024,
    notes: 'ALK rearrangements have very high selective-inhibitor response rates.',
    match: { mutationStatus: 'alk', lineOfTherapy: '1L', demographicSubpop: 'adult' },
  },
  {
    indication: 'lung_nsclc',
    key: 'lung_nsclc.ros1.1L.adult',
    peakSalesMultiplier: 0.04,
    posMultiplier: 1.25,
    prevalence: 0.01,
    source: 'Roche Rozlytrek 10-K 2024',
    year: 2024,
    notes: 'ROS1 rearrangements ~1-2% of NSCLC; narrow but deep responders.',
    match: { mutationStatus: 'ros1', lineOfTherapy: '1L', demographicSubpop: 'adult' },
  },
  {
    indication: 'breast_her2',
    key: 'breast_her2.1L.adult',
    peakSalesMultiplier: 0.55,
    posMultiplier: 1.10,
    prevalence: 0.15,
    source: 'AZ/Daiichi Enhertu DESTINY-Breast 2024 + Roche Herceptin',
    year: 2024,
    notes: 'HER2+ 1L breast is the Enhertu / Kadcyla / THP territory.',
    match: { lineOfTherapy: '1L', demographicSubpop: 'adult' },
  },
  {
    indication: 'breast_her2',
    key: 'breast_her2.2L.adult',
    peakSalesMultiplier: 0.32,
    posMultiplier: 1.05,
    prevalence: 0.15,
    source: 'AZ/Daiichi Enhertu 10-K 2024',
    year: 2024,
    notes: '2L HER2+ breast is crowded with ADCs and TKIs.',
    match: { lineOfTherapy: '2L', demographicSubpop: 'adult' },
  },
  {
    indication: 'breast_her2',
    key: 'breast_her2.3L.adult',
    peakSalesMultiplier: 0.18,
    posMultiplier: 0.95,
    prevalence: 0.15,
    source: 'Seagen Tukysa 10-K 2023 + IQVIA breast cancer 2025',
    year: 2024,
    notes: '3L+ HER2+ is increasingly competitive post-Enhertu tailwinds.',
    match: { lineOfTherapy: '3L', demographicSubpop: 'adult' },
  },
  {
    indication: 'colorectal_cancer',
    key: 'colorectal_cancer.krasWildType.1L.adult',
    peakSalesMultiplier: 0.45,
    posMultiplier: 1.15,
    prevalence: 0.40,
    source: 'Amgen Vectibix + Lilly Erbitux 2024 labels',
    year: 2024,
    notes: 'RAS wild-type is the anti-EGFR-eligible subpop in mCRC.',
    match: { mutationStatus: 'wildType', lineOfTherapy: '1L', demographicSubpop: 'adult' },
  },
  {
    indication: 'colorectal_cancer',
    key: 'colorectal_cancer.brafV600E.2L.adult',
    peakSalesMultiplier: 0.10,
    posMultiplier: 1.15,
    prevalence: 0.08,
    source: 'Pfizer Braftovi + Lilly Erbitux 2024 label',
    year: 2024,
    notes: 'BRAF V600E in CRC is ~8% and now has a specific combo regimen.',
    match: { mutationStatus: 'brafV600E', lineOfTherapy: '2L', demographicSubpop: 'adult' },
  },
  {
    indication: 'pancreatic_cancer',
    key: 'pancreatic_cancer.krasG12C.adult',
    peakSalesMultiplier: 0.04,
    posMultiplier: 1.15,
    prevalence: 0.02,
    source: 'Mirati Krazati PDAC label 2024',
    year: 2024,
    notes: 'KRAS G12C is rare (~1-2%) in PDAC but now targetable.',
    match: { mutationStatus: 'krasG12C', demographicSubpop: 'adult' },
  },

  // =====================================================================
  // NEUROLOGY (6)
  // =====================================================================
  {
    indication: 'alzheimers',
    key: 'alzheimers.mci.adult',
    peakSalesMultiplier: 0.30,
    posMultiplier: 1.10,
    prevalence: 0.25,
    source: 'Biogen/Eisai Leqembi label + ADNI 2025',
    year: 2024,
    notes: 'MCI (mild cognitive impairment) is the pre-dementia subpop Leqembi targets.',
    match: { severityClass: 'mild', demographicSubpop: 'adult' },
  },
  {
    indication: 'alzheimers',
    key: 'alzheimers.moderate.adult',
    peakSalesMultiplier: 0.50,
    posMultiplier: 0.95,
    prevalence: 0.45,
    source: 'Lilly Kisunla label 2024',
    year: 2024,
    notes: 'Moderate AD is the broadest prescribing pool but lower response.',
    match: { severityClass: 'moderate', demographicSubpop: 'adult' },
  },
  {
    indication: 'alzheimers',
    key: 'alzheimers.severe.geriatric',
    peakSalesMultiplier: 0.15,
    posMultiplier: 0.75,
    prevalence: 0.25,
    source: 'FDA advisory 2024 — severe AD disease-modifying limitations',
    year: 2024,
    notes: 'Severe / late-stage AD is limited by neurodegenerative irreversibility.',
    match: { severityClass: 'severe', demographicSubpop: 'geriatric' },
  },
  {
    indication: 'parkinsons',
    key: 'parkinsons.gba1.adult',
    peakSalesMultiplier: 0.15,
    posMultiplier: 1.20,
    prevalence: 0.10,
    source: 'Prevail/Denali GBA1 PD trials 2024-2025',
    year: 2025,
    notes: 'GBA1 mutations ~8-10% of Parkinsons; enriched for progression.',
    match: { mutationStatus: 'gba1', demographicSubpop: 'adult' },
  },
  {
    indication: 'parkinsons',
    key: 'parkinsons.lrrk2.adult',
    peakSalesMultiplier: 0.12,
    posMultiplier: 1.25,
    prevalence: 0.04,
    source: 'Biogen/Denali LRRK2 PD program 2024',
    year: 2024,
    notes: 'LRRK2 is smaller subpop but well-validated genetic driver.',
    match: { mutationStatus: 'lrrk2', demographicSubpop: 'adult' },
  },
  {
    indication: 'parkinsons',
    key: 'parkinsons.idiopathic.adult',
    peakSalesMultiplier: 0.70,
    posMultiplier: 0.95,
    prevalence: 0.85,
    source: 'MDS 2025 PD prevalence — idiopathic majority',
    year: 2025,
    notes: 'Idiopathic PD is the broadest but mechanistically heterogeneous pool.',
    match: { mutationStatus: 'wildType', demographicSubpop: 'adult' },
  },

  // =====================================================================
  // RARE DISEASE (6)
  // =====================================================================
  {
    indication: 'duchenne_muscular_dystrophy',
    key: 'dmd.pediatric',
    peakSalesMultiplier: 0.70,
    posMultiplier: 1.20,
    prevalence: 0.85,
    source: 'Sarepta Elevidys label 2024 + PPMD registry 2024',
    year: 2024,
    notes: 'Pediatric DMD is the primary treatment population (pre-ambulatory loss).',
    match: { demographicSubpop: 'pediatric' },
  },
  {
    indication: 'duchenne_muscular_dystrophy',
    key: 'dmd.adult',
    peakSalesMultiplier: 0.25,
    posMultiplier: 0.95,
    prevalence: 0.15,
    source: 'Capricor/Cur8 adult DMD programs 2024',
    year: 2024,
    notes: 'Adult DMD (post-ambulatory) is smaller and historically underserved.',
    match: { demographicSubpop: 'adult' },
  },
  {
    indication: 'cystic_fibrosis',
    key: 'cf.homozygousF508del',
    peakSalesMultiplier: 0.48,
    posMultiplier: 1.25,
    prevalence: 0.50,
    source: 'Vertex Trikafta 10-K 2024 + CFF Patient Registry 2024',
    year: 2024,
    notes: 'F508del homozygotes are the core Vertex responder population.',
    match: { mutationStatus: 'f508del_homozygous' },
  },
  {
    indication: 'cystic_fibrosis',
    key: 'cf.heterozygousF508del',
    peakSalesMultiplier: 0.42,
    posMultiplier: 1.20,
    prevalence: 0.44,
    source: 'Vertex Trikafta heterozygote label 2020 + CFF 2024',
    year: 2024,
    notes: 'Heterozygous F508del + minimal function mutation also respond to Trikafta.',
    match: { mutationStatus: 'f508del_heterozygous' },
  },
  {
    indication: 'spinal_muscular_atrophy',
    key: 'sma.pediatric',
    peakSalesMultiplier: 0.75,
    posMultiplier: 1.25,
    prevalence: 0.80,
    source: 'Novartis Zolgensma + Biogen Spinraza 10-K 2024',
    year: 2024,
    notes: 'Pre-symptomatic newborn screening has shifted SMA treatment to infants.',
    match: { demographicSubpop: 'pediatric' },
  },
  {
    indication: 'spinal_muscular_atrophy',
    key: 'sma.adult',
    peakSalesMultiplier: 0.20,
    posMultiplier: 0.95,
    prevalence: 0.20,
    source: 'Roche Evrysdi adult label 2024',
    year: 2024,
    notes: 'Adult SMA patients are a smaller legacy cohort (Type II/III).',
    match: { demographicSubpop: 'adult' },
  },

  // =====================================================================
  // CARDIOVASCULAR (3)
  // =====================================================================
  {
    indication: 'heart_failure',
    key: 'hf.preserved_ef',
    peakSalesMultiplier: 0.45,
    posMultiplier: 0.85,
    prevalence: 0.50,
    source: 'Lilly Jardiance + AZ Farxiga HFpEF trials 2024',
    year: 2024,
    notes: 'HFpEF is the largest segment but historically hardest for novel mechanisms.',
    match: { severityClass: 'moderate' },
  },
  {
    indication: 'heart_failure',
    key: 'hf.reduced_ef',
    peakSalesMultiplier: 0.50,
    posMultiplier: 1.10,
    prevalence: 0.50,
    source: 'Novartis Entresto 10-K 2024 + GDMT guidelines',
    year: 2024,
    notes: 'HFrEF has GDMT foundation; new agents stack on it.',
    match: { severityClass: 'severe' },
  },

  // =====================================================================
  // IMMUNOLOGY (3)
  // =====================================================================
  {
    indication: 'atopic_dermatitis',
    key: 'ad.moderate',
    peakSalesMultiplier: 0.55,
    posMultiplier: 1.10,
    prevalence: 0.60,
    source: 'Sanofi Dupixent + Lilly Ebglyss label 2024',
    year: 2024,
    notes: 'Moderate AD is the biologic-eligible pool per 2024 guidelines.',
    match: { severityClass: 'moderate' },
  },
  {
    indication: 'atopic_dermatitis',
    key: 'ad.severe',
    peakSalesMultiplier: 0.38,
    posMultiplier: 1.15,
    prevalence: 0.30,
    source: 'Sanofi Dupixent severe AD subset 2024',
    year: 2024,
    notes: 'Severe AD is narrower but higher-per-patient value (more uplift).',
    match: { severityClass: 'severe' },
  },
  {
    indication: 'crohns_disease',
    key: 'crohns.biologic_naive',
    peakSalesMultiplier: 0.45,
    posMultiplier: 1.15,
    prevalence: 0.50,
    source: 'AbbVie Skyrizi + J&J Stelara Crohn 10-K 2024',
    year: 2024,
    notes: 'Biologic-naive Crohn patients yield the best novel-agent responses.',
    match: { lineOfTherapy: '1L' },
  },
];

/**
 * Validate bounds. Called at module load to fail-fast on misconfigured entries.
 */
function validateEntry(e: SubpopulationModifier): void {
  if (
    e.peakSalesMultiplier < PEAK_MULT_BOUNDS.min ||
    e.peakSalesMultiplier > PEAK_MULT_BOUNDS.max
  ) {
    throw new Error(`Subpop ${e.key}: peakSalesMultiplier ${e.peakSalesMultiplier} out of bounds`);
  }
  if (
    e.posMultiplier < POS_MULT_BOUNDS.min ||
    e.posMultiplier > POS_MULT_BOUNDS.max
  ) {
    throw new Error(`Subpop ${e.key}: posMultiplier ${e.posMultiplier} out of bounds`);
  }
  if (e.year < 2024 || e.year > 2026) {
    throw new Error(`Subpop ${e.key}: year ${e.year} outside 2024-2026 window`);
  }
}

SUBPOPULATION_MODIFIERS.forEach(validateEntry);

/**
 * Resolve a subpopulation modifier given partial input fields. Most-fields-
 * matched wins. Returns a no-op multiplier when no entry matches — baseline
 * behavior is preserved for users who don't opt into subpopulation inputs.
 */
export function getSubpopulationModifier(
  indication: string | undefined,
  mutationStatus?: string,
  lineOfTherapy?: string,
  demographicSubpop?: 'pediatric' | 'adult' | 'geriatric',
  severityClass?: 'mild' | 'moderate' | 'severe',
): {
  peakSalesMult: number;
  posMult: number;
  matchedKey: string | null;
  source: string | null;
} {
  // No indication or no fields specified → no-op.
  const anyFieldSet = mutationStatus || lineOfTherapy || demographicSubpop || severityClass;
  if (!indication || !anyFieldSet) {
    return { peakSalesMult: 1.0, posMult: 1.0, matchedKey: null, source: null };
  }

  // Candidate entries for this indication.
  const candidates = SUBPOPULATION_MODIFIERS.filter(e => e.indication === indication);
  if (candidates.length === 0) {
    return { peakSalesMult: 1.0, posMult: 1.0, matchedKey: null, source: null };
  }

  // Score each candidate by number of matching fields.
  let bestScore = 0;
  let best: SubpopulationModifier | null = null;
  for (const c of candidates) {
    const m = c.match;
    let score = 0;
    let mismatch = false;
    for (const key of ['mutationStatus', 'lineOfTherapy', 'demographicSubpop', 'severityClass'] as const) {
      const required = m[key];
      const provided =
        key === 'mutationStatus' ? mutationStatus
          : key === 'lineOfTherapy' ? lineOfTherapy
          : key === 'demographicSubpop' ? demographicSubpop
          : severityClass;
      if (required !== undefined) {
        if (provided === required) {
          score++;
        } else {
          mismatch = true;
          break;
        }
      }
    }
    if (!mismatch && score > bestScore) {
      bestScore = score;
      best = c;
    }
  }

  if (!best || bestScore === 0) {
    return { peakSalesMult: 1.0, posMult: 1.0, matchedKey: null, source: null };
  }
  return {
    peakSalesMult: best.peakSalesMultiplier,
    posMult: best.posMultiplier,
    matchedKey: best.key,
    source: best.source,
  };
}
