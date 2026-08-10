-- Add custom_assumptions column to calculations table
-- Stores user-overridden model assumptions (Pro feature) as JSONB
-- NULL means the calculation used all platform defaults (backward compatible)
ALTER TABLE calculations
ADD COLUMN IF NOT EXISTS custom_assumptions jsonb DEFAULT NULL;

-- Index for finding calculations that used custom assumptions (analytics)
CREATE INDEX IF NOT EXISTS idx_calculations_custom_assumptions_not_null
ON calculations ((custom_assumptions IS NOT NULL))
WHERE custom_assumptions IS NOT NULL;

COMMENT ON COLUMN calculations.custom_assumptions IS
  'User-overridden valuation model assumptions (Pro feature). NULL = platform defaults used. Contains keys: discountRate, phaseTransitionRates, phaseCosts, revenueCurve, cogsPercent, peakSalesOverride.';
