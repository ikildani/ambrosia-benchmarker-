-- 178: point the pipeline crawler at companies from chosen regions.
--
-- Why (Nov 3 2026): owner asked to spend the remaining pipeline-pages allowance on Asian,
-- Middle Eastern and Latin American company sites, where buy-side clients see least.
-- companies.hq_region is mostly empty, so a company's region is the most common
-- originator_region of its industry assets. China: 2,583 such companies, 252 with a known site;
-- the free discovery chain (trial contacts, Wikidata, domain guessing) failed on 1,868.
--
-- pipeline_region_targets(regions, mode, limit, recrawl_before)
--   mode 'discover': no website yet and not already web-searched without a result
--                    (website_source = 'web_search_none'), busiest first.
--   mode 'crawl':    website known, pipeline page not checked since recrawl_before, never-checked first.

CREATE OR REPLACE FUNCTION public.pipeline_region_targets(
  p_regions text[], p_mode text, p_limit int DEFAULT 100, p_recrawl_before timestamptz DEFAULT now() - interval '30 days')
RETURNS TABLE (id uuid, name text, hq_country text, indications_active text[], active_trials_count int,
               website_url text, pipeline_page_url text, region text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH cr AS (
    SELECT company_id, mode() WITHIN GROUP (ORDER BY originator_region) r
    FROM clinical_assets
    WHERE owner_type = 'industry' AND originator_region IS NOT NULL AND company_id IS NOT NULL
    GROUP BY company_id)
  SELECT c.id, c.name, c.hq_country, c.indications_active, c.active_trials_count,
         c.website_url, c.pipeline_page_url, cr.r
  FROM cr JOIN companies c ON c.id = cr.company_id
  WHERE cr.r = ANY (p_regions)
    AND c.owner_type = 'industry' AND c.merged_into IS NULL
    AND CASE p_mode
          WHEN 'discover' THEN c.website_url IS NULL AND coalesce(c.website_source, '') <> 'web_search_none'
          WHEN 'crawl' THEN c.website_url IS NOT NULL AND (c.pipeline_page_checked_at IS NULL OR c.pipeline_page_checked_at < p_recrawl_before)
          ELSE false
        END
  ORDER BY CASE WHEN p_mode = 'crawl' THEN c.pipeline_page_checked_at END ASC NULLS FIRST,
           c.active_trials_count DESC NULLS LAST, c.id
  LIMIT greatest(p_limit, 0);
$function$;

REVOKE ALL ON FUNCTION public.pipeline_region_targets(text[], text, int, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pipeline_region_targets(text[], text, int, timestamptz) TO service_role;
