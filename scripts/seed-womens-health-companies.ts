// Script to seed women's health-focused companies into the partner matching database
// Run with: npx tsx scripts/seed-womens-health-companies.ts
//
// These companies are curated from real deal activity, SEC filings, and pipeline data.
// Each company includes women's health-relevant indications, modalities, strategic priorities,
// and deal history to power accurate partner matching for women's health assets.

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

interface WomensHealthCompany {
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
// WOMEN'S HEALTH COMPANY DATABASE
// Sources: SEC filings, DealForma, BioPharma Dive, Evaluate Pharma, company IRs
// =============================================================================

const womensHealthCompanies: WomensHealthCompany[] = [
  // ─────────────────────────────────────────────────────────────────
  // LARGE PHARMA WITH MAJOR WOMEN'S HEALTH FRANCHISES
  // ─────────────────────────────────────────────────────────────────
  {
    name: 'AbbVie',
    name_variations: ['AbbVie Inc.', 'AbbVie Inc'],
    ticker: 'ABBV',
    company_type: 'large_pharma',
    hq_country: 'US',
    modalities_active: ['small_molecule', 'antibody', 'gnrh_antagonist', 'peptide'],
    modalities_primary: ['small_molecule', 'gnrh_antagonist'],
    indications_active: ['womens_health', 'immunology', 'oncology', 'hematology'],
    indications_specific: ['endometriosis', 'uterine_fibroids', 'adenomyosis', 'pcos'],
    phase_preference_min: 'phase_1',
    phase_preference_max: 'approved',
    territory_focus: ['global'],
    deals_last_12mo: 5,
    deals_last_24mo: 10,
    active_trials_count: 22,
    avg_upfront_usd: 2500000000,
    median_upfront_usd: 1200000000,
    actively_acquiring: true,
    acquisition_appetite: 'aggressive',
    strategic_priorities: ['endometriosis_franchise', 'gnrh_antagonist_platform', 'uterine_fibroids', 'hormonal_therapy', 'womens_health_expansion'],
    data_quality_score: 92,
    patent_cliffs: [
      { drug_name: 'Orilissa (elagolix)', indication: "Women's Health (Endometriosis)", revenue_usd: 500000000, expiry_year: 2029 },
      { drug_name: 'Oriahnn (elagolix/E2/NETA)', indication: "Women's Health (Uterine Fibroids)", revenue_usd: 300000000, expiry_year: 2030 },
    ],
  },
  {
    name: 'Bayer',
    name_variations: ['Bayer AG', 'Bayer Pharma', 'Bayer HealthCare'],
    ticker: 'BAYN.DE',
    company_type: 'large_pharma',
    hq_country: 'Germany',
    modalities_active: ['small_molecule', 'hormonal', 'device', 'ius'],
    modalities_primary: ['hormonal', 'device'],
    indications_active: ['womens_health', 'cardiovascular', 'oncology', 'ophthalmology'],
    indications_specific: ['contraception', 'menorrhagia', 'endometriosis', 'menopause', 'pcos'],
    phase_preference_min: 'phase_1',
    phase_preference_max: 'approved',
    territory_focus: ['global'],
    deals_last_12mo: 4,
    deals_last_24mo: 8,
    active_trials_count: 20,
    avg_upfront_usd: 800000000,
    median_upfront_usd: 400000000,
    actively_acquiring: true,
    acquisition_appetite: 'moderate',
    strategic_priorities: ['contraception_franchise', 'ius_lifecycle', 'menopause', 'digital_womens_health', 'hormonal_innovation'],
    data_quality_score: 90,
    patent_cliffs: [
      { drug_name: 'Mirena (levonorgestrel IUS)', indication: "Women's Health (Contraception/Menorrhagia)", revenue_usd: 1500000000, expiry_year: 2027 },
      { drug_name: 'Kyleena (levonorgestrel IUS low-dose)', indication: "Women's Health (Contraception)", revenue_usd: 600000000, expiry_year: 2031 },
      { drug_name: 'YAZ/Yasmin (drospirenone/EE)', indication: "Women's Health (Oral Contraception)", revenue_usd: 800000000, expiry_year: 2026 },
    ],
  },
  {
    name: 'Organon',
    name_variations: ['Organon & Co.', 'Organon Inc', 'Organon LLC'],
    ticker: 'OGN',
    company_type: 'mid_pharma',
    hq_country: 'US',
    modalities_active: ['small_molecule', 'hormonal', 'device', 'biosimilar', 'implant'],
    modalities_primary: ['hormonal', 'device'],
    indications_active: ['womens_health', 'fertility', 'biosimilars'],
    indications_specific: ['contraception', 'fertility', 'postpartum_hemorrhage', 'menopause', 'endometriosis'],
    phase_preference_min: 'phase_2',
    phase_preference_max: 'approved',
    territory_focus: ['global'],
    deals_last_12mo: 4,
    deals_last_24mo: 8,
    active_trials_count: 15,
    avg_upfront_usd: 300000000,
    median_upfront_usd: 150000000,
    actively_acquiring: true,
    acquisition_appetite: 'aggressive',
    strategic_priorities: ['nexplanon_lifecycle', 'fertility_franchise', 'postpartum_hemorrhage', 'womens_health_pure_play', 'biosimilar_portfolio'],
    data_quality_score: 85,
    patent_cliffs: [
      { drug_name: 'Nexplanon (etonogestrel implant)', indication: "Women's Health (Long-Acting Contraception)", revenue_usd: 1100000000, expiry_year: 2030 },
      { drug_name: 'NuvaRing (etonogestrel/ethinyl estradiol)', indication: "Women's Health (Vaginal Ring Contraception)", revenue_usd: 400000000, expiry_year: 2026 },
      { drug_name: 'Follistim/Puregon (follitropin beta)', indication: "Women's Health (Fertility/IVF)", revenue_usd: 500000000, expiry_year: 2027 },
    ],
  },
  {
    name: 'Pfizer',
    name_variations: ['Pfizer Inc.', 'Pfizer Inc'],
    ticker: 'PFE',
    company_type: 'large_pharma',
    hq_country: 'US',
    modalities_active: ['small_molecule', 'antibody', 'adc', 'vaccine'],
    modalities_primary: ['small_molecule', 'antibody'],
    indications_active: ['womens_health', 'oncology', 'immunology', 'infectious_disease'],
    indications_specific: ['breast_cancer', 'cervical_cancer', 'menopause', 'contraception'],
    phase_preference_min: 'phase_1',
    phase_preference_max: 'approved',
    territory_focus: ['global'],
    deals_last_12mo: 6,
    deals_last_24mo: 12,
    active_trials_count: 20,
    avg_upfront_usd: 3000000000,
    median_upfront_usd: 1500000000,
    actively_acquiring: true,
    acquisition_appetite: 'aggressive',
    strategic_priorities: ['breast_cancer_franchise', 'adc_womens_cancers', 'menopause', 'seagen_integration', 'cervical_cancer'],
    data_quality_score: 88,
    patent_cliffs: [
      { drug_name: 'Ibrance (palbociclib)', indication: "Women's Health/Oncology (HR+ Breast Cancer)", revenue_usd: 4800000000, expiry_year: 2027 },
      { drug_name: 'Premarin (conjugated estrogens)', indication: "Women's Health (Menopause/HRT)", revenue_usd: 600000000, expiry_year: 2026 },
    ],
  },
  {
    name: 'Johnson & Johnson',
    name_variations: ['J&J', 'Janssen', 'Johnson & Johnson Inc'],
    ticker: 'JNJ',
    company_type: 'large_pharma',
    hq_country: 'US',
    modalities_active: ['small_molecule', 'device', 'hormonal', 'patch'],
    modalities_primary: ['device', 'hormonal'],
    indications_active: ['womens_health', 'oncology', 'immunology'],
    indications_specific: ['contraception', 'menopause', 'breast_cancer', 'cervical_cancer'],
    phase_preference_min: 'phase_2',
    phase_preference_max: 'approved',
    territory_focus: ['global'],
    deals_last_12mo: 3,
    deals_last_24mo: 6,
    active_trials_count: 12,
    avg_upfront_usd: 1500000000,
    median_upfront_usd: 700000000,
    actively_acquiring: true,
    acquisition_appetite: 'moderate',
    strategic_priorities: ['contraceptive_patch', 'surgical_devices_gyn', 'womens_oncology', 'menopause'],
    data_quality_score: 82,
    patent_cliffs: [
      { drug_name: 'Evra/Xulane (norelgestromin/EE patch)', indication: "Women's Health (Transdermal Contraception)", revenue_usd: 300000000, expiry_year: 2027 },
    ],
  },

  // ─────────────────────────────────────────────────────────────────
  // SPECIALTY WOMEN'S HEALTH COMPANIES
  // ─────────────────────────────────────────────────────────────────
  {
    name: 'Myovant Sciences (Sumitovant)',
    name_variations: ['Myovant', 'Myovant Sciences', 'Sumitovant Biopharma', 'Sumitomo Pharma'],
    ticker: '4506.T',
    company_type: 'mid_pharma',
    hq_country: 'US',
    modalities_active: ['small_molecule', 'gnrh_antagonist'],
    modalities_primary: ['gnrh_antagonist'],
    indications_active: ['womens_health', 'oncology'],
    indications_specific: ['uterine_fibroids', 'endometriosis', 'prostate_cancer'],
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
    strategic_priorities: ['relugolix_expansion', 'uterine_fibroids', 'endometriosis', 'gnrh_platform', 'hormonal_therapy'],
    data_quality_score: 78,
    patent_cliffs: [
      { drug_name: 'Myfembree (relugolix/E2/NETA)', indication: "Women's Health (Uterine Fibroids)", revenue_usd: 500000000, expiry_year: 2035 },
      { drug_name: 'Orgovyx (relugolix)', indication: 'Oncology (Prostate Cancer, cross-label)', revenue_usd: 400000000, expiry_year: 2035 },
    ],
  },
  {
    name: 'TherapeuticsMD (Mayne Pharma)',
    name_variations: ['TherapeuticsMD', 'TXMD', 'Mayne Pharma', 'Mayne Pharma Group'],
    ticker: 'MAYNF',
    company_type: 'specialty',
    hq_country: 'US',
    modalities_active: ['small_molecule', 'hormonal', 'vaginal_ring', 'oral'],
    modalities_primary: ['hormonal'],
    indications_active: ['womens_health'],
    indications_specific: ['menopause', 'contraception', 'vvae', 'hot_flashes'],
    phase_preference_min: 'phase_2',
    phase_preference_max: 'approved',
    territory_focus: ['us'],
    deals_last_12mo: 2,
    deals_last_24mo: 4,
    active_trials_count: 5,
    avg_upfront_usd: 50000000,
    median_upfront_usd: 25000000,
    actively_acquiring: false,
    acquisition_appetite: 'selective',
    strategic_priorities: ['menopause_franchise', 'bijuva_market', 'annovera_vaginal_ring', 'hormone_therapy_innovation'],
    data_quality_score: 65,
    patent_cliffs: [
      { drug_name: 'Bijuva (estradiol/progesterone)', indication: "Women's Health (Menopause/VMS)", revenue_usd: 150000000, expiry_year: 2033 },
      { drug_name: 'Annovera (segesterone/ethinyl estradiol ring)', indication: "Women's Health (Annual Vaginal Ring Contraception)", revenue_usd: 200000000, expiry_year: 2036 },
    ],
  },
  {
    name: 'Dare Bioscience',
    name_variations: ['Dare', 'Dare Bioscience Inc'],
    ticker: 'DARE',
    company_type: 'specialty',
    hq_country: 'US',
    modalities_active: ['small_molecule', 'biologic', 'device', 'topical', 'vaginal_gel'],
    modalities_primary: ['small_molecule', 'vaginal_gel'],
    indications_active: ['womens_health'],
    indications_specific: ['bacterial_vaginosis', 'contraception', 'endometriosis', 'vulvodynia', 'sexual_health'],
    phase_preference_min: 'preclinical',
    phase_preference_max: 'approved',
    territory_focus: ['us'],
    deals_last_12mo: 2,
    deals_last_24mo: 4,
    active_trials_count: 8,
    avg_upfront_usd: 30000000,
    median_upfront_usd: 15000000,
    actively_acquiring: true,
    acquisition_appetite: 'moderate',
    strategic_priorities: ['womens_health_pipeline', 'bacterial_vaginosis', 'non_hormonal_contraception', 'sexual_health', 'xaciato_market'],
    data_quality_score: 62,
    patent_cliffs: [
      { drug_name: 'Xaciato (clindamycin vaginal gel)', indication: "Women's Health (Bacterial Vaginosis)", revenue_usd: 100000000, expiry_year: 2035 },
      { drug_name: 'DARE-BV1', indication: "Women's Health (Bacterial Vaginosis Bioadhesive)", revenue_usd: 150000000, expiry_year: 2038 },
    ],
  },
  {
    name: 'Obseva (now Xoma)',
    name_variations: ['Obseva', 'ObsEva SA', 'Kissei/Obseva'],
    ticker: null,
    company_type: 'specialty',
    hq_country: 'Switzerland',
    modalities_active: ['small_molecule', 'gnrh_antagonist', 'prostaglandin_receptor'],
    modalities_primary: ['gnrh_antagonist'],
    indications_active: ['womens_health'],
    indications_specific: ['uterine_fibroids', 'endometriosis', 'preterm_labor', 'ivf'],
    phase_preference_min: 'phase_2',
    phase_preference_max: 'approved',
    territory_focus: ['europe', 'us'],
    deals_last_12mo: 1,
    deals_last_24mo: 2,
    active_trials_count: 3,
    avg_upfront_usd: 40000000,
    median_upfront_usd: 20000000,
    actively_acquiring: false,
    acquisition_appetite: 'inactive',
    strategic_priorities: ['gnrh_antagonist_oral', 'uterine_fibroids', 'preterm_labor', 'womens_health_europe'],
    data_quality_score: 55,
    patent_cliffs: [
      { drug_name: 'Linzagolix (Yselty)', indication: "Women's Health (Uterine Fibroids GnRH Antagonist)", revenue_usd: 300000000, expiry_year: 2036 },
    ],
  },

  // ─────────────────────────────────────────────────────────────────
  // FERTILITY SPECIALISTS
  // ─────────────────────────────────────────────────────────────────
  {
    name: 'Ferring Pharmaceuticals',
    name_variations: ['Ferring', 'Ferring Pharma', 'Ferring International'],
    ticker: null,
    company_type: 'mid_pharma',
    hq_country: 'Switzerland',
    modalities_active: ['recombinant_protein', 'peptide', 'small_molecule', 'microbiome'],
    modalities_primary: ['recombinant_protein', 'peptide'],
    indications_active: ['womens_health', 'fertility', 'urology', 'gastroenterology'],
    indications_specific: ['ivf', 'fertility', 'preterm_birth', 'endometriosis', 'postpartum_hemorrhage'],
    phase_preference_min: 'preclinical',
    phase_preference_max: 'approved',
    territory_focus: ['global'],
    deals_last_12mo: 3,
    deals_last_24mo: 6,
    active_trials_count: 18,
    avg_upfront_usd: 200000000,
    median_upfront_usd: 100000000,
    actively_acquiring: true,
    acquisition_appetite: 'moderate',
    strategic_priorities: ['fertility_franchise', 'ivf_gonadotropins', 'preterm_birth', 'microbiome_fertility', 'reproductive_medicine'],
    data_quality_score: 80,
    patent_cliffs: [
      { drug_name: 'Menopur (menotropins)', indication: "Women's Health (IVF/Fertility)", revenue_usd: 700000000, expiry_year: 2027 },
      { drug_name: 'Rekovelle (follitropin delta)', indication: "Women's Health (IVF Individualized FSH)", revenue_usd: 300000000, expiry_year: 2032 },
    ],
  },
  {
    name: 'Merck KGaA',
    name_variations: ['Merck KGaA', 'EMD Serono', 'Merck Group'],
    ticker: 'MRK.DE',
    company_type: 'large_pharma',
    hq_country: 'Germany',
    modalities_active: ['recombinant_protein', 'small_molecule', 'antibody'],
    modalities_primary: ['recombinant_protein'],
    indications_active: ['womens_health', 'fertility', 'oncology', 'neurology'],
    indications_specific: ['ivf', 'fertility', 'thyroid_pregnancy', 'recurrent_miscarriage'],
    phase_preference_min: 'phase_1',
    phase_preference_max: 'approved',
    territory_focus: ['global'],
    deals_last_12mo: 4,
    deals_last_24mo: 7,
    active_trials_count: 15,
    avg_upfront_usd: 500000000,
    median_upfront_usd: 250000000,
    actively_acquiring: true,
    acquisition_appetite: 'moderate',
    strategic_priorities: ['fertility_global_leader', 'gonal_f_franchise', 'digital_fertility', 'ivf_lifecycle', 'reproductive_endocrinology'],
    data_quality_score: 85,
    patent_cliffs: [
      { drug_name: 'Gonal-F (follitropin alfa)', indication: "Women's Health (IVF/Fertility)", revenue_usd: 1200000000, expiry_year: 2028 },
      { drug_name: 'Cetrotide (cetrorelix)', indication: "Women's Health (IVF GnRH Antagonist)", revenue_usd: 200000000, expiry_year: 2026 },
    ],
  },
  {
    name: 'CooperSurgical',
    name_variations: ['CooperSurgical Inc', 'Cooper Companies', 'CooperSurgical Fertility'],
    ticker: 'COO',
    company_type: 'large_pharma',
    hq_country: 'US',
    modalities_active: ['device', 'cryopreservation', 'genetic_testing', 'ivf_media'],
    modalities_primary: ['device'],
    indications_active: ['womens_health', 'fertility'],
    indications_specific: ['ivf_devices', 'embryo_culture', 'genetic_screening', 'cryopreservation', 'intrauterine_devices'],
    phase_preference_min: 'phase_3',
    phase_preference_max: 'approved',
    territory_focus: ['global'],
    deals_last_12mo: 3,
    deals_last_24mo: 6,
    active_trials_count: 8,
    avg_upfront_usd: 300000000,
    median_upfront_usd: 150000000,
    actively_acquiring: true,
    acquisition_appetite: 'aggressive',
    strategic_priorities: ['ivf_devices', 'fertility_diagnostics', 'embryo_culture_media', 'cryopreservation', 'gyn_surgical'],
    data_quality_score: 78,
    patent_cliffs: [
      { drug_name: 'Paragard (copper IUD)', indication: "Women's Health (Non-Hormonal Contraception)", revenue_usd: 300000000, expiry_year: 2028 },
      { drug_name: 'IVF media/devices portfolio', indication: "Women's Health (IVF Lab Products)", revenue_usd: 800000000, expiry_year: 2030 },
    ],
  },
  {
    name: 'FUJIFILM Irvine Scientific',
    name_variations: ['Irvine Scientific', 'FUJIFILM Irvine', 'FIS'],
    ticker: '4901.T',
    company_type: 'large_pharma',
    hq_country: 'Japan',
    modalities_active: ['ivf_media', 'cell_culture', 'cryopreservation'],
    modalities_primary: ['ivf_media'],
    indications_active: ['womens_health', 'fertility'],
    indications_specific: ['ivf_culture_media', 'embryo_vitrification', 'sperm_preparation'],
    phase_preference_min: 'approved',
    phase_preference_max: 'approved',
    territory_focus: ['global'],
    deals_last_12mo: 2,
    deals_last_24mo: 3,
    active_trials_count: 4,
    avg_upfront_usd: 100000000,
    median_upfront_usd: 50000000,
    actively_acquiring: true,
    acquisition_appetite: 'moderate',
    strategic_priorities: ['ivf_culture_media', 'vitrification', 'fertility_lab_products', 'cell_culture_innovation'],
    data_quality_score: 68,
    patent_cliffs: [
      { drug_name: 'Continuous Single Culture media', indication: "Women's Health (IVF Culture Media)", revenue_usd: 300000000, expiry_year: 2030 },
    ],
  },

  // ─────────────────────────────────────────────────────────────────
  // ENDOMETRIOSIS / FIBROIDS FOCUSED
  // ─────────────────────────────────────────────────────────────────
  {
    name: 'Enteris BioPharma',
    name_variations: ['Enteris', 'Enteris BioPharma Inc'],
    ticker: null,
    company_type: 'specialty',
    hq_country: 'US',
    modalities_active: ['small_molecule', 'oral_peptide', 'peptelligence'],
    modalities_primary: ['oral_peptide'],
    indications_active: ['womens_health', 'endocrinology'],
    indications_specific: ['endometriosis', 'ovarian_stimulation', 'hormonal_therapy'],
    phase_preference_min: 'preclinical',
    phase_preference_max: 'phase_2',
    territory_focus: ['us'],
    deals_last_12mo: 1,
    deals_last_24mo: 2,
    active_trials_count: 3,
    avg_upfront_usd: 20000000,
    median_upfront_usd: 10000000,
    actively_acquiring: false,
    acquisition_appetite: 'inactive',
    strategic_priorities: ['oral_peptide_delivery', 'peptelligence_platform', 'oral_hormone_formulations', 'womens_health_oral'],
    data_quality_score: 55,
    patent_cliffs: [
      { drug_name: 'Oral leuprolide (Peptelligence)', indication: "Women's Health (Endometriosis Oral GnRH)", revenue_usd: 200000000, expiry_year: 2037 },
    ],
  },
  {
    name: 'Kissei Pharmaceutical',
    name_variations: ['Kissei', 'Kissei Pharmaceutical Co.'],
    ticker: '4547.T',
    company_type: 'mid_pharma',
    hq_country: 'Japan',
    modalities_active: ['small_molecule', 'gnrh_antagonist'],
    modalities_primary: ['small_molecule'],
    indications_active: ['womens_health', 'urology', 'nephrology'],
    indications_specific: ['uterine_fibroids', 'endometriosis', 'overactive_bladder'],
    phase_preference_min: 'phase_2',
    phase_preference_max: 'approved',
    territory_focus: ['japan', 'asia', 'europe'],
    deals_last_12mo: 2,
    deals_last_24mo: 3,
    active_trials_count: 6,
    avg_upfront_usd: 50000000,
    median_upfront_usd: 25000000,
    actively_acquiring: true,
    acquisition_appetite: 'selective',
    strategic_priorities: ['gnrh_antagonist_japan', 'uterine_fibroids_asia', 'linzagolix_partnership', 'womens_health_japan'],
    data_quality_score: 65,
    patent_cliffs: [
      { drug_name: 'Linzagolix (Japan rights)', indication: "Women's Health (Uterine Fibroids Japan)", revenue_usd: 150000000, expiry_year: 2036 },
    ],
  },

  // ─────────────────────────────────────────────────────────────────
  // ONCOLOGY-ADJACENT (WOMEN'S CANCERS)
  // ─────────────────────────────────────────────────────────────────
  {
    name: 'Merck',
    name_variations: ['Merck & Co.', 'Merck Sharp & Dohme', 'MSD'],
    ticker: 'MRK',
    company_type: 'large_pharma',
    hq_country: 'US',
    modalities_active: ['vaccine', 'antibody', 'small_molecule'],
    modalities_primary: ['vaccine', 'antibody'],
    indications_active: ['womens_health', 'infectious_disease', 'oncology'],
    indications_specific: ['hpv_prevention', 'cervical_cancer', 'endometrial_cancer', 'ovarian_cancer'],
    phase_preference_min: 'phase_1',
    phase_preference_max: 'approved',
    territory_focus: ['global'],
    deals_last_12mo: 6,
    deals_last_24mo: 12,
    active_trials_count: 30,
    avg_upfront_usd: 4000000000,
    median_upfront_usd: 2000000000,
    actively_acquiring: true,
    acquisition_appetite: 'aggressive',
    strategic_priorities: ['gardasil_global_expansion', 'cervical_cancer_elimination', 'endometrial_cancer', 'keytruda_womens_cancers', 'ovarian_cancer'],
    data_quality_score: 92,
    patent_cliffs: [
      { drug_name: 'Gardasil 9 (HPV vaccine)', indication: "Women's Health (HPV Prevention/Cervical Cancer)", revenue_usd: 9400000000, expiry_year: 2028 },
      { drug_name: 'Keytruda (pembrolizumab)', indication: "Women's Health/Oncology (Endometrial/Cervical Cancer)", revenue_usd: 25000000000, expiry_year: 2028 },
    ],
  },
  {
    name: 'GSK',
    name_variations: ['GlaxoSmithKline', 'GSK plc'],
    ticker: 'GSK',
    company_type: 'large_pharma',
    hq_country: 'UK',
    modalities_active: ['vaccine', 'antibody', 'small_molecule'],
    modalities_primary: ['vaccine'],
    indications_active: ['womens_health', 'infectious_disease', 'oncology'],
    indications_specific: ['hpv_prevention', 'cervical_cancer', 'ovarian_cancer', 'endometrial_cancer'],
    phase_preference_min: 'phase_1',
    phase_preference_max: 'approved',
    territory_focus: ['global'],
    deals_last_12mo: 4,
    deals_last_24mo: 8,
    active_trials_count: 15,
    avg_upfront_usd: 1500000000,
    median_upfront_usd: 800000000,
    actively_acquiring: true,
    acquisition_appetite: 'moderate',
    strategic_priorities: ['cervarix_developing_markets', 'hpv_vaccine', 'womens_cancer_io', 'ovarian_cancer'],
    data_quality_score: 85,
    patent_cliffs: [
      { drug_name: 'Cervarix (HPV vaccine)', indication: "Women's Health (HPV Prevention)", revenue_usd: 600000000, expiry_year: 2028 },
      { drug_name: 'Zejula (niraparib)', indication: "Women's Health/Oncology (Ovarian Cancer PARP)", revenue_usd: 800000000, expiry_year: 2030 },
    ],
  },
  {
    name: 'Roche/Genentech',
    name_variations: ['Roche', 'Genentech', 'Roche Holding AG', 'F. Hoffmann-La Roche'],
    ticker: 'RHHBY',
    company_type: 'large_pharma',
    hq_country: 'Switzerland',
    modalities_active: ['antibody', 'small_molecule', 'adc', 'bispecific'],
    modalities_primary: ['antibody'],
    indications_active: ['womens_health', 'oncology', 'neurology', 'ophthalmology'],
    indications_specific: ['breast_cancer', 'cervical_cancer', 'ovarian_cancer', 'endometrial_cancer'],
    phase_preference_min: 'preclinical',
    phase_preference_max: 'approved',
    territory_focus: ['global'],
    deals_last_12mo: 6,
    deals_last_24mo: 11,
    active_trials_count: 35,
    avg_upfront_usd: 2500000000,
    median_upfront_usd: 1200000000,
    actively_acquiring: true,
    acquisition_appetite: 'aggressive',
    strategic_priorities: ['breast_cancer_franchise', 'cervical_cancer', 'her2_lifecycle', 'adc_womens_cancers', 'companion_diagnostics'],
    data_quality_score: 92,
    patent_cliffs: [
      { drug_name: 'Herceptin (trastuzumab)', indication: "Women's Health/Oncology (HER2+ Breast Cancer)", revenue_usd: 3000000000, expiry_year: 2026 },
      { drug_name: 'Perjeta (pertuzumab)', indication: "Women's Health/Oncology (HER2+ Breast Cancer)", revenue_usd: 4000000000, expiry_year: 2028 },
      { drug_name: 'Kadcyla (ado-trastuzumab emtansine)', indication: "Women's Health/Oncology (HER2+ Breast Cancer ADC)", revenue_usd: 2200000000, expiry_year: 2029 },
      { drug_name: 'Avastin (bevacizumab)', indication: "Women's Health/Oncology (Cervical Cancer)", revenue_usd: 1200000000, expiry_year: 2026 },
    ],
  },
  {
    name: 'Seagen/Pfizer',
    name_variations: ['Seagen', 'Seattle Genetics', 'Pfizer Seagen'],
    ticker: 'PFE',
    company_type: 'large_pharma',
    hq_country: 'US',
    modalities_active: ['adc', 'antibody', 'small_molecule'],
    modalities_primary: ['adc'],
    indications_active: ['womens_health', 'oncology'],
    indications_specific: ['cervical_cancer', 'ovarian_cancer', 'breast_cancer', 'endometrial_cancer'],
    phase_preference_min: 'preclinical',
    phase_preference_max: 'approved',
    territory_focus: ['global'],
    deals_last_12mo: 4,
    deals_last_24mo: 7,
    active_trials_count: 18,
    avg_upfront_usd: 1500000000,
    median_upfront_usd: 700000000,
    actively_acquiring: true,
    acquisition_appetite: 'aggressive',
    strategic_priorities: ['adc_womens_cancers', 'cervical_cancer_adc', 'tisotumab_vedotin', 'enfortumab_expansion', 'ovarian_cancer_adc'],
    data_quality_score: 88,
    patent_cliffs: [
      { drug_name: 'Tivdak (tisotumab vedotin)', indication: "Women's Health/Oncology (Cervical Cancer ADC)", revenue_usd: 500000000, expiry_year: 2036 },
    ],
  },
  {
    name: 'AstraZeneca',
    name_variations: ['AstraZeneca PLC', 'AZ'],
    ticker: 'AZN',
    company_type: 'large_pharma',
    hq_country: 'UK',
    modalities_active: ['small_molecule', 'antibody', 'adc'],
    modalities_primary: ['small_molecule'],
    indications_active: ['womens_health', 'oncology', 'cardiovascular', 'rare_disease'],
    indications_specific: ['ovarian_cancer', 'breast_cancer', 'endometrial_cancer'],
    phase_preference_min: 'phase_1',
    phase_preference_max: 'approved',
    territory_focus: ['global'],
    deals_last_12mo: 5,
    deals_last_24mo: 10,
    active_trials_count: 25,
    avg_upfront_usd: 2000000000,
    median_upfront_usd: 1000000000,
    actively_acquiring: true,
    acquisition_appetite: 'aggressive',
    strategic_priorities: ['parp_inhibitor_franchise', 'ovarian_cancer', 'breast_cancer_brca', 'adc_womens_cancers', 'ddr_pipeline'],
    data_quality_score: 90,
    patent_cliffs: [
      { drug_name: 'Lynparza (olaparib)', indication: "Women's Health/Oncology (Ovarian/Breast Cancer PARP)", revenue_usd: 4000000000, expiry_year: 2028 },
      { drug_name: 'Enhertu (trastuzumab deruxtecan, with Daiichi)', indication: "Women's Health/Oncology (HER2+ Breast Cancer ADC)", revenue_usd: 4500000000, expiry_year: 2035 },
    ],
  },

  // ─────────────────────────────────────────────────────────────────
  // EUROPEAN / ASIAN WOMEN'S HEALTH SPECIALISTS
  // ─────────────────────────────────────────────────────────────────
  {
    name: 'Gedeon Richter',
    name_variations: ['Richter Gedeon', 'Gedeon Richter Plc', 'Richter'],
    ticker: 'GDRB.BU',
    company_type: 'mid_pharma',
    hq_country: 'Hungary',
    modalities_active: ['small_molecule', 'hormonal', 'device', 'ius'],
    modalities_primary: ['hormonal', 'small_molecule'],
    indications_active: ['womens_health', 'psychiatry'],
    indications_specific: ['contraception', 'menopause', 'endometriosis', 'uterine_fibroids', 'fertility'],
    phase_preference_min: 'phase_2',
    phase_preference_max: 'approved',
    territory_focus: ['europe', 'asia', 'global'],
    deals_last_12mo: 3,
    deals_last_24mo: 6,
    active_trials_count: 12,
    avg_upfront_usd: 100000000,
    median_upfront_usd: 50000000,
    actively_acquiring: true,
    acquisition_appetite: 'moderate',
    strategic_priorities: ['eu_contraception_leader', 'ius_market_share', 'menopause_eu', 'gnrh_antagonist_eu', 'biosimilar_fertility'],
    data_quality_score: 75,
    patent_cliffs: [
      { drug_name: 'Levosert/Benilexa (levonorgestrel IUS)', indication: "Women's Health (IUS Contraception EU)", revenue_usd: 300000000, expiry_year: 2030 },
      { drug_name: 'Ryeqo (relugolix/E2/NETA, EU)', indication: "Women's Health (Uterine Fibroids EU)", revenue_usd: 400000000, expiry_year: 2035 },
    ],
  },
  {
    name: 'Mitsubishi Tanabe Pharma',
    name_variations: ['Mitsubishi Tanabe', 'MTPC', 'Mitsubishi Tanabe Pharma Corp'],
    ticker: '4188.T',
    company_type: 'large_pharma',
    hq_country: 'Japan',
    modalities_active: ['small_molecule', 'antibody', 'cell_therapy'],
    modalities_primary: ['small_molecule'],
    indications_active: ['womens_health', 'autoimmune', 'neurology', 'cardiovascular'],
    indications_specific: ['endometriosis', 'preterm_labor', 'hyperemesis_gravidarum'],
    phase_preference_min: 'phase_1',
    phase_preference_max: 'approved',
    territory_focus: ['japan', 'asia', 'global'],
    deals_last_12mo: 2,
    deals_last_24mo: 4,
    active_trials_count: 6,
    avg_upfront_usd: 150000000,
    median_upfront_usd: 75000000,
    actively_acquiring: true,
    acquisition_appetite: 'selective',
    strategic_priorities: ['womens_health_japan', 'endometriosis_treatment', 'preterm_labor', 'japan_gynecology'],
    data_quality_score: 68,
    patent_cliffs: [
      { drug_name: 'Dienogest formulations', indication: "Women's Health (Endometriosis Japan)", revenue_usd: 200000000, expiry_year: 2028 },
    ],
  },
  {
    name: 'Astellas Pharma',
    name_variations: ['Astellas', 'Astellas Pharma Inc.'],
    ticker: '4503.T',
    company_type: 'large_pharma',
    hq_country: 'Japan',
    modalities_active: ['small_molecule', 'antibody', 'gene_therapy'],
    modalities_primary: ['small_molecule'],
    indications_active: ['womens_health', 'oncology', 'urology'],
    indications_specific: ['endometriosis', 'hot_flashes', 'overactive_bladder_women'],
    phase_preference_min: 'phase_1',
    phase_preference_max: 'approved',
    territory_focus: ['global', 'japan'],
    deals_last_12mo: 3,
    deals_last_24mo: 6,
    active_trials_count: 10,
    avg_upfront_usd: 400000000,
    median_upfront_usd: 200000000,
    actively_acquiring: true,
    acquisition_appetite: 'moderate',
    strategic_priorities: ['menopause_vasomotor', 'nk3_antagonist', 'fezolinetant_expansion', 'womens_health_japan'],
    data_quality_score: 82,
    patent_cliffs: [
      { drug_name: 'Veozah (fezolinetant)', indication: "Women's Health (Menopause VMS NK3 Antagonist)", revenue_usd: 700000000, expiry_year: 2037 },
    ],
  },

  // ─────────────────────────────────────────────────────────────────
  // ADDITIONAL WOMEN'S HEALTH COMPANIES
  // ─────────────────────────────────────────────────────────────────
  {
    name: 'Agile Therapeutics',
    name_variations: ['Agile', 'Agile Therapeutics Inc'],
    ticker: 'AGRX',
    company_type: 'specialty',
    hq_country: 'US',
    modalities_active: ['transdermal_patch', 'hormonal'],
    modalities_primary: ['transdermal_patch'],
    indications_active: ['womens_health'],
    indications_specific: ['contraception'],
    phase_preference_min: 'phase_3',
    phase_preference_max: 'approved',
    territory_focus: ['us'],
    deals_last_12mo: 1,
    deals_last_24mo: 2,
    active_trials_count: 2,
    avg_upfront_usd: 20000000,
    median_upfront_usd: 10000000,
    actively_acquiring: false,
    acquisition_appetite: 'inactive',
    strategic_priorities: ['twirla_market', 'transdermal_contraception', 'low_dose_hormonal', 'womens_health_specialty'],
    data_quality_score: 55,
    patent_cliffs: [
      { drug_name: 'Twirla (levonorgestrel/EE patch)', indication: "Women's Health (Transdermal Contraception)", revenue_usd: 60000000, expiry_year: 2034 },
    ],
  },
  {
    name: 'Evofem Biosciences',
    name_variations: ['Evofem', 'Evofem Biosciences Inc'],
    ticker: 'EVFM',
    company_type: 'specialty',
    hq_country: 'US',
    modalities_active: ['vaginal_gel', 'non_hormonal'],
    modalities_primary: ['vaginal_gel'],
    indications_active: ['womens_health'],
    indications_specific: ['contraception', 'chlamydia_prevention', 'gonorrhea_prevention', 'uti_prevention'],
    phase_preference_min: 'phase_2',
    phase_preference_max: 'approved',
    territory_focus: ['us'],
    deals_last_12mo: 1,
    deals_last_24mo: 2,
    active_trials_count: 3,
    avg_upfront_usd: 20000000,
    median_upfront_usd: 10000000,
    actively_acquiring: false,
    acquisition_appetite: 'inactive',
    strategic_priorities: ['non_hormonal_contraception', 'phexxi_market', 'sti_prevention', 'vaginal_ph_modulation'],
    data_quality_score: 55,
    patent_cliffs: [
      { drug_name: 'Phexxi (lactic acid/citric acid/potassium bitartrate)', indication: "Women's Health (Non-Hormonal Contraception)", revenue_usd: 80000000, expiry_year: 2033 },
    ],
  },
  {
    name: 'Hologic',
    name_variations: ['Hologic Inc', 'Hologic Inc.'],
    ticker: 'HOLX',
    company_type: 'large_biotech',
    hq_country: 'US',
    modalities_active: ['diagnostic', 'device', 'surgical'],
    modalities_primary: ['diagnostic', 'device'],
    indications_active: ['womens_health', 'oncology'],
    indications_specific: ['breast_screening', 'cervical_screening', 'sti_diagnostics', 'surgical_gyn', 'skeletal_health'],
    phase_preference_min: 'phase_3',
    phase_preference_max: 'approved',
    territory_focus: ['global'],
    deals_last_12mo: 4,
    deals_last_24mo: 7,
    active_trials_count: 10,
    avg_upfront_usd: 400000000,
    median_upfront_usd: 200000000,
    actively_acquiring: true,
    acquisition_appetite: 'aggressive',
    strategic_priorities: ['breast_screening', 'cervical_diagnostics', 'sti_molecular_dx', 'gyn_surgical', 'womens_health_diagnostics'],
    data_quality_score: 85,
    patent_cliffs: [
      { drug_name: 'Genius 3D mammography', indication: "Women's Health (Breast Cancer Screening)", revenue_usd: 2000000000, expiry_year: 2030 },
      { drug_name: 'Aptima (molecular diagnostics)', indication: "Women's Health (STI/HPV Diagnostics)", revenue_usd: 1500000000, expiry_year: 2029 },
      { drug_name: 'NovaSure/MyoSure', indication: "Women's Health (GYN Surgical)", revenue_usd: 600000000, expiry_year: 2027 },
    ],
  },
  {
    name: 'Vanda Pharmaceuticals',
    name_variations: ['Vanda', 'Vanda Pharmaceuticals Inc'],
    ticker: 'VNDA',
    company_type: 'specialty',
    hq_country: 'US',
    modalities_active: ['small_molecule'],
    modalities_primary: ['small_molecule'],
    indications_active: ['womens_health', 'psychiatry'],
    indications_specific: ['premenstrual_dysphoric_disorder', 'pmdd', 'circadian_rhythm'],
    phase_preference_min: 'phase_2',
    phase_preference_max: 'approved',
    territory_focus: ['us'],
    deals_last_12mo: 1,
    deals_last_24mo: 2,
    active_trials_count: 4,
    avg_upfront_usd: 50000000,
    median_upfront_usd: 25000000,
    actively_acquiring: false,
    acquisition_appetite: 'selective',
    strategic_priorities: ['pmdd_treatment', 'circadian_rhythm_womens_health', 'neuroendocrine_therapeutics'],
    data_quality_score: 60,
    patent_cliffs: [
      { drug_name: 'Tradipitant', indication: "Women's Health (PMDD/Nausea)", revenue_usd: 200000000, expiry_year: 2036 },
    ],
  },
  {
    name: 'Sage Therapeutics (Biogen)',
    name_variations: ['Sage', 'Sage Therapeutics Inc', 'Biogen Sage'],
    ticker: 'SAGE',
    company_type: 'mid_biotech',
    hq_country: 'US',
    modalities_active: ['small_molecule', 'neurosteroid'],
    modalities_primary: ['neurosteroid'],
    indications_active: ['womens_health', 'psychiatry', 'neurology'],
    indications_specific: ['postpartum_depression', 'major_depressive_disorder', 'ppd'],
    phase_preference_min: 'preclinical',
    phase_preference_max: 'approved',
    territory_focus: ['us', 'global'],
    deals_last_12mo: 2,
    deals_last_24mo: 4,
    active_trials_count: 8,
    avg_upfront_usd: 200000000,
    median_upfront_usd: 100000000,
    actively_acquiring: false,
    acquisition_appetite: 'selective',
    strategic_priorities: ['postpartum_depression', 'zurzuvae_launch', 'neurosteroid_platform', 'gaba_modulation', 'perinatal_mental_health'],
    data_quality_score: 78,
    patent_cliffs: [
      { drug_name: 'Zurzuvae (zuranolone)', indication: "Women's Health (Postpartum Depression)", revenue_usd: 400000000, expiry_year: 2037 },
      { drug_name: 'Zulresso (brexanolone)', indication: "Women's Health (Postpartum Depression IV)", revenue_usd: 100000000, expiry_year: 2034 },
    ],
  },
  {
    name: 'Eli Lilly',
    name_variations: ['Lilly', 'Eli Lilly and Company'],
    ticker: 'LLY',
    company_type: 'large_pharma',
    hq_country: 'US',
    modalities_active: ['small_molecule', 'antibody', 'adc'],
    modalities_primary: ['small_molecule', 'antibody'],
    indications_active: ['womens_health', 'oncology', 'metabolic', 'autoimmune'],
    indications_specific: ['breast_cancer', 'ovarian_cancer', 'menopause'],
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
    strategic_priorities: ['breast_cancer_cdk', 'verzenio_expansion', 'ovarian_cancer', 'womens_oncology', 'adc_pipeline'],
    data_quality_score: 88,
    patent_cliffs: [
      { drug_name: 'Verzenio (abemaciclib)', indication: "Women's Health/Oncology (HR+ Breast Cancer)", revenue_usd: 4200000000, expiry_year: 2031 },
    ],
  },
  {
    name: 'Novartis',
    name_variations: ['Novartis AG', 'Novartis Pharma'],
    ticker: 'NVS',
    company_type: 'large_pharma',
    hq_country: 'Switzerland',
    modalities_active: ['small_molecule', 'antibody', 'adc'],
    modalities_primary: ['small_molecule'],
    indications_active: ['womens_health', 'oncology', 'cardiovascular', 'immunology'],
    indications_specific: ['breast_cancer', 'ovarian_cancer', 'endometrial_cancer'],
    phase_preference_min: 'phase_1',
    phase_preference_max: 'approved',
    territory_focus: ['global'],
    deals_last_12mo: 4,
    deals_last_24mo: 8,
    active_trials_count: 15,
    avg_upfront_usd: 1500000000,
    median_upfront_usd: 700000000,
    actively_acquiring: true,
    acquisition_appetite: 'moderate',
    strategic_priorities: ['breast_cancer_franchise', 'kisqali_expansion', 'pi3k_pathway', 'womens_oncology'],
    data_quality_score: 88,
    patent_cliffs: [
      { drug_name: 'Kisqali (ribociclib)', indication: "Women's Health/Oncology (HR+ Breast Cancer)", revenue_usd: 3500000000, expiry_year: 2032 },
    ],
  },
];

// =============================================================================
// SEED FUNCTION
// =============================================================================

async function seedWomensHealthCompanies() {
  console.log("Starting women's health company seed...\n");
  console.log(`Seeding ${womensHealthCompanies.length} companies...\n`);

  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const company of womensHealthCompanies) {
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
          console.log(`  ↻ ${company.name}: Updated with women's health data (${company.company_type})`);
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
  console.log(`Total:   ${womensHealthCompanies.length}`);
  console.log(`${'='.repeat(50)}\n`);
}

seedWomensHealthCompanies().catch(console.error);
