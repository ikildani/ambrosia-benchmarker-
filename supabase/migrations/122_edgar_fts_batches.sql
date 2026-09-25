-- Migration 122 — Message Batches submitted by the EDGAR full-text backfill.
--
-- Why: the backfill extracted 2,700 filings a day synchronously on Opus at
-- standard price. Batch requests cost 50% and finish within the hour, which
-- is fine for a historical walk. A run submits one batch and records it here;
-- the next run drains any batch that has ended and persists the deals.
--
-- Reversal: DROP TABLE IF EXISTS edgar_fts_batches;

BEGIN;

CREATE TABLE IF NOT EXISTS edgar_fts_batches (
  batch_id      text PRIMARY KEY,               -- Anthropic message batch id (msgbatch_...)
  status        text NOT NULL DEFAULT 'submitted', -- submitted | drained | failed
  submitted_at  timestamptz NOT NULL DEFAULT now(),
  drained_at    timestamptz,
  request_count int NOT NULL,
  docs          jsonb NOT NULL,                 -- [{accession, doc, quarter, queryKey, sourceType}]
  counts        jsonb                           -- drain outcome counts
);

CREATE INDEX IF NOT EXISTS idx_edgar_fts_batches_status ON edgar_fts_batches (status, submitted_at);

ALTER TABLE edgar_fts_batches ENABLE ROW LEVEL SECURITY;
-- Service role only (cron routes use the service client, which bypasses RLS). No policies on purpose.

COMMENT ON TABLE edgar_fts_batches IS 'Sep 2026: Anthropic Message Batches in flight for the EDGAR FTS backfill; drained by the next backfill run.';

COMMIT;
