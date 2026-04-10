-- 036: Add model_version to shared_calculations
--
-- After the 2026-04-10 engine inflation audit, every existing share link is frozen
-- at engine output produced by an inflated model (baselines 1.5-4x empirical, upfront
-- ratios calibrated to p75-p90, no correlation suppression on stacked premium modifiers).
--
-- Marking those rows v1 lets us render a disclaimer on the share page so prospects
-- viewing legacy links see "calculated with prior model version" instead of stale
-- numbers presented as authoritative. New shares get v2 by default.
--
-- v1 = pre-2026-04-10 inflated engine
-- v2 = post-2026-04-10 audited engine (recalibrated baselines, fixed upfront ratios,
--      correlation suppression on definitionally-severe indications + firstInClass×strongPhase2,
--      regulatory bonus cap lowered 0.20 → 0.15, per-TA output guardrails)

ALTER TABLE shared_calculations
  ADD COLUMN IF NOT EXISTS model_version TEXT NOT NULL DEFAULT 'v2';

COMMENT ON COLUMN shared_calculations.model_version IS
  'Engine version that produced this snapshot. v1=pre-2026-04-10 (inflated baselines/upfront ratios). v2=post-2026-04-10 inflation audit.';

-- Backfill: every row created before the audit cutover is v1.
-- Vishaal's regenerated IPF link (a3zAaxwk4L_o) was already updated against the
-- v2 engine in the same session, so it stays v2.
UPDATE shared_calculations
SET model_version = 'v1'
WHERE created_at < '2026-04-10 15:00:00+00'
  AND share_token != 'a3zAaxwk4L_o';
