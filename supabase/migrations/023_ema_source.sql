-- Add 'ema' to the data_ingestion_log source CHECK constraint
-- Supports the EMA European Medicines Agency regulatory data pipeline

ALTER TABLE data_ingestion_log DROP CONSTRAINT IF EXISTS data_ingestion_log_source_check;
ALTER TABLE data_ingestion_log ADD CONSTRAINT data_ingestion_log_source_check
  CHECK (source IN (
    'sec_edgar', 'clinicaltrials',
    'press_globenewswire', 'press_businesswire', 'press_prnewswire',
    'company_pipeline', 'fda_openfda', 'fda_orange_book',
    'sec_xbrl', 'benchmark_calibration', 'company_enrichment',
    'ema', 'manual'
  ));
