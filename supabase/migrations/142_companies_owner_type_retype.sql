-- 142_companies_owner_type_retype.sql
--
-- Search & Evaluation: companies whose owner_type never got set.
--
-- Two populations were sitting outside the industry universe:
--   1. 568 companies created by the deal ingestion (Jiangsu Hengrui, Innovent,
--      Alexion, Chiesi, Ono, Organon...) with company_type = large_pharma /
--      mid_biotech / ... but owner_type 'unknown' because only the CT.gov
--      sweep ever set owner_type. 6,244 assets, 5,545 of them Phase 1-3.
--   2. 5,943 CT.gov sponsors with LeadSponsorClass OTHER that the name
--      heuristics missed (NYU Langone Health, Gustave Roussy, UNICANCER,
--      Cancer Research UK, GBG Forschungs GmbH...). Mostly hospitals,
--      academic centres and trial groups; a small corporate tail.
--
-- This migration (a) maps company_type to owner_type where owner_type is
-- unknown, (b) re-runs widened name heuristics over 'other'/'unknown'
-- sponsors, and (c) installs a trigger so a company created or retyped by
-- the deal ingestion gets its owner_type from company_type from now on.
-- lib/ingestion/ctgov-sweep.ts deriveOwnerType() carries the same widened
-- patterns for CT.gov sponsors. clinical_assets.owner_type follows through
-- trg_companies_owner_type_propagate (migration 125).
--
-- Apply after 141. Idempotent.

-- ══════════════════════════════════════════════════════════════════════
-- 1. company_type -> owner_type (deal-ingestion companies)
-- ══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.radar_owner_type_from_company_type(p_company_type text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_company_type
    WHEN 'large_pharma' THEN 'industry'
    WHEN 'mid_pharma' THEN 'industry'
    WHEN 'large_biotech' THEN 'industry'
    WHEN 'mid_biotech' THEN 'industry'
    WHEN 'specialty' THEN 'industry'
    WHEN 'cro_cdmo' THEN 'cro'
    WHEN 'academic' THEN 'academic'
    WHEN 'government' THEN 'government'
    WHEN 'nonprofit' THEN 'network'
    ELSE NULL
  END;
$$;

-- Every change is logged so the retype can be audited or reversed.
CREATE TABLE IF NOT EXISTS public.radar_owner_type_retype_log (
  id bigserial PRIMARY KEY,
  company_id uuid NOT NULL,
  company_name text,
  old_owner_type text,
  new_owner_type text NOT NULL,
  rule text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);

WITH upd AS (
  UPDATE public.companies c
  SET owner_type = public.radar_owner_type_from_company_type(c.company_type)
  WHERE (c.owner_type IS NULL OR c.owner_type = 'unknown')
    AND public.radar_owner_type_from_company_type(c.company_type) IS NOT NULL
  RETURNING c.id, c.name, c.owner_type AS new_type
)
INSERT INTO public.radar_owner_type_retype_log (company_id, company_name, old_owner_type, new_owner_type, rule)
SELECT id, name, 'unknown', new_type, 'company_type' FROM upd;

-- Keep it that way: a company inserted or retyped with no CT.gov class gets
-- its owner_type from company_type.
CREATE OR REPLACE FUNCTION public.radar_companies_default_owner_type()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.owner_type IS NULL OR NEW.owner_type = 'unknown')
     AND public.radar_owner_type_from_company_type(NEW.company_type) IS NOT NULL THEN
    NEW.owner_type := public.radar_owner_type_from_company_type(NEW.company_type);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_companies_default_owner_type ON public.companies;
CREATE TRIGGER trg_companies_default_owner_type
  BEFORE INSERT OR UPDATE OF company_type, owner_type ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.radar_companies_default_owner_type();

-- ══════════════════════════════════════════════════════════════════════
-- 2. Widened name heuristics for OTHER / unclassified sponsors
-- ══════════════════════════════════════════════════════════════════════
-- Same order as deriveOwnerType(): hospital, academic, government, network,
-- industry. Only rows the sweep could not place ('other', 'unknown', NULL)
-- and never rows whose LeadSponsorClass already decided the type.

CREATE OR REPLACE FUNCTION public.radar_owner_type_from_name(p_name text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  WITH n AS (SELECT lower(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')) AS s)
  SELECT CASE
    WHEN s ~ '(hospital|hospitals|hôpital|hopital|hopitaux|hospices|clinic|clinics|clinique|clinica|medical cent(er|re)|health system|health network|health services|health sciences cent(er|re)|health sciences|health care\M|trihealth|langone health|health (and|&) services|health$|infirmary|\mnhs\M|klinik|klinikum|ospedale|sjukhus|ziekenhuis|cancer cent(er|re)|cancer campus|comprehensive cancer|assistance publique|charit(e|é)|policlinico|krankenhaus|\mchu\M|centre hospitalier|centro hospitalar|onkologi|oncologi|oncology cent|sanit(a|à)|hospitalar)'
      THEN 'hospital'
    WHEN s ~ '(university|universite|université|universidad|universita|università|universitat|universität|universiteit|universitas|college|school of medicine|medical school|school of|academy|academ|faculty|polytechnic|institut\M|institute|instituto|istituto|research cent(er|re)|research institute|graduate school|\mcampus\M)'
      THEN 'academic'
    WHEN s ~ '(ministry|national institutes?|department of|government|public health|centers for disease|veterans affairs|health authority|agency|national health|federal|state of|province|municipal|\marmy\M|\mnavy\M|air force|military|national cancer|national center)'
      THEN 'government'
    WHEN s ~ '(\mgroup\M|network|consortium|consorzio|alliance|cooperative|foundation|fondazione|fondation|stiftung|fundaci(o|ó)n|fundação|society|association|\mtrust\M|\mfund\M|charity|federation|organization|organisation|initiative|coalition|council|studien|study group|forschung|clinical trials? (group|unit|limited|ltd)|trials (limited|ltd|group)|oncology group|cancer research uk|\mpath\M|development innovations|precog|beat aml|gwt-tud)'
      THEN 'network'
    WHEN s ~ '(pharma|biopharma|therapeutics?|biotech|biotechnology|biosciences?|biologics?|biological|biomedical|medicines|genomics|\mlabs\M|technologies|lifesciences|life sciences|holdings|biomed\M|diagnostics|biopharmaceutic|vaccines|genetics|\mplc\M|\mgmbh\M|\mag\M|\mco\.,? ?ltd|\minc\.?$|\mllc\.?$|\mltd\.?$|\mlimited$|\mcorp(oration)?\.?$|\ms\.?a\.?$|\mb\.?v\.?$|\mn\.?v\.?$|\mpty\M|\mpte\M|\moy$|\mab$|\ms\.?r\.?l\.?$|\ms\.?p\.?a\.?$)'
     AND s !~ '(m\.?d\.|associates|practice|research inc|research llc|research ltd|research gmbh|clinical research|medicine\M|physician|surgeons|dental|pain )'
      THEN 'industry'
    ELSE NULL
  END
  FROM n;
$$;

-- Institutions and networks first (the bulk), then the corporate tail.
WITH upd AS (
  UPDATE public.companies c
  SET owner_type = public.radar_owner_type_from_name(c.name)
  WHERE c.merged_into IS NULL
    AND (c.owner_type IS NULL OR c.owner_type IN ('other', 'unknown'))
    AND upper(coalesce(c.lead_sponsor_class, '')) NOT IN ('INDUSTRY', 'NIH', 'FED', 'OTHER_GOV', 'NETWORK')
    AND public.radar_owner_type_from_name(c.name) IN ('hospital', 'academic', 'government', 'network')
  RETURNING c.id, c.name, c.owner_type AS new_type
)
INSERT INTO public.radar_owner_type_retype_log (company_id, company_name, old_owner_type, new_owner_type, rule)
SELECT id, name, 'other', new_type, 'name_institution' FROM upd;

WITH upd AS (
  UPDATE public.companies c
  SET owner_type = 'industry'
  WHERE c.merged_into IS NULL
    AND (c.owner_type IS NULL OR c.owner_type IN ('other', 'unknown'))
    AND upper(coalesce(c.lead_sponsor_class, '')) NOT IN ('NIH', 'FED', 'OTHER_GOV', 'NETWORK')
    AND public.radar_owner_type_from_name(c.name) = 'industry'
  RETURNING c.id, c.name
)
INSERT INTO public.radar_owner_type_retype_log (company_id, company_name, old_owner_type, new_owner_type, rule)
SELECT id, name, 'other', 'industry', 'name_industry' FROM upd;

COMMENT ON FUNCTION public.radar_owner_type_from_company_type(text) IS
  'companies.company_type -> owner_type for companies the CT.gov sweep never classified (migration 142). Mirrors lib/ingestion/ctgov-sweep.ts deriveOwnerType().';
COMMENT ON FUNCTION public.radar_owner_type_from_name(text) IS
  'Widened sponsor-name heuristics (hospital, academic, government, network, industry) for LeadSponsorClass OTHER sponsors; null when undecided (migration 142).';
