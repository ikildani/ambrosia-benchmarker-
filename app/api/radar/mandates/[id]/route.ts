import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { resolveUserTier } from '@/lib/auth/tier-check';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await resolveUserTier();
  if (!auth.hasProAccess || !auth.userId) {
    return NextResponse.json({ error: 'Pro access required' }, { status: 403 });
  }

  const { id } = await params;
  const supabase = createServiceClient();

  const { data: mandate, error } = await supabase
    .from('radar_user_mandates')
    .select('*')
    .eq('id', id)
    .eq('user_id', auth.userId)
    .single();

  if (error || !mandate) {
    return NextResponse.json({ error: 'Mandate not found' }, { status: 404 });
  }

  // Fetch recent matches
  const { data: matches } = await supabase
    .from('radar_mandate_matches')
    .select(`
      id, match_score, match_reasons, is_read, is_saved, is_dismissed, matched_at,
      clinical_assets (
        id, company_name, asset_name, modality, therapeutic_area, phase,
        partnership_status, licensing_intent_score, deal_readiness_score,
        competitive_heat, confidence_score
      )
    `)
    .eq('mandate_id', id)
    .eq('user_id', auth.userId)
    .eq('is_dismissed', false)
    .order('matched_at', { ascending: false })
    .limit(50);

  return NextResponse.json({ mandate, matches: matches || [] });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await resolveUserTier();
  if (!auth.hasProAccess || !auth.userId) {
    return NextResponse.json({ error: 'Pro access required' }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const supabase = createServiceClient();

  // Only allow updating own mandates
  const { data: existing } = await supabase
    .from('radar_user_mandates')
    .select('id')
    .eq('id', id)
    .eq('user_id', auth.userId)
    .single();

  if (!existing) {
    return NextResponse.json({ error: 'Mandate not found' }, { status: 404 });
  }

  const updateFields: Record<string, unknown> = {};
  const allowedFields = [
    'name', 'description', 'is_active', 'therapeutic_areas', 'modalities',
    'phase_min', 'phase_max', 'countries', 'regions', 'partnership_statuses',
    'min_licensing_intent', 'min_deal_readiness', 'min_confidence',
    'notify_email', 'notify_in_app', 'digest_frequency',
  ];

  for (const field of allowedFields) {
    if (field in body) updateFields[field] = body[field];
  }

  const { data: mandate, error } = await supabase
    .from('radar_user_mandates')
    .update(updateFields)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ mandate });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await resolveUserTier();
  if (!auth.hasProAccess || !auth.userId) {
    return NextResponse.json({ error: 'Pro access required' }, { status: 403 });
  }

  const { id } = await params;
  const supabase = createServiceClient();

  const { error } = await supabase
    .from('radar_user_mandates')
    .delete()
    .eq('id', id)
    .eq('user_id', auth.userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
