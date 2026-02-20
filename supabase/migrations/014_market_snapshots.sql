-- Migration: 014_market_snapshots.sql
-- Creates market_snapshots table for Market Pulse feature
-- Creates processed_webhook_events table for Stripe webhook deduplication
-- Fixes therapeutic_area data inconsistencies

-- =============================================
-- 1. Market Snapshots table (for /pulse page and weekly digest)
-- =============================================

CREATE TABLE IF NOT EXISTS market_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date DATE NOT NULL,
  snapshot_type TEXT NOT NULL DEFAULT 'weekly',
  new_deals_count INTEGER NOT NULL DEFAULT 0,
  total_upfront_usd NUMERIC,
  avg_upfront_usd NUMERIC,
  modality_breakdown JSONB DEFAULT '{}',
  therapeutic_area_breakdown JSONB DEFAULT '{}',
  phase_breakdown JSONB DEFAULT '{}',
  notable_deals JSONB DEFAULT '[]',
  benchmark_changes JSONB DEFAULT '{}',
  trial_updates JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_snapshot_date_type UNIQUE (snapshot_date, snapshot_type)
);

CREATE INDEX IF NOT EXISTS idx_market_snapshots_date ON market_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_market_snapshots_type ON market_snapshots(snapshot_type);

-- RLS
ALTER TABLE market_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage market_snapshots"
  ON market_snapshots FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Authenticated users can read market_snapshots"
  ON market_snapshots FOR SELECT
  USING (auth.role() = 'authenticated');

-- =============================================
-- 2. Processed Webhook Events table (Stripe dedup)
-- =============================================

CREATE TABLE IF NOT EXISTS processed_webhook_events (
  stripe_event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_processed_events_processed_at
  ON processed_webhook_events(processed_at);

-- RLS
ALTER TABLE processed_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage processed_webhook_events"
  ON processed_webhook_events FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- =============================================
-- 3. Data remediation: Fix therapeutic_area inconsistencies
-- =============================================

-- Fix autoimmune -> immunology (aligns with product's 3 TAs: oncology, neurology, immunology)
UPDATE deals SET therapeutic_area = 'immunology' WHERE therapeutic_area = 'autoimmune';

-- Fix null-indication deals incorrectly tagged as oncology -> other
UPDATE deals SET therapeutic_area = 'other'
WHERE indication_category IS NULL
  AND indication_specific IS NULL
  AND therapeutic_area = 'oncology';
