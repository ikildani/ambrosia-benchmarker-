import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { ingestOrangeBookPatents } from '@/lib/ingestion/orange-book';
import { verifyAdminAuth } from '@/lib/admin-auth';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/enrich-patent-cliffs
 *
 * Ingests FDA Orange Book patent data and enriches company patent_cliffs.
 * Auth: Bearer $ADMIN_API_KEY
 */
export async function POST(request: NextRequest) {
  // Admin auth: timing-safe Bearer token or authenticated admin email
  const authError = await verifyAdminAuth(request);
  if (authError) return authError;

  try {
    const supabase = createServiceClient();
    const result = await ingestOrangeBookPatents(supabase);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('[enrich-patent-cliffs] Error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
