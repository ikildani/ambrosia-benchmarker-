-- 168: ai_spend_daily — one row per UTC day x lane x source x model, written by lib/ai/spend-guard.ts
-- after every Anthropic response. The guard reads today's totals (ai_spend_today) before each call
-- and refuses new calls once a lane's daily cap is reached. Service role only.
CREATE TABLE IF NOT EXISTS public.ai_spend_daily (
  day date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  lane text NOT NULL CHECK (lane IN ('interactive', 'core', 'bulk')),
  source text NOT NULL,
  model text NOT NULL,
  calls integer NOT NULL DEFAULT 0,
  blocked integer NOT NULL DEFAULT 0,
  input_tokens bigint NOT NULL DEFAULT 0,
  output_tokens bigint NOT NULL DEFAULT 0,
  usd numeric(12, 4) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (day, lane, source, model)
);

ALTER TABLE public.ai_spend_daily ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_spend_daily FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.ai_spend_record(
  p_lane text, p_source text, p_model text,
  p_calls integer, p_blocked integer, p_input bigint, p_output bigint, p_usd numeric)
RETURNS void
LANGUAGE sql
SET search_path TO 'public', 'pg_temp'
AS $function$
  INSERT INTO ai_spend_daily (day, lane, source, model, calls, blocked, input_tokens, output_tokens, usd, updated_at)
  VALUES ((now() AT TIME ZONE 'utc')::date, p_lane, p_source, p_model, p_calls, p_blocked, p_input, p_output, p_usd, now())
  ON CONFLICT (day, lane, source, model) DO UPDATE SET
    calls = ai_spend_daily.calls + excluded.calls,
    blocked = ai_spend_daily.blocked + excluded.blocked,
    input_tokens = ai_spend_daily.input_tokens + excluded.input_tokens,
    output_tokens = ai_spend_daily.output_tokens + excluded.output_tokens,
    usd = ai_spend_daily.usd + excluded.usd,
    updated_at = now();
$function$;

CREATE OR REPLACE FUNCTION public.ai_spend_today()
RETURNS TABLE(lane text, usd numeric)
LANGUAGE sql STABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT lane, sum(usd) FROM ai_spend_daily WHERE day = (now() AT TIME ZONE 'utc')::date GROUP BY lane;
$function$;

REVOKE ALL ON FUNCTION public.ai_spend_record(text, text, text, integer, integer, bigint, bigint, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ai_spend_today() FROM PUBLIC, anon, authenticated;
