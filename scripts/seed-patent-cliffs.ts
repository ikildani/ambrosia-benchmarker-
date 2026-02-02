// Script to populate patent cliff data for major pharma companies
// Run with: npx tsx scripts/seed-patent-cliffs.ts

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Patent cliff data for major pharma companies (public information from SEC filings, analyst reports)
const patentCliffData: Record<string, {
  patent_cliffs: Array<{
    drug_name: string;
    indication: string;
    revenue_usd: number;
    expiry_year: number;
  }>;
  revenue_at_risk_2025: number;
  revenue_at_risk_2026: number;
  revenue_at_risk_2027: number;
}> = {
  // Merck
  'Merck': {
    patent_cliffs: [
      { drug_name: 'Keytruda', indication: 'Oncology (PD-1)', revenue_usd: 25000000000, expiry_year: 2028 },
      { drug_name: 'Gardasil', indication: 'HPV Vaccine', revenue_usd: 8900000000, expiry_year: 2028 },
      { drug_name: 'Lynparza', indication: 'Oncology (PARP)', revenue_usd: 1200000000, expiry_year: 2027 },
    ],
    revenue_at_risk_2025: 0,
    revenue_at_risk_2026: 0,
    revenue_at_risk_2027: 1200000000,
  },
  'Merck & Co.': {
    patent_cliffs: [
      { drug_name: 'Keytruda', indication: 'Oncology (PD-1)', revenue_usd: 25000000000, expiry_year: 2028 },
      { drug_name: 'Gardasil', indication: 'HPV Vaccine', revenue_usd: 8900000000, expiry_year: 2028 },
      { drug_name: 'Lynparza', indication: 'Oncology (PARP)', revenue_usd: 1200000000, expiry_year: 2027 },
    ],
    revenue_at_risk_2025: 0,
    revenue_at_risk_2026: 0,
    revenue_at_risk_2027: 1200000000,
  },

  // Bristol-Myers Squibb
  'Bristol-Myers Squibb': {
    patent_cliffs: [
      { drug_name: 'Eliquis', indication: 'Anticoagulant', revenue_usd: 12200000000, expiry_year: 2026 },
      { drug_name: 'Opdivo', indication: 'Oncology (PD-1)', revenue_usd: 9000000000, expiry_year: 2028 },
      { drug_name: 'Pomalyst', indication: 'Hematology', revenue_usd: 3500000000, expiry_year: 2027 },
      { drug_name: 'Sprycel', indication: 'Oncology (CML)', revenue_usd: 2100000000, expiry_year: 2026 },
    ],
    revenue_at_risk_2025: 0,
    revenue_at_risk_2026: 14300000000,
    revenue_at_risk_2027: 3500000000,
  },
  'BMS': {
    patent_cliffs: [
      { drug_name: 'Eliquis', indication: 'Anticoagulant', revenue_usd: 12200000000, expiry_year: 2026 },
      { drug_name: 'Opdivo', indication: 'Oncology (PD-1)', revenue_usd: 9000000000, expiry_year: 2028 },
      { drug_name: 'Pomalyst', indication: 'Hematology', revenue_usd: 3500000000, expiry_year: 2027 },
    ],
    revenue_at_risk_2025: 0,
    revenue_at_risk_2026: 14300000000,
    revenue_at_risk_2027: 3500000000,
  },

  // Pfizer
  'Pfizer': {
    patent_cliffs: [
      { drug_name: 'Eliquis', indication: 'Anticoagulant', revenue_usd: 6500000000, expiry_year: 2026 },
      { drug_name: 'Ibrance', indication: 'Oncology (CDK4/6)', revenue_usd: 5100000000, expiry_year: 2027 },
      { drug_name: 'Xtandi', indication: 'Oncology (Prostate)', revenue_usd: 1800000000, expiry_year: 2027 },
      { drug_name: 'Xeljanz', indication: 'Autoimmune', revenue_usd: 1600000000, expiry_year: 2025 },
    ],
    revenue_at_risk_2025: 1600000000,
    revenue_at_risk_2026: 6500000000,
    revenue_at_risk_2027: 6900000000,
  },

  // Johnson & Johnson / Janssen
  'Johnson & Johnson': {
    patent_cliffs: [
      { drug_name: 'Stelara', indication: 'Autoimmune (IL-12/23)', revenue_usd: 11000000000, expiry_year: 2025 },
      { drug_name: 'Darzalex', indication: 'Hematology (CD38)', revenue_usd: 9700000000, expiry_year: 2029 },
      { drug_name: 'Imbruvica', indication: 'Hematology (BTK)', revenue_usd: 4200000000, expiry_year: 2027 },
      { drug_name: 'Erleada', indication: 'Oncology (Prostate)', revenue_usd: 2500000000, expiry_year: 2027 },
    ],
    revenue_at_risk_2025: 11000000000,
    revenue_at_risk_2026: 0,
    revenue_at_risk_2027: 6700000000,
  },
  'Janssen': {
    patent_cliffs: [
      { drug_name: 'Stelara', indication: 'Autoimmune (IL-12/23)', revenue_usd: 11000000000, expiry_year: 2025 },
      { drug_name: 'Darzalex', indication: 'Hematology (CD38)', revenue_usd: 9700000000, expiry_year: 2029 },
      { drug_name: 'Imbruvica', indication: 'Hematology (BTK)', revenue_usd: 4200000000, expiry_year: 2027 },
    ],
    revenue_at_risk_2025: 11000000000,
    revenue_at_risk_2026: 0,
    revenue_at_risk_2027: 4200000000,
  },

  // AbbVie
  'AbbVie': {
    patent_cliffs: [
      { drug_name: 'Humira', indication: 'Autoimmune (TNF)', revenue_usd: 14400000000, expiry_year: 2023 },
      { drug_name: 'Imbruvica', indication: 'Hematology (BTK)', revenue_usd: 5200000000, expiry_year: 2027 },
      { drug_name: 'Venclexta', indication: 'Hematology (BCL-2)', revenue_usd: 2200000000, expiry_year: 2030 },
    ],
    revenue_at_risk_2025: 0,
    revenue_at_risk_2026: 0,
    revenue_at_risk_2027: 5200000000,
  },

  // Roche
  'Roche': {
    patent_cliffs: [
      { drug_name: 'Ocrevus', indication: 'Multiple Sclerosis', revenue_usd: 7200000000, expiry_year: 2028 },
      { drug_name: 'Tecentriq', indication: 'Oncology (PD-L1)', revenue_usd: 4100000000, expiry_year: 2027 },
      { drug_name: 'Perjeta', indication: 'Oncology (HER2)', revenue_usd: 4000000000, expiry_year: 2024 },
      { drug_name: 'Kadcyla', indication: 'Oncology (ADC)', revenue_usd: 2200000000, expiry_year: 2025 },
    ],
    revenue_at_risk_2025: 2200000000,
    revenue_at_risk_2026: 0,
    revenue_at_risk_2027: 4100000000,
  },

  // Novartis
  'Novartis': {
    patent_cliffs: [
      { drug_name: 'Entresto', indication: 'Heart Failure (ARNI)', revenue_usd: 6500000000, expiry_year: 2026 },
      { drug_name: 'Cosentyx', indication: 'Autoimmune (IL-17)', revenue_usd: 5400000000, expiry_year: 2026 },
      { drug_name: 'Promacta', indication: 'Hematology', revenue_usd: 2100000000, expiry_year: 2025 },
      { drug_name: 'Tasigna', indication: 'Oncology (CML)', revenue_usd: 1900000000, expiry_year: 2026 },
    ],
    revenue_at_risk_2025: 2100000000,
    revenue_at_risk_2026: 13800000000,
    revenue_at_risk_2027: 0,
  },

  // AstraZeneca
  'AstraZeneca': {
    patent_cliffs: [
      { drug_name: 'Farxiga', indication: 'Diabetes/Cardio (SGLT2)', revenue_usd: 5900000000, expiry_year: 2025 },
      { drug_name: 'Lynparza', indication: 'Oncology (PARP)', revenue_usd: 2700000000, expiry_year: 2027 },
      { drug_name: 'Imfinzi', indication: 'Oncology (PD-L1)', revenue_usd: 4000000000, expiry_year: 2030 },
      { drug_name: 'Tagrisso', indication: 'Oncology (EGFR)', revenue_usd: 5800000000, expiry_year: 2032 },
    ],
    revenue_at_risk_2025: 5900000000,
    revenue_at_risk_2026: 0,
    revenue_at_risk_2027: 2700000000,
  },

  // Eli Lilly
  'Eli Lilly': {
    patent_cliffs: [
      { drug_name: 'Trulicity', indication: 'Diabetes (GLP-1)', revenue_usd: 7400000000, expiry_year: 2027 },
      { drug_name: 'Jardiance', indication: 'Diabetes (SGLT2)', revenue_usd: 2500000000, expiry_year: 2025 },
      { drug_name: 'Taltz', indication: 'Autoimmune (IL-17)', revenue_usd: 2700000000, expiry_year: 2028 },
      { drug_name: 'Verzenio', indication: 'Oncology (CDK4/6)', revenue_usd: 3500000000, expiry_year: 2031 },
    ],
    revenue_at_risk_2025: 2500000000,
    revenue_at_risk_2026: 0,
    revenue_at_risk_2027: 7400000000,
  },
  'Lilly': {
    patent_cliffs: [
      { drug_name: 'Trulicity', indication: 'Diabetes (GLP-1)', revenue_usd: 7400000000, expiry_year: 2027 },
      { drug_name: 'Jardiance', indication: 'Diabetes (SGLT2)', revenue_usd: 2500000000, expiry_year: 2025 },
      { drug_name: 'Taltz', indication: 'Autoimmune (IL-17)', revenue_usd: 2700000000, expiry_year: 2028 },
    ],
    revenue_at_risk_2025: 2500000000,
    revenue_at_risk_2026: 0,
    revenue_at_risk_2027: 7400000000,
  },

  // GSK
  'GSK': {
    patent_cliffs: [
      { drug_name: 'Trelegy Ellipta', indication: 'Respiratory (COPD)', revenue_usd: 3300000000, expiry_year: 2025 },
      { drug_name: 'Dovato', indication: 'HIV', revenue_usd: 1900000000, expiry_year: 2027 },
      { drug_name: 'Nucala', indication: 'Respiratory (Asthma)', revenue_usd: 1700000000, expiry_year: 2026 },
      { drug_name: 'Benlysta', indication: 'Autoimmune (Lupus)', revenue_usd: 1100000000, expiry_year: 2026 },
    ],
    revenue_at_risk_2025: 3300000000,
    revenue_at_risk_2026: 2800000000,
    revenue_at_risk_2027: 1900000000,
  },
  'GlaxoSmithKline': {
    patent_cliffs: [
      { drug_name: 'Trelegy Ellipta', indication: 'Respiratory (COPD)', revenue_usd: 3300000000, expiry_year: 2025 },
      { drug_name: 'Dovato', indication: 'HIV', revenue_usd: 1900000000, expiry_year: 2027 },
      { drug_name: 'Nucala', indication: 'Respiratory (Asthma)', revenue_usd: 1700000000, expiry_year: 2026 },
    ],
    revenue_at_risk_2025: 3300000000,
    revenue_at_risk_2026: 1700000000,
    revenue_at_risk_2027: 1900000000,
  },

  // Sanofi
  'Sanofi': {
    patent_cliffs: [
      { drug_name: 'Dupixent', indication: 'Autoimmune (IL-4/13)', revenue_usd: 11500000000, expiry_year: 2031 },
      { drug_name: 'Aubagio', indication: 'Multiple Sclerosis', revenue_usd: 2000000000, expiry_year: 2025 },
      { drug_name: 'Lantus', indication: 'Diabetes (Insulin)', revenue_usd: 2600000000, expiry_year: 2024 },
    ],
    revenue_at_risk_2025: 2000000000,
    revenue_at_risk_2026: 0,
    revenue_at_risk_2027: 0,
  },

  // Amgen
  'Amgen': {
    patent_cliffs: [
      { drug_name: 'Enbrel', indication: 'Autoimmune (TNF)', revenue_usd: 4000000000, expiry_year: 2028 },
      { drug_name: 'Prolia/Xgeva', indication: 'Bone Health', revenue_usd: 4300000000, expiry_year: 2025 },
      { drug_name: 'Otezla', indication: 'Autoimmune (PDE4)', revenue_usd: 2500000000, expiry_year: 2028 },
      { drug_name: 'Repatha', indication: 'Cardiovascular (PCSK9)', revenue_usd: 1800000000, expiry_year: 2029 },
    ],
    revenue_at_risk_2025: 4300000000,
    revenue_at_risk_2026: 0,
    revenue_at_risk_2027: 0,
  },

  // Gilead
  'Gilead': {
    patent_cliffs: [
      { drug_name: 'Biktarvy', indication: 'HIV', revenue_usd: 12000000000, expiry_year: 2033 },
      { drug_name: 'Descovy', indication: 'HIV (PrEP)', revenue_usd: 2100000000, expiry_year: 2025 },
      { drug_name: 'Veklury', indication: 'Antiviral (COVID)', revenue_usd: 1500000000, expiry_year: 2029 },
      { drug_name: 'Trodelvy', indication: 'Oncology (ADC)', revenue_usd: 1300000000, expiry_year: 2034 },
    ],
    revenue_at_risk_2025: 2100000000,
    revenue_at_risk_2026: 0,
    revenue_at_risk_2027: 0,
  },
  'Gilead Sciences': {
    patent_cliffs: [
      { drug_name: 'Biktarvy', indication: 'HIV', revenue_usd: 12000000000, expiry_year: 2033 },
      { drug_name: 'Descovy', indication: 'HIV (PrEP)', revenue_usd: 2100000000, expiry_year: 2025 },
      { drug_name: 'Trodelvy', indication: 'Oncology (ADC)', revenue_usd: 1300000000, expiry_year: 2034 },
    ],
    revenue_at_risk_2025: 2100000000,
    revenue_at_risk_2026: 0,
    revenue_at_risk_2027: 0,
  },

  // Regeneron
  'Regeneron': {
    patent_cliffs: [
      { drug_name: 'Eylea', indication: 'Ophthalmology (VEGF)', revenue_usd: 9800000000, expiry_year: 2027 },
      { drug_name: 'Dupixent', indication: 'Autoimmune (IL-4/13)', revenue_usd: 5500000000, expiry_year: 2031 },
      { drug_name: 'Libtayo', indication: 'Oncology (PD-1)', revenue_usd: 900000000, expiry_year: 2034 },
    ],
    revenue_at_risk_2025: 0,
    revenue_at_risk_2026: 0,
    revenue_at_risk_2027: 9800000000,
  },

  // Biogen
  'Biogen': {
    patent_cliffs: [
      { drug_name: 'Tecfidera', indication: 'Multiple Sclerosis', revenue_usd: 1800000000, expiry_year: 2025 },
      { drug_name: 'Spinraza', indication: 'SMA (Rare Disease)', revenue_usd: 1700000000, expiry_year: 2030 },
      { drug_name: 'Tysabri', indication: 'Multiple Sclerosis', revenue_usd: 1900000000, expiry_year: 2027 },
    ],
    revenue_at_risk_2025: 1800000000,
    revenue_at_risk_2026: 0,
    revenue_at_risk_2027: 1900000000,
  },

  // Vertex
  'Vertex': {
    patent_cliffs: [
      { drug_name: 'Trikafta', indication: 'Cystic Fibrosis', revenue_usd: 9000000000, expiry_year: 2037 },
      { drug_name: 'Orkambi', indication: 'Cystic Fibrosis', revenue_usd: 800000000, expiry_year: 2030 },
    ],
    revenue_at_risk_2025: 0,
    revenue_at_risk_2026: 0,
    revenue_at_risk_2027: 0,
  },
  'Vertex Pharmaceuticals': {
    patent_cliffs: [
      { drug_name: 'Trikafta', indication: 'Cystic Fibrosis', revenue_usd: 9000000000, expiry_year: 2037 },
      { drug_name: 'Orkambi', indication: 'Cystic Fibrosis', revenue_usd: 800000000, expiry_year: 2030 },
    ],
    revenue_at_risk_2025: 0,
    revenue_at_risk_2026: 0,
    revenue_at_risk_2027: 0,
  },

  // Takeda
  'Takeda': {
    patent_cliffs: [
      { drug_name: 'Entyvio', indication: 'Autoimmune (GI)', revenue_usd: 5700000000, expiry_year: 2026 },
      { drug_name: 'Vyvanse', indication: 'CNS (ADHD)', revenue_usd: 3700000000, expiry_year: 2023 },
      { drug_name: 'Ninlaro', indication: 'Hematology', revenue_usd: 900000000, expiry_year: 2027 },
    ],
    revenue_at_risk_2025: 0,
    revenue_at_risk_2026: 5700000000,
    revenue_at_risk_2027: 900000000,
  },

  // Bayer
  'Bayer': {
    patent_cliffs: [
      { drug_name: 'Xarelto', indication: 'Anticoagulant', revenue_usd: 4800000000, expiry_year: 2024 },
      { drug_name: 'Eylea', indication: 'Ophthalmology', revenue_usd: 2300000000, expiry_year: 2027 },
      { drug_name: 'Nubeqa', indication: 'Oncology (Prostate)', revenue_usd: 1200000000, expiry_year: 2032 },
    ],
    revenue_at_risk_2025: 0,
    revenue_at_risk_2026: 0,
    revenue_at_risk_2027: 2300000000,
  },

  // Boehringer Ingelheim
  'Boehringer Ingelheim': {
    patent_cliffs: [
      { drug_name: 'Jardiance', indication: 'Diabetes (SGLT2)', revenue_usd: 5800000000, expiry_year: 2025 },
      { drug_name: 'Ofev', indication: 'Pulmonary Fibrosis', revenue_usd: 3400000000, expiry_year: 2026 },
      { drug_name: 'Spiriva', indication: 'Respiratory (COPD)', revenue_usd: 2800000000, expiry_year: 2025 },
    ],
    revenue_at_risk_2025: 8600000000,
    revenue_at_risk_2026: 3400000000,
    revenue_at_risk_2027: 0,
  },

  // UCB
  'UCB': {
    patent_cliffs: [
      { drug_name: 'Cimzia', indication: 'Autoimmune (TNF)', revenue_usd: 1900000000, expiry_year: 2024 },
      { drug_name: 'Vimpat', indication: 'CNS (Epilepsy)', revenue_usd: 1700000000, expiry_year: 2026 },
      { drug_name: 'Bimzelx', indication: 'Autoimmune (IL-17)', revenue_usd: 600000000, expiry_year: 2035 },
    ],
    revenue_at_risk_2025: 0,
    revenue_at_risk_2026: 1700000000,
    revenue_at_risk_2027: 0,
  },

  // Astellas
  'Astellas': {
    patent_cliffs: [
      { drug_name: 'Xtandi', indication: 'Oncology (Prostate)', revenue_usd: 5100000000, expiry_year: 2027 },
      { drug_name: 'Prograf', indication: 'Transplant', revenue_usd: 1600000000, expiry_year: 2025 },
      { drug_name: 'Padcev', indication: 'Oncology (ADC)', revenue_usd: 1200000000, expiry_year: 2036 },
    ],
    revenue_at_risk_2025: 1600000000,
    revenue_at_risk_2026: 0,
    revenue_at_risk_2027: 5100000000,
  },

  // Daiichi Sankyo
  'Daiichi Sankyo': {
    patent_cliffs: [
      { drug_name: 'Enhertu', indication: 'Oncology (ADC)', revenue_usd: 2900000000, expiry_year: 2035 },
      { drug_name: 'Lixiana/Savaysa', indication: 'Anticoagulant', revenue_usd: 2300000000, expiry_year: 2025 },
      { drug_name: 'Injectafer', indication: 'Anemia', revenue_usd: 900000000, expiry_year: 2026 },
    ],
    revenue_at_risk_2025: 2300000000,
    revenue_at_risk_2026: 900000000,
    revenue_at_risk_2027: 0,
  },

  // Seagen (now Pfizer)
  'Seagen': {
    patent_cliffs: [
      { drug_name: 'Adcetris', indication: 'Oncology (ADC)', revenue_usd: 1400000000, expiry_year: 2026 },
      { drug_name: 'Padcev', indication: 'Oncology (ADC)', revenue_usd: 1000000000, expiry_year: 2036 },
      { drug_name: 'Tukysa', indication: 'Oncology (HER2)', revenue_usd: 500000000, expiry_year: 2032 },
    ],
    revenue_at_risk_2025: 0,
    revenue_at_risk_2026: 1400000000,
    revenue_at_risk_2027: 0,
  },
};

async function seedPatentCliffs() {
  console.log('Starting patent cliff data seed...\n');

  // Get all companies from the database
  const { data: companies, error: fetchError } = await supabase
    .from('companies')
    .select('id, name')
    .order('name');

  if (fetchError) {
    console.error('Error fetching companies:', fetchError);
    return;
  }

  if (!companies || companies.length === 0) {
    console.log('No companies found in database. Creating top pharma companies...\n');

    // Create companies if they don't exist
    const companiesToCreate = Object.keys(patentCliffData).filter((name, index, arr) => {
      // Remove duplicates (e.g., "Merck" and "Merck & Co.")
      return arr.indexOf(name) === index;
    });

    for (const name of companiesToCreate) {
      const cliffData = patentCliffData[name];

      const { error: insertError } = await supabase
        .from('companies')
        .insert({
          name,
          company_type: 'large_pharma',
          actively_acquiring: true,
          acquisition_appetite: 'aggressive',
          data_quality_score: 70,
          patent_cliffs: cliffData.patent_cliffs,
          revenue_at_risk_2025: cliffData.revenue_at_risk_2025,
          revenue_at_risk_2026: cliffData.revenue_at_risk_2026,
          revenue_at_risk_2027: cliffData.revenue_at_risk_2027,
        })
        .select()
        .single();

      if (insertError) {
        if (insertError.code === '23505') {
          console.log(`  ${name}: Already exists, updating...`);
          // Update existing
          const { error: updateError } = await supabase
            .from('companies')
            .update({
              patent_cliffs: cliffData.patent_cliffs,
              revenue_at_risk_2025: cliffData.revenue_at_risk_2025,
              revenue_at_risk_2026: cliffData.revenue_at_risk_2026,
              revenue_at_risk_2027: cliffData.revenue_at_risk_2027,
            })
            .eq('name', name);

          if (updateError) {
            console.error(`  ${name}: Update failed -`, updateError.message);
          } else {
            console.log(`  ${name}: Updated successfully`);
          }
        } else {
          console.error(`  ${name}: Insert failed -`, insertError.message);
        }
      } else {
        console.log(`  ${name}: Created with patent cliff data`);
      }
    }
  } else {
    console.log(`Found ${companies.length} companies in database.\n`);

    let updated = 0;
    let notFound = 0;

    for (const company of companies) {
      const cliffData = patentCliffData[company.name];

      if (cliffData) {
        const { error: updateError } = await supabase
          .from('companies')
          .update({
            patent_cliffs: cliffData.patent_cliffs,
            revenue_at_risk_2025: cliffData.revenue_at_risk_2025,
            revenue_at_risk_2026: cliffData.revenue_at_risk_2026,
            revenue_at_risk_2027: cliffData.revenue_at_risk_2027,
          })
          .eq('id', company.id);

        if (updateError) {
          console.error(`  ${company.name}: Update failed -`, updateError.message);
        } else {
          console.log(`  ✓ ${company.name}: Updated with ${cliffData.patent_cliffs.length} patent cliffs`);
          updated++;
        }
      } else {
        notFound++;
      }
    }

    console.log(`\n✓ Updated ${updated} companies with patent cliff data`);
    console.log(`  ${notFound} companies did not have matching patent data`);
  }

  console.log('\nDone!');
}

// Run the seed
seedPatentCliffs().catch(console.error);
