import type ExcelJSType from 'exceljs';
import { SavedScenario, COMPARISON_METRICS } from './scenarioComparison';
import {
  ENGINE_VERSION,
  getBenchmarksDataVersion,
  computeCalculationFingerprint,
  extractBaselineProvenance,
  type BaselineProvenanceSummary,
} from './financial/calculation-version';
import { LIVE_DEAL_COUNT } from './config/constants';

/** Per-scenario audit trail shown in the Provenance block of both exports. */
export interface ScenarioProvenance {
  name: string;
  /** Fingerprint over the scenario's saved input record (engine-stamped rNPV fingerprint when present). */
  fingerprint: string;
  fingerprintSource: 'rnpv-engine' | 'saved-inputs';
  baseline: BaselineProvenanceSummary | null;
  savedAt: string;
}

export function getScenarioProvenance(scenario: SavedScenario): ScenarioProvenance {
  const engineFingerprint = scenario.results?.financialModel?.rnpv?.calculationFingerprint;
  return {
    name: scenario.name,
    fingerprint: engineFingerprint || computeCalculationFingerprint(scenario.inputs as Record<string, unknown>),
    fingerprintSource: engineFingerprint ? 'rnpv-engine' : 'saved-inputs',
    baseline: extractBaselineProvenance(scenario.results),
    savedAt: scenario.updated_at || scenario.created_at,
  };
}

function baselineLine(b: BaselineProvenanceSummary | null): string {
  if (!b) return 'Not available';
  const src = b.source === 'calibrated' ? 'Calibrated' : 'Static benchmarks';
  const n = b.sampleSize != null ? `n=${b.sampleSize}` : 'n/a';
  const date = b.calibratedAt ? b.calibratedAt.slice(0, 10) : 'n/a';
  return `${src} · ${n} · ${date}`;
}

/** Rows appended below the comparison table so every column can be audited. */
export function buildProvenanceRows(scenarios: SavedScenario[], generatedAt: Date = new Date()): (string | number)[][] {
  const bench = getBenchmarksDataVersion();
  const prov = scenarios.map(getScenarioProvenance);
  return [
    ['PROVENANCE'],
    ['Engine Version', ...scenarios.map(() => `v${ENGINE_VERSION}`)],
    ['Input Fingerprint', ...prov.map((p) => p.fingerprint)],
    ['Fingerprint Basis', ...prov.map((p) => (p.fingerprintSource === 'rnpv-engine' ? 'rNPV engine (full input)' : 'Saved scenario inputs'))],
    ['Baseline Source', ...prov.map((p) => (p.baseline ? (p.baseline.source === 'calibrated' ? 'Calibrated from disclosed deals' : 'Static benchmarks') : 'Not available'))],
    ['Baseline Sample Size (n)', ...prov.map((p) => (p.baseline?.sampleSize != null ? p.baseline.sampleSize : '—'))],
    ['Baseline Calibrated At', ...prov.map((p) => p.baseline?.calibratedAt ?? '—')],
    ['Baseline Total Value Median ($M)', ...prov.map((p) => p.baseline?.totalValueMedian ?? '—')],
    ['Effective Multiplier', ...prov.map((p) => (p.baseline?.effectiveMultiplier != null ? Math.round(p.baseline.effectiveMultiplier * 1000) / 1000 : '—'))],
    ['Scenario Saved At', ...prov.map((p) => p.savedAt)],
    ['Benchmarks Data Version', ...scenarios.map(() => `v${bench.version} (${bench.lastUpdated})`)],
    ['Deal Database Size', ...scenarios.map(() => LIVE_DEAL_COUNT)],
    ['Generated At (UTC)', ...scenarios.map(() => generatedAt.toISOString())],
    ['Source', ...scenarios.map(() => 'Solidus — solidus.ambrosiaventures.co')],
  ];
}

/**
 * Build the comparison workbook (no download). Exported for tests; the ExcelJS
 * module is passed in because the export path lazy-loads it to keep it out of
 * the main bundle.
 */
export function buildComparisonWorkbook(
  ExcelJS: typeof ExcelJSType,
  scenarios: SavedScenario[],
  generatedAt: Date = new Date()
): ExcelJSType.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Ambrosia Ventures';
  wb.created = generatedAt;

  const ws = wb.addWorksheet('Scenario Comparison');
  ws.columns = [{ width: 30 }, ...scenarios.map(() => ({ width: 28 }))];

  // Header row
  ws.addRow(['Metric', ...scenarios.map((s) => s.name)]);

  // Add all metrics
  COMPARISON_METRICS.forEach((metric) => {
    ws.addRow([metric.label, ...scenarios.map((s) => metric.getValue(s))]);
  });

  // Add empty row
  ws.addRow([]);

  // Add notes section if any scenarios have notes
  const scenariosWithNotes = scenarios.filter((s) => s.notes);
  if (scenariosWithNotes.length > 0) {
    ws.addRow(['SCENARIO NOTES']);
    scenariosWithNotes.forEach((s) => {
      ws.addRow([s.name, s.notes || '']);
    });
    ws.addRow([]);
  }

  // Provenance block: engine version, fingerprint, baseline n/date, data version, timestamp
  buildProvenanceRows(scenarios, generatedAt).forEach((row, i) => {
    const r = ws.addRow(row);
    if (i === 0) r.font = { bold: true };
  });

  return wb;
}

// Export comparison to Excel (ExcelJS + file-saver lazy-loaded to avoid 22MB in main bundle)
export async function exportComparisonToExcel(scenarios: SavedScenario[]): Promise<void> {
  const ExcelJS = (await import('exceljs')).default;
  const { saveAs } = await import('file-saver');
  const wb = buildComparisonWorkbook(ExcelJS, scenarios);

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `scenario-comparison-${new Date().toISOString().split('T')[0]}.xlsx`);
}

// Export comparison to PDF (via print)
export function exportComparisonToPDF(scenarios: SavedScenario[]): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to export PDF');
    return;
  }

  const html = generateComparisonPDFHTML(scenarios);
  printWindow.document.write(html);
  printWindow.document.close();

  // Wait for content to load then print
  printWindow.onload = () => {
    printWindow.print();
  };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function generateComparisonPDFHTML(scenarios: SavedScenario[], generatedAt: Date = new Date()): string {
  const dealInfoMetrics = COMPARISON_METRICS.filter((m) => m.category === 'dealInfo');
  const financialMetrics = COMPARISON_METRICS.filter((m) => m.category === 'financial');
  const derivedMetrics = COMPARISON_METRICS.filter((m) => m.category === 'derived');
  const bench = getBenchmarksDataVersion();
  const prov = scenarios.map(getScenarioProvenance);

  const provenanceSection = `
    <tr class="section-header">
      <td colspan="${scenarios.length + 1}">Provenance</td>
    </tr>
    <tr><td class="metric-label">Engine Version</td>${scenarios.map(() => `<td class="metric-value">v${ENGINE_VERSION}</td>`).join('')}</tr>
    <tr><td class="metric-label">Input Fingerprint</td>${prov.map((p) => `<td class="metric-value mono">${escapeHtml(p.fingerprint)}</td>`).join('')}</tr>
    <tr><td class="metric-label">Baseline (source · n · calibrated)</td>${prov.map((p) => `<td class="metric-value">${escapeHtml(baselineLine(p.baseline))}</td>`).join('')}</tr>
    <tr><td class="metric-label">Scenario Saved At</td>${prov.map((p) => `<td class="metric-value">${escapeHtml(p.savedAt)}</td>`).join('')}</tr>
    <tr><td class="metric-label">Benchmarks Data Version</td>${scenarios.map(() => `<td class="metric-value">v${escapeHtml(bench.version)} (${escapeHtml(bench.lastUpdated)})</td>`).join('')}</tr>
    <tr><td class="metric-label">Deal Database Size</td>${scenarios.map(() => `<td class="metric-value">${LIVE_DEAL_COUNT.toLocaleString()} verified deals</td>`).join('')}</tr>
    <tr><td class="metric-label">Generated At (UTC)</td>${scenarios.map(() => `<td class="metric-value">${generatedAt.toISOString()}</td>`).join('')}</tr>
  `;

  const renderSection = (title: string, metrics: typeof COMPARISON_METRICS) => `
    <tr class="section-header">
      <td colspan="${scenarios.length + 1}">${title}</td>
    </tr>
    ${metrics
      .map(
        (metric) => `
      <tr>
        <td class="metric-label">${metric.label}</td>
        ${scenarios.map((s) => `<td class="metric-value">${metric.getValue(s)}</td>`).join('')}
      </tr>
    `
      )
      .join('')}
  `;

  return `
<!DOCTYPE html>
<html>
<head>
  <title>Scenario Comparison Report - Ambrosia Ventures</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 40px;
      color: #1a1e42;
      max-width: 1000px;
      margin: 0 auto;
    }
    .header {
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 2px solid #14b8a6;
    }
    .logo {
      font-size: 24px;
      font-weight: 700;
      color: #1a1e42;
      margin-bottom: 4px;
    }
    .subtitle {
      color: #14b8a6;
      font-size: 14px;
      font-weight: 500;
    }
    .date {
      color: #6b7280;
      font-size: 12px;
      margin-top: 8px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
    }
    th {
      background: #f9fafb;
      padding: 12px;
      text-align: left;
      font-weight: 600;
      font-size: 12px;
      text-transform: uppercase;
      color: #6b7280;
      border-bottom: 2px solid #e5e7eb;
    }
    th:not(:first-child) {
      text-align: right;
    }
    td {
      padding: 10px 12px;
      border-bottom: 1px solid #e5e7eb;
      font-size: 13px;
    }
    .section-header td {
      background: #f3f4f6;
      font-weight: 600;
      font-size: 11px;
      text-transform: uppercase;
      color: #6b7280;
      padding: 8px 12px;
    }
    .metric-label {
      color: #4b5563;
      font-weight: 500;
    }
    .metric-value {
      text-align: right;
      color: #1a1e42;
    }
    .mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 11px;
    }
    .notes-section {
      margin-top: 30px;
      padding: 20px;
      background: #fef3c7;
      border-radius: 8px;
    }
    .notes-section h3 {
      margin: 0 0 12px 0;
      font-size: 14px;
      color: #92400e;
    }
    .note-item {
      margin-bottom: 8px;
    }
    .note-item strong {
      color: #92400e;
    }
    .note-item p {
      margin: 4px 0 0 0;
      color: #78350f;
      font-size: 13px;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      font-size: 11px;
      color: #9ca3af;
      text-align: center;
    }
    @media print {
      body { padding: 20px; }
      .header { page-break-after: avoid; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">Ambrosia Ventures</div>
    <div class="subtitle">Solidus - Scenario Comparison</div>
    <div class="date">Generated on ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Metric</th>
        ${scenarios.map((s) => `<th>${s.name}</th>`).join('')}
      </tr>
    </thead>
    <tbody>
      ${renderSection('Deal Information', dealInfoMetrics)}
      ${renderSection('Financial Terms', financialMetrics)}
      ${renderSection('Analysis', derivedMetrics)}
      ${provenanceSection}
    </tbody>
  </table>

  ${
    scenarios.some((s) => s.notes)
      ? `
  <div class="notes-section">
    <h3>Scenario Notes</h3>
    ${scenarios
      .filter((s) => s.notes)
      .map(
        (s) => `
      <div class="note-item">
        <strong>${s.name}</strong>
        <p>${s.notes}</p>
      </div>
    `
      )
      .join('')}
  </div>
  `
      : ''
  }

  <div class="footer">
    <p>Generated by Solidus | solidus.ambrosiaventures.co</p>
    <p>Engine v${ENGINE_VERSION} · Benchmarks data v${escapeHtml(bench.version)} (${escapeHtml(bench.lastUpdated)}) · Generated ${generatedAt.toISOString()}</p>
    <p>This report is for informational purposes only and should not be considered financial or legal advice.</p>
  </div>
</body>
</html>`;
}
