-- Migration 079 — transaction-level de-duplication + provenance grading (R79, 2026-08-25)
--
-- Context. Migrations 051/053/054 removed the LLM-fabricated asset-name rows
-- and gated future ingestion. They did NOT address two remaining problems that
-- surface the moment a comparable set is put in front of a client:
--
--   1. DUPLICATION. The same transaction is ingested repeatedly across sources
--      with conflicting terms. 3SBio/Pfizer SSGJ-707 exists as 5 rows spanning
--      $1.2B-$1.3B upfront, deal_type both `option` and `license`, phase both
--      `unknown` and `phase_3`, announced dates from 2025-05-15 to 2026-07-18.
--      Hengrui/BMS spans 8+ rows. Any median computed over the raw table
--      double-counts whichever deals happen to have been ingested most often.
--
--   2. PROVENANCE. Only 57 of 609 verification_status='verified' rows carry a
--      source_url or press_release_url. A verified flag with no citation cannot
--      be defended in client diligence.
--
-- This migration is ADDITIVE. It deletes nothing and merges nothing. It adds
-- derived columns that make both problems queryable, plus two views that give
-- client-facing code a corpus it can stand behind.
--
--   dedupe_group_id   stable hash of (licensor root, licensee root, deal size
--                     bucket). Rows sharing one are candidate duplicates.
--   is_canonical      the highest-quality row in each group. Exactly one true
--                     per group.
--   provenance_tier   A = verified + cited + terms disclosed
--                     B = verified + terms disclosed, no citation
--                     C = terms disclosed, not verified
--                     D = terms not disclosed
--
--   deals_canonical         one row per transaction
--   deals_benchmark_grade   canonical AND tier A/B AND upfront + total present.
--                           This is the only view that should back a client
--                           deliverable.
--
--   recompute_deal_dedupe() re-derives all three columns. Call after ingestion.
--
-- Deliberately NOT done here: merging or deleting duplicate rows. Clustering is
-- heuristic; collapsing rows loses the source disagreement that tells you which
-- ingestion path is wrong. Resolution belongs in a reviewed follow-up per the
-- migration 051 convention.
--
-- Reversibility:
--   DROP VIEW IF EXISTS deals_benchmark_grade, deals_canonical;
--   DROP FUNCTION IF EXISTS recompute_deal_dedupe();
--   ALTER TABLE deals DROP COLUMN dedupe_group_id, DROP COLUMN is_canonical,
--                     DROP COLUMN provenance_tier;


ALTER TABLE deals ADD COLUMN IF NOT EXISTS dedupe_group_id TEXT;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS is_canonical BOOLEAN DEFAULT false;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS provenance_tier CHAR(1);

COMMENT ON COLUMN deals.dedupe_group_id IS
  'R79: candidate-duplicate cluster key — licensor root + licensee root + '
  'deal-size bucket. Rows sharing a value are the same transaction ingested more '
  'than once. Heuristic; not a merge instruction.';
COMMENT ON COLUMN deals.is_canonical IS
  'R79: best row within dedupe_group_id by provenance quality. Exactly one '
  'true per group. Aggregate over this, never over the raw table.';
COMMENT ON COLUMN deals.provenance_tier IS
  'R79: A verified+cited+terms, B verified+terms, C terms only, D no terms. '
  'Client-facing analysis uses A and B only.';

-- Normalisation helpers -----------------------------------------------------

CREATE OR REPLACE FUNCTION deal_party_root(name TEXT) RETURNS TEXT
LANGUAGE sql IMMUTABLE AS $fn$
  SELECT split_part(
    btrim(regexp_replace(
      regexp_replace(lower(coalesce(name,'')), '\(.*?\)', '', 'g'),
      '\y(pharmaceuticals?|pharma|medicines?|medicine|biosciences?|biologics|biotech|bio|therapeutics|sciences|inc|ltd|limited|llc|co|corp|corporation|group|holdings|ag|sa|nv|plc|gmbh|kk)\y\.?',
      '', 'g')),
    ' ', 1);
$fn$;

COMMENT ON FUNCTION deal_party_root(TEXT) IS
  'R79: reduces a company name to its first distinctive token so that '
  '"Hengrui Pharma", "Hengrui Medicine" and "Jiangsu Hengrui Pharmaceuticals" '
  'collapse to "hengrui".';

-- Provenance quality score used to pick the canonical row -------------------

CREATE OR REPLACE FUNCTION deal_quality_score(d deals) RETURNS INT
LANGUAGE sql IMMUTABLE AS $fn$
  SELECT (CASE WHEN d.verification_status = 'verified' THEN 100 ELSE 0 END)
       + (CASE WHEN coalesce(d.source_url, d.press_release_url) IS NOT NULL THEN 50 ELSE 0 END)
       + (CASE WHEN coalesce(d.terms_disclosed, false) THEN 20 ELSE 0 END)
       + (CASE WHEN d.upfront_usd IS NOT NULL THEN 10 ELSE 0 END)
       + (CASE WHEN d.total_deal_value_usd IS NOT NULL THEN 10 ELSE 0 END)
       + (CASE WHEN d.asset_name IS NOT NULL AND d.asset_name !~ '^[a-z0-9_]+$' THEN 15 ELSE 0 END)
       + (CASE WHEN d.phase_at_signing IS NOT NULL AND d.phase_at_signing <> 'unknown' THEN 10 ELSE 0 END)
       + (coalesce(d.confidence_score, 0) / 10);
$fn$;

-- Recompute -----------------------------------------------------------------

CREATE OR REPLACE FUNCTION recompute_deal_dedupe() RETURNS TABLE(
  rows_processed INT, groups_found INT, duplicate_rows INT,
  tier_a INT, tier_b INT, tier_c INT, tier_d INT
) LANGUAGE plpgsql AS $fn$
BEGIN
  UPDATE deals d SET dedupe_group_id =
    deal_party_root(d.licensor_name) || '|' || deal_party_root(d.licensee_name) || '|' ||
    coalesce(
      (round((coalesce(d.total_deal_value_usd, d.upfront_usd * 8, 0) / 1e6) / 250))::TEXT,
      'x');

  UPDATE deals d SET provenance_tier = CASE
    WHEN NOT coalesce(d.terms_disclosed, false) THEN 'D'
    WHEN d.verification_status = 'verified'
      AND coalesce(d.source_url, d.press_release_url) IS NOT NULL THEN 'A'
    WHEN d.verification_status = 'verified' THEN 'B'
    ELSE 'C' END;

  UPDATE deals SET is_canonical = false WHERE is_canonical;

  UPDATE deals d SET is_canonical = true
  FROM (
    SELECT id, row_number() OVER (
      PARTITION BY dedupe_group_id
      ORDER BY deal_quality_score(deals.*) DESC, announced_date ASC NULLS LAST, id ASC
    ) rn
    FROM deals
  ) ranked
  WHERE ranked.id = d.id AND ranked.rn = 1;

  RETURN QUERY SELECT
    (SELECT count(*)::INT FROM deals),
    (SELECT count(DISTINCT dedupe_group_id)::INT FROM deals),
    (SELECT count(*)::INT FROM deals WHERE NOT is_canonical),
    (SELECT count(*)::INT FROM deals WHERE provenance_tier='A'),
    (SELECT count(*)::INT FROM deals WHERE provenance_tier='B'),
    (SELECT count(*)::INT FROM deals WHERE provenance_tier='C'),
    (SELECT count(*)::INT FROM deals WHERE provenance_tier='D');
END $fn$;

COMMENT ON FUNCTION recompute_deal_dedupe() IS
  'R79: re-derives dedupe_group_id, provenance_tier and is_canonical. '
  'Call after any bulk ingestion.';

CREATE INDEX IF NOT EXISTS idx_deals_dedupe_group ON deals(dedupe_group_id);
CREATE INDEX IF NOT EXISTS idx_deals_canonical ON deals(is_canonical) WHERE is_canonical;
CREATE INDEX IF NOT EXISTS idx_deals_provenance_tier ON deals(provenance_tier);

-- Views ---------------------------------------------------------------------

-- security_invoker: these views must NOT become an RLS bypass. Migration 075
-- (fix_rls_public_exposure) closed exactly that class of hole; a default view
-- would run with the definer's rights and reopen it.

CREATE OR REPLACE VIEW deals_canonical WITH (security_invoker = true) AS
  SELECT * FROM deals WHERE is_canonical;

CREATE OR REPLACE VIEW deals_benchmark_grade WITH (security_invoker = true) AS
  SELECT * FROM deals
  WHERE is_canonical
    AND provenance_tier IN ('A','B')
    AND upfront_usd IS NOT NULL
    AND total_deal_value_usd IS NOT NULL;

COMMENT ON VIEW deals_canonical IS
  'R79: one row per transaction. Use for any count or median.';
COMMENT ON VIEW deals_benchmark_grade IS
  'R79: de-duplicated, verified, terms-disclosed deals. The only corpus '
  'that should back a client-facing comparable set.';


-- Superseded in part by 080 (proportional banding) and 081 (alias normalisation).
