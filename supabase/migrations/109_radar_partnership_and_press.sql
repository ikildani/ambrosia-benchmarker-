-- 109: Asset Radar partnership refresh + press_releases writer
--
-- Part A: clinical_assets gains an evidence trail, a confidence and a refresh
-- cursor for the standalone partnership detector (lib/radar/partnership.ts,
-- /api/cron/partnership-refresh). partner_company_id already exists from 090;
-- the ADD COLUMN IF NOT EXISTS is defensive.
--
-- Part B: press_releases becomes the persisted store for every RSS item the
-- press-release ingester fetches (lib/ingestion/press-releases.ts). Five of the
-- nine licensing-intent factors read this table and nothing wrote to it.

-- ══════════════════════════════════════════════════════════════════════
-- PART A: clinical_assets partnership columns
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE clinical_assets
  ADD COLUMN IF NOT EXISTS partner_company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS partnership_evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS partnership_confidence INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS partnership_checked_at TIMESTAMPTZ;

ALTER TABLE clinical_assets DROP CONSTRAINT IF EXISTS clinical_assets_partnership_confidence_check;
ALTER TABLE clinical_assets ADD CONSTRAINT clinical_assets_partnership_confidence_check
  CHECK (partnership_confidence >= 0 AND partnership_confidence <= 100);

-- Refresh queue: oldest (NULL first) partnership_checked_at is processed first.
CREATE INDEX IF NOT EXISTS idx_clinical_assets_partnership_checked
  ON clinical_assets (partnership_checked_at ASC NULLS FIRST);

CREATE INDEX IF NOT EXISTS idx_clinical_assets_partner_company
  ON clinical_assets (partner_company_id)
  WHERE partner_company_id IS NOT NULL;

COMMENT ON COLUMN clinical_assets.partnership_evidence IS
  'Array of {type: deal|trial_collaborator|press_release, id, url, date, note} written by lib/radar/partnership.ts. A row with a deal entry is deal-confirmed and is never downgraded on weaker evidence alone.';
COMMENT ON COLUMN clinical_assets.partnership_confidence IS
  '0-100. Deal-backed >= 80 (65 when territory undisclosed); press-only <= 70; trial-collaborator-only <= 60.';
COMMENT ON COLUMN clinical_assets.partnership_checked_at IS
  'Last run of the partnership refresh cron. NULL = never checked by the standalone detector.';
COMMENT ON COLUMN clinical_assets.territory_rights_available IS
  'Regions still available from {us, eu, japan, china, row}. [''global''] = no confirmed territorial grant; [] = every region granted.';

-- ══════════════════════════════════════════════════════════════════════
-- PART B: press_releases as a persisted feed store
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE press_releases
  ADD COLUMN IF NOT EXISTS feed TEXT,
  ADD COLUMN IF NOT EXISTS company_ids UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS categories TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS content_hash TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- `source` is the wire family; `feed` is the specific RSS feed name.
ALTER TABLE press_releases DROP CONSTRAINT IF EXISTS press_releases_source_check;
ALTER TABLE press_releases ADD CONSTRAINT press_releases_source_check
  CHECK (source IN ('globenewswire', 'businesswire', 'prnewswire', 'company', 'news', 'other'));

-- One row per URL regardless of which feed carried it. The table has never
-- been written in production; the DELETE only matters if a manual insert
-- ever created a duplicate URL under two sources.
DELETE FROM press_releases a
USING press_releases b
WHERE a.source_url = b.source_url
  AND a.ctid > b.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS uq_press_releases_source_url
  ON press_releases (source_url);

CREATE INDEX IF NOT EXISTS idx_press_releases_categories
  ON press_releases USING GIN (categories);
CREATE INDEX IF NOT EXISTS idx_press_releases_company_ids
  ON press_releases USING GIN (company_ids);
CREATE INDEX IF NOT EXISTS idx_press_releases_feed
  ON press_releases (feed);
CREATE INDEX IF NOT EXISTS idx_press_releases_content_hash
  ON press_releases (content_hash)
  WHERE content_hash IS NOT NULL;

DROP TRIGGER IF EXISTS update_press_releases_updated_at ON press_releases;
CREATE TRIGGER update_press_releases_updated_at
  BEFORE UPDATE ON press_releases
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON COLUMN press_releases.companies_mentioned IS
  'Canonical companies.name values resolved case-insensitively against companies.name and name_variations. lib/radar/signal-detection.ts filters with .overlaps(companies_mentioned, [company.name]).';
COMMENT ON COLUMN press_releases.company_ids IS
  'companies.id for each entry of companies_mentioned, same order.';
COMMENT ON COLUMN press_releases.categories IS
  'Keyword classifier output: licensing, m&a, financing, clinical, regulatory, executive_hire, conference, layoffs, strategic_review.';
COMMENT ON COLUMN press_releases.feed IS
  'FEED_SOURCES name in lib/ingestion/press-releases.ts (e.g. GlobeNewswire_Licensing, Endpoints_News).';
COMMENT ON COLUMN press_releases.raw IS
  'Original RSS item fields (title, link, guid, pubDate, feed, page) for reprocessing.';
