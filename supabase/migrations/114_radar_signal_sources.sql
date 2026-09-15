-- 114_radar_signal_sources.sql
--
-- Asset Radar Phase 3 (Workstream C): primary-source inputs for the
-- licensing-intent factors that were dead or constant.
--
--   company_financials      SEC XBRL cash / burn / runway / going-concern / ATM
--                           (lib/ingestion/company-financials.ts)
--   company_intent_signals  Management-intent language with the verbatim quote
--                           and URL (lib/ingestion/management-intent.ts)
--   company_patents         PatentsView by assignee for every originator
--                           (lib/ingestion/patents-assignee.ts)
--   radar_patent_velocity   Rolling 12-month filings vs prior 12 (view)
--   asset_catalysts         Primary completion, PDUFA, conference, readouts
--                           (lib/ingestion/catalysts.ts)
--   companies.cik           SEC Central Index Key (backfilled from sec_cik)
--
-- Every row carries source_url, an as-of date and fetched_at. These schemas
-- are a contract with the Workstream D detectors and backtest: change them
-- there and here together.
--
-- RLS: service_role only, like migration 101. Idempotent: safe to re-run.

BEGIN;

-- ── companies.cik ────────────────────────────────────────────────────────────

ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS cik TEXT;

-- Migration 019 added sec_cik for the revenue pipeline; seed the new column
-- from it so both pipelines agree. cik is stored zero-stripped (e.g. '1682852').
UPDATE public.companies
SET cik = ltrim(sec_cik, '0')
WHERE cik IS NULL AND sec_cik IS NOT NULL AND ltrim(sec_cik, '0') <> '';

CREATE INDEX IF NOT EXISTS idx_companies_cik_radar
  ON public.companies (cik)
  WHERE cik IS NOT NULL;

COMMENT ON COLUMN public.companies.cik IS
  'SEC Central Index Key without leading zeros. Resolved by lib/ingestion/company-financials.ts from company_tickers.json (ticker, then normalized name). NULL = not an SEC filer or not yet resolved.';

-- ── company_financials ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.company_financials (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id             UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  cik                    TEXT,
  fiscal_period_end      DATE NOT NULL,
  period_type            TEXT NOT NULL CHECK (period_type IN ('Q', 'FY')),
  cash_and_equivalents   NUMERIC,
  short_term_investments NUMERIC,
  total_liquidity        NUMERIC,
  operating_cash_flow    NUMERIC,
  net_loss               NUMERIC,
  quarterly_burn         NUMERIC,
  runway_months          NUMERIC,
  going_concern          BOOLEAN,
  atm_or_shelf_filed     BOOLEAN,
  shares_outstanding     NUMERIC,
  market_cap_usd         NUMERIC,
  source                 TEXT NOT NULL DEFAULT 'sec_xbrl' CHECK (source IN ('sec_xbrl', 'manual')),
  source_url             TEXT NOT NULL,
  filed_at               DATE,
  fetched_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT company_financials_period_uq UNIQUE (company_id, fiscal_period_end, period_type)
);

CREATE INDEX IF NOT EXISTS idx_company_financials_company_period
  ON public.company_financials (company_id, fiscal_period_end DESC);
CREATE INDEX IF NOT EXISTS idx_company_financials_runway
  ON public.company_financials (runway_months)
  WHERE runway_months IS NOT NULL;

COMMENT ON TABLE public.company_financials IS
  'One row per company per fiscal period from SEC XBRL companyfacts. quarterly_burn = trailing two-quarter average of negative operating cash flow (positive number, USD); runway_months = total_liquidity / (quarterly_burn / 3). going_concern = "substantial doubt" language in the latest 10-K/10-Q; atm_or_shelf_filed = S-3 / S-3ASR / 424B5 in the trailing 12 months.';
COMMENT ON COLUMN public.company_financials.operating_cash_flow IS
  'Quarterly (de-cumulated) NetCashProvidedByUsedInOperatingActivities for the period, USD. Negative = cash used.';
COMMENT ON COLUMN public.company_financials.market_cap_usd IS
  'NULL until a price source is wired; shares_outstanding is stored so it can be derived later.';

ALTER TABLE public.company_financials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access company_financials" ON public.company_financials;
CREATE POLICY "Service role full access company_financials"
  ON public.company_financials FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── company_intent_signals ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.company_intent_signals (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  signal_type  TEXT NOT NULL CHECK (signal_type IN (
                 'seeking_partner', 'retaining_rights', 'strategic_review', 'restructuring',
                 'bd_hire', 'cfo_cbo_change', 'layoffs', 'pipeline_prioritization',
                 'going_concern_language')),
  polarity     TEXT NOT NULL CHECK (polarity IN ('bullish', 'bearish', 'neutral')),
  stance       TEXT,
  quote        TEXT NOT NULL CHECK (char_length(quote) BETWEEN 1 AND 400),
  source_type  TEXT NOT NULL CHECK (source_type IN ('press_release', '10k', '10q', '8k', 'earnings_call', 'job_posting')),
  source_id    TEXT NOT NULL,
  source_url   TEXT NOT NULL,
  observed_at  DATE NOT NULL,
  confidence   INTEGER NOT NULL DEFAULT 0 CHECK (confidence >= 0 AND confidence <= 100),
  model        TEXT,
  fetched_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT company_intent_signals_uq UNIQUE (company_id, signal_type, source_type, source_id)
);

CREATE INDEX IF NOT EXISTS idx_company_intent_signals_company_observed
  ON public.company_intent_signals (company_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_company_intent_signals_type
  ON public.company_intent_signals (signal_type, polarity);

COMMENT ON TABLE public.company_intent_signals IS
  'Management-intent language classified by claude-sonnet-5 over press releases and 10-K/10-Q MD&A/liquidity paragraphs. polarity: bullish = more likely to out-license, bearish = less likely (retaining rights), neutral = context. quote is verbatim (<= 400 chars) and source_url points at the document; rows without both are never written.';

ALTER TABLE public.company_intent_signals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access company_intent_signals" ON public.company_intent_signals;
CREATE POLICY "Service role full access company_intent_signals"
  ON public.company_intent_signals FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── company_patents ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.company_patents (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  patent_id      TEXT NOT NULL,
  title          TEXT,
  assignee_raw   TEXT,
  filing_date    DATE,
  grant_date     DATE,
  cpc_codes      TEXT[] NOT NULL DEFAULT '{}',
  abstract       TEXT,
  drug_master_id UUID REFERENCES public.drug_master(id) ON DELETE SET NULL,
  source         TEXT NOT NULL DEFAULT 'patentsview' CHECK (source IN ('patentsview')),
  source_url     TEXT NOT NULL,
  fetched_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT company_patents_uq UNIQUE (patent_id, company_id)
);

CREATE INDEX IF NOT EXISTS idx_company_patents_company_filing
  ON public.company_patents (company_id, filing_date DESC);
CREATE INDEX IF NOT EXISTS idx_company_patents_drug
  ON public.company_patents (drug_master_id)
  WHERE drug_master_id IS NOT NULL;

COMMENT ON TABLE public.company_patents IS
  'Granted US patents from PatentsView (search.patentsview.org v1) by assignee organization, CPC A61K / A61P / C07 / C12N, filed 2015+. drug_master_id is set when a development code or INN alias from drug_aliases appears in the title or abstract.';

ALTER TABLE public.company_patents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access company_patents" ON public.company_patents;
CREATE POLICY "Service role full access company_patents"
  ON public.company_patents FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Rolling velocity: filings in the last 12 months vs the 12 before that.
CREATE OR REPLACE VIEW public.radar_patent_velocity AS
SELECT
  company_id,
  COUNT(*) FILTER (WHERE filing_date >= (CURRENT_DATE - INTERVAL '12 months'))::INTEGER AS filed_last_12m,
  COUNT(*) FILTER (WHERE filing_date >= (CURRENT_DATE - INTERVAL '24 months')
                     AND filing_date <  (CURRENT_DATE - INTERVAL '12 months'))::INTEGER AS filed_prior_12m,
  COUNT(*) FILTER (WHERE filing_date >= (CURRENT_DATE - INTERVAL '12 months')
                     AND drug_master_id IS NOT NULL)::INTEGER AS linked_last_12m,
  MAX(filing_date) AS last_filing_date,
  COUNT(*)::INTEGER AS total_patents,
  CASE
    WHEN COUNT(*) FILTER (WHERE filing_date >= (CURRENT_DATE - INTERVAL '24 months')
                            AND filing_date <  (CURRENT_DATE - INTERVAL '12 months')) = 0
      THEN NULL
    ELSE ROUND(
      COUNT(*) FILTER (WHERE filing_date >= (CURRENT_DATE - INTERVAL '12 months'))::NUMERIC
      / COUNT(*) FILTER (WHERE filing_date >= (CURRENT_DATE - INTERVAL '24 months')
                           AND filing_date <  (CURRENT_DATE - INTERVAL '12 months'))::NUMERIC, 3)
  END AS velocity_ratio
FROM public.company_patents
WHERE filing_date IS NOT NULL
GROUP BY company_id;

COMMENT ON VIEW public.radar_patent_velocity IS
  'Per company: patents filed in the rolling last 12 months vs the prior 12 (velocity_ratio = last / prior, NULL when prior = 0). Read by the patent-activity detector.';

-- Views inherit the caller's privileges on the base table, so anon/authenticated
-- (which have no policy on company_patents) see nothing. Revoke explicitly anyway.
REVOKE ALL ON public.radar_patent_velocity FROM anon, authenticated;
GRANT SELECT ON public.radar_patent_velocity TO service_role;

-- ── asset_catalysts ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.asset_catalysts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id      UUID NOT NULL REFERENCES public.clinical_assets(id) ON DELETE CASCADE,
  company_id    UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  catalyst_type TEXT NOT NULL CHECK (catalyst_type IN (
                  'primary_completion', 'study_completion', 'phase_transition',
                  'pdufa', 'readout_announced', 'conference_presentation')),
  expected_date DATE NOT NULL,
  observed_date DATE,
  nct_id        TEXT,
  -- Stored expression so the UNIQUE below behaves as
  -- UNIQUE(asset_id, catalyst_type, coalesce(nct_id, ''), expected_date) and
  -- PostgREST upserts can name it in on_conflict.
  nct_key       TEXT GENERATED ALWAYS AS (COALESCE(nct_id, '')) STORED,
  source        TEXT NOT NULL,
  source_url    TEXT NOT NULL,
  confidence    INTEGER NOT NULL DEFAULT 0 CHECK (confidence >= 0 AND confidence <= 100),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT asset_catalysts_uq UNIQUE (asset_id, catalyst_type, nct_key, expected_date)
);

CREATE INDEX IF NOT EXISTS idx_asset_catalysts_asset
  ON public.asset_catalysts (asset_id, expected_date);
CREATE INDEX IF NOT EXISTS idx_asset_catalysts_upcoming
  ON public.asset_catalysts (expected_date)
  WHERE observed_date IS NULL;
CREATE INDEX IF NOT EXISTS idx_asset_catalysts_company
  ON public.asset_catalysts (company_id)
  WHERE company_id IS NOT NULL;

DROP TRIGGER IF EXISTS update_asset_catalysts_updated_at ON public.asset_catalysts;
CREATE TRIGGER update_asset_catalysts_updated_at
  BEFORE UPDATE ON public.asset_catalysts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.asset_catalysts IS
  'Dated catalysts per clinical asset: trial primary/study completion (company_trials), phase transitions (clinical_assets.phase_history), PDUFA dates and conference presentations parsed from press_releases, readouts matched to the asset. observed_date is set when the date passes or a matching readout press release is found. Upsert on (asset_id, catalyst_type, nct_key, expected_date).';

ALTER TABLE public.asset_catalysts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access asset_catalysts" ON public.asset_catalysts;
CREATE POLICY "Service role full access asset_catalysts"
  ON public.asset_catalysts FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMIT;
