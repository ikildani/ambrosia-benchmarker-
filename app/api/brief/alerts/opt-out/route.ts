/**
 * GET /api/brief/alerts/opt-out?token=<signed>
 *
 * The opt-out link in every post-delivery brief alert. The token names the
 * benchmark request (lib/brief/alert-token.ts); a valid one sets
 * benchmark_requests.alerts_opt_out_at and the request is never selected by
 * lib/brief/alerts.ts again. Owners have no account, so the signed token is
 * the only authentication. Returns a minimal HTML page either way.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { verifyBriefAlertToken } from '@/lib/brief/alert-token';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function page(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0c0e1f;color:#e2e8f0;padding:80px 24px;text-align:center;">
  <h1 style="color:#34c2c2;font-size:22px;">${title}</h1>
  <p style="color:#94a3b8;max-width:480px;margin:16px auto;line-height:1.6;">${body}</p>
</body></html>`;
}

const html = (markup: string, status: number) => new NextResponse(markup, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  const v = verifyBriefAlertToken(token);
  if (!v.ok) {
    if (v.reason === 'no_secret') return html(page('Not available', 'Alert opt-out is not configured. Reply to the email and we will switch the updates off by hand.'), 503);
    const why = v.reason === 'expired' ? 'This link has expired.' : 'This link is not valid.';
    return html(page('Link not valid', `${why} Reply to the most recent update email and we will switch the updates off by hand.`), 400);
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('benchmark_requests')
    .update({ alerts_opt_out_at: new Date().toISOString() })
    .eq('id', v.payload.requestId)
    .select('id')
    .maybeSingle();
  if (error || !data) {
    return html(page('Something went wrong', 'We could not record the opt-out. Reply to the update email and we will switch it off by hand.'), 500);
  }

  return html(page('Updates stopped', 'You will not receive further post-delivery updates on this Deal Intelligence Brief. Your data room link keeps working, and you can reply to any earlier email to turn the updates back on.'), 200);
}
