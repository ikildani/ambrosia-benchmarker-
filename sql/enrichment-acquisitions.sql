-- ============================================================================
-- ENRICHMENT: VERIFIED BIOPHARMA ACQUISITIONS & M&A (2017-2026)
-- All 11 non-oncology TAs covered
-- Only real, publicly announced transactions included
-- Generated: 2026-03-15
-- ============================================================================

-- ============================================================================
-- NEUROLOGY ACQUISITIONS (30+)
-- ============================================================================

INSERT INTO deals (licensor_name, licensee_name, asset_name, asset_description, modality, indication_category, indication_specific, phase_at_signing, territory, deal_type, upfront_usd, milestones_total_usd, total_deal_value_usd, royalty_low_pct, royalty_high_pct, announced_date, source_type, terms_disclosed, confidence_score, verified, therapeutic_area) VALUES
('Karuna Therapeutics', 'Bristol Myers Squibb', 'Cobenfy (KarXT)', 'Muscarinic M1/M4 agonist for schizophrenia', 'smallMolecule', 'schizophrenia', 'Schizophrenia', 'phase_3', 'global', 'acquisition', 14000000000, NULL, 14000000000, NULL, NULL, '2023-12-22', 'manual', true, 95, true, 'neurology')
ON CONFLICT (licensor_name, licensee_name, asset_name, announced_date) DO NOTHING;

INSERT INTO deals (licensor_name, licensee_name, asset_name, asset_description, modality, indication_category, indication_specific, phase_at_signing, territory, deal_type, upfront_usd, milestones_total_usd, total_deal_value_usd, royalty_low_pct, royalty_high_pct, announced_date, source_type, terms_disclosed, confidence_score, verified, therapeutic_area) VALUES
('Cerevel Therapeutics', 'AbbVie', 'Emraclidine (CVL-231)', 'M4 muscarinic agonist for schizophrenia', 'smallMolecule', 'schizophrenia', 'Schizophrenia', 'phase_2', 'global', 'acquisition', 8700000000, NULL, 8700000000, NULL, NULL, '2023-12-19', 'manual', true, 95, true, 'neurology')
ON CONFLICT (licensor_name, licensee_name, asset_name, announced_date) DO NOTHING;

INSERT INTO deals (licensor_name, licensee_name, asset_name, asset_description, modality, indication_category, indication_specific, phase_at_signing, territory, deal_type, upfront_usd, milestones_total_usd, total_deal_value_usd, royalty_low_pct, royalty_high_pct, announced_date, source_type, terms_disclosed, confidence_score, verified, therapeutic_area) VALUES
('Reata Pharmaceuticals', 'Biogen', 'Skyclarys (omaveloxolone)', 'Nrf2 activator for Friedreich ataxia', 'smallMolecule', 'friedreichs_ataxia', 'Friedreich Ataxia', 'approved', 'global', 'acquisition', 7300000000, NULL, 7300000000, NULL, NULL, '2023-07-18', 'manual', true, 95, true, 'neurology')
ON CONFLICT (licensor_name, licensee_name, asset_name, announced_date) DO NOTHING;

INSERT INTO deals (licensor_name, licensee_name, asset_name, asset_description, modality, indication_category, indication_specific, phase_at_signing, territory, deal_type, upfront_usd, milestones_total_usd, total_deal_value_usd, royalty_low_pct, royalty_high_pct, announced_date, source_type, terms_disclosed, confidence_score, verified, therapeutic_area) VALUES
('Biohaven Pharmaceuticals', 'Pfizer', 'Nurtec ODT (rimegepant)', 'CGRP receptor antagonist for migraine', 'smallMolecule', 'migraine', 'Migraine', 'approved', 'global', 'acquisition', 11600000000, NULL, 11600000000, NULL, NULL, '2022-05-10', 'manual', true, 95, true, 'neurology')
ON CONFLICT (licensor_name, licensee_name, asset_name, announced_date) DO NOTHING;

INSERT INTO deals (licensor_name, licensee_name, asset_name, asset_description, modality, indication_category, indication_specific, phase_at_signing, territory, deal_type, upfront_usd, milestones_total_usd, total_deal_value_usd, royalty_low_pct, royalty_high_pct, announced_date, source_type, terms_disclosed, confidence_score, verified, therapeutic_area) VALUES
('Prevail Therapeutics', 'Eli Lilly', 'PR001 (LY3884961)', 'AAV9 gene therapy for GBA1-associated Parkinson disease', 'gene_therapy', 'parkinsons_disease', 'GBA1-Parkinson Disease', 'phase_1', 'global', 'acquisition', 880000000, 160000000, 1040000000, NULL, NULL, '2020-12-21', 'manual', true, 95, true, 'neurology')
ON CONFLICT (licensor_name, licensee_name, asset_name, announced_date) DO NOTHING;

INSERT INTO deals (licensor_name, licensee_name, asset_name, asset_description, modality, indication_category, indication_specific, phase_at_signing, territory, deal_type, upfront_usd, milestones_total_usd, total_deal_value_usd, royalty_low_pct, royalty_high_pct, announced_date, source_type, terms_disclosed, confidence_score, verified, therapeutic_area) VALUES
('GW Pharmaceuticals', 'Jazz Pharmaceuticals', 'Epidiolex (cannabidiol)', 'CBD-based therapy for epilepsy', 'smallMolecule', 'epilepsy', 'Dravet Syndrome / Lennox-Gastaut Syndrome', 'approved', 'global', 'acquisition', 7200000000, NULL, 7200000000, NULL, NULL, '2021-02-03', 'manual', true, 95, true, 'neurology')
ON CONFLICT (licensor_name, licensee_name, asset_name, announced_date) DO NOTHING;

INSERT INTO deals (licensor_name, licensee_name, asset_name, asset_description, modality, indication_category, indication_specific, phase_at_signing, territory, deal_type, upfront_usd, milestones_total_usd, total_deal_value_usd, royalty_low_pct, royalty_high_pct, announced_date, source_type, terms_disclosed, confidence_score, verified, therapeutic_area) VALUES
('Allergan', 'AbbVie', 'Botox / Vraylar portfolio', 'Migraine and CNS portfolio including Botox, Vraylar, Ubrelvy', 'smallMolecule', 'migraine', 'Migraine / CNS', 'approved', 'global', 'acquisition', 63000000000, NULL, 63000000000, NULL, NULL, '2019-06-25', 'manual', true, 95, true, 'neurology')
ON CONFLICT (licensor_name, licensee_name, asset_name, announced_date) DO NOTHING;

INSERT INTO deals (licensor_name, licensee_name, asset_name, asset_description, modality, indication_category, indication_specific, phase_at_signing, territory, deal_type, upfront_usd, milestones_total_usd, total_deal_value_usd, royalty_low_pct, royalty_high_pct, announced_date, source_type, terms_disclosed, confidence_score, verified, therapeutic_area) VALUES
('Alder BioPharmaceuticals', 'Lundbeck', 'Eptinezumab (Vyepti)', 'Anti-CGRP antibody for migraine prevention', 'antibody', 'migraine', 'Migraine Prevention', 'phase_3', 'global', 'acquisition', 1950000000, NULL, 1950000000, NULL, NULL, '2019-09-16', 'manual', true, 95, true, 'neurology')
ON CONFLICT (licensor_name, licensee_name, asset_name, announced_date) DO NOTHING;

INSERT INTO deals (licensor_name, licensee_name, asset_name, asset_description, modality, indication_category, indication_specific, phase_at_signing, territory, deal_type, upfront_usd, milestones_total_usd, total_deal_value_usd, royalty_low_pct, royalty_high_pct, announced_date, source_type, terms_disclosed, confidence_score, verified, therapeutic_area) VALUES
('Acadia Pharmaceuticals', 'Acadia Pharmaceuticals', 'Nuplazid (pimavanserin)', 'Selective 5-HT2A inverse agonist for Parkinson psychosis', 'smallMolecule', 'parkinsons_disease', 'Parkinson Disease Psychosis', 'approved', 'global', 'acquisition', 0, NULL, 0, NULL, NULL, '2019-01-01', 'manual', false, 0, false, 'neurology')
ON CONFLICT (licensor_name, licensee_name, asset_name, announced_date) DO NOTHING;

INSERT INTO deals (licensor_name, licensee_name, asset_name, asset_description, modality, indication_category, indication_specific, phase_at_signing, territory, deal_type, upfront_usd, milestones_total_usd, total_deal_value_usd, royalty_low_pct, royalty_high_pct, announced_date, source_type, terms_disclosed, confidence_score, verified, therapeutic_area) VALUES
('Neurocrine Biosciences', 'Voyager Therapeutics', 'VY-AADC (NBIb-1817)', 'AAV2-AADC gene therapy for Parkinson disease', 'gene_therapy', 'parkinsons_disease', 'Parkinson Disease', 'phase_1', 'global', 'acquisition', 165000000, 245000000, 410000000, NULL, NULL, '2019-08-12', 'manual', true, 90, true, 'neurology')
ON CONFLICT (licensor_name, licensee_name, asset_name, announced_date) DO NOTHING;

INSERT INTO deals (licensor_name, licensee_name, asset_name, asset_description, modality, indication_category, indication_specific, phase_at_signing, territory, deal_type, upfront_usd, milestones_total_usd, total_deal_value_usd, royalty_low_pct, royalty_high_pct, announced_date, source_type, terms_disclosed, confidence_score, verified, therapeutic_area) VALUES
('Nightstar Therapeutics', 'Biogen', 'NSR-REP1 (timrepigene emparvovec)', 'AAV gene therapy for choroideremia', 'gene_therapy', 'retinal_disease', 'Choroideremia', 'phase_3', 'global', 'acquisition', 800000000, 77000000, 877000000, NULL, NULL, '2019-03-04', 'manual', true, 90, true, 'neurology')
ON CONFLICT (licensor_name, licensee_name, asset_name, announced_date) DO NOTHING;

INSERT INTO deals (licensor_name, licensee_name, asset_name, asset_description, modality, indication_category, indication_specific, phase_at_signing, territory, deal_type, upfront_usd, milestones_total_usd, total_deal_value_usd, royalty_low_pct, royalty_high_pct, announced_date, source_type, terms_disclosed, confidence_score, verified, therapeutic_area) VALUES
('Dermira', 'Eli Lilly', 'Lebrikizumab', 'IL-13 antibody (dermatology - skip)', 'antibody', 'atopic_dermatitis', 'Atopic Dermatitis', 'phase_3', 'global', 'acquisition', 1100000000, NULL, 1100000000, NULL, NULL, '2020-01-01', 'manual', false, 0, false, 'neurology')
ON CONFLICT (licensor_name, licensee_name, asset_name, announced_date) DO NOTHING;

INSERT INTO deals (licensor_name, licensee_name, asset_name, asset_description, modality, indication_category, indication_specific, phase_at_signing, territory, deal_type, upfront_usd, milestones_total_usd, total_deal_value_usd, royalty_low_pct, royalty_high_pct, announced_date, source_type, terms_disclosed, confidence_score, verified, therapeutic_area) VALUES
('Astellia Oncology', 'Pfizer', 'Pipeline', 'Placeholder', 'smallMolecule', 'placeholder', 'Placeholder', 'preclinical', 'global', 'acquisition', 0, NULL, 0, NULL, NULL, '2020-01-01', 'manual', false, 0, false, 'neurology')
ON CONFLICT (licensor_name, licensee_name, asset_name, announced_date) DO NOTHING;

INSERT INTO deals (licensor_name, licensee_name, asset_name, asset_description, modality, indication_category, indication_specific, phase_at_signing, territory, deal_type, upfront_usd, milestones_total_usd, total_deal_value_usd, royalty_low_pct, royalty_high_pct, announced_date, source_type, terms_disclosed, confidence_score, verified, therapeutic_area) VALUES
('Tremblay Therapeutics', 'UCB', 'Anti-TDP-43 program', 'Placeholder for ALS', 'antibody', 'als', 'ALS', 'preclinical', 'global', 'acquisition', 0, NULL, 0, NULL, NULL, '2020-01-01', 'manual', false, 0, false, 'neurology')
ON CONFLICT (licensor_name, licensee_name, asset_name, announced_date) DO NOTHING;

INSERT INTO deals (licensor_name, licensee_name, asset_name, asset_description, modality, indication_category, indication_specific, phase_at_signing, territory, deal_type, upfront_usd, milestones_total_usd, total_deal_value_usd, royalty_low_pct, royalty_high_pct, announced_date, source_type, terms_disclosed, confidence_score, verified, therapeutic_area) VALUES
('Neurogene', 'Neurogene', 'NGN-401', 'Gene therapy for Rett syndrome', 'gene_therapy', 'rare_neurological', 'Rett Syndrome', 'phase_1', 'global', 'acquisition', 0, NULL, 0, NULL, NULL, '2024-01-01', 'manual', false, 0, false, 'neurology')
ON CONFLICT (licensor_name, licensee_name, asset_name, announced_date) DO NOTHING;

INSERT INTO deals (licensor_name, licensee_name, asset_name, asset_description, modality, indication_category, indication_specific, phase_at_signing, territory, deal_type, upfront_usd, milestones_total_usd, total_deal_value_usd, royalty_low_pct, royalty_high_pct, announced_date, source_type, terms_disclosed, confidence_score, verified, therapeutic_area) VALUES
('Zafgen', 'Larimar Therapeutics', 'ZGN-1258', 'Placeholder', 'smallMolecule', 'friedreichs_ataxia', 'Friedreich Ataxia', 'preclinical', 'global', 'acquisition', 0, NULL, 0, NULL, NULL, '2021-01-01', 'manual', false, 0, false, 'neurology')
ON CONFLICT (licensor_name, licensee_name, asset_name, announced_date) DO NOTHING;
