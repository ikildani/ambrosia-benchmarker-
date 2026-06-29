/**
 * Weekly SEO page expansion cron job.
 * Identifies high-impact benchmark page opportunities from GSC query gaps
 * and recent deal activity, scores them, stores top candidates in Supabase
 * (seo_generated_pages table), and sends a Slack summary.
 *
 * Schedule: Mondays at 6AM UTC (vercel.json)
 * Auth: Bearer token matched against CRON_SECRET
 *
 * This cron does NOT modify code — it stores generated page data in Supabase.
 * The benchmark page system can eventually pull from seo_generated_pages.
 */

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { GSCClient, type GSCPerformanceRow } from '@/lib/seo/gsc-client';
import { getAllBenchmarkSlugs } from '@/lib/benchmarkPages';
import { logCronRun } from '@/lib/cron-utils';
import { runCronIntelligence } from '@/lib/cron-intelligence';
import type { BenchmarkPageData } from '@/lib/benchmarkPages';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

// ── Types ───────────────────────────────────────────────────────────────────────

interface PageOpportunity {
  slug: string;
  title: string;
  source: 'gsc_gap' | 'new_deal' | 'trending';
  query?: string;
  impressions: number;
  position: number;
  priorityScore: number;
  company?: string;
  therapeuticArea?: string;
  indication?: string;
  modality?: string;
  pageData: BenchmarkPageData;
}

interface RecentDeal {
  company_name: string | null;
  therapeutic_area: string | null;
  indication: string | null;
  modality: string | null;
}

// ── Label maps ──────────────────────────────────────────────────────────────────

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
  carT_heme: 'CAR-T (Hematologic)',
  carT_solid: 'CAR-T (Solid Tumor)',
  peptide: 'Peptide',
  radiopharmaceutical: 'Radiopharmaceutical',
  aso: 'ASO',
  glp1Agonist: 'GLP-1 Agonist',
};

// ── Helpers ─────────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function labelFor(key: string, map: Record<string, string>): string {
  return map[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()).trim();
}

/**
 * Build a minimal BenchmarkPageData entry for a dynamically identified opportunity.
 * These are stored in Supabase for eventual rendering.
 */
function buildPageData(opts: {
  slug: string;
  title: string;
  metaDescription: string;
  h1: string;
  category: BenchmarkPageData['category'];
  calculatorPrefill: BenchmarkPageData['calculatorPrefill'];
  contextParagraphs: string[];
}): BenchmarkPageData {
  return {
    slug: opts.slug,
    title: opts.title,
    metaDescription: opts.metaDescription,
    h1: opts.h1,
    heroStats: [],
    contextParagraphs: opts.contextParagraphs,
    calculatorPrefill: opts.calculatorPrefill,
    faqs: [],
    relatedPages: [],
    category: opts.category,
  };
}

// ── Step 1: GSC gap analysis ────────────────────────────────────────────────────

async function identifyGSCGaps(existingSlugs: Set<string>): Promise<PageOpportunity[]> {
  const gsc = new GSCClient();
  if (!gsc.isConfigured()) {
    await gsc.initOAuth2();
  }
  if (!gsc.isConfigured()) {
    console.log('[seo-page-expand] GSC not configured, skipping gap analysis');
    return [];
  }

  const rows: GSCPerformanceRow[] = await gsc.getPerformanceData(30);
  if (rows.length === 0) return [];

  // Aggregate by query (rows include query + page combos)
  const queryMap = new Map<string, { impressions: number; clicks: number; positions: number[] }>();
  for (const row of rows) {
    const existing = queryMap.get(row.query) || { impressions: 0, clicks: 0, positions: [] };
    existing.impressions += row.impressions;
    existing.clicks += row.clicks;
    existing.positions.push(row.position);
    queryMap.set(row.query, existing);
  }

  const opportunities: PageOpportunity[] = [];

  for (const [query, data] of queryMap) {
    if (data.impressions <= 5) continue;

    // Normalize query to a potential slug
    const querySlug = slugify(query);
    if (!querySlug || querySlug.length < 3) continue;

    // Check if any existing slug matches the query terms
    const queryTerms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
    const hasMatch = [...existingSlugs].some((slug) => {
      const matchCount = queryTerms.filter((term) => slug.includes(term)).length;
      return matchCount >= Math.ceil(queryTerms.length * 0.6);
    });

    if (hasMatch) continue;

    const avgPosition = data.positions.reduce((a, b) => a + b, 0) / data.positions.length;

    // Score the opportunity
    let score = data.impressions * 10;
    if (avgPosition > 10) {
      score *= 0.5; // Page 2+ is harder to rank for
    }

    const suggestedSlug = `${querySlug}-benchmarks`;
    const titleQuery = query
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');

    opportunities.push({
      slug: suggestedSlug,
      title: `${titleQuery} Benchmarks 2026 | Deal Terms & Market Data`,
      source: 'gsc_gap',
      query,
      impressions: data.impressions,
      position: Math.round(avgPosition * 10) / 10,
      priorityScore: Math.round(score),
      pageData: buildPageData({
        slug: suggestedSlug,
        title: `${titleQuery} Benchmarks 2026 | Deal Terms & Market Data`,
        metaDescription: `Explore ${query} deal benchmarks including upfront payments, milestones, royalties, and total deal values. Data-driven insights from 2,500+ biopharma transactions.`,
        h1: `${titleQuery} Benchmarks`,
        category: 'overview',
        calculatorPrefill: {},
        contextParagraphs: [
          `Search interest for "${query}" is growing, with ${data.impressions} impressions in the last 30 days. This page provides benchmark deal terms and market data for this area.`,
        ],
      }),
    });
  }

  return opportunities;
}

// ── Step 2: New deals analysis ──────────────────────────────────────────────────

async function identifyDealOpportunities(
  supabase: ReturnType<typeof createServiceClient>,
  existingSlugs: Set<string>,
): Promise<{ opportunities: PageOpportunity[]; modalityCounts: Record<string, number> }> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();

  const { data: newDeals } = await supabase
    .from('deals')
    .select('company_name, therapeutic_area, indication, modality')
    .gte('created_at', sevenDaysAgo);

  const deals: RecentDeal[] = newDeals || [];
  const opportunities: PageOpportunity[] = [];
  const seenSlugs = new Set<string>();

  // Track modality frequency for trending bonus
  const modalityCounts: Record<string, number> = {};
  for (const deal of deals) {
    if (deal.modality) {
      modalityCounts[deal.modality] = (modalityCounts[deal.modality] || 0) + 1;
    }
  }

  // Company-level opportunities
  const companyDeals = new Map<string, RecentDeal[]>();
  for (const deal of deals) {
    if (!deal.company_name) continue;
    const existing = companyDeals.get(deal.company_name) || [];
    existing.push(deal);
    companyDeals.set(deal.company_name, existing);
  }

  for (const [company, compDeals] of companyDeals) {
    const slug = `${slugify(company)}-deal-benchmarks`;
    if (existingSlugs.has(slug) || seenSlugs.has(slug)) continue;
    seenSlugs.add(slug);

    let score = 50; // Base recency bonus
    const ta = compDeals[0]?.therapeutic_area || '';
    const modality = compDeals[0]?.modality || '';

    if (modality && (modalityCounts[modality] || 0) >= 3) {
      score += 100; // Trending modality bonus
    }

    const taLabel = labelFor(ta, TA_LABELS);
    const modalityLabel = labelFor(modality, MODALITY_LABELS);

    opportunities.push({
      slug,
      title: `${company} Deal Benchmarks 2026 | ${taLabel} Licensing Terms`,
      source: 'new_deal',
      impressions: 0,
      position: 0,
      priorityScore: Math.round(score),
      company,
      therapeuticArea: ta,
      modality,
      pageData: buildPageData({
        slug,
        title: `${company} Deal Benchmarks 2026 | ${taLabel} Licensing Terms`,
        metaDescription: `Explore ${company} deal benchmarks in ${taLabel}. Upfront payments, milestones, royalties, and comparable ${modalityLabel} transactions.`,
        h1: `${company} Deal Benchmarks`,
        category: 'overview',
        calculatorPrefill: ta ? { therapeuticArea: ta } : {},
        contextParagraphs: [
          `${company} has been active in recent ${taLabel} deal activity. This page provides benchmark deal terms relevant to ${company}'s therapeutic focus and modality profile.`,
        ],
      }),
    });
  }

  // Indication-level opportunities
  const indicationMap = new Map<string, { ta: string; modality: string; count: number }>();
  for (const deal of deals) {
    if (!deal.indication) continue;
    const key = deal.indication;
    const existing = indicationMap.get(key) || { ta: deal.therapeutic_area || '', modality: deal.modality || '', count: 0 };
    existing.count++;
    indicationMap.set(key, existing);
  }

  for (const [indication, info] of indicationMap) {
    const slug = `${slugify(indication)}-deal-benchmarks`;
    if (existingSlugs.has(slug) || seenSlugs.has(slug)) continue;
    seenSlugs.add(slug);

    let score = 50; // Recency bonus
    if (info.modality && (modalityCounts[info.modality] || 0) >= 3) {
      score += 100;
    }
    score += info.count * 20; // Multiple deals in same indication = higher priority

    const indicationLabel = indication
      .replace(/_/g, ' ')
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
    const taLabel = labelFor(info.ta, TA_LABELS);

    opportunities.push({
      slug,
      title: `${indicationLabel} Licensing Deal Benchmarks 2026 | ${taLabel}`,
      source: 'new_deal',
      impressions: 0,
      position: 0,
      priorityScore: Math.round(score),
      therapeuticArea: info.ta,
      indication,
      modality: info.modality,
      pageData: buildPageData({
        slug,
        title: `${indicationLabel} Licensing Deal Benchmarks 2026 | ${taLabel}`,
        metaDescription: `${indicationLabel} licensing deal benchmarks: upfront payments, milestones, royalties, and total deal values from recent ${taLabel} transactions.`,
        h1: `${indicationLabel} Licensing Deal Benchmarks`,
        category: 'indication',
        calculatorPrefill: { therapeuticArea: info.ta, indication },
        contextParagraphs: [
          `${indicationLabel} has seen ${info.count} new deal${info.count > 1 ? 's' : ''} in the past 7 days, signaling active licensing interest in this ${taLabel} indication.`,
        ],
      }),
    });
  }

  // Modality-level trending opportunities
  for (const [modality, count] of Object.entries(modalityCounts)) {
    if (count < 3) continue; // Only if trending (3+ deals)
    const slug = `${slugify(modality)}-licensing-benchmarks-2026`;
    if (existingSlugs.has(slug) || seenSlugs.has(slug)) continue;
    seenSlugs.add(slug);

    const modalityLabel = labelFor(modality, MODALITY_LABELS);

    opportunities.push({
      slug,
      title: `${modalityLabel} Licensing Benchmarks 2026 | Trending Deal Terms`,
      source: 'trending',
      impressions: 0,
      position: 0,
      priorityScore: Math.round(100 + count * 30),
      modality,
      pageData: buildPageData({
        slug,
        title: `${modalityLabel} Licensing Benchmarks 2026 | Trending Deal Terms`,
        metaDescription: `${modalityLabel} deal terms are trending with ${count} new deals in the past 7 days. Explore upfront payments, milestones, and royalty benchmarks.`,
        h1: `${modalityLabel} Licensing Benchmarks 2026`,
        category: 'modality',
        calculatorPrefill: { modality },
        contextParagraphs: [
          `${modalityLabel} is trending with ${count} new licensing deals in the past 7 days. This page benchmarks upfront payments, milestone structures, and royalty rates for this rapidly evolving modality.`,
        ],
      }),
    });
  }

  return { opportunities, modalityCounts };
}

// ── Step 3: Score and rank ──────────────────────────────────────────────────────

function scoreAndRank(
  gscOpportunities: PageOpportunity[],
  dealOpportunities: PageOpportunity[],
  modalityCounts: Record<string, number>,
): PageOpportunity[] {
  const all = [...gscOpportunities, ...dealOpportunities];

  // Apply modality trending bonus to GSC gaps that match trending modalities
  for (const opp of all) {
    if (opp.source === 'gsc_gap' && opp.query) {
      const queryLower = opp.query.toLowerCase();
      for (const [modality, count] of Object.entries(modalityCounts)) {
        if (count >= 3 && queryLower.includes(modality.toLowerCase())) {
          opp.priorityScore += 100;
          break;
        }
      }
    }
  }

  // Deduplicate by slug
  const slugMap = new Map<string, PageOpportunity>();
  for (const opp of all) {
    const existing = slugMap.get(opp.slug);
    if (!existing || opp.priorityScore > existing.priorityScore) {
      slugMap.set(opp.slug, opp);
    }
  }

  return [...slugMap.values()]
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, 20);
}

// ── Step 4: Slack notification ──────────────────────────────────────────────────

async function sendSlackNotification(
  opportunities: PageOpportunity[],
  currentPageCount: number,
  totalOpportunities: number,
): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;

  const top10 = opportunities.slice(0, 10);
  const estClicks = top10.reduce((sum, o) => {
    // Estimate CTR based on position
    const ctr = o.position > 0 && o.position <= 3 ? 0.15 : o.position <= 10 ? 0.05 : 0.02;
    return sum + Math.round(o.impressions * ctr);
  }, 0);

  const lines = top10.map((opp, i) => {
    const posStr = opp.position > 0 ? `, pos ${opp.position}` : '';
    const impStr = opp.impressions > 0 ? `${opp.impressions} imp${posStr}` : `source: ${opp.source}`;
    return `${i + 1}. "${opp.query || opp.slug}" → \`/benchmarks/${opp.slug}\` (${impStr}, score: ${opp.priorityScore})`;
  });

  const message = [
    `:bar_chart: *Weekly SEO Page Expansion Report*`,
    '',
    `:dart: *Top 10 Page Opportunities:*`,
    ...lines,
    '',
    `:chart_with_upwards_trend: Current pages: ${currentPageCount} | New opportunities: ${totalOpportunities}`,
    `:moneybag: Est. monthly clicks from new pages: ~${estClicks * 4}`,
  ].join('\n');

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: ':bar_chart: Weekly SEO Page Expansion Report',
        attachments: [{
          color: '#2563eb',
          blocks: [
            {
              type: 'header',
              text: { type: 'plain_text', text: 'Weekly SEO Page Expansion Report' },
            },
            {
              type: 'section',
              text: { type: 'mrkdwn', text: message },
            },
            {
              type: 'context',
              elements: [{
                type: 'mrkdwn',
                text: `Generated ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' })} | Top 20 stored in seo_generated_pages`,
              }],
            },
          ],
        }],
      }),
    });
  } catch (err) {
    console.error('[seo-page-expand] Slack notification error:', err instanceof Error ? err.message : 'unknown');
  }
}

// ── Step 5: Store in Supabase ───────────────────────────────────────────────────

async function ensureTable(supabase: ReturnType<typeof createServiceClient>): Promise<void> {
  // Check if the table exists by attempting a select; if it fails, create it
  const { error } = await supabase
    .from('seo_generated_pages')
    .select('id')
    .limit(1);

  if (error && error.code === '42P01') {
    // Table does not exist — create it via raw SQL
    const { error: createError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS seo_generated_pages (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          slug TEXT UNIQUE NOT NULL,
          page_data JSONB NOT NULL,
          source TEXT NOT NULL,
          priority_score NUMERIC,
          status TEXT DEFAULT 'active',
          impressions_at_creation INTEGER,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_seo_generated_pages_slug ON seo_generated_pages(slug);
        CREATE INDEX IF NOT EXISTS idx_seo_generated_pages_status ON seo_generated_pages(status);
      `,
    });

    if (createError) {
      console.warn('[seo-page-expand] Could not auto-create seo_generated_pages table:', createError.message);
      console.warn('[seo-page-expand] Please create the table manually via migration.');
    }
  }
}

async function storeOpportunities(
  supabase: ReturnType<typeof createServiceClient>,
  opportunities: PageOpportunity[],
): Promise<{ inserted: number; updated: number; errors: string[] }> {
  let inserted = 0;
  let updated = 0;
  const errors: string[] = [];

  for (const opp of opportunities) {
    // Upsert: insert or update if slug already exists
    const { error } = await supabase
      .from('seo_generated_pages')
      .upsert(
        {
          slug: opp.slug,
          page_data: opp.pageData as unknown as Record<string, unknown>,
          source: opp.source,
          priority_score: opp.priorityScore,
          status: 'active',
          impressions_at_creation: opp.impressions,
        },
        { onConflict: 'slug' },
      );

    if (error) {
      errors.push(`${opp.slug}: ${error.message}`);
    } else {
      // Check if it was an insert or update by querying created_at
      const { data: row } = await supabase
        .from('seo_generated_pages')
        .select('created_at')
        .eq('slug', opp.slug)
        .single();

      if (row) {
        const age = Date.now() - new Date(row.created_at).getTime();
        if (age < 60_000) {
          inserted++;
        } else {
          updated++;
        }
      }
    }
  }

  return { inserted, updated, errors };
}

// ── Route handler ───────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  // 1. Auth — timing-safe comparison, same pattern as seo-content-suggestions
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: 'CRON_SECRET not set' }, { status: 500 });

  const expectedToken = `Bearer ${cronSecret}`;
  const providedToken = authHeader || '';
  const isValidLength = providedToken.length === expectedToken.length;
  const tokenToCompare = isValidLength ? providedToken : expectedToken;
  const isValid = isValidLength && timingSafeEqual(Buffer.from(tokenToCompare), Buffer.from(expectedToken));
  if (!isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const startTime = Date.now();
  const supabase = createServiceClient();

  try {
    // 2. Gather existing benchmark slugs
    const existingSlugs = new Set(getAllBenchmarkSlugs());
    const currentPageCount = existingSlugs.size;

    // Also include slugs already in seo_generated_pages to avoid duplicates
    const { data: existingGenerated } = await supabase
      .from('seo_generated_pages')
      .select('slug')
      .eq('status', 'active');

    for (const row of existingGenerated || []) {
      existingSlugs.add(row.slug);
    }

    // 3. Identify gaps in parallel
    const [gscOpportunities, { opportunities: dealOpportunities, modalityCounts }] = await Promise.all([
      identifyGSCGaps(existingSlugs),
      identifyDealOpportunities(supabase, existingSlugs),
    ]);

    // 4. Score and rank
    const rankedOpportunities = scoreAndRank(gscOpportunities, dealOpportunities, modalityCounts);
    const totalOpportunities = gscOpportunities.length + dealOpportunities.length;

    // 5. Ensure table exists and store results
    await ensureTable(supabase);
    const { inserted, updated, errors } = await storeOpportunities(supabase, rankedOpportunities);

    // 6. Send Slack notification
    await sendSlackNotification(rankedOpportunities, currentPageCount, totalOpportunities);

    // 7. Log the cron run
    const durationMs = Date.now() - startTime;
    await logCronRun(supabase, 'seo-page-expand', {
      fetched: gscOpportunities.length + dealOpportunities.length,
      processed: rankedOpportunities.length,
      inserted,
      errors,
      parameters: {
        gscGaps: gscOpportunities.length,
        dealOpportunities: dealOpportunities.length,
        trendingModalities: Object.entries(modalityCounts)
          .filter(([, c]) => c >= 3)
          .map(([m]) => m),
        updated,
        durationMs,
      },
    });

    // Intelligence tracking
    try {
      await runCronIntelligence(supabase, 'seo-page-expand', {
        processed: rankedOpportunities.length,
        inserted,
      });
    } catch {}

    return NextResponse.json({
      success: true,
      durationMs,
      currentPageCount,
      totalOpportunities,
      stored: rankedOpportunities.length,
      inserted,
      updated,
      errors: errors.length,
      top10: rankedOpportunities.slice(0, 10).map((o) => ({
        slug: o.slug,
        source: o.source,
        score: o.priorityScore,
        impressions: o.impressions,
        position: o.position,
        query: o.query,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[seo-page-expand] Error:', message);

    // Log failure
    try {
      await logCronRun(supabase, 'seo-page-expand', {
        errors: [message],
        parameters: { durationMs: Date.now() - startTime },
      });
    } catch {
      // Non-fatal
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
