import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, company, modality, indication, phase, referrer, ua } = body;

    // Filter bots
    if (ua && /bot|crawl|spider|slurp|feed|prerender|headless/i.test(ua)) {
      return NextResponse.json({ ok: true, tracked: false });
    }

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const geo = request.headers.get('x-vercel-ip-country') || '';
    const city = request.headers.get('x-vercel-ip-city') || '';
    const region = geo && city ? `${decodeURIComponent(city)}, ${geo}` : geo || 'Unknown';

    // Parse source
    let source = 'Direct';
    if (referrer) {
      try {
        const host = new URL(referrer).hostname.toLowerCase();
        if (host.includes('google')) source = 'Google Search';
        else if (host.includes('linkedin')) source = 'LinkedIn';
        else if (host.includes('twitter') || host.includes('x.com')) source = 'Twitter/X';
        else if (host.includes('mail') || host.includes('outlook') || host.includes('gmail')) source = 'Email';
        else if (host !== 'calculator.ambrosiaventures.co') source = host;
      } catch { source = 'Unknown'; }
    }

    const timestamp = new Date().toLocaleString('en-US', {
      timeZone: 'America/New_York',
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    const shareUrl = `https://calculator.ambrosiaventures.co/share/${token}`;
    const assetDesc = [modality, indication, phase].filter(Boolean).join(' · ');
    const companyStr = company || 'Unknown company';

    // Track view in database — AWAIT the insert so count is accurate
    const supabase = createServiceClient();
    await supabase.from('events').insert({
      event_type: 'share_view',
      event_data: {
        token,
        company: companyStr,
        modality,
        indication,
        phase,
        source,
        region,
        ip: ip.slice(0, 6) + '***', // Partially anonymize
        referrer: referrer?.slice(0, 200),
      },
    });

    // Count total views for this token (after insert, so this view is included)
    let totalViews = 1;
    try {
      const { count } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', 'share_view')
        .filter('event_data->>token', 'eq', token);
      totalViews = count || 1;
    } catch {
      totalViews = 1;
    }

    // Send Slack notification with accurate view count
    const webhookUrl = process.env.SLACK_DEAL_ALERTS_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL;
    if (webhookUrl) {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `Shared link viewed: ${companyStr} (view #${totalViews})`,
          attachments: [{
            color: '#0ea5a5',
            blocks: [
              {
                type: 'header',
                text: { type: 'plain_text', text: `🔗 Shared Link Viewed`, emoji: true },
              },
              {
                type: 'section',
                fields: [
                  { type: 'mrkdwn', text: `*Company:*\n${companyStr}` },
                  { type: 'mrkdwn', text: `*Asset:*\n${assetDesc || 'N/A'}` },
                  { type: 'mrkdwn', text: `*Source:*\n${source}` },
                  { type: 'mrkdwn', text: `*View #:*\n${totalViews}` },
                ],
              },
              {
                type: 'section',
                fields: [
                  { type: 'mrkdwn', text: `*Location:*\n${region}` },
                  { type: 'mrkdwn', text: `*Link:*\n<${shareUrl}|View>` },
                ],
              },
              {
                type: 'context',
                elements: [
                  { type: 'mrkdwn', text: `${timestamp}${referrer ? ` | Referrer: ${referrer.slice(0, 80)}` : ''}` },
                ],
              },
            ],
          }],
        }),
      }).catch(() => {});
    }

    return NextResponse.json({ ok: true, tracked: true, viewCount: totalViews });
  } catch (error) {
    console.error('[Share View] Error:', error);
    return NextResponse.json({ ok: true, tracked: false });
  }
}
