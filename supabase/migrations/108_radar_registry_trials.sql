-- 108_radar_registry_trials.sql
--
-- Asset Radar Phase 2 item 5: ex-ClinicalTrials.gov registry coverage.
--
-- `registry_trials` is the raw, registry-native store for every trial pulled
-- from a non-CT.gov registry (CTIS, ISRCTN, ANZCTR, DRKS, ReBEC, PACTR,
-- MyTrial, IRCT, Health Canada, MFDS, jRCT, CDE, ChiCTR, CTRI, CRIS). One row
-- per (registry, registry_id). The shared mapper in
-- lib/ingestion/registries/index.ts reads these rows and either
--   (a) bridges them to an existing company_trials row when a secondary id is
--       an NCT number already ingested from CT.gov (mapped_company_trial_id is
--       set, no second company_trials row is created), or
--   (b) creates a company_trials row keyed `<REGISTRY>:<registry_id>`
--       (e.g. 'ISRCTN:12345678', 'CTIS:2024-512345-12-00').
--
-- WHO ICTRP is never stored here (non-commercial terms); it may only be used
-- as an id bridge.
--
-- Idempotent: safe to re-run.

BEGIN;

CREATE TABLE IF NOT EXISTS public.registry_trials (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  registry                 TEXT NOT NULL,          -- adapter id: 'ctis','isrctn','anzctr',...
  registry_id              TEXT NOT NULL,          -- native id without the registry prefix
  secondary_ids            TEXT[] NOT NULL DEFAULT '{}',  -- NCT / EUCT / ISRCTN / UTN bridges

  -- Core fields (registry-native, lightly normalised)
  title                    TEXT,
  sponsor_name             TEXT,
  sponsor_type             TEXT,                   -- INDUSTRY | OTHER | OTHER_GOV | NIH | FED | INDIV | NETWORK | CRO | UNKNOWN
  collaborators            TEXT[] NOT NULL DEFAULT '{}',
  interventions            JSONB NOT NULL DEFAULT '[]',   -- [{name, type, role}]
  conditions               TEXT[] NOT NULL DEFAULT '{}',
  phase_raw                TEXT,
  phase                    TEXT CHECK (phase IN ('early_phase_1', 'phase_1', 'phase_1_2', 'phase_2', 'phase_2_3', 'phase_3', 'phase_4', 'not_applicable', 'unknown')),
  status_raw               TEXT,
  status                   TEXT CHECK (status IN ('not_yet_recruiting', 'recruiting', 'enrolling_by_invitation', 'active_not_recruiting', 'suspended', 'terminated', 'completed', 'withdrawn', 'unknown')),
  study_type               TEXT,
  countries                TEXT[] NOT NULL DEFAULT '{}',  -- ISO 3166-1 alpha-2
  start_date               DATE,
  primary_completion_date  DATE,
  first_registered         DATE,
  last_updated             DATE,
  source_url               TEXT,

  -- Provenance
  raw                      JSONB,
  fetched_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  mapped_company_trial_id  UUID REFERENCES public.company_trials(id) ON DELETE SET NULL,
  map_status               TEXT,                   -- bridged | mapped | skipped:<reason> | error
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT registry_trials_registry_id_unique UNIQUE (registry, registry_id)
);

COMMENT ON TABLE public.registry_trials IS
  'Raw store for trials from non-ClinicalTrials.gov registries (Asset Radar Phase 2 item 5). One row per (registry, registry_id); mapped into company_trials by lib/ingestion/registries/index.ts.';
COMMENT ON COLUMN public.registry_trials.secondary_ids IS
  'Cross-registry identifiers (NCT, EUCT, ISRCTN, UTN, sponsor protocol codes). An NCT id already present in company_trials makes this row a bridge instead of a new company_trials row.';
COMMENT ON COLUMN public.registry_trials.sponsor_type IS
  'CT.gov-style lead sponsor class so the ex-US rows align with lead_sponsor_class from the CT.gov sweep: INDUSTRY, OTHER, OTHER_GOV, NIH, FED, INDIV, NETWORK, CRO, UNKNOWN.';

-- Columns added defensively in case an earlier draft of the table exists.
ALTER TABLE public.registry_trials
  ADD COLUMN IF NOT EXISTS study_type TEXT,
  ADD COLUMN IF NOT EXISTS map_status TEXT,
  ADD COLUMN IF NOT EXISTS mapped_company_trial_id UUID REFERENCES public.company_trials(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_registry_trials_sponsor_name
  ON public.registry_trials (sponsor_name);
CREATE INDEX IF NOT EXISTS idx_registry_trials_last_updated
  ON public.registry_trials (last_updated DESC);
CREATE INDEX IF NOT EXISTS idx_registry_trials_secondary_ids
  ON public.registry_trials USING GIN (secondary_ids);
CREATE INDEX IF NOT EXISTS idx_registry_trials_registry
  ON public.registry_trials (registry, fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_registry_trials_mapped
  ON public.registry_trials (mapped_company_trial_id)
  WHERE mapped_company_trial_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_registry_trials_unmapped
  ON public.registry_trials (registry)
  WHERE mapped_company_trial_id IS NULL;

-- updated_at maintenance (reuses the trigger function if one exists in the
-- project; otherwise defines a private one).
CREATE OR REPLACE FUNCTION public.registry_trials_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_registry_trials_updated_at ON public.registry_trials;
CREATE TRIGGER trg_registry_trials_updated_at
  BEFORE UPDATE ON public.registry_trials
  FOR EACH ROW EXECUTE FUNCTION public.registry_trials_touch_updated_at();

-- RLS: service_role only (pattern from migration 101). All reads go through
-- server-side route handlers and lib/ingestion/registries using the service
-- client; nothing reads this table with the anon/authenticated key.
ALTER TABLE public.registry_trials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read registry trials" ON public.registry_trials;
DROP POLICY IF EXISTS "Service role read registry trials" ON public.registry_trials;
CREATE POLICY "Service role read registry trials"
  ON public.registry_trials FOR SELECT
  TO service_role
  USING (true);

DROP POLICY IF EXISTS "Service role full access registry trials" ON public.registry_trials;
CREATE POLICY "Service role full access registry trials"
  ON public.registry_trials FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- The company_trials.nct_id column now also carries '<REGISTRY>:<id>' keys.
-- CT.gov rows keep bare NCT ids. This partial index makes the registry-keyed
-- rows cheap to find (e.g. for the asset indexer's provenance display).
CREATE INDEX IF NOT EXISTS idx_company_trials_registry_key
  ON public.company_trials (nct_id)
  WHERE nct_id LIKE '%:%';

COMMIT;
