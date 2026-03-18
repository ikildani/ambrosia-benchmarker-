/**
 * FDA Breakthrough Therapy Designation Tracker
 *
 * Tracks all drugs with FDA Breakthrough Therapy Designation (BTD).
 * Cross-references with deals to flag BTD assets — these have faster
 * regulatory timelines and higher PoS, affecting deal valuation.
 *
 * Primary source: Friends of Cancer Research interactive database
 * https://friendsofcancerresearch.org/breakthrough-therapies/
 * 634 BTDs granted since 2012, 336 approved.
 *
 * Secondary source: FDA CDER reports
 * https://www.fda.gov/drugs/ind-activity/breakthrough-therapy-designation-requests
 */

import { fetchWithTimeout } from '../fetch-with-timeout';
import type { SupabaseClient } from '@supabase/supabase-js';

const FDA_BTD_PAGE = 'https://www.fda.gov/drugs/ind-activity/breakthrough-therapy-designation-requests';

/**
 * Fetch FDA Breakthrough Therapy designation data.
 * Uses Perplexity to extract structured BTD data since FDA
 * doesn't provide a JSON API for designation lists.
 */
export async function runFDABreakthroughIngestion(
  supabase: SupabaseClient,
  perplexityApiKey: string,
): Promise<{ fetched: number; stored: number; enriched_deals: number; errors: string[] }> {
  const errors: string[] = [];
  let fetched = 0;
  let stored = 0;
  let enrichedDeals = 0;

  try {
    // Use Perplexity to get current BTD list
    const response = await fetchWithTimeout('https://api.perplexity.ai/v1/responses', {
      timeoutMs: 30_000,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${perplexityApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        preset: 'fast-search',
        input: 'List all FDA Breakthrough Therapy designations granted in 2024 and 2025 for biopharma drugs. For each, provide: drug name, company/sponsor, indication, date of designation, and current status (approved/in development/withdrawn). Format as a structured list.',
      }),
    });

    if (!response.ok) {
      errors.push(`Perplexity BTD search failed: ${response.status}`);
      return { fetched, stored, enriched_deals: enrichedDeals, errors };
    }

    const data = await response.json();
    let text = '';
    for (const item of data.output || []) {
      if (item.type === 'message') {
        for (const c of item.content || []) {
          if (c.type === 'output_text') text += c.text + '\n';
        }
      }
    }

    if (text.length < 100) {
      errors.push('Perplexity returned insufficient BTD data');
      return { fetched, stored, enriched_deals: enrichedDeals, errors };
    }

    // Store BTD signals in research_signals
    // Parse drug names from the text (simple extraction)
    const drugMentions = text.match(/(?:^|\n)\s*[-•*]\s*\*?\*?([A-Z][a-zA-Z0-9-]+(?:\s+[a-zA-Z0-9-]+)?)\*?\*?\s*[\(–—:]/gm);

    if (drugMentions) {
      for (const mention of drugMentions) {
        const drugName = mention.replace(/^[\s\-•*]+/, '').replace(/[\(–—:*]+$/, '').trim();
        if (drugName.length < 3 || drugName.length > 50) continue;

        const { error } = await supabase.from('research_signals').upsert({
          source_type: 'fda_btd',
          source_id: `btd-${drugName.toLowerCase().replace(/\s+/g, '-')}`,
          title: `${drugName} — FDA Breakthrough Therapy Designation`,
          abstract: text.substring(text.indexOf(drugName), text.indexOf(drugName) + 200),
          therapeutic_area: 'other',
          signal_type: 'regulatory',
        }, { onConflict: 'source_type,source_id' });

        if (!error) stored++;
        fetched++;
      }
    }

    // Cross-reference BTDs with existing deals — update regulatory_designations
    const { data: btdDeals } = await supabase
      .from('deals')
      .select('id, asset_name, regulatory_designations')
      .not('asset_name', 'is', null);

    if (btdDeals && drugMentions) {
      const btdNames = new Set(drugMentions.map(m =>
        m.replace(/^[\s\-•*]+/, '').replace(/[\(–—:*]+$/, '').trim().toLowerCase()
      ));

      for (const deal of btdDeals) {
        if (!deal.asset_name) continue;
        const assetLower = deal.asset_name.toLowerCase();

        if (btdNames.has(assetLower) || [...btdNames].some(b => assetLower.includes(b))) {
          const currentDesignations = deal.regulatory_designations || [];
          if (!currentDesignations.includes('breakthrough')) {
            await supabase.from('deals').update({
              regulatory_designations: [...currentDesignations, 'breakthrough'],
            }).eq('id', deal.id);
            enrichedDeals++;
          }
        }
      }
    }

    console.log(`[FDA BTD] Fetched ${fetched} designations, stored ${stored}, enriched ${enrichedDeals} deals`);
  } catch (err) {
    errors.push(`FDA BTD error: ${err}`);
  }

  return { fetched, stored, enriched_deals: enrichedDeals, errors };
}
