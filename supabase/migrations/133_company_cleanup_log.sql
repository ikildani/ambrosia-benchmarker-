-- Migration 133 — Company-graph cleanup log (docs/entity-graph.md "Cleanup jobs").
--
-- Why: after the Sep 2026 duplicate-company merge, three follow-up jobs change
-- rows that company_merges (migration 127) does not describe:
--   scripts/dedupe-merge-conflicts.ts   deletes the duplicate child rows a unique
--                                       index kept on folded companies (company_trials,
--                                       drug_owners, intent_score_snapshots,
--                                       company_financials), after copying any
--                                       value the surviving row lacked;
--   scripts/retire-junk-companies.ts    deletes companies rows that are trial-registry
--                                       funding sentences, not organisations, and
--                                       reclassifies people that were tagged industry;
--   scripts/merge-same-company-rows.ts  folds same-company rows under different names
--                                       (audit stays in company_merges, reason
--                                       'same_company_alias').
-- Every deleted or changed row is snapshotted here first, so each action can be
-- reversed by re-inserting `row` (deleted) or re-applying `row` over `changes`
-- (reclassified / filled).
--
-- Reversal of this migration:
--   DROP TABLE IF EXISTS company_cleanup_log;

BEGIN;

CREATE TABLE IF NOT EXISTS company_cleanup_log (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id               text NOT NULL,
  -- deleted_duplicate | deleted_company | detached | reclassified | filled | repointed
  action               text NOT NULL,
  table_name           text NOT NULL,
  -- Primary key of the affected row as text (uuid or composite joined by '|').
  row_id               text NOT NULL,
  -- companies.id the row belonged to / pointed at before the action.
  company_id           uuid,
  -- For duplicates and re-points: the canonical companies.id.
  canonical_company_id uuid,
  -- For deleted duplicates: the surviving row on the canonical company.
  kept_row_id          text,
  -- Full snapshot of the row before the action.
  row                  jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- What was written: {"column": new value} on the kept / reclassified row.
  changes              jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_company_cleanup_log_run     ON company_cleanup_log (run_id);
CREATE INDEX IF NOT EXISTS idx_company_cleanup_log_company ON company_cleanup_log (company_id);
CREATE INDEX IF NOT EXISTS idx_company_cleanup_log_table   ON company_cleanup_log (table_name, row_id);

COMMENT ON TABLE company_cleanup_log IS
  'Sep 2026: before-image of every row deleted, detached, filled or reclassified by the company-graph cleanup scripts (dedupe-merge-conflicts, retire-junk-companies). Reverse an action by re-inserting `row` or re-applying it over `changes`.';

ALTER TABLE company_cleanup_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access company_cleanup_log" ON company_cleanup_log;
CREATE POLICY "Service role full access company_cleanup_log"
  ON company_cleanup_log FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMIT;
