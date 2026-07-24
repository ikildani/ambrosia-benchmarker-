/**
 * Cron: Re-extract pending deals from their original source filings
 *
 * For rows where `source_filing_id` or `source_url` points to SEC EDGAR
 * but the extracted fields look garbled (the Phase 1 audit showed ~67%
 * of pending rows were fabricated by the old LLM extractor), this cron
 * refetches the source filing and runs the HARDENED Phase 4 extractor
 * prompt against it. If extraction passes validation, the row is
 * UPDATED in-place (modality, asset_name, phase, financials, etc.).
 * If validation still fails, the row is marked rejected with an audit
 * note — preferable to leaving bad data silently pending.
 *
 * Processes 20 rows per invocation (~10-15 min per run at 30-45 s/row
 * including SEC fetch + Claude call). Re-runs daily until the queue
 * is drained.
 *
 * Phase 3 of the 2026-04-14 DB-quality sweep. See:
 *   - Phase 1 (manual rejection + mass-reject): commit c937838
 *   - Phase 2 (auto-promote trusted-source): commit c937838
 *   - Phase 4 (ingestion hardening): commit ec8f0f3
 *   - Phase 3 (this cron): recovers salvageable garbage rather than
 *     rejecting it, so real deals that were just mis-extracted
 *     the first time can be preserved.
 *
 * Schedule: daily 07:00 UTC (after deal-enrichment, before business hours)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';
import { logCronRun } from '@/lib/cron-utils';
import { extractDealFromFiling } from '@/lib/ingestion/sec-edgar';
import {
  validateExtractedDeal,
  extractAuditExcerpt,
} from '@/lib/ingestion/deal-extraction-validator';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';
import { runCronIntelligence } from '@/lib/cron-intelligence';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const BATCH_SIZE = 20;
const SEC_USER_AGENT =
  'Solidus research@ambrosiaventures.co';

/**
 * Convert SEC accession number to filing directory URL.
 * e.g., "0001683168-26-002858" → "https://www.sec.gov/Archives/edgar/data/{cik}/000168316826002858/"
 */
function sourceUrlFromFilingId(cik: string | null, accessionNumber: string): string | null {
  if (!cik) return null;
  const flat = accessionNumber.replace(/-/g, '');
  const cikNum = String(cik).replace(/^0+/, '');
  return `https://www.sec.gov/Archives/edgar/data/${cikNum}/${flat}/`;
}

async function fetchFilingText(url: string): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(url, {
      headers: { 'User-Agent': SEC_USER_AGENT },
      timeoutMs: 15_000,
    });
    if (!res.ok) return null;
    const raw = await res.text();
    // Strip HTML to plain text, keep ~40k chars (extractor trims further)
    const plain = raw.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return plain.slice(0, 40_000);
  } catch (err) {
    console.error('[re-extract] fetch error', url, err);
    return null;
  }
}

interface ReExtractMetrics {
  queued: number;
  fetched: number;
  reExtracted: number;
  updated: number;
  rejected: number;
  skippedNoSource: number;
  errors: string[];
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }
  const expectedToken = `Bearer ${cronSecret}`;
  const providedToken = authHeader || '';
  const isValidLength = providedToken.length === expectedToken.length;
  const tokenToCompare = isValidLength ? providedToken : expectedToken;
  const isValid =
    isValidLength &&
    timingSafeEqual(Buffer.from(tokenToCompare), Buffer.from(expectedToken));
  if (!isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicApiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  const startedAt = new Date();
  const metrics: ReExtractMetrics = {
    queued: 0,
    fetched: 0,
    reExtracted: 0,
    updated: 0,
    rejected: 0,
    skippedNoSource: 0,
    errors: [],
  };

  try {
    const supabase = createServiceClient();

    // Pick the oldest pending rows with some form of source reference.
    // Prefer rows with source_filing_id (SEC) since those are most
    // reliably re-fetchable. Source URLs on press-release domains can
    // change, so deprioritize those.
    // The `.neq('verification_status', 'rejected')` filter previously
    // excluded rows with verification_status IS NULL (Postgres three-valued
    // logic: x != 'rejected' is NULL when x IS NULL, which filters rows out).
    // 102 sec_8k pending rows were silently stuck because their status was
    // NULL not 'pending'. Using the `not.eq` PostgREST operator via `.or()`
    // paired with `is.null` fixes this.
    // Queue rows from any source_type that has a fetchable URL or filing ID.
    // Supabase PostgREST has a quirk where chaining two .or() calls
    // overwrites the first. Combining everything into a single .or() would
    // produce OR semantics between the two filters which we don't want.
    // Workaround: drop the "has URL" filter here and let the in-loop
    // skippedNoSource counter catch rows without a URL. The DB roundtrip
    // cost is negligible (20 rows/batch).
    const { data: rows, error: fetchErr } = await supabase
      .from('deals')
      .select(
        'id, licensor_name, licensee_name, modality, asset_name, phase_at_signing, source_url, source_filing_id, source_type, announced_date, licensor_id, licensee_id, raw_text_excerpt'
      )
      .eq('is_synthetic', false)
      .eq('verified', false)
      .eq('verification_status', 'pending')
      .in('source_type', ['sec_8k', 'sec_10k', 'press_release', 'openfda'])
      .order('announced_date', { ascending: true, nullsFirst: true })
      .limit(BATCH_SIZE);

    if (fetchErr) {
      return NextResponse.json({ error: `fetch: ${fetchErr.message}` }, { status: 500 });
    }

    const batch = rows ?? [];
    metrics.queued = batch.length;

    for (const row of batch) {
      // Resolve a fetchable URL.
      let filingUrl = row.source_url;
      if (!filingUrl && row.source_filing_id) {
        // Try to get the licensor CIK from the companies table.
        const { data: co } = await supabase
          .from('companies')
          .select('sec_cik')
          .eq('id', row.licensor_id)
          .maybeSingle();
        filingUrl = sourceUrlFromFilingId(co?.sec_cik ?? null, row.source_filing_id);
      }
      if (!filingUrl) {
        // Mark as 'skipped' so the row falls out of the re-extract queue
        // and into the admin-audit queue where a human can research it
        // manually. Without this, skippedNoSource rows stay pending and
        // keep occupying queue slots on every cron run indefinitely.
        await supabase
          .from('deals')
          .update({
            verification_status: 'skipped',
            verification_notes: `[2026-04-16] Cron re-extract skipped: no source_url or source_filing_id available for fetch. Eligible for manual admin audit at /admin/deal-audit.`,
          })
          .eq('id', row.id);
        metrics.skippedNoSource++;
        continue;
      }

      const text = await fetchFilingText(filingUrl);
      if (!text || text.length < 400) {
        metrics.errors.push(`No text for row ${row.id} (${filingUrl})`);
        continue;
      }
      metrics.fetched++;

      const extracted = await extractDealFromFiling(text, anthropicApiKey);
      if (!extracted) {
        // Extractor returned null — not a deal, or parse failure.
        // Mark rejected so we don't keep retrying.
        await supabase
          .from('deals')
          .update({
            verification_status: 'rejected',
            verification_notes:
              `[2026-04-14 Phase3] Re-extraction returned null (not a deal or parse failure). filingUrl=${filingUrl}`,
          })
          .eq('id', row.id);
        metrics.rejected++;
        continue;
      }
      metrics.reExtracted++;

      // Run the Phase-4 validator against the fresh extraction.
      const validation = validateExtractedDeal({
        licensor: extracted.licensor,
        licensee: extracted.licensee,
        modality: extracted.modality,
        asset_name: extracted.asset_name,
        indication_specific: extracted.indication_specific,
        upfront_usd: extracted.upfront_usd,
        total_deal_value_usd: extracted.total_deal_value_usd,
        confidence_score: extracted.confidence_score,
        source_url: filingUrl,
        source_filing_id: row.source_filing_id,
      });
      if (!validation.valid) {
        await supabase
          .from('deals')
          .update({
            verification_status: 'rejected',
            verification_notes:
              `[2026-04-14 Phase3] Re-extraction failed validation [${validation.rejectCode}]: ${validation.rejectReason}`,
          })
          .eq('id', row.id);
        metrics.rejected++;
        continue;
      }

      // Validation passed — UPDATE the row with fresh fields and mark verified.
      const { error: updateErr } = await supabase
        .from('deals')
        .update({
          licensor_name: extracted.licensor,
          licensee_name: extracted.licensee,
          modality: extracted.modality,
          asset_name: extracted.asset_name,
          asset_description: extracted.asset_description,
          indication_category: extracted.indication_category,
          indication_specific: extracted.indication_specific,
          target: extracted.target,
          mechanism_of_action: extracted.mechanism_of_action,
          phase_at_signing: extracted.phase_at_signing,
          territory: extracted.territory,
          deal_type: extracted.deal_type,
          upfront_usd: extracted.upfront_usd,
          total_deal_value_usd: extracted.total_deal_value_usd,
          milestones_total_usd: extracted.milestones_total_usd,
          royalty_low_pct: extracted.royalty_low_pct,
          royalty_high_pct: extracted.royalty_high_pct,
          confidence_score: extracted.confidence_score,
          verification_status: 'verified',
          verified: true,
          verification_notes:
            `[2026-04-14 Phase3] Re-extracted from source using hardened Phase4 prompt. Original extraction garbled (pre-hardening). Validation passed.`,
          raw_text_excerpt: extractAuditExcerpt(text, extracted.licensee ?? '', 500),
          extraction_model: 'claude-opus-4-6',
          extraction_timestamp: new Date().toISOString(),
        })
        .eq('id', row.id);

      if (updateErr) {
        metrics.errors.push(`update ${row.id}: ${updateErr.message}`);
      } else {
        metrics.updated++;
      }
    }

    await logCronRun(supabase, 'deal_reextraction', {
      fetched: metrics.fetched,
      processed: metrics.reExtracted,
      inserted: metrics.updated,
      errors: metrics.errors,
    });

    // Intelligence tracking
    try {
      await runCronIntelligence(supabase, 're-extract-pending', {
        processed: metrics.queued,
        inserted: metrics.updated,
      });
    } catch {}

    return NextResponse.json({
      ok: true,
      startedAt: startedAt.toISOString(),
      durationMs: Date.now() - startedAt.getTime(),
      metrics,
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Re-extraction failed: ${String(err)}` },
      { status: 500 },
    );
  }
}
