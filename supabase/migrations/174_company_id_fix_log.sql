-- 174: Company SEC ID correction (Oct 30 2026). Applied to production 2026-10-30 ahead of the PR.
--
-- 73 companies carried a CIK that SEC lists under another filer (BMS → Bank of America, J&J → Coca-Cola,
-- Gilead → Autodesk, Novartis → lululemon, AstraZeneca → Abbott, Sanofi → Illumina, Merck KGaA → Merck & Co.).
-- They came from wrong entries in PHARMA_CIKS, which sec-xbrl copied onto company rows with the filer's
-- revenue. The fix was run as data statements; this file records the tables that log it.
--
-- run 'cik_fix_20261030': 36 CIKs replaced with the SEC-confirmed CIK (ticker or exact name in SEC
--   company_tickers.json), 37 cleared; revenue cleared on all 73; 847 company_financials rows from the
--   wrong filer removed (full rows in old_values); company_financials cursor reset for the 36.
-- run 'merck_fix_20261030': 721 trials whose ClinicalTrials.gov sponsor/collaborator is Merck Sharp & Dohme
--   moved from Merck KGaA to Merck & Co. (692 were already on Merck & Co. and the KGaA copy was removed),
--   and 275 assets whose every trial is an MSD trial moved, ownership re-applied.
-- Every changed value is in company_id_fix_log.old_values.

CREATE TABLE IF NOT EXISTS public.company_id_fix_log (
  id bigserial PRIMARY KEY,
  run_id text NOT NULL,
  company_id uuid,
  step text NOT NULL,
  old_values jsonb NOT NULL,
  new_values jsonb,
  fixed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.company_id_fix_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.company_id_fix_log FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.company_id_fix_plan (
  run_id text, company_id uuid, old_cik text, new_cik text, how text
);
ALTER TABLE public.company_id_fix_plan ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.company_id_fix_plan FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.company_trial_fix_stage (
  run_id text NOT NULL, nct_id text NOT NULL, verdict text NOT NULL, merck_names text[]
);
ALTER TABLE public.company_trial_fix_stage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.company_trial_fix_stage FROM anon, authenticated;
