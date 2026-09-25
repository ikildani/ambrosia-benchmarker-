/**
 * Deal Intelligence Brief v3 — comparable set builder.
 *
 * Pulls quality-filtered rows from `deals`, scores each against the asset
 * profile with a transparent 0–100 relevance, and returns the CompSet shape
 * from lib/brief/types.ts (rows, stats, phase/structure buckets, headline
 * drivers, caveat, source note).
 *
 * Relevance weights (sum = 100) — kept deliberately simple so the number can
 * be explained in a room:
 *   phase       25  exact 25 · adjacent (one step) 15 · further 5 · unknown 0
 *   indication  20  same indication (ilike on category/specific) 20 · else 0
 *   modality    20  exact 20 · same class (antibody / oligo / cell-gene / small) 12 · else 0
 *   TA          15  same therapeutic area 15 · else 0
 *   territory   10  same region 10 · one side global 5 · else 0
 *   recency     10  2025+ 10 · 2024 8 · 2023 6 · 2022 4 · 2021 3 · earlier 1
 *
 * Quality filter (spec): is_synthetic = false, is_canonical is not false,
 * verification_status not in ('rejected','flagged').
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { AssetProfile, CompRow, CompSet, CompStats, DealPhase, DealStructure } from './types';
import type { DealRowForClauses } from './term-sheet';
import { mapTerritory } from './regional';

// ─── Raw row shape (the columns we select) ─────────────────────────────────

export interface RawDealRow {
  id: string;
  licensor_name: string | null;
  licensee_name: string | null;
  asset_name: string | null;
  announced_date: string | null;
  phase_at_signing: string | null;
  deal_type: string | null;
  modality: string | null;
  indication_category: string | null;
  indication_specific: string | null;
  therapeutic_area: string | null;
  territory: string | null;
  upfront_usd: number | null;
  total_deal_value_usd: number | null;
  milestones_total_usd: number | null;
  royalty_low_pct: number | null;
  royalty_high_pct: number | null;
  equity_investment_usd: number | null;
  verified: boolean | null;
  source_type: string | null;
  source_url: string | null;
  press_release_url: string | null;
  // clause columns (term-sheet precedent map)
  includes_co_development: boolean | null;
  includes_co_promotion: boolean | null;
  sublicense_rights: string | boolean | null;
  rights_retained: string | null;
  opt_in_rights: string | boolean | null;
  opt_in_stage: string | null;
  research_funding_usd: number | null;
  profit_share_pct: number | null;
  cost_share_ratio: string | number | null;
  option_exercise_fee: number | null;
  term_years: number | null;
}

export const DEAL_SELECT_COLUMNS = [
  'id', 'licensor_name', 'licensee_name', 'asset_name', 'announced_date', 'phase_at_signing',
  'deal_type', 'modality', 'indication_category', 'indication_specific', 'therapeutic_area',
  'territory', 'upfront_usd', 'total_deal_value_usd', 'milestones_total_usd', 'royalty_low_pct',
  'royalty_high_pct', 'equity_investment_usd', 'verified', 'source_type', 'source_url',
  'press_release_url', 'includes_co_development', 'includes_co_promotion', 'sublicense_rights',
  'rights_retained', 'opt_in_rights', 'opt_in_stage', 'research_funding_usd', 'profit_share_pct',
  'cost_share_ratio', 'option_exercise_fee', 'term_years',
].join(',');

// ─── Small numeric helpers (exported for tests and sibling builders) ───────

/** Linear-interpolated percentile on a sorted-or-not numeric array. q in 0–1. */
export function percentile(values: number[], q: number): number | null {
  const arr = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (arr.length === 0) return null;
  const pos = (arr.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return arr[lo];
  return arr[lo] + (arr[hi] - arr[lo]) * (pos - lo);
}

/** p25/p50/p75 on non-null values; null when fewer than 3 values. */
export function quartiles(values: Array<number | null | undefined>): { p25: number; p50: number; p75: number } | null {
  const arr = values.filter((v): v is number => v != null && Number.isFinite(v));
  if (arr.length < 3) return null;
  return {
    p25: percentile(arr, 0.25) as number,
    p50: percentile(arr, 0.5) as number,
    p75: percentile(arr, 0.75) as number,
  };
}

export function royaltyMid(row: { royaltyLowPct: number | null; royaltyHighPct: number | null }): number | null {
  const { royaltyLowPct: lo, royaltyHighPct: hi } = row;
  if (lo != null && hi != null) return (lo + hi) / 2;
  if (lo != null) return lo;
  if (hi != null) return hi;
  return null;
}

export function computeStats(rows: CompRow[]): CompStats {
  return {
    n: rows.length,
    upfront: quartiles(rows.map((r) => r.upfrontM)),
    total: quartiles(rows.map((r) => r.totalM)),
    royaltyMid: quartiles(rows.map(royaltyMid)),
  };
}

/** Tukey upper fence on totals: > p75 + 1.5·IQR. Needs ≥ 4 totals to be meaningful. */
export function outlierThreshold(totals: Array<number | null>): number {
  const arr = totals.filter((v): v is number => v != null && Number.isFinite(v));
  if (arr.length < 4) return Infinity;
  const p25 = percentile(arr, 0.25) as number;
  const p75 = percentile(arr, 0.75) as number;
  return p75 + 1.5 * (p75 - p25);
}

// ─── Normalisers ───────────────────────────────────────────────────────────

const PHASE_RANK: Record<DealPhase, number> = {
  discovery: 0, preclinical: 1, phase_1: 2, phase_2: 3, phase_3: 4, approved: 5, unknown: -1,
};

/** Accepts deals keys (phase_1), calc keys (phase1, phase1_2), and labels ("Phase 2"). */
export function normalizePhase(phase: string | null | undefined): DealPhase {
  if (!phase) return 'unknown';
  const k = phase.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (k.startsWith('discovery')) return 'discovery';
  if (k.startsWith('preclin') || k === 'indenabling') return 'preclinical';
  if (k === 'phase12' || k === 'phase1b' || k === 'phase1' || k === 'phasei') return k === 'phase12' ? 'phase_2' : 'phase_1';
  if (k === 'phase23' || k === 'phase2' || k === 'phase2b' || k === 'phaseii') return k === 'phase23' ? 'phase_3' : 'phase_2';
  if (k === 'phase3' || k === 'phaseiii' || k === 'pivotal') return 'phase_3';
  if (k.startsWith('approved') || k === 'marketed' || k === 'nda' || k === 'bla' || k === 'registration') return 'approved';
  if (k.startsWith('phase1')) return 'phase_1';
  if (k.startsWith('phase2')) return 'phase_2';
  if (k.startsWith('phase3')) return 'phase_3';
  return 'unknown';
}

export function normalizeStructure(dealType: string | null | undefined): DealStructure {
  if (!dealType) return 'other';
  const k = dealType.toLowerCase().replace(/[^a-z]/g, '');
  if (k === 'license' || k === 'licensing' || k === 'reformulation') return 'license';
  if (k === 'option') return 'option';
  if (k === 'acquisition' || k === 'ma' || k === 'merger') return 'acquisition';
  if (k === 'codevelopment' || k === 'codev') return 'co_development';
  if (k === 'copromotion' || k === 'copromote') return 'co_promotion';
  if (k === 'collaboration' || k === 'research') return 'collaboration';
  return 'other';
}

const MODALITY_CLASS: Record<string, string> = {
  smallmolecule: 'small', sm: 'small', degrader: 'small', molecularglue: 'small', protac: 'small', allostericinhibitor: 'small',
  jakinhibitor: 'small', s1pmodulator: 'small', oralintegrin: 'small', psychedelic: 'small',
  mab: 'antibody', antibody: 'antibody', monoclonalantibody: 'antibody', bispecific: 'antibody', bispecificantibody: 'antibody',
  trispecific: 'antibody', trispecificantibody: 'antibody', adc: 'antibody', fcrnantagonist: 'antibody', complementinhibitor: 'antibody',
  tl1ainhibitor: 'antibody', dualantagonist: 'antibody', nanobody: 'antibody',
  aso: 'oligo', rnai: 'oligo', sirna: 'oligo', oligonucleotide: 'oligo', mrna: 'oligo', antisense: 'oligo',
  celltherapy: 'cellgene', cart: 'cellgene', carnk: 'cellgene', genetherapy: 'cellgene', invivocart: 'cellgene', geneediting: 'cellgene',
  peptide: 'peptide', cyclicpeptide: 'peptide',
  vaccine: 'vaccine', radiopharm: 'radio', radiopharmaceutical: 'radio', radioligand: 'radio',
};

const MODALITY_SYNONYM: Record<string, string> = {
  antibody: 'mab', monoclonalantibody: 'mab', sm: 'smallmolecule', antisense: 'aso', sirna: 'rnai',
  bispecificantibody: 'bispecific', trispecificantibody: 'trispecific', radiopharmaceutical: 'radiopharm',
  cart: 'celltherapy', carnk: 'celltherapy', cyclicpeptide: 'peptide',
};

export function normalizeModality(m: string | null | undefined): string {
  if (!m) return '';
  let k = m.toLowerCase().replace(/[^a-z0-9]/g, '');
  // adc_her2 / adc_folr1 → adc
  if (k.startsWith('adc')) k = 'adc';
  return MODALITY_SYNONYM[k] ?? k;
}

function modalityClass(norm: string): string | null {
  return MODALITY_CLASS[norm] ?? null;
}

/** TA keyword patterns over indication text; covers rows filed under pseudo-TAs (_codev_deals …). */
const TA_PATTERNS: Record<string, RegExp> = {
  neurology: /\b(cns|neuro|alzheimer|parkinson|epilep|schizo|depress|huntington|sleep|migraine|als|psychiat|rett|dementia|multiple sclerosis|narcolep)/i,
  oncology: /(onco|tumou?r|cancer|carcinoma|lymphoma|leukemia|leukaemia|myeloma|heme_malig|glioma|sarcoma|melanoma)/i,
  immunology: /(immun|lupus|psoria|arthritis|atopic|\bibd\b|crohn|colitis|inflam|dermatitis|myasthenia)/i,
  metabolic: /(metab|obesity|diabet|\bnash\b|\bmash\b|lipid|steatohep)/i,
  cardiovascular: /(cardio|heart|hypertens|atrial|thrombo|cholesterol)/i,
  infectiousDisease: /(infect|\bhbv\b|\bhiv\b|viral|bacteri|influenza|covid|antibiot|antifungal|malaria|tubercul)/i,
  ophthalmology: /(ophthal|retina|macular|\beye\b|glaucoma|uveitis)/i,
  rareDisease: /(rare|orphan|duchenne|lysosomal)/i,
  hematology: /(hemat|haemat|hemophil|haemophil|sickle|anemia|anaemia|thalass)/i,
  dermatology: /(derm|\bskin\b|alopecia|vitiligo)/i,
  gastroenterology: /(gastro|\bgi\b|bowel|celiac|eosinophilic)/i,
  womensHealth: /(women|endometri|fertility|menopaus|contracept|uterine|ovarian)/i,
  respiratory: /(respir|asthma|copd|pulmon|fibrosis)/i,
};

function normalizeTA(ta: string | null | undefined): string {
  return (ta ?? '').toLowerCase().replace(/[^a-z]/g, '');
}

export function isSameTA(row: Pick<RawDealRow, 'therapeutic_area' | 'indication_category' | 'indication_specific'>, assetTA: string): boolean {
  if (!assetTA) return false;
  if (normalizeTA(row.therapeutic_area) === normalizeTA(assetTA)) return true;
  const pat = TA_PATTERNS[assetTA] ?? Object.entries(TA_PATTERNS).find(([k]) => normalizeTA(k) === normalizeTA(assetTA))?.[1];
  if (!pat) return false;
  return pat.test(`${row.indication_category ?? ''} ${row.indication_specific ?? ''}`);
}

const INDICATION_SYNONYMS: Record<string, string[]> = {
  nsclc: ['nonsmallcelllung', 'nsclc'],
  alzheimers: ['alzheimer'],
  parkinsons: ['parkinson'],
  huntingtons: ['huntington'],
  t2d: ['type2diabet', 't2d', 't2dm'],
  hbv: ['hepatitisb', 'hbv'],
  ra: ['rheumatoidarthritis'],
  ad: ['alzheimer'],
  mdd: ['majordepress', 'mdd'],
};

function normText(s: string | null | undefined): string {
  return (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Same indication: normalised asset indication (or a synonym stem) appears in the row's indication text, or vice versa. */
export function isSameIndication(row: Pick<RawDealRow, 'indication_category' | 'indication_specific'>, assetIndication: string): boolean {
  const a = normText(assetIndication);
  if (a.length < 3) return false;
  const rowText = normText(`${row.indication_category ?? ''} ${row.indication_specific ?? ''}`);
  if (!rowText) return false;
  const stems = new Set<string>([a, a.replace(/(disease|disorder|s)$/, '')]);
  (INDICATION_SYNONYMS[a] ?? []).forEach((s) => stems.add(s));
  for (const stem of stems) {
    if (stem.length < 3) continue;
    if (rowText.includes(stem)) return true;
  }
  const rowCat = normText(row.indication_category);
  return rowCat.length >= 4 && a.includes(rowCat) && rowCat !== 'other' && rowCat !== 'cns';
}

function recencyScore(year: number | null): number {
  if (year == null) return 1;
  if (year >= 2025) return 10;
  if (year >= 2024) return 8;
  if (year >= 2023) return 6;
  if (year >= 2022) return 4;
  if (year >= 2021) return 3;
  return 1;
}

const usdToM = (v: number | null | undefined): number | null =>
  v == null || !Number.isFinite(v) ? null : Math.round((v / 1_000_000) * 100) / 100;

// ─── Scoring ───────────────────────────────────────────────────────────────

export function scoreRow(raw: RawDealRow, asset: AssetProfile): { relevance: number; reasons: string[]; sameIndication: boolean; sameTA: boolean } {
  const reasons: string[] = [];
  let score = 0;

  // Phase (25)
  const assetPhase = normalizePhase(asset.phase);
  const rowPhase = normalizePhase(raw.phase_at_signing);
  if (assetPhase !== 'unknown' && rowPhase !== 'unknown') {
    const dist = Math.abs(PHASE_RANK[assetPhase] - PHASE_RANK[rowPhase]);
    if (dist === 0) { score += 25; reasons.push('Same phase'); }
    else if (dist === 1) { score += 15; reasons.push('Adjacent phase'); }
    else { score += 5; }
  }

  // Indication (20)
  const sameIndication = isSameIndication(raw, asset.indication);
  if (sameIndication) { score += 20; reasons.push('Same indication'); }

  // Modality (20)
  const am = normalizeModality(asset.modality);
  const rm = normalizeModality(raw.modality);
  if (am && rm && am === rm) { score += 20; reasons.push('Same modality'); }
  else if (am && rm && modalityClass(am) && modalityClass(am) === modalityClass(rm)) { score += 12; reasons.push('Same modality class'); }

  // TA (15)
  const sameTA = isSameTA(raw, asset.therapeuticArea);
  if (sameTA) { score += 15; reasons.push('Same therapeutic area'); }

  // Territory (10)
  const ar = mapTerritory(asset.territory);
  const rr = mapTerritory(raw.territory);
  if (raw.territory && ar === rr) { score += 10; reasons.push('Same territory'); }
  else if (raw.territory && (ar === 'global' || rr === 'global')) { score += 5; }

  // Recency (10)
  const year = raw.announced_date ? Number(raw.announced_date.slice(0, 4)) : null;
  const rs = recencyScore(Number.isFinite(year as number) ? year : null);
  score += rs;
  if (rs >= 8) reasons.push('Recent');

  return { relevance: Math.max(0, Math.min(100, Math.round(score))), reasons, sameIndication, sameTA };
}

export function toCompRow(raw: RawDealRow, asset: AssetProfile): CompRow {
  const { relevance, reasons, sameIndication } = scoreRow(raw, asset);
  const year = raw.announced_date ? Number(raw.announced_date.slice(0, 4)) : null;
  return {
    id: String(raw.id),
    licensor: raw.licensor_name?.trim() || 'Undisclosed',
    licensee: raw.licensee_name?.trim() || 'Undisclosed',
    asset: raw.asset_name?.trim() || null,
    announcedDate: raw.announced_date ?? null,
    year: Number.isFinite(year as number) ? year : null,
    phase: normalizePhase(raw.phase_at_signing),
    structure: normalizeStructure(raw.deal_type),
    modality: raw.modality ?? null,
    indication: raw.indication_specific?.trim() || raw.indication_category || null,
    territory: raw.territory ?? null,
    upfrontM: usdToM(raw.upfront_usd),
    totalM: usdToM(raw.total_deal_value_usd),
    milestonesM: usdToM(raw.milestones_total_usd),
    royaltyLowPct: raw.royalty_low_pct ?? null,
    royaltyHighPct: raw.royalty_high_pct ?? null,
    equityM: usdToM(raw.equity_investment_usd),
    verified: raw.verified === true,
    sourceType: raw.source_type ?? null,
    sourceUrl: raw.source_url || raw.press_release_url || null,
    relevance,
    reasons,
    outlier: false,
    sameIndication,
  };
}

// ─── Pure builder ──────────────────────────────────────────────────────────

const PHASE_ORDER: DealPhase[] = ['discovery', 'preclinical', 'phase_1', 'phase_2', 'phase_3', 'approved', 'unknown'];
const STRUCTURE_ORDER: DealStructure[] = ['license', 'option', 'acquisition', 'collaboration', 'co_development', 'co_promotion', 'other'];

export function buildCompSetFromRows(
  rawRows: RawDealRow[],
  asset: AssetProfile,
  opts: { maxRows?: number; asOf?: string } = {},
): CompSet {
  const maxRows = opts.maxRows ?? 30;
  const asOf = opts.asOf ?? new Date().toISOString().slice(0, 10);

  // Candidates: same TA or same indication, with at least one economic term disclosed.
  const candidates = rawRows
    .filter((r) => r.upfront_usd != null || r.total_deal_value_usd != null)
    .filter((r) => isSameTA(r, asset.therapeuticArea) || isSameIndication(r, asset.indication))
    .map((r) => toCompRow(r, asset));

  const byRel = (a: CompRow, b: CompRow) => b.relevance - a.relevance || (b.year ?? 0) - (a.year ?? 0);
  const same = candidates.filter((r) => r.sameIndication).sort(byRel);
  const taOnly = candidates.filter((r) => !r.sameIndication).sort(byRel);
  const rows = [...same, ...taOnly].slice(0, maxRows);

  // Outliers on total: > p75 + 1.5·IQR of the selected set.
  const fence = outlierThreshold(rows.map((r) => r.totalM));
  rows.forEach((r) => { r.outlier = r.totalM != null && r.totalM > fence; });

  const exOutliers = rows.filter((r) => !r.outlier);
  const byPhase = PHASE_ORDER
    .map((phase) => ({ phase, stats: computeStats(rows.filter((r) => r.phase === phase)) }))
    .filter((b) => b.stats.n > 0);
  const byStructure = STRUCTURE_ORDER
    .map((structure) => ({ structure, stats: computeStats(rows.filter((r) => r.structure === structure)) }))
    .filter((b) => b.stats.n > 0);

  const headlineDriverIds = [...exOutliers].sort(byRel).slice(0, 8).map((r) => r.id);
  const verifiedCount = rows.filter((r) => r.verified).length;
  const sameN = rows.filter((r) => r.sameIndication).length;

  let caveat: string | undefined;
  if (sameN < 8) {
    caveat = sameN === 0
      ? `No same-indication comps passed the quality filter; the set is ${rows.length} therapeutic-area deals, so treat the medians as a class-level anchor rather than an indication price.`
      : `Only ${sameN} same-indication comp${sameN === 1 ? '' : 's'}; the set is filled to ${rows.length} with therapeutic-area deals, so the medians lean on class-level pricing.`;
  }

  return {
    source: {
      source: 'Solidus deal database',
      n: rows.length,
      asOf,
      note: `verified ${verifiedCount} of ${rows.length}; non-synthetic, canonical rows only`,
    },
    rows,
    stats: { all: computeStats(rows), exOutliers: computeStats(exOutliers) },
    byPhase,
    byStructure,
    headlineDriverIds,
    caveat,
  };
}

/** Rows for the term-sheet clause map: the same TA / indication candidate set, without the economic-terms requirement. */
export function selectClauseRows(rawRows: RawDealRow[], asset: AssetProfile): DealRowForClauses[] {
  return rawRows
    .filter((r) => isSameTA(r, asset.therapeuticArea) || isSameIndication(r, asset.indication))
    .map((r) => ({
      id: String(r.id),
      phase_at_signing: r.phase_at_signing,
      deal_type: r.deal_type,
      includes_co_development: r.includes_co_development,
      includes_co_promotion: r.includes_co_promotion,
      sublicense_rights: r.sublicense_rights,
      rights_retained: r.rights_retained,
      opt_in_rights: r.opt_in_rights,
      opt_in_stage: r.opt_in_stage,
      equity_investment_usd: r.equity_investment_usd,
      research_funding_usd: r.research_funding_usd,
      profit_share_pct: r.profit_share_pct,
      cost_share_ratio: r.cost_share_ratio,
      option_exercise_fee: r.option_exercise_fee,
      term_years: r.term_years,
      royalty_low_pct: r.royalty_low_pct,
      royalty_high_pct: r.royalty_high_pct,
      verified: r.verified,
    }));
}

// ─── Supabase access ───────────────────────────────────────────────────────

/** All quality-filtered deal rows, paged in 1,000s to stay under PostgREST caps. */
export async function fetchQualityDealRows(supabase: SupabaseClient): Promise<RawDealRow[]> {
  const out: RawDealRow[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase
      .from('deals')
      .select(DEAL_SELECT_COLUMNS)
      .eq('is_synthetic', false)
      .not('is_canonical', 'is', false)
      .not('verification_status', 'in', '("rejected","flagged")')
      .order('announced_date', { ascending: false, nullsFirst: false })
      .order('id', { ascending: true })
      .range(from, from + page - 1);
    if (error) throw new Error(`comp-set: deals query failed: ${error.message}`);
    const batch = (data ?? []) as unknown as RawDealRow[];
    out.push(...batch);
    if (batch.length < page) break;
  }
  return out;
}

export async function buildCompSet(
  supabase: SupabaseClient,
  asset: AssetProfile,
  opts: { maxRows?: number; asOf?: string } = {},
): Promise<CompSet> {
  const raw = await fetchQualityDealRows(supabase);
  return buildCompSetFromRows(raw, asset, opts);
}

export async function fetchDealRowsForClauses(supabase: SupabaseClient, asset: AssetProfile): Promise<DealRowForClauses[]> {
  const raw = await fetchQualityDealRows(supabase);
  return selectClauseRows(raw, asset);
}
