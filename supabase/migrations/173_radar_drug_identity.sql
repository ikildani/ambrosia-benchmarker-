-- 173: Search & Evaluation drug identity gate.
--
-- Problem (radar QA 2026-10-26): 4,884 drug_master nodes were held by two or more
-- industry companies, e.g. doxorubicin under 248 companies with "Acalabrutinib",
-- "Rifampin" and "Methotrexate" rows linked to it. The local resolver grouped
-- unmatched names by any shared key (asset aliases included), recorded every name of
-- the group as an alias, and the external pass merged whole groups into whichever
-- registry drug one name hit. Registry originators were also set from the first
-- unpartnered asset (pembrolizumab's originator was AstraZeneca), so the ownership
-- rules called Merck's own rows "another company's marketed drug".
--
-- This migration:
--   1. radar_drug_identity_plan / radar_drug_identity_log: staged, reversible repair.
--      scripts/radar-drug-identity-fix.ts --stage writes the plan (TS rules in
--      lib/radar/drug-identity.ts); radar_drug_identity_apply() applies it in batches
--      and logs every previous value first. Revert: radar_drug_identity_revert(run).
--   2. radar_apply_drug_resolutions: originator_company_id is only stamped on
--      sponsor-internal nodes (a registry node's originator comes from evidence,
--      e.g. the sponsor code series, never from "first asset seen").
--   3. radar_apply_ownership: new rule marketed_shared — an approved drug with no
--      trusted originator, held by other industry companies too, on a row whose name
--      carries no development code, is somebody else's marketed drug (comparator,
--      backbone, DDI probe, generic), not the sponsor's program.
--   4. radar_drug_duplicate_groups(): classifies every cross-company node
--      (comparator_or_background, legit:same_corporate_family,
--      legit:partnership_or_license, legit:biosimilar_or_generic, unexplained);
--      radar_drug_duplicates() now returns only the unexplained owned groups, which
--      is what the QA check means by a duplicate. radar_qa_pipeline_stats() carries
--      the class counts.
--
-- Applied to production 2026-10-28 ahead of the PR (fix/radar-drug-identity).

-- ── 1. Plan + log ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.radar_drug_identity_plan (
  id                        bigserial PRIMARY KEY,
  run_id                    text NOT NULL,
  kind                      text NOT NULL CHECK (kind IN ('drug_new', 'alias_add', 'asset', 'alias_drop', 'originator')),
  asset_id                  uuid,
  alias_id                  uuid,
  drug_id                   uuid,
  action                    text,
  old_drug_master_id        uuid,
  new_drug_master_id        uuid,
  new_status                text,
  new_confidence            integer,
  match_key                 text,
  match_via                 text,
  new_originator_company_id uuid,
  payload                   jsonb,
  created_at                timestamptz NOT NULL DEFAULT now(),
  applied_at                timestamptz,
  apply_note                text
);
CREATE INDEX IF NOT EXISTS idx_radar_drug_identity_plan_pending
  ON public.radar_drug_identity_plan (run_id, kind, id) WHERE applied_at IS NULL;

CREATE TABLE IF NOT EXISTS public.radar_drug_identity_log (
  id         bigserial PRIMARY KEY,
  run_id     text NOT NULL,
  kind       text NOT NULL,
  ref_id     uuid,
  old_values jsonb,
  new_values jsonb,
  logged_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_radar_drug_identity_log_run ON public.radar_drug_identity_log (run_id, kind);

ALTER TABLE public.radar_drug_identity_plan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.radar_drug_identity_log ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.radar_drug_identity_plan IS
  'Migration 173: staged drug identity repair (scripts/radar-drug-identity-fix.ts --stage). Applied by radar_drug_identity_apply().';
COMMENT ON TABLE public.radar_drug_identity_log IS
  'Migration 173: previous values of every row radar_drug_identity_apply() changed (assets, aliases, owners, originators, new nodes). Revert with radar_drug_identity_revert(run_id).';

-- One batch of one kind, in dependency order: new nodes → their aliases → assets →
-- alias drops → originators. Returns what it did; {"done": true} when the run is applied.
CREATE OR REPLACE FUNCTION public.radar_drug_identity_apply(p_run text, p_limit integer DEFAULT 3000)
RETURNS jsonb
LANGUAGE plpgsql
SET statement_timeout TO '120s'
AS $$
DECLARE
  v_kind text;
  v_n integer := 0;
  v_skipped integer := 0;
BEGIN
  SELECT kind INTO v_kind
    FROM public.radar_drug_identity_plan
   WHERE run_id = p_run AND applied_at IS NULL
   ORDER BY CASE kind WHEN 'drug_new' THEN 1 WHEN 'alias_add' THEN 2 WHEN 'asset' THEN 3 WHEN 'alias_drop' THEN 4 ELSE 5 END
   LIMIT 1;
  IF v_kind IS NULL THEN
    RETURN jsonb_build_object('done', true);
  END IF;

  DROP TABLE IF EXISTS tmp_dib;
  CREATE TEMP TABLE tmp_dib ON COMMIT DROP AS
  SELECT * FROM public.radar_drug_identity_plan
   WHERE run_id = p_run AND kind = v_kind AND applied_at IS NULL
   ORDER BY id
   LIMIT GREATEST(COALESCE(p_limit, 3000), 1);

  IF v_kind = 'drug_new' THEN
    INSERT INTO public.drug_master (id, preferred_name, inn, source, confidence, is_combination, component_drug_ids, ncit_code, unii, chembl_id, modality, external_checked_at)
    SELECT b.drug_id, b.payload->>'preferred_name', b.payload->>'inn', b.payload->>'source',
           COALESCE((b.payload->>'confidence')::int, 75), COALESCE((b.payload->>'is_combination')::boolean, false),
           COALESCE(ARRAY(SELECT jsonb_array_elements_text(b.payload->'component_drug_ids'))::uuid[], '{}'::uuid[]),
           b.payload->>'ncit_code',
           CASE WHEN (b.payload->>'unii') ~ '^[A-Z0-9]{10}$' THEN b.payload->>'unii' END,
           CASE WHEN (b.payload->>'chembl_id') ~ '^CHEMBL[0-9]+$' THEN b.payload->>'chembl_id' END,
           b.payload->>'modality', now()
      FROM tmp_dib b
    ON CONFLICT (id) DO NOTHING;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    INSERT INTO public.drug_aliases (drug_id, alias, alias_normalized, alias_type, source)
    SELECT b.drug_id, b.payload->>'alias', public.radar_name_key(b.payload->>'alias'), 'other', 'internal'
      FROM tmp_dib b WHERE b.payload ? 'alias' AND public.radar_name_key(b.payload->>'alias') <> ''
    ON CONFLICT (alias_normalized, drug_id) DO NOTHING;
    INSERT INTO public.radar_drug_identity_log (run_id, kind, ref_id, old_values, new_values)
    SELECT p_run, 'drug_new', b.drug_id, NULL, b.payload FROM tmp_dib b;

  ELSIF v_kind = 'alias_add' THEN
    WITH ins AS (
      INSERT INTO public.drug_aliases (drug_id, alias, alias_normalized, alias_type, source)
      SELECT b.drug_id, b.payload->>'alias', b.payload->>'alias_normalized', COALESCE(b.payload->>'alias_type', 'synonym'), COALESCE(b.payload->>'source', 'ncit')
        FROM tmp_dib b
       WHERE EXISTS (SELECT 1 FROM public.drug_master d WHERE d.id = b.drug_id)
      ON CONFLICT (alias_normalized, drug_id) DO NOTHING
      RETURNING id, drug_id, alias, alias_normalized
    )
    INSERT INTO public.radar_drug_identity_log (run_id, kind, ref_id, old_values, new_values)
    SELECT p_run, 'alias_add', ins.id, NULL, to_jsonb(ins) FROM ins;
    GET DIAGNOSTICS v_n = ROW_COUNT;

  ELSIF v_kind = 'asset' THEN
    -- Skip rows the cron changed after the plan was staged.
    UPDATE public.radar_drug_identity_plan p SET applied_at = now(), apply_note = 'skipped: link changed since staging'
      FROM tmp_dib b JOIN public.clinical_assets ca ON ca.id = b.asset_id
     WHERE p.id = b.id AND ca.drug_master_id IS DISTINCT FROM b.old_drug_master_id;
    GET DIAGNOSTICS v_skipped = ROW_COUNT;
    DELETE FROM tmp_dib b WHERE EXISTS (SELECT 1 FROM public.radar_drug_identity_plan p WHERE p.id = b.id AND p.applied_at IS NOT NULL);

    INSERT INTO public.radar_drug_identity_log (run_id, kind, ref_id, old_values, new_values)
    SELECT p_run, 'asset', ca.id,
           jsonb_build_object('drug_master_id', ca.drug_master_id, 'drug_resolution_status', ca.drug_resolution_status,
                              'drug_resolution_confidence', ca.drug_resolution_confidence, 'drug_resolved_at', ca.drug_resolved_at,
                              'ownership_status', ca.ownership_status, 'ownership_checked_at', ca.ownership_checked_at),
           jsonb_build_object('drug_master_id', b.new_drug_master_id, 'drug_resolution_status', b.new_status,
                              'drug_resolution_confidence', b.new_confidence, 'action', b.action, 'match_key', b.match_key, 'match_via', b.match_via)
      FROM tmp_dib b JOIN public.clinical_assets ca ON ca.id = b.asset_id;

    -- drug_owners rows that only existed because of the old link.
    WITH del AS (
      DELETE FROM public.drug_owners o
       USING tmp_dib b
       WHERE o.evidence_type = 'clinical_asset' AND o.evidence_id = b.asset_id
         AND o.drug_id = b.old_drug_master_id AND b.old_drug_master_id IS DISTINCT FROM b.new_drug_master_id
      RETURNING o.*
    )
    INSERT INTO public.radar_drug_identity_log (run_id, kind, ref_id, old_values, new_values)
    SELECT p_run, 'drug_owner_drop', del.drug_id, to_jsonb(del), NULL FROM del;

    UPDATE public.clinical_assets ca
       SET drug_master_id = b.new_drug_master_id,
           drug_resolution_status = b.new_status,
           drug_resolution_confidence = LEAST(GREATEST(COALESCE(b.new_confidence, 0), 0), 100),
           drug_resolved_at = now(),
           ownership_checked_at = NULL
      FROM tmp_dib b
     WHERE ca.id = b.asset_id
       AND (b.new_drug_master_id IS NULL OR EXISTS (SELECT 1 FROM public.drug_master d WHERE d.id = b.new_drug_master_id));
    GET DIAGNOSTICS v_n = ROW_COUNT;

  ELSIF v_kind = 'alias_drop' THEN
    WITH del AS (
      DELETE FROM public.drug_aliases a USING tmp_dib b WHERE a.id = b.alias_id RETURNING a.*
    )
    INSERT INTO public.radar_drug_identity_log (run_id, kind, ref_id, old_values, new_values)
    SELECT p_run, 'alias_drop', del.id, to_jsonb(del), NULL FROM del;
    GET DIAGNOSTICS v_n = ROW_COUNT;

  ELSE  /* originator */
    INSERT INTO public.radar_drug_identity_log (run_id, kind, ref_id, old_values, new_values)
    SELECT p_run, 'originator', d.id, jsonb_build_object('originator_company_id', d.originator_company_id),
           jsonb_build_object('originator_company_id', b.new_originator_company_id, 'code_prefix', b.match_key)
      FROM tmp_dib b JOIN public.drug_master d ON d.id = b.drug_id;
    UPDATE public.drug_master d
       SET originator_company_id = b.new_originator_company_id, updated_at = now()
      FROM tmp_dib b
     WHERE d.id = b.drug_id
       AND (b.new_originator_company_id IS NULL OR EXISTS (SELECT 1 FROM public.companies c WHERE c.id = b.new_originator_company_id));
    GET DIAGNOSTICS v_n = ROW_COUNT;
  END IF;

  UPDATE public.radar_drug_identity_plan p SET applied_at = now()
   WHERE p.id IN (SELECT id FROM tmp_dib) AND p.applied_at IS NULL;

  RETURN jsonb_build_object('kind', v_kind, 'applied', v_n, 'skipped', v_skipped,
    'remaining', (SELECT count(*) FROM public.radar_drug_identity_plan WHERE run_id = p_run AND applied_at IS NULL));
END;
$$;

COMMENT ON FUNCTION public.radar_drug_identity_apply(text, integer) IS
  'Migration 173: apply one batch of a staged drug identity run (new nodes, aliases, asset links, alias drops, originators), logging previous values to radar_drug_identity_log.';

-- Undo a run from its log, newest first (one batch per call).
CREATE OR REPLACE FUNCTION public.radar_drug_identity_revert(p_run text, p_limit integer DEFAULT 5000)
RETURNS jsonb
LANGUAGE plpgsql
SET statement_timeout TO '120s'
AS $$
DECLARE v_n integer;
BEGIN
  DROP TABLE IF EXISTS tmp_dir;
  CREATE TEMP TABLE tmp_dir ON COMMIT DROP AS
  SELECT * FROM public.radar_drug_identity_log WHERE run_id = p_run AND kind NOT LIKE 'reverted:%'
   ORDER BY id DESC LIMIT GREATEST(COALESCE(p_limit, 5000), 1);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 0 THEN RETURN jsonb_build_object('done', true); END IF;

  UPDATE public.drug_master d SET originator_company_id = (l.old_values->>'originator_company_id')::uuid
    FROM tmp_dir l WHERE l.kind = 'originator' AND d.id = l.ref_id;
  INSERT INTO public.drug_aliases SELECT (jsonb_populate_record(NULL::public.drug_aliases, l.old_values)).*
    FROM tmp_dir l WHERE l.kind = 'alias_drop' ON CONFLICT DO NOTHING;
  INSERT INTO public.drug_owners SELECT (jsonb_populate_record(NULL::public.drug_owners, l.old_values)).*
    FROM tmp_dir l WHERE l.kind = 'drug_owner_drop' ON CONFLICT DO NOTHING;
  UPDATE public.clinical_assets ca
     SET drug_master_id = (l.old_values->>'drug_master_id')::uuid,
         drug_resolution_status = l.old_values->>'drug_resolution_status',
         drug_resolution_confidence = (l.old_values->>'drug_resolution_confidence')::int,
         drug_resolved_at = (l.old_values->>'drug_resolved_at')::timestamptz,
         ownership_checked_at = NULL
    FROM tmp_dir l WHERE l.kind = 'asset' AND ca.id = l.ref_id;
  DELETE FROM public.drug_aliases a USING tmp_dir l WHERE l.kind = 'alias_add' AND a.id = l.ref_id;
  DELETE FROM public.drug_master d USING tmp_dir l
   WHERE l.kind = 'drug_new' AND d.id = l.ref_id
     AND NOT EXISTS (SELECT 1 FROM public.clinical_assets ca WHERE ca.drug_master_id = d.id);
  UPDATE public.radar_drug_identity_log x SET kind = 'reverted:' || x.kind WHERE x.id IN (SELECT id FROM tmp_dir);
  RETURN jsonb_build_object('reverted', v_n);
END;
$$;

-- ── 2. Originators only on sponsor-internal nodes ───────────────────────────

CREATE OR REPLACE FUNCTION public.radar_apply_drug_resolutions(p_rows jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET statement_timeout TO '90s'
AS $function$
DECLARE v_assets integer := 0; v_owners integer := 0; v_originators integer := 0;
BEGIN
  DROP TABLE IF EXISTS tmp_drug_resolutions;
  CREATE TEMP TABLE tmp_drug_resolutions ON COMMIT DROP AS
  SELECT DISTINCT ON (r.id) r.id, r.drug_master_id, r.status, r.confidence, r.modality, r.company_id, r.owner_role
  FROM jsonb_to_recordset(p_rows) AS r(id uuid, drug_master_id uuid, status text, confidence integer, modality text, company_id uuid, owner_role text)
  WHERE r.id IS NOT NULL AND r.status IN ('resolved','ambiguous','unresolvable');
  UPDATE public.clinical_assets ca SET drug_master_id = t.drug_master_id, drug_resolution_status = t.status, drug_resolution_confidence = t.confidence, drug_resolved_at = now(), modality = COALESCE(ca.modality, t.modality)
  FROM tmp_drug_resolutions t WHERE ca.id = t.id;
  GET DIAGNOSTICS v_assets = ROW_COUNT;
  INSERT INTO public.drug_owners (drug_id, company_id, role, territory, evidence_type, evidence_id, updated_at)
  SELECT DISTINCT ON (t.drug_master_id, t.company_id, t.owner_role) t.drug_master_id, t.company_id, t.owner_role, 'global', 'clinical_asset', t.id, now()
  FROM tmp_drug_resolutions t
  WHERE t.drug_master_id IS NOT NULL AND t.company_id IS NOT NULL AND t.owner_role IN ('originator','licensee','co_developer','unknown') AND EXISTS (SELECT 1 FROM public.companies c WHERE c.id = t.company_id)
  ON CONFLICT (drug_id, company_id, role, territory) DO UPDATE SET evidence_type = EXCLUDED.evidence_type, evidence_id = EXCLUDED.evidence_id, updated_at = now();
  GET DIAGNOSTICS v_owners = ROW_COUNT;
  -- Migration 173: only a sponsor-internal node (a code nobody else registered) takes its
  -- originator from the first unpartnered asset. A registry drug's originator needs evidence.
  UPDATE public.drug_master dm SET originator_company_id = t.company_id
  FROM (SELECT DISTINCT ON (drug_master_id) drug_master_id, company_id FROM tmp_drug_resolutions WHERE owner_role = 'originator' AND drug_master_id IS NOT NULL AND company_id IS NOT NULL ORDER BY drug_master_id, id) t
  WHERE dm.id = t.drug_master_id AND dm.originator_company_id IS NULL AND dm.is_combination = false AND dm.source = 'internal'
    AND EXISTS (SELECT 1 FROM public.companies c WHERE c.id = t.company_id);
  GET DIAGNOSTICS v_originators = ROW_COUNT;
  RETURN jsonb_build_object('assets_updated', v_assets, 'owners_written', v_owners, 'originators_set', v_originators);
END; $function$;

-- ── 3. Ownership: marketed_shared ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.radar_has_dev_code(p_name text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE PARALLEL SAFE
AS $$
  SELECT coalesce(p_name, '') ~ '(^|[^A-Za-z0-9])[A-Z]{1,6}(-[A-Z])?[- ]?[0-9]{2,8}[A-Za-z]{0,2}([^A-Za-z0-9]|$)';
$$;

COMMENT ON FUNCTION public.radar_has_dev_code(text) IS
  'Migration 173: the name carries a sponsor development code (CT-P13, MK-3475, SHR-A1811). Mirrors hasDevelopmentCode() in lib/radar/ownership.ts.';

CREATE OR REPLACE FUNCTION public.radar_apply_ownership(p_limit integer DEFAULT 5000, p_recheck_days integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET statement_timeout TO '240s'
AS $function$
DECLARE
  v_scanned integer := 0;
  v_written integer := 0;
  v_by_status jsonb := '{}'::jsonb;
  v_by_rule jsonb := '{}'::jsonb;
  v_remaining bigint := 0;
BEGIN
  DROP TABLE IF EXISTS tmp_ownership_cand;
  DROP TABLE IF EXISTS tmp_ownership_calc;
  DROP TABLE IF EXISTS tmp_prefix_orig;

  CREATE TEMP TABLE tmp_ownership_cand ON COMMIT DROP AS
  SELECT a.id, a.company_id, a.asset_name, COALESCE(a.asset_aliases, '{}'::text[]) AS aliases,
         COALESCE(a.nct_ids, '{}'::text[]) AS nct_ids, a.phase, a.drug_master_id,
         public.radar_code_prefix(a.asset_name) AS code_prefix,
         public.radar_is_comparator_named(a.asset_name) AS comparator_named,
         public.radar_has_dev_code(a.asset_name) AS has_code
  FROM public.clinical_assets a
  WHERE a.ownership_checked_at IS NULL
     OR (a.last_enriched_at IS NOT NULL AND a.last_enriched_at > a.ownership_checked_at)
     OR (a.drug_resolved_at IS NOT NULL AND a.drug_resolved_at > a.ownership_checked_at)
     OR a.ownership_checked_at < now() - make_interval(days => GREATEST(COALESCE(p_recheck_days, 30), 1))
  ORDER BY a.ownership_checked_at NULLS FIRST, a.id
  LIMIT GREATEST(COALESCE(p_limit, 5000), 1);
  GET DIAGNOSTICS v_scanned = ROW_COUNT;

  CREATE TEMP TABLE tmp_prefix_orig ON COMMIT DROP AS
  SELECT o.company_id, public.radar_code_prefix(o.asset_name) AS code_prefix, count(*) AS n
  FROM public.clinical_assets o
  WHERE o.company_id IN (SELECT DISTINCT company_id FROM tmp_ownership_cand WHERE code_prefix IS NOT NULL)
    AND o.ownership_status = 'originator'
    AND o.ownership_evidence->>'rule' IN ('originator_match', 'sponsor_default', 'code_prefix_match', 'filing_disclosure')
    AND public.radar_code_prefix(o.asset_name) IS NOT NULL
  GROUP BY 1, 2;

  CREATE TEMP TABLE tmp_ownership_calc ON COMMIT DROP AS
  WITH cand AS (
    SELECT c.*, ARRAY(SELECT public.radar_name_key(x) FROM unnest(ARRAY[c.asset_name] || c.aliases) x WHERE x IS NOT NULL AND btrim(x) <> '') AS name_keys
    FROM tmp_ownership_cand c
  ),
  dm AS (
    SELECT c.id AS asset_id, d.id AS drug_master_id, d.originator_company_id, d.confidence AS originator_confidence, d.max_phase,
           d.is_combination
    FROM cand c
    JOIN public.drug_master d ON d.id = c.drug_master_id
  ),
  shared AS (
    -- another industry company holds the same node
    SELECT c.id AS asset_id
    FROM cand c
    WHERE c.drug_master_id IS NOT NULL AND c.company_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.clinical_assets o
        JOIN public.companies oc ON oc.id = o.company_id AND oc.owner_type = 'industry'
        WHERE o.drug_master_id = c.drug_master_id AND o.company_id <> c.company_id)
  ),
  owner_role AS (
    SELECT c.id AS asset_id,
           (array_agg(o.role ORDER BY CASE o.role WHEN 'licensee' THEN 0 WHEN 'co_developer' THEN 1 ELSE 2 END))[1] AS role
    FROM cand c
    JOIN public.drug_owners o ON o.drug_id = c.drug_master_id AND o.company_id = c.company_id
    WHERE o.role IN ('licensee', 'co_developer')
    GROUP BY c.id
  ),
  arms AS (
    SELECT c.id AS asset_id,
           count(*) AS matched,
           count(*) FILTER (WHERE ti.arm_role = 'experimental') AS experimental,
           count(*) FILTER (WHERE ti.arm_role IN ('active_comparator', 'placebo_comparator', 'sham', 'no_intervention', 'other')) AS comparator,
           count(*) FILTER (WHERE ti.arm_role = 'unknown') AS unknown_arms
    FROM cand c
    JOIN public.trial_interventions ti
      ON ti.nct_id = ANY(c.nct_ids)
     AND ti.company_id IS NOT DISTINCT FROM c.company_id
     AND (
       public.radar_name_key(ti.name) = ANY(c.name_keys)
       OR EXISTS (SELECT 1 FROM unnest(ti.other_names) o WHERE public.radar_name_key(o) = ANY(c.name_keys))
     )
    WHERE cardinality(c.nct_ids) > 0
    GROUP BY c.id
  ),
  prefix AS (
    SELECT c.id AS asset_id, p.code_prefix,
           p.n - CASE WHEN EXISTS (
             SELECT 1 FROM public.clinical_assets self
             WHERE self.id = c.id AND self.ownership_status = 'originator'
               AND self.ownership_evidence->>'rule' IN ('originator_match', 'sponsor_default', 'code_prefix_match', 'filing_disclosure')
           ) THEN 1 ELSE 0 END AS n
    FROM cand c
    JOIN tmp_prefix_orig p ON p.company_id = c.company_id AND p.code_prefix = c.code_prefix
  ),
  calc AS (
    SELECT
      c.id,
      c.comparator_named,
      c.has_code,
      dm.drug_master_id,
      dm.originator_company_id,
      dm.originator_confidence,
      dm.max_phase,
      r.role AS owner_role,
      COALESCE(a.matched, 0) AS matched,
      COALESCE(a.experimental, 0) AS experimental,
      COALESCE(a.comparator, 0) AS comparator,
      COALESCE(a.unknown_arms, 0) AS unknown_arms,
      px.code_prefix,
      COALESCE(px.n, 0) AS code_prefix_originators,
      (dm.originator_company_id IS NOT NULL AND COALESCE(dm.originator_confidence, 0) >= 70) AS trusted_originator,
      (c.phase = 'phase_4' OR dm.max_phase = 'approved') AS marketed,
      (dm.max_phase = 'approved' AND NOT COALESCE(dm.is_combination, false)) AS approved_single,
      (sh.asset_id IS NOT NULL) AS shared
    FROM cand c
    LEFT JOIN dm ON dm.asset_id = c.id
    LEFT JOIN owner_role r ON r.asset_id = c.id
    LEFT JOIN arms a ON a.asset_id = c.id
    LEFT JOIN prefix px ON px.asset_id = c.id
    LEFT JOIN shared sh ON sh.asset_id = c.id
  ),
  decided AS (
    SELECT
      calc.*,
      CASE
        WHEN comparator_named THEN 'comparator_named'
        WHEN trusted_originator AND originator_company_id = (SELECT company_id FROM tmp_ownership_cand t WHERE t.id = calc.id) THEN 'originator_match'
        WHEN owner_role IS NOT NULL THEN 'drug_owner_role'
        WHEN trusted_originator AND marketed THEN 'marketed_other'
        WHEN trusted_originator AND experimental = 0 THEN 'comparator'
        WHEN trusted_originator AND code_prefix_originators >= 2 THEN 'code_prefix_match'
        WHEN trusted_originator THEN 'originator_mismatch'
        WHEN approved_single AND shared AND NOT has_code THEN 'marketed_shared'
        WHEN matched > 0 AND experimental = 0 AND comparator > 0 THEN 'arm_comparator'
        WHEN experimental > 0 THEN 'sponsor_default'
        WHEN code_prefix_originators >= 2 THEN 'code_prefix_match'
        ELSE 'no_arm_evidence'
      END AS rule
    FROM calc
  )
  SELECT
    d.id,
    CASE d.rule
      WHEN 'comparator_named' THEN 'comparator_or_background'
      WHEN 'originator_match' THEN 'originator'
      WHEN 'drug_owner_role' THEN d.owner_role
      WHEN 'marketed_other' THEN 'marketed_other'
      WHEN 'marketed_shared' THEN 'marketed_other'
      WHEN 'comparator' THEN 'comparator_or_background'
      WHEN 'code_prefix_match' THEN 'originator'
      WHEN 'originator_mismatch' THEN 'unknown'
      WHEN 'arm_comparator' THEN 'comparator_or_background'
      WHEN 'sponsor_default' THEN 'originator'
      ELSE 'unknown'
    END AS status,
    jsonb_strip_nulls(jsonb_build_object(
      'rule', d.rule,
      'drug_master_id', d.drug_master_id,
      'originator_company_id', d.originator_company_id,
      'originator_confidence', d.originator_confidence,
      'max_phase', d.max_phase,
      'owner_role', d.owner_role,
      'arms', jsonb_build_object('experimental', d.experimental, 'comparator', d.comparator, 'unknown', d.unknown_arms),
      'matched_interventions', d.matched,
      'code_prefix', CASE WHEN d.rule = 'code_prefix_match' THEN d.code_prefix END,
      'code_prefix_originators', CASE WHEN d.rule = 'code_prefix_match' THEN d.code_prefix_originators END,
      'shared_with_other_companies', CASE WHEN d.rule = 'marketed_shared' THEN true END
    )) AS evidence
  FROM decided d;

  UPDATE public.clinical_assets ca
  SET ownership_status = x.status,
      ownership_evidence = x.evidence,
      ownership_checked_at = now()
  FROM tmp_ownership_calc x
  WHERE ca.id = x.id;
  GET DIAGNOSTICS v_written = ROW_COUNT;

  SELECT COALESCE(jsonb_object_agg(status, n), '{}'::jsonb) INTO v_by_status
  FROM (SELECT status, count(*) AS n FROM tmp_ownership_calc GROUP BY status) q;
  SELECT COALESCE(jsonb_object_agg(rule, n), '{}'::jsonb) INTO v_by_rule
  FROM (SELECT evidence->>'rule' AS rule, count(*) AS n FROM tmp_ownership_calc GROUP BY 1) q;
  SELECT count(*) INTO v_remaining FROM public.clinical_assets WHERE ownership_checked_at IS NULL;

  RETURN jsonb_build_object(
    'scanned', v_scanned,
    'written', v_written,
    'by_status', v_by_status,
    'by_rule', v_by_rule,
    'remaining_unchecked', v_remaining
  );
END;
$function$;

-- ── 4. Cross-company groups, classified ─────────────────────────────────────

CREATE OR REPLACE FUNCTION public.radar_company_root(p_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE PARALLEL SAFE
AS $$
  SELECT left(lower(split_part(btrim(regexp_replace(coalesce(p_name, ''), '[^A-Za-z0-9 ]', ' ', 'g')), ' ', 1)), 5);
$$;

CREATE OR REPLACE FUNCTION public.radar_drug_duplicate_groups()
RETURNS TABLE(
  drug_master_id uuid,
  preferred_name text,
  companies bigint,
  owner_companies bigint,
  assets bigint,
  group_class text,
  sample_assets text[]
)
LANGUAGE sql
STABLE
SET statement_timeout TO '60s'
AS $$
  WITH r AS (
    SELECT ca.drug_master_id, ca.company_id, ca.company_name, ca.asset_name, ca.partner_company_id,
           ca.ownership_status IN ('originator', 'licensee', 'co_developer', 'unknown') AS owned,
           ca.ownership_status IN ('licensee', 'co_developer') AS role_row,
           public.radar_company_root(c.name) AS root
    FROM public.clinical_assets ca
    JOIN public.companies c ON c.id = ca.company_id AND c.owner_type = 'industry'
    WHERE ca.drug_master_id IS NOT NULL
  ),
  multi AS (
    SELECT r.drug_master_id FROM r GROUP BY 1 HAVING count(DISTINCT r.company_id) >= 2
  ),
  g AS (
    SELECT r.drug_master_id,
           count(DISTINCT r.company_id) AS companies,
           count(DISTINCT r.company_id) FILTER (WHERE r.owned) AS owner_companies,
           count(*) AS assets,
           count(DISTINCT r.root) FILTER (WHERE r.owned) AS owner_roots,
           array_agg(DISTINCT r.company_id) FILTER (WHERE r.owned) AS owners,
           array_agg(DISTINCT r.partner_company_id) FILTER (WHERE r.owned AND r.partner_company_id IS NOT NULL) AS partners,
           bool_or(r.owned AND r.role_row) AS roles,
           bool_or(r.owned AND r.asset_name ~* '(biosimilar|generic)') AS biosim,
           (array_agg(r.company_name || ' / ' || r.asset_name ORDER BY r.owned DESC, r.company_name, r.asset_name))[1:6] AS sample_assets
    FROM r JOIN multi m ON m.drug_master_id = r.drug_master_id
    GROUP BY r.drug_master_id
  )
  SELECT g.drug_master_id, dm.preferred_name, g.companies, g.owner_companies, g.assets,
         CASE
           WHEN g.owner_companies < 2 THEN 'comparator_or_background'
           WHEN g.owner_roots = 1 THEN 'legit:same_corporate_family'
           WHEN g.roles OR COALESCE(g.owners && g.partners, false)
             OR EXISTS (SELECT 1 FROM public.drug_owners o
                         WHERE o.drug_id = g.drug_master_id AND o.role IN ('licensee', 'co_developer')
                           AND o.company_id = ANY(g.owners)) THEN 'legit:partnership_or_license'
           WHEN g.biosim THEN 'legit:biosimilar_or_generic'
           ELSE 'unexplained'
         END AS group_class,
         g.sample_assets
  FROM g JOIN public.drug_master dm ON dm.id = g.drug_master_id;
$$;

COMMENT ON FUNCTION public.radar_drug_duplicate_groups() IS
  'Migration 173: every drug node held by >= 2 industry companies, classified: comparator_or_background (fewer than two companies own a program on it), legit:same_corporate_family, legit:partnership_or_license (licensee / co-developer role or a partner on record), legit:biosimilar_or_generic, unexplained.';

-- The QA duplicate: an owned program claimed by two unrelated companies with nothing on record.
CREATE OR REPLACE FUNCTION public.radar_drug_duplicates(p_limit integer DEFAULT 50)
RETURNS TABLE(drug_master_id uuid, preferred_name text, companies bigint, assets bigint, sample_assets text[], total_groups bigint)
LANGUAGE sql
STABLE
SET statement_timeout TO '60s'
AS $$
  SELECT g.drug_master_id, g.preferred_name, g.owner_companies, g.assets, g.sample_assets, COUNT(*) OVER () AS total_groups
  FROM public.radar_drug_duplicate_groups() g
  WHERE g.group_class = 'unexplained'
  ORDER BY g.owner_companies DESC, g.assets DESC, g.preferred_name ASC
  LIMIT GREATEST(COALESCE(p_limit, 50), 1);
$$;

COMMENT ON FUNCTION public.radar_drug_duplicates(integer) IS
  'Migration 173: drug nodes claimed as an owned program (originator / licensee / co-developer / unknown) by >= 2 industry companies with no corporate-family, partnership, license or biosimilar explanation. companies = owning companies. Comparator and background holders and legitimate multi-owner groups are counted by radar_drug_duplicate_groups().';

CREATE OR REPLACE FUNCTION public.radar_qa_pipeline_stats()
RETURNS JSONB
LANGUAGE plpgsql STABLE
SET statement_timeout = '180s'
AS $$
DECLARE
  v_dupes      JSONB;
  v_dupe_total BIGINT := 0;
  v_classes    JSONB := '{}'::jsonb;
  v_orphans    BIGINT;
  v_press      JSONB;
  v_stages     JSONB;
  v_failures   JSONB;
BEGIN
  BEGIN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
             'drug_master_id', d.drug_master_id, 'preferred_name', d.preferred_name,
             'companies', d.companies, 'assets', d.assets, 'sample_assets', d.sample_assets)), '[]'::jsonb),
           COALESCE(MAX(d.total_groups), 0)
      INTO v_dupes, v_dupe_total
      FROM radar_drug_duplicates(10) d;
    SELECT COALESCE(jsonb_object_agg(group_class, n), '{}'::jsonb) INTO v_classes
      FROM (SELECT group_class, count(*) AS n FROM radar_drug_duplicate_groups() GROUP BY 1) q;
  EXCEPTION WHEN OTHERS THEN
    v_dupes := '[]'::jsonb;
    v_dupe_total := -1;
  END;

  SELECT COUNT(*) INTO v_orphans
    FROM company_trials t
   WHERE t.company_id IS NULL
      OR NOT EXISTS (SELECT 1 FROM companies c WHERE c.id = t.company_id);

  SELECT jsonb_build_object(
           'total_90d', COUNT(*),
           'empty', COUNT(*) FILTER (WHERE companies_mentioned IS NULL OR cardinality(companies_mentioned) = 0))
    INTO v_press
    FROM press_releases
   WHERE published_at >= now() - INTERVAL '90 days';

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
    'duplicates', jsonb_build_object('groups', v_dupe_total, 'sample', v_dupes, 'classes', v_classes),
    'trial_orphans', jsonb_build_object('count', v_orphans),
    'press_empty_mentions', v_press,
    'stages', v_stages,
    'cron_failures_7d', v_failures
  );
END;
$$;
