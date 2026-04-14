/**
 * Enterprise API key management — list + create.
 * POST creates a new key (returns plaintext once, never again).
 * GET lists user's keys with usage stats.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/server';
import { generateApiKey, TIER_QUOTAS, currentPeriodMonth } from '@/lib/enterprise-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function requireUser() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const svc = createServiceClient();
  const { data: keys } = await svc
    .from('enterprise_api_keys')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  const period = currentPeriodMonth();
  const keyList = (keys ?? []);
  const usageByKey: Record<string, number> = {};
  if (keyList.length > 0) {
    const ids = keyList.map(k => k.id);
    const { data: usage } = await svc
      .from('enterprise_api_usage')
      .select('api_key_id')
      .in('api_key_id', ids)
      .eq('period_month', period);
    for (const row of usage ?? []) {
      usageByKey[row.api_key_id] = (usageByKey[row.api_key_id] ?? 0) + 1;
    }
  }

  return NextResponse.json({
    keys: keyList.map(k => ({
      id: k.id,
      organizationName: k.organization_name,
      keyPrefix: k.key_prefix,
      tier: k.tier,
      monthlyQuota: k.monthly_quota,
      status: k.status,
      createdAt: k.created_at,
      lastUsedAt: k.last_used_at,
      usageThisMonth: usageByKey[k.id] ?? 0,
    })),
    period,
  });
}

export async function POST(request: NextRequest) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const organizationName = typeof body?.organizationName === 'string' ? body.organizationName.trim() : '';
  if (!organizationName) {
    return NextResponse.json({ error: 'organizationName required' }, { status: 400 });
  }
  const tier = (['pilot', 'growth', 'enterprise'] as const).includes(body?.tier)
    ? body.tier as keyof typeof TIER_QUOTAS
    : 'pilot';

  const { key, hash, prefix } = generateApiKey();
  const svc = createServiceClient();
  const { data, error } = await svc
    .from('enterprise_api_keys')
    .insert({
      user_id: user.id,
      organization_name: organizationName,
      key_hash: hash,
      key_prefix: prefix,
      tier,
      monthly_quota: TIER_QUOTAS[tier],
    })
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Failed to create key' }, { status: 500 });
  }

  // Plaintext key is returned only once here. Client must copy it.
  return NextResponse.json({
    id: data.id,
    key,
    keyPrefix: prefix,
    tier,
    monthlyQuota: TIER_QUOTAS[tier],
    organizationName,
  }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 });
  }
  const svc = createServiceClient();
  const { error } = await svc
    .from('enterprise_api_keys')
    .update({ status: 'revoked', revoked_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
