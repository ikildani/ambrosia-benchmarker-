import { NextRequest, NextResponse, after } from 'next/server';
import { verifyAdminAuth } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * Admin actions on Deal Intelligence Brief requests.
 *
 *   POST { requestId, action: 'build' }
 *     Ask the generate route for a (re)build. Without an MP opinion on the row
 *     the result is a draft; with one it is delivered and emailed.
 *   POST { requestId, action: 'opinion', text, reviewer? }
 *     Store the Managing Partner opinion. Delivery still requires a 'build'.
 *   POST { requestId, action: 'invoice_sent' }
 *     Mark the invoice as sent (payment_status stays pending until paid).
 *   POST { requestId, action: 'paid' }
 *     Mark the invoice paid.
 *
 * Auth: admin email session or ADMIN_API_KEY bearer (verifyAdminAuth).
 */

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const denied = await verifyAdminAuth(request);
  if (denied) return denied;
  let body: { requestId?: string; action?: string; text?: string; reviewer?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { requestId, action } = body;
  if (!requestId || !action) return NextResponse.json({ error: 'requestId and action required' }, { status: 400 });
  const supabase = createServiceClient();
  const now = new Date().toISOString();

  if (action === 'build') {
    const secret = process.env.CRON_SECRET;
    if (!secret) return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
    const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://solidus.ambrosiaventures.co';
    await supabase.from('benchmark_requests').update({ auto_draft_requested_at: now, auto_draft_status: 'requested' }).eq('id', requestId);
    // Fire after the response: the generate invocation carries on server-side; the
    // admin page polls the row until it leaves 'generating'.
    after(async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8_000);
      try {
        await fetch(`${base}/api/benchmark/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-internal-secret': secret }, body: JSON.stringify({ requestId }), signal: controller.signal });
      } catch (e) {
        if (!(e instanceof Error && e.name === 'AbortError')) {
          await supabase.from('benchmark_requests').update({ auto_draft_status: 'failed' }).eq('id', requestId);
        }
      } finally { clearTimeout(timer); }
    });
    return NextResponse.json({ ok: true, status: 202, result: { note: 'Building. This page refreshes itself until the draft lands.' } }, { status: 202 });
  }

  if (action === 'opinion') {
    const text = (body.text ?? '').trim();
    if (text.length < 20) return NextResponse.json({ error: 'Opinion must be at least 20 characters' }, { status: 400 });
    const { error } = await supabase.from('benchmark_requests').update({ mp_opinion: text, mp_reviewer: body.reviewer?.trim() || 'Issa Kildani, Managing Partner', mp_reviewed_at: now }).eq('id', requestId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'invoice_sent' || action === 'paid') {
    const patch = action === 'paid' ? { payment_status: 'paid', paid_at: now } : { invoice_sent_at: now, payment_status: 'invoiced' };
    const { error } = await supabase.from('benchmark_requests').update(patch).eq('id', requestId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: `Unknown action ${action}` }, { status: 400 });
}
