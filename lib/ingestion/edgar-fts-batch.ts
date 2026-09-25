/**
 * Message Batches for the EDGAR full-text backfill.
 *
 * A backfill run gathers the filings that passed the gate, submits them as one
 * Anthropic Message Batch (50% of standard price, results usually within the
 * hour) and records the batch in `edgar_fts_batches` (migration 122). The next
 * run drains every batch that has ended: each succeeded result is parsed with
 * the same parser as the synchronous path and persisted through
 * `persistExtractedDeal`, so a deal found by batch is indistinguishable from
 * one found live.
 *
 * Ledger discipline: an accession is written to `edgar_fts_processed` as
 * 'batch_submitted' when the batch goes out, so the walk never re-fetches it,
 * and rewritten with the final outcome when the batch is drained.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildDealExtractionRequest, parseDealExtraction } from './sec-edgar';
import { persistExtractedDeal, type EftsProcessOptions } from './edgar-realtime';
import type { EftsDocument } from './edgar-fts';
import type { FunnelCounter } from './funnel';

export const BATCHES_TABLE = 'edgar_fts_batches';
export const PROCESSED_TABLE = 'edgar_fts_processed';

export interface BatchItem {
  doc: EftsDocument;
  text: string;
  quarter: string;
  queryKey: string;
  sourceType: 'sec_8k' | 'sec_6k';
}

interface StoredBatchDoc {
  accession: string;
  doc: EftsDocument;
  quarter: string;
  queryKey: string;
  sourceType: 'sec_8k' | 'sec_6k';
}

export type BackfillExtractionMode = 'batch' | 'sync';

export function backfillExtractionMode(): BackfillExtractionMode {
  return (process.env.BACKFILL_EXTRACTION_MODE || 'batch').toLowerCase() === 'sync' ? 'sync' : 'batch';
}

/** Submit one batch. Returns the batch id, or null (with the error) if the batch could not be created or recorded. */
export async function submitExtractionBatch(
  supabase: SupabaseClient,
  anthropic: Anthropic,
  items: BatchItem[],
  opts: { dryRun: boolean; funnel: FunnelCounter },
): Promise<{ batchId: string | null; error?: string }> {
  if (items.length === 0) return { batchId: null };
  if (opts.dryRun) {
    for (const it of items) opts.funnel.count('batch_submitted', 'dry_run', it.doc.accession);
    return { batchId: null };
  }

  let batchId: string;
  try {
    const batch = await anthropic.messages.batches.create({
      requests: items.map((it) => ({ custom_id: it.doc.accession, params: buildDealExtractionRequest(it.text) })),
    });
    batchId = batch.id;
  } catch (e) {
    return { batchId: null, error: `batch create failed: ${e instanceof Error ? e.message : String(e)}` };
  }

  const docs: StoredBatchDoc[] = items.map((it) => ({ accession: it.doc.accession, doc: it.doc, quarter: it.quarter, queryKey: it.queryKey, sourceType: it.sourceType }));
  const { error } = await supabase.from(BATCHES_TABLE).insert({ batch_id: batchId, status: 'submitted', request_count: items.length, docs });
  if (error) {
    // The batch is running at Anthropic but we cannot track it: cancel so it is not paid for twice.
    try { await anthropic.messages.batches.cancel(batchId); } catch { /* best effort */ }
    return { batchId: null, error: `batch record failed (${error.message}); batch ${batchId} cancelled` };
  }

  for (const it of items) {
    opts.funnel.count('batch_submitted', undefined, it.doc.accession);
    await supabase.from(PROCESSED_TABLE).upsert({
      accession: it.doc.accession, outcome: 'batch_submitted', quarter: it.quarter, query_key: it.queryKey,
      form: it.doc.form || null, filing_date: it.doc.filingDate || null, company: it.doc.companyName || null,
    }, { onConflict: 'accession' });
  }
  return { batchId };
}

export interface DrainResult {
  batchesChecked: number;
  batchesDrained: number;
  results: number;
  inserted: number;
  errors: string[];
}

/**
 * Drain every batch that has ended. Bounded by `deadline` (epoch ms) so a run
 * always leaves time to submit new work.
 */
export async function drainExtractionBatches(
  supabase: SupabaseClient,
  anthropic: Anthropic,
  opts: Omit<EftsProcessOptions, 'sourceType'> & { deadline: number },
): Promise<DrainResult> {
  const out: DrainResult = { batchesChecked: 0, batchesDrained: 0, results: 0, inserted: 0, errors: [] };
  const { data: rows, error } = await supabase.from(BATCHES_TABLE).select('batch_id, docs, request_count').eq('status', 'submitted').order('submitted_at', { ascending: true }).limit(20);
  if (error) { out.errors.push(`batch table read failed: ${error.message}`); return out; }

  for (const row of rows ?? []) {
    if (Date.now() > opts.deadline) break;
    out.batchesChecked++;
    let status: string;
    try {
      status = (await anthropic.messages.batches.retrieve(row.batch_id)).processing_status;
    } catch (e) {
      out.errors.push(`batch ${row.batch_id} retrieve failed: ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }
    if (status !== 'ended') continue;

    const byAccession = new Map<string, StoredBatchDoc>();
    for (const d of (row.docs as StoredBatchDoc[]) ?? []) byAccession.set(d.accession, d);
    const counts: Record<string, number> = {};
    const bump = (k: string) => { counts[k] = (counts[k] ?? 0) + 1; };

    try {
      for await (const result of await anthropic.messages.batches.results(row.batch_id)) {
        if (Date.now() > opts.deadline) { out.errors.push(`batch ${row.batch_id}: deadline hit mid-drain, remainder next run`); break; }
        out.results++;
        const stored = byAccession.get(result.custom_id);
        if (!stored) { bump('unknown_custom_id'); continue; }
        let outcome = 'skipped';
        if (result.result.type === 'succeeded') {
          const first = result.result.message.content[0];
          const text = first && first.type === 'text' ? first.text : '';
          const deal = parseDealExtraction(text);
          if (!deal) {
            opts.funnel.count('not_a_deal', stored.doc.fileType || 'unknown', `${stored.doc.companyName} ${stored.accession}`);
            outcome = 'not_a_deal';
          } else {
            const r = await persistExtractedDeal(supabase, stored.doc, deal, { ...opts, sourceType: stored.sourceType });
            outcome = r === 'error' ? 'insert_error' : r;
            if (r === 'inserted') out.inserted++;
          }
        } else if (result.result.type === 'errored') {
          opts.funnel.count('extraction_error', result.result.error.type, stored.accession);
          outcome = 'extraction_error';
        } else {
          // expired or canceled: forget it in the ledger so a later walk can resubmit it.
          await supabase.from(PROCESSED_TABLE).delete().eq('accession', stored.accession);
          bump(result.result.type);
          byAccession.delete(result.custom_id);
          continue;
        }
        bump(outcome);
        byAccession.delete(result.custom_id);
        if (!opts.dryRun) {
          await supabase.from(PROCESSED_TABLE).upsert({
            accession: stored.accession, outcome, quarter: stored.quarter, query_key: stored.queryKey,
            form: stored.doc.form || null, filing_date: stored.doc.filingDate || null, company: stored.doc.companyName || null,
          }, { onConflict: 'accession' });
        }
      }
    } catch (e) {
      out.errors.push(`batch ${row.batch_id} results failed: ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }

    if (byAccession.size === 0) {
      await supabase.from(BATCHES_TABLE).update({ status: 'drained', drained_at: new Date().toISOString(), counts }).eq('batch_id', row.batch_id);
      out.batchesDrained++;
    } else {
      // Partial drain (deadline): keep the row so the next run finishes it; already-persisted accessions are in the ledger.
      await supabase.from(BATCHES_TABLE).update({ counts }).eq('batch_id', row.batch_id);
    }
  }
  return out;
}
