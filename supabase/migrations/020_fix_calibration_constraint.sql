-- Fix unique constraint on benchmark_calibrations
-- PostgreSQL UNIQUE constraints treat NULL != NULL, so the original constraint
-- never prevented duplicates for phase baselines (modality=NULL) or modality
-- multipliers (phase=NULL).
-- Replace with functional unique indexes using COALESCE.

ALTER TABLE benchmark_calibrations DROP CONSTRAINT IF EXISTS unique_active_calibration;

-- Unique index for active calibrations, treating NULLs as empty strings for comparison
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_calibration
  ON benchmark_calibrations (
    calibration_type,
    therapeutic_area,
    COALESCE(phase, ''),
    COALESCE(modality, '')
  )
  WHERE is_active = true;
