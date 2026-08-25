-- Deal corpus quality audit (R79)
--
-- Run after any bulk ingestion, and before any comparable set leaves the
-- building. Companion to scripts/audit-deal-territories.sql.
--
--   psql "$DATABASE_URL" -f scripts/audit-deal-quality.sql
--
-- Refresh the derived columns first if ingestion has run since the last call:
--   SELECT recompute_deal_dedupe();

\echo '== corpus size =='
SELECT
  (SELECT count(*) FROM deals)                       AS raw_rows,
  (SELECT count(*) FROM deals_canonical)             AS transactions,
  (SELECT count(*) FROM deals WHERE NOT is_canonical) AS duplicate_rows,
  (SELECT count(*) FROM deals_benchmark_grade)       AS benchmark_grade;

\echo ''
\echo '== provenance tiers (A verified+cited, B verified, C terms only, D no terms) =='
SELECT provenance_tier,
       count(*) AS rows,
       count(*) FILTER (WHERE is_canonical) AS transactions,
       round(100.0 * count(*) / sum(count(*)) OVER (), 1) AS pct
FROM deals GROUP BY provenance_tier ORDER BY provenance_tier;

\echo ''
\echo '== citation coverage on verified rows =='
-- The gap that matters for client diligence: a verified flag with no source URL
-- cannot be defended when a counterparty asks where the number came from.
SELECT count(*) FILTER (WHERE verification_status = 'verified')                    AS verified,
       count(*) FILTER (WHERE verification_status = 'verified'
                          AND coalesce(source_url, press_release_url) IS NOT NULL) AS cited,
       round(100.0 * count(*) FILTER (WHERE verification_status = 'verified'
                          AND coalesce(source_url, press_release_url) IS NOT NULL)
             / nullif(count(*) FILTER (WHERE verification_status = 'verified'), 0), 1) AS pct_cited
FROM deals;

\echo ''
\echo '== largest duplicate clusters (candidates for manual resolution) =='
SELECT dedupe_group_id,
       count(*) AS rows,
       count(DISTINCT upfront_usd)          AS distinct_upfronts,
       count(DISTINCT total_deal_value_usd) AS distinct_totals,
       count(DISTINCT deal_type)            AS distinct_deal_types,
       min(announced_date)                  AS earliest,
       max(announced_date)                  AS latest
FROM deals
GROUP BY dedupe_group_id
HAVING count(*) >= 3
ORDER BY count(*) DESC
LIMIT 25;

\echo ''
\echo '== announcement-date integrity =='
-- Re-ingestion has been observed stamping the ingestion date onto announced_date,
-- which silently ages a 2025 transaction into 2026 and corrupts any recency cut.
SELECT count(*) FILTER (WHERE announced_date > current_date)          AS future_dated,
       count(*) FILTER (WHERE announced_date > created_at::date)      AS announced_after_ingest,
       count(*) FILTER (WHERE announced_date IS NULL)                 AS undated
FROM deals;

\echo ''
\echo '== residual fabrication patterns (migrations 051/053/054) =='
SELECT count(*) FILTER (WHERE asset_name ~ '^[A-Za-z0-9/]+-[0-9]{3}$'
                          OR (asset_name ~ '^[A-Za-z0-9/-]+-mab$' AND asset_name NOT ILIKE 'anti-%')
                          OR asset_name ~ '^Anti-[A-Za-z0-9]+(-mab)?$') AS pattern_051,
       count(*) FILTER (WHERE asset_name ~ '^[a-z0-9_]+$')              AS indication_as_asset,
       count(*) FILTER (WHERE is_synthetic)                             AS synthetic
FROM deals;

\echo ''
\echo '== therapeutic-area tagging spot-check =='
-- Rows whose therapeutic_area is a bucket label rather than a real area. These
-- leak into indication-filtered comparable sets and mis-attribute deals.
SELECT therapeutic_area, count(*) AS rows
FROM deals
WHERE therapeutic_area LIKE '\_%'
GROUP BY therapeutic_area ORDER BY count(*) DESC;
