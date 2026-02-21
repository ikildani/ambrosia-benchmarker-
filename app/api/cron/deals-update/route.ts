import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';
import { runDailyIngestion } from '@/lib/ingestion/sec-edgar';
import { runPressReleaseIngestion } from '@/lib/ingestion/press-releases';
import { runOpenFDAIngestion } from '@/lib/ingestion/openfda';

export const maxDuration = 300; // 5 minutes max
export const dynamic = 'force-dynamic';

// Therapeutic area mapping from indication_category
const THERAPEUTIC_AREA_MAP: Record<string, string> = {
  solid_tumor: 'oncology',
  hematological: 'oncology',
  cns: 'neurology',
  autoimmune: 'immunology',
  cardiovascular: 'cardiovascular',
  infectious: 'infectious',
  metabolic: 'metabolic',
  rare_disease: 'rare_disease',
  respiratory: 'respiratory',
  dermatology: 'dermatology',
  ophthalmology: 'ophthalmology',
};

export async function GET(request: NextRequest) {
  // Security: Require cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error('CRON_SECRET environment variable is not set');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const expectedToken = `Bearer ${cronSecret}`;
  const providedToken = authHeader || '';

  const isValidLength = providedToken.length === expectedToken.length;
  const tokenToCompare = isValidLength ? providedToken : expectedToken;

  const isValid = isValidLength && timingSafeEqual(
    Buffer.from(tokenToCompare),
    Buffer.from(expectedToken)
  );

  if (!isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createServiceClient();
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

    if (!anthropicApiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
    }

    // Step 1: Run SEC EDGAR ingestion for past 7 days
    console.log('Starting weekly deals update...');
    console.log('Step 1: SEC EDGAR ingestion...');
    const edgarResult = await runDailyIngestion(supabase, anthropicApiKey, 7);

    // Step 1b: Run press release ingestion (5 RSS sources)
    console.log('Step 1b: Press release ingestion...');
    let pressResult = { deals_inserted: 0, errors: [] as string[] };
    try {
      pressResult = await runPressReleaseIngestion(supabase, anthropicApiKey, {
        maxArticlesPerSource: 5, // Conservative for cron — full runs via admin endpoint
      });
      console.log(`Press releases: ${pressResult.deals_inserted} deals inserted`);
    } catch (error) {
      console.error('Press release ingestion error (non-fatal):', error);
    }

    // Step 1c: Run OpenFDA approvals ingestion (last 14 days)
    console.log('Step 1c: OpenFDA approvals ingestion...');
    let fdaResult = { inserted: 0, errors: [] as string[] };
    try {
      fdaResult = await runOpenFDAIngestion(supabase, { daysBack: 14 });
      console.log(`OpenFDA: ${fdaResult.inserted} approvals inserted`);
    } catch (error) {
      console.error('OpenFDA ingestion error (non-fatal):', error);
    }

    // Step 2: Backfill therapeutic_area on all deals with expanded mapping
    console.log('Step 2: Backfilling therapeutic_area (expanded mapping)...');
    const backfillErrors: string[] = [];

    for (const [indicationCategory, therapeuticArea] of Object.entries(THERAPEUTIC_AREA_MAP)) {
      const { error } = await supabase
        .from('deals')
        .update({ therapeutic_area: therapeuticArea })
        .eq('indication_category', indicationCategory)
        .is('therapeutic_area', null);

      if (error) {
        backfillErrors.push(`${indicationCategory}: ${error.message}`);
      }
    }

    // Catch-all: any deals still without therapeutic_area get 'other'
    const { error: backfillDefaultError } = await supabase
      .from('deals')
      .update({ therapeutic_area: 'other' })
      .is('therapeutic_area', null);

    if (backfillDefaultError) {
      backfillErrors.push(`default: ${backfillDefaultError.message}`);
    }

    // Step 3: Get current deal counts by all therapeutic areas
    console.log('Step 3: Counting deals by therapeutic area...');
    const { count: totalDeals } = await supabase
      .from('deals')
      .select('*', { count: 'exact', head: true });

    const allAreas = ['oncology', 'neurology', 'immunology', 'cardiovascular', 'infectious', 'metabolic', 'rare_disease', 'respiratory', 'dermatology', 'ophthalmology', 'other'];
    const counts: Record<string, number | null> = { total: totalDeals };

    for (const area of allAreas) {
      const { count } = await supabase
        .from('deals')
        .select('*', { count: 'exact', head: true })
        .eq('therapeutic_area', area);
      counts[area] = count;
    }

    // Step 5: Link deals to companies by name matching
    console.log('Step 5: Linking deals to companies...');
    let linkedLicensees = 0;
    let linkedLicensors = 0;

    const { data: unlinkedLicensees } = await supabase
      .from('deals')
      .select('id, licensee_name')
      .is('licensee_id', null)
      .not('licensee_name', 'is', null);

    // Fetch all companies once (shared between licensee and licensor linking)
    // Include name_variations for fuzzy matching (SEC filings use legal names like "Pfizer Inc.")
    const { data: allCompanies } = await supabase
      .from('companies')
      .select('id, name, name_variations');
    const nameToId = new Map<string, string>();
    for (const c of allCompanies || []) {
      nameToId.set(c.name.toLowerCase(), c.id);
      for (const v of c.name_variations || []) {
        nameToId.set(v.toLowerCase(), c.id);
      }
    }

    // PERFORMANCE: Batch updates by company_id to avoid N+1 per-deal updates
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

    console.log(`Linked ${linkedLicensees} licensee IDs + ${linkedLicensors} licensor IDs`);

    // Step 6: Recalculate deal stats for all affected companies
    console.log('Step 6: Recalculating company deal stats...');
    const affectedCompanyIds = new Set<string>();

    // Collect all company IDs that were just linked
    if (unlinkedLicensees) {
      for (const deal of unlinkedLicensees) {
        const companyId = nameToId.get(deal.licensee_name.toLowerCase());
        if (companyId) affectedCompanyIds.add(companyId);
      }
    }
    if (unlinkedLicensors) {
      for (const deal of unlinkedLicensors) {
        const companyId = nameToId.get(deal.licensor_name.toLowerCase());
        if (companyId) affectedCompanyIds.add(companyId);
      }
    }

    let statsUpdated = 0;
    for (const companyId of affectedCompanyIds) {
      const { error: rpcError } = await supabase.rpc('update_company_deal_stats', { p_company_id: companyId });
      if (!rpcError) statsUpdated++;
    }
    console.log(`Recalculated deal stats for ${statsUpdated}/${affectedCompanyIds.size} companies`);

    const countsSummary = Object.entries(counts)
      .filter(([, v]) => v && v > 0)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');

    console.log(`Weekly deals update complete. ${countsSummary}`);

    return NextResponse.json({
      success: true,
      edgar: {
        processed: edgarResult.processed,
        deals: edgarResult.deals,
        errors: edgarResult.errors.length,
      },
      pressReleases: {
        deals_inserted: pressResult.deals_inserted,
        errors: pressResult.errors.length,
      },
      fdaApprovals: {
        inserted: fdaResult.inserted,
        errors: fdaResult.errors.length,
      },
      backfillErrors,
      linked: { licensees: linkedLicensees, licensors: linkedLicensors },
      statsRecalculated: statsUpdated,
      counts,
    });
  } catch (error) {
    console.error('Weekly deals update error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
