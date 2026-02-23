import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { SavedScenario, COMPARISON_METRICS } from './scenarioComparison';

// Export comparison to Excel
export async function exportComparisonToExcel(scenarios: SavedScenario[]): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Ambrosia Ventures';
  wb.created = new Date();

  const ws = wb.addWorksheet('Scenario Comparison');
  ws.columns = [{ width: 20 }, ...scenarios.map(() => ({ width: 25 }))];

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
  }

  // Add metadata
  ws.addRow([]);
  ws.addRow(['Generated', new Date().toLocaleString()]);
  ws.addRow(['Source', 'Ambrosia Ventures Deal Calculator']);

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

function generateComparisonPDFHTML(scenarios: SavedScenario[]): string {
  const dealInfoMetrics = COMPARISON_METRICS.filter((m) => m.category === 'dealInfo');
  const financialMetrics = COMPARISON_METRICS.filter((m) => m.category === 'financial');
  const derivedMetrics = COMPARISON_METRICS.filter((m) => m.category === 'derived');

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
    <div class="subtitle">Deal Calculator - Scenario Comparison</div>
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
    <p>Generated by Ambrosia Ventures Deal Calculator | calculator.ambrosiaventures.co</p>
    <p>This report is for informational purposes only and should not be considered financial or legal advice.</p>
  </div>
</body>
</html>`;
}
