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

  // ====================================================
  // BATCH 5 — EXPANDED INDICATIONS (P-S)
  // ====================================================
  penile: {
    density: 'very_low',
    keyAssets: [
      { companyName: 'Merck', assetName: 'Keytruda', modality: 'mab', phase: 'approved', indication: 'Penile cancer (MSI-H/TMB-H)', differentiator: 'Tissue-agnostic approval covers MSI-H/TMB-H penile SCC' },
      { companyName: 'BMS', assetName: 'Opdivo + Yervoy', modality: 'mab', phase: 'phase2', indication: 'Advanced penile SCC', differentiator: 'CheckMate trials exploring dual checkpoint in rare GU cancers' },
    ],
    marketDynamics: 'Ultra-rare cancer (~2,200 US cases/year). No dedicated approved therapies — treatment relies on cisplatin-based chemo and tissue-agnostic IO approvals. HPV-driven biology suggests vulnerability to checkpoint inhibitors. Clinical development limited by small patient numbers.',
  },
  peripheralNeuropathy: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'Pfizer', assetName: 'Lyrica (pregabalin)', modality: 'smallMolecule', phase: 'approved', indication: 'Diabetic peripheral neuropathy', differentiator: 'First-line standard; now generic; limited efficacy ceiling' },
      { companyName: 'Vertex', assetName: 'Suzetrigine (VX-548)', modality: 'smallMolecule', phase: 'approved', indication: 'Neuropathic pain', differentiator: 'First-in-class NaV1.8 inhibitor; non-opioid; FDA approved 2025' },
      { companyName: 'Lexicon', assetName: 'LX-9211', modality: 'smallMolecule', phase: 'phase2', indication: 'Diabetic peripheral neuropathy', differentiator: 'AAK1 inhibitor; novel pain target; differentiated mechanism' },
      { companyName: 'Lilly', assetName: 'Duloxetine (Cymbalta)', modality: 'smallMolecule', phase: 'approved', indication: 'Diabetic neuropathic pain', differentiator: 'SNRI with neuropathy indication; now generic' },
    ],
    marketDynamics: 'Large patient population (~20M diabetic neuropathy in US) but dominated by generics (pregabalin, duloxetine, gabapentin) with suboptimal efficacy. Vertex suzetrigine (NaV1.8) represents first novel mechanism in years. Significant unmet need for disease-modifying therapies beyond symptom management.',
  },
  pku: {
    density: 'low',
    keyAssets: [
      { companyName: 'BioMarin', assetName: 'Kuvan (sapropterin)', modality: 'smallMolecule', phase: 'approved', indication: 'PKU (BH4-responsive)', differentiator: 'First pharmacological therapy; effective in ~25-50% of patients' },
      { companyName: 'BioMarin', assetName: 'Palynziq (pegvaliase)', modality: 'peptide', phase: 'approved', indication: 'PKU', differentiator: 'PEGylated enzyme substitution; effective across genotypes; injection-site reactions limit use' },
      { companyName: 'Homology Medicines/Pfizer', assetName: 'HMI-103', modality: 'gene_therapy', phase: 'phase1', indication: 'PKU', differentiator: 'AAV-based gene therapy targeting liver PAH expression; potential one-time cure' },
      { companyName: 'Synlogic', assetName: 'SYNB1934', modality: 'other', phase: 'phase2', indication: 'PKU', differentiator: 'Engineered synthetic biotic; oral Phe degradation in GI tract' },
    ],
    marketDynamics: 'BioMarin dominates with both approved therapies. Gene therapy could be transformative but faces AAV immunogenicity challenges. ~50,000 patients in US/EU. Lifelong dietary restriction remains mainstay for many — unmet need for convenient, broadly effective Phe reduction.',
  },
  placentaAccreta: {
    density: 'very_low',
    keyAssets: [
      { companyName: 'Various', assetName: 'Uterine artery embolization', modality: 'other', phase: 'approved', indication: 'Placenta accreta spectrum', differentiator: 'Interventional radiology approach to reduce hemorrhage risk' },
    ],
    marketDynamics: 'No approved pharmacological therapies. Management is primarily surgical (cesarean hysterectomy). Incidence rising (~1 in 272 pregnancies) due to increasing cesarean rates. Opportunity for hemostatic agents, anti-angiogenics, or device-based interventions. Extremely underserved area with high maternal morbidity.',
  },
  pnh: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'Alexion/AstraZeneca', assetName: 'Ultomiris (ravulizumab)', modality: 'mab', phase: 'approved', indication: 'PNH', differentiator: 'Long-acting C5 inhibitor; 8-week dosing; ~$4B franchise with Soliris' },
      { companyName: 'Alexion/AstraZeneca', assetName: 'Soliris (eculizumab)', modality: 'mab', phase: 'approved', indication: 'PNH', differentiator: 'First complement inhibitor; established standard; transitioning to Ultomiris' },
      { companyName: 'Novartis', assetName: 'Fabhalta (iptacopan)', modality: 'smallMolecule', phase: 'approved', indication: 'PNH', differentiator: 'First oral complement factor B inhibitor; addresses extravascular hemolysis' },
      { companyName: 'Apellis', assetName: 'Empaveli (pegcetacoplan)', modality: 'peptide', phase: 'approved', indication: 'PNH', differentiator: 'Proximal C3 inhibitor; subcutaneous; targets extra- and intravascular hemolysis' },
      { companyName: 'BioCryst', assetName: 'Iptacopan competitors (oral Factor D)', modality: 'smallMolecule', phase: 'phase3', indication: 'PNH', differentiator: 'Oral factor D inhibitor; vying for oral complement share' },
    ],
    marketDynamics: 'Rapidly evolving from C5 antibody monopoly to multi-target complement landscape. Oral agents (iptacopan) disrupting injection-based paradigm. Proximal complement inhibition (C3, Factor B, Factor D) addresses residual hemolysis. ~$6B market despite rare disease status (~5,000 US patients).',
  },
  polymyalgiaRheumatica: {
    density: 'low',
    keyAssets: [
      { companyName: 'Sanofi/Regeneron', assetName: 'Kevzara (sarilumab)', modality: 'mab', phase: 'phase3', indication: 'Polymyalgia rheumatica', differentiator: 'IL-6 receptor antagonist; SAPHYR trial showed steroid-sparing benefit' },
      { companyName: 'AbbVie', assetName: 'Rinvoq (upadacitinib)', modality: 'smallMolecule', phase: 'phase3', indication: 'PMR', differentiator: 'JAK1 inhibitor; SELECT-PMR trial; oral steroid-sparing approach' },
    ],
    marketDynamics: 'Common inflammatory condition in elderly (~750K US patients) with no approved targeted therapy — steroids remain mainstay despite severe side effects. IL-6 blockade and JAK inhibition both showing promise as steroid-sparing strategies. High unmet need for safe long-term alternatives to prednisone.',
  },
  pompe: {
    density: 'low',
    keyAssets: [
      { companyName: 'Sanofi Genzyme', assetName: 'Lumizyme/Myozyme (alglucosidase alfa)', modality: 'other', phase: 'approved', indication: 'Pompe disease', differentiator: 'First ERT for Pompe; established standard; limited CNS penetration' },
      { companyName: 'Sanofi Genzyme', assetName: 'Nexviazyme (avalglucosidase alfa)', modality: 'other', phase: 'approved', indication: 'Pompe disease', differentiator: 'Next-gen ERT with enhanced M6P targeting; improved muscle uptake; COMET study superiority' },
      { companyName: 'Amicus Therapeutics', assetName: 'Cipaglucosidase + miglustat (Pombiliti + Opfolda)', modality: 'other', phase: 'approved', indication: 'Late-onset Pompe', differentiator: 'ERT + oral chaperone combo; stabilized enzyme; PROPEL trial' },
      { companyName: 'Spark/Roche', assetName: 'SPK-3006', modality: 'gene_therapy', phase: 'phase1', indication: 'Pompe disease', differentiator: 'AAV-based gene therapy; liver-directed GAA expression; potential one-time treatment' },
    ],
    marketDynamics: 'Three ERTs now approved, breaking Sanofi monopoly. Amicus combo offering differentiated approach. Gene therapy in early development could transform treatment paradigm. ~5,000-10,000 patients worldwide. Unmet need: CNS manifestations, immune tolerance, and long-term muscle decline despite ERT.',
  },
  porphyria: {
    density: 'low',
    keyAssets: [
      { companyName: 'Alnylam', assetName: 'Givlaari (givosiran)', modality: 'rnai', phase: 'approved', indication: 'Acute hepatic porphyria', differentiator: 'First RNAi therapy for AHP; monthly SC injection; 74% reduction in attacks' },
      { companyName: 'Alnylam', assetName: 'Hemin (Panhematin)', modality: 'other', phase: 'approved', indication: 'Acute porphyria attacks', differentiator: 'IV hemin for acute attacks; cumbersome administration; Alnylam distributes' },
      { companyName: 'Mitsubishi Tanabe', assetName: 'MT-7117 (dersimelagon)', modality: 'smallMolecule', phase: 'phase3', indication: 'Erythropoietic protoporphyria', differentiator: 'Oral MC1R agonist; melanin-independent photoprotection; AURORA trial' },
    ],
    marketDynamics: 'Givosiran transformed AHP management from reactive (IV hemin) to preventive (RNAi). Erythropoietic porphyrias remain underserved — dersimelagon addressing photosensitivity in EPP. Ultra-rare (~5,000 symptomatic AHP patients globally). Alnylam dominates the hepatic porphyria space.',
  },
  praderWilli: {
    density: 'low',
    keyAssets: [
      { companyName: 'Rhythm Pharmaceuticals', assetName: 'DCCR (diazoxide choline CR)', modality: 'smallMolecule', phase: 'phase3', indication: 'Prader-Willi syndrome', differentiator: 'Potassium channel opener targeting hyperphagia; mixed Phase 3 results' },
      { companyName: 'Levo Therapeutics', assetName: 'LV-101 (intranasal carbetocin)', modality: 'peptide', phase: 'phase3', indication: 'Prader-Willi syndrome', differentiator: 'Oxytocin analog targeting hyperphagia and behavioral symptoms' },
      { companyName: 'Novo Nordisk', assetName: 'Semaglutide', modality: 'peptide', phase: 'phase2', indication: 'PWS-associated obesity', differentiator: 'GLP-1 RA being explored for PWS hyperphagia; leveraging obesity platform' },
    ],
    marketDynamics: 'No approved treatment for hyperphagia, the core feature of PWS. Growth hormone is approved for growth/body composition but does not address insatiable hunger. ~20,000 US patients. GLP-1 agonists generating interest but PWS-specific mechanisms (hypothalamic dysfunction) may limit efficacy. Significant unmet need.',
  },
  preeclampsia: {
    density: 'low',
    keyAssets: [
      { companyName: 'Nuvance/Renibus', assetName: 'Statin therapy (pravastatin)', modality: 'smallMolecule', phase: 'phase3', indication: 'Preeclampsia prevention', differentiator: 'Repurposed statin; multiple investigator-led trials; anti-angiogenic rationale' },
      { companyName: 'Bayer', assetName: 'Low-dose aspirin', modality: 'smallMolecule', phase: 'approved', indication: 'Preeclampsia prevention', differentiator: 'ACOG-recommended prophylaxis for high-risk women; modest effect size' },
      { companyName: 'Foresight Diagnostics', assetName: 'sFlt-1/PlGF ratio tests', modality: 'other', phase: 'approved', indication: 'Preeclampsia prediction', differentiator: 'Biomarker-guided risk stratification; Roche Elecsys test approved in EU' },
    ],
    marketDynamics: 'No targeted therapeutic approved. Low-dose aspirin is preventive standard but insufficient. sFlt-1/PlGF biomarkers improving diagnosis but no approved anti-sFlt-1 therapy. Affects 2-8% of pregnancies globally; leading cause of maternal mortality. Massive unmet need for disease-modifying intervention.',
  },
  prematureLabor: {
    density: 'low',
    keyAssets: [
      { companyName: 'Ferring', assetName: 'Tractocile (atosiban)', modality: 'peptide', phase: 'approved', indication: 'Preterm labor (EU)', differentiator: 'Oxytocin receptor antagonist; approved in EU but not US; 48-hour delay' },
      { companyName: 'Various', assetName: 'Nifedipine', modality: 'smallMolecule', phase: 'approved', indication: 'Tocolysis', differentiator: 'Off-label calcium channel blocker; widely used first-line tocolytic' },
      { companyName: 'Various', assetName: 'Indomethacin', modality: 'smallMolecule', phase: 'approved', indication: 'Tocolysis (<32 weeks)', differentiator: 'COX inhibitor; effective but limited to short courses before 32 weeks' },
    ],
    marketDynamics: 'FDA withdrew Makena (17-OHP) in 2023 after failed PROLONG trial, leaving no approved US preventive therapy. Tocolytics only delay delivery 48 hours. Preterm birth affects ~10% of pregnancies and is leading cause of neonatal mortality. Critical gap in prevention and disease modification.',
  },
  presbyopia: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'AbbVie (Allergan)', assetName: 'Vuity (pilocarpine 1.25%)', modality: 'smallMolecule', phase: 'approved', indication: 'Presbyopia', differentiator: 'First FDA-approved eye drop; miotic effect; short duration limits adoption' },
      { companyName: 'Orasis Pharma', assetName: 'CSF-1 (pilocarpine microdose)', modality: 'smallMolecule', phase: 'phase3', indication: 'Presbyopia', differentiator: 'Optimized pilocarpine formulation; improved tolerability profile' },
      { companyName: 'Lenz Therapeutics', assetName: 'LNZ100 (aceclidine)', modality: 'smallMolecule', phase: 'phase3', indication: 'Presbyopia', differentiator: 'Muscarinic agonist with reduced dimming effect; better night vision' },
      { companyName: 'Ocuphire/Vyluma', assetName: 'Nyxol (phentolamine)', modality: 'smallMolecule', phase: 'phase3', indication: 'Presbyopia', differentiator: 'Alpha-antagonist approach; different mechanism from pilocarpine' },
    ],
    marketDynamics: 'Vuity launch underperformed ($50M peak) due to short duration and side effects. Multiple next-gen drops in Phase 3 aiming for better tolerability. ~1.8B people globally affected. Massive addressable market if convenient drop with durable effect achieved. Surgical options (corneal inlays, lens replacement) compete.',
  },
  primaryCNSLymphoma: {
    density: 'very_low',
    keyAssets: [
      { companyName: 'Various', assetName: 'High-dose methotrexate-based regimens', modality: 'smallMolecule', phase: 'approved', indication: 'Primary CNS lymphoma', differentiator: 'Standard backbone; requires intensive monitoring; ~50-70% response rate' },
      { companyName: 'Kite/Gilead', assetName: 'Yescarta (axi-cel)', modality: 'car_t', phase: 'phase2', indication: 'Relapsed PCNSL', differentiator: 'CAR-T being explored in CNS lymphoma; BBB penetration challenge' },
      { companyName: 'AbbVie', assetName: 'Ibrutinib (Imbruvica)', modality: 'smallMolecule', phase: 'phase2', indication: 'Relapsed PCNSL', differentiator: 'BTK inhibitor with CNS penetration; single-agent responses in relapsed setting' },
    ],
    marketDynamics: 'Rare aggressive lymphoma (~1,500 US cases/year) with no FDA-approved targeted therapy. High-dose methotrexate backbone for decades. BTK inhibitors showing promise due to CNS penetration. CAR-T being explored but BBB and neurotoxicity concerns. Median survival improving but relapse common.',
  },
  primaryImmunodeficiency: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'Takeda', assetName: 'HyQvia/GAMMAGARD', modality: 'other', phase: 'approved', indication: 'Primary immunodeficiency', differentiator: 'Subcutaneous and IV Ig replacement; facilitated SC with hyaluronidase; market leader' },
      { companyName: 'CSL Behring', assetName: 'Hizentra/Privigen', modality: 'other', phase: 'approved', indication: 'Primary immunodeficiency', differentiator: 'SC and IV immunoglobulin; broad portfolio; largest plasma collector' },
      { companyName: 'Grifols', assetName: 'Xembify/Gamunex-C', modality: 'other', phase: 'approved', indication: 'Primary immunodeficiency', differentiator: 'SC and IV Ig options; competitive pricing' },
      { companyName: 'Pharming', assetName: 'Leniolisib (Joenja)', modality: 'smallMolecule', phase: 'approved', indication: 'APDS (PI3Kδ overactivation)', differentiator: 'First targeted therapy for APDS; PI3Kδ inhibitor; precision medicine approach' },
    ],
    marketDynamics: 'Immunoglobulin replacement is $15B+ global market, dominated by plasma-derived Ig from Takeda, CSL, and Grifols. Chronic plasma supply constraints drive pricing. Emerging shift toward targeted therapies for defined PID subtypes (e.g., leniolisib for APDS). Gene therapy potential for SCID and other monogenic PIDs.',
  },
  psc: {
    density: 'low',
    keyAssets: [
      { companyName: 'Gilead', assetName: 'Cilofexor + firsocostat', modality: 'smallMolecule', phase: 'phase2', indication: 'PSC', differentiator: 'FXR agonist + ACC inhibitor combo; anti-fibrotic approach' },
      { companyName: 'CymaBay/Gilead', assetName: 'Seladelpar', modality: 'smallMolecule', phase: 'phase3', indication: 'PSC', differentiator: 'PPARδ agonist; successful in PBC; now exploring PSC' },
      { companyName: 'Pliant Therapeutics', assetName: 'Bexotegrast', modality: 'smallMolecule', phase: 'phase2', indication: 'PSC', differentiator: 'Dual αvβ6/αvβ1 integrin inhibitor; anti-fibrotic; INTEGRIS-PSC trial' },
    ],
    marketDynamics: 'No approved therapy for PSC — only liver transplant for advanced disease. Ursodiol widely used off-label but unproven for survival benefit. Multiple mechanisms in trials (FXR, PPARδ, integrins). ~30,000 US patients, high unmet need. IBD comorbidity complicates management. Historically a graveyard for clinical trials.',
  },
  psoriaticArthritis: {
    density: 'very_high',
    keyAssets: [
      { companyName: 'AbbVie', assetName: 'Skyrizi (risankizumab)', modality: 'mab', phase: 'approved', indication: 'Psoriatic arthritis', differentiator: 'IL-23 inhibitor; expanding from psoriasis; KEEPsAKE trials' },
      { companyName: 'UCB', assetName: 'Bimzelx (bimekizumab)', modality: 'mab', phase: 'approved', indication: 'Psoriatic arthritis', differentiator: 'Dual IL-17A/F blockade; superior skin and joint outcomes' },
      { companyName: 'AbbVie', assetName: 'Rinvoq (upadacitinib)', modality: 'smallMolecule', phase: 'approved', indication: 'Psoriatic arthritis', differentiator: 'Oral JAK1 inhibitor; SELECT-PsA program; CV box warning' },
      { companyName: 'Janssen', assetName: 'Tremfya (guselkumab)', modality: 'mab', phase: 'approved', indication: 'Psoriatic arthritis', differentiator: 'IL-23 inhibitor; dual domain mechanism targeting both joints and skin' },
      { companyName: 'Novartis', assetName: 'Cosentyx (secukinumab)', modality: 'mab', phase: 'approved', indication: 'Psoriatic arthritis', differentiator: 'IL-17A inhibitor; broad approval across SpA; $5B franchise' },
    ],
    marketDynamics: 'Crowded market with IL-17, IL-23, JAK, TNF, and PDE4 mechanisms all approved. IL-23 biologics gaining share due to efficacy + safety. Bimekizumab dual IL-17A/F showing best combined skin/joint data. Treatment algorithms evolving toward earlier biologic use. ~$8B market overlapping with psoriasis.',
  },
  ptsd: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'Lykos Therapeutics', assetName: 'MDMA-assisted therapy (midomafetamine)', modality: 'smallMolecule', phase: 'phase3', indication: 'PTSD', differentiator: 'Psychedelic-assisted therapy; strong Phase 3 data; FDA rejected 2024 citing need for more data' },
      { companyName: 'Bionomics', assetName: 'BNC210 (IW-2143)', modality: 'smallMolecule', phase: 'phase2', indication: 'PTSD', differentiator: 'Negative allosteric modulator of α7 nAChR; novel non-sedating anxiolytic mechanism' },
      { companyName: 'Pfizer/Servier', assetName: 'Sertraline (Zoloft)', modality: 'smallMolecule', phase: 'approved', indication: 'PTSD', differentiator: 'SSRI standard of care; generic; modest efficacy (~60% response)' },
      { companyName: 'Various', assetName: 'Prazosin', modality: 'smallMolecule', phase: 'approved', indication: 'PTSD nightmares', differentiator: 'Alpha-1 blocker for trauma nightmares; off-label; mixed evidence' },
    ],
    marketDynamics: 'Massive unmet need — only SSRIs (sertraline, paroxetine) FDA-approved; ~50% patients do not adequately respond. MDMA-assisted therapy showed breakthrough efficacy but FDA requested additional trial. Novel mechanisms targeting fear extinction, reconsolidation, and neuroplasticity. ~13M US patients annually. Potential for $5B+ market with effective therapy.',
  },
  rareAutoimmune: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'Amgen', assetName: 'Uplizna (inebilizumab)', modality: 'mab', phase: 'approved', indication: 'NMOSD', differentiator: 'Anti-CD19 B-cell depleter; approved for NMOSD; exploring other rare autoimmune' },
      { companyName: 'Roche', assetName: 'Enspryng (satralizumab)', modality: 'mab', phase: 'approved', indication: 'NMOSD', differentiator: 'Recycling anti-IL-6R antibody; subcutaneous; AQP4+ NMOSD' },
      { companyName: 'Argenx', assetName: 'Vyvgart (efgartigimod)', modality: 'mab', phase: 'approved', indication: 'gMG / expanding to CIDP, ITP', differentiator: 'FcRn antagonist; platform across IgG-mediated rare autoimmune diseases' },
      { companyName: 'Immunovant', assetName: 'Batoclimab', modality: 'mab', phase: 'phase3', indication: 'Multiple rare autoimmune', differentiator: 'Subcutaneous FcRn inhibitor; broad rare autoimmune pipeline' },
    ],
    marketDynamics: 'FcRn antagonists emerging as platform approach across IgG-mediated autoimmune diseases (MG, CIDP, ITP, pemphigus). B-cell depletion validated in NMOSD. Complement inhibition expanding from PNH into autoimmune indications. Growing interest from large pharma in rare autoimmune portfolio strategies.',
  },
  rareMetabolic: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'Alexion/AstraZeneca', assetName: 'Strensiq (asfotase alfa)', modality: 'other', phase: 'approved', indication: 'Hypophosphatasia', differentiator: 'First enzyme replacement for HPP; bone-targeted ALP' },
      { companyName: 'Ultragenyx', assetName: 'Mepsevii (vestronidase alfa)', modality: 'other', phase: 'approved', indication: 'MPS VII', differentiator: 'ERT for ultra-rare MPS VII (Sly syndrome)' },
      { companyName: 'Ultragenyx', assetName: 'Dojolvi (triheptanoin)', modality: 'smallMolecule', phase: 'approved', indication: 'Long-chain fatty acid oxidation disorders', differentiator: 'Anaplerotic therapy; substrate replacement for LC-FAOD' },
      { companyName: 'Various', assetName: 'AAV gene therapies', modality: 'gene_therapy', phase: 'phase1', indication: 'Multiple rare metabolic', differentiator: 'Gene therapy pipeline across dozens of rare metabolic diseases; liver-directed AAV approaches' },
    ],
    marketDynamics: 'Enzyme replacement therapies remain backbone for LSDs and metabolic disorders. Gene therapy approaching commercialization for several conditions. Substrate reduction, chaperone therapy, and mRNA therapeutics expanding the toolkit. Each individual condition has small patient numbers but collectively represent $20B+ market. Orphan drug economics favor development.',
  },
  rareNeuro: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'Ionis/Biogen', assetName: 'Spinraza (nusinersen)', modality: 'oligonucleotide', phase: 'approved', indication: 'SMA (paradigm example)', differentiator: 'First ASO for neurological disease; proved RNA-targeting in CNS' },
      { companyName: 'Ultragenyx', assetName: 'GTX-102', modality: 'oligonucleotide', phase: 'phase3', indication: 'Angelman syndrome', differentiator: 'ASO reactivating paternal UBE3A; potential first therapy for Angelman' },
      { companyName: 'Marinus Pharma', assetName: 'Ztalmy (ganaxolone)', modality: 'smallMolecule', phase: 'approved', indication: 'CDKL5 deficiency disorder', differentiator: 'Neurosteroid GABAa modulator; first approved therapy for CDD seizures' },
      { companyName: 'Neurogene', assetName: 'NGN-401', modality: 'gene_therapy', phase: 'phase1', indication: 'Rett syndrome', differentiator: 'Regulated gene therapy for MECP2; dose-controlled expression' },
    ],
    marketDynamics: 'RNA-based and gene therapies transforming rare neurological diseases. ASOs, siRNAs, and AAV gene therapies each finding niches based on disease mechanism. CNS delivery remains key challenge. Each condition tiny (hundreds to low thousands of patients) but orphan economics attractive. Platform technologies enabling broader pipeline development.',
  },
  restlessLeg: {
    density: 'low',
    keyAssets: [
      { companyName: 'Various', assetName: 'Gabapentin enacarbil (Horizant)', modality: 'smallMolecule', phase: 'approved', indication: 'RLS', differentiator: 'Alpha-2-delta ligand prodrug; FDA-approved for RLS; once-daily' },
      { companyName: 'Various', assetName: 'Ropinirole/pramipexole', modality: 'smallMolecule', phase: 'approved', indication: 'RLS', differentiator: 'Dopamine agonists; effective but augmentation risk with long-term use' },
      { companyName: 'Jazz Pharmaceuticals', assetName: 'Xywav (low-sodium oxybate)', modality: 'smallMolecule', phase: 'approved', indication: 'RLS (refractory)', differentiator: 'Approved 2023 for moderate-severe RLS; improved IRLS and sleep quality' },
    ],
    marketDynamics: 'Common condition (~5-15% prevalence) but limited innovation pipeline. Dopamine agonist augmentation drives need for alternatives. Xywav added as option for refractory patients. Alpha-2-delta ligands becoming first-line per guidelines. Iron supplementation important in iron-deficient subset. Few novel mechanisms in clinical development.',
  },
  retinalVeinOcclusion: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'Regeneron', assetName: 'Eylea/Eylea HD (aflibercept)', modality: 'mab', phase: 'approved', indication: 'Macular edema due to RVO', differentiator: 'Anti-VEGF standard; HD formulation enables extended dosing' },
      { companyName: 'Roche', assetName: 'Vabysmo (faricimab)', modality: 'bispecific', phase: 'approved', indication: 'RVO macular edema', differentiator: 'Bispecific anti-VEGF/Ang-2; approved for RVO 2024; extended intervals' },
      { companyName: 'Regeneron', assetName: 'Lucentis (ranibizumab)', modality: 'mab', phase: 'approved', indication: 'RVO macular edema', differentiator: 'First anti-VEGF approved for RVO; now facing biosimilar competition' },
      { companyName: 'AbbVie (Allergan)', assetName: 'Ozurdex (dexamethasone implant)', modality: 'smallMolecule', phase: 'approved', indication: 'RVO macular edema', differentiator: 'Intravitreal steroid implant; less frequent dosing; cataract/IOP risks' },
    ],
    marketDynamics: 'Anti-VEGF therapy is standard of care. Treatment paradigm mirrors wet AMD with extended-dosing formulations gaining share. Vabysmo approval in RVO expanding bispecific footprint. Unmet need: preventing ischemic complications, treating underlying vascular occlusion. ~1.2M US patients.',
  },
  retinoblastoma: {
    density: 'very_low',
    keyAssets: [
      { companyName: 'Various', assetName: 'Intra-arterial melphalan', modality: 'smallMolecule', phase: 'approved', indication: 'Retinoblastoma', differentiator: 'Gold standard chemotherapy delivery; eye preservation >90%; interventional oncology' },
      { companyName: 'Various', assetName: 'Intravitreal melphalan/topotecan', modality: 'smallMolecule', phase: 'approved', indication: 'Vitreous seeds retinoblastoma', differentiator: 'Direct intravitreal injection for vitreous disease; avoids enucleation' },
    ],
    marketDynamics: 'Rare pediatric cancer (~300 US cases/year). Treatment highly specialized: intra-arterial chemotherapy, focal therapies (laser, cryo), and intravitreal chemo have dramatically improved eye salvage. No FDA-approved systemic targeted therapy. RB1 pathway research informs broader cancer biology but limited commercial investment given rarity.',
  },
  rett: {
    density: 'low',
    keyAssets: [
      { companyName: 'Acadia Pharmaceuticals', assetName: 'Daybue (trofinetide)', modality: 'smallMolecule', phase: 'approved', indication: 'Rett syndrome', differentiator: 'First FDA-approved Rett therapy (2023); IGF-1 analog; modest but meaningful symptom improvement' },
      { companyName: 'Neurogene', assetName: 'NGN-401', modality: 'gene_therapy', phase: 'phase1', indication: 'Rett syndrome', differentiator: 'Regulated MECP2 gene therapy; self-regulating expression to avoid overexpression toxicity' },
      { companyName: 'Taysha Gene Therapies', assetName: 'TSHA-102', modality: 'gene_therapy', phase: 'phase1', indication: 'Rett syndrome', differentiator: 'miRNA-responsive MECP2 gene therapy; intrathecal delivery' },
    ],
    marketDynamics: 'Daybue approval in 2023 was landmark for Rett community (~6,000-9,000 US patients). Gene therapy approaches aim to address root cause (MECP2 deficiency) but face unique challenge of avoiding MECP2 overexpression (which causes separate disease). Significant unmet need for disease modification beyond symptom management.',
  },
  rhabdomyosarcoma: {
    density: 'very_low',
    keyAssets: [
      { companyName: 'Various', assetName: 'VAC chemotherapy (vincristine, actinomycin D, cyclophosphamide)', modality: 'smallMolecule', phase: 'approved', indication: 'Rhabdomyosarcoma', differentiator: 'Standard backbone for >40 years; ~70% survival localized; ~30% metastatic' },
      { companyName: 'Bayer', assetName: 'Regorafenib', modality: 'smallMolecule', phase: 'phase2', indication: 'Relapsed RMS', differentiator: 'Multi-kinase inhibitor; COG ARST1921 trial; modest single-agent activity' },
      { companyName: 'Various', assetName: 'Vinorelbine + cyclophosphamide', modality: 'smallMolecule', phase: 'phase2', indication: 'Relapsed RMS', differentiator: 'Maintenance low-dose metronomic approach for relapsed disease' },
    ],
    marketDynamics: 'Most common pediatric soft tissue sarcoma (~350 US cases/year) but no new drug approved in decades. Fusion-positive (PAX3/7-FOXO1) RMS has poor prognosis and distinct biology. COG trials driving incremental improvements. ALK, FGFR4, and IGF-1R targets under investigation. Pediatric exclusivity incentives driving some pharma interest.',
  },
  sarcoidosis: {
    density: 'low',
    keyAssets: [
      { companyName: 'Various', assetName: 'Prednisone', modality: 'smallMolecule', phase: 'approved', indication: 'Sarcoidosis', differentiator: 'First-line standard for symptomatic disease; significant chronic toxicity' },
      { companyName: 'Boehringer Ingelheim', assetName: 'Nerandomilast (BI 1015550)', modality: 'smallMolecule', phase: 'phase2', indication: 'Pulmonary sarcoidosis', differentiator: 'PDE4B inhibitor; anti-fibrotic in lung diseases; exploring sarcoidosis' },
      { companyName: 'Teva', assetName: 'Namilumab (anti-GM-CSF)', modality: 'mab', phase: 'phase2', indication: 'Pulmonary sarcoidosis', differentiator: 'GM-CSF neutralization; granuloma-targeted approach' },
      { companyName: 'Novartis', assetName: 'Ilaris (canakinumab)', modality: 'mab', phase: 'phase2', indication: 'Sarcoidosis', differentiator: 'Anti-IL-1β; investigating granulomatous inflammation' },
    ],
    marketDynamics: 'No FDA-approved therapy for sarcoidosis despite ~200,000 US patients. Corticosteroids remain default treatment with significant morbidity. Methotrexate and anti-TNFs used off-label. mTOR, JAK, and PDE4 pathways under investigation. Disproportionately affects African Americans. Large untapped market for targeted, steroid-sparing therapies.',
  },
  sarcoma: {
    density: 'low',
    keyAssets: [
      { companyName: 'Epizyme/Ipsen', assetName: 'Tazverik (tazemetostat)', modality: 'smallMolecule', phase: 'approved', indication: 'Epithelioid sarcoma', differentiator: 'First EZH2 inhibitor; approved for epithelioid sarcoma; INI1-loss biomarker' },
      { companyName: 'Daiichi Sankyo', assetName: 'Halaven (eribulin)', modality: 'smallMolecule', phase: 'approved', indication: 'Liposarcoma', differentiator: 'First drug showing OS benefit in liposarcoma specifically' },
      { companyName: 'Deciphera', assetName: 'Qinlock (ripretinib)', modality: 'smallMolecule', phase: 'approved', indication: 'GIST (4th line)', differentiator: 'Broad KIT/PDGFRα inhibitor; addresses resistance mutations in GIST' },
      { companyName: 'Various', assetName: 'Doxorubicin', modality: 'smallMolecule', phase: 'approved', indication: 'Soft tissue sarcoma', differentiator: 'First-line standard for advanced STS for 40+ years; anthracycline backbone' },
    ],
    marketDynamics: 'Highly heterogeneous group (>70 subtypes) making drug development challenging. Doxorubicin-based chemotherapy remains backbone. Precision approaches gaining traction: EZH2 in epithelioid, KIT in GIST, MDM2 in dedifferentiated liposarcoma. ~13,000 US STS cases/year. Histology-specific trials increasingly required.',
  },
  sjogrens: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'GSK', assetName: 'Belimumab (Benlysta)', modality: 'mab', phase: 'phase3', indication: 'Sjogren\'s syndrome', differentiator: 'Anti-BAFF; leveraging lupus success; BLISS-Sjogren\'s trial' },
      { companyName: 'BMS', assetName: 'Deucravacitinib', modality: 'smallMolecule', phase: 'phase2', indication: 'Sjogren\'s syndrome', differentiator: 'TYK2 inhibitor; interferon pathway suppression; oral' },
      { companyName: 'Novartis', assetName: 'Ianalumab (anti-BAFF-R)', modality: 'mab', phase: 'phase3', indication: 'Sjogren\'s syndrome', differentiator: 'B-cell depleting anti-BAFF receptor; monthly SC injection; promising Phase 2 data' },
      { companyName: 'Roche', assetName: 'Rituximab', modality: 'mab', phase: 'phase3', indication: 'Sjogren\'s (systemic)', differentiator: 'Anti-CD20 B-cell depletion; widely used off-label; mixed trial results historically' },
    ],
    marketDynamics: 'No FDA-approved therapy for Sjogren\'s despite ~1-4M US patients. Treatment is entirely off-label (pilocarpine for dryness, hydroxychloroquine, rituximab). B-cell targeting approaches most advanced: ianalumab showing strong Phase 2 results. BAFF pathway, TYK2, and ICOS-L under investigation. High unmet need especially for systemic manifestations (fatigue, arthralgia, organ involvement).',
  },
  // --- Batch 1: aancaVasculitis through castlemanDisease ---
  aancaVasculitis: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'Genentech/Roche', assetName: 'Rituxan', modality: 'mab', phase: 'approved', indication: 'ANCA-associated vasculitis', differentiator: 'First approved biologic for GPA/MPA' },
      { companyName: 'GSK', assetName: 'Nucala', modality: 'mab', phase: 'approved', indication: 'ANCA-associated vasculitis', differentiator: 'Anti-IL-5 for eosinophilic GPA' },
      { companyName: 'AstraZeneca/Amgen', assetName: 'Tavneos', modality: 'smallMolecule', phase: 'approved', indication: 'ANCA-associated vasculitis', differentiator: 'First oral C5a receptor inhibitor, steroid-sparing' },
      { companyName: 'Viela Bio/Horizon', assetName: 'Uplizna', modality: 'mab', phase: 'phase3', indication: 'ANCA-associated vasculitis', differentiator: 'Anti-CD19 B-cell depletion approach' },
    ],
    marketDynamics: 'Tavneos (avacopan) shifted paradigm toward steroid-sparing regimens. Rituximab biosimilars increasing access. Complement and B-cell targeting strategies dominate pipeline.',
  },
  aatDeficiency: {
    density: 'low',
    keyAssets: [
      { companyName: 'Grifols', assetName: 'Prolastin-C', modality: 'peptide', phase: 'approved', indication: 'Alpha-1 antitrypsin deficiency', differentiator: 'Market-leading IV augmentation therapy' },
      { companyName: 'Takeda', assetName: 'Aralast NP', modality: 'peptide', phase: 'approved', indication: 'Alpha-1 antitrypsin deficiency', differentiator: 'Plasma-derived AAT replacement' },
      { companyName: 'Arrowhead Pharmaceuticals', assetName: 'Fazirsiran', modality: 'rnai', phase: 'phase3', indication: 'Alpha-1 antitrypsin deficiency', differentiator: 'RNAi silencing of mutant Z-AAT in liver' },
      { companyName: 'Vertex Pharmaceuticals', assetName: 'VX-864', modality: 'smallMolecule', phase: 'phase2', indication: 'Alpha-1 antitrypsin deficiency', differentiator: 'Small molecule corrector of AAT protein folding' },
    ],
    marketDynamics: 'Augmentation therapy with plasma-derived products remains standard of care but burdensome. RNAi and gene therapy approaches aim to address root cause. Arrowhead\'s fazirsiran is the most advanced next-gen candidate.',
  },
  achromatopsia: {
    density: 'very_low',
    keyAssets: [
      { companyName: 'MeiraGTx', assetName: 'AAV-CNGB3', modality: 'geneTherapy', phase: 'phase2', indication: 'Achromatopsia (CNGB3)', differentiator: 'Subretinal AAV gene therapy for CNGB3 mutations' },
      { companyName: 'MeiraGTx', assetName: 'AAV-CNGA3', modality: 'geneTherapy', phase: 'phase2', indication: 'Achromatopsia (CNGA3)', differentiator: 'Subretinal AAV gene therapy for CNGA3 mutations' },
      { companyName: 'Applied Genetic Technologies (AGTC)', assetName: 'AGTC-402', modality: 'geneTherapy', phase: 'phase2', indication: 'Achromatopsia (CNGB3)', differentiator: 'AAV vector with optimized promoter for cone photoreceptors' },
    ],
    marketDynamics: 'No approved therapies exist. Gene therapy is the only viable modality given monogenic etiology. MeiraGTx leads with programs targeting both CNGA3 and CNGB3 mutations. Very small patient populations limit commercial interest.',
  },
  acromegaly: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'Ipsen', assetName: 'Somatuline Depot', modality: 'peptide', phase: 'approved', indication: 'Acromegaly', differentiator: 'Long-acting somatostatin analog, monthly injection' },
      { companyName: 'Novartis', assetName: 'Sandostatin LAR', modality: 'peptide', phase: 'approved', indication: 'Acromegaly', differentiator: 'Established first-line somatostatin analog' },
      { companyName: 'Pfizer', assetName: 'Somavert', modality: 'peptide', phase: 'approved', indication: 'Acromegaly', differentiator: 'GH receptor antagonist for somatostatin analog-refractory patients' },
      { companyName: 'Crinetics Pharmaceuticals', assetName: 'Paltusotine', modality: 'smallMolecule', phase: 'approved', indication: 'Acromegaly', differentiator: 'First oral somatostatin receptor 2 agonist' },
    ],
    marketDynamics: 'Injectable somatostatin analogs have dominated for decades. Crinetics\' paltusotine approval in 2024 introduced the first oral option, potentially transforming treatment paradigm. Oral formulations are the key competitive battleground.',
  },
  adrenocortical: {
    density: 'very_low',
    keyAssets: [
      { companyName: 'Bristol-Myers Squibb', assetName: 'Lysodren', modality: 'smallMolecule', phase: 'approved', indication: 'Adrenocortical carcinoma', differentiator: 'Only approved drug for inoperable ACC, adrenolytic agent' },
      { companyName: 'Merck', assetName: 'Keytruda', modality: 'mab', phase: 'phase2', indication: 'Adrenocortical carcinoma', differentiator: 'PD-1 inhibitor explored in advanced ACC' },
      { companyName: 'Exelixis', assetName: 'Cabozantinib', modality: 'smallMolecule', phase: 'phase2', indication: 'Adrenocortical carcinoma', differentiator: 'Multi-kinase inhibitor with activity signals in ACC' },
    ],
    marketDynamics: 'Extremely rare cancer with mitotane as the only approved therapy since the 1970s. Chemotherapy (EDP regimen) used in advanced disease. Checkpoint inhibitors and targeted agents under investigation but no breakthroughs yet.',
  },
  amyloidosisAL: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'Johnson & Johnson', assetName: 'Darzalex', modality: 'mab', phase: 'approved', indication: 'AL amyloidosis', differentiator: 'Anti-CD38 approved in combination with CyBorD, first approved biologic' },
      { companyName: 'Caelum Biosciences/AstraZeneca', assetName: 'CAEL-101', modality: 'mab', phase: 'phase3', indication: 'AL amyloidosis', differentiator: 'Anti-amyloid fibril antibody targeting organ damage directly' },
      { companyName: 'Prothena/BMS', assetName: 'Birtamimab', modality: 'mab', phase: 'phase3', indication: 'AL amyloidosis', differentiator: 'Anti-amyloid antibody for Mayo stage IV patients' },
    ],
    marketDynamics: 'Daratumumab-CyBorD is the new standard of care for hematologic response. Emerging anti-amyloid fibril antibodies aim to directly resolve organ deposits. Dual approach of clonal control plus fibril clearance is the emerging paradigm.',
  },
  angelman: {
    density: 'low',
    keyAssets: [
      { companyName: 'Ionis/Biogen', assetName: 'ION582', modality: 'aso', phase: 'phase2', indication: 'Angelman syndrome', differentiator: 'Antisense oligonucleotide targeting UBE3A-AS to unsilence paternal UBE3A' },
      { companyName: 'Roche/GeneTx', assetName: 'GTX-102', modality: 'aso', phase: 'phase2', indication: 'Angelman syndrome', differentiator: 'Intrathecal ASO reactivating paternal UBE3A allele' },
      { companyName: 'Ultragenyx', assetName: 'UX-111', modality: 'geneTherapy', phase: 'phase1', indication: 'Angelman syndrome', differentiator: 'AAV gene therapy delivering functional UBE3A' },
    ],
    marketDynamics: 'No approved therapies exist. ASO-based approaches to unsilence the paternal UBE3A gene are the leading strategy. Roche/GeneTx and Ionis compete head-to-head with similar mechanisms.',
  },
  ankylosingSpondylitis: {
    density: 'high',
    keyAssets: [
      { companyName: 'AbbVie', assetName: 'Humira', modality: 'mab', phase: 'approved', indication: 'Ankylosing spondylitis', differentiator: 'Anti-TNF market leader with extensive real-world data, now biosimilar competition' },
      { companyName: 'Novartis', assetName: 'Cosentyx', modality: 'mab', phase: 'approved', indication: 'Ankylosing spondylitis', differentiator: 'First IL-17A inhibitor approved for AS, strong structural data' },
      { companyName: 'UCB', assetName: 'Bimzelx', modality: 'mab', phase: 'approved', indication: 'Ankylosing spondylitis', differentiator: 'Dual IL-17A/F inhibitor with superior ASAS40 response rates' },
      { companyName: 'AbbVie', assetName: 'Rinvoq', modality: 'smallMolecule', phase: 'approved', indication: 'Ankylosing spondylitis', differentiator: 'Oral JAK inhibitor for TNF-inadequate responders' },
    ],
    marketDynamics: 'Mature market with anti-TNFs facing biosimilar erosion. IL-17 inhibitors are preferred newer biologics. Bimzelx\'s dual IL-17A/F blockade shows best-in-class efficacy. JAK inhibitors offer oral option but carry safety label concerns.',
  },
  antiphospholipid: {
    density: 'very_low',
    keyAssets: [
      { companyName: 'Generic', assetName: 'Warfarin', modality: 'smallMolecule', phase: 'approved', indication: 'Antiphospholipid syndrome', differentiator: 'Standard of care anticoagulant, vitamin K antagonist' },
      { companyName: 'Annexon Biosciences', assetName: 'ANX005', modality: 'mab', phase: 'phase2', indication: 'Antiphospholipid syndrome', differentiator: 'Anti-C1q antibody targeting classical complement pathway' },
    ],
    marketDynamics: 'Warfarin remains the only proven therapy; DOACs showed inferior outcomes in triple-positive APS. Complement inhibition is an emerging strategy. Significant unmet need in catastrophic APS and refractory thrombosis.',
  },
  aplasticAnemia: {
    density: 'low',
    keyAssets: [
      { companyName: 'Novartis', assetName: 'Promacta', modality: 'smallMolecule', phase: 'approved', indication: 'Severe aplastic anemia', differentiator: 'TPO-RA added to first-line IST, improved complete response' },
      { companyName: 'Pfizer', assetName: 'Atgam', modality: 'peptide', phase: 'approved', indication: 'Aplastic anemia', differentiator: 'Equine ATG backbone of immunosuppressive therapy' },
    ],
    marketDynamics: 'Eltrombopag added to horse ATG/cyclosporine became new first-line standard. Bone marrow transplant remains curative for young patients with matched donors. Pipeline focus is on improving response in older and refractory patients.',
  },
  asmd: {
    density: 'very_low',
    keyAssets: [
      { companyName: 'Sanofi', assetName: 'Xenpozyme', modality: 'peptide', phase: 'approved', indication: 'Acid sphingomyelinase deficiency', differentiator: 'First and only approved ERT for non-CNS ASMD manifestations' },
    ],
    marketDynamics: 'Xenpozyme (olipudase alfa) approved in 2022 is the only disease-modifying therapy. Does not cross the blood-brain barrier, leaving CNS disease unaddressed. Ultra-rare patient population with limited commercial opportunity.',
  },
  ataxiaTelangiectasia: {
    density: 'very_low',
    keyAssets: [
      { companyName: 'Erydel', assetName: 'EryDex', modality: 'smallMolecule', phase: 'phase3', indication: 'Ataxia telangiectasia', differentiator: 'Intra-erythrocyte dexamethasone delivery for neurological improvement' },
      { companyName: 'IntraBio', assetName: 'IB1001', modality: 'smallMolecule', phase: 'phase2', indication: 'Ataxia telangiectasia', differentiator: 'N-acetyl-L-leucine for cerebellar ataxia symptoms' },
    ],
    marketDynamics: 'No approved disease-modifying therapies exist. Current treatment is purely supportive. EryDex has the most advanced program but clinical results have been mixed.',
  },
  attrAmyloidosis: {
    density: 'high',
    keyAssets: [
      { companyName: 'Pfizer', assetName: 'Vyndaqel/Vyndamax', modality: 'smallMolecule', phase: 'approved', indication: 'ATTR cardiomyopathy', differentiator: 'TTR stabilizer, blockbuster with >$3B peak sales' },
      { companyName: 'Alnylam', assetName: 'Amvuttra', modality: 'rnai', phase: 'approved', indication: 'ATTR polyneuropathy', differentiator: 'Subcutaneous RNAi, every-3-month dosing, expanding into cardiomyopathy' },
      { companyName: 'AstraZeneca/Ionis', assetName: 'Wainua', modality: 'aso', phase: 'approved', indication: 'ATTR polyneuropathy', differentiator: 'Ligand-conjugated ASO with monthly subQ dosing' },
      { companyName: 'BridgeBio', assetName: 'Acoramidis', modality: 'smallMolecule', phase: 'approved', indication: 'ATTR cardiomyopathy', differentiator: 'Next-gen TTR stabilizer with superior occupancy vs tafamidis' },
      { companyName: 'Intellia Therapeutics', assetName: 'Nexiguran Ziclumeran', modality: 'geneTherapy', phase: 'phase3', indication: 'ATTR amyloidosis', differentiator: 'In vivo CRISPR gene editing for one-time TTR knockout' },
    ],
    marketDynamics: 'Rapidly expanding market with tafamidis dominance in cardiomyopathy now challenged by acoramidis. Gene silencing established in polyneuropathy and expanding to cardiomyopathy. CRISPR-based one-time cure from Intellia is the most disruptive pipeline asset.',
  },
  autism: {
    density: 'low',
    keyAssets: [
      { companyName: 'Johnson & Johnson', assetName: 'Risperdal', modality: 'smallMolecule', phase: 'approved', indication: 'Autism-associated irritability', differentiator: 'Approved for irritability in ASD, not core symptoms' },
      { companyName: 'Otsuka', assetName: 'Abilify', modality: 'smallMolecule', phase: 'approved', indication: 'Autism-associated irritability', differentiator: 'Approved for irritability in ASD, widely prescribed' },
    ],
    marketDynamics: 'No approved therapies for core ASD symptoms. Approved drugs only address irritability. Multiple clinical failures highlight difficulty of targeting heterogeneous neurobiology.',
  },
  autoImmuneHepatitis: {
    density: 'low',
    keyAssets: [
      { companyName: 'Generic', assetName: 'Prednisone/Azathioprine', modality: 'smallMolecule', phase: 'approved', indication: 'Autoimmune hepatitis', differentiator: 'Standard of care first-line since 1970s, significant side effects' },
      { companyName: 'Roche', assetName: 'Rituxan', modality: 'mab', phase: 'phase2', indication: 'Autoimmune hepatitis', differentiator: 'Anti-CD20 used off-label in refractory cases' },
    ],
    marketDynamics: 'Decades-old steroid/azathioprine regimen remains first-line despite poor tolerability. No FDA-approved indication-specific therapy. Significant unmet need in refractory disease and steroid-intolerant patients.',
  },
  batten: {
    density: 'very_low',
    keyAssets: [
      { companyName: 'BioMarin', assetName: 'Brineura', modality: 'peptide', phase: 'approved', indication: 'CLN2 Batten disease', differentiator: 'First approved ERT for any NCL, intracerebroventricular delivery' },
      { companyName: 'Neurogene', assetName: 'NGN-401', modality: 'geneTherapy', phase: 'phase1', indication: 'CLN5 Batten disease', differentiator: 'AAV gene therapy with self-regulating expression system' },
    ],
    marketDynamics: 'Brineura is the only approved therapy and addresses only CLN2 subtype. Most NCL subtypes have no disease-modifying treatment. Gene therapy is the primary modality under investigation across multiple subtypes.',
  },
  behcets: {
    density: 'low',
    keyAssets: [
      { companyName: 'Celgene/BMS', assetName: 'Otezla', modality: 'smallMolecule', phase: 'approved', indication: 'Behcet\'s disease oral ulcers', differentiator: 'Only FDA-approved therapy for Behcet\'s oral ulcers, PDE4 inhibitor' },
      { companyName: 'AbbVie', assetName: 'Humira', modality: 'mab', phase: 'approved', indication: 'Behcet\'s disease (off-label)', differentiator: 'Anti-TNF used off-label for refractory mucocutaneous and ocular disease' },
    ],
    marketDynamics: 'Apremilast is the only FDA-approved therapy, specifically for oral ulcers. Anti-TNFs used off-label for severe disease. Market is fragmented by disease manifestation.',
  },
  betaThalassemia: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'Vertex/CRISPR Therapeutics', assetName: 'Casgevy', modality: 'geneTherapy', phase: 'approved', indication: 'Transfusion-dependent beta-thalassemia', differentiator: 'First approved CRISPR therapy, ex vivo gene editing of BCL11A' },
      { companyName: 'bluebird bio', assetName: 'Zynteglo', modality: 'geneTherapy', phase: 'approved', indication: 'Transfusion-dependent beta-thalassemia', differentiator: 'Lentiviral gene addition therapy' },
      { companyName: 'Bristol-Myers Squibb', assetName: 'Reblozyl', modality: 'peptide', phase: 'approved', indication: 'Beta-thalassemia', differentiator: 'Activin receptor ligand trap reducing transfusion burden' },
    ],
    marketDynamics: 'Gene therapy era has arrived with Casgevy and Zynteglo offering potential cures, but $2M+ price and manufacturing complexity limit access. Reblozyl provides non-curative transfusion reduction.',
  },
  bpdcn: {
    density: 'very_low',
    keyAssets: [
      { companyName: 'Stemline/Menarini', assetName: 'Elzonris', modality: 'peptide', phase: 'approved', indication: 'Blastic plasmacytoid dendritic cell neoplasm', differentiator: 'First and only approved therapy, CD123-targeted diphtheria toxin fusion' },
      { companyName: 'Mustang Bio', assetName: 'MB-102', modality: 'cellTherapy', phase: 'phase1', indication: 'BPDCN', differentiator: 'CD123-targeted CAR-T cell therapy' },
    ],
    marketDynamics: 'Ultra-rare hematologic malignancy with only Elzonris (tagraxofusp) approved. Capillary leak syndrome limits tolerability. CD123 remains the dominant target.',
  },
  breastCancerPrevention: {
    density: 'low',
    keyAssets: [
      { companyName: 'Generic', assetName: 'Tamoxifen', modality: 'smallMolecule', phase: 'approved', indication: 'Breast cancer risk reduction', differentiator: 'First approved chemopreventive, SERM with significant side effects' },
      { companyName: 'Generic', assetName: 'Raloxifene', modality: 'smallMolecule', phase: 'approved', indication: 'Breast cancer risk reduction in postmenopausal women', differentiator: 'SERM with lower thromboembolic risk than tamoxifen' },
    ],
    marketDynamics: 'Despite proven efficacy, chemoprevention uptake remains below 10% of eligible women due to side effect concerns. All available agents are generic with minimal commercial interest.',
  },
  breast_hr: {
    density: 'very_high',
    keyAssets: [
      { companyName: 'Pfizer', assetName: 'Ibrance', modality: 'smallMolecule', phase: 'approved', indication: 'HR+ breast cancer', differentiator: 'CDK4/6 inhibitor market leader, first-in-class' },
      { companyName: 'Eli Lilly', assetName: 'Verzenio', modality: 'smallMolecule', phase: 'approved', indication: 'HR+ breast cancer', differentiator: 'Only CDK4/6 inhibitor with adjuvant monarchE data, gaining market share' },
      { companyName: 'AstraZeneca/Daiichi Sankyo', assetName: 'Enhertu', modality: 'adc', phase: 'approved', indication: 'HR+/HER2-low breast cancer', differentiator: 'HER2-directed ADC expanding into HER2-low, paradigm shifting' },
      { companyName: 'Roche', assetName: 'Inavolisib', modality: 'smallMolecule', phase: 'phase3', indication: 'HR+/PIK3CA-mutant breast cancer', differentiator: 'PI3Ka inhibitor with mutant-selective profile' },
    ],
    marketDynamics: 'CDK4/6 inhibitors dominate first-line with Verzenio gaining share via adjuvant indication. Oral SERDs and CDK2 inhibitors emerging as next wave for resistant disease. ADCs expanding addressable population via HER2-low classification.',
  },
  burkitt: {
    density: 'low',
    keyAssets: [
      { companyName: 'Generic', assetName: 'R-CODOX-M/IVAC', modality: 'smallMolecule', phase: 'approved', indication: 'Burkitt lymphoma', differentiator: 'Intensive chemoimmunotherapy backbone with high cure rates in young patients' },
      { companyName: 'Genmab/AbbVie', assetName: 'Epkinly', modality: 'bispecific', phase: 'phase2', indication: 'Burkitt lymphoma', differentiator: 'CD20xCD3 bispecific explored in aggressive B-NHL' },
    ],
    marketDynamics: 'Intensive chemo cures most young patients but relapsed/refractory Burkitt has dismal outcomes. Bispecifics and CAR-T therapies developed for DLBCL are being extended to Burkitt.',
  },
  castlemanDisease: {
    density: 'very_low',
    keyAssets: [
      { companyName: 'Johnson & Johnson', assetName: 'Sylvant', modality: 'mab', phase: 'approved', indication: 'Multicentric Castleman disease', differentiator: 'Only approved therapy, anti-IL-6 monoclonal antibody' },
      { companyName: 'CDCN Collaborative', assetName: 'Sirolimus', modality: 'smallMolecule', phase: 'phase2', indication: 'Castleman disease', differentiator: 'mTOR inhibitor showing activity in siltuximab-refractory iMCD' },
    ],
    marketDynamics: 'Siltuximab is the only approved therapy for HHV8-negative MCD but only ~34% achieve durable response. Ultra-rare disease with active patient-driven research network.',
  },
  // --- Batch 2: cdkl5 through endometrial ---
  cdkl5: {
    density: 'very_low',
    keyAssets: [
      { companyName: 'Marinus Pharmaceuticals', assetName: 'Ztalmy (ganaxolone)', modality: 'smallMolecule', phase: 'approved', indication: 'CDKL5 deficiency disorder seizures', differentiator: 'First and only FDA-approved treatment for CDD' },
      { companyName: 'Neurogene', assetName: 'NGN-401', modality: 'geneTherapy', phase: 'phase1', indication: 'CDKL5 deficiency disorder', differentiator: 'AAV gene therapy with regulated CDKL5 expression' },
    ],
    marketDynamics: 'Ultra-rare indication with only one approved therapy. Gene therapy approaches represent the next wave of disease-modifying treatments.',
  },
  celiac: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'Takeda', assetName: 'TAK-062 (latiglutenase)', modality: 'peptide', phase: 'phase2', indication: 'Celiac disease', differentiator: 'Glutenase enzyme for gluten degradation' },
      { companyName: 'Immunic Therapeutics', assetName: 'IMU-856', modality: 'smallMolecule', phase: 'phase2', indication: 'Celiac disease', differentiator: 'Restores intestinal barrier integrity independent of gluten exposure' },
    ],
    marketDynamics: 'No approved pharmacotherapy exists; gluten-free diet is the only management option. Multiple mechanistic approaches compete including glutenases, immune modulation, and tight junction regulators.',
  },
  cervical: {
    density: 'high',
    keyAssets: [
      { companyName: 'Genmab/Seagen', assetName: 'Tivdak (tisotumab vedotin)', modality: 'adc', phase: 'approved', indication: 'Recurrent/metastatic cervical cancer', differentiator: 'First ADC approved in cervical cancer targeting tissue factor' },
      { companyName: 'Merck', assetName: 'Keytruda (pembrolizumab)', modality: 'mab', phase: 'approved', indication: 'PD-L1+ recurrent cervical cancer', differentiator: 'First-line IO with chemotherapy +/- bevacizumab' },
      { companyName: 'Roche', assetName: 'Avastin (bevacizumab)', modality: 'mab', phase: 'approved', indication: 'Persistent/recurrent cervical cancer', differentiator: 'Anti-VEGF added to chemotherapy backbone' },
    ],
    marketDynamics: 'IO plus chemotherapy is the established first-line standard. ADCs like tisotumab vedotin are reshaping the recurrent setting. HPV therapeutic vaccines and bispecifics are emerging.',
  },
  cervicalDysplasia: {
    density: 'low',
    keyAssets: [
      { companyName: 'Inovio Pharmaceuticals', assetName: 'VGX-3100', modality: 'mrna', phase: 'phase3', indication: 'HPV-related cervical dysplasia (CIN2/3)', differentiator: 'DNA immunotherapy targeting HPV 16/18 E6 and E7 proteins' },
      { companyName: 'PDS Biotechnology', assetName: 'PDS0101', modality: 'peptide', phase: 'phase2', indication: 'HPV-associated cervical dysplasia', differentiator: 'T-cell activating immunotherapy with Versamune platform' },
    ],
    marketDynamics: 'Surgical excision (LEEP/conization) remains standard of care with no approved pharmacotherapy. HPV therapeutic vaccines dominate the pipeline.',
  },
  cholangiocarcinoma: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'Incyte', assetName: 'Pemazyre (pemigatinib)', modality: 'smallMolecule', phase: 'approved', indication: 'FGFR2 fusion+ cholangiocarcinoma', differentiator: 'First targeted therapy approved for cholangiocarcinoma' },
      { companyName: 'QED Therapeutics/Taiho', assetName: 'Lytgobi (futibatinib)', modality: 'smallMolecule', phase: 'approved', indication: 'FGFR2 fusion+ cholangiocarcinoma', differentiator: 'Irreversible FGFR inhibitor with activity against resistance mutations' },
      { companyName: 'AstraZeneca', assetName: 'Imfinzi (durvalumab)', modality: 'mab', phase: 'approved', indication: 'Biliary tract cancer with gemcitabine/cisplatin', differentiator: 'First IO approved in first-line biliary tract cancer (TOPAZ-1)' },
    ],
    marketDynamics: 'IO plus chemotherapy is the new first-line standard after TOPAZ-1. Targeted therapies for FGFR2 and IDH1 subsets serve ~25% of patients.',
  },
  chronicPain: {
    density: 'very_high',
    keyAssets: [
      { companyName: 'Vertex Pharmaceuticals', assetName: 'suzetrigine (VX-548)', modality: 'smallMolecule', phase: 'approved', indication: 'Moderate-to-severe acute pain', differentiator: 'First-in-class NaV1.8 inhibitor; non-opioid mechanism' },
      { companyName: 'Eli Lilly', assetName: 'Emgality (galcanezumab)', modality: 'mab', phase: 'approved', indication: 'Chronic pain / migraine', differentiator: 'Anti-CGRP with expansion into osteoarthritis pain' },
      { companyName: 'Regeneron', assetName: 'fasinumab', modality: 'mab', phase: 'phase3', indication: 'Chronic low back and osteoarthritis pain', differentiator: 'Anti-NGF antibody with improved joint safety monitoring' },
    ],
    marketDynamics: 'NaV1.8 inhibitors represent the most significant non-opioid advance in decades. Anti-NGF programs have faced joint safety concerns but remain active. The market is massive and fragmented.',
  },
  chronicUrticaria: {
    density: 'high',
    keyAssets: [
      { companyName: 'Novartis', assetName: 'Xolair (omalizumab)', modality: 'mab', phase: 'approved', indication: 'Chronic spontaneous urticaria', differentiator: 'First biologic approved for CSU; anti-IgE mechanism' },
      { companyName: 'Regeneron/Sanofi', assetName: 'Dupixent (dupilumab)', modality: 'mab', phase: 'phase3', indication: 'Chronic spontaneous urticaria', differentiator: 'IL-4/IL-13 blockade expanding from atopic dermatitis' },
      { companyName: 'Celldex Therapeutics', assetName: 'barzolvolimab', modality: 'mab', phase: 'phase3', indication: 'Chronic spontaneous urticaria', differentiator: 'Anti-KIT antibody depleting mast cells; potential best-in-class efficacy' },
    ],
    marketDynamics: 'Omalizumab dominates but leaves significant unmet need in refractory patients. Anti-KIT mast cell depletion (barzolvolimab) has shown transformative efficacy data.',
  },
  cidp: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'argenx', assetName: 'Vyvgart (efgartigimod)', modality: 'mab', phase: 'approved', indication: 'Chronic inflammatory demyelinating polyneuropathy', differentiator: 'FcRn blocker reducing pathogenic IgG; approved 2024' },
      { companyName: 'CSL Behring', assetName: 'Privigen/Hizentra', modality: 'peptide', phase: 'approved', indication: 'CIDP', differentiator: 'IV/SC immunoglobulin standard of care' },
    ],
    marketDynamics: 'IVIg and corticosteroids have been the standard for decades. FcRn inhibitors are disrupting the landscape with targeted IgG reduction.',
  },
  cll: {
    density: 'very_high',
    keyAssets: [
      { companyName: 'BeiGene', assetName: 'Brukinsa (zanubrutinib)', modality: 'smallMolecule', phase: 'approved', indication: 'CLL/SLL', differentiator: 'Best-in-class BTK inhibitor per ALPINE head-to-head' },
      { companyName: 'AbbVie', assetName: 'Venclexta (venetoclax)', modality: 'smallMolecule', phase: 'approved', indication: 'CLL/SLL', differentiator: 'BCL-2 inhibitor enabling fixed-duration regimens' },
      { companyName: 'AstraZeneca', assetName: 'Calquence (acalabrutinib)', modality: 'smallMolecule', phase: 'approved', indication: 'CLL/SLL', differentiator: 'Second-gen BTK inhibitor with improved cardiac safety' },
    ],
    marketDynamics: 'BTK inhibitors and BCL-2 inhibitors have made CLL a largely oral, chemotherapy-free disease. Competition is fierce among three BTK inhibitors. Fixed-duration combinations are preferred over continuous therapy.',
  },
  clusterHeadache: {
    density: 'low',
    keyAssets: [
      { companyName: 'Eli Lilly', assetName: 'Emgality (galcanezumab)', modality: 'mab', phase: 'approved', indication: 'Episodic cluster headache', differentiator: 'Only FDA-approved preventive treatment for episodic cluster headache' },
      { companyName: 'electroCore', assetName: 'gammaCore', modality: 'smallMolecule', phase: 'approved', indication: 'Episodic cluster headache', differentiator: 'Non-invasive vagus nerve stimulation device for acute treatment' },
    ],
    marketDynamics: 'Severely underserved indication with oxygen and triptans as acute standards. Only galcanezumab has a cluster headache-specific approval for prevention. Chronic cluster headache has no approved preventive therapy.',
  },
  cml: {
    density: 'very_high',
    keyAssets: [
      { companyName: 'Novartis', assetName: 'Scemblix (asciminib)', modality: 'smallMolecule', phase: 'approved', indication: 'Ph+ CML', differentiator: 'First-in-class STAMP inhibitor targeting ABL myristoyl pocket' },
      { companyName: 'Novartis', assetName: 'Gleevec (imatinib)', modality: 'smallMolecule', phase: 'approved', indication: 'Ph+ CML', differentiator: 'Pioneering TKI now generic; remains first-line option' },
      { companyName: 'Bristol-Myers Squibb', assetName: 'Sprycel (dasatinib)', modality: 'smallMolecule', phase: 'approved', indication: 'Ph+ CML', differentiator: 'Second-gen TKI with CNS penetration' },
    ],
    marketDynamics: 'Mature market with five approved TKIs and growing generic competition from imatinib. Asciminib\'s novel STAMP mechanism addresses T315I resistance. Treatment-free remission is the emerging clinical goal.',
  },
  cmml: {
    density: 'very_low',
    keyAssets: [
      { companyName: 'Bristol-Myers Squibb', assetName: 'Vidaza (azacitidine)', modality: 'smallMolecule', phase: 'approved', indication: 'MDS/CMML', differentiator: 'Hypomethylating agent; standard of care for higher-risk CMML' },
      { companyName: 'Taiho Oncology', assetName: 'oral decitabine/cedazuridine', modality: 'smallMolecule', phase: 'approved', indication: 'MDS/CMML', differentiator: 'Oral formulation of decitabine improving convenience' },
    ],
    marketDynamics: 'Limited therapeutic options beyond hypomethylating agents and stem cell transplant. No CMML-specific approvals exist; treatments are borrowed from MDS.',
  },
  cmt: {
    density: 'very_low',
    keyAssets: [
      { companyName: 'Pharnext', assetName: 'PXT3003', modality: 'smallMolecule', phase: 'phase3', indication: 'Charcot-Marie-Tooth disease type 1A', differentiator: 'Fixed-dose combination targeting PMP22 overexpression' },
      { companyName: 'DTx Pharma/Novartis', assetName: 'DTx-1252', modality: 'rnai', phase: 'phase1', indication: 'CMT1A', differentiator: 'GalNAc-siRNA targeting PMP22 mRNA to reduce gene dosage' },
    ],
    marketDynamics: 'No approved disease-modifying therapies exist. PMP22 gene dosage reduction via RNA-based approaches is the dominant strategy.',
  },
  coldAgglutinin: {
    density: 'low',
    keyAssets: [
      { companyName: 'Sanofi', assetName: 'Enjaymo (sutimlimab)', modality: 'mab', phase: 'approved', indication: 'Cold agglutinin disease', differentiator: 'First and only approved therapy; anti-C1s complement inhibitor' },
      { companyName: 'BeiGene', assetName: 'Brukinsa (zanubrutinib)', modality: 'smallMolecule', phase: 'phase3', indication: 'Cold agglutinin disease', differentiator: 'BTK inhibitor targeting clonal B-cell population' },
    ],
    marketDynamics: 'Sutimlimab was the first approved therapy in 2022 but does not address the underlying clonal B-cell disorder. BTK inhibitors offer potential for deeper disease modification.',
  },
  congenitalAdrenalHyperplasia: {
    density: 'low',
    keyAssets: [
      { companyName: 'Neurocrine Biosciences', assetName: 'Crenessity (crinecerfont)', modality: 'smallMolecule', phase: 'approved', indication: 'Classic congenital adrenal hyperplasia', differentiator: 'First FDA-approved CRF1 antagonist reducing excess androgens without supraphysiologic steroids' },
      { companyName: 'Spruce Biosciences', assetName: 'tildacerfont', modality: 'smallMolecule', phase: 'phase3', indication: 'Classic congenital adrenal hyperplasia', differentiator: 'CRF1 receptor antagonist competitor with once-daily oral dosing' },
    ],
    marketDynamics: 'CRF1 antagonists represent a paradigm shift from glucocorticoid dose escalation to targeted ACTH suppression. Crinecerfont\'s 2024 approval is transformative.',
  },
  congenitalHyperinsulinism: {
    density: 'very_low',
    keyAssets: [
      { companyName: 'Zealand Pharma', assetName: 'dasiglucagon', modality: 'peptide', phase: 'phase3', indication: 'Congenital hyperinsulinism', differentiator: 'Glucagon analog delivered via continuous SC infusion pump' },
      { companyName: 'Rezolute', assetName: 'RZ358 (ersodetug)', modality: 'mab', phase: 'phase3', indication: 'Congenital hyperinsulinism', differentiator: 'Anti-insulin receptor antibody preventing hypoglycemia' },
    ],
    marketDynamics: 'Diazoxide is the only approved medical therapy but is ineffective in ~50% of patients. Near-total pancreatectomy remains necessary for many.',
  },
  cornealDystrophy: {
    density: 'very_low',
    keyAssets: [
      { companyName: 'Avellino Labs', assetName: 'AV-101', modality: 'geneTherapy', phase: 'phase1', indication: 'Granular corneal dystrophy type 2', differentiator: 'CRISPR-based gene editing targeting TGFBI mutations' },
      { companyName: 'Trefoil Therapeutics', assetName: 'TTHX1114', modality: 'peptide', phase: 'phase1', indication: 'Fuchs endothelial corneal dystrophy', differentiator: 'Engineered FGF1 promoting corneal endothelial cell regeneration' },
    ],
    marketDynamics: 'Corneal transplantation remains the definitive treatment with no approved pharmacotherapy. Gene therapy and gene editing approaches are emerging for genetically defined subtypes.',
  },
  cushings: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'Corcept Therapeutics', assetName: 'Korlym (mifepristone)', modality: 'smallMolecule', phase: 'approved', indication: 'Cushing\'s syndrome hyperglycemia', differentiator: 'First approved pharmacotherapy; glucocorticoid receptor antagonist' },
      { companyName: 'Corcept Therapeutics', assetName: 'relacorilant', modality: 'smallMolecule', phase: 'phase3', indication: 'Cushing\'s syndrome', differentiator: 'Selective cortisol modulator without progesterone receptor activity' },
      { companyName: 'Recordati', assetName: 'Isturisa (osilodrostat)', modality: 'smallMolecule', phase: 'approved', indication: 'Cushing\'s disease', differentiator: 'Cortisol synthesis inhibitor (11-beta-hydroxylase) with oral dosing' },
    ],
    marketDynamics: 'Surgery is first-line for Cushing\'s disease, but recurrence rates reach 20-30%. Corcept dominates the pharmacotherapy market. Multiple mechanisms compete.',
  },
  cystinosis: {
    density: 'very_low',
    keyAssets: [
      { companyName: 'Recordati', assetName: 'Procysbi (delayed-release cysteamine)', modality: 'smallMolecule', phase: 'approved', indication: 'Nephropathic cystinosis', differentiator: 'Every-12-hour dosing improving compliance vs Cystagon' },
      { companyName: 'Mylan/Viatris', assetName: 'Cystagon (cysteamine bitartrate)', modality: 'smallMolecule', phase: 'approved', indication: 'Nephropathic cystinosis', differentiator: 'Original cystine-depleting therapy; every-6-hour dosing' },
    ],
    marketDynamics: 'Cysteamine is the standard of care but requires lifelong dosing with significant GI side effects. Gene therapy offers potential cure. Ultra-rare with strong orphan drug economics.',
  },
  dermatomyositis: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'Octapharma', assetName: 'Octagam (IVIg)', modality: 'peptide', phase: 'approved', indication: 'Dermatomyositis', differentiator: 'Intravenous immunoglobulin approved for DM based on ProDERM trial' },
      { companyName: 'argenx', assetName: 'Vyvgart (efgartigimod)', modality: 'mab', phase: 'phase3', indication: 'Dermatomyositis', differentiator: 'FcRn blocker reducing pathogenic autoantibodies' },
    ],
    marketDynamics: 'IVIg gained formal approval for DM in 2021. JAK inhibitors and FcRn blockers are the main mechanistic competitors. Type I interferon pathway targeting is scientifically compelling.',
  },
  dravet: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'Jazz Pharmaceuticals', assetName: 'Epidiolex (cannabidiol)', modality: 'smallMolecule', phase: 'approved', indication: 'Dravet syndrome seizures', differentiator: 'First FDA-approved cannabidiol' },
      { companyName: 'UCB', assetName: 'Fintepla (fenfluramine)', modality: 'smallMolecule', phase: 'approved', indication: 'Dravet syndrome seizures', differentiator: 'Serotonin-releasing agent with sigma-1 receptor activity' },
      { companyName: 'Stoke Therapeutics', assetName: 'STK-001', modality: 'aso', phase: 'phase2', indication: 'Dravet syndrome', differentiator: 'TANGO ASO upregulating functional SCN1A protein; disease-modifying' },
    ],
    marketDynamics: 'Three approved symptomatic therapies compete for add-on use. Disease-modifying approaches targeting SCN1A haploinsufficiency (ASOs, gene therapy) are the next frontier.',
  },
  egpa: {
    density: 'low',
    keyAssets: [
      { companyName: 'GSK', assetName: 'Nucala (mepolizumab)', modality: 'mab', phase: 'approved', indication: 'Eosinophilic granulomatosis with polyangiitis', differentiator: 'First and only approved biologic for EGPA; anti-IL-5' },
      { companyName: 'AstraZeneca', assetName: 'Fasenra (benralizumab)', modality: 'mab', phase: 'phase3', indication: 'EGPA', differentiator: 'Anti-IL-5Ra with eosinophil depletion via ADCC' },
    ],
    marketDynamics: 'Mepolizumab is the only approved targeted therapy but many patients remain on chronic corticosteroids. The key unmet need is a steroid-free remission strategy.',
  },
  endometrial: {
    density: 'high',
    keyAssets: [
      { companyName: 'GSK', assetName: 'Jemperli (dostarlimab)', modality: 'mab', phase: 'approved', indication: 'dMMR endometrial cancer', differentiator: 'Anti-PD-1 with RUBY trial establishing first-line IO + chemo standard' },
      { companyName: 'Merck', assetName: 'Keytruda (pembrolizumab)', modality: 'mab', phase: 'approved', indication: 'Advanced endometrial cancer', differentiator: 'Approved with lenvatinib in non-MSI-H and as monotherapy in MSI-H/dMMR' },
      { companyName: 'Eisai', assetName: 'Lenvima (lenvatinib)', modality: 'smallMolecule', phase: 'approved', indication: 'Advanced endometrial cancer', differentiator: 'Multi-kinase inhibitor combined with pembrolizumab' },
    ],
    marketDynamics: 'IO has transformed first-line treatment, with biomarker stratification (MSI-H/dMMR vs. proficient) guiding therapy selection. ADCs and HER2-directed therapies are emerging in later-line settings.',
  },
  // --- Batch 3: epidermolysis through hemophiliaA ---
  epidermolysis: {
    density: 'low',
    keyAssets: [
      { companyName: 'Krystal Biotech', assetName: 'Vyjuvek (beremagene geperpavec)', modality: 'geneTherapy', phase: 'approved', indication: 'Epidermolysis bullosa', differentiator: 'First topical gene therapy for dystrophic EB' },
      { companyName: 'Abeona Therapeutics', assetName: 'EB-101 (pz-cel)', modality: 'geneTherapy', phase: 'approved', indication: 'Epidermolysis bullosa', differentiator: 'Autologous cell therapy for RDEB' },
    ],
    marketDynamics: 'Gene therapy has transformed the EB landscape with multiple approved products. Remaining unmet need centers on non-dystrophic subtypes and systemic approaches.',
  },
  esophageal: {
    density: 'high',
    keyAssets: [
      { companyName: 'BMS', assetName: 'Opdivo (nivolumab)', modality: 'mab', phase: 'approved', indication: 'Esophageal cancer', differentiator: 'PD-1 inhibitor approved in adjuvant and advanced settings' },
      { companyName: 'Merck', assetName: 'Keytruda (pembrolizumab)', modality: 'mab', phase: 'approved', indication: 'Esophageal cancer', differentiator: 'First-line standard with chemo for esophageal/GEJ' },
      { companyName: 'Daiichi Sankyo/AstraZeneca', assetName: 'Enhertu', modality: 'adc', phase: 'approved', indication: 'HER2+ GEJ adenocarcinoma', differentiator: 'HER2-directed ADC for GEJ adenocarcinoma' },
    ],
    marketDynamics: 'IO plus chemotherapy is standard first-line. HER2-targeted ADCs and bispecifics are expanding options in biomarker-selected populations.',
  },
  ewingSarcoma: {
    density: 'low',
    keyAssets: [
      { companyName: 'Various', assetName: 'VCD/IE chemotherapy', modality: 'smallMolecule', phase: 'approved', indication: 'Ewing sarcoma', differentiator: 'Standard multi-agent chemotherapy backbone' },
      { companyName: 'Salarius Pharmaceuticals', assetName: 'Seclidemstat (SP-2577)', modality: 'smallMolecule', phase: 'phase2', indication: 'Ewing sarcoma', differentiator: 'LSD1 inhibitor targeting EWS-FLI1 downstream pathways' },
    ],
    marketDynamics: 'Treatment has not changed meaningfully in decades. Novel approaches target EWS-FLI1 fusion biology. Relapsed/refractory disease remains a major unmet need.',
  },
  fabry: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'Sanofi Genzyme', assetName: 'Fabrazyme (agalsidase beta)', modality: 'peptide', phase: 'approved', indication: 'Fabry disease', differentiator: 'First approved ERT, long-term standard of care' },
      { companyName: 'Amicus Therapeutics', assetName: 'Galafold (migalastat)', modality: 'smallMolecule', phase: 'approved', indication: 'Fabry disease', differentiator: 'First oral pharmacological chaperone for amenable mutations' },
      { companyName: 'Protalix/Chiesi', assetName: 'Elfabrio (pegunigalsidase alfa)', modality: 'peptide', phase: 'approved', indication: 'Fabry disease', differentiator: 'PEGylated ERT with longer half-life, every 4 weeks' },
    ],
    marketDynamics: 'ERT remains standard but is burdensome with frequent infusions. Oral chaperone therapy serves a subset with amenable GLA mutations. Gene therapy programs aim for one-time treatment.',
  },
  familialHypercholesterolemia: {
    density: 'high',
    keyAssets: [
      { companyName: 'Amgen', assetName: 'Repatha (evolocumab)', modality: 'mab', phase: 'approved', indication: 'Familial hypercholesterolemia', differentiator: 'PCSK9 mAb with FOURIER outcomes trial' },
      { companyName: 'Novartis', assetName: 'Leqvio (inclisiran)', modality: 'rnai', phase: 'approved', indication: 'Familial hypercholesterolemia', differentiator: 'siRNA targeting PCSK9, twice-yearly dosing' },
      { companyName: 'Regeneron', assetName: 'Evkeeza (evinacumab)', modality: 'mab', phase: 'approved', indication: 'Homozygous FH', differentiator: 'ANGPTL3 inhibitor for homozygous FH' },
      { companyName: 'Verve Therapeutics', assetName: 'VERVE-102', modality: 'geneTherapy', phase: 'phase1', indication: 'FH', differentiator: 'In vivo base editing of PCSK9 for permanent LDL reduction' },
    ],
    marketDynamics: 'PCSK9 inhibitors dominate with both antibody and siRNA approaches approved. Gene editing programs promise one-time curative approaches but face safety scrutiny.',
  },
  fertilityArt: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'Ferring Pharmaceuticals', assetName: 'Menopur (menotropins)', modality: 'peptide', phase: 'approved', indication: 'Fertility / ART', differentiator: 'Urinary-derived FSH/LH combination for ovarian stimulation' },
      { companyName: 'Merck KGaA', assetName: 'Gonal-f (follitropin alfa)', modality: 'peptide', phase: 'approved', indication: 'Fertility / ART', differentiator: 'Recombinant FSH, global market leader in stimulation' },
      { companyName: 'Ferring Pharmaceuticals', assetName: 'Rekovelle (follitropin delta)', modality: 'peptide', phase: 'approved', indication: 'Fertility / ART', differentiator: 'First individualized FSH dosing based on AMH and body weight' },
    ],
    marketDynamics: 'Recombinant gonadotropins dominate ovarian stimulation. Innovation focuses on individualized dosing protocols and oral GnRH antagonists.',
  },
  follicular: {
    density: 'very_high',
    keyAssets: [
      { companyName: 'Roche/Genentech', assetName: 'Mosunetuzumab', modality: 'bispecific', phase: 'approved', indication: 'Follicular lymphoma', differentiator: 'CD20xCD3 bispecific, first bispecific in FL' },
      { companyName: 'AbbVie/Genentech', assetName: 'Epcoritamab', modality: 'bispecific', phase: 'approved', indication: 'Follicular lymphoma', differentiator: 'Subcutaneous CD20xCD3 bispecific antibody' },
      { companyName: 'Kite/Gilead', assetName: 'Yescarta (axicabtagene ciloleucel)', modality: 'cellTherapy', phase: 'approved', indication: 'Follicular lymphoma', differentiator: 'CD19 CAR-T approved for relapsed/refractory FL' },
    ],
    marketDynamics: 'CD20xCD3 bispecifics are rapidly reshaping relapsed FL, competing with PI3K inhibitors and CAR-T. Earlier-line bispecific use and time-limited combinations threaten chemoimmunotherapy.',
  },
  foodAllergy: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'Aimmune/Nestle Health Science', assetName: 'Palforzia (peanut allergen)', modality: 'peptide', phase: 'approved', indication: 'Food allergy', differentiator: 'First approved OIT for peanut allergy in children' },
      { companyName: 'Regeneron/Sanofi', assetName: 'Dupixent (dupilumab)', modality: 'mab', phase: 'approved', indication: 'Food allergy', differentiator: 'IL-4/IL-13 blocker approved for multiple food allergies' },
      { companyName: 'Novartis', assetName: 'Xolair (omalizumab)', modality: 'mab', phase: 'approved', indication: 'Food allergy', differentiator: 'Anti-IgE mAb approved for food allergy risk reduction' },
    ],
    marketDynamics: 'Dupixent\'s broad food allergy approval was transformative. Xolair provides IgE-targeted protection. OIT remains available but burdensome.',
  },
  fragileX: {
    density: 'very_low',
    keyAssets: [
      { companyName: 'Tetra Biosciences', assetName: 'BPN14770 (zatolmilast)', modality: 'smallMolecule', phase: 'phase3', indication: 'Fragile X syndrome', differentiator: 'PDE4D inhibitor improving cognitive function' },
      { companyName: 'Zynerba Pharmaceuticals', assetName: 'Zygel (cannabidiol transdermal)', modality: 'smallMolecule', phase: 'phase3', indication: 'Fragile X syndrome', differentiator: 'Transdermal CBD gel for behavioral symptoms' },
    ],
    marketDynamics: 'No approved disease-modifying therapies exist. Management is symptomatic. PDE4D inhibition represents the most advanced novel mechanism.',
  },
  friedreichs: {
    density: 'low',
    keyAssets: [
      { companyName: 'Biogen', assetName: 'Skyclarys (omaveloxolone)', modality: 'smallMolecule', phase: 'approved', indication: 'Friedreich\'s ataxia', differentiator: 'First and only approved therapy, Nrf2 activator' },
      { companyName: 'Lexeo Therapeutics', assetName: 'LX2006', modality: 'geneTherapy', phase: 'phase1', indication: 'Friedreich\'s ataxia', differentiator: 'AAV-based frataxin gene replacement for cardiomyopathy' },
    ],
    marketDynamics: 'Omaveloxolone is the sole approved therapy with modest efficacy. Gene therapy and frataxin-boosting strategies aim to address root cause.',
  },
  frontotemporal: {
    density: 'low',
    keyAssets: [
      { companyName: 'Prevail/Eli Lilly', assetName: 'PR006', modality: 'geneTherapy', phase: 'phase2', indication: 'Frontotemporal dementia', differentiator: 'AAV gene therapy delivering progranulin for GRN-FTD' },
      { companyName: 'Denali Therapeutics', assetName: 'DNL593', modality: 'geneTherapy', phase: 'phase1', indication: 'Frontotemporal dementia', differentiator: 'Brain-penetrant AAV delivering progranulin' },
      { companyName: 'Ionis/Biogen', assetName: 'ION363 (jacifusen)', modality: 'aso', phase: 'phase3', indication: 'FUS-ALS/FTD', differentiator: 'ASO targeting FUS' },
    ],
    marketDynamics: 'No approved disease-modifying therapies exist. Genetic subtypes (GRN, C9orf72, MAPT) enable targeted approaches. Progranulin replacement via gene therapy leads the field.',
  },
  fsgs: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'Travere Therapeutics', assetName: 'Filspari (sparsentan)', modality: 'smallMolecule', phase: 'approved', indication: 'FSGS', differentiator: 'Dual endothelin/angiotensin receptor antagonist, first approved for FSGS' },
      { companyName: 'Vertex Pharmaceuticals', assetName: 'Inaxaplin (VX-147)', modality: 'smallMolecule', phase: 'phase3', indication: 'FSGS', differentiator: 'APOL1 inhibitor for genetically defined FSGS' },
    ],
    marketDynamics: 'Sparsentan provides the first targeted therapy. APOL1-mediated FSGS represents a precision medicine opportunity. Complement inhibitors are also advancing.',
  },
  fshd: {
    density: 'very_low',
    keyAssets: [
      { companyName: 'Fulcrum Therapeutics', assetName: 'Losmapimod', modality: 'smallMolecule', phase: 'phase3', indication: 'FSHD', differentiator: 'p38 MAPK inhibitor reducing DUX4 expression' },
      { companyName: 'Avidity Biosciences', assetName: 'AOC 1044', modality: 'rnai', phase: 'phase1', indication: 'FSHD', differentiator: 'Antibody-siRNA conjugate targeting DUX4' },
    ],
    marketDynamics: 'No approved therapies exist. DUX4 silencing via RNA-based approaches represents the most promising mechanistic strategy.',
  },
  galactosemia: {
    density: 'very_low',
    keyAssets: [
      { companyName: 'Applied Therapeutics', assetName: 'Govorestat (AT-007)', modality: 'smallMolecule', phase: 'phase3', indication: 'Galactosemia', differentiator: 'Aldose reductase inhibitor reducing galactitol' },
    ],
    marketDynamics: 'No approved pharmacological therapies exist; dietary galactose restriction is the only management. Govorestat is the only advanced clinical candidate.',
  },
  gaucher: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'Sanofi Genzyme', assetName: 'Cerezyme (imiglucerase)', modality: 'peptide', phase: 'approved', indication: 'Gaucher disease', differentiator: 'Gold-standard ERT for Type 1 Gaucher' },
      { companyName: 'Sanofi Genzyme', assetName: 'Cerdelga (eliglustat)', modality: 'smallMolecule', phase: 'approved', indication: 'Gaucher disease', differentiator: 'First-line oral SRT based on CYP2D6 status' },
      { companyName: 'Prevail/Eli Lilly', assetName: 'PR001 (LY3884961)', modality: 'geneTherapy', phase: 'phase2', indication: 'Neuronopathic Gaucher', differentiator: 'AAV gene therapy for neuronopathic Gaucher (Type 2/3)' },
    ],
    marketDynamics: 'Type 1 Gaucher is well-served by multiple ERTs and oral SRT. Neuronopathic forms (Types 2 and 3) remain unaddressed. Gene therapy represents the frontier.',
  },
  gbs: {
    density: 'low',
    keyAssets: [
      { companyName: 'Various', assetName: 'IVIg', modality: 'peptide', phase: 'approved', indication: 'Guillain-Barre syndrome', differentiator: 'Standard of care immunomodulation for acute GBS' },
      { companyName: 'argenx', assetName: 'Vyvgart (efgartigimod)', modality: 'mab', phase: 'phase3', indication: 'Guillain-Barre syndrome', differentiator: 'FcRn blocker accelerating pathogenic IgG clearance' },
    ],
    marketDynamics: 'IVIg and plasma exchange remain standard but have limited evidence for long-term outcomes. FcRn inhibitors represent the most active development space.',
  },
  gestationalDiabetes: {
    density: 'low',
    keyAssets: [
      { companyName: 'Novo Nordisk', assetName: 'Insulin (various)', modality: 'peptide', phase: 'approved', indication: 'Gestational diabetes', differentiator: 'Standard pharmacotherapy when lifestyle measures fail' },
      { companyName: 'Various', assetName: 'Metformin', modality: 'smallMolecule', phase: 'approved', indication: 'Gestational diabetes', differentiator: 'Off-label oral option, growing evidence base' },
    ],
    marketDynamics: 'Insulin remains the only recommended pharmacotherapy by most guidelines. No novel agents are specifically developed for GDM due to pregnancy safety barriers.',
  },
  giantCellArteritis: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'Roche/Genentech', assetName: 'Actemra (tocilizumab)', modality: 'mab', phase: 'approved', indication: 'Giant cell arteritis', differentiator: 'First biologic approved for GCA, IL-6R blockade enables steroid sparing' },
      { companyName: 'AbbVie', assetName: 'Upadacitinib', modality: 'smallMolecule', phase: 'phase3', indication: 'Giant cell arteritis', differentiator: 'JAK1 inhibitor for steroid-refractory GCA' },
    ],
    marketDynamics: 'Tocilizumab is the only approved biologic but relapse rates upon discontinuation remain high. JAK inhibitors and additional IL-6 pathway agents seek to expand options.',
  },
  glycogenStorage: {
    density: 'low',
    keyAssets: [
      { companyName: 'Ultragenyx', assetName: 'DTX401', modality: 'geneTherapy', phase: 'phase3', indication: 'GSD Ia', differentiator: 'AAV gene therapy delivering glucose-6-phosphatase' },
      { companyName: 'Maze Therapeutics', assetName: 'MZE001', modality: 'smallMolecule', phase: 'phase1', indication: 'GSD', differentiator: 'Precision approach targeting glycogen synthase' },
    ],
    marketDynamics: 'Management is largely dietary with cornstarch regimens for hepatic GSDs. Gene therapy is the most promising approach. Each GSD subtype requires distinct therapeutic strategies.',
  },
  gout: {
    density: 'high',
    keyAssets: [
      { companyName: 'Various', assetName: 'Allopurinol', modality: 'smallMolecule', phase: 'approved', indication: 'Gout', differentiator: 'First-line urate-lowering therapy, generic standard' },
      { companyName: 'Horizon/Amgen', assetName: 'Krystexxa (pegloticase)', modality: 'peptide', phase: 'approved', indication: 'Refractory gout', differentiator: 'PEGylated uricase for refractory gout with immunomodulatory co-dosing' },
      { companyName: 'Selecta/Sobi', assetName: 'SEL-212 (pegadricase + ImmTOR)', modality: 'peptide', phase: 'phase3', indication: 'Gout', differentiator: 'Uricase with immune tolerance nanoparticles to prevent anti-drug antibodies' },
    ],
    marketDynamics: 'Xanthine oxidase inhibitors dominate first-line. Refractory gout is a growing niche where pegloticase leads but anti-drug antibodies limit efficacy.',
  },
  hairyCell: {
    density: 'low',
    keyAssets: [
      { companyName: 'Various', assetName: 'Cladribine', modality: 'smallMolecule', phase: 'approved', indication: 'Hairy cell leukemia', differentiator: 'Single-course purine analog, high complete response rate' },
      { companyName: 'Roche', assetName: 'Vemurafenib', modality: 'smallMolecule', phase: 'phase2', indication: 'Hairy cell leukemia', differentiator: 'BRAF V600E inhibitor repurposed for HCL' },
    ],
    marketDynamics: 'Purine analogs achieve durable remissions in most patients. BRAF inhibitors target near-universal BRAF V600E mutation in relapsed disease.',
  },
  hemochromatosis: {
    density: 'very_low',
    keyAssets: [
      { companyName: 'Protagonist Therapeutics', assetName: 'Rusfertide (PTG-300)', modality: 'peptide', phase: 'phase3', indication: 'Hemochromatosis', differentiator: 'Hepcidin mimetic reducing iron absorption and need for phlebotomy' },
      { companyName: 'Disc Medicine', assetName: 'DISC-0974', modality: 'mab', phase: 'phase2', indication: 'Hemochromatosis', differentiator: 'Anti-hemojuvelin antibody increasing hepcidin levels' },
    ],
    marketDynamics: 'Phlebotomy is the only standard treatment. Hepcidin mimetics represent a paradigm shift, potentially replacing or reducing phlebotomy burden.',
  },
  hemophiliaA: {
    density: 'very_high',
    keyAssets: [
      { companyName: 'Roche', assetName: 'Hemlibra (emicizumab)', modality: 'bispecific', phase: 'approved', indication: 'Hemophilia A', differentiator: 'Bispecific mimicking FVIIIa, subcutaneous prophylaxis standard' },
      { companyName: 'BioMarin', assetName: 'Roctavian (valoctocogene roxaparvovec)', modality: 'geneTherapy', phase: 'approved', indication: 'Hemophilia A', differentiator: 'First gene therapy for severe hemophilia A' },
      { companyName: 'Sanofi', assetName: 'Altuviiio (efanesoctocog alfa)', modality: 'peptide', phase: 'approved', indication: 'Hemophilia A', differentiator: 'Extended half-life FVIII with once-weekly dosing' },
      { companyName: 'Novo Nordisk', assetName: 'Mim8', modality: 'bispecific', phase: 'phase3', indication: 'Hemophilia A', differentiator: 'Next-gen FVIIIa-mimetic bispecific with enhanced potency' },
    ],
    marketDynamics: 'Hemlibra dominates prophylaxis with subcutaneous convenience. Gene therapy offers potential cure but durability concerns limit uptake. Next-gen bispecifics expand the non-factor landscape.',
  },
  // --- Batch 4: hemophiliaB through mesothelioma ---
  hemophiliaB: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'Pfizer', assetName: 'Beqvez (fidanacogene elaparvovec)', modality: 'geneTherapy', phase: 'approved', indication: 'Hemophilia B', differentiator: 'First FDA-approved gene therapy for hemophilia B' },
      { companyName: 'CSL Behring', assetName: 'IDELVION', modality: 'peptide', phase: 'approved', indication: 'Hemophilia B', differentiator: 'Extended half-life rFIX-albumin fusion' },
      { companyName: 'Sarepta/Roche', assetName: 'Hemgenix (etranacogene dezaparvovec)', modality: 'geneTherapy', phase: 'approved', indication: 'Hemophilia B', differentiator: 'AAV5 gene therapy approved in EU and US' },
    ],
    marketDynamics: 'Gene therapy is reshaping hemophilia B treatment with curative potential, but high price points ($3.5M+) limit uptake. Extended half-life factor replacements remain standard for most patients.',
  },
  heredAngioedema: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'BioCryst', assetName: 'Orladeyo (berotralstat)', modality: 'smallMolecule', phase: 'approved', indication: 'HAE prophylaxis', differentiator: 'First oral once-daily prophylactic for HAE' },
      { companyName: 'Takeda', assetName: 'Takhzyro (lanadelumab)', modality: 'mab', phase: 'approved', indication: 'HAE prophylaxis', differentiator: 'Anti-kallikrein mAb, Q2W dosing, strong efficacy' },
      { companyName: 'KalVista', assetName: 'Sebetralstat', modality: 'smallMolecule', phase: 'approved', indication: 'HAE acute', differentiator: 'First oral on-demand treatment for HAE attacks' },
    ],
    marketDynamics: 'Prophylactic therapies have become standard of care. Oral therapies gaining share from injectables. Gene editing and RNA-targeting approaches represent next frontier.',
  },
  hfpef: {
    density: 'high',
    keyAssets: [
      { companyName: 'Eli Lilly', assetName: 'Jardiance (empagliflozin)', modality: 'smallMolecule', phase: 'approved', indication: 'HFpEF', differentiator: 'SGLT2i approved across HF spectrum (EMPEROR-Preserved)' },
      { companyName: 'AstraZeneca', assetName: 'Farxiga (dapagliflozin)', modality: 'smallMolecule', phase: 'approved', indication: 'HFpEF', differentiator: 'SGLT2i with broad HF indication (DELIVER trial)' },
      { companyName: 'Eli Lilly', assetName: 'Tirzepatide', modality: 'peptide', phase: 'phase3', indication: 'HFpEF with obesity', differentiator: 'GIP/GLP-1 RA targeting obesity-related HFpEF (SUMMIT trial positive)' },
      { companyName: 'Novo Nordisk', assetName: 'Semaglutide', modality: 'peptide', phase: 'phase3', indication: 'HFpEF with obesity', differentiator: 'GLP-1 RA with STEP-HFpEF positive results' },
    ],
    marketDynamics: 'SGLT2 inhibitors established as first disease-modifying therapies for HFpEF. GLP-1 RAs are emerging as transformative for the obesity-HFpEF phenotype.',
  },
  hodgkins: {
    density: 'high',
    keyAssets: [
      { companyName: 'Seagen/Takeda', assetName: 'Adcetris (brentuximab vedotin)', modality: 'adc', phase: 'approved', indication: 'Hodgkin lymphoma', differentiator: 'Anti-CD30 ADC, frontline combo with AVD' },
      { companyName: 'Bristol-Myers Squibb', assetName: 'Opdivo (nivolumab)', modality: 'mab', phase: 'approved', indication: 'Hodgkin lymphoma', differentiator: 'PD-1 inhibitor for relapsed/refractory HL' },
      { companyName: 'Merck', assetName: 'Keytruda (pembrolizumab)', modality: 'mab', phase: 'approved', indication: 'Hodgkin lymphoma', differentiator: 'PD-1 inhibitor approved in R/R cHL' },
    ],
    marketDynamics: 'High cure rates with frontline ABVD/BV+AVD. PD-1 inhibitors have transformed relapsed/refractory setting. Focus is shifting to de-escalation strategies.',
  },
  hyperemesisGravidarum: {
    density: 'very_low',
    keyAssets: [
      { companyName: 'Duchesnay', assetName: 'Diclegis (doxylamine/pyridoxine)', modality: 'smallMolecule', phase: 'approved', indication: 'Nausea/vomiting of pregnancy', differentiator: 'Only FDA-approved drug for NVP' },
    ],
    marketDynamics: 'Severely underserved indication with no targeted therapies specifically approved for hyperemesis gravidarum. Safety concerns in pregnancy create high regulatory barriers.',
  },
  hyperoxaluria: {
    density: 'low',
    keyAssets: [
      { companyName: 'Alnylam', assetName: 'Oxlumo (lumasiran)', modality: 'rnai', phase: 'approved', indication: 'Primary hyperoxaluria type 1', differentiator: 'First RNAi therapy targeting HAO1, reduces oxalate production' },
      { companyName: 'Alnylam', assetName: 'Nedosiran', modality: 'rnai', phase: 'approved', indication: 'Primary hyperoxaluria type 1', differentiator: 'RNAi targeting LDHA, broader PH coverage potential' },
    ],
    marketDynamics: 'RNAi therapeutics have revolutionized primary hyperoxaluria treatment. Alnylam dominates with two approved products. Liver transplant is being supplanted by these targeted therapies.',
  },
  hypophosphatasia: {
    density: 'very_low',
    keyAssets: [
      { companyName: 'Alexion/AstraZeneca', assetName: 'Strensiq (asfotase alfa)', modality: 'peptide', phase: 'approved', indication: 'Hypophosphatasia', differentiator: 'First and only approved enzyme replacement therapy for HPP' },
    ],
    marketDynamics: 'Ultra-rare disease with a single approved therapy generating ~$1B annually. Asfotase alfa requires frequent subcutaneous injections, creating opportunity for improved formulations.',
  },
  ibd_broad: {
    density: 'very_high',
    keyAssets: [
      { companyName: 'AbbVie', assetName: 'Skyrizi (risankizumab)', modality: 'mab', phase: 'approved', indication: 'Crohn\'s disease & UC', differentiator: 'IL-23p19 inhibitor with strong efficacy and safety across IBD' },
      { companyName: 'AbbVie', assetName: 'Rinvoq (upadacitinib)', modality: 'smallMolecule', phase: 'approved', indication: 'UC & Crohn\'s disease', differentiator: 'JAK1 selective inhibitor, oral option with high response rates' },
      { companyName: 'Takeda', assetName: 'Entyvio (vedolizumab)', modality: 'mab', phase: 'approved', indication: 'UC & Crohn\'s disease', differentiator: 'Gut-selective anti-integrin with favorable safety profile' },
      { companyName: 'Roche', assetName: 'Tulisokibart', modality: 'mab', phase: 'phase3', indication: 'Ulcerative colitis', differentiator: 'Anti-TL1A antibody, novel mechanism with genetic biomarker strategy' },
    ],
    marketDynamics: 'IL-23 inhibitors are rapidly becoming preferred first-line advanced therapy. Anti-TL1A antibodies represent the most exciting emerging class. S1P modulators and JAK inhibitors provide oral options.',
  },
  insomnia: {
    density: 'high',
    keyAssets: [
      { companyName: 'Idorsia', assetName: 'Quviviq (daridorexant)', modality: 'smallMolecule', phase: 'approved', indication: 'Insomnia', differentiator: 'DORA with favorable next-day functioning profile' },
      { companyName: 'Merck', assetName: 'Belsomra (suvorexant)', modality: 'smallMolecule', phase: 'approved', indication: 'Insomnia', differentiator: 'First approved dual orexin receptor antagonist' },
      { companyName: 'Eisai', assetName: 'Dayvigo (lemborexant)', modality: 'smallMolecule', phase: 'approved', indication: 'Insomnia', differentiator: 'DORA with balanced OX1R/OX2R binding' },
    ],
    marketDynamics: 'DORAs have become the preferred pharmacotherapy class, displacing benzodiazepine receptor agonists. Digital therapeutics (CBT-i apps) present non-pharmacological competition.',
  },
  itp: {
    density: 'high',
    keyAssets: [
      { companyName: 'Amgen', assetName: 'Nplate (romiplostim)', modality: 'peptide', phase: 'approved', indication: 'ITP', differentiator: 'TPO receptor agonist, weekly SC injection' },
      { companyName: 'Novartis', assetName: 'Promacta (eltrombopag)', modality: 'smallMolecule', phase: 'approved', indication: 'ITP', differentiator: 'Oral TPO-RA with broad access' },
      { companyName: 'Rigel', assetName: 'Tavalisse (fostamatinib)', modality: 'smallMolecule', phase: 'approved', indication: 'ITP', differentiator: 'First SYK inhibitor for ITP, different MOA from TPO-RAs' },
    ],
    marketDynamics: 'TPO receptor agonists dominate second-line treatment. FcRn inhibitors are emerging as a new mechanistic class. Splenectomy rates continue to decline.',
  },
  keratoconus: {
    density: 'low',
    keyAssets: [
      { companyName: 'Glaukos', assetName: 'iLink (corneal cross-linking)', modality: 'smallMolecule', phase: 'approved', indication: 'Progressive keratoconus', differentiator: 'FDA-approved riboflavin/UV-A corneal cross-linking system' },
    ],
    marketDynamics: 'Corneal cross-linking is the only FDA-approved disease-modifying intervention, halting progression. Advanced cases still require corneal transplantation.',
  },
  krabbe: {
    density: 'very_low',
    keyAssets: [
      { companyName: 'Passage Bio', assetName: 'PBKR03', modality: 'geneTherapy', phase: 'phase1', indication: 'Krabbe disease', differentiator: 'AAV-mediated GALC gene therapy, intracisternally delivered' },
      { companyName: 'Forge Biologics', assetName: 'FBX-101', modality: 'geneTherapy', phase: 'phase1', indication: 'Krabbe disease', differentiator: 'IV AAV gene therapy combined with HSCT' },
    ],
    marketDynamics: 'Ultra-rare lysosomal storage disease with no approved disease-modifying therapy. HSCT is the only intervention that may slow progression if given pre-symptomatically.',
  },
  lewyBody: {
    density: 'low',
    keyAssets: [
      { companyName: 'Eisai/Biogen', assetName: 'Lecanemab', modality: 'mab', phase: 'phase3', indication: 'Lewy body dementia', differentiator: 'Anti-amyloid mAb being evaluated in DLB' },
      { companyName: 'Acadia Pharmaceuticals', assetName: 'Nuplazid (pimavanserin)', modality: 'smallMolecule', phase: 'approved', indication: 'PD psychosis (DLB off-label)', differentiator: '5-HT2A inverse agonist, used off-label in DLB psychosis' },
    ],
    marketDynamics: 'No therapies specifically approved for DLB. Management relies on off-label use of AD and PD medications. Alpha-synuclein targeting represents the most mechanistically relevant approach.',
  },
  lgmd: {
    density: 'low',
    keyAssets: [
      { companyName: 'Sarepta Therapeutics', assetName: 'SRP-9003', modality: 'geneTherapy', phase: 'phase2', indication: 'LGMD2E', differentiator: 'AAVrh74-delivered gene replacement for LGMD2E' },
      { companyName: 'ML Bio Solutions', assetName: 'ML-SA1', modality: 'smallMolecule', phase: 'phase2', indication: 'LGMD broad', differentiator: 'TRPML1 agonist to enhance autophagy and muscle repair' },
    ],
    marketDynamics: 'Highly fragmented disease with >30 genetic subtypes. No approved therapies exist. Small patient populations per subtype create challenging commercial models.',
  },
  lipodystrophy: {
    density: 'very_low',
    keyAssets: [
      { companyName: 'Amryt/Chiesi', assetName: 'Myalept (metreleptin)', modality: 'peptide', phase: 'approved', indication: 'Generalized lipodystrophy', differentiator: 'Only approved leptin analog for metabolic complications' },
    ],
    marketDynamics: 'Ultra-rare condition with metreleptin as the only approved therapy. Partial lipodystrophy remains largely untreated.',
  },
  lung_sclc: {
    density: 'high',
    keyAssets: [
      { companyName: 'Roche', assetName: 'Tecentriq (atezolizumab)', modality: 'mab', phase: 'approved', indication: 'ES-SCLC', differentiator: 'PD-L1 inhibitor + chemo in first-line ES-SCLC' },
      { companyName: 'AstraZeneca', assetName: 'Imfinzi (durvalumab)', modality: 'mab', phase: 'approved', indication: 'ES-SCLC', differentiator: 'PD-L1 inhibitor + chemo in first-line (CASPIAN)' },
      { companyName: 'AbbVie', assetName: 'Tarlatamab', modality: 'bispecific', phase: 'approved', indication: 'SCLC', differentiator: 'DLL3xCD3 bispecific T-cell engager' },
    ],
    marketDynamics: 'IO + chemotherapy is standard first-line but benefits are modest. DLL3-targeting bispecifics represent a breakthrough in relapsed setting. ADCs targeting B7-H3 and TROP2 are generating pipeline activity.',
  },
  mantleCell: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'Eli Lilly', assetName: 'Jaypirca (pirtobrutinib)', modality: 'smallMolecule', phase: 'approved', indication: 'R/R MCL', differentiator: 'Non-covalent BTK inhibitor effective after covalent BTKi failure' },
      { companyName: 'Kite/Gilead', assetName: 'Tecartus (brexucabtagene autoleucel)', modality: 'cellTherapy', phase: 'approved', indication: 'R/R MCL', differentiator: 'Anti-CD19 CAR-T approved for relapsed MCL' },
      { companyName: 'AstraZeneca', assetName: 'Calquence (acalabrutinib)', modality: 'smallMolecule', phase: 'approved', indication: 'MCL', differentiator: 'Second-gen BTK inhibitor with improved selectivity' },
    ],
    marketDynamics: 'BTK inhibitors are backbone therapy. Pirtobrutinib addresses covalent BTKi-resistant niche. CAR-T provides potential cure in heavily pretreated patients.',
  },
  marginalZone: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'BeiGene', assetName: 'Brukinsa (zanubrutinib)', modality: 'smallMolecule', phase: 'approved', indication: 'MZL', differentiator: 'Highly selective BTK inhibitor with strong MZL data' },
      { companyName: 'AstraZeneca', assetName: 'Calquence (acalabrutinib)', modality: 'smallMolecule', phase: 'approved', indication: 'MZL', differentiator: 'BTK inhibitor with MZL-specific approval' },
    ],
    marketDynamics: 'BTK inhibitors have largely displaced chemoimmunotherapy in relapsed MZL. Rituximab-based regimens remain first-line standard.',
  },
  mds: {
    density: 'high',
    keyAssets: [
      { companyName: 'Bristol-Myers Squibb', assetName: 'Reblozyl (luspatercept)', modality: 'peptide', phase: 'approved', indication: 'Lower-risk MDS anemia', differentiator: 'Erythroid maturation agent, first-line for LR-MDS anemia' },
      { companyName: 'Geron', assetName: 'Imetelstat', modality: 'aso', phase: 'approved', indication: 'Lower-risk MDS', differentiator: 'Telomerase inhibitor for transfusion-dependent LR-MDS' },
      { companyName: 'Otsuka/Astex', assetName: 'Inqovi (decitabine/cedazuridine)', modality: 'smallMolecule', phase: 'approved', indication: 'MDS', differentiator: 'Oral hypomethylating agent' },
    ],
    marketDynamics: 'Hypomethylating agents remain standard for higher-risk MDS. Luspatercept and imetelstat are transforming lower-risk MDS anemia management. TP53-mutant MDS remains a major unmet need.',
  },
  membranousNephropathy: {
    density: 'low',
    keyAssets: [
      { companyName: 'Roche', assetName: 'Rituxan (rituximab)', modality: 'mab', phase: 'approved', indication: 'MN (off-label standard)', differentiator: 'Anti-CD20 mAb, de facto standard based on MENTOR trial' },
      { companyName: 'Chinook/Novartis', assetName: 'Atrasentan', modality: 'smallMolecule', phase: 'phase3', indication: 'Proteinuric kidney diseases', differentiator: 'Endothelin A receptor antagonist' },
    ],
    marketDynamics: 'Rituximab has become preferred first-line immunosuppressive despite lacking formal approval for MN. Complement inhibitors represent the next wave.',
  },
  menstrualDisorders: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'AbbVie', assetName: 'Myfembree (relugolix/E2/NETA)', modality: 'smallMolecule', phase: 'approved', indication: 'Uterine fibroids/HMB', differentiator: 'Oral GnRH antagonist combo with hormonal add-back' },
      { companyName: 'AbbVie', assetName: 'Orilissa (elagolix)', modality: 'smallMolecule', phase: 'approved', indication: 'Endometriosis/HMB', differentiator: 'First oral GnRH antagonist for endometriosis-related pain' },
    ],
    marketDynamics: 'Oral GnRH antagonists with hormonal add-back have replaced injectable GnRH agonists. Heavy menstrual bleeding from fibroids is the largest addressable segment.',
  },
  merkelCell: {
    density: 'low',
    keyAssets: [
      { companyName: 'EMD Serono/Pfizer', assetName: 'Bavencio (avelumab)', modality: 'mab', phase: 'approved', indication: 'Merkel cell carcinoma', differentiator: 'First FDA-approved therapy specifically for metastatic MCC' },
      { companyName: 'Merck', assetName: 'Keytruda (pembrolizumab)', modality: 'mab', phase: 'approved', indication: 'Merkel cell carcinoma', differentiator: 'PD-1 inhibitor for recurrent MCC' },
    ],
    marketDynamics: 'Checkpoint inhibitors have transformed MCC outcomes with durable responses in virus-positive disease. Rare incidence limits commercial opportunity.',
  },
  mesothelioma: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'Bristol-Myers Squibb', assetName: 'Opdivo + Yervoy', modality: 'mab', phase: 'approved', indication: 'Mesothelioma', differentiator: 'Dual IO combo approved as first-line (CheckMate 743)' },
      { companyName: 'Eli Lilly', assetName: 'Alimta (pemetrexed) + cisplatin', modality: 'smallMolecule', phase: 'approved', indication: 'Mesothelioma', differentiator: 'Historic chemotherapy standard' },
    ],
    marketDynamics: 'Nivo/ipi dual checkpoint blockade is now first-line standard for non-epithelioid mesothelioma. Pemetrexed/platinum remains preferred for epithelioid histology.',
  },
  // --- Batch 5: metabolicSyndrome through stargardt ---
  metabolicSyndrome: {
    density: 'high',
    keyAssets: [
      { companyName: 'Novo Nordisk', assetName: 'Semaglutide', modality: 'peptide', phase: 'approved', indication: 'Metabolic Syndrome', differentiator: 'GLP-1 agonist with cardiovascular and weight benefits' },
      { companyName: 'Eli Lilly', assetName: 'Tirzepatide', modality: 'peptide', phase: 'approved', indication: 'Metabolic Syndrome', differentiator: 'Dual GIP/GLP-1 agonist with superior weight loss' },
      { companyName: 'Amgen', assetName: 'MariTide', modality: 'mab', phase: 'phase2', indication: 'Metabolic Syndrome', differentiator: 'Anti-GIP receptor antibody-GLP-1 peptide conjugate' },
    ],
    marketDynamics: 'GLP-1 receptor agonists have transformed metabolic syndrome management. Competition centers on dual and triple incretin combinations. Cardiovascular outcome benefits increasingly required.',
  },
  mitochondrialDisease: {
    density: 'low',
    keyAssets: [
      { companyName: 'Stealth BioTherapeutics', assetName: 'Elamipretide', modality: 'peptide', phase: 'phase3', indication: 'Barth syndrome', differentiator: 'Cardiolipin-targeting peptide' },
      { companyName: 'Minovia Therapeutics', assetName: 'MNV-201', modality: 'cellTherapy', phase: 'phase2', indication: 'Mitochondrial Disease', differentiator: 'Mitochondrial augmentation therapy using donor-derived cells' },
    ],
    marketDynamics: 'Highly fragmented disease space with limited approved therapies. Most programs target specific subtypes. Gene therapy approaches face delivery challenges.',
  },
  mpn: {
    density: 'high',
    keyAssets: [
      { companyName: 'Novartis', assetName: 'Ruxolitinib', modality: 'smallMolecule', phase: 'approved', indication: 'Myeloproliferative Neoplasms', differentiator: 'First-in-class JAK1/2 inhibitor, standard of care' },
      { companyName: 'GSK', assetName: 'Momelotinib', modality: 'smallMolecule', phase: 'approved', indication: 'Myelofibrosis', differentiator: 'JAK1/2 inhibitor with ACVR1 activity addressing anemia' },
      { companyName: 'MorphoSys/Incyte', assetName: 'Pelabresib', modality: 'smallMolecule', phase: 'phase3', indication: 'Myelofibrosis', differentiator: 'BET inhibitor in combination with ruxolitinib' },
    ],
    marketDynamics: 'JAK inhibitors dominate but disease modification remains unmet. Combination strategies with BET inhibitors are the leading next-gen approach.',
  },
  mpsDisorders: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'BioMarin', assetName: 'Vimizim', modality: 'peptide', phase: 'approved', indication: 'MPS IVA', differentiator: 'Enzyme replacement therapy for Morquio A syndrome' },
      { companyName: 'Sanofi', assetName: 'Aldurazyme', modality: 'peptide', phase: 'approved', indication: 'MPS I', differentiator: 'ERT for attenuated MPS I' },
      { companyName: 'Denali Therapeutics', assetName: 'DNL310', modality: 'mab', phase: 'phase2', indication: 'MPS II', differentiator: 'Transferrin receptor-targeted ERT for CNS penetration' },
    ],
    marketDynamics: 'ERTs are established but limited by inability to cross the BBB. Gene therapy and brain-penetrant approaches represent the next frontier. Each MPS subtype is a distinct micro-market.',
  },
  multipleSclerosisMod: {
    density: 'high',
    keyAssets: [
      { companyName: 'Roche', assetName: 'Ocrevus', modality: 'mab', phase: 'approved', indication: 'Progressive MS', differentiator: 'Anti-CD20 antibody, first approved for primary progressive MS' },
      { companyName: 'Novartis', assetName: 'Siponimod', modality: 'smallMolecule', phase: 'approved', indication: 'Active secondary progressive MS', differentiator: 'S1P modulator approved for active SPMS' },
    ],
    marketDynamics: 'Relapsing MS is well-served but progressive forms remain a major unmet need. B-cell depletion is the dominant mechanism. Remyelination strategies are in early development.',
  },
  myopiaProgression: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'Vyluma', assetName: 'NVK002 (Atropine 0.01%)', modality: 'smallMolecule', phase: 'phase3', indication: 'Myopia Progression', differentiator: 'Low-dose atropine eye drops for myopia control in children' },
      { companyName: 'CooperVision', assetName: 'MiSight', modality: 'smallMolecule', phase: 'approved', indication: 'Myopia Progression', differentiator: 'First FDA-approved soft contact lens for myopia control' },
    ],
    marketDynamics: 'Myopia epidemic driving intense interest globally. Low-dose atropine is the most studied pharmacologic intervention. Optical devices and pharmacologic approaches are converging.',
  },
  myotonicDystrophy: {
    density: 'low',
    keyAssets: [
      { companyName: 'Avidity Biosciences', assetName: 'AOC 1001', modality: 'rnai', phase: 'phase2', indication: 'Myotonic Dystrophy Type 1', differentiator: 'Antibody-oligonucleotide conjugate targeting DMPK mRNA' },
      { companyName: 'Dyne Therapeutics', assetName: 'DYNE-101', modality: 'aso', phase: 'phase2', indication: 'Myotonic Dystrophy Type 1', differentiator: 'FORCE platform delivering antisense oligonucleotide to muscle' },
    ],
    marketDynamics: 'No approved disease-modifying therapies exist. RNA-targeting approaches dominate. Avidity and Dyne are in a head-to-head race.',
  },
  narcolepsy: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'Jazz Pharmaceuticals', assetName: 'Xywav', modality: 'smallMolecule', phase: 'approved', indication: 'Narcolepsy', differentiator: 'Low-sodium oxybate for cataplexy and excessive daytime sleepiness' },
      { companyName: 'Alkermes', assetName: 'ALKS 2680', modality: 'smallMolecule', phase: 'phase3', indication: 'Narcolepsy', differentiator: 'Oral orexin receptor 2 agonist with once-daily dosing' },
    ],
    marketDynamics: 'Sodium oxybate has been standard of care but orexin receptor agonists represent a paradigm shift by addressing root cause orexin deficiency.',
  },
  nasopharyngeal: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'Junshi Biosciences', assetName: 'Toripalimab', modality: 'mab', phase: 'approved', indication: 'Nasopharyngeal Carcinoma', differentiator: 'First FDA-approved anti-PD-1 for recurrent/metastatic NPC' },
      { companyName: 'Atara Biotherapeutics', assetName: 'Tabelecleucel', modality: 'cellTherapy', phase: 'phase3', indication: 'NPC', differentiator: 'Allogeneic EBV-targeted T-cell therapy' },
    ],
    marketDynamics: 'Checkpoint inhibitors combined with chemotherapy are transforming front-line treatment. EBV-directed therapies offer a unique targeting strategy given viral etiology.',
  },
  nephroticSyndrome: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'Travere Therapeutics', assetName: 'Sparsentan', modality: 'smallMolecule', phase: 'approved', indication: 'IgA Nephropathy', differentiator: 'Dual endothelin/angiotensin receptor antagonist' },
      { companyName: 'Novartis', assetName: 'Iptacopan', modality: 'smallMolecule', phase: 'phase3', indication: 'Complement-mediated kidney disease', differentiator: 'Oral factor B inhibitor' },
    ],
    marketDynamics: 'Standard of care relies on immunosuppression with significant side effects. Complement inhibition and endothelin antagonism represent new mechanistic approaches.',
  },
  neuroblastoma: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'United Therapeutics', assetName: 'Unituxin (Dinutuximab)', modality: 'mab', phase: 'approved', indication: 'High-risk neuroblastoma', differentiator: 'Anti-GD2 antibody approved for maintenance' },
      { companyName: 'YMABS Therapeutics', assetName: 'Danyelza (Naxitamab)', modality: 'mab', phase: 'approved', indication: 'Relapsed neuroblastoma', differentiator: 'Humanized anti-GD2 antibody' },
    ],
    marketDynamics: 'Anti-GD2 antibodies are backbone of high-risk maintenance therapy. Radiopharmaceutical and immunotherapy combinations are expanding options.',
  },
  neuroendocrine: {
    density: 'high',
    keyAssets: [
      { companyName: 'Novartis', assetName: 'Lutathera', modality: 'radiopharmaceutical', phase: 'approved', indication: 'Neuroendocrine Tumors', differentiator: '177Lu-DOTATATE peptide receptor radionuclide therapy' },
      { companyName: 'Ipsen', assetName: 'Somatuline (Lanreotide)', modality: 'peptide', phase: 'approved', indication: 'NET', differentiator: 'Somatostatin analog for tumor growth control' },
      { companyName: 'Novartis', assetName: 'Sandostatin LAR', modality: 'peptide', phase: 'approved', indication: 'NET', differentiator: 'Long-acting somatostatin analog standard of care' },
    ],
    marketDynamics: 'Somatostatin analogs remain first-line but PRRT has become transformative for SSTR-positive tumors. Radiopharmaceutical sequencing is an active area.',
  },
  neurofibromatosis: {
    density: 'low',
    keyAssets: [
      { companyName: 'AstraZeneca', assetName: 'Selumetinib (Koselugo)', modality: 'smallMolecule', phase: 'approved', indication: 'NF1 plexiform neurofibromas', differentiator: 'MEK1/2 inhibitor, first targeted therapy for NF1' },
      { companyName: 'SpringWorks Therapeutics', assetName: 'Mirdametinib', modality: 'smallMolecule', phase: 'phase3', indication: 'NF1', differentiator: 'MEK inhibitor with potential improved tolerability' },
    ],
    marketDynamics: 'Selumetinib was a breakthrough. MEK inhibitor class dominates but tolerability limits use. NF2 remains without approved therapies.',
  },
  ocd: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'Biohaven/Pfizer', assetName: 'Troriluzole', modality: 'smallMolecule', phase: 'phase3', indication: 'OCD', differentiator: 'Glutamate modulator prodrug for treatment-resistant OCD' },
      { companyName: 'Neumora Therapeutics', assetName: 'Navacaprant', modality: 'smallMolecule', phase: 'phase2', indication: 'OCD', differentiator: 'Kappa opioid receptor antagonist' },
    ],
    marketDynamics: 'SSRIs remain first-line but 40-60% are treatment-resistant. Glutamate modulation and novel receptor targets are the most promising approaches.',
  },
  opticNeuritis: {
    density: 'low',
    keyAssets: [
      { companyName: 'Roche', assetName: 'Satralizumab (Enspryng)', modality: 'mab', phase: 'approved', indication: 'NMOSD/Optic Neuritis', differentiator: 'Anti-IL-6R for NMOSD spectrum including optic neuritis' },
      { companyName: 'Alexion/AstraZeneca', assetName: 'Eculizumab (Soliris)', modality: 'mab', phase: 'approved', indication: 'NMOSD', differentiator: 'Anti-C5 complement inhibitor for AQP4-positive NMOSD' },
    ],
    marketDynamics: 'Acute optic neuritis treated with corticosteroids but no approved therapies prevent long-term visual loss. Remyelination agents are a high-value emerging approach.',
  },
  organTransplant: {
    density: 'high',
    keyAssets: [
      { companyName: 'Eledon Pharmaceuticals', assetName: 'Tegoprubart', modality: 'mab', phase: 'phase2', indication: 'Organ Transplant', differentiator: 'Anti-CD40L antibody enabling calcineurin inhibitor-free regimens' },
      { companyName: 'Talaris Therapeutics', assetName: 'FCR001', modality: 'cellTherapy', phase: 'phase3', indication: 'Organ Transplant', differentiator: 'Donor-derived regulatory cell therapy for tolerance' },
    ],
    marketDynamics: 'Calcineurin inhibitor-based regimens remain standard despite nephrotoxicity. Tolerance induction and CNI-free protocols are the holy grail.',
  },
  osteosarcoma: {
    density: 'low',
    keyAssets: [
      { companyName: 'Inhibrx', assetName: 'Ozuriftamab Vedotin', modality: 'adc', phase: 'phase2', indication: 'Osteosarcoma', differentiator: 'Anti-B7-H3 ADC for relapsed/refractory osteosarcoma' },
    ],
    marketDynamics: 'Standard of care has not changed in three decades. MAP chemotherapy remains backbone. ADCs and cellular therapies are new hopes.',
  },
  ovarianCancerScreening: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'AstraZeneca', assetName: 'Olaparib (Lynparza)', modality: 'smallMolecule', phase: 'approved', indication: 'BRCA-mutated ovarian cancer', differentiator: 'PARP inhibitor as maintenance therapy' },
      { companyName: 'Genentech', assetName: 'Mirvetuximab Soravtansine', modality: 'adc', phase: 'approved', indication: 'Platinum-resistant ovarian cancer', differentiator: 'FRa-targeting ADC' },
    ],
    marketDynamics: 'PARP inhibitors have transformed maintenance therapy but screening for early detection remains a critical gap. Multi-cancer early detection tests are emerging.',
  },
  pbc: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'Intercept Pharmaceuticals', assetName: 'Ocaliva', modality: 'smallMolecule', phase: 'approved', indication: 'PBC', differentiator: 'FXR agonist approved as second-line to ursodiol' },
      { companyName: 'Ipsen', assetName: 'Elafibranor', modality: 'smallMolecule', phase: 'approved', indication: 'PBC', differentiator: 'PPAR alpha/delta agonist' },
      { companyName: 'Gilead', assetName: 'Seladelpar', modality: 'smallMolecule', phase: 'approved', indication: 'PBC', differentiator: 'Selective PPAR-delta agonist with favorable tolerability' },
    ],
    marketDynamics: 'UDCA remains first-line but 30-40% have inadequate response. PPAR agonists have recently expanded the second-line landscape. Competition intensifying among FXR and PPAR mechanisms.',
  },
  pemphigus: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'Roche', assetName: 'Rituximab', modality: 'mab', phase: 'approved', indication: 'Pemphigus vulgaris', differentiator: 'Anti-CD20; now first-line for moderate-severe PV' },
      { companyName: 'argenx', assetName: 'Efgartigimod (Vyvgart)', modality: 'mab', phase: 'phase3', indication: 'Pemphigus', differentiator: 'FcRn antagonist reducing pathogenic IgG' },
      { companyName: 'Cabaletta Bio', assetName: 'CABA-201', modality: 'cellTherapy', phase: 'phase2', indication: 'Pemphigus', differentiator: 'Anti-DSG3 CAR-T targeting desmoglein 3-specific B cells' },
    ],
    marketDynamics: 'Rituximab has become standard of care, displacing corticosteroids. FcRn antagonists and CAR-T for autoimmune indications are transformative emerging approaches.',
  },
  smallBowel: {
    density: 'very_low',
    keyAssets: [
      { companyName: 'Merck', assetName: 'Pembrolizumab', modality: 'mab', phase: 'approved', indication: 'MSI-H tumors', differentiator: 'Anti-PD-1 approved for MSI-H/dMMR solid tumors including small bowel' },
    ],
    marketDynamics: 'Extremely rare cancer with no specifically approved therapies. Treatment extrapolated from colorectal cancer protocols.',
  },
  spinalCordInjury: {
    density: 'low',
    keyAssets: [
      { companyName: 'Lineage Cell Therapeutics', assetName: 'OPC1', modality: 'cellTherapy', phase: 'phase2', indication: 'Spinal Cord Injury', differentiator: 'Oligodendrocyte progenitor cells for subacute thoracic SCI' },
      { companyName: 'InVivo Therapeutics', assetName: 'Neuro-Spinal Scaffold', modality: 'smallMolecule', phase: 'phase2', indication: 'Spinal Cord Injury', differentiator: 'Bioresorbable polymer scaffold to support regeneration' },
    ],
    marketDynamics: 'No approved therapies to restore neurological function. Cell-based therapies and scaffolds are the most advanced regenerative approaches.',
  },
  stargardt: {
    density: 'low',
    keyAssets: [
      { companyName: 'Alkeus Pharmaceuticals', assetName: 'Gildeuretinol (ALK-001)', modality: 'smallMolecule', phase: 'phase3', indication: 'Stargardt Disease', differentiator: 'Deuterated vitamin A analog reducing toxic bisretinoid accumulation' },
      { companyName: 'Kubota Vision', assetName: 'Emixustat', modality: 'smallMolecule', phase: 'phase3', indication: 'Stargardt Disease', differentiator: 'Visual cycle modulator reducing A2E and lipofuscin' },
    ],
    marketDynamics: 'No approved therapies exist. Visual cycle modulators are most advanced. Gene therapy faces the challenge of ABCA4 gene size exceeding AAV capacity.',
  },
  // --- Batch 6: stiffPerson through wilsonDisease ---
  stiffPerson: {
    density: 'low',
    keyAssets: [
      { companyName: 'argenx', assetName: 'Vyvgart', modality: 'mab', phase: 'phase3', indication: 'Stiff Person Syndrome', differentiator: 'FcRn blocker; expanding autoimmune portfolio' },
      { companyName: 'Johnson & Johnson', assetName: 'Rituximab biosimilar', modality: 'mab', phase: 'approved', indication: 'Stiff Person Syndrome', differentiator: 'Off-label B-cell depletion' },
    ],
    marketDynamics: 'Ultra-rare autoimmune condition with no FDA-approved therapies. Treatment relies on off-label IVIg, rituximab, and immunosuppressants. FcRn inhibitors represent first mechanism-based approaches.',
  },
  systemicJIA: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'Novartis', assetName: 'Ilaris', modality: 'mab', phase: 'approved', indication: 'Systemic JIA', differentiator: 'Anti-IL-1beta; first biologic approved specifically for sJIA' },
      { companyName: 'Roche', assetName: 'Actemra', modality: 'mab', phase: 'approved', indication: 'Systemic JIA', differentiator: 'Anti-IL-6R; extensive pediatric data and market share leader' },
      { companyName: 'Sobi', assetName: 'Kineret', modality: 'peptide', phase: 'approved', indication: 'Systemic JIA', differentiator: 'IL-1Ra; used first-line in MAS complications' },
    ],
    marketDynamics: 'IL-1 and IL-6 blockade are established standards of care. Unmet need centers on steroid-sparing regimens and treatment of macrophage activation syndrome.',
  },
  systemicMastocytosis: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'Blueprint Medicines', assetName: 'Ayvakit', modality: 'smallMolecule', phase: 'approved', indication: 'Systemic Mastocytosis', differentiator: 'Selective KIT D816V inhibitor; first approved targeted therapy for advanced SM' },
      { companyName: 'Cogent Biosciences', assetName: 'Bezuclastinib', modality: 'smallMolecule', phase: 'phase3', indication: 'Systemic Mastocytosis', differentiator: 'Highly selective KIT D816V inhibitor; improved tolerability' },
    ],
    marketDynamics: 'Selective KIT D816V inhibitors have transformed treatment. Competition is between avapritinib and bezuclastinib on tolerability. Indolent SM is a large expansion opportunity.',
  },
  systemicSclerosis: {
    density: 'high',
    keyAssets: [
      { companyName: 'Boehringer Ingelheim', assetName: 'Ofev', modality: 'smallMolecule', phase: 'approved', indication: 'SSc-ILD', differentiator: 'Triple kinase inhibitor; first approved for SSc-ILD' },
      { companyName: 'Roche', assetName: 'Actemra', modality: 'mab', phase: 'approved', indication: 'Systemic Sclerosis', differentiator: 'IL-6R blockade; approved for SSc-ILD' },
      { companyName: 'Janssen', assetName: 'Nipocalimab', modality: 'mab', phase: 'phase3', indication: 'Systemic Sclerosis', differentiator: 'Anti-FcRn antibody' },
    ],
    marketDynamics: 'Antifibrotic and anti-inflammatory approaches coexist. Nintedanib and tocilizumab address ILD component. CAR-T and B-cell depletion strategies generating excitement for disease modification.',
  },
  tCellLymphoma: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'Seagen/Pfizer', assetName: 'Adcetris', modality: 'adc', phase: 'approved', indication: 'T-Cell Lymphoma', differentiator: 'Anti-CD30 ADC; backbone in ALCL and frontline PTCL' },
      { companyName: 'Citius Pharmaceuticals', assetName: 'E7777 (denileukin diftitox)', modality: 'peptide', phase: 'approved', indication: 'CTCL', differentiator: 'IL-2 fusion toxin for CTCL' },
    ],
    marketDynamics: 'Heterogeneous disease subtypes fragment the market. Brentuximab vedotin is standard for CD30+ subtypes. High unmet need persists in relapsed PTCL.',
  },
  tbi: {
    density: 'very_low',
    keyAssets: [
      { companyName: 'Vasomune', assetName: 'AV-001', modality: 'peptide', phase: 'phase2', indication: 'Traumatic Brain Injury', differentiator: 'Tie2 activator reducing vascular leak and neuroinflammation' },
      { companyName: 'Athira Pharma', assetName: 'Fosgonimeton', modality: 'smallMolecule', phase: 'phase2', indication: 'TBI', differentiator: 'HGF/MET neurotrophic activator' },
    ],
    marketDynamics: 'No FDA-approved neuroprotective therapy exists despite decades of failed trials. Current care is supportive. Biomarker-guided enrollment is emerging.',
  },
  testicular: {
    density: 'low',
    keyAssets: [
      { companyName: 'Various generics', assetName: 'BEP (Cisplatin/Etoposide/Bleomycin)', modality: 'smallMolecule', phase: 'approved', indication: 'Testicular Cancer', differentiator: 'Curative platinum-based regimen; >95% cure rate' },
      { companyName: 'Bristol-Myers Squibb', assetName: 'Opdivo', modality: 'mab', phase: 'phase2', indication: 'Testicular Cancer', differentiator: 'Anti-PD-1; explored in platinum-refractory germ cell tumors' },
    ],
    marketDynamics: 'Platinum-based chemotherapy is highly curative, leaving minimal commercial incentive. Unmet need is narrow: platinum-refractory disease.',
  },
  thymoma: {
    density: 'very_low',
    keyAssets: [
      { companyName: 'Sanofi/Regeneron', assetName: 'Libtayo', modality: 'mab', phase: 'phase2', indication: 'Thymic Carcinoma', differentiator: 'Anti-PD-1; emerging option post-chemo' },
      { companyName: 'Pfizer', assetName: 'Sunitinib', modality: 'smallMolecule', phase: 'phase2', indication: 'Thymic Carcinoma', differentiator: 'Multi-kinase TKI; off-label use' },
    ],
    marketDynamics: 'Ultra-rare thoracic malignancy with no approved targeted therapies. Surgery and platinum chemo are mainstays. IO shows promise in thymic carcinoma but carries autoimmune risk in thymoma.',
  },
  thyroid: {
    density: 'high',
    keyAssets: [
      { companyName: 'Eisai', assetName: 'Lenvima', modality: 'smallMolecule', phase: 'approved', indication: 'Thyroid Cancer', differentiator: 'VEGFR/FGFR/RET inhibitor; dominant market share in DTC' },
      { companyName: 'Eli Lilly', assetName: 'Retevmo', modality: 'smallMolecule', phase: 'approved', indication: 'RET-mutant/fusion thyroid cancer', differentiator: 'Selective RET inhibitor' },
      { companyName: 'Blueprint/Roche', assetName: 'Gavreto', modality: 'smallMolecule', phase: 'approved', indication: 'RET-fusion thyroid cancer', differentiator: 'Selective RET inhibitor' },
    ],
    marketDynamics: 'Multi-kinase and selective RET inhibitors have transformed advanced thyroid cancer. Biomarker-driven therapy (RET, NTRK, BRAF) is standard.',
  },
  thyroidEye: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'Horizon/Amgen', assetName: 'Tepezza', modality: 'mab', phase: 'approved', indication: 'Thyroid Eye Disease', differentiator: 'Anti-IGF-1R; first and only approved therapy for TED; blockbuster' },
      { companyName: 'Immunovant', assetName: 'Batoclimab', modality: 'mab', phase: 'phase3', indication: 'TED', differentiator: 'Anti-FcRn; subcutaneous alternative' },
      { companyName: 'Viridian Therapeutics', assetName: 'Veligrotug', modality: 'mab', phase: 'phase3', indication: 'TED', differentiator: 'Anti-IGF-1R; designed to challenge Tepezza with improved convenience' },
    ],
    marketDynamics: 'Tepezza created a $2B+ market as the first disease-modifying therapy. Competitors pursuing anti-IGF-1R and FcRn inhibition with improved dosing.',
  },
  tremor: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'Praxis Precision Medicine', assetName: 'Ulixacaltamide (PRAX-944)', modality: 'smallMolecule', phase: 'phase2', indication: 'Essential Tremor', differentiator: 'T-type calcium channel blocker; first-in-class for ET' },
      { companyName: 'Insightec', assetName: 'Exablate Neuro', modality: 'smallMolecule', phase: 'approved', indication: 'Essential Tremor', differentiator: 'MRI-guided focused ultrasound thalamotomy; FDA-approved device' },
    ],
    marketDynamics: 'Propranolol and primidone remain decades-old first-line therapies. No new drug approved in 50+ years. Device-based approaches gaining traction while novel oral mechanisms are in development.',
  },
  ttpAutoimmune: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'Sanofi', assetName: 'Cablivi', modality: 'mab', phase: 'approved', indication: 'Acquired TTP', differentiator: 'Anti-vWF nanobody; first targeted therapy for aTTP' },
      { companyName: 'Takeda', assetName: 'TAK-755 (ADAMTS13)', modality: 'peptide', phase: 'phase3', indication: 'Autoimmune TTP', differentiator: 'Recombinant ADAMTS13 enzyme replacement; addresses root cause' },
    ],
    marketDynamics: 'Caplacizumab transformed acute aTTP management. Recombinant ADAMTS13 could be disease-modifying. Prevention of relapse is a key unmet need.',
  },
  tuberousSclerosis: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'Novartis', assetName: 'Afinitor', modality: 'smallMolecule', phase: 'approved', indication: 'TSC-associated SEGA and renal AML', differentiator: 'mTOR inhibitor; approved for multiple TSC manifestations' },
      { companyName: 'Jazz Pharmaceuticals', assetName: 'Epidiolex', modality: 'smallMolecule', phase: 'approved', indication: 'TSC-associated seizures', differentiator: 'CBD; approved for TSC seizures' },
    ],
    marketDynamics: 'mTOR inhibition with everolimus is standard across multiple manifestations. Seizure control remains a major challenge. Multisystem nature creates complex treatment paradigms.',
  },
  ureaCycleDisorders: {
    density: 'low',
    keyAssets: [
      { companyName: 'Horizon/Amgen', assetName: 'Ravicti', modality: 'smallMolecule', phase: 'approved', indication: 'Urea Cycle Disorders', differentiator: 'Glycerol phenylbutyrate; improved taste nitrogen scavenger' },
      { companyName: 'Ultragenyx', assetName: 'DTX401', modality: 'geneTherapy', phase: 'phase3', indication: 'OTC Deficiency', differentiator: 'AAV8 gene therapy; potentially curative' },
      { companyName: 'Arctus Therapeutics', assetName: 'ARCT-810', modality: 'mrna', phase: 'phase2', indication: 'OTC Deficiency', differentiator: 'mRNA therapy encoding OTC enzyme' },
    ],
    marketDynamics: 'Nitrogen scavengers are standard but do not address underlying enzyme deficiency. Gene therapy and mRNA therapeutics represent transformative approaches.',
  },
  uvealMelanoma: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'Immunocore', assetName: 'Kimmtrak', modality: 'bispecific', phase: 'approved', indication: 'Uveal Melanoma', differentiator: 'gp100xCD3 bispecific T-cell engager; first approved therapy demonstrating OS benefit' },
      { companyName: 'Ideaya Biosciences', assetName: 'Darovasertib', modality: 'smallMolecule', phase: 'phase3', indication: 'Uveal Melanoma', differentiator: 'PKC inhibitor for GNAQ/GNA11-mutant UM' },
    ],
    marketDynamics: 'Kimmtrak established first survival benefit in metastatic uveal melanoma. PKC and MAPK pathway inhibitors targeting driver mutations represent the next wave.',
  },
  uveiticMacular: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'AbbVie', assetName: 'Humira', modality: 'mab', phase: 'approved', indication: 'Non-infectious uveitis', differentiator: 'Anti-TNF; widely used for uveitis including macular edema' },
      { companyName: 'AbbVie/Allergan', assetName: 'Ozurdex', modality: 'smallMolecule', phase: 'approved', indication: 'Uveitic Macular Edema', differentiator: 'Intravitreal dexamethasone implant' },
    ],
    marketDynamics: 'Corticosteroid implants and anti-TNF biologics are mainstays. Anti-VEGF agents being investigated for the edema component. No purpose-built therapy exists for uveitic CME.',
  },
  uveitis: {
    density: 'high',
    keyAssets: [
      { companyName: 'AbbVie', assetName: 'Humira', modality: 'mab', phase: 'approved', indication: 'Non-Infectious Uveitis', differentiator: 'First biologic approved for non-infectious uveitis' },
      { companyName: 'AbbVie/Allergan', assetName: 'Ozurdex', modality: 'smallMolecule', phase: 'approved', indication: 'Posterior uveitis', differentiator: 'Intravitreal dexamethasone implant' },
    ],
    marketDynamics: 'Adalimumab dominates the biologic landscape. Biosimilar competition is driving down costs. Steroid-sparing approaches remain a priority.',
  },
  vaginalAtrophy: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'TherapeuticsMD/Mayne', assetName: 'Imvexxy', modality: 'smallMolecule', phase: 'approved', indication: 'Vaginal Atrophy', differentiator: 'Ultra-low-dose vaginal estradiol softgel insert' },
      { companyName: 'Endoceutics', assetName: 'Intrarosa', modality: 'smallMolecule', phase: 'approved', indication: 'Vaginal Atrophy', differentiator: 'Intravaginal DHEA (prasterone); non-estrogen approach' },
    ],
    marketDynamics: 'Market split between local estrogen therapies and non-hormonal alternatives. Breast cancer survivors represent a key population needing estrogen-free options.',
  },
  vitiligo: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'Incyte', assetName: 'Opzelura', modality: 'smallMolecule', phase: 'approved', indication: 'Vitiligo', differentiator: 'Topical ruxolitinib; first FDA-approved treatment for nonsegmental vitiligo' },
      { companyName: 'Incyte', assetName: 'Povorcitinib', modality: 'smallMolecule', phase: 'phase3', indication: 'Vitiligo', differentiator: 'Oral JAK1 inhibitor for extensive vitiligo' },
    ],
    marketDynamics: 'Opzelura created the first approved vitiligo treatment. Oral JAK inhibitors advancing for widespread disease. Repigmentation rates remain modest.',
  },
  vulvar: {
    density: 'low',
    keyAssets: [
      { companyName: 'Merck', assetName: 'Keytruda', modality: 'mab', phase: 'approved', indication: 'PD-L1+ gynecologic cancers', differentiator: 'Anti-PD-1; explored in HPV-associated vulvar cancer' },
      { companyName: 'Merck', assetName: 'Gardasil 9', modality: 'peptide', phase: 'approved', indication: 'Vulvar Cancer Prevention', differentiator: 'HPV vaccine; prevents HPV-driven vulvar neoplasia' },
    ],
    marketDynamics: 'Ultra-rare gynecologic malignancy with limited systemic options beyond platinum/taxane chemo. Prevention via HPV vaccination will reduce incidence.',
  },
  vulvodynia: {
    density: 'very_low',
    keyAssets: [
      { companyName: 'Pfizer', assetName: 'Lyrica', modality: 'smallMolecule', phase: 'approved', indication: 'Vulvodynia (off-label)', differentiator: 'Pregabalin; off-label use for neuropathic pain' },
    ],
    marketDynamics: 'No FDA-approved therapies exist. Management relies on off-label gabapentinoids, SNRIs, topical lidocaine, and pelvic floor PT. Extremely limited pharma pipeline activity.',
  },
  waldenstrom: {
    density: 'moderate',
    keyAssets: [
      { companyName: 'BeiGene', assetName: 'Brukinsa', modality: 'smallMolecule', phase: 'approved', indication: 'Waldenstrom\'s Macroglobulinemia', differentiator: 'Next-gen BTK inhibitor; improved tolerability vs ibrutinib' },
      { companyName: 'AbbVie', assetName: 'Imbruvica', modality: 'smallMolecule', phase: 'approved', indication: 'Waldenstrom\'s Macroglobulinemia', differentiator: 'First approved targeted therapy for WM' },
      { companyName: 'Eli Lilly/Loxo', assetName: 'Pirtobrutinib', modality: 'smallMolecule', phase: 'phase3', indication: 'WM', differentiator: 'Non-covalent BTK inhibitor; active after covalent BTKi failure' },
    ],
    marketDynamics: 'BTK inhibitors are standard of care with zanubrutinib displacing ibrutinib on tolerability. MYD88 and CXCR4 mutation status guides selection.',
  },
  wilsonDisease: {
    density: 'low',
    keyAssets: [
      { companyName: 'Alexion/AstraZeneca', assetName: 'Bis-choline tetrathiomolybdate', modality: 'smallMolecule', phase: 'phase3', indication: 'Wilson Disease', differentiator: 'Novel copper-protein binding agent; improved tolerability' },
      { companyName: 'Ultragenyx', assetName: 'UX701', modality: 'geneTherapy', phase: 'phase1', indication: 'Wilson Disease', differentiator: 'AAV gene therapy delivering functional ATP7B; potentially curative' },
      { companyName: 'Bausch Health', assetName: 'Syprine', modality: 'smallMolecule', phase: 'approved', indication: 'Wilson Disease', differentiator: 'Trientine chelation therapy' },
    ],
    marketDynamics: 'Copper chelators have been standard for decades with significant tolerability issues. Bis-choline tetrathiomolybdate and gene therapy represent the first innovation wave.',
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

  // Calculate phase-weighted trial threat score.
  // Later-phase competitors pose more imminent competitive threat.
  // Source: McKinsey pharma launch excellence — Phase 3 assets are 5x
  // more likely to reach market than Phase 1 assets within 3-5 years.
  const phaseWeights: Record<string, number> = {
    'Approved': 3.0, 'approved': 3.0,
    'Phase 4': 2.5, 'phase4': 2.5, 'phase_4': 2.5,
    'Phase 3': 2.0, 'phase3': 2.0, 'phase_3': 2.0,
    'Phase 2/3': 1.8, 'phase2_3': 1.8,
    'Phase 2': 1.0, 'phase2': 1.0, 'phase_2': 1.0,
    'Phase 1/2': 0.6, 'phase1_2': 0.6,
    'Phase 1': 0.3, 'phase1': 0.3, 'phase_1': 0.3,
    'Preclinical': 0.1, 'preclinical': 0.1,
  };
  let weightedTrialScore = 0;
  for (const [phase, count] of Object.entries(byPhase)) {
    const weight = phaseWeights[phase] ?? 0.5;
    weightedTrialScore += count * weight;
  }

  // Filter trials by modality relevance when specified.
  // Same-modality competitors are direct threats; different modalities are indirect.
  let modalityRelevanceBonus = 0;
  if (modality && trialCount > 0) {
    try {
      const { data: modalityTrials } = await supabase
        .from('company_trials')
        .select('modality')
        .in('status', ['recruiting', 'active_not_recruiting', 'not_yet_recruiting'])
        .or(`indication_specific.eq.${indication},indication_category.eq.${getIndicationCategory(indication, therapeuticArea)}`)
        .eq('modality', modality)
        .limit(100);
      if (modalityTrials && modalityTrials.length > 0) {
        // Same-modality competitors amplify competitive pressure
        const sameModalityFraction = modalityTrials.length / Math.max(1, trialCount);
        modalityRelevanceBonus = sameModalityFraction > 0.3 ? 5 : 0;
      }
    } catch {
      // Modality query failed; proceed without adjustment
    }
  }

  // Calculate competitive density score (0-100)
  let densityScore = 50; // default moderate
  if (curated) {
    const densityMap: Record<string, number> = {
      very_high: 85, high: 70, moderate: 50, low: 30, very_low: 15,
    };
    densityScore = densityMap[curated.density] || 50;
  }
  // Adjust by phase-weighted trial score using continuous log-linear scaling.
  // This replaces the sparse threshold bands that ignored 3-10 trial range.
  if (weightedTrialScore > 0) {
    // Log-linear: diminishing returns as trial count increases
    const trialImpact = Math.round(12 * Math.log2(Math.max(1, weightedTrialScore)) / Math.log2(50));
    densityScore = Math.min(95, densityScore + trialImpact + modalityRelevanceBonus);
  } else if (trialCount === 0) {
    densityScore = Math.max(10, densityScore - 15);
  }

  const keyCompetitors = curated?.keyAssets || [];
  const firstMoverAdvantage = densityScore < 40;

  // Market share erosion estimate
  const erosionMap: Record<string, number> = {
    very_high: 0.45, high: 0.30, moderate: 0.15, low: 0.08, very_low: 0.03,
  };
  // For curated indications, use the curated density but adjust for live phase-weighted data.
  // For uncurated, use log-scaled trial count (replaces raw 2% per trial linear scaling).
  const baseErosion = curated
    ? (erosionMap[curated.density] || 0.15)
    : Math.min(0.50, 0.05 + 0.10 * Math.log2(Math.max(1, weightedTrialScore)));
  const erosion = Math.min(0.55, baseErosion);

  // Expected next approval
  const upcomingApprovals = keyCompetitors
    .filter(a => a.expectedApprovalYear && a.expectedApprovalYear > new Date().getFullYear())
    .sort((a, b) => (a.expectedApprovalYear || 9999) - (b.expectedApprovalYear || 9999));
  const expectedNextApproval = upcomingApprovals[0]
    ? { company: upcomingApprovals[0].companyName, year: upcomingApprovals[0].expectedApprovalYear! }
    : undefined;

  // Generate narrative — curated narratives are expert-written; fallback includes phase context
  const densityLabel = densityScore > 70 ? 'high' : densityScore > 40 ? 'moderate' : 'low';
  const phaseDistribution = Object.entries(byPhase)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([phase, count]) => `${count} in ${phase}`)
    .join(', ');
  const nextApprovalNote = expectedNextApproval
    ? ` ${expectedNextApproval.company} has an expected approval in ${expectedNextApproval.year}.`
    : '';
  const narrative = curated?.marketDynamics ||
    `${trialCount} active clinical trials identified for this indication` +
    (phaseDistribution ? ` (${phaseDistribution})` : '') + `. ` +
    `Competitive density is ${densityLabel}, ` +
    `suggesting ${densityScore > 70 ? 'significant competitive pressure — differentiated clinical data will be essential for market access'
      : densityScore > 40 ? 'a manageable competitive environment with room for well-positioned entrants'
      : 'limited competition with potential first-mover advantage'}.` +
    nextApprovalNote;

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
