-- Asset Radar Layer 5: Competitive Intelligence
-- Asset Radar Layer 6: Deal Creation Engine
--
-- Layer 5 tracks who else is circling an asset:
--   user interest signals, competitor deal activity, patent overlaps
-- Layer 6 proposes net-new transactions:
--   pharma portfolio gaps × available assets × predicted economics

-- ══════════════════════════════════════════════════════════════════════
-- COMPETITIVE INTELLIGENCE SIGNALS
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE competitive_intel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES clinical_assets(id) ON DELETE CASCADE,

  -- Signal type
  intel_type TEXT NOT NULL CHECK (intel_type IN (
    'user_interest',
    'competitor_deal',
    'patent_overlap',
    'conference_overlap',
    'trial_crowding',
    'publication_race'
  )),

  -- Who is competing
  competitor_company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  competitor_name TEXT,

  -- Signal details
  intensity NUMERIC NOT NULL DEFAULT 0 CHECK (intensity >= 0 AND intensity <= 100),
  evidence_text TEXT,
  evidence_metadata JSONB DEFAULT '{}',

  -- Anonymized user interest (no PII — just counts)
  interest_count INTEGER DEFAULT 0,
  unique_orgs INTEGER DEFAULT 0,

  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════════════
-- DEAL OPPORTUNITIES (Layer 6)
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE radar_deal_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The asset being proposed for a deal
  asset_id UUID NOT NULL REFERENCES clinical_assets(id) ON DELETE CASCADE,
  asset_company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  asset_company_name TEXT NOT NULL,
  asset_name TEXT NOT NULL,

  -- The proposed acquirer/licensee
  acquirer_company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  acquirer_name TEXT NOT NULL,

  -- Why this deal should happen
  opportunity_score NUMERIC NOT NULL DEFAULT 0
    CHECK (opportunity_score >= 0 AND opportunity_score <= 100),
  strategic_fit_score NUMERIC NOT NULL DEFAULT 0
    CHECK (strategic_fit_score >= 0 AND strategic_fit_score <= 100),
  timing_score NUMERIC NOT NULL DEFAULT 0
    CHECK (timing_score >= 0 AND timing_score <= 100),

  -- Deal rationale
  rationale TEXT NOT NULL,
  strategic_drivers JSONB DEFAULT '[]',
  risk_factors JSONB DEFAULT '[]',

  -- Predicted economics (from Layer 3 + adjustments)
  predicted_upfront_low NUMERIC,
  predicted_upfront_mid NUMERIC,
  predicted_upfront_high NUMERIC,
  predicted_total_low NUMERIC,
  predicted_total_mid NUMERIC,
  predicted_total_high NUMERIC,

  -- Portfolio gap that this deal fills
  gap_type TEXT CHECK (gap_type IN (
    'therapeutic_gap',
    'modality_gap',
    'pipeline_stage_gap',
    'geographic_gap',
    'patent_cliff_replacement',
    'competitive_response'
  )),
  gap_detail TEXT,

  -- Comparable deals that support this thesis
  comp_deal_ids UUID[] DEFAULT '{}',
  comp_count INTEGER DEFAULT 0,

  -- Status
  confidence INTEGER NOT NULL DEFAULT 0
    CHECK (confidence >= 0 AND confidence <= 100),
  status TEXT NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed', 'reviewed', 'starred', 'dismissed')),

  generated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_opportunity UNIQUE (asset_id, acquirer_company_id)
);

-- ══════════════════════════════════════════════════════════════════════
-- INDEXES — competitive_intel
-- ══════════════════════════════════════════════════════════════════════

CREATE INDEX idx_competitive_intel_asset ON competitive_intel(asset_id);
CREATE INDEX idx_competitive_intel_type ON competitive_intel(intel_type);
CREATE INDEX idx_competitive_intel_competitor ON competitive_intel(competitor_company_id)
  WHERE competitor_company_id IS NOT NULL;
CREATE INDEX idx_competitive_intel_intensity ON competitive_intel(intensity DESC)
  WHERE is_active = true;
CREATE INDEX idx_competitive_intel_active ON competitive_intel(asset_id, intel_type, intensity DESC)
  WHERE is_active = true;

-- ══════════════════════════════════════════════════════════════════════
-- INDEXES — radar_deal_opportunities
-- ══════════════════════════════════════════════════════════════════════

CREATE INDEX idx_deal_opps_asset ON radar_deal_opportunities(asset_id);
CREATE INDEX idx_deal_opps_acquirer ON radar_deal_opportunities(acquirer_company_id);
CREATE INDEX idx_deal_opps_score ON radar_deal_opportunities(opportunity_score DESC)
  WHERE status != 'dismissed';
CREATE INDEX idx_deal_opps_gap ON radar_deal_opportunities(gap_type)
  WHERE status != 'dismissed';
CREATE INDEX idx_deal_opps_strategic ON radar_deal_opportunities(strategic_fit_score DESC)
  WHERE status != 'dismissed';
CREATE INDEX idx_deal_opps_status ON radar_deal_opportunities(status);
CREATE INDEX idx_deal_opps_generated ON radar_deal_opportunities(generated_at DESC);

-- Composite: top opportunities by acquirer
CREATE INDEX idx_deal_opps_acquirer_top
  ON radar_deal_opportunities(acquirer_company_id, opportunity_score DESC)
  WHERE status != 'dismissed';

-- ══════════════════════════════════════════════════════════════════════
-- RLS
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE competitive_intel ENABLE ROW LEVEL SECURITY;
ALTER TABLE radar_deal_opportunities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read competitive intel"
  ON competitive_intel FOR SELECT USING (true);
CREATE POLICY "Service role full access competitive intel"
  ON competitive_intel FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Public read deal opportunities"
  ON radar_deal_opportunities FOR SELECT USING (true);
CREATE POLICY "Service role full access deal opportunities"
  ON radar_deal_opportunities FOR ALL
  USING (auth.role() = 'service_role');

-- ══════════════════════════════════════════════════════════════════════
-- TRIGGERS
-- ══════════════════════════════════════════════════════════════════════

CREATE TRIGGER update_competitive_intel_updated_at
  BEFORE UPDATE ON competitive_intel
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_deal_opportunities_updated_at
  BEFORE UPDATE ON radar_deal_opportunities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
