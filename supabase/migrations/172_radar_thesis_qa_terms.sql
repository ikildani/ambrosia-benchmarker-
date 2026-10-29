-- 172: Radar thesis QA — checks that match the 2026-10-28 terms fix.
--
-- Adds three outputs to radar_qa_thesis_stats(); every existing key is kept so
-- lib/radar/qa/invariants.ts works before and after this migration:
--   calculator_log_ratio  symmetric calculator gap, median |ln(calc / headline)|
--                         and the share of theses more than 2x apart
--   upfront_by_phase      median headline upfront per phase (phase_matched)
--   ma_in_pool            phase_matched theses whose comp pool holds an
--                         acquisition / merger (must be 0 after regeneration)
-- Read-only function; no data is changed.

CREATE OR REPLACE FUNCTION radar_qa_thesis_stats()
RETURNS JSONB
LANGUAGE plpgsql STABLE
SET statement_timeout = '120s'
AS $$
DECLARE
  v_out JSONB;
BEGIN
  WITH cov AS (
    SELECT
      COUNT(*)                                   AS eligible,
      COUNT(*) FILTER (WHERE t.asset_id IS NOT NULL) AS with_thesis
    FROM radar_thesis_eligible_assets e
    LEFT JOIN radar_deal_theses t ON t.asset_id = e.id
  ),
  th AS (
    SELECT
      t.asset_id,
      t.insufficient_comps,
      t.comp_count,
      t.verified_comp_count,
      t.comp_relaxation,
      t.terms_basis,
      t.predicted_upfront_mid,
      t.predicted_total_mid,
      t.predicted_royalty_mid,
      t.calculator_upfront_mid,
      CASE
        WHEN t.insufficient_comps THEN 'insufficient'
        WHEN t.comp_relaxation = 'none' THEN 'phase_matched'
        WHEN t.comp_relaxation = 'modality_only' THEN 'ta_modality'
        WHEN t.comp_relaxation = 'ta_only' THEN 'ta_only'
        ELSE NULL
      END AS expected_basis
    FROM radar_deal_theses t
  ),
  agg AS (
    SELECT
      COUNT(*) AS theses,
      COUNT(*) FILTER (WHERE insufficient_comps AND (predicted_upfront_mid IS NOT NULL OR predicted_total_mid IS NOT NULL OR predicted_royalty_mid IS NOT NULL)) AS insufficient_with_predicted,
      COUNT(*) FILTER (WHERE COALESCE(comp_count, 0) < COALESCE(verified_comp_count, 0)) AS comp_count_below_verified,
      COUNT(*) FILTER (WHERE terms_basis IS NOT NULL AND expected_basis IS NOT NULL AND terms_basis <> expected_basis) AS terms_basis_inconsistent,
      COUNT(*) FILTER (WHERE terms_basis IS NULL) AS terms_basis_null
    FROM th
  ),
  ratio AS (
    SELECT
      COUNT(*) AS n,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY abs(calculator_upfront_mid - predicted_upfront_mid) / predicted_upfront_mid) AS median,
      percentile_cont(0.9) WITHIN GROUP (ORDER BY abs(calculator_upfront_mid - predicted_upfront_mid) / predicted_upfront_mid) AS p90
    FROM th
    WHERE terms_basis = 'phase_matched'
      AND calculator_upfront_mid IS NOT NULL
      AND predicted_upfront_mid IS NOT NULL AND predicted_upfront_mid > 0
  ),
  -- 172: symmetric calculator gap, |ln(calculator / headline)|. The old
  -- |calc − comps| / comps scored "calculator 3× high" as 2.0 but "3× low"
  -- as 0.67, and treated the calculator as the reference.
  log_ratio AS (
    SELECT
      COUNT(*) AS n,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY abs(ln(calculator_upfront_mid::numeric / predicted_upfront_mid))) AS median_abs_log,
      AVG(CASE WHEN calculator_upfront_mid > 2 * predicted_upfront_mid OR 2 * calculator_upfront_mid < predicted_upfront_mid THEN 1.0 ELSE 0.0 END) AS share_over_2x
    FROM th
    WHERE terms_basis = 'phase_matched'
      AND calculator_upfront_mid IS NOT NULL AND calculator_upfront_mid > 0
      AND predicted_upfront_mid IS NOT NULL AND predicted_upfront_mid > 0
  ),
  -- 172: headline upfront by phase (phase from profile_key) on phase_matched theses.
  phase_med AS (
    SELECT split_part(t.profile_key, '::', 3) AS phase,
           COUNT(*) AS n,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY t.predicted_upfront_mid) AS median
    FROM radar_deal_theses t
    WHERE t.terms_basis = 'phase_matched' AND t.predicted_upfront_mid > 0 AND t.profile_key IS NOT NULL
    GROUP BY 1
  ),
  -- 172: an acquisition / merger price is not a licensing upfront.
  ma_pool AS (
    SELECT t.asset_id
    FROM radar_deal_theses t
    WHERE t.terms_basis = 'phase_matched'
      AND EXISTS (
        SELECT 1 FROM unnest(t.comp_deal_ids) AS x(id)
        JOIN deals d ON d.id = x.id
        WHERE lower(coalesce(d.deal_type, '')) IN ('acquisition', 'acquisitions', 'merger', 'm&a')
      )
  ),
  s_ma AS (
    SELECT COUNT(*) AS n, COALESCE(jsonb_agg(asset_id) FILTER (WHERE rn <= 20), '[]'::jsonb) AS ids
    FROM (SELECT asset_id, row_number() OVER (ORDER BY asset_id) AS rn FROM ma_pool) x
  ),
  s_insuff AS (
    SELECT COALESCE(jsonb_agg(asset_id), '[]'::jsonb) AS ids FROM (
      SELECT asset_id FROM th WHERE insufficient_comps AND (predicted_upfront_mid IS NOT NULL OR predicted_total_mid IS NOT NULL OR predicted_royalty_mid IS NOT NULL)
      ORDER BY asset_id LIMIT 20) x
  ),
  s_verified AS (
    SELECT COALESCE(jsonb_agg(asset_id), '[]'::jsonb) AS ids FROM (
      SELECT asset_id FROM th WHERE COALESCE(comp_count, 0) < COALESCE(verified_comp_count, 0) ORDER BY asset_id LIMIT 20) x
  ),
  s_basis AS (
    SELECT COALESCE(jsonb_agg(asset_id), '[]'::jsonb) AS ids FROM (
      SELECT asset_id FROM th WHERE terms_basis IS NOT NULL AND expected_basis IS NOT NULL AND terms_basis <> expected_basis ORDER BY asset_id LIMIT 20) x
  )
  SELECT jsonb_build_object(
    'eligible', cov.eligible,
    'with_thesis', cov.with_thesis,
    'theses', agg.theses,
    'insufficient_with_predicted', jsonb_build_object('count', agg.insufficient_with_predicted, 'sample_ids', s_insuff.ids),
    'comp_count_below_verified', jsonb_build_object('count', agg.comp_count_below_verified, 'sample_ids', s_verified.ids),
    'terms_basis_inconsistent', jsonb_build_object('count', agg.terms_basis_inconsistent, 'sample_ids', s_basis.ids),
    'terms_basis_null', agg.terms_basis_null,
    'calculator_ratio', jsonb_build_object('n', ratio.n, 'median', ratio.median, 'p90', ratio.p90),
    'calculator_log_ratio', jsonb_build_object('n', log_ratio.n, 'median_abs_log', log_ratio.median_abs_log, 'share_over_2x', log_ratio.share_over_2x),
    'upfront_by_phase', COALESCE((SELECT jsonb_object_agg(phase, jsonb_build_object('n', n, 'median', median)) FROM phase_med), '{}'::jsonb),
    'ma_in_pool', jsonb_build_object('count', s_ma.n, 'sample_ids', s_ma.ids)
  )
  INTO v_out
  FROM cov, agg, ratio, log_ratio, s_ma, s_insuff, s_verified, s_basis;

  RETURN v_out;
END;
$$;

REVOKE ALL ON FUNCTION radar_qa_thesis_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION radar_qa_thesis_stats() TO service_role;
