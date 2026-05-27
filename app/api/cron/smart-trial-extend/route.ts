import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';
import { sendEmail } from '@/lib/email/client';
import { logCronRun } from '@/lib/cron-utils';
import { captureApiError } from '@/lib/sentry-api';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Smart Trial Extension Cron — Daily 7AM UTC
//
// Extends Pro trial users by 7 days if they meet BOTH criteria:
//   1. pro_expires_at is within the next 2 days (about to expire)
//   2. 3+ events in the last 7 days (actively using the product)
//
// Rationale: extending active trial users costs $0 (they're not paying yet)
// but doubles conversion probability — 14 days of usage vs 7.
//
// Guards against infinite extensions: only extends once per user by checking
// for a prior 'smart_trial_extension' event.
//
// Cron config (vercel.json): "0 7 * * *"
// Auth: Bearer $CRON_SECRET
// ---------------------------------------------------------------------------

const BASE_URL = 'https://calculator.ambrosiaventures.co';

function buildExtensionEmail(
  firstName: string,
  newExpiry: Date,
): { subject: string; html: string } {
  const expiryFormatted = newExpiry.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return {
    subject: 'Your Pro trial has been extended',
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #0b1120; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 24px;">
    <!-- Header -->
    <div style="text-align: center; padding: 32px 24px; background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%); border-radius: 16px 16px 0 0; border: 1px solid #1e3a5f; border-bottom: none;">
      <img src="${BASE_URL}/icon-color.png" alt="Ambrosia Ventures" width="48" height="48" style="margin-bottom: 16px;">
      <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.3px;">Ambrosia Ventures</h1>
      <p style="color: #64748b; margin: 4px 0 0; font-size: 13px;">Deal Intelligence Platform</p>
    </div>

    <!-- Body -->
    <div style="background: #111827; padding: 32px; border: 1px solid #1e3a5f; border-top: none; border-radius: 0 0 16px 16px;">
      <p style="color: #e2e8f0; font-size: 16px; margin: 0 0 16px;">Hi${firstName ? ` ${firstName}` : ''},</p>

      <p style="color: #94a3b8; font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
        We noticed you have been actively using the Benchmarker, so we extended your Pro access by another 7 days, free.
      </p>

      <div style="background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; padding: 20px; margin: 20px 0; text-align: center;">
        <p style="color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 4px;">Pro Access Extended Until</p>
        <p style="color: #14b8a6; font-size: 20px; font-weight: 700; margin: 0;">${expiryFormatted}</p>
      </div>

      <p style="color: #94a3b8; font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
        Keep exploring everything Pro unlocks: partner matching, scenario comparison, deal waterfall, rNPV modeling, and full PDF/Excel exports.
      </p>

      <div style="text-align: center; margin: 28px 0;">
        <a href="${BASE_URL}/pro" style="display: inline-block; background: linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%); color: #ffffff; padding: 14px 36px; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 15px; letter-spacing: 0.2px;">
          Keep Pro Permanently
        </a>
      </div>

      <p style="color: #64748b; font-size: 13px; margin: 24px 0 0; border-top: 1px solid #1e293b; padding-top: 16px;">
        When you are ready to upgrade, it is $299/month or $199/month on an annual plan.
      </p>

      <p style="color: #94a3b8; font-size: 15px; margin: 16px 0 0;">
        -- Issa<br>
        <span style="color: #64748b; font-size: 13px;">Ambrosia Ventures</span>
      </p>
    </div>

    <!-- Footer -->
    <div style="text-align: center; padding: 24px; color: #475569; font-size: 12px; line-height: 1.5;">
      <p style="margin: 0;">Ambrosia Ventures | <a href="https://ambrosiaventures.co" style="color: #14b8a6; text-decoration: none;">ambrosiaventures.co</a></p>
      <p style="margin: 8px 0 0;">
        <a href="${BASE_URL}/unsubscribe" style="color: #475569; text-decoration: underline;">Unsubscribe</a>
      </p>
    </div>
  </div>
</body>
</html>`,
  };
}

export async function GET(request: NextRequest) {
  // Auth
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '') || '';
  const secret = process.env.CRON_SECRET || '';

  if (!token || !secret || token.length !== secret.length) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    if (!timingSafeEqual(Buffer.from(token), Buffer.from(secret))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createServiceClient();
    const now = new Date();
    const twoDaysFromNow = new Date(now.getTime() + 2 * 86400000);

    // Find Pro trial users expiring in the next 2 days
    const { data: expiringUsers } = await supabase
      .from('user_profiles')
      .select('id, email, full_name, pro_expires_at, tier')
      .eq('tier', 'pro')
      .not('pro_expires_at', 'is', null)
      .lte('pro_expires_at', twoDaysFromNow.toISOString())
      .gte('pro_expires_at', now.toISOString());

    if (!expiringUsers || expiringUsers.length === 0) {
      return NextResponse.json({
        success: true,
        checked: 0,
        extended: 0,
        message: 'No users expiring in next 2 days',
      });
    }

    // Check which users have already been extended (prevent infinite loops)
    const userIds = expiringUsers.map(u => u.id);
    const { data: priorExtensions } = await supabase
      .from('events')
      .select('user_id')
      .eq('event_type', 'smart_trial_extension')
      .in('user_id', userIds);

    const alreadyExtendedSet = new Set(
      (priorExtensions || []).map(e => e.user_id),
    );

    let extended = 0;
    const errors: string[] = [];

    for (const user of expiringUsers) {
      // Skip users who were already extended once
      if (alreadyExtendedSet.has(user.id)) {
        console.log(`[smart-trial-extend] Skipping ${user.email} — already extended`);
        continue;
      }

      try {
        // Check activity: 3+ events in last 7 days
        const { count } = await supabase
          .from('events')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('created_at', new Date(now.getTime() - 7 * 86400000).toISOString());

        if (!count || count < 3) {
          console.log(`[smart-trial-extend] Skipping ${user.email} — only ${count || 0} events in last 7d`);
          continue;
        }

        // Extend by 7 days from current expiry
        const currentExpiry = new Date(user.pro_expires_at!);
        const newExpiry = new Date(currentExpiry.getTime() + 7 * 86400000);

        await supabase
          .from('user_profiles')
          .update({
            pro_expires_at: newExpiry.toISOString(),
            updated_at: now.toISOString(),
          })
          .eq('id', user.id);

        // Send extension email
        if (user.email) {
          const firstName = user.full_name?.split(' ')[0] || '';
          const { subject, html } = buildExtensionEmail(firstName, newExpiry);
          await sendEmail({ to: user.email, subject, html }).catch(err => {
            console.error(`[smart-trial-extend] Email failed for ${user.email}:`, err);
          });
        }

        // Track the extension event
        await supabase.from('events').insert({
          event_type: 'smart_trial_extension',
          event_data: {
            old_expiry: user.pro_expires_at,
            new_expiry: newExpiry.toISOString(),
            activity_count: count,
          },
          user_id: user.id,
          user_tier: 'pro',
        }).catch(() => {});

        extended++;
        console.log(`[smart-trial-extend] Extended ${user.email}: ${user.pro_expires_at} -> ${newExpiry.toISOString()} (${count} events)`);
      } catch (err) {
        errors.push(`${user.email}: ${String(err)}`);
      }
    }

    // Log cron run
    await logCronRun(supabase, 'smart-trial-extend', {
      fetched: expiringUsers.length,
      processed: expiringUsers.length - alreadyExtendedSet.size,
      inserted: extended,
      errors,
    });

    // Slack notification if any extensions happened
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (webhookUrl && extended > 0) {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `Smart trial extension: ${extended} user${extended !== 1 ? 's' : ''} extended by 7 days`,
        }),
      }).catch(() => {});
    }

    console.log(`[smart-trial-extend] Done: checked ${expiringUsers.length}, extended ${extended}, errors ${errors.length}`);

    return NextResponse.json({
      success: true,
      checked: expiringUsers.length,
      alreadyExtended: alreadyExtendedSet.size,
      extended,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    captureApiError(error, 'cron-smart-trial-extend');
    return NextResponse.json({ error: 'Smart trial extension cron failed' }, { status: 500 });
  }
}
