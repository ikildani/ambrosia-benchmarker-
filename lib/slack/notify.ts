// Slack webhook notifications for admin alerts
// Uses native fetch — no npm dependencies required

interface SlackAttachment {
  color: string;
  blocks: object[];
}

async function postToSlack(attachments: SlackAttachment[], text: string): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    console.log('[Slack] SLACK_WEBHOOK_URL not configured, skipping notification');
    return;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, attachments }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error('[Slack] Webhook failed:', response.status, body);
    }
  } catch (error) {
    console.error('[Slack] Webhook error:', error);
  }
}

function formatTimestamp(): string {
  return new Date().toLocaleString('en-US', {
    timeZone: 'America/New_York',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function formatAmount(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export async function notifyNewSignup(user: {
  email: string;
  name?: string;
  company?: string;
}): Promise<void> {
  const fields = [
    { type: 'mrkdwn', text: `*Email:*\n${user.email}` },
  ];
  if (user.name) fields.push({ type: 'mrkdwn', text: `*Name:*\n${user.name}` });
  if (user.company) fields.push({ type: 'mrkdwn', text: `*Company:*\n${user.company}` });
  fields.push({ type: 'mrkdwn', text: `*Time:*\n${formatTimestamp()}` });

  await postToSlack(
    [{
      color: '#14b8a6',
      blocks: [
        { type: 'header', text: { type: 'plain_text', text: 'New Signup on Deal Calculator', emoji: true } },
        { type: 'section', fields },
      ],
    }],
    `New signup: ${user.name || user.email}`,
  );
}

export async function notifyProSubscription(details: {
  email: string;
  name?: string;
  amount?: number;
  promoCode?: string;
}): Promise<void> {
  const fields = [
    { type: 'mrkdwn', text: `*Email:*\n${details.email}` },
  ];
  if (details.name) fields.push({ type: 'mrkdwn', text: `*Name:*\n${details.name}` });
  if (details.amount) fields.push({ type: 'mrkdwn', text: `*Amount:*\n${formatAmount(details.amount)}` });
  if (details.promoCode) fields.push({ type: 'mrkdwn', text: `*Promo:*\n${details.promoCode}` });
  fields.push({ type: 'mrkdwn', text: `*Time:*\n${formatTimestamp()}` });

  await postToSlack(
    [{
      color: '#14b8a6',
      blocks: [
        { type: 'header', text: { type: 'plain_text', text: 'New Pro Subscription', emoji: true } },
        { type: 'section', fields },
      ],
    }],
    `New Pro subscription: ${details.name || details.email}`,
  );
}

export async function notifyTrialStarted(details: {
  email: string;
  promoCode?: string;
}): Promise<void> {
  const fields = [
    { type: 'mrkdwn', text: `*Email:*\n${details.email}` },
  ];
  if (details.promoCode) fields.push({ type: 'mrkdwn', text: `*Promo:*\n${details.promoCode}` });
  fields.push({ type: 'mrkdwn', text: `*Time:*\n${formatTimestamp()}` });

  await postToSlack(
    [{
      color: '#f59e0b',
      blocks: [
        { type: 'header', text: { type: 'plain_text', text: 'Trial Started (AMBROSIA)', emoji: true } },
        { type: 'section', fields },
      ],
    }],
    `Trial started: ${details.email}`,
  );
}

export async function notifyReportPurchase(details: {
  email: string;
  amount?: number;
}): Promise<void> {
  const fields = [
    { type: 'mrkdwn', text: `*Email:*\n${details.email}` },
  ];
  if (details.amount) fields.push({ type: 'mrkdwn', text: `*Amount:*\n${formatAmount(details.amount)}` });
  fields.push({ type: 'mrkdwn', text: `*Time:*\n${formatTimestamp()}` });

  await postToSlack(
    [{
      color: '#8b5cf6',
      blocks: [
        { type: 'header', text: { type: 'plain_text', text: 'Deal Report Purchased', emoji: true } },
        { type: 'section', fields },
      ],
    }],
    `Report purchased: ${details.email}`,
  );
}

function formatDollars(amount: number | null): string {
  if (amount == null) return 'N/A';
  if (amount >= 1e9) return `$${(amount / 1e9).toFixed(1)}B`;
  if (amount >= 1e6) return `$${(amount / 1e6).toFixed(0)}M`;
  if (amount >= 1e3) return `$${(amount / 1e3).toFixed(0)}K`;
  return `$${amount.toFixed(0)}`;
}

function formatLabel(value: string): string {
  return value
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export async function notifyCalculation(details: {
  email?: string;
  name?: string;
  tier: string;
  therapeuticArea: string;
  modality: string;
  phase: string;
  indication?: string;
  dealType?: string;
  upfrontLow?: number | null;
  upfrontMid?: number | null;
  upfrontHigh?: number | null;
  totalDealValueLow?: number | null;
  totalDealValueHigh?: number | null;
}): Promise<void> {
  const user = details.email || 'Anonymous';
  const tierBadge = details.tier === 'pro' ? 'PRO' : details.tier === 'report' ? 'REPORT' : 'FREE';

  const fields = [
    { type: 'mrkdwn', text: `*User:*\n${details.name || user} (${tierBadge})` },
    { type: 'mrkdwn', text: `*Modality:*\n${formatLabel(details.modality)}` },
    { type: 'mrkdwn', text: `*Phase:*\n${formatLabel(details.phase)}` },
    { type: 'mrkdwn', text: `*Therapeutic Area:*\n${formatLabel(details.therapeuticArea)}` },
  ];
  if (details.indication) fields.push({ type: 'mrkdwn', text: `*Indication:*\n${formatLabel(details.indication)}` });
  if (details.dealType) fields.push({ type: 'mrkdwn', text: `*Deal Type:*\n${formatLabel(details.dealType)}` });
  if (details.upfrontMid != null) {
    fields.push({ type: 'mrkdwn', text: `*Upfront:*\n${formatDollars(details.upfrontMid)} (${formatDollars(details.upfrontLow ?? null)}–${formatDollars(details.upfrontHigh ?? null)})` });
  }
  if (details.totalDealValueLow != null || details.totalDealValueHigh != null) {
    fields.push({ type: 'mrkdwn', text: `*Total Deal Value:*\n${formatDollars(details.totalDealValueLow ?? null)}–${formatDollars(details.totalDealValueHigh ?? null)}` });
  }
  fields.push({ type: 'mrkdwn', text: `*Time:*\n${formatTimestamp()}` });

  await postToSlack(
    [{
      color: '#06b6d4',
      blocks: [
        { type: 'header', text: { type: 'plain_text', text: 'New Calculation', emoji: true } },
        { type: 'section', fields },
      ],
    }],
    `Calculation: ${formatLabel(details.modality)} ${formatLabel(details.phase)} by ${user}`,
  );
}

export async function notifyLogin(user: {
  email: string;
  name?: string;
  tier?: string;
  method?: string;
}): Promise<void> {
  const fields = [
    { type: 'mrkdwn', text: `*Email:*\n${user.email}` },
  ];
  if (user.name) fields.push({ type: 'mrkdwn', text: `*Name:*\n${user.name}` });
  if (user.tier) fields.push({ type: 'mrkdwn', text: `*Tier:*\n${user.tier.toUpperCase()}` });
  if (user.method) fields.push({ type: 'mrkdwn', text: `*Method:*\n${user.method}` });
  fields.push({ type: 'mrkdwn', text: `*Time:*\n${formatTimestamp()}` });

  await postToSlack(
    [{
      color: '#64748b',
      blocks: [
        { type: 'header', text: { type: 'plain_text', text: 'User Login', emoji: true } },
        { type: 'section', fields },
      ],
    }],
    `Login: ${user.name || user.email}`,
  );
}
