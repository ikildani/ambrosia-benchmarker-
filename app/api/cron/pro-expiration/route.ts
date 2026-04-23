import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { sendProExpirationWarning } from '@/lib/email/pro-engagement';
import { timingSafeEqual } from 'crypto';

export const dynamic = 'force-dynamic';

/**
 * R72: Daily cron — Pro engagement expiration management.
 *
 * Runs daily at 8 AM UTC. Two jobs:
 *   1. Send 7-day warning email to users whose Pro expires in 7 days.
 *   2. Auto-downgrade users whose Pro expired today or earlier.
 *
 * Cron config (vercel.json): "0 8 * * *"
 * Auth: Bearer $CRON_SECRET
 */
export async function GET(request: NextRequest) {
  // Auth
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || !authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const token = authHeader.slice(7);
  const isValid = token.length === cronSecret.length &&
    timingSafeEqual(Buffer.from(token), Buffer.from(cronSecret));
  if (!isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const now = new Date();
  const results = { warnings: 0, downgrades: 0, errors: [] as string[] };

  // ─── Job 1: 7-day warning ────────────────────────────────────────
  // Find users whose pro_expires_at is between 6 and 8 days from now
  // (window ensures we don't miss if cron runs slightly early/late)
  const warningStart = new Date(now);
  warningStart.setDate(warningStart.getDate() + 6);
  const warningEnd = new Date(now);
  warningEnd.setDate(warningEnd.getDate() + 8);

  const { data: warningUsers } = await supabase
    .from('user_profiles')
    .select('id, email, full_name, pro_expires_at')
    .eq('tier', 'pro')
    .not('pro_expires_at', 'is', null)
    .gte('pro_expires_at', warningStart.toISOString())
    .lte('pro_expires_at', warningEnd.toISOString());

  if (warningUsers) {
    for (const user of warningUsers) {
      if (!user.email || !user.pro_expires_at) continue;
      try {
        await sendProExpirationWarning({
          to: user.email,
          name: user.full_name || '',
          expiresAt: new Date(user.pro_expires_at),
        });
        results.warnings++;
        console.log(`[pro-expiration] Warning sent: ${user.email} (expires ${user.pro_expires_at})`);
      } catch (err) {
        results.errors.push(`Warning email failed for ${user.email}: ${(err as Error).message}`);
      }
    }
  }

  // ─── Job 2: Auto-downgrade expired users ─────────────────────────
  const { data: expiredUsers } = await supabase
    .from('user_profiles')
    .select('id, email, full_name, pro_expires_at, tier')
    .eq('tier', 'pro')
    .not('pro_expires_at', 'is', null)
    .lte('pro_expires_at', now.toISOString());

  if (expiredUsers) {
    for (const user of expiredUsers) {
      try {
        await supabase
          .from('user_profiles')
          .update({
            tier: 'free', tier_change_authorized: true,
            subscription_status: 'expired',
            updated_at: now.toISOString(),
          })
          .eq('id', user.id);

        // Track the downgrade
        await supabase.from('events').insert({
          event_type: 'pro_engagement_expired',
          event_data: {
            email: user.email,
            expired_at: user.pro_expires_at,
            engagement_type: 'time-limited',
          },
          user_id: user.id,
          user_tier: 'free',
        });

        results.downgrades++;
        console.log(`[pro-expiration] Downgraded: ${user.email} (expired ${user.pro_expires_at})`);
      } catch (err) {
        results.errors.push(`Downgrade failed for ${user.email}: ${(err as Error).message}`);
      }
    }
  }

  console.log(`[pro-expiration] Done: ${results.warnings} warnings, ${results.downgrades} downgrades, ${results.errors.length} errors`);

  return NextResponse.json({
    success: true,
    ...results,
    timestamp: now.toISOString(),
  });
}
