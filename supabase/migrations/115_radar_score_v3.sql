-- 115: Asset Radar scoring v3 — calibrated licensing-intent model + backtest harness
--
-- Scoring v2 (migration 103) is a hand-weighted composite: on Sep 15 the
-- production maximum was 34/100 across 68,857 scored assets and nothing
-- reached 50, so the score did not separate assets. v3 replaces the composite
-- with a calibrated probability learned from the deals table:
--
--   P(asset that is unpartnered at t is licensed, optioned, acquired or
--     co-developed within (t, t + 12 months])
--
-- The nine v2 detectors stay as evidence producers and as the fallback when
-- no model is active. This migration adds:
--
--   1. radar_score_models     — one row per trained model (params JSONB,
--                                feature names, windows); exactly one active.
--   2. radar_score_backtests  — one row per backtest run; the shape mirrors
--                                ScoreBacktestSummary in lib/radar/types.ts.
--   3. radar_score_snapshots  — monthly reconstructed feature vectors with
--                                labels (training data; as_of cutoffs enforced
--                                in lib/radar/backtest/features.ts).
--   4. radar_score_label_events — every (asset, deal) pair that counts as a
--                                positive label, with the match kind, so labels
--                                are auditable.
--   5. asset_signal_snapshots.model_version and
--      clinical_assets.score_model_version — which model produced the number.
--
-- No intelligence table is readable by the anon key (gap register rule);
-- every table here is service-role only. The methodology API reads through
-- the service client and exposes summary numbers only.

-- ══════════════════════════════════════════════════════════════════════
-- 1. Models
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS radar_score_models (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version       TEXT NOT NULL UNIQUE,
  trained_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- ModelParams from lib/radar/backtest/model.ts: weights, bias, means, stds,
  -- sign constraints, calibration, sampling prior correction.
  params        JSONB NOT NULL,
  feature_names TEXT[] NOT NULL,
  train_window  JSONB NOT NULL DEFAULT '{}'::jsonb,   -- {from, to}
  test_window   JSONB NOT NULL DEFAULT '{}'::jsonb,   -- {from, to}
  is_active     BOOLEAN NOT NULL DEFAULT false,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- At most one active model at a time.
CREATE UNIQUE INDEX IF NOT EXISTS uq_radar_score_models_active
  ON radar_score_models ((is_active)) WHERE is_active = true;

COMMENT ON TABLE radar_score_models IS
  'Trained licensing-intent models (scoring v3). The active row is loaded once per licensing-signals run; when none is active the v2 weighted composite is used.';
COMMENT ON COLUMN radar_score_models.params IS
  'ModelParams (lib/radar/backtest/model.ts): standardization means/stds, monotone-constrained logistic weights, bias, calibration (platt|isotonic), negative-sampling prior correction, feature_version.';

-- ══════════════════════════════════════════════════════════════════════
-- 2. Backtests
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS radar_score_backtests (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_version        TEXT NOT NULL,
  run_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  train_window         JSONB NOT NULL,                 -- {from, to}
  test_window          JSONB NOT NULL,                 -- {from, to}
  n_train              INTEGER NOT NULL,
  n_test               INTEGER NOT NULL,
  positives_test       INTEGER NOT NULL,
  roc_auc              NUMERIC(6,4),
  pr_auc               NUMERIC(6,4),
  precision_at_50      NUMERIC(6,4),
  precision_at_100     NUMERIC(6,4),
  lift_top_decile      NUMERIC(8,3),
  brier                NUMERIC(8,6),
  calibration_bins     JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{bin, predicted, observed, n}]
  factor_importance    JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{factor, importance}]
  low_power            BOOLEAN NOT NULL DEFAULT false,
  activated            BOOLEAN NOT NULL DEFAULT false,
  raw_predictions_path TEXT,
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_radar_score_backtests_run_at
  ON radar_score_backtests (run_at DESC);
CREATE INDEX IF NOT EXISTS idx_radar_score_backtests_model
  ON radar_score_backtests (model_version, run_at DESC);

COMMENT ON TABLE radar_score_backtests IS
  'One row per backtest run of the licensing-intent model. Shape = ScoreBacktestSummary (lib/radar/types.ts). low_power=true when the temporal holdout has fewer than 30 positives; the numbers are still written, never inflated.';
COMMENT ON COLUMN radar_score_backtests.raw_predictions_path IS
  'Where the per-row test predictions sample lives (radar_score_snapshots.prediction for the model_version, or a storage path). NULL when only the summary was kept.';

-- ══════════════════════════════════════════════════════════════════════
-- 3. Reconstructed monthly snapshots (training data)
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS radar_score_snapshots (
  asset_id          UUID NOT NULL REFERENCES clinical_assets(id) ON DELETE CASCADE,
  as_of             DATE NOT NULL,
  feature_version   TEXT NOT NULL,
  company_id        UUID,
  phase             TEXT,
  -- {feature_name: number|null}; null = no source row dated <= as_of
  features          JSONB NOT NULL,
  completeness      NUMERIC(5,4) NOT NULL DEFAULT 0,
  label             SMALLINT NOT NULL CHECK (label IN (0, 1)),
  label_deal_id     UUID,
  label_deal_date   DATE,
  -- true for every row of an asset that has at least one positive month
  -- (kept in full); negatives are asset-level subsampled — see sampling_rate.
  is_positive_asset BOOLEAN NOT NULL DEFAULT false,
  sampling_rate     NUMERIC(6,4) NOT NULL DEFAULT 1,
  -- Filled by the latest backtest for its test rows (raw predictions sample).
  prediction        NUMERIC(7,6),
  prediction_model  TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (asset_id, as_of, feature_version)
);

CREATE INDEX IF NOT EXISTS idx_radar_score_snapshots_as_of
  ON radar_score_snapshots (feature_version, as_of);
CREATE INDEX IF NOT EXISTS idx_radar_score_snapshots_label
  ON radar_score_snapshots (feature_version, label) WHERE label = 1;
CREATE INDEX IF NOT EXISTS idx_radar_score_snapshots_company
  ON radar_score_snapshots (company_id);

COMMENT ON TABLE radar_score_snapshots IS
  'Monthly (2022-01 .. 2025-09) feature vectors reconstructed with as_of cutoffs: no feature reads a row dated after as_of. label=1 when a canonical license/option/acquisition/co_development deal by the owning company on this asset was announced in (as_of, as_of+12mo]. Negatives are asset-level subsampled at sampling_rate; the model corrects the intercept by ln(sampling_rate).';

-- ══════════════════════════════════════════════════════════════════════
-- 4. Label events (auditable positives)
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS radar_score_label_events (
  asset_id       UUID NOT NULL REFERENCES clinical_assets(id) ON DELETE CASCADE,
  deal_id        UUID NOT NULL,
  announced_date DATE NOT NULL,
  deal_type      TEXT,
  match_kind     TEXT,           -- exact | code | overlap (lib/radar/partnership.ts matchAssetName)
  licensor_match TEXT,           -- id | name
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (asset_id, deal_id)
);

CREATE INDEX IF NOT EXISTS idx_radar_score_label_events_date
  ON radar_score_label_events (announced_date);

COMMENT ON TABLE radar_score_label_events IS
  'Every (asset, deal) pair that counts as a positive label for the licensing-intent backtest. Rebuilt from the deals table by /api/cron/score-backtest; delete rows and reset the cursor to rebuild.';

-- ══════════════════════════════════════════════════════════════════════
-- 5. Model version on scored rows
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE asset_signal_snapshots
  ADD COLUMN IF NOT EXISTS model_version TEXT;

ALTER TABLE clinical_assets
  ADD COLUMN IF NOT EXISTS score_model_version TEXT;

COMMENT ON COLUMN asset_signal_snapshots.model_version IS
  'radar_score_models.version that produced licensing_intent_score, or "v2-composite" when the weighted fallback was used. factor_scores holds ScoreFactorContribution[] (lib/radar/types.ts) for that version.';
COMMENT ON COLUMN asset_signal_snapshots.factor_scores IS
  'v3: JSON array of ScoreFactorContribution {factor, weight, score, points, confidence, evidence_text, evidence_url, evidence_date, sources_checked}. Model rows: points are logit contributions (sum = logit incl. the intercept row); fallback rows: points = score x weight x phase x availability (sum = composite).';
COMMENT ON COLUMN clinical_assets.score_model_version IS
  'Model version behind licensing_intent_score (same values as asset_signal_snapshots.model_version).';

-- ══════════════════════════════════════════════════════════════════════
-- RLS — service role only
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE radar_score_models        ENABLE ROW LEVEL SECURITY;
ALTER TABLE radar_score_backtests     ENABLE ROW LEVEL SECURITY;
ALTER TABLE radar_score_snapshots     ENABLE ROW LEVEL SECURITY;
ALTER TABLE radar_score_label_events  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access score models" ON radar_score_models;
CREATE POLICY "Service role full access score models"
  ON radar_score_models FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access score backtests" ON radar_score_backtests;
CREATE POLICY "Service role full access score backtests"
  ON radar_score_backtests FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access score snapshots" ON radar_score_snapshots;
CREATE POLICY "Service role full access score snapshots"
  ON radar_score_snapshots FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access score label events" ON radar_score_label_events;
CREATE POLICY "Service role full access score label events"
  ON radar_score_label_events FOR ALL TO service_role USING (true) WITH CHECK (true);
