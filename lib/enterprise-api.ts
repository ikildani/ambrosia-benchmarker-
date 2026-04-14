/**
 * Enterprise API key lifecycle helpers — shared between /enterprise page
 * and /api/enterprise/* server routes.
 */

import { createHash, randomBytes } from 'crypto';

const KEY_PREFIX = 'ambk_';

/** Generate a fresh API key. Returns { key, hash, prefix }. Caller stores hash. */
export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const entropy = randomBytes(32).toString('base64url');
  const key = `${KEY_PREFIX}${entropy}`;
  const hash = hashApiKey(key);
  const prefix = key.slice(0, 12); // e.g. "ambk_aBcdEfGh"
  return { key, hash, prefix };
}

/** Deterministic hash of an API key for storage. */
export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

export const TIER_QUOTAS: Record<'pilot' | 'growth' | 'enterprise', number> = {
  pilot: 1000,
  growth: 10000,
  enterprise: 100000,
};

export function currentPeriodMonth(date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}
