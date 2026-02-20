// Short descriptions for calculator option cards
// Used by OptionCardGroup to show context below each option label

export const phaseDescriptions: Record<string, string> = {
  preclinical: 'IND-enabling, no human data yet',
  phase1: 'First-in-human, safety & dosing',
  phase2: 'Proof of concept, efficacy signal',
  phase3: 'Pivotal registration-enabling trial',
  approved: 'NDA filed or marketed product',
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

// --- Deal Scope descriptions ---
export const territoryDescriptions: Record<string, string> = {
  global: 'Maximum value, full worldwide rights',
  us_only: '~55% of global pharma revenue',
  ex_us: 'All markets excluding US',
  us_eu: 'Core developed markets (~80%)',
  us_japan: 'Major markets, Japan access value',
  europe: 'IRA creating pricing pressure',
  japan: 'Single-market Japan rights',
  china: 'Geopolitical + regulatory risk',
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
};
