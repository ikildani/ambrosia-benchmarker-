-- Fix: Prevent future dates in company deal stats
-- The update_company_deal_stats RPC had no upper bound on announced_date,
-- allowing future-dated deals to set last_deal_date into the future.

-- 1. Fix the RPC to filter out future dates
CREATE OR REPLACE FUNCTION update_company_deal_stats(p_company_id UUID)
RETURNS void AS $$
DECLARE
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
  -- Count deals (only past/present dates)
  SELECT
    COUNT(*) FILTER (WHERE announced_date > NOW() - INTERVAL '12 months' AND announced_date <= CURRENT_DATE),
    COUNT(*) FILTER (WHERE announced_date > NOW() - INTERVAL '24 months' AND announced_date <= CURRENT_DATE)
  INTO v_deals_12mo, v_deals_24mo
  FROM deals
  WHERE licensee_id = p_company_id;

  -- Average and median upfront
  SELECT
    AVG(upfront_usd),
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY upfront_usd)
  INTO v_avg_upfront, v_median_upfront
  FROM deals
  WHERE licensee_id = p_company_id AND upfront_usd IS NOT NULL AND announced_date <= CURRENT_DATE;

  -- Last deal (only past/present dates)
  SELECT modality, indication_category, announced_date
  INTO v_last_deal
  FROM deals
  WHERE licensee_id = p_company_id AND announced_date <= CURRENT_DATE
  ORDER BY announced_date DESC
  LIMIT 1;

  -- Distinct modalities and indications
  SELECT
    ARRAY_AGG(DISTINCT modality),
    ARRAY_AGG(DISTINCT indication_category) FILTER (WHERE indication_category IS NOT NULL)
  INTO v_modalities, v_indications
  FROM deals
  WHERE licensee_id = p_company_id AND announced_date <= CURRENT_DATE;

  -- Phase preferences
  SELECT
    MIN(phase_at_signing),
    MAX(phase_at_signing)
  INTO v_phase_min, v_phase_max
  FROM deals
  WHERE licensee_id = p_company_id AND announced_date <= CURRENT_DATE;

  -- Update company record
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. One-time cleanup: fix any existing future-dated entries
UPDATE companies SET last_deal_date = CURRENT_DATE WHERE last_deal_date > CURRENT_DATE;
