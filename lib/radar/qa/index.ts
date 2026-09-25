/**
 * Search & Evaluation QA harness — public surface.
 *
 *   runInvariants        automated invariant checks over the universe
 *   selectGoldenSet      stratified 200-asset golden set with frozen snapshots
 *   runGoldenAgreement   Opus re-derivation + partnership audit on the golden set
 *   buildQaReport        latest report JSON; renderQaReportMarkdown for notes
 *
 * See docs/asset-radar-qa.md for thresholds and the launch gate.
 */

export {
  runInvariants,
  collectQaStats,
  evaluateInvariants,
  summarizeChecks,
  QA_THRESHOLDS,
  EXPECTED_RADAR_STAGES,
  VOCAB_CHECKS,
  TERRITORY_VOCAB,
  type QaCheckResult,
  type QaSeverity,
  type QaStats,
  type InvariantsRunResult,
} from './invariants';

export {
  selectGoldenSet,
  selectGoldenSample,
  goldenQuotas,
  goldenHash,
  runGoldenAgreement,
  agreementPassed,
  cohensKappa,
  textSimilar,
  fieldAgrees,
  exportHumanReviewSheet,
  parseHumanReviewSheet,
  normalizeHumanReviewRows,
  importHumanReviews,
  summarizeHumanReviews,
  AGREEMENT_GATE,
  DEFAULT_GOLDEN_SEED,
  DEFAULT_GOLDEN_SIZE,
  HUMAN_REVIEW_FIELDS,
  type GoldenCandidate,
  type GoldenSelection,
  type GoldenAgreementReport,
  type FieldAgreementStats,
  type HumanReviewInput,
} from './golden-set';

export {
  buildQaReport,
  renderQaReportMarkdown,
  coverageRowsFromStats,
  agreementRowsFromFields,
  type QaReport,
} from './report';
