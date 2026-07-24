import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email/client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
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
        <p style="font-size: 14px; color: #94a3b8; margin-bottom: 28px;">${analysis} · ${territory}</p>

        <div style="background: #0d1420; border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 24px; margin-bottom: 20px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.04);">
                <div style="font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">Upfront Payment Range</div>
                <div style="font-size: 20px; font-weight: 700; color: #00c9a7;">${upfront_low} – ${upfront_high}</div>
                <div style="font-size: 12px; color: #64748b; margin-top: 2px;">Median: ${upfront_median}</div>
              </td>
            </tr>
            <tr>
              <td style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.04);">
                <div style="font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">Total Deal Value Range</div>
                <div style="font-size: 20px; font-weight: 700; color: #f1f5f9;">${total_low} – ${total_high}</div>
                <div style="font-size: 12px; color: #64748b; margin-top: 2px;">Median: ${total_median}</div>
              </td>
            </tr>
            <tr>
              <td style="padding: 12px 0;">
                <div style="font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">Royalty Range</div>
                <div style="font-size: 20px; font-weight: 700; color: #f1f5f9;">${royaltyStr}</div>
              </td>
            </tr>
          </table>
        </div>

        <div style="background: #0d1420; border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 20px; margin-bottom: 28px;">
          <p style="font-size: 13px; font-weight: 600; color: #f1f5f9; margin-bottom: 8px;">Want the full report?</p>
          <p style="font-size: 12px; color: #94a3b8; margin-bottom: 16px; line-height: 1.5;">
            Get comparable transactions, partner matches (850+ companies scored), sensitivity analysis, competitive landscape, and a negotiation playbook.
          </p>
          <a href="https://solidus.ambrosiaventures.co/calculator" style="display: inline-block; padding: 10px 24px; background: #00c9a7; color: #0a0f1a; font-size: 13px; font-weight: 700; text-decoration: none; border-radius: 6px;">
            Get Full Report — $499
          </a>
        </div>

        <div style="border-top: 1px solid rgba(255,255,255,0.04); padding-top: 20px;">
          <p style="font-size: 11px; color: #475569; line-height: 1.5;">
            This analysis is based on 3,500+ biopharma transactions tracked by Ambrosia Ventures. Data updated daily from SEC filings, ClinicalTrials.gov, and public deal disclosures.
          </p>
          <p style="font-size: 11px; color: #334155; margin-top: 8px;">
            Ambrosia Ventures · solidus.ambrosiaventures.co
          </p>
        </div>
      </div>
    `;

    const result = await sendEmail({
      to: email,
      subject: `Your Deal Benchmarking Results — ${analysis}`,
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
