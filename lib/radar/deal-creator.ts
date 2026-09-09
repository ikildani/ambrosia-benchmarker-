/**
 * Asset Radar — Layer 6: Deal Creation Engine
 *
 * The capstone. Proposes transactions that don't exist yet by crossing:
 *   Pharma portfolio gaps × available unpartnered assets × deal economics
 *
 * For each active acquirer (companies with acquisition_appetite != 'inactive'),
 * the engine:
 *   1. Identifies portfolio gaps (TAs/modalities they're weak in but need)
 *   2. Finds unpartnered assets that fill those gaps
 *   3. Scores strategic fit, timing, and opportunity quality
 *   4. Generates a deal rationale explaining WHY this deal should happen
 *   5. Attaches predicted economics from Layer 3 deal theses
 *
 * Vocabulary note: `companies.indications_active` holds trial indication
 * CATEGORIES ('solid_tumor', 'hematological', 'cns', ...), not therapeutic
 * areas. Every TA comparison below maps categories → TA first, using the
 * same map asset-universe uses to derive `clinical_assets.therapeutic_area`.
 *
 * Run: daily at 11:30 AM UTC via /api/cron/deal-creator
 * Depends on: all prior layers running first
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { modalityKey, modalitiesMatch } from '@/lib/comparables/match-normalize';
import { phaseRank as sharedPhaseRank } from '@/lib/comparable-scoring';
import { radarPhaseToDb } from './deal-thesis';
import { logRadarRun, deriveRunStatus } from './run-log';

// ═══════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════

interface AcquirerProfile {
  id: string;
  name: string;
  company_type: string | null;
  modalities_active: string[];
  modalities_primary: string[];
  /** Trial indication categories ('solid_tumor', ...) — NOT therapeutic areas. */
  indications_active: string[];
  indications_specific: string[];
  deals_last_12mo: number;
  deals_last_24mo: number;
  last_deal_modality: string | null;
  last_deal_indication: string | null;
  actively_acquiring: boolean;
  acquisition_appetite: string | null;
  strategic_priorities: string[];
  patent_cliffs: unknown;
  revenue_at_risk_2026: number;
  revenue_at_risk_2027: number;
  phase_preference_min: string | null;
  phase_preference_max: string | null;
  territory_focus: string[];
}

interface CandidateAsset {
  id: string;
  company_id: string | null;
  company_name: string;
  asset_name: string;
  modality: string | null;
  therapeutic_area: string | null;
  indication_category: string | null;
  indication_specific: string | null;
  phase: string | null;
  partnership_status: string | null;
  partner_company_id: string | null;
  partner_company_name: string | null;
  deal_ids: string[] | null;
  licensing_intent_score: number;
  competitive_heat: number;
  deal_readiness_score: number;
  confidence_score: number;
}

interface DealThesisData {
  asset_id: string;
  predicted_upfront_low: number | null;
  predicted_upfront_mid: number | null;
  predicted_upfront_high: number | null;
  predicted_total_low: number | null;
  predicted_total_mid: number | null;
  predicted_total_high: number | null;
  comp_count: number;
  comp_deal_ids: string[];
  thesis_confidence: number;
}

type GapType = 'therapeutic_gap' | 'modality_gap' | 'pipeline_stage_gap' | 'geographic_gap' | 'patent_cliff_replacement' | 'competitive_response';

interface PortfolioGap {
  type: GapType;
  detail: string;
  urgency: number;
  targetModalities: string[];
  /** Therapeutic areas (asset-universe vocabulary) the gap should be filled from. */
  targetTAs: string[];
}

interface ProposedDeal {
  assetId: string;
  assetCompanyId: string | null;
  assetCompanyName: string;
  assetName: string;
  acquirerCompanyId: string;
  acquirerName: string;
  opportunityScore: number;
  strategicFitScore: number;
  timingScore: number;
  rationale: string;
  strategicDrivers: string[];
  riskFactors: string[];
  predictedUpfrontLow: number | null;
  predictedUpfrontMid: number | null;
  predictedUpfrontHigh: number | null;
  predictedTotalLow: number | null;
  predictedTotalMid: number | null;
  predictedTotalHigh: number | null;
  gapType: GapType;
  gapDetail: string;
  compDealIds: string[];
  compCount: number;
  confidence: number;
}

export interface DealCreatorResult {
  acquirersAnalyzed: number;
  assetsConsidered: number;
  opportunitiesCreated: number;
  /** Candidates dropped because they are already partnered with the proposed acquirer. */
  assetsExcludedPartnered: number;
  errors: string[];
  timedOut: boolean;
  /** False when the data_ingestion_log insert failed. */
  logWritten: boolean;
}

// ═══════════════════════════════════════════════════════════════════════
// INDICATION CATEGORY → THERAPEUTIC AREA
// (same map as lib/radar/asset-universe.ts deriveTA — keep in sync)
// ═══════════════════════════════════════════════════════════════════════

const INDICATION_CATEGORY_TO_TA: Record<string, string> = {
  solid_tumor: 'oncology', solid_tumors: 'oncology', hematological: 'oncology',
  hematologic: 'oncology', leukemia: 'oncology', lymphoma: 'oncology',
  multiple_myeloma: 'oncology', lung_cancer: 'oncology', breast_cancer: 'oncology',
  cns: 'neurology', alzheimers: 'neurology', parkinsons: 'neurology',
  epilepsy: 'neurology', migraine: 'neurology', ms: 'neurology',
  autoimmune: 'immunology', lupus: 'immunology', rheumatoid: 'immunology',
  crohns: 'immunology', psoriatic_arthritis: 'immunology', atopic_dermatitis: 'immunology',
  metabolic: 'metabolic', obesity: 'metabolic', diabetes: 'metabolic', nash: 'metabolic',
  cardiovascular: 'cardiovascular', heart_failure: 'cardiovascular',
  rare_disease: 'rare_disease', orphan: 'rare_disease',
  infectious_disease: 'infectious_disease', hiv: 'infectious_disease', hepatitis: 'infectious_disease',
  ophthalmology: 'ophthalmology', retinal: 'ophthalmology',
  dermatology: 'dermatology', psoriasis: 'dermatology',
  respiratory: 'respiratory', asthma: 'respiratory', copd: 'respiratory',
  womens_health: 'womens_health', endometriosis: 'womens_health',
  hematology: 'hematology', hemophilia: 'hematology', sickle_cell: 'hematology',
};

const KNOWN_TAS = new Set(Object.values(INDICATION_CATEGORY_TO_TA));

/** TA for an indication category; also accepts a value that is already a TA. */
export function deriveTA(indicationCategory: string | null | undefined): string | null {
  if (!indicationCategory) return null;
  const key = indicationCategory.toLowerCase().trim();
  if (INDICATION_CATEGORY_TO_TA[key]) return INDICATION_CATEGORY_TO_TA[key];
  return KNOWN_TAS.has(key) ? key : null;
}

/** Distinct TAs covered by a list of indication categories (order preserved). */
export function categoriesToTAs(categories: string[] | null | undefined): string[] {
  const out: string[] = [];
  for (const c of categories || []) {
    const ta = deriveTA(c);
    if (ta && !out.includes(ta)) out.push(ta);
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════
// TA & MODALITY ADJACENCY (for gap detection)
// ═══════════════════════════════════════════════════════════════════════

const TA_ADJACENCY: Record<string, string[]> = {
  oncology: ['hematology', 'immunology'],
  immunology: ['dermatology', 'oncology', 'respiratory'],
  neurology: ['rare_disease'],
  metabolic: ['cardiovascular'],
  cardiovascular: ['metabolic'],
  rare_disease: ['neurology', 'hematology'],
  hematology: ['oncology', 'rare_disease'],
  respiratory: ['immunology'],
  ophthalmology: [],
  dermatology: ['immunology'],
  infectious_disease: [],
};

const MODALITY_ADJACENCY: Record<string, string[]> = {
  adc: ['antibody', 'bispecific', 'small_molecule'],
  bispecific: ['antibody', 'adc'],
  antibody: ['bispecific', 'adc'],
  car_t: ['cell_therapy', 'gene_therapy'],
  cell_therapy: ['car_t', 'gene_therapy'],
  gene_therapy: ['cell_therapy', 'mrna', 'oligonucleotide'],
  mrna: ['gene_therapy', 'vaccine'],
  small_molecule: ['peptide'],
  peptide: ['small_molecule', 'antibody'],
  radiopharm: ['antibody', 'peptide'],
  oligonucleotide: ['gene_therapy', 'mrna'],
  vaccine: ['mrna', 'antibody'],
};

function adjacentModalities(modality: string | null): string[] {
  if (!modality) return [];
  const key = modalityKey(modality);
  for (const [k, adj] of Object.entries(MODALITY_ADJACENCY)) {
    if (modalityKey(k) === key) return adj;
  }
  return [];
}

function hasModality(list: string[], modality: string | null): boolean {
  if (!modality) return false;
  return list.some(m => modalitiesMatch(m, modality));
}

// ═══════════════════════════════════════════════════════════════════════
// PHASE SCORING
// ═══════════════════════════════════════════════════════════════════════

/** Ladder position via the shared normalizers; -1 when unknown. */
function phaseToOrder(phase: string | null): number {
  const db = radarPhaseToDb(phase);
  if (!db) return -1;
  return sharedPhaseRank(db) ?? -1;
}

const PHASE_1_ORDER = sharedPhaseRank('phase_1') ?? 2;
const PHASE_2_ORDER = sharedPhaseRank('phase_2') ?? 3;

// ═══════════════════════════════════════════════════════════════════════
// STEP 1: IDENTIFY PORTFOLIO GAPS
// ═══════════════════════════════════════════════════════════════════════

async function identifyPortfolioGaps(
  supabase: SupabaseClient,
  acquirer: AcquirerProfile,
): Promise<PortfolioGap[]> {
  const gaps: PortfolioGap[] = [];

  // Active TAs derived from the acquirer's trial indication categories.
  const acquirerTAs = categoriesToTAs(acquirer.indications_active);

  // Parse patent cliffs for revenue-at-risk TAs
  const patentCliffs = Array.isArray(acquirer.patent_cliffs) ? acquirer.patent_cliffs : [];
  const cliffTAs = new Set<string>();
  for (const cliff of patentCliffs) {
    if (typeof cliff === 'object' && cliff !== null && 'therapeutic_area' in cliff) {
      const ta = deriveTA(String((cliff as Record<string, unknown>).therapeutic_area));
      if (ta) cliffTAs.add(ta);
    }
  }

  // GAP 1: Patent cliff replacement
  const totalRevAtRisk = (acquirer.revenue_at_risk_2026 || 0) + (acquirer.revenue_at_risk_2027 || 0);
  const revAtRiskB = totalRevAtRisk / 1_000_000_000;
  if (totalRevAtRisk > 500_000_000) {
    gaps.push({
      type: 'patent_cliff_replacement',
      detail: `$${revAtRiskB.toFixed(1)}B revenue at risk from patent cliffs in ${Array.from(cliffTAs).join(', ') || 'key products'}`,
      urgency: Math.min(revAtRiskB * 10, 100),
      targetModalities: acquirer.modalities_active,
      targetTAs: cliffTAs.size > 0 ? Array.from(cliffTAs) : acquirerTAs,
    });
  }

  // GAP 2: Therapeutic gaps — TAs they've done deals in but don't have active pipeline
  const { data: recentDeals } = await supabase
    .from('deals')
    .select('therapeutic_area, modality, indication_category')
    .eq('licensee_id', acquirer.id)
    .eq('is_synthetic', false)
    .order('announced_date', { ascending: false })
    .limit(30);

  if (recentDeals) {
    // deals.therapeutic_area is already TA vocabulary.
    const dealTAArr = Array.from(new Set(
      recentDeals.map(d => deriveTA(d.therapeutic_area)).filter((t): t is string => !!t),
    ));
    const dealTAs = new Set(dealTAArr);
    const dealModalities = recentDeals.map(d => d.modality).filter((m): m is string => !!m);

    // TAs they deal in but have no active trial pipeline in
    for (const ta of dealTAArr) {
      if (!acquirerTAs.includes(ta)) {
        gaps.push({
          type: 'therapeutic_gap',
          detail: `Active deal history in ${ta} but no active trial pipeline — potential expansion target`,
          urgency: 40,
          targetModalities: acquirer.modalities_active,
          targetTAs: [ta],
        });
      }
    }

    // Adjacent TAs they haven't entered yet
    for (const activeTA of acquirerTAs.slice(0, 5)) {
      const adjacentTAs = TA_ADJACENCY[activeTA] || [];
      for (const adjTA of adjacentTAs) {
        if (!acquirerTAs.includes(adjTA) && !dealTAs.has(adjTA)) {
          gaps.push({
            type: 'therapeutic_gap',
            detail: `Adjacent to ${activeTA} — ${adjTA} is a natural expansion area`,
            urgency: 25,
            targetModalities: acquirer.modalities_active,
            targetTAs: [adjTA],
          });
        }
      }
    }

    // Modality gaps — modalities adjacent to their primary that they haven't in-licensed
    for (const primaryMod of acquirer.modalities_primary.slice(0, 3)) {
      for (const adjMod of adjacentModalities(primaryMod)) {
        if (!hasModality(acquirer.modalities_active, adjMod) && !hasModality(dealModalities, adjMod)) {
          gaps.push({
            type: 'modality_gap',
            detail: `${adjMod} is adjacent to ${primaryMod} platform — natural modality expansion`,
            urgency: 30,
            targetModalities: [adjMod],
            targetTAs: acquirerTAs,
          });
        }
      }
    }
  }

  // GAP 3: Pipeline stage gap — if they're heavy on early stage but light on late
  const { data: ownTrials } = await supabase
    .from('company_trials')
    .select('phase')
    .eq('company_id', acquirer.id)
    .in('status', ['recruiting', 'active_not_recruiting', 'not_yet_recruiting'])
    .limit(100);

  if (ownTrials) {
    const phaseDistribution = { early: 0, mid: 0, late: 0 };
    for (const t of ownTrials) {
      const order = phaseToOrder(t.phase);
      if (order <= PHASE_1_ORDER) phaseDistribution.early++;
      else if (order <= PHASE_2_ORDER) phaseDistribution.mid++;
      else phaseDistribution.late++;
    }

    if (phaseDistribution.late === 0 && phaseDistribution.mid > 0) {
      gaps.push({
        type: 'pipeline_stage_gap',
        detail: `No late-stage (Phase 3+) assets — heavy mid-stage pipeline needs late-stage fill`,
        urgency: 55,
        targetModalities: acquirer.modalities_active,
        targetTAs: acquirerTAs,
      });
    }
    if (phaseDistribution.early === 0 && phaseDistribution.late > 0) {
      gaps.push({
        type: 'pipeline_stage_gap',
        detail: `No early-stage pipeline — needs Phase 1/2 assets for long-term pipeline depth`,
        urgency: 35,
        targetModalities: acquirer.modalities_active,
        targetTAs: acquirerTAs,
      });
    }
  }

  // Sort by urgency
  return gaps.sort((a, b) => b.urgency - a.urgency).slice(0, 10);
}

// ═══════════════════════════════════════════════════════════════════════
// STEP 2: FIND MATCHING UNPARTNERED ASSETS
// ═══════════════════════════════════════════════════════════════════════

const CANDIDATE_SELECT = 'id, company_id, company_name, asset_name, modality, therapeutic_area, indication_category, indication_specific, phase, partnership_status, partner_company_id, partner_company_name, deal_ids, licensing_intent_score, competitive_heat, deal_readiness_score, confidence_score';

const normName = (s: string | null | undefined) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

function sameCompany(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normName(a);
  const nb = normName(b);
  if (!na || !nb) return false;
  return na === nb || na.startsWith(nb) || nb.startsWith(na);
}

/**
 * Ids of assets whose linked deals already have this acquirer as licensee.
 * One batched query per candidate set.
 */
async function assetsAlreadyDealtWith(
  supabase: SupabaseClient,
  assets: CandidateAsset[],
  acquirer: AcquirerProfile,
): Promise<Set<string>> {
  const out = new Set<string>();
  const dealToAssets = new Map<string, string[]>();
  for (const a of assets) {
    for (const dealId of a.deal_ids || []) {
      const list = dealToAssets.get(dealId) || [];
      list.push(a.id);
      dealToAssets.set(dealId, list);
    }
  }
  if (dealToAssets.size === 0) return out;

  const { data: deals } = await supabase
    .from('deals')
    .select('id, licensee_id, licensee_name')
    .in('id', Array.from(dealToAssets.keys()).slice(0, 500));

  for (const d of deals || []) {
    if (d.licensee_id === acquirer.id || sameCompany(d.licensee_name, acquirer.name)) {
      for (const assetId of dealToAssets.get(d.id) || []) out.add(assetId);
    }
  }
  return out;
}

async function findMatchingAssets(
  supabase: SupabaseClient,
  gap: PortfolioGap,
  acquirer: AcquirerProfile,
  stats: { excludedPartnered: number },
): Promise<CandidateAsset[]> {
  let query = supabase
    .from('clinical_assets')
    .select(CANDIDATE_SELECT)
    .in('partnership_status', ['unpartnered', 'partially_partnered'])
    .gte('confidence_score', 30)
    .gt('licensing_intent_score', 0)
    // `.neq('company_id', x)` silently drops NULL company_id rows (SQL NULL
    // comparison); keep them and rely on the name check below.
    .or(`company_id.is.null,company_id.neq.${acquirer.id}`);

  // Filter by gap targets — TA vocabulary against clinical_assets.therapeutic_area
  if (gap.targetTAs.length > 0 && gap.targetTAs.length <= 10) {
    query = query.in('therapeutic_area', gap.targetTAs);
  }

  if (gap.targetModalities.length > 0 && gap.targetModalities.length <= 10) {
    query = query.in('modality', gap.targetModalities);
  }

  const { data: assets } = await query
    .order('deal_readiness_score', { ascending: false })
    .limit(40);

  if (!assets) return [];

  let filtered = assets as CandidateAsset[];

  // JS-level phase filtering
  if (acquirer.phase_preference_min) {
    const minOrder = phaseToOrder(acquirer.phase_preference_min);
    if (minOrder >= 0) {
      filtered = filtered.filter(a => phaseToOrder(a.phase) >= minOrder);
    }
  }
  if (acquirer.phase_preference_max) {
    const maxOrder = phaseToOrder(acquirer.phase_preference_max);
    if (maxOrder >= 0) {
      filtered = filtered.filter(a => {
        const o = phaseToOrder(a.phase);
        return o < 0 || o <= maxOrder;
      });
    }
  }

  // Don't propose deals where the originator IS the acquirer (covers null company_id).
  filtered = filtered.filter(a => a.company_id !== acquirer.id && !sameCompany(a.company_name, acquirer.name));

  // Don't propose deals with a partner the asset already has.
  const dealtWith = await assetsAlreadyDealtWith(supabase, filtered, acquirer);
  const before = filtered.length;
  filtered = filtered.filter(a =>
    a.partner_company_id !== acquirer.id &&
    !sameCompany(a.partner_company_name, acquirer.name) &&
    !dealtWith.has(a.id),
  );
  stats.excludedPartnered += before - filtered.length;

  return filtered.slice(0, 15);
}

// ═══════════════════════════════════════════════════════════════════════
// STEP 3: SCORE AND RATIONALIZE
// ═══════════════════════════════════════════════════════════════════════

function scoreOpportunity(
  acquirer: AcquirerProfile,
  asset: CandidateAsset,
  gap: PortfolioGap,
  thesis: DealThesisData | null,
): ProposedDeal {
  // ── Strategic Fit ──────────────────────────────────
  let strategicFit = 0;
  const strategicDrivers: string[] = [];
  const riskFactors: string[] = [];

  // Modality alignment
  if (asset.modality && hasModality(acquirer.modalities_primary, asset.modality)) {
    strategicFit += 25;
    strategicDrivers.push(`Core modality fit: ${asset.modality} is a primary platform`);
  } else if (asset.modality && hasModality(acquirer.modalities_active, asset.modality)) {
    strategicFit += 15;
    strategicDrivers.push(`Active modality: ${acquirer.name} has ${asset.modality} capabilities`);
  } else if (asset.modality) {
    const adjacent = adjacentModalities(asset.modality).some(m => hasModality(acquirer.modalities_active, m));
    if (adjacent) {
      strategicFit += 8;
      strategicDrivers.push(`Adjacent modality: ${asset.modality} is adjacent to existing platforms`);
    } else {
      riskFactors.push(`New modality: ${asset.modality} is not in current portfolio`);
    }
  }

  // Indication / TA alignment — categories → TA before comparing
  const acquirerTAs = categoriesToTAs(acquirer.indications_active);
  const acquirerCategories = new Set((acquirer.indications_active || []).map(c => c.toLowerCase()));
  const assetTA = deriveTA(asset.therapeutic_area) ?? deriveTA(asset.indication_category);
  if (asset.indication_category && acquirerCategories.has(asset.indication_category.toLowerCase())) {
    strategicFit += 20;
    strategicDrivers.push(`Active in ${asset.indication_category.replace(/_/g, ' ')} — direct portfolio complement`);
  } else if (assetTA && acquirerTAs.includes(assetTA)) {
    strategicFit += 15;
    strategicDrivers.push(`Active in ${assetTA.replace(/_/g, ' ')} — same therapeutic area`);
  } else if (assetTA) {
    const adjacentTAs = TA_ADJACENCY[assetTA] || [];
    const overlapTA = adjacentTAs.some(ta => acquirerTAs.includes(ta));
    if (overlapTA) {
      strategicFit += 10;
      strategicDrivers.push(`${assetTA.replace(/_/g, ' ')} is adjacent to active therapeutic areas`);
    }
  }

  // Gap urgency
  strategicFit += Math.min(gap.urgency * 0.3, 30);
  strategicDrivers.push(`Fills ${gap.type.replace(/_/g, ' ')}: ${gap.detail}`);

  // Appetite match
  if (acquirer.acquisition_appetite === 'aggressive') {
    strategicFit += 10;
    strategicDrivers.push('Aggressive acquisition posture');
  } else if (acquirer.acquisition_appetite === 'moderate') {
    strategicFit += 5;
  }

  strategicFit = Math.min(Math.round(strategicFit), 100);

  // ── Timing Score ───────────────────────────────────
  let timingScore = 0;

  // Asset licensing intent = seller pressure
  timingScore += Math.min(asset.licensing_intent_score * 0.4, 40);

  // Asset deal readiness
  timingScore += Math.min(asset.deal_readiness_score * 0.3, 30);

  // Competitive heat = urgency to act
  if (asset.competitive_heat > 50) {
    timingScore += 20;
    strategicDrivers.push(`High competitive heat (${asset.competitive_heat}) — act quickly`);
  } else if (asset.competitive_heat > 25) {
    timingScore += 10;
  }

  // Recent acquirer deal activity = they're actively buying
  if (acquirer.deals_last_12mo >= 3) {
    timingScore += 10;
    strategicDrivers.push(`${acquirer.name} did ${acquirer.deals_last_12mo} deals in 12mo — active buyer`);
  }

  timingScore = Math.min(Math.round(timingScore), 100);

  // ── Opportunity Score (composite) ──────────────────
  const opportunityScore = Math.min(Math.round(
    strategicFit * 0.45 +
    timingScore * 0.35 +
    asset.confidence_score * 0.10 +
    (thesis?.thesis_confidence || 0) * 0.10
  ), 100);

  // ── Risk Factors ───────────────────────────────────
  if (asset.partnership_status === 'partially_partnered') {
    riskFactors.push('Asset is partially partnered — territorial restrictions may apply');
  }
  if (asset.confidence_score < 50) {
    riskFactors.push(`Low data confidence (${asset.confidence_score}/100) — limited trial data`);
  }
  const assetOrder = phaseToOrder(asset.phase);
  if (assetOrder >= 0 && assetOrder <= PHASE_1_ORDER) {
    riskFactors.push('Early-stage asset — high clinical risk, long timeline to value');
  }

  // ── Rationale ──────────────────────────────────────
  const rationaleLines = [
    `${acquirer.name} should ${gap.type === 'patent_cliff_replacement' ? 'urgently ' : ''}license ${asset.asset_name} from ${asset.company_name}.`,
  ];

  if (gap.type === 'patent_cliff_replacement') {
    rationaleLines.push(`This fills a patent cliff gap with ${gap.detail}.`);
  } else {
    rationaleLines.push(`This addresses a ${gap.type.replace(/_/g, ' ')}: ${gap.detail}.`);
  }

  if (asset.phase) {
    const phaseLabel = asset.phase.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    rationaleLines.push(`The asset is at ${phaseLabel} with a licensing intent score of ${asset.licensing_intent_score}/100.`);
  }

  if (thesis && thesis.predicted_upfront_mid) {
    rationaleLines.push(`Based on ${thesis.comp_count} comparable transactions, predicted upfront: $${thesis.predicted_upfront_low}-${thesis.predicted_upfront_high}M.`);
  }

  return {
    assetId: asset.id,
    assetCompanyId: asset.company_id,
    assetCompanyName: asset.company_name,
    assetName: asset.asset_name,
    acquirerCompanyId: acquirer.id,
    acquirerName: acquirer.name,
    opportunityScore,
    strategicFitScore: strategicFit,
    timingScore,
    rationale: rationaleLines.join(' '),
    strategicDrivers,
    riskFactors,
    predictedUpfrontLow: thesis?.predicted_upfront_low ?? null,
    predictedUpfrontMid: thesis?.predicted_upfront_mid ?? null,
    predictedUpfrontHigh: thesis?.predicted_upfront_high ?? null,
    predictedTotalLow: thesis?.predicted_total_low ?? null,
    predictedTotalMid: thesis?.predicted_total_mid ?? null,
    predictedTotalHigh: thesis?.predicted_total_high ?? null,
    gapType: gap.type,
    gapDetail: gap.detail,
    compDealIds: thesis?.comp_deal_ids || [],
    compCount: thesis?.comp_count || 0,
    confidence: Math.round((strategicFit * 0.4 + (thesis?.thesis_confidence || 30) * 0.4 + asset.confidence_score * 0.2)),
  };
}

// ═══════════════════════════════════════════════════════════════════════
// PERSIST OPPORTUNITIES
// ═══════════════════════════════════════════════════════════════════════

async function persistOpportunities(
  supabase: SupabaseClient,
  deals: ProposedDeal[],
  errors: string[],
): Promise<number> {
  let upserted = 0;

  for (const deal of deals) {
    if (deal.opportunityScore < 25) continue;

    const { error } = await supabase
      .from('radar_deal_opportunities')
      .upsert({
        asset_id: deal.assetId,
        asset_company_id: deal.assetCompanyId,
        asset_company_name: deal.assetCompanyName,
        asset_name: deal.assetName,
        acquirer_company_id: deal.acquirerCompanyId,
        acquirer_name: deal.acquirerName,
        opportunity_score: deal.opportunityScore,
        strategic_fit_score: deal.strategicFitScore,
        timing_score: deal.timingScore,
        rationale: deal.rationale,
        strategic_drivers: deal.strategicDrivers,
        risk_factors: deal.riskFactors,
        predicted_upfront_low: deal.predictedUpfrontLow,
        predicted_upfront_mid: deal.predictedUpfrontMid,
        predicted_upfront_high: deal.predictedUpfrontHigh,
        predicted_total_low: deal.predictedTotalLow,
        predicted_total_mid: deal.predictedTotalMid,
        predicted_total_high: deal.predictedTotalHigh,
        gap_type: deal.gapType,
        gap_detail: deal.gapDetail,
        comp_deal_ids: deal.compDealIds,
        comp_count: deal.compCount,
        confidence: deal.confidence,
        generated_at: new Date().toISOString(),
      }, { onConflict: 'asset_id,acquirer_company_id' });

    if (error) errors.push(`Opportunity upsert error ${deal.acquirerName}/${deal.assetName}: ${error.message}`);
    else upserted++;
  }

  return upserted;
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN: CREATE DEALS
// ═══════════════════════════════════════════════════════════════════════

const MAX_RUNTIME_MS = 250_000;

export async function runDealCreator(
  supabase: SupabaseClient,
  options?: { acquirerIds?: string[]; maxAcquirers?: number },
): Promise<DealCreatorResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  let acquirersAnalyzed = 0;
  let assetsConsidered = 0;
  let opportunitiesCreated = 0;
  let timedOut = false;
  const stats = { excludedPartnered: 0 };

  // Fetch active acquirers (companies that buy things)
  let acquirerQuery = supabase
    .from('companies')
    .select('id, name, company_type, modalities_active, modalities_primary, indications_active, indications_specific, deals_last_12mo, deals_last_24mo, last_deal_modality, last_deal_indication, actively_acquiring, acquisition_appetite, strategic_priorities, patent_cliffs, revenue_at_risk_2026, revenue_at_risk_2027, phase_preference_min, phase_preference_max, territory_focus')
    .eq('actively_acquiring', true)
    .gte('data_quality_score', 40)
    .order('deals_last_12mo', { ascending: false });

  if (options?.acquirerIds?.length) {
    acquirerQuery = acquirerQuery.in('id', options.acquirerIds);
  }

  const maxAcquirers = options?.maxAcquirers ?? 50;
  const { data: acquirers, error: acqError } = await acquirerQuery.limit(maxAcquirers);
  if (acqError || !acquirers) {
    const message = acqError?.message || 'No acquirers found';
    const logWritten = await logRadarRun(supabase, { source: 'deal_creator', startedAt: startTime, status: 'failed', errors: [message] });
    return { acquirersAnalyzed: 0, assetsConsidered: 0, opportunitiesCreated: 0, assetsExcludedPartnered: 0, errors: [message], timedOut: false, logWritten };
  }

  // Pre-fetch all deal theses for lookup
  const { data: allTheses } = await supabase
    .from('radar_deal_theses')
    .select('asset_id, predicted_upfront_low, predicted_upfront_mid, predicted_upfront_high, predicted_total_low, predicted_total_mid, predicted_total_high, comp_count, comp_deal_ids, thesis_confidence')
    .gt('thesis_confidence', 0);

  const thesisMap = new Map<string, DealThesisData>();
  if (allTheses) {
    for (const t of allTheses) {
      thesisMap.set(t.asset_id, t as DealThesisData);
    }
  }

  for (const raw of acquirers) {
    if (Date.now() - startTime > MAX_RUNTIME_MS) { timedOut = true; break; }

    const acquirer: AcquirerProfile = {
      ...(raw as AcquirerProfile),
      modalities_active: raw.modalities_active || [],
      modalities_primary: raw.modalities_primary || [],
      indications_active: raw.indications_active || [],
      indications_specific: raw.indications_specific || [],
    };

    try {
      // Step 1: Identify portfolio gaps
      const gaps = await identifyPortfolioGaps(supabase, acquirer);
      if (gaps.length === 0) {
        acquirersAnalyzed++;
        continue;
      }

      const allDeals: ProposedDeal[] = [];

      // Step 2+3: For each gap, find matching assets and score
      for (const gap of gaps.slice(0, 5)) {
        if (Date.now() - startTime > MAX_RUNTIME_MS) { timedOut = true; break; }

        const candidates = await findMatchingAssets(supabase, gap, acquirer, stats);
        assetsConsidered += candidates.length;

        for (const asset of candidates) {
          const thesis = thesisMap.get(asset.id) || null;
          const deal = scoreOpportunity(acquirer, asset, gap, thesis);
          allDeals.push(deal);
        }
      }

      // Deduplicate by asset (keep highest scoring gap)
      const bestByAsset = new Map<string, ProposedDeal>();
      for (const deal of allDeals) {
        const existing = bestByAsset.get(deal.assetId);
        if (!existing || deal.opportunityScore > existing.opportunityScore) {
          bestByAsset.set(deal.assetId, deal);
        }
      }

      // Persist top opportunities for this acquirer
      const topDeals = Array.from(bestByAsset.values())
        .sort((a, b) => b.opportunityScore - a.opportunityScore)
        .slice(0, 20);

      const persisted = await persistOpportunities(supabase, topDeals, errors);
      opportunitiesCreated += persisted;
      acquirersAnalyzed++;
    } catch (err) {
      errors.push(`Acquirer error ${acquirer.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const status = deriveRunStatus({ errors: errors.length, timedOut, processed: acquirersAnalyzed, produced: opportunitiesCreated });
  const logWritten = await logRadarRun(supabase, {
    source: 'deal_creator',
    startedAt: startTime,
    status,
    fetched: acquirers.length,
    processed: acquirersAnalyzed,
    inserted: opportunitiesCreated,
    skipped: stats.excludedPartnered,
    failed: errors.length,
    errors,
    parameters: {
      assets_considered: assetsConsidered,
      assets_excluded_partnered: stats.excludedPartnered,
      theses_available: thesisMap.size,
      timed_out: timedOut,
    },
  });

  const duration = Math.round((Date.now() - startTime) / 1000);
  console.log(`[deal-creator] Done: ${acquirersAnalyzed} acquirers, ${assetsConsidered} assets considered (${stats.excludedPartnered} already partnered), ${opportunitiesCreated} opportunities created, ${errors.length} errors, ${duration}s${timedOut ? ' (timed out)' : ''}`);

  return { acquirersAnalyzed, assetsConsidered, opportunitiesCreated, assetsExcludedPartnered: stats.excludedPartnered, errors, timedOut, logWritten };
}
