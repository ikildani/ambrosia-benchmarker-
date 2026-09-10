import {
  buildRosterMessages,
  chunkLinesToSections,
  classifyRosterUser,
  formatExpiry,
  summarizeRoster,
  type RosterUserRow,
} from '@/lib/slack/roster';

const NOW = new Date('2026-09-09T12:00:00Z');
const daysFromNow = (d: number) => new Date(NOW.getTime() + d * 24 * 60 * 60 * 1000).toISOString();

function row(overrides: Partial<RosterUserRow> & { id: string }): RosterUserRow {
  return {
    email: `${overrides.id}@example.com`,
    tier: 'free',
    subscription_status: 'none',
    pro_engagement_type: null,
    pro_expires_at: null,
    stripe_subscription_id: null,
    created_at: '2026-08-01T00:00:00Z',
    ...overrides,
  };
}

const emptyActivity = { lastLoginByEmail: new Map<string, string | null>(), lastCalcByUserId: new Map<string, string>() };

describe('classifyRosterUser', () => {
  it('flags the migration-098 auto trial as a pro trial with days left', () => {
    const u = classifyRosterUser(
      row({ id: 'a', tier: 'pro', subscription_status: 'active', pro_engagement_type: 'auto-trial', pro_expires_at: daysFromNow(5) }),
      NOW,
    );
    expect(u.group).toBe('pro_trial');
    expect(u.trialSource).toBe('auto-trial');
    expect(u.daysLeft).toBe(5);
  });

  it('flags self-serve and email trials as trials', () => {
    for (const type of ['self-serve-trial', 'email-trial-may2026']) {
      const u = classifyRosterUser(row({ id: type, tier: 'pro', pro_engagement_type: type, pro_expires_at: daysFromNow(2) }), NOW);
      expect(u.group).toBe('pro_trial');
      expect(u.trialSource).toBe(type);
    }
  });

  it('flags a Stripe trialing subscription as a trial', () => {
    const u = classifyRosterUser(
      row({ id: 's', tier: 'pro', subscription_status: 'trialing', stripe_subscription_id: 'sub_1' }),
      NOW,
    );
    expect(u.group).toBe('pro_trial');
    expect(u.trialSource).toBe('stripe');
    expect(u.expiresAt).toBeNull();
  });

  it('treats a Stripe active subscription as paid pro', () => {
    const u = classifyRosterUser(
      row({ id: 'p', tier: 'pro', subscription_status: 'active', stripe_subscription_id: 'sub_2' }),
      NOW,
    );
    expect(u.group).toBe('pro_paid');
    expect(u.isTrial).toBe(false);
  });

  it('treats an invoice-paid time-limited engagement as paid pro, not a trial', () => {
    const u = classifyRosterUser(
      row({ id: 'e', tier: 'pro', subscription_status: 'active', pro_engagement_type: '3-month', pro_expires_at: daysFromNow(60) }),
      NOW,
    );
    expect(u.group).toBe('pro_paid');
    expect(u.daysLeft).toBe(60);
  });

  it('keeps expired-but-not-yet-downgraded trials in the trial group with negative days', () => {
    const u = classifyRosterUser(row({ id: 'x', tier: 'pro', pro_engagement_type: 'auto-trial', pro_expires_at: daysFromNow(-2) }), NOW);
    expect(u.group).toBe('pro_trial');
    expect(u.daysLeft).toBe(-2);
    expect(formatExpiry(u)).toMatch(/EXPIRED .* pending downgrade/);
    const halfDayAgo = classifyRosterUser(row({ id: 'y', tier: 'pro', pro_engagement_type: 'auto-trial', pro_expires_at: daysFromNow(-0.5) }), NOW);
    expect(halfDayAgo.daysLeft).toBe(-1);
  });

  it('buckets free, report, and unknown tiers', () => {
    expect(classifyRosterUser(row({ id: 'f', tier: 'free' }), NOW).group).toBe('free');
    expect(classifyRosterUser(row({ id: 'n', tier: null }), NOW).group).toBe('free');
    expect(classifyRosterUser(row({ id: 'r', tier: 'report' }), NOW).group).toBe('report');
    expect(classifyRosterUser(row({ id: 'st', tier: 'starter' }), NOW).group).toBe('other');
  });
});

describe('formatExpiry', () => {
  it('uses TODAY / TOMORROW / Nd left wording', () => {
    const today = classifyRosterUser(row({ id: 't0', tier: 'pro', pro_engagement_type: 'auto-trial', pro_expires_at: daysFromNow(0.2) }), NOW);
    const tomorrow = classifyRosterUser(row({ id: 't1', tier: 'pro', pro_engagement_type: 'auto-trial', pro_expires_at: daysFromNow(1) }), NOW);
    const later = classifyRosterUser(row({ id: 't4', tier: 'pro', pro_engagement_type: 'auto-trial', pro_expires_at: daysFromNow(4) }), NOW);
    expect(formatExpiry(today)).toMatch(/^expires TODAY/);
    expect(formatExpiry(tomorrow)).toMatch(/^expires TOMORROW/);
    expect(formatExpiry(later)).toMatch(/\(4d left\)$/);
  });
});

describe('summarizeRoster', () => {
  it('counts paid vs trial pro and trials expiring within 3 days', () => {
    const users = [
      row({ id: '1', tier: 'pro', stripe_subscription_id: 'sub', subscription_status: 'active' }),
      row({ id: '2', tier: 'pro', pro_engagement_type: 'auto-trial', pro_expires_at: daysFromNow(1) }),
      row({ id: '3', tier: 'pro', pro_engagement_type: 'auto-trial', pro_expires_at: daysFromNow(6) }),
      row({ id: '4', tier: 'pro', subscription_status: 'trialing' }),
      row({ id: '5', tier: 'free' }),
      row({ id: '6', tier: 'report' }),
    ].map(r => classifyRosterUser(r, NOW));

    expect(summarizeRoster(users)).toEqual({
      total: 6,
      proTotal: 4,
      proPaid: 1,
      proTrial: 3,
      proTrialExpiringSoon: 1,
      report: 1,
      free: 1,
      other: 0,
    });
  });
});

describe('chunkLinesToSections', () => {
  it('keeps every section under the Slack 3000-char limit', () => {
    const lines = Array.from({ length: 200 }, (_, i) => `user${i}@example.com | FREE | Joined Aug 1 | Login: Never | Calc: Never`);
    const sections = chunkLinesToSections(lines);
    expect(sections.length).toBeGreaterThan(1);
    for (const s of sections) expect(s.text.text.length).toBeLessThanOrEqual(3000);
    const rejoined = sections.map(s => s.text.text.replace(/^```\n|\n```$/g, '')).join('\n').split('\n');
    expect(rejoined).toEqual(lines);
  });
});

describe('buildRosterMessages', () => {
  it('groups users into trial / paid / free sections with counts and expiry', () => {
    const rows = [
      row({ id: 'paid', tier: 'pro', stripe_subscription_id: 'sub', subscription_status: 'active' }),
      row({ id: 'trial-soon', tier: 'pro', pro_engagement_type: 'auto-trial', pro_expires_at: daysFromNow(1), created_at: '2026-09-02T00:00:00Z' }),
      row({ id: 'trial-later', tier: 'pro', pro_engagement_type: 'self-serve-trial', pro_expires_at: daysFromNow(6), created_at: '2026-09-07T00:00:00Z' }),
      row({ id: 'free', tier: 'free', subscription_status: 'expired' }),
    ];
    const activity = {
      lastLoginByEmail: new Map([['paid@example.com', '2026-09-08T10:00:00Z']]),
      lastCalcByUserId: new Map([['paid', '2026-09-08T11:00:00Z']]),
    };

    const messages = buildRosterMessages(rows, activity, NOW);
    expect(messages).toHaveLength(1);
    const { text, attachments } = messages[0];
    expect(text).toBe('Daily User Roster: 4 users — 1 paid pro, 2 on pro trial, 1 free');

    const flat = JSON.stringify(attachments[0].blocks);
    expect(flat).toContain('*Pro — Trial (2)*');
    expect(flat).toContain('*Pro — Paid (1)*');
    expect(flat).toContain('*Free (1)*');
    expect(flat).not.toContain('Report (');
    expect(flat).toContain('*Pro:* 3  (paid 1 · trial 2 · 1 expiring ≤3d)');
    expect(flat).toContain('trial-soon@example.com | TRIAL (auto-trial) | expires TOMORROW');
    expect(flat).toContain('trial-later@example.com | TRIAL (self-serve-trial) | expires');
    expect(flat).toContain('paid@example.com | PAID (stripe) | Joined');
    expect(flat).toContain('free@example.com | FREE (expired)');

    // Soonest-expiring trial is listed first
    const trialSection = attachments[0].blocks.find(b => JSON.stringify(b).includes('trial-soon@example.com')) as { text: { text: string } };
    expect(trialSection.text.text.indexOf('trial-soon@')).toBeLessThan(trialSection.text.text.indexOf('trial-later@'));
  });

  it('splits into continuation messages when blocks exceed the Slack limit', () => {
    // ~110 chars/line → ~25 lines/section → 2000 free users ≈ 80 sections
    const rows = Array.from({ length: 2000 }, (_, i) => row({ id: `u${i}`, tier: 'free' }));
    const messages = buildRosterMessages(rows, emptyActivity, NOW);
    expect(messages.length).toBeGreaterThan(1);
    for (const m of messages) expect(m.attachments[0].blocks.length).toBeLessThanOrEqual(50);
    expect(messages[1].text).toMatch(/\(part 2\)$/);
  });
});
