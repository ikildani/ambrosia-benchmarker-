-- Migration 129 — companies.company_type gains academic, government, nonprofit, cro_cdmo, other
-- so counterparties such as NIH/HHS, universities and CDMOs stop landing in "unclassified".
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_company_type_check;
ALTER TABLE companies ADD CONSTRAINT companies_company_type_check CHECK (
  company_type IN ('large_pharma','mid_pharma','large_biotech','mid_biotech','specialty','academic','government','nonprofit','cro_cdmo','other')
);
