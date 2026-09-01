/**
 * Lead Scoring & Advisory Conversion Engine
 *
 * Scores Solidus users based on behavior signals to identify
 * prospects for Ambrosia Ventures advisory services.
 * Triggers Slack alerts for hot leads and queues personalized emails.
 */

import { createServiceClient } from '@/lib/supabase/server';

// ── Deal Stage Classification ──────────────────────────────
export type DealStage = 'exploring' | 'evaluating' | 'preparing' | 'active';

export interface LeadScore {
  userId: string;
  email: string;
  fullName?: string;
  company?: string;
  tier: string;
  score: number;
  dealStage: DealStage;
  topTAs: string[];
  recentIndications: string[];
  recentModalities: string[];
  totalCalculations: number;
  calculationsLast7Days: number;
  uniqueTAsLast7Days: number;
  hasExportedPdf: boolean;
  hasUsedBuyerSpecific: boolean;
  buyerSpecificCompanies: string[];
  focusedTA: string | null;
  lastCalculationAt: string | null;
}

export interface CalculationContext {
  therapeuticArea: string;
  indication?: string;
  modality: string;
  phase: string;
  dealType?: string;
  upfrontRange?: [number | null, number | null];
  totalDealValueRange?: [number | null, number | null];
  buyerSpecificCompanies?: string[];
  timestamp: string;
}

// ── Score Calculation ──────────────────────────────────────

export async function computeLeadScore(userId: string): Promise<LeadScore | null> {
  const supabase = createServiceClient();

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id, email, full_name, company, tier')
    .eq('id', userId)
    .single();

  if (!profile) return null;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data: recentCalcs } = await supabase
    .from('calculations')
    .select('therapeutic_area, indication_specific, indication_category, modality, deal_type, development_phase, output_upfront_low, output_upfront_high, output_total_deal_value_low, output_total_deal_value_high, created_at')
    .eq('user_id', userId)
    .gte('created_at', sevenDaysAgo.toISOString())
    .order('created_at', { ascending: false });

  const { count: totalCalcs } = await supabase
    .from('calculations')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  const { data: recentEvents } = await supabase
    .from('events')
    .select('event_type, event_data')
    .eq('user_id', userId)
    .gte('created_at', sevenDaysAgo.toISOString());

  const calcs7d = recentCalcs?.length || 0;
  const uniqueTAs = new Set(recentCalcs?.map(c => c.therapeutic_area).filter(Boolean));
  const indications = [...new Set(recentCalcs?.map(c => c.indication_specific || c.indication_category).filter(Boolean))];
  const modalities = [...new Set(recentCalcs?.map(c => c.modality).filter(Boolean))];
  const topTAs = [...uniqueTAs];

  // Check for same-TA concentration (3+ in same TA)
  const taCounts: Record<string, number> = {};
  recentCalcs?.forEach(c => {
    if (c.therapeutic_area) taCounts[c.therapeutic_area] = (taCounts[c.therapeutic_area] || 0) + 1;
  });
  const focusedTA = Object.entries(taCounts).find(([, count]) => count >= 3)?.[0] || null;

  // Check for exports and buyer-specific usage
  const hasExportedPdf = recentEvents?.some(e => e.event_type === 'pdf_exported' || e.event_type === 'report_exported') || false;
  const buyerSpecificEvents = recentEvents?.filter(e => e.event_type === 'buyer_specific_viewed') || [];
  const hasUsedBuyerSpecific = buyerSpecificEvents.length > 0;
  const buyerSpecificCompanies = [...new Set(
    buyerSpecificEvents.flatMap(e => {
      const data = e.event_data as Record<string, unknown>;
      return (data?.companies as string[]) || [];
    })
  )];

  // Check for known biotech/pharma domain
  const domain = profile.email?.split('@')[1] || '';
  const isBiotechDomain = !['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com', 'icloud.com', 'protonmail.com'].includes(domain);

  // ── Calculate Score ──
  let score = 0;

  // Calculation volume
  if (calcs7d >= 5) score += 25;
  else if (calcs7d >= 3) score += 15;
  else if (calcs7d >= 1) score += 5;

  // Same-TA concentration (deal-readiness signal)
  if (focusedTA) score += 30;

  // PDF export (sharing internally)
  if (hasExportedPdf) score += 20;

  // Buyer-specific valuation (has counterparty in mind)
  if (hasUsedBuyerSpecific) score += 25;

  // Multiple buyer-specific runs (shopping the deal)
  if (buyerSpecificCompanies.length >= 3) score += 10;

  // Corporate email domain
  if (isBiotechDomain) score += 15;

  // ── Classify Deal Stage ──
  let dealStage: DealStage = 'exploring';

  if (calcs7d >= 5 && (hasExportedPdf || hasUsedBuyerSpecific)) {
    dealStage = 'active';
  } else if (hasExportedPdf || hasUsedBuyerSpecific) {
    dealStage = 'preparing';
  } else if (focusedTA) {
    dealStage = 'evaluating';
  }

  return {
    userId,
    email: profile.email,
    fullName: profile.full_name || undefined,
    company: profile.company || undefined,
    tier: profile.tier || 'free',
    score: Math.min(score, 100),
    dealStage,
    topTAs,
    recentIndications: indications.slice(0, 5),
    recentModalities: modalities.slice(0, 5),
    totalCalculations: totalCalcs || 0,
    calculationsLast7Days: calcs7d,
    uniqueTAsLast7Days: uniqueTAs.size,
    hasExportedPdf,
    hasUsedBuyerSpecific,
    buyerSpecificCompanies,
    focusedTA,
    lastCalculationAt: recentCalcs?.[0]?.created_at || null,
  };
}

// ── Check & Alert After Each Calculation ───────────────────

export async function checkLeadScoreAndAlert(
  userId: string,
  calculationContext: CalculationContext,
): Promise<void> {
  try {
    const lead = await computeLeadScore(userId);
    if (!lead) return;

    // Skip portfolio-tier users (they already have a relationship)
    if (lead.tier === 'portfolio') return;

    // Store calculation context for personalized emails
    const supabase = createServiceClient();
    await supabase.from('lead_events').insert({
      user_id: userId,
      event_type: 'calculation',
      context: calculationContext,
      lead_score: lead.score,
      deal_stage: lead.dealStage,
    }).catch(() => {});

    // Hot lead alert (score > 50)
    if (lead.score > 50) {
      await notifyHotLead(lead, calculationContext);
    }

    // Email triggers
    await checkEmailTriggers(lead, calculationContext);
  } catch (err) {
    console.error('[LeadScoring] Error:', err);
  }
}

// ── Slack Hot Lead Alert ───────────────────────────────────

async function notifyHotLead(lead: LeadScore, latestCalc: CalculationContext): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;

  const stageEmoji: Record<DealStage, string> = {
    exploring: ':eyes:',
    evaluating: ':mag:',
    preparing: ':memo:',
    active: ':fire:',
  };

  const stageLabel: Record<DealStage, string> = {
    exploring: 'Exploring',
    evaluating: 'Evaluating — focused on specific TA',
    preparing: 'Preparing — exports and buyer research',
    active: 'Active — term sheet likely imminent',
  };

  const formatRange = (low: number | null, high: number | null): string => {
    if (!low && !high) return 'N/A';
    const fmt = (n: number) => n >= 1e9 ? `$${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(0)}M` : `$${(n / 1e3).toFixed(0)}K`;
    if (low && high) return `${fmt(low)} – ${fmt(high)}`;
    return fmt(low || high || 0);
  };

  const buyerLine = lead.buyerSpecificCompanies.length > 0
    ? `\n*Buyer-specific valuations run for:* ${lead.buyerSpecificCompanies.join(', ')}`
    : '';

  const body = JSON.stringify({
    text: `${stageEmoji[lead.dealStage]} Hot Lead — Score: ${lead.score}`,
    attachments: [{
      color: lead.score >= 80 ? '#DC2626' : lead.score >= 60 ? '#F59E0B' : '#14B8A6',
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: `${stageEmoji[lead.dealStage]} Hot Lead — ${lead.email}`, emoji: true },
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Email:*\n${lead.email}` },
            { type: 'mrkdwn', text: `*Company:*\n${lead.company || 'Unknown'}` },
            { type: 'mrkdwn', text: `*Score:*\n${lead.score}/100` },
            { type: 'mrkdwn', text: `*Deal Stage:*\n${stageLabel[lead.dealStage]}` },
            { type: 'mrkdwn', text: `*Calcs (7d):*\n${lead.calculationsLast7Days} (${lead.totalCalculations} total)` },
            { type: 'mrkdwn', text: `*Tier:*\n${lead.tier.toUpperCase()}` },
          ],
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Latest calculation:*\n${latestCalc.phase} ${latestCalc.modality} in ${latestCalc.indication || latestCalc.therapeuticArea}${latestCalc.dealType ? ` (${latestCalc.dealType})` : ''}\n*Upfront modeled:* ${formatRange(latestCalc.upfrontRange?.[0] ?? null, latestCalc.upfrontRange?.[1] ?? null)}\n*TDV modeled:* ${formatRange(latestCalc.totalDealValueRange?.[0] ?? null, latestCalc.totalDealValueRange?.[1] ?? null)}${buyerLine}\n\n*Focused TA:* ${lead.focusedTA || 'No concentration yet'}\n*Recent indications:* ${lead.recentIndications.join(', ') || 'N/A'}\n*Recent modalities:* ${lead.recentModalities.join(', ') || 'N/A'}`,
          },
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: lead.dealStage === 'active'
                ? ':rotating_light: *SUGGESTED ACTION:* Reach out directly. This user is modeling a live deal.'
                : lead.dealStage === 'preparing'
                  ? ':point_right: *SUGGESTED ACTION:* Send a personalized note referencing their specific asset work.'
                  : ':hourglass: *SUGGESTED ACTION:* Let the drip sequence run. Monitor for stage change.',
            },
          ],
        },
      ],
    }],
  });

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
  } catch (err) {
    console.error('[LeadScoring] Slack alert failed:', err);
  }
}

// ── Email Drip Triggers (Full Revenue Funnel) ────────────

async function checkEmailTriggers(lead: LeadScore, latestCalc: CalculationContext): Promise<void> {
  const supabase = createServiceClient();

  const allEmailTypes = [
    'pro_nudge_sent', 'email_1_sent', 'brief_upsell_sent',
    'email_2_sent', 'email_3_sent',
  ];

  const { data: sentEmails } = await supabase
    .from('lead_events')
    .select('event_type')
    .eq('user_id', lead.userId)
    .in('event_type', allEmailTypes);

  const sent = new Set(sentEmails?.map(e => e.event_type) || []);

  // ── 1. Pro Nudge — free user, 3rd calculation ──
  if (!sent.has('pro_nudge_sent') && lead.tier === 'free' && lead.totalCalculations >= 3) {
    await queueFunnelEmail(lead, 'pro_nudge', latestCalc);
  }

  // ── 2. Evaluating Nurture — 2nd calc in same TA ──
  if (!sent.has('email_1_sent') && lead.focusedTA && lead.calculationsLast7Days >= 2) {
    await queueAdvisoryEmail(lead, 'email_1', latestCalc);
  }

  // ── 3. Intelligence Brief Upsell — Pro user, 5+ calcs in same TA ──
  if (
    !sent.has('brief_upsell_sent') &&
    (lead.tier === 'pro' || lead.tier === 'report') &&
    lead.focusedTA &&
    lead.score > 40 &&
    lead.calculationsLast7Days >= 5
  ) {
    await queueFunnelEmail(lead, 'brief_upsell', latestCalc);
  }

  // ── 4. Export Follow-up — after PDF export ──
  if (!sent.has('email_2_sent') && lead.hasExportedPdf) {
    await queueAdvisoryEmail(lead, 'email_2', latestCalc);
  }

  // ── 5. Advisory Outreach — score > 70, direct from Issa ──
  if (!sent.has('email_3_sent') && lead.score > 70) {
    await queueAdvisoryEmail(lead, 'email_3', latestCalc);
  }

  // ── 6. Portfolio License Detection — multi-user from same domain ──
  await checkPortfolioLicenseSignal(lead);
}

// ── Portfolio License Detection ──────────────────────────

async function checkPortfolioLicenseSignal(lead: LeadScore): Promise<void> {
  const domain = lead.email?.split('@')[1];
  if (!domain) return;

  const genericDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com', 'icloud.com', 'protonmail.com', 'me.com'];
  if (genericDomains.includes(domain)) return;

  const supabase = createServiceClient();

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Count distinct active users from the same domain
  const { data: domainUsers } = await supabase
    .from('user_profiles')
    .select('id, email, full_name')
    .like('email', `%@${domain}`)
    .limit(20);

  if (!domainUsers || domainUsers.length < 3) return;

  // Check if each domain user has been active recently
  const activeUsers: { email: string; name?: string; calcCount: number }[] = [];
  for (const user of domainUsers) {
    const { count } = await supabase
      .from('calculations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', thirtyDaysAgo.toISOString());
    if (count && count > 0) {
      activeUsers.push({ email: user.email, name: user.full_name || undefined, calcCount: count });
    }
  }

  if (activeUsers.length < 3) return;

  // Check if we already alerted for this domain recently
  const { data: recentAlert } = await supabase
    .from('lead_events')
    .select('id')
    .eq('event_type', 'portfolio_signal')
    .eq('context->>domain', domain)
    .gte('created_at', thirtyDaysAgo.toISOString())
    .limit(1);

  if (recentAlert && recentAlert.length > 0) return;

  // Record and alert
  await supabase.from('lead_events').insert({
    user_id: lead.userId,
    event_type: 'portfolio_signal',
    context: { domain, activeUsers, userCount: activeUsers.length },
    lead_score: lead.score,
    deal_stage: 'enterprise',
  }).catch(() => {});

  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;

  const userLines = activeUsers
    .sort((a, b) => b.calcCount - a.calcCount)
    .map(u => `  • ${u.email}${u.name ? ` (${u.name})` : ''} — ${u.calcCount} calculations`)
    .join('\n');

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: `:office: Portfolio License Signal — ${activeUsers.length} users from @${domain}`,
      attachments: [{
        color: '#8B5CF6',
        blocks: [
          {
            type: 'header',
            text: { type: 'plain_text', text: `🏢 Portfolio License Opportunity — @${domain}`, emoji: true },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*${activeUsers.length} active users from @${domain} in the last 30 days:*\n${userLines}\n\n*This is a $30–120K/yr Portfolio License opportunity.*\nDo NOT email about Portfolio License — reach out personally.`,
            },
          },
          {
            type: 'context',
            elements: [{ type: 'mrkdwn', text: ':point_right: *ACTION:* Identify the operating partner or Head of BD and send a personalized note.' }],
          },
        ],
      }],
    }),
  }).catch(() => {});
}

// ── Funnel Emails (Pro Nudge + Brief Upsell) ─────────────

async function queueFunnelEmail(
  lead: LeadScore,
  emailType: 'pro_nudge' | 'brief_upsell',
  latestCalc: CalculationContext,
): Promise<void> {
  const supabase = createServiceClient();

  await supabase.from('lead_events').insert({
    user_id: lead.userId,
    event_type: `${emailType}_sent`,
    context: { lead_score: lead.score, deal_stage: lead.dealStage, ...latestCalc },
  }).catch(() => {});

  const { sendEmail } = await import('@/lib/email/client');

  const name = lead.fullName?.split(' ')[0] || 'there';
  const indicationRef = latestCalc.indication || latestCalc.therapeuticArea;
  const taRef = latestCalc.therapeuticArea?.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) || 'your therapeutic area';

  const templates: Record<string, { subject: string; body: string }> = {
    pro_nudge: {
      subject: `You've run ${lead.totalCalculations} analyses — unlock the full engine`,
      body: `
        <p>Hi ${name},</p>
        <p>You've been benchmarking deals in ${taRef} — and you've hit the point where the free tier can't show you the full picture.</p>
        <p>With Pro, every calculation includes:</p>
        <ul style="color: #334155; line-height: 2;">
          <li><strong>Monte Carlo simulation</strong> — 10,000-iteration probability distribution, not just point estimates</li>
          <li><strong>Buyer-specific valuation</strong> — how Pfizer, AbbVie, or Novartis would value your asset differently</li>
          <li><strong>Comparable transactions</strong> — the actual deals your negotiation will be benchmarked against</li>
          <li><strong>Partner matching</strong> — scored against 850+ companies on 11 strategic dimensions</li>
          <li><strong>AI deal memo</strong> — board-ready narrative with negotiation playbook</li>
        </ul>
        <p><strong>$299/month. Cancel anytime.</strong> Or start with a <a href="https://solidus.ambrosiaventures.co/trial" style="color: #14B8A6; font-weight: 600;">7-day free trial</a> and see everything on your next calculation.</p>
        <p>Best,<br>The Solidus Team</p>
      `,
    },
    brief_upsell: {
      subject: `Get the complete ${indicationRef} deal landscape`,
      body: `
        <p>Hi ${name},</p>
        <p>You've been deep in ${indicationRef} deal benchmarking — ${lead.calculationsLast7Days} calculations this week across ${lead.recentModalities.slice(0, 3).join(', ') || 'multiple modalities'}.</p>
        <p>Our <strong>Deal Intelligence Brief</strong> covers the complete landscape in one deliverable:</p>
        <ul style="color: #334155; line-height: 2;">
          <li>52 deal calculations (13 modalities × 4 structures) for ${indicationRef}</li>
          <li>AI-written strategic narrative and negotiation playbook</li>
          <li>Partner matching with intent scoring (6-10 counterparties)</li>
          <li>Full financial model suite — rNPV, Monte Carlo, scenario comparison</li>
          <li>White-labeled with your company branding</li>
        </ul>
        <p><strong>$2,500. Delivered in 24 hours.</strong></p>
        <p><a href="https://solidus.ambrosiaventures.co/benchmark" style="display: inline-block; background: #14B8A6; color: white; padding: 10px 24px; text-decoration: none; border-radius: 4px; font-weight: 600;">Order Your Brief →</a></p>
        <p>Or reply to this email and I'll share a sample brief first.</p>
        <p>Best,<br>Issa Kildani<br>Managing Partner, Ambrosia Ventures</p>
      `,
    },
  };

  const template = templates[emailType];
  if (!template) return;

  const html = `
    <!DOCTYPE html>
    <html>
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.7; color: #1e293b; max-width: 560px; margin: 0 auto; padding: 20px; font-size: 15px;">
        ${template.body}
        <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8;">
          <p>Ambrosia Ventures | <a href="https://ambrosiaventures.co" style="color: #14b8a6;">ambrosiaventures.co</a> | <a href="https://solidus.ambrosiaventures.co" style="color: #14b8a6;">solidus.ambrosiaventures.co</a></p>
          <p><a href="https://solidus.ambrosiaventures.co/unsubscribe" style="color: #94a3b8;">Unsubscribe</a></p>
        </div>
      </body>
    </html>
  `;

  await sendEmail({
    to: lead.email,
    subject: template.subject,
    html,
    from: emailType === 'pro_nudge'
      ? 'Solidus by Ambrosia Ventures <info@ambrosiaventures.co>'
      : 'Issa Kildani <issa@ambrosiaventures.co>',
    replyTo: 'ikildani@ambrosiaventures.co',
  });
}

async function queueAdvisoryEmail(
  lead: LeadScore,
  emailType: 'email_1' | 'email_2' | 'email_3',
  latestCalc: CalculationContext,
): Promise<void> {
  const supabase = createServiceClient();

  // Record that this email was triggered (dedup)
  await supabase.from('lead_events').insert({
    user_id: lead.userId,
    event_type: `${emailType}_sent`,
    context: { lead_score: lead.score, deal_stage: lead.dealStage, ...latestCalc },
  }).catch(() => {});

  // Send via SendGrid
  const { sendEmail } = await import('@/lib/email/client');

  const name = lead.fullName?.split(' ')[0] || 'there';
  const indicationRef = latestCalc.indication || latestCalc.therapeuticArea;
  const modalityRef = latestCalc.modality?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'your modality';
  const phaseRef = latestCalc.phase?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || '';

  const templates: Record<string, { subject: string; body: string }> = {
    email_1: {
      subject: `${indicationRef} deal terms are shifting`,
      body: `
        <p>Hi ${name},</p>
        <p>I noticed you've been benchmarking ${phaseRef} ${modalityRef} deal terms in ${indicationRef}. We've been tracking this space closely — the licensing economics have shifted meaningfully in the last two quarters, particularly on milestone structures and royalty stacking.</p>
        <p>If you're preparing for a partnering conversation, our advisory team works with companies at exactly this stage — from valuation through term sheet. We've advised on comparable transactions and can share what we're seeing in the comp set.</p>
        <p>Reply to this email if you'd like to talk.</p>
        <p>Best,<br>Issa Kildani<br>Managing Partner, Ambrosia Ventures</p>
      `,
    },
    email_2: {
      subject: `Want a deeper analysis for your ${indicationRef} asset?`,
      body: `
        <p>Hi ${name},</p>
        <p>You recently exported a deal benchmarking report for ${phaseRef} ${modalityRef} in ${indicationRef}. That usually means you're sharing it with your board or a potential partner.</p>
        <p>Our Deal Intelligence Brief ($2,500) goes deeper — covering all 13 modalities × 4 deal structures for your indication, with AI-generated negotiation playbook, partner matching with intent scoring, and full financial model suite (rNPV, Monte Carlo, scenarios). White-labeled with your company branding.</p>
        <p>Or if you're further along and need full advisory support on the transaction, we do that too — from valuation through close.</p>
        <p>Reply to this email and I'll share a sample brief.</p>
        <p>Best,<br>Issa Kildani<br>Managing Partner, Ambrosia Ventures</p>
      `,
    },
    email_3: {
      subject: `Quick question about your ${indicationRef} deal`,
      body: `
        <p>Hi ${name},</p>
        <p>I noticed you've been running several analyses in ${indicationRef} — ${phaseRef} ${modalityRef}${lead.buyerSpecificCompanies.length > 0 ? `, including buyer-specific valuations for ${lead.buyerSpecificCompanies.slice(0, 3).join(', ')}` : ''}. That pattern usually means a deal is taking shape.</p>
        <p>At Ambrosia Ventures, we advise biotech companies on deal structuring and partnering — from valuation through term sheet. If you're approaching a transaction, I'd welcome a 15-minute conversation to see if we can help.</p>
        <p>Would next week work?</p>
        <p>Issa Kildani<br>Managing Partner, Ambrosia Ventures<br>ikildani@ambrosiaventures.co</p>
      `,
    },
  };

  const template = templates[emailType];
  if (!template) return;

  const html = `
    <!DOCTYPE html>
    <html>
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.7; color: #1e293b; max-width: 560px; margin: 0 auto; padding: 20px; font-size: 15px;">
        ${template.body}
        <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8;">
          <p>Ambrosia Ventures | <a href="https://ambrosiaventures.co" style="color: #14b8a6;">ambrosiaventures.co</a></p>
          <p><a href="https://solidus.ambrosiaventures.co/unsubscribe" style="color: #94a3b8;">Unsubscribe</a></p>
        </div>
      </body>
    </html>
  `;

  await sendEmail({
    to: lead.email,
    subject: template.subject,
    html,
    from: 'Issa Kildani <issa@ambrosiaventures.co>',
    replyTo: 'ikildani@ambrosiaventures.co',
  });
}
