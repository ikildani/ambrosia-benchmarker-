/**
 * The one door into the deals table for ingestion.
 *
 * World-class rule (Sep 2026): every row that ingestion writes carries a
 * citation a reader can click. This helper refuses anything without
 * source_url, press_release_url or source_filing_id, normalises source_type
 * to the values the database accepts, and stamps the audit fields every
 * pipeline used to set slightly differently. Callers pass the extracted
 * fields; they never build the insert themselves.
 *
 * Migration 113 mirrors the citation rule as a BEFORE INSERT trigger so a
 * future pipeline that bypasses this helper is still stopped at the database.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

/** Values accepted by deals_source_type_check (migrations 113, 114, 120, 121). */
export const DEAL_SOURCE_TYPES = [
  'sec_8k', 'sec_10k', 'sec_10q', 'sec_6k', 'press_release', 'clinicaltrials', 'manual', 'openfda',
  'hkex', 'edinet', 'tdnet', 'dart', 'sedar', 'asx', 'perplexity_discovery', 'other',
] as const;
export type DealSourceType = (typeof DEAL_SOURCE_TYPES)[number];

/** Values the constraint accepted before migration 113; used to degrade safely until it is applied. */
const LEGACY_SOURCE_TYPES: ReadonlySet<string> = new Set(['sec_8k', 'sec_10k', 'sec_10q', 'press_release', 'clinicaltrials', 'manual', 'openfda', 'other']);

/** Legacy names that pipelines wrote and the constraint rejected. */
const SOURCE_TYPE_ALIASES: Record<string, DealSourceType> = {
  sec_8k_realtime: 'sec_8k',
  '8-K': 'sec_8k',
  '8-K/A': 'sec_8k',
  '6-K': 'sec_6k',
  '10-K': 'sec_10k',
  '10-Q': 'sec_10q',
  '20-F': 'sec_10k',
  press: 'press_release',
  news: 'press_release',
};

export function normaliseSourceType(value: string | null | undefined): DealSourceType {
  if (!value) return 'other';
  const v = SOURCE_TYPE_ALIASES[value] ?? (value as DealSourceType);
  return (DEAL_SOURCE_TYPES as readonly string[]).includes(v) ? v : 'other';
}

export interface CitedDealInsert {
  /** Row fields exactly as the deals table expects them (licensor_name, upfront_usd, ...). */
  row: Record<string, unknown>;
  /** Where the row came from. Required. */
  sourceType: string;
  /** At least one of these must be present. */
  sourceUrl?: string | null;
  pressReleaseUrl?: string | null;
  sourceFilingId?: string | null;
  /** Model that produced the extraction, e.g. 'claude-opus-4-6'. */
  extractionModel: string;
  /** Free-text provenance note appended to extraction_notes. */
  provenanceNote?: string;
}

export interface CitedDealInsertResult {
  ok: boolean;
  /** 'inserted' | 'duplicate' | 'rejected_no_citation' | 'error' */
  outcome: 'inserted' | 'duplicate' | 'rejected_no_citation' | 'error';
  id?: string;
  error?: string;
}

export class MissingCitationError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'MissingCitationError';
  }
}

/**
 * Build the row that will be inserted, without touching the database.
 * Exported so dry runs and tests can see exactly what would be written.
 */
export function buildCitedDealRow(input: CitedDealInsert, opts: { legacyConstraint?: boolean } = {}): Record<string, unknown> {
  const sourceUrl = input.sourceUrl?.trim() || null;
  const pressReleaseUrl = input.pressReleaseUrl?.trim() || null;
  const sourceFilingId = input.sourceFilingId?.trim() || null;
  if (!sourceUrl && !pressReleaseUrl && !sourceFilingId) {
    throw new MissingCitationError(
      `Refusing to insert ${String(input.row.licensor_name)} → ${String(input.row.licensee_name)}: no source_url, press_release_url or source_filing_id`,
    );
  }
  let sourceType = normaliseSourceType(input.sourceType);
  // Until migration 113 widens the check constraint, non-SEC exchange sources
  // are stored as 'other' with the real origin kept in extraction_notes.
  const originNote = !LEGACY_SOURCE_TYPES.has(sourceType) && opts.legacyConstraint ? `origin=${sourceType}` : null;
  if (originNote) sourceType = 'other';

  const notes = [input.row.extraction_notes, input.provenanceNote, originNote].filter(Boolean).join(' | ') || null;

  return {
    ...input.row,
    source_type: sourceType,
    source_url: sourceUrl,
    press_release_url: pressReleaseUrl ?? (input.row.press_release_url as string | undefined) ?? null,
    source_filing_id: sourceFilingId,
    extraction_model: input.extractionModel,
    extraction_timestamp: new Date().toISOString(),
    extraction_notes: notes,
    verification_status: (input.row.verification_status as string | undefined) ?? 'pending',
    is_synthetic: false,
    terms_disclosed:
      input.row.terms_disclosed ??
      (input.row.upfront_usd != null || input.row.milestones_total_usd != null || input.row.total_deal_value_usd != null),
  };
}

/**
 * Insert one cited deal. Never throws for database errors; returns an outcome
 * the caller feeds into its funnel. Throws MissingCitationError only when the
 * caller tried to write an uncited row, which is a programming error.
 */
export async function insertCitedDeal(
  supabase: SupabaseClient,
  input: CitedDealInsert,
  opts: { dryRun?: boolean; legacyConstraint?: boolean } = {},
): Promise<CitedDealInsertResult> {
  let row: Record<string, unknown>;
  try {
    row = buildCitedDealRow(input, { legacyConstraint: opts.legacyConstraint });
  } catch (e) {
    if (e instanceof MissingCitationError) return { ok: false, outcome: 'rejected_no_citation', error: e.message };
    throw e;
  }
  if (opts.dryRun) return { ok: true, outcome: 'inserted' };

  const { data, error } = await supabase.from('deals').insert(row).select('id').single();
  if (error) {
    if (error.code === '23505') return { ok: false, outcome: 'duplicate', error: error.message };
    // Constraint not yet widened for a new exchange source: retry as 'other'.
    if (!opts.legacyConstraint && /source_type_check/.test(error.message)) {
      return insertCitedDeal(supabase, input, { ...opts, legacyConstraint: true });
    }
    return { ok: false, outcome: 'error', error: error.message };
  }
  return { ok: true, outcome: 'inserted', id: data?.id as string | undefined };
}
