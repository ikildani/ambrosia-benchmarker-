-- ============================================================================
-- Territorial Audit Script (Round 25 of engine-restructure work, 2026-04-13)
-- ============================================================================
--
-- PURPOSE
--
-- The Step D territory-aware peak sales decomposition (Round 17) revealed
-- that 20 of 69 core backtest deals were tagged non-global, not the 0 we
-- initially diagnosed. The 251-deal backtest corpus is small enough that
-- manual audit caught this. The 2,500+ deal live production corpus in
-- Supabase likely has similar mis-tagging — deals that are structurally
-- territorial (CSPC for China rights, Kissei for Japan, etc.) but tagged
-- 'global' in the deals table.
--
-- This script flags high-confidence mis-tags via 3 heuristics:
--   1. Licensor/licensee geography mismatch (Asian licensee + US licensor
--      + 'global' → likely territorial)
--   2. Small upfront on late-stage asset (Phase 3 + <$100M upfront +
--      'global' → very likely a regional rights deal)
--   3. Known Chinese/Japanese/Korean pharma counterparty patterns
--
-- Execute against the production deals table. Review flagged rows manually.
-- Re-tag confirmed mis-tags to the correct territory value.
--
-- USAGE
--
--   psql $DATABASE_URL -f scripts/audit-deal-territories.sql > audit-results.txt
--
-- Or from Supabase dashboard SQL editor.
--
-- ============================================================================


-- ─── Heuristic 1: Asian counterparty + 'global' territory ───────────────────
--
-- Deals with a Chinese, Japanese, or Korean licensee paired with a non-Asian
-- licensor are overwhelmingly territorial (the Asian licensee is buying
-- regional rights, not global). If tagged 'global', it's almost certainly
-- wrong.

WITH asian_counterparty_patterns AS (
  SELECT
    id,
    licensor,
    licensee,
    year,
    phase,
    upfront,
    indication_specific,
    indication_category,
    therapeutic_area,
    territory,
    deal_type
  FROM deals
  WHERE territory = 'global'
    AND (
      -- Chinese pharma licensees
      licensee ILIKE '%hengrui%' OR licensee ILIKE '%bei gene%' OR licensee ILIKE '%beigene%'
      OR licensee ILIKE '%cspc%' OR licensee ILIKE '%hansoh%' OR licensee ILIKE '%innovent%'
      OR licensee ILIKE '%simcere%' OR licensee ILIKE '%junshi%' OR licensee ILIKE '%3sbio%'
      OR licensee ILIKE '%sanofi china%' OR licensee ILIKE '%fosun%' OR licensee ILIKE '%elevar%'
      OR licensee ILIKE '%brii bio%' OR licensee ILIKE '%akeso%' OR licensee ILIKE '%kintor%'
      -- Japanese pharma licensees (non-Takeda — Takeda is global)
      OR licensee ILIKE '%kissei%' OR licensee ILIKE '%shionogi%' OR licensee ILIKE '%mitsubishi tanabe%'
      OR licensee ILIKE '%eisai japan%' OR licensee ILIKE '%ono pharmaceutical%'
      OR licensee ILIKE '%taisho%' OR licensee ILIKE '%mochida%' OR licensee ILIKE '%astellas japan%'
      -- Korean pharma licensees
      OR licensee ILIKE '%samsung bioepis%' OR licensee ILIKE '%sk biopharm%'
      OR licensee ILIKE '%yuhan%' OR licensee ILIKE '%hanmi%' OR licensee ILIKE '%daewoong%'
      -- Indian pharma licensees with ex-US rights patterns
      OR licensee ILIKE '%glenmark%' OR licensee ILIKE '%sun pharma%' OR licensee ILIKE '%dr reddy%'
    )
    -- Exclude licensors who ARE also Asian (those genuinely might be global deals)
    AND NOT (
      licensor ILIKE '%hengrui%' OR licensor ILIKE '%bei%gene%' OR licensor ILIKE '%cspc%'
      OR licensor ILIKE '%kissei%' OR licensor ILIKE '%takeda%' OR licensor ILIKE '%eisai%'
    )
)
SELECT
  'H1_asian_counterparty_global' AS heuristic,
  id,
  year,
  licensor || ' → ' || licensee AS deal,
  therapeutic_area AS ta,
  phase,
  deal_type,
  upfront AS upfront_m,
  territory AS current_territory,
  CASE
    WHEN licensee ILIKE '%hengrui%' OR licensee ILIKE '%cspc%' OR licensee ILIKE '%hansoh%'
      OR licensee ILIKE '%innovent%' OR licensee ILIKE '%beigene%' OR licensee ILIKE '%3sbio%'
      OR licensee ILIKE '%fosun%' OR licensee ILIKE '%akeso%' OR licensee ILIKE '%brii%'
      THEN 'china'
    WHEN licensee ILIKE '%kissei%' OR licensee ILIKE '%shionogi%' OR licensee ILIKE '%mitsubishi tanabe%'
      OR licensee ILIKE '%ono%' OR licensee ILIKE '%mochida%' OR licensee ILIKE '%taisho%'
      THEN 'japan'
    WHEN licensee ILIKE '%samsung%' OR licensee ILIKE '%sk biopharm%' OR licensee ILIKE '%yuhan%'
      OR licensee ILIKE '%hanmi%' OR licensee ILIKE '%daewoong%'
      THEN 'japan'  -- closest archetype; flag for manual review
    WHEN licensee ILIKE '%glenmark%' OR licensee ILIKE '%sun pharma%'
      THEN 'ex_us'
    ELSE 'NEEDS_MANUAL_REVIEW'
  END AS suggested_territory
FROM asian_counterparty_patterns
ORDER BY year DESC, upfront DESC;


-- ─── Heuristic 2: Suspiciously small late-stage upfront + 'global' ─────────
--
-- Phase 3 or approved-stage deals with 'global' territory but upfronts
-- below $100M are statistical outliers — typical Phase 3+ global licensing
-- upfronts are $200M-$1B. Sub-$100M upfronts on late-stage global deals
-- almost always indicate regional rights mis-tagged as global.

SELECT
  'H2_small_latestage_global' AS heuristic,
  id,
  year,
  licensor || ' → ' || licensee AS deal,
  therapeutic_area AS ta,
  phase,
  deal_type,
  upfront AS upfront_m,
  territory AS current_territory,
  'NEEDS_MANUAL_REVIEW' AS suggested_territory  -- territory requires investigation
FROM deals
WHERE territory = 'global'
  AND phase IN ('phase3', 'approved', 'nda_filed')
  AND deal_type IN ('licensing', 'codevelopment')
  AND upfront < 100
  AND upfront > 0  -- exclude $0 upfront deals which are option/milestone-only
ORDER BY year DESC, upfront ASC
LIMIT 100;


-- ─── Heuristic 3: Summary counts by licensor/licensee country pattern ──────
--
-- Produces a rough estimate of how many deals might need re-tagging.
-- Useful for sizing the audit workload.

SELECT
  'H3_rollup' AS heuristic,
  territory AS current_territory,
  COUNT(*) AS deal_count,
  COUNT(*) FILTER (
    WHERE licensee ILIKE '%hengrui%' OR licensee ILIKE '%cspc%' OR licensee ILIKE '%hansoh%'
       OR licensee ILIKE '%innovent%' OR licensee ILIKE '%beigene%' OR licensee ILIKE '%3sbio%'
       OR licensee ILIKE '%kissei%' OR licensee ILIKE '%shionogi%' OR licensee ILIKE '%mitsubishi tanabe%'
       OR licensee ILIKE '%ono%' OR licensee ILIKE '%glenmark%' OR licensee ILIKE '%sun pharma%'
  ) AS asian_counterparty_count,
  COUNT(*) FILTER (
    WHERE phase = 'phase3' AND deal_type = 'licensing' AND upfront < 100 AND upfront > 0
  ) AS suspicious_small_phase3_licensing,
  ROUND(AVG(upfront)::numeric, 1) AS avg_upfront_m
FROM deals
GROUP BY territory
ORDER BY deal_count DESC;


-- ─── Heuristic 4: Known archetype mis-tags to hand-audit ────────────────────
--
-- High-confidence re-tagging suggestions based on specific patterns seen
-- in the 251-deal backtest corpus that should have been non-global.
-- Copy-paste review.

SELECT
  'H4_known_patterns' AS heuristic,
  id,
  year,
  licensor || ' → ' || licensee AS deal,
  therapeutic_area AS ta,
  phase,
  deal_type,
  upfront AS upfront_m,
  territory AS current_territory,
  CASE
    -- China re-licensing patterns (Asian licensor + Chinese licensee, small upfront)
    WHEN licensor ILIKE '%cspc%' OR licensor ILIKE '%hengrui%' OR licensor ILIKE '%hansoh%'
      OR licensor ILIKE '%3sbio%' OR licensor ILIKE '%everest%'
      THEN 'ex_china'
    -- Emerging region out-licensing from China to Western licensee (still territorial)
    WHEN (licensor ILIKE '%hengrui%' OR licensor ILIKE '%cspc%' OR licensor ILIKE '%hansoh%')
      AND (licensee ILIKE '%merck%' OR licensee ILIKE '%astrazeneca%' OR licensee ILIKE '%lilly%')
      THEN 'ex_china'
    ELSE territory
  END AS suggested_territory,
  CASE
    WHEN licensor ILIKE '%cspc%' OR licensor ILIKE '%hengrui%'
      THEN 'China-origin asset; licensee typically gets ex-China rights'
    WHEN licensor ILIKE '%kissei%' OR licensor ILIKE '%shionogi%'
      THEN 'Japan-origin asset; licensee typically gets ex-Japan rights'
    ELSE NULL
  END AS reasoning
FROM deals
WHERE territory = 'global'
  AND (
    licensor ILIKE '%cspc%' OR licensor ILIKE '%hengrui%' OR licensor ILIKE '%hansoh%'
    OR licensor ILIKE '%3sbio%' OR licensor ILIKE '%everest%'
    OR licensor ILIKE '%kissei%' OR licensor ILIKE '%shionogi%' OR licensor ILIKE '%mitsubishi tanabe%'
  )
ORDER BY year DESC;


-- ============================================================================
-- OPTIONAL: Apply corrections
-- ============================================================================
--
-- After manual review of flagged rows, apply corrections via UPDATE.
-- EXAMPLE (DO NOT RUN BLINDLY):
--
--   UPDATE deals SET territory = 'china'
--   WHERE id IN ( /* list of confirmed mis-tags */ );
--
--   UPDATE deals SET territory = 'ex_china'
--   WHERE id IN ( /* list of confirmed mis-tags */ );
--
-- Re-run the backtest after corrections to measure impact on full-scope
-- hit rates. Deals now correctly tagged will benefit from Step D's
-- territory-adjusted peak sales.
