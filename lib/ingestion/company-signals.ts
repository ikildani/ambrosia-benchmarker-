/**
 * Shared pieces of the free company-signal sources (migration 189): HKEX announcements
 * (lib/ingestion/hkex-signals.ts) and SEC Form D (lib/ingestion/form-d.ts).
 *
 * company_financing_events holds one row per primary-source financing document. A row is never
 * written without a source_url and verbatim evidence (the announcement title, or the Form D
 * fields as filed).
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type FinancingEventType =
  | 'placing' | 'share_subscription' | 'rights_issue' | 'open_offer' | 'convertible_bonds'
  | 'form_d' | 'form_d_amendment';

export type FinancingSource = 'hkex_announcement' | 'sec_form_d';

export interface FinancingEventRow {
  company_id: string;
  event_type: FinancingEventType;
  /** Amount raised in USD (Form D totalAmountSold); null when the source does not state one. */
  amount_usd: number | null;
  /** Amount offered in USD (Form D totalOfferingAmount); null when indefinite or unstated. */
  amount_offered_usd: number | null;
  currency: string | null;
  /** Date the document became public (point-in-time features key on this). */
  announced_at: string;
  source: FinancingSource;
  source_url: string;
  /** HKEX NEWS_ID or SEC accession number; unique per source. */
  source_id: string;
  evidence: string;
  industry_group: string | null;
  filer_cik: string | null;
  metadata: Record<string, unknown>;
  fetched_at: string;
}

/** Event types that are amendments of an earlier event; never counted as a new raise. */
export const AMENDMENT_EVENT_TYPES: ReadonlySet<string> = new Set(['form_d_amendment']);

const NAMED_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** Decode the HTML entities HKEX and SEC put in titles (&#x27; &#x2f; &amp; &#39;). */
export function decodeHtmlEntities(s: string): string {
  return (s ?? '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, body: string) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? m;
  });
}

/** Rows that satisfy the evidence invariant; anything else is dropped before a write. */
export function validFinancingRows(rows: FinancingEventRow[]): FinancingEventRow[] {
  return rows.filter(r => r.company_id && r.source_url && /^https:\/\//.test(r.source_url) && r.source_id && r.evidence?.trim() && /^\d{4}-\d{2}-\d{2}$/.test(r.announced_at));
}

export async function upsertFinancingEvents(supabase: SupabaseClient, rows: FinancingEventRow[]): Promise<{ written: number; error?: string }> {
  const valid = validFinancingRows(rows);
  if (valid.length === 0) return { written: 0 };
  const { error } = await supabase.from('company_financing_events').upsert(valid, { onConflict: 'company_id,source,source_id' });
  if (error) return { written: 0, error: error.message };
  return { written: valid.length };
}

/** True when migration 189 is applied (the table answers a head count). */
export async function companySignalsSchemaReady(supabase: SupabaseClient): Promise<{ ready: boolean; error?: string }> {
  const { error } = await supabase.from('company_financing_events').select('id', { count: 'exact', head: true }).limit(1);
  if (error) return { ready: false, error: error.message || 'company_financing_events unreadable' };
  return { ready: true };
}

export type CompanySignalsMode = 'financials' | 'hkex' | 'hkex_match' | 'hkex_announcements' | 'form_d';
export const COMPANY_SIGNAL_MODES: readonly CompanySignalsMode[] = ['financials', 'hkex', 'hkex_match', 'hkex_announcements', 'form_d'];

/**
 * Mode of an unparameterized /api/cron/company-financials run (every 2 h at :20) by UTC hour:
 * financials keeps its four runs a day (00, 06, 12, 18), HKEX and Form D take the hours between.
 */
export function modeForHour(hour: number): CompanySignalsMode {
  const h = ((Math.trunc(hour) % 24) + 24) % 24;
  if (h % 6 === 2) return 'hkex';
  if (h % 6 === 4) return 'form_d';
  return 'financials';
}
