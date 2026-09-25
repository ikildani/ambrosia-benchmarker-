/**
 * Auth for the entity-graph routes: a shared service key (`x-api-key` equal
 * to ENTITY_API_KEY, for Terrain / Augur server-to-server calls) or an
 * authenticated Solidus session. Never both required.
 */

import { timingSafeEqual } from 'crypto';
import type { NextRequest } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-helpers';
import { getIdentifier } from '@/lib/rate-limit';

export interface EntityAuth {
  ok: boolean;
  via: 'api_key' | 'session' | null;
  /** Rate-limit identifier: the key holder or the session user, else the IP. */
  identifier: string;
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length || ba.length === 0) return false;
  return timingSafeEqual(ba, bb);
}

export async function authorizeEntityRequest(request: NextRequest): Promise<EntityAuth> {
  const configured = process.env.ENTITY_API_KEY?.trim();
  const presented = request.headers.get('x-api-key')?.trim();
  if (configured && presented && safeEqual(configured, presented)) {
    return { ok: true, via: 'api_key', identifier: 'entity-key' };
  }
  const user = await getAuthenticatedUser(request);
  if (user) return { ok: true, via: 'session', identifier: `user:${user.id}` };
  return { ok: false, via: null, identifier: getIdentifier(request) };
}
