/**
 * Core CTR optimization logic.
 * Finds underperforming pages via GSC metrics, generates improved meta tags
 * via Claude, and applies them to the seo_overrides table.
 */

import { type SupabaseClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { generateMetaOptimizationPrompt } from '@/lib/ai/prompts/meta-optimization';

// ── Types ────────────────────────────────────────────────────────────────────

export interface OptimizationCandidate {
  pagePath: string;
  currentTitle: string;
  currentDescription: string;
  queries: { query: string; impressions: number; ctr: number; position: number }[];
  totalImpressions: number;
  avgCtr: number;
  avgPosition: number;
}

export interface OptimizationResult {
  pagePath: string;
  originalTitle: string;
  originalDescription: string;
  newTitle: string;
  newDescription: string;
  triggerQuery: string;
  triggerPosition: number;
  triggerCtr: number;
}

// ── Candidate discovery ──────────────────────────────────────────────────────

export interface CtrThresholds {
  minImpressions: number;
  minPosition: number;
  maxPosition: number;
  maxCtr: number;
}

export const DEFAULT_CTR_THRESHOLDS: CtrThresholds = {
  minImpressions: 100,
  minPosition: 8,
  maxPosition: 20,
  maxCtr: 3,
};

/**
 * Find pages that are ranking but underperforming on CTR.
 * Criteria: avg position 8-20, avg CTR < 3%, total impressions > 100,
 * not optimized in last 14 days.
 *
 * Thresholds can be overridden via the `thresholds` parameter for adaptive tuning.
 */
export async function findOptimizationCandidates(
  supabase: SupabaseClient,
  thresholds?: Partial<CtrThresholds>
): Promise<OptimizationCandidate[]> {
  const t = { ...DEFAULT_CTR_THRESHOLDS, ...thresholds };
  // 1. Read latest GSC performance rows
  const { data: metrics, error: metricsError } = await supabase
    .from('seo_metrics')
    .select('payload')
    .eq('metric_type', 'gsc_performance')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (metricsError || !metrics?.payload) {
    console.warn('[ctr-optimizer] No GSC performance data found');
    return [];
  }

  const rows = metrics.payload as {
    page: string;
    query: string;
    impressions: number;
    clicks: number;
    ctr: number;
    position: number;
  }[];

  // 2. Group query rows by page
  const pageMap = new Map<
    string,
    { queries: { query: string; impressions: number; ctr: number; position: number }[] }
  >();

  for (const row of rows) {
    if (!pageMap.has(row.page)) {
      pageMap.set(row.page, { queries: [] });
    }
    pageMap.get(row.page)!.queries.push({
      query: row.query,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
    });
  }

  // 3. Filter pages using adaptive thresholds
  const candidates: OptimizationCandidate[] = [];

  for (const [pagePath, { queries }] of pageMap) {
    const totalImpressions = queries.reduce((sum, q) => sum + q.impressions, 0);
    if (totalImpressions <= t.minImpressions) continue;

    const weightedPosition =
      queries.reduce((sum, q) => sum + q.position * q.impressions, 0) / totalImpressions;
    if (weightedPosition < t.minPosition || weightedPosition > t.maxPosition) continue;

    const weightedCtr =
      queries.reduce((sum, q) => sum + q.ctr * q.impressions, 0) / totalImpressions;
    if (weightedCtr >= t.maxCtr) continue;

    candidates.push({
      pagePath,
      currentTitle: '', // Will be populated from seo_overrides or page metadata
      currentDescription: '',
      queries: queries.sort((a, b) => b.impressions - a.impressions).slice(0, 10),
      totalImpressions,
      avgCtr: weightedCtr,
      avgPosition: weightedPosition,
    });
  }

  // 4. Exclude pages optimized in last 14 days
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentlyOptimized } = await supabase
    .from('seo_optimization_log')
    .select('page_path')
    .gte('created_at', fourteenDaysAgo);

  const recentPaths = new Set((recentlyOptimized || []).map((r) => r.page_path));
  const filtered = candidates.filter((c) => !recentPaths.has(c.pagePath));

  // 5. Populate current meta from seo_overrides or defaults
  for (const candidate of filtered) {
    const { data: override } = await supabase
      .from('seo_overrides')
      .select('meta_title, meta_description')
      .eq('page_path', candidate.pagePath)
      .single();

    if (override) {
      candidate.currentTitle = override.meta_title || '';
      candidate.currentDescription = override.meta_description || '';
    } else {
      // Derive a default title from the page path
      const slug = candidate.pagePath.replace(/^\//, '').replace(/\//g, ' - ') || 'Home';
      candidate.currentTitle = `${slug} | Ambrosia Benchmarker`;
      candidate.currentDescription = 'Biopharma deal benchmarks and licensing analytics.';
    }
  }

  // 6. Return top 5 sorted by impressions
  return filtered
    .sort((a, b) => b.totalImpressions - a.totalImpressions)
    .slice(0, 5);
}

// ── Page optimization ────────────────────────────────────────────────────────

/**
 * Generate optimized meta tags for a single page using Claude.
 */
export async function optimizePage(
  candidate: OptimizationCandidate
): Promise<OptimizationResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is required');
  }

  const client = new Anthropic({ apiKey });

  const prompt = generateMetaOptimizationPrompt({
    currentTitle: candidate.currentTitle,
    currentDescription: candidate.currentDescription,
    pagePath: candidate.pagePath,
    topQueries: candidate.queries,
  });

  const message = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const textContent = message.content.find((c) => c.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text content in Claude response');
  }

  const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in Claude response');
  }

  const parsed = JSON.parse(jsonMatch[0]) as {
    title: string;
    description: string;
    reasoning: string;
  };

  // Use the top query as the trigger
  const topQuery = candidate.queries[0];

  return {
    pagePath: candidate.pagePath,
    originalTitle: candidate.currentTitle,
    originalDescription: candidate.currentDescription,
    newTitle: parsed.title,
    newDescription: parsed.description,
    triggerQuery: topQuery?.query || '',
    triggerPosition: topQuery?.position || 0,
    triggerCtr: topQuery?.ctr || 0,
  };
}

// ── Apply optimization ───────────────────────────────────────────────────────

/**
 * Persist the optimization: upsert meta overrides and log the change.
 */
export async function applyOptimization(
  supabase: SupabaseClient,
  result: OptimizationResult
): Promise<void> {
  // 1. Upsert into seo_overrides
  const { error: upsertError } = await supabase
    .from('seo_overrides')
    .upsert(
      {
        page_path: result.pagePath,
        meta_title: result.newTitle,
        meta_description: result.newDescription,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'page_path' }
    );

  if (upsertError) {
    throw new Error(`Failed to upsert seo_overrides: ${upsertError.message}`);
  }

  // 2. Insert into seo_optimization_log
  const { error: logError } = await supabase.from('seo_optimization_log').insert({
    page_path: result.pagePath,
    original_title: result.originalTitle,
    original_description: result.originalDescription,
    new_title: result.newTitle,
    new_description: result.newDescription,
    trigger_query: result.triggerQuery,
    trigger_position: result.triggerPosition,
    trigger_ctr: result.triggerCtr,
    created_at: new Date().toISOString(),
  });

  if (logError) {
    throw new Error(`Failed to write optimization log: ${logError.message}`);
  }
}
