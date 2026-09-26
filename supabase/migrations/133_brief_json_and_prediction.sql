-- Migration 133 — persist the Deal Intelligence Brief as data and link its prediction
--
-- Until now a generated BriefIntelligence lived only in the PDF: the data room could
-- show links but not the call, and nothing after delivery (alerts, the scored call,
-- "your model vs Solidus") could read what the brief said. The generate route now
-- stores the full brief and the outcome-ledger prediction it registered.

ALTER TABLE benchmark_requests
  ADD COLUMN IF NOT EXISTS brief_json jsonb,
  ADD COLUMN IF NOT EXISTS prediction_id uuid REFERENCES predictions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_benchmark_requests_prediction_id ON benchmark_requests (prediction_id);

COMMENT ON COLUMN benchmark_requests.brief_json IS 'Full BriefIntelligence (lib/brief/types.ts) as generated; read by the data room, alerts and follow-ups. Never served publicly.';
COMMENT ON COLUMN benchmark_requests.prediction_id IS 'predictions.id written by recordBriefPrediction at generation; the row the client sees scored.';
