/**
 * Comp set report: the comparable-deal set a user gets after benchmarking a
 * program, delivered as a web page (/comps/<token>) in the Deal Intelligence
 * Brief format rather than as an attachment.
 *
 * The calculation-convert cron builds the set from the user's latest
 * calculation, snapshots it into comp_set_reports (migration 169) and emails
 * the link. The page renders the snapshot, so it always matches the email.
 *
 * Every comparable comes from `deals_verified` (CLAUDE.md: product surfaces
 * read the verified view): nothing synthetic, duplicate, rejected or flagged.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';
import { buildCompSetFromRows, computeStats, DEAL_SELECT_COLUMNS, type RawDealRow } from '@/lib/brief/comp-set';
import type { AssetProfile, CompRow, CompSet, CompStats, DealPhase, DealStructure } from '@/lib/brief/types';
import { INDICATION_REGISTRY } from '@/lib/benchmarkPagesIndication';

export const SITE = 'https://solidus.ambrosiaventures.co';

/** Fewer priced comparables than this and the set is not worth sending. */
export const MIN_COMPS = 5;

// ─── Data ──────────────────────────────────────────────────────────────────

/** Every verified deal, paged in 1,000s. Fetched once per cron run and reused for every user. */
export async function fetchVerifiedDealRows(supabase: SupabaseClient): Promise<RawDealRow[]> {
  const out: RawDealRow[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase
      .from('deals_verified')
      .select(DEAL_SELECT_COLUMNS)
      // A terminated, expired or cancelled deal is not a precedent for what a buyer will pay now.
      .or('deal_status.is.null,deal_status.not.in.("terminated","expired","cancelled")')
      .order('announced_date', { ascending: false, nullsFirst: false })
      .order('id', { ascending: true })
      .range(from, from + page - 1);
    if (error) throw new Error(`comp set: deals_verified query failed: ${error.message}`);
    const batch = (data ?? []) as unknown as RawDealRow[];
    out.push(...batch);
    if (batch.length < page) break;
  }
  return out;
}

/** The calculations-table columns this module reads. */
export interface CalculationRow {
  id: string;
  user_id: string;
  created_at: string;
  therapeutic_area: string | null;
  modality: string | null;
  development_phase: string | null;
  indication_category: string | null;
  indication_specific: string | null;
  territory_scope: string | null;
  deal_type: string | null;
  output_upfront_low: number | string | null;
  output_upfront_mid: number | string | null;
  output_upfront_high: number | string | null;
  output_total_deal_value_low: number | string | null;
  output_total_deal_value_high: number | string | null;
  output_royalty_low: number | string | null;
  output_royalty_high: number | string | null;
}

export const CALCULATION_COLUMNS =
  'id, user_id, created_at, therapeutic_area, modality, development_phase, indication_category, indication_specific, territory_scope, deal_type, output_upfront_low, output_upfront_mid, output_upfront_high, output_total_deal_value_low, output_total_deal_value_high, output_royalty_low, output_royalty_high';

// ─── Labels ────────────────────────────────────────────────────────────────

const REGISTRY_LABEL = new Map(INDICATION_REGISTRY.map((d) => [d.value.toLowerCase(), d.label]));

export function humanize(key: string): string {
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function indicationLabel(key: string | null | undefined): string | null {
  if (!key) return null;
  return REGISTRY_LABEL.get(key.toLowerCase()) ?? humanize(key);
}

const PHASE_LABEL: Record<string, string> = {
  discovery: 'Discovery', preclinical: 'Preclinical', phase1: 'Phase 1', phase1_2: 'Phase 1/2', phase2: 'Phase 2',
  phase2b: 'Phase 2b', phase3: 'Phase 3', nda: 'NDA/BLA', approved: 'Approved',
};
export const phaseLabel = (k: string | null | undefined): string => (k ? PHASE_LABEL[k] ?? humanize(k) : 'Unspecified phase');

const MODALITY_LABEL: Record<string, string> = {
  smallMolecule: 'small molecule', mab: 'antibody', adc: 'ADC', bispecific: 'bispecific', cellTherapy: 'cell therapy',
  geneTherapy: 'gene therapy', rnai: 'RNAi', aso: 'ASO', mrna: 'mRNA', peptide: 'peptide', vaccine: 'vaccine',
  radiopharm: 'radiopharmaceutical', glp1Agonist: 'GLP-1 agonist', degrader: 'degrader',
};
export const modalityLabel = (k: string | null | undefined): string => (k ? MODALITY_LABEL[k] ?? humanize(k).toLowerCase() : '');

const TA_LABEL: Record<string, string> = {
  oncology: 'Oncology', neurology: 'Neurology', immunology: 'Immunology', metabolic: 'Metabolic', cardiovascular: 'Cardiovascular',
  infectiousDisease: 'Infectious disease', ophthalmology: 'Ophthalmology', rareDisease: 'Rare disease', hematology: 'Hematology',
  dermatology: 'Dermatology', gastroenterology: 'Gastroenterology', womensHealth: "Women's health", respiratory: 'Respiratory',
};
export const taLabel = (k: string | null | undefined): string => (k ? TA_LABEL[k] ?? humanize(k) : '');

const DEAL_TYPE_LABEL: Record<string, string> = {
  licensing: 'License', acquisition: 'Acquisition', option: 'Option', codevelopment: 'Co-development', collaboration: 'Collaboration',
};
export const dealTypeLabel = (k: string | null | undefined): string => (k ? DEAL_TYPE_LABEL[k] ?? humanize(k) : 'License');

export const STRUCTURE_LABEL: Record<DealStructure, string> = {
  license: 'License', option: 'Option', acquisition: 'Acquisition', collaboration: 'Collaboration',
  co_development: 'Co-development', co_promotion: 'Co-promotion', other: 'Other',
};
export const DEAL_PHASE_LABEL: Record<DealPhase, string> = {
  discovery: 'Discovery', preclinical: 'Preclinical', phase_1: 'Phase 1', phase_2: 'Phase 2', phase_3: 'Phase 3', approved: 'Approved', unknown: 'Not disclosed',
};

const PHASE_ORDER: DealPhase[] = ['discovery', 'preclinical', 'phase_1', 'phase_2', 'phase_3', 'approved', 'unknown'];
const STRUCTURE_ORDER: DealStructure[] = ['license', 'option', 'acquisition', 'collaboration', 'co_development', 'co_promotion', 'other'];

// ─── Comp set ──────────────────────────────────────────────────────────────

/** Map a saved calculation to the comp-set builder's asset profile. Null when it lacks the basics. */
export function assetFromCalculation(calc: CalculationRow): AssetProfile | null {
  const indication = calc.indication_specific || calc.indication_category;
  if (!calc.therapeutic_area || !calc.development_phase || !indication) return null;
  return {
    modality: calc.modality ?? '',
    phase: calc.development_phase,
    indication,
    indicationLabel: indicationLabel(indication),
    therapeuticArea: calc.therapeutic_area,
    territory: calc.territory_scope ?? 'global',
    targetDealType: calc.deal_type ?? 'licensing',
  };
}

export function buildUserCompSet(rows: RawDealRow[], asset: AssetProfile): CompSet {
  return buildCompSetFromRows(rows, asset, { maxRows: 30 });
}

/** True when the comp set is strong enough to put in front of a prospect. */
export function compSetIsSendable(cs: CompSet): boolean {
  return cs.rows.filter((r) => r.upfrontM != null || r.totalM != null).length >= MIN_COMPS;
}

/**
 * Same buyer with identical upfront and total is almost always one deal filed
 * twice under two names for the licensor (e.g. a company and its JV). Show it
 * once; the underlying rows are left for the dedupe pipeline.
 */
export function dedupeForDisplay(rows: CompRow[]): CompRow[] {
  const seen = new Set<string>();
  return rows.filter((r) => {
    const key = `${r.licensee.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12)}|${r.upfrontM ?? '-'}|${r.totalM ?? '-'}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── Snapshot ──────────────────────────────────────────────────────────────

interface Range { low: number; high: number; mid?: number | null }

export interface CompSetReport {
  version: 1;
  /** Shown on the page, e.g. CS-20260929-7K2Q. */
  reportId: string;
  generatedAt: string;
  preparedFor: string | null;
  program: {
    phase: string;
    phaseLabel: string;
    modality: string;
    modalityLabel: string;
    indication: string;
    indicationLabel: string;
    therapeuticArea: string;
    therapeuticAreaLabel: string;
    territory: string;
    dealType: string;
    dealTypeLabel: string;
  };
  /** The user's own calculator output ($M; royalty in %). Null fields when not saved. */
  benchmark: { upfront: Range | null; total: Range | null; royalty: Range | null };
  /** Stats used for the headline: ex-outliers when that leaves enough rows. */
  headline: CompStats;
  statsAll: CompStats;
  byPhase: CompSet['byPhase'];
  byStructure: CompSet['byStructure'];
  phaseWindowLabel: string;
  caveat: string | null;
  sameIndicationCount: number;
  /** Display rows: priced, de-duplicated, same indication first. */
  rows: CompRow[];
}

const num = (v: number | string | null | undefined): number | null => {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

function range(lo: number | string | null, hi: number | string | null, mid?: number | string | null): Range | null {
  const l = num(lo);
  const h = num(hi);
  return l != null && h != null ? { low: l, high: h, mid: num(mid ?? null) } : null;
}

function reportIdFor(date: Date, token: string): string {
  return `CS-${date.toISOString().slice(0, 10).replace(/-/g, '')}-${token.slice(0, 4).toUpperCase()}`;
}

export function buildCompSetReport(opts: {
  calc: CalculationRow;
  asset: AssetProfile;
  compSet: CompSet;
  preparedFor: string | null;
  token: string;
  now?: Date;
}): CompSetReport {
  const { calc, asset, compSet } = opts;
  const now = opts.now ?? new Date();
  const priced = compSet.rows.filter((r) => r.upfrontM != null || r.totalM != null);
  const rows = dedupeForDisplay([...priced.filter((r) => !r.outlier), ...priced.filter((r) => r.outlier)]);
  // Every figure on the page is computed from the rows the page shows, so the
  // counts in the breakdown always add up to the table.
  const exOutliers = computeStats(rows.filter((r) => !r.outlier));
  const statsAll = computeStats(rows);
  const headline = exOutliers.n >= MIN_COMPS ? exOutliers : statsAll;
  const byPhase = PHASE_ORDER
    .map((phase) => ({ phase, stats: computeStats(rows.filter((r) => r.phase === phase)) }))
    .filter((b) => b.stats.n > 0);
  const byStructure = STRUCTURE_ORDER
    .map((structure) => ({ structure, stats: computeStats(rows.filter((r) => r.structure === structure)) }))
    .filter((b) => b.stats.n > 0);
  return {
    version: 1,
    reportId: reportIdFor(now, opts.token),
    generatedAt: now.toISOString(),
    preparedFor: opts.preparedFor,
    program: {
      phase: asset.phase,
      phaseLabel: phaseLabel(calc.development_phase),
      modality: asset.modality,
      modalityLabel: modalityLabel(calc.modality),
      indication: asset.indication,
      indicationLabel: asset.indicationLabel || indicationLabel(asset.indication) || asset.indication,
      therapeuticArea: asset.therapeuticArea,
      therapeuticAreaLabel: taLabel(asset.therapeuticArea),
      territory: asset.territory,
      dealType: asset.targetDealType,
      dealTypeLabel: dealTypeLabel(calc.deal_type),
    },
    benchmark: {
      upfront: range(calc.output_upfront_low, calc.output_upfront_high, calc.output_upfront_mid),
      total: range(calc.output_total_deal_value_low, calc.output_total_deal_value_high),
      royalty: range(calc.output_royalty_low, calc.output_royalty_high),
    },
    headline,
    statsAll,
    byPhase,
    byStructure,
    phaseWindowLabel: compSet.phaseWindow?.label ?? 'any phase',
    caveat: compSet.caveat ?? null,
    sameIndicationCount: rows.filter((r) => r.sameIndication).length,
    rows,
  };
}

/** 16 URL-safe characters: unguessable, short enough for an email link. */
export function newReportToken(): string {
  return randomBytes(12).toString('base64url');
}

export function compSetReportUrl(token: string): string {
  return `${SITE}/comps/${token}`;
}

export async function saveCompSetReport(
  supabase: SupabaseClient,
  row: { token: string; userId: string; calculationId: string; report: CompSetReport },
): Promise<void> {
  const { error } = await supabase.from('comp_set_reports').insert({
    token: row.token,
    user_id: row.userId,
    calculation_id: row.calculationId,
    report: row.report,
  });
  if (error) throw new Error(`comp_set_reports insert failed: ${error.message}`);
}

export interface StoredCompSetReport {
  report: CompSetReport;
  userId: string | null;
  expired: boolean;
}

/** Loads a report by token and counts the view. Null for an unknown or malformed token. */
export async function loadCompSetReport(supabase: SupabaseClient, token: string, opts: { countView?: boolean } = {}): Promise<StoredCompSetReport | null> {
  if (!/^[A-Za-z0-9_-]{16}$/.test(token)) return null;
  const { data, error } = await supabase
    .from('comp_set_reports')
    .select('id, user_id, report, expires_at, view_count, first_viewed_at')
    .eq('token', token)
    .maybeSingle();
  if (error || !data) return null;
  const expired = new Date(data.expires_at).getTime() < Date.now();

  if (opts.countView && !expired) {
    const nowIso = new Date().toISOString();
    await supabase
      .from('comp_set_reports')
      .update({ view_count: (data.view_count ?? 0) + 1, last_viewed_at: nowIso, first_viewed_at: data.first_viewed_at ?? nowIso })
      .eq('id', data.id);
    if (!data.first_viewed_at) {
      await supabase.from('events').insert({
        user_id: data.user_id,
        event_type: 'comp_set_viewed',
        event_data: { token_prefix: token.slice(0, 4) },
      });
    }
  }

  return { report: data.report as CompSetReport, userId: data.user_id, expired };
}

// ─── Formatting ────────────────────────────────────────────────────────────

/** $M in, "$80M" / "$1.9B" out. */
export function fmtM(m: number | null | undefined): string {
  if (m == null || !Number.isFinite(m)) return 'n/d';
  if (m >= 1000) return `$${(m / 1000).toFixed(m >= 10_000 ? 0 : 1)}B`;
  if (m >= 10) return `$${Math.round(m)}M`;
  return `$${m.toFixed(1)}M`;
}

export const fmtPct = (v: number | null | undefined): string => (v == null ? 'n/d' : `${Math.round(v * 10) / 10}%`);
