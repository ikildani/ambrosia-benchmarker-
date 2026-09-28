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
