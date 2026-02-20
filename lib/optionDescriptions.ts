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
};
