/**
 * Company-disclosed preclinical programs (Search & Evaluation).
 *
 * Trial registries only know a program once it has a registered trial, so
 * the module had no preclinical assets at all. Listed biotechs, however,
 * disclose every program in the pipeline section of their annual report.
 * This ingester walks industry companies with an SEC CIK, reads the latest
 * 10-K / 20-F (or S-1 / F-1 for a fresh IPO), sends the pipeline-relevant
 * paragraphs to claude-sonnet-5 with a structured-output schema, and:
 *
 *   - matches each extracted program to an existing clinical_assets row of
 *     the same company (name, alias or drug_master) and stamps the disclosure
 *     on it, filling target / mechanism only when they were empty;
 *   - creates a new clinical_assets row (asset_origin = 'filing', phase =
 *     'preclinical', stage_detail) for preclinical programs with no match;
 *   - never creates clinical-stage assets from a filing (a Phase 1 program
 *     missing from the registries is far more often a naming mismatch than a
 *     new program); those land in asset_disclosures as unmatched_clinical.
 *
 * Invariants: no asset is written without a verbatim excerpt (checked
 * against the filing text after whitespace folding), the filing URL and the
 * filing date. Registry-derived phase is never changed by a filing. Spend is
 * capped per run (PRECLINICAL_COST_CAP_USD) and reported in the run log.
 *
 * Writes: clinical_assets (migration 139 columns), asset_disclosures.
 * Cursor: radar_sync_cursors 'preclinical_pipeline' with the company walk
 * position and the accession already processed per company.
 */

import { budgetCap } from '@/lib/ai/budget';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';
import { readSyncCursor, writeSyncCursor } from '@/lib/radar/sync-cursor';
import { normalizeKey } from '@/lib/radar/drug-name';
import {
  INDICATION_CATEGORIES,
  MODALITIES,
  TARGET_CLASSES,
  THERAPEUTIC_AREAS,
  findUnsupportedKeywords,
} from '@/lib/radar/classify-prompt';
import {
  addUsage,
  emptyUsage,
  foldWhitespace,
  htmlToText,
  usageCostUsd,
  type IntentClient,
  type TokenUsage,
} from './management-intent';
import { fetchSubmissions, listRecentFilings, secUserAgent, stripCik, type FilingRef } from './company-financials';

// ═══════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════

export const PRECLINICAL_MODEL = 'claude-sonnet-5';
export const PROMPT_VERSION = 'preclinical-v1';
const SYNC_SOURCE = 'preclinical_pipeline';
const DEFAULT_TIME_BUDGET_MS = 240_000;
const DEFAULT_COMPANY_LIMIT = 12;
const DEFAULT_COST_CAP_USD = 5;
/** Annual reports first; a registration statement only for companies with no annual report yet. */
export const ANNUAL_FORMS = new Set(['10-K', '10-K/A', '10-KT', '20-F', '20-F/A', '40-F']);
export const REGISTRATION_FORMS = new Set(['S-1', 'S-1/A', 'F-1', 'F-1/A']);
/** Filings older than this are still read (better than nothing) but flagged stale by QA. */
export const FILING_MAX_AGE_DAYS = 548;
const MAX_PARAGRAPHS = 140;
const MAX_SECTION_CHARS = 60_000;
const MIN_PARAGRAPH_CHARS = 25;
const MAX_PARAGRAPH_CHARS = 1_500;
export const MAX_EXCERPT_CHARS = 600;
const MAX_OUTPUT_TOKENS = 12_000;
const MAX_PROGRAMS_PER_FILING = 80;
const SEC_FETCH_TIMEOUT_MS = 45_000;
/** New filing-origin rows start with this data-completeness score (no trial, one citation). */
export const FILING_ASSET_CONFIDENCE = 45;
export const DISCLOSURE_SOURCE = 'sec_filing';

export const STAGES = [
  'discovery', 'lead_optimization', 'ind_enabling', 'preclinical',
  'phase_1', 'phase_1_2', 'phase_2', 'phase_2_3', 'phase_3', 'approved',
  'discontinued', 'unknown',
] as const;
export type DisclosedStage = (typeof STAGES)[number];
export const PRECLINICAL_STAGES: ReadonlySet<DisclosedStage> = new Set(['discovery', 'lead_optimization', 'ind_enabling', 'preclinical']);

/** Paragraphs worth sending: stage words, program words, modality words, code names. */
export const PIPELINE_KEYWORD_RE =
  /\b(pre-?clinical|IND[- ]enabling|investigational new drug|discovery(?:-stage)?|lead (?:optimi[sz]ation|candidate|series)|development candidate|product candidates?|drug candidates?|candidate (?:selection|nomination)|nominat(?:ed|ion)|pipeline|programs?\b|in vivo|in vitro|GLP|toxicolog\w*|first[- ]in[- ]human|proof[- ]of[- ]concept|antibod(?:y|ies)|small[- ]molecule|gene (?:therapy|editing)|cell therap\w*|mRNA|oligonucleotide|antisense|siRNA|ADC|antibody[- ]drug conjugate|bispecific|degrader|PROTAC|inhibitor|agonist|antagonist|modulator|vaccine|radioligand|peptide)\b/i;
const CODE_NAME_RE = /\b[A-Z]{2,5}[- ]?\d{2,5}[A-Z]?\b/;
const RISK_FACTOR_RE = /\b(there can be no assurance|we may (?:not|be unable)|if we (?:are unable|fail)|could adversely|no assurance)\b/i;

// ═══════════════════════════════════════════════════════════════════════
// SCHEMA
// ═══════════════════════════════════════════════════════════════════════

const clipped = (max: number) => z.string().trim().transform(s => s.slice(0, max));
const nullableClipped = (max: number) =>
  z.string().trim().transform(s => s.slice(0, max)).nullable().transform(v => (v === '' ? null : v));
const vocabOrNull = (values: readonly string[]) =>
  z.string().nullable().transform(v => (v && values.includes(v) ? v : null));

export const DisclosedProgramSchema = z.object({
  program_name: clipped(80),
  aliases: z.array(clipped(60)).transform(a => a.filter(Boolean).slice(0, 6)),
  stage: z.string().transform(s => (STAGES.includes(s as DisclosedStage) ? (s as DisclosedStage) : 'unknown')),
  target: nullableClipped(60),
  target_class: vocabOrNull(TARGET_CLASSES),
  modality: vocabOrNull(MODALITIES),
  therapeutic_area: vocabOrNull(THERAPEUTIC_AREAS),
  indication_category: vocabOrNull(INDICATION_CATEGORIES),
  indication_specific: nullableClipped(60),
  mechanism_short: nullableClipped(80),
  partnered: z.boolean(),
  partner_name: nullableClipped(80),
  evidence_quote: clipped(MAX_EXCERPT_CHARS),
  confidence: z.number().int().transform(n => Math.max(0, Math.min(100, n))),
});
export type DisclosedProgram = z.infer<typeof DisclosedProgramSchema>;
export const DisclosedResponseSchema = z.object({ programs: z.array(DisclosedProgramSchema) });

/** Structured-output schema (the API rejects minimum/maximum/maxLength; zod enforces those). */
export function buildOutputJsonSchema(): Record<string, unknown> {
  // Same shape the classifier uses: the validator rejects `enum` next to a type
  // union ("Enum value 'enzyme' does not match declared type ['string','null']").
  const nullableString = { type: ['string', 'null'] };
  const nullableEnum = (values: readonly string[]) => ({ anyOf: [{ type: 'string', enum: [...values] }, { type: 'null' }] });
  return {
    type: 'object',
    additionalProperties: false,
    required: ['programs'],
    properties: {
      programs: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: [
            'program_name', 'aliases', 'stage', 'target', 'target_class', 'modality', 'therapeutic_area',
            'indication_category', 'indication_specific', 'mechanism_short', 'partnered', 'partner_name',
            'evidence_quote', 'confidence',
          ],
          properties: {
            program_name: { type: 'string' },
            aliases: { type: 'array', items: { type: 'string' } },
            stage: { type: 'string', enum: [...STAGES] },
            target: nullableString,
            target_class: nullableEnum(TARGET_CLASSES),
            modality: nullableEnum(MODALITIES),
            therapeutic_area: nullableEnum(THERAPEUTIC_AREAS),
            indication_category: nullableEnum(INDICATION_CATEGORIES),
            indication_specific: nullableString,
            mechanism_short: nullableString,
            partnered: { type: 'boolean' },
            partner_name: nullableString,
            evidence_quote: { type: 'string' },
            confidence: { type: 'integer' },
          },
        },
      },
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════
// PROMPT
// ═══════════════════════════════════════════════════════════════════════

export const SYSTEM_PROMPT = `You extract a biopharma company's own drug pipeline from numbered paragraphs of its SEC annual report (10-K / 20-F) or registration statement (S-1 / F-1). Return every distinct program the FILER itself is developing or has disclosed, with its development stage as stated in the filing.

Fields:
- program_name: the name the filing uses (development code like "ABC-123", an INN, or a descriptive name such as "KRAS G12D inhibitor program" when no code is given). One entry per program; merge duplicates and put other names in aliases.
- aliases: other names for the same program in the text (codes, INN, brand). Empty list if none.
- stage, exactly one of: discovery (target validation / hit finding / no lead yet), lead_optimization, ind_enabling (IND-enabling or GLP toxicology studies, "IND expected", "IND-enabling"), preclinical (preclinical but the sub-stage is not stated), phase_1, phase_1_2, phase_2, phase_2_3, phase_3, approved, discontinued, unknown. Use the most advanced stage the filing states for that program anywhere in the text; if the only mention is "Phase 1/2" use phase_1_2.
- target: the molecular target as written (gene/protein, e.g. "KRAS G12D", "IL-23p19", "TL1A"); null when the filing gives none.
- target_class: enzyme, gpcr, ion_channel, transporter, kinase, nuclear_receptor, cytokine, antigen, or null. Choose only when the target makes it clear.
- modality: one of the listed values, or null. small_molecule, antibody, bispecific, adc, car_t, cell_therapy, gene_therapy, mrna, peptide, oligonucleotide, radiopharm, vaccine, protein, other.
- therapeutic_area / indication_category: choose from the listed values or null. indication_specific: the disease as named (<= 60 chars) or null.
- mechanism_short: <= 80 characters, e.g. "oral KRAS G12D inhibitor" or "anti-TL1A monoclonal antibody"; null if unknown.
- partnered: true only when the filing states the program is licensed to, partnered with, co-developed with, or optioned to another company. partner_name: that company, or null.
- evidence_quote: ONE sentence copied VERBATIM from the paragraphs that names the program and its stage (or the program alone if the stage appears in another paragraph). At most 600 characters. Do not paraphrase, do not stitch sentences.
- confidence 0-100: 90+ when the program name and stage are both explicit; 60-89 when the stage is inferred from context (e.g. "we expect to file an IND in 2026" -> ind_enabling); below 60 when uncertain.

Rules:
1. Only the filer's programs. Skip competitors' drugs, comparators, standard-of-care mentioned for context, in-licensed platform technologies without a named program, and programs described as discontinued (return them with stage discontinued instead).
2. Risk-factor hypotheticals ("if our product candidates fail...") are not disclosures; take names and stages from the Business / pipeline description.
3. Do not invent codes. When the filing describes a program only by target and indication, use a descriptive program_name and keep aliases empty.
4. A program with several indications is ONE program; put the lead indication in indication_specific.
5. Return {"programs": []} when the paragraphs describe no pipeline.

Output: a single JSON object {"programs": [...]} matching the schema. No prose.`;

export function buildUserMessage(company: string, form: string, filingDate: string, paragraphs: string[]): string {
  const body = paragraphs.map((p, i) => `[${i}] ${p}`).join('\n\n');
  return `Company: ${company}\nFiling: ${form} filed ${filingDate}\n\nParagraphs:\n\n${body}`;
}

// ═══════════════════════════════════════════════════════════════════════
// PURE HELPERS
// ═══════════════════════════════════════════════════════════════════════

/** Newest annual report; a registration statement only when there is no annual report at all. */
export function pickPipelineFiling(filings: FilingRef[]): FilingRef | null {
  const byDate = (a: FilingRef, b: FilingRef) => b.filingDate.localeCompare(a.filingDate);
  const annual = filings.filter(f => ANNUAL_FORMS.has(f.form) && f.primaryDocument).sort(byDate);
  if (annual.length > 0) return annual[0];
  const reg = filings.filter(f => REGISTRATION_FORMS.has(f.form) && f.primaryDocument).sort(byDate);
  return reg[0] ?? null;
}

export function filingDocumentUrl(cik: string, f: FilingRef): string {
  return `https://www.sec.gov/Archives/edgar/data/${stripCik(cik)}/${f.accessionNumber.replace(/-/g, '')}/${f.primaryDocument}`;
}

/**
 * Pipeline-relevant paragraphs in document order. Paragraphs between the
 * "Item 1. Business" and "Item 1A. Risk Factors" headings are preferred;
 * stage words and code names raise a paragraph, risk-factor phrasing lowers
 * it. Short table rows ("ABC-123 | KRAS | Preclinical") are kept when they
 * carry a code name or a stage word.
 */
export function extractPipelineParagraphs(text: string, max = MAX_PARAGRAPHS, maxChars = MAX_SECTION_CHARS): string[] {
  const chunks: string[] = [];
  const ITEM_HEADING_RE = /^(?:part i+\b.*)?item\s*\d+[a-z]?\b/i;
  for (const block of (text ?? '').split(/\n\s*\n/)) {
    const folded = foldWhitespace(block);
    // Item headings are short but anchor the Business / Risk Factors sections.
    if (folded.length < MIN_PARAGRAPH_CHARS && !ITEM_HEADING_RE.test(folded)) continue;
    if (folded.length <= MAX_PARAGRAPH_CHARS) {
      chunks.push(folded);
      continue;
    }
    let window = '';
    for (const sentence of folded.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g) ?? [folded]) {
      if (window.length + sentence.length > MAX_PARAGRAPH_CHARS && window) {
        chunks.push(window.trim());
        window = '';
      }
      window += sentence;
    }
    if (window.trim().length >= MIN_PARAGRAPH_CHARS) chunks.push(window.trim());
  }

  const isHeading = (c: string, re: RegExp) => c.length < 120 && re.test(c);
  const businessIdx = chunks.findIndex(c => isHeading(c, /^(?:part i\b.*)?item\s*1\.?\s*[-–—:]?\s*business\b/i));
  const riskIdx = chunks.findIndex((c, i) => i > businessIdx && isHeading(c, /^item\s*1a\.?\s*[-–—:]?\s*risk factors\b/i));

  const scored: Array<{ text: string; score: number; idx: number }> = [];
  chunks.forEach((c, idx) => {
    if (!PIPELINE_KEYWORD_RE.test(c) && !CODE_NAME_RE.test(c)) return;
    let score = 0;
    if (/\b(pre-?clinical|IND[- ]enabling|lead optimi[sz]ation|discovery(?:-stage)?|development candidate|candidate (?:selection|nomination))\b/i.test(c)) score += 3;
    if (/\b(product candidates?|drug candidates?|pipeline|our programs?|lead program)\b/i.test(c)) score += 2;
    if (CODE_NAME_RE.test(c)) score += 2;
    if (/\b(target|mechanism|inhibitor|agonist|antagonist|antibody|degrader|modulator)\b/i.test(c)) score += 1;
    if (businessIdx >= 0 && idx > businessIdx && (riskIdx < 0 || idx < riskIdx)) score += 2;
    // Risk factors restate the pipeline hypothetically; the Business section is the disclosure.
    if (riskIdx >= 0 && idx > riskIdx) score -= 4;
    if (RISK_FACTOR_RE.test(c)) score -= 4;
    if (score <= 0) return;
    scored.push({ text: c, score, idx });
  });
  scored.sort((a, b) => b.score - a.score || a.idx - b.idx);

  const picked: typeof scored = [];
  let chars = 0;
  for (const s of scored) {
    if (picked.length >= max) break;
    if (chars + s.text.length > maxChars) continue;
    picked.push(s);
    chars += s.text.length;
  }
  picked.sort((a, b) => a.idx - b.idx);
  const seen = new Set<string>();
  return picked.map(p => p.text).filter(t => {
    const k = t.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** True when the quote appears verbatim (after whitespace folding) in any paragraph. */
export function quoteIsVerbatim(quote: string, paragraphs: string[]): boolean {
  const q = foldWhitespace(quote).toLowerCase();
  if (q.length < 12) return false;
  return paragraphs.some(p => foldWhitespace(p).toLowerCase().includes(q));
}

export function stageToPhase(stage: DisclosedStage): { phase: string | null; stage_detail: string | null } {
  if (PRECLINICAL_STAGES.has(stage)) return { phase: 'preclinical', stage_detail: stage };
  switch (stage) {
    case 'phase_1': case 'phase_1_2': case 'phase_2': case 'phase_2_3': case 'phase_3':
      return { phase: stage, stage_detail: null };
    case 'approved':
      return { phase: 'phase_4', stage_detail: null };
    default:
      return { phase: null, stage_detail: null };
  }
}

/** Keys under which a program can be matched to an existing asset or drug alias. */
export function programKeys(p: Pick<DisclosedProgram, 'program_name' | 'aliases'>): string[] {
  const out = new Set<string>();
  for (const s of [p.program_name, ...p.aliases]) {
    const k = normalizeKey(s);
    if (k.length >= 3) out.add(k);
  }
  return [...out];
}

export function programKey(p: Pick<DisclosedProgram, 'program_name'>): string {
  return normalizeKey(p.program_name) || p.program_name.trim().toLowerCase();
}

/** Programs the model returned twice (same key) collapse into the higher-confidence one. */
export function dedupePrograms(programs: DisclosedProgram[]): DisclosedProgram[] {
  const byKey = new Map<string, DisclosedProgram>();
  for (const p of programs) {
    const keys = programKeys(p);
    const hit = keys.map(k => byKey.get(k)).find(Boolean);
    if (!hit) {
      for (const k of keys) byKey.set(k, p);
      continue;
    }
    if (p.confidence > hit.confidence) {
      const merged = { ...p, aliases: [...new Set([...p.aliases, hit.program_name, ...hit.aliases])].filter(a => normalizeKey(a) !== normalizeKey(p.program_name)).slice(0, 6) };
      for (const k of [...keys, ...programKeys(hit)]) byKey.set(k, merged);
    } else {
      for (const k of keys) byKey.set(k, hit);
    }
  }
  return [...new Set(byKey.values())];
}

export interface ExistingAsset {
  id: string;
  asset_name: string;
  asset_aliases: string[] | null;
  drug_master_id: string | null;
  phase: string | null;
  asset_origin: string | null;
  target: string | null;
  target_class: string | null;
  moa_short: string | null;
  mechanism: string | null;
  data_sources: string[] | null;
}

/** Existing asset of the same company for this program: by name/alias key, then by drug_master. */
export function matchExistingAsset(
  p: DisclosedProgram,
  existing: ExistingAsset[],
  drugIdForKey: Map<string, string>,
): { asset: ExistingAsset | null; drug_master_id: string | null } {
  const keys = programKeys(p);
  const byKey = new Map<string, ExistingAsset>();
  const byDrug = new Map<string, ExistingAsset>();
  for (const a of existing) {
    for (const s of [a.asset_name, ...(a.asset_aliases ?? [])]) {
      const k = normalizeKey(s);
      if (k && !byKey.has(k)) byKey.set(k, a);
    }
    if (a.drug_master_id && !byDrug.has(a.drug_master_id)) byDrug.set(a.drug_master_id, a);
  }
  const drugId = keys.map(k => drugIdForKey.get(k)).find(Boolean) ?? null;
  const direct = keys.map(k => byKey.get(k)).find(Boolean) ?? null;
  if (direct) return { asset: direct, drug_master_id: direct.drug_master_id ?? drugId };
  if (drugId && byDrug.has(drugId)) return { asset: byDrug.get(drugId)!, drug_master_id: drugId };
  return { asset: null, drug_master_id: drugId };
}

export interface FilingContext {
  company_id: string;
  company_name: string;
  form: string;
  accession: string;
  filing_date: string;
  url: string;
  model: string;
  now: Date;
}

export interface NewAssetRow {
  company_id: string;
  company_name: string;
  asset_name: string;
  asset_aliases: string[];
  mechanism: string | null;
  moa_short: string | null;
  target: string | null;
  target_class: string | null;
  modality: string | null;
  therapeutic_area: string | null;
  indication_category: string | null;
  indication_specific: string | null;
  indications_all: string[];
  phase: string;
  stage_detail: string | null;
  trial_status: null;
  nct_ids: string[];
  trial_count: number;
  enrollment_total: number;
  first_posted_date: string;
  last_update_date: string;
  partnership_status: 'partnered' | 'unpartnered';
  partner_company_name: string | null;
  partnership_basis: 'filing';
  partnership_evidence: Array<{ type: 'filing'; id: string; url: string; date: string; note: string }>;
  partnership_confidence: number;
  partnership_checked_at: string;
  ownership_status: 'originator';
  ownership_evidence: { rule: 'filing_disclosure'; accession: string; form: string };
  ownership_checked_at: string;
  owner_type: 'industry';
  data_sources: string[];
  confidence_score: number;
  classification_status: 'classified';
  classified_at: string;
  classification_confidence: number;
  classification_model: string;
  classification_evidence: { reason: 'filing_extraction'; prompt_version: string; accession: string; form: string };
  drug_master_id: string | null;
  drug_resolution_status: 'resolved' | 'unresolved';
  asset_origin: 'filing';
  disclosure_source_type: string;
  disclosure_accession: string;
  disclosure_url: string;
  disclosure_date: string;
  disclosure_excerpt: string;
  disclosed_last_seen_at: string;
}

/** A new preclinical asset from a disclosed program. Only for preclinical stages. */
export function toNewAssetRow(p: DisclosedProgram, ctx: FilingContext, drugMasterId: string | null): NewAssetRow | null {
  const { phase, stage_detail } = stageToPhase(p.stage);
  if (phase !== 'preclinical') return null;
  const nowIso = ctx.now.toISOString();
  return {
    company_id: ctx.company_id,
    company_name: ctx.company_name,
    asset_name: p.program_name,
    asset_aliases: p.aliases,
    mechanism: p.mechanism_short,
    moa_short: p.mechanism_short,
    target: p.target,
    target_class: p.target_class,
    modality: p.modality,
    therapeutic_area: p.therapeutic_area,
    indication_category: p.indication_category,
    indication_specific: p.indication_specific,
    indications_all: p.indication_specific ? [p.indication_specific] : [],
    phase,
    stage_detail,
    trial_status: null,
    nct_ids: [],
    trial_count: 0,
    enrollment_total: 0,
    first_posted_date: ctx.filing_date,
    last_update_date: ctx.filing_date,
    partnership_status: p.partnered ? 'partnered' : 'unpartnered',
    partner_company_name: p.partnered ? p.partner_name : null,
    partnership_basis: 'filing',
    partnership_evidence: p.partnered
      ? [{ type: 'filing', id: ctx.accession, url: ctx.url, date: ctx.filing_date, note: `${ctx.form}: ${p.partner_name ?? 'partner named in filing'}` }]
      : [],
    partnership_confidence: p.partnered ? 70 : 50,
    partnership_checked_at: nowIso,
    ownership_status: 'originator',
    ownership_evidence: { rule: 'filing_disclosure', accession: ctx.accession, form: ctx.form },
    ownership_checked_at: nowIso,
    owner_type: 'industry',
    data_sources: [DISCLOSURE_SOURCE],
    confidence_score: FILING_ASSET_CONFIDENCE,
    classification_status: 'classified',
    classified_at: nowIso,
    classification_confidence: p.confidence,
    classification_model: `${ctx.model}:filing`,
    classification_evidence: { reason: 'filing_extraction', prompt_version: PROMPT_VERSION, accession: ctx.accession, form: ctx.form },
    drug_master_id: drugMasterId,
    drug_resolution_status: drugMasterId ? 'resolved' : 'unresolved',
    asset_origin: 'filing',
    disclosure_source_type: ctx.form,
    disclosure_accession: ctx.accession,
    disclosure_url: ctx.url,
    disclosure_date: ctx.filing_date,
    disclosure_excerpt: p.evidence_quote.slice(0, MAX_EXCERPT_CHARS),
    disclosed_last_seen_at: ctx.filing_date,
  };
}

/** Patch for an existing asset: stamp the disclosure, fill empty classification fields, never touch phase. */
export function toExistingAssetPatch(p: DisclosedProgram, ctx: FilingContext, a: ExistingAsset): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    disclosure_source_type: ctx.form,
    disclosure_accession: ctx.accession,
    disclosure_url: ctx.url,
    disclosure_date: ctx.filing_date,
    disclosure_excerpt: p.evidence_quote.slice(0, MAX_EXCERPT_CHARS),
    disclosed_last_seen_at: ctx.filing_date,
  };
  const protectedRow = (a.data_sources ?? []).some(s => ['manual', 'curated', 'analyst'].includes(String(s).toLowerCase()));
  if (!protectedRow) {
    if (!a.target && p.target) patch.target = p.target;
    if (!a.target_class && p.target_class) patch.target_class = p.target_class;
    if (!a.moa_short && p.mechanism_short) patch.moa_short = p.mechanism_short;
    if (!a.mechanism && p.mechanism_short) patch.mechanism = p.mechanism_short;
  }
  // A filing-origin row may advance within preclinical (or into the clinic) as later filings say so.
  if (a.asset_origin === 'filing') {
    const { phase, stage_detail } = stageToPhase(p.stage);
    if (phase) {
      patch.phase = phase;
      patch.stage_detail = stage_detail;
      patch.last_update_date = ctx.filing_date;
    }
  }
  return patch;
}

export type MatchStatus = 'matched' | 'created' | 'unmatched_clinical' | 'skipped';

export interface DisclosureRow {
  company_id: string;
  asset_id: string | null;
  program_name: string;
  program_key: string;
  aliases: string[];
  stage: DisclosedStage;
  phase: string | null;
  target: string | null;
  target_class: string | null;
  modality: string | null;
  therapeutic_area: string | null;
  indication_category: string | null;
  indication_specific: string | null;
  mechanism_short: string | null;
  partnered: boolean;
  partner_name: string | null;
  source_type: string;
  source_id: string;
  source_url: string;
  disclosed_at: string;
  excerpt: string;
  confidence: number;
  model: string;
  match_status: MatchStatus;
  extracted_at: string;
}

export function toDisclosureRow(p: DisclosedProgram, ctx: FilingContext, assetId: string | null, status: MatchStatus): DisclosureRow {
  return {
    company_id: ctx.company_id,
    asset_id: assetId,
    program_name: p.program_name,
    program_key: programKey(p),
    aliases: p.aliases,
    stage: p.stage,
    phase: stageToPhase(p.stage).phase,
    target: p.target,
    target_class: p.target_class,
    modality: p.modality,
    therapeutic_area: p.therapeutic_area,
    indication_category: p.indication_category,
    indication_specific: p.indication_specific,
    mechanism_short: p.mechanism_short,
    partnered: p.partnered,
    partner_name: p.partner_name,
    source_type: ctx.form,
    source_id: ctx.accession,
    source_url: ctx.url,
    disclosed_at: ctx.filing_date,
    excerpt: p.evidence_quote.slice(0, MAX_EXCERPT_CHARS),
    confidence: p.confidence,
    model: ctx.model,
    match_status: status,
    extracted_at: ctx.now.toISOString(),
  };
}

// ═══════════════════════════════════════════════════════════════════════
// MODEL CALL
// ═══════════════════════════════════════════════════════════════════════

const OUTPUT_SCHEMA = buildOutputJsonSchema();

export function buildRequestParams(model: string, company: string, form: string, filingDate: string, paragraphs: string[]): Anthropic.MessageCreateParamsNonStreaming {
  return {
    model,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: buildUserMessage(company, form, filingDate, paragraphs) }],
    output_config: { format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
    thinking: { type: 'disabled' },
  };
}

export interface ExtractResult {
  programs: DisclosedProgram[];
  /** Programs dropped because their quote was not verbatim. */
  dropped: number;
  invalid: number;
  usage: TokenUsage;
  error: string | null;
}

export async function extractPrograms(
  client: IntentClient,
  model: string,
  company: string,
  form: string,
  filingDate: string,
  paragraphs: string[],
): Promise<ExtractResult> {
  const usage = emptyUsage();
  try {
    const msg = await client.messages.create(buildRequestParams(model, company, form, filingDate, paragraphs));
    addUsage(usage, msg.usage as unknown as Partial<TokenUsage>);
    if (msg.stop_reason === 'refusal') return { programs: [], dropped: 0, invalid: 0, usage, error: 'model refused the filing' };
    if (msg.stop_reason === 'max_tokens') return { programs: [], dropped: 0, invalid: 0, usage, error: 'response truncated at max_tokens' };
    const text = msg.content.find((b): b is Anthropic.TextBlock => b.type === 'text')?.text ?? '';
    const loose = z.object({ programs: z.array(z.record(z.string(), z.unknown())) }).safeParse(JSON.parse(text));
    if (!loose.success) return { programs: [], dropped: 0, invalid: 0, usage, error: `response is not {programs: [...]}: ${loose.error.message.slice(0, 160)}` };
    const kept: DisclosedProgram[] = [];
    let invalid = 0;
    let dropped = 0;
    for (const raw of loose.data.programs.slice(0, MAX_PROGRAMS_PER_FILING)) {
      const parsed = DisclosedProgramSchema.safeParse(raw);
      if (!parsed.success) { invalid++; continue; }
      if (!parsed.data.program_name || !quoteIsVerbatim(parsed.data.evidence_quote, paragraphs)) { dropped++; continue; }
      kept.push(parsed.data);
    }
    return { programs: dedupePrograms(kept), dropped, invalid, usage, error: null };
  } catch (err) {
    return { programs: [], dropped: 0, invalid: 0, usage, error: err instanceof Error ? err.message.split('\n')[0].slice(0, 300) : String(err) };
  }
}

// ═══════════════════════════════════════════════════════════════════════
// RUN
// ═══════════════════════════════════════════════════════════════════════

interface CursorState extends Record<string, unknown> {
  companyCursor: string | null;
  /** company_id -> accession already extracted. */
  filings: Record<string, string>;
}

export interface PreclinicalRunOptions {
  companyLimit?: number;
  costCapUsd?: number;
  timeBudgetMs?: number;
  model?: string;
  client?: IntentClient;
  now?: Date;
  /** Restrict to these company ids (manual re-runs); ignores the cursor. */
  companyIds?: string[];
  /** Re-read a filing even when the cursor says it was processed. */
  force?: boolean;
}

export interface PreclinicalRunResult {
  companiesProcessed: number;
  filingsRead: number;
  filingsSkippedSeen: number;
  programsExtracted: number;
  assetsCreated: number;
  assetsMatched: number;
  unmatchedClinical: number;
  disclosuresWritten: number;
  quotesDropped: number;
  schemaInvalid: number;
  usage: TokenUsage;
  costUsd: number;
  costCapUsd: number;
  costCapHit: boolean;
  timedOut: boolean;
  errors: string[];
  skipped: string | null;
  durationMs: number;
  /** company name -> programs created (for the run log). */
  sample: Array<{ company: string; form: string; created: string[]; matched: number }>;
}

interface CompanyRow { id: string; name: string; cik: string }

async function fetchExistingAssets(supabase: SupabaseClient, companyId: string): Promise<ExistingAsset[]> {
  const out: ExistingAsset[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase
      .from('clinical_assets')
      .select('id, asset_name, asset_aliases, drug_master_id, phase, asset_origin, target, target_class, moa_short, mechanism, data_sources')
      .eq('company_id', companyId)
      .order('id')
      .range(from, from + page - 1);
    if (error) throw new Error(`clinical_assets read: ${error.message}`);
    out.push(...((data ?? []) as ExistingAsset[]));
    if ((data ?? []).length < page) break;
  }
  return out;
}

async function lookupDrugIds(supabase: SupabaseClient, keys: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let i = 0; i < keys.length; i += 200) {
    const { data, error } = await supabase
      .from('drug_aliases')
      .select('drug_id, alias_normalized')
      .in('alias_normalized', keys.slice(i, i + 200));
    if (error) throw new Error(`drug_aliases read: ${error.message}`);
    for (const r of (data ?? []) as Array<{ drug_id: string; alias_normalized: string }>) {
      if (!out.has(r.alias_normalized)) out.set(r.alias_normalized, r.drug_id);
    }
  }
  return out;
}

export async function runPreclinicalPipeline(
  supabase: SupabaseClient,
  opts: PreclinicalRunOptions = {},
): Promise<PreclinicalRunResult> {
  const started = Date.now();
  const now = opts.now ?? new Date();
  const budget = opts.timeBudgetMs ?? DEFAULT_TIME_BUDGET_MS;
  const costCap = opts.costCapUsd ?? budgetCap(process.env.PRECLINICAL_COST_CAP_USD, DEFAULT_COST_CAP_USD, 1);
  const model = opts.model ?? PRECLINICAL_MODEL;
  const usage = emptyUsage();
  const errors: string[] = [];
  const result: PreclinicalRunResult = {
    companiesProcessed: 0, filingsRead: 0, filingsSkippedSeen: 0, programsExtracted: 0, assetsCreated: 0, assetsMatched: 0,
    unmatchedClinical: 0, disclosuresWritten: 0, quotesDropped: 0, schemaInvalid: 0, usage, costUsd: 0, costCapUsd: costCap,
    costCapHit: false, timedOut: false, errors, skipped: null, durationMs: 0, sample: [],
  };
  const outOfTime = () => Date.now() - started > budget;
  const spent = () => usageCostUsd(usage);

  const unsupported = findUnsupportedKeywords(OUTPUT_SCHEMA);
  if (unsupported.length) {
    result.skipped = `skipped: output schema uses unsupported keywords (${unsupported.join(', ')})`;
    result.durationMs = Date.now() - started;
    return result;
  }

  let client = opts.client ?? null;
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      result.skipped = 'skipped: ANTHROPIC_API_KEY not set';
      result.durationMs = Date.now() - started;
      return result;
    }
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 2, timeout: 180_000 }) as unknown as IntentClient;
  }

  const cursor = await readSyncCursor<CursorState>(supabase, SYNC_SOURCE);
  const state: CursorState = {
    companyCursor: (cursor.state.companyCursor as string | null) ?? null,
    filings: { ...((cursor.state.filings as Record<string, string>) ?? {}) },
  };
  const manual = Array.isArray(opts.companyIds) && opts.companyIds.length > 0;

  // ── Company walk ───────────────────────────────────────────────────────
  const limit = opts.companyLimit ?? DEFAULT_COMPANY_LIMIT;
  const base = () => supabase
    .from('companies')
    .select('id, name, cik')
    .not('cik', 'is', null)
    .eq('owner_type', 'industry')
    .is('merged_into', null)
    .order('id', { ascending: true });
  let companies: CompanyRow[] = [];
  if (manual) {
    const { data, error } = await base().in('id', opts.companyIds!).limit(limit);
    if (error) errors.push(`companies read: ${error.message}`);
    companies = (data ?? []) as CompanyRow[];
  } else {
    let q = base().limit(limit);
    if (state.companyCursor) q = q.gt('id', state.companyCursor);
    const { data, error } = await q;
    if (error) errors.push(`companies read: ${error.message}`);
    companies = (data ?? []) as CompanyRow[];
    if (companies.length === 0 && state.companyCursor) {
      state.companyCursor = null;
      const again = await base().limit(limit);
      companies = (again.data ?? []) as CompanyRow[];
    }
  }

  for (const co of companies) {
    if (outOfTime()) { result.timedOut = true; break; }
    if (spent() >= costCap) { result.costCapHit = true; break; }
    if (!manual) state.companyCursor = co.id;
    result.companiesProcessed++;
    try {
      const sub = await fetchSubmissions(co.cik);
      const filing = sub ? pickPipelineFiling(listRecentFilings(sub)) : null;
      if (!filing) continue;
      if (!opts.force && state.filings[co.id] === filing.accessionNumber) { result.filingsSkippedSeen++; continue; }

      const url = filingDocumentUrl(co.cik, filing);
      const res = await fetchWithTimeout(url, {
        headers: { 'User-Agent': secUserAgent(), Accept: 'text/html,application/xhtml+xml' },
        timeoutMs: SEC_FETCH_TIMEOUT_MS,
        retries: 1,
      });
      if (!res.ok) { errors.push(`${co.name}: filing ${res.status}`); continue; }
      const paragraphs = extractPipelineParagraphs(htmlToText(await res.text()));
      result.filingsRead++;
      if (paragraphs.length === 0) { state.filings[co.id] = filing.accessionNumber; continue; }

      const ex = await extractPrograms(client, model, co.name, filing.form, filing.filingDate, paragraphs);
      addUsage(usage, ex.usage);
      result.quotesDropped += ex.dropped;
      result.schemaInvalid += ex.invalid;
      if (ex.error) { errors.push(`${co.name} ${filing.form}: ${ex.error}`); continue; }
      result.programsExtracted += ex.programs.length;

      const ctx: FilingContext = {
        company_id: co.id, company_name: co.name, form: filing.form, accession: filing.accessionNumber,
        filing_date: filing.filingDate, url, model, now,
      };
      const existing = await fetchExistingAssets(supabase, co.id);
      const drugIds = await lookupDrugIds(supabase, [...new Set(ex.programs.flatMap(programKeys))]);

      const disclosures: DisclosureRow[] = [];
      const newRows: NewAssetRow[] = [];
      const pending: Array<{ row: NewAssetRow; program: DisclosedProgram }> = [];
      const created: string[] = [];
      let matched = 0;
      for (const p of ex.programs) {
        const m = matchExistingAsset(p, existing, drugIds);
        if (m.asset) {
          const { error } = await supabase.from('clinical_assets').update(toExistingAssetPatch(p, ctx, m.asset)).eq('id', m.asset.id);
          if (error) { errors.push(`${co.name} ${p.program_name}: update ${error.message}`); continue; }
          disclosures.push(toDisclosureRow(p, ctx, m.asset.id, 'matched'));
          matched++;
          continue;
        }
        const row = toNewAssetRow(p, ctx, m.drug_master_id);
        if (!row) {
          const status: MatchStatus = stageToPhase(p.stage).phase ? 'unmatched_clinical' : 'skipped';
          if (status === 'unmatched_clinical') result.unmatchedClinical++;
          disclosures.push(toDisclosureRow(p, ctx, null, status));
          continue;
        }
        newRows.push(row);
        pending.push({ row, program: p });
      }

      if (newRows.length > 0) {
        // Never overwrite a registry row that happens to share (company_name, asset_name).
        const { data: inserted, error } = await supabase
          .from('clinical_assets')
          .upsert(newRows, { onConflict: 'company_name,asset_name', ignoreDuplicates: true })
          .select('id, asset_name');
        if (error) {
          errors.push(`${co.name}: insert ${error.message}`);
        } else {
          const idByName = new Map((inserted ?? []).map(r => [normalizeKey(String(r.asset_name)), String(r.id)]));
          for (const { row, program } of pending) {
            const id = idByName.get(normalizeKey(row.asset_name)) ?? null;
            if (id) {
              created.push(row.asset_name);
              disclosures.push(toDisclosureRow(program, ctx, id, 'created'));
            } else {
              disclosures.push(toDisclosureRow(program, ctx, null, 'skipped'));
            }
          }
        }
      }

      if (disclosures.length > 0) {
        const { error } = await supabase
          .from('asset_disclosures')
          .upsert(disclosures, { onConflict: 'company_id,source_id,program_key' });
        if (error) errors.push(`${co.name}: asset_disclosures ${error.message}`);
        else result.disclosuresWritten += disclosures.length;
      }
      result.assetsCreated += created.length;
      result.assetsMatched += matched;
      if (result.sample.length < 10) result.sample.push({ company: co.name, form: filing.form, created: created.slice(0, 8), matched });
      state.filings[co.id] = filing.accessionNumber;
    } catch (err) {
      errors.push(`${co.name}: ${err instanceof Error ? err.message.split('\n')[0].slice(0, 300) : String(err)}`);
    }
  }

  if (!manual) {
    try {
      await writeSyncCursor(supabase, SYNC_SOURCE, now.toISOString(), state);
    } catch (err) {
      errors.push(`cursor write: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  result.costUsd = Math.round(spent() * 10_000) / 10_000;
  result.durationMs = Date.now() - started;
  return result;
}
