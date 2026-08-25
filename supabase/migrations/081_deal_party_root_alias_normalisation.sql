-- Migration 081 — entity-name normalisation for the dedupe key (R79c)
--
-- Proportional banding (080) fixed value-side fragmentation but clusters were
-- still splitting on the party name. The same counterparty arrives as
-- "Bristol Myers Squibb", "Bristol-Myers Squibb" and "BMS"; splitting on the
-- first whitespace token yields 'bristol', 'bristol-myers' and 'bms', so one
-- transaction lands in three clusters. Hengrui/BMS was 13 rows across 8 groups.
--
-- Two changes: punctuation is flattened to whitespace before tokenising, and a
-- small alias table folds the abbreviations that actually occur in this corpus.
-- Deliberately conservative — only unambiguous, observed aliases. Extend it as
-- new fragmentation shows up in scripts/audit-deal-quality.sql.

CREATE OR REPLACE FUNCTION deal_party_root(name TEXT) RETURNS TEXT
LANGUAGE sql IMMUTABLE AS $fn$
  WITH tok AS (
    SELECT split_part(
      btrim(regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(lower(coalesce(name,'')), '\(.*?\)', ' ', 'g'),
            '[^a-z0-9]+', ' ', 'g'),
          '\y(pharmaceuticals?|pharma|medicines?|medicine|biosciences?|biologics|biotech|bio|therapeutics|sciences|inc|ltd|limited|llc|co|corp|corporation|company|group|holdings|ag|sa|nv|plc|gmbh|kk)\y',
          ' ', 'g'),
        '\s+', ' ', 'g')),
      ' ', 1) AS t
  )
  SELECT CASE t
    WHEN 'bms'          THEN 'bristol'
    WHEN 'bristolmyers' THEN 'bristol'
    WHEN 'az'           THEN 'astrazeneca'
    WHEN 'jnj'          THEN 'johnson'
    WHEN 'j'            THEN 'johnson'
    WHEN 'msd'          THEN 'merck'
    WHEN 'eli'          THEN 'lilly'
    WHEN 'glaxosmithkline' THEN 'gsk'
    WHEN 'boehringer'   THEN 'boehringer'
    WHEN 'jiangsu'      THEN 'hengrui'
    WHEN 'shenyang'     THEN '3sbio'
    WHEN 'sunshine'     THEN '3sbio'
    ELSE t
  END FROM tok;
$fn$;

COMMENT ON FUNCTION deal_party_root(TEXT) IS
  'R79c: reduces a company name to a normalised root token. Flattens punctuation, strips corporate suffixes, folds observed abbreviations (BMS->bristol, MSD->merck, Jiangsu Hengrui->hengrui, Shenyang Sunshine/Sunshine Guojian->3sbio). Conservative and alias-driven; extend only with unambiguous cases.';
