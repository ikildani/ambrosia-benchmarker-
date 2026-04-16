-- 037: Share intelligence — canonical aliasing + view classification
--
-- This migration is the foundation of the unified share intelligence system,
-- introduced after the 2026-04-10 incident where:
--
--   1. Issa accidentally sent a Phase 2 obesity GLP-1 share link to a Phase 2 IPF
--      prospect (Endeavor BioMedicines / Vishaal). The wrong link was already in
--      the prospect's inbox and could not be "unsent." The only fixes were
--      (a) UPDATE the row in place (data inconsistency risk if the same token
--      is also referenced elsewhere), or (b) generate a fresh token (the
--      prospect's existing inbox link still serves the wrong content forever).
--
--   2. The Slack share-view alert channel got dominated by 16+ "view" alerts
--      for that one stale obesity link, all but ~2 of which were actually
--      datacenter IPs from Microsoft Defender Safe Links, Outlook scanners,
--      Google Workspace link previewers, and AWS-hosted bots. Real prospect
--      engagement was drowned in bot noise, leading Issa to incorrectly believe
--      his prospect was deeply engaged ("12 views!") and that ALL his outreach
--      links were broken (since the bot-rescanned link kept dominating recent
--      Slack alerts).
--
--   3. The earlier engine inflation audit (model v2) recalibrated 108 upfront
--      ratio entries and 8 phase baselines. 2,029 existing share rows are
--      frozen at v1 (inflated). They need a way to be flagged as legacy.
--
-- The unified system this migration enables:
--
--   A. Canonical token aliasing (shared_calculations.canonical_token)
--      Any token can be marked as superseded by another. The share GET
--      endpoint follows the alias chain (with cycle protection) and returns
--      the current canonical content. "Updating" a share = aliasing the old
--      token at the new one. Vishaal's old inbox URL automatically serves
--      the corrected analysis without anyone re-sending anything.
--
--   B. View classification (events.view_classification)
--      Each share-view event is classified at insert time as 'human',
--      'datacenter' (known cloud provider IP), or 'bot' (UA pattern). Slack
--      alerts gate on classification='human' to filter out scanner noise.
--      Engagement scoring (engagement_seconds, populated by a follow-up
--      share-view-end beacon) feeds future prospect intent scoring.

-- ─── Part A: Canonical token aliasing ─────────────────────────────────────

ALTER TABLE shared_calculations
  ADD COLUMN IF NOT EXISTS canonical_token TEXT,
  ADD COLUMN IF NOT EXISTS superseded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS superseded_by_email TEXT;

COMMENT ON COLUMN shared_calculations.canonical_token IS
  'If set, this token is an alias for canonical_token. The share GET endpoint follows the chain and serves the canonical row. NULL means this row IS the canonical version.';
COMMENT ON COLUMN shared_calculations.superseded_at IS
  'When this share was superseded by a newer canonical version. Set together with canonical_token.';
COMMENT ON COLUMN shared_calculations.superseded_by_email IS
  'Email of the user who superseded this share, for audit trail.';

-- Index for fast canonical lookups (only useful for non-null aliases)
CREATE INDEX IF NOT EXISTS idx_shared_calculations_canonical
  ON shared_calculations(canonical_token)
  WHERE canonical_token IS NOT NULL;

-- ─── Part B: View classification on events ─────────────────────────────────

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS view_classification TEXT,
  ADD COLUMN IF NOT EXISTS engagement_seconds INTEGER;

COMMENT ON COLUMN events.view_classification IS
  'For event_type=share_view: human|datacenter|bot|unknown. Set at insert time by classifyView().';
COMMENT ON COLUMN events.engagement_seconds IS
  'For event_type=share_view: time in seconds the user spent on the page, populated by share-view-end beacon.';

-- Index for filtering Slack alerts to human-only views
CREATE INDEX IF NOT EXISTS idx_events_view_classification
  ON events(event_type, view_classification, created_at)
  WHERE event_type = 'share_view';

-- ─── Part C: Backfill existing share_view events ───────────────────────────
--
-- Mark existing events with the obvious classifications based on IP prefix.
-- This is a best-effort backfill — most older events have IP prefixes already
-- in the events.event_data->>'ip' field (anonymized as e.g. '34.118***').
-- We can detect known cloud datacenter ranges from the prefix.
--
-- These ranges cover the bulk of bot traffic seen in the 2026-04-10 audit:
--   - 34.x   = Google Cloud (Council Bluffs IA, Warsaw PL data centers)
--   - 35.x   = Google Cloud
--   - 52.x   = AWS (Boardman OR, etc.)
--   - 18.x   = AWS
--   - 45.x   = various clouds (some legitimate too)
--   - 205.16 = Microsoft Outlook Safe Links scanner (bing.com referrer pattern)

UPDATE events
SET view_classification = 'datacenter'
WHERE event_type = 'share_view'
  AND view_classification IS NULL
  AND (
    (event_data->>'ip') LIKE '34.%'
    OR (event_data->>'ip') LIKE '35.%'
    OR (event_data->>'ip') LIKE '52.%'
    OR (event_data->>'ip') LIKE '18.%'
    OR (event_data->>'ip') LIKE '205.16%'
    OR (event_data->>'source') LIKE '%bing%'
  );

-- Anything still null after the datacenter pass is treated as 'unknown' for
-- backwards compat. Going forward, classifyView() will populate this on insert.
UPDATE events
SET view_classification = 'unknown'
WHERE event_type = 'share_view'
  AND view_classification IS NULL;
