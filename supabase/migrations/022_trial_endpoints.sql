-- Add endpoint data columns to company_trials
-- ClinicalTrials.gov API provides PrimaryOutcomeMeasure and SecondaryOutcomeMeasure
-- which are critical for deal valuations

ALTER TABLE company_trials ADD COLUMN IF NOT EXISTS primary_outcomes TEXT[] DEFAULT '{}';
ALTER TABLE company_trials ADD COLUMN IF NOT EXISTS secondary_outcomes TEXT[] DEFAULT '{}';
ALTER TABLE company_trials ADD COLUMN IF NOT EXISTS primary_outcome_measures JSONB DEFAULT '[]';
ALTER TABLE company_trials ADD COLUMN IF NOT EXISTS enrollment_target INTEGER;

CREATE INDEX IF NOT EXISTS idx_trials_has_endpoints
  ON company_trials (company_id)
  WHERE array_length(primary_outcomes, 1) > 0;
