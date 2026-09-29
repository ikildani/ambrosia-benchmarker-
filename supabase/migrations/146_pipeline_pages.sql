-- 146: company pipeline pages as a preclinical source (global).
--
-- Filings only reach SEC filers. Most preclinical and discovery programs sit
-- with private companies that publish a pipeline page. This adds the columns
-- the crawler needs (lib/ingestion/company-websites.ts finds the site and the
-- pipeline page; scripts/pipeline-crawler.ts reads it on GitHub Actions and
-- writes assets with asset_origin = 'pipeline_page' through the same match /
-- create path as filings).

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS website_source text,
  ADD COLUMN IF NOT EXISTS website_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS pipeline_page_url text,
  ADD COLUMN IF NOT EXISTS pipeline_page_status text,
  ADD COLUMN IF NOT EXISTS pipeline_page_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS pipeline_page_programs integer;

COMMENT ON COLUMN public.companies.website_source IS 'How website_url was found: web_search | press | filing | manual';
COMMENT ON COLUMN public.companies.pipeline_page_status IS 'Last crawl outcome: extracted | no_pipeline_page | no_programs | fetch_failed | blocked';

-- Crawl queue: industry companies with a site and no recent crawl.
CREATE INDEX IF NOT EXISTS idx_companies_pipeline_crawl
  ON public.companies (pipeline_page_checked_at NULLS FIRST)
  WHERE owner_type = 'industry' AND website_url IS NOT NULL AND merged_into IS NULL;

-- Discovery queue: industry companies without a site.
CREATE INDEX IF NOT EXISTS idx_companies_website_discovery
  ON public.companies (website_checked_at NULLS FIRST)
  WHERE owner_type = 'industry' AND website_url IS NULL AND merged_into IS NULL;

-- Pipeline-page rows carry the same disclosure fields a filing row does.
ALTER TABLE public.clinical_assets DROP CONSTRAINT IF EXISTS clinical_assets_filing_origin_cited;
ALTER TABLE public.clinical_assets ADD CONSTRAINT clinical_assets_filing_origin_cited
  CHECK (asset_origin NOT IN ('filing', 'pipeline_page') OR (disclosure_url IS NOT NULL AND disclosure_date IS NOT NULL AND disclosure_excerpt IS NOT NULL));

ALTER TABLE public.clinical_assets DROP CONSTRAINT IF EXISTS clinical_assets_partnership_basis_check;
ALTER TABLE public.clinical_assets ADD CONSTRAINT clinical_assets_partnership_basis_check
  CHECK (partnership_basis IS NULL OR partnership_basis IN ('deal_confirmed', 'press', 'trial_collaborator', 'drug_owner', 'filing', 'pipeline_page', 'no_evidence'));
