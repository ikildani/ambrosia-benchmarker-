-- Asset Radar Layer 4: User Mandates (Personalized Feed)
-- Stores user-defined search criteria for asset matching.
-- A mandate defines what a user is looking for: TA, modality, phase range,
-- geography, and partnership status. The system matches clinical_assets
-- against mandates and surfaces new matches as notifications.

CREATE TABLE radar_user_mandates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Mandate identity
  name TEXT NOT NULL DEFAULT 'My Search',
  description TEXT,
  is_active BOOLEAN DEFAULT true,

  -- Filters (null = any)
  therapeutic_areas TEXT[] DEFAULT '{}',
  modalities TEXT[] DEFAULT '{}',
  phase_min TEXT,
  phase_max TEXT,
  countries TEXT[] DEFAULT '{}',
  regions TEXT[] DEFAULT '{}',
  partnership_statuses TEXT[] DEFAULT '{unpartnered,partially_partnered}',

  -- Scoring thresholds (minimum scores to surface)
  min_licensing_intent NUMERIC DEFAULT 0,
  min_deal_readiness NUMERIC DEFAULT 0,
  min_confidence INTEGER DEFAULT 0,

  -- Notification preferences
  notify_email BOOLEAN DEFAULT false,
  notify_in_app BOOLEAN DEFAULT true,
  digest_frequency TEXT DEFAULT 'daily'
    CHECK (digest_frequency IN ('realtime', 'daily', 'weekly')),

  -- Tracking
  last_matched_at TIMESTAMPTZ,
  match_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════════════
-- MANDATE MATCHES — tracks which assets matched which mandates
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE radar_mandate_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mandate_id UUID NOT NULL REFERENCES radar_user_mandates(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES clinical_assets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Match metadata
  match_score NUMERIC DEFAULT 0,
  match_reasons TEXT[] DEFAULT '{}',

  -- User interaction
  is_read BOOLEAN DEFAULT false,
  is_saved BOOLEAN DEFAULT false,
  is_dismissed BOOLEAN DEFAULT false,

  matched_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_mandate_asset UNIQUE (mandate_id, asset_id)
);

-- ══════════════════════════════════════════════════════════════════════
-- INDEXES
-- ══════════════════════════════════════════════════════════════════════

CREATE INDEX idx_mandates_user ON radar_user_mandates(user_id);
CREATE INDEX idx_mandates_active ON radar_user_mandates(is_active) WHERE is_active = true;
CREATE INDEX idx_mandate_matches_user ON radar_mandate_matches(user_id, is_read, matched_at DESC);
CREATE INDEX idx_mandate_matches_mandate ON radar_mandate_matches(mandate_id);
CREATE INDEX idx_mandate_matches_asset ON radar_mandate_matches(asset_id);
CREATE INDEX idx_mandate_matches_unread ON radar_mandate_matches(user_id, matched_at DESC)
  WHERE is_read = false AND is_dismissed = false;

-- GIN for array filter overlap queries
CREATE INDEX idx_mandates_tas ON radar_user_mandates USING GIN (therapeutic_areas);
CREATE INDEX idx_mandates_modalities ON radar_user_mandates USING GIN (modalities);

-- ══════════════════════════════════════════════════════════════════════
-- RLS
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE radar_user_mandates ENABLE ROW LEVEL SECURITY;
ALTER TABLE radar_mandate_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own mandates"
  ON radar_user_mandates FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users manage own mandates"
  ON radar_user_mandates FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users read own matches"
  ON radar_mandate_matches FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users update own matches"
  ON radar_mandate_matches FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access mandates"
  ON radar_user_mandates FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access matches"
  ON radar_mandate_matches FOR ALL
  USING (auth.role() = 'service_role');

-- ══════════════════════════════════════════════════════════════════════
-- UPDATED_AT TRIGGER
-- ══════════════════════════════════════════════════════════════════════

CREATE TRIGGER update_mandates_updated_at
  BEFORE UPDATE ON radar_user_mandates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
