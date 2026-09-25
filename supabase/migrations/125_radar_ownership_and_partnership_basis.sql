-- 125_radar_ownership_and_partnership_basis.sql
--
-- Two credibility fixes for the Asset Radar feed, found in the Sep 25 2026
-- production audit:
--
--   1. Ownership. 79,027 of 150,113 clinical_assets rows carry a drug whose
--      originator (drug_master.originator_company_id) is a different company:
--      comparator arms, background therapy and other owners' marketed drugs
--      attributed to whichever sponsor ran the trial. The feed's top rows were
--      Pembrolizumab at Merck KGaA, Nusinersen at Scholar Rock. Every asset
--      now gets an ownership_status with the evidence that produced it, and
--      the feed hides comparator_or_background and marketed_other by default.
--
--   2. Partnership basis. Only 163 rows are 'partnered'; 'unpartnered' means
--      "no deal, collaborator or press evidence found", which the UI never
--      said. partnership_basis names the evidence class and
--      partnership_sources_checked records what was searched and how big the
--      corpus was, so the UI can say "No partner found · checked 1,512 deals".
--
-- Also here, because they touch the same rows and the same facet RPC:
--   - clinical_assets.owner_type mirrors companies.owner_type (kept by trigger),
--     closing the TODO in lib/radar/asset-universe.ts and dropping the join
--     from the feed and facets paths.
--   - radar_facet_counts v2: ownership facet, default exclusions, phase and
--     ownership buckets counted before the defaults so excluded groups stay
--     discoverable with their counts.
--   - pg_trgm indexes for the feed's ILIKE search (load-test blocker).
--   - Partial index for the classifier's core-universe queue tier.
--   - radar_phase_breakdown ordered by the slugs the table holds (P2 item).
--   - radar_thesis_eligible_assets excludes non-owned programs.
--
-- Apply after 124. Backfills touch every clinical_assets row once; run in a
-- quiet window (about a minute at 150k rows).

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ══════════════════════════════════════════════════════════════════════
-- 1. Columns
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE public.clinical_assets
  ADD COLUMN IF NOT EXISTS owner_type text,
  ADD COLUMN IF NOT EXISTS ownership_status text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS ownership_evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS ownership_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS partnership_basis text,
  ADD COLUMN IF NOT EXISTS partnership_sources_checked jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clinical_assets_ownership_status_check') THEN
    ALTER TABLE public.clinical_assets ADD CONSTRAINT clinical_assets_ownership_status_check
      CHECK (ownership_status IN ('originator', 'licensee', 'co_developer', 'comparator_or_background', 'marketed_other', 'unknown'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clinical_assets_partnership_basis_check') THEN
    ALTER TABLE public.clinical_assets ADD CONSTRAINT clinical_assets_partnership_basis_check
      CHECK (partnership_basis IS NULL OR partnership_basis IN ('deal_confirmed', 'press', 'trial_collaborator', 'drug_owner', 'no_evidence'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clinical_assets_owner_type_check') THEN
    ALTER TABLE public.clinical_assets ADD CONSTRAINT clinical_assets_owner_type_check
      CHECK (owner_type IS NULL OR owner_type IN ('industry', 'academic', 'government', 'hospital', 'network', 'cro', 'other', 'unknown'));
  END IF;
END $$;

COMMENT ON COLUMN public.clinical_assets.owner_type IS
  'Mirror of companies.owner_type for the owning company; maintained by trg_clinical_assets_owner_type. Values: lib/radar/client/filter-schema.ts RADAR_OWNER_TYPE_OPTIONS.';
COMMENT ON COLUMN public.clinical_assets.ownership_status IS
  'Does the owning company actually own this program? originator | licensee | co_developer | comparator_or_background | marketed_other | unknown. Set by radar_apply_ownership(); mirrored in lib/radar/ownership.ts deriveOwnership(). The feed hides comparator_or_background and marketed_other unless the ownership facet selects them.';
COMMENT ON COLUMN public.clinical_assets.ownership_evidence IS
  'Why ownership_status is what it is: {rule, drug_master_id, originator_company_id, originator_confidence, max_phase, owner_role, arms: {experimental, comparator, unknown}, matched_interventions}.';
COMMENT ON COLUMN public.clinical_assets.partnership_basis IS
  'Evidence class behind partnership_status: deal_confirmed | press | trial_collaborator | drug_owner | no_evidence. no_evidence is what "unpartnered" means in practice.';
COMMENT ON COLUMN public.clinical_assets.partnership_sources_checked IS
  '{deals, trial_collaborators, press, drug_owners: rows found for this company/asset; corpus: {deals, press}: table sizes searched; checked_at}. Shown as "checked N deals, M press items".';
COMMENT ON COLUMN public.clinical_assets.confidence_score IS
  'Data completeness of the asset record (trial count, enrollment, classification present); written by the indexer. Not the score confidence: see score_confidence.';
COMMENT ON COLUMN public.clinical_assets.score_confidence IS
  'Share of licensing-intent inputs with a dated source (evidence coverage); written by scoring. Not data completeness: see confidence_score.';

-- ══════════════════════════════════════════════════════════════════════
-- 2. owner_type mirror: backfill + trigger
-- ══════════════════════════════════════════════════════════════════════

UPDATE public.clinical_assets a
SET owner_type = COALESCE(c.owner_type, 'unknown')
FROM public.companies c
WHERE c.id = a.company_id
  AND a.owner_type IS DISTINCT FROM COALESCE(c.owner_type, 'unknown');

UPDATE public.clinical_assets SET owner_type = 'unknown' WHERE owner_type IS NULL;

CREATE OR REPLACE FUNCTION public.radar_set_asset_owner_type()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.owner_type := 'unknown';
  ELSIF TG_OP = 'INSERT' OR NEW.company_id IS DISTINCT FROM OLD.company_id OR NEW.owner_type IS NULL THEN
    SELECT COALESCE(c.owner_type, 'unknown') INTO NEW.owner_type FROM public.companies c WHERE c.id = NEW.company_id;
    NEW.owner_type := COALESCE(NEW.owner_type, 'unknown');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clinical_assets_owner_type ON public.clinical_assets;
CREATE TRIGGER trg_clinical_assets_owner_type
  BEFORE INSERT OR UPDATE OF company_id, owner_type ON public.clinical_assets
  FOR EACH ROW EXECUTE FUNCTION public.radar_set_asset_owner_type();

-- Companies changing owner_type (sponsor re-classification) push down to their assets.
CREATE OR REPLACE FUNCTION public.radar_propagate_company_owner_type()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.owner_type IS DISTINCT FROM OLD.owner_type THEN
    UPDATE public.clinical_assets SET owner_type = COALESCE(NEW.owner_type, 'unknown') WHERE company_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_companies_owner_type_propagate ON public.companies;
CREATE TRIGGER trg_companies_owner_type_propagate
  AFTER UPDATE OF owner_type ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.radar_propagate_company_owner_type();

-- ══════════════════════════════════════════════════════════════════════
-- 3. Indexes
-- ══════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_clinical_assets_owner_type
  ON public.clinical_assets (owner_type);
CREATE INDEX IF NOT EXISTS idx_clinical_assets_ownership_status
  ON public.clinical_assets (ownership_status);
CREATE INDEX IF NOT EXISTS idx_clinical_assets_ownership_queue
  ON public.clinical_assets (ownership_checked_at NULLS FIRST, id);
CREATE INDEX IF NOT EXISTS idx_clinical_assets_partnership_basis
  ON public.clinical_assets (partnership_basis);

-- Classifier queue tier 0 (lib/radar/classify.ts fetchClassificationQueue):
-- industry, unpartnered/partial, pre-approval, unclassified, stalest first.
CREATE INDEX IF NOT EXISTS idx_clinical_assets_classify_core
  ON public.clinical_assets (updated_at)
  WHERE classification_status = 'unclassified'
    AND owner_type = 'industry'
    AND partnership_status IN ('unpartnered', 'partially_partnered')
    AND phase IN ('early_phase_1', 'phase_1', 'phase_1_2', 'phase_2', 'phase_2_3', 'phase_3');

-- Feed free-text search and the facets RPC use ILIKE '%q%' on these four
-- columns; the text_pattern_ops indexes from 117 only serve prefixes.
CREATE INDEX IF NOT EXISTS idx_clinical_assets_asset_name_trgm
  ON public.clinical_assets USING gin (asset_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_clinical_assets_company_name_trgm
  ON public.clinical_assets USING gin (company_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_clinical_assets_target_trgm
  ON public.clinical_assets USING gin (target gin_trgm_ops) WHERE target IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clinical_assets_indication_specific_trgm
  ON public.clinical_assets USING gin (indication_specific gin_trgm_ops) WHERE indication_specific IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_research_signals_abstract_trgm
  ON public.research_signals USING gin (abstract gin_trgm_ops) WHERE abstract IS NOT NULL;

-- ══════════════════════════════════════════════════════════════════════
-- 4. Name key (mirror of lib/radar/drug-name.ts normalizeKey)
-- ══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.radar_name_key(p text)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
AS $$
  -- lower-case, keep ASCII letters and digits plus CJK / kana / hangul; drop everything else
  SELECT regexp_replace(
    lower(regexp_replace(p, '[™®©]', '', 'g')),
    '[^a-z0-9぀-ヿ㐀-䶿一-鿿가-힯]', '', 'g'
  );
$$;

COMMENT ON FUNCTION public.radar_name_key(text) IS
  'Same key as lib/radar/drug-name.ts normalizeKey() minus NFKC folding; used to match clinical_assets names to trial_interventions rows.';

-- ══════════════════════════════════════════════════════════════════════
-- 5. Ownership derivation (set-based; mirrored in lib/radar/ownership.ts)
-- ══════════════════════════════════════════════════════════════════════
--
-- Rules, in precedence order (first match wins):
--   originator_match   drug_master originator = owning company (confidence >= 70)
--   drug_owner_role    drug_owners says this company is licensee / co_developer
--   marketed_other     trusted originator is another company AND the program is
--                      phase_4 here or approved anywhere -> the sponsor is
--                      trialling somebody else's marketed drug
--   comparator         trusted originator is another company AND this company's
--                      trials never put the drug in an experimental arm
--   originator_mismatch trusted originator is another company but the drug is in
--                      an experimental arm here -> could be a licensee with no
--                      recorded deal; left 'unknown' (visible, flagged)
--   arm_comparator     no trusted originator; the matched arms are all
--                      comparator / placebo / other
--   sponsor_default    no trusted originator; at least one experimental arm
--   no_arm_evidence    nothing matched (legacy rows, unknown arms only)
--
-- Candidates: never checked, checked before their last enrichment, or
-- checked more than p_recheck_days ago. p_limit rows per call.

CREATE OR REPLACE FUNCTION public.radar_apply_ownership(
  p_limit integer DEFAULT 5000,
  p_recheck_days integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SET statement_timeout = '240s'
AS $$
DECLARE
  v_scanned integer := 0;
  v_written integer := 0;
  v_by_status jsonb := '{}'::jsonb;
  v_by_rule jsonb := '{}'::jsonb;
  v_remaining bigint := 0;
BEGIN
  DROP TABLE IF EXISTS tmp_ownership_cand;
  DROP TABLE IF EXISTS tmp_ownership_calc;

  CREATE TEMP TABLE tmp_ownership_cand ON COMMIT DROP AS
  SELECT a.id, a.company_id, a.asset_name, COALESCE(a.asset_aliases, '{}'::text[]) AS aliases,
         COALESCE(a.nct_ids, '{}'::text[]) AS nct_ids, a.phase, a.drug_master_id
  FROM public.clinical_assets a
  WHERE a.ownership_checked_at IS NULL
     OR (a.last_enriched_at IS NOT NULL AND a.last_enriched_at > a.ownership_checked_at)
     OR (a.drug_resolved_at IS NOT NULL AND a.drug_resolved_at > a.ownership_checked_at)
     OR a.ownership_checked_at < now() - make_interval(days => GREATEST(COALESCE(p_recheck_days, 30), 1))
  ORDER BY a.ownership_checked_at NULLS FIRST, a.id
  LIMIT GREATEST(COALESCE(p_limit, 5000), 1);
  GET DIAGNOSTICS v_scanned = ROW_COUNT;

  CREATE TEMP TABLE tmp_ownership_calc ON COMMIT DROP AS
  WITH cand AS (
    SELECT c.*, ARRAY(SELECT public.radar_name_key(x) FROM unnest(ARRAY[c.asset_name] || c.aliases) x WHERE x IS NOT NULL AND btrim(x) <> '') AS name_keys
    FROM tmp_ownership_cand c
  ),
  dm AS (
    SELECT c.id AS asset_id, d.id AS drug_master_id, d.originator_company_id, d.confidence AS originator_confidence, d.max_phase
    FROM cand c
    JOIN public.drug_master d ON d.id = c.drug_master_id
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
  calc AS (
    SELECT
      c.id,
      dm.drug_master_id,
      dm.originator_company_id,
      dm.originator_confidence,
      dm.max_phase,
      r.role AS owner_role,
      COALESCE(a.matched, 0) AS matched,
      COALESCE(a.experimental, 0) AS experimental,
      COALESCE(a.comparator, 0) AS comparator,
      COALESCE(a.unknown_arms, 0) AS unknown_arms,
      (dm.originator_company_id IS NOT NULL AND COALESCE(dm.originator_confidence, 0) >= 70) AS trusted_originator,
      (c.phase = 'phase_4' OR dm.max_phase = 'approved') AS marketed
    FROM cand c
    LEFT JOIN dm ON dm.asset_id = c.id
    LEFT JOIN owner_role r ON r.asset_id = c.id
    LEFT JOIN arms a ON a.asset_id = c.id
  ),
  decided AS (
    SELECT
      calc.*,
      CASE
        WHEN trusted_originator AND originator_company_id = (SELECT company_id FROM tmp_ownership_cand t WHERE t.id = calc.id) THEN 'originator_match'
        WHEN owner_role IS NOT NULL THEN 'drug_owner_role'
        WHEN trusted_originator AND marketed THEN 'marketed_other'
        WHEN trusted_originator AND experimental = 0 THEN 'comparator'
        WHEN trusted_originator THEN 'originator_mismatch'
        WHEN matched > 0 AND experimental = 0 AND comparator > 0 THEN 'arm_comparator'
        WHEN experimental > 0 THEN 'sponsor_default'
        ELSE 'no_arm_evidence'
      END AS rule
    FROM calc
  )
  SELECT
    d.id,
    CASE d.rule
      WHEN 'originator_match' THEN 'originator'
      WHEN 'drug_owner_role' THEN d.owner_role
      WHEN 'marketed_other' THEN 'marketed_other'
      WHEN 'comparator' THEN 'comparator_or_background'
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
      'matched_interventions', d.matched
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
$$;

COMMENT ON FUNCTION public.radar_apply_ownership(integer, integer) IS
  'Sets clinical_assets.ownership_status/evidence for up to p_limit stale rows from drug_master originator, drug_owners roles and trial_interventions arm roles. Rules mirrored in lib/radar/ownership.ts.';

REVOKE ALL ON FUNCTION public.radar_apply_ownership(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.radar_apply_ownership(integer, integer) TO service_role;
REVOKE ALL ON FUNCTION public.radar_name_key(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.radar_name_key(text) TO service_role, authenticated;

-- ══════════════════════════════════════════════════════════════════════
-- 6. Partnership basis: RPCs write it; backfill from stored evidence
-- ══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.radar_partnership_corpus()
RETURNS jsonb
LANGUAGE sql STABLE
AS $$
  SELECT jsonb_build_object(
    'deals', (SELECT count(*) FROM public.deals WHERE COALESCE(is_synthetic, false) = false),
    'press', (SELECT count(*) FROM public.press_releases)
  );
$$;

-- Backfill for rows the refresh has already stamped: class of the strongest evidence.
UPDATE public.clinical_assets a
SET partnership_basis = CASE
      WHEN a.partnership_evidence @> '[{"type":"deal"}]'::jsonb
           AND EXISTS (SELECT 1 FROM jsonb_array_elements(a.partnership_evidence) e
                       WHERE e->>'type' = 'deal' AND COALESCE(e->>'note', '') NOT LIKE '%rights reverted%') THEN 'deal_confirmed'
      WHEN a.partnership_evidence @> '[{"type":"press_release"}]'::jsonb THEN 'press'
      WHEN a.partnership_evidence @> '[{"type":"trial_collaborator"}]'::jsonb THEN 'trial_collaborator'
      WHEN a.partnership_evidence @> '[{"type":"drug_owner"}]'::jsonb THEN 'drug_owner'
      ELSE 'no_evidence'
    END,
    partnership_sources_checked = jsonb_build_object(
      'deals', (SELECT count(*) FROM jsonb_array_elements(COALESCE(a.partnership_evidence, '[]'::jsonb)) e WHERE e->>'type' = 'deal'),
      'trial_collaborators', (SELECT count(*) FROM jsonb_array_elements(COALESCE(a.partnership_evidence, '[]'::jsonb)) e WHERE e->>'type' = 'trial_collaborator'),
      'press', (SELECT count(*) FROM jsonb_array_elements(COALESCE(a.partnership_evidence, '[]'::jsonb)) e WHERE e->>'type' = 'press_release'),
      'drug_owners', 0,
      'corpus', public.radar_partnership_corpus(),
      'checked_at', COALESCE(a.partnership_checked_at, now())
    )
WHERE a.partnership_checked_at IS NOT NULL
  AND a.partnership_basis IS NULL;

-- Bulk stamp (backlog shortcut) now records what it searched.
CREATE OR REPLACE FUNCTION public.radar_partnership_stamp_unpartnered(p_scan integer DEFAULT 20000)
RETURNS jsonb
LANGUAGE plpgsql
SET statement_timeout = '150s'
AS $$
DECLARE
  v_scanned integer := 0;
  v_stamped integer := 0;
  v_by_prev jsonb := '{}'::jsonb;
  v_corpus jsonb := public.radar_partnership_corpus();
BEGIN
  DROP TABLE IF EXISTS tmp_partnership_scan;
  DROP TABLE IF EXISTS tmp_partnership_eligible;
  CREATE TEMP TABLE tmp_partnership_scan ON COMMIT DROP AS
  SELECT ca.id, ca.company_id, ca.company_name, ca.nct_ids, ca.partnership_status
  FROM public.clinical_assets ca
  WHERE ca.partnership_checked_at IS NULL
  ORDER BY ca.id
  LIMIT GREATEST(COALESCE(p_scan, 20000), 1);
  GET DIAGNOSTICS v_scanned = ROW_COUNT;

  CREATE TEMP TABLE tmp_partnership_eligible ON COMMIT DROP AS
  SELECT s.id, s.partnership_status
  FROM tmp_partnership_scan s
  LEFT JOIN public.companies c ON c.id = s.company_id
  WHERE NOT EXISTS (
      SELECT 1 FROM public.clinical_assets x
      WHERE x.id = s.id AND x.deal_ids IS NOT NULL AND cardinality(x.deal_ids) > 0
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.deals d
      WHERE (s.company_id IS NOT NULL AND d.licensor_id = s.company_id)
         OR lower(d.licensor_name) = lower(s.company_name)
         OR (c.name IS NOT NULL AND lower(d.licensor_name) = lower(c.name))
         OR (c.name_variations IS NOT NULL AND d.licensor_name = ANY(c.name_variations))
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.company_trials t
      WHERE s.nct_ids IS NOT NULL
        AND t.nct_id = ANY(s.nct_ids)
        AND (
          (t.collaborator_names IS NOT NULL AND cardinality(t.collaborator_names) > 0)
          OR t.company_id IS DISTINCT FROM s.company_id
        )
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.press_releases p
      WHERE p.categories && ARRAY['licensing', 'm&a']::text[]
        AND (
          (s.company_id IS NOT NULL AND p.company_ids && ARRAY[s.company_id])
          OR p.companies_mentioned && ARRAY[s.company_name]
          OR (c.name IS NOT NULL AND p.companies_mentioned && ARRAY[c.name])
          OR (c.name_variations IS NOT NULL AND p.companies_mentioned && c.name_variations)
        )
    );

  SELECT COALESCE(jsonb_object_agg(COALESCE(partnership_status, 'unknown'), n), '{}'::jsonb)
  INTO v_by_prev
  FROM (SELECT partnership_status, COUNT(*) AS n FROM tmp_partnership_eligible GROUP BY partnership_status) q;

  UPDATE public.clinical_assets ca
  SET partnership_status = 'unpartnered',
      partner_company_name = NULL,
      partner_company_id = NULL,
      territory_rights_available = ARRAY['global']::text[],
      deal_id = NULL,
      deal_ids = ARRAY[]::uuid[],
      partnership_evidence = '[]'::jsonb,
      partnership_confidence = 40,
      partnership_basis = 'no_evidence',
      partnership_sources_checked = jsonb_build_object(
        'deals', 0, 'trial_collaborators', 0, 'press', 0, 'drug_owners', 0,
        'corpus', v_corpus, 'checked_at', now()
      ),
      partnership_checked_at = now()
  FROM tmp_partnership_eligible e
  WHERE ca.id = e.id
    AND ca.partnership_checked_at IS NULL;
  GET DIAGNOSTICS v_stamped = ROW_COUNT;

  RETURN jsonb_build_object(
    'scanned', v_scanned,
    'stamped', v_stamped,
    'by_previous_status', v_by_prev
  );
END;
$$;

-- Set-based apply now takes basis + sources_checked from the deriver.
CREATE OR REPLACE FUNCTION public.radar_apply_partnership(p_rows jsonb)
RETURNS integer
LANGUAGE plpgsql
SET statement_timeout = '90s'
AS $$
DECLARE
  v_updated integer := 0;
  v_corpus jsonb := public.radar_partnership_corpus();
BEGIN
  UPDATE public.clinical_assets ca
  SET partnership_status = r.status,
      partner_company_name = r.partner_company_name,
      partner_company_id = r.partner_company_id,
      territory_rights_available = COALESCE(r.territory_rights_available, ARRAY['global']::text[]),
      deal_id = r.deal_id,
      deal_ids = COALESCE(r.deal_ids, ARRAY[]::uuid[]),
      partnership_evidence = COALESCE(r.evidence, '[]'::jsonb),
      partnership_confidence = LEAST(100, GREATEST(0, COALESCE(r.confidence, 0))),
      partnership_basis = COALESCE(r.basis, ca.partnership_basis, 'no_evidence'),
      partnership_sources_checked = COALESCE(r.sources_checked, '{}'::jsonb)
        || jsonb_build_object('corpus', v_corpus, 'checked_at', now()),
      partnership_checked_at = now()
  FROM jsonb_to_recordset(p_rows) AS r(
    id uuid, status text, partner_company_name text, partner_company_id uuid,
    territory_rights_available text[], deal_id uuid, deal_ids uuid[], evidence jsonb, confidence integer,
    basis text, sources_checked jsonb
  )
  WHERE ca.id = r.id
    AND r.status IN ('unpartnered', 'partially_partnered', 'partnered')
    AND (r.basis IS NULL OR r.basis IN ('deal_confirmed', 'press', 'trial_collaborator', 'drug_owner', 'no_evidence'))
    AND (r.partner_company_id IS NULL OR EXISTS (SELECT 1 FROM public.companies c WHERE c.id = r.partner_company_id));
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

-- ══════════════════════════════════════════════════════════════════════
-- 7. Facet counts v2: ownership facet + default exclusions
-- ══════════════════════════════════════════════════════════════════════
--
-- base_all applies every explicit filter. base additionally applies the
-- feed's defaults: when the caller sent no ownership list, hide
-- comparator_or_background and marketed_other; when it sent no phase list,
-- hide phase_4. The ownership and phase buckets are counted on base_all so
-- the rail can still show "Phase 4 / Approved (21,827)" and let the user opt
-- in. Everything else, including _total, is counted on base.

CREATE OR REPLACE FUNCTION radar_facet_counts(filters jsonb DEFAULT '{}'::jsonb)
RETURNS TABLE(facet text, value text, count bigint)
LANGUAGE sql STABLE
SET statement_timeout = '5s'
AS $$
  WITH f AS (
    SELECT
      CASE WHEN jsonb_typeof(filters->'ta') = 'array' AND jsonb_array_length(filters->'ta') > 0
        THEN ARRAY(SELECT jsonb_array_elements_text(filters->'ta')) END AS ta,
      CASE WHEN jsonb_typeof(filters->'modality') = 'array' AND jsonb_array_length(filters->'modality') > 0
        THEN ARRAY(SELECT jsonb_array_elements_text(filters->'modality')) END AS modality,
      CASE WHEN jsonb_typeof(filters->'phase') = 'array' AND jsonb_array_length(filters->'phase') > 0
        THEN ARRAY(SELECT jsonb_array_elements_text(filters->'phase')) END AS phase,
      CASE WHEN jsonb_typeof(filters->'partnership') = 'array' AND jsonb_array_length(filters->'partnership') > 0
        THEN ARRAY(SELECT jsonb_array_elements_text(filters->'partnership')) END AS partnership,
      CASE WHEN jsonb_typeof(filters->'ownership') = 'array' AND jsonb_array_length(filters->'ownership') > 0
        THEN ARRAY(SELECT jsonb_array_elements_text(filters->'ownership')) END AS ownership,
      CASE WHEN jsonb_typeof(filters->'country') = 'array' AND jsonb_array_length(filters->'country') > 0
        THEN ARRAY(SELECT jsonb_array_elements_text(filters->'country')) END AS country,
      CASE WHEN jsonb_typeof(filters->'region') = 'array' AND jsonb_array_length(filters->'region') > 0
        THEN ARRAY(SELECT jsonb_array_elements_text(filters->'region')) END AS region,
      CASE WHEN jsonb_typeof(filters->'owner_type') = 'array' AND jsonb_array_length(filters->'owner_type') > 0
        THEN ARRAY(SELECT jsonb_array_elements_text(filters->'owner_type')) END AS owner_type,
      CASE WHEN jsonb_typeof(filters->'trial_status') = 'array' AND jsonb_array_length(filters->'trial_status') > 0
        THEN ARRAY(SELECT jsonb_array_elements_text(filters->'trial_status')) END AS trial_status,
      CASE WHEN jsonb_typeof(filters->'indication') = 'array' AND jsonb_array_length(filters->'indication') > 0
        THEN ARRAY(SELECT jsonb_array_elements_text(filters->'indication')) END AS indication,
      CASE WHEN jsonb_typeof(filters->'target') = 'array' AND jsonb_array_length(filters->'target') > 0
        THEN ARRAY(SELECT jsonb_array_elements_text(filters->'target')) END AS target,
      CASE WHEN jsonb_typeof(filters->'score_band') = 'array' AND jsonb_array_length(filters->'score_band') > 0
        THEN ARRAY(SELECT jsonb_array_elements_text(filters->'score_band')) END AS score_band,
      CASE WHEN jsonb_typeof(filters->'min_score') = 'number'
        THEN (filters->>'min_score')::numeric END AS min_score,
      NULLIF(btrim(filters->>'q'), '') AS q
  ),
  base_all AS MATERIALIZED (
    SELECT
      a.therapeutic_area,
      a.indication_category,
      a.modality,
      a.phase,
      a.target,
      a.partnership_status,
      a.ownership_status,
      a.originator_country,
      a.originator_region,
      a.trial_status,
      COALESCE(a.owner_type, 'unknown') AS owner_type,
      radar_score_band(a.licensing_intent_score) AS score_band,
      (f.ownership IS NULL AND a.ownership_status IN ('comparator_or_background', 'marketed_other')) AS default_hidden_ownership,
      (f.phase IS NULL AND a.phase = 'phase_4') AS default_hidden_phase
    FROM clinical_assets a
    CROSS JOIN f
    WHERE (f.ta IS NULL OR a.therapeutic_area = ANY(f.ta))
      AND (f.modality IS NULL OR a.modality = ANY(f.modality))
      AND (f.phase IS NULL OR a.phase = ANY(f.phase))
      AND (f.partnership IS NULL OR a.partnership_status = ANY(f.partnership))
      AND (f.ownership IS NULL OR a.ownership_status = ANY(f.ownership))
      AND (f.country IS NULL OR a.originator_country = ANY(f.country))
      AND (f.region IS NULL OR a.originator_region = ANY(f.region))
      AND (f.owner_type IS NULL OR COALESCE(a.owner_type, 'unknown') = ANY(f.owner_type))
      AND (f.trial_status IS NULL OR a.trial_status = ANY(f.trial_status))
      AND (f.indication IS NULL OR a.indication_category = ANY(f.indication))
      AND (f.target IS NULL OR a.target = ANY(f.target))
      AND (f.score_band IS NULL OR radar_score_band(a.licensing_intent_score) = ANY(f.score_band))
      AND (f.min_score IS NULL OR a.licensing_intent_score >= f.min_score)
      AND (
        f.q IS NULL
        OR a.asset_name ILIKE '%' || f.q || '%'
        OR a.company_name ILIKE '%' || f.q || '%'
        OR a.target ILIKE '%' || f.q || '%'
        OR a.indication_specific ILIKE '%' || f.q || '%'
      )
  ),
  base AS MATERIALIZED (
    SELECT * FROM base_all WHERE NOT default_hidden_ownership AND NOT default_hidden_phase
  )
  SELECT '_total', 'all', count(*) FROM base
  UNION ALL
  (SELECT 'region', originator_region, count(*) FROM base WHERE originator_region IS NOT NULL GROUP BY 2 ORDER BY 3 DESC)
  UNION ALL
  (SELECT 'country', originator_country, count(*) FROM base WHERE originator_country IS NOT NULL GROUP BY 2 ORDER BY 3 DESC LIMIT 60)
  UNION ALL
  (SELECT 'ta', therapeutic_area, count(*) FROM base WHERE therapeutic_area IS NOT NULL GROUP BY 2 ORDER BY 3 DESC)
  UNION ALL
  (SELECT 'indication', indication_category, count(*) FROM base WHERE indication_category IS NOT NULL GROUP BY 2 ORDER BY 3 DESC LIMIT 50)
  UNION ALL
  (SELECT 'modality', modality, count(*) FROM base WHERE modality IS NOT NULL GROUP BY 2 ORDER BY 3 DESC)
  UNION ALL
  -- phase and ownership are counted before the defaults so hidden groups stay discoverable
  (SELECT 'phase', phase, count(*) FROM base_all WHERE phase IS NOT NULL AND NOT default_hidden_ownership GROUP BY 2 ORDER BY 3 DESC)
  UNION ALL
  (SELECT 'ownership', ownership_status, count(*) FROM base_all WHERE NOT default_hidden_phase GROUP BY 2 ORDER BY 3 DESC)
  UNION ALL
  (SELECT 'target', target, count(*) FROM base WHERE target IS NOT NULL GROUP BY 2 ORDER BY 3 DESC LIMIT 30)
  UNION ALL
  (SELECT 'partnership', partnership_status, count(*) FROM base WHERE partnership_status IS NOT NULL GROUP BY 2 ORDER BY 3 DESC)
  UNION ALL
  (SELECT 'owner_type', owner_type, count(*) FROM base GROUP BY 2 ORDER BY 3 DESC)
  UNION ALL
  (SELECT 'score_band', score_band, count(*) FROM base WHERE score_band IS NOT NULL GROUP BY 2 ORDER BY 3 DESC)
  UNION ALL
  (SELECT 'trial_status', trial_status, count(*) FROM base WHERE trial_status IS NOT NULL GROUP BY 2 ORDER BY 3 DESC);
$$;

COMMENT ON FUNCTION radar_facet_counts(jsonb) IS
  'Facet buckets for /api/radar/facets. filters keys: ta, modality, phase, partnership, ownership, country, region, owner_type, trial_status, indication, target, score_band (text arrays), min_score (number), q (text). Defaults: no ownership list hides comparator_or_background + marketed_other; no phase list hides phase_4; the phase and ownership buckets are counted before those defaults.';

-- ══════════════════════════════════════════════════════════════════════
-- 8. Thesis eligibility: only programs the company owns
-- ══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW radar_thesis_eligible_assets AS
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
  FROM clinical_assets a
  JOIN companies c ON c.id = a.company_id
  WHERE (
      c.owner_type = 'industry'
      OR (COALESCE(c.owner_type, 'unknown') = 'unknown' AND upper(COALESCE(c.lead_sponsor_class, '')) = 'INDUSTRY')
    )
    AND a.partnership_status IN ('unpartnered', 'partially_partnered')
    AND a.ownership_status NOT IN ('comparator_or_background', 'marketed_other')
    AND COALESCE(a.confidence_score, 0) >= 20
    AND (
      a.phase IN (
        'early_phase_1', 'phase_1', 'phase_1_2', 'phase_2', 'phase_2_3', 'phase_3',
        'early_phase1', 'phase1', 'phase1_phase2', 'phase2', 'phase2_phase3', 'phase3'
      )
      OR (a.phase IN ('phase_4', 'phase4') AND a.partnership_status = 'unpartnered')
    );

-- ══════════════════════════════════════════════════════════════════════
-- 9. Phase breakdown ordered by the slugs the table actually holds (P2)
-- ══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION radar_phase_breakdown()
RETURNS TABLE(phase TEXT, total BIGINT, unpartnered BIGINT) AS $$
  SELECT
    phase,
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE partnership_status IN ('unpartnered', 'partially_partnered')) AS unpartnered
  FROM clinical_assets
  WHERE phase IS NOT NULL AND phase NOT IN ('unknown', 'not_applicable')
  GROUP BY phase
  ORDER BY
    CASE phase
      WHEN 'early_phase_1' THEN 1 WHEN 'phase_1' THEN 2
      WHEN 'phase_1_2' THEN 3 WHEN 'phase_2' THEN 4
      WHEN 'phase_2_3' THEN 5 WHEN 'phase_3' THEN 6
      WHEN 'phase_4' THEN 7
      ELSE 9
    END;
$$ LANGUAGE sql STABLE;
