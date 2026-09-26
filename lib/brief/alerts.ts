/**
 * Deal Intelligence Brief — post-delivery alerts (Build B).
 *
 * A delivered brief commits the client to a recommendation, a buyer shortlist
 * and a catalyst window. While that decision is live the owner should hear,
 * by email, when the brief's world moves:
 *
 *   catalyst_approaching  a calendar event is 30 / 7 days out
 *   catalyst_passed       a calendar event was observed or is 3+ days past
 *   buyer_deal            a lead / tension buyer signed a new quality deal
 *   buyer_intent          a lead / tension buyer showed bullish partnering intent
 *   new_comp              a new quality deal in the asset's indication or mechanism
 *
 *   buildBriefWatch       — pure: what to watch, derived from the stored brief_json
 *   selectBriefAlerts     — pure: which items fire now, with stable dedupe keys
 *   buildBriefAlertEmail  — pure: one digest per request per run
 *   loadBriefAlertInputs  — one loader (requests, deals, signals, trials, companies)
 *   runBriefAlerts        — claim on brief_alerts.dedupe_key, send, mark, advance cursor
 *
 * Owners have no account: the request's email + brief_token are the identity.
 * Idempotent through `brief_alerts` (migration 134): the runner upserts each
 * item with ignoreDuplicates and only rows the run created reach an email.
 * Hosted after the radar run in /api/cron/radar-digest (13:00 UTC) and on
 * demand via /api/cron/outcome-resolve?briefAlerts=true.
 */

import { createHash } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email/client';
import { DELIVERED_STATUSES, SITE_URL, dataRoomUrl } from '@/lib/brief/delivery';
import { isSameIndication, isSameMechanism } from '@/lib/brief/comp-set';
import { FOLLOWUP_FROM, FOLLOWUP_REPLY_TO } from '@/lib/outcomes/followups';
import { buyerHit, normalizeCompanyName } from '@/lib/outcomes/matcher';
import { applyDealQualityFilter, fetchAllCompanies } from '@/lib/outcomes/resolver';
import { DEAL_CANDIDATE_COLUMNS, type CompanyAlias, type DealCandidateRow } from '@/lib/outcomes/types';
import { followMergedInto, type CompanyRow } from '@/lib/entities/resolve';
import { readSyncCursor, writeSyncCursor } from '@/lib/radar/sync-cursor';
import { signBriefAlertToken } from './alert-token';
import type { AssetProfile, BriefIntelligence, CatalystEvent } from './types';

export const BRIEF_ALERTS_CURSOR_SOURCE = 'brief_alerts';
/** Delivered briefs older than this are no longer watched. */
export const BRIEF_ALERTS_MAX_AGE_DAYS = 365;
/** First run without a cursor looks back this far for new deals / signals. */
export const BRIEF_ALERTS_INITIAL_LOOKBACK_DAYS = 7;
export const CATALYST_APPROACH_DAYS = [30, 7] as const;
export const CATALYST_PASSED_GRACE_DAYS = 3;
/** company_intent_signals.confidence is 0–100; the brief only relays confident bullish signals. */
export const INTENT_MIN_CONFIDENCE = 60;
export const INTENT_POLARITY = 'bullish';
export const MAX_REQUESTS = 300;
export const MAX_DEALS = 2000;
export const MAX_INTENT_SIGNALS = 500;
const DAY_MS = 86_400_000;
const IN_CHUNK = 200;

export type BriefAlertKind = 'catalyst_approaching' | 'catalyst_passed' | 'buyer_deal' | 'buyer_intent' | 'new_comp';

// ─── watch set (pure) ──────────────────────────────────────────────────────

export interface WatchedBuyer {
  name: string;
  companyId: string | null;
  role: 'lead' | 'tension';
}

export interface BriefWatch {
  asset: AssetProfile;
  catalysts: CatalystEvent[];
  window: { start: string; end: string; rationale: string } | null;
  buyers: WatchedBuyer[];
  /** deals.id of every row in the brief's comparable set. */
  compIds: string[];
  ask: { totalM: number; upfrontM: number } | null;
}

/** What a delivered brief commits the client to watch, derived from the stored BriefIntelligence. */
export function buildBriefWatch(brief: BriefIntelligence): BriefWatch {
  const calendar = brief.landscape?.catalysts ?? null;
  const byName = new Map<string, string | null>();
  for (const c of brief.buyerMap?.candidates ?? []) {
    const key = normalizeCompanyName(c.name);
    if (key && !byName.has(key)) byName.set(key, c.companyId ?? null);
  }
  const buyers: WatchedBuyer[] = [];
  const seen = new Set<string>();
  const add = (name: string | null | undefined, role: 'lead' | 'tension') => {
    const key = normalizeCompanyName(name);
    if (!key || seen.has(key)) return;
    seen.add(key);
    buyers.push({ name: String(name).trim(), companyId: byName.get(key) ?? null, role });
  };
  if (brief.buyerMap?.process) {
    brief.buyerMap.process.lead.forEach((n) => add(n, 'lead'));
    brief.buyerMap.process.tension.forEach((n) => add(n, 'tension'));
  } else {
    for (const c of brief.decision?.counterparties ?? []) if (c.role === 'lead' || c.role === 'tension') add(c.name, c.role);
  }
  const ask = brief.bridge?.ask ?? brief.decision?.ask ?? null;
  return {
    asset: brief.asset,
    catalysts: calendar?.events ?? [],
    window: calendar?.recommendedWindow ?? null,
    buyers,
    compIds: (brief.compSet?.rows ?? []).map((r) => r.id),
    ask: ask ? { totalM: ask.totalM, upfrontM: ask.upfrontM } : null,
  };
}

// ─── inputs ────────────────────────────────────────────────────────────────

export interface BriefAlertRequestRow {
  id: string;
  name: string | null;
  email: string | null;
  asset_name: string | null;
  indication: string | null;
  phase: string | null;
  brief_token: string | null;
  delivered_at: string | null;
  status: string | null;
  alerts_opt_out_at: string | null;
  brief_json: BriefIntelligence | null;
}

export const BRIEF_ALERT_REQUEST_COLUMNS = 'id,name,email,asset_name,indication,phase,brief_token,delivered_at,status,alerts_opt_out_at,brief_json';

/** The resolver's deal columns plus the two the mechanism match reads. */
export interface BriefAlertDealRow extends DealCandidateRow {
  target: string | null;
  mechanism_of_action: string | null;
}

export const BRIEF_ALERT_DEAL_COLUMNS = `${DEAL_CANDIDATE_COLUMNS},target,mechanism_of_action`;

export interface BriefAlertIntentRow {
  id: string;
  company_id: string;
  signal_type: string;
  polarity: string;
  quote: string;
  source_url: string | null;
  observed_at: string | null;
  confidence: number | null;
  fetched_at: string | null;
}

export interface BriefAlertTrialRow {
  nct_id: string;
  primary_completion_date: string | null;
  status: string | null;
}

export interface BriefAlertCatalystRow {
  nct_id: string | null;
  catalyst_type: string;
  expected_date: string;
  observed_date: string | null;
  source_url: string | null;
}

export interface BriefAlertInputs {
  requests: BriefAlertRequestRow[];
  /** Quality deals created since the cursor. */
  deals: BriefAlertDealRow[];
  /** Intent signals fetched since the cursor for watched companies (already polarity / confidence filtered by the loader, re-checked here). */
  intentSignals: BriefAlertIntentRow[];
  /** company_trials rows for watched NCT ids (live primary completion dates). */
  trials: BriefAlertTrialRow[];
  /** asset_catalysts rows for watched NCT ids. */
  catalysts: BriefAlertCatalystRow[];
  /** companies rows for alias expansion. */
  companies: CompanyAlias[];
  /** companies.id → canonical id, for ids that were folded into another row (merged_into). */
  mergedInto: Record<string, string>;
}

// ─── selection (pure) ──────────────────────────────────────────────────────

export interface BriefAlertItem {
  requestId: string;
  email: string;
  token: string | null;
  kind: BriefAlertKind;
  subjectKey: string;
  dedupeKey: string;
  payload: Record<string, unknown>;
}

export type BriefAlertSkipReason = 'not_delivered' | 'opted_out' | 'no_email' | 'no_brief';

export interface BriefAlertSelection {
  items: BriefAlertItem[];
  /** Requests that were watched (delivered, opted in, with a brief and an email). */
  watched: number;
  skipped: Record<BriefAlertSkipReason, number>;
}

function emptySkips(): Record<BriefAlertSkipReason, number> {
  return { not_delivered: 0, opted_out: 0, no_email: 0, no_brief: 0 };
}

const usdToM = (v: number | null | undefined): number | null =>
  v == null || !Number.isFinite(v) ? null : Math.round((v / 1_000_000) * 100) / 100;

/**
 * Catalyst dates may carry month precision ("2027-03"); those are read as the
 * 15th. Returns epoch ms at UTC midnight, or null when unparseable.
 */
export function catalystDateMs(date: string | null | undefined): number | null {
  const s = (date ?? '').trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}$/.test(s)) return Date.parse(`${s}-15T00:00:00Z`);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return Date.parse(`${s}T00:00:00Z`);
  const ms = Date.parse(s);
  return Number.isFinite(ms) ? ms : null;
}

/** Stable key for a catalyst: the NCT id, else a short hash of kind|title|date. */
export function catalystKey(ev: Pick<CatalystEvent, 'nctId' | 'kind' | 'title' | 'date'>): string {
  if (ev.nctId?.trim()) return ev.nctId.trim().toUpperCase();
  return createHash('sha1').update(`${ev.kind}|${ev.title}|${ev.date}`).digest('hex').slice(0, 10);
}

function canonicalId(id: string | null | undefined, mergedInto: Record<string, string>): string | null {
  if (!id) return null;
  let cur = id;
  for (let hop = 0; hop < 4; hop++) {
    const next = mergedInto[cur];
    if (!next || next === cur) break;
    cur = next;
  }
  return cur;
}

function isoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function selectBriefAlerts(inputs: BriefAlertInputs, now: Date): BriefAlertSelection {
  const skipped = emptySkips();
  const items: BriefAlertItem[] = [];
  let watched = 0;
  const nowMs = now.getTime();

  // Live trial dates by NCT id: when several rows disagree, the latest date wins (the trial is not done until it is).
  const trialDate = new Map<string, string>();
  for (const t of inputs.trials) {
    const nct = (t.nct_id ?? '').trim().toUpperCase();
    if (!nct || !t.primary_completion_date) continue;
    const prev = trialDate.get(nct);
    if (!prev || t.primary_completion_date > prev) trialDate.set(nct, t.primary_completion_date);
  }
  const observedByNct = new Map<string, BriefAlertCatalystRow>();
  for (const c of inputs.catalysts) {
    const nct = (c.nct_id ?? '').trim().toUpperCase();
    if (!nct || !c.observed_date) continue;
    const prev = observedByNct.get(nct);
    if (!prev || c.observed_date > (prev.observed_date ?? '')) observedByNct.set(nct, c);
  }

  for (const request of inputs.requests) {
    if (!request.status || !DELIVERED_STATUSES.has(request.status)) { skipped.not_delivered++; continue; }
    if (request.alerts_opt_out_at) { skipped.opted_out++; continue; }
    const email = request.email?.trim();
    if (!email) { skipped.no_email++; continue; }
    if (!request.brief_json || typeof request.brief_json !== 'object' || !request.brief_json.asset) { skipped.no_brief++; continue; }
    watched++;

    const watch = buildBriefWatch(request.brief_json);
    const deliveredMs = request.delivered_at ? Date.parse(request.delivered_at) : NaN;
    const base = { requestId: request.id, email, token: request.brief_token ?? null };
    const push = (kind: BriefAlertKind, subjectKey: string, dedupeKey: string, payload: Record<string, unknown>) =>
      items.push({ ...base, kind, subjectKey, dedupeKey, payload });

    // ── catalysts ──────────────────────────────────────────────────────
    for (const ev of watch.catalysts) {
      const key = catalystKey(ev);
      const nct = ev.nctId?.trim().toUpperCase() ?? null;
      const briefDateMs = catalystDateMs(ev.date);
      const liveDate = nct ? trialDate.get(nct) ?? null : null;
      const liveMs = liveDate ? catalystDateMs(liveDate) : null;
      const dateMs = liveMs ?? briefDateMs;
      if (dateMs == null) continue;
      const dateMoved = liveMs != null && briefDateMs != null && isoDate(liveMs) !== isoDate(briefDateMs);
      // A month-precision brief date is computed as the 15th but printed as the month.
      const datePrecision: 'day' | 'month' = liveMs == null && /^\d{4}-\d{2}$/.test(ev.date.trim()) ? 'month' : 'day';
      const common = {
        title: ev.title, kind: ev.kind, sponsor: ev.sponsor, phase: ev.phase, nctId: ev.nctId, impact: ev.impact, direction: ev.direction,
        isBuyerCandidate: ev.isBuyerCandidate, date: isoDate(dateMs), datePrecision, briefDate: ev.date, dateMoved,
        window: watch.window ? { start: watch.window.start, end: watch.window.end } : null,
      };
      const observed = nct ? observedByNct.get(nct) ?? null : null;
      const daysUntil = (dateMs - nowMs) / DAY_MS;

      if (observed || daysUntil < -CATALYST_PASSED_GRACE_DAYS) {
        // Only events that were still ahead when the brief was delivered.
        if (Number.isFinite(deliveredMs) && dateMs < deliveredMs) continue;
        push('catalyst_passed', key, `catalyst:${request.id}:${key}:passed`, {
          ...common, stage: 'passed', observedDate: observed?.observed_date ?? null, observedType: observed?.catalyst_type ?? null,
          observedSourceUrl: observed?.source_url ?? null, daysSince: Math.max(0, Math.floor(-daysUntil)),
        });
        continue;
      }
      if (daysUntil <= 0) continue;
      const stage = daysUntil <= CATALYST_APPROACH_DAYS[1] ? 't7' : daysUntil <= CATALYST_APPROACH_DAYS[0] ? 't30' : null;
      if (!stage) continue;
      push('catalyst_approaching', key, `catalyst:${request.id}:${key}:${stage}`, { ...common, stage, daysUntil: Math.ceil(daysUntil) });
    }

    // ── buyers ────────────────────────────────────────────────────────
    const watchedIds = new Map<string, WatchedBuyer>();
    for (const b of watch.buyers) {
      const id = canonicalId(b.companyId, inputs.mergedInto);
      if (id) watchedIds.set(id, b);
    }
    const buyerDealIds = new Set<string>();
    for (const deal of inputs.deals) {
      const licenseeId = canonicalId(deal.licensee_id, inputs.mergedInto);
      let hit: WatchedBuyer | null = licenseeId ? watchedIds.get(licenseeId) ?? null : null;
      if (!hit) {
        for (const b of watch.buyers) {
          if (buyerHit(deal.licensee_name, deal.licensee_id, [b.name], inputs.companies)) { hit = b; break; }
        }
      }
      if (!hit) continue;
      buyerDealIds.add(deal.id);
      push('buyer_deal', deal.id, `buyer_deal:${request.id}:${deal.id}`, {
        buyer: hit.name, role: hit.role, licensee: deal.licensee_name, licensor: deal.licensor_name, asset: deal.asset_name,
        announcedDate: deal.announced_date, phase: deal.phase_at_signing, dealType: deal.deal_type,
        indication: deal.indication_specific ?? deal.indication_category, therapeuticArea: deal.therapeutic_area,
        upfrontM: usdToM(deal.upfront_usd), totalM: usdToM(deal.total_deal_value_usd),
        sameIndication: isSameIndication(deal, watch.asset.indication), sameMechanism: isSameMechanism(deal, watch.asset),
      });
    }

    for (const s of inputs.intentSignals) {
      if (s.polarity !== INTENT_POLARITY || (s.confidence ?? 0) < INTENT_MIN_CONFIDENCE) continue;
      const b = watchedIds.get(canonicalId(s.company_id, inputs.mergedInto) ?? '');
      if (!b) continue;
      push('buyer_intent', s.id, `buyer_intent:${request.id}:${s.id}`, {
        buyer: b.name, role: b.role, signalType: s.signal_type, quote: s.quote, sourceUrl: s.source_url,
        observedAt: s.observed_at, confidence: s.confidence,
      });
    }

    // ── new comps ─────────────────────────────────────────────────────
    const compIds = new Set(watch.compIds);
    for (const deal of inputs.deals) {
      if (compIds.has(deal.id) || buyerDealIds.has(deal.id)) continue;
      const sameIndication = isSameIndication(deal, watch.asset.indication);
      const sameMechanism = isSameMechanism(deal, watch.asset);
      if (!sameIndication && !sameMechanism) continue;
      push('new_comp', deal.id, `new_comp:${request.id}:${deal.id}`, {
        licensor: deal.licensor_name, licensee: deal.licensee_name, asset: deal.asset_name, announcedDate: deal.announced_date,
        phase: deal.phase_at_signing, dealType: deal.deal_type, indication: deal.indication_specific ?? deal.indication_category,
        upfrontM: usdToM(deal.upfront_usd), totalM: usdToM(deal.total_deal_value_usd), sameIndication, sameMechanism,
      });
    }
  }
  return { items, watched, skipped };
}

// ─── email (pure) ──────────────────────────────────────────────────────────

function esc(s: unknown): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtM(v: unknown): string | null {
  if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) return null;
  return `$${v < 10 ? v.toFixed(1).replace(/\.0$/, '') : Math.round(v).toLocaleString('en-US')}M`;
}

/** "October 1, 2026"; a month-precision string ("2026-10") prints as "October 2026". */
function longDate(iso: unknown): string | null {
  if (typeof iso !== 'string') return null;
  const ms = catalystDateMs(iso);
  if (ms == null) return null;
  const monthOnly = /^\d{4}-\d{2}$/.test(iso.trim());
  return new Date(ms).toLocaleDateString('en-US', monthOnly ? { month: 'long', year: 'numeric', timeZone: 'UTC' } : { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

/** Catalyst payload date, honouring the stored precision. */
function catalystDateLabel(p: Record<string, unknown>): { text: string; preposition: 'on' | 'in' } {
  if (p.datePrecision === 'month' && typeof p.briefDate === 'string') return { text: longDate(p.briefDate) ?? p.briefDate, preposition: 'in' };
  return { text: longDate(p.date) ?? String(p.date), preposition: 'on' };
}

function firstName(name: string | null): string {
  const n = (name ?? '').trim().split(/\s+/)[0];
  return n || 'there';
}

function terms(p: Record<string, unknown>): string {
  const up = fmtM(p.upfrontM);
  const total = fmtM(p.totalM);
  if (up && total) return `${up} upfront, ${total} total`;
  if (up) return `${up} upfront`;
  if (total) return `${total} total`;
  return 'terms undisclosed';
}

const KIND_ORDER: Record<BriefAlertKind, number> = { catalyst_passed: 0, catalyst_approaching: 1, buyer_deal: 2, buyer_intent: 3, new_comp: 4 };

export function briefAlertAssetLabel(request: Pick<BriefAlertRequestRow, 'asset_name' | 'indication' | 'phase' | 'brief_json'>): string {
  const fromBrief = request.brief_json?.asset?.assetName?.trim();
  if (fromBrief) return fromBrief;
  const fromRow = request.asset_name?.trim();
  if (fromRow) return fromRow;
  const parts = [request.brief_json?.asset?.indicationLabel?.trim() || request.indication?.trim(), request.phase?.trim()].filter((s): s is string => !!s);
  return parts.length ? parts.join(', ') : 'Your asset';
}

/** One paragraph per item: what changed, then why it matters for the decision. Returns {lead, body}. */
export function briefAlertParagraph(item: BriefAlertItem, watch: BriefWatch | null): { lead: string; body: string } {
  const p = item.payload;
  const ask = watch?.ask ? fmtM(watch.ask.upfrontM) : null;
  const askClause = ask ? ` The brief's ask of ${ask} upfront was set against the comparable set as it stood at delivery;` : ' The ask in the brief was set against the comparable set as it stood at delivery;';
  const window = watch?.window ? `${longDate(watch.window.start) ?? watch.window.start} to ${longDate(watch.window.end) ?? watch.window.end}` : null;
  const buyerRole = (role: unknown) => (role === 'lead' ? 'a lead buyer' : 'a tension buyer');

  switch (item.kind) {
    case 'catalyst_approaching': {
      const when = p.stage === 't7' ? 'within a week' : 'within 30 days';
      const { text: date, preposition } = catalystDateLabel(p);
      const moved = p.dateMoved ? ` (the registry now shows ${date}; the brief printed ${longDate(p.briefDate) ?? String(p.briefDate)})` : '';
      const lead = `Catalyst ${when}: ${String(p.title)}`;
      let body = `${String(p.sponsor ?? 'The sponsor')}${p.isBuyerCandidate ? ', a buyer on your map,' : ''} is expected to reach this ${preposition} ${date}${moved}.`;
      if (p.impact) body += ` ${String(p.impact)}`;
      if (p.direction === 'up') body += ' A positive result reprices the asset up; the brief recommended being in the room before it lands.';
      else if (p.direction === 'down') body += ' A negative result reprices the asset down; if you are in a process, close the open items before this date.';
      else body += ' Either outcome changes the buyer conversation; make sure your counterparties are engaged before it lands.';
      if (window) body += ` Recommended go-to-market window: ${window}.`;
      return { lead, body };
    }
    case 'catalyst_passed': {
      const lead = `Catalyst passed: ${String(p.title)}`;
      const expected = catalystDateLabel(p);
      let body = p.observedDate
        ? `Observed on ${longDate(p.observedDate) ?? String(p.observedDate)}${p.observedType ? ` (${String(p.observedType).replace(/_/g, ' ')})` : ''}.`
        : `The expected date (${expected.text}) is behind us with no readout on record.`;
      if (p.impact) body += ` ${String(p.impact)}`;
      body += p.observedDate
        ? ' Check the result against the brief\'s "what would change our view" list; if it moved the number, the ask should move with it.'
        : ' A slipped readout usually means the sponsor is still blind; the pricing tension the brief counted on is delayed, not gone.';
      return { lead, body };
    }
    case 'buyer_deal': {
      const lead = `${String(p.buyer)} signed a new deal`;
      const withWhom = p.licensor ? ` with ${String(p.licensor)}` : '';
      const what = p.asset ? ` for ${String(p.asset)}` : '';
      const where = p.indication ? ` in ${String(p.indication)}` : '';
      let body = `${String(p.buyer)}, ${buyerRole(p.role)} in the brief, announced a ${p.phase ? `${String(p.phase).replace(/_/g, ' ')} ` : ''}${p.dealType ? String(p.dealType).replace(/_/g, ' ') : 'deal'}${withWhom}${what}${where}${p.announcedDate ? ` on ${longDate(p.announcedDate) ?? String(p.announcedDate)}` : ''}: ${terms(p)}.`;
      if (p.sameIndication) body += ' It is in your indication, so it is both a fresh comparable and a signal that the buyer may now be filled in this slot; test that in the next conversation before assuming the door is open.';
      else if (p.sameMechanism) body += ' It is in your mechanism class, which tells you what they pay for the biology; the terms are a live reference for your ask.';
      else body += ' It is outside your indication, so read it as appetite and cadence rather than a comparable; the buyer is transacting.';
      return { lead, body };
    }
    case 'buyer_intent': {
      const lead = `${String(p.buyer)} signalled partnering intent`;
      const kind = String(p.signalType ?? '').replace(/_/g, ' ');
      let body = `${String(p.buyer)}, ${buyerRole(p.role)} in the brief, ${kind ? `posted a ${kind} signal` : 'posted a signal'}${p.observedAt ? ` on ${longDate(p.observedAt) ?? String(p.observedAt)}` : ''}: "${String(p.quote)}".`;
      body += ' Stated intent moves a buyer from the tension column toward a live counterparty; it is a reason to open, or to re-open, now.';
      return { lead, body };
    }
    case 'new_comp': {
      const parties = [p.licensor, p.licensee].filter(Boolean).map(String).join(' / ') || 'A new deal';
      const lead = `New comparable: ${parties}`;
      let body = `${parties}${p.asset ? ` (${String(p.asset)})` : ''} announced a ${p.phase ? `${String(p.phase).replace(/_/g, ' ')} ` : ''}${p.dealType ? String(p.dealType).replace(/_/g, ' ') : 'deal'}${p.indication ? ` in ${String(p.indication)}` : ''}${p.announcedDate ? ` on ${longDate(p.announcedDate) ?? String(p.announcedDate)}` : ''}: ${terms(p)}.`;
      body += p.sameIndication ? ` It is in your indication and was not in the brief's comparable set.${askClause} this row belongs in the next version.` : ` It shares your mechanism and was not in the brief's comparable set.${askClause} this row belongs in the next version.`;
      return { lead, body };
    }
  }
}

export interface BriefAlertEmail {
  subject: string;
  html: string;
}

export function briefAlertSubject(assetLabel: string, n: number): string {
  return `${assetLabel} — ${n} ${n === 1 ? 'update' : 'updates'} on your Deal Intelligence Brief`;
}

/** One digest per request per run: a short paragraph per item, the data-room link, a signed opt-out link. */
export function buildBriefAlertEmail(
  request: BriefAlertRequestRow,
  items: BriefAlertItem[],
  links: { dataRoomUrl: string | null; optOutUrl: string },
): BriefAlertEmail {
  const watch = request.brief_json ? buildBriefWatch(request.brief_json) : null;
  const label = briefAlertAssetLabel(request);
  const sorted = [...items].sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
  const para = (s: string) => `<p style="font-size:15px;line-height:1.6;color:#1e293b;margin:0 0 16px;">${s}</p>`;
  const blocks = sorted.map((it) => {
    const { lead, body } = briefAlertParagraph(it, watch);
    return para(`<strong>${esc(lead)}.</strong> ${esc(body)}`);
  });
  const intro = `Hi ${esc(firstName(request.name))},`;
  const opener = `${sorted.length === 1 ? 'One thing' : `${sorted.length} things`} moved on the brief for ${esc(label)} since we delivered it${request.delivered_at && longDate(request.delivered_at) ? ` on ${esc(longDate(request.delivered_at))}` : ''}.`;
  const room = links.dataRoomUrl
    ? para(`The brief itself is in your data room: <a href="${esc(links.dataRoomUrl)}" style="color:#0f766e;">${esc(links.dataRoomUrl)}</a>. Reply to this email if any of the above changes what you want to do with it.`)
    : para('Reply to this email if any of the above changes what you want to do with the brief.');
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
${para(intro)}
${para(opener)}
${blocks.join('\n')}
${room}
<p style="font-size:14px;line-height:1.5;color:#1e293b;margin:24px 0 0;">Best,<br>Issa Kildani<br><span style="color:#64748b;">Managing Partner, Ambrosia Ventures</span></p>
<p style="font-size:12px;line-height:1.5;color:#94a3b8;margin:32px 0 0;">You receive these because a Deal Intelligence Brief was delivered to this address. <a href="${esc(links.optOutUrl)}" style="color:#94a3b8;">Stop these updates</a>.</p>
</body></html>`;
  return { subject: briefAlertSubject(label, sorted.length), html };
}

export function briefAlertLinks(request: Pick<BriefAlertRequestRow, 'id' | 'brief_token'>, baseUrl: string, now: Date): { dataRoomUrl: string | null; optOutUrl: string } {
  const token = signBriefAlertToken({ requestId: request.id }, { now });
  return {
    dataRoomUrl: request.brief_token ? dataRoomUrl(request.brief_token) : null,
    optOutUrl: `${baseUrl.replace(/\/$/, '')}/api/brief/alerts/opt-out?token=${encodeURIComponent(token)}`,
  };
}

// ─── loader ────────────────────────────────────────────────────────────────

function chunks<T>(arr: T[], size = IN_CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function loadMergedInto(supabase: SupabaseClient, ids: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  if (!ids.length) return out;
  const merged: string[] = [];
  for (const chunk of chunks(ids)) {
    // Before migration 127 the column does not exist; that error means "no merges".
    const { data, error } = await supabase.from('companies').select('id,merged_into').in('id', chunk);
    if (error) return out;
    for (const row of (data ?? []) as Array<{ id: string; merged_into: string | null }>) {
      if (row.merged_into && row.merged_into !== row.id) merged.push(row.id);
    }
  }
  for (const id of merged) {
    const canonical = await followMergedInto(supabase, { id } as CompanyRow);
    if (canonical && canonical.id !== id) out[id] = canonical.id;
  }
  return out;
}

export async function loadBriefAlertInputs(supabase: SupabaseClient, opts: { since: string; now: Date }): Promise<BriefAlertInputs> {
  const { since, now } = opts;
  const deliveredFrom = new Date(now.getTime() - BRIEF_ALERTS_MAX_AGE_DAYS * DAY_MS).toISOString();
  const { data: reqData, error: reqErr } = await supabase
    .from('benchmark_requests')
    .select(BRIEF_ALERT_REQUEST_COLUMNS)
    .in('status', [...DELIVERED_STATUSES])
    .gte('delivered_at', deliveredFrom)
    .is('alerts_opt_out_at', null)
    .not('brief_json', 'is', null)
    .order('delivered_at', { ascending: false })
    .limit(MAX_REQUESTS);
  if (reqErr) throw new Error(`benchmark_requests: ${reqErr.message}`);
  const requests = (reqData ?? []) as unknown as BriefAlertRequestRow[];
  const empty: BriefAlertInputs = { requests, deals: [], intentSignals: [], trials: [], catalysts: [], companies: [], mergedInto: {} };
  if (!requests.length) return empty;

  const companyIds = new Set<string>();
  const nctIds = new Set<string>();
  for (const r of requests) {
    if (!r.brief_json || typeof r.brief_json !== 'object' || !r.brief_json.asset) continue;
    const w = buildBriefWatch(r.brief_json);
    for (const b of w.buyers) if (b.companyId) companyIds.add(b.companyId);
    for (const ev of w.catalysts) if (ev.nctId?.trim()) nctIds.add(ev.nctId.trim().toUpperCase());
  }

  const { data: dealData, error: dealErr } = await applyDealQualityFilter(
    supabase
      .from('deals')
      .select(BRIEF_ALERT_DEAL_COLUMNS),
  )
    // Same confidence gate as the brief's comp set: verified, or awaiting review with confidence >= 75.
    .or('verification_status.eq.verified,confidence_score.is.null,confidence_score.gte.75')
    .gte('created_at', since)
    .order('created_at', { ascending: true })
    .limit(MAX_DEALS);
  if (dealErr) throw new Error(`deals: ${dealErr.message}`);
  const deals = (dealData ?? []) as unknown as BriefAlertDealRow[];

  const companies = await fetchAllCompanies(supabase);

  const mergeIds = new Set<string>(companyIds);
  for (const d of deals) if (d.licensee_id) mergeIds.add(d.licensee_id);
  const mergedInto = await loadMergedInto(supabase, [...mergeIds]);

  // Signals may sit on the canonical row of a merged buyer, so look up both ids.
  const signalCompanyIds = new Set<string>(companyIds);
  for (const id of companyIds) { const c = canonicalId(id, mergedInto); if (c) signalCompanyIds.add(c); }
  let intentSignals: BriefAlertIntentRow[] = [];
  if (signalCompanyIds.size) {
    for (const chunk of chunks([...signalCompanyIds])) {
      const { data, error } = await supabase
        .from('company_intent_signals')
        .select('id,company_id,signal_type,polarity,quote,source_url,observed_at,confidence,fetched_at')
        .in('company_id', chunk)
        .eq('polarity', INTENT_POLARITY)
        .gte('confidence', INTENT_MIN_CONFIDENCE)
        .gte('fetched_at', since)
        .order('fetched_at', { ascending: true })
        .limit(MAX_INTENT_SIGNALS);
      if (error) throw new Error(`company_intent_signals: ${error.message}`);
      intentSignals = intentSignals.concat((data ?? []) as BriefAlertIntentRow[]);
    }
  }

  let trials: BriefAlertTrialRow[] = [];
  let catalysts: BriefAlertCatalystRow[] = [];
  if (nctIds.size) {
    for (const chunk of chunks([...nctIds])) {
      const { data: tData, error: tErr } = await supabase
        .from('company_trials')
        .select('nct_id,primary_completion_date,status')
        .in('nct_id', chunk);
      if (tErr) throw new Error(`company_trials: ${tErr.message}`);
      trials = trials.concat((tData ?? []) as BriefAlertTrialRow[]);

      const { data: cData, error: cErr } = await supabase
        .from('asset_catalysts')
        .select('nct_id,catalyst_type,expected_date,observed_date,source_url')
        .in('nct_id', chunk)
        .not('observed_date', 'is', null);
      if (cErr) throw new Error(`asset_catalysts: ${cErr.message}`);
      catalysts = catalysts.concat((cData ?? []) as BriefAlertCatalystRow[]);
    }
  }

  return { requests, deals, intentSignals, trials, catalysts, companies, mergedInto };
}

// ─── runner ────────────────────────────────────────────────────────────────

export type BriefAlertSender = (opts: { to: string; subject: string; html: string; from: string; replyTo: string }) => Promise<{ success: boolean; error?: string }>;

export interface BriefAlertRunOptions {
  now?: Date;
  baseUrl?: string;
  /** Injected in tests; defaults to lib/email/client sendEmail. */
  send?: BriefAlertSender;
  /** Select and log, send nothing, write nothing. */
  dryRun?: boolean;
  /** Max digests (one per request) per run. */
  maxSends?: number;
  /** Wall-clock epoch ms after which no further request is processed. */
  deadline?: number;
}

export interface BriefAlertRunReport {
  requests: number;
  watched: number;
  /** Items selected by the rules this run (before the ledger). */
  items: number;
  /** Items the ledger had not seen (rows created). */
  claimed: number;
  duplicates: number;
  /** Digests sent (one per request). */
  sent: number;
  failed: number;
  skipped: Record<BriefAlertSkipReason, number>;
  errors: string[];
  timedOut: boolean;
  dryRun: boolean;
  cursorFrom: string | null;
  cursorTo: string | null;
}

interface LedgerRow { id: string; dedupe_key: string }

export async function runBriefAlerts(supabase: SupabaseClient, opts: BriefAlertRunOptions = {}): Promise<BriefAlertRunReport> {
  const now = opts.now ?? new Date();
  const baseUrl = opts.baseUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? SITE_URL;
  const send: BriefAlertSender = opts.send ?? ((o) => sendEmail(o));
  const maxSends = opts.maxSends ?? 50;
  const outOfTime = () => opts.deadline != null && Date.now() > opts.deadline;
  const report: BriefAlertRunReport = {
    requests: 0, watched: 0, items: 0, claimed: 0, duplicates: 0, sent: 0, failed: 0,
    skipped: emptySkips(), errors: [], timedOut: false, dryRun: !!opts.dryRun, cursorFrom: null, cursorTo: null,
  };

  try {
    const cursor = await readSyncCursor(supabase, BRIEF_ALERTS_CURSOR_SOURCE);
    const since = cursor.cursor && Number.isFinite(Date.parse(cursor.cursor))
      ? cursor.cursor
      : new Date(now.getTime() - BRIEF_ALERTS_INITIAL_LOOKBACK_DAYS * DAY_MS).toISOString();
    report.cursorFrom = since;

    const inputs = await loadBriefAlertInputs(supabase, { since, now });
    report.requests = inputs.requests.length;
    const selection = selectBriefAlerts(inputs, now);
    report.watched = selection.watched;
    report.items = selection.items.length;
    report.skipped = selection.skipped;

    let maxSeen = since;
    for (const d of inputs.deals) if (d.created_at && d.created_at > maxSeen) maxSeen = d.created_at;
    for (const s of inputs.intentSignals) if (s.fetched_at && s.fetched_at > maxSeen) maxSeen = s.fetched_at;

    if (opts.dryRun) {
      const byRequest = new Map<string, number>();
      for (const it of selection.items) byRequest.set(it.requestId, (byRequest.get(it.requestId) ?? 0) + 1);
      for (const [rid, n] of byRequest) console.log(`[BriefAlerts] dry run: ${n} item(s) for request ${rid}`);
      report.cursorTo = since;
      return report;
    }

    // Claim per request, then send one digest for the rows this run created.
    const byRequest = new Map<string, BriefAlertItem[]>();
    for (const it of selection.items) {
      const list = byRequest.get(it.requestId) ?? [];
      list.push(it);
      byRequest.set(it.requestId, list);
    }
    const requestsById = new Map(inputs.requests.map((r) => [r.id, r]));
    let complete = true;

    for (const [requestId, items] of byRequest) {
      if (outOfTime()) { report.timedOut = true; complete = false; break; }
      if (report.sent >= maxSends) { complete = false; break; }
      const request = requestsById.get(requestId);
      if (!request) continue;
      try {
        const rows = items.map((it) => ({
          request_id: it.requestId, kind: it.kind, subject_key: it.subjectKey, dedupe_key: it.dedupeKey,
          email: it.email, payload: it.payload, delivery_status: 'queued',
        }));
        const { data, error } = await supabase
          .from('brief_alerts')
          .upsert(rows, { onConflict: 'dedupe_key', ignoreDuplicates: true })
          .select('id,dedupe_key');
        if (error) { report.errors.push(`claim request ${requestId}: ${error.message}`); continue; }
        const created = (data ?? []) as LedgerRow[];
        report.claimed += created.length;
        report.duplicates += items.length - created.length;
        if (!created.length) continue;

        const createdKeys = new Set(created.map((r) => r.dedupe_key));
        const fresh = items.filter((it) => createdKeys.has(it.dedupeKey));
        const ids = created.map((r) => r.id);
        const email = buildBriefAlertEmail(request, fresh, briefAlertLinks(request, baseUrl, now));
        const res = await send({ to: fresh[0].email, subject: email.subject, html: email.html, from: FOLLOWUP_FROM, replyTo: FOLLOWUP_REPLY_TO });
        const status = res.success ? 'sent' : 'failed';
        const { error: markErr } = await supabase
          .from('brief_alerts')
          .update({ delivery_status: status, sent_at: res.success ? now.toISOString() : null })
          .in('id', ids);
        if (markErr) report.errors.push(`mark request ${requestId}: ${markErr.message}`);
        if (res.success) {
          report.sent++;
          console.log(`[BriefAlerts] digest sent for request ${requestId}: ${fresh.length} item(s) (${fresh.map((f) => f.kind).join(', ')})`);
        } else {
          report.failed++;
          report.errors.push(`send request ${requestId}: ${res.error ?? 'unknown'}`);
        }
      } catch (e) {
        report.errors.push(`request ${requestId}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // Advance only after a clean, complete run so a failed, capped or timed-out request is re-scanned next time.
    if (complete && !report.errors.length && !report.timedOut) {
      if (maxSeen !== since) {
        await writeSyncCursor(supabase, BRIEF_ALERTS_CURSOR_SOURCE, maxSeen, {
          last_run_at: now.toISOString(), requests: report.requests, items: report.items, sent: report.sent,
        });
      }
      report.cursorTo = maxSeen;
    } else {
      report.cursorTo = since;
    }
  } catch (e) {
    report.errors.push(e instanceof Error ? e.message : String(e));
    console.warn('[BriefAlerts] run failed:', e instanceof Error ? e.message : e);
  }
  return report;
}
