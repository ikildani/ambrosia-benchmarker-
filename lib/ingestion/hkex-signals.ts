/**
 * Free company signals from the Hong Kong exchange (Search & Evaluation company signals, migration 189).
 *
 *   1. Listing match: HKEX's daily List of Securities (equities on the Main Board and GEM) matched
 *      to our companies by a conservative name core, stored on companies.hkex_stock_code. The
 *      hand-checked map in scripts/data/hkex-biotech-map-*.json is applied first and wins.
 *   2. Announcements: for matched issuers, HKEXnews title search ("Announcements and Notices",
 *      24 months on the first pass, then incremental). Titles are classified by RULES, no model:
 *      placings / subscriptions / rights issues become company_financing_events; licensing or
 *      collaboration agreements, strategic reviews and possible disposals, profit warnings, major
 *      transactions and executive changes become company_intent_signals.
 *
 * Invariant (same as management-intent): nothing is stored without verbatim evidence (the
 * announcement title as HKEX publishes it, HTML entities decoded) and a source_url (the
 * announcement document on www1.hkexnews.hk). observed_at / announced_at is the release date.
 *
 * Why short-name matching is conservative: HKEX publishes abbreviated names ("JUNSHI BIO",
 * "JW THERAP-B", "EVEREST MED"). We compare only the distinctive core (sector words, legal
 * forms, share-class suffixes and leading Chinese place names removed), require the core to be
 * unique on both sides, and for short single-token cores require the HKEX name to look like a
 * life-sciences issuer. Chinese names are not matched yet (HKEX lists traditional characters,
 * our names are mostly simplified).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { unzipSync, strFromU8 } from 'fflate';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';
import { readSyncCursor, writeSyncCursor } from '@/lib/radar/sync-cursor';
import { HKEX_BASE, hkexDateToIso, searchHkexIssuerDocuments, type HkexAnnouncement } from './exchanges/hkex';
import { decodeHtmlEntities, upsertFinancingEvents, type FinancingEventRow } from './company-signals';

// ═══════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════

export const HKEX_LIST_OF_SECURITIES_URL = 'https://www.hkex.com.hk/eng/services/trading/securities/securitieslists/ListOfSecurities.xlsx';
export const HKEX_ACTIVE_STOCK_URL = `${HKEX_BASE}/ncms/script/eds/activestock_sehk_e.json`;
/** HKEXnews tier-1 document category "Announcements and Notices". */
export const HKEX_ANNOUNCEMENTS = { t1code: '10000', t2code: '-2' } as const;
export const HKEX_SIGNALS_CURSOR = 'hkex_signals';
export const HKEX_BACKFILL_MONTHS = 24;
export const HKEX_RULES_MODEL = 'rules:hkex-title-v1';
const EQUITY_SUBCATEGORIES = new Set(['Equity Securities (Main Board)', 'Equity Securities (GEM)']);
const MAX_QUOTE_CHARS = 400;
const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';

// ═══════════════════════════════════════════════════════════════════════
// LIST OF SECURITIES
// ═══════════════════════════════════════════════════════════════════════

export interface HkexSecurity {
  code: string;
  name: string;
  category: string;
  subCategory: string;
}

/** Column letters of a cell reference ("B14" -> "B"). */
function colOf(ref: string): string {
  return ref.replace(/\d+/g, '');
}

/**
 * Parse sheet1.xml of ListOfSecurities.xlsx. HKEX writes inline strings (t="str") with an `x:`
 * namespace prefix and three header rows; columns are A code, B name, C category, D sub-category.
 * ExcelJS cannot open this workbook (its workbook.xml has no sheets element it recognizes), so
 * the XML is read directly.
 */
export function parseListOfSecuritiesSheet(xml: string): HkexSecurity[] {
  const out: HkexSecurity[] = [];
  const rowRe = /<(?:x:)?row\b[^>]*>([\s\S]*?)<\/(?:x:)?row>/g;
  const cellRe = /<(?:x:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:x:)?c>)/g;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(xml))) {
    const cells: Record<string, string> = {};
    let c: RegExpExecArray | null;
    cellRe.lastIndex = 0;
    while ((c = cellRe.exec(m[1]))) {
      const ref = /\br="([A-Z]+\d+)"/.exec(c[1])?.[1];
      if (!ref) continue;
      const v = /<(?:x:)?v>([\s\S]*?)<\/(?:x:)?v>/.exec(c[2] ?? '')?.[1] ?? /<(?:x:)?t[^>]*>([\s\S]*?)<\/(?:x:)?t>/.exec(c[2] ?? '')?.[1] ?? '';
      cells[colOf(ref)] = decodeHtmlEntities(v).trim();
    }
    const code = cells.A ?? '';
    if (!/^\d{4,5}$/.test(code)) continue; // header and title rows
    out.push({ code: code.padStart(5, '0'), name: cells.B ?? '', category: cells.C ?? '', subCategory: cells.D ?? '' });
  }
  return out;
}

export function parseListOfSecuritiesXlsx(buf: Uint8Array): HkexSecurity[] {
  const files = unzipSync(buf, { filter: f => f.name === 'xl/worksheets/sheet1.xml' });
  const sheet = files['xl/worksheets/sheet1.xml'];
  if (!sheet) throw new Error('ListOfSecurities.xlsx: xl/worksheets/sheet1.xml missing');
  return parseListOfSecuritiesSheet(strFromU8(sheet));
}

export function listedEquities(securities: HkexSecurity[]): HkexSecurity[] {
  return securities.filter(s => s.category === 'Equity' && EQUITY_SUBCATEGORIES.has(s.subCategory) && s.name);
}

/** activestock_sehk_e.json: [{i: stockId, c: code, n: shortName}]; the title search needs stockId. */
export function parseActiveStock(json: unknown): Map<string, number> {
  const out = new Map<string, number>();
  if (!Array.isArray(json)) return out;
  for (const r of json as Array<{ i?: number; c?: string }>) {
    if (r && typeof r.i === 'number' && typeof r.c === 'string') out.set(r.c.padStart(5, '0'), r.i);
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════
// NAME CORES
// ═══════════════════════════════════════════════════════════════════════

/** Sector words, legal forms and HKEX abbreviations; never part of a core. */
const GENERIC = new Set([
  'bio', 'biotech', 'biotechnology', 'biotechnologies', 'bioscience', 'biosciences', 'biologic', 'biologics', 'biological', 'biologicals',
  'biopharma', 'biopharm', 'biopharmaceutical', 'biopharmaceuticals', 'biomedical', 'biomed', 'biomedicine', 'biotherapeutics',
  'pharma', 'pharm', 'pharms', 'pharmaceutical', 'pharmaceuticals', 'pharmacy', 'med', 'medical', 'medicine', 'medicines', 'medtech',
  'therap', 'therapeutic', 'therapeutics', 'therapy', 'oncology', 'gene', 'genetics', 'genomics', 'drug', 'drugs',
  'holding', 'holdings', 'hldgs', 'hldg', 'hold', 'group', 'grp', 'gp', 'intl', 'international', 'global',
  'tech', 'technology', 'technologies', 'sci', 'science', 'sciences', 'scientific', 'life', 'health', 'healthcare', 'hlth', 'hc',
  'co', 'corp', 'corporation', 'inc', 'incorporated', 'ltd', 'limited', 'company', 'the', 'plc', 'ag', 'sa', 'nv', 'llc', 'lp',
  'and', 'of', 'stock', 'share', 'shares', 'joint', 'industrial', 'industries', 'industry', 'development', 'dev', 'research',
  'innovation', 'innovative', 'laboratories', 'laboratory', 'labs', 'lab', 'products', 'product',
  'resources', 'res', 'chemical', 'chemicals', 'chem', 'biochemical', 'engineering', 'ophth', 'ophthalmology', 'ophthalmic',
]);

/** Words that, in an HKEX short name, mark a life-sciences issuer. */
const LIFE_SCIENCE_HINT = /(bio|pharm|\bmed|med$|therap|\bgene|onco|\bcell|vaccin|antibod|\bdrug)/;

/** Chinese places that prefix legal names ("Jiangsu Hengrui", "Shanghai Junshi"); dropped only when leading. */
const LEADING_PLACES = new Set([
  'shanghai', 'beijing', 'suzhou', 'hangzhou', 'shenzhen', 'guangzhou', 'nanjing', 'jiangsu', 'zhejiang', 'chengdu', 'sichuan',
  'wuhan', 'hubei', 'tianjin', 'chongqing', 'xiamen', 'fujian', 'guangdong', 'shandong', 'jinan', 'qingdao', 'hunan', 'changsha',
  'anhui', 'hefei', 'henan', 'zhengzhou', 'hebei', 'shijiazhuang', 'liaoning', 'shenyang', 'dalian', 'jilin', 'changchun',
  'harbin', 'heilongjiang', 'shaanxi', 'xian', 'yunnan', 'kunming', 'guangxi', 'jiangxi', 'nanchang', 'taizhou', 'ningbo',
  'zhuhai', 'dongguan', 'foshan', 'changzhou', 'nantong', 'yantai', 'lianyungang', 'zhongshan', 'hainan', 'haikou', 'guizhou',
  'shanxi', 'gansu', 'lanzhou', 'xinjiang', 'hong', 'kong', 'hongkong', 'hk', 'macau', 'china', 'chinese', 'prc',
]);

function tokens(s: string): string[] {
  return (s ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

function stripLeadingPlaces(toks: string[]): string[] {
  let i = 0;
  while (i < toks.length - 1 && LEADING_PLACES.has(toks[i])) i++;
  return toks.slice(i);
}

/**
 * Distinctive core of an HKEX short name: share-class suffix ("-B", "-W", "-SW", "-S") removed,
 * leading place names and sector abbreviations dropped. "JUNSHI BIO" -> "junshi",
 * "JW THERAP-B" -> "jw", "EVEREST MED" -> "everest", "EVEREST GOLD" -> "everest gold".
 */
export function hkexNameCore(shortName: string): string {
  const base = (shortName ?? '').toUpperCase().replace(/\s*-\s*[A-Z]{1,3}$/, '');
  // Place names stay on the HKEX side: "JIANGSU HORIZON" must not become "horizon" and claim
  // Horizon Therapeutics. Our names are indexed with and without their leading place instead.
  const toks = tokens(base).flatMap(splitGluedSuffix).filter(t => !GENERIC.has(t) && t.length > 1);
  return toks.join(' ');
}

/** HKEX glues sector words onto names ("DUALITYBIO", "CANSINOBIO", "ZHONGZHIPHARM"); split them off. */
const GLUED_SUFFIX = /^([a-z0-9]{4,}?)(bio|biotech|pharm|pharma|health|medical|med|therap)$/;
function splitGluedSuffix(tok: string): string[] {
  const m = GLUED_SUFFIX.exec(tok);
  return m ? [m[1], m[2]] : [tok];
}

/** True when the short name carries a life-sciences word or the Chapter 18A "-B" marker. */
export function hkexLooksLifeScience(shortName: string): boolean {
  const up = (shortName ?? '').toUpperCase();
  return /-B$/.test(up.trim()) || LIFE_SCIENCE_HINT.test(up.toLowerCase());
}

/**
 * Distinctive core of one of our company names: parentheticals ("(Suzhou)") removed, then the
 * same token rules. "Innovent Biologics (Suzhou) Co. Ltd." -> "innovent",
 * "Shanghai Junshi Biosciences Co., Ltd." -> "junshi".
 */
export function companyNameCore(name: string): string {
  return companyNameCores(name)[0] ?? '';
}

/** [core without leading places, core with them] (one entry when the name has no leading place). */
export function companyNameCores(name: string): string[] {
  const noParens = (name ?? '').replace(/\([^)]*\)/g, ' ');
  const all = tokens(noParens).flatMap(splitGluedSuffix);
  const stripped = stripLeadingPlaces(all).filter(t => !GENERIC.has(t) && t.length > 1).join(' ');
  const kept = all.filter(t => !GENERIC.has(t) && t.length > 1).join(' ');
  return stripped === kept || !kept ? [stripped].filter(Boolean) : [stripped, kept].filter(Boolean);
}

/** Greater China headquarters: the only companies matched to an HKEX issuer by name alone. */
const GREATER_CHINA = new Set(['CN', 'HK', 'MO', 'TW', 'CHINA', 'HONG KONG', 'MACAU', 'MACAO', 'TAIWAN', "PEOPLE'S REPUBLIC OF CHINA"]);

export interface HkexIssuerRef {
  code: string;
  shortName: string;
  core: string;
  lifeScience: boolean;
  /** The short name is nothing but its core ("HENLIUS", "REMEGEN"): no HLDG / GROUP / HEALTH words. */
  bare: boolean;
  stockId: number | null;
}

export interface HkexIndex {
  byCore: Map<string, HkexIssuerRef[]>;
  size: number;
}

export function buildHkexIndex(equities: HkexSecurity[], stockIds: Map<string, number> = new Map()): HkexIndex {
  const byCore = new Map<string, HkexIssuerRef[]>();
  for (const s of equities) {
    const core = hkexNameCore(s.name);
    if (!core) continue;
    const ref: HkexIssuerRef = { code: s.code, shortName: s.name, core, lifeScience: hkexLooksLifeScience(s.name), bare: hkexNameIsBare(s.name), stockId: stockIds.get(s.code) ?? null };
    const list = byCore.get(core) ?? [];
    list.push(ref);
    byCore.set(core, list);
  }
  return { byCore, size: equities.length };
}

/** A core is safe to match when it is long enough to be distinctive. */
/** True when every token of the short name (share-class suffix removed) is part of its core. */
export function hkexNameIsBare(shortName: string): boolean {
  const base = (shortName ?? '').toUpperCase().replace(/\s*-\s*[A-Z]{1,3}$/, '');
  const all = tokens(base).flatMap(splitGluedSuffix).filter(t => t.length > 1);
  return all.length > 0 && all.every(t => !GENERIC.has(t));
}

/**
 * A core is safe to match when it is distinctive: at least 4 letters, and the HKEX name either
 * reads as a life-sciences issuer ("JUNSHI BIO", "BRII-B", "EVEREST MED") or is a bare brand of
 * 5+ letters ("HENLIUS", "REMEGEN", "INSILICO"). Hint-less names with extra words are where the
 * Nov 17 2026 dry run found its false positives (ZHONGSHENG HLDG, HAICHANG HLDG, KANGHUA HEALTH).
 */
export function coreIsDistinctive(core: string, issuer: HkexIssuerRef): boolean {
  const letters = core.replace(/\s/g, '').length;
  if (letters < 4) return false;
  if (issuer.lifeScience) return true;
  return issuer.bare && letters >= 5;
}

export interface HkexMatchCandidate {
  id: string;
  name: string;
  name_variations?: string[] | null;
  /** ISO-2 headquarters country (hq_country, else headquarters_country). */
  country?: string | null;
}

export interface HkexMatch {
  companyId: string;
  companyName: string;
  code: string;
  shortName: string;
  stockId: number | null;
  core: string;
  method: 'verified_map' | 'name_core';
}

/**
 * Match companies to HKEX issuers. A company matches when one of its name cores equals exactly
 * one issuer's core, the core is distinctive, and no other candidate company shares that core
 * (two companies rows with the same core are ambiguous: the subsidiary and the listed parent, or
 * two unrelated "Everest" companies). One code is claimed by at most one company.
 *
 * Geography guard (measured on the Nov 17 2026 dry run): every false positive was a US, European
 * or Australian company sharing a word with a Hong Kong issuer (Horizon Therapeutics, Edge
 * Therapeutics, Clarity Pharmaceuticals, Momenta). Name-only matches therefore require a Greater
 * China headquarters, or an unknown country plus a life-sciences HKEX name. Other listings
 * (BeOne, Ascentage) come from the hand-checked map.
 */
export function matchHkexIssuers(candidates: HkexMatchCandidate[], index: HkexIndex, verified: HkexMatch[] = []): { matches: HkexMatch[]; ambiguous: number; unmatched: number } {
  const matches: HkexMatch[] = [];
  const claimedCodes = new Set<string>();
  const claimedCompanies = new Set<string>();
  for (const v of verified) {
    if (claimedCodes.has(v.code) || claimedCompanies.has(v.companyId)) continue;
    claimedCodes.add(v.code);
    claimedCompanies.add(v.companyId);
    matches.push({ ...v, method: 'verified_map' });
  }

  const coresByCompany = new Map<string, Set<string>>();
  const companiesByCore = new Map<string, Set<string>>();
  for (const c of candidates) {
    const cores = new Set([c.name, ...(c.name_variations ?? [])].filter(Boolean).flatMap(companyNameCores));
    coresByCompany.set(c.id, cores);
    for (const core of cores) {
      const set = companiesByCore.get(core) ?? new Set<string>();
      set.add(c.id);
      companiesByCore.set(core, set);
    }
  }

  let ambiguous = 0;
  let unmatched = 0;
  for (const c of candidates) {
    if (claimedCompanies.has(c.id)) continue;
    const country = (c.country ?? '').toUpperCase();
    if (country && !GREATER_CHINA.has(country)) { unmatched++; continue; }
    let hit: { ref: HkexIssuerRef; core: string } | null = null;
    let sawAmbiguity = false;
    for (const core of coresByCompany.get(c.id) ?? []) {
      const refs = index.byCore.get(core);
      if (!refs) continue;
      if (refs.length !== 1 || (companiesByCore.get(core)?.size ?? 0) !== 1) { sawAmbiguity = true; continue; }
      if (!coreIsDistinctive(core, refs[0])) continue;
      // Unknown country: life-sciences HKEX name and a 6+ letter core ("Rain Therapeutics" is not RAINMED-B).
      if (!country && (!refs[0].lifeScience || core.replace(/\s/g, '').length < 6)) continue;
      if (hit && hit.ref.code !== refs[0].code) { hit = null; sawAmbiguity = true; break; }
      hit = { ref: refs[0], core };
    }
    if (!hit) { if (sawAmbiguity) ambiguous++; else unmatched++; continue; }
    if (claimedCodes.has(hit.ref.code)) { ambiguous++; continue; }
    claimedCodes.add(hit.ref.code);
    claimedCompanies.add(c.id);
    matches.push({ companyId: c.id, companyName: c.name, code: hit.ref.code, shortName: hit.ref.shortName, stockId: hit.ref.stockId, core: hit.core, method: 'name_core' });
  }
  return { matches, ambiguous, unmatched };
}

// ═══════════════════════════════════════════════════════════════════════
// TITLE CLASSIFIER (rules)
// ═══════════════════════════════════════════════════════════════════════

export type HkexFinancingType = 'placing' | 'share_subscription' | 'rights_issue' | 'open_offer' | 'convertible_bonds';
export type HkexIntentType =
  | 'licensing_agreement' | 'strategic_review' | 'profit_warning' | 'major_transaction' | 'executive_change' | 'cfo_cbo_change' | 'pipeline_prioritization';

export interface HkexClassification {
  financing: HkexFinancingType | null;
  intents: Array<{ type: HkexIntentType; polarity: 'bullish' | 'bearish' | 'neutral'; stance: string; confidence: number }>;
}

/**
 * Notices about an event already announced (completion, closing, results, updates, receipts of
 * payments under an existing agreement). They never create a new financing event or intent
 * signal: counting them would turn one placing into three and one spin-off into six (Sihuan
 * filed six "UPDATE ON THE PROPOSED SPIN-OFF" notices in 2025).
 */
const FOLLOW_UP_RE = /\b(?:completion of|completed|closing of|results? of|lapse of|update on|updates? (?:announcement|in relation)|further (?:announcement|delay)|supplemental announcement|clarification|delay in despatch|monthly update|use of proceeds|receipt of|payment received|payments? under|milestone payment|received\b.{0,60}?(?:upfront|milestone) payment|latest progress|progress (?:of|in|on)|effectiveness of|coming into effect|becomes? effective|amendment to|extension of|timing of (?:despatch|dispatch)|designation of)\b/i;
/** Treasury products the issuer BUYS; "subscription" here is not a raise. */
const TREASURY_RE = /subscription (?:of|for) (?:(?:the )?(?:wealth management|structured|financial|investment|principal[- ]protected|fund|asset management|bank)\b|investment notes)/i;
const REGULATORY_RE = /biologics? license application|\bbla\b|marketing authori[sz]ation|new drug application|\bnda\b|clinical trial approval|\bind\b approval|drug registration|product licen[cs]e renewal|business licen[cs]e|money lenders? licen[cs]e|safety licen[cs]e|production licen[cs]e|licensed (?:oncology )?products?/i;
const LICENSING_RE = /licen[cs](?:e|ing)[- ](?:out|in)\b|licen[cs](?:e|ing)(?: and \w+)?(?: and \w+)? agreement|exclusive (?:global )?licen[cs]e|out-?licens|in-?licens|\blicen[cs]e (?:to|from)\b|collaboration(?: and \w+)? agreement|strategic collaboration|research collaboration|co-development|option (?:to licen[cs]e )?agreement|partnership agreement|strategic partnership|commercialization agreement|co-promotion|joint venture contract/i;
/** Intra-group agreements under the connected-transaction rules are not partnering. */
const CONNECTED_RE = /connected transaction/i;
const LICENSE_END_RE = /termination of (?:the )?(?:\w+ ){0,4}(?:licen[cs]e|collaboration)|return of (?:the )?rights/i;
const STRATEGIC_RE = /strategic review|strategic alternatives?|possible (?:very substantial )?(?:disposal|sale|spin-?off)|proposed spin-?off|possible (?:major |very substantial )?transaction|possible privati[sz]ation|possible (?:mandatory |voluntary )?(?:conditional )?(?:cash )?general offer|proposed privati[sz]ation|withdrawal of listing|proposed delisting|winding[- ]up/i;
const PROFIT_WARNING_RE = /profit warning|loss warning|expected (?:increase in |significant )?(?:net )?loss|negative profit alert/i;
const MAJOR_RE = /major transaction|very substantial (?:disposal|acquisition)/i;
const EXEC_ROLE_RE = /chief executive|\bceo\b|chief financial|\bcfo\b|chief business|\bcbo\b|chief medical|chief scientific|chief operating|chief commercial|\bpresident\b|general manager|chairman|chairwoman|executive director|business development/i;
const BD_ROLE_RE = /chief financial|\bcfo\b|chief business|\bcbo\b|business development/i;
const PIPELINE_RE = /discontinu\w* (?:of )?(?:the )?(?:\w+ ){0,4}(?:development|clinical|trial|program|programme|project)|deprioriti[sz]\w*|suspension of (?:the )?(?:\w+ ){0,3}(?:clinical|trial|development)/i;

/**
 * Classify one announcement by its title and HKEX headline category (LONG_TEXT, e.g.
 * "Announcements and Notices - [Placing / Issue of Shares under a General Mandate]").
 * Pure; conservative by design (a title that matches nothing produces nothing).
 */
export function classifyHkexAnnouncement(rawTitle: string, rawCategory = ''): HkexClassification {
  const title = decodeHtmlEntities(rawTitle).replace(/\s+/g, ' ').trim();
  const category = decodeHtmlEntities(rawCategory);
  const t = title.toLowerCase();
  const cat = category.toLowerCase();
  const out: HkexClassification = { financing: null, intents: [] };
  const followUp = FOLLOW_UP_RE.test(title);

  // ── Financing ──
  if (!followUp && !TREASURY_RE.test(title)) {
    if (/rights issue/.test(t)) out.financing = 'rights_issue';
    else if (/open offer/.test(t)) out.financing = 'open_offer';
    else if (/\bplacing\b/.test(t)) out.financing = 'placing';
    else if (/convertible (?:bonds?|notes?)/.test(t) && /issu|placing|subscription/.test(t)) out.financing = 'convertible_bonds';
    else if (/subscriptions? of new (?:h |domestic |a )?shares|subscription agreement|issu\w* of (?:new )?shares under (?:the |a )?(?:general|specific) mandate|share subscription|subscription of (?:new )?(?:h )?shares by/.test(t)) out.financing = 'share_subscription';
    else if (/\[placing\b/.test(cat) || /issue of shares under a (?:general|specific) mandate/.test(cat)) {
      // Category marks a share issue but the title names none of the forms above.
      if (/issu\w* of (?:new )?shares|subscription/.test(t)) out.financing = 'share_subscription';
    }
  }

  // ── Licensing / collaboration ──
  if (LICENSING_RE.test(title) && !REGULATORY_RE.test(title) && !CONNECTED_RE.test(title)) {
    const ended = LICENSE_END_RE.test(title);
    if (ended) {
      out.intents.push({ type: 'licensing_agreement', polarity: 'neutral', confidence: 85, stance: 'Licensing or collaboration terminated (title).' });
    } else if (!followUp) {
      out.intents.push({ type: 'licensing_agreement', polarity: 'neutral', confidence: 85, stance: 'Licensing or collaboration agreement announced (title).' });
    }
  }

  // ── Strategic review / possible disposal / spin-off ──
  if (!followUp && STRATEGIC_RE.test(title)) {
    const spinOff = /spin-?off/.test(t) && !/strategic review|strategic alternatives|disposal|sale|privati|general offer|delisting|withdrawal of listing|winding/.test(t);
    out.intents.push({
      type: 'strategic_review', polarity: 'bullish', confidence: spinOff ? 65 : 80,
      stance: spinOff ? 'Proposed spin-off of a business (title).' : 'Strategic review, possible disposal or change of control announced (title).',
    });
  }

  // ── Profit warning (never a "positive profit alert", which HKEX files in the same category) ──
  if (PROFIT_WARNING_RE.test(title) && !/positive profit/.test(t)) {
    out.intents.push({ type: 'profit_warning', polarity: 'neutral', confidence: 90, stance: 'Profit warning: results expected to deteriorate (title).' });
  }

  // ── Major transaction ──
  if (!followUp && MAJOR_RE.test(title)) {
    out.intents.push({ type: 'major_transaction', polarity: 'neutral', confidence: 80, stance: 'Major or very substantial transaction under the Listing Rules (title).' });
  }

  // ── Executive change (board-only changes and AGM re-elections are not) ──
  if ((/change in directors or of important executive functions/.test(cat) || /\b(?:appointment|resignation|retirement|change|re-designation) of\b/.test(t)) && !/poll results|re-election/.test(t)) {
    const roles = t.replace(/non-executive directors?/g, ' ');
    if (EXEC_ROLE_RE.test(roles)) {
      const bd = BD_ROLE_RE.test(roles);
      out.intents.push({
        type: bd ? 'cfo_cbo_change' : 'executive_change', polarity: 'neutral', confidence: 75,
        stance: bd ? 'Change of chief financial or business officer (title).' : 'Change of a senior executive or executive director (title).',
      });
    }
  }

  // ── Pipeline prioritization ──
  if (PIPELINE_RE.test(title)) {
    out.intents.push({ type: 'pipeline_prioritization', polarity: 'bullish', confidence: 70, stance: 'Program discontinued or deprioritized (title).' });
  }

  return out;
}

// ═══════════════════════════════════════════════════════════════════════
// ROWS
// ═══════════════════════════════════════════════════════════════════════

export interface HkexIntentRow {
  company_id: string;
  signal_type: HkexIntentType;
  polarity: 'bullish' | 'bearish' | 'neutral';
  stance: string;
  quote: string;
  source_type: 'hkex_announcement';
  source_id: string;
  source_url: string;
  observed_at: string;
  confidence: number;
  model: string;
  fetched_at: string;
}

/** Verbatim title, whitespace folded, cut at a word boundary to fit the 400-char quote column. */
export function hkexQuote(rawTitle: string): string {
  const t = decodeHtmlEntities(rawTitle).replace(/\s+/g, ' ').trim();
  if (t.length <= MAX_QUOTE_CHARS) return t;
  const cut = t.slice(0, MAX_QUOTE_CHARS);
  return cut.slice(0, Math.max(cut.lastIndexOf(' '), 200)).trim();
}

export function hkexAnnouncementRows(
  companyId: string,
  a: Pick<HkexAnnouncement, 'newsId' | 'title' | 'dateTime' | 'url'> & { category?: string },
  now = new Date(),
): { financing: FinancingEventRow | null; intents: HkexIntentRow[] } {
  const observed = hkexDateToIso(a.dateTime);
  const quote = hkexQuote(a.title);
  if (!observed || !quote || !a.url || !a.newsId) return { financing: null, intents: [] };
  const cls = classifyHkexAnnouncement(a.title, a.category ?? '');
  const fetchedAt = now.toISOString();
  const financing: FinancingEventRow | null = cls.financing
    ? {
        company_id: companyId, event_type: cls.financing, amount_usd: null, amount_offered_usd: null, currency: 'HKD',
        announced_at: observed, source: 'hkex_announcement', source_url: a.url, source_id: a.newsId, evidence: quote,
        industry_group: null, filer_cik: null, metadata: { category: a.category ?? null }, fetched_at: fetchedAt,
      }
    : null;
  const seen = new Set<string>();
  const intents: HkexIntentRow[] = [];
  for (const i of cls.intents) {
    if (seen.has(i.type)) continue;
    seen.add(i.type);
    intents.push({
      company_id: companyId, signal_type: i.type, polarity: i.polarity, stance: i.stance, quote, source_type: 'hkex_announcement',
      source_id: a.newsId, source_url: a.url, observed_at: observed, confidence: i.confidence, model: HKEX_RULES_MODEL, fetched_at: fetchedAt,
    });
  }
  return { financing, intents };
}

/** Title stem for repeat detection: announcement-type prefixes and trailing " - TIMING ..." parts removed. */
export function titleStem(quote: string): string {
  return quote.toLowerCase()
    .replace(/^(?:\s*(?:voluntary announcement|inside information(?: announcement)?|overseas regulatory announcement|announcement)\s*(?:and\s*)?[-:]?\s*)+/g, '')
    .split(/ - |; |\(2\)/)[0]
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .slice(0, 80);
}

/**
 * One event, one signal: the same type with the same title stem within 365 days keeps only the
 * earliest notice (the first is when the market learned of it). Licensing agreements are
 * exempt: two "EXCLUSIVE LICENSE AGREEMENT WITH ..." titles are different deals.
 */
export function dedupeRepeatedIntents(rows: HkexIntentRow[]): HkexIntentRow[] {
  const sorted = [...rows].sort((a, b) => a.observed_at.localeCompare(b.observed_at));
  const kept: HkexIntentRow[] = [];
  const lastByKey = new Map<string, string>();
  for (const r of sorted) {
    if (r.signal_type === 'licensing_agreement') { kept.push(r); continue; }
    const key = `${r.company_id}|${r.signal_type}|${titleStem(r.quote)}`;
    const prev = lastByKey.get(key);
    if (prev && Date.parse(r.observed_at) - Date.parse(prev) <= 365 * 86_400_000) continue;
    lastByKey.set(key, r.observed_at);
    kept.push(r);
  }
  return kept;
}

// ═══════════════════════════════════════════════════════════════════════
// NETWORK
// ═══════════════════════════════════════════════════════════════════════

export async function fetchHkexEquities(): Promise<{ equities: HkexSecurity[]; stockIds: Map<string, number> }> {
  const [xlsx, active] = await Promise.all([
    fetchWithTimeout(HKEX_LIST_OF_SECURITIES_URL, { timeoutMs: 60_000, retries: 1, headers: { 'User-Agent': BROWSER_UA } }),
    fetchWithTimeout(HKEX_ACTIVE_STOCK_URL, { timeoutMs: 30_000, retries: 1, headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' } }),
  ]);
  if (!xlsx.ok) throw new Error(`ListOfSecurities.xlsx HTTP ${xlsx.status}`);
  if (!active.ok) throw new Error(`activestock_sehk_e.json HTTP ${active.status}`);
  const equities = listedEquities(parseListOfSecuritiesXlsx(new Uint8Array(await xlsx.arrayBuffer())));
  const stockIds = parseActiveStock(await active.json());
  return { equities, stockIds };
}

// ═══════════════════════════════════════════════════════════════════════
// RUNNERS
// ═══════════════════════════════════════════════════════════════════════

export interface HkexSignalsOptions {
  dryRun?: boolean;
  timeBudgetMs?: number;
  /** Issuers per announcements run (each is one title-search call, 3 s apart). */
  limit?: number;
  now?: Date;
  /** Hand-checked issuers (scripts/data/hkex-biotech-map-*.json); applied before name matching. */
  verified?: Array<{ stockId: number; code: string; shortName: string; companyId: string; companyName: string }>;
}

export interface HkexMatchRunResult {
  equities: number;
  candidates: number;
  matched: number;
  verified: number;
  written: number;
  ambiguous: number;
  unmatched: number;
  errors: string[];
  sample: Array<{ company: string; code: string; shortName: string; method: string }>;
}

interface HkexCursorState extends Record<string, unknown> {
  /** company_id -> ISO date the announcements were last fetched through. */
  byCompany?: Record<string, string>;
  lastMatchAt?: string;
}

/** Industry companies that own a feed (program_primary) program (company_signal_feed_companies, migration 189). */
export async function loadFeedCompanies(
  supabase: SupabaseClient,
): Promise<{ rows: Array<HkexMatchCandidate & { hkex_stock_code: string | null; hkex_match_method: string | null }>; error?: string }> {
  const rows: Array<HkexMatchCandidate & { hkex_stock_code: string | null; hkex_match_method: string | null }> = [];
  let after: string | null = null;
  for (let page = 0; page < 100; page++) {
    // PostgREST caps responses at 1,000 rows whatever p_limit says: page until empty, not until short.
    const { data, error } = await supabase.rpc('company_signal_feed_companies', { p_after: after, p_limit: 1000 });
    if (error) return { rows, error: `company_signal_feed_companies: ${error.message}` };
    const batch = (data ?? []) as Array<HkexMatchCandidate & { hkex_stock_code: string | null; hkex_match_method: string | null }>;
    if (batch.length === 0) break;
    rows.push(...batch);
    after = batch[batch.length - 1].id;
  }
  return { rows };
}

/**
 * Name-core assignments that the new match set no longer supports; cleared before writing so the
 * unique index on hkex_stock_code never blocks a corrected match. Verified-map rows are never cleared.
 */
export function staleHkexAssignments(
  current: Array<{ id: string; hkex_stock_code: string | null; hkex_match_method: string | null }>,
  matches: HkexMatch[],
): string[] {
  const want = new Map(matches.map(m => [m.companyId, m.code] as const));
  return current
    .filter(c => c.hkex_stock_code && c.hkex_match_method === 'name_core' && want.get(c.id) !== c.hkex_stock_code)
    .map(c => c.id);
}

export async function runHkexListingMatch(supabase: SupabaseClient, opts: HkexSignalsOptions = {}): Promise<HkexMatchRunResult> {
  const now = opts.now ?? new Date();
  const r: HkexMatchRunResult = { equities: 0, candidates: 0, matched: 0, verified: 0, written: 0, ambiguous: 0, unmatched: 0, errors: [], sample: [] };
  const { equities, stockIds } = await fetchHkexEquities();
  r.equities = equities.length;
  const index = buildHkexIndex(equities, stockIds);
  const feed = await loadFeedCompanies(supabase);
  if (feed.error) { r.errors.push(feed.error); return r; }
  const candidates: HkexMatchCandidate[] = feed.rows;
  r.candidates = candidates.length;
  const listed = new Set(equities.map(e => e.code));
  const verified: HkexMatch[] = (opts.verified ?? [])
    .filter(v => listed.has(v.code.padStart(5, '0')))
    .map(v => ({ companyId: v.companyId, companyName: v.companyName, code: v.code.padStart(5, '0'), shortName: v.shortName, stockId: v.stockId, core: hkexNameCore(v.shortName), method: 'verified_map' as const }));
  const res = matchHkexIssuers(candidates, index, verified);
  r.matched = res.matches.length;
  r.verified = res.matches.filter(m => m.method === 'verified_map').length;
  r.ambiguous = res.ambiguous;
  r.unmatched = res.unmatched;
  r.sample = res.matches.filter(m => m.method === 'name_core').slice(0, 40).map(m => ({ company: m.companyName, code: m.code, shortName: m.shortName, method: m.method }));
  if (opts.dryRun) return r;

  for (const id of staleHkexAssignments(feed.rows, res.matches)) {
    const { error } = await supabase.from('companies').update({ hkex_stock_code: null, hkex_stock_id: null, hkex_short_name: null, hkex_match_method: null }).eq('id', id);
    if (error) r.errors.push(`hkex clear ${id}: ${error.message}`);
  }
  for (const m of res.matches) {
    const { error } = await supabase.from('companies').update({
      hkex_stock_code: m.code, hkex_stock_id: m.stockId, hkex_short_name: m.shortName, hkex_match_method: m.method, hkex_matched_at: now.toISOString(),
    }).eq('id', m.companyId);
    if (error) r.errors.push(`hkex code ${m.code} -> ${m.companyName}: ${error.message}`);
    else r.written++;
  }
  try {
    const cursor = await readSyncCursor<HkexCursorState>(supabase, HKEX_SIGNALS_CURSOR);
    await writeSyncCursor(supabase, HKEX_SIGNALS_CURSOR, cursor.cursor, { ...cursor.state, lastMatchAt: now.toISOString() });
  } catch (e) {
    r.errors.push(`cursor write: ${e instanceof Error ? e.message : String(e)}`);
  }
  return r;
}

export interface HkexAnnouncementsRunResult {
  issuers: number;
  announcements: number;
  financingEvents: number;
  intentSignals: number;
  byType: Record<string, number>;
  throttled: boolean;
  timedOut: boolean;
  errors: string[];
  cursor: string | null;
  sample: Array<{ code: string; date: string; kind: string; title: string }>;
}

function monthsBefore(now: Date, months: number): string {
  const d = new Date(now);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString().slice(0, 10);
}

/** One issuer's announcements in a window; classification only (no DB). */
export async function fetchIssuerAnnouncementRows(
  companyId: string,
  stockId: number,
  fromIso: string,
  toIso: string,
  now = new Date(),
): Promise<{ announcements: number; throttled: boolean; financing: FinancingEventRow[]; intents: HkexIntentRow[]; raw: HkexAnnouncement[] }> {
  const search = await searchHkexIssuerDocuments(stockId, HKEX_ANNOUNCEMENTS, fromIso, toIso, 500);
  const financing: FinancingEventRow[] = [];
  const intents: HkexIntentRow[] = [];
  for (const a of search.rows) {
    const rows = hkexAnnouncementRows(companyId, a, now);
    if (rows.financing) financing.push(rows.financing);
    intents.push(...rows.intents);
  }
  return { announcements: search.rows.length, throttled: search.throttled, financing, intents: dedupeRepeatedIntents(intents), raw: search.rows };
}

export async function runHkexAnnouncements(supabase: SupabaseClient, opts: HkexSignalsOptions = {}): Promise<HkexAnnouncementsRunResult> {
  const started = Date.now();
  const now = opts.now ?? new Date();
  const budget = opts.timeBudgetMs ?? 240_000;
  const limit = opts.limit ?? 60;
  const r: HkexAnnouncementsRunResult = { issuers: 0, announcements: 0, financingEvents: 0, intentSignals: 0, byType: {}, throttled: false, timedOut: false, errors: [], cursor: null, sample: [] };

  const cursor = await readSyncCursor<HkexCursorState>(supabase, HKEX_SIGNALS_CURSOR);
  const state: HkexCursorState = { ...cursor.state, byCompany: { ...(cursor.state.byCompany ?? {}) } };

  let q = supabase.from('companies').select('id, name, hkex_stock_code, hkex_stock_id')
    .not('hkex_stock_id', 'is', null).order('id', { ascending: true }).limit(limit);
  if (cursor.cursor) q = q.gt('id', cursor.cursor);
  let { data, error } = await q;
  if (error) { r.errors.push(`companies read: ${error.message}`); return r; }
  let wrapped = false;
  if ((data ?? []).length === 0 && cursor.cursor) {
    wrapped = true;
    const again = await supabase.from('companies').select('id, name, hkex_stock_code, hkex_stock_id')
      .not('hkex_stock_id', 'is', null).order('id', { ascending: true }).limit(limit);
    data = again.data ?? [];
  }

  const today = now.toISOString().slice(0, 10);
  let lastId: string | null = wrapped ? null : cursor.cursor;
  for (const c of (data ?? []) as Array<{ id: string; name: string; hkex_stock_code: string; hkex_stock_id: number }>) {
    if (Date.now() - started > budget) { r.timedOut = true; break; }
    const since = state.byCompany![c.id];
    // Re-read 14 days back so late-indexed notices are not lost; upserts dedupe.
    const fromIso = since ? new Date(Date.parse(since) - 14 * 86_400_000).toISOString().slice(0, 10) : monthsBefore(now, HKEX_BACKFILL_MONTHS);
    try {
      const res = await fetchIssuerAnnouncementRows(c.id, c.hkex_stock_id, fromIso, today, now);
      if (res.throttled) { r.throttled = true; r.errors.push(`${c.hkex_stock_code}: HKEX search throttled; stopping`); break; }
      r.issuers++;
      lastId = c.id;
      r.announcements += res.announcements;
      for (const f of res.financing) r.byType[`financing:${f.event_type}`] = (r.byType[`financing:${f.event_type}`] ?? 0) + 1;
      for (const i of res.intents) r.byType[i.signal_type] = (r.byType[i.signal_type] ?? 0) + 1;
      for (const f of res.financing) if (r.sample.length < 30) r.sample.push({ code: c.hkex_stock_code, date: f.announced_at, kind: f.event_type, title: f.evidence.slice(0, 140) });
      for (const i of res.intents) if (r.sample.length < 30) r.sample.push({ code: c.hkex_stock_code, date: i.observed_at, kind: i.signal_type, title: i.quote.slice(0, 140) });
      if (!opts.dryRun) {
        if (res.financing.length) {
          const up = await upsertFinancingEvents(supabase, res.financing);
          if (up.error) { r.errors.push(`${c.hkex_stock_code} financing: ${up.error}`); continue; }
          r.financingEvents += up.written;
        }
        if (res.intents.length) {
          const { error: iErr } = await supabase.from('company_intent_signals').upsert(res.intents, { onConflict: 'company_id,signal_type,source_type,source_id' });
          if (iErr) { r.errors.push(`${c.hkex_stock_code} intent: ${iErr.message}`); continue; }
          r.intentSignals += res.intents.length;
        }
        state.byCompany![c.id] = today;
      } else {
        r.financingEvents += res.financing.length;
        r.intentSignals += res.intents.length;
      }
    } catch (e) {
      r.errors.push(`${c.hkex_stock_code}: ${e instanceof Error ? e.message.split('\n')[0].slice(0, 200) : String(e)}`);
    }
  }
  r.cursor = lastId;
  if (!opts.dryRun) {
    try { await writeSyncCursor(supabase, HKEX_SIGNALS_CURSOR, lastId, state); } catch (e) { r.errors.push(`cursor write: ${e instanceof Error ? e.message : String(e)}`); }
  }
  return r;
}

/** True when the weekly listing match is due (or never ran). */
export function hkexMatchDue(lastMatchAt: string | undefined | null, now = new Date()): boolean {
  if (!lastMatchAt) return true;
  return now.getTime() - Date.parse(lastMatchAt) > 7 * 86_400_000;
}

export async function readHkexCursorState(supabase: SupabaseClient): Promise<HkexCursorState> {
  return (await readSyncCursor<HkexCursorState>(supabase, HKEX_SIGNALS_CURSOR)).state;
}
