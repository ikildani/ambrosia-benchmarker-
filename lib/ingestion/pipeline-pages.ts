/**
 * Company pipeline pages → disclosed programs (global preclinical source).
 *
 * The crawler (scripts/pipeline-crawler.ts, Playwright on GitHub Actions)
 * renders a company's pipeline page and hands this module the visible text
 * plus a screenshot. Many pipeline pages are charts (phase bars per program)
 * with little text, so the screenshot goes to the model as an image and the
 * text as numbered paragraphs. Programs are matched and written through the
 * same path as filings (persistPrograms), with asset_origin = 'pipeline_page'.
 *
 * Evidence rule: a program taken from the text quotes it verbatim; a program
 * read off the chart carries an excerpt beginning "[chart] " with the label as
 * shown, so QA can tell the two apart.
 */

import type Anthropic from '@anthropic-ai/sdk';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { addUsage, emptyUsage, type IntentClient, type TokenUsage } from './management-intent';
import {
  DisclosedProgramSchema,
  MAX_EXCERPT_CHARS,
  PRECLINICAL_MODEL,
  buildOutputJsonSchema,
  dedupePrograms,
  quoteIsVerbatim,
  type DisclosedProgram,
  type FilingContext,
} from './preclinical-pipeline';

export const PIPELINE_PAGE_PROMPT_VERSION = 'pipeline-page-v1';
export const PIPELINE_PAGE_FORM = 'pipeline_page';
export const CHART_PREFIX = '[chart] ';
const MAX_PARAGRAPHS = 120;
const MIN_PARAGRAPH_CHARS = 12;
const MAX_PARAGRAPH_CHARS = 1_200;
const MAX_OUTPUT_TOKENS = 12_000;
const MAX_PROGRAMS = 80;

/** Paths tried, in order, when a company has a site but no known pipeline URL. */
export const PIPELINE_PATH_CANDIDATES: ReadonlyArray<string> = [
  '/pipeline', '/our-pipeline', '/pipeline/', '/science/pipeline', '/research/pipeline', '/rd/pipeline', '/r-d/pipeline',
  '/programs', '/our-programs', '/portfolio', '/our-science/pipeline', '/science', '/research-development/pipeline',
  '/technology/pipeline', '/products/pipeline', '/product-pipeline', '/en/pipeline', '/en/rd/pipeline', '/en/research/pipeline',
];

/** Link text that marks a pipeline page in site navigation. */
export const PIPELINE_LINK_RE = /(\b(?:pipeline|our programs?|portfolio|products? in development|r&d|research (?:&|and) development)\b|パイプライン|管线|파이프라인)/i;

/** Visible page text → numbered paragraphs the model can quote from. */
export function pipelineTextParagraphs(text: string, max = MAX_PARAGRAPHS): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of text.split(/\n+/)) {
    const p = raw.replace(/\s+/g, ' ').trim();
    if (p.length < MIN_PARAGRAPH_CHARS) continue;
    const key = p.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p.length > MAX_PARAGRAPH_CHARS ? p.slice(0, MAX_PARAGRAPH_CHARS) : p);
    if (out.length >= max) break;
  }
  return out;
}

/** True when the page text reads like a pipeline (stage words + program-like names). */
export function looksLikePipelinePage(text: string): boolean {
  const t = text.toLowerCase();
  const stages = (t.match(/\b(preclinical|pre-clinical|discovery|ind-enabling|lead optimi[sz]ation|phase\s?[123i]|phase\s?ii?i?|approved|commercial)\b/g) ?? []).length;
  const codes = (text.match(/\b[A-Z]{2,5}[- ]?\d{2,5}[A-Z]?\b/g) ?? []).length;
  return stages >= 2 && (codes >= 1 || /\bpipeline\b/i.test(text));
}

export const PIPELINE_PAGE_SYSTEM = `You extract a biopharma company's own drug pipeline from its website pipeline page. You receive the page's visible text as numbered paragraphs and, when available, a screenshot of the page. Pipeline pages are often charts: one row per program with a bar showing its stage (Discovery, Preclinical, IND-enabling, Phase 1, Phase 2, Phase 3, Approved). Read the chart when the text does not carry the stage.

Fields per program:
- program_name: the name the page uses (a code like "ABC-123", an INN, or a descriptive name such as "KRAS G12D inhibitor program"). One entry per program; put other names in aliases.
- aliases: other names on the page for the same program. Empty list if none.
- stage, exactly one of: discovery, lead_optimization, ind_enabling, preclinical, phase_1, phase_1_2, phase_2, phase_2_3, phase_3, approved, discontinued, unknown. Use the most advanced stage the page shows for that program. A bar ending in the "Preclinical" column is preclinical; ending in "IND-enabling" is ind_enabling; ending in "Discovery" or "Research" is discovery.
- target: molecular target as written, or null. target_class: enzyme, gpcr, ion_channel, transporter, kinase, nuclear_receptor, cytokine, antigen, or null.
- modality: small_molecule, antibody, bispecific, adc, car_t, cell_therapy, gene_therapy, mrna, peptide, oligonucleotide, radiopharm, vaccine, protein, other, or null.
- therapeutic_area / indication_category: from the listed values or null. indication_specific: the disease as named (<= 60 chars) or null.
- mechanism_short: <= 80 characters, or null.
- partnered: true only when the page says the program is partnered, licensed, co-developed or optioned to another company (a partner logo or "in collaboration with X" counts). partner_name: that company or null.
- evidence_quote: if the program's name appears in the paragraphs, ONE sentence or line copied VERBATIM from them (at most 600 characters). If the program is only visible in the screenshot, write "[chart] " followed by the row label exactly as shown, e.g. "[chart] ABC-123 · KRAS G12D · NSCLC · Preclinical".
- confidence 0-100: 90+ when name and stage are explicit; 60-89 when the stage is read off a bar; below 60 when uncertain.

Rules:
1. Only this company's programs. Skip partner drugs the company merely mentions, platform technologies without a named program, and marketed products of other companies.
2. Do not invent codes. A program described only by target and indication gets a descriptive name and empty aliases.
3. A program with several indications is ONE program; lead indication in indication_specific. A program shown as several rows (one per indication) is still one program at its most advanced stage.
4. Return {"programs": []} when the page has no pipeline.

Output: a single JSON object {"programs": [...]} matching the schema. No prose.`;

export type ScreenshotMedia = 'image/png' | 'image/jpeg';

export function buildPageUserContent(company: string, url: string, crawledAt: string, paragraphs: string[], screenshotPngBase64?: string | null, media: ScreenshotMedia = 'image/jpeg'): Anthropic.MessageParam['content'] {
  const body = paragraphs.map((p, i) => `[${i}] ${p}`).join('\n');
  const text = `Company: ${company}\nPage: ${url}\nCrawled: ${crawledAt}\n\nParagraphs:\n\n${body || '(no readable text; use the screenshot)'}`;
  const content: Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam> = [];
  if (screenshotPngBase64) {
    content.push({ type: 'image', source: { type: 'base64', media_type: media, data: screenshotPngBase64 } });
  }
  content.push({ type: 'text', text });
  return content;
}

/** Verbatim in the text, or a chart label. */
export function pageQuoteAcceptable(quote: string, paragraphs: string[]): boolean {
  if (quote.startsWith(CHART_PREFIX)) return quote.length > CHART_PREFIX.length + 2;
  return quoteIsVerbatim(quote, paragraphs);
}

export interface PageExtractResult {
  programs: DisclosedProgram[];
  dropped: number;
  invalid: number;
  fromChart: number;
  usage: TokenUsage;
  error: string | null;
}

const OUTPUT_SCHEMA = buildOutputJsonSchema();

export async function extractProgramsFromPage(
  client: IntentClient,
  company: string,
  url: string,
  crawledAt: string,
  paragraphs: string[],
  screenshotPngBase64?: string | null,
  model = PRECLINICAL_MODEL,
): Promise<PageExtractResult> {
  const usage = emptyUsage();
  try {
    const msg = await client.messages.create({
      model,
      max_tokens: MAX_OUTPUT_TOKENS,
      system: [{ type: 'text', text: PIPELINE_PAGE_SYSTEM, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: buildPageUserContent(company, url, crawledAt, paragraphs, screenshotPngBase64) }],
      output_config: { format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
      thinking: { type: 'disabled' },
    } as Anthropic.MessageCreateParamsNonStreaming);
    addUsage(usage, msg.usage as unknown as Partial<TokenUsage>);
    if (msg.stop_reason === 'refusal') return { programs: [], dropped: 0, invalid: 0, fromChart: 0, usage, error: 'model refused the page' };
    if (msg.stop_reason === 'max_tokens') return { programs: [], dropped: 0, invalid: 0, fromChart: 0, usage, error: 'response truncated at max_tokens' };
    const text = msg.content.find((b): b is Anthropic.TextBlock => b.type === 'text')?.text ?? '';
    const loose = z.object({ programs: z.array(z.record(z.string(), z.unknown())) }).safeParse(JSON.parse(text));
    if (!loose.success) return { programs: [], dropped: 0, invalid: 0, fromChart: 0, usage, error: `response is not {programs: [...]}` };
    const kept: DisclosedProgram[] = [];
    let invalid = 0, dropped = 0, fromChart = 0;
    for (const raw of loose.data.programs.slice(0, MAX_PROGRAMS)) {
      const parsed = DisclosedProgramSchema.safeParse(raw);
      if (!parsed.success) { invalid++; continue; }
      if (!parsed.data.program_name || !pageQuoteAcceptable(parsed.data.evidence_quote, paragraphs)) { dropped++; continue; }
      if (parsed.data.evidence_quote.startsWith(CHART_PREFIX)) fromChart++;
      kept.push({ ...parsed.data, evidence_quote: parsed.data.evidence_quote.slice(0, MAX_EXCERPT_CHARS) });
    }
    return { programs: dedupePrograms(kept), dropped, invalid, fromChart, usage, error: null };
  } catch (err) {
    return { programs: [], dropped: 0, invalid: 0, fromChart: 0, usage, error: err instanceof Error ? err.message.split('\n')[0].slice(0, 300) : String(err) };
  }
}

/** Stable id for one crawl of one page: URL hash + date, so a re-crawl is a new disclosure source. */
export function pageAccession(url: string, crawledAtIso: string): string {
  return `page:${createHash('sha1').update(url).digest('hex').slice(0, 12)}:${crawledAtIso.slice(0, 10)}`;
}

export function pageContext(company: { id: string; name: string }, url: string, now: Date, model = PRECLINICAL_MODEL): FilingContext {
  const iso = now.toISOString();
  return {
    company_id: company.id,
    company_name: company.name,
    form: PIPELINE_PAGE_FORM,
    accession: pageAccession(url, iso),
    filing_date: iso.slice(0, 10),
    url,
    model,
    now,
    origin: 'pipeline_page',
  };
}
