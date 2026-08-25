-- Migration 084b — replace the verified-requires-citation CHECK with a trigger
--
-- The NOT VALID CHECK added in 084 was the wrong mechanism. A NOT VALID
-- constraint still evaluates on any UPDATE of a violating row, including an
-- UPDATE that does not touch the constrained columns. recompute_deal_dedupe()
-- writes dedupe_group_id across every row, so it began failing on the 408
-- legacy uncited rows the constraint was explicitly meant to grandfather.
--
-- A trigger expresses the actual intent: block the TRANSITION into an uncited
-- verified state, and block stripping a citation off a verified row, while
-- letting pre-existing violations flow through untouched until re-verified.

ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_verified_requires_citation;

CREATE OR REPLACE FUNCTION deals_require_citation_when_verified() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
BEGIN
  IF NEW.verification_status = 'verified'
     AND NEW.source_url IS NULL
     AND NEW.press_release_url IS NULL
     AND NEW.source_filing_id IS NULL
  THEN
    -- Grandfather: the row was already verified-and-uncited before this
    -- statement, and this statement is not what made it so.
    IF TG_OP = 'UPDATE'
       AND OLD.verification_status = 'verified'
       AND OLD.source_url IS NULL
       AND OLD.press_release_url IS NULL
       AND OLD.source_filing_id IS NULL
    THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION
      'deal % cannot be marked verified without a citation (source_url, press_release_url or source_filing_id)',
      coalesce(NEW.id::text, '(new)')
      USING ERRCODE = 'check_violation',
            HINT = 'Record the primary source, or use verification_status = ''pending''.';
  END IF;
  RETURN NEW;
END $fn$;

DROP TRIGGER IF EXISTS trg_deals_require_citation ON deals;
CREATE TRIGGER trg_deals_require_citation
  BEFORE INSERT OR UPDATE ON deals
  FOR EACH ROW EXECUTE FUNCTION deals_require_citation_when_verified();

COMMENT ON FUNCTION deals_require_citation_when_verified() IS
  'R79f (2026-08-25): blocks new verified-without-citation rows and blocks removing a citation from a verified row. Pre-existing uncited verified rows pass through until re-verified by the R79g workstream. Replaces the NOT VALID CHECK from 084, which fired on unrelated UPDATEs.';
