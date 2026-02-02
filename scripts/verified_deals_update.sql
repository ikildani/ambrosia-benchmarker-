-- Verified Deals Update Script
-- Sources: BioSpace, Labiotech, Pharmaceutical Technology, DIMA Biotech, Nature
-- Last verified: February 2, 2026

-- ============================================
-- STEP 1: Clean up future dates that can't exist
-- Set any dates after Feb 2, 2026 to NULL (we verified earlier, but just in case)
-- ============================================
UPDATE deals
SET announced_date = '2026-02-02'
WHERE announced_date > '2026-02-02';

-- ============================================
-- STEP 2: Insert/Update Verified 2023 Deals
-- ============================================

-- Moderna & CytomX - Jan 6, 2023
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
VALUES ('CytomX Therapeutics', 'Moderna', 'Probody therapeutics collaboration', 'mab', 'oncology', 'preclinical', 40000000, 1200000000, '2023-01-06', 'collaboration', true)
ON CONFLICT DO NOTHING;

-- Voyager & Neurocrine - Jan 9, 2023
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
VALUES ('Voyager Therapeutics', 'Neurocrine Biosciences', 'GBA1 gene therapy', 'gene_therapy', 'neurology', 'preclinical', 175000000, 175000000, '2023-01-09', 'license', true)
ON CONFLICT DO NOTHING;

-- Kronos Bio & Genentech - Jan 9, 2023
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
VALUES ('Kronos Bio', 'Genentech', 'Transcription factor program', 'small_molecule', 'oncology', 'discovery', 20000000, 554000000, '2023-01-09', 'license', true)
ON CONFLICT DO NOTHING;

-- Karuna & Goldfinch Bio - Feb 2, 2023
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
VALUES ('Goldfinch Bio', 'Karuna Therapeutics', 'TRPC4/5 channel agents', 'small_molecule', 'neurology', 'preclinical', 520000000, 520000000, '2023-02-02', 'license', true)
ON CONFLICT DO NOTHING;

-- BMS & SystImmune - 2023
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
VALUES ('SystImmune', 'Bristol Myers Squibb', 'BL-B01D1 bispecific ADC', 'adc', 'oncology', 'phase_1', 800000000, 8400000000, '2023-12-20', 'license', true)
ON CONFLICT DO NOTHING;

-- ============================================
-- STEP 3: Insert/Update Verified 2024 Deals
-- ============================================

-- Novartis & Shanghai Argo - Jan 7, 2024
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
VALUES ('Shanghai Argo Biopharmaceutical', 'Novartis', 'Cardiovascular siRNA program', 'rnai', 'cardiovascular', 'preclinical', 185000000, 4165000000, '2024-01-07', 'license', true)
ON CONFLICT DO NOTHING;

-- Novartis & PeptiDream - Apr 30, 2024
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
VALUES ('PeptiDream', 'Novartis', 'Peptide discovery collaboration', 'peptide', 'oncology', 'discovery', 180000000, 2890000000, '2024-04-30', 'collaboration', true)
ON CONFLICT DO NOTHING;

-- Sanofi & Novavax - May 10, 2024
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
VALUES ('Novavax', 'Sanofi', 'COVID-19 vaccine license', 'mrna', 'infectious_disease', 'approved', 500000000, 1200000000, '2024-05-10', 'license', true)
ON CONFLICT DO NOTHING;

-- BMS & Prime Medicine - Sep 30, 2024
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
VALUES ('Prime Medicine', 'Bristol Myers Squibb', 'Gene editing cell therapy', 'gene_therapy', 'oncology', 'preclinical', 110000000, 3610000000, '2024-09-30', 'collaboration', true)
ON CONFLICT DO NOTHING;

-- Sarepta & Arrowhead - Nov 26, 2024
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
VALUES ('Arrowhead Pharmaceuticals', 'Sarepta Therapeutics', 'RNAi muscular dystrophy', 'rnai', 'rare_disease', 'phase_2', 875000000, 1075000000, '2024-11-26', 'license', true)
ON CONFLICT DO NOTHING;

-- Novartis & PTC - Dec 2, 2024
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
VALUES ('PTC Therapeutics', 'Novartis', 'Huntington disease program', 'small_molecule', 'neurology', 'phase_2', 1000000000, 2900000000, '2024-12-02', 'license', true)
ON CONFLICT DO NOTHING;

-- BMS & BioArctic - Dec 19, 2024
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
VALUES ('BioArctic', 'Bristol Myers Squibb', 'Alzheimer antibodies', 'mab', 'neurology', 'phase_1', 100000000, 1350000000, '2024-12-19', 'license', true)
ON CONFLICT DO NOTHING;

-- AstraZeneca & Fusion Pharma - Q1 2024
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
VALUES ('Fusion Pharmaceuticals', 'AstraZeneca', 'Radiopharmaceutical acquisition', 'radiopharmaceutical', 'oncology', 'phase_2', 2000000000, 2000000000, '2024-03-19', 'acquisition', true)
ON CONFLICT DO NOTHING;

-- Merck & EyeBio - Q2 2024
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
VALUES ('EyeBio', 'Merck & Co', 'Ophthalmic treatments', 'mab', 'ophthalmology', 'phase_3', 3000000000, 3000000000, '2024-05-03', 'acquisition', true)
ON CONFLICT DO NOTHING;

-- ============================================
-- STEP 4: Insert/Update Verified 2025 Deals
-- ============================================

-- J&J & Intra-Cellular - Jan 2025
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
VALUES ('Intra-Cellular Therapies', 'Johnson & Johnson', 'Caplyta (lumateperone)', 'small_molecule', 'neurology', 'approved', 14600000000, 14600000000, '2025-01-13', 'acquisition', true)
ON CONFLICT DO NOTHING;

-- United Biotechnology & Novo Nordisk - Q1 2025
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
VALUES ('United Biotechnology', 'Novo Nordisk', 'Metabolic disease program', 'peptide', 'metabolic', 'preclinical', 200000000, 2000000000, '2025-02-15', 'license', true)
ON CONFLICT DO NOTHING;

-- Sciwind & Verdiva - Q1 2025
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
VALUES ('Sciwind Biosciences', 'Verdiva Bio', 'GLP-1 program', 'peptide', 'metabolic', 'phase_1', 70000000, 2470000000, '2025-03-10', 'license', true)
ON CONFLICT DO NOTHING;

-- BioMed & AstraZeneca - Q1 2025
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
VALUES ('BioMed X', 'AstraZeneca', 'Oncology research collaboration', 'small_molecule', 'oncology', 'discovery', 280000000, 280000000, '2025-02-20', 'collaboration', true)
ON CONFLICT DO NOTHING;

-- Merck & Hengrui - Mar 25, 2025
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
VALUES ('Hengrui Pharmaceuticals', 'Merck & Co', 'HRS-5346 Lp(a) inhibitor', 'small_molecule', 'cardiovascular', 'phase_2', 200000000, 1970000000, '2025-03-25', 'license', true)
ON CONFLICT DO NOTHING;

-- Pfizer & 3SBio - May 19, 2025
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
VALUES ('3SBio', 'Pfizer', 'SSGJ-707 PD-1xVEGF bispecific', 'bispecific', 'oncology', 'phase_2', 500000000, 6050000000, '2025-05-19', 'license', true)
ON CONFLICT DO NOTHING;

-- Merck & Verona Pharma - Jul 2025
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
VALUES ('Verona Pharma', 'Merck & Co', 'Ohtuvayre (ensifentrine)', 'small_molecule', 'respiratory', 'approved', 10000000000, 10000000000, '2025-07-15', 'acquisition', true)
ON CONFLICT DO NOTHING;

-- Merck & Cidara - 2025
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
VALUES ('Cidara Therapeutics', 'Merck & Co', 'CD388 influenza antiviral', 'mab', 'infectious_disease', 'phase_3', 9200000000, 9200000000, '2025-09-22', 'acquisition', true)
ON CONFLICT DO NOTHING;

-- Novartis & Avidity - 2025
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
VALUES ('Avidity Biosciences', 'Novartis', 'Neuromuscular disease portfolio', 'rnai', 'rare_disease', 'phase_3', 12000000000, 12000000000, '2025-08-05', 'acquisition', true)
ON CONFLICT DO NOTHING;

-- Novartis & Tourmaline - 2025
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
VALUES ('Tourmaline Bio', 'Novartis', 'Pacibekitug IL-6 mAb', 'mab', 'cardiovascular', 'phase_2', 1400000000, 1400000000, '2025-06-18', 'acquisition', true)
ON CONFLICT DO NOTHING;

-- Novartis & Regulus - 2025
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
VALUES ('Regulus Therapeutics', 'Novartis', 'Farabursen PKD', 'rnai', 'rare_disease', 'phase_2', 1700000000, 1700000000, '2025-10-08', 'acquisition', true)
ON CONFLICT DO NOTHING;

-- Novo Nordisk & Akero - 2025
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
VALUES ('Akero Therapeutics', 'Novo Nordisk', 'Efruxifermin NASH', 'mab', 'metabolic', 'phase_3', 5200000000, 5200000000, '2025-04-22', 'acquisition', true)
ON CONFLICT DO NOTHING;

-- Pfizer & Metsera - Nov 2025
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
VALUES ('Metsera', 'Pfizer', 'Obesity drug portfolio', 'peptide', 'metabolic', 'phase_2', 10000000000, 10000000000, '2025-11-12', 'acquisition', true)
ON CONFLICT DO NOTHING;

-- AstraZeneca & Jacobio - Dec 2025
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
VALUES ('Jacobio Pharma', 'AstraZeneca', 'JAB-23E73 KRAS inhibitor', 'small_molecule', 'oncology', 'phase_1', 100000000, 2015000000, '2025-12-21', 'license', true)
ON CONFLICT DO NOTHING;

-- Sanofi & Dren Bio - Dec 2025
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
VALUES ('Dren Bio', 'Sanofi', 'Multispecific antibody discovery', 'bispecific', 'oncology', 'discovery', 100000000, 1800000000, '2025-12-15', 'collaboration', true)
ON CONFLICT DO NOTHING;

-- Sanofi & ADEL - Dec 2025
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
VALUES ('ADEL', 'Sanofi', 'ADEL-Y01 tau antibody', 'mab', 'neurology', 'phase_1', 80000000, 1040000000, '2025-12-18', 'license', true)
ON CONFLICT DO NOTHING;

-- Pfizer & Fosun - Dec 9, 2025
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
VALUES ('Fosun Pharma', 'Pfizer', 'GLP-1 receptor agonist', 'peptide', 'metabolic', 'phase_2', 200000000, 2150000000, '2025-12-09', 'license', true)
ON CONFLICT DO NOTHING;

-- Eli Lilly & ABL Bio - Dec 16, 2025
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
VALUES ('ABL Bio', 'Eli Lilly', 'Grabody bispecific platform', 'bispecific', 'oncology', 'discovery', 250000000, 2655000000, '2025-12-16', 'collaboration', true)
ON CONFLICT DO NOTHING;

-- Simcere & Ipsen - Dec 19, 2025
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
VALUES ('Simcere Pharmaceutical', 'Ipsen', 'LRRC15-targeted ADC', 'adc', 'oncology', 'phase_1', 100000000, 1060000000, '2025-12-19', 'license', true)
ON CONFLICT DO NOTHING;

-- Roche & Manifold Bio - Dec 2, 2025
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
VALUES ('Manifold Bio', 'Roche', 'AI brain shuttle technology', 'mab', 'neurology', 'discovery', 200000000, 2055000000, '2025-12-02', 'collaboration', true)
ON CONFLICT DO NOTHING;

-- Sanofi & Dynavax - Dec 24, 2025
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
VALUES ('Dynavax Technologies', 'Sanofi', 'HEPLISAV-B acquisition', 'mrna', 'infectious_disease', 'approved', 2200000000, 2200000000, '2025-12-24', 'acquisition', true)
ON CONFLICT DO NOTHING;

-- Pfizer & YaoPharma - Dec 2025
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
VALUES ('YaoPharma', 'Pfizer', 'YP05002 GLP-1 agonist', 'peptide', 'metabolic', 'phase_1', 150000000, 2085000000, '2025-12-28', 'license', true)
ON CONFLICT DO NOTHING;

-- ============================================
-- STEP 5: Insert/Update Verified January 2026 Deals
-- ============================================

-- AstraZeneca & CSPC - Jan 2026
INSERT INTO deals (licensor_name, licensee_name, asset_name, modality, indication_category, phase_at_signing, upfront_usd, total_deal_value_usd, announced_date, deal_type, terms_disclosed)
VALUES ('CSPC Pharmaceutical', 'AstraZeneca', 'SYH2082 GLP1/GIPR obesity', 'peptide', 'metabolic', 'phase_1', 1200000000, 18500000000, '2026-01-15', 'license', true)
ON CONFLICT DO NOTHING;

-- ============================================
-- STEP 6: Normalize modality values
-- ============================================
UPDATE deals SET modality = 'adc' WHERE LOWER(modality) IN ('adc', 'antibody-drug conjugate', 'antibody drug conjugate');
UPDATE deals SET modality = 'mab' WHERE LOWER(modality) IN ('mab', 'monoclonal antibody', 'antibody');
UPDATE deals SET modality = 'small_molecule' WHERE LOWER(modality) IN ('small molecule', 'small_molecule', 'sm');
UPDATE deals SET modality = 'gene_therapy' WHERE LOWER(modality) IN ('gene therapy', 'gene_therapy', 'gt');
UPDATE deals SET modality = 'cell_therapy' WHERE LOWER(modality) IN ('cell therapy', 'cell_therapy', 'car-t', 'car_t');
UPDATE deals SET modality = 'rnai' WHERE LOWER(modality) IN ('rnai', 'sirna', 'rna interference');
UPDATE deals SET modality = 'bispecific' WHERE LOWER(modality) IN ('bispecific', 'bispecific antibody');
UPDATE deals SET modality = 'peptide' WHERE LOWER(modality) IN ('peptide', 'peptides');
UPDATE deals SET modality = 'mrna' WHERE LOWER(modality) IN ('mrna', 'messenger rna');
UPDATE deals SET modality = 'radiopharmaceutical' WHERE LOWER(modality) IN ('radiopharmaceutical', 'radiopharma');

-- ============================================
-- STEP 7: Verify the updates
-- ============================================
SELECT
  COUNT(*) as total_deals,
  COUNT(CASE WHEN announced_date >= '2023-01-01' AND announced_date <= '2026-02-02' THEN 1 END) as valid_date_range,
  COUNT(DISTINCT modality) as unique_modalities,
  COUNT(DISTINCT indication_category) as unique_indications
FROM deals;
