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
 *   GET https://jrct.mhlw.go.jp/search                  GET form (CakePHP) with
 *       reg_* parameters; results and the CSV download (/search-results-download)
 *       need the _Token CSRF fields from the form page, so enumeration here walks
 *       the id space instead (see below). Wire the search form up in the
 *       off-Vercel worker to get "last modified" ordering.
 * Id scheme  jRCT{kind}{region}{yy}{seq}: kind 2 = drug/medical-device trial under the
 *       Pharmaceutical Affairs Act (PMD Act) or transitioned JapicCTI (region 080),
 *       kind 1 = specified clinical research w/o IND, "s" = specified clinical research
 *       (Clinical Trials Act), "a/b/c" = regenerative medicine. Region codes seen:
 *       031 (Kanto), 041, 051 (Kinki), 061, 071, 080 (transitioned JapicCTI), 011, 021.
 *       Sequence is 4 digits per region-year; the walk stops a region-year after
 *       25 consecutive misses. Only kind 2 ids are walked (drug assets).
 * Labels parsed: "Trial ID", "Date of registration", "Last modified on", "Scientific Title",
 *   "Public Title", "Recruitment Status", "Date of First Enrolment", "Study Type", "Phase",
 *   "Health Condition or Problem Studied", "Intervention(s)" → "investigational material(s)"
 *   → "Generic name etc : X" / "INN of investigational material : X" (until "control
 *   material(s)"), "Primary Sponsor", "Secondary Sponsor", "Name of Funding Organization",
 *   "Secondary ID No." (+ "Name of Other Registries"), "Countries / Regions of Recruitment",
 *   "Completion Date or Terminated date". Dates look like "Aug. 06, 2019", "April. 27, 2024".
 * License   MHLW public data; terms of use at https://jrct.mhlw.go.jp/terms (attribution).
 * Reach     ~15,000 kind-2 records; ~6,000 industry-sponsored drug trials.
 * Rate      we use 800 ms between requests.
 */

import type { FetchPageOptions, FetchPageResult, RegistryAdapter, RegistryRecord, RegistryIntervention } from './types';
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
const REGIONS = ['031', '041', '051', '061', '071', '080', '011', '021', '091'];
const KINDS = ['2'];
const MISS_STREAK_STOP = 25;

export interface JrctRaw {
  id: string;
  html: string;
}

export function mapJrctHtml(raw: JrctRaw): RegistryRecord {
  const tokens = htmlToTokens(raw.html);
  const id = tokenAfter(tokens, 'Trial ID') ?? raw.id;
  const scientificTitle = tokenAfter(tokens, 'Scientific Title');
  const publicTitle = tokenAfter(tokens, 'Public Title');
  const phaseRaw = tokenAfter(tokens, 'Phase');
  const statusRaw = tokenAfter(tokens, 'Recruitment Status');
  const studyTypeRaw = tokenAfter(tokens, 'Study Type');
  const sponsor = tokenAfter(tokens, 'Primary Sponsor');
  const secondarySponsor = tokenAfter(tokens, 'Secondary Sponsor');
  const funder = tokenAfter(tokens, 'Name of Funding Organization');
  const condition = tokenAfter(tokens, 'Health Condition or Problem Studied');
  const countriesRaw = tokenAfter(tokens, 'Countries / Regions of Recruitment');

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
  const countries = toIso2List((countriesRaw ?? '').split(/\s*[\/,;]\s*/));

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
    countries: countries.length > 0 ? countries : ['JP'],
    start_date: normalizeRegistryDate(tokenAfter(tokens, 'Actual date of first enrollment') ?? tokenAfter(tokens, 'Date of First Enrolment')),
    primary_completion_date: normalizeRegistryDate(tokenAfter(tokens, 'Completion Date or Terminated date')),
    first_registered: normalizeRegistryDate(tokenAfter(tokens, 'Date of registration')),
    last_updated: normalizeRegistryDate(tokenAfter(tokens, 'Last modified on')),
    source_url: `${BASE()}/en-latest-detail/${id}`,
    raw: { format: 'jrct_html_tokens', kind, tokens: tokens.slice(0, 400) },
  };
}

interface JrctCursor {
  kindIdx: number;
  regionIdx: number;
  yy: number;
  seq: number;
  missStreak: number;
}

function parseCursor(cursor: string | null): JrctCursor {
  const yyNow = new Date().getUTCFullYear() % 100;
  const initial: JrctCursor = { kindIdx: 0, regionIdx: 0, yy: yyNow - 2, seq: 1, missStreak: 0 };
  if (!cursor) return initial;
  try {
    const c = JSON.parse(cursor) as Partial<JrctCursor>;
    return {
      kindIdx: Number(c.kindIdx) || 0,
      regionIdx: Number(c.regionIdx) || 0,
      yy: Number(c.yy) || initial.yy,
      seq: Number(c.seq) || 1,
      missStreak: Number(c.missStreak) || 0,
    };
  } catch {
    return initial;
  }
}

export function jrctIdFor(c: JrctCursor): string {
  return `jRCT${KINDS[c.kindIdx]}${REGIONS[c.regionIdx]}${String(c.yy).padStart(2, '0')}${String(c.seq).padStart(4, '0')}`;
}

/** Advance to the next region-year lane; returns null when the sweep is complete. */
function nextLane(c: JrctCursor): JrctCursor | null {
  const yyNow = new Date().getUTCFullYear() % 100;
  const n = { ...c, seq: 1, missStreak: 0 };
  if (n.yy < yyNow) { n.yy += 1; return n; }
  n.yy = yyNow - 2;
  if (n.regionIdx + 1 < REGIONS.length) { n.regionIdx += 1; return n; }
  n.regionIdx = 0;
  if (n.kindIdx + 1 < KINDS.length) { n.kindIdx += 1; return n; }
  return null;
}

export const jrctAdapter: RegistryAdapter<JrctRaw> = {
  registry: 'jrct',
  displayName: 'jRCT (Japan)',
  countryScope: ['JP'],
  license: 'MHLW public data, attribution required',
  capability: 'api',
  transport: 'html',
  verified: 'partial',
  rateLimitMs: 800,
  defaultLimit: 25,
  estimatedReach: 15_000,
  urls: {
    search: 'https://jrct.mhlw.go.jp/search',
    detail: id => `https://jrct.mhlw.go.jp/en-latest-detail/${id}`,
  },

  mapRecord(raw: JrctRaw): RegistryRecord {
    return mapJrctHtml(raw);
  },

  /**
   * Cursor: {"kindIdx","regionIdx","yy","seq","missStreak"}. Walks
   * jRCT2{region}{yy}{seq} for the last three years; 25 consecutive misses end
   * the region-year lane. Detail-page parsing is verified; the lane scheme is
   * an inference from observed ids and should be replaced by the search-form
   * "last modified" listing in the Playwright worker.
   */
  async fetchPage(cursor: string | null, opts: FetchPageOptions): Promise<FetchPageResult> {
    let c = parseCursor(cursor);
    const limit = Math.min(opts.limit ?? this.defaultLimit, 100);
    const records: RegistryRecord[] = [];
    const warnings: string[] = [];
    for (let i = 0; i < limit; i++) {
      if (opts.signal?.aborted) break;
      const id = jrctIdFor(c);
      try {
        const res = await registryFetch(`${BASE()}/en-latest-detail/${id}`, { signal: opts.signal, timeoutMs: 25_000, retries: 0 });
        const html = res.ok ? await res.text() : '';
        if (res.ok && html.includes(id) && /Trial ID/.test(html)) {
          records.push(mapJrctHtml({ id, html }));
          c = { ...c, seq: c.seq + 1, missStreak: 0 };
        } else {
          c = { ...c, seq: c.seq + 1, missStreak: c.missStreak + 1 };
        }
      } catch (err) {
        warnings.push(`jRCT ${id}: ${err instanceof Error ? err.message : String(err)}`);
        c = { ...c, seq: c.seq + 1, missStreak: c.missStreak + 1 };
      }
      if (c.missStreak >= MISS_STREAK_STOP) {
        const lane = nextLane(c);
        if (!lane) return { records, nextCursor: null, done: true, warnings };
        c = lane;
      }
      await sleep(this.rateLimitMs);
    }
    return { records, nextCursor: JSON.stringify(c), done: false, warnings };
  },
};

export default jrctAdapter;
