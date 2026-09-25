/**
 * Shared entity graph — public types.
 *
 * Canonical identifiers (docs/alaric-outcomes-program.md, Sequencing §3):
 *   company → companies.id
 *   asset   → drug_master.id
 *   deal    → deals.id
 *
 * Terrain and Augur store these ids and resolve through
 * POST /api/entities/resolve; they never keep their own name strings as keys.
 */

export type EntityKind = 'company' | 'asset' | 'deal';

/** 'merged': the id given was a duplicate row folded into the canonical one returned (companies.merged_into). */
export type MatchedOn = 'id' | 'exact' | 'alias' | 'fuzzy' | 'merged';

export interface CompanyMeta {
  companyType: string | null;
  ownerType: string | null;
  hqCountry: string | null;
  hqRegion: string | null;
  ticker: string | null;
  cik: string | null;
  dataQualityScore: number | null;
  /** Other companies rows whose normalised name equals this one's; for the merge job. */
  duplicateIds: string[];
}

export interface AssetMeta {
  inn: string | null;
  unii: string | null;
  chemblId: string | null;
  modality: string | null;
  target: string | null;
  maxPhase: string | null;
  originatorCompanyId: string | null;
  isCombination: boolean;
  /** drug_master.confidence (0–100) of the resolution that created the row. */
  sourceConfidence: number | null;
}

export interface DealMeta {
  licensorId: string | null;
  licensorName: string | null;
  licenseeId: string | null;
  licenseeName: string | null;
  assetName: string | null;
  announcedDate: string | null;
  dealType: string | null;
  phaseAtSigning: string | null;
  upfrontM: number | null;
  totalM: number | null;
}

export type EntityMeta = CompanyMeta | AssetMeta | DealMeta;

export interface EntityRef<M extends EntityMeta = EntityMeta> {
  kind: EntityKind;
  /** The canonical id (companies.id / drug_master.id / deals.id). */
  id: string;
  canonicalName: string;
  /** 0–1. id = 1, exact = 0.98, alias = 0.95, fuzzy = the similarity score. */
  confidence: number;
  matchedOn: MatchedOn;
  aliases: string[];
  meta: M;
}

export type CompanyRef = EntityRef<CompanyMeta>;
export type AssetRef = EntityRef<AssetMeta>;
export type DealRef = EntityRef<DealMeta>;

/** A near miss below the fuzzy threshold: enough to pick from, never auto-used. */
export interface EntityCandidate {
  kind: EntityKind;
  id: string;
  canonicalName: string;
  /** Similarity in [0, 1). */
  score: number;
}

// ─── Queries ────────────────────────────────────────────────────────────────

export interface CompanyQuery {
  name?: string;
  id?: string;
  ticker?: string;
  cik?: string;
}

export interface AssetQuery {
  name?: string;
  id?: string;
  inn?: string;
  unii?: string;
  chembl_id?: string;
}

export interface DealQuery {
  id?: string;
  licensor?: string;
  licensee?: string;
  /** ISO date (YYYY-MM-DD). Exact date scores highest; ±45 days still counts. */
  announced_date?: string;
}

export type ResolveItem =
  | ({ kind: 'company' } & CompanyQuery)
  | ({ kind: 'asset' } & AssetQuery)
  | ({ kind: 'deal' } & DealQuery);

/** Result of one resolve call: a match, or null plus the near misses. */
export interface ResolveResult<M extends EntityMeta = EntityMeta> {
  match: EntityRef<M> | null;
  candidates: EntityCandidate[];
}

// ─── HTTP contract ──────────────────────────────────────────────────────────

/** Maximum items in one POST /api/entities/resolve call. */
export const RESOLVE_BATCH_MAX = 50;

export interface ResolveRequest {
  items: ResolveItem[];
}

export interface ResolveResponse {
  /** Same order as the request; null when nothing cleared the threshold. */
  results: Array<EntityRef | null>;
  /** Same order as the request; near misses for each item (empty when matched by id/exact). */
  candidates: EntityCandidate[][];
}

/** GET /api/entities/company/:id */
export interface CompanyLookup {
  kind: 'company';
  id: string;
  name: string;
  aliases: string[];
  hq: { country: string | null; region: string | null };
  type: string | null;
  ownerType: string | null;
  ids: { ticker: string | null; cik: string | null; website: string | null };
  dataQualityScore: number | null;
  duplicateIds: string[];
}

/** GET /api/entities/asset/:id */
export interface AssetLookup {
  kind: 'asset';
  id: string;
  preferredName: string;
  inn: string | null;
  aliases: string[];
  modality: string | null;
  target: string | null;
  mechanism: string | null;
  maxPhase: string | null;
  isCombination: boolean;
  componentDrugIds: string[];
  originatorCompanyId: string | null;
  ids: { unii: string | null; chemblId: string | null; drugbankId: string | null; casNumber: string | null; pubchemCid: number | null };
  owners: Array<{ companyId: string; role: string | null; territory: string | null }>;
}

/** GET /api/entities/deal/:id */
export interface DealLookup {
  kind: 'deal';
  id: string;
  parties: {
    licensor: { id: string | null; name: string };
    licensee: { id: string | null; name: string };
  };
  asset: { id: string | null; name: string | null };
  announcedDate: string | null;
  dealType: string | null;
  phaseAtSigning: string | null;
  therapeuticArea: string | null;
  indication: string | null;
  /** All money in $M. */
  terms: {
    upfrontM: number | null;
    milestonesM: number | null;
    totalM: number | null;
    royaltyLowPct: number | null;
    royaltyHighPct: number | null;
    termsDisclosed: boolean | null;
  };
  sourceUrl: string | null;
  verificationStatus: string | null;
}

export type EntityLookup = CompanyLookup | AssetLookup | DealLookup;
