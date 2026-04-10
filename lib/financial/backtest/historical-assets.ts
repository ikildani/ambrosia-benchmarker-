/**
 * Historical Asset Fixture for Engine Back-Testing
 *
 * Real biopharma assets with documented commercial outcomes, used to
 * validate the competitive dynamics and rNPV engines against observed
 * reality. Each asset has:
 *   - As-of-launch inputs (what the engine would have seen)
 *   - Actual observed outcomes (from public disclosures)
 *   - Data sources and vintages for reproducibility
 *
 * Sources:
 *   - Company 10-K filings (2014-2025)
 *   - EvaluatePharma World Preview 2024
 *   - IQVIA Top 20 Products 2024
 *   - Nature Reviews Drug Discovery blockbuster analyses
 *   - FDA approval letters (launch dates)
 *   - ClinicalTrials.gov (competitor trial data)
 *
 * @module lib/financial/backtest/historical-assets
 */

/**
 * Back-test asset definition.
 * as_of_inputs represent what the engine would have been told at launch year.
 * actual_outcomes represent observed commercial reality as of 2024-2025.
 */
export interface HistoricalAsset {
  id: string;
  name: string;
  company: string;
  /** Year the asset would have been evaluated (typically launch year) */
  evaluationYear: number;
  /** Actual FDA approval / launch year */
  launchYear: number;

  /** Inputs as they would have been at evaluation time */
  asOfInputs: {
    therapeuticArea: string;
    indication: string;
    modality: string;
    phase: string;
    territory: string;
    /** Competitive position at time of evaluation */
    competitivePosition: string;
    /** Peak sales estimate range in $M at evaluation time */
    peakSalesEstimate: { low: number; median: number; high: number };
    /** Whether the asset had these regulatory designations */
    regulatoryDesignations: {
      breakthrough: boolean;
      fastTrack: boolean;
      orphan: boolean;
      prime: boolean;
    };
    biomarkerStatus: string;
  };

  /** Observed commercial outcomes */
  actualOutcomes: {
    /** Actual peak annual sales in $M (from 10-K) */
    actualPeakSalesM: number;
    /** Year peak sales was achieved */
    peakYear: number;
    /** Number of meaningful competitors that materialized by peakYear */
    actualCompetitorCount: number;
    /** Names of top competitors for validation */
    actualCompetitors: string[];
    /** Estimated observed peak erosion (1 - actual_peak / theoretical_uncontested_peak) */
    estimatedPeakErosion: number;
    /** Year first meaningful competitor launched */
    firstCompetitorYear: number;
    /** Notes on the asset's commercial trajectory */
    notes: string;
  };

  /** Data source for outcomes */
  sources: string[];
  /**
   * Whether this asset represents a known model limitation / edge case
   * that the competitive dynamics engine cannot predict by design.
   *
   * Examples:
   * - Reimbursement failures (Aduhelm — CMS non-coverage)
   * - Safety signal uptake issues (Leqembi — ARIA monitoring)
   * - Disruptive modality shifts (Spinraza → Zolgensma gene therapy)
   * - Biosimilar cliffs (Humira — different dynamic than branded competition)
   */
  isEdgeCase?: boolean;
  /** If isEdgeCase, the reason for exclusion from main metrics */
  edgeCaseReason?: string;
}

/**
 * Curated historical asset dataset for back-testing.
 *
 * Assets selected for:
 *   - Clear commercial outcomes (public 10-K data)
 *   - Diversity across therapeutic areas, modalities, and positions
 *   - Time horizon of at least 5 years post-launch (peak trajectory visible)
 *   - Documented competitor timelines
 */
export const HISTORICAL_ASSETS: HistoricalAsset[] = [
  // ─── IMMUNO-ONCOLOGY ───

  {
    id: 'keytruda',
    name: 'Keytruda',
    company: 'Merck',
    evaluationYear: 2014,
    launchYear: 2014,
    asOfInputs: {
      therapeuticArea: 'oncology',
      indication: 'lung_nsclc',
      modality: 'mab',
      phase: 'approved',
      territory: 'global',
      competitivePosition: 'firstInClass',
      peakSalesEstimate: { low: 8000, median: 15000, high: 25000 },
      regulatoryDesignations: { breakthrough: true, fastTrack: true, orphan: false, prime: false },
      biomarkerStatus: 'validated',
    },
    actualOutcomes: {
      actualPeakSalesM: 32000,
      peakYear: 2024,
      actualCompetitorCount: 5, // Opdivo, Tecentriq, Imfinzi, Libtayo, Bavencio
      actualCompetitors: ['Opdivo (BMS)', 'Tecentriq (Roche)', 'Imfinzi (AZ)', 'Libtayo (Regeneron)', 'Bavencio (Merck KGaA/Pfizer)'],
      estimatedPeakErosion: 0.40, // ~60% class share = 40% lost to 5 competitors
      firstCompetitorYear: 2014, // Opdivo launched same year
      notes: 'First-in-class advantage + biomarker (PD-L1) + aggressive label expansion drove ~60% class share of PD-1/L1 market despite 5 competitors',
    },
    sources: ['Merck 10-K 2024', 'EvaluatePharma 2024', 'IQVIA Top 20 2024'],
  },

  {
    id: 'opdivo',
    name: 'Opdivo',
    company: 'BMS',
    evaluationYear: 2014,
    launchYear: 2014,
    asOfInputs: {
      therapeuticArea: 'oncology',
      indication: 'lung_nsclc',
      modality: 'mab',
      phase: 'approved',
      territory: 'global',
      competitivePosition: 'co_leader',
      peakSalesEstimate: { low: 8000, median: 14000, high: 22000 },
      regulatoryDesignations: { breakthrough: true, fastTrack: true, orphan: false, prime: false },
      biomarkerStatus: 'unselected',
    },
    actualOutcomes: {
      actualPeakSalesM: 9500,
      peakYear: 2023,
      actualCompetitorCount: 5,
      actualCompetitors: ['Keytruda (Merck)', 'Tecentriq (Roche)', 'Imfinzi (AZ)', 'Libtayo (Regeneron)', 'Bavencio (Merck KGaA/Pfizer)'],
      estimatedPeakErosion: 0.80, // ~20% class share of PD-1 class = 80% erosion vs hypothetical dominance
      firstCompetitorYear: 2014,
      notes: 'Lost PD-1/PD-L1 class leadership to Keytruda; biomarker-agnostic strategy limited access in key indications',
    },
    sources: ['BMS 10-K 2024', 'EvaluatePharma 2024'],
  },

  // ─── METABOLIC / GLP-1 ───

  {
    id: 'ozempic',
    name: 'Ozempic',
    company: 'Novo Nordisk',
    evaluationYear: 2017,
    launchYear: 2017,
    asOfInputs: {
      therapeuticArea: 'metabolic',
      indication: 'type2Diabetes',
      modality: 'peptide',
      phase: 'approved',
      territory: 'global',
      competitivePosition: 'bestInClass',
      peakSalesEstimate: { low: 5000, median: 12000, high: 25000 },
      regulatoryDesignations: { breakthrough: false, fastTrack: false, orphan: false, prime: false },
      biomarkerStatus: 'unselected',
    },
    actualOutcomes: {
      actualPeakSalesM: 45000, // Including Wegovy
      peakYear: 2024,
      actualCompetitorCount: 4, // Trulicity, Victoza, Mounjaro, Rybelsus
      actualCompetitors: ['Trulicity (Lilly)', 'Victoza (Novo)', 'Mounjaro (Lilly)', 'Rybelsus (Novo)'],
      estimatedPeakErosion: 0.30, // Novo family held ~70% of GLP-1 class including Rybelsus/Victoza
      firstCompetitorYear: 2014, // Trulicity predated Ozempic
      notes: 'Best-in-class efficacy + strong marketing drove ~70% class share; obesity indication expansion (Wegovy) was massive upside',
    },
    sources: ['Novo Nordisk 10-K 2024', 'EvaluatePharma 2024'],
  },

  {
    id: 'mounjaro',
    name: 'Mounjaro',
    company: 'Eli Lilly',
    evaluationYear: 2022,
    launchYear: 2022,
    asOfInputs: {
      therapeuticArea: 'metabolic',
      indication: 'type2Diabetes',
      modality: 'peptide',
      phase: 'approved',
      territory: 'global',
      competitivePosition: 'challenger',
      peakSalesEstimate: { low: 5000, median: 12000, high: 20000 },
      regulatoryDesignations: { breakthrough: false, fastTrack: false, orphan: false, prime: false },
      biomarkerStatus: 'unselected',
    },
    actualOutcomes: {
      actualPeakSalesM: 16000, // Mounjaro + Zepbound 2024
      peakYear: 2024,
      actualCompetitorCount: 4,
      actualCompetitors: ['Ozempic (Novo)', 'Trulicity (Lilly)', 'Victoza (Novo)', 'Rybelsus (Novo)'],
      estimatedPeakErosion: 0.40, // Gained ~25% class share but Ozempic retained dominance
      firstCompetitorYear: 2017,
      notes: 'Dual GIP/GLP-1 agonist with superior weight loss; challenger position gained ~25% share but Ozempic retained dominance',
    },
    sources: ['Eli Lilly 10-K 2024', 'EvaluatePharma 2024'],
  },

  // ─── IMMUNOLOGY ───

  {
    id: 'humira',
    name: 'Humira',
    company: 'AbbVie',
    evaluationYear: 2002,
    launchYear: 2002,
    asOfInputs: {
      therapeuticArea: 'immunology',
      indication: 'rheumatoid_arthritis',
      modality: 'mab',
      phase: 'approved',
      territory: 'global',
      competitivePosition: 'bestInClass',
      peakSalesEstimate: { low: 5000, median: 10000, high: 18000 },
      regulatoryDesignations: { breakthrough: false, fastTrack: false, orphan: false, prime: false },
      biomarkerStatus: 'unselected',
    },
    actualOutcomes: {
      actualPeakSalesM: 21200,
      peakYear: 2022,
      actualCompetitorCount: 9, // Biosimilars + JAK inhibitors + other biologics
      actualCompetitors: ['Amjevita (Amgen)', 'Hyrimoz (Sandoz)', 'Cyltezo (Boehringer)', 'Enbrel (Amgen)', 'Remicade (J&J)', 'Stelara (J&J)', 'Rinvoq (AbbVie)', 'Xeljanz (Pfizer)', 'Skyrizi (AbbVie)'],
      estimatedPeakErosion: 0.55, // Biosimilars took ~55% of Humira market in 18 months post-LOE
      firstCompetitorYear: 2023, // Biosimilar entry
      notes: 'Best-in-class positioning drove 20+ year dominance; biosimilar cliff in 2023 caused 55% revenue drop in 18 months',
    },
    sources: ['AbbVie 10-K 2023', 'FDA Purple Book', 'EvaluatePharma 2024'],
    isEdgeCase: true,
    edgeCaseReason: 'Biosimilar cliff dynamics — qualitatively different from branded competition. Handled separately by LOE/generic models.',
  },

  {
    id: 'dupixent',
    name: 'Dupixent',
    company: 'Regeneron/Sanofi',
    evaluationYear: 2017,
    launchYear: 2017,
    asOfInputs: {
      therapeuticArea: 'immunology',
      indication: 'atopic_dermatitis',
      modality: 'mab',
      phase: 'approved',
      territory: 'global',
      competitivePosition: 'firstInClass',
      peakSalesEstimate: { low: 3000, median: 7000, high: 13000 },
      regulatoryDesignations: { breakthrough: true, fastTrack: false, orphan: false, prime: false },
      biomarkerStatus: 'unselected',
    },
    actualOutcomes: {
      actualPeakSalesM: 13000,
      peakYear: 2024,
      actualCompetitorCount: 3, // Cibinqo, Rinvoq, Adbry
      actualCompetitors: ['Cibinqo (Pfizer)', 'Rinvoq (AbbVie)', 'Adbry (LEO Pharma)'],
      estimatedPeakErosion: 0.25, // ~75% IL-4/13 class share, slight erosion from JAKs entering
      firstCompetitorYear: 2022,
      notes: 'First-in-class IL-4Rα blockade + 5-year head start enabled ~75% dominant position in atopic dermatitis and asthma',
    },
    sources: ['Regeneron 10-K 2024', 'Sanofi 10-K 2024'],
  },

  // ─── TARGETED ONCOLOGY ───

  {
    id: 'tagrisso',
    name: 'Tagrisso',
    company: 'AstraZeneca',
    evaluationYear: 2015,
    launchYear: 2015,
    asOfInputs: {
      therapeuticArea: 'oncology',
      indication: 'lung_nsclc',
      modality: 'smallMolecule',
      phase: 'approved',
      territory: 'global',
      competitivePosition: 'bestInClass',
      peakSalesEstimate: { low: 2500, median: 5000, high: 8000 },
      regulatoryDesignations: { breakthrough: true, fastTrack: true, orphan: false, prime: false },
      biomarkerStatus: 'validated',
    },
    actualOutcomes: {
      actualPeakSalesM: 5800,
      peakYear: 2023,
      actualCompetitorCount: 3,
      actualCompetitors: ['Iressa (AZ)', 'Tarceva (Genentech)', 'Gilotrif (Boehringer)'],
      estimatedPeakErosion: 0.30, // Held ~70% of EGFR TKI share, newer competitors like amivantamab entering
      firstCompetitorYear: 2015,
      notes: '3rd-gen EGFR TKI with T790M activity; displaced older generations, held ~70% of EGFR TKI market',
    },
    sources: ['AstraZeneca 10-K 2024'],
  },

  {
    id: 'ibrance',
    name: 'Ibrance',
    company: 'Pfizer',
    evaluationYear: 2015,
    launchYear: 2015,
    asOfInputs: {
      therapeuticArea: 'oncology',
      indication: 'breast_hr',
      modality: 'smallMolecule',
      phase: 'approved',
      territory: 'global',
      competitivePosition: 'firstInClass',
      peakSalesEstimate: { low: 3000, median: 5500, high: 9000 },
      regulatoryDesignations: { breakthrough: true, fastTrack: false, orphan: false, prime: false },
      biomarkerStatus: 'validated',
    },
    actualOutcomes: {
      actualPeakSalesM: 5400,
      peakYear: 2021,
      actualCompetitorCount: 2,
      actualCompetitors: ['Kisqali (Novartis)', 'Verzenio (Lilly)'],
      estimatedPeakErosion: 0.45, // Lost ~45% share to Verzenio after adjuvant expansion failure
      firstCompetitorYear: 2017,
      notes: 'First-in-class CDK4/6 inhibitor; lost ~45% share to Verzenio after adjuvant label expansion failure in monarchE',
    },
    sources: ['Pfizer 10-K 2024'],
  },

  // ─── RARE DISEASE ───

  {
    id: 'spinraza',
    name: 'Spinraza',
    company: 'Biogen',
    evaluationYear: 2016,
    launchYear: 2016,
    asOfInputs: {
      therapeuticArea: 'rareDisease',
      indication: 'sma',
      modality: 'oligonucleotide',
      phase: 'approved',
      territory: 'global',
      competitivePosition: 'firstInClass',
      peakSalesEstimate: { low: 1500, median: 3000, high: 5000 },
      regulatoryDesignations: { breakthrough: true, fastTrack: true, orphan: true, prime: true },
      biomarkerStatus: 'validated',
    },
    actualOutcomes: {
      actualPeakSalesM: 2100,
      peakYear: 2019,
      actualCompetitorCount: 2,
      actualCompetitors: ['Zolgensma (Novartis)', 'Evrysdi (Roche)'],
      estimatedPeakErosion: 0.60, // Lost ~60% to Zolgensma (gene therapy) and Evrysdi (oral)
      firstCompetitorYear: 2019,
      notes: 'First SMA treatment; lost ~60% share to Zolgensma (one-time gene therapy disruption) and Evrysdi (oral)',
    },
    sources: ['Biogen 10-K 2024'],
    isEdgeCase: true,
    edgeCaseReason: 'Disruptive modality shift (chronic therapy → one-time gene therapy). Not predictable from competitive position alone.',
  },

  // ─── CARDIOVASCULAR ───

  {
    id: 'entresto',
    name: 'Entresto',
    company: 'Novartis',
    evaluationYear: 2015,
    launchYear: 2015,
    asOfInputs: {
      therapeuticArea: 'cardiovascular',
      indication: 'heart_failure',
      modality: 'smallMolecule',
      phase: 'approved',
      territory: 'global',
      competitivePosition: 'firstInClass',
      peakSalesEstimate: { low: 2000, median: 5000, high: 10000 },
      regulatoryDesignations: { breakthrough: false, fastTrack: true, orphan: false, prime: false },
      biomarkerStatus: 'unselected',
    },
    actualOutcomes: {
      actualPeakSalesM: 6000,
      peakYear: 2023,
      actualCompetitorCount: 2,
      actualCompetitors: ['Farxiga (AZ)', 'Jardiance (Boehringer/Lilly)'],
      estimatedPeakErosion: 0.30, // Slow uptake + SGLT2 incursion limited to ~30% erosion
      firstCompetitorYear: 2020,
      notes: 'Slow uptake for first 3 years; SGLT2 inhibitors (Farxiga/Jardiance) expanded into HFrEF competing directly',
    },
    sources: ['Novartis 10-K 2024'],
  },

  // ─── REGENERON LIBTAYO (NMSC — Lesion Free Skin comparator!) ───

  {
    id: 'libtayo',
    name: 'Libtayo',
    company: 'Regeneron',
    evaluationYear: 2018,
    launchYear: 2018,
    asOfInputs: {
      therapeuticArea: 'oncology',
      indication: 'skin_nmsc',
      modality: 'mab',
      phase: 'approved',
      territory: 'global',
      competitivePosition: 'challenger',
      peakSalesEstimate: { low: 500, median: 1200, high: 2500 },
      regulatoryDesignations: { breakthrough: true, fastTrack: false, orphan: false, prime: false },
      biomarkerStatus: 'unselected',
    },
    actualOutcomes: {
      actualPeakSalesM: 1200,
      peakYear: 2024,
      actualCompetitorCount: 4,
      actualCompetitors: ['Keytruda (Merck)', 'Opdivo (BMS)', 'Erivedge (Roche)', 'Odomzo (Sun Pharma)'],
      estimatedPeakErosion: 0.60, // Late entrant in crowded PD-1 space; limited share
      firstCompetitorYear: 2014,
      notes: 'PD-1 checkpoint in NMSC; late entry vs established checkpoint inhibitors limited to ~40% share',
    },
    sources: ['Regeneron 10-K 2024'],
  },

  // ─── CHECKPOINT COMPETITOR FOR ERC LFS COMPARISON ───

  {
    id: 'cosibelimab',
    name: 'Cosibelimab (Unloxcyt)',
    company: 'Sun Pharmaceutical',
    evaluationYear: 2024,
    launchYear: 2024,
    asOfInputs: {
      therapeuticArea: 'oncology',
      indication: 'skin_nmsc',
      modality: 'mab',
      phase: 'approved',
      territory: 'global',
      competitivePosition: 'behind',
      peakSalesEstimate: { low: 200, median: 500, high: 1000 },
      regulatoryDesignations: { breakthrough: false, fastTrack: false, orphan: false, prime: false },
      biomarkerStatus: 'unselected',
    },
    actualOutcomes: {
      actualPeakSalesM: 350,
      peakYear: 2027, // Projected
      actualCompetitorCount: 5,
      actualCompetitors: ['Keytruda', 'Opdivo', 'Libtayo', 'Erivedge', 'Odomzo'],
      estimatedPeakErosion: 0.55,
      firstCompetitorYear: 2014,
      notes: 'Very late entrant into crowded checkpoint inhibitor market; projected commercial ceiling',
    },
    sources: ['Sun Pharma announcements', 'Checkpoint Therapeutics filings'],
  },

  // ─── DERMATOLOGY / OTC ───

  {
    id: 'rinvoq_ad',
    name: 'Rinvoq (Atopic Dermatitis)',
    company: 'AbbVie',
    evaluationYear: 2022,
    launchYear: 2022,
    asOfInputs: {
      therapeuticArea: 'immunology',
      indication: 'atopic_dermatitis',
      modality: 'smallMolecule',
      phase: 'approved',
      territory: 'global',
      competitivePosition: 'challenger',
      peakSalesEstimate: { low: 2000, median: 4500, high: 8000 },
      regulatoryDesignations: { breakthrough: false, fastTrack: false, orphan: false, prime: false },
      biomarkerStatus: 'unselected',
    },
    actualOutcomes: {
      actualPeakSalesM: 5500, // 2024 total across indications
      peakYear: 2024,
      actualCompetitorCount: 3,
      actualCompetitors: ['Dupixent (Regeneron)', 'Cibinqo (Pfizer)', 'Rinvoq competitor JAKs'],
      estimatedPeakErosion: 0.50, // Dupixent held majority; Rinvoq got ~50% of challenger segment
      firstCompetitorYear: 2017,
      notes: 'JAK inhibitor competing against Dupixent; solid uptake but Dupixent entrenched at 75% class share',
    },
    sources: ['AbbVie 10-K 2024'],
  },

  // ─── NEUROLOGY ───

  {
    id: 'aduhelm',
    name: 'Aduhelm',
    company: 'Biogen',
    evaluationYear: 2021,
    launchYear: 2021,
    asOfInputs: {
      therapeuticArea: 'neurology',
      indication: 'alzheimers',
      modality: 'mab',
      phase: 'approved',
      territory: 'global',
      competitivePosition: 'firstInClass',
      peakSalesEstimate: { low: 1000, median: 8000, high: 15000 },
      regulatoryDesignations: { breakthrough: true, fastTrack: true, orphan: false, prime: false },
      biomarkerStatus: 'validated',
    },
    actualOutcomes: {
      actualPeakSalesM: 3, // Famously failed
      peakYear: 2022,
      actualCompetitorCount: 2,
      actualCompetitors: ['Leqembi (Eisai/Biogen)', 'Kisunla (Lilly)'],
      estimatedPeakErosion: 0.99, // Complete commercial failure
      firstCompetitorYear: 2023,
      notes: 'Commercial disaster — CMS non-coverage, payer restrictions, physician skepticism. Withdrawn from market.',
    },
    sources: ['Biogen 10-K 2022', 'CMS Coverage Decision 2022'],
    isEdgeCase: true,
    edgeCaseReason: 'Reimbursement failure (CMS non-coverage decision). Not a competitive dynamics phenomenon.',
  },

  {
    id: 'leqembi',
    name: 'Leqembi',
    company: 'Eisai/Biogen',
    evaluationYear: 2023,
    launchYear: 2023,
    asOfInputs: {
      therapeuticArea: 'neurology',
      indication: 'alzheimers',
      modality: 'mab',
      phase: 'approved',
      territory: 'global',
      competitivePosition: 'firstInClass',
      peakSalesEstimate: { low: 1500, median: 5000, high: 12000 },
      regulatoryDesignations: { breakthrough: true, fastTrack: true, orphan: false, prime: false },
      biomarkerStatus: 'validated',
    },
    actualOutcomes: {
      actualPeakSalesM: 800, // 2024 tracking
      peakYear: 2028, // Projected
      actualCompetitorCount: 1,
      actualCompetitors: ['Kisunla (Lilly)'],
      estimatedPeakErosion: 0.70, // Slow uptake due to infusion/MRI requirements
      firstCompetitorYear: 2024,
      notes: 'Infusion burden + ARIA monitoring slowed adoption; Kisunla entering with better profile',
    },
    sources: ['Biogen 10-K 2024', 'Eisai 10-K 2024'],
    isEdgeCase: true,
    edgeCaseReason: 'Safety signal (ARIA) + infusion burden limiting adoption. Not a competitive dynamics phenomenon.',
  },
];

/**
 * Get a subset of historical assets by filter.
 */
export function getHistoricalAssets(filter?: {
  therapeuticArea?: string;
  modality?: string;
  minYear?: number;
  maxYear?: number;
}): HistoricalAsset[] {
  let assets = HISTORICAL_ASSETS;
  if (filter?.therapeuticArea) {
    assets = assets.filter((a) => a.asOfInputs.therapeuticArea === filter.therapeuticArea);
  }
  if (filter?.modality) {
    assets = assets.filter((a) => a.asOfInputs.modality === filter.modality);
  }
  if (filter?.minYear != null) {
    assets = assets.filter((a) => a.launchYear >= filter.minYear!);
  }
  if (filter?.maxYear != null) {
    assets = assets.filter((a) => a.launchYear <= filter.maxYear!);
  }
  return assets;
}
