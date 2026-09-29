-- 154: company deal counts cover both sides of a deal, exclude retired duplicates, and stay current.
-- Why (Sep 29 2026): /companies shows "Deals (12mo)" and sorts by "Most Active (Deals)", but
-- update_company_deal_stats counted only deals where the company was the licensee, so companies that
-- mostly out-license (Innovent, Haisco, Sangamo) showed 0. It also ignored duplicate_of (migration 150),
-- and the trigger did not fire on INSERT or on duplicate_of / licensor_id changes: 317 companies were stale.
-- Counts, last deal, modalities, indications: either side. Buyer-profile fields (avg/median upfront paid,
-- phase preference) stay licensee-only because buyer matching reads them.
-- Applied to prod via MCP on Sep 29 2026 and all 2,767 deal-party companies recomputed (0 mismatches after).
CREATE OR REPLACE FUNCTION public.update_company_deal_stats(p_company_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_merged_into uuid; v_ids uuid[]; v_deals_12mo INTEGER; v_deals_24mo INTEGER;
  v_avg_upfront NUMERIC; v_median_upfront NUMERIC; v_last_deal RECORD;
  v_modalities TEXT[]; v_indications TEXT[]; v_phase_min TEXT; v_phase_max TEXT;
BEGIN
  SELECT merged_into INTO v_merged_into FROM companies WHERE id = p_company_id;
  IF NOT FOUND THEN RETURN; END IF;
  IF v_merged_into IS NOT NULL THEN
    UPDATE companies SET deals_last_12mo = 0, deals_last_24mo = 0, avg_upfront_usd = NULL, median_upfront_usd = NULL,
      last_deal_date = NULL, last_deal_modality = NULL, modalities_active = ARRAY[]::TEXT[], indications_active = ARRAY[]::TEXT[],
      phase_preference_min = NULL, phase_preference_max = NULL, updated_at = NOW()
    WHERE id = p_company_id;
    RETURN;
  END IF;
  WITH RECURSIVE fam(id) AS (SELECT p_company_id UNION SELECT c.id FROM companies c JOIN fam ON c.merged_into = fam.id)
  SELECT array_agg(id) INTO v_ids FROM fam;

  SELECT COUNT(*) FILTER (WHERE d.announced_date > NOW() - INTERVAL '12 months'),
         COUNT(*) FILTER (WHERE d.announced_date > NOW() - INTERVAL '24 months'),
         ARRAY_AGG(DISTINCT d.modality) FILTER (WHERE d.modality IS NOT NULL),
         ARRAY_AGG(DISTINCT d.indication_category) FILTER (WHERE d.indication_category IS NOT NULL)
  INTO v_deals_12mo, v_deals_24mo, v_modalities, v_indications
  FROM deals d
  WHERE (d.licensee_id = ANY (v_ids) OR d.licensor_id = ANY (v_ids))
    AND d.is_synthetic = false AND d.is_canonical IS NOT FALSE AND d.duplicate_of IS NULL
    AND coalesce(d.verification_status, '') NOT IN ('rejected', 'flagged') AND d.announced_date <= CURRENT_DATE;

  SELECT AVG(d.upfront_usd), PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY d.upfront_usd), MIN(d.phase_at_signing), MAX(d.phase_at_signing)
  INTO v_avg_upfront, v_median_upfront, v_phase_min, v_phase_max
  FROM deals d
  WHERE d.licensee_id = ANY (v_ids)
    AND d.is_synthetic = false AND d.is_canonical IS NOT FALSE AND d.duplicate_of IS NULL
    AND coalesce(d.verification_status, '') NOT IN ('rejected', 'flagged') AND d.announced_date <= CURRENT_DATE;

  SELECT d.modality, d.indication_category, d.announced_date INTO v_last_deal
  FROM deals d
  WHERE (d.licensee_id = ANY (v_ids) OR d.licensor_id = ANY (v_ids))
    AND d.is_synthetic = false AND d.is_canonical IS NOT FALSE AND d.duplicate_of IS NULL
    AND coalesce(d.verification_status, '') NOT IN ('rejected', 'flagged') AND d.announced_date <= CURRENT_DATE
  ORDER BY d.announced_date DESC NULLS LAST LIMIT 1;

  UPDATE companies SET deals_last_12mo = v_deals_12mo, deals_last_24mo = v_deals_24mo,
    avg_upfront_usd = v_avg_upfront, median_upfront_usd = v_median_upfront,
    last_deal_date = v_last_deal.announced_date, last_deal_modality = v_last_deal.modality,
    modalities_active = COALESCE(v_modalities, ARRAY[]::TEXT[]), indications_active = COALESCE(v_indications, ARRAY[]::TEXT[]),
    phase_preference_min = v_phase_min, phase_preference_max = v_phase_max, updated_at = NOW()
  WHERE id = p_company_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_deal_changed_company_stats()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM refresh_company_deal_stats(OLD.licensee_id);
    IF OLD.licensor_id IS DISTINCT FROM OLD.licensee_id THEN PERFORM refresh_company_deal_stats(OLD.licensor_id); END IF;
  END IF;
  IF TG_OP = 'INSERT' THEN
    PERFORM refresh_company_deal_stats(NEW.licensee_id);
    IF NEW.licensor_id IS DISTINCT FROM NEW.licensee_id THEN PERFORM refresh_company_deal_stats(NEW.licensor_id); END IF;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.licensee_id IS DISTINCT FROM OLD.licensee_id THEN PERFORM refresh_company_deal_stats(NEW.licensee_id); END IF;
    IF NEW.licensor_id IS DISTINCT FROM OLD.licensor_id THEN PERFORM refresh_company_deal_stats(NEW.licensor_id); END IF;
  END IF;
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS deal_changed_company_stats ON public.deals;
CREATE TRIGGER deal_changed_company_stats
  AFTER INSERT OR DELETE OR UPDATE OF is_synthetic, is_canonical, duplicate_of, verification_status, announced_date, licensee_id, licensor_id, upfront_usd, modality, indication_category, phase_at_signing
  ON public.deals FOR EACH ROW EXECUTE FUNCTION trigger_deal_changed_company_stats();
