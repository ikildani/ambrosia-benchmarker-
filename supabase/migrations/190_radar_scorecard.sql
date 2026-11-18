-- 190: the Search & Evaluation scorecard — one measured 0-100 number.
--
-- "How world-class is the engine" has to be a number the product earns every
-- week, not an opinion. radar_qa_scorecard_stats() returns the raw measures;
-- lib/radar/qa/scorecard.ts maps each onto 0-100 between a "poor" and a
-- "world-class" anchor, averages them per dimension (accuracy, ranking,
-- coverage, signals, freshness, evidence) and weights the dimensions. The
-- radar-qa cron (mode=scorecard) stores each run in radar_qa_runs
-- (kind 'scorecard').
--
-- Human top-of-list audits reuse radar_qa_human_reviews with fields 'owner',
-- 'availability' and 'duplicate' (agrees = the row is right). A measure with
-- too little data reports n and scores 0, so the number cannot be inflated by
-- leaving things unmeasured. Apply after 188. Idempotent.

ALTER TABLE public.radar_qa_runs DROP CONSTRAINT IF EXISTS radar_qa_runs_kind_check;
ALTER TABLE public.radar_qa_runs ADD CONSTRAINT radar_qa_runs_kind_check
  CHECK (kind = ANY (ARRAY['invariants', 'golden_agreement', 'golden_human', 'scorecard']));

CREATE OR REPLACE FUNCTION public.radar_qa_scorecard_stats()
 RETURNS jsonb
 LANGUAGE plpgsql
 SET statement_timeout TO '120s'
AS $function$
DECLARE
  v_out jsonb;
  v_signal_cos integer := 0;
  v_feed_cos integer := 0;
  v_has_financing boolean := to_regclass('public.company_financing_events') IS NOT NULL;
BEGIN
  -- The default feed: industry programs, one row per program, hidden ownership/phase states excluded.
  CREATE TEMP TABLE IF NOT EXISTS tmp_sc_feed ON COMMIT DROP AS
  SELECT a.id, a.company_id, a.drug_master_id, a.program_name, a.asset_name, a.ownership_status,
         a.partnership_basis, a.classification_status, a.therapeutic_area, a.originator_region,
         a.nct_ids, a.disclosure_url, a.score_rank
  FROM public.clinical_assets a
  WHERE a.program_primary AND a.owner_type = 'industry'
    AND a.phase NOT IN ('phase_4', 'not_applicable', 'unknown')
    AND a.ownership_status NOT IN ('comparator_or_background', 'marketed_other', 'duplicate_program', 'not_a_program');

  SELECT count(DISTINCT company_id) INTO v_feed_cos FROM tmp_sc_feed;

  EXECUTE format($q$
    SELECT count(DISTINCT f.company_id) FROM tmp_sc_feed f
    WHERE EXISTS (SELECT 1 FROM public.company_financials x WHERE x.company_id = f.company_id)
       OR EXISTS (SELECT 1 FROM public.company_intent_signals x WHERE x.company_id = f.company_id)
       %s
  $q$, CASE WHEN v_has_financing
            THEN 'OR EXISTS (SELECT 1 FROM public.company_financing_events x WHERE x.company_id = f.company_id)'
            ELSE '' END)
  INTO v_signal_cos;

  WITH top1k AS (SELECT * FROM tmp_sc_feed ORDER BY score_rank DESC NULLS LAST, id DESC LIMIT 1000),
  top500 AS (SELECT * FROM top1k ORDER BY score_rank DESC NULLS LAST, id DESC LIMIT 500),
  bt AS (
    SELECT b.* FROM public.radar_score_backtests b
    JOIN public.radar_score_models m ON m.version = b.model_version AND m.is_active
    ORDER BY b.created_at DESC LIMIT 1
  ),
  deals12 AS (
    SELECT d.id FROM public.deals d
    WHERE coalesce(d.is_canonical, true) AND NOT coalesce(d.is_synthetic, false)
      AND d.announced_date >= current_date - 365
      AND d.deal_type IN ('license', 'option', 'collaboration')
  ),
  -- Forward check: licensed assets' standing 14+ days before the deal.
  fwd AS (
    SELECT l.asset_id, s.snapshot_date, s.logit
    FROM (
      SELECT DISTINCT a.id AS asset_id, d.announced_date
      FROM public.deals d JOIN public.clinical_assets a ON a.deal_ids @> ARRAY[d.id]
      WHERE coalesce(d.is_canonical, true) AND NOT coalesce(d.is_synthetic, false)
        AND d.announced_date >= current_date - 180
        AND d.deal_type IN ('license', 'option', 'collaboration')
    ) l
    JOIN LATERAL (
      SELECT s.snapshot_date, s.logit FROM public.asset_signal_snapshots s
      WHERE s.asset_id = l.asset_id AND s.snapshot_date <= l.announced_date - 14 AND s.logit IS NOT NULL
      ORDER BY s.snapshot_date DESC LIMIT 1
    ) s ON true
  ),
  fwd_pct AS (
    SELECT f.asset_id,
           (SELECT count(*) FROM public.asset_signal_snapshots s2 WHERE s2.snapshot_date = f.snapshot_date AND s2.logit > f.logit)::numeric
           / NULLIF((SELECT count(*) FROM public.asset_signal_snapshots s3 WHERE s3.snapshot_date = f.snapshot_date), 0) AS frac_above
    FROM fwd f
  ),
  audits AS (
    SELECT field, count(*) AS n, avg(agrees::int) AS share
    FROM public.radar_qa_human_reviews
    WHERE field IN ('owner', 'availability', 'duplicate') AND reviewed_at >= now() - interval '60 days' AND agrees IS NOT NULL
    GROUP BY field
  )
  SELECT jsonb_build_object(
    'generated_at', now(),
    'universe_programs', (SELECT count(*) FROM public.clinical_assets WHERE program_primary),
    'feed_programs', (SELECT count(*) FROM tmp_sc_feed),
    'feed_companies', v_feed_cos,
    -- accuracy
    'top500_originator_share', (SELECT avg((ownership_status = 'originator')::int) FROM top500),
    'top1k_duplicates', (SELECT (count(*) - count(DISTINCT coalesce(drug_master_id::text, id::text)))
                              + (count(*) - count(DISTINCT company_id::text || lower(coalesce(program_name, asset_name)))) FROM top1k),
    'top1k_n', (SELECT count(*) FROM top1k),
    'feed_drug_resolved_share', (SELECT avg((drug_master_id IS NOT NULL)::int) FROM tmp_sc_feed),
    'audit_owner_n', coalesce((SELECT n FROM audits WHERE field = 'owner'), 0),
    'audit_owner_share', (SELECT share FROM audits WHERE field = 'owner'),
    'audit_availability_n', coalesce((SELECT n FROM audits WHERE field = 'availability'), 0),
    'audit_availability_share', (SELECT share FROM audits WHERE field = 'availability'),
    'audit_duplicate_n', coalesce((SELECT n FROM audits WHERE field = 'duplicate'), 0),
    'audit_duplicate_share', (SELECT share FROM audits WHERE field = 'duplicate'),
    -- ranking
    'backtest_model_version', (SELECT model_version FROM bt),
    'backtest_roc_auc', (SELECT roc_auc FROM bt),
    'backtest_precision_at_100', (SELECT precision_at_100 FROM bt),
    'backtest_base_rate', (SELECT positives_test::numeric / NULLIF(n_test, 0) FROM bt),
    'backtest_lift_top_decile', (SELECT lift_top_decile FROM bt),
    'forward_n', (SELECT count(*) FROM fwd_pct),
    'forward_top_decile_share', (SELECT avg((frac_above < 0.10)::int) FROM fwd_pct),
    -- coverage
    'deals_12m', (SELECT count(*) FROM deals12),
    'deals_12m_linked', (SELECT count(*) FROM deals12 d WHERE EXISTS (SELECT 1 FROM public.clinical_assets a WHERE a.deal_ids @> ARRAY[d.id])),
    'feed_classified_share', (SELECT avg((classification_status = 'classified')::int) FROM tmp_sc_feed),
    'feed_ta_share', (SELECT avg((therapeutic_area IS NOT NULL)::int) FROM tmp_sc_feed),
    'feed_region_share', (SELECT avg((originator_region IS NOT NULL)::int) FROM tmp_sc_feed),
    -- signals
    'signal_companies', v_signal_cos,
    -- freshness
    'hours_since_classify_ok', (SELECT extract(epoch FROM now() - max(completed_at)) / 3600 FROM public.data_ingestion_log
                                WHERE source = 'asset_universe' AND parameters->>'stage' = 'classify' AND status = 'completed'),
    'failed_runs_48h', (SELECT count(*) FROM public.data_ingestion_log WHERE started_at > now() - interval '48 hours' AND status = 'failed'),
    -- evidence
    'top500_sourced_share', (SELECT avg((cardinality(coalesce(nct_ids, '{}')) > 0 OR disclosure_url IS NOT NULL)::int) FROM top500),
    'top500_partnership_checked_share', (SELECT avg((partnership_basis IS NOT NULL)::int) FROM top500)
  ) INTO v_out;

  DROP TABLE IF EXISTS tmp_sc_feed;
  RETURN v_out;
END;
$function$;

COMMENT ON FUNCTION public.radar_qa_scorecard_stats() IS
  'Raw measures behind the Search & Evaluation scorecard (lib/radar/qa/scorecard.ts); migration 190.';
