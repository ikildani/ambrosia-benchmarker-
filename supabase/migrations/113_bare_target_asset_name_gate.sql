-- Migration 113 — extend the fabrication gate to bare-target and -tinib names
--
-- Follow-on to migration 054 (R69). The 2026-09-14 audit found the surviving
-- fabricated batch (loaded 2026-02-02, 175 rows, quarantined the same day)
-- used two asset-name shapes the R69 constraint never matched:
--
--   Pattern           Example                              what it is
--   asset = target    asset_name 'GD2', target 'GD2'       target pasted as the asset
--   TARGET-tinib      'FLT3-tinib', 'CD38-tinib'           invented kinase-inhibitor names
--
-- Real rows: 5 TARGET-NNN names remain and all are verified development codes;
-- 0 unverified rows match the two new shapes after the quarantine.
--
-- Same exceptions as 054: is_synthetic=true and verified=true pass, NULL
-- asset_name passes. A future extraction that writes asset_name = target
-- without human verification is rejected at the database.
--
-- Reversal:
--   ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_asset_name_not_bare_target;
--
-- Apply only after confirming the count below is 0:
--   SELECT count(*) FROM deals
--   WHERE NOT COALESCE(verified,false) AND NOT COALESCE(is_synthetic,false)
--     AND asset_name IS NOT NULL
--     AND ( (target IS NOT NULL AND lower(trim(asset_name)) = lower(trim(target)))
--        OR asset_name ~ '^[A-Za-z0-9/ -]+-(tinib|nib)$' );

BEGIN;

ALTER TABLE deals
  ADD CONSTRAINT deals_asset_name_not_bare_target CHECK (
    asset_name IS NULL
    OR COALESCE(is_synthetic, false) = true
    OR COALESCE(verified, false) = true
    OR (
      NOT (target IS NOT NULL AND lower(trim(asset_name)) = lower(trim(target)))
      AND asset_name !~ '^[A-Za-z0-9/ -]+-(tinib|nib)$'
    )
  );

COMMENT ON CONSTRAINT deals_asset_name_not_bare_target ON deals IS
  'Audit 2026-09-14: rejects an unverified asset_name that merely repeats the '
  'target (GD2 / GD2) or invents a -tinib/-nib kinase-inhibitor name. Same '
  'exceptions as deals_asset_name_not_fabrication (verified=true, is_synthetic=true).';

COMMIT;
