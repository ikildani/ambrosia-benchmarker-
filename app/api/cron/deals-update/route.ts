import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';
import { runDailyIngestion } from '@/lib/ingestion/sec-edgar';
import { runWeeklyIngestion } from '@/lib/ingestion/clinical-trials';

export const maxDuration = 540; // 9 minutes max (SEC EDGAR + Clinical Trials)
export const dynamic = 'force-dynamic';

// Therapeutic area mapping from indication_category
const THERAPEUTIC_AREA_MAP: Record<string, string> = {
  solid_tumor: 'oncology',
  hematological: 'oncology',
  cns: 'neurology',
  autoimmune: 'autoimmune',
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
    console.log('Starting weekly data update...');
    console.log('Step 1: SEC EDGAR ingestion...');
    const edgarResult = await runDailyIngestion(supabase, anthropicApiKey, 7);

    // Step 2: Run ClinicalTrials.gov ingestion
    console.log('Step 2: ClinicalTrials.gov ingestion...');
    let trialsResult = { companies: 0, trials: 0, errors: [] as string[] };
    try {
      trialsResult = await runWeeklyIngestion(supabase);
    } catch (trialsError) {
      console.error('Clinical trials ingestion failed (non-fatal):', trialsError);
      trialsResult.errors.push(String(trialsError));
    }

    // Step 3: Backfill therapeutic_area on all deals with expanded mapping
    console.log('Step 3: Backfilling therapeutic_area (expanded mapping)...');
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

    // Step 4: Get current deal counts by all therapeutic areas
    console.log('Step 4: Counting deals by therapeutic area...');
    const { count: totalDeals } = await supabase
      .from('deals')
      .select('*', { count: 'exact', head: true });

    const allAreas = ['oncology', 'neurology', 'autoimmune', 'cardiovascular', 'infectious', 'metabolic', 'rare_disease', 'respiratory', 'dermatology', 'ophthalmology', 'other'];
    const counts: Record<string, number | null> = { total: totalDeals };

    for (const area of allAreas) {
      const { count } = await supabase
        .from('deals')
        .select('*', { count: 'exact', head: true })
        .eq('therapeutic_area', area);
      counts[area] = count;
    }

    const countsSummary = Object.entries(counts)
      .filter(([, v]) => v && v > 0)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');

    console.log(`Weekly data update complete. ${countsSummary}`);

    return NextResponse.json({
      success: true,
      edgar: {
        processed: edgarResult.processed,
        deals: edgarResult.deals,
        errors: edgarResult.errors.length,
      },
      clinicalTrials: {
        companies: trialsResult.companies,
        trials: trialsResult.trials,
        errors: trialsResult.errors.length,
      },
      backfillErrors,
      counts,
    });
  } catch (error) {
    console.error('Weekly data update error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
