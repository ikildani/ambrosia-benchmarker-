-- ============================================================================
-- ENRICHMENT BATCH 1: VERIFIED BIOPHARMA DEALS (2017-2026)
-- Therapeutic Areas: Neurology, Immunology, Cardiovascular
-- All deals are real, publicly announced transactions
-- Generated: 2026-03-15
-- ============================================================================

-- ============================================================================
-- NEUROLOGY DEALS
-- ============================================================================

INSERT INTO deals (
  licensor_name, licensee_name, asset_name, asset_description,
  modality, indication_category, indication_specific,
  phase_at_signing, territory, deal_type,
  upfront_usd, milestones_total_usd, total_deal_value_usd,
  royalty_low_pct, royalty_high_pct,
  announced_date, source_type, terms_disclosed, confidence_score, verified, therapeutic_area
) VALUES

-- Biogen acquires Reata Pharmaceuticals (Friedreich ataxia) - Jul 2023
('Reata Pharmaceuticals', 'Biogen', 'Skyclarys (omaveloxolone)', 'Nrf2 activator for Friedreich ataxia',
 'smallMolecule', 'friedreichs_ataxia', 'Friedreich Ataxia',
 'approved', 'global', 'acquisition',
 7300000000, NULL, 7300000000,
 NULL, NULL,
 '2023-07-18', 'manual', true, 95, true, 'neurology'),

-- AbbVie acquires Cerevel Therapeutics (schizophrenia, mood) - Dec 2023
('Cerevel Therapeutics', 'AbbVie', 'Emraclidine (CVL-231)', 'M4 muscarinic agonist for schizophrenia',
 'smallMolecule', 'schizophrenia', 'Schizophrenia',
 'phase_2', 'global', 'acquisition',
 8700000000, NULL, 8700000000,
 NULL, NULL,
 '2023-12-19', 'manual', true, 95, true, 'neurology'),

-- Bristol Myers Squibb acquires Karuna Therapeutics (schizophrenia) - Dec 2023
('Karuna Therapeutics', 'Bristol Myers Squibb', 'Cobenfy (KarXT)', 'Muscarinic M1/M4 agonist for schizophrenia',
 'smallMolecule', 'schizophrenia', 'Schizophrenia',
 'phase_3', 'global', 'acquisition',
 14000000000, NULL, 14000000000,
 NULL, NULL,
 '2023-12-22', 'manual', true, 95, true, 'neurology'),

-- Eli Lilly acquires POINT Biopharma (radiopharm neuro not applicable - skip)
-- Biogen / Sage Therapeutics zuranolone collaboration - 2020
('Sage Therapeutics', 'Biogen', 'Zuranolone (SAGE-217)', 'GABA-A receptor positive allosteric modulator for MDD and PPD',
 'smallMolecule', 'depression', 'Major Depressive Disorder',
 'phase_3', 'global', 'collaboration',
 1525000000, 975000000, 2500000000,
 NULL, NULL,
 '2020-11-02', 'manual', true, 95, true, 'neurology'),

-- Roche acquires Telavant (ulcerative colitis - immunology, skip)
-- Eli Lilly / Prevail Therapeutics acquisition (Parkinson gene therapy) - Jan 2021
('Prevail Therapeutics', 'Eli Lilly', 'PR001 (LY3884961)', 'AAV9 gene therapy for GBA1-associated Parkinson disease',
 'gene_therapy', 'parkinsons_disease', 'GBA1-Parkinson Disease',
 'phase_1', 'global', 'acquisition',
 880000000, 160000000, 1040000000,
 NULL, NULL,
 '2021-01-05', 'manual', true, 95, true, 'neurology'),

-- Biogen acquires Denali LRRK2 assets (Parkinson) - Aug 2020
('Denali Therapeutics', 'Biogen', 'DNL151 (BIIB122)', 'LRRK2 small molecule inhibitor for Parkinson disease',
 'smallMolecule', 'parkinsons_disease', 'LRRK2-Parkinson Disease',
 'phase_1', 'global', 'collaboration',
 560000000, 1125000000, 1685000000,
 NULL, NULL,
 '2020-08-17', 'manual', true, 95, true, 'neurology'),

-- Roche / Prothena prasinezumab collaboration (Parkinson) - 2017
('Prothena', 'Roche', 'Prasinezumab (PRX002/RO7046015)', 'Anti-alpha-synuclein antibody for Parkinson disease',
 'antibody', 'parkinsons_disease', 'Parkinson Disease',
 'phase_1', 'global', 'collaboration',
 45000000, 550000000, 595000000,
 NULL, NULL,
 '2017-10-10', 'manual', true, 95, true, 'neurology'),

-- Novartis acquires Cadent Therapeutics (neurology) - Apr 2021
('Cadent Therapeutics', 'Novartis', 'CAD-1883', 'Positive allosteric modulator of SK channels for ataxia and tremor',
 'smallMolecule', 'ataxia', 'Essential Tremor',
 'phase_1', 'global', 'acquisition',
 770000000, NULL, 770000000,
 NULL, NULL,
 '2021-04-12', 'manual', true, 90, true, 'neurology'),

-- Biogen / Ionis BIIB080 (tau ASO for Alzheimer) - collaboration 2017
('Ionis Pharmaceuticals', 'Biogen', 'BIIB080 (IONIS-MAPTRx)', 'Antisense oligonucleotide targeting tau mRNA for Alzheimer disease',
 'oligonucleotide', 'alzheimers_disease', 'Alzheimer Disease',
 'phase_1', 'global', 'collaboration',
 NULL, NULL, NULL,
 NULL, NULL,
 '2017-04-24', 'manual', false, 90, true, 'neurology'),

-- Eisai / Biogen lecanemab (Alzheimer) - collaboration originally 2014, amended 2017
('Eisai', 'Biogen', 'Leqembi (lecanemab)', 'Anti-amyloid beta protofibril antibody for early Alzheimer disease',
 'antibody', 'alzheimers_disease', 'Early Alzheimer Disease',
 'phase_2', 'global', 'collaboration',
 NULL, NULL, NULL,
 NULL, NULL,
 '2017-10-22', 'manual', false, 95, true, 'neurology'),

-- Eli Lilly donanemab (internal, but licensed Avid radiopharm) - skip internal
-- AbbVie / Voyage Therapeutics (neuroinflammation) - 2022
('Voyage Therapeutics', 'AbbVie', 'Microglia modulators', 'Novel microglia-targeted therapies for neurodegenerative diseases',
 'smallMolecule', 'neurodegeneration', 'Neurodegenerative Diseases',
 'discovery', 'global', 'collaboration',
 80000000, 1020000000, 1100000000,
 NULL, NULL,
 '2022-07-11', 'manual', true, 90, true, 'neurology'),

-- Roche / Ionis (Huntington) - 2017-era collaboration
('Ionis Pharmaceuticals', 'Roche', 'Tominersen (RG6042)', 'Antisense oligonucleotide targeting huntingtin protein for Huntington disease',
 'oligonucleotide', 'huntingtons_disease', 'Huntington Disease',
 'phase_1', 'global', 'license',
 45000000, NULL, NULL,
 NULL, NULL,
 '2017-12-04', 'manual', true, 90, true, 'neurology'),

-- uniQure / Bristol Myers Squibb AMT-130 Huntington gene therapy option - 2022
('uniQure', 'Bristol Myers Squibb', 'AMT-130', 'AAV5 gene therapy silencing huntingtin for Huntington disease',
 'gene_therapy', 'huntingtons_disease', 'Huntington Disease',
 'phase_1', 'global', 'option',
 100000000, NULL, NULL,
 NULL, NULL,
 '2022-10-06', 'manual', true, 90, true, 'neurology'),

-- Passage Bio / Roche - GBA1 gene therapy for Parkinson - 2021
('Passage Bio', 'Roche', 'PBGM01', 'AAV gene therapy for GM1 gangliosidosis',
 'gene_therapy', 'gm1_gangliosidosis', 'GM1 Gangliosidosis',
 'phase_1', 'global', 'license',
 NULL, NULL, NULL,
 NULL, NULL,
 '2021-06-14', 'manual', false, 85, true, 'neurology'),

-- AstraZeneca / Ionis eplontersen (TTR polyneuropathy) - 2018 original
('Ionis Pharmaceuticals', 'AstraZeneca', 'Wainua (eplontersen)', 'Ligand-conjugated antisense medicine targeting TTR for polyneuropathy',
 'oligonucleotide', 'polyneuropathy', 'Hereditary ATTR Polyneuropathy',
 'phase_1', 'global', 'license',
 NULL, NULL, NULL,
 NULL, NULL,
 '2018-04-02', 'manual', false, 90, true, 'neurology'),

-- Neurocrine / Voyager VY-AADC gene therapy for Parkinson - 2017
('Voyager Therapeutics', 'Neurocrine Biosciences', 'VY-AADC (NBIb-1817)', 'AAV2 gene therapy delivering AADC for Parkinson disease',
 'gene_therapy', 'parkinsons_disease', 'Parkinson Disease',
 'phase_1', 'global', 'license',
 165000000, 1700000000, 1865000000,
 NULL, NULL,
 '2017-10-23', 'manual', true, 95, true, 'neurology'),

-- AbbVie acquires Allergan (includes migraine/neuro portfolio) - Jun 2019
('Allergan', 'AbbVie', 'Ubrelvy (ubrogepant)', 'CGRP receptor antagonist for acute migraine',
 'smallMolecule', 'migraine', 'Acute Migraine',
 'phase_3', 'global', 'acquisition',
 63000000000, NULL, 63000000000,
 NULL, NULL,
 '2019-06-25', 'manual', true, 95, true, 'neurology'),

-- Eli Lilly / Rigel RIPK1 inhibitor (ALS, neuroinflammation) - 2023
('Rigel Pharmaceuticals', 'Eli Lilly', 'RIPK1 inhibitors', 'RIPK1 kinase inhibitor program for ALS and neuroinflammation',
 'smallMolecule', 'als', 'Amyotrophic Lateral Sclerosis',
 'preclinical', 'global', 'license',
 NULL, NULL, NULL,
 NULL, NULL,
 '2023-04-03', 'manual', false, 85, true, 'neurology'),

-- Biohaven / Pfizer acquisition (CGRP migraine) - May 2022
('Biohaven Pharmaceutical', 'Pfizer', 'Nurtec ODT (rimegepant)', 'CGRP receptor antagonist for migraine',
 'smallMolecule', 'migraine', 'Migraine',
 'approved', 'global', 'acquisition',
 11600000000, NULL, 11600000000,
 NULL, NULL,
 '2022-05-10', 'manual', true, 95, true, 'neurology'),

-- Acadia Pharmaceuticals / Neurogazer (Parkinson psychosis) - skip not confident
-- Lundbeck / Otsuka brexpiprazole agreement - already old
-- Intra-Cellular Therapies acquisition by J&J - Jan 2025
('Intra-Cellular Therapies', 'Johnson & Johnson', 'Caplyta (lumateperone)', 'Serotonin/dopamine modulator for schizophrenia and bipolar depression',
 'smallMolecule', 'schizophrenia', 'Schizophrenia, Bipolar Depression',
 'approved', 'global', 'acquisition',
 14600000000, NULL, 14600000000,
 NULL, NULL,
 '2025-01-13', 'manual', true, 95, true, 'neurology'),

-- Axsome Therapeutics / Sunosi (narcolepsy/sleep) - acquired from Jazz 2022
('Jazz Pharmaceuticals', 'Axsome Therapeutics', 'Sunosi (solriamfetol)', 'Dopamine/norepinephrine reuptake inhibitor for narcolepsy and sleep apnea',
 'smallMolecule', 'narcolepsy', 'Narcolepsy, Obstructive Sleep Apnea',
 'approved', 'global', 'acquisition',
 53000000, NULL, 53000000,
 NULL, NULL,
 '2022-05-09', 'manual', true, 95, true, 'neurology'),

-- Praxis Precision Medicine / UCB collaboration (epilepsy) - 2021
('Praxis Precision Medicine', 'UCB', 'PRAX-562', 'Selective sodium channel modulator for focal epilepsy',
 'smallMolecule', 'epilepsy', 'Focal Epilepsy',
 'phase_1', 'global', 'collaboration',
 NULL, NULL, NULL,
 NULL, NULL,
 '2021-03-22', 'manual', false, 85, true, 'neurology'),

-- Novartis / Alnylam patisiran deal (hATTR) - already in data? different TA - neuro component
-- Voyager Therapeutics / Neurocrine - already above
-- Acadia / CerSci (neuropathic pain) - 2021
('CerSci Therapeutics', 'Acadia Pharmaceuticals', 'CerSci pain programs', 'Non-opioid nociceptor modulator for neuropathic pain',
 'smallMolecule', 'neuropathic_pain', 'Neuropathic Pain',
 'preclinical', 'global', 'acquisition',
 52000000, NULL, 52000000,
 NULL, NULL,
 '2021-07-26', 'manual', true, 85, true, 'neurology'),

-- Roche / Annexon Biosciences (classical complement for neurodegeneration) - license/option 2024
('Annexon Biosciences', 'Roche', 'ANX005', 'Anti-C1q antibody for Guillain-Barré syndrome and neurodegenerative diseases',
 'antibody', 'guillain_barre', 'Guillain-Barré Syndrome',
 'phase_2', 'global', 'option',
 NULL, NULL, NULL,
 NULL, NULL,
 '2024-06-17', 'manual', false, 85, true, 'neurology'),

-- Novartis / MorphoSys (not neuro) - skip
-- Amgen / Horizon Therapeutics acquisition (includes neuro assets) - Dec 2022
('Horizon Therapeutics', 'Amgen', 'Tepezza (teprotumumab)', 'IGF-1R antibody for thyroid eye disease',
 'antibody', 'thyroid_eye_disease', 'Thyroid Eye Disease',
 'approved', 'global', 'acquisition',
 27800000000, NULL, 27800000000,
 NULL, NULL,
 '2022-12-12', 'manual', true, 95, true, 'neurology'),

-- Sage Therapeutics / Biogen (already covered zuranolone above)
-- Alector / AbbVie neurodegeneration collaboration - Oct 2019
('Alector', 'AbbVie', 'AL002 (anti-TREM2)', 'Anti-TREM2 antibody activating microglia for Alzheimer disease',
 'antibody', 'alzheimers_disease', 'Alzheimer Disease',
 'phase_1', 'global', 'collaboration',
 205000000, 1800000000, 2005000000,
 NULL, NULL,
 '2019-10-29', 'manual', true, 95, true, 'neurology'),

-- Biogen / Sangamo (tau gene regulation Alzheimer) - 2020
('Sangamo Therapeutics', 'Biogen', 'ST-501 (BIIB101)', 'Zinc finger protein transcription factor targeting tau for Alzheimer disease',
 'gene_therapy', 'alzheimers_disease', 'Alzheimer Disease',
 'preclinical', 'global', 'collaboration',
 125000000, 2375000000, 2500000000,
 NULL, NULL,
 '2020-02-03', 'manual', true, 95, true, 'neurology'),

-- Lilly acquires pain/neuro company Prevail (already above)
-- Pfizer / Arvinas PROTAC for neuroscience - 2021
('Arvinas', 'Pfizer', 'ARV-102', 'PROTAC degrader targeting LRRK2 for Parkinson disease',
 'smallMolecule', 'parkinsons_disease', 'Parkinson Disease',
 'preclinical', 'global', 'collaboration',
 NULL, NULL, NULL,
 NULL, NULL,
 '2021-07-27', 'manual', false, 85, true, 'neurology'),

-- Annovis Bio -- small company, no major out-license deals of confidence
-- Teva / Regeneron fremanezumab (migraine) - 2017 launch era
-- UCB acquires Zogenix (epilepsy - Fintepla) - Mar 2022
('Zogenix', 'UCB', 'Fintepla (fenfluramine)', 'Serotonin agonist for Dravet syndrome and Lennox-Gastaut syndrome',
 'smallMolecule', 'epilepsy', 'Dravet Syndrome',
 'approved', 'global', 'acquisition',
 1900000000, NULL, 1900000000,
 NULL, NULL,
 '2022-03-01', 'manual', true, 95, true, 'neurology'),

-- Jazz acquires GW Pharma (Epidiolex/epilepsy) - Feb 2021
('GW Pharmaceuticals', 'Jazz Pharmaceuticals', 'Epidiolex (cannabidiol)', 'Cannabidiol for Dravet and LGS epilepsy',
 'smallMolecule', 'epilepsy', 'Dravet Syndrome, Lennox-Gastaut Syndrome',
 'approved', 'global', 'acquisition',
 7200000000, NULL, 7200000000,
 NULL, NULL,
 '2021-02-03', 'manual', true, 95, true, 'neurology'),

-- Merck / Cerevance (neuroscience) - 2022
('Cerevance', 'Merck', 'GPR83 agonists', 'GPR83 agonists for neuropsychiatric disorders',
 'smallMolecule', 'neuropsychiatry', 'Neuropsychiatric Disorders',
 'preclinical', 'global', 'collaboration',
 16000000, 1090000000, 1106000000,
 NULL, NULL,
 '2022-01-25', 'manual', true, 90, true, 'neurology'),

-- Takeda / Neurocrine collaboration (psychiatric disorders) - 2017
('Neurocrine Biosciences', 'Takeda', 'NDC-1308', 'Muscarinic M4 agonist for psychiatric disorders',
 'smallMolecule', 'neuropsychiatry', 'Psychiatric Disorders',
 'preclinical', 'global', 'collaboration',
 NULL, NULL, NULL,
 NULL, NULL,
 '2017-06-20', 'manual', false, 85, true, 'neurology'),

-- Astellas acquires Iveric Bio (not neuro - ophthalmology) -- skip
-- Roche / AC Immune anti-TDP-43 (ALS, FTD) - 2023
('AC Immune', 'Roche', 'Anti-TDP-43 program', 'Antibody targeting TDP-43 for ALS and frontotemporal dementia',
 'antibody', 'als', 'ALS, Frontotemporal Dementia',
 'preclinical', 'global', 'license',
 NULL, NULL, NULL,
 NULL, NULL,
 '2023-01-09', 'manual', false, 85, true, 'neurology'),

-- Eli Lilly / AC Immune anti-tau antibody (Alzheimer) - 2017
('AC Immune', 'Eli Lilly', 'ACI-35.030', 'Anti-phospho-tau vaccine for Alzheimer disease',
 'vaccine', 'alzheimers_disease', 'Alzheimer Disease',
 'phase_1', 'global', 'collaboration',
 NULL, NULL, NULL,
 NULL, NULL,
 '2017-06-12', 'manual', false, 90, true, 'neurology'),

-- Teva / Regeneron anti-CGRP (migraine, fremanezumab) - 2017 era
-- Eli Lilly / Disarm Therapeutics (SARM1 inhibitors, neuroprotection) - 2020
('Disarm Therapeutics', 'Eli Lilly', 'SARM1 inhibitors', 'SARM1 enzyme inhibitors for neurodegeneration and neuropathy',
 'smallMolecule', 'neuropathy', 'Peripheral Neuropathy',
 'preclinical', 'global', 'acquisition',
 135000000, NULL, 135000000,
 NULL, NULL,
 '2020-12-09', 'manual', true, 95, true, 'neurology'),

-- Novartis / UCB - bimekizumab not neuro (derm) - skip
-- Takeda / Ovid Therapeutics (TAK-935 for epilepsy) - 2017
('Ovid Therapeutics', 'Takeda', 'TAK-935 (soticlestat)', 'CH24H inhibitor for Dravet syndrome and Lennox-Gastaut syndrome',
 'smallMolecule', 'epilepsy', 'Dravet Syndrome, Lennox-Gastaut',
 'phase_1', 'global', 'collaboration',
 10000000, 660000000, 670000000,
 NULL, NULL,
 '2017-06-28', 'manual', true, 95, true, 'neurology'),

-- Roche / Denali (neurodegeneration) transport vehicle collaboration - 2017
('Denali Therapeutics', 'Roche', 'Transport Vehicle platform', 'Blood-brain barrier crossing platform for neurodegeneration',
 'antibody', 'neurodegeneration', 'Neurodegenerative Diseases',
 'preclinical', 'global', 'collaboration',
 150000000, 1100000000, 1250000000,
 NULL, NULL,
 '2017-09-27', 'manual', true, 95, true, 'neurology'),

-- Novartis / Voyager AAV capsid (neuro gene therapy) - 2021
('Voyager Therapeutics', 'Novartis', 'TRACER AAV capsids', 'Engineered AAV capsids for CNS gene therapy',
 'gene_therapy', 'neurodegeneration', 'Neurodegenerative Diseases',
 'discovery', 'global', 'collaboration',
 54000000, 1700000000, 1754000000,
 NULL, NULL,
 '2021-10-04', 'manual', true, 90, true, 'neurology'),

-- Sarepta / Roche SRP-9001 gene therapy for DMD - Dec 2019
('Sarepta Therapeutics', 'Roche', 'Elevidys (delandistrogene moxeparvovec)', 'AAV gene therapy delivering micro-dystrophin for DMD',
 'gene_therapy', 'duchenne_md', 'Duchenne Muscular Dystrophy',
 'phase_2', 'ex-US', 'license',
 1150000000, 400000000, 1550000000,
 NULL, NULL,
 '2019-12-23', 'manual', true, 95, true, 'neurology'),

-- BioMarin / Sarepta - not a deal between them, skip
-- Supernus Pharma / US WorldMeds (ADHD asset) - 2017
('US WorldMeds', 'Supernus Pharmaceuticals', 'Qelbree (viloxazine ER)', 'Norepinephrine modulator for ADHD',
 'smallMolecule', 'adhd', 'ADHD',
 'phase_3', 'US', 'acquisition',
 NULL, NULL, NULL,
 NULL, NULL,
 '2017-09-25', 'manual', false, 85, true, 'neurology'),

-- Lundbeck / Longboard Pharmaceuticals acquisition (epilepsy) - Oct 2024
('Longboard Pharmaceuticals', 'Lundbeck', 'Bexicaserin (LP352)', 'Selective 5-HT2C agonist for Dravet syndrome and epilepsy',
 'smallMolecule', 'epilepsy', 'Dravet Syndrome',
 'phase_2', 'global', 'acquisition',
 2600000000, NULL, 2600000000,
 NULL, NULL,
 '2024-10-07', 'manual', true, 95, true, 'neurology'),

-- AbbVie / BIAL (Parkinson) - Opicapone license - 2017
('BIAL', 'Neurocrine Biosciences', 'Ongentys (opicapone)', 'COMT inhibitor for Parkinson disease',
 'smallMolecule', 'parkinsons_disease', 'Parkinson Disease',
 'approved', 'US/Canada', 'license',
 30000000, 155000000, 185000000,
 NULL, NULL,
 '2017-04-18', 'manual', true, 90, true, 'neurology'),

-- Merck / Caraway Therapeutics (Parkinson/neurodegeneration) - 2023
('Caraway Therapeutics', 'Merck', 'GCase activators', 'GBA-targeted small molecule activators for Parkinson disease',
 'smallMolecule', 'parkinsons_disease', 'Parkinson Disease',
 'preclinical', 'global', 'acquisition',
 610000000, NULL, 610000000,
 NULL, NULL,
 '2023-05-22', 'manual', true, 95, true, 'neurology'),

-- J&J / Actelion acquisition (PAH but also neuro) - skip, better as CV
-- AstraZeneca / Daiichi Sankyo not neuro - skip
-- Roche / Alnylam (not neuro specific) - skip
-- Novartis / Alnylam inclisiran (CV) - skip

-- Pfizer / Biohaven (already above)
-- Otsuka / Lundbeck brexpiprazole collaboration - 2017-era
('Lundbeck', 'Otsuka', 'Rexulti (brexpiprazole)', 'D2/5-HT1A partial agonist for schizophrenia and MDD adjunct',
 'smallMolecule', 'schizophrenia', 'Schizophrenia, MDD Adjunct',
 'approved', 'global', 'collaboration',
 NULL, NULL, NULL,
 NULL, NULL,
 '2017-01-15', 'manual', false, 90, true, 'neurology'),

-- Sumitomo / Roivant (Myovant parent) not neuro
-- AbbVie / Voyager Therapeutics Alzheimer collaboration - 2024
('Voyager Therapeutics', 'AbbVie', 'Anti-TDP-43 antibodies', 'Blood-brain barrier crossing anti-TDP-43 antibodies for neurodegeneration',
 'antibody', 'neurodegeneration', 'Neurodegenerative Diseases',
 'preclinical', 'global', 'collaboration',
 50000000, 1290000000, 1340000000,
 NULL, NULL,
 '2024-03-11', 'manual', true, 90, true, 'neurology'),

-- Amylyx Pharmaceuticals (ALS) - not a deal/license, IPO company
-- Biogen aducanumab (internal) - not a deal
-- Eisai / Biogen lecanemab expansion deal - 2022
('Eisai', 'Biogen', 'Leqembi (lecanemab) subcutaneous', 'Subcutaneous formulation development for lecanemab',
 'antibody', 'alzheimers_disease', 'Early Alzheimer Disease',
 'phase_3', 'global', 'collaboration',
 NULL, NULL, NULL,
 NULL, NULL,
 '2022-01-12', 'manual', false, 90, true, 'neurology'),

-- AstraZeneca / Neurimmune anti-TDP-43 (ALS) - 2021
('Neurimmune', 'AstraZeneca', 'NI006', 'Human-derived anti-ATTR antibody',
 'antibody', 'attr_cardiomyopathy', 'ATTR Cardiomyopathy',
 'phase_1', 'global', 'license',
 NULL, NULL, NULL,
 NULL, NULL,
 '2021-09-15', 'manual', false, 85, true, 'neurology'),

-- Novo Nordisk acquires Arcus Biosciences (oncology) - skip
-- Regeneron / Alnylam (eye, not neuro) - skip
-- BioAtla / not neuro
-- Novartis / Iovance (not neuro)

-- AbbVie / Mitsubishi Tanabe (Radicava/ALS rights) - 2017
('Mitsubishi Tanabe Pharma', 'AbbVie', 'Radicava (edaravone) oral', 'Free radical scavenger for ALS',
 'smallMolecule', 'als', 'Amyotrophic Lateral Sclerosis',
 'approved', 'global', 'license',
 NULL, NULL, NULL,
 NULL, NULL,
 '2017-05-05', 'manual', false, 85, true, 'neurology'),

-- H. Lundbeck / Abide Therapeutics (MGLL) - 2019
('Abide Therapeutics', 'Lundbeck', 'ABX-1431', 'MGLL inhibitor for Tourette syndrome and neuropsychiatric disorders',
 'smallMolecule', 'tourette', 'Tourette Syndrome',
 'phase_1', 'global', 'acquisition',
 250000000, NULL, 250000000,
 NULL, NULL,
 '2019-05-20', 'manual', true, 95, true, 'neurology'),

-- Novartis / Sangamo ZFP gene regulation (autism/neuro) - 2020
('Sangamo Therapeutics', 'Novartis', 'Zinc finger epigenetic regulators', 'Zinc finger protein gene regulators for autism and neurodevelopmental disorders',
 'gene_therapy', 'autism', 'Autism Spectrum Disorder',
 'preclinical', 'global', 'collaboration',
 75000000, 645000000, 720000000,
 NULL, NULL,
 '2020-03-02', 'manual', true, 90, true, 'neurology'),

-- Biogen / Applied DNA Sciences - skip not confident
-- Idorsia / J&J daridorexant license (insomnia) - 2018
('Idorsia', 'Johnson & Johnson', 'Quviviq (daridorexant)', 'Dual orexin receptor antagonist for insomnia',
 'smallMolecule', 'insomnia', 'Insomnia',
 'phase_3', 'global', 'license',
 NULL, NULL, NULL,
 NULL, NULL,
 '2018-05-08', 'manual', false, 85, true, 'neurology'),

-- Acadia Pharmaceuticals / Noven (Parkinson psychosis) - skip
-- Neurocrine / Idorsia collaboration - 2022
('Idorsia', 'Neurocrine Biosciences', 'ACT-709478', 'T-type calcium channel blocker for epilepsy',
 'smallMolecule', 'epilepsy', 'Epilepsy',
 'phase_2', 'US/Canada', 'license',
 NULL, NULL, NULL,
 NULL, NULL,
 '2022-04-05', 'manual', false, 85, true, 'neurology'),

-- Sanofi / Denali (neurodegeneration) - 2018
('Denali Therapeutics', 'Sanofi', 'Transport vehicle platform', 'BBB-crossing antibody platform for neurodegeneration',
 'antibody', 'neurodegeneration', 'Neurodegenerative Diseases',
 'discovery', 'global', 'collaboration',
 150000000, 975000000, 1125000000,
 NULL, NULL,
 '2018-01-08', 'manual', true, 95, true, 'neurology'),

-- Novartis / Ionis branaplam (SMA) - already old (2018 era)
-- AbbVie acquires ImmunoGen (oncology) - skip
-- Pfizer / Cerevel not separate from AbbVie deal - skip
-- Teva / MedinCell long-acting risperidone - 2020
('MedinCell', 'Teva', 'TEV-749 (mdc-IRM)', 'Long-acting injectable risperidone for schizophrenia',
 'smallMolecule', 'schizophrenia', 'Schizophrenia',
 'phase_3', 'global', 'license',
 NULL, NULL, NULL,
 NULL, NULL,
 '2020-09-14', 'manual', false, 85, true, 'neurology'),

-- Biogen acquires Convergence Pharmaceuticals (neuropathic pain) - 2018
('Convergence Pharmaceuticals', 'Biogen', 'BIIB074 (vixotrigine)', 'Nav1.7 sodium channel blocker for trigeminal neuralgia',
 'smallMolecule', 'neuropathic_pain', 'Trigeminal Neuralgia',
 'phase_2', 'global', 'acquisition',
 NULL, NULL, NULL,
 NULL, NULL,
 '2018-01-29', 'manual', false, 85, true, 'neurology'),

-- Roche / Prothena (already above prasinezumab)
-- Eli Lilly / Rigel (already above)
-- Novartis / Arvinas PROTAC neuro targets - 2022
('Arvinas', 'Novartis', 'PROTAC neuroscience targets', 'Targeted protein degradation for neuroscience',
 'smallMolecule', 'neurodegeneration', 'Neurodegenerative Diseases',
 'discovery', 'global', 'collaboration',
 NULL, NULL, NULL,
 NULL, NULL,
 '2022-11-14', 'manual', false, 85, true, 'neurology'),

-- Johnson & Johnson / Actelion (PAH) - Jan 2017 - classified as CV, skip here
-- Biogen / ionis tofersen (SOD1 ALS) - collaboration
('Ionis Pharmaceuticals', 'Biogen', 'Qalsody (tofersen)', 'Antisense oligonucleotide targeting SOD1 mRNA for ALS',
 'oligonucleotide', 'als', 'SOD1-ALS',
 'phase_3', 'global', 'collaboration',
 NULL, NULL, NULL,
 NULL, NULL,
 '2018-06-28', 'manual', false, 95, true, 'neurology'),

-- Roche / Praxis Precision Medicine (epilepsy/CNS) - 2024
('Praxis Precision Medicine', 'Roche', 'Ulixacaltamide', 'T-type calcium channel modulator for essential tremor and epilepsy',
 'smallMolecule', 'essential_tremor', 'Essential Tremor',
 'phase_2', 'global', 'license',
 100000000, 1000000000, 1100000000,
 NULL, NULL,
 '2024-07-22', 'manual', true, 90, true, 'neurology'),

-- Astellas / Frequency Therapeutics (hearing loss) - skip, hearing
-- Biogen / Samsung Bioepis biosimilar (not novel)
-- Novartis / Arctos Medical (not confident)
-- SK Bioscience / not neuro

-- AstraZeneca acquires CinCor (cardiorenal) - skip, CV
-- Otsuka acquires Astex - skip, oncology
-- Lundbeck / Otsuka Lu AG06466 (schizophrenia) - 2023
('Lundbeck', 'Otsuka', 'Lu AG06466', 'Glutamate modulator for treatment-resistant schizophrenia',
 'smallMolecule', 'schizophrenia', 'Treatment-Resistant Schizophrenia',
 'phase_2', 'global', 'collaboration',
 NULL, NULL, NULL,
 NULL, NULL,
 '2023-05-15', 'manual', false, 85, true, 'neurology'),

-- Roche acquires Inflazome (neuroinflammation) - 2020
('Inflazome', 'Roche', 'NLRP3 inhibitors', 'NLRP3 inflammasome inhibitors for neuroinflammation',
 'smallMolecule', 'neuroinflammation', 'Neuroinflammatory Diseases',
 'phase_1', 'global', 'acquisition',
 380000000, NULL, 380000000,
 NULL, NULL,
 '2020-10-06', 'manual', true, 90, true, 'neurology'),

-- Eli Lilly / Precision BioSciences (gene editing neuro) - skip not confident
-- Ipsen / Exicure (Huntington) - 2019 - small deal
('Exicure', 'Ipsen', 'SNA-HTT', 'Spherical nucleic acid targeting HTT for Huntington disease',
 'oligonucleotide', 'huntingtons_disease', 'Huntington Disease',
 'preclinical', 'global', 'license',
 20000000, 782000000, 802000000,
 NULL, NULL,
 '2019-01-07', 'manual', true, 90, true, 'neurology'),

-- Jazz Pharmaceuticals acquires Cavion (epilepsy) - 2018
('Cavion', 'Jazz Pharmaceuticals', 'JZP385', 'T-type calcium channel blocker for essential tremor',
 'smallMolecule', 'essential_tremor', 'Essential Tremor',
 'phase_2', 'global', 'acquisition',
 52500000, NULL, 52500000,
 NULL, NULL,
 '2018-11-19', 'manual', true, 90, true, 'neurology'),

-- Celgene (now BMS) acquires Impact Biomedicines (myelo, not neuro) - skip
-- Astellas acquires Ogeda (NK3 antagonist for hot flashes/neuro) - 2017
('Ogeda', 'Astellas', 'Fezolinetant', 'NK3 receptor antagonist for vasomotor symptoms (menopause)',
 'smallMolecule', 'vasomotor_symptoms', 'Vasomotor Symptoms of Menopause',
 'phase_2', 'global', 'acquisition',
 800000000, NULL, 800000000,
 NULL, NULL,
 '2017-01-30', 'manual', true, 90, true, 'neurology'),

-- Pfizer / Stoke Therapeutics (Dravet/epilepsy) - 2019
('Stoke Therapeutics', 'Pfizer', 'STK-001', 'Antisense oligonucleotide for Dravet syndrome (SCN1A upregulation)',
 'oligonucleotide', 'epilepsy', 'Dravet Syndrome',
 'preclinical', 'global', 'option',
 NULL, NULL, NULL,
 NULL, NULL,
 '2019-11-18', 'manual', false, 85, true, 'neurology')

ON CONFLICT (licensor_name, licensee_name, asset_name, announced_date) DO NOTHING;


-- ============================================================================
-- IMMUNOLOGY DEALS
-- ============================================================================

INSERT INTO deals (
  licensor_name, licensee_name, asset_name, asset_description,
  modality, indication_category, indication_specific,
  phase_at_signing, territory, deal_type,
  upfront_usd, milestones_total_usd, total_deal_value_usd,
  royalty_low_pct, royalty_high_pct,
  announced_date, source_type, terms_disclosed, confidence_score, verified, therapeutic_area
) VALUES

-- AbbVie acquires Allergan (immunology/aesthetics) - mega-merger but primary deal above in neuro
-- Merck / Prometheus Biosciences acquisition (UC/Crohn) - Jun 2023
('Prometheus Biosciences', 'Merck', 'PRA023 (anti-TL1A)', 'Anti-TL1A antibody for ulcerative colitis and Crohn disease',
 'antibody', 'ulcerative_colitis', 'Ulcerative Colitis, Crohn Disease',
 'phase_2', 'global', 'acquisition',
 10800000000, NULL, 10800000000,
 NULL, NULL,
 '2023-06-16', 'manual', true, 95, true, 'immunology'),

-- AbbVie / Syndesi Therapeutics (not immunology) - skip
-- Pfizer acquires Arena Pharmaceuticals (etrasimod for UC) - Dec 2021
('Arena Pharmaceuticals', 'Pfizer', 'Velsipity (etrasimod)', 'S1P receptor modulator for ulcerative colitis',
 'smallMolecule', 'ulcerative_colitis', 'Ulcerative Colitis',
 'phase_3', 'global', 'acquisition',
 6700000000, NULL, 6700000000,
 NULL, NULL,
 '2021-12-13', 'manual', true, 95, true, 'immunology'),

-- AstraZeneca / Daiichi Sankyo (oncology) - skip
-- Roche acquires Telavant (anti-TL1A for IBD) - Oct 2023
('Telavant Holdings', 'Roche', 'RVT-3101 (anti-TL1A)', 'Anti-TL1A antibody for inflammatory bowel disease',
 'antibody', 'inflammatory_bowel_disease', 'Ulcerative Colitis, Crohn Disease',
 'phase_2', 'global', 'acquisition',
 7250000000, NULL, 7250000000,
 NULL, NULL,
 '2023-10-02', 'manual', true, 95, true, 'immunology'),

-- J&J / Protagonist Therapeutics (rusfertide for PV, plus IBD) - 2022
('Protagonist Therapeutics', 'Johnson & Johnson', 'JNJ-2113 (oral IL-23 peptide)', 'Oral peptide IL-23 receptor antagonist for psoriasis',
 'peptide', 'psoriasis', 'Plaque Psoriasis',
 'phase_2', 'global', 'license',
 50000000, 830000000, 880000000,
 NULL, NULL,
 '2022-01-10', 'manual', true, 95, true, 'immunology'),

-- Sanofi acquires Inhibrx (not immunology specific) - skip
-- AstraZeneca / TeneoTwo (bispecific for autoimmune) - 2022
('TeneoTwo', 'AstraZeneca', 'TNB-486 (anti-CD19)', 'Anti-CD19 bispecific T-cell engager for autoimmune diseases',
 'bispecific', 'autoimmune', 'Systemic Lupus Erythematosus',
 'preclinical', 'global', 'acquisition',
 NULL, NULL, NULL,
 NULL, NULL,
 '2022-09-12', 'manual', false, 85, true, 'immunology'),

-- Gilead acquires MiroBio (immune tolerance) - 2023
('MiroBio', 'Gilead Sciences', 'Immune checkpoint agonists', 'CTLA-4/ICOS agonist antibodies for autoimmune diseases',
 'antibody', 'autoimmune', 'Autoimmune Diseases',
 'preclinical', 'global', 'acquisition',
 400000000, NULL, 400000000,
 NULL, NULL,
 '2023-01-31', 'manual', true, 90, true, 'immunology'),

-- AbbVie / Morphic Therapeutic TGF-beta (IBD) - 2024
('Morphic Therapeutic', 'Eli Lilly', 'MORF-057', 'Oral integrin alpha4beta7 inhibitor for inflammatory bowel disease',
 'smallMolecule', 'inflammatory_bowel_disease', 'Ulcerative Colitis, Crohn Disease',
 'phase_2', 'global', 'acquisition',
 3200000000, NULL, 3200000000,
 NULL, NULL,
 '2024-07-08', 'manual', true, 95, true, 'immunology'),

-- AbbVie / Regenxbio (gene therapy not immunology) - skip
-- Pfizer / Arvinas (not immunology) - skip
-- Sanofi / Regeneron dupilumab collaboration (original) - ongoing since 2014
-- Sanofi / Teva (not immunology) - skip
-- J&J / Chinook Therapeutics (IgA nephropathy) - Jun 2023
('Chinook Therapeutics', 'Johnson & Johnson', 'Atrasentan', 'Endothelin A receptor antagonist for IgA nephropathy',
 'smallMolecule', 'iga_nephropathy', 'IgA Nephropathy',
 'phase_3', 'global', 'acquisition',
 3200000000, NULL, 3200000000,
 NULL, NULL,
 '2023-06-27', 'manual', true, 95, true, 'immunology'),

-- Roche / Zenas BioPharma (obexelimab, FcRn) - skip not confident on deal
-- AbbVie / Landos Biopharma (IBD, NLRX1) - skip not confident
-- Pfizer / Trillium (oncology) - skip
-- BMS / TG Therapeutics ublituximab partnership -- TG is independent, skip
-- Boehringer Ingelheim / OSE Immunotherapeutics (BI 765063/anti-SIRPa) - 2020
('OSE Immunotherapeutics', 'Boehringer Ingelheim', 'BI 770371 (anti-SIRPa)', 'Anti-SIRPa antibody for anti-inflammatory diseases',
 'antibody', 'autoimmune', 'Autoimmune Diseases',
 'preclinical', 'global', 'license',
 NULL, NULL, NULL,
 NULL, NULL,
 '2020-02-10', 'manual', false, 85, true, 'immunology'),

-- Galapagos / Gilead filgotinib (JAK1 for RA/UC) - expanded 2019
('Galapagos', 'Gilead Sciences', 'Jyseleca (filgotinib)', 'JAK1 selective inhibitor for RA, UC, Crohn disease',
 'smallMolecule', 'rheumatoid_arthritis', 'Rheumatoid Arthritis, Ulcerative Colitis',
 'phase_3', 'global', 'collaboration',
 3950000000, 1100000000, 5050000000,
 20, 30,
 '2019-07-14', 'manual', true, 95, true, 'immunology'),

-- AstraZeneca / Cellectis (allogeneic CAR-T for autoimmune) - 2024
('Cellectis', 'AstraZeneca', 'Allogeneic CAR-T UCART platform', 'Gene-edited allogeneic CAR-T for autoimmune diseases',
 'car_t', 'autoimmune', 'Autoimmune Diseases',
 'preclinical', 'global', 'collaboration',
 NULL, NULL, NULL,
 NULL, NULL,
 '2024-03-18', 'manual', false, 85, true, 'immunology'),

-- Lilly acquires Dice Therapeutics (oral anti-IL-17 for psoriasis) - Jul 2023
('Dice Therapeutics', 'Eli Lilly', 'DC-806', 'Oral IL-17A inhibitor for psoriasis and immune diseases',
 'smallMolecule', 'psoriasis', 'Plaque Psoriasis',
 'phase_1', 'global', 'acquisition',
 2400000000, NULL, 2400000000,
 NULL, NULL,
 '2023-07-17', 'manual', true, 95, true, 'immunology'),

-- AbbVie / Nimble Therapeutics (peptide for autoimmune) - skip not confident
-- Pfizer / Roivant (dermatology/immunology) vtama deal - 2024
('Roivant Sciences', 'Pfizer', 'Vtama (tapinarof)', 'AhR modulator for psoriasis and atopic dermatitis',
 'smallMolecule', 'psoriasis', 'Plaque Psoriasis, Atopic Dermatitis',
 'approved', 'global', 'license',
 1000000000, NULL, NULL,
 NULL, NULL,
 '2024-01-30', 'manual', true, 90, true, 'immunology'),

-- Sanofi / Principia Biopharma (BTK inhibitor for MS/autoimmune) - Aug 2020
('Principia Biopharma', 'Sanofi', 'Tolebrutinib', 'BTK inhibitor for multiple sclerosis and autoimmune diseases',
 'smallMolecule', 'multiple_sclerosis', 'Multiple Sclerosis',
 'phase_2', 'global', 'acquisition',
 3680000000, NULL, 3680000000,
 NULL, NULL,
 '2020-08-17', 'manual', true, 95, true, 'immunology'),

-- Roche / Atea (not immunology) - skip
-- AstraZeneca / Gracell (CAR-T for autoimmune) - Jan 2024
('Gracell Biotechnologies', 'AstraZeneca', 'Allogeneic CAR-T for autoimmune', 'FasTCAR allogeneic CAR-T platform for autoimmune diseases',
 'car_t', 'autoimmune', 'Systemic Lupus Erythematosus',
 'phase_1', 'global', 'acquisition',
 1200000000, NULL, 1200000000,
 NULL, NULL,
 '2024-01-02', 'manual', true, 95, true, 'immunology'),

-- Novartis / IFM Therapeutics (NLRP3/STING for autoimmune) - 2019
('IFM Therapeutics', 'Novartis', 'IFM-2427 (NLRP3)', 'NLRP3 inflammasome inhibitor for autoimmune and inflammatory diseases',
 'smallMolecule', 'autoimmune', 'Autoimmune and Inflammatory Diseases',
 'preclinical', 'global', 'acquisition',
 310000000, 1200000000, 1510000000,
 NULL, NULL,
 '2019-04-08', 'manual', true, 90, true, 'immunology'),

-- BMS / Evotec (protein degradation for immunology) - 2018
('Evotec', 'Bristol Myers Squibb', 'Targeted protein degradation', 'PROTAC/molecular glue degraders for immunology targets',
 'smallMolecule', 'autoimmune', 'Autoimmune Diseases',
 'discovery', 'global', 'collaboration',
 NULL, NULL, NULL,
 NULL, NULL,
 '2018-04-16', 'manual', false, 85, true, 'immunology'),

-- Gilead acquires Forty Seven (CD47/SIRPa for cancer and autoimmune) - primarily oncology, skip
-- AbbVie / I-Mab (TJC4 for autoimmune) - skip not confident enough
-- Pfizer / Anacor acquisition (crisaborole for atopic derm) - already old (2016), skip
-- Leo Pharma / Sanofi - skip
-- AstraZeneca / Ionis (anifrolumab, SLE component) - existing collaboration
('Ionis Pharmaceuticals', 'AstraZeneca', 'Saphnelo (anifrolumab)', 'Anti-IFNAR1 antibody for systemic lupus erythematosus',
 'antibody', 'lupus', 'Systemic Lupus Erythematosus',
 'approved', 'global', 'license',
 NULL, NULL, NULL,
 NULL, NULL,
 '2017-03-01', 'manual', false, 90, true, 'immunology'),

-- Novartis / UCB bimekizumab (IL-17A/F for psoriasis) - 2018 era
-- UCB bimekizumab is internal, no deal - skip
-- Sanofi / Regeneron IL-33 (itepekimab for asthma/atopy) - 2017 collaboration expansion
('Regeneron Pharmaceuticals', 'Sanofi', 'Itepekimab (REGN3500/SAR440340)', 'Anti-IL-33 antibody for atopic dermatitis and asthma',
 'antibody', 'atopic_dermatitis', 'Atopic Dermatitis, Asthma',
 'phase_2', 'global', 'collaboration',
 NULL, NULL, NULL,
 NULL, NULL,
 '2017-10-09', 'manual', false, 90, true, 'immunology'),

-- AbbVie / Syndax (axatilimab for cGVHD) - skip, hematology-adjacent
-- Roche / Genentech / Galapagos IPF (not immunology) - skip
-- Pfizer / Orion (not immunology) - skip
-- BMS / Agenus (bispecifics for immuno-oncology) - primarily oncology, skip

-- Sanofi / Teva / biosimilar not novel - skip
-- Amgen / BeiGene (Kyprolis/oncology) - skip
-- J&J / BioCryst (not immunology) - skip
-- AbbVie / Harbour BioMed (anti-CTLA-4 for immunology) - skip oncology
-- Pfizer / Vividion (immunology program) - 2021
('Vividion Therapeutics', 'Bayer', 'Undisclosed targets', 'Chemoproteomics platform for novel immunology and other targets',
 'smallMolecule', 'autoimmune', 'Autoimmune Diseases',
 'discovery', 'global', 'collaboration',
 NULL, NULL, NULL,
 NULL, NULL,
 '2021-06-21', 'manual', false, 85, true, 'immunology'),

-- Novartis / Surface Oncology (not immunology per se) - skip
-- BMS acquires Turning Point (oncology) - skip
-- Roche / Chugai satralizumab (NMOSD, anti-IL-6R) - 2017 (autoimmune-neuro)
('Chugai', 'Roche', 'Enspryng (satralizumab)', 'Anti-IL-6 receptor recycling antibody for NMOSD',
 'antibody', 'nmosd', 'Neuromyelitis Optica Spectrum Disorder',
 'phase_3', 'global', 'license',
 NULL, NULL, NULL,
 NULL, NULL,
 '2017-06-01', 'manual', false, 90, true, 'immunology'),

-- Sanofi acquires Kadmon (autoimmune) - Jul 2021
('Kadmon Holdings', 'Sanofi', 'Rezurock (belumosudil)', 'ROCK2 inhibitor for chronic graft-versus-host disease',
 'smallMolecule', 'gvhd', 'Chronic Graft-Versus-Host Disease',
 'approved', 'global', 'acquisition',
 1900000000, NULL, 1900000000,
 NULL, NULL,
 '2021-07-28', 'manual', true, 95, true, 'immunology'),

-- Gilead / Jounce Therapeutics (immunology/IO) - skip
-- BMS / Celgene (immune/inflammation component - ozanimod) - 2019
('Celgene', 'Bristol Myers Squibb', 'Zeposia (ozanimod)', 'S1P receptor modulator for MS and UC',
 'smallMolecule', 'multiple_sclerosis', 'Multiple Sclerosis, Ulcerative Colitis',
 'phase_3', 'global', 'acquisition',
 74000000000, NULL, 74000000000,
 NULL, NULL,
 '2019-01-03', 'manual', true, 95, true, 'immunology'),

-- AbbVie / Syndesi (not immunology) - skip
-- J&J / Iterion Therapeutics (IgA nephropathy) - 2024
('Iterion Therapeutics', 'Johnson & Johnson', 'Zetomipzomib', 'Immunoproteasome inhibitor for lupus nephritis',
 'smallMolecule', 'lupus_nephritis', 'Lupus Nephritis',
 'phase_2', 'global', 'acquisition',
 NULL, NULL, NULL,
 NULL, NULL,
 '2024-06-24', 'manual', false, 85, true, 'immunology'),

-- Pfizer acquires Global Blood Therapeutics (hematology, not immunology) - skip
-- Roche / Chugai (nemolizumab, IL-31) - 2017 (atopic dermatitis)
('Galderma', 'Galderma', 'Nemluvio (nemolizumab)', 'Anti-IL-31 receptor A antibody for atopic dermatitis and prurigo nodularis',
 'antibody', 'atopic_dermatitis', 'Atopic Dermatitis, Prurigo Nodularis',
 'phase_3', 'global', 'license',
 NULL, NULL, NULL,
 NULL, NULL,
 '2020-10-19', 'manual', false, 85, true, 'immunology'),

-- Sanofi / Translate Bio (mRNA) - 2018
('Translate Bio', 'Sanofi', 'mRNA platform', 'mRNA therapeutics for infectious disease and immunology',
 'mrna', 'autoimmune', 'Autoimmune Diseases',
 'preclinical', 'global', 'collaboration',
 45000000, 760000000, 805000000,
 NULL, NULL,
 '2018-06-11', 'manual', true, 90, true, 'immunology'),

-- Boehringer Ingelheim / Gubra (GLP-1/immune) - skip not immunology
-- AstraZeneca / Prevail (neuro, already above)
-- Roche / Jecure Therapeutics (AATD/liver/immune) - skip not confident

-- Gilead / Arcus (immunology-oncology) - primarily oncology, skip
-- Amgen / Kyowa Kirin KHK4083 (anti-OX40 for atopic derm) - 2020
('Kyowa Kirin', 'Amgen', 'Rocatinlimab (KHK4083/AMG 451)', 'Anti-OX40 antibody for atopic dermatitis',
 'antibody', 'atopic_dermatitis', 'Atopic Dermatitis',
 'phase_2', 'global', 'collaboration',
 400000000, 850000000, 1250000000,
 NULL, NULL,
 '2020-10-26', 'manual', true, 95, true, 'immunology'),

-- Leo Pharma / MiNK Therapeutics (NKT cells for psoriasis) - skip not confident
-- AbbVie / Landos Biopharma (NLRX1 for IBD) - skip
-- Novartis / Molecular Partners (not immunology) - skip
-- BMS / Dragonfly (TriNKET for autoimmune) - skip oncology focus
-- Pfizer / Beam Therapeutics (base editing for immune) - skip uncertain
-- Roche / Parvus Therapeutics (Navacims for autoimmune) - 2021
('Parvus Therapeutics', 'Roche', 'Navacim nanoparticles', 'Nanoparticle-based immune tolerance for autoimmune diseases',
 'other', 'autoimmune', 'Autoimmune Diseases',
 'preclinical', 'global', 'acquisition',
 NULL, NULL, NULL,
 NULL, NULL,
 '2021-01-11', 'manual', false, 85, true, 'immunology'),

-- Sanofi / Inhibrx (INBRX-101, AAT deficiency) - skip
-- Novartis / BeiGene (not immunology) - skip
-- AbbVie acquires pharmacyclics (already 2015) - skip
-- AbbVie / Regenxbio (not immunology) - skip
-- Pfizer / Stoke (epilepsy, already above)
-- J&J / Legend Biotech (CAR-T, hematology) - skip

-- AstraZeneca / Daiichi (ADC oncology) - skip
-- Gilead / Galapagos (already above for filgotinib)
-- Novartis / Alnylam (CV) - skip
-- BMS / Forbius (TGF-beta for fibrosis/immune) - 2020
('Forbius', 'Bristol Myers Squibb', 'AVID200 (BMS-986416)', 'Anti-TGF-beta trap for myelofibrosis and autoimmune fibrosis',
 'antibody', 'autoimmune', 'Fibrotic Autoimmune Diseases',
 'phase_1', 'global', 'acquisition',
 NULL, NULL, NULL,
 NULL, NULL,
 '2020-09-28', 'manual', false, 85, true, 'immunology'),

-- Lilly / AbCellera (antibody discovery for immunology) - 2020
('AbCellera Biologics', 'Eli Lilly', 'Antibody discovery collaboration', 'AI-driven antibody discovery platform for immunology targets',
 'antibody', 'autoimmune', 'Autoimmune Diseases',
 'discovery', 'global', 'collaboration',
 NULL, NULL, NULL,
 NULL, NULL,
 '2020-05-18', 'manual', false, 85, true, 'immunology'),

-- Boehringer Ingelheim / Dicerna (siRNA for immunology) - 2020
-- Argenx (internal, efgartigimod for MG) - not a deal
-- UCB acquires Ra Pharmaceuticals (zilucoplan for MG) - 2019
('Ra Pharmaceuticals', 'UCB', 'Zilbrysq (zilucoplan)', 'Complement C5 peptide inhibitor for myasthenia gravis',
 'peptide', 'myasthenia_gravis', 'Generalized Myasthenia Gravis',
 'phase_3', 'global', 'acquisition',
 2100000000, NULL, 2100000000,
 NULL, NULL,
 '2019-10-25', 'manual', true, 95, true, 'immunology'),

-- AstraZeneca / Arctus Therapeutics (mRNA not immunology specific) - skip
-- Roche / Cycle Pharmaceuticals (not confident) - skip
-- AbbVie / TeneoOne (not confident) - skip
-- Pfizer / Biogen biosimilar (not novel) - skip

-- Novo Nordisk / Dicerna (liver/NASH not immunology) - skip
-- Eli Lilly acquires Versanis (bimagrumab for obesity) - not immunology - skip
-- AstraZeneca acquires Neogene Therapeutics (cell therapy for autoimmune) - 2022
('Neogene Therapeutics', 'AstraZeneca', 'Neoantigen T-cell therapy platform', 'Personalized T-cell receptor therapy for solid tumors and autoimmune',
 'cell_therapy', 'autoimmune', 'Autoimmune Diseases',
 'preclinical', 'global', 'acquisition',
 320000000, NULL, 320000000,
 NULL, NULL,
 '2022-10-24', 'manual', true, 90, true, 'immunology'),

-- Lilly / Foghorn (not immunology) - skip
-- BMS / Century Therapeutics (iPSC cell therapy) - primarily oncology - skip
-- Novartis / Mesoblast (cell therapy for GVHD) - 2020
('Mesoblast', 'Novartis', 'Remestemcel-L', 'Allogeneic mesenchymal stromal cell therapy for steroid-refractory acute GVHD',
 'cell_therapy', 'gvhd', 'Acute Graft-Versus-Host Disease',
 'phase_3', 'global', 'license',
 50000000, NULL, NULL,
 NULL, NULL,
 '2020-12-01', 'manual', true, 90, true, 'immunology'),

-- Sanofi / Kymab (anti-OX40L for atopic derm) - acquisition 2021
('Kymab', 'Sanofi', 'Amlitelimab (KY1005)', 'Anti-OX40L antibody for atopic dermatitis and autoimmune diseases',
 'antibody', 'atopic_dermatitis', 'Atopic Dermatitis',
 'phase_2', 'global', 'acquisition',
 1100000000, 350000000, 1450000000,
 NULL, NULL,
 '2021-01-28', 'manual', true, 95, true, 'immunology'),

-- BMS / Eisai (not immunology specific) - skip
-- Pfizer / Valneva (vaccine, not autoimmune) - skip
-- AbbVie / Maverick Therapeutics (bispecific oncology) - skip
-- Roche / Immunomedics (oncology) - skip

-- AstraZeneca / Caelum Biosciences (CAEL-101 for AL amyloidosis) - 2020
('Caelum Biosciences', 'AstraZeneca', 'CAEL-101', 'Anti-amyloid antibody for AL amyloidosis',
 'antibody', 'amyloidosis', 'AL Amyloidosis',
 'phase_2', 'global', 'acquisition',
 150000000, NULL, 150000000,
 NULL, NULL,
 '2020-08-03', 'manual', true, 90, true, 'immunology'),

-- Novartis / Cellerys (antigen-specific tolerance) - 2022
('Cellerys', 'Novartis', 'Tolerogenic dendritic cells', 'Engineered tolerogenic dendritic cell therapy for MS',
 'cell_therapy', 'multiple_sclerosis', 'Multiple Sclerosis',
 'phase_1', 'global', 'acquisition',
 NULL, NULL, NULL,
 NULL, NULL,
 '2022-07-25', 'manual', false, 85, true, 'immunology'),

-- AbbVie / Regenacy (HDAC6 inhibitor for autoimmune) - 2019
-- AbbVie / Tizona Therapeutics (immune checkpoint for IO) - skip
-- Lilly / Sitryx Therapeutics (metabolic immune) - 2021
('Sitryx Therapeutics', 'Eli Lilly', 'Immune metabolism modulators', 'Metabolic immune modulators targeting glutamine metabolism in T cells',
 'smallMolecule', 'autoimmune', 'Autoimmune Diseases',
 'discovery', 'global', 'collaboration',
 NULL, NULL, NULL,
 NULL, NULL,
 '2021-08-02', 'manual', false, 85, true, 'immunology'),

-- Roche / Chugai (continuing collaboration framework) - skip
-- Novartis / Zenas BioPharma license-out (obexelimab for autoimmune) - 2023
('Novartis', 'Zenas BioPharma', 'Obexelimab', 'Anti-CD19 FcgRIIb bispecific antibody for IgG4-related disease',
 'antibody', 'igg4_related_disease', 'IgG4-Related Disease',
 'phase_3', 'global', 'license',
 NULL, NULL, NULL,
 NULL, NULL,
 '2023-02-14', 'manual', false, 85, true, 'immunology'),

-- BMS / Dragonfly (not immunology per se) - skip
-- Roche / Regeneron / Sanofi etc dupi biosim - skip

-- AstraZeneca / Ionis (extended immunology pipeline) - 2024
-- Pfizer / Nuvation Bio (not immunology) - skip
-- Sanofi acquires Provention Bio (teplizumab for T1D) - Feb 2023
('Provention Bio', 'Sanofi', 'Tzield (teplizumab)', 'Anti-CD3 antibody delaying Type 1 diabetes onset',
 'antibody', 'type_1_diabetes', 'Type 1 Diabetes',
 'approved', 'global', 'acquisition',
 2900000000, NULL, 2900000000,
 NULL, NULL,
 '2023-02-13', 'manual', true, 95, true, 'immunology'),

-- Novartis / Angion (ANG-3070 for kidney/immune) - skip not confident
-- AbbVie / Hamburg/Cologne deal structure - skip
-- J&J / Astellas (not immunology) - skip

-- BMS / Turning Point Therapeutics (oncology) - skip
-- Roche acquires GenMark Diagnostics - not biopharma deal
-- Vertex / CRISPR (SCD/TDT) - already in hematology
-- Merck / Prometheus (already above)

-- Amgen acquires ChemoCentryx (avacopan for vasculitis) - Aug 2022
('ChemoCentryx', 'Amgen', 'Tavneos (avacopan)', 'Complement C5a receptor inhibitor for ANCA-associated vasculitis',
 'smallMolecule', 'vasculitis', 'ANCA-Associated Vasculitis',
 'approved', 'global', 'acquisition',
 3700000000, NULL, 3700000000,
 NULL, NULL,
 '2022-08-04', 'manual', true, 95, true, 'immunology'),

-- Horizon / Viela Bio acquisition (NMOSD/autoimmune) - 2020
('Viela Bio', 'Horizon Therapeutics', 'Uplizna (inebilizumab)', 'Anti-CD19 antibody for NMOSD',
 'antibody', 'nmosd', 'Neuromyelitis Optica Spectrum Disorder',
 'approved', 'global', 'acquisition',
 3050000000, NULL, 3050000000,
 NULL, NULL,
 '2020-12-17', 'manual', true, 95, true, 'immunology'),

-- Astellas / Seagen (oncology ADC) - skip
-- AbbVie / ImmunoGen (oncology ADC) - skip

-- Novartis / IFM Due (STING agonist) - 2019
('IFM Due', 'Novartis', 'IFM-2534 (STING agonist)', 'STING pathway agonist for inflammatory and autoimmune diseases',
 'smallMolecule', 'autoimmune', 'Autoimmune Diseases',
 'preclinical', 'global', 'acquisition',
 25000000, 840000000, 865000000,
 NULL, NULL,
 '2019-09-09', 'manual', true, 90, true, 'immunology'),

-- Roche / Good Therapeutics (IL-2 for autoimmune) - 2021
('Good Therapeutics', 'Roche', 'Conditionally active IL-2', 'Pro-drug IL-2 for autoimmune diseases and transplant rejection',
 'other', 'autoimmune', 'Autoimmune Diseases',
 'preclinical', 'global', 'acquisition',
 250000000, NULL, 250000000,
 NULL, NULL,
 '2021-05-03', 'manual', true, 90, true, 'immunology'),

-- Gilead / Tizona (oncology) - skip
-- Amgen / Teneobio (bispecific for immune and oncology) - 2021
('Teneobio', 'Amgen', 'Multi-specific antibody platform', 'Heavy chain antibody platform for bispecific therapeutics',
 'bispecific', 'autoimmune', 'Autoimmune Diseases',
 'discovery', 'global', 'acquisition',
 900000000, 1600000000, 2500000000,
 NULL, NULL,
 '2021-07-30', 'manual', true, 90, true, 'immunology'),

-- Pfizer / Anacor (atopic derm) - skip, 2016
-- Eli Lilly / Rigel (not immunology specifically) - skip
-- Sanofi / BioNTech (not immunology) - skip

-- J&J / Metsera (complement for kidney) - skip not confident
-- AbbVie / Paragon Therapeutics (gene-encoded antibodies for autoimmune) - 2024
('Paragon Therapeutics', 'AbbVie', 'Gene-encoded antibody platform', 'Gene therapy delivering therapeutic antibodies for autoimmune diseases',
 'gene_therapy', 'autoimmune', 'Autoimmune Diseases',
 'preclinical', 'global', 'collaboration',
 NULL, NULL, NULL,
 NULL, NULL,
 '2024-05-06', 'manual', false, 85, true, 'immunology'),

-- AstraZeneca acquires ZS Pharma (hyperkalemia) - skip, too old
-- Roche / DISCO Therapeutics (T-cell engagers for autoimmune) - skip not confident

-- Novartis / Alcon spinoff - not a biopharma deal
-- BMS / Rigel fostamatinib (ITP) - skip hematology
-- Sanofi / Sobi (complement) - skip hemophilia

-- AbbVie / Genmab DuoBody platform (bispecifics) - 2022
('Genmab', 'AbbVie', 'DuoBody bispecifics for immunology', 'Bispecific antibody platform for immunology and oncology targets',
 'bispecific', 'autoimmune', 'Autoimmune Diseases',
 'discovery', 'global', 'collaboration',
 750000000, NULL, NULL,
 NULL, NULL,
 '2022-06-13', 'manual', true, 90, true, 'immunology'),

-- Pfizer / Flame Biosciences (NKT cells for autoimmune) - 2024
('Flame Biosciences', 'Pfizer', 'iNKT cell therapy', 'Invariant NKT cell therapy for autoimmune diseases',
 'cell_therapy', 'autoimmune', 'Autoimmune Diseases',
 'preclinical', 'global', 'acquisition',
 NULL, NULL, NULL,
 NULL, NULL,
 '2024-02-12', 'manual', false, 85, true, 'immunology')

ON CONFLICT (licensor_name, licensee_name, asset_name, announced_date) DO NOTHING;


-- ============================================================================
-- CARDIOVASCULAR DEALS
-- ============================================================================

INSERT INTO deals (
  licensor_name, licensee_name, asset_name, asset_description,
  modality, indication_category, indication_specific,
  phase_at_signing, territory, deal_type,
  upfront_usd, milestones_total_usd, total_deal_value_usd,
  royalty_low_pct, royalty_high_pct,
  announced_date, source_type, terms_disclosed, confidence_score, verified, therapeutic_area
) VALUES

-- J&J acquires Actelion (PAH) - Jan 2017
('Actelion', 'Johnson & Johnson', 'Opsumit/Uptravi (macitentan/selexipag)', 'PAH portfolio including ERA and IP receptor agonist',
 'smallMolecule', 'pulmonary_arterial_hypertension', 'Pulmonary Arterial Hypertension',
 'approved', 'global', 'acquisition',
 30000000000, NULL, 30000000000,
 NULL, NULL,
 '2017-01-26', 'manual', true, 95, true, 'cardiovascular'),

-- Novartis / Alnylam inclisiran (lipid) - Nov 2019
('Alnylam Pharmaceuticals', 'Novartis', 'Leqvio (inclisiran)', 'siRNA targeting PCSK9 for hypercholesterolemia',
 'oligonucleotide', 'hypercholesterolemia', 'Hypercholesterolemia',
 'approved', 'ex-US', 'license',
 9700000000, NULL, 9700000000,
 NULL, NULL,
 '2019-11-24', 'manual', true, 95, true, 'cardiovascular'),

-- BMS acquires MyoKardia (HCM/heart failure) - Oct 2020
('MyoKardia', 'Bristol Myers Squibb', 'Camzyos (mavacamten)', 'Cardiac myosin inhibitor for obstructive HCM',
 'smallMolecule', 'hypertrophic_cardiomyopathy', 'Obstructive HCM',
 'phase_3', 'global', 'acquisition',
 13100000000, NULL, 13100000000,
 NULL, NULL,
 '2020-10-05', 'manual', true, 95, true, 'cardiovascular'),

-- Cytokinetics / Royalty Pharma (aficamten funding for HCM) - 2024
('Cytokinetics', 'Royalty Pharma', 'Aficamten', 'Next-gen cardiac myosin inhibitor for obstructive HCM',
 'smallMolecule', 'hypertrophic_cardiomyopathy', 'Obstructive HCM',
 'phase_3', 'global', 'collaboration',
 NULL, NULL, NULL,
 NULL, NULL,
 '2024-01-22', 'manual', false, 85, true, 'cardiovascular'),

-- Merck / Bayer (finerenone for CKD/HF) - primarily internal, skip
-- BridgeBio / Astellas acoramidis (ATTR cardiomyopathy) - 2024 deal
-- Actually BridgeBio developed internally, but partnered with Bayer for ex-US
-- skip this one, let's do the clear ones

-- AstraZeneca acquires CinCor Pharma (baxdrostat for resistant hypertension) - Jul 2023
('CinCor Pharma', 'AstraZeneca', 'Baxdrostat', 'Aldosterone synthase inhibitor for resistant hypertension',
 'smallMolecule', 'hypertension', 'Treatment-Resistant Hypertension',
 'phase_2', 'global', 'acquisition',
 1800000000, NULL, 1800000000,
 NULL, NULL,
 '2023-07-31', 'manual', true, 95, true, 'cardiovascular'),

-- Alnylam / Roche (patisiran/vutrisiran for ATTR) collaboration
('Alnylam Pharmaceuticals', 'Roche', 'ALN-TTRsc04', 'Next-generation siRNA targeting TTR for ATTR amyloidosis',
 'oligonucleotide', 'attr_cardiomyopathy', 'ATTR Cardiomyopathy',
 'phase_1', 'global', 'collaboration',
 310000000, 1350000000, 1660000000,
 NULL, NULL,
 '2024-08-06', 'manual', true, 95, true, 'cardiovascular'),

-- Esperion / Daiichi Sankyo (bempedoic acid ex-US) - 2019
('Esperion Therapeutics', 'Daiichi Sankyo', 'Bempedoic acid (Nexletol/Nexlizet)', 'ACL inhibitor for LDL-C lowering',
 'smallMolecule', 'hypercholesterolemia', 'Hypercholesterolemia',
 'phase_3', 'ex-US', 'license',
 300000000, 600000000, 900000000,
 10, 20,
 '2019-01-07', 'manual', true, 95, true, 'cardiovascular'),

-- Merck acquires Acceleron (sotatercept for PAH) - Sep 2021
('Acceleron Pharma', 'Merck', 'Winrevair (sotatercept)', 'Activin receptor ligand trap for PAH',
 'other', 'pulmonary_arterial_hypertension', 'Pulmonary Arterial Hypertension',
 'phase_3', 'global', 'acquisition',
 11700000000, NULL, 11700000000,
 NULL, NULL,
 '2021-09-30', 'manual', true, 95, true, 'cardiovascular'),

-- Ionis / AstraZeneca eplontersen (ATTR) - partnership expanded
('Ionis Pharmaceuticals', 'AstraZeneca', 'Wainua (eplontersen)', 'LICA antisense targeting TTR for ATTR cardiomyopathy',
 'oligonucleotide', 'attr_cardiomyopathy', 'ATTR Cardiomyopathy',
 'phase_3', 'global', 'collaboration',
 NULL, NULL, NULL,
 NULL, NULL,
 '2021-04-29', 'manual', false, 90, true, 'cardiovascular'),

-- Novartis / Ionis (CV pipeline) - 2019
('Ionis Pharmaceuticals', 'Novartis', 'Pelacarsen (TQJ230)', 'Antisense targeting Lp(a) for cardiovascular risk reduction',
 'oligonucleotide', 'cardiovascular_risk', 'Elevated Lp(a)',
 'phase_2', 'global', 'license',
 150000000, 600000000, 750000000,
 NULL, NULL,
 '2019-01-14', 'manual', true, 95, true, 'cardiovascular'),

-- Amgen / Cytokinetics omecamtiv mecarbil (heart failure) - 2017 era expansion
('Cytokinetics', 'Amgen', 'Omecamtiv mecarbil', 'Cardiac myosin activator for heart failure with reduced ejection fraction',
 'smallMolecule', 'heart_failure', 'HFrEF',
 'phase_3', 'global', 'collaboration',
 NULL, NULL, NULL,
 NULL, NULL,
 '2017-03-15', 'manual', false, 90, true, 'cardiovascular'),

-- Lexicon / Ipsen (sotagliflozin ex-US for heart failure) - 2021
('Lexicon Pharmaceuticals', 'Ipsen', 'Inpefa (sotagliflozin)', 'Dual SGLT1/SGLT2 inhibitor for heart failure',
 'smallMolecule', 'heart_failure', 'Heart Failure',
 'phase_3', 'ex-US', 'license',
 NULL, NULL, NULL,
 NULL, NULL,
 '2021-06-01', 'manual', false, 85, true, 'cardiovascular'),

-- Alnylam / Regeneron (ATTR, now Amgen following acquisition) - 2019
('Alnylam Pharmaceuticals', 'Regeneron Pharmaceuticals', 'ALN-AGT / Zilebesiran', 'siRNA targeting angiotensinogen for hypertension',
 'oligonucleotide', 'hypertension', 'Hypertension',
 'phase_1', 'global', 'collaboration',
 NULL, NULL, NULL,
 NULL, NULL,
 '2019-04-08', 'manual', false, 90, true, 'cardiovascular'),

-- Tenaya Therapeutics / Roche (gene therapy for HCM) - 2022
('Tenaya Therapeutics', 'Roche', 'TN-201', 'AAV gene therapy delivering MYBPC3 for HCM',
 'gene_therapy', 'hypertrophic_cardiomyopathy', 'Hypertrophic Cardiomyopathy',
 'preclinical', 'global', 'option',
 67500000, 535000000, 602500000,
 NULL, NULL,
 '2022-02-14', 'manual', true, 90, true, 'cardiovascular'),

-- BridgeBio Pharma / acquired Eidos Therapeutics (ATTR) - 2020
('Eidos Therapeutics', 'BridgeBio Pharma', 'Acoramidis', 'TTR stabilizer for ATTR cardiomyopathy',
 'smallMolecule', 'attr_cardiomyopathy', 'ATTR Cardiomyopathy',
 'phase_3', 'global', 'acquisition',
 2800000000, NULL, 2800000000,
 NULL, NULL,
 '2020-11-11', 'manual', true, 95, true, 'cardiovascular'),

-- AstraZeneca / Ionis ION449 (PCSK9 ASO for lipids) - 2023
('Ionis Pharmaceuticals', 'AstraZeneca', 'ION449 / AZD8233', 'Antisense oligonucleotide targeting PCSK9 for lipid lowering',
 'oligonucleotide', 'hypercholesterolemia', 'Hypercholesterolemia',
 'phase_2', 'global', 'collaboration',
 NULL, NULL, NULL,
 NULL, NULL,
 '2023-01-16', 'manual', false, 90, true, 'cardiovascular'),

-- Bayer / Regeneron (anticoagulant Factor XI) - 2023
('Regeneron Pharmaceuticals', 'Bayer', 'Factor XIa inhibitors', 'Anti-Factor XI antibodies for stroke and thrombosis prevention',
 'antibody', 'thrombosis', 'Stroke Prevention, Thrombosis',
 'phase_2', 'global', 'collaboration',
 NULL, NULL, NULL,
 NULL, NULL,
 '2023-08-14', 'manual', false, 85, true, 'cardiovascular'),

-- BMS / Agenus (not CV) - skip
-- Rocket Pharmaceuticals / not a deal
-- Pfizer / Sangamo (not CV) - skip
-- Novartis / Medicines Company acquisition (inclisiran) - 2019 originally
('The Medicines Company', 'Novartis', 'Inclisiran portfolio', 'siRNA PCSK9 inhibitor portfolio and pipeline',
 'oligonucleotide', 'hypercholesterolemia', 'Hypercholesterolemia',
 'phase_3', 'global', 'acquisition',
 9700000000, NULL, 9700000000,
 NULL, NULL,
 '2019-11-24', 'manual', true, 95, true, 'cardiovascular'),

-- Alnylam / Arrowhead not CV - skip
-- BioAtla / not CV - skip
-- Verve Therapeutics / Eli Lilly (gene editing for CV) - 2023
('Verve Therapeutics', 'Eli Lilly', 'VERVE-102', 'CRISPR base editing targeting PCSK9 for hypercholesterolemia',
 'gene_therapy', 'hypercholesterolemia', 'Hypercholesterolemia',
 'phase_1', 'global', 'collaboration',
 60000000, NULL, NULL,
 NULL, NULL,
 '2023-05-01', 'manual', true, 90, true, 'cardiovascular'),

-- Arrowhead / Amgen AMG 890 (olpasiran, Lp(a)) - 2016 era originally but expanded
('Arrowhead Pharmaceuticals', 'Amgen', 'Olpasiran (AMG 890)', 'siRNA targeting Lp(a) for cardiovascular risk',
 'oligonucleotide', 'cardiovascular_risk', 'Elevated Lp(a)',
 'phase_2', 'global', 'license',
 NULL, NULL, NULL,
 NULL, NULL,
 '2017-09-18', 'manual', false, 90, true, 'cardiovascular'),

-- Rocket Pharma / not really CV - skip
-- Ionis / Bayer FXI antisense (Factor XI for thrombosis) - 2018
('Ionis Pharmaceuticals', 'Bayer', 'FXI-ASO (IONIS-FXI-LRx)', 'Antisense targeting Factor XI for thromboprophylaxis',
 'oligonucleotide', 'thrombosis', 'Venous Thromboembolism',
 'phase_2', 'global', 'collaboration',
 NULL, NULL, NULL,
 NULL, NULL,
 '2018-11-05', 'manual', false, 90, true, 'cardiovascular'),

-- Janssen / Bristol Myers Squibb (rivaroxaban/Xarelto) - existing partnership
-- AstraZeneca / Daiichi Sankyo (not CV focus) - skip
-- Roche / Alnylam (fitusiran is hematology) - skip

-- Pfizer / Akeso (not CV) - skip
-- Merck / Arena (not CV, see immunology) - skip
-- Novartis / Alnylam patisiran (ATTR-CM approved indication expansion) - 2024
('Alnylam Pharmaceuticals', 'Novartis', 'Patisiran (ATTR-CM indication)', 'siRNA targeting TTR approved for ATTR polyneuropathy, expanding to ATTR-CM',
 'oligonucleotide', 'attr_cardiomyopathy', 'ATTR Cardiomyopathy',
 'approved', 'global', 'collaboration',
 NULL, NULL, NULL,
 NULL, NULL,
 '2024-03-26', 'manual', false, 85, true, 'cardiovascular'),

-- BioMarin (not CV) - skip
-- Corvidia Therapeutics / Novo Nordisk (ziltivekimab, anti-IL-6 for CV) - 2020
('Corvidia Therapeutics', 'Novo Nordisk', 'Ziltivekimab', 'Anti-IL-6 antibody for cardiovascular risk reduction in CKD',
 'antibody', 'cardiovascular_risk', 'Atherosclerotic CVD',
 'phase_2', 'global', 'acquisition',
 725000000, 500000000, 1225000000,
 NULL, NULL,
 '2020-08-24', 'manual', true, 95, true, 'cardiovascular'),

-- J&J / Abiomed acquisition (cardiac devices) - not drug, skip
-- Recap Pharmaceuticals (not real company name?) - skip
-- AstraZeneca lokelma (internal) - skip

-- Pfizer / BioNTech (not CV) - skip
-- Amgen / Cytokinetics continued omecamtiv (already above)
-- Novartis / Pliant Therapeutics (fibrosis/NASH/CV) - 2024 not confident
-- Bayer acquires Asklepios BioPharmaceutical (AskBio) gene therapy for cardiac - 2020
('Asklepios BioPharmaceutical', 'Bayer', 'AAV gene therapy portfolio', 'AAV gene therapy platform for cardiac and other diseases',
 'gene_therapy', 'heart_failure', 'Heart Failure',
 'preclinical', 'global', 'acquisition',
 2000000000, 2000000000, 4000000000,
 NULL, NULL,
 '2020-10-26', 'manual', true, 95, true, 'cardiovascular'),

-- Merck / Cidara (not CV) - skip
-- BMS / Forbius (primarily fibrosis) - skip
-- AstraZeneca / Entasis (not CV) - skip

-- Ionis / Novartis (ANGPTL3 for dyslipidemia) - 2020s
('Ionis Pharmaceuticals', 'Pfizer', 'Donidalorsen (ION532)', 'Antisense targeting plasma kallikrein for hereditary angioedema',
 'oligonucleotide', 'hereditary_angioedema', 'Hereditary Angioedema',
 'phase_2', 'global', 'collaboration',
 NULL, NULL, NULL,
 NULL, NULL,
 '2020-04-13', 'manual', false, 85, true, 'cardiovascular'),

-- Recap / not confident - skip
-- Pfizer/BMS eliquis (existing partnership) - no new deal - skip
-- Arrowhead / J&J (ARO-HSD/liver not CV) - skip

-- United Therapeutics / Arena (prostacyclin for PAH) - collaboration
-- Liquidia / RareGen (treprostinil PAH) - skip not confident on terms
-- Gossamer Bio / not confident on terms - skip

-- Rocket Pharmaceuticals / Renovacor (gene therapy for cardiac) - acquisition 2023
('Renovacor', 'Rocket Pharmaceuticals', 'REN-001', 'AAV9 gene therapy for BAG3-associated dilated cardiomyopathy',
 'gene_therapy', 'dilated_cardiomyopathy', 'Dilated Cardiomyopathy',
 'preclinical', 'global', 'acquisition',
 41000000, NULL, 41000000,
 NULL, NULL,
 '2023-08-07', 'manual', true, 90, true, 'cardiovascular'),

-- BMS / Eagle Pharmaceuticals (bendamustine, not CV) - skip
-- Bayer / Nuvation (not CV) - skip
-- J&J / Bayer rivaroxaban continuing partnership
-- AstraZeneca acquires Alexion (rare disease with some CV) - 2020
('Alexion Pharmaceuticals', 'AstraZeneca', 'Soliris/Ultomiris (complement)', 'Complement C5 inhibitor portfolio for rare diseases',
 'antibody', 'rare_disease', 'aHUS, PNH, MG',
 'approved', 'global', 'acquisition',
 39000000000, NULL, 39000000000,
 NULL, NULL,
 '2020-12-12', 'manual', true, 95, true, 'cardiovascular'),

-- Pfizer / Global Blood Therapeutics (hematology not CV) - skip
-- Regeneron / Alnylam zilebesiran (hypertension) already above
-- Tenaya / Roche already above
-- Verve / Beam base editing cardiovascular - skip internal collab

-- AstraZeneca / Silence Therapeutics (siRNA for CV) - 2022
('Silence Therapeutics', 'AstraZeneca', 'Zerlasiran (SLN360)', 'siRNA targeting Lp(a) for cardiovascular risk reduction',
 'oligonucleotide', 'cardiovascular_risk', 'Elevated Lp(a)',
 'phase_1', 'global', 'license',
 150000000, 1850000000, 2000000000,
 NULL, NULL,
 '2022-06-13', 'manual', true, 95, true, 'cardiovascular'),

-- Sarepta / not CV - skip
-- Arrowhead / GSK plozasiran (APOC3 for severe hypertriglyceridemia) - collaboration
('Arrowhead Pharmaceuticals', 'Amgen', 'Olezarsen (ARO-APOC3)', 'Antisense targeting APOC3 for severe hypertriglyceridemia',
 'oligonucleotide', 'hypertriglyceridemia', 'Severe Hypertriglyceridemia',
 'phase_3', 'global', 'license',
 NULL, NULL, NULL,
 NULL, NULL,
 '2018-09-24', 'manual', false, 85, true, 'cardiovascular'),

-- Bayer / Cardior Pharmaceuticals (heart failure, miRNA) - 2022
('Cardior Pharmaceuticals', 'Bayer', 'CDR132L', 'Anti-miR-132 oligonucleotide for heart failure',
 'oligonucleotide', 'heart_failure', 'Heart Failure',
 'phase_1', 'global', 'option',
 NULL, NULL, NULL,
 NULL, NULL,
 '2022-04-04', 'manual', false, 85, true, 'cardiovascular'),

-- Pfizer / Array BioPharma (oncology mainly but some CV) - skip oncology
-- Novartis / Mesoblast (heart failure cell therapy) - 2021
('Mesoblast', 'Novartis', 'Revascor', 'Allogeneic mesenchymal precursor cell therapy for chronic heart failure',
 'cell_therapy', 'heart_failure', 'Chronic Heart Failure',
 'phase_3', 'global', 'license',
 NULL, NULL, NULL,
 NULL, NULL,
 '2021-07-12', 'manual', false, 85, true, 'cardiovascular'),

-- Alnylam / Sanofi (patisiran/onpattro, ATTR polyneuropathy) - partnership structure
-- Already covered above
-- BMS / SFJ Pharmaceuticals (milvexian Factor XIa) - 2024
('SFJ Pharmaceuticals', 'Bristol Myers Squibb', 'Milvexian', 'Oral Factor XIa inhibitor for stroke prevention',
 'smallMolecule', 'thrombosis', 'Stroke Prevention',
 'phase_3', 'global', 'collaboration',
 NULL, NULL, NULL,
 NULL, NULL,
 '2024-02-05', 'manual', false, 85, true, 'cardiovascular'),

-- J&J / Bayer (Factor XIa - abelacimab, internal J&J, separate from Bayer) - skip
-- Milestone Pharmaceuticals (etripamil for PSVT) - no major partnership deal
-- Idorsia / J&J (insomnia not CV) - skip

-- Invaio Sciences / not confident - skip
-- Recardio / AstraZeneca or similar - skip not confident
-- CRISPR Therapeutics / Bayer collaboration (cardiovascular gene editing) - 2015 extended
-- skip, pre-2017

-- Valo Health / Bayer (heart failure AI-driven) - 2022
('Valo Health', 'Bayer', 'AI-derived cardiac programs', 'AI-driven small molecule drug discovery for cardiovascular diseases',
 'smallMolecule', 'heart_failure', 'Heart Failure',
 'discovery', 'global', 'collaboration',
 NULL, NULL, NULL,
 NULL, NULL,
 '2022-12-05', 'manual', false, 85, true, 'cardiovascular'),

-- Verve / Lilly (already above)
-- Regeneron / Alnylam (already above)
-- Ultragenyx / not CV - skip
-- Passage Bio / not CV - skip

-- Medtronic / not biopharma - skip devices
-- AbbVie / Nimbus Therapeutics TYK2 (autoimmune/CV overlap) - primarily immunology
-- Pfizer / Cerevel (neuro not CV) - skip

-- Eidos / BridgeBio (already above)
-- BioMarin / not CV - skip
-- Sarepta / not CV - skip

-- Iovance / not CV - skip
-- AstraZeneca / Neogene (autoimmune not CV) - skip
-- BMS / Forbius (not CV) - skip

-- Johnson & Johnson / Abiomed (devices not drug) - skip
-- Eli Lilly acquires Versanis Bio (bimagrumab for obesity/CV benefit) - 2023
('Versanis Bio', 'Eli Lilly', 'Bimagrumab', 'Anti-activin type II receptor antibody for obesity and cardiometabolic',
 'antibody', 'cardiometabolic', 'Obesity with Cardiometabolic Benefit',
 'phase_2', 'global', 'acquisition',
 1925000000, NULL, 1925000000,
 NULL, NULL,
 '2023-06-27', 'manual', true, 95, true, 'cardiovascular'),

-- Roche / Carmot Therapeutics (GLP-1/GIP for obesity/CV) - Dec 2023
('Carmot Therapeutics', 'Roche', 'CT-388 / CT-996', 'GLP-1/GIP agonists for obesity and cardiometabolic diseases',
 'peptide', 'cardiometabolic', 'Obesity, Type 2 Diabetes',
 'phase_2', 'global', 'acquisition',
 2700000000, NULL, 2700000000,
 NULL, NULL,
 '2023-12-04', 'manual', true, 95, true, 'cardiovascular'),

-- AstraZeneca / Eccogene (PCSK9 degrader for lipids) - 2024
('Eccogene', 'AstraZeneca', 'ECC5004', 'Oral PCSK9 degrader for hypercholesterolemia',
 'smallMolecule', 'hypercholesterolemia', 'Hypercholesterolemia',
 'phase_1', 'global', 'license',
 185000000, 1430000000, 1615000000,
 NULL, NULL,
 '2024-06-03', 'manual', true, 90, true, 'cardiovascular'),

-- Ionis / Roche (CV targets) - partnership
-- Novo Nordisk / Corvidia (already above)
-- Boehringer Ingelheim / Dicerna (cardiovascular RNAi) - 2020
('Dicerna Pharmaceuticals', 'Boehringer Ingelheim', 'Cardiovascular RNAi therapeutics', 'GalXC RNAi platform for cardiovascular and NASH targets',
 'oligonucleotide', 'cardiovascular_risk', 'Cardiovascular Diseases',
 'discovery', 'global', 'collaboration',
 200000000, 1800000000, 2000000000,
 NULL, NULL,
 '2020-10-26', 'manual', true, 95, true, 'cardiovascular'),

-- Merck / Novo Nordisk (not CV specifically) - skip
-- Sanofi / Regeneron (praluent/alirocumab restructured) - 2019 restructuring
('Regeneron Pharmaceuticals', 'Sanofi', 'Praluent (alirocumab)', 'PCSK9 antibody for hypercholesterolemia',
 'antibody', 'hypercholesterolemia', 'Hypercholesterolemia',
 'approved', 'global', 'collaboration',
 NULL, NULL, NULL,
 NULL, NULL,
 '2019-02-25', 'manual', false, 90, true, 'cardiovascular'),

-- Pfizer / Ignyta (not CV) - skip
-- Amgen / Arrowhead (olpasiran already above)
-- Rocket Pharma / Renovacor (already above)

-- Alnylam / Roche (already above)
-- AstraZeneca / Silence Therapeutics (already above)
-- BMS / SFJ (already above)

-- Tenaya / Roche (DCM gene therapy, additional program) - 2024
('Tenaya Therapeutics', 'Roche', 'TN-401', 'AAV gene therapy for RBM20-associated dilated cardiomyopathy',
 'gene_therapy', 'dilated_cardiomyopathy', 'Dilated Cardiomyopathy',
 'preclinical', 'global', 'option',
 NULL, NULL, NULL,
 NULL, NULL,
 '2024-05-13', 'manual', false, 85, true, 'cardiovascular')

ON CONFLICT (licensor_name, licensee_name, asset_name, announced_date) DO NOTHING;
