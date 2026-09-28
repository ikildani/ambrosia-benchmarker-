/**
 * Company website + pipeline-page discovery.
 *
 * companies.website_url is empty for every industry company (the universe
 * came from trial registries, which carry sponsor names only). One web
 * search per company (Claude Haiku with the server-side web_search tool)
 * returns the official site and, when it exists, the pipeline page. Pure
 * helpers validate what comes back: no aggregators, registries, newswires or
 * social profiles, hosts must resolve, and the pipeline URL must sit on the
 * same registrable domain as the site.
 *
 * Runs inside the pipeline crawler on GitHub Actions
 * (scripts/pipeline-crawler.ts --discover N), never on Vercel: the cron table
 * is at its 100-entry cap.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';
import { addUsage, emptyUsage, type IntentClient, type TokenUsage } from './management-intent';

export const DISCOVERY_MODEL = 'claude-haiku-4-5-20251001';
/** USD per web search (server tool), on top of tokens. */
export const WEB_SEARCH_USD = 0.01;
export const DISCOVERY_RECHECK_DAYS = 120;
const MAX_TOKENS = 600;

/** Hosts that are never a company's own site. Matched on the registrable domain or any parent. */
export const BLOCKED_DOMAINS: ReadonlySet<string> = new Set([
  'linkedin.com', 'crunchbase.com', 'pitchbook.com', 'zoominfo.com', 'bloomberg.com', 'reuters.com', 'wikipedia.org',
  'wikidata.org', 'clinicaltrials.gov', 'sec.gov', 'globenewswire.com', 'prnewswire.com', 'businesswire.com',
  'biospace.com', 'fiercebiotech.com', 'fiercepharma.com', 'endpts.com', 'biopharmadive.com', 'statnews.com',
  'evaluate.com', 'globaldata.com', 'cortellis.com', 'clarivate.com', 'citeline.com', 'drugbank.com', 'adisinsight.springer.com',
  'facebook.com', 'twitter.com', 'x.com', 'instagram.com', 'youtube.com', 'glassdoor.com', 'indeed.com', 'owler.com',
  'dnb.com', 'opencorporates.com', 'companieshouse.gov.uk', 'nasdaq.com', 'nyse.com', 'marketwatch.com', 'yahoo.com',
  'google.com', 'bing.com', 'medium.com', 'substack.com', 'nih.gov', 'europa.eu', 'who.int', 'fda.gov', 'ema.europa.eu',
  'pubmed.ncbi.nlm.nih.gov', 'ncbi.nlm.nih.gov', 'biorxiv.org', 'sciencedirect.com', 'nature.com', 'springer.com',
  'solidus.ambrosiaventures.co', 'ambrosiaventures.co', 'tracxn.com', 'cbinsights.com', 'craft.co', 'rocketreach.co',
  'signalhire.com', 'apollo.io', 'lusha.com', 'theorg.com', 'bloomberg.com', 'ft.com', 'wsj.com', 'forbes.com',
  'labiotech.eu', 'genengnews.com', 'pharmaceutical-technology.com', 'biopharmatrend.com', 'synapse.patsnap.com', 'patsnap.com',
]);

const TWO_LEVEL_TLDS = new Set(['co.uk', 'co.jp', 'co.kr', 'com.au', 'com.cn', 'com.hk', 'co.il', 'com.sg', 'com.tw', 'co.in', 'com.br', 'co.nz', 'org.uk', 'ac.uk', 'or.jp', 'ne.jp']);

/** Registrable domain: last two labels, or three for known two-level TLDs. */
export function registrableDomain(host: string): string {
  const parts = host.toLowerCase().replace(/\.$/, '').split('.').filter(Boolean);
  if (parts.length <= 2) return parts.join('.');
  const lastTwo = parts.slice(-2).join('.');
  return TWO_LEVEL_TLDS.has(lastTwo) ? parts.slice(-3).join('.') : lastTwo;
}

export function isBlockedHost(host: string): boolean {
  const h = host.toLowerCase();
  for (const d of BLOCKED_DOMAINS) if (h === d || h.endsWith(`.${d}`)) return true;
  return false;
}

/** Normalise a URL the model returned: https, no fragment, no tracking query, trailing slash on bare hosts. */
export function normalizeUrl(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null;
  let s = raw.trim().replace(/^<|>$/g, '').replace(/[.,;)\]]+$/, '');
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  let u: URL;
  try { u = new URL(s); } catch { return null; }
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(u.hostname)) return null;
  u.hash = '';
  for (const k of [...u.searchParams.keys()]) if (/^(utm_|fbclid|gclid|ref$)/i.test(k)) u.searchParams.delete(k);
  u.protocol = 'https:';
  const out = u.toString();
  return out.length > 300 ? null : out;
}

export interface DiscoveredSite {
  website_url: string | null;
  pipeline_url: string | null;
  confidence: number;
  note: string | null;
}

/** Validate a candidate pair: real host, not an aggregator, pipeline page on the same domain. */
export function validateDiscovery(raw: { website?: unknown; pipeline?: unknown; confidence?: unknown; note?: unknown }): DiscoveredSite {
  const website = normalizeUrl(typeof raw.website === 'string' ? raw.website : null);
  let pipeline = normalizeUrl(typeof raw.pipeline === 'string' ? raw.pipeline : null);
  const confidence = Math.max(0, Math.min(100, Number(raw.confidence) || 0));
  const note = typeof raw.note === 'string' ? raw.note.slice(0, 160) : null;
  if (!website) return { website_url: null, pipeline_url: null, confidence: 0, note: note ?? 'no website' };
  const host = new URL(website).hostname;
  if (isBlockedHost(host)) return { website_url: null, pipeline_url: null, confidence: 0, note: `blocked host ${host}` };
  if (pipeline) {
    const ph = new URL(pipeline).hostname;
    if (registrableDomain(ph) !== registrableDomain(host)) pipeline = null;
  }
  return { website_url: website, pipeline_url: pipeline, confidence, note };
}

export const DISCOVERY_SYSTEM = `You find the official website of a biopharma company and, if it exists, the page on that site that lists the company's drug pipeline (often titled Pipeline, Our Pipeline, Programs, Portfolio, Science, R&D, or Products in Development).

Rules:
- Search once or twice; prefer results whose domain is clearly the company's own (not LinkedIn, Crunchbase, news sites, registries, aggregators, stock exchanges).
- The pipeline page must be on the same domain as the website. If you cannot find one, return null for it.
- Companies can be private, small, or non-English; the site may be in Chinese, Japanese, Korean, German or French. That is fine.
- If several companies share the name, pick the drug developer that matches the hint (country, therapeutic area, trial).
- If no official site can be found, return null for website.

Answer with ONLY a JSON object on the last line:
{"website": "https://...", "pipeline": "https://.../pipeline" | null, "confidence": 0-100, "note": "<= 20 words"}`;

export function buildDiscoveryPrompt(company: { name: string; hq_country?: string | null; hint?: string | null }): string {
  const bits = [`Company: ${company.name}`];
  if (company.hq_country) bits.push(`Country: ${company.hq_country}`);
  if (company.hint) bits.push(`Hint: ${company.hint}`);
  return bits.join('\n');
}

/** The JSON object on the last line of the model's final text block. */
export function parseDiscoveryText(text: string): Record<string, unknown> | null {
  const lines = text.trim().split('\n').reverse();
  for (const line of lines) {
    const m = line.match(/\{[\s\S]*\}/);
    if (!m) continue;
    try { return JSON.parse(m[0]) as Record<string, unknown>; } catch { /* keep looking */ }
  }
  const any = text.match(/\{[\s\S]*"website"[\s\S]*\}/);
  if (any) { try { return JSON.parse(any[0]) as Record<string, unknown>; } catch { return null; } }
  return null;
}

export interface DiscoveryCall { site: DiscoveredSite; usage: TokenUsage; searches: number; error: string | null }

export async function discoverCompanySite(
  client: IntentClient,
  company: { name: string; hq_country?: string | null; hint?: string | null },
  model = DISCOVERY_MODEL,
): Promise<DiscoveryCall> {
  const usage = emptyUsage();
  try {
    const msg = await client.messages.create({
      model,
      max_tokens: MAX_TOKENS,
      system: DISCOVERY_SYSTEM,
      messages: [{ role: 'user', content: buildDiscoveryPrompt(company) }],
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 2 }],
    } as Anthropic.MessageCreateParamsNonStreaming);
    addUsage(usage, msg.usage as unknown as Partial<TokenUsage>);
    const searches = Number((msg.usage as unknown as { server_tool_use?: { web_search_requests?: number } }).server_tool_use?.web_search_requests ?? 0);
    const text = msg.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map(b => b.text).join('\n');
    const parsed = parseDiscoveryText(text);
    if (!parsed) return { site: { website_url: null, pipeline_url: null, confidence: 0, note: 'no JSON in answer' }, usage, searches, error: null };
    return { site: validateDiscovery(parsed), usage, searches, error: null };
  } catch (err) {
    return { site: { website_url: null, pipeline_url: null, confidence: 0, note: null }, usage, searches: 0, error: err instanceof Error ? err.message.split('\n')[0].slice(0, 200) : String(err) };
  }
}

/**
 * Reject only hosts that do not resolve. Bot-blocking sites answer 403 or
 * reset the connection; the browser crawler handles those, so they stay.
 */
export async function hostResponds(url: string, timeoutMs = 12_000): Promise<boolean> {
  try {
    await fetchWithTimeout(url, { method: 'GET', timeoutMs, retries: 0, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SolidusBot/1.0; +https://solidus.ambrosiaventures.co)' } });
    return true;
  } catch (err) {
    const msg = `${err instanceof Error ? err.message : err} ${String((err as { cause?: { code?: string } })?.cause?.code ?? '')}`;
    return !/ENOTFOUND|EAI_AGAIN|getaddrinfo|ERR_NAME_NOT_RESOLVED/i.test(msg);
  }
}

export interface DiscoveryRunOptions {
  limit?: number;
  costCapUsd?: number;
  timeBudgetMs?: number;
  client?: IntentClient;
  now?: Date;
  /** Skip the liveness check (tests). */
  skipHostCheck?: boolean;
}

export interface DiscoveryRunResult {
  processed: number;
  found: number;
  withPipeline: number;
  notFound: number;
  dead: number;
  searches: number;
  usage: TokenUsage;
  costUsd: number;
  errors: string[];
  timedOut: boolean;
  costCapHit: boolean;
  sample: Array<{ company: string; website: string | null; pipeline: string | null }>;
}

interface CompanyRow { id: string; name: string; hq_country: string | null; indications_active: string[] | null; active_trials_count: number | null }

/**
 * Industry companies with no site, most trials first, never re-asked within
 * DISCOVERY_RECHECK_DAYS. Every company gets website_checked_at stamped so the
 * queue drains even when nothing is found.
 */
export async function runWebsiteDiscovery(supabase: SupabaseClient, opts: DiscoveryRunOptions = {}): Promise<DiscoveryRunResult> {
  const started = Date.now();
  const now = opts.now ?? new Date();
  const budget = opts.timeBudgetMs ?? 20 * 60_000;
  const costCap = opts.costCapUsd ?? 5;
  const usage = emptyUsage();
  const r: DiscoveryRunResult = { processed: 0, found: 0, withPipeline: 0, notFound: 0, dead: 0, searches: 0, usage, costUsd: 0, errors: [], timedOut: false, costCapHit: false, sample: [] };
  const spent = () => (usage.input_tokens / 1e6) * 1 + (usage.output_tokens / 1e6) * 5 + r.searches * WEB_SEARCH_USD;

  let client = opts.client ?? null;
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) { r.errors.push('ANTHROPIC_API_KEY not set'); return r; }
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 2, timeout: 60_000 }) as unknown as IntentClient;
  }

  const recheckBefore = new Date(now.getTime() - DISCOVERY_RECHECK_DAYS * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from('companies')
    .select('id, name, hq_country, indications_active, active_trials_count, cik')
    .eq('owner_type', 'industry')
    .is('merged_into', null)
    .is('website_url', null)
    .or(`website_checked_at.is.null,website_checked_at.lt.${recheckBefore}`)
    // Private and non-US companies first (no CIK: the filing pipeline never reaches them), busiest first.
    .order('cik', { ascending: true, nullsFirst: true })
    .order('active_trials_count', { ascending: false, nullsFirst: false })
    .limit(opts.limit ?? 100);
  if (error) { r.errors.push(`companies read: ${error.message}`); return r; }

  for (const co of (data ?? []) as CompanyRow[]) {
    if (Date.now() - started > budget) { r.timedOut = true; break; }
    if (spent() >= costCap) { r.costCapHit = true; break; }
    r.processed++;
    const hint = (co.indications_active ?? []).slice(0, 2).join(', ') || null;
    const call = await discoverCompanySite(client, { name: co.name, hq_country: co.hq_country, hint }, DISCOVERY_MODEL);
    addUsage(usage, call.usage);
    r.searches += call.searches;
    if (call.error) { r.errors.push(`${co.name}: ${call.error}`); continue; }
    let { website_url, pipeline_url } = call.site;
    if (website_url && !opts.skipHostCheck && !(await hostResponds(website_url))) { r.dead++; website_url = null; pipeline_url = null; }
    const patch: Record<string, unknown> = { website_checked_at: now.toISOString() };
    if (website_url) {
      patch.website_url = website_url;
      patch.website_source = 'web_search';
      patch.pipeline_page_url = pipeline_url;
      r.found++;
      if (pipeline_url) r.withPipeline++;
    } else {
      r.notFound++;
    }
    const { error: upErr } = await supabase.from('companies').update(patch).eq('id', co.id);
    if (upErr) r.errors.push(`${co.name}: update ${upErr.message}`);
    if (r.sample.length < 12) r.sample.push({ company: co.name, website: website_url, pipeline: pipeline_url });
  }
  r.costUsd = Math.round(spent() * 10_000) / 10_000;
  return r;
}
