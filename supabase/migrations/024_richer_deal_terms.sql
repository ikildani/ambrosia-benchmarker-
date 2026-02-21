-- Migration 024: Richer deal terms for worldclass benchmarking
-- Adds fields that BD teams use when structuring term sheets

-- Key milestone details as structured JSONB array
-- Example: [{"description": "IND filing", "amount_usd": 10000000, "type": "development"},
--           {"description": "Phase 3 initiation", "amount_usd": 50000000, "type": "development"},
--           {"description": "FDA approval", "amount_usd": 100000000, "type": "regulatory"},
--           {"description": "$1B net sales", "amount_usd": 200000000, "type": "commercial"}]
ALTER TABLE deals ADD COLUMN IF NOT EXISTS milestone_details JSONB DEFAULT '[]'::jsonb;

-- Research/R&D funding (separate from upfront payment — common in collaborations)
ALTER TABLE deals ADD COLUMN IF NOT EXISTS research_funding_usd NUMERIC;

-- Profit-sharing for co-development deals (alternative to royalties)
ALTER TABLE deals ADD COLUMN IF NOT EXISTS profit_share_pct NUMERIC;

-- Cost-sharing ratio for co-development (e.g., 0.5 = 50/50 split)
ALTER TABLE deals ADD COLUMN IF NOT EXISTS cost_share_ratio NUMERIC;

-- Opt-in/opt-out provisions (critical for option deals)
ALTER TABLE deals ADD COLUMN IF NOT EXISTS opt_in_rights TEXT; -- description of opt-in provisions
ALTER TABLE deals ADD COLUMN IF NOT EXISTS opt_in_stage TEXT; -- phase at which opt-in can occur

-- Regulatory designations at time of deal
ALTER TABLE deals ADD COLUMN IF NOT EXISTS regulatory_designations TEXT[] DEFAULT '{}';

-- Contract duration
ALTER TABLE deals ADD COLUMN IF NOT EXISTS term_years NUMERIC;

-- Sublicensing rights
ALTER TABLE deals ADD COLUMN IF NOT EXISTS sublicense_rights BOOLEAN;

-- Rights retained by licensor
ALTER TABLE deals ADD COLUMN IF NOT EXISTS rights_retained TEXT;

-- Deal status tracking
ALTER TABLE deals ADD COLUMN IF NOT EXISTS deal_status TEXT DEFAULT 'active'
  CHECK (deal_status IN ('active', 'terminated', 'amended', 'exercised', 'expired', 'unknown'));

-- Number of indications licensed (multi-indication deals are common)
ALTER TABLE deals ADD COLUMN IF NOT EXISTS indications_licensed INTEGER;

-- Whether deal includes diagnostic/companion diagnostic rights
ALTER TABLE deals ADD COLUMN IF NOT EXISTS includes_diagnostics BOOLEAN DEFAULT false;

-- Sales-based milestones threshold tiers as JSONB
-- Example: [{"threshold_usd": 500000000, "payment_usd": 50000000},
--           {"threshold_usd": 1000000000, "payment_usd": 100000000}]
ALTER TABLE deals ADD COLUMN IF NOT EXISTS sales_milestones JSONB DEFAULT '[]'::jsonb;

-- Add index on deal_status for filtering
CREATE INDEX IF NOT EXISTS idx_deals_deal_status ON deals(deal_status);

-- Add index on regulatory_designations for GIN search
CREATE INDEX IF NOT EXISTS idx_deals_regulatory_designations ON deals USING GIN(regulatory_designations);

COMMENT ON COLUMN deals.milestone_details IS 'Structured array of individual milestones with descriptions and amounts';
COMMENT ON COLUMN deals.research_funding_usd IS 'R&D funding commitment separate from upfront payment';
COMMENT ON COLUMN deals.profit_share_pct IS 'Profit-sharing percentage for co-development deals (alternative to royalties)';
COMMENT ON COLUMN deals.cost_share_ratio IS 'Cost-sharing ratio for co-development (0.5 = 50/50)';
COMMENT ON COLUMN deals.opt_in_rights IS 'Description of opt-in/opt-out provisions';
COMMENT ON COLUMN deals.opt_in_stage IS 'Development phase at which opt-in can be exercised';
COMMENT ON COLUMN deals.regulatory_designations IS 'FDA/EMA designations at deal signing: breakthrough, fast_track, orphan, priority_review, rmat, prime, accelerated';
COMMENT ON COLUMN deals.term_years IS 'Contract duration in years';
COMMENT ON COLUMN deals.sublicense_rights IS 'Whether licensee has sublicensing rights';
COMMENT ON COLUMN deals.rights_retained IS 'Rights retained by licensor (e.g., co-promote in US, Japan rights)';
COMMENT ON COLUMN deals.deal_status IS 'Current status of the deal';
COMMENT ON COLUMN deals.indications_licensed IS 'Number of indications covered by the license';
COMMENT ON COLUMN deals.includes_diagnostics IS 'Whether deal includes companion diagnostic rights';
COMMENT ON COLUMN deals.sales_milestones IS 'Sales-based milestone tiers with thresholds and payments';
