-- 197: human audit queue, reviewer overrides, and the ownership causes behind the top-500 misses.
--
-- Measured Nov 23 2026 (default feed, "Best fit" order): 452 of the top 500 are originator-owned;
-- all 48 others are ownership 'unknown' (no licensee rows reach the top: the availability penalty
-- already pushes them down). The 48 split into:
--   ~20  programs the company disclosed itself (SEC filing, HKEX report, own pipeline page). The
--        ingester writes rule filing_disclosure / pipeline_page_disclosure, but radar_apply_ownership
--        re-checks every row after 30 days and has no rule for a row without trial arms, so it
--        rewrote them to no_arm_evidence / unknown. Feed-wide: ~1,250 rows.
--    5  the company sponsors the trial but the intervention's arm role is unrecorded (unknown arm)
--        and the name is the company's own development code (OCUL101, GS030-DP, IMC-M113V).
--    4  arm text that is not a program ("Watchful waiting", "Daridorexant matching placebo",
--        "Tablets matching VQ-101", "The placebo presentation is a pre-filled syringe ...").
--    4  subsidiaries / Chinese-name twins not yet in a family (Eli Lilly Japan K.K., 上海津曼特 under
--        CSPC, 上海君实 vs Shanghai Junshi, 杭州翰思 vs HanX): the family model backlog (mig 193,
--        $10 allowance) and audit corrections (company_relations 'manual') close these.
--   ~15  mixed (generic/background drugs under a biotech, combination arms, licensees with no
--        drug_master originator): left unknown, which is the honest answer.
-- FDA orphan-designation rows (the designation's sponsor) had the same gap: ~1,800 feed rows.
--
-- Top-1,000 duplicates (15): 6 are Chinese-name twins (family backlog), 6 are a licensor and a later
-- licensee both scored originator because neither has a trusted drug_master originator (LENZ / Corxel
-- aceclidine, Arrowhead / Visirna zodasiran, Anwita / Junshi AWT020, Junshi / Mabwell JS207). New rule
-- later_sponsor: when another family of the same script sponsored the same single-agent, unapproved
-- drug (confident drug record, or the same development code) >= 180 days earlier and still holds it
-- as originator, the later sponsor is 'unknown' (not
-- 'licensee': a twin can look the same) and availability marks it originator_elsewhere, so it ranks
-- below the originator instead of next to it.
--
-- Also here:
--   radar_ownership_overrides   a reviewer's correction (status / partnership) from /admin/radar-audit;
--                               radar_apply_ownership applies it as rule manual_override and the
--                               keep-rule trigger keeps it.
--   radar_qa_audit_queue()      the top of the default feed exactly as the scorecard measures it,
--                               with each row's last review.
--   Stale family re-check: rows left at originator_mismatch whose originator has since joined the
--   row's family are re-checked at once instead of after 30 days.
--
-- Rollout: apply 197, 197b, 197c in order; see the PR for the backfill steps. Idempotent.

-- ── Reviewer overrides ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.radar_ownership_overrides (
  asset_id            uuid PRIMARY KEY REFERENCES public.clinical_assets(id) ON DELETE CASCADE,
  ownership_status    text CHECK (ownership_status IS NULL OR ownership_status = ANY (ARRAY[
                        'originator', 'licensee', 'co_developer', 'comparator_or_background', 'marketed_other',
                        'unknown', 'duplicate_program', 'not_a_program'])),
  partnership_status  text CHECK (partnership_status IS NULL OR partnership_status = ANY (ARRAY[
                        'unpartnered', 'partially_partnered', 'partnered'])),
  owner_company_id    uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  duplicate_of        uuid REFERENCES public.clinical_assets(id) ON DELETE SET NULL,
  note                text,
  reviewer            text NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.radar_ownership_overrides IS
  'Human corrections from the /admin/radar-audit queue: ownership status and partnership status per program row; applied by radar_apply_ownership (rule manual_override) and radar_refresh_availability (migration 197).';
ALTER TABLE public.radar_ownership_overrides ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access radar_ownership_overrides" ON public.radar_ownership_overrides;
CREATE POLICY "Service role full access radar_ownership_overrides"
  ON public.radar_ownership_overrides FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_radar_qa_human_reviews_reviewed_at ON public.radar_qa_human_reviews (reviewed_at DESC);

-- A reviewer's status survives every later ownership pass.
CREATE OR REPLACE FUNCTION public.clinical_assets_keep_rule_ownership()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  kept constant text[] := ARRAY['generic_drug_fda', 'duplicate_program', 'background_or_placebo', 'not_a_program', 'manual_override'];
BEGIN
  IF OLD.ownership_evidence->>'rule' = ANY (kept)
     AND NEW.ownership_status IS DISTINCT FROM OLD.ownership_status
     AND NOT (coalesce(NEW.ownership_evidence->>'rule', '') = ANY (kept))
     AND coalesce(current_setting('radar.ownership_override', true), '') <> 'on' THEN
    NEW.ownership_status := OLD.ownership_status;
    NEW.ownership_evidence := OLD.ownership_evidence;
  END IF;
  RETURN NEW;
END $$;

-- ── Arm text that names a placebo or a non-treatment ─────────────────────

CREATE OR REPLACE FUNCTION public.radar_is_comparator_named(p_name text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT coalesce(p_name, '') ~* '^(comparators?\M|placebo\M|standard[- ]of[- ]care|soc\M|control\M|vehicle\M|sham\M|best supportive care|no intervention|usual care|background therapy|watchful waiting|active surveillance|observation\M)'
      OR coalesce(p_name, '') ~* '(matching placebo|placebo[- ]matching|placebo to match|matched placebo|^the placebo\M|placebo presentation|^(tablets?|capsules?|injections?|solution|vials?) matching\M)'
      OR public.radar_is_placeholder_named(p_name);
$function$;

-- ── Ownership ────────────────────────────────────────────────────────────

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
  DROP TABLE IF EXISTS tmp_dm_fam;

  CREATE TEMP TABLE tmp_ownership_cand ON COMMIT DROP AS
  SELECT a.id, a.company_id, a.asset_name, COALESCE(a.asset_aliases, '{}'::text[]) AS aliases,
         COALESCE(a.nct_ids, '{}'::text[]) AS nct_ids, a.phase, a.drug_master_id, a.asset_origin,
         public.radar_code_prefix(a.asset_name) AS code_prefix,
         public.radar_is_comparator_named(a.asset_name) AS comparator_named,
         public.radar_has_dev_code(a.asset_name) AS has_code,
         coalesce(hc.family_id, a.company_id) AS family_key,
         coalesce(hc.name, a.company_name, '') ~ '[一-鿿]' AS cjk
  FROM public.clinical_assets a
  LEFT JOIN public.companies hc ON hc.id = a.company_id
  WHERE a.ownership_checked_at IS NULL
     OR (a.last_enriched_at IS NOT NULL AND a.last_enriched_at > a.ownership_checked_at)
     OR (a.drug_resolved_at IS NOT NULL AND a.drug_resolved_at > a.ownership_checked_at)
     OR a.ownership_checked_at < now() - make_interval(days => GREATEST(COALESCE(p_recheck_days, 30), 1))
     -- A reviewer's correction applies on the next pass.
     OR EXISTS (SELECT 1 FROM public.radar_ownership_overrides ov
                WHERE ov.asset_id = a.id AND ov.updated_at > a.ownership_checked_at)
     -- The originator has joined this row's corporate family since the last check (migration 193).
     OR (a.ownership_evidence->>'rule' = 'originator_mismatch' AND EXISTS (
           SELECT 1 FROM public.drug_master d
           JOIN public.companies oc ON oc.id = d.originator_company_id
           WHERE d.id = a.drug_master_id
             AND coalesce(oc.family_id, oc.id) = coalesce(hc.family_id, a.company_id)))
  ORDER BY a.ownership_checked_at NULLS FIRST, a.id
  LIMIT GREATEST(COALESCE(p_limit, 5000), 1);
  GET DIAGNOSTICS v_scanned = ROW_COUNT;

  CREATE TEMP TABLE tmp_prefix_orig ON COMMIT DROP AS
  SELECT o.company_id, public.radar_code_prefix(o.asset_name) AS code_prefix, count(*) AS n
  FROM public.clinical_assets o
  WHERE o.company_id IN (SELECT DISTINCT company_id FROM tmp_ownership_cand WHERE code_prefix IS NOT NULL)
    AND o.ownership_status = 'originator'
    AND o.ownership_evidence->>'rule' IN ('originator_match', 'sponsor_default', 'code_prefix_match', 'filing_disclosure', 'pipeline_page_disclosure')
    AND public.radar_code_prefix(o.asset_name) IS NOT NULL
  GROUP BY 1, 2;

  -- Per drug and corporate family: first trial date, whether the family holds it as originator,
  -- and the script of the family's name (a Chinese-name twin is not a later sponsor).
  CREATE TEMP TABLE tmp_dm_fam ON COMMIT DROP AS
  SELECT o.drug_master_id, coalesce(oc.family_id, o.company_id) AS family_key,
         min(o.first_posted_date) AS first_posted,
         bool_or(o.ownership_status = 'originator') AS holds_originator,
         bool_or(coalesce(oc.name, o.company_name, '') ~ '[一-鿿]') AS cjk
  FROM public.clinical_assets o
  JOIN public.companies oc ON oc.id = o.company_id AND oc.owner_type = 'industry'
  WHERE o.drug_master_id IN (SELECT DISTINCT drug_master_id FROM tmp_ownership_cand WHERE drug_master_id IS NOT NULL)
  GROUP BY 1, 2;
  CREATE INDEX ON tmp_dm_fam (drug_master_id);

  CREATE TEMP TABLE tmp_ownership_calc ON COMMIT DROP AS
  WITH cand AS (
    SELECT c.*, ARRAY(SELECT public.radar_name_key(x) FROM unnest(ARRAY[c.asset_name] || c.aliases) x WHERE x IS NOT NULL AND btrim(x) <> '') AS name_keys
    FROM tmp_ownership_cand c
  ),
  dm AS (
    SELECT c.id AS asset_id, d.id AS drug_master_id, d.originator_company_id, d.confidence AS originator_confidence, d.max_phase,
           d.is_combination,
           coalesce(oc.family_id, d.originator_company_id) AS originator_family
    FROM cand c
    JOIN public.drug_master d ON d.id = c.drug_master_id
    LEFT JOIN public.companies oc ON oc.id = d.originator_company_id
  ),
  shared AS (
    SELECT c.id AS asset_id
    FROM cand c
    WHERE c.drug_master_id IS NOT NULL AND c.company_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM tmp_dm_fam f WHERE f.drug_master_id = c.drug_master_id AND f.family_key <> c.family_key)
  ),
  -- Another same-script family sponsored this single-agent, unapproved drug >= 180 days earlier and holds it as originator.
  later AS (
    SELECT c.id AS asset_id, (array_agg(o.family_key ORDER BY o.first_posted))[1] AS earlier_family
    FROM cand c
    JOIN public.drug_master d ON d.id = c.drug_master_id
    JOIN tmp_dm_fam mine ON mine.drug_master_id = c.drug_master_id AND mine.family_key = c.family_key
    JOIN tmp_dm_fam o ON o.drug_master_id = c.drug_master_id AND o.family_key <> c.family_key
    -- A confident drug record, or the same development code (AWT020 at Anwita, then at Junshi).
    WHERE (coalesce(d.confidence, 0) >= 65 OR c.has_code)
      AND coalesce(d.max_phase, '') <> 'approved'
      AND NOT coalesce(d.is_combination, false)
      AND o.holds_originator
      AND o.cjk = c.cjk
      AND o.first_posted IS NOT NULL AND mine.first_posted IS NOT NULL
      AND o.first_posted <= mine.first_posted - 180
    GROUP BY c.id
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
               AND self.ownership_evidence->>'rule' IN ('originator_match', 'sponsor_default', 'code_prefix_match', 'filing_disclosure', 'pipeline_page_disclosure')
           ) THEN 1 ELSE 0 END AS n
    FROM cand c
    JOIN tmp_prefix_orig p ON p.company_id = c.company_id AND p.code_prefix = c.code_prefix
  ),
  calc AS (
    SELECT
      c.id,
      c.comparator_named,
      c.has_code,
      c.asset_origin,
      dm.drug_master_id,
      dm.originator_company_id,
      dm.originator_confidence,
      dm.max_phase,
      (dm.originator_family = c.family_key AND dm.originator_company_id IS DISTINCT FROM c.company_id) AS family_originator,
      (dm.originator_family = c.family_key) AS same_family,
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
      (sh.asset_id IS NOT NULL) AS shared,
      (lt.asset_id IS NOT NULL) AS later_sponsor,
      lt.earlier_family,
      ov.ownership_status AS override_status,
      ov.owner_company_id AS override_owner,
      ov.duplicate_of AS override_duplicate_of
    FROM cand c
    LEFT JOIN dm ON dm.asset_id = c.id
    LEFT JOIN owner_role r ON r.asset_id = c.id
    LEFT JOIN arms a ON a.asset_id = c.id
    LEFT JOIN prefix px ON px.asset_id = c.id
    LEFT JOIN shared sh ON sh.asset_id = c.id
    LEFT JOIN later lt ON lt.asset_id = c.id
    LEFT JOIN public.radar_ownership_overrides ov ON ov.asset_id = c.id
  ),
  decided AS (
    SELECT
      calc.*,
      CASE
        WHEN override_status IS NOT NULL THEN 'manual_override'
        WHEN comparator_named THEN 'comparator_named'
        WHEN trusted_originator AND coalesce(same_family, false) THEN 'originator_match'
        WHEN owner_role IS NOT NULL THEN 'drug_owner_role'
        WHEN trusted_originator AND marketed THEN 'marketed_other'
        WHEN trusted_originator AND experimental = 0 THEN 'comparator'
        WHEN trusted_originator AND code_prefix_originators >= 2 THEN 'code_prefix_match'
        WHEN trusted_originator THEN 'originator_mismatch'
        WHEN approved_single AND shared AND NOT has_code THEN 'marketed_shared'
        WHEN matched > 0 AND experimental = 0 AND comparator > 0 THEN 'arm_comparator'
        WHEN later_sponsor AND code_prefix_originators < 2 THEN 'later_sponsor'
        WHEN experimental > 0 THEN 'sponsor_default'
        WHEN code_prefix_originators >= 2 THEN 'code_prefix_match'
        -- The company's own SEC / exchange filing or pipeline page lists the program as its own
        -- (lib/ingestion/preclinical-pipeline.ts skips partners' and competitors' drugs).
        WHEN asset_origin = 'filing' AND NOT shared THEN 'filing_disclosure'
        WHEN asset_origin = 'pipeline_page' AND NOT shared THEN 'pipeline_page_disclosure'
        -- The sponsor of an FDA orphan designation, no other company holds the drug.
        WHEN asset_origin = 'designation' AND NOT shared THEN 'designation_sponsor'
        -- The company sponsors the trial, the arm role is unrecorded, and the name is a development code nobody else holds.
        WHEN unknown_arms > 0 AND experimental = 0 AND comparator = 0 AND has_code AND NOT shared THEN 'sponsor_unknown_arm'
        ELSE 'no_arm_evidence'
      END AS rule
    FROM calc
  )
  SELECT
    d.id,
    CASE d.rule
      WHEN 'manual_override' THEN d.override_status
      WHEN 'comparator_named' THEN 'comparator_or_background'
      WHEN 'originator_match' THEN 'originator'
      WHEN 'drug_owner_role' THEN d.owner_role
      WHEN 'marketed_other' THEN 'marketed_other'
      WHEN 'marketed_shared' THEN 'marketed_other'
      WHEN 'comparator' THEN 'comparator_or_background'
      WHEN 'code_prefix_match' THEN 'originator'
      WHEN 'originator_mismatch' THEN 'unknown'
      WHEN 'arm_comparator' THEN 'comparator_or_background'
      WHEN 'later_sponsor' THEN 'unknown'
      WHEN 'sponsor_default' THEN 'originator'
      WHEN 'filing_disclosure' THEN 'originator'
      WHEN 'pipeline_page_disclosure' THEN 'originator'
      WHEN 'designation_sponsor' THEN 'originator'
      WHEN 'sponsor_unknown_arm' THEN 'originator'
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
      'shared_with_other_companies', CASE WHEN d.rule = 'marketed_shared' THEN true END,
      'originator_in_family', CASE WHEN d.rule = 'originator_match' AND d.family_originator THEN true END,
      'earlier_sponsor_family', CASE WHEN d.rule = 'later_sponsor' THEN d.earlier_family END,
      'owner_company_id', CASE WHEN d.rule = 'manual_override' THEN d.override_owner END,
      'duplicate_of', CASE WHEN d.rule = 'manual_override' THEN d.override_duplicate_of END
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

-- ── Availability: later sponsors and reviewer partnership corrections ────

CREATE OR REPLACE FUNCTION public.radar_refresh_availability()
 RETURNS jsonb
 LANGUAGE plpgsql
 SET statement_timeout TO '120s'
AS $function$
DECLARE
  v_changed integer := 0;
BEGIN
  DROP TABLE IF EXISTS tmp_avail;
  CREATE TEMP TABLE tmp_avail ON COMMIT DROP AS
  WITH base AS (
    SELECT a.id, a.company_id, a.drug_master_id, a.score_logit,
           coalesce(ov.partnership_status, a.partnership_status) AS partnership_status,
           CASE WHEN ov.partnership_status IS NOT NULL THEN 'reviewer' ELSE a.partnership_basis END AS partnership_basis,
           a.ownership_status, a.ownership_evidence->>'rule' AS ownership_rule,
           CASE WHEN fr.company_type = 'large_pharma' THEN 'large_pharma' ELSE c.company_type END AS company_type,
           dm.max_phase, dm.originator_company_id,
           coalesce(c.family_id, a.company_id) AS family_key,
           coalesce(oc.family_id, dm.originator_company_id) AS originator_family
    FROM public.clinical_assets a
    LEFT JOIN public.companies c ON c.id = a.company_id
    LEFT JOIN public.companies fr ON fr.id = c.family_id
    LEFT JOIN public.drug_master dm ON dm.id = a.drug_master_id
    LEFT JOIN public.companies oc ON oc.id = dm.originator_company_id
    LEFT JOIN public.radar_ownership_overrides ov ON ov.asset_id = a.id
    WHERE a.program_primary
  ),
  originator_rows AS (
    SELECT DISTINCT coalesce(oc.family_id, o.company_id) AS company_id, o.drug_master_id
    FROM public.clinical_assets o
    LEFT JOIN public.companies oc ON oc.id = o.company_id
    WHERE o.program_primary AND o.drug_master_id IS NOT NULL
  ),
  r AS (
    SELECT b.id, b.score_logit,
           array_remove(ARRAY[
             CASE WHEN b.partnership_status = 'partnered' THEN 'partnered' END,
             CASE WHEN (b.ownership_status IN ('unknown', 'licensee')
                        AND b.originator_company_id IS NOT NULL
                        AND b.originator_family IS DISTINCT FROM b.family_key
                        AND o.company_id IS NOT NULL)
                       -- migration 197: another family sponsored the drug first and holds it
                       OR b.ownership_rule = 'later_sponsor' THEN 'originator_elsewhere' END,
             CASE WHEN b.company_type = 'large_pharma' THEN 'large_pharma' END,
             CASE WHEN b.max_phase = 'approved' THEN 'approved_molecule' END,
             CASE WHEN b.ownership_status = 'licensee' THEN 'licensee' END,
             CASE WHEN b.partnership_status = 'partially_partnered' AND b.partnership_basis IN ('deal_confirmed', 'reviewer') THEN 'partial_deal' END
           ], NULL) AS reasons
    FROM base b
    LEFT JOIN originator_rows o ON o.company_id = b.originator_family AND o.drug_master_id = b.drug_master_id
  )
  SELECT id, reasons,
         score_logit - (
           3.0 * ('partnered' = ANY (reasons))::int
         + 3.0 * ('originator_elsewhere' = ANY (reasons))::int
         + 2.0 * ('large_pharma' = ANY (reasons))::int
         + 1.5 * ('approved_molecule' = ANY (reasons))::int
         + 1.0 * ('licensee' = ANY (reasons))::int
         + 0.7 * ('partial_deal' = ANY (reasons))::int
         ) AS rank
  FROM r;

  UPDATE public.clinical_assets a
     SET score_rank = t.rank,
         availability_reasons = t.reasons
    FROM tmp_avail t
   WHERE a.id = t.id
     AND (a.score_rank IS DISTINCT FROM t.rank OR a.availability_reasons IS DISTINCT FROM t.reasons);
  GET DIAGNOSTICS v_changed = ROW_COUNT;

  UPDATE public.clinical_assets a
     SET score_rank = NULL, availability_reasons = NULL
   WHERE NOT a.program_primary AND (a.score_rank IS NOT NULL OR a.availability_reasons IS NOT NULL);

  RETURN jsonb_build_object('changed', v_changed);
END;
$function$;

-- ── Audit queue: the scorecard's top of the default feed ─────────────────

CREATE OR REPLACE FUNCTION public.radar_qa_audit_queue(p_limit integer DEFAULT 500, p_days integer DEFAULT 60)
 RETURNS TABLE (asset_id uuid, rank integer, reviewed_fields text[], last_reviewed_at timestamptz)
 LANGUAGE sql
 STABLE
 SET statement_timeout TO '60s'
AS $function$
  WITH feed AS (
    -- Same population and order as radar_qa_scorecard_stats() top500 / top1k.
    SELECT a.id, row_number() OVER (ORDER BY a.score_rank DESC NULLS LAST, a.id DESC)::integer AS rank
    FROM public.clinical_assets a
    WHERE a.program_primary AND a.owner_type = 'industry'
      AND a.phase NOT IN ('phase_4', 'not_applicable', 'unknown')
      AND a.ownership_status NOT IN ('comparator_or_background', 'marketed_other', 'duplicate_program', 'not_a_program')
    ORDER BY a.score_rank DESC NULLS LAST, a.id DESC
    LIMIT GREATEST(1, LEAST(coalesce(p_limit, 500), 2000))
  )
  SELECT f.id, f.rank,
         coalesce(array_agg(DISTINCT r.field) FILTER (WHERE r.field IS NOT NULL), '{}'::text[]),
         max(r.reviewed_at)
  FROM feed f
  LEFT JOIN public.radar_qa_human_reviews r
    ON r.asset_id = f.id AND r.field IN ('owner', 'availability', 'duplicate')
   AND r.reviewed_at >= now() - make_interval(days => GREATEST(coalesce(p_days, 60), 1))
  GROUP BY f.id, f.rank
  ORDER BY f.rank;
$function$;

COMMENT ON FUNCTION public.radar_qa_audit_queue(integer, integer) IS
  'Top of the default Search & Evaluation feed in Best-fit order (the scorecard population) with each row''s reviews in the last p_days; /admin/radar-audit, migration 197.';
REVOKE ALL ON FUNCTION public.radar_qa_audit_queue(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.radar_qa_audit_queue(integer, integer) TO service_role;
