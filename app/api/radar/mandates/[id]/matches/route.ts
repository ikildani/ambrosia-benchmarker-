/**
 * Search & Evaluation — Mandate matches
 *
 * PATCH /api/radar/mandates/:id/matches
 *   { ids: [matchId, ...], is_read?, is_saved?, is_dismissed? }   one or more rows
 *   { all: true, is_read: true }                                   every open match of the mandate
 *
 * Marks matches read / saved / dismissed for the session user. Ownership is
 * enforced on the UPDATE itself (user_id + mandate_id filters), so a row of
 * another user's mandate can never be touched. The "N new" badge on the
 * mandate switcher counts is_read = false AND is_dismissed = false
 * (radar_unread_match_counts), so marking read clears it.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { resolveUserTier } from '@/lib/auth/tier-check';
import { isUuid, uuidSchema } from '@/app/api/radar/_lib/radar-api';

export const dynamic = 'force-dynamic';

const patchSchema = z
  .object({
    ids: z.array(uuidSchema).min(1).max(200).optional(),
    all: z.literal(true).optional(),
    is_read: z.boolean().optional(),
    is_saved: z.boolean().optional(),
    is_dismissed: z.boolean().optional(),
  })
  .refine(b => Boolean(b.ids?.length) !== (b.all === true), { message: 'Provide ids or all: true' })
  .refine(b => b.is_read !== undefined || b.is_saved !== undefined || b.is_dismissed !== undefined, { message: 'Nothing to update' });

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await resolveUserTier();
  if (!auth.hasProAccess || !auth.userId) {
    return NextResponse.json({ error: 'Pro access required' }, { status: 403 });
  }
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'Mandate not found' }, { status: 404 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid body' }, { status: 400 });
  }
  const { ids, all, is_read, is_saved, is_dismissed } = parsed.data;

  const patch: Record<string, boolean> = {};
  if (is_read !== undefined) patch.is_read = is_read;
  if (is_saved !== undefined) patch.is_saved = is_saved;
  if (is_dismissed !== undefined) patch.is_dismissed = is_dismissed;

  const supabase = createServiceClient();
  let q = supabase
    .from('radar_mandate_matches')
    .update(patch)
    .eq('mandate_id', id)
    .eq('user_id', auth.userId);
  q = all ? q.eq('is_dismissed', false) : q.in('id', ids!);
  const { data, error } = await q.select('id');
  if (error) {
    console.error('[radar/mandates/:id/matches] PATCH error:', error.message);
    return NextResponse.json({ error: 'Failed to update matches' }, { status: 500 });
  }
  return NextResponse.json({ updated: (data || []).length, patch });
}
