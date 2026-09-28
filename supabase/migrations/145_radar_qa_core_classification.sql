-- 145: classification coverage measured on the core universe.
--
-- Classification runs on the core universe by decision (industry sponsor,
-- unpartnered or partially partnered, pre-approval phase, ownership not
-- comparator / marketed elsewhere); Phase 4 and marketed-elsewhere rows are
-- left unclassified on purpose (?scope=all restores them). The QA gate's
-- classification_coverage still divided by every industry asset, so it
-- reported a blocker (68%) while the default view was at 91% classified
-- with nothing left in the queue. This function gives the gate the same
-- denominator the queue uses; p_phases is passed from CORE_UNIVERSE_PHASES.

CREATE OR REPLACE FUNCTION radar_qa_core_classification(p_phases TEXT[])
RETURNS JSONB
LANGUAGE sql
STABLE
SET statement_timeout TO '120s'
AS $$
  WITH core AS (
    SELECT a.classification_status
    FROM clinical_assets a
    JOIN companies c ON c.id = a.company_id
    WHERE c.owner_type = 'industry'
      AND a.partnership_status IN ('unpartnered', 'partially_partnered')
      AND a.phase = ANY(p_phases)
      AND COALESCE(a.ownership_status, 'unknown') NOT IN ('comparator_or_background', 'marketed_other')
  )
  SELECT jsonb_build_object(
    'total',        COUNT(*),
    'classified',   COUNT(*) FILTER (WHERE classification_status = 'classified'),
    'skipped',      COUNT(*) FILTER (WHERE classification_status = 'skipped'),
    'needs_review', COUNT(*) FILTER (WHERE classification_status = 'needs_review'),
    'unclassified', COUNT(*) FILTER (WHERE classification_status = 'unclassified')
  )
  FROM core;
$$;


-- active_trial_freshness reported "0 of 0": clinical_assets.trial_status is
-- the coarse vocabulary (active / completed / other), not the registry
-- statuses the 124 function filtered on. Same function, with 'active' added
-- to the two freshness counts.
CREATE OR REPLACE FUNCTION radar_qa_universe_stats(p_vocab JSONB DEFAULT '{}'::jsonb)
RETURNS JSONB
LANGUAGE plpgsql STABLE
SET statement_timeout = '180s'
AS $$
DECLARE
  v_phase_ok   TEXT[] := COALESCE(ARRAY(SELECT jsonb_array_elements_text(p_vocab->'phase')), ARRAY[]::TEXT[]);
  v_terr_ok    TEXT[] := COALESCE(ARRAY(SELECT jsonb_array_elements_text(p_vocab->'territories')), ARRAY['global','us','eu','japan','china','row']);
  v_out        JSONB;
BEGIN
  WITH base AS (
    SELECT a.id, a.company_id, a.company_name, a.phase, a.trial_status, a.target, a.last_update_date,
           a.partnership_status, a.partnership_evidence, a.partnership_checked_at,
           a.territory_rights_available, a.drug_resolution_status, a.classification_status,
           a.trial_count,
           (c.owner_type = 'industry') AS is_industry,
           (jsonb_typeof(a.partnership_evidence) = 'array'
             AND EXISTS (SELECT 1 FROM jsonb_array_elements(a.partnership_evidence) e
                         WHERE e->>'type' IN ('deal', 'press_release'))) AS has_hard_evidence,
           (a.territory_rights_available IS NOT NULL
             AND EXISTS (SELECT 1 FROM unnest(a.territory_rights_available) t WHERE NOT (t = ANY(v_terr_ok)))) AS territory_bad
    FROM clinical_assets a
    LEFT JOIN companies c ON c.id = a.company_id
  ),
  agg AS (
    SELECT
      COUNT(*)                                                                    AS total_assets,
      COUNT(*) FILTER (WHERE is_industry)                                         AS industry_assets,
      COUNT(*) FILTER (WHERE company_id IS NULL AND (company_name IS NULL OR btrim(company_name) = '')) AS missing_company,
      COUNT(*) FILTER (WHERE is_industry AND (phase IS NULL OR phase IN ('not_applicable', 'unknown')
                                              OR (cardinality(v_phase_ok) > 0 AND NOT (phase = ANY(v_phase_ok))))) AS industry_phase_missing,
      COUNT(*) FILTER (WHERE is_industry AND classification_status = 'classified')   AS cls_classified,
      COUNT(*) FILTER (WHERE is_industry AND classification_status = 'skipped')      AS cls_skipped,
      COUNT(*) FILTER (WHERE is_industry AND classification_status = 'needs_review') AS cls_needs_review,
      COUNT(*) FILTER (WHERE is_industry AND classification_status = 'unclassified') AS cls_unclassified,
      COUNT(*) FILTER (WHERE is_industry AND classification_status = 'classified'
                         AND phase IN ('phase_2', 'phase_2_3', 'phase_3', 'phase_4'))  AS target_p2_classified,
      COUNT(*) FILTER (WHERE is_industry AND classification_status = 'classified'
                         AND phase IN ('phase_2', 'phase_2_3', 'phase_3', 'phase_4')
                         AND target IS NOT NULL AND btrim(target) <> '')             AS target_p2_with_target,
      COUNT(*) FILTER (WHERE is_industry AND drug_resolution_status = 'resolved')   AS drug_resolved,
      COUNT(*) FILTER (WHERE partnership_checked_at IS NOT NULL)                   AS partnership_checked,
      COUNT(*) FILTER (WHERE partnership_checked_at IS NULL)                       AS partnership_never_checked,
      COUNT(*) FILTER (WHERE partnership_status = 'partnered' AND NOT has_hard_evidence) AS partnered_without_evidence,
      COUNT(*) FILTER (WHERE territory_bad)                                       AS territory_violations,
      COUNT(*) FILTER (WHERE trial_status IN ('active', 'recruiting', 'active_not_recruiting', 'enrolling_by_invitation', 'not_yet_recruiting')) AS active_trial_assets,
      COUNT(*) FILTER (WHERE trial_status IN ('active', 'recruiting', 'active_not_recruiting', 'enrolling_by_invitation', 'not_yet_recruiting')
                         AND last_update_date IS NOT NULL AND last_update_date >= CURRENT_DATE - 400) AS active_fresh_400d,
      COUNT(*) FILTER (WHERE COALESCE(trial_count, 0) >= 1)                        AS assets_with_trials
    FROM base
  ),
  s_missing_company AS (
    SELECT COALESCE(jsonb_agg(id), '[]'::jsonb) AS ids FROM (
      SELECT id FROM base WHERE company_id IS NULL AND (company_name IS NULL OR btrim(company_name) = '') ORDER BY id LIMIT 20) x
  ),
  s_partnered AS (
    SELECT COALESCE(jsonb_agg(id), '[]'::jsonb) AS ids FROM (
      SELECT id FROM base WHERE partnership_status = 'partnered' AND NOT has_hard_evidence
      ORDER BY id LIMIT 20) x
  ),
  s_territory AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'values', territory_rights_available)), '[]'::jsonb) AS rows FROM (
      SELECT id, territory_rights_available FROM base WHERE territory_bad
      ORDER BY id LIMIT 20) x
  ),
  s_phase AS (
    SELECT COALESCE(jsonb_agg(id), '[]'::jsonb) AS ids FROM (
      SELECT id FROM base WHERE is_industry AND (phase IS NULL OR phase IN ('not_applicable', 'unknown')) ORDER BY id LIMIT 20) x
  )
  SELECT jsonb_build_object(
    'total_assets', agg.total_assets,
    'industry_assets', agg.industry_assets,
    'assets_with_trials', agg.assets_with_trials,
    'missing_company', jsonb_build_object('count', agg.missing_company, 'sample_ids', s_missing_company.ids),
    'industry_phase_missing', jsonb_build_object('count', agg.industry_phase_missing, 'sample_ids', s_phase.ids),
    'classification', jsonb_build_object(
      'classified', agg.cls_classified, 'skipped', agg.cls_skipped,
      'needs_review', agg.cls_needs_review, 'unclassified', agg.cls_unclassified),
    'target_p2plus', jsonb_build_object('classified', agg.target_p2_classified, 'with_target', agg.target_p2_with_target),
    'drug_resolution', jsonb_build_object('resolved', agg.drug_resolved),
    'partnership', jsonb_build_object(
      'checked', agg.partnership_checked, 'never_checked', agg.partnership_never_checked,
      'partnered_without_evidence', jsonb_build_object('count', agg.partnered_without_evidence, 'sample_ids', s_partnered.ids)),
    'territory', jsonb_build_object('violations', agg.territory_violations, 'samples', s_territory.rows),
    'freshness', jsonb_build_object('active_trial_assets', agg.active_trial_assets, 'fresh_400d', agg.active_fresh_400d)
  )
  INTO v_out
  FROM agg, s_missing_company, s_partnered, s_territory, s_phase;

  RETURN v_out;
END;
$$;
