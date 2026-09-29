-- 147: regulatory designations as a preclinical source and as asset evidence.
--
-- The FDA orphan drug database exports every designation since 1983 with the
-- sponsor company and country; EMA publishes its orphan designations too.
-- A designation is granted on a scientific rationale, often before any trial
-- is registered, so a designation with no matching trial is a preclinical
-- program in the public record. lib/ingestion/fda-orphan.ts stores each
-- designation here, matches the sponsor to a company and the drug to an
-- asset, and creates assets (asset_origin = 'designation') when the sponsor
-- has no asset for that drug. No model calls; free.

CREATE TABLE IF NOT EXISTS public.asset_designations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency text NOT NULL CHECK (agency IN ('fda', 'ema')),
  designation_type text NOT NULL DEFAULT 'orphan' CHECK (designation_type IN ('orphan', 'breakthrough', 'fast_track', 'rmat', 'prime', 'rare_pediatric')),
  designation_key text NOT NULL,
  generic_name text NOT NULL,
  generic_key text NOT NULL,
  trade_name text,
  indication text,
  designated_at date,
  status text,
  withdrawn_at date,
  approved_at date,
  approved_indication text,
  sponsor_name text NOT NULL,
  sponsor_country text,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  asset_id uuid REFERENCES public.clinical_assets(id) ON DELETE SET NULL,
  match_status text NOT NULL DEFAULT 'unmatched' CHECK (match_status IN ('matched', 'created', 'no_company', 'approved_skip', 'unmatched')),
  source_url text,
  raw jsonb,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agency, designation_key)
);

CREATE INDEX IF NOT EXISTS idx_asset_designations_company ON public.asset_designations (company_id);
CREATE INDEX IF NOT EXISTS idx_asset_designations_asset ON public.asset_designations (asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_designations_generic ON public.asset_designations (generic_key);

ALTER TABLE public.clinical_assets DROP CONSTRAINT IF EXISTS clinical_assets_asset_origin_check;
ALTER TABLE public.clinical_assets ADD CONSTRAINT clinical_assets_asset_origin_check
  CHECK (asset_origin IN ('registry', 'filing', 'pipeline_page', 'press', 'designation', 'user'));

ALTER TABLE public.clinical_assets DROP CONSTRAINT IF EXISTS clinical_assets_filing_origin_cited;
ALTER TABLE public.clinical_assets ADD CONSTRAINT clinical_assets_filing_origin_cited
  CHECK (asset_origin NOT IN ('filing', 'pipeline_page', 'designation') OR (disclosure_url IS NOT NULL AND disclosure_date IS NOT NULL AND disclosure_excerpt IS NOT NULL));

COMMENT ON TABLE public.asset_designations IS 'Regulatory designations (FDA orphan first) with sponsor; a preclinical source when no trial exists and evidence on assets otherwise.';
