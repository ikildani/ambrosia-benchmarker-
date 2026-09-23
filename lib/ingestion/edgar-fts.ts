/**
 * SEC EDGAR full-text search (EFTS) client shared by the real-time monitor,
 * the rolling backfill and the 2017→present historical backfill.
 *
 * Why one module: three pipelines each built their own EFTS URL, parsed the
 * hit shape three different ways (one of them against fields that no longer
 * exist), and two of them searched `"8-K"` for a whole day, which returns
 * every current report in America. The queries here are scoped to biopharma
 * deal language so the extraction budget is spent on filings that can be
 * deals, and the hit is followed to the exhibit that matched (EX-99.1 press
 * releases, EX-10.x agreements) instead of the cover page.
 *
 * SEC fair-access rules: a declared User-Agent with a contact address and no
 * more than 10 requests per second. The limiter below is process-wide.
 */

import { fetchWithTimeout } from '../fetch-with-timeout';

export const EFTS_URL = 'https://efts.sec.gov/LATEST/search-index';
export const SEC_USER_AGENT = 'Ambrosia Ventures Deal Intelligence research@ambrosiaventures.co';
export const EFTS_PAGE_SIZE = 100;

/**
 * Deal-language queries scoped to biopharma. Each is a complete EFTS `q`.
 * Ordered by yield on a Q1 2019 probe (264 / 114 / 111 filings).
 */
export const PHARMA_DEAL_QUERIES: ReadonlyArray<{ key: string; q: string }> = [
  { key: 'license_terms', q: '"license agreement" (pharmaceutical OR biotechnology OR therapeutic) (upfront OR milestone OR royalt*)' },
  { key: 'exclusive_license', q: '"exclusive license" (pharmaceutical OR therapeutic OR clinical) (upfront OR milestone)' },
  { key: 'collaboration_upfront', q: '"collaboration" "upfront" (pharmaceutical OR therapeutic OR biotechnology)' },
  { key: 'option_agreement', q: '"option agreement" (pharmaceutical OR therapeutic OR biotechnology) (exercise OR milestone)' },
  { key: 'co_development', q: '"co-development" (pharmaceutical OR therapeutic) (upfront OR "cost sharing" OR "profit share")' },
  { key: 'asset_purchase', q: '"asset purchase agreement" (pharmaceutical OR therapeutic OR clinical) (upfront OR milestone)' },
  { key: 'commercialization', q: '"commercialization agreement" (pharmaceutical OR therapeutic) (royalt* OR milestone)' },
];

export interface EftsHit {
  _id?: string;
  _source?: {
    adsh?: string;
    ciks?: string[];
    file_date?: string;
    form?: string;
    root_forms?: string[];
    file_type?: string;
    file_description?: string;
    display_names?: string[];
    period_ending?: string;
    /** SIC codes of the filer; 2834 pharmaceutical preparations, 2836 biological products, 8731 commercial physical & biological research. */
    sics?: string[];
    /** 8-K item numbers, e.g. ['1.01', '9.01']. */
    items?: string[];
  };
}

/** SIC codes that identify a biopharma filer. */
export const PHARMA_SICS: ReadonlySet<string> = new Set(['2834', '2835', '2836', '8731']);

/**
 * Cheap pre-filter on hit metadata, before any document fetch. Keeps a hit when
 * the filer is a biopharma SIC, or (for filers without SIC metadata) when the
 * 8-K carries Item 1.01 (entry into a material definitive agreement) or the
 * matched document is a press-release or agreement exhibit. Non-pharma filers
 * with a SIC are dropped outright.
 */
export function isLikelyPharmaDealHit(hit: EftsHit): { keep: boolean; reason: string } {
  const sics = hit._source?.sics ?? [];
  const items = hit._source?.items ?? [];
  const fileType = (hit._source?.file_type ?? '').toUpperCase();
  const form = hit._source?.form ?? '';
  if (sics.length > 0 && !sics.some(c => PHARMA_SICS.has(String(c)))) return { keep: false, reason: `sic_${sics[0]}` };
  if (sics.some(c => PHARMA_SICS.has(String(c)))) return { keep: true, reason: 'pharma_sic' };
  if (form.startsWith('6-K')) return { keep: true, reason: 'foreign_private_issuer' };
  if (items.some(i => String(i).startsWith('1.01'))) return { keep: true, reason: 'item_1_01' };
  if (/^EX-(99|10)/.test(fileType)) return { keep: true, reason: 'exhibit' };
  return { keep: false, reason: 'no_signal' };
}

export interface EftsDocument {
  accession: string;
  cik: string;
  filename: string;
  url: string;
  filingDate: string;
  form: string;
  /** Exhibit type of the document that matched, e.g. 'EX-99.1', '8-K'. */
  fileType: string;
  companyName: string;
}

/** Resolve one EFTS hit to the document that matched the query. */
export function hitToDocument(hit: EftsHit): EftsDocument | null {
  const id = typeof hit._id === 'string' ? hit._id : '';
  const [idAdsh, filename] = id.includes(':') ? id.split(':') : ['', ''];
  const accession = (hit._source?.adsh || idAdsh || '').trim();
  const cik = String(hit._source?.ciks?.[0] ?? '').replace(/^0+/, '');
  if (!accession || !cik || !filename) return null;
  const display = hit._source?.display_names?.[0] ?? '';
  const companyName = display.replace(/\s*\([A-Z0-9.,\s-]*\)\s*\(CIK \d+\)\s*$/, '').trim() || 'Unknown';
  return {
    accession,
    cik,
    filename,
    url: `https://www.sec.gov/Archives/edgar/data/${cik}/${accession.replace(/-/g, '')}/${filename}`,
    filingDate: hit._source?.file_date ?? '',
    form: hit._source?.form ?? hit._source?.root_forms?.[0] ?? '',
    fileType: hit._source?.file_type ?? '',
    companyName,
  };
}

// ---------------------------------------------------------------------------
// Rate limiter: SEC allows 10 requests/second per client. Keep a margin.
// ---------------------------------------------------------------------------
const MIN_INTERVAL_MS = 150;
let lastRequestAt = 0;
let chain: Promise<void> = Promise.resolve();

export function secThrottle<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    const wait = Math.max(0, lastRequestAt + MIN_INTERVAL_MS - Date.now());
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    lastRequestAt = Date.now();
  });
  chain = run.catch(() => undefined);
  return run.then(fn);
}

export interface EftsPage {
  hits: EftsHit[];
  total: number;
  /** HTTP status of the worst per-form request; 200 when every form succeeded. */
  status: number;
  /** True when EFTS answered 200 with a body that was not JSON; the caller should retry the page, never treat it as empty. */
  parseFailed?: boolean;
}

/**
 * Forms are requested ONE PER CALL and merged by accession. EFTS accepts a
 * comma list in `forms` but silently returns a small fraction of the hits:
 * on 17 Sep 2026 the same query over 7 days gave 35 hits for forms=8-K,
 * 8 for forms=6-K and 3 for forms=8-K,8-K/A,6-K; 2019Q1 "license agreement"
 * gave 493 vs 27. That comma list was the shared root cause of the sec_edgar
 * and deal-backfill zero-fetch.
 */
export const DEFAULT_FORMS: ReadonlyArray<string> = ['8-K', '8-K/A', '6-K'];

async function eftsSearchOneForm(params: { q: string; startdt: string; enddt: string; form: string; from: number; size: number }): Promise<EftsPage> {
  const search = new URLSearchParams({
    q: params.q,
    dateRange: 'custom',
    startdt: params.startdt,
    enddt: params.enddt,
    forms: params.form,
    from: String(params.from),
    size: String(params.size),
  });
  const res = await secThrottle(() =>
    fetchWithTimeout(`${EFTS_URL}?${search}`, {
      headers: { 'User-Agent': SEC_USER_AGENT, Accept: 'application/json' },
      timeoutMs: 20_000,
      retries: 1,
    }),
  );
  if (!res.ok) return { hits: [], total: 0, status: res.status };
  const body = await res.text();
  try {
    const data = JSON.parse(body);
    return { hits: data.hits?.hits ?? [], total: data.hits?.total?.value ?? 0, status: 200 };
  } catch {
    // EFTS intermittently answers 200 with a non-JSON body for some quoted
    // terms ("upfront payment", "co-development"). Retryable, not empty.
    return { hits: [], total: 0, status: 200, parseFailed: true };
  }
}

/**
 * One page of EFTS results across the requested forms, merged by accession.
 * `status` 500 on a `from` past the last hit is a known EFTS behaviour;
 * callers treat it as end-of-results, not as an outage. `parseFailed` means
 * at least one form returned an unparseable body after one retry.
 */
export async function eftsSearch(params: {
  q: string;
  startdt: string;
  enddt: string;
  forms?: ReadonlyArray<string>;
  from?: number;
  size?: number;
}): Promise<EftsPage> {
  const forms = params.forms ?? DEFAULT_FORMS;
  const from = params.from ?? 0;
  const size = params.size ?? EFTS_PAGE_SIZE;
  const byAccession = new Map<string, EftsHit>();
  let total = 0;
  let worstStatus = 200;
  let parseFailed = false;
  for (const form of forms) {
    let page = await eftsSearchOneForm({ q: params.q, startdt: params.startdt, enddt: params.enddt, form, from, size });
    if (page.parseFailed) page = await eftsSearchOneForm({ q: params.q, startdt: params.startdt, enddt: params.enddt, form, from, size });
    if (page.parseFailed) { parseFailed = true; continue; }
    if (page.status !== 200) { worstStatus = page.status === 500 && worstStatus === 200 ? 500 : Math.max(worstStatus, page.status); continue; }
    total += page.total;
    for (const hit of page.hits) {
      const key = hit._source?.adsh || (typeof hit._id === 'string' ? hit._id.split(':')[0] : '');
      if (key && !byAccession.has(key)) byAccession.set(key, hit);
    }
  }
  // A 500 on one form with hits from another is still a usable page.
  const status = byAccession.size > 0 ? 200 : worstStatus;
  return { hits: [...byAccession.values()], total, status, parseFailed };
}

/** Fetch a filing document as plain text, throttled and identified. */
export async function fetchSecDocumentText(url: string): Promise<{ ok: boolean; status: number; text: string }> {
  const res = await secThrottle(() =>
    fetchWithTimeout(url, { headers: { 'User-Agent': SEC_USER_AGENT, Accept: 'text/html,application/xhtml+xml' }, timeoutMs: 20_000, retries: 1 }),
  );
  if (!res.ok) return { ok: false, status: res.status, text: '' };
  const html = await res.text();
  const text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return { ok: true, status: res.status, text };
}

/** Quarter boundaries for a backfill cursor: '2019Q1' → { start, end }. */
export function quarterRange(year: number, quarter: 1 | 2 | 3 | 4): { key: string; startdt: string; enddt: string } {
  const startMonth = (quarter - 1) * 3;
  const start = new Date(Date.UTC(year, startMonth, 1));
  const end = new Date(Date.UTC(year, startMonth + 3, 0));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { key: `${year}Q${quarter}`, startdt: iso(start), enddt: iso(end) };
}

/** Every quarter from `fromYear`Q1 up to the current quarter, oldest first. */
export function quartersSince(fromYear: number, now: Date = new Date()): Array<{ key: string; startdt: string; enddt: string }> {
  const out: Array<{ key: string; startdt: string; enddt: string }> = [];
  const currentYear = now.getUTCFullYear();
  const currentQuarter = (Math.floor(now.getUTCMonth() / 3) + 1) as 1 | 2 | 3 | 4;
  for (let y = fromYear; y <= currentYear; y++) {
    for (const q of [1, 2, 3, 4] as const) {
      if (y === currentYear && q > currentQuarter) break;
      out.push(quarterRange(y, q));
    }
  }
  return out;
}
