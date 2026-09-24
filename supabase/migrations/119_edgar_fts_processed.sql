-- Migration 119 — ledger of SEC filings the EDGAR full-text backfill has already extracted.
--
-- Why: the backfill cursor only advances when a whole EFTS page is processed.
-- Filings that were extracted and rejected (not a deal, low confidence,
-- validator) are not in `deals`, so the next run re-fetched and re-extracted
-- them. On a page with more rejections than the per-run cap the cursor never
-- moved and Anthropic credit was spent on the same filings every run.
-- Every extraction now records its accession here first; the run skips
-- accessions it has seen, so pages drain and the cursor advances.
--
-- Reversal: DROP TABLE IF EXISTS edgar_fts_processed;

BEGIN;

CREATE TABLE IF NOT EXISTS edgar_fts_processed (
  accession    text PRIMARY KEY,
  outcome      text NOT NULL,            -- inserted | skipped
  quarter      text,                     -- e.g. 2019Q3
  query_key    text,                     -- PHARMA_DEAL_QUERIES key that surfaced it
  form         text,
  filing_date  date,
  company      text,
  processed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_edgar_fts_processed_quarter ON edgar_fts_processed (quarter, outcome);

ALTER TABLE edgar_fts_processed ENABLE ROW LEVEL SECURITY;
-- Service role only (cron routes use the service client, which bypasses RLS). No policies on purpose.

COMMENT ON TABLE edgar_fts_processed IS 'Sep 2026: accessions the EDGAR FTS backfill has extracted, so rejected filings are never re-extracted and the cursor always advances.';

COMMIT;
