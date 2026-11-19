-- 193: corporate families — one owner behind many company rows.
--
-- The universe holds one company under several rows: its Chinese legal name
-- (齐鲁制药有限公司 / Qilu Pharmaceutical), operating and trial subsidiaries
-- (Genentech under Roche, 上海津曼特 under CSPC, Juno under BMS) and acquired
-- companies (Shire under Takeda). Name-stem merging (lib/entities/same-company.ts)
-- cannot see these, and folding them into one row would lose the legal entity
-- that sponsors the trial. Instead each row keeps its identity and gains a
-- family: companies.family_id = the family's root row (NULL = standalone).
--
-- Evidence, each cited in company_relations.evidence:
--   name_parent        the row's own name declares its parent ("Kymab Ltd, A Sanofi
--                      Company", "Juno Therapeutics, a subsidiary of Celgene")
--   email_domain       CDE trial contact e-mail domains and verified company websites
--                      (radar_company_domain_members); a domain alone also carries CROs
--                      and licensees, so only a shared brand or an adjudicated pair counts
--   acquisition_codes  an acquisition deal between two holders of the same development codes
--   model              a domain cluster or shared-code pair adjudicated by the model
--   manual             a person; never overwritten by the job
--
-- Families change four derivations:
--   radar_refresh_programs   programs group per family (Roche + Genentech hold one
--                            afimkibart program); the primary row prefers the root at equal phase
--   radar_apply_ownership    the originator's family counts as the originator
--   radar_refresh_availability  large-pharma subsidiaries count as large pharma; an
--                            originator in the same family is not "originator elsewhere"
--   radar_link_deals         a deal links to the licensor family's program
-- and the scorecard counts top-1,000 duplicates per family.
-- Apply after 192. Idempotent.

CREATE TABLE IF NOT EXISTS public.company_relations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  parent_id   uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  relation    text NOT NULL CHECK (relation IN ('same_entity', 'subsidiary')),
  source      text NOT NULL CHECK (source IN ('name_parent', 'email_domain', 'acquisition_codes', 'model', 'manual')),
  status      text NOT NULL DEFAULT 'accepted' CHECK (status IN ('accepted', 'proposed', 'rejected')),
  decided_by  text NOT NULL DEFAULT 'rule' CHECK (decided_by IN ('rule', 'model', 'human')),
  confidence  numeric,
  evidence    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_relations_uq UNIQUE (company_id, parent_id),
  CONSTRAINT company_relations_not_self CHECK (company_id <> parent_id)
);
CREATE INDEX IF NOT EXISTS idx_company_relations_parent ON public.company_relations (parent_id);
COMMENT ON TABLE public.company_relations IS
  'Same-entity / subsidiary links between company rows with cited evidence; accepted links form companies.family_id (migration 193).';
ALTER TABLE public.company_relations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access company_relations" ON public.company_relations;
CREATE POLICY "Service role full access company_relations"
  ON public.company_relations FOR ALL TO service_role USING (true) WITH CHECK (true);

-- One row per adjudicated subject (a domain cluster or a code-sharing pair): the model is asked again
-- only when the subject's members change.
CREATE TABLE IF NOT EXISTS public.company_family_reviews (
  subject      text PRIMARY KEY,
  members_hash text NOT NULL,
  model        text,
  result       jsonb NOT NULL DEFAULT '{}'::jsonb,
  reviewed_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.company_family_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access company_family_reviews" ON public.company_family_reviews;
CREATE POLICY "Service role full access company_family_reviews"
  ON public.company_family_reviews FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS family_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_companies_family_id ON public.companies (family_id) WHERE family_id IS NOT NULL;
COMMENT ON COLUMN public.companies.family_id IS
  'Root company row of this row''s corporate family (itself for the root); NULL = standalone. radar_refresh_company_families(), migration 193.';

-- ── Evidence ─────────────────────────────────────────────────────────────

-- Registrable domain of an e-mail address or URL: its.jnj.com -> jnj.com, www.qilu-pharma.com.cn -> qilu-pharma.com.cn.
CREATE OR REPLACE FUNCTION public.radar_registrable_domain(p text)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
  WITH h AS (
    SELECT lower(regexp_replace(regexp_replace(btrim(coalesce(p, '')), '^.*@', ''),
                                '^([a-z]+://)?(www\.)?([^/:?#\s]+).*$', '\3', 'i')) AS host
  ), l AS (SELECT host, string_to_array(host, '.') AS parts FROM h)
  SELECT CASE
           WHEN host !~ '^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$' THEN NULL
           WHEN cardinality(parts) >= 3 AND length(parts[cardinality(parts)]) = 2
                AND parts[cardinality(parts) - 1] IN ('com', 'net', 'org', 'edu', 'gov', 'co', 'ac', 'or', 'ne', 'go')
             THEN array_to_string(parts[cardinality(parts) - 2:cardinality(parts)], '.')
           ELSE array_to_string(parts[cardinality(parts) - 1:cardinality(parts)], '.')
         END
  FROM l;
$$;

CREATE OR REPLACE FUNCTION public.radar_is_webmail(p_domain text)
RETURNS boolean
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
  SELECT coalesce(p_domain, '') = ''
      OR p_domain ~ '^(qq|163|126|139|189|sina|sohu|gmail|googlemail|hotmail|outlook|live|msn|yahoo|ymail|foxmail|aliyun|yeah|263|21cn|icloud|me|aol|protonmail|naver|daum|hanmail|nate)\.'
      OR p_domain IN ('vip.163.com', 'vip.qq.com', 'sina.cn', 'yahoo.co.jp', 'yahoo.com.cn');
$$;

-- Company rows reachable from one domain: CDE trial contact e-mails, and company websites
-- found from a registry contact, a web search or Wikidata (never a guessed domain).
CREATE OR REPLACE FUNCTION public.radar_company_domain_members()
RETURNS TABLE (domain text, company_id uuid, via text, n bigint)
LANGUAGE sql STABLE
SET statement_timeout TO '120s'
AS $$
  WITH em AS (
    SELECT public.radar_registrable_domain(rt.raw->'fields'->>'联系人Email') AS domain, ct.company_id
    FROM public.registry_trials rt
    JOIN public.company_trials ct ON ct.id = rt.mapped_company_trial_id
    WHERE rt.registry = 'cde' AND rt.raw->'fields'->>'联系人Email' LIKE '%@%' AND ct.company_id IS NOT NULL
  ), web AS (
    SELECT public.radar_registrable_domain(c.website_url) AS domain, c.id AS company_id
    FROM public.companies c
    WHERE c.website_url IS NOT NULL AND c.website_source IN ('ctgov_contact', 'web_search', 'wikidata')
  ), m AS (
    SELECT em.domain, em.company_id, 'cde_contact_email'::text AS via FROM em
    UNION ALL
    SELECT web.domain, web.company_id, 'website' FROM web
  )
  SELECT m.domain, coalesce(c.merged_into, c.id), m.via, count(*)
  FROM m JOIN public.companies c ON c.id = m.company_id
  WHERE m.domain IS NOT NULL AND NOT public.radar_is_webmail(m.domain)
  GROUP BY 1, 2, 3;
$$;

-- Pairs of industry companies holding the same distinctive development code (used by at most
-- three companies), with any licensing deal and the latest acquisition deal between them.
CREATE OR REPLACE FUNCTION public.radar_company_code_pairs()
RETURNS TABLE (a_id uuid, b_id uuid, shared integer, codes text[], licensing_deal boolean,
               acquirer_id uuid, acquired_id uuid, acquisition_deal_id uuid, acquisition_asset text)
LANGUAGE sql STABLE
SET statement_timeout TO '120s'
AS $$
  WITH pk AS (
    SELECT DISTINCT a.company_id, split_part(a.program_key, ':t:', 2) AS tok
    FROM public.clinical_assets a
    JOIN public.companies c ON c.id = a.company_id AND c.merged_into IS NULL AND c.owner_type = 'industry'
    WHERE a.program_key LIKE '%:t:%' AND split_part(a.program_key, ':t:', 2) ~ '[0-9]'
  ), df AS (
    SELECT tok FROM pk GROUP BY tok HAVING count(*) BETWEEN 2 AND 3
  ), pairs AS (
    SELECT p1.company_id AS a_id, p2.company_id AS b_id, count(*)::int AS shared,
           array_agg(p1.tok ORDER BY p1.tok) AS codes
    FROM pk p1
    JOIN pk p2 ON p2.tok = p1.tok AND p1.company_id < p2.company_id
    JOIN df ON df.tok = p1.tok
    GROUP BY 1, 2
  )
  SELECT p.a_id, p.b_id, p.shared, p.codes,
         EXISTS (SELECT 1 FROM public.deals d
                 WHERE coalesce(d.is_canonical, true) AND NOT coalesce(d.is_synthetic, false)
                   AND d.deal_type <> 'acquisition'
                   AND ((d.licensor_id = p.a_id AND d.licensee_id = p.b_id) OR (d.licensor_id = p.b_id AND d.licensee_id = p.a_id))),
         acq.licensee_id, acq.licensor_id, acq.id, acq.asset_name
  FROM pairs p
  LEFT JOIN LATERAL (
    SELECT d.id, d.licensee_id, d.licensor_id, d.asset_name
    FROM public.deals d
    WHERE coalesce(d.is_canonical, true) AND NOT coalesce(d.is_synthetic, false)
      AND d.deal_type = 'acquisition'
      AND lower(coalesce(d.verification_status, '')) NOT IN ('rejected', 'flagged')
      AND ((d.licensor_id = p.a_id AND d.licensee_id = p.b_id) OR (d.licensor_id = p.b_id AND d.licensee_id = p.a_id))
    ORDER BY d.announced_date DESC NULLS LAST
    LIMIT 1
  ) acq ON true;
$$;

REVOKE ALL ON FUNCTION public.radar_company_domain_members() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.radar_company_code_pairs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.radar_company_domain_members() TO service_role;
GRANT EXECUTE ON FUNCTION public.radar_company_code_pairs() TO service_role;

-- ── Families ─────────────────────────────────────────────────────────────

-- Connected components of accepted relations (merged rows followed to their survivor). The root is
-- a parent that is nobody's subsidiary, then large pharma, then a Latin-script name, then the
-- largest pipeline. Components above p_max_size are a chain of bad links: left standalone and
-- reported. Rows whose family changes have ownership re-derived on the next ownership run.
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
             AND coalesce(c1.company_type = 'large_pharma', false)
             AND coalesce(c2.company_type = 'large_pharma', false));
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
           (coalesce(s.is_parent, false) AND NOT coalesce(s.is_child, false)) DESC,
           (c.company_type = 'large_pharma') DESC NULLS LAST,
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
  'Recomputes companies.family_id from accepted company_relations (migration 193). Run after relation writes, before radar_refresh_programs.';
REVOKE ALL ON FUNCTION public.radar_refresh_company_families(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.radar_refresh_company_families(integer) TO service_role;

-- ── Family-aware derivations (bodies from 187 / 173 / 188 / 192 / 190) ──

CREATE OR REPLACE FUNCTION public.radar_refresh_programs()
 RETURNS jsonb
 LANGUAGE plpgsql
 SET statement_timeout TO '300s'
AS $function$
DECLARE
  v_changed integer := 0;
  v_programs integer := 0;
  i integer;
BEGIN
  -- 1. Identifiers per row. company_id here is the corporate family (migration 193): a
  --    subsidiary's or Chinese-name twin's rows group with the root's; member_id keeps the row's own company.
  DROP TABLE IF EXISTS tmp_pa;
  CREATE TEMP TABLE tmp_pa ON COMMIT DROP AS
  SELECT a.id, coalesce(c.family_id, a.company_id) AS company_id, a.company_id AS member_id,
         a.drug_master_id, a.asset_name, a.display_name, a.asset_aliases,
         a.phase, a.trial_count, a.last_update_date,
         public.radar_asset_identifiers(a.asset_name) AS toks,
         coalesce(dm.confidence, 0) AS dmc, dm.inn,
         (a.drug_master_id IS NOT NULL AND coalesce(dm.confidence, 0) >= 65
           AND length(coalesce(dm.inn, '')) >= 4
           AND position(lower(dm.inn) IN lower(a.asset_name)) > 0) AS names_inn,
         (a.asset_name ~* '[+,/;&]| and | plus | with |combin|followed by| or |together') AS is_combo
  FROM public.clinical_assets a
  LEFT JOIN public.companies c ON c.id = a.company_id
  LEFT JOIN public.drug_master dm ON dm.id = a.drug_master_id;

  DROP TABLE IF EXISTS tmp_trusted;
  CREATE TEMP TABLE tmp_trusted ON COMMIT DROP AS
  SELECT DISTINCT company_id, drug_master_id FROM tmp_pa WHERE names_inn AND company_id IS NOT NULL;

  -- 2. Background identifiers: used by more than three companies.
  DROP TABLE IF EXISTS tmp_df;
  CREATE TEMP TABLE tmp_df ON COMMIT DROP AS
  SELECT tok, count(DISTINCT company_id) AS df
  FROM tmp_pa, unnest(toks) tok WHERE company_id IS NOT NULL GROUP BY tok;
  CREATE INDEX ON tmp_df (tok);

  -- 3. Each row's program identifier: its first own identifier, else the
  --    trusted drug_master INN, else its first identifier.
  DROP TABLE IF EXISTS tmp_pb;
  CREATE TEMP TABLE tmp_pb ON COMMIT DROP AS
  SELECT a.*, o.own,
         CASE WHEN t.drug_master_id IS NOT NULL AND a.dmc >= 65
              THEN upper(regexp_replace(a.inn, '[^A-Za-z0-9]', '', 'g')) END AS grp,
         NULL::text AS tok
  FROM tmp_pa a
  LEFT JOIN LATERAL (
    SELECT array_agg(u.tok ORDER BY u.ord) FILTER (WHERE d.df <= 3) AS own
    FROM unnest(a.toks) WITH ORDINALITY u(tok, ord) JOIN tmp_df d ON d.tok = u.tok
  ) o ON true
  LEFT JOIN tmp_trusted t ON t.company_id = a.company_id AND t.drug_master_id = a.drug_master_id
  WHERE a.company_id IS NOT NULL;
  UPDATE tmp_pb SET tok = coalesce(own[1], grp, toks[1]);

  -- 4. Alias evidence within a company (weight: 3 parenthetical, 2 drug_master, 1 weak).
  DROP TABLE IF EXISTS tmp_ev;
  CREATE TEMP TABLE tmp_ev (company_id uuid, a text, b text, w int) ON COMMIT DROP;
  INSERT INTO tmp_ev
  SELECT b.company_id, l.t1, l.t2, 3
  FROM tmp_pb b CROSS JOIN LATERAL (
    SELECT (public.radar_asset_identifiers(m[1]))[1] AS t1, (public.radar_asset_identifiers(m[2]))[1] AS t2
    FROM regexp_matches(b.asset_name, '([A-Za-z0-9-]+(?: \d{2,7})?)\s*[(（]\s*([A-Za-z0-9 -]+?)\s*[,)）]', 'g') m
    WHERE cardinality(public.radar_asset_identifiers(m[1])) = 1
      AND cardinality(public.radar_asset_identifiers(m[2])) = 1
  ) l
  WHERE l.t1 <> l.t2;
  INSERT INTO tmp_ev
  SELECT company_id, tok, grp, 2 FROM tmp_pb WHERE grp IS NOT NULL AND tok <> grp AND NOT is_combo;
  INSERT INTO tmp_ev
  SELECT company_id, own[1], own[2], 1 FROM tmp_pb
  WHERE NOT is_combo AND cardinality(own) = 2 AND ((own[1] ~ '\d') <> (own[2] ~ '\d'));
  INSERT INTO tmp_ev
  SELECT b.company_id, b.toks[1], al.t, 1
  FROM tmp_pb b CROSS JOIN LATERAL (
    SELECT (public.radar_asset_identifiers(x))[1] AS t
    FROM unnest(b.asset_aliases) x
    WHERE x !~* '[+,/;&]| and | plus | with |combin'
      AND cardinality(public.radar_asset_identifiers(x)) = 1
  ) al
  WHERE cardinality(b.toks) = 1 AND NOT b.is_combo AND al.t <> b.toks[1]
    AND ((b.toks[1] ~ '\d') <> (al.t ~ '\d'));

  DROP TABLE IF EXISTS tmp_pw;
  CREATE TEMP TABLE tmp_pw ON COMMIT DROP AS
  SELECT company_id, least(a, b) AS a, greatest(a, b) AS b, sum(w) AS w, max(w) AS maxw
  FROM tmp_ev WHERE a <> b GROUP BY 1, 2, 3;

  -- Keep: INN-code links that are strong or the INN's best; code-code links
  -- only from parentheticals; INN-INN links (drug_master spellings).
  DROP TABLE IF EXISTS tmp_keep;
  CREATE TEMP TABLE tmp_keep ON COMMIT DROP AS
  WITH ic AS (
    SELECT company_id, a, b, maxw,
           row_number() OVER (PARTITION BY company_id, CASE WHEN a ~ '\d' THEN b ELSE a END
                              ORDER BY w DESC, CASE WHEN a ~ '\d' THEN a ELSE b END) AS rk
    FROM tmp_pw WHERE (a ~ '\d') <> (b ~ '\d')
  )
  SELECT company_id, a, b FROM ic WHERE rk = 1 OR maxw >= 2
  UNION SELECT company_id, a, b FROM tmp_pw WHERE a ~ '\d' AND b ~ '\d' AND maxw = 3
  UNION SELECT company_id, a, b FROM tmp_pw WHERE a !~ '\d' AND b !~ '\d';

  -- 5. Connected components by min-label propagation.
  DROP TABLE IF EXISTS tmp_lab;
  CREATE TEMP TABLE tmp_lab ON COMMIT DROP AS
  SELECT company_id, tok, tok AS lab
  FROM (SELECT company_id, a AS tok FROM tmp_keep UNION SELECT company_id, b FROM tmp_keep) x;
  CREATE INDEX ON tmp_lab (company_id, tok);
  DROP TABLE IF EXISTS tmp_edge;
  CREATE TEMP TABLE tmp_edge ON COMMIT DROP AS
  SELECT company_id, a, b FROM tmp_keep UNION SELECT company_id, b, a FROM tmp_keep;
  FOR i IN 1..8 LOOP
    UPDATE tmp_lab l SET lab = s.m
    FROM (
      SELECT e.company_id, e.a AS tok, min(l2.lab) AS m
      FROM tmp_edge e JOIN tmp_lab l2 ON l2.company_id = e.company_id AND l2.tok = e.b
      GROUP BY 1, 2
    ) s
    WHERE l.company_id = s.company_id AND l.tok = s.tok AND s.m < l.lab;
    EXIT WHEN NOT FOUND;
  END LOOP;
  -- An alias group this large is a chain of bad links, not one drug.
  UPDATE tmp_lab l SET lab = l.tok
  FROM (SELECT company_id, lab FROM tmp_lab GROUP BY 1, 2 HAVING count(*) > 5) big
  WHERE big.company_id = l.company_id AND big.lab = l.lab;

  -- 6. Keys: identifier programs, else the 156 key.
  DROP TABLE IF EXISTS tmp_programs;
  CREATE TEMP TABLE tmp_programs ON COMMIT DROP AS
  WITH k AS (
    SELECT a.id, a.company_id, a.member_id, a.asset_name, a.display_name, a.phase, a.trial_count, a.last_update_date,
           b.tok, coalesce(l.lab, b.tok) AS lab, b.grp, a.inn,
           CASE
             WHEN a.company_id IS NULL THEN 'a:' || a.id::text
             WHEN b.tok IS NOT NULL THEN a.company_id::text || ':t:' || coalesce(l.lab, b.tok)
             WHEN t.drug_master_id IS NOT NULL AND a.dmc >= 65
               THEN a.company_id::text || ':dm:' || a.drug_master_id::text
             WHEN public.radar_program_name_key(coalesce(a.display_name, a.asset_name)) IS NOT NULL
               THEN a.company_id::text || ':n:' || public.radar_program_name_key(coalesce(a.display_name, a.asset_name))
             ELSE a.company_id::text || ':a:' || a.id::text
           END AS program_key,
           CASE a.phase
             WHEN 'phase_4' THEN 9 WHEN 'phase_3' THEN 8 WHEN 'phase_2_3' THEN 7 WHEN 'phase_2' THEN 6
             WHEN 'phase_1_2' THEN 5 WHEN 'phase_1' THEN 4 WHEN 'early_phase_1' THEN 3 WHEN 'preclinical' THEN 2 ELSE 1 END AS phase_rank,
           COALESCE(a.trial_count, 0) AS trials
    FROM tmp_pa a
    LEFT JOIN tmp_pb b ON b.id = a.id
    LEFT JOIN tmp_lab l ON l.company_id = b.company_id AND l.tok = b.tok
    LEFT JOIN tmp_trusted t ON t.company_id = a.company_id AND t.drug_master_id = a.drug_master_id
  )
  SELECT k.*,
         row_number() OVER (PARTITION BY program_key ORDER BY phase_rank DESC, (member_id = company_id) DESC,
                                                              trials DESC, last_update_date DESC NULLS LAST, id) = 1 AS is_primary,
         count(*) OVER (PARTITION BY program_key) AS n_assets,
         sum(trials) OVER (PARTITION BY program_key) AS n_trials
  FROM k;

  -- 7. Program names. For identifier programs: "Inn (CODE)" from the alias
  --    group's most-used INN and code; otherwise the primary arm name without
  --    registry prefixes ("Drug:", "Investigational drug:").
  DROP TABLE IF EXISTS tmp_pn;
  CREATE TEMP TABLE tmp_pn ON COMMIT DROP AS
  WITH members AS (
    -- identifiers seen in each identifier program, with how they were written
    SELECT p.program_key, u.tok, public.radar_identifier_spelling(p.asset_name, u.tok) AS spelled
    FROM tmp_programs p
    CROSS JOIN LATERAL unnest(public.radar_asset_identifiers(p.asset_name)) u(tok)
    JOIN tmp_lab l ON l.company_id = p.company_id AND l.tok = u.tok AND l.lab = p.lab
    WHERE p.program_key LIKE '%:t:%'
    UNION ALL
    SELECT p.program_key, p.tok, public.radar_identifier_spelling(p.asset_name, p.tok)
    FROM tmp_programs p
    WHERE p.program_key LIKE '%:t:%' AND p.tok IS NOT NULL AND p.tok = ANY (public.radar_asset_identifiers(p.asset_name))
    UNION ALL
    SELECT p.program_key, p.grp, initcap(lower(p.inn))
    FROM tmp_programs p
    WHERE p.program_key LIKE '%:t:%' AND p.grp IS NOT NULL AND p.grp = p.lab
  ),
  best AS (
    SELECT program_key,
           (array_agg(spelled ORDER BY cnt DESC, spelled) FILTER (WHERE tok !~ '\d'))[1] AS inn,
           (array_agg(spelled ORDER BY cnt DESC, spelled) FILTER (WHERE tok ~ '\d'))[1] AS code
    FROM (SELECT program_key, tok, spelled, count(*) AS cnt FROM members GROUP BY 1, 2, 3) m
    GROUP BY program_key
  )
  SELECT p.id,
         CASE
           WHEN b.inn IS NOT NULL AND b.code IS NOT NULL THEN b.inn || ' (' || b.code || ')'
           WHEN coalesce(b.inn, b.code) IS NOT NULL THEN coalesce(b.inn, b.code)
           ELSE nullif(btrim(regexp_replace(prim.asset_name,
                  '^\s*((drug|biological|genetic|device|combination product|other|investigational (drug|product|medicinal product)|study drug)\s*[:：]\s*)+', '', 'i')), '')
         END AS program_name
  FROM tmp_programs p
  LEFT JOIN best b ON b.program_key = p.program_key
  LEFT JOIN tmp_programs prim ON prim.program_key = p.program_key AND prim.is_primary;

  UPDATE public.clinical_assets a
     SET program_key = p.program_key,
         program_primary = p.is_primary,
         program_assets = p.n_assets,
         program_trials = p.n_trials,
         program_name = n.program_name
    FROM tmp_programs p
    JOIN tmp_pn n ON n.id = p.id
   WHERE a.id = p.id
     AND (a.program_key IS DISTINCT FROM p.program_key
       OR a.program_primary IS DISTINCT FROM p.is_primary
       OR a.program_assets IS DISTINCT FROM p.n_assets
       OR a.program_trials IS DISTINCT FROM p.n_trials
       OR a.program_name IS DISTINCT FROM n.program_name);
  GET DIAGNOSTICS v_changed = ROW_COUNT;
  SELECT count(DISTINCT program_key) INTO v_programs FROM tmp_programs;
  RETURN jsonb_build_object('changed', v_changed, 'programs', v_programs);
END;
$function$;

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
         public.radar_has_dev_code(a.asset_name) AS has_code,
         -- migration 193: the holder's corporate family
         coalesce((SELECT hc.family_id FROM public.companies hc WHERE hc.id = a.company_id), a.company_id) AS family_key
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
           d.is_combination,
           coalesce(oc.family_id, d.originator_company_id) AS originator_family
    FROM cand c
    JOIN public.drug_master d ON d.id = c.drug_master_id
    LEFT JOIN public.companies oc ON oc.id = d.originator_company_id
  ),
  shared AS (
    -- another industry company outside the holder's family holds the same node
    SELECT c.id AS asset_id
    FROM cand c
    WHERE c.drug_master_id IS NOT NULL AND c.company_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.clinical_assets o
        JOIN public.companies oc ON oc.id = o.company_id AND oc.owner_type = 'industry'
        WHERE o.drug_master_id = c.drug_master_id AND o.company_id <> c.company_id
          AND coalesce(oc.family_id, oc.id) <> c.family_key)
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
        WHEN trusted_originator AND coalesce(same_family, false) THEN 'originator_match'
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
      'shared_with_other_companies', CASE WHEN d.rule = 'marketed_shared' THEN true END,
      'originator_in_family', CASE WHEN d.rule = 'originator_match' AND d.family_originator THEN true END
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
    -- migration 193: a large-pharma family makes its subsidiaries large pharma; families compare as owners
    SELECT a.id, a.company_id, a.drug_master_id, a.score_logit, a.partnership_status, a.partnership_basis,
           a.ownership_status,
           CASE WHEN fr.company_type = 'large_pharma' THEN 'large_pharma' ELSE c.company_type END AS company_type,
           dm.max_phase, dm.originator_company_id,
           coalesce(c.family_id, a.company_id) AS family_key,
           coalesce(oc.family_id, dm.originator_company_id) AS originator_family
    FROM public.clinical_assets a
    LEFT JOIN public.companies c ON c.id = a.company_id
    LEFT JOIN public.companies fr ON fr.id = c.family_id
    LEFT JOIN public.drug_master dm ON dm.id = a.drug_master_id
    LEFT JOIN public.companies oc ON oc.id = dm.originator_company_id
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
             CASE WHEN b.ownership_status IN ('unknown', 'licensee')
                   AND b.originator_company_id IS NOT NULL
                   AND b.originator_family IS DISTINCT FROM b.family_key
                   AND o.company_id IS NOT NULL THEN 'originator_elsewhere' END,
             CASE WHEN b.company_type = 'large_pharma' THEN 'large_pharma' END,
             CASE WHEN b.max_phase = 'approved' THEN 'approved_molecule' END,
             CASE WHEN b.ownership_status = 'licensee' THEN 'licensee' END,
             CASE WHEN b.partnership_status = 'partially_partnered' AND b.partnership_basis = 'deal_confirmed' THEN 'partial_deal' END
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

  -- Non-primary rows never appear in the feed; keep them unranked.
  UPDATE public.clinical_assets a
     SET score_rank = NULL, availability_reasons = NULL
   WHERE NOT a.program_primary AND (a.score_rank IS NOT NULL OR a.availability_reasons IS NOT NULL);

  RETURN jsonb_build_object('changed', v_changed);
END;
$function$;

CREATE OR REPLACE FUNCTION public.radar_link_deals()
 RETURNS jsonb
 LANGUAGE plpgsql
 SET statement_timeout TO '300s'
AS $function$
DECLARE
  v_linked integer := 0;
  v_created integer := 0;
  v_created_links integer := 0;
BEGIN
  DROP TABLE IF EXISTS tmp_dl_deals;
  CREATE TEMP TABLE tmp_dl_deals ON COMMIT DROP AS
  SELECT d.id, d.licensor_id,
         coalesce((SELECT lc.family_id FROM public.companies lc WHERE lc.id = d.licensor_id), d.licensor_id) AS licensor_family,
         d.asset_name, d.announced_date, d.source_url, d.press_release_url,
         d.phase_at_signing, d.modality, d.therapeutic_area, d.indication_specific, d.target,
         coalesce(nullif(d.raw_text_excerpt, ''), nullif(d.asset_description, ''), d.asset_name) AS excerpt,
         public.radar_asset_identifiers(d.asset_name) AS ids
  FROM public.deals d
  WHERE coalesce(d.is_canonical, true) AND NOT coalesce(d.is_synthetic, false)
    AND lower(coalesce(d.verification_status, '')) NOT IN ('rejected', 'flagged')
    AND d.deal_type IN ('license', 'option', 'collaboration')
    AND d.licensor_id IS NOT NULL;
  DELETE FROM tmp_dl_deals WHERE cardinality(ids) = 0;

  DROP TABLE IF EXISTS tmp_dl_pk;
  CREATE TEMP TABLE tmp_dl_pk ON COMMIT DROP AS
  SELECT DISTINCT a.company_id, coalesce(c.family_id, a.company_id) AS family_key, a.program_key,
         split_part(a.program_key, ':t:', 2) AS tok
  FROM public.clinical_assets a
  LEFT JOIN public.companies c ON c.id = a.company_id
  WHERE a.program_primary AND a.company_id IS NOT NULL AND a.program_key LIKE '%:t:%';
  CREATE INDEX ON tmp_dl_pk (family_key, tok);
  CREATE INDEX ON tmp_dl_pk (tok);

  -- 0. Program keys move when programs regroup (migration 187): repoint each
  --    link to the company's program that holds its identifier now.
  -- Families (migration 193) can fold two linked programs into one: drop the redundant link
  -- first (keeping the one already on that key), then re-key the rest.
  DROP TABLE IF EXISTS tmp_dl_rekey;
  CREATE TEMP TABLE tmp_dl_rekey ON COMMIT DROP AS
  SELECT DISTINCT ON (l2.id) l2.id, l2.deal_id, l2.program_key AS old_key, a.program_key AS new_key
  FROM public.radar_deal_program_links l2
  JOIN public.clinical_assets a
    ON a.company_id = l2.company_id AND a.program_key IS NOT NULL
   AND (a.program_key = l2.program_key
        OR a.deal_ids @> ARRAY[l2.deal_id]
        OR public.radar_asset_identifiers(a.asset_name) @> ARRAY[l2.identifier])
  ORDER BY l2.id, (a.program_key = l2.program_key) DESC, a.program_primary DESC;

  DELETE FROM public.radar_deal_program_links l
  USING (SELECT id, row_number() OVER (PARTITION BY deal_id, new_key ORDER BY (old_key = new_key) DESC, id) AS rn
         FROM tmp_dl_rekey) d
  WHERE l.id = d.id AND d.rn > 1;

  UPDATE public.radar_deal_program_links l
     SET program_key = r.new_key
    FROM tmp_dl_rekey r
   WHERE l.id = r.id AND r.old_key <> r.new_key
     AND NOT EXISTS (SELECT 1 FROM public.radar_deal_program_links o
                     WHERE o.deal_id = l.deal_id AND o.program_key = r.new_key AND o.id <> l.id);

  DROP TABLE IF EXISTS tmp_dl_new;
  CREATE TEMP TABLE tmp_dl_new (program_key text) ON COMMIT DROP;

  -- 1. The licensor's family already has the program (migration 193: a subsidiary or
  --    Chinese-name twin of the licensor holds it).
  WITH ins AS (
    INSERT INTO public.radar_deal_program_links (deal_id, company_id, program_key, identifier, method)
    SELECT DISTINCT ON (d.id, p.program_key) d.id, p.company_id, p.program_key, p.tok, 'program_identifier'
    FROM tmp_dl_deals d
    JOIN tmp_dl_pk p ON p.family_key = d.licensor_family AND p.tok = ANY (d.ids)
    ORDER BY d.id, p.program_key, (p.company_id = d.licensor_id) DESC
    ON CONFLICT (deal_id, program_key) DO NOTHING
    RETURNING program_key
  )
  INSERT INTO tmp_dl_new SELECT program_key FROM ins;
  GET DIAGNOSTICS v_linked = ROW_COUNT;

  -- 2. No company has it: one program per single-asset deal from an industry licensor.
  WITH candidates AS (
    SELECT d.*, c.name AS company_name
    FROM tmp_dl_deals d
    JOIN public.companies c ON c.id = d.licensor_id AND c.owner_type = 'industry' AND c.merged_into IS NULL
    WHERE cardinality(d.ids) = 1
      -- Clinical-stage deal assets are in the registries; when we cannot find one it is an alias
      -- gap (AG10 = acoramidis, ALN-TTR02 = patisiran), not a missing program.
      AND d.phase_at_signing IN ('preclinical', 'discovery')
      AND coalesce(d.source_url, d.press_release_url) ~ '^https?://'
      AND d.announced_date IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM tmp_dl_pk p WHERE p.tok = d.ids[1])
      AND NOT EXISTS (SELECT 1 FROM public.radar_deal_program_links l WHERE l.deal_id = d.id)
      -- A known alias of a drug some program already carries is the same drug under another name.
      AND NOT EXISTS (SELECT 1 FROM public.drug_aliases da JOIN public.clinical_assets a ON a.drug_master_id = da.drug_id
                      WHERE upper(regexp_replace(da.alias, '[^A-Za-z0-9]', '', 'g')) = d.ids[1])
  ),
  created AS (
    INSERT INTO public.clinical_assets (
      company_id, company_name, asset_name, asset_origin, phase, modality, therapeutic_area,
      indication_specific, target, deal_ids, disclosure_source_type, disclosure_url, disclosure_date,
      disclosure_excerpt, classification_status, ownership_status, ownership_evidence, confidence_score)
    SELECT DISTINCT ON (c.licensor_id, c.ids[1])
           c.licensor_id, c.company_name, btrim(c.asset_name), 'deal',
           CASE c.phase_at_signing
             WHEN 'discovery' THEN 'preclinical' WHEN 'preclinical' THEN 'preclinical'
             WHEN 'phase_1' THEN 'phase_1' WHEN 'phase_2' THEN 'phase_2' WHEN 'phase_3' THEN 'phase_3'
             WHEN 'approved' THEN 'phase_4' ELSE 'unknown' END,
           c.modality, c.therapeutic_area, c.indication_specific, c.target,
           ARRAY[c.id], 'deal', coalesce(c.source_url, c.press_release_url), c.announced_date,
           left(c.excerpt, 1000), 'unclassified', 'unknown',
           -- The deal names the licensor, but deal records sometimes invert the parties: keep the
           -- owner unverified until ownership attribution confirms it.
           jsonb_build_object('rule', 'deal_licensor', 'deal_id', c.id),
           -- A cited deal is a primary source like a filing (45); the scorer skips rows below 20.
           45
    FROM candidates c
    ORDER BY c.licensor_id, c.ids[1], c.announced_date DESC
    ON CONFLICT (company_name, asset_name) DO NOTHING
    RETURNING id, company_id, asset_name, deal_ids
  )
  INSERT INTO public.radar_deal_program_links (deal_id, company_id, program_key, identifier, method)
  SELECT c.deal_ids[1], c.company_id, c.company_id::text || ':t:' || (public.radar_asset_identifiers(c.asset_name))[1],
         (public.radar_asset_identifiers(c.asset_name))[1], 'deal_created'
  FROM created c
  ON CONFLICT (deal_id, program_key) DO NOTHING;
  GET DIAGNOSTICS v_created_links = ROW_COUNT;
  v_created := v_created_links;

  -- Re-check partnership on the programs that just gained a deal (next refresh run takes them as backlog).
  UPDATE public.clinical_assets a
     SET partnership_checked_at = NULL
   WHERE a.program_key IN (SELECT program_key FROM tmp_dl_new)
     AND a.partnership_checked_at IS NOT NULL;

  RETURN jsonb_build_object('linked_existing', v_linked, 'programs_created', v_created);
END;
$function$;

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
  SELECT a.id, a.company_id, coalesce(fc.family_id, a.company_id) AS family_key,
         a.drug_master_id, a.program_name, a.asset_name, a.ownership_status,
         a.partnership_basis, a.classification_status, a.therapeutic_area, a.originator_region,
         a.nct_ids, a.disclosure_url, a.score_rank
  FROM public.clinical_assets a
  LEFT JOIN public.companies fc ON fc.id = a.company_id
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
      -- Only deals that name a drug can link to a program (platform and undisclosed-target deals cannot).
      AND cardinality(public.radar_asset_identifiers(d.asset_name)) > 0
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
                              -- same name within one corporate family (migration 193)
                              + (count(*) - count(DISTINCT family_key::text || lower(coalesce(program_name, asset_name)))) FROM top1k),
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
    'deals_12m_all', (SELECT count(*) FROM public.deals d WHERE coalesce(d.is_canonical, true) AND NOT coalesce(d.is_synthetic, false)
                      AND d.announced_date >= current_date - 365 AND d.deal_type IN ('license', 'option', 'collaboration')),
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

-- Migration 192 created deal-only programs with the column default confidence_score 0, which keeps
-- them out of the scoring queue (confidence_score >= 20). Give them the filing level.
UPDATE public.clinical_assets SET confidence_score = 45
WHERE asset_origin = 'deal' AND coalesce(confidence_score, 0) < 20;
