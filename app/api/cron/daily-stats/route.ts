import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { notifyDailyStats } from '@/lib/slack/notify';

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  // Auth
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '') || '';
  const secret = process.env.CRON_SECRET || '';

  if (!token || !secret || token.length !== secret.length) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    if (!crypto.timingSafeEqual(Buffer.from(token), Buffer.from(secret))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createServiceClient();
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();

    // Total users by tier
    const { count: totalUsers } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true });

    const { count: proUsers } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('tier', 'pro');

    const { count: reportUsers } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('tier', 'report');

    const freeUsers = (totalUsers || 0) - (proUsers || 0) - (reportUsers || 0);

    // New signups today
    const { count: newSignupsToday } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startOfDay);

    // New pro subscriptions today
    const { count: newProToday } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('tier', 'pro')
      .gte('updated_at', startOfDay);

    // Report purchases today
    const { count: newReportsToday } = await supabase
      .from('report_purchases')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startOfDay);

    // Calculations today
    const { count: calculationsToday } = await supabase
      .from('calculations')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startOfDay);

    // Newsletter subscribers
    const { count: newsletterSubscribers } = await supabase
      .from('newsletter_subscribers')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    await notifyDailyStats({
      totalUsers: totalUsers || 0,
      freeUsers: Math.max(freeUsers, 0),
      proUsers: proUsers || 0,
      reportUsers: reportUsers || 0,
      newSignupsToday: newSignupsToday || 0,
      newProToday: newProToday || 0,
      newReportsToday: newReportsToday || 0,
      calculationsToday: calculationsToday || 0,
      newsletterSubscribers: newsletterSubscribers || 0,
    });

    return NextResponse.json({
      success: true,
      stats: {
        totalUsers: totalUsers || 0,
        freeUsers: Math.max(freeUsers, 0),
        proUsers: proUsers || 0,
        reportUsers: reportUsers || 0,
      },
    });
  } catch (error) {
    console.error('[Daily Stats] Error:', error);
    return NextResponse.json({ error: 'Failed to generate stats' }, { status: 500 });
  }
}
