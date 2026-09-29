import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';
import { sendEmail } from '@/lib/email/client';
import { logCronRun } from '@/lib/cron-utils';
import { captureApiError } from '@/lib/sentry-api';
import { runCronIntelligence } from '@/lib/cron-intelligence';
import { dripSuppressionFilter } from '@/lib/email/drip-suppression';
import {
  CALCULATION_COLUMNS,
  assetFromCalculation,
  buildCompSetReport,
  buildUserCompSet,
  compSetIsSendable,
  compSetReportUrl,
  fetchVerifiedDealRows,
  newReportToken,
  saveCompSetReport,
  type CalculationRow,
} from '@/lib/onboarding/comp-set-report';
import { buildCompSetEmail, type CompSetCta } from '@/lib/onboarding/comp-set-email';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// "Your comp set" email — every 4 hours (vercel.json "0 */4 * * *")
//
// The automated version of the comparable-deal set sent to prospects by hand.
// For every signed-up user who has benchmarked a program in the last 7 days
// and then stopped iterating for an hour, build the verified comparable deals
// behind their latest calculation, save them as a comp set report
// (/comps/<token>, Deal Intelligence Brief format) and email the link.
//
// Guards:
//   - once per user, ever (event_type = 'comp_set_email_sent')
//   - not while a founder-led personal sequence is running (drip_suppressed_until)
//   - not to paying Pro or Portfolio customers
//   - only when the comp set has at least MIN_COMPS priced comparables
//
// Replaces the 2026 "unlock your full model" email this cron used to send.
// Auth: Bearer $CRON_SECRET. ?dry=1 builds everything and sends nothing.
// ---------------------------------------------------------------------------

const LOOKBACK_DAYS = 7;
/** Wait this long after the user's last calculation, so we email the program they settled on. */
const SETTLE_MINUTES = 60;
/** Per run; keeps the run inside maxDuration. The next run picks up the rest. */
const MAX_SENDS_PER_RUN = 25;

function authorized(request: NextRequest): boolean {
  const token = request.headers.get('authorization')?.replace('Bearer ', '') || '';
  const secret = process.env.CRON_SECRET || '';
  if (!token || !secret || token.length !== secret.length) return false;
  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(secret));
  } catch {
    return false;
  }
}

interface ProfileRow {
  id: string;
  email: string | null;
  full_name: string | null;
  tier: string | null;
  subscription_status: string | null;
  stripe_subscription_id: string | null;
}

function ctaFor(profile: ProfileRow): CompSetCta | null {
  const tier = profile.tier ?? 'free';
  if (tier === 'portfolio') return null;
  if (tier === 'pro') {
    // Paying customers already have everything; a card trial still benefits.
    return profile.subscription_status === 'trialing' ? { kind: 'pro' } : null;
  }
  // Free, starter, report: one card trial per person, as in getTrialEligibility.
  return profile.stripe_subscription_id ? { kind: 'upgrade' } : { kind: 'trial' };
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const dryRun = request.nextUrl.searchParams.get('dry') === '1';

  try {
    const supabase = createServiceClient();
    const now = new Date();
    const since = new Date(now.getTime() - LOOKBACK_DAYS * 86_400_000);
    const settledBefore = now.getTime() - SETTLE_MINUTES * 60_000;

    // 1. Signed-in calculations in the window, newest first.
    const { data: calcs, error: calcErr } = await supabase
      .from('calculations')
      .select(CALCULATION_COLUMNS)
      .not('user_id', 'is', null)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })
      .limit(2000);
    if (calcErr) throw new Error(`calculations query failed: ${calcErr.message}`);

    // Latest calculation per user; skip anyone still iterating.
    const latest = new Map<string, CalculationRow>();
    for (const c of (calcs ?? []) as unknown as CalculationRow[]) {
      if (!latest.has(c.user_id)) latest.set(c.user_id, c);
    }
    const settled = [...latest.values()].filter((c) => new Date(c.created_at).getTime() <= settledBefore);
    if (settled.length === 0) {
      return NextResponse.json({ success: true, candidates: 0, emailsSent: 0, message: 'No settled calculations' });
    }

    // 2. Drop users already sent a comp set.
    const userIds = settled.map((c) => c.user_id);
    const { data: prior } = await supabase
      .from('events')
      .select('user_id')
      .eq('event_type', 'comp_set_email_sent')
      .in('user_id', userIds);
    const alreadySent = new Set((prior ?? []).map((e) => e.user_id));
    const pendingIds = userIds.filter((id) => !alreadySent.has(id));
    if (pendingIds.length === 0) {
      return NextResponse.json({ success: true, candidates: settled.length, emailsSent: 0, message: 'All already sent' });
    }

    // 3. Profiles, minus founder-led sequences.
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, email, full_name, tier, subscription_status, stripe_subscription_id')
      .in('id', pendingIds)
      .or(dripSuppressionFilter(now));
    const profileById = new Map(((profiles ?? []) as ProfileRow[]).map((pr) => [pr.id, pr]));
    if (profileById.size === 0) {
      return NextResponse.json({ success: true, candidates: settled.length, pending: pendingIds.length, emailsSent: 0, message: 'No eligible users' });
    }

    // 4. Verified deals once for the whole run.
    const dealRows = await fetchVerifiedDealRows(supabase);

    let emailsSent = 0;
    let skippedThin = 0;
    const errors: string[] = [];
    const previews: Array<{ email: string; subject: string; comps: number }> = [];

    for (const calc of settled) {
      if (emailsSent >= MAX_SENDS_PER_RUN) break;
      const profile = profileById.get(calc.user_id);
      if (!profile?.email || alreadySent.has(calc.user_id)) continue;
      const cta = ctaFor(profile);
      if (!cta) continue;

      try {
        const asset = assetFromCalculation(calc);
        if (!asset) continue;
        const compSet = buildUserCompSet(dealRows, asset);
        if (!compSetIsSendable(compSet)) {
          skippedThin++;
          continue;
        }

        const token = newReportToken();
        const report = buildCompSetReport({ calc, asset, compSet, preparedFor: profile.full_name, token });
        const reportUrl = compSetReportUrl(token);
        const { subject, html } = buildCompSetEmail({ name: profile.full_name, report, reportUrl, cta });

        if (dryRun) {
          previews.push({ email: profile.email, subject, comps: report.rows.length });
          continue;
        }

        // Save before sending: the email must never point at a missing page.
        await saveCompSetReport(supabase, { token, userId: profile.id, calculationId: calc.id, report });

        const result = await sendEmail({ to: profile.email, subject, html, replyTo: 'ikildani@ambrosiaventures.co' });
        if (!result.success) {
          errors.push(`send failed for ${profile.email}: ${result.error}`);
          continue;
        }
        await supabase.from('events').insert({
          user_id: profile.id,
          event_type: 'comp_set_email_sent',
          event_data: {
            calculation_id: calc.id,
            indication: asset.indication,
            phase: asset.phase,
            comps: report.rows.length,
            same_indication: report.sameIndicationCount,
            report_id: report.reportId,
            report_token_prefix: token.slice(0, 4),
            cta: cta.kind,
          },
          user_tier: profile.tier ?? 'free',
        });
        emailsSent++;
      } catch (err) {
        errors.push(`${profile.email}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (!dryRun) {
      await logCronRun(supabase, 'calculation-convert', {
        fetched: settled.length,
        processed: pendingIds.length,
        inserted: emailsSent,
        skipped: skippedThin,
        errors,
      });

      const webhookUrl = process.env.SLACK_WEBHOOK_URL;
      if (webhookUrl && emailsSent > 0) {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `Comp set emails: ${emailsSent} sent${skippedThin ? `, ${skippedThin} held back (fewer than 5 priced comparables)` : ''}`,
          }),
        }).then(() => {}, () => {});
      }

      try {
        await runCronIntelligence(supabase, 'calculation-convert', { processed: pendingIds.length, inserted: emailsSent });
      } catch { /* tracking only */ }
    }

    return NextResponse.json({
      success: true,
      dryRun,
      candidates: settled.length,
      pending: pendingIds.length,
      emailsSent,
      skippedThin,
      previews: dryRun ? previews : undefined,
      errors: errors.length ? errors : undefined,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    captureApiError(error, 'cron-calculation-convert');
    return NextResponse.json({ error: 'Calculation convert cron failed' }, { status: 500 });
  }
}
