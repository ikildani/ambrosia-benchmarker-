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
import { DEAL_STATS } from '@/lib/config/constants';
import { runCronIntelligence } from '@/lib/cron-intelligence';

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
  first_comment: string;
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

  // Deals this month from database
  const { data: monthDeals } = await supabase
    .from('deals')
    .select('id, modality, therapeutic_area, total_deal_value_usd, licensor, licensee, deal_type, announced_date')
    .gte('created_at', oneMonthAgo)
    .order('total_deal_value_usd', { ascending: false, nullsFirst: false });

  const { data: weekDeals } = await supabase
    .from('deals')
    .select('id, modality, therapeutic_area, total_deal_value_usd, licensor, licensee, deal_type, announced_date')
    .gte('created_at', oneWeekAgo)
    .order('total_deal_value_usd', { ascending: false, nullsFirst: false });

  let deals = monthDeals || [];
  let weekDealList = weekDeals || [];

  // Fallback: if no recent DB deals, use curated comparable deals from codebase
  if (deals.length === 0) {
    try {
      const { COMPARABLE_DEALS } = await import('@/lib/comparableDeals');
      const { EXTENDED_COMPARABLE_DEALS } = await import('@/data/comparable-deals-extended');

      const currentYear = now.getFullYear();
      const allCurated = [
        ...COMPARABLE_DEALS.map(d => ({
          id: `curated-${d.licensor}-${d.year}`,
          modality: d.modalities?.[0] || 'smallMolecule',
          therapeutic_area: d.therapeuticArea,
          total_deal_value_usd: (d.totalValueM || 0) * 1_000_000,
          licensor: d.licensor,
          licensee: d.licensee,
          deal_type: d.dealType || 'licensing',
          announced_date: `${d.year}-01-01`,
        })),
        ...EXTENDED_COMPARABLE_DEALS.map(d => ({
          id: `ext-${d.licensor}-${d.year}`,
          modality: d.modality || 'smallMolecule',
          therapeutic_area: d.therapeuticArea,
          total_deal_value_usd: (d.totalDealValue || 0) * 1_000_000,
          licensor: d.licensor,
          licensee: d.licensee,
          deal_type: d.dealType || 'licensing',
          announced_date: `${d.year}-01-01`,
        })),
      ];

      // Use 2025 deals as "recent" for content generation
      deals = allCurated
        .filter(d => d.announced_date.startsWith(String(currentYear)) || d.announced_date.startsWith(String(currentYear - 1)))
        .sort((a, b) => (b.total_deal_value_usd || 0) - (a.total_deal_value_usd || 0));

      weekDealList = deals.slice(0, 10);
      console.log(`[linkedin-content] Fallback to ${deals.length} curated deals (${currentYear - 1}-${currentYear})`);
    } catch (err) {
      console.error('[linkedin-content] Fallback deal import failed:', err);
    }
  }

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

  const prompt = `You are ghostwriting LinkedIn posts for Issa Kildani, founder of Ambrosia Ventures. These come from Issa's PERSONAL LinkedIn profile.

HERE ARE 3 REAL POSTS ISSA HAS WRITTEN THAT PERFORMED WELL. Match this exact voice, rhythm, and density — not the topics, but the WAY he writes:

EXAMPLE 1 (deal structure):
"The headline says "$12.5 billion deal."

The wire transfer says $500 million.

Hengrui → GSK: $12.5B deal. $500M upfront. That's 4%.
Argo → Novartis: $5.2B deal. $160M upfront. That's 3%.
Merus → Gilead: $6.3B deal. $56M upfront. Under 1%.

I tracked every licensing deal over $1B in 2024-2025.

The median upfront is 8% of the headline number.

The press release says "multi-billion." The balance sheet says "milestone-dependent."

Next time you see a "$5B licensing deal," ask one question: what's the upfront?

That's the number that matters.

#DealStructure #BiopharmaLicensing #LifeSciences"

EXAMPLE 2 (company strategy):
"AstraZeneca quietly executed 10 deals in 18 months.

Not one made the front page of the Wall Street Journal.

Fusion Pharmaceuticals: $2.4B
Convergent Therapeutics: $1.8B
CSPC Pharmaceutical: $2.0B
CinCor Pharma: $1.8B
Amolyt Pharma: $1.1B

$18.5B total. No mega-acquisition. No hostile bid.

While everyone debated whether AZ would make a "big move," they already did. Ten of them.

The best acquirers don't swing for one $15B deal. They compound ten $1.5B ones.

What's the most disciplined dealmaker you've seen in pharma?

#BiopharmaMA #AstraZeneca #DealStrategy"

EXAMPLE 3 (modality):
"18 months ago, radiopharmaceutical M&A barely registered.

Today, five major pharma companies have spent $10.5B fighting over the same handful of startups.

AstraZeneca: Fusion ($2.4B), Convergent ($1.8B), Astellia ($425M). Three deals. $4.6B.

Eli Lilly: collaborated with Aktis for $1.16B in 2024 — then acquired them outright for $1.4B in 2025.

Eight deals. Five buyers. One modality.

And here's the problem: there are almost no independent radiopharmaceutical companies left to acquire.

What modality do you think sees this kind of acquisition frenzy next?

#Radiopharmaceuticals #BiopharmaMA #Oncology"

NOTICE THE PATTERN:
- Opens with a short, punchy line that creates tension (not a stat, not a claim)
- Lists specific deals with real dollar amounts (company → partner: $XB)
- Builds to a NON-OBVIOUS insight (the "so what" that makes people stop scrolling)
- One line that's worth screenshotting (the punchline)
- Ends with a specific question (not "what do you think?")
- No marketing language. No "check out." No methodology. Just sharp industry observation.
- Reads like a text message from a smart friend who works in M&A, not a LinkedIn thought leader

CRITICAL: DO NOT write like AI. No filler words. No "In today's rapidly evolving landscape." No "It's worth noting that." No "This raises an important question." No semicolons. No em-dashes used decoratively. Write like a person texting their observations to a colleague — direct, specific, slightly irreverent.

REAL DATA FOR THIS WEEK (use ONLY these — do not fabricate):
- Total deals this month: ${trends.totalDealsThisMonth}
- Deals this week: ${trends.totalDealsThisWeek}
- Top modalities: ${topModalityStr || 'No modality data'}
- Top therapeutic areas: ${topTAStr || 'No TA data'}
- Largest deal this week: ${largestDealStr}
- Average deal value this month: ${avgValueStr}

Generate exactly 3 post drafts. Each needs a DIFFERENT angle from the data above. If the data doesn't support a strong post, say so — don't force weak content.

Each post must include a "first_comment" field — the text Issa posts as the FIRST COMMENT immediately after publishing. This is where the link goes. Format it naturally: "Full deal comps across ${DEAL_STATS.TOTAL_DEALS} transactions → calculator.ambrosiaventures.co/benchmarks" — not a bare URL.

FORMAT (return ONLY this JSON array, nothing else):
[{
  "title": "Internal reference title",
  "body": "Full post text with \\n\\n between paragraphs",
  "first_comment": "Natural comment text with the link",
  "link_url": "https://calculator.ambrosiaventures.co/..."
}]`;

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
      first_comment: d.first_comment || `Deal benchmarks across ${DEAL_STATS.TOTAL_DEALS} verified transactions → ${d.link_url || 'calculator.ambrosiaventures.co'}`,
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
        text: `*Draft ${i + 1}: ${draft.title}*\n\n${draft.body.slice(0, 600)}${draft.body.length > 600 ? '...' : ''}\n\n💬 *First comment (post immediately after):*\n_${draft.first_comment}_`,
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
      body: draft.body + '\n\n---\nFIRST COMMENT: ' + draft.first_comment,
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

    // Intelligence tracking
    try {
      await runCronIntelligence(supabase, 'linkedin-content', {
        processed: drafts.length,
        inserted: inserted?.length || 0,
      });
    } catch {}

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
