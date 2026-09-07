import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireTeamAdmin } from '@/lib/portfolio/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { clampInt } from '@/lib/api-validation';
import { captureApiError } from '@/lib/sentry-api';
import { recordAuditEvent, AUDIT_EVENT_TYPES, type AuditEventType } from '@/lib/audit-log';

export const dynamic = 'force-dynamic';

/**
 * GET /api/portfolio/audit — team audit trail (team admins only).
 *
 * Query params:
 *   source      'events' (default; audit_events — estimates trail)
 *               | 'admin' (legacy audit_log — member/SSO/settings actions)
 *   user_id     filter to one member
 *   event_type  one of AUDIT_EVENT_TYPES (events) or free-text action (admin)
 *   from, to    ISO timestamps (inclusive from, exclusive to)
 *   limit       1..500 (default 100)
 *   before      ISO created_at cursor for keyset pagination (older than)
 *   format      'json' (default) | 'csv'
 *
 * Membership is checked explicitly (service role bypasses RLS).
 */

const CSV_MAX_ROWS = 5000;

interface EventRow {
  id: string;
  user_id: string | null;
  event_type: string;
  resource_type: string;
  resource_id: string | null;
  calculation_fingerprint: string | null;
  metadata: Record<string, unknown> | null;
  ip_hash: string | null;
  user_agent: string | null;
  created_at: string;
}

interface AdminRow {
  id: string;
  user_id: string | null;
  user_email: string | null;
  action: string;
  resource: string;
  resource_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  details: Record<string, unknown> | null;
  status: string | null;
  created_at: string;
}

// Not exported: Next.js route modules may only export handlers/config.
interface TeamAuditEntry {
  id: string;
  created_at: string;
  user_id: string | null;
  user_email: string | null;
  user_name: string | null;
  event_type: string;
  resource_type: string;
  resource_id: string | null;
  calculation_fingerprint: string | null;
  metadata: Record<string, unknown>;
  ip_hash: string | null;
  user_agent: string | null;
  status: string | null;
  source: 'events' | 'admin';
}

function parseIsoDate(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = typeof value === 'string' ? value : JSON.stringify(value);
  // Neutralise spreadsheet formula injection, then quote.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

function toCsv(entries: TeamAuditEntry[]): string {
  const header = [
    'timestamp', 'user_email', 'user_name', 'event_type', 'resource_type', 'resource_id',
    'calculation_fingerprint', 'status', 'ip_hash', 'user_agent', 'metadata',
  ];
  const lines = entries.map((e) => [
    e.created_at, e.user_email, e.user_name, e.event_type, e.resource_type, e.resource_id,
    e.calculation_fingerprint, e.status, e.ip_hash, e.user_agent, e.metadata,
  ].map(csvCell).join(','));
  return [header.join(','), ...lines].join('\r\n') + '\r\n';
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireTeamAdmin(request);
    if ('error' in auth) return auth.error;
    const { user, teamId } = auth;

    const { searchParams } = new URL(request.url);
    const source = searchParams.get('source') === 'admin' ? 'admin' : 'events';
    const format = searchParams.get('format') === 'csv' ? 'csv' : 'json';
    const filterUserId = searchParams.get('user_id');
    const filterType = searchParams.get('event_type');
    const from = parseIsoDate(searchParams.get('from'));
    const to = parseIsoDate(searchParams.get('to'));
    const before = parseIsoDate(searchParams.get('before'));
    const limit = format === 'csv'
      ? CSV_MAX_ROWS
      : clampInt(searchParams.get('limit'), 1, 500, 100);

    if (filterType && source === 'events' && !(AUDIT_EVENT_TYPES as readonly string[]).includes(filterType)) {
      return apiError('Invalid event_type', 400);
    }
    if (searchParams.get('from') && !from) return apiError('Invalid from date', 400);
    if (searchParams.get('to') && !to) return apiError('Invalid to date', 400);

    const supabase = createServiceClient();

    // Member directory for email/name enrichment (all statuses so departed
    // members still resolve on historical rows).
    const { data: members } = await supabase
      .from('team_members')
      .select('user_id, role, status')
      .eq('team_id', teamId);
    const memberIds = ((members || []) as Array<{ user_id: string }>).map((m) => m.user_id);

    if (filterUserId && !memberIds.includes(filterUserId)) {
      return apiError('user_id is not a member of this team', 400);
    }

    const { data: profiles } = memberIds.length
      ? await supabase.from('user_profiles').select('id, email, full_name').in('id', memberIds)
      : { data: [] as Array<{ id: string; email: string | null; full_name: string | null }> };
    const profileMap = new Map(
      ((profiles || []) as Array<{ id: string; email: string | null; full_name: string | null }>)
        .map((p) => [p.id, p])
    );

    let entries: TeamAuditEntry[] = [];

    if (source === 'events') {
      let q = supabase
        .from('audit_events')
        .select('id, user_id, event_type, resource_type, resource_id, calculation_fingerprint, metadata, ip_hash, user_agent, created_at')
        .eq('team_id', teamId)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (filterUserId) q = q.eq('user_id', filterUserId);
      if (filterType) q = q.eq('event_type', filterType as AuditEventType);
      if (from) q = q.gte('created_at', from);
      if (to) q = q.lt('created_at', to);
      if (before) q = q.lt('created_at', before);

      const { data, error } = await q;
      if (error) {
        console.error('[portfolio/audit] audit_events query failed:', error.message);
        return apiError('Failed to fetch audit events', 500);
      }
      entries = ((data || []) as EventRow[]).map((r) => {
        const p = r.user_id ? profileMap.get(r.user_id) : undefined;
        return {
          id: r.id,
          created_at: r.created_at,
          user_id: r.user_id,
          user_email: p?.email || null,
          user_name: p?.full_name || null,
          event_type: r.event_type,
          resource_type: r.resource_type,
          resource_id: r.resource_id,
          calculation_fingerprint: r.calculation_fingerprint,
          metadata: r.metadata || {},
          ip_hash: r.ip_hash,
          user_agent: r.user_agent,
          status: null,
          source: 'events',
        };
      });
    } else {
      let q = supabase
        .from('audit_log')
        .select('id, user_id, user_email, action, resource, resource_id, ip_address, user_agent, details, status, created_at')
        .eq('team_id', teamId)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (filterUserId) q = q.eq('user_id', filterUserId);
      if (filterType) q = q.eq('action', filterType.substring(0, 100));
      if (from) q = q.gte('created_at', from);
      if (to) q = q.lt('created_at', to);
      if (before) q = q.lt('created_at', before);

      const { data, error } = await q;
      if (error) {
        console.error('[portfolio/audit] audit_log query failed:', error.message);
        return apiError('Failed to fetch audit log', 500);
      }
      entries = ((data || []) as AdminRow[]).map((r) => {
        const p = r.user_id ? profileMap.get(r.user_id) : undefined;
        return {
          id: r.id,
          created_at: r.created_at,
          user_id: r.user_id,
          user_email: r.user_email || p?.email || null,
          user_name: p?.full_name || null,
          event_type: r.action,
          resource_type: r.resource,
          resource_id: r.resource_id,
          calculation_fingerprint: null,
          metadata: r.details || {},
          ip_hash: r.ip_address ? 'legacy' : null,
          user_agent: r.user_agent,
          status: r.status,
          source: 'admin',
        };
      });
    }

    if (format === 'csv') {
      void recordAuditEvent({
        event_type: 'audit_exported',
        resource_type: 'audit',
        user_id: user.id,
        team_id: teamId,
        metadata: { source, rows: entries.length, user_id: filterUserId, event_type: filterType, from, to },
        request,
      });
      const date = new Date().toISOString().slice(0, 10);
      return new Response(toCsv(entries), {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="solidus-audit-${source}-${date}.csv"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    const memberDirectory = ((members || []) as Array<{ user_id: string; role: string; status: string }>).map((m) => ({
      user_id: m.user_id,
      role: m.role,
      status: m.status,
      email: profileMap.get(m.user_id)?.email || null,
      name: profileMap.get(m.user_id)?.full_name || null,
    }));

    return apiSuccess({
      entries,
      source,
      event_types: source === 'events' ? [...AUDIT_EVENT_TYPES] : [],
      members: memberDirectory,
      next_before: entries.length === limit ? entries[entries.length - 1].created_at : null,
    });
  } catch (error) {
    captureApiError(error, 'portfolio-audit-get');
    return apiError('Internal server error', 500);
  }
}
