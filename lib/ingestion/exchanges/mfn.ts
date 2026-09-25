/**
 * MFN (Modular Finance News) — regulatory-news distribution used by Nordic listed
 * companies and relaying EQS (Germany, Switzerland, Austria) and several French
 * issuers. Each item is the issuer's own regulatory release with the full body in
 * the RSS description, so it is a primary source: the citation is the MFN item URL.
 *
 * The feed carries the latest 48 items across all issuers and has no server-side
 * filter (verified 25 Sep 2026), so the adapter polls on every exchanges run and
 * keeps items whose title carries deal language and a life-science signal.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchWithTimeout } from '../../fetch-with-timeout';
import { FunnelCounter } from '../funnel';
import { processFilingText, type AdapterRunResult } from './shared';

export const MFN_FEED_URL = 'https://mfn.se/all/s.rss';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

/** English, Swedish/Danish/Norwegian, Finnish, German, French deal terms. */
const DEAL_TERMS = /licen[cs]|collaborat|partnership|co-development|option agreement|commerciali[sz]ation|distribution agreement|exclusive rights|term sheet|licensavtal|samarbetsavtal|lisenssisopimus|Lizenzvereinbarung|Lizenzabkommen|Kooperationsvereinbarung|accord de licence|contrat de licence|partenariat/i;
const EXCLUDE = /nombre d.actions|droits de vote|aktier och röster|number of shares|total number of votes|share buy-?back|omien osakkeiden|återköp|interim report|half-?year|delårsrapport|kvartalsrapport|annual general|årsstämma|nomination committee|valberedning|dividend|utdelning|insider|managers.? transactions|PDMR|patent (granted|approval)|regulatory approval|marketing authori[sz]ation|clinical trial (results|data)/i;
const PHARMA_HINT = /pharma|bio|thera|medic|oncol|vaccine|antibod|gene|cell|drug|läkemedel|lääke|Arznei|clinical|klinisk|santé|health/i;

export interface MfnItem {
  guid: string;
  title: string;
  link: string;
  pubDate: string;
  dateIso: string;
  description: string;
}

/** Minimal RSS item parser. Exported for tests. */
export function parseMfnFeed(xml: string): MfnItem[] {
  const out: MfnItem[] = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const it = m[1];
    const get = (tag: string) => {
      const r = it.match(new RegExp(`<${tag}(?:[^>]*)>([\\s\\S]*?)</${tag}>`));
      return r ? r[1].replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '').trim() : '';
    };
    const link = get('link');
    const pubDate = get('pubDate');
    const d = pubDate ? new Date(pubDate) : null;
    out.push({
      guid: get('guid') || link,
      title: decode(get('title')),
      link,
      pubDate,
      dateIso: d && !isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : '',
      description: decode(get('description').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim(),
    });
  }
  return out;
}

function decode(s: string): string {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function isMfnDealItem(title: string, description = ''): boolean {
  if (EXCLUDE.test(title)) return false;
  if (!DEAL_TERMS.test(title)) return false;
  return PHARMA_HINT.test(`${title} ${description.slice(0, 600)}`);
}

export async function fetchMfnFeed(): Promise<{ items: MfnItem[]; status: number }> {
  const res = await fetchWithTimeout(MFN_FEED_URL, { timeoutMs: 20_000, retries: 1, headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/xml, text/xml' } });
  if (!res.ok) return { items: [], status: res.status };
  return { items: parseMfnFeed(await res.text()), status: 200 };
}

export interface MfnRunOptions {
  anthropicApiKey: string;
  dryRun?: boolean;
  timeBudgetMs?: number;
  maxExtractions?: number;
  minConfidence?: number;
  reviewConfidence?: number;
}

export async function runMfnIngestion(supabase: SupabaseClient, opts: MfnRunOptions): Promise<AdapterRunResult> {
  const start = Date.now();
  const budget = opts.timeBudgetMs ?? 45_000;
  const maxExtractions = opts.maxExtractions ?? 6;
  const minConfidence = opts.minConfidence ?? 75;
  const reviewConfidence = opts.reviewConfidence ?? 60;
  const dryRun = !!opts.dryRun;
  const funnel = new FunnelCounter();
  const errors: string[] = [];

  const { items, status } = await fetchMfnFeed();
  if (status !== 200) errors.push(`MFN feed: HTTP ${status}`);
  const candidates = items.filter(i => { funnel.count('fetched'); const keep = isMfnDealItem(i.title, i.description); if (!keep) funnel.count('keyword_filtered', 'title'); return keep; });

  let extracted = 0, inserted = 0;
  for (const it of candidates) {
    if (Date.now() - start > budget) { funnel.count('time_budget', 'items_remaining'); break; }
    if (extracted >= maxExtractions) { funnel.count('time_budget', 'extraction_cap'); break; }
    try {
      extracted++;
      const id = it.guid.replace(/^https?:\/\//, '').slice(-120);
      const outcome = await processFilingText(supabase, {
        filingId: `mfn:${id}`, sourceType: 'mfn', sourceUrl: it.link, text: `${it.title}. ${it.description}`, announcedDate: it.dateIso,
        provenanceNote: `MFN regulatory release: ${it.title.slice(0, 120)}`, label: it.title.slice(0, 80),
      }, { anthropicApiKey: opts.anthropicApiKey, dryRun, minConfidence, reviewConfidence, funnel });
      if (outcome === 'inserted') inserted++;
      if (outcome === 'error') errors.push(`insert error ${id}`);
    } catch (e) {
      funnel.count('extraction_error', undefined, String(e).slice(0, 120));
      errors.push(`${it.link}: ${String(e).slice(0, 160)}`);
    }
  }
  const summary = funnel.summary();
  console.log(`[mfn] items=${items.length} candidates=${candidates.length} ${summary}${dryRun ? ' (dry run)' : ''}`);
  return { fetched: items.length, candidates: candidates.length, extracted, inserted, errors, funnel: funnel.toJSON(), summary, expectRecords: true };
}
