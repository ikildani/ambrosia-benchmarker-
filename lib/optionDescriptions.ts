// Short descriptions for calculator option cards
// Used by OptionCardGroup to show context below each option label

export const phaseDescriptions: Record<string, string> = {
  discovery: 'Target validation, lead optimization',
  preclinical: 'IND-enabling, no human data yet',
  phase1: 'First-in-human, safety & dosing',
  phase1_2: 'Combined safety & early efficacy',
  phase2: 'Proof of concept, efficacy signal',
  phase2_3: 'Adaptive design, seamless pivotal',
  phase3: 'Pivotal registration-enabling trial',
  nda_filed: 'Regulatory submission under review',
  approved: 'Marketed product, post-approval',
};

export const competitivePositionDescriptions: Record<string, string> = {
  firstInClass: 'Novel target, no validated competitors',
  firstToPivotal: 'Leading the race to Phase 3',
  bestInClass: 'Differentiated vs. existing drugs',
  racing: 'Neck-and-neck with 1–2 others',
  behind: 'Multiple competitors ahead',
  crowded: 'Approved drugs already on market',
};

export const dataQualityDescriptions: Record<string, string> = {
  pivotalReady: 'Registration-quality data package',
  strongPhase2: 'Clear dose-response, robust signal',
  promising: 'Early positive, needs confirmation',
  mixed: 'Inconsistent endpoints or subgroups',
  limited: 'Minimal clinical evidence to date',
};

export const combinationPotentialDescriptions: Record<string, string> = {
  strong: 'Proven backbone for combinations',
  some: 'Plausible combos, less validated',
  standalone: 'Monotherapy only, no combo path',
};

// --- Target Profile descriptions (oncology) ---
export const lineOfTherapyDescriptions: Record<string, string> = {
  '1L': 'Largest patient population, highest revenue',
  '2L': 'Standard second-line after 1L failure',
  '3L+': 'Smaller refractory population',
};

// --- Target Profile descriptions (neurology) ---
export const treatmentApproachDescriptions: Record<string, string> = {
  diseaseModifying: 'Alters disease course, highest premium',
  symptomatic: 'Manages symptoms, standard baseline',
  adjunctive: 'Add-on to existing therapies',
};

export const bbbPenetrationDescriptions: Record<string, string> = {
  provenCNS: 'Demonstrated BBB crossing in humans',
  promisingPreclinical: 'Animal PK shows CNS exposure',
  unproven: 'Standard assumption, unproven',
  peripheralOnly: 'No CNS penetration expected',
};

export const diseaseProgressionDescriptions: Record<string, string> = {
  slowProgressive: 'Longer trials, larger commercial window',
  moderateProgressive: 'Standard progression rate',
  rapidProgressive: 'Faster endpoints, smaller window',
  episodic: 'Relapsing patterns, enriched designs',
};

export const biomarkerValidationDescriptions: Record<string, string> = {
  validatedSurrogate: 'FDA-accepted surrogate endpoint',
  exploratory: 'Used for enrichment, not regulatory',
  noBiomarker: 'Clinical endpoints only',
};

// --- Target Profile descriptions (immunology) ---
export const treatmentGoalDescriptions: Record<string, string> = {
  remissionInduction: 'Achieving disease control, high value',
  maintenance: 'Preventing relapse, chronic revenue',
  flareControl: 'Episodic use, smaller per-patient',
};

export const immuneResetDescriptions: Record<string, string> = {
  curativeIntent: 'Drug-free remission, highest premium',
  durableRemission: 'Months-to-years duration',
  chronicTreatment: 'Ongoing therapy, recurring revenue',
};

export const targetSpecificityDescriptions: Record<string, string> = {
  antigenSpecific: 'Minimal immunosuppression risk',
  pathwayTargeted: 'Targets specific immune pathway',
  broadImmunosuppression: 'Non-selective, infection risk',
};

export const diseaseSeverityDescriptions: Record<string, string> = {
  mildModerate: 'Large population, lower urgency',
  moderateSevere: 'Sweet spot: large need, premium pricing',
  severe: 'Highest unmet need, orphan-like pricing',
  refractory: 'Failed multiple lines, novel MOA needed',
};

// --- Target Profile descriptions (metabolic) ---
export const metabolicTreatmentApproachDescriptions: Record<string, string> = {
  chronicWeightMgmt: 'Ongoing treatment, massive revenue',
  glycemicControl: 'Established HbA1c endpoints',
  organProtective: 'MASH, CKD, CV outcome expansion',
  metabolicReset: 'One-time intervention, highest premium',
};

export const mechanismDifferentiationDescriptions: Record<string, string> = {
  incretinBased: 'Validated GLP-1 class, crowding risk',
  nonIncretin: 'Differentiated biology, novelty premium',
  combinationMechanism: 'Dual/triple, highest efficacy potential',
};

export const weightLossEfficacyDescriptions: Record<string, string> = {
  superiorEfficacy: 'Category-leading, rivals surgery',
  competitiveEfficacy: 'In range with approved GLP-1s',
  modestEfficacy: 'Below GLP-1 standard, must differentiate',
};

export const routeOfAdministrationDescriptions: Record<string, string> = {
  oral: 'Biggest competitive advantage today',
  injectable: 'Weekly SC injection, established',
  implantable: 'Long-acting depot, adherence edge',
};

export const comorbidityBreadthDescriptions: Record<string, string> = {
  cardiometabolicBenefit: 'CV + metabolic data, label expansion',
  obesityPrimary: 'Weight-only indication, large market',
  organProtective: 'Liver, kidney, or heart protection',
};

// --- Target Profile descriptions (cardiovascular) ---
export const cvOutcomeBenefitDescriptions: Record<string, string> = {
  mortalityReduction: 'Gold standard, DAPA-HF/EMPEROR-like',
  hospitalizationReduction: 'HF hospitalization, strong value',
  symptomImprovement: 'Functional endpoints, baseline value',
};

export const cvTrialEndpointDescriptions: Record<string, string> = {
  maceEndpoint: 'Hard outcomes, costlier but definitive',
  surrogateBiomarker: 'NT-proBNP, imaging surrogate',
  functionalEndpoint: '6MWT, KCCQ, standard burden',
};

export const cvPopulationRiskDescriptions: Record<string, string> = {
  highRisk: 'Post-MI/HF, highest urgency',
  moderateRisk: 'Established CVD, standard',
  primaryPrevention: 'Largest market, lowest urgency',
};

// --- Target Profile descriptions (infectious disease) ---
export const resistanceProfileDescriptions: Record<string, string> = {
  novelTarget: 'New MOA, addresses resistance',
  existingClassImproved: 'Better PK/tolerability vs. class',
  broadSpectrum: 'Wide coverage, standard class',
};

export const infectionChronicityDescriptions: Record<string, string> = {
  acute: 'Short treatment, fast trials',
  chronic: 'HBV/HIV-like, recurring revenue',
  latent: 'TB/HSV-like, eradication potential',
};

export const publicHealthPriorityDescriptions: Record<string, string> = {
  whoUrgent: 'WHO urgent, BARDA/CARB-X eligible',
  whoCritical: 'WHO critical, push+pull incentives',
  standard: 'Standard priority pathogen',
};

// --- Target Profile descriptions (ophthalmology) ---
export const ocularDeliveryDescriptions: Record<string, string> = {
  intravitreal: 'Standard injection, proven route',
  topical: 'Patient-friendly, limited reach',
  oral: 'Systemic, off-target risk',
  implant: 'Sustained-release, reduced burden',
};

export const treatmentDurabilityDescriptions: Record<string, string> = {
  oneTime: 'Gene therapy cure, highest premium',
  extendedDuration: 'Quarterly+, reduced burden',
  chronicInjection: 'Monthly/bimonthly, standard',
};

export const visionImpactDescriptions: Record<string, string> = {
  visionThreatening: 'Blindness risk, highest urgency',
  visionImpairing: 'Significant visual loss',
  symptomRelief: 'Comfort/quality of life',
};

// --- Target Profile descriptions (women's health) ---
export const whTargetPopulationDescriptions: Record<string, string> = {
  reproductiveAge: 'Largest population, chronic use',
  perimenopause: 'Growing market, emerging targets',
  postmenopause: 'HRT/osteoporosis, established',
  pregnancy: 'High unmet need, regulatory complexity',
};

export const whUnmetNeedDescriptions: Record<string, string> = {
  noApprovedTherapy: 'No FDA-approved option, highest premium',
  inadequateOptions: 'Options exist but insufficient',
  wellServed: 'Multiple approved therapies',
};

export const whRegulatoryDescriptions: Record<string, string> = {
  acceleratedPathway: 'Breakthrough/fast track eligible',
  standardPathway: 'Conventional regulatory path',
  pregnancyComplexity: 'Teratogenicity studies required',
};

// --- Target Profile descriptions (rare disease) ---
export const orphanDesignationDescriptions: Record<string, string> = {
  both_orphan: 'FDA + EMA orphan, maximum incentives',
  fda_orphan: 'US orphan exclusivity, tax credits',
  ema_orphan: 'EU orphan market exclusivity',
  none: 'No orphan designation',
};

export const patientPopulationSizeDescriptions: Record<string, string> = {
  ultraRare_sub1k: 'Highest per-patient value, tiny market',
  rare_1k_10k: 'Classic rare disease, premium pricing',
  rare_10k_50k: 'Broader rare, balanced market size',
  broader_50k_200k: 'Larger population, competitive dynamics',
};

export const geneticBasisDescriptions: Record<string, string> = {
  monogenic_validated: 'Clear target, gene therapy eligible',
  polygenic: 'Multiple genes, complex biology',
  unknown_genetic: 'Genetic suspected, not confirmed',
  non_genetic: 'No genetic driver identified',
};

// --- Target Profile descriptions (hematology) ---
export const hemeLineageDescriptions: Record<string, string> = {
  lymphoid: 'B/T-cell malignancies, CAR-T eligible',
  myeloid: 'AML/MDS, transplant-driven',
  mixed_lineage: 'Complex biology, limited options',
  non_malignant: 'ITP/TTP, chronic management',
};

export const transplantEligibilityDescriptions: Record<string, string> = {
  transplant_eligible: 'Fit patients, curative intent',
  transplant_ineligible: 'Unfit patients, highest unmet need',
  post_transplant: 'Relapsed post-transplant, refractory',
};

export const mrdStatusDescriptions: Record<string, string> = {
  mrd_endpoint: 'Deepest response, accelerated path',
  standard_response: 'CR/PR criteria, established',
  survival_endpoint: 'OS/PFS, gold standard but slower',
};

// --- Target Profile descriptions (dermatology) ---
export const skinSeverityDescriptions: Record<string, string> = {
  mild: 'Large population, topical-first',
  moderate: 'Systemic candidates, growing market',
  severe: 'Highest unmet need, biologic-eligible',
  refractory_derm: 'Failed multiple lines, premium pricing',
};

export const chronicityProfileDescriptions: Record<string, string> = {
  chronic_relapsing: 'Flare cycles, maintenance value',
  chronic_continuous: 'Persistent disease, ongoing therapy',
  acute_flares: 'Episodic treatment, smaller per-patient',
};

export const topicalVsSystemicDescriptions: Record<string, string> = {
  topical_only: 'Patient-friendly, limited efficacy',
  systemic_only: 'Stronger efficacy, safety monitoring',
  topical_and_systemic: 'Flexible dosing, broadest market',
};

// --- Target Profile descriptions (gastroenterology) ---
export const giSegmentDescriptions: Record<string, string> = {
  upper_gi: 'EoE/GERD, endoscopic endpoints',
  small_bowel: "Crohn's-dominant, imaging-driven",
  colonic: 'UC, endoscopic remission endpoints',
  pancolonic: 'Extensive disease, highest severity',
};

export const biologicExperienceDescriptions: Record<string, string> = {
  biologic_naive: 'Treatment-naive, highest response rates',
  one_prior_biologic: 'Second-line biologic, standard',
  multi_biologic_exposed: 'Refractory, highest unmet need',
};

export const endoscopicEndpointDescriptions: Record<string, string> = {
  endoscopic_remission: 'Gold standard, regulatory preferred',
  endoscopic_improvement: 'Less stringent, faster signal',
  clinical_only: 'Symptom-based, easiest to achieve',
};

// --- Biomarker Status descriptions ---
export const biomarkerDescriptions: Record<string, string> = {
  selected: 'Enriched population, higher response rates',
  unselected: 'Broader population, larger addressable market',
};

// --- Deal Scope descriptions ---
export const territoryDescriptions: Record<string, string> = {
  global: 'Maximum value, full worldwide rights',
  us_only: '~55% of global pharma revenue',
  ex_us: 'All markets excluding US',
  us_eu: 'Core developed markets (~78%)',
  us_japan: 'Major markets, Japan access value',
  europe: 'EU5 + Nordics, HTA-driven pricing',
  japan: 'Single-market Japan rights',
  china: 'Geopolitical + regulatory risk',
  canada: 'PMPRB price controls, ~3% of global',
  australia: 'PBAC HTA-driven, ~2% of global',
  south_korea: 'HIRA price controls, growing biotech hub',
  apac_ex_cj: 'India, SE Asia — large pop, low pricing',
  latam: 'Brazil/Mexico lead, tender markets',
  mena: 'Gulf premium, North Africa lower pricing',
  row: 'Emerging markets, lowest value',
};

// Contextual help for section labels — explains WHY each parameter matters to deal value
export const sectionHelp: Record<string, string> = {
  phase: 'Development phase is the single largest driver of deal value. Preclinical assets average $400M total value vs $4.5B for approved products.',
  modality: 'Hot modalities command premiums. Radiopharmaceuticals (+60%), ADCs (+45%), and in vivo CAR-T (+65%) are currently the most sought-after.',
  indication: 'Indication size and competitive dynamics affect deal structure. Large indications get higher milestones, rare diseases get higher royalties.',
  competitivePosition: 'First-in-class assets command up to 25% premium. Crowded fields with approved drugs see 30% discounts on deal value.',
  dataQuality: 'Pivotal-ready data adds up to 15% premium by de-risking the asset. Limited data can discount value by 25%.',
  combinationPotential: 'Assets that anchor combination regimens command 20% premiums. Standalone monotherapies have less strategic value.',
  territory: 'Global rights are the baseline. Ex-US or ex-China carve-outs significantly reduce deal value. China-only rights carry steep discounts.',
  biomarker: 'Biomarker-selected populations improve response rates and can add a 15% premium to deal terms.',
  lineOfTherapy: 'First-line therapies access the largest patient populations and command a 25% premium over later lines.',
  treatmentApproach: 'Disease-modifying therapies command 25% premiums in neurology. Symptomatic treatments are the baseline.',
  bbbPenetration: 'Proven CNS penetration is a major de-risk for neuro assets, adding up to 30% premium. Peripheral-only carries a 15% discount.',
  diseaseProgression: 'Slow progressive diseases offer larger commercial windows. Rapid progression speeds trial enrollment but shrinks the treatment opportunity.',
  biomarkerValidation: 'Validated surrogate endpoints can enable accelerated approval, adding 25% premium to deal value.',
  treatmentGoal: 'Remission induction commands 15% premium. Flare control carries a 5% discount due to episodic use.',
  immuneResetPotential: 'Curative-intent therapies (drug-free remission) command up to 40% premium — the holy grail in autoimmune.',
  targetSpecificity: 'Antigen-specific approaches command 20% premium for minimal off-target effects. Broad immunosuppression carries 10% discount.',
  diseaseSeverity: 'Multi-refractory patients justify premium pricing (+30%). Mild-moderate populations carry 10% discount.',
  metabolicTreatmentApproach: 'Metabolic reset / curative approaches command 25% premium. Glycemic control is the baseline.',
  mechanismDifferentiation: 'Combination mechanisms command 30% premium for highest efficacy potential. Non-incretin novelty adds 20%.',
  weightLossEfficacy: 'Superior weight loss (>20%) commands 30% premium. Modest (<15%) carries 15% discount vs. GLP-1 standard.',
  routeOfAdministration: 'Oral administration is the biggest competitive advantage in metabolic (+30%). Injectable is the baseline.',
  comorbidityBreadth: 'Cardiometabolic benefit (CV + metabolic data) adds 25% through label expansion potential.',
  // Cardiovascular
  cvOutcomeBenefit: 'Mortality reduction is the gold standard in CV, commanding 30%+ premiums. Symptom improvement is the baseline.',
  cvTrialEndpoint: 'MACE endpoint trials are costlier but de-risk the asset significantly (+25%). Surrogate biomarkers are standard.',
  cvPopulationRisk: 'High-risk populations justify premium pricing and faster enrollment. Primary prevention targets the largest market but lowest urgency.',
  // Infectious Disease
  resistanceProfile: 'Novel-target antibiotics/antivirals addressing resistance command 30% premiums. Broad-spectrum is baseline.',
  infectionChronicity: 'Chronic infections (HBV, HIV) offer recurring revenue and 20% premiums. Acute infections have faster trials but smaller per-patient value.',
  publicHealthPriority: 'WHO urgent/critical priority pathogens qualify for CARB-X, BARDA, and pull incentives adding 25%+ to deal value.',
  // Ophthalmology
  ocularDelivery: 'Implant/sustained-release delivery reduces injection burden, commanding 25% premium. Intravitreal injection is the baseline.',
  treatmentDurability: 'One-time gene therapy cures command 35%+ premium. Extended-duration (quarterly) adds 15% vs. monthly injections.',
  visionImpact: 'Vision-threatening conditions (wet AMD, inherited retinal dystrophies) justify premium pricing (+20%). Symptom relief is baseline.',
  // Rare Disease
  orphanDesignation: 'Dual FDA + EMA orphan designation maximizes incentives — 7-year US exclusivity, 10-year EU exclusivity, and tax credits add 25%+ to deal value.',
  patientPopulationSize: 'Ultra-rare populations (<1,000) command the highest per-patient pricing but limit total market. Broader rare (50K+) balances volume with premium pricing.',
  geneticBasis: 'Monogenic diseases with validated targets enable precision therapies and gene therapy, commanding 30% premiums. Unknown genetic basis reduces target confidence.',
  // Hematology
  hemeLineage: 'Lymphoid malignancies have the richest competitive landscape (CAR-T, bispecifics). Myeloid is transplant-driven. Non-malignant is chronic management.',
  transplantEligibility: 'Transplant-ineligible patients represent the highest unmet need. Post-transplant relapse is the most refractory setting.',
  mrdStatus: 'MRD-based endpoints enable accelerated approval and deeper response assessment, adding 20% premium. Survival endpoints are gold standard but extend trial timelines.',
  // Dermatology
  skinSeverity: 'Severe/refractory patients justify biologic and systemic pricing (+25%). Mild disease is topical-first with lower per-patient value.',
  chronicityProfile: 'Chronic continuous disease supports maintenance therapy revenue. Acute flares drive episodic use with lower per-patient value.',
  topicalVsSystemic: 'Systemic therapies command higher pricing. Topical + systemic combinations offer the broadest market positioning.',
  // Gastroenterology
  giSegment: 'Colonic/pancolonic disease (UC) has established endoscopic endpoints. Upper GI (EoE) is an emerging high-value niche.',
  biologicExperience: 'Biologic-naive patients show highest response rates. Multi-biologic-exposed represents the greatest unmet need and premium pricing potential.',
  endoscopicEndpoint: 'Endoscopic remission is the regulatory gold standard in IBD, commanding 20% premium. Clinical-only endpoints are easier but less differentiated.',
  // Women's Health
  whTargetPopulation: 'Reproductive-age women represent the largest addressable population. Pregnancy-related conditions carry regulatory complexity but high unmet need.',
  whUnmetNeed: 'No-approved-therapy indications command 25%+ premium. Inadequate options add 10%. Well-served markets are baseline.',
  whRegulatory: 'Accelerated pathways (breakthrough, fast track) add 15-20% premium. Pregnancy-related regulatory complexity can delay but doesn\'t reduce deal value.',
};
