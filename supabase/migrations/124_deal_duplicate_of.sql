-- Migration 124 — duplicate lineage on deals
-- deals.duplicate_of points a superseded row at the row that survived the dedupe.
-- Superseded rows are also marked is_synthetic = true so every consumer that
-- already filters on is_synthetic excludes them; the notes say why. Reversal:
--   UPDATE deals SET is_synthetic = false WHERE duplicate_of IS NOT NULL; ALTER TABLE deals DROP COLUMN duplicate_of;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS duplicate_of uuid REFERENCES deals(id);
CREATE INDEX IF NOT EXISTS idx_deals_duplicate_of ON deals (duplicate_of) WHERE duplicate_of IS NOT NULL;
COMMENT ON COLUMN deals.duplicate_of IS 'Sep 2026: set on rows superseded by the dedupe pass; such rows are also is_synthetic = true.';
