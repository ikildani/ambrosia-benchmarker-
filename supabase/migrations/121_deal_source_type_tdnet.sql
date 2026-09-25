-- Migration 121 — allow source_type 'tdnet' (Tokyo Stock Exchange timely disclosure).
-- TDnet is the primary channel for Japanese listed companies' deal announcements
-- (ライセンス契約締結のお知らせ etc.). Distinct from 'edinet' (FSA securities reports).
-- Reversal: re-create the constraint without 'tdnet'.
BEGIN;
ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_source_type_check;
ALTER TABLE deals ADD CONSTRAINT deals_source_type_check CHECK (
  source_type IN (
    'sec_8k', 'sec_10k', 'sec_10q', 'sec_6k',
    'press_release', 'clinicaltrials', 'manual', 'openfda',
    'hkex', 'edinet', 'tdnet', 'dart', 'sedar', 'asx',
    'perplexity_discovery',
    'other'
  )
);
COMMIT;
