-- =============================================
-- Revenue Tracking
-- Product-level drug revenue from SEC XBRL and Claude extraction
-- =============================================

-- Product-level revenue tracking
CREATE TABLE drug_revenues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  drug_name TEXT NOT NULL,
  drug_name_normalized TEXT NOT NULL,  -- uppercase, trimmed for matching

  -- Revenue data
  revenue_usd NUMERIC NOT NULL,
  fiscal_year INTEGER NOT NULL,
  fiscal_period TEXT NOT NULL CHECK (fiscal_period IN ('FY', 'Q1', 'Q2', 'Q3', 'Q4')),

  -- Source tracking
  source TEXT NOT NULL CHECK (source IN ('xbrl', 'claude_extraction', 'hardcoded', 'manual')),
  source_filing TEXT,       -- accession number or URL
  confidence_score INTEGER DEFAULT 100 CHECK (confidence_score >= 0 AND confidence_score <= 100),

  -- Metadata
  extracted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_drug_revenue UNIQUE (company_id, drug_name_normalized, fiscal_year, fiscal_period)
);

CREATE INDEX idx_drug_revenues_company ON drug_revenues (company_id);
CREATE INDEX idx_drug_revenues_drug ON drug_revenues (drug_name_normalized);
CREATE INDEX idx_drug_revenues_year ON drug_revenues (fiscal_year DESC);

-- RLS
ALTER TABLE drug_revenues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read drug revenues" ON drug_revenues
  FOR SELECT USING (true);

CREATE POLICY "Service role manages drug revenues" ON drug_revenues
  FOR ALL USING (auth.role() = 'service_role');

-- Add company-level revenue and SEC CIK columns to companies
ALTER TABLE companies ADD COLUMN IF NOT EXISTS total_annual_revenue NUMERIC;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS revenue_fiscal_year INTEGER;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS sec_cik TEXT;

CREATE INDEX idx_companies_cik ON companies (sec_cik) WHERE sec_cik IS NOT NULL;
