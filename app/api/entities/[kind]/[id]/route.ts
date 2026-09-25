/**
 * GET /api/entities/:kind/:id — canonical entity by id.
 *
 * kind ∈ company | asset | deal; id is the canonical uuid (companies.id /
 * drug_master.id / deals.id). Same auth as /api/entities/resolve
 * (`x-api-key` = ENTITY_API_KEY or a Solidus session). Deals that fail the
 * quality filter are 404. See docs/entity-graph.md.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { checkRateLimit, getRateLimitHeaders, RATE_LIMIT_CONFIGS } from '@/lib/rate-limit';
import { authorizeEntityRequest } from '@/lib/entities/auth';
import { isEntityKind, lookupEntity } from '@/lib/entities/lookup';
import { isUuid } from '@/lib/entities/normalize';

export const dynamic = 'force-dynamic';
export const maxDuration = 15;

export async function GET(request: NextRequest, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const auth = await authorizeEntityRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: 'Unauthorized: x-api-key or session required' }, { status: 401 });
  }
  const rl = await checkRateLimit(auth.identifier, 'entities-lookup', RATE_LIMIT_CONFIGS.default);
  if (!rl.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429, headers: getRateLimitHeaders(rl) });
  }

  const { kind, id } = await params;
  if (!isEntityKind(kind)) {
    return NextResponse.json({ error: 'kind must be company, asset or deal' }, { status: 400 });
  }
  if (!isUuid(id)) {
    return NextResponse.json({ error: 'id must be a uuid' }, { status: 400 });
  }

  try {
    const entity = await lookupEntity(createServiceClient(), kind, id);
    if (!entity) return NextResponse.json({ error: `${kind} not found` }, { status: 404 });
    return NextResponse.json(entity, { headers: { ...getRateLimitHeaders(rl), 'Cache-Control': 'private, max-age=600' } });
  } catch (err) {
    console.error('[entities/lookup] failed', err);
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
  }
}
