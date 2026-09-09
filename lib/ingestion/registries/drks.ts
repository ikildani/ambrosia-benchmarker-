/**
 * DRKS — Deutsches Register Klinischer Studien (German Clinical Trials
 * Register, run by BfArM since 2023).
 *
 * Endpoints (no auth; verified Sep 2026):
 *   GET https://drks.de/search/en/trial/DRKS000NNNNN
 *       Server-rendered HTML (JSF/Mojarra) with "Label: | Value" rows. Unknown ids
 *       return the generic search page (no "DRKS-ID:" row). Ids are sequential
 *       (DRKS00000001 … ~DRKS00037500 in Sep 2026), so the sweep walks the id space.
 *   GET https://drks.de/search/en/trial/DRKS000NNNNN/download
 *       Offers JSON / CSV / RIS / WHOXML, but the download is a JSF form POST that
 *       requires the jakarta.faces.ViewState token, the session cookie and an
 *       AJAX round-trip on the confirmation checkbox (mojarra.ab) before the
 *       download button is enabled — a plain fetch sequence returned the HTML
 *       page again, so this adapter parses the trial page instead.
 *   GET https://drks.de/search/en/results?…   search is also a JSF POST; not used.
 *   The old drks_web XML export (SearchExport) was retired with the 2023 relaunch.
 * Labels parsed (English page): "DRKS-ID:", "Recruitment Status:", "Date of registration
 *   in DRKS:", "Last update in DRKS:", "Study type:", "Phase:", "Recruitment countries:",
 *   "Planned study start date:", "Actual study start date:", "Planned study completion date:",
 *   "Actual Study Completion Date:", "Primary Sponsor" → "Address:" → org line,
 *   "Investigator Sponsored/Initiated Trial (IST/IIT):", "Health condition or problem studied"
 *   → "ICD-10-GM (translation):" / "Free text:", "Interventions, Observational Groups" →
 *   "Arm 1:" …, "Other WHO Primary Registry or Data Provider ID:", "EudraCT Number:",
 *   "UTN (Universal Trial Number):", "EUDAMED Number:". Title is the page <h1>.
 * License   DRKS terms of use: data may be used with source attribution
 *           (https://drks.de/search/en/terms-of-use).
 * Reach     ~37,000 trials; ~1,500 industry-sponsored interventional drug trials
 *           (most German industry trials are on CTIS/EudraCT and CT.gov, so DRKS is
 *           mainly investigator-initiated; the EudraCT/NCT bridge fields matter).
 * Rate      we use 700 ms between requests.
 */

import type { FetchPageOptions, FetchPageResult, RegistryAdapter, RegistryRecord, RegistryIntervention } from './types';
import {
  activeStatusByDate,
  classifySponsorClass,
  compact,
  extractSecondaryIds,
  htmlFirst,
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

const BASE = () => process.env.DRKS_BASE_URL ?? 'https://drks.de/search/en/trial';
const DEFAULT_START = 30_000; // ~2022 onward
const MISS_STREAK_STOP = 60;

export interface DrksRaw {
  id: string; // DRKS00034000
  html: string;
}

export function drksId(n: number): string {
  return `DRKS${String(n).padStart(8, '0')}`;
}

export function mapDrksHtml(raw: DrksRaw, now = new Date()): RegistryRecord {
  const tokens = htmlToTokens(raw.html);
  const id = (tokenAfter(tokens, 'DRKS-ID:') ?? raw.id).trim();
  const title = htmlFirst(raw.html, 'h1') ?? htmlFirst(raw.html, 'h2');

  const studyTypeRaw = tokenAfter(tokens, 'Study type:');
  const phaseRaw = tokenAfter(tokens, 'Phase:');
  const statusRaw = tokenAfter(tokens, 'Recruitment Status:');
  const plannedStart = tokenAfter(tokens, 'Planned study start date:');
  const actualStart = tokenAfter(tokens, 'Actual study start date:');
  const plannedEnd = tokenAfter(tokens, 'Planned study completion date:');
  const actualEnd = tokenAfter(tokens, 'Actual Study Completion Date:');
  const registered = tokenAfter(tokens, 'Date of registration in DRKS:');
  const updated = tokenAfter(tokens, 'Last update in DRKS:');
  const countriesRaw = tokenAfter(tokens, 'Recruitment countries:');
  const ist = tokenAfter(tokens, 'Investigator Sponsored/Initiated Trial (IST/IIT):');

  // Primary sponsor block: "Primary Sponsor" | "Address:" | <org> | <street> | <zip city> | <country>
  let sponsor: string | null = null;
  const sponsorIdx = tokenIndex(tokens, 'Primary Sponsor');
  if (sponsorIdx !== -1) {
    const addrIdx = tokenIndex(tokens, 'Address:', sponsorIdx);
    if (addrIdx !== -1 && addrIdx - sponsorIdx <= 3) sponsor = tokens[addrIdx + 1] ?? null;
  }
  const sponsorClass = classifySponsorClass(sponsor, ist && /^yes$/i.test(ist) ? 'investigator-initiated academic' : null);

  // Conditions
  const conditions: string[] = [];
  const condIdx = tokenIndex(tokens, 'Health condition or problem studied');
  if (condIdx !== -1) {
    for (let j = condIdx + 1; j < Math.min(tokens.length, condIdx + 12); j++) {
      const t = tokens[j];
      if (/^(ICD-10-GM \(translation\):|Free text:|ICD-10:)$/i.test(t) && tokens[j + 1]) conditions.push(tokens[j + 1]);
      if (/^Interventions, Observational Groups$/i.test(t)) break;
    }
  }

  // Arms
  const interventions: RegistryIntervention[] = [];
  const armIdx = tokenIndex(tokens, 'Interventions, Observational Groups');
  if (armIdx !== -1) {
    for (let j = armIdx + 1; j < Math.min(tokens.length, armIdx + 24); j++) {
      const t = tokens[j];
      if (/^Endpoints$/i.test(t) || /^Primary outcome:$/i.test(t)) break;
      const m = /^Arm (\d+):$/i.exec(t);
      if (m && tokens[j + 1]) {
        const desc = tokens[j + 1];
        const role = /placebo/i.test(desc) ? 'placebo' : /control|standard of care|comparator/i.test(desc) ? 'comparator' : 'experimental';
        const type = /placebo|drug|mg\b|dose|tablet|infusion|injection|arzneimittel|medication|therapy with/i.test(desc) && !/device|surgery|training|exercise/i.test(desc)
          ? 'drug'
          : 'unknown';
        const iv = makeIntervention(desc.slice(0, 160), type, role);
        if (iv) interventions.push(iv);
      }
    }
  }

  // Secondary ids
  const whoId = tokenAfter(tokens, 'Other WHO Primary Registry or Data Provider ID:');
  const eudract = tokenAfter(tokens, 'EudraCT Number:');
  const utn = tokenAfter(tokens, 'UTN (Universal Trial Number):');
  const secondaryIds = uniq([
    ...compact([whoId, eudract, utn]),
    ...extractSecondaryIds(tokens.join(' ')),
  ]).filter(s => s.toUpperCase() !== id.toUpperCase());

  const studyType = studyTypeRaw ? (/non-interventional|observ/i.test(studyTypeRaw) ? 'observational' : /interven/i.test(studyTypeRaw) ? 'interventional' : studyTypeRaw.toLowerCase()) : null;
  const countries = toIso2List(countriesRaw ? countriesRaw.split(/\s*[,;]\s*/) : []);
  const startDate = normalizeRegistryDate(actualStart) ?? normalizeRegistryDate(plannedStart);
  // DRKS vocabulary: "Recruiting planned", "Recruiting ongoing", "Recruiting complete, study complete",
  // "Recruiting complete, follow-up continuing", "Recruiting stopped after recruiting started",
  // "Recruiting suspended on temporary hold", "Recruiting withdrawn before recruiting started".
  let status = mapRegistryStatus(statusRaw);
  if (statusRaw) {
    const s = statusRaw.toLowerCase();
    if (/^recruiting ongoing$/.test(s)) status = activeStatusByDate(startDate, now);
    else if (/^recruiting planned$/.test(s)) status = 'not_yet_recruiting';
    else if (/recruiting complete, study complete/.test(s)) status = 'completed';
    else if (/recruiting complete, follow-?up/.test(s)) status = 'active_not_recruiting';
    else if (/recruiting stopped/.test(s)) status = 'terminated';
    else if (/recruiting suspended/.test(s)) status = 'suspended';
    else if (/recruiting withdrawn/.test(s)) status = 'withdrawn';
  }

  // Drug signal: interventional + (phase present or EudraCT number present)
  if (studyType === 'interventional' && (phaseRaw || eudract) && interventions.every(i => i.type === 'unknown')) {
    for (const iv of interventions) iv.type = 'drug';
  }

  return {
    registry: 'drks',
    registry_id: id,
    secondary_ids: secondaryIds,
    title,
    sponsor_name: sponsor,
    sponsor_type: sponsorClass,
    collaborators: [],
    interventions,
    conditions: compact(conditions).slice(0, 20),
    phase_raw: phaseRaw,
    phase: mapRegistryPhase(phaseRaw),
    status_raw: statusRaw,
    status,
    study_type: studyType,
    countries: countries.length > 0 ? countries : ['DE'],
    start_date: startDate,
    primary_completion_date: normalizeRegistryDate(actualEnd) ?? normalizeRegistryDate(plannedEnd),
    first_registered: normalizeRegistryDate(registered),
    last_updated: normalizeRegistryDate(updated),
    source_url: `https://drks.de/search/en/trial/${id}`,
    raw: { format: 'drks_html_tokens', tokens: tokens.slice(0, 400), investigator_initiated: ist },
  };
}

interface DrksCursor {
  nextId: number;
  missStreak: number;
}

function parseCursor(cursor: string | null): DrksCursor {
  if (!cursor) return { nextId: DEFAULT_START, missStreak: 0 };
  try {
    const c = JSON.parse(cursor) as Partial<DrksCursor>;
    return { nextId: Math.max(1, Number(c.nextId) || DEFAULT_START), missStreak: Number(c.missStreak) || 0 };
  } catch {
    const n = Number(String(cursor).replace(/^DRKS/i, ''));
    return { nextId: Number.isFinite(n) && n > 0 ? n : DEFAULT_START, missStreak: 0 };
  }
}

export const drksAdapter: RegistryAdapter<DrksRaw> = {
  registry: 'drks',
  displayName: 'DRKS (Germany)',
  countryScope: ['DE'],
  license: 'DRKS terms of use, attribution required',
  capability: 'api',
  transport: 'html',
  verified: 'partial',
  rateLimitMs: 700,
  defaultLimit: 30,
  estimatedReach: 37_500,
  urls: {
    search: 'https://drks.de/search/en',
    detail: id => `https://drks.de/search/en/trial/${id}`,
  },

  mapRecord(raw: DrksRaw): RegistryRecord {
    return mapDrksHtml(raw);
  },

  /** Cursor: {"nextId":n,"missStreak":k}; same id-walk contract as IRCT. */
  async fetchPage(cursor: string | null, opts: FetchPageOptions): Promise<FetchPageResult> {
    const c = parseCursor(cursor);
    const limit = Math.min(opts.limit ?? this.defaultLimit, 150);
    const records: RegistryRecord[] = [];
    const warnings: string[] = [];
    let n = c.nextId;
    let missStreak = c.missStreak;
    let firstMiss: number | null = null;
    for (let i = 0; i < limit; i++, n++) {
      if (opts.signal?.aborted) break;
      const id = drksId(n);
      try {
        const res = await registryFetch(`${BASE()}/${id}`, { signal: opts.signal, timeoutMs: 25_000, retries: 0 });
        const html = res.ok ? await res.text() : '';
        if (res.ok && /DRKS-ID:/.test(html) && html.includes(id)) {
          missStreak = 0;
          firstMiss = null;
          records.push(mapDrksHtml({ id, html }));
        } else if (res.ok || res.status === 404) {
          missStreak++;
          if (firstMiss === null) firstMiss = n;
        } else {
          warnings.push(`DRKS ${id}: HTTP ${res.status}`);
        }
      } catch (err) {
        warnings.push(`DRKS ${id}: ${err instanceof Error ? err.message : String(err)}`);
      }
      if (missStreak >= MISS_STREAK_STOP) {
        return { records, nextCursor: JSON.stringify({ nextId: firstMiss ?? n, missStreak: 0 } satisfies DrksCursor), done: true, warnings };
      }
      await sleep(this.rateLimitMs);
    }
    return { records, nextCursor: JSON.stringify({ nextId: n, missStreak } satisfies DrksCursor), done: false, warnings };
  },
};

export default drksAdapter;
