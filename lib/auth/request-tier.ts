/**
 * Server-side tier of the signed-in user for API routes that gate data by
 * tier. Never throws: anything unexpected resolves to 'free'.
 *
 * Order: Pro email allowlist, then `user_profiles.tier` (set by the Stripe webhook).
 */

import { createServerClient, createServiceClient } from '@/lib/supabase/server';
import { isProEmailClient } from '@/lib/config/authorized-emails.client';
import type { UserTier } from '@/types/tier';

export async function getRequestUserTier(): Promise<UserTier> {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return 'free';
    if (isProEmailClient(user.email)) return 'pro';

    const serviceClient = createServiceClient();
    const { data: profile } = await serviceClient
      .from('user_profiles')
      .select('tier')
      .eq('id', user.id)
      .single();

    if (profile?.tier === 'pro' || profile?.tier === 'report' || profile?.tier === 'portfolio') {
      return profile.tier as UserTier;
    }
    return 'free';
  } catch {
    return 'free';
  }
}

/** Tiers that see full comparable-deal lists. */
export function hasFullCompsAccess(tier: UserTier): boolean {
  return tier === 'pro' || tier === 'report' || tier === 'portfolio';
}
