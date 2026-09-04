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
 * "Based on 47 comparable transactions, Pfizer should license this
 *  Phase 2 ADC from Company X at $125-400M upfront with 6-15% royalties
 *  to fill their NSCLC patent cliff gap."
 *
 * No other platform can do this because no one else has:
 *   - The verified deal comp database
 *   - The clinical asset universe
 *   - The licensing signal scores
 *   - The competitive intelligence
 *   - The pharma intent model
 *
 * Run: daily at 11:30 AM UTC via /api/cron/deal-creator
 * Depends on: all prior layers running first
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// ═══════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════

interface AcquirerProfile {
  id: string;
  name: string;
  company_type: string | null;
  modalities_active: string[];
  modalities_primary: string[];
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
  targetIndications: string[];
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
  errors: string[];
  timedOut: boolean;
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

// ═══════════════════════════════════════════════════════════════════════
// PHASE SCORING
// ═══════════════════════════════════════════════════════════════════════

const PHASE_ORDER: Record<string, number> = {
  'discovery': 0, 'preclinical': 1,
  'early_phase1': 2, 'phase1': 3, 'phase_1': 3,
  'phase1_phase2': 4, 'phase_1_2': 4,
  'phase2': 5, 'phase_2': 5,
  'phase2_phase3': 6, 'phase_2_3': 6,
  'phase3': 7, 'phase_3': 7,
  'phase4': 8, 'phase_4': 8,
  'approved': 9,
};

function phaseToOrder(phase: string | null): number {
  if (!phase) return -1;
  return PHASE_ORDER[phase.toLowerCase().replace(/\s+/g, '').replace(/-/g, '_')] ?? -1;
}

// ═══════════════════════════════════════════════════════════════════════
// STEP 1: IDENTIFY PORTFOLIO GAPS
// ═══════════════════════════════════════════════════════════════════════

async function identifyPortfolioGaps(
  supabase: SupabaseClient,
  acquirer: AcquirerProfile,
): Promise<PortfolioGap[]> {
  const gaps: PortfolioGap[] = [];

  // Parse patent cliffs for revenue-at-risk TAs
  const patentCliffs = Array.isArray(acquirer.patent_cliffs) ? acquirer.patent_cliffs : [];
  const cliffTAs = new Set<string>();
  for (const cliff of patentCliffs) {
    if (typeof cliff === 'object' && cliff !== null && 'therapeutic_area' in cliff) {
      cliffTAs.add(String((cliff as Record<string, unknown>).therapeutic_area));
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
      targetIndications: Array.from(cliffTAs).length > 0 ? Array.from(cliffTAs) : acquirer.indications_active,
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
    const dealTAArr = Array.from(new Set(recentDeals.map(d => d.therapeutic_area).filter(Boolean)));
    const dealTAs = new Set(dealTAArr);
    const dealModalities = new Set(recentDeals.map(d => d.modality).filter(Boolean));

    // TAs they deal in but might need more
    for (const ta of dealTAArr) {
      if (!acquirer.indications_active.includes(ta)) {
        gaps.push({
          type: 'therapeutic_gap',
          detail: `Active deal history in ${ta} but not listed as active indication — potential expansion target`,
          urgency: 40,
          targetModalities: acquirer.modalities_active,
          targetIndications: [ta],
        });
      }
    }

    // Adjacent TAs they haven't entered yet
    for (const activeTA of acquirer.indications_active.slice(0, 5)) {
      const adjacentTAs = TA_ADJACENCY[activeTA] || [];
      for (const adjTA of adjacentTAs) {
        if (!acquirer.indications_active.includes(adjTA) && !dealTAs.has(adjTA)) {
          gaps.push({
            type: 'therapeutic_gap',
            detail: `Adjacent to ${activeTA} — ${adjTA} is a natural expansion area`,
            urgency: 25,
            targetModalities: acquirer.modalities_active,
            targetIndications: [adjTA],
          });
        }
      }
    }

    // Modality gaps — modalities adjacent to their primary that they haven't in-licensed
    for (const primaryMod of acquirer.modalities_primary.slice(0, 3)) {
      const adjacentMods = MODALITY_ADJACENCY[primaryMod] || [];
      for (const adjMod of adjacentMods) {
        if (!acquirer.modalities_active.includes(adjMod) && !dealModalities.has(adjMod)) {
          gaps.push({
            type: 'modality_gap',
            detail: `${adjMod} is adjacent to ${primaryMod} platform — natural modality expansion`,
            urgency: 30,
            targetModalities: [adjMod],
            targetIndications: acquirer.indications_active,
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
      if (order <= 3) phaseDistribution.early++;
      else if (order <= 5) phaseDistribution.mid++;
      else phaseDistribution.late++;
    }

    if (phaseDistribution.late === 0 && phaseDistribution.mid > 0) {
      gaps.push({
        type: 'pipeline_stage_gap',
        detail: `No late-stage (Phase 3+) assets — heavy mid-stage pipeline needs late-stage fill`,
        urgency: 55,
        targetModalities: acquirer.modalities_active,
        targetIndications: acquirer.indications_active,
      });
    }
    if (phaseDistribution.early === 0 && phaseDistribution.late > 0) {
      gaps.push({
        type: 'pipeline_stage_gap',
        detail: `No early-stage pipeline — needs Phase 1/2 assets for long-term pipeline depth`,
        urgency: 35,
        targetModalities: acquirer.modalities_active,
        targetIndications: acquirer.indications_active,
      });
    }
  }

  // Sort by urgency
  return gaps.sort((a, b) => b.urgency - a.urgency).slice(0, 10);
}

// ═══════════════════════════════════════════════════════════════════════
// STEP 2: FIND MATCHING UNPARTNERED ASSETS
// ═══════════════════════════════════════════════════════════════════════

async function findMatchingAssets(
  supabase: SupabaseClient,
  gap: PortfolioGap,
  acquirer: AcquirerProfile,
): Promise<CandidateAsset[]> {
  let query = supabase
    .from('clinical_assets')
    .select('id, company_id, company_name, asset_name, modality, therapeutic_area, indication_category, indication_specific, phase, partnership_status, licensing_intent_score, competitive_heat, deal_readiness_score, confidence_score')
    .in('partnership_status', ['unpartnered', 'partially_partnered'])
    .gte('confidence_score', 30)
    .gt('licensing_intent_score', 0)
    .neq('company_id', acquirer.id);

  // Filter by gap targets
  if (gap.targetIndications.length > 0 && gap.targetIndications.length <= 10) {
    query = query.in('indication_category', gap.targetIndications);
  }

  if (gap.targetModalities.length > 0 && gap.targetModalities.length <= 10) {
    query = query.in('modality', gap.targetModalities);
  }

  // Phase preference
  if (acquirer.phase_preference_min) {
    const minOrder = phaseToOrder(acquirer.phase_preference_min);
    if (minOrder >= 0) {
      // Can't filter by computed order in SQL, so we'll filter in JS
    }
  }

  const { data: assets } = await query
    .order('deal_readiness_score', { ascending: false })
    .limit(30);

  if (!assets) return [];

  // JS-level phase filtering
  let filtered = assets as CandidateAsset[];
  if (acquirer.phase_preference_min) {
    const minOrder = phaseToOrder(acquirer.phase_preference_min);
    if (minOrder >= 0) {
      filtered = filtered.filter(a => phaseToOrder(a.phase) >= minOrder);
    }
  }

  // Don't propose deals where the originator IS the acquirer
  filtered = filtered.filter(a => a.company_name !== acquirer.name);

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
  if (asset.modality && acquirer.modalities_primary.includes(asset.modality)) {
    strategicFit += 25;
    strategicDrivers.push(`Core modality fit: ${asset.modality} is a primary platform`);
  } else if (asset.modality && acquirer.modalities_active.includes(asset.modality)) {
    strategicFit += 15;
    strategicDrivers.push(`Active modality: ${acquirer.name} has ${asset.modality} capabilities`);
  } else if (asset.modality) {
    const adjacent = (MODALITY_ADJACENCY[asset.modality] || [])
      .some(m => acquirer.modalities_active.includes(m));
    if (adjacent) {
      strategicFit += 8;
      strategicDrivers.push(`Adjacent modality: ${asset.modality} is adjacent to existing platforms`);
    } else {
      riskFactors.push(`New modality: ${asset.modality} is not in current portfolio`);
    }
  }

  // Indication alignment
  if (asset.indication_category && acquirer.indications_active.includes(asset.indication_category)) {
    strategicFit += 20;
    strategicDrivers.push(`Active in ${asset.indication_category} — direct portfolio complement`);
  } else if (asset.therapeutic_area) {
    const adjacentTAs = TA_ADJACENCY[asset.therapeutic_area] || [];
    const overlapTA = adjacentTAs.some(ta => acquirer.indications_active.includes(ta));
    if (overlapTA) {
      strategicFit += 10;
      strategicDrivers.push(`${asset.therapeutic_area} is adjacent to active therapeutic areas`);
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
  if (phaseToOrder(asset.phase) <= 2) {
    riskFactors.push('Early-stage asset — high clinical risk, long timeline to value');
  }

  // ── Rationale ──────────────────────────────────────
  const rationaleLines = [
    `${acquirer.name} should ${gap.type === 'patent_cliff_replacement' ? 'urgently' : ''} license ${asset.asset_name} from ${asset.company_name}.`,
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

    if (!error) upserted++;
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
    return { acquirersAnalyzed: 0, assetsConsidered: 0, opportunitiesCreated: 0, errors: [acqError?.message || 'No acquirers found'], timedOut: false };
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

  for (const acquirer of acquirers) {
    if (Date.now() - startTime > MAX_RUNTIME_MS) { timedOut = true; break; }

    try {
      // Step 1: Identify portfolio gaps
      const gaps = await identifyPortfolioGaps(supabase, acquirer as AcquirerProfile);
      if (gaps.length === 0) {
        acquirersAnalyzed++;
        continue;
      }

      const allDeals: ProposedDeal[] = [];

      // Step 2+3: For each gap, find matching assets and score
      for (const gap of gaps.slice(0, 5)) {
        if (Date.now() - startTime > MAX_RUNTIME_MS) { timedOut = true; break; }

        const candidates = await findMatchingAssets(supabase, gap, acquirer as AcquirerProfile);
        assetsConsidered += candidates.length;

        for (const asset of candidates) {
          const thesis = thesisMap.get(asset.id) || null;
          const deal = scoreOpportunity(acquirer as AcquirerProfile, asset, gap, thesis);
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

      const persisted = await persistOpportunities(supabase, topDeals);
      opportunitiesCreated += persisted;
      acquirersAnalyzed++;
    } catch (err) {
      errors.push(`Acquirer error ${acquirer.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const duration = Math.round((Date.now() - startTime) / 1000);
  await supabase.from('data_ingestion_log').insert({
    source: 'deal_creator',
    status: errors.length > 0 ? 'partial' : 'success',
    records_processed: acquirersAnalyzed,
    records_inserted: opportunitiesCreated,
    records_updated: 0,
    duration_seconds: duration,
    error_details: errors.length > 0 ? errors.slice(0, 20) : null,
    metadata: {
      assets_considered: assetsConsidered,
      timed_out: timedOut,
    },
  });

  console.log(`[deal-creator] Done: ${acquirersAnalyzed} acquirers, ${assetsConsidered} assets considered, ${opportunitiesCreated} opportunities created, ${errors.length} errors, ${duration}s${timedOut ? ' (timed out)' : ''}`);

  return { acquirersAnalyzed, assetsConsidered, opportunitiesCreated, errors, timedOut };
}
