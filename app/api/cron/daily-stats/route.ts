import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { notifyDailyStats } from '@/lib/slack/notify';
import { updateDealCountIfChanged } from '@/lib/seo/deal-count-updater';
import { runCronIntelligence } from '@/lib/cron-intelligence';
import { buildRosterMessages, classifyRosterUser, summarizeRoster } from '@/lib/slack/roster';

export const maxDuration = 30;

export async function GET(request: NextRequest) {
  // Auth
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '') || '';
  const secret = process.env.CRON_SECRET || '';

  if (!token || !secret || token.length !== secret.length) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    if (!crypto.timingSafeEqual(Buffer.from(token), Buffer.from(secret))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createServiceClient();
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();

    // Total users by tier
    const { count: totalUsers } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true });

    const { count: proUsers } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('tier', 'pro');

    const { count: reportUsers } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('tier', 'report');

    const freeUsers = (totalUsers || 0) - (proUsers || 0) - (reportUsers || 0);

    // New signups today
    const { count: newSignupsToday } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startOfDay);

    // New pro subscriptions today
    const { count: newProToday } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('tier', 'pro')
      .gte('updated_at', startOfDay);

    // Report purchases today
    const { count: newReportsToday } = await supabase
      .from('report_purchases')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startOfDay);

    // Calculations today
    const { count: calculationsToday } = await supabase
      .from('calculations')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startOfDay);

    // Newsletter subscribers
    const { count: newsletterSubscribers } = await supabase
      .from('newsletter_subscribers')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    // Auto-update deal count in constants.ts if rounded value changed
    // Query verified deals (excluding 'other' TA, matching /api/deals/stats).
    // R66 (2026-04-14): also exclude is_synthetic=true so the LIVE_DEAL_COUNT
    // doesn't include the 845 fabricated rows flagged by migrations 051 + 053.
    const { count: verifiedDeals } = await supabase
      .from('deals')
      .select('*', { count: 'exact', head: true })
      .eq('is_synthetic', false)
      .not('therapeutic_area', 'eq', 'other')
      .not('therapeutic_area', 'like', '\\__%');

    if (verifiedDeals != null) {
      await updateDealCountIfChanged(verifiedDeals);
    }

    // ── Full user roster with free / pro / trial drill-down ──
    const { data: allUsers } = await supabase
      .from('user_profiles')
      .select('id, email, full_name, tier, subscription_status, pro_engagement_type, pro_activated_at, pro_expires_at, stripe_subscription_id, created_at')
      .order('created_at', { ascending: false });

    const rosterRows = allUsers || [];
    const rosterSummary = summarizeRoster(rosterRows.map(r => classifyRosterUser(r, today)));

    await notifyDailyStats({
      totalUsers: totalUsers || 0,
      freeUsers: Math.max(freeUsers, 0),
      proUsers: proUsers || 0,
      proPaidUsers: rosterSummary.proPaid,
      proTrialUsers: rosterSummary.proTrial,
      proTrialExpiringSoon: rosterSummary.proTrialExpiringSoon,
      reportUsers: reportUsers || 0,
      newSignupsToday: newSignupsToday || 0,
      newProToday: newProToday || 0,
      newReportsToday: newReportsToday || 0,
      calculationsToday: calculationsToday || 0,
      newsletterSubscribers: newsletterSubscribers || 0,
    });

    // Get last login from Supabase Auth
    const { data: authData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const loginMap = new Map<string, string | null>();
    for (const au of authData?.users || []) {
      if (au.email) loginMap.set(au.email.toLowerCase(), au.last_sign_in_at || null);
    }

    // Get last calculation per user
    const { data: lastCalcs } = await supabase
      .from('calculations')
      .select('user_id, created_at')
      .not('user_id', 'is', null)
      .order('created_at', { ascending: false });

    const lastCalcMap = new Map<string, string>();
    if (lastCalcs) {
      for (const calc of lastCalcs) {
        if (calc.user_id && !lastCalcMap.has(calc.user_id)) {
          lastCalcMap.set(calc.user_id, calc.created_at);
        }
      }
    }

    // Send roster to Slack, grouped: Pro trial (with expiry) / Pro paid / Report / Free
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (webhookUrl && rosterRows.length > 0) {
      const messages = buildRosterMessages(
        rosterRows,
        { lastLoginByEmail: loginMap, lastCalcByUserId: lastCalcMap },
        today,
      );
      for (const message of messages) {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(message),
        }).then(() => {}, () => {});
      }
    }

    // Intelligence tracking
    try {
      await runCronIntelligence(supabase, 'daily-stats', {
        processed: 1,
        inserted: 0,
      });
    } catch {}

    return NextResponse.json({
      success: true,
      stats: {
        totalUsers: totalUsers || 0,
        freeUsers: Math.max(freeUsers, 0),
        proUsers: proUsers || 0,
        proPaidUsers: rosterSummary.proPaid,
        proTrialUsers: rosterSummary.proTrial,
        proTrialExpiringSoon: rosterSummary.proTrialExpiringSoon,
        reportUsers: reportUsers || 0,
      },
    });
  } catch (error) {
    console.error('[Daily Stats] Error:', error);
    return NextResponse.json({ error: 'Failed to generate stats' }, { status: 500 });
  }
}
