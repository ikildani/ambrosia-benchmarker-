/**
 * Ingestion funnel counters.
 *
 * Every deal pipeline moves items through the same stages: fetched from the
 * source, filtered by keyword, deduplicated against the table, content
 * loaded, extracted by the model, gated on confidence, validated, inserted.
 * Until Sep 2026 each pipeline counted only "fetched / processed / inserted"
 * and printed the reasons for every drop to the console, so a source that
 * fetched thousands of items and inserted one looked healthy in the log.
 *
 * A FunnelCounter records every drop with its stage and reason and serialises
 * into data_ingestion_log.parameters.funnel so the loss is visible per run.
 */

export type FunnelStage =
  | 'fetched'
  | 'keyword_filtered'
  | 'already_in_table'
  | 'content_unavailable'
  | 'content_too_short'
  | 'extraction_error'
  | 'not_a_deal'
  | 'confidence_gate'
  | 'missing_parties'
  | 'validator_rejected'
  | 'duplicate_same_day'
  | 'insert_error'
  | 'insert_duplicate'
  | 'inserted'
  | 'dry_run_would_insert'
  | 'time_budget';

export interface FunnelSnapshot {
  /** Index signature so a snapshot fits any Record<string, unknown> parameter bag. */
  [key: string]: unknown;
  /** Count per stage. */
  stages: Partial<Record<FunnelStage, number>>;
  /** Count per stage:reason for stages that carry a reason (validator codes, HTTP status, etc). */
  reasons: Record<string, number>;
  /** A few concrete examples per stage for the log, never more than `maxExamples`. */
  examples: Partial<Record<FunnelStage, string[]>>;
}

export class FunnelCounter {
  private stages: Partial<Record<FunnelStage, number>> = {};
  private reasons: Record<string, number> = {};
  private examples: Partial<Record<FunnelStage, string[]>> = {};

  constructor(private readonly maxExamples = 3) {}

  /** Record one item reaching (or dying at) a stage. */
  count(stage: FunnelStage, reason?: string, example?: string): void {
    this.stages[stage] = (this.stages[stage] ?? 0) + 1;
    if (reason) {
      const key = `${stage}:${reason}`;
      this.reasons[key] = (this.reasons[key] ?? 0) + 1;
    }
    if (example) {
      const list = (this.examples[stage] ??= []);
      if (list.length < this.maxExamples) list.push(example.slice(0, 160));
    }
  }

  get(stage: FunnelStage): number {
    return this.stages[stage] ?? 0;
  }

  toJSON(): FunnelSnapshot {
    return { stages: { ...this.stages }, reasons: { ...this.reasons }, examples: { ...this.examples } };
  }

  /** One-line summary for console and Slack. */
  summary(): string {
    const order: FunnelStage[] = [
      'fetched', 'keyword_filtered', 'already_in_table', 'content_unavailable', 'content_too_short',
      'extraction_error', 'not_a_deal', 'confidence_gate', 'missing_parties', 'validator_rejected',
      'duplicate_same_day', 'insert_duplicate', 'insert_error', 'inserted', 'dry_run_would_insert', 'time_budget',
    ];
    return order
      .filter(s => (this.stages[s] ?? 0) > 0)
      .map(s => `${s}=${this.stages[s]}`)
      .join(' ');
  }
}
