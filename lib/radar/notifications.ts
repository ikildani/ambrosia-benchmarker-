/**
 * Search & Evaluation — alerts and digests.
 *
 * Pure builders (no I/O) at the top: rule validation, dedupe keys, threshold
 * crossing detection, the mandate digest builder, and the email / Slack
 * renderers. `runRadarNotifications()` at the bottom orchestrates one daily
 * run against Supabase and is called by /api/cron/radar-digest.
 *
 * Delivery is idempotent: every alert is first written to radar_alert_events
 * with a UNIQUE dedupe_key (ON CONFLICT DO NOTHING); a send only happens when
 * that insert created a row, so re-running the cron never double-sends.
 *
 * Sources of truth read here (migrations 092, 096, 118):
 *   radar_user_mandates.notify_email / notify_in_app / digest_frequency /
 *   last_digest_at, radar_mandate_matches.matched_at, radar_watchlist
 *   (last_score_seen, last_partnership_status), radar_alert_rules.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { radarLabel } from '@/lib/radar/vocab';

// ═══════════════════════════════════════════════════════════════════════
// TYPES + VALIDATION
// ═══════════════════════════════════════════════════════════════════════

export const ALERT_KINDS = [
  'mandate_digest',
  'score_threshold',
  'partnership_change',
  'catalyst_upcoming',
  'watchlist_activity',
] as const;
export type AlertKind = (typeof ALERT_KINDS)[number];

export const ALERT_CHANNELS = ['email', 'slack', 'in_app'] as const;
export type AlertChannel = (typeof ALERT_CHANNELS)[number];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const uuid = z.string().regex(UUID_RE, 'must be a UUID');

/** Slack incoming webhooks only; anything else is rejected so the cron never posts to arbitrary hosts. */
export const SLACK_WEBHOOK_RE = /^https:\/\/hooks\.slack\.com\/(services|workflows|triggers)\/[A-Za-z0-9/_-]+$/;

const CONFIG_SCHEMAS: Record<AlertKind, z.ZodTypeAny> = {
  mandate_digest: z.object({
    mandate_id: uuid.nullable().optional(),
    max_items: z.number().int().min(1).max(50).optional(),
  }),
  score_threshold: z.object({
    asset_id: uuid.nullable().optional(),
    threshold: z.number().min(0).max(100),
    direction: z.enum(['above', 'below', 'either']).default('above'),
  }),
  partnership_change: z.object({
    asset_id: uuid.nullable().optional(),
  }),
  catalyst_upcoming: z.object({
    asset_id: uuid.nullable().optional(),
    days_ahead: z.number().int().min(1).max(365).default(30),
  }),
  watchlist_activity: z.object({
    min_delta: z.number().min(1).max(100).default(5),
  }),
};

export const alertRuleInputSchema = z.object({
  kind: z.enum(ALERT_KINDS),
  channel: z.enum(ALERT_CHANNELS),
  config: z.record(z.string(), z.unknown()).default({}),
  is_active: z.boolean().default(true),
});

export type AlertRuleInput = z.infer<typeof alertRuleInputSchema>;

export interface AlertRule {
  id: string;
  user_id: string;
  team_id: string | null;
  kind: AlertKind;
  channel: AlertChannel;
  config: Record<string, unknown>;
  is_active: boolean;
  created_at?: string;
}

export type RuleValidation =
  | { ok: true; rule: Pick<AlertRule, 'kind' | 'channel' | 'config' | 'is_active'> }
  | { ok: false; error: string };

/**
 * Validate a rule body: the envelope, then the per-kind config, then the
 * Slack webhook when channel is slack. Returns the normalised config (with
 * defaults applied) so the stored row is always complete.
 */
export function validateAlertRule(input: unknown): RuleValidation {
  const env = alertRuleInputSchema.safeParse(input);
  if (!env.success) {
    const issue = env.error.issues[0];
    return { ok: false, error: `${issue?.path.join('.') || 'rule'}: ${issue?.message || 'invalid'}` };
  }
  const { kind, channel, config, is_active } = env.data;
  const { webhook_url, ...rest } = config as { webhook_url?: unknown } & Record<string, unknown>;
  const cfg = CONFIG_SCHEMAS[kind].safeParse(rest);
  if (!cfg.success) {
    const issue = cfg.error.issues[0];
    return { ok: false, error: `config.${issue?.path.join('.') || kind}: ${issue?.message || 'invalid'}` };
  }
  const normalised: Record<string, unknown> = { ...(cfg.data as Record<string, unknown>) };
  if (channel === 'slack') {
    if (typeof webhook_url !== 'string' || !SLACK_WEBHOOK_RE.test(webhook_url)) {
      return { ok: false, error: 'config.webhook_url: must be a https://hooks.slack.com/... incoming webhook' };
    }
    normalised.webhook_url = webhook_url;
  }
  return { ok: true, rule: { kind, channel, config: normalised, is_active } };
}

// ═══════════════════════════════════════════════════════════════════════
// PURE HELPERS
// ═══════════════════════════════════════════════════════════════════════

/** `kind:part:part…` — stable, human-readable, unique per (subject, bucket). */
export function buildDedupeKey(kind: AlertKind, parts: Array<string | number | null | undefined>): string {
  return [kind, ...parts.map(p => (p == null || p === '' ? '-' : String(p)))].join(':');
}

/** ISO week label, e.g. 2026-W37. */
export function isoWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Date bucket a digest is deduped on: one per day, or one per ISO week. */
export function digestBucket(now: Date, frequency: string | null | undefined): string {
  return frequency === 'weekly' ? isoWeek(now) : now.toISOString().slice(0, 10);
}

/** Whether a mandate with this frequency is due, given when it was last digested. */
export function digestDue(now: Date, frequency: string | null | undefined, lastDigestAt: string | null | undefined): boolean {
  if (!lastDigestAt) return true;
  const last = new Date(lastDigestAt);
  if (Number.isNaN(last.getTime())) return true;
  const hours = (now.getTime() - last.getTime()) / 3_600_000;
  if (frequency === 'weekly') return hours >= 6.5 * 24;
  // daily and realtime (cron runs daily; realtime is treated as daily)
  return hours >= 20;
}

export type CrossingDirection = 'above' | 'below';

/**
 * Threshold crossing between two consecutive observations. `above` fires when
 * the score rises through the threshold, `below` when it falls through it,
 * `either` for both. A score that starts on the far side does not fire.
 */
export function detectThresholdCrossing(args: {
  previous: number | null | undefined;
  current: number | null | undefined;
  threshold: number;
  direction: 'above' | 'below' | 'either';
}): CrossingDirection | null {
  const { previous, current, threshold, direction } = args;
  if (previous == null || current == null || !Number.isFinite(previous) || !Number.isFinite(current)) return null;
  const rose = previous < threshold && current >= threshold;
  const fell = previous >= threshold && current < threshold;
  if (rose && direction !== 'below') return 'above';
  if (fell && direction !== 'above') return 'below';
  return null;
}

/**
 * Crossings from a snapshot series (ascending by date). Returns the last
 * crossing only — one alert per evaluation — with the snapshot date it
 * happened on, so the dedupe key is stable across re-runs.
 */
export function lastCrossingInSeries(
  series: Array<{ date: string; score: number }>,
  threshold: number,
  direction: 'above' | 'below' | 'either',
): { direction: CrossingDirection; date: string; from: number; to: number } | null {
  let found: { direction: CrossingDirection; date: string; from: number; to: number } | null = null;
  for (let i = 1; i < series.length; i++) {
    const hit = detectThresholdCrossing({ previous: series[i - 1].score, current: series[i].score, threshold, direction });
    if (hit) found = { direction: hit, date: series[i].date, from: series[i - 1].score, to: series[i].score };
  }
  return found;
}

// ═══════════════════════════════════════════════════════════════════════
// MANDATE DIGEST
// ═══════════════════════════════════════════════════════════════════════

export interface DigestMandate {
  id: string;
  user_id: string;
  name: string;
  digest_frequency: string | null;
  last_digest_at: string | null;
  notify_email: boolean | null;
  notify_in_app: boolean | null;
}

export interface DigestMatch {
  asset_id: string;
  match_score: number | string | null;
  match_reasons: string[] | null;
  matched_at: string;
  is_dismissed?: boolean | null;
}

export interface DigestAsset {
  id: string;
  asset_name: string;
  company_name: string;
  phase: string | null;
  modality: string | null;
  therapeutic_area: string | null;
  indication_category?: string | null;
  originator_country: string | null;
  partnership_status: string | null;
  licensing_intent_score: number | string | null;
  score_confidence?: number | string | null;
  /** Optional strongest active signal for the "why now" line. */
  top_signal?: { type: string; value: number; evidence: string | null; date: string | null } | null;
}

export interface DigestItem {
  asset_id: string;
  asset_name: string;
  company_name: string;
  country: string | null;
  phase: string | null;
  modality: string | null;
  therapeutic_area: string | null;
  partnership_status: string | null;
  score: number;
  confidence: number | null;
  match_score: number;
  match_reasons: string[];
  why_now: string;
  matched_at: string;
  url: string;
}

export interface MandateDigest {
  mandate_id: string;
  mandate_name: string;
  user_id: string;
  since: string;
  generated_at: string;
  total_new: number;
  items: DigestItem[];
}

const DEFAULT_MAX_ITEMS = 10;

export function whyNowLine(asset: DigestAsset, reasons: string[]): string {
  const sig = asset.top_signal;
  if (sig && sig.value >= 10) {
    const ev = (sig.evidence || '').replace(/\s+/g, ' ').trim();
    const head = `${sig.type.replace(/_/g, ' ')} ${Math.round(sig.value)}/100`;
    return ev ? `${head}: ${ev.slice(0, 140)}${ev.length > 140 ? '…' : ''}` : head;
  }
  if (reasons.length > 0) return reasons.slice(0, 2).join('; ');
  return 'Matches mandate filters; no strong licensing signal yet.';
}

/**
 * Build the digest for one mandate. Returns null when there is nothing new
 * (empty digests are suppressed — no event, no send).
 */
export function buildMandateDigest(args: {
  mandate: Pick<DigestMandate, 'id' | 'name' | 'user_id'>;
  matches: DigestMatch[];
  assets: DigestAsset[];
  since: Date;
  now?: Date;
  maxItems?: number;
  baseUrl?: string;
}): MandateDigest | null {
  const now = args.now ?? new Date();
  const baseUrl = (args.baseUrl ?? SITE_URL).replace(/\/$/, '');
  const assetById = new Map(args.assets.map(a => [a.id, a]));
  const fresh = args.matches.filter(m => !m.is_dismissed && new Date(m.matched_at) > args.since && assetById.has(m.asset_id));
  if (fresh.length === 0) return null;

  const items: DigestItem[] = fresh.map(m => {
    const a = assetById.get(m.asset_id)!;
    const reasons = Array.isArray(m.match_reasons) ? m.match_reasons : [];
    return {
      asset_id: a.id,
      asset_name: a.asset_name,
      company_name: a.company_name,
      country: a.originator_country,
      phase: a.phase,
      modality: a.modality,
      therapeutic_area: a.therapeutic_area,
      partnership_status: a.partnership_status,
      score: Math.round(Number(a.licensing_intent_score) || 0),
      confidence: a.score_confidence != null ? Math.round(Number(a.score_confidence)) : null,
      match_score: Math.round(Number(m.match_score) || 0),
      match_reasons: reasons,
      why_now: whyNowLine(a, reasons),
      matched_at: m.matched_at,
      url: `${baseUrl}/radar/${a.id}`,
    };
  });
  items.sort((a, b) => b.score - a.score || b.match_score - a.match_score || a.asset_name.localeCompare(b.asset_name));

  return {
    mandate_id: args.mandate.id,
    mandate_name: args.mandate.name,
    user_id: args.mandate.user_id,
    since: args.since.toISOString(),
    generated_at: now.toISOString(),
    total_new: fresh.length,
    items: items.slice(0, args.maxItems ?? DEFAULT_MAX_ITEMS),
  };
}

// ═══════════════════════════════════════════════════════════════════════
// RENDERERS (email HTML + Slack payload)
// ═══════════════════════════════════════════════════════════════════════

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://solidus.ambrosiaventures.co').replace(/\/$/, '');

export function escapeHtml(s: string | null | undefined): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const EMAIL_SHELL = (title: string, subtitle: string, body: string, footer: string) => `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;line-height:1.5;color:#e2e8f0;max-width:700px;margin:0 auto;padding:20px;background-color:#0f172a;">
  <div style="background:#0b1220;padding:28px 32px;border:1px solid #1e293b;border-bottom:none;border-radius:12px 12px 0 0;">
    <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8;">Solidus Search & Evaluation</p>
    <h1 style="color:#f8fafc;margin:0;font-size:20px;font-weight:600;">${escapeHtml(title)}</h1>
    <p style="color:#94a3b8;margin:6px 0 0;font-size:13px;">${escapeHtml(subtitle)}</p>
  </div>
  <div style="background:#111827;padding:20px 24px;border:1px solid #1e293b;border-top:none;border-radius:0 0 12px 12px;">
    ${body}
  </div>
  <div style="text-align:center;padding:18px;color:#64748b;font-size:12px;">
    ${footer}
  </div>
</body></html>`;

function scoreChip(score: number): string {
  const color = score >= 70 ? '#34d399' : score >= 40 ? '#fbbf24' : '#94a3b8';
  return `<span style="display:inline-block;min-width:34px;padding:2px 8px;border-radius:999px;border:1px solid #334155;background:#0f172a;color:${color};font-weight:600;font-size:13px;text-align:center;">${score}</span>`;
}

export function renderDigestEmail(digest: MandateDigest): { subject: string; html: string; text: string } {
  const n = digest.total_new;
  const subject = `Search & Evaluation: ${n} new match${n === 1 ? '' : 'es'} for “${digest.mandate_name}”`;
  const rows = digest.items.map(it => `
    <tr>
      <td style="padding:12px 10px;border-bottom:1px solid #1e293b;vertical-align:top;width:44px;">${scoreChip(it.score)}</td>
      <td style="padding:12px 10px;border-bottom:1px solid #1e293b;vertical-align:top;">
        <a href="${escapeHtml(it.url)}" style="color:#f8fafc;font-weight:600;font-size:14px;text-decoration:none;">${escapeHtml(it.asset_name)}</a>
        <div style="color:#94a3b8;font-size:12px;margin-top:2px;">${escapeHtml(it.company_name)}${it.country ? ` · ${escapeHtml(radarLabel(it.country))}` : ''} · ${escapeHtml(radarLabel(it.phase))} · ${escapeHtml(radarLabel(it.modality))} · ${escapeHtml(radarLabel(it.partnership_status))}</div>
        <div style="color:#cbd5e1;font-size:12px;margin-top:6px;"><span style="color:#64748b;">Why now:</span> ${escapeHtml(it.why_now)}</div>
      </td>
    </tr>`).join('');
  const more = n > digest.items.length ? `<p style="color:#94a3b8;font-size:12px;margin:12px 0 0;">${n - digest.items.length} more in the feed.</p>` : '';
  const body = `<table style="width:100%;border-collapse:collapse;">${rows}</table>${more}
    <div style="text-align:center;margin:24px 0 8px;"><a href="${SITE_URL}/radar" style="display:inline-block;background:#f59e0b;color:#0f172a;padding:10px 22px;text-decoration:none;border-radius:999px;font-weight:600;font-size:13px;">Open Search & Evaluation</a></div>`;
  const footer = `Daily mandate digest · new matches since ${escapeHtml(digest.since.slice(0, 10))}<br><a href="${SITE_URL}/radar" style="color:#f59e0b;">Manage mandates and alerts</a>`;
  const text = [subject, '', ...digest.items.map(it => `${it.score}  ${it.asset_name} — ${it.company_name} (${radarLabel(it.phase)}) — ${it.why_now} — ${it.url}`)].join('\n');
  return { subject, html: EMAIL_SHELL(subject, `${n} new match${n === 1 ? '' : 'es'} since ${digest.since.slice(0, 10)}`, body, footer), text };
}

export function renderDigestSlack(digest: MandateDigest): { text: string; blocks: unknown[] } {
  const n = digest.total_new;
  const text = `Search & Evaluation: ${n} new match${n === 1 ? '' : 'es'} for "${digest.mandate_name}"`;
  const lines = digest.items.map(it => `*${it.score}*  <${it.url}|${it.asset_name}> — ${it.company_name} · ${radarLabel(it.phase)} · ${radarLabel(it.partnership_status)}\n      _${it.why_now}_`);
  return {
    text,
    blocks: [
      { type: 'header', text: { type: 'plain_text', text } },
      { type: 'section', text: { type: 'mrkdwn', text: lines.join('\n') || '_No items_' } },
      { type: 'context', elements: [{ type: 'mrkdwn', text: `Since ${digest.since.slice(0, 10)} · <${SITE_URL}/radar|Open Search & Evaluation>` }] },
    ],
  };
}

export interface AlertEventPayload {
  kind: AlertKind;
  title: string;
  detail: string;
  asset_id?: string | null;
  asset_name?: string | null;
  company_name?: string | null;
  url?: string | null;
  data?: Record<string, unknown>;
}

export function renderAlertEmail(p: AlertEventPayload): { subject: string; html: string } {
  const subject = `Search & Evaluation: ${p.title}`;
  const body = `<p style="margin:0 0 10px;font-size:15px;color:#f8fafc;font-weight:600;">${escapeHtml(p.asset_name || p.title)}${p.company_name ? ` <span style="color:#94a3b8;font-weight:400;">· ${escapeHtml(p.company_name)}</span>` : ''}</p>
    <p style="margin:0;font-size:13px;color:#cbd5e1;">${escapeHtml(p.detail)}</p>
    ${p.url ? `<div style="margin:20px 0 4px;"><a href="${escapeHtml(p.url)}" style="display:inline-block;background:#f59e0b;color:#0f172a;padding:9px 20px;text-decoration:none;border-radius:999px;font-weight:600;font-size:13px;">Open asset brief</a></div>` : ''}`;
  return { subject, html: EMAIL_SHELL(p.title, p.kind.replace(/_/g, ' '), body, `<a href="${SITE_URL}/radar" style="color:#f59e0b;">Manage alerts</a>`) };
}

export function renderAlertSlack(p: AlertEventPayload): { text: string; blocks: unknown[] } {
  const text = `Search & Evaluation: ${p.title}`;
  const link = p.url && p.asset_name ? `<${p.url}|${p.asset_name}>` : (p.asset_name || '');
  return {
    text,
    blocks: [
      { type: 'section', text: { type: 'mrkdwn', text: `*${p.title}*\n${link}${p.company_name ? ` — ${p.company_name}` : ''}\n${p.detail}` } },
    ],
  };
}

// ═══════════════════════════════════════════════════════════════════════
// ORCHESTRATION
// ═══════════════════════════════════════════════════════════════════════

export interface Deliverers {
  sendEmail: (args: { to: string; subject: string; html: string }) => Promise<{ success: boolean; error?: string }>;
  postSlack: (webhookUrl: string, payload: unknown) => Promise<{ success: boolean; error?: string }>;
}

export interface NotificationRunResult {
  mandatesScanned: number;
  digestsBuilt: number;
  rulesEvaluated: number;
  eventsCreated: number;
  duplicatesSkipped: number;
  deliveriesSent: number;
  deliveriesFailed: number;
  errors: string[];
  timedOut: boolean;
}

type Row = Record<string, unknown>;

const defaultDeliverers = (): Deliverers => ({
  sendEmail: async ({ to, subject, html }) => {
    const { sendEmail } = await import('@/lib/email/client');
    const r = await sendEmail({ to, subject, html });
    return { success: r.success, error: r.error };
  },
  postSlack: async (webhookUrl, payload) => {
    if (!SLACK_WEBHOOK_RE.test(webhookUrl)) return { success: false, error: 'invalid webhook host' };
    try {
      const res = await fetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) return { success: false, error: `slack ${res.status}` };
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
});

interface EventInsert {
  rule_id: string | null;
  user_id: string;
  asset_id: string | null;
  mandate_id: string | null;
  kind: AlertKind;
  channel: AlertChannel;
  payload: Record<string, unknown>;
  dedupe_key: string;
  delivery_status: 'sent' | 'failed' | 'queued';
}

/** Insert with ON CONFLICT (dedupe_key) DO NOTHING; true when a row was created. */
async function claimEvent(supabase: SupabaseClient, ev: EventInsert): Promise<{ created: boolean; id: string | null; error?: string }> {
  const { data, error } = await supabase
    .from('radar_alert_events')
    .upsert(ev, { onConflict: 'dedupe_key', ignoreDuplicates: true })
    .select('id');
  if (error) return { created: false, id: null, error: error.message };
  const row = (data as Row[] | null)?.[0];
  return { created: !!row, id: row ? String(row.id) : null };
}

async function markDelivery(supabase: SupabaseClient, id: string | null, status: 'sent' | 'failed'): Promise<void> {
  if (!id) return;
  await supabase.from('radar_alert_events').update({ delivery_status: status }).eq('id', id);
}

export async function runRadarNotifications(
  supabase: SupabaseClient,
  opts: { now?: Date; timeBudgetMs?: number; deliver?: Deliverers; baseUrl?: string } = {},
): Promise<NotificationRunResult> {
  const now = opts.now ?? new Date();
  // The budget is wall-clock: `now` may be an injected logical clock (tests,
  // replays), so the deadline must come from the real clock or a past `now`
  // makes every run look timed out before it scans anything.
  const deadline = Date.now() + (opts.timeBudgetMs ?? 240_000);
  const deliver = opts.deliver ?? defaultDeliverers();
  const baseUrl = (opts.baseUrl ?? SITE_URL).replace(/\/$/, '');
  const result: NotificationRunResult = {
    mandatesScanned: 0, digestsBuilt: 0, rulesEvaluated: 0, eventsCreated: 0,
    duplicatesSkipped: 0, deliveriesSent: 0, deliveriesFailed: 0, errors: [], timedOut: false,
  };
  const outOfTime = () => Date.now() > deadline;

  // ── Load rules + user emails ─────────────────────────────────────────
  const { data: rulesRaw, error: rulesErr } = await supabase
    .from('radar_alert_rules')
    .select('id, user_id, team_id, kind, channel, config, is_active')
    .eq('is_active', true)
    .limit(5000);
  if (rulesErr) result.errors.push(`rules: ${rulesErr.message}`);
  const rules = ((rulesRaw || []) as Row[]).map(r => ({
    id: String(r.id), user_id: String(r.user_id), team_id: (r.team_id as string | null) ?? null,
    kind: r.kind as AlertKind, channel: r.channel as AlertChannel,
    config: (r.config as Record<string, unknown>) || {}, is_active: true,
  })) as AlertRule[];

  const { data: mandatesRaw, error: mandatesErr } = await supabase
    .from('radar_user_mandates')
    .select('id, user_id, name, digest_frequency, last_digest_at, notify_email, notify_in_app')
    .eq('is_active', true)
    .or('notify_email.eq.true,notify_in_app.eq.true')
    .limit(5000);
  if (mandatesErr) result.errors.push(`mandates: ${mandatesErr.message}`);
  const mandates = ((mandatesRaw || []) as unknown as DigestMandate[]);

  const userIds = Array.from(new Set([...rules.map(r => r.user_id), ...mandates.map(m => m.user_id)]));
  const emailByUser = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase.from('user_profiles').select('id, email').in('id', userIds.slice(0, 5000));
    for (const p of (profiles || []) as Row[]) if (p.email) emailByUser.set(String(p.id), String(p.email));
  }

  const send = async (ev: EventInsert, render: { email: () => { subject: string; html: string }; slack: () => unknown }, webhookUrl?: string): Promise<void> => {
    const claim = await claimEvent(supabase, ev);
    if (claim.error) { result.errors.push(`event ${ev.dedupe_key}: ${claim.error}`); return; }
    if (!claim.created) { result.duplicatesSkipped += 1; return; }
    result.eventsCreated += 1;
    if (ev.channel === 'in_app') return;
    let outcome: { success: boolean; error?: string };
    if (ev.channel === 'email') {
      const to = emailByUser.get(ev.user_id);
      outcome = to ? await deliver.sendEmail({ to, ...render.email() }) : { success: false, error: 'no email on profile' };
    } else {
      outcome = webhookUrl ? await deliver.postSlack(webhookUrl, render.slack()) : { success: false, error: 'no webhook' };
    }
    if (outcome.success) result.deliveriesSent += 1;
    else { result.deliveriesFailed += 1; result.errors.push(`${ev.channel} ${ev.dedupe_key}: ${outcome.error || 'failed'}`); }
    await markDelivery(supabase, claim.id, outcome.success ? 'sent' : 'failed');
  };

  // ── 1. Mandate digests ───────────────────────────────────────────────
  const digestRules = rules.filter(r => r.kind === 'mandate_digest');
  // Explicit mandate_digest rules can target mandates without notify_* set.
  const explicitMandateIds = new Set(digestRules.map(r => r.config.mandate_id).filter((v): v is string => typeof v === 'string'));
  if (explicitMandateIds.size > 0) {
    const missing = Array.from(explicitMandateIds).filter(id => !mandates.some(m => m.id === id));
    if (missing.length > 0) {
      const { data: extra } = await supabase
        .from('radar_user_mandates')
        .select('id, user_id, name, digest_frequency, last_digest_at, notify_email, notify_in_app')
        .in('id', missing).eq('is_active', true);
      for (const m of (extra || []) as unknown as DigestMandate[]) mandates.push(m);
    }
  }

  for (const mandate of mandates) {
    if (outOfTime()) { result.timedOut = true; break; }
    result.mandatesScanned += 1;
    if (!digestDue(now, mandate.digest_frequency, mandate.last_digest_at)) continue;

    const since = mandate.last_digest_at
      ? new Date(mandate.last_digest_at)
      : new Date(now.getTime() - (mandate.digest_frequency === 'weekly' ? 7 : 1) * 86_400_000);

    const { data: matchesRaw, error: matchErr } = await supabase
      .from('radar_mandate_matches')
      .select('asset_id, match_score, match_reasons, matched_at, is_dismissed')
      .eq('mandate_id', mandate.id)
      // Stale matches (partnered since, re-attributed, below the floor) never reach a digest.
      .eq('is_stale', false)
      .gt('matched_at', since.toISOString())
      .order('matched_at', { ascending: false })
      .limit(200);
    if (matchErr) { result.errors.push(`matches ${mandate.id}: ${matchErr.message}`); continue; }
    const matches = (matchesRaw || []) as unknown as DigestMatch[];
    if (matches.length === 0) {
      await supabase.from('radar_user_mandates').update({ last_digest_at: now.toISOString() }).eq('id', mandate.id);
      continue;
    }

    const assetIds = Array.from(new Set(matches.map(m => m.asset_id)));
    const [{ data: assetsRaw }, { data: sigRaw }] = await Promise.all([
      supabase.from('clinical_assets')
        .select('id, asset_name, company_name, phase, modality, therapeutic_area, indication_category, originator_country, partnership_status, licensing_intent_score, score_confidence')
        .in('id', assetIds),
      supabase.from('licensing_signals')
        .select('asset_id, signal_type, signal_value, evidence_text, evidence_date')
        .in('asset_id', assetIds).eq('is_active', true)
        .order('signal_value', { ascending: false }).limit(assetIds.length * 3),
    ]);
    const topSignal = new Map<string, DigestAsset['top_signal']>();
    for (const s of (sigRaw || []) as Row[]) {
      const id = String(s.asset_id);
      if (!topSignal.has(id)) topSignal.set(id, { type: String(s.signal_type), value: Number(s.signal_value) || 0, evidence: (s.evidence_text as string | null) ?? null, date: (s.evidence_date as string | null) ?? null });
    }
    const assets: DigestAsset[] = ((assetsRaw || []) as unknown as DigestAsset[]).map(a => ({ ...a, top_signal: topSignal.get(a.id) ?? null }));

    const perRuleMax = digestRules.find(r => r.user_id === mandate.user_id && (r.config.mandate_id == null || r.config.mandate_id === mandate.id))?.config.max_items;
    const digest = buildMandateDigest({ mandate, matches, assets, since, now, baseUrl, maxItems: typeof perRuleMax === 'number' ? perRuleMax : undefined });
    if (!digest) {
      await supabase.from('radar_user_mandates').update({ last_digest_at: now.toISOString() }).eq('id', mandate.id);
      continue;
    }
    result.digestsBuilt += 1;
    const bucket = digestBucket(now, mandate.digest_frequency);

    const channels: Array<{ channel: AlertChannel; rule_id: string | null; webhook?: string }> = [];
    if (mandate.notify_email) channels.push({ channel: 'email', rule_id: null });
    if (mandate.notify_in_app) channels.push({ channel: 'in_app', rule_id: null });
    for (const r of digestRules) {
      if (r.user_id !== mandate.user_id) continue;
      if (r.config.mandate_id != null && r.config.mandate_id !== mandate.id) continue;
      if (channels.some(c => c.channel === r.channel)) continue;
      channels.push({ channel: r.channel, rule_id: r.id, webhook: typeof r.config.webhook_url === 'string' ? r.config.webhook_url : undefined });
    }

    for (const c of channels) {
      await send({
        rule_id: c.rule_id, user_id: mandate.user_id, asset_id: null, mandate_id: mandate.id,
        kind: 'mandate_digest', channel: c.channel,
        payload: { digest },
        dedupe_key: buildDedupeKey('mandate_digest', [mandate.id, c.channel, bucket]),
        delivery_status: c.channel === 'in_app' ? 'queued' : 'sent',
      }, {
        email: () => renderDigestEmail(digest),
        slack: () => renderDigestSlack(digest),
      }, c.webhook);
    }
    await supabase.from('radar_user_mandates').update({ last_digest_at: now.toISOString() }).eq('id', mandate.id);
  }

  // ── 2. Watchlist-driven rules ────────────────────────────────────────
  const watchRules = rules.filter(r => r.kind !== 'mandate_digest');
  if (watchRules.length > 0 && !outOfTime()) {
    const ruleUsers = Array.from(new Set(watchRules.map(r => r.user_id)));
    const { data: watchRaw, error: watchErr } = await supabase
      .from('radar_watchlist')
      .select('id, user_id, asset_id, score_at_add, last_score_seen, last_partnership_status')
      .in('user_id', ruleUsers)
      .limit(10000);
    if (watchErr) result.errors.push(`watchlist: ${watchErr.message}`);
    const watches = (watchRaw || []) as Row[];
    const watchedAssetIds = Array.from(new Set(watches.map(w => String(w.asset_id))));
    // Rules pinned to a specific asset the user does not watch still evaluate.
    for (const r of watchRules) {
      const pinned = r.config.asset_id;
      if (typeof pinned === 'string' && !watchedAssetIds.includes(pinned)) watchedAssetIds.push(pinned);
    }

    const assetById = new Map<string, Row>();
    for (let i = 0; i < watchedAssetIds.length; i += 500) {
      const { data } = await supabase
        .from('clinical_assets')
        .select('id, asset_name, company_name, phase, partnership_status, partner_company_name, licensing_intent_score, nct_ids')
        .in('id', watchedAssetIds.slice(i, i + 500));
      for (const a of (data || []) as Row[]) assetById.set(String(a.id), a);
    }

    // Today's snapshot per watched asset (delta + previous score for crossings).
    const todayIso = now.toISOString().slice(0, 10);
    const snapByAsset = new Map<string, { score: number; delta: number; date: string }>();
    for (let i = 0; i < watchedAssetIds.length; i += 500) {
      const { data } = await supabase
        .from('asset_signal_snapshots')
        .select('asset_id, licensing_intent_score, score_delta, snapshot_date')
        .in('asset_id', watchedAssetIds.slice(i, i + 500))
        .gte('snapshot_date', new Date(now.getTime() - 2 * 86_400_000).toISOString().slice(0, 10))
        .order('snapshot_date', { ascending: false });
      for (const s of (data || []) as Row[]) {
        const id = String(s.asset_id);
        if (!snapByAsset.has(id)) snapByAsset.set(id, { score: Number(s.licensing_intent_score) || 0, delta: Number(s.score_delta) || 0, date: String(s.snapshot_date) });
      }
    }

    // Upcoming primary completions for catalyst rules.
    const catalystRules = watchRules.filter(r => r.kind === 'catalyst_upcoming');
    const nctToAsset = new Map<string, string>();
    const upcomingByAsset = new Map<string, Array<{ nct_id: string; date: string; title: string | null; phase: string | null }>>();
    if (catalystRules.length > 0) {
      const maxDays = Math.max(...catalystRules.map(r => Number(r.config.days_ahead) || 30));
      for (const [id, a] of assetById) for (const nct of (Array.isArray(a.nct_ids) ? a.nct_ids : []) as string[]) nctToAsset.set(nct, id);
      const ncts = Array.from(nctToAsset.keys());
      const horizon = new Date(now.getTime() + maxDays * 86_400_000).toISOString().slice(0, 10);
      for (let i = 0; i < ncts.length; i += 500) {
        const { data } = await supabase
          .from('company_trials')
          .select('nct_id, trial_title, phase, primary_completion_date')
          .in('nct_id', ncts.slice(i, i + 500))
          .gte('primary_completion_date', todayIso)
          .lte('primary_completion_date', horizon);
        for (const t of (data || []) as Row[]) {
          const assetId = nctToAsset.get(String(t.nct_id));
          if (!assetId) continue;
          const list = upcomingByAsset.get(assetId) ?? [];
          list.push({ nct_id: String(t.nct_id), date: String(t.primary_completion_date), title: (t.trial_title as string | null) ?? null, phase: (t.phase as string | null) ?? null });
          upcomingByAsset.set(assetId, list);
        }
      }
    }

    const watchesByUser = new Map<string, Row[]>();
    for (const w of watches) {
      const list = watchesByUser.get(String(w.user_id)) ?? [];
      list.push(w);
      watchesByUser.set(String(w.user_id), list);
    }

    for (const rule of watchRules) {
      if (outOfTime()) { result.timedOut = true; break; }
      result.rulesEvaluated += 1;
      const pinned = typeof rule.config.asset_id === 'string' ? rule.config.asset_id : null;
      const userWatches = watchesByUser.get(rule.user_id) ?? [];
      const subjects: Array<{ asset_id: string; watch: Row | null }> = pinned
        ? [{ asset_id: pinned, watch: userWatches.find(w => String(w.asset_id) === pinned) ?? null }]
        : userWatches.map(w => ({ asset_id: String(w.asset_id), watch: w }));
      const webhook = typeof rule.config.webhook_url === 'string' ? rule.config.webhook_url : undefined;

      for (const { asset_id, watch } of subjects) {
        const asset = assetById.get(asset_id);
        if (!asset) continue;
        const assetName = String(asset.asset_name);
        const companyName = String(asset.company_name);
        const url = `${baseUrl}/radar/${asset_id}`;
        const current = Number(asset.licensing_intent_score) || 0;
        const snap = snapByAsset.get(asset_id);
        const previous = watch && watch.last_score_seen != null ? Number(watch.last_score_seen)
          : snap ? snap.score - snap.delta
          : watch && watch.score_at_add != null ? Number(watch.score_at_add) : null;

        const base = { rule_id: rule.id, user_id: rule.user_id, asset_id, mandate_id: null, channel: rule.channel, delivery_status: (rule.channel === 'in_app' ? 'queued' : 'sent') as EventInsert['delivery_status'] };

        if (rule.kind === 'score_threshold') {
          const threshold = Number(rule.config.threshold);
          const direction = (rule.config.direction as 'above' | 'below' | 'either') || 'above';
          const hit = detectThresholdCrossing({ previous, current, threshold, direction });
          if (!hit) continue;
          const payload: AlertEventPayload = {
            kind: 'score_threshold',
            title: `${assetName} crossed ${hit} ${threshold}`,
            detail: `Licensing intent moved from ${Math.round(previous ?? 0)} to ${Math.round(current)} (threshold ${threshold}, ${hit}).`,
            asset_id, asset_name: assetName, company_name: companyName, url,
            data: { previous, current, threshold, direction: hit, snapshot_date: snap?.date ?? todayIso },
          };
          await send({ ...base, kind: 'score_threshold', payload: payload as unknown as Record<string, unknown>, dedupe_key: buildDedupeKey('score_threshold', [rule.id, asset_id, hit, snap?.date ?? todayIso]) },
            { email: () => renderAlertEmail(payload), slack: () => renderAlertSlack(payload) }, webhook);
        } else if (rule.kind === 'partnership_change') {
          const prevStatus = watch ? (watch.last_partnership_status as string | null) : null;
          const curStatus = (asset.partnership_status as string | null) ?? null;
          if (!watch || prevStatus == null || prevStatus === curStatus) continue;
          const payload: AlertEventPayload = {
            kind: 'partnership_change',
            title: `${assetName}: ${radarLabel(prevStatus)} → ${radarLabel(curStatus)}`,
            detail: asset.partner_company_name ? `Partner on record: ${String(asset.partner_company_name)}.` : 'Partnership status changed on the latest refresh.',
            asset_id, asset_name: assetName, company_name: companyName, url,
            data: { from: prevStatus, to: curStatus, partner: asset.partner_company_name ?? null },
          };
          await send({ ...base, kind: 'partnership_change', payload: payload as unknown as Record<string, unknown>, dedupe_key: buildDedupeKey('partnership_change', [rule.id, asset_id, prevStatus, curStatus]) },
            { email: () => renderAlertEmail(payload), slack: () => renderAlertSlack(payload) }, webhook);
        } else if (rule.kind === 'catalyst_upcoming') {
          const days = Number(rule.config.days_ahead) || 30;
          const horizon = new Date(now.getTime() + days * 86_400_000).toISOString().slice(0, 10);
          for (const c of upcomingByAsset.get(asset_id) ?? []) {
            if (c.date > horizon) continue;
            const payload: AlertEventPayload = {
              kind: 'catalyst_upcoming',
              title: `${assetName}: primary completion ${c.date} (${c.nct_id})`,
              detail: `${c.title || 'Trial'}${c.phase ? ` — ${c.phase.replace(/_/g, ' ')}` : ''}. Within ${days} days.`,
              asset_id, asset_name: assetName, company_name: companyName, url,
              data: { nct_id: c.nct_id, date: c.date, days_ahead: days },
            };
            await send({ ...base, kind: 'catalyst_upcoming', payload: payload as unknown as Record<string, unknown>, dedupe_key: buildDedupeKey('catalyst_upcoming', [rule.id, asset_id, c.nct_id, c.date]) },
              { email: () => renderAlertEmail(payload), slack: () => renderAlertSlack(payload) }, webhook);
          }
        } else if (rule.kind === 'watchlist_activity') {
          const minDelta = Number(rule.config.min_delta) || 5;
          const delta = previous != null ? current - previous : (snap?.delta ?? 0);
          if (Math.abs(delta) < minDelta) continue;
          const payload: AlertEventPayload = {
            kind: 'watchlist_activity',
            title: `${assetName} moved ${delta > 0 ? '+' : ''}${Math.round(delta)} points`,
            detail: `Licensing intent is now ${Math.round(current)} (was ${Math.round(previous ?? current - delta)}).`,
            asset_id, asset_name: assetName, company_name: companyName, url,
            data: { previous, current, delta, snapshot_date: snap?.date ?? todayIso },
          };
          await send({ ...base, kind: 'watchlist_activity', payload: payload as unknown as Record<string, unknown>, dedupe_key: buildDedupeKey('watchlist_activity', [rule.id, asset_id, snap?.date ?? todayIso]) },
            { email: () => renderAlertEmail(payload), slack: () => renderAlertSlack(payload) }, webhook);
        }
      }
    }

    // Advance the per-row cursors so the next run compares against today.
    const cursorUpdates = watches
      .map(w => {
        const a = assetById.get(String(w.asset_id));
        if (!a) return null;
        return { id: String(w.id), last_score_seen: Number(a.licensing_intent_score) || 0, last_partnership_status: (a.partnership_status as string | null) ?? null };
      })
      .filter((u): u is { id: string; last_score_seen: number; last_partnership_status: string | null } => !!u);
    for (const u of cursorUpdates) {
      const { error } = await supabase.from('radar_watchlist').update({ last_score_seen: u.last_score_seen, last_partnership_status: u.last_partnership_status }).eq('id', u.id);
      if (error) { result.errors.push(`cursor ${u.id}: ${error.message}`); break; }
    }
  }

  return result;
}
