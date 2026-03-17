/**
 * Perplexity Embeddings for Semantic Deal Matching
 *
 * Embeds deal descriptions into 3,416-dim vectors using pplx-embed-v1-4b.
 * Enables semantic search: "oral obesity drug Phase 2 licensing deal"
 * finds the most similar deals by meaning, not just keyword overlap.
 *
 * Cost: ~$0.000001 per embedding (essentially free)
 */

import { fetchWithTimeout } from './fetch-with-timeout';
import type { SupabaseClient } from '@supabase/supabase-js';

const PERPLEXITY_EMBED_API = 'https://api.perplexity.ai/v1/embeddings';
const EMBED_MODEL = 'pplx-embed-v1-4b';
const EMBED_DIMS = 2560; // int8 encoding gives 2560 dimensions
const BATCH_SIZE = 5;

/**
 * Decode base64-encoded int8 embedding from Perplexity into float array.
 */
function decodeBase64Int8(b64: string): number[] {
  // Decode base64 to binary
  const binary = Buffer.from(b64, 'base64');
  // Convert int8 bytes to float array (normalize to [-1, 1] range)
  const result: number[] = [];
  for (let i = 0; i < binary.length; i++) {
    // Read as signed int8
    const val = binary[i] > 127 ? binary[i] - 256 : binary[i];
    result.push(val / 127.0); // Normalize to [-1, 1]
  }
  return result;
}

/**
 * Generate embedding for a single text using Perplexity.
 */
export async function generateEmbedding(
  text: string,
  apiKey: string
): Promise<number[]> {
  const response = await fetchWithTimeout(PERPLEXITY_EMBED_API, {
    timeoutMs: 15_000,
    retries: 1,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: [text],
      model: EMBED_MODEL,
      encoding_format: 'base64_int8',
    }),
  });

  if (!response.ok) {
    throw new Error(`Perplexity embedding error: ${response.status}`);
  }

  const data = await response.json();
  const raw = data.data?.[0]?.embedding;
  if (!raw) return [];
  return decodeBase64Int8(raw);
}

/**
 * Generate embeddings for multiple texts in a batch.
 */
export async function generateEmbeddings(
  texts: string[],
  apiKey: string
): Promise<number[][]> {
  const response = await fetchWithTimeout(PERPLEXITY_EMBED_API, {
    timeoutMs: 30_000,
    retries: 1,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: texts,
      model: EMBED_MODEL,
      encoding_format: 'base64_int8',
    }),
  });

  if (!response.ok) {
    throw new Error(`Perplexity batch embedding error: ${response.status}`);
  }

  const data = await response.json();
  return (data.data || []).map((d: { embedding: string }) => decodeBase64Int8(d.embedding));
}

/**
 * Build a rich text description of a deal for embedding.
 * This captures the semantic essence of the deal for similarity matching.
 */
export function buildDealText(deal: {
  licensor_name?: string;
  licensee_name?: string;
  asset_name?: string;
  asset_description?: string;
  modality?: string;
  indication_specific?: string;
  indication_category?: string;
  phase_at_signing?: string;
  territory?: string;
  deal_type?: string;
  therapeutic_area?: string;
  upfront_usd?: number | null;
  total_deal_value_usd?: number | null;
}): string {
  const parts = [
    deal.deal_type && `${deal.deal_type} deal`,
    deal.licensor_name && deal.licensee_name && `${deal.licensor_name} grants rights to ${deal.licensee_name}`,
    deal.asset_name && `for ${deal.asset_name}`,
    deal.asset_description,
    deal.modality && `modality: ${deal.modality}`,
    deal.indication_specific || deal.indication_category,
    deal.therapeutic_area && `therapeutic area: ${deal.therapeutic_area}`,
    deal.phase_at_signing && `phase: ${deal.phase_at_signing}`,
    deal.territory && `territory: ${deal.territory}`,
    deal.upfront_usd && `upfront: $${(deal.upfront_usd / 1_000_000).toFixed(0)}M`,
    deal.total_deal_value_usd && `total value: $${(deal.total_deal_value_usd / 1_000_000).toFixed(0)}M`,
  ].filter(Boolean);

  return parts.join('. ');
}

/**
 * Embed all deals that don't have embeddings yet.
 * Run this as a cron or one-time backfill.
 */
export async function embedUnprocessedDeals(
  supabase: SupabaseClient,
  perplexityApiKey: string,
  options?: { limit?: number; timeBudgetMs?: number }
): Promise<{ processed: number; errors: number }> {
  const startTime = Date.now();
  const timeBudget = options?.timeBudgetMs || 240_000;
  const limit = options?.limit || 200;

  // Get deals without embeddings
  const { data: deals } = await supabase
    .from('deals')
    .select('id, licensor_name, licensee_name, asset_name, asset_description, modality, indication_specific, indication_category, phase_at_signing, territory, deal_type, therapeutic_area, upfront_usd, total_deal_value_usd')
    .is('embedding', null)
    .neq('therapeutic_area', 'other')
    .order('confidence_score', { ascending: false })
    .limit(limit);

  if (!deals || deals.length === 0) {
    return { processed: 0, errors: 0 };
  }

  let processed = 0;
  let errors = 0;

  // Process in batches
  for (let i = 0; i < deals.length; i += BATCH_SIZE) {
    if (Date.now() - startTime > timeBudget) break;

    const batch = deals.slice(i, i + BATCH_SIZE);
    const texts = batch.map(deal => buildDealText(deal));

    try {
      const embeddings = await generateEmbeddings(texts, perplexityApiKey);

      for (let j = 0; j < batch.length; j++) {
        if (embeddings[j] && embeddings[j].length === EMBED_DIMS) {
          // pgvector expects format: [0.1, 0.2, ...]
          const vecStr = `[${embeddings[j].join(',')}]`;
          const { error } = await supabase
            .from('deals')
            .update({ embedding: vecStr })
            .eq('id', batch[j].id);

          if (!error) {
            processed++;
          } else {
            errors++;
          }
        }
      }

      // Minimal rate limiting — Perplexity embeddings are fast
      await new Promise(r => setTimeout(r, 200));
    } catch {
      errors += batch.length;
    }
  }

  return { processed, errors };
}

/**
 * Find semantically similar deals given user's calculation inputs.
 * Call this from the calculator to get AI-powered comparable deals.
 */
export async function findSimilarDeals(
  supabase: SupabaseClient,
  perplexityApiKey: string,
  inputs: {
    therapeuticArea?: string;
    indication?: string;
    modality?: string;
    phase?: string;
    territory?: string;
    dealType?: string;
  },
  matchCount: number = 10
): Promise<Array<{
  id: string;
  licensor_name: string;
  licensee_name: string;
  asset_name: string;
  deal_type: string;
  therapeutic_area: string;
  upfront_usd: number | null;
  total_deal_value_usd: number | null;
  announced_date: string;
  similarity: number;
}>> {
  // Build query text from user inputs
  const queryText = [
    inputs.dealType && `${inputs.dealType} deal`,
    inputs.modality && `${inputs.modality} drug`,
    inputs.indication,
    inputs.therapeuticArea && `in ${inputs.therapeuticArea}`,
    inputs.phase && `at ${inputs.phase} stage`,
    inputs.territory && `for ${inputs.territory} territory`,
  ].filter(Boolean).join(' ');

  if (!queryText) return [];

  // Generate embedding for user's query
  const embedding = await generateEmbedding(queryText, perplexityApiKey);
  if (embedding.length !== 3416) return [];

  // Search using pgvector
  const vecStr = `[${embedding.join(',')}]`;
  const { data, error } = await supabase.rpc('match_deals', {
    query_embedding: vecStr,
    match_count: matchCount,
    match_threshold: 0.25,
    filter_ta: inputs.therapeuticArea || null,
  });

  if (error || !data) return [];
  return data;
}
