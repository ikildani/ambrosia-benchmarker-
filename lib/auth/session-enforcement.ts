/**
 * R72: Single-session enforcement for paid accounts.
 *
 * Ensures only one active login per user. When a user logs in, a new
 * session nonce is generated and stored in user_profiles. Every Pro API
 * call validates the nonce in the cookie matches the DB. Mismatch = stale
 * session from a prior login (or shared credentials) → force sign-out.
 *
 * This prevents credential sharing: if person B logs in with Mehdi's
 * password, person A's next API call will fail nonce check and get
 * signed out.
 *
 * NOTE: enforcement only applies to Pro-tier API routes (deal-memo,
 * playbook, report, scenarios, partners, calculations). Static page
 * renders are NOT checked — this avoids a DB query on every page load.
 */

import { createServiceClient } from '@/lib/supabase/server';
import crypto from 'crypto';

const SESSION_NONCE_COOKIE = 'x-av-session-nonce';

/**
 * Generate a new session nonce, save to DB, return for cookie setting.
 * Called from auth/callback on every login.
 */
export async function setSessionNonce(
  userId: string,
  ip: string | null,
  userAgent: string | null,
): Promise<string> {
  const nonce = crypto.randomUUID();
  const supabase = createServiceClient();

  await supabase
    .from('user_profiles')
    .update({
      active_session_nonce: nonce,
      last_login_ip: ip,
      last_login_at: new Date().toISOString(),
      last_login_user_agent: userAgent?.slice(0, 500) || null,
    })
    .eq('id', userId);

  return nonce;
}

/**
 * Validate that the session nonce in the cookie matches the DB.
 * Returns { valid: true } if match, { valid: false, reason } if not.
 *
 * Called from Pro API routes before processing the request.
 */
export async function validateSessionNonce(
  userId: string,
  cookieNonce: string | undefined,
): Promise<{ valid: boolean; reason?: string }> {
  if (!cookieNonce) {
    return { valid: false, reason: 'no session nonce cookie' };
  }

  const supabase = createServiceClient();
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('active_session_nonce, tier')
    .eq('id', userId)
    .single();

  if (!profile) {
    return { valid: false, reason: 'user profile not found' };
  }

  // Only enforce for Pro tier (free tier doesn't need session gating)
  if (profile.tier !== 'pro' && profile.tier !== 'report' && profile.tier !== 'portfolio') {
    return { valid: true };
  }

  // If no nonce in DB yet (pre-migration login), allow and set on next login
  if (!profile.active_session_nonce) {
    return { valid: true };
  }

  if (profile.active_session_nonce !== cookieNonce) {
    return {
      valid: false,
      reason: 'session nonce mismatch — another login has occurred on this account',
    };
  }

  return { valid: true };
}

export { SESSION_NONCE_COOKIE };
