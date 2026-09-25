/**
 * /api/admin/outcomes — review queue for auto matches scored 0.5–0.8.
 *
 *   GET  ?limit=50            pending outcomes with their prediction + deal summary
 *   POST { outcome_id, action: 'accept' | 'reject', notes? }
 *
 * Auth: ADMIN_API_KEY bearer or admin email (lib/admin-auth verifyAdminAuth).
 * A UI page (/admin/outcomes) is a follow-up; this route is what it will call.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { verifyAdminAuth } from '@/lib/admin-auth';
import { getAuthenticatedUser } from '@/lib/auth-helpers';
import { captureApiError } from '@/lib/sentry-api';
import { acceptOutcome, rejectOutcome } from '@/lib/outcomes/resolver';

export const dynamic = 'force-dynamic';

const QUEUE_SELECT = [
  'id', 'prediction_id', 'deal_id', 'match_confidence', 'match_evidence', 'upfront_m', 'total_m', 'licensee_name', 'signed_date', 'deal_type',
  'abs_pct_error_upfront', 'abs_pct_error_total', 'within_band_upfront', 'within_band_total', 'buyer_hit', 'window_hit', 'created_at',
  'predictions(id,source,source_id,user_id,licensor_name,asset_name,indication,therapeutic_area,phase,upfront_low,upfront_mid,upfront_high,total_low,total_mid,total_high,predicted_buyers,predicted_window_start,predicted_window_end,created_at)',
  'deals(id,licensor_name,licensee_name,asset_name,announced_date,phase_at_signing,indication_specific,indication_category,therapeutic_area,upfront_usd,total_deal_value_usd,source_url)',
].join(',');

export async function GET(request: NextRequest) {
  const denied = await verifyAdminAuth(request);
  if (denied) return denied;
  const limit = Math.min(200, Math.max(1, Number(request.nextUrl.searchParams.get('limit') ?? 50) || 50));
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('outcomes')
      .select(QUEUE_SELECT)
      .eq('status', 'pending')
      .order('match_confidence', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(limit);
    if (error) throw new Error(error.message);
    const { count } = await supabase.from('outcomes').select('id', { count: 'exact', head: true }).eq('status', 'pending');
    console.log(`[Outcomes] admin queue: ${(data ?? []).length} of ${count ?? 0} pending`);
    return NextResponse.json({ pending: count ?? 0, rows: data ?? [] });
  } catch (error) {
    captureApiError(error, 'admin-outcomes-get');
    return NextResponse.json({ error: 'Failed to load review queue' }, { status: 500 });
  }
}

const actionSchema = z.object({
  outcome_id: z.string().uuid(),
  action: z.enum(['accept', 'reject']),
  notes: z.string().trim().max(2000).nullable().optional(),
}).strict();

export async function POST(request: NextRequest) {
  const denied = await verifyAdminAuth(request);
  if (denied) return denied;
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  const parsed = actionSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'invalid body' }, { status: 400 });
  const { outcome_id, action, notes } = parsed.data;

  try {
    const supabase = createServiceClient();
    const user = await getAuthenticatedUser(request);
    const reviewedBy = user?.email ?? 'admin-key';
    const res = action === 'accept'
      ? await acceptOutcome(supabase, outcome_id, reviewedBy, notes)
      : await rejectOutcome(supabase, outcome_id, reviewedBy, notes);
    console.log(`[Outcomes] admin ${action} ${outcome_id} by ${reviewedBy}: ${res.ok ? 'ok' : res.error}`);
    if (!res.ok) return NextResponse.json({ error: res.error ?? 'update failed' }, { status: 400 });
    return NextResponse.json({ success: true, outcome_id, action });
  } catch (error) {
    captureApiError(error, 'admin-outcomes-post');
    return NextResponse.json({ error: 'Failed to update outcome' }, { status: 500 });
  }
}
