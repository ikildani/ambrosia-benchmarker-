-- Asset Radar Layer 2: Licensing Signal Detection
-- Per-asset signal records from 9 detection channels.
-- Each row = one detected signal with evidence, confidence, and decay.
-- Composite licensing_intent_score written back to clinical_assets.

-- ══════════════════════════════════════════════════════════════════════
-- LICENSING SIGNALS TABLE
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE licensing_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Link to asset
  asset_id UUID NOT NULL REFERENCES clinical_assets(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  company_name TEXT NOT NULL,

  -- Signal classification
  signal_type TEXT NOT NULL CHECK (signal_type IN (
    'cash_runway',
    'bd_executive_hire',
    'conference_activity',
    'regulatory_milestone',
    'competitor_failure',
    'management_commentary',
    'patent_filing',
    'publication_velocity',
    'strategic_review'
  )),

  -- Signal strength
  signal_value NUMERIC NOT NULL CHECK (signal_value >= 0 AND signal_value <= 100),
  confidence NUMERIC NOT NULL DEFAULT 50 CHECK (confidence >= 0 AND confidence <= 100),
  direction TEXT NOT NULL DEFAULT 'bullish' CHECK (direction IN ('bullish', 'bearish', 'neutral')),

  -- Evidence chain (institutional-grade audit trail)
  evidence_text TEXT,
  evidence_url TEXT,
  evidence_source TEXT,
  evidence_date DATE,
  evidence_metadata JSONB DEFAULT '{}',

  -- Temporal
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Deduplication
  signal_hash TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════════════
-- SIGNAL SCORE SNAPSHOTS (time-series for trend analysis)
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE asset_signal_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES clinical_assets(id) ON DELETE CASCADE,

  licensing_intent_score NUMERIC NOT NULL,
  competitive_heat NUMERIC NOT NULL DEFAULT 0,
  deal_readiness_score NUMERIC NOT NULL DEFAULT 0,

  -- Per-factor breakdown at snapshot time
  factor_scores JSONB NOT NULL DEFAULT '{}',

  -- Trend
  score_delta NUMERIC DEFAULT 0,
  trend TEXT DEFAULT 'stable' CHECK (trend IN ('surging', 'rising', 'stable', 'cooling', 'declining')),

  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_asset_snapshot UNIQUE (asset_id, snapshot_date)
);

-- ══════════════════════════════════════════════════════════════════════
-- INDEXES — licensing_signals
-- ══════════════════════════════════════════════════════════════════════

CREATE INDEX idx_licensing_signals_asset ON licensing_signals(asset_id);
CREATE INDEX idx_licensing_signals_company ON licensing_signals(company_id);
CREATE INDEX idx_licensing_signals_type ON licensing_signals(signal_type);
CREATE INDEX idx_licensing_signals_active ON licensing_signals(is_active)
  WHERE is_active = true;
CREATE INDEX idx_licensing_signals_value ON licensing_signals(signal_value DESC)
  WHERE is_active = true;
CREATE INDEX idx_licensing_signals_detected ON licensing_signals(detected_at DESC);
CREATE INDEX idx_licensing_signals_hash ON licensing_signals(signal_hash)
  WHERE signal_hash IS NOT NULL;

-- Composite: active signals for an asset sorted by strength
CREATE INDEX idx_licensing_signals_asset_active
  ON licensing_signals(asset_id, signal_type, signal_value DESC)
  WHERE is_active = true;

-- ══════════════════════════════════════════════════════════════════════
-- INDEXES — asset_signal_snapshots
-- ══════════════════════════════════════════════════════════════════════

CREATE INDEX idx_signal_snapshots_asset ON asset_signal_snapshots(asset_id, snapshot_date DESC);
CREATE INDEX idx_signal_snapshots_date ON asset_signal_snapshots(snapshot_date DESC);
CREATE INDEX idx_signal_snapshots_trend ON asset_signal_snapshots(trend)
  WHERE trend IN ('surging', 'rising');

-- ══════════════════════════════════════════════════════════════════════
-- RLS
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE licensing_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_signal_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read licensing signals"
  ON licensing_signals FOR SELECT USING (true);

CREATE POLICY "Service role full access licensing signals"
  ON licensing_signals FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Public read signal snapshots"
  ON asset_signal_snapshots FOR SELECT USING (true);

CREATE POLICY "Service role full access signal snapshots"
  ON asset_signal_snapshots FOR ALL
  USING (auth.role() = 'service_role');

-- ══════════════════════════════════════════════════════════════════════
-- TRIGGERS
-- ══════════════════════════════════════════════════════════════════════

CREATE TRIGGER update_licensing_signals_updated_at
  BEFORE UPDATE ON licensing_signals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ══════════════════════════════════════════════════════════════════════
-- CONSTRAINT UPDATES
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE data_ingestion_log DROP CONSTRAINT IF EXISTS data_ingestion_log_source_check;
