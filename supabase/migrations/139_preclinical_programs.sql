-- 139_preclinical_programs.sql
--
-- Search & Evaluation: company-disclosed preclinical programs.
--
-- Until now every row in clinical_assets came from a trial registry, so the
-- module had zero preclinical programs (about 40% of what Pharmaprojects or
-- Cortellis sell). This migration lets lib/ingestion/preclinical-pipeline.ts
-- add programs a company discloses in its 10-K / 20-F / S-1 pipeline
-- section, each carrying the filing, date and verbatim sentence it came from.
--
--   * clinical_assets.asset_origin      registry (default) | filing | pipeline_page | press | user
--   * clinical_assets.stage_detail      discovery | lead_optimization | ind_enabling | preclinical
--   * clinical_assets.disclosure_*      latest disclosure: form, accession, url, date, verbatim excerpt
--   * asset_disclosures                 every extracted program per filing (matched, created or unmatched)
--   * partnership_basis gains 'filing'
--   * 'preclinical' joins the core universe in radar_refresh_score_percentiles,
--     radar_thesis_eligible_assets and radar_phase_breakdown
--   * radar_qa_preclinical_stats() for the QA gate
--
-- Apply after 138. Idempotent.

-- ══════════════════════════════════════════════════════════════════════
-- 1. clinical_assets columns
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE public.clinical_assets
  ADD COLUMN IF NOT EXISTS asset_origin text NOT NULL DEFAULT 'registry',
  ADD COLUMN IF NOT EXISTS stage_detail text,
  ADD COLUMN IF NOT EXISTS disclosure_source_type text,
  ADD COLUMN IF NOT EXISTS disclosure_accession text,
  ADD COLUMN IF NOT EXISTS disclosure_url text,
  ADD COLUMN IF NOT EXISTS disclosure_date date,
  ADD COLUMN IF NOT EXISTS disclosure_excerpt text,
  ADD COLUMN IF NOT EXISTS disclosed_last_seen_at date;

ALTER TABLE public.clinical_assets DROP CONSTRAINT IF EXISTS clinical_assets_asset_origin_check;
ALTER TABLE public.clinical_assets ADD CONSTRAINT clinical_assets_asset_origin_check
  CHECK (asset_origin IN ('registry', 'filing', 'pipeline_page', 'press', 'user'));

ALTER TABLE public.clinical_assets DROP CONSTRAINT IF EXISTS clinical_assets_stage_detail_check;
ALTER TABLE public.clinical_assets ADD CONSTRAINT clinical_assets_stage_detail_check
  CHECK (stage_detail IS NULL OR stage_detail IN ('discovery', 'lead_optimization', 'ind_enabling', 'preclinical'));

ALTER TABLE public.clinical_assets DROP CONSTRAINT IF EXISTS clinical_assets_disclosure_excerpt_length;
ALTER TABLE public.clinical_assets ADD CONSTRAINT clinical_assets_disclosure_excerpt_length
  CHECK (disclosure_excerpt IS NULL OR char_length(disclosure_excerpt) <= 600);

-- A filing-origin row must say where it came from.
ALTER TABLE public.clinical_assets DROP CONSTRAINT IF EXISTS clinical_assets_filing_origin_cited;
ALTER TABLE public.clinical_assets ADD CONSTRAINT clinical_assets_filing_origin_cited
  CHECK (asset_origin <> 'filing' OR (disclosure_url IS NOT NULL AND disclosure_date IS NOT NULL AND disclosure_excerpt IS NOT NULL));

ALTER TABLE public.clinical_assets DROP CONSTRAINT IF EXISTS clinical_assets_partnership_basis_check;
ALTER TABLE public.clinical_assets ADD CONSTRAINT clinical_assets_partnership_basis_check
  CHECK (partnership_basis IS NULL OR partnership_basis IN ('deal_confirmed', 'press', 'trial_collaborator', 'drug_owner', 'filing', 'no_evidence'));

CREATE INDEX IF NOT EXISTS idx_clinical_assets_origin
  ON public.clinical_assets (asset_origin) WHERE asset_origin <> 'registry';
CREATE INDEX IF NOT EXISTS idx_clinical_assets_preclinical
  ON public.clinical_assets (company_id, disclosed_last_seen_at) WHERE phase = 'preclinical';

COMMENT ON COLUMN public.clinical_assets.asset_origin IS
  'Where the row came from: registry (trial registries, default), filing (SEC 10-K/20-F/S-1 pipeline disclosure), pipeline_page, press, user.';
COMMENT ON COLUMN public.clinical_assets.stage_detail IS
  'Preclinical sub-stage as disclosed: discovery, lead_optimization, ind_enabling, or preclinical when the filing does not say.';
COMMENT ON COLUMN public.clinical_assets.disclosure_excerpt IS
  'Verbatim sentence (<= 600 chars) from the cited disclosure that names the program; the provenance shown to users.';
COMMENT ON COLUMN public.clinical_assets.disclosed_last_seen_at IS
  'Date of the newest filing that still lists the program. A program absent from a later annual report is likely dropped; the UI shows this date.';

-- ══════════════════════════════════════════════════════════════════════
-- 2. asset_disclosures: every extracted program, per filing
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.asset_disclosures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  asset_id uuid REFERENCES public.clinical_assets(id) ON DELETE SET NULL,
  program_name text NOT NULL,
  program_key text NOT NULL,
  aliases text[] NOT NULL DEFAULT '{}',
  stage text NOT NULL,
  phase text,
  target text,
  target_class text,
  modality text,
  therapeutic_area text,
  indication_category text,
  indication_specific text,
  mechanism_short text,
  partnered boolean NOT NULL DEFAULT false,
  partner_name text,
  source_type text NOT NULL,
  source_id text NOT NULL,
  source_url text NOT NULL,
  disclosed_at date NOT NULL,
  excerpt text NOT NULL,
  confidence integer NOT NULL CHECK (confidence BETWEEN 0 AND 100),
  model text NOT NULL,
  match_status text NOT NULL CHECK (match_status IN ('matched', 'created', 'unmatched_clinical', 'skipped')),
  extracted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, source_id, program_key)
);

CREATE INDEX IF NOT EXISTS idx_asset_disclosures_asset ON public.asset_disclosures (asset_id) WHERE asset_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_asset_disclosures_company ON public.asset_disclosures (company_id, disclosed_at DESC);

ALTER TABLE public.asset_disclosures ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS asset_disclosures_service ON public.asset_disclosures;
CREATE POLICY asset_disclosures_service ON public.asset_disclosures
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS asset_disclosures_read ON public.asset_disclosures;
CREATE POLICY asset_disclosures_read ON public.asset_disclosures
  FOR SELECT TO authenticated USING (true);

COMMENT ON TABLE public.asset_disclosures IS
  'Programs extracted from company disclosures (SEC filings first). One row per (company, filing, program). match_status: matched = attached to an existing asset; created = new preclinical asset; unmatched_clinical = clinical-stage program with no registry match (kept for reconciliation, no asset created); skipped = discontinued/unknown stage.';

-- ══════════════════════════════════════════════════════════════════════
-- 3. Preclinical joins the core universe
-- ══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.radar_refresh_score_percentiles()
RETURNS jsonb
LANGUAGE plpgsql
SET statement_timeout = '120s'
AS $$
DECLARE
  v_ranked integer := 0;
  v_cleared integer := 0;
  v_low_power boolean := false;
BEGIN
  SELECT COALESCE(b.low_power, false) INTO v_low_power
  FROM public.radar_score_models m
  JOIN public.radar_score_backtests b ON b.model_version = m.version
  WHERE m.is_active = true
  ORDER BY b.created_at DESC
  LIMIT 1;

  DROP TABLE IF EXISTS tmp_score_ranks;
  CREATE TEMP TABLE tmp_score_ranks ON COMMIT DROP AS
  WITH core AS (
    SELECT a.id,
           COALESCE(a.phase, 'unknown') || '|' || COALESCE(a.therapeutic_area, 'unknown') AS peer_key,
           a.licensing_intent_score AS score,
           COALESCE(a.score_probability, a.licensing_intent_score / 100.0) AS p
    FROM public.clinical_assets a
    WHERE a.licensing_intent_score IS NOT NULL
      AND a.owner_type = 'industry'
      AND a.partnership_status IN ('unpartnered', 'partially_partnered')
      AND a.ownership_status NOT IN ('comparator_or_background', 'marketed_other')
      -- Preclinical programs rank among themselves (peer_key carries the phase).
      AND a.phase IN ('preclinical', 'early_phase_1', 'phase_1', 'phase_1_2', 'phase_2', 'phase_2_3', 'phase_3')
  )
  SELECT id,
         peer_key,
         round(100 * percent_rank() OVER (PARTITION BY peer_key ORDER BY score))::smallint AS pct_peer,
         count(*) OVER (PARTITION BY peer_key) AS peer_n,
         round(100 * percent_rank() OVER (ORDER BY score))::smallint AS pct_universe,
         avg(p) OVER (PARTITION BY peer_key) AS base_rate
  FROM core;

  UPDATE public.clinical_assets a
  SET score_pct_peer = r.pct_peer,
      score_peer_n = r.peer_n,
      score_peer_key = r.peer_key,
      score_pct_universe = r.pct_universe,
      score_base_rate = round(r.base_rate::numeric, 5),
      score_low_power = v_low_power
  FROM tmp_score_ranks r
  WHERE a.id = r.id
    AND (a.score_pct_peer IS DISTINCT FROM r.pct_peer
      OR a.score_peer_n IS DISTINCT FROM r.peer_n
      OR a.score_peer_key IS DISTINCT FROM r.peer_key
      OR a.score_pct_universe IS DISTINCT FROM r.pct_universe
      OR a.score_base_rate IS DISTINCT FROM round(r.base_rate::numeric, 5)
      OR a.score_low_power IS DISTINCT FROM v_low_power);
  GET DIAGNOSTICS v_ranked = ROW_COUNT;

  UPDATE public.clinical_assets a
  SET score_pct_peer = NULL, score_peer_n = NULL, score_peer_key = NULL,
      score_pct_universe = NULL, score_base_rate = NULL
  WHERE a.score_pct_peer IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM tmp_score_ranks r WHERE r.id = a.id);
  GET DIAGNOSTICS v_cleared = ROW_COUNT;

  RETURN jsonb_build_object('ranked_changed', v_ranked, 'cleared', v_cleared, 'low_power', v_low_power);
END;
$$;

CREATE OR REPLACE VIEW public.radar_thesis_eligible_assets AS
  SELECT
    a.id,
    a.company_id,
    a.company_name,
    a.asset_name,
    a.therapeutic_area,
    a.modality,
    a.phase,
    a.indication_category,
    a.indication_specific,
    a.indications_all,
    a.regulatory_designations,
    a.partnership_status,
    a.partner_company_id,
    a.partner_company_name,
    a.confidence_score,
    a.licensing_intent_score,
    a.updated_at,
    c.owner_type
  FROM public.clinical_assets a
  JOIN public.companies c ON c.id = a.company_id
  WHERE (
      c.owner_type = 'industry'
      OR (COALESCE(c.owner_type, 'unknown') = 'unknown' AND upper(COALESCE(c.lead_sponsor_class, '')) = 'INDUSTRY')
    )
    AND a.partnership_status IN ('unpartnered', 'partially_partnered')
    AND a.ownership_status NOT IN ('comparator_or_background', 'marketed_other')
    AND COALESCE(a.confidence_score, 0) >= 20
    AND (
      a.phase IN (
        'preclinical',
        'early_phase_1', 'phase_1', 'phase_1_2', 'phase_2', 'phase_2_3', 'phase_3',
        'early_phase1', 'phase1', 'phase1_phase2', 'phase2', 'phase2_phase3', 'phase3'
      )
      OR (a.phase IN ('phase_4', 'phase4') AND a.partnership_status = 'unpartnered')
    );

CREATE OR REPLACE FUNCTION public.radar_phase_breakdown()
RETURNS TABLE(phase TEXT, total BIGINT, unpartnered BIGINT) AS $$
  SELECT
    phase,
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE partnership_status IN ('unpartnered', 'partially_partnered')) AS unpartnered
  FROM public.clinical_assets
  WHERE phase IS NOT NULL AND phase NOT IN ('unknown', 'not_applicable')
  GROUP BY phase
  ORDER BY
    CASE phase
      WHEN 'preclinical' THEN 0
      WHEN 'early_phase_1' THEN 1 WHEN 'phase_1' THEN 2
      WHEN 'phase_1_2' THEN 3 WHEN 'phase_2' THEN 4
      WHEN 'phase_2_3' THEN 5 WHEN 'phase_3' THEN 6
      WHEN 'phase_4' THEN 7
      ELSE 9
    END;
$$ LANGUAGE sql STABLE;

-- ══════════════════════════════════════════════════════════════════════
-- 4. QA stats for the gate
-- ══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.radar_qa_preclinical_stats()
RETURNS jsonb
LANGUAGE sql STABLE
SET statement_timeout = '60s'
AS $$
  WITH f AS (
    SELECT * FROM public.clinical_assets WHERE asset_origin = 'filing'
  ), d AS (
    SELECT company_id, max(disclosed_at) AS latest FROM public.asset_disclosures GROUP BY company_id
  )
  SELECT jsonb_build_object(
    'filing_assets', (SELECT count(*) FROM f),
    'preclinical_assets', (SELECT count(*) FROM public.clinical_assets WHERE phase = 'preclinical'),
    'filing_without_citation', (SELECT count(*) FROM f WHERE disclosure_url IS NULL OR disclosure_excerpt IS NULL OR disclosure_date IS NULL),
    'filing_with_score_rank', (SELECT count(*) FROM f WHERE score_pct_peer IS NOT NULL),
    'filing_stale_18m', (SELECT count(*) FROM f WHERE disclosed_last_seen_at < CURRENT_DATE - 548),
    'filing_not_in_latest_filing', (
      SELECT count(*) FROM f JOIN d ON d.company_id = f.company_id
      WHERE f.disclosed_last_seen_at < d.latest
    ),
    'companies_covered', (SELECT count(DISTINCT company_id) FROM public.asset_disclosures),
    'companies_eligible', (SELECT count(*) FROM public.companies WHERE cik IS NOT NULL AND owner_type = 'industry' AND merged_into IS NULL),
    'disclosures_total', (SELECT count(*) FROM public.asset_disclosures),
    'disclosures_unmatched_clinical', (SELECT count(*) FROM public.asset_disclosures WHERE match_status = 'unmatched_clinical'),
    'sample_without_citation', (
      SELECT COALESCE(jsonb_agg(id), '[]'::jsonb) FROM (
        SELECT id FROM f WHERE disclosure_url IS NULL OR disclosure_excerpt IS NULL OR disclosure_date IS NULL ORDER BY id LIMIT 20) x
    )
  );
$$;

REVOKE ALL ON FUNCTION public.radar_qa_preclinical_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.radar_qa_preclinical_stats() TO service_role;

COMMENT ON FUNCTION public.radar_qa_preclinical_stats() IS
  'Counts for the Search & Evaluation QA gate: filing-origin assets, missing citations, staleness, coverage of SEC filers (migration 139).';
