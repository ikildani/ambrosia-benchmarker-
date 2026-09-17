-- 119_radar_qa.sql
--
-- Asset Radar golden-set QA harness (docs/asset-radar-qa.md).
--
-- Two halves:
--   1. Automated invariant checks over the whole universe, computed
--      set-based inside Postgres by the radar_qa_* RPCs below and evaluated
--      against thresholds in lib/radar/qa/invariants.ts.
--   2. A stratified 200-asset golden set (radar_qa_golden_assets) with a
--      frozen snapshot per asset, a model-vs-model agreement check
--      (claude-opus-4-6 re-derives the classification and partnership
--      status) and a human review sheet (radar_qa_human_reviews).
--
-- Every run writes one radar_qa_runs row; every failed check writes
-- radar_qa_findings rows with a severity (blocker / major / minor).
--
-- Service-role only (pattern from migration 101): all reads go through
-- /api/radar/qa (admin) and /api/cron/radar-qa.
--
-- Idempotent: safe to re-run.

BEGIN;

-- ══════════════════════════════════════════════════════════════════════
-- 1. TABLES
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS radar_qa_runs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  kind              TEXT NOT NULL CHECK (kind IN ('invariants', 'golden_agreement', 'golden_human')),
  universe_size     INTEGER,
  summary           JSONB NOT NULL DEFAULT '{}'::jsonb,
  passed            BOOLEAN,
  blocking_failures INTEGER NOT NULL DEFAULT 0,
  notes             TEXT
);

COMMENT ON TABLE radar_qa_runs IS
  'One row per QA run. kind=invariants: automated checks over the universe; golden_agreement: Opus re-derivation over the golden set; golden_human: imported analyst review sheet. summary holds the full report payload.';

CREATE TABLE IF NOT EXISTS radar_qa_golden_assets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id        UUID NOT NULL REFERENCES clinical_assets(id) ON DELETE CASCADE,
  stratum         TEXT NOT NULL,
  seed            TEXT,
  selected_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  frozen_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT radar_qa_golden_assets_asset_unique UNIQUE (asset_id)
);

COMMENT ON TABLE radar_qa_golden_assets IS
  'Stratified golden set (owner group x phase bucket x region). frozen_snapshot = asset row + thesis row + top factor contributions + drug_master row + partnership evidence at selection time, so later drift is visible.';

CREATE TABLE IF NOT EXISTS radar_qa_findings (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id     UUID NOT NULL REFERENCES radar_qa_runs(id) ON DELETE CASCADE,
  asset_id   UUID REFERENCES clinical_assets(id) ON DELETE SET NULL,
  check_name TEXT NOT NULL,
  severity   TEXT NOT NULL CHECK (severity IN ('blocker', 'major', 'minor')),
  expected   TEXT,
  observed   TEXT,
  details    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE radar_qa_findings IS
  'One row per failed check (asset_id NULL for universe-level checks) or per golden-set disagreement (asset_id set). blocker = cannot launch; major = must appear in the launch notes; minor = backlog.';

CREATE TABLE IF NOT EXISTS radar_qa_human_reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id    UUID NOT NULL REFERENCES clinical_assets(id) ON DELETE CASCADE,
  reviewer    TEXT NOT NULL,
  field       TEXT NOT NULL,
  model_value TEXT,
  human_value TEXT,
  agrees      BOOLEAN,
  comment     TEXT,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE radar_qa_human_reviews IS
  'Imported analyst review sheet rows (lib/radar/qa/golden-set.ts importHumanReviews). One row per asset x field x reviewer.';

CREATE INDEX IF NOT EXISTS idx_radar_qa_runs_run_at ON radar_qa_runs (run_at DESC);
CREATE INDEX IF NOT EXISTS idx_radar_qa_runs_kind_run_at ON radar_qa_runs (kind, run_at DESC);
CREATE INDEX IF NOT EXISTS idx_radar_qa_findings_run_severity ON radar_qa_findings (run_id, severity);
CREATE INDEX IF NOT EXISTS idx_radar_qa_findings_asset ON radar_qa_findings (asset_id) WHERE asset_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_radar_qa_golden_assets_stratum ON radar_qa_golden_assets (stratum);
CREATE INDEX IF NOT EXISTS idx_radar_qa_human_reviews_asset_field ON radar_qa_human_reviews (asset_id, field);

-- ── RLS: service_role only ────────────────────────────────────────────

ALTER TABLE radar_qa_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE radar_qa_golden_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE radar_qa_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE radar_qa_human_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access radar_qa_runs" ON radar_qa_runs;
CREATE POLICY "Service role full access radar_qa_runs"
  ON radar_qa_runs FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access radar_qa_golden_assets" ON radar_qa_golden_assets;
CREATE POLICY "Service role full access radar_qa_golden_assets"
  ON radar_qa_golden_assets FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access radar_qa_findings" ON radar_qa_findings;
CREATE POLICY "Service role full access radar_qa_findings"
  ON radar_qa_findings FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access radar_qa_human_reviews" ON radar_qa_human_reviews;
CREATE POLICY "Service role full access radar_qa_human_reviews"
  ON radar_qa_human_reviews FOR ALL TO service_role USING (true) WITH CHECK (true);

REVOKE ALL ON radar_qa_runs, radar_qa_golden_assets, radar_qa_findings, radar_qa_human_reviews FROM PUBLIC, anon, authenticated;
GRANT ALL ON radar_qa_runs, radar_qa_golden_assets, radar_qa_findings, radar_qa_human_reviews TO service_role;

-- ══════════════════════════════════════════════════════════════════════
-- 2. INVARIANT RPCs (set-based; thresholds live in lib/radar/qa/invariants.ts)
-- ══════════════════════════════════════════════════════════════════════

-- 2a. Vocabulary violations for one column. The allowed list is passed in
--     from lib/radar/vocab.ts so the database never carries a second copy.
CREATE OR REPLACE FUNCTION radar_qa_vocab_violations(
  p_table   TEXT,
  p_column  TEXT,
  p_allowed TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql STABLE
SET statement_timeout = '60s'
AS $$
DECLARE
  v_count   BIGINT;
  v_samples JSONB;
BEGIN
  IF p_table NOT IN ('clinical_assets', 'companies') THEN
    RAISE EXCEPTION 'radar_qa_vocab_violations: table % not allowed', p_table;
  END IF;
  IF p_column NOT IN ('therapeutic_area', 'modality', 'phase', 'partnership_status', 'originator_region', 'owner_type', 'trial_status', 'drug_resolution_status', 'classification_status') THEN
    RAISE EXCEPTION 'radar_qa_vocab_violations: column % not allowed', p_column;
  END IF;

  EXECUTE format(
    'SELECT COUNT(*) FROM %I WHERE %I IS NOT NULL AND NOT (%I = ANY($1))',
    p_table, p_column, p_column
  ) INTO v_count USING p_allowed;

  EXECUTE format(
    'SELECT COALESCE(jsonb_agg(jsonb_build_object(''value'', v, ''count'', n)), ''[]''::jsonb)
       FROM (SELECT %I AS v, COUNT(*) AS n FROM %I
              WHERE %I IS NOT NULL AND NOT (%I = ANY($1))
              GROUP BY %I ORDER BY n DESC LIMIT 20) s',
    p_column, p_table, p_column, p_column, p_column
  ) INTO v_samples USING p_allowed;

  RETURN jsonb_build_object('violations', v_count, 'samples', v_samples);
END;
$$;

-- 2b. Universe-level stats. p_vocab: {phase: [...], territories: [...]}.
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
      COUNT(*) FILTER (WHERE trial_status IN ('recruiting', 'active_not_recruiting', 'enrolling_by_invitation', 'not_yet_recruiting')) AS active_trial_assets,
      COUNT(*) FILTER (WHERE trial_status IN ('recruiting', 'active_not_recruiting', 'enrolling_by_invitation', 'not_yet_recruiting')
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

-- 2c. Deal-thesis honesty contract (migrations 093 / 104 / 116).
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
    'calculator_ratio', jsonb_build_object('n', ratio.n, 'median', ratio.median, 'p90', ratio.p90)
  )
  INTO v_out
  FROM cov, agg, ratio, s_insuff, s_verified, s_basis;

  RETURN v_out;
END;
$$;

-- 2d. Score contract (migrations 103 / 115). Latest snapshot per industry
--     asset scored in the last p_days days.
CREATE OR REPLACE FUNCTION radar_qa_score_stats(p_days INT DEFAULT 14)
RETURNS JSONB
LANGUAGE plpgsql STABLE
SET statement_timeout = '180s'
AS $$
DECLARE
  v_out          JSONB;
  v_active_model TEXT;
BEGIN
  SELECT version INTO v_active_model FROM radar_score_models WHERE is_active = true LIMIT 1;

  WITH scored AS (
    SELECT a.id, a.licensing_intent_score, a.score_confidence, a.score_model_version, a.last_scored_at
    FROM clinical_assets a
    JOIN companies c ON c.id = a.company_id AND c.owner_type = 'industry'
    WHERE a.last_scored_at IS NOT NULL
  ),
  latest AS (
    SELECT DISTINCT ON (s.asset_id) s.asset_id, s.licensing_intent_score, s.factor_scores, s.model_version, s.snapshot_date
    FROM asset_signal_snapshots s
    JOIN scored a ON a.id = s.asset_id
    WHERE s.snapshot_date >= CURRENT_DATE - GREATEST(COALESCE(p_days, 14), 1)
    ORDER BY s.asset_id, s.snapshot_date DESC
  ),
  checked AS (
    SELECT
      l.asset_id,
      l.licensing_intent_score,
      l.model_version,
      (jsonb_typeof(l.factor_scores) = 'array') AS is_array,
      CASE WHEN jsonb_typeof(l.factor_scores) = 'array' THEN jsonb_array_length(l.factor_scores) ELSE 0 END AS entries,
      CASE WHEN jsonb_typeof(l.factor_scores) = 'array'
           THEN (SELECT SUM(NULLIF(e->>'points', '')::numeric) FROM jsonb_array_elements(l.factor_scores) e)
           ELSE NULL END AS points_sum,
      CASE WHEN jsonb_typeof(l.factor_scores) = 'array'
           THEN EXISTS (SELECT 1 FROM jsonb_array_elements(l.factor_scores) e WHERE e->>'factor' = 'intercept')
           ELSE false END AS has_intercept,
      (l.model_version IS NULL OR l.model_version = 'v2-composite') AS is_v2
    FROM latest l
  ),
  flags AS (
    SELECT
      c.*,
      (NOT is_array OR entries < 9) AS entries_bad,
      CASE
        WHEN is_v2 THEN (points_sum IS NULL OR abs(points_sum - licensing_intent_score) > 0.5)
        ELSE (points_sum IS NULL OR NOT has_intercept OR abs(points_sum) > 20)
      END AS sum_bad
    FROM checked c
  ),
  agg AS (
    SELECT
      (SELECT COUNT(*) FROM scored)                                           AS scored_industry,
      COUNT(*)                                                                AS snapshot_checked,
      COUNT(*) FILTER (WHERE entries_bad)                                     AS entries_bad,
      COUNT(*) FILTER (WHERE sum_bad)                                         AS sum_bad,
      COUNT(*) FILTER (WHERE NOT is_v2)                                       AS v3_rows,
      COUNT(*) FILTER (WHERE is_v2)                                           AS v2_rows,
      COUNT(*) FILTER (WHERE model_version IS NULL)                           AS model_version_missing
    FROM flags
  ),
  dist AS (
    SELECT
      COUNT(*)                                                    AS n,
      MAX(licensing_intent_score)                                 AS max,
      AVG(licensing_intent_score)                                 AS mean,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY licensing_intent_score) AS p50,
      percentile_cont(0.9) WITHIN GROUP (ORDER BY licensing_intent_score) AS p90,
      COUNT(*) FILTER (WHERE licensing_intent_score >= 50)        AS count_ge_50,
      COUNT(*) FILTER (WHERE licensing_intent_score >= 30)        AS count_ge_30,
      COUNT(*) FILTER (WHERE score_confidence IS NULL)            AS confidence_missing,
      COUNT(*) FILTER (WHERE score_model_version IS NULL)         AS asset_model_version_missing
    FROM scored
  ),
  s_entries AS (
    SELECT COALESCE(jsonb_agg(asset_id), '[]'::jsonb) AS ids FROM (SELECT asset_id FROM flags WHERE entries_bad ORDER BY asset_id LIMIT 20) x
  ),
  s_sum AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', asset_id, 'score', licensing_intent_score, 'points_sum', points_sum, 'model_version', model_version)), '[]'::jsonb) AS rows
    FROM (SELECT asset_id, licensing_intent_score, points_sum, model_version FROM flags WHERE sum_bad ORDER BY asset_id LIMIT 20) x
  )
  SELECT jsonb_build_object(
    'active_model_version', v_active_model,
    'scored_industry', agg.scored_industry,
    'snapshot_checked', agg.snapshot_checked,
    'v2_rows', agg.v2_rows,
    'v3_rows', agg.v3_rows,
    'entries_bad', jsonb_build_object('count', agg.entries_bad, 'sample_ids', s_entries.ids),
    'sum_bad', jsonb_build_object('count', agg.sum_bad, 'samples', s_sum.rows),
    'snapshot_model_version_missing', agg.model_version_missing,
    'asset_model_version_missing', dist.asset_model_version_missing,
    'confidence_missing', dist.confidence_missing,
    'distribution', jsonb_build_object(
      'n', dist.n, 'max', dist.max, 'mean', dist.mean, 'p50', dist.p50, 'p90', dist.p90,
      'count_ge_50', dist.count_ge_50, 'count_ge_30', dist.count_ge_30)
  )
  INTO v_out
  FROM agg, dist, s_entries, s_sum;

  RETURN v_out;
END;
$$;

-- 2e. Pipeline health: duplicates, orphans, press mentions, cron freshness.
CREATE OR REPLACE FUNCTION radar_qa_pipeline_stats()
RETURNS JSONB
LANGUAGE plpgsql STABLE
SET statement_timeout = '180s'
AS $$
DECLARE
  v_dupes      JSONB;
  v_dupe_total BIGINT := 0;
  v_orphans    BIGINT;
  v_press      JSONB;
  v_stages     JSONB;
  v_failures   JSONB;
BEGIN
  -- Cross-company drug_master groups (migration 113 RPC).
  BEGIN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
             'drug_master_id', d.drug_master_id, 'preferred_name', d.preferred_name,
             'companies', d.companies, 'assets', d.assets, 'sample_assets', d.sample_assets)), '[]'::jsonb),
           COALESCE(MAX(d.total_groups), 0)
      INTO v_dupes, v_dupe_total
      FROM radar_drug_duplicates(10) d;
  EXCEPTION WHEN OTHERS THEN
    v_dupes := '[]'::jsonb;
    v_dupe_total := -1;
  END;

  -- company_trials rows whose company no longer exists (or was never set).
  SELECT COUNT(*) INTO v_orphans
    FROM company_trials t
   WHERE t.company_id IS NULL
      OR NOT EXISTS (SELECT 1 FROM companies c WHERE c.id = t.company_id);

  -- press_releases persisted in the last 90 days with nothing resolved.
  SELECT jsonb_build_object(
           'total_90d', COUNT(*),
           'empty', COUNT(*) FILTER (WHERE companies_mentioned IS NULL OR cardinality(companies_mentioned) = 0))
    INTO v_press
    FROM press_releases
   WHERE published_at >= now() - INTERVAL '90 days';

  -- Latest completed/partial run per (source, stage) in the last 48 h.
  SELECT COALESCE(jsonb_agg(jsonb_build_object('source', source, 'stage', stage, 'last_run_at', last_run_at, 'status', status, 'runs', runs)), '[]'::jsonb)
    INTO v_stages
    FROM (
      SELECT source,
             COALESCE(parameters->>'stage', '') AS stage,
             MAX(started_at) AS last_run_at,
             (ARRAY_AGG(status ORDER BY started_at DESC))[1] AS status,
             COUNT(*) AS runs
        FROM data_ingestion_log
       WHERE started_at >= now() - INTERVAL '48 hours'
         AND status IN ('completed', 'partial')
         AND source IN ('asset_universe', 'licensing_signals', 'deal_thesis', 'mandate_matcher',
                        'competitive_intel', 'deal_creator', 'asset_classify')
       GROUP BY source, COALESCE(parameters->>'stage', '')
    ) s;

  -- Failed runs in the last 7 days per (source, stage).
  SELECT COALESCE(jsonb_agg(jsonb_build_object('source', source, 'stage', stage, 'failed', failed, 'last_failed_at', last_failed_at, 'sample_error', sample_error)), '[]'::jsonb)
    INTO v_failures
    FROM (
      SELECT source,
             COALESCE(parameters->>'stage', '') AS stage,
             COUNT(*) AS failed,
             MAX(started_at) AS last_failed_at,
             (ARRAY_AGG(LEFT(errors::text, 300) ORDER BY started_at DESC))[1] AS sample_error
        FROM data_ingestion_log
       WHERE started_at >= now() - INTERVAL '7 days'
         AND status = 'failed'
         AND source IN ('asset_universe', 'licensing_signals', 'deal_thesis', 'mandate_matcher',
                        'competitive_intel', 'deal_creator', 'asset_classify')
       GROUP BY source, COALESCE(parameters->>'stage', '')
    ) f;

  RETURN jsonb_build_object(
    'duplicates', jsonb_build_object('groups', v_dupe_total, 'sample', v_dupes),
    'trial_orphans', jsonb_build_object('count', v_orphans),
    'press_empty_mentions', v_press,
    'stages', v_stages,
    'cron_failures_7d', v_failures
  );
END;
$$;

-- ══════════════════════════════════════════════════════════════════════
-- 3. GOLDEN SET CANDIDATES
-- ══════════════════════════════════════════════════════════════════════

-- Deterministic stratified candidates: within each (owner_group, phase_bucket,
-- region_bucket) stratum the first p_per_stratum assets ordered by
-- md5(id || seed). lib/radar/qa/golden-set.ts applies the quotas with the
-- same hash so the final set is reproducible from (seed, universe).
CREATE OR REPLACE FUNCTION radar_qa_golden_candidates(
  p_seed        TEXT,
  p_per_stratum INT DEFAULT 80
)
RETURNS TABLE(
  asset_id      UUID,
  owner_group   TEXT,
  phase_bucket  TEXT,
  region_bucket TEXT,
  hash          TEXT,
  rank          BIGINT
)
LANGUAGE sql STABLE
SET statement_timeout = '120s'
AS $$
  WITH pool AS (
    SELECT
      a.id,
      CASE WHEN c.owner_type = 'industry' THEN 'industry'
           WHEN c.owner_type IN ('academic', 'hospital') THEN 'academic_hospital'
           ELSE NULL END AS owner_group,
      CASE WHEN a.phase IN ('early_phase_1', 'phase_1') THEN 'p1'
           WHEN a.phase IN ('phase_1_2', 'phase_2') THEN 'p2'
           WHEN a.phase IN ('phase_2_3', 'phase_3') THEN 'p3'
           ELSE NULL END AS phase_bucket,
      CASE WHEN a.originator_region = 'north_america' THEN 'north_america'
           WHEN a.originator_region = 'europe' THEN 'europe'
           WHEN a.originator_region IN ('china', 'japan', 'south_korea') THEN 'east_asia'
           ELSE 'other' END AS region_bucket,
      md5(a.id::text || COALESCE(p_seed, '')) AS hash
    FROM clinical_assets a
    JOIN companies c ON c.id = a.company_id
    WHERE COALESCE(a.trial_count, 0) >= 1
  ),
  ranked AS (
    SELECT id, owner_group, phase_bucket, region_bucket, hash,
           ROW_NUMBER() OVER (PARTITION BY owner_group, phase_bucket, region_bucket ORDER BY hash, id) AS rank
      FROM pool
     WHERE owner_group IS NOT NULL AND phase_bucket IS NOT NULL
  )
  SELECT id, owner_group, phase_bucket, region_bucket, hash, rank
    FROM ranked
   WHERE rank <= GREATEST(COALESCE(p_per_stratum, 80), 1)
   ORDER BY owner_group, phase_bucket, region_bucket, rank;
$$;

COMMENT ON FUNCTION radar_qa_golden_candidates(TEXT, INT) IS
  'Top p_per_stratum assets per golden-set stratum ordered by md5(id || seed); quotas are applied in lib/radar/qa/golden-set.ts.';

-- ── Grants: service_role only ─────────────────────────────────────────
REVOKE ALL ON FUNCTION radar_qa_vocab_violations(TEXT, TEXT, TEXT[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION radar_qa_universe_stats(JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION radar_qa_thesis_stats() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION radar_qa_score_stats(INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION radar_qa_pipeline_stats() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION radar_qa_golden_candidates(TEXT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION radar_qa_vocab_violations(TEXT, TEXT, TEXT[]) TO service_role;
GRANT EXECUTE ON FUNCTION radar_qa_universe_stats(JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION radar_qa_thesis_stats() TO service_role;
GRANT EXECUTE ON FUNCTION radar_qa_score_stats(INT) TO service_role;
GRANT EXECUTE ON FUNCTION radar_qa_pipeline_stats() TO service_role;
GRANT EXECUTE ON FUNCTION radar_qa_golden_candidates(TEXT, INT) TO service_role;

COMMIT;
