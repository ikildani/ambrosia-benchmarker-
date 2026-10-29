/**
 * POST /api/score-archive — append scores to the shared score archive
 * (migration 139) from Terrain, Augur, IP Map and the Alaric engine.
 *
 * Body: { entries: ScoreArchiveEntry[] } (≤ 500). Response:
 * { inserted, rejected, errors }. Auth: `x-api-key` = ENTITY_API_KEY only —
 * server-to-server; a user session can never write archive rows.
 * recorded_at and the row hash are set by the database. Rows are permanent:
 * send client-confidential inputs with `confidential: true` (or only
 * `inputsSha256`) so only their hash is stored. See docs/score-archive.md.
 */

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { checkRateLimit, getRateLimitHeaders, RATE_LIMIT_CONFIGS } from '@/lib/rate-limit';
import {
  archiveScores,
  SCORE_ARCHIVE_ENTITY_TYPES,
  SCORE_ARCHIVE_ORIGINS,
  SCORE_ARCHIVE_PRODUCTS,
  type ScoreArchiveEntry,
} from '@/lib/score-archive';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const SCORE_ARCHIVE_BATCH_MAX = 500;

const optStr = (max: number) => z.string().trim().min(1).max(max).nullish();

const entrySchema = z.object({
  product: z.enum(SCORE_ARCHIVE_PRODUCTS),
  scoreType: z.string().regex(/^[a-z0-9][a-z0-9_.:-]{0,63}$/, 'scoreType: lowercase dotted, ≤ 64 chars'),
  modelVersion: z.string().trim().min(1).max(100),
  origin: z.enum(SCORE_ARCHIVE_ORIGINS),
  entityType: z.enum(SCORE_ARCHIVE_ENTITY_TYPES),
  entityId: optStr(200),
  entityLabel: optStr(300),
  industry: z.string().regex(/^[a-z0-9_]{1,40}$/).optional(),
  therapeuticArea: optStr(100),
  phase: optStr(50),
  modality: optStr(100),
  indication: optStr(300),
  sourceTable: optStr(100),
  sourceId: optStr(200),
  predictionId: z.string().uuid().nullish(),
  inputs: z.unknown().optional(),
  confidential: z.boolean().optional(),
  inputsSha256: z.string().regex(/^[0-9a-f]{64}$/).nullish(),
  output: z.unknown().refine((v) => v !== undefined && v !== null, 'output is required'),
  dataAsOf: optStr(100),
  horizonEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
}).strict();

const bodySchema = z.object({
  entries: z.array(entrySchema).min(1).max(SCORE_ARCHIVE_BATCH_MAX),
}).strict();

function hasServiceKey(request: NextRequest): boolean {
  const configured = process.env.ENTITY_API_KEY?.trim();
  const presented = request.headers.get('x-api-key')?.trim();
  if (!configured || !presented) return false;
  const a = Buffer.from(configured, 'utf8');
  const b = Buffer.from(presented, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  if (!hasServiceKey(request)) {
    return NextResponse.json({ error: 'Unauthorized: x-api-key required' }, { status: 401 });
  }

  const rl = await checkRateLimit('score-archive-key', 'score-archive', RATE_LIMIT_CONFIGS.default);
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
    return NextResponse.json({
      error: 'Invalid request',
      details: parsed.error.issues.slice(0, 20).map((i) => ({ path: i.path.join('.'), message: i.message })),
    }, { status: 400 });
  }

  const result = await archiveScores(createServiceClient(), parsed.data.entries as ScoreArchiveEntry[]);
  const status = result.inserted === 0 ? 422 : result.rejected > 0 ? 207 : 201;
  return NextResponse.json(result, { status, headers: getRateLimitHeaders(rl) });
}
