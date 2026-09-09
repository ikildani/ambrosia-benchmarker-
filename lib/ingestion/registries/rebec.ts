/**
 * ReBEC — Registro Brasileiro de Ensaios Clínicos (Brazil; also used by some
 * LATAM sponsors). Peru's REPEC and Cuba's RPCEC have no machine-readable
 * export (REPEC is a PHP search UI, RPCEC an HTML list) and are covered
 * through the WHO ICTRP id bridge only.
 *
 * Endpoints (no auth; verified Sep 2026):
 *   GET https://ensaiosclinicos.gov.br/list/{page}        HTML, 20 trials/page, newest first,
 *                                                         links /rg/RBR-xxxxxx (page 1 = /list)
 *   GET https://ensaiosclinicos.gov.br/rg/{RBR-code}      HTML detail page; contains the link
 *                                                         /xml_ictrp/downloadxmlictrp/{internalId}
 *   GET https://ensaiosclinicos.gov.br/xml_ictrp/downloadxmlictrp/{internalId}
 *                                                         WHO ICTRP XML for that trial
 *                                                         (<root><trials><trial><main>…). Internal
 *                                                         ids are NOT sequential per RBR code and
 *                                                         unknown ids return the site's 404 HTML,
 *                                                         so ids must come from the detail page.
 *   Search (/search?allFields=…) is behind Cloudflare Turnstile — not usable.
 *   Dates are DD/MM/YYYY.
 * License   Brazilian federal open data (Lei 12.527/2011, dados.gov.br);
 *           the dados.gov.br ReBEC dataset API itself requires an account token.
 * Reach     ~9,000 trials; ~1,200 industry-sponsored drug trials.
 * Rate      we use 600 ms between requests (3 requests per new trial).
 */

import type { FetchPageOptions, FetchPageResult, RegistryAdapter, RegistryRecord } from './types';
import { mapIctrpXml, normalizeRegistryDate, registryFetch, sleep, uniq } from './shared';

const BASE = () => process.env.REBEC_BASE_URL ?? 'https://ensaiosclinicos.gov.br';

export interface RebecRaw {
  code: string;
  internalId: number | null;
  xml: string;
}

export function mapRebecXml(raw: RebecRaw): RegistryRecord {
  const rec = mapIctrpXml(raw.xml, {
    registry: 'rebec',
    defaultCountries: ['BR'],
    detailUrl: id => `${BASE()}/rg/${id}`,
    dayFirstDates: true,
  });
  if (!rec.registry_id) rec.registry_id = raw.code;
  rec.source_url = `${BASE()}/rg/${rec.registry_id}`;
  rec.raw = { ...(rec.raw as Record<string, unknown>), internal_id: raw.internalId };
  return rec;
}

export function extractRebecCodes(listHtml: string): string[] {
  const out: string[] = [];
  const re = /\/rg\/(RBR-[a-z0-9]{4,12})\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(listHtml)) !== null) out.push(m[1]);
  return uniq(out);
}

export function extractRebecInternalId(detailHtml: string): number | null {
  const m = /downloadxmlictrp\/(\d+)/.exec(detailHtml);
  return m ? Number(m[1]) : null;
}

interface RebecCursor {
  page: number;
  sweepStartedAt: string;
}

function parseCursor(cursor: string | null): RebecCursor {
  if (!cursor) return { page: 1, sweepStartedAt: new Date().toISOString() };
  try {
    const c = JSON.parse(cursor) as Partial<RebecCursor>;
    return { page: Math.max(1, Number(c.page) || 1), sweepStartedAt: c.sweepStartedAt ?? new Date().toISOString() };
  } catch {
    return { page: 1, sweepStartedAt: new Date().toISOString() };
  }
}

async function getText(url: string, signal?: AbortSignal): Promise<{ ok: boolean; status: number; text: string }> {
  const res = await registryFetch(url, { signal, timeoutMs: 30_000, retries: 1 });
  const text = res.ok ? await res.text() : '';
  return { ok: res.ok, status: res.status, text };
}

export const rebecAdapter: RegistryAdapter<RebecRaw> = {
  registry: 'rebec',
  displayName: 'ReBEC (Brazil)',
  countryScope: ['BR'],
  license: 'Brazilian federal open data (Lei 12.527/2011)',
  capability: 'api',
  transport: 'xml',
  verified: 'verified',
  rateLimitMs: 600,
  defaultLimit: 20,
  estimatedReach: 9_000,
  urls: {
    search: 'https://ensaiosclinicos.gov.br/list',
    detail: id => `https://ensaiosclinicos.gov.br/rg/${id}`,
  },

  mapRecord(raw: RebecRaw): RegistryRecord {
    return mapRebecXml(raw);
  },

  /**
   * Cursor: {"page":n}. One list page (20 trials) per call; for each code the
   * detail page is fetched to find the internal id, then the ICTRP XML. With
   * `opts.since`, the sweep stops once every trial on a page was registered
   * before it (the list is newest-first).
   */
  async fetchPage(cursor: string | null, opts: FetchPageOptions): Promise<FetchPageResult> {
    const c = parseCursor(cursor);
    const since = opts.since ? normalizeRegistryDate(opts.since) : null;
    const listUrl = c.page === 1 ? `${BASE()}/list` : `${BASE()}/list/${c.page}`;
    const list = await getText(listUrl, opts.signal);
    if (!list.ok) throw new Error(`ReBEC list page ${c.page}: HTTP ${list.status}`);
    const codes = extractRebecCodes(list.text).slice(0, opts.limit ?? this.defaultLimit);
    const warnings: string[] = [];
    const records: RegistryRecord[] = [];
    let allBeforeSince = since !== null && codes.length > 0;

    for (const code of codes) {
      if (opts.signal?.aborted) break;
      try {
        await sleep(this.rateLimitMs);
        const detail = await getText(`${BASE()}/rg/${code}`, opts.signal);
        const internalId = detail.ok ? extractRebecInternalId(detail.text) : null;
        if (!internalId) {
          warnings.push(`ReBEC ${code}: no ICTRP xml link on detail page (HTTP ${detail.status})`);
          continue;
        }
        await sleep(this.rateLimitMs);
        const xml = await getText(`${BASE()}/xml_ictrp/downloadxmlictrp/${internalId}`, opts.signal);
        if (!xml.ok || !/<trial_id>/i.test(xml.text)) {
          warnings.push(`ReBEC ${code}: xml ${internalId} unavailable`);
          continue;
        }
        const rec = mapRebecXml({ code, internalId, xml: xml.text });
        if (since && rec.first_registered && rec.first_registered >= since) allBeforeSince = false;
        if (!since) allBeforeSince = false;
        records.push(rec);
      } catch (err) {
        warnings.push(`ReBEC ${code}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const done = codes.length === 0 || allBeforeSince;
    return {
      records,
      nextCursor: done ? null : JSON.stringify({ page: c.page + 1, sweepStartedAt: c.sweepStartedAt } satisfies RebecCursor),
      done,
      warnings,
    };
  },
};

export default rebecAdapter;
