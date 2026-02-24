import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { getAuthenticatedUser } from '@/lib/auth-helpers';
import { isAdminEmail } from '@/lib/config/authorized-emails';

/**
 * Verify admin access via Bearer token (timing-safe) or authenticated admin email.
 * Returns null if authorized, or a 401/500 NextResponse if not.
 */
export async function verifyAdminAuth(
  request: NextRequest
): Promise<NextResponse | null> {
  const authHeader = request.headers.get('authorization');
  const adminKey = process.env.ADMIN_API_KEY;

  // Check Bearer token first (timing-safe comparison)
  if (adminKey && authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7); // 'Bearer '.length

    const isValidLength = token.length === adminKey.length;
    const tokenToCompare = isValidLength ? token : adminKey;

    const isValid =
      isValidLength &&
      timingSafeEqual(Buffer.from(tokenToCompare), Buffer.from(adminKey));

    if (isValid) return null; // Authorized
  }

  // Fallback: check authenticated admin email
  const user = await getAuthenticatedUser(request);
  if (user?.email && isAdminEmail(user.email)) {
    return null; // Authorized
  }

  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
