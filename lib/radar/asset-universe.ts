/**
 * Asset Radar — Layer 1: Asset Universe Engine
 *
 * Indexes ClinicalTrials.gov data into canonical `clinical_assets` entities.
 * Groups company_trials by intervention_name, resolves partnership status
 * against the deals table, and enriches with regulatory/geographic data.
 *
 * Run: daily at 6:30 AM UTC via /api/cron/asset-universe
 * Depends on: trials-update (5 AM), deals-update (3 AM) running first
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { classifyCompanyCountry } from '@/lib/ingestion/company-geography';

// ═══════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════

interface CompanyTrialRow {
  company_id: string;
  company_name: string;
  nct_id: string;
  trial_title: string;
  intervention_name: string | null;
  intervention_type: string | null;
  modality: string | null;
  indication_category: string | null;
  indication_specific: string | null;
  conditions: string[] | null;
  phase: string | null;
  status: string | null;
  is_collaboration: boolean;
  collaborator_names: string[] | null;
  enrollment_count: number | null;
  start_date: string | null;
  last_update_posted: string | null;
  primary_completion_date: string | null;
}

interface AssetGroup {
  companyId: string;
  companyName: string;
  canonicalName: string;
  aliases: Set<string>;
  trials: CompanyTrialRow[];
  nctIds: Set<string>;
  modalities: Set<string>;
  indications: Set<string>;
  indicationsSpecific: Set<string>;
  phases: Set<string>;
  targets: Set<string>;
}

export interface IndexResult {
  companiesProcessed: number;
  assetsIndexed: number;
  assetsUpdated: number;
  partnershipsResolved: number;
  errors: string[];
  timedOut: boolean;
}

// ═══════════════════════════════════════════════════════════════════════
// PHASE ORDERING
// ═══════════════════════════════════════════════════════════════════════

const PHASE_ORDER: Record<string, number> = {
  'early_phase1': 1, 'phase1': 2, 'phase_1': 2,
  'phase1_phase2': 3, 'phase_1_2': 3,
  'phase2': 4, 'phase_2': 4,
  'phase2_phase3': 5, 'phase_2_3': 5,
  'phase3': 6, 'phase_3': 6,
  'phase4': 7, 'phase_4': 7,
  'approved': 8,
};

export function resolveHighestPhase(phases: string[]): string {
  let highest = 'unknown';
  let highestOrder = -1;
  for (const p of phases) {
    const normalized = p.toLowerCase().replace(/\s+/g, '').replace(/-/g, '_');
    const order = PHASE_ORDER[normalized] ?? 0;
    if (order > highestOrder) {
      highestOrder = order;
      highest = p;
    }
  }
  return highest;
}

// ═══════════════════════════════════════════════════════════════════════
// ASSET NAME CANONICALIZATION
// ═══════════════════════════════════════════════════════════════════════

const GENERIC_INTERVENTION_NAMES = new Set([
  'placebo', 'saline', 'standard of care', 'soc', 'best supportive care',
  'observation', 'no intervention', 'usual care', 'active comparator',
  'drug', 'device', 'procedure', 'behavioral', 'dietary supplement',
  'radiation', 'other', 'diagnostic test', 'combination product',
]);

export function canonicalizeAssetName(interventionName: string): string | null {
  if (!interventionName) return null;
  const trimmed = interventionName.trim();
  if (trimmed.length < 2) return null;
  if (GENERIC_INTERVENTION_NAMES.has(trimmed.toLowerCase())) return null;
  // Remove dosage info: "Drug X 100mg" → "Drug X"
  const cleaned = trimmed
    .replace(/\s+\d+\s*(mg|mcg|ug|ml|g|iu|units?)\b.*$/i, '')
    .replace(/\s*\(.*?\)\s*$/, '')
    .trim();
  if (cleaned.length < 2) return null;
  if (GENERIC_INTERVENTION_NAMES.has(cleaned.toLowerCase())) return null;
  return cleaned;
}

function normalizeForMatching(name: string): string {
  return name.toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/\s+/g, '');
}

// ═══════════════════════════════════════════════════════════════════════
// PARTNERSHIP RESOLUTION
// ═══════════════════════════════════════════════════════════════════════

export async function resolvePartnershipStatus(
  supabase: SupabaseClient,
  assetName: string,
  companyName: string,
  aliases: string[],
): Promise<{
  status: 'unpartnered' | 'partnered' | 'partially_partnered' | 'unknown';
  dealId: string | null;
  dealIds: string[];
  partnerName: string | null;
  partnerCompanyId: string | null;
  availableTerritories: string[];
}> {
  const searchTerms = [assetName, ...aliases].filter(Boolean);
  if (searchTerms.length === 0) {
    return { status: 'unknown', dealId: null, dealIds: [], partnerName: null, partnerCompanyId: null, availableTerritories: [] };
  }

  // Search deals where this asset is mentioned (by licensor matching the company)
  const { data: deals } = await supabase
    .from('deals')
    .select('id, licensor_name, licensee_name, licensee_id, asset_name, territory, deal_status')
    .or(
      searchTerms.map(t => `asset_name.ilike.%${t.replace(/'/g, "''")}%`).join(',')
    )
    .eq('is_synthetic', false)
    .limit(20);

  if (!deals || deals.length === 0) {
    // Also check by licensor name + modality match (broader)
    const { data: companyDeals } = await supabase
      .from('deals')
      .select('id, licensor_name, licensee_name, licensee_id, asset_name, territory, deal_status')
      .ilike('licensor_name', `%${companyName.replace(/'/g, "''")}%`)
      .eq('is_synthetic', false)
      .limit(50);

    if (!companyDeals || companyDeals.length === 0) {
      return { status: 'unpartnered', dealId: null, dealIds: [], partnerName: null, partnerCompanyId: null, availableTerritories: ['global'] };
    }

    // Check if any company deals reference this asset name
    const matchingDeals = companyDeals.filter(d => {
      if (!d.asset_name) return false;
      const dealAsset = normalizeForMatching(d.asset_name);
      return searchTerms.some(t => {
        const term = normalizeForMatching(t);
        return dealAsset.includes(term) || term.includes(dealAsset);
      });
    });

    if (matchingDeals.length === 0) {
      return { status: 'unpartnered', dealId: null, dealIds: [], partnerName: null, partnerCompanyId: null, availableTerritories: ['global'] };
    }

    const territories = matchingDeals.map(d => d.territory).filter(Boolean);
    const hasGlobal = territories.some(t => t === 'global' || t === 'worldwide');
    const dealIds = matchingDeals.map(d => d.id);

    return {
      status: hasGlobal ? 'partnered' : (matchingDeals.length > 0 ? 'partially_partnered' : 'unpartnered'),
      dealId: matchingDeals[0]?.id ?? null,
      dealIds,
      partnerName: matchingDeals[0]?.licensee_name ?? null,
      partnerCompanyId: matchingDeals[0]?.licensee_id ?? null,
      availableTerritories: hasGlobal ? [] : ['global'],
    };
  }

  const activeDeals = deals.filter(d => d.deal_status !== 'terminated' && d.deal_status !== 'expired');
  if (activeDeals.length === 0) {
    return { status: 'unpartnered', dealId: null, dealIds: [], partnerName: null, partnerCompanyId: null, availableTerritories: ['global'] };
  }

  const territories = activeDeals.map(d => d.territory).filter(Boolean);
  const hasGlobal = territories.some(t => t === 'global' || t === 'worldwide');
  const dealIds = activeDeals.map(d => d.id);

  return {
    status: hasGlobal ? 'partnered' : 'partially_partnered',
    dealId: activeDeals[0]?.id ?? null,
    dealIds,
    partnerName: activeDeals[0]?.licensee_name ?? null,
    partnerCompanyId: activeDeals[0]?.licensee_id ?? null,
    availableTerritories: hasGlobal ? [] : territories.includes('us_only') ? ['ex_us'] : ['global'],
  };
}

// ═══════════════════════════════════════════════════════════════════════
// TRIAL GROUPING → ASSET ENTITIES
// ═══════════════════════════════════════════════════════════════════════

function groupTrialsIntoAssets(trials: CompanyTrialRow[]): AssetGroup[] {
  const groups = new Map<string, AssetGroup>();

  for (const trial of trials) {
    const canonical = canonicalizeAssetName(trial.intervention_name || '');
    if (!canonical) continue;

    const key = `${trial.company_id}::${normalizeForMatching(canonical)}`;

    if (!groups.has(key)) {
      groups.set(key, {
        companyId: trial.company_id,
        companyName: trial.company_name,
        canonicalName: canonical,
        aliases: new Set(),
        trials: [],
        nctIds: new Set(),
        modalities: new Set(),
        indications: new Set(),
        indicationsSpecific: new Set(),
        phases: new Set(),
        targets: new Set(),
      });
    }

    const group = groups.get(key)!;
    group.trials.push(trial);
    if (trial.nct_id) group.nctIds.add(trial.nct_id);
    if (trial.modality && trial.modality !== 'other') group.modalities.add(trial.modality);
    if (trial.indication_category) group.indications.add(trial.indication_category);
    if (trial.indication_specific) group.indicationsSpecific.add(trial.indication_specific);
    if (trial.phase) group.phases.add(trial.phase);
    if (trial.intervention_name && trial.intervention_name !== canonical) {
      group.aliases.add(trial.intervention_name);
    }
  }

  return Array.from(groups.values());
}

// ═══════════════════════════════════════════════════════════════════════
// CONFIDENCE SCORING
// ═══════════════════════════════════════════════════════════════════════

function computeConfidence(group: AssetGroup): number {
  let score = 0;
  // Multiple trials = higher confidence
  score += Math.min(group.trials.length * 10, 30);
  // Active trials = higher confidence
  const activeTrials = group.trials.filter(t =>
    t.status && ['recruiting', 'active_not_recruiting', 'not_yet_recruiting', 'enrolling_by_invitation'].includes(t.status)
  );
  score += Math.min(activeTrials.length * 10, 20);
  // Has enrollment data
  const totalEnrollment = group.trials.reduce((sum, t) => sum + (t.enrollment_count || 0), 0);
  if (totalEnrollment > 0) score += 10;
  if (totalEnrollment > 100) score += 10;
  // Has modality classification
  if (group.modalities.size > 0) score += 10;
  // Has indication classification
  if (group.indications.size > 0) score += 10;
  // Has phase info
  if (group.phases.size > 0) score += 10;

  return Math.min(score, 100);
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN INDEXING FUNCTION
// ═══════════════════════════════════════════════════════════════════════

const MAX_RUNTIME_MS = 240_000;
const COMPANY_BATCH_SIZE = 10;

export async function indexAssetUniverse(
  supabase: SupabaseClient,
  options?: { batchSize?: number; companyIds?: string[] },
): Promise<IndexResult> {
  const startTime = Date.now();
  const batchSize = options?.batchSize ?? COMPANY_BATCH_SIZE;
  const errors: string[] = [];
  let companiesProcessed = 0;
  let assetsIndexed = 0;
  let assetsUpdated = 0;
  let partnershipsResolved = 0;
  let timedOut = false;

  // Fetch companies to process (prioritize least recently enriched)
  let companyQuery = supabase
    .from('companies')
    .select('id, name, headquarters_country, headquarters_region')
    .order('updated_at', { ascending: true });

  if (options?.companyIds?.length) {
    companyQuery = companyQuery.in('id', options.companyIds);
  }

  const { data: companies, error: companyError } = await companyQuery.limit(200);
  if (companyError || !companies) {
    return { companiesProcessed: 0, assetsIndexed: 0, assetsUpdated: 0, partnershipsResolved: 0, errors: [companyError?.message || 'No companies found'], timedOut: false };
  }

  for (let i = 0; i < companies.length; i += batchSize) {
    if (Date.now() - startTime > MAX_RUNTIME_MS) { timedOut = true; break; }

    const batch = companies.slice(i, i + batchSize);
    const batchIds = batch.map(c => c.id);

    // Fetch all trials for this batch of companies
    const { data: trials, error: trialError } = await supabase
      .from('company_trials')
      .select('company_id, company_name, nct_id, trial_title, intervention_name, intervention_type, modality, indication_category, indication_specific, conditions, phase, status, is_collaboration, collaborator_names, enrollment_count, start_date, last_update_posted, primary_completion_date')
      .in('company_id', batchIds)
      .not('intervention_name', 'is', null);

    if (trialError) {
      errors.push(`Trial fetch error for batch ${i}: ${trialError.message}`);
      continue;
    }

    if (!trials || trials.length === 0) {
      companiesProcessed += batch.length;
      continue;
    }

    // Group trials into asset entities
    const assetGroups = groupTrialsIntoAssets(trials as CompanyTrialRow[]);

    for (const group of assetGroups) {
      if (Date.now() - startTime > MAX_RUNTIME_MS) { timedOut = true; break; }

      try {
        // Resolve partnership status
        const partnership = await resolvePartnershipStatus(
          supabase,
          group.canonicalName,
          group.companyName,
          [...group.aliases],
        );
        partnershipsResolved++;

        // Compute highest phase
        const highestPhase = resolveHighestPhase([...group.phases]);

        // Compute enrollment
        const totalEnrollment = group.trials.reduce((sum, t) => sum + (t.enrollment_count || 0), 0);

        // Get company geography
        const company = batch.find(c => c.id === group.companyId);
        const geo = company?.headquarters_country
          ? { country: company.headquarters_country, region: company.headquarters_region }
          : classifyCompanyCountry(group.companyName);

        // Compute primary modality (most common)
        const modalityArr = [...group.modalities];
        const primaryModality = modalityArr.length > 0 ? modalityArr[0] : null;

        // Compute confidence
        const confidence = computeConfidence(group);

        // Find earliest trial date
        const startDates = group.trials
          .map(t => t.start_date)
          .filter(Boolean)
          .sort();

        // Find latest update
        const updateDates = group.trials
          .map(t => t.last_update_posted)
          .filter(Boolean)
          .sort()
          .reverse();

        // Determine trial status (active if any trial is active)
        const statuses = group.trials.map(t => t.status).filter(Boolean);
        const hasActive = statuses.some(s =>
          ['recruiting', 'active_not_recruiting', 'not_yet_recruiting', 'enrolling_by_invitation'].includes(s!)
        );
        const trialStatus = hasActive ? 'active' : (statuses.includes('completed') ? 'completed' : 'other');

        // Determine therapeutic area from indications
        const indicationArr = [...group.indications];
        const therapeuticArea = indicationArr.length > 0
          ? deriveTA(indicationArr[0])
          : null;

        // Upsert into clinical_assets
        const assetData = {
          company_id: group.companyId,
          company_name: group.companyName,
          asset_name: group.canonicalName,
          asset_aliases: [...group.aliases].slice(0, 20),
          modality: primaryModality,
          therapeutic_area: therapeuticArea,
          indication_category: indicationArr[0] || null,
          indication_specific: [...group.indicationsSpecific][0] || null,
          indications_all: [...group.indicationsSpecific].slice(0, 30),
          phase: highestPhase,
          trial_status: trialStatus,
          lead_nct_id: [...group.nctIds][0] || null,
          nct_ids: [...group.nctIds],
          trial_count: group.trials.length,
          enrollment_total: totalEnrollment,
          partnership_status: partnership.status,
          partner_company_id: partnership.partnerCompanyId,
          partner_company_name: partnership.partnerName,
          deal_id: partnership.dealId,
          deal_ids: partnership.dealIds,
          territory_rights_available: partnership.availableTerritories,
          originator_country: geo.country !== 'unknown' ? geo.country : null,
          originator_region: geo.region !== 'unknown' ? geo.region : null,
          confidence_score: confidence,
          data_sources: ['clinicaltrials'],
          first_posted_date: startDates[0] || null,
          last_update_date: updateDates[0] || null,
          last_enriched_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { error: upsertError, data: upsertResult } = await supabase
          .from('clinical_assets')
          .upsert(assetData, { onConflict: 'company_name,asset_name' })
          .select('id')
          .single();

        if (upsertError) {
          if (upsertError.code !== '23505') {
            errors.push(`Asset upsert error ${group.companyName}/${group.canonicalName}: ${upsertError.message}`);
          }
        } else {
          if (upsertResult) assetsIndexed++;
          else assetsUpdated++;
        }
      } catch (err) {
        errors.push(`Asset processing error ${group.companyName}/${group.canonicalName}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    companiesProcessed += batch.length;
  }

  // Log to ingestion log
  const duration = Math.round((Date.now() - startTime) / 1000);
  await supabase.from('data_ingestion_log').insert({
    source: 'asset_universe',
    status: errors.length > 0 ? 'partial' : 'success',
    records_processed: companiesProcessed,
    records_inserted: assetsIndexed,
    records_updated: assetsUpdated,
    duration_seconds: duration,
    error_details: errors.length > 0 ? errors.slice(0, 20) : null,
    metadata: {
      partnerships_resolved: partnershipsResolved,
      timed_out: timedOut,
    },
  }).then(() => {}).catch(() => {});

  console.log(`[asset-universe] Done: ${companiesProcessed} companies, ${assetsIndexed} assets indexed, ${assetsUpdated} updated, ${partnershipsResolved} partnerships resolved, ${errors.length} errors, ${duration}s${timedOut ? ' (timed out)' : ''}`);

  return { companiesProcessed, assetsIndexed, assetsUpdated, partnershipsResolved, errors, timedOut };
}

// Simple TA derivation from indication category
function deriveTA(indicationCategory: string): string | null {
  const map: Record<string, string> = {
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
  return map[indicationCategory.toLowerCase()] || null;
}
