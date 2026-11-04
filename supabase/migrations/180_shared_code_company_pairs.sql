-- 180: company records that hold the same development code with no deal between them (read-only).
-- A distinctive code (HRS-7085, TQB2825, IBI3011) is issued by one corporate family, so two holders
-- without a recorded license are usually one company under two names (often its Chinese legal name)
-- or a parent and its operating / trial subsidiary. Used to build hand-checked merge lists.
CREATE OR REPLACE FUNCTION public.radar_shared_code_company_pairs()
RETURNS TABLE (a_id uuid, a_name text, b_id uuid, b_name text, shared_codes bigint, codes text)
LANGUAGE sql STABLE SET statement_timeout TO '120s' AS $$
  WITH code_drugs AS (
    SELECT dm.id, dm.preferred_name FROM drug_master dm WHERE dm.preferred_name ~ '^[A-Z]{1,6}[- ]?[0-9]{2,6}[A-Z]?$'),
  holders AS (
    SELECT DISTINCT a.drug_master_id, a.company_id, c.name
    FROM clinical_assets a JOIN code_drugs d ON d.id = a.drug_master_id
    JOIN companies c ON c.id = a.company_id AND c.merged_into IS NULL
    WHERE a.owner_type = 'industry')
  SELECT h1.company_id, h1.name, h2.company_id, h2.name, count(*), string_agg(d.preferred_name, ',' ORDER BY d.preferred_name)
  FROM holders h1 JOIN holders h2 ON h1.drug_master_id = h2.drug_master_id AND h1.company_id < h2.company_id
  JOIN code_drugs d ON d.id = h1.drug_master_id
  WHERE NOT EXISTS (SELECT 1 FROM deals dl WHERE (dl.licensor_id = h1.company_id AND dl.licensee_id = h2.company_id)
                                             OR (dl.licensor_id = h2.company_id AND dl.licensee_id = h1.company_id))
  GROUP BY 1, 2, 3, 4
$$;
REVOKE ALL ON FUNCTION public.radar_shared_code_company_pairs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.radar_shared_code_company_pairs() TO service_role;
