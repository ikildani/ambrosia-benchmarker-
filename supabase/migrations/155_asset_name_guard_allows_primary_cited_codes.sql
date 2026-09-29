-- 155: the fabrication guard on asset_name allows program codes on primary-cited rows.
-- Why (Sep 29 2026): deals_asset_name_not_fabrication rejected any 'XX-123' style name unless the row
-- was already verified. New rows are inserted pending, so real codes (Kymera KT-200, Theriva SYN-020,
-- NovaBridge VIS-101, Context CT-202, Tarsus IRX-101) were dropped at insert: 12 of one archive run.
-- A code quoted from a regulator filing or an issuer release is not a fabrication; the guard now
-- applies only to rows without a primary citation. Applied to prod via MCP on Sep 29 2026.
ALTER TABLE public.deals DROP CONSTRAINT IF EXISTS deals_asset_name_not_fabrication;
ALTER TABLE public.deals ADD CONSTRAINT deals_asset_name_not_fabrication CHECK (
  asset_name IS NULL
  OR COALESCE(is_synthetic, false) = true
  OR COALESCE(verified, false) = true
  OR source_filing_id IS NOT NULL
  OR press_release_url IS NOT NULL
  OR (
    asset_name !~ '^[A-Za-z0-9/]+-[0-9]{3}$'
    AND NOT (asset_name ~ '^[A-Za-z0-9/-]+-mab$' AND asset_name !~~* 'anti-%')
    AND asset_name !~ '^Anti-[A-Za-z0-9]+(-mab)?$'
  )
) NOT VALID;
ALTER TABLE public.deals VALIDATE CONSTRAINT deals_asset_name_not_fabrication;
