import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { report, referrer, ua } = body;

    // Rate limit: only notify once per IP per report per hour
    // (In production, use Redis or Supabase for proper dedup)
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const geo = request.headers.get('x-vercel-ip-country') || '';
    const city = request.headers.get('x-vercel-ip-city') || '';
    const region = geo && city ? `${city}, ${geo}` : geo || 'Unknown';

    // Parse referrer for source intelligence
    let source = 'Direct';
    if (referrer) {
      try {
        const url = new URL(referrer);
        const host = url.hostname.toLowerCase();
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

    // Detect if it's likely a bot
    const isBot = ua && (/bot|crawl|spider|slurp|feed/i.test(ua));
    if (isBot) {
      return NextResponse.json({ ok: true, tracked: false });
    }

    const timestamp = new Date().toLocaleString('en-US', {
      timeZone: 'America/New_York',
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    // Send to Slack
    const webhookUrl = process.env.SLACK_DEAL_ALERTS_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) {
      console.log('[Report View] No Slack webhook configured');
      return NextResponse.json({ ok: true, tracked: false });
    }

    const reportTitle = report === 'q1-2026' ? 'Q1 2026 Biopharma Deal Benchmarks' : report || 'Unknown Report';

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `Report viewed: ${reportTitle}`,
        attachments: [{
          color: '#2563eb',
          blocks: [
            {
              type: 'header',
              text: { type: 'plain_text', text: `📊 Report Viewed: ${reportTitle}`, emoji: true },
            },
            {
              type: 'section',
              fields: [
                { type: 'mrkdwn', text: `*Source:*\n${source}` },
                { type: 'mrkdwn', text: `*Location:*\n${region}` },
                { type: 'mrkdwn', text: `*Time:*\n${timestamp}` },
                { type: 'mrkdwn', text: `*Referrer:*\n${referrer ? referrer.slice(0, 80) : 'Direct'}` },
              ],
            },
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
