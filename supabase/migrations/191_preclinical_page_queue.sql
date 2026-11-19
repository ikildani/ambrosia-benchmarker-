-- 191: pipeline pages at scale (server-side fetch + Message Batches).
--
-- Why (Nov 18 2026): the Playwright pipeline crawler read ~10 companies a run with the
-- rule-based extractor after the backlog allowance ran out (Nov 11-17: 19 runs, 3 ok, 21
-- programs), and its queue was limited to Asian / Middle Eastern / Latin American companies.
-- 4,970 industry companies own feed programs and have a website; 3,776 of them have no
-- preclinical program. lib/ingestion/pipeline-pages-http.ts reads their pipeline pages
-- from the preclinical cron on Vercel and extracts through the Message Batches API.
--
-- 1. preclinical_page_batches: one row per submitted Message Batch, with the page text each
--    request carried (verbatim quotes are checked against it when the batch is drained).
-- 2. companies.pipeline_page_llm_at: when the page was last read by the model (server-side path).
--    The rule-based crawler's verdicts (no_programs, chart_only, heuristic 'extracted') do not
--    count as a read: 1,782 owner companies with such a status get the model pass.
-- 3. preclinical_page_targets(limit, recrawl_before): the crawl queue. Industry companies
--    that own at least one program and have a website, not read by the model since
--    recrawl_before, not waiting for the browser crawler (needs_render), and not given up on
--    recently (robots-blocked, wrong site, duplicate host, fetch failed, batch pending). Order: pages the
--    rule-based crawler found but could not read (chart_only, no_programs, extracted), then
--    never-checked sites, then sites where the browser crawler found no pipeline page; within
--    each, companies with no preclinical program first, then the busiest.
--
-- Idempotent. No data is changed.

CREATE TABLE IF NOT EXISTS public.preclinical_page_batches (
  batch_id      text PRIMARY KEY,
  status        text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'drained', 'failed')),
  model         text NOT NULL,
  request_count integer NOT NULL DEFAULT 0,
  items         jsonb NOT NULL DEFAULT '[]'::jsonb,
  summary       jsonb,
  submitted_at  timestamptz NOT NULL DEFAULT now(),
  drained_at    timestamptz
);

CREATE INDEX IF NOT EXISTS idx_preclinical_page_batches_open
  ON public.preclinical_page_batches (submitted_at) WHERE status = 'submitted';

ALTER TABLE public.preclinical_page_batches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.preclinical_page_batches FROM anon, authenticated;

COMMENT ON TABLE public.preclinical_page_batches IS
  'Message Batches of pipeline-page extractions (lib/ingestion/pipeline-pages-http.ts); items hold the page text each request carried; migration 191.';

ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS pipeline_page_llm_at timestamptz;
COMMENT ON COLUMN public.companies.pipeline_page_llm_at IS
  'When the pipeline page was last read by the model through lib/ingestion/pipeline-pages-http.ts; migration 191.';

COMMENT ON COLUMN public.companies.pipeline_page_status IS
  'Last crawl outcome: extracted | no_pipeline_page | no_programs | chart_only | fetch_failed | blocked | duplicate_host | site_mismatch | needs_render | batch_pending';

CREATE OR REPLACE FUNCTION public.preclinical_page_targets(
  p_limit int DEFAULT 60, p_recrawl_before timestamptz DEFAULT now() - interval '60 days')
RETURNS TABLE (id uuid, name text, website_url text, website_source text, pipeline_page_url text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT c.id, c.name, c.website_url, c.website_source, c.pipeline_page_url
  FROM companies c
  WHERE c.owner_type = 'industry' AND c.merged_into IS NULL
    AND c.website_url IS NOT NULL
    AND (c.pipeline_page_llm_at IS NULL OR c.pipeline_page_llm_at < p_recrawl_before)
    AND coalesce(c.pipeline_page_status, '') <> 'needs_render'
    AND NOT (coalesce(c.pipeline_page_status, '') IN ('blocked', 'site_mismatch', 'duplicate_host', 'batch_pending', 'fetch_failed')
             AND c.pipeline_page_checked_at >= p_recrawl_before)
    AND EXISTS (SELECT 1 FROM clinical_assets a WHERE a.company_id = c.id)
  ORDER BY
    CASE WHEN c.pipeline_page_status IN ('chart_only', 'no_programs', 'extracted') THEN 0
         WHEN c.pipeline_page_status IS NULL THEN 1
         ELSE 2 END,
    EXISTS (SELECT 1 FROM clinical_assets a WHERE a.company_id = c.id AND a.phase = 'preclinical') ASC,
    c.active_trials_count DESC NULLS LAST,
    c.id
  LIMIT greatest(p_limit, 0);
$function$;

REVOKE ALL ON FUNCTION public.preclinical_page_targets(int, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.preclinical_page_targets(int, timestamptz) TO service_role;
