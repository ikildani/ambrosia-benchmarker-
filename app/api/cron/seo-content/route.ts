/**
 * Daily SEO content generation cron job.
 * Picks the next un-generated topic, builds a prompt with real benchmark data
 * and comparable deals, generates a blog post via Claude, and publishes it.
 *
 * Schedule: Daily via Vercel Cron
 * Auth: Bearer token matched against CRON_SECRET
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import { createServiceClient } from '@/lib/supabase/server';
import { logCronRun } from '@/lib/cron-utils';
import { runCronIntelligence } from '@/lib/cron-intelligence';
import { getBenchmarksSync, type PhaseBaselineEntry } from '@/lib/benchmarks';
import { getNextTopic, type TopicParams } from '@/lib/seo/topic-rotation';
import type {
  DealAnalysisData,
  HowMuchData,
  BuyerIntelligenceData,
  MarketTrendData,
  ComparisonData,
} from '@/lib/seo/topic-rotation';
import { publishBlogPost, notifySEOContentGenerated } from '@/lib/seo/blog-publisher';
import {
  generateDealAnalysisPrompt,
  generateHowMuchPrompt,
  generateBuyerIntelligencePrompt,
  generateMarketTrendPrompt,
  generateComparisonPrompt,
} from '@/lib/ai/prompts/seo-blog-categories';
import {
  generateReactiveBlogPrompt,
  type ReactiveBlogPromptParams,
  type ReactiveTopicParams,
} from '@/lib/ai/prompts/seo-blog-reactive';
import { type GeneratedBlogContent } from '@/lib/ai/content-generator';
import { COMPARABLE_DEALS } from '@/lib/comparableDeals';
import { EXTENDED_COMPARABLE_DEALS } from '@/data/comparable-deals-extended';

export const maxDuration = 800; // 10 articles × ~60s each + buffer
const ARTICLES_PER_RUN = 10;

// ── Label maps ───────────────────────────────────────────────────────────────

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

const DEAL_TYPE_LABELS: Record<string, string> = {
  licensing: 'Licensing',
  acquisition: 'Acquisition',
  codevelopment: 'Co-Development',
  option: 'Option',
  collaboration: 'Collaboration',
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
  peptide: 'Peptide',
  radiopharmaceutical: 'Radiopharmaceutical',
  aso: 'ASO',
  glp1Agonist: 'GLP-1 Agonist',
  antiVegf: 'Anti-VEGF',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function getPhaseData(phase: string): PhaseBaselineEntry {
  const benchmarks = getBenchmarksSync();
  const baselines = benchmarks.phaseBaselines as Record<string, PhaseBaselineEntry>;
  return baselines[phase] || baselines.phase2;
}

function getComparableDeals(ta: string, limit: number = 5) {
  // Merge curated + extended deals, filter by TA, take top N by year
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

  // Deduplicate by licensor+licensee+year, prefer curated
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

function parseJsonResponse<T>(text: string): T {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in response');
  }
  return JSON.parse(jsonMatch[0]) as T;
}

/**
 * Build the right prompt based on the topic's content category.
 */
function buildCategoryPrompt(topic: TopicParams): string {
  switch (topic.data.category) {
    case 'deal_analysis':
      return generateDealAnalysisPrompt(topic.data as DealAnalysisData);
    case 'how_much':
      return generateHowMuchPrompt(topic.data as HowMuchData);
    case 'buyer_intelligence':
      return generateBuyerIntelligencePrompt(topic.data as BuyerIntelligenceData);
    case 'market_trend':
      return generateMarketTrendPrompt(topic.data as MarketTrendData);
    case 'comparison':
      return generateComparisonPrompt(topic.data as ComparisonData);
    default:
      throw new Error(`Unknown content category: ${(topic.data as { category: string }).category}`);
  }
}

/**
 * Extract publisher metadata from a category-aware topic.
 * Maps the new category-based topics back to the TopicMeta the publisher expects.
 */
function extractTopicMeta(topic: TopicParams): {
  therapeuticArea: string;
  modality: string;
  phase: string;
  topicKey: string;
  category?: string;
} {
  const d = topic.data;
  switch (d.category) {
    case 'deal_analysis':
      return {
        therapeuticArea: d.therapeuticArea || 'general',
        modality: d.modality || 'general',
        phase: d.phase || 'general',
        topicKey: topic.topicKey,
        category: 'deal-analysis',
      };
    case 'how_much':
      return {
        therapeuticArea: d.therapeuticArea || 'general',
        modality: d.modality || 'general',
        phase: d.phase || 'general',
        topicKey: topic.topicKey,
        category: 'how-much',
      };
    case 'buyer_intelligence':
      return {
        therapeuticArea: d.therapeuticAreas?.[0] || 'general',
        modality: 'general',
        phase: 'general',
        topicKey: topic.topicKey,
        category: 'buyer-intelligence',
      };
    case 'market_trend':
      return {
        therapeuticArea: d.trendType === 'ta_shift' ? d.dimension : 'general',
        modality: d.trendType === 'modality_surge' ? d.dimension : 'general',
        phase: 'general',
        topicKey: topic.topicKey,
        category: 'market-trend',
      };
    case 'comparison':
      return {
        therapeuticArea: 'general',
        modality: 'general',
        phase: 'general',
        topicKey: topic.topicKey,
        category: 'comparison',
      };
    default:
      return {
        therapeuticArea: 'general',
        modality: 'general',
        phase: 'general',
        topicKey: topic.topicKey,
      };
  }
}

// ── Reactive Slack notification ─────────────────────────────────────────────

async function notifyReactiveBlogPublished(
  slug: string,
  title: string,
  triggerHeadline: string,
  hoursAfterDetection: number,
): Promise<void> {
  const webhookUrl = process.env.SLACK_SEO_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `Reactive blog published: ${title}`,
        attachments: [
          {
            color: '#e74c3c',
            blocks: [
              {
                type: 'header',
                text: {
                  type: 'plain_text',
                  text: '\uD83D\uDD25 Reactive Blog Published',
                  emoji: true,
                },
              },
              {
                type: 'section',
                fields: [
                  { type: 'mrkdwn', text: `*Title:*\n${title}` },
                  { type: 'mrkdwn', text: `*Slug:*\n/blog/${slug}` },
                  { type: 'mrkdwn', text: `*Triggered by:*\n${triggerHeadline}` },
                  {
                    type: 'mrkdwn',
                    text: `*Published within:*\n${hoursAfterDetection}h of detection`,
                  },
                ],
              },
              {
                type: 'actions',
                elements: [
                  {
                    type: 'button',
                    text: { type: 'plain_text', text: 'View Post' },
                    url: `https://solidus.ambrosiaventures.co/blog/${slug}`,
                  },
                ],
              },
            ],
          },
        ],
      }),
    });
  } catch (err) {
    console.error('[seo-content] Reactive Slack notification failed:', err);
  }
}

// ── Route handler ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const startTime = Date.now();

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
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }
  const client = new Anthropic({ apiKey });

  const published: Array<{ slug: string; title: string; topicKey: string; reactive: boolean }> = [];
  const errors: string[] = [];

  try {
    // ── Phase 1: Process queued reactive items first ──────────────────────
    const { data: queueItems } = await supabase
      .from('seo_content_queue')
      .select('*')
      .eq('status', 'pending')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(5);

    if (queueItems && queueItems.length > 0) {
      for (const queueItem of queueItems) {
        const remainingTime = 780_000 - (Date.now() - startTime);
        if (remainingTime < 70_000) break;

        try {
          // Mark as generating (claim the item)
          await supabase
            .from('seo_content_queue')
            .update({ status: 'generating' })
            .eq('id', queueItem.id)
            .eq('status', 'pending'); // Optimistic lock

          const topicParams = queueItem.topic_params as ReactiveTopicParams;
          const ta = topicParams.therapeuticArea || 'oncology';
          const phase = topicParams.phase || 'phase2';
          const modality = topicParams.modality || 'smallMolecule';
          const dealType = topicParams.dealType || 'licensing';

          const phaseData = getPhaseData(phase);
          const comparableDeals = getComparableDeals(ta);

          const reactiveParams: ReactiveBlogPromptParams = {
            topicParams,
            taLabel: TA_LABELS[ta] || ta,
            phaseLabel: PHASE_LABELS[phase] || phase,
            modalityLabel: MODALITY_LABELS[modality] || modality,
            dealTypeLabel: DEAL_TYPE_LABELS[dealType] || dealType,
            phaseData,
            comparableDeals,
          };

          const prompt = generateReactiveBlogPrompt(reactiveParams);

          // Use claude-sonnet-4-6 for reactive (faster, cheaper — speed matters)
          const message = await client.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 8000,
            messages: [{ role: 'user', content: prompt }],
          });

          const textContent = message.content.find((c) => c.type === 'text');
          if (!textContent || textContent.type !== 'text') {
            throw new Error('No text content in Claude response');
          }

          const blogContent = parseJsonResponse<GeneratedBlogContent>(textContent.text);

          // Publish via existing publisher
          const topicKey = `reactive:${ta}:${Date.now()}`;
          const result = await publishBlogPost(supabase, blogContent, {
            therapeuticArea: ta,
            modality,
            phase,
            topicKey,
          });

          if (!result.success) {
            throw new Error(`Publish failed: ${result.error}`);
          }

          // Update queue item: published
          await supabase
            .from('seo_content_queue')
            .update({
              status: 'published',
              generated_slug: result.slug,
              processed_at: new Date().toISOString(),
            })
            .eq('id', queueItem.id);

          published.push({
            slug: result.slug!,
            title: blogContent.title,
            topicKey,
            reactive: true,
          });

          // Send reactive-specific Slack notification for high-priority items
          if (queueItem.priority >= 80) {
            const triggerEvent = queueItem.trigger_event as { title?: string };
            const hoursAgo = Math.round(
              (Date.now() - new Date(queueItem.created_at).getTime()) / (1000 * 60 * 60) * 10
            ) / 10;

            await notifyReactiveBlogPublished(
              result.slug!,
              blogContent.title,
              triggerEvent.title || 'Unknown trigger',
              hoursAgo,
            );
          }
        } catch (reactiveErr) {
          const msg = reactiveErr instanceof Error ? reactiveErr.message : String(reactiveErr);
          errors.push(`Reactive [${queueItem.id}]: ${msg}`);

          // Mark as failed — stays in queue for retry on next run
          // Self-healing: failed items get retried (status back to pending) after 1 hour
          await supabase
            .from('seo_content_queue')
            .update({ status: 'failed', processed_at: new Date().toISOString() })
            .eq('id', queueItem.id);
        }
      }
    }

    // ── Phase 2: Fill remaining slots with category-diverse rotation topics ──
    const rotationSlots = ARTICLES_PER_RUN - published.length;

    for (let i = 0; i < rotationSlots; i++) {
      // Time budget safety: leave ~60s per remaining article
      const remainingTime = 780_000 - (Date.now() - startTime);
      if (remainingTime < 70_000) {
        break;
      }

      try {
        // Pick next topic via weighted category selection + DB query
        const topic = await getNextTopic(supabase);
        if (!topic) {
          break;
        }

        // Build the category-specific prompt
        const prompt = buildCategoryPrompt(topic);

        // Generate — category-aware token budget
        const maxTokens = topic.category === 'comparison' || topic.category === 'how_much'
          ? 8000
          : 12000;

        const message = await client.messages.create({
          model: 'claude-opus-4-6',
          max_tokens: maxTokens,
          messages: [{ role: 'user', content: prompt }],
        });

        const textContent = message.content.find((c) => c.type === 'text');
        if (!textContent || textContent.type !== 'text') {
          throw new Error('No text content in Claude response');
        }

        const blogContent = parseJsonResponse<GeneratedBlogContent>(textContent.text);

        // Extract metadata from the topic for the publisher
        const topicMeta = extractTopicMeta(topic);

        // Publish
        const result = await publishBlogPost(supabase, blogContent, topicMeta);

        if (!result.success) {
          throw new Error(`Publish failed: ${result.error}`);
        }

        published.push({
          slug: result.slug!,
          title: blogContent.title,
          topicKey: topic.topicKey,
          reactive: false,
        });

      } catch (articleErr) {
        const msg = articleErr instanceof Error ? articleErr.message : String(articleErr);
        errors.push(`Article ${published.length + 1}: ${msg}`);
        // Continue with next article
      }
    }

    // ── Phase 3: Self-healing — reset failed queue items older than 1 hour back to pending ──
    await supabase
      .from('seo_content_queue')
      .update({ status: 'pending', processed_at: null })
      .eq('status', 'failed')
      .lt('processed_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());

    // Also reset stuck "generating" items older than 30 minutes (crashed mid-generation)
    await supabase
      .from('seo_content_queue')
      .update({ status: 'pending', processed_at: null })
      .eq('status', 'generating')
      .lt('created_at', new Date(Date.now() - 30 * 60 * 1000).toISOString());

    // Single notification for the rotation batch
    const rotationArticles = published.filter((p) => !p.reactive);
    if (rotationArticles.length > 0) {
      await notifySEOContentGenerated(
        rotationArticles[0].slug,
        `Batch: ${rotationArticles.length} new articles — "${rotationArticles[0].title}" + ${rotationArticles.length - 1} more`,
      );
    }

    // Log cron run
    const reactiveCount = published.filter((p) => p.reactive).length;
    const rotationCount = published.filter((p) => !p.reactive).length;

    // Compute category distribution for logging
    const categoryDistribution: Record<string, number> = {};
    for (const p of published.filter((a) => !a.reactive)) {
      const cat = p.topicKey.split(':')[0] || 'unknown';
      categoryDistribution[cat] = (categoryDistribution[cat] || 0) + 1;
    }

    await logCronRun(supabase, 'seo-content', {
      processed: published.length,
      inserted: published.length,
      errors: errors.slice(0, 10),
      parameters: {
        articlesGenerated: published.length,
        reactiveArticles: reactiveCount,
        rotationArticles: rotationCount,
        articlesRequested: ARTICLES_PER_RUN,
        slugs: published.map((p) => p.slug),
        categoryDistribution,
      },
    });

    const durationMs = Date.now() - startTime;

    // Intelligence tracking
    try {
      await runCronIntelligence(supabase, 'seo-content', {
        processed: published.length,
        inserted: published.length,
      });
    } catch {}

    return NextResponse.json({
      success: true,
      published: published.length,
      reactive: reactiveCount,
      rotation: rotationCount,
      articles: published,
      errors: errors.length,
      durationMs,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[seo-content] Fatal error:', message);

    await logCronRun(supabase, 'seo-content', {
      errors: [message],
      parameters: { stage: 'batch_generation', publishedSoFar: published.length },
    });

    return NextResponse.json({ error: message, publishedSoFar: published.length }, { status: 500 });
  }
}
