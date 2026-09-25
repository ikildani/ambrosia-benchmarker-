/**
 * Re-sourcing: attach a primary citation to real rows that have none.
 *
 * Why (Sep 25 2026): 1,133 of 1,650 real rows carried no citation — 699 came
 * from the early press-release pipeline that never stored the article URL, 413
 * from the Perplexity era — while the site promises primary-sourced data. This
 * job walks those rows and tries, in order:
 *   1. the press_releases archive: an item naming both parties within ±30 days
 *      of the announced date → press_release_url (issuer release);
 *   2. SEC full-text search: an 8-K/6-K naming both parties within ±45 days →
 *      source_filing_id + source_url (regulator filing).
 * A row it cannot source is stamped so it is not retried for 30 days.
 * Runs as an adapter in the rotating /api/cron/exchanges route.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { FunnelCounter } from './funnel';
import { eftsSearch, hitToDocument, fetchSecDocumentText } from './edgar-fts';
import { partyKey } from './dedupe';
import type { AdapterRunResult } from './exchanges/shared';

const RETRY_AFTER_DAYS = 30;
const STAMP = 'resource_attempted_at';

interface UncitedRow {
  id: string;
  licensor_name: string;
  licensee_name: string;
  asset_name: string | null;
  announced_date: string;
  source_type: string | null;
  total_deal_value_usd: number | null;
  extraction_notes: string | null;
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10);
}

/** Core token for an ilike probe: first 6 chars of the normalised party key. */
function token(name: string): string {
  const k = partyKey(name);
  return k.slice(0, Math.min(6, k.length));
}

export function mentionsBoth(text: string, licensor: string, licensee: string): boolean {
  const t = text.toLowerCase().replace(/[^a-z0-9]/g, '');
  const a = token(licensor), b = token(licensee);
  return a.length >= 4 && b.length >= 4 && t.includes(a) && t.includes(b);
}

async function findIssuerRelease(supabase: SupabaseClient, row: UncitedRow): Promise<{ url: string; title: string } | null> {
  const a = token(row.licensor_name), b = token(row.licensee_name);
  if (a.length < 4 || b.length < 4) return null;
  const { data } = await supabase
    .from('press_releases')
    .select('source_url, headline, published_at, body_text')
    .gte('published_at', addDays(row.announced_date, -30))
    .lte('published_at', addDays(row.announced_date, 30))
    .or(`headline.ilike.%${a}%,headline.ilike.%${b}%`)
    .limit(40);
  for (const pr of data ?? []) {
    const hay = `${pr.headline ?? ''} ${(pr.body_text ?? '').slice(0, 4000)}`;
    if (pr.source_url && mentionsBoth(hay, row.licensor_name, row.licensee_name)) return { url: pr.source_url, title: pr.headline ?? '' };
  }
  return null;
}

/**
 * The filer must be one of the parties. Sep 25 2026: without this, CSPC → AstraZeneca was pinned to a
 * Corbus exhibit and Daiichi → Merck to an AstraZeneca 6-K, because both names merely appeared in the text.
 */
export function filerIsParty(filerName: string, licensor: string, licensee: string): boolean {
  const f = partyKey(filerName);
  const a = partyKey(licensor), b = partyKey(licensee);
  if (f.length < 4) return false;
  const near = (x: string, y: string) => x.length >= 4 && y.length >= 4 && (x.includes(y.slice(0, Math.min(6, y.length))) || y.includes(x.slice(0, Math.min(6, x.length))));
  return near(f, a) || near(f, b);
}

async function findFiling(row: UncitedRow): Promise<{ accession: string; url: string; form: string } | null> {
  const q = `"${row.licensor_name.replace(/"/g, '')}" "${row.licensee_name.replace(/"/g, '')}"`;
  const page = await eftsSearch({ q, startdt: addDays(row.announced_date, -45), enddt: addDays(row.announced_date, 45), from: 0, size: 20 });
  if (page.status !== 200) return null;
  for (const hit of page.hits.slice(0, 8)) {
    const doc = hitToDocument(hit);
    if (!doc) continue;
    if (!filerIsParty(doc.companyName, row.licensor_name, row.licensee_name)) continue;
    const text = await fetchSecDocumentText(doc.url);
    if (text.ok && mentionsBoth(text.text.slice(0, 40_000), row.licensor_name, row.licensee_name)) return { accession: doc.accession, url: doc.url, form: doc.form };
  }
  return null;
}

export interface ResourceRunOptions {
  dryRun?: boolean;
  timeBudgetMs?: number;
  maxRows?: number;
}

export async function runResourcing(supabase: SupabaseClient, opts: ResourceRunOptions = {}): Promise<AdapterRunResult> {
  const start = Date.now();
  const budget = opts.timeBudgetMs ?? 90_000;
  const maxRows = opts.maxRows ?? 20;
  const dryRun = !!opts.dryRun;
  const funnel = new FunnelCounter();
  const errors: string[] = [];
  const retryBefore = new Date(Date.now() - RETRY_AFTER_DAYS * 86_400_000).toISOString();

  // Uncited real rows, highest value first, skipping rows attempted recently (stamp lives in extraction_notes).
  const { data, error } = await supabase
    .from('deals')
    .select('id, licensor_name, licensee_name, asset_name, announced_date, source_type, total_deal_value_usd, extraction_notes')
    .eq('is_synthetic', false)
    .is('source_filing_id', null)
    .is('press_release_url', null)
    .or(`source_url.is.null,source_type.not.in.(sec_8k,sec_6k,sec_10k,sec_10q,hkex,tdnet,asx,cninfo,mfn,dart,press_release)`)
    .order('total_deal_value_usd', { ascending: false, nullsFirst: false })
    .limit(maxRows * 3);
  if (error) errors.push(`queue read failed: ${error.message}`);
  const rows = ((data ?? []) as UncitedRow[]).filter(r => {
    const m = (r.extraction_notes ?? '').match(new RegExp(`${STAMP}=(\\d{4}-\\d{2}-\\d{2})`));
    return !m || m[1] < retryBefore.slice(0, 10);
  }).slice(0, maxRows);

  let attempted = 0, sourced = 0;
  for (const row of rows) {
    if (Date.now() - start > budget) { funnel.count('time_budget', 'rows_remaining'); break; }
    if (!row.announced_date || !row.licensor_name || !row.licensee_name) { funnel.count('missing_parties'); continue; }
    attempted++;
    funnel.count('fetched');
    try {
      const release = await findIssuerRelease(supabase, row);
      if (release) {
        if (!dryRun) await supabase.from('deals').update({
          press_release_url: release.url, source_url: release.url,
          source_type: row.source_type === 'manual' ? 'press_release' : row.source_type,
          extraction_notes: `${row.extraction_notes ?? ''} | re-sourced ${new Date().toISOString().slice(0, 10)}: issuer release "${release.title.slice(0, 80)}"`.trim(),
        }).eq('id', row.id);
        sourced++; funnel.count('inserted', 'issuer_release', `${row.licensor_name} → ${row.licensee_name}`);
        continue;
      }
      const filing = await findFiling(row);
      if (filing) {
        if (!dryRun) await supabase.from('deals').update({
          source_filing_id: filing.accession, source_url: filing.url,
          source_type: filing.form.startsWith('6-K') ? 'sec_6k' : 'sec_8k',
          extraction_notes: `${row.extraction_notes ?? ''} | re-sourced ${new Date().toISOString().slice(0, 10)}: ${filing.form} ${filing.accession}`.trim(),
        }).eq('id', row.id);
        sourced++; funnel.count('inserted', 'filing', `${row.licensor_name} → ${row.licensee_name}`);
        continue;
      }
      funnel.count('content_unavailable', 'no_primary_source_found', `${row.licensor_name} → ${row.licensee_name} ${row.announced_date}`);
      if (!dryRun) await supabase.from('deals').update({ extraction_notes: `${row.extraction_notes ?? ''} | ${STAMP}=${new Date().toISOString().slice(0, 10)}`.trim() }).eq('id', row.id);
    } catch (e) {
      funnel.count('extraction_error', undefined, String(e).slice(0, 120));
      errors.push(`${row.id}: ${String(e).slice(0, 160)}`);
    }
  }
  const summary = funnel.summary();
  console.log(`[resource] attempted=${attempted} sourced=${sourced} ${summary}${dryRun ? ' (dry run)' : ''}`);
  return { fetched: rows.length, candidates: attempted, extracted: attempted, inserted: sourced, errors, funnel: funnel.toJSON(), summary, parameters: { maxRows }, expectRecords: rows.length > 0 };
}
