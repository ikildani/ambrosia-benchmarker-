-- Per-source incremental sync cursors for the Asset Radar universe sweeps
-- (ClinicalTrials.gov sponsor-agnostic sweep, ex-US registry adapters, drug
-- resolution). One row per source; `cursor` is source-defined (a date, a page
-- token, an offset) and `state` carries anything else the adapter needs.

CREATE TABLE IF NOT EXISTS radar_sync_cursors (
  source      TEXT PRIMARY KEY,
  cursor      TEXT,
  state       JSONB NOT NULL DEFAULT '{}',
  runs        INTEGER NOT NULL DEFAULT 0,
  last_run_at TIMESTAMPTZ,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE radar_sync_cursors IS
  'Incremental sync position per Radar data source. Read at the start of a cron run, written at the end. Delete a row to force a full re-sweep of that source.';

ALTER TABLE radar_sync_cursors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access sync cursors" ON radar_sync_cursors;
CREATE POLICY "Service role full access sync cursors"
  ON radar_sync_cursors FOR ALL TO service_role USING (true) WITH CHECK (true);
