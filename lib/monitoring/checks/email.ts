/**
 * Email sender health (SendGrid): the welcome, receipt and admin emails, and
 * Supabase's auth emails when its custom SMTP points at SendGrid.
 *
 * Reads the last two days of global stats; sends nothing.
 */

import { type MonitorCheck, ok, warn, fail } from '../types';

/** Ignore rates until there is enough volume to mean something. */
export const MIN_REQUESTS = 10;
export const BAD_RATE_WARN = 0.1;
export const BAD_RATE_FAIL = 0.3;

interface SgMetrics {
  requests?: number;
  delivered?: number;
  bounces?: number;
  blocks?: number;
  spam_reports?: number;
  invalid_emails?: number;
  bounce_drops?: number;
  spam_report_drops?: number;
}

export function summarizeStats(days: Array<{ stats?: Array<{ metrics?: SgMetrics }> }>) {
  const t = { requests: 0, delivered: 0, bad: 0, spam: 0 };
  for (const d of days) {
    for (const s of d.stats ?? []) {
      const m = s.metrics ?? {};
      t.requests += m.requests ?? 0;
      t.delivered += m.delivered ?? 0;
      t.bad += (m.bounces ?? 0) + (m.blocks ?? 0) + (m.invalid_emails ?? 0) + (m.bounce_drops ?? 0);
      t.spam += (m.spam_reports ?? 0) + (m.spam_report_drops ?? 0);
    }
  }
  return t;
}

export const emailSenderCheck: MonitorCheck = {
  id: 'email_sender',
  label: 'Email sender (SendGrid)',
  cadence: 'hourly',
  async run(ctx) {
    const key = ctx.env.SENDGRID_API_KEY;
    if (!key) return fail('SENDGRID_API_KEY not set: welcome and receipt emails are skipped');
    const start = new Date(ctx.now.getTime() - 86_400_000).toISOString().slice(0, 10);
    const res = await ctx.fetch(`https://api.sendgrid.com/v3/stats?start_date=${start}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (res.status === 401) return fail('SendGrid key rejected (401)');
    if (res.status === 403) return warn('SendGrid key lacks the stats.read scope; sender health not checked');
    if (!res.ok) return warn(`SendGrid stats returned ${res.status}`);
    const t = summarizeStats((await res.json()) as Array<{ stats?: Array<{ metrics?: SgMetrics }> }>);
    if (t.requests === 0) return ok('no email sent in the last 2 days');
    if (t.requests >= MIN_REQUESTS && t.delivered === 0) return fail(`0 of ${t.requests} emails delivered in 2 days`);
    const rate = t.bad / t.requests;
    const line = `${t.delivered}/${t.requests} delivered, ${t.bad} bounced/blocked in 2 days`;
    if (t.requests >= MIN_REQUESTS && rate >= BAD_RATE_FAIL) return fail(line);
    if (t.requests >= MIN_REQUESTS && rate >= BAD_RATE_WARN) return warn(line);
    if (t.spam > 0) return warn(`${line}, ${t.spam} spam reports`);
    return ok(line);
  },
};
