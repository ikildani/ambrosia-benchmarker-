/**
 * POST /api/entities/resolve — shared entity graph, resolve endpoint.
 *
 * Body: { items: [{ kind: 'company', name?|id?|ticker?|cik? }
 *                | { kind: 'asset', name?|id?|inn?|unii?|chembl_id? }
 *                | { kind: 'deal', id?|licensor?|licensee?|announced_date? }] }
 * ≤ 50 items. Response: { results: (EntityRef|null)[], candidates: EntityCandidate[][] }
 * in input order. Auth: `x-api-key` = ENTITY_API_KEY, or a Solidus session.
 * Rate-limited per caller; identical items are served from a 10-minute
 * in-memory cache. See docs/entity-graph.md.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { checkRateLimit, getRateLimitHeaders, RATE_LIMIT_CONFIGS } from '@/lib/rate-limit';
import { authorizeEntityRequest } from '@/lib/entities/auth';
import { resolveBatch } from '@/lib/entities/resolve';
import { TtlLru, canonicalKey, RESOLVE_CACHE_MAX, RESOLVE_CACHE_TTL_MS } from '@/lib/entities/cache';
import { RESOLVE_BATCH_MAX } from '@/lib/entities/types';
import type { ResolveItem, ResolveResponse, ResolveResult } from '@/lib/entities/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const str = z.string().trim().min(1).max(300);
const idStr = z.string().trim().min(1).max(64);

const companyItem = z.object({
  kind: z.literal('company'),
  name: str.optional(),
  id: idStr.optional(),
  ticker: z.string().trim().min(1).max(12).optional(),
  cik: z.string().trim().min(1).max(12).optional(),
}).strict().refine(v => v.name || v.id || v.ticker || v.cik, { message: 'company needs name, id, ticker or cik' });

const assetItem = z.object({
  kind: z.literal('asset'),
  name: str.optional(),
  id: idStr.optional(),
  inn: str.optional(),
  unii: z.string().trim().min(1).max(20).optional(),
  chembl_id: z.string().trim().min(1).max(20).optional(),
}).strict().refine(v => v.name || v.id || v.inn || v.unii || v.chembl_id, { message: 'asset needs name, id, inn, unii or chembl_id' });

const dealItem = z.object({
  kind: z.literal('deal'),
  id: idStr.optional(),
  licensor: str.optional(),
  licensee: str.optional(),
  announced_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'announced_date must be YYYY-MM-DD').optional(),
}).strict().refine(v => v.id || v.licensor || v.licensee, { message: 'deal needs id, licensor or licensee' });

const bodySchema = z.object({
  items: z.array(z.discriminatedUnion('kind', [companyItem, assetItem, dealItem])).min(1).max(RESOLVE_BATCH_MAX),
}).strict();

const cache = new TtlLru<ResolveResult>({ max: RESOLVE_CACHE_MAX, ttlMs: RESOLVE_CACHE_TTL_MS });

export async function POST(request: NextRequest) {
  const auth = await authorizeEntityRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: 'Unauthorized: x-api-key or session required' }, { status: 401 });
  }

  const rl = await checkRateLimit(auth.identifier, 'entities-resolve', RATE_LIMIT_CONFIGS.default);
  if (!rl.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429, headers: getRateLimitHeaders(rl) });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })) }, { status: 400 });
  }
  const items = parsed.data.items as ResolveItem[];

  // Serve cached items; resolve the rest in one batch; fill in input order.
  const keys = items.map(canonicalKey);
  const results: Array<ResolveResult | undefined> = keys.map(k => cache.get(k));
  const missing = items.map((item, i) => ({ item, i })).filter(({ i }) => !results[i]);

  try {
    if (missing.length) {
      const supabase = createServiceClient();
      const fresh = await resolveBatch(supabase, missing.map(m => m.item));
      fresh.forEach((r, j) => {
        const i = missing[j].i;
        results[i] = r;
        cache.set(keys[i], r);
      });
    }
  } catch (err) {
    console.error('[entities/resolve] failed', err);
    return NextResponse.json({ error: 'Resolve failed' }, { status: 500 });
  }

  const body: ResolveResponse = {
    results: results.map(r => r?.match ?? null),
    candidates: results.map(r => r?.candidates ?? []),
  };
  return NextResponse.json(body, {
    headers: { ...getRateLimitHeaders(rl), 'Cache-Control': 'private, max-age=600' },
  });
}
