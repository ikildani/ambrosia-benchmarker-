-- Migration 123 — deal_subtype and regulatory_pathway on deals.
--
-- Why: the 10K-deal target requires coverage of six structures (research
-- collaboration, option, licence, co-development, acquisition,
-- reformulation / 505(b)(2)) across every stage. deal_type is a coarse
-- seven-value enum; deal_subtype records the finer structure the extractor
-- sees and regulatory_pathway records 505(b)(2) / NDA / BLA / ANDA when the
-- filing states it, so the coverage can be counted and queried.
--
-- Reversal: ALTER TABLE deals DROP COLUMN deal_subtype, DROP COLUMN regulatory_pathway;

BEGIN;

ALTER TABLE deals ADD COLUMN IF NOT EXISTS deal_subtype text;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS regulatory_pathway text;

CREATE INDEX IF NOT EXISTS idx_deals_deal_subtype ON deals (deal_subtype) WHERE deal_subtype IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deals_regulatory_pathway ON deals (regulatory_pathway) WHERE regulatory_pathway IS NOT NULL;

COMMENT ON COLUMN deals.deal_subtype IS 'Finer structure than deal_type: research_collaboration | discovery_platform | option_to_license | license | co_development | co_promotion | asset_purchase | company_acquisition | commercialization | distribution_supply | reformulation_505b2 | other';
COMMENT ON COLUMN deals.regulatory_pathway IS 'Stated regulatory route for the asset: 505b2 | nda | bla | anda | ind | other';

COMMIT;
