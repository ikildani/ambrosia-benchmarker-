/**
 * API Route: Deal Enrichment Pipeline
 *
 * Uses Perplexity to enrich deals with:
 * 1. Source URLs (press release links)
 * 2. Financial terms (upfront, milestones, royalties)
 * 3. Exact announcement dates
 *
 * POST /api/deals/enrich?mode=urls|terms|dates|all&limit=50
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { verifyAdminAuth } from '@/lib/admin-auth';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';
import { findOrCreateCompany } from '@/lib/ingestion/sec-edgar';
import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const PERPLEXITY_API = 'https://api.perplexity.ai/v1/responses';
const MAX_RUNTIME_MS = 260_000;

interface DealToEnrich {
  id: string;
  licensor_name: string;
  licensee_name: string;
  asset_name: string | null;
  announced_date: string;
  source_url: string | null;
  upfront_usd: number | null;
  total_deal_value_usd: number | null;
  royalty_low_pct: number | null;
  terms_disclosed: boolean;
  licensor_id: string | null;
  licensee_id: string | null;
  therapeutic_area: string;
}

async function searchPerplexity(query: string, apiKey: string): Promise<string> {
  const response = await fetchWithTimeout(PERPLEXITY_API, {
    timeoutMs: 25_000,
    retries: 1,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ preset: 'fast-search', input: query }),
  });

  if (!response.ok) return '';

  const data = await response.json();
  let text = '';
  for (const item of data.output || []) {
    if (item.type === 'message') {
      for (const content of item.content || []) {
        if (content.type === 'output_text') text += content.text + '\n';
      }
    }
  }
  return text;
}

async function extractStructuredEnrichment(
  text: string,
  deal: DealToEnrich,
  anthropicApiKey: string
): Promise<{
  source_url?: string;
  upfront_usd?: number;
  total_deal_value_usd?: number;
  milestones_total_usd?: number;
  royalty_low_pct?: number;
  royalty_high_pct?: number;
  announced_date?: string;
}> {
  const anthropic = new Anthropic({ apiKey: anthropicApiKey, timeout: 30_000 });

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 1000,
    system: 'Extract deal details from text. Return ONLY valid JSON. Use null for unknown values.',
    messages: [{
      role: 'user',
      content: `For this deal: ${deal.licensor_name} → ${deal.licensee_name} for ${deal.asset_name || 'undisclosed asset'} (${deal.therapeutic_area}, ~${deal.announced_date}):

Extract from the search results:
{
  "source_url": "URL of the original press release or announcement",
  "upfront_usd": number in full dollars or null,
  "total_deal_value_usd": number or null,
  "milestones_total_usd": number or null,
  "royalty_low_pct": number or null,
  "royalty_high_pct": number or null,
  "announced_date": "YYYY-MM-DD exact date or null"
}

Search results:
${text.substring(0, 4000)}`
    }],
  });

  const textContent = response.content[0];
  if (textContent.type !== 'text') return {};

  const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return {};

  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    return {};
  }
}

export async function POST(request: NextRequest) {
  const authError = await verifyAdminAuth(request);
  if (authError) return authError;

  const perplexityKey = process.env.PERPLEXITY_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!perplexityKey || !anthropicKey) {
    return NextResponse.json({ error: 'API keys not configured' }, { status: 500 });
  }

  const supabase = createServiceClient();
  const startTime = Date.now();
  const url = new URL(request.url);
  const mode = url.searchParams.get('mode') || 'all';
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '30', 10), 100);

  // Build query based on mode
  let query = supabase
    .from('deals')
    .select('id, licensor_name, licensee_name, asset_name, announced_date, source_url, upfront_usd, total_deal_value_usd, royalty_low_pct, terms_disclosed, licensor_id, licensee_id, therapeutic_area')
    .not('therapeutic_area', 'in', '("other","_option_deals","_codev_deals","_china_deals")');

  if (mode === 'urls') {
    query = query.is('source_url', null);
  } else if (mode === 'terms') {
    query = query.eq('terms_disclosed', false);
  } else if (mode === 'linkage') {
    query = query.or('licensor_id.is.null,licensee_id.is.null');
  } else {
    // 'all' mode: prioritize deals missing the most data
    query = query.or('source_url.is.null,terms_disclosed.eq.false,licensor_id.is.null,licensee_id.is.null');
  }

  const { data: deals } = await query
    .order('confidence_score', { ascending: false })
    .limit(limit);

  if (!deals || deals.length === 0) {
    return NextResponse.json({ success: true, message: 'No deals to enrich', processed: 0 });
  }

  const result = {
    processed: 0,
    urls_found: 0,
    terms_found: 0,
    dates_fixed: 0,
    companies_linked: 0,
    errors: [] as string[],
  };

  for (const deal of deals as DealToEnrich[]) {
    if (Date.now() - startTime > MAX_RUNTIME_MS) break;

    try {
      const searchQuery = `${deal.licensor_name} ${deal.licensee_name} ${deal.asset_name || ''} licensing deal announcement ${new Date(deal.announced_date).getFullYear()} press release upfront milestone royalty`;

      const perplexityText = await searchPerplexity(searchQuery, perplexityKey);

      if (perplexityText.length < 50) {
        result.processed++;
        continue;
      }

      const enrichment = await extractStructuredEnrichment(perplexityText, deal, anthropicKey);

      // Build update object — only update fields that are currently missing
      const updates: Record<string, unknown> = {};

      if (enrichment.source_url && !deal.source_url) {
        updates.source_url = enrichment.source_url;
        result.urls_found++;
      }

      if (enrichment.upfront_usd && !deal.upfront_usd) {
        updates.upfront_usd = enrichment.upfront_usd;
        updates.terms_disclosed = true;
        result.terms_found++;
      }

      if (enrichment.total_deal_value_usd && !deal.total_deal_value_usd) {
        updates.total_deal_value_usd = enrichment.total_deal_value_usd;
        updates.terms_disclosed = true;
        result.terms_found++;
      }

      if (enrichment.milestones_total_usd) {
        updates.milestones_total_usd = enrichment.milestones_total_usd;
      }

      if (enrichment.royalty_low_pct && !deal.royalty_low_pct) {
        updates.royalty_low_pct = enrichment.royalty_low_pct;
        if (enrichment.royalty_high_pct) updates.royalty_high_pct = enrichment.royalty_high_pct;
      }

      if (enrichment.announced_date && enrichment.announced_date.length === 10) {
        const today = new Date().toISOString().split('T')[0];
        if (enrichment.announced_date <= today && enrichment.announced_date >= '2017-01-01') {
          updates.announced_date = enrichment.announced_date;
          result.dates_fixed++;
        }
      }

      // Company linkage fix
      if (!deal.licensor_id && deal.licensor_name) {
        try {
          const id = await findOrCreateCompany(supabase, deal.licensor_name, false);
          if (id) { updates.licensor_id = id; result.companies_linked++; }
        } catch {}
      }
      if (!deal.licensee_id && deal.licensee_name) {
        try {
          const id = await findOrCreateCompany(supabase, deal.licensee_name, true);
          if (id) { updates.licensee_id = id; result.companies_linked++; }
        } catch {}
      }

      if (Object.keys(updates).length > 0) {
        await supabase.from('deals').update(updates).eq('id', deal.id);
      }

      result.processed++;
      await new Promise(r => setTimeout(r, 1500));
    } catch (err) {
      result.errors.push(`${deal.licensor_name}/${deal.licensee_name}: ${err}`);
    }
  }

  // Log
  await supabase.from('data_ingestion_log').insert({
    source: 'deal_enrichment',
    run_type: 'manual',
    parameters: { mode, limit },
    records_fetched: deals.length,
    records_processed: result.processed,
    records_inserted: result.urls_found + result.terms_found,
    status: 'completed',
    completed_at: new Date().toISOString(),
  });

  return NextResponse.json({ success: true, ...result });
}
