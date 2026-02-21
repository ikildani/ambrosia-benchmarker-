import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { runOpenFDAIngestion } from '@/lib/ingestion/openfda';

export const maxDuration = 300; // 5 minutes max
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/ingest-fda-approvals
 *
 * Ingests recent FDA drug approvals (NDA/BLA) and new indication approvals
 * from the OpenFDA API. Matches sponsors to tracked companies.
 *
 * Auth: Bearer $ADMIN_API_KEY
 * Body: { "daysBack": 90 }
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const adminApiKey = process.env.ADMIN_API_KEY;

  if (!adminApiKey) {
    return NextResponse.json({ error: 'ADMIN_API_KEY not configured' }, { status: 500 });
  }

  if (!authHeader || authHeader !== `Bearer ${adminApiKey}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const daysBack = body.daysBack || 90;

    const supabase = createServiceClient();

    console.log(`[admin] Starting OpenFDA ingestion (${daysBack} days)...`);

    const result = await runOpenFDAIngestion(supabase, { daysBack });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('[admin] OpenFDA ingestion error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
