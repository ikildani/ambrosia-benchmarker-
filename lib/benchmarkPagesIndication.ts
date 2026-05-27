import {
  calculateDealTerms,
  formatCurrency,
  type CalculationInput,
  type Phase,
  type Modality,
  type Indication,
  type TherapeuticArea,
} from './calculations';
import type { BenchmarkPageData } from './benchmarkPages';

// ── Indication registry ─────────────────────────────────────────────────────
// Each entry maps an indication value to its display label, parent TA,
// default modality, and default phase for benchmarking.

interface IndicationDef {
  value: string;
  label: string;
  ta: TherapeuticArea;
  modality: Modality;
  phase: Phase;
}

const INDICATION_REGISTRY: IndicationDef[] = [
  // ── Oncology — Solid Tumors ──────────────────────────────────────────────
  { value: 'lung_nsclc', label: 'Lung Cancer (NSCLC)', ta: 'oncology', modality: 'smallMolecule', phase: 'phase2' },
  { value: 'lung_sclc', label: 'Lung Cancer (SCLC)', ta: 'oncology', modality: 'adc', phase: 'phase2' },
  { value: 'breast_her2', label: 'Breast Cancer (HER2+)', ta: 'oncology', modality: 'adc', phase: 'phase2' },
  { value: 'breast_tnbc', label: 'Breast Cancer (TNBC)', ta: 'oncology', modality: 'adc', phase: 'phase2' },
  { value: 'breast_hr', label: 'Breast Cancer (HR+)', ta: 'oncology', modality: 'smallMolecule', phase: 'phase2' },
  { value: 'colorectal', label: 'Colorectal Cancer', ta: 'oncology', modality: 'bispecific', phase: 'phase2' },
  { value: 'pancreatic', label: 'Pancreatic Cancer', ta: 'oncology', modality: 'smallMolecule', phase: 'phase2' },
  { value: 'melanoma', label: 'Melanoma', ta: 'oncology', modality: 'mab', phase: 'phase2' },
  { value: 'prostate', label: 'Prostate Cancer (mCRPC)', ta: 'oncology', modality: 'radiopharmaceutical', phase: 'phase2' },
  { value: 'ovarian', label: 'Ovarian Cancer', ta: 'oncology', modality: 'adc', phase: 'phase2' },
  { value: 'gastric', label: 'Gastric / GEJ Cancer', ta: 'oncology', modality: 'bispecific', phase: 'phase2' },
  { value: 'liver', label: 'Liver Cancer (HCC)', ta: 'oncology', modality: 'mab', phase: 'phase2' },
  { value: 'renal', label: 'Renal Cell Carcinoma (RCC)', ta: 'oncology', modality: 'mab', phase: 'phase2' },
  { value: 'gbm', label: 'Glioblastoma (GBM)', ta: 'oncology', modality: 'carT_solid', phase: 'phase1' },
  { value: 'bladder', label: 'Bladder Cancer', ta: 'oncology', modality: 'adc', phase: 'phase2' },
  { value: 'headNeck', label: 'Head & Neck Cancer', ta: 'oncology', modality: 'mab', phase: 'phase2' },
  { value: 'cholangiocarcinoma', label: 'Cholangiocarcinoma', ta: 'oncology', modality: 'smallMolecule', phase: 'phase2' },
  { value: 'mesothelioma', label: 'Mesothelioma', ta: 'oncology', modality: 'mab', phase: 'phase2' },
  { value: 'sarcoma', label: 'Sarcoma', ta: 'oncology', modality: 'smallMolecule', phase: 'phase2' },
  { value: 'endometrial', label: 'Endometrial Cancer', ta: 'oncology', modality: 'mab', phase: 'phase2' },
  { value: 'cervical', label: 'Cervical Cancer', ta: 'oncology', modality: 'adc', phase: 'phase2' },
  { value: 'thyroid', label: 'Thyroid Cancer', ta: 'oncology', modality: 'smallMolecule', phase: 'phase2' },
  { value: 'esophageal', label: 'Esophageal Cancer', ta: 'oncology', modality: 'mab', phase: 'phase2' },

  // ── Oncology — Additional Solid Tumors ─────────────────────────────────
  { value: 'neuroendocrine', label: 'Neuroendocrine Tumors (NET)', ta: 'oncology', modality: 'radiopharmaceutical', phase: 'phase2' },
  { value: 'uvealMelanoma', label: 'Uveal Melanoma', ta: 'oncology', modality: 'mab', phase: 'phase2' },
  { value: 'merkelCell', label: 'Merkel Cell Carcinoma', ta: 'oncology', modality: 'mab', phase: 'phase2' },
  { value: 'testicular', label: 'Testicular Cancer', ta: 'oncology', modality: 'smallMolecule', phase: 'phase2' },
  { value: 'nasopharyngeal', label: 'Nasopharyngeal Carcinoma', ta: 'oncology', modality: 'mab', phase: 'phase2' },

  // ── Oncology — Biomarker-Defined ─────────────────────────────────────────
  { value: 'krasMutant', label: 'KRAS-Mutant Tumors', ta: 'oncology', modality: 'smallMolecule', phase: 'phase2' },
  { value: 'her2Low', label: 'HER2-Low Tumors', ta: 'oncology', modality: 'adc', phase: 'phase2' },
  { value: 'msiHigh', label: 'MSI-High / dMMR Tumors', ta: 'oncology', modality: 'mab', phase: 'phase2' },

  // ── Oncology — Hematologic Malignancies ──────────────────────────────────
  { value: 'aml', label: 'Acute Myeloid Leukemia (AML)', ta: 'oncology', modality: 'bispecific', phase: 'phase2' },
  { value: 'all', label: 'Acute Lymphoblastic Leukemia (ALL)', ta: 'oncology', modality: 'carT_heme', phase: 'phase1' },
  { value: 'cll', label: 'Chronic Lymphocytic Leukemia (CLL)', ta: 'oncology', modality: 'smallMolecule', phase: 'phase2' },
  { value: 'myeloma', label: 'Multiple Myeloma', ta: 'oncology', modality: 'bispecific', phase: 'phase2' },
  { value: 'dlbcl', label: 'Diffuse Large B-Cell Lymphoma (DLBCL)', ta: 'oncology', modality: 'carT_heme', phase: 'phase1' },
  { value: 'follicular', label: 'Follicular Lymphoma', ta: 'oncology', modality: 'bispecific', phase: 'phase2' },
  { value: 'mantleCell', label: 'Mantle Cell Lymphoma', ta: 'oncology', modality: 'smallMolecule', phase: 'phase2' },
  { value: 'mds', label: 'Myelodysplastic Syndromes (MDS)', ta: 'oncology', modality: 'smallMolecule', phase: 'phase2' },
  { value: 'hodgkins', label: 'Hodgkin Lymphoma', ta: 'oncology', modality: 'adc', phase: 'phase2' },
  { value: 'mpn', label: 'Myeloproliferative Neoplasms (MPN)', ta: 'oncology', modality: 'smallMolecule', phase: 'phase2' },
  { value: 'tCellLymphoma', label: 'T-Cell Lymphoma', ta: 'oncology', modality: 'mab', phase: 'phase2' },

  // ── Neurology ────────────────────────────────────────────────────────────
  { value: 'alzheimers', label: "Alzheimer's Disease", ta: 'neurology', modality: 'mab', phase: 'phase2' },
  { value: 'parkinsons', label: "Parkinson's Disease", ta: 'neurology', modality: 'smallMolecule', phase: 'phase2' },
  { value: 'als', label: 'ALS (Amyotrophic Lateral Sclerosis)', ta: 'neurology', modality: 'aso', phase: 'phase2' },
  { value: 'huntingtons', label: "Huntington's Disease", ta: 'neurology', modality: 'aso', phase: 'phase1' },
  { value: 'ms', label: 'Multiple Sclerosis', ta: 'neurology', modality: 'smallMolecule', phase: 'phase2' },
  { value: 'epilepsy', label: 'Epilepsy', ta: 'neurology', modality: 'smallMolecule', phase: 'phase2' },
  { value: 'migraine', label: 'Migraine', ta: 'neurology', modality: 'mab', phase: 'phase2' },
  { value: 'schizophrenia', label: 'Schizophrenia', ta: 'neurology', modality: 'smallMolecule', phase: 'phase2' },
  { value: 'depression', label: 'Depression / MDD', ta: 'neurology', modality: 'smallMolecule', phase: 'phase2' },
  { value: 'pain', label: 'Chronic / Neuropathic Pain', ta: 'neurology', modality: 'smallMolecule', phase: 'phase2' },
  { value: 'narcolepsy', label: 'Narcolepsy', ta: 'neurology', modality: 'smallMolecule', phase: 'phase2' },
  { value: 'autism', label: 'Autism Spectrum Disorder', ta: 'neurology', modality: 'smallMolecule', phase: 'phase2' },
  { value: 'rett', label: 'Rett Syndrome', ta: 'neurology', modality: 'geneTherapy', phase: 'phase1' },
  { value: 'sma', label: 'Spinal Muscular Atrophy (SMA)', ta: 'neurology', modality: 'geneTherapy', phase: 'phase1' },
  { value: 'angelman', label: 'Angelman Syndrome', ta: 'neurology', modality: 'aso', phase: 'phase1' },
  { value: 'dravet', label: 'Dravet Syndrome', ta: 'neurology', modality: 'aso', phase: 'phase2' },
  { value: 'addiction', label: 'Addiction / Substance Use Disorders', ta: 'neurology', modality: 'smallMolecule', phase: 'phase2' },
  { value: 'bipolar', label: 'Bipolar Disorder', ta: 'neurology', modality: 'smallMolecule', phase: 'phase2' },
  { value: 'ptsd', label: 'PTSD', ta: 'neurology', modality: 'psychedelic', phase: 'phase2' },
  { value: 'ocd', label: 'OCD / Anxiety Disorders', ta: 'neurology', modality: 'smallMolecule', phase: 'phase2' },
  { value: 'tbi', label: 'Traumatic Brain Injury', ta: 'neurology', modality: 'smallMolecule', phase: 'phase2' },
  { value: 'dmd', label: 'Duchenne Muscular Dystrophy (Neuro)', ta: 'neurology', modality: 'geneTherapy', phase: 'phase1' },
  { value: 'friedreichs', label: "Friedreich's Ataxia", ta: 'neurology', modality: 'geneTherapy', phase: 'phase1' },
  { value: 'frontotemporal', label: 'Frontotemporal Dementia (FTD)', ta: 'neurology', modality: 'mab', phase: 'phase1' },
  { value: 'lewyBody', label: 'Lewy Body Dementia', ta: 'neurology', modality: 'mab', phase: 'phase2' },
  { value: 'myotonicDystrophy', label: 'Myotonic Dystrophy', ta: 'neurology', modality: 'aso', phase: 'phase1' },
  { value: 'tremor', label: 'Movement Disorders / Tremor', ta: 'neurology', modality: 'smallMolecule', phase: 'phase2' },
  { value: 'adhd', label: 'ADHD', ta: 'neurology', modality: 'smallMolecule', phase: 'phase2' },
  { value: 'insomnia', label: 'Insomnia', ta: 'neurology', modality: 'smallMolecule', phase: 'phase2' },

  // ── Immunology ───────────────────────────────────────────────────────────
  { value: 'rheumatoidArthritis', label: 'Rheumatoid Arthritis', ta: 'immunology', modality: 'mab', phase: 'phase2' },
  { value: 'sle_lupus', label: 'Systemic Lupus (SLE)', ta: 'immunology', modality: 'mab', phase: 'phase2' },
  { value: 'lupusNephritis', label: 'Lupus Nephritis', ta: 'immunology', modality: 'mab', phase: 'phase2' },
  { value: 'atopicderm', label: 'Atopic Dermatitis (Immunology)', ta: 'immunology', modality: 'mab', phase: 'phase2' },
  { value: 'psoriasis', label: 'Psoriasis (Immunology)', ta: 'immunology', modality: 'mab', phase: 'phase2' },
  { value: 'ulcerativeColitis', label: 'Ulcerative Colitis', ta: 'immunology', modality: 'tl1aInhibitor', phase: 'phase2' },
  { value: 'crohns', label: "Crohn's Disease (Immunology)", ta: 'immunology', modality: 'tl1aInhibitor', phase: 'phase2' },
  { value: 'myastheniaGravis', label: 'Myasthenia Gravis', ta: 'immunology', modality: 'fcrnAntagonist', phase: 'phase2' },
  { value: 'igan', label: 'IgA Nephropathy', ta: 'immunology', modality: 'mab', phase: 'phase2' },
  { value: 'aancaVasculitis', label: 'ANCA Vasculitis', ta: 'immunology', modality: 'complementInhibitor', phase: 'phase2' },
  { value: 'hidradenitis', label: 'Hidradenitis Suppurativa', ta: 'immunology', modality: 'mab', phase: 'phase2' },
  { value: 'asthma', label: 'Severe Asthma', ta: 'immunology', modality: 'mab', phase: 'phase2' },
  { value: 'eosinophilicEsophagitis', label: 'Eosinophilic Esophagitis (EoE)', ta: 'immunology', modality: 'mab', phase: 'phase2' },
  { value: 'gvhd', label: 'Graft-vs-Host Disease (GVHD)', ta: 'immunology', modality: 'carT_autoimmune', phase: 'phase1' },
  { value: 'cidp', label: 'CIDP', ta: 'immunology', modality: 'fcrnAntagonist', phase: 'phase2' },
  { value: 'pnh', label: 'PNH', ta: 'immunology', modality: 'complementInhibitor', phase: 'phase2' },
  { value: 'systemicSclerosis', label: 'Systemic Sclerosis', ta: 'immunology', modality: 'mab', phase: 'phase2' },
  { value: 'sjogrens', label: "Sjogren's Syndrome", ta: 'immunology', modality: 'mab', phase: 'phase2' },
  { value: 'ipf', label: 'Idiopathic Pulmonary Fibrosis (IPF)', ta: 'immunology', modality: 'mab', phase: 'phase2' },
  { value: 'copd', label: 'COPD (Immunology)', ta: 'immunology', modality: 'mab', phase: 'phase2' },
  { value: 'ankylosingSpondylitis', label: 'Ankylosing Spondylitis', ta: 'immunology', modality: 'mab', phase: 'phase2' },
  { value: 'giantCellArteritis', label: 'Giant Cell Arteritis', ta: 'immunology', modality: 'mab', phase: 'phase2' },
  { value: 'pemphigus', label: 'Pemphigus', ta: 'immunology', modality: 'mab', phase: 'phase2' },
  { value: 'itp', label: 'Immune Thrombocytopenia (ITP)', ta: 'immunology', modality: 'mab', phase: 'phase2' },
  { value: 'vitiligo', label: 'Vitiligo (Immunology)', ta: 'immunology', modality: 'jakInhibitor', phase: 'phase2' },
  { value: 'multipleSclerosisMod', label: 'Multiple Sclerosis (Immunology)', ta: 'immunology', modality: 'mab', phase: 'phase2' },

  // ── Metabolic ────────────────────────────────────────────────────────────
  { value: 'obesity', label: 'Obesity', ta: 'metabolic', modality: 'glp1Agonist', phase: 'phase2' },
  { value: 'type2Diabetes', label: 'Type 2 Diabetes', ta: 'metabolic', modality: 'glp1Agonist', phase: 'phase2' },
  { value: 'nashMash', label: 'NASH / MASH', ta: 'metabolic', modality: 'smallMolecule', phase: 'phase2' },
  { value: 'type1Diabetes', label: 'Type 1 Diabetes', ta: 'metabolic', modality: 'mab', phase: 'phase2' },
  { value: 'gout', label: 'Gout', ta: 'metabolic', modality: 'smallMolecule', phase: 'phase2' },
  { value: 'fabry', label: 'Fabry Disease', ta: 'metabolic', modality: 'geneTherapy', phase: 'phase1' },
  { value: 'gaucher', label: 'Gaucher Disease', ta: 'metabolic', modality: 'smallMolecule', phase: 'phase2' },
  { value: 'pompe', label: 'Pompe Disease', ta: 'metabolic', modality: 'geneTherapy', phase: 'phase1' },
  { value: 'pku', label: 'Phenylketonuria (PKU)', ta: 'metabolic', modality: 'geneTherapy', phase: 'phase1' },
  { value: 'metabolicSyndrome', label: 'Metabolic Syndrome', ta: 'metabolic', modality: 'dualIncretin', phase: 'phase2' },
  { value: 'ckdMetabolic', label: 'CKD (Metabolic)', ta: 'metabolic', modality: 'smallMolecule', phase: 'phase2' },
  { value: 'familialHypercholesterolemia', label: 'Familial Hypercholesterolemia', ta: 'metabolic', modality: 'smallMolecule', phase: 'phase2' },
  { value: 'attrAmyloidosis', label: 'ATTR Amyloidosis', ta: 'metabolic', modality: 'smallMolecule', phase: 'phase2' },

  // ── Cardiovascular ───────────────────────────────────────────────────────
  { value: 'heartFailureHfref', label: 'Heart Failure (HFrEF)', ta: 'cardiovascular', modality: 'smallMolecule', phase: 'phase2' },
  { value: 'atrialFibrillation', label: 'Atrial Fibrillation', ta: 'cardiovascular', modality: 'smallMolecule', phase: 'phase2' },
  { value: 'pulmonaryArterialHypertension', label: 'Pulmonary Arterial Hypertension', ta: 'cardiovascular', modality: 'smallMolecule', phase: 'phase2' },
  { value: 'dyslipidemia', label: 'Dyslipidemia', ta: 'cardiovascular', modality: 'pcsk9Targeting', phase: 'phase2' },
  { value: 'cardiomyopathy', label: 'Cardiomyopathy', ta: 'cardiovascular', modality: 'myosinInhibitor', phase: 'phase2' },
  { value: 'hypertrophicCardiomyopathy', label: 'Hypertrophic Cardiomyopathy (HCM)', ta: 'cardiovascular', modality: 'myosinInhibitor', phase: 'phase2' },
  { value: 'coronaryArteryDisease', label: 'Coronary Artery Disease', ta: 'cardiovascular', modality: 'smallMolecule', phase: 'phase2' },
  { value: 'peripheralArteryDisease', label: 'Peripheral Artery Disease', ta: 'cardiovascular', modality: 'smallMolecule', phase: 'phase2' },
  { value: 'resistantHypertension', label: 'Resistant Hypertension', ta: 'cardiovascular', modality: 'smallMolecule', phase: 'phase2' },
  { value: 'stroke', label: 'Stroke Prevention', ta: 'cardiovascular', modality: 'anticoagulantNovel', phase: 'phase2' },
  { value: 'heartFailureHfpef', label: 'Heart Failure (HFpEF)', ta: 'cardiovascular', modality: 'smallMolecule', phase: 'phase2' },

  // ── Infectious Disease ───────────────────────────────────────────────────
  { value: 'hivAids', label: 'HIV / AIDS', ta: 'infectiousDisease', modality: 'smallMolecule', phase: 'phase2' },
  { value: 'hepatitisB', label: 'Hepatitis B (HBV)', ta: 'infectiousDisease', modality: 'smallMolecule', phase: 'phase2' },
  { value: 'rsv', label: 'RSV', ta: 'infectiousDisease', modality: 'vaccinePreventive', phase: 'phase2' },
  { value: 'influenza', label: 'Influenza', ta: 'infectiousDisease', modality: 'mrna', phase: 'phase2' },
  { value: 'tuberculosis', label: 'Tuberculosis', ta: 'infectiousDisease', modality: 'antibioticNovel', phase: 'phase2' },
  { value: 'amrBacterial', label: 'AMR Bacterial Infections', ta: 'infectiousDisease', modality: 'antibioticNovel', phase: 'phase2' },
  { value: 'fungalInfections', label: 'Invasive Fungal Infections', ta: 'infectiousDisease', modality: 'smallMolecule', phase: 'phase2' },
  { value: 'covid', label: 'COVID-19', ta: 'infectiousDisease', modality: 'antiviral', phase: 'phase2' },
  { value: 'hepatitisD', label: 'Hepatitis D (HDV)', ta: 'infectiousDisease', modality: 'smallMolecule', phase: 'phase2' },
  { value: 'cmvInfection', label: 'CMV Infection', ta: 'infectiousDisease', modality: 'antiviral', phase: 'phase2' },
  { value: 'clostridioides', label: 'C. difficile Infection', ta: 'infectiousDisease', modality: 'mab', phase: 'phase2' },

  // ── Ophthalmology ────────────────────────────────────────────────────────
  { value: 'wetAmd', label: 'Wet AMD', ta: 'ophthalmology', modality: 'antiVegf', phase: 'phase2' },
  { value: 'dryAmdGA', label: 'Dry AMD / Geographic Atrophy', ta: 'ophthalmology', modality: 'mab', phase: 'phase2' },
  { value: 'diabeticRetinopathy', label: 'Diabetic Retinopathy', ta: 'ophthalmology', modality: 'antiVegf', phase: 'phase2' },
  { value: 'glaucoma', label: 'Glaucoma', ta: 'ophthalmology', modality: 'smallMolecule', phase: 'phase2' },
  { value: 'dryEyeDisease', label: 'Dry Eye Disease', ta: 'ophthalmology', modality: 'topicalOphthalmic', phase: 'phase2' },
  { value: 'retinitisPigmentosa', label: 'Retinitis Pigmentosa', ta: 'ophthalmology', modality: 'geneTherapyOcular', phase: 'phase1' },
  { value: 'diabeticMacularEdema', label: 'Diabetic Macular Edema', ta: 'ophthalmology', modality: 'antiVegf', phase: 'phase2' },
  { value: 'myopiaProgression', label: 'Myopia Progression', ta: 'ophthalmology', modality: 'topicalOphthalmic', phase: 'phase2' },
  { value: 'stargardt', label: 'Stargardt Disease', ta: 'ophthalmology', modality: 'geneTherapyOcular', phase: 'phase1' },

  // ── Rare Disease ─────────────────────────────────────────────────────────
  { value: 'spinalMuscularAtrophy', label: 'Spinal Muscular Atrophy (SMA)', ta: 'rareDisease', modality: 'geneTherapyRare' as Modality, phase: 'phase2' },
  { value: 'duchenneMD', label: 'Duchenne Muscular Dystrophy', ta: 'rareDisease', modality: 'geneTherapyRare' as Modality, phase: 'phase1' },
  { value: 'cysticFibrosis', label: 'Cystic Fibrosis', ta: 'rareDisease', modality: 'smallMolecule', phase: 'phase2' },
  { value: 'fabryDisease', label: 'Fabry Disease', ta: 'rareDisease', modality: 'enzymeReplacement' as Modality, phase: 'phase2' },
  { value: 'gaucherDisease', label: 'Gaucher Disease', ta: 'rareDisease', modality: 'substrateReduction' as Modality, phase: 'phase2' },
  { value: 'pompeDisease', label: 'Pompe Disease', ta: 'rareDisease', modality: 'enzymeReplacement' as Modality, phase: 'phase2' },
  { value: 'hemophiliaA', label: 'Hemophilia A', ta: 'rareDisease', modality: 'geneTherapyRare' as Modality, phase: 'phase2' },
  { value: 'hemophiliaB', label: 'Hemophilia B', ta: 'rareDisease', modality: 'geneTherapyRare' as Modality, phase: 'phase2' },
  { value: 'sickleCell', label: 'Sickle Cell Disease', ta: 'rareDisease', modality: 'geneTherapyRare' as Modality, phase: 'phase1' },
  { value: 'huntingtonDisease', label: "Huntington's Disease (Rare)", ta: 'rareDisease', modality: 'aso', phase: 'phase1' },
  { value: 'betaThalassemia', label: 'Beta-Thalassemia', ta: 'rareDisease', modality: 'geneTherapyRare' as Modality, phase: 'phase2' },
  { value: 'mucopolysaccharidosis', label: 'Mucopolysaccharidosis (MPS)', ta: 'rareDisease', modality: 'enzymeReplacement' as Modality, phase: 'phase2' },
  { value: 'niemannPickC', label: 'Niemann-Pick Type C', ta: 'rareDisease', modality: 'smallMolecule', phase: 'phase2' },
  { value: 'fragileX', label: 'Fragile X Syndrome', ta: 'rareDisease', modality: 'smallMolecule', phase: 'phase2' },

  // ── Hematology ───────────────────────────────────────────────────────────
  { value: 'dlbcl', label: 'DLBCL (Hematology)', ta: 'hematology', modality: 'carT_heme', phase: 'phase1' },
  { value: 'follicularLymphoma', label: 'Follicular Lymphoma', ta: 'hematology', modality: 'bispecificHeme' as Modality, phase: 'phase2' },
  { value: 'aml', label: 'AML (Hematology)', ta: 'hematology', modality: 'bispecificHeme' as Modality, phase: 'phase2' },
  { value: 'mds', label: 'MDS (Hematology)', ta: 'hematology', modality: 'smallMolecule', phase: 'phase2' },
  { value: 'myelofibrosis', label: 'Myelofibrosis', ta: 'hematology', modality: 'smallMolecule', phase: 'phase2' },
  { value: 'itp', label: 'ITP (Hematology)', ta: 'hematology', modality: 'mab', phase: 'phase2' },
  { value: 'aplasticAnemia', label: 'Aplastic Anemia', ta: 'hematology', modality: 'mab', phase: 'phase2' },
  { value: 'polycythemiaVera', label: 'Polycythemia Vera', ta: 'hematology', modality: 'smallMolecule', phase: 'phase2' },
  { value: 'waldenstroms', label: "Waldenstrom's Macroglobulinemia", ta: 'hematology', modality: 'smallMolecule', phase: 'phase2' },
  { value: 'mantleCellLymphoma', label: 'Mantle Cell Lymphoma (Heme)', ta: 'hematology', modality: 'smallMolecule', phase: 'phase2' },
  { value: 'hodgkinLymphoma', label: 'Hodgkin Lymphoma (Heme)', ta: 'hematology', modality: 'mab', phase: 'phase2' },
  { value: 'all', label: 'ALL (Hematology)', ta: 'hematology', modality: 'carT_heme', phase: 'phase1' },
  { value: 'cll', label: 'CLL (Hematology)', ta: 'hematology', modality: 'smallMolecule', phase: 'phase2' },
  { value: 'myeloma', label: 'Multiple Myeloma (Hematology)', ta: 'hematology', modality: 'bispecificHeme' as Modality, phase: 'phase2' },

  // ── Dermatology ──────────────────────────────────────────────────────────
  { value: 'atopicDermatitis', label: 'Atopic Dermatitis', ta: 'dermatology', modality: 'il13Inhibitor' as Modality, phase: 'phase2' },
  { value: 'psoriasis', label: 'Plaque Psoriasis', ta: 'dermatology', modality: 'il17Inhibitor' as Modality, phase: 'phase2' },
  { value: 'alopeciaAreata', label: 'Alopecia Areata', ta: 'dermatology', modality: 'jakInhibitorDerm' as Modality, phase: 'phase2' },
  { value: 'vitiligo', label: 'Vitiligo', ta: 'dermatology', modality: 'jakInhibitorDerm' as Modality, phase: 'phase2' },
  { value: 'hidradenitisSuppurativa', label: 'Hidradenitis Suppurativa', ta: 'dermatology', modality: 'mab', phase: 'phase2' },
  { value: 'chronicUrticaria', label: 'Chronic Urticaria', ta: 'dermatology', modality: 'mab', phase: 'phase2' },
  { value: 'acne', label: 'Acne', ta: 'dermatology', modality: 'smallMolecule', phase: 'phase2' },

  // ── Gastroenterology ─────────────────────────────────────────────────────
  { value: 'crohnsDisease', label: "Crohn's Disease", ta: 'gastroenterology', modality: 'antiTl1a' as Modality, phase: 'phase2' },
  { value: 'ulcerativeColitis', label: 'Ulcerative Colitis (GI)', ta: 'gastroenterology', modality: 'il23GI' as Modality, phase: 'phase2' },
  { value: 'eosinophilicEsophagitis', label: 'Eosinophilic Esophagitis', ta: 'gastroenterology', modality: 'mab', phase: 'phase2' },
  { value: 'celiacDisease', label: 'Celiac Disease', ta: 'gastroenterology', modality: 'smallMolecule', phase: 'phase2' },
  { value: 'ibsD', label: 'IBS-D', ta: 'gastroenterology', modality: 'smallMolecule', phase: 'phase2' },
  { value: 'shortBowelSyndrome', label: 'Short Bowel Syndrome', ta: 'gastroenterology', modality: 'peptide' as Modality, phase: 'phase2' },
];

// ── Deduplicate: same value appearing in multiple TAs → keep first ────────

function deduplicateBySlug(defs: IndicationDef[]): IndicationDef[] {
  const seen = new Set<string>();
  return defs.filter((d) => {
    const slug = indicationToSlug(d.value);
    if (seen.has(slug)) return false;
    seen.add(slug);
    return true;
  });
}

// ── Slug helpers ────────────────────────────────────────────────────────────

function indicationToSlug(value: string): string {
  return value
    .replace(/_/g, '-')
    .replace(/([A-Z])/g, '-$1')
    .toLowerCase()
    .replace(/^-/, '')
    .replace(/--+/g, '-');
}

function taToSlug(ta: string): string {
  const overrides: Record<string, string> = {
    infectiousDisease: 'infectious-disease',
    rareDisease: 'rare-disease',
    womensHealth: 'womens-health',
  };
  return overrides[ta] || ta;
}

// ── Human-readable TA labels ────────────────────────────────────────────────

const TA_LABELS: Record<string, string> = {
  oncology: 'Oncology',
  neurology: 'Neurology',
  immunology: 'Immunology',
  metabolic: 'Metabolic',
  cardiovascular: 'Cardiovascular',
  infectiousDisease: 'Infectious Disease',
  ophthalmology: 'Ophthalmology',
  rareDisease: 'Rare Disease',
  hematology: 'Hematology',
  dermatology: 'Dermatology',
  gastroenterology: 'Gastroenterology',
  womensHealth: "Women's Health",
};

// ── Input factory ───────────────────────────────────────────────────────────

function makeIndicationInput(def: IndicationDef): CalculationInput {
  const ta = def.ta;
  const isNeuro = ta === 'neurology';
  const isMetabolic = ta === 'metabolic';
  const isImmunology = ta === 'immunology';
  const isCardio = ta === 'cardiovascular';
  const isInfectious = ta === 'infectiousDisease';
  const isOphtho = ta === 'ophthalmology';
  const isRare = ta === 'rareDisease';
  const isHeme = ta === 'hematology';
  const isDerm = ta === 'dermatology';
  const isGI = ta === 'gastroenterology';

  const base: CalculationInput = {
    therapeuticArea: ta,
    phase: def.phase,
    modality: def.modality,
    indication: def.value as Indication,
    territory: 'global',
    biomarker: 'unselected',
    lineOfTherapy: '2L',
    treatmentApproach: isNeuro ? 'diseaseModifying' : 'symptomatic',
    combinationPotential: 'some',
    competitivePosition: 'racing',
    dataQuality: 'promising',
    regulatoryDesignations: {
      breakthrough: false,
      fastTrack: false,
      orphan: isRare,
      prime: false,
    },
  };

  if (isNeuro) {
    base.bbbPenetration = 'promisingPreclinical';
    base.diseaseProgression = 'moderateProgressive';
    base.biomarkerValidation = 'exploratory';
  }
  if (isMetabolic) {
    base.mechanismDifferentiation = def.modality === 'glp1Agonist' || (def.modality as string).includes('incretin') ? 'incretinBased' : 'nonIncretin';
    base.weightLossEfficacy = 'competitiveEfficacy';
    base.routeOfAdministration = def.modality === ('oralPeptide' as Modality) ? 'oral' : 'injectable';
    base.comorbidityBreadth = 'obesityPrimary';
    base.metabolicTreatmentApproach = 'chronicWeightMgmt';
  }
  if (isImmunology) {
    base.immuneResetPotential = (def.modality as string).includes('carT') ? 'curativeIntent' : 'chronicTreatment';
    base.targetSpecificity = 'pathwayTargeted';
    base.diseaseSeverity = 'moderateSevere';
    base.treatmentGoal = 'remissionInduction';
  }
  if (isCardio) {
    base.cvOutcomeBenefit = 'hospitalizationReduction';
    base.cvTrialEndpoint = 'maceEndpoint';
    base.cvPopulationRisk = 'highRisk';
  }
  if (isInfectious) {
    base.resistanceProfile = 'novelTarget';
    base.infectionChronicity = 'chronic';
    base.publicHealthPriority = 'standard';
  }
  if (isOphtho) {
    base.ocularDelivery = def.modality === ('topicalOphthalmic' as Modality) ? 'topical' : 'intravitreal';
    base.treatmentDurability = 'extendedDuration';
    base.visionImpact = 'visionThreatening';
  }
  if (isRare) {
    base.orphanDesignation = 'fda_orphan';
    base.patientPopulationSize = 'rare_1k_10k';
    base.geneticBasis = 'monogenic_validated';
  }
  if (isHeme) {
    base.hemeLineage = 'lymphoid';
    base.transplantEligibility = 'transplant_eligible';
    base.mrdStatus = 'standard_response';
  }
  if (isDerm) {
    base.skinSeverity = 'moderate';
    base.chronicityProfile = 'chronic_relapsing';
    base.topicalVsSystemic = 'systemic_only';
  }
  if (isGI) {
    base.giSegment = 'colonic';
    base.biologicExperience = 'biologic_naive';
    base.endoscopicEndpoint = 'endoscopic_remission';
  }

  return base;
}

// ── Hero stats builder ──────────────────────────────────────────────────────

function buildHeroStats(result: ReturnType<typeof calculateDealTerms>) {
  return [
    {
      label: 'Median Upfront',
      value: formatCurrency(result.terms.upfront.median),
      subtext: `Range: ${formatCurrency(result.terms.upfront.low)} - ${formatCurrency(result.terms.upfront.high)}`,
    },
    {
      label: 'Total Deal Value',
      value: formatCurrency(result.terms.totalDealValue.median),
      subtext: `Range: ${formatCurrency(result.terms.totalDealValue.low)} - ${formatCurrency(result.terms.totalDealValue.high)}`,
    },
    {
      label: 'Royalty Rate',
      value: `${result.tieredRoyalties.base.low}% - ${result.tieredRoyalties.base.high}%`,
      subtext: `Tiered up to ${result.tieredRoyalties.highTier.high}%`,
    },
    {
      label: 'Dev Milestones',
      value: formatCurrency(result.terms.devMilestones.median),
      subtext: `Range: ${formatCurrency(result.terms.devMilestones.low)} - ${formatCurrency(result.terms.devMilestones.high)}`,
    },
  ];
}

// ── Phase label helper ──────────────────────────────────────────────────────

const PHASE_LABELS: Record<string, string> = {
  preclinical: 'Preclinical',
  phase1: 'Phase 1',
  phase1_2: 'Phase 1/2',
  phase2: 'Phase 2',
  phase2_3: 'Phase 2/3',
  phase3: 'Phase 3',
  approved: 'Approved',
};

// ── Page builder ────────────────────────────────────────────────────────────

function buildIndicationPage(
  def: IndicationDef,
  allDefs: IndicationDef[]
): BenchmarkPageData {
  const slug = `${indicationToSlug(def.value)}-deal-benchmarks`;
  const taLabel = TA_LABELS[def.ta] || def.ta;
  const phaseLabel = PHASE_LABELS[def.phase] || def.phase;
  const input = makeIndicationInput(def);
  const r = calculateDealTerms(input);

  const title = `${def.label} Deal Benchmarks 2026 | Licensing & M&A Terms`;
  const h1 = `${def.label} — Deal Benchmarks & Valuation`;
  const metaDescription = `${def.label} licensing deals average ${formatCurrency(r.terms.totalDealValue.median)} total value at ${phaseLabel}. Benchmark upfront payments, milestones, and royalties for ${def.label.toLowerCase()} transactions.`;

  const contextParagraphs = [
    `${def.label} is one of the most actively transacted indications in ${taLabel.toLowerCase()} licensing. ${phaseLabel} deals for ${def.label.toLowerCase()} carry a median total deal value of ${formatCurrency(r.terms.totalDealValue.median)}, with upfront payments ranging from ${formatCurrency(r.terms.upfront.low)} to ${formatCurrency(r.terms.upfront.high)}. The recommended deal structure allocates approximately ${r.dealRecommendation.upfrontPercent}% to upfront payments and ${r.dealRecommendation.milestonePercent}% to milestones.`,
    `Milestone structures for ${def.label.toLowerCase()} deals allocate ${formatCurrency(r.terms.devMilestones.median)} to development milestones, ${formatCurrency(r.terms.regMilestones.median)} to regulatory milestones, and ${formatCurrency(r.terms.commMilestones.median)} to commercial milestones. Royalty rates range from ${r.tieredRoyalties.base.low}% to ${r.tieredRoyalties.base.high}% at the base tier, with tiered escalation reaching ${r.tieredRoyalties.highTier.low}%-${r.tieredRoyalties.highTier.high}% on peak sales.`,
  ];

  const faqs = [
    {
      question: `What are typical deal terms for ${def.label.toLowerCase()} licensing?`,
      answer: `${phaseLabel} ${def.label.toLowerCase()} licensing deals average ${formatCurrency(r.terms.upfront.median)} in upfront payments with ${formatCurrency(r.terms.totalDealValue.median)} total deal value. The ${r.dealRecommendation.upfrontPercent}/${r.dealRecommendation.milestonePercent} upfront/milestone split reflects the risk profile at this clinical stage.`,
    },
    {
      question: `What royalty rates are standard for ${def.label.toLowerCase()} deals?`,
      answer: `Base royalty rates for ${def.label.toLowerCase()} transactions range from ${r.tieredRoyalties.base.low}% to ${r.tieredRoyalties.base.high}%, with tiered escalations reaching ${r.tieredRoyalties.highTier.low}%-${r.tieredRoyalties.highTier.high}% on peak sales. Rates are influenced by mechanism differentiation, competitive positioning, and territorial scope.`,
    },
    {
      question: `How are ${def.label.toLowerCase()} deal milestones structured?`,
      answer: `${def.label} deals allocate approximately ${r.dealRecommendation.milestonePercent}% of total deal value to milestones. Development milestones (${formatCurrency(r.terms.devMilestones.median)}) make up the largest share, followed by commercial milestones (${formatCurrency(r.terms.commMilestones.median)}) and regulatory milestones (${formatCurrency(r.terms.regMilestones.median)}).`,
    },
  ];

  // Related pages: same TA different indication + overview page
  const related: { slug: string; title: string }[] = [];
  const sameTA = allDefs.filter(
    (d) => d.ta === def.ta && d.value !== def.value
  );
  for (let i = 0; i < Math.min(3, sameTA.length); i++) {
    related.push({
      slug: `${indicationToSlug(sameTA[i].value)}-deal-benchmarks`,
      title: `${sameTA[i].label} Deals`,
    });
  }
  // Add TA overview page
  related.push({
    slug: `${taToSlug(def.ta)}-deal-benchmarks`,
    title: `${taLabel} Deal Overview`,
  });

  return {
    slug,
    title,
    metaDescription,
    h1,
    heroStats: buildHeroStats(r),
    contextParagraphs,
    calculatorPrefill: {
      indication: def.value,
      therapeuticArea: def.ta,
    },
    faqs,
    relatedPages: related.slice(0, 4),
    category: 'indication',
  };
}

// ── Main export ─────────────────────────────────────────────────────────────

let _cache: BenchmarkPageData[] | null = null;

export function getIndicationBenchmarkPages(): BenchmarkPageData[] {
  if (_cache) return _cache;

  const deduplicated = deduplicateBySlug(INDICATION_REGISTRY);
  const pages: BenchmarkPageData[] = [];

  for (const def of deduplicated) {
    pages.push(buildIndicationPage(def, deduplicated));
  }

  _cache = pages;
  return pages;
}
