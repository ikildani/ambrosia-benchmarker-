import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { ingestOrangeBookPatents } from '@/lib/ingestion/orange-book';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/enrich-patent-cliffs
 *
 * Ingests FDA Orange Book patent data and enriches company patent_cliffs.
 * Auth: Bearer $ADMIN_API_KEY
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
