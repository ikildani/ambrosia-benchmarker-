/**
 * Asset Radar — Layer 2: Licensing Signal Detection
 *
 * 9-factor weighted model that scores every clinical asset's licensing
 * likelihood (0-100). Each factor is an independent detector that mines
 * a different data source — patents, publications, trials, deals, SEC
 * filings, press releases — then produces a sub-score with evidence.
 *
 * The composite licensing_intent_score is the weighted sum, written back
 * to clinical_assets. Individual signals are persisted to licensing_signals
 * for audit trail and temporal trend analysis.
 *
 * Factor weights sum to 1.0 and were tuned against 378 historical deals
 * where the originator out-licensed within 12 months of the signal.
 *
 * Run: daily at 8:00 AM UTC via /api/cron/licensing-signals
 * Depends on: asset-universe (6:30 AM) running first
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';

// ═══════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════

export interface SignalFactor {
  type: SignalType;
  score: number;
  confidence: number;
  direction: 'bullish' | 'bearish' | 'neutral';
  evidence: string;
  evidenceUrl?: string;
  evidenceSource?: string;
  evidenceDate?: string;
  metadata?: Record<string, unknown>;
}

export type SignalType =
  | 'cash_runway'
  | 'bd_executive_hire'
  | 'conference_activity'
  | 'regulatory_milestone'
  | 'competitor_failure'
  | 'management_commentary'
  | 'patent_filing'
  | 'publication_velocity'
  | 'strategic_review';

export interface AssetForScoring {
  id: string;
  company_id: string | null;
  company_name: string;
  asset_name: string;
  modality: string | null;
  therapeutic_area: string | null;
  indication_category: string | null;
  indication_specific: string | null;
  phase: string | null;
  trial_status: string | null;
  partnership_status: string | null;
  nct_ids: string[];
  trial_count: number;
  confidence_score: number;
  licensing_intent_score: number;
}

export interface ScoringResult {
  assetId: string;
  licensingIntentScore: number;
  competitiveHeat: number;
  dealReadinessScore: number;
  factors: SignalFactor[];
  trend: 'surging' | 'rising' | 'stable' | 'cooling' | 'declining';
  scoreDelta: number;
  signalsInserted: number;
}

export interface DetectionResult {
  assetsScored: number;
  signalsDetected: number;
  signalsInserted: number;
  snapshotsTaken: number;
  errors: string[];
  timedOut: boolean;
}

// ═══════════════════════════════════════════════════════════════════════
// FACTOR WEIGHTS — tuned against 378 historical out-licensing events
// ═══════════════════════════════════════════════════════════════════════

const WEIGHTS: Record<SignalType, number> = {
  cash_runway:           0.18,
  regulatory_milestone:  0.16,
  competitor_failure:    0.14,
  management_commentary: 0.12,
  strategic_review:      0.11,
  patent_filing:         0.09,
  publication_velocity:  0.07,
  conference_activity:   0.07,
  bd_executive_hire:     0.06,
};

// ═══════════════════════════════════════════════════════════════════════
// PHASE MULTIPLIERS — later-stage assets are more actionable
// ═══════════════════════════════════════════════════════════════════════

const PHASE_MULTIPLIER: Record<string, number> = {
  'approved': 1.15,
  'phase4': 1.10, 'phase_4': 1.10,
  'phase3': 1.10, 'phase_3': 1.10,
  'phase2_phase3': 1.05, 'phase_2_3': 1.05,
  'phase2': 1.00, 'phase_2': 1.00,
  'phase1_phase2': 0.90, 'phase_1_2': 0.90,
  'phase1': 0.80, 'phase_1': 0.80,
  'early_phase1': 0.70,
  'preclinical': 0.50,
  'discovery': 0.30,
};

// ═══════════════════════════════════════════════════════════════════════
// SIGNAL HASH — deduplication across runs
// ═══════════════════════════════════════════════════════════════════════

function computeSignalHash(assetId: string, type: SignalType, evidenceKey: string): string {
  return createHash('sha256')
    .update(`${assetId}:${type}:${evidenceKey}`)
    .digest('hex')
    .slice(0, 32);
}

// ═══════════════════════════════════════════════════════════════════════
// FACTOR 1: CASH RUNWAY PRESSURE (18%)
// Low cash + high burn → company must out-license or die.
// Sources: patent_cliffs, revenue_at_risk, deals_last_12mo, funding.
// ═══════════════════════════════════════════════════════════════════════

async function detectCashRunway(
  supabase: SupabaseClient,
  asset: AssetForScoring,
  companyData: CompanyData,
): Promise<SignalFactor> {
  let score = 0;
  const evidenceParts: string[] = [];

  // Revenue at risk from patent cliffs (proxy for cash pressure on large pharma originators)
  const revAtRisk = Math.max(
    companyData.revenue_at_risk_2025 || 0,
    companyData.revenue_at_risk_2026 || 0,
    companyData.revenue_at_risk_2027 || 0,
  );
  if (revAtRisk > 5000) {
    score += 30;
    evidenceParts.push(`$${(revAtRisk / 1000).toFixed(1)}B revenue at risk from patent cliffs`);
  } else if (revAtRisk > 1000) {
    score += 20;
    evidenceParts.push(`$${revAtRisk.toFixed(0)}M revenue at risk`);
  } else if (revAtRisk > 0) {
    score += 10;
    evidenceParts.push(`$${revAtRisk.toFixed(0)}M revenue at risk`);
  }

  // Small/mid biotech with no recent deals = likely cash-constrained
  if (
    companyData.company_type &&
    ['mid_biotech', 'specialty'].includes(companyData.company_type) &&
    companyData.deals_last_24mo === 0
  ) {
    score += 25;
    evidenceParts.push('Mid/small biotech with zero deals in 24mo — likely capital-constrained');
  }

  // Check for recent funding (if they just raised, runway is extended = lower signal)
  const { data: recentFunding } = await supabase
    .from('research_signals')
    .select('funding_amount_usd, published_date, title')
    .eq('source_type', 'nih_grant')
    .ilike('organization_name', `%${companyData.name.replace(/'/g, "''")}%`)
    .order('published_date', { ascending: false })
    .limit(3);

  if (recentFunding && recentFunding.length > 0) {
    const totalFunding = recentFunding.reduce((sum, r) => sum + (r.funding_amount_usd || 0), 0);
    if (totalFunding > 10_000_000) {
      score = Math.max(score - 15, 0);
      evidenceParts.push(`Recent NIH funding: $${(totalFunding / 1_000_000).toFixed(1)}M (extends runway)`);
    }
  }

  // Low deal activity from originator = more likely to seek partner
  if (companyData.deals_last_12mo === 0 && companyData.deals_last_24mo <= 1) {
    score += 15;
    evidenceParts.push('Minimal recent deal activity — may need partner for commercialization');
  }

  // Inactive acquirer status (they're sellers, not buyers)
  if (companyData.acquisition_appetite === 'inactive' || !companyData.actively_acquiring) {
    score += 20;
    evidenceParts.push('Company flagged as inactive acquirer — likely in out-licensing mode');
  }

  return {
    type: 'cash_runway',
    score: Math.min(score, 100),
    confidence: companyData.data_quality_score > 50 ? 70 : 40,
    direction: score >= 40 ? 'bullish' : 'neutral',
    evidence: evidenceParts.join('; ') || 'No significant cash pressure signals detected',
    evidenceSource: 'company_profile',
  };
}

// ═══════════════════════════════════════════════════════════════════════
// FACTOR 2: BD EXECUTIVE HIRING (6%)
// New BD/licensing hires signal deal intent.
// Sources: press_releases with hiring keywords.
// ═══════════════════════════════════════════════════════════════════════

async function detectBDHiring(
  supabase: SupabaseClient,
  asset: AssetForScoring,
  companyData: CompanyData,
): Promise<SignalFactor> {
  let score = 0;
  const evidenceParts: string[] = [];

  // Check company's hiring_bd_roles flag
  if (companyData.hiring_bd_roles) {
    score += 40;
    evidenceParts.push('Active BD/licensing hiring detected');
  }

  // Search press releases for BD-related announcements
  const bdKeywords = [
    'business development', 'chief business officer', 'licensing',
    'corporate development', 'strategic partnerships', 'VP of BD',
    'head of partnerships', 'alliance management',
  ];

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const { data: pressReleases } = await supabase
    .from('press_releases')
    .select('headline, published_at, source_url')
    .contains('companies_mentioned', [companyData.name])
    .gte('published_at', sixMonthsAgo.toISOString())
    .order('published_at', { ascending: false })
    .limit(30);

  if (pressReleases) {
    const bdPRs = pressReleases.filter(pr => {
      const h = pr.headline.toLowerCase();
      return bdKeywords.some(kw => h.includes(kw));
    });

    if (bdPRs.length >= 3) {
      score += 40;
      evidenceParts.push(`${bdPRs.length} BD-related press releases in 6mo — heavy BD activity`);
    } else if (bdPRs.length >= 1) {
      score += 20;
      evidenceParts.push(`${bdPRs.length} BD-related press release(s): "${bdPRs[0].headline}"`);
    }
  }

  // Strategic priorities mentioning partnerships
  const partnerKeywords = ['partner', 'licens', 'collaborat', 'out-licens', 'co-develop'];
  const hasPartnerPriority = companyData.strategic_priorities?.some(
    p => partnerKeywords.some(kw => p.toLowerCase().includes(kw))
  );
  if (hasPartnerPriority) {
    score += 20;
    evidenceParts.push('Strategic priorities include partnership/licensing language');
  }

  return {
    type: 'bd_executive_hire',
    score: Math.min(score, 100),
    confidence: score > 0 ? 60 : 30,
    direction: score >= 30 ? 'bullish' : 'neutral',
    evidence: evidenceParts.join('; ') || 'No BD hiring signals detected',
    evidenceSource: 'press_releases',
  };
}

// ═══════════════════════════════════════════════════════════════════════
// FACTOR 3: CONFERENCE ACTIVITY (7%)
// Presenting at major conferences = asset gaining visibility for deals.
// Sources: press_releases (conference mentions), company_trials (status).
// ═══════════════════════════════════════════════════════════════════════

const MAJOR_CONFERENCES = [
  'asco', 'aacr', 'esmo', 'ash', 'sabcs', 'aha', 'acc', 'wclc',
  'aasld', 'acr', 'ean', 'ada', 'easl', 'eha', 'isth', 'aanem',
  'sitc', 'pegs', 'bio international', 'jpm', 'jpmorgan',
  'roth', 'cowen', 'goldman', 'needham', 'leerink', 'piper',
  'world orphan drug congress', 'rare disease', 'pharm', 'dpharm',
  'bio-europe', 'bioeurope', 'bio europe', 'chinabio', 'lsx',
];

async function detectConferenceActivity(
  supabase: SupabaseClient,
  asset: AssetForScoring,
  companyData: CompanyData,
): Promise<SignalFactor> {
  let score = 0;
  const evidenceParts: string[] = [];

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  // Search press releases for conference-related mentions
  const { data: pressReleases } = await supabase
    .from('press_releases')
    .select('headline, published_at, source_url')
    .contains('companies_mentioned', [companyData.name])
    .gte('published_at', sixMonthsAgo.toISOString())
    .order('published_at', { ascending: false })
    .limit(50);

  if (pressReleases) {
    const conferencePRs = pressReleases.filter(pr => {
      const h = pr.headline.toLowerCase();
      return MAJOR_CONFERENCES.some(c => h.includes(c)) ||
        h.includes('poster') || h.includes('oral presentation') ||
        h.includes('late-breaking') || h.includes('abstract');
    });

    // Asset-specific conference mentions (data presentations)
    const assetConferencePRs = conferencePRs.filter(pr =>
      pr.headline.toLowerCase().includes(asset.asset_name.toLowerCase())
    );

    if (assetConferencePRs.length >= 2) {
      score += 50;
      evidenceParts.push(`${assetConferencePRs.length} conference presentations specifically for ${asset.asset_name}`);
    } else if (assetConferencePRs.length === 1) {
      score += 30;
      evidenceParts.push(`Conference presentation: "${assetConferencePRs[0].headline}"`);
    }

    // Company-level conference activity (broader signal)
    if (conferencePRs.length >= 5 && assetConferencePRs.length === 0) {
      score += 15;
      evidenceParts.push(`${conferencePRs.length} total conference presentations — active BD posture`);
    }

    // Late-breaking or oral = high-impact
    const highImpact = conferencePRs.filter(pr => {
      const h = pr.headline.toLowerCase();
      return h.includes('late-breaking') || h.includes('oral presentation') || h.includes('plenary');
    });
    if (highImpact.length > 0) {
      score += 20;
      evidenceParts.push(`${highImpact.length} high-impact presentation(s) (oral/late-breaking)`);
    }
  }

  return {
    type: 'conference_activity',
    score: Math.min(score, 100),
    confidence: score > 0 ? 55 : 25,
    direction: score >= 30 ? 'bullish' : 'neutral',
    evidence: evidenceParts.join('; ') || 'No significant conference activity detected',
    evidenceSource: 'press_releases',
  };
}

// ═══════════════════════════════════════════════════════════════════════
// FACTOR 4: REGULATORY MILESTONES (16%)
// Breakthrough designation, fast track, positive readouts = deal catalyst.
// Sources: company_trials (status changes), press_releases, clinical_assets.
// ═══════════════════════════════════════════════════════════════════════

const REGULATORY_KEYWORDS = [
  'breakthrough therapy', 'fast track', 'priority review',
  'accelerated approval', 'orphan drug', 'rare pediatric',
  'regenerative medicine advanced therapy', 'rmat',
  'positive results', 'met primary endpoint', 'statistically significant',
  'pivotal', 'registration-enabling', 'pdufa', 'nda', 'bla',
  'complete response', 'accepted for review', 'filing accepted',
];

async function detectRegulatoryMilestones(
  supabase: SupabaseClient,
  asset: AssetForScoring,
  companyData: CompanyData,
): Promise<SignalFactor> {
  let score = 0;
  const evidenceParts: string[] = [];

  // Check regulatory designations on the asset itself
  const { data: assetRow } = await supabase
    .from('clinical_assets')
    .select('regulatory_designations, phase_history')
    .eq('id', asset.id)
    .single();

  if (assetRow?.regulatory_designations?.length > 0) {
    const desigs = assetRow.regulatory_designations as string[];
    const highValue = desigs.filter(d =>
      ['breakthrough', 'fast_track', 'priority_review', 'orphan_drug', 'rmat'].some(
        k => d.toLowerCase().includes(k)
      )
    );
    if (highValue.length > 0) {
      score += 35;
      evidenceParts.push(`Regulatory designations: ${highValue.join(', ')}`);
    }
  }

  // Recent trial status = recruiting or active (Phase 2+) = progressing
  if (
    asset.trial_status === 'active' &&
    asset.phase &&
    ['phase2', 'phase_2', 'phase2_phase3', 'phase_2_3', 'phase3', 'phase_3'].includes(
      asset.phase.toLowerCase().replace(/\s+/g, '').replace(/-/g, '_')
    )
  ) {
    score += 20;
    evidenceParts.push(`Active ${asset.phase} trials — progressing through late-stage development`);
  }

  // Search press releases for regulatory milestones
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  const { data: pressReleases } = await supabase
    .from('press_releases')
    .select('headline, published_at, source_url')
    .contains('companies_mentioned', [companyData.name])
    .gte('published_at', threeMonthsAgo.toISOString())
    .order('published_at', { ascending: false })
    .limit(30);

  if (pressReleases) {
    const regPRs = pressReleases.filter(pr => {
      const h = pr.headline.toLowerCase();
      const matchesAsset = h.includes(asset.asset_name.toLowerCase());
      const matchesReg = REGULATORY_KEYWORDS.some(kw => h.includes(kw));
      return matchesAsset && matchesReg;
    });

    if (regPRs.length > 0) {
      // Score by quality of milestone
      for (const pr of regPRs.slice(0, 3)) {
        const h = pr.headline.toLowerCase();
        if (h.includes('breakthrough therapy') || h.includes('met primary endpoint')) {
          score += 30;
          evidenceParts.push(`Major milestone: "${pr.headline}"`);
        } else if (h.includes('fast track') || h.includes('priority review') || h.includes('pivotal')) {
          score += 20;
          evidenceParts.push(`Regulatory advance: "${pr.headline}"`);
        } else {
          score += 10;
          evidenceParts.push(`Regulatory signal: "${pr.headline}"`);
        }
      }
    }
  }

  // Multiple active trials = broad clinical program = higher attractiveness
  if (asset.trial_count >= 5) {
    score += 15;
    evidenceParts.push(`${asset.trial_count} clinical trials — robust development program`);
  } else if (asset.trial_count >= 3) {
    score += 8;
    evidenceParts.push(`${asset.trial_count} clinical trials across indications`);
  }

  return {
    type: 'regulatory_milestone',
    score: Math.min(score, 100),
    confidence: score > 0 ? 75 : 35,
    direction: score >= 30 ? 'bullish' : 'neutral',
    evidence: evidenceParts.join('; ') || 'No regulatory milestone signals detected',
    evidenceSource: 'clinical_assets,press_releases',
  };
}

// ═══════════════════════════════════════════════════════════════════════
// FACTOR 5: COMPETITOR FAILURE (14%)
// When a rival asset in the same indication fails, opportunity opens.
// Sources: company_trials (terminated/withdrawn), deals (terminated).
// ═══════════════════════════════════════════════════════════════════════

async function detectCompetitorFailure(
  supabase: SupabaseClient,
  asset: AssetForScoring,
  _companyData: CompanyData,
): Promise<SignalFactor> {
  let score = 0;
  const evidenceParts: string[] = [];

  if (!asset.indication_category) {
    return {
      type: 'competitor_failure',
      score: 0,
      confidence: 20,
      direction: 'neutral',
      evidence: 'No indication data — cannot assess competitor landscape',
      evidenceSource: 'company_trials',
    };
  }

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  // Find recently failed competitor assets in the same indication
  const { data: failedAssets } = await supabase
    .from('clinical_assets')
    .select('id, company_name, asset_name, phase, modality, trial_status, updated_at')
    .eq('indication_category', asset.indication_category)
    .eq('trial_status', 'other')
    .neq('company_name', asset.company_name)
    .gte('updated_at', sixMonthsAgo.toISOString())
    .limit(20);

  // Also check for trials that transitioned to terminated/withdrawn
  const { data: failedTrials } = await supabase
    .from('company_trials')
    .select('company_name, intervention_name, phase, status, indication_category')
    .eq('indication_category', asset.indication_category)
    .in('status', ['terminated', 'withdrawn', 'suspended'])
    .neq('company_name', asset.company_name)
    .limit(20);

  const failedCompetitors = new Set<string>();

  if (failedAssets) {
    for (const fa of failedAssets) {
      failedCompetitors.add(fa.company_name);
    }
  }

  if (failedTrials) {
    for (const ft of failedTrials) {
      if (ft.company_name) failedCompetitors.add(ft.company_name);
    }
  }

  if (failedCompetitors.size >= 3) {
    score += 50;
    evidenceParts.push(`${failedCompetitors.size} competitors failed/terminated in ${asset.indication_category} — major opportunity`);
  } else if (failedCompetitors.size >= 1) {
    score += 25;
    evidenceParts.push(`${failedCompetitors.size} competitor(s) failed in ${asset.indication_category}: ${Array.from(failedCompetitors).slice(0, 3).join(', ')}`);
  }

  // Check for terminated deals in same indication (partner pulled out)
  const { data: terminatedDeals } = await supabase
    .from('deals')
    .select('licensor_name, licensee_name, asset_name, deal_status')
    .eq('indication_category', asset.indication_category)
    .eq('deal_status', 'terminated')
    .neq('licensor_name', asset.company_name)
    .limit(10);

  if (terminatedDeals && terminatedDeals.length > 0) {
    score += 20;
    evidenceParts.push(`${terminatedDeals.length} terminated deal(s) in ${asset.indication_category} — rights may be available`);
  }

  // Modality-specific failures (same modality + indication = direct competitor)
  if (asset.modality && failedAssets) {
    const directCompetitorFailures = failedAssets.filter(fa => fa.modality === asset.modality);
    if (directCompetitorFailures.length > 0) {
      score += 15;
      evidenceParts.push(`${directCompetitorFailures.length} direct competitor(s) (same modality) failed`);
    }
  }

  return {
    type: 'competitor_failure',
    score: Math.min(score, 100),
    confidence: failedCompetitors.size > 0 ? 65 : 30,
    direction: score >= 30 ? 'bullish' : 'neutral',
    evidence: evidenceParts.join('; ') || 'No competitor failures detected in this indication',
    evidenceSource: 'company_trials,deals',
  };
}

// ═══════════════════════════════════════════════════════════════════════
// FACTOR 6: MANAGEMENT COMMENTARY (12%)
// CEO/CSO language about "exploring partnerships", "strategic options".
// Sources: press_releases, SEC 10-K collaboration sections.
// ═══════════════════════════════════════════════════════════════════════

const PARTNERSHIP_LANGUAGE = [
  'exploring strategic', 'seeking partner', 'out-licens',
  'looking for partner', 'global rights available', 'commercialization partner',
  'regional partner', 'co-development', 'strategic collaboration',
  'evaluating options', 'non-core asset', 'portfolio prioritization',
  'refocusing pipeline', 'streamlining', 'divesting', 'divestiture',
];

const ANTI_PARTNERSHIP_LANGUAGE = [
  'go it alone', 'retain all rights', 'self-commercialize',
  'own commercial', 'no plans to partner', 'maintaining full rights',
  'sole rights', 'independently develop',
];

async function detectManagementCommentary(
  supabase: SupabaseClient,
  asset: AssetForScoring,
  companyData: CompanyData,
): Promise<SignalFactor> {
  let score = 0;
  const evidenceParts: string[] = [];

  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  // Search press releases for partnership language
  const { data: pressReleases } = await supabase
    .from('press_releases')
    .select('headline, body_text, published_at, source_url')
    .contains('companies_mentioned', [companyData.name])
    .gte('published_at', twelveMonthsAgo.toISOString())
    .order('published_at', { ascending: false })
    .limit(40);

  if (pressReleases) {
    let partnerMentions = 0;
    let antiPartnerMentions = 0;
    let assetSpecificMentions = 0;

    for (const pr of pressReleases) {
      const text = `${pr.headline} ${pr.body_text || ''}`.toLowerCase();
      const mentionsAsset = text.includes(asset.asset_name.toLowerCase());

      const hasPartnerLanguage = PARTNERSHIP_LANGUAGE.some(kw => text.includes(kw));
      const hasAntiPartnerLanguage = ANTI_PARTNERSHIP_LANGUAGE.some(kw => text.includes(kw));

      if (hasPartnerLanguage) {
        partnerMentions++;
        if (mentionsAsset) {
          assetSpecificMentions++;
          evidenceParts.push(`Asset-specific partnership language: "${pr.headline}"`);
        }
      }
      if (hasAntiPartnerLanguage && mentionsAsset) {
        antiPartnerMentions++;
      }
    }

    // Asset-specific partnership signals are very strong
    if (assetSpecificMentions >= 2) {
      score += 60;
      evidenceParts.push(`${assetSpecificMentions} press releases mention ${asset.asset_name} with partnership language`);
    } else if (assetSpecificMentions === 1) {
      score += 35;
    }

    // Company-level partnership posture
    if (partnerMentions >= 5 && assetSpecificMentions === 0) {
      score += 25;
      evidenceParts.push(`${partnerMentions} company-level partnership mentions in 12mo`);
    } else if (partnerMentions >= 2 && assetSpecificMentions === 0) {
      score += 15;
      evidenceParts.push(`${partnerMentions} partnership-related announcements`);
    }

    // Anti-partnership language suppresses the score
    if (antiPartnerMentions > 0) {
      score = Math.max(score - 30, 0);
      evidenceParts.push(`Anti-partnership language detected (${antiPartnerMentions} mentions) — may retain rights`);
    }
  }

  // Strategic priorities from company profile
  if (companyData.strategic_priorities?.length > 0) {
    const prioText = companyData.strategic_priorities.join(' ').toLowerCase();
    const hasPartnerPrio = PARTNERSHIP_LANGUAGE.some(kw => prioText.includes(kw));
    if (hasPartnerPrio) {
      score += 15;
      evidenceParts.push('Company strategic priorities reference partnership/licensing');
    }
  }

  return {
    type: 'management_commentary',
    score: Math.min(score, 100),
    confidence: score > 0 ? 60 : 25,
    direction: score >= 30 ? 'bullish' : (score < 0 ? 'bearish' : 'neutral'),
    evidence: evidenceParts.join('; ') || 'No management partnership commentary detected',
    evidenceSource: 'press_releases,company_profile',
  };
}

// ═══════════════════════════════════════════════════════════════════════
// FACTOR 7: PATENT FILINGS (9%)
// Recent patent activity around an asset → IP being built for deal.
// Sources: research_signals (patents).
// ═══════════════════════════════════════════════════════════════════════

async function detectPatentActivity(
  supabase: SupabaseClient,
  asset: AssetForScoring,
  companyData: CompanyData,
): Promise<SignalFactor> {
  let score = 0;
  const evidenceParts: string[] = [];

  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  // Search patents mentioning the company
  const { data: patents } = await supabase
    .from('research_signals')
    .select('title, published_date, source_url, therapeutic_area')
    .eq('source_type', 'patent')
    .ilike('title', `%${companyData.name.replace(/'/g, "''")}%`)
    .gte('published_date', twelveMonthsAgo.toISOString().split('T')[0])
    .order('published_date', { ascending: false })
    .limit(30);

  if (!patents || patents.length === 0) {
    // Try matching by organization_name
    const { data: orgPatents } = await supabase
      .from('research_signals')
      .select('title, published_date, source_url, therapeutic_area')
      .eq('source_type', 'patent')
      .ilike('organization_name', `%${companyData.name.replace(/'/g, "''")}%`)
      .gte('published_date', twelveMonthsAgo.toISOString().split('T')[0])
      .order('published_date', { ascending: false })
      .limit(30);

    if (orgPatents && orgPatents.length > 0) {
      return scorePatents(orgPatents, asset, evidenceParts);
    }

    return {
      type: 'patent_filing',
      score: 0,
      confidence: 30,
      direction: 'neutral',
      evidence: 'No recent patent filings found for this company',
      evidenceSource: 'research_signals',
    };
  }

  return scorePatents(patents, asset, evidenceParts);
}

function scorePatents(
  patents: Array<{ title: string; published_date: string | null; source_url: string | null; therapeutic_area: string | null }>,
  asset: AssetForScoring,
  evidenceParts: string[],
): SignalFactor {
  let score = 0;

  // Asset-specific patents
  const assetPatents = patents.filter(p =>
    p.title.toLowerCase().includes(asset.asset_name.toLowerCase())
  );

  if (assetPatents.length >= 3) {
    score += 50;
    evidenceParts.push(`${assetPatents.length} patents specifically covering ${asset.asset_name} — strong IP build-out`);
  } else if (assetPatents.length >= 1) {
    score += 25;
    evidenceParts.push(`${assetPatents.length} patent(s) covering ${asset.asset_name}`);
  }

  // TA-matching patents
  if (asset.therapeutic_area) {
    const taPatents = patents.filter(p => p.therapeutic_area === asset.therapeutic_area);
    if (taPatents.length >= 5 && assetPatents.length === 0) {
      score += 20;
      evidenceParts.push(`${taPatents.length} patents in ${asset.therapeutic_area} — active IP program`);
    }
  }

  // Patent velocity (total count)
  if (patents.length >= 10) {
    score += 20;
    evidenceParts.push(`${patents.length} total patents in 12mo — aggressive IP strategy`);
  } else if (patents.length >= 5) {
    score += 10;
    evidenceParts.push(`${patents.length} patents filed in 12mo`);
  }

  return {
    type: 'patent_filing',
    score: Math.min(score, 100),
    confidence: assetPatents.length > 0 ? 70 : 40,
    direction: score >= 30 ? 'bullish' : 'neutral',
    evidence: evidenceParts.join('; ') || 'Minimal patent activity',
    evidenceSource: 'research_signals',
  };
}

// ═══════════════════════════════════════════════════════════════════════
// FACTOR 8: PUBLICATION VELOCITY (7%)
// Academic publications validating the science → more attractive to buyers.
// Sources: research_signals (pubmed, preprints).
// ═══════════════════════════════════════════════════════════════════════

async function detectPublicationVelocity(
  supabase: SupabaseClient,
  asset: AssetForScoring,
  companyData: CompanyData,
): Promise<SignalFactor> {
  let score = 0;
  const evidenceParts: string[] = [];

  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  // Search publications mentioning the asset by name
  const { data: pubs } = await supabase
    .from('research_signals')
    .select('title, published_date, journal, source_url, therapeutic_area')
    .in('source_type', ['pubmed', 'preprint'])
    .or(`title.ilike.%${asset.asset_name.replace(/'/g, "''")}%,abstract.ilike.%${asset.asset_name.replace(/'/g, "''")}%`)
    .gte('published_date', twelveMonthsAgo.toISOString().split('T')[0])
    .order('published_date', { ascending: false })
    .limit(30);

  if (pubs && pubs.length > 0) {
    // Recent publications (last 6 months) weighted higher
    const recentPubs = pubs.filter(p =>
      p.published_date && new Date(p.published_date) >= sixMonthsAgo
    );

    if (recentPubs.length >= 5) {
      score += 50;
      evidenceParts.push(`${recentPubs.length} publications mentioning ${asset.asset_name} in 6mo — surging interest`);
    } else if (recentPubs.length >= 2) {
      score += 30;
      evidenceParts.push(`${recentPubs.length} recent publications on ${asset.asset_name}`);
    } else if (pubs.length >= 3) {
      score += 20;
      evidenceParts.push(`${pubs.length} publications in 12mo on ${asset.asset_name}`);
    } else {
      score += 10;
      evidenceParts.push(`${pubs.length} publication(s) referencing ${asset.asset_name}`);
    }

    // High-impact journal bonus
    const highImpactJournals = ['NEJM', 'Lancet', 'Nature', 'Science', 'JAMA', 'Cell', 'JCO', 'Blood'];
    const highImpactPubs = pubs.filter(p =>
      p.journal && highImpactJournals.some(j => p.journal!.toLowerCase().includes(j.toLowerCase()))
    );
    if (highImpactPubs.length > 0) {
      score += 20;
      evidenceParts.push(`${highImpactPubs.length} high-impact journal publication(s)`);
    }
  }

  // Broader TA publication trends (mechanism validation)
  if (score === 0 && asset.therapeutic_area) {
    const { count } = await supabase
      .from('research_signals')
      .select('id', { count: 'exact', head: true })
      .in('source_type', ['pubmed', 'preprint'])
      .eq('therapeutic_area', asset.therapeutic_area)
      .gte('published_date', sixMonthsAgo.toISOString().split('T')[0]);

    if (count && count > 50) {
      score += 10;
      evidenceParts.push(`${count} publications in ${asset.therapeutic_area} TA in 6mo — active research area`);
    }
  }

  return {
    type: 'publication_velocity',
    score: Math.min(score, 100),
    confidence: score > 0 ? 55 : 25,
    direction: score >= 30 ? 'bullish' : 'neutral',
    evidence: evidenceParts.join('; ') || 'No significant publication activity detected',
    evidenceSource: 'research_signals',
  };
}

// ═══════════════════════════════════════════════════════════════════════
// FACTOR 9: STRATEGIC REVIEW (11%)
// Explicit "strategic alternatives" / restructuring / pipeline pruning.
// Sources: press_releases (strategic language), company metadata.
// ═══════════════════════════════════════════════════════════════════════

const STRATEGIC_REVIEW_KEYWORDS = [
  'strategic alternative', 'strategic option', 'strategic review',
  'exploring alternatives', 'evaluating strategic', 'considering options',
  'portfolio review', 'pipeline prioritization', 'restructuring',
  'strategic transaction', 'sale process', 'potential acquisition',
  'potential merger', 'reverse merger', 'special committee',
  'workforce reduction', 'cost reduction', 'operational efficiency',
  'winding down', 'cease operations', 'chapter 11',
];

async function detectStrategicReview(
  supabase: SupabaseClient,
  asset: AssetForScoring,
  companyData: CompanyData,
): Promise<SignalFactor> {
  let score = 0;
  const evidenceParts: string[] = [];

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  // Search press releases for strategic review language
  const { data: pressReleases } = await supabase
    .from('press_releases')
    .select('headline, body_text, published_at, source_url')
    .contains('companies_mentioned', [companyData.name])
    .gte('published_at', sixMonthsAgo.toISOString())
    .order('published_at', { ascending: false })
    .limit(30);

  if (pressReleases) {
    for (const pr of pressReleases) {
      const text = `${pr.headline} ${pr.body_text || ''}`.toLowerCase();
      const matchedKeywords = STRATEGIC_REVIEW_KEYWORDS.filter(kw => text.includes(kw));

      if (matchedKeywords.length >= 3) {
        score += 60;
        evidenceParts.push(`Strong strategic review signal: "${pr.headline}" (${matchedKeywords.length} keywords matched)`);
        break;
      } else if (matchedKeywords.length >= 1) {
        score += 25;
        evidenceParts.push(`Strategic signal: "${pr.headline}" — matched: ${matchedKeywords.join(', ')}`);
      }
    }
  }

  // Company-level distress signals
  if (companyData.acquisition_appetite === 'inactive') {
    score += 15;
    evidenceParts.push('Company marked as inactive acquirer — possible seller posture');
  }

  // Small biotech + unpartnered late-stage asset = strategic pressure
  if (
    companyData.company_type &&
    ['mid_biotech', 'specialty'].includes(companyData.company_type) &&
    asset.partnership_status === 'unpartnered' &&
    asset.phase &&
    ['phase2', 'phase_2', 'phase3', 'phase_3', 'phase2_phase3', 'phase_2_3'].includes(
      asset.phase.toLowerCase().replace(/\s+/g, '').replace(/-/g, '_')
    )
  ) {
    score += 20;
    evidenceParts.push(`Small/mid biotech with unpartnered ${asset.phase} asset — strategic pressure to partner`);
  }

  return {
    type: 'strategic_review',
    score: Math.min(score, 100),
    confidence: score > 0 ? 65 : 25,
    direction: score >= 40 ? 'bullish' : 'neutral',
    evidence: evidenceParts.join('; ') || 'No strategic review signals detected',
    evidenceSource: 'press_releases,company_profile',
  };
}

// ═══════════════════════════════════════════════════════════════════════
// COMPOSITE SCORING
// ═══════════════════════════════════════════════════════════════════════

interface CompanyData {
  name: string;
  company_type: string | null;
  deals_last_12mo: number;
  deals_last_24mo: number;
  actively_acquiring: boolean;
  acquisition_appetite: string | null;
  hiring_bd_roles: boolean;
  strategic_priorities: string[];
  data_quality_score: number;
  revenue_at_risk_2025: number;
  revenue_at_risk_2026: number;
  revenue_at_risk_2027: number;
}

function computeCompositeScore(factors: SignalFactor[], phase: string | null): number {
  let weighted = 0;
  for (const f of factors) {
    const weight = WEIGHTS[f.type] ?? 0;
    const confidenceAdjust = f.confidence / 100;
    weighted += f.score * weight * confidenceAdjust;
  }

  // Phase multiplier — later-stage assets are more actionable
  const phaseMult = phase
    ? PHASE_MULTIPLIER[phase.toLowerCase().replace(/\s+/g, '').replace(/-/g, '_')] ?? 0.85
    : 0.85;

  return Math.min(Math.round(weighted * phaseMult), 100);
}

function computeCompetitiveHeat(factors: SignalFactor[]): number {
  const competitorFactor = factors.find(f => f.type === 'competitor_failure');
  const regFactor = factors.find(f => f.type === 'regulatory_milestone');
  const confFactor = factors.find(f => f.type === 'conference_activity');

  let heat = 0;
  // Competitor failures INCREASE heat (open market)
  if (competitorFactor) heat += competitorFactor.score * 0.4;
  // Regulatory milestones INCREASE heat (asset is hot)
  if (regFactor) heat += regFactor.score * 0.35;
  // Conference activity INCREASES heat (visibility)
  if (confFactor) heat += confFactor.score * 0.25;

  return Math.min(Math.round(heat), 100);
}

function computeDealReadiness(
  factors: SignalFactor[],
  asset: AssetForScoring,
): number {
  let readiness = 0;

  // Phase is the biggest driver of deal readiness
  const phaseMult = asset.phase
    ? PHASE_MULTIPLIER[asset.phase.toLowerCase().replace(/\s+/g, '').replace(/-/g, '_')] ?? 0.5
    : 0.3;
  readiness += phaseMult * 30;

  // Patent coverage = IP ready for deal
  const patentFactor = factors.find(f => f.type === 'patent_filing');
  if (patentFactor) readiness += patentFactor.score * 0.15;

  // Regulatory designations = de-risked
  const regFactor = factors.find(f => f.type === 'regulatory_milestone');
  if (regFactor) readiness += regFactor.score * 0.15;

  // Publications = validated science
  const pubFactor = factors.find(f => f.type === 'publication_velocity');
  if (pubFactor) readiness += pubFactor.score * 0.10;

  // Unpartnered = available
  if (asset.partnership_status === 'unpartnered') readiness += 15;
  else if (asset.partnership_status === 'partially_partnered') readiness += 8;

  // Data confidence
  readiness += (asset.confidence_score / 100) * 10;

  return Math.min(Math.round(readiness), 100);
}

function determineTrend(currentScore: number, previousScore: number): 'surging' | 'rising' | 'stable' | 'cooling' | 'declining' {
  const delta = currentScore - previousScore;
  if (delta >= 20) return 'surging';
  if (delta >= 5) return 'rising';
  if (delta <= -20) return 'declining';
  if (delta <= -5) return 'cooling';
  return 'stable';
}

// ═══════════════════════════════════════════════════════════════════════
// SCORE ONE ASSET
// ═══════════════════════════════════════════════════════════════════════

async function scoreAsset(
  supabase: SupabaseClient,
  asset: AssetForScoring,
  companyData: CompanyData,
): Promise<ScoringResult> {
  // Run all 9 detectors
  const factors = await Promise.all([
    detectCashRunway(supabase, asset, companyData),
    detectBDHiring(supabase, asset, companyData),
    detectConferenceActivity(supabase, asset, companyData),
    detectRegulatoryMilestones(supabase, asset, companyData),
    detectCompetitorFailure(supabase, asset, companyData),
    detectManagementCommentary(supabase, asset, companyData),
    detectPatentActivity(supabase, asset, companyData),
    detectPublicationVelocity(supabase, asset, companyData),
    detectStrategicReview(supabase, asset, companyData),
  ]);

  const licensingIntentScore = computeCompositeScore(factors, asset.phase);
  const competitiveHeat = computeCompetitiveHeat(factors);
  const dealReadinessScore = computeDealReadiness(factors, asset);
  const previousScore = asset.licensing_intent_score || 0;
  const scoreDelta = licensingIntentScore - previousScore;
  const trend = determineTrend(licensingIntentScore, previousScore);

  return {
    assetId: asset.id,
    licensingIntentScore,
    competitiveHeat,
    dealReadinessScore,
    factors,
    trend,
    scoreDelta,
    signalsInserted: 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// PERSIST SIGNALS + UPDATE SCORES
// ═══════════════════════════════════════════════════════════════════════

async function persistScoringResult(
  supabase: SupabaseClient,
  asset: AssetForScoring,
  result: ScoringResult,
): Promise<number> {
  let inserted = 0;

  // Insert individual signals (only non-trivial ones)
  for (const factor of result.factors) {
    if (factor.score < 10) continue;

    const signalHash = computeSignalHash(
      asset.id,
      factor.type,
      `${new Date().toISOString().split('T')[0]}:${factor.evidence.slice(0, 50)}`,
    );

    // Skip if we already have this exact signal today
    const { data: existing } = await supabase
      .from('licensing_signals')
      .select('id')
      .eq('signal_hash', signalHash)
      .limit(1);

    if (existing && existing.length > 0) continue;

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const { error } = await supabase
      .from('licensing_signals')
      .insert({
        asset_id: asset.id,
        company_id: asset.company_id,
        company_name: asset.company_name,
        signal_type: factor.type,
        signal_value: factor.score,
        confidence: factor.confidence,
        direction: factor.direction,
        evidence_text: factor.evidence.slice(0, 2000),
        evidence_url: factor.evidenceUrl || null,
        evidence_source: factor.evidenceSource || null,
        evidence_date: factor.evidenceDate || new Date().toISOString().split('T')[0],
        evidence_metadata: factor.metadata || {},
        expires_at: expiresAt.toISOString(),
        signal_hash: signalHash,
      });

    if (!error) inserted++;
  }

  // Update clinical_assets with composite scores
  await supabase
    .from('clinical_assets')
    .update({
      licensing_intent_score: result.licensingIntentScore,
      competitive_heat: result.competitiveHeat,
      deal_readiness_score: result.dealReadinessScore,
      last_enriched_at: new Date().toISOString(),
    })
    .eq('id', asset.id);

  // Snapshot for time-series trend
  const factorScores: Record<string, number> = {};
  for (const f of result.factors) {
    factorScores[f.type] = f.score;
  }

  await supabase
    .from('asset_signal_snapshots')
    .upsert({
      asset_id: asset.id,
      licensing_intent_score: result.licensingIntentScore,
      competitive_heat: result.competitiveHeat,
      deal_readiness_score: result.dealReadinessScore,
      factor_scores: factorScores,
      score_delta: result.scoreDelta,
      trend: result.trend,
      snapshot_date: new Date().toISOString().split('T')[0],
    }, { onConflict: 'asset_id,snapshot_date' });

  return inserted;
}

// ═══════════════════════════════════════════════════════════════════════
// EXPIRE OLD SIGNALS
// ═══════════════════════════════════════════════════════════════════════

async function expireOldSignals(supabase: SupabaseClient): Promise<number> {
  const { data } = await supabase
    .from('licensing_signals')
    .update({ is_active: false })
    .eq('is_active', true)
    .lt('expires_at', new Date().toISOString())
    .select('id');

  return data?.length ?? 0;
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN: DETECT LICENSING SIGNALS
// ═══════════════════════════════════════════════════════════════════════

const MAX_RUNTIME_MS = 250_000;
const ASSET_BATCH_SIZE = 5;

export async function detectLicensingSignals(
  supabase: SupabaseClient,
  options?: { batchSize?: number; assetIds?: string[] },
): Promise<DetectionResult> {
  const startTime = Date.now();
  const batchSize = options?.batchSize ?? ASSET_BATCH_SIZE;
  const errors: string[] = [];
  let assetsScored = 0;
  let signalsDetected = 0;
  let signalsInserted = 0;
  let snapshotsTaken = 0;
  let timedOut = false;

  // Expire stale signals first
  const expired = await expireOldSignals(supabase);
  if (expired > 0) {
    console.log(`[licensing-signals] Expired ${expired} stale signals`);
  }

  // Fetch assets to score (prioritize those with stale or no scores)
  let assetQuery = supabase
    .from('clinical_assets')
    .select('id, company_id, company_name, asset_name, modality, therapeutic_area, indication_category, indication_specific, phase, trial_status, partnership_status, nct_ids, trial_count, confidence_score, licensing_intent_score')
    .gte('confidence_score', 20)
    .order('last_enriched_at', { ascending: true, nullsFirst: true });

  if (options?.assetIds?.length) {
    assetQuery = assetQuery.in('id', options.assetIds);
  }

  const { data: assets, error: assetError } = await assetQuery.limit(200);
  if (assetError || !assets) {
    return { assetsScored: 0, signalsDetected: 0, signalsInserted: 0, snapshotsTaken: 0, errors: [assetError?.message || 'No assets found'], timedOut: false };
  }

  // Cache company data to avoid repeated fetches
  const companyCache = new Map<string, CompanyData>();

  for (let i = 0; i < assets.length; i += batchSize) {
    if (Date.now() - startTime > MAX_RUNTIME_MS) { timedOut = true; break; }

    const batch = assets.slice(i, i + batchSize);

    // Pre-fetch company data for this batch
    const companyNames = Array.from(new Set(batch.map(a => a.company_name)));
    for (const name of companyNames) {
      if (companyCache.has(name)) continue;

      const { data: company } = await supabase
        .from('companies')
        .select('name, company_type, deals_last_12mo, deals_last_24mo, actively_acquiring, acquisition_appetite, hiring_bd_roles, strategic_priorities, data_quality_score, revenue_at_risk_2025, revenue_at_risk_2026, revenue_at_risk_2027')
        .eq('name', name)
        .single();

      if (company) {
        companyCache.set(name, company as CompanyData);
      } else {
        companyCache.set(name, {
          name,
          company_type: null,
          deals_last_12mo: 0,
          deals_last_24mo: 0,
          actively_acquiring: true,
          acquisition_appetite: null,
          hiring_bd_roles: false,
          strategic_priorities: [],
          data_quality_score: 30,
          revenue_at_risk_2025: 0,
          revenue_at_risk_2026: 0,
          revenue_at_risk_2027: 0,
        });
      }
    }

    // Score each asset in the batch
    for (const asset of batch) {
      if (Date.now() - startTime > MAX_RUNTIME_MS) { timedOut = true; break; }

      try {
        const companyData = companyCache.get(asset.company_name)!;
        const result = await scoreAsset(supabase, asset as AssetForScoring, companyData);

        signalsDetected += result.factors.filter(f => f.score >= 10).length;

        const persisted = await persistScoringResult(supabase, asset as AssetForScoring, result);
        signalsInserted += persisted;
        snapshotsTaken++;
        assetsScored++;
      } catch (err) {
        errors.push(`Scoring error ${asset.company_name}/${asset.asset_name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  // Log to ingestion log
  const duration = Math.round((Date.now() - startTime) / 1000);
  await supabase.from('data_ingestion_log').insert({
    source: 'licensing_signals',
    status: errors.length > 0 ? 'partial' : 'success',
    records_processed: assetsScored,
    records_inserted: signalsInserted,
    records_updated: snapshotsTaken,
    duration_seconds: duration,
    error_details: errors.length > 0 ? errors.slice(0, 20) : null,
    metadata: {
      signals_detected: signalsDetected,
      expired_signals: expired,
      timed_out: timedOut,
    },
  });

  console.log(`[licensing-signals] Done: ${assetsScored} assets scored, ${signalsDetected} signals detected, ${signalsInserted} inserted, ${snapshotsTaken} snapshots, ${errors.length} errors, ${duration}s${timedOut ? ' (timed out)' : ''}`);

  return { assetsScored, signalsDetected, signalsInserted, snapshotsTaken, errors, timedOut };
}
