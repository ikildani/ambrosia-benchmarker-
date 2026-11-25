-- 197c: programs split by drug_master spellings.
--
-- Why (Nov 23 2026): radar_refresh_programs trusts a row's drug_master INN only when the INN appears
-- in the row's name. drug_master often has no inn (only preferred_name: Rimiducid, Deupirfenidone,
-- Fasiglifam, Ropeginterferon Alfa-2B) or carries the salt ("troriluzole hydrochloride"), so a
-- company's "Troriluzole" and "TRORILUZOLE" rows, or "Rimiducid" and "AP1903", stayed two programs
-- (Biohaven troriluzole is one of the 15 top-1,000 duplicates). About 700 identifier programs share a
-- family and a drug with a name-keyed program; 159 of those are an exact name/identifier match.
--
-- Changes against migration 194: the INN is radar_inn_core(inn or INN-shaped preferred_name), and a
-- row without an identifier whose whole name equals an identifier of the same family joins that
-- program. Precision guard kept: the INN must still appear in the row's own name, so a wrong
-- drug_master link ("Pirfenidone" linked to atezolizumab) never merges anything.
--
-- Rollout: apply after 197b; then radar_refresh_programs() and radar_refresh_score_percentiles() with
-- a 20-minute session statement_timeout (regroup write). Idempotent.

CREATE OR REPLACE FUNCTION public.radar_inn_core(p text)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
  SELECT nullif(btrim(regexp_replace(lower(btrim(coalesce(p, ''))),
    '\s+(hydrochloride|dihydrochloride|hcl|mesylate|mesilate|dimesylate|besylate|besilate|tosylate|maleate|fumarate|succinate|tartrate|bitartrate|citrate|phosphate|sulfate|sulphate|sodium|disodium|potassium|calcium|magnesium|acetate|bromide|chloride|hydrobromide|malate|lactate|free base)(\s+(monohydrate|dihydrate|trihydrate|hemihydrate|hydrate|anhydrous))?$',
    '')), '');
$$;

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
         coalesce(dm.confidence, 0) AS dmc, dmi.inn,
         (a.drug_master_id IS NOT NULL AND coalesce(dm.confidence, 0) >= 65
           AND length(coalesce(dmi.inn, '')) >= 4
           AND position(dmi.inn IN lower(a.asset_name)) > 0) AS names_inn,
         (a.asset_name ~* '[+,/;&]| and | plus | with |combin|followed by| or |together') AS is_combo
  FROM public.clinical_assets a
  LEFT JOIN public.companies c ON c.id = a.company_id
  LEFT JOIN public.drug_master dm ON dm.id = a.drug_master_id
  -- migration 197c: the drug's INN without its salt ("troriluzole hydrochloride" -> troriluzole), and
  -- an INN-shaped preferred name when drug_master has no inn (Rimiducid, Deupirfenidone, Fasiglifam).
  LEFT JOIN LATERAL (
    SELECT public.radar_inn_core(coalesce(dm.inn,
             CASE WHEN lower(dm.preferred_name) ~ '^[a-z]{5,}( [a-z]+(-[0-9][a-z])?)?$' THEN dm.preferred_name END)) AS inn
  ) dmi ON true;

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
  UPDATE tmp_pb SET tok = coalesce(own[1], grp, toks[1]) WHERE true;
  -- migration 197c: a row with no identifier whose whole name is another program's identifier in the
  -- same family joins it ("Troriluzole" next to "TRORILUZOLE": 159 split programs on Nov 23 2026).
  UPDATE tmp_pb b SET tok = m.tok
    FROM (SELECT DISTINCT company_id, tok FROM tmp_pb WHERE tok IS NOT NULL) m
   WHERE b.tok IS NULL
     AND m.company_id = b.company_id
     AND m.tok = upper(public.radar_program_name_key(coalesce(b.display_name, b.asset_name)));

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
