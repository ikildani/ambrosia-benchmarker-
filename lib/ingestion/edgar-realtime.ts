/**
 * SEC EDGAR real-time monitor: 8-K and 6-K filings from the last day that
 * contain biopharma deal language, extracted and inserted with the filing
 * as the citation.
 *
 * Sep 2026 rewrite. The previous version searched `"8-K"` for the whole day
 * (399 filings on an ordinary Tuesday), keyword-filtered the first document
 * of each filing (the cover page), and spent its 40-extraction budget on
 * Cemtrex, PEDEVCO and La Rosa Holdings. It inserted nothing for two weeks.
 * This version asks EFTS for the deal language directly, scoped to
 * biopharma vocabulary, and follows each hit to the exhibit that matched.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { extractDealFromFiling, findOrCreateCompany, deriveTherapeuticArea } from './sec-edgar';
import { validateExtractedDeal } from './deal-extraction-validator';
import { classifyAndEnrichDeal } from './company-geography';
import { FunnelCounter } from './funnel';
import { insertCitedDeal } from './insert-deal';
import { PHARMA_DEAL_QUERIES, eftsSearch, hitToDocument, fetchSecDocumentText, isLikelyPharmaDealHit, EFTS_PAGE_SIZE, type EftsDocument } from './edgar-fts';

export { hitToDocument } from './edgar-fts';

export interface EdgarRealtimeOptions {
  /** ISO date (UTC) to scan; defaults to today. */
  date?: string;
  /** Milliseconds available; defaults to 100s (Vercel 120s limit). */
  timeBudgetMs?: number;
  /** Cap on filings sent to the extractor in one run. */
  maxExtractions?: number;
  /** Count every stage but write nothing to deals or companies. */
  dryRun?: boolean;
  /** Minimum extractor confidence to insert. */
  minConfidence?: number;
  anthropicApiKey: string;
  /** Called after a successful insert with a high total value; the route wires Slack. */
  onHighValue?: (deal: { licensor: string; licensee: string; asset: string; totalValue: number; dealType: string; therapeuticArea: string; announcedDate: string }) => Promise<void>;
}

export interface EdgarRealtimeResult {
  date: string;
  fetched: number;
  processed: number;
  inserted: number;
  errors: string[];
  funnel: ReturnType<FunnelCounter['toJSON']>;
  summary: string;
  /** True when SEC returned no matching filings for the date. */
  noFilings: boolean;
}

/**
 * Process one resolved EFTS document through extraction, validation and the
 * cited insert. Shared by the real-time monitor and the historical backfill
 * so the two cannot drift.
 */
export async function processEftsDocument(
  supabase: SupabaseClient,
  doc: EftsDocument,
  opts: {
    anthropicApiKey: string; dryRun: boolean; minConfidence: number; funnel: FunnelCounter; sourceType: 'sec_8k' | 'sec_6k';
    onHighValue?: EdgarRealtimeOptions['onHighValue'];
    /**
     * Sep 24 2026: filings scoring in [reviewConfidence, minConfidence) are inserted as
     * pending with a review note instead of dropped. The first fast backfill run put
     * Assembly → Allergan (c=72) and Nerviano → Trovagene (c=72), both real 2017 deals,
     * on the floor. The verification cron is the gate that promotes to verified.
     */
    reviewConfidence?: number;
  },
): Promise<'inserted' | 'skipped' | 'error'> {
  const { funnel, dryRun } = opts;
  const { data: existing } = await supabase.from('deals').select('id').eq('source_filing_id', doc.accession).limit(1).maybeSingle();
  if (existing) { funnel.count('already_in_table'); return 'skipped'; }

  const fetched = await fetchSecDocumentText(doc.url);
  if (!fetched.ok) { funnel.count('content_unavailable', `http_${fetched.status}`, doc.url); return 'skipped'; }
  if (fetched.text.length < 500) { funnel.count('content_too_short', doc.fileType || 'unknown', doc.url); return 'skipped'; }

  const deal = await extractDealFromFiling(fetched.text.substring(0, 24_000), opts.anthropicApiKey);
  if (!deal) { funnel.count('not_a_deal', doc.fileType || 'unknown', `${doc.companyName} ${doc.accession}`); return 'skipped'; }
  const floor = opts.reviewConfidence != null ? Math.min(opts.reviewConfidence, opts.minConfidence) : opts.minConfidence;
  if (deal.confidence_score < floor) {
    funnel.count('confidence_gate', deal.confidence_score >= 60 ? '60-74' : 'below-60', `${deal.licensor} → ${deal.licensee} c=${deal.confidence_score}`);
    return 'skipped';
  }
  const needsReview = deal.confidence_score < opts.minConfidence;
  if (!deal.licensor?.trim() || !deal.licensee?.trim()) { funnel.count('missing_parties'); return 'skipped'; }
  const validation = validateExtractedDeal(deal);
  if (!validation.valid) { funnel.count('validator_rejected', validation.rejectCode, `${deal.licensor} → ${deal.licensee}: ${validation.rejectReason}`); return 'skipped'; }

  const announcedDate = doc.filingDate || new Date().toISOString().slice(0, 10);
  const { data: sameDeal } = await supabase.from('deals').select('id')
    .ilike('licensor_name', deal.licensor.trim()).ilike('licensee_name', deal.licensee.trim())
    .gte('announced_date', shiftDays(announcedDate, -30)).lte('announced_date', shiftDays(announcedDate, 30)).limit(1).maybeSingle();
  if (sameDeal) { funnel.count('duplicate_same_day'); return 'skipped'; }

  const licensorId = dryRun ? null : await findOrCreateCompany(supabase, deal.licensor.trim(), false);
  const licenseeId = dryRun ? null : await findOrCreateCompany(supabase, deal.licensee.trim(), true);
  const therapeuticArea = deriveTherapeuticArea(deal.indication_category);
  const geo = classifyAndEnrichDeal(deal.licensor, deal.licensee);

  const result = await insertCitedDeal(supabase, {
    sourceType: opts.sourceType,
    sourceUrl: doc.url,
    sourceFilingId: doc.accession,
    extractionModel: 'claude-opus-4-6',
    provenanceNote: `EFTS ${doc.form} ${doc.fileType}`.trim(),
    row: {
      licensor_name: deal.licensor, licensor_id: licensorId, licensee_name: deal.licensee, licensee_id: licenseeId,
      asset_name: deal.asset_name, asset_description: deal.asset_description, modality: deal.modality,
      indication_category: deal.indication_category, indication_specific: deal.indication_specific, target: deal.target,
      mechanism_of_action: deal.mechanism_of_action, phase_at_signing: deal.phase_at_signing, territory: deal.territory,
      territories_included: deal.territories_included || [], exclusivity: deal.exclusivity, deal_type: deal.deal_type,
      upfront_usd: deal.upfront_usd, milestones_total_usd: deal.milestones_total_usd,
      milestones_development_usd: deal.milestones_development_usd, milestones_regulatory_usd: deal.milestones_regulatory_usd,
      milestones_commercial_usd: deal.milestones_commercial_usd, royalty_low_pct: deal.royalty_low_pct, royalty_high_pct: deal.royalty_high_pct,
      total_deal_value_usd: deal.total_deal_value_usd, equity_investment_usd: deal.equity_investment_usd,
      includes_manufacturing: deal.includes_manufacturing, includes_co_development: deal.includes_co_development,
      includes_co_promotion: deal.includes_co_promotion, option_exercise_fee: deal.option_exercise_fee,
      milestone_details: deal.milestone_details || [], sales_milestones: deal.sales_milestones || [],
      research_funding_usd: deal.research_funding_usd, profit_share_pct: deal.profit_share_pct, cost_share_ratio: deal.cost_share_ratio,
      opt_in_rights: deal.opt_in_rights, opt_in_stage: deal.opt_in_stage, regulatory_designations: deal.regulatory_designations || [],
      term_years: deal.term_years, sublicense_rights: deal.sublicense_rights, rights_retained: deal.rights_retained,
      indications_licensed: deal.indications_licensed, includes_diagnostics: deal.includes_diagnostics || false,
      announced_date: announcedDate, confidence_score: deal.confidence_score,
      extraction_notes: needsReview ? `Confidence ${deal.confidence_score}: needs verifier review. ${deal.extraction_notes || ''}`.trim() : deal.extraction_notes,
      therapeutic_area: therapeuticArea,
      licensor_country: geo.licensor_country !== 'unknown' ? geo.licensor_country : null,
      licensee_country: geo.licensee_country !== 'unknown' ? geo.licensee_country : null,
      licensor_region: geo.licensor_region !== 'unknown' ? geo.licensor_region : null,
      licensee_region: geo.licensee_region !== 'unknown' ? geo.licensee_region : null,
      cross_border: geo.cross_border, deal_corridor: geo.deal_corridor,
    },
  }, { dryRun });

  if (result.outcome === 'inserted') {
    funnel.count(dryRun ? 'dry_run_would_insert' : 'inserted', undefined, `${deal.licensor} → ${deal.licensee} ${deal.total_deal_value_usd ?? ''}`);
    if (!dryRun && opts.onHighValue && deal.total_deal_value_usd && deal.total_deal_value_usd > 100_000_000) {
      try {
        await opts.onHighValue({ licensor: deal.licensor, licensee: deal.licensee, asset: deal.asset_name || 'Undisclosed', totalValue: deal.total_deal_value_usd, dealType: deal.deal_type || 'unknown', therapeuticArea, announcedDate });
      } catch (e) { console.error('[edgar] high-value alert failed (non-fatal):', e); }
    }
    return 'inserted';
  }
  if (result.outcome === 'duplicate') { funnel.count('insert_duplicate'); return 'skipped'; }
  funnel.count('insert_error', result.outcome, result.error);
  return 'error';
}

function shiftDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function runEdgarRealtime(supabase: SupabaseClient, opts: EdgarRealtimeOptions): Promise<EdgarRealtimeResult> {
  const date = opts.date ?? new Date().toISOString().split('T')[0];
  const budget = opts.timeBudgetMs ?? 100_000;
  const maxExtractions = opts.maxExtractions ?? 40;
  const minConfidence = opts.minConfidence ?? 75;
  const dryRun = !!opts.dryRun;
  const start = Date.now();
  const funnel = new FunnelCounter();
  const errors: string[] = [];
  const seen = new Set<string>();
  let fetched = 0;
  let processed = 0;
  let inserted = 0;
  let totalAcrossQueries = 0;

  queries: for (const query of PHARMA_DEAL_QUERIES) {
    let from = 0;
    while (true) {
      if (Date.now() - start > budget) { funnel.count('time_budget', 'queries_remaining'); break queries; }
      const page = await eftsSearch({ q: query.q, startdt: date, enddt: date, from });
      if (page.parseFailed && page.hits.length === 0) { errors.push(`SEC search ${query.key}: non-JSON body after retry (page ${from})`); break; }
      if (page.status === 500 && from > 0) break; // EFTS: past the last hit
      if (page.status !== 200) { errors.push(`SEC search ${query.key} failed: ${page.status}`); break; }
      if (from === 0) totalAcrossQueries += page.total;
      if (page.hits.length === 0) break;
      for (const hit of page.hits) {
        if (Date.now() - start > budget) { funnel.count('time_budget', 'hits_remaining'); break queries; }
        const doc = hitToDocument(hit);
        if (!doc) { funnel.count('content_unavailable', 'unresolvable_hit', hit._id); continue; }
        if (seen.has(doc.accession)) continue; // same filing matched two queries
        seen.add(doc.accession);
        fetched++;
        funnel.count('fetched');
        const pre = isLikelyPharmaDealHit(hit);
        if (!pre.keep) { funnel.count('keyword_filtered', pre.reason, `${doc.companyName} ${doc.form} ${doc.fileType}`); continue; }
        if (processed >= maxExtractions) { funnel.count('time_budget', 'extraction_cap'); break queries; }
        try {
          processed++;
          const outcome = await processEftsDocument(supabase, doc, {
            anthropicApiKey: opts.anthropicApiKey, dryRun, minConfidence, funnel,
            sourceType: doc.form.startsWith('6-K') ? 'sec_6k' : 'sec_8k', onHighValue: opts.onHighValue,
          });
          if (outcome === 'inserted') inserted++;
          if (outcome === 'error') errors.push(`Insert error for ${doc.accession}`);
        } catch (e) {
          funnel.count('extraction_error', undefined, String(e).slice(0, 120));
          errors.push(`Filing ${doc.accession}: ${String(e).slice(0, 200)}`);
        }
      }
      from += EFTS_PAGE_SIZE;
      if (from >= page.total) break;
    }
  }

  const summary = funnel.summary();
  console.log(`[edgar-realtime] ${date} matched=${totalAcrossQueries} ${summary}${dryRun ? ' (dry run)' : ''}`);
  return { date, fetched, processed, inserted, errors, funnel: funnel.toJSON(), summary, noFilings: totalAcrossQueries === 0 };
}
