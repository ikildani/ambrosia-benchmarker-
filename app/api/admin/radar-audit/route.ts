/**
 * /api/admin/radar-audit — writes for the /admin/radar-audit queue (lib/radar/qa/audit.ts).
 *
 *   POST  { assetId, owner, availability, duplicate, comment? }   one review (three rows) + correction
 *   GET   ?q=<name>                                                company lookup for owner corrections
 *
 * Auth: admin email session or ADMIN_API_KEY bearer (lib/admin-auth), re-checked here because the
 * route is its own entry point.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/admin-auth';
import { getAuthenticatedUser } from '@/lib/auth-helpers';
import { createServiceClient } from '@/lib/supabase/server';
import { recordAudit, searchCompanies, validateSubmission, type AuditSubmission } from '@/lib/radar/qa/audit';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const denied = await verifyAdminAuth(request);
  if (denied) return denied;
  let body: AuditSubmission;
  try {
    body = (await request.json()) as AuditSubmission;
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  const invalid = validateSubmission(body);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });
  const user = await getAuthenticatedUser(request);
  const reviewer = user?.email ?? 'admin-api';
  try {
    const result = await recordAudit(createServiceClient(), body, reviewer);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[radar-audit] ${message}`);
    return NextResponse.json({ error: message }, { status: message === 'program not found' ? 404 : 500 });
  }
}

export async function GET(request: NextRequest) {
  const denied = await verifyAdminAuth(request);
  if (denied) return denied;
  const q = request.nextUrl.searchParams.get('q') ?? '';
  try {
    return NextResponse.json({ companies: await searchCompanies(createServiceClient(), q) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
