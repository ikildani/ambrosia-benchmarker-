import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';
import { runDailyIngestion } from '@/lib/ingestion/sec-edgar';
import { runPressReleaseIngestion } from '@/lib/ingestion/press-releases';
import { runOpenFDAIngestion } from '@/lib/ingestion/openfda';

export const maxDuration = 300; // 5 minutes max
export const dynamic = 'force-dynamic';

// Therapeutic area mapping from indication_category — comprehensive to avoid oncology catch-all
const THERAPEUTIC_AREA_MAP: Record<string, string> = {
  // Oncology (only true oncology categories)
  solid_tumor: 'oncology',
  solid_tumors: 'oncology',
  hematological: 'oncology',
  hematologic: 'oncology',
  heme_onc: 'oncology',
  head_and_neck_cancer: 'oncology',
  leukemia: 'oncology',
  lymphoma: 'oncology',
  multiple_myeloma: 'oncology',
  lung_cancer: 'oncology',
  breast_cancer: 'oncology',
  prostate_cancer: 'oncology',
  colorectal_cancer: 'oncology',
  pancreatic_cancer: 'oncology',
  liver_cancer: 'oncology',
  renal_cell_carcinoma: 'oncology',
  melanoma: 'oncology',
  glioblastoma: 'oncology',
  bladder_cancer: 'oncology',
  ovarian_cancer: 'oncology',

  // Neurology
  cns: 'neurology',
  alzheimers: 'neurology',
  parkinsons: 'neurology',
  epilepsy: 'neurology',
  migraine: 'neurology',
  neuropathy: 'neurology',
  als: 'neurology',
  ms: 'neurology',
  multiple_sclerosis: 'neurology',
  huntingtons: 'neurology',
  schizophrenia: 'neurology',
  depression: 'neurology',

  // Immunology / Autoimmune
  autoimmune: 'immunology',
  lupus: 'immunology',
  rheumatoid: 'immunology',
  crohns: 'immunology',
  ulcerative_colitis: 'immunology',
  psoriatic_arthritis: 'immunology',
  atopic_dermatitis: 'immunology',
  ankylosing_spondylitis: 'immunology',

  // Metabolic
  metabolic: 'metabolic',
  obesity: 'metabolic',
  nashMash: 'metabolic',
  nash: 'metabolic',
  mash: 'metabolic',
  diabetes: 'metabolic',
  dyslipidemia: 'metabolic',
  type2_diabetes: 'metabolic',
  gout: 'metabolic',

  // Cardiovascular
  cardiovascular: 'cardiovascular',
  cardiomyopathy: 'cardiovascular',
  heart_failure: 'cardiovascular',
  hypertension: 'cardiovascular',
  thrombosis: 'cardiovascular',
  atrial_fibrillation: 'cardiovascular',
  atherosclerosis: 'cardiovascular',
  pulmonary_hypertension: 'cardiovascular',

  // Infectious Disease
  infectious: 'infectiousDisease',
  infectious_disease: 'infectiousDisease',
  influenza: 'infectiousDisease',
  hiv: 'infectiousDisease',
  hepatitis: 'infectiousDisease',
  covid: 'infectiousDisease',
  rsv: 'infectiousDisease',
  antibiotic: 'infectiousDisease',
  antiviral: 'infectiousDisease',

  // Rare Disease
  rare_disease: 'rareDisease',
  rare: 'rareDisease',
  orphan: 'rareDisease',
  muscular_dystrophy: 'rareDisease',
  cystic_fibrosis: 'rareDisease',
  sickle_cell: 'rareDisease',
  sma: 'rareDisease',
  lysosomal: 'rareDisease',

  // Ophthalmology
  ophthalmology: 'ophthalmology',
  retinal: 'ophthalmology',
  macular_degeneration: 'ophthalmology',
  glaucoma: 'ophthalmology',
  dry_eye: 'ophthalmology',

  // Women's Health
  reproductive: 'womensHealth',
  gynecology: 'womensHealth',
  obstetric: 'womensHealth',
  breastCancer: 'womensHealth',
  fertility: 'womensHealth',
  endometriosis: 'womensHealth',

  // Hematology (non-oncology)
  hematology: 'hematology',
  hemophilia: 'hematology',
  anemia: 'hematology',
  thalassemia: 'hematology',
  blood: 'hematology',

  // Dermatology
  dermatology: 'dermatology',
  skin: 'dermatology',
  psoriasis: 'dermatology',
  eczema: 'dermatology',
  acne: 'dermatology',
  vitiligo: 'dermatology',
  alopecia: 'dermatology',

  // Respiratory
  respiratory: 'respiratory',
  asthma: 'respiratory',
  copd: 'respiratory',
  ipf: 'respiratory',

  // Gastroenterology
  gastroenterology: 'gastroenterology',
  gi: 'gastroenterology',
  ibd: 'gastroenterology',
  celiac: 'gastroenterology',
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
    const startTime = Date.now();
    const TIME_BUDGET = 250_000; // 250s safe margin for 300s Vercel limit
    const supabase = createServiceClient();
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

    if (!anthropicApiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
    }

    // Step 1: Run SEC EDGAR ingestion for past 7 days
    console.log('Starting weekly deals update...');
    console.log('Step 1: SEC EDGAR ingestion...');
    const edgarResult = await runDailyIngestion(supabase, anthropicApiKey, 7);

    // Step 1b: Run press release ingestion (time-budgeted)
    console.log('Step 1b: Press release ingestion...');
    let pressResult = { deals_inserted: 0, errors: [] as string[] };
    const pressTimeBudget = Math.max(60_000, TIME_BUDGET - (Date.now() - startTime) - 30_000);
    try {
      pressResult = await runPressReleaseIngestion(supabase, anthropicApiKey, {
        maxArticlesPerSource: 10,
        timeBudgetMs: pressTimeBudget,
      });
      console.log(`Press releases: ${pressResult.deals_inserted} deals inserted`);
    } catch (error) {
      console.error('Press release ingestion error (non-fatal):', error);
    }

    // Step 1c: Run OpenFDA approvals ingestion (last 14 days) — fast, no AI
    console.log('Step 1c: OpenFDA approvals ingestion...');
    let fdaResult = { inserted: 0, errors: [] as string[] };
    if (Date.now() - startTime < TIME_BUDGET) {
      try {
        fdaResult = await runOpenFDAIngestion(supabase, { daysBack: 14 });
        console.log(`OpenFDA: ${fdaResult.inserted} approvals inserted`);
      } catch (error) {
        console.error('OpenFDA ingestion error (non-fatal):', error);
      }
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

    const allAreas = ['oncology', 'neurology', 'immunology', 'cardiovascular', 'infectiousDisease', 'metabolic', 'rareDisease', 'respiratory', 'dermatology', 'ophthalmology', 'hematology', 'gastroenterology', 'womensHealth', 'other'];
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

    // Step 7: Auto-promote companies with real deal activity
    // Companies discovered by pipelines start with actively_acquiring=false.
    // Promote them when they have enough signal to be useful in partner matching.
    console.log('Step 7: Auto-promoting companies with deal activity...');
    let promoted = 0;

    const { data: promotionCandidates } = await supabase
      .from('companies')
      .select('id, name, deals_last_12mo, deals_last_24mo, active_trials_count, data_quality_score')
      .eq('actively_acquiring', false)
      .gte('data_quality_score', 40)
      .or('deals_last_12mo.gt.0,deals_last_24mo.gte.2,active_trials_count.gte.3');

    if (promotionCandidates && promotionCandidates.length > 0) {
      const promoteIds = promotionCandidates.map((c: any) => c.id);
      const { error: promoteError } = await supabase
        .from('companies')
        .update({ actively_acquiring: true })
        .in('id', promoteIds);

      if (!promoteError) {
        promoted = promoteIds.length;
        console.log(`Auto-promoted ${promoted} companies: ${promotionCandidates.map((c: any) => c.name).join(', ')}`);
      }
    }

    const countsSummary = Object.entries(counts)
      .filter(([, v]) => v && v > 0)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');

    console.log(`Weekly deals update complete. ${countsSummary}`);

    // Track overall health — flag if ALL sources failed
    const totalInserted = (edgarResult.deals || 0) + (pressResult.deals_inserted || 0) + (fdaResult.inserted || 0);
    const totalErrors = (edgarResult.errors?.length || 0) + (pressResult.errors?.length || 0) + (fdaResult.errors?.length || 0) + backfillErrors.length;
    const hasPartialFailure = totalErrors > 0;

    // Slack notification for deal ingestion results
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (webhookUrl && totalInserted > 0) {
      fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `Deal ingestion: ${totalInserted} new deals`,
          attachments: [{
            color: totalErrors === 0 ? '#16a34a' : '#f59e0b',
            blocks: [
              { type: 'header', text: { type: 'plain_text', text: `Deal Ingestion Complete — ${totalInserted} New Deals` } },
              { type: 'section', fields: [
                { type: 'mrkdwn', text: `*SEC EDGAR:*\n${edgarResult.deals || 0} deals` },
                { type: 'mrkdwn', text: `*Press Releases:*\n${pressResult.deals_inserted || 0} deals` },
                { type: 'mrkdwn', text: `*OpenFDA:*\n${fdaResult.inserted || 0} approvals` },
                { type: 'mrkdwn', text: `*Errors:*\n${totalErrors}` },
                { type: 'mrkdwn', text: `*Total in DB:*\n${totalDeals ?? '?'}` },
              ]},
            ],
          }],
        }),
      }).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      health: hasPartialFailure ? 'partial_failure' : 'healthy',
      totalInserted,
      totalErrors,
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
      autoPromoted: promoted,
      counts,
    });
  } catch (error) {
    console.error('Weekly deals update error:', error);
    return NextResponse.json({ error: 'Weekly deals update failed' }, { status: 500 });
  }
}
