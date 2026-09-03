-- Company geography classification for cross-border deal intelligence
-- Adds headquarters country/region to companies, and licensor/licensee
-- country/region plus deal corridor analysis to deals.

-- ══════════════════════════════════════════════════════════════════════
-- COMPANIES TABLE
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS headquarters_country TEXT,
  ADD COLUMN IF NOT EXISTS headquarters_region TEXT;

COMMENT ON COLUMN companies.headquarters_country IS 'ISO 3166-1 alpha-2 country code (US, CN, JP, KR, IL, GB, DE, etc.)';
COMMENT ON COLUMN companies.headquarters_region IS 'Region classification (north_america, europe, china, japan, south_korea, israel, asia_pacific, middle_east, latin_america, africa)';

CREATE INDEX IF NOT EXISTS idx_companies_hq_country ON companies (headquarters_country) WHERE headquarters_country IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_companies_hq_region ON companies (headquarters_region) WHERE headquarters_region IS NOT NULL;

-- ══════════════════════════════════════════════════════════════════════
-- DEALS TABLE
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS licensor_country TEXT,
  ADD COLUMN IF NOT EXISTS licensee_country TEXT,
  ADD COLUMN IF NOT EXISTS licensor_region TEXT,
  ADD COLUMN IF NOT EXISTS licensee_region TEXT,
  ADD COLUMN IF NOT EXISTS cross_border BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deal_corridor TEXT;

COMMENT ON COLUMN deals.licensor_country IS 'ISO 3166-1 alpha-2 country of licensor headquarters';
COMMENT ON COLUMN deals.licensee_country IS 'ISO 3166-1 alpha-2 country of licensee headquarters';
COMMENT ON COLUMN deals.licensor_region IS 'Region of licensor (north_america, europe, china, japan, south_korea, israel, etc.)';
COMMENT ON COLUMN deals.licensee_region IS 'Region of licensee';
COMMENT ON COLUMN deals.cross_border IS 'True when licensor and licensee are from different countries';
COMMENT ON COLUMN deals.deal_corridor IS 'Cross-border deal corridor label (e.g. cn_to_us, us_to_eu, jp_to_us)';

CREATE INDEX IF NOT EXISTS idx_deals_licensor_country ON deals (licensor_country) WHERE licensor_country IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deals_licensee_country ON deals (licensee_country) WHERE licensee_country IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deals_cross_border ON deals (cross_border) WHERE cross_border = TRUE;
CREATE INDEX IF NOT EXISTS idx_deals_deal_corridor ON deals (deal_corridor) WHERE deal_corridor IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deals_licensor_region ON deals (licensor_region) WHERE licensor_region IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deals_licensee_region ON deals (licensee_region) WHERE licensee_region IS NOT NULL;
