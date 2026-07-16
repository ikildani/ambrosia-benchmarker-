import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email')?.trim().toLowerCase();
  const type = searchParams.get('type') || 'all';

  if (!email) {
    return new NextResponse('<p>Missing email</p>', { status: 400, headers: { 'Content-Type': 'text/html' } });
  }

  const supabase = createServiceClient();

  await supabase
    .from('newsletter_subscribers')
    .update({ status: 'unsubscribed', unsubscribed_at: new Date().toISOString() })
    .eq('email', email);

  const typeLabel = type === 'platform_updates' ? 'platform updates' : 'newsletter';

  const html = `
<!DOCTYPE html>
<html><head><title>Unsubscribed</title></head>
<body style="font-family:system-ui;background:#0c0e1f;color:#e2e8f0;padding:80px 24px;text-align:center;">
  <h1 style="color:#14b8a6;">You're unsubscribed.</h1>
  <p style="color:#94a3b8;max-width:480px;margin:16px auto;">
    ${email} has been removed from Ambrosia ${typeLabel} emails.
    You can resubscribe anytime from your dashboard settings.
  </p>
  <p style="margin-top:32px;"><a href="https://calculator.ambrosiaventures.co" style="color:#14b8a6;">← Back to Deal Calculator</a></p>
</body></html>
`.trim();

  return new NextResponse(html, { status: 200, headers: { 'Content-Type': 'text/html' } });
}
