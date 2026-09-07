-- 097_calculations_full_inputs.sql
--
-- Persist the complete wizard input set for every calculation so any run can
-- be reproduced. The existing scalar columns (therapeutic_area, modality,
-- development_phase, indication_*, territory_scope, deal_type, output_*) are
-- kept unchanged — admin/slack-summary, signals and data-export still read them.
--
-- All three columns are nullable: rows written before this migration, and any
-- request whose payload exceeds the 32 KB cap enforced in
-- app/api/calculations/route.ts, simply leave them NULL.

ALTER TABLE public.calculations
  ADD COLUMN IF NOT EXISTS inputs jsonb,
  ADD COLUMN IF NOT EXISTS modifiers jsonb,
  ADD COLUMN IF NOT EXISTS calculation_fingerprint text;

COMMENT ON COLUMN public.calculations.inputs IS
  'Full CalculationInput object as sent to calculateDealTerms() (all wizard fields incl. competitive position, data quality, biomarker, line of therapy, treatment approach, combination potential, regulatory designations, molecular targets, delivery route, differentiation factors, peak-sales override, TA-specific inputs and custom assumptions). NULL for legacy rows or payloads over 32 KB.';

COMMENT ON COLUMN public.calculations.modifiers IS
  'CalculationResult.modifiers array ({name, multiplier, context}[]) applied to the baseline for this run. NULL for legacy rows or payloads over 32 KB.';

COMMENT ON COLUMN public.calculations.calculation_fingerprint IS
  'Deterministic engine-version + input hash from lib/financial/calculation-version.ts (computeCalculationFingerprint), e.g. "v5.1.0-abc123". Used to verify reproducibility.';

CREATE INDEX IF NOT EXISTS calculations_calculation_fingerprint_idx
  ON public.calculations (calculation_fingerprint)
  WHERE calculation_fingerprint IS NOT NULL;
