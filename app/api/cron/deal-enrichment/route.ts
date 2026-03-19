/**
 * Cron: Deal Enrichment
 *
 * Enriches deals missing source URLs, financial terms, or company linkage
 * using Perplexity web search + Claude extraction.
 *
 * Processes ~20 deals per run. At 3x/day, enriches ~60 deals/day.
 * Full database enrichment: ~50 days for 3,000 deals.
 *
 * Schedule: 3x/day (03:30, 11:30, 19:30 UTC) — offset from other crons
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';
import { findOrCreateCompany } from '@/lib/ingestion/sec-edgar';
import Anthropic from '@anthropic-ai/sdk';
import { logCronRun } from '@/lib/cron-utils';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const PERPLEXITY_API = 'https://api.perplexity.ai/v1/responses';
const MAX_RUNTIME_MS = 250_000;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });

  const expectedToken = `Bearer ${cronSecret}`;
  const providedToken = authHeader || '';
  const isValidLength = providedToken.length === expectedToken.length;
  const tokenToCompare = isValidLength ? providedToken : expectedToken;
  const isValid = isValidLength && timingSafeEqual(Buffer.from(tokenToCompare), Buffer.from(expectedToken));

  if (!isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const perplexityKey = process.env.PERPLEXITY_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!perplexityKey || !anthropicKey) {
    return NextResponse.json({ error: 'API keys not configured' }, { status: 500 });
  }

  const supabase = createServiceClient();
  const startTime = Date.now();

  // Get deals needing enrichment — prioritize missing URLs and terms
  const { data: deals } = await supabase
    .from('deals')
    .select('id, licensor_name, licensee_name, asset_name, announced_date, source_url, upfront_usd, total_deal_value_usd, royalty_low_pct, terms_disclosed, licensor_id, licensee_id, therapeutic_area')
    .not('therapeutic_area', 'in', '("other","_option_deals","_codev_deals","_china_deals")')
    .or('source_url.is.null,terms_disclosed.eq.false,licensor_id.is.null,licensee_id.is.null')
    .order('confidence_score', { ascending: false })
    .limit(20);

  if (!deals || deals.length === 0) {
    return NextResponse.json({ success: true, message: 'All deals enriched', processed: 0 });
  }

  const result = { processed: 0, urls_found: 0, terms_found: 0, dates_fixed: 0, companies_linked: 0, errors: [] as string[] };

  // Pre-fetch company name→ID map to avoid N+1 queries
  const companyNames = new Set<string>();
  for (const deal of deals) {
    if (!deal.licensor_id && deal.licensor_name) companyNames.add(deal.licensor_name);
    if (!deal.licensee_id && deal.licensee_name) companyNames.add(deal.licensee_name);
  }
  const companyIdCache = new Map<string, string>();
  if (companyNames.size > 0) {
    const { data: companies } = await supabase
      .from('companies')
      .select('id, name, name_variations')
      .limit(1000);
    for (const c of companies || []) {
      companyIdCache.set(c.name.toLowerCase(), c.id);
      if (c.name_variations) {
        for (const v of c.name_variations) {
          companyIdCache.set(v.toLowerCase(), c.id);
        }
      }
    }
  }

  for (const deal of deals) {
    if (Date.now() - startTime > MAX_RUNTIME_MS) break;

    try {
      const searchQuery = `"${deal.licensor_name}" "${deal.licensee_name}" ${deal.asset_name || ''} deal announcement press release ${new Date(deal.announced_date).getFullYear()}`;

      const response = await fetchWithTimeout(PERPLEXITY_API, {
        timeoutMs: 20_000, retries: 1, method: 'POST',
        headers: { 'Authorization': `Bearer ${perplexityKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ preset: 'fast-search', input: searchQuery }),
      });

      if (!response.ok) { result.processed++; continue; }

      const data = await response.json();
      let text = '';
      for (const item of data.output || []) {
        if (item.type === 'message') {
          for (const c of item.content || []) {
            if (c.type === 'output_text') text += c.text + '\n';
          }
        }
      }

      if (text.length < 50) { result.processed++; continue; }

      // Extract structured data with Claude
      const anthropic = new Anthropic({ apiKey: anthropicKey, timeout: 30_000 });
      const extraction = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 800,
        system: 'Extract deal details. Return ONLY valid JSON. Use null for unknown.',
        messages: [{
          role: 'user',
          content: `Deal: ${deal.licensor_name} → ${deal.licensee_name}, asset: ${deal.asset_name || '?'}, ~${deal.announced_date}

Extract: {"source_url":"press release URL","upfront_usd":number,"total_deal_value_usd":number,"milestones_total_usd":number,"royalty_low_pct":number,"royalty_high_pct":number,"announced_date":"YYYY-MM-DD"}

Text: ${text.substring(0, 3000)}`
        }],
      });

      const textContent = extraction.content[0];
      if (textContent.type !== 'text') { result.processed++; continue; }

      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) { result.processed++; continue; }

      let enrichment: Record<string, unknown>;
      try { enrichment = JSON.parse(jsonMatch[0]); } catch { result.processed++; continue; }

      const updates: Record<string, unknown> = {};

      if (enrichment.source_url && !deal.source_url) { updates.source_url = enrichment.source_url; result.urls_found++; }
      if (enrichment.upfront_usd && !deal.upfront_usd) { updates.upfront_usd = enrichment.upfront_usd; updates.terms_disclosed = true; result.terms_found++; }
      if (enrichment.total_deal_value_usd && !deal.total_deal_value_usd) { updates.total_deal_value_usd = enrichment.total_deal_value_usd; updates.terms_disclosed = true; result.terms_found++; }
      if (enrichment.milestones_total_usd) { updates.milestones_total_usd = enrichment.milestones_total_usd; }
      if (enrichment.royalty_low_pct && !deal.royalty_low_pct) { updates.royalty_low_pct = enrichment.royalty_low_pct; if (enrichment.royalty_high_pct) updates.royalty_high_pct = enrichment.royalty_high_pct; }

      if (enrichment.announced_date && typeof enrichment.announced_date === 'string' && enrichment.announced_date.length === 10) {
        const today = new Date().toISOString().split('T')[0];
        if (enrichment.announced_date <= today && enrichment.announced_date >= '2017-01-01') {
          updates.announced_date = enrichment.announced_date;
          result.dates_fixed++;
        }
      }

      // Company linkage — use cache first, then findOrCreateCompany as fallback
      if (!deal.licensor_id && deal.licensor_name) {
        const cached = companyIdCache.get(deal.licensor_name.toLowerCase());
        if (cached) { updates.licensor_id = cached; result.companies_linked++; }
        else { try { const id = await findOrCreateCompany(supabase, deal.licensor_name, false); if (id) { updates.licensor_id = id; companyIdCache.set(deal.licensor_name.toLowerCase(), id); result.companies_linked++; } } catch {} }
      }
      if (!deal.licensee_id && deal.licensee_name) {
        const cached = companyIdCache.get(deal.licensee_name.toLowerCase());
        if (cached) { updates.licensee_id = cached; result.companies_linked++; }
        else { try { const id = await findOrCreateCompany(supabase, deal.licensee_name, true); if (id) { updates.licensee_id = id; companyIdCache.set(deal.licensee_name.toLowerCase(), id); result.companies_linked++; } } catch {} }
      }

      if (Object.keys(updates).length > 0) {
        await supabase.from('deals').update(updates).eq('id', deal.id);
      }

      result.processed++;
      await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
      result.errors.push(`${deal.licensor_name}: ${err}`);
    }
  }

  await logCronRun(supabase, 'deal_enrichment', {
    fetched: deals.length,
    processed: result.processed,
    inserted: result.urls_found + result.terms_found + result.companies_linked,
    errors: result.errors,
  });

  return NextResponse.json({ success: true, ...result });
}
