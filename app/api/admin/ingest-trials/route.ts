import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';
import { COMPANIES_TO_TRACK, fetchCompanyTrials, inferModalityFromIntervention, inferIndicationFromConditions } from '@/lib/ingestion/clinical-trials';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

// Deduplicate company list
const UNIQUE_COMPANIES = [...new Set(COMPANIES_TO_TRACK)];
const BATCH_SIZE = 5;

export async function GET(request: NextRequest) {
  // Auth: require CRON_SECRET or ADMIN_API_KEY
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const adminKey = process.env.ADMIN_API_KEY;

  if (!cronSecret && !adminKey) {
    return NextResponse.json({ error: 'No auth configured' }, { status: 500 });
  }

  const token = authHeader?.replace('Bearer ', '') || '';
  const isValidCron = cronSecret && token.length === cronSecret.length &&
    timingSafeEqual(Buffer.from(token), Buffer.from(cronSecret));
  const isValidAdmin = adminKey && token.length === adminKey.length &&
    timingSafeEqual(Buffer.from(token), Buffer.from(adminKey));

  if (!isValidCron && !isValidAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const batchIndex = parseInt(searchParams.get('batch') || '0', 10);
  const totalBatches = Math.ceil(UNIQUE_COMPANIES.length / BATCH_SIZE);

  if (batchIndex < 0 || batchIndex >= totalBatches) {
    return NextResponse.json({
      error: `Invalid batch index. Valid range: 0-${totalBatches - 1}`,
      total_companies: UNIQUE_COMPANIES.length,
      total_batches: totalBatches,
    }, { status: 400 });
  }

  const batchCompanies = UNIQUE_COMPANIES.slice(
    batchIndex * BATCH_SIZE,
    (batchIndex + 1) * BATCH_SIZE
  );

  const supabase = createServiceClient();
  const results: { company: string; trials: number; error?: string }[] = [];

  for (const companyName of batchCompanies) {
    try {
      console.log(`[Batch ${batchIndex}] Processing ${companyName}...`);

      const trials = await fetchCompanyTrials(companyName);

      if (trials.length === 0) {
        results.push({ company: companyName, trials: 0 });
        continue;
      }

      // Find or create company
      let { data: company } = await supabase
        .from('companies')
        .select('id')
        .ilike('name', `%${companyName}%`)
        .limit(1)
        .single();

      if (!company) {
        const { data: newCompany } = await supabase
          .from('companies')
          .insert({
            name: companyName,
            name_variations: [companyName],
            data_sources: ['clinicaltrials'],
          })
          .select('id')
          .single();
        company = newCompany;
      }

      if (!company) {
        results.push({ company: companyName, trials: 0, error: 'Failed to find/create company' });
        continue;
      }

      // Aggregate modalities and indications from trials
      const modalities = new Set<string>();
      const indications = new Set<string>();
      let upsertCount = 0;

      for (const trial of trials) {
        const modality = inferModalityFromIntervention(trial.interventions);
        const indication = inferIndicationFromConditions(trial.conditions);

        const { error: upsertError } = await supabase
          .from('company_trials')
          .upsert({
            company_id: company.id,
            company_name: companyName,
            nct_id: trial.nctId,
            trial_title: trial.title,
            trial_acronym: trial.acronym,
            brief_summary: trial.briefSummary?.substring(0, 2000),
            intervention_name: trial.interventions[0]?.name || null,
            intervention_type: trial.interventions[0]?.type || null,
            modality,
            indication_category: indication.category,
            indication_specific: indication.specific,
            conditions: trial.conditions,
            phase: trial.phase,
            status: trial.status,
            is_collaboration: trial.collaborators.length > 0,
            collaborator_names: trial.collaborators,
            lead_sponsor_type: trial.sponsorType,
            locations_countries: trial.locations,
            enrollment_count: trial.enrollmentCount,
            start_date: trial.startDate,
            primary_completion_date: trial.primaryCompletionDate,
            completion_date: trial.completionDate,
            results_available: trial.hasResults,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'company_id,nct_id',
          });

        if (!upsertError) upsertCount++;
        if (modality && modality !== 'other') modalities.add(modality);
        if (indication.category) indications.add(indication.category);
      }

      // Recount active trials from DB
      const { count: activeTrialsCount } = await supabase
        .from('company_trials')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', company.id)
        .in('status', ['recruiting', 'active_not_recruiting', 'not_yet_recruiting', 'enrolling_by_invitation']);

      // Update company with REAL data (replace, don't merge with fabricated)
      await supabase
        .from('companies')
        .update({
          modalities_active: Array.from(modalities),
          indications_active: Array.from(indications),
          active_trials_count: activeTrialsCount || 0,
          data_sources: ['clinicaltrials'],
          last_enriched_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', company.id);

      results.push({ company: companyName, trials: upsertCount });

      // Rate limit between companies
      await new Promise(r => setTimeout(r, 500));

    } catch (error) {
      results.push({ company: companyName, trials: 0, error: String(error) });
    }
  }

  const totalTrials = results.reduce((sum, r) => sum + r.trials, 0);
  const errors = results.filter(r => r.error);

  return NextResponse.json({
    batch: batchIndex,
    total_batches: totalBatches,
    companies_processed: results.length,
    total_trials_upserted: totalTrials,
    errors: errors.length,
    results,
    next_batch: batchIndex + 1 < totalBatches ? batchIndex + 1 : null,
  });
}
