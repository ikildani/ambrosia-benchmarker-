-- Asset Radar: Watchlist, Notes, and Collaboration
-- User-level asset tracking with score-change alerts,
-- team notes, and tags for institutional workflow.

-- ══════════════════════════════════════════════════════════════════════
-- WATCHLIST
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS radar_watchlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES clinical_assets(id) ON DELETE CASCADE,

  -- Tracking
  added_at TIMESTAMPTZ DEFAULT NOW(),
  score_at_add NUMERIC DEFAULT 0,
  last_notified_at TIMESTAMPTZ,

  -- Organization
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('high', 'normal', 'low')),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_user_asset_watch UNIQUE (user_id, asset_id)
);

-- ══════════════════════════════════════════════════════════════════════
-- ASSET NOTES (team collaboration)
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS radar_asset_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES clinical_assets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  user_name TEXT,
  user_email TEXT,

  note_text TEXT NOT NULL,
  note_type TEXT DEFAULT 'general' CHECK (note_type IN ('general', 'clinical', 'commercial', 'regulatory', 'competitive', 'risk')),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════════════
-- ASSET COMPARISONS (saved comparison sets)
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS radar_comparisons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  asset_ids UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════════════
-- INDEXES
-- ══════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_radar_watchlist_user ON radar_watchlist(user_id);
CREATE INDEX IF NOT EXISTS idx_radar_watchlist_asset ON radar_watchlist(asset_id);
CREATE INDEX IF NOT EXISTS idx_radar_watchlist_user_asset ON radar_watchlist(user_id, asset_id);
CREATE INDEX IF NOT EXISTS idx_radar_watchlist_priority ON radar_watchlist(priority) WHERE priority = 'high';
CREATE INDEX IF NOT EXISTS idx_radar_watchlist_tags ON radar_watchlist USING GIN (tags);

CREATE INDEX IF NOT EXISTS idx_radar_notes_asset ON radar_asset_notes(asset_id);
CREATE INDEX IF NOT EXISTS idx_radar_notes_user ON radar_asset_notes(user_id);

CREATE INDEX IF NOT EXISTS idx_radar_comparisons_user ON radar_comparisons(user_id);

-- ══════════════════════════════════════════════════════════════════════
-- RLS
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE radar_watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE radar_asset_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE radar_comparisons ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users manage own watchlist" ON radar_watchlist FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role full access watchlist" ON radar_watchlist FOR ALL USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users read all notes" ON radar_asset_notes FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users manage own notes" ON radar_asset_notes FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users delete own notes" ON radar_asset_notes FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role full access notes" ON radar_asset_notes FOR ALL USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users manage own comparisons" ON radar_comparisons FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role full access comparisons" ON radar_comparisons FOR ALL USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
