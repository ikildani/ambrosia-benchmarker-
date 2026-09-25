/**
 * Deal Intelligence Brief v3 — Terrain demand-layer client.
 *
 * Terrain (terrain.ambrosiaventures.co) is the demand layer of the Alaric
 * outcomes program. It serves one demand profile per indication at
 * `GET /api/v1/demand/<solidus-slug>?territory=<code>` behind an API key with
 * the `demand` scope. This client is the only place Solidus talks to it.
 *
 * Program rule (docs/demand-layer.md §6 in the Terrain repo): Solidus calls by
 * its own indication slug, reads the profile at build time, and persists
 * nothing from it except the slug and the profile's `asOf`. Every number is
 * re-read from Terrain when a brief is built; nothing here writes to a store.
 *
 * Behaviour
 *  - Never throws. Any failure (no key, non-2xx, timeout, bad JSON) yields
 *    `null` and one `[Brief] terrain demand unavailable: <reason>` warning per
 *    slug per process, so a Terrain outage degrades the brief to the local
 *    epidemiology model without noise in the logs.
 *  - Successful profiles are memoised for ten minutes per (slug, territory);
 *    a 404 ("no Terrain counterpart") is memoised as null for the same window
 *    because the registry does not change between deploys.
 *  - Requests abort after four seconds (Terrain's own route caches for 1 h, so
 *    a healthy call returns in well under one).
 *
 * The `TerrainDemandProfile` type below mirrors the subset of Terrain's
 * `DemandProfile` (src/lib/demand/demand-layer.ts) that the brief consumes.
 * It is copied, not imported: the repos do not share code and a contract
 * bump on the Terrain side must be a visible change here.
 */

// ─── Types (subset of Terrain's DemandProfile, contract 1.0) ───────────────

export interface TerrainIdentity {
  terrainName: string;
  /** Canonical Solidus slug; null when Solidus has no key for the indication. */
  solidusKey: string | null;
  therapyArea: string;
  /** `proxy` means Terrain covers a subset/superset of the Solidus key — show `matchNote` beside any figure. */
  match: 'exact' | 'proxy' | null;
  matchNote?: string;
}

export interface TerrainEpidemiology {
  /** Always US in Terrain; territory changes the market breakdown, not the patient counts. */
  population: 'US';
  prevalence: number;
  incidence: number;
  diagnosisRate: number;
  treatmentRate: number;
  diagnosed: number;
  treated: number;
  confidence: string;
  verifiedYear: number;
  source: string;
}

/** Terrain market-sizing engine funnel (US patients). */
export interface TerrainPatientFunnel {
  us_prevalence: number;
  us_incidence: number;
  diagnosed: number;
  diagnosed_rate: number;
  treated: number;
  treated_rate: number;
  adherent: number;
  adherence_rate: number;
  addressable: number;
  addressable_rate: number;
  capturable: number;
  /** Peak share of addressable patients at the assumed stage, 0..1. */
  capturable_rate: number;
}

export interface TerrainMarket {
  territory: { requested: string; geographies: string[] };
  currency: 'USD';
  territoryBreakdown: Array<{ code: string; territory: string; tamUsd: number; population: number; marketMultiplier: number }>;
  /** Peak annual US sales for one asset at the assumed stage, USD millions. */
  peakSalesUsdM: { low: number; base: number; high: number };
  priceBenchmark: {
    /** Annual WAC bands, USD. */
    wacAnnualUsd: { conservative: number; base: number; premium: number };
    /** 0..1 gross-to-net discount the engine applied. */
    grossToNet: number;
    comparableCount: number;
    rationale: string;
  };
  patientFunnel: TerrainPatientFunnel;
  engineInputs: { developmentStage: string; pricingAssumption: string; launchYear: number };
}

export type TerrainProgramPhase =
  | 'Approved' | 'Phase 3' | 'Phase 2/3' | 'Phase 2' | 'Phase 1/2' | 'Phase 1' | 'Preclinical' | 'Withdrawn' | 'Discontinued' | string;

export interface TerrainKeyProgram {
  company: string;
  asset: string;
  mechanism: string;
  phase: TerrainProgramPhase;
  differentiationScore: number;
  evidenceStrength: number;
  source: string;
}

export interface TerrainCompetition {
  /** 1..10 crowding score from Terrain's competitive engine. */
  densityScore: number;
  densityLabel: string;
  countsByPhase: { approved: number; phase3: number; phase2: number; phase1: number; preclinical: number; withdrawnOrDiscontinued: number; total: number };
  /** Up to ten programs, Approved → Phase 3 → … then by differentiation. */
  keyPrograms: TerrainKeyProgram[];
  whiteSpace: string[];
  keyInsight: string;
}

export interface TerrainDemandProfile {
  identity: TerrainIdentity;
  epidemiology: TerrainEpidemiology;
  market: TerrainMarket;
  competition: TerrainCompetition;
  /** Every default Terrain applied (stage, pricing, launch year, proxy mapping …). */
  assumptions: string[];
  /** ISO date of the Terrain snapshot. The only value Solidus persists beside the slug. */
  asOf: string;
  generatedAt: string;
  contractVersion: string;
}

export interface FetchDemandProfileOptions {
  /** Solidus territory code (`us_only`, `global`, `europe` …) or Terrain code (`US`, `EU5` …). Terrain defaults to US. */
  territory?: string | null;
  signal?: AbortSignal;
}

export interface DemandProfileResult {
  profile: TerrainDemandProfile;
  /** Convenience copy of `profile.asOf` — the value to persist with the slug. */
  asOf: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────

/** Source label printed under any brief visual built from a Terrain profile. */
export const TERRAIN_DEMAND_SOURCE = 'Terrain demand layer';

export const TERRAIN_DEFAULT_URL = 'https://terrain.ambrosiaventures.co';
export const TERRAIN_DEMAND_CACHE_TTL_MS = 10 * 60 * 1000;
export const TERRAIN_DEMAND_TIMEOUT_MS = 4_000;
export const TERRAIN_CONTRACT_VERSION = '1.0';

// ─── Cache + log-once state (per process) ──────────────────────────────────

interface CacheEntry { expiresAt: number; result: DemandProfileResult | null }

const cache = new Map<string, CacheEntry>();
const warned = new Set<string>();

/** Clear the profile cache and the log-once set (tests). */
export function clearTerrainDemandCache(): void {
  cache.clear();
  warned.clear();
}

function warnOnce(slug: string, reason: string): void {
  if (warned.has(slug)) return;
  warned.add(slug);
  console.warn(`[Brief] terrain demand unavailable: ${reason}`);
}

function baseUrl(): string {
  const raw = (process.env.TERRAIN_API_URL ?? '').trim();
  return (raw || TERRAIN_DEFAULT_URL).replace(/\/+$/, '');
}

function cacheKey(slug: string, territory: string | null | undefined): string {
  return `${slug.toLowerCase()}|${(territory ?? '').toLowerCase()}`;
}

// ─── Validation ────────────────────────────────────────────────────────────

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/** Shape check on the fields the brief reads; anything else passes through untouched. */
function looksLikeProfile(v: unknown): v is TerrainDemandProfile {
  if (!v || typeof v !== 'object') return false;
  const p = v as Record<string, unknown>;
  if (typeof p.asOf !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(p.asOf)) return false;
  const identity = p.identity as Record<string, unknown> | undefined;
  const market = p.market as Record<string, unknown> | undefined;
  const competition = p.competition as Record<string, unknown> | undefined;
  if (!identity || typeof identity.terrainName !== 'string') return false;
  if (!market || !market.patientFunnel || typeof market.patientFunnel !== 'object') return false;
  if (!market.peakSalesUsdM || typeof market.peakSalesUsdM !== 'object') return false;
  if (!competition || typeof competition !== 'object') return false;
  return true;
}

// ─── Fetch ─────────────────────────────────────────────────────────────────

/**
 * Read the Terrain demand profile for a Solidus indication slug.
 * Returns `{ profile, asOf }` or `null`; never throws.
 */
export async function fetchDemandProfile(
  slug: string,
  opts: FetchDemandProfileOptions = {},
): Promise<DemandProfileResult | null> {
  const key = (slug ?? '').trim();
  if (!key) return null;

  const territory = (opts.territory ?? '').trim() || null;
  const ck = cacheKey(key, territory);
  const hit = cache.get(ck);
  if (hit && hit.expiresAt > Date.now()) return hit.result;

  const apiKey = (process.env.TERRAIN_API_KEY ?? '').trim();
  if (!apiKey) {
    warnOnce(key, 'TERRAIN_API_KEY is not set');
    return null;
  }

  const url = new URL(`${baseUrl()}/api/v1/demand/${encodeURIComponent(key)}`);
  if (territory) url.searchParams.set('territory', territory);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TERRAIN_DEMAND_TIMEOUT_MS);
  const onOuterAbort = () => controller.abort();
  if (opts.signal) {
    if (opts.signal.aborted) controller.abort();
    else opts.signal.addEventListener('abort', onOuterAbort, { once: true });
  }

  try {
    let res: Response;
    try {
      res = await fetch(url.toString(), {
        method: 'GET',
        headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
        signal: controller.signal,
        cache: 'no-store',
      });
    } catch (err) {
      const aborted = controller.signal.aborted || (err instanceof Error && err.name === 'AbortError');
      warnOnce(key, aborted
        ? `timeout after ${TERRAIN_DEMAND_TIMEOUT_MS} ms (${url.pathname})`
        : `network error ${err instanceof Error ? err.message : String(err)} (${url.pathname})`);
      return null;
    }

    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    const errMsg = body && typeof body === 'object' && typeof (body as { error?: unknown }).error === 'string'
      ? (body as { error: string }).error
      : '';

    if (res.status === 404) {
      // No Terrain counterpart for this slug: deterministic, so cache the miss.
      cache.set(ck, { expiresAt: Date.now() + TERRAIN_DEMAND_CACHE_TTL_MS, result: null });
      warnOnce(key, `no Terrain counterpart for "${key}"${errMsg ? ` (${errMsg})` : ''}`);
      return null;
    }
    if (!res.ok) {
      const why = res.status === 401 ? 'invalid or missing API key'
        : res.status === 403 ? 'API key lacks the demand scope'
        : res.status === 429 ? 'rate limited'
        : res.status === 400 ? `bad request${errMsg ? `: ${errMsg}` : ''}`
        : `HTTP ${res.status}${errMsg ? `: ${errMsg}` : ''}`;
      warnOnce(key, `${why} (${url.pathname})`);
      return null;
    }

    const data = body && typeof body === 'object' && (body as { success?: unknown }).success === true
      ? (body as { data?: unknown }).data
      : null;
    if (!looksLikeProfile(data)) {
      warnOnce(key, `unexpected response shape (${url.pathname})`);
      return null;
    }
    if (data.contractVersion && data.contractVersion !== TERRAIN_CONTRACT_VERSION) {
      // Still usable while the fields we read exist; make the drift visible once.
      warnOnce(`${key}#contract`, `contract ${data.contractVersion} differs from expected ${TERRAIN_CONTRACT_VERSION}; fields validated individually`);
    }

    const result: DemandProfileResult = { profile: data, asOf: data.asOf };
    cache.set(ck, { expiresAt: Date.now() + TERRAIN_DEMAND_CACHE_TTL_MS, result });
    return result;
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onOuterAbort);
  }
}

// ─── Small helpers used by the landscape builders ──────────────────────────

/** The Solidus slug a profile answers for (falls back to the Terrain name when Solidus has no key). */
export function profileSlug(profile: TerrainDemandProfile): string {
  return profile.identity.solidusKey ?? profile.identity.terrainName;
}

/** Net price per patient-year implied by Terrain's own price benchmark (base WAC net of the engine's gross-to-net). */
export function netPricePerYearUsd(profile: TerrainDemandProfile): number | null {
  const wac = profile.market.priceBenchmark?.wacAnnualUsd?.base;
  const gtn = profile.market.priceBenchmark?.grossToNet;
  if (!isFiniteNumber(wac) || wac <= 0) return null;
  const net = isFiniteNumber(gtn) && gtn >= 0 && gtn < 1 ? wac * (1 - gtn) : wac;
  return Math.round(net);
}

/** Terrain density score (1..10) on the brief's 0–100 crowding scale. */
export function densityToCrowding(profile: TerrainDemandProfile): number | null {
  const d = profile.competition?.densityScore;
  if (!isFiniteNumber(d)) return null;
  return Math.max(0, Math.min(100, Math.round(d * 10)));
}
