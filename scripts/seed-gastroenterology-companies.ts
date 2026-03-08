// Script to seed gastroenterology-focused companies into the partner matching database
// Run with: npx tsx scripts/seed-gastroenterology-companies.ts
//
// These companies are curated from real deal activity, SEC filings, and pipeline data.
// Each company includes GI-relevant indications, modalities, strategic priorities,
// and deal history to power accurate partner matching for gastroenterology assets.

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface GastroCompany {
  name: string;
  name_variations: string[];
  ticker: string | null;
  company_type: 'large_pharma' | 'mid_pharma' | 'large_biotech' | 'mid_biotech' | 'specialty';
  hq_country: string;
  modalities_active: string[];
  modalities_primary: string[];
  indications_active: string[];
  indications_specific: string[];
  phase_preference_min: string;
  phase_preference_max: string;
  territory_focus: string[];
  deals_last_12mo: number;
  deals_last_24mo: number;
  active_trials_count: number;
  avg_upfront_usd: number | null;
  median_upfront_usd: number | null;
  actively_acquiring: boolean;
  acquisition_appetite: 'aggressive' | 'moderate' | 'selective' | 'inactive';
  strategic_priorities: string[];
  data_quality_score: number;
  patent_cliffs: Array<{
    drug_name: string;
    indication: string;
    revenue_usd: number;
    expiry_year: number;
  }>;
}

// =============================================================================
// GASTROENTEROLOGY COMPANY DATABASE
// Sources: SEC filings, DealForma, BioPharma Dive, Evaluate Pharma, company IRs
// =============================================================================

const gastroCompanies: GastroCompany[] = [
  // ─────────────────────────────────────────────────────────────────
  // LARGE PHARMA / BIOTECH WITH MAJOR GI FRANCHISES
  // ─────────────────────────────────────────────────────────────────
  {
    name: 'AbbVie',
    name_variations: ['AbbVie Inc.', 'AbbVie Inc'],
    ticker: 'ABBV',
    company_type: 'large_pharma',
    hq_country: 'US',
    modalities_active: ['antibody', 'small_molecule', 'peptide'],
    modalities_primary: ['antibody'],
    indications_active: ['gi', 'autoimmune', 'oncology', 'dermatology'],
    indications_specific: ['crohns', 'ulcerative_colitis', 'ibd', 'celiac_disease'],
    phase_preference_min: 'phase_1',
    phase_preference_max: 'approved',
    territory_focus: ['global'],
    deals_last_12mo: 6,
    deals_last_24mo: 12,
    active_trials_count: 35,
    avg_upfront_usd: 2500000000,
    median_upfront_usd: 1400000000,
    actively_acquiring: true,
    acquisition_appetite: 'aggressive',
    strategic_priorities: ['ibd', 'crohns', 'ulcerative_colitis', 'il-23_gi', 'next_gen_biologics_gi'],
    data_quality_score: 92,
    patent_cliffs: [
      { drug_name: 'Skyrizi (risankizumab)', indication: 'GI (Crohns/UC)', revenue_usd: 8500000000, expiry_year: 2035 },
      { drug_name: 'Rinvoq (upadacitinib)', indication: 'GI (UC/Crohns)', revenue_usd: 5000000000, expiry_year: 2034 },
      { drug_name: 'Humira (adalimumab)', indication: 'GI (Crohns/UC)', revenue_usd: 5500000000, expiry_year: 2025 },
    ],
  },
  {
    name: 'Takeda',
    name_variations: ['Takeda Pharmaceutical', 'Takeda Pharma', 'Takeda GI'],
    ticker: 'TAK',
    company_type: 'large_pharma',
    hq_country: 'Japan',
    modalities_active: ['antibody', 'small_molecule', 'peptide', 'microbiome'],
    modalities_primary: ['antibody', 'small_molecule'],
    indications_active: ['gi', 'rare_disease', 'oncology', 'cns'],
    indications_specific: ['ulcerative_colitis', 'crohns', 'celiac_disease', 'short_bowel_syndrome', 'eosinophilic_esophagitis'],
    phase_preference_min: 'phase_1',
    phase_preference_max: 'approved',
    territory_focus: ['global', 'japan'],
    deals_last_12mo: 5,
    deals_last_24mo: 9,
    active_trials_count: 30,
    avg_upfront_usd: 500000000,
    median_upfront_usd: 300000000,
    actively_acquiring: true,
    acquisition_appetite: 'aggressive',
    strategic_priorities: ['ibd', 'celiac_disease', 'gi_motility', 'microbiome', 'short_bowel'],
    data_quality_score: 90,
    patent_cliffs: [
      { drug_name: 'Entyvio (vedolizumab)', indication: 'GI (UC/Crohns)', revenue_usd: 5500000000, expiry_year: 2028 },
      { drug_name: 'Gattex/Revestive (teduglutide)', indication: 'GI (Short Bowel Syndrome)', revenue_usd: 800000000, expiry_year: 2027 },
    ],
  },
  {
    name: 'Johnson & Johnson (Janssen)',
    name_variations: ['J&J', 'Janssen', 'Janssen Pharmaceuticals', 'Janssen Biotech'],
    ticker: 'JNJ',
    company_type: 'large_pharma',
    hq_country: 'US',
    modalities_active: ['antibody', 'small_molecule', 'bispecific'],
    modalities_primary: ['antibody'],
    indications_active: ['gi', 'autoimmune', 'oncology', 'cns'],
    indications_specific: ['ulcerative_colitis', 'crohns', 'ibd'],
    phase_preference_min: 'phase_1',
    phase_preference_max: 'approved',
    territory_focus: ['global'],
    deals_last_12mo: 5,
    deals_last_24mo: 10,
    active_trials_count: 25,
    avg_upfront_usd: 3500000000,
    median_upfront_usd: 2000000000,
    actively_acquiring: true,
    acquisition_appetite: 'aggressive',
    strategic_priorities: ['ibd', 'il-23_gi', 'crohns', 'ulcerative_colitis'],
    data_quality_score: 88,
    patent_cliffs: [
      { drug_name: 'Stelara (ustekinumab)', indication: 'GI (Crohns/UC)', revenue_usd: 10000000000, expiry_year: 2025 },
      { drug_name: 'Tremfya (guselkumab)', indication: 'GI (UC expansion)', revenue_usd: 3500000000, expiry_year: 2033 },
    ],
  },
  {
    name: 'Pfizer',
    name_variations: ['Pfizer Inc.', 'Pfizer Inc'],
    ticker: 'PFE',
    company_type: 'large_pharma',
    hq_country: 'US',
    modalities_active: ['small_molecule', 'antibody', 'peptide'],
    modalities_primary: ['small_molecule'],
    indications_active: ['gi', 'autoimmune', 'oncology', 'dermatology'],
    indications_specific: ['ulcerative_colitis', 'crohns', 'eosinophilic_esophagitis', 'ibd'],
    phase_preference_min: 'phase_1',
    phase_preference_max: 'approved',
    territory_focus: ['global'],
    deals_last_12mo: 6,
    deals_last_24mo: 12,
    active_trials_count: 22,
    avg_upfront_usd: 2000000000,
    median_upfront_usd: 1000000000,
    actively_acquiring: true,
    acquisition_appetite: 'aggressive',
    strategic_priorities: ['jak_inhibitor_gi', 's1p_receptor_gi', 'ibd', 'ulcerative_colitis'],
    data_quality_score: 88,
    patent_cliffs: [
      { drug_name: 'Xeljanz (tofacitinib)', indication: 'GI (Ulcerative Colitis)', revenue_usd: 2000000000, expiry_year: 2025 },
      { drug_name: 'Velsipity (etrasimod)', indication: 'GI (Ulcerative Colitis S1P)', revenue_usd: 300000000, expiry_year: 2036 },
    ],
  },
  {
    name: 'Bristol-Myers Squibb',
    name_variations: ['BMS', 'Bristol Myers Squibb', 'Bristol-Myers Squibb Company'],
    ticker: 'BMY',
    company_type: 'large_pharma',
    hq_country: 'US',
    modalities_active: ['small_molecule', 'antibody', 'bispecific'],
    modalities_primary: ['small_molecule'],
    indications_active: ['gi', 'oncology', 'hematology', 'cardiovascular'],
    indications_specific: ['ulcerative_colitis', 'crohns', 'ibd'],
    phase_preference_min: 'phase_1',
    phase_preference_max: 'approved',
    territory_focus: ['global'],
    deals_last_12mo: 4,
    deals_last_24mo: 8,
    active_trials_count: 18,
    avg_upfront_usd: 2000000000,
    median_upfront_usd: 1000000000,
    actively_acquiring: true,
    acquisition_appetite: 'moderate',
    strategic_priorities: ['tyk2_gi', 'ibd', 'autoimmune_gi', 's1p_gi'],
    data_quality_score: 82,
    patent_cliffs: [
      { drug_name: 'Zeposia (ozanimod)', indication: 'GI (Ulcerative Colitis S1P)', revenue_usd: 500000000, expiry_year: 2034 },
    ],
  },
  {
    name: 'Prometheus Biosciences (Merck)',
    name_variations: ['Prometheus Bio', 'Prometheus', 'Merck Prometheus'],
    ticker: 'MRK',
    company_type: 'large_pharma',
    hq_country: 'US',
    modalities_active: ['antibody', 'diagnostics'],
    modalities_primary: ['antibody'],
    indications_active: ['gi', 'autoimmune'],
    indications_specific: ['ulcerative_colitis', 'crohns', 'ibd'],
    phase_preference_min: 'preclinical',
    phase_preference_max: 'phase_3',
    territory_focus: ['global'],
    deals_last_12mo: 3,
    deals_last_24mo: 5,
    active_trials_count: 10,
    avg_upfront_usd: 1000000000,
    median_upfront_usd: 500000000,
    actively_acquiring: true,
    acquisition_appetite: 'aggressive',
    strategic_priorities: ['precision_gi', 'tl1a_antibody', 'ibd_biomarker', 'crohns'],
    data_quality_score: 80,
    patent_cliffs: [
      { drug_name: 'PRA023 (anti-TL1A)', indication: 'GI (UC/Crohns TL1A)', revenue_usd: 2000000000, expiry_year: 2038 },
    ],
  },
  {
    name: 'Protagonist Therapeutics',
    name_variations: ['Protagonist', 'Protagonist Therapeutics Inc.'],
    ticker: 'PTGX',
    company_type: 'mid_biotech',
    hq_country: 'US',
    modalities_active: ['peptide', 'small_molecule'],
    modalities_primary: ['peptide'],
    indications_active: ['gi', 'hematology'],
    indications_specific: ['ulcerative_colitis', 'crohns', 'ibd'],
    phase_preference_min: 'preclinical',
    phase_preference_max: 'phase_3',
    territory_focus: ['global'],
    deals_last_12mo: 2,
    deals_last_24mo: 4,
    active_trials_count: 6,
    avg_upfront_usd: 150000000,
    median_upfront_usd: 75000000,
    actively_acquiring: false,
    acquisition_appetite: 'selective',
    strategic_priorities: ['il-17_peptide', 'oral_peptide_gi', 'ibd', 'injectable_peptide'],
    data_quality_score: 68,
    // Note: JNJ-2113 commercial rights held by J&J — Protagonist receives royalties/milestones only
    patent_cliffs: [
      { drug_name: 'Rusfertide', indication: 'Hematology (Polycythemia Vera)', revenue_usd: 300000000, expiry_year: 2037 },
      { drug_name: 'JNJ-2113 (icotrokinra) — partnered asset', indication: 'GI (UC/Crohns IL-17 peptide)', revenue_usd: 50000000, expiry_year: 2037 },
    ],
  },
  {
    // Acquired by Eli Lilly in Aug 2024 for $3.2B — ticker MORF is defunct
    name: 'Morphic Therapeutic (Eli Lilly)',
    name_variations: ['Morphic', 'Morphic Therapeutic Inc.', 'Morphic Therapeutic'],
    ticker: null,
    company_type: 'mid_biotech',
    hq_country: 'US',
    modalities_active: ['small_molecule'],
    modalities_primary: ['small_molecule'],
    indications_active: ['gi', 'autoimmune', 'pulmonology'],
    indications_specific: ['ulcerative_colitis', 'crohns', 'ibd'],
    phase_preference_min: 'preclinical',
    phase_preference_max: 'phase_2',
    territory_focus: ['global'],
    deals_last_12mo: 1,
    deals_last_24mo: 3,
    active_trials_count: 4,
    avg_upfront_usd: null,
    median_upfront_usd: null,
    actively_acquiring: false,
    acquisition_appetite: 'selective',
    strategic_priorities: ['integrin_inhibitor', 'oral_integrin_gi', 'ibd', 'alpha4beta7'],
    data_quality_score: 62,
    patent_cliffs: [],
  },
  {
    name: 'Ardelyx',
    name_variations: ['Ardelyx Inc.', 'Ardelyx Inc'],
    ticker: 'ARDX',
    company_type: 'mid_biotech',
    hq_country: 'US',
    modalities_active: ['small_molecule'],
    modalities_primary: ['small_molecule'],
    indications_active: ['gi', 'nephrology'],
    indications_specific: ['ibs_c', 'hyperphosphatemia', 'chronic_kidney_disease_gi'],
    phase_preference_min: 'phase_2',
    phase_preference_max: 'approved',
    territory_focus: ['us', 'global'],
    deals_last_12mo: 2,
    deals_last_24mo: 3,
    active_trials_count: 5,
    avg_upfront_usd: null,
    median_upfront_usd: null,
    actively_acquiring: false,
    acquisition_appetite: 'selective',
    strategic_priorities: ['gi_ion_transport', 'ibs', 'hyperphosphatemia', 'renal_gi'],
    data_quality_score: 65,
    patent_cliffs: [
      { drug_name: 'Ibsrela (tenapanor)', indication: 'GI (IBS-C)', revenue_usd: 200000000, expiry_year: 2034 },
      { drug_name: 'Xphozah (tenapanor)', indication: 'GI/Nephrology (Hyperphosphatemia)', revenue_usd: 150000000, expiry_year: 2034 },
    ],
  },
  // Iterative Health removed — diagnostics/software company, not a drug developer
  {
    name: 'Assembly Biosciences',
    name_variations: ['Assembly Bio', 'Assembly Biosciences Inc.'],
    ticker: 'ASMB',
    company_type: 'mid_biotech',
    hq_country: 'US',
    modalities_active: ['small_molecule', 'microbiome'],
    modalities_primary: ['small_molecule'],
    indications_active: ['gi', 'hepatology'],
    indications_specific: ['hepatitis_b', 'c_diff', 'ibd', 'microbiome_gi'],
    phase_preference_min: 'preclinical',
    phase_preference_max: 'phase_2',
    territory_focus: ['us', 'global'],
    deals_last_12mo: 1,
    deals_last_24mo: 2,
    active_trials_count: 5,
    avg_upfront_usd: null,
    median_upfront_usd: null,
    actively_acquiring: false,
    acquisition_appetite: 'selective',
    strategic_priorities: ['hbv_cure', 'microbiome_therapeutics', 'oral_antiviral', 'gi_infections'],
    data_quality_score: 58,
    patent_cliffs: [],
  },
  {
    name: 'Seres Therapeutics',
    name_variations: ['Seres', 'Seres Therapeutics Inc.'],
    ticker: 'MCRB',
    company_type: 'mid_biotech',
    hq_country: 'US',
    modalities_active: ['microbiome', 'live_biotherapeutic'],
    modalities_primary: ['microbiome'],
    indications_active: ['gi', 'oncology'],
    indications_specific: ['c_diff', 'ulcerative_colitis', 'ibd', 'microbiome_modulation'],
    phase_preference_min: 'preclinical',
    phase_preference_max: 'approved',
    territory_focus: ['us', 'global'],
    deals_last_12mo: 1,
    deals_last_24mo: 3,
    active_trials_count: 5,
    avg_upfront_usd: null,
    median_upfront_usd: null,
    actively_acquiring: false,
    acquisition_appetite: 'selective',
    strategic_priorities: ['microbiome_therapeutics', 'c_diff', 'ibd_microbiome', 'live_biotherapeutic'],
    data_quality_score: 58,
    patent_cliffs: [
      { drug_name: 'Vowst (fecal microbiota spores)', indication: 'GI (C. diff Prevention)', revenue_usd: 100000000, expiry_year: 2036 },
    ],
  },
  {
    name: 'Salix (Bausch)',
    name_variations: ['Salix Pharmaceuticals', 'Salix', 'Bausch Health GI'],
    ticker: 'BHC',
    company_type: 'mid_pharma',
    hq_country: 'US',
    modalities_active: ['small_molecule', 'antibiotic'],
    modalities_primary: ['small_molecule'],
    indications_active: ['gi'],
    indications_specific: ['ibs_d', 'hepatic_encephalopathy', 'travelers_diarrhea', 'opioid_induced_constipation'],
    phase_preference_min: 'phase_2',
    phase_preference_max: 'approved',
    territory_focus: ['us', 'global'],
    deals_last_12mo: 2,
    deals_last_24mo: 4,
    active_trials_count: 8,
    avg_upfront_usd: 200000000,
    median_upfront_usd: 100000000,
    actively_acquiring: true,
    acquisition_appetite: 'moderate',
    strategic_priorities: ['ibs', 'hepatic_encephalopathy', 'gi_specialty', 'gi_motility'],
    data_quality_score: 70,
    patent_cliffs: [
      { drug_name: 'Xifaxan (rifaximin)', indication: 'GI (IBS-D/Hepatic Encephalopathy)', revenue_usd: 1800000000, expiry_year: 2028 },
      { drug_name: 'Relistor (methylnaltrexone)', indication: 'GI (OIC)', revenue_usd: 300000000, expiry_year: 2027 },
    ],
  },
  {
    name: 'Ferring Pharmaceuticals',
    name_variations: ['Ferring', 'Ferring Pharma'],
    ticker: null,
    company_type: 'mid_pharma',
    hq_country: 'Switzerland',
    modalities_active: ['peptide', 'microbiome', 'small_molecule'],
    modalities_primary: ['peptide', 'microbiome'],
    indications_active: ['gi', 'urology', 'reproductive_health'],
    indications_specific: ['c_diff', 'ibd', 'short_bowel_syndrome', 'gi_motility'],
    phase_preference_min: 'phase_1',
    phase_preference_max: 'approved',
    territory_focus: ['global'],
    deals_last_12mo: 2,
    deals_last_24mo: 5,
    active_trials_count: 10,
    avg_upfront_usd: 150000000,
    median_upfront_usd: 80000000,
    actively_acquiring: true,
    acquisition_appetite: 'moderate',
    strategic_priorities: ['microbiome_gi', 'c_diff', 'gi_peptides', 'gastroenterology_specialty'],
    data_quality_score: 68,
    patent_cliffs: [
      { drug_name: 'Rebyota (fecal microbiota)', indication: 'GI (C. diff Recurrence)', revenue_usd: 200000000, expiry_year: 2035 },
    ],
  },
  {
    name: 'Cosmo Pharmaceuticals',
    name_variations: ['Cosmo', 'Cosmo Pharma', 'Cassiopea'],
    ticker: 'COPN.SW',
    company_type: 'specialty',
    hq_country: 'Ireland',
    modalities_active: ['small_molecule', 'topical', 'device'],
    modalities_primary: ['small_molecule'],
    indications_active: ['gi', 'dermatology'],
    indications_specific: ['ulcerative_colitis', 'ulcerative_proctitis', 'colonoscopy', 'gi_mucosal'],
    phase_preference_min: 'phase_2',
    phase_preference_max: 'approved',
    territory_focus: ['global', 'europe', 'us'],
    deals_last_12mo: 1,
    deals_last_24mo: 3,
    active_trials_count: 5,
    avg_upfront_usd: null,
    median_upfront_usd: null,
    actively_acquiring: false,
    acquisition_appetite: 'selective',
    strategic_priorities: ['gi_drug_delivery', 'colonic_release', 'ulcerative_colitis', 'gi_devices'],
    data_quality_score: 55,
    // Winlevi removed — attributed to Sun Pharma in dermatology script (double attribution)
    patent_cliffs: [
      { drug_name: 'GI Genius (AI colonoscopy)', indication: 'GI (AI-assisted colonoscopy)', revenue_usd: 50000000, expiry_year: 2035 },
    ],
  },
  {
    // Arena was acquired by Pfizer in 2022 — use Pfizer name to match other scripts.
    // Etrasimod (Velsipity) is now a Pfizer asset.
    name: 'Pfizer',
    name_variations: ['Pfizer Inc.', 'Pfizer Inc', 'Arena Pharmaceuticals'],
    ticker: 'PFE',
    company_type: 'large_pharma',
    hq_country: 'US',
    modalities_active: ['small_molecule'],
    modalities_primary: ['small_molecule'],
    indications_active: ['gi', 'autoimmune', 'dermatology'],
    indications_specific: ['ulcerative_colitis', 'crohns', 'eosinophilic_esophagitis'],
    phase_preference_min: 'phase_2',
    phase_preference_max: 'approved',
    territory_focus: ['global'],
    deals_last_12mo: 2,
    deals_last_24mo: 4,
    active_trials_count: 8,
    avg_upfront_usd: null,
    median_upfront_usd: null,
    actively_acquiring: false,
    acquisition_appetite: 'selective',
    strategic_priorities: ['s1p_receptor_gi', 'etrasimod', 'ulcerative_colitis', 'oral_gi_therapy'],
    data_quality_score: 75,
    patent_cliffs: [
      { drug_name: 'Velsipity (etrasimod)', indication: 'GI (Ulcerative Colitis S1P)', revenue_usd: 300000000, expiry_year: 2036 },
    ],
  },

  // ─────────────────────────────────────────────────────────────────
  // LARGE PHARMA WITH EXPANDING GI PIPELINES
  // ─────────────────────────────────────────────────────────────────
  {
    name: 'Roche / Genentech',
    name_variations: ['Roche', 'Genentech', 'Roche Holdings', 'F. Hoffmann-La Roche'],
    ticker: 'ROG.SW',
    company_type: 'large_pharma',
    hq_country: 'Switzerland',
    modalities_active: ['antibody', 'bispecific', 'small_molecule', 'adc'],
    modalities_primary: ['antibody', 'bispecific'],
    indications_active: ['gi', 'oncology', 'immunology', 'neurology'],
    indications_specific: ['colorectal_cancer', 'gastric_cancer', 'ibd', 'hepatocellular_carcinoma'],
    phase_preference_min: 'phase_1',
    phase_preference_max: 'approved',
    territory_focus: ['global'],
    deals_last_12mo: 7,
    deals_last_24mo: 14,
    active_trials_count: 28,
    avg_upfront_usd: 3000000000,
    median_upfront_usd: 1800000000,
    actively_acquiring: true,
    acquisition_appetite: 'aggressive',
    strategic_priorities: ['gi_oncology', 'colorectal_cancer_io', 'ibd_next_gen', 'bispecific_gi', 'hcc'],
    data_quality_score: 90,
    patent_cliffs: [
      { drug_name: 'Avastin (bevacizumab)', indication: 'GI-Oncology (CRC)', revenue_usd: 2200000000, expiry_year: 2025 },
      { drug_name: 'Tecentriq (atezolizumab)', indication: 'GI-Oncology (HCC)', revenue_usd: 3800000000, expiry_year: 2033 },
    ],
  },
  {
    name: 'Eli Lilly',
    name_variations: ['Lilly', 'Eli Lilly and Company', 'Eli Lilly & Co'],
    ticker: 'LLY',
    company_type: 'large_pharma',
    hq_country: 'US',
    modalities_active: ['small_molecule', 'antibody', 'peptide'],
    modalities_primary: ['small_molecule', 'antibody'],
    indications_active: ['gi', 'autoimmune', 'metabolic', 'dermatology'],
    indications_specific: ['ulcerative_colitis', 'crohns', 'ibd', 'eosinophilic_esophagitis'],
    phase_preference_min: 'phase_1',
    phase_preference_max: 'approved',
    territory_focus: ['global'],
    deals_last_12mo: 5,
    deals_last_24mo: 10,
    active_trials_count: 18,
    avg_upfront_usd: 3200000000,
    median_upfront_usd: 1500000000,
    actively_acquiring: true,
    acquisition_appetite: 'aggressive',
    strategic_priorities: ['integrin_inhibitor_gi', 'oral_integrin_ibd', 'tl1a_gi', 'gi_inflammation'],
    data_quality_score: 88,
    patent_cliffs: [
      { drug_name: 'MORF-057 (oral integrin)', indication: 'GI (UC/Crohns integrin)', revenue_usd: 1500000000, expiry_year: 2039 },
    ],
  },
  {
    name: 'Novartis',
    name_variations: ['Novartis AG', 'Novartis Pharma', 'Novartis Pharmaceuticals'],
    ticker: 'NVS',
    company_type: 'large_pharma',
    hq_country: 'Switzerland',
    modalities_active: ['antibody', 'small_molecule', 'gene_therapy', 'rna'],
    modalities_primary: ['antibody', 'small_molecule'],
    indications_active: ['gi', 'immunology', 'oncology', 'cardiovascular'],
    indications_specific: ['crohns', 'ulcerative_colitis', 'ibd', 'eosinophilic_esophagitis'],
    phase_preference_min: 'phase_1',
    phase_preference_max: 'approved',
    territory_focus: ['global'],
    deals_last_12mo: 6,
    deals_last_24mo: 11,
    active_trials_count: 15,
    avg_upfront_usd: 2800000000,
    median_upfront_usd: 1200000000,
    actively_acquiring: true,
    acquisition_appetite: 'moderate',
    strategic_priorities: ['il-13_gi', 'ibd', 'gi_inflammation', 'eosinophilic_gi'],
    data_quality_score: 85,
    patent_cliffs: [
      { drug_name: 'Cosentyx (secukinumab)', indication: 'Immunology (expanding GI)', revenue_usd: 5000000000, expiry_year: 2030 },
    ],
  },
  {
    name: 'GSK',
    name_variations: ['GlaxoSmithKline', 'GSK plc', 'GlaxoSmithKline plc'],
    ticker: 'GSK',
    company_type: 'large_pharma',
    hq_country: 'UK',
    modalities_active: ['antibody', 'small_molecule', 'vaccine'],
    modalities_primary: ['antibody', 'small_molecule'],
    indications_active: ['gi', 'immunology', 'infectious_disease', 'oncology'],
    indications_specific: ['ulcerative_colitis', 'crohns', 'celiac_disease', 'eosinophilic_esophagitis'],
    phase_preference_min: 'phase_1',
    phase_preference_max: 'approved',
    territory_focus: ['global'],
    deals_last_12mo: 4,
    deals_last_24mo: 8,
    active_trials_count: 12,
    avg_upfront_usd: 1500000000,
    median_upfront_usd: 800000000,
    actively_acquiring: true,
    acquisition_appetite: 'moderate',
    strategic_priorities: ['gi_inflammation', 'il_blockade_gi', 'celiac_disease', 'ibd'],
    data_quality_score: 82,
    patent_cliffs: [
      { drug_name: 'Nucala (mepolizumab)', indication: 'Immunology (eosinophilic GI exploration)', revenue_usd: 2200000000, expiry_year: 2031 },
    ],
  },

  // ─────────────────────────────────────────────────────────────────
  // MID-CAP GI SPECIALISTS
  // ─────────────────────────────────────────────────────────────────
  {
    name: 'Theravance Biopharma',
    name_variations: ['Theravance', 'Theravance Bio', 'Theravance Biopharma Inc.'],
    ticker: 'TBPH',
    company_type: 'mid_biotech',
    hq_country: 'US',
    modalities_active: ['small_molecule'],
    modalities_primary: ['small_molecule'],
    indications_active: ['gi', 'pulmonology'],
    indications_specific: ['gi_motility', 'gastroparesis', 'ibs', 'functional_gi'],
    phase_preference_min: 'preclinical',
    phase_preference_max: 'phase_3',
    territory_focus: ['us', 'global'],
    deals_last_12mo: 1,
    deals_last_24mo: 3,
    active_trials_count: 4,
    avg_upfront_usd: 100000000,
    median_upfront_usd: 50000000,
    actively_acquiring: false,
    acquisition_appetite: 'selective',
    strategic_priorities: ['gi_motility', 'gastroparesis', 'enteric_nervous_system', 'functional_gi'],
    data_quality_score: 60,
    patent_cliffs: [],
  },
  {
    name: 'Ventyx Biosciences (Eli Lilly)',
    name_variations: ['Ventyx', 'Ventyx Bio', 'Ventyx Biosciences Inc.', 'Lilly Ventyx'],
    ticker: 'LLY',
    company_type: 'large_pharma',
    hq_country: 'US',
    modalities_active: ['small_molecule', 'antibody'],
    modalities_primary: ['small_molecule'],
    indications_active: ['gi', 'autoimmune', 'dermatology'],
    indications_specific: ['ulcerative_colitis', 'crohns', 'ibd'],
    phase_preference_min: 'phase_1',
    phase_preference_max: 'phase_3',
    territory_focus: ['global'],
    deals_last_12mo: 2,
    deals_last_24mo: 3,
    active_trials_count: 6,
    avg_upfront_usd: null,
    median_upfront_usd: null,
    actively_acquiring: false,
    acquisition_appetite: 'selective',
    strategic_priorities: ['tl1a_antibody_gi', 'allosteric_tyk2_gi', 'ibd', 'oral_gi_immunology'],
    data_quality_score: 72,
    patent_cliffs: [
      { drug_name: 'VTX958 (anti-TL1A)', indication: 'GI (UC/Crohns TL1A)', revenue_usd: 1500000000, expiry_year: 2039 },
    ],
  },
  {
    name: 'Vir Biotechnology',
    name_variations: ['Vir Bio', 'Vir Biotechnology Inc.'],
    ticker: 'VIR',
    company_type: 'mid_biotech',
    hq_country: 'US',
    modalities_active: ['antibody', 'small_molecule', 'sirna'],
    modalities_primary: ['antibody'],
    indications_active: ['gi', 'hepatology', 'infectious_disease'],
    indications_specific: ['hepatitis_b', 'hbv', 'liver_gi', 'hdv'],
    phase_preference_min: 'preclinical',
    phase_preference_max: 'phase_3',
    territory_focus: ['global'],
    deals_last_12mo: 2,
    deals_last_24mo: 5,
    active_trials_count: 8,
    avg_upfront_usd: 200000000,
    median_upfront_usd: 100000000,
    actively_acquiring: false,
    acquisition_appetite: 'selective',
    strategic_priorities: ['hbv_functional_cure', 'sirna_liver', 'hepatology', 'chronic_hbv'],
    data_quality_score: 65,
    patent_cliffs: [],
  },
  {
    name: 'Pliant Therapeutics',
    name_variations: ['Pliant', 'Pliant Therapeutics Inc.'],
    ticker: 'PLRX',
    company_type: 'mid_biotech',
    hq_country: 'US',
    modalities_active: ['small_molecule', 'antibody'],
    modalities_primary: ['small_molecule'],
    indications_active: ['gi', 'hepatology', 'pulmonology'],
    indications_specific: ['primary_sclerosing_cholangitis', 'nash', 'liver_fibrosis', 'ibd_fibrosis'],
    phase_preference_min: 'preclinical',
    phase_preference_max: 'phase_2',
    territory_focus: ['us', 'global'],
    deals_last_12mo: 1,
    deals_last_24mo: 2,
    active_trials_count: 5,
    avg_upfront_usd: null,
    median_upfront_usd: null,
    actively_acquiring: false,
    acquisition_appetite: 'selective',
    strategic_priorities: ['integrin_fibrosis', 'psc', 'liver_fibrosis', 'gi_fibrosis'],
    data_quality_score: 58,
    patent_cliffs: [],
  },
  {
    name: 'CymaBay Therapeutics',
    name_variations: ['CymaBay', 'CymaBay Therapeutics Inc.', 'Gilead CymaBay'],
    ticker: 'GILD',
    company_type: 'large_pharma',
    hq_country: 'US',
    modalities_active: ['small_molecule'],
    modalities_primary: ['small_molecule'],
    indications_active: ['gi', 'hepatology'],
    indications_specific: ['primary_biliary_cholangitis', 'primary_sclerosing_cholangitis', 'pbc', 'psc'],
    phase_preference_min: 'phase_2',
    phase_preference_max: 'approved',
    territory_focus: ['global'],
    deals_last_12mo: 1,
    deals_last_24mo: 2,
    active_trials_count: 4,
    avg_upfront_usd: null,
    median_upfront_usd: null,
    actively_acquiring: false,
    acquisition_appetite: 'selective',
    strategic_priorities: ['ppar_agonist_liver', 'pbc', 'psc', 'cholestatic_liver_disease'],
    data_quality_score: 65,
    patent_cliffs: [
      { drug_name: 'Seladelpar', indication: 'GI/Hepatology (PBC)', revenue_usd: 800000000, expiry_year: 2037 },
    ],
  },
  {
    name: 'Intercept Pharmaceuticals',
    name_variations: ['Intercept', 'Intercept Pharma', 'Intercept Pharmaceuticals Inc.'],
    ticker: 'ICPT',
    company_type: 'mid_biotech',
    hq_country: 'US',
    modalities_active: ['small_molecule'],
    modalities_primary: ['small_molecule'],
    indications_active: ['gi', 'hepatology'],
    indications_specific: ['primary_biliary_cholangitis', 'nash', 'liver_fibrosis', 'nonalcoholic_steatohepatitis'],
    phase_preference_min: 'phase_2',
    phase_preference_max: 'approved',
    territory_focus: ['us', 'europe', 'global'],
    deals_last_12mo: 1,
    deals_last_24mo: 2,
    active_trials_count: 5,
    avg_upfront_usd: null,
    median_upfront_usd: null,
    actively_acquiring: false,
    acquisition_appetite: 'selective',
    strategic_priorities: ['fxr_agonist', 'pbc', 'nash_liver', 'liver_fibrosis'],
    data_quality_score: 62,
    patent_cliffs: [
      { drug_name: 'Ocaliva (obeticholic acid)', indication: 'GI/Hepatology (PBC)', revenue_usd: 350000000, expiry_year: 2030 },
    ],
  },

  // ─────────────────────────────────────────────────────────────────
  // ASIAN / EUROPEAN PHARMA ACTIVE IN GI
  // ─────────────────────────────────────────────────────────────────
  {
    name: 'Astellas Pharma',
    name_variations: ['Astellas', 'Astellas Pharma Inc.'],
    ticker: '4503.T',
    company_type: 'large_pharma',
    hq_country: 'Japan',
    modalities_active: ['small_molecule', 'antibody', 'gene_therapy'],
    modalities_primary: ['small_molecule'],
    indications_active: ['gi', 'urology', 'oncology', 'transplant'],
    indications_specific: ['functional_dyspepsia', 'gi_motility', 'gerd', 'ibs'],
    phase_preference_min: 'phase_1',
    phase_preference_max: 'approved',
    territory_focus: ['global', 'japan', 'asia'],
    deals_last_12mo: 3,
    deals_last_24mo: 6,
    active_trials_count: 10,
    avg_upfront_usd: 400000000,
    median_upfront_usd: 200000000,
    actively_acquiring: true,
    acquisition_appetite: 'moderate',
    strategic_priorities: ['gi_motility', 'functional_dyspepsia', 'proton_pump', 'gi_specialty_japan'],
    data_quality_score: 75,
    patent_cliffs: [
      { drug_name: 'Prograf (tacrolimus)', indication: 'Transplant (GI-adjacent)', revenue_usd: 2200000000, expiry_year: 2025 },
    ],
  },
  {
    name: 'Eisai',
    name_variations: ['Eisai Co.', 'Eisai Co Ltd', 'Eisai Inc.'],
    ticker: '4523.T',
    company_type: 'large_pharma',
    hq_country: 'Japan',
    modalities_active: ['small_molecule', 'antibody'],
    modalities_primary: ['small_molecule'],
    indications_active: ['gi', 'oncology', 'neurology'],
    indications_specific: ['gerd', 'acid_related_disorders', 'gi_oncology', 'gastric_cancer'],
    phase_preference_min: 'phase_1',
    phase_preference_max: 'approved',
    territory_focus: ['global', 'japan', 'asia'],
    deals_last_12mo: 2,
    deals_last_24mo: 5,
    active_trials_count: 8,
    avg_upfront_usd: 300000000,
    median_upfront_usd: 150000000,
    actively_acquiring: true,
    acquisition_appetite: 'moderate',
    strategic_priorities: ['gi_oncology', 'acid_suppression', 'proton_pump', 'gastric_cancer'],
    data_quality_score: 72,
    patent_cliffs: [
      { drug_name: 'Aciphex/Pariet (rabeprazole)', indication: 'GI (GERD/Acid)', revenue_usd: 500000000, expiry_year: 2025 },
      { drug_name: 'Lenvima (lenvatinib)', indication: 'Oncology (HCC/GI-Onc)', revenue_usd: 4500000000, expiry_year: 2032 },
    ],
  },
  {
    name: 'Alfasigma',
    name_variations: ['Alfasigma S.p.A.', 'Alfa Wassermann'],
    ticker: null,
    company_type: 'mid_pharma',
    hq_country: 'Italy',
    modalities_active: ['small_molecule', 'probiotic'],
    modalities_primary: ['small_molecule'],
    indications_active: ['gi'],
    indications_specific: ['ibs', 'functional_dyspepsia', 'gerd', 'chronic_constipation', 'gi_motility'],
    phase_preference_min: 'phase_2',
    phase_preference_max: 'approved',
    territory_focus: ['europe', 'global'],
    deals_last_12mo: 2,
    deals_last_24mo: 4,
    active_trials_count: 6,
    avg_upfront_usd: 50000000,
    median_upfront_usd: 25000000,
    actively_acquiring: true,
    acquisition_appetite: 'moderate',
    strategic_priorities: ['gi_specialty_europe', 'ibs', 'functional_gi', 'rifaximin_eu', 'gi_motility'],
    data_quality_score: 55,
    patent_cliffs: [
      { drug_name: 'Normix/Zaxine (rifaximin EU)', indication: 'GI (IBS/Hepatic Encephalopathy EU)', revenue_usd: 600000000, expiry_year: 2029 },
    ],
  },
  {
    name: 'Dr. Falk Pharma',
    name_variations: ['Falk Pharma', 'Dr Falk', 'Dr. Falk Pharma GmbH'],
    ticker: null,
    company_type: 'specialty',
    hq_country: 'Germany',
    modalities_active: ['small_molecule', 'topical'],
    modalities_primary: ['small_molecule'],
    indications_active: ['gi', 'hepatology'],
    indications_specific: ['ulcerative_colitis', 'crohns', 'pbc', 'autoimmune_hepatitis', 'ibd'],
    phase_preference_min: 'phase_2',
    phase_preference_max: 'approved',
    territory_focus: ['europe', 'global'],
    deals_last_12mo: 2,
    deals_last_24mo: 4,
    active_trials_count: 8,
    avg_upfront_usd: null,
    median_upfront_usd: null,
    actively_acquiring: true,
    acquisition_appetite: 'moderate',
    strategic_priorities: ['ibd_europe', 'mesalazine', 'budesonide_gi', 'pbc', 'autoimmune_hepatitis'],
    data_quality_score: 60,
    patent_cliffs: [
      { drug_name: 'Salofalk (mesalazine)', indication: 'GI (UC/IBD Europe)', revenue_usd: 400000000, expiry_year: 2026 },
      { drug_name: 'Budenofalk (budesonide)', indication: 'GI (Crohns/Colitis Europe)', revenue_usd: 300000000, expiry_year: 2026 },
    ],
  },
  {
    name: 'EA Pharma',
    name_variations: ['EA Pharma Co.', 'EA Pharma Co Ltd', 'Eisai-Ajinomoto'],
    ticker: null,
    company_type: 'specialty',
    hq_country: 'Japan',
    modalities_active: ['small_molecule', 'peptide'],
    modalities_primary: ['small_molecule'],
    indications_active: ['gi'],
    indications_specific: ['ulcerative_colitis', 'crohns', 'gerd', 'gi_motility', 'functional_dyspepsia'],
    phase_preference_min: 'phase_1',
    phase_preference_max: 'approved',
    territory_focus: ['japan', 'asia'],
    deals_last_12mo: 1,
    deals_last_24mo: 3,
    active_trials_count: 6,
    avg_upfront_usd: null,
    median_upfront_usd: null,
    actively_acquiring: false,
    acquisition_appetite: 'selective',
    strategic_priorities: ['gi_specialty_japan', 'ibd_japan', 'functional_gi', 'acid_related'],
    data_quality_score: 50,
    patent_cliffs: [
      { drug_name: 'Camostat (camostat mesilate)', indication: 'GI (Pancreatitis Japan)', revenue_usd: 100000000, expiry_year: 2026 },
    ],
  },

  // ─────────────────────────────────────────────────────────────────
  // MICROBIOME / SPECIALTY GI
  // ─────────────────────────────────────────────────────────────────
  {
    name: 'Vedanta Biosciences',
    name_variations: ['Vedanta', 'Vedanta Biosciences Inc.'],
    ticker: null,
    company_type: 'mid_biotech',
    hq_country: 'US',
    modalities_active: ['microbiome', 'live_biotherapeutic'],
    modalities_primary: ['microbiome'],
    indications_active: ['gi', 'oncology', 'autoimmune'],
    indications_specific: ['c_diff', 'ibd', 'graft_vs_host', 'microbiome_modulation'],
    phase_preference_min: 'preclinical',
    phase_preference_max: 'phase_2',
    territory_focus: ['us', 'global'],
    deals_last_12mo: 1,
    deals_last_24mo: 2,
    active_trials_count: 3,
    avg_upfront_usd: null,
    median_upfront_usd: null,
    actively_acquiring: false,
    acquisition_appetite: 'inactive',
    strategic_priorities: ['defined_microbiome_consortia', 'c_diff', 'gvhd', 'immuno_oncology_microbiome'],
    data_quality_score: 48,
    patent_cliffs: [],
  },
];

// =============================================================================
// SEED FUNCTION
// =============================================================================

async function seedGastroCompanies() {
  console.log('Starting gastroenterology company seed...\n');
  console.log(`Seeding ${gastroCompanies.length} companies...\n`);

  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const company of gastroCompanies) {
    const companyData = {
      name: company.name,
      name_variations: company.name_variations,
      ticker: company.ticker,
      company_type: company.company_type,
      hq_country: company.hq_country,
      modalities_active: company.modalities_active,
      modalities_primary: company.modalities_primary,
      indications_active: company.indications_active,
      indications_specific: company.indications_specific,
      phase_preference_min: company.phase_preference_min,
      phase_preference_max: company.phase_preference_max,
      territory_focus: company.territory_focus,
      deals_last_12mo: company.deals_last_12mo,
      deals_last_24mo: company.deals_last_24mo,
      active_trials_count: company.active_trials_count,
      avg_upfront_usd: company.avg_upfront_usd,
      median_upfront_usd: company.median_upfront_usd,
      actively_acquiring: company.actively_acquiring,
      acquisition_appetite: company.acquisition_appetite,
      strategic_priorities: company.strategic_priorities,
      data_quality_score: company.data_quality_score,
      patent_cliffs: company.patent_cliffs,
      data_sources: ['sec_filings', 'dealforma', 'company_ir', 'evaluate_pharma'],
      last_enriched_at: new Date().toISOString(),
    };

    const { error: insertError } = await supabase
      .from('companies')
      .insert(companyData);

    if (insertError) {
      if (insertError.code === '23505') {
        const { error: updateError } = await supabase
          .from('companies')
          .update({
            ...companyData,
            updated_at: new Date().toISOString(),
          })
          .eq('name', company.name);

        if (updateError) {
          console.error(`  ✗ ${company.name}: Update failed — ${updateError.message}`);
          errors++;
        } else {
          console.log(`  ↻ ${company.name}: Updated with GI data (${company.company_type})`);
          updated++;
        }
      } else {
        console.error(`  ✗ ${company.name}: Insert failed — ${insertError.message}`);
        errors++;
      }
    } else {
      console.log(`  ✓ ${company.name}: Created (${company.company_type})`);
      created++;
    }
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Created: ${created}`);
  console.log(`Updated: ${updated}`);
  console.log(`Errors:  ${errors}`);
  console.log(`Total:   ${gastroCompanies.length}`);
  console.log(`${'='.repeat(50)}\n`);
}

seedGastroCompanies().catch(console.error);
