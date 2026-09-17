-- Backtest results history.
--
-- The engine-backtest cron (07:00 UTC) scores the engine against the
-- verified-and-cited cohort (lib/financial/backtest/verified-cohort.ts) and
-- stores one row per run here, so /methodology can show a trend and an
-- operator can see when accuracy moved. The page itself computes live and
-- does not depend on this table; the cron tolerates its absence.

CREATE TABLE IF NOT EXISTS backtest_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cohort TEXT NOT NULL,                 -- 'verified_cited'
  engine_version TEXT NOT NULL,
  eligible INTEGER NOT NULL,            -- rows meeting the cohort definition
  scored INTEGER NOT NULL,              -- rows the engine could model
  upfront_median_abs_error_pct NUMERIC, -- 0.42 = 42%
  upfront_within_35 NUMERIC,
  upfront_within_50 NUMERIC,
  total_median_abs_error_pct NUMERIC,
  total_within_35 NUMERIC,
  total_within_50 NUMERIC,
  report JSONB NOT NULL,                -- full VerifiedCohortReport
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backtest_results_cohort_run ON backtest_results (cohort, run_at DESC);

ALTER TABLE backtest_results ENABLE ROW LEVEL SECURITY;
-- Service role only; nothing reads this table from the client.

COMMENT ON TABLE backtest_results IS
  'One row per engine backtest run per cohort. Written by /api/cron/engine-backtest; read by operators. /methodology computes live.';
