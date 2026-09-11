-- The universe indexer pages trial_interventions per company batch ordered
-- by (company_id, nct_id, name_normalized); without a matching index each
-- page re-sorted every row for the batch and timed out on large sponsors.
CREATE INDEX IF NOT EXISTS idx_trial_interventions_company_nct_name
  ON trial_interventions (company_id, nct_id, name_normalized)
  WHERE company_id IS NOT NULL;
