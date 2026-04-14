-- Migration 052 — add peak_sales_consensus_m column to deals
--
-- Purpose: wire the backtest's R60 asset-specific peak-sales override
-- into production. The backtest already uses an in-repo lookup table
-- (data/asset-peak-sales.ts). Production currently uses the indication-
-- typical peak or the TA default — flattening real per-asset variance by
-- up to 25× (Opdivo $9.3B vs TA-default oncology $2.5B).
--
-- This column holds the analyst-consensus peak-sales anchor ($M) when
-- known. NULL for unknown/early-stage assets (engine falls through to
-- indication/TA defaults as today).
--
-- Source for populated values: 2024 10-K actual product revenues for
-- approved drugs + EvaluatePharma/Barclays/RBC peak projections for
-- Phase 3 pipeline. Entries populated by a follow-on job that joins the
-- Supabase deals table to data/asset-peak-sales.ts.
--
-- Reversibility: ALTER TABLE deals DROP COLUMN peak_sales_consensus_m;
--
-- No DATA written in this migration — column added as nullable with no
-- default. Population happens in a separate upsert job that a human
-- operator can review for per-deal correctness.

BEGIN;

ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS peak_sales_consensus_m NUMERIC(12, 2);

COMMENT ON COLUMN deals.peak_sales_consensus_m IS
  'Asset-specific peak-sales anchor in $M ($millions). '
  'Analyst consensus or 2024 10-K actual for mature drugs. '
  'NULL when asset peak is unknown — calculator/backtest falls through '
  'to indication-typical (INDICATION_MARKET_CAPS) or TA default. '
  'Sourced from data/asset-peak-sales.ts curated table. '
  'Added by migration 052 (R60 2026-04-14).';

-- Index for faster filtering when the calculator queries the deals table
-- for similar-asset peak-sales references.
CREATE INDEX IF NOT EXISTS idx_deals_peak_sales_consensus
  ON deals (peak_sales_consensus_m)
  WHERE peak_sales_consensus_m IS NOT NULL;

COMMIT;
