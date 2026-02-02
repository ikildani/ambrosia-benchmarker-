-- Verified Deals Insert Script
-- Sources: BioSpace, Labiotech, Pharmaceutical Technology, DIMA Biotech
-- Last verified: February 2, 2026
--
-- INSTRUCTIONS: Run this in Supabase SQL Editor
-- This script adds verified deals with accurate dates

-- ============================================
-- STEP 1: Clean up any dates past Feb 2, 2026
-- ============================================
UPDATE deals
SET announced_date = '2026-02-02'
WHERE announced_date > '2026-02-02';

-- ============================================
-- STEP 2: Normalize modality values first
-- ============================================
UPDATE deals SET modality = 'adc' WHERE LOWER(modality) = 'adc';
UPDATE deals SET modality = 'mab' WHERE LOWER(modality) IN ('monoclonal antibody', 'antibody');
UPDATE deals SET modality = 'small_molecule' WHERE LOWER(modality) = 'small molecule';
UPDATE deals SET modality = 'gene_therapy' WHERE LOWER(modality) = 'gene therapy';
UPDATE deals SET modality = 'cell_therapy' WHERE LOWER(modality) IN ('cell therapy', 'car-t');
UPDATE deals SET modality = 'bispecific' WHERE LOWER(modality) = 'bispecific antibody';

-- ============================================
-- STEP 3: Verified 2023 Deals
-- ============================================

-- Moderna & CytomX - Jan 6, 2023
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'CytomX Therapeutics', 'Moderna', 'Probody therapeutics', 'mab', 'oncology', 'preclinical', 40000000, 1200000000, '2023-01-06', 'collaboration', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name = 'CytomX Therapeutics' AND licensee_name = 'Moderna');

-- Voyager & Neurocrine - Jan 9, 2023
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'Voyager Therapeutics', 'Neurocrine Biosciences', 'GBA1 gene therapy', 'gene_therapy', 'neurology', 'preclinical', 175000000, 175000000, '2023-01-09', 'license', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name = 'Voyager Therapeutics' AND licensee_name = 'Neurocrine Biosciences');

-- Kronos Bio & Genentech - Jan 9, 2023
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'Kronos Bio', 'Genentech', 'Transcription factor oncology', 'small_molecule', 'oncology', 'discovery', 20000000, 554000000, '2023-01-09', 'license', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name = 'Kronos Bio' AND licensee_name = 'Genentech');

-- BMS & SystImmune - Dec 2023
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'SystImmune', 'Bristol Myers Squibb', 'BL-B01D1 bispecific ADC', 'adc', 'oncology', 'phase_1', 800000000, 8400000000, '2023-12-20', 'license', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name = 'SystImmune' AND licensee_name ILIKE '%Bristol%');

-- ============================================
-- STEP 4: Verified 2024 Deals
-- ============================================

-- Novartis & Shanghai Argo - Jan 7, 2024
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'Shanghai Argo Biopharmaceutical', 'Novartis', 'Cardiovascular siRNA', 'rnai', 'cardiovascular', 'preclinical', 185000000, 4165000000, '2024-01-07', 'license', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name ILIKE '%Argo%' AND licensee_name = 'Novartis');

-- Novartis & PeptiDream - Apr 30, 2024
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'PeptiDream', 'Novartis', 'Peptide discovery platform', 'peptide', 'oncology', 'discovery', 180000000, 2890000000, '2024-04-30', 'collaboration', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name = 'PeptiDream' AND licensee_name = 'Novartis');

-- Sanofi & Novavax - May 10, 2024
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'Novavax', 'Sanofi', 'COVID-19 vaccine', 'mrna', 'infectious_disease', 'approved', 500000000, 1200000000, '2024-05-10', 'license', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name = 'Novavax' AND licensee_name = 'Sanofi');

-- BMS & Prime Medicine - Sep 30, 2024
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'Prime Medicine', 'Bristol Myers Squibb', 'Gene editing cell therapy', 'gene_therapy', 'oncology', 'preclinical', 110000000, 3610000000, '2024-09-30', 'collaboration', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name = 'Prime Medicine' AND licensee_name ILIKE '%Bristol%');

-- Sarepta & Arrowhead - Nov 26, 2024
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'Arrowhead Pharmaceuticals', 'Sarepta Therapeutics', 'RNAi muscular dystrophy', 'rnai', 'rare_disease', 'phase_2', 875000000, 1075000000, '2024-11-26', 'license', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name ILIKE '%Arrowhead%' AND licensee_name ILIKE '%Sarepta%');

-- Novartis & PTC - Dec 2, 2024
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'PTC Therapeutics', 'Novartis', 'Huntington program', 'small_molecule', 'neurology', 'phase_2', 1000000000, 2900000000, '2024-12-02', 'license', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name = 'PTC Therapeutics' AND licensee_name = 'Novartis');

-- BMS & BioArctic - Dec 19, 2024
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'BioArctic', 'Bristol Myers Squibb', 'Alzheimer antibodies', 'mab', 'neurology', 'phase_1', 100000000, 1350000000, '2024-12-19', 'license', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name = 'BioArctic' AND licensee_name ILIKE '%Bristol%');

-- AstraZeneca & Fusion - Mar 2024
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'Fusion Pharmaceuticals', 'AstraZeneca', 'Radiopharmaceutical portfolio', 'radiopharmaceutical', 'oncology', 'phase_2', 2000000000, 2000000000, '2024-03-19', 'acquisition', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name ILIKE '%Fusion%' AND licensee_name = 'AstraZeneca');

-- ============================================
-- STEP 5: Verified 2025 Deals
-- ============================================

-- J&J & Intra-Cellular - Jan 2025
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'Intra-Cellular Therapies', 'Johnson & Johnson', 'Caplyta (lumateperone)', 'small_molecule', 'neurology', 'approved', 14600000000, 14600000000, '2025-01-13', 'acquisition', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name ILIKE '%Intra-Cellular%');

-- Merck & Hengrui - Mar 2025
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'Hengrui Pharmaceuticals', 'Merck & Co', 'HRS-5346 Lp(a) inhibitor', 'small_molecule', 'cardiovascular', 'phase_2', 200000000, 1970000000, '2025-03-25', 'license', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name ILIKE '%Hengrui%' AND asset_name ILIKE '%5346%');

-- Novo Nordisk & Akero - Apr 2025
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'Akero Therapeutics', 'Novo Nordisk', 'Efruxifermin NASH', 'mab', 'metabolic', 'phase_3', 5200000000, 5200000000, '2025-04-22', 'acquisition', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name ILIKE '%Akero%');

-- Pfizer & 3SBio - May 2025
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT '3SBio', 'Pfizer', 'SSGJ-707 PD-1xVEGF bispecific', 'bispecific', 'oncology', 'phase_2', 500000000, 6050000000, '2025-05-19', 'license', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name = '3SBio' AND licensee_name = 'Pfizer');

-- Novartis & Tourmaline - Jun 2025
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'Tourmaline Bio', 'Novartis', 'Pacibekitug IL-6 mAb', 'mab', 'cardiovascular', 'phase_2', 1400000000, 1400000000, '2025-06-18', 'acquisition', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name ILIKE '%Tourmaline%');

-- Merck & Verona - Jul 2025
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'Verona Pharma', 'Merck & Co', 'Ohtuvayre (ensifentrine)', 'small_molecule', 'respiratory', 'approved', 10000000000, 10000000000, '2025-07-15', 'acquisition', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name ILIKE '%Verona%');

-- Novartis & Avidity - Aug 2025
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'Avidity Biosciences', 'Novartis', 'Neuromuscular disease portfolio', 'rnai', 'rare_disease', 'phase_3', 12000000000, 12000000000, '2025-08-05', 'acquisition', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name ILIKE '%Avidity%');

-- Merck & Cidara - Sep 2025
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'Cidara Therapeutics', 'Merck & Co', 'CD388 influenza antiviral', 'mab', 'infectious_disease', 'phase_3', 9200000000, 9200000000, '2025-09-22', 'acquisition', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name ILIKE '%Cidara%');

-- Novartis & Regulus - Oct 2025
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'Regulus Therapeutics', 'Novartis', 'Farabursen PKD', 'rnai', 'rare_disease', 'phase_2', 1700000000, 1700000000, '2025-10-08', 'acquisition', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name ILIKE '%Regulus%');

-- Pfizer & Metsera - Nov 2025
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'Metsera', 'Pfizer', 'Obesity drug portfolio', 'peptide', 'metabolic', 'phase_2', 10000000000, 10000000000, '2025-11-12', 'acquisition', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name = 'Metsera');

-- Roche & Manifold - Dec 2025
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'Manifold Bio', 'Roche', 'AI brain shuttle tech', 'mab', 'neurology', 'discovery', 200000000, 2055000000, '2025-12-02', 'collaboration', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name = 'Manifold Bio');

-- Pfizer & Fosun - Dec 2025
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'Fosun Pharma', 'Pfizer', 'GLP-1 receptor agonist', 'peptide', 'metabolic', 'phase_2', 200000000, 2150000000, '2025-12-09', 'license', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name = 'Fosun Pharma' AND licensee_name = 'Pfizer');

-- Sanofi & Dren Bio - Dec 2025
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'Dren Bio', 'Sanofi', 'Multispecific antibody platform', 'bispecific', 'oncology', 'discovery', 100000000, 1800000000, '2025-12-15', 'collaboration', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name = 'Dren Bio');

-- Eli Lilly & ABL Bio - Dec 2025
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'ABL Bio', 'Eli Lilly', 'Grabody bispecific platform', 'bispecific', 'oncology', 'discovery', 250000000, 2655000000, '2025-12-16', 'collaboration', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name = 'ABL Bio' AND licensee_name ILIKE '%Lilly%');

-- Sanofi & ADEL - Dec 2025
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'ADEL', 'Sanofi', 'ADEL-Y01 tau antibody', 'mab', 'neurology', 'phase_1', 80000000, 1040000000, '2025-12-18', 'license', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name = 'ADEL');

-- Simcere & Ipsen - Dec 2025
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'Simcere Pharmaceutical', 'Ipsen', 'LRRC15-targeted ADC', 'adc', 'oncology', 'phase_1', 100000000, 1060000000, '2025-12-19', 'license', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name ILIKE '%Simcere%' AND licensee_name = 'Ipsen');

-- AstraZeneca & Jacobio - Dec 2025
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'Jacobio Pharma', 'AstraZeneca', 'JAB-23E73 KRAS inhibitor', 'small_molecule', 'oncology', 'phase_1', 100000000, 2015000000, '2025-12-21', 'license', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name ILIKE '%Jacobio%' AND licensee_name = 'AstraZeneca');

-- Sanofi & Dynavax - Dec 2025
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'Dynavax Technologies', 'Sanofi', 'HEPLISAV-B vaccine', 'mrna', 'infectious_disease', 'approved', 2200000000, 2200000000, '2025-12-24', 'acquisition', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name ILIKE '%Dynavax%');

-- Pfizer & YaoPharma - Dec 2025
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'YaoPharma', 'Pfizer', 'YP05002 GLP-1 agonist', 'peptide', 'metabolic', 'phase_1', 150000000, 2085000000, '2025-12-28', 'license', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name = 'YaoPharma');

-- ============================================
-- STEP 6: Verified January 2026 Deal
-- ============================================

-- AstraZeneca & CSPC - Jan 2026
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'CSPC Pharmaceutical', 'AstraZeneca', 'SYH2082 GLP1/GIPR obesity', 'peptide', 'metabolic', 'phase_1', 1200000000, 18500000000, '2026-01-15', 'license', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name = 'CSPC Pharmaceutical' AND asset_name ILIKE '%SYH2082%');

-- ============================================
-- STEP 7: Check results
-- ============================================
SELECT
  COUNT(*) as total_deals,
  MIN(announced_date) as earliest_date,
  MAX(announced_date) as latest_date
FROM deals;
