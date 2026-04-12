-- Tier 4 Item 12 — Macro Factor Snapshots
--
-- Daily snapshots of the macro inputs used by the rNPV engine's discount rate
-- stack (10Y Treasury risk-free rate, biotech beta, equity risk premium).
-- Refreshed by app/api/cron/macro-factors/route.ts (daily at 6am UTC).
-- Read synchronously by lib/financial/macro-factors.ts → getMacroSnapshot()
-- which hydrates from the most recent row at server boot.

CREATE TABLE IF NOT EXISTS macro_snapshots (
  id BIGSERIAL PRIMARY KEY,
  snapshot_date DATE NOT NULL UNIQUE,
  -- Decimal yield, e.g. 0.0438 for 4.38%
  treasury_10y NUMERIC(6, 5) NOT NULL CHECK (treasury_10y BETWEEN -0.02 AND 0.20),
  -- Unitless beta, typical 0.8 - 1.5 for biotech
  biotech_beta NUMERIC(5, 3) NOT NULL CHECK (biotech_beta BETWEEN 0.3 AND 3.0),
  -- Decimal premium, typical 0.05 - 0.07
  equity_risk_premium NUMERIC(5, 4) NOT NULL CHECK (equity_risk_premium BETWEEN 0.01 AND 0.15),
  -- Source identifiers so we can trace bad data back to a specific upstream feed
  source_treasury TEXT NOT NULL DEFAULT 'fallback',
  source_beta TEXT NOT NULL DEFAULT 'fallback',
  source_erp TEXT NOT NULL DEFAULT 'fallback',
  -- Raw API responses (for debugging upstream format changes)
  raw_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_macro_snapshots_date
  ON macro_snapshots (snapshot_date DESC);

-- RLS: service role writes via cron; authenticated users can read the latest.
ALTER TABLE macro_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS macro_snapshots_read ON macro_snapshots;
CREATE POLICY macro_snapshots_read
  ON macro_snapshots
  FOR SELECT
  TO authenticated
  USING (true);

COMMENT ON TABLE macro_snapshots IS
  'Daily macro inputs (10Y Treasury, biotech beta, ERP) used by the rNPV discount-rate stack. Refreshed by cron at 6am UTC. Engine reads most recent row at boot.';
