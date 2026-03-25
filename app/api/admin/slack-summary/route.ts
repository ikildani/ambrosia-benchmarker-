import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { verifyAdminAuth } from '@/lib/admin-auth';
import { timingSafeEqual } from 'crypto';

export const dynamic = 'force-dynamic';

/**
 * GET/POST /api/admin/slack-summary
 *
 * Sends a historical summary of all users, subscriptions, and recent activity to Slack.
 * Auth: Bearer $ADMIN_API_KEY or Bearer $CRON_SECRET
 */
export async function GET(request: NextRequest) {
  return handleRequest(request);
}

export async function POST(request: NextRequest) {
  return handleRequest(request);
}

async function handleRequest(request: NextRequest) {
  // Accept either ADMIN_API_KEY or CRON_SECRET
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  let cronAuthed = false;

  if (cronSecret && authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const isValidLength = token.length === cronSecret.length;
    const tokenToCompare = isValidLength ? token : cronSecret;
    cronAuthed = isValidLength && timingSafeEqual(Buffer.from(tokenToCompare), Buffer.from(cronSecret));
  }

  if (!cronAuthed) {
    const authError = await verifyAdminAuth(request);
    if (authError) return authError;
  }

  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    return NextResponse.json({ error: 'SLACK_WEBHOOK_URL not configured' }, { status: 500 });
  }

  const supabase = createServiceClient();

  // Fetch all users
  const { data: users } = await supabase
    .from('user_profiles')
    .select('id, email, full_name, tier, subscription_status, created_at, updated_at')
    .order('created_at', { ascending: false });

  const allUsers = users || [];
  const proUsers = allUsers.filter(u => u.tier === 'pro');
  const reportUsers = allUsers.filter(u => u.tier === 'report');
  const freeUsers = allUsers.filter(u => u.tier === 'free');

  // Fetch recent calculations (last 14 days)
  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentCalcs, count: recentCalcCount } = await supabase
    .from('calculations')
    .select('id, user_id, modality, development_phase, therapeutic_area, created_at', { count: 'exact' })
    .gte('created_at', twoWeeksAgo)
    .order('created_at', { ascending: false });

  // Fetch total calculation count
  const { count: totalCalcCount } = await supabase
    .from('calculations')
    .select('id', { count: 'exact', head: true });

  // Fetch subscription history
  const { data: subHistory } = await supabase
    .from('subscription_history')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  // Fetch last login times from Supabase Auth
  const { data: authData } = await supabase.auth.admin.listUsers({ perPage: 100 });
  const authUsers = authData?.users || [];
  const loginMap = new Map<string, string | null>();
  for (const au of authUsers) {
    if (au.email) loginMap.set(au.email.toLowerCase(), au.last_sign_in_at || null);
  }

  // Build user list with last login
  const userLines = allUsers.slice(0, 30).map(u => {
    const tier = u.tier?.toUpperCase() || 'FREE';
    const joined = new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const lastLogin = loginMap.get(u.email?.toLowerCase());
    const loginStr = lastLogin ? new Date(lastLogin).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Never';
    return `${u.email} | ${u.full_name || 'N/A'} | ${tier} | Joined ${joined} | Last login ${loginStr}`;
  }).join('\n');

  // Build recent calculations summary
  const calcLines = (recentCalcs || []).slice(0, 25).map(c => {
    const userMatch = allUsers.find(u => u.id === c.user_id);
    const who = userMatch?.email || 'Anonymous (not logged in)';
    const date = new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${who} | ${c.modality} | ${c.development_phase} | ${c.therapeutic_area} | ${date}`;
  }).join('\n');

  // Build recent logins summary from auth data
  const recentLoginUsers = authUsers
    .filter(au => au.last_sign_in_at && new Date(au.last_sign_in_at).getTime() > Date.now() - 14 * 24 * 60 * 60 * 1000)
    .sort((a, b) => new Date(b.last_sign_in_at!).getTime() - new Date(a.last_sign_in_at!).getTime());

  const loginLines = recentLoginUsers.map(au => {
    const profile = allUsers.find(u => u.email?.toLowerCase() === au.email?.toLowerCase());
    const tier = profile?.tier?.toUpperCase() || 'FREE';
    const date = new Date(au.last_sign_in_at!).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    return `${au.email} | ${tier} | ${date}`;
  }).join('\n');

  // Send overview message
  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: `Historical Summary: ${allUsers.length} users, ${proUsers.length} Pro`,
      attachments: [{
        color: '#0f172a',
        blocks: [
          { type: 'header', text: { type: 'plain_text', text: 'Deal Calculator — Full Summary' } },
          { type: 'section', fields: [
            { type: 'mrkdwn', text: `*Total Users:*\n${allUsers.length}` },
            { type: 'mrkdwn', text: `*Pro Users:*\n${proUsers.length}` },
            { type: 'mrkdwn', text: `*Report Users:*\n${reportUsers.length}` },
            { type: 'mrkdwn', text: `*Free Users:*\n${freeUsers.length}` },
            { type: 'mrkdwn', text: `*Total Calculations:*\n${totalCalcCount ?? 'N/A'}` },
            { type: 'mrkdwn', text: `*Calculations (14d):*\n${recentCalcCount ?? 0}` },
          ]},
        ],
      }],
    }),
  });

  // Send user list
  if (userLines) {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'All Users',
        attachments: [{
          color: '#14b8a6',
          blocks: [
            { type: 'header', text: { type: 'plain_text', text: 'All Users (most recent first)' } },
            { type: 'section', text: { type: 'mrkdwn', text: '```\n' + userLines + '\n```' } },
          ],
        }],
      }),
    });
  }

  // Send recent calculations
  if (calcLines) {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'Recent Calculations',
        attachments: [{
          color: '#06b6d4',
          blocks: [
            { type: 'header', text: { type: 'plain_text', text: 'Recent Calculations (14 days)' } },
            { type: 'section', text: { type: 'mrkdwn', text: '```\n' + calcLines + '\n```' } },
          ],
        }],
      }),
    });
  }

  // Send recent logins
  if (loginLines) {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'Recent Logins',
        attachments: [{
          color: '#64748b',
          blocks: [
            { type: 'header', text: { type: 'plain_text', text: 'Recent Logins (14 days)' } },
            { type: 'section', text: { type: 'mrkdwn', text: '```\n' + loginLines + '\n```' } },
          ],
        }],
      }),
    });
  }

  return NextResponse.json({
    success: true,
    summary: {
      total_users: allUsers.length,
      pro_users: proUsers.length,
      report_users: reportUsers.length,
      free_users: freeUsers.length,
      total_calculations: totalCalcCount,
      calculations_last_14d: recentCalcCount,
    },
  });
}
