/**
 * Search & Evaluation — Export API
 *
 * GET  /api/radar/export?asset_id=UUID&format=json   full brief as JSON
 * GET  /api/radar/export?asset_id=UUID&format=pdf    one/two-page committee brief (A4 PDF)
 * POST /api/radar/export  { format: 'xlsx', source: 'watchlist', scope?: 'mine'|'team' }
 * POST /api/radar/export  { format: 'xlsx', source: 'selection', asset_ids: [uuid, ...] }
 *
 * Pro-only. Rate-limited here per user (PDF spawns headless Chromium) on top
 * of the middleware aiGeneration bucket. The share link for a brief is the
 * page URL itself (/radar/[id], Pro-gated) — nothing to mint.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { resolveUserTier } from '@/lib/auth/tier-check';
import { checkRateLimit, getIdentifier, getRateLimitHeaders } from '@/lib/rate-limit';
import { isUuid, uuidSchema } from '@/app/api/radar/_lib/radar-api';
import { renderPDFBuffer } from '@/lib/report/server-renderer';
import { loadAssetBrief } from '@/components/radar/asset/brief-loader';
import { buildBriefHtml } from '@/components/radar/asset/brief-html';
import { buildAssetListWorkbook, type ExportAssetRow } from '@/components/radar/asset/export-xlsx';
import { SITE_URL } from '@/lib/radar/notifications';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const XLSX_MAX_ROWS = 500;

const xlsxSchema = z.discriminatedUnion('source', [
  z.object({ format: z.literal('xlsx'), source: z.literal('watchlist'), scope: z.enum(['mine', 'team']).default('mine') }),
  z.object({ format: z.literal('xlsx'), source: z.literal('selection'), asset_ids: z.array(uuidSchema).min(1).max(XLSX_MAX_ROWS) }),
]);

function safeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9-_]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase().slice(0, 60) || 'asset';
}

async function rateLimited(request: NextRequest, userId: string, bucket: string, limit: number): Promise<NextResponse | null> {
  const identifier = `${userId}:${getIdentifier(request)}`;
  const rl = await checkRateLimit(identifier, bucket, { limit, windowSeconds: 60 });
  if (rl.success) return null;
  return NextResponse.json({ error: 'Too many exports. Try again in a minute.' }, { status: 429, headers: getRateLimitHeaders(rl) });
}

function audit(supabase: ReturnType<typeof createServiceClient>, userId: string, tier: string | null, data: Record<string, unknown>): void {
  supabase.from('events').insert({
    user_id: userId,
    event_type: 'radar_export',
    event_data: data,
    user_tier: tier || 'pro',
  }).then(({ error }) => { if (error) console.warn('[radar/export] audit insert failed:', error.message); });
}

export async function GET(request: NextRequest) {
  const auth = await resolveUserTier();
  if (!auth.hasProAccess || !auth.userId) {
    return NextResponse.json({ error: 'Pro access required' }, { status: 403 });
  }

  const assetId = request.nextUrl.searchParams.get('asset_id');
  if (!assetId) return NextResponse.json({ error: 'asset_id required' }, { status: 400 });
  if (!isUuid(assetId)) return NextResponse.json({ error: 'asset_id must be a UUID' }, { status: 400 });
  const format = request.nextUrl.searchParams.get('format') === 'pdf' ? 'pdf' : 'json';

  const limited = await rateLimited(request, auth.userId, format === 'pdf' ? 'radarExportPdf' : 'radarExportJson', format === 'pdf' ? 5 : 20);
  if (limited) return limited;

  const supabase = createServiceClient();
  const brief = await loadAssetBrief(supabase, assetId);
  if (!brief) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });

  if (format === 'json') {
    audit(supabase, auth.userId, auth.tier, { asset_id: assetId, format: 'json' });
    return NextResponse.json({
      meta: { generated_at: brief.generated_at, generated_by: 'Solidus Search & Evaluation', version: '2.0', model_version: brief.score.model_version, share_url: `${SITE_URL}/radar/${assetId}` },
      brief,
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  }

  try {
    const html = buildBriefHtml(brief, { baseUrl: SITE_URL });
    const pdf = await renderPDFBuffer(html);
    audit(supabase, auth.userId, auth.tier, { asset_id: assetId, format: 'pdf', pdf_size_bytes: pdf.length });
    const filename = `${safeFilename(brief.asset.asset_name)}-radar-brief-${brief.generated_at.slice(0, 10)}.pdf`;
    return new Response(pdf.buffer as ArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdf.length.toString(),
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err) {
    console.error('[radar/export] PDF render failed:', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: 'Failed to render PDF' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await resolveUserTier();
  if (!auth.hasProAccess || !auth.userId) {
    return NextResponse.json({ error: 'Pro access required' }, { status: 403 });
  }

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  const parsed = xlsxSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid export request' }, { status: 400 });
  }

  const limited = await rateLimited(request, auth.userId, 'radarExportXlsx', 10);
  if (limited) return limited;

  const supabase = createServiceClient();
  const req = parsed.data;
  const rows: ExportAssetRow[] = [];
  const ASSET_COLS = 'id, asset_name, company_name, originator_country, originator_region, therapeutic_area, indication_category, indication_specific, modality, target, mechanism, phase, trial_status, trial_count, enrollment_total, partnership_status, partner_company_name, territory_rights_available, licensing_intent_score, score_confidence, deal_readiness_score, competitive_heat, last_update_date, last_scored_at, nct_ids';

  if (req.source === 'watchlist') {
    let teamId: string | null = null;
    if (req.scope === 'team') {
      const { data: m } = await supabase.from('team_members').select('team_id').eq('user_id', auth.userId).eq('status', 'active').limit(1).maybeSingle();
      teamId = (m as { team_id?: string } | null)?.team_id ?? null;
    }
    let q = supabase.from('radar_watchlist').select('asset_id, user_id, priority, tags, notes, added_at').order('added_at', { ascending: false }).limit(XLSX_MAX_ROWS);
    q = teamId ? q.or(`user_id.eq.${auth.userId},team_id.eq.${teamId}`) : q.eq('user_id', auth.userId);
    const { data: watch } = await q;
    const watches = (watch || []) as Array<Record<string, unknown>>;
    const ids = Array.from(new Set(watches.map(w => String(w.asset_id))));
    const owners = Array.from(new Set(watches.map(w => String(w.user_id))));
    const [{ data: assets }, { data: profiles }] = await Promise.all([
      ids.length ? supabase.from('clinical_assets').select(ASSET_COLS).in('id', ids) : Promise.resolve({ data: [] }),
      owners.length ? supabase.from('user_profiles').select('id, full_name').in('id', owners) : Promise.resolve({ data: [] }),
    ]);
    const byId = new Map(((assets || []) as ExportAssetRow[]).map(a => [a.id, a]));
    const names = new Map(((profiles || []) as Array<{ id: string; full_name: string | null }>).map(p => [p.id, p.full_name]));
    for (const w of watches) {
      const a = byId.get(String(w.asset_id));
      if (!a) continue;
      const full = (names.get(String(w.user_id)) || '').trim();
      rows.push({
        ...a,
        priority: (w.priority as string) ?? null,
        tags: (w.tags as string[]) ?? [],
        watch_notes: (w.notes as string | null) ?? null,
        watch_owner: String(w.user_id) === auth.userId ? 'Me' : (full ? full.split(/\s+/)[0] : 'Teammate'),
        added_at: (w.added_at as string) ?? null,
      });
    }
  } else {
    const { data: assets } = await supabase.from('clinical_assets').select(ASSET_COLS).in('id', req.asset_ids);
    const byId = new Map(((assets || []) as ExportAssetRow[]).map(a => [a.id, a]));
    for (const id of req.asset_ids) { const a = byId.get(id); if (a) rows.push(a); }
  }

  const generatedAt = new Date().toISOString();
  const wb = buildAssetListWorkbook(rows, {
    source: req.source,
    scope: req.source === 'watchlist' ? req.scope : undefined,
    generated_at: generatedAt,
    requested_by: auth.email || auth.userId,
    base_url: SITE_URL,
    row_count: rows.length,
  });
  const buffer = await wb.xlsx.writeBuffer();
  audit(supabase, auth.userId, auth.tier, { format: 'xlsx', source: req.source, rows: rows.length });

  return new Response(buffer as ArrayBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="solidus-radar-${req.source}-${generatedAt.slice(0, 10)}.xlsx"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
