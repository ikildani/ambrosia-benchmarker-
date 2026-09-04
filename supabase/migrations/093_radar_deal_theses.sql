-- Asset Radar Layer 3: AI Deal Thesis Generator
-- Stores predicted deal terms for clinical assets based on comparable transactions.
-- One thesis per asset, updated daily by the deal-thesis cron.

CREATE TABLE radar_deal_theses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES clinical_assets(id) ON DELETE CASCADE,

  -- Asset identity (denormalized for query performance)
  company_name TEXT NOT NULL,
  asset_name TEXT NOT NULL,
  therapeutic_area TEXT,
  modality TEXT,
  phase TEXT,

  -- Predicted upfront ($M) — P25 / P50 / P75 from comps
  predicted_upfront_low NUMERIC,
  predicted_upfront_mid NUMERIC,
  predicted_upfront_high NUMERIC,

  -- Predicted total deal value ($M)
  predicted_total_low NUMERIC,
  predicted_total_mid NUMERIC,
  predicted_total_high NUMERIC,

  -- Predicted royalty rate (%)
  predicted_royalty_low NUMERIC,
  predicted_royalty_mid NUMERIC,
  predicted_royalty_high NUMERIC,

  -- Likely acquirers
  likely_acquirers JSONB DEFAULT '[]',

  -- Comparable transaction basis
  comp_count INTEGER DEFAULT 0,
  comp_deal_ids UUID[] DEFAULT '{}',
  thesis_confidence INTEGER DEFAULT 0
    CHECK (thesis_confidence >= 0 AND thesis_confidence <= 100),

  generated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_thesis_per_asset UNIQUE (asset_id)
);

-- ══════════════════════════════════════════════════════════════════════
-- INDEXES
-- ══════════════════════════════════════════════════════════════════════

CREATE INDEX idx_deal_theses_asset ON radar_deal_theses(asset_id);
CREATE INDEX idx_deal_theses_ta ON radar_deal_theses(therapeutic_area);
CREATE INDEX idx_deal_theses_confidence ON radar_deal_theses(thesis_confidence DESC);
CREATE INDEX idx_deal_theses_upfront ON radar_deal_theses(predicted_upfront_mid DESC NULLS LAST);
CREATE INDEX idx_deal_theses_generated ON radar_deal_theses(generated_at DESC);

-- GIN for comp deal array queries
CREATE INDEX idx_deal_theses_comp_ids ON radar_deal_theses USING GIN (comp_deal_ids);

-- ══════════════════════════════════════════════════════════════════════
-- RLS
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE radar_deal_theses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read deal theses"
  ON radar_deal_theses FOR SELECT USING (true);

CREATE POLICY "Service role full access deal theses"
  ON radar_deal_theses FOR ALL
  USING (auth.role() = 'service_role');

-- ══════════════════════════════════════════════════════════════════════
-- UPDATED_AT TRIGGER
-- ══════════════════════════════════════════════════════════════════════

CREATE TRIGGER update_deal_theses_updated_at
  BEFORE UPDATE ON radar_deal_theses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
