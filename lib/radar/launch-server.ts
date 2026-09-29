import { resolveUserTier } from '@/lib/auth/tier-check';
import { RADAR_PUBLIC, radarVisibleTo } from './launch';

/** Server check for Radar pages: public launch, or a signed-in internal preview account. */
export async function radarAccessible(): Promise<boolean> {
  if (RADAR_PUBLIC) return true;
  const auth = await resolveUserTier();
  return radarVisibleTo(auth.email);
}
