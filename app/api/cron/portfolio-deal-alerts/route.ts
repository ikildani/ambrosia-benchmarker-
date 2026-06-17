import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { notifyDealAlert } from '@/lib/slack/portfolio-notify';
import { sendDealAlertDigestEmail } from '@/lib/email/client';
import { timingSafeEqual } from 'crypto';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || !authHeader) return false;

  const token = authHeader.replace('Bearer ', '');
  if (token.length !== cronSecret.length) return false;

  return timingSafeEqual(Buffer.from(token), Buffer.from(cronSecret));
}

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();

  try {
    const { data: configs } = await supabase
      .from('deal_alert_configs')
      .select('*, teams(name, slack_webhook_url)')
      .eq('is_active', true);

    if (!configs || configs.length === 0) {
      return NextResponse.json({ processed: 0 });
    }

    let totalDelivered = 0;

    for (const config of configs) {
      const filters = config.filters as Record<string, unknown>;
      const lastTriggered = config.last_triggered_at || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      let query = supabase
        .from('deals')
        .select('id, licensor_name, licensee_name, therapeutic_area, total_deal_value_usd, phase, announced_date')
        .gt('created_at', lastTriggered)
        .order('created_at', { ascending: false })
        .limit(10);

      if (filters.therapeutic_areas && Array.isArray(filters.therapeutic_areas)) {
        query = query.in('therapeutic_area', filters.therapeutic_areas);
      }

      if (filters.min_value && typeof filters.min_value === 'number') {
        query = query.gte('total_deal_value_usd', filters.min_value * 1_000_000);
      }

      const { data: newDeals } = await query;

      if (!newDeals || newDeals.length === 0) continue;

      const channels = (config.channels as string[]) || ['email'];
      const deliveredVia: string[] = [];

      const dealPayload = newDeals.map(d => ({
        parties: `${d.licensor_name || 'Unknown'} / ${d.licensee_name || 'Unknown'}`,
        therapeuticArea: d.therapeutic_area || 'Unknown',
        totalValue: d.total_deal_value_usd
          ? d.total_deal_value_usd >= 1_000_000_000
            ? `$${(d.total_deal_value_usd / 1_000_000_000).toFixed(1)}B`
            : `$${Math.round(d.total_deal_value_usd / 1_000_000)}M`
          : 'Undisclosed',
        phase: d.phase || undefined,
        date: d.announced_date ? new Date(d.announced_date).toLocaleDateString() : 'Recent',
      }));

      if (channels.includes('slack')) {
        const webhookUrl = config.slack_webhook_url || (config.teams as { slack_webhook_url?: string })?.slack_webhook_url;
        if (webhookUrl) {
          await notifyDealAlert(webhookUrl, {
            alertName: config.name,
            deals: dealPayload,
          });
          deliveredVia.push('slack');
        }
      }

      if (channels.includes('email')) {
        // Look up the user's email from user_profiles
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('email')
          .eq('id', config.user_id)
          .single();

        if (profile?.email) {
          const emailResult = await sendDealAlertDigestEmail(
            profile.email,
            config.name,
            dealPayload,
          );
          if (emailResult.success) {
            deliveredVia.push('email');
          } else {
            console.error(`[portfolio-deal-alerts] Email failed for ${profile.email}:`, emailResult.error);
          }
        }
      }

      for (const deal of newDeals) {
        await supabase.from('deal_alert_history').insert({
          alert_config_id: config.id,
          deal_id: deal.id,
          delivered_via: deliveredVia,
        });
      }

      await supabase
        .from('deal_alert_configs')
        .update({ last_triggered_at: new Date().toISOString() })
        .eq('id', config.id);

      totalDelivered += newDeals.length;
    }

    return NextResponse.json({
      processed: configs.length,
      delivered: totalDelivered,
    });
  } catch (error) {
    console.error('[portfolio-deal-alerts] Cron failed:', error);
    return NextResponse.json({ error: 'Cron failed' }, { status: 500 });
  }
}
