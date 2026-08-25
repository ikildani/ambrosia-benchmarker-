-- Migration 085c — re-verification batch 1, applied to the correct rows (R79g)
--
-- Re-issues the three updates that 085's first form aimed at ids taken from the
-- wrong result set. Targets are resolved by licensor/licensee/announced_date and
-- every statement carries a matching guard, so a wrong identifier fails closed.

-- LaNova Medicines / Merck — LM-299
UPDATE deals SET
  asset_name = 'LM-299',
  indication_specific = 'solid tumours',
  territory = 'global',
  source_url = 'https://www.merck.com/news/merck-enters-into-exclusive-global-license-for-lm-299-an-investigational-anti-pd-1-vegf-bispecific-antibody-from-lanova-medicines-ltd/',
  source_type = 'press_release',
  verification_notes = 'R79g 2026-08-25: verified against Merck press release. $588M upfront, up to $2.7B milestones. Exclusive GLOBAL licence for LM-299 (anti-PD-1/VEGF bispecific). Corrected territory from ex_china; asset_name was the slug solid_tumors.'
WHERE licensor_name ILIKE 'LaNova Medicines' AND licensee_name ILIKE 'Merck'
  AND announced_date = '2024-12-04';

-- Ascentage Pharma / Takeda — olverembatinib option
UPDATE deals SET
  asset_name = 'olverembatinib',
  indication_category = 'chronic_myeloid_leukemia',
  indication_specific = 'chronic myeloid leukaemia and other haematological cancers',
  deal_type = 'option',
  royalty_low_pct = 12,
  royalty_high_pct = 19,
  source_url = 'https://www.takeda.com/newsroom/newsreleases/2024/takeda-signs-option-agreement-with-ascentage-pharma-to-enter-into-exclusive-global-license-for-olverembatinib/',
  source_type = 'press_release',
  verification_notes = 'R79g 2026-08-25: verified against Takeda press release, announced 2024-06-14. $100M option payment; option exercise fee plus milestones up to ~$1.2B; royalties 12-19%. Third-generation BCR-ABL TKI in CML. Rights ex PRC/HK/Macau/Taiwan/Russia. Structure is an option, not a licence. Haematology - not a solid-tumour comparable.'
WHERE licensor_name ILIKE 'Ascentage Pharma' AND licensee_name ILIKE 'Takeda'
  AND announced_date = '2024-06-14';

-- Innovent Biologics / Sanofi — re-verification failed, demoted
UPDATE deals SET
  verified = false,
  verification_status = 'rejected',
  verification_notes = 'R79g 2026-08-25: re-verification FAILED. No transaction matching Innovent as licensor to Sanofi at $300M upfront / $2.3B total for NSCLC on 2023-12-11 could be located. Public record: Sanofi-Innovent collaboration 2022-08-04 runs Sanofi -> Innovent (tusamitamab ravtansine, China rights, up to EUR 80M milestones payable to Sanofi) plus a separate ~EUR 300M Sanofi equity investment into Innovent. Direction, date, terms and territory all contradicted. Demoted from verified; retained for audit.'
WHERE licensor_name ILIKE 'Innovent Biologics' AND licensee_name ILIKE 'Sanofi'
  AND announced_date = '2023-12-11';
