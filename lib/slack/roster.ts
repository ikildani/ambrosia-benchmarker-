/**
 * Daily Slack user roster — free / pro / trial drill-down.
 *
 * Pure helpers (no I/O) so the classification and Slack block layout can be
 * unit tested. The cron in app/api/cron/daily-stats/route.ts fetches the
 * rows, then calls buildRosterMessages().
 *
 * Trial detection mirrors the rest of the codebase:
 *   - Stripe trials: subscription_status = 'trialing' (set by /api/webhook)
 *   - In-app trials: tier = 'pro' with a trial engagement type —
 *     'auto-trial' (migration 098 signup trigger), 'self-serve-trial'
 *     (/api/trial/start), 'email-trial-*' (/api/trial/activate).
 *     These all carry pro_expires_at, which the pro-expiration cron uses to
 *     downgrade the user to free once it passes.
 */

export interface RosterUserRow {
  id: string;
  email: string | null;
  full_name?: string | null;
  tier: string | null;
  subscription_status?: string | null;
  pro_engagement_type?: string | null;
  pro_activated_at?: string | null;
  pro_expires_at?: string | null;
  stripe_subscription_id?: string | null;
  created_at: string;
}

export type RosterGroup = 'pro_paid' | 'pro_trial' | 'report' | 'free' | 'other';

export interface ClassifiedRosterUser {
  row: RosterUserRow;
  group: RosterGroup;
  /** True when the user is on a Pro trial (Stripe or in-app). */
  isTrial: boolean;
  /** 'stripe' | 'auto-trial' | 'self-serve-trial' | 'email-trial-…' | null */
  trialSource: string | null;
  /** When Pro access ends (trial end or time-limited engagement end). */
  expiresAt: Date | null;
  /** Whole days until expiry; negative when already past. Null when no expiry. */
  daysLeft: number | null;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Slack section text hard limit is 3000 chars; leave headroom for the code fence. */
const SLACK_SECTION_CHAR_BUDGET = 2800;

export function isTrialEngagement(engagementType: string | null | undefined): boolean {
  if (!engagementType) return false;
  return engagementType.toLowerCase().includes('trial');
}

export function classifyRosterUser(row: RosterUserRow, now: Date = new Date()): ClassifiedRosterUser {
  const tier = (row.tier || 'free').toLowerCase();
  const expiresAt = row.pro_expires_at ? new Date(row.pro_expires_at) : null;
  const validExpiry = expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt : null;
  // Truncate toward zero from the far side: 0.2d left -> 0 ("today"),
  // 1.5d left -> 1 ("tomorrow"), 0.5d ago -> -1 ("1d ago").
  const msLeft = validExpiry ? validExpiry.getTime() - now.getTime() : null;
  const daysLeft = msLeft === null ? null : msLeft >= 0 ? Math.floor(msLeft / MS_PER_DAY) : -Math.ceil(-msLeft / MS_PER_DAY);

  const stripeTrial = row.subscription_status === 'trialing';
  const inAppTrial = tier === 'pro' && isTrialEngagement(row.pro_engagement_type);
  const isTrial = stripeTrial || inAppTrial;

  let trialSource: string | null = null;
  if (stripeTrial) trialSource = 'stripe';
  else if (inAppTrial) trialSource = row.pro_engagement_type || 'trial';

  let group: RosterGroup;
  if (tier === 'pro') group = isTrial ? 'pro_trial' : 'pro_paid';
  else if (tier === 'report') group = 'report';
  else if (tier === 'free') group = 'free';
  else group = 'other';

  return { row, group, isTrial, trialSource, expiresAt: validExpiry, daysLeft };
}

export interface RosterSummary {
  total: number;
  proTotal: number;
  proPaid: number;
  proTrial: number;
  /** Trials whose pro_expires_at is within the next 3 days (inclusive), or already past. */
  proTrialExpiringSoon: number;
  report: number;
  free: number;
  other: number;
}

export function summarizeRoster(users: ClassifiedRosterUser[]): RosterSummary {
  const summary: RosterSummary = {
    total: users.length,
    proTotal: 0,
    proPaid: 0,
    proTrial: 0,
    proTrialExpiringSoon: 0,
    report: 0,
    free: 0,
    other: 0,
  };
  for (const u of users) {
    switch (u.group) {
      case 'pro_paid':
        summary.proTotal++;
        summary.proPaid++;
        break;
      case 'pro_trial':
        summary.proTotal++;
        summary.proTrial++;
        if (u.daysLeft !== null && u.daysLeft <= 3) summary.proTrialExpiringSoon++;
        break;
      case 'report':
        summary.report++;
        break;
      case 'free':
        summary.free++;
        break;
      default:
        summary.other++;
    }
  }
  return summary;
}

function fmtDate(iso: string | Date | null | undefined): string {
  if (!iso) return 'Never';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return 'Never';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Never';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function formatExpiry(u: ClassifiedRosterUser): string {
  if (!u.expiresAt || u.daysLeft === null) return 'no expiry';
  const when = fmtDate(u.expiresAt);
  if (u.daysLeft < 0) return `EXPIRED ${when} (${Math.abs(u.daysLeft)}d ago, pending downgrade)`;
  if (u.daysLeft === 0) return `expires TODAY (${when})`;
  if (u.daysLeft === 1) return `expires TOMORROW (${when})`;
  return `expires ${when} (${u.daysLeft}d left)`;
}

export interface RosterActivity {
  /** email (lowercased) -> last sign-in ISO */
  lastLoginByEmail: Map<string, string | null>;
  /** user id -> last calculation ISO */
  lastCalcByUserId: Map<string, string>;
}

function activitySuffix(row: RosterUserRow, activity: RosterActivity): string {
  const lastLogin = row.email ? activity.lastLoginByEmail.get(row.email.toLowerCase()) : null;
  const lastCalc = activity.lastCalcByUserId.get(row.id);
  return `Login: ${fmtDateTime(lastLogin)} | Calc: ${fmtDateTime(lastCalc)}`;
}

export function formatRosterLine(u: ClassifiedRosterUser, activity: RosterActivity): string {
  const { row } = u;
  const who = row.email || row.id;
  const joined = `Joined ${fmtDate(row.created_at)}`;

  switch (u.group) {
    case 'pro_trial': {
      const src = u.trialSource === 'stripe' ? 'stripe trial' : (u.trialSource || 'trial');
      return `${who} | TRIAL (${src}) | ${formatExpiry(u)} | ${joined} | ${activitySuffix(row, activity)}`;
    }
    case 'pro_paid': {
      const how = row.stripe_subscription_id
        ? 'stripe'
        : row.pro_engagement_type
          ? row.pro_engagement_type
          : (row.subscription_status || 'manual');
      const end = u.expiresAt ? ` | ${formatExpiry(u)}` : '';
      return `${who} | PAID (${how})${end} | ${joined} | ${activitySuffix(row, activity)}`;
    }
    default: {
      const tier = (row.tier || 'free').toUpperCase();
      const status = row.subscription_status && row.subscription_status !== 'none' ? ` (${row.subscription_status})` : '';
      return `${who} | ${tier}${status} | ${joined} | ${activitySuffix(row, activity)}`;
    }
  }
}

/** Split lines into code-fenced section blocks that stay under Slack's 3000-char section limit. */
export function chunkLinesToSections(lines: string[]): Array<{ type: 'section'; text: { type: 'mrkdwn'; text: string } }> {
  const sections: Array<{ type: 'section'; text: { type: 'mrkdwn'; text: string } }> = [];
  let current: string[] = [];
  let currentLen = 0;

  const flush = () => {
    if (current.length === 0) return;
    sections.push({ type: 'section', text: { type: 'mrkdwn', text: '```\n' + current.join('\n') + '\n```' } });
    current = [];
    currentLen = 0;
  };

  for (const line of lines) {
    // +1 for the newline joiner
    if (currentLen + line.length + 1 > SLACK_SECTION_CHAR_BUDGET && current.length > 0) flush();
    current.push(line);
    currentLen += line.length + 1;
  }
  flush();
  return sections;
}

type SlackBlock = Record<string, unknown>;

/** Sort trials by soonest expiry first, then everything else by newest signup. */
function sortGroup(users: ClassifiedRosterUser[], group: RosterGroup): ClassifiedRosterUser[] {
  const list = users.filter(u => u.group === group);
  if (group === 'pro_trial') {
    return list.sort((a, b) => {
      const ad = a.daysLeft ?? Number.MAX_SAFE_INTEGER;
      const bd = b.daysLeft ?? Number.MAX_SAFE_INTEGER;
      if (ad !== bd) return ad - bd;
      return new Date(b.row.created_at).getTime() - new Date(a.row.created_at).getTime();
    });
  }
  return list.sort((a, b) => new Date(b.row.created_at).getTime() - new Date(a.row.created_at).getTime());
}

const SLACK_MAX_BLOCKS_PER_MESSAGE = 45; // Slack hard limit is 50

export interface RosterSlackMessage {
  text: string;
  attachments: Array<{ color: string; blocks: SlackBlock[] }>;
}

/**
 * Build the roster as one or more Slack webhook payloads. Normally one
 * message; splits into continuation messages only if the block count would
 * exceed Slack's per-message limit.
 */
export function buildRosterMessages(
  rows: RosterUserRow[],
  activity: RosterActivity,
  now: Date = new Date(),
): RosterSlackMessage[] {
  const users = rows.map(r => classifyRosterUser(r, now));
  const s = summarizeRoster(users);

  const trialLines = sortGroup(users, 'pro_trial').map(u => formatRosterLine(u, activity));
  const paidLines = sortGroup(users, 'pro_paid').map(u => formatRosterLine(u, activity));
  const reportLines = sortGroup(users, 'report').map(u => formatRosterLine(u, activity));
  const freeLines = sortGroup(users, 'free').map(u => formatRosterLine(u, activity));
  const otherLines = sortGroup(users, 'other').map(u => formatRosterLine(u, activity));

  const blocks: SlackBlock[] = [
    { type: 'header', text: { type: 'plain_text', text: 'All Users — Daily Roster', emoji: true } },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: [
          `*Total:* ${s.total}`,
          `├ *Pro:* ${s.proTotal}  (paid ${s.proPaid} · trial ${s.proTrial}${s.proTrialExpiringSoon ? ` · ${s.proTrialExpiringSoon} expiring ≤3d` : ''})`,
          `├ *Report:* ${s.report}`,
          `${s.other ? '├' : '└'} *Free:* ${s.free}`,
          ...(s.other ? [`└ *Other tiers:* ${s.other}`] : []),
        ].join('\n'),
      },
    },
  ];

  const addGroup = (title: string, lines: string[]) => {
    blocks.push({ type: 'divider' });
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: `*${title}*` } });
    if (lines.length === 0) {
      blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: '_none_' }] });
      return;
    }
    blocks.push(...chunkLinesToSections(lines));
  };

  addGroup(`Pro — Trial (${s.proTrial})`, trialLines);
  addGroup(`Pro — Paid (${s.proPaid})`, paidLines);
  if (s.report > 0) addGroup(`Report (${s.report})`, reportLines);
  addGroup(`Free (${s.free})`, freeLines);
  if (s.other > 0) addGroup(`Other tiers (${s.other})`, otherLines);

  const text = `Daily User Roster: ${s.total} users — ${s.proPaid} paid pro, ${s.proTrial} on pro trial, ${s.free} free`;

  const messages: RosterSlackMessage[] = [];
  for (let i = 0; i < blocks.length; i += SLACK_MAX_BLOCKS_PER_MESSAGE) {
    const part = blocks.slice(i, i + SLACK_MAX_BLOCKS_PER_MESSAGE);
    const partNo = Math.floor(i / SLACK_MAX_BLOCKS_PER_MESSAGE) + 1;
    messages.push({
      text: partNo === 1 ? text : `${text} (part ${partNo})`,
      attachments: [{ color: '#2563eb', blocks: part }],
    });
  }
  return messages;
}
