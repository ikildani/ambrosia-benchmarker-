/**
 * Shared "document text → extracted deal → cited insert" step for exchange and
 * issuer-release adapters. Each adapter resolves its own listing and document
 * text; this does the rest identically so the adapters cannot drift.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { FunnelCounter } from '../funnel';
import { insertCitedDeal } from '../insert-deal';
import { extractDealFromFiling, findOrCreateCompany, deriveTherapeuticArea } from '../sec-edgar';
import { validateExtractedDeal } from '../deal-extraction-validator';
import { classifyAndEnrichDeal } from '../company-geography';

export interface FilingTextInput {
  /** Stable id for dedupe, e.g. 'cninfo:1225580763'. */
  filingId: string;
  sourceType: string;
  sourceUrl: string;
  provenanceNote: string;
  text: string;
  announcedDate: string; // YYYY-MM-DD
  /** Fallback country/region for the licensor when the name lookup is unknown (exchange of listing). */
  defaultLicensorCountry?: string | null;
  defaultLicensorRegion?: string | null;
  /** Label for funnel examples, e.g. company + headline. */
  label: string;
}

export interface FilingTextOptions {
  anthropicApiKey: string;
  dryRun: boolean;
  minConfidence: number;
  reviewConfidence: number;
  funnel: FunnelCounter;
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10);
}

export async function processFilingText(
  supabase: SupabaseClient,
  input: FilingTextInput,
  opts: FilingTextOptions,
): Promise<'inserted' | 'skipped' | 'error'> {
  const { funnel, dryRun } = opts;
  const { data: existing } = await supabase.from('deals').select('id').eq('source_filing_id', input.filingId).limit(1).maybeSingle();
  if (existing) { funnel.count('already_in_table'); return 'skipped'; }
  if (input.text.length < 300) { funnel.count('content_too_short', input.sourceType, input.label); return 'skipped'; }
  const deal = await extractDealFromFiling(input.text.substring(0, 24_000), opts.anthropicApiKey);
  if (!deal) { funnel.count('not_a_deal', input.sourceType, input.label.slice(0, 100)); return 'skipped'; }
  const floor = Math.min(opts.reviewConfidence, opts.minConfidence);
  if (deal.confidence_score < floor) { funnel.count('confidence_gate', deal.confidence_score >= 60 ? '60-74' : 'below-60', `${deal.licensor} → ${deal.licensee} c=${deal.confidence_score}`); return 'skipped'; }
  const needsReview = deal.confidence_score < opts.minConfidence;
  if (!deal.licensor?.trim() || !deal.licensee?.trim()) { funnel.count('missing_parties'); return 'skipped'; }
  const validation = validateExtractedDeal(deal, { minConfidence: floor });
  if (!validation.valid) { funnel.count('validator_rejected', validation.rejectCode, `${deal.licensor} → ${deal.licensee}: ${validation.rejectReason}`); return 'skipped'; }
  const announcedDate = input.announcedDate || new Date().toISOString().slice(0, 10);
  const { data: same } = await supabase.from('deals').select('id')
    .ilike('licensor_name', deal.licensor.trim()).ilike('licensee_name', deal.licensee.trim())
    .gte('announced_date', addDays(announcedDate, -30)).lte('announced_date', addDays(announcedDate, 30)).limit(1).maybeSingle();
  if (same) { funnel.count('duplicate_same_day'); return 'skipped'; }
  const licensorId = dryRun ? null : await findOrCreateCompany(supabase, deal.licensor.trim(), false);
  const licenseeId = dryRun ? null : await findOrCreateCompany(supabase, deal.licensee.trim(), true);
  const therapeuticArea = deriveTherapeuticArea(deal.indication_category);
  const geo = classifyAndEnrichDeal(deal.licensor, deal.licensee);
  const result = await insertCitedDeal(supabase, {
    sourceType: input.sourceType, sourceUrl: input.sourceUrl, sourceFilingId: input.filingId, extractionModel: 'claude-opus-4-6',
    provenanceNote: input.provenanceNote,
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
      licensor_country: geo.licensor_country !== 'unknown' ? geo.licensor_country : (input.defaultLicensorCountry ?? null),
      licensee_country: geo.licensee_country !== 'unknown' ? geo.licensee_country : null,
      licensor_region: geo.licensor_region !== 'unknown' ? geo.licensor_region : (input.defaultLicensorRegion ?? null),
      licensee_region: geo.licensee_region !== 'unknown' ? geo.licensee_region : null,
      cross_border: geo.cross_border, deal_corridor: geo.deal_corridor,
    },
  }, { dryRun });
  if (result.outcome === 'inserted') { funnel.count(dryRun ? 'dry_run_would_insert' : 'inserted', undefined, `${deal.licensor} → ${deal.licensee} ${deal.total_deal_value_usd ?? ''}`); return 'inserted'; }
  if (result.outcome === 'duplicate') { funnel.count('insert_duplicate'); return 'skipped'; }
  funnel.count('insert_error', result.outcome, result.error);
  return 'error';
}

/** Common adapter run result shape consumed by the rotating exchanges route. */
export interface AdapterRunResult {
  fetched: number;
  candidates: number;
  extracted: number;
  inserted: number;
  errors: string[];
  funnel: ReturnType<FunnelCounter['toJSON']>;
  summary: string;
  parameters?: Record<string, unknown>;
  /** false when an empty result is legitimate (weekend, no key, caught up). */
  expectRecords?: boolean;
  notes?: string;
}
