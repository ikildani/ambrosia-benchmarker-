import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { sendAdminSignupNotification } from '@/lib/email/client';
import { notifyNewSignup, notifyLogin } from '@/lib/slack/notify';

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
    const supabase = await createServerClient();

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
          // Notify admin of new verified signup
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('tier')
            .eq('id', user.id)
            .single();
          const signupInfo = {
            email: user.email || '',
            name: user.user_metadata?.name || user.user_metadata?.full_name,
            company: user.user_metadata?.company,
            tier: profile?.tier || 'free',
          };
          sendAdminSignupNotification(signupInfo).catch(err => console.error('[Auth Callback] Admin notification error:', err));
          notifyNewSignup(signupInfo).catch(err => console.error('[Auth Callback] Slack notification error:', err));
        }
      }
    }

    // For OAuth sign-ins (Google), also notify admin on first login
    if (!type && data.user) {
      const user = data.user;
      const isNewUser = user.created_at && (Date.now() - new Date(user.created_at).getTime() < 60000);
      if (isNewUser) {
        const oauthSignupInfo = {
          email: user.email || '',
          name: user.user_metadata?.name || user.user_metadata?.full_name,
          company: user.user_metadata?.company,
          tier: 'free',
        };
        sendAdminSignupNotification(oauthSignupInfo).catch(err => console.error('[Auth Callback] Admin notification error:', err));
        notifyNewSignup(oauthSignupInfo).catch(err => console.error('[Auth Callback] Slack notification error:', err));
      }
    }

    // Notify admin of login (for returning users — new signups already get a signup notification)
    if (data.user) {
      const loginUser = data.user;
      const isNewUser = loginUser.created_at && (Date.now() - new Date(loginUser.created_at).getTime() < 60000);
      if (!isNewUser) {
        const loginMethod = type === 'magiclink' ? 'Magic Link' : !type ? 'Google OAuth' : 'Email';
        notifyLogin({
          email: loginUser.email || '',
          name: loginUser.user_metadata?.name || loginUser.user_metadata?.full_name,
          method: loginMethod,
        }).catch(err => console.error('[Auth Callback] Slack login notification error:', err));
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
  return NextResponse.redirect(new URL('/', requestUrl.origin));
}
