import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

// User-friendly error messages
const ERROR_MESSAGES: Record<string, string> = {
  'invalid_grant': 'This link has expired. Please try signing in again.',
  'access_denied': 'Access was denied. Please try again.',
  'server_error': 'Authentication service is temporarily unavailable.',
  'unauthorized_client': 'This application is not authorized. Please contact support.',
  'invalid_request': 'Invalid request. Please try signing in again.',
};

// Handle auth callbacks (email verification, password reset, magic links, OAuth)
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
    // DO NOT log full URL - contains sensitive auth code
  });

  // Handle error from Supabase (e.g., expired link, invalid redirect)
  if (error_description) {
    const errorCode = requestUrl.searchParams.get('error') || 'unknown';
    console.error('[Auth Callback] Supabase error:', {
      code: errorCode,
      description: error_description,
      timestamp: new Date().toISOString(),
    });

    // Map to user-friendly message
    const userMessage = ERROR_MESSAGES[errorCode] || 'An authentication error occurred. Please try again.';

    const errorUrl = new URL('/', requestUrl.origin);
    errorUrl.searchParams.set('auth_error', 'true');
    errorUrl.searchParams.set('error_message', userMessage);
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

    const response = NextResponse.redirect(successUrl);
    // Prevent caching of auth callback
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    response.headers.set('Pragma', 'no-cache');
    return response;
  }

  // No code provided - redirect to home (prevents manual navigation to callback)
  console.log('[Auth Callback] No code provided, redirecting to home');
  return NextResponse.redirect(new URL('/', requestUrl.origin));
}
