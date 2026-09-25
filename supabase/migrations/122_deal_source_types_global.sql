-- Migration 122 — source_type values for the global exchange / issuer-release adapters
--   cninfo  Shanghai + Shenzhen disclosure portal (mainland China, incl. STAR board)
--   mfn     MFN / Cision regulatory-news distribution (Nordics + EQS-relayed DACH/FR issuers)
--   bse, tase reserved (India BSE and Israel TASE sit behind bot protection; not wired)
-- Reversal: re-create the constraint without these values.
BEGIN;
ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_source_type_check;
ALTER TABLE deals ADD CONSTRAINT deals_source_type_check CHECK (
  source_type IN (
    'sec_8k', 'sec_10k', 'sec_10q', 'sec_6k',
    'press_release', 'clinicaltrials', 'manual', 'openfda',
    'hkex', 'edinet', 'tdnet', 'dart', 'sedar', 'asx', 'cninfo', 'mfn', 'bse', 'tase',
    'perplexity_discovery',
    'other'
  )
);
COMMIT;
