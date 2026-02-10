import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';
import { runDailyIngestion } from '@/lib/ingestion/sec-edgar';

export const maxDuration = 300; // 5 minutes max
export const dynamic = 'force-dynamic';

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
    const edgarResult = await runDailyIngestion(supabase, anthropicApiKey, 7);

    // Step 2: Backfill therapeutic_area on any deals missing it
    console.log('Backfilling therapeutic_area...');

    const { error: backfillNeuroError } = await supabase
      .from('deals')
      .update({ therapeutic_area: 'neurology' })
      .eq('indication_category', 'cns')
      .is('therapeutic_area', null);

    const { error: backfillOncoError } = await supabase
      .from('deals')
      .update({ therapeutic_area: 'oncology' })
      .in('indication_category', ['solid_tumor', 'hematological'])
      .is('therapeutic_area', null);

    const { error: backfillDefaultError } = await supabase
      .from('deals')
      .update({ therapeutic_area: 'other' })
      .is('therapeutic_area', null);

    const backfillErrors = [backfillNeuroError, backfillOncoError, backfillDefaultError]
      .filter(Boolean)
      .map(e => e!.message);

    // Get current deal counts by therapeutic area
    const { count: totalDeals } = await supabase
      .from('deals')
      .select('*', { count: 'exact', head: true });

    const { count: oncologyCount } = await supabase
      .from('deals')
      .select('*', { count: 'exact', head: true })
      .eq('therapeutic_area', 'oncology');

    const { count: neurologyCount } = await supabase
      .from('deals')
      .select('*', { count: 'exact', head: true })
      .eq('therapeutic_area', 'neurology');

    console.log(`Weekly deals update complete. Total: ${totalDeals}, Oncology: ${oncologyCount}, Neurology: ${neurologyCount}`);

    return NextResponse.json({
      success: true,
      edgar: {
        processed: edgarResult.processed,
        deals: edgarResult.deals,
        errors: edgarResult.errors.length,
      },
      backfillErrors,
      counts: {
        total: totalDeals,
        oncology: oncologyCount,
        neurology: neurologyCount,
      },
    });
  } catch (error) {
    console.error('Weekly deals update error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
