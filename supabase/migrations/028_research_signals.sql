-- Research signals table for publications, preprints, patents, and funding data
-- Stores intelligence signals from PubMed, bioRxiv/medRxiv, NIH RePORTER, and USPTO

CREATE TABLE IF NOT EXISTS research_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source identification
  source_type TEXT NOT NULL CHECK (source_type IN ('pubmed', 'preprint', 'nih_grant', 'patent')),
  source_id TEXT NOT NULL,
  source_url TEXT,

  -- Content
  title TEXT NOT NULL,
  abstract TEXT,
  authors TEXT[] DEFAULT '{}',
  journal TEXT,
  published_date DATE,
  doi TEXT,
  mesh_terms TEXT[] DEFAULT '{}',

  -- Classification
  therapeutic_area TEXT,
  signal_type TEXT NOT NULL CHECK (signal_type IN ('publication', 'preprint', 'funding', 'patent')),

  -- NIH-specific fields
  funding_amount_usd NUMERIC,
  organization_name TEXT,

  -- Metadata
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Prevent duplicates
  UNIQUE(source_type, source_id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_research_signals_source_type ON research_signals(source_type);
CREATE INDEX IF NOT EXISTS idx_research_signals_therapeutic_area ON research_signals(therapeutic_area);
CREATE INDEX IF NOT EXISTS idx_research_signals_signal_type ON research_signals(signal_type);
CREATE INDEX IF NOT EXISTS idx_research_signals_published_date ON research_signals(published_date DESC);
CREATE INDEX IF NOT EXISTS idx_research_signals_source_id ON research_signals(source_id);
CREATE INDEX IF NOT EXISTS idx_research_signals_organization ON research_signals(organization_name) WHERE organization_name IS NOT NULL;

-- Enable RLS
ALTER TABLE research_signals ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (cron jobs use service role)
CREATE POLICY "Service role full access" ON research_signals
  FOR ALL USING (true) WITH CHECK (true);

-- Allow authenticated users to read
CREATE POLICY "Authenticated users can read" ON research_signals
  FOR SELECT TO authenticated USING (true);

-- Comment
COMMENT ON TABLE research_signals IS 'Intelligence signals from academic publications, preprints, NIH grants, and patents. Fed by PubMed, bioRxiv/medRxiv, NIH RePORTER, and USPTO PatentsView APIs.';
