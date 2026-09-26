-- Migration 134 — Post-delivery alerts for Deal Intelligence Brief owners.
--
-- Why: a delivered brief commits the client to a recommendation, a buyer
-- shortlist and a catalyst window, then goes quiet until the day-45
-- follow-up. While the decision is live the owner should hear, by email,
-- when a catalyst on the calendar approaches or passes, when a lead or
-- tension buyer signs a deal or shows partnering intent, and when a new
-- comparable deal lands in the asset's indication or mechanism.
--
-- benchmark_requests.alerts_opt_out_at — set by the signed opt-out link in
--   every alert email (/api/brief/alerts/opt-out?token=…). Requests with a
--   value here are never selected again.
-- brief_alerts — idempotency ledger, one row per (request, event) keyed by
--   dedupe_key. lib/brief/alerts.ts claims rows with an upsert that ignores
--   duplicates and sends a digest only for rows the run created. Sender: the
--   brief-alerts phase of /api/cron/radar-digest (13:00 UTC), on demand via
--   /api/cron/outcome-resolve?briefAlerts=true.
--
-- Reversal:
--   DROP TABLE IF EXISTS brief_alerts;
--   ALTER TABLE benchmark_requests DROP COLUMN IF EXISTS alerts_opt_out_at;

BEGIN;

ALTER TABLE benchmark_requests ADD COLUMN IF NOT EXISTS alerts_opt_out_at timestamptz;

COMMENT ON COLUMN benchmark_requests.alerts_opt_out_at IS 'When the brief owner opted out of post-delivery alerts through the signed link in an alert email. NULL = alerts on.';

CREATE TABLE IF NOT EXISTS brief_alerts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id      uuid NOT NULL REFERENCES benchmark_requests(id) ON DELETE CASCADE,
  kind            text NOT NULL CHECK (kind IN ('catalyst_approaching', 'catalyst_passed', 'buyer_deal', 'buyer_intent', 'new_comp')),
  subject_key     text,
  dedupe_key      text NOT NULL UNIQUE,
  email           text,
  payload         jsonb,
  delivery_status text NOT NULL DEFAULT 'queued' CHECK (delivery_status IN ('queued', 'sent', 'failed')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  sent_at         timestamptz
);

CREATE INDEX IF NOT EXISTS idx_brief_alerts_request_created ON brief_alerts (request_id, created_at DESC);

COMMENT ON TABLE  brief_alerts IS 'Sep 2026: one row per post-delivery alert item for a Deal Intelligence Brief owner (catalyst approaching/passed, buyer deal, buyer intent, new comp). Idempotency ledger for lib/brief/alerts.ts; a row is created by an upsert on dedupe_key and marked sent/failed after the digest email.';
COMMENT ON COLUMN brief_alerts.request_id IS 'benchmark_requests.id the brief was delivered for.';
COMMENT ON COLUMN brief_alerts.kind IS 'catalyst_approaching | catalyst_passed | buyer_deal | buyer_intent | new_comp.';
COMMENT ON COLUMN brief_alerts.subject_key IS 'What the item is about: NCT id / catalyst hash, deals.id, company_intent_signals.id.';
COMMENT ON COLUMN brief_alerts.dedupe_key IS 'Stable key, e.g. catalyst:<request>:<nct>:t30, buyer_deal:<request>:<deal>, buyer_intent:<request>:<signal>, new_comp:<request>:<deal>.';
COMMENT ON COLUMN brief_alerts.email IS 'Recipient at claim time (benchmark_requests.email).';
COMMENT ON COLUMN brief_alerts.payload IS 'What the email paragraph was rendered from.';
COMMENT ON COLUMN brief_alerts.delivery_status IS 'queued on claim; sent / failed after the digest send.';
COMMENT ON COLUMN brief_alerts.sent_at IS 'When SendGrid accepted the digest that carried this item.';

ALTER TABLE brief_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access brief_alerts" ON brief_alerts;
CREATE POLICY "Service role full access brief_alerts"
  ON brief_alerts FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMIT;
