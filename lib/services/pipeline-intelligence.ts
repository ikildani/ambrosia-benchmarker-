/**
 * Competitive Pipeline Intelligence Service
 *
 * Analyzes competing assets in the same indication/modality space using
 * clinical trials data and curated competitive landscape information.
 */

import type { CompetitiveLandscape, CompetitiveAsset } from '@/lib/financial/types';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Curated competitive density data for top indications.
 * Maps indication → known pipeline density and key competitors.
 *
 * This data supplements live ClinicalTrials.gov queries with
 * curated intelligence that the API cannot provide (expected timelines,
 * differentiation narratives, market share assumptions).
 */
const CURATED_COMPETITIVE_DATA: Record<string, {
  density: 'very_high' | 'high' | 'moderate' | 'low' | 'very_low';
  keyAssets: CompetitiveAsset[];
  marketDynamics: string;
}> = {
  // Oncology — high density
  lung_nsclc: {
    density: 'very_high',
    keyAssets: [
      { companyName: 'Merck', assetName: 'Keytruda', modality: 'mab', phase: 'approved', indication: 'NSCLC', differentiator: 'Market leader; >$25B revenue' },
      { companyName: 'AstraZeneca', assetName: 'Tagrisso', modality: 'smallMolecule', phase: 'approved', indication: 'NSCLC EGFR', differentiator: 'EGFR standard of care' },
      { companyName: 'Daiichi Sankyo/AstraZeneca', assetName: 'Dato-DXd', modality: 'adc', phase: 'phase3', indication: 'NSCLC', expectedApprovalYear: 2025, differentiator: 'TROP2 ADC; broad solid tumor potential' },
      { companyName: 'Roche', assetName: 'Tiragolumab + Tecentriq', modality: 'bispecific', phase: 'phase3', indication: 'NSCLC', differentiator: 'TIGIT + PD-L1 combination' },
    ],
    marketDynamics: 'Extremely competitive market dominated by checkpoint inhibitors. ADC and bispecific entrants are reshaping treatment paradigms. Differentiation requires either novel MoA or superior efficacy in biomarker-defined subsets.',
  },
  breast_her2: {
    density: 'high',
    keyAssets: [
      { companyName: 'Daiichi Sankyo/AstraZeneca', assetName: 'Enhertu', modality: 'adc', phase: 'approved', indication: 'HER2+ breast', differentiator: 'Best-in-class ADC; $5B+ revenue trajectory' },
      { companyName: 'Roche', assetName: 'Kadcyla', modality: 'adc', phase: 'approved', indication: 'HER2+ breast', differentiator: 'Established T-DM1' },
      { companyName: 'Seagen/Pfizer', assetName: 'Tukysa', modality: 'smallMolecule', phase: 'approved', indication: 'HER2+ breast', differentiator: 'Brain metastases activity' },
    ],
    marketDynamics: 'Enhertu has reset HER2 ADC expectations. New entrants must show differentiation in brain mets, HER2-low, or novel combinations.',
  },
  breast_tnbc: {
    density: 'high',
    keyAssets: [
      { companyName: 'Gilead', assetName: 'Trodelvy', modality: 'adc', phase: 'approved', indication: 'TNBC', differentiator: 'First TROP2 ADC approved in TNBC' },
      { companyName: 'Merck', assetName: 'Keytruda + chemo', modality: 'mab', phase: 'approved', indication: 'TNBC', differentiator: 'IO + chemo standard for PD-L1+' },
    ],
    marketDynamics: 'High unmet need despite ADC and IO approvals. Opportunity exists for antibody-drug conjugates with novel payloads or targets.',
  },

  // Neurology — moderate/low density for rare
  alzheimers: {
    density: 'high',
    keyAssets: [
      { companyName: 'Eisai/Biogen', assetName: 'Leqembi', modality: 'mab', phase: 'approved', indication: 'Early AD', differentiator: 'First anti-amyloid with clear clinical benefit' },
      { companyName: 'Lilly', assetName: 'Kisunla', modality: 'mab', phase: 'approved', indication: 'Early AD', differentiator: 'Time-limited dosing; potentially curative amyloid clearance' },
      { companyName: 'Roche', assetName: 'Trontinemab', modality: 'bbbPlatform', phase: 'phase2', indication: 'AD', expectedApprovalYear: 2028, differentiator: 'Brain shuttle technology for enhanced CNS delivery' },
    ],
    marketDynamics: 'Amyloid hypothesis validated but debate continues. Next wave targets tau, neuroinflammation, and synaptic protection. BBB delivery is key differentiator.',
  },
  // Immunology
  sle_lupus: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'GSK', assetName: 'Benlysta', modality: 'mab', phase: 'approved', indication: 'SLE', differentiator: 'Only targeted biologic approved for SLE' },
      { companyName: 'AstraZeneca', assetName: 'Anifrolumab', modality: 'mab', phase: 'approved', indication: 'SLE', differentiator: 'Type I interferon receptor antagonist' },
    ],
    marketDynamics: 'Historically difficult indication with high failure rate. Recent successes have validated interferon and B-cell pathways. Significant unmet need in lupus nephritis.',
  },
  atopicderm: {
    density: 'very_high',
    keyAssets: [
      { companyName: 'Sanofi/Regeneron', assetName: 'Dupixent', modality: 'mab', phase: 'approved', indication: 'Atopic Derm', differentiator: '$13B franchise; IL-4/IL-13' },
      { companyName: 'AbbVie', assetName: 'Rinvoq', modality: 'jakInhibitor', phase: 'approved', indication: 'Atopic Derm', differentiator: 'Oral JAK1; box warning limits uptake' },
      { companyName: 'Pfizer', assetName: 'Cibinqo', modality: 'jakInhibitor', phase: 'approved', indication: 'Atopic Derm', differentiator: 'Oral JAK1' },
      { companyName: 'Lilly', assetName: 'Ebglyss', modality: 'mab', phase: 'approved', indication: 'Atopic Derm', differentiator: 'IL-13 selective' },
    ],
    marketDynamics: 'Dupixent dominates but faces emerging competition from oral agents and next-gen biologics. OX40 and IL-31 targets in development.',
  },

  // Ophthalmology
  wetAmd: {
    density: 'high',
    keyAssets: [
      { companyName: 'Roche', assetName: 'Vabysmo', modality: 'antiVegf', phase: 'approved', indication: 'Wet AMD', differentiator: 'Bispecific anti-VEGF/Ang-2; extended dosing' },
      { companyName: 'Regeneron', assetName: 'Eylea HD', modality: 'antiVegf', phase: 'approved', indication: 'Wet AMD', differentiator: '8mg high-dose; extended intervals' },
      { companyName: 'Various', assetName: 'Anti-VEGF biosimilars', modality: 'antiVegf', phase: 'approved', indication: 'Wet AMD', differentiator: 'Price pressure from ranibizumab/aflibercept biosimilars' },
    ],
    marketDynamics: 'Anti-VEGF market faces biosimilar erosion but premium for extended dosing. Gene therapy approaches promise one-time treatment.',
  },
  dryAmdGA: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'Apellis', assetName: 'SYFOVRE', modality: 'complementInhibitor', phase: 'approved', indication: 'Geographic Atrophy', differentiator: 'First approved therapy for GA' },
      { companyName: 'Astellas (ex-Iveric)', assetName: 'IZERVAY', modality: 'complementInhibitor', phase: 'approved', indication: 'Geographic Atrophy', differentiator: 'Monthly C5 inhibitor' },
    ],
    marketDynamics: 'Newly opened market with two complement-based approvals. Adoption slower than expected due to injection burden and modest efficacy. Next wave targeting earlier disease.',
  },

  // Cardiovascular
  heartFailureHfref: {
    density: 'high',
    keyAssets: [
      { companyName: 'Novartis', assetName: 'Entresto', modality: 'smallMolecule', phase: 'approved', indication: 'HFrEF', differentiator: 'ARNI standard of care; $6B franchise' },
      { companyName: 'AstraZeneca', assetName: 'Farxiga', modality: 'sglt2Inhibitor', phase: 'approved', indication: 'HFrEF', differentiator: 'SGLT2i with HF indication' },
      { companyName: 'BMS', assetName: 'Camzyos', modality: 'myosinInhibitor', phase: 'approved', indication: 'HCM', differentiator: 'First-in-class myosin inhibitor' },
    ],
    marketDynamics: 'Four-pillar HF therapy established (ARNI, SGLT2i, MRA, beta-blocker). Innovation opportunity in gene therapy for cardiomyopathies.',
  },

  // Women's Health
  endometriosis: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'AbbVie', assetName: 'Orilissa', modality: 'gnrhAntagonist', phase: 'approved', indication: 'Endometriosis', differentiator: 'Oral GnRH antagonist' },
      { companyName: 'Myovant/Sumitomo', assetName: 'MYFEMBREE', modality: 'gnrhAntagonist', phase: 'approved', indication: 'Endometriosis/Fibroids', differentiator: 'Combo with add-back therapy' },
    ],
    marketDynamics: 'Underserved market with 10-year average diagnostic delay. GnRH antagonists gaining share. Non-hormonal approaches in early development.',
  },
  uterineFibroids: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'Myovant/Sumitomo', assetName: 'MYFEMBREE', modality: 'gnrhAntagonist', phase: 'approved', indication: 'Uterine Fibroids', differentiator: 'First oral GnRH antagonist combo for fibroids' },
      { companyName: 'AbbVie', assetName: 'Oriahnn', modality: 'gnrhAntagonist', phase: 'approved', indication: 'Uterine Fibroids', differentiator: 'Elagolix-based combo with add-back therapy' },
      { companyName: 'Myovant/Sumitomo', assetName: 'Relugolix monotherapy', modality: 'gnrhAntagonist', phase: 'phase3', indication: 'Uterine Fibroids', differentiator: 'Investigating broader fibroid populations' },
    ],
    marketDynamics: 'GnRH antagonist combinations are the primary medical management option. Surgical alternatives remain common. Non-hormonal approaches represent an unmet need for women seeking long-term options.',
  },
  menopause: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'Astellas', assetName: 'Veozah (fezolinetant)', modality: 'neuroactiveSteroid', phase: 'approved', indication: 'Vasomotor symptoms', differentiator: 'First NK3 receptor antagonist; non-hormonal hot flash treatment' },
      { companyName: 'Bayer', assetName: 'Elinzanetant', modality: 'neuroactiveSteroid', phase: 'phase3', indication: 'Vasomotor symptoms', expectedApprovalYear: 2026, differentiator: 'Dual NK1/NK3 antagonist; addresses sleep and mood' },
      { companyName: 'Various', assetName: 'Estetrol-based HRT', modality: 'hormoneTherapy', phase: 'approved', indication: 'Menopause', differentiator: 'Native estrogen with selective tissue action' },
    ],
    marketDynamics: 'Non-hormonal options expanding rapidly after decades of HRT dominance. NK3 receptor antagonists validated. Combination approaches targeting vasomotor, sleep, and mood symptoms in development.',
  },

  // ====================================================
  // EXPANDED ONCOLOGY INDICATIONS
  // ====================================================
  colorectal: {
    density: 'very_high',
    keyAssets: [
      { companyName: 'Merck', assetName: 'Keytruda', modality: 'mab', phase: 'approved', indication: 'MSI-H/dMMR CRC', differentiator: 'First-line IO for MSI-H; practice-changing' },
      { companyName: 'BMS', assetName: 'Opdivo + Yervoy', modality: 'mab', phase: 'approved', indication: 'dMMR CRC', differentiator: 'Dual checkpoint combo approved first-line dMMR' },
      { companyName: 'Pfizer', assetName: 'BRAFTOVI + cetuximab', modality: 'smallMolecule', phase: 'approved', indication: 'BRAF V600E mCRC', differentiator: 'BRAF-targeted combo; 64% ORR with chemo backbone' },
      { companyName: 'Amgen', assetName: 'Lumakras + Vectibix', modality: 'smallMolecule', phase: 'approved', indication: 'KRAS G12C mCRC', differentiator: 'First KRAS G12C targeted therapy in CRC' },
    ],
    marketDynamics: 'IO transformative for MSI-H (~15% of CRC). BRAF and KRAS targeting opening precision oncology. MSS CRC (~85%) remains IO-resistant — major unmet need. ADC and bispecific entrants in development.',
  },
  pancreatic: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'Revolution Medicines', assetName: 'Daraxonrasib', modality: 'smallMolecule', phase: 'phase3', indication: 'KRAS G12 PDAC', expectedApprovalYear: 2027, differentiator: 'RAS(ON) multi-selective inhibitor; Breakthrough Therapy Designation' },
      { companyName: 'Verastem', assetName: 'VS-7375', modality: 'smallMolecule', phase: 'phase2', indication: 'KRAS G12D PDAC', differentiator: 'KRAS G12D inhibitor; 52% ORR in PDAC; Fast Track' },
      { companyName: 'Mirati/BMS', assetName: 'MRTX1133', modality: 'smallMolecule', phase: 'phase1', indication: 'KRAS G12D solid tumors', differentiator: 'First direct KRAS G12D blocker in clinic' },
    ],
    marketDynamics: 'Historically intractable cancer now seeing KRAS-targeted breakthroughs. G12D mutations (~40% of PDAC) finally druggable. Combination with chemo backbone showing early promise. 5-year survival still <12%.',
  },
  melanoma: {
    density: 'very_high',
    keyAssets: [
      { companyName: 'Merck', assetName: 'Keytruda', modality: 'mab', phase: 'approved', indication: 'Melanoma', differentiator: 'Anti-PD-1 standard of care across stages' },
      { companyName: 'BMS', assetName: 'Opdualag (nivo + relatlimab)', modality: 'mab', phase: 'approved', indication: 'Melanoma', differentiator: 'First LAG-3 combo; doubled PFS vs nivo alone' },
      { companyName: 'Regeneron', assetName: 'Fianlimab + cemiplimab', modality: 'mab', phase: 'phase3', indication: 'Melanoma', expectedApprovalYear: 2026, differentiator: 'LAG-3 + PD-1 combo; multiple Phase 3 trials' },
      { companyName: 'Roche', assetName: 'Tobemstomig', modality: 'bispecific', phase: 'phase2', indication: 'Melanoma', differentiator: 'Anti-PD-1/LAG-3 bispecific; highest pathologic response in neoadjuvant' },
    ],
    marketDynamics: 'IO has transformed melanoma outcomes. LAG-3 validated as third checkpoint target. Neoadjuvant IO becoming standard. BRAF/MEK targeted therapy well-established for BRAF-mutant. Next wave: TIL therapy and personalized neoantigen vaccines.',
  },
  prostate: {
    density: 'very_high',
    keyAssets: [
      { companyName: 'Pfizer', assetName: 'Xtandi (enzalutamide)', modality: 'smallMolecule', phase: 'approved', indication: 'Prostate cancer', differentiator: 'ARPI standard of care; $5B+ franchise' },
      { companyName: 'Novartis/AAA', assetName: 'Pluvicto (Lu-PSMA-617)', modality: 'radiopharmaceutical', phase: 'approved', indication: 'mCRPC', differentiator: 'First PSMA radioligand therapy; expanding to earlier lines' },
      { companyName: 'Pfizer', assetName: 'Talzenna + Xtandi', modality: 'smallMolecule', phase: 'approved', indication: 'HRR+ mCRPC', differentiator: 'PARP + ARPI combo for HRR-mutant patients' },
      { companyName: 'AstraZeneca/Merck', assetName: 'Lynparza + abiraterone', modality: 'smallMolecule', phase: 'approved', indication: 'BRCA+ mCRPC', differentiator: 'PARP + ARPI for BRCA-mutant; established combination' },
    ],
    marketDynamics: 'Large market ($15B+) with multiple approved modalities. PSMA radioligand therapy moving to earlier disease stages. PARP + ARPI combos standard for HRR/BRCA. Next frontiers: bispecific T-cell engagers and PSMA ADCs.',
  },
  ovarian: {
    density: 'high',
    keyAssets: [
      { companyName: 'AstraZeneca', assetName: 'Lynparza (olaparib)', modality: 'smallMolecule', phase: 'approved', indication: 'Ovarian cancer', differentiator: 'PARP inhibitor standard in BRCA+ maintenance' },
      { companyName: 'GSK', assetName: 'Zejula (niraparib)', modality: 'smallMolecule', phase: 'approved', indication: 'Ovarian cancer', differentiator: 'Broad HRD maintenance; regardless of BRCA status' },
      { companyName: 'ImmunoGen/AbbVie', assetName: 'Elahere (mirvetuximab)', modality: 'adc', phase: 'approved', indication: 'FRα+ ovarian', differentiator: 'First FRα-targeted ADC approved in platinum-resistant' },
    ],
    marketDynamics: 'PARP inhibitor maintenance established but restricted after BRCA/HRD refinement. ADCs (mirvetuximab) opening new targetable segments. IO has limited single-agent activity. Combination strategies and novel targets (Claudin6, NaPi2b) in development.',
  },
  renal: {
    density: 'high',
    keyAssets: [
      { companyName: 'BMS', assetName: 'Opdivo + Cabometyx', modality: 'mab', phase: 'approved', indication: 'RCC', differentiator: 'IO + TKI first-line standard; strong OS benefit' },
      { companyName: 'Merck/Eisai', assetName: 'Keytruda + Lenvima', modality: 'mab', phase: 'approved', indication: 'RCC', differentiator: 'IO + TKI combo; high response rates' },
      { companyName: 'Merck', assetName: 'Welireg (belzutifan)', modality: 'smallMolecule', phase: 'approved', indication: 'RCC', differentiator: 'First HIF-2α inhibitor; approved for VHL disease' },
    ],
    marketDynamics: 'IO + TKI combinations dominate first-line. HIF-2α pathway validated with belzutifan. Adjuvant pembrolizumab approved. Next wave: novel IO combos, bispecifics, and new TKI combinations.',
  },
  bladder: {
    density: 'high',
    keyAssets: [
      { companyName: 'Seagen/Astellas', assetName: 'Padcev (enfortumab vedotin)', modality: 'adc', phase: 'approved', indication: 'Urothelial cancer', differentiator: 'Nectin-4 ADC; practice-changing in combination with pembro' },
      { companyName: 'Merck', assetName: 'Keytruda', modality: 'mab', phase: 'approved', indication: 'Urothelial cancer', differentiator: 'IO standard across multiple settings' },
      { companyName: 'J&J', assetName: 'Balversa (erdafitinib)', modality: 'smallMolecule', phase: 'approved', indication: 'FGFR-altered urothelial', differentiator: 'First FGFR inhibitor for bladder cancer' },
    ],
    marketDynamics: 'Enfortumab vedotin + pembrolizumab has become first-line standard in advanced urothelial cancer. ADC + IO paradigm validated. FGFR targeting for biomarker-selected patients. Significant pipeline of novel ADCs and bispecifics.',
  },
  gastric: {
    density: 'high',
    keyAssets: [
      { companyName: 'Daiichi Sankyo/AstraZeneca', assetName: 'Enhertu', modality: 'adc', phase: 'approved', indication: 'HER2+ gastric', differentiator: 'Best-in-class HER2 ADC; practice-changing in gastric' },
      { companyName: 'Astellas/Genmab', assetName: 'Vyloy (zolbetuximab)', modality: 'mab', phase: 'approved', indication: 'CLDN18.2+ gastric', differentiator: 'First Claudin18.2-targeted therapy; novel target class' },
      { companyName: 'Merck', assetName: 'Keytruda + chemo', modality: 'mab', phase: 'approved', indication: 'Gastric cancer', differentiator: 'IO + chemo first-line standard in PD-L1 CPS≥1' },
    ],
    marketDynamics: 'New targetable subtypes emerging beyond HER2 and PD-L1. Claudin18.2 opens treatment for ~40% of gastric cancers. ADC development active across multiple targets. Combination IO-chemo remains backbone.',
  },

  // ====================================================
  // EXPANDED NEUROLOGY INDICATIONS
  // ====================================================
  parkinsons: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'Biogen', assetName: 'BIIB122', modality: 'smallMolecule', phase: 'phase2', indication: 'Parkinson\'s (LRRK2)', differentiator: 'Oral LRRK2 kinase inhibitor; CNS-penetrant' },
      { companyName: 'Roche', assetName: 'Prasinezumab', modality: 'mab', phase: 'phase2', indication: 'Parkinson\'s', differentiator: 'Anti-alpha-synuclein antibody; potential disease modification' },
      { companyName: 'AskBio/Bayer', assetName: 'AB-1005 (AAV-GDNF)', modality: 'geneTherapy', phase: 'phase2', indication: 'Parkinson\'s', differentiator: 'Gene therapy delivering GDNF for neuroprotection' },
      { companyName: 'BlueRock/Bayer', assetName: 'Bemdaneprocel', modality: 'stemCell', phase: 'phase2', indication: 'Parkinson\'s', expectedApprovalYear: 2029, differentiator: 'iPSC-derived dopaminergic neuron cell therapy' },
    ],
    marketDynamics: 'No disease-modifying therapy approved. LRRK2 and alpha-synuclein are leading targets. Gene and cell therapies in mid-stage development. Symptomatic treatment dominated by levodopa. Massive unmet need for neuroprotection.',
  },
  migraine: {
    density: 'very_high',
    keyAssets: [
      { companyName: 'Amgen/Novartis', assetName: 'Aimovig (erenumab)', modality: 'mab', phase: 'approved', indication: 'Migraine prevention', differentiator: 'First CGRP receptor antibody; monthly injection' },
      { companyName: 'AbbVie', assetName: 'Qulipta (atogepant)', modality: 'smallMolecule', phase: 'approved', indication: 'Migraine prevention', differentiator: 'Daily oral CGRP receptor antagonist (gepant)' },
      { companyName: 'Pfizer/Biohaven', assetName: 'Nurtec/Vydura (rimegepant)', modality: 'smallMolecule', phase: 'approved', indication: 'Migraine acute + prevention', differentiator: 'Dual acute and preventive use; every-other-day oral gepant' },
      { companyName: 'Lundbeck', assetName: 'Vyepti (eptinezumab)', modality: 'mab', phase: 'approved', indication: 'Migraine prevention', differentiator: 'IV infusion; quarterly dosing; fastest onset' },
    ],
    marketDynamics: 'CGRP pathway fully validated with 8 approved therapies (4 mAbs, 4 gepants). Now first-line for prevention. Market >$8B annually. Competition intense but large patient pool. Combination gepant + mAb under investigation. Nasal gepant (zavegepant) adds delivery options.',
  },
  ms: {
    density: 'very_high',
    keyAssets: [
      { companyName: 'Roche', assetName: 'Ocrevus (ocrelizumab)', modality: 'mab', phase: 'approved', indication: 'RRMS and PPMS', differentiator: 'Anti-CD20 market leader; $7B+ franchise; first PPMS therapy' },
      { companyName: 'Novartis', assetName: 'Kesimpta (ofatumumab)', modality: 'mab', phase: 'approved', indication: 'RRMS', differentiator: 'Self-administered anti-CD20; subcutaneous convenience' },
      { companyName: 'Sanofi', assetName: 'Tolebrutinib', modality: 'smallMolecule', phase: 'phase3', indication: 'MS (non-relapsing SPMS)', expectedApprovalYear: 2026, differentiator: 'BTK inhibitor; brain-penetrant; targets smoldering neuroinflammation' },
      { companyName: 'Roche', assetName: 'Fenebrutinib', modality: 'smallMolecule', phase: 'phase3', indication: 'RRMS/PPMS', expectedApprovalYear: 2027, differentiator: 'BTK inhibitor; dual B-cell and myeloid targeting' },
    ],
    marketDynamics: 'Anti-CD20 therapies dominate. BTK inhibitors represent next wave — targeting progressive MS and smoldering inflammation. $25B+ market. High-efficacy early treatment increasingly standard. Remyelination therapies in early development.',
  },
  depression: {
    density: 'high',
    keyAssets: [
      { companyName: 'J&J/Janssen', assetName: 'Spravato (esketamine)', modality: 'smallMolecule', phase: 'approved', indication: 'Treatment-resistant depression', differentiator: 'First NMDA-targeted antidepressant; nasal spray' },
      { companyName: 'Sage/Biogen', assetName: 'Zurzuvae (zuranolone)', modality: 'neuroactiveSteroid', phase: 'approved', indication: 'Postpartum depression', differentiator: 'First oral neuroactive steroid; 14-day course' },
      { companyName: 'COMPASS Pathways', assetName: 'COMP360 (psilocybin)', modality: 'psychedelic', phase: 'phase3', indication: 'Treatment-resistant depression', expectedApprovalYear: 2027, differentiator: 'Psychedelic-assisted therapy; single-dose paradigm' },
      { companyName: 'Usona Institute', assetName: 'Psilocybin', modality: 'psychedelic', phase: 'phase2', indication: 'Major depressive disorder', differentiator: 'Non-profit-sponsored; broader MDD indication' },
    ],
    marketDynamics: 'Massive market ($16B+) but most patients on generic SSRIs/SNRIs. Novel mechanisms validated: NMDA (esketamine), neurosteroids (zuranolone), psychedelics (psilocybin). Treatment-resistant depression remains major unmet need. Rapid-acting antidepressants gaining share.',
  },
  schizophrenia: {
    density: 'high',
    keyAssets: [
      { companyName: 'BMS (ex-Karuna)', assetName: 'Cobenfy (KarXT)', modality: 'smallMolecule', phase: 'approved', indication: 'Schizophrenia', differentiator: 'First muscarinic agonist; new MoA in 70+ years; no D2 blockade' },
      { companyName: 'AbbVie', assetName: 'Emraclidine', modality: 'smallMolecule', phase: 'phase2', indication: 'Schizophrenia', differentiator: 'M4 muscarinic receptor positive allosteric modulator' },
      { companyName: 'Cerevel/AbbVie', assetName: 'Tavapadon', modality: 'smallMolecule', phase: 'phase3', indication: 'Schizophrenia', differentiator: 'Partial D1/D5 agonist; novel dopamine approach' },
    ],
    marketDynamics: 'Cobenfy (KarXT) approval in 2024 transformed the field — first non-D2 mechanism. Expanding to adjunctive use, bipolar, and cognitive impairment. Muscarinic receptor class now validated. Long-acting injectables remain important for adherence. $10B+ antipsychotic market.',
  },

  // ====================================================
  // EXPANDED IMMUNOLOGY INDICATIONS
  // ====================================================
  rheumatoidArthritis: {
    density: 'very_high',
    keyAssets: [
      { companyName: 'AbbVie', assetName: 'Rinvoq (upadacitinib)', modality: 'jakInhibitor', phase: 'approved', indication: 'RA', differentiator: 'Selective JAK1; strong efficacy vs adalimumab; CV box warning' },
      { companyName: 'Pfizer', assetName: 'Xeljanz (tofacitinib)', modality: 'jakInhibitor', phase: 'approved', indication: 'RA', differentiator: 'First JAK inhibitor; $1.1B revenue; CV safety concerns limit uptake' },
      { companyName: 'AbbVie', assetName: 'Humira (adalimumab)', modality: 'mab', phase: 'approved', indication: 'RA', differentiator: 'Iconic anti-TNF; facing biosimilar erosion' },
      { companyName: 'Various', assetName: 'BTK inhibitors', modality: 'smallMolecule', phase: 'phase2', indication: 'RA', differentiator: 'Oral B-cell targeting; evobrutinib, fenebrutinib in development' },
    ],
    marketDynamics: '$28B+ market undergoing biosimilar disruption for anti-TNFs. JAK inhibitors effective but limited by CV/thrombotic safety signals. BTK inhibitors emerging as next-gen oral option. Increasing biosimilar competition driving pricing pressure.',
  },
  psoriasis: {
    density: 'very_high',
    keyAssets: [
      { companyName: 'AbbVie', assetName: 'Skyrizi (risankizumab)', modality: 'mab', phase: 'approved', indication: 'Psoriasis', differentiator: 'IL-23 inhibitor; market leader; PASI 100 in ~40% patients' },
      { companyName: 'UCB', assetName: 'Bimzelx (bimekizumab)', modality: 'mab', phase: 'approved', indication: 'Psoriasis', differentiator: 'Dual IL-17A/F blockade; rapid onset; high PASI 100 rates' },
      { companyName: 'BMS', assetName: 'Sotyktu (deucravacitinib)', modality: 'smallMolecule', phase: 'approved', indication: 'Psoriasis', differentiator: 'First TYK2 inhibitor; oral; favorable safety vs JAK' },
      { companyName: 'Takeda', assetName: 'Zasocitinib', modality: 'smallMolecule', phase: 'phase3', indication: 'Psoriasis', expectedApprovalYear: 2026, differentiator: 'Next-gen TYK2 inhibitor; AI-guided; superior to deucravacitinib' },
    ],
    marketDynamics: 'IL-23 biologics dominate (Skyrizi, Tremfya). TYK2 oral inhibitors emerging as biologic-level efficacy without injection. Next-gen TYK2 (zasocitinib) showing PASI 90/100 comparable to biologics. Extended-dosing IL-23 biologics (yearly injection) in development.',
  },
  ulcerativeColitis: {
    density: 'very_high',
    keyAssets: [
      { companyName: 'Takeda', assetName: 'Entyvio (vedolizumab)', modality: 'mab', phase: 'approved', indication: 'UC', differentiator: 'Gut-selective integrin blocker; strong safety; $5B+ franchise' },
      { companyName: 'Lilly', assetName: 'Omvoh (mirikizumab)', modality: 'mab', phase: 'approved', indication: 'UC', differentiator: 'IL-23p19 blocker; high remission rates; rapid response' },
      { companyName: 'Pfizer', assetName: 'Velsipity (etrasimod)', modality: 'smallMolecule', phase: 'approved', indication: 'UC', differentiator: 'Oral S1P modulator; convenient daily pill' },
      { companyName: 'Merck', assetName: 'Tulisokibart', modality: 'mab', phase: 'phase3', indication: 'UC', expectedApprovalYear: 2026, differentiator: 'Anti-TL1A antibody; novel target; strong Phase 2 data' },
    ],
    marketDynamics: 'Crowded market with multiple mechanism classes: anti-integrin, IL-23, JAK, S1P. TL1A emerging as next major target (tulisokibart, duvakitug). Oral options gaining share. Personalized medicine approach needed to navigate multiple options.',
  },
  crohns: {
    density: 'very_high',
    keyAssets: [
      { companyName: 'AbbVie', assetName: 'Skyrizi (risankizumab)', modality: 'mab', phase: 'approved', indication: 'Crohn\'s', differentiator: 'IL-23 leader in CD; high endoscopic response rates' },
      { companyName: 'J&J', assetName: 'Tremfya (guselkumab)', modality: 'mab', phase: 'approved', indication: 'Crohn\'s', differentiator: 'IL-23; approved CD 2024; dual IL-23 + CD64 binding' },
      { companyName: 'Takeda', assetName: 'Entyvio (vedolizumab)', modality: 'mab', phase: 'approved', indication: 'Crohn\'s', differentiator: 'Gut-selective anti-integrin; established safety profile' },
    ],
    marketDynamics: 'IL-23 inhibitors rapidly gaining share over anti-TNF. Risankizumab and guselkumab approved. TL1A antibodies (Merck, AbbVie) in Phase 3 — could be next class. S1P modulators less effective in CD than UC. Anti-TNF biosimilars expanding access.',
  },
  asthma: {
    density: 'very_high',
    keyAssets: [
      { companyName: 'Sanofi/Regeneron', assetName: 'Dupixent (dupilumab)', modality: 'mab', phase: 'approved', indication: 'Asthma', differentiator: 'IL-4/IL-13 blockade; $13B+ franchise across indications' },
      { companyName: 'AstraZeneca', assetName: 'Tezspire (tezepelumab)', modality: 'mab', phase: 'approved', indication: 'Severe asthma', differentiator: 'Anti-TSLP; broadest biologic eligibility; agnostic of eosinophil count' },
      { companyName: 'Sanofi', assetName: 'Itepekimab', modality: 'mab', phase: 'phase3', indication: 'Asthma', expectedApprovalYear: 2027, differentiator: 'Anti-IL-33; targets upstream alarmin pathway' },
      { companyName: 'Amgen', assetName: 'Tezspire (label expansion)', modality: 'mab', phase: 'phase3', indication: 'Moderate asthma', differentiator: 'Expanding anti-TSLP to broader moderate asthma population' },
    ],
    marketDynamics: 'Biologics transforming severe asthma management. Type 2 inflammation well-targeted. TSLP (tezepelumab) opened non-eosinophilic segment. Alarmin targets (IL-33, TSLP) expanding. Biologics moving to earlier disease stages.',
  },

  // ====================================================
  // EXPANDED METABOLIC INDICATIONS
  // ====================================================
  nashMash: {
    density: 'high',
    keyAssets: [
      { companyName: 'Madrigal/Novo Nordisk', assetName: 'Rezdiffra (resmetirom)', modality: 'smallMolecule', phase: 'approved', indication: 'MASH with fibrosis', differentiator: 'First FDA-approved MASH therapy; THR-β agonist' },
      { companyName: 'Novo Nordisk', assetName: 'Wegovy (semaglutide)', modality: 'glp1Agonist', phase: 'approved', indication: 'MASH', differentiator: 'FDA-approved 2025 for MASH with fibrosis; GLP-1 RA' },
      { companyName: 'Akero', assetName: 'Efruxifermin', modality: 'mab', phase: 'phase3', indication: 'MASH', expectedApprovalYear: 2027, differentiator: 'FGF21 analog; strong fibrosis improvement; long-acting' },
      { companyName: 'Inventiva', assetName: 'Lanifibranor', modality: 'smallMolecule', phase: 'phase3', indication: 'MASH', expectedApprovalYear: 2027, differentiator: 'Pan-PPAR agonist; dual resolution of MASH and fibrosis' },
    ],
    marketDynamics: 'Market opened in 2024 with resmetirom. GLP-1s gate-crashing with semaglutide MASH approval. FGF21 analogs showing strongest fibrosis reversal. Combination approaches (THR-β + GLP-1 + FGF21) likely future standard. $30B+ projected peak market.',
  },
  type2Diabetes: {
    density: 'very_high',
    keyAssets: [
      { companyName: 'Novo Nordisk', assetName: 'Ozempic (semaglutide)', modality: 'glp1Agonist', phase: 'approved', indication: 'T2D', differentiator: 'GLP-1 RA market leader; weekly injection; $18B+ franchise' },
      { companyName: 'Lilly', assetName: 'Mounjaro (tirzepatide)', modality: 'dualIncretin', phase: 'approved', indication: 'T2D', differentiator: 'Dual GIP/GLP-1; superior A1c and weight reduction' },
      { companyName: 'Pfizer', assetName: 'Danuglipron', modality: 'smallMolecule', phase: 'phase3', indication: 'T2D', expectedApprovalYear: 2027, differentiator: 'Oral GLP-1 small molecule; daily dosing' },
      { companyName: 'Roche', assetName: 'CT-996', modality: 'smallMolecule', phase: 'phase2', indication: 'Obesity/T2D', differentiator: 'Oral non-peptide GLP-1 agonist; weight loss potential' },
    ],
    marketDynamics: 'Largest diabetes market opportunity. GLP-1 and dual incretin therapies dominant. Oral formulations (orforglipron, danuglipron) racing to market. Triple agonists (GLP-1/GIP/glucagon) in development. Insulin market declining as GLP-1s expand.',
  },
  ckdMetabolic: {
    density: 'high',
    keyAssets: [
      { companyName: 'Bayer', assetName: 'Kerendia (finerenone)', modality: 'smallMolecule', phase: 'approved', indication: 'CKD with T2D', differentiator: 'Non-steroidal MRA; kidney + CV protection' },
      { companyName: 'AstraZeneca', assetName: 'Farxiga (dapagliflozin)', modality: 'sglt2Inhibitor', phase: 'approved', indication: 'CKD', differentiator: 'SGLT2i with broad CKD indication regardless of diabetes' },
      { companyName: 'Chinook/Novartis', assetName: 'Atrasentan', modality: 'smallMolecule', phase: 'phase3', indication: 'IgA nephropathy', expectedApprovalYear: 2026, differentiator: 'Endothelin receptor antagonist; strong proteinuria reduction' },
    ],
    marketDynamics: 'SGLT2 inhibitors and MRAs established as pillars of CKD care. Endothelin antagonists (atrasentan) and complement inhibitors (iptacopan) emerging for glomerular diseases. GLP-1 RAs expanding into CKD. Multi-target combination therapy becoming standard.',
  },
  sickleCell: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'Vertex/CRISPR', assetName: 'Casgevy (exagamglogene)', modality: 'geneTherapy', phase: 'approved', indication: 'Sickle cell disease', differentiator: 'First CRISPR gene therapy; one-time curative potential' },
      { companyName: 'Bluebird Bio', assetName: 'Lyfgenia (lovotibeglogene)', modality: 'geneTherapy', phase: 'approved', indication: 'Sickle cell disease', differentiator: 'Lentiviral gene therapy; functional cure approach' },
      { companyName: 'Pfizer', assetName: 'Oxbryta (voxelotor)', modality: 'smallMolecule', phase: 'approved', indication: 'Sickle cell disease', differentiator: 'HbS polymerization inhibitor; oral disease modification' },
    ],
    marketDynamics: 'Gene therapy has delivered curative potential but access limited by cost ($2-3M) and infrastructure. Small molecules provide accessible chronic management. In vivo gene editing approaches in early development could transform accessibility.',
  },

  // ====================================================
  // EXPANDED CARDIOVASCULAR INDICATIONS
  // ====================================================
  pulmonaryArterialHypertension: {
    density: 'high',
    keyAssets: [
      { companyName: 'Merck (ex-Acceleron)', assetName: 'Winrevair (sotatercept)', modality: 'mab', phase: 'approved', indication: 'PAH', differentiator: 'First activin signaling inhibitor; 76% risk reduction in ZENITH; blockbuster trajectory' },
      { companyName: 'United Therapeutics', assetName: 'Tyvaso DPI', modality: 'smallMolecule', phase: 'approved', indication: 'PAH/PH-ILD', differentiator: 'Inhaled treprostinil; dry powder convenience' },
      { companyName: 'J&J/Actelion', assetName: 'Opsumit + Uptravi', modality: 'smallMolecule', phase: 'approved', indication: 'PAH', differentiator: 'ERA + prostacyclin IP receptor agonist combination' },
    ],
    marketDynamics: 'Winrevair (sotatercept) has transformed the PAH landscape as a first-in-class disease-modifying therapy with overwhelming efficacy. Existing ERA/PDE5i/prostacyclin backbone remains relevant. Triple/quad combination regimens now standard. Next wave: corrective therapies targeting vascular remodeling.',
  },
  atrialFibrillation: {
    density: 'high',
    keyAssets: [
      { companyName: 'BMS/Pfizer', assetName: 'Eliquis (apixaban)', modality: 'smallMolecule', phase: 'approved', indication: 'AFib anticoagulation', differentiator: 'DOAC market leader; $20B+ franchise; facing patent cliff' },
      { companyName: 'Anthos/BMS', assetName: 'Abelacimab', modality: 'mab', phase: 'phase3', indication: 'AFib anticoagulation', expectedApprovalYear: 2027, differentiator: 'Anti-Factor XI antibody; monthly injection; potentially safer bleeding profile' },
      { companyName: 'Bayer', assetName: 'Asundexian', modality: 'smallMolecule', phase: 'phase3', indication: 'AFib anticoagulation', differentiator: 'Oral Factor XIa inhibitor; reduced bleeding potential vs DOACs' },
    ],
    marketDynamics: 'DOACs (Eliquis, Xarelto) face biosimilar/generic cliff 2026-2028. Factor XI/XIa inhibitors represent next generation with improved bleeding safety. Catheter ablation increasingly competing with drug therapy. $30B+ anticoagulant market in transition.',
  },
  dyslipidemia: {
    density: 'high',
    keyAssets: [
      { companyName: 'Novartis', assetName: 'Leqvio (inclisiran)', modality: 'rnai', phase: 'approved', indication: 'Hypercholesterolemia', differentiator: 'siRNA targeting PCSK9; twice-yearly injection; office-administered' },
      { companyName: 'Amgen', assetName: 'Repatha (evolocumab)', modality: 'mab', phase: 'approved', indication: 'Hypercholesterolemia', differentiator: 'PCSK9 antibody; proven CV outcomes; biweekly injection' },
      { companyName: 'NewAmsterdam/Esperion', assetName: 'Obicetrapib', modality: 'smallMolecule', phase: 'phase3', indication: 'Hypercholesterolemia', expectedApprovalYear: 2026, differentiator: 'CETP inhibitor; oral; 50%+ LDL reduction on top of statins' },
    ],
    marketDynamics: 'PCSK9 pathway validated but adoption limited by cost and injection burden. siRNA (inclisiran) offers twice-yearly dosing advantage. Oral CETP inhibitors (obicetrapib) could challenge injectable PCSK9 therapies. Statin generics dominate first-line. ApoC-III and Lp(a) targeting emerging.',
  },

  // ====================================================
  // EXPANDED INFECTIOUS DISEASE INDICATIONS
  // ====================================================
  hivAids: {
    density: 'high',
    keyAssets: [
      { companyName: 'Gilead', assetName: 'Sunlenca (lenacapavir)', modality: 'antiviral', phase: 'approved', indication: 'HIV (treatment + PrEP)', differentiator: 'First capsid inhibitor; twice-yearly injection; 100% efficacy in PURPOSE PrEP trials' },
      { companyName: 'ViiV/GSK', assetName: 'Cabenuva (cabotegravir + rilpivirine)', modality: 'antiviral', phase: 'approved', indication: 'HIV treatment', differentiator: 'First long-acting injectable ART; bimonthly dosing' },
      { companyName: 'Gilead', assetName: 'Lenacapavir + bNAbs (teropavimab + zinlirvimab)', modality: 'antiviral', phase: 'phase3', indication: 'HIV treatment', expectedApprovalYear: 2027, differentiator: 'Twice-yearly triple combo; Breakthrough Therapy Designation; 96% viral suppression' },
    ],
    marketDynamics: 'Long-acting therapies revolutionizing HIV. Lenacapavir emerging as backbone for treatment and prevention. bNAb combinations enable twice-yearly regimens. Cure research advancing (gene editing, broadly neutralizing antibodies). PrEP market expanding globally.',
  },
  rsv: {
    density: 'high',
    keyAssets: [
      { companyName: 'Pfizer', assetName: 'Abrysvo', modality: 'vaccinePreventive', phase: 'approved', indication: 'RSV prevention', differentiator: 'Dual infant + older adult indication; maternal immunization' },
      { companyName: 'Sanofi/AstraZeneca', assetName: 'Beyfortus (nirsevimab)', modality: 'mab', phase: 'approved', indication: 'RSV prevention infants', differentiator: 'Long-acting mAb; single dose for entire RSV season' },
      { companyName: 'GSK', assetName: 'Arexvy', modality: 'vaccinePreventive', phase: 'approved', indication: 'RSV (older adults)', differentiator: 'First RSV vaccine approved; adjuvanted for older adults' },
      { companyName: 'Moderna', assetName: 'mRESVIA', modality: 'mrna', phase: 'approved', indication: 'RSV (older adults)', differentiator: 'mRNA RSV vaccine; single-dose; 2024 approval' },
    ],
    marketDynamics: 'RSV prevention market exploded 2023-2024 with multiple vaccine and mAb approvals. Infant protection via maternal vaccine or nirsevimab. Older adult segment competitive between GSK, Pfizer, Moderna. Market projected >$10B by 2030.',
  },
  hepatitisB: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'GSK/Vir', assetName: 'VIR-2218 (elebsiran)', modality: 'rnai', phase: 'phase2', indication: 'Chronic HBV', differentiator: 'siRNA targeting HBsAg; functional cure potential' },
      { companyName: 'Ionis/GSK', assetName: 'Bepirovirsen', modality: 'aso', phase: 'phase3', indication: 'Chronic HBV', expectedApprovalYear: 2027, differentiator: 'Antisense oligonucleotide; surface antigen loss in subsets' },
      { companyName: 'Arbutus/Assembly', assetName: 'Imdusiran + AB-836', modality: 'rnai', phase: 'phase2', indication: 'Chronic HBV', differentiator: 'RNAi + capsid assembly modulator combo; multi-mechanism approach' },
    ],
    marketDynamics: 'Chronic HBV affects 250M+ globally. Current nucleoside analogs suppress but rarely cure. Functional cure (HBsAg loss) is the goal. RNAi and ASO approaches most advanced. Combination strategies (RNAi + immunomodulator + CAM) in development. Massive global health opportunity.',
  },

  // ====================================================
  // EXPANDED OPHTHALMOLOGY INDICATIONS
  // ====================================================
  diabeticMacularEdema: {
    density: 'high',
    keyAssets: [
      { companyName: 'Roche', assetName: 'Vabysmo (faricimab)', modality: 'antiVegf', phase: 'approved', indication: 'DME', differentiator: 'Bispecific anti-VEGF/Ang-2; up to 16-week dosing intervals' },
      { companyName: 'Regeneron', assetName: 'Eylea HD (aflibercept 8mg)', modality: 'antiVegf', phase: 'approved', indication: 'DME', differentiator: 'High-dose formulation; extended treatment intervals' },
      { companyName: 'Allergan/AbbVie', assetName: 'Ozurdex (dexamethasone implant)', modality: 'intravitreal', phase: 'approved', indication: 'DME', differentiator: 'Steroid implant; non-VEGF mechanism; fewer injections' },
    ],
    marketDynamics: 'Anti-VEGF remains first-line. Extended-dosing formulations reducing injection burden. Biosimilar ranibizumab creating pricing pressure. Port delivery systems and gene therapy approaches targeting "one and done" treatment paradigms.',
  },
  glaucoma: {
    density: 'high',
    keyAssets: [
      { companyName: 'Santen', assetName: 'Omidenepag isopropyl (OMLONTI)', modality: 'topicalOphthalmic', phase: 'approved', indication: 'Glaucoma', differentiator: 'Selective EP2 agonist; non-prostaglandin; once-daily drop' },
      { companyName: 'Various', assetName: 'ROCK inhibitors (netarsudil)', modality: 'topicalOphthalmic', phase: 'approved', indication: 'Glaucoma', differentiator: 'Novel rho kinase mechanism; works on trabecular meshwork outflow' },
      { companyName: 'Aerie/Alcon', assetName: 'Rocklatan (netarsudil/latanoprost)', modality: 'topicalOphthalmic', phase: 'approved', indication: 'Glaucoma', differentiator: 'Fixed-dose ROCK inhibitor + prostaglandin combo; dual mechanism' },
    ],
    marketDynamics: 'Prostaglandin analogs remain first-line generics. ROCK inhibitors adding new mechanism class. MIGS devices competing with medical therapy. Sustained-release implants (Durysta) reducing adherence burden. Gene therapy approaches in early development.',
  },

  // ====================================================
  // ADDITIONAL ONCOLOGY — Hematologic & Rare Solid Tumors
  // ====================================================
  aml: {
    density: 'very_high',
    keyAssets: [
      { companyName: 'AbbVie', assetName: 'Venetoclax (Venclexta)', modality: 'smallMolecule', phase: 'approved', indication: 'AML', differentiator: 'BCL-2 inhibitor; transformed elderly/unfit AML treatment; combo with HMAs standard of care' },
      { companyName: 'Astellas/Pfizer', assetName: 'Gilteritinib (Xospata)', modality: 'smallMolecule', phase: 'approved', indication: 'FLT3+ AML', differentiator: 'Selective FLT3 inhibitor for FLT3-mutated relapsed/refractory AML' },
      { companyName: 'Servier', assetName: 'Ivosidenib (Tibsovo)', modality: 'smallMolecule', phase: 'approved', indication: 'IDH1+ AML', differentiator: 'IDH1 inhibitor; oral precision therapy for IDH1-mutated AML' },
      { companyName: 'Syndax/Incyte', assetName: 'Revumenib', modality: 'smallMolecule', phase: 'approved', indication: 'KMT2A-rearranged AML', differentiator: 'Menin inhibitor; first-in-class for KMT2Ar leukemia; 2024 approval' },
    ],
    marketDynamics: 'Venetoclax combos dominate frontline unfit AML. FLT3 and IDH precision therapies expanding. Menin inhibitors (revumenib, ziftomenib) opening new targetable subset. CD123 and CD33 ADCs and BiTEs in development. Measurable residual disease-guided therapy emerging.',
  },
  myeloma: {
    density: 'very_high',
    keyAssets: [
      { companyName: 'J&J/Legend', assetName: 'Carvykti (cilta-cel)', modality: 'cellTherapy', phase: 'approved', indication: 'Multiple myeloma', differentiator: 'BCMA-directed CAR-T; 98% ORR; moved to 2L+ in 2024' },
      { companyName: 'BMS/Bluebird', assetName: 'Abecma (ide-cel)', modality: 'cellTherapy', phase: 'approved', indication: 'Multiple myeloma', differentiator: 'First BCMA CAR-T approved; established class' },
      { companyName: 'Pfizer', assetName: 'Elrexfio (elranatamab)', modality: 'bispecific', phase: 'approved', indication: 'Multiple myeloma', differentiator: 'BCMA×CD3 bispecific; off-the-shelf alternative to CAR-T' },
      { companyName: 'J&J', assetName: 'Tecvayli (teclistamab)', modality: 'bispecific', phase: 'approved', indication: 'Multiple myeloma', differentiator: 'First BCMA bispecific approved; subcutaneous step-up dosing' },
      { companyName: 'GSK', assetName: 'Blenrep (belantamab mafodotin)', modality: 'adc', phase: 'approved', indication: 'Multiple myeloma', differentiator: 'BCMA ADC; reapproved 2024 in combo with standard backbone' },
    ],
    marketDynamics: 'BCMA-targeting therapies transforming relapsed/refractory myeloma. CAR-T vs bispecific competition intensifying. GPRC5D bispecifics (talquetamab) adding new targets. CELMoDs (mezigdomide) next-gen IMiDs. Earlier-line CAR-T studies ongoing. Move toward MRD-negativity as treatment goal.',
  },
  all: {
    density: 'high',
    keyAssets: [
      { companyName: 'Novartis', assetName: 'Kymriah (tisagenlecleucel)', modality: 'cellTherapy', phase: 'approved', indication: 'B-ALL', differentiator: 'First CAR-T approved; CD19-directed for pediatric/young adult B-ALL' },
      { companyName: 'Amgen', assetName: 'Blincyto (blinatumomab)', modality: 'bispecific', phase: 'approved', indication: 'B-ALL', differentiator: 'CD19×CD3 BiTE; shifted to frontline MRD+ ALL in 2024' },
      { companyName: 'Pfizer', assetName: 'Besponsa (inotuzumab ozogamicin)', modality: 'adc', phase: 'approved', indication: 'B-ALL', differentiator: 'CD22 ADC; high CR rates in relapsed B-ALL' },
    ],
    marketDynamics: 'Blinatumomab moving to frontline MRD-guided treatment. CAR-T consolidating in relapsed setting. CD22 and CD19 dual-targeting in development. Adult ALL outcomes improving toward pediatric cure rates. T-ALL remains difficult — no approved targeted therapies yet.',
  },
  dlbcl: {
    density: 'very_high',
    keyAssets: [
      { companyName: 'Roche', assetName: 'Polivy (polatuzumab vedotin)', modality: 'adc', phase: 'approved', indication: 'DLBCL', differentiator: 'CD79b ADC; part of frontline Pola-R-CHP replacing vincristine in R-CHOP' },
      { companyName: 'AbbVie/Genmab', assetName: 'Epkinly (epcoritamab)', modality: 'bispecific', phase: 'approved', indication: 'DLBCL', differentiator: 'CD20×CD3 bispecific; subcutaneous; no CAR-T manufacturing wait' },
      { companyName: 'Roche', assetName: 'Columvi (glofitamab)', modality: 'bispecific', phase: 'approved', indication: 'DLBCL', differentiator: 'CD20×CD3 bispecific; fixed-duration therapy (12 cycles)' },
      { companyName: 'Novartis/BMS/Gilead', assetName: 'CAR-T therapies (Kymriah/Breyanzi/Yescarta)', modality: 'cellTherapy', phase: 'approved', indication: 'DLBCL', differentiator: 'CD19 CAR-T; moved to 2L in 2022; curative potential' },
    ],
    marketDynamics: 'Bispecifics vs CAR-T competition defining 2L+ landscape. Pola-R-CHP changing frontline standard. Bispecific + lenalidomide combos showing high CR rates. Tafasitamab withdrawn — competitive pressure intense. Loncastuximab tesirine (CD19 ADC) in combo studies.',
  },
  gbm: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'BioNTech', assetName: 'BNT116', modality: 'mrna', phase: 'phase_2', indication: 'GBM', differentiator: 'mRNA neoantigen cancer vaccine; personalized tumor-specific approach' },
      { companyName: 'Northwest Biotherapeutics', assetName: 'DCVax-L', modality: 'cellTherapy', phase: 'phase_3', indication: 'GBM', differentiator: 'Autologous dendritic cell vaccine; survival benefit in Phase 3 in 2023' },
      { companyName: 'Servier/Zymeworks', assetName: 'ZW49', modality: 'adc', phase: 'phase_1', indication: 'GBM', differentiator: 'HER2 biparatopic ADC for HER2+ solid tumors including GBM' },
    ],
    marketDynamics: 'Temozolomide + radiation remains standard since 2005. CAR-T for GBM showing early signals (UPenn/Stanford). mRNA vaccines personalized approach promising. BBB penetration remains key challenge. Tumor treating fields (Optune) as device-based adjunct.',
  },
  liver: {
    density: 'very_high',
    keyAssets: [
      { companyName: 'Roche', assetName: 'Tecentriq + Avastin', modality: 'mab', phase: 'approved', indication: 'HCC', differentiator: 'Anti-PD-L1 + anti-VEGF combo; first-line HCC standard of care' },
      { companyName: 'AstraZeneca/BMS', assetName: 'Imfinzi + tremelimumab (STRIDE)', modality: 'mab', phase: 'approved', indication: 'HCC', differentiator: 'Anti-PD-L1 + anti-CTLA-4 STRIDE regimen; alternative 1L option' },
      { companyName: 'Merck/Eisai', assetName: 'Keytruda + Lenvima', modality: 'mab', phase: 'approved', indication: 'HCC', differentiator: 'Anti-PD-1 + multi-kinase TKI combo; 2L and moving to 1L' },
    ],
    marketDynamics: 'IO+anti-VEGF established as first-line HCC. CTLA-4 combos provide second option. ADCs targeting GPC3, claudin-18.2 in development. Adjuvant IO after resection/ablation (IMbrave050) positive. Biomarker-driven selection still needed.',
  },
  headNeck: {
    density: 'high',
    keyAssets: [
      { companyName: 'Merck', assetName: 'Keytruda', modality: 'mab', phase: 'approved', indication: 'HNSCC', differentiator: 'Anti-PD-1; first-line CPS≥1 HNSCC standard of care' },
      { companyName: 'BMS', assetName: 'Opdivo + chemo', modality: 'mab', phase: 'approved', indication: 'HNSCC', differentiator: 'Anti-PD-1 in first-line HNSCC; recent approval expansion' },
      { companyName: 'Seagen/Pfizer', assetName: 'Adcetris + pembro', modality: 'adc', phase: 'phase_2', indication: 'HNSCC', differentiator: 'ADC + IO combination in head and neck squamous cell carcinoma' },
    ],
    marketDynamics: 'IO+chemo standard in first-line. HPV status drives prognosis but not treatment selection. ADC combinations in development. Neoadjuvant IO studies showing pathological CR. De-escalation strategies for HPV+ disease evolving.',
  },

  // ====================================================
  // ADDITIONAL NEUROLOGY
  // ====================================================
  als: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'Biogen/Ionis', assetName: 'Qalsody (tofersen)', modality: 'aso', phase: 'approved', indication: 'SOD1 ALS', differentiator: 'First disease-modifying therapy for SOD1 ALS; accelerated approval 2023' },
      { companyName: 'Amylyx', assetName: 'Relyvrio (AMX0035)', modality: 'smallMolecule', phase: 'approved', indication: 'ALS', differentiator: 'Sodium phenylbutyrate/taurursodiol combo; approved 2022, voluntary withdrawal 2024 after Phase 3 miss' },
      { companyName: 'Denali/Biogen', assetName: 'DNL343', modality: 'smallMolecule', phase: 'phase_3', indication: 'ALS', differentiator: 'eIF2B activator addressing integrated stress response; Phase 3 HEALEY platform' },
    ],
    marketDynamics: 'SOD1-targeted therapy validated antisense approach for genetic ALS (~2% of cases). Sporadic ALS (98%) still lacks disease-modifying therapy. Platform trials (HEALEY) accelerating drug testing. Gene therapy approaches for C9orf72 and FUS mutations in early development.',
  },
  epilepsy: {
    density: 'high',
    keyAssets: [
      { companyName: 'UCB', assetName: 'Briviact (brivaracetam)', modality: 'smallMolecule', phase: 'approved', indication: 'Epilepsy', differentiator: 'SV2A modulator; improved selectivity over levetiracetam with fewer mood effects' },
      { companyName: 'SK Life Science/Arvelle', assetName: 'Cenobamate (XCOPRI)', modality: 'smallMolecule', phase: 'approved', indication: 'Focal epilepsy', differentiator: 'Sodium channel + GABA modulator; seizure-free rates >20% in refractory focal epilepsy' },
      { companyName: 'Marinus Pharmaceuticals', assetName: 'Ztalmy (ganaxolone)', modality: 'smallMolecule', phase: 'approved', indication: 'CDKL5 deficiency', differentiator: 'GABAA positive allosteric modulator; approved for CDKL5-related seizures' },
    ],
    marketDynamics: 'Cenobamate emerging as most effective focal epilepsy treatment. GABA modulators expanding for rare epilepsies. Gene therapy for monogenic epilepsies (Dravet, CDKL5) in development. Fenfluramine for Dravet/LGS approved. Anti-seizure medication optimization still primary treatment.',
  },
  huntingtons: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'Roche/Ionis', assetName: 'Tominersen', modality: 'aso', phase: 'phase_2', indication: 'Huntingtons', differentiator: 'HTT-lowering ASO; GENERATION HD2 studying lower doses after Phase 3 stopped' },
      { companyName: 'Wave Life Sciences', assetName: 'WVE-003', modality: 'aso', phase: 'phase_1', indication: 'Huntingtons', differentiator: 'Allele-selective ASO targeting mutant HTT while preserving wild-type' },
      { companyName: 'Novartis', assetName: 'Branaplam', modality: 'smallMolecule', phase: 'phase_2', indication: 'Huntingtons', differentiator: 'Oral HTT splicing modulator; initially developed for SMA' },
      { companyName: 'Takeda/PTC', assetName: 'PTC518', modality: 'smallMolecule', phase: 'phase_2', indication: 'Huntingtons', differentiator: 'Oral HTT splicing modulator; once-daily pill; clean safety profile so far' },
    ],
    marketDynamics: 'HTT-lowering remains the primary strategy after tominersen Phase 3 setback. Allele-selective approaches (Wave) avoiding wild-type HTT reduction. Oral splicing modulators (branaplam, PTC518) offering convenience. Gene editing approaches (Voyager, uniQure) in preclinical. No approved disease-modifying therapy yet.',
  },
  addiction: {
    density: 'low',
    keyAssets: [
      { companyName: 'Indivior', assetName: 'Sublocade (buprenorphine XR)', modality: 'depot', phase: 'approved', indication: 'Opioid use disorder', differentiator: 'Monthly extended-release buprenorphine injection; reduces diversion' },
      { companyName: 'Alkermes', assetName: 'Vivitrol (naltrexone XR)', modality: 'depot', phase: 'approved', indication: 'Alcohol/opioid dependence', differentiator: 'Monthly naltrexone injection; prevents relapse in opioid and alcohol use disorders' },
    ],
    marketDynamics: 'Medication-assisted treatment expanding for opioid crisis. Long-acting injectables reducing adherence barriers. Psychedelic-assisted therapy (MDMA, psilocybin) in late-stage trials for PTSD/depression with addiction applications. Anti-GLP-1 effects on cravings generating new research interest.',
  },

  // ====================================================
  // ADDITIONAL IMMUNOLOGY
  // ====================================================
  sle_lupus_expanded: {
    density: 'high',
    keyAssets: [
      { companyName: 'GSK', assetName: 'Benlysta (belimumab)', modality: 'mab', phase: 'approved', indication: 'SLE', differentiator: 'Anti-BLyS; first targeted therapy approved for SLE (2011); added lupus nephritis 2020' },
      { companyName: 'AstraZeneca', assetName: 'Saphnelo (anifrolumab)', modality: 'mab', phase: 'approved', indication: 'SLE', differentiator: 'Type I interferon receptor blocker; second targeted SLE therapy; skin + joint efficacy' },
      { companyName: 'Biogen/Aurinia', assetName: 'Lupkynis (voclosporin)', modality: 'smallMolecule', phase: 'approved', indication: 'Lupus nephritis', differentiator: 'Calcineurin inhibitor; first oral targeted therapy for lupus nephritis' },
    ],
    marketDynamics: 'Two approved targeted therapies (Benlysta, Saphnelo) plus voclosporin for lupus nephritis. CD19 CAR-T showing remarkable complete responses in refractory SLE (Kyverna, Cabaletta). Deucravacitinib (TYK2) in Phase 3 for SLE. Complement inhibitors in development.',
  },
  copd: {
    density: 'very_high',
    keyAssets: [
      { companyName: 'AstraZeneca', assetName: 'Tezspire (tezepelumab)', modality: 'mab', phase: 'phase_3', indication: 'COPD', differentiator: 'Anti-TSLP; expanding from asthma to eosinophilic COPD' },
      { companyName: 'Sanofi/Regeneron', assetName: 'Dupixent (dupilumab)', modality: 'mab', phase: 'phase_3', indication: 'COPD', differentiator: 'Anti-IL-4Rα; positive Phase 3 BOREAS & NOTUS in eosinophilic COPD 2024' },
      { companyName: 'Verona Pharma', assetName: 'Ohtuvayre (ensifentrine)', modality: 'smallMolecule', phase: 'approved', indication: 'COPD', differentiator: 'Dual PDE3/PDE4 inhibitor; first-in-class; nebulized; approved 2024' },
    ],
    marketDynamics: 'Biologics entering COPD for first time — Dupixent and tezepelumab targeting Type 2 high/eosinophilic COPD (~30% of patients). Ensifentrine first new mechanism bronchodilator in decades. Triple inhaler combos (Trelegy, Breztri) are current SOC. Anti-IL-33/TSLP targeting airway remodeling.',
  },
  ipf: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'Roche', assetName: 'Esbriet (pirfenidone)', modality: 'smallMolecule', phase: 'approved', indication: 'IPF', differentiator: 'Anti-fibrotic; slows FVC decline; generic available' },
      { companyName: 'BI', assetName: 'Ofev (nintedanib)', modality: 'smallMolecule', phase: 'approved', indication: 'IPF', differentiator: 'Triple kinase inhibitor; anti-fibrotic; expanded to SSc-ILD and progressive fibrosing ILD' },
      { companyName: 'Insilico Medicine', assetName: 'Rentosertib (ISM001-055)', modality: 'smallMolecule', phase: 'phase_2', indication: 'IPF', differentiator: 'AI-designed TNIK inhibitor; first AI-discovered drug in Phase 2 for IPF' },
    ],
    marketDynamics: 'Two approved anti-fibrotics slow decline but don\'t halt disease. Next-gen therapies targeting autotaxin (BMS), LPA1 (BMS), integrin αvβ6 (Pliant), and pentraxin-2 in development. Anti-IL-13 and anti-CCL2 strategies emerging. Combination approaches likely needed for meaningful efficacy improvement.',
  },
  myastheniaGravis: {
    density: 'high',
    keyAssets: [
      { companyName: 'Alexion/AZ', assetName: 'Ultomiris (ravulizumab)', modality: 'mab', phase: 'approved', indication: 'gMG (AChR+)', differentiator: 'Long-acting C5 complement inhibitor; every 8 weeks; $500K+/year' },
      { companyName: 'Argenx', assetName: 'Vyvgart (efgartigimod)', modality: 'mab', phase: 'approved', indication: 'gMG (AChR+)', differentiator: 'FcRn blocker; reduces pathogenic IgG; subcutaneous formulation 2023' },
      { companyName: 'UCB', assetName: 'Rystiggo (rozanolixizumab)', modality: 'mab', phase: 'approved', indication: 'gMG (AChR+)', differentiator: 'FcRn blocker; subcutaneous; broadening FcRn inhibitor class' },
    ],
    marketDynamics: 'FcRn inhibitors (Vyvgart, Rystiggo, nipocalimab) creating new treatment paradigm vs. complement inhibitors. Zilucoplan (subcutaneous C5) and C2/C3 inhibitors in development. Tolerogenic approaches and CAR-T for refractory MG in early trials. MuSK+ MG remains underserved.',
  },

  // ====================================================
  // ADDITIONAL METABOLIC
  // ====================================================
  type2Diabetes_expanded: {
    density: 'very_high',
    keyAssets: [
      { companyName: 'Novo Nordisk', assetName: 'Ozempic/Rybelsus (semaglutide)', modality: 'peptide', phase: 'approved', indication: 'T2D', differentiator: 'GLP-1 RA; best-in-class HbA1c + weight reduction; oral formulation available' },
      { companyName: 'Lilly', assetName: 'Mounjaro (tirzepatide)', modality: 'peptide', phase: 'approved', indication: 'T2D', differentiator: 'Dual GIP/GLP-1 RA; superior HbA1c and weight vs semaglutide' },
      { companyName: 'Lilly', assetName: 'Retatrutide', modality: 'peptide', phase: 'phase_3', indication: 'T2D/Obesity', differentiator: 'Triple GIP/GLP-1/glucagon RA; unprecedented 24% weight loss in Phase 2' },
      { companyName: 'Roche/Carmot', assetName: 'CT-996', modality: 'smallMolecule', phase: 'phase_2', indication: 'T2D/Obesity', differentiator: 'Oral GLP-1 RA small molecule; potentially disrupting injectable dominance' },
    ],
    marketDynamics: 'GLP-1/incretin class >$50B market and growing. Dual and triple agonists raising efficacy bar. Race for oral GLP-1 (Roche, Novo, Viking, Structure). Amylin analogs (Novo cagrilintide) and combination approaches in pipeline. Supply constraints driving massive manufacturing investment.',
  },
  type1Diabetes: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'Sanofi', assetName: 'Tzield (teplizumab)', modality: 'mab', phase: 'approved', indication: 'T1D delay', differentiator: 'Anti-CD3; first therapy to delay clinical T1D onset by ~2 years in at-risk individuals' },
      { companyName: 'Vertex', assetName: 'VX-880', modality: 'cellTherapy', phase: 'phase_2', indication: 'T1D', differentiator: 'Stem cell-derived islet cell therapy; insulin independence achieved in trials' },
      { companyName: 'CRISPR/ViaCyte', assetName: 'VCTX211', modality: 'cellTherapy', phase: 'phase_1', indication: 'T1D', differentiator: 'Gene-edited hypoimmune stem cell-derived islets; no immunosuppression needed' },
    ],
    marketDynamics: 'Teplizumab validated disease modification in pre-T1D. Stem cell-derived islet replacement potentially curative. Encapsulated cell devices reducing immunosuppression burden. GLP-1 agonists being studied as adjuncts in T1D. Combination immune tolerance + cell replacement the long-term goal.',
  },
  cysticFibrosis: {
    density: 'high',
    keyAssets: [
      { companyName: 'Vertex', assetName: 'Trikafta (elexacaftor/tezacaftor/ivacaftor)', modality: 'smallMolecule', phase: 'approved', indication: 'CF', differentiator: 'Triple CFTR modulator; treats ~90% of CF patients; transformed outcomes' },
      { companyName: 'Vertex', assetName: 'Vanzacaftor triple', modality: 'smallMolecule', phase: 'approved', indication: 'CF', differentiator: 'Next-gen triple; once-daily dosing; improved efficacy over Trikafta; approved 2025' },
      { companyName: 'Vertex/Arbor Bio', assetName: 'VX-522', modality: 'mrna', phase: 'phase_2', indication: 'CF', differentiator: 'Inhaled CFTR mRNA; addressing non-modulator-responsive mutations (~10%)' },
    ],
    marketDynamics: 'Vertex dominance with Trikafta/vanzacaftor triple covering 90%+ of CF patients. mRNA approaches targeting nonsense mutations unserved by modulators. Gene editing (base editing, prime editing) in preclinical. Anti-ENaC (mucosal hydration) as CF adjunct. $10B+ market with limited competition.',
  },
  obesity: {
    density: 'very_high',
    keyAssets: [
      { companyName: 'Novo Nordisk', assetName: 'Wegovy (semaglutide 2.4mg)', modality: 'peptide', phase: 'approved', indication: 'Obesity', differentiator: 'GLP-1 RA; ~15% weight loss; first CV outcomes benefit for obesity drug (SELECT)' },
      { companyName: 'Lilly', assetName: 'Zepbound (tirzepatide)', modality: 'peptide', phase: 'approved', indication: 'Obesity', differentiator: 'Dual GIP/GLP-1 RA; ~22% weight loss; surpassing semaglutide efficacy' },
      { companyName: 'Amgen', assetName: 'MariTide (maridebart cafraglutide)', modality: 'mab', phase: 'phase_3', indication: 'Obesity', differentiator: 'GIP receptor antibody + GLP-1 peptide; monthly dosing; maintains muscle mass' },
      { companyName: 'Viking Therapeutics', assetName: 'VK2735', modality: 'peptide', phase: 'phase_3', indication: 'Obesity', differentiator: 'Oral dual GLP-1/GIP agonist; convenient oral formulation' },
      { companyName: 'Roche/Carmot', assetName: 'CT-388', modality: 'peptide', phase: 'phase_2', indication: 'Obesity', differentiator: 'GLP-1/GIP dual agonist with differentiated profile; $2.7B Carmot acquisition' },
    ],
    marketDynamics: 'Projected >$150B market by 2030. Supply constraints driving competition. Oral formulations race (Roche, Viking, Structure, Novo). Muscle-sparing approaches (Amgen, BioAge, Regeneron). Triple agonists (retatrutide) pushing 24%+ weight loss. Combination approaches with myostatin, activin for body composition. Payers and access remain key barriers.',
  },

  // ====================================================
  // ADDITIONAL CARDIOVASCULAR
  // ====================================================
  cardiomyopathy: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'BMS/MyoKardia', assetName: 'Camzyos (mavacamten)', modality: 'smallMolecule', phase: 'approved', indication: 'Obstructive HCM', differentiator: 'First-in-class cardiac myosin inhibitor; reduces LVOT gradient; alternative to surgery' },
      { companyName: 'Cytokinetics', assetName: 'Aficamten', modality: 'smallMolecule', phase: 'phase_3', indication: 'Obstructive HCM', differentiator: 'Next-gen myosin inhibitor; wider therapeutic window than mavacamten' },
      { companyName: 'Tenaya', assetName: 'TN-201', modality: 'geneTherapy', phase: 'phase_1', indication: 'MYBPC3 HCM', differentiator: 'AAV gene therapy delivering MYBPC3 gene; potential curative for genetic HCM' },
    ],
    marketDynamics: 'Cardiac myosin inhibitors validated as drug class for HCM. Gene therapy for genetic cardiomyopathies in early stages. DCM (dilated) remains largely unaddressed — Kardigan\'s danicamtiv targeting this space. RNA therapies for ATTR cardiomyopathy (Alnylam patisiran/vutrisiran) established.',
  },
  coronaryArteryDisease: {
    density: 'high',
    keyAssets: [
      { companyName: 'Novartis', assetName: 'Leqvio (inclisiran)', modality: 'rnai', phase: 'approved', indication: 'ASCVD / High LDL-C', differentiator: 'Twice-yearly siRNA injection targeting PCSK9; 50%+ LDL-C reduction' },
      { companyName: 'Alnylam/Roche', assetName: 'Zilebesiran', modality: 'rnai', phase: 'phase_3', indication: 'Hypertension', differentiator: 'siRNA targeting angiotensinogen; quarterly injection for blood pressure control' },
      { companyName: 'Ionis/Novartis', assetName: 'Pelacarsen', modality: 'aso', phase: 'phase_3', indication: 'High Lp(a)', differentiator: 'ASO lowering Lp(a) by 80%+; Lp(a) HORIZON outcomes trial ongoing' },
    ],
    marketDynamics: 'RNA therapeutics transforming CV risk factor management with infrequent dosing. Lp(a) as validated new target with large addressable population (~20% elevated). PCSK9 siRNA/antibody competition. Anti-inflammatory approaches (IL-6, IL-1β) in post-MI trials. Oral PCSK9 inhibitors in development.',
  },

  // ====================================================
  // ADDITIONAL INFECTIOUS DISEASE
  // ====================================================
  influenza: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'Shionogi', assetName: 'Xofluza (baloxavir marboxil)', modality: 'smallMolecule', phase: 'approved', indication: 'Influenza', differentiator: 'Cap-dependent endonuclease inhibitor; single-dose oral treatment' },
      { companyName: 'Cidara/Merck', assetName: 'CD388', modality: 'conjugate', phase: 'phase_2', indication: 'Influenza prevention', differentiator: 'Drug-Fc conjugate; long-acting preventive; 75% symptom prevention over 6 months' },
    ],
    marketDynamics: 'Xofluza single-dose treatment gaining share from oseltamivir. Long-acting preventive (CD388) could be game-changing. Universal flu vaccine approaches (Moderna mRNA, M2e-based) in development. Broadly neutralizing antibody approach for pandemic preparedness.',
  },
  tuberculosis: {
    density: 'low',
    keyAssets: [
      { companyName: 'TB Alliance', assetName: 'BPaL regimen (pretomanid)', modality: 'smallMolecule', phase: 'approved', indication: 'XDR-TB / MDR-TB', differentiator: 'Pretomanid + bedaquiline + linezolid; 6-month oral regimen vs 18-month injectable' },
      { companyName: 'Otsuka', assetName: 'Delamanid (Deltyba)', modality: 'smallMolecule', phase: 'approved', indication: 'MDR-TB', differentiator: 'Nitroimidazole; second new TB drug class in 40 years' },
    ],
    marketDynamics: 'BPaL regimen transforming drug-resistant TB treatment. Ultra-short regimens (3-4 months) being studied. TB vaccines beyond BCG in development (M72/AS01E from GSK). Limited commercial incentive despite massive global burden — public-private partnerships drive R&D.',
  },

  // ====================================================
  // ADDITIONAL OPHTHALMOLOGY
  // ====================================================
  retinitisPigmentosa: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'Spark/Novartis', assetName: 'Luxturna (voretigene neparvovec)', modality: 'geneTherapy', phase: 'approved', indication: 'RPE65-RP / LCA', differentiator: 'First ocular gene therapy; RPE65 gene replacement; one-time treatment' },
      { companyName: 'Ocugen', assetName: 'OCU400', modality: 'geneTherapy', phase: 'phase_3', indication: 'Retinitis pigmentosa', differentiator: 'Modifier gene therapy (NR2E3); mutation-agnostic approach for multiple RP genes' },
      { companyName: 'Beacon Therapeutics', assetName: 'AGTC-501', modality: 'geneTherapy', phase: 'phase_2', indication: 'XLRP', differentiator: 'AAV gene therapy for X-linked RP targeting RPGR gene' },
    ],
    marketDynamics: 'Luxturna proved gene therapy works for inherited retinal diseases. Mutation-agnostic approaches (modifier genes, optogenetics) expanding addressable population. Over 100 genes cause RP — one-gene-at-a-time approach has scale limitations. Optogenetics (GenSight) offering vision restoration for late-stage degeneration.',
  },
  dryEyeDisease: {
    density: 'high',
    keyAssets: [
      { companyName: 'Novartis/AbbVie', assetName: 'Xiidra (lifitegrast)', modality: 'topicalOphthalmic', phase: 'approved', indication: 'Dry eye disease', differentiator: 'LFA-1 antagonist; anti-inflammatory mechanism distinct from cyclosporine' },
      { companyName: 'AbbVie/Allergan', assetName: 'Restasis (cyclosporine)', modality: 'topicalOphthalmic', phase: 'approved', indication: 'Dry eye disease', differentiator: 'Calcineurin inhibitor; established DED therapy; generic competition' },
      { companyName: 'Aldeyra', assetName: 'Reproxalap', modality: 'smallMolecule', phase: 'phase_3', indication: 'Dry eye disease', differentiator: 'RASP inhibitor; novel mechanism targeting TRPA1-mediated inflammation' },
      { companyName: 'Tyrvaya/Oyster Point', assetName: 'Tyrvaya (varenicline)', modality: 'topicalOphthalmic', phase: 'approved', indication: 'Dry eye disease', differentiator: 'Nasal spray activating trigeminal nerve; natural tear production' },
    ],
    marketDynamics: 'Large market ($6B+) with high unmet need. Xiidra and Restasis are established anti-inflammatory options. Novel mechanisms (RASP, TRPA1, nasal stimulation) differentiating. OTC artificial tears still dominate. Chronic disease model with high patient volume but adherence challenges.',
  },
  diabeticRetinopathy: {
    density: 'high',
    keyAssets: [
      { companyName: 'Roche', assetName: 'Vabysmo (faricimab)', modality: 'bispecific', phase: 'approved', indication: 'DME/DR', differentiator: 'First bispecific for retinal disease; Ang-2/VEGF-A dual blockade; up to 16-week dosing' },
      { companyName: 'Regeneron', assetName: 'Eylea HD (aflibercept 8mg)', modality: 'mab', phase: 'approved', indication: 'DME/DR', differentiator: 'High-dose aflibercept; extended to 12-16 week dosing; maintaining anti-VEGF efficacy' },
      { companyName: 'Kodiak Sciences', assetName: 'Tarcocimab tedromer (KSI-301)', modality: 'mab', phase: 'phase_3', indication: 'DME', differentiator: 'Antibody biopolymer conjugate; 6-month dosing potential; ABC platform' },
    ],
    marketDynamics: 'Anti-VEGF dominates but treatment burden (frequent injections) remains key issue. Faricimab and high-dose aflibercept extending dosing intervals. Gene therapy for continuous anti-VEGF delivery (REGENXBIO, Adverum) in trials. Port delivery systems and sustained-release implants in development.',
  },

  // ====================================================
  // ADDITIONAL WOMEN'S HEALTH
  // ====================================================
  pcos: {
    density: 'low',
    keyAssets: [
      { companyName: 'Spruce Biosciences', assetName: 'Tildacerfont', modality: 'smallMolecule', phase: 'phase_2', indication: 'CAH/PCOS', differentiator: 'CRF1 antagonist; reducing excess androgens; repositioned from CAH' },
      { companyName: 'Daré Bioscience', assetName: 'Ovaprene', modality: 'medicalDevice', phase: 'phase_3', indication: 'Contraception', differentiator: 'Hormone-free intravaginal ring; relevant for PCOS patients avoiding hormonal contraception' },
    ],
    marketDynamics: 'No FDA-approved treatments specifically for PCOS despite affecting 6-12% of women. Off-label metformin, OCP, spironolactone are current standard. GLP-1 agonists being studied for PCOS-related metabolic dysfunction. Ovasitol (inositol) popular but lacks robust evidence. Major unmet need and growing awareness.',
  },
  postpartumDepression: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'Sage/Biogen', assetName: 'Zurzuvae (zuranolone)', modality: 'smallMolecule', phase: 'approved', indication: 'Postpartum depression', differentiator: 'First oral PPD treatment; 14-day course; GABAA positive allosteric modulator' },
      { companyName: 'Sage', assetName: 'Zulresso (brexanolone)', modality: 'smallMolecule', phase: 'approved', indication: 'Postpartum depression', differentiator: 'First PPD-specific therapy; IV neuroactive steroid; 60-hour infusion' },
    ],
    marketDynamics: 'Zuranolone transformed PPD treatment — first oral option with rapid onset (day 3). Previously only brexanolone IV infusion or off-label SSRIs available. Expanding awareness and screening increasing diagnosis rates. GABAergic mechanism validated for PPD pathophysiology.',
  },
  contraceptionNovel: {
    density: 'low',
    keyAssets: [
      { companyName: 'YourChoice Therapeutics', assetName: 'YCT-529', modality: 'smallMolecule', phase: 'phase_1', indication: 'Male contraception', differentiator: 'Non-hormonal RAR-alpha inhibitor; first hormone-free male contraceptive in clinical trials' },
      { companyName: 'Daré Bioscience', assetName: 'DARE-HRT1', modality: 'smallMolecule', phase: 'phase_2', indication: 'Contraception / HRT', differentiator: 'Bio-identical hormone combination for perimenopause contraception' },
    ],
    marketDynamics: 'Male contraception a massive underserved market — no approved non-barrier method exists. Non-hormonal approaches (RAR-alpha, CatSper) in early stages. Female non-hormonal contraceptives also in demand. Combination contraception + menopause management emerging for perimenopause. Investor interest rising in contraception innovation.',
  },

  // ====================================================
  // ADDITIONAL NEUROLOGY — HIGH-TRAFFIC INDICATIONS
  // ====================================================
  pain: {
    density: 'high',
    keyAssets: [
      { companyName: 'Vertex', assetName: 'Suzetrigine (VX-548)', modality: 'smallMolecule', phase: 'approved', indication: 'Acute pain', differentiator: 'First-in-class Nav1.8 inhibitor; non-opioid acute pain; FDA approved Jan 2025' },
      { companyName: 'Latuda/Nocion', assetName: 'NTX-1175', modality: 'smallMolecule', phase: 'phase_2', indication: 'Neuropathic pain', differentiator: 'Nav1.7 inhibitor with improved selectivity profile' },
      { companyName: 'Grunenthal/Vertex', assetName: 'VX-993/VX-548 chronic', modality: 'smallMolecule', phase: 'phase_3', indication: 'Chronic pain', differentiator: 'Nav1.8 inhibitor expansion into chronic pain indications (diabetic neuropathy, lumbosacral radiculopathy)' },
      { companyName: 'Abbvie', assetName: 'ABBV-382', modality: 'mab', phase: 'phase_2', indication: 'Chronic pain', differentiator: 'Anti-CGRP receptor antibody for osteoarthritis pain' },
    ],
    marketDynamics: 'Vertex suzetrigine is transformational — first new non-opioid mechanism for acute pain in decades. Nav1.8 validation driving massive pipeline investment. Chronic pain expansion (neuropathic, radiculopathy, OA) is the bigger prize. Opioid crisis creating regulatory tailwind for non-addictive alternatives. $30B+ chronic pain market largely unaddressed by non-opioid mechanisms.',
  },
  bipolar: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'Intra-Cellular', assetName: 'Caplyta (lumateperone)', modality: 'smallMolecule', phase: 'approved', indication: 'Bipolar depression', differentiator: 'Serotonin/dopamine/glutamate modulator; bipolar I/II depression; favorable metabolic profile' },
      { companyName: 'Sage/Biogen', assetName: 'Zuranolone', modality: 'smallMolecule', phase: 'phase_3', indication: 'Bipolar depression', differentiator: 'Neuroactive steroid GABAA PAM; rapid-onset antidepressant; 14-day oral course' },
      { companyName: 'BMS (Karuna)', assetName: 'KarXT (xanomeline-trospium)', modality: 'smallMolecule', phase: 'phase_3', indication: 'Bipolar I disorder', differentiator: 'Muscarinic agonist; novel non-D2 mechanism; acquired via $14B Karuna deal' },
    ],
    marketDynamics: 'Caplyta established new standard for bipolar depression with better tolerability than atypical antipsychotics. KarXT muscarinic mechanism could be transformative if bipolar data confirms. Neuroactive steroids (zuranolone) targeting rapid-onset for acute episodes. Growing recognition of bipolar II undertreatment driving diagnosis expansion.',
  },
  adhd: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'Supernus', assetName: 'Qelbree (viloxazine)', modality: 'smallMolecule', phase: 'approved', indication: 'ADHD', differentiator: 'Non-stimulant NE/5-HT modulator; adults and pediatric; growing share vs Strattera' },
      { companyName: 'Corium/Noven', assetName: 'AZSTARYS (serdexmethylphenidate)', modality: 'smallMolecule', phase: 'approved', indication: 'ADHD', differentiator: 'Prodrug methylphenidate; smoother PK; abuse-deterrent profile' },
      { companyName: 'Attentive Therapeutics', assetName: 'AT-1015', modality: 'smallMolecule', phase: 'phase_2', indication: 'ADHD', differentiator: 'Non-stimulant muscarinic M1 agonist; novel mechanism' },
    ],
    marketDynamics: 'Adult ADHD diagnosis surge driving market growth ($25B+ projected). Stimulant shortages creating opportunity for non-stimulants. Digital therapeutics (Akili EndeavorRx) proved concept but struggled commercially. Novel mechanisms (muscarinic, histamine H3) in early development. Combination approaches and extended-release formulations dominate.',
  },
  sma: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'Novartis', assetName: 'Zolgensma (onasemnogene)', modality: 'geneTherapy', phase: 'approved', indication: 'SMA Type 1', differentiator: 'One-time gene replacement; $2.1M list price; transformative for infants' },
      { companyName: 'Roche/Genentech', assetName: 'Evrysdi (risdiplam)', modality: 'smallMolecule', phase: 'approved', indication: 'SMA all types', differentiator: 'Oral SMN2 splicing modifier; daily dosing; all SMA types including adults' },
      { companyName: 'Biogen', assetName: 'Spinraza (nusinersen)', modality: 'aso', phase: 'approved', indication: 'SMA', differentiator: 'First SMA treatment; intrathecal ASO; established long-term efficacy data' },
    ],
    marketDynamics: 'Three approved mechanisms created competitive market. Gene therapy (Zolgensma) preferred for pre-symptomatic infants via newborn screening. Oral risdiplam gaining share in later-onset and adult SMA. Combination approaches being explored. Newborn screening expansion globally increasing addressable market.',
  },
  dmd: {
    density: 'high',
    keyAssets: [
      { companyName: 'Sarepta', assetName: 'Elevidys (delandistrogene moxeparvovec)', modality: 'geneTherapy', phase: 'approved', indication: 'DMD', differentiator: 'First gene therapy for DMD; micro-dystrophin AAV; accelerated approval 2023' },
      { companyName: 'Sarepta', assetName: 'Exondys 51 / Amondys 45 / Vyondys 53', modality: 'aso', phase: 'approved', indication: 'DMD exon skipping', differentiator: 'Exon-skipping antisense oligos covering ~30% of DMD mutations' },
      { companyName: 'Solid Biosciences', assetName: 'SGT-003', modality: 'geneTherapy', phase: 'phase_1', indication: 'DMD', differentiator: 'Next-gen AAV capsid with improved muscle tropism and higher micro-dystrophin expression' },
      { companyName: 'Dyne Therapeutics', assetName: 'DYNE-251', modality: 'aso', phase: 'phase_2', indication: 'DMD exon 51', differentiator: 'FORCE antibody-conjugated oligo; enhanced muscle delivery' },
    ],
    marketDynamics: 'Elevidys gene therapy landmark approval but confirmatory trials ongoing. Exon-skipping oligonucleotides established but modest efficacy. Next-gen gene therapies with better capsids in development. Antibody-oligonucleotide conjugates (Dyne, Avidity) promising enhanced delivery. Utrophin upregulation and CRISPR approaches in preclinical.',
  },

  // ====================================================
  // ADDITIONAL IMMUNOLOGY — HIGH-TRAFFIC INDICATIONS
  // ====================================================
  lupusNephritis: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'Aurinia', assetName: 'Lupkynis (voclosporin)', modality: 'smallMolecule', phase: 'approved', indication: 'Lupus nephritis', differentiator: 'Calcineurin inhibitor optimized for LN; first oral approved specifically for lupus nephritis' },
      { companyName: 'GSK', assetName: 'Benlysta (belimumab)', modality: 'mab', phase: 'approved', indication: 'Lupus nephritis', differentiator: 'Anti-BAFF; added to standard of care; renal endpoint benefit demonstrated' },
      { companyName: 'Novartis', assetName: 'Ianalumab', modality: 'mab', phase: 'phase_3', indication: 'Lupus nephritis', differentiator: 'Anti-BAFF receptor; complete B-cell depletion; potential best-in-class' },
    ],
    marketDynamics: 'Voclosporin and belimumab established new standard of care. Anti-CD20 (rituximab) used off-label extensively. Anti-BAFF receptor (ianalumab) could offer deeper B-cell depletion. CAR-T for refractory LN generating excitement from case reports. Major unmet need in refractory patients and complete remission rates.',
  },
  alopecia: {
    density: 'high',
    keyAssets: [
      { companyName: 'Lilly', assetName: 'Olumiant (baricitinib)', modality: 'smallMolecule', phase: 'approved', indication: 'Alopecia areata', differentiator: 'First systemic approved for AA; JAK1/2 inhibitor; established safety profile' },
      { companyName: 'Pfizer', assetName: 'Litfulo (ritlecitinib)', modality: 'smallMolecule', phase: 'approved', indication: 'Alopecia areata', differentiator: 'JAK3/TEC inhibitor; differentiated selectivity; approved for adolescents 12+' },
      { companyName: 'Concert Pharma/Sun', assetName: 'Deuruxolitinib', modality: 'smallMolecule', phase: 'phase_3', indication: 'Alopecia areata', differentiator: 'Deuterated JAK inhibitor; potentially improved PK' },
    ],
    marketDynamics: 'JAK inhibitors validated mechanism for AA. Two approved products competing on efficacy/safety. Topical JAK formulations in development to reduce systemic exposure. Growing awareness driving diagnosis and treatment-seeking. Expanding into pediatric and alopecia totalis/universalis segments.',
  },
  hidradenitis: {
    density: 'high',
    keyAssets: [
      { companyName: 'AbbVie', assetName: 'Humira (adalimumab)', modality: 'mab', phase: 'approved', indication: 'Hidradenitis suppurativa', differentiator: 'First approved biologic for HS; anti-TNF; established but modest efficacy' },
      { companyName: 'Novartis', assetName: 'Cosentyx (secukinumab)', modality: 'mab', phase: 'approved', indication: 'Hidradenitis suppurativa', differentiator: 'Anti-IL-17A; second approved biologic; SUNSHINE/SUNRISE data' },
      { companyName: 'UCB', assetName: 'Bimekizumab', modality: 'mab', phase: 'phase_3', indication: 'Hidradenitis suppurativa', differentiator: 'Dual IL-17A/F inhibitor; potentially superior to IL-17A alone' },
      { companyName: 'Incyte', assetName: 'Povorcitinib', modality: 'smallMolecule', phase: 'phase_3', indication: 'Hidradenitis suppurativa', differentiator: 'Oral JAK1 inhibitor; first oral option if approved; BE HEARD trials' },
    ],
    marketDynamics: 'HS significantly underdiagnosed — prevalence ~1% but most untreated. Anti-TNF modest efficacy driving search for better mechanisms. IL-17 inhibition (secukinumab, bimekizumab) showing promise. Oral JAK inhibitors could transform access. Complement (C5a) inhibitors in earlier development. Market projected $5B+ as diagnosis improves.',
  },
  igan: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'Chinook/Novartis', assetName: 'Atrasentan', modality: 'smallMolecule', phase: 'phase_3', indication: 'IgA nephropathy', differentiator: 'Selective endothelin-A receptor antagonist; ALIGN phase 3; $3.5B Chinook acquisition' },
      { companyName: 'Calliditas/Neocate', assetName: 'Tarpeyo (budesonide)', modality: 'smallMolecule', phase: 'approved', indication: 'IgA nephropathy', differentiator: 'Targeted-release budesonide; first IgAN-specific approved therapy; NEFIGARD data' },
      { companyName: 'Travere', assetName: 'Filspari (sparsentan)', modality: 'smallMolecule', phase: 'approved', indication: 'IgA nephropathy', differentiator: 'Dual endothelin/angiotensin receptor antagonist; PROTECT trial; accelerated approval' },
    ],
    marketDynamics: 'IgAN went from zero approved therapies to three mechanisms in 2 years — paradigm shift. Novartis acquired Chinook for $3.5B driven by atrasentan potential. APRIL-targeted therapies (Omeros, Visterra/Otsuka) in development for upstream mechanism. Combination approaches likely to be standard of care.',
  },
  eosinophilicEsophagitis: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'Sanofi/Regeneron', assetName: 'Dupixent (dupilumab)', modality: 'mab', phase: 'approved', indication: 'EoE', differentiator: 'First FDA-approved treatment for EoE; anti-IL-4/13; expanding age range' },
      { companyName: 'AstraZeneca', assetName: 'Fasenra (benralizumab)', modality: 'mab', phase: 'phase_3', indication: 'EoE', differentiator: 'Anti-IL-5Rα; afucosylated for enhanced ADCC; depletes eosinophils' },
      { companyName: 'Bristol Myers Squibb', assetName: 'Cendakimab', modality: 'mab', phase: 'phase_3', indication: 'EoE', differentiator: 'Anti-IL-13; targeted approach; SWIFTS trial' },
    ],
    marketDynamics: 'Dupixent established biologic treatment for EoE, previously managed only by PPI and dietary elimination. Anti-IL-13 (cendakimab) and anti-IL-5 (benralizumab) expanding options. Diagnosis rates surging with increased awareness. Pediatric approvals expanding addressable market. $5B+ opportunity as treatment-seeking increases.',
  },
  gvhd: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'Incyte', assetName: 'Jakafi (ruxolitinib)', modality: 'smallMolecule', phase: 'approved', indication: 'Acute/chronic GVHD', differentiator: 'JAK1/2 inhibitor; first approved for steroid-refractory GVHD; REACH trials' },
      { companyName: 'Kadmon/Sanofi', assetName: 'Rezurock (belumosudil)', modality: 'smallMolecule', phase: 'approved', indication: 'Chronic GVHD', differentiator: 'ROCK2 inhibitor; approved for 2L+ cGVHD; novel anti-fibrotic mechanism' },
      { companyName: 'Equillium', assetName: 'Itolizumab', modality: 'mab', phase: 'phase_3', indication: 'Acute GVHD', differentiator: 'Anti-CD6; blocks T-cell co-stimulation; prevention strategy' },
    ],
    marketDynamics: 'JAK inhibitors established standard for steroid-refractory GVHD. ROCK2 mechanism (belumosudil) validated anti-fibrotic approach. Growing transplant volumes and haploidentical donor expansion increasing GVHD incidence. Prevention strategies (post-transplant cyclophosphamide alternatives) emerging area of interest.',
  },

  // ====================================================
  // ADDITIONAL INFECTIOUS DISEASE — HIGH-TRAFFIC
  // ====================================================
  covid: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'Pfizer', assetName: 'Paxlovid (nirmatrelvir/ritonavir)', modality: 'smallMolecule', phase: 'approved', indication: 'COVID-19', differentiator: 'Mpro inhibitor; oral antiviral; standard of care for high-risk patients' },
      { companyName: 'Shionogi', assetName: 'Xocova (ensitrelvir)', modality: 'smallMolecule', phase: 'approved', indication: 'COVID-19', differentiator: '3CL protease inhibitor; approved in Japan; no ritonavir boosting needed' },
      { companyName: 'Pardes Biosciences/MSD', assetName: 'PBI-0451', modality: 'smallMolecule', phase: 'phase_2', indication: 'COVID-19', differentiator: 'Non-covalent Mpro inhibitor; designed to avoid resistance and drug interactions' },
    ],
    marketDynamics: 'Paxlovid dominates treatment market but rebound and drug interactions limit use. Next-gen antivirals targeting improved resistance profiles. Long-acting antibodies for immunocompromised (pemgarda). mRNA vaccine evolution toward combination respiratory vaccines (COVID+flu+RSV). Endemic phase shifting market from pandemic to annual boosters.',
  },
  amr_antibiotics: {
    density: 'low',
    keyAssets: [
      { companyName: 'Shionogi', assetName: 'Fetroja (cefiderocol)', modality: 'smallMolecule', phase: 'approved', indication: 'Gram-negative MDR', differentiator: 'Siderophore cephalosporin; active against all Ambler classes including metallo-beta-lactamases' },
      { companyName: 'Venatorx/Melinta', assetName: 'Ceftibuten/VNRX-7145', modality: 'smallMolecule', phase: 'phase_3', indication: 'MDR UTI', differentiator: 'Oral carbapenemase inhibitor + cephalosporin; first oral for ESBL/carbapenem-resistant' },
      { companyName: 'Entasis/Roche', assetName: 'Sulbactam-durlobactam (Xacduro)', modality: 'smallMolecule', phase: 'approved', indication: 'Acinetobacter', differentiator: 'First specifically approved for Acinetobacter; penicillin-binding protein inhibitor + beta-lactamase inhibitor' },
    ],
    marketDynamics: 'AMR declared global health emergency by WHO — 1.27M deaths annually. Pull incentive models (PASTEUR Act, UK subscription) attempting to fix broken economics. Most antibiotic companies failing commercially despite FDA approvals. Phage therapy and anti-virulence approaches in early stages. Global market needs ~$40B investment but returns remain uncertain.',
  },
  fungal: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'Scynexis', assetName: 'Brexafemme (ibrexafungerp)', modality: 'smallMolecule', phase: 'approved', indication: 'Vulvovaginal candidiasis', differentiator: 'First-in-class triterpenoid glucan synthase inhibitor; oral; expanding to invasive fungal' },
      { companyName: 'Cidara', assetName: 'Rezafungin', modality: 'smallMolecule', phase: 'approved', indication: 'Invasive candidiasis', differentiator: 'Long-acting echinocandin; once-weekly dosing; ReSTORE trial' },
      { companyName: 'F2G/Pfizer', assetName: 'Olorofim', modality: 'smallMolecule', phase: 'phase_3', indication: 'Invasive aspergillosis', differentiator: 'Orotomide antifungal; novel MOA; active against azole-resistant Aspergillus' },
    ],
    marketDynamics: 'Rising antifungal resistance (esp. Candida auris) creating urgent need. New drug classes emerging after 20-year drought (glucan synthase, orotomide). Immunocompromised population growing (cancer, transplant, biologics) expanding at-risk patients. Pfizer acquired F2G for olorofim. Anti-fungal market projected $20B+ by 2030.',
  },

  // ====================================================
  // ADDITIONAL CV — HIGH-TRAFFIC
  // ====================================================
  thrombosis: {
    density: 'high',
    keyAssets: [
      { companyName: 'Bristol Myers Squibb/J&J', assetName: 'Eliquis/Xarelto', modality: 'smallMolecule', phase: 'approved', indication: 'VTE/AF', differentiator: 'Factor Xa inhibitors; $30B+ combined franchise; going generic' },
      { companyName: 'BMS', assetName: 'Milvexian', modality: 'smallMolecule', phase: 'phase_3', indication: 'Thrombosis', differentiator: 'Factor XIa inhibitor; antithrombotic without bleeding risk; LIBREXIA trials' },
      { companyName: 'Bayer', assetName: 'Asundexian', modality: 'smallMolecule', phase: 'phase_3', indication: 'AF stroke prevention', differentiator: 'Factor XIa inhibitor; OCEANIC program; potential to replace DOACs with better safety' },
      { companyName: 'Anthos/Novartis', assetName: 'Abelacimab', modality: 'mab', phase: 'phase_3', indication: 'AF stroke prevention', differentiator: 'Anti-Factor XI antibody; monthly SC injection; near-complete FXI inhibition' },
    ],
    marketDynamics: 'Factor XI/XIa inhibitors represent the biggest anticoagulation advance since DOACs — thrombosis prevention without bleeding risk. Milvexian, asundexian, and abelacimab all in phase 3. Massive market as DOAC generics create need for differentiated next-gen. Antibody (abelacimab) vs oral small molecule competition. $40B+ anticoagulation market.',
  },
  hypertension: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'Alnylam', assetName: 'Zilebesiran', modality: 'rnai', phase: 'phase_3', indication: 'Hypertension', differentiator: 'RNAi targeting hepatic angiotensinogen; twice-yearly injection; KARDIA program with Roche' },
      { companyName: 'Ionis/AstraZeneca', assetName: 'ION-681032 (eplontersen-like AGT ASO)', modality: 'aso', phase: 'phase_2', indication: 'Hypertension', differentiator: 'Antisense targeting angiotensinogen; monthly dosing potential' },
      { companyName: 'CinCor Pharma/AstraZeneca', assetName: 'Baxdrostat', modality: 'smallMolecule', phase: 'phase_3', indication: 'Resistant hypertension', differentiator: 'Aldosterone synthase inhibitor; CYP11B2 selective; BrigHTN trials' },
    ],
    marketDynamics: 'RNA-targeting approaches (zilebesiran) could transform adherence — twice-yearly injection replacing daily pills. AstraZeneca deep investment in hypertension (baxdrostat, Ionis partnership). Resistant hypertension (~12% of hypertensives) major unmet need. Renal denervation (Medtronic, ReCor) offering device-based alternative. Generic RAAS agents dominate but innovation premium possible for adherence benefits.',
  },
};

/**
 * Analyze competitive landscape for a given indication.
 * Combines curated intelligence with live clinical trial data from the database.
 */
export async function analyzeCompetitiveLandscape(
  supabase: SupabaseClient,
  indication: string,
  therapeuticArea: string,
  modality?: string,
): Promise<CompetitiveLandscape> {
  // Start with curated data
  const curated = CURATED_COMPETITIVE_DATA[indication];

  // Query live trial data for competing assets
  let trialCount = 0;
  const byPhase: Record<string, number> = {};

  try {
    const { data: trials } = await supabase
      .from('company_trials')
      .select('company_name, phase, modality, indication_specific')
      .in('status', ['recruiting', 'active_not_recruiting', 'not_yet_recruiting'])
      .or(`indication_specific.eq.${indication},indication_category.eq.${getIndicationCategory(indication, therapeuticArea)}`)
      .limit(100);

    if (trials) {
      trialCount = trials.length;
      for (const trial of trials) {
        const phase = trial.phase || 'Unknown';
        byPhase[phase] = (byPhase[phase] || 0) + 1;
      }
    }
  } catch {
    // Database query failed — use curated data only
  }

  // Calculate competitive density score (0-100)
  let densityScore = 50; // default moderate
  if (curated) {
    const densityMap: Record<string, number> = {
      very_high: 85, high: 70, moderate: 50, low: 30, very_low: 15,
    };
    densityScore = densityMap[curated.density] || 50;
  }
  // Adjust by live trial count
  if (trialCount > 20) densityScore = Math.min(95, densityScore + 15);
  else if (trialCount > 10) densityScore = Math.min(90, densityScore + 10);
  else if (trialCount < 3) densityScore = Math.max(10, densityScore - 15);

  const keyCompetitors = curated?.keyAssets || [];
  const firstMoverAdvantage = densityScore < 40;

  // Market share erosion estimate
  const erosionMap: Record<string, number> = {
    very_high: 0.45, high: 0.30, moderate: 0.15, low: 0.08, very_low: 0.03,
  };
  const erosion = curated ? (erosionMap[curated.density] || 0.15) : Math.min(0.50, trialCount * 0.02);

  // Expected next approval
  const upcomingApprovals = keyCompetitors
    .filter(a => a.expectedApprovalYear && a.expectedApprovalYear > new Date().getFullYear())
    .sort((a, b) => (a.expectedApprovalYear || 9999) - (b.expectedApprovalYear || 9999));
  const expectedNextApproval = upcomingApprovals[0]
    ? { company: upcomingApprovals[0].companyName, year: upcomingApprovals[0].expectedApprovalYear! }
    : undefined;

  const narrative = curated?.marketDynamics ||
    `${trialCount} active clinical trials identified for this indication. ` +
    `Competitive density is ${densityScore > 70 ? 'high' : densityScore > 40 ? 'moderate' : 'low'}, ` +
    `suggesting ${densityScore > 70 ? 'significant competitive pressure' : densityScore > 40 ? 'a manageable competitive environment' : 'limited competition with potential first-mover advantage'}.`;

  return {
    indication,
    totalCompetingAssets: Math.max(trialCount, keyCompetitors.length),
    byPhase,
    keyCompetitors,
    competitiveDensityScore: densityScore,
    firstMoverAdvantage,
    expectedNextApproval,
    marketShareErosionEstimate: erosion,
    narrative,
  };
}

/** Map specific indication to its category for broader trial search */
function getIndicationCategory(indication: string, therapeuticArea: string): string {
  const categoryMap: Record<string, string> = {
    oncology: 'solid_tumor',
    neurology: 'cns',
    immunology: 'autoimmune',
    metabolic: 'metabolic',
    cardiovascular: 'cardiovascular',
    infectiousDisease: 'infectious_disease',
    ophthalmology: 'ophthalmology',
    womensHealth: 'reproductive',
  };
  return categoryMap[therapeuticArea] || therapeuticArea;
}
