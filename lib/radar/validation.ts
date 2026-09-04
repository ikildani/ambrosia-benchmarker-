/**
 * Asset Radar — Cross-Layer Validation
 *
 * Validates data at every insertion point to maintain institutional-grade
 * data quality. Rejects invalid, implausible, or fabricated data.
 */

// ═══════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ═══════════════════════════════════════════════════════════════════════
// ASSET VALIDATION
// ═══════════════════════════════════════════════════════════════════════

const VALID_PHASES = new Set([
  'discovery', 'preclinical', 'early_phase1', 'phase_1', 'phase1',
  'phase_1_2', 'phase1_phase2', 'phase_2', 'phase2',
  'phase_2_3', 'phase2_phase3', 'phase_3', 'phase3',
  'phase_4', 'phase4', 'approved', 'unknown',
]);

const VALID_MODALITIES = new Set([
  'small_molecule', 'antibody', 'adc', 'bispecific', 'car_t',
  'cell_therapy', 'gene_therapy', 'mrna', 'radiopharm', 'peptide',
  'oligonucleotide', 'vaccine', 'rnai', 'other',
]);

const VALID_PARTNERSHIP_STATUSES = new Set([
  'unpartnered', 'partnered', 'partially_partnered', 'unknown',
]);

export function validateAssetData(asset: Record<string, unknown>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!asset.asset_name || typeof asset.asset_name !== 'string' || asset.asset_name.length < 2) {
    errors.push('asset_name is required and must be at least 2 characters');
  }

  if (!asset.company_name || typeof asset.company_name !== 'string') {
    errors.push('company_name is required');
  }

  if (asset.phase && typeof asset.phase === 'string' && !VALID_PHASES.has(asset.phase.toLowerCase())) {
    warnings.push(`Unrecognized phase: ${asset.phase}`);
  }

  if (asset.modality && typeof asset.modality === 'string' && !VALID_MODALITIES.has(asset.modality.toLowerCase())) {
    warnings.push(`Unrecognized modality: ${asset.modality}`);
  }

  if (asset.partnership_status && typeof asset.partnership_status === 'string' && !VALID_PARTNERSHIP_STATUSES.has(asset.partnership_status)) {
    errors.push(`Invalid partnership_status: ${asset.partnership_status}`);
  }

  if (asset.confidence_score !== undefined) {
    const score = Number(asset.confidence_score);
    if (isNaN(score) || score < 0 || score > 100) {
      errors.push(`confidence_score must be 0-100, got: ${asset.confidence_score}`);
    }
  }

  if (asset.trial_count !== undefined && Number(asset.trial_count) < 0) {
    errors.push('trial_count cannot be negative');
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ═══════════════════════════════════════════════════════════════════════
// SIGNAL VALIDATION
// ═══════════════════════════════════════════════════════════════════════

const VALID_SIGNAL_TYPES = new Set([
  'cash_runway', 'bd_executive_hire', 'conference_activity',
  'regulatory_milestone', 'competitor_failure', 'management_commentary',
  'patent_filing', 'publication_velocity', 'strategic_review',
]);

export function validateSignalData(signal: Record<string, unknown>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!signal.asset_id) errors.push('asset_id is required');

  if (!signal.signal_type || typeof signal.signal_type !== 'string' || !VALID_SIGNAL_TYPES.has(signal.signal_type)) {
    errors.push(`Invalid signal_type: ${signal.signal_type}`);
  }

  if (signal.signal_value !== undefined) {
    const val = Number(signal.signal_value);
    if (isNaN(val) || val < 0 || val > 100) {
      errors.push(`signal_value must be 0-100, got: ${signal.signal_value}`);
    }
  }

  if (signal.confidence !== undefined) {
    const conf = Number(signal.confidence);
    if (isNaN(conf) || conf < 0 || conf > 100) {
      errors.push(`confidence must be 0-100, got: ${signal.confidence}`);
    }
  }

  if (!signal.evidence_text && !signal.evidence_url) {
    warnings.push('Signal has no evidence (text or URL)');
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ═══════════════════════════════════════════════════════════════════════
// DEAL TERM PREDICTION VALIDATION
// ═══════════════════════════════════════════════════════════════════════

export function validateDealTermPrediction(terms: Record<string, unknown>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const upfrontLow = Number(terms.upfront_low);
  const upfrontHigh = Number(terms.upfront_high);
  const totalLow = Number(terms.total_low);
  const totalHigh = Number(terms.total_high);
  const royaltyLow = Number(terms.royalty_low);
  const royaltyHigh = Number(terms.royalty_high);

  if (!isNaN(upfrontLow) && !isNaN(upfrontHigh)) {
    if (upfrontLow > upfrontHigh) errors.push('upfront_low > upfront_high');
    if (upfrontHigh > 50_000) errors.push(`Implausible upfront: $${upfrontHigh}M`);
    if (upfrontLow < 0) errors.push('Negative upfront');
  }

  if (!isNaN(totalLow) && !isNaN(totalHigh)) {
    if (totalLow > totalHigh) errors.push('total_low > total_high');
    if (totalHigh > 100_000) errors.push(`Implausible total deal value: $${totalHigh}M`);
    if (!isNaN(upfrontHigh) && upfrontHigh > totalHigh) {
      errors.push('upfront > total deal value');
    }
  }

  if (!isNaN(royaltyLow) && !isNaN(royaltyHigh)) {
    if (royaltyLow > royaltyHigh) errors.push('royalty_low > royalty_high');
    if (royaltyHigh > 30) warnings.push(`High royalty rate: ${royaltyHigh}%`);
    if (royaltyHigh > 50) errors.push(`Implausible royalty: ${royaltyHigh}%`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ═══════════════════════════════════════════════════════════════════════
// OPPORTUNITY VALIDATION
// ═══════════════════════════════════════════════════════════════════════

export function validateDealOpportunity(opp: Record<string, unknown>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!opp.asset_id) errors.push('asset_id is required');
  if (!opp.acquirer_company_id) errors.push('acquirer_company_id is required');

  if (opp.asset_company_id && opp.acquirer_company_id && opp.asset_company_id === opp.acquirer_company_id) {
    errors.push('Self-deal: asset company cannot be the acquirer');
  }

  if (opp.opportunity_score !== undefined) {
    const score = Number(opp.opportunity_score);
    if (isNaN(score) || score < 0 || score > 100) {
      errors.push(`opportunity_score must be 0-100, got: ${opp.opportunity_score}`);
    }
  }

  if (!opp.rationale || typeof opp.rationale !== 'string' || (opp.rationale as string).length < 20) {
    warnings.push('Rationale is missing or too short');
  }

  return { valid: errors.length === 0, errors, warnings };
}
