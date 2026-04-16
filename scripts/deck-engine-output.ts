/**
 * Compute real engine output for a sample deal → emit JSON for the deck.
 * Pulls rNPV, terms breakdown, Monte Carlo percentiles we can visualize.
 */
import { calculateDealTerms, type CalculationInput } from '../lib/calculations';

const input: CalculationInput = {
  therapeuticArea: 'oncology',
  phase: 'phase2',
  dealType: 'licensing',
  modality: 'adc',
  indication: 'breast_her2',
  territory: 'global',
  biomarker: 'HER2+',
  lineOfTherapy: '2L',
  treatmentApproach: 'diseaseModifying',
  combinationPotential: 'some',
  competitivePosition: 'firstInClass',
  dataQuality: 'strongPhase2',
  regulatoryDesignations: { breakthrough: true, fastTrack: false, orphan: false, prime: false },
};

const r = calculateDealTerms(input);

const out = {
  scenario: 'Phase 2 HER2+ ADC · Oncology · Global Licensing',
  upfront: r.terms.upfront,
  totalDealValue: r.terms.totalDealValue,
  milestones: r.terms.milestones,
  royalty: r.terms.royalty,
  // Try to extract rNPV if present
  rnpv: (r as any).rnpv || (r.terms as any).rnpv || null,
  // Extract Monte Carlo if present
  monteCarlo: (r as any).monteCarlo || (r as any).monte_carlo || null,
  labels: r.labels,
  keys: Object.keys(r),
  termKeys: Object.keys(r.terms),
};

console.log(JSON.stringify(out, null, 2));
