-- Asset Radar Layer 3: deal theses for the full industry pool.
--
-- Before this migration the deal-thesis cron took the top 200 assets by
-- licensing_intent_score once a day, so radar_deal_theses held ~639 rows
-- against ~62k industry-owned assets. This migration:
--
--   1. Adds the honesty-contract columns the UI needs to show "comps median
--      vs model headline" without the two ever silently disagreeing:
--        verified_comp_count   comps with verification_status = 'verified'
--        terms_basis           how the pool was built: phase_matched |
--                              ta_modality | ta_only | insufficient
--        calculator_upfront_mid / calculator_total_mid
--                              headline ($M) from lib/calculations.ts
--                              calculateDealTerms for the same profile
--                              (NULL when the profile cannot be mapped)
--        calculator_inputs     the calculator vocabulary actually used
--                              (TA / phase / modality / indication) so a
--                              reader can see what the model was asked
--        profile_key           TA::modality::phase::indication cache key
--        acquirer_method       partner_matching | licensee_frequency | none
--
--   2. Defines the eligibility set as a view (radar_thesis_eligible_assets)
--      and a queue RPC (radar_thesis_queue) so the cron works through the
--      backlog oldest-first, then refreshes theses older than p_refresh_days
--      or whose asset changed after the thesis was generated.
--
--      NOTE on "asset changed": clinical_assets.updated_at is bumped by the
--      2-hourly licensing-signals score upsert (lib/radar/signal-detection.ts),
--      so a raw `updated_at > generated_at` test would re-queue the whole pool
--      every run. The changed rung is therefore gated by p_min_age_days
--      (default 7): a thesis is re-generated for a touched asset at most weekly,
--      and unconditionally after p_refresh_days (default 30).
--
--   3. Adds radar_thesis_queue_count so the run log can report the remaining
--      backlog by rung.
--
-- lib/radar/deal-thesis.ts degrades gracefully if the columns / RPC are absent.

-- ══════════════════════════════════════════════════════════════════════
-- 1. COLUMNS
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE radar_deal_theses
  ADD COLUMN IF NOT EXISTS verified_comp_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS terms_basis TEXT
    CHECK (terms_basis IN ('phase_matched', 'ta_modality', 'ta_only', 'insufficient')),
  ADD COLUMN IF NOT EXISTS calculator_upfront_mid NUMERIC,
  ADD COLUMN IF NOT EXISTS calculator_total_mid NUMERIC,
  ADD COLUMN IF NOT EXISTS calculator_inputs JSONB,
  ADD COLUMN IF NOT EXISTS profile_key TEXT,
  ADD COLUMN IF NOT EXISTS acquirer_method TEXT
    CHECK (acquirer_method IN ('partner_matching', 'licensee_frequency', 'none'));

COMMENT ON COLUMN radar_deal_theses.verified_comp_count IS
  'Comps in comp_deal_ids whose deals.verification_status = verified.';
COMMENT ON COLUMN radar_deal_theses.terms_basis IS
  'How the comp pool was built. phase_matched = strict TA + phase/indication; ta_modality = widened to TA + modality; ta_only = widened to TA; insufficient = below the 5-comp floor, predicted_* are NULL.';
COMMENT ON COLUMN radar_deal_theses.calculator_upfront_mid IS
  'Median upfront ($M) from lib/calculations.ts calculateDealTerms for the same TA/phase/modality/indication, with neutral defaults for every other input. NULL when the profile could not be mapped to the calculator vocabulary.';
COMMENT ON COLUMN radar_deal_theses.calculator_total_mid IS
  'Median total deal value ($M) from calculateDealTerms — see calculator_upfront_mid.';
COMMENT ON COLUMN radar_deal_theses.calculator_inputs IS
  'The calculator vocabulary the headline was computed with ({therapeuticArea, phase, modality, indication, indication_matched}) or {skipped: reason}.';
COMMENT ON COLUMN radar_deal_theses.profile_key IS
  'TA::modality::phase::indication key. Assets with the same key share one comp pool; used for per-run caching and debugging.';
COMMENT ON COLUMN radar_deal_theses.acquirer_method IS
  'How likely_acquirers was ranked: partner_matching (lib/services/partner-matching.ts) or licensee_frequency (most frequent licensees in the comp pool).';

CREATE INDEX IF NOT EXISTS idx_radar_deal_theses_profile_key
  ON radar_deal_theses (profile_key);

CREATE INDEX IF NOT EXISTS idx_radar_deal_theses_terms_basis
  ON radar_deal_theses (terms_basis);

-- Queue ordering: generated_at ASC NULLS FIRST, asset_id. The existing
-- idx_deal_theses_generated is DESC-only; a dedicated ASC index lets the
-- queue plan stream in order.
CREATE INDEX IF NOT EXISTS idx_radar_deal_theses_generated_asc
  ON radar_deal_theses (generated_at ASC NULLS FIRST, asset_id ASC);

-- Eligibility filter support: the pool is ~62k industry-owned assets out of
-- ~150k; partnership_status + confidence_score narrows first.
CREATE INDEX IF NOT EXISTS idx_clinical_assets_thesis_eligible
  ON clinical_assets (partnership_status, phase, company_id)
  WHERE confidence_score >= 20;

-- ══════════════════════════════════════════════════════════════════════
-- 2. ELIGIBILITY VIEW
-- ══════════════════════════════════════════════════════════════════════

-- Industry-owned (owner_type = industry, or unknown with an INDUSTRY CT.gov
-- lead-sponsor class), unpartnered / partially partnered, clinical-stage
-- (early phase 1 .. phase 3; phase 4 only when fully unpartnered),
-- confidence_score >= 20. Legacy phase spellings tolerated by
-- lib/radar/validation.ts are included so pre-106 rows are not skipped.
CREATE OR REPLACE VIEW radar_thesis_eligible_assets AS
  SELECT
    a.id,
    a.company_id,
    a.company_name,
    a.asset_name,
    a.therapeutic_area,
    a.modality,
    a.phase,
    a.indication_category,
    a.indication_specific,
    a.indications_all,
    a.regulatory_designations,
    a.partnership_status,
    a.partner_company_id,
    a.partner_company_name,
    a.confidence_score,
    a.licensing_intent_score,
    a.updated_at,
    c.owner_type
  FROM clinical_assets a
  JOIN companies c ON c.id = a.company_id
  WHERE (
      c.owner_type = 'industry'
      OR (COALESCE(c.owner_type, 'unknown') = 'unknown' AND upper(COALESCE(c.lead_sponsor_class, '')) = 'INDUSTRY')
    )
    AND a.partnership_status IN ('unpartnered', 'partially_partnered')
    AND COALESCE(a.confidence_score, 0) >= 20
    AND (
      a.phase IN (
        'early_phase_1', 'phase_1', 'phase_1_2', 'phase_2', 'phase_2_3', 'phase_3',
        'early_phase1', 'phase1', 'phase1_phase2', 'phase2', 'phase2_phase3', 'phase3'
      )
      OR (a.phase IN ('phase_4', 'phase4') AND a.partnership_status = 'unpartnered')
    );

COMMENT ON VIEW radar_thesis_eligible_assets IS
  'Assets that must carry a radar_deal_theses row: industry-owned, unpartnered or partially partnered, early phase 1 .. phase 3 (phase 4 only if unpartnered), confidence_score >= 20.';

-- ══════════════════════════════════════════════════════════════════════
-- 3. QUEUE RPC
-- ══════════════════════════════════════════════════════════════════════

-- queue_reason: 'never' (no thesis yet) | 'stale' (older than p_refresh_days)
-- | 'changed' (asset updated after the thesis and the thesis is at least
-- p_min_age_days old). Ordered never -> stale -> changed, oldest thesis first.
CREATE OR REPLACE FUNCTION radar_thesis_queue(
  p_limit INT DEFAULT 3000,
  p_refresh_days INT DEFAULT 30,
  p_min_age_days INT DEFAULT 7,
  p_asset_ids UUID[] DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  company_id UUID,
  company_name TEXT,
  asset_name TEXT,
  therapeutic_area TEXT,
  modality TEXT,
  phase TEXT,
  indication_category TEXT,
  indication_specific TEXT,
  indications_all TEXT[],
  regulatory_designations TEXT[],
  partnership_status TEXT,
  partner_company_id UUID,
  partner_company_name TEXT,
  confidence_score INTEGER,
  licensing_intent_score NUMERIC,
  asset_updated_at TIMESTAMPTZ,
  thesis_generated_at TIMESTAMPTZ,
  queue_reason TEXT
)
LANGUAGE sql STABLE
SET statement_timeout = '60s'
AS $$
  SELECT
    e.id,
    e.company_id,
    e.company_name,
    e.asset_name,
    e.therapeutic_area,
    e.modality,
    e.phase,
    e.indication_category,
    e.indication_specific,
    e.indications_all,
    e.regulatory_designations,
    e.partnership_status,
    e.partner_company_id,
    e.partner_company_name,
    e.confidence_score,
    e.licensing_intent_score,
    e.updated_at AS asset_updated_at,
    t.generated_at AS thesis_generated_at,
    CASE
      WHEN t.generated_at IS NULL THEN 'never'
      WHEN t.generated_at < now() - make_interval(days => GREATEST(COALESCE(p_refresh_days, 30), 1)) THEN 'stale'
      ELSE 'changed'
    END AS queue_reason
  FROM radar_thesis_eligible_assets e
  LEFT JOIN radar_deal_theses t ON t.asset_id = e.id
  WHERE (p_asset_ids IS NULL OR e.id = ANY(p_asset_ids))
    AND (
      p_asset_ids IS NOT NULL
      OR t.generated_at IS NULL
      OR t.generated_at < now() - make_interval(days => GREATEST(COALESCE(p_refresh_days, 30), 1))
      OR (
        e.updated_at > t.generated_at
        AND t.generated_at < now() - make_interval(days => GREATEST(COALESCE(p_min_age_days, 7), 0))
      )
    )
  ORDER BY
    CASE
      WHEN t.generated_at IS NULL THEN 0
      WHEN t.generated_at < now() - make_interval(days => GREATEST(COALESCE(p_refresh_days, 30), 1)) THEN 1
      ELSE 2
    END,
    t.generated_at ASC NULLS FIRST,
    e.id ASC
  LIMIT GREATEST(COALESCE(p_limit, 3000), 1);
$$;

COMMENT ON FUNCTION radar_thesis_queue(INT, INT, INT, UUID[]) IS
  'Eligible assets that need a deal thesis, oldest first: never generated, then older than p_refresh_days, then changed since generation (gated by p_min_age_days). Pass p_asset_ids to force specific assets regardless of age.';

-- Remaining work by rung, for the run log.
CREATE OR REPLACE FUNCTION radar_thesis_queue_count(
  p_refresh_days INT DEFAULT 30,
  p_min_age_days INT DEFAULT 7
)
RETURNS TABLE(
  eligible BIGINT,
  never_generated BIGINT,
  stale BIGINT,
  changed BIGINT,
  remaining BIGINT
)
LANGUAGE sql STABLE
SET statement_timeout = '60s'
AS $$
  WITH q AS (
    SELECT
      e.id,
      t.generated_at,
      e.updated_at,
      (t.generated_at IS NULL) AS is_never,
      (t.generated_at IS NOT NULL
        AND t.generated_at < now() - make_interval(days => GREATEST(COALESCE(p_refresh_days, 30), 1))) AS is_stale,
      (t.generated_at IS NOT NULL
        AND t.generated_at >= now() - make_interval(days => GREATEST(COALESCE(p_refresh_days, 30), 1))
        AND e.updated_at > t.generated_at
        AND t.generated_at < now() - make_interval(days => GREATEST(COALESCE(p_min_age_days, 7), 0))) AS is_changed
    FROM radar_thesis_eligible_assets e
    LEFT JOIN radar_deal_theses t ON t.asset_id = e.id
  )
  SELECT
    COUNT(*)::BIGINT AS eligible,
    COUNT(*) FILTER (WHERE is_never)::BIGINT AS never_generated,
    COUNT(*) FILTER (WHERE is_stale)::BIGINT AS stale,
    COUNT(*) FILTER (WHERE is_changed)::BIGINT AS changed,
    COUNT(*) FILTER (WHERE is_never OR is_stale OR is_changed)::BIGINT AS remaining
  FROM q;
$$;

COMMENT ON FUNCTION radar_thesis_queue_count(INT, INT) IS
  'Size of the deal-thesis queue by rung (never / stale / changed) plus the total eligible pool.';

-- Service role only: these are cron helpers, not public API.
REVOKE ALL ON FUNCTION radar_thesis_queue(INT, INT, INT, UUID[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION radar_thesis_queue_count(INT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION radar_thesis_queue(INT, INT, INT, UUID[]) TO service_role;
GRANT EXECUTE ON FUNCTION radar_thesis_queue_count(INT, INT) TO service_role;
REVOKE ALL ON radar_thesis_eligible_assets FROM PUBLIC, anon, authenticated;
GRANT SELECT ON radar_thesis_eligible_assets TO service_role;
