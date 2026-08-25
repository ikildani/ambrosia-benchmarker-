-- Migration 085b — revert a misapplied update (R79g corrigendum)
--
-- Migration 085's first form targeted four rows by id. One id was taken from the
-- wrong query result: f5a10039-eb9c-492a-afee-d1dc677e3af4 is Myovant Sciences /
-- Pfizer, not LaNova / Merck. That row received LaNova's asset_name,
-- indication_specific and source_url before the error was caught.
--
-- The other two misdirected updates were no-ops: both carried a licensor_name
-- guard (ILIKE 'Ascentage%' / ILIKE 'Innovent%') that did not match, so Karuna /
-- BMS and Intra-Cellular / J&J were untouched. Confirmed by query afterwards.
--
-- Lesson encoded in 085c: resolve targets by licensor/licensee/date and always
-- carry a guard, so a wrong identifier fails closed instead of writing.
--
-- Prior values recovered from data/comparable-deals-extended.ts row onc-new-006,
-- the pre-change export of this corpus.
--
-- Set to 'pending' rather than back to 'verified': it carried no citation before,
-- and should not regain verified status without one. Its stored terms are also
-- independently doubtful — $11.6B for a Pfizer acquisition of Myovant does not
-- match the public record, in which Sumitovant / Sumitomo acquired Myovant in
-- 2022 while Pfizer held a relugolix collaboration.

UPDATE deals SET
  asset_name          = 'prostate',
  indication_specific = 'prostate',
  territory           = 'global',
  source_url          = NULL,
  source_type         = NULL,
  verified            = false,
  verification_status = 'pending',
  verification_notes  = 'R79g corrigendum 2026-08-25: this row was briefly overwritten with LaNova/Merck LM-299 values by a misapplied UPDATE and has been restored from the pre-change export (data/comparable-deals-extended.ts, onc-new-006). Set to pending, not verified: it never carried a citation, and its stored terms are doubtful - $11.6B upfront for "Pfizer acquires Myovant" conflicts with the public record (Sumitovant/Sumitomo acquired Myovant in 2022; Pfizer held a relugolix collaboration). Requires full re-verification before any client use.'
WHERE id = 'f5a10039-eb9c-492a-afee-d1dc677e3af4'
  AND licensor_name ILIKE 'Myovant%' AND licensee_name ILIKE 'Pfizer%';
