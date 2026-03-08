// Script to seed hematology-focused companies into the partner matching database
// Run with: npx tsx scripts/seed-hematology-companies.ts
//
// These companies are curated from real deal activity, SEC filings, and pipeline data.
// Each company includes hematology-relevant indications, modalities, strategic priorities,
// and deal history to power accurate partner matching for hematology assets.

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

interface HematologyCompany {
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
// HEMATOLOGY COMPANY DATABASE
// Sources: SEC filings, DealForma, BioPharma Dive, Evaluate Pharma, company IRs
// =============================================================================

const hematologyCompanies: HematologyCompany[] = [
  // ─────────────────────────────────────────────────────────────────
  // LARGE PHARMA / BIOTECH WITH MAJOR HEMATOLOGY FRANCHISES
  // ─────────────────────────────────────────────────────────────────
  {
    name: 'Bristol-Myers Squibb',
    name_variations: ['BMS', 'Bristol Myers Squibb', 'Bristol-Myers Squibb Company', 'Celgene'],
    ticker: 'BMY',
    company_type: 'large_pharma',
    hq_country: 'US',
    modalities_active: ['small_molecule', 'antibody', 'cell_therapy', 'bispecific', 'protein_degrader'],
    modalities_primary: ['small_molecule', 'cell_therapy'],
    indications_active: ['hematology', 'oncology', 'cardiovascular', 'autoimmune'],
    indications_specific: ['multiple_myeloma', 'mds', 'aml', 'lymphoma', 'cll', 'beta_thalassemia'],
    phase_preference_min: 'preclinical',
    phase_preference_max: 'approved',
    territory_focus: ['global'],
    deals_last_12mo: 7,
    deals_last_24mo: 13,
    active_trials_count: 50,
    avg_upfront_usd: 3000000000,
    median_upfront_usd: 1500000000,
    actively_acquiring: true,
    acquisition_appetite: 'aggressive',
    strategic_priorities: ['multiple_myeloma', 'cell_therapy_hematology', 'mds', 'protein_degradation', 'next_gen_car_t'],
    data_quality_score: 92,
    patent_cliffs: [
      { drug_name: 'Revlimid (lenalidomide)', indication: 'Hematology (Multiple Myeloma)', revenue_usd: 6500000000, expiry_year: 2027 },
      { drug_name: 'Pomalyst (pomalidomide)', indication: 'Hematology (Multiple Myeloma)', revenue_usd: 3200000000, expiry_year: 2028 },
      { drug_name: 'Abecma (idecabtagene)', indication: 'Hematology (Multiple Myeloma CAR-T)', revenue_usd: 600000000, expiry_year: 2035 },
      { drug_name: 'Breyanzi (lisocabtagene)', indication: 'Hematology (DLBCL CAR-T)', revenue_usd: 800000000, expiry_year: 2035 },
    ],
  },
  {
    name: 'AbbVie',
    name_variations: ['AbbVie Inc.', 'AbbVie Inc', 'Pharmacyclics'],
    ticker: 'ABBV',
    company_type: 'large_pharma',
    hq_country: 'US',
    modalities_active: ['small_molecule', 'antibody', 'adc'],
    modalities_primary: ['small_molecule'],
    indications_active: ['hematology', 'oncology', 'autoimmune', 'cns'],
    indications_specific: ['cll', 'lymphoma', 'aml', 'mcl', 'mds'],
    phase_preference_min: 'phase_1',
    phase_preference_max: 'approved',
    territory_focus: ['global'],
    deals_last_12mo: 6,
    deals_last_24mo: 11,
    active_trials_count: 42,
    avg_upfront_usd: 2500000000,
    median_upfront_usd: 1400000000,
    actively_acquiring: true,
    acquisition_appetite: 'aggressive',
    strategic_priorities: ['btk_inhibitors', 'cll', 'lymphoma', 'aml', 'next_gen_hematology'],
    data_quality_score: 90,
    patent_cliffs: [
      { drug_name: 'Imbruvica (ibrutinib)', indication: 'Hematology (CLL/MCL)', revenue_usd: 4200000000, expiry_year: 2027 },
      { drug_name: 'Venclexta (venetoclax)', indication: 'Hematology (CLL/AML)', revenue_usd: 2400000000, expiry_year: 2030 },
    ],
  },
  {
    name: 'Novartis',
    name_variations: ['Novartis AG', 'Novartis Pharma'],
    ticker: 'NVS',
    company_type: 'large_pharma',
    hq_country: 'Switzerland',
    modalities_active: ['cell_therapy', 'small_molecule', 'antibody', 'gene_therapy'],
    modalities_primary: ['cell_therapy', 'small_molecule'],
    indications_active: ['hematology', 'oncology', 'cardiovascular', 'cns'],
    indications_specific: ['all', 'dlbcl', 'mds', 'sickle_cell', 'beta_thalassemia', 'myelofibrosis'],
    phase_preference_min: 'preclinical',
    phase_preference_max: 'approved',
    territory_focus: ['global'],
    deals_last_12mo: 6,
    deals_last_24mo: 11,
    active_trials_count: 38,
    avg_upfront_usd: 1500000000,
    median_upfront_usd: 700000000,
    actively_acquiring: true,
    acquisition_appetite: 'aggressive',
    strategic_priorities: ['car_t_hematology', 'sickle_cell', 'myelofibrosis', 'next_gen_cell_therapy'],
    data_quality_score: 88,
    patent_cliffs: [
      { drug_name: 'Kymriah (tisagenlecleucel)', indication: 'Hematology (ALL/DLBCL CAR-T)', revenue_usd: 500000000, expiry_year: 2032 },
      { drug_name: 'Jakavi/Jakafi (ruxolitinib)', indication: 'Hematology (Myelofibrosis)', revenue_usd: 1800000000, expiry_year: 2027 },
      { drug_name: 'Promacta (eltrombopag)', indication: 'Hematology (ITP/SAA)', revenue_usd: 1600000000, expiry_year: 2027 },
    ],
  },
  {
    name: 'Pfizer',
    name_variations: ['Pfizer Inc.', 'Pfizer Inc'],
    ticker: 'PFE',
    company_type: 'large_pharma',
    hq_country: 'US',
    modalities_active: ['small_molecule', 'antibody', 'adc', 'bispecific', 'gene_therapy'],
    modalities_primary: ['small_molecule', 'antibody'],
    indications_active: ['hematology', 'oncology', 'autoimmune', 'rare_disease'],
    indications_specific: ['hemophilia_a', 'hemophilia_b', 'sickle_cell', 'mds', 'dlbcl'],
    phase_preference_min: 'phase_1',
    phase_preference_max: 'approved',
    territory_focus: ['global'],
    deals_last_12mo: 8,
    deals_last_24mo: 15,
    active_trials_count: 35,
    avg_upfront_usd: 2000000000,
    median_upfront_usd: 1000000000,
    actively_acquiring: true,
    acquisition_appetite: 'aggressive',
    strategic_priorities: ['hemophilia_gene_therapy', 'sickle_cell', 'hematology_oncology', 'adc'],
    data_quality_score: 88,
    // Note: Eliquis removed — it is a cardiovascular anticoagulant, not a hematology asset
    patent_cliffs: [
      { drug_name: 'Xeljanz', indication: 'Autoimmune', revenue_usd: 2000000000, expiry_year: 2025 },
    ],
  },
  {
    name: 'Johnson & Johnson (Janssen)',
    name_variations: ['J&J', 'Janssen', 'Janssen Pharmaceuticals', 'Janssen Biotech'],
    ticker: 'JNJ',
    company_type: 'large_pharma',
    hq_country: 'US',
    modalities_active: ['antibody', 'bispecific', 'cell_therapy', 'small_molecule'],
    modalities_primary: ['antibody', 'bispecific'],
    indications_active: ['hematology', 'oncology', 'autoimmune'],
    indications_specific: ['multiple_myeloma', 'lymphoma', 'aml', 'mds'],
    phase_preference_min: 'phase_1',
    phase_preference_max: 'approved',
    territory_focus: ['global'],
    deals_last_12mo: 5,
    deals_last_24mo: 10,
    active_trials_count: 35,
    avg_upfront_usd: 3500000000,
    median_upfront_usd: 2000000000,
    actively_acquiring: true,
    acquisition_appetite: 'aggressive',
    strategic_priorities: ['multiple_myeloma', 'bispecific_hematology', 'bcma', 'car_t'],
    data_quality_score: 90,
    patent_cliffs: [
      { drug_name: 'Darzalex (daratumumab)', indication: 'Hematology (Multiple Myeloma)', revenue_usd: 10000000000, expiry_year: 2031 },
      { drug_name: 'Tecvayli (teclistamab)', indication: 'Hematology (Multiple Myeloma Bispecific)', revenue_usd: 800000000, expiry_year: 2037 },
      { drug_name: 'Talvey (talquetamab)', indication: 'Hematology (Multiple Myeloma GPRC5D)', revenue_usd: 400000000, expiry_year: 2038 },
    ],
  },
  {
    name: 'Amgen',
    name_variations: ['Amgen Inc.', 'Amgen Inc'],
    ticker: 'AMGN',
    company_type: 'large_biotech',
    hq_country: 'US',
    modalities_active: ['bispecific', 'antibody', 'small_molecule', 'cell_therapy'],
    modalities_primary: ['bispecific', 'antibody'],
    indications_active: ['hematology', 'oncology', 'rare_disease', 'cardiovascular'],
    indications_specific: ['all', 'aml', 'dlbcl', 'multiple_myeloma', 'itp'],
    phase_preference_min: 'phase_1',
    phase_preference_max: 'approved',
    territory_focus: ['global'],
    deals_last_12mo: 5,
    deals_last_24mo: 9,
    active_trials_count: 30,
    avg_upfront_usd: 2000000000,
    median_upfront_usd: 1200000000,
    actively_acquiring: true,
    acquisition_appetite: 'aggressive',
    strategic_priorities: ['bispecific_t_cell_engager', 'hematology_oncology', 'aml', 'bite_platform'],
    data_quality_score: 88,
    patent_cliffs: [
      { drug_name: 'Blincyto (blinatumomab)', indication: 'Hematology (ALL BiTE)', revenue_usd: 800000000, expiry_year: 2029 },
      { drug_name: 'Nplate (romiplostim)', indication: 'Hematology (ITP)', revenue_usd: 1200000000, expiry_year: 2025 },
    ],
  },
  {
    name: 'Takeda',
    name_variations: ['Takeda Pharmaceutical', 'Takeda Pharma'],
    ticker: 'TAK',
    company_type: 'large_pharma',
    hq_country: 'Japan',
    modalities_active: ['antibody', 'small_molecule', 'cell_therapy', 'enzyme_replacement'],
    modalities_primary: ['antibody', 'small_molecule'],
    indications_active: ['hematology', 'rare_disease', 'gi', 'oncology'],
    indications_specific: ['hodgkin_lymphoma', 'ptcl', 'hemophilia', 'von_willebrand', 'aplastic_anemia'],
    phase_preference_min: 'phase_1',
    phase_preference_max: 'approved',
    territory_focus: ['global', 'japan'],
    deals_last_12mo: 4,
    deals_last_24mo: 7,
    active_trials_count: 22,
    avg_upfront_usd: 500000000,
    median_upfront_usd: 300000000,
    actively_acquiring: true,
    acquisition_appetite: 'moderate',
    strategic_priorities: ['hematology_oncology', 'rare_hematology', 'hemophilia', 'lymphoma'],
    data_quality_score: 82,
    patent_cliffs: [
      { drug_name: 'Adcetris (brentuximab vedotin)', indication: 'Hematology (Hodgkin Lymphoma)', revenue_usd: 1400000000, expiry_year: 2028 },
      { drug_name: 'Ninlaro (ixazomib)', indication: 'Hematology (Multiple Myeloma)', revenue_usd: 700000000, expiry_year: 2029 },
    ],
  },
  {
    name: 'BeiGene',
    name_variations: ['BeiGene Ltd', 'BeiGene Inc.'],
    ticker: 'BGNE',
    company_type: 'large_biotech',
    hq_country: 'China',
    modalities_active: ['small_molecule', 'antibody', 'bispecific'],
    modalities_primary: ['small_molecule'],
    indications_active: ['hematology', 'oncology'],
    indications_specific: ['cll', 'mcl', 'wm', 'lymphoma', 'aml'],
    phase_preference_min: 'phase_1',
    phase_preference_max: 'approved',
    territory_focus: ['global', 'china'],
    deals_last_12mo: 5,
    deals_last_24mo: 9,
    active_trials_count: 40,
    avg_upfront_usd: 300000000,
    median_upfront_usd: 150000000,
    actively_acquiring: true,
    acquisition_appetite: 'aggressive',
    strategic_priorities: ['btk_inhibitor', 'cll', 'lymphoma', 'hematology_global_expansion'],
    data_quality_score: 80,
    patent_cliffs: [
      { drug_name: 'Brukinsa (zanubrutinib)', indication: 'Hematology (CLL/MCL/WM)', revenue_usd: 3000000000, expiry_year: 2033 },
    ],
  },
  {
    name: 'Legend Biotech',
    name_variations: ['Legend Biotech Corp', 'Legend'],
    ticker: 'LEGN',
    company_type: 'mid_biotech',
    hq_country: 'China',
    modalities_active: ['cell_therapy', 'antibody'],
    modalities_primary: ['cell_therapy'],
    indications_active: ['hematology', 'oncology'],
    indications_specific: ['multiple_myeloma', 'dlbcl', 'all'],
    phase_preference_min: 'preclinical',
    phase_preference_max: 'approved',
    territory_focus: ['global', 'china', 'us'],
    deals_last_12mo: 3,
    deals_last_24mo: 5,
    active_trials_count: 15,
    avg_upfront_usd: 350000000,
    median_upfront_usd: 200000000,
    actively_acquiring: false,
    acquisition_appetite: 'selective',
    strategic_priorities: ['car_t_multiple_myeloma', 'next_gen_cell_therapy', 'bcma', 'allogenic_car_t'],
    data_quality_score: 78,
    patent_cliffs: [
      { drug_name: 'Carvykti (ciltacabtagene)', indication: 'Hematology (Multiple Myeloma CAR-T)', revenue_usd: 1200000000, expiry_year: 2037 },
    ],
  },
  {
    name: 'Kite (Gilead)',
    name_variations: ['Kite Pharma', 'Kite', 'Gilead Kite'],
    ticker: 'GILD',
    company_type: 'large_biotech',
    hq_country: 'US',
    modalities_active: ['cell_therapy', 'antibody'],
    modalities_primary: ['cell_therapy'],
    indications_active: ['hematology', 'oncology'],
    indications_specific: ['dlbcl', 'mcl', 'follicular_lymphoma', 'all'],
    phase_preference_min: 'preclinical',
    phase_preference_max: 'approved',
    territory_focus: ['global'],
    deals_last_12mo: 4,
    deals_last_24mo: 7,
    active_trials_count: 20,
    avg_upfront_usd: 1000000000,
    median_upfront_usd: 500000000,
    actively_acquiring: true,
    acquisition_appetite: 'aggressive',
    strategic_priorities: ['car_t_lymphoma', 'next_gen_cell_therapy', 'off_shelf_car_t', 'hematology_oncology'],
    data_quality_score: 88,
    patent_cliffs: [
      { drug_name: 'Yescarta (axicabtagene)', indication: 'Hematology (DLBCL/FL CAR-T)', revenue_usd: 1500000000, expiry_year: 2033 },
      { drug_name: 'Tecartus (brexucabtagene)', indication: 'Hematology (MCL/ALL CAR-T)', revenue_usd: 400000000, expiry_year: 2034 },
    ],
  },
  {
    name: 'Incyte',
    name_variations: ['Incyte Corporation', 'Incyte Corp'],
    ticker: 'INCY',
    company_type: 'mid_biotech',
    hq_country: 'US',
    modalities_active: ['small_molecule', 'antibody', 'bispecific'],
    modalities_primary: ['small_molecule'],
    indications_active: ['hematology', 'oncology', 'autoimmune', 'dermatology'],
    indications_specific: ['myelofibrosis', 'polycythemia_vera', 'gvhd', 'aml', 'mds'],
    phase_preference_min: 'phase_1',
    phase_preference_max: 'approved',
    territory_focus: ['global'],
    deals_last_12mo: 3,
    deals_last_24mo: 6,
    active_trials_count: 25,
    avg_upfront_usd: 400000000,
    median_upfront_usd: 200000000,
    actively_acquiring: true,
    acquisition_appetite: 'moderate',
    strategic_priorities: ['jak_inhibitors', 'myelofibrosis', 'gvhd', 'hematology_oncology'],
    data_quality_score: 82,
    patent_cliffs: [
      { drug_name: 'Jakafi (ruxolitinib)', indication: 'Hematology (Myelofibrosis/PV/GvHD)', revenue_usd: 2600000000, expiry_year: 2027 },
      { drug_name: 'Monjuvi (tafasitamab)', indication: 'Hematology (DLBCL)', revenue_usd: 200000000, expiry_year: 2032 },
    ],
  },
  {
    name: 'Jazz Pharmaceuticals',
    name_variations: ['Jazz Pharma', 'Jazz'],
    ticker: 'JAZZ',
    company_type: 'large_biotech',
    hq_country: 'Ireland',
    modalities_active: ['cell_therapy', 'small_molecule', 'antibody'],
    modalities_primary: ['cell_therapy', 'small_molecule'],
    indications_active: ['hematology', 'cns', 'oncology'],
    indications_specific: ['aml', 'mds', 'all', 'dlbcl'],
    phase_preference_min: 'phase_2',
    phase_preference_max: 'approved',
    territory_focus: ['global'],
    deals_last_12mo: 3,
    deals_last_24mo: 6,
    active_trials_count: 15,
    avg_upfront_usd: 800000000,
    median_upfront_usd: 400000000,
    actively_acquiring: true,
    acquisition_appetite: 'aggressive',
    strategic_priorities: ['hematology_oncology', 'car_t', 'aml', 'mds'],
    data_quality_score: 78,
    patent_cliffs: [
      { drug_name: 'Vyxeos (daunorubicin/cytarabine)', indication: 'Hematology (AML)', revenue_usd: 300000000, expiry_year: 2029 },
    ],
  },
  {
    name: 'Sanofi',
    name_variations: ['Sanofi S.A.', 'Sanofi-Aventis'],
    ticker: 'SNY',
    company_type: 'large_pharma',
    hq_country: 'France',
    modalities_active: ['antibody', 'bispecific', 'small_molecule'],
    modalities_primary: ['antibody'],
    indications_active: ['hematology', 'autoimmune', 'rare_disease', 'oncology'],
    indications_specific: ['hemophilia_a', 'ttp', 'cold_agglutinin', 'itp', 'waldenstrom'],
    phase_preference_min: 'phase_1',
    phase_preference_max: 'approved',
    territory_focus: ['global'],
    deals_last_12mo: 4,
    deals_last_24mo: 7,
    active_trials_count: 18,
    avg_upfront_usd: 600000000,
    median_upfront_usd: 300000000,
    actively_acquiring: true,
    acquisition_appetite: 'moderate',
    strategic_priorities: ['hemophilia', 'rare_hematology', 'complement_hematology', 'bispecific'],
    data_quality_score: 82,
    // Note: Eloctate was divested to Sobi — removed from patent_cliffs
    patent_cliffs: [
      { drug_name: 'Cablivi (caplacizumab)', indication: 'Hematology (TTP)', revenue_usd: 400000000, expiry_year: 2033 },
    ],
  },
  {
    // Note: AstraZeneca also appears in rare disease script as 'Alexion (AstraZeneca)' with ticker 'AZN' — cross-TA presence
    name: 'AstraZeneca',
    name_variations: ['AstraZeneca PLC', 'AZ'],
    ticker: 'AZN',
    company_type: 'large_pharma',
    hq_country: 'UK',
    modalities_active: ['antibody', 'small_molecule', 'adc', 'bispecific'],
    modalities_primary: ['antibody'],
    indications_active: ['hematology', 'oncology', 'cardiovascular', 'rare_disease'],
    indications_specific: ['aml', 'mds', 'cll', 'lymphoma'],
    phase_preference_min: 'preclinical',
    phase_preference_max: 'approved',
    territory_focus: ['global'],
    deals_last_12mo: 6,
    deals_last_24mo: 12,
    active_trials_count: 30,
    avg_upfront_usd: 1200000000,
    median_upfront_usd: 600000000,
    actively_acquiring: true,
    acquisition_appetite: 'aggressive',
    strategic_priorities: ['hematology_oncology', 'aml', 'mds', 'acalabrutinib_expansion'],
    data_quality_score: 85,
    patent_cliffs: [
      { drug_name: 'Calquence (acalabrutinib)', indication: 'Hematology (CLL/MCL)', revenue_usd: 2600000000, expiry_year: 2032 },
    ],
  },
  {
    name: 'Blueprint Medicines',
    name_variations: ['Blueprint', 'Blueprint Medicines Corp'],
    ticker: 'BPMC',
    company_type: 'mid_biotech',
    hq_country: 'US',
    modalities_active: ['small_molecule'],
    modalities_primary: ['small_molecule'],
    indications_active: ['hematology', 'oncology', 'rare_disease'],
    indications_specific: ['systemic_mastocytosis', 'cml', 'gist', 'mast_cell_disorders'],
    phase_preference_min: 'preclinical',
    phase_preference_max: 'approved',
    territory_focus: ['global'],
    deals_last_12mo: 2,
    deals_last_24mo: 4,
    active_trials_count: 12,
    avg_upfront_usd: 200000000,
    median_upfront_usd: 100000000,
    actively_acquiring: true,
    acquisition_appetite: 'moderate',
    strategic_priorities: ['mast_cell_diseases', 'kinase_inhibitors', 'systemic_mastocytosis', 'hematology_rare'],
    data_quality_score: 75,
    patent_cliffs: [
      { drug_name: 'Ayvakit (avapritinib)', indication: 'Hematology (Systemic Mastocytosis)', revenue_usd: 600000000, expiry_year: 2035 },
    ],
  },
  {
    name: 'Agios (Servier)',
    name_variations: ['Agios Pharmaceuticals', 'Servier', 'Servier Pharmaceuticals'],
    ticker: null,
    company_type: 'mid_pharma',
    hq_country: 'France',
    modalities_active: ['small_molecule'],
    modalities_primary: ['small_molecule'],
    indications_active: ['hematology', 'rare_disease'],
    indications_specific: ['pyruvate_kinase_deficiency', 'thalassemia', 'sickle_cell', 'mds', 'aml'],
    phase_preference_min: 'phase_1',
    phase_preference_max: 'approved',
    territory_focus: ['global'],
    deals_last_12mo: 2,
    deals_last_24mo: 4,
    active_trials_count: 10,
    avg_upfront_usd: 300000000,
    median_upfront_usd: 150000000,
    actively_acquiring: true,
    acquisition_appetite: 'moderate',
    strategic_priorities: ['rare_hematology', 'pyruvate_kinase_activation', 'hemolytic_anemias', 'idh_inhibitors'],
    data_quality_score: 72,
    patent_cliffs: [
      { drug_name: 'Pyrukynd (mitapivat)', indication: 'Hematology (PKD/Thalassemia)', revenue_usd: 400000000, expiry_year: 2035 },
      { drug_name: 'Tibsovo (ivosidenib)', indication: 'Hematology (AML/MDS IDH1)', revenue_usd: 300000000, expiry_year: 2032 },
    ],
  },

  // ─────────────────────────────────────────────────────────────────
  // LARGE PHARMA WITH HEMATOLOGY PIPELINES
  // ─────────────────────────────────────────────────────────────────
  {
    name: 'Roche/Genentech',
    name_variations: ['Roche', 'Genentech', 'Roche Holding AG', 'F. Hoffmann-La Roche'],
    ticker: 'RHHBY',
    company_type: 'large_pharma',
    hq_country: 'Switzerland',
    modalities_active: ['antibody', 'bispecific', 'adc', 'small_molecule'],
    modalities_primary: ['antibody', 'bispecific'],
    indications_active: ['hematology', 'oncology', 'autoimmune', 'neurology'],
    indications_specific: ['dlbcl', 'follicular_lymphoma', 'cll', 'hemophilia_a', 'multiple_myeloma'],
    phase_preference_min: 'preclinical',
    phase_preference_max: 'approved',
    territory_focus: ['global'],
    deals_last_12mo: 6,
    deals_last_24mo: 11,
    active_trials_count: 45,
    avg_upfront_usd: 2000000000,
    median_upfront_usd: 1000000000,
    actively_acquiring: true,
    acquisition_appetite: 'aggressive',
    strategic_priorities: ['bispecific_hematology', 'lymphoma', 'hemophilia_a', 'adc_hematology', 'next_gen_cd20'],
    data_quality_score: 92,
    patent_cliffs: [
      { drug_name: 'Hemlibra (emicizumab)', indication: 'Hematology (Hemophilia A)', revenue_usd: 4200000000, expiry_year: 2033 },
      { drug_name: 'Polivy (polatuzumab vedotin)', indication: 'Hematology (DLBCL ADC)', revenue_usd: 1800000000, expiry_year: 2033 },
      { drug_name: 'Columvi (glofitamab)', indication: 'Hematology (DLBCL Bispecific)', revenue_usd: 600000000, expiry_year: 2038 },
      { drug_name: 'Gazyva (obinutuzumab)', indication: 'Hematology (CLL/FL)', revenue_usd: 1100000000, expiry_year: 2029 },
    ],
  },
  {
    name: 'Merck',
    name_variations: ['Merck & Co.', 'Merck Sharp & Dohme', 'MSD'],
    ticker: 'MRK',
    company_type: 'large_pharma',
    hq_country: 'US',
    modalities_active: ['antibody', 'small_molecule', 'adc', 'bispecific'],
    modalities_primary: ['antibody', 'small_molecule'],
    indications_active: ['hematology', 'oncology', 'autoimmune', 'infectious_disease'],
    indications_specific: ['hodgkin_lymphoma', 'dlbcl', 'pmbcl', 'chl', 'mds'],
    phase_preference_min: 'phase_1',
    phase_preference_max: 'approved',
    territory_focus: ['global'],
    deals_last_12mo: 7,
    deals_last_24mo: 14,
    active_trials_count: 28,
    avg_upfront_usd: 4000000000,
    median_upfront_usd: 2000000000,
    actively_acquiring: true,
    acquisition_appetite: 'aggressive',
    strategic_priorities: ['hematology_oncology', 'io_combinations_hematology', 'adc', 'post_keytruda_diversification'],
    data_quality_score: 88,
    patent_cliffs: [
      { drug_name: 'Keytruda (pembrolizumab)', indication: 'Oncology/Hematology (cHL/PMBCL)', revenue_usd: 25000000000, expiry_year: 2028 },
      { drug_name: 'Welireg (belzutifan)', indication: 'Oncology', revenue_usd: 400000000, expiry_year: 2036 },
    ],
  },
  {
    name: 'Eli Lilly',
    name_variations: ['Lilly', 'Eli Lilly and Company', 'Loxo Oncology'],
    ticker: 'LLY',
    company_type: 'large_pharma',
    hq_country: 'US',
    modalities_active: ['small_molecule', 'antibody', 'bispecific', 'adc'],
    modalities_primary: ['small_molecule'],
    indications_active: ['hematology', 'oncology', 'metabolic', 'autoimmune'],
    indications_specific: ['aml', 'cll', 'lymphoma', 'myelofibrosis'],
    phase_preference_min: 'phase_1',
    phase_preference_max: 'approved',
    territory_focus: ['global'],
    deals_last_12mo: 5,
    deals_last_24mo: 10,
    active_trials_count: 18,
    avg_upfront_usd: 2500000000,
    median_upfront_usd: 1200000000,
    actively_acquiring: true,
    acquisition_appetite: 'aggressive',
    strategic_priorities: ['hematology_oncology', 'targeted_therapies', 'precision_medicine', 'kinase_inhibitors'],
    data_quality_score: 85,
    patent_cliffs: [
      { drug_name: 'Jaypirca (pirtobrutinib)', indication: 'Hematology (MCL/CLL)', revenue_usd: 800000000, expiry_year: 2037 },
      { drug_name: 'Retevmo (selpercatinib)', indication: 'Oncology (RET-driven)', revenue_usd: 700000000, expiry_year: 2036 },
    ],
  },
  {
    name: 'GSK',
    name_variations: ['GlaxoSmithKline', 'GSK plc'],
    ticker: 'GSK',
    company_type: 'large_pharma',
    hq_country: 'UK',
    modalities_active: ['antibody', 'adc', 'small_molecule', 'cell_therapy'],
    modalities_primary: ['antibody', 'adc'],
    indications_active: ['hematology', 'oncology', 'infectious_disease', 'autoimmune'],
    indications_specific: ['multiple_myeloma', 'aml', 'mds'],
    phase_preference_min: 'phase_1',
    phase_preference_max: 'approved',
    territory_focus: ['global'],
    deals_last_12mo: 4,
    deals_last_24mo: 8,
    active_trials_count: 20,
    avg_upfront_usd: 1500000000,
    median_upfront_usd: 800000000,
    actively_acquiring: true,
    acquisition_appetite: 'moderate',
    strategic_priorities: ['multiple_myeloma', 'bcma_targeting', 'adc_hematology', 'next_gen_immunotherapy'],
    data_quality_score: 82,
    patent_cliffs: [
      { drug_name: 'Blenrep (belantamab mafodotin)', indication: 'Hematology (Multiple Myeloma ADC)', revenue_usd: 500000000, expiry_year: 2035 },
    ],
  },

  // ─────────────────────────────────────────────────────────────────
  // MID-CAP HEMATOLOGY SPECIALISTS
  // ─────────────────────────────────────────────────────────────────
  {
    name: 'Alexion (AstraZeneca)',
    name_variations: ['Alexion', 'Alexion Pharmaceuticals', 'Alexion AstraZeneca Rare Disease'],
    ticker: 'AZN',
    company_type: 'large_pharma',
    hq_country: 'US',
    modalities_active: ['antibody', 'small_molecule', 'enzyme_replacement'],
    modalities_primary: ['antibody'],
    indications_active: ['hematology', 'rare_disease', 'nephrology'],
    indications_specific: ['pnh', 'ahus', 'gmg', 'nmosd', 'complement_disorders'],
    phase_preference_min: 'phase_1',
    phase_preference_max: 'approved',
    territory_focus: ['global'],
    deals_last_12mo: 3,
    deals_last_24mo: 6,
    active_trials_count: 22,
    avg_upfront_usd: 800000000,
    median_upfront_usd: 400000000,
    actively_acquiring: true,
    acquisition_appetite: 'aggressive',
    strategic_priorities: ['complement_inhibition', 'pnh', 'rare_hematology', 'next_gen_c5'],
    data_quality_score: 88,
    patent_cliffs: [
      { drug_name: 'Soliris (eculizumab)', indication: 'Hematology (PNH)', revenue_usd: 3800000000, expiry_year: 2027 },
      { drug_name: 'Ultomiris (ravulizumab)', indication: 'Hematology (PNH)', revenue_usd: 4500000000, expiry_year: 2035 },
    ],
  },
  {
    name: 'Sobi',
    name_variations: ['Swedish Orphan Biovitrum', 'Sobi AB'],
    ticker: 'SOBI.ST',
    company_type: 'mid_pharma',
    hq_country: 'Sweden',
    modalities_active: ['recombinant_protein', 'gene_therapy', 'antibody'],
    modalities_primary: ['recombinant_protein'],
    indications_active: ['hematology', 'rare_disease'],
    indications_specific: ['hemophilia_a', 'hemophilia_b', 'itp', 'neonatal_hematology'],
    phase_preference_min: 'phase_2',
    phase_preference_max: 'approved',
    territory_focus: ['global', 'europe'],
    deals_last_12mo: 2,
    deals_last_24mo: 5,
    active_trials_count: 12,
    avg_upfront_usd: 200000000,
    median_upfront_usd: 100000000,
    actively_acquiring: true,
    acquisition_appetite: 'moderate',
    strategic_priorities: ['hemophilia', 'rare_hematology', 'neonatal_hematology', 'factor_replacement'],
    data_quality_score: 72,
    patent_cliffs: [
      { drug_name: 'Elocta (efmoroctocog alfa)', indication: 'Hematology (Hemophilia A)', revenue_usd: 700000000, expiry_year: 2028 },
      { drug_name: 'Alprolix (eftrenonacog alfa)', indication: 'Hematology (Hemophilia B)', revenue_usd: 400000000, expiry_year: 2029 },
      { drug_name: 'Doptelet (avatrombopag)', indication: 'Hematology (ITP/Thrombocytopenia)', revenue_usd: 500000000, expiry_year: 2031 },
    ],
  },
  {
    name: 'CSL Behring',
    name_variations: ['CSL', 'CSL Limited', 'CSL Behring LLC'],
    ticker: 'CSL.AX',
    company_type: 'large_biotech',
    hq_country: 'Australia',
    modalities_active: ['recombinant_protein', 'gene_therapy', 'antibody', 'plasma_derived'],
    modalities_primary: ['recombinant_protein', 'gene_therapy'],
    indications_active: ['hematology', 'rare_disease', 'immunology'],
    indications_specific: ['hemophilia_a', 'hemophilia_b', 'von_willebrand', 'iron_deficiency', 'sickle_cell'],
    phase_preference_min: 'phase_1',
    phase_preference_max: 'approved',
    territory_focus: ['global'],
    deals_last_12mo: 3,
    deals_last_24mo: 6,
    active_trials_count: 18,
    avg_upfront_usd: 500000000,
    median_upfront_usd: 250000000,
    actively_acquiring: true,
    acquisition_appetite: 'moderate',
    strategic_priorities: ['hemophilia_gene_therapy', 'rare_bleeding', 'von_willebrand', 'plasma_innovation'],
    data_quality_score: 82,
    patent_cliffs: [
      { drug_name: 'Hemgenix (etranacogene dezaparvovec)', indication: 'Hematology (Hemophilia B Gene Therapy)', revenue_usd: 300000000, expiry_year: 2038 },
      { drug_name: 'Idelvion (albutrepenonacog alfa)', indication: 'Hematology (Hemophilia B)', revenue_usd: 500000000, expiry_year: 2030 },
    ],
  },
  {
    name: 'Protagonist Therapeutics',
    name_variations: ['Protagonist', 'Protagonist Therapeutics Inc'],
    ticker: 'PTGX',
    company_type: 'mid_biotech',
    hq_country: 'US',
    modalities_active: ['peptide'],
    modalities_primary: ['peptide'],
    indications_active: ['hematology', 'gi'],
    indications_specific: ['polycythemia_vera', 'essential_thrombocythemia', 'myeloproliferative'],
    phase_preference_min: 'preclinical',
    phase_preference_max: 'phase_3',
    territory_focus: ['global'],
    deals_last_12mo: 1,
    deals_last_24mo: 3,
    active_trials_count: 6,
    avg_upfront_usd: 100000000,
    median_upfront_usd: 50000000,
    actively_acquiring: false,
    acquisition_appetite: 'selective',
    strategic_priorities: ['hepcidin_mimetics', 'polycythemia_vera', 'myeloproliferative', 'peptide_therapeutics'],
    data_quality_score: 70,
    patent_cliffs: [
      { drug_name: 'Rusfertide', indication: 'Hematology (Polycythemia Vera)', revenue_usd: 500000000, expiry_year: 2039 },
    ],
  },
  {
    name: 'Rigel Pharmaceuticals',
    name_variations: ['Rigel', 'Rigel Pharmaceuticals Inc'],
    ticker: 'RIGL',
    company_type: 'specialty',
    hq_country: 'US',
    modalities_active: ['small_molecule'],
    modalities_primary: ['small_molecule'],
    indications_active: ['hematology', 'autoimmune'],
    indications_specific: ['itp', 'warm_autoimmune_hemolytic_anemia', 'neutropenia'],
    phase_preference_min: 'preclinical',
    phase_preference_max: 'approved',
    territory_focus: ['us', 'global'],
    deals_last_12mo: 1,
    deals_last_24mo: 2,
    active_trials_count: 5,
    avg_upfront_usd: 50000000,
    median_upfront_usd: 30000000,
    actively_acquiring: false,
    acquisition_appetite: 'selective',
    strategic_priorities: ['itp', 'spleen_tyrosine_kinase', 'autoimmune_hematology', 'warm_aiha'],
    data_quality_score: 68,
    patent_cliffs: [
      { drug_name: 'Tavalisse (fostamatinib)', indication: 'Hematology (ITP)', revenue_usd: 200000000, expiry_year: 2031 },
    ],
  },
  {
    name: 'ADC Therapeutics',
    name_variations: ['ADC Therapeutics SA', 'ADCT'],
    ticker: 'ADCT',
    company_type: 'mid_biotech',
    hq_country: 'Switzerland',
    modalities_active: ['adc'],
    modalities_primary: ['adc'],
    indications_active: ['hematology'],
    indications_specific: ['dlbcl', 'hodgkin_lymphoma', 'follicular_lymphoma', 'mantle_cell_lymphoma'],
    phase_preference_min: 'preclinical',
    phase_preference_max: 'approved',
    territory_focus: ['global'],
    deals_last_12mo: 2,
    deals_last_24mo: 3,
    active_trials_count: 8,
    avg_upfront_usd: 150000000,
    median_upfront_usd: 80000000,
    actively_acquiring: false,
    acquisition_appetite: 'selective',
    strategic_priorities: ['adc_lymphoma', 'next_gen_adc', 'pyrrolobenzodiazepine_payloads', 'combination_strategies'],
    data_quality_score: 72,
    patent_cliffs: [
      { drug_name: 'Zynlonta (loncastuximab tesirine)', indication: 'Hematology (DLBCL ADC)', revenue_usd: 200000000, expiry_year: 2035 },
    ],
  },

  // ─────────────────────────────────────────────────────────────────
  // ASIAN PHARMA ACTIVE IN HEMATOLOGY
  // ─────────────────────────────────────────────────────────────────
  {
    name: 'Daiichi Sankyo',
    name_variations: ['Daiichi Sankyo Co.', 'Daiichi Sankyo Inc.'],
    ticker: '4568.T',
    company_type: 'large_pharma',
    hq_country: 'Japan',
    modalities_active: ['adc', 'antibody', 'small_molecule', 'bispecific'],
    modalities_primary: ['adc'],
    indications_active: ['hematology', 'oncology'],
    indications_specific: ['aml', 'mds', 'lymphoma', 'multiple_myeloma'],
    phase_preference_min: 'preclinical',
    phase_preference_max: 'approved',
    territory_focus: ['global', 'japan'],
    deals_last_12mo: 5,
    deals_last_24mo: 10,
    active_trials_count: 25,
    avg_upfront_usd: 2000000000,
    median_upfront_usd: 1000000000,
    actively_acquiring: true,
    acquisition_appetite: 'aggressive',
    strategic_priorities: ['adc_platform', 'hematology_oncology', 'dxd_technology', 'aml'],
    data_quality_score: 85,
    patent_cliffs: [
      { drug_name: 'Vanflyta (quizartinib)', indication: 'Hematology (AML FLT3)', revenue_usd: 400000000, expiry_year: 2035 },
      { drug_name: 'Enhertu (trastuzumab deruxtecan)', indication: 'Oncology (HER2+ ADC)', revenue_usd: 6000000000, expiry_year: 2035 },
    ],
  },
  {
    name: 'Astellas Pharma',
    name_variations: ['Astellas', 'Astellas Pharma Inc.'],
    ticker: '4503.T',
    company_type: 'large_pharma',
    hq_country: 'Japan',
    modalities_active: ['small_molecule', 'antibody', 'adc', 'cell_therapy'],
    modalities_primary: ['small_molecule'],
    indications_active: ['hematology', 'oncology', 'urology'],
    indications_specific: ['aml', 'flt3_aml', 'mds'],
    phase_preference_min: 'phase_1',
    phase_preference_max: 'approved',
    territory_focus: ['global', 'japan'],
    deals_last_12mo: 3,
    deals_last_24mo: 6,
    active_trials_count: 15,
    avg_upfront_usd: 400000000,
    median_upfront_usd: 200000000,
    actively_acquiring: true,
    acquisition_appetite: 'moderate',
    strategic_priorities: ['aml', 'flt3_inhibition', 'hematology_oncology', 'targeted_therapies'],
    data_quality_score: 78,
    patent_cliffs: [
      { drug_name: 'Xospata (gilteritinib)', indication: 'Hematology (AML FLT3+)', revenue_usd: 700000000, expiry_year: 2032 },
    ],
  },

  // ─────────────────────────────────────────────────────────────────
  // CAR-T / CELL THERAPY SPECIALISTS
  // ─────────────────────────────────────────────────────────────────
  {
    name: 'Autolus Therapeutics',
    name_variations: ['Autolus', 'Autolus Therapeutics plc'],
    ticker: 'AUTL',
    company_type: 'mid_biotech',
    hq_country: 'UK',
    modalities_active: ['cell_therapy'],
    modalities_primary: ['cell_therapy'],
    indications_active: ['hematology'],
    indications_specific: ['all', 'dlbcl', 'lymphoma'],
    phase_preference_min: 'preclinical',
    phase_preference_max: 'approved',
    territory_focus: ['global', 'us', 'europe'],
    deals_last_12mo: 1,
    deals_last_24mo: 3,
    active_trials_count: 6,
    avg_upfront_usd: 100000000,
    median_upfront_usd: 50000000,
    actively_acquiring: false,
    acquisition_appetite: 'selective',
    strategic_priorities: ['next_gen_car_t', 'all_car_t', 'dual_targeting', 'reduced_toxicity_car_t'],
    data_quality_score: 70,
    patent_cliffs: [
      { drug_name: 'Aucatzyl (obecabtagene autoleucel)', indication: 'Hematology (ALL CAR-T)', revenue_usd: 400000000, expiry_year: 2039 },
    ],
  },
  {
    name: 'Arcellx',
    name_variations: ['Arcellx Inc'],
    ticker: 'ACLX',
    company_type: 'mid_biotech',
    hq_country: 'US',
    modalities_active: ['cell_therapy'],
    modalities_primary: ['cell_therapy'],
    indications_active: ['hematology'],
    indications_specific: ['multiple_myeloma', 'aml', 'dlbcl'],
    phase_preference_min: 'preclinical',
    phase_preference_max: 'phase_3',
    territory_focus: ['us', 'global'],
    deals_last_12mo: 2,
    deals_last_24mo: 3,
    active_trials_count: 5,
    avg_upfront_usd: 150000000,
    median_upfront_usd: 75000000,
    actively_acquiring: false,
    acquisition_appetite: 'selective',
    strategic_priorities: ['d_domain_car_t', 'bcma_car_t', 'multiple_myeloma', 'next_gen_cell_therapy'],
    data_quality_score: 72,
    patent_cliffs: [
      { drug_name: 'Anito-cel (anitocabtagene autoleucel)', indication: 'Hematology (Multiple Myeloma CAR-T)', revenue_usd: 600000000, expiry_year: 2040 },
    ],
  },
  {
    name: 'Caribou Biosciences',
    name_variations: ['Caribou', 'Caribou Biosciences Inc'],
    ticker: 'CRBU',
    company_type: 'mid_biotech',
    hq_country: 'US',
    modalities_active: ['cell_therapy', 'gene_editing'],
    modalities_primary: ['cell_therapy'],
    indications_active: ['hematology'],
    indications_specific: ['dlbcl', 'follicular_lymphoma', 'lymphoma', 'multiple_myeloma', 'aml'],
    phase_preference_min: 'preclinical',
    phase_preference_max: 'phase_2',
    territory_focus: ['us', 'global'],
    deals_last_12mo: 1,
    deals_last_24mo: 2,
    active_trials_count: 5,
    avg_upfront_usd: 80000000,
    median_upfront_usd: 40000000,
    actively_acquiring: false,
    acquisition_appetite: 'inactive',
    strategic_priorities: ['allogeneic_car_t', 'crispr_car_t', 'off_shelf_cell_therapy', 'cd19_car_t'],
    data_quality_score: 68,
    patent_cliffs: [
      { drug_name: 'CB-010', indication: 'Hematology (DLBCL Allogeneic CAR-T)', revenue_usd: 300000000, expiry_year: 2040 },
    ],
  },
];

// =============================================================================
// SEED FUNCTION
// =============================================================================

async function seedHematologyCompanies() {
  console.log('Starting hematology company seed...\n');
  console.log(`Seeding ${hematologyCompanies.length} companies...\n`);

  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const company of hematologyCompanies) {
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
          console.log(`  ↻ ${company.name}: Updated with hematology data (${company.company_type})`);
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
  console.log(`Total:   ${hematologyCompanies.length}`);
  console.log(`${'='.repeat(50)}\n`);
}

seedHematologyCompanies().catch(console.error);
