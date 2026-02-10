-- Add therapeutic_area column to deals table
-- Enables filtering deals by oncology vs neurology/CNS
ALTER TABLE deals ADD COLUMN IF NOT EXISTS therapeutic_area TEXT DEFAULT 'oncology';

CREATE INDEX IF NOT EXISTS idx_deals_therapeutic_area ON deals (therapeutic_area);

-- Backfill existing deals based on indication_category
UPDATE deals SET therapeutic_area = 'neurology' WHERE indication_category = 'cns' AND therapeutic_area = 'oncology';
