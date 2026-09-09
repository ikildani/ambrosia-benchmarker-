import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { resolveUserTier } from '@/lib/auth/tier-check';
import { isUuid } from '@/app/api/radar/_lib/radar-api';
import { mandateFieldsSchema, formatValidationError } from '@/app/api/radar/_lib/mandate-schema';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Pro-only; the user_id filter means other users' mandates 404.
  const auth = await resolveUserTier();
  if (!auth.hasProAccess || !auth.userId) {
    return NextResponse.json({ error: 'Pro access required' }, { status: 403 });
  }

  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: 'Mandate not found' }, { status: 404 });
  }
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
  // Pro-only. Ownership is enforced on the UPDATE itself (not just the
  // pre-check) so a race or a bypassed pre-check can never touch another
  // user's row.
  const auth = await resolveUserTier();
  if (!auth.hasProAccess || !auth.userId) {
    return NextResponse.json({ error: 'Pro access required' }, { status: 403 });
  }

  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: 'Mandate not found' }, { status: 404 });
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

  // Only fields present in the request body are updated
  const updateFields: Record<string, unknown> = {};
  const bodyKeys = body && typeof body === 'object' ? Object.keys(body as object) : [];
  for (const [field, value] of Object.entries(parsed.data)) {
    if (bodyKeys.includes(field) && value !== undefined) updateFields[field] = value;
  }

  if (Object.keys(updateFields).length === 0) {
    return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 });
  }

  const { data: mandate, error } = await supabase
    .from('radar_user_mandates')
    .update(updateFields)
    .eq('id', id)
    .eq('user_id', auth.userId)
    .select()
    .single();

  if (error) {
    console.error('[radar/mandates/:id] PATCH error:', error.message);
    return NextResponse.json({ error: 'Failed to update mandate' }, { status: 500 });
  }

  return NextResponse.json({ mandate });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Pro-only; the user_id filter prevents deleting another user's mandate.
  const auth = await resolveUserTier();
  if (!auth.hasProAccess || !auth.userId) {
    return NextResponse.json({ error: 'Pro access required' }, { status: 403 });
  }

  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: 'Mandate not found' }, { status: 404 });
  }
  const supabase = createServiceClient();

  const { error } = await supabase
    .from('radar_user_mandates')
    .delete()
    .eq('id', id)
    .eq('user_id', auth.userId);

  if (error) {
    console.error('[radar/mandates/:id] DELETE error:', error.message);
    return NextResponse.json({ error: 'Failed to delete mandate' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
