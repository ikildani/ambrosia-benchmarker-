import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';
import { runPubMedIngestion } from '@/lib/ingestion/pubmed';
import { runBioRxivIngestion } from '@/lib/ingestion/biorxiv';
import { logCronRun } from '@/lib/cron-utils';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
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

    // Step 1: PubMed peer-reviewed publications
    let pubmedResult = { articles_found: 0, articles_inserted: 0, errors: [] as string[] };
    try {
      pubmedResult = await runPubMedIngestion(supabase, { daysBack: 7, maxPerQuery: 50 });
    } catch {
      // PubMed ingestion error (non-fatal)
    }

    // Step 2: bioRxiv/medRxiv preprints
    let biorxivResult = { preprints_found: 0, preprints_inserted: 0, errors: [] as string[] };
    try {
      biorxivResult = await runBioRxivIngestion(supabase, { daysBack: 7, maxPerServer: 100 });
    } catch {
      // bioRxiv ingestion error (non-fatal)
    }

    // Log to ingestion audit trail
    await logCronRun(supabase, 'publications_update', {
      fetched: (pubmedResult.articles_found || 0) + (biorxivResult.preprints_found || 0),
      inserted: (pubmedResult.articles_inserted || 0) + (biorxivResult.preprints_inserted || 0),
      errors: [...pubmedResult.errors, ...biorxivResult.errors],
    });

    return NextResponse.json({
      success: true,
      pubmed: {
        found: pubmedResult.articles_found,
        inserted: pubmedResult.articles_inserted,
        errors: pubmedResult.errors.length,
      },
      biorxiv: {
        found: biorxivResult.preprints_found,
        inserted: biorxivResult.preprints_inserted,
        errors: biorxivResult.errors.length,
      },
    });
  } catch (error) {
    console.error('Publications update error:', error);
    return NextResponse.json({ error: 'Publications update failed' }, { status: 500 });
  }
}
