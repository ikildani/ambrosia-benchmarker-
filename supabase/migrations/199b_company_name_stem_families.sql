-- 199b: company rows that differ only by legal suffix, case or punctuation join one family.
--
-- Families (migration 193) form only from cited relations: a declared parent, a shared e-mail
-- domain, acquisition codes, a model or a person. Nothing linked "AFT Pharmaceuticals",
-- "Aft Pharmaceuticals Limited" and "AFT Pharmaceuticals, Ltd.", so the same drug sat in the feed's
-- top 1,000 twice (Nov 25 2026). Measured before applying: 62 name stems held by more than one
-- family, 57 of them in the ranked feed; hand check of 30: all the same entity or its local legal
-- arm ("Rakuten Medical, Inc." / "Rakuten Medical, K.K.").
--
-- Rule: the stem is the lower-cased Latin name with legal suffixes removed and only [a-z0-9] kept;
-- stems shorter than 6 characters are ignored. Each extra row links (same_entity, source name_stem)
-- to the stem's row with the most pipeline assets. A pair a person decided or rejected, in either
-- direction, is left alone. lib/entities/company-family-run.ts calls radar_link_name_stem_relations()
-- before radar_refresh_company_families().
--
-- Second gap, larger: rows already merged by name-stem merging (companies.merged_into) kept their
-- trials and clinical assets (2,478 assets, 1,648 ranked feed programs on 464 merged rows; AFT's two
-- merged rows among them), and radar_refresh_company_families mapped edges onto survivors but never
-- gave the merged rows themselves a family. They now join their final survivor's family (chains up
-- to 3 hops resolved); a survivor is preferred as root. Largest resulting family: Sanofi, ~44 rows,
-- under the 150-row cap.

ALTER TABLE public.company_relations DROP CONSTRAINT IF EXISTS company_relations_source_check;
ALTER TABLE public.company_relations ADD CONSTRAINT company_relations_source_check
  CHECK (source IN ('name_parent', 'email_domain', 'acquisition_codes', 'model', 'manual', 'name_stem'));

CREATE OR REPLACE FUNCTION public.radar_company_name_stem(p text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE PARALLEL SAFE
AS $function$
  SELECT CASE WHEN p IS NULL OR p ~ '[㐀-鿿]' THEN NULL ELSE nullif(
    regexp_replace(
      regexp_replace(lower(p),
        '\m(co|corp|corporation|inc|incorporated|ltd|limited|llc|plc|gmbh|ag|sa|s\.a|spa|s\.p\.a|bv|b\.v|nv|n\.v|ab|as|a/s|oy|kk|k\.k|pty|pte|srl|sas|company|holdings?|group)\M\.?',
        '', 'g'),
      '[^a-z0-9]+', '', 'g'), '') END
$function$;

COMMENT ON FUNCTION public.radar_company_name_stem(text) IS
  'Company name without legal suffixes, case or punctuation; NULL for CJK names (migration 199b).';

CREATE OR REPLACE FUNCTION public.radar_link_name_stem_relations()
 RETURNS integer
 LANGUAGE plpgsql
 SET statement_timeout TO '120s'
AS $function$
DECLARE
  v_written integer := 0;
BEGIN
  WITH c AS (
    SELECT id, public.radar_company_name_stem(name) AS stem, coalesce(pipeline_assets_count, 0) AS n
    FROM public.companies
    WHERE merged_into IS NULL
  ), s AS (
    SELECT id, stem,
           first_value(id) OVER (PARTITION BY stem ORDER BY n DESC, id) AS root,
           count(*) OVER (PARTITION BY stem) AS k
    FROM c
    WHERE length(stem) >= 6
  ), pairs AS (
    SELECT s.id AS company_id, s.root AS parent_id, s.stem
    FROM s
    WHERE s.k > 1 AND s.id <> s.root
      AND NOT EXISTS (
        SELECT 1 FROM public.company_relations r
        WHERE ((r.company_id = s.id AND r.parent_id = s.root) OR (r.company_id = s.root AND r.parent_id = s.id))
          AND (r.decided_by = 'human' OR r.status = 'rejected'))
  ), up AS (
    INSERT INTO public.company_relations (company_id, parent_id, relation, source, status, decided_by, confidence, evidence)
    SELECT company_id, parent_id, 'same_entity', 'name_stem', 'accepted', 'rule', 0.95, jsonb_build_object('stem', stem)
    FROM pairs
    ON CONFLICT (company_id, parent_id) DO UPDATE
      SET updated_at = now()
      WHERE company_relations.source = 'name_stem'
    RETURNING 1
  )
  SELECT count(*) INTO v_written FROM up;
  RETURN v_written;
END;
$function$;

COMMENT ON FUNCTION public.radar_link_name_stem_relations() IS
  'Upserts same_entity relations between company rows with one legal-name stem (migration 199b). Run before radar_refresh_company_families().';

REVOKE ALL ON FUNCTION public.radar_link_name_stem_relations() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.radar_link_name_stem_relations() TO service_role;

-- Families: merged-away rows join their survivor (see the 199b note in the body). Body from 193.
CREATE OR REPLACE FUNCTION public.radar_refresh_company_families(p_max_size integer DEFAULT 150)
RETURNS jsonb
LANGUAGE plpgsql
SET statement_timeout TO '120s'
AS $function$
DECLARE
  v_changed integer := 0;
  v_families integer := 0;
  v_members integer := 0;
  v_oversize jsonb := '[]'::jsonb;
  i integer;
BEGIN
  DROP TABLE IF EXISTS tmp_cf_edge;
  CREATE TEMP TABLE tmp_cf_edge ON COMMIT DROP AS
  SELECT DISTINCT coalesce(c1.merged_into, c1.id)::text AS a, coalesce(c2.merged_into, c2.id)::text AS b
  FROM public.company_relations r
  JOIN public.companies c1 ON c1.id = r.company_id
  JOIN public.companies c2 ON c2.id = r.parent_id
  WHERE r.status = 'accepted'
    -- Two large-pharma rows join only on a declared name or a person's decision, never on a
    -- model, domain or acquisition-record inference (one wrong edge would fuse two majors).
    AND NOT (r.source IN ('model', 'email_domain', 'acquisition_codes')
             AND c1.company_type = 'large_pharma' AND c2.company_type = 'large_pharma');
  -- migration 199b: a merged-away row (companies.merged_into) still holds trials and clinical assets
  -- (2,478 assets on 464 such rows, Nov 25 2026) and joins its final survivor's family, so its
  -- programs group with the survivor's and the derivations treat it as the same owner.
  INSERT INTO tmp_cf_edge
  WITH RECURSIVE ch AS (
    SELECT id, merged_into AS s, 1 AS d FROM public.companies WHERE merged_into IS NOT NULL
    UNION ALL
    SELECT ch.id, c.merged_into, ch.d + 1 FROM ch JOIN public.companies c ON c.id = ch.s
    WHERE c.merged_into IS NOT NULL AND ch.d < 6
  )
  SELECT DISTINCT ON (id) id::text, s::text FROM ch ORDER BY id, d DESC;
  DELETE FROM tmp_cf_edge WHERE a = b;
  INSERT INTO tmp_cf_edge SELECT b, a FROM tmp_cf_edge;
  CREATE INDEX ON tmp_cf_edge (b);

  DROP TABLE IF EXISTS tmp_cf_lab;
  CREATE TEMP TABLE tmp_cf_lab ON COMMIT DROP AS SELECT DISTINCT a AS id, a AS lab FROM tmp_cf_edge;
  CREATE INDEX ON tmp_cf_lab (id);
  FOR i IN 1..40 LOOP
    UPDATE tmp_cf_lab l SET lab = s.m
    FROM (SELECT e.a AS id, min(l2.lab) AS m FROM tmp_cf_edge e JOIN tmp_cf_lab l2 ON l2.id = e.b GROUP BY 1) s
    WHERE l.id = s.id AND s.m < l.lab;
    EXIT WHEN NOT FOUND;
  END LOOP;

  SELECT coalesce(jsonb_agg(jsonb_build_object('label', lab, 'size', n)), '[]'::jsonb) INTO v_oversize
  FROM (SELECT lab, count(*) AS n FROM tmp_cf_lab GROUP BY lab HAVING count(*) > p_max_size) o;
  DELETE FROM tmp_cf_lab WHERE lab IN (SELECT lab FROM tmp_cf_lab GROUP BY lab HAVING count(*) > p_max_size);

  DROP TABLE IF EXISTS tmp_cf_root;
  CREATE TEMP TABLE tmp_cf_root ON COMMIT DROP AS
  WITH sub AS (
    SELECT coalesce(c.merged_into, c.id) AS id, bool_or(r.company_id = c.id) AS is_child, bool_or(r.parent_id = c.id) AS is_parent
    FROM public.company_relations r
    JOIN public.companies c ON c.id IN (r.company_id, r.parent_id)
    WHERE r.status = 'accepted' AND r.relation = 'subsidiary'
    GROUP BY 1
  )
  SELECT DISTINCT ON (l.lab) l.lab, c.id AS root
  FROM tmp_cf_lab l
  JOIN public.companies c ON c.id = l.id::uuid
  LEFT JOIN sub s ON s.id = c.id
  ORDER BY l.lab,
           (c.merged_into IS NULL) DESC,
           (coalesce(s.is_parent, false) AND NOT coalesce(s.is_child, false)) DESC,
           (c.company_type = 'large_pharma') DESC,
           (c.name !~ '[㐀-鿿]') DESC,
           coalesce(c.pipeline_assets_count, 0) DESC,
           c.id;

  DROP TABLE IF EXISTS tmp_cf_new;
  CREATE TEMP TABLE tmp_cf_new ON COMMIT DROP AS
  SELECT l.id::uuid AS id, r.root FROM tmp_cf_lab l JOIN tmp_cf_root r ON r.lab = l.lab;

  DROP TABLE IF EXISTS tmp_cf_changed;
  CREATE TEMP TABLE tmp_cf_changed ON COMMIT DROP AS
  SELECT c.id, n.root
  FROM public.companies c
  LEFT JOIN tmp_cf_new n ON n.id = c.id
  WHERE c.family_id IS DISTINCT FROM n.root AND (c.family_id IS NOT NULL OR n.root IS NOT NULL);

  UPDATE public.companies c SET family_id = x.root FROM tmp_cf_changed x WHERE c.id = x.id;
  GET DIAGNOSTICS v_changed = ROW_COUNT;

  -- Ownership compares originator and holder families: re-derive it for the rows that moved.
  UPDATE public.clinical_assets a SET ownership_checked_at = NULL
  WHERE a.company_id IN (SELECT id FROM tmp_cf_changed) AND a.ownership_checked_at IS NOT NULL;

  SELECT count(DISTINCT root), count(*) INTO v_families, v_members FROM tmp_cf_new;
  RETURN jsonb_build_object('families', v_families, 'members', v_members, 'changed', v_changed, 'oversize', v_oversize);
END;
$function$;

COMMENT ON FUNCTION public.radar_refresh_company_families(integer) IS
  'Recomputes companies.family_id from accepted company_relations and merged_into survivors (migrations 193, 199b). Run after relation writes, before radar_refresh_programs.';
