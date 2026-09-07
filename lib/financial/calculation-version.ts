/**
 * Calculation versioning for reproducibility.
 * Generates a deterministic hash from inputs + engine version
 * so institutional users can verify reproducibility.
 *
 * Also exposes the provenance helpers used by every export / share surface
 * (Excel, scenario comparison, share page) so an auditor can trace any
 * number back to the engine version, the input fingerprint, the calibrated
 * baseline and the benchmarks data release that produced it.
 */

import benchmarksData from '@/data/benchmarks.json';
import { LIVE_DEAL_COUNT } from '@/lib/config/constants';

const ENGINE_VERSION = '5.1.0';

export function computeCalculationFingerprint(inputs: Record<string, unknown>): string {
  const canonical = JSON.stringify(inputs, Object.keys(inputs).sort());
  let hash = 0;
  for (let i = 0; i < canonical.length; i++) {
    const char = canonical.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 32-bit integer
  }
  return `v${ENGINE_VERSION}-${Math.abs(hash).toString(36)}`;
}

export { ENGINE_VERSION };

// ── Benchmarks data release ─────────────────────────────────────────────────

export interface BenchmarksDataVersion {
  /** data/benchmarks.json metadata.version, e.g. "5.5". */
  version: string;
  /** data/benchmarks.json metadata.lastUpdated (ISO date), e.g. "2026-09-01". */
  lastUpdated: string;
}

/** Static benchmarks release shipped with this build. */
export function getBenchmarksDataVersion(): BenchmarksDataVersion {
  const meta = (benchmarksData as { metadata?: { version?: string; lastUpdated?: string } }).metadata;
  return {
    version: String(meta?.version ?? 'unknown'),
    lastUpdated: String(meta?.lastUpdated ?? 'unknown'),
  };
}

// ── Engine provenance ───────────────────────────────────────────────────────

export interface EngineProvenance {
  engineVersion: string;
  /** Deterministic hash of the canonicalised inputs, prefixed with the engine version. */
  fingerprint: string;
  benchmarksVersion: string;
  benchmarksLastUpdated: string;
  /** Size of the verified deal database this build was calibrated against. */
  dealDatabaseSize: number;
}

/**
 * Engine version + input fingerprint + benchmarks release for a given input
 * object. Pass the same object the engine was run with (CalculationInput for
 * the deal-terms engine, RNPVInput for the rNPV engine) so the fingerprint
 * matches what the engine stamped on its own result.
 */
export function getEngineProvenance(input: Record<string, unknown>): EngineProvenance {
  const bench = getBenchmarksDataVersion();
  return {
    engineVersion: ENGINE_VERSION,
    fingerprint: computeCalculationFingerprint(input),
    benchmarksVersion: bench.version,
    benchmarksLastUpdated: bench.lastUpdated,
    dealDatabaseSize: LIVE_DEAL_COUNT,
  };
}

// ── Baseline provenance (subset persisted on shares) ────────────────────────

/** Minimal, JSON-safe view of CalculationResult.drillDown.totalDealValue.baseline. */
export interface BaselineProvenanceSummary {
  phase?: string;
  therapeuticArea?: string;
  totalValueMedian?: number;
  upfrontMedian?: number;
  royaltyBase?: number;
  royaltyMax?: number;
  sampleSize?: number | null;
  calibratedAt?: string | null;
  source?: 'calibrated' | 'static';
  rangeWidthPercent?: number;
  effectiveMultiplier?: number;
  dealTypeMultiplier?: number;
}

const BASELINE_KEYS: (keyof BaselineProvenanceSummary)[] = [
  'phase', 'therapeuticArea', 'totalValueMedian', 'upfrontMedian', 'royaltyBase', 'royaltyMax',
  'sampleSize', 'calibratedAt', 'source', 'rangeWidthPercent', 'effectiveMultiplier', 'dealTypeMultiplier',
];

/**
 * Pull the baseline provenance out of a (possibly partial / deserialised)
 * CalculationResult. Returns null when the result carries no baseline.
 */
export function extractBaselineProvenance(results: unknown): BaselineProvenanceSummary | null {
  const r = results as { drillDown?: { totalDealValue?: { baseline?: Record<string, unknown> } } } | null | undefined;
  const baseline = r?.drillDown?.totalDealValue?.baseline;
  if (!baseline || typeof baseline !== 'object') return null;
  const out: BaselineProvenanceSummary = {};
  for (const key of BASELINE_KEYS) {
    const v = baseline[key];
    if (v !== undefined) (out as Record<string, unknown>)[key] = v;
  }
  return Object.keys(out).length > 0 ? out : null;
}

// ── Share provenance (persisted in shared_calculations.provenance) ──────────

export interface ShareProvenance extends EngineProvenance {
  /** Where the fingerprint came from: engine-stamped rNPV result or the shared input record. */
  fingerprintSource: 'rnpv-engine' | 'shared-inputs';
  baseline: BaselineProvenanceSummary | null;
  /** ISO timestamp of when the calculation was shared / the record generated. */
  generatedAt: string;
}

/**
 * Build the provenance record stored alongside a shared calculation.
 * Prefers the fingerprint the rNPV engine stamped on the result (when the
 * financial model was folded into `results`); otherwise fingerprints the
 * shared input record so the share is still reproducible from what it carries.
 */
export function buildShareProvenance(
  inputs: Record<string, unknown>,
  results: unknown,
  generatedAt: Date = new Date(),
): ShareProvenance {
  const base = getEngineProvenance(inputs);
  const r = results as { financialModel?: { rnpv?: { calculationFingerprint?: string } } } | null | undefined;
  const engineFingerprint = r?.financialModel?.rnpv?.calculationFingerprint;
  return {
    ...base,
    fingerprint: engineFingerprint || base.fingerprint,
    fingerprintSource: engineFingerprint ? 'rnpv-engine' : 'shared-inputs',
    baseline: extractBaselineProvenance(results),
    generatedAt: generatedAt.toISOString(),
  };
}

/** One-line audit footer: "Engine v5.1.0 · fingerprint v5.1.0-abc · baseline calibrated 2026-09-01 (n=412)". */
export function formatProvenanceFooter(
  p: { engineVersion: string; fingerprint: string },
  baseline?: BaselineProvenanceSummary | null,
): string {
  const parts = [`Engine v${p.engineVersion}`, `fingerprint ${p.fingerprint}`];
  if (baseline?.calibratedAt) {
    const date = baseline.calibratedAt.slice(0, 10);
    const n = baseline.sampleSize != null ? ` (n=${baseline.sampleSize})` : '';
    parts.push(`baseline calibrated ${date}${n}`);
  } else if (baseline) {
    parts.push('baseline: static benchmarks');
  }
  return parts.join(' · ');
}
