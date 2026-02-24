import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { runPressReleaseIngestion } from '@/lib/ingestion/press-releases';
import { verifyAdminAuth } from '@/lib/admin-auth';

export const maxDuration = 300; // 5 minutes max
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/ingest-press-releases
 *
 * Runs the multi-source press release deal ingestion pipeline.
 * Fetches RSS feeds from FierceBiotech, FiercePharma, GlobeNewswire,
 * PR Newswire, and BioWorld, extracts deals using Claude AI.
 *
 * Auth: Bearer $ADMIN_API_KEY
 * Body: { "maxArticlesPerSource": 10 }
 */
export async function POST(request: NextRequest) {
  // Admin auth: timing-safe Bearer token or authenticated admin email
  const authError = await verifyAdminAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json().catch(() => ({}));
    const maxArticlesPerSource = body.maxArticlesPerSource || 10;

    const supabase = createServiceClient();
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

    if (!anthropicApiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
    }

    console.log(`[admin] Starting press release ingestion (max ${maxArticlesPerSource}/source)...`);

    const result = await runPressReleaseIngestion(supabase, anthropicApiKey, {
      maxArticlesPerSource,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('[admin] Press release ingestion error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
