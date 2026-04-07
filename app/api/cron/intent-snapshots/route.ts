import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { calculatePharmaIntent } from '@/lib/services/pharma-intent';
import type { TrialForIntent, DealForIntent } from '@/lib/services/pharma-intent';
import { timingSafeEqual } from 'crypto';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

// Top 5 modality x indication combos to snapshot per company
const TOP_COMBOS = [
  { modality: 'small_molecule', indication: 'oncology' },
  { modality: 'antibody', indication: 'immunology' },
  { modality: 'adc', indication: 'oncology' },
  { modality: 'gene_therapy', indication: 'rareDisease' },
  { modality: 'cell_therapy', indication: 'hematology' },
];

// IntentTrendResult and getIntentTrend moved to lib/services/intent-trend.ts

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

  const isValid =
    isValidLength &&
    timingSafeEqual(Buffer.from(tokenToCompare), Buffer.from(expectedToken));

  if (!isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createServiceClient();
    // 1. Fetch top 100 companies by data_quality_score
    const { data: companies, error: compError } = await supabase
      .from('companies')
      .select(
        'id, name, company_type, modalities_active, modalities_primary, indications_active, indications_specific, deals_last_12mo, deals_last_24mo, last_deal_date, last_deal_modality, last_deal_indication, active_trials_count, acquisition_appetite, actively_acquiring, strategic_priorities, data_quality_score, patent_cliffs, revenue_at_risk_2025, revenue_at_risk_2026, revenue_at_risk_2027'
      )
      .gte('data_quality_score', 30)
      .order('data_quality_score', { ascending: false })
      .limit(100);

    if (compError || !companies) {
      throw new Error(`Failed to fetch companies: ${compError?.message ?? 'No data'}`);
    }

    const companyIds = companies.map((c) => c.id);

    // 2. Pre-fetch deals and trials in parallel
    const twoYearsAgo = new Date(Date.now() - 24 * 30 * 24 * 60 * 60 * 1000).toISOString();

    const [dealsResult, trialsResult] = await Promise.all([
      supabase
        .from('deals')
        .select(
          'id, licensor_id, licensee_id, licensee_name, modality, indication_category, indication_specific, announced_date, deal_type, upfront_usd, total_deal_value_usd, therapeutic_area'
        )
        .or(`licensor_id.in.(${companyIds.join(',')}),licensee_id.in.(${companyIds.join(',')})`)
        .gte('announced_date', twoYearsAgo)
        .order('announced_date', { ascending: false }),
      supabase
        .from('company_trials')
        .select(
          'company_id, modality, indication_category, indication_specific, phase, status, enrollment_count, is_collaboration, primary_completion_date'
        )
        .in('company_id', companyIds)
        .in('status', ['recruiting', 'active_not_recruiting', 'not_yet_recruiting']),
    ]);

    // Build maps
    const companyDealsMap = new Map<string, DealForIntent[]>();
    if (dealsResult.data) {
      for (const deal of dealsResult.data) {
        if (deal.licensor_id) {
          const existing = companyDealsMap.get(deal.licensor_id) || [];
          existing.push(deal as DealForIntent);
          companyDealsMap.set(deal.licensor_id, existing);
        }
        if (deal.licensee_id) {
          const existing = companyDealsMap.get(deal.licensee_id) || [];
          existing.push(deal as DealForIntent);
          companyDealsMap.set(deal.licensee_id, existing);
        }
      }
    }

    const companyTrialsMap = new Map<string, TrialForIntent[]>();
    if (trialsResult.data) {
      for (const trial of trialsResult.data) {
        const existing = companyTrialsMap.get(trial.company_id) || [];
        existing.push(trial as TrialForIntent);
        companyTrialsMap.set(trial.company_id, existing);
      }
    }

    const allDealsFlat = dealsResult.data ? (dealsResult.data as DealForIntent[]) : [];

    // 3. Calculate and store snapshots
    const today = new Date().toISOString().split('T')[0];
    let snapshotCount = 0;
    let errorCount = 0;

    const rows: Array<{
      company_id: string;
      modality: string;
      indication: string;
      intent_score: number;
      intent_tier: string;
      factors: unknown;
      snapshot_date: string;
    }> = [];

    for (const company of companies) {
      const companyDeals = companyDealsMap.get(company.id) || [];
      const companyTrials = companyTrialsMap.get(company.id) || [];

      for (const combo of TOP_COMBOS) {
        try {
          const result = calculatePharmaIntent(
            company,
            combo.modality,
            combo.indication,
            companyDeals,
            companyTrials,
            allDealsFlat,
            undefined,
            undefined,
            undefined,
            combo.indication, // targetTA
          );

          rows.push({
            company_id: company.id,
            modality: combo.modality,
            indication: combo.indication,
            intent_score: result.intentScore,
            intent_tier: result.intentTier,
            factors: result.factors,
            snapshot_date: today,
          });

          snapshotCount++;
        } catch {
          errorCount++;
        }
      }
    }

    // 4. Upsert all snapshots (batch insert with conflict handling)
    if (rows.length > 0) {
      // Insert in batches of 100 to avoid payload limits
      const batchSize = 100;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const { error: insertError } = await supabase
          .from('intent_score_snapshots')
          .upsert(batch, {
            onConflict: 'company_id,modality,indication,snapshot_date',
          });

        if (insertError) {
          console.error(`[IntentSnapshots] Insert error (batch ${i / batchSize + 1}):`, insertError.message);
          errorCount += batch.length;
          snapshotCount -= batch.length;
        }
      }
    }

    return NextResponse.json({
      success: true,
      snapshots: snapshotCount,
      errors: errorCount,
      companies: companies.length,
      combos: TOP_COMBOS.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[IntentSnapshots] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
