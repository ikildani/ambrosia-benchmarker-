/**
 * Pure helpers shared by the registry adapters: a small regex XML extractor
 * (no xml2js), an HTML label/value tokenizer for server-rendered registries,
 * date / phase / status / country normalization into the company_trials
 * vocabularies, sponsor classification, and the WHO ICTRP XML mapper used by
 * registries that expose the ICTRP export format (IRCT, ReBEC).
 *
 * Nothing in this file touches the network or the database, so every
 * function is unit-testable with hand-written fixtures.
 */

import { fetchWithTimeout } from '@/lib/fetch-with-timeout';
import type {
  CompanyTrialPhase,
  CompanyTrialStatus,
  InterventionRole,
  RegistryId,
  RegistryIntervention,
  RegistryRecord,
  SponsorClass,
} from './types';

// ─── Generic utilities ───────────────────────────────────────────────────────

export const REGISTRY_USER_AGENT =
  'Mozilla/5.0 (compatible; AmbrosiaAssetRadar/1.0; +https://solidus.ambrosiaventures.co)';

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function uniq<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

export function compact(items: Array<string | null | undefined>): string[] {
  return uniq(items.map(s => (s ?? '').trim()).filter(Boolean));
}

export function truncate(s: string | null | undefined, max: number): string | null {
  if (!s) return null;
  const t = s.trim();
  if (!t) return null;
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/** Split a registry list field on the usual separators. */
export function splitList(s: string | null | undefined): string[] {
  if (!s) return [];
  return compact(s.split(/\s*(?:[,;|\n]|\band\b(?![a-z]))\s*/i));
}

/** fetch with timeout, retry on 429/5xx, and a stable User-Agent. */
export async function registryFetch(
  url: string,
  init: RequestInit & { timeoutMs?: number; retries?: number } = {},
): Promise<Response> {
  const { timeoutMs = 20_000, retries = 1, headers, ...rest } = init;
  return fetchWithTimeout(url, {
    timeoutMs,
    retries,
    headers: { 'User-Agent': REGISTRY_USER_AGENT, Accept: '*/*', ...(headers ?? {}) },
    ...rest,
  });
}

// ─── XML / HTML extraction ───────────────────────────────────────────────────

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—',
  hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', eacute: 'é', uuml: 'ü',
  ouml: 'ö', auml: 'ä', szlig: 'ß', ccedil: 'ç', atilde: 'ã', aacute: 'á', iacute: 'í',
  oacute: 'ó', uacute: 'ú', ntilde: 'ñ', copy: '©', reg: '®', trade: '™', deg: '°', micro: 'µ',
};

export function decodeEntities(s: string): string {
  if (!s || s.indexOf('&') === -1) return s;
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => safeFromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => safeFromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-z]+);/gi, (m, name) => NAMED_ENTITIES[name.toLowerCase()] ?? m);
}

function safeFromCodePoint(cp: number): string {
  try {
    return String.fromCodePoint(cp);
  } catch {
    return '';
  }
}

export function stripTags(s: string): string {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, ' ');
}

function cleanText(s: string): string {
  return decodeEntities(stripTags(s)).replace(/\s+/g, ' ').trim();
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Inner content of every `<tag ...>...</tag>` (non-nested; self-closing tags are skipped). */
export function xmlBlocks(xml: string, tag: string): string[] {
  if (!xml) return [];
  const re = new RegExp(`<${escapeRegExp(tag)}(?:\\s[^>]*)?>([\\s\\S]*?)</${escapeRegExp(tag)}>`, 'g');
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) out.push(m[1]);
  return out;
}

/** Every `<tag ...>...</tag>` element including its opening tag (for attribute reads on repeated elements). */
export function xmlElements(xml: string, tag: string): string[] {
  if (!xml) return [];
  const re = new RegExp(`<${escapeRegExp(tag)}(?:\\s[^>]*)?>[\\s\\S]*?</${escapeRegExp(tag)}>`, 'g');
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) out.push(m[0]);
  return out;
}

/** Text of the first `<tag>` (tags stripped, entities decoded, whitespace collapsed). */
export function xmlFirst(xml: string, tag: string): string | null {
  const blocks = xmlBlocks(xml, tag);
  if (blocks.length === 0) return null;
  const text = cleanText(blocks[0]);
  return text || null;
}

/** Text of every `<tag>` occurrence. */
export function xmlAll(xml: string, tag: string): string[] {
  return compact(xmlBlocks(xml, tag).map(cleanText));
}

/** Attribute value on the first `<tag ...>` opening tag. */
export function xmlAttr(xml: string, tag: string, attr: string): string | null {
  const re = new RegExp(`<${escapeRegExp(tag)}\\s[^>]*?\\b${escapeRegExp(attr)}="([^"]*)"`);
  const m = re.exec(xml);
  return m ? decodeEntities(m[1]) : null;
}

/** Attribute value from an opening tag string or a block that starts with one. */
export function attrOf(tagOrBlock: string, attr: string): string | null {
  const re = new RegExp(`\\b${escapeRegExp(attr)}="([^"]*)"`);
  const m = re.exec(tagOrBlock);
  return m ? decodeEntities(m[1]) : null;
}

/** Text of the first `<h1>`, `<title>` etc. in an HTML document. */
export function htmlFirst(html: string, tag: string): string | null {
  return xmlFirst(html, tag);
}

/**
 * Turn a server-rendered registry page into a flat list of text tokens
 * (one per element boundary). Registries such as DRKS, jRCT and CRIS render
 * "Label | Value" tables, so `tokenAfter(tokens, 'Label')` reads a field.
 */
export function htmlToTokens(html: string): string[] {
  if (!html) return [];
  const withoutScripts = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ');
  const separated = withoutScripts.replace(/<br\s*\/?>/gi, '\u0001').replace(/<[^>]+>/g, '\u0001');
  return decodeEntities(separated)
    .split('\u0001')
    .map(t => t.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function labelMatches(token: string, label: string | RegExp): boolean {
  if (label instanceof RegExp) return label.test(token);
  const t = token.replace(/[:：]\s*$/, '').trim().toLowerCase();
  const l = label.replace(/[:：]\s*$/, '').trim().toLowerCase();
  return t === l;
}

export function tokenIndex(tokens: string[], label: string | RegExp, from = 0): number {
  for (let i = Math.max(0, from); i < tokens.length; i++) {
    if (labelMatches(tokens[i], label)) return i;
  }
  return -1;
}

/**
 * Value token following a label token. Skips tokens that are themselves
 * labels-with-colon or that match `opts.skip`. Returns null when the label is
 * missing or the next token is another label (empty field).
 */
export function tokenAfter(
  tokens: string[],
  label: string | RegExp,
  opts: { from?: number; skip?: RegExp; allowLabelValue?: boolean } = {},
): string | null {
  const i = tokenIndex(tokens, label, opts.from ?? 0);
  if (i === -1) return null;
  for (let j = i + 1; j < Math.min(tokens.length, i + 6); j++) {
    const t = tokens[j];
    if (opts.skip && opts.skip.test(t)) continue;
    if (!opts.allowLabelValue && /[:：]$/.test(t) && t.length < 60) return null;
    if (/^(no entry|not specified|n\/a|-|—|none)$/i.test(t)) return null;
    return t;
  }
  return null;
}

// ─── Dates ───────────────────────────────────────────────────────────────────

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5,
  jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9,
  oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

function pad2(n: string | number): string {
  return String(n).padStart(2, '0');
}

function ymd(y: string | number, m: string | number, d: string | number): string | null {
  const yy = Number(y);
  const mm = Number(m);
  const dd = Number(d);
  if (!(yy >= 1900 && yy <= 2100) || !(mm >= 1 && mm <= 12) || !(dd >= 1 && dd <= 31)) return null;
  return `${yy}-${pad2(mm)}-${pad2(dd)}`;
}

/**
 * Normalize the date formats seen across registries to YYYY-MM-DD:
 * ISO (with or without time), YYYY/MM/DD (CRIS), DD/MM/YYYY (CTIS, ReBEC),
 * DD.MM.YYYY (DRKS German), "Aug. 06, 2019" / "April. 27, 2024" (jRCT),
 * YYYY-MM, YYYY, and dates embedded in text ("2023-06-16 실제등록(Actual)").
 * Day/month order for slashed dates follows the registry convention
 * (day first) — pass `monthFirst` for US-style sources.
 */
export function normalizeRegistryDate(
  raw: string | number | null | undefined,
  opts: { monthFirst?: boolean } = {},
): string | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (!s) return null;
  let m: RegExpExecArray | null;
  if ((m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s))) return ymd(m[1], m[2], m[3]);
  if ((m = /^(\d{4})\/(\d{1,2})\/(\d{1,2})/.exec(s))) return ymd(m[1], m[2], m[3]);
  if ((m = /^(\d{4})\.(\d{1,2})\.(\d{1,2})/.exec(s))) return ymd(m[1], m[2], m[3]);
  if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s))) {
    return opts.monthFirst ? ymd(m[3], m[1], m[2]) : ymd(m[3], m[2], m[1]);
  }
  if ((m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(s))) return ymd(m[3], m[2], m[1]);
  if ((m = /^([a-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})/i.exec(s))) {
    const mo = MONTHS[m[1].toLowerCase()];
    return mo ? ymd(m[3], mo, m[2]) : null;
  }
  if ((m = /^(\d{1,2})\s+([a-z]+)\.?\s+(\d{4})/i.exec(s))) {
    const mo = MONTHS[m[2].toLowerCase()];
    return mo ? ymd(m[3], mo, m[1]) : null;
  }
  if ((m = /^(\d{4})-(\d{2})$/.exec(s))) return ymd(m[1], m[2], 1);
  if ((m = /^(\d{4})$/.exec(s))) return ymd(m[1], 1, 1);
  if ((m = /(\d{4})-(\d{2})-(\d{2})/.exec(s))) return ymd(m[1], m[2], m[3]);
  if ((m = /(\d{4})\/(\d{2})\/(\d{2})/.exec(s))) return ymd(m[1], m[2], m[3]);
  return null;
}

// ─── Phase ───────────────────────────────────────────────────────────────────

const ROMAN: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4 };

/**
 * Map any registry phase spelling to the company_trials.phase CHECK list.
 * Handles "Phase I/II", "1/2a", "Phase 2/Phase 3", "Therapeutic exploratory
 * (Phase II)", "Human Pharmacology (Phase I)- Bioequivalence Study",
 * "제2상" / "2상" (Korean), "Phase 0", "N/A", numeric 1..4.
 * Phase 1/2 wins over 1 or 2 alone; 2/3 wins over 2 or 3.
 */
export function mapRegistryPhase(raw: string | number | null | undefined): CompanyTrialPhase {
  if (raw === null || raw === undefined) return 'unknown';
  const s = String(raw).toLowerCase().replace(/\s+/g, ' ').trim();
  if (!s) return 'unknown';
  if (/^(n\/?a|na|not applicable|none|-|—|\.|null|unknown|not specified)$/.test(s)) return 'not_applicable';
  if (/not applicable/.test(s)) return 'not_applicable';
  if (/early phase ?1|phase ?0\b|\bphase ?zero|exploratory ind|^0상|제0상|^0$/.test(s)) return 'early_phase_1';

  const found = new Set<number>();
  const norm = s
    .replace(/phases?/g, ' ')
    .replace(/제/g, ' ')
    .replace(/상/g, ' ')
    .replace(/\bfase\b/g, ' ')
    .replace(/\b(bioequivalence|bioavailability|pilot|pivotal|integrated|other)\b/g, ' ');
  const tokens = norm.split(/[^a-z0-9]+/).filter(Boolean);
  for (const t of tokens) {
    const m = /^(iv|iii|ii|i|[1-4])([ab]?)$/.exec(t);
    if (!m) continue;
    const n = ROMAN[m[1]] ?? Number(m[1]);
    if (n >= 1 && n <= 4) found.add(n);
  }
  if (found.size === 0) {
    if (/\bpivotal\b|\bconfirmatory\b/.test(s)) return 'phase_3';
    if (/\bexploratory\b/.test(s)) return 'phase_2';
    if (/\bfirst.in.human\b|\bfih\b|\bhuman pharmacology\b|\bbioequivalence\b|\bhealthy volunteers?\b/.test(s)) return 'phase_1';
    return 'unknown';
  }
  if (found.has(1) && found.has(2)) return 'phase_1_2';
  if (found.has(2) && found.has(3)) return 'phase_2_3';
  if (found.has(4)) return 'phase_4';
  if (found.has(3)) return 'phase_3';
  if (found.has(2)) return 'phase_2';
  return 'phase_1';
}

// ─── Status ──────────────────────────────────────────────────────────────────

const STATUS_RULES: Array<[RegExp, CompanyTrialStatus]> = [
  // Hard terminal states first so "not authorised" never becomes "authorised".
  [/withdrawn|not authori[sz]ed|cancel+ed|revoked|철회|retirado|zurückgezogen/, 'withdrawn'],
  [/terminated|stopped|prematurely (ended|closed)|discontinued|abandoned|interrompido|abgebrochen|중지|조기 ?종료|early termination/, 'terminated'],
  [/suspended|temporarily halted|halted|on hold|paused|suspenso|ausgesetzt|일시 ?중단/, 'suspended'],
  [/enrolling by invitation|by invitation/, 'enrolling_by_invitation'],
  // Recruitment finished but the study continues. Must precede the completed rule; the lookahead
  // keeps "Recruiting complete, study complete" (DRKS) in the completed bucket.
  [/active,? not recruiting|no longer recruiting|closed to (recruitment|accrual|enrol+ment)|recruit(ing|ment) (complete|closed|finished)(?![\s\S]*study complete)|follow-?up|recrutamento (conclu[ií]do|encerrado)|모집 ?완료|rekrutierung beendet/, 'active_not_recruiting'],
  [/study complete|completed|\bcomplete\b|finished|concluded|conclu[ií]do|abgeschlossen|ended|\bclosed\b|closed to follow-?up|종료|완료/, 'completed'],
  [/not yet recruiting|not recruiting yet|recruitment not (yet )?started|not (yet )?started|pending|planned|planning|under evaluation|ainda n[aã]o (est[aá] )?recrutando|noch nicht|모집 ?전|모집 ?예정|preparing/, 'not_yet_recruiting'],
  [/recruiting|recruitment ongoing|recruitment in progress|enrolling|recrutando|rekrutier|모집 ?중|\bopen\b|ongoing|in progress|authori[sz]ed|approved|running|em andamento|進行中|募集中/, 'recruiting'],
];

/** Map any registry status spelling to the company_trials.status CHECK list. */
export function mapRegistryStatus(raw: string | null | undefined): CompanyTrialStatus {
  if (!raw) return 'unknown';
  const s = String(raw).toLowerCase().replace(/\s+/g, ' ').trim();
  if (!s) return 'unknown';
  for (const [re, status] of STATUS_RULES) {
    if (re.test(s)) return status;
  }
  return 'unknown';
}

/**
 * For registries that only say "authorised" / "ongoing" / "approved":
 * recruiting once the (estimated) start date has passed, otherwise
 * not_yet_recruiting; unknown when no date is available.
 */
export function activeStatusByDate(startDate: string | null, today = new Date()): CompanyTrialStatus {
  if (!startDate) return 'recruiting';
  const start = new Date(`${startDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime())) return 'recruiting';
  return start.getTime() <= today.getTime() ? 'recruiting' : 'not_yet_recruiting';
}

// ─── Countries ───────────────────────────────────────────────────────────────

const COUNTRY_TO_ISO2: Record<string, string> = {
  'united states': 'US', usa: 'US', 'united states of america': 'US', 'u.s.a.': 'US',
  canada: 'CA', mexico: 'MX', brazil: 'BR', brasil: 'BR', argentina: 'AR', chile: 'CL', colombia: 'CO', peru: 'PE', cuba: 'CU',
  'united kingdom': 'GB', uk: 'GB', 'great britain': 'GB', england: 'GB', scotland: 'GB', wales: 'GB', 'northern ireland': 'GB',
  ireland: 'IE', france: 'FR', germany: 'DE', deutschland: 'DE', switzerland: 'CH', austria: 'AT', belgium: 'BE',
  netherlands: 'NL', 'the netherlands': 'NL', luxembourg: 'LU', denmark: 'DK', sweden: 'SE', norway: 'NO', finland: 'FI',
  iceland: 'IS', spain: 'ES', portugal: 'PT', italy: 'IT', greece: 'GR', cyprus: 'CY', malta: 'MT', poland: 'PL',
  'czech republic': 'CZ', czechia: 'CZ', slovakia: 'SK', hungary: 'HU', romania: 'RO', bulgaria: 'BG', croatia: 'HR',
  slovenia: 'SI', serbia: 'RS', estonia: 'EE', latvia: 'LV', lithuania: 'LT', ukraine: 'UA', russia: 'RU',
  'russian federation': 'RU', turkey: 'TR', türkiye: 'TR', israel: 'IL', iran: 'IR', 'iran, islamic republic of': 'IR',
  'saudi arabia': 'SA', 'united arab emirates': 'AE', qatar: 'QA', kuwait: 'KW', jordan: 'JO', egypt: 'EG',
  'south africa': 'ZA', nigeria: 'NG', kenya: 'KE', morocco: 'MA', tunisia: 'TN', ghana: 'GH', uganda: 'UG',
  tanzania: 'TZ', ethiopia: 'ET', china: 'CN', "people's republic of china": 'CN', 'hong kong': 'HK', macau: 'MO',
  taiwan: 'TW', japan: 'JP', 'south korea': 'KR', korea: 'KR', 'republic of korea': 'KR', 'korea, republic of': 'KR',
  india: 'IN', pakistan: 'PK', bangladesh: 'BD', singapore: 'SG', malaysia: 'MY', thailand: 'TH', vietnam: 'VN',
  'viet nam': 'VN', indonesia: 'ID', philippines: 'PH', australia: 'AU', 'new zealand': 'NZ',
};

/** ISO 3166-1 numeric → alpha-2 for the countries that appear in CTIS sponsor addresses. */
const ISO_NUMERIC_TO_ALPHA2: Record<number, string> = {
  36: 'AU', 40: 'AT', 56: 'BE', 76: 'BR', 100: 'BG', 124: 'CA', 156: 'CN', 191: 'HR', 196: 'CY', 203: 'CZ',
  208: 'DK', 233: 'EE', 246: 'FI', 250: 'FR', 276: 'DE', 300: 'GR', 344: 'HK', 348: 'HU', 352: 'IS', 356: 'IN',
  372: 'IE', 376: 'IL', 380: 'IT', 392: 'JP', 410: 'KR', 428: 'LV', 438: 'LI', 440: 'LT', 442: 'LU', 470: 'MT',
  528: 'NL', 554: 'NZ', 578: 'NO', 616: 'PL', 620: 'PT', 642: 'RO', 702: 'SG', 703: 'SK', 705: 'SI', 724: 'ES',
  752: 'SE', 756: 'CH', 158: 'TW', 792: 'TR', 826: 'GB', 840: 'US', 710: 'ZA', 484: 'MX', 32: 'AR', 152: 'CL',
};

export function toIso2(name: string | number | null | undefined): string | null {
  if (name === null || name === undefined) return null;
  if (typeof name === 'number') return ISO_NUMERIC_TO_ALPHA2[name] ?? null;
  const s = String(name).trim();
  if (!s) return null;
  if (/^\d{1,3}$/.test(s)) return ISO_NUMERIC_TO_ALPHA2[Number(s)] ?? null;
  if (/^[A-Za-z]{2}$/.test(s)) return s.toUpperCase();
  const key = s.toLowerCase().replace(/\s*\(.*\)$/, '').replace(/:\s*\d+$/, '').trim();
  return COUNTRY_TO_ISO2[key] ?? null;
}

export function toIso2List(names: Array<string | number | null | undefined>): string[] {
  return uniq(names.map(toIso2).filter((c): c is string => !!c));
}

// ─── Sponsor classification ──────────────────────────────────────────────────

const CRO_PATTERNS = [
  /\biqvia\b/, /\bparexel\b/, /\bppd\b/, /\bsyneos\b/, /\bicon\s+(clinical|plc)/, /\bcovance\b/, /\blabcorp\b/,
  /\bmedpace\b/, /\bpra health\b/, /\bfortrea\b/, /\bnovotech\b/, /\btigermed\b/, /\blinical\b/, /\bcmic\b/,
  /\beps\s+(corporation|holdings|international)/, /\bworldwide clinical trials\b/, /\bclinipace\b/, /\bcaidya\b/,
  /\bpsi cro\b/, /\bveristat\b/, /\bpharm-?olam\b/, /\bcromsource\b/, /\bcontract research/, /\bcro\b/,
];

const INDUSTRY_PATTERNS =
  /\b(pharma|pharmaceuticals?|pharmaceutica|therapeutics|biotech(nology)?|biosciences?|biopharma(ceuticals?)?|biologics|bio-?tech|medicines|oncology|biomedical|life sciences|healthcare|health care|laboratories|labs?|inc\.?|incorporated|ltd\.?|limited|llc|plc|corp\.?|corporation|gmbh|ag|s\.?a\.?|s\.?p\.?a\.?|s\.?r\.?l\.?|b\.?v\.?|n\.?v\.?|a\.?b\.?|a\.?s\.?|oy|k\.?k\.?|co\.?,? ?ltd\.?|co\.(?=\s|$)|company|pty|holdings?|group|(주)|株式会社|有限公司|股份)\b|\bco\.(?:\s|$)|\bco$/i;

const ACADEMIC_PATTERNS =
  /\b(university|universit[aàäéy]|universidad|universidade|hospital|h[oô]pital|hospitalier|clinic|clinique|klinik|klinikum|institute?|instituto|institut|college|school of medicine|medical (center|centre|school)|cancer (center|centre|research)|foundation|fondation|fundaci[oó]n|stiftung|nhs|trust|research council|academy|society|association|charity|network|consortium|cooperative group|centre|center|infirmary|ministry|department of health|government|national|federal|public health|health service|병원|대학교|대학|의료원|연구소|病院|大学|医院|医学院)\b/i;

/** Unambiguous government bodies (checked before the academic patterns, which also match "institute"/"national"). */
const STRONG_GOVERNMENT_PATTERNS =
  /\b(ministry|ministère|ministerio|government|national institutes? of health|nih|nci|cdc|fda|ema|department of health|public health (england|agency)|health canada|nhs england|medical research council|inserm|cnrs|csic|max planck|helmholtz|riken|amed|kdca)\b|질병관리청|보건복지부|厚生労働省|国家药品监督管理局/i;

/** Looser government hints; only used when nothing academic or industrial matched. */
const GOVERNMENT_PATTERNS = /\b(federal|national|state|county|municipal|department of)\b|国立|国家/i;

export function isCro(name: string | null | undefined): boolean {
  if (!name) return false;
  const s = name.toLowerCase();
  return CRO_PATTERNS.some(re => re.test(s));
}

/**
 * CT.gov-style lead sponsor class from the sponsor name plus an optional
 * registry-provided type hint ('Pharmaceutical company', 'Commercial',
 * 'Hospital/Clinic', '제약회사 (Pharmaceutical Company)', ...).
 */
export function classifySponsorClass(name: string | null | undefined, hint?: string | null): SponsorClass {
  if (isCro(name)) return 'CRO';
  const h = (hint ?? '').toLowerCase();
  if (h) {
    if (/pharma|industry|commercial|company|corporate|제약|企業|manufacturer|biotech|for-?profit/.test(h) && !/non-?commercial|non-?profit|not.for.profit/.test(h)) {
      return 'INDUSTRY';
    }
    if (/government|federal|ministry|public body|national|정부|政府/.test(h)) return 'OTHER_GOV';
    if (/individual|investigator|person|개인/.test(h)) return 'INDIV';
    if (/network|cooperative group|consortium/.test(h)) return 'NETWORK';
    if (/hospital|clinic|university|academic|educational|research|laboratory|institut|medical|charit|foundation|patient|non-?commercial|non-?profit|의료기관|대학|기타|other/.test(h)) {
      return name && !ACADEMIC_PATTERNS.test(name) && INDUSTRY_PATTERNS.test(name) && /other|기타/.test(h)
        ? 'INDUSTRY'
        : 'OTHER';
    }
  }
  if (!name) return 'UNKNOWN';
  if (STRONG_GOVERNMENT_PATTERNS.test(name)) return 'OTHER_GOV';
  if (ACADEMIC_PATTERNS.test(name)) return 'OTHER';
  if (GOVERNMENT_PATTERNS.test(name) && !INDUSTRY_PATTERNS.test(name)) return 'OTHER_GOV';
  if (INDUSTRY_PATTERNS.test(name)) return 'INDUSTRY';
  if (/^(dr|prof|professor|mr|mrs|ms)\.?\s/i.test(name)) return 'INDIV';
  return 'UNKNOWN';
}

// ─── Secondary identifiers ───────────────────────────────────────────────────

const SECONDARY_ID_PATTERNS: RegExp[] = [
  /\bNCT\d{8}\b/g,
  /\b\d{4}-\d{6}-\d{2}-\d{2}\b/g,           // CTIS EU CT number
  /\b\d{4}-\d{6}-\d{2}\b/g,                 // EudraCT
  /\bISRCTN\d{8}\b/g,
  /\bACTRN\d{14}\b/g,
  /\bDRKS\d{8}\b/g,
  /\bjRCT[a-z0-9]?\d{9,10}\b/g,
  /\bJapicCTI-\d{6}\b/g,
  /\bUMIN\d{9}\b/g,
  /\bChiCTR[-A-Za-z]*\d{8,10}\b/g,
  /\bCTR\d{8}\b/g,                          // CDE
  /\bCTRI\/\d{4}\/\d{2}\/\d{6}\b/g,
  /\bKCT\d{7}\b/g,
  /\bIRCT\d{11,14}N\d{1,3}\b/g,
  /\bRBR-[a-z0-9]{5,10}\b/gi,
  /\bPACTR\d{15,16}\b/g,
  /\bU1111-\d{4}-\d{4}\b/g,                 // WHO UTN
  /\bMOH_\d{4}-\d{2}-\d{2}_\d{6}\b/g,       // Israel MyTrial
  /\bNL\d{4,5}\b/g,                         // Netherlands Trial Register (legacy)
  /\bEUCTR\d{4}-\d{6}-\d{2}-[A-Z]{2}\b/g,   // EudraCT via ICTRP
];

/** Every cross-registry identifier found in free text. */
export function extractSecondaryIds(text: string | null | undefined): string[] {
  if (!text) return [];
  const out: string[] = [];
  for (const re of SECONDARY_ID_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) out.push(m[0]);
  }
  return uniq(out);
}

export function nctIdsOf(ids: string[]): string[] {
  return uniq(ids.map(s => s.trim().toUpperCase()).filter(s => /^NCT\d{8}$/.test(s)));
}

// ─── Interventions ───────────────────────────────────────────────────────────

const DRUG_TYPE_RE = /drug|biologic|biological|genetic|gene|cell|vaccine|combination product|medicinal|imp\b|investigational (medicinal )?product|small molecule|antibody|peptide|protein|rna|dna|radiopharm|의약품|薬|药物/i;
const NON_DRUG_TYPE_RE = /device|behaviou?ral|procedure|surgery|surgical|dietary|supplement|radiation|diagnostic|other|educational|exercise|physical|acupuncture|psycholog/i;

export function isDrugInterventionType(type: string | null | undefined): boolean {
  if (!type) return false;
  return DRUG_TYPE_RE.test(type) && !/device|diagnostic test/i.test(type);
}

/**
 * Heuristic used by the mapper to decide whether a registry trial describes a
 * licensable drug/biologic asset (CT.gov's DRUG/BIOLOGICAL/GENETIC filter).
 */
export function isDrugTrial(record: RegistryRecord): boolean {
  if (record.study_type && /observational|registry|epidemiolog/i.test(record.study_type)) return false;
  if (record.interventions.some(i => isDrugInterventionType(i.type))) return true;
  if (record.interventions.length > 0 && record.interventions.every(i => NON_DRUG_TYPE_RE.test(i.type))) return false;
  return record.phase !== 'not_applicable' && record.phase !== 'unknown';
}

export function makeIntervention(
  name: string | null | undefined,
  type: string | null | undefined,
  role: InterventionRole = 'unknown',
): RegistryIntervention | null {
  const n = (name ?? '').replace(/\s+/g, ' ').trim();
  if (!n) return null;
  return { name: n.slice(0, 200), type: (type ?? 'unknown').toLowerCase().trim() || 'unknown', role };
}

/** Pick the experimental drug arm, else the first drug, else the first intervention. */
export function primaryIntervention(interventions: RegistryIntervention[]): RegistryIntervention | null {
  if (interventions.length === 0) return null;
  return (
    interventions.find(i => i.role === 'experimental' && isDrugInterventionType(i.type)) ??
    interventions.find(i => isDrugInterventionType(i.type) && i.role !== 'placebo' && i.role !== 'comparator') ??
    interventions.find(i => i.role !== 'placebo' && i.role !== 'comparator') ??
    interventions[0]
  );
}

// ─── WHO ICTRP XML (IRCT, ReBEC and other registries using the ICTRP export) ─

export interface IctrpMapOptions {
  registry: RegistryId;
  /** Default countries when `<countries>` is empty. */
  defaultCountries: string[];
  /** Fallback detail URL builder. */
  detailUrl: (id: string) => string;
  /** Registries that print DD/MM/YYYY (ReBEC) vs ISO (IRCT). */
  dayFirstDates?: boolean;
  /** Registry id normaliser (e.g. strip the 'RBR-' prefix or keep as-is). */
  normalizeId?: (id: string) => string;
}

/**
 * Map one `<trial>` block in the WHO ICTRP XML export format
 * (main / contacts / countries / criteria / health_condition_* /
 * intervention_* / primary_outcome / secondary_sponsor / secondary_ids /
 * source_support). Field names verified against en.irct.ir and
 * ensaiosclinicos.gov.br exports (Sep 2026).
 */
export function mapIctrpXml(xml: string, opts: IctrpMapOptions): RegistryRecord {
  const main = xmlBlocks(xml, 'main')[0] ?? xml;
  const trialIdRaw = xmlFirst(main, 'trial_id') ?? '';
  const registryId = (opts.normalizeId ?? (s => s))(trialIdRaw.trim());
  const primarySponsor = xmlFirst(main, 'primary_sponsor');
  const secondarySponsors = xmlBlocks(xml, 'secondary_sponsor').flatMap(b => xmlAll(b, 'sponsor_name'));
  const funders = xmlBlocks(xml, 'source_support').flatMap(b => xmlAll(b, 'source_name'));
  const secIds = xmlBlocks(xml, 'secondary_ids').flatMap(b => xmlAll(b, 'sec_id'));
  const countries = toIso2List(xmlBlocks(xml, 'countries').flatMap(b => xmlAll(b, 'country2')));
  const interventionCodes = xmlBlocks(xml, 'intervention_code').flatMap(b => xmlAll(b, 'i_code'));
  const interventionKeywords = xmlBlocks(xml, 'intervention_keyword').flatMap(b => xmlAll(b, 'i_keyword'));
  const interventionText = xmlFirst(main, 'i_freetext');
  const conditionKeywords = xmlBlocks(xml, 'health_condition_keyword').flatMap(b => xmlAll(b, 'hc_keyword'));
  const conditionCodes = xmlBlocks(xml, 'health_condition_code').flatMap(b => xmlAll(b, 'hc_code'));
  const conditionText = xmlFirst(main, 'hc_freetext');
  const phaseRaw = xmlFirst(main, 'phase');
  const statusRaw = xmlFirst(main, 'recruitment_status');
  const studyTypeRaw = xmlFirst(main, 'study_type');
  const dateOpts = { monthFirst: false };
  const isDrugCode = interventionCodes.some(c => isDrugInterventionType(c));
  const interventionType = isDrugCode ? 'drug' : interventionCodes[0]?.toLowerCase() ?? 'unknown';

  const interventionNames = interventionKeywords.length > 0
    ? interventionKeywords.flatMap(k => (k.length <= 120 ? [k] : [k.slice(0, 120)]))
    : interventionText
      ? [truncate(interventionText, 160) as string]
      : [];
  const interventions = interventionNames
    .map(n => makeIntervention(n, interventionType, 'experimental'))
    .filter((i): i is RegistryIntervention => !!i);

  const secondaryIds = uniq([
    ...secIds.filter(s => s && s !== '-'),
    ...extractSecondaryIds(xml).filter(s => s.toUpperCase() !== registryId.toUpperCase()),
    ...compact([xmlFirst(main, 'utrn')]),
  ]);

  const url = xmlFirst(main, 'url') ?? opts.detailUrl(registryId);
  const studyType = studyTypeRaw
    ? /interven/i.test(studyTypeRaw) ? 'interventional' : /observ/i.test(studyTypeRaw) ? 'observational' : studyTypeRaw.toLowerCase()
    : null;

  return {
    registry: opts.registry,
    registry_id: registryId,
    secondary_ids: secondaryIds,
    title: xmlFirst(main, 'scientific_title') ?? xmlFirst(main, 'public_title'),
    sponsor_name: primarySponsor,
    sponsor_type: classifySponsorClass(primarySponsor),
    collaborators: compact([...secondarySponsors, ...funders]).filter(c => c !== primarySponsor),
    interventions,
    conditions: compact([...conditionKeywords, ...conditionCodes, ...(conditionText ? splitList(conditionText) : [])]).slice(0, 20),
    phase_raw: phaseRaw,
    phase: mapRegistryPhase(phaseRaw),
    status_raw: statusRaw,
    status: mapRegistryStatus(statusRaw),
    study_type: studyType,
    countries: countries.length > 0 ? countries : opts.defaultCountries,
    start_date: normalizeRegistryDate(xmlFirst(main, 'date_enrolment'), dateOpts),
    primary_completion_date: normalizeRegistryDate(xmlFirst(main, 'results_date_completed'), dateOpts),
    first_registered: normalizeRegistryDate(xmlFirst(main, 'date_registration'), dateOpts),
    last_updated: normalizeRegistryDate(xmlFirst(main, 'date_updated') ?? xmlFirst(main, 'last_updated'), dateOpts),
    source_url: url,
    raw: { format: 'ictrp_xml', xml: xml.length > 60_000 ? xml.slice(0, 60_000) : xml },
  };
}

/** Company-trials key for a registry record: '<REGISTRY>:<registry_id>'. */
export function companyTrialKey(registry: RegistryId, registryId: string): string {
  return `${registry.toUpperCase()}:${registryId}`;
}
