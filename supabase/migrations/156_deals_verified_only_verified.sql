-- 156: product surfaces show only rows the verifier has confirmed against their source.
-- deals_verified used to let 'pending' (inserted, not yet checked) and 'skipped' (uncited legacy rows the
-- verifier never processed) through. The verifier runs every 20 minutes (50 rows a run), so a new deal
-- appears within about an hour. Applied to prod via MCP on Sep 29 2026; 135 skipped rows sent to the fixer.
CREATE OR REPLACE VIEW public.deals_verified
WITH (security_invoker = true) AS
SELECT * FROM public.deals
WHERE is_synthetic = false AND is_canonical IS NOT FALSE AND duplicate_of IS NULL AND verification_status = 'verified';
COMMENT ON VIEW public.deals_verified IS 'Product surfaces read this: verifier-confirmed, canonical, non-duplicate, non-synthetic deals only (migration 156).';
