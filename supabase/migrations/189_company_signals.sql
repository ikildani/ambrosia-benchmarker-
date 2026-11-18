-- 189: free company signals for the Search & Evaluation licensing-intent model.
--
-- The model leaned on owner type and asset age because company-level evidence was thin
-- (Nov 17 2026: of 3,701 US feed companies 543 had a CIK; of 2,263 Chinese feed companies 5
-- had financials; company_intent_signals depends on a classifier that is out of credits).
-- This migration stores three rule-based, free sources:
--
--   HKEX     companies.hkex_* (listing match against HKEX's List of Securities) and
--            HKEXnews announcement titles classified by rules (lib/ingestion/hkex-signals.ts):
--            placings / subscriptions / rights issues -> company_financing_events;
--            licensing agreements, strategic reviews, profit warnings, major transactions,
--            executive changes -> company_intent_signals (source_type 'hkex_announcement').
--   Form D   SEC Regulation D notices of US private companies (lib/ingestion/form-d.ts)
--            -> company_financing_events (source 'sec_form_d'); companies.form_d_cik.
--   10-K     EDGAR filer search for US companies company_tickers.json does not list:
--            an active filer's CIK goes to companies.cik (the financials cron picks it up);
--            a filer that stopped filing is kept apart in companies.sec_inactive_cik so its
--            aged XBRL never reads as zero runway in live scoring.
--
-- Invariant: no financing event or intent signal without a source_url and verbatim evidence.
-- Apply after 188. Idempotent.

-- ── companies: listing and filer identifiers ─────────────────────────────────

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS hkex_stock_code   text,
  ADD COLUMN IF NOT EXISTS hkex_stock_id     bigint,
  ADD COLUMN IF NOT EXISTS hkex_short_name   text,
  ADD COLUMN IF NOT EXISTS hkex_match_method text,
  ADD COLUMN IF NOT EXISTS hkex_matched_at   timestamptz,
  ADD COLUMN IF NOT EXISTS form_d_cik        text,
  ADD COLUMN IF NOT EXISTS form_d_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS sec_inactive_cik  text,
  ADD COLUMN IF NOT EXISTS sec_last_10k_at   date;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'companies_hkex_match_method_check') THEN
    ALTER TABLE public.companies ADD CONSTRAINT companies_hkex_match_method_check
      CHECK (hkex_match_method IS NULL OR hkex_match_method IN ('verified_map', 'name_core'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'companies_hkex_stock_code_format') THEN
    ALTER TABLE public.companies ADD CONSTRAINT companies_hkex_stock_code_format
      CHECK (hkex_stock_code IS NULL OR hkex_stock_code ~ '^[0-9]{5}$');
  END IF;
END $$;

-- One live company row per HKEX stock code (the matcher clears a stale holder before reassigning).
CREATE UNIQUE INDEX IF NOT EXISTS uq_companies_hkex_stock_code
  ON public.companies (hkex_stock_code) WHERE hkex_stock_code IS NOT NULL AND merged_into IS NULL;
CREATE INDEX IF NOT EXISTS idx_companies_hkex_stock_id
  ON public.companies (id) WHERE hkex_stock_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_companies_form_d_cik
  ON public.companies (form_d_cik) WHERE form_d_cik IS NOT NULL;

COMMENT ON COLUMN public.companies.hkex_stock_code IS
  'HKEX stock code (5 digits) of the listed issuer, from the List of Securities. verified_map = hand-checked (scripts/data/hkex-biotech-map-*.json); name_core = conservative short-name match (migration 189).';
COMMENT ON COLUMN public.companies.hkex_stock_id IS 'HKEXnews internal stock id (activestock_sehk_e.json "i"); the announcement title search needs it.';
COMMENT ON COLUMN public.companies.form_d_cik IS 'CIK under which this private company files SEC Form D (exact filer-name match, health-care industry group). Not a public-filer CIK.';
COMMENT ON COLUMN public.companies.form_d_checked_at IS 'Last Form D / 10-K filer search for this company (queue order for the form_d mode).';
COMMENT ON COLUMN public.companies.sec_inactive_cik IS 'CIK of a 10-K filer that stopped filing (acquired or delisted). Kept out of companies.cik so stale XBRL is never scored as live runway.';
COMMENT ON COLUMN public.companies.sec_last_10k_at IS 'Filing date of the latest 10-K found by the filer search.';

-- ── company_financing_events ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.company_financing_events (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id         uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  event_type         text NOT NULL CHECK (event_type IN (
                       'placing', 'share_subscription', 'rights_issue', 'open_offer', 'convertible_bonds',
                       'form_d', 'form_d_amendment')),
  amount_usd         numeric CHECK (amount_usd IS NULL OR amount_usd >= 0),
  amount_offered_usd numeric CHECK (amount_offered_usd IS NULL OR amount_offered_usd >= 0),
  currency           text,
  announced_at       date NOT NULL,
  source             text NOT NULL CHECK (source IN ('hkex_announcement', 'sec_form_d')),
  source_url         text NOT NULL CHECK (source_url ~ '^https://'),
  source_id          text NOT NULL,
  evidence           text NOT NULL CHECK (char_length(evidence) BETWEEN 1 AND 1000),
  industry_group     text,
  filer_cik          text,
  metadata           jsonb NOT NULL DEFAULT '{}'::jsonb,
  fetched_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_financing_events_uq UNIQUE (company_id, source, source_id)
);

CREATE INDEX IF NOT EXISTS idx_company_financing_events_company_announced
  ON public.company_financing_events (company_id, announced_at DESC);
CREATE INDEX IF NOT EXISTS idx_company_financing_events_source
  ON public.company_financing_events (source, announced_at DESC);

COMMENT ON TABLE public.company_financing_events IS
  'One row per primary-source financing document. hkex_announcement: placing / subscription / rights issue / open offer / convertible bonds announced on HKEXnews (evidence = verbatim title, amount not parsed). sec_form_d: Regulation D notice (evidence = filed values verbatim; amount_usd = totalAmountSold, amount_offered_usd = totalOfferingAmount, null when indefinite). announced_at is the date the document became public, so point-in-time features key on it; form_d_amendment rows never count as a new raise. Migration 189.';

ALTER TABLE public.company_financing_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access company_financing_events" ON public.company_financing_events;
CREATE POLICY "Service role full access company_financing_events"
  ON public.company_financing_events FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── company_intent_signals: rule-based HKEX types ───────────────────────────

ALTER TABLE public.company_intent_signals DROP CONSTRAINT IF EXISTS company_intent_signals_signal_type_check;
ALTER TABLE public.company_intent_signals ADD CONSTRAINT company_intent_signals_signal_type_check
  CHECK (signal_type IN (
    'seeking_partner', 'retaining_rights', 'strategic_review', 'restructuring', 'bd_hire',
    'cfo_cbo_change', 'layoffs', 'pipeline_prioritization', 'going_concern_language',
    -- 189: HKEX announcement titles (rules, model 'rules:hkex-title-v1')
    'licensing_agreement', 'profit_warning', 'major_transaction', 'executive_change'));

ALTER TABLE public.company_intent_signals DROP CONSTRAINT IF EXISTS company_intent_signals_source_type_check;
ALTER TABLE public.company_intent_signals ADD CONSTRAINT company_intent_signals_source_type_check
  CHECK (source_type IN ('press_release', '10k', '10q', '8k', 'earnings_call', 'job_posting', 'hkex_announcement'));

-- ── Work queues (service role only) ─────────────────────────────────────────

-- Industry companies that own a feed program (program_primary), paged by id.
CREATE OR REPLACE FUNCTION public.company_signal_feed_companies(p_after uuid DEFAULT NULL, p_limit integer DEFAULT 1000)
RETURNS TABLE (id uuid, name text, name_variations text[], country text, hkex_stock_code text, hkex_match_method text)
LANGUAGE sql STABLE
SET statement_timeout TO '60s'
AS $$
  SELECT c.id, c.name, c.name_variations, COALESCE(c.hq_country, c.headquarters_country), c.hkex_stock_code, c.hkex_match_method
  FROM public.companies c
  WHERE c.owner_type = 'industry'
    AND c.merged_into IS NULL
    AND (p_after IS NULL OR c.id > p_after)
    AND EXISTS (SELECT 1 FROM public.clinical_assets a WHERE a.company_id = c.id AND a.program_primary)
  ORDER BY c.id
  LIMIT GREATEST(1, LEAST(p_limit, 5000));
$$;
REVOKE ALL ON FUNCTION public.company_signal_feed_companies(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.company_signal_feed_companies(uuid, integer) TO service_role;

-- US feed companies without a public-filer CIK, least recently checked first. Never-checked
-- companies come first; unmatched ones are re-searched after p_recheck_days, companies with a
-- Form D CIK refresh after p_refresh_days.
CREATE OR REPLACE FUNCTION public.company_signal_form_d_candidates(p_limit integer DEFAULT 80, p_recheck_days integer DEFAULT 90, p_refresh_days integer DEFAULT 7)
RETURNS TABLE (id uuid, name text, name_variations text[], form_d_cik text, form_d_checked_at timestamptz)
LANGUAGE sql STABLE
SET statement_timeout TO '60s'
AS $$
  SELECT c.id, c.name, c.name_variations, c.form_d_cik, c.form_d_checked_at
  FROM public.companies c
  WHERE c.owner_type = 'industry'
    AND c.merged_into IS NULL
    AND c.cik IS NULL
    AND c.sec_cik IS NULL
    AND COALESCE(c.hq_country, c.headquarters_country) IN ('US', 'United States', 'USA')
    AND (
      c.form_d_checked_at IS NULL
      OR (c.form_d_cik IS NULL AND c.form_d_checked_at < now() - make_interval(days => p_recheck_days))
      OR (c.form_d_cik IS NOT NULL AND c.form_d_checked_at < now() - make_interval(days => p_refresh_days))
    )
    AND EXISTS (SELECT 1 FROM public.clinical_assets a WHERE a.company_id = c.id AND a.program_primary)
  ORDER BY c.form_d_checked_at NULLS FIRST, c.id
  LIMIT GREATEST(1, LEAST(p_limit, 500));
$$;
REVOKE ALL ON FUNCTION public.company_signal_form_d_candidates(integer, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.company_signal_form_d_candidates(integer, integer, integer) TO service_role;
