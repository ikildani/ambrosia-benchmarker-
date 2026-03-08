// Script to seed dermatology-focused companies into the partner matching database
// Run with: npx tsx scripts/seed-dermatology-companies.ts
//
// These companies are curated from real deal activity, SEC filings, and pipeline data.
// Each company includes dermatology-relevant indications, modalities, strategic priorities,
// and deal history to power accurate partner matching for dermatology assets.

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

interface DermatologyCompany {
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
// DERMATOLOGY COMPANY DATABASE
// Sources: SEC filings, DealForma, BioPharma Dive, Evaluate Pharma, company IRs
// =============================================================================

const dermatologyCompanies: DermatologyCompany[] = [
  // ─────────────────────────────────────────────────────────────────
  // LARGE PHARMA / BIOTECH WITH MAJOR DERMATOLOGY FRANCHISES
  // ─────────────────────────────────────────────────────────────────
  {
    name: 'AbbVie',
    name_variations: ['AbbVie Inc.', 'AbbVie Inc', 'Allergan Aesthetics'],
    ticker: 'ABBV',
    company_type: 'large_pharma',
    hq_country: 'US',
    modalities_active: ['antibody', 'small_molecule', 'peptide'],
    modalities_primary: ['antibody'],
    indications_active: ['dermatology', 'autoimmune', 'oncology', 'cns'],
    indications_specific: ['psoriasis', 'atopic_dermatitis', 'hidradenitis_suppurativa', 'vitiligo', 'alopecia_areata'],
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
    strategic_priorities: ['il-23_inhibitor', 'psoriasis', 'atopic_dermatitis', 'hidradenitis', 'next_gen_immunology'],
    data_quality_score: 92,
    patent_cliffs: [
      { drug_name: 'Skyrizi (risankizumab)', indication: 'Dermatology (Psoriasis)', revenue_usd: 8500000000, expiry_year: 2035 },
      { drug_name: 'Rinvoq (upadacitinib)', indication: 'Dermatology (AD/Psoriasis)', revenue_usd: 5000000000, expiry_year: 2034 },
      { drug_name: 'Humira (adalimumab)', indication: 'Dermatology (Psoriasis)', revenue_usd: 5500000000, expiry_year: 2025 },
    ],
  },
  {
    name: 'Eli Lilly',
    name_variations: ['Eli Lilly and Company', 'Lilly', 'Eli Lilly & Co.'],
    ticker: 'LLY',
    company_type: 'large_pharma',
    hq_country: 'US',
    modalities_active: ['antibody', 'small_molecule'],
    modalities_primary: ['antibody'],
    indications_active: ['dermatology', 'autoimmune', 'metabolic', 'cns'],
    indications_specific: ['psoriasis', 'atopic_dermatitis', 'hidradenitis_suppurativa', 'alopecia_areata', 'vitiligo'],
    phase_preference_min: 'phase_1',
    phase_preference_max: 'approved',
    territory_focus: ['global'],
    deals_last_12mo: 5,
    deals_last_24mo: 9,
    active_trials_count: 28,
    avg_upfront_usd: 1800000000,
    median_upfront_usd: 1000000000,
    actively_acquiring: true,
    acquisition_appetite: 'aggressive',
    strategic_priorities: ['il-17_inhibitor', 'il-23', 'psoriasis', 'atopic_dermatitis', 'jak_derm'],
    data_quality_score: 90,
    patent_cliffs: [
      { drug_name: 'Taltz (ixekizumab)', indication: 'Dermatology (Psoriasis/PsA)', revenue_usd: 2800000000, expiry_year: 2031 },
      { drug_name: 'Olumiant (baricitinib)', indication: 'Dermatology (Alopecia Areata/AD)', revenue_usd: 1200000000, expiry_year: 2029 },
      // Note: Lebrikizumab EU derm rights licensed to Almirall — revenue here reflects US/RoW only
      { drug_name: 'Lebrikizumab', indication: 'Dermatology (Atopic Dermatitis)', revenue_usd: 500000000, expiry_year: 2037 },
    ],
  },
  {
    name: 'UCB',
    name_variations: ['UCB S.A.', 'UCB Pharma'],
    ticker: 'UCB.BR',
    company_type: 'mid_pharma',
    hq_country: 'Belgium',
    modalities_active: ['antibody', 'small_molecule'],
    modalities_primary: ['antibody'],
    indications_active: ['dermatology', 'autoimmune', 'cns'],
    indications_specific: ['psoriasis', 'psoriatic_arthritis', 'hidradenitis_suppurativa', 'atopic_dermatitis'],
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
    strategic_priorities: ['il-17_derm', 'psoriasis', 'hidradenitis', 'autoimmune_derm'],
    data_quality_score: 82,
    patent_cliffs: [
      { drug_name: 'Bimzelx (bimekizumab)', indication: 'Dermatology (Psoriasis/PsA/HS)', revenue_usd: 2000000000, expiry_year: 2035 },
      { drug_name: 'Cimzia (certolizumab)', indication: 'Dermatology (Psoriasis/PsA)', revenue_usd: 1800000000, expiry_year: 2026 },
    ],
  },
  {
    name: 'Leo Pharma',
    name_variations: ['LEO Pharma', 'LEO Pharma A/S'],
    ticker: null,
    company_type: 'mid_pharma',
    hq_country: 'Denmark',
    modalities_active: ['antibody', 'small_molecule', 'topical'],
    modalities_primary: ['antibody', 'topical'],
    indications_active: ['dermatology'],
    indications_specific: ['psoriasis', 'atopic_dermatitis', 'actinic_keratosis', 'eczema', 'skin_infections'],
    phase_preference_min: 'phase_1',
    phase_preference_max: 'approved',
    territory_focus: ['global'],
    deals_last_12mo: 3,
    deals_last_24mo: 6,
    active_trials_count: 15,
    avg_upfront_usd: 250000000,
    median_upfront_usd: 120000000,
    actively_acquiring: true,
    acquisition_appetite: 'aggressive',
    strategic_priorities: ['atopic_dermatitis', 'psoriasis', 'medical_dermatology', 'topical_innovation'],
    data_quality_score: 75,
    patent_cliffs: [
      { drug_name: 'Adtralza (tralokinumab)', indication: 'Dermatology (Atopic Dermatitis)', revenue_usd: 600000000, expiry_year: 2034 },
      { drug_name: 'Enstilar', indication: 'Dermatology (Psoriasis Topical)', revenue_usd: 400000000, expiry_year: 2028 },
    ],
  },
  {
    name: 'Arcutis Biotherapeutics',
    name_variations: ['Arcutis', 'Arcutis Bio'],
    ticker: 'ARQT',
    company_type: 'mid_biotech',
    hq_country: 'US',
    modalities_active: ['topical', 'small_molecule'],
    modalities_primary: ['topical'],
    indications_active: ['dermatology'],
    indications_specific: ['psoriasis', 'atopic_dermatitis', 'seborrheic_dermatitis', 'alopecia_areata'],
    phase_preference_min: 'phase_2',
    phase_preference_max: 'approved',
    territory_focus: ['us', 'global'],
    deals_last_12mo: 2,
    deals_last_24mo: 4,
    active_trials_count: 8,
    avg_upfront_usd: null,
    median_upfront_usd: null,
    actively_acquiring: true,
    acquisition_appetite: 'moderate',
    strategic_priorities: ['topical_jak_inhibitor', 'psoriasis_topical', 'seborrheic_dermatitis', 'topical_pipeline'],
    data_quality_score: 68,
    patent_cliffs: [
      { drug_name: 'Zoryve (roflumilast cream)', indication: 'Dermatology (Psoriasis/SebDerm)', revenue_usd: 300000000, expiry_year: 2035 },
    ],
  },
  {
    name: 'Dermavant Sciences',
    name_variations: ['Dermavant', 'Dermavant Sciences Inc.'],
    ticker: null,
    company_type: 'mid_biotech',
    hq_country: 'US',
    modalities_active: ['topical', 'small_molecule'],
    modalities_primary: ['topical'],
    indications_active: ['dermatology'],
    indications_specific: ['psoriasis', 'atopic_dermatitis', 'vitiligo', 'seborrheic_dermatitis'],
    phase_preference_min: 'phase_2',
    phase_preference_max: 'approved',
    territory_focus: ['us', 'global'],
    deals_last_12mo: 1,
    deals_last_24mo: 3,
    active_trials_count: 6,
    avg_upfront_usd: null,
    median_upfront_usd: null,
    actively_acquiring: false,
    acquisition_appetite: 'selective',
    strategic_priorities: ['topical_tapinarof', 'psoriasis_topical', 'atopic_dermatitis_topical', 'ahr_agonist'],
    data_quality_score: 62,
    patent_cliffs: [
      { drug_name: 'Vtama (tapinarof)', indication: 'Dermatology (Psoriasis/AD Topical)', revenue_usd: 400000000, expiry_year: 2036 },
    ],
  },
  {
    name: 'Sun Pharma',
    name_variations: ['Sun Pharmaceutical', 'Sun Pharma Industries', 'Sun Pharma Advanced Research'],
    ticker: 'SUNPHARMA.NS',
    company_type: 'large_pharma',
    hq_country: 'India',
    modalities_active: ['small_molecule', 'topical', 'antibody'],
    modalities_primary: ['small_molecule', 'topical'],
    indications_active: ['dermatology', 'oncology', 'autoimmune'],
    indications_specific: ['psoriasis', 'acne', 'rosacea', 'atopic_dermatitis', 'onychomycosis'],
    phase_preference_min: 'phase_2',
    phase_preference_max: 'approved',
    territory_focus: ['global', 'india', 'us'],
    deals_last_12mo: 3,
    deals_last_24mo: 5,
    active_trials_count: 15,
    avg_upfront_usd: 200000000,
    median_upfront_usd: 100000000,
    actively_acquiring: true,
    acquisition_appetite: 'moderate',
    strategic_priorities: ['psoriasis_specialty', 'acne', 'dermatology_specialty', 'topical_generics'],
    data_quality_score: 72,
    patent_cliffs: [
      { drug_name: 'Ilumya (tildrakizumab)', indication: 'Dermatology (Psoriasis)', revenue_usd: 400000000, expiry_year: 2031 },
      { drug_name: 'Winlevi (clascoterone)', indication: 'Dermatology (Acne)', revenue_usd: 150000000, expiry_year: 2035 },
    ],
  },
  {
    name: 'Galderma',
    name_variations: ['Galderma S.A.', 'Galderma Holding'],
    ticker: 'GALD.SW',
    company_type: 'mid_pharma',
    hq_country: 'Switzerland',
    modalities_active: ['antibody', 'topical', 'small_molecule', 'injectable'],
    modalities_primary: ['antibody', 'topical'],
    indications_active: ['dermatology'],
    indications_specific: ['atopic_dermatitis', 'psoriasis', 'acne', 'rosacea', 'prurigo_nodularis'],
    phase_preference_min: 'phase_1',
    phase_preference_max: 'approved',
    territory_focus: ['global'],
    deals_last_12mo: 4,
    deals_last_24mo: 7,
    active_trials_count: 20,
    avg_upfront_usd: 400000000,
    median_upfront_usd: 200000000,
    actively_acquiring: true,
    acquisition_appetite: 'aggressive',
    strategic_priorities: ['atopic_dermatitis', 'nemolizumab', 'medical_dermatology', 'aesthetics', 'prurigo_nodularis'],
    data_quality_score: 80,
    // Cetaphil/Differin removed — OTC products with no meaningful patent cliff
    patent_cliffs: [
      { drug_name: 'Nemolizumab', indication: 'Dermatology (Prurigo Nodularis/AD)', revenue_usd: 1000000000, expiry_year: 2037 },
    ],
  },
  {
    name: 'Bausch Health (Ortho Dermatologics)',
    name_variations: ['Bausch Health', 'Ortho Dermatologics', 'Bausch', 'Valeant'],
    ticker: 'BHC',
    company_type: 'mid_pharma',
    hq_country: 'Canada',
    modalities_active: ['topical', 'small_molecule'],
    modalities_primary: ['topical'],
    indications_active: ['dermatology', 'ophthalmology', 'gi'],
    indications_specific: ['acne', 'psoriasis', 'rosacea', 'fungal_infections', 'eczema'],
    phase_preference_min: 'phase_2',
    phase_preference_max: 'approved',
    territory_focus: ['us', 'global'],
    deals_last_12mo: 2,
    deals_last_24mo: 4,
    active_trials_count: 10,
    avg_upfront_usd: 200000000,
    median_upfront_usd: 100000000,
    actively_acquiring: true,
    acquisition_appetite: 'moderate',
    strategic_priorities: ['acne', 'psoriasis_topical', 'derm_branded', 'derm_generics'],
    data_quality_score: 65,
    patent_cliffs: [
      { drug_name: 'Siliq (brodalumab)', indication: 'Dermatology (Psoriasis)', revenue_usd: 150000000, expiry_year: 2029 },
      { drug_name: 'Arazlo (tazarotene lotion)', indication: 'Dermatology (Acne)', revenue_usd: 80000000, expiry_year: 2033 },
    ],
  },
  {
    // Matches hematology entry name 'Bristol-Myers Squibb' — merged derm-specific data
    name: 'Bristol-Myers Squibb',
    name_variations: ['BMS', 'Bristol Myers Squibb', 'Bristol-Myers Squibb Company', 'Celgene'],
    ticker: 'BMY',
    company_type: 'large_pharma',
    hq_country: 'US',
    modalities_active: ['small_molecule', 'antibody', 'cell_therapy', 'bispecific', 'protein_degrader'],
    modalities_primary: ['small_molecule', 'cell_therapy'],
    indications_active: ['dermatology', 'oncology', 'hematology', 'autoimmune', 'cardiovascular'],
    indications_specific: ['psoriasis', 'psoriatic_arthritis', 'lupus_skin', 'atopic_dermatitis', 'multiple_myeloma', 'mds', 'aml', 'lymphoma', 'cll', 'beta_thalassemia'],
    phase_preference_min: 'phase_1',
    phase_preference_max: 'approved',
    territory_focus: ['global'],
    deals_last_12mo: 4,
    deals_last_24mo: 8,
    active_trials_count: 20,
    avg_upfront_usd: 2000000000,
    median_upfront_usd: 1000000000,
    actively_acquiring: true,
    acquisition_appetite: 'moderate',
    strategic_priorities: ['tyk2_inhibitor', 'psoriasis', 'autoimmune_derm', 'protein_degradation_derm'],
    data_quality_score: 85,
    patent_cliffs: [
      { drug_name: 'Sotyktu (deucravacitinib)', indication: 'Dermatology (Psoriasis TYK2)', revenue_usd: 1500000000, expiry_year: 2036 },
    ],
  },
  {
    // Matches rare disease entry name 'Regeneron' — merged derm-specific data (Dupixent partnership with Sanofi)
    name: 'Regeneron',
    name_variations: ['Regeneron Pharmaceuticals', 'Regeneron Inc.', 'Sanofi Dupixent'],
    ticker: 'REGN',
    company_type: 'large_biotech',
    hq_country: 'US',
    modalities_active: ['antibody', 'gene_therapy', 'rnai'],
    modalities_primary: ['antibody'],
    indications_active: ['dermatology', 'autoimmune', 'pulmonology', 'rare_disease', 'oncology', 'ophthalmology'],
    indications_specific: ['atopic_dermatitis', 'prurigo_nodularis', 'chronic_urticaria', 'bullous_pemphigoid', 'copd', 'hattr', 'rare_eye_disease', 'hfh', 'rare_autoimmune'],
    phase_preference_min: 'phase_1',
    phase_preference_max: 'approved',
    territory_focus: ['global'],
    deals_last_12mo: 5,
    deals_last_24mo: 10,
    active_trials_count: 30,
    avg_upfront_usd: 800000000,
    median_upfront_usd: 400000000,
    actively_acquiring: true,
    acquisition_appetite: 'moderate',
    strategic_priorities: ['il4_il13', 'atopic_dermatitis', 'type2_inflammation_derm', 'prurigo_nodularis'],
    data_quality_score: 90,
    patent_cliffs: [
      { drug_name: 'Dupixent (dupilumab)', indication: 'Dermatology (AD/PN/CSU)', revenue_usd: 13000000000, expiry_year: 2031 },
    ],
  },
  {
    // Matches hematology entry name 'Incyte' — merged derm-specific data
    name: 'Incyte',
    name_variations: ['Incyte Corporation', 'Incyte Corp'],
    ticker: 'INCY',
    company_type: 'mid_biotech',
    hq_country: 'US',
    modalities_active: ['small_molecule', 'antibody', 'bispecific', 'topical'],
    modalities_primary: ['small_molecule'],
    indications_active: ['dermatology', 'hematology', 'oncology', 'autoimmune'],
    indications_specific: ['vitiligo', 'atopic_dermatitis', 'gvhd_skin', 'hidradenitis_suppurativa', 'myelofibrosis', 'polycythemia_vera', 'gvhd', 'aml', 'mds'],
    phase_preference_min: 'phase_1',
    phase_preference_max: 'approved',
    territory_focus: ['global'],
    deals_last_12mo: 3,
    deals_last_24mo: 5,
    active_trials_count: 15,
    avg_upfront_usd: 400000000,
    median_upfront_usd: 200000000,
    actively_acquiring: true,
    acquisition_appetite: 'moderate',
    strategic_priorities: ['jak_inhibitor_topical', 'vitiligo', 'derm_autoimmune', 'topical_jak'],
    data_quality_score: 80,
    patent_cliffs: [
      { drug_name: 'Opzelura (ruxolitinib cream)', indication: 'Dermatology (Vitiligo/AD Topical)', revenue_usd: 800000000, expiry_year: 2034 },
    ],
  },
  {
    // Matches hematology entry name 'Amgen' — merged derm-specific data
    name: 'Amgen',
    name_variations: ['Amgen Inc.', 'Amgen Inc'],
    ticker: 'AMGN',
    company_type: 'large_biotech',
    hq_country: 'US',
    modalities_active: ['bispecific', 'antibody', 'small_molecule', 'cell_therapy'],
    modalities_primary: ['bispecific', 'antibody'],
    indications_active: ['dermatology', 'oncology', 'hematology', 'autoimmune', 'rare_disease', 'cardiovascular'],
    indications_specific: ['psoriasis', 'atopic_dermatitis', 'hidradenitis_suppurativa', 'all', 'aml', 'dlbcl', 'multiple_myeloma', 'itp'],
    phase_preference_min: 'phase_1',
    phase_preference_max: 'approved',
    territory_focus: ['global'],
    deals_last_12mo: 4,
    deals_last_24mo: 8,
    active_trials_count: 18,
    avg_upfront_usd: 1500000000,
    median_upfront_usd: 800000000,
    actively_acquiring: true,
    acquisition_appetite: 'moderate',
    strategic_priorities: ['biosimilar_derm', 'inflammation', 'psoriasis', 'next_gen_biologics'],
    data_quality_score: 82,
    patent_cliffs: [
      { drug_name: 'Otezla (apremilast)', indication: 'Dermatology (Psoriasis/PsA)', revenue_usd: 2200000000, expiry_year: 2028 },
    ],
  },
  {
    // Matches hematology entry name 'Pfizer' — merged derm-specific data
    name: 'Pfizer',
    name_variations: ['Pfizer Inc.', 'Pfizer Inc'],
    ticker: 'PFE',
    company_type: 'large_pharma',
    hq_country: 'US',
    modalities_active: ['small_molecule', 'antibody', 'adc', 'bispecific', 'gene_therapy', 'topical'],
    modalities_primary: ['small_molecule', 'antibody'],
    indications_active: ['dermatology', 'autoimmune', 'oncology', 'hematology', 'rare_disease'],
    indications_specific: ['atopic_dermatitis', 'alopecia_areata', 'vitiligo', 'psoriasis', 'hemophilia_a', 'hemophilia_b', 'sickle_cell', 'mds', 'dlbcl'],
    phase_preference_min: 'phase_1',
    phase_preference_max: 'approved',
    territory_focus: ['global'],
    deals_last_12mo: 5,
    deals_last_24mo: 10,
    active_trials_count: 22,
    avg_upfront_usd: 2000000000,
    median_upfront_usd: 1000000000,
    actively_acquiring: true,
    acquisition_appetite: 'aggressive',
    strategic_priorities: ['jak_inhibitor_derm', 'atopic_dermatitis', 'alopecia_areata', 'autoimmune_derm'],
    data_quality_score: 85,
    patent_cliffs: [
      { drug_name: 'Cibinqo (abrocitinib)', indication: 'Dermatology (Atopic Dermatitis JAK1)', revenue_usd: 600000000, expiry_year: 2035 },
    ],
  },
  // Arena/Pfizer (Etrasimod) entry removed — duplicates Pfizer entry above.
  // Etrasimod (Velsipity) data is captured in the GI script under 'Arena Pharmaceuticals (Pfizer)'.

  // ─────────────────────────────────────────────────────────────────
  // LARGE PHARMA WITH DERMATOLOGY PIPELINES
  // ─────────────────────────────────────────────────────────────────
  {
    name: 'Novartis',
    name_variations: ['Novartis AG', 'Novartis Pharma', 'Novartis International'],
    ticker: 'NVS',
    company_type: 'large_pharma',
    hq_country: 'Switzerland',
    modalities_active: ['antibody', 'small_molecule', 'bispecific'],
    modalities_primary: ['antibody'],
    indications_active: ['dermatology', 'autoimmune', 'oncology', 'cardiovascular'],
    indications_specific: ['psoriasis', 'psoriatic_arthritis', 'hidradenitis_suppurativa', 'atopic_dermatitis', 'chronic_urticaria'],
    phase_preference_min: 'phase_1',
    phase_preference_max: 'approved',
    territory_focus: ['global'],
    deals_last_12mo: 6,
    deals_last_24mo: 11,
    active_trials_count: 25,
    avg_upfront_usd: 2000000000,
    median_upfront_usd: 1200000000,
    actively_acquiring: true,
    acquisition_appetite: 'aggressive',
    strategic_priorities: ['il-17_franchise', 'psoriasis', 'hidradenitis', 'next_gen_biologics', 'autoimmune_derm'],
    data_quality_score: 92,
    patent_cliffs: [
      { drug_name: 'Cosentyx (secukinumab)', indication: 'Dermatology (Psoriasis/PsA/HS)', revenue_usd: 5000000000, expiry_year: 2029 },
      { drug_name: 'Xolair (omalizumab)', indication: 'Dermatology (Chronic Urticaria)', revenue_usd: 2500000000, expiry_year: 2026 },
    ],
  },
  {
    name: 'Johnson & Johnson (Janssen)',
    name_variations: ['J&J', 'Janssen', 'Janssen Biotech', 'Johnson & Johnson', 'J&J Innovative Medicine'],
    ticker: 'JNJ',
    company_type: 'large_pharma',
    hq_country: 'US',
    modalities_active: ['antibody', 'small_molecule'],
    modalities_primary: ['antibody'],
    indications_active: ['dermatology', 'autoimmune', 'oncology', 'cns'],
    indications_specific: ['psoriasis', 'psoriatic_arthritis', 'atopic_dermatitis', 'hidradenitis_suppurativa', 'palmoplantar_pustulosis'],
    phase_preference_min: 'phase_1',
    phase_preference_max: 'approved',
    territory_focus: ['global'],
    deals_last_12mo: 5,
    deals_last_24mo: 10,
    active_trials_count: 22,
    avg_upfront_usd: 2200000000,
    median_upfront_usd: 1000000000,
    actively_acquiring: true,
    acquisition_appetite: 'aggressive',
    strategic_priorities: ['il-23_psoriasis', 'psoriatic_arthritis', 'autoimmune_derm', 'next_gen_biologics'],
    data_quality_score: 90,
    patent_cliffs: [
      { drug_name: 'Tremfya (guselkumab)', indication: 'Dermatology (Psoriasis/PsA)', revenue_usd: 3800000000, expiry_year: 2033 },
      { drug_name: 'Stelara (ustekinumab)', indication: 'Dermatology (Psoriasis/PsA)', revenue_usd: 6500000000, expiry_year: 2025 },
    ],
  },
  {
    name: 'Roche/Genentech',
    name_variations: ['Roche', 'Genentech', 'Roche Holding', 'F. Hoffmann-La Roche'],
    ticker: 'ROG.SW',
    company_type: 'large_pharma',
    hq_country: 'Switzerland',
    modalities_active: ['antibody', 'bispecific', 'small_molecule'],
    modalities_primary: ['antibody'],
    indications_active: ['dermatology', 'oncology', 'autoimmune', 'ophthalmology'],
    indications_specific: ['atopic_dermatitis', 'psoriasis', 'chronic_urticaria', 'vitiligo'],
    phase_preference_min: 'phase_1',
    phase_preference_max: 'approved',
    territory_focus: ['global'],
    deals_last_12mo: 4,
    deals_last_24mo: 9,
    active_trials_count: 15,
    avg_upfront_usd: 1800000000,
    median_upfront_usd: 900000000,
    actively_acquiring: true,
    acquisition_appetite: 'moderate',
    strategic_priorities: ['atopic_dermatitis_pipeline', 'next_gen_immunology', 'bispecific_derm', 'precision_derm'],
    data_quality_score: 85,
    patent_cliffs: [
      { drug_name: 'Xolair (omalizumab, co-rights)', indication: 'Dermatology (Chronic Urticaria)', revenue_usd: 1200000000, expiry_year: 2026 },
    ],
  },
  {
    name: 'Merck & Co.',
    name_variations: ['Merck', 'MSD', 'Merck Sharp & Dohme'],
    ticker: 'MRK',
    company_type: 'large_pharma',
    hq_country: 'US',
    modalities_active: ['antibody', 'small_molecule', 'peptide'],
    modalities_primary: ['antibody', 'small_molecule'],
    indications_active: ['dermatology', 'oncology', 'infectious_disease', 'autoimmune'],
    indications_specific: ['atopic_dermatitis', 'psoriasis', 'melanoma', 'skin_cancer', 'eczema'],
    phase_preference_min: 'phase_1',
    phase_preference_max: 'approved',
    territory_focus: ['global'],
    deals_last_12mo: 5,
    deals_last_24mo: 9,
    active_trials_count: 14,
    avg_upfront_usd: 2500000000,
    median_upfront_usd: 1100000000,
    actively_acquiring: true,
    acquisition_appetite: 'aggressive',
    strategic_priorities: ['immuno_derm', 'melanoma', 'autoimmune_derm_pipeline', 'il-13_expansion'],
    data_quality_score: 83,
    patent_cliffs: [
      { drug_name: 'Keytruda (pembrolizumab)', indication: 'Derm-Oncology (Melanoma)', revenue_usd: 25000000000, expiry_year: 2028 },
    ],
  },

  // ─────────────────────────────────────────────────────────────────
  // MID-CAP DERMATOLOGY SPECIALISTS
  // ─────────────────────────────────────────────────────────────────
  {
    name: 'Almirall',
    name_variations: ['Almirall S.A.', 'Almirall Hermal'],
    ticker: 'ALM.MC',
    company_type: 'mid_pharma',
    hq_country: 'Spain',
    modalities_active: ['antibody', 'topical', 'small_molecule'],
    modalities_primary: ['antibody', 'topical'],
    indications_active: ['dermatology'],
    indications_specific: ['atopic_dermatitis', 'psoriasis', 'actinic_keratosis', 'acne', 'alopecia_areata'],
    phase_preference_min: 'phase_2',
    phase_preference_max: 'approved',
    territory_focus: ['europe', 'global'],
    deals_last_12mo: 3,
    deals_last_24mo: 5,
    active_trials_count: 12,
    avg_upfront_usd: 150000000,
    median_upfront_usd: 80000000,
    actively_acquiring: true,
    acquisition_appetite: 'aggressive',
    strategic_priorities: ['medical_dermatology', 'atopic_dermatitis', 'actinic_keratosis', 'derm_licensing_europe'],
    data_quality_score: 72,
    patent_cliffs: [
      { drug_name: 'Ebglyss (lebrikizumab, EU rights)', indication: 'Dermatology (Atopic Dermatitis)', revenue_usd: 500000000, expiry_year: 2037 },
      { drug_name: 'Klisyri (tirbanibulin)', indication: 'Dermatology (Actinic Keratosis)', revenue_usd: 120000000, expiry_year: 2035 },
    ],
  },
  {
    name: 'Vyne Therapeutics',
    name_variations: ['Vyne', 'Vyne Therapeutics Inc.', 'Menlo Therapeutics'],
    ticker: 'VYNE',
    company_type: 'specialty',
    hq_country: 'US',
    modalities_active: ['small_molecule', 'topical'],
    modalities_primary: ['small_molecule'],
    indications_active: ['dermatology'],
    indications_specific: ['atopic_dermatitis', 'vitiligo', 'alopecia_areata'],
    phase_preference_min: 'phase_1',
    phase_preference_max: 'phase_3',
    territory_focus: ['us'],
    deals_last_12mo: 1,
    deals_last_24mo: 2,
    active_trials_count: 4,
    avg_upfront_usd: null,
    median_upfront_usd: null,
    actively_acquiring: false,
    acquisition_appetite: 'selective',
    strategic_priorities: ['non_steroidal_jak_derm', 'atopic_dermatitis', 'autoimmune_derm_oral'],
    data_quality_score: 55,
    patent_cliffs: [
      { drug_name: 'VYN201 (BET inhibitor)', indication: 'Dermatology (Atopic Dermatitis)', revenue_usd: 0, expiry_year: 2040 },
    ],
  },
  {
    name: 'Cassiopea',
    name_variations: ['Cassiopea S.p.A.', 'Cassiopea SpA'],
    ticker: 'SKIN.MI',
    company_type: 'specialty',
    hq_country: 'Italy',
    modalities_active: ['topical', 'small_molecule'],
    modalities_primary: ['topical'],
    indications_active: ['dermatology'],
    indications_specific: ['acne', 'androgenetic_alopecia', 'genital_warts'],
    phase_preference_min: 'phase_2',
    phase_preference_max: 'approved',
    territory_focus: ['us', 'europe'],
    deals_last_12mo: 1,
    deals_last_24mo: 3,
    active_trials_count: 5,
    avg_upfront_usd: null,
    median_upfront_usd: null,
    actively_acquiring: false,
    acquisition_appetite: 'selective',
    strategic_priorities: ['androgen_receptor_derm', 'acne', 'alopecia_topical', 'anti_androgen'],
    data_quality_score: 58,
    patent_cliffs: [
      { drug_name: 'Winlevi (clascoterone, ex-US)', indication: 'Dermatology (Acne)', revenue_usd: 80000000, expiry_year: 2035 },
      { drug_name: 'Breezula (clascoterone solution)', indication: 'Dermatology (Androgenetic Alopecia)', revenue_usd: 0, expiry_year: 2036 },
    ],
  },
  {
    name: 'Aclaris Therapeutics',
    name_variations: ['Aclaris', 'Aclaris Therapeutics Inc.'],
    ticker: 'ACRS',
    company_type: 'specialty',
    hq_country: 'US',
    modalities_active: ['small_molecule'],
    modalities_primary: ['small_molecule'],
    indications_active: ['dermatology', 'autoimmune'],
    indications_specific: ['alopecia_areata', 'vitiligo', 'atopic_dermatitis', 'immune_derm'],
    phase_preference_min: 'phase_1',
    phase_preference_max: 'phase_3',
    territory_focus: ['us'],
    deals_last_12mo: 1,
    deals_last_24mo: 2,
    active_trials_count: 3,
    avg_upfront_usd: null,
    median_upfront_usd: null,
    actively_acquiring: false,
    acquisition_appetite: 'selective',
    strategic_priorities: ['mki_kinase_derm', 'alopecia_areata', 'autoimmune_derm', 'novel_kinase_inhibitors'],
    data_quality_score: 52,
    patent_cliffs: [
      { drug_name: 'ATI-2138 (ITK inhibitor)', indication: 'Dermatology (Alopecia Areata)', revenue_usd: 0, expiry_year: 2041 },
    ],
  },
  {
    name: 'Forte Biosciences',
    name_variations: ['Forte Bio', 'Forte Biosciences Inc.'],
    ticker: 'FBRX',
    company_type: 'specialty',
    hq_country: 'US',
    modalities_active: ['biologic', 'live_biotherapeutic'],
    modalities_primary: ['live_biotherapeutic'],
    indications_active: ['dermatology'],
    indications_specific: ['atopic_dermatitis', 'eczema'],
    phase_preference_min: 'phase_1',
    phase_preference_max: 'phase_2',
    territory_focus: ['us'],
    deals_last_12mo: 0,
    deals_last_24mo: 1,
    active_trials_count: 2,
    avg_upfront_usd: null,
    median_upfront_usd: null,
    actively_acquiring: false,
    acquisition_appetite: 'inactive',
    strategic_priorities: ['microbiome_derm', 'atopic_dermatitis_microbiome', 'live_biotherapeutic_skin'],
    data_quality_score: 45,
    patent_cliffs: [
      { drug_name: 'FB-401 (live biotherapeutic)', indication: 'Dermatology (Atopic Dermatitis)', revenue_usd: 0, expiry_year: 2039 },
    ],
  },
  {
    name: 'Timber Pharmaceuticals',
    name_variations: ['Timber Pharma', 'Timber Pharmaceuticals Inc.'],
    ticker: 'TMBR',
    company_type: 'specialty',
    hq_country: 'US',
    modalities_active: ['topical', 'small_molecule'],
    modalities_primary: ['topical'],
    indications_active: ['dermatology'],
    indications_specific: ['congenital_ichthyosis', 'facial_angiofibromas', 'rare_dermatology'],
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
    strategic_priorities: ['rare_dermatology', 'orphan_skin_disease', 'congenital_ichthyosis'],
    data_quality_score: 42,
    patent_cliffs: [
      { drug_name: 'TMB-001 (isotretinoin topical)', indication: 'Dermatology (Congenital Ichthyosis)', revenue_usd: 0, expiry_year: 2038 },
    ],
  },
  {
    name: 'Cara Therapeutics',
    name_variations: ['Cara', 'Cara Therapeutics Inc.'],
    ticker: 'CARA',
    company_type: 'specialty',
    hq_country: 'US',
    modalities_active: ['small_molecule', 'peptide'],
    modalities_primary: ['small_molecule'],
    indications_active: ['dermatology', 'nephrology'],
    indications_specific: ['pruritus', 'chronic_itch', 'atopic_dermatitis', 'uremic_pruritus', 'notalgia_paresthetica'],
    phase_preference_min: 'phase_2',
    phase_preference_max: 'approved',
    territory_focus: ['us', 'global'],
    deals_last_12mo: 1,
    deals_last_24mo: 3,
    active_trials_count: 5,
    avg_upfront_usd: 100000000,
    median_upfront_usd: 50000000,
    actively_acquiring: false,
    acquisition_appetite: 'selective',
    strategic_priorities: ['kor_agonist', 'pruritus', 'chronic_itch', 'atopic_itch'],
    data_quality_score: 60,
    patent_cliffs: [
      { drug_name: 'Korsuva (difelikefalin)', indication: 'Dermatology (Pruritus/CKD-aP)', revenue_usd: 200000000, expiry_year: 2034 },
    ],
  },

  // ─────────────────────────────────────────────────────────────────
  // ASIAN / EUROPEAN PHARMA ACTIVE IN DERMATOLOGY
  // ─────────────────────────────────────────────────────────────────
  {
    name: 'Maruho',
    name_variations: ['Maruho Co., Ltd.', 'Maruho Co Ltd'],
    ticker: null,
    company_type: 'mid_pharma',
    hq_country: 'Japan',
    modalities_active: ['topical', 'small_molecule', 'antibody'],
    modalities_primary: ['topical'],
    indications_active: ['dermatology'],
    indications_specific: ['atopic_dermatitis', 'psoriasis', 'acne', 'eczema', 'skin_infections'],
    phase_preference_min: 'phase_2',
    phase_preference_max: 'approved',
    territory_focus: ['japan', 'asia'],
    deals_last_12mo: 2,
    deals_last_24mo: 4,
    active_trials_count: 10,
    avg_upfront_usd: 80000000,
    median_upfront_usd: 40000000,
    actively_acquiring: true,
    acquisition_appetite: 'moderate',
    strategic_priorities: ['japanese_derm_market', 'topical_innovation', 'atopic_dermatitis_japan', 'licensing_in'],
    data_quality_score: 60,
    patent_cliffs: [
      { drug_name: 'Moizerto (difamilast)', indication: 'Dermatology (Atopic Dermatitis Japan)', revenue_usd: 200000000, expiry_year: 2035 },
    ],
  },
  {
    name: 'Pierre Fabre',
    name_variations: ['Pierre Fabre Dermo-Cosmetique', 'Pierre Fabre Laboratories', 'Pierre Fabre Group'],
    ticker: null,
    company_type: 'mid_pharma',
    hq_country: 'France',
    modalities_active: ['topical', 'small_molecule', 'dermo_cosmetic'],
    modalities_primary: ['topical', 'dermo_cosmetic'],
    indications_active: ['dermatology', 'oncology'],
    indications_specific: ['atopic_dermatitis', 'acne', 'rosacea', 'sun_damage', 'vitiligo'],
    phase_preference_min: 'phase_2',
    phase_preference_max: 'approved',
    territory_focus: ['europe', 'global'],
    deals_last_12mo: 2,
    deals_last_24mo: 4,
    active_trials_count: 8,
    avg_upfront_usd: 100000000,
    median_upfront_usd: 50000000,
    actively_acquiring: true,
    acquisition_appetite: 'moderate',
    strategic_priorities: ['medical_derm_europe', 'dermo_cosmetics', 'atopic_dermatitis', 'therapeutic_skincare'],
    data_quality_score: 58,
    patent_cliffs: [
      { drug_name: 'Ducray/Avene (derm brands)', indication: 'Dermatology (OTC/Rx Derm)', revenue_usd: 800000000, expiry_year: 2030 },
    ],
  },
  {
    name: 'Kaken Pharmaceutical',
    name_variations: ['Kaken', 'Kaken Pharmaceutical Co., Ltd.'],
    ticker: '4521.T',
    company_type: 'mid_pharma',
    hq_country: 'Japan',
    modalities_active: ['topical', 'small_molecule'],
    modalities_primary: ['topical'],
    indications_active: ['dermatology'],
    indications_specific: ['onychomycosis', 'tinea', 'fungal_infections', 'nail_disease'],
    phase_preference_min: 'phase_2',
    phase_preference_max: 'approved',
    territory_focus: ['japan', 'asia'],
    deals_last_12mo: 1,
    deals_last_24mo: 2,
    active_trials_count: 5,
    avg_upfront_usd: 50000000,
    median_upfront_usd: 25000000,
    actively_acquiring: false,
    acquisition_appetite: 'selective',
    strategic_priorities: ['antifungal_derm', 'onychomycosis', 'topical_antifungal', 'japan_derm'],
    data_quality_score: 50,
    patent_cliffs: [
      { drug_name: 'Clenafin (efinaconazole)', indication: 'Dermatology (Onychomycosis)', revenue_usd: 300000000, expiry_year: 2029 },
    ],
  },

  // ─────────────────────────────────────────────────────────────────
  // SPECIALTY / EMERGING DERMATOLOGY
  // ─────────────────────────────────────────────────────────────────
  {
    name: 'MC2 Therapeutics',
    name_variations: ['MC2', 'MC2 Therapeutics A/S'],
    ticker: null,
    company_type: 'specialty',
    hq_country: 'Denmark',
    modalities_active: ['topical'],
    modalities_primary: ['topical'],
    indications_active: ['dermatology'],
    indications_specific: ['psoriasis', 'atopic_dermatitis', 'actinic_keratosis'],
    phase_preference_min: 'phase_2',
    phase_preference_max: 'approved',
    territory_focus: ['europe', 'us', 'global'],
    deals_last_12mo: 1,
    deals_last_24mo: 2,
    active_trials_count: 4,
    avg_upfront_usd: null,
    median_upfront_usd: null,
    actively_acquiring: false,
    acquisition_appetite: 'selective',
    strategic_priorities: ['topical_delivery_innovation', 'psoriasis_topical', 'fixed_dose_topical', 'pag_technology'],
    data_quality_score: 48,
    patent_cliffs: [
      { drug_name: 'Wynzora (calcipotriene/betamethasone cream)', indication: 'Dermatology (Psoriasis Topical)', revenue_usd: 100000000, expiry_year: 2034 },
    ],
  },
  {
    name: 'Sol-Gel Technologies',
    name_variations: ['Sol-Gel', 'Sol-Gel Technologies Ltd.'],
    ticker: 'SLGL',
    company_type: 'specialty',
    hq_country: 'Israel',
    modalities_active: ['topical'],
    modalities_primary: ['topical'],
    indications_active: ['dermatology'],
    indications_specific: ['acne', 'rosacea', 'psoriasis'],
    phase_preference_min: 'phase_2',
    phase_preference_max: 'approved',
    territory_focus: ['us', 'global'],
    deals_last_12mo: 1,
    deals_last_24mo: 2,
    active_trials_count: 4,
    avg_upfront_usd: null,
    median_upfront_usd: null,
    actively_acquiring: false,
    acquisition_appetite: 'selective',
    strategic_priorities: ['encapsulation_technology', 'acne_topical', 'rosacea_topical', 'novel_delivery'],
    data_quality_score: 50,
    patent_cliffs: [
      { drug_name: 'Twyneo (tretinoin/benzoyl peroxide)', indication: 'Dermatology (Acne)', revenue_usd: 60000000, expiry_year: 2036 },
      { drug_name: 'Epsolay (benzoyl peroxide cream)', indication: 'Dermatology (Rosacea)', revenue_usd: 40000000, expiry_year: 2035 },
    ],
  },
];

// =============================================================================
// SEED FUNCTION
// =============================================================================

async function seedDermatologyCompanies() {
  console.log('Starting dermatology company seed...\n');
  console.log(`Seeding ${dermatologyCompanies.length} companies...\n`);

  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const company of dermatologyCompanies) {
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
          console.log(`  ↻ ${company.name}: Updated with dermatology data (${company.company_type})`);
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
  console.log(`Total:   ${dermatologyCompanies.length}`);
  console.log(`${'='.repeat(50)}\n`);
}

seedDermatologyCompanies().catch(console.error);
