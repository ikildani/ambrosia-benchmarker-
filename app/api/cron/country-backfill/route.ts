/**
 * Country Backfill — One-time (re-runnable) cron to classify geography
 * for all existing deals and companies that don't have country data yet.
 *
 * Processes deals in batches of 50 with a 4-minute time budget.
 * Idempotent: only updates rows where licensor_country IS NULL.
 *
 * Also backfills companies.headquarters_country where missing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';
import {
  classifyCompanyCountry,
  classifyAndEnrichDeal,
} from '@/lib/ingestion/company-geography';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const MAX_RUNTIME_MS = 240_000;
const BATCH_SIZE = 50;

export async function GET(request: NextRequest) {
  const cronSecret = request.headers.get('authorization')?.replace('Bearer ', '');
  const expected = process.env.CRON_SECRET;
  if (!expected || !cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    if (!timingSafeEqual(Buffer.from(cronSecret), Buffer.from(expected))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  const supabase = createServiceClient();

  let dealsUpdated = 0;
  let companiesUpdated = 0;
  let dealsProcessed = 0;
  let dealsSkipped = 0;
  const errors: string[] = [];
  const corridorCounts: Record<string, number> = {};
  const countryCounts: Record<string, number> = {};

  try {
    // ── Phase 1: Backfill companies ──────────────────────────────────
    console.log('[country-backfill] Phase 1: Backfilling companies...');

    const { data: unclassifiedCompanies } = await supabase
      .from('companies')
      .select('id, name')
      .is('headquarters_country', null)
      .limit(500);

    if (unclassifiedCompanies) {
      for (const company of unclassifiedCompanies) {
        if (Date.now() - startTime > MAX_RUNTIME_MS) break;

        const geo = classifyCompanyCountry(company.name);
        if (geo.confidence !== 'low') {
          const { error } = await supabase
            .from('companies')
            .update({
              headquarters_country: geo.country,
              headquarters_region: geo.region,
            })
            .eq('id', company.id);

          if (!error) {
            companiesUpdated++;
            console.log(`[country-backfill] Company: ${company.name} → ${geo.country} (${geo.confidence})`);
          } else {
            errors.push(`Company update error ${company.name}: ${error.message}`);
          }
        }
      }
    }

    console.log(`[country-backfill] Phase 1 complete: ${companiesUpdated} companies classified`);

    // ── Phase 2: Backfill deals ──────────────────────────────────────
    console.log('[country-backfill] Phase 2: Backfilling deals...');

    let hasMore = true;
    let offset = 0;

    while (hasMore && Date.now() - startTime < MAX_RUNTIME_MS) {
      const { data: deals, error: fetchError } = await supabase
        .from('deals')
        .select('id, licensor_name, licensee_name')
        .is('licensor_country', null)
        .order('id')
        .range(offset, offset + BATCH_SIZE - 1);

      if (fetchError) {
        errors.push(`Fetch error at offset ${offset}: ${fetchError.message}`);
        break;
      }

      if (!deals || deals.length === 0) {
        hasMore = false;
        break;
      }

      for (const deal of deals) {
        if (Date.now() - startTime > MAX_RUNTIME_MS) {
          hasMore = false;
          break;
        }

        dealsProcessed++;

        if (!deal.licensor_name && !deal.licensee_name) {
          dealsSkipped++;
          continue;
        }

        const geo = classifyAndEnrichDeal(
          deal.licensor_name || '',
          deal.licensee_name || '',
        );

        const updatePayload: Record<string, unknown> = {
          licensor_country: geo.licensor_country !== 'unknown' ? geo.licensor_country : null,
          licensee_country: geo.licensee_country !== 'unknown' ? geo.licensee_country : null,
          licensor_region: geo.licensor_region !== 'unknown' ? geo.licensor_region : null,
          licensee_region: geo.licensee_region !== 'unknown' ? geo.licensee_region : null,
          cross_border: geo.cross_border,
          deal_corridor: geo.deal_corridor,
        };

        const { error: updateError } = await supabase
          .from('deals')
          .update(updatePayload)
          .eq('id', deal.id);

        if (updateError) {
          errors.push(`Deal update error ${deal.id}: ${updateError.message}`);
        } else {
          dealsUpdated++;

          if (geo.deal_corridor) {
            corridorCounts[geo.deal_corridor] = (corridorCounts[geo.deal_corridor] || 0) + 1;
          }
          if (geo.licensor_country !== 'unknown') {
            countryCounts[geo.licensor_country] = (countryCounts[geo.licensor_country] || 0) + 1;
          }
        }
      }

      offset += BATCH_SIZE;
    }

    console.log(`[country-backfill] Phase 2 complete: ${dealsUpdated}/${dealsProcessed} deals classified`);

    // ── Log results ──────────────────────────────────────────────────
    const duration = Math.round((Date.now() - startTime) / 1000);

    await supabase.from('data_ingestion_log').insert({
      source: 'country_backfill',
      status: errors.length > 0 ? 'partial' : 'success',
      records_processed: dealsProcessed,
      records_inserted: dealsUpdated,
      duration_seconds: duration,
      error_details: errors.length > 0 ? errors.slice(0, 10) : null,
      metadata: {
        companies_updated: companiesUpdated,
        deals_skipped: dealsSkipped,
        top_corridors: Object.entries(corridorCounts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10)
          .map(([corridor, count]) => `${corridor}: ${count}`),
        top_countries: Object.entries(countryCounts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10)
          .map(([country, count]) => `${country}: ${count}`),
        timed_out: Date.now() - startTime >= MAX_RUNTIME_MS,
      },
    });

    return NextResponse.json({
      success: true,
      duration: `${duration}s`,
      companies_updated: companiesUpdated,
      deals_processed: dealsProcessed,
      deals_updated: dealsUpdated,
      deals_skipped: dealsSkipped,
      top_corridors: Object.entries(corridorCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10),
      top_countries: Object.entries(countryCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10),
      errors: errors.slice(0, 5),
      timed_out: Date.now() - startTime >= MAX_RUNTIME_MS,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[country-backfill] Fatal error: ${message}`);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
