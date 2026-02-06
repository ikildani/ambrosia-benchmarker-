-- Migration: 009_security_fixes.sql
-- Security fixes: Change views from SECURITY DEFINER to SECURITY INVOKER
-- and ensure RLS is enabled on saved_scenarios

-- =============================================
-- Fix SECURITY DEFINER views
-- Views should use SECURITY INVOKER so they enforce the querying user's permissions
-- =============================================

-- Drop and recreate top_acquirers view with SECURITY INVOKER
DROP VIEW IF EXISTS top_acquirers;
CREATE VIEW top_acquirers
WITH (security_invoker = true) AS
SELECT
  c.id,
  c.name,
  c.company_type,
  c.deals_last_12mo,
  c.deals_last_24mo,
  c.modalities_active,
  c.indications_active,
  c.avg_upfront_usd,
  c.last_deal_date,
  c.data_quality_score,
  c.actively_acquiring
FROM companies c
WHERE c.actively_acquiring = true
  AND c.deals_last_24mo > 0
ORDER BY c.deals_last_12mo DESC, c.data_quality_score DESC;

-- Drop and recreate deal_trends_by_modality view with SECURITY INVOKER
DROP VIEW IF EXISTS deal_trends_by_modality;
CREATE VIEW deal_trends_by_modality
WITH (security_invoker = true) AS
SELECT
  modality,
  DATE_TRUNC('month', announced_date) as month,
  COUNT(*) as deal_count,
  AVG(upfront_usd) FILTER (WHERE upfront_usd IS NOT NULL) as avg_upfront,
  AVG(total_deal_value_usd) FILTER (WHERE total_deal_value_usd IS NOT NULL) as avg_total_value
FROM deals
WHERE announced_date > NOW() - INTERVAL '24 months'
GROUP BY modality, DATE_TRUNC('month', announced_date)
ORDER BY month DESC, deal_count DESC;

-- Drop and recreate partner_match_analytics view with SECURITY INVOKER
DROP VIEW IF EXISTS partner_match_analytics;
CREATE VIEW partner_match_analytics
WITH (security_invoker = true) AS
SELECT
  input_modality,
  input_indication_category,
  user_tier,
  COUNT(*) as match_requests,
  AVG(matches_total) as avg_matches_found,
  AVG(avg_match_score) as avg_quality_score,
  SUM(CASE WHEN upgrade_cta_clicked THEN 1 ELSE 0 END) as upgrade_clicks,
  SUM(CASE WHEN advisory_cta_clicked THEN 1 ELSE 0 END) as advisory_clicks,
  DATE_TRUNC('week', created_at) as week
FROM partner_match_results
GROUP BY input_modality, input_indication_category, user_tier, DATE_TRUNC('week', created_at)
ORDER BY week DESC;

-- =============================================
-- Ensure RLS is enabled on saved_scenarios
-- =============================================
ALTER TABLE saved_scenarios ENABLE ROW LEVEL SECURITY;

-- Grant appropriate permissions for the views
-- These views read from public tables, so anon and authenticated roles should have access
GRANT SELECT ON top_acquirers TO anon, authenticated;
GRANT SELECT ON deal_trends_by_modality TO anon, authenticated;
GRANT SELECT ON partner_match_analytics TO authenticated;
