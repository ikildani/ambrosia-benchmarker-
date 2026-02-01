-- Event Tracking Schema for Deal Calculator
-- Migration: 001_event_tracking.sql

-- =============================================
-- User Profiles (extends auth.users)
-- =============================================
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  company_name TEXT,
  company_domain TEXT,
  job_title TEXT,
  job_function TEXT, -- 'bd_licensing', 'investor', 'consultant', 'corporate_dev', 'other'
  company_type TEXT, -- 'pharma_large', 'pharma_mid', 'biotech', 'investor_vc', 'investor_pe', 'advisor', 'other'
  tier TEXT DEFAULT 'free' CHECK (tier IN ('free', 'pro')),
  attribution_source TEXT, -- 'google', 'linkedin', 'referral', 'direct', etc.
  attribution_campaign TEXT,
  consent_analytics BOOLEAN DEFAULT true,
  consent_marketing BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_profiles_tier ON user_profiles(tier);
CREATE INDEX idx_user_profiles_company_type ON user_profiles(company_type);

-- =============================================
-- Sessions (supports anonymous tracking)
-- =============================================
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  anonymous_id TEXT, -- For pre-auth tracking, links to user on signup
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  calculation_count INTEGER DEFAULT 0,
  paywall_hits INTEGER DEFAULT 0,
  device_type TEXT CHECK (device_type IN ('desktop', 'tablet', 'mobile')),
  referrer_url TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_anonymous_id ON sessions(anonymous_id);
CREATE INDEX idx_sessions_started_at ON sessions(started_at);

-- =============================================
-- Events (core tracking)
-- =============================================
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  anonymous_id TEXT, -- For pre-auth linking
  event_type TEXT NOT NULL,
  event_data JSONB NOT NULL DEFAULT '{}',
  user_tier TEXT NOT NULL DEFAULT 'free', -- Denormalized for fast queries
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_events_user_id ON events(user_id);
CREATE INDEX idx_events_session_id ON events(session_id);
CREATE INDEX idx_events_anonymous_id ON events(anonymous_id);
CREATE INDEX idx_events_event_type ON events(event_type);
CREATE INDEX idx_events_created_at ON events(created_at);
CREATE INDEX idx_events_event_data ON events USING GIN (event_data);

-- =============================================
-- Calculations (detailed input capture)
-- =============================================
CREATE TABLE calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  anonymous_id TEXT, -- For pre-auth linking

  -- Input Parameters
  modality TEXT NOT NULL, -- 'small_molecule', 'adc', 'bispecific', 'car_t', 'radiopharm', 'mrna', 'gene_therapy', 'other'
  development_phase TEXT NOT NULL, -- 'preclinical', 'phase_1', 'phase_2', 'phase_3', 'approved'
  indication_category TEXT, -- 'solid_tumor', 'hematological', 'rare_disease', 'other'
  indication_specific TEXT, -- 'nsclc', 'breast', 'aml', etc.

  -- Territory Configuration
  territory_scope TEXT, -- 'global', 'us_only', 'ex_us', 'regional'
  territories_included TEXT[], -- ['us', 'eu', 'japan', 'china', 'row']
  exclusivity_type TEXT, -- 'exclusive', 'co_exclusive', 'non_exclusive'

  -- Deal Structure Inputs
  deal_type TEXT, -- 'license', 'option', 'collaboration', 'acquisition'
  includes_manufacturing BOOLEAN DEFAULT false,
  includes_codev BOOLEAN DEFAULT false,
  includes_copromote BOOLEAN DEFAULT false,

  -- Calculated Outputs (for trend analysis)
  output_upfront_low NUMERIC,
  output_upfront_mid NUMERIC,
  output_upfront_high NUMERIC,
  output_milestones_total NUMERIC,
  output_royalty_low NUMERIC,
  output_royalty_high NUMERIC,
  output_total_deal_value_low NUMERIC,
  output_total_deal_value_high NUMERIC,

  -- Metadata
  calculation_version TEXT DEFAULT '1.0.0', -- Track algorithm versions
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_calculations_user_id ON calculations(user_id);
CREATE INDEX idx_calculations_anonymous_id ON calculations(anonymous_id);
CREATE INDEX idx_calculations_modality ON calculations(modality);
CREATE INDEX idx_calculations_phase ON calculations(development_phase);
CREATE INDEX idx_calculations_indication ON calculations(indication_category);
CREATE INDEX idx_calculations_created_at ON calculations(created_at);

-- =============================================
-- Lead Scores (computed)
-- =============================================
CREATE TABLE lead_scores (
  user_id UUID PRIMARY KEY REFERENCES user_profiles(id) ON DELETE CASCADE,

  -- Activity Metrics
  total_sessions INTEGER DEFAULT 0,
  total_calculations INTEGER DEFAULT 0,
  sessions_last_7_days INTEGER DEFAULT 0,
  sessions_last_30_days INTEGER DEFAULT 0,
  calculations_last_7_days INTEGER DEFAULT 0,
  calculations_last_30_days INTEGER DEFAULT 0,

  -- Intent Signals
  paywall_hits_total INTEGER DEFAULT 0,
  export_attempts INTEGER DEFAULT 0,
  pro_feature_clicks INTEGER DEFAULT 0,

  -- Engagement Depth
  unique_modalities_explored INTEGER DEFAULT 0,
  unique_indications_explored INTEGER DEFAULT 0,
  avg_session_duration_seconds INTEGER,

  -- Computed Score
  lead_score INTEGER DEFAULT 0 CHECK (lead_score >= 0 AND lead_score <= 100),
  lead_tier TEXT CHECK (lead_tier IN ('cold', 'warm', 'hot', 'qualified')),

  -- Timestamps
  first_activity_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_lead_scores_score ON lead_scores(lead_score DESC);
CREATE INDEX idx_lead_scores_tier ON lead_scores(lead_tier);
CREATE INDEX idx_lead_scores_last_activity ON lead_scores(last_activity_at);

-- =============================================
-- Market Insights (AI-generated aggregates)
-- =============================================
CREATE TABLE market_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  insight_type TEXT NOT NULL, -- 'modality_trend', 'phase_distribution', 'territory_preference', 'indication_popularity'
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  insight_data JSONB NOT NULL, -- Aggregated anonymous data
  ai_summary TEXT, -- AI-generated insight text
  generated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_market_insights_type ON market_insights(insight_type);
CREATE INDEX idx_market_insights_period ON market_insights(period_start, period_end);

-- =============================================
-- Row Level Security
-- =============================================
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_insights ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "Users read own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id);

-- Users can read their own sessions
CREATE POLICY "Users read own sessions"
  ON sessions FOR SELECT
  USING (auth.uid() = user_id);

-- Users can read their own events
CREATE POLICY "Users read own events"
  ON events FOR SELECT
  USING (auth.uid() = user_id);

-- Users can read their own calculations
CREATE POLICY "Users read own calculations"
  ON calculations FOR SELECT
  USING (auth.uid() = user_id);

-- Users can read their own lead score
CREATE POLICY "Users read own lead score"
  ON lead_scores FOR SELECT
  USING (auth.uid() = user_id);

-- Market insights are readable by all authenticated users
CREATE POLICY "Authenticated users read market insights"
  ON market_insights FOR SELECT
  TO authenticated
  USING (true);

-- =============================================
-- Helper Functions
-- =============================================

-- Function to increment session calculation count
CREATE OR REPLACE FUNCTION increment_session_calculations(p_session_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE sessions
  SET calculation_count = calculation_count + 1
  WHERE id = p_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment session paywall hits
CREATE OR REPLACE FUNCTION increment_session_paywall_hits(p_session_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE sessions
  SET paywall_hits = paywall_hits + 1
  WHERE id = p_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to link anonymous data to user on signup
CREATE OR REPLACE FUNCTION link_anonymous_to_user(p_user_id UUID, p_anonymous_id TEXT)
RETURNS void AS $$
BEGIN
  -- Update sessions
  UPDATE sessions
  SET user_id = p_user_id
  WHERE anonymous_id = p_anonymous_id AND user_id IS NULL;

  -- Update events
  UPDATE events
  SET user_id = p_user_id
  WHERE anonymous_id = p_anonymous_id AND user_id IS NULL;

  -- Update calculations
  UPDATE calculations
  SET user_id = p_user_id
  WHERE anonymous_id = p_anonymous_id AND user_id IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lead_scores_updated_at
  BEFORE UPDATE ON lead_scores
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- Useful Views for Analytics
-- =============================================

-- Hot leads view for sales outreach
CREATE VIEW hot_leads AS
SELECT
  up.email,
  up.company_name,
  up.job_title,
  up.company_type,
  ls.lead_score,
  ls.lead_tier,
  ls.paywall_hits_total,
  ls.calculations_last_7_days,
  ls.last_activity_at
FROM lead_scores ls
JOIN user_profiles up ON ls.user_id = up.id
WHERE ls.lead_tier IN ('hot', 'qualified')
  AND up.tier = 'free'
ORDER BY ls.lead_score DESC;

-- Modality trends view
CREATE VIEW modality_trends AS
SELECT
  modality,
  COUNT(*) as calculation_count,
  COUNT(DISTINCT COALESCE(user_id::text, anonymous_id)) as unique_users,
  AVG(output_upfront_mid) as avg_upfront_explored,
  AVG(output_total_deal_value_high) as avg_total_value_explored,
  DATE_TRUNC('month', created_at) as month
FROM calculations
WHERE created_at > NOW() - INTERVAL '12 months'
GROUP BY modality, DATE_TRUNC('month', created_at)
ORDER BY month DESC, calculation_count DESC;
