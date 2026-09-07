/**
 * Scenario comparison export provenance: both the Excel and the PDF/HTML
 * comparison carry a Provenance block (engine version, per-scenario input
 * fingerprint, baseline n/date, benchmarks data version, timestamp).
 */

import ExcelJS from 'exceljs';
import { calculateDealTerms, type CalculationInput } from '@/lib/calculations';
import type { SavedScenario } from '@/lib/scenarioComparison';
import {
  buildComparisonWorkbook,
  buildProvenanceRows,
  generateComparisonPDFHTML,
  getScenarioProvenance,
} from '@/lib/exportComparison';
import { ENGINE_VERSION, computeCalculationFingerprint, getBenchmarksDataVersion } from '@/lib/financial/calculation-version';

const input: CalculationInput = {
  therapeuticArea: 'oncology',
  phase: 'phase2',
  modality: 'adc',
  indication: 'lung_nsclc',
  territory: 'global',
  biomarker: 'selected',
  lineOfTherapy: '2L',
  treatmentApproach: 'diseaseModifying',
  combinationPotential: 'some',
  competitivePosition: 'bestInClass',
  dataQuality: 'strongPhase2',
  regulatoryDesignations: { fastTrack: false, breakthrough: true, orphan: false, prime: false },
};

function makeScenario(id: string, name: string, overrides: Partial<CalculationInput> = {}): SavedScenario {
  const merged = { ...input, ...overrides };
  const results = calculateDealTerms(merged);
  return {
    id,
    name,
    inputs: Object.fromEntries(Object.entries(merged).filter(([, v]) => typeof v === 'string')) as Record<string, string>,
    results,
    labels: results.labels,
    created_at: '2026-09-01T12:00:00.000Z',
  };
}

const GENERATED_AT = new Date('2026-09-07T10:30:00.000Z');
const scenarios = [makeScenario('a', 'Base case'), makeScenario('b', 'Phase 3', { phase: 'phase3' })];

describe('scenario comparison — Provenance block', () => {
  it('buildProvenanceRows carries engine version, fingerprints, baseline and timestamp per scenario', () => {
    const rows = buildProvenanceRows(scenarios, GENERATED_AT);
    const byLabel = Object.fromEntries(rows.map((r) => [r[0], r.slice(1)]));
    expect(rows[0]).toEqual(['PROVENANCE']);
    expect(byLabel['Engine Version']).toEqual([`v${ENGINE_VERSION}`, `v${ENGINE_VERSION}`]);
    expect(byLabel['Input Fingerprint']).toEqual(scenarios.map((s) => computeCalculationFingerprint(s.inputs)));
    // Different inputs → different fingerprints
    expect(byLabel['Input Fingerprint'][0]).not.toBe(byLabel['Input Fingerprint'][1]);
    expect(byLabel['Baseline Total Value Median ($M)']).toEqual(
      scenarios.map((s) => s.results.drillDown.totalDealValue.baseline!.totalValueMedian),
    );
    expect(byLabel['Baseline Sample Size (n)']).toHaveLength(2);
    expect(byLabel['Baseline Calibrated At']).toHaveLength(2);
    const bench = getBenchmarksDataVersion();
    expect(byLabel['Benchmarks Data Version'][0]).toBe(`v${bench.version} (${bench.lastUpdated})`);
    expect(byLabel['Generated At (UTC)'][0]).toBe(GENERATED_AT.toISOString());
  });

  it('Excel workbook includes the metrics table followed by the Provenance block', () => {
    const wb = buildComparisonWorkbook(ExcelJS, scenarios, GENERATED_AT);
    const ws = wb.getWorksheet('Scenario Comparison')!;
    const firstCol: string[] = [];
    ws.eachRow((row) => firstCol.push(String(row.getCell(1).value ?? '')));
    expect(firstCol[0]).toBe('Metric');
    expect(firstCol).toContain('PROVENANCE');
    expect(firstCol).toContain('Input Fingerprint');
    expect(firstCol).toContain('Engine Version');
    expect(firstCol).toContain('Generated At (UTC)');
    // Provenance comes after the metrics
    expect(firstCol.indexOf('PROVENANCE')).toBeGreaterThan(firstCol.indexOf('Metric'));
    let fpRow: ExcelJS.Row | undefined;
    ws.eachRow((row) => { if (row.getCell(1).value === 'Input Fingerprint') fpRow = row; });
    expect(fpRow).toBeDefined();
    expect(String(fpRow!.getCell(2).value)).toBe(getScenarioProvenance(scenarios[0]).fingerprint);
    expect(String(fpRow!.getCell(3).value)).toBe(getScenarioProvenance(scenarios[1]).fingerprint);
  });

  it('PDF HTML includes a Provenance section and footer line', () => {
    const html = generateComparisonPDFHTML(scenarios, GENERATED_AT);
    expect(html).toContain('>Provenance<');
    expect(html).toContain(`v${ENGINE_VERSION}`);
    for (const s of scenarios) expect(html).toContain(getScenarioProvenance(s).fingerprint);
    expect(html).toContain(GENERATED_AT.toISOString());
    expect(html).toContain('Baseline (source · n · calibrated)');
  });

  it('getScenarioProvenance prefers an engine-stamped fingerprint', () => {
    const s = makeScenario('c', 'Stamped');
    s.results = { ...s.results, financialModel: { rnpv: { calculationFingerprint: 'v5.1.0-stamped' } as never } };
    const p = getScenarioProvenance(s);
    expect(p.fingerprint).toBe('v5.1.0-stamped');
    expect(p.fingerprintSource).toBe('rnpv-engine');
    expect(getScenarioProvenance(scenarios[0]).fingerprintSource).toBe('saved-inputs');
  });
});
