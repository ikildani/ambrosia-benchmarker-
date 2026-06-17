/**
 * Enterprise Audit Logging
 *
 * Logs security-relevant events for compliance (SOC 2, GDPR Article 30).
 * Records who accessed what, when, from where.
 *
 * All sensitive operations should call logAuditEvent():
 * - Authentication (sign in, sign out, failed attempts)
 * - Data access (deal exports, report generation, company profiles)
 * - Data modification (calculation save, watchlist change, profile update)
 * - Administrative (content generation, data deletion, cron runs)
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';

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
