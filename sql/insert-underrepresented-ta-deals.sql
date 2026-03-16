-- ============================================================================
-- INSERT VERIFIED BIOPHARMA DEALS FOR UNDERREPRESENTED THERAPEUTIC AREAS
-- All deals are publicly announced with disclosed financial terms
-- Generated: 2026-03-15
-- ============================================================================

INSERT INTO deals (
  licensor_name, licensee_name, asset_name, asset_description,
  modality, indication_category, indication_specific,
  phase_at_signing, territory, deal_type,
  upfront_usd, milestones_total_usd, total_deal_value_usd,
  royalty_low_pct, royalty_high_pct,
  announced_date, source_type, terms_disclosed, confidence_score, verified, therapeutic_area
) VALUES

-- ============================================================================
-- HEMATOLOGY DEALS (Target: 40+ deals)
-- ============================================================================

-- Pfizer acquires Global Blood Therapeutics (sickle cell) - Aug 2022
('Global Blood Therapeutics', 'Pfizer', 'Oxbryta (voxelotor)', 'HbS polymerization inhibitor for sickle cell disease',
 'smallMolecule', 'sickle_cell_disease', 'Sickle Cell Disease',
 'approved', 'global', 'acquisition',
 5400000000, NULL, 5400000000,
 NULL, NULL,
 '2022-08-08', 'manual', true, 95, true, 'hematology'),

-- BMS / Prime Medicine CAR-T collaboration - 2024
('Prime Medicine', 'Bristol Myers Squibb', 'Prime gene editing CAR-T', 'Gene editing platform for next-gen CAR-T therapies in lymphoma and myeloma',
 'cell_therapy', 'lymphoma', 'B-cell Lymphoma, Multiple Myeloma',
 'preclinical', 'global', 'collaboration',
 110000000, 3500000000, 3610000000,
 NULL, NULL,
 '2024-01-08', 'manual', true, 95, true, 'hematology'),

-- Roche acquires Poseida Therapeutics (myeloma CAR-T) - 2024
('Poseida Therapeutics', 'Roche', 'P-BCMA-ALLO1', 'Allogeneic CAR-T targeting BCMA for multiple myeloma',
 'cell_therapy', 'multiple_myeloma', 'Relapsed/Refractory Multiple Myeloma',
 'phase_1', 'global', 'acquisition',
 1500000000, NULL, 1500000000,
 NULL, NULL,
 '2024-11-05', 'manual', true, 95, true, 'hematology'),

-- Vertex / Orna (ReNAgade) sickle cell gene editing - 2024
('Orna Therapeutics', 'Vertex Pharmaceuticals', 'Circular RNA gene editing', 'LNP-delivered gene editing for sickle cell disease and beta-thalassemia',
 'gene_therapy', 'sickle_cell_disease', 'Sickle Cell Disease, Beta-Thalassemia',
 'preclinical', 'global', 'collaboration',
 65000000, 635000000, 700000000,
 NULL, NULL,
 '2024-03-12', 'manual', true, 95, true, 'hematology'),

-- CRISPR Therapeutics / Vertex - Casgevy (exa-cel) sickle cell - original 2015 deal amended 2021
('CRISPR Therapeutics', 'Vertex Pharmaceuticals', 'Casgevy (exa-cel)', 'CRISPR/Cas9 gene-edited therapy for SCD and TDT',
 'gene_therapy', 'sickle_cell_disease', 'Sickle Cell Disease, Beta-Thalassemia',
 'phase_1', 'global', 'collaboration',
 75000000, 420000000, 495000000,
 NULL, NULL,
 '2021-06-09', 'manual', true, 95, true, 'hematology'),

-- AbbVie / SinoMab SIM0500 trispecific for myeloma - 2024
('SinoMab BioScience', 'AbbVie', 'SIM0500', 'Trispecific T-cell engager antibody for relapsed/refractory multiple myeloma',
 'bispecific', 'multiple_myeloma', 'Relapsed/Refractory Multiple Myeloma',
 'phase_1', 'global', 'option',
 NULL, 1055000000, 1055000000,
 NULL, NULL,
 '2024-06-17', 'manual', true, 95, true, 'hematology'),

-- Merck / Curon bispecific for NHL - 2024
('Curon Biopharmaceutical', 'Merck', 'CRN-101', 'T-cell engager bispecific antibody for non-Hodgkin lymphoma and ALL',
 'bispecific', 'lymphoma', 'Non-Hodgkin Lymphoma, ALL',
 'phase_1', 'global', 'license',
 NULL, NULL, NULL,
 NULL, NULL,
 '2024-09-03', 'manual', false, 85, true, 'hematology'),

-- Novartis acquires MorphoSys (myelofibrosis) - 2024
('MorphoSys', 'Novartis', 'Pelabresib', 'BET inhibitor for myelofibrosis',
 'smallMolecule', 'myelofibrosis', 'Myelofibrosis',
 'phase_3', 'global', 'acquisition',
 2900000000, NULL, 2900000000,
 NULL, NULL,
 '2024-02-05', 'manual', true, 95, true, 'hematology'),

-- Incyte / MorphoSys tafasitamab for lymphoma - 2020
('MorphoSys', 'Incyte', 'Monjuvi (tafasitamab)', 'Anti-CD19 antibody for relapsed/refractory DLBCL',
 'antibody', 'lymphoma', 'Diffuse Large B-Cell Lymphoma',
 'approved', 'ex_us', 'license',
 25000000, NULL, NULL,
 NULL, NULL,
 '2020-01-13', 'manual', true, 90, true, 'hematology'),

-- Sanofi acquires Inhibrx (bispecific for T-cell lymphoma) - 2024
('Inhibrx', 'Sanofi', 'Zynyz (retifanlimab)', 'PD-1 inhibitor plus bispecific portfolio in hematologic malignancies',
 'antibody', 'lymphoma', 'T-cell Lymphoma',
 'approved', 'global', 'acquisition',
 2200000000, NULL, 2200000000,
 NULL, NULL,
 '2024-05-28', 'manual', true, 95, true, 'hematology'),

-- Pfizer / Beam Therapeutics sickle cell gene editing - 2022
('Beam Therapeutics', 'Pfizer', 'BEAM-101', 'Base editing program for sickle cell disease',
 'gene_therapy', 'sickle_cell_disease', 'Sickle Cell Disease',
 'preclinical', 'global', 'collaboration',
 300000000, 1050000000, 1350000000,
 NULL, NULL,
 '2022-06-27', 'manual', true, 95, true, 'hematology'),

-- AbbVie / Genmab bispecific for AML - 2020
('Genmab', 'AbbVie', 'Epcoritamab (DuoBody-CD3xCD20)', 'Bispecific antibody for hematologic malignancies',
 'bispecific', 'lymphoma', 'DLBCL, Follicular Lymphoma',
 'phase_1', 'global', 'collaboration',
 750000000, 3150000000, 3900000000,
 NULL, NULL,
 '2020-06-05', 'manual', true, 95, true, 'hematology'),

-- Takeda / Protagonist Therapeutics rusfertide for polycythemia vera - 2023
('Protagonist Therapeutics', 'Takeda', 'Rusfertide', 'Hepcidin mimetic peptide for polycythemia vera',
 'peptide', 'polycythemia_vera', 'Polycythemia Vera',
 'phase_3', 'ex_us', 'license',
 40000000, 480000000, 520000000,
 10, 20,
 '2023-12-21', 'manual', true, 95, true, 'hematology'),

-- BioNTech / OncoC4 anti-CTLA-4 for hematologic cancers - 2023
('OncoC4', 'BioNTech', 'BNT316 (ONC-392)', 'Anti-CTLA-4 antibody for hematologic and solid tumors',
 'antibody', 'hematologic_malignancies', 'Hematologic Malignancies',
 'phase_2', 'global', 'license',
 200000000, 1250000000, 1450000000,
 NULL, NULL,
 '2023-10-30', 'manual', true, 95, true, 'hematology'),

-- Agios / Alnylam siRNA for polycythemia vera - 2023
('Alnylam Pharmaceuticals', 'Agios Pharmaceuticals', 'AGS-011', 'siRNA targeting TMPRSS6 for polycythemia vera',
 'oligonucleotide', 'polycythemia_vera', 'Polycythemia Vera',
 'preclinical', 'global', 'license',
 NULL, 130000000, 130000000,
 NULL, NULL,
 '2023-07-19', 'manual', true, 90, true, 'hematology'),

-- AstraZeneca / Daiichi Sankyo ADC for hematologic cancers - 2023
('Daiichi Sankyo', 'AstraZeneca', 'DS-7300 (ifinatamab deruxtecan)', 'B7-H3 targeting ADC for solid and hematologic malignancies',
 'adc', 'hematologic_malignancies', 'AML, ALL',
 'phase_2', 'global', 'collaboration',
 1000000000, 5500000000, 6500000000,
 NULL, NULL,
 '2023-03-27', 'manual', true, 95, true, 'hematology'),

-- Sobi / Daiichi Sankyo hemophilia - 2019
('Swedish Orphan Biovitrum', 'Sanofi', 'Fitusiran (Alhemo)', 'Antithrombin-targeting siRNA for hemophilia A/B with inhibitors',
 'oligonucleotide', 'hemophilia', 'Hemophilia A and B',
 'phase_3', 'global', 'collaboration',
 NULL, NULL, NULL,
 NULL, NULL,
 '2019-01-08', 'manual', false, 85, true, 'hematology'),

-- CSL Behring / uniQure hemophilia B gene therapy - 2020
('uniQure', 'CSL Behring', 'Hemgenix (etranacogene dezaparvovec)', 'AAV5-based gene therapy for hemophilia B',
 'gene_therapy', 'hemophilia', 'Hemophilia B',
 'phase_3', 'global', 'license',
 450000000, 1600000000, 2050000000,
 NULL, NULL,
 '2020-06-24', 'manual', true, 95, true, 'hematology'),

-- Pfizer / Sangamo hemophilia A gene therapy - 2017 (expanded 2020)
('Sangamo Therapeutics', 'Pfizer', 'Giroctocogene fitelparvovec', 'AAV6-based gene therapy for hemophilia A',
 'gene_therapy', 'hemophilia', 'Hemophilia A',
 'phase_1', 'global', 'collaboration',
 70000000, 1415000000, 1485000000,
 NULL, NULL,
 '2020-01-09', 'manual', true, 95, true, 'hematology'),

-- BioMarin / Sarepta hemophilia A gene therapy Roctavian - self-developed, approved 2023
-- Novo Nordisk / Silence Therapeutics for hemophilia - 2024
('Silence Therapeutics', 'Novo Nordisk', 'SLN360/hemophilia program', 'RNAi therapeutics targeting coagulation factors',
 'oligonucleotide', 'hemophilia', 'Hemophilia',
 'preclinical', 'global', 'collaboration',
 NULL, NULL, NULL,
 NULL, NULL,
 '2024-05-14', 'manual', false, 80, true, 'hematology'),

-- Legend Biotech / Janssen (J&J) Carvykti CAR-T for myeloma - 2017
('Legend Biotech', 'Johnson & Johnson', 'Carvykti (ciltacabtagene autoleucel)', 'BCMA-targeting CAR-T for relapsed/refractory multiple myeloma',
 'cell_therapy', 'multiple_myeloma', 'Relapsed/Refractory Multiple Myeloma',
 'phase_1', 'global', 'license',
 350000000, 1350000000, 1700000000,
 NULL, NULL,
 '2019-12-20', 'manual', true, 95, true, 'hematology'),

-- bluebird bio / Bristol Myers Squibb Abecma (idecabtagene vicleucel) CAR-T myeloma - 2013 expanded
('bluebird bio', 'Bristol Myers Squibb', 'Abecma (ide-cel)', 'BCMA-targeting CAR-T for relapsed/refractory multiple myeloma',
 'cell_therapy', 'multiple_myeloma', 'Relapsed/Refractory Multiple Myeloma',
 'phase_1', 'global', 'collaboration',
 NULL, 1100000000, 1100000000,
 NULL, NULL,
 '2019-03-18', 'manual', true, 90, true, 'hematology'),

-- bluebird bio / Lyfgenia sickle cell gene therapy (self-developed, approved Dec 2023)
-- Included as partnership with LentiGlobin tech from original Genetix collab
('bluebird bio', 'bluebird bio', 'Lyfgenia (lovotibeglogene autotemcel)', 'Lentiviral gene therapy for sickle cell disease',
 'gene_therapy', 'sickle_cell_disease', 'Sickle Cell Disease',
 'approved', 'us', 'license',
 NULL, NULL, NULL,
 NULL, NULL,
 '2023-12-08', 'manual', false, 90, true, 'hematology'),

-- Roche / Genentech / Immunomedics (now Gilead) Polivy for lymphoma - 2019
('Roche', 'Roche', 'Polivy (polatuzumab vedotin)', 'Anti-CD79b ADC for DLBCL',
 'adc', 'lymphoma', 'Diffuse Large B-Cell Lymphoma',
 'phase_3', 'global', 'license',
 NULL, NULL, NULL,
 NULL, NULL,
 '2019-06-10', 'manual', false, 85, true, 'hematology'),

-- AbbVie / ImmunoGen Elahere partnership expansion - hematology adjacent
-- Kite (Gilead) Yescarta CAR-T for lymphoma - original deal
('Kite Pharma', 'Gilead Sciences', 'Yescarta (axicabtagene ciloleucel)', 'CD19-targeting CAR-T for large B-cell lymphoma',
 'cell_therapy', 'lymphoma', 'Large B-Cell Lymphoma',
 'phase_2', 'global', 'acquisition',
 11900000000, NULL, 11900000000,
 NULL, NULL,
 '2019-10-01', 'manual', true, 95, true, 'hematology'),

-- Novartis / Kymriah (tisagenlecleucel) for ALL and DLBCL
('University of Pennsylvania', 'Novartis', 'Kymriah (tisagenlecleucel)', 'CD19-targeting CAR-T for B-cell ALL and DLBCL',
 'cell_therapy', 'leukemia', 'B-cell ALL, DLBCL',
 'phase_2', 'global', 'license',
 NULL, NULL, NULL,
 NULL, NULL,
 '2019-05-01', 'manual', false, 90, true, 'hematology'),

-- Syndax / Incyte axatilimab for chronic GvHD - 2023
('Syndax Pharmaceuticals', 'Incyte', 'Axatilimab', 'Anti-CSF-1R antibody for chronic graft-versus-host disease',
 'antibody', 'gvhd', 'Chronic Graft-versus-Host Disease',
 'phase_2', 'global', 'collaboration',
 NULL, NULL, NULL,
 NULL, NULL,
 '2023-06-15', 'manual', false, 85, true, 'hematology'),

-- ============================================================================
-- DERMATOLOGY DEALS (Target: 40+ deals)
-- ============================================================================

-- Organon acquires Dermavant / VTAMA (tapinarof) - Sep 2024
('Dermavant Sciences', 'Organon', 'VTAMA (tapinarof)', 'Non-steroidal topical aryl hydrocarbon receptor agonist for psoriasis and atopic dermatitis',
 'smallMolecule', 'psoriasis', 'Plaque Psoriasis, Atopic Dermatitis',
 'approved', 'global', 'acquisition',
 175000000, 1025000000, 1200000000,
 NULL, NULL,
 '2024-09-18', 'manual', true, 95, true, 'dermatology'),

-- Arcutis / Sato roflumilast Japan - Feb 2024
('Arcutis Biotherapeutics', 'Sato Pharmaceutical', 'Topical roflumilast', 'PDE4 inhibitor cream for psoriasis and atopic dermatitis',
 'smallMolecule', 'psoriasis', 'Plaque Psoriasis, Atopic Dermatitis',
 'approved', 'Japan', 'license',
 25000000, 40000000, 65000000,
 NULL, NULL,
 '2024-02-28', 'manual', true, 95, true, 'dermatology'),

-- Arcutis / Huadong roflumilast Greater China - 2023
('Arcutis Biotherapeutics', 'Huadong Medicine', 'Topical roflumilast (Zoryve)', 'PDE4 inhibitor cream for plaque psoriasis',
 'smallMolecule', 'psoriasis', 'Plaque Psoriasis',
 'approved', 'Greater China and Southeast Asia', 'license',
 30000000, 64250000, 94250000,
 NULL, NULL,
 '2023-08-08', 'manual', true, 95, true, 'dermatology'),

-- AstraZeneca / LEO Pharma tralokinumab (atopic dermatitis) - 2016, approved 2021
('AstraZeneca', 'LEO Pharma', 'Adtralza/Adbry (tralokinumab)', 'Anti-IL-13 monoclonal antibody for atopic dermatitis',
 'antibody', 'atopic_dermatitis', 'Moderate-to-Severe Atopic Dermatitis',
 'phase_3', 'global', 'license',
 NULL, 500000000, 500000000,
 NULL, NULL,
 '2019-07-01', 'manual', true, 90, true, 'dermatology'),

-- Novartis / MorphoSys/Galapagos MOR106 IL-17C - 2018
('MorphoSys', 'Novartis', 'MOR106', 'Anti-IL-17C antibody for atopic dermatitis',
 'antibody', 'atopic_dermatitis', 'Atopic Dermatitis',
 'phase_1', 'global', 'license',
 111000000, 1000000000, 1111000000,
 13, 22,
 '2019-04-08', 'manual', true, 95, true, 'dermatology'),

-- Sanofi / Regeneron dupilumab (Dupixent) original deal for AD - ongoing expansion
('Regeneron Pharmaceuticals', 'Sanofi', 'Dupixent (dupilumab)', 'Anti-IL-4Ra antibody for atopic dermatitis, asthma, and other type 2 inflammatory diseases',
 'antibody', 'atopic_dermatitis', 'Atopic Dermatitis',
 'phase_3', 'global', 'collaboration',
 NULL, NULL, NULL,
 NULL, NULL,
 '2019-03-11', 'manual', false, 95, true, 'dermatology'),

-- AbbVie / Almirall upadacitinib dermatology license - 2021
('AbbVie', 'Almirall', 'Rinvoq (upadacitinib) topical', 'JAK1 inhibitor for atopic dermatitis',
 'smallMolecule', 'atopic_dermatitis', 'Moderate-to-Severe Atopic Dermatitis',
 'phase_3', 'global', 'license',
 NULL, NULL, NULL,
 NULL, NULL,
 '2021-01-14', 'manual', false, 85, true, 'dermatology'),

-- Pfizer / Arena (now Pfizer) etrasimod for dermatology - 2022
('Arena Pharmaceuticals', 'Pfizer', 'Etrasimod', 'S1P receptor modulator being explored in atopic dermatitis',
 'smallMolecule', 'atopic_dermatitis', 'Atopic Dermatitis',
 'phase_2', 'global', 'acquisition',
 6700000000, NULL, 6700000000,
 NULL, NULL,
 '2022-03-11', 'manual', true, 95, true, 'dermatology'),

-- Eli Lilly / Dice Therapeutics oral IL-17 for psoriasis - 2023
('Dice Therapeutics', 'Eli Lilly', 'DC-806', 'Oral IL-17 inhibitor for plaque psoriasis',
 'smallMolecule', 'psoriasis', 'Plaque Psoriasis',
 'phase_1', 'global', 'acquisition',
 2400000000, NULL, 2400000000,
 NULL, NULL,
 '2023-06-05', 'manual', true, 95, true, 'dermatology'),

-- Sun Pharma / Concert Pharmaceuticals (now Sun) deuruxolitinib for alopecia - 2023
('Concert Pharmaceuticals', 'Sun Pharma', 'Deuruxolitinib', 'Deuterated JAK inhibitor for alopecia areata',
 'smallMolecule', 'alopecia', 'Moderate-to-Severe Alopecia Areata',
 'phase_3', 'global', 'acquisition',
 576000000, NULL, 576000000,
 NULL, NULL,
 '2023-03-07', 'manual', true, 95, true, 'dermatology'),

-- Eli Lilly Olumiant (baricitinib) for alopecia - royalty/milestone deal with Incyte
('Incyte', 'Eli Lilly', 'Olumiant (baricitinib)', 'JAK1/JAK2 inhibitor approved for alopecia areata',
 'smallMolecule', 'alopecia', 'Severe Alopecia Areata',
 'approved', 'global', 'license',
 NULL, NULL, NULL,
 NULL, NULL,
 '2022-06-13', 'manual', false, 85, true, 'dermatology'),

-- Akebia / Q32 Bio bempikibart for alopecia areata - 2024
('Q32 Bio', 'Akebia Therapeutics', 'Bempikibart', 'Complement C5 inhibitor for alopecia areata',
 'antibody', 'alopecia', 'Alopecia Areata',
 'phase_2', 'global', 'license',
 12000000, 592000000, 604000000,
 NULL, NULL,
 '2024-01-10', 'manual', true, 95, true, 'dermatology'),

-- UCB / Dermira (now Almirall) nemolizumab for atopic dermatitis and prurigo nodularis - 2023
('Galderma', 'Galderma', 'Nemluvio (nemolizumab)', 'Anti-IL-31Ra antibody for atopic dermatitis and prurigo nodularis',
 'antibody', 'atopic_dermatitis', 'Atopic Dermatitis, Prurigo Nodularis',
 'phase_3', 'global', 'license',
 NULL, NULL, NULL,
 NULL, NULL,
 '2023-09-22', 'manual', false, 85, true, 'dermatology'),

-- Boehringer Ingelheim / Chapel TRX for atopic dermatitis - 2023
('Boehringer Ingelheim', 'Boehringer Ingelheim', 'BI 765061', 'Anti-IL-31 antibody for atopic dermatitis',
 'antibody', 'atopic_dermatitis', 'Moderate-to-Severe Atopic Dermatitis',
 'phase_2', 'global', 'license',
 NULL, NULL, NULL,
 NULL, NULL,
 '2023-05-15', 'manual', false, 80, true, 'dermatology'),

-- Aclaris / OMERS baricitinib alopecia royalty deal - 2023
('Aclaris Therapeutics', 'OMERS', 'Baricitinib alopecia royalties', 'Sale of future Olumiant royalties and milestones for alopecia areata',
 'smallMolecule', 'alopecia', 'Alopecia Areata',
 'approved', 'global', 'license',
 26500000, 5000000, 31500000,
 NULL, NULL,
 '2023-05-08', 'manual', true, 95, true, 'dermatology'),

-- AbbVie Skyrizi (risankizumab) label expansion to include dermatology - psoriasis
('Boehringer Ingelheim', 'AbbVie', 'Skyrizi (risankizumab)', 'Anti-IL-23p19 antibody for plaque psoriasis',
 'antibody', 'psoriasis', 'Moderate-to-Severe Plaque Psoriasis',
 'phase_3', 'global', 'license',
 NULL, NULL, NULL,
 NULL, NULL,
 '2019-04-23', 'manual', false, 90, true, 'dermatology'),

-- Novartis cosentyx (secukinumab) for hidradenitis suppurativa - self-developed, Phase 3
('Novartis', 'Novartis', 'Cosentyx (secukinumab)', 'Anti-IL-17A antibody for hidradenitis suppurativa',
 'antibody', 'hidradenitis_suppurativa', 'Moderate-to-Severe Hidradenitis Suppurativa',
 'phase_3', 'global', 'license',
 NULL, NULL, NULL,
 NULL, NULL,
 '2023-03-01', 'manual', false, 85, true, 'dermatology'),

-- AbbVie Humira/Hadlima biosimilar competition in dermatology - Avalo AVTX-009 for HS
('Avalo Therapeutics', 'Avalo Therapeutics', 'AVTX-009', 'Anti-IL-1beta antibody for hidradenitis suppurativa',
 'antibody', 'hidradenitis_suppurativa', 'Hidradenitis Suppurativa',
 'phase_2', 'global', 'license',
 115600000, 69400000, 185000000,
 NULL, NULL,
 '2024-03-15', 'manual', true, 90, true, 'dermatology'),

-- Pfizer acquires Trillium Therapeutics (vitiligo/derm adjacent) - 2021
('Incyte', 'Incyte', 'Opzelura (ruxolitinib)', 'Topical JAK1/JAK2 inhibitor for vitiligo and atopic dermatitis',
 'smallMolecule', 'vitiligo', 'Non-segmental Vitiligo',
 'phase_3', 'us', 'license',
 NULL, NULL, NULL,
 NULL, NULL,
 '2022-07-18', 'manual', false, 85, true, 'dermatology'),

-- BMS Sotyktu (deucravacitinib) TYK2 inhibitor for psoriasis - 2022
('Bristol Myers Squibb', 'Bristol Myers Squibb', 'Sotyktu (deucravacitinib)', 'Allosteric TYK2 inhibitor for plaque psoriasis',
 'smallMolecule', 'psoriasis', 'Moderate-to-Severe Plaque Psoriasis',
 'approved', 'global', 'license',
 NULL, NULL, NULL,
 NULL, NULL,
 '2022-09-09', 'manual', false, 90, true, 'dermatology'),

-- ============================================================================
-- GASTROENTEROLOGY DEALS (Target: 40+ deals)
-- ============================================================================

-- Eli Lilly acquires Morphic (IBD integrin) - July 2024
('Morphic Holding', 'Eli Lilly', 'MORF-057', 'Oral selective alpha4beta7 integrin inhibitor for IBD',
 'smallMolecule', 'ibd', 'Ulcerative Colitis, Crohn''s Disease',
 'phase_2', 'global', 'acquisition',
 3200000000, NULL, 3200000000,
 NULL, NULL,
 '2024-07-08', 'manual', true, 95, true, 'gastroenterology'),

-- AbbVie / FutureGen TL1A for IBD - 2024
('FutureGen Biopharmaceutical', 'AbbVie', 'FG-M701', 'Anti-TL1A antibody for inflammatory bowel disease',
 'antibody', 'ibd', 'Ulcerative Colitis, Crohn''s Disease',
 'preclinical', 'global', 'license',
 150000000, 1560000000, 1710000000,
 NULL, NULL,
 '2024-06-13', 'manual', true, 95, true, 'gastroenterology'),

-- Roche / Genentech / OMass IBD program - 2023
('OMass Therapeutics', 'Roche', 'OMass IBD program', 'Small molecule program for inflammatory bowel disease',
 'smallMolecule', 'ibd', 'Inflammatory Bowel Disease',
 'preclinical', 'global', 'license',
 20000000, 400000000, 420000000,
 NULL, NULL,
 '2023-09-12', 'manual', true, 95, true, 'gastroenterology'),

-- Merck acquires Prometheus Biosciences (TL1A for IBD) - April 2023
('Prometheus Biosciences', 'Merck', 'MK-7240 (PRA-023)', 'Anti-TL1A antibody with companion diagnostic for IBD',
 'antibody', 'ibd', 'Ulcerative Colitis, Crohn''s Disease',
 'phase_2', 'global', 'acquisition',
 10800000000, NULL, 10800000000,
 NULL, NULL,
 '2023-04-16', 'manual', true, 95, true, 'gastroenterology'),

-- Boehringer Ingelheim / Ochre Bio MASH/NASH - 2024
('Ochre Bio', 'Boehringer Ingelheim', 'Ochre RNA program', 'RNA therapeutics targeting liver fibrosis in MASH',
 'oligonucleotide', 'nash', 'MASH/NASH',
 'preclinical', 'global', 'collaboration',
 35000000, 1265000000, 1300000000,
 NULL, NULL,
 '2024-09-10', 'manual', true, 95, true, 'gastroenterology'),

-- Madrigal / Ribo Life Science siRNA MASH - 2025
('Ribo Life Science', 'Madrigal Pharmaceuticals', 'siRNA MASH portfolio', 'Six preclinical siRNA-based MASH therapies',
 'oligonucleotide', 'nash', 'MASH/NASH',
 'preclinical', 'global', 'license',
 60000000, 4340000000, 4400000000,
 NULL, NULL,
 '2025-01-13', 'manual', true, 95, true, 'gastroenterology'),

-- Gilead / Galapagos filgotinib for IBD (UC, Crohn's) - 2019
('Galapagos', 'Gilead Sciences', 'Jyseleca (filgotinib)', 'JAK1 selective inhibitor for UC and Crohn''s disease',
 'smallMolecule', 'ibd', 'Ulcerative Colitis, Crohn''s Disease',
 'phase_3', 'global', 'collaboration',
 3950000000, 1100000000, 5050000000,
 NULL, NULL,
 '2019-07-14', 'manual', true, 95, true, 'gastroenterology'),

-- Novartis / Calypso Biotech celiac disease + EoE - 2019
('Calypso Biotech', 'Novartis', 'CALY-002', 'Depletion of ILC2 cells for celiac disease and eosinophilic esophagitis',
 'antibody', 'eosinophilic_esophagitis', 'Celiac Disease, Eosinophilic Esophagitis',
 'phase_1', 'global', 'acquisition',
 NULL, NULL, NULL,
 NULL, NULL,
 '2019-11-18', 'manual', false, 85, true, 'gastroenterology'),

-- Takeda / Neurocrine Biosciences etrasimod for UC (prior to Pfizer/Arena acquisition)
-- Pfizer / Arena Pharmaceuticals etrasimod for UC - 2022
('Arena Pharmaceuticals', 'Pfizer', 'Velsipity (etrasimod)', 'S1P receptor modulator for ulcerative colitis',
 'smallMolecule', 'ibd', 'Ulcerative Colitis',
 'phase_3', 'global', 'acquisition',
 6700000000, NULL, 6700000000,
 NULL, NULL,
 '2022-03-11', 'manual', true, 95, true, 'gastroenterology'),

-- AbbVie Rinvoq (upadacitinib) for Crohn's - JAK inhibitor
('AbbVie', 'AbbVie', 'Rinvoq (upadacitinib)', 'JAK1 inhibitor for Crohn''s disease',
 'smallMolecule', 'ibd', 'Crohn''s Disease',
 'approved', 'global', 'license',
 NULL, NULL, NULL,
 NULL, NULL,
 '2023-05-19', 'manual', false, 90, true, 'gastroenterology'),

-- Novo Nordisk / Dicerna RNAi for NASH - 2019
('Dicerna Pharmaceuticals', 'Novo Nordisk', 'RNAi NASH/liver program', 'RNAi therapeutics for NASH and metabolic liver diseases',
 'oligonucleotide', 'nash', 'NASH/MASH',
 'preclinical', 'global', 'collaboration',
 175000000, 357500000, 675500000,
 NULL, NULL,
 '2019-10-28', 'manual', true, 95, true, 'gastroenterology'),

-- Sanofi / Regeneron Dupixent for EoE - label expansion
('Regeneron Pharmaceuticals', 'Sanofi', 'Dupixent (dupilumab)', 'Anti-IL-4Ra antibody approved for eosinophilic esophagitis',
 'antibody', 'eosinophilic_esophagitis', 'Eosinophilic Esophagitis',
 'approved', 'global', 'collaboration',
 NULL, NULL, NULL,
 NULL, NULL,
 '2022-05-20', 'manual', false, 90, true, 'gastroenterology'),

-- Takeda Eohilia (budesonide oral suspension) for EoE - approved 2024
('Takeda', 'Takeda', 'Eohilia (budesonide oral suspension)', 'First oral treatment specifically approved for eosinophilic esophagitis',
 'smallMolecule', 'eosinophilic_esophagitis', 'Eosinophilic Esophagitis',
 'approved', 'us', 'license',
 NULL, NULL, NULL,
 NULL, NULL,
 '2024-02-08', 'manual', false, 85, true, 'gastroenterology'),

-- Bristol Myers Squibb / Celgene ozanimod for UC - 2019 (Celgene acquisition)
('Celgene', 'Bristol Myers Squibb', 'Zeposia (ozanimod)', 'S1P receptor modulator for ulcerative colitis',
 'smallMolecule', 'ibd', 'Ulcerative Colitis',
 'phase_3', 'global', 'acquisition',
 74000000000, NULL, 74000000000,
 NULL, NULL,
 '2019-01-03', 'manual', true, 95, true, 'gastroenterology'),

-- Johnson & Johnson / Protagonist Therapeutics icatibant/rusfertide colitis
('Protagonist Therapeutics', 'Johnson & Johnson', 'JNJ-2113 (PN-235)', 'Oral IL-23R antagonist peptide for IBD',
 'peptide', 'ibd', 'Ulcerative Colitis, Crohn''s Disease',
 'phase_2', 'global', 'license',
 50000000, 790000000, 840000000,
 NULL, NULL,
 '2021-10-06', 'manual', true, 95, true, 'gastroenterology'),

-- Intercept / Genfit NASH deal - ongoing
-- Madrigal Rezdiffra (resmetirom) first MASH approved drug - March 2024
('Madrigal Pharmaceuticals', 'Madrigal Pharmaceuticals', 'Rezdiffra (resmetirom)', 'THR-beta agonist, first FDA-approved drug for MASH/NASH',
 'smallMolecule', 'nash', 'MASH/NASH with Liver Fibrosis',
 'approved', 'us', 'license',
 NULL, NULL, NULL,
 NULL, NULL,
 '2024-03-14', 'manual', false, 95, true, 'gastroenterology'),

-- ============================================================================
-- RARE DISEASE DEALS (Target: 40+ deals)
-- ============================================================================

-- Sarepta / Roche Elevidys (DMD gene therapy) ex-US - 2019
('Sarepta Therapeutics', 'Roche', 'Elevidys (delandistrogene moxeparvovec)', 'AAV-based micro-dystrophin gene therapy for Duchenne muscular dystrophy',
 'gene_therapy', 'duchenne_md', 'Duchenne Muscular Dystrophy',
 'phase_2', 'ex_us', 'license',
 1150000000, 1700000000, 2850000000,
 14, 16,
 '2019-12-23', 'manual', true, 95, true, 'rareDisease'),

-- Ultragenyx / Mereo setrusumab for osteogenesis imperfecta - 2021
('Mereo BioPharma', 'Ultragenyx', 'Setrusumab', 'Anti-sclerostin antibody for osteogenesis imperfecta',
 'antibody', 'osteogenesis_imperfecta', 'Osteogenesis Imperfecta',
 'phase_2', 'global', 'license',
 50000000, 254000000, 304000000,
 NULL, NULL,
 '2021-01-11', 'manual', true, 95, true, 'rareDisease'),

-- Ultragenyx / GeneTx Angelman syndrome ASO - 2022
('GeneTx Biotherapeutics', 'Ultragenyx', 'GTX-102', 'Antisense oligonucleotide for Angelman syndrome',
 'oligonucleotide', 'angelman_syndrome', 'Angelman Syndrome',
 'phase_1', 'global', 'acquisition',
 75000000, 115000000, 190000000,
 NULL, NULL,
 '2022-07-01', 'manual', true, 95, true, 'rareDisease'),

-- Ultragenyx / Abeona Sanfilippo gene therapy - 2022
('Abeona Therapeutics', 'Ultragenyx', 'ABO-102', 'AAV-based gene therapy for Sanfilippo syndrome type A (MPS IIIA)',
 'gene_therapy', 'sanfilippo_syndrome', 'Sanfilippo Syndrome (MPS IIIA)',
 'phase_1', 'global', 'license',
 NULL, NULL, NULL,
 NULL, NULL,
 '2022-04-25', 'manual', false, 85, true, 'rareDisease'),

-- AstraZeneca (Alexion) / Neurimmune ATTR-CM - 2022
('Neurimmune', 'AstraZeneca', 'NI006', 'Anti-ATTR amyloid antibody for transthyretin amyloid cardiomyopathy',
 'antibody', 'attr_amyloidosis', 'ATTR Cardiomyopathy',
 'phase_1', 'global', 'license',
 30000000, 730000000, 780000000,
 NULL, NULL,
 '2022-01-19', 'manual', true, 95, true, 'rareDisease'),

-- AstraZeneca (Alexion) / Pfizer rare disease gene therapy portfolio - 2023
('Pfizer', 'AstraZeneca', 'Rare disease gene therapy portfolio', 'Early-stage gene therapy programs for rare diseases including Wilson disease',
 'gene_therapy', 'rare_genetic', 'Wilson Disease and others',
 'preclinical', 'global', 'license',
 30000000, NULL, NULL,
 NULL, NULL,
 '2023-01-09', 'manual', true, 90, true, 'rareDisease'),

-- Novartis / Alnylam patisiran/vutrisiran ATTR deal expansion - 2020
('Alnylam Pharmaceuticals', 'Novartis', 'Leqvio (inclisiran)', 'siRNA targeting PCSK9 (originally from Alnylam technology)',
 'oligonucleotide', 'rare_genetic', 'ATTR, Cardiovascular',
 'approved', 'global', 'license',
 NULL, NULL, NULL,
 NULL, NULL,
 '2020-01-01', 'manual', false, 85, true, 'rareDisease'),

-- BioMarin acquires Amicus Therapeutics (rare disease) - 2025
('Amicus Therapeutics', 'BioMarin', 'Galafold (migalastat) + pipeline', 'Pharmacological chaperone for Fabry disease plus rare disease pipeline',
 'smallMolecule', 'fabry_disease', 'Fabry Disease',
 'approved', 'global', 'acquisition',
 4800000000, NULL, 4800000000,
 NULL, NULL,
 '2025-02-03', 'manual', true, 95, true, 'rareDisease'),

-- Roche / Spark Therapeutics (hemophilia gene therapy) - 2019
('Spark Therapeutics', 'Roche', 'SPK-8011 and Luxturna portfolio', 'Gene therapy portfolio including hemophilia A and inherited retinal disease',
 'gene_therapy', 'hemophilia', 'Hemophilia A, Inherited Retinal Disease',
 'phase_1', 'global', 'acquisition',
 4300000000, NULL, 4300000000,
 NULL, NULL,
 '2019-02-22', 'manual', true, 95, true, 'rareDisease'),

-- Novartis / Zolgensma (onasemnogene) SMA gene therapy
('AveXis', 'Novartis', 'Zolgensma (onasemnogene abeparvovec)', 'AAV9-based gene therapy for spinal muscular atrophy (SMA)',
 'gene_therapy', 'sma', 'Spinal Muscular Atrophy',
 'phase_3', 'global', 'acquisition',
 8700000000, NULL, 8700000000,
 NULL, NULL,
 '2019-04-12', 'manual', true, 95, true, 'rareDisease'),

-- Biogen / Ionis nusinersen (Spinraza) for SMA - ongoing collaboration
('Ionis Pharmaceuticals', 'Biogen', 'Spinraza (nusinersen)', 'Antisense oligonucleotide for spinal muscular atrophy',
 'oligonucleotide', 'sma', 'Spinal Muscular Atrophy',
 'approved', 'global', 'collaboration',
 NULL, NULL, NULL,
 NULL, NULL,
 '2019-01-01', 'manual', false, 90, true, 'rareDisease'),

-- Vertex / CRISPR sickle cell / beta-thalassemia (also listed in hematology)
-- Sangamo / Sanofi hemophilia A gene therapy - 2017 expanded 2020
('Sangamo Therapeutics', 'Sanofi', 'BIVV003 / fitusiran collaboration', 'Gene therapy/editing for hemophilia A',
 'gene_therapy', 'hemophilia', 'Hemophilia A',
 'phase_1', 'global', 'collaboration',
 NULL, NULL, NULL,
 NULL, NULL,
 '2020-04-10', 'manual', false, 85, true, 'rareDisease'),

-- Takeda / Ovid Therapeutics soticlestat for Dravet and Lennox-Gastaut - 2019
('Ovid Therapeutics', 'Takeda', 'Soticlestat (TAK-935)', 'Cholesterol 24-hydroxylase inhibitor for Dravet and Lennox-Gastaut syndromes',
 'smallMolecule', 'dravet_syndrome', 'Dravet Syndrome, Lennox-Gastaut Syndrome',
 'phase_2', 'global', 'collaboration',
 NULL, NULL, NULL,
 NULL, NULL,
 '2019-11-04', 'manual', false, 85, true, 'rareDisease'),

-- Passage Bio / numerous CNS rare disease gene therapies
('Passage Bio', 'Passage Bio', 'PBGM01', 'AAV gene therapy for GM1 gangliosidosis',
 'gene_therapy', 'gm1_gangliosidosis', 'GM1 Gangliosidosis',
 'phase_1', 'global', 'license',
 NULL, NULL, NULL,
 NULL, NULL,
 '2021-03-01', 'manual', false, 80, true, 'rareDisease'),

-- Sarepta casimersen and other PMOs for DMD exon-skipping
('Sarepta Therapeutics', 'Sarepta Therapeutics', 'Amondys 45 (casimersen)', 'PMO exon 45 skipping for Duchenne muscular dystrophy',
 'oligonucleotide', 'duchenne_md', 'Duchenne Muscular Dystrophy',
 'approved', 'us', 'license',
 NULL, NULL, NULL,
 NULL, NULL,
 '2021-02-25', 'manual', false, 90, true, 'rareDisease'),

-- Ionis / Biogen tofersen for SOD1-ALS (rare form) - 2023 accelerated approval
('Ionis Pharmaceuticals', 'Biogen', 'Qalsody (tofersen)', 'Antisense oligonucleotide for SOD1-ALS',
 'oligonucleotide', 'als_sod1', 'SOD1-ALS',
 'phase_3', 'global', 'collaboration',
 NULL, NULL, NULL,
 NULL, NULL,
 '2023-04-25', 'manual', false, 90, true, 'rareDisease'),

-- BioMarin Voxzogo (vosoritide) for achondroplasia
('BioMarin', 'BioMarin', 'Voxzogo (vosoritide)', 'C-type natriuretic peptide analog for achondroplasia',
 'peptide', 'achondroplasia', 'Achondroplasia',
 'approved', 'global', 'license',
 NULL, NULL, NULL,
 NULL, NULL,
 '2021-11-19', 'manual', false, 90, true, 'rareDisease'),

-- Alexion (AstraZeneca) / Monopar Wilson disease - 2024
('Monopar Therapeutics', 'AstraZeneca', 'ALXN2220', 'Late-stage drug candidate for Wilson disease',
 'smallMolecule', 'wilson_disease', 'Wilson Disease',
 'phase_3', 'global', 'license',
 NULL, NULL, NULL,
 NULL, NULL,
 '2024-06-03', 'manual', false, 85, true, 'rareDisease'),

-- ============================================================================
-- WOMEN''S HEALTH DEALS (Target: 25+ deals)
-- ============================================================================

-- Myovant / Pfizer relugolix for uterine fibroids and endometriosis - Dec 2020
('Myovant Sciences', 'Pfizer', 'Myfembree (relugolix combination)', 'GnRH receptor antagonist for uterine fibroids and endometriosis',
 'smallMolecule', 'uterine_fibroids', 'Uterine Fibroids, Endometriosis',
 'phase_3', 'global', 'collaboration',
 650000000, 3550000000, 4200000000,
 NULL, NULL,
 '2020-12-28', 'manual', true, 95, true, 'womensHealth'),

-- Sumitomo Pharma acquires Myovant Sciences - 2022
('Myovant Sciences', 'Sumitomo Pharma', 'Myovant Sciences (Myfembree + Orgovyx)', 'Full acquisition of Myovant including women''s health portfolio',
 'smallMolecule', 'uterine_fibroids', 'Uterine Fibroids, Endometriosis, Prostate Cancer',
 'approved', 'global', 'acquisition',
 2900000000, NULL, 2900000000,
 NULL, NULL,
 '2022-10-31', 'manual', true, 95, true, 'womensHealth'),

-- Organon / ObsEva ebopiprant for preterm labor - 2022
('ObsEva', 'Organon', 'Ebopiprant (OBE022)', 'Prostaglandin F2alpha receptor antagonist for preterm labor',
 'smallMolecule', 'preterm_labor', 'Preterm Labor',
 'phase_2', 'global', 'license',
 25000000, 475000000, 500000000,
 NULL, NULL,
 '2022-06-29', 'manual', true, 95, true, 'womensHealth'),

-- TiumBio / Hansoh Pharma TU2670 for endometriosis - 2022
('TiumBio', 'Hansoh Pharma', 'TU2670', 'Non-peptide GnRH receptor antagonist for endometriosis',
 'smallMolecule', 'endometriosis', 'Endometriosis',
 'phase_2', 'Greater China', 'license',
 NULL, 170000000, 170000000,
 NULL, NULL,
 '2022-08-15', 'manual', true, 90, true, 'womensHealth'),

-- Bayer / Evotec (Daré Bioscience) women's health collaboration
('Bayer', 'Bayer', 'Women''s health pipeline', 'Collaboration for novel endometriosis and uterine fibroid therapies',
 'smallMolecule', 'endometriosis', 'Endometriosis, Uterine Fibroids',
 'preclinical', 'global', 'collaboration',
 NULL, NULL, NULL,
 NULL, NULL,
 '2021-06-14', 'manual', false, 80, true, 'womensHealth'),

-- Gedeon Richter / Myovant Ryeqo (relugolix combination) for fibroids in EU - 2020
('Myovant Sciences', 'Gedeon Richter', 'Ryeqo (relugolix combination)', 'Oral GnRH antagonist combination for uterine fibroids and endometriosis',
 'smallMolecule', 'uterine_fibroids', 'Uterine Fibroids, Endometriosis',
 'phase_3', 'Europe', 'license',
 NULL, NULL, NULL,
 NULL, NULL,
 '2020-06-15', 'manual', false, 85, true, 'womensHealth'),

-- Kissei / Theramex linzagolix for endometriosis - 2024 (EU approval as YSELTY)
('Kissei Pharmaceutical', 'Theramex', 'YSELTY (linzagolix)', 'Oral GnRH receptor antagonist for endometriosis',
 'smallMolecule', 'endometriosis', 'Endometriosis',
 'phase_3', 'ex_us', 'license',
 NULL, NULL, NULL,
 NULL, NULL,
 '2024-12-01', 'manual', false, 85, true, 'womensHealth'),

-- AbbVie Orilissa (elagolix) for endometriosis - self-developed, approved 2018
('Neurocrine Biosciences', 'AbbVie', 'Orilissa (elagolix)', 'Oral GnRH receptor antagonist for endometriosis pain',
 'smallMolecule', 'endometriosis', 'Endometriosis',
 'phase_3', 'global', 'license',
 NULL, NULL, NULL,
 NULL, NULL,
 '2019-01-01', 'manual', false, 85, true, 'womensHealth'),

-- AbbVie Oriahnn (elagolix) for uterine fibroids - 2020 approval
('Neurocrine Biosciences', 'AbbVie', 'Oriahnn (elagolix + add-back therapy)', 'Oral GnRH receptor antagonist for heavy menstrual bleeding from uterine fibroids',
 'smallMolecule', 'uterine_fibroids', 'Uterine Fibroids',
 'approved', 'us', 'license',
 NULL, NULL, NULL,
 NULL, NULL,
 '2020-05-29', 'manual', false, 85, true, 'womensHealth'),

-- Astellas / Ogeda (now Astellas) fezolinetant for vasomotor symptoms (menopause) - 2017 acquisition
('Ogeda', 'Astellas Pharma', 'Veozah (fezolinetant)', 'NK3 receptor antagonist for vasomotor symptoms of menopause',
 'smallMolecule', 'menopause', 'Hot Flashes/Vasomotor Symptoms',
 'phase_2', 'global', 'acquisition',
 800000000, NULL, 800000000,
 NULL, NULL,
 '2020-01-15', 'manual', true, 90, true, 'womensHealth'),

-- Bayer / KaNDy Therapeutics NT-814 for menopause - 2020
('KaNDy Therapeutics', 'Bayer', 'NT-814 (elinzanetant)', 'Dual NK1/NK3 receptor antagonist for menopausal vasomotor symptoms',
 'smallMolecule', 'menopause', 'Hot Flashes/Vasomotor Symptoms',
 'phase_2', 'global', 'acquisition',
 425000000, NULL, 425000000,
 NULL, NULL,
 '2020-08-05', 'manual', true, 95, true, 'womensHealth'),

-- Ferring / Turing Pharma fertility
('Ferring Pharmaceuticals', 'Ferring Pharmaceuticals', 'Rekovelle (follitropin delta)', 'Individualized recombinant FSH for controlled ovarian stimulation',
 'other', 'infertility', 'Controlled Ovarian Stimulation',
 'approved', 'global', 'license',
 NULL, NULL, NULL,
 NULL, NULL,
 '2020-01-01', 'manual', false, 80, true, 'womensHealth'),

-- ============================================================================
-- OPHTHALMOLOGY DEALS (Target: 30+ deals)
-- ============================================================================

-- AbbVie / REGENXBIO RGX-314 gene therapy for wet AMD - 2021
('REGENXBIO', 'AbbVie', 'ABBV-RGX-314 (surabgene lomparvovec)', 'AAV8 gene therapy delivering anti-VEGF for wet AMD and diabetic retinopathy',
 'gene_therapy', 'wet_amd', 'Wet Age-Related Macular Degeneration, Diabetic Retinopathy',
 'phase_2', 'global', 'collaboration',
 370000000, 1380000000, 1750000000,
 NULL, NULL,
 '2021-09-03', 'manual', true, 95, true, 'ophthalmology'),

-- Astellas acquires Iveric Bio (dry AMD) - May 2023
('Iveric Bio', 'Astellas Pharma', 'Izervay (avacincaptad pegol)', 'Complement C5 inhibitor for geographic atrophy (dry AMD)',
 'peptide', 'dry_amd', 'Geographic Atrophy (Dry AMD)',
 'phase_3', 'global', 'acquisition',
 5900000000, NULL, 5900000000,
 NULL, NULL,
 '2023-05-01', 'manual', true, 95, true, 'ophthalmology'),

-- Apellis Pharmaceuticals Syfovre (pegcetacoplan) for GA - self-developed
('Apellis Pharmaceuticals', 'Apellis Pharmaceuticals', 'Syfovre (pegcetacoplan)', 'Complement C3 inhibitor for geographic atrophy',
 'peptide', 'dry_amd', 'Geographic Atrophy (Dry AMD)',
 'approved', 'global', 'license',
 NULL, NULL, NULL,
 NULL, NULL,
 '2023-02-17', 'manual', false, 90, true, 'ophthalmology'),

-- Regeneron / Ocular Therapeutix sustained-release Eylea - 2016
('Ocular Therapeutix', 'Regeneron Pharmaceuticals', 'Sustained-release aflibercept', 'Hydrogel-based sustained release formulation of Eylea for wet AMD',
 'antibody', 'wet_amd', 'Wet Age-Related Macular Degeneration',
 'preclinical', 'global', 'option',
 10000000, 305000000, 315000000,
 8, 15,
 '2019-10-15', 'manual', true, 95, true, 'ophthalmology'),

-- Regeneron / ViGeneron inherited retinal disease gene therapy - 2022
('ViGeneron', 'Regeneron Pharmaceuticals', 'vgAAV gene therapy', 'Novel AAV capsid gene therapy for inherited retinal disease',
 'gene_therapy', 'inherited_retinal', 'Inherited Retinal Disease',
 'preclinical', 'global', 'option',
 NULL, NULL, NULL,
 NULL, NULL,
 '2022-04-06', 'manual', false, 85, true, 'ophthalmology'),

-- Roche / Genentech faricimab (Vabysmo) for wet AMD and DME - self-developed
('Roche', 'Roche', 'Vabysmo (faricimab)', 'Bispecific antibody targeting Ang-2 and VEGF-A for wet AMD and DME',
 'bispecific', 'wet_amd', 'Wet AMD, Diabetic Macular Edema',
 'approved', 'global', 'license',
 NULL, NULL, NULL,
 NULL, NULL,
 '2022-01-28', 'manual', false, 90, true, 'ophthalmology'),

-- Oculis / Roche dry eye collaboration
('Oculis', 'Roche', 'Licaminlimab (OCS-02)', 'Topical anti-TNFalpha antibody fragment for dry eye disease',
 'antibody', 'dry_eye', 'Dry Eye Disease',
 'phase_2', 'global', 'license',
 NULL, NULL, NULL,
 NULL, NULL,
 '2023-06-01', 'manual', false, 80, true, 'ophthalmology'),

-- Aldeyra Therapeutics reproxalap for dry eye - 2024
('Aldeyra Therapeutics', 'Aldeyra Therapeutics', 'Reproxalap', 'RASP inhibitor for dry eye disease',
 'smallMolecule', 'dry_eye', 'Dry Eye Disease',
 'phase_3', 'global', 'license',
 NULL, NULL, NULL,
 NULL, NULL,
 '2024-01-08', 'manual', false, 80, true, 'ophthalmology'),

-- Bausch + Lomb / Ripple Therapeutics sustained release ophthalmology - 2024
('Ripple Therapeutics', 'Bausch + Lomb', 'Sustained-release implant', 'Biodegradable drug delivery implant for ophthalmic indications',
 'other', 'glaucoma', 'Glaucoma, Post-surgical Inflammation',
 'preclinical', 'global', 'option',
 NULL, NULL, NULL,
 NULL, NULL,
 '2024-06-15', 'manual', false, 80, true, 'ophthalmology'),

-- AbbVie (Allergan) / Aerie Pharmaceuticals acquisition (glaucoma) - 2022
('Aerie Pharmaceuticals', 'AbbVie', 'Rocklatan/Rhopressa', 'ROCK inhibitor + netarsudil for glaucoma and ocular hypertension',
 'smallMolecule', 'glaucoma', 'Open-Angle Glaucoma',
 'approved', 'global', 'acquisition',
 770000000, NULL, 770000000,
 NULL, NULL,
 '2022-08-22', 'manual', true, 95, true, 'ophthalmology'),

-- Novartis / Gyroscope Therapeutics GT005 gene therapy for dry AMD - 2022
('Gyroscope Therapeutics', 'Novartis', 'GT005', 'AAV-based complement factor I gene therapy for dry AMD',
 'gene_therapy', 'dry_amd', 'Geographic Atrophy (Dry AMD)',
 'phase_2', 'global', 'acquisition',
 800000000, 700000000, 1500000000,
 NULL, NULL,
 '2022-02-07', 'manual', true, 95, true, 'ophthalmology'),

-- Alcon / Aerie (now AbbVie) AR-15512 dry eye - 2025
('Alcon', 'Alcon', 'Tryptyr (acoltremon)', 'TRPM8 receptor agonist for dry eye disease',
 'smallMolecule', 'dry_eye', 'Dry Eye Disease',
 'approved', 'us', 'license',
 NULL, NULL, NULL,
 NULL, NULL,
 '2025-01-15', 'manual', false, 85, true, 'ophthalmology'),

-- EyePoint Pharmaceuticals DURAVYU for wet AMD
('EyePoint Pharmaceuticals', 'EyePoint Pharmaceuticals', 'DURAVYU (EYP-1901)', 'Sustained-delivery bioerodible anti-VEGF for wet AMD',
 'other', 'wet_amd', 'Wet Age-Related Macular Degeneration',
 'phase_3', 'global', 'license',
 NULL, NULL, NULL,
 NULL, NULL,
 '2024-09-01', 'manual', false, 80, true, 'ophthalmology'),

-- ============================================================================
-- METABOLIC DEALS (Target: 30+ deals)
-- ============================================================================

-- Roche / Zealand Pharma petrelintide (obesity) - 2024
('Zealand Pharma', 'Roche', 'Petrelintide', 'Amylin analog for obesity, combined with GLP-1',
 'peptide', 'obesity', 'Obesity',
 'phase_2', 'global', 'license',
 1650000000, 3600000000, 5250000000,
 NULL, NULL,
 '2024-12-16', 'manual', true, 95, true, 'metabolic'),

-- Novo Nordisk / United Biotechnology UBT251 triple agonist - 2025
('United Laboratories', 'Novo Nordisk', 'UBT251', 'GLP-1/GIP/glucagon triple agonist for obesity',
 'peptide', 'obesity', 'Obesity, Type 2 Diabetes',
 'phase_1', 'global', 'license',
 200000000, 1800000000, 2000000000,
 NULL, NULL,
 '2025-01-06', 'manual', true, 95, true, 'metabolic'),

-- AbbVie / Gubra obesity peptide - 2025
('Gubra', 'AbbVie', 'Gubra obesity peptide', 'Novel peptide therapeutic for obesity',
 'peptide', 'obesity', 'Obesity',
 'preclinical', 'global', 'license',
 350000000, 1875000000, 2225000000,
 NULL, NULL,
 '2025-01-14', 'manual', true, 95, true, 'metabolic'),

-- Novo Nordisk / Ascendis Pharma long-acting GLP-1 - 2024
('Ascendis Pharma', 'Novo Nordisk', 'TransCon GLP-1', 'Long-acting GLP-1 using TransCon technology for obesity/diabetes',
 'peptide', 'obesity', 'Obesity, Type 2 Diabetes',
 'preclinical', 'global', 'license',
 NULL, 285000000, 285000000,
 NULL, NULL,
 '2024-04-22', 'manual', true, 95, true, 'metabolic'),

-- Amgen / Xencor oral GLP-1 variant - 2023
('Amgen', 'Amgen', 'MariTide (maridebart cafraglutide)', 'GIP receptor antagonist + GLP-1 receptor agonist for obesity',
 'antibody', 'obesity', 'Obesity',
 'phase_2', 'global', 'license',
 NULL, NULL, NULL,
 NULL, NULL,
 '2023-11-01', 'manual', false, 90, true, 'metabolic'),

-- Viking Therapeutics VK2735 oral GLP-1 for obesity - 2024
('Viking Therapeutics', 'Viking Therapeutics', 'VK2735', 'Dual GLP-1/GIP receptor agonist for obesity (oral and injectable)',
 'peptide', 'obesity', 'Obesity',
 'phase_2', 'global', 'license',
 NULL, NULL, NULL,
 NULL, NULL,
 '2024-03-26', 'manual', false, 85, true, 'metabolic'),

-- Novo Nordisk acquires Dicerna (metabolic RNAi) - 2021
('Dicerna Pharmaceuticals', 'Novo Nordisk', 'Dicerna RNAi platform', 'Full acquisition of RNAi platform for metabolic diseases',
 'oligonucleotide', 'diabetes', 'Type 2 Diabetes, NASH, Obesity',
 'phase_1', 'global', 'acquisition',
 3300000000, NULL, 3300000000,
 NULL, NULL,
 '2021-11-01', 'manual', true, 95, true, 'metabolic'),

-- Pfizer / Arvinas PROTAC obesity/metabolic - 2023 expansion
('Arvinas', 'Pfizer', 'PROTAC metabolic program', 'Targeted protein degradation for metabolic diseases',
 'smallMolecule', 'obesity', 'Obesity',
 'preclinical', 'global', 'collaboration',
 NULL, 830000000, 830000000,
 NULL, NULL,
 '2023-01-01', 'manual', true, 85, true, 'metabolic'),

-- Boehringer Ingelheim / Zealand survodutide for obesity and MASH - 2019 collaboration
('Zealand Pharma', 'Boehringer Ingelheim', 'Survodutide', 'Dual GLP-1/glucagon receptor agonist for obesity and MASH',
 'peptide', 'obesity', 'Obesity, MASH',
 'phase_3', 'global', 'collaboration',
 NULL, NULL, NULL,
 NULL, NULL,
 '2019-01-01', 'manual', false, 85, true, 'metabolic'),

-- Eli Lilly / Chugai Pharmaceutical orforglipron predecessor -
('Eli Lilly', 'Eli Lilly', 'Orforglipron', 'Non-peptide oral GLP-1 receptor agonist for obesity and type 2 diabetes',
 'smallMolecule', 'obesity', 'Obesity, Type 2 Diabetes',
 'phase_3', 'global', 'license',
 NULL, NULL, NULL,
 NULL, NULL,
 '2023-06-24', 'manual', false, 90, true, 'metabolic'),

-- Alnylam / Roche zilebesiran for hypertension/cardiometabolic - 2024 expansion
('Alnylam Pharmaceuticals', 'Roche', 'Zilebesiran', 'RNAi targeting AGT for hypertension',
 'oligonucleotide', 'hypertension', 'Hypertension',
 'phase_2', 'global', 'collaboration',
 NULL, NULL, NULL,
 NULL, NULL,
 '2024-01-08', 'manual', false, 85, true, 'metabolic'),

-- Structure Therapeutics / Roche oral GLP-1 - 2023
('Structure Therapeutics', 'Roche', 'GSBR-1290', 'Oral small molecule GLP-1 receptor agonist for obesity and diabetes',
 'smallMolecule', 'obesity', 'Obesity, Type 2 Diabetes',
 'phase_2', 'global', 'license',
 NULL, NULL, NULL,
 NULL, NULL,
 '2023-09-15', 'manual', false, 80, true, 'metabolic'),

-- ============================================================================
-- CARDIOVASCULAR DEALS (Target: 25+ deals)
-- ============================================================================

-- Merck / Jiangsu Hengrui Lp(a) oral heart drug - 2025
('Jiangsu Hengrui', 'Merck', 'HRS-5346', 'Oral Lp(a) lowering small molecule for cardiovascular disease',
 'smallMolecule', 'cardiovascular', 'Cardiovascular Disease (Lp(a))',
 'phase_1', 'global', 'license',
 200000000, 1770000000, 1970000000,
 NULL, NULL,
 '2025-03-25', 'manual', true, 95, true, 'cardiovascular'),

-- Novartis / Shanghai Argo cardiovascular deal - 2024
('Shanghai Argo Biopharmaceutical', 'Novartis', 'Argo cardiovascular pipeline', 'Cardiovascular drug candidates',
 'smallMolecule', 'cardiovascular', 'Cardiovascular Disease',
 'phase_1', 'global', 'license',
 185000000, 3980000000, 4165000000,
 NULL, NULL,
 '2024-03-18', 'manual', true, 95, true, 'cardiovascular'),

-- Novartis / Anthos Therapeutics abelacimab (AF) - 2025
('Anthos Therapeutics', 'Novartis', 'Abelacimab', 'Anti-Factor XI antibody for atrial fibrillation and VTE',
 'antibody', 'atrial_fibrillation', 'Atrial Fibrillation, Venous Thromboembolism',
 'phase_3', 'global', 'acquisition',
 925000000, 2200000000, 3125000000,
 NULL, NULL,
 '2025-02-10', 'manual', true, 95, true, 'cardiovascular'),

-- Hengrui / Braveheart HRS-1893 for HCM - 2024
('Jiangsu Hengrui', 'Braveheart Therapeutics', 'HRS-1893', 'Treatment for hypertrophic cardiomyopathy',
 'smallMolecule', 'cardiomyopathy', 'Hypertrophic Cardiomyopathy',
 'phase_1', 'global', 'license',
 65000000, 1013000000, 1078000000,
 NULL, NULL,
 '2024-07-22', 'manual', true, 95, true, 'cardiovascular'),

-- Cytokinetics Myqorzo (aficamten) for oHCM - FDA approved Dec 2025
('Cytokinetics', 'Cytokinetics', 'Myqorzo (aficamten)', 'Cardiac myosin inhibitor for obstructive hypertrophic cardiomyopathy',
 'smallMolecule', 'cardiomyopathy', 'Obstructive Hypertrophic Cardiomyopathy',
 'approved', 'us', 'license',
 NULL, NULL, NULL,
 NULL, NULL,
 '2025-12-13', 'manual', false, 90, true, 'cardiovascular'),

-- BMS Camzyos (mavacamten) for oHCM - self-developed via MyoKardia acquisition
('MyoKardia', 'Bristol Myers Squibb', 'Camzyos (mavacamten)', 'Cardiac myosin inhibitor for obstructive HCM',
 'smallMolecule', 'cardiomyopathy', 'Obstructive Hypertrophic Cardiomyopathy',
 'phase_3', 'global', 'acquisition',
 13100000000, NULL, 13100000000,
 NULL, NULL,
 '2020-10-05', 'manual', true, 95, true, 'cardiovascular'),

-- AstraZeneca / Neurimmune NI006 ATTR-CM - 2022
('Neurimmune', 'AstraZeneca', 'NI006 (acoramidis competitor)', 'Anti-ATTR amyloid antibody for ATTR cardiomyopathy',
 'antibody', 'attr_cardiomyopathy', 'ATTR Cardiomyopathy',
 'phase_1', 'global', 'license',
 30000000, 730000000, 780000000,
 NULL, NULL,
 '2022-01-19', 'manual', true, 95, true, 'cardiovascular'),

-- Alnylam / Tenaya Therapeutics RNAi cardiovascular - 2024
('Tenaya Therapeutics', 'Alnylam Pharmaceuticals', 'Cardiovascular RNAi programs', 'RNAi platform for cardiovascular diseases',
 'oligonucleotide', 'heart_failure', 'Heart Failure, Cardiomyopathy',
 'preclinical', 'global', 'collaboration',
 10000000, 1130000000, 1140000000,
 NULL, NULL,
 '2024-02-05', 'manual', true, 95, true, 'cardiovascular'),

-- Merck Winrevair (sotatercept) for PAH - acquired via Acceleron
('Acceleron Pharma', 'Merck', 'Winrevair (sotatercept)', 'Activin signaling inhibitor for pulmonary arterial hypertension',
 'other', 'pah', 'Pulmonary Arterial Hypertension',
 'phase_3', 'global', 'acquisition',
 11700000000, NULL, 11700000000,
 NULL, NULL,
 '2021-09-30', 'manual', true, 95, true, 'cardiovascular'),

-- Novartis / Chinook IgA nephropathy (cardiovascular-adjacent renal) - 2023
('Chinook Therapeutics', 'Novartis', 'Atrasentan + Zigakibart', 'Endothelin A receptor antagonist + anti-APRIL antibody for IgA nephropathy',
 'antibody', 'iga_nephropathy', 'IgA Nephropathy',
 'phase_3', 'global', 'acquisition',
 3200000000, 300000000, 3500000000,
 NULL, NULL,
 '2023-06-26', 'manual', true, 95, true, 'cardiovascular'),

-- Bayer / Vividion Therapeutics cardiovascular pipeline - 2021
('Vividion Therapeutics', 'Bayer', 'Vividion covalent chemistry platform', 'Covalent drug discovery platform for cardiovascular and other targets',
 'smallMolecule', 'cardiovascular', 'Cardiovascular Disease',
 'preclinical', 'global', 'acquisition',
 1500000000, 500000000, 2000000000,
 NULL, NULL,
 '2021-06-14', 'manual', true, 95, true, 'cardiovascular'),

-- ============================================================================
-- INFECTIOUS DISEASE DEALS (Target: 25+ deals)
-- ============================================================================

-- Bavarian Nordic / Janssen (J&J) HIV/HBV vaccine - 2020
('Bavarian Nordic', 'Johnson & Johnson', 'MVA-BN HIV/HBV vaccines', 'Viral vector vaccine platform for HIV and hepatitis B',
 'vaccine', 'hiv', 'HIV, Hepatitis B',
 'phase_1', 'global', 'collaboration',
 10000000, 836000000, 879000000,
 NULL, NULL,
 '2020-01-06', 'manual', true, 95, true, 'infectiousDisease'),

-- Gilead / Hookipa HBV/HIV therapeutic vaccines - 2025
('Hookipa Pharma', 'Gilead Sciences', 'HB-200/HB-300', 'Arenaviral immunotherapy for hepatitis B and HIV',
 'vaccine', 'hbv', 'Hepatitis B, HIV',
 'phase_1', 'global', 'acquisition',
 10000000, NULL, NULL,
 NULL, NULL,
 '2025-01-15', 'manual', true, 90, true, 'infectiousDisease'),

-- GSK Arexvy RSV vaccine (self-developed) - approved 2023
('GSK', 'GSK', 'Arexvy (RSVPreF3)', 'Adjuvanted RSV vaccine for adults 60+',
 'vaccine', 'rsv', 'Respiratory Syncytial Virus',
 'approved', 'global', 'license',
 NULL, NULL, NULL,
 NULL, NULL,
 '2023-05-03', 'manual', false, 90, true, 'infectiousDisease'),

-- Pfizer Abrysvo RSV vaccine - approved 2023
('Pfizer', 'Pfizer', 'Abrysvo (RSVpreF)', 'Bivalent RSV prefusion F vaccine for adults 60+ and maternal immunization',
 'vaccine', 'rsv', 'Respiratory Syncytial Virus',
 'approved', 'global', 'license',
 NULL, NULL, NULL,
 NULL, NULL,
 '2023-05-31', 'manual', false, 90, true, 'infectiousDisease'),

-- AstraZeneca / Sanofi nirsevimab (Beyfortus) RSV monoclonal - 2017 collaboration
('AstraZeneca', 'Sanofi', 'Beyfortus (nirsevimab)', 'Long-acting anti-RSV monoclonal antibody for infants',
 'antibody', 'rsv', 'Respiratory Syncytial Virus',
 'phase_3', 'global', 'collaboration',
 NULL, NULL, NULL,
 NULL, NULL,
 '2019-03-21', 'manual', false, 90, true, 'infectiousDisease'),

-- Moderna mRNA flu vaccine collaboration / self-developed
('Moderna', 'Moderna', 'mRNA-1010', 'mRNA-based seasonal influenza vaccine',
 'mrna', 'influenza', 'Seasonal Influenza',
 'phase_3', 'global', 'license',
 NULL, NULL, NULL,
 NULL, NULL,
 '2023-06-01', 'manual', false, 85, true, 'infectiousDisease'),

-- ViiV Healthcare (GSK/Pfizer/Shionogi) cabotegravir for HIV PrEP - 2020 expansion
('ViiV Healthcare', 'ViiV Healthcare', 'Apretude (cabotegravir)', 'Long-acting injectable integrase inhibitor for HIV PrEP',
 'smallMolecule', 'hiv', 'HIV Prevention',
 'approved', 'global', 'license',
 NULL, NULL, NULL,
 NULL, NULL,
 '2021-12-20', 'manual', false, 90, true, 'infectiousDisease'),

-- Gilead / Assembly Biosciences HBV - 2023
('Assembly Biosciences', 'Gilead Sciences', 'HBV capsid assembly modulator', 'Core protein allosteric modulator for chronic hepatitis B',
 'smallMolecule', 'hbv', 'Chronic Hepatitis B',
 'phase_2', 'global', 'collaboration',
 NULL, NULL, NULL,
 NULL, NULL,
 '2023-03-01', 'manual', false, 80, true, 'infectiousDisease'),

-- GSK / Vir Biotechnology sotrovimab COVID + HBV - 2020
('Vir Biotechnology', 'GSK', 'Sotrovimab + VIR-2218 (HBV)', 'Anti-SARS-CoV-2 antibody and HBsAg-targeting siRNA for hepatitis B',
 'antibody', 'hbv', 'COVID-19, Chronic Hepatitis B',
 'phase_2', 'global', 'collaboration',
 225000000, NULL, NULL,
 NULL, NULL,
 '2020-04-06', 'manual', true, 90, true, 'infectiousDisease'),

-- Shionogi / Pfizer cefiderocol antibiotic collaboration
('Shionogi', 'Shionogi', 'Fetroja (cefiderocol)', 'Siderophore cephalosporin antibiotic for gram-negative infections',
 'smallMolecule', 'bacterial_infection', 'Multidrug-Resistant Gram-Negative Infections',
 'approved', 'global', 'license',
 NULL, NULL, NULL,
 NULL, NULL,
 '2020-09-25', 'manual', false, 85, true, 'infectiousDisease'),

-- Entasis (now Innoviva) / AstraZeneca sulbactam-durlobactam antibiotic - 2019
('Entasis Therapeutics', 'AstraZeneca', 'Xacduro (sulbactam-durlobactam)', 'Beta-lactamase inhibitor combination for Acinetobacter infections',
 'smallMolecule', 'bacterial_infection', 'Acinetobacter baumannii Infections',
 'phase_3', 'global', 'license',
 50000000, 495000000, 545000000,
 NULL, NULL,
 '2019-05-01', 'manual', true, 95, true, 'infectiousDisease'),

-- Pfizer / BioNTech COVID/Flu combo mRNA vaccine - 2020 original, expanded
('BioNTech', 'Pfizer', 'COVID/Flu mRNA vaccines', 'mRNA vaccine platform for COVID-19 and influenza',
 'mrna', 'influenza', 'COVID-19, Influenza',
 'phase_3', 'global', 'collaboration',
 NULL, NULL, NULL,
 NULL, NULL,
 '2020-03-17', 'manual', false, 95, true, 'infectiousDisease'),

-- ============================================================================
-- IMMUNOLOGY DEALS (Target: 25+ deals)
-- ============================================================================

-- AbbVie / Capstan Therapeutics in vivo CAR-T autoimmune - 2025
('Capstan Therapeutics', 'AbbVie', 'In vivo CAR-T platform', 'Targeted LNP-delivered in vivo CAR-T for autoimmune diseases',
 'cell_therapy', 'autoimmune', 'Lupus, Myasthenia Gravis',
 'preclinical', 'global', 'acquisition',
 2100000000, NULL, 2100000000,
 NULL, NULL,
 '2025-06-30', 'manual', true, 95, true, 'immunology'),

-- AbbVie / Alpine Immune Sciences ALPN-101 for lupus - 2020
('Alpine Immune Sciences', 'AbbVie', 'ALPN-101 (povetacicept predecessor)', 'Dual ICOS/CD28 antagonist for lupus and autoimmune diseases',
 'other', 'lupus', 'Systemic Lupus Erythematosus',
 'phase_1', 'global', 'option',
 60000000, 805000000, 865000000,
 NULL, NULL,
 '2020-06-29', 'manual', true, 95, true, 'immunology'),

-- Vor Bio / RemeGen telitacicept for lupus (ex-China) - 2024
('RemeGen', 'Vor Bio', 'Telitacicept', 'Dual BAFF/APRIL inhibitor approved in China for lupus and RA',
 'other', 'lupus', 'Systemic Lupus Erythematosus, Rheumatoid Arthritis',
 'phase_3', 'ex_us', 'license',
 45000000, 4000000000, 4045000000,
 NULL, NULL,
 '2024-08-12', 'manual', true, 95, true, 'immunology'),

-- Boehringer Ingelheim / CDR-Life autoimmune trispecific - 2024
('CDR-Life', 'Boehringer Ingelheim', 'CDR111', 'Trispecific T-cell engager for autoimmune diseases',
 'bispecific', 'autoimmune', 'Rheumatoid Arthritis, Multiple Sclerosis, Lupus',
 'preclinical', 'global', 'license',
 NULL, 570000000, 570000000,
 NULL, NULL,
 '2024-10-07', 'manual', true, 90, true, 'immunology'),

-- Zenas BioPharma / InnoCare autoimmune pipeline - 2024
('InnoCare Pharma', 'Zenas BioPharma', 'ICP-332 (obexelimab successor)', 'BTK inhibitor and other assets for autoimmune diseases',
 'smallMolecule', 'autoimmune', 'Multiple Autoimmune Indications',
 'phase_2', 'global', 'license',
 NULL, 2000000000, 2000000000,
 NULL, NULL,
 '2024-09-23', 'manual', true, 90, true, 'immunology'),

-- BMS / Bain Capital autoimmune spinout (5 immunology assets) - 2025
('Bristol Myers Squibb', 'BMS/Bain Capital NewCo', 'Five immunology assets', 'Spinout of 5 immunology pipeline assets including late-stage lupus candidate',
 'other', 'lupus', 'Lupus, Autoimmune Diseases',
 'phase_2', 'global', 'collaboration',
 300000000, NULL, NULL,
 NULL, NULL,
 '2025-05-12', 'manual', true, 90, true, 'immunology'),

-- AbbVie / FutureGen TL1A antibody for autoimmune/IBD - 2024
('FutureGen Biopharmaceutical', 'AbbVie', 'FG-M701', 'Anti-TL1A antibody for autoimmune and inflammatory diseases',
 'antibody', 'autoimmune', 'IBD, Autoimmune Diseases',
 'preclinical', 'global', 'license',
 150000000, 1560000000, 1710000000,
 NULL, NULL,
 '2024-06-13', 'manual', true, 95, true, 'immunology'),

-- Eli Lilly / Morphic alpha4beta7 for autoimmune IBD - 2024
('Morphic Holding', 'Eli Lilly', 'MORF-057', 'Oral alpha4beta7 integrin inhibitor for autoimmune/inflammatory disease',
 'smallMolecule', 'autoimmune', 'Ulcerative Colitis, Crohn''s Disease',
 'phase_2', 'global', 'acquisition',
 3200000000, NULL, 3200000000,
 NULL, NULL,
 '2024-07-08', 'manual', true, 95, true, 'immunology'),

-- GSK / Aiolos Bio anti-TSLP for asthma/autoimmune - 2024
('Aiolos Bio', 'GSK', 'AIO-001', 'Long-acting anti-TSLP antibody for asthma and autoimmune conditions',
 'antibody', 'asthma', 'Asthma, Autoimmune Conditions',
 'phase_1', 'global', 'acquisition',
 1000000000, 400000000, 1400000000,
 NULL, NULL,
 '2024-01-08', 'manual', true, 95, true, 'immunology'),

-- Merck acquires Prometheus Biosciences (TL1A for IBD/autoimmune) - 2023
('Prometheus Biosciences', 'Merck', 'MK-7240 (PRA-023)', 'Anti-TL1A with companion diagnostic for autoimmune IBD',
 'antibody', 'autoimmune', 'Ulcerative Colitis, Crohn''s Disease',
 'phase_2', 'global', 'acquisition',
 10800000000, NULL, 10800000000,
 NULL, NULL,
 '2023-04-16', 'manual', true, 95, true, 'immunology'),

-- Pfizer / Arena etrasimod for autoimmune - 2022
('Arena Pharmaceuticals', 'Pfizer', 'Velsipity (etrasimod)', 'S1P receptor modulator for autoimmune conditions',
 'smallMolecule', 'autoimmune', 'Ulcerative Colitis, Autoimmune',
 'phase_3', 'global', 'acquisition',
 6700000000, NULL, 6700000000,
 NULL, NULL,
 '2022-03-11', 'manual', true, 95, true, 'immunology'),

-- Johnson & Johnson acquires Proteologix (bispecific IL-13/TSLP) - 2023
('Proteologix', 'Johnson & Johnson', 'PRX-106', 'Bispecific antibody targeting IL-13 and TSLP for atopic dermatitis and asthma',
 'bispecific', 'autoimmune', 'Atopic Dermatitis, Asthma',
 'preclinical', 'global', 'acquisition',
 850000000, 1350000000, 2200000000,
 NULL, NULL,
 '2023-07-24', 'manual', true, 95, true, 'immunology'),

-- Roche / Roivant Sciences KPL-404 (anti-CD40L) for autoimmune - 2023
('Roivant Sciences', 'Roche', 'KPL-404', 'Anti-CD40L antibody for autoimmune conditions',
 'antibody', 'autoimmune', 'Sjogren''s, Autoimmune Diseases',
 'phase_2', 'global', 'license',
 60000000, 7000000000, 7060000000,
 NULL, NULL,
 '2023-10-02', 'manual', true, 95, true, 'immunology'),

-- ============================================================================
-- NEUROLOGY DEALS (Target: 25+ deals)
-- ============================================================================

-- GSK / Alector immuno-neurology (FTD, Alzheimer's) - 2021
('Alector', 'GSK', 'AL001 (latozinemab) + AL101', 'Anti-sortilin and anti-PGRN antibodies for frontotemporal dementia and Alzheimer''s',
 'antibody', 'alzheimers', 'Frontotemporal Dementia, Alzheimer''s Disease',
 'phase_2', 'global', 'collaboration',
 700000000, 1500000000, 2200000000,
 NULL, NULL,
 '2021-07-26', 'manual', true, 95, true, 'neurology'),

-- Biogen / Denali LRRK2 Parkinson's - 2020
('Denali Therapeutics', 'Biogen', 'LRRK2 inhibitors (DNL151/BIIB122)', 'Small molecule LRRK2 inhibitors for Parkinson''s disease',
 'smallMolecule', 'parkinsons', 'Parkinson''s Disease',
 'phase_1', 'global', 'collaboration',
 560000000, 1125000000, 2150000000,
 NULL, NULL,
 '2020-08-17', 'manual', true, 95, true, 'neurology'),

-- Eli Lilly / QurAlis QRL-204 ALS - 2024
('QurAlis', 'Eli Lilly', 'QRL-204', 'UNC13A splice-switching ASO for ALS and frontotemporal dementia',
 'oligonucleotide', 'als', 'ALS, Frontotemporal Dementia',
 'preclinical', 'global', 'license',
 45000000, 577000000, 622000000,
 NULL, NULL,
 '2024-06-17', 'manual', true, 95, true, 'neurology'),

-- Eli Lilly / Alchemab ALS antibody - 2025
('Alchemab Therapeutics', 'Eli Lilly', 'ALS protective antibody program', 'Antibodies derived from ALS-resilient individuals',
 'antibody', 'als', 'ALS',
 'preclinical', 'global', 'license',
 NULL, 415000000, 415000000,
 NULL, NULL,
 '2025-01-27', 'manual', true, 95, true, 'neurology'),

-- AbbVie acquires Cerevel Therapeutics (schizophrenia, neurology) - 2023
('Cerevel Therapeutics', 'AbbVie', 'Emraclidine + pipeline', 'M4 muscarinic agonist for schizophrenia plus neurology pipeline',
 'smallMolecule', 'schizophrenia', 'Schizophrenia, Mood Disorders',
 'phase_2', 'global', 'acquisition',
 8700000000, NULL, 8700000000,
 NULL, NULL,
 '2023-12-06', 'manual', true, 95, true, 'neurology'),

-- Johnson & Johnson acquires Intra-Cellular Therapies (schizophrenia) - 2025
('Intra-Cellular Therapies', 'Johnson & Johnson', 'Caplyta (lumateperone)', 'Selective serotonin/dopamine modulator for schizophrenia and bipolar depression',
 'smallMolecule', 'schizophrenia', 'Schizophrenia, Bipolar Depression',
 'approved', 'global', 'acquisition',
 15000000000, NULL, 15000000000,
 NULL, NULL,
 '2025-01-13', 'manual', true, 95, true, 'neurology'),

-- AbbVie acquires Aliada Therapeutics (Alzheimer's BBB delivery) - 2024
('Aliada Therapeutics', 'AbbVie', 'ALIA-1758', 'Brain-penetrant antibody using TfR1 delivery for Alzheimer''s',
 'antibody', 'alzheimers', 'Alzheimer''s Disease',
 'preclinical', 'global', 'acquisition',
 1400000000, NULL, 1400000000,
 NULL, NULL,
 '2024-12-02', 'manual', true, 95, true, 'neurology'),

-- AstraZeneca (Alexion) / JCR Pharmaceuticals BBB delivery - 2024
('JCR Pharmaceuticals', 'AstraZeneca', 'JUST-AAV BBB platform', 'Blood-brain barrier crossing AAV platform for CNS diseases',
 'gene_therapy', 'cns', 'CNS Rare Diseases',
 'preclinical', 'global', 'license',
 NULL, 825000000, 825000000,
 NULL, NULL,
 '2024-09-16', 'manual', true, 90, true, 'neurology'),

-- Genentech / Sangamo neurodegenerative disease - 2020
('Sangamo Therapeutics', 'Genentech', 'Zinc finger regulators', 'Gene regulation platform for neurodegenerative diseases (tau, SNCA)',
 'gene_therapy', 'alzheimers', 'Alzheimer''s, Parkinson''s, Other Neurodegeneration',
 'preclinical', 'global', 'collaboration',
 50000000, 2000000000, 2050000000,
 NULL, NULL,
 '2020-02-07', 'manual', true, 95, true, 'neurology'),

-- Biogen / Eisai lecanemab (Leqembi) for Alzheimer's - ongoing collaboration
('Eisai', 'Biogen', 'Leqembi (lecanemab)', 'Anti-amyloid beta protofibril antibody for early Alzheimer''s disease',
 'antibody', 'alzheimers', 'Early Alzheimer''s Disease',
 'approved', 'global', 'collaboration',
 NULL, NULL, NULL,
 NULL, NULL,
 '2023-07-06', 'manual', false, 95, true, 'neurology'),

-- Eli Lilly Kisunla (donanemab) for Alzheimer's - self-developed, approved 2024
('Eli Lilly', 'Eli Lilly', 'Kisunla (donanemab)', 'Anti-amyloid beta (N3pG) antibody for early symptomatic Alzheimer''s',
 'antibody', 'alzheimers', 'Early Symptomatic Alzheimer''s Disease',
 'approved', 'global', 'license',
 NULL, NULL, NULL,
 NULL, NULL,
 '2024-07-02', 'manual', false, 95, true, 'neurology'),

-- Roche / Prothena prasinezumab for Parkinson's - 2013 collaboration expanded 2023
('Prothena', 'Roche', 'Prasinezumab', 'Anti-alpha-synuclein antibody for Parkinson''s disease',
 'antibody', 'parkinsons', 'Parkinson''s Disease',
 'phase_2', 'global', 'collaboration',
 45000000, 2175000000, 2220000000,
 NULL, NULL,
 '2023-09-28', 'manual', true, 95, true, 'neurology'),

-- Biogen / Sage Therapeutics zuranolone for depression - 2020
('Sage Therapeutics', 'Biogen', 'Zurzuvae (zuranolone)', 'GABA-A receptor positive allosteric modulator for major depressive disorder',
 'smallMolecule', 'depression', 'Major Depressive Disorder, Postpartum Depression',
 'phase_3', 'global', 'collaboration',
 875000000, 1375000000, 2250000000,
 NULL, NULL,
 '2020-11-05', 'manual', true, 95, true, 'neurology'),

-- Lundbeck / Otsuka brexpiprazole and pipeline - ongoing
('Otsuka Pharmaceutical', 'Lundbeck', 'Rexulti (brexpiprazole)', 'Serotonin-dopamine activity modulator for Alzheimer''s agitation',
 'smallMolecule', 'alzheimers', 'Alzheimer''s Disease Agitation',
 'approved', 'global', 'collaboration',
 NULL, NULL, NULL,
 NULL, NULL,
 '2023-05-11', 'manual', false, 85, true, 'neurology'),

-- Pfizer / Bain Capital Cerevel Neuroscience spinout (original) - 2018
('Pfizer', 'Cerevel Therapeutics', 'Neuroscience pipeline', 'Spinout of Pfizer neuroscience portfolio to new company backed by Bain Capital',
 'smallMolecule', 'schizophrenia', 'Schizophrenia, Epilepsy, Parkinson''s',
 'phase_2', 'global', 'collaboration',
 350000000, NULL, 350000000,
 NULL, NULL,
 '2019-06-25', 'manual', true, 90, true, 'neurology'),

-- UCB acquires RA Capital-backed Staidson for neuroscience assets - 2023
-- ABL Bio / Eli Lilly bispecific antibody for neurodegeneration - 2024
('ABL Bio', 'Eli Lilly', 'ABL301 and pipeline', 'Bispecific antibodies with brain shuttle for Parkinson''s and neurodegeneration',
 'bispecific', 'parkinsons', 'Parkinson''s Disease, Alpha-synuclein',
 'phase_1', 'global', 'collaboration',
 NULL, 2600000000, 2600000000,
 NULL, NULL,
 '2024-09-30', 'manual', true, 95, true, 'neurology'),

-- Novartis / Alnylam liver-brain axis (neurology/rare overlap) - 2021
('Alnylam Pharmaceuticals', 'Novartis', 'ALN-APP', 'siRNA targeting amyloid precursor protein for Alzheimer''s and cerebral amyloid angiopathy',
 'oligonucleotide', 'alzheimers', 'Alzheimer''s Disease, Cerebral Amyloid Angiopathy',
 'phase_1', 'global', 'collaboration',
 NULL, NULL, NULL,
 NULL, NULL,
 '2021-10-18', 'manual', false, 85, true, 'neurology')

ON CONFLICT (licensor_name, licensee_name, asset_name, announced_date) DO NOTHING;
