import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { resolveUserTier } from '@/lib/auth/tier-check';
import { mandateFieldsSchema, formatValidationError } from '@/app/api/radar/_lib/mandate-schema';

export const dynamic = 'force-dynamic';

export async function GET() {
  // Mandates are Pro-only saved searches; rows are filtered by the caller's user_id.
  const auth = await resolveUserTier();
  if (!auth.hasProAccess || !auth.userId) {
    return NextResponse.json({ error: 'Pro access required' }, { status: 403 });
  }

  const supabase = createServiceClient();

  const { data: mandates, error } = await supabase
    .from('radar_user_mandates')
    .select('*')
    .eq('user_id', auth.userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[radar/mandates] GET error:', error.message);
    return NextResponse.json({ error: 'Failed to fetch mandates' }, { status: 500 });
  }

  // Also fetch unread match counts per mandate
  const mandateIds = (mandates || []).map(m => m.id);
  let matchCounts: Record<string, number> = {};

  if (mandateIds.length > 0) {
    const { data: counts } = await supabase
      .rpc('radar_unread_match_counts', { mandate_ids: mandateIds, uid: auth.userId });

    if (counts) {
      matchCounts = Object.fromEntries(
        (counts as { mandate_id: string; unread: number }[]).map(c => [c.mandate_id, c.unread])
      );
    }
  }

  return NextResponse.json({
    mandates: (mandates || []).map(m => ({
      ...m,
      unread_matches: matchCounts[m.id] || 0,
    })),
  });
}

export async function POST(request: NextRequest) {
  // Pro-only; the mandate is always owned by the session user.
  const auth = await resolveUserTier();
  if (!auth.hasProAccess || !auth.userId) {
    return NextResponse.json({ error: 'Pro access required' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = mandateFieldsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: formatValidationError(parsed.error) }, { status: 400 });
  }
  const input = parsed.data;

  const supabase = createServiceClient();

  // Limit mandates per user
  const { count } = await supabase
    .from('radar_user_mandates')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', auth.userId);

  if ((count || 0) >= 10) {
    return NextResponse.json({ error: 'Maximum 10 mandates per user' }, { status: 400 });
  }

  const mandateData = {
    user_id: auth.userId,
    name: input.name || 'My Search',
    description: input.description || null,
    therapeutic_areas: input.therapeutic_areas || [],
    modalities: input.modalities || [],
    phase_min: input.phase_min || null,
    phase_max: input.phase_max || null,
    countries: input.countries || [],
    regions: input.regions || [],
    partnership_statuses: input.partnership_statuses || ['unpartnered', 'partially_partnered'],
    min_licensing_intent: input.min_licensing_intent || 0,
    min_deal_readiness: input.min_deal_readiness || 0,
    min_confidence: input.min_confidence || 0,
    notify_email: input.notify_email || false,
    notify_in_app: input.notify_in_app !== false,
    digest_frequency: input.digest_frequency || 'daily',
  };

  const { data: mandate, error } = await supabase
    .from('radar_user_mandates')
    .insert(mandateData)
    .select()
    .single();

  if (error) {
    console.error('[radar/mandates] POST error:', error.message);
    return NextResponse.json({ error: 'Failed to create mandate' }, { status: 500 });
  }

  return NextResponse.json({ mandate }, { status: 201 });
}
