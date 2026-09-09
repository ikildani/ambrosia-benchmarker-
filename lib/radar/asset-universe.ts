/**
 * Asset Radar — Layer 1: Asset Universe Engine
 *
 * Indexes ClinicalTrials.gov data into canonical `clinical_assets` entities.
 * Groups trials into assets — by is_primary_asset rows in trial_interventions
 * (migration 106, written by the sponsor-agnostic sweep) when a trial has
 * them, else by company_trials.intervention_name — resolves partnership
 * status against the deals table, and enriches with geographic data.
 * Companies whose owner_type is 'cro' are never indexed: CROs run trials,
 * they do not own assets.
 *
 * Run: daily at 6:30 AM UTC via /api/cron/asset-universe
 * Depends on: trials-update (5 AM), deals-update (3 AM) running first
 *
 * Cursor: companies.assets_indexed_at (migration 102). Companies are selected
 * server-side by radar_companies_to_index(), which only returns companies with
 * at least one drug-bearing trial, least-recently indexed first (never-indexed
 * first). companies.updated_at is NOT touched by this module.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { classifyCompanyCountry, deriveRegion } from '@/lib/ingestion/company-geography';
import { inferModalityFromIntervention } from '@/lib/ingestion/clinical-trials';
import { logRadarRun, deriveRunStatus } from '@/lib/radar/run-log';
import { validateAssetData } from '@/lib/radar/validation';

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

interface CompanyRow {
  id: string;
  name: string;
  hq_country: string | null;
  hq_region: string | null;
  headquarters_country: string | null;
  headquarters_region: string | null;
  assets_indexed_at: string | null;
}

/** trial_interventions row (migration 106) — one per intervention per study. */
interface TrialInterventionRow {
  nct_id: string;
  company_id: string | null;
  name: string;
  name_normalized: string;
  intervention_type: string | null;
  arm_role: string;
  is_primary_asset: boolean;
  other_names: string[] | null;
  description: string | null;
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
  /** Trials fetched from company_trials for the processed companies */
  trialsFetched: number;
  /** New clinical_assets rows */
  assetsIndexed: number;
  /** Existing clinical_assets rows refreshed */
  assetsUpdated: number;
  /** Groups dropped (non-drug intervention, no informative phase, generic name) */
  assetsSkipped: number;
  /** Rows rejected by validation or by a failed upsert chunk */
  assetsFailed: number;
  partnershipsResolved: number;
  /** Selected companies skipped because owner_type = 'cro' (stamped so they rotate out) */
  croCompaniesSkipped: number;
  /** Trials grouped through trial_interventions rather than intervention_name */
  trialsFromInterventions: number;
  errors: string[];
  timedOut: boolean;
  /** Whether the data_ingestion_log row was written */
  logged: boolean;
}

// ═══════════════════════════════════════════════════════════════════════
// PHASE ORDERING
// ═══════════════════════════════════════════════════════════════════════

/**
 * Ordinal rank per phase. Keys are normalized (lower-case, no whitespace,
 * '-' → '_') so both company_trials CHECK values (early_phase_1, phase_1_2,
 * phase_2_3, ...) and legacy spellings (phase1_phase2, ...) rank correctly.
 * phase_1_2 sits between phase_1 and phase_2; phase_2_3 between phase_2 and
 * phase_3. Non-informative phases (unknown / not_applicable) rank 0.
 */
const PHASE_ORDER: Record<string, number> = {
  'not_applicable': 0, 'na': 0, 'unknown': 0,
  'early_phase1': 1, 'early_phase_1': 1, 'earlyphase1': 1,
  'phase1': 2, 'phase_1': 2,
  'phase1_phase2': 3, 'phase_1_2': 3, 'phase1_2': 3, 'phase1/phase2': 3,
  'phase2': 4, 'phase_2': 4,
  'phase2_phase3': 5, 'phase_2_3': 5, 'phase2_3': 5, 'phase2/phase3': 5,
  'phase3': 6, 'phase_3': 6,
  'phase4': 7, 'phase_4': 7,
  'approved': 8,
};

/** Phases that carry no development-stage information. */
const NON_INFORMATIVE_PHASES = new Set(['not_applicable', 'na', 'unknown']);

function normalizePhaseKey(phase: string): string {
  return phase.toLowerCase().replace(/\s+/g, '').replace(/-/g, '_');
}

export function isInformativePhase(phase: string | null | undefined): boolean {
  if (!phase) return false;
  return !NON_INFORMATIVE_PHASES.has(normalizePhaseKey(phase));
}

export function resolveHighestPhase(phases: string[]): string {
  let highest = 'unknown';
  let highestOrder = -1;
  for (const p of phases) {
    if (!p) continue;
    const order = PHASE_ORDER[normalizePhaseKey(p)] ?? 0;
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
// DRUG-BEARING INTERVENTIONS
// ═══════════════════════════════════════════════════════════════════════

/**
 * CT.gov intervention types that describe a licensable drug/biologic asset.
 * Devices, procedures, behavioral, dietary supplements, radiation, diagnostic
 * tests and "other" are excluded — they were producing device/procedure
 * "assets" in clinical_assets.
 */
export const DRUG_INTERVENTION_TYPES = new Set(['DRUG', 'BIOLOGICAL', 'GENETIC', 'COMBINATION_PRODUCT']);

export function isDrugInterventionType(type: string | null | undefined): boolean {
  if (!type) return false;
  return DRUG_INTERVENTION_TYPES.has(type.trim().toUpperCase().replace(/\s+/g, '_'));
}

// ═══════════════════════════════════════════════════════════════════════
// GEOGRAPHY (canonical: ISO 3166-1 alpha-2 + region slug)
// ═══════════════════════════════════════════════════════════════════════

/** Full country names still present in companies.hq_country → ISO-2. */
const COUNTRY_NAME_TO_ISO: Record<string, string> = {
  'united states': 'US', 'united states of america': 'US', 'usa': 'US', 'u.s.': 'US', 'u.s.a.': 'US',
  'switzerland': 'CH',
  'uk': 'GB', 'u.k.': 'GB', 'united kingdom': 'GB', 'great britain': 'GB', 'england': 'GB', 'scotland': 'GB', 'wales': 'GB',
  'japan': 'JP',
  'china': 'CN', "people's republic of china": 'CN', 'prc': 'CN',
  'south korea': 'KR', 'korea': 'KR', 'republic of korea': 'KR', 'korea, republic of': 'KR',
  'germany': 'DE', 'france': 'FR', 'denmark': 'DK', 'belgium': 'BE', 'italy': 'IT', 'ireland': 'IE',
  'canada': 'CA', 'netherlands': 'NL', 'the netherlands': 'NL', 'holland': 'NL',
  'israel': 'IL', 'india': 'IN', 'spain': 'ES', 'sweden': 'SE', 'brazil': 'BR', 'hong kong': 'HK',
  'finland': 'FI', 'taiwan': 'TW', 'norway': 'NO', 'indonesia': 'ID', 'australia': 'AU',
  'singapore': 'SG', 'austria': 'AT', 'mexico': 'MX', 'argentina': 'AR', 'south africa': 'ZA',
  'united arab emirates': 'AE', 'saudi arabia': 'SA', 'turkey': 'TR', 'poland': 'PL',
  'portugal': 'PT', 'czech republic': 'CZ', 'czechia': 'CZ', 'hungary': 'HU', 'greece': 'GR',
  'new zealand': 'NZ', 'thailand': 'TH', 'malaysia': 'MY', 'philippines': 'PH', 'vietnam': 'VN',
  'luxembourg': 'LU', 'iceland': 'IS',
};

/** Normalize any stored country value (ISO-2, 'UK', full name) to ISO-2 or null. */
export function normalizeCountryCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.toLowerCase() === 'unknown') return null;
  if (/^[A-Za-z]{2}$/.test(trimmed)) {
    const iso = trimmed.toUpperCase();
    return iso === 'UK' ? 'GB' : iso;
  }
  return COUNTRY_NAME_TO_ISO[trimmed.toLowerCase()] ?? null;
}

/**
 * Resolve canonical geography for an asset: prefer the ISO-2
 * companies.headquarters_country (migration 079), then the legacy full-name
 * hq_country, then the name-based classifier. Region is always derived from
 * the country so the two can never disagree.
 */
function resolveAssetGeography(company: CompanyRow | undefined, companyName: string): { country: string | null; region: string | null } {
  let country = normalizeCountryCode(company?.headquarters_country) ?? normalizeCountryCode(company?.hq_country);
  if (!country) {
    const geo = classifyCompanyCountry(companyName);
    country = geo.country !== 'unknown' ? geo.country : null;
  }
  if (!country) return { country: null, region: null };
  const region = deriveRegion(country);
  return { country, region: region !== 'unknown' ? region : null };
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

/** Key for the per-trial interventions map: company_id + nct_id. */
function trialKey(companyId: string, nctId: string): string {
  return `${companyId}\u0000${nctId}`;
}

function groupTrialsIntoAssets(
  trials: CompanyTrialRow[],
  interventionsByTrial: Map<string, TrialInterventionRow[]>,
): { groups: AssetGroup[]; skippedNonDrug: number; fromInterventions: number } {
  const groups = new Map<string, AssetGroup>();
  let skippedNonDrug = 0;
  let fromInterventions = 0;

  const addToGroup = (trial: CompanyTrialRow, canonical: string, rawNames: string[], modality: string | null) => {
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
    // A trial contributes once per asset even if the sweep listed the
    // intervention under several names that canonicalize the same way.
    if (!group.nctIds.has(trial.nct_id)) group.trials.push(trial);
    if (trial.nct_id) group.nctIds.add(trial.nct_id);
    if (modality && modality !== 'other') group.modalities.add(modality);
    if (trial.indication_category) group.indications.add(trial.indication_category);
    if (trial.indication_specific) group.indicationsSpecific.add(trial.indication_specific);
    if (trial.phase) group.phases.add(trial.phase);
    for (const raw of rawNames) {
      if (raw && raw !== canonical) group.aliases.add(raw);
    }
  };

  for (const trial of trials) {
    const ivRows = interventionsByTrial.get(trialKey(trial.company_id, trial.nct_id));

    if (ivRows) {
      // Sweep path: one asset per is_primary_asset intervention. Comparator,
      // placebo and background arms are in the table but never become assets.
      fromInterventions++;
      for (const iv of ivRows) {
        if (!iv.is_primary_asset || !isDrugInterventionType(iv.intervention_type)) continue;
        const canonical = canonicalizeAssetName(iv.name);
        if (!canonical) continue;
        const ivModality = inferModalityFromIntervention([
          { name: iv.name, type: iv.intervention_type || '', description: iv.description },
        ]);
        addToGroup(
          trial,
          canonical,
          [iv.name, ...(iv.other_names || [])],
          ivModality !== 'other' ? ivModality : trial.modality,
        );
      }
      continue;
    }

    // Legacy path (trials without trial_interventions rows): the first
    // drug-class intervention stored in company_trials.intervention_name.
    if (!isDrugInterventionType(trial.intervention_type)) { skippedNonDrug++; continue; }

    const canonical = canonicalizeAssetName(trial.intervention_name || '');
    if (!canonical) continue;

    addToGroup(trial, canonical, trial.intervention_name ? [trial.intervention_name] : [], trial.modality);
  }

  return { groups: Array.from(groups.values()), skippedNonDrug, fromInterventions };
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
// DATA ACCESS HELPERS
// ═══════════════════════════════════════════════════════════════════════

const TRIAL_COLUMNS = 'company_id, company_name, nct_id, trial_title, intervention_name, intervention_type, modality, indication_category, indication_specific, conditions, phase, status, is_collaboration, collaborator_names, enrollment_count, start_date, last_update_posted, primary_completion_date';

/** PostgREST caps a single response at max-rows (1,000 by default); page explicitly. */
const PAGE_SIZE = 1000;

async function fetchTrialsForCompanies(
  supabase: SupabaseClient,
  companyIds: string[],
): Promise<{ trials: CompanyTrialRow[]; error: string | null }> {
  const all: CompanyTrialRow[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('company_trials')
      .select(TRIAL_COLUMNS)
      .in('company_id', companyIds)
      .not('intervention_name', 'is', null)
      .order('company_id', { ascending: true })
      .order('nct_id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) return { trials: all, error: error.message };
    if (!data || data.length === 0) break;
    all.push(...(data as unknown as CompanyTrialRow[]));
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return { trials: all, error: null };
}

const INTERVENTION_COLUMNS = 'nct_id, company_id, name, name_normalized, intervention_type, arm_role, is_primary_asset, other_names, description';

/**
 * trial_interventions rows (migration 106) for a batch of companies, keyed
 * by company_id + nct_id. Trials absent from the map fall back to the
 * legacy intervention_name path in groupTrialsIntoAssets.
 */
async function fetchInterventionsForCompanies(
  supabase: SupabaseClient,
  companyIds: string[],
): Promise<{ byTrial: Map<string, TrialInterventionRow[]>; error: string | null }> {
  const byTrial = new Map<string, TrialInterventionRow[]>();
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('trial_interventions')
      .select(INTERVENTION_COLUMNS)
      .in('company_id', companyIds)
      .order('nct_id', { ascending: true })
      .order('name_normalized', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) return { byTrial, error: error.message };
    if (!data || data.length === 0) break;
    for (const row of data as unknown as TrialInterventionRow[]) {
      if (!row.company_id) continue;
      const key = trialKey(row.company_id, row.nct_id);
      const list = byTrial.get(key);
      if (list) list.push(row); else byTrial.set(key, [row]);
    }
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return { byTrial, error: null };
}

/** companies.owner_type (migration 106) for the selected companies. */
async function fetchOwnerTypes(
  supabase: SupabaseClient,
  companyIds: string[],
): Promise<{ byId: Map<string, string>; error: string | null }> {
  const byId = new Map<string, string>();
  for (let i = 0; i < companyIds.length; i += 200) {
    const { data, error } = await supabase
      .from('companies')
      .select('id, owner_type')
      .in('id', companyIds.slice(i, i + 200));
    if (error) return { byId, error: error.message };
    for (const row of data ?? []) byId.set(row.id, row.owner_type ?? 'unknown');
  }
  return { byId, error: null };
}

function assetKey(companyName: string, assetName: string): string {
  return `${companyName}\u0000${assetName}`;
}

/** Existing (company_name, asset_name) keys for a set of companies — paged. */
async function fetchExistingAssetKeys(
  supabase: SupabaseClient,
  companyNames: string[],
): Promise<{ keys: Set<string>; error: string | null }> {
  const keys = new Set<string>();
  if (companyNames.length === 0) return { keys, error: null };
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('clinical_assets')
      .select('company_name, asset_name')
      .in('company_name', companyNames)
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) return { keys, error: error.message };
    if (!data || data.length === 0) break;
    for (const row of data) keys.add(assetKey(row.company_name, row.asset_name));
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return { keys, error: null };
}

async function selectCompaniesToIndex(
  supabase: SupabaseClient,
  limit: number,
  companyIds?: string[],
): Promise<{ companies: CompanyRow[]; error: string | null }> {
  const { data, error } = await supabase.rpc('radar_companies_to_index', {
    p_limit: limit,
    p_company_ids: companyIds && companyIds.length > 0 ? companyIds : null,
  });
  if (error) {
    return { companies: [], error: `radar_companies_to_index failed (is migration 102 applied?): ${error.message}` };
  }
  return { companies: (data ?? []) as CompanyRow[], error: null };
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN INDEXING FUNCTION
// ═══════════════════════════════════════════════════════════════════════

const MAX_RUNTIME_MS = 240_000;
const COMPANY_BATCH_SIZE = 10;
// 2,000 companies per run: the sponsor-agnostic CT.gov sweep creates tens of
// thousands of sponsor companies; the 240 s time budget is the real cap and only
// fully processed batches are stamped, so a high default is safe.
const DEFAULT_COMPANY_LIMIT = 2000;
const UPSERT_CHUNK_SIZE = 200;

export interface IndexOptions {
  /** Companies per trial-fetch/upsert batch (default 10) */
  batchSize?: number;
  /** Max companies to pull from the cursor this run (default 400) */
  companyLimit?: number;
  /** Restrict to specific companies (still filtered to those with drug trials) */
  companyIds?: string[];
  runType?: 'scheduled' | 'manual' | 'backfill';
}

type AssetRow = Record<string, unknown> & { company_name: string; asset_name: string; trial_count: number };

export async function indexAssetUniverse(
  supabase: SupabaseClient,
  options?: IndexOptions,
): Promise<IndexResult> {
  const startTime = Date.now();
  const batchSize = Math.max(1, options?.batchSize ?? COMPANY_BATCH_SIZE);
  const companyLimit = Math.max(1, options?.companyLimit ?? DEFAULT_COMPANY_LIMIT);
  const errors: string[] = [];
  let companiesProcessed = 0;
  let trialsFetched = 0;
  let assetsIndexed = 0;
  let assetsUpdated = 0;
  let assetsSkipped = 0;
  let assetsFailed = 0;
  let partnershipsResolved = 0;
  let croCompaniesSkipped = 0;
  let trialsFromInterventions = 0;
  let timedOut = false;

  const isOutOfTime = () => Date.now() - startTime > MAX_RUNTIME_MS;

  const finish = async (cursorNote?: string): Promise<IndexResult> => {
    const produced = assetsIndexed + assetsUpdated;
    const status = deriveRunStatus({ errors: errors.length, timedOut, processed: companiesProcessed, produced });
    const logged = await logRadarRun(supabase, {
      source: 'asset_universe',
      startedAt: startTime,
      status,
      runType: options?.runType ?? 'scheduled',
      fetched: trialsFetched,
      processed: companiesProcessed,
      inserted: assetsIndexed,
      updated: assetsUpdated,
      skipped: assetsSkipped,
      failed: assetsFailed,
      errors,
      parameters: {
        company_limit: companyLimit,
        batch_size: batchSize,
        partnerships_resolved: partnershipsResolved,
        cro_companies_skipped: croCompaniesSkipped,
        trials_from_interventions: trialsFromInterventions,
        timed_out: timedOut,
        ...(cursorNote ? { cursor: cursorNote } : {}),
      },
    });
    const duration = Math.round((Date.now() - startTime) / 1000);
    console.log(`[asset-universe] Done: ${companiesProcessed} companies, ${trialsFetched} trials (${trialsFromInterventions} via trial_interventions), ${assetsIndexed} assets inserted, ${assetsUpdated} updated, ${assetsSkipped} skipped, ${assetsFailed} failed, ${partnershipsResolved} partnerships resolved, ${croCompaniesSkipped} CRO companies skipped, ${errors.length} errors, ${duration}s${timedOut ? ' (timed out)' : ''}${logged ? '' : ' [LOG WRITE FAILED]'}`);
    return { companiesProcessed, trialsFetched, assetsIndexed, assetsUpdated, assetsSkipped, assetsFailed, partnershipsResolved, croCompaniesSkipped, trialsFromInterventions, errors, timedOut, logged };
  };

  // ── Company selection (cursor: assets_indexed_at NULLS FIRST) ─────────
  const { companies, error: companyError } = await selectCompaniesToIndex(supabase, companyLimit, options?.companyIds);
  if (companyError) {
    errors.push(companyError);
    return finish();
  }
  if (companies.length === 0) {
    return finish('no companies with drug-bearing trials');
  }

  const cursorStart = companies[0]?.assets_indexed_at ?? null;
  const cursorEnd = companies[companies.length - 1]?.assets_indexed_at ?? null;

  // ── Owner types (migration 106): CROs never own assets ──────────────
  // The RPC (migration 102) is left untouched; CRO rows it returns are
  // stamped here so they rotate to the back of the cursor instead of being
  // re-selected first on every run.
  const { byId: ownerTypeById, error: ownerTypeError } = await fetchOwnerTypes(supabase, companies.map(c => c.id));
  if (ownerTypeError) {
    errors.push(`owner_type lookup error (is migration 106 applied?): ${ownerTypeError}`);
  }
  const croIds = companies.filter(c => ownerTypeById.get(c.id) === 'cro').map(c => c.id);
  if (croIds.length > 0) {
    const { error: croStampError } = await supabase
      .from('companies')
      .update({ assets_indexed_at: new Date().toISOString() })
      .in('id', croIds);
    if (croStampError) errors.push(`CRO cursor stamp error: ${croStampError.message}`);
    croCompaniesSkipped += croIds.length;
  }
  const indexable = companies.filter(c => ownerTypeById.get(c.id) !== 'cro');

  for (let i = 0; i < indexable.length; i += batchSize) {
    if (isOutOfTime()) { timedOut = true; break; }

    const batch = indexable.slice(i, i + batchSize);
    const batchIds = batch.map(c => c.id);
    const batchLabel = `batch ${Math.floor(i / batchSize) + 1}`;

    // ── Fetch all trials for this batch of companies (paged) ───────────
    const { trials, error: trialError } = await fetchTrialsForCompanies(supabase, batchIds);
    if (trialError) {
      errors.push(`Trial fetch error for ${batchLabel}: ${trialError}`);
      continue; // do not stamp — retried next run
    }
    trialsFetched += trials.length;

    // ── Per-intervention arm roles from the sweep (migration 106) ──────
    // A missing table degrades to the legacy path and is surfaced as an error.
    const { byTrial: interventionsByTrial, error: interventionError } = await fetchInterventionsForCompanies(supabase, batchIds);
    if (interventionError) {
      errors.push(`trial_interventions fetch error for ${batchLabel} (is migration 106 applied?): ${interventionError}`);
    }

    // ── Group trials into asset entities ───────────────────────────────
    const { groups: allGroups, skippedNonDrug, fromInterventions } = groupTrialsIntoAssets(trials, interventionsByTrial);
    assetsSkipped += skippedNonDrug;
    trialsFromInterventions += fromInterventions;

    // Drop groups whose only phases are not_applicable / unknown
    const assetGroups = allGroups.filter(g => {
      const informative = [...g.phases].some(isInformativePhase);
      if (!informative) assetsSkipped++;
      return informative;
    });

    // ── Existing keys for correct inserted/updated accounting ─────────
    const companyNames = [...new Set(assetGroups.map(g => g.companyName))];
    const { keys: existingKeys, error: keysError } = await fetchExistingAssetKeys(supabase, companyNames);
    if (keysError) {
      errors.push(`Existing-asset lookup error for ${batchLabel}: ${keysError}`);
      continue; // do not stamp — retried next run
    }

    // ── Build rows ────────────────────────────────────────────────────
    const rowsByKey = new Map<string, AssetRow>();
    let batchTimedOut = false;

    for (const group of assetGroups) {
      if (isOutOfTime()) { timedOut = true; batchTimedOut = true; break; }

      try {
        const partnership = await resolvePartnershipStatus(
          supabase,
          group.canonicalName,
          group.companyName,
          [...group.aliases],
        );
        partnershipsResolved++;

        const highestPhase = resolveHighestPhase([...group.phases]);
        const totalEnrollment = group.trials.reduce((sum, t) => sum + (t.enrollment_count || 0), 0);

        const company = batch.find(c => c.id === group.companyId);
        const geo = resolveAssetGeography(company, group.companyName);

        const modalityArr = [...group.modalities];
        const primaryModality = modalityArr.length > 0 ? modalityArr[0] : null;

        const confidence = computeConfidence(group);

        const startDates = group.trials.map(t => t.start_date).filter(Boolean).sort();
        const updateDates = group.trials.map(t => t.last_update_posted).filter(Boolean).sort().reverse();

        const statuses = group.trials.map(t => t.status).filter(Boolean);
        const hasActive = statuses.some(s =>
          ['recruiting', 'active_not_recruiting', 'not_yet_recruiting', 'enrolling_by_invitation'].includes(s!)
        );
        const trialStatus = hasActive ? 'active' : (statuses.includes('completed') ? 'completed' : 'other');

        // Therapeutic area: first indication category that maps to a TA
        const indicationArr = [...group.indications];
        let therapeuticArea: string | null = null;
        for (const cat of indicationArr) {
          therapeuticArea = deriveTA(cat);
          if (therapeuticArea) break;
        }

        const nowIso = new Date().toISOString();
        const assetData: AssetRow = {
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
          originator_country: geo.country,
          originator_region: geo.region,
          // TODO(migration): surface the owner type on the asset. clinical_assets
          // (migration 090) has no lead_sponsor_type column; when one is added,
          // write ownerTypeById.get(group.companyId) ?? 'unknown' here so the
          // UI can facet industry vs academic / hospital / government owners.
          confidence_score: confidence,
          data_sources: ['clinicaltrials'],
          first_posted_date: startDates[0] || null,
          last_update_date: updateDates[0] || null,
          last_enriched_at: nowIso,
          updated_at: nowIso,
        };

        // ── Validate before upsert ───────────────────────────────────
        const validation = validateAssetData(assetData);
        if (!validation.valid) {
          assetsFailed++;
          errors.push(`Validation failed ${group.companyName}/${group.canonicalName}: ${validation.errors.join('; ')}`);
          continue;
        }
        if (validation.warnings.length > 0) {
          console.warn(`[asset-universe] ${group.companyName}/${group.canonicalName}: ${validation.warnings.join('; ')}`);
        }

        // Two company_ids can share a company_name; the unique key is
        // (company_name, asset_name), and PostgREST rejects duplicate keys
        // within one upsert statement — keep the richer row.
        const key = assetKey(assetData.company_name, assetData.asset_name);
        const prior = rowsByKey.get(key);
        if (!prior || assetData.trial_count > prior.trial_count) rowsByKey.set(key, assetData);
      } catch (err) {
        assetsFailed++;
        errors.push(`Asset processing error ${group.companyName}/${group.canonicalName}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // ── Batched upsert (chunks of UPSERT_CHUNK_SIZE) ───────────────────
    const rows = [...rowsByKey.values()];
    for (let c = 0; c < rows.length; c += UPSERT_CHUNK_SIZE) {
      const chunk = rows.slice(c, c + UPSERT_CHUNK_SIZE);
      const { error: upsertError } = await supabase
        .from('clinical_assets')
        .upsert(chunk, { onConflict: 'company_name,asset_name' });

      if (upsertError) {
        assetsFailed += chunk.length;
        errors.push(`Asset upsert error for ${batchLabel} chunk ${c / UPSERT_CHUNK_SIZE + 1} (${chunk.length} rows): ${upsertError.message}`);
        continue;
      }
      for (const row of chunk) {
        const key = assetKey(row.company_name, row.asset_name);
        if (existingKeys.has(key)) assetsUpdated++;
        else { assetsIndexed++; existingKeys.add(key); }
      }
    }

    if (batchTimedOut) {
      // Partial batch: rows built so far were persisted, but the batch is
      // NOT stamped so the remaining groups are picked up next run.
      break;
    }

    // ── Advance cursor for the fully processed batch ──────────────────
    const { error: stampError } = await supabase
      .from('companies')
      .update({ assets_indexed_at: new Date().toISOString() })
      .in('id', batchIds);
    if (stampError) {
      errors.push(`Cursor stamp error for ${batchLabel}: ${stampError.message}`);
    }

    companiesProcessed += batch.length;
  }

  return finish(`assets_indexed_at window ${cursorStart ?? 'NULL'} → ${cursorEnd ?? 'NULL'} (${companies.length} selected)`);
}

// ═══════════════════════════════════════════════════════════════════════
// THERAPEUTIC AREA DERIVATION
// ═══════════════════════════════════════════════════════════════════════

/**
 * Map a company_trials.indication_category (emitted by
 * inferIndicationFromConditions in lib/ingestion/clinical-trials.ts) to the
 * Radar therapeutic_area vocabulary (oncology, neurology, immunology,
 * metabolic, cardiovascular, rare_disease, infectious_disease, ophthalmology,
 * respiratory, dermatology, hematology, womens_health, gastroenterology).
 *
 * The classifier emits 'infectious' (and companies.indications_active /
 * partner-matching depend on that spelling), so both 'infectious' and
 * 'infectious_disease' map to 'infectious_disease' here.
 */
const INDICATION_CATEGORY_TO_TA: Record<string, string> = {
  // ── Classifier categories (lib/ingestion/clinical-trials.ts) ────────
  solid_tumor: 'oncology', hematological: 'oncology',
  cns: 'neurology',
  autoimmune: 'immunology',
  dermatology: 'dermatology',
  rare_disease: 'rare_disease',
  infectious: 'infectious_disease', infectious_disease: 'infectious_disease',
  vaccine: 'infectious_disease', vaccines: 'infectious_disease',
  cardiovascular: 'cardiovascular',
  metabolic: 'metabolic',
  ophthalmology: 'ophthalmology',
  respiratory: 'respiratory',
  // Renal has no TA of its own in the Radar vocabulary; grouped with
  // cardiovascular per the industry CVRM (cardiovascular-renal-metabolic) convention.
  renal: 'cardiovascular',
  gastroenterology: 'gastroenterology', hepatology: 'gastroenterology',
  // Pain / analgesia programs are CNS-adjacent.
  pain: 'neurology',
  // Musculoskeletal (OA, osteoporosis, myopathies) grouped under immunology /
  // rheumatology — no dedicated TA in the Radar vocabulary.
  musculoskeletal: 'immunology',
  womens_health: 'womens_health',
  hematology: 'hematology',
  // ── Legacy / alternate spellings ────────────────────────────────────
  solid_tumors: 'oncology', hematologic: 'oncology', leukemia: 'oncology', lymphoma: 'oncology',
  multiple_myeloma: 'oncology', lung_cancer: 'oncology', breast_cancer: 'oncology', oncology: 'oncology',
  neurology: 'neurology', alzheimers: 'neurology', parkinsons: 'neurology',
  epilepsy: 'neurology', migraine: 'neurology', ms: 'neurology',
  immunology: 'immunology', lupus: 'immunology', rheumatoid: 'immunology',
  crohns: 'immunology', psoriatic_arthritis: 'immunology', atopic_dermatitis: 'immunology',
  obesity: 'metabolic', diabetes: 'metabolic', nash: 'metabolic',
  heart_failure: 'cardiovascular',
  orphan: 'rare_disease',
  hiv: 'infectious_disease', hepatitis: 'infectious_disease',
  retinal: 'ophthalmology',
  psoriasis: 'dermatology',
  asthma: 'respiratory', copd: 'respiratory',
  endometriosis: 'womens_health',
  hemophilia: 'hematology', sickle_cell: 'hematology',
};

export function deriveTA(indicationCategory: string | null | undefined): string | null {
  if (!indicationCategory) return null;
  return INDICATION_CATEGORY_TO_TA[indicationCategory.trim().toLowerCase()] || null;
}
