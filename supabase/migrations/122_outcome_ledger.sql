-- Migration 122 — Outcome ledger (Alaric outcomes program, workstream 1).
--
-- Why: every number the platform commits to (calculator range, brief ask/floor,
-- Radar top-decile call) is written as a `predictions` row; the hourly
-- `outcome-resolve` cron matches newly ingested deals against open predictions
-- and writes `outcomes` (auto ≥ 0.8, review queue 0.5–0.8); clients can also
-- report first offer / signed terms. `accuracy_rollups` is materialised nightly
-- for the methodology page, the brief coverage block and the calculator line.
-- Spec: docs/alaric-outcomes-program.md — "Workstream 1: outcome ledger (design)".
--
-- Cursor: the resolver keeps its `deals.created_at` position in the existing
-- radar_sync_cursors table (source = 'outcome_resolve'); the seed row below
-- starts it at migration time so historical deals are never re-scanned.
--
-- Reversal:
--   DROP TABLE IF EXISTS accuracy_rollups; DROP TABLE IF EXISTS outcomes;
--   DROP TABLE IF EXISTS predictions; DELETE FROM radar_sync_cursors WHERE source = 'outcome_resolve';

BEGIN;

-- ══════════════════════════════════════════════════════════════════════
-- 1. predictions — one row per forecast the platform commits to
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS predictions (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source                 text NOT NULL CHECK (source IN ('calculator', 'brief', 'radar', 'share')),
  source_id              text,
  user_id                uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),

  -- entity keys
  company_id             uuid REFERENCES companies(id) ON DELETE SET NULL,
  asset_id               uuid REFERENCES clinical_assets(id) ON DELETE SET NULL,
  licensor_name          text,
  asset_name             text,
  indication             text,
  therapeutic_area       text,
  phase                  text,
  modality               text,
  deal_type              text,
  territory              text,

  -- predicted terms, $M (royalty in %)
  upfront_low            numeric,
  upfront_mid            numeric,
  upfront_high           numeric,
  total_low              numeric,
  total_mid              numeric,
  total_high             numeric,
  royalty_low            numeric,
  royalty_high           numeric,

  predicted_buyers       text[] NOT NULL DEFAULT '{}',
  predicted_window_start date,
  predicted_window_end   date,
  model_version          text,
  fingerprint            text,

  status                 text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'expired', 'withdrawn')),
  resolve_after          timestamptz NOT NULL DEFAULT (now() + interval '30 days')
);

CREATE INDEX IF NOT EXISTS idx_predictions_status_resolve_after ON predictions (status, resolve_after);
CREATE INDEX IF NOT EXISTS idx_predictions_licensor_name       ON predictions (licensor_name);
CREATE INDEX IF NOT EXISTS idx_predictions_licensor_name_lower ON predictions (lower(licensor_name));
CREATE INDEX IF NOT EXISTS idx_predictions_company_id          ON predictions (company_id);
CREATE INDEX IF NOT EXISTS idx_predictions_asset_id            ON predictions (asset_id);
CREATE INDEX IF NOT EXISTS idx_predictions_user_created        ON predictions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_predictions_dedupe              ON predictions (source, user_id, fingerprint, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_predictions_source_id           ON predictions (source, source_id);

COMMENT ON TABLE  predictions IS 'Sep 2026: outcome ledger — one row per forecast the platform commits to (calculator range, brief ask/floor, Radar top-decile call). Resolved by /api/cron/outcome-resolve against newly ingested deals.';
COMMENT ON COLUMN predictions.source IS 'Where the forecast came from: calculator | brief | radar | share.';
COMMENT ON COLUMN predictions.source_id IS 'calculations.id, benchmark_requests.id, clinical_assets.id or share token, depending on source.';
COMMENT ON COLUMN predictions.user_id IS 'Owner of the forecast (null for platform-generated Radar rows).';
COMMENT ON COLUMN predictions.updated_at IS 'Last status change.';
COMMENT ON COLUMN predictions.company_id IS 'Licensor companies.id when known.';
COMMENT ON COLUMN predictions.asset_id IS 'clinical_assets.id when the forecast is about a tracked asset (Radar).';
COMMENT ON COLUMN predictions.licensor_name IS 'Licensor name as entered / resolved; matched against deals.licensor_name plus companies.name_variations.';
COMMENT ON COLUMN predictions.asset_name IS 'Asset name when known (brief intake, Radar); used as match evidence only.';
COMMENT ON COLUMN predictions.indication IS 'Specific indication text.';
COMMENT ON COLUMN predictions.therapeutic_area IS 'Engine TA key (oncology, neurology, …).';
COMMENT ON COLUMN predictions.phase IS 'Engine phase key (preclinical, phase_1, …).';
COMMENT ON COLUMN predictions.modality IS 'Engine modality key.';
COMMENT ON COLUMN predictions.deal_type IS 'Deal structure the forecast assumes (license, option, …).';
COMMENT ON COLUMN predictions.territory IS 'Territory scope the forecast assumes.';
COMMENT ON COLUMN predictions.upfront_low IS 'Predicted upfront, $M, low end of the band.';
COMMENT ON COLUMN predictions.upfront_mid IS 'Predicted upfront, $M, point estimate (brief ask, calculator median).';
COMMENT ON COLUMN predictions.upfront_high IS 'Predicted upfront, $M, high end of the band.';
COMMENT ON COLUMN predictions.total_low IS 'Predicted total deal value, $M, low.';
COMMENT ON COLUMN predictions.total_mid IS 'Predicted total deal value, $M, point estimate.';
COMMENT ON COLUMN predictions.total_high IS 'Predicted total deal value, $M, high.';
COMMENT ON COLUMN predictions.royalty_low IS 'Predicted royalty, % (low tier).';
COMMENT ON COLUMN predictions.royalty_high IS 'Predicted royalty, % (high tier).';
COMMENT ON COLUMN predictions.predicted_buyers IS 'Buyer names the forecast named (brief: process.lead + process.tension).';
COMMENT ON COLUMN predictions.predicted_window_start IS 'Start of the predicted signing window (brief catalyst calendar; Radar: today).';
COMMENT ON COLUMN predictions.predicted_window_end IS 'End of the predicted signing window (Radar: today + 12 months).';
COMMENT ON COLUMN predictions.model_version IS 'Engine / brief / Radar model version that produced the numbers.';
COMMENT ON COLUMN predictions.fingerprint IS 'Input fingerprint used to dedupe repeat forecasts per user per 24 h.';
COMMENT ON COLUMN predictions.status IS 'open | resolved | expired | withdrawn.';
COMMENT ON COLUMN predictions.resolve_after IS 'Deals announced before this are never matched (default +30 d), so the deal that prompted the forecast cannot resolve it.';

-- ══════════════════════════════════════════════════════════════════════
-- 2. outcomes — what actually happened
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS outcomes (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_id          uuid NOT NULL REFERENCES predictions(id) ON DELETE CASCADE,
  deal_id                uuid REFERENCES deals(id) ON DELETE SET NULL,
  matched_by             text NOT NULL CHECK (matched_by IN ('auto', 'manual', 'client')),
  status                 text NOT NULL DEFAULT 'accepted' CHECK (status IN ('pending', 'accepted', 'rejected')),
  match_confidence       numeric CHECK (match_confidence IS NULL OR (match_confidence >= 0 AND match_confidence <= 1)),
  match_evidence         jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- actuals, $M (royalty in %)
  upfront_m              numeric,
  total_m                numeric,
  royalty_low            numeric,
  royalty_high           numeric,
  licensee_name          text,
  licensee_id            uuid REFERENCES companies(id) ON DELETE SET NULL,
  signed_date            date,
  deal_type              text,

  -- client-reported negotiation trail, $M
  first_offer_upfront_m  numeric,
  first_offer_total_m    numeric,
  our_ask_upfront_m      numeric,
  our_ask_total_m        numeric,

  -- derived (computeOutcomeMetrics in lib/outcomes/matcher.ts)
  abs_pct_error_upfront  numeric,
  abs_pct_error_total    numeric,
  within_band_upfront    boolean,
  within_band_total      boolean,
  buyer_hit              boolean,
  window_hit             boolean,
  value_captured_m       numeric,

  created_at             timestamptz NOT NULL DEFAULT now(),
  resolved_at            timestamptz,
  reviewed_by            text,
  notes                  text
);

CREATE INDEX IF NOT EXISTS idx_outcomes_prediction_id ON outcomes (prediction_id);
CREATE INDEX IF NOT EXISTS idx_outcomes_deal_id       ON outcomes (deal_id);
CREATE INDEX IF NOT EXISTS idx_outcomes_pending       ON outcomes (created_at DESC) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_outcomes_resolved_at   ON outcomes (resolved_at DESC) WHERE status = 'accepted';
-- One candidate row per (prediction, deal); the review queue never shows duplicates.
CREATE UNIQUE INDEX IF NOT EXISTS uq_outcomes_prediction_deal ON outcomes (prediction_id, deal_id) WHERE deal_id IS NOT NULL;

COMMENT ON TABLE  outcomes IS 'Sep 2026: outcome ledger — what actually happened for a prediction: an auto-matched deal (accepted ≥ 0.8, pending 0.5–0.8 for admin review), a manual admin link, or a client-reported result.';
COMMENT ON COLUMN outcomes.prediction_id IS 'The forecast this outcome resolves.';
COMMENT ON COLUMN outcomes.deal_id IS 'deals.id when a deal row exists; null for client-reported outcomes not yet in the database.';
COMMENT ON COLUMN outcomes.matched_by IS 'auto (resolver) | manual (admin) | client (POST /api/outcomes/report).';
COMMENT ON COLUMN outcomes.status IS 'pending (review queue, 0.5–0.8) | accepted (counts in rollups) | rejected.';
COMMENT ON COLUMN outcomes.match_confidence IS 'scoreMatch() result 0–1 for auto matches.';
COMMENT ON COLUMN outcomes.match_evidence IS 'Per-component scores and the matched fields (identity, indication, phase, resolve_after gate).';
COMMENT ON COLUMN outcomes.upfront_m IS 'Actual upfront, $M (deals.upfront_usd / 1e6 or client-reported).';
COMMENT ON COLUMN outcomes.total_m IS 'Actual total deal value, $M.';
COMMENT ON COLUMN outcomes.royalty_low IS 'Actual royalty low tier, %.';
COMMENT ON COLUMN outcomes.royalty_high IS 'Actual royalty high tier, %.';
COMMENT ON COLUMN outcomes.licensee_name IS 'Counterparty name as signed.';
COMMENT ON COLUMN outcomes.licensee_id IS 'Counterparty companies.id when resolved.';
COMMENT ON COLUMN outcomes.signed_date IS 'Announced / signed date.';
COMMENT ON COLUMN outcomes.deal_type IS 'Actual structure (license, option, acquisition, …).';
COMMENT ON COLUMN outcomes.first_offer_upfront_m IS 'Client-reported first offer received, upfront $M.';
COMMENT ON COLUMN outcomes.first_offer_total_m IS 'Client-reported first offer received, total $M.';
COMMENT ON COLUMN outcomes.our_ask_upfront_m IS 'Client-reported opening ask, upfront $M.';
COMMENT ON COLUMN outcomes.our_ask_total_m IS 'Client-reported opening ask, total $M.';
COMMENT ON COLUMN outcomes.abs_pct_error_upfront IS '|actual − predicted mid| / actual for upfront (0–∞, 0.2 = 20%).';
COMMENT ON COLUMN outcomes.abs_pct_error_total IS '|actual − predicted mid| / actual for total deal value.';
COMMENT ON COLUMN outcomes.within_band_upfront IS 'Actual upfront inside the predicted low–high band.';
COMMENT ON COLUMN outcomes.within_band_total IS 'Actual total inside the predicted low–high band.';
COMMENT ON COLUMN outcomes.buyer_hit IS 'Licensee is one of predicted_buyers (name / alias match).';
COMMENT ON COLUMN outcomes.window_hit IS 'signed_date inside predicted_window_start–end; null when no window was predicted.';
COMMENT ON COLUMN outcomes.value_captured_m IS 'signed total − first offer total ($M; upfront pair when totals are missing). Null unless both reported.';
COMMENT ON COLUMN outcomes.resolved_at IS 'When the outcome was accepted (auto, admin, or client).';
COMMENT ON COLUMN outcomes.reviewed_by IS 'Admin email or "resolver" / "client".';
COMMENT ON COLUMN outcomes.notes IS 'Free text from admin or client.';

-- ══════════════════════════════════════════════════════════════════════
-- 3. accuracy_rollups — materialised nightly
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS accuracy_rollups (
  key                       text PRIMARY KEY,
  source                    text,
  therapeutic_area          text,
  phase                     text,
  model_version             text,
  "window"                  text NOT NULL CHECK ("window" IN ('90d', '365d', 'all')),
  n                         integer NOT NULL DEFAULT 0,
  n_expired                 integer NOT NULL DEFAULT 0,
  median_ape_upfront        numeric,
  median_ape_total          numeric,
  within_band_rate_upfront  numeric,
  within_band_rate_total    numeric,
  buyer_hit_rate            numeric,
  window_hit_rate           numeric,
  value_captured_total_m    numeric NOT NULL DEFAULT 0,
  computed_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_accuracy_rollups_dims ON accuracy_rollups (source, therapeutic_area, phase, "window");

COMMENT ON TABLE  accuracy_rollups IS 'Sep 2026: nightly materialisation of accepted outcomes by source × TA × phase × model_version × window. Null dimension = all. Read by GET /api/outcomes/accuracy.';
COMMENT ON COLUMN accuracy_rollups.key IS 'source|ta|phase|model|window with * for "all"; the upsert key.';
COMMENT ON COLUMN accuracy_rollups.source IS 'Prediction source or null for all sources.';
COMMENT ON COLUMN accuracy_rollups.therapeutic_area IS 'TA key or null for all.';
COMMENT ON COLUMN accuracy_rollups.phase IS 'Phase key or null for all.';
COMMENT ON COLUMN accuracy_rollups.model_version IS 'Model version or null for all.';
COMMENT ON COLUMN accuracy_rollups."window" IS '90d | 365d | all — by outcomes.resolved_at.';
COMMENT ON COLUMN accuracy_rollups.n IS 'Accepted outcomes in the cell.';
COMMENT ON COLUMN accuracy_rollups.n_expired IS 'Expired predictions in the cell (count against window_hit_rate only).';
COMMENT ON COLUMN accuracy_rollups.median_ape_upfront IS 'Median absolute percentage error on upfront (0.2 = 20%).';
COMMENT ON COLUMN accuracy_rollups.median_ape_total IS 'Median absolute percentage error on total deal value.';
COMMENT ON COLUMN accuracy_rollups.within_band_rate_upfront IS 'Share of outcomes with actual upfront inside the predicted band.';
COMMENT ON COLUMN accuracy_rollups.within_band_rate_total IS 'Share of outcomes with actual total inside the predicted band.';
COMMENT ON COLUMN accuracy_rollups.buyer_hit_rate IS 'Share of outcomes where the licensee was a predicted buyer (among predictions that named buyers).';
COMMENT ON COLUMN accuracy_rollups.window_hit_rate IS 'Share of (outcomes + expired) where signing fell inside the predicted window.';
COMMENT ON COLUMN accuracy_rollups.value_captured_total_m IS 'Sum of value_captured_m over client-reported outcomes, $M.';
COMMENT ON COLUMN accuracy_rollups.computed_at IS 'When the cell was last materialised.';

-- ══════════════════════════════════════════════════════════════════════
-- 4. Resolver cursor (existing radar_sync_cursors table)
-- ══════════════════════════════════════════════════════════════════════

INSERT INTO radar_sync_cursors (source, cursor, state)
VALUES ('outcome_resolve', now()::text, '{"note":"deals.created_at position of /api/cron/outcome-resolve"}'::jsonb)
ON CONFLICT (source) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════════
-- 5. RLS
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE predictions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE outcomes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE accuracy_rollups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access predictions" ON predictions;
CREATE POLICY "Service role full access predictions"
  ON predictions FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Users read own predictions" ON predictions;
CREATE POLICY "Users read own predictions"
  ON predictions FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Service role full access outcomes" ON outcomes;
CREATE POLICY "Service role full access outcomes"
  ON outcomes FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Users read own outcomes" ON outcomes;
CREATE POLICY "Users read own outcomes"
  ON outcomes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM predictions p WHERE p.id = outcomes.prediction_id AND p.user_id = auth.uid()));

DROP POLICY IF EXISTS "Service role full access accuracy_rollups" ON accuracy_rollups;
CREATE POLICY "Service role full access accuracy_rollups"
  ON accuracy_rollups FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Public read accuracy_rollups" ON accuracy_rollups;
CREATE POLICY "Public read accuracy_rollups"
  ON accuracy_rollups FOR SELECT TO anon, authenticated USING (true);

COMMIT;
