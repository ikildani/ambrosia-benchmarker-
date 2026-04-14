/**
 * Server-side tier resolution — single source of truth for gating pages
 * and server components behind Pro / Portfolio / Report tiers.
 *
 * Mirrors the client-side `tier` in AuthContext but pulls directly from
 * user_profiles so a server render can't be spoofed by a stale cookie.
 */

import { createServerClient } from '@/lib/supabase/server';
import { isProEmail } from '@/lib/config/authorized-emails';

export type TierCheckResult = {
  isAuthenticated: boolean;
  tier: 'free' | 'pro' | 'report' | 'portfolio' | null;
  email: string | null;
  userId: string | null;
  /**
   * True when the user has access to Pro-gated content. This is the
   * canonical check for /intelligence, /playbook, /simulator etc.
   *
   * Resolves to true when any of:
   *   - user_profiles.tier is 'pro', 'report', or 'portfolio'
   *   - email is in the internal PRO_EMAILS allowlist
   */
  hasProAccess: boolean;
};

export async function resolveUserTier(): Promise<TierCheckResult> {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { isAuthenticated: false, tier: null, email: null, userId: null, hasProAccess: false };
    }

    // Internal allowlist short-circuit — free for team emails
    if (user.email && isProEmail(user.email)) {
      return {
        isAuthenticated: true,
        tier: 'pro',
        email: user.email,
        userId: user.id,
        hasProAccess: true,
      };
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('tier')
      .eq('id', user.id)
      .maybeSingle();

    const rawTier = (profile?.tier as string | undefined) ?? 'free';
    const tier = rawTier === 'pro' || rawTier === 'report' || rawTier === 'portfolio'
      ? (rawTier as 'pro' | 'report' | 'portfolio')
      : 'free';
    const hasProAccess = tier === 'pro' || tier === 'report' || tier === 'portfolio';

    return {
      isAuthenticated: true,
      tier,
      email: user.email ?? null,
      userId: user.id,
      hasProAccess,
    };
  } catch {
    return { isAuthenticated: false, tier: null, email: null, userId: null, hasProAccess: false };
  }
}
