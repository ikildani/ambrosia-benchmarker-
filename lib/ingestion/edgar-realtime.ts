/**
 * SEC EDGAR real-time monitor: today's 8-K filings with deal language,
 * extracted and inserted with the filing as the citation.
 *
 * Moved out of the cron route (Sep 2026) so it can run in dry-run mode
 * locally, count every stage of the funnel, and page through the whole day
 * instead of the first 100 hits. The route is a thin wrapper.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { extractDealFromFiling, findOrCreateCompany, deriveTherapeuticArea } from './sec-edgar';
import { validateExtractedDeal } from './deal-extraction-validator';
import { classifyAndEnrichDeal } from './company-geography';
import { FunnelCounter } from './funnel';
import { insertCitedDeal } from './insert-deal';
import { fetchWithTimeout } from '../fetch-with-timeout';

const SEC_SEARCH_URL = 'https://efts.sec.gov/LATEST/search-index';
const USER_AGENT = 'Ambrosia Ventures Deal Intelligence research@ambrosiaventures.co';
const PAGE_SIZE = 100;

/** Plain-text keywords that mark an 8-K worth sending to the extractor. */
export const DEAL_KEYWORDS = [
  'license agreement', 'licensing agreement', 'exclusive license', 'collaboration agreement',
  'collaboration and license', 'co-development', 'option agreement', 'asset purchase agreement',
  'upfront payment', 'milestone payment', 'royalt', 'commercialization agreement',
];

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
  /** True when SEC returned no filings for the date (weekend, holiday, before the first filing of the day). */
  noFilings: boolean;
}

interface EftsHit {
  _id?: string;
  _source?: { adsh?: string; ciks?: string[]; file_date?: string; form?: string; display_names?: string[] };
}

/** Resolve a full-text-search hit to a fetchable document URL. */
export function hitToDocument(hit: EftsHit): { accession: string; url: string; cik: string; filename: string } | null {
  const id = typeof hit._id === 'string' ? hit._id : '';
  const [idAdsh, filename] = id.includes(':') ? id.split(':') : ['', ''];
  const accession = hit._source?.adsh || idAdsh;
  const cik = String(hit._source?.ciks?.[0] ?? '').replace(/^0+/, '');
  if (!accession || !cik || !filename) return null;
  return { accession, cik, filename, url: `https://www.sec.gov/Archives/edgar/data/${cik}/${accession.replace(/-/g, '')}/${filename}` };
}

async function searchDay(date: string, from: number): Promise<{ hits: EftsHit[]; total: number; status: number }> {
  const params = new URLSearchParams({ q: '"8-K"', forms: '8-K', dateRange: 'custom', startdt: date, enddt: date, from: String(from), size: String(PAGE_SIZE) });
  const res = await fetchWithTimeout(`${SEC_SEARCH_URL}?${params}`, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }, timeoutMs: 20_000, retries: 1 });
  if (!res.ok) return { hits: [], total: 0, status: res.status };
  const data = await res.json();
  return { hits: data.hits?.hits ?? [], total: data.hits?.total?.value ?? 0, status: res.status };
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
  let fetched = 0;
  let processed = 0;
  let inserted = 0;
  let total = 0;
  let from = 0;

  pages: while (true) {
    const page = await searchDay(date, from);
    if (page.status !== 200) {
      errors.push(`SEC search failed: ${page.status}`);
      break;
    }
    total = page.total;
    if (page.hits.length === 0) break;
    for (const hit of page.hits) {
      fetched++;
      funnel.count('fetched');
      if (Date.now() - start > budget) { funnel.count('time_budget', 'filings_remaining'); break pages; }
      if (processed >= maxExtractions) { funnel.count('time_budget', 'extraction_cap'); break pages; }
      const doc = hitToDocument(hit);
      if (!doc) { funnel.count('content_unavailable', 'unresolvable_hit', hit._id); continue; }
      try {
        const { data: existing } = await supabase.from('deals').select('id').eq('source_filing_id', doc.accession).limit(1).maybeSingle();
        if (existing) { funnel.count('already_in_table'); continue; }

        const filingRes = await fetchWithTimeout(doc.url, { headers: { 'User-Agent': USER_AGENT }, timeoutMs: 15_000, retries: 1 });
        if (!filingRes.ok) { funnel.count('content_unavailable', `http_${filingRes.status}`, doc.url); continue; }
        const html = await filingRes.text();
        const plain = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').toLowerCase();
        if (!DEAL_KEYWORDS.some(k => plain.includes(k))) { funnel.count('keyword_filtered'); continue; }

        const deal = await extractDealFromFiling(html.substring(0, 20_000), opts.anthropicApiKey);
        processed++;
        if (!deal) { funnel.count('not_a_deal', undefined, `${hit._source?.display_names?.[0] ?? doc.accession}`); continue; }
        if (deal.confidence_score < minConfidence) { funnel.count('confidence_gate', deal.confidence_score >= 60 ? '60-74' : 'below-60', `${deal.licensor} → ${deal.licensee} c=${deal.confidence_score}`); continue; }
        if (!deal.licensor?.trim() || !deal.licensee?.trim()) { funnel.count('missing_parties'); continue; }
        const validation = validateExtractedDeal(deal);
        if (!validation.valid) { funnel.count('validator_rejected', validation.rejectCode, `${deal.licensor} → ${deal.licensee}: ${validation.rejectReason}`); continue; }

        const { data: sameDay } = await supabase.from('deals').select('id')
          .ilike('licensor_name', deal.licensor.trim()).ilike('licensee_name', deal.licensee.trim())
          .gte('announced_date', date).limit(1).maybeSingle();
        if (sameDay) { funnel.count('duplicate_same_day'); continue; }

        const licensorId = dryRun ? null : await findOrCreateCompany(supabase, deal.licensor.trim(), false);
        const licenseeId = dryRun ? null : await findOrCreateCompany(supabase, deal.licensee.trim(), true);
        const therapeuticArea = deriveTherapeuticArea(deal.indication_category);
        const geo = classifyAndEnrichDeal(deal.licensor, deal.licensee);
        const announcedDate = hit._source?.file_date || date;

        const result = await insertCitedDeal(supabase, {
          sourceType: 'sec_8k',
          sourceUrl: doc.url,
          sourceFilingId: doc.accession,
          extractionModel: 'claude-opus-4-6',
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
            announced_date: announcedDate, confidence_score: deal.confidence_score, extraction_notes: deal.extraction_notes,
            therapeutic_area: therapeuticArea,
            licensor_country: geo.licensor_country !== 'unknown' ? geo.licensor_country : null,
            licensee_country: geo.licensee_country !== 'unknown' ? geo.licensee_country : null,
            licensor_region: geo.licensor_region !== 'unknown' ? geo.licensor_region : null,
            licensee_region: geo.licensee_region !== 'unknown' ? geo.licensee_region : null,
            cross_border: geo.cross_border, deal_corridor: geo.deal_corridor,
          },
        }, { dryRun });

        if (result.outcome === 'inserted') {
          inserted++;
          funnel.count(dryRun ? 'dry_run_would_insert' : 'inserted', undefined, `${deal.licensor} → ${deal.licensee} ${deal.total_deal_value_usd ?? ''}`);
          if (!dryRun && opts.onHighValue && deal.total_deal_value_usd && deal.total_deal_value_usd > 100_000_000) {
            try {
              await opts.onHighValue({ licensor: deal.licensor, licensee: deal.licensee, asset: deal.asset_name || 'Undisclosed', totalValue: deal.total_deal_value_usd, dealType: deal.deal_type || 'unknown', therapeuticArea, announcedDate });
            } catch (e) { console.error('[edgar-realtime] high-value alert failed (non-fatal):', e); }
          }
        } else if (result.outcome === 'duplicate') {
          funnel.count('insert_duplicate');
        } else {
          funnel.count('insert_error', result.outcome, result.error);
          errors.push(`Insert error for ${doc.accession}: ${result.error}`);
        }
        await new Promise(r => setTimeout(r, 300)); // SEC: max 10 req/s
      } catch (e) {
        funnel.count('extraction_error', undefined, String(e).slice(0, 120));
        errors.push(`Filing ${doc.accession}: ${String(e).slice(0, 200)}`);
      }
    }
    from += PAGE_SIZE;
    if (from >= total) break;
  }

  const summary = funnel.summary();
  console.log(`[edgar-realtime] ${date} total=${total} ${summary}${dryRun ? ' (dry run)' : ''}`);
  return { date, fetched, processed, inserted, errors, funnel: funnel.toJSON(), summary, noFilings: total === 0 };
}
