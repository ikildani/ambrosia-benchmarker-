import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';
import { runCronIntelligence } from '@/lib/cron-intelligence';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: 'CRON_SECRET not set' }, { status: 500 });

  const expectedToken = `Bearer ${cronSecret}`;
  const providedToken = authHeader || '';
  const isValidLength = providedToken.length === expectedToken.length;
  const tokenToCompare = isValidLength ? providedToken : expectedToken;
  const isValid = isValidLength && timingSafeEqual(Buffer.from(tokenToCompare), Buffer.from(expectedToken));
  if (!isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceClient();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  try {
    // 1. Get recent signups
    const { data: recentUsers } = await supabase
      .from('user_profiles')
      .select('id, email, tier, attribution_source, created_at')
      .gte('created_at', sevenDaysAgo)
      .order('created_at', { ascending: false });

    if (!recentUsers?.length) {
      return NextResponse.json({ success: true, message: 'No recent signups', attributed: 0 });
    }

    // 2. Get Apollo enrolled contacts (from events or data_ingestion_log)
    const { data: apolloEnrollments } = await supabase
      .from('data_ingestion_log')
      .select('details')
      .eq('source', 'apollo_auto_enroll')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    // Build set of Apollo-enrolled email domains
    const apolloDomains = new Set<string>();
    const apolloEmails = new Set<string>();
    for (const log of apolloEnrollments || []) {
      const details = log.details as Record<string, unknown>;
      const enrolled = (details?.enrolled_contacts || details?.contacts || []) as Array<{ email?: string }>;
      for (const contact of enrolled) {
        if (contact.email) {
          apolloEmails.add(contact.email.toLowerCase());
          const domain = contact.email.split('@')[1]?.toLowerCase();
          if (domain) apolloDomains.add(domain);
        }
      }
    }

    // 3. Cross-reference signups with Apollo contacts
    let attributed = 0;
    let proFromOutbound = 0;

    for (const user of recentUsers) {
      if (user.attribution_source) continue; // Already attributed
      if (!user.email) continue;

      const emailLower = user.email.toLowerCase();
      const domain = emailLower.split('@')[1];

      // Check exact email match first, then domain match
      const isApolloContact = apolloEmails.has(emailLower) || (domain && apolloDomains.has(domain));

      if (isApolloContact) {
        await supabase
          .from('user_profiles')
          .update({ attribution_source: 'outbound_apollo', attribution_campaign: 'apollo_auto_enroll' })
          .eq('id', user.id);

        attributed++;
        if (user.tier === 'pro') proFromOutbound++;
      }
    }

    // 4. Also backfill from sessions with utm_source
    const { data: unattributed } = await supabase
      .from('user_profiles')
      .select('id, email')
      .is('attribution_source', null)
      .not('email', 'is', null);

    let utmBackfilled = 0;
    for (const user of (unattributed || []).slice(0, 50)) {
      const { data: session } = await supabase
        .from('sessions')
        .select('utm_source, utm_campaign')
        .eq('user_id', user.id)
        .not('utm_source', 'is', null)
        .order('created_at', { ascending: true })
        .limit(1)
        .single();

      if (session?.utm_source) {
        await supabase
          .from('user_profiles')
          .update({
            attribution_source: session.utm_source,
            attribution_campaign: session.utm_campaign || null,
          })
          .eq('id', user.id);
        utmBackfilled++;
      }
    }

    // 5. Compute summary stats
    const totalSignups = recentUsers.length;
    const proSignups = recentUsers.filter(u => u.tier === 'pro').length;
    const alreadyAttributed = recentUsers.filter(u => u.attribution_source).length;

    // 5b. Per-campaign breakdown (re-fetch to include newly attributed)
    const { data: attributedUsers } = await supabase
      .from('user_profiles')
      .select('tier, attribution_campaign')
      .gte('created_at', sevenDaysAgo)
      .not('attribution_campaign', 'is', null);

    const campaignBreakdown = new Map<string, Record<string, number>>();
    for (const u of attributedUsers || []) {
      const campaign = u.attribution_campaign as string;
      const tier = u.tier || 'free';
      if (!campaignBreakdown.has(campaign)) campaignBreakdown.set(campaign, {});
      const counts = campaignBreakdown.get(campaign)!;
      counts[tier] = (counts[tier] || 0) + 1;
    }

    const campaignLines: string[] = [];
    for (const [campaign, tiers] of [...campaignBreakdown.entries()].sort((a, b) => {
      const totalA = Object.values(a[1]).reduce((s, n) => s + n, 0);
      const totalB = Object.values(b[1]).reduce((s, n) => s + n, 0);
      return totalB - totalA;
    })) {
      const total = Object.values(tiers).reduce((s, n) => s + n, 0);
      const parts = Object.entries(tiers)
        .sort((a, b) => b[1] - a[1])
        .map(([t, n]) => `${n} ${t}`)
        .join(', ');
      campaignLines.push(`• *${campaign}*: ${total} signup${total !== 1 ? 's' : ''} (${parts})`);
    }

    // 6. Slack digest
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (webhookUrl) {
      const blocks: Array<Record<string, unknown>> = [
        { type: 'header', text: { type: 'plain_text', text: 'Weekly Outbound Attribution' } },
        { type: 'section', text: { type: 'mrkdwn', text: [
          `*Signups (7d):* ${totalSignups}`,
          `*Pro conversions:* ${proSignups}`,
          `*Apollo-attributed:* ${attributed} (${proFromOutbound} Pro)`,
          `*UTM backfilled:* ${utmBackfilled}`,
          `*Already attributed:* ${alreadyAttributed}`,
          `*Apollo domains tracked:* ${apolloDomains.size}`,
        ].join('\n') } },
      ];

      if (campaignLines.length > 0) {
        blocks.push(
          { type: 'divider' },
          { type: 'section', text: { type: 'mrkdwn', text: `*Attribution by Campaign (7d):*\n${campaignLines.join('\n')}` } },
        );
      }

      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: ':dart: Outbound Attribution Report',
          attachments: [{ color: '#14b8a6', blocks }],
        }),
      }).catch(() => {});
    }

    // Intelligence tracking
    try {
      await runCronIntelligence(supabase, 'outbound-attribution', {
        processed: totalSignups,
        inserted: attributed,
      });
    } catch {}

    return NextResponse.json({
      success: true,
      totalSignups,
      proSignups,
      apolloAttributed: attributed,
      proFromOutbound,
      utmBackfilled,
      apolloDomainsTracked: apolloDomains.size,
    });
  } catch (error) {
    console.error('Outbound attribution error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
