import { SupabaseClient } from '@supabase/supabase-js';

export interface CompanyEnrichmentOptions {
  companyIds?: string[];    // specific companies, or all if not provided
  fullRefresh?: boolean;    // re-derive even if recently enriched
}

interface EnrichmentResult {
  companies_processed: number;
  stats_updated: number;
  appetite_updated: number;
  errors: string[];
}

type AcquisitionAppetite = 'aggressive' | 'moderate' | 'selective' | 'inactive';

const PAGE_SIZE = 50;

/**
 * Runs the full company enrichment pipeline:
 * 1. Refreshes deal stats via RPC
 * 2. Derives acquisition_appetite from deal activity
 * 3. Derives modalities_primary from recent deals
 * 4. Derives actively_acquiring flag
 * 5. Recalculates data quality scores
 * 6. Logs results to data_ingestion_log
 */
export async function runCompanyEnrichment(
  supabase: SupabaseClient,
  options?: CompanyEnrichmentOptions
): Promise<EnrichmentResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  let companiesProcessed = 0;
  let statsUpdated = 0;
  let appetiteUpdated = 0;

  const now = new Date();
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const twentyFourMonthsAgo = new Date(now.getTime() - 24 * 30 * 24 * 60 * 60 * 1000);

  // Fetch companies in pages of 50
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    let query = supabase
      .from('companies')
      .select('id, name, deals_last_12mo, last_deal_date, active_trials_count, data_quality_score')
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
      .order('id');

    // If specific company IDs are provided, filter to those
    if (options?.companyIds && options.companyIds.length > 0) {
      query = query.in('id', options.companyIds);
    }

    const { data: companies, error: fetchError } = await query;

    if (fetchError) {
      errors.push(`Failed to fetch companies page ${page}: ${fetchError.message}`);
      break;
    }

    if (!companies || companies.length === 0) {
      hasMore = false;
      break;
    }

    // Process each company individually, wrapped in try/catch
    for (const company of companies) {
      try {
        // Step 2a: Call RPC to refresh deal stats
        const { error: rpcError } = await supabase.rpc('update_company_deal_stats', {
          p_company_id: company.id,
        });

        if (rpcError) {
          errors.push(`RPC update_company_deal_stats failed for ${company.name} (${company.id}): ${rpcError.message}`);
          companiesProcessed++;
          continue;
        }

        statsUpdated++;

        // Step 2b: Re-fetch the updated company to get fresh values
        const { data: updatedCompany, error: refetchError } = await supabase
          .from('companies')
          .select('id, name, deals_last_12mo, last_deal_date, active_trials_count')
          .eq('id', company.id)
          .single();

        if (refetchError || !updatedCompany) {
          errors.push(`Failed to re-fetch company ${company.name} (${company.id}): ${refetchError?.message || 'no data'}`);
          companiesProcessed++;
          continue;
        }

        // Step 2c: Derive acquisition_appetite
        const dealsLast12mo = updatedCompany.deals_last_12mo || 0;
        const lastDealDate = updatedCompany.last_deal_date ? new Date(updatedCompany.last_deal_date) : null;
        const activeTrialsCount = updatedCompany.active_trials_count || 0;

        let acquisitionAppetite: AcquisitionAppetite;
        if (dealsLast12mo >= 5 && lastDealDate && lastDealDate >= sixtyDaysAgo) {
          acquisitionAppetite = 'aggressive';
        } else if (dealsLast12mo >= 2) {
          acquisitionAppetite = 'moderate';
        } else if (dealsLast12mo >= 1) {
          acquisitionAppetite = 'selective';
        } else {
          acquisitionAppetite = 'inactive';
        }

        // Step 2d: Derive modalities_primary from recent deals (top 3 modalities)
        const { data: recentDeals, error: dealsError } = await supabase
          .from('deals')
          .select('modality')
          .eq('licensee_id', company.id)
          .gte('announced_date', twentyFourMonthsAgo.toISOString().split('T')[0])
          .not('modality', 'is', null);

        let modalitiesPrimary: string[] = [];

        if (!dealsError && recentDeals && recentDeals.length > 0) {
          // Count occurrences of each modality
          const modalityCounts = new Map<string, number>();
          for (const deal of recentDeals) {
            if (deal.modality) {
              modalityCounts.set(deal.modality, (modalityCounts.get(deal.modality) || 0) + 1);
            }
          }

          // Sort by count descending and take top 3
          modalitiesPrimary = Array.from(modalityCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([modality]) => modality);
        } else if (dealsError) {
          errors.push(`Failed to fetch deals for modalities for ${company.name} (${company.id}): ${dealsError.message}`);
        }

        // Step 2e: Derive actively_acquiring
        const activelyAcquiring = dealsLast12mo >= 1 || activeTrialsCount >= 3;

        // Step 2f: Recalculate data quality score
        const { error: qualityError } = await supabase.rpc('calculate_company_data_quality', {
          p_company_id: company.id,
        });

        if (qualityError) {
          errors.push(`RPC calculate_company_data_quality failed for ${company.name} (${company.id}): ${qualityError.message}`);
        }

        // Step 2g: Update the company with derived fields
        const updatePayload: Record<string, unknown> = {
          acquisition_appetite: acquisitionAppetite,
          actively_acquiring: activelyAcquiring,
        };

        // Only update modalities_primary if we have data
        if (modalitiesPrimary.length > 0) {
          updatePayload.modalities_primary = modalitiesPrimary;
        }

        const { error: updateError } = await supabase
          .from('companies')
          .update(updatePayload)
          .eq('id', company.id);

        if (updateError) {
          errors.push(`Failed to update derived fields for ${company.name} (${company.id}): ${updateError.message}`);
        } else {
          appetiteUpdated++;
        }

        companiesProcessed++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`Unexpected error processing company ${company.name} (${company.id}): ${message}`);
        companiesProcessed++;
      }
    }

    // If we got fewer results than a full page, we're done
    if (companies.length < PAGE_SIZE) {
      hasMore = false;
    } else {
      page++;
    }

    // If specific IDs were provided, no need to paginate further
    if (options?.companyIds && options.companyIds.length > 0) {
      hasMore = false;
    }
  }

  const durationMs = Date.now() - startTime;

  // Step 3: Log to data_ingestion_log
  const { error: logError } = await supabase.from('data_ingestion_log').insert({
    source: 'company_enrichment',
    status: errors.length === 0 ? 'success' : 'partial',
    records_processed: companiesProcessed,
    records_inserted: appetiteUpdated,
    errors: errors.length > 0 ? errors.slice(0, 50) : null,
    duration_ms: durationMs,
    metadata: {
      stats_updated: statsUpdated,
      appetite_updated: appetiteUpdated,
      full_refresh: options?.fullRefresh || false,
      specific_ids: options?.companyIds?.length || 0,
    },
  });

  if (logError) {
    console.error('Failed to write to data_ingestion_log:', logError.message);
  }

  console.log(
    `Company enrichment complete: ${companiesProcessed} processed, ${statsUpdated} stats updated, ${appetiteUpdated} appetite updated, ${errors.length} errors (${durationMs}ms)`
  );

  return {
    companies_processed: companiesProcessed,
    stats_updated: statsUpdated,
    appetite_updated: appetiteUpdated,
    errors,
  };
}
