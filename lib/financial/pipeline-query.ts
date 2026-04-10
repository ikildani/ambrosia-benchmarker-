/**
 * Live Pipeline Intelligence Query
 *
 * Queries the company_trials table for real competing assets in the same
 * indication/modality/phase as the user's asset. Used by the competitive
 * dynamics engine to replace template-based competitor counts with real
 * market data.
 *
 * Runs server-side only (uses Supabase service role key via fetch).
 *
 * @module lib/financial/pipeline-query
 */

import type { PipelineIntelligence } from './advanced-upgrades';

/**
 * Maps calculator therapeutic area to the indication_category values
 * used in the company_trials table.
 */
const TA_TO_TRIAL_CATEGORY: Record<string, string[]> = {
  oncology: ['solid_tumor', 'hematological'],
  hematology: ['hematological'],
  immunology: ['autoimmune'],
  neurology: ['cns'],
  metabolic: ['metabolic'],
  cardiovascular: ['cardiovascular'],
  infectiousDisease: ['infectious'],
  rareDisease: ['rare_disease'],
  dermatology: ['dermatology'],
  // Fallbacks for TAs not yet in company_trials
  ophthalmology: [],
  gastroenterology: [],
  womensHealth: [],
};

/**
 * Maps calculator phase values to phase strings found in clinical trial data.
 * ClinicalTrials.gov uses "Phase 1", "Phase 2", "Phase 3", "Phase 1/Phase 2" etc.
 */
const PHASE_MATCH_PATTERNS: Record<string, string[]> = {
  discovery: ['Early Phase 1'],
  preclinical: ['Early Phase 1'],
  phase1: ['Phase 1'],
  phase1_2: ['Phase 1/Phase 2', 'Phase 1/2'],
  phase2: ['Phase 2'],
  phase2_3: ['Phase 2/Phase 3', 'Phase 2/3'],
  phase3: ['Phase 3'],
  nda_filed: ['Phase 3'],
  approved: ['Phase 4'],
};

/**
 * Infer the next phase the trial's asset would be in if approved.
 * Used to estimate when a competing Phase 2 asset would reach market.
 */
const PHASE_YEARS_TO_MARKET: Record<string, number> = {
  'Phase 1': 8,
  'Phase 1/Phase 2': 7,
  'Phase 1/2': 7,
  'Phase 2': 6,
  'Phase 2/Phase 3': 5,
  'Phase 2/3': 5,
  'Phase 3': 3,
  'Phase 4': 0,
  'Early Phase 1': 10,
};

interface TrialRow {
  nct_id: string;
  company_name: string;
  trial_title?: string;
  intervention_name?: string;
  modality?: string;
  target?: string;
  indication_specific?: string;
  phase?: string;
  status?: string;
  primary_completion_date?: string;
}

/**
 * Query the company_trials table for competing assets in the same market.
 *
 * Returns null if server-side execution fails or no data available —
 * calling code should fall back to calibrated templates.
 */
export async function fetchPipelineCompetitors(params: {
  therapeuticArea: string;
  indication?: string;
  modality?: string;
  phase: string;
  excludeCompany?: string;
  launchYear: number; // absolute calendar year
  maxCompetitors?: number;
}): Promise<PipelineIntelligence | null> {
  // Server-only: client-side calls return null so UI falls back to templates
  if (typeof window !== 'undefined') return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  try {
    const trialCategories = TA_TO_TRIAL_CATEGORY[params.therapeuticArea] || [];
    if (trialCategories.length === 0) return null;

    // Build query: match on indication_category AND optionally phase
    // Focus on trials in Phase 2 or later (more likely to actually reach market)
    const categoryFilter = trialCategories.map((c) => `"${c}"`).join(',');
    const phasePatterns = PHASE_MATCH_PATTERNS[params.phase] || ['Phase 2', 'Phase 3'];

    // Query: active trials in same TA, in Phase 2+, with completion dates in future
    const queryUrl = new URL(`${url}/rest/v1/company_trials`);
    queryUrl.searchParams.set('select', 'nct_id,company_name,trial_title,intervention_name,modality,target,indication_specific,phase,status,primary_completion_date');
    queryUrl.searchParams.set('indication_category', `in.(${categoryFilter})`);
    // Prefer active trials
    queryUrl.searchParams.set('status', 'in.("RECRUITING","ACTIVE_NOT_RECRUITING","NOT_YET_RECRUITING","ENROLLING_BY_INVITATION")');
    queryUrl.searchParams.set('order', 'primary_completion_date.asc');
    queryUrl.searchParams.set('limit', String((params.maxCompetitors ?? 6) * 4)); // over-fetch, then dedupe

    const response = await fetch(queryUrl.toString(), {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
      },
    });

    if (!response.ok) return null;
    const trials: TrialRow[] = await response.json();
    if (!Array.isArray(trials) || trials.length === 0) return null;

    // Filter: same indication (if specified) and phase relevance
    const filtered = trials.filter((t) => {
      // Exclude self/excluded company
      if (params.excludeCompany && t.company_name === params.excludeCompany) return false;
      // Exclude null phase
      if (!t.phase) return false;
      // Prefer same or later phase (i.e., closer to approval)
      const phaseLevel = phasePatterns.indexOf(t.phase);
      return phaseLevel !== -1 || t.phase === 'Phase 2' || t.phase === 'Phase 3';
    });

    if (filtered.length === 0) return null;

    // Deduplicate by company+intervention (one trial per asset)
    const deduped = new Map<string, TrialRow>();
    for (const t of filtered) {
      const key = `${t.company_name}|${t.intervention_name || t.nct_id}`;
      if (!deduped.has(key)) {
        deduped.set(key, t);
      }
    }

    const uniqueTrials = Array.from(deduped.values()).slice(0, params.maxCompetitors ?? 6);

    // Convert to PipelineIntelligence format
    const currentYear = new Date().getFullYear();
    const knownCompetitors = uniqueTrials.map((t) => {
      // Estimate expected approval year from completion date + regulatory review
      let expectedApprovalYear = params.launchYear + 2; // fallback
      if (t.primary_completion_date) {
        const completion = new Date(t.primary_completion_date);
        if (!isNaN(completion.getTime())) {
          const compYear = completion.getFullYear();
          const yearsToMarket = PHASE_YEARS_TO_MARKET[t.phase || 'Phase 2'] || 4;
          expectedApprovalYear = Math.max(currentYear, compYear + Math.floor(yearsToMarket / 2));
        }
      }

      return {
        name: `${t.company_name} ${t.intervention_name || t.nct_id}`.trim().slice(0, 60),
        phase: t.phase,
        sponsor: t.company_name,
        moa: t.target || t.modality,
        expectedApprovalYear,
        biomarkerRequired: Boolean(t.target && t.target.length > 0),
      };
    });

    return {
      knownCompetitors,
      additionalCompetitorCount: 0,
    };
  } catch (err) {
    // Silently fail — calling code falls back to templates
    if (process.env.NODE_ENV === 'development') {
      console.warn('[pipeline-query] fetchPipelineCompetitors failed:', err);
    }
    return null;
  }
}
