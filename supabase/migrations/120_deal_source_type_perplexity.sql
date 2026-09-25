-- Migration 120 — allow source_type 'perplexity_discovery'
--
-- lib/ingestion/perplexity-deals.ts attributes its rows as 'perplexity_discovery'
-- (earlier builds wrote 'manual'). The check constraint did not include it, so
-- every discovery insert failed with 23514 and the run logged them as
-- insert_error with no message: 6 runs/day, 0 rows, since the attribution
-- change shipped. Honest attribution is the right fix, not writing 'manual'.
--
-- Reversal: re-create the constraint without 'perplexity_discovery'.

BEGIN;

ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_source_type_check;

ALTER TABLE deals ADD CONSTRAINT deals_source_type_check CHECK (
  source_type IN (
    'sec_8k', 'sec_10k', 'sec_10q', 'sec_6k',
    'press_release', 'clinicaltrials', 'manual', 'openfda',
    'hkex', 'edinet', 'dart', 'sedar', 'asx',
    'perplexity_discovery',
    'other'
  )
);

COMMIT;
