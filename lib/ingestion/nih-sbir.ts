/**
 * NIH SBIR / STTR awards as a program source (Search & Evaluation, Nov 2026).
 *
 * Small-business grants are often the only public record of a private biotech's preclinical
 * program: the grant title or abstract names the development code ("IND-enabling studies of
 * IN-002, an inhaled muco-trapping mAb ..."). NIH RePORTER is free, keyless and structured.
 *
 * Source   POST https://api.reporter.nih.gov/v2/projects/search (no key; ~1 request/s asked;
 *          limit 500, offset < 15,000). Activity codes R41/R42 (STTR), R43/R44 (SBIR), U43/U44,
 *          SB1 (commercialization readiness). ~1,800-2,200 awards per fiscal year, ~8,200
 *          distinct core projects in FY2016/19/22/24/25 together.
 * Rules    no model. A code is a program when it is in the grant title, or appears at least
 *          three times in the abstract, or twice next to "our / novel / lead / proprietary"
 *          wording; target, gene, cell-line, assay and big-pharma tool-compound codes are
 *          stop-listed; at most three codes per grant. Grants about devices, diagnostics or
 *          software are skipped. Sampled Nov 2026: 652 codes in 606 projects (5 fiscal years);
 *          hand check 33/40 real before the stop-list additions in this file (misses: SN-38,
 *          Hsp90, TH17, ADAMTS13, Th40, PF-739, HN001 — all now excluded).
 * Writes   through persistPrograms (lib/ingestion/preclinical-pipeline.ts): matching existing
 *          programs of the company, the cross-company code guard, preclinical rows (and Phase 1-3
 *          rows whose code no company carries) with disclosure_url = the RePORTER project page and
 *          a verbatim title/abstract excerpt; every program lands in asset_disclosures.
 * Owner    the awardee organization, resolved with lib/entities/resolve (exact / alias / fuzzy
 *          >= 0.93), else created as an industry company (data_sources ['nih_reporter']).
 * Cursor   radar_sync_cursors 'nih_sbir' {fy, offset}: FY2008 -> current FY, then done; after the
 *          backfill the two latest fiscal years are re-read weekly.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';
import { readSyncCursor, writeSyncCursor } from '@/lib/radar/sync-cursor';
import { resolveCompany } from '@/lib/entities/resolve';
import { INDICATION_CATEGORIES, MODALITIES, THERAPEUTIC_AREAS } from '@/lib/radar/classify-prompt';
import { inferIndicationFromConditions } from '@/lib/ingestion/clinical-trials';
import { deriveTA } from '@/lib/radar/asset-universe';
import { persistPrograms, type DisclosedProgram, type DisclosedStage, type FilingContext } from './preclinical-pipeline';

export const NIH_REPORTER_URL = 'https://api.reporter.nih.gov/v2/projects/search';
export const SBIR_ACTIVITY_CODES = ['R41', 'R42', 'R43', 'R44', 'U43', 'U44', 'SB1'];
export const FIRST_FISCAL_YEAR = 2008;
export const PAGE_LIMIT = 500;
export const SYNC_SOURCE = 'nih_sbir';
export const RULES_VERSION = 'rules:nih-sbir-v1';
const USER_AGENT = 'SolidusResearch/1.0 (+https://solidus.ambrosiaventures.co)';
const MAX_CODES_PER_GRANT = 3;
const REWALK_DAYS = 7;

export interface ReporterProject {
  appl_id: number;
  project_num: string;
  core_project_num?: string | null;
  project_title?: string | null;
  abstract_text?: string | null;
  fiscal_year?: number | null;
  activity_code?: string | null;
  project_start_date?: string | null;
  award_notice_date?: string | null;
  organization?: { org_name?: string | null; org_country?: string | null; org_state?: string | null; org_city?: string | null } | null;
}

// ─── Code extraction ────────────────────────────────────────────────────────

const CODE_RE = /(?<![A-Za-z0-9-])([A-Z][A-Za-z]{0,5}(?:-[A-Z])?[- ]?\d{2,7}[A-Za-z]{0,2})(?![A-Za-z0-9])/g;

/** Letter prefixes that name targets, genes, pathogens, cell lines, assays, agencies or diseases, never a company's product. */
const STOP_PREFIX = new Set(`
R U SB P PA RFA NOT IL CD HIV SIV FY NIH NCI NIAID FDA IND NDA ISO USB PD PDL HPV H N ALS AAV GLP PET MRI BMI CT IV II III
ICD DSM SF EQ BRCA TNF TGF VEGF VEGFR EGFR HER KRAS NRAS TP APOE MMP CXCR CXCL CCR CCL TLR STING HLA MHC GPR COX JAK BTK PI
MEK BRAF CDK PARP BCL MCL PSMA FGFR ALK ROS RET MET CYP ABCA SMN DMD CFTR HSV CMV EBV RSV HBV HCV ZIKV LPS ATP NAD DNA RNA
PCR ELISA GMP ADME IC EC ED LD NHP USA US UK EU AUC PK SARS COVID MERS MIC MBC LC HPLC MS NMR UV IR SD OD HEK HEPG MDA PC
LNCAP SH SHSY HT HCT SW MCF MOLM THP K HL JURKAT RAW C B T M S PS APP SOD SNCA LRRK TDP FUS HTT MAPT GBA NPC CLN MPS GAA
FXN PMP MFN HD SMA DM FXS KO WT ATCC BSL ABSL QPCR RT SNP GWAS MOI TCID PFU CFU LOD LOQ CMC QC QA TRL SBIR STTR NSF DOD
DARPA BARDA CDC WHO OECD ICH CFR HHS AHRQ NIDA NIAAA NIMH NINDS NHLBI NIDDK NIA NICHD NEI NIDCR NIBIB NCATS NIGMS NIEHS NLM
CTSA FEV COPD GERD IBD IBS NASH NAFLD MASH CKD ESRD AKI ARDS TBI PTSD ADHD OCD MDD GAD ASD OUD AUD SUD AD RA SLE CF SCD AML
CML CLL NHL MM GBM NSCLC SCLC HCC CRC PDAC TNBC RCC OS DIPG MPM WT PRAME NY MAGE GD ROR CEA CA MUC EPCAM TROP CLDN GPC DLL
BCMA FCRH SLAMF GPRC CS GM LAG TIM CTLA OX ICOS GITR NKG KIR NK CAR TCR ADC PROTAC ASO SIRNA MIRNA MRNA LNP VLP OMV MSC IPSC
ESC HSC NSC EPC OPC HSP TH ADAMTS SN HN PF BMS MK LY GSK AZD JNJ RO BAY ABT GS AMG SAR TAK PFE NVS SCH CGP BIBR BIBF TTR
STAT NF HIF PGE MCP MIP KI EGF FGF PDGF IGF BMP WNT SHH TRP TRPV TRPA NAV KV CAV GABA NMDA AMPA MGLU ALDH SIRT HDAC DNMT
BET BRD EZH LSD PRMT KAT USP UCH NEDD MDM PAK ROCK AKT ERK JNK MAPK IKK IRAK RIPK NLRP ASC GSDM CASP BAX BAK BID BIM PUMA
MLKL ZBP TBK IRF IFN IFNAR IFNG IFNL CCND CDKN RB MYC MYCN SOX OCT KLF NANOG LIN PAX FOX GATA RUNX HOX ETS ERG ETV EWS SYT
PLA PLC PLD PKA PKC PKG PDE AC GC NOS SOD CAT GPX PRDX TXN NRF KEAP HMOX NQO GST UGT SULT ABC SLC OAT OATP OCTN MATE BCRP
MDR MRP PGP LRP LDLR PCSK ANGPTL APOB APOC LPA LP CETP HMGCR NPC SREBP PPAR LXR FXR TGR GLP GIP GCG GCGR SGLT DPP INS INSR
ISG UL TRIM FKBP RPS RPL RAD MED KRT CDH ALOX TMEM UNC RAB CARD PEG RDH MEGF GRIM PSMB TOMM ADAM CX PSD RPE ZAP NSP VP EV COV
O ST TC YF HFA PHS CRM QS AS LL ML MOG AG GDF SUV TNFRSF EBA DAY MAB AAVRH ERGIC GRP CRY GFP HB HP SM SP CC CB GA GE PG PM PL
LAMH SCR HEX DUP EMM WB NGB SPX LWACAS KD AMD PLX FK VX TMC WP CCG URB HA BDE AT ABS TG GL SR LU PB TL IO NE DA HH AMP
`.trim().split(/\s+/));

/** Whole tokens that are tool compounds, strains, models or metabolites seen in grant abstracts. */
const STOP_EXACT = new Set([
  'Y27632', 'SB203580', 'LY294002', 'U0126', 'MK801', 'SR141716', 'RV144', 'P450', 'S100B', 'GRP78', 'TAG72', 'DEC205', 'MIC90',
  'APP695', 'C57BL', 'TG2576', '5XFAD', 'COVID19', 'H1N1', 'H5N1', 'H7N9', 'PR8', 'HEK293', 'A549', 'U87', 'HEPG2', 'VEROE6',
  'SN38', 'HSP90', 'TH17', 'TH40', 'TH1', 'TH2', 'ADAMTS13', 'HN001', 'PF739', 'KI67', 'MTORC1', 'T705', 'GS441524', 'JQ1',
  'DMSO', 'PBS', 'BSA', 'FBS', 'TRITONX100', 'TWEEN80', 'PEG400', 'PEG2000', 'H9C2', 'CHO', 'HELA', 'MCF7', 'PC3', 'DU145',
  'MDAMB231', 'SKOV3', 'OVCAR3', 'HCT116', 'SW480', 'CACO2', 'BV2', 'N2A', 'SHSY5Y', 'NCI60', 'BALB', 'NOD', 'NSG', 'C3H',
]);

const PROGRAM_CONTEXT_RE = /(lead|candidate|compound|molecule|drug|therapeutic|antibody|vaccine|formulation|inhibitor|agonist|antagonist|prodrug|peptide|analog|oligonucleotide|construct|gene therapy|biologic|agent|product)/i;
const OWNERSHIP_RE = /\b(our|novel|proprietary|we (?:have )?(?:developed|discovered|identified|designed|invented)|first-in-class|lead|IND)\b/i;
export const THERAPEUTIC_RE = /\b(drugs?|compounds?|small molecules?|antibod\w*|inhibitors?|agonists?|antagonists?|therapeutics?|therap(?:y|ies)|vaccines?|gene therap\w*|peptides?|oligonucleotides?|siRNAs?|lead candidates?|IND[- ]enabling|clinical candidates?|formulations?|prodrugs?)\b/i;
export const NON_DRUG_TITLE_RE = /\b(device|sensor|imaging system|software|app\b|platform for (?:screening|detection)|diagnostic|assay|biomarker detection|microscope|catheter|needle system|wearable|mobile|smartphone|telehealth|training|curriculum)\b/i;

export function normalizeCode(code: string): string {
  return code.toUpperCase().replace(/[- ]/g, '');
}

export function isCandidateCode(code: string): boolean {
  const norm = normalizeCode(code);
  if (STOP_EXACT.has(norm)) return false;
  const prefix = (/^[A-Za-z]+/.exec(code)?.[0] ?? '').toUpperCase();
  if (!prefix || STOP_PREFIX.has(prefix)) return false;
  // One letter needs a long number ("K12" is a grant or a gene; "Q301" is a product).
  if (prefix.length === 1 && !/\d{3,}/.test(code)) return false;
  // Mixed-case words with digits are genes/proteins/cell types (Hsp90, Th40) unless short-prefixed (Up284).
  if (/^[A-Z][a-z]{3,}/.test(code)) return false;
  // Bare years.
  if (/^\D*(19|20)\d\d$/.test(code)) return false;
  // Radionuclides (I-124, Lu-177, Tc-99m, Ga 68, Zr-89).
  if (/^(I|Lu|Tc|Ga|Zr|Cu|Pb|Sr|Y|In|F|C|Ac|At|Bi|Ra|Th|Sm|Re|Ho|Tb|Xe)[- ]?\d{1,3}m?$/.test(code)) return false;
  // Point mutations and residues (V600E, Y175L, F508).
  if (/^[A-Z]\d{2,4}[A-Z]?$/.test(code)) return false;
  return true;
}

/** Mixed-case tokens (Cx43, Ag85B, Nsp14, ShK-186) count only in the grant title. */
function isMixedCase(code: string): boolean {
  return /^[A-Z][a-z]/.test(code);
}

export interface ExtractedCode {
  code: string;
  source: 'title' | 'abstract';
  quote: string;
}

function occurrences(text: string, code: string): RegExpExecArray[] {
  const re = new RegExp(`(?<![A-Za-z0-9-])${code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z0-9])`, 'g');
  const out: RegExpExecArray[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) out.push(m);
  return out;
}

/** The sentence around an occurrence, verbatim, at most 600 characters. */
export function sentenceAround(text: string, index: number): string {
  const start = Math.max(text.lastIndexOf('. ', index) + 1, index - 400, 0);
  const endDot = text.indexOf('. ', index);
  const end = Math.min(endDot >= 0 ? endDot + 1 : text.length, index + 400, text.length);
  return text.slice(start, end).replace(/\s+/g, ' ').trim().slice(0, 600);
}

export function extractCodes(project: Pick<ReporterProject, 'project_title' | 'abstract_text'>): ExtractedCode[] {
  const title = (project.project_title ?? '').replace(/\s+/g, ' ').trim();
  const abstract = (project.abstract_text ?? '').replace(/\s+/g, ' ').trim();
  if (!THERAPEUTIC_RE.test(`${title} ${abstract.slice(0, 1500)}`) || NON_DRUG_TITLE_RE.test(title)) return [];
  const found = new Map<string, ExtractedCode>();
  for (const m of title.matchAll(CODE_RE)) {
    const code = m[1];
    if (!isCandidateCode(code)) continue;
    const key = normalizeCode(code);
    if (!found.has(key)) found.set(key, { code, source: 'title', quote: title.slice(0, 600) });
  }
  const seen = new Set<string>();
  for (const m of abstract.matchAll(CODE_RE)) {
    const code = m[1];
    const key = normalizeCode(code);
    if (found.has(key) || seen.has(key) || !isCandidateCode(code) || isMixedCase(code)) continue;
    seen.add(key);
    const hits = occurrences(abstract, code);
    const framed = hits.some(h => PROGRAM_CONTEXT_RE.test(abstract.slice(Math.max(0, h.index - 60), h.index + code.length + 60))
      && OWNERSHIP_RE.test(abstract.slice(Math.max(0, h.index - 120), h.index + code.length + 60)));
    if (hits.length >= 3 || (hits.length >= 2 && framed)) {
      found.set(key, { code, source: 'abstract', quote: sentenceAround(abstract, hits[0].index) });
    }
  }
  const all = [...found.values()];
  if (all.length <= MAX_CODES_PER_GRANT) return all;
  // A grant listing many codes is a screening campaign; keep only what the title names.
  return all.filter(c => c.source === 'title').slice(0, MAX_CODES_PER_GRANT);
}

// ─── Program shaping ────────────────────────────────────────────────────────

const GRANT_PHASE_RE = /\bphase (?:1|2|i|ii)\s*(?:sbir|sttr|grant|award|application|project|proposal|funding|aims?|period|work|research|effort|of (?:this|the))/gi;

/**
 * Development stage from the grant wording. "Phase I/II" in a grant is usually the SBIR award
 * phase, and abstracts mention patients in the disease background, so a clinical phase is read
 * from the TITLE only (with trial wording next to it); the abstract can only move a program
 * within preclinical.
 */
export function stageOf(title: string, abstract = ''): DisclosedStage {
  const t = title.replace(GRANT_PHASE_RE, ' ');
  const all = `${t} ${abstract.replace(GRANT_PHASE_RE, ' ')}`;
  const preclinicalTitle = /\bpre-?clinical|non-?clinical|IND[- ]enabling/i.test(t);
  if (!preclinicalTitle && /\bphase (?:2|ii)[ab]?\b[^.;]{0,60}\b(?:trial|study)\b/i.test(t)) return 'phase_2';
  if (!preclinicalTitle && (/\bphase (?:1|i)[ab]?\b[^.;]{0,60}\b(?:trial|study)\b/i.test(t) || /first[- ]in[- ]human/i.test(t))) return 'phase_1';
  if (/IND[- ]enabling|IND filing|IND submission|pre-?IND|GLP tox/i.test(all)) return 'ind_enabling';
  if (/lead optimi[sz]ation|hit[- ]to[- ]lead|structure[- ]activity/i.test(all)) return 'lead_optimization';
  return 'preclinical';
}

const MODALITY_RULES: Array<[RegExp, string]> = [
  [/\bantibody[- ]drug conjugate|\bADC\b/i, 'adc'],
  [/\bbispecific/i, 'bispecific'],
  [/\bCAR[- ]?T\b/i, 'car_t'],
  [/\b(monoclonal antibod|mAbs?\b|antibod|nanobod)/i, 'antibody'],
  [/\b(cell therap|stem cell|T[- ]cell therap)/i, 'cell_therapy'],
  [/\b(gene therap|AAV|lentivir|gene editing|CRISPR)/i, 'gene_therapy'],
  [/\bmRNA\b/, 'mrna'],
  [/\b(siRNA|antisense|oligonucleotide|ASO\b)/i, 'oligonucleotide'],
  [/\b(radioligand|radiopharm|radiotherap\w* agent|\[\d{2,3}[A-Z][a-z]?\])/i, 'radiopharm'],
  [/\bvaccine/i, 'vaccine'],
  [/\bpeptide/i, 'peptide'],
  [/\b(small[- ]molecule|inhibitors?|agonists?|antagonists?|compounds?|prodrugs?)\b/i, 'small_molecule'],
];

export function modalityOf(text: string): string | null {
  for (const [re, m] of MODALITY_RULES) if (re.test(text)) return MODALITIES.includes(m) ? m : null;
  return null;
}

export function toPrograms(project: ReporterProject): DisclosedProgram[] {
  const title = project.project_title ?? '';
  const text = `${title} ${project.abstract_text ?? ''}`;
  const codes = extractCodes(project);
  if (codes.length === 0) return [];
  const ind = inferIndicationFromConditions([title]);
  const category = ind.category && INDICATION_CATEGORIES.includes(ind.category as (typeof INDICATION_CATEGORIES)[number]) ? ind.category : null;
  const ta = deriveTA(category);
  const stage = stageOf(title, project.abstract_text ?? '');
  return codes.map(c => ({
    program_name: c.code.slice(0, 80),
    aliases: [],
    stage,
    target: null,
    target_class: null,
    modality: modalityOf(text),
    therapeutic_area: ta && THERAPEUTIC_AREAS.includes(ta) ? ta : null,
    indication_category: category,
    indication_specific: ind.specific ? ind.specific.slice(0, 60) : null,
    mechanism_short: null,
    partnered: false,
    partner_name: null,
    evidence_quote: c.quote,
    // Title codes are the grant's subject; repeated abstract codes are a notch less certain.
    confidence: c.source === 'title' ? 85 : 70,
  }));
}

// ─── Fetching ───────────────────────────────────────────────────────────────

export function reporterProjectUrl(applId: number | string): string {
  return `https://reporter.nih.gov/project-details/${applId}`;
}

export function buildSearchBody(fiscalYear: number, offset: number, limit = PAGE_LIMIT) {
  return {
    criteria: { activity_codes: SBIR_ACTIVITY_CODES, fiscal_years: [fiscalYear] },
    include_fields: ['ApplId', 'ProjectNum', 'CoreProjectNum', 'ProjectTitle', 'AbstractText', 'FiscalYear', 'ActivityCode', 'ProjectStartDate', 'AwardNoticeDate', 'Organization'],
    offset,
    limit,
    sort_field: 'appl_id',
    sort_order: 'asc',
  };
}

export async function fetchSbirPage(fiscalYear: number, offset: number): Promise<{ total: number; results: ReporterProject[] }> {
  const res = await fetchWithTimeout(NIH_REPORTER_URL, {
    method: 'POST',
    timeoutMs: 60_000,
    retries: 2,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': USER_AGENT },
    body: JSON.stringify(buildSearchBody(fiscalYear, offset)),
  });
  if (!res.ok) throw new Error(`NIH RePORTER HTTP ${res.status}`);
  const json = (await res.json()) as { meta?: { total?: number }; results?: ReporterProject[] };
  return { total: json.meta?.total ?? 0, results: json.results ?? [] };
}

// ─── Company resolution ─────────────────────────────────────────────────────

const ORG_COUNTRY: Record<string, string> = { 'UNITED STATES': 'US', USA: 'US', CANADA: 'CA', 'UNITED KINGDOM': 'GB', ISRAEL: 'IL', AUSTRALIA: 'AU' };

export function displayOrgName(raw: string): string {
  const t = raw.replace(/\s+/g, ' ').trim();
  if (t !== t.toUpperCase()) return t;
  return t.toLowerCase()
    .replace(/(^|[\s\-/(&.])([a-z])/g, (_, pre, ch) => pre + ch.toUpperCase())
    .replace(/\b(Inc|Llc|Ltd|Corp|Co|Lp|Llp|Pbc)\b\.?/g, m => (m.replace('.', '').length <= 3 ? m.toUpperCase() : m))
    .replace(/\bLLC\b/g, 'LLC').replace(/\bINC\b/g, 'Inc').replace(/\bCORP\b/g, 'Corp');
}

export interface ResolvedOrg {
  id: string;
  name: string;
  created: boolean;
}

export async function resolveAwardee(
  supabase: SupabaseClient,
  org: NonNullable<ReporterProject['organization']>,
  cache: Map<string, ResolvedOrg | null>,
  dryRun: boolean,
): Promise<ResolvedOrg | null> {
  const raw = (org.org_name ?? '').trim();
  if (!raw) return null;
  const key = raw.toUpperCase();
  if (cache.has(key)) return cache.get(key) ?? null;
  const res = await resolveCompany(supabase, { name: raw });
  const m = res.match;
  if (m && (m.matchedOn === 'exact' || m.matchedOn === 'alias' || (m.matchedOn === 'fuzzy' && m.confidence >= 0.93))) {
    const hit = { id: m.id, name: m.canonicalName, created: false };
    cache.set(key, hit);
    return hit;
  }
  const name = displayOrgName(raw);
  if (dryRun) {
    const hit = { id: `dry:${key}`, name, created: true };
    cache.set(key, hit);
    return hit;
  }
  const country = ORG_COUNTRY[(org.org_country ?? '').toUpperCase()] ?? null;
  const row = {
    name,
    name_variations: [...new Set([raw, name])],
    data_sources: ['nih_reporter'],
    actively_acquiring: false,
    owner_type: 'industry',
    hq_country: country,
    headquarters_country: country,
    hq_region: country === 'US' || country === 'CA' ? 'north_america' : null,
    headquarters_region: country === 'US' || country === 'CA' ? 'north_america' : null,
  };
  const { data, error } = await supabase.from('companies').upsert(row, { onConflict: 'name' }).select('id, name').maybeSingle();
  if (error || !data) {
    cache.set(key, null);
    return null;
  }
  const hit = { id: String(data.id), name: String(data.name), created: true };
  cache.set(key, hit);
  return hit;
}

// ─── Run ────────────────────────────────────────────────────────────────────

export interface NihSbirCursor {
  fy: number;
  offset: number;
}

export interface NihSbirState extends Record<string, unknown> {
  backfill_completed_at?: string;
  last_completed_at?: string;
  /** core project numbers already decided (keeps re-reads of multi-year awards cheap). */
  done_core?: string[];
}

export function currentFiscalYear(now: Date): number {
  // NIH fiscal year starts Oct 1.
  return now.getUTCMonth() >= 9 ? now.getUTCFullYear() + 1 : now.getUTCFullYear();
}

export function parseNihCursor(cursor: string | null): NihSbirCursor | null {
  if (!cursor) return null;
  try {
    const c = JSON.parse(cursor) as Partial<NihSbirCursor>;
    if (typeof c.fy === 'number' && typeof c.offset === 'number') return { fy: c.fy, offset: c.offset };
  } catch {
    /* ignore */
  }
  return null;
}

/** Due when the backfill is unfinished, a walk is under way, or the weekly re-read of the latest two years is due. */
export function nihSbirDue(state: NihSbirState, cursor: string | null, now: Date): boolean {
  if (cursor) return true;
  if (!state.backfill_completed_at) return true;
  const last = Date.parse(state.last_completed_at ?? state.backfill_completed_at);
  return !Number.isFinite(last) || now.getTime() - last > REWALK_DAYS * 86_400_000;
}

export interface NihSbirRunOptions {
  timeBudgetMs?: number;
  dryRun?: boolean;
  now?: Date;
  /** Override the walk start (manual runs). */
  fiscalYear?: number;
}

export interface NihSbirRunResult {
  pages: number;
  projects: number;
  projectsWithCodes: number;
  programs: number;
  created: number;
  matched: number;
  foreignSkipped: number;
  companiesCreated: number;
  done: boolean;
  timedOut: boolean;
  cursor: string | null;
  errors: string[];
  sample: Array<{ company: string; code: string; stage: string; source: string; url: string }>;
}

export async function runNihSbir(supabase: SupabaseClient, opts: NihSbirRunOptions = {}): Promise<NihSbirRunResult> {
  const started = Date.now();
  const now = opts.now ?? new Date();
  const budget = opts.timeBudgetMs ?? 240_000;
  const dryRun = !!opts.dryRun;
  const out: NihSbirRunResult = { pages: 0, projects: 0, projectsWithCodes: 0, programs: 0, created: 0, matched: 0, foreignSkipped: 0, companiesCreated: 0, done: false, timedOut: false, cursor: null, errors: [], sample: [] };

  const row = await readSyncCursor<NihSbirState>(supabase, SYNC_SOURCE);
  const state: NihSbirState = { ...row.state };
  const lastFy = currentFiscalYear(now);
  const startFy = state.backfill_completed_at ? lastFy - 1 : FIRST_FISCAL_YEAR;
  let c: NihSbirCursor = opts.fiscalYear ? { fy: opts.fiscalYear, offset: 0 } : parseNihCursor(row.cursor) ?? { fy: startFy, offset: 0 };
  const doneCore = new Set(state.done_core ?? []);
  const cache = new Map<string, ResolvedOrg | null>();

  while (!out.timedOut) {
    if (Date.now() - started > budget) { out.timedOut = true; break; }
    if (c.fy > lastFy) { out.done = true; break; }
    let page: { total: number; results: ReporterProject[] };
    try {
      page = await fetchSbirPage(c.fy, c.offset);
    } catch (err) {
      out.errors.push(err instanceof Error ? err.message : String(err));
      break;
    }
    out.pages++;
    for (const p of page.results) {
      if (Date.now() - started > budget) { out.timedOut = true; break; }
      out.projects++;
      const core = p.core_project_num ?? p.project_num;
      if (doneCore.has(core)) continue;
      const programs = toPrograms(p);
      if (programs.length === 0 || !p.organization) { doneCore.add(core); continue; }
      out.projectsWithCodes++;
      try {
        const company = await resolveAwardee(supabase, p.organization, cache, dryRun);
        if (!company) { out.errors.push(`${core}: awardee not resolved (${p.organization.org_name})`); continue; }
        if (company.created) { out.companiesCreated++; company.created = false; }
        const url = reporterProjectUrl(p.appl_id);
        const date = (p.project_start_date ?? p.award_notice_date ?? `${p.fiscal_year ?? c.fy}-10-01`).slice(0, 10);
        out.programs += programs.length;
        for (const prog of programs) if (out.sample.length < 40) out.sample.push({ company: company.name, code: prog.program_name, stage: prog.stage, source: prog.confidence >= 85 ? 'title' : 'abstract', url });
        if (!dryRun) {
          const ctx: FilingContext = {
            company_id: company.id,
            company_name: company.name,
            form: 'nih_sbir',
            accession: core,
            filing_date: date,
            url,
            model: RULES_VERSION,
            now,
            origin: 'filing',
            dataSource: 'nih_reporter',
          };
          const r = await persistPrograms(supabase, ctx, programs, { createUnknownClinical: true, stampMatched: false });
          out.created += r.created.length;
          out.matched += r.matched;
          out.foreignSkipped += r.foreignSkipped;
          out.errors.push(...r.errors.slice(0, 3));
        }
        doneCore.add(core);
      } catch (err) {
        out.errors.push(`${core}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    if (out.timedOut) break;
    const nextOffset = c.offset + PAGE_LIMIT;
    c = nextOffset < Math.min(page.total, 15_000) && page.results.length > 0 ? { fy: c.fy, offset: nextOffset } : { fy: c.fy + 1, offset: 0 };
    await new Promise(r => setTimeout(r, 1_000));
  }

  out.cursor = out.done ? null : JSON.stringify(c);
  if (!dryRun && !opts.fiscalYear) {
    if (out.done) {
      state.last_completed_at = now.toISOString();
      state.backfill_completed_at ??= now.toISOString();
    }
    // Keep the decided-project memo bounded (the newest awards matter for re-reads).
    state.done_core = [...doneCore].slice(-20_000);
    await writeSyncCursor(supabase, SYNC_SOURCE, out.cursor, state);
  }
  return out;
}
