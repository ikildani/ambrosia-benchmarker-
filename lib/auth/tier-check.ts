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

    // Check database tier first (authoritative), then fall back to email allowlist
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('tier')
      .eq('id', user.id)
      .maybeSingle();

    const rawTier = (profile?.tier as string | undefined) ?? 'free';
    let tier: 'free' | 'pro' | 'report' | 'portfolio' = rawTier === 'pro' || rawTier === 'report' || rawTier === 'portfolio'
      ? (rawTier as 'pro' | 'report' | 'portfolio')
      : 'free';

    // Email allowlist fallback — only when DB says 'free'
    if (tier === 'free' && user.email && isProEmail(user.email)) {
      tier = 'pro';
      try {
        await supabase.from('events').insert({
          event_type: 'pro_email_bypass',
          event_data: { email: user.email, source: 'tier-check' },
          user_id: user.id,
          user_tier: 'pro',
        });
      } catch {} // non-blocking
    }

    const hasProAccess = tier === 'pro' || tier === 'report' || tier === 'portfolio';

    return {
      isAuthenticated: true,
      tier,
      email: user.email ?? null,
      userId: user.id,
      hasProAccess,
    };
  } catch (err) {
    console.error('[tier-check] Failed to resolve user tier:', err instanceof Error ? err.message : String(err));
    // Fallback: try service client with cookies header to handle SSR edge cases
    try {
      const { cookies } = await import('next/headers');
      const cookieStore = await cookies();
      const authToken = cookieStore.getAll().find(c => c.name.includes('auth-token') && !c.name.includes('.'));
      if (authToken) {
        console.log('[tier-check] Auth cookie exists but getUser() failed — possible SSR race condition');
      }
    } catch {}
    return { isAuthenticated: false, tier: null, email: null, userId: null, hasProAccess: false };
  }
}
