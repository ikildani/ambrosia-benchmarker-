import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { runOpenFDAIngestion } from '@/lib/ingestion/openfda';
import { verifyAdminAuth } from '@/lib/admin-auth';

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
  // Admin auth: timing-safe Bearer token or authenticated admin email
  const authError = await verifyAdminAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json().catch(() => ({}));
    const daysBack = typeof body.daysBack === 'number' && body.daysBack > 0 && body.daysBack <= 365
      ? body.daysBack : 90;

    const supabase = createServiceClient();

    console.log(`[admin] Starting OpenFDA ingestion (${daysBack} days)...`);

    const result = await runOpenFDAIngestion(supabase, { daysBack });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('[admin] OpenFDA ingestion error:', error);
    return NextResponse.json({ error: 'FDA approval ingestion failed' }, { status: 500 });
  }
}
