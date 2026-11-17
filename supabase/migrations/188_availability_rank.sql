-- 188: "Best fit" ranking — the model score, discounted for programs a buyer
-- cannot realistically license.
--
-- The intent model predicts licensing activity; it does not know that a
-- program is already partnered, belongs to a large pharma, is a sponsor's copy
-- of another company's drug, or is a lifecycle trial of an approved molecule.
-- On Nov 17 the feed head had AstraZeneca, Pfizer, Janssen and EMD Serono
-- programs, J&J-partnered RPGR and Roche-partnered petrelintide, and Everest's
-- run of Akeso's ivonescimab.
--
-- availability_reasons lists the reasons a program is less available;
-- score_rank = score_logit minus a penalty per reason (logit units, so -2 is
-- ~7x lower odds):
--   partnered            3.0  partnership_status = 'partnered'
--   originator_elsewhere 3.0  ownership unknown/licensee and the drug's
--                             originator lists its own program for the drug
--   large_pharma         2.0  owner company_type = 'large_pharma'
--   approved_molecule    1.5  drug_master.max_phase = 'approved'
--   licensee             1.0  ownership_status = 'licensee'
--   partial_deal         0.7  partially partnered under a confirmed deal
-- The displayed probability is unchanged; "Best fit" (sort key 'fit') orders
-- by score_rank and is the default sort. Computed at the end of every
-- radar_refresh_score_percentiles() run. Apply after 187. Idempotent.

ALTER TABLE public.clinical_assets
  ADD COLUMN IF NOT EXISTS score_rank double precision,
  ADD COLUMN IF NOT EXISTS availability_reasons text[];

COMMENT ON COLUMN public.clinical_assets.score_rank IS
  'score_logit minus availability penalties; orders the default "Best fit" sort (migration 188).';
COMMENT ON COLUMN public.clinical_assets.availability_reasons IS
  'Why a program is less available to license: partnered, originator_elsewhere, large_pharma, approved_molecule, licensee, partial_deal (migration 188).';

CREATE INDEX IF NOT EXISTS idx_clinical_assets_program_primary_rank
  ON public.clinical_assets (score_rank DESC NULLS LAST, id DESC) WHERE program_primary;

CREATE OR REPLACE FUNCTION public.radar_refresh_availability()
 RETURNS jsonb
 LANGUAGE plpgsql
 SET statement_timeout TO '120s'
AS $function$
DECLARE
  v_changed integer := 0;
BEGIN
  DROP TABLE IF EXISTS tmp_avail;
  CREATE TEMP TABLE tmp_avail ON COMMIT DROP AS
  WITH base AS (
    SELECT a.id, a.company_id, a.drug_master_id, a.score_logit, a.partnership_status, a.partnership_basis,
           a.ownership_status, c.company_type, dm.max_phase, dm.originator_company_id
    FROM public.clinical_assets a
    LEFT JOIN public.companies c ON c.id = a.company_id
    LEFT JOIN public.drug_master dm ON dm.id = a.drug_master_id
    WHERE a.program_primary
  ),
  originator_rows AS (
    SELECT DISTINCT o.company_id, o.drug_master_id
    FROM public.clinical_assets o
    WHERE o.program_primary AND o.drug_master_id IS NOT NULL
  ),
  r AS (
    SELECT b.id, b.score_logit,
           array_remove(ARRAY[
             CASE WHEN b.partnership_status = 'partnered' THEN 'partnered' END,
             CASE WHEN b.ownership_status IN ('unknown', 'licensee')
                   AND b.originator_company_id IS NOT NULL
                   AND b.originator_company_id IS DISTINCT FROM b.company_id
                   AND o.company_id IS NOT NULL THEN 'originator_elsewhere' END,
             CASE WHEN b.company_type = 'large_pharma' THEN 'large_pharma' END,
             CASE WHEN b.max_phase = 'approved' THEN 'approved_molecule' END,
             CASE WHEN b.ownership_status = 'licensee' THEN 'licensee' END,
             CASE WHEN b.partnership_status = 'partially_partnered' AND b.partnership_basis = 'deal_confirmed' THEN 'partial_deal' END
           ], NULL) AS reasons
    FROM base b
    LEFT JOIN originator_rows o ON o.company_id = b.originator_company_id AND o.drug_master_id = b.drug_master_id
  )
  SELECT id, reasons,
         score_logit - (
           3.0 * ('partnered' = ANY (reasons))::int
         + 3.0 * ('originator_elsewhere' = ANY (reasons))::int
         + 2.0 * ('large_pharma' = ANY (reasons))::int
         + 1.5 * ('approved_molecule' = ANY (reasons))::int
         + 1.0 * ('licensee' = ANY (reasons))::int
         + 0.7 * ('partial_deal' = ANY (reasons))::int
         ) AS rank
  FROM r;

  UPDATE public.clinical_assets a
     SET score_rank = t.rank,
         availability_reasons = t.reasons
    FROM tmp_avail t
   WHERE a.id = t.id
     AND (a.score_rank IS DISTINCT FROM t.rank OR a.availability_reasons IS DISTINCT FROM t.reasons);
  GET DIAGNOSTICS v_changed = ROW_COUNT;

  -- Non-primary rows never appear in the feed; keep them unranked.
  UPDATE public.clinical_assets a
     SET score_rank = NULL, availability_reasons = NULL
   WHERE NOT a.program_primary AND (a.score_rank IS NOT NULL OR a.availability_reasons IS NOT NULL);

  RETURN jsonb_build_object('changed', v_changed);
END;
$function$;

-- Between refresh runs the scorer rewrites score_logit: keep the program's
-- penalty (a new row starts unpenalized until the next refresh).
CREATE OR REPLACE FUNCTION public.clinical_assets_carry_score_rank()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.score_logit IS NULL THEN
    NEW.score_rank := NULL;
  ELSIF TG_OP = 'UPDATE' AND OLD.score_logit IS NOT NULL AND OLD.score_rank IS NOT NULL THEN
    NEW.score_rank := NEW.score_logit - (OLD.score_logit - OLD.score_rank);
  ELSIF NEW.program_primary THEN
    NEW.score_rank := NEW.score_logit;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_carry_score_rank ON public.clinical_assets;
CREATE TRIGGER trg_carry_score_rank
  BEFORE INSERT OR UPDATE OF score_logit ON public.clinical_assets
  FOR EACH ROW EXECUTE FUNCTION public.clinical_assets_carry_score_rank();

-- Percentiles: unchanged from 186, plus availability at the end.
CREATE OR REPLACE FUNCTION public.radar_refresh_score_percentiles()
 RETURNS jsonb
 LANGUAGE plpgsql
 SET statement_timeout TO '180s'
AS $function$
DECLARE
  v_ranked integer := 0;
  v_cleared integer := 0;
  v_low_power boolean := false;
  v_programs jsonb;
  v_availability jsonb;
BEGIN
  v_programs := public.radar_refresh_programs();

  SELECT COALESCE(b.low_power, false) INTO v_low_power
  FROM public.radar_score_models m
  JOIN public.radar_score_backtests b ON b.model_version = m.version
  WHERE m.is_active = true
  ORDER BY b.created_at DESC
  LIMIT 1;

  DROP TABLE IF EXISTS tmp_score_ranks;
  CREATE TEMP TABLE tmp_score_ranks ON COMMIT DROP AS
  WITH core AS (
    SELECT a.id, a.program_key,
           COALESCE(a.phase, 'unknown') || '|' || COALESCE(a.therapeutic_area, 'unknown') AS peer_key,
           COALESCE(a.score_probability, a.licensing_intent_score / 100.0) AS p,
           COALESCE(a.score_logit, '-Infinity'::double precision) AS lg
    FROM public.clinical_assets a
    WHERE a.licensing_intent_score IS NOT NULL
      AND a.program_primary
      AND a.owner_type = 'industry'
      AND a.partnership_status IN ('unpartnered', 'partially_partnered')
      AND a.ownership_status NOT IN ('comparator_or_background', 'marketed_other')
      AND a.phase IN ('preclinical', 'early_phase_1', 'phase_1', 'phase_1_2', 'phase_2', 'phase_2_3', 'phase_3')
  ),
  ranked AS (
    SELECT program_key,
           peer_key,
           round(100 * percent_rank() OVER (PARTITION BY peer_key ORDER BY p, lg))::smallint AS pct_peer,
           count(*) OVER (PARTITION BY peer_key) AS peer_n,
           round(100 * percent_rank() OVER (ORDER BY p, lg))::smallint AS pct_universe,
           avg(p) OVER (PARTITION BY peer_key) AS base_rate
    FROM core
  )
  SELECT a.id, r.peer_key, r.pct_peer, r.peer_n, r.pct_universe, r.base_rate
  FROM ranked r
  JOIN public.clinical_assets a ON a.program_key = r.program_key;

  UPDATE public.clinical_assets a
  SET score_pct_peer = r.pct_peer,
      score_peer_n = r.peer_n,
      score_peer_key = r.peer_key,
      score_pct_universe = r.pct_universe,
      score_base_rate = round(r.base_rate::numeric, 5),
      score_low_power = v_low_power
  FROM tmp_score_ranks r
  WHERE a.id = r.id
    AND (a.score_pct_peer IS DISTINCT FROM r.pct_peer
      OR a.score_peer_n IS DISTINCT FROM r.peer_n
      OR a.score_peer_key IS DISTINCT FROM r.peer_key
      OR a.score_pct_universe IS DISTINCT FROM r.pct_universe
      OR a.score_base_rate IS DISTINCT FROM round(r.base_rate::numeric, 5)
      OR a.score_low_power IS DISTINCT FROM v_low_power);
  GET DIAGNOSTICS v_ranked = ROW_COUNT;

  UPDATE public.clinical_assets a
  SET score_pct_peer = NULL, score_peer_n = NULL, score_peer_key = NULL,
      score_pct_universe = NULL, score_base_rate = NULL
  WHERE a.score_pct_peer IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM tmp_score_ranks r WHERE r.id = a.id);
  GET DIAGNOSTICS v_cleared = ROW_COUNT;

  v_availability := public.radar_refresh_availability();

  RETURN jsonb_build_object('ranked_changed', v_ranked, 'cleared', v_cleared, 'low_power', v_low_power,
                            'programs', v_programs, 'availability', v_availability);
END;
$function$;
