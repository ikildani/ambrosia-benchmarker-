-- 187: one program per drug, whatever the registry called the arm.
--
-- Migration 156 grouped a company's rows into programs by drug_master_id, or
-- by the alphanumeric name when the drug was unresolved. Registry arm names
-- defeat the name key: "Investigational drug: HLX37 dose1", "HLX37 dose2" and
-- "HLX37" were three programs; Akeso's ivonescimab appeared as "AK112",
-- "Ivonescimab, docetaxel", "AK112, Gemcitabine, Cisplatin" and more, five of
-- the feed's top fifteen rows.
--
-- Programs are now keyed on the drug's identifier, read from the arm name:
--   * identifiers are development codes (HLX37, PF-07104091, BI 10773, 4D-150)
--     and INN-shaped names (-mab, -nib, -cept, ...), in the order they appear;
--   * an identifier used by more than three companies is background therapy
--     (pembrolizumab, carboplatin, MK-3475 in a partner's combination) and is
--     skipped, so "JS207 + docetaxel" belongs to JS207;
--   * aliases join a code and its INN within a company: "INN (CODE)"
--     parentheticals, trusted drug_master groups, single-agent names and
--     asset_aliases. A weak alias may attach an INN to only its best code, and
--     an alias group over five identifiers is discarded as a chain error.
-- Rows with no identifier keep the 156 key. program_name is the clean label
-- for the program ("Ivonescimab (AK112)", "HLX37").
--
-- Dry run on production (Nov 16): 151,182 -> ~140,400 programs; scored
-- industry programs in the feed 51,537 -> 44,264 (-14%). Apply after 186.
-- Idempotent; the next radar_refresh_score_percentiles() run applies it.

ALTER TABLE public.clinical_assets ADD COLUMN IF NOT EXISTS program_name text;

COMMENT ON COLUMN public.clinical_assets.program_name IS
  'Clean program label (INN (CODE), or the code, or the primary arm name without registry prefixes); migration 187.';
COMMENT ON COLUMN public.clinical_assets.program_key IS
  'company_id:t:<identifier> (drug code or INN, aliases joined), else company_id:dm:<drug_master_id> / :n:<name> / :a:<asset id>; migrations 156, 187.';

-- Ordered drug identifiers in an arm name, normalized (upper case, no hyphen
-- or space): development codes and INN-shaped words.
CREATE OR REPLACE FUNCTION public.radar_asset_identifiers(p text)
 RETURNS text[]
 LANGUAGE sql
 IMMUTABLE PARALLEL SAFE
AS $f$
 WITH n AS (
   -- "BI 10773", "ARQ 197" -> one token
   SELECT regexp_replace(coalesce(p, ''), '(^|[^A-Za-z0-9])([A-Z]{1,6}) (\d{2,7})(?![A-Za-z0-9])', '\1\2\3', 'g') AS s
 ),
 w0 AS (
   SELECT trim(both '-' FROM word) AS word, ord
   FROM n, regexp_split_to_table(n.s, '[^A-Za-z0-9-]+') WITH ORDINALITY t(word, ord)
 ),
 w AS (
   -- "mRNA-3927", "XmAb24306" -> upper case before matching
   SELECT CASE WHEN word ~ '^[A-Za-z]{2,6}-?\d' AND word ~ '^[A-Za-z]*[a-z][A-Z]' THEN upper(word) ELSE word END AS word, ord
   FROM w0 WHERE word <> ''
 ),
 x AS (
   SELECT ord, word,
          substring(word FROM '(?:^|[^A-Za-z0-9])([0-9][A-Z]{1,3}-?\d{2,5}|[A-Z]{2,6}-?\d{2,7}(?:[A-Z]{1,2}(?![a-z]))?|[A-Z]-?\d{4,7}(?:[A-Z]{1,2}(?![a-z]))?)(?![0-9])') AS code,
          coalesce(substring(word FROM '(?:^|[^A-Za-z0-9])([A-Z]{2,6})-?\d'), '') AS pre
   FROM w
 ),
 c AS (
   SELECT ord,
     CASE
       WHEN code IS NOT NULL AND pre !~ '^(CD|IL|PD|HER|GLP|FGF|VEGF|HPV|COVID|SARS|CTLA|TNF|IGF|TLR|CCR|CXCR|HLA|JAK|CDK|BTK|EGFR|MDI|NCT|CTR|KRAS|BRCA|HBV|HCV|HIV|USP|FDA|CYP|MAGE|NY|ESO|GD|MUC|DLL|FLT|ALK|ROS|MET|SSTR|PSMA|CA|PDL|TIGIT|LAG|TIM|OX|CCL|CXCL|HSP|MMP|PI|AKT|MEK|ERK|IDH|FGFR|PARP|STAT|SHP|BCL|MCL|IRAK|NLRP|TYK|BMP|TGF|GPR|SGLT|DPP|PCSK|APO|LP|TRK|NTRK|RET|SIRP|CEA|EPCAM|PEG|COX|WHO|ISO|IU|MG|ML|DAY|WEEK|PHASE|PART|ARM|COHORT|STEP|STAGE|GROUP|LEVEL|DOSE|FORM|TEST|BATCH|LOT|PH|UK|US|EU|AAV|DNA|RNA|HFA|DPI|PMDI|IR|MR|XR|ER|SR|CR|SC|IV|QD|BID|TID|QW|VG|AS|ICS|LABA|LAMA|GM|CMV|EBV|RSV|HSV|ATC|ICD|SNOMED|MEDDRA|ECOG|NYHA|GOLD|CTCAE|RECIST|WT|MT|DS|PS|PO|IM|IT|ID)$'
         THEN upper(replace(code, '-', ''))
       WHEN length(word) >= 7
        AND lower(word) ~ '^[a-z]+(mab|cept|nib|ciclib|parib|lisib|tide|leucel|gene|vec|stat|vir|mig|tug|platin|taxel|rubicin|tecan|limus|degib|siran|rsen|lukast|sartan|gliflozin|gliptin|glutide|parin|stim|fusp|dronate|xaban|gatran|vastatin|setron|triptan|pitant|azole|mycin|cillin|floxacin|zomib|relin|kinra|alfa|ucel|temcel|dencel|abine|domide|mustine|trexed|poetin|ermin|plase)$'
        AND lower(word) NOT IN ('peptide', 'peptides', 'polypeptide', 'nucleotide', 'oligonucleotide', 'dinucleotide', 'transgene', 'oncogene', 'autoleucel', 'thermostat')
         THEN upper(word)
     END AS tok
   FROM x
 )
 SELECT coalesce(array_agg(tok ORDER BY ord) FILTER (WHERE tok IS NOT NULL), '{}') FROM c
$f$;

COMMENT ON FUNCTION public.radar_asset_identifiers(text) IS
  'Ordered drug identifiers (development codes, INN-shaped words) in an arm name, normalized; migration 187.';

-- How a normalized code was written in a name ("MCLA158" -> "MCLA-158").
CREATE OR REPLACE FUNCTION public.radar_identifier_spelling(p_name text, p_tok text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE PARALLEL SAFE
AS $f$
 SELECT CASE
   WHEN p_tok IS NULL THEN NULL
   WHEN p_tok !~ '\d' THEN initcap(lower(p_tok))
   ELSE coalesce(
     substring(p_name FROM '(?i)(?:^|[^A-Za-z0-9])(' ||
       regexp_replace(p_tok, '^([0-9]?[A-Z]+)(\d+)([A-Z]*)$', '\1[- ]?\2\3') || ')(?![0-9])'),
     p_tok)
 END
$f$;

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
  -- 1. Identifiers per row.
  DROP TABLE IF EXISTS tmp_pa;
  CREATE TEMP TABLE tmp_pa ON COMMIT DROP AS
  SELECT a.id, a.company_id, a.drug_master_id, a.asset_name, a.display_name, a.asset_aliases,
         a.phase, a.trial_count, a.last_update_date,
         public.radar_asset_identifiers(a.asset_name) AS toks,
         coalesce(dm.confidence, 0) AS dmc, dm.inn,
         (a.drug_master_id IS NOT NULL AND coalesce(dm.confidence, 0) >= 65
           AND length(coalesce(dm.inn, '')) >= 4
           AND position(lower(dm.inn) IN lower(a.asset_name)) > 0) AS names_inn,
         (a.asset_name ~* '[+,/;&]| and | plus | with |combin|followed by| or |together') AS is_combo
  FROM public.clinical_assets a
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
    SELECT a.id, a.company_id, a.asset_name, a.display_name, a.phase, a.trial_count, a.last_update_date,
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
         row_number() OVER (PARTITION BY program_key ORDER BY phase_rank DESC, trials DESC, last_update_date DESC NULLS LAST, id) = 1 AS is_primary,
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
