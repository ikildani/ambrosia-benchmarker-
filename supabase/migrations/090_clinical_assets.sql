-- Asset Radar Layer 1: Clinical Assets Universe
-- Canonical entity table for clinical-stage drug/biologic programs.
-- Bridges company_trials (ClinicalTrials.gov), deals, and research_signals
-- into a single asset lifecycle tracker.

-- ══════════════════════════════════════════════════════════════════════
-- CLINICAL ASSETS TABLE
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE clinical_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Ownership
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  company_name TEXT NOT NULL,

  -- Asset identity
  asset_name TEXT NOT NULL,
  asset_aliases TEXT[] DEFAULT '{}',
  mechanism TEXT,
  target TEXT,
  modality TEXT,
  therapeutic_area TEXT,

  -- Clinical stage
  indication_category TEXT,
  indication_specific TEXT,
  indications_all TEXT[] DEFAULT '{}',
  phase TEXT,
  phase_history JSONB DEFAULT '[]',
  trial_status TEXT,
  lead_nct_id TEXT,

  -- Trial cross-references
  nct_ids TEXT[] DEFAULT '{}',
  trial_count INTEGER DEFAULT 0,
  enrollment_total INTEGER DEFAULT 0,
  first_posted_date DATE,
  last_update_date DATE,

  -- Regulatory
  regulatory_designations TEXT[] DEFAULT '{}',
  fda_approval_date DATE,
  ema_approval_date DATE,

  -- Partnership status
  partnership_status TEXT DEFAULT 'unpartnered'
    CHECK (partnership_status IN ('unpartnered', 'partnered', 'partially_partnered', 'unknown')),
  partner_company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  partner_company_name TEXT,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  deal_ids UUID[] DEFAULT '{}',
  territory_rights_available TEXT[] DEFAULT '{}',

  -- Geography
  originator_country TEXT,
  originator_region TEXT,

  -- Scores (populated by downstream layers)
  licensing_intent_score NUMERIC DEFAULT 0,
  competitive_heat NUMERIC DEFAULT 0,
  deal_readiness_score NUMERIC DEFAULT 0,

  -- Data quality
  confidence_score INTEGER DEFAULT 0
    CHECK (confidence_score >= 0 AND confidence_score <= 100),
  data_sources TEXT[] DEFAULT '{}',
  last_enriched_at TIMESTAMPTZ,
  enrichment_version INTEGER DEFAULT 1,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_asset_company UNIQUE (company_name, asset_name)
);

-- ══════════════════════════════════════════════════════════════════════
-- INDEXES
-- ══════════════════════════════════════════════════════════════════════

CREATE INDEX idx_clinical_assets_company ON clinical_assets(company_id);
CREATE INDEX idx_clinical_assets_company_name ON clinical_assets(company_name);
CREATE INDEX idx_clinical_assets_asset_name ON clinical_assets(asset_name);
CREATE INDEX idx_clinical_assets_modality ON clinical_assets(modality);
CREATE INDEX idx_clinical_assets_phase ON clinical_assets(phase);
CREATE INDEX idx_clinical_assets_ta ON clinical_assets(therapeutic_area);
CREATE INDEX idx_clinical_assets_indication ON clinical_assets(indication_category);
CREATE INDEX idx_clinical_assets_partnership ON clinical_assets(partnership_status);
CREATE INDEX idx_clinical_assets_intent ON clinical_assets(licensing_intent_score DESC)
  WHERE partnership_status IN ('unpartnered', 'partially_partnered');
CREATE INDEX idx_clinical_assets_readiness ON clinical_assets(deal_readiness_score DESC)
  WHERE partnership_status IN ('unpartnered', 'partially_partnered');
CREATE INDEX idx_clinical_assets_heat ON clinical_assets(competitive_heat DESC);
CREATE INDEX idx_clinical_assets_updated ON clinical_assets(updated_at DESC);
CREATE INDEX idx_clinical_assets_country ON clinical_assets(originator_country)
  WHERE originator_country IS NOT NULL;

-- GIN indexes for array searches
CREATE INDEX idx_clinical_assets_aliases ON clinical_assets USING GIN (asset_aliases);
CREATE INDEX idx_clinical_assets_nct_ids ON clinical_assets USING GIN (nct_ids);
CREATE INDEX idx_clinical_assets_designations ON clinical_assets USING GIN (regulatory_designations);
CREATE INDEX idx_clinical_assets_indications_all ON clinical_assets USING GIN (indications_all);
CREATE INDEX idx_clinical_assets_sources ON clinical_assets USING GIN (data_sources);

-- Composite for common query: unpartnered assets in a specific TA/modality
CREATE INDEX idx_clinical_assets_radar_query
  ON clinical_assets(therapeutic_area, modality, phase, licensing_intent_score DESC)
  WHERE partnership_status IN ('unpartnered', 'partially_partnered');

-- ══════════════════════════════════════════════════════════════════════
-- RLS
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE clinical_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read clinical assets"
  ON clinical_assets FOR SELECT USING (true);

CREATE POLICY "Service role full access clinical assets"
  ON clinical_assets FOR ALL
  USING (auth.role() = 'service_role');

-- ══════════════════════════════════════════════════════════════════════
-- UPDATED_AT TRIGGER
-- ══════════════════════════════════════════════════════════════════════

CREATE TRIGGER update_clinical_assets_updated_at
  BEFORE UPDATE ON clinical_assets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ══════════════════════════════════════════════════════════════════════
-- UPDATE DATA_INGESTION_LOG SOURCE CONSTRAINT
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE data_ingestion_log DROP CONSTRAINT IF EXISTS data_ingestion_log_source_check;
