// All CSS for the PDF report — print rules, page styling, typography
// Designed for consulting-quality (Lazard/McKinsey) output

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
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      color: #1e293b;
      background: white;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      font-size: 12px;
      line-height: 1.6;
      letter-spacing: -0.01em;
    }

    .report-page {
      width: 210mm;
      min-height: 297mm;
      page-break-after: always;
      page-break-inside: avoid;
      padding: 44px 52px 56px 52px;
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

    /* ========================================
       TYPOGRAPHY — Clean hierarchy
       ======================================== */

    .section-title {
      font-size: 10px;
      font-weight: 700;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      margin-bottom: 12px;
    }

    .section-title-lg {
      font-size: 20px;
      font-weight: 700;
      color: #1a1e42;
      margin-bottom: 16px;
      letter-spacing: -0.02em;
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

    /* ========================================
       LAYOUT
       ======================================== */

    .flex { display: flex; }
    .flex-col { flex-direction: column; }
    .items-center { align-items: center; }
    .justify-between { justify-content: space-between; }
    .gap-2 { gap: 10px; }
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
      gap: 14px;
    }

    /* ========================================
       CARDS — Refined, professional
       ======================================== */

    .card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 18px;
    }

    .card-sm {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 5px;
      padding: 12px 16px;
    }

    .card-highlight {
      background: linear-gradient(135deg, #f0fdfa 0%, #ecfeff 100%);
      border: 1px solid #a7f3d0;
      border-radius: 6px;
      padding: 18px;
    }

    .card-amber {
      background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
      border: 1px solid #fde68a;
      border-radius: 6px;
      padding: 18px;
    }

    .card-navy {
      background: linear-gradient(135deg, #1a1e42 0%, #1e2556 100%);
      border: none;
      border-radius: 6px;
      padding: 18px;
      color: #ffffff;
    }

    /* ========================================
       KPI CARDS — Dashboard metrics
       ======================================== */

    .kpi-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px 14px;
      text-align: center;
    }

    .kpi-value {
      font-size: 28px;
      font-weight: 700;
      color: #0d9488;
      line-height: 1.1;
      letter-spacing: -0.02em;
    }

    .kpi-label {
      font-size: 9px;
      font-weight: 700;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      margin-top: 5px;
    }

    .kpi-sub {
      font-size: 10px;
      color: #94a3b8;
      margin-top: 3px;
    }

    /* ========================================
       TABLES — Clean, professional
       ======================================== */

    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
    }

    .data-table th {
      background: #f8fafc;
      border-bottom: 2px solid #cbd5e1;
      padding: 9px 12px;
      text-align: left;
      font-weight: 700;
      color: #475569;
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .data-table td {
      padding: 9px 12px;
      border-bottom: 1px solid #f1f5f9;
      color: #334155;
    }

    .data-table tr:nth-child(even) td {
      background: #fafbfc;
    }

    .data-table .value-cell {
      font-weight: 700;
      color: #1a1e42;
      text-align: right;
    }

    /* ========================================
       BADGES — Compact, informational
       ======================================== */

    .badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 3px;
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .badge-teal {
      background: #ccfbf1;
      color: #0d9488;
    }

    .badge-amber {
      background: #fef3c7;
      color: #b45309;
    }

    .badge-rose {
      background: #ffe4e6;
      color: #be123c;
    }

    .badge-blue {
      background: #dbeafe;
      color: #1d4ed8;
    }

    .badge-gray {
      background: #f1f5f9;
      color: #475569;
    }

    .badge-navy {
      background: #1a1e42;
      color: #ffffff;
    }

    /* Impact level badges */
    .impact-very-high { background: #fee2e2; color: #b91c1c; }
    .impact-high { background: #fef3c7; color: #b45309; }
    .impact-medium { background: #dbeafe; color: #1d4ed8; }
    .impact-low { background: #dcfce7; color: #15803d; }

    /* ========================================
       SCORE BARS
       ======================================== */

    .score-bar {
      height: 5px;
      background: #e2e8f0;
      border-radius: 3px;
      overflow: hidden;
    }

    .score-bar-fill {
      height: 100%;
      border-radius: 3px;
      background: linear-gradient(90deg, #0d9488, #06b6d4);
    }

    /* ========================================
       CALLOUT BOXES
       ======================================== */

    .callout {
      background: #f0fdfa;
      border-left: 3px solid #0d9488;
      padding: 12px 16px;
      border-radius: 0 4px 4px 0;
      font-size: 11px;
      color: #134e4a;
      line-height: 1.6;
    }

    .callout-amber {
      background: #fffbeb;
      border-left: 3px solid #f59e0b;
      padding: 12px 16px;
      border-radius: 0 4px 4px 0;
      font-size: 11px;
      color: #78350f;
      line-height: 1.6;
    }

    /* ========================================
       BULLET LISTS
       ======================================== */

    .bullet-list {
      padding-left: 16px;
      font-size: 11px;
      color: #334155;
    }

    .bullet-list li {
      margin-bottom: 4px;
      line-height: 1.5;
    }

    /* ========================================
       DIVIDERS
       ======================================== */

    .divider {
      border: none;
      border-top: 1px solid #e2e8f0;
      margin: 14px 0;
    }

    .divider-thick {
      border: none;
      border-top: 2px solid #e2e8f0;
      margin: 18px 0;
    }

    /* ========================================
       CHART CONTAINERS
       ======================================== */

    .chart-container {
      width: 100%;
      display: flex;
      justify-content: center;
      margin: 8px 0;
    }

    .chart-container svg {
      max-width: 100%;
      height: auto;
    }

    /* ========================================
       AI BADGE
       ======================================== */

    .ai-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 10px;
      background: linear-gradient(135deg, #1a1e42, #312e81);
      color: #c4b5fd;
      border-radius: 3px;
      font-size: 8px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }

    /* ========================================
       DISCLAIMER
       ======================================== */

    .disclaimer-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-left: 3px solid #94a3b8;
      border-radius: 0 4px 4px 0;
      padding: 16px 20px;
      font-size: 9px;
      color: #64748b;
      line-height: 1.7;
    }

    /* ========================================
       PRINT & SCREEN
       ======================================== */

    @media print {
      body { background: white; }
      .report-page { box-shadow: none; }
      .no-print { display: none !important; }
    }

    @media screen {
      body {
        background: #94a3b8;
        padding: 20px 0;
      }
      .report-page {
        margin: 20px auto;
        box-shadow: 0 4px 24px rgba(0,0,0,0.15);
      }
    }
  `;
}
