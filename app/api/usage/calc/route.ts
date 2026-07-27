import { NextRequest } from 'next/server';
import { createHash } from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/auth-helpers';
import { apiSuccess, apiError } from '@/lib/api-response';
import { isProEmail } from '@/lib/config/authorized-emails';
import { captureApiError } from '@/lib/sentry-api';

const FREE_CALC_LIMIT = 3;
const STARTER_CALC_LIMIT = 10;

function getCurrentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Build an IP+UA hash for anonymous fingerprinting.
 * Not meant to be unbreakable -- just enough friction to stop casual
 * incognito bypasses. Combining IP + User-Agent makes it harder to
 * spoof from the same machine.
 */
function buildIpHash(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';
  const ua = request.headers.get('user-agent') || 'unknown';
  return createHash('sha256').update(`${ip}:${ua}`).digest('hex').slice(0, 32);
}

/**
 * GET /api/usage/calc
 * Returns current usage count and whether the user can calculate.
 * Used by the frontend to check status before showing results.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const period = getCurrentPeriod();

    // Check if user is authenticated
    const authUser = await getAuthenticatedUser(request);

    if (authUser) {
      // Authenticated user: check tier first
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('tier, email')
        .eq('id', authUser.id)
        .single();

      const tier = profile?.tier || 'free';
      const email = profile?.email || authUser.email;

      // Pro/portfolio/report users always allowed
      if (tier === 'pro' || tier === 'portfolio' || tier === 'report' || isProEmail(email)) {
        return apiSuccess({ allowed: true, remaining: Infinity, total: 0, limit: Infinity, tier: 'pro' });
      }

      const limit = tier === 'starter' ? STARTER_CALC_LIMIT : FREE_CALC_LIMIT;

      // Get usage from calc_usage table
      const { data: usage } = await supabase
        .from('calc_usage')
        .select('count')
        .eq('user_id', authUser.id)
        .eq('period', period)
        .single();

      const count = usage?.count || 0;
      const remaining = Math.max(0, limit - count);

      return apiSuccess({
        allowed: count < limit,
        remaining,
        total: count,
        limit,
        tier,
      });
    }

    // Anonymous user: check by IP hash
    const ipHash = buildIpHash(request);

    const { data: usage } = await supabase
      .from('calc_usage')
      .select('count')
      .eq('ip_hash', ipHash)
      .eq('period', period)
      .single();

    const count = usage?.count || 0;
    const remaining = Math.max(0, FREE_CALC_LIMIT - count);

    return apiSuccess({
      allowed: count < FREE_CALC_LIMIT,
      remaining,
      total: count,
      limit: FREE_CALC_LIMIT,
      tier: 'free',
    });
  } catch (error) {
    captureApiError(error, 'usage-calc-get');
    return apiError('Failed to check usage', 500);
  }
}

/**
 * POST /api/usage/calc
 * Increments the usage counter. Returns updated status.
 * Called when a calculation is performed (both initial calc and sensitivity recalcs).
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const period = getCurrentPeriod();

    const authUser = await getAuthenticatedUser(request);

    if (authUser) {
      // Authenticated user
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('tier, email')
        .eq('id', authUser.id)
        .single();

      const tier = profile?.tier || 'free';
      const email = profile?.email || authUser.email;

      // Pro/portfolio/report users: always allowed, don't even count
      if (tier === 'pro' || tier === 'portfolio' || tier === 'report' || isProEmail(email)) {
        return apiSuccess({ allowed: true, remaining: Infinity, total: 0, limit: Infinity, tier: 'pro' });
      }

      const limit = tier === 'starter' ? STARTER_CALC_LIMIT : FREE_CALC_LIMIT;

      // Upsert: increment count or create new row
      const { data: existing } = await supabase
        .from('calc_usage')
        .select('id, count')
        .eq('user_id', authUser.id)
        .eq('period', period)
        .single();

      let newCount: number;

      if (existing) {
        // Check before incrementing
        if (existing.count >= limit) {
          return apiSuccess({
            allowed: false,
            remaining: 0,
            total: existing.count,
            limit,
            tier,
          });
        }

        newCount = existing.count + 1;
        await supabase
          .from('calc_usage')
          .update({ count: newCount, last_calc_at: new Date().toISOString() })
          .eq('id', existing.id);
      } else {
        newCount = 1;
        await supabase
          .from('calc_usage')
          .insert({
            user_id: authUser.id,
            period,
            count: 1,
            last_calc_at: new Date().toISOString(),
          });
      }

      const remaining = Math.max(0, limit - newCount);

      return apiSuccess({
        allowed: newCount <= limit,
        remaining,
        total: newCount,
        limit,
        tier,
      });
    }

    // Anonymous user: track by IP hash
    const ipHash = buildIpHash(request);

    const { data: existing } = await supabase
      .from('calc_usage')
      .select('id, count')
      .eq('ip_hash', ipHash)
      .eq('period', period)
      .single();

    let newCount: number;

    if (existing) {
      if (existing.count >= FREE_CALC_LIMIT) {
        return apiSuccess({
          allowed: false,
          remaining: 0,
          total: existing.count,
          limit: FREE_CALC_LIMIT,
          tier: 'free',
        });
      }

      newCount = existing.count + 1;
      await supabase
        .from('calc_usage')
        .update({ count: newCount, last_calc_at: new Date().toISOString() })
        .eq('id', existing.id);
    } else {
      newCount = 1;
      await supabase
        .from('calc_usage')
        .insert({
          ip_hash: ipHash,
          period,
          count: 1,
          last_calc_at: new Date().toISOString(),
        });
    }

    const remaining = Math.max(0, FREE_CALC_LIMIT - newCount);

    return apiSuccess({
      allowed: newCount <= FREE_CALC_LIMIT,
      remaining,
      total: newCount,
      limit: FREE_CALC_LIMIT,
      tier: 'free',
    });
  } catch (error) {
    captureApiError(error, 'usage-calc-post');
    return apiError('Failed to track usage', 500);
  }
}
