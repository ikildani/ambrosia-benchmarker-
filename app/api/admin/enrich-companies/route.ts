import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { runDailyIngestion } from '@/lib/ingestion/sec-edgar';
import { verifyAdminAuth } from '@/lib/admin-auth';

export const maxDuration = 300; // 5 minutes max
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/enrich-companies
 *
 * Orchestrates a full company enrichment cycle:
 * 1. Runs SEC EDGAR ingestion with configurable lookback (default 180 days for backfill)
 * 2. Links unlinked deals to companies using name + name_variations
 * 3. Recalculates deal stats for ALL companies with linked deals
 *
 * Auth: Bearer $ADMIN_API_KEY
 * Body: { "daysBack": 180 }
 */
export async function POST(request: NextRequest) {
  // Admin auth: timing-safe Bearer token or authenticated admin email
  const authError = await verifyAdminAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json().catch(() => ({}));
    const daysBack = body.daysBack || 180;

    const supabase = createServiceClient();
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

    if (!anthropicApiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
    }

    const steps: Record<string, unknown> = {};

    // Step 1: Run SEC EDGAR ingestion with configurable lookback
    console.log(`[enrich] Step 1: SEC EDGAR ingestion (${daysBack} days)...`);
    const edgarResult = await runDailyIngestion(supabase, anthropicApiKey, daysBack);
    steps.edgar = {
      processed: edgarResult.processed,
      deals: edgarResult.deals,
      errors: edgarResult.errors.length,
    };
    console.log(`[enrich] EDGAR: ${edgarResult.processed} processed, ${edgarResult.deals} deals extracted`);

    // Step 2: Link unlinked deals to companies using name + name_variations
    console.log('[enrich] Step 2: Linking deals to companies (with name_variations)...');

    const { data: allCompanies } = await supabase
      .from('companies')
      .select('id, name, name_variations');

    // Build name-to-id map including all variations
    const nameToId = new Map<string, string>();
    for (const c of allCompanies || []) {
      nameToId.set(c.name.toLowerCase(), c.id);
      for (const v of c.name_variations || []) {
        nameToId.set(v.toLowerCase(), c.id);
      }
    }

    let linkedLicensees = 0;
    let linkedLicensors = 0;

    // Link unlinked licensees
    const { data: unlinkedLicensees } = await supabase
      .from('deals')
      .select('id, licensee_name')
      .is('licensee_id', null)
      .not('licensee_name', 'is', null);

    if (unlinkedLicensees && unlinkedLicensees.length > 0) {
      const updatesByCompany = new Map<string, string[]>();
      for (const deal of unlinkedLicensees) {
        const companyId = nameToId.get(deal.licensee_name.toLowerCase());
        if (companyId) {
          const ids = updatesByCompany.get(companyId) || [];
          ids.push(deal.id);
          updatesByCompany.set(companyId, ids);
        }
      }
      for (const [companyId, dealIds] of updatesByCompany) {
        await supabase.from('deals').update({ licensee_id: companyId }).in('id', dealIds);
        linkedLicensees += dealIds.length;
      }
    }

    // Link unlinked licensors
    const { data: unlinkedLicensors } = await supabase
      .from('deals')
      .select('id, licensor_name')
      .is('licensor_id', null)
      .not('licensor_name', 'is', null);

    if (unlinkedLicensors && unlinkedLicensors.length > 0) {
      const updatesByCompany = new Map<string, string[]>();
      for (const deal of unlinkedLicensors) {
        const companyId = nameToId.get(deal.licensor_name.toLowerCase());
        if (companyId) {
          const ids = updatesByCompany.get(companyId) || [];
          ids.push(deal.id);
          updatesByCompany.set(companyId, ids);
        }
      }
      for (const [companyId, dealIds] of updatesByCompany) {
        await supabase.from('deals').update({ licensor_id: companyId }).in('id', dealIds);
        linkedLicensors += dealIds.length;
      }
    }

    steps.linking = {
      unlinked_licensees_found: unlinkedLicensees?.length || 0,
      unlinked_licensors_found: unlinkedLicensors?.length || 0,
      linked_licensees: linkedLicensees,
      linked_licensors: linkedLicensors,
    };
    console.log(`[enrich] Linked ${linkedLicensees} licensees + ${linkedLicensors} licensors`);

    // Step 3: Recalculate deal stats for ALL companies with linked deals
    console.log('[enrich] Step 3: Recalculating company deal stats...');

    // Get all unique company IDs that have deals linked (either as licensee or licensor)
    const { data: licenseeDeals } = await supabase
      .from('deals')
      .select('licensee_id')
      .not('licensee_id', 'is', null);

    const { data: licensorDeals } = await supabase
      .from('deals')
      .select('licensor_id')
      .not('licensor_id', 'is', null);

    const affectedIds = new Set<string>();
    for (const d of licenseeDeals || []) {
      if (d.licensee_id) affectedIds.add(d.licensee_id);
    }
    for (const d of licensorDeals || []) {
      if (d.licensor_id) affectedIds.add(d.licensor_id);
    }

    let statsUpdated = 0;
    let statsFailed = 0;
    const statsErrors: string[] = [];

    for (const companyId of affectedIds) {
      const { error } = await supabase.rpc('update_company_deal_stats', { p_company_id: companyId });
      if (error) {
        statsFailed++;
        statsErrors.push(`${companyId}: ${error.message}`);
      } else {
        statsUpdated++;
      }
    }

    // Also recalculate data quality for all affected companies
    for (const companyId of affectedIds) {
      await supabase.rpc('calculate_company_data_quality', { p_company_id: companyId });
    }

    steps.stats = {
      companies_with_deals: affectedIds.size,
      stats_updated: statsUpdated,
      stats_failed: statsFailed,
      errors: statsErrors.slice(0, 10),
    };
    console.log(`[enrich] Stats: ${statsUpdated} updated, ${statsFailed} failed`);

    // Step 4: Update last_enriched_at for all companies
    const { error: enrichTimestampError } = await supabase
      .from('companies')
      .update({ last_enriched_at: new Date().toISOString() })
      .in('id', Array.from(affectedIds));

    steps.timestamp_update = {
      updated: !enrichTimestampError,
      error: enrichTimestampError?.message,
    };

    return NextResponse.json({
      success: true,
      daysBack,
      steps,
    });
  } catch (error) {
    console.error('[enrich] Error:', error);
    return NextResponse.json({ error: 'Company enrichment failed' }, { status: 500 });
  }
}
