-- Migration 053 — flag secondary fabrication patterns in deals table
--
-- Follow-on to migration 051 (R49). After flagging 766 TARGET-NNN /
-- TARGET-mab / Anti-TARGET rows as is_synthetic=true, a secondary audit
-- surfaced soft-fabrication patterns in the remaining 1,772 "real" rows:
--
--   Pattern                          n     verified   likely action
--   asset_name IS NULL or tiny       65    25 kept    flag 40 unverified
--   "...pipeline" / "...program"     24    7 kept     flag 17 unverified
--   "...platform" as asset           27    6 kept     flag 21 unverified
--   "undisclosed"                    1     0          flag 1
--
-- NOT flagged:
--   indication_as_asset (58 rows, 100% verified — these are
--   hand-confirmed deals where no asset name was disclosed in the
--   source; the indication serves as the only identifier)
--
-- Reversibility: same is_synthetic flip, same WHERE clauses can reverse.
-- Expected UPDATE count: ~79 rows total.

BEGIN;

-- Pattern 1: asset_name NULL or tiny placeholder (< 3 chars)
UPDATE deals
SET is_synthetic = true
WHERE COALESCE(is_synthetic, false) = false
  AND COALESCE(verified, false) = false
  AND (asset_name IS NULL OR LENGTH(TRIM(asset_name)) < 3);

-- Pattern 2: generic "...program" / "...platform" / "...pipeline" names
UPDATE deals
SET is_synthetic = true
WHERE COALESCE(is_synthetic, false) = false
  AND COALESCE(verified, false) = false
  AND (
    (asset_name ILIKE '%program' AND LENGTH(asset_name) < 40)
    OR (asset_name ILIKE '%platform%' AND LENGTH(asset_name) < 40)
    OR (asset_name ILIKE '%pipeline' AND LENGTH(asset_name) < 40)
  );

-- Pattern 3: literal "undisclosed" in asset_name
UPDATE deals
SET is_synthetic = true
WHERE COALESCE(is_synthetic, false) = false
  AND COALESCE(verified, false) = false
  AND asset_name ILIKE '%undisclosed%';

COMMIT;
