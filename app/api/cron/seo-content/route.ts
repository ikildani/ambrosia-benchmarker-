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
import { isTimeBudgetExceeded, logCronRun } from '@/lib/cron-utils';
import { getBenchmarksSync, type PhaseBaselineEntry } from '@/lib/benchmarks';
import { getNextTopic } from '@/lib/seo/topic-rotation';
import { publishBlogPost, notifySEOContentGenerated } from '@/lib/seo/blog-publisher';
import { generateSEOBlogPrompt, type SEOBlogPromptParams } from '@/lib/ai/prompts/seo-blog';
import { type GeneratedBlogContent } from '@/lib/ai/content-generator';
import { COMPARABLE_DEALS } from '@/lib/comparableDeals';
import { EXTENDED_COMPARABLE_DEALS } from '@/data/comparable-deals-extended';

export const maxDuration = 120;

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

  try {
    // 2. Pick next topic
    const topic = await getNextTopic(supabase);
    if (!topic) {
      console.log('[seo-content] All topics exhausted');
      await logCronRun(supabase, 'seo-content', {
        processed: 0,
        parameters: { status: 'all_topics_exhausted' },
      });
      return NextResponse.json({ message: 'All topics exhausted' });
    }

    console.log(`[seo-content] Generating: ${topic.topicKey}`);

    // 3. Check time budget
    if (isTimeBudgetExceeded(startTime, 250_000)) {
      return NextResponse.json({ error: 'Time budget exceeded before generation' }, { status: 408 });
    }

    // 4. Build prompt params
    const phaseData = getPhaseData(topic.phase);
    const comparableDeals = getComparableDeals(topic.therapeuticArea);

    const promptParams: SEOBlogPromptParams = {
      therapeuticArea: topic.therapeuticArea,
      taLabel: TA_LABELS[topic.therapeuticArea] || topic.therapeuticArea,
      phase: topic.phase,
      phaseLabel: PHASE_LABELS[topic.phase] || topic.phase,
      modality: topic.modality,
      modalityLabel: MODALITY_LABELS[topic.modality] || topic.modality,
      dealType: topic.dealType,
      dealTypeLabel: DEAL_TYPE_LABELS[topic.dealType] || topic.dealType,
      phaseData,
      comparableDeals,
    };

    // 5. Generate prompt
    const prompt = generateSEOBlogPrompt(promptParams);

    // 6. Call Claude
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }

    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const textContent = message.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text content in Claude response');
    }

    // 7. Parse response
    const blogContent = parseJsonResponse<GeneratedBlogContent>(textContent.text);

    // 8. Check time budget again
    if (isTimeBudgetExceeded(startTime, 250_000)) {
      console.warn('[seo-content] Time budget exceeded after generation — publishing anyway');
    }

    // 9. Publish
    const result = await publishBlogPost(supabase, blogContent, {
      therapeuticArea: topic.therapeuticArea,
      modality: topic.modality,
      phase: topic.phase,
      topicKey: topic.topicKey,
    });

    if (!result.success) {
      throw new Error(`Publish failed: ${result.error}`);
    }

    // 10. Notify
    await notifySEOContentGenerated(result.slug!, blogContent.title);

    // 11. Log cron run
    await logCronRun(supabase, 'seo-content', {
      processed: 1,
      inserted: 1,
      parameters: {
        topicKey: topic.topicKey,
        slug: result.slug,
        title: blogContent.title,
      },
    });

    const durationMs = Date.now() - startTime;
    console.log(`[seo-content] Published "${blogContent.title}" (${result.slug}) in ${durationMs}ms`);

    return NextResponse.json({
      success: true,
      slug: result.slug,
      title: blogContent.title,
      topicKey: topic.topicKey,
      durationMs,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[seo-content] Error:', message);

    await logCronRun(supabase, 'seo-content', {
      errors: [message],
      parameters: { stage: 'generation' },
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
