import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { hashApiKey, currentPeriodMonth } from '@/lib/enterprise-api';

export interface ApiKeyContext {
  keyId: string;
  teamId: string | null;
  tier: string;
  monthlyQuota: number;
  monthlyUsage: number;
}

export async function validateApiKey(request: NextRequest): Promise<ApiKeyContext | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ambk_')) return null;

  const rawKey = authHeader.slice(7);
  const keyHash = hashApiKey(rawKey);

  const supabase = createServiceClient();

  const { data: keyRecord } = await supabase
    .from('enterprise_api_keys')
    .select('id, team_id, tier, monthly_quota, status')
    .eq('key_hash', keyHash)
    .eq('status', 'active')
    .single();

  if (!keyRecord) return null;

  const period = currentPeriodMonth();
  const { count } = await supabase
    .from('enterprise_api_usage')
    .select('*', { count: 'exact', head: true })
    .eq('api_key_id', keyRecord.id)
    .eq('period', period);

  const monthlyUsage = count || 0;

  if (monthlyUsage >= keyRecord.monthly_quota) return null;

  await supabase.from('enterprise_api_usage').insert({
    api_key_id: keyRecord.id,
    period,
    endpoint: request.nextUrl.pathname,
  });

  return {
    keyId: keyRecord.id,
    teamId: keyRecord.team_id,
    tier: keyRecord.tier,
    monthlyQuota: keyRecord.monthly_quota,
    monthlyUsage: monthlyUsage + 1,
  };
}
