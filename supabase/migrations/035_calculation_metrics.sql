-- Layer 4: Production Distribution Monitoring
--
-- Stores per-calculation metrics for every production rNPV run so a daily
-- cron can compute distribution statistics by (TA, phase) and alert on drift.

CREATE TABLE IF NOT EXISTS calculation_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calculation_id UUID,
  therapeutic_area VARCHAR(50),
  modality VARCHAR(50),
  phase VARCHAR(50),
  indication VARCHAR(100),
  peak_sales NUMERIC,
  rnpv NUMERIC,
  unadjusted_npv NUMERIC,
  monte_carlo_p50 NUMERIC,
  cumulative_pos NUMERIC,
  years_to_market NUMERIC,
  discount_rate NUMERIC,
  invariant_violations INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calc_metrics_ta_phase ON calculation_metrics(therapeutic_area, phase);
CREATE INDEX IF NOT EXISTS idx_calc_metrics_created_at ON calculation_metrics(created_at DESC);

ALTER TABLE calculation_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access" ON calculation_metrics;
CREATE POLICY "Service role full access" ON calculation_metrics
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
