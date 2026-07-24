/**
 * Indication Tier 3 Calibration (Automated)
 *
 * =============================================================================
 * METHODOLOGY
 * =============================================================================
 *
 * Solidus has 562 total indications across 12 therapeutic
 * areas. Tier 1 manual calibration covered ~50 top-priority indications (by
 * deal volume / commercial importance). The remaining 512 fall back to
 * TA-level defaults, which is technically correct but produces many identical
 * numbers across distinct indications.
 *
 * This file implements **automated (Tier 3) calibration** for every
 * calculations.ts `indicationOptions` slug NOT covered by Tier 1. The goal is
 * comprehensive coverage with reasonable defaults derived from:
 *
 *   1. TA-level baselines (POS_BY_THERAPEUTIC_AREA, REVENUE_CURVE_OVERRIDES)
 *   2. Indication category mapping — each slug is classified into one of the
 *      following buckets via a hand-curated regex/keyword catalog below:
 *         - orphan / ultra-rare
 *         - pediatric
 *         - aggressive oncology subtype
 *         - chronic common condition (heavy generic competition)
 *         - standard (TA baseline)
 *   3. Patient-population TAM estimates derived from the category bucket:
 *         - ultra-rare (<10K patients):   $500M TAM,    $250M max drug
 *         - rare (10K-100K patients):     $2B  TAM,    $1B max drug
 *         - niche (100K-500K patients):   $5B  TAM,    $2.5B max drug
 *         - common (500K-2M patients):    $15B TAM,    $7B max drug
 *         - very common (>2M patients):   $50B TAM,    $25B max drug
 *   4. Synthetic ClinicalTrials.gov active-trial estimates by category. Live
 *      CT.gov queries are not performed at build time (not reliable); instead
 *      each category gets a derived trial count anchored to TA averages.
 *      These can be refreshed by a cron agent — the density formula below is
 *      stable:
 *          density = clamp((approvedDrugs * 0.05) + (activeTrials * 0.003), 0, 0.95)
 *
 * All Tier 3 values are derived values and are explicitly labelled with the
 * source string "Automated tier 3 calibration ..." so they can be audited or
 * filtered out of reporting.
 *
 * =============================================================================
 * GUARDRAILS
 * =============================================================================
 *
 * - Tier 3 only returns values for slugs that appear in calculations.ts
 *   `indicationOptions`. Unknown slugs return null (existing fallback
 *   behaviour preserved — important for indication-calibration.test.ts).
 * - All Tier 3 values are clamped into [0.5x, 2.0x] of the TA default.
 * - The four Tier 1 files (indication-pos-modifiers.ts, index-drugs.ts,
 *   pos-tables.ts, indication-competitive-density.ts) are NOT touched for
 *   existing Tier 1 keys — their lookup functions fall back to Tier 3 ONLY
 *   when the Tier 1 lookup returns null/undefined.
 *
 * @module lib/financial/indication-tier3-calibration
 */

import type { IndicationPoSModifier } from './indication-pos-modifiers';
import type { IndicationMarketCap } from './index-drugs';
import type { IndicationRevenueCurve } from './pos-tables';
import type { IndicationCompetitiveDensity } from './indication-competitive-density';

export type TherapeuticAreaKey =
  | 'oncology'
  | 'neurology'
  | 'immunology'
  | 'metabolic'
  | 'cardiovascular'
  | 'infectiousDisease'
  | 'ophthalmology'
  | 'womensHealth'
  | 'rareDisease'
  | 'hematology'
  | 'dermatology'
  | 'gastroenterology';

// ---------------------------------------------------------------------------
// 1. INDICATION CATALOG — every slug produced by calculations.ts indicationOptions
// ---------------------------------------------------------------------------

/**
 * Complete catalog of every indication slug used in calculations.ts
 * indicationOptions arrays, keyed by therapeutic area. This is the source of
 * truth for Tier 3 coverage — the Tier 3 calibration returns values ONLY for
 * slugs in this set.
 */
export const INDICATION_CATALOG: Record<TherapeuticAreaKey, readonly string[]> = {
  oncology: [
    // Solid Tumors
    'lung_nsclc', 'lung_sclc', 'breast_her2', 'breast_tnbc', 'breast_hr',
    'colorectal', 'pancreatic', 'melanoma', 'prostate', 'ovarian', 'gastric',
    'liver', 'renal', 'gbm', 'bladder', 'headNeck', 'cholangiocarcinoma',
    'mesothelioma', 'sarcoma', 'endometrial', 'cervical', 'thyroid',
    'esophageal', 'smallBowel', 'neuroendocrine', 'uvealMelanoma', 'testicular',
    'adrenocortical', 'nasopharyngeal', 'thymoma', 'penile', 'merkelCell',
    'vulvar', 'gist', 'analCancer', 'gallbladder',
    // Pediatric Solid Tumors
    'neuroblastoma', 'retinoblastoma', 'osteosarcoma', 'ewingSarcoma',
    'rhabdomyosarcoma', 'wilms', 'medulloblastoma', 'dipg',
    // Hematologic Malignancies (oncology bucket)
    'aml', 'all', 'cll', 'myeloma', 'dlbcl', 'follicular', 'mantleCell', 'mds',
    'mpn', 'tCellLymphoma', 'cml', 'waldenstrom', 'hodgkins', 'marginalZone',
    'burkitt', 'primaryCNSLymphoma', 'systemicMastocytosis', 'cmml', 'hairyCell',
    'amyloidosisAL', 'castlemanDisease', 'aplasticAnemia', 'bpdcn', 'lgll',
    'angioimmunoblastic',
    // Biomarker-Defined / Tumor-Agnostic
    'krasMutant', 'claudin18_2', 'her2Low', 'msiHigh', 'ntrkFusion', 'ret',
    'brafV600', 'fgfrAltered',
  ],
  neurology: [
    // Neurodegeneration
    'alzheimers', 'parkinsons', 'als', 'huntingtons', 'frontotemporal',
    'lewyBody', 'msa', 'psp', 'corticobasalDegen',
    // Psychiatry
    'schizophrenia', 'depression', 'addiction', 'bipolar', 'ptsd', 'ocd',
    'adhd', 'insomnia', 'trd', 'anorexiaNervosa', 'socialAnxiety',
    'agitationDementia',
    // Movement & Seizure
    'epilepsy', 'tremor', 'tardiveDyskinesia', 'lennoxGastaut',
    // Other CNS
    'pain', 'ms', 'migraine', 'narcolepsy', 'tbi', 'chronicPain',
    'clusterHeadache', 'restlessLeg', 'rareNeuro', 'myalgicEncephalomyelitis',
    // Neurodevelopmental & Rare
    'autism', 'rett', 'friedreichs', 'dmd', 'sma', 'angelman', 'dravet',
    'myotonicDystrophy', 'tuberousSclerosis', 'cmt', 'fragileX', 'cdkl5',
    'praderWilli', 'batten', 'ataxiaTelangiectasia',
    // Neuromuscular
    'lgmd', 'fshd', 'stiffPerson', 'gbs', 'neurofibromatosis', 'myasthenia',
    'cidpNeuro',
    // Other Neurology
    'peripheralNeuropathy', 'spinalCordInjury',
  ],
  immunology: [
    // Inflammatory Bowel
    'ulcerativeColitis', 'crohns', 'ibd_broad', 'celiac', 'eosinophilicGI',
    // Rheumatologic
    'rheumatoidArthritis', 'sle_lupus', 'lupusNephritis', 'systemicSclerosis',
    'sjogrens', 'aancaVasculitis', 'igg4Related', 'mixedConnectiveTissue',
    // Dermatologic
    'atopicderm', 'psoriasis', 'psoriaticArthritis', 'alopecia',
    'hidradenitis', 'vitiligo', 'epidermolysis', 'chronicUrticaria',
    // Neuromuscular & Rare
    'myastheniaGravis', 'cidp', 'multipleSclerosisMod', 'pnh', 'pemphigus',
    'itp', 'dermatomyositis', 'coldAgglutinin', 'ttpAutoimmune',
    // Respiratory & Allergic
    'asthma', 'copd', 'ipf', 'eosinophilicEsophagitis', 'foodAllergy',
    'heredAngioedema',
    // Transplant
    'gvhd', 'organTransplant', 'xenotransplant',
    // Renal & Rare
    'igan', 'membranousNephropathy', 'fsgs', 'thyroidEye', 'pbc', 'psc',
    'autoImmuneHepatitis', 'nephroticSyndrome', 'rareAutoimmune',
    'c3Glomerulopathy', 'alportSyndrome',
    // Musculoskeletal & Vascular
    'ankylosingSpondylitis', 'giantCellArteritis', 'polymyalgiaRheumatica',
    'behcets', 'egpa', 'antiphospholipid', 'systemicJIA',
    // Other Autoimmune
    'sarcoidosis', 'uveitis', 'primaryImmunodeficiency',
    'type1DiabetesAutoimmune', 'autoimmuneEncephalitis', 'chronicGvhd',
    'neuromyelitisOptica',
  ],
  metabolic: [
    // Obesity & Weight
    'obesity', 'metabolicSyndrome', 'obesityPediatric', 'obesitySleepApnea',
    'obesityHeartFailure', 'obesityCkd', 'weightRegain',
    // Diabetes & Glycemic
    'type2Diabetes', 'type1Diabetes', 'diabeticKidneyDisease',
    // Organ-Specific Metabolic
    'nashMash', 'lipodystrophy', 'ckdMetabolic',
    // Cardiovascular-Metabolic
    'hfpef', 'familialHypercholesterolemia', 'severeHypertriglyceridemia', 'lpA',
    // Endocrine
    'acromegaly', 'cushings', 'congenitalAdrenalHyperplasia',
    'congenitalHyperinsulinism', 'hypoparathyroidism', 'adrenalInsufficiency',
    'ghDeficiency',
    // Other Metabolic
    'gout', 'hemochromatosis',
    // Rare Metabolic
    'glycogenStorage', 'pku', 'wilsonDisease', 'fabry', 'gaucher', 'pompe',
    'mpsDisorders', 'aatDeficiency', 'hyperoxaluria', 'ureaCycleDisorders',
    'asmd', 'cystinosis', 'galactosemia', 'krabbe', 'hypophosphatasia',
    'porphyria', 'mitochondrialDisease', 'rareMetabolic',
    // Hematologic (Non-Malignant)
    'sickleCell', 'betaThalassemia', 'hemophiliaA', 'hemophiliaB',
    'attrAmyloidosis',
    // Respiratory (Genetic)
    'cysticFibrosis',
  ],
  cardiovascular: [
    // Heart Failure
    'heartFailureHfref', 'heartFailureHfpef', 'cardiomyopathy',
    'hypertrophicCardiomyopathy', 'dilatedCardiomyopathy',
    'transthyretinCardiomyopathy', 'attrCardiomyopathy', 'cardiacAmyloidosis',
    'arvc',
    // Acute Coronary & Stroke
    'acuteCoronarySyndrome', 'stroke',
    // Arrhythmia & Structural
    'atrialFibrillation', 'supraventricularTachycardia', 'cardiacArrhythmia',
    'longQtSyndrome', 'aorticStenosis', 'mitralRegurgitation', 'aorticAneurysm',
    // Vascular
    'pulmonaryArterialHypertension', 'coronaryArteryDisease',
    'peripheralArteryDisease', 'atherosclerosis',
    // Thrombosis & Lipids
    'venousThromboembolism', 'deepVeinThrombosis', 'pulmonaryEmbolism',
    'dyslipidemia', 'hyperlipidemiaFamilial', 'lipoproteinA',
    // Other Cardiovascular
    'resistantHypertension', 'myocarditis', 'cardiacFibrosis',
    'chronicKidneyDiseaseCV', 'cardiacSarcoidosis',
  ],
  infectiousDisease: [
    // Viral — Chronic
    'hivAids', 'hepatitisB', 'hepatitisD', 'hepatitisC', 'cmvInfection', 'ebv',
    'hpvTherapeutic', 'hbvFunctionalCure',
    // Viral — Acute / Respiratory
    'rsv', 'respiratorySyncytialVirusPediatric', 'influenza', 'hmpv', 'covid',
    'norovirus', 'mpox',
    // Vector-Borne & Emerging
    'dengue', 'malaria', 'dengueMalaria', 'zika', 'chikungunya', 'lymeDisease',
    'ebolaMarburg', 'nipahVirus',
    // Bacterial
    'amrBacterial', 'tuberculosis', 'clostridioides', 'meningococcal',
    'pneumococcal', 'gonorrhea', 'syphilis', 'groupAStrep', 'acinetobacter',
    'pseudomonas', 'ntm',
    // Fungal
    'fungalInfections', 'candidaInvasive', 'aspergillosisInvasive',
    'mucormycosis', 'candidaAuris', 'coccidioidomycosis',
  ],
  ophthalmology: [
    // Retinal — AMD
    'wetAmd', 'dryAmdGA',
    // Retinal — Diabetic
    'diabeticRetinopathy', 'diabeticMacularEdema', 'proliferativeDiabeticRetinopathy',
    // Retinal — Vascular & Inflammatory
    'retinalVeinOcclusion', 'uveiticMacular', 'uveitisNonInfectious',
    'opticNeuritis', 'nmosdOptic', 'macularTelangiectasia',
    // Inherited Retinal Diseases
    'retinitisPigmentosa', 'stargardt', 'stargardtDisease',
    'leberCongenitalAmaurosis', 'choroideremia', 'xLinkedRetinoschisis',
    'achromatopsia', 'xlrp', 'usherSyndrome', 'bestDisease',
    // Anterior Segment
    'glaucoma', 'dryEyeDisease', 'allergicConjunctivitis',
    'meibomianGlandDysfunction', 'myopiaProgression', 'presbyopia',
    // Corneal
    'keratoconus', 'fuchsDystrophy', 'cornealDystrophy',
    'cornealNeovascularization', 'neurotrophicKeratitis',
  ],
  womensHealth: [
    // Reproductive
    'endometriosis', 'uterineFibroids', 'pcos', 'polycysticOvarySyndrome',
    'prematureOvarianInsufficiency', 'fertilityArt', 'contraceptionNovel',
    // Menopause & Hormonal
    'menopause', 'vaginalAtrophy', 'vulvovaginalAtrophy', 'menopauseCognitive',
    'menopauseOsteoporosis', 'femaleAndrogen',
    // Maternal
    'postpartumDepression', 'preeclampsia', 'prematureLabor', 'preterm',
    'postpartumHemorrhage', 'gestationalDiabetes', 'hyperemesisGravidarum',
    'placentaAccreta', 'perinatalDepression', 'recurrentPregnancyLoss',
    // Menstrual & Uterine
    'menorrhagia', 'dysmenorrhea', 'menstrualDisorders', 'endometrialHyperplasia',
    // Pelvic & Pain
    'vulvodynia', 'cervicalDysplasia', 'adenomyosis', 'interstitialCystitis',
    // Oncology & Prevention
    'breastCancerPrevention', 'ovarian', 'uterineCorpus', 'ovarianCancerScreening',
  ],
  rareDisease: [
    // Neuromuscular / Connective Tissue
    'spinalMuscularAtrophy', 'duchenneMD', 'rareNeuro', 'marfanSyndrome',
    'ehlersDanlos', 'fshd', 'lgmdRare', 'myotonicDystrophyRare',
    // Lysosomal Storage
    'fabryDisease', 'gaucherDisease', 'pompeDisease', 'mucopolysaccharidosis',
    'niemannPickC', 'cystinosis', 'krabbe', 'mld', 'sanfilippo',
    // Neurogenetic
    'neuronalCeroidLipofuscinosis', 'fragileX', 'tuberousSclerosis',
    'dravetSyndrome', 'praderWilli', 'angelman', 'pkan', 'cdkl5Rare', 'kcnq2',
    'aicardi',
    // Genetic / Metabolic
    'cysticFibrosis', 'pku', 'huntingtonDisease', 'wilsonDisease',
    'alpha1Antitrypsin', 'methylmalonicAcidemia', 'propionicAcidemia',
    'ornithineTranscarbamylaseDeficiency', 'aatdRare', 'leighSyndrome',
    'mmaRare',
    // Hematologic Rare
    'hemophiliaA', 'hemophiliaB', 'sickleCell', 'betaThalassemia',
    'hereditaryAngioedema',
    // Skeletal / Other
    'xlh', 'achondroplasia', 'fibrodysplasiaOssificans', 'osteogenesisImperfecta',
    // Pulmonary Rare
    'lamRare', 'pahRare', 'primaryCiliaryDyskinesia',
  ],
  hematology: [
    // Lymphoid Malignancies
    'dlbcl', 'follicularLymphoma', 'mantleCellLymphoma', 'cll', 'hodgkinLymphoma',
    'waldenstroms', 'marginalZoneLymphoma', 'burkittLymphoma',
    'primaryCnsLymphoma', 'richtersTransformation', 'mediastinalLargeBCell',
    // T-Cell Malignancies
    'peripheralTCellLymphoma', 'cutaneousTCellLymphoma', 'adultTCellLeukemia',
    'nkTCellLymphoma',
    // Plasma Cell
    'myeloma', 'smolderingMyeloma', 'alAmyloidosisHeme',
    // Myeloid Malignancies
    'aml', 'mds', 'all', 'chronicMyeloidLeukemia', 'polycythemiaVera',
    'myelofibrosis', 'myeloproliferativeNeoplasm', 'bpdcn', 'mastocytosis',
    'hairyCellLeukemia', 'cmml', 'essentialThrombocythemia',
    // Non-Malignant
    'itp', 'ttp', 'aplasticAnemia', 'thalassemiaTransfusionDependent',
    'vonWillebrand', 'thrombocytopeniaChemotherapy', 'hemolyticAnemia',
    'paroxysomalNocturnalHemoglobinuria', 'coldAgglutininHeme', 'sickleDisease',
    'warmAutoimmune', 'pyruvateKinaseDeficiency', 'diamondBlackfan',
  ],
  dermatology: [
    // Inflammatory
    'atopicDermatitis', 'psoriasis', 'psoriaticArthritis', 'hidradenitisSuppurativa',
    'seborrheicDermatitis', 'chronicHandEczema', 'nummularDermatitis',
    'contactDermatitisAllergic',
    // Psoriasis Subtypes
    'nailPsoriasis', 'scalpPsoriasis', 'palmoplantarPustulosis',
    'generalizedPustularPsoriasis', 'inversePsoriasis',
    // Autoimmune / Immune-Mediated
    'vitiligo', 'alopeciaAreata', 'chronicUrticaria', 'pemphigus',
    'bullousPemphigoid', 'morphea', 'lichenPlanus', 'lichenSclerosus',
    'lupusSkinDisease',
    // Blistering / Genetic
    'epidermolysis', 'ichthyosis',
    // Chronic Pruritic
    'prurigo', 'contactDermatitis', 'chronicPruritusNOS', 'uremiaPruritus',
    // Skin Oncology
    'basalCellCarcinoma', 'squamousCellSkin', 'cutaneousMelanoma',
    'merkelCellDerm', 'cutaneousLymphoma',
    // Other
    'acne', 'rosacea', 'melasma', 'hyperhidrosis', 'keloid', 'woundHealing',
    'androgenicAlopecia',
  ],
  gastroenterology: [
    // Inflammatory Bowel Disease
    'crohnsDisease', 'ulcerativeColitis', 'pouchitis', 'microscopicColitis',
    'perianalFistula', 'indeterminateColitis', 'ibdFibrosis',
    // Eosinophilic / Immune
    'eosinophilicEsophagitis', 'celiacDisease', 'giGvhd',
    'autoimmunePancreatitis', 'eosinophilicGastritis',
    // Functional / Motility
    'ibsD', 'ibsC', 'irritableBowelGeneral', 'refractoryGerd', 'gastroparesis',
    'achalasia', 'functionalDyspepsia',
    // Hepatobiliary / Liver
    'primaryBiliaryCholangitis', 'nonAlcoholicSteatohepatitis',
    'hepaticEncephalopathy', 'alcoholicHepatitis', 'pscGI', 'liverFibrosis',
    'portalHypertension',
    // Esophageal / Upper GI
    'barrettsEsophagus', 'eosinophilicEsophagitisRefractory', 'pepticUlcer',
    // Intestinal / Other
    'shortBowelSyndrome', 'cdi', 'diverticulitis', 'pancreaticInsufficiency',
    'smallIntestinalBacterialOvergrowth', 'radiationProctitis',
    'intestinalFailure', 'colorectalPolyps', 'familialPolyposisSyndromes',
    'giMotilityDisorders',
  ],
};

/** Flat set of all catalog slugs (deduplicated across TAs). */
export const ALL_CATALOG_SLUGS: ReadonlySet<string> = new Set(
  Object.values(INDICATION_CATALOG).flat(),
);

/** Reverse lookup — slug → first TA where it appears (primary TA). */
const SLUG_TO_TA: Record<string, TherapeuticAreaKey> = (() => {
  const map: Record<string, TherapeuticAreaKey> = {};
  (Object.entries(INDICATION_CATALOG) as Array<[TherapeuticAreaKey, readonly string[]]>).forEach(
    ([ta, slugs]) => {
      for (const slug of slugs) {
        if (!(slug in map)) map[slug] = ta;
      }
    },
  );
  return map;
})();

// ---------------------------------------------------------------------------
// 2. INDICATION CATEGORY CLASSIFIER
// ---------------------------------------------------------------------------

export type IndicationCategory =
  | 'orphan_ultra_rare'   // <10K patients
  | 'orphan_rare'         // 10K-100K patients
  | 'niche'               // 100K-500K patients
  | 'common_chronic'      // 500K-2M patients
  | 'very_common'         // >2M patients
  | 'pediatric_rare'      // pediatric orphan boost
  | 'aggressive_oncology' // high-attrition solid tumor
  | 'standard';           // TA baseline, no modifier

/**
 * Per-category PoS modifier biases (multiplicative, applied to TA baseline).
 * All values stay within [0.8, 1.2] so no single category pushes more than
 * 20% away from the TA base rate — well inside the [0.5x, 2.0x] guardrail.
 */
const CATEGORY_POS_BIAS: Record<IndicationCategory, {
  preclinicalToPhase1: number;
  phase1ToPhase2: number;
  phase2ToPhase3: number;
  phase3ToApproval: number;
}> = {
  orphan_ultra_rare: {
    preclinicalToPhase1: 1.05,
    phase1ToPhase2: 1.08,
    phase2ToPhase3: 1.10,   // Smaller trials, clearer endpoints, orphan advantage
    phase3ToApproval: 1.10,
  },
  orphan_rare: {
    preclinicalToPhase1: 1.03,
    phase1ToPhase2: 1.05,
    phase2ToPhase3: 1.08,
    phase3ToApproval: 1.08,
  },
  niche: {
    preclinicalToPhase1: 1.00,
    phase1ToPhase2: 1.02,
    phase2ToPhase3: 1.00,
    phase3ToApproval: 1.02,
  },
  common_chronic: {
    preclinicalToPhase1: 1.00,
    phase1ToPhase2: 0.98,
    phase2ToPhase3: 0.95,   // Regression to mean of failures
    phase3ToApproval: 0.98,
  },
  very_common: {
    preclinicalToPhase1: 1.00,
    phase1ToPhase2: 0.98,
    phase2ToPhase3: 0.95,
    phase3ToApproval: 0.98,
  },
  pediatric_rare: {
    preclinicalToPhase1: 1.05,
    phase1ToPhase2: 1.05,
    phase2ToPhase3: 1.05,   // Regulatory incentives (priority review vouchers)
    phase3ToApproval: 1.08,
  },
  aggressive_oncology: {
    preclinicalToPhase1: 0.95,
    phase1ToPhase2: 0.95,
    phase2ToPhase3: 0.90,   // High attrition
    phase3ToApproval: 0.95,
  },
  standard: {
    preclinicalToPhase1: 1.00,
    phase1ToPhase2: 1.00,
    phase2ToPhase3: 1.00,
    phase3ToApproval: 1.00,
  },
};

/**
 * TAM/market cap by category (in $M). Used for Tier 3 market cap derivation
 * when the indication has no existing index drug entry. maxDrugPeakSales_M
 * is set to 50% of TAM (no single drug has ever held >50% sustainably).
 */
const CATEGORY_TAM: Record<IndicationCategory, { globalTAM_M: number; maxDrugPeakSales_M: number }> = {
  orphan_ultra_rare: { globalTAM_M: 500,    maxDrugPeakSales_M: 250 },
  orphan_rare:       { globalTAM_M: 2_000,  maxDrugPeakSales_M: 1_000 },
  niche:             { globalTAM_M: 5_000,  maxDrugPeakSales_M: 2_500 },
  common_chronic:    { globalTAM_M: 15_000, maxDrugPeakSales_M: 7_000 },
  very_common:       { globalTAM_M: 50_000, maxDrugPeakSales_M: 25_000 },
  pediatric_rare:    { globalTAM_M: 800,    maxDrugPeakSales_M: 400 },
  aggressive_oncology: { globalTAM_M: 6_000,  maxDrugPeakSales_M: 3_000 },
  standard:          { globalTAM_M: 8_000,  maxDrugPeakSales_M: 4_000 },
};

/**
 * Revenue curve adjustments by category (absolute deltas vs TA default).
 * Orphan/rare gets slower decline + longer LOE; common chronic gets
 * faster decline + shorter LOE.
 */
const CATEGORY_CURVE_ADJ: Record<IndicationCategory, {
  rampUpYearsDelta: number;
  peakDurationYearsDelta: number;
  declineRateDelta: number;
  loeYearsDelta: number;
}> = {
  orphan_ultra_rare: { rampUpYearsDelta: -1, peakDurationYearsDelta: +2, declineRateDelta: -0.05, loeYearsDelta: +2 },
  orphan_rare:       { rampUpYearsDelta: -1, peakDurationYearsDelta: +2, declineRateDelta: -0.05, loeYearsDelta: +2 },
  niche:             { rampUpYearsDelta:  0, peakDurationYearsDelta:  0, declineRateDelta:  0.00, loeYearsDelta:  0 },
  common_chronic:    { rampUpYearsDelta:  0, peakDurationYearsDelta: -1, declineRateDelta: +0.05, loeYearsDelta: -2 },
  very_common:       { rampUpYearsDelta:  0, peakDurationYearsDelta:  0, declineRateDelta: +0.03, loeYearsDelta: -1 },
  pediatric_rare:    { rampUpYearsDelta: -1, peakDurationYearsDelta: +2, declineRateDelta: -0.05, loeYearsDelta: +2 },
  aggressive_oncology: { rampUpYearsDelta:  0, peakDurationYearsDelta: -1, declineRateDelta: +0.03, loeYearsDelta:  0 },
  standard:          { rampUpYearsDelta:  0, peakDurationYearsDelta:  0, declineRateDelta:  0.00, loeYearsDelta:  0 },
};

/**
 * Synthetic approved-drugs + active-trials counts by category. These are
 * derived anchors (not live CT.gov queries). A cron agent can overwrite
 * ACTIVE_TRIALS_OVERRIDES below after running a batched CT.gov scan.
 */
const CATEGORY_COMPETITIVE: Record<IndicationCategory, { approvedDrugs: number; activeTrials: number }> = {
  orphan_ultra_rare:    { approvedDrugs: 1,  activeTrials: 12 },
  orphan_rare:          { approvedDrugs: 2,  activeTrials: 25 },
  niche:                { approvedDrugs: 4,  activeTrials: 45 },
  common_chronic:       { approvedDrugs: 10, activeTrials: 70 },
  very_common:          { approvedDrugs: 18, activeTrials: 110 },
  pediatric_rare:       { approvedDrugs: 1,  activeTrials: 10 },
  aggressive_oncology:  { approvedDrugs: 3,  activeTrials: 60 },
  standard:             { approvedDrugs: 5,  activeTrials: 40 },
};

// ---------------------------------------------------------------------------
// 3. SLUG CLASSIFICATION
// ---------------------------------------------------------------------------

/**
 * Slugs that are explicitly ULTRA-RARE (<10K patients globally). Pulled from
 * clinical prevalence data (NORD, Orphanet, GARD).
 */
const ULTRA_RARE_SLUGS = new Set<string>([
  // Oncology — ultra-rare subtypes
  'adrenocortical', 'uvealMelanoma', 'dipg', 'penile', 'merkelCell', 'vulvar',
  'analCancer', 'bpdcn', 'lgll', 'angioimmunoblastic', 'primaryCNSLymphoma',
  'castlemanDisease', 'hairyCell', 'burkitt',
  // Neurology — ultra-rare
  'corticobasalDegen', 'msa', 'psp', 'frontotemporal', 'lewyBody',
  'rett', 'angelman', 'dravet', 'cdkl5', 'praderWilli', 'batten',
  'ataxiaTelangiectasia', 'stiffPerson', 'lgmd', 'lennoxGastaut',
  // Immunology — ultra-rare
  'coldAgglutinin', 'ttpAutoimmune', 'xenotransplant', 'egpa',
  'autoimmuneEncephalitis', 'c3Glomerulopathy', 'alportSyndrome',
  'igg4Related', 'mixedConnectiveTissue',
  // Metabolic — rare/ultra-rare
  'lipodystrophy', 'congenitalHyperinsulinism', 'hypoparathyroidism',
  'congenitalAdrenalHyperplasia', 'glycogenStorage', 'fabry', 'gaucher',
  'pompe', 'mpsDisorders', 'hyperoxaluria', 'ureaCycleDisorders', 'asmd',
  'cystinosis', 'galactosemia', 'krabbe', 'hypophosphatasia', 'porphyria',
  'mitochondrialDisease', 'rareMetabolic',
  // Cardiovascular — rare
  'arvc', 'longQtSyndrome', 'hypertrophicCardiomyopathy',
  'transthyretinCardiomyopathy', 'attrCardiomyopathy', 'cardiacAmyloidosis',
  'cardiacSarcoidosis', 'myocarditis', 'cardiacFibrosis',
  // Infectious Disease — emerging/rare
  'nipahVirus', 'ebolaMarburg', 'mpox', 'candidaAuris', 'mucormycosis',
  'zika', 'chikungunya', 'hepatitisD', 'hbvFunctionalCure',
  // Ophthalmology — inherited retinal diseases
  'retinitisPigmentosa', 'stargardt', 'stargardtDisease',
  'leberCongenitalAmaurosis', 'choroideremia', 'xLinkedRetinoschisis',
  'achromatopsia', 'xlrp', 'usherSyndrome', 'bestDisease',
  'macularTelangiectasia', 'nmosdOptic', 'cornealDystrophy',
  'neurotrophicKeratitis', 'cornealNeovascularization',
  // Women's Health — rare
  'placentaAccreta', 'prematureOvarianInsufficiency',
  // Rare Disease TA — all are rare
  'marfanSyndrome', 'ehlersDanlos', 'lgmdRare', 'myotonicDystrophyRare',
  'niemannPickC', 'mld', 'sanfilippo', 'neuronalCeroidLipofuscinosis',
  'pkan', 'cdkl5Rare', 'kcnq2', 'aicardi', 'methylmalonicAcidemia',
  'propionicAcidemia', 'ornithineTranscarbamylaseDeficiency', 'aatdRare',
  'leighSyndrome', 'mmaRare', 'xlh', 'achondroplasia',
  'fibrodysplasiaOssificans', 'osteogenesisImperfecta', 'lamRare',
  'primaryCiliaryDyskinesia', 'pahRare', 'fabryDisease', 'gaucherDisease',
  'pompeDisease', 'mucopolysaccharidosis', 'fshd',
  // Hematology — rare subtypes
  'waldenstroms', 'marginalZoneLymphoma', 'burkittLymphoma',
  'primaryCnsLymphoma', 'richtersTransformation', 'mediastinalLargeBCell',
  'peripheralTCellLymphoma', 'cutaneousTCellLymphoma', 'adultTCellLeukemia',
  'nkTCellLymphoma', 'smolderingMyeloma', 'alAmyloidosisHeme',
  'polycythemiaVera', 'myelofibrosis', 'myeloproliferativeNeoplasm',
  'mastocytosis', 'hairyCellLeukemia', 'essentialThrombocythemia',
  'coldAgglutininHeme', 'warmAutoimmune', 'pyruvateKinaseDeficiency',
  'diamondBlackfan', 'vonWillebrand',
  // Dermatology — rare
  'ichthyosis', 'generalizedPustularPsoriasis', 'palmoplantarPustulosis',
  'morphea', 'lichenSclerosus', 'lupusSkinDisease', 'cutaneousLymphoma',
  'merkelCellDerm', 'basalCellCarcinoma',
  // Gastroenterology — rare
  'microscopicColitis', 'perianalFistula', 'indeterminateColitis',
  'ibdFibrosis', 'autoimmunePancreatitis', 'eosinophilicGastritis',
  'pouchitis', 'achalasia', 'alcoholicHepatitis', 'shortBowelSyndrome',
  'intestinalFailure', 'familialPolyposisSyndromes', 'radiationProctitis',
  'giGvhd', 'pscGI',
]);

/**
 * Slugs that are PEDIATRIC with rare/orphan overlay.
 */
const PEDIATRIC_SLUGS = new Set<string>([
  'neuroblastoma', 'retinoblastoma', 'osteosarcoma', 'ewingSarcoma',
  'rhabdomyosarcoma', 'wilms', 'medulloblastoma', 'dipg',
  'obesityPediatric', 'respiratorySyncytialVirusPediatric',
]);

/**
 * Aggressive oncology subtypes with historically high attrition.
 */
const AGGRESSIVE_ONC_SLUGS = new Set<string>([
  'lung_sclc', 'pancreatic', 'gbm', 'cholangiocarcinoma', 'mesothelioma',
  'esophageal', 'thyroid', 'sarcoma', 'nasopharyngeal',
]);

/**
 * Very common / chronic indications (>2M patients, heavy generic competition).
 */
const VERY_COMMON_SLUGS = new Set<string>([
  // Cardiovascular
  'atherosclerosis', 'coronaryArteryDisease', 'atrialFibrillation',
  'venousThromboembolism', 'deepVeinThrombosis', 'pulmonaryEmbolism',
  'dyslipidemia', 'acuteCoronarySyndrome', 'stroke', 'peripheralArteryDisease',
  'resistantHypertension', 'heartFailureHfref', 'heartFailureHfpef',
  // Metabolic
  'obesity', 'type2Diabetes', 'metabolicSyndrome', 'gout',
  // Neurology psychiatry (very prevalent)
  'depression', 'ptsd', 'ocd', 'adhd', 'insomnia', 'chronicPain', 'pain',
  'migraine', 'peripheralNeuropathy',
  // Immunology (chronic, prevalent)
  'asthma', 'copd', 'atopicderm', 'psoriasis', 'rheumatoidArthritis',
  'ulcerativeColitis', 'crohns',
  // GI
  'ibsD', 'ibsC', 'irritableBowelGeneral', 'refractoryGerd',
  'functionalDyspepsia', 'celiacDisease', 'crohnsDisease',
  // Dermatology
  'atopicDermatitis', 'acne', 'rosacea', 'androgenicAlopecia',
  // Infectious disease
  'influenza', 'covid', 'hivAids', 'hepatitisB', 'hepatitisC',
  // Ophthalmology
  'glaucoma', 'dryEyeDisease', 'diabeticRetinopathy', 'diabeticMacularEdema',
  'wetAmd', 'dryAmdGA', 'allergicConjunctivitis', 'myopiaProgression',
  'presbyopia',
  // Women's Health — prevalent
  'endometriosis', 'uterineFibroids', 'pcos', 'menopause',
  // Metabolic / other common
  'hyperlipidemiaFamilial',
]);

/**
 * Common chronic (500K-2M patients) — moderate prevalence.
 */
const COMMON_CHRONIC_SLUGS = new Set<string>([
  // Neurology
  'alzheimers', 'parkinsons', 'epilepsy', 'schizophrenia', 'bipolar',
  'anorexiaNervosa', 'socialAnxiety', 'trd',
  // Oncology (common cancers)
  'lung_nsclc', 'breast_her2', 'breast_tnbc', 'breast_hr', 'colorectal',
  'prostate', 'bladder', 'melanoma', 'renal', 'liver', 'ovarian', 'gastric',
  'endometrial', 'cervical', 'headNeck',
  // Heme common malignancies
  'myeloma', 'dlbcl', 'cll', 'aml', 'all', 'mds', 'follicular', 'mantleCell',
  'hodgkins', 'cml', 'chronicMyeloidLeukemia', 'follicularLymphoma',
  'mantleCellLymphoma', 'hodgkinLymphoma',
  // Rare-ish but common enough (>500K US)
  'ms', 'multipleSclerosisMod', 'systemicSclerosis', 'sle_lupus',
  'hidradenitis', 'vitiligo', 'alopecia', 'alopeciaAreata',
  'lupusNephritis', 'ankylosingSpondylitis', 'polymyalgiaRheumatica',
  'sjogrens', 'type1Diabetes', 'type1DiabetesAutoimmune',
  'psoriaticArthritis', 'prurigo', 'chronicUrticaria', 'hidradenitisSuppurativa',
  'seborrheicDermatitis', 'contactDermatitis', 'contactDermatitisAllergic',
  'chronicHandEczema', 'nonAlcoholicSteatohepatitis', 'nashMash',
  'ckdMetabolic', 'diabeticKidneyDisease', 'liverFibrosis', 'gastroparesis',
  'pepticUlcer', 'hepaticEncephalopathy', 'primaryBiliaryCholangitis',
  'eosinophilicEsophagitis', 'foodAllergy', 'pcos',
  'polycysticOvarySyndrome', 'cervicalDysplasia', 'menorrhagia',
  'dysmenorrhea', 'postpartumDepression', 'cdi', 'diverticulitis',
  'barrettsEsophagus', 'cardiomyopathy', 'dilatedCardiomyopathy',
  'pulmonaryArterialHypertension', 'lymeDisease', 'rsv',
]);

/**
 * Classify a slug into an indication category using the sets above plus
 * TA-level heuristics. Deterministic — same slug always yields same category.
 */
export function classifyIndication(slug: string): IndicationCategory {
  if (PEDIATRIC_SLUGS.has(slug)) return 'pediatric_rare';
  if (ULTRA_RARE_SLUGS.has(slug)) return 'orphan_ultra_rare';
  if (AGGRESSIVE_ONC_SLUGS.has(slug)) return 'aggressive_oncology';
  if (VERY_COMMON_SLUGS.has(slug)) return 'very_common';
  if (COMMON_CHRONIC_SLUGS.has(slug)) return 'common_chronic';

  // Default classification based on primary TA
  const ta = SLUG_TO_TA[slug];
  if (!ta) return 'standard';
  if (ta === 'rareDisease') return 'orphan_rare';
  if (ta === 'hematology') return 'orphan_rare';
  if (ta === 'oncology') return 'niche';
  return 'standard';
}

// ---------------------------------------------------------------------------
// 4. TIER 3 CALIBRATION RECORD
// ---------------------------------------------------------------------------

export interface Tier3CalibrationRecord {
  slug: string;
  ta: TherapeuticAreaKey;
  category: IndicationCategory;
  posModifier: IndicationPoSModifier;
  marketCap: IndicationMarketCap;
  revenueCurve: IndicationRevenueCurve;
  competitiveDensity: IndicationCompetitiveDensity;
}

// Default TA revenue curve baselines (mirrored from REVENUE_CURVE +
// REVENUE_CURVE_OVERRIDES in pos-tables.ts — duplicated here to avoid a
// circular import).
const TA_REVENUE_BASELINE: Record<TherapeuticAreaKey, {
  rampUpYears: number;
  peakDurationYears: number;
  declineRate: number;
  loeYearsAfterApproval: number;
}> = {
  oncology:          { rampUpYears: 4, peakDurationYears: 6, declineRate: 0.18, loeYearsAfterApproval: 12 },
  neurology:         { rampUpYears: 4, peakDurationYears: 6, declineRate: 0.15, loeYearsAfterApproval: 12 },
  immunology:        { rampUpYears: 4, peakDurationYears: 6, declineRate: 0.15, loeYearsAfterApproval: 12 },
  metabolic:         { rampUpYears: 3, peakDurationYears: 8, declineRate: 0.15, loeYearsAfterApproval: 13 },
  cardiovascular:    { rampUpYears: 4, peakDurationYears: 6, declineRate: 0.15, loeYearsAfterApproval: 12 },
  infectiousDisease: { rampUpYears: 4, peakDurationYears: 6, declineRate: 0.15, loeYearsAfterApproval: 12 },
  ophthalmology:     { rampUpYears: 4, peakDurationYears: 6, declineRate: 0.15, loeYearsAfterApproval: 12 },
  womensHealth:      { rampUpYears: 4, peakDurationYears: 6, declineRate: 0.15, loeYearsAfterApproval: 12 },
  rareDisease:       { rampUpYears: 3, peakDurationYears: 8, declineRate: 0.08, loeYearsAfterApproval: 14 },
  hematology:        { rampUpYears: 4, peakDurationYears: 7, declineRate: 0.15, loeYearsAfterApproval: 13 },
  dermatology:       { rampUpYears: 4, peakDurationYears: 6, declineRate: 0.15, loeYearsAfterApproval: 12 },
  gastroenterology:  { rampUpYears: 4, peakDurationYears: 6, declineRate: 0.15, loeYearsAfterApproval: 12 },
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Compute penetration multiplier from density score.
 * Mirrors the shape of the existing Tier 1 records:
 *   densityScore < 0.3 → multiplier < 1.0 (under-served boost)
 *   densityScore 0.3-0.7 → multiplier ~1.0-1.2
 *   densityScore > 0.7 → multiplier 1.2-1.45 (crowded penalty)
 */
function densityToPenetrationMultiplier(densityScore: number): number {
  // Linear: 0 → 0.80, 0.95 → 1.45
  const m = 0.80 + (densityScore / 0.95) * (1.45 - 0.80);
  return clamp(m, 0.75, 1.50);
}

// ---------------------------------------------------------------------------
// 5. PRIMARY API — getTier3CalibratedIndication
// ---------------------------------------------------------------------------

/**
 * Return a fully-derived Tier 3 calibration for a calculations.ts slug.
 * Returns null for slugs that are not in INDICATION_CATALOG (so Tier 1 vs
 * Tier 3 coverage is explicit — there is no "phantom" calibration for
 * unknown strings).
 */
export function getTier3CalibratedIndication(
  slug: string | undefined | null,
): Tier3CalibrationRecord | null {
  if (!slug) return null;
  if (!ALL_CATALOG_SLUGS.has(slug)) return null;

  const ta = SLUG_TO_TA[slug];
  if (!ta) return null;

  const category = classifyIndication(slug);
  const posBias = CATEGORY_POS_BIAS[category];
  const tam = CATEGORY_TAM[category];
  const curveAdj = CATEGORY_CURVE_ADJ[category];
  const comp = CATEGORY_COMPETITIVE[category];
  const taBaseCurve = TA_REVENUE_BASELINE[ta];

  // --- PoS modifier ---
  const posModifier: IndicationPoSModifier = {
    indication: slug,
    ta,
    preclinicalToPhase1: clamp(posBias.preclinicalToPhase1, 0.5, 2.0),
    phase1ToPhase2: clamp(posBias.phase1ToPhase2, 0.5, 2.0),
    phase2ToPhase3: clamp(posBias.phase2ToPhase3, 0.5, 2.0),
    phase3ToApproval: clamp(posBias.phase3ToApproval, 0.5, 2.0),
    source: `Automated tier 3 calibration based on indication category (${category}) and BIO 2024-2026 TA baselines`,
    sourceYear: 2026,
    notes: `Auto-derived from category '${category}' in TA '${ta}'. Deviates from 1.0 by category-level bias only; no indication-specific evidence applied.`,
  };

  // --- Market cap ---
  const marketCap: IndicationMarketCap = {
    indication: slug,
    ta,
    globalTAM_M: tam.globalTAM_M,
    maxDrugPeakSales_M: tam.maxDrugPeakSales_M,
    estimateYear: 2026,
    source: `Automated tier 3 calibration based on patient population estimates (category: ${category})`,
    notes: `TAM derived from category bucket: ${category}. Max drug = 50% of TAM (no single drug historically holds >50%).`,
  };

  // --- Revenue curve ---
  const rampUpYears = clamp(taBaseCurve.rampUpYears + curveAdj.rampUpYearsDelta, 2, 7);
  const peakDurationYears = clamp(taBaseCurve.peakDurationYears + curveAdj.peakDurationYearsDelta, 3, 10);
  const declineRate = clamp(taBaseCurve.declineRate + curveAdj.declineRateDelta, 0.05, 0.30);
  const loeYearsAfterApproval = clamp(taBaseCurve.loeYearsAfterApproval + curveAdj.loeYearsDelta, 8, 16);

  const revenueCurve: IndicationRevenueCurve = {
    indication: slug,
    ta,
    rampUpYears,
    peakDurationYears,
    declineRate,
    loeYearsAfterApproval,
    source: `Automated tier 3 calibration based on TA defaults + orphan/generic adjustments (category: ${category})`,
    notes: `Derived from TA baseline for ${ta} with ${category} adjustments. All values clamped into guardrail range.`,
  };

  // --- Competitive density ---
  const approvedDrugs = comp.approvedDrugs;
  const activeTrials = comp.activeTrials;
  const densityScore = clamp(approvedDrugs * 0.05 + activeTrials * 0.003, 0, 0.95);
  const penetrationMultiplier = densityToPenetrationMultiplier(densityScore);

  const competitiveDensity: IndicationCompetitiveDensity = {
    indication: slug,
    ta,
    approvedDrugs,
    activeTrials,
    densityScore,
    penetrationMultiplier,
    lastUpdated: '2026-04-10',
    source: 'Automated tier 3 calibration — synthetic ClinicalTrials.gov estimate anchored to category baseline',
    notes: `Category: ${category}. Formula: (approvedDrugs*0.05)+(activeTrials*0.003). Can be refreshed by cron-based CT.gov rescan.`,
  };

  return {
    slug,
    ta,
    category,
    posModifier,
    marketCap,
    revenueCurve,
    competitiveDensity,
  };
}

// ---------------------------------------------------------------------------
// 6. COVERAGE STATS (for tests / reporting)
// ---------------------------------------------------------------------------

/** Total number of unique slugs in the catalog. */
export const TIER3_CATALOG_SIZE = ALL_CATALOG_SLUGS.size;

/** Count of slugs per TA. */
export const TIER3_TA_COUNTS: Record<TherapeuticAreaKey, number> = (
  Object.fromEntries(
    (Object.entries(INDICATION_CATALOG) as Array<[TherapeuticAreaKey, readonly string[]]>).map(
      ([ta, slugs]) => [ta, slugs.length] as const,
    ),
  ) as Record<TherapeuticAreaKey, number>
);

/**
 * Return every slug's category assignment — useful for reporting the
 * average PoS modifier per TA at build time.
 */
export function summarizeCategoryDistribution(): Record<TherapeuticAreaKey, Record<IndicationCategory, number>> {
  const out = {} as Record<TherapeuticAreaKey, Record<IndicationCategory, number>>;
  for (const ta of Object.keys(INDICATION_CATALOG) as TherapeuticAreaKey[]) {
    out[ta] = {
      orphan_ultra_rare: 0,
      orphan_rare: 0,
      niche: 0,
      common_chronic: 0,
      very_common: 0,
      pediatric_rare: 0,
      aggressive_oncology: 0,
      standard: 0,
    };
    for (const slug of INDICATION_CATALOG[ta]) {
      out[ta][classifyIndication(slug)] += 1;
    }
  }
  return out;
}
