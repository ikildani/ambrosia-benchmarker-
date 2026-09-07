import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email/client';
import { createServerClient } from '@/lib/supabase/server';
import { DEAL_STATS } from '@/lib/config/constants';

/** Escape caller-supplied strings before interpolating them into email HTML. */
function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function POST(request: NextRequest) {
  try {
    // This route used to be an unauthenticated open mailer that interpolated
    // caller-supplied strings straight into HTML. It now requires a session
    // and only sends to the signed-in user's own address.
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) {
      return NextResponse.json({ error: 'Sign in to email your results' }, { status: 401 });
    }

    const body = await request.json();
    if (typeof body?.email !== 'string' || body.email.trim().toLowerCase() !== user.email.toLowerCase()) {
      return NextResponse.json({ error: 'Results can only be emailed to your own address' }, { status: 403 });
    }
    const s = escapeHtml;
    const {
      email,
      analysis,
      territory,
      upfront_low,
      upfront_high,
      upfront_median,
      total_low,
      total_high,
      total_median,
      royalty_low,
      royalty_high,
    } = body;

    if (!email || !analysis) {
      return NextResponse.json({ error: 'Email and analysis required' }, { status: 400 });
    }

    const royaltyStr = royalty_low && royalty_high
      ? `${royalty_low}% – ${royalty_high}%`
      : 'See full report';

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0f1a; color: #f1f5f9; padding: 40px 32px; border-radius: 12px;">
        <div style="margin-bottom: 32px;">
          <img src="https://solidus.ambrosiaventures.co/logo-white.png" alt="Ambrosia Ventures" style="height: 28px; width: auto; opacity: 0.8;" />
        </div>

        <h1 style="font-size: 22px; font-weight: 700; color: #f1f5f9; margin-bottom: 8px;">Your Deal Benchmarking Results</h1>
        <p style="font-size: 14px; color: #94a3b8; margin-bottom: 28px;">${s(analysis)} · ${s(territory)}</p>

        <div style="background: #0d1420; border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 24px; margin-bottom: 20px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.04);">
                <div style="font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">Upfront Payment Range</div>
                <div style="font-size: 20px; font-weight: 700; color: #00c9a7;">${s(upfront_low)} – ${s(upfront_high)}</div>
                <div style="font-size: 12px; color: #64748b; margin-top: 2px;">Median: ${s(upfront_median)}</div>
              </td>
            </tr>
            <tr>
              <td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.04);">
                <div style="font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">Total Deal Value Range</div>
                <div style="font-size: 20px; font-weight: 700; color: #f1f5f9;">${s(total_low)} – ${s(total_high)}</div>
                <div style="font-size: 12px; color: #64748b; margin-top: 2px;">Median: ${s(total_median)}</div>
              </td>
            </tr>
            <tr>
              <td style="padding: 12px 0;">
                <div style="font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">Royalty Range</div>
                <div style="font-size: 20px; font-weight: 700; color: #f1f5f9;">${s(royaltyStr)}</div>
              </td>
            </tr>
          </table>
        </div>

        <div style="background: #0d1420; border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 20px; margin-bottom: 28px;">
          <p style="font-size: 13px; font-weight: 600; color: #f1f5f9; margin-bottom: 8px;">Want the full report?</p>
          <p style="font-size: 12px; color: #94a3b8; margin-bottom: 16px; line-height: 1.5;">
            Get comparable transactions, partner matches (700+ companies scored), sensitivity analysis, competitive landscape, and a negotiation playbook.
          </p>
          <a href="https://solidus.ambrosiaventures.co/pro" style="display: inline-block; padding: 10px 24px; background: #00c9a7; color: #0a0f1a; font-size: 13px; font-weight: 700; text-decoration: none; border-radius: 6px;">
            Unlock Full Results — Start Pro Trial
          </a>
        </div>

        <div style="border-top: 1px solid rgba(255,255,255,0.04); padding-top: 20px;">
          <p style="font-size: 11px; color: #475569; line-height: 1.5;">
            This analysis is based on ${DEAL_STATS.TOTAL_DEALS} biopharma transactions tracked by Ambrosia Ventures. Data updated daily from SEC filings, ClinicalTrials.gov, and public deal disclosures.
          </p>
          <p style="font-size: 11px; color: #334155; margin-top: 8px;">
            Ambrosia Ventures · solidus.ambrosiaventures.co
          </p>
        </div>
      </div>
    `;

    const result = await sendEmail({
      to: email,
      subject: `Your Deal Benchmarking Results — ${String(analysis).replace(/[\r\n]+/g, ' ').slice(0, 120)}`,
      html,
    });

    if (!result.success) {
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Email Results] Error:', error);
    return NextResponse.json({ error: 'Failed to send results' }, { status: 500 });
  }
}
