-- =============================================
-- Benchmark Calibrations
-- Stores auto-calibrated benchmark values derived from actual deal data
-- =============================================

CREATE TABLE benchmark_calibrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Calibration key
  calibration_type TEXT NOT NULL CHECK (calibration_type IN ('phase_baseline', 'modality_multiplier')),
  therapeutic_area TEXT NOT NULL,
  phase TEXT,               -- for phase_baseline type (phase1, phase2, phase3, etc.)
  modality TEXT,            -- for modality_multiplier type (adc, mab, etc.)

  -- Calibrated values (phase baselines, in $M)
  upfront_low NUMERIC,
  upfront_median NUMERIC,
  upfront_high NUMERIC,
  total_value_low NUMERIC,
  total_value_median NUMERIC,
  total_value_high NUMERIC,
  royalty_base NUMERIC,     -- percentage (e.g., 8 for 8%)
  royalty_max NUMERIC,

  -- Calibrated values (modality multiplier)
  multiplier NUMERIC,

  -- Metadata
  sample_size INTEGER NOT NULL DEFAULT 0,
  deal_ids UUID[] DEFAULT '{}',
  confidence_score NUMERIC,
  calibrated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Versioning
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_active_calibration UNIQUE (calibration_type, therapeutic_area, phase, modality, is_active)
);

CREATE INDEX idx_calibrations_active ON benchmark_calibrations (is_active) WHERE is_active = true;
CREATE INDEX idx_calibrations_type ON benchmark_calibrations (calibration_type, therapeutic_area);

-- RLS
ALTER TABLE benchmark_calibrations ENABLE ROW LEVEL SECURITY;

-- Public read (needed for calculations at runtime)
CREATE POLICY "Public read calibrations" ON benchmark_calibrations
  FOR SELECT USING (true);

-- Service role manages calibrations
CREATE POLICY "Service role manages calibrations" ON benchmark_calibrations
  FOR ALL USING (auth.role() = 'service_role');

-- Expand data_ingestion_log source constraint to include new pipeline sources
ALTER TABLE data_ingestion_log DROP CONSTRAINT IF EXISTS data_ingestion_log_source_check;
ALTER TABLE data_ingestion_log ADD CONSTRAINT data_ingestion_log_source_check
  CHECK (source IN (
    'sec_edgar',
    'clinicaltrials',
    'press_globenewswire',
    'press_businesswire',
    'press_prnewswire',
    'company_pipeline',
    'fda_openfda',
    'fda_orange_book',
    'sec_xbrl',
    'benchmark_calibration',
    'company_enrichment',
    'manual'
  ));
