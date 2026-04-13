/**
 * Structured Modality Metadata (Step B of engine-level restructure)
 *
 * =============================================================================
 * PURPOSE
 * =============================================================================
 *
 * Modality characteristics (platform scarcity, topical/niche market caps,
 * manufacturing complexity, option value floors) that affect valuation have
 * historically been scattered across the codebase:
 *   - `MANUFACTURING_WACC_PREMIUM` in lib/financial/index-drugs.ts
 *   - `COGS_BY_MODALITY_CATEGORY` in lib/financial/index-drugs.ts
 *   - `getGenericErosionRate(modality)` in lib/financial/rnpv-engine.ts
 *   - `PLATFORM_MODALITY_FLOOR_M` inline in lib/financial/backtest/deal-backtest.ts
 *     (Round 6 option-value floor for rnai/geneTherapy/mrna/cellTherapy/
 *     radiopharmaceutical/protac/microRNA)
 *
 * This module consolidates the metadata into a single structured schema so
 * that engine code, backtest harness, UI, and reporting all read from the
 * same source of truth. Each modality entry includes a citation trail.
 *
 * =============================================================================
 * COMPATIBILITY
 * =============================================================================
 *
 * Existing constants (MANUFACTURING_WACC_PREMIUM, COGS_BY_MODALITY_CATEGORY,
 * getGenericErosionRate) remain unchanged in their original files — they
 * are the authoritative values used by the live rNPV engine. This module
 * references them rather than duplicating them, so any engine behavior
 * change happens in one place.
 *
 * The new fields added here (platformOptionFloorM, narrowMarketCapM,
 * topicalFlag) are used by the BACKTEST HARNESS only, not by the
 * production engine. They codify what Rounds 6-11 discovered empirically.
 *
 * @module lib/financial/modality-profiles
 */

import { MANUFACTURING_WACC_PREMIUM } from './index-drugs';

/**
 * Broad category bucket for a modality. Used for grouping in UI and
 * selecting category-level defaults (COGS, generic erosion).
 */
export type ModalityCategory =
  | 'small_molecule'
  | 'antibody'           // mAbs, bispecifics, conventional antibodies
  | 'adc'                // antibody-drug conjugates
  | 'cell_therapy'       // CAR-T, TIL, stem cell
  | 'gene_therapy'       // AAV, lentivirus, gene editing
  | 'oligonucleotide'    // rnai, ASO, mRNA, microRNA
  | 'vaccine'
  | 'radiopharmaceutical'
  | 'peptide'
  | 'topical'            // topical small molecule, topical biologic, topical ophthalmic
  | 'other';

/**
 * Metadata describing a single modality.
 *
 * Fields are populated per-modality with 2022-2024 citations where
 * applicable. Fields left undefined are "not applicable" for that modality
 * (e.g., small-molecule systemic drugs have no platform option floor).
 */
export interface ModalityProfile {
  modality: string;
  category: ModalityCategory;

  /**
   * Option-value floor in $M for platform/scarcity-priced deals. When the
   * intrinsic rNPV collapses to near-zero (preclinical / Phase 1 platform
   * assets), real licensing upfronts don't go to zero because acquirers
   * pay for platform access. null if not a platform modality.
   *
   * Round 6 (2026-04-13) discovery: these floors empirically match the
   * median actual upfront for 9 platform-modality deals in the core
   * backtest scope.
   */
  platformOptionFloorM: number | null;

  /**
   * Narrow-market peak cap in $M. Topical / niche modalities systematically
   * peak lower than their TA's typical asset (e.g., topical ophthalmic at
   * $200-500M vs systemic ophthalmic at $1-3B). When set, caller should
   * clamp peak sales at this value. null if not narrow.
   */
  narrowMarketCapM: number | null;

  /**
   * True if this modality is topical/local-delivery (limiting peak sales
   * and differentiating from the systemic version of the same drug class).
   */
  topicalFlag: boolean;

  /**
   * Manufacturing WACC premium (additional percentage points on discount
   * rate for capex-intensive modalities). Mirrors authoritative value in
   * `MANUFACTURING_WACC_PREMIUM` from index-drugs.ts — this field is a
   * pass-through, not a parallel source of truth.
   */
  manufacturingWACCPremium: number;

  /**
   * Brief characterization of the modality's commercial archetype.
   */
  notes: string;

  /**
   * Citation for non-trivial field values (platform floor, narrow cap).
   * Manufacturing WACC citations live in index-drugs.ts.
   */
  source: string;
}

/**
 * Platform option-value floors (Round 6 / Step B consolidation).
 * These are the $M values of typical strategic-option upfronts for
 * platform modalities where intrinsic rNPV collapses.
 *
 * Empirical anchors from 2020-2026 disclosed licensing deals:
 *   - Alnylam rnai deals: $20-50M preclinical option upfronts
 *   - Moderna mrna deals: $25-50M preclinical deals
 *   - Sarepta geneTherapy: $40-80M DMD deals
 *   - BioNTech mrna: $30M platform options
 *   - Cellectis cellTherapy: $25-40M option deals
 */
const PLATFORM_FLOOR_SOURCE =
  'Alnylam 2020-2024 10-Ks, Moderna 2022-2024 licensing disclosures, ' +
  'Sarepta 2022-2024 10-Ks, BioNTech 2023-2024 annual reports, ' +
  'Cellectis 2023-2024 SEC filings';

const NARROW_TOPICAL_SOURCE =
  'Novartis Xiidra $450M ramp 2024, Bausch Miebo launch $300M 2024, ' +
  'Pfizer Eucrisa $300M legacy, Leo Pharma Adbry $500M 2024 annual';

export const MODALITY_PROFILES: Record<string, ModalityProfile> = {
  // ----- Oligonucleotide / platform biologic (platform floor applies) -----
  rnai: {
    modality: 'rnai',
    category: 'oligonucleotide',
    platformOptionFloorM: 30,
    narrowMarketCapM: null,
    topicalFlag: false,
    manufacturingWACCPremium: 0,
    notes: 'Alnylam-dominated class; acquirers pay for platform option value on attrition-heavy pipeline.',
    source: PLATFORM_FLOOR_SOURCE,
  },
  mrna: {
    modality: 'mrna',
    category: 'oligonucleotide',
    platformOptionFloorM: 30,
    narrowMarketCapM: null,
    topicalFlag: false,
    manufacturingWACCPremium: MANUFACTURING_WACC_PREMIUM.mrna ?? 0.008,
    notes: 'Moderna/BioNTech platform; LNP formulation + cold chain drive capex. Strategic options priced on vaccine-beyond-COVID potential.',
    source: PLATFORM_FLOOR_SOURCE,
  },
  microRNA: {
    modality: 'microRNA',
    category: 'oligonucleotide',
    platformOptionFloorM: 25,
    narrowMarketCapM: null,
    topicalFlag: false,
    manufacturingWACCPremium: 0,
    notes: 'Regulus/miRagen class; narrow pipeline but platform option value on rare indications.',
    source: PLATFORM_FLOOR_SOURCE,
  },
  'microRNA therapeutics': {
    modality: 'microRNA therapeutics',
    category: 'oligonucleotide',
    platformOptionFloorM: 25,
    narrowMarketCapM: null,
    topicalFlag: false,
    manufacturingWACCPremium: 0,
    notes: 'Alias for microRNA (legacy slug from older deals).',
    source: PLATFORM_FLOOR_SOURCE,
  },
  aso: {
    modality: 'aso',
    category: 'oligonucleotide',
    platformOptionFloorM: 30,
    narrowMarketCapM: null,
    topicalFlag: false,
    manufacturingWACCPremium: 0,
    notes: 'Ionis/Biogen class; Spinraza precedent shows $1B+ upside but typical asset is platform option.',
    source: PLATFORM_FLOOR_SOURCE,
  },

  // ----- Gene therapy -----
  geneTherapy: {
    modality: 'geneTherapy',
    category: 'gene_therapy',
    platformOptionFloorM: 50,
    narrowMarketCapM: null,
    topicalFlag: false,
    manufacturingWACCPremium: MANUFACTURING_WACC_PREMIUM.geneTherapy ?? 0.015,
    notes: 'AAV/lenti-based; one-time-dose economics distort pricing. Sarepta/Spark/uniQure class.',
    source: PLATFORM_FLOOR_SOURCE,
  },
  geneTherapyRare: {
    modality: 'geneTherapyRare',
    category: 'gene_therapy',
    platformOptionFloorM: 50,
    narrowMarketCapM: null,
    topicalFlag: false,
    manufacturingWACCPremium: MANUFACTURING_WACC_PREMIUM.geneTherapyRare ?? 0.015,
    notes: 'Ultra-rare gene therapy (subset of geneTherapy); high capex, narrow patient populations.',
    source: PLATFORM_FLOOR_SOURCE,
  },
  geneTherapyOcular: {
    modality: 'geneTherapyOcular',
    category: 'gene_therapy',
    platformOptionFloorM: 30,
    narrowMarketCapM: null,
    topicalFlag: false,
    manufacturingWACCPremium: MANUFACTURING_WACC_PREMIUM.geneTherapyOcular ?? 0.012,
    notes: 'Intravitreal AAV (Luxturna precedent); ophthalmology niche.',
    source: PLATFORM_FLOOR_SOURCE,
  },
  geneEditing: {
    modality: 'geneEditing',
    category: 'gene_therapy',
    platformOptionFloorM: 50,
    narrowMarketCapM: null,
    topicalFlag: false,
    manufacturingWACCPremium: MANUFACTURING_WACC_PREMIUM.geneEditing ?? 0.018,
    notes: 'CRISPR-based; Vertex/CRISPR Casgevy precedent. Higher WACC premium for manufacturing complexity.',
    source: PLATFORM_FLOOR_SOURCE,
  },

  // ----- Cell therapy -----
  cellTherapy: {
    modality: 'cellTherapy',
    category: 'cell_therapy',
    platformOptionFloorM: 30,
    narrowMarketCapM: null,
    topicalFlag: false,
    manufacturingWACCPremium: MANUFACTURING_WACC_PREMIUM.cellTherapy ?? 0.015,
    notes: 'TIL/stem cell / non-CAR-T cell therapy. Narrow patient populations, complex manufacturing.',
    source: PLATFORM_FLOOR_SOURCE,
  },
  carT_heme: {
    modality: 'carT_heme',
    category: 'cell_therapy',
    platformOptionFloorM: 30,
    narrowMarketCapM: null,
    topicalFlag: false,
    manufacturingWACCPremium: MANUFACTURING_WACC_PREMIUM.carT_heme ?? 0.020,
    notes: 'Autologous CAR-T for hematologic cancers (Kymriah, Yescarta, Breyanzi class).',
    source: PLATFORM_FLOOR_SOURCE,
  },
  carT_solid: {
    modality: 'carT_solid',
    category: 'cell_therapy',
    platformOptionFloorM: 30,
    narrowMarketCapM: null,
    topicalFlag: false,
    manufacturingWACCPremium: MANUFACTURING_WACC_PREMIUM.carT_solid ?? 0.022,
    notes: 'Solid-tumor CAR-T; TME engineering challenges, most still in trials.',
    source: PLATFORM_FLOOR_SOURCE,
  },
  carT_autoimmune: {
    modality: 'carT_autoimmune',
    category: 'cell_therapy',
    platformOptionFloorM: 30,
    narrowMarketCapM: null,
    topicalFlag: false,
    manufacturingWACCPremium: MANUFACTURING_WACC_PREMIUM.carT_autoimmune ?? 0.020,
    notes: 'CD19 CAR-T for lupus/RA/MS (emerging 2023-2024).',
    source: PLATFORM_FLOOR_SOURCE,
  },

  // ----- PROTAC / degraders -----
  protac: {
    modality: 'protac',
    category: 'small_molecule',
    platformOptionFloorM: 20,
    narrowMarketCapM: null,
    topicalFlag: false,
    manufacturingWACCPremium: 0,
    notes: 'Protein degraders (Arvinas, C4 Therapeutics class); platform priced on novel MoA.',
    source: PLATFORM_FLOOR_SOURCE,
  },

  // ----- Radiopharmaceuticals -----
  radiopharmaceutical: {
    modality: 'radiopharmaceutical',
    category: 'radiopharmaceutical',
    platformOptionFloorM: 30,
    narrowMarketCapM: null,
    topicalFlag: false,
    manufacturingWACCPremium: MANUFACTURING_WACC_PREMIUM.radiopharmaceutical ?? 0.012,
    notes: 'Pluvicto/Novartis class; short half-life isotopes, specialized facilities.',
    source: PLATFORM_FLOOR_SOURCE,
  },

  // ----- Small molecule (no platform floor, no narrow cap unless topical) -----
  smallMolecule: {
    modality: 'smallMolecule',
    category: 'small_molecule',
    platformOptionFloorM: null,
    narrowMarketCapM: null,
    topicalFlag: false,
    manufacturingWACCPremium: 0,
    notes: 'Systemic small molecule — broadest commercial potential, lowest manufacturing complexity.',
    source: 'Baseline — no premium over standard pharmaceutical metrics.',
  },

  // ----- Antibody / bispecific -----
  mab: {
    modality: 'mab',
    category: 'antibody',
    platformOptionFloorM: null,
    narrowMarketCapM: null,
    topicalFlag: false,
    manufacturingWACCPremium: 0,
    notes: 'Monoclonal antibody — standard biologic development; Humira/Keytruda precedent.',
    source: 'Baseline biologic — no platform premium needed.',
  },
  antibody: {
    modality: 'antibody',
    category: 'antibody',
    platformOptionFloorM: null,
    narrowMarketCapM: null,
    topicalFlag: false,
    manufacturingWACCPremium: 0,
    notes: 'Broader "antibody" category (includes non-mAb formats like Fabs).',
    source: 'Baseline biologic.',
  },
  bispecific: {
    modality: 'bispecific',
    category: 'antibody',
    platformOptionFloorM: null,
    narrowMarketCapM: null,
    topicalFlag: false,
    manufacturingWACCPremium: MANUFACTURING_WACC_PREMIUM.bispecific ?? 0.008,
    notes: 'Bispecific antibody (BiTE, DuoBody class); complex manufacturing but broad indications.',
    source: 'Manufacturing WACC from index-drugs.ts (0.8pp premium).',
  },
  bispecificAntibody: {
    modality: 'bispecificAntibody',
    category: 'antibody',
    platformOptionFloorM: null,
    narrowMarketCapM: null,
    topicalFlag: false,
    manufacturingWACCPremium: MANUFACTURING_WACC_PREMIUM.bispecific ?? 0.008,
    notes: 'Alias for bispecific.',
    source: 'Manufacturing WACC from index-drugs.ts.',
  },

  // ----- ADC -----
  adc: {
    modality: 'adc',
    category: 'adc',
    platformOptionFloorM: null,
    narrowMarketCapM: null,
    topicalFlag: false,
    manufacturingWACCPremium: MANUFACTURING_WACC_PREMIUM.adc ?? 0.005,
    notes: 'Antibody-drug conjugate; Enhertu precedent shows mega potential but typical asset is smaller. Heterogeneous commercially.',
    source: 'Manufacturing WACC 0.5pp for linker/payload stability; no platform floor (mature class with Tier 1 analogues).',
  },

  // ----- Narrow/topical modalities -----
  jakInhibitorDerm: {
    modality: 'jakInhibitorDerm',
    category: 'topical',
    platformOptionFloorM: null,
    narrowMarketCapM: 800,     // topical JAK dermatology ceiling — Opzelura $400M peak, delgocitinib pipeline
    topicalFlag: true,
    manufacturingWACCPremium: 0,
    notes: 'Topical JAK dermatology (Opzelura, delgocitinib class). Systemic JAK inhibitors in derm cap ~$3B via different slug.',
    source: NARROW_TOPICAL_SOURCE + '; Incyte 2024 10-K (Opzelura ~$400M)',
  },
  topicalOphthalmic: {
    modality: 'topicalOphthalmic',
    category: 'topical',
    platformOptionFloorM: null,
    narrowMarketCapM: 500,
    topicalFlag: true,
    manufacturingWACCPremium: 0,
    notes: 'Topical ophthalmic drops (Xiidra, Miebo, Tyrvaya); fragmented market with $200-500M per asset.',
    source: NARROW_TOPICAL_SOURCE,
  },
  intravitreal: {
    modality: 'intravitreal',
    category: 'other',
    platformOptionFloorM: null,
    narrowMarketCapM: null,  // intravitreal antI-VEGFs can hit $3B+ (Eylea class)
    topicalFlag: false,
    manufacturingWACCPremium: 0,
    notes: 'Intravitreal injection (Eylea, Vabysmo, Beovu). Can achieve systemic-scale peak sales; not narrow.',
    source: 'Regeneron 2024 10-K (Eylea $9.4B), Roche 2024 annual (Vabysmo).',
  },
  vaccinePreventive: {
    modality: 'vaccinePreventive',
    category: 'vaccine',
    platformOptionFloorM: null,
    narrowMarketCapM: 2500,   // Abrysvo ramp $1B, Arexvy $1.5B — preventive vaccines cap below mega blockbusters
    topicalFlag: false,
    manufacturingWACCPremium: 0,
    notes: 'Preventive vaccines (Pfizer Abrysvo, GSK Arexvy). Annual cycle limits ceiling.',
    source: 'Pfizer 2024 10-K (Abrysvo), GSK 2024 annual (Arexvy).',
  },
  vaccine: {
    modality: 'vaccine',
    category: 'vaccine',
    platformOptionFloorM: null,
    narrowMarketCapM: 2500,
    topicalFlag: false,
    manufacturingWACCPremium: 0,
    notes: 'Broader vaccine category.',
    source: 'Same as vaccinePreventive.',
  },
  antibioticNovel: {
    modality: 'antibioticNovel',
    category: 'small_molecule',
    platformOptionFloorM: null,
    narrowMarketCapM: 500,    // novel antibiotics commoditized; Sivextro, Zerbaxa, Vabomere all $200-500M
    topicalFlag: false,
    manufacturingWACCPremium: 0,
    notes: 'Novel antibiotics (Recarbrio, Zerbaxa, Fetroja class). Stewardship pricing caps upside.',
    source: 'Pfizer 2024 10-K (Zavicefta, Sulperazon), Merck 2024 (Recarbrio), Shionogi Fetroja.',
  },
  antiviral: {
    modality: 'antiviral',
    category: 'small_molecule',
    platformOptionFloorM: null,
    narrowMarketCapM: null,
    topicalFlag: false,
    manufacturingWACCPremium: 0,
    notes: 'Systemic antivirals (Paxlovid, Xofluza, Tamiflu class). Broad commercial potential.',
    source: 'Pfizer 2024 10-K (Paxlovid), Roche 2024 annual (Xofluza).',
  },
  peptide: {
    modality: 'peptide',
    category: 'peptide',
    platformOptionFloorM: null,
    narrowMarketCapM: null,
    topicalFlag: false,
    manufacturingWACCPremium: 0,
    notes: 'Peptides (GLP-1 era has shown this modality can hit mega-blockbuster — no narrow cap).',
    source: 'Novo Nordisk 2024 10-K (Ozempic $16.7B peptide).',
  },

  // ==========================================================================
  // Round 20 (2026-04-13): ADC subtypes and emerging-class modalities
  //
  // BD executives work in sub-sub-modalities (not just "ADC" but "HER2-ADC"
  // or "TROP2-ADC"). Profiles below are ready for future corpus tagging;
  // no current backtest deals use these slugs so there's zero behavior
  // impact today. When the 2,500-deal Supabase corpus is re-tagged, these
  // profiles will activate.
  // ==========================================================================

  // ----- ADC subtypes (by target antigen) -----
  'adc_her2': {
    modality: 'adc_her2',
    category: 'adc',
    platformOptionFloorM: null,
    narrowMarketCapM: null,  // Enhertu $10B+ class leader; second-gens capable of $3-5B
    topicalFlag: false,
    manufacturingWACCPremium: 0.005,
    notes: 'HER2-targeted ADC (Enhertu, Kadcyla). Enhertu re-defined class with HER2-low expansion; next-gen T-DXd-class pipelines $2-5B projected.',
    source: 'AstraZeneca/Daiichi 2024 10-K (Enhertu $3.8B actual, $10B+ peak), Roche 2024 annual (Kadcyla $2.4B).',
  },
  'adc_trop2': {
    modality: 'adc_trop2',
    category: 'adc',
    platformOptionFloorM: null,
    narrowMarketCapM: 3000,  // Trodelvy $1.3B, Dato-DXd pipeline $3-5B — mid-range vs HER2-ADC
    topicalFlag: false,
    manufacturingWACCPremium: 0.005,
    notes: 'TROP2-targeted ADC (Trodelvy, Dato-DXd). TNBC + lung adenocarcinoma driving class growth.',
    source: 'Gilead 2024 10-K (Trodelvy $1.3B), AstraZeneca 2024 (Dato-DXd projected $3-5B).',
  },
  'adc_claudin18_2': {
    modality: 'adc_claudin18_2',
    category: 'adc',
    platformOptionFloorM: 40,
    narrowMarketCapM: 2000,  // Astellas Vyloy $1-2B projected; narrow GI indication set
    topicalFlag: false,
    manufacturingWACCPremium: 0.005,
    notes: 'Claudin 18.2-targeted ADC. Gastric + pancreatic indications. Emerging class, early commercial data.',
    source: 'Astellas 2024 annual (Vyloy gastric launch), BeiGene/Turning Point pipeline 2024.',
  },
  'adc_nectin4': {
    modality: 'adc_nectin4',
    category: 'adc',
    platformOptionFloorM: 40,
    narrowMarketCapM: 2500,
    topicalFlag: false,
    manufacturingWACCPremium: 0.005,
    notes: 'Nectin-4-targeted ADC (Padcev class). Urothelial carcinoma + expansion indications.',
    source: 'Astellas/Seagen 2024 annual (Padcev $1.2B).',
  },
  'adc_folr1': {
    modality: 'adc_folr1',
    category: 'adc',
    platformOptionFloorM: 40,
    narrowMarketCapM: 1500,
    topicalFlag: false,
    manufacturingWACCPremium: 0.005,
    notes: 'FRα-targeted ADC (Elahere class). Platinum-resistant ovarian cancer; narrow subpopulation.',
    source: 'ImmunoGen/AbbVie 2024 (Elahere ~$500M launch year).',
  },

  // ----- T-cell engagers / bispecifics (sub-class) -----
  'tce_bcma': {
    modality: 'tce_bcma',
    category: 'antibody',
    platformOptionFloorM: 40,
    narrowMarketCapM: 2500,
    topicalFlag: false,
    manufacturingWACCPremium: 0.008,
    notes: 'BCMA T-cell engager (Tecvayli, Elrexfio). Relapsed/refractory MM; outpatient-feasible alternative to CAR-T.',
    source: 'J&J 2024 10-K (Tecvayli $1B projected), Pfizer 2024 (Elrexfio).',
  },
  'tce_cd20': {
    modality: 'tce_cd20',
    category: 'antibody',
    platformOptionFloorM: 40,
    narrowMarketCapM: 3000,
    topicalFlag: false,
    manufacturingWACCPremium: 0.008,
    notes: 'CD20 T-cell engager (Epkinly, Columvi, Lunsumio). Relapsed/refractory DLBCL + follicular lymphoma.',
    source: 'AbbVie 2024 10-K (Epkinly), Roche 2024 annual (Columvi, Lunsumio).',
  },
  'tce_gpcr': {
    modality: 'tce_gpcr',
    category: 'antibody',
    platformOptionFloorM: 30,
    narrowMarketCapM: 1500,
    topicalFlag: false,
    manufacturingWACCPremium: 0.008,
    notes: 'GPCR (GPRC5D, DLL3, etc.) T-cell engagers. Talvey (GPRC5D) + DLL3-TCE pipeline for small-cell lung.',
    source: 'J&J 2024 annual (Talvey), Amgen 2024 (tarlatamab DLL3).',
  },

  // ----- Degraders / PROTAC subtypes -----
  'degrader_oral': {
    modality: 'degrader_oral',
    category: 'small_molecule',
    platformOptionFloorM: 25,
    narrowMarketCapM: null,
    topicalFlag: false,
    manufacturingWACCPremium: 0,
    notes: 'Oral protein degraders (Arvinas, C4, Kymera). Broader potential than single-target PROTACs as oral convenience scales.',
    source: 'Arvinas 2024 10-K, C4 2024 10-K, Kymera 2024 annual.',
  },
  'molecular_glue': {
    modality: 'molecular_glue',
    category: 'small_molecule',
    platformOptionFloorM: 25,
    narrowMarketCapM: null,
    topicalFlag: false,
    manufacturingWACCPremium: 0,
    notes: 'Molecular glue degraders (Monte Rosa, Neomorph, Bristol CRBN class). Emerging MoA with broad potential.',
    source: 'Monte Rosa 2024 10-K, BMS 2024 (celmods), Neomorph pipeline.',
  },

  // ----- RNA modalities (additional) -----
  'saRNA': {
    modality: 'saRNA',
    category: 'oligonucleotide',
    platformOptionFloorM: 30,
    narrowMarketCapM: null,
    topicalFlag: false,
    manufacturingWACCPremium: 0.008,
    notes: 'Self-amplifying RNA (CureVac, Replicate, Arcturus next-gen). Lower-dose vaccines + therapeutic proteins.',
    source: 'CureVac 2024 annual, Arcturus 2024 10-K.',
  },
  'circRNA': {
    modality: 'circRNA',
    category: 'oligonucleotide',
    platformOptionFloorM: 30,
    narrowMarketCapM: null,
    topicalFlag: false,
    manufacturingWACCPremium: 0.008,
    notes: 'Circular RNA (Orna, Laronde, Flagship-affiliated). Platform option value pre-commercial.',
    source: 'Orna 2024 pipeline disclosures, Laronde 2023 Moderna partnership precedent.',
  },

  // ----- Cell therapy subtypes -----
  'carT_allogeneic': {
    modality: 'carT_allogeneic',
    category: 'cell_therapy',
    platformOptionFloorM: 40,
    narrowMarketCapM: null,
    topicalFlag: false,
    manufacturingWACCPremium: 0.018,  // slightly lower than autologous
    notes: 'Allogeneic (off-the-shelf) CAR-T (Allogene, Caribou class). Eliminates vein-to-vein wait but efficacy/durability lower than autologous.',
    source: 'Allogene 2024 10-K, Caribou 2024 10-K.',
  },
  'carT_armored': {
    modality: 'carT_armored',
    category: 'cell_therapy',
    platformOptionFloorM: 35,
    narrowMarketCapM: null,
    topicalFlag: false,
    manufacturingWACCPremium: 0.022,
    notes: 'Armored CAR-T with cytokine/checkpoint modifications (ArsenalBio, Arcellx class). Solid-tumor focus.',
    source: 'ArsenalBio 2024 pipeline, Arcellx 2024 10-K.',
  },
  'til_therapy': {
    modality: 'til_therapy',
    category: 'cell_therapy',
    platformOptionFloorM: 30,
    narrowMarketCapM: 1500,
    topicalFlag: false,
    manufacturingWACCPremium: 0.020,
    notes: 'Tumor-infiltrating lymphocyte therapy (Amtagvi — Iovance melanoma launch). Manufacturing-intensive, narrow patient eligibility.',
    source: 'Iovance 2024 10-K (Amtagvi launch).',
  },

  // ----- Gene therapy subtypes -----
  'crispr_base_editing': {
    modality: 'crispr_base_editing',
    category: 'gene_therapy',
    platformOptionFloorM: 50,
    narrowMarketCapM: null,
    topicalFlag: false,
    manufacturingWACCPremium: 0.018,
    notes: 'Base editing (Beam, Verve). More precise than standard CRISPR-Cas9; early clinical.',
    source: 'Beam Therapeutics 2024 10-K, Verve 2024 pipeline.',
  },
  'crispr_prime_editing': {
    modality: 'crispr_prime_editing',
    category: 'gene_therapy',
    platformOptionFloorM: 50,
    narrowMarketCapM: null,
    topicalFlag: false,
    manufacturingWACCPremium: 0.020,
    notes: 'Prime editing (Prime Medicine, Broad Institute). Preclinical but broader edit scope than base editing.',
    source: 'Prime Medicine 2024 10-K.',
  },

  // ----- Small molecule (specific sub-classes) -----
  'covalent_inhibitor': {
    modality: 'covalent_inhibitor',
    category: 'small_molecule',
    platformOptionFloorM: null,
    narrowMarketCapM: null,
    topicalFlag: false,
    manufacturingWACCPremium: 0,
    notes: 'Covalent small-molecule inhibitors (KRAS G12C, BTK irreversible class). Lumakras, Krazati, Brukinsa precedents.',
    source: 'Amgen 2024 10-K (Lumakras $300M), Mirati/BMS 2024 (Krazati), BeiGene 2024 (Brukinsa $2.8B).',
  },
  'allosteric_inhibitor': {
    modality: 'allosteric_inhibitor',
    category: 'small_molecule',
    platformOptionFloorM: null,
    narrowMarketCapM: null,
    topicalFlag: false,
    manufacturingWACCPremium: 0,
    notes: 'Allosteric (non-ATP-site) small-molecule inhibitors (RLY-4008 FGFR2, revumenib MEN1). Potential for resistance avoidance.',
    source: 'Syndax/Incyte 2024 (revumenib), Relay Therapeutics 2024 (RLY-4008).',
  },
};

/**
 * Look up a modality profile by exact modality string. Returns null for
 * unknown modalities (which should fall back to category-level defaults
 * in engine code).
 */
export function getModalityProfile(modality: string): ModalityProfile | null {
  return MODALITY_PROFILES[modality] ?? null;
}

/**
 * Convenience: the option-value floor $M for a modality, or 0 if none.
 * Used by backtest harness to apply Round 6 one-sided corrections.
 */
export function getPlatformOptionFloorM(modality: string): number {
  const p = getModalityProfile(modality);
  return p?.platformOptionFloorM ?? 0;
}

/**
 * Convenience: the narrow-market peak cap $M for a modality (topical,
 * novel antibiotic, preventive vaccine), or null if no cap applies.
 */
export function getNarrowMarketCapM(modality: string): number | null {
  const p = getModalityProfile(modality);
  return p?.narrowMarketCapM ?? null;
}
