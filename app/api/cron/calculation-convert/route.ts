import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';
import { sendEmail } from '@/lib/email/client';
import { logCronRun } from '@/lib/cron-utils';
import { captureApiError } from '@/lib/sentry-api';
import { runCronIntelligence } from '@/lib/cron-intelligence';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Calculation-Triggered Conversion Email — Every 4 hours
//
// Finds free-tier users who ran 2+ calculations in the last 24 hours (high
// intent signal) and sends them a personalized "unlock full analysis" email
// with their ACTUAL deal terms visible and a 48-hour urgency window.
//
// Guards:
//   - Only targets tier='free' users
//   - Skips users who already received this email (event_type='calc_convert_sent')
//   - Skips users who are already Pro or have active Stripe subscriptions
//
// Cron config (vercel.json): "0 */4 * * *"
// Auth: Bearer $CRON_SECRET
// ---------------------------------------------------------------------------

const BASE_URL = 'https://solidus.ambrosiaventures.co';

function formatLabel(value: string): string {
  return value
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^./, s => s.toUpperCase())
    .trim();
}

function buildConversionEmail(
  firstName: string,
  calcCount: number,
  therapeuticArea: string,
  modality: string,
  indication: string,
  upfrontRange?: string,
  totalDealRange?: string,
): { subject: string; html: string } {
  const taLabel = formatLabel(therapeuticArea);
  const modalityLabel = formatLabel(modality);
  const indicationLabel = formatLabel(indication);

  const hasNumbers = upfrontRange && totalDealRange;
  const subject = hasNumbers
    ? `${taLabel} ${modalityLabel}: ${upfrontRange} upfront, ${totalDealRange} total — your full model is ready`
    : `Your ${calcCount} ${taLabel} deal model${calcCount !== 1 ? 's are' : ' is'} ready — unlock the full analysis`;

  return {
    subject,
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #0b1120; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 24px;">
    <div style="text-align: center; padding: 32px 24px; background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%); border-radius: 16px 16px 0 0; border: 1px solid #1e3a5f; border-bottom: none;">
      <img src="${BASE_URL}/icon-color.png" alt="Ambrosia Ventures" width="48" height="48" style="margin-bottom: 16px;">
      <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700;">Ambrosia Ventures</h1>
      <p style="color: #64748b; margin: 4px 0 0; font-size: 13px;">Deal Intelligence Platform</p>
    </div>

    <div style="background: #111827; padding: 32px; border: 1px solid #1e3a5f; border-top: none; border-radius: 0 0 16px 16px;">
      <p style="color: #e2e8f0; font-size: 16px; margin: 0 0 16px;">Hi${firstName ? ` ${firstName}` : ''},</p>

      <p style="color: #94a3b8; font-size: 15px; line-height: 1.7; margin: 0 0 20px;">
        You ran ${calcCount} ${taLabel} valuation${calcCount !== 1 ? 's' : ''} on our platform. Your analysis is ready.
      </p>

      ${hasNumbers ? `
      <!-- Actual deal numbers from their calculation -->
      <div style="background: linear-gradient(135deg, #0f172a, #1a1e42); border: 1px solid #14b8a640; border-radius: 12px; padding: 24px; margin: 20px 0; text-align: center;">
        <p style="color: #14b8a6; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 16px;">Your ${indicationLabel} ${modalityLabel} Deal Range</p>
        <div style="display: flex; justify-content: center; gap: 32px;">
          <div>
            <p style="color: #fff; font-size: 24px; font-weight: 800; margin: 0;">${upfrontRange}</p>
            <p style="color: #64748b; font-size: 11px; margin: 4px 0 0; text-transform: uppercase; letter-spacing: 0.5px;">Upfront</p>
          </div>
          <div style="width: 1px; background: #1e293b;"></div>
          <div>
            <p style="color: #fff; font-size: 24px; font-weight: 800; margin: 0;">${totalDealRange}</p>
            <p style="color: #64748b; font-size: 11px; margin: 4px 0 0; text-transform: uppercase; letter-spacing: 0.5px;">Total Deal Value</p>
          </div>
        </div>
      </div>
      ` : ''}

      <div style="background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; overflow: hidden; margin: 20px 0;">
        <div style="padding: 12px 16px; background: #14b8a610; border-bottom: 1px solid #1e293b;">
          <strong style="color: #14b8a6; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Waiting Behind the Paywall</strong>
        </div>
        <div style="padding: 16px;">
          <div style="padding: 8px 0; border-bottom: 1px solid #1e293b;">
            <span style="color: #14b8a6; font-size: 13px; font-weight: 600;">Partner Matching</span>
            <span style="color: #64748b; font-size: 12px;"> — 850+ companies scored for your ${modalityLabel}</span>
          </div>
          <div style="padding: 8px 0; border-bottom: 1px solid #1e293b;">
            <span style="color: #14b8a6; font-size: 13px; font-weight: 600;">rNPV + Monte Carlo</span>
            <span style="color: #64748b; font-size: 12px;"> — 10,000 simulations, phase-specific PoS</span>
          </div>
          <div style="padding: 8px 0; border-bottom: 1px solid #1e293b;">
            <span style="color: #14b8a6; font-size: 13px; font-weight: 600;">AI Deal Memo</span>
            <span style="color: #64748b; font-size: 12px;"> — board-ready narrative in 2 seconds</span>
          </div>
          <div style="padding: 8px 0;">
            <span style="color: #14b8a6; font-size: 13px; font-weight: 600;">Buyer-Specific Valuation</span>
            <span style="color: #64748b; font-size: 12px;"> — what AbbVie vs Pfizer would actually pay</span>
          </div>
        </div>
      </div>

      <div style="text-align: center; margin: 28px 0;">
        <a href="${BASE_URL}/pro?utm_source=calc_convert&utm_medium=email" style="display: inline-block; background: linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%); color: #ffffff; padding: 16px 40px; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 16px;">
          Start Free Trial
        </a>
        <p style="color: #14b8a6; font-size: 13px; margin: 10px 0 0; font-weight: 600;">7 days free. Cancel anytime.</p>
      </div>

      <p style="color: #94a3b8; font-size: 14px; line-height: 1.7; margin: 16px 0 0;">
        -- Issa<br>
        <span style="color: #64748b; font-size: 12px;">Founder, Ambrosia Ventures</span>
      </p>
    </div>

    <div style="text-align: center; padding: 24px; color: #475569; font-size: 12px;">
      <p style="margin: 0;">Ambrosia Ventures | <a href="https://ambrosiaventures.co" style="color: #14b8a6; text-decoration: none;">ambrosiaventures.co</a></p>
      <p style="margin: 8px 0 0;"><a href="${BASE_URL}/unsubscribe" style="color: #475569; text-decoration: underline;">Unsubscribe</a></p>
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
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // 1. Find users with 3+ calculation events in the last 24 hours
    //    Group by user_id and count
    const { data: recentCalcEvents } = await supabase
      .from('events')
      .select('user_id, event_data, created_at')
      .eq('event_type', 'calculation_completed')
      .gte('created_at', twentyFourHoursAgo.toISOString())
      .order('created_at', { ascending: false });

    if (!recentCalcEvents || recentCalcEvents.length === 0) {
      return NextResponse.json({
        success: true,
        highIntentUsers: 0,
        emailsSent: 0,
        message: 'No recent calculation events',
      });
    }

    // Group events by user_id
    const userCalcMap = new Map<string, Array<{ event_data: Record<string, unknown>; created_at: string }>>();
    for (const event of recentCalcEvents) {
      if (!event.user_id) continue;
      if (!userCalcMap.has(event.user_id)) {
        userCalcMap.set(event.user_id, []);
      }
      userCalcMap.get(event.user_id)!.push({
        event_data: (event.event_data || {}) as Record<string, unknown>,
        created_at: event.created_at,
      });
    }

    // Filter to users with 2+ calculations (lowered from 3 for broader capture)
    const highIntentUserIds = Array.from(userCalcMap.entries())
      .filter(([, events]) => events.length >= 2)
      .map(([userId]) => userId);

    if (highIntentUserIds.length === 0) {
      return NextResponse.json({
        success: true,
        highIntentUsers: 0,
        emailsSent: 0,
        message: 'No users with 3+ calculations in last 24h',
      });
    }

    // 2. Get user profiles — filter to free tier only
    const { data: freeUsers } = await supabase
      .from('user_profiles')
      .select('id, email, full_name, tier')
      .in('id', highIntentUserIds)
      .eq('tier', 'free');

    if (!freeUsers || freeUsers.length === 0) {
      return NextResponse.json({
        success: true,
        highIntentUsers: highIntentUserIds.length,
        emailsSent: 0,
        message: 'All high-intent users are already Pro',
      });
    }

    // 3. Check which users already received this email
    const freeUserIds = freeUsers.map(u => u.id);
    const { data: priorSends } = await supabase
      .from('events')
      .select('user_id')
      .eq('event_type', 'calc_convert_sent')
      .in('user_id', freeUserIds);

    const alreadySentSet = new Set((priorSends || []).map(e => e.user_id));

    let emailsSent = 0;
    const errors: string[] = [];

    for (const user of freeUsers) {
      if (alreadySentSet.has(user.id)) {
        console.log(`[calculation-convert] Skipping ${user.email} — already sent`);
        continue;
      }

      if (!user.email) continue;

      try {
        // Extract context from their most recent calculation events
        const userEvents = userCalcMap.get(user.id) || [];
        const calcCount = userEvents.length;

        // Pull TA, modality, indication from the most recent event_data
        const latestData = userEvents[0]?.event_data || {};
        const therapeuticArea = (latestData.therapeutic_area as string) || (latestData.therapeuticArea as string) || 'oncology';
        const modality = (latestData.modality as string) || 'small_molecule';
        const indication = (latestData.indication as string) || therapeuticArea;

        // Extract actual deal numbers from event_data if available
        const upfrontLow = latestData.upfront_low as number | undefined;
        const upfrontHigh = latestData.upfront_high as number | undefined;
        const totalLow = latestData.total_low as number | undefined;
        const totalHigh = latestData.total_high as number | undefined;

        const formatM = (v: number) => v >= 1000 ? `$${(v / 1000).toFixed(1)}B` : `$${Math.round(v)}M`;
        const upfrontRange = upfrontLow && upfrontHigh ? `${formatM(upfrontLow)}–${formatM(upfrontHigh)}` : undefined;
        const totalDealRange = totalLow && totalHigh ? `${formatM(totalLow)}–${formatM(totalHigh)}` : undefined;

        const firstName = user.full_name?.split(' ')[0] || '';
        const { subject, html } = buildConversionEmail(
          firstName,
          calcCount,
          therapeuticArea,
          modality,
          indication,
          upfrontRange,
          totalDealRange,
        );

        const result = await sendEmail({ to: user.email, subject, html });

        if (result.success) {
          // Track the send to prevent duplicates
          await supabase.from('events').insert({
            event_type: 'calc_convert_sent',
            event_data: {
              user_email: user.email,
              calc_count: calcCount,
              therapeutic_area: therapeuticArea,
              modality,
              indication,
            },
            user_id: user.id,
            user_tier: 'free',
          }).then(() => {}, () => {});

          emailsSent++;
          console.log(`[calculation-convert] Sent to ${user.email} (${calcCount} calcs, ${therapeuticArea})`);
        } else {
          errors.push(`Email failed for ${user.email}: ${result.error}`);
        }
      } catch (err) {
        errors.push(`Error processing ${user.email}: ${String(err)}`);
      }
    }

    // Log cron run
    await logCronRun(supabase, 'calculation-convert', {
      fetched: highIntentUserIds.length,
      processed: freeUsers.length - alreadySentSet.size,
      inserted: emailsSent,
      errors,
    });

    // Slack notification
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (webhookUrl && emailsSent > 0) {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `Calculation convert: ${emailsSent} high-intent free user${emailsSent !== 1 ? 's' : ''} emailed (3+ calcs in 24h)`,
        }),
      }).then(() => {}, () => {});
    }

    console.log(`[calculation-convert] Done: ${highIntentUserIds.length} high-intent, ${freeUsers.length} free, ${emailsSent} emails sent`);

    // Intelligence tracking
    try {
      await runCronIntelligence(supabase, 'calculation-convert', {
        processed: freeUsers.length,
        inserted: emailsSent,
      });
    } catch {}

    return NextResponse.json({
      success: true,
      highIntentUsers: highIntentUserIds.length,
      freeUsersTargeted: freeUsers.length,
      alreadySent: alreadySentSet.size,
      emailsSent,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    captureApiError(error, 'cron-calculation-convert');
    return NextResponse.json({ error: 'Calculation convert cron failed' }, { status: 500 });
  }
}
