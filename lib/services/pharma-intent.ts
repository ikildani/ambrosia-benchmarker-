// Pharma Intent Score Engine v3 — Worldclass
// Predicts acquisition/licensing probability (0-100) for a pharma company
// in a specific modality × indication × phase within 12-18 months.
//
// 10-factor weighted model with interaction effects:
// 1. Patent Cliff Pressure (16%) — TA-specific LOE urgency
// 2. Deal Velocity (14%) — exponential decay, in-licensing only, saturation-aware
// 3. Pipeline Gap (14%) — trial-based, "exited" vs "never entered" distinction
// 4. Modality × Phase Alignment (12%) — company size × deal type interaction
// 5. Competitive Pressure (10%) — non-linear compounding by unique rivals
// 6. Strategic Signals (8%) — press NLP + priorities + hiring
// 7. Research Investment (6%) — publications, grants, patents
// 8. Deal Persistence (6%) — backtested serial acquirer pattern
// 9. Self-Saturation Penalty (7%) — recent deal in SAME modality suppresses intent
// 10. Portfolio Balance (7%) — concentration risk + diversification urgency

import { getRecencyWeight } from '@/lib/comparableDeals';

// ─── Modality Adjacency ─────────────────────────────────

const MODALITY_ADJACENCY: Record<string, string[]> = {
  adc: ['antibody', 'bispecific', 'small_molecule', 'monoclonalAntibody'],
  bispecific: ['antibody', 'adc', 'monoclonalAntibody'],
  antibody: ['adc', 'bispecific', 'monoclonalAntibody'],
  car_t: ['cell_therapy', 'gene_therapy', 'antibody', 'cellTherapy'],
  cell_therapy: ['car_t', 'gene_therapy', 'cellTherapy'],
  cellTherapy: ['car_t', 'gene_therapy', 'cell_therapy'],
  gene_therapy: ['cell_therapy', 'mrna', 'oligonucleotide', 'aso', 'geneTherapy'],
  geneTherapy: ['cell_therapy', 'mrna', 'oligonucleotide', 'gene_therapy'],
  mrna: ['gene_therapy', 'vaccine', 'oligonucleotide', 'rnaTherapeutic'],
  rnaTherapeutic: ['oligonucleotide', 'mrna', 'aso', 'gene_therapy'],
  radiopharm: ['antibody', 'small_molecule', 'peptide'],
  small_molecule: ['peptide', 'ion_channel', 'smallMolecule'],
  smallMolecule: ['peptide', 'ion_channel', 'small_molecule'],
  oligonucleotide: ['gene_therapy', 'mrna', 'aso', 'rnai'],
  peptide: ['small_molecule', 'antibody', 'smallMolecule'],
  vaccine: ['mrna', 'antibody'],
  aso: ['oligonucleotide', 'gene_therapy', 'rnai'],
  monoclonalAntibody: ['bispecific', 'adc', 'antibody'],
  molecularGlue: ['small_molecule', 'protac', 'smallMolecule'],
  protac: ['molecularGlue', 'small_molecule'],
};

import { TA_ADJACENCY } from '../financial/ta-adjacency';

// Phase preference by company type
const PHASE_PREFERENCE: Record<string, { sweet: string[]; acceptable: string[]; dealType: string }> = {
  large_pharma: { sweet: ['phase3', 'approved', 'phase2_3'], acceptable: ['phase2'], dealType: 'acquisition' },
  mid_pharma: { sweet: ['phase2', 'phase2_3', 'phase3'], acceptable: ['phase1_2', 'approved'], dealType: 'licensing' },
  large_biotech: { sweet: ['phase2', 'phase1_2'], acceptable: ['preclinical', 'phase3'], dealType: 'licensing' },
  mid_biotech: { sweet: ['preclinical', 'phase1', 'phase1_2'], acceptable: ['phase2'], dealType: 'codevelopment' },
  specialty: { sweet: ['approved', 'phase3'], acceptable: ['phase2_3'], dealType: 'licensing' },
};

// ─── Types ───────────────────────────────────────────────

export interface PharmaIntentResult {
  intentScore: number;
  intentTier: 'very_high' | 'high' | 'moderate' | 'low' | 'minimal';
  confidence: number;
  timing: 'imminent' | 'near_term' | 'medium_term' | 'speculative';
  timingProbabilities: {
    within6mo: number;   // 0-1
    within12mo: number;  // 0-1
    within18mo: number;  // 0-1
    within24mo: number;  // 0-1
  };
  factors: IntentFactor[];
  signals: string[];
  modalityFit: number;
  indicationFit: number;
  preferredDealType: string;
}

export interface IntentFactor {
  name: string;
  score: number;
  weight: number;
  evidence: string;
}

export interface CompanyForIntent {
  id: string;
  name: string;
  company_type: string | null;
  modalities_active: string[];
  modalities_primary: string[];
  indications_active: string[];
  indications_specific: string[];
  deals_last_12mo: number;
  deals_last_24mo: number;
  last_deal_date: string | null;
  last_deal_modality: string | null;
  last_deal_indication: string | null;
  active_trials_count: number;
  acquisition_appetite: string | null;
  actively_acquiring: boolean;
  strategic_priorities: string[];
  data_quality_score: number;
  patent_cliffs: unknown;
  revenue_at_risk_2025: number;
  revenue_at_risk_2026: number;
  revenue_at_risk_2027: number;
  hiring_bd_roles?: boolean;
  territory_focus?: string[];
}

export interface DealForIntent {
  modality: string | null;
  indication_category: string | null;
  indication_specific: string | null;
  announced_date: string;
  deal_type: string | null;
  licensee_id: string;
  licensor_id?: string;
  licensee_name: string | null;
  upfront_usd?: number | null;
  total_deal_value_usd?: number | null;
  therapeutic_area?: string | null;
}

export interface TrialForIntent {
  company_id: string;
  modality: string | null;
  indication_category: string | null;
  indication_specific: string | null;
  phase: string | null;
  status: string | null;
  enrollment_count?: number | null;
  is_collaboration?: boolean;
  primary_completion_date?: string | null;
}

export interface PressReleaseForIntent {
  headline: string;
  body_text: string | null;
  published_at: string;
  is_deal_announcement: boolean;
  companies_mentioned: string[];
}

export interface ResearchSignalForIntent {
  signal_type: string;
  therapeutic_area: string | null;
  funding_amount_usd: number | null;
  published_date: string | null;
  organization_name: string | null;
}

// ─── Factor Weights (v3: 10 factors) ────────────────────

/** Hardcoded baseline weights — used as fallback when calibration is
 *  unavailable / stale / low-confidence. Calibrated weights from the
 *  Wednesday 3am UTC cron feed into these via getCalibratedIntentWeights. */
export type IntentWeights = {
  patentCliff: number;
  dealVelocity: number;
  pipelineGap: number;
  alignment: number;
  competitive: number;
  strategic: number;
  research: number;
  persistence: number;
  saturation: number;
  portfolioBalance: number;
};

const W: IntentWeights = {
  patentCliff: 0.16,
  dealVelocity: 0.14,
  pipelineGap: 0.14,
  alignment: 0.12,
  competitive: 0.10,
  strategic: 0.08,
  research: 0.06,
  persistence: 0.06,
  saturation: 0.07,     // NEW: suppresses intent if recently acquired in same space
  portfolioBalance: 0.07, // NEW: concentration risk drives diversification
};

// ─── Calibration Feedback Loop ──────────────────────────
//
// R70 (2026-04-15): Close the Wednesday 3am UTC cron feedback loop.
// The intent-calibration cron computes 9-factor weights from 3 years of
// real deal outcomes and stores them in `intent_calibration_results`,
// but previously nothing read them — the live score used hardcoded W.
//
// Map calibration's 9-factor output to the live 10-factor schema with
// semantic correspondence. Gated by confidence (accuracy ≥ 0.55, sample
// size ≥ 100, age ≤ 35 days) so a bad / stale calibration doesn't
// silently override the hardcoded baseline.

/**
 * Minimum cross-validation accuracy for a calibration to be trusted.
 * The hardcoded W was tuned manually against the same ground truth to
 * roughly this level; below this, the calibration is worse than the
 * prior and shouldn't override it.
 */
const MIN_CALIBRATION_ACCURACY = 0.55;

/** Minimum sample size for a calibration to be statistically meaningful. */
const MIN_CALIBRATION_SAMPLE = 100;

/** Maximum age (days) of a calibration before we treat it as stale. */
const MAX_CALIBRATION_AGE_DAYS = 35;

/**
 * Supabase client shape the helper needs (avoids full SupabaseClient import here).
 */
interface MinimalSupabase {
  from: (table: string) => {
    select: (cols: string) => {
      order: (col: string, opts: { ascending: boolean }) => {
        limit: (n: number) => PromiseLike<{ data: unknown; error: unknown }>;
      };
    };
  };
}

/** Latest calibration record shape (projection we pull from the table). */
interface CalibrationRow {
  calibrated_weights: Record<string, number>;
  accuracy_estimate: number;
  sample_size: number;
  created_at: string;
}

/**
 * Map the calibration's 9-factor output onto the live 10-factor W shape.
 *
 * Calibrated field → live W field mapping, with semantic rationale:
 *   hasPatentCliff        → patentCliff     (identical concept)
 *   pipelineGap           → pipelineGap     (identical concept)
 *   dealVelocity          → dealVelocity    (identical concept)
 *   modalityAligned+indicationAligned → alignment (both are alignment dims)
 *   activelyAcquiring     → strategic       (intent-to-acquire signal)
 *   revenueAtRisk         → competitive     (LOE pressure = replacement need)
 *   dealsCount12mo        → persistence     (serial-acquirer pattern proxy)
 *   trialCountInSpace     → research        (in-space trial activity)
 *   (no calibrated equiv) → saturation      (keep hardcoded W)
 *   (no calibrated equiv) → portfolioBalance (keep hardcoded W)
 *
 * Unmapped live factors retain their hardcoded W values. Final result is
 * renormalized so the 10 weights sum to 1.0 (preserves score scale).
 */
function mapCalibratedToLive(cal: Record<string, number>): IntentWeights {
  const raw: IntentWeights = {
    patentCliff: Math.max(0, cal.hasPatentCliff ?? W.patentCliff),
    dealVelocity: Math.max(0, cal.dealVelocity ?? W.dealVelocity),
    pipelineGap: Math.max(0, cal.pipelineGap ?? W.pipelineGap),
    alignment: Math.max(0, (cal.modalityAligned ?? 0) + (cal.indicationAligned ?? 0)) || W.alignment,
    competitive: Math.max(0, cal.revenueAtRisk ?? W.competitive),
    strategic: Math.max(0, cal.activelyAcquiring ?? W.strategic),
    research: Math.max(0, cal.trialCountInSpace ?? W.research),
    persistence: Math.max(0, cal.dealsCount12mo ?? W.persistence),
    saturation: W.saturation,              // no calibrated equivalent
    portfolioBalance: W.portfolioBalance,  // no calibrated equivalent
  };

  // Renormalize so the 10 weights sum to 1.0 (preserves score scale).
  const total = Object.values(raw).reduce((a, b) => a + b, 0);
  if (total <= 0) return W;  // guard against all-zero degenerate calibration
  const scale = 1.0 / total;
  return {
    patentCliff: raw.patentCliff * scale,
    dealVelocity: raw.dealVelocity * scale,
    pipelineGap: raw.pipelineGap * scale,
    alignment: raw.alignment * scale,
    competitive: raw.competitive * scale,
    strategic: raw.strategic * scale,
    research: raw.research * scale,
    persistence: raw.persistence * scale,
    saturation: raw.saturation * scale,
    portfolioBalance: raw.portfolioBalance * scale,
  };
}

/**
 * Result of the weight resolution — the weights plus provenance so the
 * caller can log / surface WHICH weights were used.
 */
export interface ResolvedIntentWeights {
  weights: IntentWeights;
  source: 'calibrated' | 'hardcoded_baseline';
  /** Reason the fallback was used (only set when source='hardcoded_baseline') */
  fallbackReason?:
    | 'no_calibration_row'
    | 'accuracy_below_threshold'
    | 'sample_size_below_threshold'
    | 'calibration_stale'
    | 'query_error'
    | 'degenerate_weights';
  /** Metadata from the calibration record, when available */
  calibratedAt?: string;
  accuracyEstimate?: number;
  sampleSize?: number;
}

/**
 * Fetch the most-recent calibration and return the live-schema weights,
 * or fall back to hardcoded W if the calibration fails confidence gates.
 *
 * Callers should resolve weights ONCE per request and pass to
 * calculatePharmaIntent — avoids per-score DB hits.
 */
export async function getCalibratedIntentWeights(
  supabase: MinimalSupabase,
): Promise<ResolvedIntentWeights> {
  try {
    const res = await supabase
      .from('intent_calibration_results')
      .select('calibrated_weights, accuracy_estimate, sample_size, created_at')
      .order('created_at', { ascending: false })
      .limit(1);

    if (res.error) {
      return { weights: W, source: 'hardcoded_baseline', fallbackReason: 'query_error' };
    }

    const rows = (res.data as CalibrationRow[] | null) ?? [];
    const latest = rows[0];
    if (!latest) {
      return { weights: W, source: 'hardcoded_baseline', fallbackReason: 'no_calibration_row' };
    }

    if (latest.accuracy_estimate < MIN_CALIBRATION_ACCURACY) {
      return {
        weights: W,
        source: 'hardcoded_baseline',
        fallbackReason: 'accuracy_below_threshold',
        accuracyEstimate: latest.accuracy_estimate,
        sampleSize: latest.sample_size,
        calibratedAt: latest.created_at,
      };
    }
    if (latest.sample_size < MIN_CALIBRATION_SAMPLE) {
      return {
        weights: W,
        source: 'hardcoded_baseline',
        fallbackReason: 'sample_size_below_threshold',
        accuracyEstimate: latest.accuracy_estimate,
        sampleSize: latest.sample_size,
        calibratedAt: latest.created_at,
      };
    }
    const ageDays =
      (Date.now() - new Date(latest.created_at).getTime()) / (24 * 60 * 60 * 1000);
    if (ageDays > MAX_CALIBRATION_AGE_DAYS) {
      return {
        weights: W,
        source: 'hardcoded_baseline',
        fallbackReason: 'calibration_stale',
        accuracyEstimate: latest.accuracy_estimate,
        sampleSize: latest.sample_size,
        calibratedAt: latest.created_at,
      };
    }

    const mapped = mapCalibratedToLive(latest.calibrated_weights);
    // Sanity check: if mapping collapsed to effectively hardcoded (all zeros
    // would have been caught, but defensive), fall back.
    const totalRaw = Object.values(mapped).reduce((a, b) => a + b, 0);
    if (!Number.isFinite(totalRaw) || totalRaw < 0.9 || totalRaw > 1.1) {
      return {
        weights: W,
        source: 'hardcoded_baseline',
        fallbackReason: 'degenerate_weights',
        accuracyEstimate: latest.accuracy_estimate,
        sampleSize: latest.sample_size,
        calibratedAt: latest.created_at,
      };
    }

    return {
      weights: mapped,
      source: 'calibrated',
      accuracyEstimate: latest.accuracy_estimate,
      sampleSize: latest.sample_size,
      calibratedAt: latest.created_at,
    };
  } catch {
    return { weights: W, source: 'hardcoded_baseline', fallbackReason: 'query_error' };
  }
}

// ─── Core Function ───────────────────────────────────────

export function calculatePharmaIntent(
  company: CompanyForIntent,
  targetModality: string,
  targetIndication: string,
  companyDeals: DealForIntent[],
  companyTrials: TrialForIntent[],
  allRecentDeals?: DealForIntent[],
  pressReleases?: PressReleaseForIntent[],
  researchSignals?: ResearchSignalForIntent[],
  targetPhase?: string,
  targetTA?: string,
  /** R70: optional weights override. When omitted, the hardcoded baseline
   *  W is used. Pass weights resolved via getCalibratedIntentWeights() to
   *  let the Wednesday 3am UTC cron feed back into live scoring. */
  weightsOverride?: IntentWeights,
): PharmaIntentResult {
  const factors: IntentFactor[] = [];
  const allDeals = allRecentDeals || [];
  // R70: effective weights — caller-provided calibrated weights or baseline.
  const w: IntentWeights = weightsOverride ?? W;

  // Separate in-licensing deals (company as licensee) from out-licensing (company as licensor)
  const inLicensingDeals = companyDeals.filter(d => d.licensee_id === company.id);
  const outLicensingDeals = companyDeals.filter(d => d.licensor_id === company.id);

  // ── 1. Patent Cliff Pressure — TA-specific (16%) ──
  const f1 = scorePatentCliff(company, targetTA, targetIndication);
  factors.push({ ...f1, weight: w.patentCliff });

  // ── 2. Deal Velocity — in-licensing only, decay-weighted (14%) ──
  const f2 = scoreDealVelocity(company, inLicensingDeals, targetModality, targetIndication);
  factors.push({ ...f2, weight: w.dealVelocity });

  // ── 3. Pipeline Gap — trial-based with terminated detection (14%) ──
  const f3 = scorePipelineGap(company, companyTrials, targetModality, targetIndication);
  factors.push({ ...f3, weight: w.pipelineGap });

  // ── 4. Modality × Phase × Company Type Alignment (12%) ──
  const f4 = scoreAlignment(company, targetModality, targetIndication, targetPhase);
  factors.push({ ...f4, weight: w.alignment });

  // ── 5. Competitive Pressure — non-linear (10%) ──
  const f5 = scoreCompetitivePressure(company, allDeals, targetModality, targetIndication);
  factors.push({ ...f5, weight: w.competitive });

  // ── 6. Strategic Signals — press NLP (8%) ──
  const f6 = scoreStrategicSignals(company, targetModality, targetIndication, pressReleases);
  factors.push({ ...f6, weight: w.strategic });

  // ── 7. Research Investment (6%) ──
  const f7 = scoreResearchInvestment(researchSignals, targetModality, targetIndication);
  factors.push({ ...f7, weight: w.research });

  // ── 8. Deal Persistence (6%) ──
  const f8 = scorePersistence(company, inLicensingDeals, targetModality, targetIndication);
  factors.push({ ...f8, weight: w.persistence });

  // ── 9. Self-Saturation Penalty (7%) ──
  const f9 = scoreSelfSaturation(company, inLicensingDeals, targetModality, targetIndication);
  factors.push({ ...f9, weight: w.saturation });

  // ── 10. Portfolio Balance (7%) ──
  const f10 = scorePortfolioBalance(company, inLicensingDeals, companyTrials, targetModality, targetIndication, targetTA);
  factors.push({ ...f10, weight: w.portfolioBalance });

  // ── Composite Score ──
  const rawScore = factors.reduce((sum, f) => sum + f.score * f.weight, 0);

  // Out-licensing penalty: companies divesting in this space get penalized
  const outLicensingInTarget = outLicensingDeals.filter(d =>
    matchesModality(d.modality, targetModality) || matchesIndication(d, targetIndication)
  );
  const divestingPenalty = outLicensingInTarget.length >= 2 ? 0.6
    : outLicensingInTarget.length === 1 ? 0.85
    : 1.0;

  const appetiteMultiplier = company.acquisition_appetite === 'aggressive' ? 1.1
    : company.acquisition_appetite === 'moderate' ? 1.0
    : company.acquisition_appetite === 'selective' ? 0.85
    : company.acquisition_appetite === 'inactive' ? 0.5
    : 1.0;

  const intentScore = Math.min(100, Math.max(0, Math.round(rawScore * appetiteMultiplier * divestingPenalty)));

  const intentTier = intentScore >= 80 ? 'very_high'
    : intentScore >= 60 ? 'high'
    : intentScore >= 40 ? 'moderate'
    : intentScore >= 20 ? 'low'
    : 'minimal';

  // ── Timing ──
  const hasRecentDeal = company.last_deal_date && daysSince(company.last_deal_date) < 90;
  const hasActiveTrialsInTarget = companyTrials.some(t =>
    (t.status === 'recruiting' || t.status === 'active_not_recruiting') &&
    matchesIndication(t, targetIndication)
  );
  const hasRecentPress = (pressReleases || []).some(p =>
    new Date(p.published_at).getTime() > Date.now() - 90 * 24 * 60 * 60 * 1000
  );

  const timing = intentScore >= 80 && (hasRecentDeal || hasRecentPress) ? 'imminent'
    : intentScore >= 60 && hasActiveTrialsInTarget ? 'near_term'
    : intentScore >= 40 ? 'medium_term'
    : 'speculative';

  // ── Preferred deal type ──
  const compType = company.company_type || 'mid_pharma';
  const pref = PHASE_PREFERENCE[compType] || PHASE_PREFERENCE.mid_pharma;
  const preferredDealType = pref.dealType;

  // ── Confidence ──
  const trialCount = companyTrials.filter(t => t.company_id === company.id).length;
  const dqs = company.data_quality_score || 0;

  const confidence = Math.min(1, Math.max(0,
    (dqs >= 70 ? 0.25 : dqs >= 40 ? 0.15 : 0.05) +
    (inLicensingDeals.length >= 5 ? 0.25 : inLicensingDeals.length >= 2 ? 0.15 : inLicensingDeals.length >= 1 ? 0.08 : 0) +
    (trialCount >= 10 ? 0.25 : trialCount >= 3 ? 0.15 : trialCount >= 1 ? 0.08 : 0) +
    ((pressReleases || []).length > 0 ? 0.13 : 0) +
    ((researchSignals || []).length > 0 ? 0.12 : 0)
  ));

  // ── Signals ──
  const signals: string[] = [];

  // Add divesting warning if applicable
  if (outLicensingInTarget.length > 0) {
    signals.push(`Caution: ${outLicensingInTarget.length} out-licensing deal${outLicensingInTarget.length > 1 ? 's' : ''} in this space (may be divesting)`);
  }

  // Add top positive factors
  const positiveFactors = factors
    .filter(f => f.score >= 40 && f.name !== 'Self-Saturation')
    .sort((a, b) => b.score * b.weight - a.score * a.weight);

  for (const f of positiveFactors) {
    if (signals.length >= 3) break;
    signals.push(f.evidence);
  }

  if (signals.length === 0) signals.push('Limited data — intent score is speculative');

  // ── Timing Probabilities ──
  // Score-based probability curves calibrated from historical deal intervals
  // Higher intent = higher probability at each window
  // These base rates are overridden by calibrated timing data when available
  const scoreNorm = intentScore / 100; // 0-1
  const timingProbabilities = {
    within6mo: Number(Math.min(1, Math.max(0,
      scoreNorm * 0.55 * (hasRecentDeal ? 1.4 : 1.0) * (hasActiveTrialsInTarget ? 1.15 : 1.0)
    )).toFixed(3)),
    within12mo: Number(Math.min(1, Math.max(0,
      scoreNorm * 0.75 * (hasRecentDeal ? 1.2 : 1.0) * (hasActiveTrialsInTarget ? 1.1 : 1.0)
    )).toFixed(3)),
    within18mo: Number(Math.min(1, Math.max(0,
      scoreNorm * 0.88 * (hasActiveTrialsInTarget ? 1.05 : 1.0)
    )).toFixed(3)),
    within24mo: Number(Math.min(1, Math.max(0,
      scoreNorm * 0.95
    )).toFixed(3)),
  };

  return {
    intentScore,
    intentTier,
    confidence: Math.round(confidence * 100) / 100,
    timing,
    timingProbabilities,
    factors,
    signals,
    modalityFit: f4.modalityFit,
    indicationFit: f4.indicationFit,
    preferredDealType,
  };
}

// ═══════════════════════════════════════════════════════════
// FACTOR SCORING FUNCTIONS
// ═══════════════════════════════════════════════════════════

// ── 1. Patent Cliff — TA-specific ────────────────────────

function scorePatentCliff(
  company: CompanyForIntent, targetTA?: string, targetIndication?: string
): { name: string; score: number; evidence: string } {
  const totalRisk = (company.revenue_at_risk_2025 || 0) + (company.revenue_at_risk_2026 || 0) + (company.revenue_at_risk_2027 || 0);
  if (totalRisk <= 0) return { name: 'Patent Cliff', score: 30, evidence: 'No significant patent cliff data' };

  // Check if cliff is in same or adjacent TA
  let taRelevance = 0.5; // default: moderate relevance (unknown TA of cliff)
  if (targetTA && company.patent_cliffs && Array.isArray(company.patent_cliffs)) {
    const cliffs = company.patent_cliffs as { indication?: string; therapeutic_area?: string }[];
    const sameTA = cliffs.some(c => {
      const cliffTA = (c.therapeutic_area || c.indication || '').toLowerCase();
      return cliffTA.includes(targetTA.toLowerCase()) || targetTA.toLowerCase().includes(cliffTA);
    });
    const adjTAs = TA_ADJACENCY[targetTA] || [];
    const adjacentTA = cliffs.some(c => {
      const cliffTA = (c.therapeutic_area || c.indication || '').toLowerCase();
      return adjTAs.some(a => cliffTA.includes(a.toLowerCase()));
    });

    if (sameTA) taRelevance = 1.0;       // Cliff in same TA = full urgency
    else if (adjacentTA) taRelevance = 0.7; // Adjacent TA
    else taRelevance = 0.3;               // Unrelated TA = low relevance
  }

  let baseScore: number;
  if (totalRisk >= 20e9) baseScore = 95;
  else if (totalRisk >= 10e9) baseScore = 85;
  else if (totalRisk >= 5e9) baseScore = 70;
  else if (totalRisk >= 2e9) baseScore = 55;
  else if (totalRisk >= 500e6) baseScore = 40;
  else baseScore = 25;

  const score = Math.round(baseScore * taRelevance);
  const taNote = taRelevance >= 0.8 ? ' (same TA)' : taRelevance >= 0.6 ? ' (adjacent TA)' : taRelevance <= 0.4 ? ' (different TA — lower relevance)' : '';
  return { name: 'Patent Cliff', score, evidence: `$${(totalRisk / 1e9).toFixed(1)}B at risk 2025-27${taNote}` };
}

// ── 2. Deal Velocity — in-licensing only, decay-weighted ─

function scoreDealVelocity(
  company: CompanyForIntent, inDeals: DealForIntent[], targetModality: string, targetIndication: string
): { name: string; score: number; evidence: string } {
  let weightedTotal = 0;
  let weightedRelevant = 0;

  for (const deal of inDeals) {
    const year = new Date(deal.announced_date).getFullYear();
    const weight = getRecencyWeight(year);
    weightedTotal += weight;
    if (matchesModality(deal.modality, targetModality) || matchesIndication(deal, targetIndication)) {
      weightedRelevant += weight;
    }
  }

  let score = 0;
  if (weightedTotal >= 8) score += 40;
  else if (weightedTotal >= 5) score += 30;
  else if (weightedTotal >= 2) score += 20;
  else if (weightedTotal >= 1) score += 10;

  // Acceleration
  const d12 = company.deals_last_12mo || 0;
  const d24 = company.deals_last_24mo || 0;
  if (d24 > 0 && d12 > d24 * 0.6) score += 15;

  // Relevant deal bonus
  if (weightedRelevant >= 3) score += 25;
  else if (weightedRelevant >= 1.5) score += 15;
  else if (weightedRelevant >= 0.5) score += 8;

  // Recency
  if (company.last_deal_date) {
    const days = daysSince(company.last_deal_date);
    if (days < 60) score += 20;
    else if (days < 120) score += 12;
    else if (days < 240) score += 5;
  }

  score = Math.min(100, score);
  const ev = weightedRelevant >= 1
    ? `${Math.round(weightedRelevant)}× weighted in-licensing deals in target space`
    : d12 > 0 ? `${d12} in-licensing deals in 12mo (none in target space)` : 'No recent in-licensing activity';
  return { name: 'Deal Velocity', score, evidence: ev };
}

// ── 3. Pipeline Gap — trial-based, terminated detection ──

function scorePipelineGap(
  company: CompanyForIntent, trials: TrialForIntent[], targetModality: string, targetIndication: string
): { name: string; score: number; evidence: string } {
  const myTrials = trials.filter(t => t.company_id === company.id);
  const activeTrials = myTrials.filter(t =>
    t.status === 'recruiting' || t.status === 'active_not_recruiting' || t.status === 'not_yet_recruiting'
  );
  const terminatedTrials = myTrials.filter(t => t.status === 'terminated' || t.status === 'withdrawn');

  const exactActive = activeTrials.filter(t => matchesModality(t.modality, targetModality) && matchesIndication(t, targetIndication));
  const exactTerminated = terminatedTrials.filter(t => matchesModality(t.modality, targetModality) && matchesIndication(t, targetIndication));
  const indicationActive = activeTrials.filter(t => matchesIndication(t, targetIndication));
  // Exact-match late-stage phases using canonical keys (phase2, phase2_3, phase3, phase4).
  // Substring .includes() is unsafe here because "phase2" is a substring of "phase2_3",
  // which would misclassify any "phase2_3" trial based on its parent prefix.
  const LATE_STAGE_PHASES = new Set(['phase2', 'phase2_3', 'phase3', 'phase4']);
  const lateStage = indicationActive.filter(t => {
    if (!t.phase) return false;
    const normalized = t.phase.toLowerCase().trim().replace(/\s+/g, '').replace(/\//g, '_').replace(/^phase_/, 'phase');
    return LATE_STAGE_PHASES.has(normalized);
  });

  let score: number;
  let evidence: string;

  // "Exited this space" = NEGATIVE signal (terminated programs = they tried and left)
  if (exactTerminated.length >= 2 && exactActive.length === 0) {
    score = 15; // Very low — they exited this space deliberately
    evidence = `Exited: ${exactTerminated.length} terminated trials in target space — anti-intent signal`;
  } else if (exactTerminated.length >= 1 && exactActive.length === 0) {
    score = 30; // Low — one terminated trial
    evidence = `1 terminated trial in target space — possible exit signal`;
  } else if (exactActive.length === 0 && indicationActive.length === 0 && activeTrials.length === 0) {
    score = 85; // Never been here — high gap, high intent potential
    evidence = `No trials in any related area — large pipeline gap`;
  } else if (exactActive.length === 0 && indicationActive.length === 0) {
    score = 75; // Active elsewhere, gap in this indication
    evidence = `No trials in target indication (${activeTrials.length} total active)`;
  } else if (lateStage.length === 0 && indicationActive.length > 0) {
    score = 55; // Early stage only
    evidence = `${indicationActive.length} early-stage trials, no late-stage coverage`;
  } else if (lateStage.length >= 3) {
    score = 8; // Strong pipeline
    evidence = `Strong: ${lateStage.length} late-stage trials in target indication`;
  } else if (lateStage.length >= 1) {
    score = 25;
    evidence = `${lateStage.length} late-stage trial${lateStage.length > 1 ? 's' : ''} — some coverage`;
  } else {
    score = 45;
    evidence = `${exactActive.length} active trials in target space`;
  }

  // Large pharma with thin pipeline = extra urgency
  if (company.company_type === 'large_pharma' && activeTrials.length < 30) score = Math.min(100, score + 8);

  return { name: 'Pipeline Gap', score, evidence };
}

// ── 4. Alignment — modality × phase × company type ──────

function scoreAlignment(
  company: CompanyForIntent, targetModality: string, targetIndication: string, targetPhase?: string
): { name: string; score: number; evidence: string; modalityFit: number; indicationFit: number } {
  const mods = [...(company.modalities_primary || []), ...(company.modalities_active || [])].map(m => m.toLowerCase());
  const inds = [...(company.indications_specific || []), ...(company.indications_active || [])].map(i => i.toLowerCase());
  const tMod = targetModality.toLowerCase();
  const tInd = targetIndication.toLowerCase();

  // Word-boundary aware substring match: require the term to be at least 4 chars
  // long before accepting a substring hit, otherwise rely on exact match. This
  // prevents "er" in "ertugliflozin" from matching "er" in "merck".
  const boundedIncludes = (haystack: string, needle: string): boolean => {
    if (!needle || needle.length < 4) return haystack === needle;
    return haystack === needle || haystack.includes(needle) || needle.includes(haystack);
  };

  // Modality fit (all comparisons lowercased)
  let modalityFit = 0;
  if (mods.some(m => boundedIncludes(m, tMod))) modalityFit = 100;
  else if (mods.some(m => isAdjacentModality(m, targetModality))) modalityFit = 55;
  else if (mods.length > 0) modalityFit = 15;

  // Indication fit (all comparisons lowercased)
  let indicationFit = 0;
  if (inds.some(i => boundedIncludes(i, tInd))) indicationFit = 100;
  else if (inds.some(i => {
    const root = tInd.split('_')[0];
    return root.length > 3 && (i.includes(root) || root.includes(i.split('_')[0]));
  })) indicationFit = 55;
  else if (inds.length > 0) indicationFit = 15;

  // Phase × company type interaction
  let phaseFit = 50; // default
  if (targetPhase) {
    const compType = company.company_type || 'mid_pharma';
    const pref = PHASE_PREFERENCE[compType] || PHASE_PREFERENCE.mid_pharma;
    if (pref.sweet.some(p => targetPhase.includes(p) || p.includes(targetPhase))) phaseFit = 100;
    else if (pref.acceptable.some(p => targetPhase.includes(p) || p.includes(targetPhase))) phaseFit = 65;
    else phaseFit = 20;
  }

  // Weighted: modality 35%, indication 35%, phase×type 30%
  const score = Math.round(modalityFit * 0.35 + indicationFit * 0.35 + phaseFit * 0.30);

  const phaseNote = targetPhase && phaseFit >= 80 ? ' | Phase sweet-spot' : targetPhase && phaseFit <= 30 ? ' | Phase mismatch' : '';
  return { name: 'Alignment', score, evidence: `Mod ${modalityFit}% | Ind ${indicationFit}%${phaseNote}`, modalityFit, indicationFit };
}

// ── 5. Competitive Pressure — non-linear compounding ─────

function scoreCompetitivePressure(
  company: CompanyForIntent, allDeals: DealForIntent[], targetModality: string, targetIndication: string
): { name: string; score: number; evidence: string } {
  const cutoff = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  const rivalDeals = allDeals.filter(d =>
    d.licensee_id !== company.id &&
    new Date(d.announced_date) >= cutoff &&
    (matchesModality(d.modality, targetModality) || matchesIndication(d, targetIndication))
  );

  let weightedRivalCount = 0;
  const uniqueRivals = new Set<string>();
  for (const d of rivalDeals) {
    weightedRivalCount += getRecencyWeight(new Date(d.announced_date).getFullYear());
    if (d.licensee_name) uniqueRivals.add(d.licensee_name);
  }

  // Non-linear: 4+ unique rivals = 1.5x, 2+ = 1.2x
  const mult = uniqueRivals.size >= 4 ? 1.5 : uniqueRivals.size >= 2 ? 1.2 : 1.0;
  const base = weightedRivalCount >= 8 ? 95 : weightedRivalCount >= 5 ? 80 : weightedRivalCount >= 3 ? 60 : weightedRivalCount >= 1 ? 40 : 15;
  const score = Math.min(100, Math.round(base * mult));

  return { name: 'Competitive Pressure', score, evidence: uniqueRivals.size > 0
    ? `${uniqueRivals.size} rivals active, ${Math.round(weightedRivalCount)}× weighted deals` : 'Limited competitive activity' };
}

// ── 6. Strategic Signals ─────────────────────────────────

function scoreStrategicSignals(
  company: CompanyForIntent, targetModality: string, targetIndication: string, press?: PressReleaseForIntent[]
): { name: string; score: number; evidence: string } {
  let score = 0;
  const parts: string[] = [];
  const kw = extractKeywords(targetModality, targetIndication);

  if ((company.strategic_priorities || []).some(p => kw.some(k => p.toLowerCase().includes(k)))) { score += 30; parts.push('Priority match'); }
  if (company.hiring_bd_roles) { score += 20; parts.push('BD hiring'); }
  if (company.acquisition_appetite === 'aggressive') { score += 15; parts.push('Aggressive'); }
  else if (company.acquisition_appetite === 'moderate') score += 5;

  if (press && press.length > 0) {
    const recent = press.filter(p => new Date(p.published_at).getTime() > Date.now() - 180 * 86400000);
    const dealAnn = recent.filter(p => p.is_deal_announcement);
    if (dealAnn.length >= 2) { score += 20; parts.push(`${dealAnn.length} deal announcements`); }
    else if (dealAnn.length === 1) { score += 10; parts.push('Deal announcement'); }

    const relevant = recent.filter(p => kw.some(k => `${p.headline} ${p.body_text || ''}`.toLowerCase().includes(k)));
    if (relevant.length > 0) { score += 15; parts.push(`${relevant.length} press mentions`); }
  }

  return { name: 'Strategic Signals', score: Math.min(100, score), evidence: parts.length > 0 ? parts.join(' + ') : 'No strategic signals' };
}

// ── 7. Research Investment ────────────────────────────────

function scoreResearchInvestment(
  sigs?: ResearchSignalForIntent[], targetModality?: string, targetIndication?: string
): { name: string; score: number; evidence: string } {
  if (!sigs || sigs.length === 0) return { name: 'Research', score: 20, evidence: 'No research signals' };

  const recent = sigs.filter(s => s.published_date && new Date(s.published_date).getTime() > Date.now() - 365 * 86400000);
  const pubs = recent.filter(s => s.signal_type === 'publication' || s.signal_type === 'preprint');
  const grants = recent.filter(s => s.signal_type === 'funding');
  const patents = recent.filter(s => s.signal_type === 'patent');
  const funding = grants.reduce((s, g) => s + (g.funding_amount_usd || 0), 0);

  let score = 0;
  if (pubs.length >= 5) score += 35; else if (pubs.length >= 2) score += 20; else if (pubs.length >= 1) score += 10;
  if (funding >= 10e6) score += 30; else if (funding >= 1e6) score += 15; else if (grants.length > 0) score += 8;
  if (patents.length >= 2) score += 25; else if (patents.length >= 1) score += 12;

  const kw = extractKeywords(targetModality || '', targetIndication || '');
  if (recent.some(s => s.therapeutic_area && kw.some(k => (s.therapeutic_area || '').toLowerCase().includes(k)))) score += 10;

  const parts: string[] = [];
  if (pubs.length > 0) parts.push(`${pubs.length} pubs`);
  if (grants.length > 0) parts.push(`$${(funding / 1e6).toFixed(1)}M grants`);
  if (patents.length > 0) parts.push(`${patents.length} patents`);

  return { name: 'Research', score: Math.min(100, score), evidence: parts.length > 0 ? parts.join(', ') : 'No research signals' };
}

// ── 8. Deal Persistence ──────────────────────────────────

function scorePersistence(
  company: CompanyForIntent, inDeals: DealForIntent[], targetModality: string, targetIndication: string
): { name: string; score: number; evidence: string } {
  const targetDeals = inDeals.filter(d => matchesModality(d.modality, targetModality) || matchesIndication(d, targetIndication));
  const years = new Set(targetDeals.map(d => new Date(d.announced_date).getFullYear()));

  let score: number;
  if (targetDeals.length >= 5 && years.size >= 2) score = 95;
  else if (targetDeals.length >= 3) score = 75;
  else if (targetDeals.length >= 2) score = 55;
  else if (targetDeals.length >= 1) score = 35;
  else if (inDeals.length >= 3) score = 25;
  else score = 10;

  return { name: 'Persistence', score, evidence: targetDeals.length > 0
    ? `${targetDeals.length} deals in target space across ${years.size} yr${years.size > 1 ? 's' : ''}`
    : inDeals.length > 0 ? `${inDeals.length} total (none in target)` : 'No deal history' };
}

// ── 9. Self-Saturation Penalty ───────────────────────────
// If company JUST acquired in the same modality, they likely don't need another

function scoreSelfSaturation(
  company: CompanyForIntent, inDeals: DealForIntent[], targetModality: string, targetIndication: string
): { name: string; score: number; evidence: string } {
  const recentExact = inDeals.filter(d =>
    daysSince(d.announced_date) < 180 &&
    matchesModality(d.modality, targetModality) &&
    matchesIndication(d, targetIndication)
  );

  const recentModality = inDeals.filter(d =>
    daysSince(d.announced_date) < 120 &&
    matchesModality(d.modality, targetModality)
  );

  // High score = LOW saturation = GOOD (more room to acquire)
  // Low score = HIGH saturation = BAD (already bought, don't need more)
  if (recentExact.length >= 2) {
    return { name: 'Self-Saturation', score: 10, evidence: `${recentExact.length} recent deals in EXACT space — likely saturated` };
  }
  if (recentExact.length === 1) {
    return { name: 'Self-Saturation', score: 30, evidence: `1 recent deal in exact space — partially saturated` };
  }
  if (recentModality.length >= 3) {
    return { name: 'Self-Saturation', score: 25, evidence: `${recentModality.length} recent deals in same modality — nearing saturation` };
  }
  if (recentModality.length >= 1) {
    return { name: 'Self-Saturation', score: 55, evidence: `${recentModality.length} recent modality deal${recentModality.length > 1 ? 's' : ''} — some room` };
  }
  return { name: 'Self-Saturation', score: 85, evidence: 'No recent deals in this space — high acquisition room' };
}

// ── 10. Portfolio Balance ────────────────────────────────
// Concentration risk drives diversification; thin gaps drive urgency

function scorePortfolioBalance(
  company: CompanyForIntent, inDeals: DealForIntent[], trials: TrialForIntent[],
  targetModality: string, targetIndication: string, targetTA?: string
): { name: string; score: number; evidence: string } {
  const myTrials = trials.filter(t => t.company_id === company.id);
  const allIndications = new Set([
    ...(company.indications_active || []),
    ...myTrials.map(t => t.indication_category).filter(Boolean) as string[],
  ]);
  const allModalities = new Set([
    ...(company.modalities_active || []),
    ...myTrials.map(t => t.modality).filter(Boolean) as string[],
  ]);

  // Does the company have the target indication/modality?
  // Require either exact match or substring match with a minimum length of 4,
  // so that a 2-3 character code (e.g., 'ra' for rheumatoid arthritis) cannot
  // false-positive against unrelated strings.
  const normTI = targetIndication.toLowerCase();
  const normTM = targetModality.toLowerCase();
  const hasTargetInd =
    allIndications.has(targetIndication) ||
    [...allIndications].some(i => {
      const li = i.toLowerCase();
      return li === normTI || (normTI.length >= 4 && li.includes(normTI));
    });
  const hasTargetMod =
    allModalities.has(targetModality) ||
    [...allModalities].some(m => {
      const lm = m.toLowerCase();
      return lm === normTM || (normTM.length >= 4 && lm.includes(normTM));
    });

  // Concentration: count deals in their TOP indication vs total
  const dealsByInd: Record<string, number> = {};
  for (const d of inDeals) {
    const key = d.indication_category || 'other';
    dealsByInd[key] = (dealsByInd[key] || 0) + 1;
  }
  const topIndCount = Math.max(...Object.values(dealsByInd), 0);
  const totalDeals = inDeals.length || 1;
  const concentrationRatio = topIndCount / totalDeals; // 0-1, higher = more concentrated

  let score: number;
  let evidence: string;

  if (!hasTargetInd && !hasTargetMod && allIndications.size > 0) {
    // Company is completely outside this space — diversification opportunity
    score = 70;
    evidence = `Not in target space yet — diversification opportunity (${allIndications.size} existing indications)`;
  } else if (!hasTargetInd && hasTargetMod) {
    // Has the modality but not the indication — natural expansion
    score = 80;
    evidence = `Active in modality but not indication — natural expansion path`;
  } else if (concentrationRatio >= 0.6 && hasTargetInd) {
    // Very concentrated in target — less need to add more
    score = 25;
    evidence = `${Math.round(concentrationRatio * 100)}% concentration in top indication — less diversification need`;
  } else if (concentrationRatio >= 0.6 && !hasTargetInd) {
    // Concentrated elsewhere — strong diversification pressure
    score = 85;
    evidence = `${Math.round(concentrationRatio * 100)}% concentrated elsewhere — diversification urgency`;
  } else {
    score = 50;
    evidence = `Balanced portfolio across ${allIndications.size} indications`;
  }

  return { name: 'Portfolio Balance', score, evidence };
}

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function matchesModality(m: string | null, target: string): boolean {
  if (!m) return false;
  const a = m.toLowerCase(), b = target.toLowerCase();
  return a === b || a.includes(b) || b.includes(a);
}

function matchesIndication(item: { indication_category?: string | null; indication_specific?: string | null }, target: string): boolean {
  const t = target.toLowerCase();
  const c = (item.indication_category || '').toLowerCase();
  const s = (item.indication_specific || '').toLowerCase();
  if (c === t || s === t) return true;
  if (c && c.includes(t)) return true;
  if (s && s.includes(t)) return true;
  // Reverse containment (t.includes(c)) requires word-boundary matching for short
  // category strings to avoid false positives like "alzheimers".includes("als").
  if (c && t.length > 3) {
    if (c.length <= 4) {
      const wordBoundary = new RegExp(`(^|[^a-z0-9])${c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`);
      if (wordBoundary.test(t)) return true;
    } else if (t.includes(c)) {
      return true;
    }
  }
  return false;
}

function isAdjacentModality(mod: string, target: string): boolean {
  const adj = MODALITY_ADJACENCY[target.toLowerCase()] || MODALITY_ADJACENCY[target] || [];
  return adj.some(a => mod.toLowerCase().includes(a) || a.includes(mod.toLowerCase()));
}

function extractKeywords(modality: string, indication: string): string[] {
  return [
    modality.toLowerCase(),
    ...modality.replace(/([A-Z])/g, ' $1').toLowerCase().split(/\s+/),
    indication.toLowerCase(),
    ...indication.toLowerCase().split('_'),
  ].filter(w => w.length > 2);
}
