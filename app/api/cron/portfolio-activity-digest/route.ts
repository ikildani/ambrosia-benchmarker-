import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { sendPortfolioActivityDigest } from '@/lib/email/client';
import { timingSafeEqual } from 'crypto';
import { runCronIntelligence } from '@/lib/cron-intelligence';

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
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('id, name, max_seats, analyst_hours_monthly')
      .eq('status', 'active');

    if (teamsError) {
      console.error('[portfolio-activity-digest] Failed to fetch teams:', teamsError);
      return NextResponse.json({ error: 'Failed to fetch teams' }, { status: 500 });
    }

    if (!teams || teams.length === 0) {
      return NextResponse.json({ processed: 0, delivered: 0 });
    }

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const sevenDaysAgoISO = sevenDaysAgo.toISOString();

    // Build period string like "June 9-16, 2026"
    const startDate = sevenDaysAgo;
    const endDate = now;
    const monthName = endDate.toLocaleString('en-US', { month: 'long' });
    const startDay = startDate.getDate();
    const endDay = endDate.getDate();
    const year = endDate.getFullYear();

    let periodString: string;
    if (startDate.getMonth() === endDate.getMonth()) {
      periodString = `${monthName} ${startDay}-${endDay}, ${year}`;
    } else {
      const startMonth = startDate.toLocaleString('en-US', { month: 'long' });
      periodString = `${startMonth} ${startDay} - ${monthName} ${endDay}, ${year}`;
    }

    // First of the current month for analyst hours
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

    let totalDelivered = 0;

    for (const team of teams) {
      try {
        const [
          activeMembers,
          calculations,
          reports,
          alertsResult,
          analystHours,
          calcEntries,
          admins,
        ] = await Promise.all([
          // Active members count
          supabase
            .from('team_members')
            .select('id', { count: 'exact', head: true })
            .eq('team_id', team.id)
            .eq('status', 'active'),

          // Calculations run in last 7 days
          supabase
            .from('audit_log')
            .select('id', { count: 'exact', head: true })
            .eq('team_id', team.id)
            .eq('action', 'run_calculation')
            .gte('created_at', sevenDaysAgoISO),

          // Reports generated in last 7 days
          supabase
            .from('audit_log')
            .select('id', { count: 'exact', head: true })
            .eq('team_id', team.id)
            .eq('action', 'generate_report')
            .gte('created_at', sevenDaysAgoISO),

          // Alerts fired in last 7 days
          supabase
            .from('deal_alert_history')
            .select('id, alert_config_id', { count: 'exact', head: true })
            .gte('created_at', sevenDaysAgoISO)
            .in(
              'alert_config_id',
              (await supabase
                .from('deal_alert_configs')
                .select('id')
                .eq('team_id', team.id)
              ).data?.map(c => c.id) || [],
            ),

          // Analyst hours used this month
          supabase
            .from('analyst_hour_entries')
            .select('hours')
            .eq('team_id', team.id)
            .gte('service_date', firstOfMonth),

          // All run_calculation entries for top companies aggregation
          supabase
            .from('audit_log')
            .select('details')
            .eq('team_id', team.id)
            .eq('action', 'run_calculation')
            .gte('created_at', sevenDaysAgoISO),

          // Admin members for email delivery
          supabase
            .from('team_members')
            .select('user_id')
            .eq('team_id', team.id)
            .eq('role', 'admin')
            .eq('status', 'active'),
        ]);

        // Aggregate analyst hours
        const totalAnalystHours = (analystHours.data || []).reduce(
          (sum, entry) => sum + (entry.hours || 0),
          0,
        );

        // Aggregate top companies from calculation details
        const companyCounts: Record<string, number> = {};
        for (const entry of calcEntries.data || []) {
          const details = entry.details as Record<string, unknown> | null;
          const companyName = details?.company_name as string | undefined;
          if (companyName) {
            companyCounts[companyName] = (companyCounts[companyName] || 0) + 1;
          }
        }

        const topCompanies = Object.entries(companyCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, calculations]) => ({ name, calculations }));

        // Get admin emails
        const adminUserIds = (admins.data || []).map(m => m.user_id);
        if (adminUserIds.length === 0) continue;

        const { data: adminProfiles } = await supabase
          .from('user_profiles')
          .select('email')
          .in('id', adminUserIds);

        if (!adminProfiles || adminProfiles.length === 0) continue;

        const digest = {
          period: periodString,
          activeSeats: activeMembers.count || 0,
          maxSeats: team.max_seats || 0,
          calculationsRun: calculations.count || 0,
          reportsGenerated: reports.count || 0,
          alertsFired: alertsResult.count || 0,
          analystHoursUsed: Math.round(totalAnalystHours * 10) / 10,
          analystHoursAllocated: team.analyst_hours_monthly || 0,
          topCompanies,
        };

        for (const profile of adminProfiles) {
          if (!profile.email) continue;

          const result = await sendPortfolioActivityDigest(
            profile.email,
            team.name,
            digest,
          );

          if (result.success) {
            totalDelivered++;
          } else {
            console.error(
              `[portfolio-activity-digest] Email failed for ${profile.email}:`,
              result.error,
            );
          }
        }
      } catch (teamError) {
        console.error(
          `[portfolio-activity-digest] Failed processing team ${team.id}:`,
          teamError,
        );
      }
    }

    // Intelligence tracking
    try {
      await runCronIntelligence(supabase, 'portfolio-activity-digest', {
        processed: teams.length,
        inserted: totalDelivered,
      });
    } catch {}

    return NextResponse.json({
      processed: teams.length,
      delivered: totalDelivered,
    });
  } catch (error) {
    console.error('[portfolio-activity-digest] Cron failed:', error);
    return NextResponse.json({ error: 'Cron failed' }, { status: 500 });
  }
}
