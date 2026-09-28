/**
 * jRCT — Japan Registry of Clinical Trials (MHLW). The primary registry for
 * Japanese drug trials since 2019 (JapicCTI and UMIN drug trials migrated in).
 *
 * Endpoints (no auth; verified Sep 2026):
 *   GET https://jrct.mhlw.go.jp/en-latest-detail/{jRCT id}
 *       Server-rendered English detail page ("Label | Value" table). Unknown ids
 *       return HTTP 500 with the generic page title. Verified on jRCT2080224823
 *       (Regeneron, evinacumab) and jRCT2031210099 (Astellas EAP).
 *   GET https://jrct.mhlw.go.jp/latest-detail/{id}      Japanese detail page.
 *   GET https://jrct.mhlw.go.jp/search?searched=1&spec={3|7}&page={n}&sort=record_cert_date
 *       Token-free results listing (verified Sep 27 2026): 50 rows per page,
 *       newest publication first, no session needed. spec 3 = 企業治験
 *       (company-sponsored IND trial, 4,188 rows), spec 7 = 医師主導治験
 *       (investigator-initiated IND trial). Each row: jRCT id, title,
 *       condition, recruitment status, 公表日 (publication date, Japanese era:
 *       令和8年9月3日 = 2026-09-03). The POST search form (CSRF _Token) only
 *       redirects here, so the listing is walked directly.
 *       Until Sep 27 2026 this adapter walked the id space jRCT2{region}{yy}{seq}
 *       and stopped a lane after 25 misses; ids are sparse, so it found
 *       almost nothing (1 trial stored in three weeks).
 * Labels parsed: "Trial ID", "Date of registration", "Last modified on", "Scientific Title",
 *   "Public Title", "Recruitment Status", "Date of First Enrolment", "Study Type", "Phase",
 *   "Health Condition or Problem Studied", "Intervention(s)" → "investigational material(s)"
 *   → "Generic name etc : X" / "INN of investigational material : X" (until "control
 *   material(s)"), "Primary Sponsor", "Secondary Sponsor", "Name of Funding Organization",
 *   "Secondary ID No." (+ "Name of Other Registries"), "Countries / Regions of Recruitment",
 *   "Completion Date or Terminated date". Dates look like "Aug. 06, 2019", "April. 27, 2024".
 * License   MHLW public data; terms of use at https://jrct.mhlw.go.jp/terms (attribution).
 * Reach     4,188 company-sponsored + ~1,500 investigator-initiated IND trials (Sep 2026).
 * Rate      we use 800 ms between requests.
 */

import type { FetchPageOptions, FetchPageResult, RegistryAdapter, RegistryRecord, RegistryIntervention } from './types';
import { RegistryUnavailableError } from './types';
import { extractCodeNames, isPlaceboOrGeneric, looksLikeInn } from '@/lib/radar/drug-name';
import {
  classifySponsorClass,
  compact,
  extractSecondaryIds,
  htmlToTokens,
  makeIntervention,
  mapRegistryPhase,
  mapRegistryStatus,
  normalizeRegistryDate,
  registryFetch,
  sleep,
  toIso2List,
  tokenAfter,
  tokenIndex,
  uniq,
} from './shared';

const BASE = () => process.env.JRCT_BASE_URL ?? 'https://jrct.mhlw.go.jp';
/** Search lanes: 3 = company-sponsored IND trials, 7 = investigator-initiated IND trials. */
export const JRCT_SPECS = ['3', '7'] as const;
const LISTING_PAGE_SIZE = 50;

export interface JrctRaw {
  id: string;
  html: string;
}

/** "Phase 2 Trial", "Phase I/II Study", "Phase 3b" in a title -> the phase phrase for mapRegistryPhase; null when absent. */
export function phaseFromTitle(title: string | null | undefined): string | null {
  if (!title) return null;
  const m = /\bphase\s*(i{1,3}v?|[1-4])\s*([ab])?(?:\s*[\/-]\s*(i{1,3}v?|[1-4]))?/i.exec(title);
  if (!m) return null;
  return m[3] ? `Phase ${m[1]}/${m[3]}` : `Phase ${m[1]}${m[2] ?? ''}`;
}

/**
 * Drug names from free text: development codes (TAK-079, ONO-4915) and
 * INN-looking words (mezagitamab), in order of first appearance, placebo and
 * generic words excluded.
 */
export function drugNamesFromText(parts: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (name: string) => {
    const n = name.trim();
    const k = n.toLowerCase();
    if (!n || seen.has(k) || isPlaceboOrGeneric(n)) return;
    seen.add(k);
    out.push(n);
  };
  for (const text of parts) {
    if (!text) continue;
    for (const code of extractCodeNames(text)) push(code);
    for (const word of text.match(/[A-Za-z][a-z]{5,}/g) ?? []) {
      if (looksLikeInn(word)) push(word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
    }
  }
  return out.slice(0, 6);
}

export function mapJrctHtml(raw: JrctRaw): RegistryRecord {
  const tokens = htmlToTokens(raw.html);
  const id = tokenAfter(tokens, 'Trial ID') ?? raw.id;
  const scientificTitle = tokenAfter(tokens, 'Scientific Title');
  const publicTitle = tokenAfter(tokens, 'Public Title');
  // Two page generations: the older one has a "Phase" row and "Generic name etc"
  // intervention lines; the current (2026) one has neither, so phase comes
  // from the scientific title and drug names from the free-text intervention.
  const phaseRaw = tokenAfter(tokens, 'Phase') ?? phaseFromTitle(scientificTitle ?? publicTitle);
  const statusRaw = tokenAfter(tokens, 'Recruitment Status');
  const studyTypeRaw = tokenAfter(tokens, 'Study Type');
  const sponsor = tokenAfter(tokens, 'Primary Sponsor');
  const secondarySponsor = tokenAfter(tokens, 'Secondary Sponsor');
  const funder = tokenAfter(tokens, 'Name of Funding Organization');
  const condition = tokenAfter(tokens, /^Health Condition\(?s?\)? or Problem\(?s?\)? Studied$/i);
  const countriesRaw = tokenAfter(tokens, /^Countries (\/ Regions )?of Recruitment/i);
  const interventionText = tokenAfter(tokens, 'Intervention(s)', { allowLabelValue: true });

  // Interventions: investigational material(s) block until control material(s)
  const interventions: RegistryIntervention[] = [];
  const ivIdx = tokenIndex(tokens, 'Intervention(s)');
  if (ivIdx !== -1) {
    let role: 'experimental' | 'comparator' = 'experimental';
    for (let j = ivIdx + 1; j < Math.min(tokens.length, ivIdx + 40); j++) {
      const t = tokens[j];
      if (/^control material\(s\)$/i.test(t)) { role = 'comparator'; continue; }
      if (/^(Health Condition\(s\) Keyword|Primary Outcome|Intervention\(s\) Keyword)$/i.test(t)) break;
      const m = /^(?:Generic name etc|INN of investigational material)\s*:\s*(.+)$/i.exec(t);
      if (m) {
        const name = m[1].trim();
        if (name && name !== '-' && !interventions.some(i => i.name.toLowerCase() === name.toLowerCase())) {
          const iv = makeIntervention(name, 'drug', role);
          if (iv) interventions.push(iv);
        }
      }
    }
  }

  if (interventions.length === 0) {
    for (const name of drugNamesFromText([interventionText, scientificTitle, publicTitle])) {
      const iv = makeIntervention(name, 'drug', 'experimental');
      if (iv) interventions.push(iv);
    }
  }

  // Secondary ids: every "Secondary ID No." value
  const secondary: string[] = [];
  for (let from = 0; ; ) {
    const i = tokenIndex(tokens, 'Secondary ID No.', from);
    if (i === -1) break;
    const v = tokens[i + 1];
    if (v && !/^Name of Other Registries$/i.test(v) && v !== '-') secondary.push(v);
    from = i + 1;
  }
  const secondaryIds = uniq([...secondary, ...extractSecondaryIds(tokens.join(' '))]).filter(s => s !== id);

  const kind = /^jRCT(\w)/.exec(id)?.[1] ?? '';
  // The current page lists recruitment countries "except Japan"; a jRCT trial always recruits in Japan.
  const countries = uniq(['JP', ...toIso2List((countriesRaw ?? '').split(/\s*[\/,;]\s*/))]);

  return {
    registry: 'jrct',
    registry_id: id,
    secondary_ids: secondaryIds,
    title: scientificTitle ?? publicTitle,
    sponsor_name: sponsor,
    sponsor_type: classifySponsorClass(sponsor),
    collaborators: compact([secondarySponsor, funder]).filter(c => c !== sponsor && c !== '-'),
    interventions,
    conditions: compact([condition]).slice(0, 20),
    phase_raw: phaseRaw,
    phase: mapRegistryPhase(phaseRaw),
    status_raw: statusRaw,
    status: mapRegistryStatus(statusRaw),
    study_type: studyTypeRaw ? (/interven/i.test(studyTypeRaw) ? 'interventional' : /observ/i.test(studyTypeRaw) ? 'observational' : studyTypeRaw.toLowerCase()) : null,
    countries,
    start_date: normalizeRegistryDate(tokenAfter(tokens, 'Actual date of first enrollment') ?? tokenAfter(tokens, 'Date of First Enrolment')),
    primary_completion_date: normalizeRegistryDate(tokenAfter(tokens, 'Completion Date or Terminated date')),
    first_registered: normalizeRegistryDate(tokenAfter(tokens, 'Date of registration')),
    last_updated: normalizeRegistryDate(tokenAfter(tokens, 'Last modified on')),
    source_url: `${BASE()}/en-latest-detail/${id}`,
    raw: { format: 'jrct_html_tokens', kind, tokens: tokens.slice(0, 400) },
  };
}

export interface JrctListingRow {
  id: string;
  title: string | null;
  condition: string | null;
  status_raw: string | null;
  /** 公表日 as ISO date, when parseable. */
  published: string | null;
}

/** 令和8年9月3日 -> 2026-09-03 (Reiwa 1 = 2019, Heisei 1 = 1989). Also accepts 2026/09/03 and 2026-09-03. */
export function japaneseEraDateToIso(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const t = raw.replace(/\s+/g, '');
  const era = /(令和|平成|昭和)(元|\d{1,2})年(\d{1,2})月(\d{1,2})日/.exec(t);
  if (era) {
    const n = era[2] === '元' ? 1 : Number(era[2]);
    const base = era[1] === '令和' ? 2018 : era[1] === '平成' ? 1988 : 1925;
    const y = base + n;
    return `${y}-${String(era[3]).padStart(2, '0')}-${String(era[4]).padStart(2, '0')}`;
  }
  const ymd = /(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/.exec(t);
  if (ymd) return `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`;
  return null;
}

export function jrctListingUrl(spec: string, page: number): string {
  return `${BASE()}/search?searched=1&spec=${spec}&page=${page}&sort=record_cert_date`;
}

/** Rows of a results listing page (server-rendered table; one <tr> per trial). */
export function parseJrctListing(html: string): JrctListingRow[] {
  const out: JrctListingRow[] = [];
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(html)) !== null) {
    const cells = [...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(c =>
      c[1].replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim(),
    );
    if (cells.length < 5) continue;
    const id = /jRCT[0-9a-z]{10,13}/.exec(cells[0])?.[0];
    if (!id) continue;
    out.push({
      id,
      title: cells[1] || null,
      condition: cells[2] || null,
      status_raw: cells[3] || null,
      published: japaneseEraDateToIso(cells[4]),
    });
  }
  return out;
}

interface JrctCursor {
  /** Index into JRCT_SPECS. */
  lane: number;
  /** 1-based listing page. */
  page: number;
  /** Next row index within the listing page. */
  idx: number;
  /**
   * Rows of the current listing page as [id, publishedIso|null], cached in the
   * cursor because the listing takes ~30 s to render server-side and one page
   * covers 50 records across several runs.
   */
  rows?: Array<[string, string | null]>;
  sweepStartedAt: string;
}

export function parseJrctCursor(cursor: string | null, now: Date): JrctCursor {
  const initial: JrctCursor = { lane: 0, page: 1, idx: 0, sweepStartedAt: now.toISOString() };
  if (!cursor) return initial;
  try {
    const c = JSON.parse(cursor) as Partial<JrctCursor>;
    // Pre-Sep-2026 cursors ({kindIdx, regionIdx, ...}) restart the sweep.
    if (typeof c.page !== 'number') return initial;
    const rows = Array.isArray(c.rows)
      ? c.rows.filter((r): r is [string, string | null] => Array.isArray(r) && typeof r[0] === 'string').slice(0, LISTING_PAGE_SIZE)
      : undefined;
    return {
      lane: Math.max(0, Math.min(JRCT_SPECS.length - 1, Number(c.lane) || 0)),
      page: Math.max(1, Number(c.page) || 1),
      idx: Math.max(0, Number(c.idx) || 0),
      rows: rows && rows.length ? rows : undefined,
      sweepStartedAt: typeof c.sweepStartedAt === 'string' ? c.sweepStartedAt : initial.sweepStartedAt,
    };
  } catch {
    return initial;
  }
}

export const jrctAdapter: RegistryAdapter<JrctRaw> = {
  registry: 'jrct',
  displayName: 'jRCT (Japan)',
  countryScope: ['JP'],
  license: 'MHLW public data, attribution required',
  capability: 'api',
  transport: 'html',
  verified: 'verified',
  rateLimitMs: 1_500,
  defaultLimit: 40,
  estimatedReach: 5_700,
  urls: {
    search: 'https://jrct.mhlw.go.jp/search',
    detail: id => `https://jrct.mhlw.go.jp/en-latest-detail/${id}`,
  },

  mapRecord(raw: JrctRaw): RegistryRecord {
    return mapJrctHtml(raw);
  },

  /**
   * Cursor: {"lane","page","idx","sweepStartedAt"}. Walks the company-sponsored
   * listing (spec 3) then the investigator-initiated one (spec 7), newest
   * publication first, fetching each row's English detail page. With `since`
   * (incremental sweep) a lane ends at the first row published before it.
   */
  async fetchPage(cursor: string | null, opts: FetchPageOptions): Promise<FetchPageResult> {
    const now = new Date();
    let c = parseJrctCursor(cursor, now);
    const limit = Math.min(opts.limit ?? this.defaultLimit, 100);
    const records: RegistryRecord[] = [];
    const warnings: string[] = [];
    const since = opts.since ?? null;

    const nextLane = (): JrctCursor | null =>
      c.lane + 1 < JRCT_SPECS.length ? { lane: c.lane + 1, page: 1, idx: 0, sweepStartedAt: c.sweepStartedAt } : null;

    while (records.length < limit) {
      if (opts.signal?.aborted) {
        warnings.push('jRCT: run aborted before the page finished');
        break;
      }
      const spec = JRCT_SPECS[c.lane];
      let rows = c.rows;
      if (!rows) {
        try {
          // The listing is server-rendered on demand and takes ~30 s; one listing covers 50 records, so it is cached in the cursor.
          const res = await registryFetch(jrctListingUrl(spec, c.page), { signal: opts.signal, timeoutMs: 75_000, retries: 1 });
          if (res.status === 403 || res.status === 429 || res.status === 503) {
            // MHLW rate-limits bursts (seen Sep 28 2026 after ~60 detail pages at 600 ms): stop this run
            // instead of hammering; the next sweep slot resumes from the cursor.
            if (records.length === 0) throw new RegistryUnavailableError('jrct', `listing HTTP ${res.status}; backing off until the next sweep`);
            warnings.push(`jRCT listing spec=${spec} page=${c.page}: HTTP ${res.status}; stopping early`);
            break;
          }
          if (!res.ok) {
            warnings.push(`jRCT listing spec=${spec} page=${c.page}: HTTP ${res.status}`);
            break;
          }
          rows = parseJrctListing(await res.text()).map(r => [r.id, r.published] as [string, string | null]);
        } catch (err) {
          warnings.push(`jRCT listing spec=${spec} page=${c.page}: ${err instanceof Error ? err.message : String(err)}`);
          break;
        }
        c = { ...c, idx: 0, rows };
      }
      // Lane exhausted (empty page) or, incrementally, nothing newer than `since` left.
      const stopLane = rows.length === 0 || (since !== null && c.idx < rows.length && rows[c.idx][1] !== null && rows[c.idx][1]! < since);
      if (stopLane) {
        const lane = nextLane();
        if (lane) { c = lane; continue; }
        return { records, nextCursor: null, done: true, warnings };
      }
      for (; c.idx < rows.length && records.length < limit; c.idx++) {
        if (opts.signal?.aborted) break;
        const [id, published] = rows[c.idx];
        if (since !== null && published !== null && published < since) break;
        try {
          const res = await registryFetch(`${BASE()}/en-latest-detail/${id}`, { signal: opts.signal, timeoutMs: 25_000, retries: 0 });
          if (res.status === 403 || res.status === 429 || res.status === 503) {
            // Rate-limited mid-page: keep the cursor on this row and end the run.
            if (records.length === 0) throw new RegistryUnavailableError('jrct', `detail HTTP ${res.status}; backing off until the next sweep`);
            warnings.push(`jRCT ${id}: HTTP ${res.status}; stopping early`);
            return { records, nextCursor: JSON.stringify(c), done: false, warnings };
          }
          const html = res.ok ? await res.text() : '';
          if (res.ok && html.includes(id) && /Trial ID/.test(html)) {
            records.push(mapJrctHtml({ id, html }));
          } else {
            warnings.push(`jRCT ${id}: detail ${res.status}`);
          }
        } catch (err) {
          warnings.push(`jRCT ${id}: ${err instanceof Error ? err.message : String(err)}`);
        }
        await sleep(this.rateLimitMs);
      }
      if (c.idx >= rows.length) {
        if (rows.length < LISTING_PAGE_SIZE) {
          const lane = nextLane();
          if (lane) { c = lane; continue; }
          return { records, nextCursor: null, done: true, warnings };
        }
        c = { lane: c.lane, page: c.page + 1, idx: 0, sweepStartedAt: c.sweepStartedAt };
      }
    }
    return { records, nextCursor: JSON.stringify(c), done: false, warnings };
  },
};

export default jrctAdapter;
