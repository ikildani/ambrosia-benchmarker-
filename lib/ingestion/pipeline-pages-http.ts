/**
 * Pipeline pages without a browser (Search & Evaluation, preclinical at scale).
 *
 * The Playwright crawler (scripts/pipeline-crawler.ts, GitHub Actions) reads
 * ~10 companies a run and, since the backlog allowance ran out, only with the
 * rule-based extractor, which finds almost nothing (Nov 11-17 2026: 19 runs,
 * 21 programs). Most pipeline pages are server-rendered HTML, so this path
 * runs inside the existing preclinical cron on Vercel:
 *
 *   1. queue: industry companies that own feed programs and have a website,
 *      companies with no preclinical program first (preclinical_page_targets,
 *      migration 191);
 *   2. locate: robots.txt honored, the known pipeline URL, then pipeline links
 *      from the homepage navigation, then a few common paths; at most
 *      MAX_REQUESTS_PER_SITE requests per site, one at a time, with a pause;
 *   3. read: visible text as numbered lines, with stage hints from the row
 *      markup (class names, aria labels) the way the Playwright crawler adds
 *      them; pages that only render in a browser are flagged needs_render and
 *      left to the Playwright crawler;
 *   4. extract: claude-sonnet-5 with the pipeline-page schema, text only, so
 *      every program must quote the page verbatim; through the Message
 *      Batches API (half price) in scheduled runs, drained by the next run;
 *   5. persist: the shared persistPrograms path (identifier matching,
 *      cross-company code guard, preclinical rows created, stages refreshed).
 *
 * A site whose domain does not look like the company's name is skipped unless
 * the site was found by web search, Wikidata or by hand (domain guesses put
 * Roche's pipeline under "N-Gene Research Laboratories").
 */

import type Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';
import { isBlockedHost, registrableDomain } from './company-websites';
import { addUsage, emptyUsage, usageCostUsd, type IntentClient, type TokenUsage } from './management-intent';
import {
  PIPELINE_LINK_RE,
  buildPageRequestParams,
  extractProgramsFromPage,
  looksLikePipelinePage,
  modelParagraphs,
  pageContext,
  parsePageResponse,
  pipelineTextParagraphs,
} from './pipeline-pages';
import { PRECLINICAL_MODEL, persistPrograms, type DisclosedProgram, type ProgramDecision } from './preclinical-pipeline';

// ═══════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════

export const BOT_TOKEN = 'SolidusPipelineBot';
export const BOT_UA = `Mozilla/5.0 (compatible; ${BOT_TOKEN}/1.0; +https://solidus.ambrosiaventures.co; info@ambrosiaventures.co)`;
export const MAX_REQUESTS_PER_SITE = 6;
const PAGE_TIMEOUT_MS = 12_000;
const MAX_HTML_BYTES = 2_500_000;
/** Pause between two requests to the same site. */
const SAME_HOST_DELAY_MS = 800;
/** Fewer characters of visible text than this (with app-shell markers) means the page renders in a browser. */
const MIN_RENDERED_TEXT_CHARS = 400;
export const PAGES_BATCHES_TABLE = 'preclinical_page_batches';
export const RECRAWL_DAYS = 60;
/** Website sources trusted without a domain/name check. */
const TRUSTED_SITE_SOURCES = new Set(['web_search', 'wikidata', 'manual', 'filing', 'press']);
/** Paths tried after the homepage links (most common first; the long tail lives in PIPELINE_PATH_CANDIDATES). */
export const HTTP_PIPELINE_PATHS: ReadonlyArray<string> = ['/pipeline', '/our-pipeline', '/science/pipeline', '/research/pipeline', '/en/pipeline'];

// ═══════════════════════════════════════════════════════════════════════
// ROBOTS.TXT
// ═══════════════════════════════════════════════════════════════════════

export interface RobotsGroup { agents: string[]; rules: Array<{ allow: boolean; path: string }> }

/** Parse robots.txt into user-agent groups (RFC 9309). */
export function parseRobots(txt: string): RobotsGroup[] {
  const groups: RobotsGroup[] = [];
  let current: RobotsGroup | null = null;
  let lastWasAgent = false;
  for (const rawLine of (txt ?? '').split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (key === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if (key === 'allow' || key === 'disallow') {
      lastWasAgent = false;
      if (!current) continue;
      // An empty Disallow allows everything; it carries no rule.
      if (value === '') continue;
      current.rules.push({ allow: key === 'allow', path: value });
    } else {
      lastWasAgent = false;
    }
  }
  return groups;
}

function robotsPatternMatches(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith('$');
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const re = new RegExp('^' + body.split('*').map(s => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + (anchored ? '$' : ''));
  return re.test(path);
}

/** True when `token`'s group (else the * group) allows `pathWithQuery`. Longest match wins; Allow wins a tie. */
export function robotsAllows(groups: RobotsGroup[], token: string, pathWithQuery: string): boolean {
  const t = token.toLowerCase();
  const own = groups.filter(g => g.agents.some(a => a !== '*' && t.includes(a)));
  const applicable = own.length ? own : groups.filter(g => g.agents.includes('*'));
  if (!applicable.length) return true;
  let best: { allow: boolean; len: number } | null = null;
  for (const g of applicable) {
    for (const r of g.rules) {
      if (!robotsPatternMatches(r.path, pathWithQuery)) continue;
      const len = r.path.length;
      if (!best || len > best.len || (len === best.len && r.allow)) best = { allow: r.allow, len };
    }
  }
  return best ? best.allow : true;
}

// ═══════════════════════════════════════════════════════════════════════
// HTML
// ═══════════════════════════════════════════════════════════════════════

const ENTITY: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', rsquo: "'", lsquo: "'", ldquo: '"', rdquo: '"', hellip: '…', reg: '®', trade: '™', copy: '©', middot: '·', bull: '•', alpha: 'α', beta: 'β', gamma: 'γ', kappa: 'κ' };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : ' ';
    }
    return ENTITY[e.toLowerCase()] ?? m;
  });
}

const STAGE_HINT_RE = /(pre-?clinical|nonclinical|discovery|ind[- _]?enabling|lead[- _]?opt\w*|phase[- _]?(?:[123]|i{1,3})(?:[- _/]?(?:[23]|i{1,3}))?(?:[ab])?|approved|marketed|registration)/i;
const ROW_CLASS_RE = /\b(row|item|program|programme|pipeline|asset|candidate|product|compound|drug)\b/i;
const BLOCK_CLOSE_RE = /^(p|div|li|tr|h[1-6]|table|ul|ol|section|article|dt|dd|header|footer|blockquote|figcaption)$/;

/**
 * Visible text of an HTML page as lines. Table cells are joined with ' · ';
 * a row (tr, li, or an element whose class says row/item/program) that
 * carries a stage word only in its markup (class, aria-label, title, alt,
 * data-phase) gets ' · [stage hint: ...]' appended, the same convention as
 * the Playwright crawler, so chart-like grids keep their stages.
 */
export function htmlToPageLines(html: string): string[] {
  const src = (html ?? '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|template|iframe)\b[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<(nav|footer)\b[\s\S]*?<\/\1\s*>/gi, '\n');
  const lines: string[] = [];
  let line = '';
  let hints = new Set<string>();
  const flush = () => {
    const text = decodeEntities(line).replace(/\s+/g, ' ').replace(/^[\s·]+|[\s·]+$/g, '').trim();
    if (text) {
      const extra = [...hints].filter(h => !text.toLowerCase().includes(h.toLowerCase())).slice(0, 3);
      lines.push(extra.length ? `${text} · [stage hint: ${extra.join(', ')}]` : text);
    }
    line = '';
    hints = new Set();
  };
  const tagRe = /<\/?([a-zA-Z][a-zA-Z0-9-]*)([^>]*)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(src))) {
    if (m[3] !== undefined) { line += m[3]; continue; }
    const tag = m[1].toLowerCase();
    const closing = m[0][1] === '/';
    const attrs = m[2] ?? '';
    if (closing) {
      if (BLOCK_CLOSE_RE.test(tag)) flush();
      else if (tag === 'td' || tag === 'th') line += ' · ';
      continue;
    }
    if (tag === 'br') { line += ' '; continue; }
    if (tag === 'tr' || tag === 'li' || (/^(div|section|article|a|span)$/.test(tag) && ROW_CLASS_RE.test(/class\s*=\s*["']([^"']*)/i.exec(attrs)?.[1] ?? ''))) {
      if (tag !== 'span' && tag !== 'a') flush();
    }
    if (tag === 'td' || tag === 'th') line += ' ';
    const attrRe = /\b(class|alt|aria-label|title|data-phase|data-stage|data-status)\s*=\s*["']([^"']*)["']/gi;
    let a: RegExpExecArray | null;
    while ((a = attrRe.exec(attrs))) {
      const hit = STAGE_HINT_RE.exec(a[2]);
      if (hit) hints.add(hit[1].replace(/[-_]/g, ' ').toLowerCase());
    }
    if (tag === 'img') {
      const alt = /\balt\s*=\s*["']([^"']{3,120})["']/i.exec(attrs)?.[1];
      if (alt && STAGE_HINT_RE.test(alt)) line += ` ${alt} `;
    }
  }
  flush();
  return lines;
}

/** Visible text from HTML as model paragraphs (de-duplicated lines). */
export function htmlToPipelineParagraphs(html: string): string[] {
  return pipelineTextParagraphs(htmlToPageLines(html).join('\n'));
}

/** True when the HTML is an app shell whose content only appears after JavaScript runs. */
export function needsBrowserRender(html: string, visibleText: string): boolean {
  if (visibleText.length >= MIN_RENDERED_TEXT_CHARS) return false;
  return /id=["'](__next|root|app|__nuxt|___gatsby)["']|ng-version=|data-reactroot|window\.__NUXT__|wix-|squarespace|webflow/i.test(html) || visibleText.length < 120;
}

export interface PageLink { href: string; text: string }

/** Anchors in the HTML, resolved against `base`. */
export function extractLinks(html: string, base: string): PageLink[] {
  const out: PageLink[] = [];
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html ?? ''))) {
    const href = /\bhref\s*=\s*["']([^"'#][^"']*)["']/i.exec(m[1])?.[1];
    if (!href || /^(mailto|tel|javascript):/i.test(href)) continue;
    let abs: string;
    try { abs = new URL(decodeEntities(href), base).toString(); } catch { continue; }
    const aria = /\b(aria-label|title)\s*=\s*["']([^"']+)["']/i.exec(m[1])?.[2] ?? '';
    const text = decodeEntities(m[2].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim() || aria;
    out.push({ href: abs.split('#')[0], text: text.slice(0, 120) });
  }
  return out;
}

/** Links on the company's own site that point at a pipeline page, best first (at most `max`). */
export function rankPipelineLinks(links: PageLink[], siteUrl: string, max = 3): string[] {
  let site: URL;
  try { site = new URL(siteUrl); } catch { return []; }
  const domain = registrableDomain(site.hostname);
  const scored: Array<{ href: string; score: number }> = [];
  for (const l of links) {
    let u: URL;
    try { u = new URL(l.href); } catch { continue; }
    if (!/^https?:$/.test(u.protocol) || registrableDomain(u.hostname) !== domain) continue;
    if (/\.(pdf|jpe?g|png|gif|zip|docx?|xlsx?|pptx?|mp4)$/i.test(u.pathname)) continue;
    if (/\/(news|press|media|blog|events?|careers?|jobs|investors?\/(?:news|events))(\/|$)/i.test(u.pathname)) continue;
    const path = decodeURIComponent(u.pathname).toLowerCase();
    let score = 0;
    if (/\bpipeline\b|パイプライン|管线|파이프라인/i.test(l.text)) score += 6;
    else if (PIPELINE_LINK_RE.test(l.text)) score += 3;
    if (/pipeline|パイプライン|管线|파이프라인/.test(path)) score += 4;
    else if (/\/(programs?|portfolio|our-science|research|r-?and-?d|rd|science|products?-in-development)(\/|$)/.test(path)) score += 1;
    if (score > 0) scored.push({ href: u.toString(), score });
  }
  scored.sort((a, b) => b.score - a.score || a.href.length - b.href.length);
  return [...new Set(scored.map(s => s.href))].slice(0, max);
}

/**
 * Cheap pre-check before any request: a valid URL that is not an aggregator, registry or news host.
 * Whether the site is the company's own is decided on its homepage (locatePipelinePageHttp: any
 * site not found by web search, Wikidata or by hand must name the company there), which is
 * stricter than a domain/name comparison: boston.com passes "Boston Therapeutics" by domain but
 * never names it, while kbpbio.com fails "KBP Biosciences" by domain but does name it.
 */
export function siteBelongsToCompany(websiteUrl: string): boolean {
  let host: string;
  try { host = new URL(websiteUrl).hostname; } catch { return false; }
  return !isBlockedHost(host);
}

const LEGAL_SUFFIX_RE = /[\s,]+(inc|incorporated|corp|corporation|co|company|ltd|limited|llc|l\.l\.c|plc|sa|s\.a|ag|gmbh|bv|b\.v|nv|n\.v|ab|oy|as|a\/s|kk|k\.k|pte|pty|spa|s\.p\.a|srl|s\.r\.l|sas|sarl|se|lp|llp|group|holdings?)\.?$/i;

/** Company name without legal suffixes, lower case, punctuation folded to spaces ("Nested Therapeutics, Inc" -> "nested therapeutics"). */
export function companyNameCore(name: string): string {
  let s = (name ?? '').trim();
  for (let i = 0; i < 3; i++) s = s.replace(LEGAL_SUFFIX_RE, '').trim();
  return s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

/**
 * True when the page names the company (its name without legal suffixes, as a phrase). A guessed
 * domain must pass this: boston.com does not say "Boston Therapeutics", quantum.com does not say
 * "Quantum Genomics". One-word names shorter than six letters are too ambiguous and fail.
 */
export function pageMentionsCompany(html: string, name: string): boolean {
  const core = companyNameCore(name);
  if (!core || (!core.includes(' ') && core.length < 6)) return false;
  const text = decodeEntities((html ?? '').replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, ' ').replace(/<[^>]+>/g, ' '))
    .toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ');
  return ` ${text} `.includes(` ${core} `);
}

/** Website sources that need the homepage to name the company before the site is read. */
export function siteNeedsIdentityCheck(websiteSource: string | null | undefined): boolean {
  return !(websiteSource && TRUSTED_SITE_SOURCES.has(websiteSource));
}

// ═══════════════════════════════════════════════════════════════════════
// FETCH (polite)
// ═══════════════════════════════════════════════════════════════════════

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export interface FetchedPage { url: string; status: number; html: string }
export type PageFetcher = (url: string) => Promise<FetchedPage | null>;

/** Plain GET with the bot user agent, HTML only, size-capped. */
export const httpFetchPage: PageFetcher = async (url: string) => {
  try {
    const res = await fetchWithTimeout(url, {
      timeoutMs: PAGE_TIMEOUT_MS,
      retries: 0,
      redirect: 'follow',
      headers: { 'User-Agent': BOT_UA, Accept: 'text/html,application/xhtml+xml;q=0.9,text/plain;q=0.5', 'Accept-Language': 'en' },
    });
    const type = res.headers.get('content-type') ?? '';
    if (!res.ok) return { url: res.url || url, status: res.status, html: '' };
    if (type && !/html|text\/plain/i.test(type)) return { url: res.url || url, status: 415, html: '' };
    const text = await res.text();
    return { url: res.url || url, status: res.status, html: text.slice(0, MAX_HTML_BYTES) };
  } catch {
    return null;
  }
};

export type LocateOutcome =
  | { kind: 'found'; url: string; html: string; paragraphs: string[]; requests: number }
  | { kind: 'needs_render'; url: string; requests: number }
  | { kind: 'robots_blocked'; requests: number }
  | { kind: 'site_mismatch'; requests: number }
  | { kind: 'unreachable'; requests: number }
  | { kind: 'no_pipeline_page'; requests: number };

/**
 * Find and read the company's pipeline page with at most MAX_REQUESTS_PER_SITE
 * requests: robots.txt, the known pipeline URL, the homepage (for its links),
 * the ranked pipeline links, then common paths.
 */
export async function locatePipelinePageHttp(
  co: { website_url: string; pipeline_page_url?: string | null; name?: string; website_source?: string | null },
  fetcher: PageFetcher = httpFetchPage,
  delayMs = SAME_HOST_DELAY_MS,
): Promise<LocateOutcome> {
  let site: URL;
  try { site = new URL(co.website_url); } catch { return { kind: 'unreachable', requests: 0 }; }
  let requests = 0;
  const get = async (u: string) => {
    if (requests > 0 && delayMs > 0) await sleep(delayMs);
    requests++;
    return fetcher(u);
  };

  const robotsRes = await get(new URL('/robots.txt', site).toString());
  if (robotsRes && (robotsRes.status === 401 || robotsRes.status === 403)) return { kind: 'robots_blocked', requests };
  const groups = robotsRes && robotsRes.status === 200 ? parseRobots(robotsRes.html) : [];
  const allowed = (u: string) => {
    try { const x = new URL(u); return robotsAllows(groups, BOT_TOKEN, x.pathname + x.search); } catch { return false; }
  };
  if (!allowed(site.toString())) return { kind: 'robots_blocked', requests };

  const tried = new Set<string>();
  let renderCandidate: string | null = null;
  const tryPage = async (u: string): Promise<LocateOutcome | null> => {
    const key = u.replace(/\/$/, '');
    if (tried.has(key) || requests >= MAX_REQUESTS_PER_SITE || !allowed(u)) return null;
    tried.add(key);
    const page = await get(u);
    if (!page || page.status >= 400 || !page.html) return null;
    const lines = htmlToPageLines(page.html);
    const text = lines.join('\n');
    if (looksLikePipelinePage(text)) return { kind: 'found', url: page.url, html: page.html, paragraphs: pipelineTextParagraphs(text), requests };
    if (!renderCandidate && needsBrowserRender(page.html, text)) renderCandidate = page.url;
    return null;
  };

  // A guessed site must name the company on its homepage before anything else is read.
  const checkIdentity = !!co.name && siteNeedsIdentityCheck(co.website_source);
  if (co.pipeline_page_url && !checkIdentity) {
    const hit = await tryPage(co.pipeline_page_url);
    if (hit) return hit;
  }
  const home = await get(site.toString());
  if (!home) return { kind: 'unreachable', requests };
  if (home.status >= 400 || !home.html) return home.status === 401 || home.status === 403 ? { kind: 'robots_blocked', requests } : { kind: 'unreachable', requests };
  tried.add(site.toString().replace(/\/$/, ''));
  if (checkIdentity && !pageMentionsCompany(home.html, co.name!)) {
    // An app shell has no text to check; the browser crawler can render it.
    const shellText = htmlToPageLines(home.html).join('\n');
    if (needsBrowserRender(home.html, shellText)) return { kind: 'needs_render', url: home.url, requests };
    return { kind: 'site_mismatch', requests };
  }
  if (co.pipeline_page_url && checkIdentity) {
    const hit = await tryPage(co.pipeline_page_url);
    if (hit) return hit;
  }
  for (const href of rankPipelineLinks(extractLinks(home.html, home.url), home.url)) {
    const hit = await tryPage(href);
    if (hit) return hit;
  }
  for (const path of HTTP_PIPELINE_PATHS) {
    if (requests >= MAX_REQUESTS_PER_SITE) break;
    const hit = await tryPage(new URL(path, home.url).toString());
    if (hit) return hit;
  }
  // The homepage itself sometimes carries the pipeline.
  const homeText = htmlToPageLines(home.html).join('\n');
  if (looksLikePipelinePage(homeText)) return { kind: 'found', url: home.url, html: home.html, paragraphs: pipelineTextParagraphs(homeText), requests };
  if (needsBrowserRender(home.html, homeText)) return { kind: 'needs_render', url: home.url, requests };
  if (renderCandidate) return { kind: 'needs_render', url: renderCandidate, requests };
  return { kind: 'no_pipeline_page', requests };
}

// ═══════════════════════════════════════════════════════════════════════
// RUN
// ═══════════════════════════════════════════════════════════════════════

export interface PageTarget {
  id: string;
  name: string;
  website_url: string;
  website_source: string | null;
  pipeline_page_url: string | null;
}

/** Client surface: live messages plus Message Batches (the Anthropic SDK satisfies it). */
export interface PagesClient extends IntentClient {
  messages: IntentClient['messages'] & {
    batches?: {
      create: (p: { requests: Array<{ custom_id: string; params: Anthropic.MessageCreateParamsNonStreaming }> }) => Promise<{ id: string; processing_status: string }>;
      retrieve: (id: string) => Promise<{ id: string; processing_status: string }>;
      results: (id: string) => Promise<AsyncIterable<{ custom_id: string; result: { type: string; message?: Anthropic.Message } }>>;
    };
  };
}

export interface PagesRunOptions {
  client: PagesClient;
  /** Companies to locate this run. */
  limit?: number;
  /** Concurrent sites. */
  concurrency?: number;
  timeBudgetMs?: number;
  costCapUsd?: number;
  /** 'batch' submits one Message Batch (drained next run); 'sync' extracts live. */
  extraction?: 'batch' | 'sync';
  /** Read only: locate, extract live, decide; write nothing. */
  dryRun?: boolean;
  companyIds?: string[];
  model?: string;
  createUnknownClinical?: boolean;
  now?: Date;
  fetcher?: PageFetcher;
}

export interface PagesCompanyReport {
  company: string;
  outcome: string;
  url?: string;
  programs?: number;
  created?: string[];
  matched?: number;
  decisions?: ProgramDecision[];
  extracted?: Array<{ name: string; stage: string; quote: string }>;
}

export interface PagesRunResult {
  targets: number;
  located: number;
  needsRender: number;
  robotsBlocked: number;
  siteMismatch: number;
  noPage: number;
  unreachable: number;
  requests: number;
  batchSubmitted: string | null;
  batchRequests: number;
  batchesDrained: number;
  programsExtracted: number;
  assetsCreated: number;
  assetsMatched: number;
  clinicalCreated: number;
  foreignSkipped: number;
  unmatchedClinical: number;
  quotesDropped: number;
  usage: TokenUsage;
  costUsd: number;
  errors: string[];
  companies: PagesCompanyReport[];
  timedOut: boolean;
}

interface BatchItem { custom_id: string; company_id: string; company_name: string; url: string; crawled_at: string; paragraphs: string[] }

/** custom_id for a batch request: unique per company and crawl, at most 64 characters. */
export function batchCustomId(companyId: string, index: number): string {
  return `p${index}-${companyId.replace(/-/g, '').slice(0, 32)}`;
}

/** The queue: migration 191's ranked targets, else (migration not applied yet) never-checked companies with a site. */
async function selectTargets(supabase: SupabaseClient, limit: number, companyIds: string[] | undefined, errors: string[]): Promise<PageTarget[]> {
  const cols = 'id, name, website_url, website_source, pipeline_page_url';
  if (companyIds?.length) {
    const { data, error } = await supabase.from('companies').select(cols).in('id', companyIds).not('website_url', 'is', null);
    if (error) errors.push(`companies read: ${error.message}`);
    return (data ?? []) as PageTarget[];
  }
  const recrawlBefore = new Date(Date.now() - RECRAWL_DAYS * 86_400_000).toISOString();
  const rpc = await supabase.rpc('preclinical_page_targets', { p_limit: limit, p_recrawl_before: recrawlBefore });
  if (!rpc.error) return (rpc.data ?? []) as PageTarget[];
  errors.push(`preclinical_page_targets: ${rpc.error.message} (fallback queue; apply migration 191)`);
  const { data, error } = await supabase
    .from('companies')
    .select(cols)
    .eq('owner_type', 'industry')
    .is('merged_into', null)
    .not('website_url', 'is', null)
    .is('pipeline_page_checked_at', null)
    .limit(limit);
  if (error) errors.push(`companies read: ${error.message}`);
  return (data ?? []) as PageTarget[];
}

async function stamp(supabase: SupabaseClient, dryRun: boolean, companyId: string, fields: Record<string, unknown>): Promise<void> {
  if (dryRun) return;
  await supabase.from('companies').update(fields).eq('id', companyId);
}

/** Drain every submitted batch that has ended: validate, persist, stamp the companies. */
async function drainBatches(supabase: SupabaseClient, opts: PagesRunOptions, r: PagesRunResult): Promise<void> {
  const batches = opts.client.messages.batches;
  if (!batches) return;
  const { data, error } = await supabase.from(PAGES_BATCHES_TABLE).select('batch_id, items, model').eq('status', 'submitted').order('submitted_at').limit(5);
  if (error) { r.errors.push(`${PAGES_BATCHES_TABLE} read: ${error.message}`); return; }
  for (const row of (data ?? []) as Array<{ batch_id: string; items: BatchItem[]; model: string }>) {
    let status: string;
    try { status = (await batches.retrieve(row.batch_id)).processing_status; } catch (err) { r.errors.push(`batch ${row.batch_id}: ${err instanceof Error ? err.message : String(err)}`); continue; }
    if (status !== 'ended') continue;
    const byId = new Map(row.items.map(it => [it.custom_id, it]));
    const summary = { pages: 0, programs: 0, created: 0, matched: 0, errored: 0 };
    for await (const res of await batches.results(row.batch_id)) {
      const item = byId.get(res.custom_id);
      if (!item) continue;
      const now = new Date(item.crawled_at);
      if (res.result.type !== 'succeeded' || !res.result.message) {
        summary.errored++;
        // Expired or errored: let the company be queued again.
        await stamp(supabase, false, item.company_id, { pipeline_page_status: 'fetch_failed', pipeline_page_checked_at: null });
        continue;
      }
      const msg = res.result.message;
      // Batch tokens are billed at half price.
      const half = { input_tokens: (msg.usage?.input_tokens ?? 0) / 2, output_tokens: (msg.usage?.output_tokens ?? 0) / 2, cache_read_input_tokens: (msg.usage?.cache_read_input_tokens ?? 0) / 2, cache_creation_input_tokens: (msg.usage?.cache_creation_input_tokens ?? 0) / 2 };
      addUsage(r.usage, half);
      const parsed = parsePageResponse(msg, modelParagraphs(item.paragraphs), false);
      r.quotesDropped += parsed.dropped;
      if (parsed.error) { summary.errored++; r.errors.push(`${item.company_name}: ${parsed.error}`); continue; }
      summary.pages++;
      summary.programs += parsed.programs.length;
      r.programsExtracted += parsed.programs.length;
      await persistOne(supabase, opts, r, { id: item.company_id, name: item.company_name }, item.url, now, parsed.programs, row.model);
    }
    await supabase.from(PAGES_BATCHES_TABLE).update({ status: 'drained', drained_at: new Date().toISOString(), summary }).eq('batch_id', row.batch_id);
    r.batchesDrained++;
  }
}

async function persistOne(
  supabase: SupabaseClient, opts: PagesRunOptions, r: PagesRunResult,
  co: { id: string; name: string }, url: string, now: Date, programs: DisclosedProgram[], model: string,
): Promise<PagesCompanyReport> {
  const dryRun = !!opts.dryRun;
  const report: PagesCompanyReport = { company: co.name, outcome: 'extracted', url, programs: programs.length };
  if (programs.length === 0) {
    report.outcome = 'no_programs';
    await stamp(supabase, dryRun, co.id, { pipeline_page_status: 'no_programs', pipeline_page_url: url, pipeline_page_programs: 0, pipeline_page_checked_at: now.toISOString(), pipeline_page_llm_at: now.toISOString() });
    return report;
  }
  const persisted = await persistPrograms(supabase, pageContext(co, url, now, model), programs, { dryRun, createUnknownClinical: opts.createUnknownClinical });
  r.errors.push(...persisted.errors);
  r.assetsCreated += persisted.created.length;
  r.assetsMatched += persisted.matched;
  r.clinicalCreated += persisted.clinicalCreated;
  r.foreignSkipped += persisted.foreignSkipped;
  r.unmatchedClinical += persisted.unmatchedClinical;
  report.created = persisted.created;
  report.matched = persisted.matched;
  report.decisions = persisted.decisions;
  await stamp(supabase, dryRun, co.id, { pipeline_page_status: 'extracted', pipeline_page_url: url, pipeline_page_programs: programs.length, pipeline_page_checked_at: now.toISOString(), pipeline_page_llm_at: now.toISOString() });
  return report;
}

/** Simple worker pool. */
async function pool<T>(items: T[], n: number, fn: (item: T) => Promise<void>, stop: () => boolean): Promise<void> {
  let i = 0;
  await Promise.all(Array.from({ length: Math.max(1, Math.min(n, items.length)) }, async () => {
    while (i < items.length && !stop()) {
      const item = items[i++];
      await fn(item);
    }
  }));
}

export async function runPipelinePagesHttp(supabase: SupabaseClient, opts: PagesRunOptions): Promise<PagesRunResult> {
  const started = Date.now();
  const budget = opts.timeBudgetMs ?? 240_000;
  const model = opts.model ?? PRECLINICAL_MODEL;
  const dryRun = !!opts.dryRun;
  const extraction = dryRun ? 'sync' : (opts.extraction ?? 'batch');
  const costCap = opts.costCapUsd ?? 3;
  const fetcher = opts.fetcher ?? httpFetchPage;
  const r: PagesRunResult = {
    targets: 0, located: 0, needsRender: 0, robotsBlocked: 0, siteMismatch: 0, noPage: 0, unreachable: 0, requests: 0,
    batchSubmitted: null, batchRequests: 0, batchesDrained: 0, programsExtracted: 0, assetsCreated: 0, assetsMatched: 0,
    clinicalCreated: 0, foreignSkipped: 0, unmatchedClinical: 0, quotesDropped: 0, usage: emptyUsage(), costUsd: 0,
    errors: [], companies: [], timedOut: false,
  };
  // Leave room to submit the batch or persist the last extraction.
  const outOfTime = () => Date.now() - started > budget - (extraction === 'sync' ? 45_000 : 20_000);

  if (extraction === 'batch') await drainBatches(supabase, opts, r);

  const targets = await selectTargets(supabase, opts.limit ?? 60, opts.companyIds, r.errors);
  r.targets = targets.length;
  const seenHosts = new Set<string>();
  const items: BatchItem[] = [];

  await pool(targets, opts.concurrency ?? 6, async (co) => {
    const now = opts.now ?? new Date();
    let host = '';
    try { host = registrableDomain(new URL(co.website_url).hostname); } catch { /* invalid URL */ }
    if (!host || seenHosts.has(host)) {
      await stamp(supabase, dryRun, co.id, { pipeline_page_status: 'duplicate_host', pipeline_page_checked_at: now.toISOString() });
      r.companies.push({ company: co.name, outcome: 'duplicate_host' });
      return;
    }
    seenHosts.add(host);
    if (!siteBelongsToCompany(co.website_url)) {
      r.siteMismatch++;
      await stamp(supabase, dryRun, co.id, { pipeline_page_status: 'site_mismatch', pipeline_page_checked_at: now.toISOString() });
      r.companies.push({ company: co.name, outcome: 'site_mismatch', url: co.website_url });
      return;
    }
    const loc = await locatePipelinePageHttp(co, fetcher);
    r.requests += loc.requests;
    if (loc.kind !== 'found') {
      if (loc.kind === 'needs_render') r.needsRender++;
      else if (loc.kind === 'robots_blocked') r.robotsBlocked++;
      else if (loc.kind === 'site_mismatch') r.siteMismatch++;
      else if (loc.kind === 'unreachable') r.unreachable++;
      else r.noPage++;
      // needs_render stays unchecked for the Playwright crawler, which renders pages in a browser.
      const fields: Record<string, unknown> = loc.kind === 'needs_render'
        ? { pipeline_page_status: 'needs_render', pipeline_page_url: loc.url, pipeline_page_checked_at: null }
        : { pipeline_page_status: loc.kind === 'robots_blocked' ? 'blocked' : loc.kind === 'unreachable' ? 'fetch_failed' : loc.kind === 'site_mismatch' ? 'site_mismatch' : 'no_pipeline_page', pipeline_page_checked_at: now.toISOString() };
      await stamp(supabase, dryRun, co.id, fields);
      r.companies.push({ company: co.name, outcome: loc.kind, url: 'url' in loc ? loc.url : undefined });
      return;
    }
    r.located++;
    if (extraction === 'batch') {
      items.push({ custom_id: batchCustomId(co.id, items.length), company_id: co.id, company_name: co.name, url: loc.url, crawled_at: now.toISOString(), paragraphs: modelParagraphs(loc.paragraphs) });
      return;
    }
    if (usageCostUsd(r.usage) >= costCap) { r.companies.push({ company: co.name, outcome: 'cost_cap', url: loc.url }); return; }
    const ex = await extractProgramsFromPage(opts.client, co.name, loc.url, now.toISOString(), loc.paragraphs, null, model);
    addUsage(r.usage, ex.usage);
    r.quotesDropped += ex.dropped;
    if (ex.error) { r.errors.push(`${co.name}: ${ex.error}`); r.companies.push({ company: co.name, outcome: 'extract_error', url: loc.url }); return; }
    r.programsExtracted += ex.programs.length;
    const report = await persistOne(supabase, opts, r, co, loc.url, now, ex.programs, model);
    if (dryRun) report.extracted = ex.programs.map(p => ({ name: p.program_name, stage: p.stage, quote: p.evidence_quote.slice(0, 160) }));
    r.companies.push(report);
  }, () => { if (outOfTime()) { r.timedOut = true; return true; } return false; });

  if (extraction === 'batch' && items.length > 0 && !dryRun) {
    const batches = opts.client.messages.batches;
    if (!batches) {
      r.errors.push('client has no Message Batches API');
    } else {
      try {
        const requests = items.map(it => ({ custom_id: it.custom_id, params: buildPageRequestParams(it.company_name, it.url, it.crawled_at, it.paragraphs, null, model) }));
        const batch = await batches.create({ requests });
        const { error } = await supabase.from(PAGES_BATCHES_TABLE).insert({ batch_id: batch.id, status: 'submitted', model, items, request_count: items.length });
        if (error) r.errors.push(`${PAGES_BATCHES_TABLE} insert: ${error.message}`);
        r.batchSubmitted = batch.id;
        r.batchRequests = items.length;
        // Stamped as pending so the queue moves on; drained (and restamped) next run.
        for (const it of items) await stamp(supabase, false, it.company_id, { pipeline_page_status: 'batch_pending', pipeline_page_url: it.url, pipeline_page_checked_at: it.crawled_at });
      } catch (err) {
        r.errors.push(`batch submit: ${err instanceof Error ? err.message.split('\n')[0].slice(0, 300) : String(err)}`);
      }
    }
  }

  r.costUsd = Math.round(usageCostUsd(r.usage) * 10_000) / 10_000;
  return r;
}
