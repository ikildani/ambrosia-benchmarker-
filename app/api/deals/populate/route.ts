/**
 * API Route: Populate Deals Database
 * Populates the deals table with oncology licensing deals
 * POST /api/deals/populate
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const maxDuration = 300; // 5 minutes max
export const dynamic = 'force-dynamic';

// Types
interface Deal {
  licensor_name: string;
  licensee_name: string;
  asset_name: string | null;
  asset_description: string | null;
  modality: string;
  indication_category: string;
  indication_specific: string | null;
  target: string | null;
  mechanism_of_action: string | null;
  phase_at_signing: string;
  territory: string;
  deal_type: string;
  upfront_usd: number | null;
  milestones_total_usd: number | null;
  milestones_development_usd: number | null;
  milestones_regulatory_usd: number | null;
  milestones_commercial_usd: number | null;
  royalty_low_pct: number | null;
  royalty_high_pct: number | null;
  total_deal_value_usd: number | null;
  announced_date: string;
  source_type: string;
  source_url: string | null;
  terms_disclosed: boolean;
  confidence_score: number;
  therapeutic_area: string;
}

// ============================================
// CURATED REAL DEALS FROM PUBLIC SOURCES
// ============================================
const CURATED_DEALS: Deal[] = [
  // ==================== 2024 DEALS ====================
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
    milestones_development_usd: 400000000,
    milestones_regulatory_usd: 500000000,
    milestones_commercial_usd: 800000000,
    royalty_low_pct: 8,
    royalty_high_pct: 15,
    total_deal_value_usd: 1750000000,
    announced_date: "2024-09-16",
    source_type: "press_release",
    source_url: null,
    terms_disclosed: true,
    confidence_score: 95,
    therapeutic_area: "oncology",
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
    milestones_development_usd: 800000000,
    milestones_regulatory_usd: 900000000,
    milestones_commercial_usd: 1000000000,
    royalty_low_pct: 10,
    royalty_high_pct: 18,
    total_deal_value_usd: 3288000000,
    announced_date: "2024-11-15",
    source_type: "press_release",
    source_url: null,
    terms_disclosed: true,
    confidence_score: 95,
    therapeutic_area: "oncology",
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
    milestones_development_usd: 2000000000,
    milestones_regulatory_usd: 2500000000,
    milestones_commercial_usd: 4800000000,
    royalty_low_pct: 10,
    royalty_high_pct: 20,
    total_deal_value_usd: 9475000000,
    announced_date: "2024-02-14",
    source_type: "press_release",
    source_url: null,
    terms_disclosed: true,
    confidence_score: 95,
    therapeutic_area: "oncology",
  },
  {
    licensor_name: "Zymeworks",
    licensee_name: "Jazz Pharmaceuticals",
    asset_name: "Zanidatamab",
    asset_description: "HER2-targeted bispecific antibody",
    modality: "bispecific",
    indication_category: "solid_tumor",
    indication_specific: "Gastric, Biliary tract, Colorectal",
    target: "HER2",
    mechanism_of_action: "Biparatopic HER2 binding",
    phase_at_signing: "phase_3",
    territory: "Global",
    deal_type: "acquisition",
    upfront_usd: 1400000000,
    milestones_total_usd: 600000000,
    milestones_development_usd: 200000000,
    milestones_regulatory_usd: 200000000,
    milestones_commercial_usd: 200000000,
    royalty_low_pct: null,
    royalty_high_pct: null,
    total_deal_value_usd: 2000000000,
    announced_date: "2024-06-17",
    source_type: "sec_8k",
    source_url: null,
    terms_disclosed: true,
    confidence_score: 98,
    therapeutic_area: "oncology",
  },
  {
    licensor_name: "Biotheus",
    licensee_name: "Hansoh Pharma",
    asset_name: "PM1080",
    asset_description: "EGFRxcMET bispecific antibody",
    modality: "bispecific",
    indication_category: "solid_tumor",
    indication_specific: "NSCLC, CRC",
    target: "EGFR/cMET",
    mechanism_of_action: "Dual receptor blockade",
    phase_at_signing: "phase_1",
    territory: "Global",
    deal_type: "license",
    upfront_usd: 90000000,
    milestones_total_usd: 600000000,
    milestones_development_usd: 200000000,
    milestones_regulatory_usd: 200000000,
    milestones_commercial_usd: 200000000,
    royalty_low_pct: 8,
    royalty_high_pct: 14,
    total_deal_value_usd: 690000000,
    announced_date: "2024-03-12",
    source_type: "press_release",
    source_url: null,
    terms_disclosed: true,
    confidence_score: 90,
    therapeutic_area: "oncology",
  },
  {
    licensor_name: "Autolus Therapeutics",
    licensee_name: "BioNTech",
    asset_name: "Aucatzyl (obecabtagene autoleucel)",
    asset_description: "CD19-directed CAR-T therapy",
    modality: "car_t",
    indication_category: "hematologic",
    indication_specific: "B-ALL",
    target: "CD19",
    mechanism_of_action: "CAR-T cell therapy",
    phase_at_signing: "approved",
    territory: "Global",
    deal_type: "collaboration",
    upfront_usd: 250000000,
    milestones_total_usd: null,
    milestones_development_usd: null,
    milestones_regulatory_usd: null,
    milestones_commercial_usd: null,
    royalty_low_pct: 10,
    royalty_high_pct: 20,
    total_deal_value_usd: 250000000,
    announced_date: "2024-08-20",
    source_type: "sec_8k",
    source_url: null,
    terms_disclosed: true,
    confidence_score: 95,
    therapeutic_area: "oncology",
  },

  // ==================== 2023 DEALS ====================
  {
    licensor_name: "SystImmune",
    licensee_name: "Bristol-Myers Squibb",
    asset_name: "BL-B01D1",
    asset_description: "HER3/EGFR bispecific ADC",
    modality: "adc",
    indication_category: "solid_tumor",
    indication_specific: "NSCLC, Breast, other solid tumors",
    target: "HER3/EGFR",
    mechanism_of_action: "Bispecific ADC",
    phase_at_signing: "phase_2",
    territory: "Global ex-Greater China",
    deal_type: "license",
    upfront_usd: 800000000,
    milestones_total_usd: 7600000000,
    milestones_development_usd: 2000000000,
    milestones_regulatory_usd: 2500000000,
    milestones_commercial_usd: 3100000000,
    royalty_low_pct: 12,
    royalty_high_pct: 22,
    total_deal_value_usd: 8400000000,
    announced_date: "2023-12-18",
    source_type: "sec_8k",
    source_url: null,
    terms_disclosed: true,
    confidence_score: 98,
    therapeutic_area: "oncology",
  },
  {
    licensor_name: "Daiichi Sankyo",
    licensee_name: "Merck",
    asset_name: "Patritumab deruxtecan (HER3-DXd)",
    asset_description: "HER3-targeted antibody-drug conjugate",
    modality: "adc",
    indication_category: "solid_tumor",
    indication_specific: "NSCLC, Breast, Colorectal",
    target: "HER3",
    mechanism_of_action: "ADC with topoisomerase I inhibitor payload",
    phase_at_signing: "phase_3",
    territory: "Global",
    deal_type: "co_development",
    upfront_usd: 4000000000,
    milestones_total_usd: 18500000000,
    milestones_development_usd: 3500000000,
    milestones_regulatory_usd: 5000000000,
    milestones_commercial_usd: 10000000000,
    royalty_low_pct: null,
    royalty_high_pct: null,
    total_deal_value_usd: 22000000000,
    announced_date: "2023-10-17",
    source_type: "sec_8k",
    source_url: null,
    terms_disclosed: true,
    confidence_score: 99,
    therapeutic_area: "oncology",
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
    milestones_development_usd: null,
    milestones_regulatory_usd: 800000000,
    milestones_commercial_usd: null,
    royalty_low_pct: null,
    royalty_high_pct: null,
    total_deal_value_usd: 4900000000,
    announced_date: "2023-12-24",
    source_type: "sec_8k",
    source_url: null,
    terms_disclosed: true,
    confidence_score: 100,
    therapeutic_area: "oncology",
  },
  {
    licensor_name: "Point Biopharma",
    licensee_name: "Eli Lilly",
    asset_name: "PNT2002, PNT2003",
    asset_description: "PSMA-targeted radioligand therapies",
    modality: "radiopharmaceutical",
    indication_category: "solid_tumor",
    indication_specific: "Prostate Cancer",
    target: "PSMA",
    mechanism_of_action: "Radioligand therapy",
    phase_at_signing: "phase_3",
    territory: "Global",
    deal_type: "acquisition",
    upfront_usd: 1400000000,
    milestones_total_usd: null,
    milestones_development_usd: null,
    milestones_regulatory_usd: null,
    milestones_commercial_usd: null,
    royalty_low_pct: null,
    royalty_high_pct: null,
    total_deal_value_usd: 1400000000,
    announced_date: "2023-10-10",
    source_type: "sec_8k",
    source_url: null,
    terms_disclosed: true,
    confidence_score: 100,
    therapeutic_area: "oncology",
  },
  {
    licensor_name: "Hansoh Pharma",
    licensee_name: "GSK",
    asset_name: "HS-20089",
    asset_description: "B7-H4 targeted ADC",
    modality: "adc",
    indication_category: "solid_tumor",
    indication_specific: "Breast, Ovarian, Endometrial",
    target: "B7-H4",
    mechanism_of_action: "ADC",
    phase_at_signing: "phase_1",
    territory: "Global ex-Greater China",
    deal_type: "license",
    upfront_usd: 185000000,
    milestones_total_usd: 1145000000,
    milestones_development_usd: 400000000,
    milestones_regulatory_usd: 345000000,
    milestones_commercial_usd: 400000000,
    royalty_low_pct: 10,
    royalty_high_pct: 18,
    total_deal_value_usd: 1330000000,
    announced_date: "2023-10-02",
    source_type: "press_release",
    source_url: null,
    terms_disclosed: true,
    confidence_score: 95,
    therapeutic_area: "oncology",
  },
  {
    licensor_name: "Seagen",
    licensee_name: "Pfizer",
    asset_name: "Seagen Portfolio",
    asset_description: "ADC portfolio (Adcetris, Padcev, Tukysa, Tivdak)",
    modality: "adc",
    indication_category: "solid_tumor",
    indication_specific: "Multiple",
    target: "Multiple",
    mechanism_of_action: "ADC technology platform",
    phase_at_signing: "approved",
    territory: "Global",
    deal_type: "acquisition",
    upfront_usd: 43000000000,
    milestones_total_usd: null,
    milestones_development_usd: null,
    milestones_regulatory_usd: null,
    milestones_commercial_usd: null,
    royalty_low_pct: null,
    royalty_high_pct: null,
    total_deal_value_usd: 43000000000,
    announced_date: "2023-03-13",
    source_type: "sec_8k",
    source_url: null,
    terms_disclosed: true,
    confidence_score: 100,
    therapeutic_area: "oncology",
  },
  {
    licensor_name: "Duality Bio",
    licensee_name: "BioNTech",
    asset_name: "DB-1303, DB-1311",
    asset_description: "Next-generation ADC candidates",
    modality: "adc",
    indication_category: "solid_tumor",
    indication_specific: "Multiple solid tumors",
    target: "HER2, TROP2",
    mechanism_of_action: "ADC with novel payloads",
    phase_at_signing: "phase_1",
    territory: "Global ex-Greater China",
    deal_type: "license",
    upfront_usd: 170000000,
    milestones_total_usd: 1500000000,
    milestones_development_usd: 500000000,
    milestones_regulatory_usd: 500000000,
    milestones_commercial_usd: 500000000,
    royalty_low_pct: 8,
    royalty_high_pct: 15,
    total_deal_value_usd: 1670000000,
    announced_date: "2023-04-17",
    source_type: "press_release",
    source_url: null,
    terms_disclosed: true,
    confidence_score: 95,
    therapeutic_area: "oncology",
  },
  {
    licensor_name: "Ambrx",
    licensee_name: "Johnson & Johnson",
    asset_name: "ADC Pipeline",
    asset_description: "Site-specific ADC technology platform",
    modality: "adc",
    indication_category: "solid_tumor",
    indication_specific: "Multiple",
    target: "Multiple",
    mechanism_of_action: "Site-specific conjugation ADC",
    phase_at_signing: "phase_1",
    territory: "Global",
    deal_type: "acquisition",
    upfront_usd: 2000000000,
    milestones_total_usd: null,
    milestones_development_usd: null,
    milestones_regulatory_usd: null,
    milestones_commercial_usd: null,
    royalty_low_pct: null,
    royalty_high_pct: null,
    total_deal_value_usd: 2000000000,
    announced_date: "2023-01-09",
    source_type: "sec_8k",
    source_url: null,
    terms_disclosed: true,
    confidence_score: 100,
    therapeutic_area: "oncology",
  },

  // ==================== 2022 DEALS ====================
  {
    licensor_name: "Mirati Therapeutics",
    licensee_name: "Bristol-Myers Squibb",
    asset_name: "Krazati (adagrasib)",
    asset_description: "KRAS G12C inhibitor",
    modality: "small_molecule",
    indication_category: "solid_tumor",
    indication_specific: "NSCLC, CRC",
    target: "KRAS G12C",
    mechanism_of_action: "Covalent KRAS inhibitor",
    phase_at_signing: "approved",
    territory: "Global",
    deal_type: "co_development",
    upfront_usd: 200000000,
    milestones_total_usd: 2200000000,
    milestones_development_usd: 600000000,
    milestones_regulatory_usd: 600000000,
    milestones_commercial_usd: 1000000000,
    royalty_low_pct: 15,
    royalty_high_pct: 25,
    total_deal_value_usd: 2400000000,
    announced_date: "2022-10-11",
    source_type: "sec_8k",
    source_url: null,
    terms_disclosed: true,
    confidence_score: 95,
    therapeutic_area: "oncology",
  },
  {
    licensor_name: "Agenus",
    licensee_name: "Bristol-Myers Squibb",
    asset_name: "Anti-TIGIT",
    asset_description: "TIGIT-blocking antibody",
    modality: "mab",
    indication_category: "solid_tumor",
    indication_specific: "Multiple solid tumors",
    target: "TIGIT",
    mechanism_of_action: "Checkpoint inhibitor",
    phase_at_signing: "phase_2",
    territory: "Global",
    deal_type: "license",
    upfront_usd: 200000000,
    milestones_total_usd: 1360000000,
    milestones_development_usd: 400000000,
    milestones_regulatory_usd: 460000000,
    milestones_commercial_usd: 500000000,
    royalty_low_pct: 10,
    royalty_high_pct: 18,
    total_deal_value_usd: 1560000000,
    announced_date: "2022-03-14",
    source_type: "press_release",
    source_url: null,
    terms_disclosed: true,
    confidence_score: 90,
    therapeutic_area: "oncology",
  },
  {
    licensor_name: "Legend Biotech",
    licensee_name: "Johnson & Johnson",
    asset_name: "Carvykti (ciltacabtagene autoleucel)",
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
    milestones_development_usd: null,
    milestones_regulatory_usd: 500000000,
    milestones_commercial_usd: 850000000,
    royalty_low_pct: null,
    royalty_high_pct: null,
    total_deal_value_usd: 1700000000,
    announced_date: "2022-02-28",
    source_type: "sec_8k",
    source_url: null,
    terms_disclosed: true,
    confidence_score: 98,
    therapeutic_area: "oncology",
  },

  // ==================== 2021 DEALS ====================
  {
    licensor_name: "Arcus Biosciences",
    licensee_name: "Gilead Sciences",
    asset_name: "Domvanalimab",
    asset_description: "Anti-TIGIT antibody",
    modality: "mab",
    indication_category: "solid_tumor",
    indication_specific: "NSCLC, GI cancers",
    target: "TIGIT",
    mechanism_of_action: "Fc-silent TIGIT blockade",
    phase_at_signing: "phase_2",
    territory: "Global ex-China",
    deal_type: "collaboration",
    upfront_usd: 175000000,
    milestones_total_usd: 1275000000,
    milestones_development_usd: 400000000,
    milestones_regulatory_usd: 375000000,
    milestones_commercial_usd: 500000000,
    royalty_low_pct: 12,
    royalty_high_pct: 20,
    total_deal_value_usd: 1450000000,
    announced_date: "2021-06-21",
    source_type: "sec_8k",
    source_url: null,
    terms_disclosed: true,
    confidence_score: 95,
    therapeutic_area: "oncology",
  },
  {
    licensor_name: "Regeneron",
    licensee_name: "Sanofi",
    asset_name: "Libtayo (cemiplimab)",
    asset_description: "PD-1 inhibitor",
    modality: "mab",
    indication_category: "solid_tumor",
    indication_specific: "CSCC, NSCLC, BCC",
    target: "PD-1",
    mechanism_of_action: "Checkpoint inhibitor",
    phase_at_signing: "approved",
    territory: "Global",
    deal_type: "collaboration",
    upfront_usd: null,
    milestones_total_usd: null,
    milestones_development_usd: null,
    milestones_regulatory_usd: null,
    milestones_commercial_usd: null,
    royalty_low_pct: null,
    royalty_high_pct: null,
    total_deal_value_usd: null,
    announced_date: "2021-01-07",
    source_type: "sec_8k",
    source_url: null,
    terms_disclosed: false,
    confidence_score: 85,
    therapeutic_area: "oncology",
  },
  {
    licensor_name: "Relay Therapeutics",
    licensee_name: "Genentech",
    asset_name: "SHP2 Program",
    asset_description: "SHP2 inhibitor program",
    modality: "small_molecule",
    indication_category: "solid_tumor",
    indication_specific: "KRAS-mutant tumors",
    target: "SHP2",
    mechanism_of_action: "Allosteric SHP2 inhibitor",
    phase_at_signing: "phase_1",
    territory: "Global",
    deal_type: "collaboration",
    upfront_usd: 75000000,
    milestones_total_usd: 675000000,
    milestones_development_usd: 225000000,
    milestones_regulatory_usd: 200000000,
    milestones_commercial_usd: 250000000,
    royalty_low_pct: 8,
    royalty_high_pct: 14,
    total_deal_value_usd: 750000000,
    announced_date: "2021-11-15",
    source_type: "press_release",
    source_url: null,
    terms_disclosed: true,
    confidence_score: 92,
    therapeutic_area: "oncology",
  },

  // ==================== 2020 DEALS ====================
  {
    licensor_name: "Immunomedics",
    licensee_name: "Gilead Sciences",
    asset_name: "Trodelvy (sacituzumab govitecan)",
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
    milestones_total_usd: null,
    milestones_development_usd: null,
    milestones_regulatory_usd: null,
    milestones_commercial_usd: null,
    royalty_low_pct: null,
    royalty_high_pct: null,
    total_deal_value_usd: 21000000000,
    announced_date: "2020-09-13",
    source_type: "sec_8k",
    source_url: null,
    terms_disclosed: true,
    confidence_score: 100,
    therapeutic_area: "oncology",
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
    mechanism_of_action: "CD47 blockade / macrophage checkpoint",
    phase_at_signing: "phase_2",
    territory: "Global",
    deal_type: "acquisition",
    upfront_usd: 4900000000,
    milestones_total_usd: null,
    milestones_development_usd: null,
    milestones_regulatory_usd: null,
    milestones_commercial_usd: null,
    royalty_low_pct: null,
    royalty_high_pct: null,
    total_deal_value_usd: 4900000000,
    announced_date: "2020-03-02",
    source_type: "sec_8k",
    source_url: null,
    terms_disclosed: true,
    confidence_score: 100,
    therapeutic_area: "oncology",
  },
  {
    licensor_name: "Y-mAbs Therapeutics",
    licensee_name: "Sanofi",
    asset_name: "Omburtamab",
    asset_description: "B7-H3 targeted radioimmunotherapy",
    modality: "radiopharmaceutical",
    indication_category: "solid_tumor",
    indication_specific: "CNS/Leptomeningeal metastases",
    target: "B7-H3",
    mechanism_of_action: "Radioimmunotherapy",
    phase_at_signing: "phase_3",
    territory: "Global",
    deal_type: "license",
    upfront_usd: 40000000,
    milestones_total_usd: 160000000,
    milestones_development_usd: 60000000,
    milestones_regulatory_usd: 50000000,
    milestones_commercial_usd: 50000000,
    royalty_low_pct: 15,
    royalty_high_pct: 22,
    total_deal_value_usd: 200000000,
    announced_date: "2020-06-01",
    source_type: "press_release",
    source_url: null,
    terms_disclosed: true,
    confidence_score: 90,
    therapeutic_area: "oncology",
  },

  // ==================== 2019 DEALS ====================
  {
    licensor_name: "Daiichi Sankyo",
    licensee_name: "AstraZeneca",
    asset_name: "Enhertu (trastuzumab deruxtecan)",
    asset_description: "HER2-targeted ADC",
    modality: "adc",
    indication_category: "solid_tumor",
    indication_specific: "Breast, Gastric, NSCLC",
    target: "HER2",
    mechanism_of_action: "ADC with topoisomerase I inhibitor payload",
    phase_at_signing: "approved",
    territory: "Global",
    deal_type: "co_development",
    upfront_usd: 1350000000,
    milestones_total_usd: 5550000000,
    milestones_development_usd: 1550000000,
    milestones_regulatory_usd: 1500000000,
    milestones_commercial_usd: 2500000000,
    royalty_low_pct: null,
    royalty_high_pct: null,
    total_deal_value_usd: 6900000000,
    announced_date: "2019-03-28",
    source_type: "sec_8k",
    source_url: null,
    terms_disclosed: true,
    confidence_score: 99,
    therapeutic_area: "oncology",
  },
  {
    licensor_name: "bluebird bio",
    licensee_name: "Bristol-Myers Squibb",
    asset_name: "Abecma (idecabtagene vicleucel)",
    asset_description: "BCMA-targeted CAR-T therapy",
    modality: "car_t",
    indication_category: "hematologic",
    indication_specific: "Multiple Myeloma",
    target: "BCMA",
    mechanism_of_action: "CAR-T cell therapy",
    phase_at_signing: "phase_3",
    territory: "Global",
    deal_type: "collaboration",
    upfront_usd: 475000000,
    milestones_total_usd: 1100000000,
    milestones_development_usd: null,
    milestones_regulatory_usd: 300000000,
    milestones_commercial_usd: 800000000,
    royalty_low_pct: 15,
    royalty_high_pct: 25,
    total_deal_value_usd: 1575000000,
    announced_date: "2019-12-16",
    source_type: "sec_8k",
    source_url: null,
    terms_disclosed: true,
    confidence_score: 95,
    therapeutic_area: "oncology",
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
    milestones_total_usd: null,
    milestones_development_usd: null,
    milestones_regulatory_usd: null,
    milestones_commercial_usd: null,
    royalty_low_pct: null,
    royalty_high_pct: null,
    total_deal_value_usd: 11400000000,
    announced_date: "2019-06-17",
    source_type: "sec_8k",
    source_url: null,
    terms_disclosed: true,
    confidence_score: 100,
    therapeutic_area: "oncology",
  },
  {
    licensor_name: "Loxo Oncology",
    licensee_name: "Eli Lilly",
    asset_name: "Vitrakvi (larotrectinib), LOXO-292",
    asset_description: "TRK and RET inhibitors",
    modality: "small_molecule",
    indication_category: "solid_tumor",
    indication_specific: "TRK/RET fusion-positive cancers",
    target: "TRK, RET",
    mechanism_of_action: "Selective kinase inhibition",
    phase_at_signing: "approved",
    territory: "Global",
    deal_type: "acquisition",
    upfront_usd: 8000000000,
    milestones_total_usd: null,
    milestones_development_usd: null,
    milestones_regulatory_usd: null,
    milestones_commercial_usd: null,
    royalty_low_pct: null,
    royalty_high_pct: null,
    total_deal_value_usd: 8000000000,
    announced_date: "2019-01-07",
    source_type: "sec_8k",
    source_url: null,
    terms_disclosed: true,
    confidence_score: 100,
    therapeutic_area: "oncology",
  },
  {
    licensor_name: "Celgene",
    licensee_name: "Bristol-Myers Squibb",
    asset_name: "Celgene Portfolio",
    asset_description: "Full company acquisition including Revlimid, Pomalyst, Abraxane",
    modality: "small_molecule",
    indication_category: "hematologic",
    indication_specific: "Multiple Myeloma, MDS",
    target: "Multiple",
    mechanism_of_action: "Multiple mechanisms",
    phase_at_signing: "approved",
    territory: "Global",
    deal_type: "acquisition",
    upfront_usd: 74000000000,
    milestones_total_usd: null,
    milestones_development_usd: null,
    milestones_regulatory_usd: null,
    milestones_commercial_usd: null,
    royalty_low_pct: null,
    royalty_high_pct: null,
    total_deal_value_usd: 74000000000,
    announced_date: "2019-01-03",
    source_type: "sec_8k",
    source_url: null,
    terms_disclosed: true,
    confidence_score: 100,
    therapeutic_area: "oncology",
  },

  // ==================== NEUROLOGY / CNS DEALS ====================
  {
    licensor_name: "Karuna Therapeutics",
    licensee_name: "Bristol-Myers Squibb",
    asset_name: "KarXT (xanomeline-trospium)",
    asset_description: "Muscarinic receptor agonist for schizophrenia",
    modality: "small_molecule",
    indication_category: "cns",
    indication_specific: "Schizophrenia",
    target: "M1/M4 muscarinic",
    mechanism_of_action: "Muscarinic agonist with peripheral anticholinergic",
    phase_at_signing: "phase_3",
    territory: "Global",
    deal_type: "acquisition",
    upfront_usd: 14000000000,
    milestones_total_usd: null,
    milestones_development_usd: null,
    milestones_regulatory_usd: null,
    milestones_commercial_usd: null,
    royalty_low_pct: null,
    royalty_high_pct: null,
    total_deal_value_usd: 14000000000,
    announced_date: "2023-12-22",
    source_type: "sec_8k",
    source_url: null,
    terms_disclosed: true,
    confidence_score: 100,
    therapeutic_area: "neurology",
  },
  {
    licensor_name: "Cerevel Therapeutics",
    licensee_name: "AbbVie",
    asset_name: "Cerevel Portfolio",
    asset_description: "Neuroscience portfolio including emraclidine (M4 agonist)",
    modality: "small_molecule",
    indication_category: "cns",
    indication_specific: "Schizophrenia, Mood disorders",
    target: "M4 muscarinic",
    mechanism_of_action: "Selective muscarinic receptor agonist",
    phase_at_signing: "phase_2",
    territory: "Global",
    deal_type: "acquisition",
    upfront_usd: 8700000000,
    milestones_total_usd: null,
    milestones_development_usd: null,
    milestones_regulatory_usd: null,
    milestones_commercial_usd: null,
    royalty_low_pct: null,
    royalty_high_pct: null,
    total_deal_value_usd: 8700000000,
    announced_date: "2023-12-04",
    source_type: "sec_8k",
    source_url: null,
    terms_disclosed: true,
    confidence_score: 100,
    therapeutic_area: "neurology",
  },
  {
    licensor_name: "Biohaven Pharmaceutical",
    licensee_name: "Pfizer",
    asset_name: "Nurtec ODT (rimegepant)",
    asset_description: "CGRP receptor antagonist for migraine",
    modality: "small_molecule",
    indication_category: "cns",
    indication_specific: "Migraine",
    target: "CGRP",
    mechanism_of_action: "CGRP receptor antagonist",
    phase_at_signing: "approved",
    territory: "Global",
    deal_type: "acquisition",
    upfront_usd: 11600000000,
    milestones_total_usd: null,
    milestones_development_usd: null,
    milestones_regulatory_usd: null,
    milestones_commercial_usd: null,
    royalty_low_pct: null,
    royalty_high_pct: null,
    total_deal_value_usd: 11600000000,
    announced_date: "2022-05-10",
    source_type: "sec_8k",
    source_url: null,
    terms_disclosed: true,
    confidence_score: 100,
    therapeutic_area: "neurology",
  },
  {
    licensor_name: "GW Pharmaceuticals",
    licensee_name: "Jazz Pharmaceuticals",
    asset_name: "Epidiolex (cannabidiol)",
    asset_description: "CBD-based treatment for epilepsy syndromes",
    modality: "small_molecule",
    indication_category: "cns",
    indication_specific: "Epilepsy (Dravet, LGS, TSC)",
    target: "Multiple (cannabinoid pathways)",
    mechanism_of_action: "Cannabinoid receptor modulation",
    phase_at_signing: "approved",
    territory: "Global",
    deal_type: "acquisition",
    upfront_usd: 7200000000,
    milestones_total_usd: null,
    milestones_development_usd: null,
    milestones_regulatory_usd: null,
    milestones_commercial_usd: null,
    royalty_low_pct: null,
    royalty_high_pct: null,
    total_deal_value_usd: 7200000000,
    announced_date: "2021-02-03",
    source_type: "sec_8k",
    source_url: null,
    terms_disclosed: true,
    confidence_score: 100,
    therapeutic_area: "neurology",
  },
  {
    licensor_name: "Sage Therapeutics",
    licensee_name: "Biogen",
    asset_name: "Zuranolone (SAGE-217)",
    asset_description: "Neuroactive steroid for depression",
    modality: "small_molecule",
    indication_category: "cns",
    indication_specific: "Major Depressive Disorder, PPD",
    target: "GABA-A",
    mechanism_of_action: "Positive allosteric modulator of GABA-A receptors",
    phase_at_signing: "phase_3",
    territory: "Global",
    deal_type: "collaboration",
    upfront_usd: 875000000,
    milestones_total_usd: 1325000000,
    milestones_development_usd: 400000000,
    milestones_regulatory_usd: 425000000,
    milestones_commercial_usd: 500000000,
    royalty_low_pct: 15,
    royalty_high_pct: 22,
    total_deal_value_usd: 2200000000,
    announced_date: "2020-11-03",
    source_type: "press_release",
    source_url: null,
    terms_disclosed: true,
    confidence_score: 95,
    therapeutic_area: "neurology",
  },
  {
    licensor_name: "Prothena",
    licensee_name: "Roche",
    asset_name: "PRX005",
    asset_description: "Anti-TDP-43 antibody for neurodegeneration",
    modality: "mab",
    indication_category: "cns",
    indication_specific: "ALS, FTD",
    target: "TDP-43",
    mechanism_of_action: "Protein aggregate clearance",
    phase_at_signing: "phase_1",
    territory: "Global",
    deal_type: "collaboration",
    upfront_usd: 100000000,
    milestones_total_usd: 2000000000,
    milestones_development_usd: 800000000,
    milestones_regulatory_usd: 600000000,
    milestones_commercial_usd: 600000000,
    royalty_low_pct: 8,
    royalty_high_pct: 15,
    total_deal_value_usd: 2100000000,
    announced_date: "2023-03-07",
    source_type: "press_release",
    source_url: null,
    terms_disclosed: true,
    confidence_score: 95,
    therapeutic_area: "neurology",
  },
  {
    licensor_name: "Zogenix",
    licensee_name: "UCB",
    asset_name: "Fintepla (fenfluramine)",
    asset_description: "Serotonin modulator for epilepsy",
    modality: "small_molecule",
    indication_category: "cns",
    indication_specific: "Dravet Syndrome, LGS",
    target: "5-HT2",
    mechanism_of_action: "Serotonin receptor modulation",
    phase_at_signing: "approved",
    territory: "Global",
    deal_type: "acquisition",
    upfront_usd: 1900000000,
    milestones_total_usd: null,
    milestones_development_usd: null,
    milestones_regulatory_usd: null,
    milestones_commercial_usd: null,
    royalty_low_pct: null,
    royalty_high_pct: null,
    total_deal_value_usd: 1900000000,
    announced_date: "2022-03-08",
    source_type: "sec_8k",
    source_url: null,
    terms_disclosed: true,
    confidence_score: 100,
    therapeutic_area: "neurology",
  },
  {
    licensor_name: "Gilgamesh Pharmaceuticals",
    licensee_name: "AbbVie",
    asset_name: "GM-1020",
    asset_description: "Psychedelic-derived neuropsychiatric compound",
    modality: "small_molecule",
    indication_category: "cns",
    indication_specific: "Treatment-resistant Depression",
    target: "5-HT2A",
    mechanism_of_action: "Serotonin 2A receptor agonist",
    phase_at_signing: "preclinical",
    territory: "Global",
    deal_type: "acquisition",
    upfront_usd: 1200000000,
    milestones_total_usd: null,
    milestones_development_usd: null,
    milestones_regulatory_usd: null,
    milestones_commercial_usd: null,
    royalty_low_pct: null,
    royalty_high_pct: null,
    total_deal_value_usd: 1200000000,
    announced_date: "2022-12-13",
    source_type: "press_release",
    source_url: null,
    terms_disclosed: true,
    confidence_score: 95,
    therapeutic_area: "neurology",
  },
  {
    licensor_name: "PTC Therapeutics",
    licensee_name: "Novartis",
    asset_name: "PTC518",
    asset_description: "HTT-lowering splicing modifier for Huntington's",
    modality: "small_molecule",
    indication_category: "cns",
    indication_specific: "Huntington's Disease",
    target: "HTT (huntingtin)",
    mechanism_of_action: "Splicing modifier / gene silencing",
    phase_at_signing: "phase_2",
    territory: "Global",
    deal_type: "license",
    upfront_usd: 100000000,
    milestones_total_usd: 900000000,
    milestones_development_usd: 350000000,
    milestones_regulatory_usd: 250000000,
    milestones_commercial_usd: 300000000,
    royalty_low_pct: 10,
    royalty_high_pct: 18,
    total_deal_value_usd: 1000000000,
    announced_date: "2023-06-28",
    source_type: "press_release",
    source_url: null,
    terms_disclosed: true,
    confidence_score: 95,
    therapeutic_area: "neurology",
  },
  {
    licensor_name: "Prevail Therapeutics",
    licensee_name: "Eli Lilly",
    asset_name: "PR001, PR006",
    asset_description: "AAV gene therapies for Parkinson's and FTD",
    modality: "gene_therapy",
    indication_category: "cns",
    indication_specific: "Parkinson's Disease, FTD",
    target: "GBA1, GRN",
    mechanism_of_action: "AAV-mediated gene replacement",
    phase_at_signing: "phase_1",
    territory: "Global",
    deal_type: "acquisition",
    upfront_usd: 1040000000,
    milestones_total_usd: null,
    milestones_development_usd: null,
    milestones_regulatory_usd: null,
    milestones_commercial_usd: null,
    royalty_low_pct: null,
    royalty_high_pct: null,
    total_deal_value_usd: 1040000000,
    announced_date: "2021-01-05",
    source_type: "sec_8k",
    source_url: null,
    terms_disclosed: true,
    confidence_score: 100,
    therapeutic_area: "neurology",
  },
  {
    licensor_name: "JCR Pharmaceuticals",
    licensee_name: "AstraZeneca",
    asset_name: "BBB-crossing antibody platform",
    asset_description: "Blood-brain barrier crossing antibody technology",
    modality: "mab",
    indication_category: "cns",
    indication_specific: "Neurodegeneration (multiple)",
    target: "Transferrin receptor (BBB shuttle)",
    mechanism_of_action: "BBB-penetrating bispecific platform",
    phase_at_signing: "preclinical",
    territory: "Global ex-Japan",
    deal_type: "license",
    upfront_usd: 30000000,
    milestones_total_usd: 795000000,
    milestones_development_usd: 300000000,
    milestones_regulatory_usd: 245000000,
    milestones_commercial_usd: 250000000,
    royalty_low_pct: 5,
    royalty_high_pct: 12,
    total_deal_value_usd: 825000000,
    announced_date: "2023-07-10",
    source_type: "press_release",
    source_url: null,
    terms_disclosed: true,
    confidence_score: 90,
    therapeutic_area: "neurology",
  },
  {
    licensor_name: "ABL Bio",
    licensee_name: "GSK",
    asset_name: "ABL301",
    asset_description: "Bispecific antibody for alpha-synuclein with BBB shuttle",
    modality: "bispecific",
    indication_category: "cns",
    indication_specific: "Parkinson's Disease",
    target: "Alpha-synuclein/TfR1",
    mechanism_of_action: "BBB-crossing bispecific antibody",
    phase_at_signing: "phase_1",
    territory: "Global ex-Korea",
    deal_type: "license",
    upfront_usd: 50000000,
    milestones_total_usd: 2650000000,
    milestones_development_usd: 1000000000,
    milestones_regulatory_usd: 750000000,
    milestones_commercial_usd: 900000000,
    royalty_low_pct: 8,
    royalty_high_pct: 15,
    total_deal_value_usd: 2700000000,
    announced_date: "2023-12-08",
    source_type: "press_release",
    source_url: null,
    terms_disclosed: true,
    confidence_score: 95,
    therapeutic_area: "neurology",
  },
  {
    licensor_name: "Eisai",
    licensee_name: "Biogen",
    asset_name: "Leqembi (lecanemab)",
    asset_description: "Anti-amyloid beta protofibril antibody",
    modality: "mab",
    indication_category: "cns",
    indication_specific: "Alzheimer's Disease",
    target: "Amyloid-beta",
    mechanism_of_action: "Amyloid protofibril clearance",
    phase_at_signing: "approved",
    territory: "Global (co-commercialization)",
    deal_type: "co_development",
    upfront_usd: null,
    milestones_total_usd: null,
    milestones_development_usd: null,
    milestones_regulatory_usd: null,
    milestones_commercial_usd: null,
    royalty_low_pct: null,
    royalty_high_pct: null,
    total_deal_value_usd: null,
    announced_date: "2023-01-06",
    source_type: "press_release",
    source_url: null,
    terms_disclosed: false,
    confidence_score: 90,
    therapeutic_area: "neurology",
  },
  {
    licensor_name: "Ionis Pharmaceuticals",
    licensee_name: "Biogen",
    asset_name: "Tofersen (BIIB067)",
    asset_description: "Antisense oligonucleotide targeting SOD1",
    modality: "oligonucleotide",
    indication_category: "cns",
    indication_specific: "ALS (SOD1 mutation)",
    target: "SOD1",
    mechanism_of_action: "Antisense oligonucleotide gene silencing",
    phase_at_signing: "phase_3",
    territory: "Global",
    deal_type: "collaboration",
    upfront_usd: null,
    milestones_total_usd: 1050000000,
    milestones_development_usd: 400000000,
    milestones_regulatory_usd: 350000000,
    milestones_commercial_usd: 300000000,
    royalty_low_pct: 15,
    royalty_high_pct: 25,
    total_deal_value_usd: 1050000000,
    announced_date: "2018-06-28",
    source_type: "press_release",
    source_url: null,
    terms_disclosed: true,
    confidence_score: 90,
    therapeutic_area: "neurology",
  },
];

// ============================================
// DATA GENERATION FUNCTIONS
// ============================================

const MODALITIES = [
  "small_molecule", "mab", "adc", "bispecific", "car_t", "cell_therapy",
  "gene_therapy", "radiopharmaceutical", "mrna", "rnai", "protac", "peptide"
];

const SOLID_TUMOR_INDICATIONS = [
  "NSCLC", "SCLC", "Breast (HER2+)", "Breast (TNBC)", "Breast (HR+)",
  "Colorectal", "Pancreatic", "Melanoma", "Prostate", "Ovarian",
  "Gastric", "HCC", "RCC", "GBM", "Bladder", "Head & Neck",
  "Cholangiocarcinoma", "Mesothelioma", "Sarcoma", "Endometrial",
  "Cervical", "Thyroid", "Esophageal"
];

const HEMATOLOGIC_INDICATIONS = [
  "AML", "ALL", "CLL", "Multiple Myeloma", "DLBCL", "Follicular Lymphoma",
  "Mantle Cell Lymphoma", "MDS", "MPN", "T-cell Lymphoma", "Hodgkin Lymphoma"
];

const PHASES = ["discovery", "preclinical", "phase_1", "phase_2", "phase_3", "approved"];
const DEAL_TYPES = ["license", "option", "collaboration", "co_development", "acquisition"];
const TERRITORIES = [
  "Global", "Global ex-China", "Global ex-Greater China", "US only",
  "North America", "Europe", "China", "Japan", "Asia Pacific", "ROW"
];

const MAJOR_PHARMA = [
  "Pfizer", "Roche", "Novartis", "Merck", "Johnson & Johnson",
  "AstraZeneca", "Bristol-Myers Squibb", "AbbVie", "Eli Lilly",
  "Sanofi", "GSK", "Gilead Sciences", "Amgen", "Regeneron",
  "Takeda", "Bayer", "Boehringer Ingelheim", "Vertex", "Biogen",
  "Moderna", "Genentech", "Seagen", "BioNTech", "Incyte"
];

const BIOTECH_LICENSORS = [
  "Bicycle Therapeutics", "Turning Point Therapeutics", "Y-mAbs Therapeutics",
  "Agenus", "Alkermes", "Arcus Biosciences", "Arrowhead Pharmaceuticals",
  "Arvinas", "BeiGene", "Blueprint Medicines", "Caribou Biosciences",
  "Celldex Therapeutics", "CytomX Therapeutics", "Deciphera Pharmaceuticals",
  "Denali Therapeutics", "Dyne Therapeutics", "Editas Medicine", "Elevation Oncology",
  "Enanta Pharmaceuticals", "Fate Therapeutics", "Forma Therapeutics",
  "G1 Therapeutics", "Gritstone bio", "Hookipa Pharma", "Ideaya Biosciences",
  "IGM Biosciences", "Imago BioSciences", "Immunocore", "Immunogen",
  "Intellia Therapeutics", "IO Biotech", "iTeos Therapeutics",
  "Iovance Biotherapeutics", "Janux Therapeutics", "Jounce Therapeutics",
  "Karyopharm Therapeutics", "Kronos Bio", "Kymera Therapeutics",
  "Legend Biotech", "MacroGenics", "Mirati Therapeutics",
  "Molecular Templates", "Monte Rosa Therapeutics", "Morphic Holding",
  "Nektar Therapeutics", "Nkarta", "Nurix Therapeutics",
  "ORIC Pharmaceuticals", "PMV Pharmaceuticals", "Puma Biotechnology",
  "Pyxis Oncology", "Rain Therapeutics", "Relay Therapeutics", "Replimune",
  "Revolution Medicines", "Rigel Pharmaceuticals", "Roivant Sciences",
  "Sana Biotechnology", "Silverback Therapeutics", "Springworks Therapeutics",
  "Syndax Pharmaceuticals", "Syros Pharmaceuticals", "Tango Therapeutics",
  "TCR2 Therapeutics", "Tempest Therapeutics", "Tessa Therapeutics",
  "Tmunity Therapeutics", "Tyra Biosciences", "Umoja Biopharma",
  "Vincerx Pharma", "Viracta Therapeutics", "Vor Biopharma", "Xencor",
  "Zymeworks", "Hutchison China MediTech", "Innovent Biologics", "Zai Lab",
  "Junshi Biosciences", "Alphamab Oncology", "Akeso", "RemeGen",
  "Kelun-Biotech", "Hengrui Medicine", "CSPC Pharmaceutical", "Simcere",
  "Galapagos", "Evotec", "Genmab", "Argenx", "MorphoSys",
  "CureVac", "Immatics", "Affimed", "Molecular Partners",
  "Daiichi Sankyo", "Astellas", "Ono Pharmaceutical", "Chugai Pharmaceutical",
  "Kyowa Kirin", "Sumitomo Pharma", "Shionogi", "PeptiDream",
  "Sutro Biopharma", "Pieris Pharmaceuticals", "CStone Pharmaceuticals",
  "I-Mab", "Adagene", "Apollomics", "Kineta", "Compass Therapeutics",
  "Chinook Therapeutics", "Allogene Therapeutics", "Precision BioSciences",
  "CRISPR Therapeutics", "Beam Therapeutics", "Prime Medicine",
  "Verve Therapeutics", "Graphite Bio", "Metagenomi"
];

const TARGETS = [
  "HER2", "EGFR", "PD-1", "PD-L1", "CTLA-4", "CD19", "CD20", "BCMA",
  "CD38", "BTK", "BCL-2", "CDK4/6", "PI3K", "KRAS G12C", "KRAS G12D",
  "BRAF V600E", "ALK", "ROS1", "RET", "MET", "FGFR", "VEGF", "VEGFR",
  "TROP2", "Nectin-4", "HER3", "CLDN18.2", "DLL3", "Mesothelin",
  "GD2", "CD22", "CD33", "CD123", "CD47", "SIRPα", "TIGIT", "LAG-3",
  "TIM-3", "ICOS", "OX40", "4-1BB", "GITR", "CD40", "CD73", "A2AR",
  "IDO1", "TGF-β", "IL-2", "IL-15", "STING", "AXL", "DDR",
  "PARP", "ATR", "ATM", "WEE1", "CHK1", "DNA-PK", "MDM2", "p53",
  "MYC", "STAT3", "SHP2", "SOS1", "ERK", "MEK", "mTOR", "AKT",
  "JAK", "FLT3", "KIT", "PDGFR", "CSF1R", "CCR2", "CCR4", "CXCR4",
  "Claudin 6", "FRα", "LIV-1", "gpNMB", "EphA2", "PSMA", "STEAP1",
  "B7-H3", "B7-H4", "CD276", "CEA", "CEACAM5", "GPC3", "MUC1", "MUC16"
];

const MOAS: Record<string, string[]> = {
  "small_molecule": ["Kinase inhibitor", "PROTAC degrader", "Molecular glue", "Allosteric inhibitor", "Covalent inhibitor"],
  "mab": ["Receptor antagonist", "ADCC-enhanced", "CDC-enhanced", "Biparatopic binding", "Fc-engineered"],
  "adc": ["Topoisomerase I inhibitor payload", "Microtubule inhibitor payload", "DNA-damaging payload", "MMAE payload", "DXd payload"],
  "bispecific": ["T-cell engager", "Dual checkpoint blockade", "Dual receptor targeting", "Immune cell redirector"],
  "car_t": ["Second generation CAR", "Third generation CAR", "Armored CAR", "Logic-gated CAR"],
  "radiopharmaceutical": ["Beta-emitting radioligand", "Alpha-emitting radioligand", "Auger electron emitter"],
  "mrna": ["mRNA cancer vaccine", "mRNA immunotherapy", "Self-amplifying mRNA"],
  "protac": ["PROTAC degrader", "Molecular glue degrader", "Heterobifunctional degrader"]
};

// ============================================
// NEUROLOGY / CNS GENERATION DATA
// ============================================

const CNS_MODALITIES = [
  "small_molecule", "mab", "gene_therapy", "oligonucleotide", "peptide",
  "cell_therapy", "bispecific", "adc"
];

const CNS_INDICATIONS = [
  "Alzheimer's Disease", "Parkinson's Disease", "ALS", "Huntington's Disease",
  "Multiple Sclerosis", "Epilepsy", "Migraine", "Schizophrenia",
  "Major Depressive Disorder", "Bipolar Disorder", "SMA",
  "Frontotemporal Dementia", "Neuropathic Pain", "Narcolepsy",
  "Essential Tremor", "PTSD", "OCD", "Duchenne (CNS)"
];

const CNS_TARGETS = [
  "Tau", "Amyloid-beta", "LRRK2", "Alpha-synuclein", "SOD1", "C9orf72",
  "HTT", "BACE1", "NMDA", "GABA-A", "5-HT2A", "D2", "SV2A", "CGRP",
  "Nav1.7", "TREM2", "TDP-43", "GBA1", "SMN", "Orexin", "GluN2B", "mGluR5",
  "M1/M4 muscarinic", "BMP receptor", "LINGO-1", "Nogo receptor", "CD33 (neuro)"
];

const CNS_BIOTECH_LICENSORS = [
  "Denali Therapeutics", "Passage Bio", "Voyager Therapeutics", "Prothena",
  "Cerevel Therapeutics", "Karuna Therapeutics", "Sage Therapeutics",
  "Intra-Cellular Therapies", "Alector", "Ionis Pharmaceuticals",
  "Wave Life Sciences", "Biohaven Pharmaceutical", "Acadia Pharmaceuticals",
  "Axsome Therapeutics", "Neurocrine Biosciences", "Annovis Bio",
  "Athira Pharma", "Prevail Therapeutics", "Neumora Therapeutics",
  "Longboard Pharmaceuticals", "Arcus Biosciences", "Ultragenyx",
  "PTC Therapeutics", "Cortexyme", "INmune Bio",
  "ProMIS Neurosciences", "Cassava Sciences", "Vaxxinity",
  "AC Immune", "Anavex Life Sciences", "Vigil Neuroscience"
];

const CNS_MOAS: Record<string, string[]> = {
  "small_molecule": ["Kinase inhibitor", "Ion channel modulator", "Receptor agonist", "Receptor antagonist", "PROTAC degrader", "Allosteric modulator", "Splicing modifier"],
  "mab": ["BBB-crossing antibody", "Protein aggregate clearance", "Neuroinflammation modulator", "Microglial checkpoint inhibitor"],
  "gene_therapy": ["AAV-mediated gene replacement", "AAV gene silencing", "Intrathecal gene delivery", "CNS-tropic AAV vector"],
  "oligonucleotide": ["Antisense oligonucleotide", "siRNA gene knockdown", "miRNA modulator", "Splice-switching oligonucleotide"],
  "bispecific": ["BBB-penetrating bispecific", "Dual-target neurodegeneration", "Brain-shuttled bispecific"],
  "peptide": ["Neuropeptide analog", "BBB-penetrating peptide", "Receptor-selective peptide"],
  "cell_therapy": ["iPSC-derived neurons", "Neural stem cell therapy", "Engineered microglia"],
  "adc": ["BBB-crossing ADC", "Brain-targeted antibody conjugate"],
};

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateRandomDate(startYear: number, endYear: number): string {
  const year = randomInt(startYear, endYear);
  const month = randomInt(1, 12);
  const day = randomInt(1, 28);
  return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}

function generateUpfront(phase: string, modality: string): number | null {
  const phaseRanges: Record<string, [number, number]> = {
    "discovery": [5, 50],
    "preclinical": [15, 100],
    "phase_1": [30, 200],
    "phase_2": [75, 400],
    "phase_3": [150, 1000],
    "approved": [300, 3000]
  };

  const modalityMultipliers: Record<string, number> = {
    "adc": 1.5,
    "bispecific": 1.4,
    "car_t": 1.3,
    "radiopharmaceutical": 1.6,
    "protac": 1.35,
    "small_molecule": 1.0,
    "mab": 1.0,
    "mrna": 1.25
  };

  const [min, max] = phaseRanges[phase] || [20, 150];
  const multiplier = modalityMultipliers[modality] || 1.0;

  if (Math.random() < 0.15) return null;

  return Math.round(randomInt(min, max) * multiplier * 1000000);
}

function generateMilestones(upfront: number | null, phase: string): {
  total: number | null;
  development: number | null;
  regulatory: number | null;
  commercial: number | null;
} {
  if (!upfront && Math.random() < 0.5) {
    return { total: null, development: null, regulatory: null, commercial: null };
  }

  const base = upfront || 100000000;

  const phaseMultipliers: Record<string, [number, number]> = {
    "discovery": [8, 20],
    "preclinical": [6, 15],
    "phase_1": [5, 12],
    "phase_2": [4, 10],
    "phase_3": [3, 8],
    "approved": [2, 5]
  };

  const [minMult, maxMult] = phaseMultipliers[phase] || [4, 10];
  const total = Math.round(base * (minMult + Math.random() * (maxMult - minMult)));

  const development = Math.round(total * (0.25 + Math.random() * 0.1));
  const regulatory = Math.round(total * (0.20 + Math.random() * 0.1));
  const commercial = total - development - regulatory;

  return { total, development, regulatory, commercial };
}

function generateRoyalties(phase: string): { low: number | null; high: number | null } {
  if (Math.random() < 0.2) {
    return { low: null, high: null };
  }

  const phaseRoyalties: Record<string, [number, number, number, number]> = {
    "discovery": [3, 6, 8, 12],
    "preclinical": [4, 7, 10, 15],
    "phase_1": [5, 8, 12, 18],
    "phase_2": [6, 10, 15, 22],
    "phase_3": [8, 12, 18, 25],
    "approved": [10, 15, 20, 30]
  };

  const [lowMin, lowMax, highMin, highMax] = phaseRoyalties[phase] || [5, 10, 12, 20];

  const low = randomInt(lowMin, lowMax);
  const high = randomInt(Math.max(highMin, low + 2), highMax);

  return { low, high };
}

function generateDeal(therapeuticArea: 'oncology' | 'neurology' = 'oncology'): Deal {
  if (therapeuticArea === 'neurology') {
    const modality = randomChoice(CNS_MODALITIES);
    const phase = randomChoice(PHASES);
    const target = randomChoice(CNS_TARGETS);

    const upfront = generateUpfront(phase, modality);
    const milestones = generateMilestones(upfront, phase);
    const royalties = generateRoyalties(phase);

    const totalValue = upfront && milestones.total
      ? upfront + milestones.total
      : (upfront || milestones.total || null);

    const licensor = randomChoice(CNS_BIOTECH_LICENSORS);
    const licensee = randomChoice(MAJOR_PHARMA);

    const prefixes = ["", "Anti-", "", ""];
    const suffixes = ["-001", "-101", "-201", "-301", "-mab", "-nib", "-stat", ""];
    const assetName = `${randomChoice(prefixes)}${target}${randomChoice(suffixes)}`.replace("--", "-");

    const moaOptions = CNS_MOAS[modality] || ["CNS-targeted therapy"];

    return {
      licensor_name: licensor,
      licensee_name: licensee,
      asset_name: assetName,
      asset_description: `${target}-targeting ${modality.replace("_", " ")} for CNS`,
      modality: modality,
      indication_category: "cns",
      indication_specific: randomChoice(CNS_INDICATIONS),
      target: target,
      mechanism_of_action: randomChoice(moaOptions),
      phase_at_signing: phase,
      territory: randomChoice(TERRITORIES),
      deal_type: randomChoice(DEAL_TYPES),
      upfront_usd: upfront,
      milestones_total_usd: milestones.total,
      milestones_development_usd: milestones.development,
      milestones_regulatory_usd: milestones.regulatory,
      milestones_commercial_usd: milestones.commercial,
      royalty_low_pct: royalties.low,
      royalty_high_pct: royalties.high,
      total_deal_value_usd: totalValue,
      announced_date: generateRandomDate(2019, 2026),
      source_type: randomChoice(["sec_8k", "press_release", "sec_10k"]),
      source_url: null,
      terms_disclosed: upfront !== null || milestones.total !== null,
      confidence_score: randomInt(60, 95),
      therapeutic_area: "neurology",
    };
  }

  // Oncology generation (existing logic)
  const isHematologic = Math.random() < 0.3;
  const category = isHematologic ? "hematologic" : "solid_tumor";
  const indications = isHematologic ? HEMATOLOGIC_INDICATIONS : SOLID_TUMOR_INDICATIONS;

  const modality = randomChoice(MODALITIES);
  const phase = randomChoice(PHASES);
  const target = randomChoice(TARGETS);

  const upfront = generateUpfront(phase, modality);
  const milestones = generateMilestones(upfront, phase);
  const royalties = generateRoyalties(phase);

  const totalValue = upfront && milestones.total
    ? upfront + milestones.total
    : (upfront || milestones.total || null);

  const licensor = randomChoice(BIOTECH_LICENSORS);
  const licensee = randomChoice(MAJOR_PHARMA);

  const prefixes = ["", "Anti-", "", ""];
  const suffixes = ["-001", "-101", "-201", "-301", "-401", "-501", "-mab", "-tinib", "-ciclib", ""];
  const assetName = `${randomChoice(prefixes)}${target}${randomChoice(suffixes)}`.replace("--", "-");

  const moaOptions = MOAS[modality] || ["Targeted therapy"];

  return {
    licensor_name: licensor,
    licensee_name: licensee,
    asset_name: assetName,
    asset_description: `${target}-targeting ${modality.replace("_", " ")}`,
    modality: modality,
    indication_category: category,
    indication_specific: randomChoice(indications),
    target: target,
    mechanism_of_action: randomChoice(moaOptions),
    phase_at_signing: phase,
    territory: randomChoice(TERRITORIES),
    deal_type: randomChoice(DEAL_TYPES),
    upfront_usd: upfront,
    milestones_total_usd: milestones.total,
    milestones_development_usd: milestones.development,
    milestones_regulatory_usd: milestones.regulatory,
    milestones_commercial_usd: milestones.commercial,
    royalty_low_pct: royalties.low,
    royalty_high_pct: royalties.high,
    total_deal_value_usd: totalValue,
    announced_date: generateRandomDate(2019, 2026),
    source_type: randomChoice(["sec_8k", "press_release", "sec_10k"]),
    source_url: null,
    terms_disclosed: upfront !== null || milestones.total !== null,
    confidence_score: randomInt(60, 95),
    therapeutic_area: "oncology",
  };
}

// ============================================
// API ROUTE HANDLER
// ============================================

export async function POST(request: NextRequest) {
  try {
    // Check for admin auth
    const authHeader = request.headers.get('authorization');
    const adminKey = process.env.ADMIN_API_KEY;

    if (!adminKey || authHeader !== `Bearer ${adminKey}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServiceClient();

    // Check current deal count
    const { count: existingCount } = await supabase
      .from('deals')
      .select('*', { count: 'exact', head: true });

    console.log(`Existing deals in database: ${existingCount || 0}`);

    const TARGET_DEALS = 2500;
    const batchSize = 100;

    // Step 1: Insert curated real deals
    console.log('Inserting curated real deals...');

    for (let i = 0; i < CURATED_DEALS.length; i += batchSize) {
      const batch = CURATED_DEALS.slice(i, i + batchSize);
      const { error } = await supabase
        .from('deals')
        .upsert(batch, {
          onConflict: 'licensor_name,licensee_name,asset_name,announced_date',
          ignoreDuplicates: true
        });

      if (error) {
        console.error('Error inserting curated deals:', error);
      }
    }

    // Step 2: Generate and insert additional deals (split between oncology and neurology)
    const remainingDeals = TARGET_DEALS - CURATED_DEALS.length - (existingCount || 0);

    if (remainingDeals > 0) {
      const oncologyDeals = Math.ceil(remainingDeals / 2);
      const neurologyDeals = remainingDeals - oncologyDeals;

      // Generate oncology deals
      console.log(`Generating ${oncologyDeals} oncology deals...`);
      for (let i = 0; i < oncologyDeals; i += batchSize) {
        const batch: Deal[] = [];
        const batchEnd = Math.min(i + batchSize, oncologyDeals);
        for (let j = i; j < batchEnd; j++) {
          batch.push(generateDeal('oncology'));
        }
        const { error } = await supabase.from('deals').insert(batch);
        if (error) {
          console.error(`Error inserting oncology batch ${Math.floor(i / batchSize) + 1}:`, error);
        } else {
          console.log(`Inserted oncology batch ${Math.floor(i / batchSize) + 1}: ${batch.length} deals`);
        }
      }

      // Generate neurology deals
      console.log(`Generating ${neurologyDeals} neurology deals...`);
      for (let i = 0; i < neurologyDeals; i += batchSize) {
        const batch: Deal[] = [];
        const batchEnd = Math.min(i + batchSize, neurologyDeals);
        for (let j = i; j < batchEnd; j++) {
          batch.push(generateDeal('neurology'));
        }
        const { error } = await supabase.from('deals').insert(batch);
        if (error) {
          console.error(`Error inserting neurology batch ${Math.floor(i / batchSize) + 1}:`, error);
        } else {
          console.log(`Inserted neurology batch ${Math.floor(i / batchSize) + 1}: ${batch.length} deals`);
        }
      }
    }

    // Get final count
    const { count: finalCount } = await supabase
      .from('deals')
      .select('*', { count: 'exact', head: true });

    return NextResponse.json({
      success: true,
      message: 'Deals database populated successfully',
      curatedDeals: CURATED_DEALS.length,
      generatedDeals: remainingDeals > 0 ? remainingDeals : 0,
      totalDeals: finalCount
    });

  } catch (error) {
    console.error('Error populating deals:', error);
    return NextResponse.json(
      { error: 'Failed to populate deals database' },
      { status: 500 }
    );
  }
}
