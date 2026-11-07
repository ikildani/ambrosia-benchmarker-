-- 159: Row-level security on the eight public tables the Supabase advisor
-- flagged (2026-10-20). With RLS off and default grants, anyone holding the
-- public anon key could read and write them through PostgREST.
--
-- Every app path that touches these tables uses the service-role client
-- (app/api/benchmark/intake, lib/ingestion/fda-orphan, indication top-up,
-- scripts/radar-launch-email), which bypasses RLS. The two functions that read
-- radar_ta_keywords / radar_country_region (radar_fill_ta_from_conditions,
-- radar_quality_backfill_batch) run from service-role crons. So no policies
-- are added: anon and authenticated get nothing, service role is unaffected.

alter table public.insights_articles           enable row level security;
alter table public.shape_reports               enable row level security;
alter table public.brief_topups                enable row level security;
alter table public.radar_owner_type_retype_log enable row level security;
alter table public.radar_launch_email_sends    enable row level security;
alter table public.asset_designations          enable row level security;
alter table public.radar_country_region        enable row level security;
alter table public.radar_ta_keywords           enable row level security;

-- Belt and braces: drop the default client grants as well.
revoke all on table
  public.insights_articles, public.shape_reports, public.brief_topups,
  public.radar_owner_type_retype_log, public.radar_launch_email_sends,
  public.asset_designations, public.radar_country_region, public.radar_ta_keywords
from anon, authenticated;
