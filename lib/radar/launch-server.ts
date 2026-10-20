import { resolveUserTier, type TierCheckResult } from '@/lib/auth/tier-check';
import { RADAR_PUBLIC, radarVisibleTo } from './launch';

/** Server check for Radar pages: public launch, or a signed-in internal preview account. */
export async function radarAccessible(): Promise<boolean> {
  if (RADAR_PUBLIC) return true;
  const auth = await resolveUserTier();
  return radarVisibleTo(auth.email);
}

/**
 * Tier check for /api/radar/* routes. Before public launch, anyone outside the
 * preview list is treated as having no Pro access, so every route's existing
 * `hasProAccess` guard returns 403 for them.
 */
export async function resolveRadarAccess(): Promise<TierCheckResult> {
  const auth = await resolveUserTier();
  if (RADAR_PUBLIC || radarVisibleTo(auth.email)) return auth;
  return { ...auth, hasProAccess: false };
}
