import { NextRequest } from 'next/server';
import { requireTeamAdmin } from '@/lib/portfolio/auth';
import { notifyTeamActivity } from '@/lib/slack/portfolio-notify';
import { apiSuccess, apiError } from '@/lib/api-response';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireTeamAdmin(request);
    if ('error' in auth) return auth.error;

    const { user, team } = auth;
    const webhookUrl = team.slack_webhook_url;

    if (!webhookUrl) {
      return apiError('No webhook URL configured. Add one in Settings first.', 400);
    }

    await notifyTeamActivity(webhookUrl, {
      user: user.email || 'Admin',
      action: 'sent a test notification',
      detail: 'If you see this message, your webhook is configured correctly.',
    });

    return apiSuccess({ sent: true });
  } catch (error) {
    console.error('Test webhook error:', error);
    return apiError('Failed to send test webhook', 500);
  }
}
