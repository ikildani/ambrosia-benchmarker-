-- 192: deal -> program ledger, and programs that exist only in a deal.
--
-- Of 2,688 canonical license / option / collaboration deals only 712 reached a
-- program's deal_ids (Nov 18 2026). Among the 529 unlinked deals that name a
-- drug identifier:
--   *  58 name a program the licensor already has, but the partnership matcher's
--      arm-name comparison missed it ("HM17321" vs "HM-17321 injection" style).
--   * 198 name an asset no company in the universe has; 59 of them are preclinical /
--     discovery assets with a single code and no known alias: deal-only programs.
--   * ~273 sit on another company row (subsidiary, CN/EN duplicate, or a
--      technology licence such as Halozyme ENHANZE on someone else's drug).
--      Those wait for the company identity graph; linking them on the drug
--      alone would mark the wrong owner's program as partnered.
--
-- radar_deal_program_links records each deal <-> program link with its method.
-- lib/radar/partnership.ts accepts a ledger deal for every row of the linked
-- program without repeating the owner / arm-name checks (the ledger already
-- established both), so links survive each partnership refresh.
-- radar_link_deals() fills the ledger (method 'program_identifier') and creates
-- one cited program per deal-only asset (asset_origin 'deal', method
-- 'deal_created'). Apply after 189. Idempotent; safe to re-run.

CREATE TABLE IF NOT EXISTS public.radar_deal_program_links (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id     uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  company_id  uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  program_key text NOT NULL,
  identifier  text NOT NULL,
  method      text NOT NULL CHECK (method IN ('program_identifier', 'deal_created')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT radar_deal_program_links_uq UNIQUE (deal_id, program_key)
);
CREATE INDEX IF NOT EXISTS idx_radar_deal_program_links_program ON public.radar_deal_program_links (program_key);
COMMENT ON TABLE public.radar_deal_program_links IS
  'Deal -> program links the partnership refresh accepts without re-matching arm names (migration 192).';
ALTER TABLE public.radar_deal_program_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access radar_deal_program_links" ON public.radar_deal_program_links;
CREATE POLICY "Service role full access radar_deal_program_links"
  ON public.radar_deal_program_links FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 'deal' joins the cited origins: a deal-only program carries the deal's source.
ALTER TABLE public.clinical_assets DROP CONSTRAINT IF EXISTS clinical_assets_asset_origin_check;
ALTER TABLE public.clinical_assets ADD CONSTRAINT clinical_assets_asset_origin_check
  CHECK (asset_origin = ANY (ARRAY['registry', 'filing', 'pipeline_page', 'press', 'designation', 'user', 'deal']));
ALTER TABLE public.clinical_assets DROP CONSTRAINT IF EXISTS clinical_assets_filing_origin_cited;
ALTER TABLE public.clinical_assets ADD CONSTRAINT clinical_assets_filing_origin_cited
  CHECK ((asset_origin <> ALL (ARRAY['filing', 'pipeline_page', 'designation', 'deal']))
         OR (disclosure_url IS NOT NULL AND disclosure_date IS NOT NULL AND disclosure_excerpt IS NOT NULL));

CREATE OR REPLACE FUNCTION public.radar_link_deals()
 RETURNS jsonb
 LANGUAGE plpgsql
 SET statement_timeout TO '300s'
AS $function$
DECLARE
  v_linked integer := 0;
  v_created integer := 0;
  v_created_links integer := 0;
BEGIN
  DROP TABLE IF EXISTS tmp_dl_deals;
  CREATE TEMP TABLE tmp_dl_deals ON COMMIT DROP AS
  SELECT d.id, d.licensor_id, d.asset_name, d.announced_date, d.source_url, d.press_release_url,
         d.phase_at_signing, d.modality, d.therapeutic_area, d.indication_specific, d.target,
         coalesce(nullif(d.raw_text_excerpt, ''), nullif(d.asset_description, ''), d.asset_name) AS excerpt,
         public.radar_asset_identifiers(d.asset_name) AS ids
  FROM public.deals d
  WHERE coalesce(d.is_canonical, true) AND NOT coalesce(d.is_synthetic, false)
    AND lower(coalesce(d.verification_status, '')) NOT IN ('rejected', 'flagged')
    AND d.deal_type IN ('license', 'option', 'collaboration')
    AND d.licensor_id IS NOT NULL;
  DELETE FROM tmp_dl_deals WHERE cardinality(ids) = 0;

  DROP TABLE IF EXISTS tmp_dl_pk;
  CREATE TEMP TABLE tmp_dl_pk ON COMMIT DROP AS
  SELECT DISTINCT company_id, program_key, split_part(program_key, ':t:', 2) AS tok
  FROM public.clinical_assets
  WHERE program_primary AND company_id IS NOT NULL AND program_key LIKE '%:t:%';
  CREATE INDEX ON tmp_dl_pk (company_id, tok);
  CREATE INDEX ON tmp_dl_pk (tok);

  -- 0. Program keys move when programs regroup (migration 187): repoint each
  --    link to the company's program that holds its identifier now.
  UPDATE public.radar_deal_program_links l
     SET program_key = x.program_key
    FROM (
      SELECT DISTINCT ON (l2.id) l2.id, a.program_key
      FROM public.radar_deal_program_links l2
      JOIN public.clinical_assets a
        ON a.company_id = l2.company_id AND a.program_key IS NOT NULL
       AND (a.program_key = l2.program_key
            OR a.deal_ids @> ARRAY[l2.deal_id]
            OR public.radar_asset_identifiers(a.asset_name) @> ARRAY[l2.identifier])
      ORDER BY l2.id, (a.program_key = l2.program_key) DESC, a.program_primary DESC
    ) x
   WHERE l.id = x.id AND l.program_key <> x.program_key
     AND NOT EXISTS (SELECT 1 FROM public.radar_deal_program_links o
                     WHERE o.deal_id = l.deal_id AND o.program_key = x.program_key);

  DROP TABLE IF EXISTS tmp_dl_new;
  CREATE TEMP TABLE tmp_dl_new (program_key text) ON COMMIT DROP;

  -- 1. The licensor already has the program.
  WITH ins AS (
    INSERT INTO public.radar_deal_program_links (deal_id, company_id, program_key, identifier, method)
    SELECT DISTINCT d.id, p.company_id, p.program_key, p.tok, 'program_identifier'
    FROM tmp_dl_deals d
    JOIN tmp_dl_pk p ON p.company_id = d.licensor_id AND p.tok = ANY (d.ids)
    ON CONFLICT (deal_id, program_key) DO NOTHING
    RETURNING program_key
  )
  INSERT INTO tmp_dl_new SELECT program_key FROM ins;
  GET DIAGNOSTICS v_linked = ROW_COUNT;

  -- 2. No company has it: one program per single-asset deal from an industry licensor.
  WITH candidates AS (
    SELECT d.*, c.name AS company_name
    FROM tmp_dl_deals d
    JOIN public.companies c ON c.id = d.licensor_id AND c.owner_type = 'industry' AND c.merged_into IS NULL
    WHERE cardinality(d.ids) = 1
      -- Clinical-stage deal assets are in the registries; when we cannot find one it is an alias
      -- gap (AG10 = acoramidis, ALN-TTR02 = patisiran), not a missing program.
      AND d.phase_at_signing IN ('preclinical', 'discovery')
      AND coalesce(d.source_url, d.press_release_url) ~ '^https?://'
      AND d.announced_date IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM tmp_dl_pk p WHERE p.tok = d.ids[1])
      AND NOT EXISTS (SELECT 1 FROM public.radar_deal_program_links l WHERE l.deal_id = d.id)
      -- A known alias of a drug some program already carries is the same drug under another name.
      AND NOT EXISTS (SELECT 1 FROM public.drug_aliases da JOIN public.clinical_assets a ON a.drug_master_id = da.drug_id
                      WHERE upper(regexp_replace(da.alias, '[^A-Za-z0-9]', '', 'g')) = d.ids[1])
  ),
  created AS (
    INSERT INTO public.clinical_assets (
      company_id, company_name, asset_name, asset_origin, phase, modality, therapeutic_area,
      indication_specific, target, deal_ids, disclosure_source_type, disclosure_url, disclosure_date,
      disclosure_excerpt, classification_status, ownership_status, ownership_evidence)
    SELECT DISTINCT ON (c.licensor_id, c.ids[1])
           c.licensor_id, c.company_name, btrim(c.asset_name), 'deal',
           CASE c.phase_at_signing
             WHEN 'discovery' THEN 'preclinical' WHEN 'preclinical' THEN 'preclinical'
             WHEN 'phase_1' THEN 'phase_1' WHEN 'phase_2' THEN 'phase_2' WHEN 'phase_3' THEN 'phase_3'
             WHEN 'approved' THEN 'phase_4' ELSE 'unknown' END,
           c.modality, c.therapeutic_area, c.indication_specific, c.target,
           ARRAY[c.id], 'deal', coalesce(c.source_url, c.press_release_url), c.announced_date,
           left(c.excerpt, 1000), 'unclassified', 'unknown',
           -- The deal names the licensor, but deal records sometimes invert the parties: keep the
           -- owner unverified until ownership attribution confirms it.
           jsonb_build_object('rule', 'deal_licensor', 'deal_id', c.id)
    FROM candidates c
    ORDER BY c.licensor_id, c.ids[1], c.announced_date DESC
    ON CONFLICT (company_name, asset_name) DO NOTHING
    RETURNING id, company_id, asset_name, deal_ids
  )
  INSERT INTO public.radar_deal_program_links (deal_id, company_id, program_key, identifier, method)
  SELECT c.deal_ids[1], c.company_id, c.company_id::text || ':t:' || (public.radar_asset_identifiers(c.asset_name))[1],
         (public.radar_asset_identifiers(c.asset_name))[1], 'deal_created'
  FROM created c
  ON CONFLICT (deal_id, program_key) DO NOTHING;
  GET DIAGNOSTICS v_created_links = ROW_COUNT;
  v_created := v_created_links;

  -- Re-check partnership on the programs that just gained a deal (next refresh run takes them as backlog).
  UPDATE public.clinical_assets a
     SET partnership_checked_at = NULL
   WHERE a.program_key IN (SELECT program_key FROM tmp_dl_new)
     AND a.partnership_checked_at IS NOT NULL;

  RETURN jsonb_build_object('linked_existing', v_linked, 'programs_created', v_created);
END;
$function$;

COMMENT ON FUNCTION public.radar_link_deals() IS
  'Fills radar_deal_program_links and creates deal-only programs (migration 192). Run after radar_refresh_programs.';
