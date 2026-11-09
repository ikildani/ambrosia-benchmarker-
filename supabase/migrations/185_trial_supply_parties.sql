-- Drug-supply parties on a trial: companies that originated one of the trial's interventions.
--
-- lib/radar/partnership.ts counted any industry collaborator on an asset's trial as partnership
-- evidence. On combination trials the collaborator is usually supplying its own drug for another
-- arm (at least 280 of 3,138 industry-collaborator flags, Nov 6 2026), which says nothing about
-- rights to the asset. The partnership refresh skips (nct, company) pairs returned here unless the
-- supplied drug is the asset's own (then the company is its licensor and the evidence stands).

CREATE OR REPLACE FUNCTION radar_trial_supply_parties(p_ncts text[])
RETURNS TABLE(nct_id text, company_id uuid, drug_id uuid)
LANGUAGE sql STABLE AS $$
  SELECT DISTINCT ti.nct_id, dm.originator_company_id, dm.id
    FROM trial_interventions ti
    JOIN drug_aliases da ON da.alias_normalized = ti.name_normalized
    JOIN drug_master dm ON dm.id = da.drug_id
   WHERE ti.nct_id = ANY(p_ncts)
     AND dm.originator_company_id IS NOT NULL
$$;

GRANT EXECUTE ON FUNCTION radar_trial_supply_parties(text[]) TO service_role;
