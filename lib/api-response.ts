/**
 * Standard API response helpers.
 * Flat envelope: adds `success` + `meta` alongside existing fields.
 * Frontend callers (data.deals, data.posts, etc.) continue working unchanged.
 */

import { NextResponse } from 'next/server';

interface ApiMeta {
  timestamp: string;
  requestId: string;
}

function buildMeta(): ApiMeta {
  return {
    timestamp: new Date().toISOString(),
    requestId: crypto.randomUUID(),
  };
}

/**
 * Return a successful API response with flat envelope.
 * Usage: return apiSuccess({ deals, total, page })
 * Result: { success: true, deals, total, page, meta: { timestamp, requestId } }
 */
export function apiSuccess<T extends Record<string, unknown>>(
  data: T,
  status: number = 200
): NextResponse {
  return NextResponse.json(
    { success: true as const, ...data, meta: buildMeta() },
    { status }
  );
}

/**
 * Return an error API response.
 * Uses flat `error: string` to match existing frontend expectations (data.error).
 * Usage: return apiError('Not found', 404)
 */
export function apiError(
  message: string,
  status: number = 500,
  code?: string
): NextResponse {
  return NextResponse.json(
    {
      success: false as const,
      error: message,
      ...(code ? { error_code: code } : {}),
      meta: buildMeta(),
    },
    { status }
  );
}

/**
 * Return an error response with custom headers (e.g., rate-limit headers).
 */
export function apiErrorWithHeaders(
  message: string,
  status: number,
  headers: Record<string, string>,
  code?: string
): NextResponse {
  return NextResponse.json(
    {
      success: false as const,
      error: message,
      ...(code ? { error_code: code } : {}),
      meta: buildMeta(),
    },
    { status, headers }
  );
}
