import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { captureApiError } from '@/lib/sentry-api';
import { runCronIntelligence } from '@/lib/cron-intelligence';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const PERSONAL_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'aol.com',
  'icloud.com', 'protonmail.com', 'me.com', 'live.com', 'msn.com',
  'mail.com', 'zoho.com', 'ymail.com', 'proton.me',
]);

const MAX_ALERTS = 20;

export async function GET(request: NextRequest) {
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
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: users } = await supabase
      .from('user_profiles')
      .select('id, email, tier, company_domain, created_at')
      .not('company_domain', 'is', null);

    if (!users || users.length === 0) {
      return NextResponse.json({ success: true, message: 'No users with company domains', clusters: 0 });
    }

    const domainGroups = new Map<string, typeof users>();
    for (const user of users) {
      const domain = (user.company_domain || '').toLowerCase().trim();
      if (!domain || PERSONAL_DOMAINS.has(domain)) continue;
      if (!domainGroups.has(domain)) domainGroups.set(domain, []);
      domainGroups.get(domain)!.push(user);
    }

    const { data: recentAlerts } = await supabase
      .from('events')
      .select('event_data')
      .eq('event_type', 'domain_cluster_detected')
      .gte('created_at', sevenDaysAgo);

    const recentlyAlertedDomains = new Set(
      (recentAlerts || []).map(e => (e.event_data as { domain?: string })?.domain).filter(Boolean),
    );

    const portfolioOpportunities: { domain: string; users: typeof users }[] = [];
    const teamDetections: { domain: string; users: typeof users }[] = [];

    for (const [domain, domainUsers] of domainGroups) {
      if (recentlyAlertedDomains.has(domain)) continue;

      const freeUsers = domainUsers.filter(u => u.tier === 'free');
      if (freeUsers.length >= 3) {
        portfolioOpportunities.push({ domain, users: domainUsers });
      } else if (domainUsers.length >= 2) {
        teamDetections.push({ domain, users: domainUsers });
      }
    }

    let alertsSent = 0;
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;

    for (const opp of portfolioOpportunities.slice(0, MAX_ALERTS)) {
      const emails = opp.users.map(u => u.email).join(', ');
      const tiers = opp.users.map(u => u.tier);
      const freeCount = tiers.filter(t => t === 'free').length;
      const dates = opp.users.map(u => new Date(u.created_at));
      const earliest = new Date(Math.min(...dates.map(d => d.getTime())));
      const latest = new Date(Math.max(...dates.map(d => d.getTime())));

      await supabase.from('events').insert({
        event_type: 'domain_cluster_detected',
        event_data: {
          domain: opp.domain,
          user_count: opp.users.length,
          free_count: freeCount,
          emails: opp.users.map(u => u.email),
          tiers,
          type: 'portfolio_opportunity',
        },
      });

      if (webhookUrl) {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `Portfolio opportunity: ${opp.domain} (${opp.users.length} users, ${freeCount} free)`,
            attachments: [{
              color: '#14b8a6',
              blocks: [
                { type: 'header', text: { type: 'plain_text', text: `Portfolio License Opportunity: ${opp.domain}`, emoji: true } },
                {
                  type: 'section',
                  fields: [
                    { type: 'mrkdwn', text: `*Domain:*\n${opp.domain}` },
                    { type: 'mrkdwn', text: `*Total Users:*\n${opp.users.length} (${freeCount} free)` },
                    { type: 'mrkdwn', text: `*Emails:*\n${emails}` },
                    { type: 'mrkdwn', text: `*Signup Range:*\n${earliest.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${latest.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` },
                  ],
                },
                {
                  type: 'context',
                  elements: [{ type: 'mrkdwn', text: '3+ free users from same domain — potential $30K+ Portfolio License' }],
                },
              ],
            }],
          }),
        }).then(() => {}, () => {});
      }
      alertsSent++;
    }

    for (const team of teamDetections.slice(0, MAX_ALERTS - alertsSent)) {
      await supabase.from('events').insert({
        event_type: 'domain_cluster_detected',
        event_data: {
          domain: team.domain,
          user_count: team.users.length,
          emails: team.users.map(u => u.email),
          tiers: team.users.map(u => u.tier),
          type: 'team_detection',
        },
      });
    }

    if (webhookUrl && (portfolioOpportunities.length > 0 || teamDetections.length > 0)) {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `Domain clustering: ${portfolioOpportunities.length} portfolio opportunities, ${teamDetections.length} team detections`,
          attachments: [{
            color: '#2563eb',
            blocks: [
              { type: 'header', text: { type: 'plain_text', text: 'Domain Clustering Summary', emoji: true } },
              {
                type: 'section',
                fields: [
                  { type: 'mrkdwn', text: `*Portfolio Opportunities (3+ free):*\n${portfolioOpportunities.length}` },
                  { type: 'mrkdwn', text: `*Team Detections (2+ any):*\n${teamDetections.length}` },
                  { type: 'mrkdwn', text: `*Slack Alerts Sent:*\n${alertsSent}` },
                ],
              },
            ],
          }],
        }),
      }).then(() => {}, () => {});
    }

    // Intelligence tracking
    try {
      await runCronIntelligence(supabase, 'domain-clustering', {
        processed: portfolioOpportunities.length + teamDetections.length,
        inserted: alertsSent,
      });
    } catch {}

    return NextResponse.json({
      success: true,
      portfolioOpportunities: portfolioOpportunities.length,
      teamDetections: teamDetections.length,
      alertsSent,
    });
  } catch (error) {
    captureApiError(error, 'cron-domain-clustering');
    return NextResponse.json({ error: 'Domain clustering cron failed' }, { status: 500 });
  }
}
