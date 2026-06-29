/**
 * SEO page rendering cron job.
 * Picks high-priority pages from seo_generated_pages and publishes them
 * as blog posts via Claude content generation + Google Indexing API submission.
 *
 * Schedule: Tuesdays & Fridays at 8AM UTC (vercel.json)
 * Auth: Bearer token matched against CRON_SECRET
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import { createServiceClient } from '@/lib/supabase/server';
import { logCronRun } from '@/lib/cron-utils';
import { runCronIntelligence } from '@/lib/cron-intelligence';
import { publishBlogPost } from '@/lib/seo/blog-publisher';
import { GSCClient } from '@/lib/seo/gsc-client';
import { type GeneratedBlogContent } from '@/lib/ai/content-generator';
import { getBenchmarksSync, type PhaseBaselineEntry } from '@/lib/benchmarks';
import { COMPARABLE_DEALS } from '@/lib/comparableDeals';
import { EXTENDED_COMPARABLE_DEALS } from '@/data/comparable-deals-extended';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const PAGES_PER_RUN = 5;
const BASE_URL = 'https://calculator.ambrosiaventures.co';

// ── Label maps ──────────────────────────────────────────────────────────────

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

const PHASE_LABELS: Record<string, string> = {
  preclinical: 'Preclinical',
  phase1: 'Phase 1',
  phase2: 'Phase 2',
  phase3: 'Phase 3',
  approved: 'Approved',
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
  carT_heme: 'CAR-T (Hematologic)',
  carT_solid: 'CAR-T (Solid Tumor)',
  peptide: 'Peptide',
  radiopharmaceutical: 'Radiopharmaceutical',
  aso: 'ASO',
  glp1Agonist: 'GLP-1 Agonist',
};

const DEAL_TYPE_LABELS: Record<string, string> = {
  licensing: 'Licensing',
  acquisition: 'Acquisition',
  codevelopment: 'Co-Development',
  option: 'Option',
  collaboration: 'Collaboration',
};

// ── Types ───────────────────────────────────────────────────────────────────

interface SeoGeneratedPage {
  id: string;
  slug: string;
  page_data: {
    slug: string;
    title: string;
    metaDescription: string;
    h1: string;
    category: string;
    calculatorPrefill: Record<string, string>;
    contextParagraphs: string[];
    therapeuticArea?: string;
    modality?: string;
    phase?: string;
    dealType?: string;
    headline?: string;
    companies?: string[];
    dealValue?: number;
  };
  source: string;
  priority_score: number;
  status: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function getPhaseData(phase: string): PhaseBaselineEntry {
  const benchmarks = getBenchmarksSync();
  const baselines = benchmarks.phaseBaselines as Record<string, PhaseBaselineEntry>;
  return baselines[phase] || baselines.phase2;
}

function getComparableDeals(ta: string, limit: number = 5) {
  const curated = COMPARABLE_DEALS
    .filter((d) => d.therapeuticArea === ta || d.secondaryTAs?.includes(ta))
    .map((d) => ({
      licensor: d.licensor,
      licensee: d.licensee,
      upfront: d.upfrontM || 0,
      totalDealValue: d.totalValueM || 0,
      year: d.year,
    }));

  const extended = EXTENDED_COMPARABLE_DEALS
    .filter((d) => d.therapeuticArea === ta)
    .map((d) => ({
      licensor: d.licensor,
      licensee: d.licensee,
      upfront: d.upfront,
      totalDealValue: d.totalDealValue,
      year: d.year,
    }));

  const seen = new Set(curated.map((d) => `${d.licensor}:${d.licensee}:${d.year}`));
  const merged = [...curated];
  for (const d of extended) {
    const key = `${d.licensor}:${d.licensee}:${d.year}`;
    if (!seen.has(key)) {
      merged.push(d);
      seen.add(key);
    }
  }

  return merged
    .sort((a, b) => b.year - a.year || b.totalDealValue - a.totalDealValue)
    .slice(0, limit);
}

function labelFor(key: string, map: Record<string, string>): string {
  return map[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()).trim();
}

function parseJsonResponse<T>(text: string): T {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in response');
  }
  return JSON.parse(jsonMatch[0]) as T;
}

/**
 * Build a Claude prompt to generate a blog article from seo_generated_pages data.
 */
function buildPageRenderPrompt(page: SeoGeneratedPage): string {
  const pd = page.page_data;
  const ta = pd.calculatorPrefill?.therapeuticArea || pd.therapeuticArea || 'oncology';
  const phase = pd.calculatorPrefill?.phase || pd.phase || 'phase2';
  const modality = pd.calculatorPrefill?.modality || pd.modality || 'smallMolecule';
  const dealType = pd.calculatorPrefill?.dealType || pd.dealType || 'licensing';

  const taLabel = labelFor(ta, TA_LABELS);
  const phaseLabel = labelFor(phase, PHASE_LABELS);
  const modalityLabel = labelFor(modality, MODALITY_LABELS);
  const dealTypeLabel = labelFor(dealType, DEAL_TYPE_LABELS);

  const phaseData = getPhaseData(phase);
  const comparableDeals = getComparableDeals(ta);

  const dealsList = comparableDeals
    .map(
      (d) =>
        `- ${d.licensor} -> ${d.licensee} (${d.year}): $${d.upfront}M upfront / $${d.totalDealValue}M total`,
    )
    .join('\n');

  const companiesMention = pd.companies?.length
    ? `\n\n## KEY COMPANIES\n${pd.companies.join(', ')}`
    : '';

  const dealValueMention = pd.dealValue
    ? `\n- **Reference Deal Value**: $${pd.dealValue}M`
    : '';

  return `You are a senior biopharma deal intelligence analyst writing for Ambrosia Ventures. Your audience: pharma BD teams, biotech founders, and investors who negotiate $50M-$5B deals. Write like a peer, not a content marketer.

Write an authoritative blog article for the following page opportunity:

## PAGE CONTEXT
- **Title**: ${pd.title}
- **H1**: ${pd.h1}
- **Category**: ${pd.category}
- **Source**: ${page.source} (priority score: ${page.priority_score})
- **Context**: ${pd.contextParagraphs?.join(' ') || 'No additional context.'}${companiesMention}

## VERIFIED BENCHMARK DATA
- **Therapeutic Area**: ${taLabel}
- **Development Phase**: ${phaseLabel}
- **Modality**: ${modalityLabel}
- **Deal Type**: ${dealTypeLabel}
- **${phaseLabel} Upfront Range**: $${phaseData.upfront.low}M - $${phaseData.upfront.high}M (median: $${phaseData.upfront.median}M)
- **${phaseLabel} Total Deal Value Range**: $${phaseData.totalValue.low}M - $${phaseData.totalValue.high}M
- **Royalty Range**: ${phaseData.royalty.base}% - ${phaseData.royalty.max}%${dealValueMention}

## COMPARABLE DEALS
${dealsList || 'No directly comparable deals available.'}

## REQUIREMENTS

### Content quality
- 1,500-2,500 words minimum
- Lead with a hero stat from the benchmark data
- Include at least ONE HTML data table comparing deal terms
- Include specific deal examples and analysis
- Add a negotiation insight or tactical takeaway
- End with a clear actionable conclusion

### Voice
- Authoritative, data-driven, no fluff
- Strong declarative sentences
- Take positions backed by data

### Internal links (weave naturally, 2-3)
- [Deal Calculator](/calculator) - custom benchmarks
- [${taLabel} Benchmarks](/benchmarks?ta=${ta}) - TA-specific data
- [Therapeutic Area Overview](/therapeutic-areas/${ta}) - ${taLabel} landscape

### FAQ section
Include 3-5 FAQs with substantive answers relevant to the topic.

## OUTPUT FORMAT
Return ONLY a JSON object (no markdown fences, no commentary):
{
  "title": "SEO-optimized title (60-70 chars)",
  "meta_description": "Compelling meta description (155-165 chars) with primary keyword",
  "excerpt": "2-3 sentence hook for the article",
  "content": "Full HTML article content with proper heading tags, tables, blockquotes",
  "faqs": [{"question": "...", "answer": "..."}, ...],
  "sources": [{"title": "...", "url": "...", "publication": "...", "date": "..."}]
}`;
}

// ── Slack notification ──────────────────────────────────────────────────────

async function sendSlackNotification(
  publishedPages: Array<{ slug: string; title: string; source: string; indexed: boolean }>,
  errors: string[],
): Promise<void> {
  const webhookUrl = process.env.SLACK_SEO_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;

  const lines = publishedPages.map(
    (p, i) =>
      `${i + 1}. *${p.title}*\n   /blog/${p.slug} | source: ${p.source} | indexed: ${p.indexed ? 'yes' : 'no'}`,
  );

  const errorBlock = errors.length > 0
    ? `\n\n:warning: *Errors (${errors.length}):*\n${errors.slice(0, 5).map((e) => `- ${e}`).join('\n')}`
    : '';

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `SEO Page Render: ${publishedPages.length} pages published`,
        attachments: [
          {
            color: '#10b981',
            blocks: [
              {
                type: 'header',
                text: { type: 'plain_text', text: 'SEO Page Render Complete', emoji: true },
              },
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: [
                    `:white_check_mark: *${publishedPages.length} pages published*`,
                    '',
                    ...lines,
                    errorBlock,
                  ].join('\n'),
                },
              },
              {
                type: 'context',
                elements: [
                  {
                    type: 'mrkdwn',
                    text: `Generated ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' })}`,
                  },
                ],
              },
            ],
          },
        ],
      }),
    });
  } catch (err) {
    console.error('[seo-page-render] Slack notification error:', err instanceof Error ? err.message : 'unknown');
  }
}

// ── Route handler ───────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  // 1. Auth — timing-safe comparison
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
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  const client = new Anthropic({ apiKey });
  const publishedPages: Array<{ slug: string; title: string; source: string; indexed: boolean }> = [];
  const errors: string[] = [];

  try {
    // 2. Query high-priority pages ready for rendering
    const { data: pendingPages, error: queryError } = await supabase
      .from('seo_generated_pages')
      .select('*')
      .in('status', ['pending', 'active'])
      .order('priority_score', { ascending: false })
      .limit(PAGES_PER_RUN);

    if (queryError) {
      throw new Error(`Failed to query seo_generated_pages: ${queryError.message}`);
    }

    if (!pendingPages || pendingPages.length === 0) {
      await logCronRun(supabase, 'seo-page-render', {
        processed: 0,
        parameters: { status: 'no_pending_pages' },
      });
      return NextResponse.json({ message: 'No pending pages to render', published: 0 });
    }

    // Initialize GSC client for indexing submissions
    const gsc = new GSCClient();
    if (!gsc.isConfigured()) {
      await gsc.initOAuth2();
    }

    // 3. Process each page
    for (const rawPage of pendingPages) {
      const page = rawPage as SeoGeneratedPage;

      // Time budget: leave at least 30s per remaining page
      const elapsed = Date.now() - startTime;
      if (elapsed > 270_000) {
        console.log('[seo-page-render] Time budget exceeded, stopping');
        break;
      }

      try {
        // 3a. Check if a blog post with this slug already exists
        const blogSlug = page.slug;
        const { data: existingPost } = await supabase
          .from('blog_posts')
          .select('id')
          .eq('slug', blogSlug)
          .single();

        if (existingPost) {
          console.log(`[seo-page-render] Blog post already exists for slug: ${blogSlug}, marking published`);
          await supabase
            .from('seo_generated_pages')
            .update({ status: 'published' })
            .eq('id', page.id);
          continue;
        }

        // 3b. Generate blog content via Claude
        const prompt = buildPageRenderPrompt(page);

        const message = await client.messages.create({
          model: 'claude-opus-4-6',
          max_tokens: 8000,
          messages: [{ role: 'user', content: prompt }],
        });

        const textContent = message.content.find((c) => c.type === 'text');
        if (!textContent || textContent.type !== 'text') {
          throw new Error('No text content in Claude response');
        }

        const blogContent = parseJsonResponse<GeneratedBlogContent>(textContent.text);

        // 3c. Publish via the standard blog publisher
        const ta = page.page_data.calculatorPrefill?.therapeuticArea || page.page_data.therapeuticArea || 'oncology';
        const modality = page.page_data.calculatorPrefill?.modality || page.page_data.modality || 'smallMolecule';
        const phase = page.page_data.calculatorPrefill?.phase || page.page_data.phase || 'phase2';
        const topicKey = `seo-render:${page.slug}:${Date.now()}`;

        const result = await publishBlogPost(supabase, blogContent, {
          therapeuticArea: ta,
          modality,
          phase,
          topicKey,
        });

        if (!result.success) {
          throw new Error(`Publish failed: ${result.error}`);
        }

        // 3d. Update seo_generated_pages status to published
        await supabase
          .from('seo_generated_pages')
          .update({ status: 'published' })
          .eq('id', page.id);

        // 3e. Submit to Google Indexing API
        let indexed = false;
        if (gsc.isConfigured() && result.slug) {
          const url = `${BASE_URL}/blog/${result.slug}`;
          const indexResult = await gsc.requestIndexing(url);
          indexed = indexResult.success;

          // Also record in seo_indexing_queue
          if (indexed) {
            await supabase.from('seo_indexing_queue').upsert(
              {
                url,
                priority: 0.65,
                submitted_at: new Date().toISOString(),
                status: 'submitted',
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'url' },
            );
          }
        }

        publishedPages.push({
          slug: result.slug!,
          title: blogContent.title,
          source: page.source,
          indexed,
        });

        console.log(`[seo-page-render] Published: ${result.slug} (indexed: ${indexed})`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${page.slug}: ${msg}`);
        console.error(`[seo-page-render] Failed: ${page.slug}`, msg);
      }
    }

    // 4. Send Slack notification
    if (publishedPages.length > 0 || errors.length > 0) {
      await sendSlackNotification(publishedPages, errors);
    }

    // 5. Log cron run
    const durationMs = Date.now() - startTime;
    await logCronRun(supabase, 'seo-page-render', {
      fetched: pendingPages.length,
      processed: publishedPages.length + errors.length,
      inserted: publishedPages.length,
      errors: errors.slice(0, 10),
      parameters: {
        pagesQueried: pendingPages.length,
        pagesPublished: publishedPages.length,
        pagesIndexed: publishedPages.filter((p) => p.indexed).length,
        slugs: publishedPages.map((p) => p.slug),
        durationMs,
      },
    });

    // Intelligence tracking
    try {
      await runCronIntelligence(supabase, 'seo-page-render', {
        processed: publishedPages.length + errors.length,
        inserted: publishedPages.length,
      });
    } catch {}

    return NextResponse.json({
      success: true,
      published: publishedPages.length,
      indexed: publishedPages.filter((p) => p.indexed).length,
      errors: errors.length,
      pages: publishedPages,
      durationMs,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[seo-page-render] Fatal error:', message);

    try {
      await logCronRun(supabase, 'seo-page-render', {
        errors: [message],
        parameters: { stage: 'top-level', publishedSoFar: publishedPages.length },
      });
    } catch {
      // Non-fatal
    }

    return NextResponse.json({ error: message, publishedSoFar: publishedPages.length }, { status: 500 });
  }
}
