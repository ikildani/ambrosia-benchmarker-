/**
 * Company-disclosed pipelines of Hong Kong-listed biotechs (Search & Evaluation).
 *
 * China's CDE trial registry is behind a WAF we do not get past, and WHO ICTRP bars commercial
 * reuse, so the free primary source for Chinese programs is what the companies themselves file.
 * HKEX requires an English annual report, and Chapter 18A biotechs disclose every program,
 * preclinical included, in its business review. This reader takes a hand-checked map of HKEX
 * issuers to companies rows (scripts/data/hkex-biotech-map-*.json), reads each issuer's latest
 * annual report and runs the same extraction and persistence as the SEC reader
 * (lib/ingestion/preclinical-pipeline.ts): verbatim quote required, preclinical programs create
 * assets, clinical programs match existing assets or land in asset_disclosures as
 * unmatched_clinical.
 *
 * A report already recorded in asset_disclosures (source_id = HKEX NEWS_ID) is not read again.
 * Spend: source 'hkex-pipeline' on the backlog allowance (owner-approved $15, Nov 3 2026).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { HKEX_ANNUAL_REPORT, fetchHkexPdfText, hkexDateToIso, searchHkexIssuerDocuments } from './exchanges/hkex';
import {
  PRECLINICAL_MODEL,
  extractPipelineParagraphs,
  extractPrograms,
  persistPrograms,
  type FilingContext,
} from './preclinical-pipeline';
import { addUsage, emptyUsage, usageCostUsd, type IntentClient, type TokenUsage } from './management-intent';

export const HKEX_PIPELINE_FORM = 'hkex_annual_report';
export const HKEX_PIPELINE_SOURCE = 'hkex_filing';
/** Reports older than this are not read (a pipeline two reports old misleads more than it adds). */
export const HKEX_REPORT_MAX_AGE_DAYS = 548;

export interface HkexIssuer {
  /** HKEX internal stock id (activestock_sehk_e.json "i"). */
  stockId: number;
  code: string;
  shortName: string;
  companyId: string;
  companyName: string;
}

export interface HkexPipelineOptions {
  client: IntentClient;
  model?: string;
  costCapUsd?: number;
  timeBudgetMs?: number;
  dryRun?: boolean;
  limit?: number;
  now?: Date;
}

export interface HkexPipelineResult {
  issuers: number;
  reportsRead: number;
  skippedSeen: number;
  noReport: number;
  programsExtracted: number;
  assetsCreated: number;
  assetsMatched: number;
  unmatchedClinical: number;
  quotesDropped: number;
  usage: TokenUsage;
  costUsd: number;
  costCapHit: boolean;
  timedOut: boolean;
  errors: string[];
  sample: Array<{ code: string; company: string; report: string; programs: number; created: string[] }>;
}

async function reportAlreadyRead(supabase: SupabaseClient, companyId: string, newsId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('asset_disclosures')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('source_id', newsId);
  if (error) throw new Error(`asset_disclosures read: ${error.message}`);
  return (count ?? 0) > 0;
}

export async function runHkexPipeline(supabase: SupabaseClient, issuers: readonly HkexIssuer[], opts: HkexPipelineOptions): Promise<HkexPipelineResult> {
  const started = Date.now();
  const now = opts.now ?? new Date();
  const model = opts.model ?? PRECLINICAL_MODEL;
  const costCap = opts.costCapUsd ?? 15;
  const budget = opts.timeBudgetMs ?? 45 * 60_000;
  const usage = emptyUsage();
  const r: HkexPipelineResult = {
    issuers: 0, reportsRead: 0, skippedSeen: 0, noReport: 0, programsExtracted: 0, assetsCreated: 0, assetsMatched: 0,
    unmatchedClinical: 0, quotesDropped: 0, usage, costUsd: 0, costCapHit: false, timedOut: false, errors: [], sample: [],
  };
  const fromIso = new Date(now.getTime() - HKEX_REPORT_MAX_AGE_DAYS * 86_400_000).toISOString().slice(0, 10);
  const toIso = now.toISOString().slice(0, 10);

  for (const issuer of issuers.slice(0, opts.limit ?? issuers.length)) {
    if (Date.now() - started > budget) { r.timedOut = true; break; }
    if (usageCostUsd(usage) >= costCap) { r.costCapHit = true; break; }
    r.issuers++;
    try {
      const search = await searchHkexIssuerDocuments(issuer.stockId, HKEX_ANNUAL_REPORT, fromIso, toIso);
      if (search.throttled) { r.errors.push(`${issuer.code}: HKEX search throttled; stopping`); break; }
      const report = search.rows.find(row => /annual report/i.test(row.title));
      if (!report) { r.noReport++; continue; }
      if (await reportAlreadyRead(supabase, issuer.companyId, report.newsId)) { r.skippedSeen++; continue; }
      const filingDate = hkexDateToIso(report.dateTime) ?? toIso;

      const pdf = await fetchHkexPdfText(report.url, 120_000);
      if (!pdf.ok || pdf.text.length < 2_000) { r.errors.push(`${issuer.code}: report ${report.url} unreadable (HTTP ${pdf.status})`); continue; }
      const paragraphs = extractPipelineParagraphs(pdf.text);
      if (paragraphs.length === 0) { r.errors.push(`${issuer.code}: no pipeline paragraphs in ${report.url}`); continue; }

      const ex = await extractPrograms(opts.client, model, issuer.companyName, `HKEX ${report.title}`, filingDate, paragraphs);
      addUsage(usage, ex.usage);
      r.reportsRead++;
      r.quotesDropped += ex.dropped;
      if (ex.error) { r.errors.push(`${issuer.code}: ${ex.error}`); continue; }
      r.programsExtracted += ex.programs.length;

      let created: string[] = [];
      if (!opts.dryRun) {
        const ctx: FilingContext = {
          company_id: issuer.companyId, company_name: issuer.companyName, form: HKEX_PIPELINE_FORM, accession: report.newsId,
          filing_date: filingDate, url: report.url, model, now, origin: 'filing', dataSource: HKEX_PIPELINE_SOURCE,
        };
        const persisted = await persistPrograms(supabase, ctx, ex.programs);
        r.errors.push(...persisted.errors.map(e => `${issuer.code}: ${e}`));
        r.assetsCreated += persisted.created.length;
        r.assetsMatched += persisted.matched;
        r.unmatchedClinical += persisted.unmatchedClinical;
        created = persisted.created;
      }
      if (r.sample.length < 25) r.sample.push({ code: issuer.code, company: issuer.companyName, report: report.title, programs: ex.programs.length, created: created.slice(0, 6) });
    } catch (err) {
      r.errors.push(`${issuer.code}: ${err instanceof Error ? err.message.split('\n')[0].slice(0, 200) : String(err)}`);
    }
  }
  r.costUsd = Math.round(usageCostUsd(usage) * 10_000) / 10_000;
  return r;
}
