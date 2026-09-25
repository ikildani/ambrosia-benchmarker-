/**
 * GET /api/outcomes/accuracy — public, cached 1 h.
 *
 * Returns accuracy_rollups cells for the requested dimensions. An absent
 * dimension means "all" (the null cell), so the bare call returns the global
 * 90d / 365d / all cells; `?source=brief&ta=oncology` returns the brief ×
 * oncology cells. Consumers: /methodology, the brief coverage block, and the
 * calculator "median error ±X% on N resolved deals" line (N ≥ 10).
 *
 * Query: source (calculator|brief|radar|share), ta, phase, model_version,
 *        window (90d|365d|all).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { captureApiError } from '@/lib/sentry-api';
import { readAccuracyRollups } from '@/lib/outcomes/rollups';
import type { AccuracyFilters, PredictionSource, RollupWindow } from '@/lib/outcomes/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SOURCES: PredictionSource[] = ['calculator', 'brief', 'radar', 'share'];
const WINDOWS: RollupWindow[] = ['90d', '365d', 'all'];
const KEY = /^[a-z0-9_\-.]{1,64}$/i;

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const source = p.get('source');
  const window = p.get('window');
  const ta = p.get('ta') ?? p.get('therapeutic_area');
  const phase = p.get('phase');
  const model = p.get('model_version');

  if (source && !SOURCES.includes(source as PredictionSource)) return NextResponse.json({ error: 'invalid source' }, { status: 400 });
  if (window && !WINDOWS.includes(window as RollupWindow)) return NextResponse.json({ error: 'invalid window' }, { status: 400 });
  for (const [k, v] of [['ta', ta], ['phase', phase], ['model_version', model]] as const) {
    if (v && !KEY.test(v)) return NextResponse.json({ error: `invalid ${k}` }, { status: 400 });
  }

  const filters: AccuracyFilters = {
    source: (source as PredictionSource | null) ?? null,
    therapeutic_area: ta ?? null,
    phase: phase ?? null,
    model_version: model ?? null,
    window: (window as RollupWindow | null) ?? null,
  };

  try {
    const rows = await readAccuracyRollups(createServiceClient(), filters);
    console.log(`[Outcomes] accuracy read: ${rows.length} cells for ${JSON.stringify(filters)}`);
    return NextResponse.json(
      { filters, rows, computed_at: rows[0]?.computed_at ?? null },
      { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600' } },
    );
  } catch (error) {
    captureApiError(error, 'outcomes-accuracy');
    return NextResponse.json({ error: 'Failed to read accuracy rollups' }, { status: 500 });
  }
}
