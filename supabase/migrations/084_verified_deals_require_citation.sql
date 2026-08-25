-- Migration 084 — a verified deal must carry a citation (R79f)
--
-- The corpus holds 520 rows marked verification_status='verified' of which only
-- 48 carry a source_url or press_release_url. A verified flag with no citation
-- is unfalsifiable: nobody downstream can check it, and it cannot be defended
-- when a counterparty asks where a number came from.
--
-- NOTE: this migration is superseded by 084b. The NOT VALID CHECK below was the
-- wrong mechanism — see 084b for why — and is dropped there. Retained for the
-- migration record.

ALTER TABLE deals
  ADD CONSTRAINT deals_verified_requires_citation CHECK (
    verification_status IS DISTINCT FROM 'verified'
    OR source_url IS NOT NULL
    OR press_release_url IS NOT NULL
    OR source_filing_id IS NOT NULL
  ) NOT VALID;
