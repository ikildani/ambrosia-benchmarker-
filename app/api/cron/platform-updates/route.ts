import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';
import { buildPlatformUpdatesHtml } from '@/lib/email/platform-updates-template';
import { sendEmail } from '@/lib/email/client';
import { captureApiError } from '@/lib/sentry-api';
import { runCronIntelligence } from '@/lib/cron-intelligence';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const BATCH_SIZE = 50;

export async function GET(request: NextRequest) {
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

    // Step 1: Fetch unsent updates
    const { data: updates, error: fetchError } = await supabase
      .from('platform_updates')
      .select('*')
      .is('sent_at', null)
      .order('created_at', { ascending: true });

    if (fetchError) {
      captureApiError(fetchError, 'cron-platform-updates-fetch');
      return NextResponse.json({ error: 'Failed to fetch updates' }, { status: 500 });
    }

    if (!updates || updates.length === 0) {
      return NextResponse.json({ success: true, skipped: true, reason: 'no_unsent_updates' });
    }

    // Step 2: Mark as sent immediately to prevent double-send
    const updateIds = updates.map((u) => u.id);
    await supabase
      .from('platform_updates')
      .update({ sent_at: new Date().toISOString() })
      .in('id', updateIds);

    // Step 3: Build recipient list — all registered users + active newsletter subscribers
    const { data: allUsers } = await supabase
      .from('user_profiles')
      .select('id, email');

    const { data: subscribers } = await supabase
      .from('newsletter_subscribers')
      .select('email')
      .eq('status', 'active');

    const allEmails = new Map<string, { id?: string; email: string }>();

    (allUsers || []).forEach((u) => {
      allEmails.set(u.email.toLowerCase(), { id: u.id, email: u.email });
    });

    (subscribers || []).forEach((s) => {
      const key = s.email.toLowerCase();
      if (!allEmails.has(key)) {
        allEmails.set(key, { email: s.email });
      }
    });

    if (allEmails.size === 0) {
      return NextResponse.json({ success: true, updates_count: updates.length, emails_sent: 0 });
    }

    // Step 4: Filter out users who opted out
    const userIds = [...allEmails.values()].filter((u) => u.id).map((u) => u.id!);
    const { data: emailPrefs } = await supabase
      .from('email_preferences')
      .select('user_id, platform_updates')
      .in('user_id', userIds.length > 0 ? userIds : ['none']);

    const optedOut = new Set(
      (emailPrefs || [])
        .filter((p) => p.platform_updates === false)
        .map((p) => p.user_id)
    );

    for (const [key, user] of allEmails) {
      if (user.id && optedOut.has(user.id)) {
        allEmails.delete(key);
      }
    }

    const eligibleUsers = Array.from(allEmails.values());

    // Step 5: Send emails in batches
    let emailsSent = 0;
    let emailErrors = 0;
    const errorDetails: string[] = [];

    for (let i = 0; i < eligibleUsers.length; i += BATCH_SIZE) {
      const batch = eligibleUsers.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(async (user) => {
          const userName = user.email
            .split('@')[0]
            .replace(/[._-]/g, ' ')
            .replace(/\b\w/g, (c: string) => c.toUpperCase());

          const unsubscribeUrl = user.id
            ? 'https://calculator.ambrosiaventures.co/dashboard?tab=settings'
            : `https://calculator.ambrosiaventures.co/api/newsletter/unsubscribe?email=${encodeURIComponent(user.email)}&type=platform_updates`;

          const html = buildPlatformUpdatesHtml(updates, userName, unsubscribeUrl);

          const result = await sendEmail({
            to: user.email,
            subject: `What's New: ${updates.length} update${updates.length !== 1 ? 's' : ''} to the Deal Calculator`,
            html,
          });

          if (result.success && user.id) {
            await supabase.from('email_logs').insert({
              user_id: user.id,
              email: user.email,
              email_type: 'platform_updates',
              status: 'sent',
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
            errorDetails.push(String(result.reason));
          } else if (result.status === 'fulfilled') {
            errorDetails.push(String(result.value.error));
          }
        }
      }
    }

    // Intelligence tracking
    try {
      await runCronIntelligence(supabase, 'platform-updates', {
        processed: eligibleUsers.length,
        inserted: emailsSent,
      });
    } catch {}

    return NextResponse.json({
      success: true,
      updates_count: updates.length,
      emails_sent: emailsSent,
      emails_errors: emailErrors,
      email_error_details: errorDetails.length > 0 ? errorDetails : undefined,
      eligible_users: eligibleUsers.length,
      total_users: allUsers?.length ?? 0,
      total_subscribers: subscribers?.length ?? 0,
    });
  } catch (error) {
    captureApiError(error, 'cron-platform-updates');
    return NextResponse.json({ error: 'Platform updates cron failed' }, { status: 500 });
  }
}
