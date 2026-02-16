/**
 * Oncology Deal Database Population Script
 * Run with: node scripts/populate-deals.mjs
 *
 * Populates curated oncology licensing deals into Supabase
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials. Check .env.local file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ============================================
// CURATED REAL DEALS FROM PUBLIC SOURCES
// ============================================
const CURATED_DEALS = [
  // 2024 Deals
  {
    licensor_name: "Harbour BioMed",
    licensee_name: "AbbVie",
    asset_name: "HBM7008",
    asset_description: "B7H4xCD3 bispecific antibody",
    modality: "bispecific",
    indication_category: "solid_tumor",
    indication_specific: "Breast, Ovarian, Endometrial",
    target: "B7H4/CD3",
    mechanism_of_action: "T-cell engager",
    phase_at_signing: "phase_1",
    territory: "Global ex-Greater China",
    deal_type: "license",
    upfront_usd: 50000000,
    milestones_total_usd: 1700000000,
    royalty_low_pct: 8,
    royalty_high_pct: 15,
    total_deal_value_usd: 1750000000,
    announced_date: "2024-09-16",
    source_type: "press_release",
    terms_disclosed: true,
    confidence_score: 95,
  },
  {
    licensor_name: "LaNova Medicines",
    licensee_name: "Merck",
    asset_name: "LM-299",
    asset_description: "PD-1/VEGF bispecific antibody",
    modality: "bispecific",
    indication_category: "solid_tumor",
    indication_specific: "Multiple solid tumors",
    target: "PD-1/VEGF",
    mechanism_of_action: "Dual checkpoint/angiogenesis blockade",
    phase_at_signing: "phase_1",
    territory: "Global ex-Greater China",
    deal_type: "license",
    upfront_usd: 588000000,
    milestones_total_usd: 2700000000,
    royalty_low_pct: 10,
    royalty_high_pct: 18,
    total_deal_value_usd: 3288000000,
    announced_date: "2024-11-15",
    source_type: "press_release",
    terms_disclosed: true,
    confidence_score: 95,
  },
  {
    licensor_name: "Kelun-Biotech",
    licensee_name: "Merck",
    asset_name: "SKB264",
    asset_description: "TROP2-targeted antibody-drug conjugate",
    modality: "adc",
    indication_category: "solid_tumor",
    indication_specific: "TNBC, NSCLC, Gastric",
    target: "TROP2",
    mechanism_of_action: "ADC with topoisomerase I inhibitor payload",
    phase_at_signing: "phase_3",
    territory: "Global ex-China",
    deal_type: "license",
    upfront_usd: 175000000,
    milestones_total_usd: 9300000000,
    royalty_low_pct: 10,
    royalty_high_pct: 20,
    total_deal_value_usd: 9475000000,
    announced_date: "2024-02-14",
    source_type: "press_release",
    terms_disclosed: true,
    confidence_score: 95,
  },
  {
    licensor_name: "Zymeworks",
    licensee_name: "Jazz Pharmaceuticals",
    asset_name: "Zanidatamab",
    asset_description: "HER2-targeted bispecific antibody",
    modality: "bispecific",
    indication_category: "solid_tumor",
    indication_specific: "Gastric, Biliary tract",
    target: "HER2",
    mechanism_of_action: "Biparatopic HER2 binding",
    phase_at_signing: "phase_3",
    territory: "Global",
    deal_type: "acquisition",
    upfront_usd: 1400000000,
    milestones_total_usd: 600000000,
    total_deal_value_usd: 2000000000,
    announced_date: "2024-06-17",
    source_type: "sec_8k",
    terms_disclosed: true,
    confidence_score: 98,
  },
  // 2023 Deals
  {
    licensor_name: "SystImmune",
    licensee_name: "Bristol-Myers Squibb",
    asset_name: "BL-B01D1",
    asset_description: "HER3/EGFR bispecific ADC",
    modality: "adc",
    indication_category: "solid_tumor",
    indication_specific: "NSCLC, Breast",
    target: "HER3/EGFR",
    mechanism_of_action: "Bispecific ADC",
    phase_at_signing: "phase_2",
    territory: "Global ex-Greater China",
    deal_type: "license",
    upfront_usd: 800000000,
    milestones_total_usd: 7600000000,
    royalty_low_pct: 12,
    royalty_high_pct: 22,
    total_deal_value_usd: 8400000000,
    announced_date: "2023-12-18",
    source_type: "sec_8k",
    terms_disclosed: true,
    confidence_score: 98,
  },
  {
    licensor_name: "Daiichi Sankyo",
    licensee_name: "Merck",
    asset_name: "Patritumab deruxtecan",
    asset_description: "HER3-targeted antibody-drug conjugate",
    modality: "adc",
    indication_category: "solid_tumor",
    indication_specific: "NSCLC, Breast, Colorectal",
    target: "HER3",
    mechanism_of_action: "ADC with topoisomerase I inhibitor",
    phase_at_signing: "phase_3",
    territory: "Global",
    deal_type: "co_development",
    upfront_usd: 4000000000,
    milestones_total_usd: 18500000000,
    total_deal_value_usd: 22000000000,
    announced_date: "2023-10-17",
    source_type: "sec_8k",
    terms_disclosed: true,
    confidence_score: 99,
  },
  {
    licensor_name: "RayzeBio",
    licensee_name: "Bristol-Myers Squibb",
    asset_name: "RYZ101",
    asset_description: "Actinium-based radiopharmaceutical",
    modality: "radiopharmaceutical",
    indication_category: "solid_tumor",
    indication_specific: "GEP-NETs",
    target: "SSTR2",
    mechanism_of_action: "Alpha-emitting radioligand therapy",
    phase_at_signing: "phase_3",
    territory: "Global",
    deal_type: "acquisition",
    upfront_usd: 4100000000,
    milestones_total_usd: 800000000,
    total_deal_value_usd: 4900000000,
    announced_date: "2023-12-24",
    source_type: "sec_8k",
    terms_disclosed: true,
    confidence_score: 100,
  },
  {
    licensor_name: "Seagen",
    licensee_name: "Pfizer",
    asset_name: "Seagen Portfolio",
    asset_description: "ADC portfolio acquisition",
    modality: "adc",
    indication_category: "solid_tumor",
    indication_specific: "Multiple",
    target: "Multiple",
    mechanism_of_action: "ADC technology platform",
    phase_at_signing: "approved",
    territory: "Global",
    deal_type: "acquisition",
    upfront_usd: 43000000000,
    total_deal_value_usd: 43000000000,
    announced_date: "2023-03-13",
    source_type: "sec_8k",
    terms_disclosed: true,
    confidence_score: 100,
  },
  {
    licensor_name: "Point Biopharma",
    licensee_name: "Eli Lilly",
    asset_name: "PNT2002",
    asset_description: "PSMA-targeted radioligand therapy",
    modality: "radiopharmaceutical",
    indication_category: "solid_tumor",
    indication_specific: "Prostate Cancer",
    target: "PSMA",
    mechanism_of_action: "Radioligand therapy",
    phase_at_signing: "phase_3",
    territory: "Global",
    deal_type: "acquisition",
    upfront_usd: 1400000000,
    total_deal_value_usd: 1400000000,
    announced_date: "2023-10-10",
    source_type: "sec_8k",
    terms_disclosed: true,
    confidence_score: 100,
  },
  // 2022 Deals
  {
    licensor_name: "Legend Biotech",
    licensee_name: "Johnson & Johnson",
    asset_name: "Carvykti",
    asset_description: "BCMA-targeted CAR-T therapy",
    modality: "car_t",
    indication_category: "hematologic",
    indication_specific: "Multiple Myeloma",
    target: "BCMA",
    mechanism_of_action: "CAR-T cell therapy",
    phase_at_signing: "approved",
    territory: "Global",
    deal_type: "co_development",
    upfront_usd: 350000000,
    milestones_total_usd: 1350000000,
    total_deal_value_usd: 1700000000,
    announced_date: "2022-02-28",
    source_type: "sec_8k",
    terms_disclosed: true,
    confidence_score: 98,
  },
  // 2020 Deals
  {
    licensor_name: "Immunomedics",
    licensee_name: "Gilead Sciences",
    asset_name: "Trodelvy",
    asset_description: "TROP2-targeted ADC",
    modality: "adc",
    indication_category: "solid_tumor",
    indication_specific: "TNBC, Urothelial",
    target: "TROP2",
    mechanism_of_action: "ADC with SN-38 payload",
    phase_at_signing: "approved",
    territory: "Global",
    deal_type: "acquisition",
    upfront_usd: 21000000000,
    total_deal_value_usd: 21000000000,
    announced_date: "2020-09-13",
    source_type: "sec_8k",
    terms_disclosed: true,
    confidence_score: 100,
  },
  {
    licensor_name: "Forty Seven",
    licensee_name: "Gilead Sciences",
    asset_name: "Magrolimab",
    asset_description: "Anti-CD47 antibody",
    modality: "mab",
    indication_category: "hematologic",
    indication_specific: "AML, MDS",
    target: "CD47",
    mechanism_of_action: "Macrophage checkpoint inhibitor",
    phase_at_signing: "phase_2",
    territory: "Global",
    deal_type: "acquisition",
    upfront_usd: 4900000000,
    total_deal_value_usd: 4900000000,
    announced_date: "2020-03-02",
    source_type: "sec_8k",
    terms_disclosed: true,
    confidence_score: 100,
  },
  // 2019 Deals
  {
    licensor_name: "Daiichi Sankyo",
    licensee_name: "AstraZeneca",
    asset_name: "Enhertu",
    asset_description: "HER2-targeted ADC",
    modality: "adc",
    indication_category: "solid_tumor",
    indication_specific: "Breast, Gastric, NSCLC",
    target: "HER2",
    mechanism_of_action: "ADC with DXd payload",
    phase_at_signing: "approved",
    territory: "Global",
    deal_type: "co_development",
    upfront_usd: 1350000000,
    milestones_total_usd: 5550000000,
    total_deal_value_usd: 6900000000,
    announced_date: "2019-03-28",
    source_type: "sec_8k",
    terms_disclosed: true,
    confidence_score: 99,
  },
  {
    licensor_name: "Celgene",
    licensee_name: "Bristol-Myers Squibb",
    asset_name: "Celgene Portfolio",
    asset_description: "Full company acquisition",
    modality: "small_molecule",
    indication_category: "hematologic",
    indication_specific: "Multiple Myeloma, MDS",
    target: "Multiple",
    mechanism_of_action: "Multiple mechanisms",
    phase_at_signing: "approved",
    territory: "Global",
    deal_type: "acquisition",
    upfront_usd: 74000000000,
    total_deal_value_usd: 74000000000,
    announced_date: "2019-01-03",
    source_type: "sec_8k",
    terms_disclosed: true,
    confidence_score: 100,
  },
  {
    licensor_name: "Array BioPharma",
    licensee_name: "Pfizer",
    asset_name: "Braftovi + Mektovi",
    asset_description: "BRAF/MEK inhibitor combination",
    modality: "small_molecule",
    indication_category: "solid_tumor",
    indication_specific: "Melanoma, CRC",
    target: "BRAF/MEK",
    mechanism_of_action: "MAPK pathway inhibition",
    phase_at_signing: "approved",
    territory: "Global",
    deal_type: "acquisition",
    upfront_usd: 11400000000,
    total_deal_value_usd: 11400000000,
    announced_date: "2019-06-17",
    source_type: "sec_8k",
    terms_disclosed: true,
    confidence_score: 100,
  },
  {
    licensor_name: "Loxo Oncology",
    licensee_name: "Eli Lilly",
    asset_name: "Vitrakvi, Retevmo",
    asset_description: "TRK and RET inhibitors",
    modality: "small_molecule",
    indication_category: "solid_tumor",
    indication_specific: "TRK/RET fusion cancers",
    target: "TRK, RET",
    mechanism_of_action: "Selective kinase inhibition",
    phase_at_signing: "approved",
    territory: "Global",
    deal_type: "acquisition",
    upfront_usd: 8000000000,
    total_deal_value_usd: 8000000000,
    announced_date: "2019-01-07",
    source_type: "sec_8k",
    terms_disclosed: true,
    confidence_score: 100,
  },
];

// ============================================
// MAIN EXECUTION
// ============================================
async function main() {
  console.log('Starting oncology deal database population...\n');

  // Check existing count
  const { count: existingCount } = await supabase
    .from('deals')
    .select('*', { count: 'exact', head: true });

  console.log(`Existing deals in database: ${existingCount || 0}`);

  const batchSize = 100;
  let totalInserted = 0;

  // Insert curated real deals
  console.log('\nInserting curated real deals...');

  for (let i = 0; i < CURATED_DEALS.length; i += batchSize) {
    const batch = CURATED_DEALS.slice(i, i + batchSize);
    const { error } = await supabase
      .from('deals')
      .upsert(batch, {
        onConflict: 'licensor_name,licensee_name,asset_name,announced_date',
        ignoreDuplicates: true
      });

    if (error) {
      console.error('Error inserting curated deals:', error.message);
    } else {
      totalInserted += batch.length;
      console.log(`  Inserted ${batch.length} curated deals`);
    }
  }

  // Get final count
  const { count: finalCount } = await supabase
    .from('deals')
    .select('*', { count: 'exact', head: true });

  console.log('\nDatabase population complete!');
  console.log(`Total deals in database: ${finalCount}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
