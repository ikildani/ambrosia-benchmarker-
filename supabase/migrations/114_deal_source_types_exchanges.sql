-- Migration 114 — widen deals.source_type for exchange disclosures
--
-- The check constraint on deals.source_type allows only
--   sec_8k, sec_10k, sec_10q, press_release, clinicaltrials, manual, openfda, other
-- Two new primary sources need their own value so the methodology page and
-- the coverage report can attribute rows honestly:
--   sec_6k   foreign private issuers filing with the SEC (Form 6-K)
--   hkex     Hong Kong Exchange announcements (China biotech licensing)
-- Reserved for the adapters that are stubbed today: edinet, dart, sedar, asx.
--
-- Until this is applied, lib/ingestion/insert-deal.ts stores those rows as
-- 'other' with `origin=<source>` in extraction_notes and retries automatically.
--
-- Reversal:
--   ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_source_type_check;
--   ALTER TABLE deals ADD CONSTRAINT deals_source_type_check CHECK (source_type IN
--     ('sec_8k','sec_10k','sec_10q','press_release','clinicaltrials','manual','openfda','other'));

BEGIN;

ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_source_type_check;

ALTER TABLE deals ADD CONSTRAINT deals_source_type_check CHECK (
  source_type IN (
    'sec_8k', 'sec_10k', 'sec_10q', 'sec_6k',
    'press_release', 'clinicaltrials', 'manual', 'openfda',
    'hkex', 'edinet', 'dart', 'sedar', 'asx',
    'other'
  )
);

COMMENT ON CONSTRAINT deals_source_type_check ON deals IS
  'Sep 2026: adds sec_6k and exchange disclosure sources (hkex live; edinet/dart/sedar/asx reserved for stubbed adapters).';

COMMIT;
