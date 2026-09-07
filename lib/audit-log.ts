/**
 * Enterprise Audit Logging
 *
 * Two tables, two purposes:
 *
 *  - audit_log (migration 060): generic admin / configuration actions
 *    (member invited, SSO registered, settings changed). Written via
 *    logAuditEvent() below — unchanged.
 *
 *  - audit_events (migration 100): the per-estimate trail an enterprise
 *    buyer asks for — who ran / viewed / exported / shared which calculation
 *    and when. Written via recordAuditEvent(), which is typed, resolves the
 *    caller's team automatically, hashes the IP and NEVER throws.
 *
 * Both are fire-and-forget: audit failures must not break the main flow.
 */

import { createHash } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';

// ─── Legacy admin-action log (audit_log) ────────────────────────────────────

export interface AuditEvent {
  team_id?: string | null;
  user_id?: string | null;
  user_email?: string | null;
  action: string;
  resource: string;
  resource_id?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  details?: Record<string, unknown>;
  status?: 'success' | 'failure' | 'denied';
}

/**
 * Log an audit event to the audit_log table.
 * Non-blocking — fires and forgets to avoid slowing down the request.
 */
export async function logAuditEvent(
  supabase: SupabaseClient,
  event: AuditEvent
): Promise<void> {
  try {
    await supabase.from('audit_log').insert({
      team_id: event.team_id || null,
      user_id: event.user_id || null,
      user_email: event.user_email || null,
      action: event.action,
      resource: event.resource,
      resource_id: event.resource_id || null,
      ip_address: event.ip_address || null,
      user_agent: event.user_agent || null,
      details: event.details || {},
      status: event.status || 'success',
    });
  } catch {
    // Audit logging should never break the main flow
    console.error('[audit] Failed to log event:', event.action, event.resource);
  }
}

/**
 * Extract audit context from a NextRequest.
 */
export function getAuditContext(request: NextRequest): {
  ip_address: string | null;
  user_agent: string | null;
} {
  return {
    ip_address: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || null,
    user_agent: request.headers.get('user-agent')?.substring(0, 256) || null,
  };
}

// ─── Per-estimate audit trail (audit_events) ────────────────────────────────

/** Must stay in sync with the CHECK constraint in migration 100. */
export const AUDIT_EVENT_TYPES = [
  'calculation_created',
  'calculation_viewed',
  'history_viewed',
  'results_exported',
  'results_shared',
  'share_viewed',
  'report_purchased',
  'team_history_viewed',
  'audit_exported',
] as const;
export type AuditEventType = (typeof AUDIT_EVENT_TYPES)[number];

/** Must stay in sync with the CHECK constraint in migration 100. */
export const AUDIT_RESOURCE_TYPES = ['calculation', 'share', 'report', 'history', 'audit'] as const;
export type AuditResourceType = (typeof AUDIT_RESOURCE_TYPES)[number];

/**
 * Event types a browser is allowed to report through POST /api/audit.
 * Server-originated events (calculation_created, report_purchased, ...) are
 * emitted by their own routes and are rejected if a client tries to send them.
 */
export const CLIENT_REPORTABLE_EVENT_TYPES = [
  'results_exported',
  'results_shared',
  'calculation_viewed',
] as const satisfies readonly AuditEventType[];

export interface RecordAuditEventInput {
  event_type: AuditEventType;
  resource_type: AuditResourceType;
  /** Authenticated user. Anonymous activity is not audited (returns ok:false, reason:'no_user'). */
  user_id: string | null | undefined;
  /** Optional: skip the team lookup when the caller already knows it. */
  team_id?: string | null;
  resource_id?: string | null;
  calculation_fingerprint?: string | null;
  metadata?: Record<string, unknown> | null;
  /** Either pass the request (IP is hashed, UA truncated) ... */
  request?: NextRequest | Request | null;
  /** ... or pre-computed context. `request` wins when both are given. */
  ip_hash?: string | null;
  user_agent?: string | null;
  /** Inject a client (tests). Defaults to the service-role client. */
  supabase?: SupabaseClient;
}

export type RecordAuditEventResult =
  | { ok: true; id: string | null; team_id: string | null }
  | { ok: false; reason: string };

const MAX_METADATA_BYTES = 8 * 1024; // mirrors audit_events_metadata_size_check
const MAX_USER_AGENT = 256;

/**
 * Salted SHA-256 of a client IP. Raw IPs are never persisted to audit_events.
 * Salt comes from AUDIT_IP_HASH_SALT; falls back to the Supabase URL so hashes
 * are still stable per deployment when the salt is unset (logged once).
 */
let warnedNoSalt = false;
export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  let salt = process.env.AUDIT_IP_HASH_SALT;
  if (!salt) {
    salt = process.env.NEXT_PUBLIC_SUPABASE_URL || 'solidus-audit';
    if (!warnedNoSalt && process.env.NODE_ENV === 'production') {
      warnedNoSalt = true;
      console.warn('[audit] AUDIT_IP_HASH_SALT is not set; falling back to a deployment-stable salt.');
    }
  }
  return createHash('sha256').update(`${salt}|${ip.trim()}`).digest('hex');
}

/** Hashed IP + truncated UA from a request. Safe on any Request-like object. */
export function getAuditRequestContext(request: NextRequest | Request | null | undefined): {
  ip_hash: string | null;
  user_agent: string | null;
} {
  try {
    if (!request) return { ip_hash: null, user_agent: null };
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || null;
    return {
      ip_hash: hashIp(ip),
      user_agent: request.headers.get('user-agent')?.substring(0, MAX_USER_AGENT) || null,
    };
  } catch {
    return { ip_hash: null, user_agent: null };
  }
}

/** Keep metadata JSON-safe and under the DB size cap; drops it (never throws) when too big. */
function safeMetadata(metadata: Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (!metadata || typeof metadata !== 'object') return {};
  try {
    const cleaned = JSON.parse(JSON.stringify(metadata, (_k, v) =>
      typeof v === 'number' && !Number.isFinite(v) ? null : v
    )) as Record<string, unknown>;
    if (Buffer.byteLength(JSON.stringify(cleaned), 'utf8') > MAX_METADATA_BYTES) {
      return { _truncated: true };
    }
    return cleaned;
  } catch {
    return {};
  }
}

/** Active team for a user (team_members is canonical; user_profiles.team_id is a denormalised copy). */
export async function resolveUserTeamId(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  try {
    const { data } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', userId)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();
    return (data as { team_id?: string } | null)?.team_id || null;
  } catch {
    return null;
  }
}

/**
 * Record a typed audit event to audit_events. Never throws and never rejects:
 * every failure path resolves to { ok: false, reason }.
 *
 * Usage (server route):
 *   void recordAuditEvent({ event_type: 'calculation_created', resource_type: 'calculation',
 *     user_id, resource_id: calcId, calculation_fingerprint, metadata, request });
 */
export async function recordAuditEvent(input: RecordAuditEventInput): Promise<RecordAuditEventResult> {
  try {
    if (!input || typeof input !== 'object') return { ok: false, reason: 'invalid_input' };
    if (!(AUDIT_EVENT_TYPES as readonly string[]).includes(input.event_type)) {
      return { ok: false, reason: 'invalid_event_type' };
    }
    if (!(AUDIT_RESOURCE_TYPES as readonly string[]).includes(input.resource_type)) {
      return { ok: false, reason: 'invalid_resource_type' };
    }
    if (!input.user_id) return { ok: false, reason: 'no_user' };

    let supabase = input.supabase;
    if (!supabase) {
      const { createServiceClient } = await import('@/lib/supabase/server');
      supabase = createServiceClient();
    }

    const teamId = input.team_id !== undefined
      ? (input.team_id || null)
      : await resolveUserTeamId(supabase, input.user_id);

    const ctx = input.request
      ? getAuditRequestContext(input.request)
      : { ip_hash: input.ip_hash || null, user_agent: input.user_agent?.substring(0, MAX_USER_AGENT) || null };

    const row = {
      team_id: teamId,
      user_id: input.user_id,
      event_type: input.event_type,
      resource_type: input.resource_type,
      resource_id: input.resource_id ? String(input.resource_id).substring(0, 200) : null,
      calculation_fingerprint: input.calculation_fingerprint
        ? String(input.calculation_fingerprint).substring(0, 64)
        : null,
      metadata: safeMetadata(input.metadata),
      ip_hash: ctx.ip_hash,
      user_agent: ctx.user_agent,
    };

    const { data, error } = await supabase
      .from('audit_events')
      .insert(row)
      .select('id')
      .single();

    if (error) {
      console.error('[audit] audit_events insert failed:', input.event_type, error.message);
      return { ok: false, reason: 'insert_failed' };
    }
    return { ok: true, id: (data as { id?: string } | null)?.id || null, team_id: teamId };
  } catch (err) {
    console.error('[audit] recordAuditEvent threw:', err instanceof Error ? err.message : err);
    return { ok: false, reason: 'exception' };
  }
}
