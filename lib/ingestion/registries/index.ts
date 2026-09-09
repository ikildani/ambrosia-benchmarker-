/**
 * Registry map + shared mapper for non-ClinicalTrials.gov registries
 * (Asset Radar Phase 2 item 5).
 *
 * `ingestRegistryRecords` takes normalized RegistryRecords from any adapter and
 *   (a) bridges them to an existing company_trials row when a secondary id is
 *       an NCT number already ingested from CT.gov (registry_trials.mapped_company_trial_id
 *       is set, no second company_trials row is created);
 *   (b) otherwise resolves the sponsor to a company — sponsor_aliases by
 *       normalized name, then companies.name / name_variations, then a bounded
 *       ilike — creating the company (actively_acquiring=false, hq from
 *       classifyCompanyCountry or the registry's single-country scope) when
 *       nothing matches; CROs never own assets and are skipped;
 *   (c) upserts a company_trials row keyed nct_id='<REGISTRY>:<registry_id>'
 *       with phase/status already in the CHECK vocabularies, registry, lead
 *       sponsor name/class and study_type (columns from migration 106; the
 *       upsert degrades column-by-column if a column is missing);
 *   (d) writes trial_interventions rows when that table exists;
 *   (e) upserts registry_trials (raw store, migration 108) with the mapping outcome.
 *
 * `runRegistrySweep` drives one adapter under a time budget using
 * radar_sync_cursors (source key `registry:<id>`).
 *
 * Sponsor-normalization contract (shared with the CT.gov sweep, see report):
 *   normalizeSponsorName: NFD-strip diacritics, lower-case, '&' → 'and', drop
 *   punctuation, drop legal suffixes (inc, ltd, llc, plc, corp, gmbh, ag, sa,
 *   se, bv, nv, ab, as, oy, spa, srl, kk, co ltd, pty, limited, holdings,
 *   company), collapse whitespace. sponsorLookupKeys additionally yields the
 *   key with a trailing country/region word removed ("merck canada" → "merck")
 *   and the key without "pharma/pharmaceuticals/therapeutics" (only for
 *   fuzzy ilike, never for alias equality).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { classifyCompanyCountry, deriveRegion } from '@/lib/ingestion/company-geography';
import { inferIndicationFromConditions, inferModalityFromIntervention } from '@/lib/ingestion/clinical-trials';
import { normalizeInterventionName } from '@/lib/ingestion/ctgov-sweep';
import { escapeLikePattern } from '@/lib/radar/signal-detection';
import { readSyncCursor, writeSyncCursor } from '@/lib/radar/sync-cursor';
import type { RegistryAdapter, RegistryId, RegistryRecord, SponsorClass } from './types';
import { NotImplementedError, RegistryUnavailableError } from './types';
import { companyTrialKey, isDrugTrial, nctIdsOf, primaryIntervention, uniq } from './shared';

import { ctisAdapter } from './ctis';
import { isrctnAdapter } from './isrctn';
import { anzctrAdapter } from './anzctr';
import { drksAdapter } from './drks';
import { rebecAdapter } from './rebec';
import { pactrAdapter } from './pactr';
import { mytrialAdapter } from './mytrial';
import { irctAdapter } from './irct';
import { healthCanadaAdapter } from './health-canada';
import { mfdsAdapter } from './mfds';
import { jrctAdapter } from './jrct';
import { cdeAdapter } from './cde';
import { chictrAdapter } from './chictr';
import { ctriAdapter } from './ctri';
import { crisAdapter } from './cris';

export { companyTrialKey } from './shared';
export type { RegistryAdapter, RegistryId, RegistryRecord } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyRegistryAdapter = RegistryAdapter<any>;

export const REGISTRY_ADAPTERS: Record<RegistryId, AnyRegistryAdapter> = {
  ctis: ctisAdapter,
  isrctn: isrctnAdapter,
  anzctr: anzctrAdapter,
  drks: drksAdapter,
  rebec: rebecAdapter,
  pactr: pactrAdapter,
  mytrial: mytrialAdapter,
  irct: irctAdapter,
  health_canada: healthCanadaAdapter,
  mfds: mfdsAdapter,
  jrct: jrctAdapter,
  cde: cdeAdapter,
  chictr: chictrAdapter,
  ctri: ctriAdapter,
  cris: crisAdapter,
};

export function getRegistryAdapter(id: string | null | undefined): AnyRegistryAdapter | null {
  if (!id) return null;
  const key = id.toLowerCase().replace(/-/g, '_') as RegistryId;
  return REGISTRY_ADAPTERS[key] ?? null;
}

export function listRegistryAdapters(): AnyRegistryAdapter[] {
  return Object.values(REGISTRY_ADAPTERS);
}

/** Adapters the Vercel cron can run: api/bulk with their required env present. */
export function sweepableAdapters(env: NodeJS.ProcessEnv = process.env): AnyRegistryAdapter[] {
  return listRegistryAdapters().filter(a => a.capability !== 'scrape_required' && (a.requiredEnv ?? []).every(k => !!env[k]));
}

// ─── Sponsor normalization ───────────────────────────────────────────────────

const LEGAL_SUFFIX_RE =
  /\b(incorporated|inc|corporation|corp|company|co|limited|ltd|llc|llp|plc|gmbh|ag|sa|se|sas|sarl|srl|spa|bv|nv|ab|as|asa|oy|oyj|kk|kabushiki kaisha|pty|pte|holdings?|group|the)\b\.?/g;
const COUNTRY_WORD_RE =
  /\b(canada|australia|uk|u k|united kingdom|usa|u s a|us|europe|europa|japan|korea|china|india|deutschland|germany|france|italia|italy|espana|spain|ireland|schweiz|switzerland|nordic|international|global|worldwide)\b/g;
const SECTOR_WORD_RE = /\b(pharmaceuticals?|pharma|therapeutics|biotech(nology)?|biosciences?|biopharma(ceuticals?)?|biologics|oncology|medicines?|laboratories|labs?|healthcare|health)\b/g;

export function normalizeSponsorName(name: string | null | undefined): string {
  if (!name) return '';
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9぀-ヿ㐀-鿿가-힯]+/g, ' ')
    .replace(LEGAL_SUFFIX_RE, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Ordered candidate keys for company lookup: [full normalized, without trailing
 * country/region word, without sector words]. Only the first is used for
 * sponsor_aliases equality; the others feed the bounded ilike fallback.
 */
export function sponsorLookupKeys(name: string | null | undefined): string[] {
  const base = normalizeSponsorName(name);
  if (!base) return [];
  const noCountry = base.replace(COUNTRY_WORD_RE, ' ').replace(/\s+/g, ' ').trim();
  const noSector = noCountry.replace(SECTOR_WORD_RE, ' ').replace(/\s+/g, ' ').trim();
  return uniq([base, noCountry, noSector].filter(k => k.length >= 3));
}

function displayCompanyName(name: string): string {
  const t = name.replace(/\s+/g, ' ').trim();
  if (t !== t.toUpperCase() || t.length < 4) return t.slice(0, 200);
  return t
    .toLowerCase()
    .replace(/(^|[\s\-\/(])([a-z])/g, (_, pre, ch) => pre + ch.toUpperCase())
    .replace(/\b(Inc|Ltd|Llc|Plc|Ag|Sa|Nv|Bv|Ab|Kk)\b/g, m => m.toUpperCase())
    .replace(/\bGmbh\b/g, 'GmbH')
    .slice(0, 200);
}

function ownerTypeFor(cls: SponsorClass): string | null {
  switch (cls) {
    case 'INDUSTRY': return 'industry';
    case 'OTHER': return 'academic';
    case 'OTHER_GOV':
    case 'NIH':
    case 'FED': return 'government';
    case 'INDIV': return 'individual';
    case 'NETWORK': return 'network';
    case 'CRO': return 'cro';
    default: return null;
  }
}

// ─── Column-tolerant writes ──────────────────────────────────────────────────

function missingColumn(message: string | undefined): string | null {
  if (!message) return null;
  const m = /'([A-Za-z_]+)' column/.exec(message) ?? /column "?([A-Za-z_]+)"? (?:of relation .* )?does not exist/.exec(message);
  return m ? m[1] : null;
}

function isMissingRelation(message: string | undefined): boolean {
  return !!message && /relation .* does not exist|Could not find the table|schema cache/i.test(message) && !/column/i.test(message);
}

/**
 * Upsert rows, retrying without any column the database reports as missing
 * (so the code degrades when migration 106 has not been applied yet).
 */
async function upsertTolerant(
  supabase: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[],
  onConflict: string,
  select: string,
  optionalColumns: string[],
): Promise<{ data: Record<string, unknown>[]; error: string | null; droppedColumns: string[] }> {
  let current = rows;
  const dropped: string[] = [];
  for (let attempt = 0; attempt <= optionalColumns.length; attempt++) {
    const { data, error } = await supabase.from(table).upsert(current, { onConflict }).select(select);
    if (!error) return { data: (data ?? []) as unknown as Record<string, unknown>[], error: null, droppedColumns: dropped };
    const col = missingColumn(error.message);
    if (col && optionalColumns.includes(col) && !dropped.includes(col)) {
      dropped.push(col);
      current = current.map(r => {
        const copy = { ...r };
        delete copy[col];
        return copy;
      });
      continue;
    }
    return { data: [], error: error.message, droppedColumns: dropped };
  }
  return { data: [], error: 'upsert retries exhausted', droppedColumns: dropped };
}

// ─── Company resolution ──────────────────────────────────────────────────────

export interface ResolvedCompany {
  id: string;
  name: string;
  created: boolean;
  via: 'alias' | 'name' | 'variation' | 'fuzzy' | 'created';
}

export async function resolveSponsorCompany(
  supabase: SupabaseClient,
  record: RegistryRecord,
  adapter: AnyRegistryAdapter | null,
  cache: Map<string, ResolvedCompany | null>,
): Promise<ResolvedCompany | null> {
  const name = (record.sponsor_name ?? '').replace(/\s+/g, ' ').trim();
  if (!name) return null;
  const keys = sponsorLookupKeys(name);
  if (keys.length === 0) return null;
  const cacheKey = keys[0];
  if (cache.has(cacheKey)) return cache.get(cacheKey) ?? null;

  const remember = (v: ResolvedCompany | null) => {
    cache.set(cacheKey, v);
    return v;
  };

  // (1) sponsor_aliases (migration 106, CT.gov sweep) — tolerate absence.
  try {
    const { data, error } = await supabase
      .from('sponsor_aliases')
      .select('company_id, sponsor_name, relationship')
      .eq('sponsor_name_normalized', cacheKey)
      .limit(1);
    // CROs never own assets (migration 106 contract shared with the CT.gov sweep).
    if (!error && data && data[0]?.company_id && data[0].relationship !== 'cro') {
      return remember({ id: String(data[0].company_id), name: String(data[0].sponsor_name ?? name), created: false, via: 'alias' });
    }
  } catch {
    /* table missing */
  }

  // (2) companies.name case-insensitive equality.
  {
    const { data } = await supabase.from('companies').select('id, name').ilike('name', escapeLikePattern(name)).limit(1);
    if (data && data[0]) return remember({ id: String(data[0].id), name: String(data[0].name), created: false, via: 'name' });
  }

  // (3) name_variations contains the raw sponsor string.
  {
    const { data } = await supabase.from('companies').select('id, name').contains('name_variations', [name]).limit(1);
    if (data && data[0]) return remember({ id: String(data[0].id), name: String(data[0].name), created: false, via: 'variation' });
  }

  // (4) bounded fuzzy: the country-stripped key as a substring, only when distinctive.
  for (const key of keys.slice(1)) {
    if (key.length < 6) continue;
    const { data } = await supabase.from('companies').select('id, name').ilike('name', `%${escapeLikePattern(key)}%`).limit(2);
    if (data && data.length === 1) return remember({ id: String(data[0].id), name: String(data[0].name), created: false, via: 'fuzzy' });
  }

  // (5) create.
  const geo = classifyCompanyCountry(name);
  const scope = adapter?.countryScope ?? [];
  const country = geo.confidence !== 'low' && geo.country !== 'unknown' ? geo.country : scope.length === 1 ? scope[0] : null;
  const display = displayCompanyName(name);
  const row: Record<string, unknown> = {
    name: display,
    name_variations: uniq([name, display]),
    data_sources: [`registry:${record.registry}`],
    actively_acquiring: false,
    hq_country: country,
    hq_region: country ? deriveRegion(country) : null,
    headquarters_country: country,
    headquarters_region: country ? deriveRegion(country) : null,
    owner_type: ownerTypeFor(record.sponsor_type),
  };
  const { data, error } = await upsertTolerant(supabase, 'companies', [row], 'name', 'id, name', ['owner_type', 'headquarters_country', 'headquarters_region', 'hq_region', 'hq_country']);
  if (error || !data[0]) {
    // Someone else may have created it concurrently under the display name.
    const { data: again } = await supabase.from('companies').select('id, name').ilike('name', escapeLikePattern(display)).limit(1);
    if (again && again[0]) return remember({ id: String(again[0].id), name: String(again[0].name), created: false, via: 'name' });
    return remember(null);
  }
  return remember({ id: String(data[0].id), name: String(data[0].name ?? display), created: true, via: 'created' });
}

// ─── Mapper ──────────────────────────────────────────────────────────────────

export interface IngestResult {
  fetched: number;
  /** registry_trials rows written */
  stored: number;
  /** records attached to an existing CT.gov company_trials row */
  bridged: number;
  /** company_trials rows created/updated from registry data */
  mapped: number;
  skipped: number;
  companiesCreated: number;
  errors: string[];
  droppedColumns: string[];
}

export interface IngestOptions {
  adapter?: AnyRegistryAdapter | null;
  companyCache?: Map<string, ResolvedCompany | null>;
}

const CHUNK = 50;

function toRegistryTrialRow(r: RegistryRecord, mapped: { companyTrialId: string | null; status: string }) {
  return {
    registry: r.registry,
    registry_id: r.registry_id,
    secondary_ids: r.secondary_ids,
    title: r.title,
    sponsor_name: r.sponsor_name,
    sponsor_type: r.sponsor_type,
    collaborators: r.collaborators,
    interventions: r.interventions,
    conditions: r.conditions,
    phase_raw: r.phase_raw,
    phase: r.phase,
    status_raw: r.status_raw,
    status: r.status,
    study_type: r.study_type,
    countries: r.countries,
    start_date: r.start_date,
    primary_completion_date: r.primary_completion_date,
    first_registered: r.first_registered,
    last_updated: r.last_updated,
    source_url: r.source_url,
    raw: r.raw ?? null,
    fetched_at: new Date().toISOString(),
    mapped_company_trial_id: mapped.companyTrialId,
    map_status: mapped.status,
  };
}

function toCompanyTrialRow(r: RegistryRecord, company: ResolvedCompany) {
  const primary = primaryIntervention(r.interventions);
  const indication = inferIndicationFromConditions(r.conditions);
  const modality = inferModalityFromIntervention(r.interventions.map(i => ({ name: i.name, type: i.type, description: null })));
  return {
    company_id: company.id,
    company_name: company.name,
    nct_id: companyTrialKey(r.registry, r.registry_id),
    trial_title: r.title,
    intervention_name: primary?.name ?? null,
    intervention_type: primary?.type ? primary.type.toUpperCase() : null,
    modality,
    indication_category: indication.category,
    indication_specific: indication.specific,
    conditions: r.conditions,
    phase: r.phase,
    status: r.status,
    is_collaboration: r.collaborators.length > 0,
    collaborator_names: r.collaborators,
    lead_sponsor_type: r.sponsor_type,
    locations_countries: r.countries,
    start_date: r.start_date,
    primary_completion_date: r.primary_completion_date,
    first_posted_date: r.first_registered,
    last_update_posted: r.last_updated,
    updated_at: new Date().toISOString(),
    // migration 106 columns (dropped automatically if absent)
    registry: r.registry,
    lead_sponsor_name: r.sponsor_name,
    lead_sponsor_class: r.sponsor_type,
    study_type: r.study_type,
  };
}

export async function ingestRegistryRecords(
  supabase: SupabaseClient,
  records: RegistryRecord[],
  opts: IngestOptions = {},
): Promise<IngestResult> {
  const result: IngestResult = { fetched: records.length, stored: 0, bridged: 0, mapped: 0, skipped: 0, companiesCreated: 0, errors: [], droppedColumns: [] };
  if (records.length === 0) return result;
  const adapter = opts.adapter ?? getRegistryAdapter(records[0].registry);
  const cache = opts.companyCache ?? new Map<string, ResolvedCompany | null>();

  // Dedupe within the batch on (registry, registry_id); last wins.
  const byKey = new Map<string, RegistryRecord>();
  for (const r of records) if (r.registry_id) byKey.set(companyTrialKey(r.registry, r.registry_id), r);
  const unique = Array.from(byKey.values());

  // (a) NCT bridge lookup.
  const allNcts = uniq(unique.flatMap(r => nctIdsOf(r.secondary_ids)));
  const nctToCompanyTrial = new Map<string, string>();
  for (let i = 0; i < allNcts.length; i += 200) {
    const { data, error } = await supabase.from('company_trials').select('id, nct_id').in('nct_id', allNcts.slice(i, i + 200));
    if (error) result.errors.push(`company_trials nct lookup: ${error.message}`);
    for (const row of data ?? []) nctToCompanyTrial.set(String(row.nct_id).toUpperCase(), String(row.id));
  }

  const outcome = new Map<string, { companyTrialId: string | null; status: string }>();
  const toMap: Array<{ record: RegistryRecord; company: ResolvedCompany }> = [];

  for (const r of unique) {
    const key = companyTrialKey(r.registry, r.registry_id);
    const bridgeNct = nctIdsOf(r.secondary_ids).find(n => nctToCompanyTrial.has(n));
    if (bridgeNct) {
      outcome.set(key, { companyTrialId: nctToCompanyTrial.get(bridgeNct)!, status: `bridged:${bridgeNct}` });
      result.bridged++;
      continue;
    }
    if (!isDrugTrial(r)) {
      outcome.set(key, { companyTrialId: null, status: 'skipped:not_drug_trial' });
      result.skipped++;
      continue;
    }
    if (!r.sponsor_name) {
      outcome.set(key, { companyTrialId: null, status: 'skipped:no_sponsor' });
      result.skipped++;
      continue;
    }
    if (r.sponsor_type === 'CRO') {
      outcome.set(key, { companyTrialId: null, status: 'skipped:cro_sponsor' });
      result.skipped++;
      continue;
    }
    try {
      const company = await resolveSponsorCompany(supabase, r, adapter, cache);
      if (!company) {
        outcome.set(key, { companyTrialId: null, status: 'skipped:company_unresolved' });
        result.skipped++;
        continue;
      }
      if (company.created) {
        result.companiesCreated++;
        company.created = false; // count once per cache entry
      }
      toMap.push({ record: r, company });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`resolve ${key}: ${msg}`);
      outcome.set(key, { companyTrialId: null, status: 'error:resolve' });
    }
  }

  // (c) company_trials upserts, chunked, column-tolerant.
  const companyTrialIdByKey = new Map<string, string>();
  for (let i = 0; i < toMap.length; i += CHUNK) {
    const chunk = toMap.slice(i, i + CHUNK);
    const rows = chunk.map(({ record, company }) => toCompanyTrialRow(record, company));
    const { data, error, droppedColumns } = await upsertTolerant(
      supabase, 'company_trials', rows, 'company_id,nct_id', 'id, nct_id',
      ['registry', 'lead_sponsor_name', 'lead_sponsor_class', 'study_type', 'why_stopped'],
    );
    for (const c of droppedColumns) if (!result.droppedColumns.includes(c)) result.droppedColumns.push(c);
    if (error) {
      result.errors.push(`company_trials upsert (chunk ${i / CHUNK}): ${error}`);
      for (const { record } of chunk) outcome.set(companyTrialKey(record.registry, record.registry_id), { companyTrialId: null, status: 'error:company_trials' });
      continue;
    }
    for (const row of data) companyTrialIdByKey.set(String(row.nct_id), String(row.id));
    for (const { record } of chunk) {
      const key = companyTrialKey(record.registry, record.registry_id);
      const id = companyTrialIdByKey.get(key) ?? null;
      outcome.set(key, { companyTrialId: id, status: id ? 'mapped' : 'error:no_id' });
      if (id) result.mapped++;
    }
  }

  // (d) trial_interventions (migration 106 schema, shared with the CT.gov
  // sweep): one row per (nct_id, name_normalized), upserted so re-sweeps
  // refresh in place. nct_id here is the registry-prefixed company_trials key.
  const ARM_ROLES = new Set(['experimental', 'active_comparator', 'placebo_comparator', 'sham', 'no_intervention', 'other', 'unknown']);
  const ivRows: Record<string, unknown>[] = [];
  const seenIv = new Set<string>();
  for (const { record, company } of toMap) {
    const key = companyTrialKey(record.registry, record.registry_id);
    if (!companyTrialIdByKey.has(key)) continue;
    const primary = primaryIntervention(record.interventions);
    for (const iv of record.interventions) {
      const nameNormalized = normalizeInterventionName(iv.name);
      if (!nameNormalized) continue;
      const dedupe = `${key}\u0000${nameNormalized}`;
      if (seenIv.has(dedupe)) continue;
      seenIv.add(dedupe);
      const role = String(iv.role ?? 'unknown').toLowerCase();
      ivRows.push({
        nct_id: key,
        company_id: company?.id ?? null,
        name: iv.name,
        name_normalized: nameNormalized,
        intervention_type: iv.type ?? null,
        arm_role: ARM_ROLES.has(role) ? role : 'unknown',
        is_primary_asset: iv === primary,
        updated_at: new Date().toISOString(),
      });
    }
  }
  if (ivRows.length > 0) {
    try {
      for (let i = 0; i < ivRows.length; i += 200) {
        const { error } = await supabase
          .from('trial_interventions')
          .upsert(ivRows.slice(i, i + 200), { onConflict: 'nct_id,name_normalized' });
        if (error && isMissingRelation(error.message)) break; /* table not there yet */
        if (error) {
          result.errors.push(`trial_interventions upsert: ${error.message}`);
          break;
        }
      }
    } catch (err) {
      result.errors.push(`trial_interventions: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // (e) registry_trials raw store with the mapping outcome.
  for (let i = 0; i < unique.length; i += CHUNK) {
    const chunk = unique.slice(i, i + CHUNK);
    const rows = chunk.map(r => toRegistryTrialRow(r, outcome.get(companyTrialKey(r.registry, r.registry_id)) ?? { companyTrialId: null, status: 'unmapped' }));
    const { data, error, droppedColumns } = await upsertTolerant(supabase, 'registry_trials', rows, 'registry,registry_id', 'id', ['map_status', 'study_type', 'mapped_company_trial_id']);
    for (const c of droppedColumns) if (!result.droppedColumns.includes(c)) result.droppedColumns.push(c);
    if (error) result.errors.push(`registry_trials upsert (chunk ${i / CHUNK}): ${error}`);
    else result.stored += data.length || chunk.length;
  }

  return result;
}

// ─── Sweep runner ────────────────────────────────────────────────────────────

export interface SweepOptions {
  budgetMs: number;
  limit?: number;
  since?: string;
  maxPages?: number;
  signal?: AbortSignal;
}

export interface SweepResult extends IngestResult {
  registry: RegistryId;
  pages: number;
  done: boolean;
  cursor: string | null;
  warnings: string[];
  /** Set when the adapter could not run at all (missing env, scrape_required). */
  unavailable?: string;
  timedOut: boolean;
}

interface SweepState extends Record<string, unknown> {
  last_completed_at?: string;
  last_result?: Partial<SweepResult>;
}

export function cursorSource(registry: RegistryId): string {
  return `registry:${registry}`;
}

export async function runRegistrySweep(
  supabase: SupabaseClient,
  adapter: AnyRegistryAdapter,
  opts: SweepOptions,
): Promise<SweepResult> {
  const started = Date.now();
  const source = cursorSource(adapter.registry);
  const result: SweepResult = {
    registry: adapter.registry, pages: 0, done: false, cursor: null, warnings: [], timedOut: false,
    fetched: 0, stored: 0, bridged: 0, mapped: 0, skipped: 0, companiesCreated: 0, errors: [], droppedColumns: [],
  };

  let cursorRow;
  try {
    cursorRow = await readSyncCursor<SweepState>(supabase, source);
  } catch (err) {
    result.errors.push(err instanceof Error ? err.message : String(err));
    return result;
  }
  let cursor = cursorRow.cursor;
  const state: SweepState = { ...cursorRow.state };
  // Incremental adapters use `since` when starting a fresh sweep.
  const since = opts.since ?? (cursor ? undefined : state.last_completed_at ? state.last_completed_at.slice(0, 10) : undefined);
  const cache = new Map<string, ResolvedCompany | null>();
  const maxPages = opts.maxPages ?? 1000;

  while (result.pages < maxPages) {
    if (Date.now() - started > opts.budgetMs) {
      result.timedOut = true;
      break;
    }
    let page;
    try {
      page = await adapter.fetchPage(cursor, { since, limit: opts.limit, signal: opts.signal });
    } catch (err) {
      if (err instanceof NotImplementedError || err instanceof RegistryUnavailableError) {
        result.unavailable = err.message;
      } else {
        result.errors.push(`fetchPage: ${err instanceof Error ? err.message : String(err)}`);
      }
      break;
    }
    result.pages++;
    result.warnings.push(...(page.warnings ?? []).slice(0, 20));
    if (page.records.length > 0) {
      const ingest = await ingestRegistryRecords(supabase, page.records, { adapter, companyCache: cache });
      result.fetched += ingest.fetched;
      result.stored += ingest.stored;
      result.bridged += ingest.bridged;
      result.mapped += ingest.mapped;
      result.skipped += ingest.skipped;
      result.companiesCreated += ingest.companiesCreated;
      result.errors.push(...ingest.errors);
      for (const c of ingest.droppedColumns) if (!result.droppedColumns.includes(c)) result.droppedColumns.push(c);
    }
    cursor = page.nextCursor;
    if (page.done) {
      result.done = true;
      break;
    }
  }

  result.cursor = cursor;
  if (result.done) state.last_completed_at = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // one-day overlap
  state.last_result = {
    pages: result.pages, fetched: result.fetched, stored: result.stored, bridged: result.bridged, mapped: result.mapped,
    skipped: result.skipped, done: result.done, timedOut: result.timedOut, unavailable: result.unavailable,
    errors: result.errors.slice(0, 5),
  };
  if (!result.unavailable) {
    try {
      await writeSyncCursor(supabase, source, cursor, state);
    } catch (err) {
      result.errors.push(err instanceof Error ? err.message : String(err));
    }
  }
  return result;
}
