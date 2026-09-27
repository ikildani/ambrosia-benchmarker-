-- 128_company_patents_uspto_odp.sql
--
-- PatentsView's search API was retired into the USPTO Open Data Portal in
-- 2026 (the old host no longer resolves). lib/ingestion/patents-assignee.ts
-- now reads ODP's patent application search, which returns published
-- applications as well as grants, keyed by application number. Rows carry
-- source 'uspto_odp'; the old 'patentsview' value stays valid for history.
--
-- Apply after 127. Idempotent.

ALTER TABLE public.company_patents DROP CONSTRAINT IF EXISTS company_patents_source_check;
ALTER TABLE public.company_patents ADD CONSTRAINT company_patents_source_check
  CHECK (source IN ('patentsview', 'uspto_odp'));
ALTER TABLE public.company_patents ALTER COLUMN source SET DEFAULT 'uspto_odp';

COMMENT ON COLUMN public.company_patents.patent_id IS
  'USPTO application number (uspto_odp rows; stable across publication and grant) or granted patent number (legacy patentsview rows).';
COMMENT ON COLUMN public.company_patents.source IS
  'uspto_odp = USPTO Open Data Portal application search (2026+); patentsview = the retired PatentsView search API.';
