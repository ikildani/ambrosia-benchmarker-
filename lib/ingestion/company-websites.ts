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
/** Mirrors PIPELINE_PATH_CANDIDATES in pipeline-pages.ts (kept here to avoid a circular import). */
export const DEFAULT_PIPELINE_PATHS: ReadonlyArray<string> = ['/pipeline', '/our-pipeline', '/science/pipeline', '/research/pipeline', '/rd/pipeline', '/programs', '/portfolio', '/our-science/pipeline', '/science', '/products/pipeline', '/en/pipeline'];
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


// ═══════════════════════════════════════════════════════════════════════
// FREE DISCOVERY (no model, no paid API)
// ═══════════════════════════════════════════════════════════════════════

const FREE_MAIL_DOMAINS = new Set(['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'aol.com', 'protonmail.com', 'qq.com', '163.com', '126.com', 'sina.com', 'naver.com', 'daum.net', 'yandex.ru', 'mail.ru', 'live.com', 'msn.com', 'me.com']);
/** CROs and service providers whose staff appear as trial contacts. */
const CRO_DOMAINS = new Set(['iqvia.com', 'parexel.com', 'ppd.com', 'syneoshealth.com', 'icon.com', 'iconplc.com', 'labcorp.com', 'covance.com', 'medpace.com', 'premier-research.com', 'worldwide.com', 'fortrea.com', 'novotech-cro.com', 'tigermedgrp.com', 'linicalusa.com', 'cmedresearch.com', 'veristat.com', 'clinipace.com', 'rhoworld.com', 'ergomed.com', 'pharm-olam.com', 'psi-cro.com', 'wcgclinical.com', 'prahs.com', 'chiltern.com', 'inventivhealth.com', 'quintiles.com', 'ctifacts.com', 'clinicaltrials.gov', 'nih.gov']);
const NAME_STOPWORDS = new Set(['inc', 'inc.', 'ltd', 'ltd.', 'llc', 'corp', 'corp.', 'co', 'co.', 'company', 'corporation', 'limited', 'incorporated', 'holdings', 'group', 'gmbh', 'ag', 'sa', 's.a.', 'plc', 'bv', 'b.v.', 'nv', 'n.v.', 'ab', 'oy', 'as', 'kk', 'pte', 'pty', 'the', 'of', 'and', '&', 'therapeutics', 'therapeutic', 'pharmaceuticals', 'pharmaceutical', 'pharma', 'biosciences', 'bioscience', 'biotech', 'biotechnology', 'biotechnologies', 'biopharma', 'biopharmaceuticals', 'biologics', 'medical', 'medicines', 'medicine', 'sciences', 'science', 'research', 'laboratories', 'labs', 'lab', 'international', 'global', 'health', 'healthcare', 'oncology', 'bio', 'biomedical', 'technologies', 'technology', 'tech', 'us', 'usa', 'europe', 'china', 'japan', 'korea', 'india', 'canada', 'australia', 'uk', 'a/s', 'srl', 's.r.l.', 'spa', 's.p.a.', 'sas', 'sarl']);

/** Name tokens that identify the company (stopwords and legal suffixes removed), lowercase. */
export function distinctiveTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[(),.'’"]/g, ' ')
    .split(/[\s\-\/]+/)
    .map(t => t.trim())
    .filter(t => t.length >= 3 && !NAME_STOPWORDS.has(t) && !/^\d+$/.test(t));
}

/** A domain belongs to the company when its label starts with (or contains) a distinctive name token. */
export function domainMatchesCompany(domain: string, companyName: string): boolean {
  const label = registrableDomain(domain).split('.')[0].replace(/[^a-z0-9]/g, '');
  if (!label) return false;
  const tokens = distinctiveTokens(companyName);
  const joined = tokens.join('');
  if (joined.length >= 5 && (label.startsWith(joined.slice(0, 5)) || joined.startsWith(label.slice(0, 5)))) return true;
  return tokens.some(t => t.length >= 4 && (label.startsWith(t) || label.includes(t) || t.includes(label) && label.length >= 4));
}

/** Email domains from the company's own trials, filtered to ones that look like the company. */
export function domainsFromContacts(companyName: string, emails: string[]): string[] {
  const out: string[] = [];
  for (const e of emails) {
    const m = /@([a-z0-9.-]+\.[a-z]{2,})$/i.exec(e.trim());
    if (!m) continue;
    const d = m[1].toLowerCase();
    const reg = registrableDomain(d);
    if (FREE_MAIL_DOMAINS.has(reg) || CRO_DOMAINS.has(reg) || isBlockedHost(reg)) continue;
    if (!domainMatchesCompany(reg, companyName)) continue;
    if (!out.includes(reg)) out.push(reg);
  }
  return out;
}

const CTGOV_API = 'https://clinicaltrials.gov/api/v2/studies';

/** Central-contact emails on the company's registered trials (free API, no key). */
export async function ctgovContactEmails(companyName: string, timeoutMs = 15_000): Promise<string[]> {
  const url = `${CTGOV_API}?query.spons=${encodeURIComponent(`"${companyName}"`)}&fields=protocolSection.sponsorCollaboratorsModule.leadSponsor,protocolSection.contactsLocationsModule.centralContacts&pageSize=10&format=json`;
  try {
    const res = await fetchWithTimeout(url, { timeoutMs, retries: 1, headers: { Accept: 'application/json' } });
    if (!res.ok) return [];
    const data = await res.json() as { studies?: Array<{ protocolSection?: { sponsorCollaboratorsModule?: { leadSponsor?: { name?: string } }; contactsLocationsModule?: { centralContacts?: Array<{ email?: string }> } } }> };
    const want = companyName.trim().toLowerCase();
    const emails: string[] = [];
    for (const st of data.studies ?? []) {
      const lead = st.protocolSection?.sponsorCollaboratorsModule?.leadSponsor?.name?.trim().toLowerCase();
      if (lead && lead !== want) continue;
      for (const c of st.protocolSection?.contactsLocationsModule?.centralContacts ?? []) if (c.email) emails.push(c.email);
    }
    return emails;
  } catch {
    return [];
  }
}

const WIKIDATA_SPARQL = 'https://query.wikidata.org/sparql';

/** Official website (P856) of the Wikidata item whose English label is exactly the company name. */
export async function wikidataWebsite(companyName: string, timeoutMs = 15_000): Promise<string | null> {
  const label = companyName.replace(/["\\]/g, '').trim();
  if (!label) return null;
  const query = `SELECT ?site WHERE { ?item rdfs:label "${label}"@en . ?item wdt:P856 ?site . ?item wdt:P31/wdt:P279* wd:Q4830453 } LIMIT 2`;
  try {
    const res = await fetchWithTimeout(`${WIKIDATA_SPARQL}?query=${encodeURIComponent(query)}`, { timeoutMs, retries: 0, headers: { Accept: 'application/sparql-results+json', 'User-Agent': 'SolidusBot/1.0 (info@ambrosiaventures.co)' } });
    if (!res.ok) return null;
    const data = await res.json() as { results?: { bindings?: Array<{ site?: { value?: string } }> } };
    const site = data.results?.bindings?.[0]?.site?.value ?? null;
    const norm = normalizeUrl(site);
    return norm && !isBlockedHost(new URL(norm).hostname) ? norm : null;
  } catch {
    return null;
  }
}

/** Candidate domains from the name: acme.com, acmebio.com, acmetx.com, acme-therapeutics.com ... */
export function guessDomains(companyName: string): string[] {
  const tokens = distinctiveTokens(companyName);
  if (tokens.length === 0) return [];
  const first = tokens[0].replace(/[^a-z0-9]/g, '');
  const joined = tokens.map(t => t.replace(/[^a-z0-9]/g, '')).join('');
  const lower = companyName.toLowerCase();
  const suffix = /therapeutics/.test(lower) ? 'therapeutics' : /pharma/.test(lower) ? 'pharma' : /bio/.test(lower) ? 'bio' : null;
  const stems = [...new Set([joined, first, suffix ? `${first}${suffix}` : '', suffix ? `${first}-${suffix}` : '', `${first}bio`, `${first}tx`, `${first}pharma`].filter(s => s.length >= 4))];
  // .com for every stem first, then the alternatives, so the cap never drops a likely .com.
  const out: string[] = [];
  for (const tld of ['com', 'co', 'bio', 'io', 'net']) for (const st of stems) out.push(`${st}.${tld}`);
  return out.slice(0, 18);
}

/** GET a candidate homepage; accept when the HTML names the company. */
export async function verifyHomepage(domain: string, companyName: string, timeoutMs = 10_000): Promise<string | null> {
  const url = `https://${domain}/`;
  try {
    const res = await fetchWithTimeout(url, { timeoutMs, retries: 0, redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SolidusBot/1.0; +https://solidus.ambrosiaventures.co)', Accept: 'text/html' } });
    if (!res.ok) return null;
    const finalHost = new URL(res.url || url).hostname;
    if (isBlockedHost(finalHost) || registrableDomain(finalHost) !== registrableDomain(domain) && !domainMatchesCompany(finalHost, companyName)) return null;
    const html = (await res.text()).slice(0, 200_000).toLowerCase();
    const tokens = distinctiveTokens(companyName);
    const hit = tokens.length > 0 && tokens.filter(t => html.includes(t)).length >= Math.min(2, tokens.length);
    if (!hit) return null;
    // Parked / for-sale pages.
    if (/domain (?:is )?for sale|buy this domain|parked free|sedoparking|godaddy\.com\/domainsearch/.test(html)) return null;
    return normalizeUrl(res.url || url);
  } catch {
    return null;
  }
}

/** Common pipeline paths, checked with plain GET; first that answers with stage words wins. */
export async function probePipelinePath(website: string, paths: readonly string[], timeoutMs = 10_000): Promise<string | null> {
  const base = new URL(website);
  for (const path of paths) {
    const url = new URL(path, base).toString();
    try {
      const res = await fetchWithTimeout(url, { timeoutMs, retries: 0, redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SolidusBot/1.0; +https://solidus.ambrosiaventures.co)', Accept: 'text/html' } });
      if (!res.ok) continue;
      const html = (await res.text()).slice(0, 300_000);
      if (/\b(pre-?clinical|discovery|ind-enabling|phase\s?[123]|phase\s?ii?i?)\b/i.test(html.replace(/<[^>]+>/g, ' '))) return normalizeUrl(res.url || url);
    } catch {
      // next path
    }
  }
  return null;
}

export type DiscoveryMode = 'free' | 'paid';

/**
 * Zero-cost chain: trial contact emails → Wikidata → domain guessing with
 * homepage verification. Returns the source that found the site.
 */
export async function discoverCompanySiteFree(company: { name: string; hq_country?: string | null }, pipelinePaths: readonly string[]): Promise<{ site: DiscoveredSite; source: 'ctgov_contact' | 'wikidata' | 'domain_guess' | null }> {
  const none = { site: { website_url: null, pipeline_url: null, confidence: 0, note: null } as DiscoveredSite, source: null };
  let website: string | null = null;
  let source: 'ctgov_contact' | 'wikidata' | 'domain_guess' | null = null;

  const domains = domainsFromContacts(company.name, await ctgovContactEmails(company.name));
  for (const d of domains) {
    website = await verifyHomepage(d, company.name) ?? await verifyHomepage(`www.${d}`, company.name);
    if (website) { source = 'ctgov_contact'; break; }
  }
  if (!website) {
    website = await wikidataWebsite(company.name);
    if (website) source = 'wikidata';
  }
  if (!website) {
    for (const d of guessDomains(company.name)) {
      website = await verifyHomepage(d, company.name);
      if (website) { source = 'domain_guess'; break; }
    }
  }
  if (!website) return none;
  const pipeline = await probePipelinePath(website, pipelinePaths);
  return { site: { website_url: website, pipeline_url: pipeline, confidence: source === 'domain_guess' ? 60 : 80, note: source }, source };
}

export interface DiscoveryRunOptions {
  limit?: number;
  costCapUsd?: number;
  timeBudgetMs?: number;
  client?: IntentClient;
  now?: Date;
  /** Skip the liveness check (tests). */
  skipHostCheck?: boolean;
  /** free (default): trial contacts, Wikidata, domain guessing. paid: web search when the free chain finds nothing. */
  mode?: DiscoveryMode;
  /** Pipeline paths to probe on a found site. */
  pipelinePaths?: readonly string[];
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

  const mode: DiscoveryMode = opts.mode ?? 'free';
  const paths = opts.pipelinePaths ?? DEFAULT_PIPELINE_PATHS;
  let client = opts.client ?? null;
  if (mode === 'paid' && !client) {
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
    let website_url: string | null = null;
    let pipeline_url: string | null = null;
    let websiteSource = 'web_search';
    const free = await discoverCompanySiteFree({ name: co.name, hq_country: co.hq_country }, paths);
    if (free.site.website_url) {
      website_url = free.site.website_url;
      pipeline_url = free.site.pipeline_url;
      websiteSource = free.source ?? 'free';
    } else if (mode === 'paid' && client) {
      const call = await discoverCompanySite(client, { name: co.name, hq_country: co.hq_country, hint }, DISCOVERY_MODEL);
      addUsage(usage, call.usage);
      r.searches += call.searches;
      if (call.error) { r.errors.push(`${co.name}: ${call.error}`); continue; }
      website_url = call.site.website_url;
      pipeline_url = call.site.pipeline_url;
      if (website_url && !opts.skipHostCheck && !(await hostResponds(website_url))) { r.dead++; website_url = null; pipeline_url = null; }
    }
    const patch: Record<string, unknown> = { website_checked_at: now.toISOString() };
    if (website_url) {
      patch.website_url = website_url;
      patch.website_source = websiteSource;
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
