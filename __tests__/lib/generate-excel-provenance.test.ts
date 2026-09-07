/**
 * Excel export provenance: the "Assumptions & Provenance" sheet must let an
 * institutional user audit every exported number — engine version, input
 * fingerprint, every wizard input, every modifier (shown vs. applied), the
 * calibrated baseline and the benchmarks data release.
 */

import type ExcelJS from 'exceljs';
import { calculateDealTerms, type CalculationInput } from '@/lib/calculations';
import { buildExcelWorkbook, flattenInputsForSheet } from '@/lib/generateExcel';
import {
  ENGINE_VERSION,
  computeCalculationFingerprint,
  getEngineProvenance,
  getBenchmarksDataVersion,
  buildShareProvenance,
  extractBaselineProvenance,
  formatProvenanceFooter,
} from '@/lib/financial/calculation-version';
import { LIVE_DEAL_COUNT } from '@/lib/config/constants';

const baseInput: CalculationInput = {
  therapeuticArea: 'oncology',
  phase: 'phase2',
  modality: 'smallMolecule',
  indication: 'lung_nsclc',
  territory: 'global',
  biomarker: 'unselected',
  lineOfTherapy: '2L',
  treatmentApproach: 'symptomatic',
  combinationPotential: 'some',
  competitivePosition: 'racing',
  dataQuality: 'promising',
  regulatoryDesignations: { fastTrack: true, breakthrough: false, orphan: false, prime: false },
  molecularTargets: ['KRAS G12C'],
};

function sheetText(ws: ExcelJS.Worksheet): string[] {
  const out: string[] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    row.eachCell({ includeEmpty: false }, (cell) => {
      const v = cell.value;
      if (v === null || v === undefined) return;
      out.push(typeof v === 'object' && 'richText' in (v as object) ? JSON.stringify(v) : String(v));
    });
  });
  return out;
}

const GENERATED_AT = new Date('2026-09-07T10:30:00.000Z');

describe('Excel export — Assumptions & Provenance sheet', () => {
  const result = calculateDealTerms(baseInput);
  const wb = buildExcelWorkbook(
    result,
    { modality: baseInput.modality, phase: baseInput.phase, indication: baseInput.indication, territory: baseInput.territory },
    undefined,
    baseInput.therapeuticArea,
    baseInput.treatmentApproach,
    undefined,
    { input: baseInput, comparableCount: 7 },
    GENERATED_AT,
  );
  const sheet = wb.getWorksheet('Assumptions & Provenance');
  const text = sheet ? sheetText(sheet) : [];
  const joined = text.join('\n');

  it('adds the sheet to the workbook', () => {
    expect(sheet).toBeDefined();
    expect(wb.worksheets.map((w) => w.name)).toContain('Assumptions & Provenance');
    // Methodology stays the last sheet
    expect(wb.worksheets[wb.worksheets.length - 1].name).toBe('Methodology');
  });

  it('contains the engine version and the input fingerprint', () => {
    const expected = computeCalculationFingerprint(baseInput as unknown as Record<string, unknown>);
    expect(joined).toContain(`v${ENGINE_VERSION}`);
    expect(joined).toContain(expected);
    expect(expected.startsWith(`v${ENGINE_VERSION}-`)).toBe(true);
  });

  it('contains the benchmarks data version, deal database size and generation timestamp', () => {
    const bench = getBenchmarksDataVersion();
    expect(joined).toContain(bench.version);
    expect(joined).toContain(bench.lastUpdated);
    expect(text).toContain(String(LIVE_DEAL_COUNT));
    expect(joined).toContain(GENERATED_AT.toISOString());
  });

  it('lists every wizard input with a human label, including nested designations', () => {
    expect(joined).toContain('Therapeutic Area');
    expect(joined).toContain('Development Phase');
    expect(joined).toContain('Line of Therapy');
    expect(joined).toContain('Regulatory Designations · Fast Track');
    expect(joined).toContain('Molecular Targets');
    expect(joined).toContain('KRAS G12C');
    // Headline fields use the engine's own display labels
    expect(joined).toContain(result.labels.modality);
    expect(joined).toContain(result.labels.indication);
  });

  it('lists every modifier with its shown multiplier and applied value', () => {
    expect(result.modifiers.length).toBeGreaterThan(0);
    for (const m of result.modifiers) {
      expect(text).toContain(m.name);
    }
    expect(joined).toContain('MODIFIERS (shown vs. applied)');
    const rows: (string | number)[][] = [];
    sheet!.eachRow((row) => rows.push(row.values as (string | number)[]));
    const modRows = rows.filter((r) => result.modifiers.some((m) => r[1] === m.name));
    expect(modRows.length).toBe(result.modifiers.length);
    for (const r of modRows) {
      expect(typeof r[2]).toBe('number'); // multiplier
    }
  });

  it('shows the baseline provenance fields', () => {
    const baseline = result.drillDown.totalDealValue.baseline;
    expect(baseline).toBeDefined();
    expect(joined).toContain('BASELINE PROVENANCE');
    expect(text).toContain(String(baseline!.totalValueMedian));
    expect(text).toContain(String(baseline!.upfrontMedian));
    expect(joined).toContain('Baseline Sample Size');
    expect(joined).toContain('Baseline Calibrated At');
    expect(joined).toContain(baseline!.source === 'calibrated' ? 'Calibrated from disclosed deals' : 'Static benchmarks');
  });

  it('records the comparable-deal count passed in', () => {
    const rows: (string | number)[][] = [];
    sheet!.eachRow((row) => rows.push(row.values as (string | number)[]));
    const compRow = rows.find((r) => r[1] === 'Comparable Deals Shown (n)');
    expect(compRow?.[2]).toBe(7);
  });

  it('puts a one-line provenance footer on the Executive Summary sheet', () => {
    const summary = wb.getWorksheet('Executive Summary')!;
    const summaryText = sheetText(summary).join('\n');
    const prov = getEngineProvenance(baseInput as unknown as Record<string, unknown>);
    expect(summaryText).toContain(`Engine v${ENGINE_VERSION}`);
    expect(summaryText).toContain(`fingerprint ${prov.fingerprint}`);
    expect(summaryText).toMatch(/baseline calibrated \d{4}-\d{2}-\d{2}|baseline: static benchmarks/);
  });

  it('falls back to headline inputs when the full input is not supplied', () => {
    const wb2 = buildExcelWorkbook(
      result,
      { modality: 'smallMolecule', phase: 'phase2', indication: 'lung_nsclc', territory: 'global' },
      undefined,
      'oncology',
    );
    const s2 = wb2.getWorksheet('Assumptions & Provenance')!;
    const t2 = sheetText(s2).join('\n');
    expect(t2).toContain('Headline inputs only');
    expect(t2).toContain('Modality');
    expect(t2).toContain('Territory');
  });
});

describe('flattenInputsForSheet', () => {
  it('skips undefined values and flattens nested objects', () => {
    const rows = flattenInputsForSheet({ phase: 'phase2', bbbPenetration: undefined, regulatoryDesignations: { orphan: true, prime: false } });
    const labels = rows.map((r) => r[0]);
    expect(labels).toEqual(['Development Phase', 'Regulatory Designations · Orphan Drug', 'Regulatory Designations · PRIME (EMA)']);
    expect(rows[1][1]).toBe('Yes');
    expect(rows[2][1]).toBe('No');
    expect(rows[0][2]).toBe('phase2'); // raw key preserved for auditability
  });
});

describe('calculation-version provenance helpers', () => {
  it('getEngineProvenance is deterministic and independent of key order', () => {
    const a = getEngineProvenance({ phase: 'phase2', modality: 'adc' });
    const b = getEngineProvenance({ modality: 'adc', phase: 'phase2' });
    expect(a.fingerprint).toBe(b.fingerprint);
    expect(a.engineVersion).toBe(ENGINE_VERSION);
    expect(a.dealDatabaseSize).toBe(LIVE_DEAL_COUNT);
    expect(a.benchmarksVersion).toBe(getBenchmarksDataVersion().version);
  });

  it('extracts the baseline from a real result and formats the footer', () => {
    const result = calculateDealTerms(baseInput);
    const b = extractBaselineProvenance(result);
    expect(b).not.toBeNull();
    expect(b!.totalValueMedian).toBe(result.drillDown.totalDealValue.baseline!.totalValueMedian);
    const footer = formatProvenanceFooter({ engineVersion: '5.1.0', fingerprint: 'v5.1.0-abc' }, { calibratedAt: '2026-09-01T00:00:00Z', sampleSize: 42, source: 'calibrated' });
    expect(footer).toBe('Engine v5.1.0 · fingerprint v5.1.0-abc · baseline calibrated 2026-09-01 (n=42)');
    expect(extractBaselineProvenance(null)).toBeNull();
    expect(extractBaselineProvenance({ drillDown: {} })).toBeNull();
  });

  it('buildShareProvenance prefers the rNPV engine fingerprint when present', () => {
    const inputs = { modality: 'adc', phase: 'phase2', indication: 'lung_nsclc', territory: 'global' };
    const when = new Date('2026-09-07T00:00:00.000Z');
    const plain = buildShareProvenance(inputs, { drillDown: { totalDealValue: { baseline: { sampleSize: 12, calibratedAt: '2026-09-01', source: 'calibrated' } } } }, when);
    expect(plain.fingerprintSource).toBe('shared-inputs');
    expect(plain.fingerprint).toBe(computeCalculationFingerprint(inputs));
    expect(plain.baseline?.sampleSize).toBe(12);
    expect(plain.generatedAt).toBe(when.toISOString());

    const stamped = buildShareProvenance(inputs, { financialModel: { rnpv: { calculationFingerprint: 'v5.1.0-zzz' } } }, when);
    expect(stamped.fingerprintSource).toBe('rnpv-engine');
    expect(stamped.fingerprint).toBe('v5.1.0-zzz');
    expect(stamped.baseline).toBeNull();
  });
});
