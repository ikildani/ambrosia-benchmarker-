-- 145: classification coverage measured on the core universe.
--
-- Classification runs on the core universe by decision (industry sponsor,
-- unpartnered or partially partnered, pre-approval phase, ownership not
-- comparator / marketed elsewhere); Phase 4 and marketed-elsewhere rows are
-- left unclassified on purpose (?scope=all restores them). The QA gate's
-- classification_coverage still divided by every industry asset, so it
-- reported a blocker (68%) while the default view was at 91% classified
-- with nothing left in the queue. This function gives the gate the same
-- denominator the queue uses; p_phases is passed from CORE_UNIVERSE_PHASES.

CREATE OR REPLACE FUNCTION radar_qa_core_classification(p_phases TEXT[])
RETURNS JSONB
LANGUAGE sql
STABLE
SET statement_timeout TO '120s'
AS $$
  WITH core AS (
    SELECT a.classification_status
    FROM clinical_assets a
    JOIN companies c ON c.id = a.company_id
    WHERE c.owner_type = 'industry'
      AND a.partnership_status IN ('unpartnered', 'partially_partnered')
      AND a.phase = ANY(p_phases)
      AND COALESCE(a.ownership_status, 'unknown') NOT IN ('comparator_or_background', 'marketed_other')
  )
  SELECT jsonb_build_object(
    'total',        COUNT(*),
    'classified',   COUNT(*) FILTER (WHERE classification_status = 'classified'),
    'skipped',      COUNT(*) FILTER (WHERE classification_status = 'skipped'),
    'needs_review', COUNT(*) FILTER (WHERE classification_status = 'needs_review'),
    'unclassified', COUNT(*) FILTER (WHERE classification_status = 'unclassified')
  )
  FROM core;
$$;
