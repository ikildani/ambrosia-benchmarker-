-- 144: company deal stats count only quality deals, follow merges, and stay current.
--
-- Why (Sep 28 2026 audit): update_company_deal_stats counted every deals row where the
-- company was licensee, including synthetic, non-canonical (duplicate), rejected and flagged
-- rows, and ignored companies.merged_into. It only ran on INSERT, so later rejections,
-- dedupes and merges never reached the directory. Stored deals_last_12mo summed to 995
-- across companies against 301 quality deals (e.g. Eli Lilly 102 vs 34).
--
-- Quality filter = applyDealQualityFilter (lib/entities/resolve.ts):
--   is_synthetic = false AND is_canonical IS NOT FALSE
--   AND coalesce(verification_status,'') NOT IN ('rejected','flagged')
--
-- Rollback: re-create the previous function bodies (saved at the bottom of this file),
--   DROP TRIGGER deal_changed_company_stats ON deals (the INSERT trigger is unchanged), and
--   UPDATE companies c SET <cols> = b.<cols> FROM companies_stats_backup_20260928 b WHERE b.id = c.id.

-- ── Backup of every column this migration rewrites (restore source for rollback) ──
CREATE TABLE IF NOT EXISTS public.companies_stats_backup_20260928 AS
SELECT id, deals_last_12mo, deals_last_24mo, avg_upfront_usd, median_upfront_usd, last_deal_date,
       last_deal_modality, modalities_active, indications_active, phase_preference_min,
       phase_preference_max, data_quality_score, updated_at
FROM public.companies;
ALTER TABLE public.companies_stats_backup_20260928 ENABLE ROW LEVEL SECURITY;

-- ── Stats ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_company_deal_stats(p_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_merged_into uuid;
  v_ids uuid[];
  v_deals_12mo INTEGER;
  v_deals_24mo INTEGER;
  v_avg_upfront NUMERIC;
  v_median_upfront NUMERIC;
  v_last_deal RECORD;
  v_modalities TEXT[];
  v_indications TEXT[];
  v_phase_min TEXT;
  v_phase_max TEXT;
BEGIN
  SELECT merged_into INTO v_merged_into FROM companies WHERE id = p_company_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- A merged-away entity carries no stats of its own; its deals count on the survivor.
  IF v_merged_into IS NOT NULL THEN
    UPDATE companies SET
      deals_last_12mo = 0, deals_last_24mo = 0,
      avg_upfront_usd = NULL, median_upfront_usd = NULL,
      last_deal_date = NULL, last_deal_modality = NULL,
      modalities_active = ARRAY[]::TEXT[], indications_active = ARRAY[]::TEXT[],
      phase_preference_min = NULL, phase_preference_max = NULL,
      updated_at = NOW()
    WHERE id = p_company_id;
    RETURN;
  END IF;

  -- The company plus every entity merged into it (directly or through a chain).
  WITH RECURSIVE fam(id) AS (
    SELECT p_company_id
    UNION
    SELECT c.id FROM companies c JOIN fam ON c.merged_into = fam.id
  )
  SELECT array_agg(id) INTO v_ids FROM fam;

  SELECT
    COUNT(*) FILTER (WHERE d.announced_date > NOW() - INTERVAL '12 months'),
    COUNT(*) FILTER (WHERE d.announced_date > NOW() - INTERVAL '24 months'),
    AVG(d.upfront_usd),
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY d.upfront_usd),
    ARRAY_AGG(DISTINCT d.modality) FILTER (WHERE d.modality IS NOT NULL),
    ARRAY_AGG(DISTINCT d.indication_category) FILTER (WHERE d.indication_category IS NOT NULL),
    MIN(d.phase_at_signing),
    MAX(d.phase_at_signing)
  INTO v_deals_12mo, v_deals_24mo, v_avg_upfront, v_median_upfront, v_modalities, v_indications, v_phase_min, v_phase_max
  FROM deals d
  WHERE d.licensee_id = ANY (v_ids)
    AND d.is_synthetic = false
    AND d.is_canonical IS NOT FALSE
    AND coalesce(d.verification_status, '') NOT IN ('rejected', 'flagged')
    AND d.announced_date <= CURRENT_DATE;

  SELECT d.modality, d.indication_category, d.announced_date
  INTO v_last_deal
  FROM deals d
  WHERE d.licensee_id = ANY (v_ids)
    AND d.is_synthetic = false
    AND d.is_canonical IS NOT FALSE
    AND coalesce(d.verification_status, '') NOT IN ('rejected', 'flagged')
    AND d.announced_date <= CURRENT_DATE
  ORDER BY d.announced_date DESC NULLS LAST
  LIMIT 1;

  UPDATE companies SET
    deals_last_12mo = v_deals_12mo,
    deals_last_24mo = v_deals_24mo,
    avg_upfront_usd = v_avg_upfront,
    median_upfront_usd = v_median_upfront,
    last_deal_date = v_last_deal.announced_date,
    last_deal_modality = v_last_deal.modality,
    modalities_active = COALESCE(v_modalities, ARRAY[]::TEXT[]),
    indications_active = COALESCE(v_indications, ARRAY[]::TEXT[]),
    phase_preference_min = v_phase_min,
    phase_preference_max = v_phase_max,
    updated_at = NOW()
  WHERE id = p_company_id;
END;
$function$;

-- ── Data quality score: same filter and merge resolution for the deal-count component ──
CREATE OR REPLACE FUNCTION public.calculate_company_data_quality(p_company_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_score INTEGER := 0;
  v_company RECORD;
  v_deal_count INTEGER;
  v_trial_count INTEGER;
BEGIN
  SELECT * INTO v_company FROM companies WHERE id = p_company_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  -- Basic info (max 20)
  IF v_company.name IS NOT NULL THEN v_score := v_score + 5; END IF;
  IF v_company.company_type IS NOT NULL THEN v_score := v_score + 5; END IF;
  IF v_company.hq_country IS NOT NULL THEN v_score := v_score + 5; END IF;
  IF v_company.ticker IS NOT NULL THEN v_score := v_score + 5; END IF;

  -- Deal data (max 30): quality deals on this company and anything merged into it
  WITH RECURSIVE fam(id) AS (
    SELECT p_company_id
    UNION
    SELECT c.id FROM companies c JOIN fam ON c.merged_into = fam.id
  )
  SELECT COUNT(*) INTO v_deal_count
  FROM deals d
  WHERE d.licensee_id IN (SELECT id FROM fam)
    AND d.is_synthetic = false
    AND d.is_canonical IS NOT FALSE
    AND coalesce(d.verification_status, '') NOT IN ('rejected', 'flagged');
  IF v_company.merged_into IS NOT NULL THEN v_deal_count := 0; END IF;
  IF v_deal_count >= 1 THEN v_score := v_score + 10; END IF;
  IF v_deal_count >= 3 THEN v_score := v_score + 10; END IF;
  IF v_deal_count >= 5 THEN v_score := v_score + 10; END IF;

  -- Trial data (max 20)
  SELECT COUNT(*) INTO v_trial_count FROM company_trials WHERE company_id = p_company_id;
  IF v_trial_count >= 1 THEN v_score := v_score + 5; END IF;
  IF v_trial_count >= 5 THEN v_score := v_score + 5; END IF;
  IF v_trial_count >= 10 THEN v_score := v_score + 10; END IF;

  -- Therapeutic focus (max 20)
  IF array_length(v_company.modalities_active, 1) > 0 THEN v_score := v_score + 10; END IF;
  IF array_length(v_company.indications_active, 1) > 0 THEN v_score := v_score + 10; END IF;

  -- Recency (max 10)
  IF v_company.last_deal_date > NOW() - INTERVAL '12 months' THEN v_score := v_score + 10;
  ELSIF v_company.last_deal_date > NOW() - INTERVAL '24 months' THEN v_score := v_score + 5;
  END IF;

  UPDATE companies SET data_quality_score = v_score WHERE id = p_company_id;
  RETURN v_score;
END;
$function$;

-- ── Recompute a company and the survivor it rolls up to ──
CREATE OR REPLACE FUNCTION public.refresh_company_deal_stats(p_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_root uuid := p_company_id;
  v_next uuid;
  v_hops int := 0;
BEGIN
  IF p_company_id IS NULL THEN RETURN; END IF;
  PERFORM update_company_deal_stats(p_company_id);
  PERFORM calculate_company_data_quality(p_company_id);
  -- Walk merged_into to the survivor (bounded) and refresh it too.
  LOOP
    SELECT merged_into INTO v_next FROM companies WHERE id = v_root;
    EXIT WHEN v_next IS NULL OR v_hops >= 10;
    v_root := v_next; v_hops := v_hops + 1;
  END LOOP;
  IF v_root <> p_company_id THEN
    PERFORM update_company_deal_stats(v_root);
    PERFORM calculate_company_data_quality(v_root);
  END IF;
END;
$function$;

-- ── Keep stats current when a deal is rejected, deduped, re-dated, relinked or deleted ──
CREATE OR REPLACE FUNCTION public.trigger_deal_changed_company_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM refresh_company_deal_stats(OLD.licensee_id);
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.licensee_id IS DISTINCT FROM OLD.licensee_id THEN
    PERFORM refresh_company_deal_stats(NEW.licensee_id);
  END IF;
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS deal_changed_company_stats ON public.deals;
CREATE TRIGGER deal_changed_company_stats
AFTER UPDATE OF is_synthetic, is_canonical, verification_status, announced_date, licensee_id, upfront_usd, modality, indication_category, phase_at_signing
  OR DELETE ON public.deals
FOR EACH ROW EXECUTE FUNCTION public.trigger_deal_changed_company_stats();

-- ── One-off backfill: every company with stored stats or linked deals ──
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT id FROM companies
    WHERE coalesce(deals_last_24mo, 0) > 0
       OR last_deal_date IS NOT NULL
       OR merged_into IS NOT NULL AND coalesce(deals_last_12mo, 0) > 0
       OR id IN (SELECT DISTINCT licensee_id FROM deals WHERE licensee_id IS NOT NULL)
  LOOP
    PERFORM update_company_deal_stats(r.id);
    PERFORM calculate_company_data_quality(r.id);
  END LOOP;
END $$;

-- ── Previous definitions (for rollback) ──
-- update_company_deal_stats: same body without the quality filter, merged_into handling,
--   or search_path; every subquery used `FROM deals WHERE licensee_id = p_company_id`.
-- calculate_company_data_quality: deal count was
--   `SELECT COUNT(*) INTO v_deal_count FROM deals WHERE licensee_id = p_company_id;`
