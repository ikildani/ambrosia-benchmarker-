import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';
import { runFTCIngestion } from '@/lib/ingestion/ftc-premerger';
import { runCronIntelligence } from '@/lib/cron-intelligence';

export const maxDuration = 120; // 2 minutes max (FTC runs are lightweight)
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Security: Require cron secret (same pattern as deals-update)
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
    const perplexityApiKey = process.env.PERPLEXITY_API_KEY;

    if (!anthropicApiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
    }

    if (!perplexityApiKey) {
      return NextResponse.json({ error: 'PERPLEXITY_API_KEY not configured' }, { status: 500 });
    }

    const result = await runFTCIngestion(supabase, anthropicApiKey, perplexityApiKey);

    // Intelligence tracking
    try {
      await runCronIntelligence(supabase, 'ftc-update', {
        processed: result.deals_discovered,
        inserted: result.deals_inserted,
      });
    } catch {}

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('FTC ingestion error:', error);
    return NextResponse.json({ error: 'FTC ingestion failed' }, { status: 500 });
  }
}
