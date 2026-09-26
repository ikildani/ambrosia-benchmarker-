-- Migration 136 — outcome-informed priors (Alaric outcomes program, test 6:
-- "compounds across participants").
--
-- A client's reported signed terms (outcomes.matched_by = 'client' with no
-- deal row) and a brief prediction resolved against a published deal now feed
-- back into the priors the next brief uses:
--   * buyer premiums  — lib/outcomes/priors.ts blends client outcomes into
--                       counterparty_premiums nightly (new row per as_of_date);
--   * area/phase baselines — the weekly benchmark-calibration cron appends the
--                       same observations before grouping (k-anonymity guarded:
--                       a cell needs ≥ 5 public deals first, client rows ≤ 50%).
--
-- Reversal:
--   ALTER TABLE predictions DROP COLUMN IF EXISTS priors_as_of;
--   ALTER TABLE benchmark_calibrations DROP CONSTRAINT IF EXISTS benchmark_calibrations_calibration_type_check;
--   ALTER TABLE benchmark_calibrations ADD CONSTRAINT benchmark_calibrations_calibration_type_check
--     CHECK (calibration_type IN ('phase_baseline', 'modality_multiplier'));
--   DROP TABLE IF EXISTS outcome_prior_runs;

BEGIN;

-- 1. Which calibration + premium snapshot a prediction was priced on.
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS priors_as_of text;
COMMENT ON COLUMN predictions.priors_as_of IS
  'Short identifier of the priors used: "<latest benchmark_calibrations.calibrated_at date>|<latest counterparty_premiums.as_of_date>" (lib/outcomes/priors-snapshot.ts). Never part of model_version.';

-- 2. Allow an outcome_residual calibration type alongside the existing two.
ALTER TABLE benchmark_calibrations DROP CONSTRAINT IF EXISTS benchmark_calibrations_calibration_type_check;
ALTER TABLE benchmark_calibrations ADD CONSTRAINT benchmark_calibrations_calibration_type_check
  CHECK (calibration_type IN ('phase_baseline', 'modality_multiplier', 'outcome_residual'));

-- 3. Audit trail for every priors run (nightly buyer blend, weekly baselines).
CREATE TABLE IF NOT EXISTS outcome_prior_runs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at            timestamptz NOT NULL DEFAULT now(),
  observations_used integer NOT NULL DEFAULT 0 CHECK (observations_used >= 0),
  cells_touched     integer NOT NULL DEFAULT 0 CHECK (cells_touched >= 0),
  buyers_touched    integer NOT NULL DEFAULT 0 CHECK (buyers_touched >= 0),
  notes             text
);

CREATE INDEX IF NOT EXISTS idx_outcome_prior_runs_ran_at ON outcome_prior_runs (ran_at DESC);

COMMENT ON TABLE outcome_prior_runs IS
  'Sep 2026: one row per outcome-priors run — how many client observations were read, how many benchmark cells and buyer premiums they touched, and the calculation notes (benchmark_calibrations has no notes column).';

ALTER TABLE outcome_prior_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access outcome_prior_runs" ON outcome_prior_runs;
CREATE POLICY "Service role full access outcome_prior_runs"
  ON outcome_prior_runs FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMIT;
