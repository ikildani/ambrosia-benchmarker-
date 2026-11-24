/**
 * EU Clinical Trials Register (EU CTR, clinicaltrialsregister.eu) — the public
 * face of EudraCT: every EU/EEA interventional medicinal-product trial
 * authorised 2004–Jan 2023 (adult Phase 1 trials are not public), plus
 * paediatric-plan trials run outside the EEA. Closed to new applications since
 * Jan 2023 (successor: CTIS, ./ctis.ts), so this is a one-time backfill of a
 * static corpus followed by rare status updates.
 *
 * Endpoints (no auth, no published rate limit; plain fetch works, verified Nov 2026):
 *   GET https://www.clinicaltrialsregister.eu/ctr-search/search?query=&page=1
 *       HTML; "44,416 result(s) found" gives the total (20 trials per page).
 *   GET https://www.clinicaltrialsregister.eu/ctr-search/rest/download/full?query=&page=N&mode=current_page
 *       text/plain, every member-state record of the 20 trials on page N in the
 *       EudraCT protocol layout ("A.2 EudraCT number: …", "D.3.2 Product code: …").
 *       ~0.4–1.7 MB and ~12 s per page. Pages past the end are clamped (they repeat
 *       trials), so the walk stops at ceil(total / 20).
 * Field mapping (one "Summary" block per member state; blocks of a trial are merged):
 *   A.2 EudraCT number                      → registry_id (YYYY-NNNNNN-CC)
 *   A.3 Full title of the trial             → title
 *   A.4.1 Sponsor's protocol code number,
 *   A.5.1 ISRCTN, A.5.2 US NCT, A.5.3 WHO UTN → secondary_ids
 *   B.1.1 Name of Sponsor                   → sponsor_name (first sponsor)
 *   B.3.1 and B.3.2 Status of the sponsor   → Commercial → INDUSTRY; non-commercial trials
 *                                             are not emitted (investigator trials of marketed
 *                                             drugs; they add no programs and many rows)
 *   D.IMP n / D.1.2 and D.1.3 IMP Role      → Test → experimental, Comparator → comparator
 *   D.3.2 Product code, D.3.9.2 Current sponsor code, D.3.8 INN, D.3.1 Product name
 *                                           → intervention name "CODE (INN)" so the program
 *                                             groups on both identifiers (migration 187)
 *   D.3.11.* (ATIMP, immunological, …)      → intervention type
 *   E.7.1–E.7.4 Phase I–IV flags            → phase; E.7.1.2 / E.6.8 bioequivalence → not_applicable
 *   E.1.1 Medical condition(s)              → conditions
 *   A.1 Member State Concerned / "Trial protocol" link country → countries
 *   P. End of Trial Status / Summary "Trial Status" → status (most active across states)
 *   Summary "Date on which this record was first entered" → first_registered
 * License   EMA: "information … may be reproduced provided the source is acknowledged"
 *           (https://www.clinicaltrialsregister.eu/disclaimer.html). Attribution: EU Clinical Trials Register.
 * Reach     44,416 trials (Nov 2026); ~40% commercially sponsored. Sampled 160 trials: 67 commercial,
 *           ~1 in 25 trials names a test product no program in the universe carries.
 */

import type { CompanyTrialPhase, CompanyTrialStatus, FetchPageOptions, FetchPageResult, RegistryAdapter, RegistryIntervention, RegistryRecord } from './types';
import { RegistryUnavailableError } from './types';
import {
  classifySponsorClass,
  compact,
  extractSecondaryIds,
  makeIntervention,
  mapRegistryStatus,
  normalizeRegistryDate,
  registryFetch,
  toIso2,
  truncate,
  uniq,
} from './shared';

export const EUCTR_BASE = 'https://www.clinicaltrialsregister.eu';
export const EUCTR_PAGE_SIZE = 20;
const USER_AGENT = 'SolidusResearch/1.0 (+https://solidus.ambrosiaventures.co)';

// ─── Text parsing ────────────────────────────────────────────────────────────

export interface EuctrImp {
  role: 'experimental' | 'comparator' | 'unknown';
  productName: string | null;
  productCode: string | null;
  sponsorCode: string | null;
  inn: string | null;
  authorised: boolean | null;
  type: string;
}

export interface EuctrTrial {
  eudractNumber: string;
  title: string | null;
  sponsorName: string | null;
  sponsorCommercial: boolean | null;
  sponsorCountry: string | null;
  protocolCode: string | null;
  secondaryIds: string[];
  imps: EuctrImp[];
  conditions: string[];
  phaseFlags: Set<1 | 2 | 3 | 4>;
  bioequivalence: boolean;
  statuses: string[];
  countries: string[];
  firstEntered: string | null;
  endDate: string | null;
  link: string | null;
}

/** Value of `LABEL: value` on its own line; the English line only (translations carry "(xx)" before the colon). */
export function fieldValue(block: string, label: string): string | null {
  const esc = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`^${esc}[ \\t]*:[ \\t]*(.*)$`, 'm').exec(block);
  if (!m) return null;
  const v = m[1].trim();
  return v && !/^(n\/?a|na|not available|none|-|\.)$/i.test(v) ? v : null;
}

function allFieldValues(block: string, label: string): string[] {
  const esc = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`^${esc}[ \\t]*:[ \\t]*(.*)$`, 'gm');
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null) {
    const v = m[1].trim();
    if (v && !/^(n\/?a|na|not available|none|-|\.)$/i.test(v)) out.push(v);
  }
  return out;
}

const yes = (v: string | null) => !!v && /^yes\b/i.test(v);

/** "UK - MHRA" / "Germany - BfArM" / "Spain - AEMPS" → ISO-2. */
export function memberStateIso(raw: string | null): string | null {
  if (!raw) return null;
  const head = raw.split(/\s+-\s+/)[0].trim();
  if (/^uk$/i.test(head)) return 'GB';
  return toIso2(head);
}

function impType(section: string): string {
  if (yes(fieldValue(section, 'D.3.11.3 Advanced Therapy IMP (ATIMP)'))) {
    if (yes(fieldValue(section, 'D.3.11.3.2 Gene therapy medical product'))) return 'genetic';
    return 'biological';
  }
  if (yes(fieldValue(section, 'D.3.11.6 Immunological medicinal product (such as vaccine, allergen, immune serum)'))) return 'biological';
  if (yes(fieldValue(section, 'D.3.11.2 Active substance of biological/ biotechnological origin (other than Advanced Therapy IMP (ATIMP)'))) return 'biological';
  if (yes(fieldValue(section, 'D.3.11.9 Recombinant medicinal product'))) return 'biological';
  return 'drug';
}

function parseImps(block: string): EuctrImp[] {
  const parts = block.split(/^D\.IMP:\s*\d+\s*$/m).slice(1);
  const out: EuctrImp[] = [];
  for (const raw of parts) {
    // An IMP section ends where the placebo section or part E begins.
    const section = raw.split(/^(?:D\.8 Information on Placebo|E\. General Information)/m)[0];
    const roleRaw = fieldValue(section, 'D.1.2 and D.1.3 IMP Role') ?? '';
    const ma = fieldValue(section, 'D.2.1 IMP to be used in the trial has a marketing authorisation');
    out.push({
      role: /^test/i.test(roleRaw) ? 'experimental' : /^comparator/i.test(roleRaw) ? 'comparator' : 'unknown',
      productName: fieldValue(section, 'D.3.1 Product name'),
      productCode: fieldValue(section, 'D.3.2 Product code'),
      sponsorCode: fieldValue(section, 'D.3.9.2 Current sponsor code'),
      inn: fieldValue(section, 'D.3.8 INN - Proposed INN'),
      authorised: ma ? yes(ma) : null,
      type: impType(section),
    });
  }
  return out;
}

/** Split a full-download text file into trials, merging the member-state records of each. */
export function parseEuctrFullText(text: string): EuctrTrial[] {
  const byId = new Map<string, EuctrTrial>();
  const blocks = text.replace(/\r\n?/g, '\n').split(/^Summary\s*$/m).slice(1);
  for (const block of blocks) {
    const id = fieldValue(block, 'EudraCT Number') ?? fieldValue(block, 'A.2 EudraCT number');
    if (!id || !/^\d{4}-\d{6}-\d{2}$/.test(id)) continue;
    let t = byId.get(id);
    if (!t) {
      t = {
        eudractNumber: id, title: null, sponsorName: null, sponsorCommercial: null, sponsorCountry: null, protocolCode: null,
        secondaryIds: [], imps: [], conditions: [], phaseFlags: new Set(), bioequivalence: false, statuses: [], countries: [],
        firstEntered: null, endDate: null, link: null,
      };
      byId.set(id, t);
    }
    t.title ??= fieldValue(block, 'A.3 Full title of the trial');
    t.sponsorName ??= fieldValue(block, 'B.1.1 Name of Sponsor');
    const status = fieldValue(block, 'B.3.1 and B.3.2\tStatus of the sponsor') ?? fieldValue(block, 'B.3.1 and B.3.2 Status of the sponsor');
    if (status) t.sponsorCommercial = t.sponsorCommercial === true || /^commercial/i.test(status);
    t.sponsorCountry ??= fieldValue(block, 'B.1.3.4\tCountry') ?? fieldValue(block, 'B.1.3.4 Country');
    t.protocolCode ??= fieldValue(block, 'A.4.1 Sponsor\'s protocol code number');
    t.secondaryIds.push(...compact([
      fieldValue(block, 'A.5.1 ISRCTN (International Standard Randomised Controlled Trial) number'),
      fieldValue(block, 'A.5.2 US NCT (ClinicalTrials.gov registry) number'),
      fieldValue(block, 'A.5.3 WHO Universal Trial Reference Number (UTRN)'),
    ]).flatMap(v => extractSecondaryIds(v)));
    for (const imp of parseImps(block)) {
      const key = `${imp.role}|${imp.productCode ?? ''}|${imp.sponsorCode ?? ''}|${imp.inn ?? ''}|${imp.productName ?? ''}`.toLowerCase();
      if (!t.imps.some(i => `${i.role}|${i.productCode ?? ''}|${i.sponsorCode ?? ''}|${i.inn ?? ''}|${i.productName ?? ''}`.toLowerCase() === key)) t.imps.push(imp);
    }
    const cond = fieldValue(block, 'E.1.1 Medical condition(s) being investigated');
    if (cond && !t.conditions.includes(cond)) t.conditions.push(cond);
    if (yes(fieldValue(block, 'E.7.1 Human pharmacology (Phase I)'))) t.phaseFlags.add(1);
    if (yes(fieldValue(block, 'E.7.2 Therapeutic exploratory (Phase II)'))) t.phaseFlags.add(2);
    if (yes(fieldValue(block, 'E.7.3 Therapeutic confirmatory (Phase III)'))) t.phaseFlags.add(3);
    if (yes(fieldValue(block, 'E.7.4 Therapeutic use (Phase IV)'))) t.phaseFlags.add(4);
    if (yes(fieldValue(block, 'E.7.1.2 Bioequivalence study')) || yes(fieldValue(block, 'E.6.8 Bioequivalence'))) t.bioequivalence = true;
    t.statuses.push(...compact([fieldValue(block, 'Trial Status'), fieldValue(block, 'P. End of Trial Status')]));
    const iso = memberStateIso(fieldValue(block, 'A.1 Member State Concerned'));
    if (iso && !t.countries.includes(iso)) t.countries.push(iso);
    const entered = normalizeRegistryDate(fieldValue(block, 'Date on which this record was first entered in the EudraCT database'));
    if (entered && (!t.firstEntered || entered < t.firstEntered)) t.firstEntered = entered;
    const end = normalizeRegistryDate(fieldValue(block, 'P. Date of the global end of the trial'));
    if (end) t.endDate = end;
    t.link ??= fieldValue(block, 'Link');
    for (const v of allFieldValues(block, 'A.5.4 Other Identifiers')) t.secondaryIds.push(...extractSecondaryIds(v));
  }
  for (const t of byId.values()) t.secondaryIds = uniq(t.secondaryIds.filter(s => s !== t.eudractNumber));
  return [...byId.values()];
}

// ─── Mapping ─────────────────────────────────────────────────────────────────

export function phaseFromFlags(flags: Set<number>, bioequivalence: boolean): CompanyTrialPhase {
  if (bioequivalence) return 'not_applicable';
  if (flags.has(1) && flags.has(2)) return 'phase_1_2';
  if (flags.has(2) && flags.has(3)) return 'phase_2_3';
  if (flags.has(3)) return 'phase_3';
  if (flags.has(2)) return 'phase_2';
  if (flags.has(1)) return 'phase_1';
  if (flags.has(4)) return 'phase_4';
  return 'unknown';
}

const STATUS_RANK: CompanyTrialStatus[] = ['recruiting', 'active_not_recruiting', 'suspended', 'not_yet_recruiting', 'completed', 'terminated', 'withdrawn', 'unknown'];

/** Most active status across member states ("Ongoing" in one state outranks "Completed" in another). */
export function mergedStatus(raw: string[]): CompanyTrialStatus {
  const mapped = raw.map(s => (/^ongoing|restarted/i.test(s) ? 'recruiting' : /no longer in eu|transitioned/i.test(s) ? 'unknown' : mapRegistryStatus(s)));
  for (const s of STATUS_RANK) if (mapped.includes(s)) return s;
  return 'unknown';
}

/** Hospital / university words in EU languages the shared academic patterns do not cover. */
const NON_COMMERCIAL_NAME_RE = /\b(szpital|uniwersytet|ospedale|ospedaliera|azienda (ospedaliera|sanitaria)|universit|krankenhaus|universitätsklinik|ziekenhuis|sjukhus|sygehus|hospitalet|nemocnice|fakultní|kórház|egyetem|spital|ccmu|helsingin yliopisto|irccs|chu de|centre hospitalier|assistance publique|policlinico|fondazione|stichting|vzw)\b/i;

const DEV_CODE_RE = /\b[A-Z]{1,6}[- ]?\d{2,7}[A-Z]?\b/;
const PLACEHOLDER_RE = /^(n\/?a|na|not (applicable|available|yet assigned)|none|unknown|tbd|tba|-+|\.|0)$/i;

function clean(s: string | null): string | null {
  if (!s) return null;
  const t = s.replace(/[\[\]]/g, '').replace(/\s+/g, ' ').trim();
  return t && !PLACEHOLDER_RE.test(t.replace(/\./g, '')) ? t : null;
}

/** Development code of a product, if it carries one. */
function impCode(imp: EuctrImp): string | null {
  return [clean(imp.productCode), clean(imp.sponsorCode)].find(c => !!c && DEV_CODE_RE.test(c.toUpperCase()) && c.length <= 40) ?? null;
}

/**
 * Sponsor as a company name: drops the address or legal boilerplate some sponsors typed into
 * the name field ("Pfizer Inc., 235 East 42nd Street, …", "Merck Sharp & Dohme Corp., a
 * subsidiary of Merck & Co., Inc. (hereafter referred to as").
 */
export function cleanSponsorName(raw: string | null): string | null {
  if (!raw) return null;
  let s = raw.replace(/\s+/g, ' ').trim();
  s = s.replace(/\s*\((hereafter|hereinafter)[^)]*\)?.*$/i, '');
  s = s.replace(/,\s*(a|an)\s+(wholly[- ]owned\s+)?subsidiary of\b.*$/i, '');
  s = s.replace(/,\s*\d.*$/, '');
  s = s.replace(/[,;\s]+$/, '').trim();
  return s.length >= 2 ? s.slice(0, 200) : null;
}

/** "CODE (INN)" for a development product, the INN for an authorised one, else the product name. */
export function impLabel(imp: EuctrImp): string | null {
  const code = impCode(imp);
  const inn = clean(imp.inn);
  const name = clean(imp.productName);
  // An INN is a word or three; longer text in the field is a description ("Fc- and CDR-modified humanised …").
  const innOk = inn && inn.length <= 60 && inn.split(' ').length <= 3 && !/\d+\s*(mg|µg|ug|ml|%)/i.test(inn) ? inn : null;
  if (code && innOk && innOk.toUpperCase() !== code.toUpperCase()) return `${code} (${innOk})`;
  if (code) return code;
  if (innOk) return innOk;
  return name && name.length <= 120 ? name : null;
}

function interventionsOf(t: EuctrTrial): RegistryIntervention[] {
  const out: RegistryIntervention[] = [];
  const seen = new Map<string, number>();
  // Test products first so primaryIntervention() picks the sponsor's product.
  const ordered = [...t.imps.filter(i => i.role === 'experimental' && i.authorised === false), ...t.imps.filter(i => i.role === 'experimental' && i.authorised !== false), ...t.imps.filter(i => i.role !== 'experimental')];
  for (const imp of ordered) {
    const label = impLabel(imp);
    if (!label || /placebo/i.test(label)) continue;
    // One intervention per product: strengths and formulations of one code collapse onto it.
    const code = impCode(imp);
    const key = (code ? code.replace(/[^a-z0-9]/gi, '').replace(/^([a-z]+\d+).*$/i, '$1') : label).toLowerCase();
    const at = seen.get(key);
    if (at !== undefined) {
      // Same product listed twice: keep the spelling that also names the INN.
      if (!out[at].name.includes(' (') && label.includes(' (') && out[at].role === (imp.role === 'experimental' ? 'experimental' : out[at].role)) out[at] = { ...out[at], name: label.slice(0, 200) };
      continue;
    }
    const iv = makeIntervention(label, imp.type, imp.role === 'experimental' ? 'experimental' : imp.role === 'comparator' ? 'comparator' : 'unknown');
    if (iv) { seen.set(key, out.length); out.push(iv); }
  }
  return out;
}

export function euctrDetailUrl(id: string, country?: string | null): string {
  return `${EUCTR_BASE}/ctr-search/trial/${id}/${country ? `${country === 'GB' ? 'GB' : country}/` : ''}`;
}

/** RegistryRecord for a commercially sponsored trial, or null (non-commercial / no sponsor / no product). */
export function mapEuctrTrial(t: EuctrTrial): RegistryRecord | null {
  const sponsor = cleanSponsorName(t.sponsorName);
  if (!sponsor) return null;
  const cls = classifySponsorClass(sponsor, t.sponsorCommercial ? 'Commercial' : t.sponsorCommercial === false ? 'Non-commercial' : null);
  if (t.sponsorCommercial !== true && cls !== 'INDUSTRY' && cls !== 'CRO') return null;
  // Hospitals and universities sometimes tick "Commercial"; the name decides.
  const byName = classifySponsorClass(sponsor);
  if (byName === 'OTHER' || byName === 'OTHER_GOV' || NON_COMMERCIAL_NAME_RE.test(sponsor)) return null;
  const interventions = interventionsOf(t);
  if (interventions.length === 0) return null;
  const phase = phaseFromFlags(t.phaseFlags, t.bioequivalence);
  return {
    registry: 'euctr',
    registry_id: t.eudractNumber,
    secondary_ids: uniq([...t.secondaryIds, ...compact([t.protocolCode])]),
    title: truncate(t.title, 1000),
    sponsor_name: sponsor,
    sponsor_type: cls === 'CRO' ? 'CRO' : 'INDUSTRY',
    collaborators: [],
    interventions,
    conditions: t.conditions.slice(0, 5).map(c => c.slice(0, 300)),
    phase_raw: [...t.phaseFlags].sort().map(n => `Phase ${n}`).join('/') + (t.bioequivalence ? ' (bioequivalence)' : ''),
    phase,
    status_raw: uniq(t.statuses).join('; ').slice(0, 200) || null,
    status: mergedStatus(t.statuses),
    study_type: 'interventional',
    countries: t.countries,
    start_date: null,
    primary_completion_date: t.endDate,
    first_registered: t.firstEntered,
    last_updated: t.endDate ?? t.firstEntered,
    source_url: euctrDetailUrl(t.eudractNumber),
    raw: {
      format: 'euctr_full_text',
      sponsor_country: t.sponsorCountry,
      protocol_code: t.protocolCode,
      imps: t.imps.slice(0, 30),
      phase_flags: [...t.phaseFlags],
      bioequivalence: t.bioequivalence,
    },
  };
}

// ─── Fetching ────────────────────────────────────────────────────────────────

export interface EuctrCursor {
  page: number;
  total: number;
}

export function parseEuctrCursor(cursor: string | null): EuctrCursor | null {
  if (!cursor) return null;
  try {
    const c = JSON.parse(cursor) as Partial<EuctrCursor>;
    if (typeof c.page === 'number' && c.page >= 1 && typeof c.total === 'number' && c.total > 0) return { page: Math.floor(c.page), total: Math.floor(c.total) };
  } catch {
    /* fall through */
  }
  return null;
}

export function parseEuctrTotal(html: string): number | null {
  const m = /([\d,.]+)\s+result\(s\)\s+found/i.exec(html);
  if (!m) return null;
  const n = Number(m[1].replace(/[,.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function getText(url: string, timeoutMs: number, signal?: AbortSignal): Promise<string> {
  const res = await registryFetch(url, { timeoutMs, retries: 1, signal, headers: { 'User-Agent': USER_AGENT, Accept: 'text/plain,text/html;q=0.9,*/*;q=0.5' } });
  if (!res.ok) throw new RegistryUnavailableError('euctr', `HTTP ${res.status} for ${url.replace(EUCTR_BASE, '')}`);
  return res.text();
}

export const euctrAdapter: RegistryAdapter<EuctrTrial> = {
  registry: 'euctr',
  displayName: 'EU Clinical Trials Register (EudraCT)',
  countryScope: ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IS', 'IE', 'IT', 'LV', 'LI', 'LT', 'LU', 'MT', 'NL', 'NO', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'GB'],
  license: 'EMA public register; reproduction permitted with acknowledgement (EU Clinical Trials Register)',
  capability: 'bulk',
  transport: 'html',
  verified: 'verified',
  rateLimitMs: 1000,
  defaultLimit: EUCTR_PAGE_SIZE,
  estimatedReach: 44_416,
  urls: {
    search: `${EUCTR_BASE}/ctr-search/search`,
    detail: id => euctrDetailUrl(id),
  },

  mapRecord(raw: EuctrTrial): RegistryRecord {
    const r = mapEuctrTrial(raw);
    if (!r) throw new Error(`EU CTR ${raw.eudractNumber}: not a commercially sponsored product trial`);
    return r;
  },

  /**
   * Cursor {page, total}: the next 20-trial page of the unfiltered result list and the
   * result count read when the walk started. One page per call (~12 s); the walk is
   * done after page ceil(total / 20) and restarts from page 1 on the next sweep.
   */
  async fetchPage(cursor: string | null, opts: FetchPageOptions): Promise<FetchPageResult> {
    let c = parseEuctrCursor(cursor);
    if (!c) {
      const total = parseEuctrTotal(await getText(`${EUCTR_BASE}/ctr-search/search?query=&page=1`, 30_000, opts.signal));
      if (!total) throw new RegistryUnavailableError('euctr', 'result count not found on the search page');
      c = { page: 1, total };
    }
    const lastPage = Math.ceil(c.total / EUCTR_PAGE_SIZE);
    if (c.page > lastPage) return { records: [], nextCursor: null, done: true };
    const text = await getText(`${EUCTR_BASE}/ctr-search/rest/download/full?query=&page=${c.page}&mode=current_page`, 60_000, opts.signal);
    const trials = parseEuctrFullText(text);
    const warnings: string[] = [];
    if (trials.length === 0) warnings.push(`EU CTR page ${c.page}: no trials parsed (${text.length} bytes)`);
    const records: RegistryRecord[] = [];
    for (const t of trials) {
      const r = mapEuctrTrial(t);
      if (r) records.push(r);
    }
    const next = c.page + 1;
    return next > lastPage
      ? { records, nextCursor: null, done: true, warnings }
      : { records, nextCursor: JSON.stringify({ page: next, total: c.total }), done: false, warnings };
  },
};
