-- 170: one-off backlog allowance (lib/ai/spend-guard.ts backlogPlan). ai_spend_daily gains the 'backlog'
-- lane; ai_spend_backlog(p_since) returns what each source has drawn from it since the plan started.
ALTER TABLE public.ai_spend_daily DROP CONSTRAINT IF EXISTS ai_spend_daily_lane_check;
ALTER TABLE public.ai_spend_daily ADD CONSTRAINT ai_spend_daily_lane_check CHECK (lane IN ('interactive', 'search', 'core', 'bulk', 'backlog'));

CREATE OR REPLACE FUNCTION public.ai_spend_backlog(p_since date)
RETURNS TABLE(source text, usd numeric)
LANGUAGE sql STABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT source, sum(usd) FROM ai_spend_daily WHERE lane = 'backlog' AND day >= p_since GROUP BY source;
$function$;

REVOKE ALL ON FUNCTION public.ai_spend_backlog(date) FROM PUBLIC, anon, authenticated;
