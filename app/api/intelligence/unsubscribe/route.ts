import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email')?.trim().toLowerCase();
  if (!email) {
    return new NextResponse('<p>Missing email</p>', { status: 400, headers: { 'Content-Type': 'text/html' } });
  }
  const supabase = createServiceClient();
  await supabase
    .from('newsletter_subscribers')
    .update({ status: 'unsubscribed', unsubscribed_at: new Date().toISOString() })
    .eq('email', email)
    .eq('source', 'intelligence_digest');

  const html = `
<!DOCTYPE html>
<html><head><title>Unsubscribed</title></head>
<body style="font-family:system-ui;background:#0c0e1f;color:#e2e8f0;padding:80px 24px;text-align:center;">
  <h1 style="color:#34c2c2;">You're unsubscribed.</h1>
  <p style="color:#94a3b8;max-width:480px;margin:16px auto;">
    ${email} has been removed from the Ambrosia monthly intelligence digest.
    You can resubscribe anytime on the intelligence page.
  </p>
  <p style="margin-top:32px;"><a href="https://solidus.ambrosiaventures.co/intelligence" style="color:#34c2c2;">← Back to intelligence</a></p>
</body></html>
`.trim();

  return new NextResponse(html, { status: 200, headers: { 'Content-Type': 'text/html' } });
}
