/**
 * R72: Reusable guard for Pro API routes that enforces single-session.
 *
 * Usage in any API route:
 *
 *   import { requireSingleSession } from '@/lib/auth/require-single-session';
 *
 *   export async function POST(request: NextRequest) {
 *     const sessionCheck = await requireSingleSession(request);
 *     if (sessionCheck) return sessionCheck; // returns 401 if stale session
 *     // ... route logic
 *   }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-helpers';
import { validateSessionNonce, SESSION_NONCE_COOKIE } from './session-enforcement';

/**
 * Returns null if session is valid. Returns a 401 NextResponse if the
 * session nonce is stale (another login has occurred).
 *
 * Non-blocking for:
 *   - Unauthenticated requests (handled by route's own auth check)
 *   - Free-tier users (no session enforcement)
 *   - Users who haven't logged in since the migration (no nonce in DB yet)
 */
export async function requireSingleSession(
  request: NextRequest,
): Promise<NextResponse | null> {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user?.id) return null; // not authenticated — let route handle auth

    const cookieNonce = request.cookies.get(SESSION_NONCE_COOKIE)?.value;
    const result = await validateSessionNonce(user.id, cookieNonce);

    if (!result.valid) {
      console.warn(
        `[Session Enforcement] Blocked stale session for ${user.email}: ${result.reason}`
      );
      return NextResponse.json(
        {
          error: 'Session expired — your account was signed in from another device. Please sign in again.',
          code: 'SESSION_EXPIRED',
        },
        { status: 401 }
      );
    }

    return null; // session valid — proceed
  } catch (err) {
    // Don't block on enforcement errors — log and allow
    console.error('[Session Enforcement] Error:', err);
    return null;
  }
}
