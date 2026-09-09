/**
 * Asset Radar — Team Notes API
 *
 * GET  /api/radar/notes?asset_id=UUID — notes on an asset visible to the caller
 *        (their own, plus notes by active members of their team)
 * POST /api/radar/notes — add note { asset_id, note_text, note_type }
 * DELETE /api/radar/notes?id=UUID — delete own note
 *
 * Author identity is returned as a display name (first name / initials) and
 * an `is_mine` flag. Emails are stored for audit but never returned.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { resolveUserTier } from '@/lib/auth/tier-check';
import { isUuid, uuidSchema } from '@/app/api/radar/_lib/radar-api';

export const dynamic = 'force-dynamic';

const NOTE_MAX_LENGTH = 2000;
const NOTE_TYPES = ['general', 'clinical', 'commercial', 'regulatory', 'competitive', 'risk'] as const;

const noteSchema = z.object({
  asset_id: uuidSchema,
  note_text: z.string().trim().min(1, 'note_text required').max(NOTE_MAX_LENGTH, `note_text must be ${NOTE_MAX_LENGTH} characters or fewer`),
  note_type: z.enum(NOTE_TYPES).default('general'),
});

type ServiceClient = ReturnType<typeof createServiceClient>;

interface NoteRow {
  id: string;
  asset_id: string;
  user_id: string;
  user_name: string | null;
  note_text: string;
  note_type: string;
  created_at: string;
}

/**
 * Users whose notes the caller may read: themselves plus every active member
 * of their active team. team_members is canonical (user_profiles.team_id is a
 * denormalised copy and is not trusted for authorisation — see
 * app/api/calculations/route.ts and migration 100).
 */
async function getVisibleAuthorIds(supabase: ServiceClient, userId: string): Promise<string[]> {
  const { data: membership } = await supabase
    .from('team_members')
    .select('team_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  const teamId = (membership as { team_id?: string } | null)?.team_id;
  if (!teamId) return [userId];

  const { data: members } = await supabase
    .from('team_members')
    .select('user_id')
    .eq('team_id', teamId)
    .eq('status', 'active');

  const ids = new Set<string>([userId]);
  for (const m of (members || []) as { user_id: string }[]) ids.add(m.user_id);
  return Array.from(ids);
}

/** First name from a full name, else initials; never an email. */
function displayName(fullName: string | null | undefined): string {
  const name = (fullName || '').trim();
  if (!name) return 'Teammate';
  const parts = name.split(/\s+/);
  if (parts.length === 1) return parts[0];
  const first = parts[0];
  const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
  return lastInitial ? `${first} ${lastInitial}.` : first;
}

async function fetchProfileNames(supabase: ServiceClient, userIds: string[]): Promise<Map<string, string | null>> {
  if (userIds.length === 0) return new Map();
  const { data } = await supabase
    .from('user_profiles')
    .select('id, full_name')
    .in('id', userIds);
  return new Map(((data || []) as { id: string; full_name: string | null }[]).map(p => [p.id, p.full_name]));
}

function shapeNote(row: NoteRow, callerId: string, names: Map<string, string | null>) {
  return {
    id: row.id,
    asset_id: row.asset_id,
    note_text: row.note_text,
    note_type: row.note_type,
    created_at: row.created_at,
    author: displayName(names.get(row.user_id) ?? row.user_name),
    is_mine: row.user_id === callerId,
  };
}

export async function GET(request: NextRequest) {
  // Notes are private workspace data: require a signed-in user and scope the
  // read to the caller's own notes plus their teammates'. Watchlist/notes are
  // a free-tier hook, so no Pro check here.
  const auth = await resolveUserTier();
  if (!auth.userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const assetId = request.nextUrl.searchParams.get('asset_id');
  if (!assetId) {
    return NextResponse.json({ error: 'asset_id required' }, { status: 400 });
  }
  if (!isUuid(assetId)) {
    return NextResponse.json({ error: 'asset_id must be a UUID' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const authorIds = await getVisibleAuthorIds(supabase, auth.userId);

  const { data: notes, error } = await supabase
    .from('radar_asset_notes')
    .select('id, asset_id, user_id, user_name, note_text, note_type, created_at')
    .eq('asset_id', assetId)
    .in('user_id', authorIds)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[radar/notes] GET error:', error.message);
    return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 });
  }

  const rows = (notes || []) as NoteRow[];
  const names = await fetchProfileNames(supabase, Array.from(new Set(rows.map(r => r.user_id))));
  const shaped = rows.map(r => shapeNote(r, auth.userId!, names));

  return NextResponse.json({ notes: shaped, total: shaped.length });
}

export async function POST(request: NextRequest) {
  // Writes require a signed-in user; the note is always attributed to the
  // session user, never to a user_id supplied in the body.
  const auth = await resolveUserTier();
  if (!auth.userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = noteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid note' }, { status: 400 });
  }
  const { asset_id, note_text, note_type } = parsed.data;

  const supabase = createServiceClient();

  const names = await fetchProfileNames(supabase, [auth.userId]);
  const fullName = names.get(auth.userId) ?? null;

  const { data, error } = await supabase
    .from('radar_asset_notes')
    .insert({
      asset_id,
      user_id: auth.userId,
      user_name: fullName,
      user_email: auth.email || null,
      note_text,
      note_type,
    })
    .select('id, asset_id, user_id, user_name, note_text, note_type, created_at')
    .single();

  if (error || !data) {
    console.error('[radar/notes] POST error:', error?.message);
    return NextResponse.json({ error: 'Failed to save note' }, { status: 500 });
  }

  return NextResponse.json({ success: true, note: shapeNote(data as NoteRow, auth.userId, names) });
}

export async function DELETE(request: NextRequest) {
  // Only the author may delete a note; the user_id filter enforces that even
  // though the service client bypasses RLS.
  const auth = await resolveUserTier();
  if (!auth.userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const noteId = request.nextUrl.searchParams.get('id');
  if (!noteId) {
    return NextResponse.json({ error: 'id required' }, { status: 400 });
  }
  if (!isUuid(noteId)) {
    return NextResponse.json({ error: 'id must be a UUID' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { error } = await supabase
    .from('radar_asset_notes')
    .delete()
    .eq('id', noteId)
    .eq('user_id', auth.userId);

  if (error) {
    console.error('[radar/notes] DELETE error:', error.message);
    return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
