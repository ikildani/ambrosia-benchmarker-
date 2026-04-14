-- Migration 051 — flag LLM-fabricated deal rows as synthetic
--
-- DO NOT APPLY WITHOUT USER AUTHORIZATION. This is a production DML change
-- touching ~766 rows. Review before running.
--
-- Root cause: a prior bulk LLM enrichment pass generated ~766 synthetic
-- deal rows in the `deals` table but did not flag them `is_synthetic=true`.
-- The rows fall into three asset-name pseudo-code patterns:
--
--   Pattern            Example                           n     verified %
--   TARGET-NNN         PI3K-101, GD2-201, HER3-501       549   2.9%
--   TARGET-mab         CSF1R-mab, B7-H3-mab, KIT-mab     140   0%
--   Anti-TARGET        Anti-MDM2, Anti-CSF1R              77   0%
--
-- Comparison: real non-pattern rows are 1,931 with 23% verified. The
-- pattern rows' verified rate is an order of magnitude lower, and spot
-- checks (Y-mAbs Therapeutics has 18 rows spanning every oncology target
-- class against a 2-asset real pipeline) show complete fabrication.
--
-- Action: UPDATE is_synthetic=true on pattern-matching rows UNLESS they're
-- manually verified (verified=true). Verified rows stay intact — they may
-- be legitimate development codes like Tubulis TUB-040 or Kymera KT-253.
--
-- Reversibility: the pattern is deterministic. To reverse, flip back:
--
--   UPDATE deals SET is_synthetic = false
--   WHERE COALESCE(verified, false) = false
--     AND (
--       asset_name ~ '^[A-Za-z0-9/]+-[0-9]{3}$'
--       OR (asset_name ~ '^[A-Za-z0-9/-]+-mab$' AND asset_name NOT ILIKE 'anti-%')
--       OR asset_name ~ '^Anti-[A-Za-z0-9]+(-mab)?$'
--     );
--
-- Blast radius: flagging as synthetic hides rows from the backtest corpus,
-- /therapeutic-areas pages, /companies pages, and live deal counters. It
-- does NOT delete data. A follow-up audit can re-verify the manually-real
-- rows and promote them back (verified=true would then protect them).
--
-- Linked: docs/calibration-iteration-log.md R49/R49b, commit 1f2b6e1.

BEGIN;

-- Preview counts before the UPDATE so an operator running interactively
-- can sanity-check before committing.
DO $$
DECLARE
  r_target_nnn INT;
  r_target_mab INT;
  r_anti_target INT;
  r_verified_skipped INT;
BEGIN
  SELECT COUNT(*) INTO r_target_nnn
  FROM deals
  WHERE asset_name ~ '^[A-Za-z0-9/]+-[0-9]{3}$'
    AND COALESCE(verified, false) = false
    AND COALESCE(is_synthetic, false) = false;

  SELECT COUNT(*) INTO r_target_mab
  FROM deals
  WHERE asset_name ~ '^[A-Za-z0-9/-]+-mab$'
    AND asset_name NOT ILIKE 'anti-%'
    AND COALESCE(verified, false) = false
    AND COALESCE(is_synthetic, false) = false;

  SELECT COUNT(*) INTO r_anti_target
  FROM deals
  WHERE asset_name ~ '^Anti-[A-Za-z0-9]+(-mab)?$'
    AND COALESCE(verified, false) = false
    AND COALESCE(is_synthetic, false) = false;

  SELECT COUNT(*) INTO r_verified_skipped
  FROM deals
  WHERE (asset_name ~ '^[A-Za-z0-9/]+-[0-9]{3}$'
         OR (asset_name ~ '^[A-Za-z0-9/-]+-mab$' AND asset_name NOT ILIKE 'anti-%')
         OR asset_name ~ '^Anti-[A-Za-z0-9]+(-mab)?$')
    AND verified = true;

  RAISE NOTICE 'Migration 051 preview:';
  RAISE NOTICE '  TARGET-NNN rows to flag:      %', r_target_nnn;
  RAISE NOTICE '  TARGET-mab rows to flag:      %', r_target_mab;
  RAISE NOTICE '  Anti-TARGET rows to flag:     %', r_anti_target;
  RAISE NOTICE '  Verified rows preserved:      %', r_verified_skipped;
  RAISE NOTICE '  Total flag UPDATE rows:       %', r_target_nnn + r_target_mab + r_anti_target;
END $$;

-- Flag the three fabrication-pattern cohorts. Skip any row where
-- verified=true (manual verification overrides the pattern heuristic).
UPDATE deals
SET is_synthetic = true
WHERE asset_name ~ '^[A-Za-z0-9/]+-[0-9]{3}$'
  AND COALESCE(verified, false) = false
  AND COALESCE(is_synthetic, false) = false;

UPDATE deals
SET is_synthetic = true
WHERE asset_name ~ '^[A-Za-z0-9/-]+-mab$'
  AND asset_name NOT ILIKE 'anti-%'
  AND COALESCE(verified, false) = false
  AND COALESCE(is_synthetic, false) = false;

UPDATE deals
SET is_synthetic = true
WHERE asset_name ~ '^Anti-[A-Za-z0-9]+(-mab)?$'
  AND COALESCE(verified, false) = false
  AND COALESCE(is_synthetic, false) = false;

COMMIT;
