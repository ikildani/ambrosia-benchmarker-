-- Migration 085 — re-verification batch 1 (R79g)
--
-- Backfilling citations onto the 408 uncited 'verified' rows is not a
-- documentation exercise. Of the first four rows checked against primary
-- sources, three carried material factual errors and one does not correspond
-- to any transaction in the public record. The missing citation was hiding the
-- defect, not merely omitting a reference.
--
-- This workstream is therefore RE-VERIFICATION, not backfill. A row that cannot
-- be tied to a primary source loses verified status rather than keeping it.
--
-- NOTE ON HISTORY: the first attempt at this migration resolved three of the
-- four targets by ids taken from the wrong query result. One row (Myovant /
-- Pfizer) was overwritten and is restored in 085b; the other two were saved by
-- licensor_name guards and never changed. 085c re-issues the three corrections
-- against targets resolved by licensor/licensee/announced_date. Targets here are
-- addressed the same way — never by a bare id.

-- Hengrui / GSK. Real deal, mistagged. Lead asset HRS-9821 is a PDE3/4
-- inhibitor for COPD; the agreement spans Respiratory, Immunology &
-- Inflammation and Oncology across up to 12 programmes. Filing it under
-- oncology put a respiratory deal into oncology comparable sets.
UPDATE deals SET
  asset_name = 'HRS-9821 + 11 optioned programmes',
  therapeutic_area = 'respiratory',
  indication_category = 'copd',
  deal_type = 'option',
  announced_date = '2025-07-28',
  source_url = 'https://www.gsk.com/en-gb/media/press-releases/gsk-and-hengrui-pharma-enter-agreements/',
  source_type = 'press_release',
  verification_notes = 'R79g 2026-08-25: verified against GSK press release. $500M upfront across agreements, up to ~$12B milestones plus royalties. Lead asset HRS-9821 (PDE3/4, COPD); 11 further programmes optioned after Ph1. Territory worldwide ex mainland China/HK/Macau/Taiwan. Corrected from therapeutic_area=oncology, asset_name=multi-indication, announced_date=2025-07-01.'
WHERE licensor_name ILIKE 'Hengrui Pharma' AND licensee_name ILIKE 'GSK'
  AND upfront_usd = 500000000 AND total_deal_value_usd = 12500000000;
