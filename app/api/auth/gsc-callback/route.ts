import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const error = request.nextUrl.searchParams.get('error');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://solidus.ambrosiaventures.co';

  if (error) {
    return NextResponse.redirect(`${appUrl}/?gsc_error=${error}`);
  }

  if (!code) {
    return NextResponse.redirect(`${appUrl}/?gsc_error=no_code`);
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${appUrl}/?gsc_error=not_configured`);
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    `${appUrl}/api/auth/gsc-callback`,
  );

  try {
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      return NextResponse.redirect(`${appUrl}/?gsc_error=no_refresh_token`);
    }

    const supabase = createServiceClient();

    await supabase.from('system_config').upsert({
      key: 'gsc_oauth_tokens',
      value: {
        refresh_token: tokens.refresh_token,
        access_token: tokens.access_token,
        expiry_date: tokens.expiry_date,
        token_type: tokens.token_type,
        scope: tokens.scope,
        authorized_at: new Date().toISOString(),
      },
    }, { onConflict: 'key' });

    console.log('[GSC OAuth] Refresh token stored successfully');

    return NextResponse.redirect(`${appUrl}/?gsc_success=true`);
  } catch (err) {
    console.error('[GSC OAuth] Token exchange failed:', err);
    return NextResponse.redirect(`${appUrl}/?gsc_error=token_exchange_failed`);
  }
}
