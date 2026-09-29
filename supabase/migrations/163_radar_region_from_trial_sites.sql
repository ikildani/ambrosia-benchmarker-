-- 163: originator region inferred from trial sites, labelled as such.
-- Applied to production 2026-09-29 ahead of the PR merging, as ledger entry 159_radar_region_from_trial_sites.
--
-- After 161 filled regions from company HQ, 2,494 default-feed programs still had
-- no region because the company has no country on file. When every site of every
-- trial the company sponsors sits in one region, that region is recorded with
-- originator_region_source = 'trial_sites' so the UI can say how it was derived.
-- Australia/New Zealand-only sites are skipped: US biotechs often run first-in-human
-- studies there, so they say little about where the sponsor is based.
-- The country itself is not written; only the region.

ALTER TABLE public.clinical_assets
  ADD COLUMN IF NOT EXISTS originator_region_source text;

COMMENT ON COLUMN public.clinical_assets.originator_region_source IS
  'How originator_region was derived: NULL = company HQ or registry sponsor country; trial_sites = every trial site of the sponsor is in this region (163).';

WITH miss AS (
  SELECT DISTINCT a.company_id
  FROM public.clinical_assets a
  WHERE a.originator_region IS NULL AND a.company_id IS NOT NULL
), sites AS (
  SELECT t.company_id, public.radar_country_iso(c) AS iso
  FROM public.company_trials t
  JOIN miss m ON m.company_id = t.company_id
  CROSS JOIN LATERAL unnest(t.locations_countries) AS c
), per_company AS (
  SELECT s.company_id,
         count(DISTINCT cr.region) AS n_regions,
         min(cr.region) AS region,
         bool_and(s.iso IS NOT NULL AND cr.region IS NOT NULL) AS all_mapped,
         bool_and(s.iso IN ('AU', 'NZ')) AS only_anz
  FROM sites s
  LEFT JOIN public.radar_country_region cr ON cr.country = s.iso
  GROUP BY s.company_id
)
UPDATE public.clinical_assets a
   SET originator_region = p.region,
       originator_region_source = 'trial_sites'
  FROM per_company p
 WHERE a.company_id = p.company_id
   AND a.originator_region IS NULL
   AND p.n_regions = 1 AND p.all_mapped AND NOT p.only_anz;
