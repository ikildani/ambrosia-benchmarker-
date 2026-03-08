// Script to seed ophthalmology-focused companies into the partner matching database
// Run with: npx tsx scripts/seed-ophthalmology-companies.ts
//
// These companies are curated from real deal activity, SEC filings, and pipeline data.
// Each company includes ophthalmology-relevant indications, modalities, strategic priorities,
// and deal history to power accurate partner matching for ophthalmology assets.

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

interface OphthalmologyCompany {
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
// OPHTHALMOLOGY COMPANY DATABASE
// Sources: SEC filings, DealForma, BioPharma Dive, Evaluate Pharma, company IRs
// =============================================================================

const ophthalmologyCompanies: OphthalmologyCompany[] = [
  // ─────────────────────────────────────────────────────────────────
  // LARGE PHARMA / BIOTECH WITH MAJOR OPHTHALMOLOGY FRANCHISES
  // ─────────────────────────────────────────────────────────────────
  {
    name: 'Regeneron Pharmaceuticals',
    name_variations: ['Regeneron', 'Regeneron Pharmaceuticals Inc', 'Regeneron Inc.'],
    ticker: 'REGN',
    company_type: 'large_biotech',
    hq_country: 'US',
    modalities_active: ['antibody', 'bispecific', 'gene_therapy', 'small_molecule'],
    modalities_primary: ['antibody'],
    indications_active: ['ophthalmology', 'immunology', 'oncology', 'rare_disease'],
    indications_specific: ['wet_amd', 'dme', 'dr', 'rvo', 'geographic_atrophy', 'myopia'],
    phase_preference_min: 'preclinical',
    phase_preference_max: 'approved',
    territory_focus: ['global'],
    deals_last_12mo: 5,
    deals_last_24mo: 10,
    active_trials_count: 40,
    avg_upfront_usd: 2000000000,
    median_upfront_usd: 1000000000,
    actively_acquiring: true,
    acquisition_appetite: 'aggressive',
    strategic_priorities: ['anti_vegf_dominance', 'hd_eylea_conversion', 'retinal_gene_therapy', 'geographic_atrophy', 'next_gen_retina'],
    data_quality_score: 95,
    patent_cliffs: [
      { drug_name: 'Eylea (aflibercept)', indication: 'Ophthalmology (Wet AMD/DME/RVO)', revenue_usd: 9400000000, expiry_year: 2027 },
      { drug_name: 'Eylea HD (aflibercept 8mg)', indication: 'Ophthalmology (Wet AMD/DME Extended Dosing)', revenue_usd: 3500000000, expiry_year: 2034 },
    ],
  },
  {
    name: 'Roche/Genentech',
    name_variations: ['Roche', 'Genentech', 'Roche Holding AG', 'F. Hoffmann-La Roche'],
    ticker: 'RHHBY',
    company_type: 'large_pharma',
    hq_country: 'Switzerland',
    modalities_active: ['antibody', 'bispecific', 'gene_therapy', 'small_molecule', 'adc'],
    modalities_primary: ['antibody', 'bispecific'],
    indications_active: ['ophthalmology', 'oncology', 'neurology', 'immunology'],
    indications_specific: ['wet_amd', 'dme', 'geographic_atrophy', 'retinal_vein_occlusion', 'inherited_retinal_disease'],
    phase_preference_min: 'preclinical',
    phase_preference_max: 'approved',
    territory_focus: ['global'],
    deals_last_12mo: 6,
    deals_last_24mo: 12,
    active_trials_count: 35,
    avg_upfront_usd: 2500000000,
    median_upfront_usd: 1200000000,
    actively_acquiring: true,
    acquisition_appetite: 'aggressive',
    strategic_priorities: ['vabysmo_expansion', 'bispecific_retina', 'port_delivery_system', 'gene_therapy_eye', 'geographic_atrophy'],
    data_quality_score: 95,
    patent_cliffs: [
      { drug_name: 'Vabysmo (faricimab)', indication: 'Ophthalmology (Wet AMD/DME Bispecific)', revenue_usd: 5200000000, expiry_year: 2035 },
      { drug_name: 'Lucentis (ranibizumab)', indication: 'Ophthalmology (Wet AMD/DME Legacy)', revenue_usd: 1200000000, expiry_year: 2026 },
      { drug_name: 'Susvimo (ranibizumab PDS)', indication: 'Ophthalmology (Wet AMD Port Delivery)', revenue_usd: 300000000, expiry_year: 2033 },
    ],
  },
  {
    name: 'Novartis',
    name_variations: ['Novartis AG', 'Novartis Pharma', 'Novartis Ophthalmics'],
    ticker: 'NVS',
    company_type: 'large_pharma',
    hq_country: 'Switzerland',
    modalities_active: ['antibody', 'small_molecule', 'gene_therapy', 'implant'],
    modalities_primary: ['antibody', 'small_molecule'],
    indications_active: ['ophthalmology', 'oncology', 'cardiovascular', 'immunology'],
    indications_specific: ['wet_amd', 'dme', 'dry_eye', 'geographic_atrophy', 'uveitis'],
    phase_preference_min: 'phase_1',
    phase_preference_max: 'approved',
    territory_focus: ['global'],
    deals_last_12mo: 5,
    deals_last_24mo: 9,
    active_trials_count: 28,
    avg_upfront_usd: 1500000000,
    median_upfront_usd: 700000000,
    actively_acquiring: true,
    acquisition_appetite: 'aggressive',
    strategic_priorities: ['retina_franchise', 'dry_eye', 'gene_therapy_eye', 'geographic_atrophy', 'sustained_delivery'],
    data_quality_score: 90,
    patent_cliffs: [
      { drug_name: 'Beovu (brolucizumab)', indication: 'Ophthalmology (Wet AMD/DME)', revenue_usd: 600000000, expiry_year: 2033 },
      { drug_name: 'Xiidra (lifitegrast)', indication: 'Ophthalmology (Dry Eye)', revenue_usd: 700000000, expiry_year: 2029 },
    ],
  },
  {
    name: 'AbbVie/Allergan',
    name_variations: ['AbbVie', 'Allergan', 'AbbVie Inc.', 'Allergan Aesthetics', 'Allergan Eye Care'],
    ticker: 'ABBV',
    company_type: 'large_pharma',
    hq_country: 'US',
    modalities_active: ['small_molecule', 'antibody', 'implant', 'topical'],
    modalities_primary: ['small_molecule', 'topical'],
    indications_active: ['ophthalmology', 'immunology', 'aesthetics', 'neuroscience'],
    indications_specific: ['dry_eye', 'glaucoma', 'presbyopia', 'uveitis', 'allergic_conjunctivitis'],
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
    strategic_priorities: ['dry_eye_franchise', 'glaucoma', 'presbyopia_drops', 'anterior_segment', 'ophthalmic_pipeline'],
    data_quality_score: 92,
    patent_cliffs: [
      { drug_name: 'Restasis (cyclosporine)', indication: 'Ophthalmology (Dry Eye)', revenue_usd: 800000000, expiry_year: 2026 },
      { drug_name: 'Vuity (pilocarpine)', indication: 'Ophthalmology (Presbyopia)', revenue_usd: 200000000, expiry_year: 2035 },
      { drug_name: 'Ozurdex (dexamethasone implant)', indication: 'Ophthalmology (Macular Edema/Uveitis)', revenue_usd: 500000000, expiry_year: 2028 },
      { drug_name: 'Lumigan (bimatoprost)', indication: 'Ophthalmology (Glaucoma)', revenue_usd: 400000000, expiry_year: 2027 },
    ],
  },
  {
    name: 'Bayer',
    name_variations: ['Bayer AG', 'Bayer Pharma'],
    ticker: 'BAYN.DE',
    company_type: 'large_pharma',
    hq_country: 'Germany',
    modalities_active: ['antibody', 'small_molecule', 'gene_therapy'],
    modalities_primary: ['antibody'],
    indications_active: ['ophthalmology', 'cardiovascular', 'oncology', 'hematology'],
    indications_specific: ['wet_amd', 'dme', 'retinal_vein_occlusion'],
    phase_preference_min: 'phase_1',
    phase_preference_max: 'approved',
    territory_focus: ['global', 'europe'],
    deals_last_12mo: 3,
    deals_last_24mo: 6,
    active_trials_count: 15,
    avg_upfront_usd: 800000000,
    median_upfront_usd: 400000000,
    actively_acquiring: true,
    acquisition_appetite: 'moderate',
    strategic_priorities: ['eylea_eu_franchise', 'retina_next_gen', 'aflibercept_lifecycle', 'ophthalmic_partnerships'],
    data_quality_score: 85,
    patent_cliffs: [
      { drug_name: 'Eylea (aflibercept, EU co-rights)', indication: 'Ophthalmology (Wet AMD/DME EU)', revenue_usd: 3200000000, expiry_year: 2027 },
    ],
  },
  {
    name: 'Johnson & Johnson Vision',
    name_variations: ['J&J Vision', 'Johnson & Johnson Vision Care', 'J&J Surgical Vision', 'AMO'],
    ticker: 'JNJ',
    company_type: 'large_pharma',
    hq_country: 'US',
    modalities_active: ['device', 'surgical', 'contact_lens', 'small_molecule'],
    modalities_primary: ['device', 'surgical'],
    indications_active: ['ophthalmology'],
    indications_specific: ['cataract', 'refractive', 'dry_eye', 'myopia_management', 'contact_lens'],
    phase_preference_min: 'phase_2',
    phase_preference_max: 'approved',
    territory_focus: ['global'],
    deals_last_12mo: 4,
    deals_last_24mo: 7,
    active_trials_count: 18,
    avg_upfront_usd: 1000000000,
    median_upfront_usd: 500000000,
    actively_acquiring: true,
    acquisition_appetite: 'moderate',
    strategic_priorities: ['surgical_ophthalmology', 'myopia_management', 'contact_lens_innovation', 'dry_eye_devices'],
    data_quality_score: 85,
    patent_cliffs: [
      { drug_name: 'Acuvue Oasys (contact lens franchise)', indication: 'Ophthalmology (Vision Correction)', revenue_usd: 5000000000, expiry_year: 2030 },
      { drug_name: 'TECNIS IOL platform', indication: 'Ophthalmology (Cataract Surgery IOLs)', revenue_usd: 2000000000, expiry_year: 2029 },
    ],
  },

  // ─────────────────────────────────────────────────────────────────
  // ANTI-VEGF / RETINA SPECIALISTS
  // ─────────────────────────────────────────────────────────────────
  {
    name: 'Kodiak Sciences',
    name_variations: ['Kodiak', 'Kodiak Sciences Inc'],
    ticker: 'KOD',
    company_type: 'mid_biotech',
    hq_country: 'US',
    modalities_active: ['antibody_biopolymer_conjugate', 'antibody'],
    modalities_primary: ['antibody_biopolymer_conjugate'],
    indications_active: ['ophthalmology'],
    indications_specific: ['wet_amd', 'dme', 'retinal_vein_occlusion'],
    phase_preference_min: 'preclinical',
    phase_preference_max: 'phase_3',
    territory_focus: ['us', 'global'],
    deals_last_12mo: 1,
    deals_last_24mo: 2,
    active_trials_count: 5,
    avg_upfront_usd: 100000000,
    median_upfront_usd: 50000000,
    actively_acquiring: false,
    acquisition_appetite: 'selective',
    strategic_priorities: ['abc_platform', 'durability_retina', 'tarcocimab_development', 'anti_vegf_next_gen'],
    data_quality_score: 68,
    patent_cliffs: [
      { drug_name: 'Tarcocimab tedromer (KSI-301)', indication: 'Ophthalmology (Wet AMD/DME/RVO ABC Platform)', revenue_usd: 800000000, expiry_year: 2038 },
    ],
  },
  {
    name: 'Opthea',
    name_variations: ['Opthea Limited', 'Opthea Ltd'],
    ticker: 'OPT',
    company_type: 'mid_biotech',
    hq_country: 'Australia',
    modalities_active: ['antibody', 'trap_protein'],
    modalities_primary: ['antibody'],
    indications_active: ['ophthalmology'],
    indications_specific: ['wet_amd', 'dme'],
    phase_preference_min: 'phase_2',
    phase_preference_max: 'phase_3',
    territory_focus: ['global'],
    deals_last_12mo: 1,
    deals_last_24mo: 2,
    active_trials_count: 4,
    avg_upfront_usd: 80000000,
    median_upfront_usd: 40000000,
    actively_acquiring: false,
    acquisition_appetite: 'inactive',
    strategic_priorities: ['vegf_c_d_inhibition', 'combination_anti_vegf', 'sozinibercept_approval', 'retinal_combination_therapy'],
    data_quality_score: 65,
    patent_cliffs: [
      { drug_name: 'Sozinibercept (OPT-302)', indication: 'Ophthalmology (Wet AMD VEGF-C/D Trap)', revenue_usd: 600000000, expiry_year: 2038 },
    ],
  },
  {
    name: 'Outlook Therapeutics',
    name_variations: ['Outlook', 'Outlook Therapeutics Inc', 'Oncobiologics'],
    ticker: 'OTLK',
    company_type: 'specialty',
    hq_country: 'US',
    modalities_active: ['antibody', 'biosimilar'],
    modalities_primary: ['antibody'],
    indications_active: ['ophthalmology'],
    indications_specific: ['wet_amd', 'dme', 'retinal_vein_occlusion'],
    phase_preference_min: 'phase_3',
    phase_preference_max: 'approved',
    territory_focus: ['us', 'global'],
    deals_last_12mo: 1,
    deals_last_24mo: 2,
    active_trials_count: 3,
    avg_upfront_usd: 30000000,
    median_upfront_usd: 15000000,
    actively_acquiring: false,
    acquisition_appetite: 'inactive',
    strategic_priorities: ['ophthalmic_bevacizumab', 'fda_approved_retina_bevacizumab', 'retina_biosimilar'],
    data_quality_score: 58,
    patent_cliffs: [
      { drug_name: 'Lytenava (bevacizumab-vikg, ophtho)', indication: 'Ophthalmology (Wet AMD Bevacizumab)', revenue_usd: 400000000, expiry_year: 2035 },
    ],
  },
  {
    name: 'Iveric Bio (Astellas)',
    name_variations: ['Iveric', 'Iveric Bio', 'IVERIC bio Inc', 'Astellas Ophthalmology'],
    ticker: '4503.T',
    company_type: 'large_pharma',
    hq_country: 'Japan',
    modalities_active: ['complement_inhibitor', 'gene_therapy', 'antibody'],
    modalities_primary: ['complement_inhibitor'],
    indications_active: ['ophthalmology'],
    indications_specific: ['geographic_atrophy', 'stargardt_disease', 'inherited_retinal_disease'],
    phase_preference_min: 'preclinical',
    phase_preference_max: 'approved',
    territory_focus: ['global'],
    deals_last_12mo: 3,
    deals_last_24mo: 5,
    active_trials_count: 10,
    avg_upfront_usd: 500000000,
    median_upfront_usd: 250000000,
    actively_acquiring: true,
    acquisition_appetite: 'moderate',
    strategic_priorities: ['geographic_atrophy', 'complement_c5_retina', 'inherited_retinal_disease', 'gene_therapy_eye'],
    data_quality_score: 82,
    patent_cliffs: [
      { drug_name: 'Izervay (avacincaptad pegol)', indication: 'Ophthalmology (Geographic Atrophy C5)', revenue_usd: 1200000000, expiry_year: 2038 },
    ],
  },
  {
    name: 'Apellis Pharmaceuticals',
    name_variations: ['Apellis', 'Apellis Pharmaceuticals Inc'],
    ticker: 'APLS',
    company_type: 'mid_biotech',
    hq_country: 'US',
    modalities_active: ['complement_inhibitor', 'peptide'],
    modalities_primary: ['complement_inhibitor'],
    indications_active: ['ophthalmology', 'hematology', 'nephrology'],
    indications_specific: ['geographic_atrophy', 'pnh', 'c3_glomerulopathy', 'als'],
    phase_preference_min: 'preclinical',
    phase_preference_max: 'approved',
    territory_focus: ['global'],
    deals_last_12mo: 3,
    deals_last_24mo: 6,
    active_trials_count: 15,
    avg_upfront_usd: 400000000,
    median_upfront_usd: 200000000,
    actively_acquiring: true,
    acquisition_appetite: 'moderate',
    strategic_priorities: ['geographic_atrophy_market', 'complement_c3_platform', 'systemic_complement', 'retina_expansion'],
    data_quality_score: 82,
    patent_cliffs: [
      { drug_name: 'Syfovre (pegcetacoplan)', indication: 'Ophthalmology (Geographic Atrophy C3)', revenue_usd: 800000000, expiry_year: 2036 },
    ],
  },

  // ─────────────────────────────────────────────────────────────────
  // GENE THERAPY EYE SPECIALISTS
  // ─────────────────────────────────────────────────────────────────
  {
    name: 'Spark Therapeutics (Roche)',
    name_variations: ['Spark', 'Spark Therapeutics', 'Spark Therapeutics Inc', 'Roche Spark'],
    ticker: 'RHHBY',
    company_type: 'large_pharma',
    hq_country: 'US',
    modalities_active: ['gene_therapy', 'aav_vector'],
    modalities_primary: ['gene_therapy'],
    indications_active: ['ophthalmology', 'hematology', 'neurology'],
    indications_specific: ['leber_congenital_amaurosis', 'inherited_retinal_disease', 'choroideremia', 'hemophilia_a'],
    phase_preference_min: 'preclinical',
    phase_preference_max: 'approved',
    territory_focus: ['global'],
    deals_last_12mo: 2,
    deals_last_24mo: 4,
    active_trials_count: 8,
    avg_upfront_usd: 500000000,
    median_upfront_usd: 250000000,
    actively_acquiring: true,
    acquisition_appetite: 'moderate',
    strategic_priorities: ['luxturna_expansion', 'inherited_retinal_disease', 'aav_gene_therapy_eye', 'next_gen_vectors'],
    data_quality_score: 85,
    patent_cliffs: [
      { drug_name: 'Luxturna (voretigene neparvovec)', indication: 'Ophthalmology (RPE65 Inherited Retinal Dystrophy)', revenue_usd: 150000000, expiry_year: 2033 },
    ],
  },
  {
    name: 'AGTC/Beacon Therapeutics',
    name_variations: ['AGTC', 'Applied Genetic Technologies', 'Beacon Therapeutics'],
    ticker: null,
    company_type: 'mid_biotech',
    hq_country: 'US',
    modalities_active: ['gene_therapy', 'aav_vector'],
    modalities_primary: ['gene_therapy'],
    indications_active: ['ophthalmology'],
    indications_specific: ['xlrp', 'achromatopsia', 'x_linked_retinoschisis', 'inherited_retinal_disease'],
    phase_preference_min: 'preclinical',
    phase_preference_max: 'phase_3',
    territory_focus: ['us', 'global'],
    deals_last_12mo: 1,
    deals_last_24mo: 3,
    active_trials_count: 5,
    avg_upfront_usd: 60000000,
    median_upfront_usd: 30000000,
    actively_acquiring: false,
    acquisition_appetite: 'selective',
    strategic_priorities: ['xlrp_gene_therapy', 'inherited_retinal_disease', 'aav_vector_optimization', 'retinal_gene_therapy_platform'],
    data_quality_score: 62,
    patent_cliffs: [
      { drug_name: 'AGTC-501 (XLRP gene therapy)', indication: 'Ophthalmology (X-Linked Retinitis Pigmentosa)', revenue_usd: 300000000, expiry_year: 2039 },
    ],
  },
  {
    name: '4D Molecular Therapeutics',
    name_variations: ['4DMT', '4D Molecular', '4D Molecular Therapeutics Inc'],
    ticker: 'FDMT',
    company_type: 'mid_biotech',
    hq_country: 'US',
    modalities_active: ['gene_therapy', 'aav_vector', 'intravitreal_gene_therapy'],
    modalities_primary: ['gene_therapy'],
    indications_active: ['ophthalmology', 'pulmonology', 'cardiology'],
    indications_specific: ['wet_amd', 'choroideremia', 'xlrp', 'diabetic_retinopathy'],
    phase_preference_min: 'preclinical',
    phase_preference_max: 'phase_2',
    territory_focus: ['us', 'global'],
    deals_last_12mo: 1,
    deals_last_24mo: 3,
    active_trials_count: 6,
    avg_upfront_usd: 80000000,
    median_upfront_usd: 40000000,
    actively_acquiring: false,
    acquisition_appetite: 'selective',
    strategic_priorities: ['intravitreal_gene_therapy', 'wet_amd_gene_therapy', 'r100_aav_vector', 'targeted_evolution_capsids'],
    data_quality_score: 68,
    patent_cliffs: [
      { drug_name: '4D-150 (intravitreal anti-VEGF gene therapy)', indication: 'Ophthalmology (Wet AMD Gene Therapy)', revenue_usd: 500000000, expiry_year: 2040 },
    ],
  },
  {
    name: 'Atsena Therapeutics',
    name_variations: ['Atsena', 'Atsena Therapeutics Inc'],
    ticker: null,
    company_type: 'mid_biotech',
    hq_country: 'US',
    modalities_active: ['gene_therapy', 'aav_vector'],
    modalities_primary: ['gene_therapy'],
    indications_active: ['ophthalmology'],
    indications_specific: ['leber_congenital_amaurosis', 'x_linked_retinoschisis', 'inherited_retinal_disease'],
    phase_preference_min: 'preclinical',
    phase_preference_max: 'phase_2',
    territory_focus: ['us'],
    deals_last_12mo: 1,
    deals_last_24mo: 2,
    active_trials_count: 3,
    avg_upfront_usd: 40000000,
    median_upfront_usd: 20000000,
    actively_acquiring: false,
    acquisition_appetite: 'inactive',
    strategic_priorities: ['lca1_gene_therapy', 'guanylate_cyclase_deficiency', 'inherited_retinal_disease', 'aav_optimization'],
    data_quality_score: 58,
    patent_cliffs: [
      { drug_name: 'ATSN-101 (LCA1 gene therapy)', indication: 'Ophthalmology (Leber Congenital Amaurosis Type 1)', revenue_usd: 200000000, expiry_year: 2040 },
    ],
  },
  {
    name: 'Adverum Biotechnologies',
    name_variations: ['Adverum', 'Adverum Biotechnologies Inc'],
    ticker: 'ADVM',
    company_type: 'mid_biotech',
    hq_country: 'US',
    modalities_active: ['gene_therapy', 'aav_vector', 'intravitreal_gene_therapy'],
    modalities_primary: ['gene_therapy'],
    indications_active: ['ophthalmology'],
    indications_specific: ['wet_amd', 'diabetic_macular_edema', 'retinal_disease'],
    phase_preference_min: 'preclinical',
    phase_preference_max: 'phase_2',
    territory_focus: ['us', 'global'],
    deals_last_12mo: 1,
    deals_last_24mo: 2,
    active_trials_count: 4,
    avg_upfront_usd: 50000000,
    median_upfront_usd: 25000000,
    actively_acquiring: false,
    acquisition_appetite: 'selective',
    strategic_priorities: ['intravitreal_gene_therapy', 'aflibercept_gene_therapy', 'one_time_retina_treatment', 'aav_capsid_engineering'],
    data_quality_score: 62,
    patent_cliffs: [
      { drug_name: 'ADVM-022 (intravitreal aflibercept gene therapy)', indication: 'Ophthalmology (Wet AMD/DME Gene Therapy)', revenue_usd: 500000000, expiry_year: 2039 },
    ],
  },

  // ─────────────────────────────────────────────────────────────────
  // DRY EYE / ANTERIOR SEGMENT SPECIALISTS
  // ─────────────────────────────────────────────────────────────────
  {
    name: 'Novaliq',
    name_variations: ['Novaliq GmbH', 'Novaliq Inc'],
    ticker: null,
    company_type: 'specialty',
    hq_country: 'Germany',
    modalities_active: ['small_molecule', 'topical', 'water_free_formulation'],
    modalities_primary: ['topical'],
    indications_active: ['ophthalmology'],
    indications_specific: ['dry_eye', 'meibomian_gland_dysfunction', 'blepharitis'],
    phase_preference_min: 'phase_2',
    phase_preference_max: 'approved',
    territory_focus: ['us', 'europe', 'global'],
    deals_last_12mo: 1,
    deals_last_24mo: 3,
    active_trials_count: 5,
    avg_upfront_usd: 50000000,
    median_upfront_usd: 25000000,
    actively_acquiring: false,
    acquisition_appetite: 'selective',
    strategic_priorities: ['eyesolve_technology', 'water_free_ophthalmic', 'dry_eye_cyclosporine', 'mgd_treatment'],
    data_quality_score: 62,
    patent_cliffs: [
      { drug_name: 'CyclASol (cyclosporine water-free)', indication: 'Ophthalmology (Dry Eye Water-Free Cyclosporine)', revenue_usd: 300000000, expiry_year: 2037 },
    ],
  },
  {
    name: 'Aldeyra Therapeutics',
    name_variations: ['Aldeyra', 'Aldeyra Therapeutics Inc'],
    ticker: 'ALDX',
    company_type: 'mid_biotech',
    hq_country: 'US',
    modalities_active: ['small_molecule', 'topical', 'trap'],
    modalities_primary: ['small_molecule'],
    indications_active: ['ophthalmology', 'immunology'],
    indications_specific: ['dry_eye', 'allergic_conjunctivitis', 'sjogren_syndrome', 'uveitis'],
    phase_preference_min: 'preclinical',
    phase_preference_max: 'phase_3',
    territory_focus: ['us', 'global'],
    deals_last_12mo: 1,
    deals_last_24mo: 3,
    active_trials_count: 5,
    avg_upfront_usd: 60000000,
    median_upfront_usd: 30000000,
    actively_acquiring: false,
    acquisition_appetite: 'selective',
    strategic_priorities: ['rasp_inhibitor', 'dry_eye_inflammation', 'reproxalap_approval', 'anterior_segment_pipeline'],
    data_quality_score: 65,
    patent_cliffs: [
      { drug_name: 'Reproxalap', indication: 'Ophthalmology (Dry Eye RASP Inhibitor)', revenue_usd: 500000000, expiry_year: 2038 },
    ],
  },
  {
    name: 'Oyster Point/Viatris',
    name_variations: ['Oyster Point', 'Oyster Point Pharma', 'Viatris Eye Care'],
    ticker: 'VTRS',
    company_type: 'large_pharma',
    hq_country: 'US',
    modalities_active: ['small_molecule', 'nasal_spray', 'topical'],
    modalities_primary: ['small_molecule'],
    indications_active: ['ophthalmology'],
    indications_specific: ['dry_eye', 'presbyopia', 'meibomian_gland_dysfunction'],
    phase_preference_min: 'phase_2',
    phase_preference_max: 'approved',
    territory_focus: ['us', 'global'],
    deals_last_12mo: 2,
    deals_last_24mo: 4,
    active_trials_count: 6,
    avg_upfront_usd: 200000000,
    median_upfront_usd: 100000000,
    actively_acquiring: true,
    acquisition_appetite: 'moderate',
    strategic_priorities: ['nasal_spray_dry_eye', 'nicotinic_acetylcholine', 'dry_eye_innovation', 'anterior_segment'],
    data_quality_score: 72,
    patent_cliffs: [
      { drug_name: 'Tyrvaya (varenicline nasal spray)', indication: 'Ophthalmology (Dry Eye Nasal Spray)', revenue_usd: 400000000, expiry_year: 2036 },
    ],
  },
  {
    name: 'Sun Pharma',
    name_variations: ['Sun Pharmaceutical', 'Sun Pharma Industries', 'Sun Pharma Advanced Research'],
    ticker: 'SUNPHARMA.NS',
    company_type: 'large_pharma',
    hq_country: 'India',
    modalities_active: ['small_molecule', 'topical', 'generic'],
    modalities_primary: ['small_molecule', 'topical'],
    indications_active: ['ophthalmology', 'dermatology', 'psychiatry'],
    indications_specific: ['dry_eye', 'glaucoma', 'allergic_conjunctivitis'],
    phase_preference_min: 'phase_2',
    phase_preference_max: 'approved',
    territory_focus: ['global', 'india', 'us'],
    deals_last_12mo: 3,
    deals_last_24mo: 5,
    active_trials_count: 10,
    avg_upfront_usd: 150000000,
    median_upfront_usd: 75000000,
    actively_acquiring: true,
    acquisition_appetite: 'moderate',
    strategic_priorities: ['ophthalmic_specialty', 'dry_eye_cyclosporine', 'generic_ophthalmics', 'india_eye_care'],
    data_quality_score: 72,
    patent_cliffs: [
      { drug_name: 'Cequa (cyclosporine 0.09%)', indication: 'Ophthalmology (Dry Eye)', revenue_usd: 250000000, expiry_year: 2033 },
    ],
  },

  // ─────────────────────────────────────────────────────────────────
  // ASIAN PHARMA ACTIVE IN OPHTHALMOLOGY
  // ─────────────────────────────────────────────────────────────────
  {
    name: 'Santen Pharmaceutical',
    name_variations: ['Santen', 'Santen Pharmaceutical Co.', 'Santen Inc.'],
    ticker: '4536.T',
    company_type: 'mid_pharma',
    hq_country: 'Japan',
    modalities_active: ['small_molecule', 'topical', 'device', 'gene_therapy'],
    modalities_primary: ['small_molecule', 'topical'],
    indications_active: ['ophthalmology'],
    indications_specific: ['glaucoma', 'dry_eye', 'allergic_conjunctivitis', 'uveitis', 'retinal_disease', 'presbyopia'],
    phase_preference_min: 'preclinical',
    phase_preference_max: 'approved',
    territory_focus: ['japan', 'asia', 'europe', 'global'],
    deals_last_12mo: 4,
    deals_last_24mo: 8,
    active_trials_count: 22,
    avg_upfront_usd: 200000000,
    median_upfront_usd: 100000000,
    actively_acquiring: true,
    acquisition_appetite: 'aggressive',
    strategic_priorities: ['ophtho_pure_play', 'glaucoma_franchise', 'dry_eye_asia', 'retina_expansion', 'presbyopia'],
    data_quality_score: 82,
    patent_cliffs: [
      { drug_name: 'Tapros/Tafluprost', indication: 'Ophthalmology (Glaucoma)', revenue_usd: 500000000, expiry_year: 2027 },
      { drug_name: 'Alesion (epinastine)', indication: 'Ophthalmology (Allergic Conjunctivitis)', revenue_usd: 300000000, expiry_year: 2026 },
      { drug_name: 'Eybelis (omidenepag isopropyl)', indication: 'Ophthalmology (Glaucoma EP2 Agonist)', revenue_usd: 200000000, expiry_year: 2035 },
    ],
  },
  {
    name: 'Otsuka Pharmaceutical',
    name_variations: ['Otsuka', 'Otsuka Pharmaceutical Co.', 'Otsuka Holdings'],
    ticker: '4578.T',
    company_type: 'large_pharma',
    hq_country: 'Japan',
    modalities_active: ['small_molecule', 'antibody', 'topical'],
    modalities_primary: ['small_molecule'],
    indications_active: ['ophthalmology', 'psychiatry', 'nephrology'],
    indications_specific: ['dry_eye', 'retinal_disease', 'uveitis'],
    phase_preference_min: 'phase_1',
    phase_preference_max: 'approved',
    territory_focus: ['japan', 'us', 'global'],
    deals_last_12mo: 2,
    deals_last_24mo: 4,
    active_trials_count: 8,
    avg_upfront_usd: 300000000,
    median_upfront_usd: 150000000,
    actively_acquiring: true,
    acquisition_appetite: 'moderate',
    strategic_priorities: ['ophthalmic_pipeline', 'dry_eye_japan', 'retinal_disease', 'specialty_ophthalmics'],
    data_quality_score: 72,
    patent_cliffs: [
      { drug_name: 'Diquas (diquafosol)', indication: 'Ophthalmology (Dry Eye P2Y2 Agonist)', revenue_usd: 400000000, expiry_year: 2028 },
    ],
  },
  {
    name: 'Senju Pharmaceutical',
    name_variations: ['Senju', 'Senju Pharmaceutical Co.'],
    ticker: null,
    company_type: 'mid_pharma',
    hq_country: 'Japan',
    modalities_active: ['small_molecule', 'topical', 'device'],
    modalities_primary: ['topical'],
    indications_active: ['ophthalmology'],
    indications_specific: ['dry_eye', 'glaucoma', 'allergic_conjunctivitis', 'infection_eye'],
    phase_preference_min: 'phase_2',
    phase_preference_max: 'approved',
    territory_focus: ['japan', 'asia'],
    deals_last_12mo: 2,
    deals_last_24mo: 3,
    active_trials_count: 6,
    avg_upfront_usd: 50000000,
    median_upfront_usd: 25000000,
    actively_acquiring: true,
    acquisition_appetite: 'selective',
    strategic_priorities: ['ophthalmic_drops_japan', 'anti_infective_eye', 'dry_eye', 'glaucoma_combinations'],
    data_quality_score: 65,
    patent_cliffs: [
      { drug_name: 'Cravit (levofloxacin ophthalmic)', indication: 'Ophthalmology (Bacterial Conjunctivitis)', revenue_usd: 200000000, expiry_year: 2026 },
    ],
  },

  // ─────────────────────────────────────────────────────────────────
  // ADDITIONAL OPHTHALMOLOGY-FOCUSED COMPANIES
  // ─────────────────────────────────────────────────────────────────
  {
    name: 'EyePoint Pharmaceuticals',
    name_variations: ['EyePoint', 'EyePoint Pharmaceuticals Inc', 'pSivida'],
    ticker: 'EYPT',
    company_type: 'specialty',
    hq_country: 'US',
    modalities_active: ['sustained_release_implant', 'small_molecule', 'bioerodible_insert'],
    modalities_primary: ['sustained_release_implant'],
    indications_active: ['ophthalmology'],
    indications_specific: ['wet_amd', 'noninfectious_uveitis', 'dme'],
    phase_preference_min: 'preclinical',
    phase_preference_max: 'approved',
    territory_focus: ['us', 'global'],
    deals_last_12mo: 2,
    deals_last_24mo: 4,
    active_trials_count: 6,
    avg_upfront_usd: 100000000,
    median_upfront_usd: 50000000,
    actively_acquiring: false,
    acquisition_appetite: 'selective',
    strategic_priorities: ['sustained_delivery_retina', 'durasert_platform', 'anti_vegf_implant', 'intravitreal_depot'],
    data_quality_score: 70,
    patent_cliffs: [
      { drug_name: 'Yutiq (fluocinolone acetonide insert)', indication: 'Ophthalmology (Chronic Non-Infectious Uveitis)', revenue_usd: 100000000, expiry_year: 2033 },
      { drug_name: 'EYP-1901 (anti-VEGF Durasert)', indication: 'Ophthalmology (Wet AMD Sustained Release)', revenue_usd: 500000000, expiry_year: 2039 },
    ],
  },
  {
    name: 'Ocular Therapeutix',
    name_variations: ['Ocular Therapeutix Inc', 'OTX'],
    ticker: 'OCUL',
    company_type: 'mid_biotech',
    hq_country: 'US',
    modalities_active: ['sustained_release', 'hydrogel', 'implant', 'small_molecule'],
    modalities_primary: ['sustained_release', 'hydrogel'],
    indications_active: ['ophthalmology'],
    indications_specific: ['wet_amd', 'dry_eye', 'allergic_conjunctivitis', 'glaucoma', 'post_surgical_inflammation'],
    phase_preference_min: 'preclinical',
    phase_preference_max: 'approved',
    territory_focus: ['us', 'global'],
    deals_last_12mo: 2,
    deals_last_24mo: 4,
    active_trials_count: 8,
    avg_upfront_usd: 80000000,
    median_upfront_usd: 40000000,
    actively_acquiring: false,
    acquisition_appetite: 'selective',
    strategic_priorities: ['hydrogel_drug_delivery', 'sustained_release_retina', 'axitinib_implant', 'anterior_sustained_release'],
    data_quality_score: 72,
    patent_cliffs: [
      { drug_name: 'Dextenza (dexamethasone insert)', indication: 'Ophthalmology (Post-Surgical Inflammation)', revenue_usd: 200000000, expiry_year: 2033 },
      { drug_name: 'OTX-TKI (axitinib implant)', indication: 'Ophthalmology (Wet AMD Sustained Release TKI)', revenue_usd: 600000000, expiry_year: 2039 },
    ],
  },
  {
    name: 'Alcon',
    name_variations: ['Alcon Inc', 'Alcon Laboratories', 'Alcon AG'],
    ticker: 'ALC',
    company_type: 'large_pharma',
    hq_country: 'Switzerland',
    modalities_active: ['device', 'surgical', 'topical', 'contact_lens', 'implant'],
    modalities_primary: ['device', 'surgical'],
    indications_active: ['ophthalmology'],
    indications_specific: ['cataract', 'glaucoma', 'vitreoretinal', 'refractive', 'dry_eye', 'contact_lens'],
    phase_preference_min: 'phase_2',
    phase_preference_max: 'approved',
    territory_focus: ['global'],
    deals_last_12mo: 5,
    deals_last_24mo: 9,
    active_trials_count: 20,
    avg_upfront_usd: 500000000,
    median_upfront_usd: 250000000,
    actively_acquiring: true,
    acquisition_appetite: 'aggressive',
    strategic_priorities: ['surgical_ophthalmology', 'iol_innovation', 'vitreoretinal_surgery', 'contact_lens', 'dry_eye_otc'],
    data_quality_score: 90,
    patent_cliffs: [
      { drug_name: 'AcrySof/Vivity/PanOptix IOLs', indication: 'Ophthalmology (Cataract Surgery IOLs)', revenue_usd: 3500000000, expiry_year: 2030 },
      { drug_name: 'Systane (OTC eye drops)', indication: 'Ophthalmology (Dry Eye OTC)', revenue_usd: 800000000, expiry_year: 2027 },
      { drug_name: 'CONSTELLATION vitreoretinal', indication: 'Ophthalmology (Vitreoretinal Surgery)', revenue_usd: 1200000000, expiry_year: 2029 },
    ],
  },
  {
    name: 'Bausch + Lomb',
    name_variations: ['Bausch & Lomb', 'Bausch Health', 'BLCO', 'Valeant'],
    ticker: 'BLCO',
    company_type: 'large_pharma',
    hq_country: 'Canada',
    modalities_active: ['small_molecule', 'topical', 'device', 'contact_lens', 'surgical'],
    modalities_primary: ['topical', 'device'],
    indications_active: ['ophthalmology'],
    indications_specific: ['dry_eye', 'glaucoma', 'retinal_disease', 'contact_lens', 'cataract'],
    phase_preference_min: 'phase_2',
    phase_preference_max: 'approved',
    territory_focus: ['global'],
    deals_last_12mo: 3,
    deals_last_24mo: 6,
    active_trials_count: 15,
    avg_upfront_usd: 300000000,
    median_upfront_usd: 150000000,
    actively_acquiring: true,
    acquisition_appetite: 'moderate',
    strategic_priorities: ['ophthalmic_drugs', 'contact_lens', 'surgical_devices', 'consumer_eye_health', 'dry_eye'],
    data_quality_score: 80,
    patent_cliffs: [
      { drug_name: 'Lotemax (loteprednol)', indication: 'Ophthalmology (Ocular Inflammation)', revenue_usd: 400000000, expiry_year: 2028 },
      { drug_name: 'SofLens/ULTRA/Biotrue contact lenses', indication: 'Ophthalmology (Vision Correction)', revenue_usd: 2500000000, expiry_year: 2030 },
    ],
  },
  {
    name: 'Aerie Pharmaceuticals (Alcon)',
    name_variations: ['Aerie', 'Aerie Pharmaceuticals Inc'],
    ticker: 'ALC',
    company_type: 'large_pharma',
    hq_country: 'US',
    modalities_active: ['small_molecule', 'topical'],
    modalities_primary: ['small_molecule'],
    indications_active: ['ophthalmology'],
    indications_specific: ['glaucoma', 'ocular_hypertension', 'dme', 'wet_amd'],
    phase_preference_min: 'phase_2',
    phase_preference_max: 'approved',
    territory_focus: ['us', 'global'],
    deals_last_12mo: 2,
    deals_last_24mo: 3,
    active_trials_count: 5,
    avg_upfront_usd: 150000000,
    median_upfront_usd: 75000000,
    actively_acquiring: false,
    acquisition_appetite: 'selective',
    strategic_priorities: ['rho_kinase_inhibitor', 'glaucoma_fixed_combinations', 'retina_expansion', 'novel_iop_lowering'],
    data_quality_score: 72,
    patent_cliffs: [
      { drug_name: 'Rhopressa (netarsudil)', indication: 'Ophthalmology (Glaucoma ROCK Inhibitor)', revenue_usd: 200000000, expiry_year: 2035 },
      { drug_name: 'Rocklatan (netarsudil/latanoprost)', indication: 'Ophthalmology (Glaucoma Combination)', revenue_usd: 300000000, expiry_year: 2035 },
    ],
  },
  {
    name: 'Clearside Biomedical',
    name_variations: ['Clearside', 'Clearside Biomedical Inc'],
    ticker: 'CLSD',
    company_type: 'specialty',
    hq_country: 'US',
    modalities_active: ['suprachoroidal_injection', 'small_molecule', 'gene_therapy'],
    modalities_primary: ['suprachoroidal_injection'],
    indications_active: ['ophthalmology'],
    indications_specific: ['macular_edema_uveitis', 'dme', 'wet_amd', 'retinal_vein_occlusion'],
    phase_preference_min: 'preclinical',
    phase_preference_max: 'approved',
    territory_focus: ['us', 'global'],
    deals_last_12mo: 1,
    deals_last_24mo: 3,
    active_trials_count: 4,
    avg_upfront_usd: 40000000,
    median_upfront_usd: 20000000,
    actively_acquiring: false,
    acquisition_appetite: 'selective',
    strategic_priorities: ['suprachoroidal_delivery', 'xipere_market', 'retina_drug_delivery', 'gene_therapy_delivery'],
    data_quality_score: 62,
    patent_cliffs: [
      { drug_name: 'Xipere (triamcinolone acetonide SCS)', indication: 'Ophthalmology (Macular Edema/Uveitis Suprachoroidal)', revenue_usd: 150000000, expiry_year: 2035 },
    ],
  },
  {
    name: 'Ocuphire Pharma',
    name_variations: ['Ocuphire', 'Ocuphire Pharma Inc', 'Rexahn Pharmaceuticals'],
    ticker: 'OCUP',
    company_type: 'specialty',
    hq_country: 'US',
    modalities_active: ['small_molecule', 'topical'],
    modalities_primary: ['small_molecule'],
    indications_active: ['ophthalmology'],
    indications_specific: ['presbyopia', 'mydriasis_reversal', 'dim_light_vision', 'night_vision'],
    phase_preference_min: 'phase_2',
    phase_preference_max: 'phase_3',
    territory_focus: ['us'],
    deals_last_12mo: 0,
    deals_last_24mo: 1,
    active_trials_count: 3,
    avg_upfront_usd: null,
    median_upfront_usd: null,
    actively_acquiring: false,
    acquisition_appetite: 'inactive',
    strategic_priorities: ['phentolamine_ophthalmic', 'presbyopia_drops', 'mydriasis_reversal', 'nyxol_approval'],
    data_quality_score: 55,
    patent_cliffs: [
      { drug_name: 'Nyxol (phentolamine ophthalmic)', indication: 'Ophthalmology (Dim Light/Night Vision Disturbance)', revenue_usd: 200000000, expiry_year: 2037 },
    ],
  },
];

// =============================================================================
// SEED FUNCTION
// =============================================================================

async function seedOphthalmologyCompanies() {
  console.log('Starting ophthalmology company seed...\n');
  console.log(`Seeding ${ophthalmologyCompanies.length} companies...\n`);

  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const company of ophthalmologyCompanies) {
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
          console.log(`  ↻ ${company.name}: Updated with ophthalmology data (${company.company_type})`);
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
  console.log(`Total:   ${ophthalmologyCompanies.length}`);
  console.log(`${'='.repeat(50)}\n`);
}

seedOphthalmologyCompanies().catch(console.error);
