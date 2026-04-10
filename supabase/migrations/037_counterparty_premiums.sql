-- Migration 037 — Counterparty Premiums (Tier 3 Item 9)
--
-- Stores per-buyer historical deal premiums computed by the
-- counterparty-calibration cron. Refreshed quarterly.
--
-- Source: lib/financial/counterparty-premiums.ts → computeCounterpartyPremiums()
-- Cron: app/api/cron/counterparty-calibration/route.ts (quarterly)

CREATE TABLE IF NOT EXISTS counterparty_premiums (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  -- Multiplicative premium vs. comparable median.
  --   1.00 = pays the median
  --   1.25 = pays 25% above median (e.g., AbbVie historically)
  --   0.95 = pays 5% below median (e.g., Gilead post-Immunomedics)
  -- Always clamped to [0.7, 1.5] before insertion — anything outside is suspect.
  premium_multiplier NUMERIC(4, 3) NOT NULL CHECK (premium_multiplier BETWEEN 0.5 AND 2.0),
  sample_size INTEGER NOT NULL CHECK (sample_size >= 0),
  confidence TEXT NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
  -- JSONB slices: { "oncology": { "premium": 1.20, "n": 8 }, ... }
  by_therapeutic_area JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- JSONB slices keyed on DB phase: { "phase_2": { "premium": 1.15, "n": 5 }, ... }
  by_phase JSONB NOT NULL DEFAULT '{}'::jsonb,
  calculation_notes TEXT,
  as_of_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- One row per (buyer, calculation date) — keeps quarterly history
  CONSTRAINT counterparty_premiums_unique_per_date UNIQUE (company_id, as_of_date)
);

CREATE INDEX IF NOT EXISTS idx_counterparty_premiums_company
  ON counterparty_premiums (company_id);
CREATE INDEX IF NOT EXISTS idx_counterparty_premiums_as_of_date
  ON counterparty_premiums (as_of_date DESC);

-- RLS: read-only for authenticated users, write-only via service role
ALTER TABLE counterparty_premiums ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS counterparty_premiums_read ON counterparty_premiums;
CREATE POLICY counterparty_premiums_read
  ON counterparty_premiums
  FOR SELECT
  TO authenticated
  USING (true);

COMMENT ON TABLE counterparty_premiums IS
  'Per-buyer historical deal premiums vs. comparable medians. Refreshed quarterly by counterparty-calibration cron. Used by buyer-specific-valuation engine to differentiate AbbVie vs. Gilead vs. Novartis valuations.';
