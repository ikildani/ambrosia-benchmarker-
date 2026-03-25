// Pharma Intent Score Engine
// Predicts the probability (0-100) that a pharma company will pursue a deal
// in a specific modality/indication within the next 12-18 months.
//
// 6-factor weighted model:
// 1. Patent Cliff Pressure (25%) — LOE urgency drives acquisition need
// 2. Deal Velocity (20%) — recent deal activity signals active BD
// 3. Pipeline Gap (20%) — thin pipeline in target area = in-licensing need
// 4. Modality/Indication Alignment (15%) — focus area match
// 5. Strategic Signals (10%) — announcements, hiring, priorities
// 6. Competitive Pressure (10%) — rival deals create FOMO

// Modality adjacency map (reused from partner-matching)
const MODALITY_ADJACENCY: Record<string, string[]> = {
  'adc': ['antibody', 'bispecific', 'small_molecule'],
  'bispecific': ['antibody', 'adc'],
  'antibody': ['adc', 'bispecific'],
  'car_t': ['cell_therapy', 'gene_therapy', 'antibody'],
  'cell_therapy': ['car_t', 'gene_therapy'],
  'gene_therapy': ['cell_therapy', 'mrna', 'oligonucleotide', 'aso'],
  'mrna': ['gene_therapy', 'vaccine', 'oligonucleotide'],
  'radiopharm': ['antibody', 'small_molecule', 'peptide'],
  'small_molecule': ['peptide', 'ion_channel'],
  'oligonucleotide': ['gene_therapy', 'mrna', 'aso', 'rnai'],
  'peptide': ['small_molecule', 'antibody'],
  'vaccine': ['mrna', 'antibody'],
  'aso': ['oligonucleotide', 'gene_therapy', 'rnai'],
  'monoclonalAntibody': ['bispecific', 'adc', 'antibody'],
  'rnaTherapeutic': ['oligonucleotide', 'mrna', 'aso', 'gene_therapy'],
  'molecularGlue': ['small_molecule', 'protac'],
  'protac': ['molecularGlue', 'small_molecule'],
  'geneTherapy': ['cell_therapy', 'mrna', 'oligonucleotide'],
  'cellTherapy': ['car_t', 'gene_therapy'],
  'smallMolecule': ['peptide', 'ion_channel', 'small_molecule'],
};

// ─── Types ───────────────────────────────────────────────

export interface PharmaIntentResult {
  intentScore: number;            // 0-100
  intentTier: 'very_high' | 'high' | 'moderate' | 'low' | 'minimal';
  confidence: number;             // 0-1
  timing: 'imminent' | 'near_term' | 'medium_term' | 'speculative';
  factors: IntentFactor[];
  signals: string[];              // top 3 human-readable evidence lines
  modalityFit: number;            // 0-100
  indicationFit: number;          // 0-100
}

export interface IntentFactor {
  name: string;
  score: number;                  // 0-100
  weight: number;                 // 0-1
  evidence: string;
}

interface CompanyProfile {
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
}

interface Deal {
  modality: string | null;
  indication_category: string | null;
  indication_specific: string | null;
  announced_date: string;
  deal_type: string | null;
  licensee_id: string;
  licensee_name: string | null;
}

interface Trial {
  modality: string | null;
  indication_category: string | null;
  indication_specific: string | null;
  phase: string | null;
  status: string | null;
}

// ─── Factor Weights ──────────────────────────────────────

const FACTOR_WEIGHTS = {
  patentCliff: 0.25,
  dealVelocity: 0.20,
  pipelineGap: 0.20,
  alignment: 0.15,
  strategic: 0.10,
  competitive: 0.10,
};

// ─── Core Function ───────────────────────────────────────

export function calculatePharmaIntent(
  company: CompanyProfile,
  targetModality: string,
  targetIndication: string,
  recentDeals: Deal[],
  activeTrials: Trial[],
  allRecentDeals?: Deal[], // all deals in the space (for competitive pressure)
): PharmaIntentResult {

  const factors: IntentFactor[] = [];

  // ── Factor 1: Patent Cliff Pressure (25%) ──
  const patentCliffScore = scorePatentCliff(company);
  factors.push({
    name: 'Patent Cliff Pressure',
    score: patentCliffScore.score,
    weight: FACTOR_WEIGHTS.patentCliff,
    evidence: patentCliffScore.evidence,
  });

  // ── Factor 2: Deal Velocity (20%) ──
  const dealVelocityScore = scoreDealVelocity(company, recentDeals, targetModality, targetIndication);
  factors.push({
    name: 'Deal Velocity',
    score: dealVelocityScore.score,
    weight: FACTOR_WEIGHTS.dealVelocity,
    evidence: dealVelocityScore.evidence,
  });

  // ── Factor 3: Pipeline Gap (20%) ──
  const pipelineGapScore = scorePipelineGap(company, activeTrials, targetModality, targetIndication);
  factors.push({
    name: 'Pipeline Gap',
    score: pipelineGapScore.score,
    weight: FACTOR_WEIGHTS.pipelineGap,
    evidence: pipelineGapScore.evidence,
  });

  // ── Factor 4: Modality/Indication Alignment (15%) ──
  const alignmentScore = scoreAlignment(company, targetModality, targetIndication);
  factors.push({
    name: 'Modality/Indication Alignment',
    score: alignmentScore.score,
    weight: FACTOR_WEIGHTS.alignment,
    evidence: alignmentScore.evidence,
  });

  // ── Factor 5: Strategic Signals (10%) ──
  const strategicScore = scoreStrategicSignals(company, targetModality, targetIndication);
  factors.push({
    name: 'Strategic Signals',
    score: strategicScore.score,
    weight: FACTOR_WEIGHTS.strategic,
    evidence: strategicScore.evidence,
  });

  // ── Factor 6: Competitive Pressure (10%) ──
  const competitiveScore = scoreCompetitivePressure(company, allRecentDeals || [], targetModality, targetIndication);
  factors.push({
    name: 'Competitive Pressure',
    score: competitiveScore.score,
    weight: FACTOR_WEIGHTS.competitive,
    evidence: competitiveScore.evidence,
  });

  // ── Composite Score ──
  const rawScore = factors.reduce((sum, f) => sum + f.score * f.weight, 0);

  // Appetite multiplier — inactive companies get penalized
  const appetiteMultiplier = company.acquisition_appetite === 'aggressive' ? 1.1
    : company.acquisition_appetite === 'moderate' ? 1.0
    : company.acquisition_appetite === 'selective' ? 0.85
    : company.acquisition_appetite === 'inactive' ? 0.5
    : 1.0;

  const intentScore = Math.min(100, Math.max(0, Math.round(rawScore * appetiteMultiplier)));

  // ── Tier ──
  const intentTier = intentScore >= 80 ? 'very_high'
    : intentScore >= 60 ? 'high'
    : intentScore >= 40 ? 'moderate'
    : intentScore >= 20 ? 'low'
    : 'minimal';

  // ── Timing Prediction ──
  const hasRecentDeal = company.last_deal_date && daysSince(company.last_deal_date) < 90;
  const hasActiveTrialsInTarget = activeTrials.some(t =>
    t.status === 'recruiting' && matchesIndication(t, targetIndication)
  );

  const timing = intentScore >= 80 && hasRecentDeal ? 'imminent'
    : intentScore >= 60 && hasActiveTrialsInTarget ? 'near_term'
    : intentScore >= 40 ? 'medium_term'
    : 'speculative';

  // ── Confidence ──
  const dealCount = company.deals_last_24mo || 0;
  const trialCount = company.active_trials_count || 0;
  const dqs = company.data_quality_score || 0;

  const confidence = Math.min(1, Math.max(0,
    (dqs >= 70 ? 0.4 : dqs >= 40 ? 0.25 : 0.1) +
    (dealCount >= 5 ? 0.3 : dealCount >= 2 ? 0.2 : dealCount >= 1 ? 0.1 : 0) +
    (trialCount >= 10 ? 0.3 : trialCount >= 3 ? 0.2 : trialCount >= 1 ? 0.1 : 0)
  ));

  // ── Signals (top 3 human-readable) ──
  const signals = factors
    .filter(f => f.score >= 40)
    .sort((a, b) => b.score * b.weight - a.score * a.weight)
    .slice(0, 3)
    .map(f => f.evidence);

  if (signals.length === 0) {
    signals.push('Limited data — intent score is speculative');
  }

  return {
    intentScore,
    intentTier,
    confidence: Math.round(confidence * 100) / 100,
    timing,
    factors,
    signals,
    modalityFit: alignmentScore.modalityFit,
    indicationFit: alignmentScore.indicationFit,
  };
}

// ─── Factor Scoring Functions ────────────────────────────

function scorePatentCliff(company: CompanyProfile): { score: number; evidence: string } {
  const risk2025 = company.revenue_at_risk_2025 || 0;
  const risk2026 = company.revenue_at_risk_2026 || 0;
  const risk2027 = company.revenue_at_risk_2027 || 0;
  const totalRisk = risk2025 + risk2026 + risk2027;

  if (totalRisk <= 0) return { score: 30, evidence: 'No significant patent cliff data available' };

  // Score based on absolute revenue at risk (in USD)
  if (totalRisk >= 20e9) return { score: 95, evidence: `$${(totalRisk / 1e9).toFixed(0)}B revenue at risk 2025-2027 — critical acquisition urgency` };
  if (totalRisk >= 10e9) return { score: 85, evidence: `$${(totalRisk / 1e9).toFixed(0)}B revenue at risk 2025-2027 — high acquisition urgency` };
  if (totalRisk >= 5e9) return { score: 70, evidence: `$${(totalRisk / 1e9).toFixed(0)}B revenue at risk 2025-2027` };
  if (totalRisk >= 2e9) return { score: 55, evidence: `$${(totalRisk / 1e9).toFixed(1)}B revenue at risk 2025-2027` };
  if (totalRisk >= 500e6) return { score: 40, evidence: `$${(totalRisk / 1e6).toFixed(0)}M revenue at risk 2025-2027` };
  return { score: 25, evidence: `Modest patent cliff pressure ($${(totalRisk / 1e6).toFixed(0)}M)` };
}

function scoreDealVelocity(
  company: CompanyProfile,
  deals: Deal[],
  targetModality: string,
  targetIndication: string
): { score: number; evidence: string } {
  const deals12mo = company.deals_last_12mo || 0;
  const deals24mo = company.deals_last_24mo || 0;

  // Deals in target modality/indication
  const relevantDeals = deals.filter(d =>
    d.licensee_id === company.id && (
      matchesModality(d.modality, targetModality) ||
      matchesIndication(d, targetIndication)
    )
  );

  let score = 0;

  // Base velocity
  if (deals12mo >= 5) score += 40;
  else if (deals12mo >= 3) score += 30;
  else if (deals12mo >= 1) score += 20;
  else if (deals24mo >= 1) score += 10;

  // Acceleration bonus (doing more deals recently)
  if (deals24mo > 0 && deals12mo > deals24mo / 2) score += 15;

  // Relevant deal bonus
  if (relevantDeals.length >= 2) score += 25;
  else if (relevantDeals.length === 1) score += 15;

  // Recency bonus
  if (company.last_deal_date) {
    const days = daysSince(company.last_deal_date);
    if (days < 90) score += 20;
    else if (days < 180) score += 10;
  }

  score = Math.min(100, score);

  const evidence = relevantDeals.length > 0
    ? `${relevantDeals.length} deal${relevantDeals.length > 1 ? 's' : ''} in target space + ${deals12mo} total in last 12mo`
    : deals12mo > 0
    ? `${deals12mo} deals in last 12mo (none yet in target modality/indication)`
    : 'No recent deal activity';

  return { score, evidence };
}

function scorePipelineGap(
  company: CompanyProfile,
  trials: Trial[],
  targetModality: string,
  targetIndication: string
): { score: number; evidence: string } {
  // Trials matching target
  const modalityTrials = trials.filter(t => matchesModality(t.modality, targetModality));
  const indicationTrials = trials.filter(t => matchesIndication(t, targetIndication));
  const exactTrials = trials.filter(t => matchesModality(t.modality, targetModality) && matchesIndication(t, targetIndication));

  // Late-stage trials (Phase 2+)
  const lateStageInTarget = indicationTrials.filter(t =>
    t.phase && ['phase_2', 'phase_2_3', 'phase_3', 'phase_4'].some(p => t.phase!.includes(p))
  );

  // Score: MORE gap = HIGHER score (they need to in-license)
  let score = 50; // baseline — moderate gap

  if (exactTrials.length === 0 && modalityTrials.length === 0) {
    score = 85; // No trials at all in this modality → big gap
  } else if (exactTrials.length === 0 && modalityTrials.length <= 2) {
    score = 70; // Few trials in modality, none exact
  } else if (lateStageInTarget.length === 0 && indicationTrials.length > 0) {
    score = 60; // Active in indication but no late-stage → need to fill
  } else if (lateStageInTarget.length >= 3) {
    score = 15; // Strong internal pipeline → less need to in-license
  } else if (lateStageInTarget.length >= 1) {
    score = 30; // Some coverage
  }

  // Large pharma with thin pipeline = higher score
  if (company.company_type === 'large_pharma' && company.active_trials_count < 50) {
    score = Math.min(100, score + 10);
  }

  const evidence = exactTrials.length === 0
    ? `No active trials in ${formatLabel(targetModality)} × ${formatLabel(targetIndication)} — pipeline gap`
    : `${exactTrials.length} active trial${exactTrials.length > 1 ? 's' : ''} in target space (${lateStageInTarget.length} late-stage)`;

  return { score, evidence };
}

function scoreAlignment(
  company: CompanyProfile,
  targetModality: string,
  targetIndication: string
): { score: number; evidence: string; modalityFit: number; indicationFit: number } {
  const modalities = [...(company.modalities_primary || []), ...(company.modalities_active || [])];
  const indications = [...(company.indications_specific || []), ...(company.indications_active || [])];

  // Modality fit
  let modalityFit = 0;
  const targetModLower = targetModality.toLowerCase();
  if (modalities.some(m => m.toLowerCase() === targetModLower)) {
    modalityFit = 100;
  } else if (modalities.some(m => isAdjacentModality(m, targetModality))) {
    modalityFit = 60;
  } else if (modalities.length > 0) {
    modalityFit = 20;
  }

  // Indication fit
  let indicationFit = 0;
  const targetIndLower = targetIndication.toLowerCase();
  if (indications.some(i => i.toLowerCase() === targetIndLower)) {
    indicationFit = 100;
  } else if (indications.some(i => i.toLowerCase().includes(targetIndLower.split('_')[0]))) {
    indicationFit = 60;
  } else if (indications.length > 0) {
    indicationFit = 20;
  }

  const score = Math.round(modalityFit * 0.5 + indicationFit * 0.5);
  const evidence = `Modality fit: ${modalityFit}% | Indication fit: ${indicationFit}%`;

  return { score, evidence, modalityFit, indicationFit };
}

function scoreStrategicSignals(
  company: CompanyProfile,
  targetModality: string,
  targetIndication: string
): { score: number; evidence: string } {
  let score = 0;
  const signals: string[] = [];

  // Strategic priorities keyword match
  const priorities = (company.strategic_priorities || []).map(p => p.toLowerCase());
  const targetWords = [
    targetModality.toLowerCase(),
    ...targetModality.toLowerCase().split(/(?=[A-Z])/).map(w => w.toLowerCase()),
    targetIndication.toLowerCase(),
    ...targetIndication.toLowerCase().split('_'),
  ].filter(w => w.length > 2);

  const priorityMatch = priorities.some(p => targetWords.some(w => p.includes(w)));
  if (priorityMatch) {
    score += 50;
    signals.push('Strategic priority aligns with target area');
  }

  // BD hiring signal
  if (company.hiring_bd_roles) {
    score += 25;
    signals.push('Actively hiring BD roles');
  }

  // Aggressive acquisition appetite
  if (company.acquisition_appetite === 'aggressive') {
    score += 25;
    signals.push('Aggressive acquisition appetite');
  } else if (company.acquisition_appetite === 'moderate') {
    score += 10;
  }

  score = Math.min(100, score);
  const evidence = signals.length > 0 ? signals.join(' + ') : 'No strong strategic signals detected';
  return { score, evidence };
}

function scoreCompetitivePressure(
  company: CompanyProfile,
  allDeals: Deal[],
  targetModality: string,
  targetIndication: string
): { score: number; evidence: string } {
  // Count rival deals in the target modality/indication in last 12mo
  const cutoff = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  const rivalDeals = allDeals.filter(d =>
    d.licensee_id !== company.id &&
    new Date(d.announced_date) >= cutoff &&
    (matchesModality(d.modality, targetModality) || matchesIndication(d, targetIndication))
  );

  if (rivalDeals.length >= 5) {
    return { score: 90, evidence: `${rivalDeals.length} rival deals in target space in last 12mo — high competitive pressure` };
  }
  if (rivalDeals.length >= 3) {
    return { score: 70, evidence: `${rivalDeals.length} rival deals in target space — competitors moving` };
  }
  if (rivalDeals.length >= 1) {
    return { score: 45, evidence: `${rivalDeals.length} rival deal${rivalDeals.length > 1 ? 's' : ''} in target space` };
  }
  return { score: 20, evidence: 'Limited competitive deal activity in target space' };
}

// ─── Helpers ─────────────────────────────────────────────

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

function matchesModality(dealModality: string | null, target: string): boolean {
  if (!dealModality) return false;
  const dl = dealModality.toLowerCase();
  const tl = target.toLowerCase();
  return dl === tl || dl.includes(tl) || tl.includes(dl);
}

function matchesIndication(item: { indication_category?: string | null; indication_specific?: string | null }, target: string): boolean {
  const tl = target.toLowerCase();
  const cat = (item.indication_category || '').toLowerCase();
  const spec = (item.indication_specific || '').toLowerCase();
  return cat === tl || spec === tl || cat.includes(tl) || spec.includes(tl) || tl.includes(cat);
}

function isAdjacentModality(mod: string, target: string): boolean {
  const adj = MODALITY_ADJACENCY[target.toLowerCase()] || MODALITY_ADJACENCY[target] || [];
  return adj.some(a => mod.toLowerCase().includes(a) || a.includes(mod.toLowerCase()));
}

function formatLabel(s: string): string {
  return s.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase()).trim();
}
