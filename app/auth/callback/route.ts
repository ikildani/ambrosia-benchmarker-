import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

// Handle auth callbacks (email verification, password reset, magic links)
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const type = requestUrl.searchParams.get('type');
  const error_description = requestUrl.searchParams.get('error_description');
  const next = requestUrl.searchParams.get('next') || '/';

  console.log('[Auth Callback] Received request:', {
    hasCode: !!code,
    type,
    error_description,
    url: request.url,
  });

  // Handle error from Supabase (e.g., expired link, invalid redirect)
  if (error_description) {
    console.error('[Auth Callback] Supabase error:', error_description);
    const errorUrl = new URL('/', requestUrl.origin);
    errorUrl.searchParams.set('auth_error', 'true');
    errorUrl.searchParams.set('error_message', error_description);
    return NextResponse.redirect(errorUrl);
  }

  if (code) {
    const supabase = createServerClient();

    // Exchange the code for a session
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('[Auth Callback] Exchange code error:', {
        message: error.message,
        status: error.status,
        name: error.name,
      });
      const errorUrl = new URL('/', requestUrl.origin);
      errorUrl.searchParams.set('auth_error', 'true');
      errorUrl.searchParams.set('error_message', error.message);
      return NextResponse.redirect(errorUrl);
    }

    console.log('[Auth Callback] Session created successfully for user:', data.user?.email);

    // If this was email verification, update the user profile
    if (type === 'signup' || type === 'email') {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error: updateError } = await supabase
          .from('user_profiles')
          .update({
            email_verified: true,
            email_verified_at: new Date().toISOString(),
          })
          .eq('id', user.id);

        if (updateError) {
          console.error('[Auth Callback] Profile update error:', updateError);
        } else {
          console.log('[Auth Callback] Email verified for user:', user.email);
        }
      }
    }

    // Redirect to the app with success message
    const successUrl = new URL('/', requestUrl.origin);
    successUrl.searchParams.set('verified', 'true');
    return NextResponse.redirect(successUrl);
  }

  // No code provided
  console.error('[Auth Callback] No code provided in callback URL');
  const errorUrl = new URL('/', requestUrl.origin);
  errorUrl.searchParams.set('auth_error', 'true');
  errorUrl.searchParams.set('error_message', 'No verification code provided');
  return NextResponse.redirect(errorUrl);
}
