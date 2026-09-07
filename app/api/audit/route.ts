import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUser } from '@/lib/auth-helpers';
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limit';
import { apiSuccess, apiError, apiErrorWithHeaders } from '@/lib/api-response';
import { captureApiError } from '@/lib/sentry-api';
import { recordAuditEvent, CLIENT_REPORTABLE_EVENT_TYPES } from '@/lib/audit-log';

export const dynamic = 'force-dynamic';

/**
 * POST /api/audit
 *
 * Lightweight endpoint for client-side completions that the server cannot
 * observe directly (Excel generated in the browser, PDF blob download,
 * share link created). Authenticated users only; rate-limited per user.
 *
 * Only CLIENT_REPORTABLE_EVENT_TYPES are accepted — server-originated events
 * (calculation_created, report_purchased) cannot be spoofed from a browser.
 */
const bodySchema = z.object({
  event_type: z.enum(CLIENT_REPORTABLE_EVENT_TYPES),
  resource_type: z.enum(['calculation', 'share', 'report']),
  resource_id: z.string().max(200).optional().nullable(),
  calculation_fingerprint: z.string().max(64).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
}).strict();

const AUDIT_RATE_LIMIT = { limit: 30, windowSeconds: 60 };

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('Authentication required', 401);

    const rl = await checkRateLimit(`user:${user.id}`, 'audit', AUDIT_RATE_LIMIT);
    if (!rl.success) {
      return apiErrorWithHeaders('Too many requests', 429, getRateLimitHeaders(rl), 'RATE_LIMITED');
    }

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return apiError('Invalid JSON', 400);
    }

    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message || 'Invalid input', 400);
    }
    const body = parsed.data;

    const result = await recordAuditEvent({
      event_type: body.event_type,
      resource_type: body.resource_type,
      user_id: user.id,
      resource_id: body.resource_id ?? null,
      calculation_fingerprint: body.calculation_fingerprint ?? null,
      metadata: body.metadata ?? null,
      request,
    });

    // 202 regardless of DB outcome: the client must never retry or surface audit failures.
    return apiSuccess({ recorded: result.ok }, 202);
  } catch (error) {
    captureApiError(error, 'audit-post');
    return apiSuccess({ recorded: false }, 202);
  }
}
