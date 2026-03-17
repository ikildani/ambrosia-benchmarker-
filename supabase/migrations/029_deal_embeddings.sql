-- Enable pgvector extension for semantic deal matching
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to deals table
-- 2,560 dimensions from Perplexity pplx-embed-v1-4b model (base64_int8 encoding)
ALTER TABLE deals ADD COLUMN IF NOT EXISTS embedding vector(2560);

-- Semantic deal search function
CREATE OR REPLACE FUNCTION match_deals(
  query_embedding vector(2560),
  match_count int DEFAULT 10,
  match_threshold float DEFAULT 0.3,
  filter_ta text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  licensor_name text,
  licensee_name text,
  asset_name text,
  asset_description text,
  deal_type text,
  therapeutic_area text,
  modality text,
  indication_specific text,
  phase_at_signing text,
  territory text,
  upfront_usd numeric,
  milestones_total_usd numeric,
  total_deal_value_usd numeric,
  royalty_low_pct numeric,
  royalty_high_pct numeric,
  announced_date date,
  confidence_score integer,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id, d.licensor_name, d.licensee_name, d.asset_name, d.asset_description,
    d.deal_type, d.therapeutic_area, d.modality, d.indication_specific,
    d.phase_at_signing, d.territory, d.upfront_usd, d.milestones_total_usd,
    d.total_deal_value_usd, d.royalty_low_pct, d.royalty_high_pct,
    d.announced_date, d.confidence_score,
    1 - (d.embedding <=> query_embedding) AS similarity
  FROM deals d
  WHERE d.embedding IS NOT NULL
    AND d.therapeutic_area != 'other'
    AND (filter_ta IS NULL OR d.therapeutic_area = filter_ta)
    AND 1 - (d.embedding <=> query_embedding) > match_threshold
  ORDER BY d.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
