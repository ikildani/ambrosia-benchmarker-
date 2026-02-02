-- Partner Matching Schema for Deal Calculator
-- Migration: 002_partner_matching.sql

-- =============================================
-- Companies (Pharma/Biotech profiles)
-- =============================================
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Basic Info
  name TEXT NOT NULL,
  name_variations TEXT[] DEFAULT '{}',
  ticker TEXT,
  company_type TEXT CHECK (company_type IN ('large_pharma', 'mid_pharma', 'large_biotech', 'mid_biotech', 'specialty')),
  hq_country TEXT,
  hq_region TEXT,
  website_url TEXT,

  -- Therapeutic Focus (derived from deals + trials)
  modalities_active TEXT[] DEFAULT '{}',
  modalities_primary TEXT[] DEFAULT '{}',
  indications_active TEXT[] DEFAULT '{}',
  indications_specific TEXT[] DEFAULT '{}',

  -- Deal Preferences (derived from historical deals)
  phase_preference_min TEXT,
  phase_preference_max TEXT,
  avg_upfront_usd NUMERIC,
  median_upfront_usd NUMERIC,
  territory_focus TEXT[] DEFAULT '{}',

  -- Activity Signals
  deals_last_12mo INTEGER DEFAULT 0,
  deals_last_24mo INTEGER DEFAULT 0,
  active_trials_count INTEGER DEFAULT 0,
  pipeline_assets_count INTEGER DEFAULT 0,
  hiring_bd_roles BOOLEAN DEFAULT false,
  last_deal_date DATE,
  last_deal_modality TEXT,
  last_deal_indication TEXT,

  -- Patent Cliff Data
  patent_cliffs JSONB DEFAULT '[]',
  revenue_at_risk_2025 NUMERIC,
  revenue_at_risk_2026 NUMERIC,
  revenue_at_risk_2027 NUMERIC,

  -- Strategic Priorities (from pipeline pages, press)
  strategic_priorities TEXT[] DEFAULT '{}',
  recent_announcements JSONB DEFAULT '[]',

  -- Status
  actively_acquiring BOOLEAN DEFAULT true,
  acquisition_appetite TEXT CHECK (acquisition_appetite IN ('aggressive', 'moderate', 'selective', 'inactive')),
  data_quality_score INTEGER DEFAULT 0 CHECK (data_quality_score >= 0 AND data_quality_score <= 100),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_enriched_at TIMESTAMPTZ,
  data_sources TEXT[] DEFAULT '{}',

  CONSTRAINT unique_company_name UNIQUE (name)
);

-- Indexes for fast matching
CREATE INDEX idx_companies_name ON companies (name);
CREATE INDEX idx_companies_name_variations ON companies USING GIN (name_variations);
CREATE INDEX idx_companies_modalities ON companies USING GIN (modalities_active);
CREATE INDEX idx_companies_modalities_primary ON companies USING GIN (modalities_primary);
CREATE INDEX idx_companies_indications ON companies USING GIN (indications_active);
CREATE INDEX idx_companies_indications_specific ON companies USING GIN (indications_specific);
CREATE INDEX idx_companies_type ON companies (company_type);
CREATE INDEX idx_companies_actively_acquiring ON companies (actively_acquiring);
CREATE INDEX idx_companies_deals_12mo ON companies (deals_last_12mo DESC);
CREATE INDEX idx_companies_deals_24mo ON companies (deals_last_24mo DESC);
CREATE INDEX idx_companies_data_quality ON companies (data_quality_score DESC);
CREATE INDEX idx_companies_appetite ON companies (acquisition_appetite);

-- =============================================
-- Historical Deals
-- =============================================
CREATE TABLE deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Parties
  licensor_name TEXT NOT NULL,
  licensor_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  licensee_name TEXT NOT NULL,
  licensee_id UUID REFERENCES companies(id) ON DELETE SET NULL,

  -- Asset Info
  asset_name TEXT,
  asset_description TEXT,
  modality TEXT NOT NULL,
  indication_category TEXT,
  indication_specific TEXT,
  target TEXT,
  mechanism_of_action TEXT,

  -- Deal Parameters
  phase_at_signing TEXT NOT NULL CHECK (phase_at_signing IN ('discovery', 'preclinical', 'phase_1', 'phase_2', 'phase_3', 'approved', 'unknown')),
  territory TEXT,
  territories_included TEXT[] DEFAULT '{}',
  exclusivity TEXT CHECK (exclusivity IN ('exclusive', 'co_exclusive', 'non_exclusive', 'unknown')),
  deal_type TEXT CHECK (deal_type IN ('license', 'option', 'collaboration', 'acquisition', 'co_development', 'co_promotion', 'other')),

  -- Financial Terms (when available)
  upfront_usd NUMERIC,
  milestones_total_usd NUMERIC,
  milestones_development_usd NUMERIC,
  milestones_regulatory_usd NUMERIC,
  milestones_commercial_usd NUMERIC,
  royalty_low_pct NUMERIC,
  royalty_high_pct NUMERIC,
  total_deal_value_usd NUMERIC,
  equity_investment_usd NUMERIC,

  -- Rights
  includes_manufacturing BOOLEAN DEFAULT false,
  includes_co_development BOOLEAN DEFAULT false,
  includes_co_promotion BOOLEAN DEFAULT false,
  option_exercise_fee NUMERIC,

  -- Metadata
  announced_date DATE NOT NULL,
  effective_date DATE,
  source_type TEXT CHECK (source_type IN ('sec_8k', 'sec_10k', 'sec_10q', 'press_release', 'clinicaltrials', 'manual', 'other')),
  source_url TEXT,
  source_filing_id TEXT,
  press_release_url TEXT,

  -- Data Quality
  terms_disclosed BOOLEAN DEFAULT false,
  confidence_score INTEGER DEFAULT 0 CHECK (confidence_score >= 0 AND confidence_score <= 100),
  verified BOOLEAN DEFAULT false,
  verification_notes TEXT,

  -- Extraction metadata
  raw_text_excerpt TEXT,
  extraction_model TEXT,
  extraction_timestamp TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_deal UNIQUE (licensor_name, licensee_name, asset_name, announced_date)
);

-- Indexes
CREATE INDEX idx_deals_licensee ON deals (licensee_id);
CREATE INDEX idx_deals_licensee_name ON deals (licensee_name);
CREATE INDEX idx_deals_licensor ON deals (licensor_id);
CREATE INDEX idx_deals_licensor_name ON deals (licensor_name);
CREATE INDEX idx_deals_modality ON deals (modality);
CREATE INDEX idx_deals_indication ON deals (indication_category);
CREATE INDEX idx_deals_indication_specific ON deals (indication_specific);
CREATE INDEX idx_deals_phase ON deals (phase_at_signing);
CREATE INDEX idx_deals_announced ON deals (announced_date DESC);
CREATE INDEX idx_deals_deal_type ON deals (deal_type);
CREATE INDEX idx_deals_source_filing ON deals (source_filing_id);
CREATE INDEX idx_deals_confidence ON deals (confidence_score DESC);
CREATE INDEX idx_deals_upfront ON deals (upfront_usd DESC NULLS LAST);

-- =============================================
-- Company Trials (Pipeline Tracking)
-- =============================================
CREATE TABLE company_trials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,

  -- Trial Info
  nct_id TEXT NOT NULL,
  trial_title TEXT,
  trial_acronym TEXT,
  brief_summary TEXT,

  -- Asset/Intervention
  intervention_name TEXT,
  intervention_type TEXT,
  modality TEXT,
  target TEXT,

  -- Therapeutic Area
  indication_category TEXT,
  indication_specific TEXT,
  conditions TEXT[] DEFAULT '{}',

  -- Development Stage
  phase TEXT CHECK (phase IN ('early_phase_1', 'phase_1', 'phase_1_2', 'phase_2', 'phase_2_3', 'phase_3', 'phase_4', 'not_applicable', 'unknown')),
  status TEXT CHECK (status IN ('not_yet_recruiting', 'recruiting', 'enrolling_by_invitation', 'active_not_recruiting', 'suspended', 'terminated', 'completed', 'withdrawn', 'unknown')),

  -- Collaboration
  is_collaboration BOOLEAN DEFAULT false,
  collaborator_names TEXT[] DEFAULT '{}',
  lead_sponsor_type TEXT,

  -- Geography
  locations_countries TEXT[] DEFAULT '{}',
  enrollment_count INTEGER,

  -- Dates
  start_date DATE,
  primary_completion_date DATE,
  completion_date DATE,
  first_posted_date DATE,
  last_update_posted DATE,

  -- Metadata
  results_available BOOLEAN DEFAULT false,
  has_results_submitted BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_company_trial UNIQUE (company_id, nct_id)
);

CREATE INDEX idx_company_trials_company ON company_trials (company_id);
CREATE INDEX idx_company_trials_company_name ON company_trials (company_name);
CREATE INDEX idx_company_trials_nct ON company_trials (nct_id);
CREATE INDEX idx_company_trials_modality ON company_trials (modality);
CREATE INDEX idx_company_trials_indication ON company_trials (indication_category);
CREATE INDEX idx_company_trials_indication_specific ON company_trials (indication_specific);
CREATE INDEX idx_company_trials_phase ON company_trials (phase);
CREATE INDEX idx_company_trials_status ON company_trials (status);
CREATE INDEX idx_company_trials_collaboration ON company_trials (is_collaboration);

-- =============================================
-- Partner Match Results (Tracking)
-- =============================================
CREATE TABLE partner_match_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Context
  user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  anonymous_id TEXT,
  calculation_id UUID REFERENCES calculations(id) ON DELETE SET NULL,

  -- Input Parameters (denormalized for analysis)
  input_modality TEXT NOT NULL,
  input_phase TEXT NOT NULL,
  input_indication_category TEXT,
  input_indication_specific TEXT,
  input_territory TEXT,

  -- Results
  matches_total INTEGER NOT NULL,
  matches_shown INTEGER NOT NULL,
  match_results JSONB NOT NULL DEFAULT '[]',

  -- Top matches summary (for quick analytics)
  top_match_company TEXT,
  top_match_score INTEGER,
  avg_match_score NUMERIC,

  -- User Context
  user_tier TEXT CHECK (user_tier IN ('free', 'pro')),

  -- Engagement
  partners_clicked TEXT[] DEFAULT '{}',
  partners_expanded TEXT[] DEFAULT '{}',
  upgrade_cta_clicked BOOLEAN DEFAULT false,
  advisory_cta_clicked BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_partner_matches_user ON partner_match_results (user_id);
CREATE INDEX idx_partner_matches_anonymous ON partner_match_results (anonymous_id);
CREATE INDEX idx_partner_matches_calculation ON partner_match_results (calculation_id);
CREATE INDEX idx_partner_matches_modality ON partner_match_results (input_modality);
CREATE INDEX idx_partner_matches_indication ON partner_match_results (input_indication_category);
CREATE INDEX idx_partner_matches_created ON partner_match_results (created_at DESC);
CREATE INDEX idx_partner_matches_tier ON partner_match_results (user_tier);

-- =============================================
-- Data Ingestion Log (Track scraping runs)
-- =============================================
CREATE TABLE data_ingestion_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  source TEXT NOT NULL CHECK (source IN ('sec_edgar', 'clinicaltrials', 'press_globenewswire', 'press_businesswire', 'press_prnewswire', 'company_pipeline', 'fda_openfda', 'manual')),
  run_type TEXT CHECK (run_type IN ('scheduled', 'manual', 'backfill')),

  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  -- Stats
  records_fetched INTEGER DEFAULT 0,
  records_processed INTEGER DEFAULT 0,
  records_inserted INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_skipped INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,

  -- Errors
  errors JSONB DEFAULT '[]',

  -- Status
  status TEXT CHECK (status IN ('running', 'completed', 'failed', 'partial')) DEFAULT 'running',

  -- Metadata
  parameters JSONB DEFAULT '{}',
  notes TEXT
);

CREATE INDEX idx_ingestion_log_source ON data_ingestion_log (source);
CREATE INDEX idx_ingestion_log_started ON data_ingestion_log (started_at DESC);
CREATE INDEX idx_ingestion_log_status ON data_ingestion_log (status);

-- =============================================
-- Press Releases (for enrichment)
-- =============================================
CREATE TABLE press_releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source
  source TEXT NOT NULL CHECK (source IN ('globenewswire', 'businesswire', 'prnewswire', 'company', 'other')),
  source_url TEXT NOT NULL,
  source_id TEXT,

  -- Content
  headline TEXT NOT NULL,
  body_text TEXT,
  published_at TIMESTAMPTZ NOT NULL,

  -- Extracted entities
  companies_mentioned TEXT[] DEFAULT '{}',
  is_deal_announcement BOOLEAN DEFAULT false,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,

  -- Processing
  processed BOOLEAN DEFAULT false,
  processing_notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_press_release UNIQUE (source, source_url)
);

CREATE INDEX idx_press_releases_source ON press_releases (source);
CREATE INDEX idx_press_releases_published ON press_releases (published_at DESC);
CREATE INDEX idx_press_releases_companies ON press_releases USING GIN (companies_mentioned);
CREATE INDEX idx_press_releases_is_deal ON press_releases (is_deal_announcement);
CREATE INDEX idx_press_releases_processed ON press_releases (processed);

-- =============================================
-- Row Level Security
-- =============================================
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_trials ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_match_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_ingestion_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE press_releases ENABLE ROW LEVEL SECURITY;

-- Companies and deals are public read (needed for matching)
CREATE POLICY "Public read companies" ON companies FOR SELECT USING (true);
CREATE POLICY "Public read deals" ON deals FOR SELECT USING (true);
CREATE POLICY "Public read trials" ON company_trials FOR SELECT USING (true);

-- Users can only read their own match results
CREATE POLICY "Users read own match results" ON partner_match_results
  FOR SELECT USING (auth.uid() = user_id OR anonymous_id IS NOT NULL);

-- Ingestion log and press releases are admin only (service role)
CREATE POLICY "Service role only ingestion log" ON data_ingestion_log
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role only press releases" ON press_releases
  FOR ALL USING (auth.role() = 'service_role');

-- =============================================
-- Helper Functions
-- =============================================

-- Function to update company stats from deals
CREATE OR REPLACE FUNCTION update_company_deal_stats(p_company_id UUID)
RETURNS void AS $$
DECLARE
  v_deals_12mo INTEGER;
  v_deals_24mo INTEGER;
  v_avg_upfront NUMERIC;
  v_median_upfront NUMERIC;
  v_last_deal RECORD;
  v_modalities TEXT[];
  v_indications TEXT[];
  v_phase_min TEXT;
  v_phase_max TEXT;
BEGIN
  -- Count deals
  SELECT
    COUNT(*) FILTER (WHERE announced_date > NOW() - INTERVAL '12 months'),
    COUNT(*) FILTER (WHERE announced_date > NOW() - INTERVAL '24 months')
  INTO v_deals_12mo, v_deals_24mo
  FROM deals
  WHERE licensee_id = p_company_id;

  -- Average and median upfront
  SELECT
    AVG(upfront_usd),
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY upfront_usd)
  INTO v_avg_upfront, v_median_upfront
  FROM deals
  WHERE licensee_id = p_company_id AND upfront_usd IS NOT NULL;

  -- Last deal
  SELECT modality, indication_category, announced_date
  INTO v_last_deal
  FROM deals
  WHERE licensee_id = p_company_id
  ORDER BY announced_date DESC
  LIMIT 1;

  -- Distinct modalities and indications
  SELECT
    ARRAY_AGG(DISTINCT modality),
    ARRAY_AGG(DISTINCT indication_category) FILTER (WHERE indication_category IS NOT NULL)
  INTO v_modalities, v_indications
  FROM deals
  WHERE licensee_id = p_company_id;

  -- Phase preferences
  SELECT
    MIN(phase_at_signing),
    MAX(phase_at_signing)
  INTO v_phase_min, v_phase_max
  FROM deals
  WHERE licensee_id = p_company_id;

  -- Update company
  UPDATE companies SET
    deals_last_12mo = v_deals_12mo,
    deals_last_24mo = v_deals_24mo,
    avg_upfront_usd = v_avg_upfront,
    median_upfront_usd = v_median_upfront,
    last_deal_date = v_last_deal.announced_date,
    last_deal_modality = v_last_deal.modality,
    last_deal_indication = v_last_deal.indication_category,
    modalities_active = COALESCE(v_modalities, '{}'),
    indications_active = COALESCE(v_indications, '{}'),
    phase_preference_min = v_phase_min,
    phase_preference_max = v_phase_max,
    updated_at = NOW()
  WHERE id = p_company_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate company data quality score
CREATE OR REPLACE FUNCTION calculate_company_data_quality(p_company_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_score INTEGER := 0;
  v_company RECORD;
  v_deal_count INTEGER;
  v_trial_count INTEGER;
BEGIN
  SELECT * INTO v_company FROM companies WHERE id = p_company_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  -- Basic info (max 20)
  IF v_company.name IS NOT NULL THEN v_score := v_score + 5; END IF;
  IF v_company.company_type IS NOT NULL THEN v_score := v_score + 5; END IF;
  IF v_company.hq_country IS NOT NULL THEN v_score := v_score + 5; END IF;
  IF v_company.ticker IS NOT NULL THEN v_score := v_score + 5; END IF;

  -- Deal data (max 30)
  SELECT COUNT(*) INTO v_deal_count FROM deals WHERE licensee_id = p_company_id;
  IF v_deal_count >= 1 THEN v_score := v_score + 10; END IF;
  IF v_deal_count >= 3 THEN v_score := v_score + 10; END IF;
  IF v_deal_count >= 5 THEN v_score := v_score + 10; END IF;

  -- Trial data (max 20)
  SELECT COUNT(*) INTO v_trial_count FROM company_trials WHERE company_id = p_company_id;
  IF v_trial_count >= 1 THEN v_score := v_score + 5; END IF;
  IF v_trial_count >= 5 THEN v_score := v_score + 5; END IF;
  IF v_trial_count >= 10 THEN v_score := v_score + 10; END IF;

  -- Therapeutic focus (max 20)
  IF array_length(v_company.modalities_active, 1) > 0 THEN v_score := v_score + 10; END IF;
  IF array_length(v_company.indications_active, 1) > 0 THEN v_score := v_score + 10; END IF;

  -- Recency (max 10)
  IF v_company.last_deal_date > NOW() - INTERVAL '12 months' THEN v_score := v_score + 10;
  ELSIF v_company.last_deal_date > NOW() - INTERVAL '24 months' THEN v_score := v_score + 5;
  END IF;

  -- Update company
  UPDATE companies SET data_quality_score = v_score WHERE id = p_company_id;

  RETURN v_score;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update company when deal is inserted
CREATE OR REPLACE FUNCTION trigger_deal_inserted()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.licensee_id IS NOT NULL THEN
    PERFORM update_company_deal_stats(NEW.licensee_id);
    PERFORM calculate_company_data_quality(NEW.licensee_id);
  END IF;
  IF NEW.licensor_id IS NOT NULL THEN
    PERFORM calculate_company_data_quality(NEW.licensor_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER deal_inserted_trigger
  AFTER INSERT ON deals
  FOR EACH ROW
  EXECUTE FUNCTION trigger_deal_inserted();

-- Trigger for updated_at
CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_deals_updated_at
  BEFORE UPDATE ON deals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_company_trials_updated_at
  BEFORE UPDATE ON company_trials
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- Analytics Views
-- =============================================

-- Top acquirers view
CREATE VIEW top_acquirers AS
SELECT
  c.id,
  c.name,
  c.company_type,
  c.deals_last_12mo,
  c.deals_last_24mo,
  c.modalities_active,
  c.indications_active,
  c.avg_upfront_usd,
  c.last_deal_date,
  c.data_quality_score,
  c.actively_acquiring
FROM companies c
WHERE c.actively_acquiring = true
  AND c.deals_last_24mo > 0
ORDER BY c.deals_last_12mo DESC, c.data_quality_score DESC;

-- Deal trends by modality
CREATE VIEW deal_trends_by_modality AS
SELECT
  modality,
  DATE_TRUNC('month', announced_date) as month,
  COUNT(*) as deal_count,
  AVG(upfront_usd) FILTER (WHERE upfront_usd IS NOT NULL) as avg_upfront,
  AVG(total_deal_value_usd) FILTER (WHERE total_deal_value_usd IS NOT NULL) as avg_total_value
FROM deals
WHERE announced_date > NOW() - INTERVAL '24 months'
GROUP BY modality, DATE_TRUNC('month', announced_date)
ORDER BY month DESC, deal_count DESC;

-- Partner match analytics
CREATE VIEW partner_match_analytics AS
SELECT
  input_modality,
  input_indication_category,
  user_tier,
  COUNT(*) as match_requests,
  AVG(matches_total) as avg_matches_found,
  AVG(avg_match_score) as avg_quality_score,
  SUM(CASE WHEN upgrade_cta_clicked THEN 1 ELSE 0 END) as upgrade_clicks,
  SUM(CASE WHEN advisory_cta_clicked THEN 1 ELSE 0 END) as advisory_clicks,
  DATE_TRUNC('week', created_at) as week
FROM partner_match_results
GROUP BY input_modality, input_indication_category, user_tier, DATE_TRUNC('week', created_at)
ORDER BY week DESC;
