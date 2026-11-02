-- 175: when CT.gov was last asked about a trial by id (lib/ingestion/ctgov-recheck.ts).
-- The sweep walks LastUpdatePostDate order and never revisits a study whose date does not move;
-- the re-check pass asks CT.gov about quiet open trials, oldest check first, about once a month.
-- Applied to production 2026-10-30 ahead of the PR.
ALTER TABLE public.company_trials ADD COLUMN IF NOT EXISTS status_checked_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_company_trials_open_recheck
  ON public.company_trials (status_checked_at NULLS FIRST)
  WHERE status IN ('recruiting', 'active_not_recruiting', 'not_yet_recruiting', 'enrolling_by_invitation');
