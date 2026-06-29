import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';
import { generateWeeklySnapshot } from '@/lib/digest/weekly-snapshot';
import { buildWeeklyDigestHtml } from '@/lib/digest/email-templates';
import { sendEmail } from '@/lib/email/client';
import { captureApiError } from '@/lib/sentry-api';
import { runCronIntelligence } from '@/lib/cron-intelligence';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const BATCH_SIZE = 50;

export async function GET(request: NextRequest) {
  // Security: Require cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error('CRON_SECRET environment variable is not set');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const expectedToken = `Bearer ${cronSecret}`;
  const providedToken = authHeader || '';

  const isValidLength = providedToken.length === expectedToken.length;
  const tokenToCompare = isValidLength ? providedToken : expectedToken;

  const isValid = isValidLength && timingSafeEqual(
    Buffer.from(tokenToCompare),
    Buffer.from(expectedToken)
  );

  if (!isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createServiceClient();
    // Step 1: Generate the weekly snapshot
    const snapshot = await generateWeeklySnapshot(supabase);
    if (!snapshot) {
      return NextResponse.json({ error: 'Failed to generate snapshot' }, { status: 500 });
    }

    // Step 2: Fetch Pro users who want the weekly digest
    const { data: proUsers, error: usersError } = await supabase
      .from('user_profiles')
      .select('id, email')
      .eq('tier', 'pro');

    if (usersError) {
      console.error('Failed to fetch pro users:', usersError.message);
    }

    // Step 2b: Also fetch newsletter subscribers who completed the drip sequence
    const { data: dripCompleted } = await supabase
      .from('newsletter_subscribers')
      .select('email')
      .eq('status', 'active')
      .eq('drip_completed', true);

    // Merge Pro users + drip-completed subscribers (deduplicate by email)
    const allEmails = new Map<string, { id?: string; email: string; isPro: boolean }>();

    (proUsers || []).forEach(u => {
      allEmails.set(u.email.toLowerCase(), { id: u.id, email: u.email, isPro: true });
    });

    (dripCompleted || []).forEach(s => {
      const key = s.email.toLowerCase();
      if (!allEmails.has(key)) {
        allEmails.set(key, { email: s.email, isPro: false });
      }
    });

    if (allEmails.size === 0) {
      return NextResponse.json({ success: true, snapshot_id: snapshot.id, emails_sent: 0 });
    }

    // Filter out Pro users who opted out of weekly digest
    const proUserIds = (proUsers || []).map((u) => u.id);
    const { data: emailPrefs } = await supabase
      .from('email_preferences')
      .select('user_id, weekly_digest')
      .in('user_id', proUserIds.length > 0 ? proUserIds : ['none']);

    const optedOut = new Set(
      (emailPrefs || [])
        .filter((p) => p.weekly_digest === false)
        .map((p) => p.user_id)
    );

    // Remove opted-out Pro users from the list
    for (const [key, user] of allEmails) {
      if (user.isPro && user.id && optedOut.has(user.id)) {
        allEmails.delete(key);
      }
    }

    const eligibleUsers = Array.from(allEmails.values());

    // Step 3: Send emails in batches
    let emailsSent = 0;
    let emailErrors = 0;
    const errorDetails: string[] = [];

    for (let i = 0; i < eligibleUsers.length; i += BATCH_SIZE) {
      const batch = eligibleUsers.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(async (user) => {
          // Fetch watchlist only for Pro users (they have user IDs)
          let watchlistItems: { item_type: string; item_value: string }[] = [];
          if (user.id) {
            const { data } = await supabase
              .from('watchlist_items')
              .select('item_type, item_value')
              .eq('user_id', user.id);
            watchlistItems = data || [];
          }

          const userName = user.email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
          const html = buildWeeklyDigestHtml(
            snapshot,
            watchlistItems,
            userName
          );

          const result = await sendEmail({
            to: user.email,
            subject: `Market Pulse: ${snapshot.new_deals_count} new deals this week`,
            html,
          });

          if (result.success && user.id) {
            // Log the send (only for tracked users)
            await supabase.from('digest_sends').insert({
              user_id: user.id,
              snapshot_id: snapshot.id,
              digest_type: 'weekly',
              resend_id: result.id || null,
            }).then(() => {}, () => {});

            await supabase.from('email_logs').insert({
              user_id: user.id,
              email_type: 'weekly_digest',
              status: 'sent',
              metadata: { snapshot_id: snapshot.id },
            }).then(() => {}, () => {});
          }

          return result;
        })
      );

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value.success) {
          emailsSent++;
        } else {
          emailErrors++;
          if (result.status === 'rejected') {
            console.error('Digest send error:', result.reason);
            errorDetails.push(String(result.reason));
          } else if (result.status === 'fulfilled') {
            console.error('Digest send failed:', result.value.error);
            errorDetails.push(String(result.value.error));
          }
        }
      }
    }

    // Update last sent timestamp for eligible users
    const eligibleIds = eligibleUsers.map((u) => u.id);
    if (eligibleIds.length > 0) {
      await supabase
        .from('email_preferences')
        .upsert(
          eligibleIds.map((id) => ({
            user_id: id,
            weekly_digest_last_sent: new Date().toISOString(),
          })),
          { onConflict: 'user_id' }
        );
    }

    // Intelligence tracking
    try {
      await runCronIntelligence(supabase, 'weekly-digest', {
        processed: eligibleUsers.length,
        inserted: emailsSent,
      });
    } catch {}

    return NextResponse.json({
      success: true,
      snapshot_id: snapshot.id,
      snapshot: {
        new_deals: snapshot.new_deals_count,
        avg_upfront: snapshot.avg_upfront_usd,
        benchmark_changes: Object.keys(snapshot.benchmark_changes).length,
      },
      emails_sent: emailsSent,
      emails_errors: emailErrors,
      email_error_details: errorDetails.length > 0 ? errorDetails : undefined,
      total_pro_users: proUsers?.length ?? 0,
      eligible_users: eligibleUsers.length,
    });
  } catch (error) {
    captureApiError(error, 'cron-weekly-digest');
    return NextResponse.json({ error: 'Weekly digest failed' }, { status: 500 });
  }
}
