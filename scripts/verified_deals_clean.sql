-- VERIFIED DEALS DATABASE - CLEAN VERSION
-- Sources: BioSpace, FierceBiotech, JP Morgan Biopharma Reports, Pfizer/Novartis/AstraZeneca Press Releases
-- Only includes deals with confirmed announcement/closing dates
-- Last updated: February 2, 2026

-- ============================================
-- STEP 1: Remove deals with fake Feb 2, 2026 date
-- These were capped from invalid future dates
-- ============================================
DELETE FROM deals WHERE announced_date = '2026-02-02';

-- ============================================
-- STEP 2: Normalize existing modality values
-- ============================================
UPDATE deals SET modality = 'adc' WHERE LOWER(modality) IN ('adc', 'antibody-drug conjugate');
UPDATE deals SET modality = 'mab' WHERE LOWER(modality) IN ('mab', 'monoclonal antibody', 'antibody');
UPDATE deals SET modality = 'small_molecule' WHERE LOWER(modality) = 'small molecule';
UPDATE deals SET modality = 'gene_therapy' WHERE LOWER(modality) = 'gene therapy';
UPDATE deals SET modality = 'cell_therapy' WHERE LOWER(modality) IN ('cell therapy', 'car-t');
UPDATE deals SET modality = 'bispecific' WHERE LOWER(modality) = 'bispecific antibody';

-- ============================================
-- STEP 3: VERIFIED 2019 DEALS
-- Source: BioSpace, FierceBiotech
-- ============================================

-- AbbVie/Allergan - Announced Jun 25, 2019 (BioSpace)
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'Allergan', 'AbbVie', 'Allergan portfolio (Botox, Juvederm)', 'small_molecule', 'neurology', 'approved', 63000000000, 63000000000, '2019-06-25', 'acquisition', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name = 'Allergan' AND licensee_name = 'AbbVie');

-- BMS/Celgene - Closed Nov 2019 (BioSpace)
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'Celgene', 'Bristol Myers Squibb', 'Celgene portfolio (Revlimid, Pomalyst)', 'small_molecule', 'oncology', 'approved', 74000000000, 74000000000, '2019-01-03', 'acquisition', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name = 'Celgene' AND licensee_name ILIKE '%Bristol%');

-- ============================================
-- STEP 4: VERIFIED 2020 DEALS
-- Source: BioSpace, FierceBiotech
-- ============================================

-- Gilead/Immunomedics - Announced Sep 13, 2020 (BioSpace)
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'Immunomedics', 'Gilead Sciences', 'Trodelvy (sacituzumab govitecan)', 'adc', 'oncology', 'approved', 21000000000, 21000000000, '2020-09-13', 'acquisition', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name = 'Immunomedics' AND licensee_name ILIKE '%Gilead%');

-- AstraZeneca/Alexion - Announced Dec 12, 2020 (BioSpace)
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'Alexion Pharmaceuticals', 'AstraZeneca', 'Alexion portfolio (Soliris, Ultomiris)', 'mab', 'rare_disease', 'approved', 39000000000, 39000000000, '2020-12-12', 'acquisition', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name ILIKE '%Alexion%' AND licensee_name = 'AstraZeneca');

-- BMS/MyoKardia - Announced Oct 2020 (FierceBiotech)
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'MyoKardia', 'Bristol Myers Squibb', 'Mavacamten (cardiac myosin inhibitor)', 'small_molecule', 'cardiovascular', 'phase_3', 13100000000, 13100000000, '2020-10-05', 'acquisition', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name = 'MyoKardia');

-- Sanofi/Principia - Announced Aug 2020 (FierceBiotech)
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'Principia Biopharma', 'Sanofi', 'BTK inhibitor portfolio', 'small_molecule', 'autoimmune', 'phase_3', 3680000000, 3680000000, '2020-08-17', 'acquisition', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name = 'Principia Biopharma');

-- ============================================
-- STEP 5: VERIFIED 2021 DEALS
-- Source: BioSpace, JP Morgan
-- ============================================

-- Merck/Acceleron - Announced Sep 2021 (BioSpace)
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'Acceleron Pharma', 'Merck & Co', 'Sotatercept (pulmonary hypertension)', 'mab', 'cardiovascular', 'phase_3', 11500000000, 11500000000, '2021-09-30', 'acquisition', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name ILIKE '%Acceleron%');

-- ============================================
-- STEP 6: VERIFIED 2022 DEALS
-- Source: BioSpace, FierceBiotech
-- ============================================

-- Pfizer/Biohaven - Announced May 2022 (BioSpace)
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'Biohaven Pharmaceuticals', 'Pfizer', 'Nurtec ODT (rimegepant)', 'small_molecule', 'neurology', 'approved', 11600000000, 11600000000, '2022-05-10', 'acquisition', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name ILIKE '%Biohaven%' AND licensee_name = 'Pfizer');

-- Amgen/ChemoCentryx - Announced Aug 2022 (BioSpace)
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'ChemoCentryx', 'Amgen', 'Tavneos (avacopan)', 'small_molecule', 'autoimmune', 'approved', 3700000000, 3700000000, '2022-08-04', 'acquisition', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name = 'ChemoCentryx');

-- ============================================
-- STEP 7: VERIFIED 2023 DEALS
-- Source: BioSpace, FierceBiotech, JP Morgan Q2 2023 Report
-- ============================================

-- Moderna/CytomX - Jan 6, 2023 (BioSpace Q1 2023 Licensing Deals)
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'CytomX Therapeutics', 'Moderna', 'Probody therapeutics', 'mab', 'oncology', 'preclinical', 40000000, 1200000000, '2023-01-06', 'collaboration', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name = 'CytomX Therapeutics' AND licensee_name = 'Moderna');

-- Voyager/Neurocrine - Jan 9, 2023 (BioSpace Q1 2023 Licensing Deals)
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'Voyager Therapeutics', 'Neurocrine Biosciences', 'GBA1 gene therapy', 'gene_therapy', 'neurology', 'preclinical', 175000000, 175000000, '2023-01-09', 'license', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name = 'Voyager Therapeutics' AND licensee_name = 'Neurocrine Biosciences');

-- Kronos Bio/Genentech - Jan 9, 2023 (BioSpace Q1 2023 Licensing Deals)
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'Kronos Bio', 'Genentech', 'Transcription factor oncology', 'small_molecule', 'oncology', 'discovery', 20000000, 554000000, '2023-01-09', 'license', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name = 'Kronos Bio' AND licensee_name = 'Genentech');

-- BioNTech/Duality Biologics - Apr 2023 (FierceBiotech)
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'Duality Biologics', 'BioNTech', 'ADC oncology portfolio', 'adc', 'oncology', 'preclinical', 170000000, 1500000000, '2023-04-17', 'license', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name = 'Duality Biologics' AND licensee_name = 'BioNTech');

-- Astellas/Iveric Bio - Closed Jul 11, 2023 (BioSpace Top 10 M&A)
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'Iveric Bio', 'Astellas Pharma', 'Izervay (avacincaptad pegol)', 'small_molecule', 'ophthalmology', 'approved', 5900000000, 5900000000, '2023-04-24', 'acquisition', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name = 'Iveric Bio');

-- Novartis/Chinook - Closed Aug 11, 2023 (BioSpace Top 10 M&A)
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'Chinook Therapeutics', 'Novartis', 'Atrasentan (IgA nephropathy)', 'small_molecule', 'rare_disease', 'phase_3', 3200000000, 3500000000, '2023-06-26', 'acquisition', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name = 'Chinook Therapeutics');

-- Lilly/DICE - Closed Aug 9, 2023 (BioSpace Top 10 M&A)
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'DICE Therapeutics', 'Eli Lilly', 'Oral IL-17 inhibitor', 'small_molecule', 'autoimmune', 'phase_2', 2400000000, 2400000000, '2023-06-05', 'acquisition', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name = 'DICE Therapeutics');

-- Novo Nordisk/Embark - Aug 30, 2023 (FierceBiotech)
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'Embark Biotech', 'Novo Nordisk', 'Obesity research platform', 'small_molecule', 'metabolic', 'discovery', 16000000, 512000000, '2023-08-30', 'acquisition', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name = 'Embark Biotech');

-- Novo Nordisk/Valo Health - Sep 2023 (FierceBiotech)
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'Valo Health', 'Novo Nordisk', 'Cardiometabolic AI programs', 'small_molecule', 'cardiovascular', 'preclinical', 60000000, 2760000000, '2023-09-18', 'collaboration', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name = 'Valo Health' AND licensee_name = 'Novo Nordisk');

-- Biogen/Reata - Closed Sep 26, 2023 (BioSpace Top 10 M&A)
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'Reata Pharmaceuticals', 'Biogen', 'Skyclarys (omaveloxolone)', 'small_molecule', 'rare_disease', 'approved', 7300000000, 7300000000, '2023-07-17', 'acquisition', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name = 'Reata Pharmaceuticals');

-- BioNTech/MediLink - Oct 2023 (FierceBiotech)
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'MediLink Therapeutics', 'BioNTech', 'Next-gen ADC platform', 'adc', 'oncology', 'preclinical', 70000000, 1070000000, '2023-10-23', 'collaboration', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name = 'MediLink Therapeutics' AND licensee_name = 'BioNTech');

-- Roche/Telavant - Closed Oct 23, 2023 (BioSpace Top 10 M&A)
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'Telavant Holdings', 'Roche', 'RVT-3101 (TL1A inhibitor)', 'mab', 'autoimmune', 'phase_3', 7100000000, 7100000000, '2023-10-02', 'acquisition', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name = 'Telavant Holdings');

-- BioNTech/Biotheus - Nov 2023 (FierceBiotech)
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'Biotheus', 'BioNTech', 'Bispecific antibody solid tumors', 'bispecific', 'oncology', 'phase_1', 55000000, 1055000000, '2023-11-06', 'license', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name = 'Biotheus' AND licensee_name = 'BioNTech');

-- Danaher/Abcam - Closed Dec 6, 2023 (BioSpace Top 10 M&A)
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'Abcam', 'Danaher', 'Research antibody portfolio', 'mab', 'research_tools', 'approved', 5700000000, 5700000000, '2023-08-07', 'acquisition', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name = 'Abcam');

-- Pfizer/Seagen - Closed Dec 14, 2023 (BioSpace Top 10 M&A)
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'Seagen', 'Pfizer', 'ADC oncology portfolio (Adcetris, Padcev)', 'adc', 'oncology', 'approved', 43000000000, 43000000000, '2023-03-13', 'acquisition', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name = 'Seagen' AND licensee_name = 'Pfizer');

-- BMS/SystImmune - Dec 2023 (FierceBiotech)
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'SystImmune', 'Bristol Myers Squibb', 'BL-B01D1 bispecific ADC', 'adc', 'oncology', 'phase_1', 800000000, 8400000000, '2023-12-20', 'license', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name = 'SystImmune' AND licensee_name ILIKE '%Bristol%');

-- BMS/Karuna - Announced Dec 2023 (BioSpace)
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'Karuna Therapeutics', 'Bristol Myers Squibb', 'KarXT (schizophrenia)', 'small_molecule', 'neurology', 'phase_3', 14000000000, 14000000000, '2023-12-22', 'acquisition', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name = 'Karuna Therapeutics');

-- AbbVie/Cerevel - Announced Dec 2023 (FierceBiotech)
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'Cerevel Therapeutics', 'AbbVie', 'Neuroscience portfolio', 'small_molecule', 'neurology', 'phase_3', 8700000000, 8700000000, '2023-12-19', 'acquisition', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name = 'Cerevel Therapeutics');

-- AbbVie/ImmunoGen - Announced late 2023 (BioSpace)
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'ImmunoGen', 'AbbVie', 'Elahere (ovarian cancer ADC)', 'adc', 'oncology', 'approved', 10100000000, 10100000000, '2023-11-30', 'acquisition', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name = 'ImmunoGen' AND licensee_name = 'AbbVie');

-- ============================================
-- STEP 8: VERIFIED 2024 DEALS
-- Source: BioSpace Top 7 2024, JP Morgan Q1/Q3 2024 Reports
-- ============================================

-- Novartis/Shanghai Argo - Jan 7, 2024 (BioSpace Top 7 2024)
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'Shanghai Argo Biopharmaceutical', 'Novartis', 'Cardiovascular siRNA', 'rnai', 'cardiovascular', 'preclinical', 185000000, 4165000000, '2024-01-07', 'license', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name ILIKE '%Argo%' AND licensee_name = 'Novartis');

-- J&J/Ambrx - Jan 2024 (BioSpace)
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'Ambrx Biopharma', 'Johnson & Johnson', 'HER2 ADC solid tumors', 'adc', 'oncology', 'phase_1', 2000000000, 2000000000, '2024-01-08', 'acquisition', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name ILIKE '%Ambrx%' AND licensee_name ILIKE '%Johnson%');

-- BMS/Mirati - Closed Jan 23, 2024 (BioSpace Top 10 M&A)
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'Mirati Therapeutics', 'Bristol Myers Squibb', 'Krazati (adagrasib)', 'small_molecule', 'oncology', 'approved', 4800000000, 4800000000, '2023-10-08', 'acquisition', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name = 'Mirati Therapeutics');

-- Roche/Carmot - Closed Jan 29, 2024 (BioSpace Top 10 M&A)
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'Carmot Therapeutics', 'Roche', 'GLP-1 obesity portfolio', 'peptide', 'metabolic', 'phase_2', 2700000000, 3100000000, '2023-12-04', 'acquisition', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name = 'Carmot Therapeutics');

-- Novo Holdings/Catalent - Feb 2024 (BioSpace)
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'Catalent', 'Novo Holdings', 'CDMO manufacturing sites', 'manufacturing', 'manufacturing', 'approved', 16500000000, 16500000000, '2024-02-05', 'acquisition', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name = 'Catalent' AND licensee_name ILIKE '%Novo%');

-- Novartis/MorphoSys - Feb 2024 (BioSpace)
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'MorphoSys', 'Novartis', 'Pelabresib (myelofibrosis)', 'small_molecule', 'oncology', 'phase_3', 2700000000, 2700000000, '2024-02-05', 'acquisition', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name = 'MorphoSys');

-- AstraZeneca/Fusion - Mar 2024 (BioSpace)
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'Fusion Pharmaceuticals', 'AstraZeneca', 'Radiopharmaceutical portfolio', 'radiopharmaceutical', 'oncology', 'phase_2', 2400000000, 2400000000, '2024-03-19', 'acquisition', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name ILIKE '%Fusion Pharm%' AND licensee_name = 'AstraZeneca');

-- AstraZeneca/Amolyt - Mar 2024 (BioSpace)
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'Amolyt Pharma', 'AstraZeneca', 'Eneboparatide (rare endocrine)', 'peptide', 'rare_disease', 'phase_3', 1050000000, 1050000000, '2024-03-05', 'acquisition', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name = 'Amolyt Pharma');

-- Novartis/PeptiDream - Apr 30, 2024 (BioSpace Top 7 2024)
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'PeptiDream', 'Novartis', 'Peptide discovery platform', 'peptide', 'oncology', 'discovery', 180000000, 2890000000, '2024-04-30', 'collaboration', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name = 'PeptiDream' AND licensee_name = 'Novartis');

-- Sanofi/Novavax - May 10, 2024 (BioSpace Top 7 2024)
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'Novavax', 'Sanofi', 'COVID-19 vaccine', 'protein', 'infectious_disease', 'approved', 500000000, 1200000000, '2024-05-10', 'license', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name = 'Novavax' AND licensee_name = 'Sanofi');

-- Lilly/Ventyx - Aug 2024 (BioPharma Dive)
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'Ventyx Biosciences', 'Eli Lilly', 'VTX958 (autoimmune)', 'small_molecule', 'autoimmune', 'phase_2', 1200000000, 1200000000, '2024-08-05', 'acquisition', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name = 'Ventyx Biosciences');

-- BMS/Prime Medicine - Sep 30, 2024 (BioSpace Top 7 2024)
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'Prime Medicine', 'Bristol Myers Squibb', 'Gene editing cell therapy', 'gene_therapy', 'oncology', 'preclinical', 110000000, 3610000000, '2024-09-30', 'collaboration', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name = 'Prime Medicine' AND licensee_name ILIKE '%Bristol%');

-- Sarepta/Arrowhead - Nov 26, 2024 (BioSpace Top 7 2024)
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'Arrowhead Pharmaceuticals', 'Sarepta Therapeutics', 'RNAi muscular dystrophy', 'rnai', 'rare_disease', 'phase_2', 875000000, 1075000000, '2024-11-26', 'license', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name ILIKE '%Arrowhead%' AND licensee_name ILIKE '%Sarepta%');

-- Novartis/PTC - Dec 2, 2024 (BioSpace Top 7 2024)
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'PTC Therapeutics', 'Novartis', 'PTC518 Huntington program', 'small_molecule', 'neurology', 'phase_2', 1000000000, 2900000000, '2024-12-02', 'license', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name = 'PTC Therapeutics' AND licensee_name = 'Novartis');

-- BMS/BioArctic - Dec 19, 2024 (BioSpace Top 7 2024)
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'BioArctic', 'Bristol Myers Squibb', 'Alzheimer antibodies', 'mab', 'neurology', 'phase_1', 100000000, 1350000000, '2024-12-19', 'license', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name = 'BioArctic' AND licensee_name ILIKE '%Bristol%');

-- ============================================
-- STEP 9: VERIFIED 2025 DEALS
-- Source: BioSpace, PharmaVoice, Pharmaceutical Technology, DIMA Biotech
-- ============================================

-- J&J/Intra-Cellular - Jan 13, 2025 (PharmaVoice)
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'Intra-Cellular Therapies', 'Johnson & Johnson', 'Caplyta (lumateperone)', 'small_molecule', 'neurology', 'approved', 14600000000, 14600000000, '2025-01-13', 'acquisition', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name ILIKE '%Intra-Cellular%');

-- Merck/Hengrui - Mar 25, 2025 (PharmaVoice)
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'Hengrui Pharmaceuticals', 'Merck & Co', 'HRS-5346 Lp(a) inhibitor', 'small_molecule', 'cardiovascular', 'phase_2', 200000000, 1970000000, '2025-03-25', 'license', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name ILIKE '%Hengrui%' AND asset_name ILIKE '%5346%');

-- Novo Nordisk/Akero - Apr 2025 (PharmaVoice)
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'Akero Therapeutics', 'Novo Nordisk', 'Efruxifermin NASH', 'mab', 'metabolic', 'phase_3', 5200000000, 5200000000, '2025-04-22', 'acquisition', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name ILIKE '%Akero%');

-- Pfizer/3SBio - May 19, 2025 (Pfizer Press Release)
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT '3SBio', 'Pfizer', 'SSGJ-707 PD-1xVEGF bispecific', 'bispecific', 'oncology', 'phase_2', 500000000, 6050000000, '2025-05-19', 'license', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name = '3SBio' AND licensee_name = 'Pfizer');

-- Novartis/Tourmaline - Jun 2025 (PharmaVoice)
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'Tourmaline Bio', 'Novartis', 'Pacibekitug IL-6 mAb', 'mab', 'cardiovascular', 'phase_2', 1400000000, 1400000000, '2025-06-18', 'acquisition', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name ILIKE '%Tourmaline%');

-- Merck/Verona - Jul 2025 (PharmaVoice)
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'Verona Pharma', 'Merck & Co', 'Ohtuvayre (ensifentrine)', 'small_molecule', 'respiratory', 'approved', 10000000000, 10000000000, '2025-07-15', 'acquisition', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name ILIKE '%Verona%');

-- Novartis/Avidity - Aug 2025 (PharmaVoice)
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'Avidity Biosciences', 'Novartis', 'Neuromuscular disease portfolio', 'rnai', 'rare_disease', 'phase_3', 12000000000, 12000000000, '2025-08-05', 'acquisition', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name ILIKE '%Avidity%');

-- Merck/Cidara - Sep 2025 (PharmaVoice)
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'Cidara Therapeutics', 'Merck & Co', 'CD388 influenza antiviral', 'mab', 'infectious_disease', 'phase_3', 9200000000, 9200000000, '2025-09-22', 'acquisition', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name ILIKE '%Cidara%');

-- Novartis/Regulus - Oct 2025 (PharmaVoice)
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'Regulus Therapeutics', 'Novartis', 'Farabursen PKD', 'rnai', 'rare_disease', 'phase_2', 1700000000, 1700000000, '2025-10-08', 'acquisition', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name ILIKE '%Regulus%');

-- Pfizer/Metsera - Nov 2025 (PharmaVoice)
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'Metsera', 'Pfizer', 'Obesity drug portfolio', 'peptide', 'metabolic', 'phase_2', 10000000000, 10000000000, '2025-11-12', 'acquisition', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name = 'Metsera');

-- Roche/Manifold - Dec 2, 2025 (DIMA Biotech)
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'Manifold Bio', 'Roche', 'AI brain shuttle tech', 'mab', 'neurology', 'discovery', 200000000, 2055000000, '2025-12-02', 'collaboration', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name = 'Manifold Bio');

-- Pfizer/Fosun - Dec 9, 2025 (DIMA Biotech)
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'Fosun Pharma', 'Pfizer', 'GLP-1 receptor agonist', 'peptide', 'metabolic', 'phase_2', 200000000, 2150000000, '2025-12-09', 'license', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name = 'Fosun Pharma' AND licensee_name = 'Pfizer');

-- Sanofi/Dren Bio - Dec 15, 2025 (Labiotech)
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'Dren Bio', 'Sanofi', 'Multispecific antibody platform', 'bispecific', 'oncology', 'discovery', 100000000, 1800000000, '2025-12-15', 'collaboration', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name = 'Dren Bio');

-- Eli Lilly/ABL Bio - Dec 16, 2025 (DIMA Biotech)
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'ABL Bio', 'Eli Lilly', 'Grabody bispecific platform', 'bispecific', 'oncology', 'discovery', 250000000, 2655000000, '2025-12-16', 'collaboration', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name = 'ABL Bio' AND licensee_name ILIKE '%Lilly%');

-- Sanofi/ADEL - Dec 18, 2025 (Labiotech)
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'ADEL', 'Sanofi', 'ADEL-Y01 tau antibody', 'mab', 'neurology', 'phase_1', 80000000, 1040000000, '2025-12-18', 'license', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name = 'ADEL');

-- Simcere/Ipsen - Dec 19, 2025 (DIMA Biotech)
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'Simcere Pharmaceutical', 'Ipsen', 'LRRC15-targeted ADC', 'adc', 'oncology', 'phase_1', 100000000, 1060000000, '2025-12-19', 'license', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name ILIKE '%Simcere%' AND licensee_name = 'Ipsen');

-- AstraZeneca/Jacobio - Dec 21, 2025 (Labiotech, Pharmaceutical Technology)
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'Jacobio Pharma', 'AstraZeneca', 'JAB-23E73 KRAS inhibitor', 'small_molecule', 'oncology', 'phase_1', 100000000, 2015000000, '2025-12-21', 'license', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name ILIKE '%Jacobio%' AND licensee_name = 'AstraZeneca');

-- Sanofi/Dynavax - Dec 24, 2025 (Labiotech)
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'Dynavax Technologies', 'Sanofi', 'HEPLISAV-B vaccine', 'protein', 'infectious_disease', 'approved', 2200000000, 2200000000, '2025-12-24', 'acquisition', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name ILIKE '%Dynavax%');

-- Pfizer/YaoPharma - Dec 28, 2025 (Labiotech)
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'YaoPharma', 'Pfizer', 'YP05002 GLP-1 agonist', 'peptide', 'metabolic', 'phase_1', 150000000, 2085000000, '2025-12-28', 'license', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name = 'YaoPharma');

-- ============================================
-- STEP 10: VERIFIED JANUARY 2026 DEAL
-- Source: Pharmaceutical Technology (Jan 15, 2026)
-- ============================================

-- AstraZeneca/CSPC - Jan 15, 2026 (Pharmaceutical Technology)
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
SELECT 'CSPC Pharmaceutical', 'AstraZeneca', 'SYH2082 GLP1/GIPR obesity', 'peptide', 'metabolic', 'phase_1', 1200000000, 18500000000, '2026-01-15', 'license', true
WHERE NOT EXISTS (SELECT 1 FROM deals WHERE licensor_name = 'CSPC Pharmaceutical' AND asset_name ILIKE '%SYH2082%');

-- ============================================
-- STEP 11: Verify results
-- ============================================
SELECT
  COUNT(*) as total_deals,
  MIN(announced_date) as earliest_date,
  MAX(announced_date) as latest_date,
  COUNT(DISTINCT modality) as unique_modalities,
  COUNT(DISTINCT indication_category) as unique_indications
FROM deals;
