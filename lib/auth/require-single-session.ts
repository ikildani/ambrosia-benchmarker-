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
 * Accepts both Request (Web API) and NextRequest (Next.js) — routes use
 * different param types depending on whether they import NextRequest.
 */
export async function requireSingleSession(
  request: Request | NextRequest,
): Promise<NextResponse | null> {
  try {
    const user = await getAuthenticatedUser(request as NextRequest);
    if (!user?.id) return null;

    // Extract cookie — works for both NextRequest (.cookies) and plain Request (Cookie header)
    let cookieNonce: string | undefined;
    if ('cookies' in request && typeof (request as NextRequest).cookies?.get === 'function') {
      cookieNonce = (request as NextRequest).cookies.get(SESSION_NONCE_COOKIE)?.value;
    } else {
      const cookieHeader = request.headers.get('cookie') || '';
      const match = cookieHeader.match(new RegExp(`${SESSION_NONCE_COOKIE}=([^;]+)`));
      cookieNonce = match?.[1];
    }
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
