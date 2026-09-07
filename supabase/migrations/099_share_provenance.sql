-- 099: Persist calculation provenance on shared calculations.
--
-- Institutional users must be able to audit any number on a share page:
-- which engine version produced it, the deterministic input fingerprint,
-- the calibrated baseline (sample size / calibration date / source), the
-- benchmarks data release, and when the share was generated. Captured at
-- share-creation time by app/api/share/route.ts so it stays stable even
-- after the engine or benchmark data are updated.
--
-- Shape (JSONB, written by lib/financial/calculation-version.ts buildShareProvenance):
-- {
--   "engineVersion": "5.1.0",
--   "fingerprint": "v5.1.0-abc123",
--   "fingerprintSource": "rnpv-engine" | "shared-inputs",
--   "benchmarksVersion": "5.5",
--   "benchmarksLastUpdated": "2026-09-01",
--   "dealDatabaseSize": 1649,
--   "baseline": { "phase", "therapeuticArea", "totalValueMedian", "upfrontMedian",
--                 "royaltyBase", "royaltyMax", "sampleSize", "calibratedAt", "source",
--                 "rangeWidthPercent", "effectiveMultiplier", "dealTypeMultiplier" } | null,
--   "generatedAt": "2026-09-07T12:00:00.000Z"
-- }

ALTER TABLE shared_calculations
  ADD COLUMN IF NOT EXISTS provenance JSONB;

COMMENT ON COLUMN shared_calculations.provenance IS
  'Audit trail captured at share time: engine version, input fingerprint, baseline provenance (n/date/source), benchmarks data version, generatedAt. NULL for shares created before migration 099; the read API derives a fallback from inputs/results.';

-- Fingerprint lookups (e.g. "which shares were produced by engine vX / fingerprint Y").
CREATE INDEX IF NOT EXISTS idx_shared_calculations_provenance_fingerprint
  ON shared_calculations ((provenance->>'fingerprint'))
  WHERE provenance IS NOT NULL;
