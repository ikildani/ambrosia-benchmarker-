/**
 * Adapter contract for non-ClinicalTrials.gov trial registries
 * (Asset Radar Phase 2 item 5, docs/asset-radar-gap-register.md).
 *
 * Every registry adapter under lib/ingestion/registries/ implements
 * `RegistryAdapter`. The cron route (app/api/cron/registry-sweep) pages
 * through `fetchPage`, persisting the opaque `cursor` in radar_sync_cursors
 * under the source key `registry:<id>`, and hands the normalized
 * `RegistryRecord`s to the shared mapper in ./index.ts, which writes
 * registry_trials (raw store, migration 108) and company_trials.
 *
 * Capability semantics
 *   'api'              a JSON/XML/SOAP endpoint or server-rendered HTML that a
 *                      plain `fetch` from Vercel can read.
 *   'bulk'             a whole-registry export downloaded per run.
 *   'scrape_required'  needs a browser (JS challenge, ASP.NET postback,
 *                      captcha) or a non-US egress. `fetchPage` throws
 *                      NotImplementedError; the adapter still ships the URL
 *                      patterns and `mapRecord` so an off-Vercel Playwright
 *                      worker can POST scraped pages into the same mapper.
 */

export type RegistryId =
  | 'ctis'
  | 'isrctn'
  | 'anzctr'
  | 'drks'
  | 'rebec'
  | 'pactr'
  | 'mytrial'
  | 'irct'
  | 'health_canada'
  | 'mfds'
  | 'jrct'
  | 'cde'
  | 'chictr'
  | 'ctri'
  | 'cris';

export type RegistryCapability = 'api' | 'bulk' | 'scrape_required';

/** How the adapter reads the registry; informational, used for reporting. */
export type RegistryTransport = 'json' | 'xml' | 'soap' | 'html' | 'none';

/** Result of the endpoint verification done while building the adapter. */
export type RegistryVerification = 'verified' | 'partial' | 'unverified';

/** Values match company_trials.phase CHECK (migration 002). */
export type CompanyTrialPhase =
  | 'early_phase_1'
  | 'phase_1'
  | 'phase_1_2'
  | 'phase_2'
  | 'phase_2_3'
  | 'phase_3'
  | 'phase_4'
  | 'not_applicable'
  | 'unknown';

/** Values match company_trials.status CHECK (migration 002). */
export type CompanyTrialStatus =
  | 'not_yet_recruiting'
  | 'recruiting'
  | 'enrolling_by_invitation'
  | 'active_not_recruiting'
  | 'suspended'
  | 'terminated'
  | 'completed'
  | 'withdrawn'
  | 'unknown';

/**
 * CT.gov-style lead sponsor class so ex-US rows line up with
 * company_trials.lead_sponsor_class written by the CT.gov sweep.
 * 'CRO' is an extension: contract research organisations never own assets.
 */
export type SponsorClass =
  | 'INDUSTRY'
  | 'OTHER'
  | 'OTHER_GOV'
  | 'NIH'
  | 'FED'
  | 'INDIV'
  | 'NETWORK'
  | 'CRO'
  | 'UNKNOWN';

export type InterventionRole = 'experimental' | 'comparator' | 'background' | 'placebo' | 'unknown';

export interface RegistryIntervention {
  name: string;
  /** Free text from the registry, lower-cased: drug, biological, device, behavioural, ... */
  type: string;
  role: InterventionRole;
}

/** Normalized shape shared by every adapter; mirrors registry_trials. */
export interface RegistryRecord {
  registry: RegistryId;
  /** Native id without the registry prefix ('12345678' for ISRCTN12345678, '2024-512345-12-00' for CTIS). */
  registry_id: string;
  /** Cross-registry ids: NCT, EUCT/EudraCT, ISRCTN, UTN, sponsor protocol codes. */
  secondary_ids: string[];
  title: string | null;
  sponsor_name: string | null;
  sponsor_type: SponsorClass;
  collaborators: string[];
  interventions: RegistryIntervention[];
  conditions: string[];
  phase_raw: string | null;
  phase: CompanyTrialPhase;
  status_raw: string | null;
  status: CompanyTrialStatus;
  /** interventional | observational | expanded_access | unknown */
  study_type: string | null;
  /** ISO 3166-1 alpha-2. */
  countries: string[];
  start_date: string | null;
  primary_completion_date: string | null;
  first_registered: string | null;
  last_updated: string | null;
  source_url: string;
  /** Registry-native payload, stored verbatim in registry_trials.raw. */
  raw: unknown;
}

export interface FetchPageOptions {
  /** ISO date; adapters that support incremental reads only return records changed on/after it. */
  since?: string;
  /** Soft cap on records per page (adapters may return fewer). */
  limit?: number;
  signal?: AbortSignal;
}

export interface FetchPageResult {
  records: RegistryRecord[];
  /** Opaque; persisted in radar_sync_cursors.cursor. null means "start over next time". */
  nextCursor: string | null;
  /** true when the adapter has reached the present / end of the registry for this sweep. */
  done: boolean;
  /** Non-fatal problems encountered while building this page. */
  warnings?: string[];
}

export interface RegistryUrlPatterns {
  /** Human search UI, for documentation and the scraper worker. */
  search?: string;
  /** Canonical public page for one trial. */
  detail: (registryId: string) => string;
}

export interface RegistryAdapter<Raw = unknown> {
  registry: RegistryId;
  displayName: string;
  /** ISO 3166-1 alpha-2 codes the registry is primary for. */
  countryScope: string[];
  /** Licence / terms under which the data is redistributed. */
  license: string;
  capability: RegistryCapability;
  transport: RegistryTransport;
  verified: RegistryVerification;
  /** Minimum delay between two requests to the registry. */
  rateLimitMs: number;
  /** Environment variables that must be present for fetchPage to run. */
  requiredEnv?: string[];
  /** Default page size when opts.limit is not given. */
  defaultLimit: number;
  /** Rough count of trials the adapter can reach (all study types). */
  estimatedReach: number;
  urls: RegistryUrlPatterns;
  fetchPage(cursor: string | null, opts: FetchPageOptions): Promise<FetchPageResult>;
  mapRecord(raw: Raw): RegistryRecord;
}

/** Thrown by scrape_required adapters; the sweep records it and moves on. */
export class NotImplementedError extends Error {
  readonly registry: RegistryId;
  readonly reason: string;
  constructor(registry: RegistryId, reason: string) {
    super(`${registry}: fetchPage not implemented on Vercel (${reason})`);
    this.name = 'NotImplementedError';
    this.registry = registry;
    this.reason = reason;
  }
}

/** Thrown when an adapter cannot run in this environment (missing API key, auth refused). */
export class RegistryUnavailableError extends Error {
  readonly registry: RegistryId;
  constructor(registry: RegistryId, reason: string) {
    super(`${registry}: unavailable (${reason})`);
    this.name = 'RegistryUnavailableError';
    this.registry = registry;
  }
}

/**
 * Page shape produced by the off-Vercel scraper worker for scrape_required
 * registries: the trial's label → value table plus the page url. Adapters map
 * it with the same label names documented in their header comment.
 */
export interface ScrapedPage {
  id: string;
  url: string;
  fields: Record<string, string | string[] | undefined>;
  fetchedAt?: string;
  html?: string;
}
