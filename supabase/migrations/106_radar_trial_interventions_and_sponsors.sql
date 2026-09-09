-- Asset Radar Phase 2.1: sponsor-agnostic ClinicalTrials.gov sweep
--
-- 1. trial_interventions — every intervention of every swept trial with its
--    arm role, so comparator / background arms (pembrolizumab in a biotech
--    combo) no longer become the biotech's asset. Replaces the
--    `interventions[0]` collapse in company_trials.intervention_name.
-- 2. sponsor_aliases — every lead-sponsor string seen on CT.gov, its
--    normalized form, and the company it resolves to (or NULL for CROs and
--    unresolved sponsors). Read before companies on every sweep page.
-- 3. companies — owner_type (industry / academic / ...), the CT.gov
--    LeadSponsorClass, the registry that created the row, first trial date.
-- 4. company_trials — lead sponsor name/class, registry, why_stopped,
--    study_type; a partial unique index so CRO-led trials with no industry
--    collaborator (company_id NULL) can still be upserted idempotently.
-- 5. radar_find_companies_by_name() — case-insensitive company lookup by
--    name or name_variations for a batch of sponsor names.
--
-- Everything here is idempotent.

-- ══════════════════════════════════════════════════════════════════════
-- 1. TRIAL INTERVENTIONS
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS trial_interventions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nct_id            TEXT NOT NULL,
  company_id        UUID REFERENCES companies(id) ON DELETE SET NULL,
  name              TEXT NOT NULL,
  name_normalized   TEXT NOT NULL,
  intervention_type TEXT,
  arm_role          TEXT NOT NULL DEFAULT 'unknown'
    CHECK (arm_role IN ('experimental', 'active_comparator', 'placebo_comparator', 'sham', 'no_intervention', 'other', 'unknown')),
  other_names       TEXT[] NOT NULL DEFAULT '{}',
  description       TEXT,
  is_primary_asset  BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_trial_intervention UNIQUE (nct_id, name_normalized)
);

COMMENT ON TABLE trial_interventions IS
  'One row per intervention per ClinicalTrials.gov study (sponsor-agnostic sweep). arm_role comes from armGroups.type; is_primary_asset marks drug-class experimental-arm interventions that plausibly belong to the attributed company.';
COMMENT ON COLUMN trial_interventions.company_id IS
  'Company the trial is attributed to (same as company_trials.company_id). NULL when the lead sponsor is a CRO with no industry collaborator.';

CREATE INDEX IF NOT EXISTS idx_trial_interventions_nct
  ON trial_interventions (nct_id);
CREATE INDEX IF NOT EXISTS idx_trial_interventions_company_primary
  ON trial_interventions (company_id, name_normalized)
  WHERE is_primary_asset = true;
CREATE INDEX IF NOT EXISTS idx_trial_interventions_company
  ON trial_interventions (company_id)
  WHERE company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trial_interventions_name_normalized
  ON trial_interventions (name_normalized);

DROP TRIGGER IF EXISTS update_trial_interventions_updated_at ON trial_interventions;
CREATE TRIGGER update_trial_interventions_updated_at
  BEFORE UPDATE ON trial_interventions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE trial_interventions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access trial interventions" ON trial_interventions;
CREATE POLICY "Service role full access trial interventions"
  ON trial_interventions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ══════════════════════════════════════════════════════════════════════
-- 2. SPONSOR ALIASES
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS sponsor_aliases (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_name            TEXT NOT NULL,
  sponsor_name_normalized TEXT NOT NULL,
  company_id              UUID REFERENCES companies(id) ON DELETE SET NULL,
  relationship            TEXT NOT NULL DEFAULT 'unknown'
    CHECK (relationship IN ('self', 'subsidiary', 'former_name', 'cro', 'academic', 'government', 'hospital', 'unknown')),
  lead_sponsor_class      TEXT,
  first_seen_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  trial_count             INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT unique_sponsor_alias UNIQUE (sponsor_name_normalized)
);

COMMENT ON TABLE sponsor_aliases IS
  'Every lead-sponsor string seen on a registry, normalized, and the company it resolves to. relationship=cro rows never own assets. Edit company_id / relationship by hand to correct a resolution; the sweep honours existing rows.';

CREATE INDEX IF NOT EXISTS idx_sponsor_aliases_company
  ON sponsor_aliases (company_id) WHERE company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sponsor_aliases_relationship
  ON sponsor_aliases (relationship);

ALTER TABLE sponsor_aliases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access sponsor aliases" ON sponsor_aliases;
CREATE POLICY "Service role full access sponsor aliases"
  ON sponsor_aliases FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ══════════════════════════════════════════════════════════════════════
-- 3. COMPANIES: OWNER TYPE + PROVENANCE
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS owner_type TEXT DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS lead_sponsor_class TEXT,
  ADD COLUMN IF NOT EXISTS source_registry TEXT,
  ADD COLUMN IF NOT EXISTS first_seen_trial_at DATE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'companies_owner_type_check'
  ) THEN
    ALTER TABLE companies
      ADD CONSTRAINT companies_owner_type_check
      CHECK (owner_type IN ('industry', 'academic', 'government', 'hospital', 'network', 'cro', 'other', 'unknown'));
  END IF;
END $$;

COMMENT ON COLUMN companies.owner_type IS
  'Who owns the trials attributed to this row: industry, academic, government, hospital, network (cooperative group / consortium), cro (never owns assets), other, unknown.';
COMMENT ON COLUMN companies.lead_sponsor_class IS
  'CT.gov LeadSponsorClass seen when the row was created or last swept (INDUSTRY, OTHER, NIH, FED, NETWORK, INDIV, OTHER_GOV, AMBIG, UNKNOWN).';
COMMENT ON COLUMN companies.source_registry IS
  'Registry whose sweep created this row (ctgov, ctis, ...). NULL for rows created by the seed list / deal ingestion.';

CREATE INDEX IF NOT EXISTS idx_companies_owner_type ON companies (owner_type);
-- Case-insensitive exact-name lookup used by radar_find_companies_by_name().
CREATE INDEX IF NOT EXISTS idx_companies_name_lower ON companies (lower(name));

-- ══════════════════════════════════════════════════════════════════════
-- 4. COMPANY TRIALS: SPONSOR PROVENANCE + ORPHAN UPSERT KEY
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE company_trials
  ADD COLUMN IF NOT EXISTS lead_sponsor_name TEXT,
  ADD COLUMN IF NOT EXISTS lead_sponsor_class TEXT,
  ADD COLUMN IF NOT EXISTS registry TEXT DEFAULT 'ctgov',
  ADD COLUMN IF NOT EXISTS why_stopped TEXT,
  ADD COLUMN IF NOT EXISTS study_type TEXT;

COMMENT ON COLUMN company_trials.lead_sponsor_name IS
  'Verbatim lead sponsor from the registry. company_id may point elsewhere (industry collaborator) when the lead sponsor is a CRO.';

-- UNIQUE (company_id, nct_id) does not dedupe NULL company_id rows (NULLs are
-- distinct). Trials the sweep cannot attribute to any company are keyed on
-- nct_id alone so re-runs update instead of duplicating.
CREATE UNIQUE INDEX IF NOT EXISTS idx_company_trials_orphan_nct
  ON company_trials (nct_id) WHERE company_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_company_trials_last_update
  ON company_trials (last_update_posted DESC);
CREATE INDEX IF NOT EXISTS idx_company_trials_lead_sponsor_class
  ON company_trials (lead_sponsor_class);

-- ══════════════════════════════════════════════════════════════════════
-- 5. BATCH COMPANY LOOKUP BY NAME
-- ══════════════════════════════════════════════════════════════════════

-- For each input name returns the best matching company: exact
-- case-insensitive match on companies.name first, then an exact match on any
-- name_variations entry (GIN idx_companies_name_variations). One row per
-- input name that matched; unmatched names are simply absent.
CREATE OR REPLACE FUNCTION radar_find_companies_by_name(p_names TEXT[])
RETURNS TABLE(
  matched_name TEXT,
  id UUID,
  name TEXT,
  owner_type TEXT,
  headquarters_country TEXT
) AS $$
  SELECT DISTINCT ON (n.name)
    n.name AS matched_name,
    c.id,
    c.name,
    c.owner_type,
    c.headquarters_country
  FROM unnest(p_names) AS n(name)
  JOIN companies c
    ON lower(c.name) = lower(n.name)
    OR c.name_variations @> ARRAY[n.name]
  ORDER BY n.name, (lower(c.name) = lower(n.name)) DESC, c.created_at ASC;
$$ LANGUAGE sql STABLE;

COMMENT ON FUNCTION radar_find_companies_by_name(TEXT[]) IS
  'Batch case-insensitive company lookup by name / name_variations. Used by lib/ingestion/ctgov-sweep.ts sponsor resolution.';
