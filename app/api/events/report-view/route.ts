import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { report, referrer, ua } = body;

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const geo = request.headers.get('x-vercel-ip-country') || '';
    const city = request.headers.get('x-vercel-ip-city') || '';
    const region = geo && city ? `${decodeURIComponent(city)}, ${geo}` : geo || 'Unknown';

    // Detect bots
    if (ua && /bot|crawl|spider|slurp|feed|prerender|headless/i.test(ua)) {
      return NextResponse.json({ ok: true, tracked: false });
    }

    // Parse source from referrer
    let source = 'Direct';
    if (referrer) {
      try {
        const host = new URL(referrer).hostname.toLowerCase();
        if (host.includes('google')) source = 'Google Search';
        else if (host.includes('linkedin')) source = 'LinkedIn';
        else if (host.includes('twitter') || host.includes('x.com')) source = 'Twitter/X';
        else if (host.includes('mail') || host.includes('outlook') || host.includes('gmail')) source = 'Email';
        else if (host.includes('endpts') || host.includes('statnews') || host.includes('fierce') || host.includes('biopharmadive')) source = `Press: ${host}`;
        else if (host !== 'calculator.ambrosiaventures.co') source = host;
      } catch {
        source = 'Unknown';
      }
    }

    const supabase = createServiceClient();
    const reportKey = report || 'unknown';
    const viewerHash = Buffer.from(`${ip}-${ua?.slice(0, 50) || ''}`).toString('base64').slice(0, 32);

    // Check if this viewer already viewed this report in the last 6 hours
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    const { data: existing } = await supabase
      .from('report_views')
      .select('id, view_count')
      .eq('viewer_hash', viewerHash)
      .eq('report', reportKey)
      .gte('last_viewed_at', sixHoursAgo)
      .maybeSingle();

    if (existing) {
      // Same viewer, same report, within 6 hours — increment count, don't notify
      await supabase
        .from('report_views')
        .update({ view_count: (existing.view_count || 1) + 1, last_viewed_at: new Date().toISOString() })
        .eq('id', existing.id);

      return NextResponse.json({ ok: true, tracked: true, deduplicated: true });
    }

    // Check if this viewer has ANY previous views (returning visitor)
    const { count: previousViews } = await supabase
      .from('report_views')
      .select('*', { count: 'exact', head: true })
      .eq('viewer_hash', viewerHash);

    const isReturning = (previousViews || 0) > 0;

    // Try to identify the viewer
    let viewerIdentity = 'Anonymous';
    let viewerEmail: string | null = null;

    // Check if they're a logged-in user
    const authHeader = request.headers.get('cookie') || '';
    if (authHeader.includes('sb-')) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) {
          viewerEmail = user.email;
          viewerIdentity = user.email;
        }
      } catch {
        // Not logged in — that's fine
      }
    }

    // If anonymous, try to match IP to a known user from sessions table
    if (viewerIdentity === 'Anonymous') {
      const { data: sessionMatch } = await supabase
        .from('sessions')
        .select('user_id')
        .not('user_id', 'is', null)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (sessionMatch?.user_id) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('email, company_name')
          .eq('id', sessionMatch.user_id)
          .maybeSingle();

        if (profile?.email) {
          viewerIdentity = profile.company_name
            ? `${profile.email} (${profile.company_name})`
            : profile.email;
          viewerEmail = profile.email;
        }
      }
    }

    // Log the view
    await supabase.from('report_views').insert({
      report: reportKey,
      viewer_hash: viewerHash,
      viewer_email: viewerEmail,
      viewer_identity: viewerIdentity,
      source,
      referrer: referrer?.slice(0, 500) || null,
      ip_region: region,
      is_returning: isReturning,
      view_count: 1,
      last_viewed_at: new Date().toISOString(),
    });

    // Send Slack notification
    const webhookUrl = process.env.SLACK_DEAL_ALERTS_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) {
      return NextResponse.json({ ok: true, tracked: true });
    }

    const timestamp = new Date().toLocaleString('en-US', {
      timeZone: 'America/New_York',
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    const reportTitle = report === 'q1-2026' ? 'Q1 2026 Biopharma Deal Benchmarks' : report || 'Unknown Report';
    const returningBadge = isReturning ? ' (returning)' : ' (new)';
    const viewerDisplay = viewerIdentity === 'Anonymous'
      ? `Anonymous${returningBadge}`
      : `${viewerIdentity}${returningBadge}`;

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `Report viewed: ${reportTitle} by ${viewerDisplay}`,
        attachments: [{
          color: isReturning ? '#8b5cf6' : '#2563eb',
          blocks: [
            {
              type: 'header',
              text: { type: 'plain_text', text: `📊 Report Viewed: ${reportTitle}`, emoji: true },
            },
            {
              type: 'section',
              fields: [
                { type: 'mrkdwn', text: `*Viewer:*\n${viewerDisplay}` },
                { type: 'mrkdwn', text: `*Source:*\n${source}` },
                { type: 'mrkdwn', text: `*Location:*\n${region}` },
                { type: 'mrkdwn', text: `*Time:*\n${timestamp}` },
              ],
            },
            ...(referrer ? [{
              type: 'context' as const,
              elements: [{ type: 'mrkdwn' as const, text: `Referrer: ${referrer.slice(0, 120)}` }],
            }] : []),
          ],
        }],
      }),
    });

    return NextResponse.json({ ok: true, tracked: true });
  } catch (error) {
    console.error('[Report View] Error:', error);
    return NextResponse.json({ ok: true, tracked: false });
  }
}
