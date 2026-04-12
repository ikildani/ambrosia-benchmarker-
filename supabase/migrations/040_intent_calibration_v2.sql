-- Pharma Intent Calibration V2 results table
-- Stores output of the upgraded backtest (temporal holdout, LR, 10 factors,
-- time-decay, interactions, ROC-AUC, precision@K metrics).
--
-- Separate from intent_calibration_results (v1) so we can compare v1 and v2
-- side-by-side without schema conflicts.

CREATE TABLE IF NOT EXISTS intent_calibration_v2_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calibrated_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Backtest configuration used (for reproducibility)
  config JSONB NOT NULL,

  -- Data provenance
  data_stats JSONB NOT NULL,
  sample_stats JSONB NOT NULL,

  -- Performance metrics — the honest numbers
  metrics JSONB NOT NULL,

  -- Feature importance (LR coefficient magnitudes, sorted)
  feature_importance JSONB NOT NULL,

  -- Calibrated weights for the 10 production factors
  -- These are the weights that SHOULD replace the hardcoded W constant in
  -- pharma-intent.ts if we enable calibrated weights in production
  calibrated_production_weights JSONB NOT NULL,

  -- Comparison showing how calibrated weights differ from hardcoded ones
  weight_shift JSONB NOT NULL,

  -- Runtime
  elapsed_ms INTEGER
);

-- Index for fast "most recent" queries
CREATE INDEX IF NOT EXISTS idx_intent_calibration_v2_calibrated_at
  ON intent_calibration_v2_results (calibrated_at DESC);

-- RLS: service role only (no public reads)
ALTER TABLE intent_calibration_v2_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role has full access"
  ON intent_calibration_v2_results
  FOR ALL
  USING (auth.role() = 'service_role');

COMMENT ON TABLE intent_calibration_v2_results IS
  'Pharma Intent Score V2 backtest results. Each row is a backtest run. See lib/services/pharma-intent-backtest-v2.ts for methodology.';
