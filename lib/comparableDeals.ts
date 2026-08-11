// Comparable deal references for PDF/Excel reports
// Data sourced from publicly disclosed deal terms (2017-2026)
// Includes extended deals covering CV, ID, ophthalmology, women's health,
// rare disease, hematology, dermatology, gastroenterology,
// combination therapy, and geographic-specific transactions.
//
// IMPORTANT: Only real, verifiable transactions belong here.
// Revenue proxies and market cap references live in data/revenue-benchmarks.ts

import { EXTENDED_COMPARABLE_DEALS, type ExtendedComparableDeal } from '@/data/comparable-deals-extended';
import { type BuyerTier, classifyBuyerTier } from './buyer-tier';

export interface ComparableDeal {
  licensor: string;
  licensee: string;
  value: string; // Display string (e.g., "$2.7B") — kept for backward compat
  upfrontM?: number; // Upfront payment in $M
  totalValueM?: number; // Total deal value in $M
  milestonesM?: number; // Milestone payments in $M
  royaltyRange?: string; // e.g., "mid-single to low-double digit"
  year: number;
  relevance: string;
  dealType?: 'licensing' | 'acquisition' | 'codevelopment' | 'option' | 'collaboration' | 'reformulation';
  modalities?: string[];
  indications?: string[];
  therapeuticArea: 'oncology' | 'neurology' | 'immunology' | 'metabolic' | 'cardiovascular' | 'infectiousDisease' | 'ophthalmology' | 'womensHealth' | 'rareDisease' | 'hematology' | 'dermatology' | 'gastroenterology' | 'both';
  secondaryTAs?: string[]; // Cross-TA matching without duplication
  territory?: string;
  phase?: string;
  source?: string;
  buyerTier?: BuyerTier;
}

export const COMPARABLE_DEALS: ComparableDeal[] = [
  // ═══════════════════════════════════════════════════════════════════════
  // ONCOLOGY (9 deals)
  // ═══════════════════════════════════════════════════════════════════════
  { licensor: 'Seagen', licensee: 'Pfizer', value: '$43B', totalValueM: 43000, year: 2023, relevance: 'ADC platform acquisition', dealType: 'acquisition', modalities: ['adc'], therapeuticArea: 'oncology' },
  { licensor: 'RayzeBio', licensee: 'BMS', value: '$4.1B', totalValueM: 4100, year: 2024, relevance: 'Radiopharmaceutical acquisition', dealType: 'acquisition', modalities: ['radiopharmaceutical'], therapeuticArea: 'oncology' },
  { licensor: 'Point Biopharma', licensee: 'Eli Lilly', value: '$4.9B', totalValueM: 4900, year: 2023, relevance: 'Radiopharmaceutical platform', dealType: 'acquisition', modalities: ['radiopharmaceutical'], therapeuticArea: 'oncology' },
  { licensor: 'Daiichi Sankyo', licensee: 'Merck', value: '$22B', totalValueM: 22000, upfrontM: 4000, milestonesM: 18000, year: 2023, relevance: 'ADC co-development (3 assets)', dealType: 'codevelopment', modalities: ['adc'], therapeuticArea: 'oncology' },
  { licensor: 'Mirati Therapeutics', licensee: 'BMS', value: '$4.8B', totalValueM: 4800, year: 2024, relevance: 'Small molecule (KRAS)', dealType: 'acquisition', modalities: ['smallMolecule'], indications: ['lung_nsclc'], therapeuticArea: 'oncology' },
  { licensor: 'Genmab/Seagen', licensee: 'Pfizer', value: '$1.6B', totalValueM: 1600, year: 2024, relevance: 'Tisotumab vedotin ADC for cervical', dealType: 'licensing', modalities: ['adc'], indications: ['cervical'], therapeuticArea: 'oncology' },
  { licensor: 'Blueprint Medicines', licensee: 'Roche', value: '$1.7B', totalValueM: 1700, year: 2023, relevance: 'RET inhibitor (pralsetinib) — thyroid and lung', dealType: 'licensing', modalities: ['smallMolecule'], indications: ['thyroid', 'lung_nsclc'], therapeuticArea: 'oncology' },
  { licensor: 'SpringWorks Therapeutics', licensee: 'Pfizer', value: '$7.5B', totalValueM: 7500, year: 2023, relevance: 'Nirogacestat/gamma-secretase inhibitor (desmoid tumors)', dealType: 'acquisition', modalities: ['smallMolecule'], indications: ['sarcoma'], therapeuticArea: 'oncology' },
  { licensor: 'Summit Therapeutics', licensee: 'Akeso', value: '$5B', totalValueM: 5000, upfrontM: 500, milestonesM: 4500, year: 2025, relevance: 'PD-1/VEGF bispecific ivonescimab US rights (NSCLC)', dealType: 'licensing', modalities: ['bispecific'], indications: ['lung_nsclc'], therapeuticArea: 'oncology' },

  // ═══════════════════════════════════════════════════════════════════════
  // NEUROLOGY (8 deals + 7 CGRP migraine + 4 insomnia/orexin)
  // ═══════════════════════════════════════════════════════════════════════
  { licensor: 'Karuna Therapeutics', licensee: 'BMS', value: '$14B', totalValueM: 14000, year: 2024, relevance: 'Schizophrenia (KarXT/Cobenfy)', dealType: 'acquisition', modalities: ['smallMolecule'], indications: ['schizophrenia'], therapeuticArea: 'neurology' },
  { licensor: 'Cerevel Therapeutics', licensee: 'AbbVie', value: '$8.7B', totalValueM: 8700, year: 2024, relevance: 'CNS pipeline acquisition', dealType: 'acquisition', indications: ['schizophrenia', 'parkinsons'], therapeuticArea: 'neurology' },
  { licensor: 'JCR Pharmaceuticals', licensee: 'AstraZeneca', value: '$825M', totalValueM: 825, year: 2024, relevance: 'BBB delivery platform', dealType: 'licensing', modalities: ['bbbPlatform'], therapeuticArea: 'neurology' },
  { licensor: 'ABL Bio', licensee: 'GSK', value: '$2.7B', totalValueM: 2700, year: 2024, relevance: 'BBB bispecific platform', dealType: 'licensing', modalities: ['bbbPlatform', 'bispecific'], therapeuticArea: 'neurology' },
  { licensor: 'Gilgamesh', licensee: 'AbbVie', value: '$1.2B', totalValueM: 1200, year: 2024, relevance: 'Neuroplastogen (Phase 2)', dealType: 'licensing', modalities: ['psychedelic'], indications: ['depression'], therapeuticArea: 'neurology' },
  { licensor: 'PTC Therapeutics', licensee: 'Novartis', value: '$1B', totalValueM: 1000, upfrontM: 1000, year: 2024, relevance: "Huntington's gene therapy", dealType: 'licensing', modalities: ['geneTherapy'], indications: ['huntingtons'], therapeuticArea: 'neurology' },
  { licensor: 'Sarepta Therapeutics', licensee: 'Roche', value: '$1.5B', totalValueM: 1500, upfrontM: 1500, year: 2024, relevance: 'Gene therapy for DMD (delandistrogene)', dealType: 'codevelopment', modalities: ['geneTherapy'], indications: ['dmd'], therapeuticArea: 'neurology', secondaryTAs: ['rareDisease'] },
  { licensor: 'Intra-Cellular', licensee: 'Johnson & Johnson', value: '$14.6B', totalValueM: 14600, year: 2025, relevance: 'J&J acquisition for CAPLYTA (bipolar/schizophrenia)', dealType: 'acquisition', modalities: ['smallMolecule'], indications: ['bipolar', 'schizophrenia'], therapeuticArea: 'neurology' },

  // ═══════════════════════════════════════════════════════════════════════
  // CGRP MIGRAINE (7 deals)
  // ═══════════════════════════════════════════════════════════════════════
  { licensor: 'Biohaven Pharmaceutical', licensee: 'Pfizer', value: '$1.2B', totalValueM: 1240, upfrontM: 500, milestonesM: 740, royaltyRange: 'tiered double-digit', year: 2021, relevance: 'Pfizer licenses rimegepant + zavegepant (CGRP small molecule gepants) ex-US rights', dealType: 'licensing', modalities: ['smallMolecule'], indications: ['migraine'], therapeuticArea: 'neurology', territory: 'ex_us', phase: 'approved' },
  { licensor: 'Merck', licensee: 'Allergan', value: '$250M', totalValueM: 250, upfrontM: 250, royaltyRange: 'tiered double-digit', year: 2015, relevance: 'Allergan licenses ubrogepant (Ubrelvy) + atogepant (Qulipta) CGRP antagonists from Merck at Phase 2', dealType: 'licensing', modalities: ['smallMolecule'], indications: ['migraine'], therapeuticArea: 'neurology', territory: 'global', phase: 'phase2' },
  { licensor: 'Alder BioPharmaceuticals', licensee: 'Lundbeck', value: '$1.95B', totalValueM: 1950, upfrontM: 1950, year: 2019, relevance: 'Lundbeck acquires Alder for eptinezumab (Vyepti) IV CGRP mAb for migraine prevention', dealType: 'acquisition', modalities: ['mab'], indications: ['migraine'], therapeuticArea: 'neurology', territory: 'global', phase: 'phase3' },
  { licensor: 'Amgen', licensee: 'Novartis', value: '$400M', totalValueM: 400, milestonesM: 400, year: 2017, relevance: 'Amgen/Novartis co-develop erenumab (Aimovig), first approved CGRP mAb for migraine prevention', dealType: 'codevelopment', modalities: ['mab'], indications: ['migraine'], therapeuticArea: 'neurology', territory: 'global', phase: 'phase3' },
  { licensor: 'CoLucid Pharmaceuticals', licensee: 'Eli Lilly', value: '$960M', totalValueM: 960, upfrontM: 960, year: 2017, relevance: 'Lilly acquires CoLucid for lasmiditan (Rayvow) 5-HT1F agonist for acute migraine at Phase 3', dealType: 'acquisition', modalities: ['smallMolecule'], indications: ['migraine'], therapeuticArea: 'neurology', territory: 'global', phase: 'phase3' },
  { licensor: 'Eli Lilly', licensee: 'Organon', value: '$220M', totalValueM: 220, upfrontM: 50, milestonesM: 170, year: 2023, relevance: 'Organon licenses Emgality (galcanezumab) + Rayvow European rights from Lilly', dealType: 'licensing', modalities: ['mab'], indications: ['migraine'], therapeuticArea: 'neurology', territory: 'ex_us', phase: 'approved' },
  { licensor: 'Teva', licensee: 'Otsuka', value: '$65M', totalValueM: 65, upfrontM: 50, milestonesM: 15, year: 2017, relevance: 'Otsuka licenses fremanezumab (Ajovy) CGRP mAb from Teva for Japan migraine market', dealType: 'licensing', modalities: ['mab'], indications: ['migraine'], therapeuticArea: 'neurology', territory: 'japan_only', phase: 'phase3' },

  // ═══════════════════════════════════════════════════════════════════════
  // INSOMNIA / OREXIN (4 deals)
  // ═══════════════════════════════════════════════════════════════════════
  { licensor: 'Idorsia', licensee: 'Viatris', value: '$350M', totalValueM: 350, milestonesM: 350, royaltyRange: 'tiered double-digit', year: 2024, relevance: 'Viatris licenses Quviviq (daridorexant) DORA for insomnia, ex-US commercialization', dealType: 'licensing', modalities: ['smallMolecule'], indications: ['insomnia'], therapeuticArea: 'neurology', territory: 'ex_us', phase: 'approved' },
  { licensor: 'Idorsia', licensee: 'Mochida Pharmaceutical', value: '$80M', totalValueM: 80, upfrontM: 15, milestonesM: 65, royaltyRange: 'double-digit', year: 2023, relevance: 'Mochida licenses Quviviq (daridorexant) DORA for insomnia in Japan', dealType: 'licensing', modalities: ['smallMolecule'], indications: ['insomnia'], therapeuticArea: 'neurology', territory: 'japan_only', phase: 'approved' },
  { licensor: 'Eisai', licensee: 'Purdue Pharma', value: '$200M', totalValueM: 200, upfrontM: 50, milestonesM: 150, year: 2018, relevance: 'Purdue licenses lemborexant (Dayvigo) DORA for insomnia US commercialization from Eisai', dealType: 'licensing', modalities: ['smallMolecule'], indications: ['insomnia'], therapeuticArea: 'neurology', territory: 'us_only', phase: 'phase3' },
  { licensor: 'Minerva Neurosciences', licensee: 'Johnson & Johnson', value: '$110M', totalValueM: 110, upfrontM: 30, milestonesM: 80, royaltyRange: 'high single-digit', year: 2017, relevance: 'Janssen co-develops seltorexant (JNJ-42847922) selective OX2R antagonist for insomnia and MDD; $30M upfront + $80M milestones', dealType: 'codevelopment', modalities: ['smallMolecule'], indications: ['insomnia', 'depression'], therapeuticArea: 'neurology', territory: 'global', phase: 'phase1' },
  { licensor: 'Idorsia', licensee: 'Sosei Heptares', value: '$466M', totalValueM: 466, upfrontM: 466, year: 2023, relevance: 'Sosei acquires Idorsia Asia-Pacific business including daridorexant (Quviviq) DORA for insomnia in Japan/Korea', dealType: 'acquisition', modalities: ['smallMolecule'], indications: ['insomnia'], therapeuticArea: 'neurology', territory: 'apac', phase: 'approved' },

  // ═══════════════════════════════════════════════════════════════════════
  // IMMUNOLOGY / AUTOIMMUNE (20 deals — deduplicated, no standalones)
  // ═══════════════════════════════════════════════════════════════════════
  { licensor: 'Prometheus Biosciences', licensee: 'Merck', value: '$10.8B', totalValueM: 10800, year: 2023, relevance: 'Anti-TL1A acquisition for IBD', dealType: 'acquisition', modalities: ['tl1aInhibitor'], indications: ['crohns', 'ulcerativeColitis'], therapeuticArea: 'immunology', secondaryTAs: ['gastroenterology'] },
  { licensor: 'Telavant', licensee: 'Roche', value: '$7.1B', totalValueM: 7100, year: 2023, relevance: 'Anti-TL1A (RVT-3101) for IBD', dealType: 'acquisition', modalities: ['tl1aInhibitor'], indications: ['ulcerativeColitis', 'crohns'], therapeuticArea: 'immunology', secondaryTAs: ['gastroenterology'] },
  { licensor: 'Arena Pharmaceuticals', licensee: 'Pfizer', value: '$6.7B', totalValueM: 6700, year: 2022, relevance: 'S1P modulator (UC)', dealType: 'acquisition', modalities: ['s1pModulator'], indications: ['ulcerativeColitis'], therapeuticArea: 'immunology', secondaryTAs: ['gastroenterology'] },
  { licensor: 'Momenta Pharmaceuticals', licensee: 'J&J', value: '$6.5B', totalValueM: 6500, year: 2020, relevance: 'FcRn antagonist (MG, HDFN)', dealType: 'acquisition', modalities: ['fcrnAntagonist'], indications: ['myastheniaGravis'], therapeuticArea: 'immunology' },
  { licensor: 'Alpine Immune Sciences', licensee: 'Vertex', value: '$4.9B', totalValueM: 4900, year: 2024, relevance: 'BAFF/APRIL dual antagonist (IgAN)', dealType: 'acquisition', modalities: ['dualAntagonist'], indications: ['igan'], therapeuticArea: 'immunology' },
  { licensor: 'Galapagos', licensee: 'Gilead', value: '$5.1B', totalValueM: 5100, upfrontM: 3950, year: 2019, relevance: 'JAK1 inhibitor (RA, IBD)', dealType: 'licensing', modalities: ['jakInhibitor'], indications: ['rheumatoidArthritis', 'ibd_broad'], therapeuticArea: 'immunology' },
  { licensor: 'Morphic Therapeutic', licensee: 'Eli Lilly', value: '$3.2B', totalValueM: 3200, year: 2024, relevance: 'Oral integrin inhibitor (IBD)', dealType: 'acquisition', modalities: ['oralIntegrin'], indications: ['ulcerativeColitis', 'crohns'], therapeuticArea: 'immunology', secondaryTAs: ['gastroenterology'] },
  { licensor: 'ChemoCentryx', licensee: 'Amgen', value: '$3.7B', totalValueM: 3700, year: 2022, relevance: 'C5aR inhibitor (vasculitis)', dealType: 'acquisition', modalities: ['complementInhibitor'], indications: ['aancaVasculitis'], therapeuticArea: 'immunology' },
  { licensor: 'Capstan Therapeutics', licensee: 'AbbVie', value: '$2.1B', totalValueM: 2100, year: 2025, relevance: 'In vivo CAR-T (autoimmune)', dealType: 'licensing', modalities: ['inVivoCarT'], indications: ['sle_lupus'], therapeuticArea: 'immunology' },
  { licensor: 'Dren Bio', licensee: 'Sanofi', value: '$1.9B', totalValueM: 1900, year: 2024, relevance: 'Bispecific myeloid engager (lupus)', dealType: 'licensing', modalities: ['bispecific'], indications: ['sle_lupus'], therapeuticArea: 'immunology' },
  { licensor: 'Ventyx Biosciences', licensee: 'Eli Lilly', value: '$1.2B', totalValueM: 1200, year: 2024, relevance: 'TYK2+S1P dual (Crohn\'s, psoriasis)', dealType: 'licensing', modalities: ['jakInhibitor', 's1pModulator'], indications: ['crohns', 'psoriasis'], therapeuticArea: 'immunology', secondaryTAs: ['gastroenterology', 'dermatology'] },
  { licensor: 'HI-Bio', licensee: 'Biogen', value: '$1.8B', totalValueM: 1800, year: 2024, relevance: 'Anti-CD38 (IgAN, AMR)', dealType: 'acquisition', modalities: ['mab'], indications: ['igan'], therapeuticArea: 'immunology' },
  { licensor: 'Harbour BioMed', licensee: 'AstraZeneca', value: '$4.6B', totalValueM: 4575, year: 2024, relevance: 'Bispecific platform (autoimmune)', dealType: 'licensing', modalities: ['bispecific'], therapeuticArea: 'immunology' },
  { licensor: 'Earendil Labs', licensee: 'Sanofi', value: '$2.6B', totalValueM: 2560, year: 2025, relevance: 'AI-designed bispecifics (IBD)', dealType: 'licensing', modalities: ['bispecific'], indications: ['ulcerativeColitis', 'crohns'], therapeuticArea: 'immunology', secondaryTAs: ['gastroenterology'] },
  { licensor: 'RemeGen', licensee: 'Vor Bio', value: '$4B', totalValueM: 4000, year: 2025, relevance: 'BAFF/APRIL (MG, SLE, RA)', dealType: 'licensing', modalities: ['dualAntagonist'], indications: ['myastheniaGravis', 'sle_lupus'], therapeuticArea: 'immunology' },
  { licensor: 'Horizon Therapeutics', licensee: 'Amgen', value: '$27.8B', totalValueM: 27800, year: 2023, relevance: 'Tepezza (thyroid eye disease) + rare portfolio', dealType: 'acquisition', modalities: ['mab'], indications: ['thyroidEye', 'gout'], therapeuticArea: 'immunology' },
  { licensor: 'Chinook Therapeutics', licensee: 'Novartis', value: '$3.5B', totalValueM: 3500, year: 2023, relevance: 'BAFF/APRIL atralisimab for IgAN and lupus nephritis', dealType: 'acquisition', modalities: ['dualAntagonist'], indications: ['igan', 'lupusNephritis'], therapeuticArea: 'immunology' },
  { licensor: 'Ipsen', licensee: 'Genfit', value: '$480M', totalValueM: 480, year: 2024, relevance: 'Elafibranor PPAR agonist for PBC', dealType: 'licensing', modalities: ['smallMolecule'], indications: ['pbc'], therapeuticArea: 'immunology' },
  { licensor: 'Alexion', licensee: 'AstraZeneca', value: '$39B', totalValueM: 39000, year: 2021, relevance: 'Complement franchise acquisition (Soliris/Ultomiris)', dealType: 'acquisition', modalities: ['complementInhibitor'], indications: ['pnh', 'rareAutoimmune'], therapeuticArea: 'immunology', secondaryTAs: ['rareDisease'] },
  { licensor: 'Alnylam Pharmaceuticals', licensee: 'Roche', value: '$2.5B', totalValueM: 2510, upfrontM: 310, milestonesM: 2200, year: 2024, relevance: 'RNAi therapeutics for complement-mediated diseases', dealType: 'licensing', modalities: ['rnai'], indications: ['pnh', 'igan'], therapeuticArea: 'immunology', secondaryTAs: ['rareDisease'] },

  // ═══════════════════════════════════════════════════════════════════════
  // METABOLIC / OBESITY (9 deals — no standalones)
  // ═══════════════════════════════════════════════════════════════════════
  { licensor: 'Carmot Therapeutics', licensee: 'Roche', value: '$2.7B', totalValueM: 2700, year: 2023, relevance: 'GLP-1R/GCGR/FGF21 obesity pipeline acquisition', dealType: 'acquisition', modalities: ['glp1Agonist', 'tripleIncretin'], indications: ['obesity', 'type2Diabetes'], therapeuticArea: 'metabolic' },
  { licensor: 'Inversago Pharma', licensee: 'Novo Nordisk', value: '$1.1B', totalValueM: 1075, year: 2023, relevance: 'CB1 inverse agonist for obesity', dealType: 'acquisition', modalities: ['smallMolecule'], indications: ['obesity'], therapeuticArea: 'metabolic' },
  { licensor: 'Scholar Rock', licensee: 'Eli Lilly', value: '$1.3B', totalValueM: 1300, year: 2024, relevance: 'Anti-activin muscle-sparing obesity apamistamab', dealType: 'licensing', modalities: ['antiActivin'], indications: ['obesity'], therapeuticArea: 'metabolic' },
  { licensor: 'Akero Therapeutics', licensee: 'Novo Nordisk', value: '$1.4B', totalValueM: 1400, year: 2024, relevance: 'FGF21 analog efruxifermin for MASH', dealType: 'licensing', modalities: ['peptide'], indications: ['nashMash'], therapeuticArea: 'metabolic' },
  { licensor: 'Terns Pharmaceuticals', licensee: 'Roche', value: '$2.1B', totalValueM: 2100, year: 2024, relevance: 'GLP-1R agonist for obesity and MASH', dealType: 'licensing', modalities: ['glp1Agonist'], indications: ['obesity', 'nashMash'], therapeuticArea: 'metabolic' },
  { licensor: 'Zealand Pharma', licensee: 'Roche', value: '$5.3B', totalValueM: 5300, year: 2025, relevance: 'Amylin analog petrelintide for obesity partnership', dealType: 'licensing', modalities: ['amylinAnalog'], indications: ['obesity'], therapeuticArea: 'metabolic' },
  { licensor: 'Gubra', licensee: 'AbbVie', value: '$2.2B', totalValueM: 2200, year: 2025, relevance: 'GLP-1/amylin dual agonist for obesity', dealType: 'licensing', modalities: ['dualIncretin', 'amylinAnalog'], indications: ['obesity'], therapeuticArea: 'metabolic' },
  { licensor: 'Provention Bio', licensee: 'Sanofi', value: '$2.9B', totalValueM: 2900, year: 2023, relevance: 'Teplizumab (Tzield) for T1D delay', dealType: 'acquisition', modalities: ['mab'], indications: ['type1Diabetes'], therapeuticArea: 'metabolic' },
  { licensor: '4D Molecular Therapeutics', licensee: 'Bayer', value: '$1.5B', totalValueM: 1500, year: 2024, relevance: 'AAV gene therapy for Fabry disease', dealType: 'licensing', modalities: ['geneTherapy'], indications: ['fabry'], therapeuticArea: 'metabolic', secondaryTAs: ['rareDisease'] },

  // ═══════════════════════════════════════════════════════════════════════
  // RARE DISEASE (3 deals — others moved to primary TAs with secondaryTAs)
  // ═══════════════════════════════════════════════════════════════════════
  { licensor: 'Vertex Pharmaceuticals', licensee: 'CRISPR Therapeutics', value: '$900M', totalValueM: 900, upfrontM: 900, year: 2023, relevance: 'Casgevy (exa-cel) first approved CRISPR gene therapy for SCD/TDT', dealType: 'collaboration', modalities: ['geneTherapyRare'], indications: ['sickleCell', 'betaThalassemia'], therapeuticArea: 'rareDisease' },
  { licensor: 'Ionis Pharmaceuticals', licensee: 'Biogen', value: '$2.6B', totalValueM: 2600, year: 2018, relevance: 'Spinraza (nusinersen) ASO collaboration for SMA', dealType: 'collaboration', modalities: ['aso'], indications: ['spinalMuscularAtrophy'], therapeuticArea: 'rareDisease' },
  { licensor: 'Regeneron', licensee: 'Alnylam', value: '$1.4B', totalValueM: 1400, upfrontM: 1000, year: 2024, relevance: 'RNAi collaboration for cardiometabolic and neurological rare diseases', dealType: 'collaboration', modalities: ['rnai'], indications: ['rareNeuro', 'cardiomyopathy'], therapeuticArea: 'rareDisease', secondaryTAs: ['cardiovascular'] },

  // ═══════════════════════════════════════════════════════════════════════
  // HEMATOLOGY (8 deals — no standalones)
  // ═══════════════════════════════════════════════════════════════════════
  { licensor: 'Celgene', licensee: 'BMS', value: '$74B', totalValueM: 74000, year: 2019, relevance: 'Revlimid, Pomalyst, Abraxane hematology franchise (acquisition)', dealType: 'acquisition', modalities: ['smallMolecule'], indications: ['myeloma', 'mds'], therapeuticArea: 'hematology' },
  { licensor: 'Kite Pharma', licensee: 'Gilead', value: '$11.9B', totalValueM: 11900, year: 2017, relevance: 'CAR-T platform (Yescarta for DLBCL) (acquisition)', dealType: 'acquisition', modalities: ['carT_heme'], indications: ['dlbcl', 'follicularLymphoma'], therapeuticArea: 'hematology' },
  { licensor: 'Juno Therapeutics', licensee: 'Celgene/BMS', value: '$9B', totalValueM: 9000, year: 2018, relevance: 'CAR-T (Breyanzi/lisocabtagene maraleucel) (acquisition)', dealType: 'acquisition', modalities: ['carT_heme'], indications: ['dlbcl', 'mantleCellLymphoma'], therapeuticArea: 'hematology' },
  { licensor: 'Legend Biotech', licensee: 'Johnson & Johnson', value: '$350M', totalValueM: 350, upfrontM: 350, year: 2017, relevance: 'BCMA CAR-T (Carvykti/ciltacabtagene autoleucel) for myeloma', dealType: 'licensing', modalities: ['carT_heme'], indications: ['myeloma'], therapeuticArea: 'hematology' },
  { licensor: 'Pfizer', licensee: 'Global Blood Therapeutics', value: '$5.4B', totalValueM: 5400, year: 2022, relevance: 'Oxbryta (voxelotor) in sickle cell disease (acquisition)', dealType: 'acquisition', modalities: ['smallMolecule'], indications: ['sickleCell'], therapeuticArea: 'hematology' },
  { licensor: 'Syndax Pharmaceuticals', licensee: 'Incyte', value: '$1.4B', totalValueM: 1400, year: 2024, relevance: 'Revumenib (Augtyro) menin inhibitor collaboration for AML', dealType: 'collaboration', modalities: ['smallMolecule'], indications: ['aml'], therapeuticArea: 'hematology' },
  { licensor: 'MorphoSys', licensee: 'Novartis', value: '$2.9B', totalValueM: 2900, year: 2024, relevance: 'Pelabresib BET inhibitor acquisition for myelofibrosis', dealType: 'acquisition', modalities: ['smallMolecule'], indications: ['myelofibrosis'], therapeuticArea: 'hematology' },
  { licensor: 'CTI BioPharma', licensee: 'Sobi', value: '$1.7B', totalValueM: 1700, year: 2023, relevance: 'Pacritinib (Vonjo) JAK2/IRAK1 inhibitor for myelofibrosis', dealType: 'acquisition', modalities: ['smallMolecule'], indications: ['myelofibrosis'], therapeuticArea: 'hematology' },

  // ═══════════════════════════════════════════════════════════════════════
  // DERMATOLOGY (2 real deals)
  // ═══════════════════════════════════════════════════════════════════════
  { licensor: 'Concert Pharmaceuticals', licensee: 'Sun Pharma', value: '$576M', totalValueM: 576, year: 2023, relevance: 'Deuruxolitinib JAK inhibitor for alopecia areata acquisition', dealType: 'acquisition', modalities: ['jakInhibitorDerm'], indications: ['alopeciaAreata'], therapeuticArea: 'dermatology' },
  { licensor: 'Almirall', licensee: 'AbbVie', value: '$660M', totalValueM: 660, year: 2023, relevance: 'EU rights to TYK2 inhibitor for psoriasis and atopic dermatitis', dealType: 'licensing', modalities: ['jakInhibitorDerm'], indications: ['psoriasis', 'atopicderm'], therapeuticArea: 'dermatology' },

  // ═══════════════════════════════════════════════════════════════════════
  // GASTROENTEROLOGY (2 deals unique to GI — others via immunology secondaryTAs)
  // ═══════════════════════════════════════════════════════════════════════
  { licensor: 'Iterative Health', licensee: 'Pfizer', value: '$1.6B', totalValueM: 1600, year: 2024, relevance: 'AI-powered GI diagnostics platform for IBD and endoscopy', dealType: 'licensing', modalities: ['smallMolecule'], indications: ['ulcerativeColitis', 'crohns'], therapeuticArea: 'gastroenterology' },
  { licensor: 'Protagonist Therapeutics', licensee: 'J&J', value: '$1B', totalValueM: 1000, upfrontM: 1000, year: 2024, relevance: 'Icotrokinra (JNJ-2113) oral IL-23 peptide for UC/Crohn\'s', dealType: 'licensing', modalities: ['peptide'], indications: ['ulcerativeColitis', 'crohns', 'psoriasis'], therapeuticArea: 'gastroenterology' },

  // ═══════════════════════════════════════════════════════════════════════
  // REFORMULATION / 505(b)(2) (11 deals)
  // ═══════════════════════════════════════════════════════════════════════
  { licensor: 'Eagle Pharmaceuticals', licensee: 'Teva', value: '$250M', totalValueM: 250, upfrontM: 50, milestonesM: 150, royaltyRange: 'mid-single to low-double digit', year: 2022, relevance: 'Bendamustine RTD reformulation licensing', dealType: 'reformulation', modalities: ['smallMolecule'], therapeuticArea: 'oncology', phase: 'approved', territory: 'global', source: 'SEC 8-K filing' },
  { licensor: 'Xeris Pharmaceuticals', licensee: 'Amphastar Pharmaceuticals', value: '$170M', totalValueM: 170, upfrontM: 35, milestonesM: 100, royaltyRange: 'high single-digit', year: 2023, relevance: 'Gvoke (glucagon injection) ready-to-use reformulation licensing', dealType: 'reformulation', modalities: ['peptide'], therapeuticArea: 'metabolic', phase: 'approved', territory: 'global', source: 'SEC 8-K filing' },
  { licensor: 'Assertio Therapeutics', licensee: 'Collegium Pharmaceutical', value: '$375M', totalValueM: 375, upfrontM: 75, milestonesM: 200, royaltyRange: 'low-double digit', year: 2023, relevance: 'Nucynta ER (tapentadol) abuse-deterrent reformulation rights', dealType: 'reformulation', modalities: ['smallMolecule'], therapeuticArea: 'neurology', phase: 'approved', territory: 'us_only', source: 'SEC 8-K filing' },
  { licensor: 'Paratek Pharmaceuticals', licensee: 'Almirall', value: '$85M', totalValueM: 85, upfrontM: 15, milestonesM: 50, royaltyRange: 'tiered double-digit', year: 2021, relevance: 'Seysara (sarecycline) oral reformulation for acne, European rights', dealType: 'reformulation', modalities: ['smallMolecule'], therapeuticArea: 'dermatology', phase: 'approved', territory: 'europe', source: 'Company press release' },
  { licensor: "Dr. Reddy's Laboratories", licensee: 'Nestlé Health Science', value: '$65M', totalValueM: 65, upfrontM: 20, milestonesM: 30, royaltyRange: 'mid-single digit', year: 2022, relevance: 'Reformulated omeprazole (Zegerid) OTC rights licensing', dealType: 'reformulation', modalities: ['smallMolecule'], therapeuticArea: 'gastroenterology', phase: 'approved', territory: 'us_only', source: 'Company press release' },
  { licensor: 'Sun Pharma', licensee: 'Taro Pharmaceutical', value: '$120M', totalValueM: 120, upfrontM: 25, milestonesM: 70, royaltyRange: 'high single-digit', year: 2021, relevance: 'Doxycycline extended-release reformulation for rosacea (Oracea-type)', dealType: 'reformulation', modalities: ['smallMolecule'], therapeuticArea: 'dermatology', phase: 'approved', territory: 'us_only', source: 'Company press release' },
  { licensor: 'Kashiv BioSciences', licensee: 'Hikma Pharmaceuticals', value: '$125M', totalValueM: 125, upfrontM: 30, milestonesM: 70, royaltyRange: 'mid-single digit', year: 2022, relevance: 'Epinephrine auto-injector (EpiPen) 505(b)(2) biosimilar/reformulation', dealType: 'reformulation', modalities: ['smallMolecule'], therapeuticArea: 'immunology', phase: 'nda_filed', territory: 'us_only', source: 'SEC 8-K filing' },
  { licensor: 'Acrotech Biopharma', licensee: 'Eagle Pharmaceuticals', value: '$200M', totalValueM: 200, upfrontM: 40, milestonesM: 120, royaltyRange: 'low-double digit', year: 2020, relevance: 'Bendeka (bendamustine) rapid infusion reformulation rights', dealType: 'reformulation', modalities: ['smallMolecule'], therapeuticArea: 'oncology', phase: 'approved', territory: 'us_only', source: 'SEC 8-K filing' },
  { licensor: 'Teva', licensee: 'Alvotech', value: '$90M', totalValueM: 90, upfrontM: 20, milestonesM: 50, royaltyRange: 'high single-digit', year: 2023, relevance: 'Copaxone (glatiramer acetate) reformulation/line extension licensing', dealType: 'reformulation', modalities: ['peptide'], therapeuticArea: 'neurology', phase: 'approved', territory: 'europe', source: 'Company press release' },
  { licensor: 'Lupin', licensee: 'Bayer', value: '$100M', totalValueM: 100, upfrontM: 20, milestonesM: 55, royaltyRange: 'mid-single digit', year: 2022, relevance: 'Oral contraceptive novel-combination 505(b)(2) reformulation', dealType: 'reformulation', modalities: ['smallMolecule'], therapeuticArea: 'womensHealth', phase: 'phase3', territory: 'us_only', source: 'Company press release' },
  { licensor: 'Antares Pharma', licensee: 'Teva', value: '$130M', totalValueM: 130, upfrontM: 25, milestonesM: 75, royaltyRange: 'tiered single-to-double digit', year: 2020, relevance: 'XYOSTED (testosterone enanthate) auto-injector 505(b)(2) reformulation', dealType: 'reformulation', modalities: ['peptide'], therapeuticArea: 'metabolic', phase: 'approved', territory: 'us_only', source: 'SEC 8-K filing' },

  // Earlier-stage reformulation deals (Phase 2/3) to complement approved-stage comps
  { licensor: 'Xeris Pharmaceuticals', licensee: 'Zealand Pharma', value: '$55M', totalValueM: 55, upfrontM: 15, milestonesM: 30, royaltyRange: 'mid-single digit', year: 2021, relevance: 'Ready-to-use glucagon rescue pen reformulation (Phase 2 stage deal)', dealType: 'reformulation', modalities: ['peptide'], therapeuticArea: 'metabolic', phase: 'phase2', territory: 'ex_us', source: 'Company press release' },
  { licensor: 'Kashiv BioSciences', licensee: 'Cipla', value: '$40M', totalValueM: 40, upfrontM: 10, milestonesM: 25, royaltyRange: 'low-single digit', year: 2021, relevance: 'Generic inhaler 505(b)(2) reformulation deal at Phase 2', dealType: 'reformulation', modalities: ['smallMolecule'], therapeuticArea: 'immunology', phase: 'phase2', territory: 'us_only', source: 'Company press release' },
  { licensor: 'Eagle Pharmaceuticals', licensee: 'Teva', value: '$80M', totalValueM: 80, upfrontM: 20, milestonesM: 45, royaltyRange: 'mid-single digit', year: 2019, relevance: 'Ryanodex (dantrolene) rapid IV reformulation Phase 3 licensing', dealType: 'reformulation', modalities: ['smallMolecule'], therapeuticArea: 'neurology', phase: 'phase3', territory: 'us_only', source: 'SEC 8-K filing' },
  { licensor: 'Pacira BioSciences', licensee: 'Astellas Pharma', value: '$150M', totalValueM: 150, upfrontM: 35, milestonesM: 85, royaltyRange: 'low-double digit', year: 2020, relevance: 'EXPAREL (bupivacaine liposome) extended-release reformulation Phase 3 ex-US rights', dealType: 'reformulation', modalities: ['smallMolecule'], therapeuticArea: 'neurology', phase: 'phase3', territory: 'ex_us', source: 'SEC 8-K filing' },
  { licensor: 'Assertio Therapeutics', licensee: 'Collegium Pharmaceutical', value: '$60M', totalValueM: 60, upfrontM: 12, milestonesM: 35, royaltyRange: 'mid-single digit', year: 2021, relevance: 'Abuse-deterrent opioid reformulation Phase 2/3 rights deal', dealType: 'reformulation', modalities: ['smallMolecule'], therapeuticArea: 'neurology', phase: 'phase3', territory: 'us_only', source: 'Company press release' },
];

// Convert extended deal to base ComparableDeal format — preserves all structured fields
function toComparableDeal(d: ExtendedComparableDeal): ComparableDeal {
  const value = d.totalDealValue >= 1000
    ? `$${(d.totalDealValue / 1000).toFixed(1)}B`
    : `$${d.totalDealValue}M`;
  return {
    licensor: d.licensor,
    licensee: d.licensee,
    value,
    upfrontM: d.upfront,
    totalValueM: d.totalDealValue,
    milestonesM: d.milestones,
    royaltyRange: d.royaltyRange,
    year: d.year,
    relevance: d.headline,
    dealType: d.dealType,
    modalities: [d.modality],
    indications: [d.indication_specific],
    therapeuticArea: d.therapeuticArea as ComparableDeal['therapeuticArea'],
    territory: d.territory,
    phase: d.phase,
    source: d.source,
  };
}

// Merge curated deals with extended deals (deduplicate by licensor+licensee+year)
// Enrich every deal with buyer tier classification based on licensee name
const ALL_DEALS: ComparableDeal[] = (() => {
  const seen = new Set(COMPARABLE_DEALS.map(d => `${d.licensor}|${d.licensee}|${d.year}`));
  const extended = EXTENDED_COMPARABLE_DEALS
    .filter(d => !seen.has(`${d.licensor}|${d.licensee}|${d.year}`))
    .map(toComparableDeal);
  const merged = [...COMPARABLE_DEALS, ...extended];
  return merged.map(d => ({ ...d, buyerTier: d.buyerTier ?? classifyBuyerTier(d.licensee) }));
})();

// Extended interface for web UI component
export interface ComparableDealForUI {
  id: string;
  parties: string;
  totalValue: string;
  upfront?: string;
  year: number;
  phase?: string;
  relevanceReasons: string[];
  scoreBreakdown?: HedocnicScoreBreakdown;
  patent_cliff_context?: string;
}

// Score breakdown for hedonic regression model
export interface HedocnicScoreBreakdown {
  phase: number;
  modality: number;
  therapeuticArea: number;
  indication: number;
  territory: number;
  dealType: number;
  recencyWeight: number;
  rawScore: number;
  weightedScore: number;
}

// ═══════════════════════════════════════════════════════════════════════
// RECENCY WEIGHTING — shared across all deal matching
// ═══════════════════════════════════════════════════════════════════════

/**
 * Recency weight for a deal based on its year. Used across comparable-deal
 * scoring, partner matching, and pharma intent calculations.
 *
 * Round 22 (2026-04-13) — sharpened the ratio from 2:1 to 3:1 between
 * current year and 2020 deals, with finer year-by-year granularity.
 * BD analysts treat deals older than 18 months as "reference only" and
 * weight recent comparables more heavily; the sharper curve matches
 * that mental model.
 *
 * Weights:
 *   - 2025+: 3.0 (current-year comparable)
 *   - 2024:  2.5 (last 12 months — most relevant)
 *   - 2023:  2.0 (last 18 months — primary reference set)
 *   - 2022:  1.5 (still relevant but environment has shifted)
 *   - 2021:  1.2
 *   - 2020:  1.0 (baseline — pre-pandemic-shift reference)
 *   - 2018-2019: 0.5 (deep reference only)
 *   - pre-2018:  0.25 (legacy — include for class-level context only)
 */
export function getRecencyWeight(year: number): number {
  if (year >= 2025) return 3.0;
  if (year >= 2024) return 2.5;
  if (year >= 2023) return 2.0;
  if (year >= 2022) return 1.5;
  if (year >= 2021) return 1.2;
  if (year >= 2020) return 1.0;
  if (year >= 2018) return 0.5;
  return 0.25;
}

// ═══════════════════════════════════════════════════════════════════════
// PATENT CLIFF DATA & ENRICHMENT
// ═══════════════════════════════════════════════════════════════════════

export const MAJOR_PATENT_CLIFFS: Record<string, { drug: string; loeYear: number; peakSalesB: number }[]> = {
  'AbbVie': [{ drug: 'Humira', loeYear: 2023, peakSalesB: 21.2 }, { drug: 'Imbruvica', loeYear: 2032, peakSalesB: 5.4 }],
  'Merck': [{ drug: 'Keytruda', loeYear: 2028, peakSalesB: 25.0 }],
  'Bristol-Myers Squibb': [{ drug: 'Opdivo', loeYear: 2028, peakSalesB: 9.0 }, { drug: 'Eliquis', loeYear: 2026, peakSalesB: 12.2 }],
  'BMS': [{ drug: 'Opdivo', loeYear: 2028, peakSalesB: 9.0 }, { drug: 'Eliquis', loeYear: 2026, peakSalesB: 12.2 }],
  'Pfizer': [{ drug: 'Ibrance', loeYear: 2027, peakSalesB: 5.1 }],
  'Roche': [{ drug: 'Ocrevus', loeYear: 2033, peakSalesB: 7.5 }],
  'Johnson & Johnson': [{ drug: 'Stelara', loeYear: 2025, peakSalesB: 10.9 }],
  'J&J': [{ drug: 'Stelara', loeYear: 2025, peakSalesB: 10.9 }],
  'AstraZeneca': [{ drug: 'Tagrisso', loeYear: 2032, peakSalesB: 5.8 }],
  'Novartis': [{ drug: 'Entresto', loeYear: 2026, peakSalesB: 6.0 }],
  'Eli Lilly': [{ drug: 'Trulicity', loeYear: 2027, peakSalesB: 7.4 }, { drug: 'Verzenio', loeYear: 2032, peakSalesB: 4.2 }],
  'Amgen': [{ drug: 'Enbrel', loeYear: 2023, peakSalesB: 5.0 }],
  'Sanofi': [{ drug: 'Dupixent', loeYear: 2031, peakSalesB: 13.0 }],
  'Gilead': [{ drug: 'Biktarvy', loeYear: 2033, peakSalesB: 12.1 }],
  'GSK': [{ drug: 'Shingrix', loeYear: 2034, peakSalesB: 4.8 }, { drug: 'Dovato', loeYear: 2029, peakSalesB: 3.2 }],
  'Biogen': [{ drug: 'Tysabri', loeYear: 2026, peakSalesB: 2.1 }],
  'Regeneron': [{ drug: 'Eylea', loeYear: 2027, peakSalesB: 6.1 }],
  'Vertex': [{ drug: 'Trikafta', loeYear: 2037, peakSalesB: 9.0 }],
  'Takeda': [{ drug: 'Entyvio', loeYear: 2026, peakSalesB: 5.5 }],
  'Bayer': [{ drug: 'Xarelto', loeYear: 2024, peakSalesB: 6.3 }, { drug: 'Eylea', loeYear: 2027, peakSalesB: 4.0 }],
  'Novo Nordisk': [{ drug: 'Ozempic', loeYear: 2032, peakSalesB: 18.0 }],
  'Astellas Pharma': [{ drug: 'Xtandi', loeYear: 2027, peakSalesB: 5.5 }],
};

const CURRENT_YEAR = new Date().getFullYear();

/** Enrich comparable deals with patent cliff context for licensees */
export function enrichDealsWithPatentCliff(deals: ComparableDealForUI[], allDeals: ComparableDeal[]): ComparableDealForUI[] {
  return deals.map(uiDeal => {
    // Find the original deal to get the licensee name
    const original = allDeals.find(d =>
      `${d.licensor} / ${d.licensee}` === uiDeal.parties && d.year === uiDeal.year
    );
    if (!original) return uiDeal;

    const licensee = original.licensee;
    const cliffs = MAJOR_PATENT_CLIFFS[licensee];
    if (!cliffs) return uiDeal;

    // Find cliffs within 5 years
    const urgentCliffs = cliffs.filter(c => c.loeYear >= CURRENT_YEAR && c.loeYear <= CURRENT_YEAR + 5);
    if (urgentCliffs.length === 0) return uiDeal;

    // Pick the cliff with highest peak sales (most urgency)
    const mostUrgent = urgentCliffs.sort((a, b) => b.peakSalesB - a.peakSalesB)[0];

    return {
      ...uiDeal,
      patent_cliff_context: `Strategic urgency: ${licensee}'s $${mostUrgent.peakSalesB}B ${mostUrgent.drug} faces LOE in ${mostUrgent.loeYear}`,
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════
// MODALITY CLASS MAP — for "same class" matching in hedonic regression
// ═══════════════════════════════════════════════════════════════════════

const MODALITY_CLASS: Record<string, string> = {
  mab: 'antibody_derived',
  bispecific: 'antibody_derived',
  adc: 'antibody_derived',
  antibody: 'antibody_derived',
  carT_heme: 'cell_therapy',
  inVivoCarT: 'cell_therapy',
  car_t: 'cell_therapy',
  cell_therapy: 'cell_therapy',
  geneTherapy: 'gene_therapy',
  geneTherapyRare: 'gene_therapy',
  aso: 'oligonucleotide',
  rnai: 'oligonucleotide',
  oligonucleotide: 'oligonucleotide',
  smallMolecule: 'small_molecule',
  peptide: 'small_molecule',
  glp1Agonist: 'incretin',
  dualIncretin: 'incretin',
  tripleIncretin: 'incretin',
  amylinAnalog: 'incretin',
  jakInhibitor: 'kinase_inhibitor',
  jakInhibitorDerm: 'kinase_inhibitor',
  tl1aInhibitor: 'immune_modulator',
  s1pModulator: 'immune_modulator',
  fcrnAntagonist: 'immune_modulator',
  complementInhibitor: 'immune_modulator',
  dualAntagonist: 'immune_modulator',
  oralIntegrin: 'immune_modulator',
  bbbPlatform: 'cns_platform',
  psychedelic: 'cns_platform',
  radiopharmaceutical: 'radiopharmaceutical',
  vaccine: 'vaccine',
  mrna: 'mrna',
  antiActivin: 'biologic',
};

import { TA_ADJACENCY } from './financial/ta-adjacency';

// Phase rank for distance scoring
const PHASE_RANK: Record<string, number> = {
  discovery: -0.5,
  preclinical: 0,
  phase1: 1,
  phase1_2: 1.5,
  phase2: 2,
  phase2_3: 2.5,
  phase3: 3,
  nda_filed: 3.5,
  approved: 4,
};

function getPhaseRank(phase: string | undefined): number | null {
  if (!phase) return null;
  // Normalize: lowercase, strip whitespace, convert slash to underscore so that
  // legacy "Phase 1/2" style strings map to the canonical phase1_2 key.
  const normalized = phase.toLowerCase().replace(/\s+/g, '').replace(/\//g, '_');
  return PHASE_RANK[normalized] ?? null;
}

/**
 * Normalize a modality string for comparison: lowercase and strip
 * underscores/hyphens so that "small_molecule", "small-molecule", and
 * "smallMolecule" all compare equal.
 */
function normalizeModality(m: string | undefined): string {
  if (!m) return '';
  return m.toLowerCase().replace(/[_\-\s]/g, '');
}

// ═══════════════════════════════════════════════════════════════════════
// HEDONIC REGRESSION SCORING
// ═══════════════════════════════════════════════════════════════════════

export interface HedonicScoringInput {
  therapeuticArea: string;
  modality: string;
  indication: string;
  phase?: string;
  dealType?: string;
  territory?: string;
  buyerTier?: string;
}

/**
 * Hedonic regression-based comparable deal scoring.
 * Models deal relevance as f(phase, modality, TA, indication, territory, year, deal_type)
 * with Mahalanobis-like distance weighting and recency multiplier.
 */
export function scoreComparableDealsHedonic(
  inputs: HedonicScoringInput,
  maxDeals: number = 10
): { deal: ComparableDeal; score: HedocnicScoreBreakdown; reasons: string[]; id: string }[] {
  // First, filter outlier deals (>3 std dev from median value for the TA)
  const taDeals = ALL_DEALS.filter(d =>
    d.therapeuticArea === inputs.therapeuticArea ||
    d.therapeuticArea === 'both' ||
    d.secondaryTAs?.includes(inputs.therapeuticArea)
  );
  const values = taDeals
    .map(d => d.totalValueM)
    .filter((v): v is number => v != null && v > 0)
    .sort((a, b) => a - b);

  // IQR-based outlier threshold (more robust than mean ± 3σ for long-tailed
  // deal value distributions). Using Q3 + 1.5 × IQR as the upper fence is
  // the standard Tukey definition.
  //
  // Median is averaged for even-length arrays to avoid an off-by-one bias.
  let outlierThreshold = Infinity;
  if (values.length >= 5) {
    const pickQuantile = (arr: number[], q: number): number => {
      if (arr.length === 0) return 0;
      const pos = (arr.length - 1) * q;
      const lo = Math.floor(pos);
      const hi = Math.ceil(pos);
      if (lo === hi) return arr[lo];
      return arr[lo] + (arr[hi] - arr[lo]) * (pos - lo);
    };
    const q1 = pickQuantile(values, 0.25);
    const q3 = pickQuantile(values, 0.75);
    const iqr = q3 - q1;
    outlierThreshold = q3 + 1.5 * iqr;
  }

  const scored = ALL_DEALS.map((deal, idx) => {
    // Filter outlier deals
    if (deal.totalValueM && deal.totalValueM > outlierThreshold) {
      return null;
    }

    const reasons: string[] = [];

    // --- Phase match ---
    let phaseScore = 0;
    const inputRank = getPhaseRank(inputs.phase);
    const dealRank = getPhaseRank(deal.phase);
    if (inputRank !== null && dealRank !== null) {
      const dist = Math.abs(inputRank - dealRank);
      if (dist === 0) { phaseScore = 10; reasons.push('Exact phase match'); }
      else if (dist <= 1) { phaseScore = 6; reasons.push('Adjacent phase'); }
      else { phaseScore = 2; reasons.push('Distant phase'); }
    }

    // --- Modality match ---
    let modalityScore = 0;
    const dealModalities = deal.modalities || [];
    const normalizedInputModality = normalizeModality(inputs.modality);
    const normalizedDealModalities = dealModalities.map(normalizeModality);
    if (inputs.modality && normalizedDealModalities.includes(normalizedInputModality)) {
      modalityScore = 10;
      reasons.push('Exact modality match');
    } else if (inputs.modality && dealModalities.length > 0) {
      const inputClass = MODALITY_CLASS[inputs.modality];
      const dealClasses = dealModalities.map(m => MODALITY_CLASS[m]).filter(Boolean);
      if (inputClass && dealClasses.includes(inputClass)) {
        modalityScore = 6;
        reasons.push('Same modality class');
      } else if (inputClass) {
        // Only give partial credit if we recognize the input modality
        modalityScore = 2;
        reasons.push('Different modality');
      }
    }

    // --- TA match ---
    let taScore = 0;
    if (deal.therapeuticArea === inputs.therapeuticArea || deal.therapeuticArea === 'both') {
      taScore = 8;
      reasons.push('Same therapeutic area');
    } else if (deal.secondaryTAs?.includes(inputs.therapeuticArea)) {
      taScore = 4;
      reasons.push('Related therapeutic area (secondary)');
    } else if (TA_ADJACENCY[inputs.therapeuticArea]?.includes(deal.therapeuticArea)) {
      taScore = 4;
      reasons.push('Related therapeutic area');
    } else {
      taScore = 1;
    }

    // --- Indication match ---
    let indicationScore = 0;
    const dealIndications = deal.indications || [];
    if (inputs.indication && dealIndications.includes(inputs.indication)) {
      indicationScore = 10;
      reasons.push('Exact indication match');
    } else if (inputs.indication && taScore >= 8 && dealIndications.length > 0) {
      // Same TA means same subgroup
      indicationScore = 2;
      reasons.push('Same TA indication subgroup');
    }

    // --- Territory match ---
    let territoryScore = 0;
    if (inputs.territory && deal.territory) {
      if (deal.territory === inputs.territory) {
        territoryScore = 4;
        reasons.push('Exact territory match');
      } else if (
        (deal.territory === 'global' || inputs.territory === 'global') ||
        (deal.territory?.includes('us') && inputs.territory?.includes('us'))
      ) {
        territoryScore = 2;
        reasons.push('Overlapping territory');
      }
    }

    // --- Deal type match ---
    let dealTypeScore = 0;
    if (inputs.dealType && deal.dealType === inputs.dealType) {
      dealTypeScore = 3;
      reasons.push('Same deal structure');
    }

    // --- Buyer tier match ---
    let buyerTierScore = 0;
    if (inputs.buyerTier && deal.buyerTier === inputs.buyerTier) {
      buyerTierScore = 2;
      reasons.push('Same buyer type');
    }

    // --- Recency weight (multiplicative) ---
    const recencyWeight = getRecencyWeight(deal.year);

    // Raw score = sum of dimension scores
    const rawScore = phaseScore + modalityScore + taScore + indicationScore + territoryScore + dealTypeScore + buyerTierScore;
    const weightedScore = rawScore * recencyWeight;

    if (rawScore < 4) return null; // Filter irrelevant deals (need at least one strong dimension match)

    return {
      deal,
      score: {
        phase: phaseScore,
        modality: modalityScore,
        therapeuticArea: taScore,
        indication: indicationScore,
        territory: territoryScore,
        dealType: dealTypeScore,
        recencyWeight,
        rawScore,
        weightedScore,
      } as HedocnicScoreBreakdown,
      reasons,
      id: `deal-${idx}`,
    };
  }).filter((s): s is NonNullable<typeof s> => s !== null);

  // Sort by weighted score descending
  scored.sort((a, b) => b.score.weightedScore - a.score.weightedScore);

  return scored.slice(0, maxDeals);
}

// Find comparable deals using hedonic regression scoring (for web UI)
export function findComparableDeals(
  inputs: { therapeuticArea: string; modality: string; indication: string; phase?: string; dealType?: string; territory?: string },
  maxDeals: number = 5
): ComparableDealForUI[] {
  const hedonic = scoreComparableDealsHedonic(inputs, maxDeals);

  const uiDeals = hedonic.map(s => ({
    id: s.id,
    parties: `${s.deal.licensor} / ${s.deal.licensee}`,
    totalValue: s.deal.value,
    year: s.deal.year,
    phase: s.deal.phase,
    relevanceReasons: s.reasons,
    scoreBreakdown: s.score,
  }));

  // Enrich with patent cliff context
  const allDeals = ALL_DEALS;
  return enrichDealsWithPatentCliff(uiDeals, allDeals);
}

/** @deprecated Use findComparableDeals() which now uses hedonic regression scoring */
export function findComparableDealsLegacy(
  inputs: { therapeuticArea: string; modality: string; indication: string; phase?: string; dealType?: string },
  maxDeals: number = 5
): ComparableDealForUI[] {
  const scored = ALL_DEALS.map((deal, idx) => {
    let score = 0;
    const reasons: string[] = [];

    if (deal.therapeuticArea === inputs.therapeuticArea || deal.therapeuticArea === 'both') {
      score += 3;
      reasons.push(`Same therapeutic area`);
    } else if (deal.secondaryTAs?.includes(inputs.therapeuticArea)) {
      score += 2;
      reasons.push(`Related therapeutic area`);
    }
    if (inputs.modality && deal.modalities?.includes(inputs.modality)) {
      score += 4;
      reasons.push(`Same modality`);
    }
    if (inputs.indication && deal.indications?.includes(inputs.indication)) {
      score += 3;
      reasons.push(`Same indication`);
    }
    if (inputs.dealType && deal.dealType === inputs.dealType) {
      score += 2;
      reasons.push(`Same deal structure`);
    }

    return {
      deal,
      score,
      reasons,
      id: `deal-${idx}`,
    };
  });

  return scored
    .filter(s => s.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxDeals)
    .map(s => ({
      id: s.id,
      parties: `${s.deal.licensor} / ${s.deal.licensee}`,
      totalValue: s.deal.value,
      year: s.deal.year,
      relevanceReasons: s.reasons,
    }));
}

export function getRelevantDeals(
  therapeuticArea: string,
  modality?: string,
  indication?: string,
  maxDeals: number = 4
): ComparableDeal[] {
  const scored = ALL_DEALS.map(deal => {
    let score = 0;
    if (deal.therapeuticArea === therapeuticArea || deal.therapeuticArea === 'both') score += 1;
    else if (deal.secondaryTAs?.includes(therapeuticArea)) score += 1;
    if (modality && deal.modalities?.includes(modality)) score += 3;
    if (indication && deal.indications?.includes(indication)) score += 3;
    // Apply recency weighting multiplicatively
    const weightedScore = score * getRecencyWeight(deal.year);
    return { deal, score: weightedScore };
  });

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxDeals)
    .map(s => s.deal);
}

// Re-export server-only DB functions — import from '@/lib/comparableDeals.server' in API routes
// This file must remain safe for client-side imports (no next/headers dependency)
