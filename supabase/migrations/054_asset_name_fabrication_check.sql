-- Migration 054 — database-level fabrication gate (R69)
--
-- Defense in depth: even though lib/ingestion/deal-extraction-validator.ts
-- now runs on SEC-EDGAR, press-releases, Perplexity, FTC, and completeness-
-- audit flows (R69), a future ingestion path could forget to call it. This
-- migration adds a DEFERRABLE CHECK constraint at the database level that
-- rejects any INSERT or UPDATE writing an asset_name matching one of the
-- three fabrication regexes, UNLESS the row is explicitly marked
-- is_synthetic=true (synthetic / test data) or verified=true (human-vetted).
--
-- Patterns (from R49 audit, migration 051):
--   TARGET-NNN       e.g. PI3K-101, GD2-201, HER3-501   (549 flagged)
--   TARGET-mab       e.g. CSF1R-mab, B7-H3-mab, KIT-mab  (140 flagged)
--   Anti-TARGET      e.g. Anti-MDM2, Anti-CSF1R           (77 flagged)
--
-- Legitimate exceptions preserved:
--   - is_synthetic=true rows (intentional synthetics)
--   - verified=true rows (manual audit override — Tubulis TUB-040,
--     Kymera KT-253 style real dev codes)
--   - asset_name NULL (no pattern to match)
--
-- If a future ingestion tries to write `asset_name='PI3K-101'` without
-- setting verified=true, Postgres rejects with a CHECK constraint error
-- and the ingestion code must surface the rejection reason to its log.

BEGIN;

ALTER TABLE deals
  ADD CONSTRAINT deals_asset_name_not_fabrication CHECK (
    -- Pass if asset_name is NULL or explicit synthetic/verified
    asset_name IS NULL
    OR COALESCE(is_synthetic, false) = true
    OR COALESCE(verified, false) = true
    -- Otherwise reject the three fabrication patterns
    OR (
      asset_name !~ '^[A-Za-z0-9/]+-[0-9]{3}$'
      AND NOT (asset_name ~ '^[A-Za-z0-9/-]+-mab$' AND asset_name NOT ILIKE 'anti-%')
      AND asset_name !~ '^Anti-[A-Za-z0-9]+(-mab)?$'
    )
  );

COMMENT ON CONSTRAINT deals_asset_name_not_fabrication ON deals IS
  'R69 (2026-04-15): database-level gate against the three LLM-fabrication '
  'asset-name patterns identified in migration 051. Allows pattern-matching '
  'names through only when verified=true (human audit) or is_synthetic=true '
  '(explicit test data). Prevents future ingestion regressions.';

COMMIT;
