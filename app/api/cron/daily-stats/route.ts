import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { notifyDailyStats } from '@/lib/slack/notify';
import { updateDealCountIfChanged } from '@/lib/seo/deal-count-updater';
import { runCronIntelligence } from '@/lib/cron-intelligence';

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
      .not('therapeutic_area', 'like', '_%');

    if (verifiedDeals) {
      await updateDealCountIfChanged(verifiedDeals);
    }

    await notifyDailyStats({
      totalUsers: totalUsers || 0,
      freeUsers: Math.max(freeUsers, 0),
      proUsers: proUsers || 0,
      reportUsers: reportUsers || 0,
      newSignupsToday: newSignupsToday || 0,
      newProToday: newProToday || 0,
      newReportsToday: newReportsToday || 0,
      calculationsToday: calculationsToday || 0,
      newsletterSubscribers: newsletterSubscribers || 0,
    });

    // ── Full user roster with last activity ──
    const { data: allUsers } = await supabase
      .from('user_profiles')
      .select('id, email, full_name, tier, created_at, updated_at')
      .order('created_at', { ascending: false });

    // Get last login from Supabase Auth
    const { data: authData } = await supabase.auth.admin.listUsers({ perPage: 100 });
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

    // Send full user roster to Slack
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (webhookUrl && allUsers && allUsers.length > 0) {
      const userLines = allUsers.map(u => {
        const tier = (u.tier || 'free').toUpperCase();
        const joined = new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const lastLogin = loginMap.get(u.email?.toLowerCase());
        const loginStr = lastLogin ? new Date(lastLogin).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Never';
        const lastCalc = lastCalcMap.get(u.id);
        const calcStr = lastCalc ? new Date(lastCalc).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Never';
        return `${u.email} | ${tier} | Joined ${joined} | Login: ${loginStr} | Calc: ${calcStr}`;
      }).join('\n');

      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: 'Daily User Roster',
          attachments: [{
            color: '#2563eb',
            blocks: [
              { type: 'header', text: { type: 'plain_text', text: 'All Users — Daily Roster' } },
              { type: 'section', text: { type: 'mrkdwn', text: '```\n' + userLines + '\n```' } },
            ],
          }],
        }),
      }).then(() => {}, () => {});
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
        reportUsers: reportUsers || 0,
      },
    });
  } catch (error) {
    console.error('[Daily Stats] Error:', error);
    return NextResponse.json({ error: 'Failed to generate stats' }, { status: 500 });
  }
}
