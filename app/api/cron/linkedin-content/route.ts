/**
 * Weekly LinkedIn content generation cron job.
 * Generates 2-3 LinkedIn post drafts based on live platform deal data,
 * stores them in the linkedin_drafts table, and sends a Slack notification
 * for Issa to review and post.
 *
 * Schedule: Wednesdays at 09:00 UTC via Vercel Cron
 * Auth: Bearer token matched against CRON_SECRET
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import { createServiceClient } from '@/lib/supabase/server';
import { logCronRun } from '@/lib/cron-utils';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

// ── Types ──────────────────────────────────────────────────────────────────

interface DealTrend {
  topModalities: Array<{ modality: string; count: number }>;
  largestDeal: {
    licensor: string;
    licensee: string;
    total_deal_value_usd: number;
    therapeutic_area: string;
    modality: string;
    deal_type: string;
    announced_date: string;
  } | null;
  taActivity: Array<{ therapeutic_area: string; count: number }>;
  totalDealsThisMonth: number;
  totalDealsThisWeek: number;
  avgDealValue: number;
}

interface LinkedInDraft {
  title: string;
  body: string;
  link_url: string;
}

// ── Label maps ─────────────────────────────────────────────────────────────

const TA_LABELS: Record<string, string> = {
  oncology: 'Oncology',
  neurology: 'Neurology',
  immunology: 'Immunology',
  metabolic: 'Metabolic',
  cardiovascular: 'Cardiovascular',
  rareDisease: 'Rare Disease',
  hematology: 'Hematology',
  infectiousDisease: 'Infectious Disease',
  ophthalmology: 'Ophthalmology',
  dermatology: 'Dermatology',
  gastroenterology: 'Gastroenterology',
  womensHealth: "Women's Health",
};

const MODALITY_LABELS: Record<string, string> = {
  adc: 'ADC',
  bispecific: 'Bispecific Antibody',
  smallMolecule: 'Small Molecule',
  mab: 'Monoclonal Antibody',
  geneTherapy: 'Gene Therapy',
  cellTherapy: 'Cell Therapy',
  rnai: 'RNAi',
  mrna: 'mRNA',
  protac: 'PROTAC',
  carT_heme: 'CAR-T',
  peptide: 'Peptide',
  radiopharmaceutical: 'Radiopharmaceutical',
  aso: 'ASO',
  glp1Agonist: 'GLP-1 Agonist',
  antiVegf: 'Anti-VEGF',
};

// ── Data fetching ──────────────────────────────────────────────────────────

async function fetchDealTrends(supabase: ReturnType<typeof createServiceClient>): Promise<DealTrend> {
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Deals this month
  const { data: monthDeals } = await supabase
    .from('deals')
    .select('id, modality, therapeutic_area, total_deal_value_usd, licensor, licensee, deal_type, announced_date')
    .gte('created_at', oneMonthAgo)
    .order('total_deal_value_usd', { ascending: false, nullsFirst: false });

  // Deals this week
  const { data: weekDeals } = await supabase
    .from('deals')
    .select('id, modality, therapeutic_area, total_deal_value_usd, licensor, licensee, deal_type, announced_date')
    .gte('created_at', oneWeekAgo)
    .order('total_deal_value_usd', { ascending: false, nullsFirst: false });

  const deals = monthDeals || [];
  const weekDealList = weekDeals || [];

  // Top 5 modalities by deal count this month
  const modalityCounts: Record<string, number> = {};
  for (const deal of deals) {
    const mod = deal.modality || 'unknown';
    modalityCounts[mod] = (modalityCounts[mod] || 0) + 1;
  }
  const topModalities = Object.entries(modalityCounts)
    .filter(([mod]) => mod !== 'unknown')
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([modality, count]) => ({ modality, count }));

  // Largest deal this week
  const largestDeal = weekDealList.length > 0 && weekDealList[0].total_deal_value_usd
    ? {
        licensor: weekDealList[0].licensor || 'Undisclosed',
        licensee: weekDealList[0].licensee || 'Undisclosed',
        total_deal_value_usd: weekDealList[0].total_deal_value_usd,
        therapeutic_area: weekDealList[0].therapeutic_area || 'unknown',
        modality: weekDealList[0].modality || 'unknown',
        deal_type: weekDealList[0].deal_type || 'licensing',
        announced_date: weekDealList[0].announced_date || '',
      }
    : null;

  // TA activity this month
  const taCounts: Record<string, number> = {};
  for (const deal of deals) {
    const ta = deal.therapeutic_area || 'other';
    taCounts[ta] = (taCounts[ta] || 0) + 1;
  }
  const taActivity = Object.entries(taCounts)
    .filter(([ta]) => ta !== 'other')
    .sort(([, a], [, b]) => b - a)
    .map(([therapeutic_area, count]) => ({ therapeutic_area, count }));

  // Average deal value this month
  const dealsWithValue = deals.filter((d) => d.total_deal_value_usd && d.total_deal_value_usd > 0);
  const avgDealValue = dealsWithValue.length > 0
    ? dealsWithValue.reduce((sum, d) => sum + (d.total_deal_value_usd || 0), 0) / dealsWithValue.length
    : 0;

  return {
    topModalities,
    largestDeal,
    taActivity,
    totalDealsThisMonth: deals.length,
    totalDealsThisWeek: weekDealList.length,
    avgDealValue,
  };
}

// ── Claude API for post generation ─────────────────────────────────────────

async function generateLinkedInDrafts(
  client: Anthropic,
  trends: DealTrend
): Promise<LinkedInDraft[]> {
  const topModalityStr = trends.topModalities
    .map((m) => `${MODALITY_LABELS[m.modality] || m.modality}: ${m.count} deals`)
    .join(', ');

  const topTAStr = trends.taActivity
    .slice(0, 5)
    .map((t) => `${TA_LABELS[t.therapeutic_area] || t.therapeutic_area}: ${t.count} deals`)
    .join(', ');

  const largestDealStr = trends.largestDeal
    ? `${trends.largestDeal.licensee} acquired/licensed from ${trends.largestDeal.licensor} for $${(trends.largestDeal.total_deal_value_usd / 1_000_000).toFixed(0)}M (${TA_LABELS[trends.largestDeal.therapeutic_area] || trends.largestDeal.therapeutic_area}, ${MODALITY_LABELS[trends.largestDeal.modality] || trends.largestDeal.modality})`
    : 'No major deals announced this week';

  const avgValueStr = trends.avgDealValue > 0
    ? `$${(trends.avgDealValue / 1_000_000).toFixed(0)}M`
    : 'N/A';

  const prompt = `You are ghostwriting LinkedIn posts for Issa Kildani, founder of Ambrosia Ventures. These posts come from Issa's PERSONAL LinkedIn profile, not a company page.

MANDATORY VOICE & STYLE RULES — violating any of these makes the post unusable:

1. HOOK: First 2 lines MUST create tension, surprise, or a "wrong question" framing. This is what appears before "...see more" — it determines whether anyone reads the rest. Never open with a stat or a fact. Open with a human moment, a contradiction, or a provocation.

2. PERSONAL VOICE: Use "I" not "we." Issa is a founder sharing observations, not a company posting content.

3. TARGET LENGTH: 700-900 characters. Cut ruthlessly. Every sentence must earn its place.

4. NO LINKS IN POST BODY: LinkedIn suppresses reach for posts with external links. The link goes in the FIRST COMMENT (the link_url field). Never put a URL in the body text.

5. BANNED PHRASES: Never say "engine", "backtest", "calibrated against N deals", "rNPV model", "our platform", "we built", "check out", "our tool", "data shows" (as an opener). These read as marketing, not insight.

6. END WITH ENGAGEMENT QUESTION: The last line must be a specific, easy-to-answer question. Not "What do you think?" — that's lazy. Something like "What modality do you think is next?" or "What's the biggest timing mistake you've seen?" Specific questions get 3-5x more comments.

7. HASHTAGS: Exactly 3 hashtags at the very end. PascalCase. Mix broad + niche. Example: #BiopharmaMA #ADCDeals #LifeSciences

8. DATA ACCURACY: Only cite specific dollar amounts, company names, and deal terms that appear in the data below. Do NOT invent or estimate numbers. If the data doesn't support a specific claim, don't make it.

9. STRUCTURE: Short paragraphs (1-3 sentences max). Use line breaks between every paragraph. The post should feel like scrolling through sharp observations, not reading a wall of text.

10. THE "SCREENSHOT TEST": At least one line in the post should be worth screenshotting and sharing. This is usually a punchline, a reframe, or a non-obvious insight stated in under 15 words.

REAL DATA FOR THIS WEEK (use ONLY these numbers):
- Total deals tracked this month: ${trends.totalDealsThisMonth}
- Deals this week: ${trends.totalDealsThisWeek}
- Top modalities: ${topModalityStr || 'No modality data'}
- Top therapeutic areas: ${topTAStr || 'No TA data'}
- Largest deal this week: ${largestDealStr}
- Average deal value this month: ${avgValueStr}

Generate exactly 3 LinkedIn post drafts as a JSON array. Each post should have a DIFFERENT angle:
1. A non-obvious structural insight about deal terms, upfronts, or modality shifts
2. A specific deal or company story with a contrarian takeaway
3. A market-level observation that reframes how people think about biopharma M&A

The link_url field is for Issa's FIRST COMMENT (not the post body):
- https://calculator.ambrosiaventures.co/pulse
- https://calculator.ambrosiaventures.co/benchmarks
- https://calculator.ambrosiaventures.co/calculator

FORMAT:
{
  "title": "Short internal title for Issa's reference",
  "body": "The full LinkedIn post text with line breaks as \\n\\n",
  "link_url": "https://calculator.ambrosiaventures.co/..."
}

Return ONLY a JSON array of 3 objects. No markdown, no explanation.`;

  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');

  // Parse the JSON response
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error('No JSON array found in Claude response');
  }

  const drafts: LinkedInDraft[] = JSON.parse(jsonMatch[0]);

  // Validate structure
  if (!Array.isArray(drafts) || drafts.length === 0) {
    throw new Error('Invalid drafts structure from Claude');
  }

  const BANNED_PHRASES = ['engine', 'backtest', 'calibrated', 'rNPV', 'our platform', 'we built', 'check out', 'our tool', 'data shows'];

  return drafts.slice(0, 3).map((d) => {
    let body = d.body || '';

    // Strip any URLs from the body (links go in first comment only)
    body = body.replace(/https?:\/\/\S+/g, '').trim();

    // Flag banned phrases (log but don't block — Issa reviews before posting)
    const violations = BANNED_PHRASES.filter(phrase => body.toLowerCase().includes(phrase));
    if (violations.length > 0) {
      console.warn(`[linkedin-content] Draft "${d.title}" contains banned phrases: ${violations.join(', ')}`);
    }

    // Ensure exactly 3 hashtags at the end
    const hashtagMatch = body.match(/#\w+/g);
    if (!hashtagMatch || hashtagMatch.length > 3) {
      const tags = (hashtagMatch || []).slice(0, 3);
      body = body.replace(/#\w+/g, '').trim();
      if (tags.length > 0) body += '\n\n' + tags.join(' ');
    }

    return {
      title: d.title || 'Untitled Draft',
      body,
      link_url: d.link_url || 'https://calculator.ambrosiaventures.co/pulse',
    };
  });
}

// ── Slack notification ─────────────────────────────────────────────────────

async function notifyLinkedInDraftsReady(drafts: LinkedInDraft[]): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;

  const draftBlocks = drafts.flatMap((draft, i) => [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Draft ${i + 1}: ${draft.title}*\n\n${draft.body.slice(0, 500)}${draft.body.length > 500 ? '...' : ''}\n\n_Link: ${draft.link_url}_`,
      },
    },
    { type: 'divider' },
  ]);

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `LinkedIn Drafts Ready: ${drafts.length} posts generated`,
        attachments: [
          {
            color: '#0a66c2',
            blocks: [
              {
                type: 'header',
                text: {
                  type: 'plain_text',
                  text: 'LinkedIn Post Drafts Ready for Review',
                  emoji: true,
                },
              },
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `${drafts.length} post drafts generated from this week's deal data. Review and publish from the linkedin_drafts table.`,
                },
              },
              { type: 'divider' },
              ...draftBlocks,
            ],
          },
        ],
      }),
    });
  } catch (err) {
    console.error('[linkedin-content] Slack notification failed:', err instanceof Error ? err.message : 'Unknown');
  }
}

// ── Route handler ──────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  // 1. Auth
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '') || '';
  const secret = process.env.CRON_SECRET || '';

  if (!secret || token.length !== secret.length) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const tokenBuf = Buffer.from(token);
    const secretBuf = Buffer.from(secret);
    if (!crypto.timingSafeEqual(tokenBuf, secretBuf)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();

  // 2. Check Anthropic API key
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }
  const anthropic = new Anthropic({ apiKey });

  try {
    // 3. Fetch deal trends
    console.log('[linkedin-content] Fetching deal trends...');
    const trends = await fetchDealTrends(supabase);

    if (trends.totalDealsThisMonth === 0) {
      console.log('[linkedin-content] No deals this month — skipping generation');
      await logCronRun(supabase, 'linkedin-content', {
        processed: 0,
        parameters: { status: 'skipped', reason: 'no_deals_this_month' },
      });
      return NextResponse.json({ success: true, skipped: true, reason: 'no_deals_this_month' });
    }

    console.log(
      `[linkedin-content] Trends: ${trends.totalDealsThisMonth} deals this month, ` +
      `${trends.totalDealsThisWeek} this week, top modalities: ${trends.topModalities.map((m) => m.modality).join(', ')}`
    );

    // 4. Generate drafts via Claude
    console.log('[linkedin-content] Generating LinkedIn drafts...');
    const drafts = await generateLinkedInDrafts(anthropic, trends);

    // 5. Store drafts in Supabase
    const nextWednesday = new Date();
    nextWednesday.setDate(nextWednesday.getDate() + 7);
    nextWednesday.setHours(14, 0, 0, 0); // Schedule for next Wed 2PM UTC

    const insertRows = drafts.map((draft) => ({
      title: draft.title,
      body: draft.body,
      link_url: draft.link_url,
      status: 'draft' as const,
      scheduled_for: nextWednesday.toISOString(),
    }));

    const { data: inserted, error: insertError } = await supabase
      .from('linkedin_drafts')
      .insert(insertRows)
      .select('id, title');

    if (insertError) {
      throw new Error(`Failed to insert drafts: ${insertError.message}`);
    }

    console.log(`[linkedin-content] Stored ${inserted?.length || 0} drafts`);

    // 6. Notify via Slack
    await notifyLinkedInDraftsReady(drafts);

    // 7. Log cron run
    await logCronRun(supabase, 'linkedin-content', {
      processed: drafts.length,
      inserted: inserted?.length || 0,
      parameters: {
        draftsGenerated: drafts.length,
        totalDealsThisMonth: trends.totalDealsThisMonth,
        totalDealsThisWeek: trends.totalDealsThisWeek,
        topModalities: trends.topModalities.slice(0, 3).map((m) => m.modality),
        draftTitles: inserted?.map((d) => d.title) || [],
      },
    });

    return NextResponse.json({
      success: true,
      draftsGenerated: drafts.length,
      drafts: inserted?.map((d) => ({ id: d.id, title: d.title })) || [],
      trends: {
        dealsThisMonth: trends.totalDealsThisMonth,
        dealsThisWeek: trends.totalDealsThisWeek,
        topModalities: trends.topModalities.slice(0, 3),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[linkedin-content] Error:', message);

    await logCronRun(supabase, 'linkedin-content', {
      errors: [message],
      parameters: { stage: 'linkedin_content_generation' },
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
