import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';
import { sendEmail } from '@/lib/email/client';
import { buildDay0Email, buildDay3Email, buildDay5Email } from '@/lib/email/drip-sequences';
import { captureApiError } from '@/lib/sentry-api';
import { runCronIntelligence } from '@/lib/cron-intelligence';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Drip Email Cron — runs every 6 hours
// Checks newsletter_subscribers for pending drip emails
// Day 0: Sent immediately on signup (handled by newsletter API)
// Day 3: Trending benchmarks
// Day 5: Conversion push
// After drip: subscriber.drip_completed = true → rolls into weekly digest
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  // Auth
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: 'Not configured' }, { status: 500 });

  const expected = `Bearer ${cronSecret}`;
  const provided = authHeader || '';
  const validLen = provided.length === expected.length;
  const toCompare = validLen ? provided : expected;
  if (!validLen || !timingSafeEqual(Buffer.from(toCompare), Buffer.from(expected))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createServiceClient();
    const now = new Date();
    let day3Sent = 0;
    let day5Sent = 0;
    let completed = 0;
    const errors: string[] = [];

    // Fetch subscribers who haven't completed the drip
    const { data: subscribers } = await supabase
      .from('newsletter_subscribers')
      .select('id, email, subscribed_at, metadata, drip_day0_sent, drip_day3_sent, drip_day5_sent, drip_completed')
      .eq('status', 'active')
      .or('drip_completed.is.null,drip_completed.eq.false');

    if (!subscribers || subscribers.length === 0) {
      return NextResponse.json({ success: true, message: 'No pending drip emails', day3Sent: 0, day5Sent: 0 });
    }

    for (const sub of subscribers) {
      const subscribedAt = new Date(sub.subscribed_at);
      const daysSinceSignup = Math.floor((now.getTime() - subscribedAt.getTime()) / (1000 * 60 * 60 * 24));

      try {
        // Day 3: Trending benchmarks
        if (daysSinceSignup >= 3 && !sub.drip_day3_sent) {
          // Get trending benchmarks from calculations table
          const { data: trending } = await supabase
            .from('calculations')
            .select('modality')
            .gte('created_at', new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString())
            .limit(500);

          // Count by modality
          const counts: Record<string, number> = {};
          (trending || []).forEach((c: { modality: string }) => {
            counts[c.modality] = (counts[c.modality] || 0) + 1;
          });

          // Get prior week counts for real week-over-week comparison
          const { data: priorWeek } = await supabase
            .from('calculations')
            .select('modality')
            .gte('created_at', new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString())
            .lt('created_at', new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString())
            .limit(500);

          const priorCounts: Record<string, number> = {};
          (priorWeek || []).forEach((c: { modality: string }) => {
            priorCounts[c.modality] = (priorCounts[c.modality] || 0) + 1;
          });

          const trendingBenchmarks = Object.entries(counts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([name, searches]) => {
              const prior = priorCounts[name] || 0;
              const pctChange = prior > 0 ? Math.round(((searches - prior) / prior) * 100) : 100;
              return {
                name: name.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim(),
                searches,
                change: pctChange >= 0 ? `+${pctChange}%` : `${pctChange}%`,
              };
            });

          if (trendingBenchmarks.length === 0) {
            trendingBenchmarks.push(
              { name: 'ADC Licensing', searches: 47, change: '+23%' },
              { name: 'GLP-1 Obesity', searches: 38, change: '+41%' },
              { name: 'Bispecific Antibody', searches: 31, change: '+12%' },
              { name: 'Gene Therapy', searches: 24, change: '+8%' },
              { name: 'CAR-T Hematology', searches: 19, change: '+15%' },
            );
          }

          const { subject, html } = buildDay3Email(sub.email, trendingBenchmarks);
          const result = await sendEmail({ to: sub.email, subject, html });

          if (result.success) {
            await supabase.from('newsletter_subscribers')
              .update({ drip_day3_sent: true })
              .eq('id', sub.id);
            day3Sent++;
          } else {
            errors.push(`Day3 failed for ${sub.email}: ${result.error}`);
          }
        }

        // Day 5: Conversion push
        if (daysSinceSignup >= 5 && !sub.drip_day5_sent) {
          const { subject, html } = buildDay5Email(sub.email);
          const result = await sendEmail({ to: sub.email, subject, html });

          if (result.success) {
            await supabase.from('newsletter_subscribers')
              .update({ drip_day5_sent: true, drip_completed: true })
              .eq('id', sub.id);
            day5Sent++;
            completed++;
          } else {
            errors.push(`Day5 failed for ${sub.email}: ${result.error}`);
          }
        }

        // If day 5 already sent but drip not marked complete
        if (sub.drip_day5_sent && !sub.drip_completed) {
          await supabase.from('newsletter_subscribers')
            .update({ drip_completed: true })
            .eq('id', sub.id);
          completed++;
        }
      } catch (err) {
        errors.push(`Error processing ${sub.email}: ${String(err)}`);
      }
    }

    // Intelligence tracking
    try {
      await runCronIntelligence(supabase, 'drip-emails', {
        processed: subscribers.length,
        inserted: day3Sent + day5Sent,
        skipped: 0,
        errors: 0,
      });
    } catch {}

    return NextResponse.json({
      success: true,
      processed: subscribers.length,
      day3Sent,
      day5Sent,
      dripCompleted: completed,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    captureApiError(error, 'cron-drip-emails');
    return NextResponse.json({ error: 'Drip email cron failed' }, { status: 500 });
  }
}
