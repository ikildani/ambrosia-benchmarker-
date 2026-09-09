-- Asset Radar Layer 2 — Scoring v2
--
-- 1. Dedicated scoring queue column. Layer 2 used to order its work queue by
--    clinical_assets.last_enriched_at, which Layer 1 (asset-universe) also
--    writes, so the two crons fought over the same cursor and only ~1,150 of
--    5,900 assets were ever scored. last_scored_at is written by Layer 2 only.
-- 2. score_confidence: evidence completeness (0-100) persisted next to the
--    composite so the UI can distinguish "low score" from "no evidence".
-- 3. licensing_signals.signal_hash becomes UNIQUE so the scorer can batch
--    upsert (ON CONFLICT signal_hash) instead of select-then-insert per row.
--    Duplicate hashes from the old concurrent-insert path are collapsed first
--    (newest row wins).

-- ══════════════════════════════════════════════════════════════════════
-- clinical_assets: scoring queue + confidence
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE clinical_assets
  ADD COLUMN IF NOT EXISTS last_scored_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS score_confidence INTEGER DEFAULT 0
    CHECK (score_confidence >= 0 AND score_confidence <= 100);

-- Queue order: never-scored first, then oldest. NULLS FIRST matches the
-- ORDER BY the scorer issues so the index is usable for the queue scan.
CREATE INDEX IF NOT EXISTS idx_clinical_assets_last_scored
  ON clinical_assets (last_scored_at ASC NULLS FIRST);

COMMENT ON COLUMN clinical_assets.last_scored_at IS
  'Last time Layer 2 (licensing signal detection) scored this asset. Scoring queue cursor; distinct from last_enriched_at (Layer 1).';
COMMENT ON COLUMN clinical_assets.score_confidence IS
  'Evidence completeness behind licensing_intent_score, 0-100 (weighted mean of per-factor confidence). 0 = no evidence found in any source.';

-- ══════════════════════════════════════════════════════════════════════
-- licensing_signals: unique signal_hash for batch upsert
-- ══════════════════════════════════════════════════════════════════════

-- Collapse any historical duplicates (keep the most recently detected row).
DELETE FROM licensing_signals ls
USING licensing_signals newer
WHERE ls.signal_hash IS NOT NULL
  AND ls.signal_hash = newer.signal_hash
  AND ls.id <> newer.id
  AND (ls.detected_at, ls.id) < (newer.detected_at, newer.id);

DROP INDEX IF EXISTS idx_licensing_signals_hash;

CREATE UNIQUE INDEX IF NOT EXISTS idx_licensing_signals_hash_unique
  ON licensing_signals (signal_hash);

-- Stale-row sweep after each run compares updated_at against run start.
CREATE INDEX IF NOT EXISTS idx_licensing_signals_asset_updated
  ON licensing_signals (asset_id, updated_at);

COMMENT ON COLUMN licensing_signals.signal_hash IS
  'sha256(asset_id:signal_type:evidence_key)[0:32]. evidence_key = ids of the source rows backing the signal (or "none"). One row per factor per evidence set; rows not touched by a run are deactivated.';
