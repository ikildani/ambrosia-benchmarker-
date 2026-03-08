import { getBenchmarksSync } from '@/lib/benchmarks';

// Live-calibrated benchmarks (merges static JSON with DB-driven calibrations)
const benchmarks = getBenchmarksSync();

// Therapeutic area type
export type TherapeuticArea = 'oncology' | 'neurology' | 'immunology' | 'metabolic' | 'cardiovascular' | 'infectiousDisease' | 'ophthalmology' | 'womensHealth' | 'rareDisease' | 'hematology' | 'dermatology' | 'gastroenterology';

// Phase types
export type Phase = 'discovery' | 'preclinical' | 'phase1' | 'phase1_2' | 'phase2' | 'phase2_3' | 'phase3' | 'nda_filed' | 'approved';

// Deal structure types
export type DealType = 'licensing' | 'acquisition' | 'codevelopment' | 'option' | 'collaboration';

// Modality types (17 oncology + 6 neurology = 23 options)
export type Modality =
  | 'smallMolecule' | 'mab' | 'adc' | 'bispecific' | 'tCellEngager'
  | 'carT_heme' | 'carT_solid' | 'cellTherapy' | 'geneTherapy'
  | 'radiopharmaceutical' | 'mrna' | 'rnai' | 'protac'
  | 'molecularGlue' | 'peptide' | 'therapeuticVaccine' | 'oncolyticVirus'
  | 'bbbPlatform' | 'aso' | 'psychedelic'
  | 'ionChannel' | 'tauTargeting' | 'stemCell'
  | 'oligonucleotide'
  | 'carT_autoimmune' | 'inVivoCarT' | 'carTreg'
  | 'fcrnAntagonist' | 'complementInhibitor' | 'jakInhibitor'
  | 's1pModulator' | 'oralIntegrin' | 'dualAntagonist' | 'tl1aInhibitor'
  // Metabolic-specific modalities
  | 'glp1Agonist' | 'dualIncretin' | 'tripleIncretin'
  | 'sglt2Inhibitor' | 'amylinAnalog' | 'oralPeptide'
  | 'antiActivin' | 'microbiomeBased'
  // Cardiovascular-specific modalities
  | 'myosinInhibitor' | 'anticoagulantNovel' | 'rnaCardio' | 'pcsk9Targeting'
  // Infectious Disease-specific modalities
  | 'antiviral' | 'antibioticNovel' | 'vaccinePreventive' | 'phageTherapy'
  // Ophthalmology-specific modalities
  | 'antiVegf' | 'geneTherapyOcular' | 'intravitreal' | 'topicalOphthalmic'
  // Women's Health-specific modalities
  | 'gnrhAntagonist' | 'hormoneTherapy' | 'neuroactiveSteroid'
  // Rare Disease-specific modalities
  | 'enzymeReplacement' | 'substrateReduction' | 'geneTherapyRare'
  // Hematology-specific modalities
  | 'bispecificHeme' | 'btki'
  // Dermatology-specific modalities
  | 'il17Inhibitor' | 'il13Inhibitor' | 'jakInhibitorDerm' | 'topicalBiologic'
  // Gastroenterology-specific modalities
  | 'antiTl1a' | 'il23GI' | 'gutSelectiveIntegrin';

// Indication types
export type SolidTumorIndication =
  | 'lung_nsclc' | 'lung_sclc' | 'breast_her2' | 'breast_tnbc' | 'breast_hr'
  | 'colorectal' | 'pancreatic' | 'melanoma' | 'prostate' | 'ovarian'
  | 'gastric' | 'liver' | 'renal' | 'gbm' | 'bladder' | 'headNeck'
  | 'cholangiocarcinoma' | 'mesothelioma' | 'sarcoma'
  | 'endometrial' | 'cervical' | 'thyroid' | 'esophageal' | 'smallBowel'
  | 'neuroendocrine' | 'uvealMelanoma' | 'testicular' | 'adrenocortical'
  | 'nasopharyngeal' | 'thymoma' | 'penile' | 'merkelCell'
  | 'neuroblastoma' | 'retinoblastoma' | 'osteosarcoma'
  | 'ewingSarcoma' | 'rhabdomyosarcoma' | 'vulvar';

export type HematologicIndication =
  | 'aml' | 'all' | 'cll' | 'myeloma' | 'dlbcl' | 'follicular'
  | 'mantleCell' | 'mds' | 'mpn' | 'tCellLymphoma'
  | 'cml' | 'waldenstrom' | 'hodgkins'
  | 'marginalZone' | 'burkitt' | 'primaryCNSLymphoma' | 'systemicMastocytosis' | 'cmml'
  | 'hairyCell' | 'amyloidosisAL' | 'castlemanDisease' | 'aplasticAnemia' | 'bpdcn';

export type NeurologyIndication =
  | 'alzheimers' | 'parkinsons' | 'schizophrenia' | 'depression'
  | 'als' | 'huntingtons' | 'migraine' | 'narcolepsy'
  | 'pain' | 'ms' | 'epilepsy' | 'tremor' | 'tbi' | 'addiction'
  | 'rareNeuro'
  | 'bipolar' | 'ptsd' | 'ocd'
  | 'autism' | 'rett' | 'friedreichs' | 'dmd'
  | 'chronicPain'
  | 'sma' | 'angelman' | 'dravet' | 'myotonicDystrophy'
  | 'peripheralNeuropathy' | 'spinalCordInjury' | 'tuberousSclerosis' | 'cmt'
  | 'frontotemporal' | 'lewyBody' | 'adhd' | 'fragileX'
  | 'cdkl5' | 'neurofibromatosis' | 'clusterHeadache' | 'restlessLeg'
  | 'insomnia' | 'stiffPerson' | 'lgmd' | 'fshd'
  | 'praderWilli' | 'batten' | 'gbs' | 'ataxiaTelangiectasia';

export type ImmunologyIndication =
  | 'rheumatoidArthritis' | 'sle_lupus' | 'lupusNephritis'
  | 'atopicderm' | 'psoriasis' | 'psoriaticArthritis'
  | 'ulcerativeColitis' | 'crohns' | 'ibd_broad'
  | 'myastheniaGravis' | 'multipleSclerosisMod'
  | 'igan' | 'aancaVasculitis'
  | 'systemicSclerosis' | 'sjogrens'
  | 'alopecia' | 'hidradenitis'
  | 'pnh' | 'cidp'
  | 'rareAutoimmune'
  | 'celiac' | 'vitiligo' | 'pemphigus' | 'itp'
  | 'asthma' | 'eosinophilicEsophagitis'
  | 'gvhd' | 'organTransplant'
  | 'thyroidEye' | 'pbc'
  | 'ankylosingSpondylitis' | 'giantCellArteritis' | 'sarcoidosis'
  | 'autoImmuneHepatitis' | 'psc' | 'membranousNephropathy'
  | 'fsgs' | 'uveitis' | 'behcets' | 'polymyalgiaRheumatica'
  | 'chronicUrticaria' | 'heredAngioedema' | 'epidermolysis'
  | 'foodAllergy' | 'ipf' | 'dermatomyositis' | 'antiphospholipid'
  | 'egpa' | 'systemicJIA' | 'primaryImmunodeficiency'
  | 'coldAgglutinin' | 'ttpAutoimmune' | 'nephroticSyndrome' | 'copd';

export type MetabolicIndication =
  | 'obesity' | 'type2Diabetes' | 'nashMash'
  | 'metabolicSyndrome' | 'lipodystrophy'
  | 'glycogenStorage' | 'pku'
  | 'rareMetabolic'
  | 'type1Diabetes' | 'ckdMetabolic'
  | 'hfpef' | 'familialHypercholesterolemia'
  | 'gout' | 'wilsonDisease' | 'fabry' | 'gaucher'
  | 'pompe' | 'mpsDisorders' | 'aatDeficiency' | 'hyperoxaluria'
  | 'ureaCycleDisorders' | 'asmd' | 'cystinosis' | 'galactosemia'
  | 'attrAmyloidosis' | 'sickleCell' | 'betaThalassemia'
  | 'hemophiliaA' | 'hemophiliaB' | 'cysticFibrosis'
  | 'acromegaly' | 'cushings' | 'congenitalAdrenalHyperplasia'
  | 'hypophosphatasia' | 'porphyria' | 'krabbe'
  | 'hemochromatosis' | 'mitochondrialDisease' | 'congenitalHyperinsulinism';

export type CardiovascularIndication =
  | 'heartFailureHfref' | 'atrialFibrillation' | 'pulmonaryArterialHypertension'
  | 'coronaryArteryDisease' | 'peripheralArteryDisease' | 'aorticStenosis'
  | 'venousThromboembolism' | 'resistantHypertension' | 'dyslipidemia'
  | 'cardiomyopathy' | 'myocarditis' | 'cardiacArrhythmia' | 'atherosclerosis'
  | 'attrCardiomyopathy' | 'acuteCoronarySyndrome' | 'stroke'
  | 'cardiacFibrosis' | 'longQtSyndrome'
  | 'deepVeinThrombosis' | 'pulmonaryEmbolism'
  | 'hypertrophicCardiomyopathy' | 'dilatedCardiomyopathy' | 'transthyretinCardiomyopathy'
  | 'supraventricularTachycardia' | 'hyperlipidemiaFamilial' | 'lipoproteinA'
  | 'heartFailureHfpef' | 'mitralRegurgitation' | 'aorticAneurysm';

export type InfectiousDiseaseIndication =
  | 'hivAids' | 'hepatitisB' | 'rsv' | 'influenza' | 'tuberculosis'
  | 'fungalInfections' | 'amrBacterial' | 'covid' | 'hepatitisD'
  | 'cmvInfection' | 'clostridioides' | 'dengueMalaria'
  | 'hepatitisC' | 'ebv' | 'norovirus' | 'mpox' | 'zika' | 'lymeDisease'
  | 'malaria' | 'dengue' | 'candidaInvasive' | 'aspergillosisInvasive'
  | 'meningococcal' | 'pneumococcal' | 'chikungunya'
  | 'respiratorySyncytialVirusPediatric' | 'hmpv' | 'gonorrhea' | 'syphilis';

export type OphthalmologyIndication =
  | 'wetAmd' | 'dryAmdGA' | 'diabeticRetinopathy' | 'diabeticMacularEdema'
  | 'glaucoma' | 'dryEyeDisease' | 'retinitisPigmentosa' | 'uveiticMacular'
  | 'retinalVeinOcclusion' | 'stargardt' | 'myopiaProgression'
  | 'keratoconus' | 'presbyopia' | 'cornealDystrophy' | 'opticNeuritis' | 'achromatopsia'
  | 'stargardtDisease' | 'xLinkedRetinoschisis' | 'leberCongenitalAmaurosis'
  | 'choroideremia' | 'uveitisNonInfectious' | 'fuchsDystrophy'
  | 'cornealNeovascularization' | 'meibomianGlandDysfunction' | 'allergicConjunctivitis'
  | 'proliferativeDiabeticRetinopathy';

export type WomensHealthIndication =
  | 'endometriosis' | 'uterineFibroids' | 'pcos' | 'menopause'
  | 'postpartumDepression' | 'preeclampsia' | 'prematureLabor'
  | 'fertilityArt' | 'vulvodynia' | 'cervicalDysplasia'
  | 'contraceptionNovel' | 'breastCancerPrevention'
  | 'vaginalAtrophy' | 'gestationalDiabetes' | 'hyperemesisGravidarum'
  | 'placentaAccreta' | 'menstrualDisorders' | 'ovarianCancerScreening'
  | 'polycysticOvarySyndrome' | 'prematureOvarianInsufficiency' | 'vulvovaginalAtrophy'
  | 'preterm' | 'postpartumHemorrhage'
  | 'ovarian' | 'uterineCorpus' | 'endometrialHyperplasia'
  | 'menorrhagia' | 'dysmenorrhea';

export type RareDiseaseIndication =
  | 'spinalMuscularAtrophy' | 'duchenneMD' | 'cysticFibrosis' | 'fabryDisease'
  | 'gaucherDisease' | 'pompeDisease' | 'huntingtonDisease' | 'pku'
  | 'hemophiliaA' | 'hemophiliaB' | 'sickleCell' | 'betaThalassemia'
  | 'rareNeuro' | 'angelman'
  | 'mucopolysaccharidosis' | 'niemannPickC' | 'neuronalCeroidLipofuscinosis'
  | 'fragileX' | 'tuberousSclerosis' | 'dravetSyndrome' | 'praderWilli'
  | 'marfanSyndrome' | 'ehlersDanlos' | 'wilsonDisease'
  | 'alpha1Antitrypsin' | 'cystinosis' | 'methylmalonicAcidemia'
  | 'propionicAcidemia' | 'ornithineTranscarbamylaseDeficiency' | 'xlh'
  | 'hereditaryAngioedema';

export type HematologyIndication =
  | 'dlbcl' | 'follicularLymphoma' | 'mantleCellLymphoma' | 'cll' | 'myeloma'
  | 'aml' | 'mds' | 'all' | 'hodgkinLymphoma' | 'waldenstroms'
  | 'polycythemiaVera' | 'myelofibrosis' | 'itp' | 'ttp' | 'aplasticAnemia'
  | 'chronicMyeloidLeukemia' | 'hairyCellLeukemia' | 'marginalZoneLymphoma'
  | 'burkittLymphoma' | 'primaryCnsLymphoma' | 'peripheralTCellLymphoma'
  | 'cutaneousTCellLymphoma' | 'richtersTransformation' | 'bpdcn'
  | 'mastocytosis' | 'myeloproliferativeNeoplasm' | 'thalassemiaTransfusionDependent'
  | 'vonWillebrand' | 'thrombocytopeniaChemotherapy' | 'hemolyticAnemia'
  | 'paroxysomalNocturnalHemoglobinuria';

export type DermatologyIndication =
  | 'atopicDermatitis' | 'psoriasis' | 'psoriaticArthritis' | 'hidradenitisSuppurativa'
  | 'vitiligo' | 'alopeciaAreata' | 'chronicUrticaria' | 'prurigo'
  | 'contactDermatitis' | 'acne' | 'rosacea' | 'pemphigus'
  | 'morphea' | 'lichenPlanus' | 'seborrheicDermatitis' | 'melasma'
  | 'palmoplantarPustulosis' | 'nailPsoriasis' | 'scalpPsoriasis'
  | 'chronicHandEczema' | 'bullousPemphigoid' | 'epidermolysis'
  | 'ichthyosis' | 'hyperhidrosis' | 'keloid' | 'basalCellCarcinoma'
  | 'squamousCellSkin' | 'cutaneousMelanoma';

export type GastroenterologyIndication =
  | 'crohnsDisease' | 'ulcerativeColitis' | 'eosinophilicEsophagitis' | 'celiacDisease'
  | 'ibsD' | 'ibsC' | 'refractoryGerd' | 'shortBowelSyndrome'
  | 'primaryBiliaryCholangitis' | 'cdi' | 'giGvhd' | 'pouchitis'
  | 'microscopicColitis' | 'diverticulitis' | 'gastroparesis' | 'achalasia'
  | 'barrettsEsophagus' | 'pancreaticInsufficiency' | 'autoimmunePancreatitis'
  | 'nonAlcoholicSteatohepatitis' | 'hepaticEncephalopathy' | 'irritableBowelGeneral'
  | 'functionalDyspepsia' | 'smallIntestinalBacterialOvergrowth' | 'radiationProctitis'
  | 'perianalFistula' | 'intestinalFailure' | 'colorectalPolyps';

export type Indication = SolidTumorIndication | HematologicIndication | NeurologyIndication | ImmunologyIndication | MetabolicIndication | CardiovascularIndication | InfectiousDiseaseIndication | OphthalmologyIndication | WomensHealthIndication | RareDiseaseIndication | HematologyIndication | DermatologyIndication | GastroenterologyIndication;

// Territory types (15 options)
export type Territory =
  | 'global' | 'us_only' | 'ex_us' | 'europe' | 'china'
  | 'japan' | 'row' | 'us_eu' | 'us_japan'
  | 'canada' | 'australia' | 'south_korea' | 'apac_ex_cj' | 'latam' | 'mena';

// New multiplier types
export type BiomarkerStatus = 'selected' | 'unselected';
export type LineOfTherapy = '1L' | '2L' | '3L+';
export type TreatmentApproach = 'diseaseModifying' | 'symptomatic' | 'adjunctive';
export type CombinationPotential = 'strong' | 'some' | 'standalone';
export type CompetitivePosition = 'firstInClass' | 'firstToPivotal' | 'bestInClass' | 'racing' | 'behind' | 'crowded';
export type DataQuality = 'pivotalReady' | 'strongPhase2' | 'promising' | 'mixed' | 'limited';

// Neurology-specific types
export type BBBPenetration = 'provenCNS' | 'promisingPreclinical' | 'unproven' | 'peripheralOnly';
export type DiseaseProgression = 'slowProgressive' | 'moderateProgressive' | 'rapidProgressive' | 'episodic';
export type BiomarkerValidation = 'validatedSurrogate' | 'exploratory' | 'noBiomarker';

// Immunology-specific types
export type ImmuneResetPotential = 'curativeIntent' | 'durableRemission' | 'chronicTreatment';
export type TargetSpecificity = 'antigenSpecific' | 'pathwayTargeted' | 'broadImmunosuppression';
export type DiseaseSeverity = 'mildModerate' | 'moderateSevere' | 'severe' | 'refractory';
export type ImmunologyTreatmentGoal = 'remissionInduction' | 'maintenance' | 'flareControl';

// Metabolic-specific types
export type MechanismDifferentiation = 'incretinBased' | 'nonIncretin' | 'combinationMechanism';
export type WeightLossEfficacy = 'superiorEfficacy' | 'competitiveEfficacy' | 'modestEfficacy';
export type RouteOfAdministration = 'oral' | 'injectable' | 'implantable';
export type ComorbidityBreadth = 'cardiometabolicBenefit' | 'obesityPrimary' | 'organProtective';
export type MetabolicTreatmentApproach = 'chronicWeightMgmt' | 'glycemicControl' | 'organProtective' | 'metabolicReset';

// Cardiovascular-specific types
export type CVOutcomeBenefit = 'mortalityReduction' | 'hospitalizationReduction' | 'symptomImprovement';
export type CVTrialEndpoint = 'maceEndpoint' | 'surrogateBiomarker' | 'functionalEndpoint';
export type CVPopulationRisk = 'highRisk' | 'moderateRisk' | 'primaryPrevention';

// Infectious Disease-specific types
export type ResistanceProfile = 'novelTarget' | 'existingClassImproved' | 'broadSpectrum';
export type InfectionChronicity = 'acute' | 'chronic' | 'latent';
export type PublicHealthPriority = 'whoUrgent' | 'whoCritical' | 'standard';

// Ophthalmology-specific types
export type OcularDelivery = 'intravitreal' | 'topical' | 'oral' | 'implant';
export type TreatmentDurability = 'oneTime' | 'extendedDuration' | 'chronicInjection';
export type VisionImpact = 'visionThreatening' | 'visionImpairing' | 'symptomRelief';

// Women's Health-specific types
export type WHTargetPopulation = 'reproductiveAge' | 'perimenopause' | 'postmenopause' | 'pregnancy';
export type WHUnmetNeed = 'noApprovedTherapy' | 'inadequateOptions' | 'wellServed';
export type WHRegulatory = 'acceleratedPathway' | 'standardPathway' | 'pregnancyComplexity';

// Rare Disease-specific types
export type OrphanDesignation = 'fda_orphan' | 'ema_orphan' | 'both_orphan' | 'none';
export type PatientPopulationSize = 'ultraRare_sub1k' | 'rare_1k_10k' | 'rare_10k_50k' | 'broader_50k_200k';
export type GeneticBasis = 'monogenic_validated' | 'polygenic' | 'unknown_genetic' | 'non_genetic';

// Hematology-specific types
export type HemeLineage = 'lymphoid' | 'myeloid' | 'mixed_lineage' | 'non_malignant';
export type TransplantEligibility = 'transplant_eligible' | 'transplant_ineligible' | 'post_transplant';
export type MRDStatus = 'mrd_endpoint' | 'standard_response' | 'survival_endpoint';

// Dermatology-specific types
export type SkinSeverity = 'mild' | 'moderate' | 'severe' | 'refractory_derm';
export type ChronicityProfile = 'chronic_relapsing' | 'chronic_continuous' | 'acute_flares';
export type TopicalVsSystemic = 'topical_only' | 'systemic_only' | 'topical_and_systemic';

// Gastroenterology-specific types
export type GISegment = 'upper_gi' | 'small_bowel' | 'colonic' | 'pancolonic';
export type BiologicExperience = 'biologic_naive' | 'one_prior_biologic' | 'multi_biologic_exposed';
export type EndoscopicEndpoint = 'endoscopic_remission' | 'endoscopic_improvement' | 'clinical_only';

export interface RegulatoryDesignations {
  breakthrough: boolean;
  fastTrack: boolean;
  orphan: boolean;
  prime: boolean;
}

// Output types
export interface DealTerms {
  upfront: { low: number; median: number; high: number };
  devMilestones: { low: number; median: number; high: number };
  regMilestones: { low: number; median: number; high: number };
  commMilestones: { low: number; median: number; high: number };
  totalDealValue: { low: number; median: number; high: number };
}

export interface TieredRoyalties {
  base: { low: number; high: number };
  midTier: { low: number; high: number };
  highTier: { low: number; high: number };
}

export interface DealRecommendation {
  upfrontPercent: number;
  milestonePercent: number;
  rationale: string;
}

export interface CalculationInput {
  therapeuticArea: TherapeuticArea;
  phase: Phase;
  dealType?: DealType;
  modality: Modality;
  indication: Indication;
  territory: Territory;
  biomarker: BiomarkerStatus;
  lineOfTherapy: LineOfTherapy;
  treatmentApproach: TreatmentApproach;
  combinationPotential: CombinationPotential;
  competitivePosition: CompetitivePosition;
  dataQuality: DataQuality;
  regulatoryDesignations: RegulatoryDesignations;
  // Neurology-specific optional fields
  bbbPenetration?: BBBPenetration;
  diseaseProgression?: DiseaseProgression;
  biomarkerValidation?: BiomarkerValidation;
  // Immunology-specific optional fields
  immuneResetPotential?: ImmuneResetPotential;
  targetSpecificity?: TargetSpecificity;
  diseaseSeverity?: DiseaseSeverity;
  treatmentGoal?: ImmunologyTreatmentGoal;
  // Metabolic-specific optional fields
  mechanismDifferentiation?: MechanismDifferentiation;
  weightLossEfficacy?: WeightLossEfficacy;
  routeOfAdministration?: RouteOfAdministration;
  comorbidityBreadth?: ComorbidityBreadth;
  metabolicTreatmentApproach?: MetabolicTreatmentApproach;
  // Cardiovascular-specific optional fields
  cvOutcomeBenefit?: CVOutcomeBenefit;
  cvTrialEndpoint?: CVTrialEndpoint;
  cvPopulationRisk?: CVPopulationRisk;
  // Infectious Disease-specific optional fields
  resistanceProfile?: ResistanceProfile;
  infectionChronicity?: InfectionChronicity;
  publicHealthPriority?: PublicHealthPriority;
  // Ophthalmology-specific optional fields
  ocularDelivery?: OcularDelivery;
  treatmentDurability?: TreatmentDurability;
  visionImpact?: VisionImpact;
  // Women's Health-specific optional fields
  whTargetPopulation?: WHTargetPopulation;
  whUnmetNeed?: WHUnmetNeed;
  whRegulatory?: WHRegulatory;
  // Rare Disease-specific optional fields
  orphanDesignation?: OrphanDesignation;
  patientPopulationSize?: PatientPopulationSize;
  geneticBasis?: GeneticBasis;
  // Hematology-specific optional fields
  hemeLineage?: HemeLineage;
  transplantEligibility?: TransplantEligibility;
  mrdStatus?: MRDStatus;
  // Dermatology-specific optional fields
  skinSeverity?: SkinSeverity;
  chronicityProfile?: ChronicityProfile;
  topicalVsSystemic?: TopicalVsSystemic;
  // Gastroenterology-specific optional fields
  giSegment?: GISegment;
  biologicExperience?: BiologicExperience;
  endoscopicEndpoint?: EndoscopicEndpoint;
}

// Drill-down data for expanded metric views
export interface MilestoneBreakdown {
  label: string;
  percentage: number;
  value: { low: number; median: number; high: number };
}

export interface FactorImpact {
  name: string;
  impact: 'positive' | 'negative' | 'neutral';
  percentage: number;
}

export interface DrillDownData {
  rangeExplanation: string;
  rangeWidthPercent: number;
  factors: FactorImpact[];
  breakdown?: MilestoneBreakdown[];
}

export interface DrillDownCollection {
  upfront: DrillDownData;
  totalDealValue: DrillDownData;
  devMilestones: DrillDownData;
  regMilestones: DrillDownData;
  commMilestones: DrillDownData;
  royalties: DrillDownData;
}

export interface CalculationResult {
  terms: DealTerms;
  tieredRoyalties: TieredRoyalties;
  dealRecommendation: DealRecommendation;
  negotiationInsight: string;
  modifiers: { name: string; multiplier: number; context?: string }[];
  labels: {
    phase: string;
    modality: string;
    indication: string;
  };
  drillDown: DrillDownCollection;
  phase: Phase;
  milestoneExplanation?: string;

  // Financial modeling results (populated for pro/report tier)
  financialModel?: {
    rnpv?: import('./financial/types').RNPVResult;
    monteCarlo?: import('./financial/types').MonteCarloResult;
    marketSize?: import('./financial/types').MarketSizeEstimate;
    fxSensitivity?: import('./financial/types').FXSensitivity;
    scenarios?: import('./financial/types').ScenarioResult[];
    defensiveAnalysis?: {
      worstCase: import('./financial/types').ScenarioResult;
      bestCase: import('./financial/types').ScenarioResult;
      defensiveFloor: number;
      walkAwayThreshold: number;
      narrative: string;
    };
    competitiveLandscape?: import('./financial/types').CompetitiveLandscape;
    dealFlowForecast?: import('./financial/types').DealFlowForecast;
  };
}

// Helper to get indication category
function getIndicationCategory(indication: Indication): 'solidTumor' | 'hematologic' | 'neurology' | 'immunology' | 'metabolic' | 'cardiovascular' | 'infectiousDisease' | 'ophthalmology' | 'womensHealth' | 'rareDisease' | 'hematology' | 'dermatology' | 'gastroenterology' {
  const solidTumors: SolidTumorIndication[] = [
    'lung_nsclc', 'lung_sclc', 'breast_her2', 'breast_tnbc', 'breast_hr',
    'colorectal', 'pancreatic', 'melanoma', 'prostate', 'ovarian',
    'gastric', 'liver', 'renal', 'gbm', 'bladder', 'headNeck',
    'cholangiocarcinoma', 'mesothelioma', 'sarcoma',
    'endometrial', 'cervical', 'thyroid', 'esophageal', 'smallBowel',
    'neuroendocrine', 'uvealMelanoma', 'testicular', 'adrenocortical',
    'nasopharyngeal', 'thymoma', 'penile', 'merkelCell',
    'neuroblastoma', 'retinoblastoma', 'osteosarcoma',
    'ewingSarcoma', 'rhabdomyosarcoma', 'vulvar'
  ];
  const neurologyIndications: NeurologyIndication[] = [
    'alzheimers', 'parkinsons', 'schizophrenia', 'depression',
    'als', 'huntingtons', 'migraine', 'narcolepsy',
    'pain', 'ms', 'epilepsy', 'tremor', 'tbi', 'addiction',
    'rareNeuro',
    'bipolar', 'ptsd', 'ocd',
    'autism', 'rett', 'friedreichs', 'dmd',
    'chronicPain',
    'sma', 'angelman', 'dravet', 'myotonicDystrophy',
    'peripheralNeuropathy', 'spinalCordInjury', 'tuberousSclerosis', 'cmt',
    'frontotemporal', 'lewyBody', 'adhd', 'fragileX',
    'cdkl5', 'neurofibromatosis', 'clusterHeadache', 'restlessLeg',
    'insomnia', 'stiffPerson', 'lgmd', 'fshd',
    'praderWilli', 'batten', 'gbs', 'ataxiaTelangiectasia'
  ];
  const immunologyIndications: ImmunologyIndication[] = [
    'rheumatoidArthritis', 'sle_lupus', 'lupusNephritis',
    'atopicderm', 'psoriasis', 'psoriaticArthritis',
    'ulcerativeColitis', 'crohns', 'ibd_broad',
    'myastheniaGravis', 'multipleSclerosisMod',
    'igan', 'aancaVasculitis',
    'systemicSclerosis', 'sjogrens',
    'alopecia', 'hidradenitis',
    'pnh', 'cidp',
    'rareAutoimmune',
    'celiac', 'vitiligo', 'pemphigus', 'itp',
    'asthma', 'eosinophilicEsophagitis',
    'gvhd', 'organTransplant',
    'thyroidEye', 'pbc',
    'ankylosingSpondylitis', 'giantCellArteritis', 'sarcoidosis',
    'autoImmuneHepatitis', 'psc', 'membranousNephropathy',
    'fsgs', 'uveitis', 'behcets', 'polymyalgiaRheumatica',
    'chronicUrticaria', 'heredAngioedema', 'epidermolysis',
    'foodAllergy', 'ipf', 'dermatomyositis', 'antiphospholipid',
    'egpa', 'systemicJIA', 'primaryImmunodeficiency',
    'coldAgglutinin', 'ttpAutoimmune', 'nephroticSyndrome', 'copd'
  ];
  const metabolicIndications: MetabolicIndication[] = [
    'obesity', 'type2Diabetes', 'nashMash',
    'metabolicSyndrome', 'lipodystrophy',
    'glycogenStorage', 'pku',
    'rareMetabolic',
    'type1Diabetes', 'ckdMetabolic',
    'hfpef', 'familialHypercholesterolemia',
    'gout', 'wilsonDisease', 'fabry', 'gaucher',
    'pompe', 'mpsDisorders', 'aatDeficiency', 'hyperoxaluria',
    'ureaCycleDisorders', 'asmd', 'cystinosis', 'galactosemia',
    'attrAmyloidosis', 'sickleCell', 'betaThalassemia',
    'hemophiliaA', 'hemophiliaB', 'cysticFibrosis',
    'acromegaly', 'cushings', 'congenitalAdrenalHyperplasia',
    'hypophosphatasia', 'porphyria', 'krabbe',
    'hemochromatosis', 'mitochondrialDisease', 'congenitalHyperinsulinism'
  ];
  const cardiovascularIndications: CardiovascularIndication[] = [
    'heartFailureHfref', 'atrialFibrillation', 'pulmonaryArterialHypertension',
    'coronaryArteryDisease', 'peripheralArteryDisease', 'aorticStenosis',
    'venousThromboembolism', 'resistantHypertension', 'dyslipidemia',
    'cardiomyopathy', 'myocarditis', 'cardiacArrhythmia', 'atherosclerosis',
    'attrCardiomyopathy', 'acuteCoronarySyndrome', 'stroke',
    'cardiacFibrosis', 'longQtSyndrome',
    'deepVeinThrombosis', 'pulmonaryEmbolism',
    'hypertrophicCardiomyopathy', 'dilatedCardiomyopathy', 'transthyretinCardiomyopathy',
    'supraventricularTachycardia', 'hyperlipidemiaFamilial', 'lipoproteinA',
    'heartFailureHfpef', 'mitralRegurgitation', 'aorticAneurysm'
  ];
  const infectiousDiseaseIndications: InfectiousDiseaseIndication[] = [
    'hivAids', 'hepatitisB', 'rsv', 'influenza', 'tuberculosis',
    'fungalInfections', 'amrBacterial', 'covid', 'hepatitisD',
    'cmvInfection', 'clostridioides', 'dengueMalaria',
    'hepatitisC', 'ebv', 'norovirus', 'mpox', 'zika', 'lymeDisease',
    'malaria', 'dengue', 'candidaInvasive', 'aspergillosisInvasive',
    'meningococcal', 'pneumococcal', 'chikungunya',
    'respiratorySyncytialVirusPediatric', 'hmpv', 'gonorrhea', 'syphilis'
  ];
  const ophthalmologyIndications: OphthalmologyIndication[] = [
    'wetAmd', 'dryAmdGA', 'diabeticRetinopathy', 'diabeticMacularEdema',
    'glaucoma', 'dryEyeDisease', 'retinitisPigmentosa', 'uveiticMacular',
    'retinalVeinOcclusion', 'stargardt', 'myopiaProgression',
    'keratoconus', 'presbyopia', 'cornealDystrophy', 'opticNeuritis', 'achromatopsia',
    'stargardtDisease', 'xLinkedRetinoschisis', 'leberCongenitalAmaurosis',
    'choroideremia', 'uveitisNonInfectious', 'fuchsDystrophy',
    'cornealNeovascularization', 'meibomianGlandDysfunction', 'allergicConjunctivitis',
    'proliferativeDiabeticRetinopathy'
  ];
  const womensHealthIndications: WomensHealthIndication[] = [
    'endometriosis', 'uterineFibroids', 'pcos', 'menopause',
    'postpartumDepression', 'preeclampsia', 'prematureLabor',
    'fertilityArt', 'vulvodynia', 'cervicalDysplasia',
    'contraceptionNovel', 'breastCancerPrevention',
    'vaginalAtrophy', 'gestationalDiabetes', 'hyperemesisGravidarum',
    'placentaAccreta', 'menstrualDisorders', 'ovarianCancerScreening',
    'polycysticOvarySyndrome', 'prematureOvarianInsufficiency', 'vulvovaginalAtrophy',
    'preterm', 'postpartumHemorrhage',
    'ovarian', 'uterineCorpus', 'endometrialHyperplasia',
    'menorrhagia', 'dysmenorrhea'
  ];
  if (solidTumors.includes(indication as SolidTumorIndication)) return 'solidTumor';
  if (neurologyIndications.includes(indication as NeurologyIndication)) return 'neurology';
  if (immunologyIndications.includes(indication as ImmunologyIndication)) return 'immunology';
  if (metabolicIndications.includes(indication as MetabolicIndication)) return 'metabolic';
  if (cardiovascularIndications.includes(indication as CardiovascularIndication)) return 'cardiovascular';
  if (infectiousDiseaseIndications.includes(indication as InfectiousDiseaseIndication)) return 'infectiousDisease';
  if (ophthalmologyIndications.includes(indication as OphthalmologyIndication)) return 'ophthalmology';
  if (womensHealthIndications.includes(indication as WomensHealthIndication)) return 'womensHealth';
  const rareDiseaseIndications: RareDiseaseIndication[] = [
    'spinalMuscularAtrophy', 'duchenneMD', 'cysticFibrosis', 'fabryDisease',
    'gaucherDisease', 'pompeDisease', 'huntingtonDisease', 'pku',
    'hemophiliaA', 'hemophiliaB', 'sickleCell', 'betaThalassemia',
    'rareNeuro', 'angelman',
    'mucopolysaccharidosis', 'niemannPickC', 'neuronalCeroidLipofuscinosis',
    'fragileX', 'tuberousSclerosis', 'dravetSyndrome', 'praderWilli',
    'marfanSyndrome', 'ehlersDanlos', 'wilsonDisease',
    'alpha1Antitrypsin', 'cystinosis', 'methylmalonicAcidemia',
    'propionicAcidemia', 'ornithineTranscarbamylaseDeficiency', 'xlh',
    'hereditaryAngioedema'
  ];
  if ((rareDiseaseIndications as string[]).includes(indication)) return 'rareDisease';
  const hematologyIndications: HematologyIndication[] = [
    'dlbcl', 'follicularLymphoma', 'mantleCellLymphoma', 'cll', 'myeloma',
    'aml', 'mds', 'all', 'hodgkinLymphoma', 'waldenstroms',
    'polycythemiaVera', 'myelofibrosis', 'itp', 'ttp', 'aplasticAnemia',
    'chronicMyeloidLeukemia', 'hairyCellLeukemia', 'marginalZoneLymphoma',
    'burkittLymphoma', 'primaryCnsLymphoma', 'peripheralTCellLymphoma',
    'cutaneousTCellLymphoma', 'richtersTransformation', 'bpdcn',
    'mastocytosis', 'myeloproliferativeNeoplasm', 'thalassemiaTransfusionDependent',
    'vonWillebrand', 'thrombocytopeniaChemotherapy', 'hemolyticAnemia',
    'paroxysomalNocturnalHemoglobinuria'
  ];
  if ((hematologyIndications as string[]).includes(indication)) return 'hematology';
  const dermatologyIndications: DermatologyIndication[] = [
    'atopicDermatitis', 'psoriasis', 'psoriaticArthritis', 'hidradenitisSuppurativa',
    'vitiligo', 'alopeciaAreata', 'chronicUrticaria', 'prurigo',
    'contactDermatitis', 'acne', 'rosacea', 'pemphigus',
    'morphea', 'lichenPlanus', 'seborrheicDermatitis', 'melasma',
    'palmoplantarPustulosis', 'nailPsoriasis', 'scalpPsoriasis',
    'chronicHandEczema', 'bullousPemphigoid', 'epidermolysis',
    'ichthyosis', 'hyperhidrosis', 'keloid', 'basalCellCarcinoma',
    'squamousCellSkin', 'cutaneousMelanoma'
  ];
  if ((dermatologyIndications as string[]).includes(indication)) return 'dermatology';
  const gastroenterologyIndications: GastroenterologyIndication[] = [
    'crohnsDisease', 'ulcerativeColitis', 'eosinophilicEsophagitis', 'celiacDisease',
    'ibsD', 'ibsC', 'refractoryGerd', 'shortBowelSyndrome',
    'primaryBiliaryCholangitis', 'cdi', 'giGvhd', 'pouchitis',
    'microscopicColitis', 'diverticulitis', 'gastroparesis', 'achalasia',
    'barrettsEsophagus', 'pancreaticInsufficiency', 'autoimmunePancreatitis',
    'nonAlcoholicSteatohepatitis', 'hepaticEncephalopathy', 'irritableBowelGeneral',
    'functionalDyspepsia', 'smallIntestinalBacterialOvergrowth', 'radiationProctitis',
    'perianalFistula', 'intestinalFailure', 'colorectalPolyps'
  ];
  if ((gastroenterologyIndications as string[]).includes(indication)) return 'gastroenterology';
  return 'hematologic';
}

// Calculate risk score (0-100, higher = more risk)
// Adaptive to therapeutic area — each TA has distinct risk drivers
export function calculateRiskScore(input: CalculationInput): number {
  let score = 0;

  // Phase risk (earlier = more risk)
  const phaseRisk: Record<Phase, number> = {
    discovery: 45,
    preclinical: 40,
    phase1: 30,
    phase1_2: 25,
    phase2: 20,
    phase2_3: 15,
    phase3: 10,
    nda_filed: 5,
    approved: 0
  };
  score += phaseRisk[input.phase];

  // Competitive position risk
  const competitiveRisk: Record<CompetitivePosition, number> = {
    firstInClass: 0,
    firstToPivotal: 5,
    bestInClass: 10,
    racing: 20,
    behind: 30,
    crowded: 40
  };
  score += competitiveRisk[input.competitivePosition];

  // Data quality risk
  const dataRisk: Record<DataQuality, number> = {
    pivotalReady: 0,
    strongPhase2: 5,
    promising: 10,
    mixed: 15,
    limited: 20
  };
  score += dataRisk[input.dataQuality];

  // Therapeutic-area-specific risk adjustments (up to ±15 points)
  score += getTherapeuticAreaRiskAdjustment(input);

  return Math.max(0, Math.min(score, 100));
}

/** TA-specific risk adjustment — reflects unique risk profiles of each therapeutic area */
function getTherapeuticAreaRiskAdjustment(input: CalculationInput): number {
  let adj = 0;
  const ta = input.therapeuticArea;

  if (ta === 'oncology') {
    // Oncology: competitive intensity + line of therapy + combination potential
    if (input.lineOfTherapy === '1L') adj += 8; // 1L requires large OS/PFS trials
    else if (input.lineOfTherapy === '3L+') adj -= 3; // accelerated approval potential
    if (input.combinationPotential === 'strong') adj -= 4; // expands addressable market
    else if (input.combinationPotential === 'standalone') adj += 4;
    // Novel modalities in oncology carry manufacturing risk
    if (['carT_solid', 'radiopharmaceutical', 'oncolyticVirus'].includes(input.modality)) adj += 5;
  } else if (ta === 'neurology') {
    // Neurology: BBB penetration + disease modification complexity + long trials
    if (input.treatmentApproach === 'diseaseModifying') adj += 10; // 18-36 month trials, unvalidated endpoints
    else if (input.treatmentApproach === 'symptomatic') adj -= 3; // well-established endpoints
    if (input.bbbPenetration === 'unproven') adj += 5; // delivery uncertainty
    else if (input.bbbPenetration === 'provenCNS') adj -= 3;
    if (['geneTherapy', 'aso', 'bbbPlatform'].includes(input.modality)) adj += 4; // novel CNS delivery
  } else if (ta === 'immunology') {
    // Immunology: immune reset risk + target breadth + safety monitoring
    if (input.immuneResetPotential === 'curativeIntent') adj += 8; // high reward but high risk
    else if (input.immuneResetPotential === 'chronicTreatment') adj -= 3; // predictable profile
    if (input.targetSpecificity === 'broadImmunosuppression') adj += 6; // safety concerns
    else if (input.targetSpecificity === 'antigenSpecific') adj -= 2;
    if (['carT_autoimmune', 'inVivoCarT', 'carTreg'].includes(input.modality)) adj += 5;
  } else if (ta === 'metabolic') {
    // Metabolic: CVOT requirements + competition in GLP-1 space + weight loss endpoints
    if (['glp1Agonist', 'dualIncretin', 'tripleIncretin'].includes(input.modality)) adj += 6; // Lilly/Novo dominance
    if (input.metabolicTreatmentApproach === 'metabolicReset') adj += 3; // novel, less validated
    if (input.weightLossEfficacy === 'superiorEfficacy') adj -= 4; // strong differentiation
    if (input.comorbidityBreadth === 'cardiometabolicBenefit') adj -= 3; // broad label potential
    else if (input.comorbidityBreadth === 'obesityPrimary') adj += 2;
  } else if (ta === 'cardiovascular') {
    // CV: large CVOT trial requirements + outcome endpoint complexity
    if (input.cvOutcomeBenefit === 'mortalityReduction') adj += 8; // massive CVOT trials needed
    else if (input.cvOutcomeBenefit === 'symptomImprovement') adj -= 2; // faster/smaller trials
    if (input.cvTrialEndpoint === 'maceEndpoint') adj += 5; // 10K+ patients, 3-5 years
    else if (input.cvTrialEndpoint === 'surrogateBiomarker') adj -= 2;
  } else if (ta === 'infectiousDisease') {
    // ID: resistance dynamics + pandemic preparedness + market size uncertainty
    if (input.resistanceProfile === 'broadSpectrum') adj += 5; // generic competition
    else if (input.resistanceProfile === 'novelTarget') adj -= 4; // pull incentives available
    if (input.infectionChronicity === 'acute') adj += 3; // limited per-patient revenue
    else if (input.infectionChronicity === 'chronic') adj -= 3; // recurring revenue, large pools
  } else if (ta === 'ophthalmology') {
    // Ophthalmology: delivery complexity + anti-VEGF competition + durability demands
    if (input.ocularDelivery === 'oral') adj += 6; // bioavailability challenges
    else if (input.ocularDelivery === 'implant') adj -= 4; // strong differentiation
    if (input.treatmentDurability === 'chronicInjection') adj += 3; // biosimilar pressure
    else if (input.treatmentDurability === 'oneTime') adj -= 4; // gene therapy premium
  } else if (ta === 'womensHealth') {
    // Women's Health: pregnancy complexity + regulatory hurdles + unmet need
    if (input.whRegulatory === 'pregnancyComplexity') adj += 8; // teratogenicity studies, REMS
    else if (input.whRegulatory === 'acceleratedPathway') adj -= 4;
    if (input.whUnmetNeed === 'noApprovedTherapy') adj -= 5; // breakthrough potential
    else if (input.whUnmetNeed === 'wellServed') adj += 3;
  } else if (ta === 'rareDisease') {
    // Orphan designation premium
    if (input.orphanDesignation === 'both_orphan') adj -= 5;
    else if (input.orphanDesignation === 'fda_orphan' || input.orphanDesignation === 'ema_orphan') adj -= 3;
    // Ultra-rare commands higher value but higher risk
    if (input.patientPopulationSize === 'ultraRare_sub1k') adj += 8;
    else if (input.patientPopulationSize === 'rare_1k_10k') adj += 4;
    // Gene therapy one-time cures carry manufacturing/durability risk
    if (input.modality === 'geneTherapyRare' || input.modality === 'geneTherapy') adj += 6;
    // Validated genetic target de-risks
    if (input.geneticBasis === 'monogenic_validated') adj -= 5;
  } else if (ta === 'hematology') {
    // CAR-T/bispecific complexity
    if (input.modality === 'carT_heme' || input.modality === 'carT_solid') adj += 6;
    if (input.modality === 'bispecificHeme' || input.modality === 'bispecific') adj += 3;
    // MRD endpoints are newer, less validated
    if (input.mrdStatus === 'mrd_endpoint') adj += 4;
    // Transplant-ineligible = larger population, competitive
    if (input.transplantEligibility === 'transplant_ineligible') adj -= 2;
    // Myeloid malignancies harder to treat
    if (input.hemeLineage === 'myeloid') adj += 5;
  } else if (ta === 'dermatology') {
    // Severe/refractory = higher unmet need
    if (input.skinSeverity === 'severe' || input.skinSeverity === 'refractory_derm') adj -= 3;
    // Chronic relapsing = sustained revenue
    if (input.chronicityProfile === 'chronic_relapsing') adj -= 2;
    // Topical-only = lower development cost/risk
    if (input.topicalVsSystemic === 'topical_only') adj -= 4;
    else if (input.topicalVsSystemic === 'systemic_only') adj += 3;
    // JAK inhibitor safety concerns
    if (input.modality === 'jakInhibitorDerm') adj += 4;
  } else if (ta === 'gastroenterology') {
    // Endoscopic remission endpoints = gold standard
    if (input.endoscopicEndpoint === 'endoscopic_remission') adj -= 3;
    // Biologic-experienced patients = harder to treat
    if (input.biologicExperience === 'multi_biologic_exposed') adj += 5;
    else if (input.biologicExperience === 'biologic_naive') adj -= 2;
    // Novel mechanisms (anti-TL1A) = premium but risk
    if (input.modality === 'antiTl1a') adj += 4;
    // S1P modulators = oral convenience but safety monitoring
    if (input.modality === 's1pModulator') adj += 2;
  }

  return adj;
}

// Get negotiation insight based on inputs
function getNegotiationInsight(input: CalculationInput): string {
  const insights = benchmarks.marketContext.negotiationInsights;
  const isNeurology = input.therapeuticArea === 'neurology';
  const isImmunology = input.therapeuticArea === 'immunology';
  const isMetabolic = input.therapeuticArea === 'metabolic';
  const isRareDisease = input.therapeuticArea === 'rareDisease';
  const isHematology = input.therapeuticArea === 'hematology';
  const isDermatology = input.therapeuticArea === 'dermatology';
  const isGastroenterology = input.therapeuticArea === 'gastroenterology';

  // For rare disease, check TA-specific insights first
  if (isRareDisease) {
    const rdModalityInsights = (insights as Record<string, Record<string, string>>).rareDiseaseModality;
    if (rdModalityInsights?.[input.modality]) {
      return rdModalityInsights[input.modality];
    }
    const rdIndicationInsights = (insights as Record<string, Record<string, string>>).rareDiseaseIndication;
    if (rdIndicationInsights?.[input.indication]) {
      return rdIndicationInsights[input.indication];
    }
  }

  // For hematology, check TA-specific insights first
  if (isHematology) {
    const hemeModalityInsights = (insights as Record<string, Record<string, string>>).hematologyModality;
    if (hemeModalityInsights?.[input.modality]) {
      return hemeModalityInsights[input.modality];
    }
    const hemeIndicationInsights = (insights as Record<string, Record<string, string>>).hematologyIndication;
    if (hemeIndicationInsights?.[input.indication]) {
      return hemeIndicationInsights[input.indication];
    }
  }

  // For dermatology, check TA-specific insights first
  if (isDermatology) {
    const dermModalityInsights = (insights as Record<string, Record<string, string>>).dermatologyModality;
    if (dermModalityInsights?.[input.modality]) {
      return dermModalityInsights[input.modality];
    }
    const dermIndicationInsights = (insights as Record<string, Record<string, string>>).dermatologyIndication;
    if (dermIndicationInsights?.[input.indication]) {
      return dermIndicationInsights[input.indication];
    }
  }

  // For gastroenterology, check TA-specific insights first
  if (isGastroenterology) {
    const giModalityInsights = (insights as Record<string, Record<string, string>>).gastroenterologyModality;
    if (giModalityInsights?.[input.modality]) {
      return giModalityInsights[input.modality];
    }
    const giIndicationInsights = (insights as Record<string, Record<string, string>>).gastroenterologyIndication;
    if (giIndicationInsights?.[input.indication]) {
      return giIndicationInsights[input.indication];
    }
  }

  // For metabolic, check metabolic-specific insights first
  if (isMetabolic) {
    const metModalityInsights = (insights as Record<string, Record<string, string>>).metabolicModality;
    if (metModalityInsights?.[input.modality]) {
      return metModalityInsights[input.modality];
    }
    const metIndicationInsights = (insights as Record<string, Record<string, string>>).metabolicIndication;
    if (metIndicationInsights?.[input.indication]) {
      return metIndicationInsights[input.indication];
    }
    const mechInsights = (insights as Record<string, Record<string, string>>).mechanismDifferentiation;
    if (input.mechanismDifferentiation && mechInsights?.[input.mechanismDifferentiation]) {
      return mechInsights[input.mechanismDifferentiation];
    }
    const routeInsights = (insights as Record<string, Record<string, string>>).routeOfAdministration;
    if (input.routeOfAdministration && routeInsights?.[input.routeOfAdministration]) {
      return routeInsights[input.routeOfAdministration];
    }
  }

  // For immunology, check immunology-specific insights first
  if (isImmunology) {
    const immunoModalityInsights = (insights as Record<string, Record<string, string>>).immunologyModality;
    if (immunoModalityInsights?.[input.modality]) {
      return immunoModalityInsights[input.modality];
    }
    const immunoIndicationInsights = (insights as Record<string, Record<string, string>>).immunologyIndication;
    if (immunoIndicationInsights?.[input.indication]) {
      return immunoIndicationInsights[input.indication];
    }
    const irInsights = (insights as Record<string, Record<string, string>>).immuneResetPotential;
    if (input.immuneResetPotential && irInsights?.[input.immuneResetPotential]) {
      return irInsights[input.immuneResetPotential];
    }
    const tsInsights = (insights as Record<string, Record<string, string>>).targetSpecificity;
    if (input.targetSpecificity && tsInsights?.[input.targetSpecificity]) {
      return tsInsights[input.targetSpecificity];
    }
  }

  // For neurology, check neurology-specific insights first
  if (isNeurology) {
    const neuroModalityInsights = (insights as Record<string, Record<string, string>>).neurologyModality;
    if (neuroModalityInsights?.[input.modality]) {
      return neuroModalityInsights[input.modality];
    }
    const neuroIndicationInsights = (insights as Record<string, Record<string, string>>).neurologyIndication;
    if (neuroIndicationInsights?.[input.indication]) {
      return neuroIndicationInsights[input.indication];
    }
    const taInsights = (insights as Record<string, Record<string, string>>).treatmentApproach;
    if (taInsights?.[input.treatmentApproach]) {
      return taInsights[input.treatmentApproach];
    }
  }

  // Priority order: modality > line of therapy > competitive > territory > data quality

  // Modality insights
  const modalityInsights = insights.modality as Record<string, string>;
  if (modalityInsights[input.modality]) {
    return modalityInsights[input.modality];
  }

  // Line of therapy insights (oncology only)
  const lotInsights = insights.lineOfTherapy as Record<string, string>;
  if (!isNeurology && !isImmunology && !isMetabolic && !isRareDisease && !isHematology && !isDermatology && !isGastroenterology && lotInsights[input.lineOfTherapy]) {
    return lotInsights[input.lineOfTherapy];
  }

  // Competitive position insights
  const compInsights = insights.competitivePosition as Record<string, string>;
  if (compInsights[input.competitivePosition]) {
    return compInsights[input.competitivePosition];
  }

  // Territory insights
  const territoryInsights = insights.territory as Record<string, string>;
  if (input.territory === 'china' && territoryInsights.china) {
    return territoryInsights.china;
  }
  if (input.territory === 'europe' && territoryInsights.europe) {
    return territoryInsights.europe;
  }

  // Data quality insights
  const dataInsights = insights.dataQuality as Record<string, string>;
  if (dataInsights[input.dataQuality]) {
    return dataInsights[input.dataQuality];
  }

  // Default insight
  return "Consider recent comparable deals in your negotiation strategy.";
}

/** Clamp a multiplier to a safe range. Returns fallback if NaN, Infinity, or non-positive. */
function safeMultiplier(value: number, fallback: number = 1.0): number {
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return value;
}

/** Scrub a {low, median, high} range so no NaN/Infinity leaks to the frontend. */
function sanitizeRange(r: { low: number; median: number; high: number }): { low: number; median: number; high: number } {
  return {
    low: Number.isFinite(r.low) ? r.low : 0,
    median: Number.isFinite(r.median) ? r.median : 0,
    high: Number.isFinite(r.high) ? r.high : 0,
  };
}

/** Scrub a {low, high} range for royalties. */
function sanitizeRoyaltyRange(r: { low: number; high: number }): { low: number; high: number } {
  return {
    low: Number.isFinite(r.low) ? r.low : 0,
    high: Number.isFinite(r.high) ? r.high : 0,
  };
}

export function calculateDealTerms(input: CalculationInput): CalculationResult {
  const modifiers: { name: string; multiplier: number; context?: string }[] = [];
  const isNeurology = input.therapeuticArea === 'neurology';
  const isImmunology = input.therapeuticArea === 'immunology';
  const isMetabolic = input.therapeuticArea === 'metabolic';
  const isCardiovascular = input.therapeuticArea === 'cardiovascular';
  const isInfectiousDisease = input.therapeuticArea === 'infectiousDisease';
  const isOphthalmology = input.therapeuticArea === 'ophthalmology';
  const isWomensHealth = input.therapeuticArea === 'womensHealth';
  const isRareDisease = input.therapeuticArea === 'rareDisease';
  const isHematology = input.therapeuticArea === 'hematology';
  const isDermatology = input.therapeuticArea === 'dermatology';
  const isGastroenterology = input.therapeuticArea === 'gastroenterology';

  // Get phase baselines per therapeutic area
  const phaseBaselineMap: Record<string, any> = {
    oncology: benchmarks.phaseBaselines,
    metabolic: benchmarks.metabolicPhaseBaselines,
    immunology: benchmarks.immunologyPhaseBaselines,
    neurology: benchmarks.neurologyPhaseBaselines,
    cardiovascular: benchmarks.cardiovascularPhaseBaselines,
    infectiousDisease: benchmarks.infectiousDiseasePhaseBaselines,
    ophthalmology: benchmarks.ophthalmologyPhaseBaselines,
    womensHealth: benchmarks.womensHealthPhaseBaselines,
    rareDisease: benchmarks.rareDiseasePhaseBaselines,
    hematology: benchmarks.hematologyPhaseBaselines,
    dermatology: benchmarks.dermatologyPhaseBaselines,
    gastroenterology: benchmarks.gastroenterologyPhaseBaselines,
  };
  const phaseBaseline = (phaseBaselineMap[input.therapeuticArea] || benchmarks.phaseBaselines)[input.phase];

  const phaseConfigMap: Record<string, any> = {
    metabolic: benchmarks.metabolicPhaseConfig,
    immunology: benchmarks.immunologyPhaseConfig,
    neurology: benchmarks.neurologyPhaseConfig,
    cardiovascular: benchmarks.cardiovascularPhaseConfig,
    infectiousDisease: benchmarks.infectiousDiseasePhaseConfig,
    ophthalmology: benchmarks.ophthalmologyPhaseConfig,
    womensHealth: benchmarks.womensHealthPhaseConfig,
    rareDisease: benchmarks.rareDiseasePhaseConfig,
    hematology: benchmarks.hematologyPhaseConfig,
    dermatology: benchmarks.dermatologyPhaseConfig,
    gastroenterology: benchmarks.gastroenterologyPhaseConfig,
  };
  const phaseConfig = phaseConfigMap[input.therapeuticArea] || benchmarks.phaseConfig;

  // Get multipliers from benchmarks
  const modalityData = benchmarks.modalities[input.modality];
  const modalityMultiplier = modalityData?.multiplier ?? 1.0;
  modifiers.push({ name: modalityData?.label ?? input.modality, multiplier: modalityMultiplier, context: modalityData?.context });

  // Get indication multiplier
  const category = getIndicationCategory(input.indication);
  const indicationsCategory = benchmarks.indications[category];
  const indicationData = indicationsCategory[input.indication];
  const indicationMultiplier = indicationData?.multiplier ?? 1.0;
  modifiers.push({ name: indicationData?.label ?? input.indication, multiplier: indicationMultiplier, context: indicationData?.context });

  // Get territory multiplier
  const territoryData = benchmarks.territories[input.territory];
  const territoryMultiplier = territoryData?.multiplier ?? 1.0;
  modifiers.push({ name: territoryData?.label ?? input.territory, multiplier: territoryMultiplier, context: territoryData?.context });

  // Get biomarker multiplier
  const biomarkerData = benchmarks.multiplierConfig.biomarker[input.biomarker];
  const biomarkerMultiplier = biomarkerData?.multiplier ?? 1.0;
  if (biomarkerMultiplier !== 1.0) {
    modifiers.push({ name: biomarkerData?.label ?? input.biomarker, multiplier: biomarkerMultiplier, context: biomarkerData?.context });
  }

  // Get line of therapy / treatment approach / treatment goal multiplier (depends on therapeutic area)
  let lotMultiplier = 1.0;
  if (isImmunology) {
    const mc = benchmarks.multiplierConfig;
    const tgKey = input.treatmentGoal || 'remissionInduction';
    const tgData = mc.treatmentGoal?.[tgKey];
    lotMultiplier = tgData?.multiplier ?? 1.0;
    if (lotMultiplier !== 1.0) {
      modifiers.push({ name: tgData?.label ?? tgKey, multiplier: lotMultiplier, context: tgData?.context });
    }
  } else if (isMetabolic) {
    const mc = benchmarks.multiplierConfig;
    const mtaKey = input.metabolicTreatmentApproach || 'chronicWeightMgmt';
    const mtaData = mc.metabolicTreatmentApproach?.[mtaKey];
    lotMultiplier = mtaData?.multiplier ?? 1.0;
    if (lotMultiplier !== 1.0) {
      modifiers.push({ name: mtaData?.label ?? mtaKey, multiplier: lotMultiplier, context: mtaData?.context });
    }
  } else if (isNeurology) {
    const taData = benchmarks.multiplierConfig.treatmentApproach[input.treatmentApproach];
    lotMultiplier = taData?.multiplier ?? 1.0;
    if (lotMultiplier !== 1.0) {
      modifiers.push({ name: taData?.label ?? input.treatmentApproach, multiplier: lotMultiplier, context: taData?.context });
    }
  } else if (isCardiovascular) {
    const mc = benchmarks.multiplierConfig;
    const cvKey = input.cvOutcomeBenefit || 'hospitalizationReduction';
    const cvData = mc.cvOutcomeBenefit?.[cvKey];
    lotMultiplier = cvData?.multiplier ?? 1.0;
    if (lotMultiplier !== 1.0) {
      modifiers.push({ name: cvData?.label ?? cvKey, multiplier: lotMultiplier, context: cvData?.context });
    }
  } else if (isInfectiousDisease) {
    const mc = benchmarks.multiplierConfig;
    const icKey = input.infectionChronicity || 'chronic';
    const icData = mc.infectionChronicity?.[icKey];
    lotMultiplier = icData?.multiplier ?? 1.0;
    if (lotMultiplier !== 1.0) {
      modifiers.push({ name: icData?.label ?? icKey, multiplier: lotMultiplier, context: icData?.context });
    }
  } else if (isOphthalmology) {
    const mc = benchmarks.multiplierConfig;
    const viKey = input.visionImpact || 'visionImpairing';
    const viData = mc.visionImpact?.[viKey];
    lotMultiplier = viData?.multiplier ?? 1.0;
    if (lotMultiplier !== 1.0) {
      modifiers.push({ name: viData?.label ?? viKey, multiplier: lotMultiplier, context: viData?.context });
    }
  } else if (isWomensHealth) {
    const mc = benchmarks.multiplierConfig;
    const whKey = input.whUnmetNeed || 'inadequateOptions';
    const whData = mc.whUnmetNeed?.[whKey];
    lotMultiplier = whData?.multiplier ?? 1.0;
    if (lotMultiplier !== 1.0) {
      modifiers.push({ name: whData?.label ?? whKey, multiplier: lotMultiplier, context: whData?.context });
    }
  } else {
    const lotData = benchmarks.multiplierConfig.lineOfTherapy[input.lineOfTherapy];
    lotMultiplier = lotData?.multiplier ?? 1.0;
    if (lotMultiplier !== 1.0) {
      modifiers.push({ name: lotData?.label ?? input.lineOfTherapy, multiplier: lotMultiplier, context: lotData?.context });
    }
  }

  // Get combination potential multiplier
  const comboData = benchmarks.multiplierConfig.combinationPotential[input.combinationPotential];
  const comboMultiplier = comboData?.multiplier ?? 1.0;
  if (comboMultiplier !== 1.0) {
    modifiers.push({ name: comboData?.label ?? input.combinationPotential, multiplier: comboMultiplier, context: comboData?.context });
  }

  // Get competitive position multiplier
  const compData = benchmarks.multiplierConfig.competitivePosition[input.competitivePosition];
  const competitiveMultiplier = compData?.multiplier ?? 1.0;
  if (competitiveMultiplier !== 1.0) {
    modifiers.push({ name: compData?.label ?? input.competitivePosition, multiplier: competitiveMultiplier, context: compData?.context });
  }

  // Get data quality multiplier
  const dataData = benchmarks.multiplierConfig.dataQuality[input.dataQuality];
  const dataQualityMultiplier = dataData?.multiplier ?? 1.0;
  if (dataQualityMultiplier !== 1.0) {
    modifiers.push({ name: dataData?.label ?? input.dataQuality, multiplier: dataQualityMultiplier, context: dataData?.context });
  }

  // Calculate regulatory bonus (additive, capped at 20%)
  const regConfig = benchmarks.multiplierConfig.regulatoryDesignations;
  let regulatoryBonus = 0;
  if (input.regulatoryDesignations.breakthrough) {
    regulatoryBonus += regConfig.breakthrough.bonus;
    modifiers.push({ name: regConfig.breakthrough.label, multiplier: 1 + regConfig.breakthrough.bonus });
  }
  if (input.regulatoryDesignations.fastTrack) {
    regulatoryBonus += regConfig.fastTrack.bonus;
    modifiers.push({ name: regConfig.fastTrack.label, multiplier: 1 + regConfig.fastTrack.bonus });
  }
  if (input.regulatoryDesignations.orphan) {
    regulatoryBonus += regConfig.orphan.bonus;
    modifiers.push({ name: regConfig.orphan.label, multiplier: 1 + regConfig.orphan.bonus });
  }
  if (input.regulatoryDesignations.prime) {
    regulatoryBonus += regConfig.prime.bonus;
    modifiers.push({ name: regConfig.prime.label, multiplier: 1 + regConfig.prime.bonus });
  }
  regulatoryBonus = Math.min(regulatoryBonus, regConfig.maxBonus);

  // Look up modality × indication interaction bonus (all therapeutic areas)
  let interactionBonus = 0;
  {
    const interactionTerms = benchmarks.interactionTerms || {};
    const key = `${input.modality}+${input.indication}`;
    if (interactionTerms[key]) {
      interactionBonus = interactionTerms[key].bonus;
      modifiers.push({
        name: `${modalityData?.label ?? input.modality} × ${indicationData?.label ?? input.indication} synergy`,
        multiplier: 1 + interactionBonus,
        context: interactionTerms[key].context
      });
    }
  }

  // Get neurology-specific multipliers (BBB, disease progression, biomarker validation)
  let bbbMultiplier = 1.0;
  let diseaseProgMultiplier = 1.0;
  let biomarkerValMultiplier = 1.0;
  if (isNeurology) {
    const mc = benchmarks.multiplierConfig;

    const bbbKey = input.bbbPenetration || 'unproven';
    const bbbData = mc.bbbPenetration?.[bbbKey];
    bbbMultiplier = bbbData?.multiplier ?? 1.0;
    if (bbbMultiplier !== 1.0) {
      modifiers.push({ name: bbbData?.label ?? bbbKey, multiplier: bbbMultiplier, context: bbbData?.context });
    }

    const dpKey = input.diseaseProgression || 'moderateProgressive';
    const dpData = mc.diseaseProgression?.[dpKey];
    diseaseProgMultiplier = dpData?.multiplier ?? 1.0;
    if (diseaseProgMultiplier !== 1.0) {
      modifiers.push({ name: dpData?.label ?? dpKey, multiplier: diseaseProgMultiplier, context: dpData?.context });
    }

    const bvKey = input.biomarkerValidation || 'noBiomarker';
    const bvData = mc.biomarkerValidation?.[bvKey];
    biomarkerValMultiplier = bvData?.multiplier ?? 1.0;
    if (biomarkerValMultiplier !== 1.0) {
      modifiers.push({ name: bvData?.label ?? bvKey, multiplier: biomarkerValMultiplier, context: bvData?.context });
    }
  }

  // Get immunology-specific multipliers
  let immuneResetMultiplier = 1.0;
  let targetSpecMultiplier = 1.0;
  let diseaseSevMultiplier = 1.0;
  if (isImmunology) {
    const mc = benchmarks.multiplierConfig;

    const irKey = input.immuneResetPotential || 'chronicTreatment';
    const irData = mc.immuneResetPotential?.[irKey];
    immuneResetMultiplier = irData?.multiplier ?? 1.0;
    if (immuneResetMultiplier !== 1.0) {
      modifiers.push({ name: irData?.label ?? irKey, multiplier: immuneResetMultiplier, context: irData?.context });
    }

    const tsKey = input.targetSpecificity || 'pathwayTargeted';
    const tsData = mc.targetSpecificity?.[tsKey];
    targetSpecMultiplier = tsData?.multiplier ?? 1.0;
    if (targetSpecMultiplier !== 1.0) {
      modifiers.push({ name: tsData?.label ?? tsKey, multiplier: targetSpecMultiplier, context: tsData?.context });
    }

    const dsKey = input.diseaseSeverity || 'moderateSevere';
    const dsData = mc.diseaseSeverity?.[dsKey];
    diseaseSevMultiplier = dsData?.multiplier ?? 1.0;
    if (diseaseSevMultiplier !== 1.0) {
      modifiers.push({ name: dsData?.label ?? dsKey, multiplier: diseaseSevMultiplier, context: dsData?.context });
    }
  }

  // Get metabolic-specific multipliers
  let mechDiffMultiplier = 1.0;
  let weightLossMultiplier = 1.0;
  let routeMultiplier = 1.0;
  let comorbidityMultiplier = 1.0;
  if (isMetabolic) {
    const mc = benchmarks.multiplierConfig;

    const mdKey = input.mechanismDifferentiation || 'incretinBased';
    const mdData = mc.mechanismDifferentiation?.[mdKey];
    mechDiffMultiplier = mdData?.multiplier ?? 1.0;
    if (mechDiffMultiplier !== 1.0) {
      modifiers.push({ name: mdData?.label ?? mdKey, multiplier: mechDiffMultiplier, context: mdData?.context });
    }

    const wlKey = input.weightLossEfficacy || 'competitiveEfficacy';
    const wlData = mc.weightLossEfficacy?.[wlKey];
    weightLossMultiplier = wlData?.multiplier ?? 1.0;
    if (weightLossMultiplier !== 1.0) {
      modifiers.push({ name: wlData?.label ?? wlKey, multiplier: weightLossMultiplier, context: wlData?.context });
    }

    const roaKey = input.routeOfAdministration || 'injectable';
    const roaData = mc.routeOfAdministration?.[roaKey];
    routeMultiplier = roaData?.multiplier ?? 1.0;
    if (routeMultiplier !== 1.0) {
      modifiers.push({ name: roaData?.label ?? roaKey, multiplier: routeMultiplier, context: roaData?.context });
    }

    const cbKey = input.comorbidityBreadth || 'obesityPrimary';
    const cbData = mc.comorbidityBreadth?.[cbKey];
    comorbidityMultiplier = cbData?.multiplier ?? 1.0;
    if (comorbidityMultiplier !== 1.0) {
      modifiers.push({ name: cbData?.label ?? cbKey, multiplier: comorbidityMultiplier, context: cbData?.context });
    }
  }

  // Get cardiovascular-specific multipliers
  let cvEndpointMultiplier = 1.0;
  let cvPopRiskMultiplier = 1.0;
  if (isCardiovascular) {
    const mc = benchmarks.multiplierConfig;
    const teKey = input.cvTrialEndpoint || 'surrogateBiomarker';
    const teData = mc.cvTrialEndpoint?.[teKey];
    cvEndpointMultiplier = teData?.multiplier ?? 1.0;
    if (cvEndpointMultiplier !== 1.0) {
      modifiers.push({ name: teData?.label ?? teKey, multiplier: cvEndpointMultiplier, context: teData?.context });
    }
    const prKey = input.cvPopulationRisk || 'moderateRisk';
    const prData = mc.cvPopulationRisk?.[prKey];
    cvPopRiskMultiplier = prData?.multiplier ?? 1.0;
    if (cvPopRiskMultiplier !== 1.0) {
      modifiers.push({ name: prData?.label ?? prKey, multiplier: cvPopRiskMultiplier, context: prData?.context });
    }
  }

  // Get infectious disease-specific multipliers
  let resistanceMultiplier = 1.0;
  let pubHealthMultiplier = 1.0;
  if (isInfectiousDisease) {
    const mc = benchmarks.multiplierConfig;
    const rpKey = input.resistanceProfile || 'existingClassImproved';
    const rpData = mc.resistanceProfile?.[rpKey];
    resistanceMultiplier = rpData?.multiplier ?? 1.0;
    if (resistanceMultiplier !== 1.0) {
      modifiers.push({ name: rpData?.label ?? rpKey, multiplier: resistanceMultiplier, context: rpData?.context });
    }
    const phKey = input.publicHealthPriority || 'standard';
    const phData = mc.publicHealthPriority?.[phKey];
    pubHealthMultiplier = phData?.multiplier ?? 1.0;
    if (pubHealthMultiplier !== 1.0) {
      modifiers.push({ name: phData?.label ?? phKey, multiplier: pubHealthMultiplier, context: phData?.context });
    }
  }

  // Get ophthalmology-specific multipliers
  let ocularDeliveryMultiplier = 1.0;
  let durabilityMultiplier = 1.0;
  if (isOphthalmology) {
    const mc = benchmarks.multiplierConfig;
    const odKey = input.ocularDelivery || 'intravitreal';
    const odData = mc.ocularDelivery?.[odKey];
    ocularDeliveryMultiplier = odData?.multiplier ?? 1.0;
    if (ocularDeliveryMultiplier !== 1.0) {
      modifiers.push({ name: odData?.label ?? odKey, multiplier: ocularDeliveryMultiplier, context: odData?.context });
    }
    const tdKey = input.treatmentDurability || 'chronicInjection';
    const tdData = mc.treatmentDurability?.[tdKey];
    durabilityMultiplier = tdData?.multiplier ?? 1.0;
    if (durabilityMultiplier !== 1.0) {
      modifiers.push({ name: tdData?.label ?? tdKey, multiplier: durabilityMultiplier, context: tdData?.context });
    }
  }

  // Get women's health-specific multipliers
  let whPopMultiplier = 1.0;
  let whRegMultiplier = 1.0;
  if (isWomensHealth) {
    const mc = benchmarks.multiplierConfig;
    const tpKey = input.whTargetPopulation || 'reproductiveAge';
    const tpData = mc.whTargetPopulation?.[tpKey];
    whPopMultiplier = tpData?.multiplier ?? 1.0;
    if (whPopMultiplier !== 1.0) {
      modifiers.push({ name: tpData?.label ?? tpKey, multiplier: whPopMultiplier, context: tpData?.context });
    }
    const wrKey = input.whRegulatory || 'standardPathway';
    const wrData = mc.whRegulatory?.[wrKey];
    whRegMultiplier = wrData?.multiplier ?? 1.0;
    if (whRegMultiplier !== 1.0) {
      modifiers.push({ name: wrData?.label ?? wrKey, multiplier: whRegMultiplier, context: wrData?.context });
    }
  }

  // Apply diminishing multiplier stacking with therapeutic-area-specific exponents
  // Neurology: combo dampening reduced (CNS drugs are inherently combination-limited by BBB)
  // Neurology: indication exponent higher (indication choice matters more in neuro)
  // Immunology: combo therapies very relevant; indication and disease severity matter highly
  // Metabolic: route of admin and weight loss efficacy are the strongest differentiators
  const comboExp = isNeurology ? 0.90 : isImmunology ? 0.80 : isMetabolic ? 0.85 : isCardiovascular ? 0.80 : isInfectiousDisease ? 0.85 : isOphthalmology ? 0.85 : isWomensHealth ? 0.80 : 0.75;
  const indicationExp = isNeurology ? 0.90 : isImmunology ? 0.85 : isMetabolic ? 0.85 : isCardiovascular ? 0.85 : isInfectiousDisease ? 0.85 : isOphthalmology ? 0.90 : isWomensHealth ? 0.85 : 0.80;
  const lotExp = isNeurology ? 0.90 : isImmunology ? 0.85 : isMetabolic ? 0.85 : isCardiovascular ? 0.85 : isInfectiousDisease ? 0.80 : isOphthalmology ? 0.85 : isWomensHealth ? 0.85 : 0.85;

  const effectiveMultiplier =
    safeMultiplier(Math.pow(modalityMultiplier, 1.0)) *
    safeMultiplier(Math.pow(indicationMultiplier, indicationExp)) *
    safeMultiplier(Math.pow(biomarkerMultiplier, 0.9)) *
    safeMultiplier(Math.pow(lotMultiplier, lotExp)) *
    safeMultiplier(Math.pow(comboMultiplier, comboExp)) *
    safeMultiplier(Math.pow(territoryMultiplier, 1.0)) *
    safeMultiplier(Math.pow(competitiveMultiplier, 0.7)) *
    safeMultiplier(Math.pow(dataQualityMultiplier, 0.5)) *
    safeMultiplier(Math.pow(bbbMultiplier, 0.8)) *
    safeMultiplier(Math.pow(diseaseProgMultiplier, 0.7)) *
    safeMultiplier(Math.pow(biomarkerValMultiplier, 0.75)) *
    safeMultiplier(Math.pow(immuneResetMultiplier, 0.85)) *
    safeMultiplier(Math.pow(targetSpecMultiplier, 0.7)) *
    safeMultiplier(Math.pow(diseaseSevMultiplier, 0.75)) *
    safeMultiplier(Math.pow(mechDiffMultiplier, 0.80)) *
    safeMultiplier(Math.pow(weightLossMultiplier, 0.85)) *
    safeMultiplier(Math.pow(routeMultiplier, 0.75)) *
    safeMultiplier(Math.pow(comorbidityMultiplier, 0.70)) *
    safeMultiplier(Math.pow(cvEndpointMultiplier, 0.80)) *
    safeMultiplier(Math.pow(cvPopRiskMultiplier, 0.75)) *
    safeMultiplier(Math.pow(resistanceMultiplier, 0.85)) *
    safeMultiplier(Math.pow(pubHealthMultiplier, 0.70)) *
    safeMultiplier(Math.pow(ocularDeliveryMultiplier, 0.80)) *
    safeMultiplier(Math.pow(durabilityMultiplier, 0.85)) *
    safeMultiplier(Math.pow(whPopMultiplier, 0.75)) *
    safeMultiplier(Math.pow(whRegMultiplier, 0.70)) *
    safeMultiplier(1 + regulatoryBonus) *
    safeMultiplier(1 + interactionBonus);

  // Calculate total deal value
  const baseTotalValue = phaseBaseline.totalValue;
  const rangeWidth = phaseConfig.rangeWidths[input.phase];
  const dealType = input.dealType || 'licensing';

  // Deal type value multiplier
  const dealTypeMultipliers: Record<DealType, number> = {
    licensing: 1.0,
    acquisition: 1.35,
    codevelopment: 0.90,
    option: 0.75,
    collaboration: 0.65,
  };
  const dealTypeMultiplier = dealTypeMultipliers[dealType];
  if (dealType !== 'licensing') {
    const dealTypeLabels: Record<DealType, string> = {
      licensing: 'Licensing', acquisition: 'Acquisition / M&A',
      codevelopment: 'Co-Development', option: 'Option Agreement',
      collaboration: 'Research Collaboration',
    };
    modifiers.push({
      name: dealTypeLabels[dealType],
      multiplier: dealTypeMultiplier,
      context: dealType === 'acquisition' ? 'Premium for certainty of control' :
               dealType === 'codevelopment' ? 'Shared economics reduce total value' :
               dealType === 'option' ? 'Optionality discount, lower commitment' :
               'Early-stage research partnership',
    });
  }

  const adjustedMedian = Math.round(baseTotalValue.median * effectiveMultiplier * dealTypeMultiplier);

  if (!Number.isFinite(adjustedMedian) || adjustedMedian <= 0) {
    throw new Error(
      `Invalid calculation: adjustedMedian=${adjustedMedian}, effectiveMultiplier=${effectiveMultiplier}. ` +
      `Input: phase=${input.phase}, modality=${input.modality}, indication=${input.indication}`
    );
  }

  const totalDealValue = {
    low: Math.round(adjustedMedian * (1 - rangeWidth)),
    median: adjustedMedian,
    high: Math.round(adjustedMedian * (1 + rangeWidth))
  };

  // Deal type upfront ratio overrides
  const dealTypeUpfrontOverrides: Record<DealType, { low: number; high: number } | null> = {
    licensing: null, // use phase-based ratios
    acquisition: { low: 0.60, high: 0.85 }, // acquisitions are upfront-heavy
    codevelopment: null, // use phase-based ratios (slightly reduced)
    option: { low: 0.05, high: 0.12 }, // options have very low upfronts
    collaboration: null, // use phase-based ratios
  };

  // Calculate upfront based on phase ratios with risk adjustment
  const baseUpfrontRatios = phaseConfig.upfrontRatios[input.phase];
  const upfrontRatios = dealTypeUpfrontOverrides[dealType] || baseUpfrontRatios;
  const riskScore = calculateRiskScore(input);
  // Higher risk = lower upfront ratio (toward low end)
  const riskFactor = Math.max(0, Math.min(riskScore / 100, 1)); // Clamp 0 to 1

  // Apply risk adjustment consistently across all calculations
  const adjustedRatioLow = upfrontRatios.low + (upfrontRatios.high - upfrontRatios.low) * (1 - riskFactor);
  const adjustedRatioHigh = upfrontRatios.low + (upfrontRatios.high - upfrontRatios.low) * (1 - riskFactor * 0.5);
  const adjustedRatioMedian = (adjustedRatioLow + adjustedRatioHigh) / 2;

  const upfront = {
    low: Math.round(totalDealValue.low * adjustedRatioLow * 0.9),
    median: Math.round(totalDealValue.median * adjustedRatioMedian),
    high: Math.round(totalDealValue.high * adjustedRatioHigh * 1.1)
  };

  // Calculate milestone allocations
  // Disease-modifying neurology assets use rebalanced milestones (more dev-weighted)
  const dmPhaseAdjust = benchmarks.neurologyDiseaseModifyingPhaseAdjustment;
  const useDMRebalance = isNeurology && input.treatmentApproach === 'diseaseModifying' && dmPhaseAdjust;
  const milestoneAlloc = useDMRebalance
    ? (dmPhaseAdjust.milestoneRebalance[input.phase] ?? phaseConfig.milestoneAllocations[input.phase])
    : phaseConfig.milestoneAllocations[input.phase];
  const totalMilestones = {
    low: totalDealValue.low - upfront.low,
    median: totalDealValue.median - upfront.median,
    high: totalDealValue.high - upfront.high
  };

  const devMilestones = {
    low: Math.round(totalMilestones.low * milestoneAlloc.dev),
    median: Math.round(totalMilestones.median * milestoneAlloc.dev),
    high: Math.round(totalMilestones.high * milestoneAlloc.dev)
  };

  const regMilestones = {
    low: Math.round(totalMilestones.low * milestoneAlloc.reg),
    median: Math.round(totalMilestones.median * milestoneAlloc.reg),
    high: Math.round(totalMilestones.high * milestoneAlloc.reg)
  };

  const commMilestones = {
    low: Math.round(totalMilestones.low * milestoneAlloc.comm),
    median: Math.round(totalMilestones.median * milestoneAlloc.comm),
    high: Math.round(totalMilestones.high * milestoneAlloc.comm)
  };

  // Calculate tiered royalties — acquisitions have no royalties
  const baseRoyalty = phaseBaseline.royalty;
  const royaltyMultiplier = Math.pow(effectiveMultiplier, 0.3); // Dampened effect on royalties
  const isAcquisition = dealType === 'acquisition';

  const baseLow = isAcquisition ? 0 : Math.round(baseRoyalty.base * royaltyMultiplier * 10) / 10;
  const baseHigh = isAcquisition ? 0 : Math.round(baseRoyalty.max * royaltyMultiplier * 10) / 10;

  const tieredRoyalties: TieredRoyalties = {
    base: {
      low: Math.min(baseLow, 25),
      high: Math.min(baseHigh, 30)
    },
    midTier: {
      low: Math.min(baseLow + (isAcquisition ? 0 : 2), 28),
      high: Math.min(baseHigh + (isAcquisition ? 0 : 2), 33)
    },
    highTier: {
      low: Math.min(baseLow + (isAcquisition ? 0 : 4), 30),
      high: Math.min(baseHigh + (isAcquisition ? 0 : 4), 35)
    }
  };

  // Calculate deal recommendation
  const recommendedUpfrontPercent = Math.round(adjustedRatioMedian * 100);
  const dealRecommendation: DealRecommendation = {
    upfrontPercent: recommendedUpfrontPercent,
    milestonePercent: 100 - recommendedUpfrontPercent,
    rationale: generateRationale(input, riskScore)
  };

  // Get negotiation insight
  const negotiationInsight = getNegotiationInsight(input);

  // Get labels
  const labels = benchmarks.labels;

  // Generate drill-down data
  const drillDown = generateDrillDownData(
    input,
    modifiers,
    rangeWidth,
    devMilestones,
    regMilestones,
    commMilestones,
    tieredRoyalties
  );

  return {
    terms: {
      upfront: sanitizeRange(upfront),
      devMilestones: sanitizeRange(devMilestones),
      regMilestones: sanitizeRange(regMilestones),
      commMilestones: sanitizeRange(commMilestones),
      totalDealValue: sanitizeRange(totalDealValue),
    },
    tieredRoyalties: {
      base: sanitizeRoyaltyRange(tieredRoyalties.base),
      midTier: sanitizeRoyaltyRange(tieredRoyalties.midTier),
      highTier: sanitizeRoyaltyRange(tieredRoyalties.highTier),
    },
    dealRecommendation: {
      ...dealRecommendation,
      upfrontPercent: Number.isFinite(dealRecommendation.upfrontPercent) ? dealRecommendation.upfrontPercent : 15,
      milestonePercent: Number.isFinite(dealRecommendation.milestonePercent) ? dealRecommendation.milestonePercent : 85,
    },
    negotiationInsight,
    modifiers,
    labels: {
      phase: labels.phases[input.phase],
      modality: modalityData?.label ?? input.modality,
      indication: indicationData?.label ?? input.indication
    },
    drillDown,
    phase: input.phase,
    ...(isNeurology ? {
      milestoneExplanation: generateNeuroMilestoneExplanation(input.phase, recommendedUpfrontPercent)
    } : {}),
    ...(isImmunology ? {
      milestoneExplanation: generateImmunologyMilestoneExplanation(input.phase, recommendedUpfrontPercent)
    } : {}),
    ...(isMetabolic ? {
      milestoneExplanation: generateMetabolicMilestoneExplanation(input.phase, recommendedUpfrontPercent)
    } : {}),
    ...(isCardiovascular ? {
      milestoneExplanation: generateCardiovascularMilestoneExplanation(input.phase, recommendedUpfrontPercent)
    } : {}),
    ...(isInfectiousDisease ? {
      milestoneExplanation: generateInfectiousDiseaseMilestoneExplanation(input.phase, recommendedUpfrontPercent)
    } : {}),
    ...(isOphthalmology ? {
      milestoneExplanation: generateOphthalmologyMilestoneExplanation(input.phase, recommendedUpfrontPercent)
    } : {}),
    ...(isWomensHealth ? {
      milestoneExplanation: generateWomensHealthMilestoneExplanation(input.phase, recommendedUpfrontPercent)
    } : {})
  };
}

function phaseRangeLabel(phase: Phase): string {
  return phase.replace(/_/g, '/').replace('phase', 'Phase ').replace('nda/filed', 'NDA Filed').replace('discovery', 'Discovery');
}

function lookupRange(ranges: Partial<Record<Phase, string>>, phase: Phase): string {
  if (ranges[phase]) return ranges[phase]!;
  // Interpolate intermediate phases to their nearest neighbor
  const fallbacks: Record<string, Phase> = {
    discovery: 'preclinical', phase1_2: 'phase1', phase2_3: 'phase2', nda_filed: 'phase3',
  };
  return ranges[fallbacks[phase] ?? 'phase2'] ?? 'N/A';
}

function generateNeuroMilestoneExplanation(phase: Phase, upfrontPercent: number): string {
  const neuroUpfrontRanges: Partial<Record<Phase, string>> = {
    discovery: '3-8%', preclinical: '5-12%', phase1: '8-18%', phase1_2: '10-20%',
    phase2: '12-25%', phase2_3: '16-30%', phase3: '20-35%', nda_filed: '25-42%', approved: '30-50%',
  };
  const oncoUpfrontRanges: Partial<Record<Phase, string>> = {
    discovery: '5-12%', preclinical: '8-18%', phase1: '12-25%', phase1_2: '15-30%',
    phase2: '18-35%', phase2_3: '22-40%', phase3: '25-45%', nda_filed: '30-52%', approved: '35-60%',
  };
  return `Neurology deals at ${phaseRangeLabel(phase)} typically allocate ${lookupRange(neuroUpfrontRanges, phase)} upfront (vs ${lookupRange(oncoUpfrontRanges, phase)} in oncology). ` +
    `Your estimated ${upfrontPercent}% upfront reflects the higher clinical risk in CNS programs — longer trials, complex endpoints, and historically lower approval rates shift value toward milestone-based structures that reward de-risking.`;
}

function generateImmunologyMilestoneExplanation(phase: Phase, upfrontPercent: number): string {
  const immunoUpfrontRanges: Partial<Record<Phase, string>> = {
    discovery: '3-7%', preclinical: '5-9%', phase1: '8-13%', phase1_2: '11-17%',
    phase2: '14-22%', phase2_3: '17-25%', phase3: '20-28%', nda_filed: '24-35%', approved: '28-42%',
  };
  return `Immunology/autoimmune deals at ${phaseRangeLabel(phase)} typically allocate ${lookupRange(immunoUpfrontRanges, phase)} upfront. ` +
    `Your estimated ${upfrontPercent}% upfront reflects the chronic-disease commercial model — autoimmune drugs generate recurring revenue (Humira $21B peak, Dupixent $13B+), ` +
    `so deal structures weight commercial milestones heavily, with upfronts higher than neurology but structured to reward market access and formulary wins.`;
}

function generateMetabolicMilestoneExplanation(phase: Phase, upfrontPercent: number): string {
  const metUpfrontRanges: Partial<Record<Phase, string>> = {
    discovery: '4-8%', preclinical: '6-10%', phase1: '10-15%', phase1_2: '12-20%',
    phase2: '15-25%', phase2_3: '18-28%', phase3: '20-30%', nda_filed: '24-36%', approved: '28-42%',
  };
  return `Metabolic/obesity deals at ${phaseRangeLabel(phase)} typically allocate ${lookupRange(metUpfrontRanges, phase)} upfront. ` +
    `Your estimated ${upfrontPercent}% upfront reflects the commercial-weighted structure of metabolic deals — GLP-1 and incretin programs generate massive recurring revenue ($20B+ semaglutide peak), ` +
    `so deal structures heavily weight commercial milestones tied to formulary access, indication expansion, and blockbuster sales tiers.`;
}

function generateCardiovascularMilestoneExplanation(phase: Phase, upfrontPercent: number): string {
  const cvUpfrontRanges: Partial<Record<Phase, string>> = {
    discovery: '3-8%', preclinical: '5-10%', phase1: '8-15%', phase1_2: '11-20%',
    phase2: '14-24%', phase2_3: '18-30%', phase3: '22-35%', nda_filed: '26-42%', approved: '30-50%',
  };
  return `Cardiovascular deals at ${phaseRangeLabel(phase)} typically allocate ${lookupRange(cvUpfrontRanges, phase)} upfront. ` +
    `Your estimated ${upfrontPercent}% upfront reflects the MACE outcome-driven model — CV drugs require large outcome trials (10,000-15,000 patients), ` +
    `so deal structures heavily weight regulatory milestones and commercial tiers tied to formulary access and CV mortality/hospitalization endpoints.`;
}

function generateInfectiousDiseaseMilestoneExplanation(phase: Phase, upfrontPercent: number): string {
  const idUpfrontRanges: Partial<Record<Phase, string>> = {
    discovery: '5-10%', preclinical: '8-15%', phase1: '12-20%', phase1_2: '15-25%',
    phase2: '18-30%', phase2_3: '22-35%', phase3: '25-40%', nda_filed: '30-48%', approved: '35-55%',
  };
  return `Infectious disease deals at ${phaseRangeLabel(phase)} typically allocate ${lookupRange(idUpfrontRanges, phase)} upfront. ` +
    `Your estimated ${upfrontPercent}% upfront reflects the faster clinical timelines in ID — shorter trial durations, clear microbiological endpoints, ` +
    `and strong regulatory pathways (QIDP, LPAD) allow higher upfronts. Commercial milestones tied to resistance profiles and formulary positioning.`;
}

function generateOphthalmologyMilestoneExplanation(phase: Phase, upfrontPercent: number): string {
  const ophUpfrontRanges: Partial<Record<Phase, string>> = {
    discovery: '4-8%', preclinical: '6-12%', phase1: '10-18%', phase1_2: '12-22%',
    phase2: '15-25%', phase2_3: '18-30%', phase3: '22-35%', nda_filed: '26-42%', approved: '30-48%',
  };
  return `Ophthalmology deals at ${phaseRangeLabel(phase)} typically allocate ${lookupRange(ophUpfrontRanges, phase)} upfront. ` +
    `Your estimated ${upfrontPercent}% upfront reflects the durability-driven model — retinal drugs are injection-based with clear visual acuity endpoints. ` +
    `Deal structures reward treatment interval extension and durability over anti-VEGF standard of care, with heavy commercial milestone weighting.`;
}

function generateWomensHealthMilestoneExplanation(phase: Phase, upfrontPercent: number): string {
  const whUpfrontRanges: Partial<Record<Phase, string>> = {
    discovery: '3-7%', preclinical: '5-10%', phase1: '8-14%', phase1_2: '10-18%',
    phase2: '12-22%', phase2_3: '15-26%', phase3: '18-30%', nda_filed: '22-36%', approved: '25-42%',
  };
  return `Women's health deals at ${phaseRangeLabel(phase)} typically allocate ${lookupRange(whUpfrontRanges, phase)} upfront. ` +
    `Your estimated ${upfrontPercent}% upfront reflects the historically underinvested nature of the space — recent breakthroughs (Veozah, Zurzuvae, Myfembree) ` +
    `have validated premium deal structures, with milestones weighted toward regulatory approval and commercial launch given the large, underserved patient populations.`;
}

function generateDrillDownData(
  input: CalculationInput,
  modifiers: { name: string; multiplier: number; context?: string }[],
  rangeWidth: number,
  devMilestones: { low: number; median: number; high: number },
  regMilestones: { low: number; median: number; high: number },
  commMilestones: { low: number; median: number; high: number },
  tieredRoyalties: TieredRoyalties
): DrillDownCollection {
  const phaseLabels = benchmarks.labels.phases;
  const rangePercent = Math.round(rangeWidth * 100);

  // Convert modifiers to factor impacts
  const factors: FactorImpact[] = modifiers.map(mod => ({
    name: mod.name,
    impact: mod.multiplier > 1 ? 'positive' : mod.multiplier < 1 ? 'negative' : 'neutral',
    percentage: Math.round((mod.multiplier - 1) * 100)
  }));

  // Phase-specific range explanations
  const rangeExplanations: Partial<Record<Phase, string>> = {
    discovery: `Discovery-stage assets have the widest valuation range (±${rangePercent}%) due to minimal validation and high attrition risk.`,
    preclinical: `Preclinical assets have the widest valuation range (±${rangePercent}%) due to significant development uncertainty and limited clinical validation.`,
    phase1: `Phase 1 assets show moderate variance (±${rangePercent}%) as initial safety data reduces but doesn't eliminate development risk.`,
    phase1_2: `Phase 1/2 assets show moderate variance (±${rangePercent}%) as initial safety and early efficacy data provide partial de-risking.`,
    phase2: `Phase 2 assets typically see ±${rangePercent}% variance based on efficacy signals, competitive dynamics, and pathway clarity.`,
    phase2_3: `Phase 2/3 adaptive assets see ±${rangePercent}% variance — efficacy trends from Phase 2 part inform risk, but pivotal data is pending.`,
    phase3: `Phase 3 assets have tighter ranges (±${rangePercent}%) given substantial de-risking, though regulatory and commercial uncertainties remain.`,
    nda_filed: `NDA/BLA-filed assets have narrow ranges (±${rangePercent}%) with primary risk being regulatory decision timing and label breadth.`,
    approved: `Approved assets show the tightest ranges (±${rangePercent}%) with valuations driven primarily by commercial execution factors.`,
  };

  // Development milestone breakdown by phase
  const devBreakdowns: Partial<Record<Phase, MilestoneBreakdown[]>> = {
    discovery: [
      { label: 'Target Validation', percentage: 20, value: calculateBreakdownValue(devMilestones, 0.20) },
      { label: 'Lead Optimization', percentage: 25, value: calculateBreakdownValue(devMilestones, 0.25) },
      { label: 'IND Filing', percentage: 30, value: calculateBreakdownValue(devMilestones, 0.30) },
      { label: 'Phase 1 Start', percentage: 25, value: calculateBreakdownValue(devMilestones, 0.25) }
    ],
    preclinical: [
      { label: 'IND Filing', percentage: 30, value: calculateBreakdownValue(devMilestones, 0.30) },
      { label: 'Phase 1 Start', percentage: 25, value: calculateBreakdownValue(devMilestones, 0.25) },
      { label: 'Phase 2 Start', percentage: 25, value: calculateBreakdownValue(devMilestones, 0.25) },
      { label: 'Phase 3 Start', percentage: 20, value: calculateBreakdownValue(devMilestones, 0.20) }
    ],
    phase1: [
      { label: 'Phase 1 Completion', percentage: 40, value: calculateBreakdownValue(devMilestones, 0.40) },
      { label: 'Phase 2 Start', percentage: 35, value: calculateBreakdownValue(devMilestones, 0.35) },
      { label: 'Phase 3 Start', percentage: 25, value: calculateBreakdownValue(devMilestones, 0.25) }
    ],
    phase1_2: [
      { label: 'Phase 1/2 Completion', percentage: 45, value: calculateBreakdownValue(devMilestones, 0.45) },
      { label: 'Phase 2/3 Start', percentage: 30, value: calculateBreakdownValue(devMilestones, 0.30) },
      { label: 'Phase 3 Start', percentage: 25, value: calculateBreakdownValue(devMilestones, 0.25) }
    ],
    phase2: [
      { label: 'Phase 2 Completion', percentage: 60, value: calculateBreakdownValue(devMilestones, 0.60) },
      { label: 'Phase 3 Start', percentage: 40, value: calculateBreakdownValue(devMilestones, 0.40) }
    ],
    phase2_3: [
      { label: 'Phase 2/3 Completion', percentage: 65, value: calculateBreakdownValue(devMilestones, 0.65) },
      { label: 'NDA/BLA Filing', percentage: 35, value: calculateBreakdownValue(devMilestones, 0.35) }
    ],
    phase3: [
      { label: 'Phase 3 Completion', percentage: 70, value: calculateBreakdownValue(devMilestones, 0.70) },
      { label: 'NDA/BLA Filing', percentage: 30, value: calculateBreakdownValue(devMilestones, 0.30) }
    ],
    nda_filed: [
      { label: 'FDA Approval', percentage: 80, value: calculateBreakdownValue(devMilestones, 0.80) },
      { label: 'Label Expansion', percentage: 20, value: calculateBreakdownValue(devMilestones, 0.20) }
    ],
    approved: [
      { label: 'Label Expansion', percentage: 100, value: calculateBreakdownValue(devMilestones, 1.0) }
    ]
  };

  // Regulatory milestone breakdown
  const regBreakdown: MilestoneBreakdown[] = [
    { label: 'FDA Approval', percentage: 50, value: calculateBreakdownValue(regMilestones, 0.50) },
    { label: 'EMA Approval', percentage: 30, value: calculateBreakdownValue(regMilestones, 0.30) },
    { label: 'Other Major Markets', percentage: 20, value: calculateBreakdownValue(regMilestones, 0.20) }
  ];

  // Commercial milestone breakdown
  const commBreakdown: MilestoneBreakdown[] = [
    { label: 'First $100M Net Sales', percentage: 15, value: calculateBreakdownValue(commMilestones, 0.15) },
    { label: '$500M Net Sales', percentage: 25, value: calculateBreakdownValue(commMilestones, 0.25) },
    { label: '$1B Net Sales', percentage: 30, value: calculateBreakdownValue(commMilestones, 0.30) },
    { label: '$2B+ Net Sales', percentage: 30, value: calculateBreakdownValue(commMilestones, 0.30) }
  ];

  // Royalty tier explanation
  const royaltyBreakdown: MilestoneBreakdown[] = [
    { label: `Base Tier (<$500M)`, percentage: tieredRoyalties.base.low, value: { low: tieredRoyalties.base.low, median: (tieredRoyalties.base.low + tieredRoyalties.base.high) / 2, high: tieredRoyalties.base.high } },
    { label: `Mid Tier ($500M-$1B)`, percentage: tieredRoyalties.midTier.low, value: { low: tieredRoyalties.midTier.low, median: (tieredRoyalties.midTier.low + tieredRoyalties.midTier.high) / 2, high: tieredRoyalties.midTier.high } },
    { label: `High Tier (>$1B)`, percentage: tieredRoyalties.highTier.low, value: { low: tieredRoyalties.highTier.low, median: (tieredRoyalties.highTier.low + tieredRoyalties.highTier.high) / 2, high: tieredRoyalties.highTier.high } }
  ];

  return {
    upfront: {
      rangeExplanation: `Upfront payments are guaranteed at signing. The range reflects market variability and negotiation outcomes for ${phaseLabels[input.phase]} assets.`,
      rangeWidthPercent: rangePercent,
      factors: factors.filter(f => f.impact !== 'neutral')
    },
    totalDealValue: {
      rangeExplanation: rangeExplanations[input.phase] ?? rangeExplanations['phase2']!,
      rangeWidthPercent: rangePercent,
      factors: factors.filter(f => f.impact !== 'neutral')
    },
    devMilestones: {
      rangeExplanation: `Development milestones are paid upon achieving clinical trial objectives. Earlier-stage deals weight more toward development milestones.`,
      rangeWidthPercent: rangePercent,
      factors: factors.filter(f => f.impact !== 'neutral'),
      breakdown: devBreakdowns[input.phase] ?? devBreakdowns['phase2']!
    },
    regMilestones: {
      rangeExplanation: `Regulatory milestones are contingent on approval by health authorities. FDA typically accounts for 50% of regulatory milestone value.`,
      rangeWidthPercent: rangePercent,
      factors: factors.filter(f => f.impact !== 'neutral'),
      breakdown: regBreakdown
    },
    commMilestones: {
      rangeExplanation: `Commercial milestones are tied to net sales thresholds. Later-stage deals weight more toward commercial milestones.`,
      rangeWidthPercent: rangePercent,
      factors: factors.filter(f => f.impact !== 'neutral'),
      breakdown: commBreakdown
    },
    royalties: {
      rangeExplanation: `Royalties are ongoing payments on net sales, typically tiered to increase with sales volume. Rates reflect modality, indication, and competitive factors.`,
      rangeWidthPercent: rangePercent,
      factors: factors.filter(f => f.impact !== 'neutral'),
      breakdown: royaltyBreakdown
    }
  };
}

function calculateBreakdownValue(
  total: { low: number; median: number; high: number },
  percentage: number
): { low: number; median: number; high: number } {
  return {
    low: Math.round(total.low * percentage),
    median: Math.round(total.median * percentage),
    high: Math.round(total.high * percentage)
  };
}

function generateRationale(input: CalculationInput, riskScore: number): string {
  const phaseLabel = benchmarks.labels.phases[input.phase];
  const ta = input.therapeuticArea;

  if (ta === 'oncology') {
    if (riskScore < 25) {
      return `De-risked ${phaseLabel} oncology asset with strong clinical data and differentiated mechanism justifies premium upfront. Combination potential and line-of-therapy positioning drive aggressive commercial milestones in the $200B+ oncology market.`;
    } else if (riskScore < 50) {
      return `${phaseLabel} oncology asset with moderate risk. Deals are structured around clinical milestones tied to response rates and PFS/OS endpoints. Biomarker-defined patient selection and combination strategies are key value drivers.`;
    } else if (riskScore < 75) {
      return `Earlier-stage oncology asset with clinical uncertainty. Milestone-heavy structures tied to proof-of-concept data, tumor type expansion, and regulatory de-risking events.`;
    } else {
      return `High-risk oncology profile. Expect modest upfront with significant milestone potential tied to early clinical signals, biomarker validation, and IND-enabling milestones.`;
    }
  }

  if (ta === 'metabolic') {
    if (riskScore < 25) {
      return `De-risked ${phaseLabel} metabolic asset with validated mechanism and strong efficacy data justifies premium upfront. The enormous commercial potential of obesity/metabolic drugs ($100B+ projected market) drives aggressive commercial milestone structures.`;
    } else if (riskScore < 50) {
      return `${phaseLabel} metabolic asset with moderate risk. The GLP-1 era has established deal premiums, but differentiation via oral delivery, superior efficacy, or multi-organ benefit is critical for top-tier terms.`;
    } else if (riskScore < 75) {
      return `Earlier-stage metabolic asset with clinical uncertainty. Deals are structured with development milestones tied to weight loss endpoints and cardiometabolic outcome data.`;
    } else {
      return `High-risk metabolic profile. Expect modest upfront with milestone potential tied to efficacy differentiation, oral formulation success, and payer access milestones.`;
    }
  }

  if (ta === 'immunology') {
    if (riskScore < 25) {
      return `De-risked ${phaseLabel} autoimmune asset with validated mechanism justifies higher upfront. Commercial milestones dominate — chronic autoimmune drugs generate blockbuster recurring revenue.`;
    } else if (riskScore < 50) {
      return `${phaseLabel} immunology asset with moderate risk. Autoimmune deals increasingly favor commercial milestone-heavy structures given the proven chronic-use revenue model.`;
    } else if (riskScore < 75) {
      return `Earlier-stage autoimmune asset with clinical uncertainty. Deals are structured with development milestones tied to endpoint validation and regulatory de-risking.`;
    } else {
      return `High-risk autoimmune profile. Expect minimal upfront with milestone potential tied to immune reset durability, endpoint validation, and regulatory milestones.`;
    }
  }

  if (ta === 'neurology') {
    if (riskScore < 25) {
      return `De-risked ${phaseLabel} CNS asset with proven BBB penetration and strong data justifies a higher upfront component, though milestone-heavy structures remain the norm in neurology.`;
    } else if (riskScore < 50) {
      return `${phaseLabel} neurology asset with moderate risk. CNS programs typically favor milestone-weighted deals to account for longer development timelines and endpoint complexity.`;
    } else if (riskScore < 75) {
      return `Earlier-stage CNS asset with clinical uncertainty. Neurology deal structures favor heavy milestone weighting tied to clinical and regulatory de-risking events.`;
    } else {
      return `High-risk CNS profile. Expect minimal upfront with significant milestone potential tied to BBB penetration proof, clinical endpoints, and regulatory milestones.`;
    }
  }

  if (ta === 'cardiovascular') {
    if (riskScore < 25) {
      return `De-risked ${phaseLabel} cardiovascular asset with strong outcome data justifies premium terms. CVOT requirements create high barriers but also strong competitive moats — successful outcome trials command top-tier deal values.`;
    } else if (riskScore < 50) {
      return `${phaseLabel} cardiovascular asset with moderate risk. Deals emphasize regulatory milestones tied to CVOT data and FDA endpoint acceptance. Hard outcome endpoints (MACE, mortality) drive higher milestone values than surrogate markers.`;
    } else if (riskScore < 75) {
      return `Earlier-stage cardiovascular asset with clinical uncertainty. Long CVOT timelines (3-5 years) and large trial requirements mean deals are milestone-heavy with development-weighted structures.`;
    } else {
      return `High-risk cardiovascular profile. Expect minimal upfront given CVOT requirements and long development timelines. Milestone potential tied to surrogate endpoint validation and regulatory interactions.`;
    }
  }

  if (ta === 'infectiousDisease') {
    if (riskScore < 25) {
      return `De-risked ${phaseLabel} anti-infective asset with established resistance advantage justifies strong terms. Public health priority designations (QIDP, pandemic preparedness) accelerate timelines and improve deal economics.`;
    } else if (riskScore < 50) {
      return `${phaseLabel} infectious disease asset with moderate risk. Resistance dynamics and public health urgency drive deal structures. Novel mechanism with broad-spectrum activity or pandemic readiness commands premium milestones.`;
    } else if (riskScore < 75) {
      return `Earlier-stage anti-infective with clinical uncertainty. Deals are structured around development milestones tied to spectrum-of-activity data, resistance barrier, and regulatory pathway clarity.`;
    } else {
      return `High-risk infectious disease profile. Market access challenges and payer resistance in antibiotics require creative deal structures. Expect milestone-heavy terms tied to clinical proof-of-concept and regulatory designations.`;
    }
  }

  if (ta === 'ophthalmology') {
    if (riskScore < 25) {
      return `De-risked ${phaseLabel} ophthalmic asset with demonstrated durability advantage justifies premium upfront. In the anti-VEGF dominated market, extended dosing intervals and novel delivery are the primary differentiators commanding top-tier terms.`;
    } else if (riskScore < 50) {
      return `${phaseLabel} ophthalmology asset with moderate risk. Deals emphasize treatment durability and injection frequency reduction. Milestones are tied to dosing interval endpoints, visual acuity outcomes, and geographic atrophy progression.`;
    } else if (riskScore < 75) {
      return `Earlier-stage ophthalmic asset with clinical uncertainty. Delivery platform differentiation (sustained release, gene therapy) and durability endpoints drive milestone structures.`;
    } else {
      return `High-risk ophthalmology profile. Expect minimal upfront with milestones tied to proof-of-concept durability data, delivery feasibility, and anti-VEGF comparator studies.`;
    }
  }

  if (ta === 'womensHealth') {
    if (riskScore < 25) {
      return `De-risked ${phaseLabel} women's health asset addressing significant unmet need justifies strong terms. Historically underserved therapeutic area with growing investor attention — successful products command premium pricing and loyalty.`;
    } else if (riskScore < 50) {
      return `${phaseLabel} women's health asset with moderate risk. Deal structures reflect pregnancy-related regulatory complexity and specialized endpoint requirements. Growing payer recognition of women's health gaps supports commercial milestones.`;
    } else if (riskScore < 75) {
      return `Earlier-stage women's health asset with clinical uncertainty. Specialized clinical trial design requirements (pregnancy registries, long-term safety) mean milestone-weighted deal structures.`;
    } else {
      return `High-risk women's health profile. Expect minimal upfront given regulatory complexity around reproductive safety and smaller clinical trial populations. Milestones tied to safety data and regulatory clarity.`;
    }
  }

  // Generic fallback (should not reach here with all 12 TAs covered)
  if (riskScore < 25) {
    return `De-risked ${phaseLabel} asset with strong competitive position justifies higher upfront.`;
  } else if (riskScore < 50) {
    return `${phaseLabel} asset with moderate risk profile. Balanced upfront/milestone structure recommended.`;
  } else if (riskScore < 75) {
    return `Earlier-stage asset with competitive uncertainty. Milestone-weighted structure protects both parties.`;
  } else {
    return `High-risk profile suggests lower upfront with significant milestone potential tied to de-risking events.`;
  }
}

export function formatCurrency(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return '$0M';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1000) {
    return `${sign}$${(abs / 1000).toFixed(1)}B`;
  }
  if (abs < 1 && abs > 0) {
    return `${sign}$${(abs * 1000).toFixed(0)}K`;
  }
  return `${sign}$${Math.round(abs)}M`;
}

export function formatRange(range: { low: number; median: number; high: number }): string {
  return `${formatCurrency(range.low)} - ${formatCurrency(range.high)}`;
}

// Option arrays for dropdowns
export const phaseOptions = [
  { value: 'discovery', label: 'Discovery (Target Validation)' },
  { value: 'preclinical', label: 'Preclinical (IND-enabling)' },
  { value: 'phase1', label: 'Phase 1' },
  { value: 'phase1_2', label: 'Phase 1/2' },
  { value: 'phase2', label: 'Phase 2' },
  { value: 'phase2_3', label: 'Phase 2/3 (Adaptive)' },
  { value: 'phase3', label: 'Phase 3 (Pivotal)' },
  { value: 'nda_filed', label: 'NDA / BLA Filed' },
  { value: 'approved', label: 'Approved' },
];

export const dealTypeOptions = [
  { value: 'licensing', label: 'Licensing' },
  { value: 'acquisition', label: 'Acquisition / M&A' },
  { value: 'codevelopment', label: 'Co-Development' },
  { value: 'option', label: 'Option Agreement' },
  { value: 'collaboration', label: 'Research Collaboration' },
];

export const dealTypeDescriptions: Record<string, string> = {
  licensing: 'Standard out-licensing with milestones & royalties',
  acquisition: 'Full asset or company acquisition, upfront-heavy',
  codevelopment: 'Shared development costs and commercial rights',
  option: 'Right to license at a future date, lower upfront',
  collaboration: 'Early research partnership, milestone-driven',
};

export const modalityOptions = [
  { group: 'Small Molecules', options: [
    { value: 'smallMolecule', label: 'Small Molecule' },
    { value: 'protac', label: 'PROTAC / Degrader' },
    { value: 'molecularGlue', label: 'Molecular Glue' },
  ]},
  { group: 'Antibodies', options: [
    { value: 'mab', label: 'Monoclonal Antibody (naked)' },
    { value: 'adc', label: 'Antibody-Drug Conjugate (ADC)' },
    { value: 'bispecific', label: 'Bispecific Antibody' },
    { value: 'tCellEngager', label: 'T-cell Engager (non-bispecific)' },
  ]},
  { group: 'Cell & Gene Therapy', options: [
    { value: 'carT_heme', label: 'CAR-T (Hematologic)' },
    { value: 'carT_solid', label: 'CAR-T (Solid Tumor)' },
    { value: 'cellTherapy', label: 'Cell Therapy (non-CAR-T)' },
    { value: 'geneTherapy', label: 'Gene Therapy / Gene Editing' },
  ]},
  { group: 'RNA & Vaccines', options: [
    { value: 'mrna', label: 'mRNA (Oncology Vaccine)' },
    { value: 'rnai', label: 'RNAi / siRNA' },
    { value: 'oligonucleotide', label: 'Oligonucleotide (ASO / siRNA for Tumors)' },
    { value: 'therapeuticVaccine', label: 'Therapeutic Vaccine (non-mRNA)' },
  ]},
  { group: 'Other', options: [
    { value: 'radiopharmaceutical', label: 'Radiopharmaceutical' },
    { value: 'peptide', label: 'Peptide' },
    { value: 'oncolyticVirus', label: 'Oncolytic Virus' },
  ]},
];

export const indicationOptions = [
  { group: 'Solid Tumors', options: [
    { value: 'lung_nsclc', label: 'Lung (NSCLC)' },
    { value: 'lung_sclc', label: 'Lung (SCLC)' },
    { value: 'breast_her2', label: 'Breast (HER2+)' },
    { value: 'breast_tnbc', label: 'Breast (TNBC)' },
    { value: 'breast_hr', label: 'Breast (HR+)' },
    { value: 'colorectal', label: 'Colorectal' },
    { value: 'pancreatic', label: 'Pancreatic' },
    { value: 'melanoma', label: 'Melanoma' },
    { value: 'prostate', label: 'Prostate (mCRPC)' },
    { value: 'ovarian', label: 'Ovarian' },
    { value: 'gastric', label: 'Gastric / GEJ' },
    { value: 'liver', label: 'HCC (Liver)' },
    { value: 'renal', label: 'Renal (RCC)' },
    { value: 'gbm', label: 'GBM (Brain)' },
    { value: 'bladder', label: 'Bladder' },
    { value: 'headNeck', label: 'Head & Neck' },
    { value: 'cholangiocarcinoma', label: 'Cholangiocarcinoma' },
    { value: 'mesothelioma', label: 'Mesothelioma' },
    { value: 'sarcoma', label: 'Sarcoma' },
    { value: 'endometrial', label: 'Endometrial (Uterine)' },
    { value: 'cervical', label: 'Cervical' },
    { value: 'thyroid', label: 'Thyroid (Anaplastic/Medullary)' },
    { value: 'esophageal', label: 'Esophageal' },
    { value: 'smallBowel', label: 'Small Bowel / Appendiceal' },
    { value: 'neuroendocrine', label: 'Neuroendocrine Tumors (NET)' },
    { value: 'uvealMelanoma', label: 'Uveal Melanoma' },
    { value: 'testicular', label: 'Testicular (Germ Cell)' },
    { value: 'adrenocortical', label: 'Adrenocortical Carcinoma' },
    { value: 'nasopharyngeal', label: 'Nasopharyngeal Carcinoma' },
    { value: 'thymoma', label: 'Thymoma / Thymic Carcinoma' },
    { value: 'penile', label: 'Penile Cancer' },
    { value: 'merkelCell', label: 'Merkel Cell Carcinoma' },
    { value: 'vulvar', label: 'Vulvar Cancer' },
  ]},
  { group: 'Pediatric Solid Tumors', options: [
    { value: 'neuroblastoma', label: 'Neuroblastoma' },
    { value: 'retinoblastoma', label: 'Retinoblastoma' },
    { value: 'osteosarcoma', label: 'Osteosarcoma' },
    { value: 'ewingSarcoma', label: 'Ewing Sarcoma' },
    { value: 'rhabdomyosarcoma', label: 'Rhabdomyosarcoma' },
  ]},
  { group: 'Hematologic Malignancies', options: [
    { value: 'aml', label: 'AML' },
    { value: 'all', label: 'ALL' },
    { value: 'cll', label: 'CLL' },
    { value: 'myeloma', label: 'Multiple Myeloma' },
    { value: 'dlbcl', label: 'DLBCL' },
    { value: 'follicular', label: 'Follicular Lymphoma' },
    { value: 'mantleCell', label: 'Mantle Cell Lymphoma' },
    { value: 'mds', label: 'MDS' },
    { value: 'mpn', label: 'MPN' },
    { value: 'tCellLymphoma', label: 'T-cell Lymphomas' },
    { value: 'cml', label: 'CML' },
    { value: 'waldenstrom', label: "Waldenstrom's Macroglobulinemia" },
    { value: 'hodgkins', label: 'Hodgkin Lymphoma' },
    { value: 'marginalZone', label: 'Marginal Zone Lymphoma' },
    { value: 'burkitt', label: 'Burkitt Lymphoma' },
    { value: 'primaryCNSLymphoma', label: 'Primary CNS Lymphoma' },
    { value: 'systemicMastocytosis', label: 'Systemic Mastocytosis' },
    { value: 'cmml', label: 'CMML' },
    { value: 'hairyCell', label: 'Hairy Cell Leukemia' },
    { value: 'amyloidosisAL', label: 'AL Amyloidosis' },
    { value: 'castlemanDisease', label: 'Castleman Disease' },
    { value: 'aplasticAnemia', label: 'Aplastic Anemia' },
    { value: 'bpdcn', label: 'BPDCN (Blastic Plasmacytoid)' },
  ]},
];

export const territoryOptions = [
  { value: 'global', label: 'Global' },
  { value: 'us_only', label: 'US Only' },
  { value: 'ex_us', label: 'Ex-US (All)' },
  { value: 'us_eu', label: 'US + Europe' },
  { value: 'us_japan', label: 'US + Japan' },
  { value: 'europe', label: 'Europe' },
  { value: 'japan', label: 'Japan' },
  { value: 'china', label: 'Greater China' },
  { value: 'canada', label: 'Canada' },
  { value: 'south_korea', label: 'South Korea' },
  { value: 'australia', label: 'Australia / NZ' },
  { value: 'apac_ex_cj', label: 'APAC ex-China/Japan' },
  { value: 'latam', label: 'Latin America' },
  { value: 'mena', label: 'Middle East & North Africa' },
  { value: 'row', label: 'Rest of World' },
];

export const biomarkerOptions = [
  { value: 'selected', label: 'Biomarker-selected' },
  { value: 'unselected', label: 'Broad / Unselected' },
];

export const lineOfTherapyOptions = [
  { value: '1L', label: 'First-line (1L)' },
  { value: '2L', label: 'Second-line (2L)' },
  { value: '3L+', label: 'Third-line+ (3L+)' },
];

export const combinationPotentialOptions = [
  { value: 'strong', label: 'Strong combo backbone potential' },
  { value: 'some', label: 'Some combo potential' },
  { value: 'standalone', label: 'Standalone only' },
];

export const competitivePositionOptions: { value: CompetitivePosition; label: string }[] = [
  { value: 'firstInClass', label: 'First-in-class, no competition' },
  { value: 'firstToPivotal', label: 'First to pivotal trial' },
  { value: 'bestInClass', label: 'Best-in-class potential' },
  { value: 'racing', label: 'Racing with 1-2 others' },
  { value: 'behind', label: 'Behind 3+ competitors' },
  { value: 'crowded', label: 'Crowded with approved drugs' },
];

export const dataQualityOptions = [
  { value: 'pivotalReady', label: 'Pivotal-ready data' },
  { value: 'strongPhase2', label: 'Strong Phase 2 (clear signal)' },
  { value: 'promising', label: 'Promising early data' },
  { value: 'mixed', label: 'Mixed / inconsistent results' },
  { value: 'limited', label: 'Limited data' },
];

export const regulatoryDesignationOptions = [
  { value: 'breakthrough', label: 'Breakthrough Therapy' },
  { value: 'fastTrack', label: 'Fast Track' },
  { value: 'orphan', label: 'Orphan Drug' },
  { value: 'prime', label: 'PRIME (EU)' },
];

// Therapeutic area options
export const therapeuticAreaOptions = [
  { value: 'oncology', label: 'Oncology' },
  { value: 'neurology', label: 'Neurology / CNS' },
  { value: 'immunology', label: 'Immunology / Autoimmune' },
  { value: 'metabolic', label: 'Metabolic / Obesity' },
  { value: 'cardiovascular', label: 'Cardiovascular' },
  { value: 'infectiousDisease', label: 'Infectious Disease' },
  { value: 'ophthalmology', label: 'Ophthalmology' },
  { value: 'womensHealth', label: "Women's Health" },
  { value: 'rareDisease', label: 'Rare Disease' },
  { value: 'hematology', label: 'Hematology' },
  { value: 'dermatology', label: 'Dermatology' },
  { value: 'gastroenterology', label: 'Gastroenterology / IBD' },
];

// Neurology-specific indication options
export const neurologyIndicationOptions = [
  { group: 'Neurodegeneration', options: [
    { value: 'alzheimers', label: "Alzheimer's Disease" },
    { value: 'parkinsons', label: "Parkinson's Disease" },
    { value: 'als', label: 'ALS (Amyotrophic Lateral Sclerosis)' },
    { value: 'huntingtons', label: "Huntington's Disease" },
    { value: 'frontotemporal', label: 'Frontotemporal Dementia (FTD)' },
    { value: 'lewyBody', label: 'Lewy Body Dementia' },
  ]},
  { group: 'Psychiatry', options: [
    { value: 'schizophrenia', label: 'Schizophrenia / Psychosis' },
    { value: 'depression', label: 'Depression / MDD' },
    { value: 'addiction', label: 'Addiction / Substance Use Disorders' },
    { value: 'bipolar', label: 'Bipolar Disorder' },
    { value: 'ptsd', label: 'PTSD / Trauma Disorders' },
    { value: 'ocd', label: 'OCD / Anxiety Disorders' },
    { value: 'adhd', label: 'ADHD' },
    { value: 'insomnia', label: 'Insomnia / Sleep Disorders' },
  ]},
  { group: 'Movement & Seizure', options: [
    { value: 'epilepsy', label: 'Epilepsy' },
    { value: 'tremor', label: 'Movement Disorders (Tremor / Dystonia)' },
  ]},
  { group: 'Other CNS', options: [
    { value: 'pain', label: 'Pain (Chronic / Neuropathic)' },
    { value: 'ms', label: 'Multiple Sclerosis' },
    { value: 'migraine', label: 'Migraine / Headache' },
    { value: 'narcolepsy', label: 'Narcolepsy / Sleep Disorders' },
    { value: 'tbi', label: 'Traumatic Brain Injury / Stroke Recovery' },
    { value: 'chronicPain', label: 'Chronic Pain (Non-Neuropathic)' },
    { value: 'clusterHeadache', label: 'Cluster Headache' },
    { value: 'restlessLeg', label: 'Restless Leg Syndrome' },
    { value: 'rareNeuro', label: 'Other Rare Neurological' },
  ]},
  { group: 'Neurodevelopmental & Rare', options: [
    { value: 'autism', label: 'Autism Spectrum Disorder' },
    { value: 'rett', label: 'Rett Syndrome' },
    { value: 'friedreichs', label: "Friedreich's Ataxia" },
    { value: 'dmd', label: 'Duchenne Muscular Dystrophy' },
    { value: 'sma', label: 'Spinal Muscular Atrophy (SMA)' },
    { value: 'angelman', label: 'Angelman Syndrome' },
    { value: 'dravet', label: 'Dravet Syndrome' },
    { value: 'myotonicDystrophy', label: 'Myotonic Dystrophy' },
    { value: 'tuberousSclerosis', label: 'Tuberous Sclerosis Complex' },
    { value: 'cmt', label: 'Charcot-Marie-Tooth Disease' },
    { value: 'fragileX', label: 'Fragile X Syndrome' },
    { value: 'cdkl5', label: 'CDKL5 Deficiency Disorder' },
    { value: 'praderWilli', label: 'Prader-Willi Syndrome' },
    { value: 'batten', label: 'Batten Disease (CLN)' },
    { value: 'ataxiaTelangiectasia', label: 'Ataxia Telangiectasia' },
  ]},
  { group: 'Neuromuscular', options: [
    { value: 'lgmd', label: 'Limb-Girdle Muscular Dystrophy' },
    { value: 'fshd', label: 'FSHD (Facioscapulohumeral Dystrophy)' },
    { value: 'stiffPerson', label: 'Stiff Person Syndrome' },
    { value: 'gbs', label: 'Guillain-Barré Syndrome' },
    { value: 'neurofibromatosis', label: 'Neurofibromatosis (NF1/NF2)' },
  ]},
  { group: 'Other Neurology', options: [
    { value: 'peripheralNeuropathy', label: 'Peripheral Neuropathy' },
    { value: 'spinalCordInjury', label: 'Spinal Cord Injury' },
  ]},
];

// Neurology-specific modality options
export const neurologyModalityOptions = [
  { group: 'Small Molecules', options: [
    { value: 'smallMolecule', label: 'Small Molecule' },
    { value: 'ionChannel', label: 'Ion Channel Modulator' },
    { value: 'protac', label: 'PROTAC / Degrader' },
  ]},
  { group: 'Biologics', options: [
    { value: 'mab', label: 'Monoclonal Antibody' },
    { value: 'tauTargeting', label: 'Tau-targeting Therapy' },
    { value: 'peptide', label: 'Peptide' },
  ]},
  { group: 'CNS Delivery & Platforms', options: [
    { value: 'bbbPlatform', label: 'BBB Delivery Platform' },
    { value: 'geneTherapy', label: 'Gene Therapy / Gene Editing' },
  ]},
  { group: 'RNA Therapeutics', options: [
    { value: 'aso', label: 'Antisense Oligonucleotide (ASO)' },
    { value: 'rnai', label: 'RNAi / siRNA' },
  ]},
  { group: 'Cell & Emerging', options: [
    { value: 'stemCell', label: 'Neural Stem Cell / Progenitor' },
    { value: 'psychedelic', label: 'Psychedelic / Neuroplastogen' },
    { value: 'cellTherapy', label: 'Cell Therapy (other)' },
  ]},
];

// Treatment approach options (neurology replacement for line of therapy)
export const treatmentApproachOptions = [
  { value: 'diseaseModifying', label: 'Disease-modifying' },
  { value: 'symptomatic', label: 'Symptomatic / Acute' },
  { value: 'adjunctive', label: 'Adjunctive / Supportive' },
];

export const bbbPenetrationOptions = [
  { value: 'provenCNS', label: 'Proven CNS penetration' },
  { value: 'promisingPreclinical', label: 'Promising preclinical BBB data' },
  { value: 'unproven', label: 'Unproven / standard' },
  { value: 'peripheralOnly', label: 'Peripheral only' },
];

export const diseaseProgressionOptions = [
  { value: 'slowProgressive', label: 'Slow progressive' },
  { value: 'moderateProgressive', label: 'Moderate progressive' },
  { value: 'rapidProgressive', label: 'Rapid progressive' },
  { value: 'episodic', label: 'Episodic / relapsing' },
];

export const biomarkerValidationOptions = [
  { value: 'validatedSurrogate', label: 'Validated surrogate endpoint' },
  { value: 'exploratory', label: 'Exploratory biomarker' },
  { value: 'noBiomarker', label: 'No biomarker' },
];

// Immunology-specific modality options
export const immunologyModalityOptions = [
  { group: 'Small Molecules', options: [
    { value: 'smallMolecule', label: 'Small Molecule' },
    { value: 'jakInhibitor', label: 'JAK / TYK2 Inhibitor' },
    { value: 's1pModulator', label: 'S1P Receptor Modulator' },
    { value: 'oralIntegrin', label: 'Oral Integrin Inhibitor' },
  ]},
  { group: 'Antibodies & Biologics', options: [
    { value: 'mab', label: 'Monoclonal Antibody' },
    { value: 'bispecific', label: 'Bispecific Antibody' },
    { value: 'tl1aInhibitor', label: 'Anti-TL1A' },
    { value: 'fcrnAntagonist', label: 'FcRn Antagonist' },
    { value: 'dualAntagonist', label: 'Dual BAFF/APRIL Antagonist' },
    { value: 'complementInhibitor', label: 'Complement Inhibitor' },
  ]},
  { group: 'Cell Therapy', options: [
    { value: 'carT_autoimmune', label: 'CAR-T (Autoimmune)' },
    { value: 'inVivoCarT', label: 'In Vivo CAR-T (LNP)' },
    { value: 'carTreg', label: 'CAR-Treg / Tolerizing' },
    { value: 'cellTherapy', label: 'Cell Therapy (other)' },
  ]},
  { group: 'RNA & Gene', options: [
    { value: 'rnai', label: 'RNAi / siRNA' },
    { value: 'geneTherapy', label: 'Gene Therapy' },
  ]},
  { group: 'Other', options: [
    { value: 'peptide', label: 'Peptide' },
  ]},
];

// Immunology-specific indication options
export const immunologyIndicationOptions = [
  { group: 'Inflammatory Bowel', options: [
    { value: 'ulcerativeColitis', label: 'Ulcerative Colitis' },
    { value: 'crohns', label: "Crohn's Disease" },
    { value: 'ibd_broad', label: 'IBD (Broad UC + CD)' },
    { value: 'celiac', label: 'Celiac Disease' },
  ]},
  { group: 'Rheumatologic', options: [
    { value: 'rheumatoidArthritis', label: 'Rheumatoid Arthritis' },
    { value: 'sle_lupus', label: 'Systemic Lupus (SLE)' },
    { value: 'lupusNephritis', label: 'Lupus Nephritis' },
    { value: 'systemicSclerosis', label: 'Systemic Sclerosis' },
    { value: 'sjogrens', label: "Sjogren's Syndrome" },
    { value: 'aancaVasculitis', label: 'ANCA Vasculitis' },
  ]},
  { group: 'Dermatologic', options: [
    { value: 'atopicderm', label: 'Atopic Dermatitis' },
    { value: 'psoriasis', label: 'Psoriasis' },
    { value: 'psoriaticArthritis', label: 'Psoriatic Arthritis' },
    { value: 'alopecia', label: 'Alopecia Areata' },
    { value: 'hidradenitis', label: 'Hidradenitis Suppurativa' },
    { value: 'vitiligo', label: 'Vitiligo' },
    { value: 'epidermolysis', label: 'Epidermolysis Bullosa' },
    { value: 'chronicUrticaria', label: 'Chronic Spontaneous Urticaria' },
  ]},
  { group: 'Neuromuscular & Rare', options: [
    { value: 'myastheniaGravis', label: 'Myasthenia Gravis' },
    { value: 'cidp', label: 'CIDP' },
    { value: 'multipleSclerosisMod', label: 'Multiple Sclerosis' },
    { value: 'pnh', label: 'PNH' },
    { value: 'pemphigus', label: 'Pemphigus / Bullous Diseases' },
    { value: 'itp', label: 'Immune Thrombocytopenia (ITP)' },
    { value: 'dermatomyositis', label: 'Dermatomyositis / Myositis' },
    { value: 'coldAgglutinin', label: 'Cold Agglutinin Disease' },
    { value: 'ttpAutoimmune', label: 'Autoimmune TTP' },
  ]},
  { group: 'Respiratory & Allergic', options: [
    { value: 'asthma', label: 'Severe Asthma' },
    { value: 'copd', label: 'COPD' },
    { value: 'ipf', label: 'Idiopathic Pulmonary Fibrosis (IPF)' },
    { value: 'eosinophilicEsophagitis', label: 'Eosinophilic Esophagitis (EoE)' },
    { value: 'foodAllergy', label: 'Food Allergy (IgE-mediated)' },
    { value: 'heredAngioedema', label: 'Hereditary Angioedema (HAE)' },
  ]},
  { group: 'Transplant', options: [
    { value: 'gvhd', label: 'Graft-vs-Host Disease (GVHD)' },
    { value: 'organTransplant', label: 'Solid Organ Transplant Rejection' },
  ]},
  { group: 'Renal & Rare', options: [
    { value: 'igan', label: 'IgA Nephropathy' },
    { value: 'membranousNephropathy', label: 'Membranous Nephropathy' },
    { value: 'fsgs', label: 'FSGS (Focal Segmental)' },
    { value: 'thyroidEye', label: 'Thyroid Eye Disease' },
    { value: 'pbc', label: 'Primary Biliary Cholangitis (PBC)' },
    { value: 'psc', label: 'Primary Sclerosing Cholangitis (PSC)' },
    { value: 'autoImmuneHepatitis', label: 'Autoimmune Hepatitis' },
    { value: 'nephroticSyndrome', label: 'Nephrotic Syndrome (General)' },
    { value: 'rareAutoimmune', label: 'Other Rare Autoimmune' },
  ]},
  { group: 'Musculoskeletal & Vascular', options: [
    { value: 'ankylosingSpondylitis', label: 'Ankylosing Spondylitis' },
    { value: 'giantCellArteritis', label: 'Giant Cell Arteritis (GCA)' },
    { value: 'polymyalgiaRheumatica', label: 'Polymyalgia Rheumatica' },
    { value: 'behcets', label: "Behcet's Disease" },
    { value: 'egpa', label: 'EGPA (Eosinophilic Granulomatosis)' },
    { value: 'antiphospholipid', label: 'Antiphospholipid Syndrome' },
    { value: 'systemicJIA', label: 'Systemic JIA / Still\'s Disease' },
  ]},
  { group: 'Other Autoimmune', options: [
    { value: 'sarcoidosis', label: 'Sarcoidosis' },
    { value: 'uveitis', label: 'Autoimmune Uveitis' },
    { value: 'primaryImmunodeficiency', label: 'Primary Immunodeficiency' },
  ]},
];

// Immunology-specific parameter options
export const immuneResetOptions = [
  { value: 'curativeIntent', label: 'Curative intent (drug-free remission)' },
  { value: 'durableRemission', label: 'Durable remission (years)' },
  { value: 'chronicTreatment', label: 'Chronic treatment' },
];

export const targetSpecificityOptions = [
  { value: 'antigenSpecific', label: 'Antigen-specific' },
  { value: 'pathwayTargeted', label: 'Pathway-targeted' },
  { value: 'broadImmunosuppression', label: 'Broad immunosuppression' },
];

export const diseaseSeverityOptions = [
  { value: 'mildModerate', label: 'Mild-moderate' },
  { value: 'moderateSevere', label: 'Moderate-severe' },
  { value: 'severe', label: 'Severe / refractory' },
  { value: 'refractory', label: 'Multi-refractory' },
];

export const treatmentGoalOptions = [
  { value: 'remissionInduction', label: 'Remission induction' },
  { value: 'maintenance', label: 'Maintenance / prevention' },
  { value: 'flareControl', label: 'Acute flare control' },
];

// Metabolic-specific modality options
export const metabolicModalityOptions = [
  { group: 'Incretin-Based', options: [
    { value: 'glp1Agonist', label: 'GLP-1 Receptor Agonist' },
    { value: 'dualIncretin', label: 'Dual Incretin (GLP-1/GIP)' },
    { value: 'tripleIncretin', label: 'Triple Agonist (GLP-1/GIP/Glucagon)' },
    { value: 'amylinAnalog', label: 'Amylin Analog / Cagrilintide-type' },
    { value: 'oralPeptide', label: 'Oral Peptide (Oral Semaglutide-type)' },
  ]},
  { group: 'Non-Incretin Biologics', options: [
    { value: 'mab', label: 'Monoclonal Antibody' },
    { value: 'antiActivin', label: 'Anti-Activin / Myostatin (Muscle-sparing)' },
    { value: 'bispecific', label: 'Bispecific Antibody' },
  ]},
  { group: 'Small Molecules & SGLT2', options: [
    { value: 'smallMolecule', label: 'Small Molecule' },
    { value: 'sglt2Inhibitor', label: 'SGLT2 Inhibitor' },
  ]},
  { group: 'Advanced Modalities', options: [
    { value: 'geneTherapy', label: 'Gene Therapy (Metabolic)' },
    { value: 'rnai', label: 'RNA Therapeutics (siRNA/ASO)' },
    { value: 'microbiomeBased', label: 'Microbiome-Based Therapy' },
  ]},
];

// Metabolic-specific indication options
export const metabolicIndicationOptions = [
  { group: 'Obesity & Weight', options: [
    { value: 'obesity', label: 'Obesity / Chronic Weight Management' },
    { value: 'metabolicSyndrome', label: 'Metabolic Syndrome' },
  ]},
  { group: 'Diabetes & Glycemic', options: [
    { value: 'type2Diabetes', label: 'Type 2 Diabetes' },
    { value: 'type1Diabetes', label: 'Type 1 Diabetes' },
  ]},
  { group: 'Organ-Specific Metabolic', options: [
    { value: 'nashMash', label: 'NASH / MASH (Fatty Liver)' },
    { value: 'lipodystrophy', label: 'Lipodystrophy' },
    { value: 'ckdMetabolic', label: 'CKD (Metabolic/Diabetic)' },
  ]},
  { group: 'Cardiovascular-Metabolic', options: [
    { value: 'hfpef', label: 'HFpEF (Heart Failure)' },
    { value: 'familialHypercholesterolemia', label: 'Familial Hypercholesterolemia' },
  ]},
  { group: 'Endocrine', options: [
    { value: 'acromegaly', label: 'Acromegaly' },
    { value: 'cushings', label: "Cushing's Syndrome" },
    { value: 'congenitalAdrenalHyperplasia', label: 'Congenital Adrenal Hyperplasia (CAH)' },
    { value: 'congenitalHyperinsulinism', label: 'Congenital Hyperinsulinism' },
  ]},
  { group: 'Other Metabolic', options: [
    { value: 'gout', label: 'Gout / Hyperuricemia' },
    { value: 'hemochromatosis', label: 'Hereditary Hemochromatosis' },
  ]},
  { group: 'Rare Metabolic', options: [
    { value: 'glycogenStorage', label: 'Glycogen Storage Disease' },
    { value: 'pku', label: 'PKU (Phenylketonuria)' },
    { value: 'wilsonDisease', label: 'Wilson Disease' },
    { value: 'fabry', label: 'Fabry Disease' },
    { value: 'gaucher', label: 'Gaucher Disease' },
    { value: 'pompe', label: 'Pompe Disease' },
    { value: 'mpsDisorders', label: 'MPS Disorders (I/II/III/IV)' },
    { value: 'aatDeficiency', label: 'Alpha-1 Antitrypsin Deficiency' },
    { value: 'hyperoxaluria', label: 'Primary Hyperoxaluria' },
    { value: 'ureaCycleDisorders', label: 'Urea Cycle Disorders' },
    { value: 'asmd', label: 'ASMD (Niemann-Pick B)' },
    { value: 'cystinosis', label: 'Cystinosis' },
    { value: 'galactosemia', label: 'Classic Galactosemia' },
    { value: 'krabbe', label: 'Krabbe Disease' },
    { value: 'hypophosphatasia', label: 'Hypophosphatasia' },
    { value: 'porphyria', label: 'Acute Hepatic Porphyria' },
    { value: 'mitochondrialDisease', label: 'Mitochondrial Disease' },
    { value: 'rareMetabolic', label: 'Other Rare Metabolic' },
  ]},
  { group: 'Hematologic (Non-Malignant)', options: [
    { value: 'sickleCell', label: 'Sickle Cell Disease' },
    { value: 'betaThalassemia', label: 'Beta-Thalassemia' },
    { value: 'hemophiliaA', label: 'Hemophilia A' },
    { value: 'hemophiliaB', label: 'Hemophilia B' },
    { value: 'attrAmyloidosis', label: 'ATTR Amyloidosis (Cardiac/Neuro)' },
  ]},
  { group: 'Respiratory (Genetic)', options: [
    { value: 'cysticFibrosis', label: 'Cystic Fibrosis' },
  ]},
];

// Metabolic-specific parameter options
export const mechanismDifferentiationOptions = [
  { value: 'incretinBased', label: 'Incretin-based (GLP-1 class)' },
  { value: 'nonIncretin', label: 'Non-incretin mechanism' },
  { value: 'combinationMechanism', label: 'Combination / multi-pathway' },
];

export const weightLossEfficacyOptions = [
  { value: 'superiorEfficacy', label: 'Superior (>20% weight loss)' },
  { value: 'competitiveEfficacy', label: 'Competitive (15-20% weight loss)' },
  { value: 'modestEfficacy', label: 'Modest (<15% weight loss)' },
];

export const routeOfAdministrationOptions = [
  { value: 'oral', label: 'Oral administration' },
  { value: 'injectable', label: 'Injectable (SC/weekly or less)' },
  { value: 'implantable', label: 'Implantable / long-acting depot' },
];

export const comorbidityBreadthOptions = [
  { value: 'cardiometabolicBenefit', label: 'Cardiometabolic benefit (CV + metabolic)' },
  { value: 'obesityPrimary', label: 'Obesity-primary (weight only)' },
  { value: 'organProtective', label: 'Organ-protective (liver, kidney, heart)' },
];

export const metabolicTreatmentApproachOptions = [
  { value: 'chronicWeightMgmt', label: 'Chronic weight management' },
  { value: 'glycemicControl', label: 'Glycemic control' },
  { value: 'organProtective', label: 'Organ-protective' },
  { value: 'metabolicReset', label: 'Metabolic reset / curative' },
];

// ── Cardiovascular ──

export const cardiovascularModalityOptions = [
  { group: 'Small Molecules', options: [
    { value: 'smallMolecule', label: 'Small Molecule' },
    { value: 'myosinInhibitor', label: 'Cardiac Myosin Inhibitor' },
    { value: 'anticoagulantNovel', label: 'Novel Anticoagulant (FXI/FXII)' },
  ]},
  { group: 'Biologics', options: [
    { value: 'mab', label: 'Monoclonal Antibody' },
    { value: 'pcsk9Targeting', label: 'PCSK9-targeting (mAb/siRNA)' },
    { value: 'peptide', label: 'Peptide' },
  ]},
  { group: 'RNA & Gene', options: [
    { value: 'rnaCardio', label: 'RNA Therapeutics (siRNA/ASO)' },
    { value: 'geneTherapy', label: 'Gene Therapy (Cardiac)' },
  ]},
  { group: 'Other', options: [
    { value: 'cellTherapy', label: 'Cell Therapy (Cardiac Regeneration)' },
  ]},
];

export const cardiovascularIndicationOptions = [
  { group: 'Heart Failure', options: [
    { value: 'heartFailureHfref', label: 'Heart Failure (HFrEF)' },
    { value: 'heartFailureHfpef', label: 'Heart Failure (HFpEF)' },
    { value: 'cardiomyopathy', label: 'Cardiomyopathy (HCM/DCM)' },
    { value: 'hypertrophicCardiomyopathy', label: 'Hypertrophic Cardiomyopathy (HCM)' },
    { value: 'dilatedCardiomyopathy', label: 'Dilated Cardiomyopathy (DCM)' },
    { value: 'transthyretinCardiomyopathy', label: 'Transthyretin Cardiomyopathy (ATTR-CM)' },
    { value: 'attrCardiomyopathy', label: 'ATTR Cardiomyopathy (Transthyretin)' },
  ]},
  { group: 'Acute Coronary & Stroke', options: [
    { value: 'acuteCoronarySyndrome', label: 'Acute Coronary Syndrome (ACS)' },
    { value: 'stroke', label: 'Stroke (Ischemic/Hemorrhagic)' },
  ]},
  { group: 'Arrhythmia & Structural', options: [
    { value: 'atrialFibrillation', label: 'Atrial Fibrillation' },
    { value: 'supraventricularTachycardia', label: 'Supraventricular Tachycardia (SVT)' },
    { value: 'cardiacArrhythmia', label: 'Cardiac Arrhythmias' },
    { value: 'longQtSyndrome', label: 'Long QT Syndrome' },
    { value: 'aorticStenosis', label: 'Aortic Stenosis' },
    { value: 'mitralRegurgitation', label: 'Mitral Regurgitation' },
    { value: 'aorticAneurysm', label: 'Aortic Aneurysm' },
  ]},
  { group: 'Vascular', options: [
    { value: 'pulmonaryArterialHypertension', label: 'Pulmonary Arterial Hypertension (PAH)' },
    { value: 'coronaryArteryDisease', label: 'Coronary Artery Disease (CAD)' },
    { value: 'peripheralArteryDisease', label: 'Peripheral Artery Disease (PAD)' },
    { value: 'atherosclerosis', label: 'Atherosclerosis / ASCVD' },
  ]},
  { group: 'Thrombosis & Lipids', options: [
    { value: 'venousThromboembolism', label: 'Venous Thromboembolism (VTE)' },
    { value: 'deepVeinThrombosis', label: 'Deep Vein Thrombosis (DVT)' },
    { value: 'pulmonaryEmbolism', label: 'Pulmonary Embolism (PE)' },
    { value: 'dyslipidemia', label: 'Dyslipidemia' },
    { value: 'hyperlipidemiaFamilial', label: 'Familial Hyperlipidemia' },
    { value: 'lipoproteinA', label: 'Lipoprotein(a) Elevated' },
  ]},
  { group: 'Other Cardiovascular', options: [
    { value: 'resistantHypertension', label: 'Resistant Hypertension' },
    { value: 'myocarditis', label: 'Myocarditis / Pericarditis' },
    { value: 'cardiacFibrosis', label: 'Cardiac Fibrosis' },
  ]},
];

export const cvOutcomeBenefitOptions = [
  { value: 'mortalityReduction', label: 'CV mortality reduction' },
  { value: 'hospitalizationReduction', label: 'Hospitalization reduction' },
  { value: 'symptomImprovement', label: 'Symptom improvement only' },
];

export const cvTrialEndpointOptions = [
  { value: 'maceEndpoint', label: 'MACE endpoint (hard outcomes)' },
  { value: 'surrogateBiomarker', label: 'Surrogate biomarker (NT-proBNP, LDL)' },
  { value: 'functionalEndpoint', label: 'Functional endpoint (6MWD, KCCQ)' },
];

export const cvPopulationRiskOptions = [
  { value: 'highRisk', label: 'High-risk (prior MACE, HF)' },
  { value: 'moderateRisk', label: 'Moderate risk' },
  { value: 'primaryPrevention', label: 'Primary prevention' },
];

// ── Infectious Disease ──

export const infectiousDiseaseModalityOptions = [
  { group: 'Small Molecules', options: [
    { value: 'smallMolecule', label: 'Small Molecule' },
    { value: 'antiviral', label: 'Small Molecule Antiviral' },
    { value: 'antibioticNovel', label: 'Novel Antibiotic' },
  ]},
  { group: 'Biologics', options: [
    { value: 'mab', label: 'Monoclonal Antibody' },
  ]},
  { group: 'Vaccines', options: [
    { value: 'vaccinePreventive', label: 'Preventive Vaccine (non-mRNA)' },
    { value: 'mrna', label: 'mRNA Vaccine' },
  ]},
  { group: 'Advanced', options: [
    { value: 'rnai', label: 'RNAi / siRNA' },
    { value: 'geneTherapy', label: 'Gene Therapy / Gene Editing' },
    { value: 'phageTherapy', label: 'Bacteriophage Therapy' },
  ]},
];

export const infectiousDiseaseIndicationOptions = [
  { group: 'Viral — Chronic', options: [
    { value: 'hivAids', label: 'HIV/AIDS' },
    { value: 'hepatitisB', label: 'Hepatitis B (Chronic)' },
    { value: 'hepatitisD', label: 'Hepatitis D' },
    { value: 'hepatitisC', label: 'Hepatitis C (HCV Cure)' },
    { value: 'cmvInfection', label: 'CMV Infection' },
    { value: 'ebv', label: 'Epstein-Barr Virus (EBV)' },
  ]},
  { group: 'Viral — Acute / Respiratory', options: [
    { value: 'rsv', label: 'RSV' },
    { value: 'respiratorySyncytialVirusPediatric', label: 'RSV (Pediatric)' },
    { value: 'influenza', label: 'Influenza' },
    { value: 'hmpv', label: 'Human Metapneumovirus (hMPV)' },
    { value: 'covid', label: 'COVID-19 / Coronavirus' },
    { value: 'norovirus', label: 'Norovirus' },
    { value: 'mpox', label: 'Mpox (Monkeypox)' },
  ]},
  { group: 'Vector-Borne & Emerging', options: [
    { value: 'dengue', label: 'Dengue' },
    { value: 'malaria', label: 'Malaria' },
    { value: 'dengueMalaria', label: 'Dengue / Malaria (Combined)' },
    { value: 'zika', label: 'Zika Virus' },
    { value: 'chikungunya', label: 'Chikungunya' },
    { value: 'lymeDisease', label: 'Lyme Disease' },
  ]},
  { group: 'Bacterial', options: [
    { value: 'amrBacterial', label: 'AMR / Novel Antibiotics' },
    { value: 'tuberculosis', label: 'Tuberculosis (TB)' },
    { value: 'clostridioides', label: 'C. difficile' },
    { value: 'meningococcal', label: 'Meningococcal Disease' },
    { value: 'pneumococcal', label: 'Pneumococcal Disease' },
    { value: 'gonorrhea', label: 'Gonorrhea (Drug-Resistant)' },
    { value: 'syphilis', label: 'Syphilis' },
  ]},
  { group: 'Fungal', options: [
    { value: 'fungalInfections', label: 'Invasive Fungal Infections' },
    { value: 'candidaInvasive', label: 'Invasive Candidiasis' },
    { value: 'aspergillosisInvasive', label: 'Invasive Aspergillosis' },
  ]},
];

export const resistanceProfileOptions = [
  { value: 'novelTarget', label: 'Novel target / first-in-class' },
  { value: 'existingClassImproved', label: 'Existing class, improved profile' },
  { value: 'broadSpectrum', label: 'Broad-spectrum' },
];

export const infectionChronicityOptions = [
  { value: 'acute', label: 'Acute infection' },
  { value: 'chronic', label: 'Chronic infection' },
  { value: 'latent', label: 'Latent / prophylaxis' },
];

export const publicHealthPriorityOptions = [
  { value: 'whoUrgent', label: 'WHO urgent / BARDA priority' },
  { value: 'whoCritical', label: 'WHO critical priority' },
  { value: 'standard', label: 'Standard priority' },
];

// ── Ophthalmology ──

export const ophthalmologyModalityOptions = [
  { group: 'Biologics', options: [
    { value: 'antiVegf', label: 'Anti-VEGF (antibody/fragment)' },
    { value: 'mab', label: 'Monoclonal Antibody (non-VEGF)' },
    { value: 'bispecific', label: 'Bispecific Antibody' },
  ]},
  { group: 'Small Molecules', options: [
    { value: 'smallMolecule', label: 'Small Molecule' },
    { value: 'topicalOphthalmic', label: 'Topical (Eye Drop)' },
  ]},
  { group: 'Delivery & Devices', options: [
    { value: 'intravitreal', label: 'Intravitreal Implant / Depot' },
    { value: 'geneTherapyOcular', label: 'Ocular Gene Therapy (AAV)' },
  ]},
  { group: 'Other', options: [
    { value: 'cellTherapy', label: 'Cell Therapy (Retinal)' },
    { value: 'rnai', label: 'RNAi / Aptamer' },
  ]},
];

export const ophthalmologyIndicationOptions = [
  { group: 'Retinal — AMD', options: [
    { value: 'wetAmd', label: 'Wet AMD (nAMD)' },
    { value: 'dryAmdGA', label: 'Dry AMD / Geographic Atrophy' },
  ]},
  { group: 'Retinal — Diabetic', options: [
    { value: 'diabeticRetinopathy', label: 'Diabetic Retinopathy' },
    { value: 'diabeticMacularEdema', label: 'Diabetic Macular Edema (DME)' },
    { value: 'proliferativeDiabeticRetinopathy', label: 'Proliferative Diabetic Retinopathy' },
  ]},
  { group: 'Retinal — Vascular & Inflammatory', options: [
    { value: 'retinalVeinOcclusion', label: 'Retinal Vein Occlusion' },
    { value: 'uveiticMacular', label: 'Uveitic Macular Edema' },
    { value: 'uveitisNonInfectious', label: 'Uveitis (Non-Infectious)' },
    { value: 'opticNeuritis', label: 'Optic Neuritis' },
  ]},
  { group: 'Inherited Retinal Diseases', options: [
    { value: 'retinitisPigmentosa', label: 'Retinitis Pigmentosa' },
    { value: 'stargardt', label: 'Stargardt Disease' },
    { value: 'stargardtDisease', label: 'Stargardt Disease (ABCA4)' },
    { value: 'leberCongenitalAmaurosis', label: 'Leber Congenital Amaurosis (LCA)' },
    { value: 'choroideremia', label: 'Choroideremia' },
    { value: 'xLinkedRetinoschisis', label: 'X-Linked Retinoschisis' },
    { value: 'achromatopsia', label: 'Achromatopsia / Color Vision' },
  ]},
  { group: 'Anterior Segment', options: [
    { value: 'glaucoma', label: 'Glaucoma' },
    { value: 'dryEyeDisease', label: 'Dry Eye Disease' },
    { value: 'allergicConjunctivitis', label: 'Allergic Conjunctivitis' },
    { value: 'meibomianGlandDysfunction', label: 'Meibomian Gland Dysfunction' },
    { value: 'myopiaProgression', label: 'Myopia (Progressive)' },
    { value: 'presbyopia', label: 'Presbyopia' },
  ]},
  { group: 'Corneal', options: [
    { value: 'keratoconus', label: 'Keratoconus' },
    { value: 'fuchsDystrophy', label: "Fuchs' Endothelial Dystrophy" },
    { value: 'cornealDystrophy', label: 'Corneal Dystrophy (Other)' },
    { value: 'cornealNeovascularization', label: 'Corneal Neovascularization' },
  ]},
];

export const ocularDeliveryOptions = [
  { value: 'intravitreal', label: 'Intravitreal injection' },
  { value: 'topical', label: 'Topical (eye drop)' },
  { value: 'oral', label: 'Oral / systemic' },
  { value: 'implant', label: 'Implant / sustained-release' },
];

export const treatmentDurabilityOptions = [
  { value: 'oneTime', label: 'One-time (gene therapy)' },
  { value: 'extendedDuration', label: 'Extended duration (3-6+ months)' },
  { value: 'chronicInjection', label: 'Chronic injection (monthly-bimonthly)' },
];

export const visionImpactOptions = [
  { value: 'visionThreatening', label: 'Vision-threatening' },
  { value: 'visionImpairing', label: 'Vision-impairing' },
  { value: 'symptomRelief', label: 'Symptom relief' },
];

// ── Women's Health ──

export const womensHealthModalityOptions = [
  { group: 'Small Molecules', options: [
    { value: 'smallMolecule', label: 'Small Molecule' },
    { value: 'gnrhAntagonist', label: 'GnRH Antagonist (Oral)' },
  ]},
  { group: 'Biologics', options: [
    { value: 'mab', label: 'Monoclonal Antibody' },
    { value: 'peptide', label: 'Peptide' },
  ]},
  { group: 'Hormonal & Neuroactive', options: [
    { value: 'hormoneTherapy', label: 'Hormone Therapy / HRT' },
    { value: 'neuroactiveSteroid', label: 'Neuroactive Steroid' },
  ]},
  { group: 'Advanced', options: [
    { value: 'geneTherapy', label: 'Gene Therapy' },
    { value: 'cellTherapy', label: 'Cell Therapy' },
  ]},
];

export const womensHealthIndicationOptions = [
  { group: 'Reproductive', options: [
    { value: 'endometriosis', label: 'Endometriosis' },
    { value: 'uterineFibroids', label: 'Uterine Fibroids' },
    { value: 'pcos', label: 'Polycystic Ovary Syndrome (PCOS)' },
    { value: 'polycysticOvarySyndrome', label: 'PCOS (Metabolic/Reproductive)' },
    { value: 'prematureOvarianInsufficiency', label: 'Premature Ovarian Insufficiency (POI)' },
    { value: 'fertilityArt', label: 'Fertility / IVF' },
    { value: 'contraceptionNovel', label: 'Novel Contraception' },
  ]},
  { group: 'Menopause & Hormonal', options: [
    { value: 'menopause', label: 'Menopause / Vasomotor Symptoms' },
    { value: 'vaginalAtrophy', label: 'Vaginal Atrophy / GSM' },
    { value: 'vulvovaginalAtrophy', label: 'Vulvovaginal Atrophy' },
  ]},
  { group: 'Maternal', options: [
    { value: 'postpartumDepression', label: 'Postpartum Depression' },
    { value: 'preeclampsia', label: 'Preeclampsia' },
    { value: 'prematureLabor', label: 'Premature Labor / Preterm Birth' },
    { value: 'preterm', label: 'Preterm Birth Prevention' },
    { value: 'postpartumHemorrhage', label: 'Postpartum Hemorrhage' },
    { value: 'gestationalDiabetes', label: 'Gestational Diabetes' },
    { value: 'hyperemesisGravidarum', label: 'Hyperemesis Gravidarum' },
    { value: 'placentaAccreta', label: 'Placenta Accreta Spectrum' },
  ]},
  { group: 'Menstrual & Uterine', options: [
    { value: 'menorrhagia', label: 'Menorrhagia (Heavy Menstrual Bleeding)' },
    { value: 'dysmenorrhea', label: 'Dysmenorrhea (Painful Periods)' },
    { value: 'menstrualDisorders', label: 'Menstrual Disorders (HMB/Amenorrhea)' },
    { value: 'endometrialHyperplasia', label: 'Endometrial Hyperplasia' },
  ]},
  { group: 'Pelvic & Pain', options: [
    { value: 'vulvodynia', label: 'Vulvodynia / Chronic Pelvic Pain' },
    { value: 'cervicalDysplasia', label: 'Cervical Dysplasia / HPV Therapeutics' },
  ]},
  { group: 'Oncology & Prevention', options: [
    { value: 'breastCancerPrevention', label: 'Breast Cancer Prevention' },
    { value: 'ovarian', label: 'Ovarian Cancer' },
    { value: 'uterineCorpus', label: 'Uterine Corpus Cancer' },
    { value: 'ovarianCancerScreening', label: 'Ovarian Cancer Early Detection' },
  ]},
];

export const whTargetPopulationOptions = [
  { value: 'reproductiveAge', label: 'Reproductive age' },
  { value: 'perimenopause', label: 'Perimenopause' },
  { value: 'postmenopause', label: 'Postmenopause' },
  { value: 'pregnancy', label: 'Pregnancy / peripartum' },
];

export const whUnmetNeedOptions = [
  { value: 'noApprovedTherapy', label: 'No approved therapy' },
  { value: 'inadequateOptions', label: 'Inadequate options' },
  { value: 'wellServed', label: 'Well-served market' },
];

export const whRegulatoryOptions = [
  { value: 'acceleratedPathway', label: 'Accelerated pathway' },
  { value: 'standardPathway', label: 'Standard pathway' },
  { value: 'pregnancyComplexity', label: 'Pregnancy complexity (REMS/safety)' },
];

// ── Rare Disease ──

export const rareDiseaseIndicationOptions = [
  { group: 'Neuromuscular / Connective Tissue', options: [
    { value: 'spinalMuscularAtrophy', label: 'Spinal Muscular Atrophy (SMA)' },
    { value: 'duchenneMD', label: 'Duchenne Muscular Dystrophy (DMD)' },
    { value: 'rareNeuro', label: 'Rare Neurological (ALS, Rett, Other)' },
    { value: 'marfanSyndrome', label: 'Marfan Syndrome' },
    { value: 'ehlersDanlos', label: 'Ehlers-Danlos Syndrome' },
  ]},
  { group: 'Lysosomal Storage', options: [
    { value: 'fabryDisease', label: 'Fabry Disease' },
    { value: 'gaucherDisease', label: 'Gaucher Disease' },
    { value: 'pompeDisease', label: 'Pompe Disease' },
    { value: 'mucopolysaccharidosis', label: 'Mucopolysaccharidosis (MPS I/II/III)' },
    { value: 'niemannPickC', label: 'Niemann-Pick Disease Type C' },
    { value: 'cystinosis', label: 'Cystinosis' },
  ]},
  { group: 'Neurogenetic', options: [
    { value: 'neuronalCeroidLipofuscinosis', label: 'Batten Disease (NCL)' },
    { value: 'fragileX', label: 'Fragile X Syndrome' },
    { value: 'tuberousSclerosis', label: 'Tuberous Sclerosis Complex' },
    { value: 'dravetSyndrome', label: 'Dravet Syndrome' },
    { value: 'praderWilli', label: 'Prader-Willi Syndrome' },
    { value: 'angelman', label: 'Angelman Syndrome' },
  ]},
  { group: 'Genetic / Metabolic', options: [
    { value: 'cysticFibrosis', label: 'Cystic Fibrosis' },
    { value: 'pku', label: 'Phenylketonuria (PKU)' },
    { value: 'huntingtonDisease', label: "Huntington's Disease" },
    { value: 'wilsonDisease', label: 'Wilson Disease' },
    { value: 'alpha1Antitrypsin', label: 'Alpha-1 Antitrypsin Deficiency' },
    { value: 'methylmalonicAcidemia', label: 'Methylmalonic Acidemia' },
    { value: 'propionicAcidemia', label: 'Propionic Acidemia' },
    { value: 'ornithineTranscarbamylaseDeficiency', label: 'OTC Deficiency' },
  ]},
  { group: 'Hematologic Rare', options: [
    { value: 'hemophiliaA', label: 'Hemophilia A' },
    { value: 'hemophiliaB', label: 'Hemophilia B' },
    { value: 'sickleCell', label: 'Sickle Cell Disease' },
    { value: 'betaThalassemia', label: 'Beta-Thalassemia' },
    { value: 'hereditaryAngioedema', label: 'Hereditary Angioedema' },
  ]},
  { group: 'Skeletal / Other', options: [
    { value: 'xlh', label: 'X-Linked Hypophosphatemia (XLH)' },
  ]},
];

export const rareDiseaseModalityOptions = [
  { group: 'Gene & Cell Therapy', options: [
    { value: 'geneTherapy', label: 'Gene Therapy (AAV)' },
    { value: 'geneTherapyRare', label: 'Gene Therapy (Lentiviral/Other)' },
    { value: 'cellTherapy', label: 'Cell Therapy (ex vivo)' },
    { value: 'geneEditing', label: 'Gene Editing (CRISPR)' },
  ]},
  { group: 'Enzyme & Substrate', options: [
    { value: 'enzymeReplacement', label: 'Enzyme Replacement Therapy' },
    { value: 'substrateReduction', label: 'Substrate Reduction Therapy' },
  ]},
  { group: 'RNA Therapeutics', options: [
    { value: 'aso', label: 'Antisense Oligonucleotide (ASO)' },
    { value: 'rnai', label: 'siRNA' },
    { value: 'mrna', label: 'mRNA Therapeutics' },
  ]},
  { group: 'Other', options: [
    { value: 'smallMolecule', label: 'Small Molecule' },
    { value: 'mab', label: 'Monoclonal Antibody' },
    { value: 'peptide', label: 'Engineered Protein' },
  ]},
];

export const orphanDesignationOptions = [
  { value: 'both_orphan', label: 'FDA + EMA Orphan Designation' },
  { value: 'fda_orphan', label: 'FDA Orphan Only' },
  { value: 'ema_orphan', label: 'EMA Orphan Only' },
  { value: 'none', label: 'No Orphan Designation' },
];

export const patientPopulationSizeOptions = [
  { value: 'ultraRare_sub1k', label: 'Ultra-rare (<1,000 patients)' },
  { value: 'rare_1k_10k', label: 'Rare (1,000–10,000 patients)' },
  { value: 'rare_10k_50k', label: 'Rare (10,000–50,000 patients)' },
  { value: 'broader_50k_200k', label: 'Broader rare (50,000–200,000 patients)' },
];

export const geneticBasisOptions = [
  { value: 'monogenic_validated', label: 'Monogenic — validated target' },
  { value: 'polygenic', label: 'Polygenic' },
  { value: 'unknown_genetic', label: 'Unknown genetic basis' },
  { value: 'non_genetic', label: 'Non-genetic' },
];

// ── Hematology ──

export const hematologyIndicationOptions = [
  { group: 'Lymphoid Malignancies', options: [
    { value: 'dlbcl', label: 'Diffuse Large B-Cell Lymphoma (DLBCL)' },
    { value: 'follicularLymphoma', label: 'Follicular Lymphoma' },
    { value: 'mantleCellLymphoma', label: 'Mantle Cell Lymphoma' },
    { value: 'cll', label: 'CLL / SLL' },
    { value: 'hodgkinLymphoma', label: "Hodgkin's Lymphoma" },
    { value: 'waldenstroms', label: "Waldenström's Macroglobulinemia" },
    { value: 'marginalZoneLymphoma', label: 'Marginal Zone Lymphoma' },
    { value: 'burkittLymphoma', label: 'Burkitt Lymphoma' },
    { value: 'primaryCnsLymphoma', label: 'Primary CNS Lymphoma' },
    { value: 'richtersTransformation', label: "Richter's Transformation" },
  ]},
  { group: 'T-Cell Malignancies', options: [
    { value: 'peripheralTCellLymphoma', label: 'Peripheral T-Cell Lymphoma (PTCL)' },
    { value: 'cutaneousTCellLymphoma', label: 'Cutaneous T-Cell Lymphoma (CTCL)' },
  ]},
  { group: 'Plasma Cell', options: [
    { value: 'myeloma', label: 'Multiple Myeloma' },
  ]},
  { group: 'Myeloid Malignancies', options: [
    { value: 'aml', label: 'Acute Myeloid Leukemia (AML)' },
    { value: 'mds', label: 'Myelodysplastic Syndromes (MDS)' },
    { value: 'all', label: 'Acute Lymphoblastic Leukemia (ALL)' },
    { value: 'chronicMyeloidLeukemia', label: 'Chronic Myeloid Leukemia (CML)' },
    { value: 'polycythemiaVera', label: 'Polycythemia Vera' },
    { value: 'myelofibrosis', label: 'Myelofibrosis' },
    { value: 'myeloproliferativeNeoplasm', label: 'Myeloproliferative Neoplasm (Other)' },
    { value: 'bpdcn', label: 'BPDCN (Blastic Plasmacytoid DC Neoplasm)' },
    { value: 'mastocytosis', label: 'Systemic Mastocytosis' },
    { value: 'hairyCellLeukemia', label: 'Hairy Cell Leukemia' },
  ]},
  { group: 'Non-Malignant', options: [
    { value: 'itp', label: 'Immune Thrombocytopenia (ITP)' },
    { value: 'ttp', label: 'Thrombotic Thrombocytopenic Purpura (TTP)' },
    { value: 'aplasticAnemia', label: 'Aplastic Anemia' },
    { value: 'thalassemiaTransfusionDependent', label: 'Thalassemia (Transfusion-Dependent)' },
    { value: 'vonWillebrand', label: 'Von Willebrand Disease' },
    { value: 'thrombocytopeniaChemotherapy', label: 'Chemotherapy-Induced Thrombocytopenia' },
    { value: 'hemolyticAnemia', label: 'Autoimmune Hemolytic Anemia' },
    { value: 'paroxysomalNocturnalHemoglobinuria', label: 'PNH (Paroxysmal Nocturnal Hemoglobinuria)' },
  ]},
];

export const hematologyModalityOptions = [
  { group: 'Cell Therapy', options: [
    { value: 'carT_heme', label: 'CAR-T Cell Therapy' },
    { value: 'cellTherapy', label: 'Cell Therapy (Other)' },
  ]},
  { group: 'Antibody-Based', options: [
    { value: 'bispecificHeme', label: 'Bispecific Antibody' },
    { value: 'bispecific', label: 'Bispecific (T-Cell Engager)' },
    { value: 'adc', label: 'Antibody-Drug Conjugate (ADC)' },
    { value: 'mab', label: 'Monoclonal Antibody' },
  ]},
  { group: 'Small Molecules', options: [
    { value: 'btki', label: 'BTK Inhibitor' },
    { value: 'smallMolecule', label: 'Small Molecule' },
  ]},
  { group: 'Other', options: [
    { value: 'geneTherapy', label: 'Gene Therapy' },
    { value: 'aso', label: 'Antisense Oligonucleotide' },
    { value: 'peptide', label: 'Peptide' },
  ]},
];

export const hemeLineageOptions = [
  { value: 'lymphoid', label: 'Lymphoid' },
  { value: 'myeloid', label: 'Myeloid' },
  { value: 'mixed_lineage', label: 'Mixed lineage' },
  { value: 'non_malignant', label: 'Non-malignant' },
];

export const transplantEligibilityOptions = [
  { value: 'transplant_eligible', label: 'Transplant-eligible' },
  { value: 'transplant_ineligible', label: 'Transplant-ineligible' },
  { value: 'post_transplant', label: 'Post-transplant (relapsed)' },
];

export const mrdStatusOptions = [
  { value: 'mrd_endpoint', label: 'MRD-based endpoint' },
  { value: 'standard_response', label: 'Standard response criteria' },
  { value: 'survival_endpoint', label: 'Survival endpoint (OS/PFS)' },
];

// ── Dermatology ──

export const dermatologyIndicationOptions = [
  { group: 'Inflammatory', options: [
    { value: 'atopicDermatitis', label: 'Atopic Dermatitis' },
    { value: 'psoriasis', label: 'Plaque Psoriasis' },
    { value: 'psoriaticArthritis', label: 'Psoriatic Arthritis' },
    { value: 'hidradenitisSuppurativa', label: 'Hidradenitis Suppurativa' },
    { value: 'seborrheicDermatitis', label: 'Seborrheic Dermatitis' },
    { value: 'chronicHandEczema', label: 'Chronic Hand Eczema' },
  ]},
  { group: 'Psoriasis Subtypes', options: [
    { value: 'nailPsoriasis', label: 'Nail Psoriasis' },
    { value: 'scalpPsoriasis', label: 'Scalp Psoriasis' },
    { value: 'palmoplantarPustulosis', label: 'Palmoplantar Pustulosis' },
  ]},
  { group: 'Autoimmune / Immune-Mediated', options: [
    { value: 'vitiligo', label: 'Vitiligo' },
    { value: 'alopeciaAreata', label: 'Alopecia Areata' },
    { value: 'chronicUrticaria', label: 'Chronic Spontaneous Urticaria' },
    { value: 'pemphigus', label: 'Pemphigus' },
    { value: 'bullousPemphigoid', label: 'Bullous Pemphigoid' },
    { value: 'morphea', label: 'Morphea / Localized Scleroderma' },
    { value: 'lichenPlanus', label: 'Lichen Planus' },
  ]},
  { group: 'Blistering / Genetic', options: [
    { value: 'epidermolysis', label: 'Epidermolysis Bullosa' },
    { value: 'ichthyosis', label: 'Ichthyosis' },
  ]},
  { group: 'Chronic Pruritic', options: [
    { value: 'prurigo', label: 'Prurigo Nodularis' },
    { value: 'contactDermatitis', label: 'Contact Dermatitis / Eczema' },
  ]},
  { group: 'Skin Oncology', options: [
    { value: 'basalCellCarcinoma', label: 'Basal Cell Carcinoma' },
    { value: 'squamousCellSkin', label: 'Cutaneous Squamous Cell Carcinoma' },
    { value: 'cutaneousMelanoma', label: 'Cutaneous Melanoma' },
  ]},
  { group: 'Other', options: [
    { value: 'acne', label: 'Severe Acne' },
    { value: 'rosacea', label: 'Rosacea' },
    { value: 'melasma', label: 'Melasma' },
    { value: 'hyperhidrosis', label: 'Hyperhidrosis' },
    { value: 'keloid', label: 'Keloid / Hypertrophic Scarring' },
  ]},
];

export const dermatologyModalityOptions = [
  { group: 'Biologics', options: [
    { value: 'il17Inhibitor', label: 'IL-17 Inhibitor' },
    { value: 'il13Inhibitor', label: 'IL-13 Inhibitor' },
    { value: 'mab', label: 'Monoclonal Antibody (Other)' },
    { value: 'topicalBiologic', label: 'Topical Biologic' },
  ]},
  { group: 'Small Molecules', options: [
    { value: 'jakInhibitorDerm', label: 'JAK Inhibitor (Oral/Topical)' },
    { value: 'smallMolecule', label: 'Small Molecule' },
  ]},
  { group: 'Other', options: [
    { value: 'peptide', label: 'Peptide' },
    { value: 'geneTherapy', label: 'Gene Therapy' },
  ]},
];

export const skinSeverityOptions = [
  { value: 'mild', label: 'Mild' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'severe', label: 'Severe' },
  { value: 'refractory_derm', label: 'Refractory' },
];

export const chronicityProfileOptions = [
  { value: 'chronic_relapsing', label: 'Chronic relapsing' },
  { value: 'chronic_continuous', label: 'Chronic continuous' },
  { value: 'acute_flares', label: 'Acute flares' },
];

export const topicalVsSystemicOptions = [
  { value: 'topical_only', label: 'Topical only' },
  { value: 'systemic_only', label: 'Systemic only' },
  { value: 'topical_and_systemic', label: 'Topical + systemic' },
];

// ── Gastroenterology ──

export const gastroenterologyIndicationOptions = [
  { group: 'Inflammatory Bowel Disease', options: [
    { value: 'crohnsDisease', label: "Crohn's Disease" },
    { value: 'ulcerativeColitis', label: 'Ulcerative Colitis' },
    { value: 'pouchitis', label: 'Pouchitis' },
    { value: 'microscopicColitis', label: 'Microscopic Colitis' },
    { value: 'perianalFistula', label: 'Perianal Fistula (CD)' },
  ]},
  { group: 'Eosinophilic / Immune', options: [
    { value: 'eosinophilicEsophagitis', label: 'Eosinophilic Esophagitis (EoE)' },
    { value: 'celiacDisease', label: 'Celiac Disease' },
    { value: 'giGvhd', label: 'GI Graft-vs-Host Disease' },
    { value: 'autoimmunePancreatitis', label: 'Autoimmune Pancreatitis' },
  ]},
  { group: 'Functional / Motility', options: [
    { value: 'ibsD', label: 'IBS-D (Diarrhea-Predominant)' },
    { value: 'ibsC', label: 'IBS-C (Constipation-Predominant)' },
    { value: 'irritableBowelGeneral', label: 'IBS (General / Mixed)' },
    { value: 'refractoryGerd', label: 'Refractory GERD' },
    { value: 'gastroparesis', label: 'Gastroparesis' },
    { value: 'achalasia', label: 'Achalasia' },
    { value: 'functionalDyspepsia', label: 'Functional Dyspepsia' },
  ]},
  { group: 'Hepatobiliary / Liver', options: [
    { value: 'primaryBiliaryCholangitis', label: 'Primary Biliary Cholangitis (PBC)' },
    { value: 'nonAlcoholicSteatohepatitis', label: 'NASH / MASH' },
    { value: 'hepaticEncephalopathy', label: 'Hepatic Encephalopathy' },
  ]},
  { group: 'Esophageal / Upper GI', options: [
    { value: 'barrettsEsophagus', label: "Barrett's Esophagus" },
  ]},
  { group: 'Intestinal / Other', options: [
    { value: 'shortBowelSyndrome', label: 'Short Bowel Syndrome' },
    { value: 'cdi', label: 'Recurrent C. difficile' },
    { value: 'diverticulitis', label: 'Diverticulitis' },
    { value: 'pancreaticInsufficiency', label: 'Exocrine Pancreatic Insufficiency' },
    { value: 'smallIntestinalBacterialOvergrowth', label: 'SIBO' },
    { value: 'radiationProctitis', label: 'Radiation Proctitis / Enteritis' },
    { value: 'intestinalFailure', label: 'Intestinal Failure' },
    { value: 'colorectalPolyps', label: 'Colorectal Polyps / Chemoprevention' },
  ]},
];

export const gastroenterologyModalityOptions = [
  { group: 'Biologics', options: [
    { value: 'antiTl1a', label: 'Anti-TL1A' },
    { value: 'il23GI', label: 'IL-23 Inhibitor' },
    { value: 'gutSelectiveIntegrin', label: 'Gut-Selective Integrin' },
    { value: 'mab', label: 'Monoclonal Antibody (Other)' },
  ]},
  { group: 'Small Molecules', options: [
    { value: 's1pModulator', label: 'S1P Receptor Modulator' },
    { value: 'jakInhibitor', label: 'JAK Inhibitor' },
    { value: 'smallMolecule', label: 'Small Molecule' },
  ]},
  { group: 'Other', options: [
    { value: 'microbiomeBased', label: 'Microbiome-Based Therapy' },
    { value: 'peptide', label: 'Peptide' },
  ]},
];

export const giSegmentOptions = [
  { value: 'upper_gi', label: 'Upper GI' },
  { value: 'small_bowel', label: 'Small bowel' },
  { value: 'colonic', label: 'Colonic' },
  { value: 'pancolonic', label: 'Pancolonic' },
];

export const biologicExperienceOptions = [
  { value: 'biologic_naive', label: 'Biologic-naïve' },
  { value: 'one_prior_biologic', label: 'One prior biologic' },
  { value: 'multi_biologic_exposed', label: 'Multi-biologic exposed' },
];

export const endoscopicEndpointOptions = [
  { value: 'endoscopic_remission', label: 'Endoscopic remission' },
  { value: 'endoscopic_improvement', label: 'Endoscopic improvement' },
  { value: 'clinical_only', label: 'Clinical endpoints only' },
];
