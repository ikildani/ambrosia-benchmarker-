/**
 * POST /api/admin/deal-audit
 *
 * Per-row admin action for the /admin/deal-audit queue.
 * Accepts {id, action, notes?} where action is one of:
 *   verify  → verified=true, status='verified'
 *   reject  → verified=false, status='rejected'
 *   skip    → status='skipped' (so the row falls out of the audit queue
 *             without prejudice — manual auditor can return later)
 *
 * Auth: requires user in ADMIN_EMAILS (same gate as /admin/ layout).
 * We re-check here instead of trusting the client because the API
 * route is a separate entry point.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const ADMIN_EMAILS = ['ikildani@ambrosiaventures.co'];

type Body = {
  id?: string;
  action?: 'verify' | 'reject' | 'skip';
  notes?: string;
};

export async function POST(request: NextRequest) {
  const user = await (await createServerClient()).auth.getUser();
  const email = user.data.user?.email;
  if (!email || !ADMIN_EMAILS.includes(email)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  if (!body.id || !body.action || !['verify', 'reject', 'skip'].includes(body.action)) {
    return NextResponse.json({ error: 'missing id or action' }, { status: 400 });
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const prefix = `[${stamp} admin-audit by ${email}]`;
  const baseNote = body.notes ? ` ${body.notes}` : '';

  const updates: Record<string, unknown> = {};
  if (body.action === 'verify') {
    updates.verified = true;
    updates.verification_status = 'verified';
    updates.verification_notes_append = `${prefix} Manually verified via admin queue.${baseNote}`;
  } else if (body.action === 'reject') {
    updates.verified = false;
    updates.verification_status = 'rejected';
    updates.verification_notes_append = `${prefix} Manually rejected via admin queue.${baseNote}`;
  } else {
    updates.verification_status = 'skipped';
    updates.verification_notes_append = `${prefix} Skipped — needs more research.${baseNote}`;
  }

  // Fetch current notes, append, write back. A single round-trip is acceptable
  // at the 1-row-per-action interaction pattern.
  const svc = createServiceClient();
  const { data: existing, error: selectErr } = await svc
    .from('deals')
    .select('verification_notes')
    .eq('id', body.id)
    .maybeSingle();

  if (selectErr || !existing) {
    return NextResponse.json(
      { error: `lookup failed: ${selectErr?.message ?? 'not found'}` },
      { status: 404 },
    );
  }

  const newNotes = [existing.verification_notes, updates.verification_notes_append]
    .filter(Boolean)
    .join('\n');

  delete updates.verification_notes_append;
  updates.verification_notes = newNotes;

  const { error: updErr } = await svc.from('deals').update(updates).eq('id', body.id);
  if (updErr) {
    return NextResponse.json({ error: `update failed: ${updErr.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true, action: body.action });
}
