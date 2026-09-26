-- Migration 137 — adaptive intake and automatic drafting
--
-- structure_prefs: answers to the follow-ups the intake asks once the client
-- picks a deal structure or territory (option fee and evaluation period,
-- cost-share appetite and co-promotion interest, a price floor for an
-- acquisition, whether Greater China rights are already licensed).
-- auto_draft_*: the intake now asks the generate route to build a DRAFT
-- immediately, so the intake call reviews a real draft; delivery still waits
-- for the Managing Partner's opinion.

ALTER TABLE benchmark_requests
  ADD COLUMN IF NOT EXISTS structure_prefs jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS auto_draft_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS auto_draft_status text;

COMMENT ON COLUMN benchmark_requests.structure_prefs IS 'Structure- and territory-specific intake answers (lib/brief/client-intake.ts structurePrefs); printed on the indicative term sheet.';
COMMENT ON COLUMN benchmark_requests.auto_draft_status IS 'requested | started | draft_ready | failed — set by the intake route and the generate route.';
