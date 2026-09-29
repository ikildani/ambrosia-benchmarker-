-- 152: deal_party_root() — non-Latin names keep their own root; Merck KGaA is not Merck & Co.
-- Why (Sep 28 2026): stripping [^a-z0-9] left an empty root for every Chinese-, Japanese- or
-- Korean-script party, so all of them shared one dedupe group (Jiluntai → Baiyang was grouped
-- with Chengdu Guowei → Salubris). 'Merck KGaA, Darmstadt' and 'Merck & Co.' both rooted to
-- 'merck', so a Hengrui deal with each landed in one group.
-- Applied to prod via MCP on Sep 28 2026; this file records it.
CREATE OR REPLACE FUNCTION public.deal_party_root(name text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH src AS (
    SELECT lower(coalesce(name,'')) AS n
  ), tok AS (
    SELECT n, split_part(
      btrim(regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(n, '\(.*?\)', ' ', 'g'),
            '[^a-z0-9]+', ' ', 'g'),
          '\y(pharmaceuticals?|pharma|medicines?|medicine|biosciences?|biologics|biotech|bio|therapeutics|sciences|inc|ltd|limited|llc|co|corp|corporation|company|group|holdings|ag|sa|nv|plc|gmbh|kk)\y',
          ' ', 'g'),
        '\s+', ' ', 'g')),
      ' ', 1) AS t
    FROM src
  )
  SELECT CASE
    WHEN t = 'merck' AND (n ~ 'kgaa|darmstadt|emd serono') THEN 'merckkgaa'
    WHEN t = 'emd' THEN 'merckkgaa'
    WHEN t = 'bms'          THEN 'bristol'
    WHEN t = 'bristolmyers' THEN 'bristol'
    WHEN t = 'az'           THEN 'astrazeneca'
    WHEN t = 'jnj'          THEN 'johnson'
    WHEN t = 'j'            THEN 'johnson'
    WHEN t = 'msd'          THEN 'merck'
    WHEN t = 'eli'          THEN 'lilly'
    WHEN t = 'glaxosmithkline' THEN 'gsk'
    WHEN t = 'boehringer'   THEN 'boehringer'
    WHEN t = 'jiangsu'      THEN 'hengrui'
    WHEN t = 'shenyang'     THEN '3sbio'
    WHEN t = 'sunshine'     THEN '3sbio'
    WHEN t = '' THEN left(regexp_replace(btrim(n), '\s+', '', 'g'), 24)
    ELSE t
  END FROM tok;
$function$;
