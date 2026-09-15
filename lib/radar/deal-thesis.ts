/**
 * Asset Radar — Layer 3: Deal Thesis Generator (full industry pool)
 *
 * Every industry-owned, unpartnered / partially-partnered clinical asset
 * (early phase 1 .. phase 3; phase 4 only when unpartnered; confidence >= 20)
 * gets a thesis row in radar_deal_theses. The queue is served by the
 * `radar_thesis_queue` RPC (migration 116): never-generated assets first,
 * then theses older than `refreshDays`, then assets that changed after their
 * thesis was written. Each run is time-boxed and picks up where the previous
 * one stopped, so the backlog drains across runs.
 *
 * Comps come from the SAME server path the calculator uses
 * (`findEnrichedComparableDeals`): canonical/verified/terms-disclosed rows,
 * the shared weight table, stage sanity filter and relaxation ladder. Radar
 * and the calculator therefore agree on the comp set for a given asset. The
 * comps engine is the cost, so pools are computed once per distinct
 * (TA, modality, phase, indication) profile per run and shared by every
 * asset with that profile.
 *
 * Honesty contract per row: comp_count, verified_comp_count, comp_relaxation,
 * terms_basis, insufficient_comps (no numbers below the 5-comp floor),
 * comp_dispersion, thesis_confidence, comp_deal_ids (every id used), plus the
 * calculator's own headline for the same profile (calculator_upfront_mid /
 * calculator_total_mid) so the UI can show "comps median vs model headline"
 * and the two never silently disagree.
 *
 * Run: /api/cron/deal-thesis (see vercel.json for the schedule)
 * Depends on: asset-universe, licensing-signals, partnership-refresh
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { findEnrichedComparableDeals, type EnrichedComparableDeal } from '@/lib/comparableDeals.server';
import { computeCompStats, MIN_POOL_BEFORE_RELAX, type CompRelaxation } from '@/lib/comparable-scoring';
import { indicationMatches, modalityKey, phaseKey } from '@/lib/comparables/match-normalize';
import {
  calculateDealTerms,
  type CalculationInput,
  type Indication,
  type Modality,
  type Phase,
  type TherapeuticArea,
} from '@/lib/calculations';
import { findPartnerMatches, type MatchInput, type PartnerMatch } from '@/lib/services/partner-matching';
import staticBenchmarks from '@/data/benchmarks.json';
import { logRadarRun, deriveRunStatus } from './run-log';

// ═══════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════

/** One comparable transaction as Radar consumes it ($M, never raw USD). */
export interface DealComp {
  id: string;
  licensor_name: string;
  licensee_name: string;
  asset_name: string | null;
  therapeutic_area: string | null;
  modality: string | null;
  phase_at_signing: string | null;
  /** $M */
  upfront_m: number | null;
  /** $M */
  total_deal_value_m: number | null;
  /** Midpoint of royalty_low_pct / royalty_high_pct, % */
  royalty_pct: number | null;
  royalty_low_pct: number | null;
  royalty_high_pct: number | null;
  /** $M */
  milestones_m: number | null;
  territory: string | null;
  announced_date: string | null;
  year: number;
  deal_type: string | null;
  verification_status: string | null;
  /** 0–1 from the shared scorer */
  match_score: number;
  relevance_reasons: string[];
}

export interface ComparableSet {
  comps: DealComp[];
  relaxation: CompRelaxation;
  excludedApprovedMA: number;
}

export type TermsBasis = 'phase_matched' | 'ta_modality' | 'ta_only' | 'insufficient';
export type AcquirerMethod = 'partner_matching' | 'licensee_frequency' | 'none';

export interface LikelyAcquirer {
  name: string;
  /** Deals in the comp pool (licensee_frequency) or deals in the last 24 months (partner_matching). */
  dealCount: number;
  /** $M */
  avgUpfront: number | null;
  reason: string;
  companyId?: string | null;
  /** 0–100 partner-matching score; absent for licensee_frequency. */
  matchScore?: number;
}

/** The calculator vocabulary a headline was computed with, or why it was skipped. */
export type CalculatorInputsRecord =
  | {
      therapeuticArea: TherapeuticArea;
      phase: Phase;
      modality: Modality;
      indication: Indication;
      /** False when no calculator indication matched and the TA-neutral one was used. */
      indication_matched: boolean;
      regulatoryDesignations: CalculationInput['regulatoryDesignations'];
    }
  | { skipped: 'ta_missing' | 'ta_unsupported' | 'phase_unmapped' | 'modality_missing' | 'modality_unmapped' | 'engine_error'; detail?: string };

export interface CalculatorHeadline {
  /** $M */
  upfrontMid: number | null;
  /** $M */
  totalMid: number | null;
  inputs: CalculatorInputsRecord;
}

export interface DealThesis {
  assetId: string;
  companyName: string;
  assetName: string;
  therapeuticArea: string | null;
  modality: string | null;
  phase: string | null;

  // Predicted terms ($M / %) — all null when insufficientComps
  predictedUpfrontLow: number | null;
  predictedUpfrontMid: number | null;
  predictedUpfrontHigh: number | null;
  predictedTotalLow: number | null;
  predictedTotalMid: number | null;
  predictedTotalHigh: number | null;
  predictedRoyaltyLow: number | null;
  predictedRoyaltyMid: number | null;
  predictedRoyaltyHigh: number | null;

  // Acquirer predictions
  likelyAcquirers: LikelyAcquirer[];
  acquirerMethod: AcquirerMethod;

  // Comparable transaction basis
  compCount: number;
  verifiedCompCount: number;
  compDealIds: string[];
  /** Which rung of the relaxation ladder produced the pool. */
  compRelaxation: CompRelaxation;
  termsBasis: TermsBasis;
  /** True when the pool is below MIN_COMPS_FOR_TERMS — no terms are predicted. */
  insufficientComps: boolean;
  /** IQR / median of disclosed total values (dispersion of the comp set). */
  compDispersion: number | null;

  // Calculator headline for the same profile (null when unmappable)
  calculatorUpfrontMid: number | null;
  calculatorTotalMid: number | null;
  calculatorInputs: CalculatorInputsRecord | null;

  profileKey: string;

  // Confidence
  thesisConfidence: number;
}

export interface ThesisResult {
  /** Assets pulled from the queue this run. */
  assetsQueued: number;
  /** Rows written (or attempted). */
  assetsProcessed: number;
  /** Rows written for assets that had no thesis before. */
  generated: number;
  /** Rows written for assets that already had a thesis. */
  refreshed: number;
  /** Rows written with predicted terms (pool at or above the floor). */
  thesesWithTerms: number;
  /** Rows persisted as an `insufficient_comps` marker, no terms. */
  insufficientComps: number;
  /** Distinct comp profiles computed this run. */
  profilesCached: number;
  /** Distinct acquirer profiles ranked via partner-matching this run. */
  acquirerProfilesCached: number;
  /** Queue rows still outstanding after this run (null when the count RPC is unavailable). */
  remainingBacklog: number | null;
  durationSeconds: number;
  errors: string[];
  timedOut: boolean;
  /** False when the data_ingestion_log insert failed. */
  logWritten: boolean;
  queueSource: 'rpc' | 'legacy_select';
}

/**
 * Hard floor for predicting terms. Below this many comps the thesis is
 * persisted as an `insufficient_comps` marker with no numbers.
 */
export const MIN_COMPS_FOR_TERMS = Math.max(5, MIN_POOL_BEFORE_RELAX);

/** Max comps pulled from the shared path per profile. */
const MAX_COMPS = 30;

/** Likely acquirers per thesis. */
export const MAX_ACQUIRERS = 8;

export const DEFAULT_RUN_LIMIT = 3000;
export const DEFAULT_REFRESH_DAYS = 30;
export const DEFAULT_MIN_AGE_DAYS = 7;

// ═══════════════════════════════════════════════════════════════════════
// PHASE / MODALITY NORMALIZATION (Radar ↔ deals vocabulary)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Radar assets carry ClinicalTrials.gov spellings ('early_phase1',
 * 'phase1_phase2', 'phase4', 'Phase 2') that the shared normalizers do not
 * know. Map them to the deals-table form first, then hand off to `phaseKey`.
 */
const RADAR_PHASE_TO_DB: Record<string, string> = {
  early_phase1: 'phase_1',
  earlyphase1: 'phase_1',
  phase1: 'phase_1',
  phase_1: 'phase_1',
  phase1_phase2: 'phase_1_2',
  phase1phase2: 'phase_1_2',
  phase1_2: 'phase_1_2',
  phase_1_2: 'phase_1_2',
  phase2: 'phase_2',
  phase_2: 'phase_2',
  phase2_phase3: 'phase_2_3',
  phase2phase3: 'phase_2_3',
  phase2_3: 'phase_2_3',
  phase_2_3: 'phase_2_3',
  phase3: 'phase_3',
  phase_3: 'phase_3',
  phase4: 'approved',
  phase_4: 'approved',
  approved: 'approved',
  marketed: 'approved',
  preclinical: 'preclinical',
  discovery: 'discovery',
  nda_filed: 'nda_filed',
  bla_filed: 'bla_filed',
};

/**
 * Deals-table phase spelling for a Radar/CT.gov phase ('phase_1_2' keeps its
 * half-step so the shared scorer can rate adjacency). Null when unknown.
 */
export function radarPhaseToDb(phase: string | null | undefined): string | null {
  if (!phase) return null;
  // 'Phase 1/Phase 2' → 'phase_1_phase_2' → (no hit) → 'phase1phase2' → 'phase_1_2'
  const c = phase.toLowerCase().trim().replace(/[\s/-]+/g, '_');
  return RADAR_PHASE_TO_DB[c] ?? RADAR_PHASE_TO_DB[c.replace(/_/g, '')] ?? null;
}

/** Collapsed canonical phase key ('phase_2', 'approved', ...) or 'unknown'. */
export function radarPhaseKey(phase: string | null | undefined): string {
  return phaseKey(radarPhaseToDb(phase));
}

/** The asset fields that define a comp / calculator profile. */
export interface ThesisAssetProfile {
  therapeutic_area: string | null;
  modality: string | null;
  phase: string | null;
  indication_category?: string | null;
  indication_specific?: string | null;
  indications_all?: string[] | null;
  regulatory_designations?: string[] | null;
}

/** Inputs for the shared comparable-deals path, derived from a clinical asset. */
export function buildCompInputs(asset: ThesisAssetProfile): { therapeuticArea: string; modality: string; indication: string; phase?: string; dealType: string } | null {
  if (!asset.therapeutic_area) return null;
  const phase = radarPhaseToDb(asset.phase);
  return {
    therapeuticArea: asset.therapeutic_area.toLowerCase().trim(),
    modality: asset.modality || '',
    indication: asset.indication_specific || asset.indication_category || '',
    phase: phase ?? undefined,
    dealType: 'licensing',
  };
}

/**
 * Profile key: assets that resolve to the same comp query share one pool.
 * Persisted as radar_deal_theses.profile_key.
 */
export function compCacheKey(asset: ThesisAssetProfile): string {
  const indication = (asset.indication_specific || asset.indication_category || '').toLowerCase().trim();
  return `${(asset.therapeutic_area || 'any').toLowerCase()}::${modalityKey(asset.modality) || 'any'}::${radarPhaseKey(asset.phase)}::${indication || 'any'}`;
}

export const profileKey = compCacheKey;

// ═══════════════════════════════════════════════════════════════════════
// COMPARABLE DEAL FETCHING (shared calculator path)
// ═══════════════════════════════════════════════════════════════════════

function toDealComp(
  d: EnrichedComparableDeal,
  extra: { asset_name: string | null; royalty_low_pct: number | null; royalty_high_pct: number | null; milestones_total_usd: number | null; announced_date: string | null } | undefined,
): DealComp {
  const low = extra?.royalty_low_pct != null ? Number(extra.royalty_low_pct) : null;
  const high = extra?.royalty_high_pct != null ? Number(extra.royalty_high_pct) : null;
  const royalty = low != null && high != null ? (low + high) / 2 : (low ?? high);
  const milestonesUsd = extra?.milestones_total_usd != null ? Number(extra.milestones_total_usd) : null;

  return {
    id: d.id,
    licensor_name: d.licensor,
    licensee_name: d.licensee,
    asset_name: extra?.asset_name ?? null,
    therapeutic_area: d.therapeuticArea,
    modality: d.modality,
    phase_at_signing: d.phase,
    upfront_m: d.upfrontM,
    total_deal_value_m: d.totalValueM,
    royalty_pct: royalty != null && royalty > 0 ? royalty : null,
    royalty_low_pct: low,
    royalty_high_pct: high,
    milestones_m: milestonesUsd && milestonesUsd > 0 ? Math.round(milestonesUsd / 1_000_000) : null,
    territory: d.territory,
    announced_date: extra?.announced_date ?? null,
    year: d.year,
    deal_type: d.dealType,
    verification_status: d.verificationStatus,
    match_score: d.matchScore,
    relevance_reasons: d.relevanceReasons,
  };
}

/**
 * Comparable transactions for an asset via the shared calculator path.
 * Returns an empty set when the asset has no therapeutic area (the shared
 * path filters on TA in SQL and never widens beyond it).
 */
export async function fetchComparableDeals(
  supabase: SupabaseClient,
  asset: ThesisAssetProfile,
  maxDeals: number = MAX_COMPS,
): Promise<ComparableSet> {
  const inputs = buildCompInputs(asset);
  if (!inputs) return { comps: [], relaxation: 'none', excludedApprovedMA: 0 };

  const result = await findEnrichedComparableDeals(inputs, maxDeals);
  if (result.deals.length === 0) {
    return { comps: [], relaxation: result.relaxation, excludedApprovedMA: result.excludedApprovedMA };
  }

  // The enriched row carries upfront/total in $M but not royalties, milestones
  // or the asset name — pull those for the selected ids only.
  const ids = result.deals.map(d => d.id);
  const { data: extras, error } = await supabase
    .from('deals')
    .select('id, asset_name, royalty_low_pct, royalty_high_pct, milestones_total_usd, announced_date')
    .in('id', ids);
  if (error) {
    console.warn(`[deal-thesis] royalty/milestone lookup failed: ${error.message}`);
  }
  const extraById = new Map((extras || []).map(e => [e.id as string, e]));

  return {
    comps: result.deals.map(d => toDealComp(d, extraById.get(d.id))),
    relaxation: result.relaxation,
    excludedApprovedMA: result.excludedApprovedMA,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// CALCULATOR HEADLINE (lib/calculations.ts vocabulary mapping)
// ═══════════════════════════════════════════════════════════════════════

const RADAR_TA_TO_CALC: Record<string, TherapeuticArea> = {
  oncology: 'oncology',
  neurology: 'neurology',
  immunology: 'immunology',
  metabolic: 'metabolic',
  cardiovascular: 'cardiovascular',
  infectious_disease: 'infectiousDisease',
  infectious: 'infectiousDisease',
  infectiousdisease: 'infectiousDisease',
  ophthalmology: 'ophthalmology',
  womens_health: 'womensHealth',
  womenshealth: 'womensHealth',
  rare_disease: 'rareDisease',
  raredisease: 'rareDisease',
  hematology: 'hematology',
  dermatology: 'dermatology',
  gastroenterology: 'gastroenterology',
  // respiratory has no calculator TA → headline skipped (ta_unsupported)
};

const DB_PHASE_TO_CALC: Record<string, Phase> = {
  discovery: 'discovery',
  preclinical: 'preclinical',
  phase_1: 'phase1',
  phase_1_2: 'phase1_2',
  phase_2: 'phase2',
  phase_2_3: 'phase2_3',
  phase_3: 'phase3',
  nda_filed: 'nda_filed',
  bla_filed: 'nda_filed',
  approved: 'approved',
};

/** Calculator TA for a Radar TA, or null when unsupported. */
export function radarTaToCalculator(ta: string | null | undefined): TherapeuticArea | null {
  if (!ta) return null;
  return RADAR_TA_TO_CALC[ta.toLowerCase().trim()] ?? null;
}

/** Calculator phase for a Radar phase, or null when unmapped. */
export function radarPhaseToCalculator(phase: string | null | undefined): Phase | null {
  const db = radarPhaseToDb(phase);
  return db ? DB_PHASE_TO_CALC[db] ?? null : null;
}

/**
 * Calculator modality for a Radar modality. Some Radar families fan out by
 * TA in the calculator (CAR-T heme vs solid vs autoimmune; gene therapy rare
 * vs ocular; vaccine preventive vs therapeutic).
 */
export function radarModalityToCalculator(modality: string | null | undefined, ta: TherapeuticArea | null): Modality | null {
  const key = modalityKey(modality);
  if (!key) return null;
  switch (key) {
    case 'smallmolecule': return 'smallMolecule';
    case 'antibody': return 'mab';
    case 'adc': return 'adc';
    case 'bispecific': return ta === 'hematology' ? 'bispecificHeme' : 'bispecific';
    case 'tce': return 'tCellEngager';
    case 'cart':
      if (ta === 'immunology') return 'carT_autoimmune';
      if (ta === 'hematology') return 'carT_heme';
      return 'carT_solid';
    case 'celltherapy': return 'cellTherapy';
    case 'genetherapy':
      if (ta === 'rareDisease') return 'geneTherapyRare';
      if (ta === 'ophthalmology') return 'geneTherapyOcular';
      return 'geneTherapy';
    case 'mrna': return 'mrna';
    case 'rnai': return 'rnai';
    case 'peptide': return 'peptide';
    case 'oligonucleotide': return 'oligonucleotide';
    case 'radiopharmaceutical': return 'radiopharmaceutical';
    case 'vaccine': return ta === 'infectiousDisease' ? 'vaccinePreventive' : 'therapeuticVaccine';
    case 'protac': return 'protac';
    // CRISPR / base editing: the calculator has no in-type gene-editing modality; gene therapy is the nearest baseline.
    case 'crispr': return ta === 'rareDisease' ? 'geneTherapyRare' : 'geneTherapy';
    default: return null;
  }
}

const CALC_TA_CATEGORY_KEYS: Record<TherapeuticArea, string[]> = {
  oncology: ['solidTumor', 'hematologic'],
  neurology: ['neurology'],
  immunology: ['immunology'],
  metabolic: ['metabolic'],
  cardiovascular: ['cardiovascular'],
  infectiousDisease: ['infectiousDisease'],
  ophthalmology: ['ophthalmology'],
  womensHealth: ['womensHealth'],
  rareDisease: ['rareDisease'],
  hematology: ['hematology'],
  dermatology: ['dermatology'],
  gastroenterology: ['gastroenterology'],
};

export interface IndicationCandidate { id: string; label: string; multiplier: number; category: string }

const BENCHMARK_INDICATIONS = (staticBenchmarks as unknown as {
  indications: Record<string, Record<string, { label?: string; multiplier?: number }>>;
}).indications;

const indicationCandidateCache = new Map<TherapeuticArea, IndicationCandidate[]>();

function indicationCandidates(ta: TherapeuticArea): IndicationCandidate[] {
  const cached = indicationCandidateCache.get(ta);
  if (cached) return cached;
  const out: IndicationCandidate[] = [];
  for (const cat of CALC_TA_CATEGORY_KEYS[ta] ?? []) {
    const entries = BENCHMARK_INDICATIONS?.[cat] ?? {};
    for (const [id, v] of Object.entries(entries)) {
      out.push({ id, label: v?.label ?? id, multiplier: typeof v?.multiplier === 'number' ? v.multiplier : 1, category: cat });
    }
  }
  out.sort((a, b) => a.id.localeCompare(b.id));
  indicationCandidateCache.set(ta, out);
  return out;
}

/** Whole-word aliases for the short ids that would false-positive as substrings. */
const SHORT_TOKEN_ALIASES: Record<string, string[]> = {
  all: ['acute lymphoblastic', 'acute lymphocytic'],
  aml: ['aml', 'acute myeloid'],
  cll: ['cll', 'chronic lymphocytic'],
  cml: ['cml', 'chronic myeloid', 'chronic myelogenous'],
  mds: ['mds', 'myelodysplastic'],
  mpn: ['mpn', 'myeloproliferative'],
  gbm: ['gbm', 'glioblastoma'],
  ms: ['multiple sclerosis'],
  als: ['als', 'amyotrophic lateral'],
  tbi: ['tbi', 'traumatic brain'],
  ocd: ['ocd', 'obsessive'],
  ptsd: ['ptsd', 'post traumatic'],
  sma: ['sma', 'spinal muscular'],
  cmt: ['cmt', 'charcot'],
  pku: ['pku', 'phenylketonuria'],
  itp: ['itp', 'immune thrombocytopenia'],
  ttp: ['ttp', 'thrombotic thrombocytopenic'],
  pnh: ['pnh', 'paroxysmal nocturnal'],
  igan: ['igan', 'iga nephropathy'],
  ipf: ['ipf', 'idiopathic pulmonary fibrosis'],
  rsv: ['rsv', 'respiratory syncytial'],
  hiv: ['hiv'],
  cmv: ['cmv', 'cytomegalovirus'],
  ebv: ['ebv', 'epstein'],
  cdi: ['cdi', 'clostridioides', 'clostridium difficile', 'c difficile'],
  xlh: ['xlh', 'hypophosphatemia'],
  gvhd: ['gvhd', 'graft versus host', 'graft vs host'],
  pah: ['pah', 'pulmonary arterial hypertension'],
  pcos: ['pcos', 'polycystic ovary'],
  wet: ['wet', 'neovascular'],
  amd: ['amd', 'macular degeneration'],
  dry: ['dry'],
  hr: ['hr+', 'hr positive', 'hormone receptor', 'er+', 'er positive'],
  her2: ['her2', 'her 2'],
  tnbc: ['tnbc', 'triple negative'],
  hcc: ['hcc', 'hepatocellular'],
  rcc: ['rcc', 'renal cell'],
  crc: ['crc', 'colorectal'],
  ibd: ['ibd', 'inflammatory bowel'],
  sle: ['sle', 'systemic lupus', 'lupus'],
  ibs: ['ibs', 'irritable bowel'],
  gi: ['gastrointestinal'],
  ga: ['geographic atrophy'],
  al: ['al amyloidosis', 'light chain'],
};

function normalizeIndicationText(value: string | null | undefined): string {
  return ` ${(value || '').toLowerCase().replace(/[^a-z0-9+]+/g, ' ').replace(/\s+/g, ' ').trim()} `;
}

/** camelCase / snake_case id → lower-case tokens ('lung_nsclc' → ['lung','nsclc']). */
function idTokens(id: string): string[] {
  return id
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9+]+/)
    .filter(Boolean);
}

function tokenFound(token: string, rawTexts: string[], normTexts: string[]): boolean {
  if (token.length >= 4) {
    // The shared alias for 'sclc' ('small cell lung') is a substring of
    // 'non small cell lung' — an NSCLC asset must not match the SCLC id.
    if (token === 'sclc' && normTexts.some(t => t.includes(' non small cell ') || t.includes(' nsclc '))) return false;
    // Long tokens go through the shared alias table (nsclc → 'non small cell', ...).
    return indicationMatches(token, ...rawTexts);
  }
  const candidates = [token, ...(SHORT_TOKEN_ALIASES[token] ?? [])];
  return normTexts.some(t => candidates.some(c => t.includes(` ${c} `)));
}

/**
 * Best calculator indication for the asset's free-text indication fields,
 * restricted to the TA's benchmark categories. Every token of the candidate
 * id (or its label) must appear; the most specific (most tokens) wins.
 * Returns null when nothing matches.
 */
export function matchCalculatorIndication(ta: TherapeuticArea, texts: (string | null | undefined)[]): IndicationCandidate | null {
  const rawTexts = texts.filter((t): t is string => !!t && t.trim().length > 0);
  if (rawTexts.length === 0) return null;
  const normTexts = rawTexts.map(normalizeIndicationText);

  // Score: token count first (most specific), then an id match beats a
  // label match ('rsv' outranks 'RSV (Pediatric)' for the text "RSV").
  let best: { cand: IndicationCandidate; score: number } | null = null;
  for (const cand of indicationCandidates(ta)) {
    const byId = idTokens(cand.id);
    const byLabel = idTokens(cand.label.replace(/\(.*?\)/g, ' '));
    const attempt = (tokens: string[]) => tokens.length > 0 && tokens.every(tok => tokenFound(tok, rawTexts, normTexts));
    let score = 0;
    if (attempt(byId)) score = byId.length * 2 + 1;
    else if (byLabel.length <= 3 && attempt(byLabel)) score = byLabel.length * 2;
    if (score > 0 && (!best || score > best.score)) best = { cand, score };
  }
  return best?.cand ?? null;
}

/** Oncology splits into solid-tumor and hematologic benchmark categories; pick by the asset's indication text. */
function preferredCategory(ta: TherapeuticArea, texts: (string | null | undefined)[]): string | null {
  if (ta !== 'oncology') return null;
  const t = texts.filter(Boolean).join(' ').toLowerCase();
  return /hemat|leuk|lymph|myelom|myelo/.test(t) ? 'hematologic' : 'solidTumor';
}

/**
 * TA-neutral fallback: the benchmark indication whose multiplier is closest
 * to 1.0 (in the preferred category when the TA has several).
 */
export function neutralCalculatorIndication(ta: TherapeuticArea, category: string | null = null): IndicationCandidate | null {
  const all = indicationCandidates(ta);
  const cands = category ? all.filter(c => c.category === category) : all;
  const pool = cands.length > 0 ? cands : all;
  if (pool.length === 0) return null;
  return pool.reduce((best, c) => (Math.abs(c.multiplier - 1) < Math.abs(best.multiplier - 1) ? c : best), pool[0]);
}

function designationsFromAsset(list: string[] | null | undefined): CalculationInput['regulatoryDesignations'] {
  const text = (list || []).join(' ').toLowerCase();
  return {
    breakthrough: /breakthrough/.test(text),
    fastTrack: /fast[\s_-]?track/.test(text),
    orphan: /orphan/.test(text),
    prime: /\bprime\b/.test(text),
  };
}

/**
 * Map a Radar asset onto the calculator's input vocabulary with neutral
 * defaults for every field the asset does not carry. Returns the record of
 * what was used (or why it was skipped) alongside the input.
 */
export function toCalculatorInput(asset: ThesisAssetProfile): { input: CalculationInput | null; inputs: CalculatorInputsRecord } {
  if (!asset.therapeutic_area) return { input: null, inputs: { skipped: 'ta_missing' } };
  const ta = radarTaToCalculator(asset.therapeutic_area);
  if (!ta) return { input: null, inputs: { skipped: 'ta_unsupported', detail: asset.therapeutic_area } };
  const phase = radarPhaseToCalculator(asset.phase);
  if (!phase) return { input: null, inputs: { skipped: 'phase_unmapped', detail: asset.phase ?? undefined } };
  if (!asset.modality) return { input: null, inputs: { skipped: 'modality_missing' } };
  const modality = radarModalityToCalculator(asset.modality, ta);
  if (!modality) return { input: null, inputs: { skipped: 'modality_unmapped', detail: asset.modality } };

  const texts = [asset.indication_specific, asset.indication_category, ...(asset.indications_all || [])];
  const matched = matchCalculatorIndication(ta, texts);
  const indicationCand = matched ?? neutralCalculatorIndication(ta, preferredCategory(ta, texts));
  if (!indicationCand) return { input: null, inputs: { skipped: 'engine_error', detail: 'no benchmark indications for TA' } };
  const indication = indicationCand.id as Indication;
  const regulatoryDesignations = designationsFromAsset(asset.regulatory_designations);

  const input: CalculationInput = {
    therapeuticArea: ta,
    phase,
    dealType: 'licensing',
    modality,
    indication,
    territory: 'global',
    biomarker: 'unselected',
    lineOfTherapy: '2L',
    treatmentApproach: 'symptomatic',
    combinationPotential: 'some',
    competitivePosition: 'racing',
    dataQuality: 'promising',
    regulatoryDesignations,
  };
  return {
    input,
    inputs: { therapeuticArea: ta, phase, modality, indication, indication_matched: matched != null, regulatoryDesignations },
  };
}

/** Cache key for the calculator headline: profile plus the designation flags that change the multiplier. */
export function calculatorCacheKey(asset: ThesisAssetProfile): string {
  const d = designationsFromAsset(asset.regulatory_designations);
  return `${compCacheKey(asset)}|${d.breakthrough ? 'b' : ''}${d.fastTrack ? 'f' : ''}${d.orphan ? 'o' : ''}${d.prime ? 'p' : ''}`;
}

/**
 * The calculator's headline (median upfront / total, $M) for the asset's
 * profile. Never throws: an engine failure records `skipped: engine_error`.
 */
export function computeCalculatorHeadline(asset: ThesisAssetProfile): CalculatorHeadline {
  const { input, inputs } = toCalculatorInput(asset);
  if (!input) return { upfrontMid: null, totalMid: null, inputs };
  try {
    const result = calculateDealTerms(input);
    const upfront = result?.terms?.upfront?.median;
    const total = result?.terms?.totalDealValue?.median;
    const clean = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.round(v) : null);
    return { upfrontMid: clean(upfront), totalMid: clean(total), inputs };
  } catch (err) {
    return {
      upfrontMid: null,
      totalMid: null,
      inputs: { skipped: 'engine_error', detail: err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200) },
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════
// LIKELY ACQUIRERS
// ═══════════════════════════════════════════════════════════════════════

export interface AcquirerContextAsset {
  company_id?: string | null;
  company_name: string;
  partner_company_id?: string | null;
  partner_company_name?: string | null;
}

const CORP_SUFFIXES = new Set(['inc', 'incorporated', 'ltd', 'limited', 'llc', 'plc', 'ag', 'sa', 'nv', 'bv', 'co', 'corp', 'corporation', 'gmbh', 'kk', 'holdings', 'holding', 'group', 'the']);

/** Case/punctuation/suffix-insensitive company key for exclusion matching. */
export function companyNameKey(name: string | null | undefined): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(t => t && !CORP_SUFFIXES.has(t))
    .join(' ')
    .trim();
}

/** True when the candidate is the asset's own company or its existing partner. */
export function isExcludedAcquirer(candidate: { name: string; companyId?: string | null }, asset: AcquirerContextAsset): boolean {
  if (candidate.companyId && (candidate.companyId === asset.company_id || candidate.companyId === asset.partner_company_id)) return true;
  const key = companyNameKey(candidate.name);
  if (!key) return true;
  return key === companyNameKey(asset.company_name) || (!!asset.partner_company_name && key === companyNameKey(asset.partner_company_name));
}

/** Coarse profile for partner-matching (indication category, not free-text specific). */
export function acquirerProfileKey(asset: ThesisAssetProfile): string {
  return `${(asset.therapeutic_area || 'any').toLowerCase()}::${modalityKey(asset.modality) || 'any'}::${radarPhaseKey(asset.phase)}::${(asset.indication_category || 'any').toLowerCase().trim()}`;
}

/** partner-matching input for a Radar asset (its vocabulary is the DB one, so the asset maps directly). */
export function buildAcquirerInput(asset: ThesisAssetProfile): MatchInput | null {
  if (!asset.modality || !asset.therapeutic_area) return null;
  return {
    modality: modalityKey(asset.modality) === 'smallmolecule' ? 'small_molecule' : asset.modality,
    development_phase: radarPhaseToDb(asset.phase) ?? 'phase_2',
    indication_category: asset.indication_category ?? null,
    indication_specific: asset.indication_specific ?? null,
    territory_scope: 'global',
    // partner-matching keys its TA tables by the calculator spelling
    therapeutic_area: radarTaToCalculator(asset.therapeutic_area) ?? asset.therapeutic_area,
    regulatory_designations: designationsFromAsset(asset.regulatory_designations),
    dealType: 'licensing',
  };
}

/** Rank partner-matching output for one asset: exclude own company + partner, cap. */
export function rankAcquirersFromMatches(matches: PartnerMatch[], asset: AcquirerContextAsset, cap: number = MAX_ACQUIRERS): LikelyAcquirer[] {
  const out: LikelyAcquirer[] = [];
  for (const m of matches) {
    if (isExcludedAcquirer({ name: m.company_name, companyId: m.company_id }, asset)) continue;
    const upfrontUsd = m.median_upfront_usd ?? m.avg_upfront_usd;
    const reasons = (m.match_reasons || []).slice(0, 2).map(r => r.reason).filter(Boolean);
    out.push({
      name: m.company_name,
      companyId: m.company_id,
      dealCount: m.deals_last_24mo || 0,
      avgUpfront: upfrontUsd && upfrontUsd > 0 ? Math.round(upfrontUsd / 1_000_000) : null,
      matchScore: m.match_score,
      reason: reasons.length > 0 ? `${reasons.join('; ')} (match ${m.match_score})` : `Partner match score ${m.match_score}`,
    });
    if (out.length >= cap) break;
  }
  return out;
}

/** Fallback: most frequent licensees in the comp pool, excluding own company + partner. */
export function rankAcquirersFromComps(comps: DealComp[], asset: AcquirerContextAsset, cap: number = MAX_ACQUIRERS): LikelyAcquirer[] {
  const acquirerMap = new Map<string, { name: string; count: number; upfronts: number[]; years: number[] }>();
  for (const comp of comps) {
    if (!comp.licensee_name || comp.licensee_name === 'Unknown') continue;
    if (isExcludedAcquirer({ name: comp.licensee_name }, asset)) continue;
    const key = companyNameKey(comp.licensee_name);
    const existing = acquirerMap.get(key) || { name: comp.licensee_name, count: 0, upfronts: [], years: [] };
    existing.count++;
    existing.years.push(comp.year);
    if (comp.upfront_m && comp.upfront_m > 0) existing.upfronts.push(comp.upfront_m);
    acquirerMap.set(key, existing);
  }

  return Array.from(acquirerMap.values())
    .map(data => {
      const latest = Math.max(...data.years);
      return {
        name: data.name,
        dealCount: data.count,
        avgUpfront: data.upfronts.length > 0 ? Math.round(data.upfronts.reduce((a, b) => a + b, 0) / data.upfronts.length) : null,
        reason: `${data.count} comparable deal${data.count === 1 ? '' : 's'} as licensee in this pool (latest ${latest})`,
      };
    })
    .sort((a, b) => b.dealCount - a.dealCount || (b.avgUpfront ?? 0) - (a.avgUpfront ?? 0) || a.name.localeCompare(b.name))
    .slice(0, cap);
}

// ═══════════════════════════════════════════════════════════════════════
// THESIS GENERATION
// ═══════════════════════════════════════════════════════════════════════

const RELAXATION_PENALTY: Record<CompRelaxation, number> = {
  none: 0,
  modality_only: 10,
  ta_only: 20,
};

/** Dispersion penalty: IQR/median of the comp totals, up to 30 points. */
export function dispersionPenalty(dispersion: number | null): number {
  if (dispersion == null || !Number.isFinite(dispersion)) return 0;
  return Math.min(30, Math.round(dispersion * 15));
}

/** terms_basis from the relaxation rung; 'insufficient' overrides everything. */
export function termsBasisFor(relaxation: CompRelaxation, insufficient: boolean): TermsBasis {
  if (insufficient) return 'insufficient';
  if (relaxation === 'none') return 'phase_matched';
  if (relaxation === 'modality_only') return 'ta_modality';
  return 'ta_only';
}

export interface ThesisAsset extends ThesisAssetProfile, AcquirerContextAsset {
  id: string;
  company_name: string;
  asset_name: string;
}

export interface ThesisExtras {
  calculator?: CalculatorHeadline | null;
  /** Ranked partner-matching output for the asset's coarse profile; own-company / partner exclusion is applied here. */
  partnerMatches?: PartnerMatch[] | null;
}

export function generateThesis(asset: ThesisAsset, set: ComparableSet, extras: ThesisExtras = {}): DealThesis {
  const { comps, relaxation } = set;
  const insufficientComps = comps.length < MIN_COMPS_FOR_TERMS;

  const upfronts = comps.map(d => d.upfront_m).filter((v): v is number => v !== null && v > 0);
  const totals = comps.map(d => d.total_deal_value_m).filter((v): v is number => v !== null && v > 0);
  const royalties = comps.map(d => d.royalty_pct).filter((v): v is number => v !== null && v > 0);

  // Each metric needs the floor of disclosed values — a pool of 8 deals with
  // 2 disclosed royalties predicts no royalty.
  const upfrontStats = !insufficientComps && upfronts.length >= MIN_COMPS_FOR_TERMS ? computeCompStats(upfronts) : null;
  const totalStats = !insufficientComps && totals.length >= MIN_COMPS_FOR_TERMS ? computeCompStats(totals) : null;
  const royaltyStats = !insufficientComps && royalties.length >= MIN_COMPS_FOR_TERMS ? computeCompStats(royalties) : null;

  const r1 = (v: number) => Math.round(v * 10) / 10;

  // Dispersion of the comp set (IQR / median). Prefer totals; fall back to upfronts.
  const dispersionSource = totalStats ?? upfrontStats;
  const compDispersion = dispersionSource && dispersionSource.median > 0
    ? Math.round(((dispersionSource.p75 - dispersionSource.p25) / dispersionSource.median) * 100) / 100
    : null;

  // Likely acquirers: partner-matching ranking when available, licensee frequency otherwise.
  let likelyAcquirers: LikelyAcquirer[] = [];
  let acquirerMethod: AcquirerMethod = 'none';
  if (extras.partnerMatches && extras.partnerMatches.length > 0) {
    likelyAcquirers = rankAcquirersFromMatches(extras.partnerMatches, asset);
    acquirerMethod = likelyAcquirers.length > 0 ? 'partner_matching' : 'none';
  }
  if (likelyAcquirers.length === 0) {
    likelyAcquirers = rankAcquirersFromComps(comps, asset);
    acquirerMethod = likelyAcquirers.length > 0 ? 'licensee_frequency' : 'none';
  }

  // Confidence: comp count, disclosure depth, recency, minus relaxation and dispersion.
  let confidence = 0;
  if (!insufficientComps) {
    confidence += Math.min(comps.length * 3, 30);
    confidence += upfronts.length >= 10 ? 20 : upfronts.length >= MIN_COMPS_FOR_TERMS ? 12 : 0;
    confidence += totals.length >= 10 ? 20 : totals.length >= MIN_COMPS_FOR_TERMS ? 12 : 0;
    confidence += royalties.length >= MIN_COMPS_FOR_TERMS ? 10 : 0;
    const currentYear = new Date().getFullYear();
    const recentComps = comps.filter(d => d.year >= currentYear - 2);
    confidence += recentComps.length >= 3 ? 20 : recentComps.length >= 1 ? 10 : 0;
    confidence -= RELAXATION_PENALTY[relaxation];
    confidence -= dispersionPenalty(compDispersion);
  }

  const calculator = extras.calculator ?? null;

  return {
    assetId: asset.id,
    companyName: asset.company_name,
    assetName: asset.asset_name,
    therapeuticArea: asset.therapeutic_area,
    modality: asset.modality,
    phase: asset.phase,
    predictedUpfrontLow: upfrontStats ? Math.round(upfrontStats.p25) : null,
    predictedUpfrontMid: upfrontStats ? Math.round(upfrontStats.median) : null,
    predictedUpfrontHigh: upfrontStats ? Math.round(upfrontStats.p75) : null,
    predictedTotalLow: totalStats ? Math.round(totalStats.p25) : null,
    predictedTotalMid: totalStats ? Math.round(totalStats.median) : null,
    predictedTotalHigh: totalStats ? Math.round(totalStats.p75) : null,
    predictedRoyaltyLow: royaltyStats ? r1(royaltyStats.p25) : null,
    predictedRoyaltyMid: royaltyStats ? r1(royaltyStats.median) : null,
    predictedRoyaltyHigh: royaltyStats ? r1(royaltyStats.p75) : null,
    likelyAcquirers,
    acquirerMethod,
    compCount: comps.length,
    verifiedCompCount: comps.filter(d => d.verification_status === 'verified').length,
    compDealIds: comps.map(d => d.id),
    compRelaxation: relaxation,
    termsBasis: termsBasisFor(relaxation, insufficientComps),
    insufficientComps,
    compDispersion,
    calculatorUpfrontMid: calculator?.upfrontMid ?? null,
    calculatorTotalMid: calculator?.totalMid ?? null,
    calculatorInputs: calculator?.inputs ?? null,
    profileKey: compCacheKey(asset),
    thesisConfidence: Math.max(0, Math.min(Math.round(confidence), 100)),
  };
}

// ═══════════════════════════════════════════════════════════════════════
// PERSIST (batched, key-uniform upserts)
// ═══════════════════════════════════════════════════════════════════════

/** Columns added by migration 104. */
const COLUMNS_104 = ['comp_relaxation', 'insufficient_comps', 'comp_dispersion'] as const;
/** Columns added by migration 116. */
const COLUMNS_116 = ['verified_comp_count', 'terms_basis', 'calculator_upfront_mid', 'calculator_total_mid', 'calculator_inputs', 'profile_key', 'acquirer_method'] as const;

export interface PersistState {
  /** 0 = all columns; 1 = without 116 columns; 2 = without 104 + 116 columns. */
  tier: 0 | 1 | 2;
}

function isMissingColumnError(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  if (err.code === 'PGRST204' || err.code === '42703') return true;
  return /column|schema cache/i.test(err.message || '');
}

/**
 * One upsert row. Every key is always present (null when unknown) so a batch
 * is key-uniform — PostgREST rejects bulk rows with differing key sets.
 */
export function buildThesisRow(thesis: DealThesis, nowIso: string): Record<string, unknown> {
  return {
    asset_id: thesis.assetId,
    company_name: thesis.companyName,
    asset_name: thesis.assetName,
    therapeutic_area: thesis.therapeuticArea ?? null,
    modality: thesis.modality ?? null,
    phase: thesis.phase ?? null,
    predicted_upfront_low: thesis.predictedUpfrontLow,
    predicted_upfront_mid: thesis.predictedUpfrontMid,
    predicted_upfront_high: thesis.predictedUpfrontHigh,
    predicted_total_low: thesis.predictedTotalLow,
    predicted_total_mid: thesis.predictedTotalMid,
    predicted_total_high: thesis.predictedTotalHigh,
    predicted_royalty_low: thesis.predictedRoyaltyLow,
    predicted_royalty_mid: thesis.predictedRoyaltyMid,
    predicted_royalty_high: thesis.predictedRoyaltyHigh,
    likely_acquirers: thesis.likelyAcquirers,
    comp_count: thesis.compCount,
    comp_deal_ids: thesis.compDealIds,
    thesis_confidence: thesis.thesisConfidence,
    generated_at: nowIso,
    updated_at: nowIso,
    // migration 104
    comp_relaxation: thesis.compRelaxation,
    insufficient_comps: thesis.insufficientComps,
    comp_dispersion: thesis.compDispersion,
    // migration 116
    verified_comp_count: thesis.verifiedCompCount,
    terms_basis: thesis.termsBasis,
    calculator_upfront_mid: thesis.calculatorUpfrontMid,
    calculator_total_mid: thesis.calculatorTotalMid,
    calculator_inputs: thesis.calculatorInputs,
    profile_key: thesis.profileKey,
    acquirer_method: thesis.acquirerMethod,
  };
}

function stripColumns(rows: Record<string, unknown>[], cols: readonly string[]): Record<string, unknown>[] {
  return rows.map(r => {
    const copy = { ...r };
    for (const c of cols) delete copy[c];
    return copy;
  });
}

function applyTier(rows: Record<string, unknown>[], tier: PersistState['tier']): Record<string, unknown>[] {
  if (tier === 0) return rows;
  if (tier === 1) return stripColumns(rows, COLUMNS_116);
  return stripColumns(rows, [...COLUMNS_116, ...COLUMNS_104]);
}

/** Dedupe by asset_id (last write wins) so ON CONFLICT never sees the same key twice in one statement. */
export function dedupeRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  const byId = new Map<string, Record<string, unknown>>();
  for (const r of rows) byId.set(String(r.asset_id), r);
  return Array.from(byId.values());
}

/**
 * Upsert a batch of thesis rows. If the migration-116 (then 104) columns are
 * missing, PostgREST rejects the whole batch; drop that column set for the
 * rest of the run and retry so theses are still written.
 */
export async function upsertThesisRows(
  supabase: SupabaseClient,
  rows: Record<string, unknown>[],
  state: PersistState,
): Promise<{ error: { code?: string; message: string } | null; written: number }> {
  if (rows.length === 0) return { error: null, written: 0 };
  const unique = dedupeRows(rows);
  for (;;) {
    const payload = applyTier(unique, state.tier);
    const { error } = await supabase.from('radar_deal_theses').upsert(payload, { onConflict: 'asset_id' });
    if (!error) return { error: null, written: unique.length };
    if (isMissingColumnError(error) && state.tier < 2) {
      state.tier = (state.tier + 1) as PersistState['tier'];
      console.warn(`[deal-thesis] radar_deal_theses is missing ${state.tier === 1 ? 'migration 116' : 'migration 104'} columns; writing without them (apply the migration)`);
      continue;
    }
    return { error, written: 0 };
  }
}

// ═══════════════════════════════════════════════════════════════════════
// QUEUE
// ═══════════════════════════════════════════════════════════════════════

export interface QueuedAsset extends ThesisAsset {
  partnership_status: string | null;
  confidence_score: number | null;
  thesis_generated_at: string | null;
  queue_reason: 'never' | 'stale' | 'changed' | null;
}

const QUEUE_PAGE = 1000;

/** PostgREST error for a missing RPC (migration 116 not applied). */
function isMissingFunctionError(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  if (err.code === 'PGRST202' || err.code === '42883') return true;
  return /could not find the function|function .* does not exist/i.test(err.message || '');
}

/**
 * Assets that need a thesis, oldest first, via the `radar_thesis_queue` RPC.
 * Paged with .range() (PostgREST caps an unranged response at 1,000 rows).
 * Falls back to a direct select (top by licensing_intent_score, the pre-116
 * behaviour) when the RPC does not exist yet.
 */
export async function fetchThesisQueue(
  supabase: SupabaseClient,
  opts: { limit: number; refreshDays: number; minAgeDays: number; assetIds?: string[] },
): Promise<{ assets: QueuedAsset[]; source: 'rpc' | 'legacy_select'; errors: string[] }> {
  const errors: string[] = [];
  const assets: QueuedAsset[] = [];

  for (let from = 0; from < opts.limit; from += QUEUE_PAGE) {
    const to = Math.min(from + QUEUE_PAGE, opts.limit) - 1;
    const { data, error } = await supabase
      .rpc('radar_thesis_queue', {
        p_limit: opts.limit,
        p_refresh_days: opts.refreshDays,
        p_min_age_days: opts.minAgeDays,
        p_asset_ids: opts.assetIds?.length ? opts.assetIds : null,
      })
      .range(from, to);
    if (error) {
      if (isMissingFunctionError(error) && assets.length === 0) {
        console.warn('[deal-thesis] radar_thesis_queue RPC missing (apply migration 116); falling back to legacy select');
        return fetchThesisQueueLegacy(supabase, opts);
      }
      errors.push(`queue fetch: ${error.message}`);
      break;
    }
    const page = ((data ?? []) as Record<string, unknown>[]).map(r => ({
      ...(r as unknown as QueuedAsset),
      thesis_generated_at: (r.thesis_generated_at as string | null) ?? null,
      queue_reason: (r.queue_reason as QueuedAsset['queue_reason']) ?? null,
    }));
    assets.push(...page);
    if (page.length < to - from + 1) break;
  }
  return { assets, source: 'rpc', errors };
}

const LEGACY_PHASES = [
  'early_phase_1', 'phase_1', 'phase_1_2', 'phase_2', 'phase_2_3', 'phase_3',
  'early_phase1', 'phase1', 'phase1_phase2', 'phase2', 'phase2_phase3', 'phase3',
  'phase_4', 'phase4',
];

async function fetchThesisQueueLegacy(
  supabase: SupabaseClient,
  opts: { limit: number; assetIds?: string[] },
): Promise<{ assets: QueuedAsset[]; source: 'legacy_select'; errors: string[] }> {
  const errors: string[] = [];
  const assets: QueuedAsset[] = [];
  for (let from = 0; from < opts.limit; from += QUEUE_PAGE) {
    const to = Math.min(from + QUEUE_PAGE, opts.limit) - 1;
    let q = supabase
      .from('clinical_assets')
      .select('id, company_id, company_name, asset_name, therapeutic_area, modality, phase, indication_category, indication_specific, indications_all, regulatory_designations, partnership_status, partner_company_id, partner_company_name, confidence_score, licensing_intent_score')
      .in('partnership_status', ['unpartnered', 'partially_partnered'])
      .in('phase', LEGACY_PHASES)
      .gte('confidence_score', 20)
      .order('licensing_intent_score', { ascending: false, nullsFirst: false })
      .order('id', { ascending: true });
    if (opts.assetIds?.length) q = q.in('id', opts.assetIds);
    const { data, error } = await q.range(from, to);
    if (error) { errors.push(`legacy queue fetch: ${error.message}`); break; }
    const page = ((data ?? []) as unknown as QueuedAsset[])
      // phase 4 only when fully unpartnered (the RPC encodes the same rule)
      .filter(a => !(a.phase === 'phase_4' || a.phase === 'phase4') || a.partnership_status === 'unpartnered')
      .map(a => ({ ...a, thesis_generated_at: null, queue_reason: null as QueuedAsset['queue_reason'] }));
    assets.push(...page);
    if ((data ?? []).length < to - from + 1) break;
  }

  // Existing theses so generated vs refreshed is still reported correctly.
  for (let i = 0; i < assets.length; i += 500) {
    const ids = assets.slice(i, i + 500).map(a => a.id);
    const { data } = await supabase.from('radar_deal_theses').select('asset_id, generated_at').in('asset_id', ids);
    const byId = new Map((data ?? []).map(r => [r.asset_id as string, r.generated_at as string | null]));
    for (const a of assets.slice(i, i + 500)) {
      const g = byId.get(a.id);
      if (g) { a.thesis_generated_at = g; a.queue_reason = 'stale'; }
      else a.queue_reason = 'never';
    }
  }
  return { assets, source: 'legacy_select', errors };
}

/** Remaining queue size after a run; null when the count RPC is unavailable. */
export async function countThesisBacklog(
  supabase: SupabaseClient,
  opts: { refreshDays: number; minAgeDays: number },
): Promise<{ remaining: number; eligible: number; never: number; stale: number; changed: number } | null> {
  const { data, error } = await supabase.rpc('radar_thesis_queue_count', {
    p_refresh_days: opts.refreshDays,
    p_min_age_days: opts.minAgeDays,
  });
  if (error) return null;
  const row = Array.isArray(data) ? (data[0] as Record<string, unknown> | undefined) : (data as Record<string, unknown> | null);
  if (!row) return null;
  const n = (v: unknown) => (v == null ? 0 : Number(v));
  return { remaining: n(row.remaining), eligible: n(row.eligible), never: n(row.never_generated), stale: n(row.stale), changed: n(row.changed) };
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN: BATCH THESIS GENERATION
// ═══════════════════════════════════════════════════════════════════════

/** Processing budget; the route's maxDuration is 300 s, leaving room for the final flush + log. */
export const MAX_RUNTIME_MS = 250_000;
/** Parallel comps-engine calls during the profile prefetch. */
const COMP_CONCURRENCY = 6;
/** Partner-matching is ~3 queries per profile; cap its share of the run. */
const PARTNER_MATCH_BUDGET_MS = 60_000;
const PARTNER_MATCH_MAX_PROFILES = 80;
const UPSERT_BATCH = 500;

async function mapWithConcurrency<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
  shouldStop: () => boolean,
): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < items.length && !shouldStop()) {
      const item = items[next++];
      await fn(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
}

export interface GenerateDealThesesOptions {
  /** Force these assets regardless of queue age. */
  assetIds?: string[];
  /** Queue size for this run (default 3,000). */
  limit?: number;
  /** Refresh theses older than this (default 30). */
  refreshDays?: number;
  /** Minimum thesis age before an asset change re-queues it (default 7). */
  minAgeDays?: number;
  runType?: 'scheduled' | 'manual' | 'backfill';
  /** Override the processing budget (tests). */
  maxRuntimeMs?: number;
}

export async function generateDealTheses(
  supabase: SupabaseClient,
  options: GenerateDealThesesOptions = {},
): Promise<ThesisResult> {
  const startTime = Date.now();
  const maxRuntimeMs = options.maxRuntimeMs ?? MAX_RUNTIME_MS;
  const limit = Math.max(1, options.limit ?? DEFAULT_RUN_LIMIT);
  const refreshDays = Math.max(1, options.refreshDays ?? DEFAULT_REFRESH_DAYS);
  const minAgeDays = Math.max(0, options.minAgeDays ?? DEFAULT_MIN_AGE_DAYS);
  const errors: string[] = [];
  const elapsed = () => Date.now() - startTime;
  const outOfTime = () => elapsed() > maxRuntimeMs;

  let assetsProcessed = 0;
  let generated = 0;
  let refreshed = 0;
  let thesesWithTerms = 0;
  let insufficientComps = 0;
  let timedOut = false;

  const finish = async (queueSource: 'rpc' | 'legacy_select', assetsQueued: number, profiles: number, acquirerProfiles: number, extra: Record<string, unknown> = {}): Promise<ThesisResult> => {
    const backlog = await countThesisBacklog(supabase, { refreshDays, minAgeDays });
    const durationSeconds = Math.round(elapsed() / 1000);
    const status = errors.length > 0 && assetsProcessed === 0 && assetsQueued > 0
      ? 'failed'
      : deriveRunStatus({ errors: errors.length, timedOut, processed: assetsProcessed, produced: assetsProcessed });
    const logWritten = await logRadarRun(supabase, {
      source: 'deal_thesis',
      startedAt: startTime,
      status,
      runType: options.runType ?? 'scheduled',
      fetched: assetsQueued,
      processed: assetsProcessed,
      inserted: generated,
      updated: refreshed,
      skipped: insufficientComps,
      failed: errors.length,
      errors,
      parameters: {
        generated,
        refreshed,
        insufficient: insufficientComps,
        theses_with_terms: thesesWithTerms,
        profiles_cached: profiles,
        acquirer_profiles_cached: acquirerProfiles,
        remaining_backlog: backlog?.remaining ?? null,
        backlog: backlog,
        duration: durationSeconds,
        timed_out: timedOut,
        limit,
        refresh_days: refreshDays,
        min_age_days: minAgeDays,
        min_comps_for_terms: MIN_COMPS_FOR_TERMS,
        queue_source: queueSource,
        ...extra,
      },
    });
    console.log(`[deal-thesis] Done: ${assetsQueued} queued, ${assetsProcessed} written (${generated} new, ${refreshed} refreshed), ${thesesWithTerms} with terms, ${insufficientComps} below comp floor, ${profiles} comp profiles, ${errors.length} errors, ${durationSeconds}s${timedOut ? ' (timed out)' : ''}; backlog ${backlog?.remaining ?? 'n/a'}`);
    return {
      assetsQueued,
      assetsProcessed,
      generated,
      refreshed,
      thesesWithTerms,
      insufficientComps,
      profilesCached: profiles,
      acquirerProfilesCached: acquirerProfiles,
      remainingBacklog: backlog?.remaining ?? null,
      durationSeconds,
      errors,
      timedOut,
      logWritten,
      queueSource,
    };
  };

  // ── 1. Queue ──
  const queue = await fetchThesisQueue(supabase, { limit, refreshDays, minAgeDays, assetIds: options.assetIds });
  errors.push(...queue.errors);
  const assets = queue.assets;
  if (assets.length === 0) return finish(queue.source, 0, 0, 0, { note: 'queue empty' });

  // ── 2. Distinct comp profiles, most-shared first, one engine call each ──
  const profileAssets = new Map<string, QueuedAsset[]>();
  for (const a of assets) {
    const key = compCacheKey(a);
    const list = profileAssets.get(key) ?? [];
    list.push(a);
    profileAssets.set(key, list);
  }
  const profilesByWeight = Array.from(profileAssets.entries()).sort((a, b) => b[1].length - a[1].length).map(([key, list]) => ({ key, sample: list[0] }));
  const compCache = new Map<string, ComparableSet>();
  const relaxationCounts: Record<CompRelaxation, number> = { none: 0, modality_only: 0, ta_only: 0 };

  const prefetchBudgetMs = Math.round(maxRuntimeMs * 0.6);
  const compPrefetch = mapWithConcurrency(
    profilesByWeight,
    COMP_CONCURRENCY,
    async ({ key, sample }) => {
      try {
        compCache.set(key, await fetchComparableDeals(supabase, sample));
      } catch (err) {
        errors.push(`comps ${key}: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
    () => elapsed() > prefetchBudgetMs,
  );

  // ── 3. Acquirer profiles via partner-matching, most-shared first, within budget ──
  const acquirerAssets = new Map<string, QueuedAsset[]>();
  for (const a of assets) {
    const key = acquirerProfileKey(a);
    const list = acquirerAssets.get(key) ?? [];
    list.push(a);
    acquirerAssets.set(key, list);
  }
  const acquirerProfiles = Array.from(acquirerAssets.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, PARTNER_MATCH_MAX_PROFILES)
    .map(([key, list]) => ({ key, sample: list[0] }));
  const partnerCache = new Map<string, PartnerMatch[]>();
  let partnerMatchingUnavailable = false;
  const partnerPrefetch = (async () => {
    const budgetStart = Date.now();
    for (const { key, sample } of acquirerProfiles) {
      if (partnerMatchingUnavailable || Date.now() - budgetStart > PARTNER_MATCH_BUDGET_MS || outOfTime()) break;
      const input = buildAcquirerInput(sample);
      if (!input) continue;
      try {
        // Over-fetch so per-asset exclusions (own company, partner) still leave MAX_ACQUIRERS.
        const res = await findPartnerMatches(supabase, input, { limit: MAX_ACQUIRERS + 4 });
        partnerCache.set(key, res.matches);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`partner-matching ${key}: ${message}`);
        // A structural failure (table missing, permissions) will repeat — stop trying.
        if (/failed to fetch companies/i.test(message)) partnerMatchingUnavailable = true;
      }
    }
  })();

  await Promise.all([compPrefetch, partnerPrefetch]);

  // ── 4. Per-asset assembly + batched upserts ──
  const calculatorCache = new Map<string, CalculatorHeadline>();
  const persistState: PersistState = { tier: 0 };
  const acquirerMethodCounts: Record<AcquirerMethod, number> = { partner_matching: 0, licensee_frequency: 0, none: 0 };
  let calculatorHeadlines = 0;
  let pending: { row: Record<string, unknown>; asset: QueuedAsset; thesis: DealThesis }[] = [];

  const flush = async () => {
    if (pending.length === 0) return;
    const batch = pending;
    pending = [];
    const { error, written } = await upsertThesisRows(supabase, batch.map(b => b.row), persistState);
    if (error) {
      errors.push(`thesis upsert (${batch.length} rows): ${error.message}`);
      return;
    }
    assetsProcessed += written;
    for (const { asset, thesis } of batch) {
      if (asset.thesis_generated_at) refreshed++; else generated++;
      if (thesis.insufficientComps) insufficientComps++; else thesesWithTerms++;
      relaxationCounts[thesis.compRelaxation]++;
      acquirerMethodCounts[thesis.acquirerMethod]++;
      if (thesis.calculatorUpfrontMid != null) calculatorHeadlines++;
    }
  };

  for (const asset of assets) {
    if (outOfTime()) { timedOut = true; break; }
    try {
      const key = compCacheKey(asset);
      let set = compCache.get(key);
      if (!set) {
        // Prefetch ran out of budget before reaching this profile — fetch lazily.
        set = await fetchComparableDeals(supabase, asset);
        compCache.set(key, set);
      }

      const calcKey = calculatorCacheKey(asset);
      let calculator = calculatorCache.get(calcKey);
      if (!calculator) {
        calculator = computeCalculatorHeadline(asset);
        calculatorCache.set(calcKey, calculator);
      }

      const thesis = generateThesis(asset, set, { calculator, partnerMatches: partnerCache.get(acquirerProfileKey(asset)) ?? null });
      pending.push({ row: buildThesisRow(thesis, new Date().toISOString()), asset, thesis });
      if (pending.length >= UPSERT_BATCH) await flush();
    } catch (err) {
      errors.push(`Thesis error ${asset.asset_name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  await flush();

  return finish(queue.source, assets.length, compCache.size, partnerCache.size, {
    relaxation: relaxationCounts,
    acquirer_method: acquirerMethodCounts,
    calculator_headlines: calculatorHeadlines,
    persist_tier: persistState.tier,
    partner_matching_unavailable: partnerMatchingUnavailable,
  });
}
