/**
 * Plain-language copy for the valuation methods, the data levels and the
 * verification ladder. Shared by /methodology and the share page's method
 * block so the two never describe the engine differently.
 *
 * Voice: specific, human, no marketing adjectives. Say what each method is
 * good and bad at. Numbers that change live are NOT in this file; the page
 * reads them from lib/methodology-stats.ts.
 */

export interface MethodCopy {
  key: 'comparables' | 'rnpv' | 'monteCarlo' | 'ensemble';
  name: string;
  what: string;
  goodAt: string;
  weakAt: string;
  whenItLeads: string;
}

export const METHOD_COPY: MethodCopy[] = [
  {
    key: 'comparables',
    name: 'Comparable transactions',
    what: 'Deals that share your therapeutic area, phase, modality, indication and structure are scored on those dimensions, and the closest set produces a recency-weighted range for upfront, milestones, royalty and total value.',
    goodAt: 'Telling you what buyers actually paid for assets like yours. Direct, auditable, and every number traces to a named deal.',
    weakAt: 'Thin indications. When fewer than five deals qualify the filter relaxes to modality or therapeutic area alone, and the range widens. The panel says which rung was used.',
    whenItLeads: 'Before Phase 2, and whenever the comp pool is deep. This is the headline range on every share page.',
  },
  {
    key: 'rnpv',
    name: 'Risk-adjusted NPV',
    what: 'Projected revenue for the asset is discounted for time and multiplied by the cumulative probability it reaches market, with development cost subtracted. Upfront and total deal value are then derived as phase-specific fractions of that value.',
    goodAt: 'Late-stage assets with a defensible peak-sales estimate. It responds to the inputs a buyer negotiates on: probability of success, timeline, discount rate, peak sales.',
    weakAt: 'Early stages. At discovery through Phase 1 the cumulative probability of success is 2 to 9 percent and the timeline is 9 to 14 years, so the method returns near zero while real deals price optionality. Below Phase 2 it is floored at the comparable range and carries little weight.',
    whenItLeads: 'Phase 2 onward, licensing and co-development, where its backtest is measured.',
  },
  {
    key: 'monteCarlo',
    name: 'Monte Carlo simulation',
    what: 'Ten thousand runs of a simplified version of the rNPV model, each drawing a bear, base or bull scenario and then sampling probability of success, peak sales, discount rate and timing around it.',
    goodAt: 'Showing how wide the outcome distribution is and where the tails sit. The 80 percent band on a share page comes from here.',
    weakAt: 'Being a second model. The sampler uses its own phase durations and revenue curve, so its median is checked against its own deterministic scenario envelope, not against the main engine. It is a distribution, not a headline.',
    whenItLeads: 'Never on its own. It qualifies the other numbers.',
  },
  {
    key: 'ensemble',
    name: 'Ensemble',
    what: 'Comparable transactions, rNPV and a real-options overlay blended with inverse-variance weights: the method with the tighter spread on your inputs gets more of the vote.',
    goodAt: 'One number per question, with the weights shown. It is robust to the failure mode of any single method.',
    weakAt: 'Hiding disagreement. When comparables and rNPV disagree by an order of magnitude, the ensemble reports the blend and the share page shows both, so you can see which one to trust for your stage.',
    whenItLeads: 'Institutional reports and the Intelligence Brief, where a single defensible figure is required.',
  },
];

export interface DataLevel {
  key: 'tracked' | 'sourced' | 'verified';
  name: string;
  definition: string;
}

export const DATA_LEVELS: DataLevel[] = [
  {
    key: 'tracked',
    name: 'Deals tracked',
    definition: 'Distinct transactions in the database after de-duplication, excluding anything rejected, flagged for review, or quarantined. This is the pool the comparable-transactions method draws from.',
  },
  {
    key: 'sourced',
    name: 'Deals with a source',
    definition: 'Tracked deals that carry a clickable citation: an SEC filing id, a press release URL, or a source URL. Every row we add now must have one.',
  },
  {
    key: 'verified',
    name: 'Verified with a citation',
    definition: 'A person opened the source, confirmed the parties, asset, stage and terms, and marked the row verified. Since August 25, 2026 a row cannot be marked verified without a citation. This is the cohort the accuracy figures are measured on.',
  },
];

export const VERIFICATION_LADDER: Array<{ stage: string; meaning: string }> = [
  { stage: 'Extracted', meaning: 'A filing, press release or monitored announcement is parsed into a structured row. Every extraction passes a validator that rejects fabricated-looking asset names and structurally impossible terms.' },
  { stage: 'Pending', meaning: 'The row is in the database with a confidence score but no human review. Pending rows are used only where the score is high and are never marked verified automatically.' },
  { stage: 'Verified with a citation', meaning: 'Human-confirmed against the cited source. Only these rows count toward the accuracy figures on this page.' },
  { stage: 'Flagged or rejected', meaning: 'Failed review, or matched a known fabrication pattern. Excluded from every public surface, every comp pool and every count on this page.' },
];

export interface ChangelogEntry {
  date: string;
  title: string;
  detail: string;
}

export const DATA_QUALITY_CHANGELOG: ChangelogEntry[] = [
  {
    date: '2026-04-15',
    title: 'Fabricated-pattern purge',
    detail: 'An audit found rows produced by an early automated enrichment pass with invented asset names (target plus a three-digit code, or target plus an antibody suffix). Seven hundred and sixty-six rows were removed and a database-level check now rejects those patterns on insert unless a person has verified the row.',
  },
  {
    date: '2026-08-25',
    title: 'Citation required for verification',
    detail: 'A row can no longer be marked verified without a source URL, press release URL or SEC filing id. Dedupe groups were introduced so amended or re-announced deals collapse to one canonical row.',
  },
  {
    date: '2026-09-14',
    title: 'Second quarantine, 175 rows',
    detail: 'A follow-up audit found a batch loaded on 2 February 2026 with real company pairs attached to bare target names as assets. One hundred and seventy-five unverified rows were quarantined and removed from every public surface. The bare-target pattern was added to the audit rules.',
  },
];
