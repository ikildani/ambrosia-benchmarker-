/**
 * API Route: Fix Company Linkage
 *
 * Finds deals missing licensor_id or licensee_id and links them
 * using findOrCreateCompany name matching.
 *
 * POST /api/deals/fix-linkage?limit=200
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { verifyAdminAuth } from '@/lib/admin-auth';
import { findOrCreateCompany } from '@/lib/ingestion/sec-edgar';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const authError = await verifyAdminAuth(request);
  if (authError) return authError;

  const supabase = createServiceClient();
  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '200', 10), 500);

  const { data: deals } = await supabase
    .from('deals')
    .select('id, licensor_name, licensee_name, licensor_id, licensee_id')
    .or('licensor_id.is.null,licensee_id.is.null')
    .not('therapeutic_area', 'in', '("other","_option_deals","_codev_deals","_china_deals")')
    .limit(limit);

  if (!deals || deals.length === 0) {
    return NextResponse.json({ success: true, message: 'All deals linked', processed: 0 });
  }

  let linked = 0;
  let errors = 0;

  for (const deal of deals) {
    const updates: Record<string, string> = {};

    if (!deal.licensor_id && deal.licensor_name) {
      try {
        const id = await findOrCreateCompany(supabase, deal.licensor_name, false);
        if (id) updates.licensor_id = id;
      } catch { errors++; }
    }

    if (!deal.licensee_id && deal.licensee_name) {
      try {
        const id = await findOrCreateCompany(supabase, deal.licensee_name, true);
        if (id) updates.licensee_id = id;
      } catch { errors++; }
    }

    if (Object.keys(updates).length > 0) {
      await supabase.from('deals').update(updates).eq('id', deal.id);
      linked++;
    }
  }

  return NextResponse.json({ success: true, processed: deals.length, linked, errors });
}
