-- 169: Comp set reports, the web page the "your comp set" email links to.
--
-- The calculation-convert cron builds a comparable-deal set from
-- deals_verified for a user's latest benchmark and stores it here as a
-- snapshot, so the link always shows exactly what the email summarised. The
-- page /comps/<token> renders it in the Deal Intelligence Brief format.
--
-- Access is by unguessable token through the service role only: RLS is on
-- with no policies, so anon and authenticated clients cannot list or read
-- rows. Views are counted so the owner can see who opened their comp set.

CREATE TABLE IF NOT EXISTS public.comp_set_reports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token           text NOT NULL UNIQUE,
  user_id         uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  calculation_id  uuid,
  report          jsonb NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL DEFAULT (now() + interval '180 days'),
  view_count      integer NOT NULL DEFAULT 0,
  first_viewed_at timestamptz,
  last_viewed_at  timestamptz
);

CREATE INDEX IF NOT EXISTS idx_comp_set_reports_user ON public.comp_set_reports (user_id, created_at DESC);

ALTER TABLE public.comp_set_reports ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.comp_set_reports IS
  'Snapshot comparable-deal sets behind /comps/<token> (migration 169). Read and written by the service role only.';
