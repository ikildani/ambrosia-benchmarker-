-- Radar dashboard stats: RPC functions for aggregate breakdowns.
-- Used by /api/radar/stats to power summary cards and filter counts.

-- ══════════════════════════════════════════════════════════════════════
-- TA BREAKDOWN
-- ══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION radar_ta_breakdown()
RETURNS TABLE(therapeutic_area TEXT, total BIGINT, unpartnered BIGINT) AS $$
  SELECT
    therapeutic_area,
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE partnership_status IN ('unpartnered', 'partially_partnered')) AS unpartnered
  FROM clinical_assets
  WHERE therapeutic_area IS NOT NULL
  GROUP BY therapeutic_area
  ORDER BY total DESC;
$$ LANGUAGE sql STABLE;

-- ══════════════════════════════════════════════════════════════════════
-- PHASE BREAKDOWN
-- ══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION radar_phase_breakdown()
RETURNS TABLE(phase TEXT, total BIGINT, unpartnered BIGINT) AS $$
  SELECT
    phase,
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE partnership_status IN ('unpartnered', 'partially_partnered')) AS unpartnered
  FROM clinical_assets
  WHERE phase IS NOT NULL AND phase != 'unknown'
  GROUP BY phase
  ORDER BY
    CASE phase
      WHEN 'Early Phase 1' THEN 1 WHEN 'Phase 1' THEN 2
      WHEN 'Phase 1/Phase 2' THEN 3 WHEN 'Phase 2' THEN 4
      WHEN 'Phase 2/Phase 3' THEN 5 WHEN 'Phase 3' THEN 6
      WHEN 'Phase 4' THEN 7 WHEN 'Approved' THEN 8
      ELSE 9
    END;
$$ LANGUAGE sql STABLE;

-- ══════════════════════════════════════════════════════════════════════
-- MODALITY BREAKDOWN
-- ══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION radar_modality_breakdown()
RETURNS TABLE(modality TEXT, total BIGINT, unpartnered BIGINT) AS $$
  SELECT
    modality,
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE partnership_status IN ('unpartnered', 'partially_partnered')) AS unpartnered
  FROM clinical_assets
  WHERE modality IS NOT NULL
  GROUP BY modality
  ORDER BY total DESC;
$$ LANGUAGE sql STABLE;

-- ══════════════════════════════════════════════════════════════════════
-- UNREAD MANDATE MATCH COUNTS
-- ══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION radar_unread_match_counts(mandate_ids UUID[], uid UUID)
RETURNS TABLE(mandate_id UUID, unread BIGINT) AS $$
  SELECT
    m.mandate_id,
    COUNT(*) AS unread
  FROM radar_mandate_matches m
  WHERE m.mandate_id = ANY(mandate_ids)
    AND m.user_id = uid
    AND m.is_read = false
    AND m.is_dismissed = false
  GROUP BY m.mandate_id;
$$ LANGUAGE sql STABLE;
