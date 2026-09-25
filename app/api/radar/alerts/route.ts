/**
 * Search & Evaluation — Alert rules API
 *
 * GET    /api/radar/alerts?asset_id=UUID        rules for the caller (optionally those pinned to one asset)
 * GET    /api/radar/alerts?events=true&limit=30 recent alert events for the caller (in-app inbox)
 * POST   /api/radar/alerts                      { kind, channel, config, is_active? }
 * PATCH  /api/radar/alerts?id=UUID              { is_active?, config?, channel? }
 * DELETE /api/radar/alerts?id=UUID
 * POST   /api/radar/alerts?mark_read=true       { ids: [eventId, ...] } → sets read_at on in-app events
 *
 * Auth-only. Slack and email channels need Pro (they call out of the platform);
 * in-app rules are the free-tier hook, like the watchlist. Every row is keyed
 * to the session user; rules are validated by validateAlertRule().
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { resolveUserTier } from '@/lib/auth/tier-check';
import { isUuid, uuidSchema } from '@/app/api/radar/_lib/radar-api';
import { validateAlertRule, ALERT_KINDS } from '@/lib/radar/notifications';

export const dynamic = 'force-dynamic';

const MAX_RULES_PER_USER = 50;

async function activeTeamId(supabase: ReturnType<typeof createServiceClient>, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('team_members')
    .select('team_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();
  return (data as { team_id?: string } | null)?.team_id ?? null;
}

export async function GET(request: NextRequest) {
  const auth = await resolveUserTier();
  if (!auth.userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const supabase = createServiceClient();
  const sp = request.nextUrl.searchParams;

  if (sp.get('events') === 'true') {
    const limit = Math.min(100, Math.max(1, parseInt(sp.get('limit') || '30', 10) || 30));
    const assetId = sp.get('asset_id');
    if (assetId && !isUuid(assetId)) return NextResponse.json({ error: 'asset_id must be a UUID' }, { status: 400 });
    let q = supabase
      .from('radar_alert_events')
      .select('id, rule_id, asset_id, mandate_id, kind, channel, payload, sent_at, delivery_status, read_at')
      .eq('user_id', auth.userId)
      .order('sent_at', { ascending: false })
      .limit(limit);
    if (assetId) q = q.eq('asset_id', assetId);
    const { data, error } = await q;
    if (error) {
      console.error('[radar/alerts] events error:', error.message);
      return NextResponse.json({ error: 'Failed to fetch alert events' }, { status: 500 });
    }
    const events = data || [];
    return NextResponse.json({ events, unread: events.filter(e => e.channel === 'in_app' && !e.read_at).length });
  }

  const assetId = sp.get('asset_id');
  if (assetId && !isUuid(assetId)) return NextResponse.json({ error: 'asset_id must be a UUID' }, { status: 400 });

  let q = supabase
    .from('radar_alert_rules')
    .select('id, team_id, kind, channel, config, is_active, created_at')
    .eq('user_id', auth.userId)
    .order('created_at', { ascending: false })
    .limit(MAX_RULES_PER_USER);
  if (assetId) q = q.eq('config->>asset_id', assetId);
  const { data, error } = await q;
  if (error) {
    console.error('[radar/alerts] GET error:', error.message);
    return NextResponse.json({ error: 'Failed to fetch alert rules' }, { status: 500 });
  }
  // Never echo Slack webhook secrets back to the browser in full.
  const rules = (data || []).map(r => {
    const cfg = { ...(r.config as Record<string, unknown>) };
    if (typeof cfg.webhook_url === 'string') cfg.webhook_url = cfg.webhook_url.replace(/(services\/[^/]+\/[^/]+\/).+$/, '$1••••');
    return { ...r, config: cfg };
  });
  return NextResponse.json({ rules, kinds: ALERT_KINDS, hasProAccess: auth.hasProAccess });
}

const markReadSchema = z.object({ ids: z.array(uuidSchema).min(1).max(100) });

export async function POST(request: NextRequest) {
  const auth = await resolveUserTier();
  if (!auth.userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  const supabase = createServiceClient();

  if (request.nextUrl.searchParams.get('mark_read') === 'true') {
    const parsed = markReadSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'ids required' }, { status: 400 });
    const { error } = await supabase
      .from('radar_alert_events')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', auth.userId)
      .in('id', parsed.data.ids)
      .is('read_at', null);
    if (error) return NextResponse.json({ error: 'Failed to mark read' }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  const validation = validateAlertRule(body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  const { rule } = validation;
  if (rule.channel !== 'in_app' && !auth.hasProAccess) {
    return NextResponse.json({ error: 'Email and Slack alerts require Pro' }, { status: 403 });
  }

  const { count } = await supabase
    .from('radar_alert_rules')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', auth.userId);
  if ((count || 0) >= MAX_RULES_PER_USER) {
    return NextResponse.json({ error: `At most ${MAX_RULES_PER_USER} alert rules per user` }, { status: 400 });
  }

  const teamId = await activeTeamId(supabase, auth.userId);
  const { data, error } = await supabase
    .from('radar_alert_rules')
    .insert({ user_id: auth.userId, team_id: teamId, kind: rule.kind, channel: rule.channel, config: rule.config, is_active: rule.is_active })
    .select('id, team_id, kind, channel, config, is_active, created_at')
    .single();
  if (error || !data) {
    console.error('[radar/alerts] POST error:', error?.message);
    return NextResponse.json({ error: 'Failed to save alert rule' }, { status: 500 });
  }
  return NextResponse.json({ success: true, rule: data });
}

const patchSchema = z.object({
  is_active: z.boolean().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  channel: z.enum(['email', 'slack', 'in_app']).optional(),
});

export async function PATCH(request: NextRequest) {
  const auth = await resolveUserTier();
  if (!auth.userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const id = request.nextUrl.searchParams.get('id');
  if (!id || !isUuid(id)) return NextResponse.json({ error: 'id must be a UUID' }, { status: 400 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  const supabase = createServiceClient();
  const { data: existing } = await supabase
    .from('radar_alert_rules')
    .select('id, kind, channel, config, is_active')
    .eq('id', id)
    .eq('user_id', auth.userId)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: 'Rule not found' }, { status: 404 });

  const merged = {
    kind: existing.kind,
    channel: parsed.data.channel ?? existing.channel,
    config: { ...(existing.config as Record<string, unknown>), ...(parsed.data.config ?? {}) },
    is_active: parsed.data.is_active ?? existing.is_active,
  };
  // A masked webhook echoed back from GET must not overwrite the stored one.
  if (typeof merged.config.webhook_url === 'string' && merged.config.webhook_url.includes('••••')) {
    merged.config.webhook_url = (existing.config as Record<string, unknown>).webhook_url;
  }
  const validation = validateAlertRule(merged);
  if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 });
  if (validation.rule.channel !== 'in_app' && !auth.hasProAccess) {
    return NextResponse.json({ error: 'Email and Slack alerts require Pro' }, { status: 403 });
  }

  const { data, error } = await supabase
    .from('radar_alert_rules')
    .update({ channel: validation.rule.channel, config: validation.rule.config, is_active: validation.rule.is_active })
    .eq('id', id)
    .eq('user_id', auth.userId)
    .select('id, team_id, kind, channel, config, is_active, created_at')
    .single();
  if (error || !data) return NextResponse.json({ error: 'Failed to update alert rule' }, { status: 500 });
  return NextResponse.json({ success: true, rule: data });
}

export async function DELETE(request: NextRequest) {
  const auth = await resolveUserTier();
  if (!auth.userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const id = request.nextUrl.searchParams.get('id');
  if (!id || !isUuid(id)) return NextResponse.json({ error: 'id must be a UUID' }, { status: 400 });
  const supabase = createServiceClient();
  const { error } = await supabase.from('radar_alert_rules').delete().eq('id', id).eq('user_id', auth.userId);
  if (error) return NextResponse.json({ error: 'Failed to delete alert rule' }, { status: 500 });
  return NextResponse.json({ success: true });
}
