-- Tier 4 Item 14 — Indication Patent Cliffs
--
-- Per-indication market leader drugs with LOE / biosimilar years, refreshed
-- quarterly by app/api/cron/patent-cliffs. Distinct from the per-company
-- companies.patent_cliffs JSONB column (migration 002) which is used only
-- by partner-matching UI — not by the engine.

CREATE TABLE IF NOT EXISTS indication_patent_cliffs (
  id BIGSERIAL PRIMARY KEY,
  indication TEXT NOT NULL,
  drug TEXT NOT NULL,
  loe_year INTEGER NOT NULL CHECK (loe_year BETWEEN 2020 AND 2050),
  biosimilar_year INTEGER NOT NULL CHECK (biosimilar_year BETWEEN 2020 AND 2055),
  current_revenue_usd_m NUMERIC(10, 2),
  rank INTEGER NOT NULL CHECK (rank >= 1),
  source TEXT NOT NULL,
  source_year INTEGER NOT NULL CHECK (source_year BETWEEN 2020 AND 2030),
  notes TEXT,
  last_refreshed TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT indication_patent_cliffs_unique UNIQUE (indication, drug)
);

CREATE INDEX IF NOT EXISTS idx_indication_patent_cliffs_indication
  ON indication_patent_cliffs (indication, rank);

ALTER TABLE indication_patent_cliffs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS indication_patent_cliffs_read ON indication_patent_cliffs;
CREATE POLICY indication_patent_cliffs_read
  ON indication_patent_cliffs
  FOR SELECT
  TO authenticated
  USING (true);

COMMENT ON TABLE indication_patent_cliffs IS
  'Market leader drug LOE / biosimilar timing per indication. Refreshed quarterly by cron. Used by the rNPV engine (lib/financial/patent-cliffs.ts) to adjust peak sales based on the user asset''s launch year vs. leader timing.';
