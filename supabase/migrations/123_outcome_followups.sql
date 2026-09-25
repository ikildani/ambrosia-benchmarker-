-- Migration 123 — Brief outcome follow-ups (Alaric outcomes program, workstream 2).
--
-- Why: 45 and 120 days after a Deal Intelligence Brief is delivered
-- (benchmark_requests.delivered_at) the client gets one plain email asking for
-- the outcome — first offer, our ask, signed terms, licensee — with a signed
-- link into /outcomes/report/<token>. This table makes the send idempotent:
-- one row per (request, stage), written only after SendGrid accepts the mail.
-- Sender: the outcome phase of /api/cron/deal-verification at 02:00 UTC
-- (lib/outcomes/followups.ts). A request whose prediction already carries a
-- client-reported outcome is skipped and no row is written.
--
-- Reversal: DROP TABLE IF EXISTS outcome_followups;

BEGIN;

CREATE TABLE IF NOT EXISTS outcome_followups (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id     uuid NOT NULL REFERENCES benchmark_requests(id) ON DELETE CASCADE,
  prediction_id  uuid REFERENCES predictions(id) ON DELETE SET NULL,
  stage          integer NOT NULL CHECK (stage IN (45, 120)),
  email          text NOT NULL,
  sent_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_outcome_followups_request_stage UNIQUE (request_id, stage)
);

CREATE INDEX IF NOT EXISTS idx_outcome_followups_prediction ON outcome_followups (prediction_id);

COMMENT ON TABLE  outcome_followups IS 'Sep 2026: one row per brief follow-up email sent (day 45 / day 120 after delivery) asking the client for the deal outcome. Idempotency ledger for lib/outcomes/followups.ts.';
COMMENT ON COLUMN outcome_followups.request_id IS 'benchmark_requests.id the brief was delivered for.';
COMMENT ON COLUMN outcome_followups.prediction_id IS 'predictions.id (source = brief) the form reports against.';
COMMENT ON COLUMN outcome_followups.stage IS 'Days after delivery the email is scheduled for: 45 | 120.';
COMMENT ON COLUMN outcome_followups.email IS 'Recipient at send time (benchmark_requests.email).';
COMMENT ON COLUMN outcome_followups.sent_at IS 'When SendGrid accepted the message.';

ALTER TABLE outcome_followups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access outcome_followups" ON outcome_followups;
CREATE POLICY "Service role full access outcome_followups"
  ON outcome_followups FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMIT;
