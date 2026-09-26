-- 131: index for the classification queue read.
--
-- lib/radar/classify.ts fetchClassificationQueue selects clinical_assets where
-- classification_status = 'unclassified' ordered by updated_at ascending, joined
-- to companies. With 149k unclassified rows and no index on classification_status
-- the read scanned and sorted the table on every run and hit statement timeout
-- (Sep 25 2026, 74-85s per attempt). A partial index makes it an index walk.

CREATE INDEX IF NOT EXISTS idx_clinical_assets_unclassified_updated
  ON clinical_assets (updated_at ASC)
  WHERE classification_status = 'unclassified';

COMMENT ON INDEX idx_clinical_assets_unclassified_updated IS
  'Partial index for the asset-classify queue: unclassified rows, oldest first.';
