interface DealAlertPayload {
  alertName: string;
  deals: Array<{
    parties: string;
    therapeuticArea: string;
    totalValue: string;
    phase?: string;
    date: string;
  }>;
}

export async function notifyDealAlert(webhookUrl: string, payload: DealAlertPayload): Promise<void> {
  if (!webhookUrl) return;

  const dealBlocks = payload.deals.slice(0, 5).map(deal => ({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `*${deal.parties}*\n${deal.therapeuticArea} · ${deal.totalValue}${deal.phase ? ` · ${deal.phase}` : ''} · ${deal.date}`,
    },
  }));

  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `Deal Alert: ${payload.alertName}` },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${payload.deals.length} new deal${payload.deals.length > 1 ? 's' : ''} matched your alert criteria.`,
      },
    },
    { type: 'divider' },
    ...dealBlocks,
    {
      type: 'context',
      elements: [
        { type: 'mrkdwn', text: 'Powered by Ambrosia Ventures · <https://solidus.ambrosiaventures.co|Open Calculator>' },
      ],
    },
  ];

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocks }),
    });

    if (!response.ok) {
      console.error('[Portfolio Slack] Webhook failed:', response.status);
    }
  } catch (error) {
    console.error('[Portfolio Slack] Webhook error:', error);
  }
}

export async function notifyTeamActivity(
  webhookUrl: string,
  activity: { user: string; action: string; detail: string }
): Promise<void> {
  if (!webhookUrl) return;

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `*${activity.user}* ${activity.action}: ${activity.detail}`,
      }),
    });
  } catch {
    console.error('[Portfolio Slack] Activity notification failed');
  }
}
