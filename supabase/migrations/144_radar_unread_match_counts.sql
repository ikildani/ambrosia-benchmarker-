-- 144: radar_unread_match_counts is missing in production (migration 091 defined
-- it, but pg_proc has no such function today), so GET /api/radar/mandates has
-- been returning unread_matches = 0 for every mandate and the "N new" badge
-- never showed. Recreate it, idempotently, with the same contract.
--
-- Also the supporting index for the mandate-matches page: the page reads one
-- mandate's non-dismissed matches newest first, and the PATCH marks them
-- read/saved/dismissed by (mandate_id, user_id, id).

CREATE OR REPLACE FUNCTION radar_unread_match_counts(mandate_ids UUID[], uid UUID)
RETURNS TABLE(mandate_id UUID, unread BIGINT) AS $$
  SELECT
    m.mandate_id,
    COUNT(*) AS unread
  FROM radar_mandate_matches m
  WHERE m.mandate_id = ANY(mandate_ids)
    AND m.user_id = uid
    AND m.is_read = false
    AND m.is_dismissed = false
  GROUP BY m.mandate_id;
$$ LANGUAGE sql STABLE;

CREATE INDEX IF NOT EXISTS idx_mandate_matches_mandate_user_open
  ON radar_mandate_matches (mandate_id, user_id, matched_at DESC)
  WHERE is_dismissed = false;

-- Backtest bookkeeping: the train phase stores a sample of raw test
-- predictions on radar_score_snapshots. It used a partial upsert, which
-- Postgres rejects before the ON CONFLICT clause runs (features is NOT NULL),
-- so every train run logged "prediction sample: null value in column
-- features". Update in place from a jsonb array instead.
CREATE OR REPLACE FUNCTION radar_snapshot_set_predictions(rows JSONB, model_version TEXT)
RETURNS INTEGER AS $$
  WITH p AS (
    SELECT (r->>'asset_id')::uuid AS asset_id,
           (r->>'as_of')::date AS as_of,
           r->>'feature_version' AS feature_version,
           (r->>'prediction')::numeric AS prediction
    FROM jsonb_array_elements(rows) r
  ), u AS (
    UPDATE radar_score_snapshots s
       SET prediction = p.prediction, prediction_model = model_version
      FROM p
     WHERE s.asset_id = p.asset_id AND s.as_of = p.as_of AND s.feature_version = p.feature_version
    RETURNING 1
  )
  SELECT COUNT(*)::integer FROM u;
$$ LANGUAGE sql;

-- Launch email ledger (scripts/radar-launch-email.ts): one row per recipient
-- per wave, so a re-run never sends twice and the day-7 nudge can find who
-- got the day-0 note.
CREATE TABLE IF NOT EXISTS radar_launch_email_sends (
  email TEXT NOT NULL,
  wave TEXT NOT NULL CHECK (wave IN ('day0', 'day7')),
  user_id UUID,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  message_id TEXT,
  PRIMARY KEY (email, wave)
);
