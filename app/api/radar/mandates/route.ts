import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, createServerClient } from '@/lib/supabase/server';
import { resolveUserTier } from '@/lib/auth/tier-check';

export const dynamic = 'force-dynamic';

export async function GET() {
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
    return NextResponse.json({ error: error.message }, { status: 500 });
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
  const auth = await resolveUserTier();
  if (!auth.hasProAccess || !auth.userId) {
    return NextResponse.json({ error: 'Pro access required' }, { status: 403 });
  }

  const body = await request.json();

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
    name: body.name || 'My Search',
    description: body.description || null,
    therapeutic_areas: body.therapeutic_areas || [],
    modalities: body.modalities || [],
    phase_min: body.phase_min || null,
    phase_max: body.phase_max || null,
    countries: body.countries || [],
    regions: body.regions || [],
    partnership_statuses: body.partnership_statuses || ['unpartnered', 'partially_partnered'],
    min_licensing_intent: body.min_licensing_intent || 0,
    min_deal_readiness: body.min_deal_readiness || 0,
    min_confidence: body.min_confidence || 0,
    notify_email: body.notify_email || false,
    notify_in_app: body.notify_in_app !== false,
    digest_frequency: body.digest_frequency || 'daily',
  };

  const { data: mandate, error } = await supabase
    .from('radar_user_mandates')
    .insert(mandateData)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ mandate }, { status: 201 });
}
