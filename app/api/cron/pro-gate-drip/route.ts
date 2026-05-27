// ---------------------------------------------------------------------------
// Pro Gate Drip Cron — runs every 6 hours
//
// Processes the `leads` table (high-intent leads captured from gated Pro
// content pages). These leads saw blurred data and submitted their email.
//
// Required migration (run separately):
//   ALTER TABLE leads
//     ADD COLUMN IF NOT EXISTS drip_1_sent boolean DEFAULT false,
//     ADD COLUMN IF NOT EXISTS drip_2_sent boolean DEFAULT false,
//     ADD COLUMN IF NOT EXISTS drip_3_sent boolean DEFAULT false,
//     ADD COLUMN IF NOT EXISTS drip_4_sent boolean DEFAULT false,
//     ADD COLUMN IF NOT EXISTS drip_5_sent boolean DEFAULT false,
//     ADD COLUMN IF NOT EXISTS drip_completed boolean DEFAULT false;
//
// Schedule:
//   Email 1 — Hour 0:  immediately (within 6h of capture)
//   Email 2 — Day 1:   24+ hours after capture
//   Email 3 — Day 3:   72+ hours after capture
//   Email 4 — Day 5:   120+ hours after capture
//   Email 5 — Day 7:   168+ hours after capture (final)
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';
import { sendEmail } from '@/lib/email/client';
import {
  buildProGateEmail1,
  buildProGateEmail2,
  buildProGateEmail3,
  buildProGateEmail4,
  buildProGateEmail5,
  buildProGateEmail6,
  buildProGateEmail7,
  buildProGateEmail8,
  type LeadContext,
} from '@/lib/email/pro-gate-drip';
import { getProgrammaticPageData, formatCurrency } from '@/lib/seo/programmatic-pages';
import { captureApiError } from '@/lib/sentry-api';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Slug → LeadContext resolver
// ---------------------------------------------------------------------------

function resolveLeadContext(slug: string): LeadContext {
  // Try to match via the programmatic pages engine
  const pageData = getProgrammaticPageData(slug);

  if (pageData) {
    return {
      ta: pageData.ta.label,
      phase: pageData.phase.label,
      territory: pageData.territory.label,
      upfrontLow: formatCurrency(pageData.upfront.low),
      upfrontMedian: formatCurrency(pageData.upfront.median),
      upfrontHigh: formatCurrency(pageData.upfront.high),
      totalValueMedian: formatCurrency(pageData.totalValue.median),
      royaltyRange: `${pageData.royalty.base}–${pageData.royalty.max}%`,
      page: slug,
    };
  }

  // Fallback: parse the slug manually (e.g. "oncology-phase-2-deals-global")
  const parts = slug.split('-');
  let ta = 'Oncology';
  let phase = 'Phase 2';
  let territory = 'Global';

  // Try to extract TA (first segment, or multi-word like "infectious-disease")
  if (parts.length > 0) {
    // Common multi-word TAs
    if (slug.startsWith('infectious-disease')) {
      ta = 'Infectious Disease';
    } else if (slug.startsWith('rare-disease')) {
      ta = 'Rare Disease';
    } else if (slug.startsWith('womens-health')) {
      ta = "Women's Health";
    } else {
      ta = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
    }
  }

  // Try to extract phase
  const phaseMatch = slug.match(/phase-(\d)/);
  if (phaseMatch) {
    phase = `Phase ${phaseMatch[1]}`;
  } else if (slug.includes('preclinical')) {
    phase = 'Preclinical';
  } else if (slug.includes('approved')) {
    phase = 'Approved';
  }

  // Try to extract territory (last segment after "deals-")
  const territoryMatch = slug.match(/deals-(.+)$/);
  if (territoryMatch) {
    const t = territoryMatch[1];
    if (t === 'us') territory = 'US Only';
    else if (t === 'ex-us') territory = 'Ex-US';
    else if (t === 'europe') territory = 'Europe';
    else if (t === 'japan') territory = 'Japan';
    else if (t === 'china') territory = 'China';
    else territory = 'Global';
  }

  return {
    ta,
    phase,
    territory,
    upfrontLow: '$50M',
    upfrontMedian: '$150M',
    upfrontHigh: '$350M',
    totalValueMedian: '$800M',
    royaltyRange: '8–15%',
    page: slug,
  };
}

// ---------------------------------------------------------------------------
// Hours elapsed helper
// ---------------------------------------------------------------------------

function hoursElapsed(since: Date, now: Date): number {
  return (now.getTime() - since.getTime()) / (1000 * 60 * 60);
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  // Auth — same pattern as other crons
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

    const sent = { email1: 0, email2: 0, email3: 0, email4: 0, email5: 0, email6: 0, email7: 0, email8: 0 };
    let completed = 0;
    const errors: string[] = [];

    // Get real Pro subscriber count for social proof in Email 4
    const { count: proCount } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('tier', 'pro');

    // Fetch unconverted leads that haven't finished the drip
    const { data: leads, error: fetchError } = await supabase
      .from('leads')
      .select('id, email, captured_at, page, converted_at, drip_1_sent, drip_2_sent, drip_3_sent, drip_4_sent, drip_5_sent, drip_6_sent, drip_7_sent, drip_8_sent, drip_completed')
      .is('converted_at', null)
      .or('drip_completed.is.null,drip_completed.eq.false');

    if (fetchError) {
      console.error('Failed to fetch leads:', fetchError.message);
      return NextResponse.json({ error: 'Failed to fetch leads', detail: fetchError.message }, { status: 500 });
    }

    if (!leads || leads.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No pending pro-gate drip emails',
        ...sent,
      });
    }

    for (const lead of leads) {
      try {
        const capturedAt = new Date(lead.captured_at);
        const hours = hoursElapsed(capturedAt, now);
        const context = resolveLeadContext(lead.page || '');

        // Email 1 — Hour 0: send immediately (within first 6 hours)
        if (!lead.drip_1_sent && hours < 6) {
          const { subject, html } = buildProGateEmail1(lead.email, context);
          const result = await sendEmail({ to: lead.email, subject, html });
          if (result.success) {
            await supabase.from('leads').update({ drip_1_sent: true }).eq('id', lead.id);
            sent.email1++;
          } else {
            errors.push(`E1 failed for ${lead.email}: ${result.error}`);
          }
          continue; // Don't send multiple emails in one run
        }

        // Email 1 catch-up — if they were captured > 6h ago but Email 1 never sent
        if (!lead.drip_1_sent && hours >= 6) {
          const { subject, html } = buildProGateEmail1(lead.email, context);
          const result = await sendEmail({ to: lead.email, subject, html });
          if (result.success) {
            await supabase.from('leads').update({ drip_1_sent: true }).eq('id', lead.id);
            sent.email1++;
          } else {
            errors.push(`E1 catch-up failed for ${lead.email}: ${result.error}`);
          }
          continue;
        }

        // Email 2 — Day 1 (24+ hours)
        if (lead.drip_1_sent && !lead.drip_2_sent && hours >= 24) {
          const { subject, html } = buildProGateEmail2(lead.email, context);
          const result = await sendEmail({ to: lead.email, subject, html });
          if (result.success) {
            await supabase.from('leads').update({ drip_2_sent: true }).eq('id', lead.id);
            sent.email2++;
          } else {
            errors.push(`E2 failed for ${lead.email}: ${result.error}`);
          }
          continue;
        }

        // Email 3 — Day 3 (72+ hours)
        if (lead.drip_2_sent && !lead.drip_3_sent && hours >= 72) {
          const { subject, html } = buildProGateEmail3(lead.email, context);
          const result = await sendEmail({ to: lead.email, subject, html });
          if (result.success) {
            await supabase.from('leads').update({ drip_3_sent: true }).eq('id', lead.id);
            sent.email3++;
          } else {
            errors.push(`E3 failed for ${lead.email}: ${result.error}`);
          }
          continue;
        }

        // Email 4 — Day 5 (120+ hours)
        if (lead.drip_3_sent && !lead.drip_4_sent && hours >= 120) {
          const { subject, html } = buildProGateEmail4(lead.email, context, proCount || undefined);
          const result = await sendEmail({ to: lead.email, subject, html });
          if (result.success) {
            await supabase.from('leads').update({ drip_4_sent: true }).eq('id', lead.id);
            sent.email4++;
          } else {
            errors.push(`E4 failed for ${lead.email}: ${result.error}`);
          }
          continue;
        }

        // Email 5 — Day 7 (168+ hours) — personal from Issa
        if (lead.drip_4_sent && !lead.drip_5_sent && hours >= 168) {
          const { subject, html } = buildProGateEmail5(lead.email, context);
          const result = await sendEmail({
            to: lead.email,
            subject,
            html,
            from: 'Issa Kildani <issa@ambrosiaventures.co>',
            replyTo: 'issa@ambrosiaventures.co',
          });
          if (result.success) {
            await supabase.from('leads').update({ drip_5_sent: true }).eq('id', lead.id);
            sent.email5++;
          } else {
            errors.push(`E5 failed for ${lead.email}: ${result.error}`);
          }
          continue;
        }

        // Email 6 — Day 10 (240+ hours) — loss aversion (from Issa)
        if (lead.drip_5_sent && !lead.drip_6_sent && hours >= 240) {
          const { subject, html } = buildProGateEmail6(lead.email, context);
          const result = await sendEmail({
            to: lead.email, subject, html,
            from: 'Issa Kildani <issa@ambrosiaventures.co>',
            replyTo: 'issa@ambrosiaventures.co',
          });
          if (result.success) {
            await supabase.from('leads').update({ drip_6_sent: true }).eq('id', lead.id);
            sent.email6++;
          } else {
            errors.push(`E6 failed for ${lead.email}: ${result.error}`);
          }
          continue;
        }

        // Email 7 — Day 14 (336+ hours) — ROI math (from Issa)
        if (lead.drip_6_sent && !lead.drip_7_sent && hours >= 336) {
          const { subject, html } = buildProGateEmail7(lead.email, context);
          const result = await sendEmail({
            to: lead.email, subject, html,
            from: 'Issa Kildani <issa@ambrosiaventures.co>',
            replyTo: 'issa@ambrosiaventures.co',
          });
          if (result.success) {
            await supabase.from('leads').update({ drip_7_sent: true }).eq('id', lead.id);
            sent.email7++;
          } else {
            errors.push(`E7 failed for ${lead.email}: ${result.error}`);
          }
          continue;
        }

        // Email 8 — Day 21 (504+ hours) — final re-engagement + auto-subscribe to weekly digest
        if (lead.drip_7_sent && !lead.drip_8_sent && hours >= 504) {
          const { subject, html } = buildProGateEmail8(lead.email, context);
          const result = await sendEmail({ to: lead.email, subject, html });
          if (result.success) {
            await supabase.from('leads').update({ drip_8_sent: true, drip_completed: true }).eq('id', lead.id);
            // Auto-subscribe to weekly digest so they keep getting value
            await supabase.from('newsletter_subscribers').upsert(
              {
                email: lead.email,
                status: 'active',
                subscribed_at: new Date().toISOString(),
                source: 'pro_gate_drip_rollover',
                drip_completed: true,
              },
              { onConflict: 'email' }
            );
            sent.email8++;
            completed++;
          } else {
            errors.push(`E8 failed for ${lead.email}: ${result.error}`);
          }
          continue;
        }

        // Mark completed if Email 8 already sent but drip_completed not set
        if (lead.drip_8_sent && !lead.drip_completed) {
          await supabase.from('leads').update({ drip_completed: true }).eq('id', lead.id);
          completed++;
        }
      } catch (err) {
        errors.push(`Error processing lead ${lead.email}: ${String(err)}`);
      }
    }

    return NextResponse.json({
      success: true,
      processed: leads.length,
      ...sent,
      dripCompleted: completed,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    captureApiError(error, 'cron-pro-gate-drip');
    return NextResponse.json({ error: 'Pro gate drip cron failed' }, { status: 500 });
  }
}
