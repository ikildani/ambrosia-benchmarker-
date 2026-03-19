import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import type { User } from '@supabase/supabase-js';

/**
 * Extract the authenticated user from the Supabase session (cookie-based PKCE).
 * Returns null if the user is not authenticated.
 */
export async function getAuthenticatedUser(
  request: NextRequest
): Promise<User | null> {
  try {
    // Method 1: Cookie-based session (primary — set by middleware)
    const supabase = await createServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (!error && user) return user;

    // Method 2: Bearer token fallback (for client-side fetch calls)
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const { createClient } = await import('@supabase/supabase-js');
      const directClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: `Bearer ${token}` } } }
      );
      const { data: { user: tokenUser }, error: tokenError } = await directClient.auth.getUser(token);
      if (!tokenError && tokenUser) return tokenUser;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Require authentication — returns the user or a 401 response.
 * Usage: const [user, errorResponse] = await requireAuth(request);
 *        if (errorResponse) return errorResponse;
 */
export async function requireAuth(
  request: NextRequest
): Promise<[User, null] | [null, NextResponse]> {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return [
      null,
      NextResponse.json({ error: 'Authentication required' }, { status: 401 }),
    ];
  }
  return [user, null];
}

/**
 * Validate that the authenticated user owns the requested resource.
 * Returns true if the IDs match.
 */
export function validateOwnership(
  authenticatedUserId: string,
  requestedUserId: string
): boolean {
  return authenticatedUserId === requestedUserId;
}
