/**
 * Outcome ledger — brief outcome follow-up emails (workstream 2).
 *
 * 45 and 120 days after a Deal Intelligence Brief is delivered
 * (benchmark_requests.delivered_at) the client receives one plain email from
 * Issa asking for the outcome, with a signed link into /outcomes/report/<token>.
 *
 *   selectFollowups     — pure: which (request, stage) pairs are due now
 *   buildFollowupEmail  — pure: subject + text + html for a candidate
 *   runOutcomeFollowups — loads, selects, sends, records; never throws
 *
 * Idempotent through `outcome_followups` (migration 123): one row per
 * (request, stage), written only after the mail is accepted. A request whose
 * brief prediction already has a client-reported outcome is skipped. Runs
 * from the 02:00 UTC outcome phase of /api/cron/deal-verification.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email/client';
import { signOutcomeReportToken } from './report-token';

export const FOLLOWUP_STAGES = [45, 120] as const;
export type FollowupStage = (typeof FOLLOWUP_STAGES)[number];
/** No follow-up is sent for a brief delivered more than this many days ago. */
export const FOLLOWUP_MAX_DAYS = 200;
export const FOLLOWUP_FROM = 'Issa Kildani <ikildani@ambrosiaventures.co>';
export const FOLLOWUP_REPLY_TO = 'ikildani@ambrosiaventures.co';
const DEFAULT_BASE_URL = 'https://solidus.ambrosiaventures.co';
const DAY_MS = 86_400_000;

// ─── inputs ────────────────────────────────────────────────────────────────

export interface FollowupRequestRow {
  id: string;
  email: string | null;
  name: string | null;
  delivered_at: string | null;
  therapeutic_area: string | null;
  indication: string | null;
  phase: string | null;
  status: string | null;
}

export interface FollowupPredictionRow {
  id: string;
  source_id: string | null;
  status: string;
  asset_name: string | null;
  upfront_mid: number | null;
  total_mid: number | null;
}

export interface FollowupSentRow {
  request_id: string;
  stage: number;
}

export interface FollowupOutcomeRow {
  prediction_id: string;
  matched_by: string;
  status: string;
}

export interface FollowupCandidate {
  request: FollowupRequestRow;
  prediction: FollowupPredictionRow;
  stage: FollowupStage;
  daysSinceDelivery: number;
}

export type FollowupSkipReason = 'not_due' | 'too_old' | 'already_sent' | 'has_client_outcome' | 'no_prediction' | 'no_email' | 'withdrawn';

export interface FollowupSelection {
  due: FollowupCandidate[];
  skipped: Record<FollowupSkipReason, number>;
}

export interface FollowupRunReport {
  requests: number;
  due: number;
  sent: number;
  skipped: Record<FollowupSkipReason, number>;
  errors: string[];
}

function emptySkips(): Record<FollowupSkipReason, number> {
  return { not_due: 0, too_old: 0, already_sent: 0, has_client_outcome: 0, no_prediction: 0, no_email: 0, withdrawn: 0 };
}

// ─── selection (pure) ──────────────────────────────────────────────────────

/**
 * Which stage is due for a brief delivered `days` ago: the day-45 mail from
 * day 45 until the day-120 window opens, the day-120 mail from day 120 until
 * FOLLOWUP_MAX_DAYS. A stage that was never sent is not sent late once its
 * window has passed (the next stage carries the ask).
 */
export function stageForDays(days: number): FollowupStage | 'not_due' | 'too_old' {
  if (days < FOLLOWUP_STAGES[0]) return 'not_due';
  if (days >= FOLLOWUP_MAX_DAYS) return 'too_old';
  return days >= FOLLOWUP_STAGES[1] ? FOLLOWUP_STAGES[1] : FOLLOWUP_STAGES[0];
}

export function selectFollowups(input: {
  requests: FollowupRequestRow[];
  predictions: FollowupPredictionRow[];
  sent: FollowupSentRow[];
  clientOutcomes: FollowupOutcomeRow[];
  now: Date;
}): FollowupSelection {
  const skipped = emptySkips();
  const due: FollowupCandidate[] = [];
  const byRequest = new Map<string, FollowupPredictionRow>();
  for (const p of input.predictions) if (p.source_id && !byRequest.has(p.source_id)) byRequest.set(p.source_id, p);
  const sentKeys = new Set(input.sent.map((s) => `${s.request_id}|${s.stage}`));
  const reported = new Set(input.clientOutcomes.filter((o) => o.matched_by === 'client' && o.status === 'accepted').map((o) => o.prediction_id));

  for (const request of input.requests) {
    const deliveredMs = request.delivered_at ? Date.parse(request.delivered_at) : NaN;
    if (!Number.isFinite(deliveredMs)) { skipped.not_due++; continue; }
    const days = Math.floor((input.now.getTime() - deliveredMs) / DAY_MS);
    const stage = stageForDays(days);
    if (stage === 'not_due' || stage === 'too_old') { skipped[stage]++; continue; }
    if (!request.email?.trim()) { skipped.no_email++; continue; }
    const prediction = byRequest.get(request.id);
    if (!prediction) { skipped.no_prediction++; continue; }
    if (prediction.status === 'withdrawn') { skipped.withdrawn++; continue; }
    if (reported.has(prediction.id)) { skipped.has_client_outcome++; continue; }
    if (sentKeys.has(`${request.id}|${stage}`)) { skipped.already_sent++; continue; }
    due.push({ request, prediction, stage, daysSinceDelivery: days });
  }
  return { due, skipped };
}

// ─── email (pure) ──────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtM(v: number | null): string | null {
  if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) return null;
  return `$${v < 10 ? v.toFixed(1).replace(/\.0$/, '') : Math.round(v).toLocaleString('en-US')}M`;
}

export function followupAssetLabel(c: Pick<FollowupCandidate, 'request' | 'prediction'>): string {
  const asset = c.prediction.asset_name?.trim();
  if (asset) return asset;
  const parts = [c.request.indication?.trim(), c.request.phase?.trim()].filter((s): s is string => !!s);
  return parts.length ? parts.join(', ') : 'your asset';
}

function askSentence(p: FollowupPredictionRow): string {
  const up = fmtM(p.upfront_mid);
  const total = fmtM(p.total_mid);
  if (up && total) return `${up} upfront and ${total} in total value`;
  if (up) return `${up} upfront`;
  if (total) return `${total} in total value`;
  return 'the terms in the brief';
}

function firstName(name: string | null): string {
  const n = (name ?? '').trim().split(/\s+/)[0];
  return n || 'there';
}

function longDate(iso: string | null): string {
  const ms = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(ms) ? new Date(ms).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : 'earlier this year';
}

export interface FollowupEmail {
  subject: string;
  text: string;
  html: string;
}

/** Two short paragraphs, one link, no marketing. */
export function buildFollowupEmail(c: FollowupCandidate, link: string): FollowupEmail {
  const label = followupAssetLabel(c);
  const ask = askSentence(c.prediction);
  const hi = `Hi ${firstName(c.request.name)},`;
  let subject: string;
  let p1: string;
  let p2: string;

  if (c.stage === 45) {
    subject = `How has the process gone for ${label}?`;
    p1 = `We delivered the deal brief for ${label} on ${longDate(c.request.delivered_at)}, with the ask set at ${ask}. I would like to record how the process has gone since: the first offer you received, the terms you signed if you have, and who signed.`;
    p2 = `The form takes two minutes and feeds the ledger we use to measure whether the brief moved your terms. Your answers are used only in aggregate and are never published in a way that identifies you or the asset.`;
  } else {
    subject = `Closing the loop on ${label}`;
    p1 = `It has been four months since the brief for ${label}. If the process has closed, I would like to record the terms you signed against the first offer and the ask of ${ask}. If it is still open, a one-line reply on where it stands is just as useful.`;
    p2 = `The form takes two minutes.`;
  }

  const sign = ['Best,', 'Issa Kildani', 'Managing Partner, Ambrosia Ventures'];
  const text = [hi, '', p1, '', `${p2} ${link}`, '', ...sign].join('\n');
  const para = (s: string) => `<p style="font-size:15px;line-height:1.6;color:#1e293b;margin:0 0 16px;">${s}</p>`;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
${para(escapeHtml(hi))}
${para(escapeHtml(p1))}
${para(`${escapeHtml(p2)} <a href="${escapeHtml(link)}" style="color:#0f766e;">${escapeHtml(link)}</a>`)}
<p style="font-size:14px;line-height:1.5;color:#1e293b;margin:24px 0 0;">Best,<br>Issa Kildani<br><span style="color:#64748b;">Managing Partner, Ambrosia Ventures</span></p>
</body></html>`;
  return { subject, text, html };
}

export function followupLink(c: FollowupCandidate, baseUrl: string, now: Date): string {
  const token = signOutcomeReportToken({ predictionId: c.prediction.id, requestId: c.request.id }, { now });
  return `${baseUrl.replace(/\/$/, '')}/outcomes/report/${token}`;
}

// ─── runner ────────────────────────────────────────────────────────────────

export type FollowupSender = (opts: { to: string; subject: string; html: string; from: string; replyTo: string }) => Promise<{ success: boolean; error?: string }>;

export interface FollowupRunOptions {
  now?: Date;
  baseUrl?: string;
  /** Injected in tests; defaults to lib/email/client sendEmail. */
  send?: FollowupSender;
  /** Select and log, send nothing, write nothing. */
  dryRun?: boolean;
  maxSends?: number;
}

export async function loadFollowupInputs(supabase: SupabaseClient, now: Date): Promise<{
  requests: FollowupRequestRow[]; predictions: FollowupPredictionRow[]; sent: FollowupSentRow[]; clientOutcomes: FollowupOutcomeRow[];
}> {
  const from = new Date(now.getTime() - FOLLOWUP_MAX_DAYS * DAY_MS).toISOString();
  const to = new Date(now.getTime() - FOLLOWUP_STAGES[0] * DAY_MS).toISOString();
  const { data: reqData, error: reqErr } = await supabase
    .from('benchmark_requests')
    .select('id,email,name,delivered_at,therapeutic_area,indication,phase,status')
    .eq('status', 'delivered')
    .gte('delivered_at', from)
    .lte('delivered_at', to)
    .order('delivered_at', { ascending: true })
    .limit(500);
  if (reqErr) throw new Error(`benchmark_requests: ${reqErr.message}`);
  const requests = (reqData ?? []) as FollowupRequestRow[];
  if (!requests.length) return { requests, predictions: [], sent: [], clientOutcomes: [] };
  const ids = requests.map((r) => r.id);

  const { data: predData, error: predErr } = await supabase
    .from('predictions')
    .select('id,source_id,status,asset_name,upfront_mid,total_mid')
    .eq('source', 'brief')
    .in('source_id', ids);
  if (predErr) throw new Error(`predictions: ${predErr.message}`);
  const predictions = (predData ?? []) as FollowupPredictionRow[];

  const { data: sentData, error: sentErr } = await supabase
    .from('outcome_followups')
    .select('request_id,stage')
    .in('request_id', ids);
  if (sentErr) throw new Error(`outcome_followups: ${sentErr.message}`);
  const sent = (sentData ?? []) as FollowupSentRow[];

  let clientOutcomes: FollowupOutcomeRow[] = [];
  if (predictions.length) {
    const { data: outData, error: outErr } = await supabase
      .from('outcomes')
      .select('prediction_id,matched_by,status')
      .eq('matched_by', 'client')
      .eq('status', 'accepted')
      .in('prediction_id', predictions.map((p) => p.id));
    if (outErr) throw new Error(`outcomes: ${outErr.message}`);
    clientOutcomes = (outData ?? []) as FollowupOutcomeRow[];
  }
  return { requests, predictions, sent, clientOutcomes };
}

export async function runOutcomeFollowups(supabase: SupabaseClient, opts: FollowupRunOptions = {}): Promise<FollowupRunReport> {
  const now = opts.now ?? new Date();
  const baseUrl = opts.baseUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? DEFAULT_BASE_URL;
  const send: FollowupSender = opts.send ?? ((o) => sendEmail(o));
  const report: FollowupRunReport = { requests: 0, due: 0, sent: 0, skipped: emptySkips(), errors: [] };
  try {
    const inputs = await loadFollowupInputs(supabase, now);
    report.requests = inputs.requests.length;
    const selection = selectFollowups({ ...inputs, now });
    report.due = selection.due.length;
    report.skipped = selection.skipped;

    const max = opts.maxSends ?? 50;
    for (const c of selection.due.slice(0, max)) {
      try {
        const link = followupLink(c, baseUrl, now);
        const email = buildFollowupEmail(c, link);
        if (opts.dryRun) {
          console.log(`[Outcomes] follow-up dry run: day ${c.stage} to ${c.request.email} for request ${c.request.id}`);
          continue;
        }
        const res = await send({ to: c.request.email!.trim(), subject: email.subject, html: email.html, from: FOLLOWUP_FROM, replyTo: FOLLOWUP_REPLY_TO });
        if (!res.success) {
          report.errors.push(`send day ${c.stage} to request ${c.request.id}: ${res.error ?? 'unknown'}`);
          continue;
        }
        const { error } = await supabase
          .from('outcome_followups')
          .insert({ request_id: c.request.id, prediction_id: c.prediction.id, stage: c.stage, email: c.request.email!.trim(), sent_at: now.toISOString() });
        if (error) report.errors.push(`record day ${c.stage} for request ${c.request.id}: ${error.message}`);
        report.sent++;
        console.log(`[Outcomes] follow-up day ${c.stage} sent for request ${c.request.id} (prediction ${c.prediction.id}, ${c.daysSinceDelivery} d after delivery)`);
      } catch (e) {
        report.errors.push(`request ${c.request.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  } catch (e) {
    report.errors.push(e instanceof Error ? e.message : String(e));
    console.warn('[Outcomes] follow-ups failed:', e instanceof Error ? e.message : e);
  }
  return report;
}
