// Pharma Intent Score Engine v2
// Predicts the probability (0-100) that a pharma company will pursue a deal
// in a specific modality/indication within the next 12-18 months.
//
// 8-factor weighted model:
// 1. Patent Cliff Pressure (20%) — LOE urgency drives acquisition need
// 2. Deal Velocity (18%) — recent deal activity with exponential decay
// 3. Pipeline Gap (18%) — thin pipeline in target area = in-licensing need
// 4. Modality/Indication Alignment (12%) — focus area match
// 5. Competitive Pressure (10%) — rival deals + non-linear compounding
// 6. Strategic Signals (8%) — press releases, announcements, hiring
// 7. Research Investment (7%) — publications, grants, patents in target area
// 8. Backtested Persistence (7%) — historical deal→deal conversion pattern

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

// ─── Types ───────────────────────────────────────────────

export interface PharmaIntentResult {
  intentScore: number;
  intentTier: 'very_high' | 'high' | 'moderate' | 'low' | 'minimal';
  confidence: number;
  timing: 'imminent' | 'near_term' | 'medium_term' | 'speculative';
  factors: IntentFactor[];
  signals: string[];
  modalityFit: number;
  indicationFit: number;
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
}

export interface DealForIntent {
  modality: string | null;
  indication_category: string | null;
  indication_specific: string | null;
  announced_date: string;
  deal_type: string | null;
  licensee_id: string;
  licensee_name: string | null;
  upfront_usd?: number | null;
  total_deal_value_usd?: number | null;
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

// ─── Factor Weights (v2: 8 factors) ─────────────────────

const WEIGHTS = {
  patentCliff: 0.20,
  dealVelocity: 0.18,
  pipelineGap: 0.18,
  alignment: 0.12,
  competitive: 0.10,
  strategic: 0.08,
  research: 0.07,
  persistence: 0.07,
};

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
): PharmaIntentResult {
  const factors: IntentFactor[] = [];

  // ── 1. Patent Cliff Pressure (20%) ──
  const f1 = scorePatentCliff(company);
  factors.push({ name: 'Patent Cliff Pressure', score: f1.score, weight: WEIGHTS.patentCliff, evidence: f1.evidence });

  // ── 2. Deal Velocity with Exponential Decay (18%) ──
  const f2 = scoreDealVelocity(company, companyDeals, targetModality, targetIndication);
  factors.push({ name: 'Deal Velocity', score: f2.score, weight: WEIGHTS.dealVelocity, evidence: f2.evidence });

  // ── 3. Pipeline Gap from Trial Data (18%) ──
  const f3 = scorePipelineGap(company, companyTrials, targetModality, targetIndication);
  factors.push({ name: 'Pipeline Gap', score: f3.score, weight: WEIGHTS.pipelineGap, evidence: f3.evidence });

  // ── 4. Modality/Indication Alignment (12%) ──
  const f4 = scoreAlignment(company, targetModality, targetIndication);
  factors.push({ name: 'Alignment', score: f4.score, weight: WEIGHTS.alignment, evidence: f4.evidence });

  // ── 5. Competitive Pressure with Non-Linear Compounding (10%) ──
  const f5 = scoreCompetitivePressure(company, allRecentDeals || [], targetModality, targetIndication);
  factors.push({ name: 'Competitive Pressure', score: f5.score, weight: WEIGHTS.competitive, evidence: f5.evidence });

  // ── 6. Strategic Signals from Press Releases (8%) ──
  const f6 = scoreStrategicSignals(company, targetModality, targetIndication, pressReleases);
  factors.push({ name: 'Strategic Signals', score: f6.score, weight: WEIGHTS.strategic, evidence: f6.evidence });

  // ── 7. Research Investment (7%) ──
  const f7 = scoreResearchInvestment(researchSignals, targetModality, targetIndication);
  factors.push({ name: 'Research Investment', score: f7.score, weight: WEIGHTS.research, evidence: f7.evidence });

  // ── 8. Backtested Persistence (7%) ──
  const f8 = scorePersistence(company, companyDeals, targetModality, targetIndication);
  factors.push({ name: 'Deal Persistence', score: f8.score, weight: WEIGHTS.persistence, evidence: f8.evidence });

  // ── Composite Score ──
  const rawScore = factors.reduce((sum, f) => sum + f.score * f.weight, 0);

  const appetiteMultiplier = company.acquisition_appetite === 'aggressive' ? 1.1
    : company.acquisition_appetite === 'moderate' ? 1.0
    : company.acquisition_appetite === 'selective' ? 0.85
    : company.acquisition_appetite === 'inactive' ? 0.5
    : 1.0;

  const intentScore = Math.min(100, Math.max(0, Math.round(rawScore * appetiteMultiplier)));

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

  // ── Confidence ──
  const dealCount = company.deals_last_24mo || 0;
  const trialCount = companyTrials.length;
  const dqs = company.data_quality_score || 0;
  const hasPress = (pressReleases || []).length > 0;
  const hasResearch = (researchSignals || []).length > 0;

  const confidence = Math.min(1, Math.max(0,
    (dqs >= 70 ? 0.25 : dqs >= 40 ? 0.15 : 0.05) +
    (dealCount >= 5 ? 0.25 : dealCount >= 2 ? 0.15 : dealCount >= 1 ? 0.08 : 0) +
    (trialCount >= 10 ? 0.25 : trialCount >= 3 ? 0.15 : trialCount >= 1 ? 0.08 : 0) +
    (hasPress ? 0.13 : 0) +
    (hasResearch ? 0.12 : 0)
  ));

  // ── Signals ──
  const signals = factors
    .filter(f => f.score >= 40)
    .sort((a, b) => b.score * b.weight - a.score * a.weight)
    .slice(0, 3)
    .map(f => f.evidence);

  if (signals.length === 0) signals.push('Limited data — intent score is speculative');

  return {
    intentScore,
    intentTier,
    confidence: Math.round(confidence * 100) / 100,
    timing,
    factors,
    signals,
    modalityFit: f4.modalityFit,
    indicationFit: f4.indicationFit,
  };
}

// ─── Factor 1: Patent Cliff Pressure ─────────────────────

function scorePatentCliff(company: CompanyForIntent): { score: number; evidence: string } {
  const totalRisk = (company.revenue_at_risk_2025 || 0) + (company.revenue_at_risk_2026 || 0) + (company.revenue_at_risk_2027 || 0);
  if (totalRisk <= 0) return { score: 30, evidence: 'No significant patent cliff data' };
  if (totalRisk >= 20e9) return { score: 95, evidence: `$${(totalRisk / 1e9).toFixed(0)}B at risk 2025-27 — critical urgency` };
  if (totalRisk >= 10e9) return { score: 85, evidence: `$${(totalRisk / 1e9).toFixed(0)}B at risk 2025-27 — high urgency` };
  if (totalRisk >= 5e9) return { score: 70, evidence: `$${(totalRisk / 1e9).toFixed(0)}B at risk 2025-27` };
  if (totalRisk >= 2e9) return { score: 55, evidence: `$${(totalRisk / 1e9).toFixed(1)}B at risk 2025-27` };
  if (totalRisk >= 500e6) return { score: 40, evidence: `$${(totalRisk / 1e6).toFixed(0)}M at risk 2025-27` };
  return { score: 25, evidence: `Modest cliff pressure ($${(totalRisk / 1e6).toFixed(0)}M)` };
}

// ─── Factor 2: Deal Velocity with Exponential Decay ──────

function scoreDealVelocity(
  company: CompanyForIntent, deals: DealForIntent[], targetModality: string, targetIndication: string
): { score: number; evidence: string } {
  // Recency-weighted deal count
  let weightedTotal = 0;
  let weightedRelevant = 0;

  for (const deal of deals) {
    if (deal.licensee_id !== company.id) continue;
    const year = new Date(deal.announced_date).getFullYear();
    const weight = getRecencyWeight(year);
    weightedTotal += weight;

    if (matchesModality(deal.modality, targetModality) || matchesIndication(deal, targetIndication)) {
      weightedRelevant += weight;
    }
  }

  let score = 0;

  // Weighted velocity
  if (weightedTotal >= 8) score += 40;
  else if (weightedTotal >= 5) score += 30;
  else if (weightedTotal >= 2) score += 20;
  else if (weightedTotal >= 1) score += 10;

  // Acceleration (more recent deals than older)
  const deals12 = company.deals_last_12mo || 0;
  const deals24 = company.deals_last_24mo || 0;
  if (deals24 > 0 && deals12 > deals24 * 0.6) score += 15;

  // Relevant deal bonus (weighted)
  if (weightedRelevant >= 3) score += 25;
  else if (weightedRelevant >= 1.5) score += 15;
  else if (weightedRelevant >= 0.5) score += 8;

  // Recency bonus
  if (company.last_deal_date) {
    const days = daysSince(company.last_deal_date);
    if (days < 60) score += 20;
    else if (days < 120) score += 12;
    else if (days < 240) score += 5;
  }

  score = Math.min(100, score);
  const evidence = weightedRelevant >= 1
    ? `${Math.round(weightedRelevant)}× weighted deals in target space, ${deals12} total in 12mo`
    : deals12 > 0
    ? `${deals12} deals in 12mo (none in target space yet)`
    : 'No recent deal activity';

  return { score, evidence };
}

// ─── Factor 3: Pipeline Gap from Trial Data ──────────────

function scorePipelineGap(
  company: CompanyForIntent, trials: TrialForIntent[], targetModality: string, targetIndication: string
): { score: number; evidence: string } {
  const activeTrials = trials.filter(t =>
    t.company_id === company.id &&
    (t.status === 'recruiting' || t.status === 'active_not_recruiting' || t.status === 'not_yet_recruiting')
  );

  const modalityTrials = activeTrials.filter(t => matchesModality(t.modality, targetModality));
  const indicationTrials = activeTrials.filter(t => matchesIndication(t, targetIndication));
  const exactTrials = activeTrials.filter(t => matchesModality(t.modality, targetModality) && matchesIndication(t, targetIndication));

  const lateStage = indicationTrials.filter(t =>
    t.phase && ['phase_2', 'phase_2_3', 'phase_3', 'phase_4'].some(p => (t.phase || '').includes(p))
  );

  let score: number;
  if (exactTrials.length === 0 && modalityTrials.length === 0 && indicationTrials.length === 0) {
    score = 90; // No coverage at all → maximum gap
  } else if (exactTrials.length === 0 && modalityTrials.length <= 1) {
    score = 75;
  } else if (lateStage.length === 0 && indicationTrials.length > 0) {
    score = 60; // Early stage only
  } else if (lateStage.length >= 3) {
    score = 10; // Strong internal pipeline
  } else if (lateStage.length >= 1) {
    score = 30;
  } else {
    score = 50;
  }

  // Large pharma with thin pipeline = extra urgency
  if (company.company_type === 'large_pharma' && activeTrials.length < 30) {
    score = Math.min(100, score + 10);
  }

  const evidence = exactTrials.length === 0
    ? `No trials in ${fmtLabel(targetModality)} × ${fmtLabel(targetIndication)} — pipeline gap (${activeTrials.length} total active)`
    : `${exactTrials.length} trial${exactTrials.length > 1 ? 's' : ''} in target space (${lateStage.length} late-stage)`;

  return { score, evidence };
}

// ─── Factor 4: Alignment ─────────────────────────────────

function scoreAlignment(
  company: CompanyForIntent, targetModality: string, targetIndication: string
): { score: number; evidence: string; modalityFit: number; indicationFit: number } {
  const mods = [...(company.modalities_primary || []), ...(company.modalities_active || [])].map(m => m.toLowerCase());
  const inds = [...(company.indications_specific || []), ...(company.indications_active || [])].map(i => i.toLowerCase());

  const tMod = targetModality.toLowerCase();
  const tInd = targetIndication.toLowerCase();

  let modalityFit = 0;
  if (mods.some(m => m === tMod || m.includes(tMod) || tMod.includes(m))) modalityFit = 100;
  else if (mods.some(m => isAdjacentModality(m, targetModality))) modalityFit = 55;
  else if (mods.length > 0) modalityFit = 15;

  let indicationFit = 0;
  if (inds.some(i => i === tInd || i.includes(tInd) || tInd.includes(i))) indicationFit = 100;
  else if (inds.some(i => i.includes(tInd.split('_')[0]) || tInd.split('_')[0].length > 3 && i.includes(tInd.split('_')[0]))) indicationFit = 55;
  else if (inds.length > 0) indicationFit = 15;

  const score = Math.round(modalityFit * 0.5 + indicationFit * 0.5);
  return { score, evidence: `Modality ${modalityFit}% | Indication ${indicationFit}%`, modalityFit, indicationFit };
}

// ─── Factor 5: Competitive Pressure (Non-Linear) ─────────

function scoreCompetitivePressure(
  company: CompanyForIntent, allDeals: DealForIntent[], targetModality: string, targetIndication: string
): { score: number; evidence: string } {
  const cutoff = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  const rivalDeals = allDeals.filter(d =>
    d.licensee_id !== company.id &&
    new Date(d.announced_date) >= cutoff &&
    (matchesModality(d.modality, targetModality) || matchesIndication(d, targetIndication))
  );

  // Recency-weighted rival count
  let weightedRivalCount = 0;
  const uniqueRivals = new Set<string>();
  for (const d of rivalDeals) {
    const year = new Date(d.announced_date).getFullYear();
    weightedRivalCount += getRecencyWeight(year);
    if (d.licensee_name) uniqueRivals.add(d.licensee_name);
  }

  // Non-linear: pressure compounds when MULTIPLE unique rivals are active
  const rivalMultiplier = uniqueRivals.size >= 4 ? 1.5
    : uniqueRivals.size >= 2 ? 1.2
    : 1.0;

  const baseScore = weightedRivalCount >= 8 ? 95
    : weightedRivalCount >= 5 ? 80
    : weightedRivalCount >= 3 ? 60
    : weightedRivalCount >= 1 ? 40
    : 15;

  const score = Math.min(100, Math.round(baseScore * rivalMultiplier));
  const evidence = uniqueRivals.size > 0
    ? `${uniqueRivals.size} unique rivals active, ${Math.round(weightedRivalCount)}× weighted deals in space`
    : 'Limited competitive deal activity';

  return { score, evidence };
}

// ─── Factor 6: Strategic Signals (Press + Priorities) ─────

function scoreStrategicSignals(
  company: CompanyForIntent, targetModality: string, targetIndication: string,
  pressReleases?: PressReleaseForIntent[]
): { score: number; evidence: string } {
  let score = 0;
  const signals: string[] = [];

  // Priority keyword matching
  const priorities = (company.strategic_priorities || []).map(p => p.toLowerCase());
  const keywords = extractKeywords(targetModality, targetIndication);
  if (priorities.some(p => keywords.some(k => p.includes(k)))) {
    score += 30;
    signals.push('Strategic priority matches target');
  }

  // BD hiring
  if (company.hiring_bd_roles) { score += 20; signals.push('Hiring BD roles'); }

  // Appetite
  if (company.acquisition_appetite === 'aggressive') { score += 15; signals.push('Aggressive appetite'); }
  else if (company.acquisition_appetite === 'moderate') score += 5;

  // Press release analysis
  if (pressReleases && pressReleases.length > 0) {
    const recent = pressReleases.filter(p =>
      new Date(p.published_at).getTime() > Date.now() - 180 * 24 * 60 * 60 * 1000
    );
    const dealAnnouncements = recent.filter(p => p.is_deal_announcement);

    if (dealAnnouncements.length >= 2) { score += 20; signals.push(`${dealAnnouncements.length} deal announcements in 6mo`); }
    else if (dealAnnouncements.length === 1) { score += 10; signals.push('Recent deal announcement'); }

    // NLP keyword scan in headlines/body
    const relevantPress = recent.filter(p => {
      const text = `${p.headline} ${p.body_text || ''}`.toLowerCase();
      return keywords.some(k => text.includes(k));
    });
    if (relevantPress.length > 0) {
      score += 15;
      signals.push(`${relevantPress.length} press mention${relevantPress.length > 1 ? 's' : ''} of target area`);
    }
  }

  score = Math.min(100, score);
  return { score, evidence: signals.length > 0 ? signals.join(' + ') : 'No strong strategic signals' };
}

// ─── Factor 7: Research Investment ───────────────────────

function scoreResearchInvestment(
  signals?: ResearchSignalForIntent[], targetModality?: string, targetIndication?: string
): { score: number; evidence: string } {
  if (!signals || signals.length === 0) return { score: 20, evidence: 'No research signals available' };

  const keywords = extractKeywords(targetModality || '', targetIndication || '');
  const recent = signals.filter(s => s.published_date &&
    new Date(s.published_date).getTime() > Date.now() - 365 * 24 * 60 * 60 * 1000
  );

  // Count publications, grants, patents
  const publications = recent.filter(s => s.signal_type === 'publication' || s.signal_type === 'preprint');
  const grants = recent.filter(s => s.signal_type === 'funding');
  const patents = recent.filter(s => s.signal_type === 'patent');
  const totalFunding = grants.reduce((sum, g) => sum + (g.funding_amount_usd || 0), 0);

  let score = 0;

  if (publications.length >= 5) score += 35;
  else if (publications.length >= 2) score += 20;
  else if (publications.length >= 1) score += 10;

  if (totalFunding >= 10e6) score += 30;
  else if (totalFunding >= 1e6) score += 15;
  else if (grants.length > 0) score += 8;

  if (patents.length >= 2) score += 25;
  else if (patents.length >= 1) score += 12;

  // TA relevance bonus
  const taRelevant = recent.filter(s =>
    s.therapeutic_area && keywords.some(k => (s.therapeutic_area || '').toLowerCase().includes(k))
  );
  if (taRelevant.length > 0) score += 10;

  score = Math.min(100, score);
  const parts: string[] = [];
  if (publications.length > 0) parts.push(`${publications.length} publications`);
  if (grants.length > 0) parts.push(`${grants.length} grants ($${(totalFunding / 1e6).toFixed(1)}M)`);
  if (patents.length > 0) parts.push(`${patents.length} patents`);

  return { score, evidence: parts.length > 0 ? parts.join(', ') + ' in last 12mo' : 'No research signals' };
}

// ─── Factor 8: Backtested Persistence ────────────────────
// Companies that repeatedly do deals in a space are likely to do more

function scorePersistence(
  company: CompanyForIntent, deals: DealForIntent[], targetModality: string, targetIndication: string
): { score: number; evidence: string } {
  const companyDeals = deals.filter(d => d.licensee_id === company.id);

  // Count deals in target space across ALL time (not just recent)
  const targetSpaceDeals = companyDeals.filter(d =>
    matchesModality(d.modality, targetModality) || matchesIndication(d, targetIndication)
  );

  // Compute yearly frequency
  const years = new Set(targetSpaceDeals.map(d => new Date(d.announced_date).getFullYear()));
  const yearSpan = years.size;

  let score: number;
  if (targetSpaceDeals.length >= 5 && yearSpan >= 2) {
    score = 95; // Serial acquirer in this space
  } else if (targetSpaceDeals.length >= 3) {
    score = 75;
  } else if (targetSpaceDeals.length >= 2) {
    score = 55;
  } else if (targetSpaceDeals.length >= 1) {
    score = 35;
  } else if (companyDeals.length >= 3) {
    score = 25; // Active acquirer, just not in this exact space
  } else {
    score = 10;
  }

  const evidence = targetSpaceDeals.length > 0
    ? `${targetSpaceDeals.length} historical deals in target space across ${yearSpan} year${yearSpan > 1 ? 's' : ''}`
    : companyDeals.length > 0
    ? `${companyDeals.length} total deals (none in target space)`
    : 'No deal history for this company';

  return { score, evidence };
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
  return cat === tl || spec === tl || cat.includes(tl) || spec.includes(tl) || (tl.length > 3 && tl.includes(cat));
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

function fmtLabel(s: string): string {
  return s.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase()).trim();
}
