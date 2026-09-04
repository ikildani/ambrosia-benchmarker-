/**
 * Asset Radar — Team Notes API
 *
 * GET  /api/radar/notes?asset_id=UUID — all notes for an asset
 * POST /api/radar/notes — add note { asset_id, note_text, note_type }
 * DELETE /api/radar/notes?id=UUID — delete own note
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { resolveUserTier } from '@/lib/auth/tier-check';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const assetId = request.nextUrl.searchParams.get('asset_id');
  if (!assetId) {
    return NextResponse.json({ error: 'asset_id required' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: notes } = await supabase
    .from('radar_asset_notes')
    .select('id, user_name, user_email, note_text, note_type, created_at')
    .eq('asset_id', assetId)
    .order('created_at', { ascending: false })
    .limit(50);

  return NextResponse.json({ notes: notes || [], total: notes?.length || 0 });
}

export async function POST(request: NextRequest) {
  const auth = await resolveUserTier();
  if (!auth.userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const body = await request.json();
  const { asset_id, note_text, note_type } = body;

  if (!asset_id || !note_text) {
    return NextResponse.json({ error: 'asset_id and note_text required' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('radar_asset_notes')
    .insert({
      asset_id,
      user_id: auth.userId,
      user_name: null,
      user_email: auth.email || null,
      note_text,
      note_type: note_type || 'general',
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, note: data });
}

export async function DELETE(request: NextRequest) {
  const auth = await resolveUserTier();
  if (!auth.userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const noteId = request.nextUrl.searchParams.get('id');
  if (!noteId) {
    return NextResponse.json({ error: 'id required' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { error } = await supabase
    .from('radar_asset_notes')
    .delete()
    .eq('id', noteId)
    .eq('user_id', auth.userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
