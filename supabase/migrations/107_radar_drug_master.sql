-- 107_radar_drug_master.sql
--
-- Asset Radar Phase 2 item 3: drug master entity.
--
-- clinical_assets is keyed on (company_name, asset_name), where asset_name is
-- whatever string the trial sponsor typed into ClinicalTrials.gov. That means
-- "MK-3475 (pembrolizumab)", "Pembrolizumab (MK-3475)", "KEYTRUDA" and
-- "pembrolizumab 200 mg" are four assets, a combination is one asset, and the
-- same drug run by two sponsors is two unrelated assets. Citeline and Cortellis
-- key everything on one drug node; this migration adds that node.
--
--   drug_master    one row per drug (or per combination of drugs), carrying the
--                  free public identifiers: UNII (NCATS GSRS), ChEMBL ID,
--                  PubChem CID, CAS, NCIt, DrugBank.
--   drug_aliases   every name ever seen for the drug (INN, code names, brands,
--                  synonyms, external ids) with a normalized matching key.
--   drug_owners    link table: which company holds which role in the drug.
--   clinical_assets.drug_master_id + resolution bookkeeping.
--
-- Resolution is performed by lib/radar/drug-master.ts (cron
-- /api/cron/drug-resolve). Rows with source='internal' and confidence 30 are
-- drugs we could not match to any public identifier; they still exist so
-- assets can be keyed and de-duplicated by name.
--
-- Idempotent: safe to re-run.

BEGIN;

-- ── 1. drug_master ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.drug_master (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  preferred_name         text NOT NULL,
  inn                    text,
  unii                   text,
  chembl_id              text,
  ncit_code              text,
  pubchem_cid            bigint,
  drugbank_id            text,
  cas_number             text,
  -- lib/radar/vocab.ts RADAR_MODALITY_OPTIONS values only
  modality               text,
  target                 text,
  mechanism              text,
  -- highest development phase seen for this drug anywhere (phase slug or 'approved')
  max_phase              text,
  is_combination         boolean NOT NULL DEFAULT false,
  component_drug_ids     uuid[] NOT NULL DEFAULT '{}',
  originator_company_id  uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  -- 'gsrs', 'chembl', 'pubchem', 'gsrs+chembl', 'internal', 'combination', 'manual'
  source                 text NOT NULL DEFAULT 'internal',
  confidence             integer NOT NULL DEFAULT 0,
  -- last time GSRS/ChEMBL/PubChem were queried for this row; internal rows are
  -- re-checked at most every 30 days
  external_checked_at    timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.drug_master ADD COLUMN IF NOT EXISTS external_checked_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'drug_master_confidence_range'
  ) THEN
    ALTER TABLE public.drug_master
      ADD CONSTRAINT drug_master_confidence_range CHECK (confidence >= 0 AND confidence <= 100);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'drug_master_modality_vocab'
  ) THEN
    ALTER TABLE public.drug_master
      ADD CONSTRAINT drug_master_modality_vocab CHECK (
        modality IS NULL OR modality IN (
          'small_molecule', 'antibody', 'adc', 'bispecific', 'car_t', 'cell_therapy',
          'gene_therapy', 'mrna', 'peptide', 'oligonucleotide', 'radiopharm', 'vaccine'
        )
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'drug_master_unii_format'
  ) THEN
    ALTER TABLE public.drug_master
      ADD CONSTRAINT drug_master_unii_format CHECK (unii IS NULL OR unii ~ '^[A-Z0-9]{10}$');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'drug_master_chembl_format'
  ) THEN
    ALTER TABLE public.drug_master
      ADD CONSTRAINT drug_master_chembl_format CHECK (chembl_id IS NULL OR chembl_id ~ '^CHEMBL[0-9]+$');
  END IF;
END $$;

-- External identifiers are unique when present; the resolver reuses the row.
CREATE UNIQUE INDEX IF NOT EXISTS idx_drug_master_unii
  ON public.drug_master (unii) WHERE unii IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_drug_master_chembl
  ON public.drug_master (chembl_id) WHERE chembl_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_drug_master_pubchem
  ON public.drug_master (pubchem_cid) WHERE pubchem_cid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_drug_master_preferred_name_lower
  ON public.drug_master (lower(preferred_name));
CREATE INDEX IF NOT EXISTS idx_drug_master_inn_lower
  ON public.drug_master (lower(inn)) WHERE inn IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_drug_master_modality
  ON public.drug_master (modality) WHERE modality IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_drug_master_combination
  ON public.drug_master (is_combination) WHERE is_combination;
CREATE INDEX IF NOT EXISTS idx_drug_master_components
  ON public.drug_master USING GIN (component_drug_ids);
CREATE INDEX IF NOT EXISTS idx_drug_master_source_updated
  ON public.drug_master (source, updated_at);

DROP TRIGGER IF EXISTS update_drug_master_updated_at ON public.drug_master;
CREATE TRIGGER update_drug_master_updated_at
  BEFORE UPDATE ON public.drug_master
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.drug_master IS
  'One node per drug (or drug combination) carrying free public identifiers (UNII, ChEMBL, PubChem, CAS). clinical_assets.drug_master_id keys assets on it. Written by lib/radar/drug-master.ts. source=internal, confidence=30 means no public identifier was found; the row exists so assets can still be keyed.';
COMMENT ON COLUMN public.drug_master.component_drug_ids IS
  'For is_combination rows: sorted ids of the component drug_master rows.';

-- ── 2. drug_aliases ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.drug_aliases (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drug_id           uuid NOT NULL REFERENCES public.drug_master(id) ON DELETE CASCADE,
  alias             text NOT NULL,
  -- lib/radar/drug-name.ts normalizeKey(): lowercase, non-alphanumerics removed
  alias_normalized  text NOT NULL,
  alias_type        text NOT NULL DEFAULT 'synonym',
  -- 'gsrs', 'chembl', 'pubchem', 'clinicaltrials', 'internal', 'manual'
  source            text NOT NULL DEFAULT 'internal',
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT drug_aliases_unique_per_drug UNIQUE (alias_normalized, drug_id)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'drug_aliases_type_check'
  ) THEN
    ALTER TABLE public.drug_aliases
      ADD CONSTRAINT drug_aliases_type_check CHECK (
        alias_type IN ('inn', 'code', 'brand', 'synonym', 'cas', 'unii', 'chembl', 'other')
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'drug_aliases_normalized_nonempty'
  ) THEN
    ALTER TABLE public.drug_aliases
      ADD CONSTRAINT drug_aliases_normalized_nonempty CHECK (char_length(alias_normalized) > 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_drug_aliases_normalized
  ON public.drug_aliases (alias_normalized);
CREATE INDEX IF NOT EXISTS idx_drug_aliases_drug
  ON public.drug_aliases (drug_id);
CREATE INDEX IF NOT EXISTS idx_drug_aliases_type_normalized
  ON public.drug_aliases (alias_type, alias_normalized);

COMMENT ON TABLE public.drug_aliases IS
  'Every name seen for a drug_master row. alias_normalized is the matching key (lowercase, alphanumerics only) so MK-3475 = MK3475 = mk 3475. Also serves as the persistent cache for external lookups.';

-- ── 3. drug_owners ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.drug_owners (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drug_id        uuid NOT NULL REFERENCES public.drug_master(id) ON DELETE CASCADE,
  company_id     uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  role           text NOT NULL DEFAULT 'unknown',
  -- 'global' unless a deal carves out a territory
  territory      text NOT NULL DEFAULT 'global',
  -- 'clinical_asset', 'deal', 'trial', 'press_release', 'manual'
  evidence_type  text,
  evidence_id    uuid,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT drug_owners_unique UNIQUE (drug_id, company_id, role, territory)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'drug_owners_role_check'
  ) THEN
    ALTER TABLE public.drug_owners
      ADD CONSTRAINT drug_owners_role_check CHECK (
        role IN ('originator', 'licensee', 'co_developer', 'unknown')
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_drug_owners_drug ON public.drug_owners (drug_id);
CREATE INDEX IF NOT EXISTS idx_drug_owners_company ON public.drug_owners (company_id);

DROP TRIGGER IF EXISTS update_drug_owners_updated_at ON public.drug_owners;
CREATE TRIGGER update_drug_owners_updated_at
  BEFORE UPDATE ON public.drug_owners
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.drug_owners IS
  'Which company holds which role in a drug. One drug can have several owners (originator plus licensees by territory). Written by the drug-resolve cron from clinical_assets; the partnership detector (Phase 2 item 7) refines roles from deals.';

-- ── 4. clinical_assets: key on the drug node ─────────────────────────────────

ALTER TABLE public.clinical_assets
  ADD COLUMN IF NOT EXISTS drug_master_id uuid REFERENCES public.drug_master(id) ON DELETE SET NULL;
ALTER TABLE public.clinical_assets
  ADD COLUMN IF NOT EXISTS drug_resolution_status text NOT NULL DEFAULT 'unresolved';
ALTER TABLE public.clinical_assets
  ADD COLUMN IF NOT EXISTS drug_resolution_confidence integer;
ALTER TABLE public.clinical_assets
  ADD COLUMN IF NOT EXISTS drug_resolved_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'clinical_assets_drug_resolution_status_check'
  ) THEN
    ALTER TABLE public.clinical_assets
      ADD CONSTRAINT clinical_assets_drug_resolution_status_check CHECK (
        drug_resolution_status IN ('unresolved', 'resolved', 'ambiguous', 'unresolvable')
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'clinical_assets_drug_resolution_confidence_range'
  ) THEN
    ALTER TABLE public.clinical_assets
      ADD CONSTRAINT clinical_assets_drug_resolution_confidence_range CHECK (
        drug_resolution_confidence IS NULL
        OR (drug_resolution_confidence >= 0 AND drug_resolution_confidence <= 100)
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_clinical_assets_drug_master
  ON public.clinical_assets (drug_master_id) WHERE drug_master_id IS NOT NULL;
-- Resolver queue: oldest unresolved first, then stale ambiguous.
CREATE INDEX IF NOT EXISTS idx_clinical_assets_drug_resolution_queue
  ON public.clinical_assets (drug_resolution_status, created_at);
CREATE INDEX IF NOT EXISTS idx_clinical_assets_drug_resolved_at
  ON public.clinical_assets (drug_resolved_at) WHERE drug_resolved_at IS NOT NULL;

COMMENT ON COLUMN public.clinical_assets.drug_master_id IS
  'Drug node this asset is keyed on (migration 107). Two assets from different companies with the same drug_master_id are the same drug under two owners.';
COMMENT ON COLUMN public.clinical_assets.drug_resolution_status IS
  'unresolved = not yet attempted; resolved = matched to a public identifier; ambiguous = several drug nodes matched (retried after 30 days); unresolvable = no public identifier (internal node) or not a drug (placebo, procedure, device: drug_master_id stays NULL).';

-- ── 5. RLS: service_role only (pattern from migration 101) ───────────────────

ALTER TABLE public.drug_master ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access drug master" ON public.drug_master;
CREATE POLICY "Service role full access drug master"
  ON public.drug_master FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE public.drug_aliases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access drug aliases" ON public.drug_aliases;
CREATE POLICY "Service role full access drug aliases"
  ON public.drug_aliases FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE public.drug_owners ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access drug owners" ON public.drug_owners;
CREATE POLICY "Service role full access drug owners"
  ON public.drug_owners FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMIT;
