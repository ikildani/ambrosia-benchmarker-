-- Migration 127 — Duplicate-company merges (entity graph, docs/entity-graph.md "Merge job").
--
-- Why: companies holds ~684 groups of rows that are the same organisation under
-- a different legal-form spelling (Janssen-Cilag ×10, Kyowa Kirin ×3, …), most
-- of them trial-registry sponsor strings next to the enriched partner row.
-- scripts/merge-duplicate-companies.ts folds each group into its
-- best-populated row. Nothing is deleted: the surplus row stays, gets
-- merged_into = canonical id, and the resolver follows the pointer so every
-- old companies.id keeps resolving (lib/entities/resolve.ts, matchedOn 'merged').
--
-- company_merges is the audit ledger: one row per surplus row folded (or per
-- alias strip on a subsidiary row), carrying the alias union written to the
-- canonical and a {table.column: rows} map of what was repointed, so a merge
-- can be reversed row by row.
--
-- Rollback of one merge (see docs/entity-graph.md):
--   UPDATE companies SET merged_into = NULL, merged_at = NULL WHERE id = <merged_id>;
--   then re-point the tables listed in company_merges.repointed back to <merged_id>
--   using the deal / trial / asset ids stored in company_merges.repointed_ids.
--
-- Reversal of this migration:
--   DROP TABLE IF EXISTS company_merges;
--   DROP INDEX IF EXISTS idx_companies_merged_into;
--   ALTER TABLE companies DROP COLUMN IF EXISTS merged_into, DROP COLUMN IF EXISTS merged_at;

BEGIN;

-- ── companies: soft pointer to the canonical row ──────────────────────────

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS merged_into uuid REFERENCES companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS merged_at   timestamptz;

-- A row never points at itself.
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_merged_into_not_self;
ALTER TABLE companies
  ADD CONSTRAINT companies_merged_into_not_self CHECK (merged_into IS NULL OR merged_into <> id);

-- Partial: only the ~800 merged rows are indexed; the canonical majority costs nothing.
CREATE INDEX IF NOT EXISTS idx_companies_merged_into
  ON companies (merged_into)
  WHERE merged_into IS NOT NULL;

COMMENT ON COLUMN companies.merged_into IS
  'Sep 2026: canonical companies.id this duplicate row was folded into (NULL = this row is canonical). Set by scripts/merge-duplicate-companies.ts --apply; the entity resolver follows it. Reversible: set back to NULL and re-point the tables in company_merges.repointed.';
COMMENT ON COLUMN companies.merged_at IS
  'When merged_into was set.';

-- ── company_merges: audit ledger ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS company_merges (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_id   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  -- NULL only for reason = 'alias_strip' (a subsidiary row whose name_variations
  -- lost a parent's name; no row was folded).
  merged_id      uuid REFERENCES companies(id) ON DELETE SET NULL,
  merged_name    text NOT NULL,
  reason         text NOT NULL,
  alias_union    text[] NOT NULL DEFAULT '{}',
  -- Parent names removed from name_variations on the way (hazard 1).
  aliases_stripped text[] NOT NULL DEFAULT '{}',
  -- {"deals.licensor_id": 3, "company_trials.company_id": 41, ...}
  repointed      jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- {"deals.licensor_id": ["<row id>", ...], ...} — the exact rows moved, for rollback.
  repointed_ids  jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Rows that could not move because a unique index already had the canonical
  -- id for the same key (e.g. company_trials (company_id, nct_id)); they keep
  -- pointing at merged_id, which still exists. {"table.column": n}
  conflicts      jsonb NOT NULL DEFAULT '{}'::jsonb,
  run_id         text NOT NULL,
  dry_run        boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_merges_reason_chk CHECK (
    (reason = 'alias_strip' AND merged_id IS NULL) OR (reason <> 'alias_strip' AND merged_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_company_merges_run       ON company_merges (run_id);
CREATE INDEX IF NOT EXISTS idx_company_merges_canonical ON company_merges (canonical_id);
CREATE INDEX IF NOT EXISTS idx_company_merges_merged    ON company_merges (merged_id) WHERE merged_id IS NOT NULL;

COMMENT ON TABLE  company_merges IS
  'Sep 2026: audit ledger for scripts/merge-duplicate-companies.ts. One row per companies row folded into its canonical (or per alias strip). Carries the alias union written to the canonical and, per referencing table.column, how many rows were re-pointed and which ones, so a merge can be undone.';
COMMENT ON COLUMN company_merges.canonical_id     IS 'The surviving companies.id (best-populated row of the group, companyPopulationScore).';
COMMENT ON COLUMN company_merges.merged_id        IS 'The companies.id folded into canonical_id (its merged_into now equals canonical_id). NULL for alias_strip rows.';
COMMENT ON COLUMN company_merges.merged_name      IS 'companies.name of the merged row at merge time (or of the stripped row for alias_strip).';
COMMENT ON COLUMN company_merges.reason           IS 'same_normalized_name | alias_strip. Planning reasons are recorded verbatim by the script.';
COMMENT ON COLUMN company_merges.alias_union      IS 'name_variations written to the canonical row by this merge (union of every row in the group, parent names stripped).';
COMMENT ON COLUMN company_merges.aliases_stripped IS 'Variations removed because they are the exact name of a separate canonical row (a parent: "Alexion (AstraZeneca)" carrying "AstraZeneca").';
COMMENT ON COLUMN company_merges.repointed        IS '{"table.column": rows updated}. The full column list is COMPANY_REFERENCING_COLUMNS in lib/entities/merge.ts.';
COMMENT ON COLUMN company_merges.repointed_ids    IS '{"table.column": [primary keys moved]} for rollback. Capped per column; see the script.';
COMMENT ON COLUMN company_merges.conflicts        IS '{"table.column": rows left on merged_id} because a unique index already held the canonical id for the same key.';
COMMENT ON COLUMN company_merges.run_id           IS 'Operator-supplied id of the apply run (--run-id).';
COMMENT ON COLUMN company_merges.dry_run          IS 'true = planning row only (nothing was written elsewhere). The script writes audit rows only on --apply, so this is false on every row it inserts; kept for manual planning inserts.';

ALTER TABLE company_merges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access company_merges" ON company_merges;
CREATE POLICY "Service role full access company_merges"
  ON company_merges FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMIT;
