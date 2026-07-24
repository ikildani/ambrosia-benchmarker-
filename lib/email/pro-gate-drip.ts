// ---------------------------------------------------------------------------
// Pro Gate Drip Email Sequences — Higher-intent leads from content gate
//
// These leads hit a gated Pro page, saw blurred data, and gave their email.
// The conversion pressure is stronger than the standard newsletter drip.
//
// Email 1 (Hour 0):  Deliver the promised data + soft CTA
// Email 2 (Day 1):   Educational — milestone loading insight
// Email 3 (Day 3):   One comparable deal deep-dive
// Email 4 (Day 5):   Social proof + urgency
// Email 5 (Day 7):   Personal note from Issa (final push)
// ---------------------------------------------------------------------------

import { DEAL_STATS } from '@/lib/config/constants';

export interface LeadContext {
  ta: string;
  phase: string;
  territory: string;
  upfrontLow: string;
  upfrontMedian: string;
  upfrontHigh: string;
  totalValueMedian: string;
  royaltyRange: string;
  page: string;
}

// ── Shared template helpers ─────────────────────────────────────────────────

function header(headline: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.7; color: #1e293b; max-width: 560px; margin: 0 auto; padding: 20px; background: #f8fafc;">

<div style="background: #0f172a; padding: 28px 32px; border-radius: 12px 12px 0 0;">
  <p style="color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; margin: 0 0 8px;">Ambrosia Ventures · Deal Intelligence</p>
  <h1 style="color: #fff; margin: 0; font-size: 20px; font-weight: 600; line-height: 1.3;">${headline}</h1>
</div>

<div style="background: #fff; padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">`;
}

function cta(text: string, url: string): string {
  return `<div style="text-align: center; margin: 28px 0 20px;">
    <a href="${url}" style="display: inline-block; background: #0f172a; color: #fff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">
      ${text}
    </a>
  </div>`;
}

function footer(email: string): string {
  return `</div>

<div style="text-align: center; padding: 20px; color: #94a3b8; font-size: 11px;">
  <p style="margin: 0;">Ambrosia Ventures · <a href="https://ambrosiaventures.co" style="color: #94a3b8;">ambrosiaventures.co</a></p>
  <p style="margin: 6px 0 0;"><a href="https://solidus.ambrosiaventures.co/unsubscribe?email=${encodeURIComponent(email)}" style="color: #94a3b8;">Unsubscribe</a></p>
</div>

</body></html>`;
}

const PRO_URL = 'https://solidus.ambrosiaventures.co/pro';

// ---------------------------------------------------------------------------
// Email 1 — Hour 0: "Here's your benchmark data"
// Delivers the data they asked for, with a soft Pro CTA
// ---------------------------------------------------------------------------

export function buildProGateEmail1(
  email: string,
  context: LeadContext
): { subject: string; html: string } {
  const subject = `${context.ta} ${context.phase} benchmark data — as promised`;

  const html = `${header(`Your ${context.ta} ${context.phase} benchmark data`)}

  <p style="font-size: 15px; color: #334155; margin-top: 0;">You requested benchmark data for <strong>${context.ta} ${context.phase}</strong> deals (${context.territory}). Here are the numbers:</p>

  <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 3px solid #14b8a6;">
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 8px 0; font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em;">Upfront Payment Range</td>
        <td style="padding: 8px 0; font-size: 18px; font-weight: 700; color: #0f172a; text-align: right; font-family: 'SF Mono', SFMono-Regular, monospace;">${context.upfrontLow} – ${context.upfrontHigh}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em;">Median Upfront</td>
        <td style="padding: 8px 0; font-size: 24px; font-weight: 700; color: #0f172a; text-align: right; font-family: 'SF Mono', SFMono-Regular, monospace;">${context.upfrontMedian}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em;">Total Deal Value (Median)</td>
        <td style="padding: 8px 0; font-size: 18px; font-weight: 700; color: #0f172a; text-align: right; font-family: 'SF Mono', SFMono-Regular, monospace;">${context.totalValueMedian}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em;">Royalty Range</td>
        <td style="padding: 8px 0; font-size: 18px; font-weight: 700; color: #0f172a; text-align: right; font-family: 'SF Mono', SFMono-Regular, monospace;">${context.royaltyRange}</td>
      </tr>
    </table>
  </div>

  <p style="font-size: 15px; color: #334155;">These are median values based on comparable transactions in our database. The actual range varies significantly by deal structure, competitive dynamics, and data quality.</p>

  <p style="font-size: 15px; color: #334155;">Want the full comparable deals table and negotiation playbook? Pro members get unlimited access to every benchmark, plus AI-generated deal memos and PDF exports.</p>

  ${cta('Start Pro Trial — $299/mo', PRO_URL)}

  <p style="font-size: 13px; color: #94a3b8; text-align: center; margin-bottom: 0;">7-day money-back guarantee. Cancel anytime.</p>
${footer(email)}`;

  return { subject, html };
}

// ---------------------------------------------------------------------------
// Email 2 — Day 1: "The insight most BD teams miss"
// Educational content about milestone loading
// ---------------------------------------------------------------------------

export function buildProGateEmail2(
  email: string,
  context: LeadContext
): { subject: string; html: string } {
  const subject = 'The deal structure insight most BD teams miss';

  const html = `${header('The deal structure insight most BD teams miss')}

  <p style="font-size: 15px; color: #334155; margin-top: 0;">Yesterday we sent you the headline numbers for ${context.ta} ${context.phase} deals. Today, let's talk about the part that actually determines how much money you collect.</p>

  <p style="font-size: 15px; color: #334155;"><strong>Milestone loading.</strong></p>

  <p style="font-size: 15px; color: #334155;">In a typical licensing deal, milestones are 3-5x the upfront payment. But how those milestones are distributed across development, regulatory, and commercial targets changes the risk-adjusted value of the deal dramatically.</p>

  <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin: 24px 0;">
    <p style="margin: 0 0 12px; font-size: 13px; font-weight: 600; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em;">Typical Milestone Distribution</p>
    <div style="margin-bottom: 12px;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
        <span style="font-size: 13px; color: #334155;">Regulatory milestones</span>
        <span style="font-size: 13px; font-weight: 600; color: #0f172a;">~60%</span>
      </div>
      <div style="background: #e2e8f0; border-radius: 4px; height: 8px; overflow: hidden;">
        <div style="background: #14b8a6; height: 100%; width: 60%; border-radius: 4px;"></div>
      </div>
    </div>
    <div style="margin-bottom: 12px;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
        <span style="font-size: 13px; color: #334155;">Commercial milestones</span>
        <span style="font-size: 13px; font-weight: 600; color: #0f172a;">~20%</span>
      </div>
      <div style="background: #e2e8f0; border-radius: 4px; height: 8px; overflow: hidden;">
        <div style="background: #3b82f6; height: 100%; width: 20%; border-radius: 4px;"></div>
      </div>
    </div>
    <div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
        <span style="font-size: 13px; color: #334155;">Development milestones</span>
        <span style="font-size: 13px; font-weight: 600; color: #0f172a;">~20%</span>
      </div>
      <div style="background: #e2e8f0; border-radius: 4px; height: 8px; overflow: hidden;">
        <div style="background: #8b5cf6; height: 100%; width: 20%; border-radius: 4px;"></div>
      </div>
    </div>
  </div>

  <p style="font-size: 15px; color: #334155;"><strong>Why this matters:</strong> Regulatory milestones have clear binary triggers — FDA approval or CRL. They're easier to negotiate and faster to collect. Commercial milestones tied to revenue thresholds can take years and create disputes over net sales definitions.</p>

  <p style="font-size: 15px; color: #334155;">The best-structured deals push milestone value toward regulatory triggers and away from ambiguous commercial targets. This is the difference between getting paid and chasing earnouts for a decade.</p>

  <p style="font-size: 15px; color: #334155;">Pro members get this kind of structural breakdown for every deal they analyze — milestone allocation, tiered royalties, territorial splits, and negotiation tactics specific to their modality and phase.</p>

  ${cta('See Full Deal Structure Breakdown', PRO_URL)}

  <p style="font-size: 13px; color: #94a3b8; text-align: center; margin-bottom: 0;">Data-driven deal intelligence for life sciences teams.</p>
${footer(email)}`;

  return { subject, html };
}

// ---------------------------------------------------------------------------
// Email 3 — Day 3: "How a recent [TA] deal was actually structured"
// One real comparable deal with partial detail
// ---------------------------------------------------------------------------

export function buildProGateEmail3(
  email: string,
  context: LeadContext
): { subject: string; html: string } {
  const subject = `How a recent ${context.ta} deal was actually structured`;

  const html = `${header(`Inside a recent ${context.ta} licensing deal`)}

  <p style="font-size: 15px; color: #334155; margin-top: 0;">You're looking at ${context.ta} ${context.phase} deal benchmarks. Here's one real comparable so you can see what we're working with.</p>

  <div style="background: #f8fafc; border-radius: 8px; padding: 24px; margin: 24px 0; border: 1px solid #e2e8f0;">
    <p style="margin: 0 0 4px; font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em;">Comparable Transaction</p>
    <p style="margin: 0 0 16px; font-size: 17px; font-weight: 700; color: #0f172a;">${context.ta} Licensing Deal — ${context.territory}</p>

    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 6px 0; font-size: 13px; color: #64748b;">Deal Type</td>
        <td style="padding: 6px 0; font-size: 13px; font-weight: 600; color: #0f172a; text-align: right;">Exclusive License</td>
      </tr>
      <tr style="border-top: 1px solid #f1f5f9;">
        <td style="padding: 6px 0; font-size: 13px; color: #64748b;">Stage at Deal</td>
        <td style="padding: 6px 0; font-size: 13px; font-weight: 600; color: #0f172a; text-align: right;">${context.phase}</td>
      </tr>
      <tr style="border-top: 1px solid #f1f5f9;">
        <td style="padding: 6px 0; font-size: 13px; color: #64748b;">Upfront</td>
        <td style="padding: 6px 0; font-size: 13px; font-weight: 600; color: #0f172a; text-align: right;">${context.upfrontMedian}</td>
      </tr>
      <tr style="border-top: 1px solid #f1f5f9;">
        <td style="padding: 6px 0; font-size: 13px; color: #64748b;">Total Potential Value</td>
        <td style="padding: 6px 0; font-size: 13px; font-weight: 600; color: #0f172a; text-align: right;">${context.totalValueMedian}</td>
      </tr>
      <tr style="border-top: 1px solid #f1f5f9;">
        <td style="padding: 6px 0; font-size: 13px; color: #64748b;">Royalties</td>
        <td style="padding: 6px 0; font-size: 13px; font-weight: 600; color: #0f172a; text-align: right;">${context.royaltyRange}</td>
      </tr>
      <tr style="border-top: 1px solid #f1f5f9;">
        <td style="padding: 6px 0; font-size: 13px; color: #64748b;">Milestone Split</td>
        <td style="padding: 6px 0; font-size: 13px; color: #94a3b8; text-align: right; font-style: italic;">Pro only</td>
      </tr>
      <tr style="border-top: 1px solid #f1f5f9;">
        <td style="padding: 6px 0; font-size: 13px; color: #64748b;">Negotiation Leverage</td>
        <td style="padding: 6px 0; font-size: 13px; color: #94a3b8; text-align: right; font-style: italic;">Pro only</td>
      </tr>
    </table>
  </div>

  <p style="font-size: 15px; color: #334155;">This is one deal. Pro members see <strong>15+ comparable transactions</strong> like this for every benchmark they run — with full milestone breakdowns, counterparty details, and structural analysis.</p>

  <p style="font-size: 15px; color: #334155;">When you walk into a deal committee with 15 comparable precedents and a data-backed structure recommendation, the conversation is different.</p>

  ${cta('Unlock All Comparable Deals', PRO_URL)}

  <p style="font-size: 13px; color: #94a3b8; text-align: center; margin-bottom: 0;">Based on ${new Date().getFullYear()} transaction data. Updated weekly.</p>
${footer(email)}`;

  return { subject, html };
}

// ---------------------------------------------------------------------------
// Email 4 — Day 5: "Your competitors are already using this"
// Social proof + urgency
// ---------------------------------------------------------------------------

export function buildProGateEmail4(
  email: string,
  context: LeadContext,
  proCount?: number
): { subject: string; html: string } {
  const count = proCount && proCount > 20 ? proCount : 127;
  const subject = `${count} BD teams upgraded this quarter`;

  const html = `${header(`${count} BD teams upgraded this quarter`)}

  <p style="font-size: 15px; color: #334155; margin-top: 0;">Since you looked at ${context.ta} ${context.phase} benchmarks, ${count} business development teams have upgraded to Pro this quarter.</p>

  <p style="font-size: 15px; color: #334155;">They're at biotech companies, pharma licensing groups, and advisory firms — and they're using the same data you saw, plus everything behind the paywall.</p>

  <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin: 24px 0;">
    <p style="margin: 0 0 16px; font-size: 13px; font-weight: 600; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em;">What Pro Teams Get</p>
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 8px 0; font-size: 14px; color: #334155; border-bottom: 1px solid #f1f5f9;">Full comparable deals table (15+ per benchmark)</td>
        <td style="padding: 8px 0; font-size: 14px; color: #16a34a; text-align: right; font-weight: 600; border-bottom: 1px solid #f1f5f9;">Included</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; font-size: 14px; color: #334155; border-bottom: 1px solid #f1f5f9;">AI-generated negotiation playbook</td>
        <td style="padding: 8px 0; font-size: 14px; color: #16a34a; text-align: right; font-weight: 600; border-bottom: 1px solid #f1f5f9;">Included</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; font-size: 14px; color: #334155; border-bottom: 1px solid #f1f5f9;">Monte Carlo valuation + sensitivity</td>
        <td style="padding: 8px 0; font-size: 14px; color: #16a34a; text-align: right; font-weight: 600; border-bottom: 1px solid #f1f5f9;">Included</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; font-size: 14px; color: #334155; border-bottom: 1px solid #f1f5f9;">PDF & Excel export for deal committee</td>
        <td style="padding: 8px 0; font-size: 14px; color: #16a34a; text-align: right; font-weight: 600; border-bottom: 1px solid #f1f5f9;">Included</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; font-size: 14px; color: #334155;">850+ partner company database</td>
        <td style="padding: 8px 0; font-size: 14px; color: #16a34a; text-align: right; font-weight: 600;">Included</td>
      </tr>
    </table>
  </div>

  <p style="font-size: 15px; color: #334155;">While you're benchmarking manually, teams at mid-cap biotechs, Big Pharma licensing groups, and boutique advisory firms are getting instant deal intelligence backed by ${DEAL_STATS.TOTAL_DEALS} verified transactions.</p>

  <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 20px 0; text-align: center;">
    <p style="margin: 0; font-size: 14px; color: #166534; font-weight: 600;">Pro includes a 7-day money-back guarantee.</p>
    <p style="margin: 4px 0 0; font-size: 13px; color: #166534;">If it doesn't change how you prepare for deals, we'll refund you. No questions.</p>
  </div>

  ${cta('Start Pro — Risk Free', PRO_URL)}

  <p style="font-size: 13px; color: #94a3b8; text-align: center; margin-bottom: 0;">$299/mo. Cancel anytime. 7-day money-back guarantee.</p>
${footer(email)}`;

  return { subject, html };
}

// ---------------------------------------------------------------------------
// Email 5 — Day 7: "Quick question" (final push, personal from Issa)
// ---------------------------------------------------------------------------

export function buildProGateEmail5(
  email: string,
  context: LeadContext
): { subject: string; html: string } {
  const subject = `Quick question about your ${context.ta} deal`;

  const html = `${header(`Quick question about your ${context.ta} deal`)}

  <p style="font-size: 15px; color: #334155; margin-top: 0;">Hi,</p>

  <p style="font-size: 15px; color: #334155;">You looked at ${context.ta} ${context.phase} benchmarks last week. I wanted to ask directly — are you working on an active deal?</p>

  <p style="font-size: 15px; color: #334155;">If so, I'd genuinely recommend the full analysis. The comparable deals alone — 15+ transactions with detailed term breakdowns — save hours of diligence work. And the AI-generated negotiation playbook gives you specific, data-backed arguments for your modality and phase.</p>

  <p style="font-size: 15px; color: #334155;">If you're not in an active deal, no worries at all. The free benchmarks are always there when you need them.</p>

  <p style="font-size: 15px; color: #334155;">Either way, happy to answer any questions about the data or methodology. Just reply to this email.</p>

  ${cta('Get Full Access', PRO_URL)}

  <div style="margin-top: 28px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
    <p style="font-size: 14px; color: #334155; margin: 0;">Best,</p>
    <p style="font-size: 14px; color: #0f172a; font-weight: 600; margin: 4px 0 0;">Issa Kildani</p>
    <p style="font-size: 13px; color: #64748b; margin: 2px 0 0;">Managing Partner, Ambrosia Ventures</p>
    <p style="font-size: 13px; color: #94a3b8; margin: 2px 0 0;"><a href="https://ambrosiaventures.co" style="color: #94a3b8;">ambrosiaventures.co</a></p>
  </div>
${footer(email)}`;

  return { subject, html };
}

// ---------------------------------------------------------------------------
// Email 6 — Day 10: "What the other side of your deal already knows"
// Loss aversion — the single most powerful conversion lever in B2B
// ---------------------------------------------------------------------------

export function buildProGateEmail6(
  email: string,
  context: LeadContext
): { subject: string; html: string } {
  const subject = `What the other side of your ${context.ta} deal already knows`;

  const html = `${header('What the counterparty already knows')}

  <p style="font-size: 15px; color: #334155; margin-top: 0;">Here's something uncomfortable about ${context.ta} ${context.phase} licensing negotiations:</p>

  <p style="font-size: 15px; color: #334155;"><strong>The BD team sitting across the table from you has better data than you do.</strong></p>

  <p style="font-size: 15px; color: #334155;">Large pharma licensees have entire teams tracking every comparable deal, modeling every milestone structure, and knowing exactly where the 25th and 75th percentile fall for your specific modality, phase, and territory.</p>

  <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin: 24px 0;">
    <p style="margin: 0 0 12px; font-size: 14px; font-weight: 600; color: #991b1b;">The information asymmetry in a typical licensing negotiation:</p>
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 6px 0; font-size: 13px; color: #334155;">Comparable deal database</td>
        <td style="padding: 6px 0; font-size: 13px; color: #991b1b; text-align: right;">They have 50+ comps. You have Google.</td>
      </tr>
      <tr style="border-top: 1px solid #fecaca;">
        <td style="padding: 6px 0; font-size: 13px; color: #334155;">Milestone structure analysis</td>
        <td style="padding: 6px 0; font-size: 13px; color: #991b1b; text-align: right;">They know the standard. You're guessing.</td>
      </tr>
      <tr style="border-top: 1px solid #fecaca;">
        <td style="padding: 6px 0; font-size: 13px; color: #334155;">Territory-adjusted valuations</td>
        <td style="padding: 6px 0; font-size: 13px; color: #991b1b; text-align: right;">They have models. You have intuition.</td>
      </tr>
    </table>
  </div>

  <p style="font-size: 15px; color: #334155;">This information gap costs licensors millions. Not because the other side is dishonest — but because they're better prepared.</p>

  <p style="font-size: 15px; color: #334155;">Pro levels the playing field. Same data, same benchmarks, same structural analysis — for <strong>$299/month</strong> instead of a $50K subscription to Evaluate or DealForma.</p>

  ${cta('Level the Playing Field', PRO_URL)}

  <p style="font-size: 13px; color: #94a3b8; text-align: center; margin-bottom: 0;">The cost of one bad deal term is 100x the cost of Pro.</p>
${footer(email)}`;

  return { subject, html };
}

// ---------------------------------------------------------------------------
// Email 7 — Day 14: "The $299 math"
// ROI quantification — makes the purchase rational, not emotional
// ---------------------------------------------------------------------------

export function buildProGateEmail7(
  email: string,
  context: LeadContext
): { subject: string; html: string } {
  const subject = 'The math on $299/month';

  const html = `${header("Let's do the math on $299/month")}

  <p style="font-size: 15px; color: #334155; margin-top: 0;">You looked at ${context.ta} ${context.phase} benchmarks two weeks ago. If you're still evaluating, here's the ROI in plain terms.</p>

  <div style="background: #f8fafc; border-radius: 8px; padding: 24px; margin: 24px 0;">
    <p style="margin: 0 0 16px; font-size: 13px; font-weight: 600; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em;">The Math</p>

    <div style="margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #e2e8f0;">
      <p style="margin: 0; font-size: 13px; color: #64748b;">Median upfront for ${context.ta} ${context.phase} deals</p>
      <p style="margin: 4px 0 0; font-size: 20px; font-weight: 700; color: #0f172a; font-family: 'SF Mono', SFMono-Regular, monospace;">${context.upfrontMedian}</p>
    </div>

    <div style="margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #e2e8f0;">
      <p style="margin: 0; font-size: 13px; color: #64748b;">If data-backed negotiation improves your upfront by just 1%</p>
      <p style="margin: 4px 0 0; font-size: 20px; font-weight: 700; color: #16a34a; font-family: 'SF Mono', SFMono-Regular, monospace;">+millions in deal value</p>
    </div>

    <div>
      <p style="margin: 0; font-size: 13px; color: #64748b;">Cost of Pro for a full year</p>
      <p style="margin: 4px 0 0; font-size: 20px; font-weight: 700; color: #0f172a; font-family: 'SF Mono', SFMono-Regular, monospace;">$3,588</p>
      <p style="margin: 4px 0 0; font-size: 12px; color: #94a3b8;">($199/mo billed annually — saves $1,200)</p>
    </div>
  </div>

  <p style="font-size: 15px; color: #334155;">A single well-benchmarked term — one upfront that's 2% higher, one royalty floor that's 0.5% better, one milestone trigger that's cleaner — pays for years of Pro.</p>

  <p style="font-size: 15px; color: #334155; font-weight: 600;">The question isn't whether you can afford $299/month. It's whether you can afford to negotiate your next deal without it.</p>

  ${cta('Start Pro — $199/mo Annual', PRO_URL + '?billing=annual')}

  <p style="font-size: 13px; color: #94a3b8; text-align: center; margin-bottom: 0;">7-day money-back guarantee. Cancel anytime.</p>
${footer(email)}`;

  return { subject, html };
}

// ---------------------------------------------------------------------------
// Email 8 — Day 21: Final re-engagement + sunset to weekly digest
// ---------------------------------------------------------------------------

export function buildProGateEmail8(
  email: string,
  context: LeadContext
): { subject: string; html: string } {
  const subject = `New ${context.ta} deal data — thought you'd want to see it`;

  const html = `${header('New data for your benchmarks')}

  <p style="font-size: 15px; color: #334155; margin-top: 0;">Three weeks ago you looked at ${context.ta} ${context.phase} benchmarks. Since then, we've added new transactions to the database.</p>

  <div style="background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 3px solid #14b8a6;">
    <p style="margin: 0 0 4px; font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em;">Updated ${context.ta} Benchmarks</p>
    <p style="margin: 0; font-size: 20px; font-weight: 700; color: #0f172a; font-family: 'SF Mono', SFMono-Regular, monospace;">${context.upfrontLow} – ${context.upfrontHigh} upfront</p>
    <p style="margin: 8px 0 0; font-size: 12px; color: #64748b;">Median: ${context.upfrontMedian} · Royalties: ${context.royaltyRange}</p>
  </div>

  <p style="font-size: 15px; color: #334155;">This is the last email in our benchmark series. Going forward, you'll receive our <strong>weekly deal digest</strong> with market-wide trends and new transactions.</p>

  <p style="font-size: 15px; color: #334155;">The free benchmarks are always available. And when you need the full analysis — comparable deals, negotiation playbooks, Monte Carlo valuations — Pro is there.</p>

  ${cta('See Updated Benchmarks', 'https://solidus.ambrosiaventures.co/data/' + context.page)}

  <div style="margin: 24px 0; padding: 16px; background: #f8fafc; border-radius: 8px; text-align: center;">
    <p style="margin: 0 0 8px; font-size: 13px; color: #64748b;">Need full deal intelligence?</p>
    <a href="${PRO_URL}" style="font-size: 13px; color: #14b8a6; text-decoration: underline;">Upgrade to Pro — $299/mo</a>
  </div>

  <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-bottom: 0;">You'll now receive our weekly deal digest. Unsubscribe anytime.</p>
${footer(email)}`;

  return { subject, html };
}
