import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, createServiceClient } from '@/lib/supabase/server';
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

const AUTO_TRIAL_DAYS = 7;

async function grantAutoTrial(userId: string, email: string) {
  const service = createServiceClient();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + AUTO_TRIAL_DAYS * 24 * 60 * 60 * 1000);

  const { error } = await service
    .from('user_profiles')
    .update({
      tier: 'pro',
      subscription_status: 'active',
      pro_engagement_type: 'auto-trial-signup',
      pro_activated_at: now.toISOString(),
      pro_expires_at: expiresAt.toISOString(),
      tier_change_authorized: true,
    })
    .eq('id', userId);

  if (error) {
    console.error('[Auth Callback] Auto-trial grant failed:', error);
    return;
  }

  await service.from('events').insert({
    user_id: userId,
    event_type: 'trial_activated',
    event_data: { engagement_type: 'auto-trial-signup', source: 'auth_callback', email },
    user_tier: 'pro',
  });

  console.log(`[Auth Callback] Auto-trial granted to ${email}, expires ${expiresAt.toISOString()}`);
}

async function saveAttribution(userId: string, request: NextRequest) {
  const utmCookie = request.cookies.get('utm_params')?.value;
  if (!utmCookie) return;

  try {
    const params = JSON.parse(utmCookie);
    const service = createServiceClient();
    await service
      .from('user_profiles')
      .update({
        attribution_source: params.utm_source || null,
        attribution_campaign: params.utm_campaign || null,
      })
      .eq('id', userId)
      .is('attribution_source', null);
  } catch {
    console.error('[Auth Callback] Attribution save failed');
  }
}

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
          // Auto-grant 7-day Pro trial for newly verified signups
          await grantAutoTrial(user.id, user.email || '');
          await saveAttribution(user.id, request);

          const signupInfo = {
            email: user.email || '',
            name: user.user_metadata?.name || user.user_metadata?.full_name,
            company: user.user_metadata?.company,
            tier: 'pro',
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
        // Create profile for OAuth users with auto-trial
        const service = createServiceClient();
        await service.from('user_profiles').upsert({
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.name || user.user_metadata?.full_name || null,
          company_name: user.user_metadata?.company || null,
          tier: 'pro',
          subscription_status: 'active',
          pro_engagement_type: 'auto-trial-signup',
          pro_activated_at: new Date().toISOString(),
          pro_expires_at: new Date(Date.now() + AUTO_TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString(),
          tier_change_authorized: true,
          email_verified: true,
          email_verified_at: new Date().toISOString(),
        }, { onConflict: 'id', ignoreDuplicates: true });

        await service.from('events').insert({
          user_id: user.id,
          event_type: 'trial_activated',
          event_data: { engagement_type: 'auto-trial-signup', source: 'oauth_callback', email: user.email },
          user_tier: 'pro',
        });

        await saveAttribution(user.id, request);

        const oauthSignupInfo = {
          email: user.email || '',
          name: user.user_metadata?.name || user.user_metadata?.full_name,
          company: user.user_metadata?.company,
          tier: 'pro',
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

    // Link existing report purchases to this user by email
    // Handles: user buys report as anonymous → later signs up → gets their purchase linked
    if (data.user?.email) {
      const userEmail = data.user.email.toLowerCase();
      const userId = data.user.id;
      try {
        // Find completed report purchases with matching email but no user_id
        const { data: unlinkedPurchases } = await supabase
          .from('report_purchases')
          .select('id')
          .eq('email', userEmail)
          .eq('status', 'completed')
          .is('user_id', null);

        if (unlinkedPurchases && unlinkedPurchases.length > 0) {
          // Link purchases to this user
          await supabase
            .from('report_purchases')
            .update({ user_id: userId })
            .eq('email', userEmail)
            .eq('status', 'completed')
            .is('user_id', null);

          // Upgrade to report tier (unless already pro)
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('tier')
            .eq('id', userId)
            .single();

          if (profile && profile.tier !== 'pro') {
            await supabase
              .from('user_profiles')
              .update({ tier: 'report', updated_at: new Date().toISOString() })
              .eq('id', userId);
          }
          console.log(`[Auth Callback] Linked ${unlinkedPurchases.length} report purchase(s) to ${userEmail}`);
        }
      } catch (err) {
        console.error('[Auth Callback] Error linking report purchases:', err);
      }
    }

    // R72: Single-session enforcement — set session nonce + log IP.
    // Every subsequent Pro API call validates this nonce. If another login
    // occurs (credential sharing), the nonce changes and the old session
    // gets force-signed-out on next API call.
    if (data.user) {
      try {
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
          || request.headers.get('x-real-ip')
          || null;
        const ua = request.headers.get('user-agent') || null;
        const { setSessionNonce, SESSION_NONCE_COOKIE } = await import('@/lib/auth/session-enforcement');
        const nonce = await setSessionNonce(data.user.id, ip, ua);

        const successUrl = new URL('/', requestUrl.origin);
        successUrl.searchParams.set('verified', 'true');
        const response = NextResponse.redirect(successUrl);
        response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        response.headers.set('Pragma', 'no-cache');
        // Set the session nonce cookie — checked by Pro API routes
        response.cookies.set(SESSION_NONCE_COOKIE, nonce, {
          httpOnly: true,
          secure: true,
          sameSite: 'lax',
          path: '/',
          maxAge: 90 * 24 * 60 * 60, // 90 days
        });
        response.cookies.delete('utm_params');
        return response;
      } catch (err) {
        console.error('[Auth Callback] Session nonce error:', err);
        // Fall through to default redirect if nonce fails — don't block login
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
