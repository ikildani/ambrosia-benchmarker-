/**
 * CDE fetchPage for the browser worker. The registry sits behind a WAF that
 * hands out a JavaScript challenge; once a real browser has the cookie, the
 * listing and detail POSTs can be made through the browser context. This
 * module only needs a `CdeSession` (post form, get status + body) so the
 * cursor logic is testable without Playwright.
 *
 * Walk: newest registration first (rule=CTR, sort=desc), 20 rows per listing
 * page, one detail POST per row. The cursor caches the current page's rows.
 * With `since` (incremental sweep) the walk ends at the first page whose
 * every row was first posted before `since`.
 */

import type { FetchPageOptions, FetchPageResult, RegistryRecord } from '../types';
import { RegistryUnavailableError } from '../types';
import { mapCdePage } from '../cde';
import {
  CDE_BASE,
  CDE_DETAIL_PATH,
  CDE_LISTING_PAGE_SIZE,
  CDE_LISTING_PATH,
  cdeDetailForm,
  cdeListingForm,
  looksLikeCdeChallenge,
  parseCdeDetail,
  parseCdeListing,
  type CdeListingRow,
} from './cde-pages';

export interface CdeSession {
  /** POST a form to a registry path with the challenge cookie attached. */
  post(path: string, form: Record<string, string>): Promise<{ status: number; text: string }>;
  /** Re-run the challenge (new page load) after a response that looks like the WAF shell. */
  refresh(): Promise<void>;
}

export interface CdeCursor {
  page: number;
  idx: number;
  rows?: CdeListingRow[];
  sweepStartedAt: string;
}

export function parseCdeCursor(cursor: string | null, now: Date): CdeCursor {
  const initial: CdeCursor = { page: 1, idx: 0, sweepStartedAt: now.toISOString() };
  if (!cursor) return initial;
  try {
    const c = JSON.parse(cursor) as Partial<CdeCursor>;
    if (typeof c.page !== 'number') return initial;
    const rows = Array.isArray(c.rows) ? c.rows.filter(r => r && typeof r.id === 'string' && typeof r.ctr === 'string') : undefined;
    return {
      page: Math.max(1, c.page),
      idx: Math.max(0, Number(c.idx) || 0),
      rows: rows && rows.length ? rows : undefined,
      sweepStartedAt: typeof c.sweepStartedAt === 'string' ? c.sweepStartedAt : initial.sweepStartedAt,
    };
  } catch {
    return initial;
  }
}

export interface CdeFetchOptions {
  rateLimitMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => Date;
}

export function createCdeFetchPage(session: CdeSession, opts: CdeFetchOptions = {}) {
  const rateLimitMs = opts.rateLimitMs ?? 1_500;
  const sleep = opts.sleep ?? (ms => new Promise<void>(r => setTimeout(r, ms)));
  const nowFn = opts.now ?? (() => new Date());

  async function postChecked(path: string, form: Record<string, string>, what: string): Promise<string> {
    let res = await session.post(path, form);
    if (res.status === 200 && !looksLikeCdeChallenge(res.text)) return res.text;
    // Challenge cookie expired or never set: one refresh, then give up for this run.
    await session.refresh();
    res = await session.post(path, form);
    if (res.status === 200 && !looksLikeCdeChallenge(res.text)) return res.text;
    throw new RegistryUnavailableError('cde', `${what}: HTTP ${res.status}${looksLikeCdeChallenge(res.text) ? ' (WAF challenge)' : ''}`);
  }

  return async function fetchPage(cursor: string | null, fetchOpts: FetchPageOptions): Promise<FetchPageResult> {
    let c = parseCdeCursor(cursor, nowFn());
    const limit = Math.min(fetchOpts.limit ?? CDE_LISTING_PAGE_SIZE, 100);
    const since = fetchOpts.since ?? null;
    const records: RegistryRecord[] = [];
    const warnings: string[] = [];
    let olderThanSince = 0;

    while (records.length < limit) {
      if (fetchOpts.signal?.aborted) break;
      let rows = c.rows;
      if (!rows) {
        const html = await postChecked(CDE_LISTING_PATH, cdeListingForm(c.page), `listing page ${c.page}`);
        rows = parseCdeListing(html);
        c = { ...c, idx: 0, rows };
        await sleep(rateLimitMs);
      }
      if (rows.length === 0) return { records, nextCursor: null, done: true, warnings };

      for (; c.idx < rows.length && records.length < limit; c.idx++) {
        if (fetchOpts.signal?.aborted) break;
        const row = rows[c.idx];
        try {
          const html = await postChecked(CDE_DETAIL_PATH, cdeDetailForm(row, c.page), `detail ${row.ctr}`);
          const page = parseCdeDetail(html, `${CDE_BASE}${CDE_DETAIL_PATH}?ctr=${encodeURIComponent(row.ctr)}`, row);
          if (!page.id) {
            warnings.push(`CDE ${row.ctr}: detail page had no 登记号`);
          } else {
            const rec = mapCdePage(page);
            records.push(rec);
            if (since && rec.first_registered && rec.first_registered < since) olderThanSince++;
          }
        } catch (err) {
          if (err instanceof RegistryUnavailableError) {
            if (records.length === 0) throw err;
            warnings.push(`${err.message}; stopping early`);
            return { records, nextCursor: JSON.stringify(c), done: false, warnings };
          }
          warnings.push(`CDE ${row.ctr}: ${err instanceof Error ? err.message : String(err)}`);
        }
        await sleep(rateLimitMs);
      }

      if (c.idx >= rows.length) {
        // Incremental sweep: a whole page older than `since` ends the walk.
        if (since && olderThanSince >= rows.length && rows.length > 0) return { records, nextCursor: null, done: true, warnings };
        if (rows.length < CDE_LISTING_PAGE_SIZE) return { records, nextCursor: null, done: true, warnings };
        c = { page: c.page + 1, idx: 0, sweepStartedAt: c.sweepStartedAt };
        olderThanSince = 0;
      }
    }
    return { records, nextCursor: JSON.stringify(c), done: false, warnings };
  };
}
