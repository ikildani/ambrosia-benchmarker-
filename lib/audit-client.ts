/**
 * Browser-side audit reporting.
 *
 * Exports and shares complete on the client (Excel is generated in the
 * browser; the PDF is fetched from /api/report/generate and downloaded as a
 * blob; share links come back from /api/share). This helper reports those
 * completions to POST /api/audit, which authenticates the caller, validates
 * the payload and writes to audit_events via lib/audit-log.ts.
 *
 * Fire-and-forget: never throws, never blocks the UI. Anonymous users are
 * ignored server-side (401) — nothing to audit.
 *
 * To add a call site (e.g. in components/Results.tsx, which this module's
 * author does not own):
 *   import { recordClientAuditEvent } from '@/lib/audit-client';
 *   recordClientAuditEvent({ event_type: 'results_exported', resource_type: 'report', metadata: { format: 'excel' }, calculation_fingerprint });
 */

export type ClientAuditEventType = 'results_exported' | 'results_shared' | 'calculation_viewed';
export type ClientAuditResourceType = 'calculation' | 'share' | 'report';

export interface ClientAuditEvent {
  event_type: ClientAuditEventType;
  resource_type: ClientAuditResourceType;
  resource_id?: string | null;
  calculation_fingerprint?: string | null;
  metadata?: Record<string, unknown>;
}

export function recordClientAuditEvent(event: ClientAuditEvent): void {
  if (typeof window === 'undefined' || typeof fetch !== 'function') return;
  try {
    const body = JSON.stringify(event);
    // keepalive lets the request survive a navigation/unload right after an export.
    fetch('/api/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
      credentials: 'same-origin',
    }).catch(() => {});
  } catch {
    // never surface audit failures to the user
  }
}
