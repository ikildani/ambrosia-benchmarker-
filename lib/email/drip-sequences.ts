// ---------------------------------------------------------------------------
// Drip Email Sequences for Free → Paid Conversion
// Day 0: Advisory-level insight based on their calculation
// Day 3: Trending benchmarks across the platform
// Day 5: Direct conversion push with report value proposition
// After drip: rolls into weekly digest
// ---------------------------------------------------------------------------

export interface CalculationContext {
  modality: string;
  phase: string;
  indication: string;
  territory: string;
  upfront_median: number;
  total_deal_value_median: number;
  royalty_low?: number;
  royalty_high?: number;
}

// ---------------------------------------------------------------------------
// Day 0: Advisory-level insight (sent immediately on email capture)
// ---------------------------------------------------------------------------

export function buildDay0Email(
  email: string,
  context: CalculationContext | null
): { subject: string; html: string } {
  const modality = context?.modality || 'your modality';
  const phase = context?.phase || 'your phase';
  const upfront = context?.upfront_median
    ? `$${context.upfront_median >= 1000 ? `${(context.upfront_median / 1000).toFixed(1)}B` : `${context.upfront_median}M`}`
    : 'competitive range';
  const totalValue = context?.total_deal_value_median
    ? `$${context.total_deal_value_median >= 1000 ? `${(context.total_deal_value_median / 1000).toFixed(1)}B` : `${context.total_deal_value_median}M`}`
    : 'significant value';

  const subject = `Your ${phase} ${modality} benchmark — plus one insight you didn't see`;

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.7; color: #1e293b; max-width: 560px; margin: 0 auto; padding: 20px; background: #f8fafc;">

<div style="background: #0f172a; padding: 28px 32px; border-radius: 12px 12px 0 0;">
  <p style="color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; margin: 0 0 8px;">Ambrosia Ventures · Deal Intelligence</p>
  <h1 style="color: #fff; margin: 0; font-size: 20px; font-weight: 600; line-height: 1.3;">Your ${phase} ${modality} benchmark</h1>
</div>

<div style="background: #fff; padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">

  <p style="font-size: 15px; color: #334155; margin-top: 0;">You ran a benchmark for a <strong>${phase} ${modality}</strong> deal. Here's what you saw:</p>

  <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 3px solid #14b8a6;">
    <p style="margin: 0 0 4px; font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em;">Expected Upfront</p>
    <p style="margin: 0; font-size: 24px; font-weight: 700; color: #0f172a; font-family: 'SF Mono', SFMono-Regular, monospace;">${upfront}</p>
    <p style="margin: 8px 0 0; font-size: 12px; color: #64748b;">Total deal value: ${totalValue}</p>
  </div>

  <p style="font-size: 15px; color: #334155;"><strong>Here's something you didn't see:</strong></p>

  <p style="font-size: 15px; color: #334155;">In comparable ${modality} deals at this stage, the average milestone package is typically <strong>3–5x the upfront payment</strong> — but the structure matters more than the total. Around 60% of milestones are loaded into Phase 3 completion and regulatory approval, with only 15–20% tied to commercial targets.</p>

  <p style="font-size: 15px; color: #334155;">What this means for your negotiation: <strong>push for lower commercial milestones and higher regulatory milestones.</strong> Regulatory milestones have clearer binary triggers (approval/CRL), which means less ambiguity and faster payment. Commercial milestones tied to revenue thresholds can take years and create disputes over net sales definitions.</p>

  <p style="font-size: 15px; color: #334155;">This is the kind of structural insight that moves deals. The headline numbers get you in the room — the structure is what determines whether you leave money on the table.</p>

  <div style="text-align: center; margin: 28px 0 20px;">
    <a href="https://calculator.ambrosiaventures.co/calculator" style="display: inline-block; background: #0f172a; color: #fff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
      Explore more benchmarks
    </a>
  </div>

  <p style="font-size: 13px; color: #94a3b8; text-align: center; margin-bottom: 0;">No spam. Just deal intelligence.</p>
</div>

<div style="text-align: center; padding: 20px; color: #94a3b8; font-size: 11px;">
  <p style="margin: 0;">Ambrosia Ventures · <a href="https://ambrosiaventures.co" style="color: #94a3b8;">ambrosiaventures.co</a></p>
  <p style="margin: 6px 0 0;"><a href="https://calculator.ambrosiaventures.co/unsubscribe?email=${encodeURIComponent(email)}" style="color: #94a3b8;">Unsubscribe</a></p>
</div>

</body></html>`;

  return { subject, html };
}

// ---------------------------------------------------------------------------
// Day 3: Trending benchmarks this week
// ---------------------------------------------------------------------------

export function buildDay3Email(
  email: string,
  trendingBenchmarks: { name: string; searches: number; change: string }[]
): { subject: string; html: string } {
  const topBenchmark = trendingBenchmarks[0]?.name || 'ADC deals';
  const subject = `This week's most-searched deal benchmarks — ${topBenchmark} leads`;

  const benchmarkRows = trendingBenchmarks.slice(0, 5).map((b, i) => `
    <tr>
      <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: #334155;">
        <strong>${i + 1}.</strong> ${b.name}
      </td>
      <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #64748b; text-align: right; font-family: 'SF Mono', monospace;">
        ${b.searches} searches
      </td>
      <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 12px; color: ${b.change.startsWith('+') ? '#059669' : '#64748b'}; text-align: right;">
        ${b.change}
      </td>
    </tr>
  `).join('');

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.7; color: #1e293b; max-width: 560px; margin: 0 auto; padding: 20px; background: #f8fafc;">

<div style="background: #0f172a; padding: 28px 32px; border-radius: 12px 12px 0 0;">
  <p style="color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; margin: 0 0 8px;">Ambrosia Ventures · Deal Intelligence</p>
  <h1 style="color: #fff; margin: 0; font-size: 20px; font-weight: 600;">What BD teams are benchmarking this week</h1>
</div>

<div style="background: #fff; padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">

  <p style="font-size: 15px; color: #334155; margin-top: 0;">Here's what life sciences professionals searched most on the platform this week:</p>

  <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
    <thead>
      <tr>
        <th style="text-align: left; padding: 8px 0; font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em; border-bottom: 2px solid #e2e8f0;">Benchmark</th>
        <th style="text-align: right; padding: 8px 0; font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em; border-bottom: 2px solid #e2e8f0;">Volume</th>
        <th style="text-align: right; padding: 8px 0; font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em; border-bottom: 2px solid #e2e8f0;">vs Last Week</th>
      </tr>
    </thead>
    <tbody>
      ${benchmarkRows}
    </tbody>
  </table>

  <p style="font-size: 15px; color: #334155;">Seeing a modality or indication you haven't explored? Run a benchmark to see where your deal stacks up.</p>

  <div style="text-align: center; margin: 28px 0 20px;">
    <a href="https://calculator.ambrosiaventures.co/calculator" style="display: inline-block; background: #0f172a; color: #fff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
      Get the full breakdown — $499 per report
    </a>
  </div>

  <p style="font-size: 13px; color: #94a3b8; text-align: center; margin-bottom: 0;">Data from ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}. Updated weekly.</p>
</div>

<div style="text-align: center; padding: 20px; color: #94a3b8; font-size: 11px;">
  <p style="margin: 0;">Ambrosia Ventures · <a href="https://ambrosiaventures.co" style="color: #94a3b8;">ambrosiaventures.co</a></p>
  <p style="margin: 6px 0 0;"><a href="https://calculator.ambrosiaventures.co/unsubscribe?email=${encodeURIComponent(email)}" style="color: #94a3b8;">Unsubscribe</a></p>
</div>

</body></html>`;

  return { subject, html };
}

// ---------------------------------------------------------------------------
// Day 5: Direct conversion push
// ---------------------------------------------------------------------------

export function buildDay5Email(email: string): { subject: string; html: string } {
  const subject = 'Your next licensing conversation, prepared in 30 seconds';

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.7; color: #1e293b; max-width: 560px; margin: 0 auto; padding: 20px; background: #f8fafc;">

<div style="background: #0f172a; padding: 28px 32px; border-radius: 12px 12px 0 0;">
  <p style="color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; margin: 0 0 8px;">Ambrosia Ventures · Deal Intelligence</p>
  <h1 style="color: #fff; margin: 0; font-size: 20px; font-weight: 600;">Walk into your next deal conversation prepared</h1>
</div>

<div style="background: #fff; padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">

  <p style="font-size: 15px; color: #334155; margin-top: 0;">You've seen the headline benchmarks. Here's what the full Deal Intelligence Report gives you:</p>

  <div style="margin: 24px 0;">
    <div style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 16px;">
      <div style="width: 24px; height: 24px; background: #f0fdf4; border-radius: 6px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px;">
        <span style="color: #16a34a; font-size: 14px;">✓</span>
      </div>
      <div>
        <p style="margin: 0; font-size: 14px; font-weight: 600; color: #0f172a;">Complete deal structure breakdown</p>
        <p style="margin: 4px 0 0; font-size: 13px; color: #64748b;">Upfront, dev milestones, reg milestones, commercial milestones, tiered royalties — with ranges and expected values</p>
      </div>
    </div>
    <div style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 16px;">
      <div style="width: 24px; height: 24px; background: #f0fdf4; border-radius: 6px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px;">
        <span style="color: #16a34a; font-size: 14px;">✓</span>
      </div>
      <div>
        <p style="margin: 0; font-size: 14px; font-weight: 600; color: #0f172a;">15+ comparable transactions</p>
        <p style="margin: 4px 0 0; font-size: 13px; color: #64748b;">Real deals with parties, values, dates, and structure — sourced from SEC filings and FTC premerger filings</p>
      </div>
    </div>
    <div style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 16px;">
      <div style="width: 24px; height: 24px; background: #f0fdf4; border-radius: 6px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px;">
        <span style="color: #16a34a; font-size: 14px;">✓</span>
      </div>
      <div>
        <p style="margin: 0; font-size: 14px; font-weight: 600; color: #0f172a;">AI-generated deal memo</p>
        <p style="margin: 4px 0 0; font-size: 13px; color: #64748b;">Board-ready analysis of your deal's positioning, risks, and negotiation leverage</p>
      </div>
    </div>
    <div style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 16px;">
      <div style="width: 24px; height: 24px; background: #f0fdf4; border-radius: 6px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px;">
        <span style="color: #16a34a; font-size: 14px;">✓</span>
      </div>
      <div>
        <p style="margin: 0; font-size: 14px; font-weight: 600; color: #0f172a;">Negotiation playbook</p>
        <p style="margin: 4px 0 0; font-size: 13px; color: #64748b;">Specific tactics for your modality and phase, with data-backed arguments</p>
      </div>
    </div>
    <div style="display: flex; align-items: flex-start; gap: 12px;">
      <div style="width: 24px; height: 24px; background: #f0fdf4; border-radius: 6px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px;">
        <span style="color: #16a34a; font-size: 14px;">✓</span>
      </div>
      <div>
        <p style="margin: 0; font-size: 14px; font-weight: 600; color: #0f172a;">Branded PDF export</p>
        <p style="margin: 4px 0 0; font-size: 13px; color: #64748b;">Share with your board, investors, or deal team</p>
      </div>
    </div>
  </div>

  <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin: 24px 0; text-align: center;">
    <p style="margin: 0; font-size: 13px; color: #64748b;">A licensing consultant charges <span style="text-decoration: line-through;">$5,000–$25,000</span> for comparable analysis.</p>
    <p style="margin: 8px 0 0; font-size: 28px; font-weight: 700; color: #0f172a;">$499</p>
    <p style="margin: 4px 0 0; font-size: 13px; color: #64748b;">One report. One deal. Everything you need.</p>
  </div>

  <div style="text-align: center; margin: 28px 0 20px;">
    <a href="https://calculator.ambrosiaventures.co/report" style="display: inline-block; background: #0f172a; color: #fff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">
      Get Your Deal Report — $499
    </a>
  </div>

  <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-bottom: 0;">After this, you'll receive our weekly deal digest with market insights. Unsubscribe anytime.</p>
</div>

<div style="text-align: center; padding: 20px; color: #94a3b8; font-size: 11px;">
  <p style="margin: 0;">Ambrosia Ventures · <a href="https://ambrosiaventures.co" style="color: #94a3b8;">ambrosiaventures.co</a></p>
  <p style="margin: 6px 0 0;"><a href="https://calculator.ambrosiaventures.co/unsubscribe?email=${encodeURIComponent(email)}" style="color: #94a3b8;">Unsubscribe</a></p>
</div>

</body></html>`;

  return { subject, html };
}
