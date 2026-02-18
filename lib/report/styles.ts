// All CSS for the PDF report — print rules, page styling, typography

export function getReportStyles(): string {
  return `
    @page {
      size: A4;
      margin: 0;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      color: #1e293b;
      background: white;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      font-size: 13px;
      line-height: 1.5;
    }

    .report-page {
      width: 210mm;
      min-height: 297mm;
      max-height: 297mm;
      overflow: hidden;
      page-break-after: always;
      page-break-inside: avoid;
      padding: 40px 50px 80px 50px;
      position: relative;
      background: white;
    }

    .report-page:last-child {
      page-break-after: auto;
    }

    /* Cover page — no top padding, special layout */
    .cover-page {
      padding: 0;
    }

    /* Typography */
    .section-title {
      font-size: 11px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 14px;
    }

    .section-title-lg {
      font-size: 16px;
      font-weight: 700;
      color: #1a1e42;
      margin-bottom: 16px;
    }

    .text-sm { font-size: 11px; }
    .text-xs { font-size: 10px; }
    .text-xxs { font-size: 9px; }
    .text-lg { font-size: 16px; }
    .text-xl { font-size: 20px; }
    .text-2xl { font-size: 24px; }

    .font-bold { font-weight: 700; }
    .font-semibold { font-weight: 600; }
    .font-medium { font-weight: 500; }

    .text-navy { color: #1a1e42; }
    .text-teal { color: #0d9488; }
    .text-gray { color: #64748b; }
    .text-gray-light { color: #94a3b8; }
    .text-white { color: #ffffff; }
    .text-amber { color: #d97706; }
    .text-rose { color: #e11d48; }

    /* Layout helpers */
    .flex { display: flex; }
    .flex-col { flex-direction: column; }
    .items-center { align-items: center; }
    .justify-between { justify-content: space-between; }
    .gap-2 { gap: 8px; }
    .gap-3 { gap: 12px; }
    .gap-4 { gap: 16px; }
    .gap-6 { gap: 24px; }

    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }

    .grid-3 {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 16px;
    }

    .grid-4 {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr 1fr;
      gap: 12px;
    }

    /* Cards */
    .card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px;
    }

    .card-sm {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 12px;
    }

    .card-highlight {
      background: linear-gradient(135deg, #f0fdfa, #ecfeff);
      border: 1px solid #99f6e4;
      border-radius: 8px;
      padding: 16px;
    }

    .card-amber {
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 8px;
      padding: 16px;
    }

    .card-navy {
      background: #1a1e42;
      border: none;
      border-radius: 8px;
      padding: 16px;
      color: #ffffff;
    }

    /* KPI cards */
    .kpi-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 18px;
      text-align: center;
    }

    .kpi-value {
      font-size: 28px;
      font-weight: 700;
      color: #0d9488;
      line-height: 1.2;
    }

    .kpi-label {
      font-size: 10px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-top: 4px;
    }

    .kpi-sub {
      font-size: 10px;
      color: #94a3b8;
      margin-top: 2px;
    }

    /* Tables */
    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
    }

    .data-table th {
      background: #f8fafc;
      border-bottom: 2px solid #e2e8f0;
      padding: 8px 12px;
      text-align: left;
      font-weight: 600;
      color: #475569;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .data-table td {
      padding: 8px 12px;
      border-bottom: 1px solid #f1f5f9;
      color: #334155;
    }

    .data-table tr:nth-child(even) td {
      background: #f8fafc;
    }

    .data-table .value-cell {
      font-weight: 600;
      color: #0d9488;
      text-align: right;
    }

    /* Badges */
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 9px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .badge-teal {
      background: #ccfbf1;
      color: #0d9488;
    }

    .badge-amber {
      background: #fef3c7;
      color: #d97706;
    }

    .badge-rose {
      background: #ffe4e6;
      color: #e11d48;
    }

    .badge-blue {
      background: #dbeafe;
      color: #2563eb;
    }

    .badge-gray {
      background: #f1f5f9;
      color: #64748b;
    }

    .badge-navy {
      background: #1a1e42;
      color: #ffffff;
    }

    /* Impact level badges */
    .impact-very-high { background: #fee2e2; color: #dc2626; }
    .impact-high { background: #fef3c7; color: #d97706; }
    .impact-medium { background: #dbeafe; color: #2563eb; }
    .impact-low { background: #dcfce7; color: #16a34a; }

    /* Score bars */
    .score-bar {
      height: 6px;
      background: #e2e8f0;
      border-radius: 3px;
      overflow: hidden;
    }

    .score-bar-fill {
      height: 100%;
      border-radius: 3px;
      background: linear-gradient(90deg, #0d9488, #06b6d4);
    }

    /* Callout boxes */
    .callout {
      background: #f0fdfa;
      border-left: 3px solid #0d9488;
      padding: 12px 16px;
      border-radius: 0 6px 6px 0;
      font-size: 11px;
      color: #134e4a;
    }

    .callout-amber {
      background: #fffbeb;
      border-left: 3px solid #f59e0b;
      padding: 12px 16px;
      border-radius: 0 6px 6px 0;
      font-size: 11px;
      color: #92400e;
    }

    /* Bullet lists */
    .bullet-list {
      padding-left: 16px;
      font-size: 11px;
      color: #334155;
    }

    .bullet-list li {
      margin-bottom: 4px;
      line-height: 1.5;
    }

    /* Dividers */
    .divider {
      border: none;
      border-top: 1px solid #e2e8f0;
      margin: 16px 0;
    }

    .divider-thick {
      border: none;
      border-top: 2px solid #e2e8f0;
      margin: 20px 0;
    }

    /* SVG chart containers */
    .chart-container {
      width: 100%;
      display: flex;
      justify-content: center;
      margin: 12px 0;
    }

    .chart-container svg {
      max-width: 100%;
      height: auto;
    }

    /* AI badge */
    .ai-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 10px;
      background: linear-gradient(135deg, #1a1e42, #312e81);
      color: #c4b5fd;
      border-radius: 12px;
      font-size: 9px;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    /* Disclaimer */
    .disclaimer-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-left: 3px solid #94a3b8;
      border-radius: 0 6px 6px 0;
      padding: 16px 20px;
      font-size: 9px;
      color: #64748b;
      line-height: 1.6;
    }

    /* Print-specific */
    @media print {
      body { background: white; }
      .report-page { box-shadow: none; }
      .no-print { display: none !important; }
    }

    /* Screen preview */
    @media screen {
      body {
        background: #e2e8f0;
        padding: 20px 0;
      }
      .report-page {
        margin: 20px auto;
        box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1);
      }
    }
  `;
}
