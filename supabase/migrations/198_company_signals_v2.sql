-- 198: company signals v2 for Search & Evaluation (scorecard metric company_signal_coverage).
--
-- Nov 23 2026: 1,154 of 9,820 feed companies (11.7%) had a financial, financing or intent row.
-- The model leaned on owner type and asset age because company evidence was missing for 88% of
-- owners. This migration adds three free, primary-source signal families and makes the coverage
-- definition explicit:
--
--   company_listings   Listed status from official exchange lists (SSE, SZSE, JPX, ASX, TSX/TSXV,
--                      Euronext, SIX, KRX, TWSE, TPEx, SEC company_tickers_exchange), HKEX from the
--                      189 listing match, and SEC filers that stopped filing periodic reports
--                      ('ceased_filing'). One row per company x exchange x ticker, with the match
--                      method and a resolution confidence. lib/ingestion/listings.ts.
--   company_grants     NIH SBIR/STTR awards (NIH RePORTER). Non-dilutive financing, kept apart from
--                      company_financing_events so the 189 financing features (which count every
--                      non-amendment event) do not change meaning. lib/ingestion/nih-grants.ts.
--   deal_record intent Out-licensing / in-licensing / acquired / acquirer signals derived from the
--                      canonical, cited deals ledger, only where the deal's party name agrees with
--                      the company's own name (company_signal_name_agreement >= 80).
--   IFRS financials    company_financials gains reporting_currency + fx_rate_to_usd: 20-F / 40-F
--                      filers report under ifrs-full in their own currency; amounts are stored in
--                      USD at the ECB reference rate of the period end (lib/ingestion/company-financials.ts).
--
-- Coverage (company_signal_covered): a company counts when it has its own row in any of
-- company_financials, company_listings, company_financing_events, company_grants or
-- company_intent_signals, OR when its corporate family root (companies.family_id, migration 193)
-- has financials or a live listing. Rationale: a listed parent's balance sheet and listing describe
-- the subsidiary's funding position; a parent's financing rounds, grants and intent statements do
-- not, so those never roll down. radar_qa_scorecard_stats() is patched in place to use it.
--
-- Invariant: every row carries source + https source_url + source id + evidence + confidence.
-- Apply after 197 (or after 194 if 195-197 are not applied; the scorecard patch is text-based and
-- fails loudly if the signal block it replaces is missing). Idempotent.

-- ── shared name keys ─────────────────────────────────────────────────────────

-- Core company-name key: lower case, legal forms AND sector words dropped, trailing "a X company" /
-- "now part of" clauses and parentheticals dropped. Used only to check that a structured record's
-- party name agrees with the company row it was resolved to (never to resolve on its own).
CREATE OR REPLACE FUNCTION public.company_signal_core_key(p text)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
  SELECT nullif(btrim(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
           lower(regexp_replace(regexp_replace(coalesce(p, ''), '\s*[,;]\s*(a|an|now|formerly|operating|part of|a wholly)\s.*$', '', 'i'), '\(.*$', '')),
           '&', ' and ', 'g'),
           '[^a-z0-9぀-ヿ一-鿿가-힯 ]+', ' ', 'g'),
           '\m(incorporated|inc|corporation|corp|company|co|limited|ltd|plc|llc|lp|llp|ag|sa|spa|srl|nv|bv|se|gmbh|kk|ab|as|asa|oy|oyj|pty|pte|the|holdings?|group|international|pharmaceuticals?|pharmaceutica|pharma|pharm|therapeutics|biotherapeutics|biosciences?|bioscience|biotechnology|biotech|bio|biopharma|biopharmaceuticals?|biologics|medicines?|medical|laboratories|laboratory|labs?|sciences?|life|healthcare|health|technologies|technology|usa|us)\M',
           ' ', 'g'),
           '\s+', ' ', 'g')), '');
$$;

-- Loose key: legal forms dropped, sector words kept ("G1 Therapeutics" -> "g1 therapeutics").
CREATE OR REPLACE FUNCTION public.company_signal_loose_key(p text)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
  SELECT nullif(btrim(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
           lower(regexp_replace(regexp_replace(coalesce(p, ''), '\s*[,;]\s*(a|an|now|formerly|operating|part of|a wholly)\s.*$', '', 'i'), '\(.*$', '')),
           '&', ' and ', 'g'),
           '[^a-z0-9\u3040-\u30ff\u4e00-\u9fff\uac00-\ud7af ]+', ' ', 'g'),
           '\m(incorporated|inc|corporation|corp|company|co|limited|ltd|plc|llc|lp|llp|ag|sa|spa|srl|nv|bv|se|gmbh|kk|ab|as|asa|oy|oyj|pty|pte|the|holdings?)\M',
           ' ', 'g'),
           '\s+', ' ', 'g')), '');
$$;

-- Agreement between a record's party name and a company row (name + variations):
-- 100 = equal loose keys or equal core keys; 80 = one core key is a word-prefix of the other;
-- 70 = every word of the shorter core key appears in the longer one; 0 = no agreement.
CREATE OR REPLACE FUNCTION public.company_signal_name_agreement(p_party text, p_name text, p_variations text[] DEFAULT NULL)
RETURNS integer
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
  WITH a AS (SELECT public.company_signal_core_key(p_party) AS k, public.company_signal_loose_key(p_party) AS l),
  n AS (SELECT public.company_signal_core_key(x) AS k, public.company_signal_loose_key(x) AS l
        FROM unnest(array_prepend(p_name, coalesce(p_variations, '{}'::text[]))) x),
  s AS (
    SELECT CASE
             WHEN a.l IS NOT NULL AND a.l = n.l AND length(a.l) >= 2 THEN 100
             WHEN a.k IS NULL OR n.k IS NULL OR length(a.k) < 3 OR length(n.k) < 3 THEN 0
             WHEN a.k = n.k THEN 100
             WHEN (a.k LIKE n.k || ' %' OR n.k LIKE a.k || ' %') THEN 80
             WHEN (SELECT bool_and(position(' ' || w || ' ' IN ' ' || n.k || ' ') > 0) FROM unnest(string_to_array(a.k, ' ')) w)
               OR (SELECT bool_and(position(' ' || w || ' ' IN ' ' || a.k || ' ') > 0) FROM unnest(string_to_array(n.k, ' ')) w) THEN 70
             ELSE 0
           END AS score
    FROM a CROSS JOIN n
  )
  SELECT coalesce(max(score), 0) FROM s;
$$;

-- ── company_listings ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.company_listings (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  exchange              text NOT NULL CHECK (exchange IN (
                          'SSE', 'SZSE', 'BSE_CN', 'HKEX', 'JPX', 'KRX', 'TWSE', 'TPEX', 'ASX', 'TSX', 'TSXV',
                          'EURONEXT', 'SIX', 'NASDAQ', 'NYSE', 'NYSE_AMERICAN', 'CBOE', 'OTC', 'SEC_FILER')),
  market                text,
  ticker                text NOT NULL,
  listed_name           text NOT NULL,
  listing_status        text NOT NULL CHECK (listing_status IN ('listed', 'ceased_filing')),
  listed_at             date,
  ceased_at             date,
  shares_outstanding    numeric CHECK (shares_outstanding IS NULL OR shares_outstanding >= 0),
  match_method          text NOT NULL CHECK (match_method IN (
                          'cik', 'ticker', 'exact_name_en', 'exact_name_cn', 'exact_name_local', 'website_domain',
                          'hkex_verified_map', 'hkex_name_core', 'sec_inactive_filer')),
  resolution_confidence integer NOT NULL CHECK (resolution_confidence BETWEEN 0 AND 100),
  source                text NOT NULL CHECK (source IN ('exchange_list', 'sec_tickers', 'hkex_listing_match', 'sec_filer_search', 'edgar_filer_index')),
  source_url            text NOT NULL CHECK (source_url ~ '^https://'),
  source_id             text NOT NULL,
  evidence              text NOT NULL CHECK (char_length(evidence) BETWEEN 1 AND 500),
  metadata              jsonb NOT NULL DEFAULT '{}'::jsonb,
  first_seen_at         timestamptz NOT NULL DEFAULT now(),
  last_seen_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_listings_uq UNIQUE (company_id, exchange, ticker)
);

CREATE INDEX IF NOT EXISTS idx_company_listings_company ON public.company_listings (company_id);
CREATE INDEX IF NOT EXISTS idx_company_listings_source ON public.company_listings (source, exchange, last_seen_at);

COMMENT ON TABLE public.company_listings IS
  'Listed status of a company from an official list (migration 198). listing_status listed = on the exchange list at last_seen_at; ceased_filing = SEC filer whose last periodic report is ceased_at (acquired, delisted or went dark). listed_at is the exchange''s listing date when the list states one (SSE, SZSE, TWSE, TPEx, KRX), else NULL (undated: point-in-time features must treat it as known only from first_seen_at). match_method + resolution_confidence say how the row was resolved; rows below 80 are never written.';

ALTER TABLE public.company_listings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access company_listings" ON public.company_listings;
CREATE POLICY "Service role full access company_listings"
  ON public.company_listings FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── company_grants ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.company_grants (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  program               text NOT NULL CHECK (program IN ('nih_sbir', 'nih_sttr')),
  source                text NOT NULL CHECK (source IN ('nih_reporter')),
  award_id              text NOT NULL,
  project_num           text NOT NULL,
  activity_code         text,
  fiscal_year           integer NOT NULL CHECK (fiscal_year BETWEEN 1985 AND 2100),
  award_amount_usd      numeric CHECK (award_amount_usd IS NULL OR award_amount_usd >= 0),
  awarded_at            date NOT NULL,
  title                 text,
  org_name              text NOT NULL,
  org_state             text,
  match_method          text NOT NULL CHECK (match_method IN ('exact_name')),
  resolution_confidence integer NOT NULL CHECK (resolution_confidence BETWEEN 0 AND 100),
  source_url            text NOT NULL CHECK (source_url ~ '^https://'),
  evidence              text NOT NULL CHECK (char_length(evidence) BETWEEN 1 AND 500),
  fetched_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_grants_uq UNIQUE (company_id, source, award_id)
);

CREATE INDEX IF NOT EXISTS idx_company_grants_company_awarded ON public.company_grants (company_id, awarded_at DESC);

COMMENT ON TABLE public.company_grants IS
  'Non-dilutive grants to the company (migration 198): NIH SBIR/STTR awards from NIH RePORTER, one row per award (appl_id). awarded_at = award notice date (else project start, else 1 Oct of the fiscal year) so point-in-time features key on it. Kept out of company_financing_events on purpose: the 189 financing features count every non-amendment event as a raise.';

ALTER TABLE public.company_grants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access company_grants" ON public.company_grants;
CREATE POLICY "Service role full access company_grants"
  ON public.company_grants FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── company_financials: IFRS filers ─────────────────────────────────────────

ALTER TABLE public.company_financials
  ADD COLUMN IF NOT EXISTS reporting_currency text,
  ADD COLUMN IF NOT EXISTS fx_rate_to_usd     numeric,
  ADD COLUMN IF NOT EXISTS taxonomy           text;

COMMENT ON COLUMN public.company_financials.reporting_currency IS 'Currency the filer reported in (ISO 4217); amounts in this row are converted to USD (migration 198). NULL on rows written before 198 (US GAAP, USD).';
COMMENT ON COLUMN public.company_financials.fx_rate_to_usd IS 'USD per 1 unit of reporting_currency at fiscal_period_end (ECB reference rate via api.frankfurter.dev); 1 for USD.';
COMMENT ON COLUMN public.company_financials.taxonomy IS 'XBRL taxonomy the values came from: us-gaap or ifrs-full (migration 198).';

-- ── company_intent_signals: deal-record types ───────────────────────────────

ALTER TABLE public.company_intent_signals DROP CONSTRAINT IF EXISTS company_intent_signals_signal_type_check;
ALTER TABLE public.company_intent_signals ADD CONSTRAINT company_intent_signals_signal_type_check
  CHECK (signal_type IN (
    'seeking_partner', 'retaining_rights', 'strategic_review', 'restructuring', 'bd_hire',
    'cfo_cbo_change', 'layoffs', 'pipeline_prioritization', 'going_concern_language',
    'licensing_agreement', 'profit_warning', 'major_transaction', 'executive_change',
    -- 198: cited deals ledger (model 'rules:deal-record-v1')
    'out_licensing_deal', 'in_licensing_deal', 'acquired', 'acquirer'));

ALTER TABLE public.company_intent_signals DROP CONSTRAINT IF EXISTS company_intent_signals_source_type_check;
ALTER TABLE public.company_intent_signals ADD CONSTRAINT company_intent_signals_source_type_check
  CHECK (source_type IN ('press_release', '10k', '10q', '8k', 'earnings_call', 'job_posting', 'hkex_announcement', 'deal_record'));

-- ── deal_record intent signals ──────────────────────────────────────────────

-- One signal per (company, side of a cited canonical deal: https source that is not social media,
-- provenance tier A-C or a filing id). licensor: acquired (acquisition) or
-- out_licensing_deal; licensee: acquirer or in_licensing_deal. Written only when the deal's party
-- name agrees with the company row (>= 80) so a mis-resolved licensor_id never becomes a signal.
-- Rows whose deal no longer qualifies are deleted.
CREATE OR REPLACE FUNCTION public.company_signal_refresh_deal_intent()
RETURNS jsonb
LANGUAGE plpgsql
SET statement_timeout TO '120s'
AS $function$
DECLARE
  v_candidates integer := 0;
  v_rejected integer := 0;
  v_upserted integer := 0;
  v_deleted integer := 0;
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS tmp_csdi (
    company_id uuid, signal_type text, polarity text, stance text, quote text,
    source_id text, source_url text, observed_at date, confidence integer
  ) ON COMMIT DROP;
  DELETE FROM tmp_csdi WHERE true;

  INSERT INTO tmp_csdi
  WITH d AS (
    SELECT d.* FROM public.deals d
    WHERE coalesce(d.is_synthetic, false) = false
      AND d.duplicate_of IS NULL
      AND coalesce(d.is_canonical, true)
      AND d.source_url ~ '^https://'
      AND d.source_url !~* '(linkedin\.com|twitter\.com|//x\.com|facebook\.com|reddit\.com|medium\.com)'
      AND (d.provenance_tier IN ('A', 'B', 'C') OR d.source_filing_id IS NOT NULL)
      AND d.announced_date IS NOT NULL
      AND d.announced_date <= current_date
  ), sides AS (
    SELECT d.id, d.licensor_id AS company_id, d.licensor_name AS party, d.licensee_name AS counterparty, 'licensor' AS role,
           d.deal_type, d.announced_date, d.source_url, d.asset_name, d.raw_text_excerpt
    FROM d WHERE d.licensor_id IS NOT NULL
    UNION ALL
    SELECT d.id, d.licensee_id, d.licensee_name, d.licensor_name, 'licensee',
           d.deal_type, d.announced_date, d.source_url, d.asset_name, d.raw_text_excerpt
    FROM d WHERE d.licensee_id IS NOT NULL
  )
  SELECT s.company_id,
         CASE WHEN s.deal_type = 'acquisition' THEN CASE s.role WHEN 'licensor' THEN 'acquired' ELSE 'acquirer' END
              ELSE CASE s.role WHEN 'licensor' THEN 'out_licensing_deal' ELSE 'in_licensing_deal' END END,
         CASE WHEN s.role = 'licensor' AND s.deal_type <> 'acquisition' THEN 'bullish' ELSE 'neutral' END,
         s.role,
         left(coalesce(nullif(btrim(s.raw_text_excerpt), ''),
                       format('%s %s %s %s%s (%s)', coalesce(s.party, '?'),
                              CASE s.role WHEN 'licensor' THEN '->' ELSE '<-' END,
                              coalesce(s.counterparty, '?'), coalesce(s.deal_type, 'deal'),
                              CASE WHEN s.asset_name IS NOT NULL THEN ': ' || s.asset_name ELSE '' END,
                              s.announced_date)), 400),
         s.id::text, s.source_url, s.announced_date,
         public.company_signal_name_agreement(s.party, c.name, c.name_variations)
  FROM sides s
  JOIN public.companies c ON c.id = s.company_id AND c.merged_into IS NULL;

  SELECT count(*), count(*) FILTER (WHERE confidence < 80) INTO v_candidates, v_rejected FROM tmp_csdi;

  INSERT INTO public.company_intent_signals AS x
    (company_id, signal_type, polarity, stance, quote, source_type, source_id, source_url, observed_at, confidence, model, fetched_at)
  SELECT DISTINCT ON (company_id, signal_type, source_id)
         company_id, signal_type, polarity, stance, quote, 'deal_record', source_id, source_url, observed_at, confidence,
         'rules:deal-record-v1', now()
  FROM tmp_csdi WHERE confidence >= 80
  ORDER BY company_id, signal_type, source_id, confidence DESC
  ON CONFLICT (company_id, signal_type, source_type, source_id) DO UPDATE
    SET polarity = EXCLUDED.polarity, stance = EXCLUDED.stance, quote = EXCLUDED.quote, source_url = EXCLUDED.source_url,
        observed_at = EXCLUDED.observed_at, confidence = EXCLUDED.confidence, model = EXCLUDED.model, fetched_at = EXCLUDED.fetched_at
    WHERE (x.quote, x.source_url, x.observed_at, x.confidence) IS DISTINCT FROM (EXCLUDED.quote, EXCLUDED.source_url, EXCLUDED.observed_at, EXCLUDED.confidence);
  GET DIAGNOSTICS v_upserted = ROW_COUNT;

  DELETE FROM public.company_intent_signals x
  WHERE x.source_type = 'deal_record'
    AND NOT EXISTS (SELECT 1 FROM tmp_csdi t
                    WHERE t.confidence >= 80 AND t.company_id = x.company_id
                      AND t.signal_type = x.signal_type AND t.source_id = x.source_id);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN jsonb_build_object('candidates', v_candidates, 'rejected_name_disagreement', v_rejected,
                            'upserted', v_upserted, 'deleted', v_deleted);
END;
$function$;

REVOKE ALL ON FUNCTION public.company_signal_refresh_deal_intent() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.company_signal_refresh_deal_intent() TO service_role;

-- ── derived listings: HKEX match (189) and SEC filers that stopped filing ───

CREATE OR REPLACE FUNCTION public.company_signal_refresh_derived_listings()
RETURNS jsonb
LANGUAGE plpgsql
SET statement_timeout TO '60s'
AS $function$
DECLARE
  v_hkex integer := 0;
  v_sec integer := 0;
  v_deleted integer := 0;
  v_run timestamptz := now();
BEGIN
  INSERT INTO public.company_listings AS l
    (company_id, exchange, ticker, listed_name, listing_status, match_method, resolution_confidence,
     source, source_url, source_id, evidence, metadata, last_seen_at)
  SELECT c.id, 'HKEX', c.hkex_stock_code, coalesce(c.hkex_short_name, c.name), 'listed',
         CASE c.hkex_match_method WHEN 'verified_map' THEN 'hkex_verified_map' ELSE 'hkex_name_core' END,
         CASE c.hkex_match_method WHEN 'verified_map' THEN 98 ELSE 88 END,
         'hkex_listing_match',
         'https://www.hkex.com.hk/eng/services/trading/securities/securitieslists/ListOfSecurities.xlsx',
         c.hkex_stock_code,
         left(format('HKEX List of Securities: %s %s (matched %s)', c.hkex_stock_code, coalesce(c.hkex_short_name, ''), coalesce(c.hkex_matched_at::date::text, '')), 500),
         jsonb_build_object('hkex_stock_id', c.hkex_stock_id), v_run
  FROM public.companies c
  WHERE c.hkex_stock_code IS NOT NULL AND c.merged_into IS NULL
  ON CONFLICT (company_id, exchange, ticker) DO UPDATE
    SET listed_name = EXCLUDED.listed_name, listing_status = 'listed', match_method = EXCLUDED.match_method,
        resolution_confidence = EXCLUDED.resolution_confidence, evidence = EXCLUDED.evidence,
        metadata = EXCLUDED.metadata, last_seen_at = EXCLUDED.last_seen_at;
  GET DIAGNOSTICS v_hkex = ROW_COUNT;

  INSERT INTO public.company_listings AS l
    (company_id, exchange, ticker, listed_name, listing_status, ceased_at, match_method, resolution_confidence,
     source, source_url, source_id, evidence, last_seen_at)
  SELECT c.id, 'SEC_FILER', 'CIK' || ltrim(c.sec_inactive_cik, '0'), c.name, 'ceased_filing', c.sec_last_10k_at,
         'sec_inactive_filer', 85, 'sec_filer_search',
         'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=' || lpad(ltrim(c.sec_inactive_cik, '0'), 10, '0') || '&type=10-K',
         ltrim(c.sec_inactive_cik, '0'),
         left(format('SEC 10-K filer CIK %s; last 10-K filed %s, no periodic report since', ltrim(c.sec_inactive_cik, '0'), coalesce(c.sec_last_10k_at::text, 'unknown')), 500),
         v_run
  FROM public.companies c
  WHERE c.sec_inactive_cik IS NOT NULL AND c.merged_into IS NULL
  ON CONFLICT (company_id, exchange, ticker) DO UPDATE
    SET listing_status = 'ceased_filing', ceased_at = EXCLUDED.ceased_at, evidence = EXCLUDED.evidence, last_seen_at = EXCLUDED.last_seen_at;
  GET DIAGNOSTICS v_sec = ROW_COUNT;

  -- A match that was cleared on the company row (re-match, merge) leaves no stale listing behind.
  DELETE FROM public.company_listings l
  WHERE l.source IN ('hkex_listing_match', 'sec_filer_search') AND l.last_seen_at < v_run;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN jsonb_build_object('hkex', v_hkex, 'sec_ceased_filing', v_sec, 'deleted', v_deleted);
END;
$function$;

REVOKE ALL ON FUNCTION public.company_signal_refresh_derived_listings() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.company_signal_refresh_derived_listings() TO service_role;

-- ── EDGAR filer index queue ─────────────────────────────────────────────────

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS edgar_cik        text,
  ADD COLUMN IF NOT EXISTS edgar_checked_at timestamptz;

COMMENT ON COLUMN public.companies.edgar_cik IS 'Health-care EDGAR filer matched by exact name in the EDGAR CIK lookup file (lib/ingestion/edgar-filers.ts, migration 198). May be a Form D filer, an active or a former periodic filer; companies.cik is set from it only for an active periodic filer whose current name agrees.';
COMMENT ON COLUMN public.companies.edgar_checked_at IS 'Last EDGAR filer-index check (queue order; unmatched companies are re-checked after 90 days).';

-- Feed-owning industry companies with no SEC link yet, never checked first.
CREATE OR REPLACE FUNCTION public.company_signal_edgar_candidates(p_limit integer DEFAULT 1500, p_recheck_days integer DEFAULT 90)
RETURNS TABLE (id uuid, name text, name_variations text[], company_type text)
LANGUAGE sql STABLE
SET statement_timeout TO '60s'
AS $$
  SELECT c.id, c.name, c.name_variations, c.company_type
  FROM public.companies c
  WHERE c.owner_type = 'industry'
    AND c.merged_into IS NULL
    AND c.cik IS NULL AND c.sec_cik IS NULL AND c.sec_inactive_cik IS NULL AND c.form_d_cik IS NULL AND c.edgar_cik IS NULL
    AND (c.edgar_checked_at IS NULL OR c.edgar_checked_at < now() - make_interval(days => p_recheck_days))
    AND EXISTS (SELECT 1 FROM public.clinical_assets a WHERE a.company_id = c.id AND a.program_primary)
  ORDER BY c.edgar_checked_at NULLS FIRST, c.id
  LIMIT GREATEST(1, LEAST(p_limit, 5000));
$$;
REVOKE ALL ON FUNCTION public.company_signal_edgar_candidates(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.company_signal_edgar_candidates(integer, integer) TO service_role;

-- ── match subjects for the listing / grant matchers ─────────────────────────

-- Industry companies that own a program_primary asset, with every field a matcher may use.
CREATE OR REPLACE FUNCTION public.company_signal_match_subjects(p_after uuid DEFAULT NULL, p_limit integer DEFAULT 2000)
RETURNS TABLE (id uuid, name text, name_variations text[], country text, ticker text, cik text,
               website_url text, website_source text, company_type text, family_id uuid)
LANGUAGE sql STABLE
SET statement_timeout TO '60s'
AS $$
  SELECT c.id, c.name, c.name_variations, COALESCE(c.hq_country, c.headquarters_country), c.ticker,
         COALESCE(c.cik, c.sec_cik), c.website_url, c.website_source, c.company_type, c.family_id
  FROM public.companies c
  WHERE c.owner_type = 'industry'
    AND c.merged_into IS NULL
    AND (p_after IS NULL OR c.id > p_after)
    AND EXISTS (SELECT 1 FROM public.clinical_assets a WHERE a.company_id = c.id AND a.program_primary)
  ORDER BY c.id
  LIMIT GREATEST(1, LEAST(p_limit, 5000));
$$;
REVOKE ALL ON FUNCTION public.company_signal_match_subjects(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.company_signal_match_subjects(uuid, integer) TO service_role;

-- ── coverage definition ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.company_signal_covered(p_company_id uuid)
RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM public.company_financials x WHERE x.company_id = p_company_id)
      OR EXISTS (SELECT 1 FROM public.company_listings x WHERE x.company_id = p_company_id)
      OR EXISTS (SELECT 1 FROM public.company_financing_events x WHERE x.company_id = p_company_id)
      OR EXISTS (SELECT 1 FROM public.company_grants x WHERE x.company_id = p_company_id)
      OR EXISTS (SELECT 1 FROM public.company_intent_signals x WHERE x.company_id = p_company_id)
      OR EXISTS (
           SELECT 1 FROM public.companies c
           WHERE c.id = p_company_id AND c.family_id IS NOT NULL AND c.family_id <> c.id
             AND (EXISTS (SELECT 1 FROM public.company_financials x WHERE x.company_id = c.family_id)
                  OR EXISTS (SELECT 1 FROM public.company_listings x WHERE x.company_id = c.family_id AND x.listing_status = 'listed')));
$$;

COMMENT ON FUNCTION public.company_signal_covered(uuid) IS
  'Scorecard company_signal_coverage definition (migration 198): own row in company_financials / company_listings / company_financing_events / company_grants / company_intent_signals, or a family root (companies.family_id) with financials or a live listing. Financing, grants and intent never roll down from a parent.';

-- Per-source coverage of the default feed (monitoring and rollout checks).
CREATE OR REPLACE FUNCTION public.company_signal_coverage_stats()
RETURNS jsonb
LANGUAGE sql STABLE
SET statement_timeout TO '120s'
AS $$
  WITH feed AS (
    SELECT DISTINCT a.company_id FROM public.clinical_assets a
    WHERE a.program_primary AND a.owner_type = 'industry'
      AND a.phase NOT IN ('phase_4', 'not_applicable', 'unknown')
      AND a.ownership_status NOT IN ('comparator_or_background', 'marketed_other', 'duplicate_program', 'not_a_program')
  ), f AS (
    SELECT feed.company_id, c.family_id,
      EXISTS (SELECT 1 FROM public.company_financials x WHERE x.company_id = feed.company_id) AS fin,
      EXISTS (SELECT 1 FROM public.company_listings x WHERE x.company_id = feed.company_id) AS lst,
      EXISTS (SELECT 1 FROM public.company_financing_events x WHERE x.company_id = feed.company_id) AS fe,
      EXISTS (SELECT 1 FROM public.company_grants x WHERE x.company_id = feed.company_id) AS gr,
      EXISTS (SELECT 1 FROM public.company_intent_signals x WHERE x.company_id = feed.company_id AND x.source_type <> 'deal_record') AS intent,
      EXISTS (SELECT 1 FROM public.company_intent_signals x WHERE x.company_id = feed.company_id AND x.source_type = 'deal_record') AS deal,
      public.company_signal_covered(feed.company_id) AS covered
    FROM feed JOIN public.companies c ON c.id = feed.company_id
  )
  SELECT jsonb_build_object(
    'feed_companies', count(*),
    'covered', count(*) FILTER (WHERE covered),
    'coverage_pct', round(100.0 * count(*) FILTER (WHERE covered) / NULLIF(count(*), 0), 1),
    'financials', count(*) FILTER (WHERE fin),
    'listings', count(*) FILTER (WHERE lst),
    'financing_events', count(*) FILTER (WHERE fe),
    'grants', count(*) FILTER (WHERE gr),
    'intent_non_deal', count(*) FILTER (WHERE intent),
    'deal_record', count(*) FILTER (WHERE deal),
    'family_only', count(*) FILTER (WHERE covered AND NOT (fin OR lst OR fe OR gr OR intent OR deal)),
    'covered_without_deal_record', count(*) FILTER (WHERE covered AND (fin OR lst OR fe OR gr OR intent
                                     OR NOT deal))
  ) FROM f;
$$;
REVOKE ALL ON FUNCTION public.company_signal_coverage_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.company_signal_coverage_stats() TO service_role;

-- ── point-in-time company features (for the ranking model) ──────────────────

-- Values known on p_as_of for each company. Undated listings (exchange lists without a listing
-- date) count from first_seen_at, so a backtest before the first crawl sees them as unknown (NULL),
-- never as "not listed". Family features read the family root.
CREATE OR REPLACE FUNCTION public.company_signal_features_asof(p_company_ids uuid[], p_as_of date DEFAULT current_date)
RETURNS TABLE (
  company_id uuid,
  listed_asof boolean,
  listing_exchange text,
  listing_confidence integer,
  ceased_filing_asof boolean,
  family_listed_asof boolean,
  grants_5y integer,
  grant_usd_5y numeric,
  months_since_last_grant numeric,
  out_licensing_deals_36m integer,
  in_licensing_deals_36m integer,
  acquirer_deals_36m integer,
  acquired_asof boolean,
  financing_events_24m integer,
  months_since_last_financing numeric
)
LANGUAGE sql STABLE
SET statement_timeout TO '60s'
AS $$
  WITH ids AS (
    SELECT c.id, CASE WHEN c.family_id IS NOT NULL AND c.family_id <> c.id THEN c.family_id END AS root
    FROM public.companies c WHERE c.id = ANY(p_company_ids)
  ), lst AS (
    SELECT l.company_id,
           bool_or(l.listing_status = 'listed' AND coalesce(l.listed_at, l.first_seen_at::date) <= p_as_of) AS listed,
           bool_or(l.listing_status = 'ceased_filing' AND l.ceased_at <= p_as_of) AS ceased,
           (array_agg(l.exchange ORDER BY l.resolution_confidence DESC, l.exchange) FILTER (WHERE l.listing_status = 'listed'))[1] AS exch,
           max(l.resolution_confidence) FILTER (WHERE l.listing_status = 'listed') AS conf,
           bool_or(l.listing_status = 'listed' AND l.listed_at IS NULL AND l.first_seen_at::date > p_as_of) AS undated_future
    FROM public.company_listings l
    WHERE l.company_id IN (SELECT id FROM ids UNION SELECT root FROM ids WHERE root IS NOT NULL)
    GROUP BY l.company_id
  ), gr AS (
    SELECT g.company_id, count(*)::int AS n, sum(g.award_amount_usd) AS usd, max(g.awarded_at) AS last_at
    FROM public.company_grants g
    WHERE g.company_id = ANY(p_company_ids) AND g.awarded_at <= p_as_of AND g.awarded_at > p_as_of - interval '5 years'
    GROUP BY g.company_id
  ), gr_last AS (
    SELECT g.company_id, max(g.awarded_at) AS last_at FROM public.company_grants g
    WHERE g.company_id = ANY(p_company_ids) AND g.awarded_at <= p_as_of GROUP BY g.company_id
  ), dl AS (
    SELECT s.company_id,
           count(*) FILTER (WHERE s.signal_type = 'out_licensing_deal' AND s.observed_at > p_as_of - interval '36 months')::int AS outl,
           count(*) FILTER (WHERE s.signal_type = 'in_licensing_deal' AND s.observed_at > p_as_of - interval '36 months')::int AS inl,
           count(*) FILTER (WHERE s.signal_type = 'acquirer' AND s.observed_at > p_as_of - interval '36 months')::int AS acq,
           bool_or(s.signal_type = 'acquired') AS acquired
    FROM public.company_intent_signals s
    WHERE s.company_id = ANY(p_company_ids) AND s.source_type = 'deal_record' AND s.observed_at <= p_as_of
    GROUP BY s.company_id
  ), fe AS (
    SELECT e.company_id,
           count(*) FILTER (WHERE e.announced_at > p_as_of - interval '24 months')::int AS n24,
           max(e.announced_at) AS last_at
    FROM public.company_financing_events e
    WHERE e.company_id = ANY(p_company_ids) AND e.announced_at <= p_as_of AND e.event_type <> 'form_d_amendment'
    GROUP BY e.company_id
  )
  SELECT ids.id,
         CASE WHEN own.listed THEN true WHEN own.undated_future THEN NULL WHEN own.company_id IS NULL THEN false ELSE coalesce(own.listed, false) END,
         own.exch, own.conf,
         coalesce(own.ceased, false),
         CASE WHEN ids.root IS NULL THEN false ELSE coalesce(fam.listed, false) END,
         coalesce(gr.n, 0), coalesce(gr.usd, 0),
         CASE WHEN gr_last.last_at IS NULL THEN NULL ELSE round(((p_as_of - gr_last.last_at) / 30.4375)::numeric, 1) END,
         coalesce(dl.outl, 0), coalesce(dl.inl, 0), coalesce(dl.acq, 0), coalesce(dl.acquired, false),
         coalesce(fe.n24, 0),
         CASE WHEN fe.last_at IS NULL THEN NULL ELSE round(((p_as_of - fe.last_at) / 30.4375)::numeric, 1) END
  FROM ids
  LEFT JOIN lst own ON own.company_id = ids.id
  LEFT JOIN lst fam ON fam.company_id = ids.root
  LEFT JOIN gr ON gr.company_id = ids.id
  LEFT JOIN gr_last ON gr_last.company_id = ids.id
  LEFT JOIN dl ON dl.company_id = ids.id
  LEFT JOIN fe ON fe.company_id = ids.id;
$$;
REVOKE ALL ON FUNCTION public.company_signal_features_asof(uuid[], date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.company_signal_features_asof(uuid[], date) TO service_role;

COMMENT ON FUNCTION public.company_signal_features_asof(uuid[], date) IS
  'Point-in-time company signal features for the ranking model (migration 198). listed_asof is NULL (unknown) when the only listing is undated and was first seen after p_as_of. Deal features count deal_record intent signals observed on or before p_as_of; exclude the program''s own label deal when training on deal outcomes.';

-- ── scorecard: count signals through company_signal_covered ─────────────────

DO $patch$
DECLARE
  d text := pg_get_functiondef('public.radar_qa_scorecard_stats()'::regprocedure);
  patched text;
BEGIN
  IF position('company_signal_covered' IN d) > 0 THEN
    RETURN;  -- already patched
  END IF;
  patched := regexp_replace(d,
    'EXECUTE format\(\$q\$\s*SELECT count\(DISTINCT f\.company_id\) FROM tmp_sc_feed f.*?INTO v_signal_cos;',
    'SELECT count(DISTINCT f.company_id) FROM tmp_sc_feed f WHERE public.company_signal_covered(f.company_id)
  INTO v_signal_cos;');
  IF patched = d THEN
    RAISE EXCEPTION 'radar_qa_scorecard_stats signal block not found; patch by hand (migration 198)';
  END IF;
  EXECUTE patched;
END
$patch$;
