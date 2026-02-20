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
