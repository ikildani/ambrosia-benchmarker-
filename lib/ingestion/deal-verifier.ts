/**
 * Deal Auto-Verification System
 *
 * Cross-references pending deals against web sources using Perplexity search,
 * then uses Claude to compare the DB record against search results.
 * Marks deals as verified, flagged, or rejected with confidence scores.
 *
 * Cost: ~$0.006 per Perplexity query + ~$0.01 per Claude verification
 * Expected throughput: ~20 deals per cron run
 */

import Anthropic from '@anthropic-ai/sdk';
import { fetchWithTimeout } from '../fetch-with-timeout';
import { isTimeBudgetExceeded } from '../cron-utils';
import type { SupabaseClient } from '@supabase/supabase-js';

const PERPLEXITY_API = 'https://api.perplexity.ai/v1/responses';

interface VerificationResult {
  status: 'verified' | 'flagged' | 'rejected';
  confidence: number;
  reason: string;
  corrected_value?: number;
  corrected_date?: string;
}

export async function verifyPendingDeals(
  supabase: SupabaseClient,
  perplexityApiKey: string,
  anthropicApiKey: string,
  options?: { maxDeals?: number; timeBudgetMs?: number }
): Promise<{
  verified: number;
  flagged: number;
  unchanged: number;
  errors: string[];
}> {
  const maxDeals = options?.maxDeals ?? 20;
  const timeBudgetMs = options?.timeBudgetMs ?? 250_000;
  const startTime = Date.now();

  const result = { verified: 0, flagged: 0, unchanged: 0, errors: [] as string[] };

  // 1. Query pending deals — prioritize discovery-stage deals (only 9%
  // verified vs 29% for preclinical) then highest value. The two-pass
  // approach ensures early-stage deals get verified without starving
  // high-value deals from the queue.
  const { data: discoveryDeals } = await supabase
    .from('deals')
    .select('id, licensor_name, licensee_name, asset_name, deal_type, upfront_usd, milestones_total_usd, total_deal_value_usd, announced_date, indication_category, therapeutic_area, phase_at_signing, territory, source_url, confidence_score')
    .eq('verification_status', 'pending')
    .in('phase_at_signing', ['discovery', 'preclinical'])
    .order('total_deal_value_usd', { ascending: false, nullsFirst: false })
    .limit(Math.ceil(maxDeals * 0.3));

  const discoveryIds = new Set((discoveryDeals || []).map(d => d.id));

  const { data: remainingDeals, error: queryError } = await supabase
    .from('deals')
    .select('id, licensor_name, licensee_name, asset_name, deal_type, upfront_usd, milestones_total_usd, total_deal_value_usd, announced_date, indication_category, therapeutic_area, phase_at_signing, territory, source_url, confidence_score')
    .eq('verification_status', 'pending')
    .order('total_deal_value_usd', { ascending: false, nullsFirst: false })
    .limit(maxDeals);

  const deals = [
    ...(discoveryDeals || []),
    ...(remainingDeals || []).filter(d => !discoveryIds.has(d.id)),
  ].slice(0, maxDeals);

  if (queryError) {
    result.errors.push(`Query failed: ${queryError.message}`);
    return result;
  }

  if (!deals || deals.length === 0) {
    return result;
  }

  const anthropic = new Anthropic({ apiKey: anthropicApiKey, timeout: 60_000 });

  for (const deal of deals) {
    // 3. Check time budget between each deal
    if (isTimeBudgetExceeded(startTime, timeBudgetMs)) {
      console.log('[deal-verifier] Time budget exceeded, stopping');
      break;
    }

    try {
      // 2a. Build Perplexity search query
      const year = deal.announced_date
        ? new Date(deal.announced_date).getFullYear()
        : '';
      const searchQuery = `"${deal.licensor_name}" "${deal.licensee_name}" deal ${year} terms`;

      // 2b. Call Perplexity API
      const response = await fetchWithTimeout(PERPLEXITY_API, {
        timeoutMs: 20_000,
        retries: 1,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${perplexityApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          preset: 'fast-search',
          input: searchQuery,
        }),
      });

      if (!response.ok) {
        result.errors.push(`Perplexity ${response.status} for ${deal.licensor_name}/${deal.licensee_name}`);
        result.unchanged++;
        continue;
      }

      const data = await response.json();
      let perplexityText = '';
      for (const item of data.output || []) {
        if (item.type === 'message') {
          for (const content of item.content || []) {
            if (content.type === 'output_text') {
              perplexityText += content.text + '\n';
            }
          }
        }
      }

      if (perplexityText.length < 50) {
        // Not enough data to verify — leave as pending
        result.unchanged++;
        continue;
      }

      // 2c. Send to Claude for comparison
      const dealRecord = {
        licensor: deal.licensor_name,
        licensee: deal.licensee_name,
        asset: deal.asset_name,
        deal_type: deal.deal_type,
        upfront_usd: deal.upfront_usd,
        milestones_total_usd: deal.milestones_total_usd,
        total_deal_value_usd: deal.total_deal_value_usd,
        announced_date: deal.announced_date,
        indication: deal.indication_category,
        therapeutic_area: deal.therapeutic_area,
        phase: deal.phase_at_signing,
        territory: deal.territory,
      };

      const claudeResponse = await anthropic.messages.create({
        model: 'claude-opus-4-6',
        max_tokens: 600,
        system: 'You verify biopharma deal data. Compare a database record against web search results. Return ONLY valid JSON.',
        messages: [{
          role: 'user',
          content: `Compare this deal record from our database against the web search results.

Database record: ${JSON.stringify(dealRecord)}

Web search results: ${perplexityText.substring(0, 4000)}

Respond with JSON: { "status": "verified" | "flagged" | "rejected", "confidence": number (0-100), "reason": string, "corrected_value": number | null, "corrected_date": string | null }

Rules:
- "verified": The deal exists and key facts (companies, approximate value, date) match.
- "flagged": The deal likely exists but has significant discrepancies (value off by >30%, wrong date, wrong companies).
- "rejected": No evidence this deal exists or it appears fabricated.
- corrected_value: If the total deal value in the DB is wrong, provide the correct value in USD. Otherwise null.
- corrected_date: If the announced date is wrong, provide correct date as YYYY-MM-DD. Otherwise null.`,
        }],
      });

      // 2d. Parse Claude's response
      const textContent = claudeResponse.content[0];
      if (textContent.type !== 'text') {
        result.unchanged++;
        continue;
      }

      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        result.unchanged++;
        continue;
      }

      let verification: VerificationResult;
      try {
        verification = JSON.parse(jsonMatch[0]) as VerificationResult;
      } catch {
        result.errors.push(`JSON parse failed for ${deal.licensor_name}/${deal.licensee_name}`);
        result.unchanged++;
        continue;
      }

      // Validate status
      if (!['verified', 'flagged', 'rejected'].includes(verification.status)) {
        result.unchanged++;
        continue;
      }

      // 2e-g. Update deal based on status
      const updates: Record<string, unknown> = {
        verification_status: verification.status,
        verification_notes: verification.reason,
      };

      if (verification.status === 'verified') {
        updates.verified = true;

        // 2h. Apply corrections if verified with corrected values
        if (verification.corrected_value && verification.corrected_value > 0) {
          updates.total_deal_value_usd = verification.corrected_value;
        }
        if (verification.corrected_date && /^\d{4}-\d{2}-\d{2}$/.test(verification.corrected_date)) {
          const today = new Date().toISOString().split('T')[0];
          if (verification.corrected_date <= today && verification.corrected_date >= '2017-01-01') {
            updates.announced_date = verification.corrected_date;
          }
        }

        result.verified++;
      } else if (verification.status === 'flagged') {
        result.flagged++;
      } else {
        // rejected
        result.flagged++; // count in flagged for reporting purposes
      }

      await supabase.from('deals').update(updates).eq('id', deal.id);

      // Rate limit between API calls
      await new Promise(r => setTimeout(r, 2000));

    } catch (err) {
      result.errors.push(`${deal.licensor_name}/${deal.licensee_name}: ${String(err)}`);
      result.unchanged++;
    }
  }

  return result;
}
