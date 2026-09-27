-- Migration 138 — data readiness for real briefs
--
-- readiness: the coverage card computed at intake (lib/brief/readiness.ts):
--   same-indication comparables, verified share, buyers with stage history,
--   price benchmark, deal-status coverage. Red lines mean the draft is not
--   yet quotable and a top-up is queued.
-- brief_topups: one row per intake that needs an indication-scoped ingestion
--   run before the call; the Perplexity discovery cron drains it.
-- deals.deal_status_checked_at: when the weekly status pass last asked whether
--   the deal is still active (lib/ingestion/deal-status.ts).

ALTER TABLE benchmark_requests
  ADD COLUMN IF NOT EXISTS readiness jsonb,
  ADD COLUMN IF NOT EXISTS readiness_checked_at timestamptz;

CREATE TABLE IF NOT EXISTS brief_topups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid REFERENCES benchmark_requests(id) ON DELETE CASCADE,
  therapeutic_area text NOT NULL,
  indication text NOT NULL,
  indication_key text,
  phase text,
  mechanism text,
  target text,
  status text NOT NULL DEFAULT 'pending',        -- pending | running | done | failed
  runs integer NOT NULL DEFAULT 0,
  queries_run integer NOT NULL DEFAULT 0,
  deals_discovered integer NOT NULL DEFAULT 0,
  deals_inserted integer NOT NULL DEFAULT 0,
  readiness_before jsonb,
  readiness_after jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_run_at timestamptz,
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS brief_topups_pending_idx ON brief_topups (status, created_at) WHERE status IN ('pending', 'running');

ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS deal_status_checked_at timestamptz;
CREATE INDEX IF NOT EXISTS deals_status_checked_idx ON deals (deal_status_checked_at) WHERE deal_status_checked_at IS NULL;

COMMENT ON TABLE brief_topups IS 'Indication-scoped ingestion runs queued by intake readiness (lib/ingestion/indication-topup.ts).';
